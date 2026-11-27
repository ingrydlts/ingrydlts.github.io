// Testa crm-compras-entradas.sql (as entradas de quem comprou no material: só a admin lê, só o Worker grava, sem dado pessoal) no PGlite.
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-compras-entradas.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: e }; } }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asUser = (id, fn) => asRole('authenticated', id, fn);
const asAnon = (fn) => asRole('anon', null, fn);
const asServico = (fn) => asRole('service_role', null, fn);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const um = async (sql, p) => (await q(sql, p))[0];

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-onboarding.sql', 'crm-assinaturas.sql', 'crm-pagamentos.sql', 'crm-compras.sql', 'crm-compras-entradas.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  check('roda de novo (idempotente)', (await attempt(() => db.exec(readFileSync(path.resolve(HERE, '../crm-compras-entradas.sql'), 'utf8')))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await asServico(() => db.query("select crm_compra_registrar('cs_1','manual-destrave-domiciliacao','ana@example.com',990,'EUR',now(),null)"));
  await asServico(() => db.query("select crm_compra_registrar('cs_2','manual-destrave-domiciliacao','bia@example.com',990,'EUR',now(),null)"));
  const entradas = async (ref) => (await um('select count(*)::int n from compras_entradas e join compras c on c.id = e.compra_id where c.referencia = $1', [ref])).n;
  const entrada = (ref) => asServico(() => db.query('select crm_compra_entrada($1)', [ref]));

  console.log('== Quem grava ==');
  check('só o Worker (service_role): nem anônimo, nem a pessoa, nem a admin', !(await attempt(() => asAnon(() => db.query("select crm_compra_entrada('cs_1')")))).ok
    && !(await attempt(() => asUser(ana.id, () => db.query("select crm_compra_entrada('cs_1')")))).ok && !(await attempt(() => asUser(admin.id, () => db.query("select crm_compra_entrada('cs_1')")))).ok);
  check('ninguém além do Worker insere direto na tabela', !(await attempt(() => asAnon(() => db.query("insert into compras_entradas (compra_id) values (1)")))).ok
    && !(await attempt(() => asUser(ana.id, () => db.query("insert into compras_entradas (compra_id) values (1)")))).ok && !(await attempt(() => asUser(admin.id, () => db.query("insert into compras_entradas (compra_id) values (1)")))).ok);

  console.log('== Contagem ==');
  await entrada('cs_1');
  check('uma entrada registrada para a compra certa', (await entradas('cs_1')) === 1 && (await entradas('cs_2')) === 0);
  await entrada('cs_1');
  check('segunda entrada em menos de 1 minuto não conta (duplo clique, recarregar)', (await entradas('cs_1')) === 1);
  await db.query("update compras_entradas set em = now() - interval '2 minutes'");
  await entrada('cs_1');
  check('depois de 1 minuto, conta de novo', (await entradas('cs_1')) === 2);
  check('compra que não existe: não grava nada e não dá erro', (await attempt(() => entrada('cs_inventada'))).ok && (await um('select count(*)::int n from compras_entradas')).n === 2);
  check('referência vazia ou enorme é recusada', !(await attempt(() => entrada(''))).ok && !(await attempt(() => entrada('x'.repeat(201)))).ok);

  console.log('== Quem lê ==');
  check('a admin lê as entradas', (await asUser(admin.id, () => q('select * from compras_entradas'))).length === 2);
  check('a pessoa comum não lê nada (nem as dela)', (await asUser(ana.id, () => q('select * from compras_entradas'))).length === 0);
  check('anônimo: sem acesso à tabela', !(await attempt(() => asAnon(() => q('select * from compras_entradas')))).ok);
  check('a tabela só tem id, compra e hora (nada de IP, chave, e-mail ou capítulo)', (await q("select column_name from information_schema.columns where table_name = 'compras_entradas' order by 1")).map((r) => r.column_name).join(',') === 'compra_id,em,id');
  await db.query("delete from compras where referencia = 'cs_1'");
  check('apagar a compra apaga as entradas', (await um('select count(*)::int n from compras_entradas')).n === 0);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
