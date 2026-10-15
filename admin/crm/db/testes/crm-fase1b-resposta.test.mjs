// Testa crm-fase1b-resposta.sql (as respostas da aba Conversa: modelo 'resposta' fora do reimpacto,
// o que a admin grava e marca, e a resposta seguinte dela voltando para o fio) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1b
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
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); }
  finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql', 'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const colunas = async () => (await q("select column_name from information_schema.columns where table_name = 'crm_contatos' order by ordinal_position")).map((x) => x.column_name).join(',');
  const antes = await colunas();
  const sql = readFileSync(path.resolve(HERE, '../crm-fase1b-resposta.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);
  check('visão com as mesmas colunas, na mesma ordem', (await colunas()) === antes);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const visao = async (id) => (await asUser(admin.id, async () => (await db.query('select * from crm_contatos where id = $1', [id])).rows))[0];

  // Ana: recebeu o e-mail 1 do guia, respondeu por e-mail e tocou no e-mail 2.
  const [ana] = await q("insert into contatos (email, nome) values ('ana@example.com', 'Ana Maria') returning id");
  const [e1] = await q(`insert into emails_enviados (contato_id, modelo, assunto, status, provedor_id, enviado_em, criado_em)
    values ($1, 'cf_guia_1', 'Ana, aqui está o seu checklist', 'aberto', '<e1@smtp.example.net>', now() - interval '5 days', now() - interval '5 days') returning id`, [ana.id]);
  await db.query(`insert into respostas_email (de_email, assunto, texto, message_id, em_resposta_a, recebido_em)
    values ('ana@example.com', 'Re: Ana, aqui está o seu checklist', 'Quero Lyon.', '<r1@mail.example.com>', '<e1@smtp.example.net>', now() - interval '4 days')`);
  await db.query("insert into respostas_email (contato_id, de_email, texto, canal) values ($1, 'ana@example.com', 'Cidade: Lyon', 'toque')", [ana.id]);
  let [ultimoAntes] = await q('select ultimo_evento_em from contatos where id = $1', [ana.id]);

  console.log('\n== A admin responde da aba Conversa (o que o Worker faz com o token dela) ==');
  const enviou = await attempt(() => asUser(admin.id, () => db.query(`insert into emails_enviados (contato_id, modelo, assunto, corpo, status, provedor_id, enviado_em)
    values ($1, 'resposta', 'Re: Ana, aqui está o seu checklist', 'Que bom! Me manda o link do Master.', 'agendado', '<n1@smtp.example.net>', now() - interval '4 days')`, [ana.id])));
  check('admin grava a resposta em emails_enviados', enviou.ok);
  const marcou = await asUser(admin.id, async () => (await db.query("update respostas_email set status = 'respondida', respondida_em = now() where contato_id = $1 and status = 'nova' returning id", [ana.id])).rows);
  check('admin marca as respostas novas dela (e-mail e toque) como respondidas', marcou.length === 2);
  let v = await visao(ana.id);
  check('sem resposta nova, sai do "Precisa de você"', v.resposta_aberta_id === null && !/respondeu/.test(v.motivo || ''));
  check('a resposta não vira o "último e-mail" do reimpacto', v.email_status === null && v.email_enviado_em === null && v.segmento === null);
  let ev = await q("select dados from eventos where contato_id = $1 and tipo = 'email_enviado' and dados->>'modelo' = 'resposta'", [ana.id]);
  check('linha do tempo: "E-mail enviado" com modelo resposta', ev.length === 1);
  let [ultimoDepois] = await q('select ultimo_evento_em from contatos where id = $1', [ana.id]);
  check('responder não zera o "parada há N dias"', String(ultimoDepois.ultimo_evento_em) === String(ultimoAntes.ultimo_evento_em));

  console.log('\n== Ela responde de novo pelo Gmail ==');
  // Responde de outro endereço (encaminhou do celular, por exemplo): a ligação vem pelo In-Reply-To.
  const [r2] = await q(`insert into respostas_email (de_email, assunto, texto, message_id, em_resposta_a)
    values ('ana.outro@example.com', 'Re: Ana, aqui está o seu checklist', 'Este aqui: Master em Ciência Política.', '<r2@mail.example.com>', '<n1@smtp.example.net>') returning *`);
  const [nossa] = await q("select id from emails_enviados where provedor_id = '<n1@smtp.example.net>'");
  check('volta para a ficha dela pelo In-Reply-To = provedor_id da resposta', r2.contato_id === ana.id && Number(r2.email_id) === Number(nossa.id));
  v = await visao(ana.id);
  check('e volta para "Precisa de você"', Number(v.resposta_aberta_id) === Number(r2.id) && /^respondeu o seu e-mail em/.test(v.motivo || ''));

  console.log('\n== Reimpacto continua olhando o e-mail do link de acesso ==');
  const [bia] = await q("insert into contatos (email, nome) values ('bia@example.com', 'Bia') returning id");
  await db.query(`insert into emails_enviados (contato_id, modelo, status, enviado_em, criado_em)
    values ($1, 'boas_vindas', 'entregue', now() - interval '5 days', now() - interval '5 days')`, [bia.id]);
  check('boas-vindas entregue há 5 dias: "não abriu"', (await visao(bia.id)).segmento === 'naoabriu');
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1, 'resposta', 'aberto', now())", [bia.id]);
  v = await visao(bia.id);
  check('uma resposta depois não muda o segmento nem o status', v.segmento === 'naoabriu' && v.email_status === 'entregue');
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1, 'naoabriu', 'agendado', now())", [bia.id]);
  check('um reimpacto depois continua contando', (await visao(bia.id)).email_status === 'agendado');

  console.log('\n== RLS ==');
  const [outra] = await q("insert into auth.users (email) values ('curiosa@example.com') returning id");
  check('logada que não é admin não grava resposta',
    !(await attempt(() => asUser(outra.id, () => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'resposta', 'agendado')", [ana.id])))).ok);
  const mexeu = await attempt(() => asUser(outra.id, async () => (await db.query("update respostas_email set status = 'arquivada' where contato_id = $1 returning id", [ana.id])).rows));
  check('logada que não é admin não marca respostas', !mexeu.ok || mexeu.value.length === 0);
  check('anon não lê emails_enviados', !(await attempt(() => asAnon(() => db.query('select * from emails_enviados')))).ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
