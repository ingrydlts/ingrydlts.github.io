// Testa crm-fase1a-conversa.sql (quem recebe o e-mail 2, toque e texto da página, canal, motivo)
// num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1a
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
const asService = (fn) => asRole('service_role', null, fn);

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
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql', 'crm-fase0-email-guia.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  // Uma resposta por e-mail de antes da migração: tem que ficar com canal 'email'.
  const [velha] = await q("insert into respostas_email (de_email, texto) values ('antiga@example.com', 'Oi') returning id");

  const sql = readFileSync(path.resolve(HERE, '../crm-fase1a-conversa.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);
  const [v] = await q('select canal from respostas_email where id = $1', [velha.id]);
  check('respostas antigas ficam com canal "email"', v.canal === 'email');
  check('canal fora da lista é barrado',
    !(await attempt(() => db.query("insert into respostas_email (de_email, texto, canal) values ('a@example.com', 'x', 'pombo')"))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  // Fichas fictícias: e-mail 1 em datas diferentes, com e sem novidades.
  const pessoa = async (email, nome, diasAtras, novidades, extra = {}) => {
    const [c] = await q('insert into contatos (email, nome) values ($1, $2) returning id', [email, nome]);
    if (novidades != null) await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', $2, 'teste')", [c.id, novidades]);
    if (diasAtras != null) await db.query(`insert into emails_enviados (contato_id, modelo, status, enviado_em, criado_em)
      values ($1, 'cf_guia_1', $2, now() - make_interval(hours => $3), now() - make_interval(hours => $3))`, [c.id, extra.status || 'entregue', Math.round(diasAtras * 24)]);
    return c.id;
  };
  const ana = await pessoa('ana@example.com', 'Ana Maria', 1, true);
  const bia = await pessoa('bia@example.com', 'Bia', 1, false);            // não aceitou novidades
  const cris = await pessoa('cris@example.com', 'Cris', 0, true);          // recebeu hoje (agora)
  const dani = await pessoa('dani@example.com', 'Dani', 8, true);          // há mais de 7 dias
  const eva = await pessoa('eva@example.com', 'Eva', 3, true);
  const fabi = await pessoa('fabi@example.com', 'Fabi', 2, true, { status: 'nao_entregue' });
  const gabi = await pessoa('gabi@example.com', 'Gabi', null, true);       // nunca recebeu o e-mail 1
  const hel = await pessoa('hel@example.com', 'Hel', 2, true);
  await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', false, 'brevo')", [hel]); // saiu depois

  console.log('\n== Quem recebe o e-mail 2 ==');
  const pend = async (lim) => (await asService(async () => (await db.query('select * from crm_conversa_pendentes($1)', [lim ?? 15])).rows));
  let p = await pend();
  const ids = p.map((x) => x.contato_id);
  check('ana (ontem, novidades) recebe', ids.includes(ana));
  check('eva (3 dias, novidades) recebe', ids.includes(eva));
  check('bia (sem novidades) não recebe', !ids.includes(bia));
  check('cris (e-mail 1 agora há pouco) espera o dia seguinte', !ids.includes(cris));
  check('dani (8 dias) já passou da janela', !ids.includes(dani));
  check('fabi (e-mail 1 não entregue) não recebe', !ids.includes(fabi));
  check('gabi (sem e-mail 1) não recebe', !ids.includes(gabi));
  check('hel (tirou o consentimento depois) não recebe', !ids.includes(hel));
  check('devolve e-mail e nome', p.find((x) => x.contato_id === ana)?.email === 'ana@example.com' && p.find((x) => x.contato_id === ana)?.nome === 'Ana Maria');
  check('mais antigo primeiro', ids[0] === eva);
  check('respeita o limite', (await pend(1)).length === 1);

  // "Antes de hoje" no fuso de Brasília: 03:00 UTC de hoje = meia-noite em Brasília.
  const [{ meia }] = await q("select ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo') as meia");
  const ivo = await pessoa('ivo@example.com', 'Ivo', null, true);
  const jul = await pessoa('jul@example.com', 'Jul', null, true);
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1, 'cf_guia_1', 'entregue', $2::timestamptz - interval '1 minute')", [ivo, meia]);
  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1, 'cf_guia_1', 'entregue', $2::timestamptz + interval '1 minute')", [jul, meia]);
  p = (await pend()).map((x) => x.contato_id);
  check('23h59 de ontem (Brasília) recebe hoje', p.includes(ivo));
  check('00h01 de hoje (Brasília) fica para amanhã', !p.includes(jul));

  await db.query("insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1, 'cf_guia_conversa', 'agendado', now())", [ana]);
  check('quem já tem o cf_guia_conversa sai da lista', !(await pend()).some((x) => x.contato_id === ana));
  check('índice barra um 2º cf_guia_conversa',
    !(await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_conversa', 'agendado')", [ana]))).ok);
  check('cf_guia_conversa fica fora do reimpacto', (await asUser(admin.id, async () => (await db.query('select email_status from crm_contatos where id = $1', [ana])).rows))[0].email_status === null);

  console.log('\n== Só a service_role chama ==');
  for (const [nome, sqlf, args] of [
    ['crm_conversa_pendentes', 'select * from crm_conversa_pendentes(15)', []],
    ['crm_conversa_toque', 'select crm_conversa_toque($1, $2)', [ana, 'lyon']],
    ['crm_conversa_texto', 'select crm_conversa_texto($1, $2)', [ana, 'oi oi']],
  ]) {
    check(`anon não chama ${nome}`, !(await attempt(() => asAnon(() => db.query(sqlf, args)))).ok);
    check(`admin logada não chama ${nome} direto`, !(await attempt(() => asUser(admin.id, () => db.query(sqlf, args)))).ok);
  }

  console.log('\n== Toque ==');
  const toque = async (id, cidade) => (await asService(async () => (await db.query('select crm_conversa_toque($1, $2) r', [id, cidade])).rows))[0].r;
  let t = await toque(ana, 'lyon');
  check('devolve nome e cidade', t.ok === true && t.nome === 'Ana Maria' && t.cidade === 'Lyon');
  let [a] = await q('select respostas from contatos where id = $1', [ana]);
  check('grava cfCidade', a.respostas.cfCidade === 'lyon');
  let rs = await q("select * from respostas_email where contato_id = $1 and canal = 'toque'", [ana]);
  check('entra em respostas_email como nova, canal toque', rs.length === 1 && rs[0].status === 'nova' && rs[0].texto === 'Cidade: Lyon' && rs[0].de_email === 'ana@example.com');
  const [cv] = await q("select id from emails_enviados where contato_id = $1 and modelo = 'cf_guia_conversa'", [ana]);
  check('liga ao e-mail 2', Number(rs[0].email_id) === Number(cv.id));
  let ev = await q("select dados from eventos where contato_id = $1 and tipo = 'email_respondido' order by criado_em, id", [ana]);
  check('evento na linha do tempo com canal e cidade', ev.length === 1 && ev[0].dados.canal === 'toque' && ev[0].dados.cidade === 'Lyon');
  let [vv] = await asUser(admin.id, async () => (await db.query('select motivo, resposta_aberta_id from crm_contatos where id = $1', [ana])).rows);
  check('motivo no "Precisa de você"', /^respondeu o e-mail 2 com um toque \(lyon\) em \d\d\/\d\d$/.test(vv.motivo || ''));
  check('resposta_aberta_id aponta para o toque', Number(vv.resposta_aberta_id) === Number(rs[0].id));

  t = await toque(ana, 'paris');
  [a] = await q('select respostas from contatos where id = $1', [ana]);
  rs = await q("select * from respostas_email where contato_id = $1 and canal = 'toque'", [ana]);
  check('tocou de novo: fica a última cidade', a.respostas.cfCidade === 'paris' && t.cidade === 'Paris');
  check('tocou de novo: não duplica a linha nova', rs.length === 1 && rs[0].texto === 'Cidade: Paris');
  ev = await q("select dados from eventos where contato_id = $1 and tipo = 'email_respondido' order by criado_em, id", [ana]);
  check('linha do tempo mostra os dois toques', ev.length === 2 && ev[1].dados.cidade === 'Paris');

  await asUser(admin.id, () => db.query("update respostas_email set status = 'respondida' where id = $1", [rs[0].id]));
  await toque(ana, 'nao-sei');
  rs = await q("select * from respostas_email where contato_id = $1 and canal = 'toque' order by id", [ana]);
  check('depois de respondida, um toque novo abre outra linha', rs.length === 2 && rs[1].status === 'nova' && rs[1].texto === 'Cidade: Ainda não sei');

  t = await toque(ana, 'marte');
  check('cidade fora da lista: erro e nada gravado', t.erro === 'cidade');
  [a] = await q('select respostas from contatos where id = $1', [ana]);
  check('cfCidade continua a última válida', a.respostas.cfCidade === 'nao-sei');
  t = await toque('00000000-0000-4000-8000-000000000000', 'lyon');
  check('contato apagado: erro', t.erro === 'contato');
  await toque(eva, 'outra');
  const [ev2] = await q("select texto from respostas_email where contato_id = $1", [eva]);
  check('"Outra cidade" vira texto legível', ev2.texto === 'Cidade: Outra cidade');

  console.log('\n== Texto da página ==');
  const texto = async (id, tx) => (await asService(async () => (await db.query('select crm_conversa_texto($1, $2) r', [id, tx])).rows))[0].r;
  t = await texto(eva, '  Master em Ciência Política na Lyon 2.  ');
  rs = await q("select * from respostas_email where contato_id = $1 and canal = 'pagina'", [eva]);
  check('grava como nova, canal pagina, sem espaços nas pontas', t.ok && rs.length === 1 && rs[0].status === 'nova' && rs[0].texto === 'Master em Ciência Política na Lyon 2.');
  check('texto vazio ou de 1 letra: erro', (await texto(eva, ' ')).erro === 'texto' && (await texto(eva, 'a')).erro === 'texto');
  check('texto com mais de 2000 caracteres: erro', (await texto(eva, 'x'.repeat(2001))).erro === 'texto');
  for (let i = 0; i < 9; i++) await texto(eva, 'mensagem ' + i);
  check('11º texto em 24h: limite', (await texto(eva, 'mais uma')).erro === 'limite');
  ev = await q("select dados from eventos where contato_id = $1 and tipo = 'email_respondido' and dados->>'canal' = 'pagina'", [eva]);
  check('evento com canal pagina', ev.length === 10);
  // a mais antiga nova da eva é o toque: o motivo fala do toque
  [vv] = await asUser(admin.id, async () => (await db.query('select motivo from crm_contatos where id = $1', [eva])).rows);
  check('motivo do toque com "outra cidade"', /^respondeu o e-mail 2 com um toque \(outra cidade\)/.test(vv.motivo || ''));
  await db.query("update respostas_email set status = 'arquivada' where contato_id = $1 and canal = 'toque'", [eva]);
  [vv] = await asUser(admin.id, async () => (await db.query('select motivo from crm_contatos where id = $1', [eva])).rows);
  check('motivo da página', /^escreveu na página da conversa em \d\d\/\d\d$/.test(vv.motivo || ''));

  console.log('\n== Resposta por e-mail continua como antes ==');
  const [r] = (await db.query("insert into respostas_email (de_email, texto, message_id) values ('cris@example.com', 'Oi!', '<x1@example.com>') returning *")).rows;
  check('canal padrão email', r.canal === 'email' && r.contato_id === cris);
  [vv] = await asUser(admin.id, async () => (await db.query('select motivo from crm_contatos where id = $1', [cris])).rows);
  check('motivo "respondeu o seu e-mail"', /^respondeu o seu e-mail em \d\d\/\d\d$/.test(vv.motivo || ''));
  ev = await q("select dados from eventos where contato_id = $1 and tipo = 'email_respondido'", [cris]);
  check('evento de e-mail sem canal (como na fase 0)', ev.length === 1 && !('canal' in ev[0].dados));

  console.log('\n== RLS: a Caixa de entrada só para admin ==');
  check('anon não lê respostas', !(await attempt(() => asAnon(() => db.query('select * from respostas_email')))).ok);
  const [outra] = await q("insert into auth.users (email) values ('curiosa@example.com') returning id");
  check('logada que não é admin não vê nada', (await asUser(outra.id, async () => (await db.query('select * from respostas_email')).rows)).length === 0);
  const vis = await asUser(admin.id, async () => (await db.query("select canal from respostas_email where canal <> 'email'")).rows);
  check('admin vê toque e página', vis.some((x) => x.canal === 'toque') && vis.some((x) => x.canal === 'pagina'));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
