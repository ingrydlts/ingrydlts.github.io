// Testa crm-estudio-emails-2.sql (Estúdio de e-mails, entrega 2: blocos, teste e versões) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM e da entrega 1. Não toca no Supabase real. Que os blocos montam o
// e-mail certo é conferido em cms-oauth-worker/testes/crm-email.test.mjs.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio
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
// jsonb guarda as chaves em outra ordem: compara pelo conteúdo.
const canon = (x) => Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x;
const igual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
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
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const antes = await q('select chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html from modelos_email_versoes order by chave, versao');
  const sql = readFileSync(path.resolve(HERE, '../crm-estudio-emails-2.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  const [outra] = await q("insert into auth.users (email) values ('outra@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  console.log('\n== Nada muda no que sai hoje ==');
  const depois = await q('select chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, testado_em from modelos_email_versoes order by chave, versao');
  check('as 10 versões de hoje continuam com o mesmo texto, No ar', depois.length === 10 && depois.every((v, i) => v.etapa === 'no_ar' &&
    ['assunto', 'preheader', 'corpo_texto', 'corpo_html'].every((f) => v[f] === antes[i][f])));
  check('e sem blocos (texto corrido) nem teste', depois.every((v) => v.blocos === null && v.testado_em === null));
  const cols = (await q("select column_name from information_schema.columns where table_name = 'modelos_email_versoes'")).map((r) => r.column_name);
  check('colunas novas: blocos, testado_em, testado_por', ['blocos', 'testado_em', 'testado_por'].every((c) => cols.includes(c)));
  const vars1 = (await q("select variaveis from modelos_email where chave = 'cf_guia_1'"))[0].variaveis.map((x) => x.nome);
  check('e-mail 1 ganhou {etapa} e {cidade} na lista, uma vez só', vars1.filter((n) => n === 'etapa').length === 1 && vars1.filter((n) => n === 'cidade').length === 1);
  check('blocos precisa ser um objeto', !(await attempt(() => db.query("update modelos_email_versoes set blocos = '[1,2]' where false or (chave = 'naoabriu' and versao = 1)"))).ok);

  console.log('\n== Versões com blocos ==');
  const blocos = { v: 1, assunto: '{nome}, o seu checklist chegou', itens: [{ tipo: 'texto', texto: 'Oi {nome}!' }, { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }] };
  check('versão No ar não ganha blocos', !(await attempt(() => db.query("update modelos_email_versoes set blocos = $1 where chave = 'cf_guia_1' and versao = 1", [blocos]))).ok);
  const v2 = await asUser(admin.id, async () => (await db.query("select public.modelo_email_nova_versao('cf_guia_1') as v")).rows[0].v);
  check('admin cria a versão 2 (rascunho)', v2 === 2);
  const grava = await attempt(() => asUser(admin.id, () => db.query(
    "update modelos_email_versoes set blocos = $1, assunto = $2, corpo_texto = $3, corpo_html = $4 where chave = 'cf_guia_1' and versao = 2",
    [blocos, '{nome}, o seu checklist chegou', 'Oi {nome}!\n\nIngryd · Por Dentro', '<p>Oi {nome}!</p>'])));
  check('admin grava blocos e o texto montado no rascunho', grava.ok);
  const naoAdm = await attempt(() => asUser(outra.id, async () => (await db.query(
    "update modelos_email_versoes set assunto = 'x' where chave = 'cf_guia_1' and versao = 2 returning versao")).rows));
  check('quem não é admin não grava', !naoAdm.ok || naoAdm.value.length === 0);
  check('anon não lê os blocos', !(await attempt(() => asAnon(() => db.query('select blocos from modelos_email_versoes')))).ok);

  console.log('\n== Teste para mim ==');
  await asUser(admin.id, () => db.query("update modelos_email_versoes set testado_em = now(), testado_por = $1 where chave = 'cf_guia_1' and versao = 2", [admin.id]));
  let [r2] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2");
  check('marcar o teste guarda quando e quem', r2.testado_em && r2.testado_por === admin.id);
  await db.query("update modelos_email_versoes set nota = 'ok' where chave = 'cf_guia_1' and versao = 2");
  [r2] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2");
  check('mudar só a nota mantém o teste', !!r2.testado_em);
  await db.query("update modelos_email_versoes set etapa = 'revisao' where chave = 'cf_guia_1' and versao = 2");
  [r2] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2");
  check('mandar para revisão mantém o teste', r2.etapa === 'revisao' && !!r2.testado_em);
  await db.query("update modelos_email_versoes set blocos = $1 where chave = 'cf_guia_1' and versao = 2", [{ ...blocos, itens: blocos.itens.slice(1) }]);
  [r2] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2");
  check('mudar os blocos apaga o teste (precisa testar de novo)', r2.testado_em === null && r2.testado_por === null);
  await db.query("update modelos_email_versoes set testado_em = now() where chave = 'cf_guia_1' and versao = 2");
  await db.query("update modelos_email_versoes set corpo_html = '<p>outro</p>' where chave = 'cf_guia_1' and versao = 2");
  check('mudar o HTML também apaga o teste', (await q("select testado_em from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2"))[0].testado_em === null);
  await db.query("update modelos_email_versoes set blocos = $1, corpo_html = '<p>Oi {nome}!</p>', testado_em = now() where chave = 'cf_guia_1' and versao = 2", [blocos]);
  check('gravar o texto junto com a marca do teste mantém a marca', !!(await q("select testado_em from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2"))[0].testado_em);

  console.log('\n== Publicar e o histórico ==');
  await asUser(admin.id, () => db.query("select public.publicar_modelo_email('cf_guia_1', 2)"));
  let et = await q("select versao, etapa, assunto, blocos from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('a 2 vai No ar e a 1 fica guardada (arquivada, texto de antes)', et[1].etapa === 'no_ar' && et[0].etapa === 'arquivado' && et[0].assunto === antes.find((v) => v.chave === 'cf_guia_1').assunto);
  const lido = await asService(async () => (await db.query("select versao, assunto, corpo_texto from modelos_email_versoes where chave = 'cf_guia_1' and etapa = 'no_ar'")).rows);
  check('o Worker lê o texto novo', lido.length === 1 && lido[0].versao === 2 && lido[0].corpo_texto === 'Oi {nome}!\n\nIngryd · Por Dentro');
  check('versão publicada não muda de blocos', !(await attempt(() => db.query("update modelos_email_versoes set blocos = '{}' where chave = 'cf_guia_1' and versao = 2"))).ok);
  check('arquivada não muda de blocos', !(await attempt(() => db.query("update modelos_email_versoes set blocos = '{}' where chave = 'cf_guia_1' and versao = 1"))).ok);
  check('publicada pode receber a marca de teste (é só a data)', (await attempt(() => db.query("update modelos_email_versoes set testado_em = now() where chave = 'cf_guia_1' and versao = 2"))).ok);
  const v3 = await asUser(admin.id, async () => (await db.query("select public.modelo_email_nova_versao('cf_guia_1') as v")).rows[0].v);
  const [r3] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 3");
  check('nova versão copia os blocos da No ar, sem a marca do teste', v3 === 3 && r3.etapa === 'rascunho' && igual(blocos, r3.blocos) && r3.testado_em === null);
  await db.query("select public.publicar_modelo_email('cf_guia_1', 1)");
  et = await q("select versao, etapa from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('voltar para a versão 1 continua possível', et[0].etapa === 'no_ar' && et[1].etapa === 'arquivado' && et[2].etapa === 'rascunho');

  console.log('\n== Rodar de novo não desfaz o que você mudou ==');
  await db.exec(sql);
  et = await q("select versao, etapa, blocos from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('rodar o SQL de novo mantém versões e blocos', et.length === 3 && et[0].etapa === 'no_ar' && igual(blocos, et[1].blocos));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
