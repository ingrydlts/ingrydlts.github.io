// Testa crm-1a1-vinculo.sql (o pagamento sabe qual 1:1 pagou) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:1a1-vinculo
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-fluxo.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-1a1.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1-vinculo.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email, consentimento) => {
    const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    const c = (await um('select id from contatos where email=$1', [email])).id;
    if (consentimento) await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [c]);
    return { u, c };
  };
  const ana = await nova('ana@example.com', true), bia = await nova('bia@example.com', false), cris = await nova('cris@example.com', true);
  const pagar = (c, min, sessao) => asServico(() => um('select crm_1a1_pago($1, $2, $3) r', [c, min, sessao])).then((x) => x.r);
  const dia = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  const hoje = dia(new Date());
  const amanha = (() => { const x = new Date(hoje + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })();

  const ligado = async (sessao) => (await um('select um_a_um_id from um_a_um_pagamentos where sessao=$1', [sessao])).um_a_um_id;
  const marca = async (c, quando, status = 'agendado') => (await um('insert into um_a_um (contato_id, quando, status) values ($1, $2, $3) returning id', [c, quando, status])).id;

  console.log('== Pagamento novo liga ao 1:1 certo ==');
  const tarde = await marca(ana.c, '2026-12-20T10:00:00Z'), cedo = await marca(ana.c, '2026-12-05T10:00:00Z'), semData = await marca(ana.c, null), cancelado = await marca(ana.c, '2026-12-01T10:00:00Z', 'cancelado');
  await pagar(ana.c, 20, 's_a1'); await pagar(ana.c, 20, 's_a2'); await pagar(ana.c, 40, 's_a3'); await pagar(ana.c, 20, 's_a4');
  check('1º pagamento: o 1:1 marcado mais cedo', await ligado('s_a1') === cedo);
  check('2º pagamento: o seguinte, que ainda não foi pago', await ligado('s_a2') === tarde);
  check('3º pagamento: o "a combinar" fica por último', await ligado('s_a3') === semData);
  check('o cancelado nunca é ligado; sem 1:1 livre o pagamento fica sem vínculo', await ligado('s_a4') === null && (await um('select count(*)::int n from um_a_um_pagamentos where um_a_um_id=$1', [cancelado])).n === 0);
  const rep = await pagar(ana.c, 20, 's_a1');
  check('o Stripe reenviando o mesmo evento continua duplicado, sem religar', rep.duplicado === true && await ligado('s_a1') === cedo);

  console.log('\n== A chave protege ==');
  const deBia = await marca(bia.c, '2026-12-10T10:00:00Z');
  const pgAna = (await um('select id from um_a_um_pagamentos where sessao=$1', ['s_a4'])).id;
  check('não liga o pagamento de uma pessoa ao 1:1 de outra (chave composta)', !(await attempt(() => db.query('update um_a_um_pagamentos set um_a_um_id=$2 where id=$1', [pgAna, deBia]))).ok);
  check('uma conversa não tem dois pagamentos (índice único)', !(await attempt(() => db.query('update um_a_um_pagamentos set um_a_um_id=$2 where id=$1', [pgAna, cedo]))).ok);
  await db.query('delete from um_a_um where id = $1', [cedo]);
  check('apagar o 1:1 mantém o pagamento e só solta o vínculo', (await um('select um_a_um_id, contato_id from um_a_um_pagamentos where sessao=$1', ['s_a1'])).um_a_um_id === null && (await um('select count(*)::int n from um_a_um_pagamentos where sessao=$1', ['s_a1'])).n === 1);

  console.log('\n== Pagamentos de antes e isolamento ==');
  const cris2 = cris.c, antigoA = await marca(cris2, '2026-10-01T10:00:00Z', 'feito'), antigoB = await marca(cris2, '2026-11-01T10:00:00Z', 'feito');
  await db.query("insert into um_a_um_pagamentos (contato_id, minutos, sessao, pago_em, audio_ate) values ($1, 20, 'velho1', '2026-11-02T10:00:00Z', now()), ($1, 20, 'velho2', '2026-09-30T10:00:00Z', now())", [cris2]);
  check('roda de novo e liga os antigos ao 1:1 mais próximo da data, sem repetir', (await attempt(() => db.exec(sql))).ok && await ligado('velho2') === antigoA && await ligado('velho1') === antigoB);
  check('rodar uma terceira vez não muda nada', (await attempt(() => db.exec(sql))).ok && await ligado('velho1') === antigoB);
  check('anônimo e cliente não leem a tabela de pagamentos', !(await attempt(() => asAnon(() => q('select um_a_um_id from um_a_um_pagamentos')))).ok && (await asUser(ana.u.id, () => q('select um_a_um_id from um_a_um_pagamentos'))).length === 0);
  check('crm_1a1_pago continua só do Worker', !(await attempt(() => asUser(ana.u.id, () => db.query('select crm_1a1_pago($1, 20, $2)', [ana.c, 'x'])))).ok && !(await attempt(() => asAnon(() => db.query('select crm_1a1_pago($1, 20, $2)', [ana.c, 'y'])))).ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
