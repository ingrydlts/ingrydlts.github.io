// Testa crm-1a1.sql (o 1:1 pago: áudio liberado e o aviso do dia seguinte) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:1a1
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
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1.sql'), 'utf8');
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

  console.log('== Quem pode avisar do pagamento ==');
  check('só o Worker (service_role): nem anônimo, nem a pessoa, nem a admin', !(await attempt(() => asAnon(() => db.query('select crm_1a1_pago($1, 20, $2)', [ana.c, 'x'])))).ok && !(await attempt(() => asUser(ana.u.id, () => db.query('select crm_1a1_pago($1, 20, $2)', [ana.c, 'x'])))).ok && !(await attempt(() => asUser(admin.id, () => db.query('select crm_1a1_pago($1, 20, $2)', [ana.c, 'x'])))).ok);
  check('minutos fora de 20 e 40, sessão vazia e contato que não existe são recusados', await falha(() => pagar(ana.c, 30, 's1'), 'pagamento_invalido') && await falha(() => pagar(ana.c, 20, ''), 'pagamento_invalido') && await falha(() => pagar('00000000-0000-0000-0000-000000000000', 20, 's1'), 'contato_nao_encontrado'));

  console.log('\n== Pagou: áudio liberado e o aviso do dia seguinte ==');
  const r = await pagar(ana.c, 20, 'cs_ana_1');
  check('registra o pagamento e libera o áudio por 30 dias', r.duplicado === false && (await um('select minutos from um_a_um_pagamentos where contato_id=$1', [ana.c])).minutos === 20 && Math.round((new Date(r.audio_ate) - Date.now()) / 864e5) === 30);
  const av = await um("select * from caso_avisos where id = $1", [r.aviso_id]);
  check('agenda UM aviso para o dia seguinte às 9h de Paris, que abre o chat', r.aviso_agendado === true && av.estado === 'agendado' && dia(av.liberar_em) === amanha && av.destino.tela === 'chat' && /Antecipe o assunto/.test(av.titulo) &&
    (await um("select to_char(liberar_em at time zone 'Europe/Paris', 'HH24:MI') h from caso_avisos where id=$1", [r.aviso_id])).h === '09:00');
  check('o pagamento vira evento na linha do tempo', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='um_a_um_pago'", [ana.c])).n === 1);
  const again = await pagar(ana.c, 20, 'cs_ana_1');
  check('o Stripe reenviou o mesmo evento: volta como duplicado e nada é criado de novo', again.duplicado === true && (await um('select count(*)::int n from um_a_um_pagamentos where contato_id=$1', [ana.c])).n === 1 && (await um("select count(*)::int n from caso_avisos where contato_id=$1 and titulo like 'Antecipe%'", [ana.c])).n === 1);
  const r2 = await pagar(ana.c, 40, 'cs_ana_2');
  check('um segundo pagamento (outra sessão) conta, com o seu próprio aviso', r2.duplicado === false && (await um('select count(*)::int n from um_a_um_pagamentos where contato_id=$1', [ana.c])).n === 2);
  const rb = await pagar(bia.c, 40, 'cs_bia_1');
  check('sem consentimento o pagamento é registrado e o áudio liberado, mas o aviso fica em rascunho para você aprovar', rb.duplicado === false && rb.aviso_agendado === false && (await um('select estado from caso_avisos where id=$1', [rb.aviso_id])).estado === 'rascunho');

  console.log('\n== A pessoa pergunta pelo áudio ==');
  const m = async (u) => (await asUser(u.id, () => um('select meu_1a1() r'))).r;
  check('quem pagou: áudio liberado, com a data e os minutos', (await m(ana.u)).audio === true && (await m(ana.u)).minutos === 40 && !!(await m(ana.u)).audio_ate);
  check('quem nunca pagou: áudio fechado', (await m(cris.u)).audio === false);
  await db.query("update um_a_um_pagamentos set audio_ate = now() - interval '1 day' where contato_id=$1", [ana.c]);
  check('depois dos 30 dias o áudio fecha de novo', (await m(ana.u)).audio === false);
  check('anônimo não consulta; a pessoa não lê a tabela de pagamentos', !(await attempt(() => asAnon(() => db.query('select meu_1a1()')))).ok && (await asUser(bia.u.id, () => q('select * from um_a_um_pagamentos'))).length === 0);

  console.log('\n== O aviso chega no dia seguinte ==');
  await db.query("update caso_avisos set liberar_em = now() - interval '1 minute' where id=$1", [r.aviso_id]);
  const n = (await um('select crm_avisos_materializar() n')).n;
  const vis = await asUser(ana.u.id, () => q('select titulo, destino from meus_avisos()'));
  check('a rotina entrega e a pessoa vê o aviso, com o destino "chat"', n >= 1 && vis.some((x) => /Antecipe o assunto/.test(x.titulo) && x.destino.tela === 'chat'));
  check('caso_destino_ok aceita "chat" e continua recusando telas fora da lista', (await um("select caso_destino_ok('{\"tela\":\"chat\"}'::jsonb) ok")).ok === true && (await um("select caso_destino_ok('{\"tela\":\"https://evil\"}'::jsonb) ok")).ok === false);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
