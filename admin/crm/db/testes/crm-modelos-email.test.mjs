// Testa crm-modelos-email.sql (Estúdio de e-mails, entrega 1: os modelos e as versões no banco) num Postgres
// efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real. Que o texto daqui monta os
// mesmos e-mails de hoje é conferido em cms-oauth-worker/testes/crm-email.test.mjs.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:modelos
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

const CHAVES = ['boas_vindas', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp', 'guia_chamada', 'guia_plataforma', 'guia_alternancia', 'cf_guia_1', 'cf_guia_conversa'];

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
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const sql = readFileSync(path.resolve(HERE, '../crm-modelos-email.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  const [outra] = await q("insert into auth.users (email) values ('outra@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  console.log('\n== Os 10 modelos de hoje ==');
  const mods = await q('select * from modelos_email order by ordem');
  check('10 modelos, na ordem do painel e depois os do Worker', mods.map((m) => m.chave).join(',') === CHAVES.join(','));
  check('tipos: serviço e novidades', mods.every((m) => ['servico', 'novidades'].includes(m.tipo)) &&
    mods.filter((m) => m.tipo === 'servico').map((m) => m.chave).join(',') === 'boas_vindas,naoabriu,cliquenaoapp,cf_guia_1');
  check('os que exigem novidades no Worker são "novidades"', ['naoclicou', 'parouapp', 'guia_chamada', 'guia_plataforma', 'guia_alternancia']
    .every((k) => mods.find((m) => m.chave === k).tipo === 'novidades'));
  check('só os 2 do guia Campus France são automáticos', mods.filter((m) => m.automatico).map((m) => m.chave).join(',') === 'cf_guia_1,cf_guia_conversa');
  check('todo modelo tem objetivo, como sai e variáveis', mods.every((m) => m.objetivo && m.como_sai && Array.isArray(m.variaveis) && m.variaveis.length));
  const vers = await q("select * from modelos_email_versoes order by chave");
  check('uma versão por modelo, a 1, No ar', vers.length === 10 && vers.every((v) => v.versao === 1 && v.etapa === 'no_ar' && v.publicado_em));
  check('os 2 do Worker têm HTML; os 8 do painel, só texto', vers.filter((v) => v.corpo_html).map((v) => v.chave).sort().join(',') === 'cf_guia_1,cf_guia_conversa');
  // O texto no banco é exatamente o que está entre as tags do SQL (é por elas que o teste do Worker lê o texto).
  const tag = (k, campo) => { const m = new RegExp('\\$' + k + '_' + campo + '\\$([\\s\\S]*?)\\$' + k + '_' + campo + '\\$').exec(sql); return m ? m[1] : null; };
  check('texto gravado = texto entre as tags do SQL', vers.every((v) => v.assunto === tag(v.chave, 'assunto') && v.corpo_texto === tag(v.chave, 'texto') &&
    (v.corpo_html || null) === tag(v.chave, 'html') && (v.preheader || null) === tag(v.chave, 'pre')));
  check('nenhum dado de pessoa no texto', !/@(?!example)[a-z0-9-]+\.[a-z]/i.test(vers.map((v) => v.corpo_texto + (v.corpo_html || '')).join(' ').replace(/\{email\}/g, '')));
  check('emails_enviados ganhou modelo_versao', (await q("select 1 from information_schema.columns where table_name = 'emails_enviados' and column_name = 'modelo_versao'")).length === 1);
  check('tipo fora da lista é barrado', !(await attempt(() => db.query("insert into modelos_email (chave, nome, objetivo, tipo, como_sai) values ('x_y', 'X', 'x', 'promo', 'x')"))).ok);
  check('etapa fora da lista é barrada', !(await attempt(() => db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto) values ('naoabriu', 9, 'pronto', 'a', 'b')"))).ok);
  check('chave com espaço é barrada', !(await attempt(() => db.query("insert into modelos_email (chave, nome, objetivo, tipo, como_sai) values ('a b', 'X', 'x', 'servico', 'x')"))).ok);

  console.log('\n== Quem lê ==');
  check('anon não lê modelos', !(await attempt(() => asAnon(() => db.query('select * from modelos_email')))).ok);
  check('anon não lê versões', !(await attempt(() => asAnon(() => db.query('select * from modelos_email_versoes')))).ok);
  const naoAdm = await attempt(() => asUser(outra.id, async () => (await db.query('select * from modelos_email_versoes')).rows));
  check('logada que não é admin não vê nenhuma versão', !naoAdm.ok || naoAdm.value.length === 0);
  const naoAdmIns = await attempt(() => asUser(outra.id, () => db.query("insert into modelos_email_versoes (chave, versao, assunto, corpo_texto) values ('naoabriu', 5, 'a', 'b')")));
  check('logada que não é admin não grava', !naoAdmIns.ok);
  const adm = await asUser(admin.id, async () => (await db.query('select chave from modelos_email')).rows);
  check('admin vê os 10', adm.length === 10);
  const srv = await asService(async () => (await db.query("select versao, assunto, corpo_texto from modelos_email_versoes where chave = 'cf_guia_1' and etapa = 'no_ar'")).rows);
  check('service_role (Worker) lê a versão No ar', srv.length === 1 && srv[0].versao === 1);

  console.log('\n== Versões ==');
  const trava = await attempt(() => db.query("update modelos_email_versoes set corpo_texto = 'outro' where chave = 'cf_guia_1' and versao = 1"));
  check('versão No ar não muda de texto', !trava.ok && /já saiu/.test(trava.error.message));
  check('nota da versão No ar pode mudar', (await attempt(() => db.query("update modelos_email_versoes set nota = 'ok' where chave = 'cf_guia_1' and versao = 1"))).ok);
  check('versão No ar não volta para revisão', !(await attempt(() => db.query("update modelos_email_versoes set etapa = 'revisao' where chave = 'cf_guia_1' and versao = 1"))).ok);

  const v2 = await asUser(admin.id, async () => (await db.query("select public.modelo_email_nova_versao('cf_guia_1') as v")).rows[0].v);
  const [r2] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 2");
  const [r1] = await q("select * from modelos_email_versoes where chave = 'cf_guia_1' and versao = 1");
  check('admin cria a versão 2, rascunho, cópia da 1', v2 === 2 && r2.etapa === 'rascunho' && r2.corpo_html === r1.corpo_html && r2.criado_por === admin.id);
  check('rascunho pode mudar de texto', (await attempt(() => db.query("update modelos_email_versoes set assunto = 'Novo assunto' where chave = 'cf_guia_1' and versao = 2"))).ok);
  check('nova versão de modelo que não existe dá erro', !(await attempt(() => db.query("select public.modelo_email_nova_versao('nao_existe')"))).ok);
  check('nova versão por quem não é admin dá erro', !(await attempt(() => asUser(outra.id, () => db.query("select public.modelo_email_nova_versao('cf_guia_1')")))).ok);
  check('duas No ar no mesmo modelo é barrado', !(await attempt(() => db.query("update modelos_email_versoes set etapa = 'no_ar' where chave = 'cf_guia_1' and versao = 2"))).ok);

  await asUser(admin.id, () => db.query("select public.publicar_modelo_email('cf_guia_1', 2)"));
  let et = await q("select versao, etapa, assunto from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('publicar: a 2 vai No ar e a 1 é arquivada', et[0].etapa === 'arquivado' && et[1].etapa === 'no_ar');
  const lido = await asService(async () => (await db.query("select assunto from modelos_email_versoes where chave = 'cf_guia_1' and etapa = 'no_ar'")).rows);
  check('o Worker passa a ler o texto novo', lido.length === 1 && lido[0].assunto === 'Novo assunto');
  check('versão arquivada continua guardada como estava', et[0].assunto === r1.assunto);
  check('arquivada não muda de texto', !(await attempt(() => db.query("update modelos_email_versoes set assunto = 'x' where chave = 'cf_guia_1' and versao = 1"))).ok);
  check('publicada não muda de texto', !(await attempt(() => db.query("update modelos_email_versoes set assunto = 'x' where chave = 'cf_guia_1' and versao = 2"))).ok);
  check('publicar versão que não existe dá erro', !(await attempt(() => db.query("select public.publicar_modelo_email('cf_guia_1', 77)"))).ok);
  await attempt(() => asUser(outra.id, () => db.query("select public.publicar_modelo_email('cf_guia_1', 1)")));
  et = await q("select versao, etapa from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('quem não é admin não publica', et[1].etapa === 'no_ar' && et[0].etapa === 'arquivado');
  await db.query("select public.publicar_modelo_email('cf_guia_1', 1)");
  et = await q("select versao, etapa from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('voltar para a versão 1 (arquivada → No ar)', et[0].etapa === 'no_ar' && et[1].etapa === 'arquivado');
  await db.query("select public.publicar_modelo_email('cf_guia_1', 2)");

  console.log('\n== Rodar de novo não desfaz o que você mudou ==');
  await db.exec(sql);
  et = await q("select versao, etapa, assunto from modelos_email_versoes where chave = 'cf_guia_1' order by versao");
  check('rodar o SQL de novo mantém a versão 2 No ar', et.length === 2 && et[1].etapa === 'no_ar' && et[1].assunto === 'Novo assunto' && et[0].etapa === 'arquivado');
  await db.query("update modelos_email set nome = 'Meu nome' where chave = 'naoabriu'");
  await db.exec(sql);
  check('nem o nome do modelo', (await q("select nome from modelos_email where chave = 'naoabriu'"))[0].nome === 'Meu nome');

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
