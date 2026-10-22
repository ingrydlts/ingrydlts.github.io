// Testa crm-checklist.sql (admin lê o checklist de qualquer pessoa, só leitura) num Postgres efêmero (PGlite).
// Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:checklist
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-checklist.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  for (const u of [ana, bia]) {
    await db.query("insert into profiles (id, nome) values ($1, 'x') on conflict (id) do nothing", [u.id]);
    await db.query("insert into checklist_items (user_id, step_key, category, label, status) values ($1, 'a', 'Moradia', 'Achar moradia', 'pendente')", [u.id]);
  }
  const itens = (quem, filtro) => asUser(quem, () => db.query('select user_id, status from checklist_items' + (filtro ? ' where user_id=$1' : ''), filtro ? [filtro] : []));

  check('admin lê o checklist de todas', (await itens(admin.id)).rows.length === 2);
  check('admin lê o de uma pessoa específica', (await itens(admin.id, ana.id)).rows.length === 1);
  check('Ana continua vendo só o dela', (await itens(ana.id)).rows.length === 1 && (await itens(ana.id)).rows[0].user_id === ana.id);
  check('Ana não vê o da Bia', (await itens(ana.id, bia.id)).rows.length === 0);
  check('admin NÃO altera o checklist dela (só leitura)', (await asUser(admin.id, () => db.query("update checklist_items set status='concluido' where user_id=$1", [ana.id]))).rowCount === 0);
  check('admin NÃO insere item no checklist dela', !(await attempt(() => asUser(admin.id, () => db.query("insert into checklist_items (user_id, step_key, category, label) values ($1, 'z', 'x', 'y')", [ana.id])))).ok);
  check('Ana ainda marca o próprio item', (await asUser(ana.id, () => db.query("update checklist_items set status='concluido' where user_id=$1", [ana.id]))).rowCount === 1);
  check('anon não lê checklist nenhum', !(await attempt(() => asAnon(() => db.query('select * from checklist_items')))).ok || (await asAnon(() => db.query('select * from checklist_items'))).rows.length === 0);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
