// Testa crm-mensagens-agendadas.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (repositório POR-DENTRO-APP) e do
// CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:agendadas
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
  console.log('== Setup ==');
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-propostas.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-chat.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-mensagens-agendadas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  await db.query("insert into contatos (email, user_id) values ('ana@example.com', $1) on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  await db.query("insert into contatos (email) values ('bia@example.com') on conflict (email) do nothing");
  const cAna = (await q("select id from contatos where email='ana@example.com'"))[0].id;
  const cBia = (await q("select id from contatos where email='bia@example.com'"))[0].id;
  const em = (horas) => new Date(Date.now() + horas * 3600e3).toISOString();
  const agendar = (cid, texto, quando, origem = 'roteiro', campo = null, quem = admin.id) =>
    asUser(quem, () => db.query('select crm_agendar_mensagem($1, $2, $3, $4, $5) as id', [cid, texto, quando, origem, campo]));

  console.log('\n== Permissões ==');
  check('pessoa logada não agenda', !(await attempt(() => agendar(cAna, 'oi', em(24), 'roteiro', null, ana.id))).ok);
  check('anon não agenda', !(await attempt(() => asAnon(() => db.query("select crm_agendar_mensagem($1, 'oi', now() + interval '1 day')", [cAna])))).ok);
  check('pessoa logada não lê a tabela (RLS)', (await asUser(ana.id, () => db.query('select * from mensagens_agendadas'))).rows.length === 0);
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from mensagens_agendadas')))).ok);
  check('pessoa logada não escreve na tabela', !(await attempt(() => asUser(ana.id, () => db.query("insert into mensagens_agendadas (contato_id, texto, enviar_em) values ($1, 'x', now())", [cAna])))).ok);

  console.log('\n== Agendar ==');
  await db.query("update contatos set ultimo_evento_em = '2026-01-01T00:00:00Z' where id=$1", [cAna]);
  const id1 = (await agendar(cAna, '  Oi, Ana! Você já tem certificado de francês?  ', em(30), 'roteiro', 'certificado_frances')).rows[0].id;
  const l1 = (await q('select * from mensagens_agendadas where id=$1', [id1]))[0];
  check('grava aparada, pendente, com o campo e a hora', l1.texto === 'Oi, Ana! Você já tem certificado de francês?' && l1.status === 'pendente' && l1.campo === 'certificado_frances' && l1.tentativas === 0 && l1.origem === 'roteiro');
  check('entra na linha do tempo sem zerar o "parada há N dias" dela', (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='mensagem_agendada'", [cAna]))[0].n === 1 && new Date((await q('select ultimo_evento_em u from contatos where id=$1', [cAna]))[0].u).toISOString() === '2026-01-01T00:00:00.000Z');
  check('mensagem vazia é recusada', !(await attempt(() => agendar(cAna, '   ', em(30)))).ok);
  check('mensagem acima de 1000 letras é recusada (o limite do chat)', !(await attempt(() => agendar(cAna, 'x'.repeat(1001), em(30)))).ok && (await attempt(() => agendar(cAna, 'x'.repeat(1000), em(30)))).ok);
  check('data no passado ou em menos de 5 minutos é recusada', !(await attempt(() => agendar(cAna, 'oi', em(-1)))).ok && !(await attempt(() => agendar(cAna, 'oi', new Date(Date.now() + 60e3).toISOString()))).ok);
  check('data além de 120 dias é recusada; 119 dias vale', !(await attempt(() => agendar(cAna, 'oi', em(24 * 121)))).ok && (await attempt(() => agendar(cAna, 'oi', em(24 * 119)))).ok);
  check('sem data é recusado', !(await attempt(() => agendar(cAna, 'oi', null))).ok);
  check('origem fora da lista é recusada', !(await attempt(() => agendar(cAna, 'oi', em(30), 'qualquer'))).ok);
  check('contato que não existe é recusado', !(await attempt(() => agendar('00000000-0000-4000-8000-000000000000', 'oi', em(30)))).ok);
  check('campo em branco vira nulo', (await q('select campo from mensagens_agendadas where id=$1', [(await agendar(cBia, 'oi', em(30), 'manual', '   ')).rows[0].id]))[0].campo === null);

  console.log('\n== Cancelar ==');
  const cancela = (id, quem = admin.id) => asUser(quem, () => db.query('select crm_cancelar_mensagem_agendada($1) as ok', [id]));
  check('pessoa logada não cancela', !(await attempt(() => cancela(id1, ana.id))).ok);
  check('admin cancela uma pendente (devolve true)', (await cancela(id1)).rows[0].ok === true && (await q('select status from mensagens_agendadas where id=$1', [id1]))[0].status === 'cancelada');
  check('cancelar de novo devolve false e não muda nada', (await cancela(id1)).rows[0].ok === false);
  await db.query("update mensagens_agendadas set status='enviada' where id=$1", [(await q('select id from mensagens_agendadas where contato_id=$1 limit 1', [cBia]))[0].id]);
  check('o que já saiu não pode ser cancelado', (await cancela((await q('select id from mensagens_agendadas where contato_id=$1 limit 1', [cBia]))[0].id)).rows[0].ok === false);
  check('cancelar id que não existe devolve false', (await cancela(999999)).rows[0].ok === false);

  console.log('\n== A fila que o Worker lê ==');
  await db.query("delete from mensagens_agendadas");
  await agendar(cAna, 'futura', em(48));
  const venc = (await agendar(cAna, 'vencida', em(1))).rows[0].id;
  await db.query("update mensagens_agendadas set enviar_em = now() - interval '2 hours' where id=$1", [venc]);
  const devidas = await q("select id, texto from mensagens_agendadas where status='pendente' and enviar_em <= now() order by enviar_em");
  check('só a vencida está devida; a futura espera', devidas.length === 1 && devidas[0].texto === 'vencida');
  check('o índice da fila existe', (await q("select count(*)::int n from pg_indexes where indexname='mensagens_agendadas_fila_idx'"))[0].n === 1);
  check('apagar a pessoa apaga as agendadas (cascata)', await (async () => { await db.query("insert into contatos (email) values ('tmp@example.com')"); const t = (await q("select id from contatos where email='tmp@example.com'"))[0].id; await agendar(t, 'x', em(30)); await db.query('delete from contatos where id=$1', [t]); return (await q('select count(*)::int n from mensagens_agendadas where contato_id=$1', [t]))[0].n === 0; })());

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
