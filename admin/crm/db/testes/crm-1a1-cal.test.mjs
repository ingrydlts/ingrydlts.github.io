// Testa crm-1a1-cal.sql (o código da reserva do Cal.com na linha de um_a_um) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:1a1-cal
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2.sql'), 'utf8'));
  // Como no Supabase: o service_role (o Worker) ignora a RLS e tem acesso às tabelas.
  await db.exec("alter role service_role bypassrls; grant all on all tables in schema public to service_role; grant usage on all sequences in schema public to service_role;");
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1-cal.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);
  check('roda a 3ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => {
    const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'lead') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id };
  };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');

  console.log('== A coluna e o índice ==');
  check('a coluna cal_uid existe e começa vazia nos 1:1 de antes', (await um("select count(*)::int n from information_schema.columns where table_name='um_a_um' and column_name='cal_uid'")).n === 1);
  await db.query("insert into um_a_um (contato_id, quando) values ($1, '2026-12-01T10:00:00Z')", [ana.c]);
  check('1:1 marcado na mão continua funcionando, sem cal_uid', (await um('select cal_uid from um_a_um where contato_id=$1', [ana.c])).cal_uid === null);
  await db.query("insert into um_a_um (contato_id, quando) values ($1, '2026-12-02T10:00:00Z'), ($1, null)", [ana.c]);
  check('vários 1:1 sem cal_uid convivem (vazio não conta no índice único)', (await um('select count(*)::int n from um_a_um where contato_id=$1 and cal_uid is null', [ana.c])).n === 3);

  console.log('\n== Uma reserva, uma linha ==');
  const ins = (c, uid, quando = '2026-11-23T14:40:00Z') => asServico(() => db.query("insert into um_a_um (contato_id, quando, status, cal_uid, nota) values ($1, $2, 'agendado', $3, 'Marcado pelo Cal.com (20 min).')", [c, quando, uid]));
  check('o Worker (service_role) grava a reserva com o cal_uid', (await attempt(() => ins(ana.c, 'uid-abc'))).ok);
  check('a mesma reserva de novo é recusada pelo banco (índice único)', !(await attempt(() => ins(ana.c, 'uid-abc'))).ok);
  check('a recusa vale até para outra pessoa (o código é da reserva, não da pessoa)', !(await attempt(() => ins(bia.c, 'uid-abc'))).ok);
  check('outra reserva é aceita', (await attempt(() => ins(bia.c, 'uid-xyz'))).ok);
  check('uid vazio é recusado', !(await attempt(() => ins(ana.c, ''))).ok);
  check('uid com mais de 100 caracteres é recusado', !(await attempt(() => ins(ana.c, 'x'.repeat(101)))).ok);
  check('uid de 100 caracteres cabe', (await attempt(() => ins(ana.c, 'y'.repeat(100)))).ok);

  console.log('\n== Remarcar e cancelar acham a linha pelo código ==');
  await asServico(() => db.query("update um_a_um set quando='2026-11-24T09:00:00Z' where cal_uid='uid-abc'"));
  check('remarcar muda a data da mesma linha', new Date((await um("select quando from um_a_um where cal_uid='uid-abc'")).quando).toISOString() === '2026-11-24T09:00:00.000Z' && (await um("select count(*)::int n from um_a_um where cal_uid='uid-abc'")).n === 1);
  await asServico(() => db.query("update um_a_um set cal_uid='uid-novo' where cal_uid='uid-abc'"));
  check('remarcar no Cal.com troca o código da reserva (a nova reserva tem uid novo)', (await um("select count(*)::int n from um_a_um where cal_uid='uid-novo'")).n === 1 && (await um("select count(*)::int n from um_a_um where cal_uid='uid-abc'")).n === 0);
  await asServico(() => db.query("update um_a_um set status='cancelado' where cal_uid='uid-novo' and status='agendado'"));
  check('cancelar muda só o status', (await um("select status from um_a_um where cal_uid='uid-novo'")).status === 'cancelado');

  console.log('\n== O gatilho de antes continua valendo ==');
  const ev = await q("select dados from eventos where contato_id=$1 and tipo='um_a_um_agendado'", [bia.c]);
  check('a reserva gravada pelo Worker gera o evento "1:1 marcado" na Jornada', ev.length === 1 && ev[0].dados.quando === '2026-11-23T14:40:00+00:00');
  check('e leva a pessoa ao estágio 1:1', (await um('select estagio from contatos where id=$1', [bia.c])).estagio === 'um_a_um');

  console.log('\n== Isolamento ==');
  check('anônimo não lê um_a_um', !(await attempt(() => asAnon(() => q('select cal_uid from um_a_um')))).ok);
  check('cliente não lê o 1:1 de ninguém (nem o dela)', (await asUser(ana.u.id, () => q('select cal_uid from um_a_um'))).length === 0);
  check('cliente não grava cal_uid', !(await attempt(() => asUser(ana.u.id, () => db.query("insert into um_a_um (contato_id, cal_uid) values ($1, 'forjado')", [ana.c])))).ok);
  check('cliente não muda o cal_uid de um 1:1', !(await attempt(() => asUser(ana.u.id, () => db.query("update um_a_um set cal_uid='forjado' where contato_id=$1", [ana.c])))).ok || (await um("select count(*)::int n from um_a_um where cal_uid='forjado'")).n === 0);
  check('admin lê e vê as reservas', (await asUser(admin.id, () => q("select cal_uid from um_a_um where cal_uid is not null"))).length >= 3);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
