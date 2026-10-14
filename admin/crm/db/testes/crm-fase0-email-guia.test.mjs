// Testa crm-fase0-email-guia.sql (nível no cadastro, pedido do e-mail 1, respostas por e-mail)
// num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real.
// pg_net e Vault não existem no PGlite: o teste cria versões falsas que só anotam a chamada.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase0
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
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const sql = readFileSync(path.resolve(HERE, '../crm-fase0-email-guia.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [outra] = await q("insert into auth.users (email) values ('curiosa@example.com') returning id");

  const lead = (extra) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'etudes-en-france-2027-2028', email: 'ana@example.com', nome: 'Ana', persona: 'campus_france',
    origem: 'guia-etudes-en-france-2027', aceita_servico: true, consentimento_versao: 'guia-v1',
    texto_servico: 'Li e aceito.', respostas: { objetivo: 'cf-nao-comecei' }, ...extra })]));

  console.log('\n== Sem pg_net nem Vault (como hoje no Supabase): cadastro segue igual ==');
  let r = await attempt(() => lead({ respostas: { objetivo: 'cf-nao-comecei', cfNivel: 'l1' } }));
  check('cadastro passa sem pg_net/Vault', r.ok);
  if (!r.ok) console.log(r.error.message);
  check('devolve o link do Notion', /^https:\/\/topordentroviagens\.notion\.site\//.test(r.value?.rows[0].r.notion_url || ''));
  let [ana] = await q("select * from contatos where email = 'ana@example.com'");
  check('grava cfNivel em respostas', ana.respostas.cfNivel === 'l1' && ana.respostas.objetivo === 'cf-nao-comecei');
  const [quiz] = await q("select dados from eventos where contato_id = $1 and tipo = 'quiz_respondido' order by criado_em desc limit 1", [ana.id]);
  check('o quiz_respondido mostra o nível', quiz.dados.cfNivel === 'l1');

  console.log('\n== cfNivel: só as 6 chaves ==');
  await lead({ email: 'bia@example.com', respostas: { objetivo: 'cf-dossie-enviado', cfNivel: 'doutorado' } });
  await lead({ email: 'cris@example.com', respostas: { objetivo: 'cf-dossie-enviado', cfNivel: '' } });
  const [bia] = await q("select respostas from contatos where email = 'bia@example.com'");
  const [cris] = await q("select respostas from contatos where email = 'cris@example.com'");
  check('valor desconhecido não grava', !('cfNivel' in bia.respostas));
  check('"Ainda não sei" (vazio) não grava', !('cfNivel' in cris.respostas));
  await lead({ respostas: { objetivo: 'cf-escolhendo-curso' } });
  [ana] = await q("select * from contatos where email = 'ana@example.com'");
  check('voltar sem nível mantém o nível de antes', ana.respostas.cfNivel === 'l1' && ana.respostas.objetivo === 'cf-escolhendo-curso');
  check('anon não chama crm_guia_email_pedir direto',
    !(await attempt(() => asAnon(() => db.query('select crm_guia_email_pedir($1, $2)', [ana.id, 'etudes-en-france-2027-2028'])))).ok);

  console.log('\n== Com pg_net e Vault (falsos): pede o e-mail ao Worker ==');
  await db.exec(`
    create schema net; create schema vault;
    create table net.chamadas (url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql
      as $$ insert into net.chamadas values (url, body, headers); select 1::bigint $$;
    create table vault.decrypted_secrets (name text, decrypted_secret text);
  `);
  await lead({ email: 'dani@example.com' });
  check('sem segredos no Vault: não chama (desligado)', (await q('select * from net.chamadas')).length === 0);
  await db.exec(`insert into vault.decrypted_secrets values ('crm_worker_url', 'https://worker.example.com/'),
    ('crm_hook_secret', 'segredo-de-teste-com-mais-de-24-caracteres')`);
  await lead({ email: 'dani@example.com' });
  let ch = await q('select * from net.chamadas');
  const [dani] = await q("select id from contatos where email = 'dani@example.com'");
  check('chama a rota do Worker uma vez', ch.length === 1 && ch[0].url === 'https://worker.example.com/api/crm/guia-capturado');
  check('manda contato e guia', ch[0]?.body.contato_id === dani.id && ch[0]?.body.guia === 'etudes-en-france-2027-2028');
  check('manda o segredo no cabeçalho', ch[0]?.headers['X-Crm-Hook'] === 'segredo-de-teste-com-mais-de-24-caracteres');

  await lead({ email: 'eva@example.com', guia: 'vls-ts-validacao-travou', origem: 'guia-vls-ts', persona: 'au_pair_estudante' });
  check('outro guia (sem e-mail 1) não chama', (await q('select * from net.chamadas')).length === 1);

  // O Worker gravou o e-mail: a próxima captura da mesma pessoa não pede de novo.
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, provedor_id) values ($1, 'cf_guia_1', 'Teste', 'agendado', '<msg-1@smtp.example.com>')", [dani.id]);
  await lead({ email: 'dani@example.com' });
  check('quem já recebeu não pede de novo', (await q('select * from net.chamadas')).length === 1);
  const dup = await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_1', 'agendado')", [dani.id]));
  check('índice barra um 2º cf_guia_1 para a mesma pessoa', !dup.ok);
  check('outros modelos continuam repetíveis', (await attempt(async () => {
    await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'naoabriu', 'agendado')", [dani.id]);
    await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'naoabriu', 'agendado')", [dani.id]);
  })).ok);

  await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql
      as $$ begin raise exception 'pg_net fora do ar'; end $$;`);
  r = await attempt(() => lead({ email: 'fabi@example.com' }));
  check('pg_net com erro não derruba o cadastro', r.ok && !!r.value.rows[0].r.notion_url);

  console.log('\n== cf_guia_1 fica fora do reimpacto ==');
  const [g] = await q("insert into contatos (email) values ('gui@example.com') returning id");
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em, criado_em) values ($1, 'cf_guia_1', 'entregue', now() - interval '5 days', now() - interval '5 days')", [g.id]);
  let [gv] = await asUser(admin.id, async () => (await db.query("select segmento, email_status from crm_contatos where email = 'gui@example.com'")).rows);
  check('só cf_guia_1 entregue há 5 dias: sem segmento', gv.segmento === null && gv.email_status === null);
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em, criado_em) values ($1, 'boas_vindas', 'entregue', now() - interval '4 days', now() - interval '4 days')", [g.id]);
  [gv] = await asUser(admin.id, async () => (await db.query("select segmento from crm_contatos where email = 'gui@example.com'")).rows);
  check('boas_vindas entregue há 4 dias: naoabriu, como antes', gv.segmento === 'naoabriu');

  console.log('\n== Respostas por e-mail ==');
  const resp = (v) => db.query(`insert into respostas_email (de_email, de_nome, assunto, texto, message_id, em_resposta_a)
    values ($1, $2, $3, $4, $5, $6) returning *`, v);
  let [r1] = (await resp(['Dani@Example.com', 'Dani', 'Re: Teste', 'Estou de olho em Lyon.', '<r1@mail.example.com>', '<msg-1@smtp.example.com>'])).rows;
  check('liga pelo e-mail do remetente (minúsculas)', r1.contato_id === dani.id && r1.de_email === 'dani@example.com');
  check('liga ao e-mail do CRM pelo In-Reply-To', r1.email_id != null);
  const evr = await q("select dados from eventos where contato_id = $1 and tipo = 'email_respondido'", [dani.id]);
  check('evento email_respondido na linha do tempo', evr.length === 1 && Number(evr[0].dados.resposta_id) === Number(r1.id));
  const [dv] = await asUser(admin.id, async () => (await db.query("select motivo, resposta_aberta_id from crm_contatos where id = $1", [dani.id])).rows);
  check('motivo "respondeu o seu e-mail" no Hoje', /^respondeu o seu e-mail em \d\d\/\d\d$/.test(dv.motivo || ''));
  check('resposta_aberta_id aponta para a resposta', Number(dv.resposta_aberta_id) === Number(r1.id));

  let [r2] = (await resp(['outro-endereco@example.com', null, 'Re: Teste', 'Respondi de outro e-mail.', '<r2@mail.example.com>', 'msg-1@smtp.example.com'])).rows;
  check('remetente sem ficha mas In-Reply-To conhecido: liga pela mensagem', r2.contato_id === dani.id);
  let [r3] = (await resp(['desconhecida@example.com', null, 'Oi', 'Vi seu post.', '<r3@mail.example.com>', null])).rows;
  check('remetente sem ficha: contato_id nulo, grava assim mesmo', r3.contato_id === null && r3.texto === 'Vi seu post.');
  check('mesmo Message-ID duas vezes não duplica',
    !(await attempt(() => resp(['desconhecida@example.com', null, 'Oi', 'Vi seu post.', '<r3@mail.example.com>', null]))).ok);
  check('texto grande demais é barrado', !(await attempt(() => resp(['x@example.com', null, 'a', 'x'.repeat(6001), null, null]))).ok);

  console.log('\n== RLS: só admin ==');
  check('anon não lê', !(await attempt(() => asAnon(() => db.query('select * from respostas_email')))).ok);
  check('anon não grava', !(await attempt(() => asAnon(() => db.query("insert into respostas_email (de_email, texto) values ('a@b.co', 'x')")))).ok);
  const vis = await asUser(outra.id, async () => (await db.query('select * from respostas_email')).rows);
  check('logada que não é admin não vê nada', vis.length === 0);
  const ins = await attempt(() => asUser(outra.id, () => db.query("insert into respostas_email (de_email, texto) values ('a@b.co', 'x')")));
  check('logada que não é admin não grava', !ins.ok);
  const upd = await asUser(outra.id, async () => (await db.query("update respostas_email set status = 'arquivada' returning id")).rows);
  check('logada que não é admin não muda', upd.length === 0);
  const adm = await asUser(admin.id, async () => (await db.query('select * from respostas_email')).rows);
  check('admin lê todas', adm.length === 3);
  const marc = await attempt(() => asUser(admin.id, () => db.query("update respostas_email set status = 'respondida', respondida_em = now() where id = $1", [r1.id])));
  check('admin marca como respondida', marc.ok);
  const [dv2] = await asUser(admin.id, async () => (await db.query("select motivo from crm_contatos where id = $1", [dani.id])).rows);
  check('respondida: a de r2 ainda segura o motivo', /^respondeu/.test(dv2.motivo || ''));
  await asUser(admin.id, () => db.query("update respostas_email set status = 'arquivada' where id = $1", [r2.id]));
  const [dv3] = await asUser(admin.id, async () => (await db.query("select motivo, resposta_aberta_id from crm_contatos where id = $1", [dani.id])).rows);
  check('sem resposta nova: sai do "Precisa de você"', !/^respondeu/.test(dv3.motivo || '') && dv3.resposta_aberta_id === null);
  check('status fora da lista é barrado', !(await attempt(() => asUser(admin.id, () => db.query("update respostas_email set status = 'lixo' where id = $1", [r3.id])))).ok);

  console.log('\n== Os gatilhos nunca derrubam a gravação ==');
  await db.exec(`alter table eventos add constraint falha_de_proposito check (tipo <> 'email_respondido') not valid`);
  r = await attempt(() => resp(['dani@example.com', null, 'Re', 'De novo.', '<r4@mail.example.com>', null]));
  check('resposta gravada mesmo se o evento falhar', r.ok && r.value.rows[0].contato_id === dani.id);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
