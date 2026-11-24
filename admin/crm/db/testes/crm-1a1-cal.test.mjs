// Testa crm-1a1-cal.sql (a reserva do Cal.com entra na agenda) num Postgres efêmero (PGlite).
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-fluxo.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-1a1.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-1a1-vinculo.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1-cal.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => {
    const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id };
  };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const reserva = (c, uid, ev, quando, ant) => asServico(() => um('select crm_cal_reserva($1, $2, $3, $4, $5) r', [c, uid, ev, quando, ant || null])).then((x) => x.r);
  const linha = (uid) => um('select id, contato_id, status, quando, nota from um_a_um where cal_uid=$1', [uid]);

  console.log('== Reserva nova entra na agenda ==');
  const a = await reserva(ana.c, 'cal_1', 'criada', '2026-11-23T10:00:00Z');
  const l1 = await linha('cal_1');
  check('abre a conversa agendada, com a data da reserva', a.acao === 'criada' && l1.status === 'agendado' && new Date(l1.quando).toISOString() === '2026-11-23T10:00:00.000Z' && l1.contato_id === ana.c);
  check('o gatilho existente leva a pessoa ao estágio um_a_um', (await um('select estagio from contatos where id=$1', [ana.c])).estagio === 'um_a_um');
  const rep = await reserva(ana.c, 'cal_1', 'criada', '2026-11-23T10:00:00Z');
  check('o Cal.com reenviando o aviso não duplica', rep.acao === 'atualizada' && (await um('select count(*)::int n from um_a_um where contato_id=$1', [ana.c])).n === 1);

  console.log('\n== Pagamento que chegou antes da reserva ==');
  await db.query("insert into um_a_um_pagamentos (contato_id, minutos, sessao, pago_em, audio_ate) values ($1, 20, 'pi_b1', now(), now())", [bia.c]);
  const b = await reserva(bia.c, 'cal_b1', 'criada', '2026-11-24T09:00:00Z');
  check('a reserva liga o pagamento solto da pessoa', (await um("select um_a_um_id from um_a_um_pagamentos where sessao='pi_b1'")).um_a_um_id === b.um_a_um_id);
  await reserva(bia.c, 'cal_b2', 'criada', '2026-11-25T09:00:00Z');
  check('um pagamento só paga uma conversa', (await um("select count(*)::int n from um_a_um_pagamentos where um_a_um_id=(select id from um_a_um where cal_uid='cal_b2')")).n === 0);

  console.log('\n== Remarcar e cancelar ==');
  const rm = await reserva(ana.c, 'cal_2', 'remarcada', '2026-11-30T14:00:00Z', 'cal_1');
  const l2 = await linha('cal_2');
  check('remarcar move a mesma conversa (id novo, data nova), sem abrir outra', rm.acao === 'remarcada' && l2.id === l1.id && (await um('select count(*)::int n from um_a_um where contato_id=$1', [ana.c])).n === 1 && new Date(l2.quando).toISOString() === '2026-11-30T14:00:00.000Z');
  const ca = await reserva(ana.c, 'cal_2', 'cancelada', null);
  check('cancelar muda o status para cancelado', ca.acao === 'cancelada' && (await linha('cal_2')).status === 'cancelado');
  const rec = await reserva(ana.c, 'cal_2', 'cancelada', null);
  check('cancelar de novo não faz nada', rec.acao === 'nada');
  await db.query("update um_a_um set status='feito' where cal_uid='cal_b2'");
  check('conversa já feita não é cancelada por um aviso atrasado', (await reserva(bia.c, 'cal_b2', 'cancelada', null)).acao === 'nada' && (await linha('cal_b2')).status === 'feito');

  console.log('\n== Conversa "a combinar" criada à mão ==');
  const manual = (await um("insert into um_a_um (contato_id, quando, status) values ($1, null, 'agendado') returning id", [(await nova('caio@example.com')).c])).id;
  const caio = (await um("select contato_id from um_a_um where id=$1", [manual])).contato_id;
  const ad = await reserva(caio, 'cal_c1', 'criada', '2026-12-02T10:00:00Z');
  check('a reserva dá data à conversa que já existia, em vez de abrir uma segunda', ad.um_a_um_id === manual && (await um('select count(*)::int n from um_a_um where contato_id=$1', [caio])).n === 1);

  console.log('\n== Entradas inválidas e acesso ==');
  check('evento desconhecido é recusado', !(await attempt(() => reserva(ana.c, 'x1', 'apagada', '2026-12-01T10:00:00Z'))).ok);
  check('reserva sem data é recusada', !(await attempt(() => reserva(ana.c, 'x2', 'criada', null))).ok);
  check('ficha que não existe é recusada', !(await attempt(() => reserva('00000000-0000-0000-0000-000000000000', 'x3', 'criada', '2026-12-01T10:00:00Z'))).ok);
  check('crm_cal_reserva é só do Worker: cliente e anônimo não executam',
    !(await attempt(() => asUser(ana.u.id, () => db.query("select crm_cal_reserva($1, 'y1', 'criada', now(), null)", [ana.c])))).ok &&
    !(await attempt(() => asAnon(() => db.query("select crm_cal_reserva($1, 'y2', 'criada', now(), null)", [ana.c])))).ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
