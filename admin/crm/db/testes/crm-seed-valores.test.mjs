// Testa seed-persona-valores.sql (persona de teste com 1:1 + plataforma + ligação) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-seed-valores.test.mjs
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
async function falha(fn, motivo) { const r = await attempt(fn); return !r.ok && (!motivo || String(r.error.message).includes(motivo)); }
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
  for (const f of ['crm-fase2.sql', 'crm-onboarding.sql', 'crm-assinaturas.sql', 'crm-pagamentos.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const sql = readFileSync(path.resolve(HERE, '../seed-persona-valores.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (recomeça do zero, sem duplicar)', (await attempt(() => db.exec(sql))).ok);
  const c = await um("select * from contatos where email='camila.valores+teste@example.com'");
  const pags = await q('select * from pagamentos where contato_id=$1 order by pago_em', [c.id]);
  check('uma ficha, estágio em_uso, sem conta de login', c.estagio === 'em_uso' && c.user_id === null && (await um("select count(*)::int n from contatos where email like 'camila.valores%'")).n === 1);
  check('assinatura ativa de € 70 pela plataforma', (await um('select status, plano from assinaturas where contato_id=$1', [c.id])).status === 'active');
  check('3 pagamentos: 1:1 € 60, plataforma € 70 e ligação € 42,50, em ordem', pags.length === 3 && pags.map((p) => p.valor_centavos).join() === '6000,7000,4250' && pags.map((p) => p.tipo).join() === '1a1,assinatura,outro');
  check('total € 172,50 em euros', pags.reduce((t, p) => t + p.valor_centavos, 0) === 17250 && pags.every((p) => p.moeda === 'EUR'));
  check('7 dias pegam só a ligação (€ 42,50); 14 dias pegam os três', (await um("select sum(valor_centavos)::int s from pagamentos where contato_id=$1 and pago_em > now() - interval '7 days'", [c.id])).s === 4250 && (await um("select sum(valor_centavos)::int s from pagamentos where contato_id=$1 and pago_em > now() - interval '14 days'", [c.id])).s === 17250);
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
