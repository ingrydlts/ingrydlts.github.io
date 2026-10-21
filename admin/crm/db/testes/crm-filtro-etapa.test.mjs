// Testa crm-filtro-etapa.sql (a regra "Etapa do guia" no Para quem e as trilhas do aquecimento) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM, das entregas 1 a 3 do estúdio e dos modelos prontos. Não toca no Supabase
// real. Pessoas fictícias. Que o Worker preenche a etapa nos e-mails é testado em cms-oauth-worker/testes/crm-email.test.mjs.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:etapa
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asService(fn) {
  await db.exec('set role service_role;');
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
const pendentes = (agora) => asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [agora]));
// As datas do teste ficam 10 dias no passado (horário de Brasília): "ligar o Envio agora" fica depois de todas elas.
const D0 = new Date(Date.now() - 3 * 36e5 - 10 * 864e5).toISOString().slice(0, 10);
function dia(n, hm) { const d = new Date(D0 + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + ' ' + hm + '-03'; }
const quem = (rows, chave) => rows.filter((r) => r.chave === chave).map((r) => r.nome).sort().join(',');
const TRILHA = { a: ['cf-nao-comecei', 'cf-escolhendo-curso'], b: ['cf-juntando-documentos'], c: ['cf-dossie-enviado', 'cf-entrevista-resposta'] };
const AQ = Object.keys(TRILHA).flatMap((t) => ['d3', 'd6', 'd10', 'd15'].map((d) => 'aq_' + t + '_' + d));

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
    alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  // Um modelo do aquecimento em que você já escolheu a etapa no estúdio: ele não pode ser tocado.
  await db.query(`update modelos_email set para_quem = para_quem || '{"etapas":["cf-dossie-enviado"]}' where chave = 'aq_c_d15'`);
  const modelosAntes = await q('select * from modelos_email order by chave');
  const versoesAntes = await q('select * from modelos_email_versoes order by chave, versao');

  const sql = readFileSync(path.resolve(HERE, '../crm-filtro-etapa.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const depois1 = await q('select * from modelos_email order by chave');
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  check('a 2ª vez não muda nada', JSON.stringify(depois1) === JSON.stringify(await q('select * from modelos_email order by chave')));

  console.log('\n== As trilhas do aquecimento ==');
  const depois = await q('select * from modelos_email order by chave');
  const de = (k) => depois.find((m) => m.chave === k);
  let ok = true;
  for (const k of AQ) {
    if (k === 'aq_c_d15') continue;
    const esperado = TRILHA[k[3]], pq = de(k).para_quem;
    if (JSON.stringify(pq.etapas) !== JSON.stringify(esperado) || JSON.stringify(pq.materiais) !== '["guia-etudes-en-france-2027"]') { ok = false; console.log('  ', k, JSON.stringify(pq)); }
  }
  check('os 11 do aquecimento ganham a etapa da trilha e guardam o material', ok);
  check('a etapa que você escolheu no aq_c_d15 fica', JSON.stringify(de('aq_c_d15').para_quem.etapas) === '["cf-dossie-enviado"]');
  const fora = (m) => !AQ.includes(m.chave);
  check('nenhum outro modelo mudou', JSON.stringify(modelosAntes.filter(fora)) === JSON.stringify(depois.filter(fora)));
  check('no aquecimento só o Para quem mudou (Envio continua desligado)', AQ.every((k) => {
    const a = { ...modelosAntes.find((m) => m.chave === k), para_quem: null, atualizado_em: null }, b = { ...de(k), para_quem: null, atualizado_em: null };
    return JSON.stringify(a) === JSON.stringify(b) && de(k).envio_ligado === false;
  }));
  check('nenhuma versão mudou (nada publicado)', JSON.stringify(versoesAntes) === JSON.stringify(await q('select * from modelos_email_versoes order by chave, versao')));
  check('os valores da regra são as etapas que o estúdio oferece', AQ.every((k) => de(k).para_quem.etapas.every((e) => ES.ETAPAS_GUIA.some((x) => x[0] === e))));

  console.log('\n== Cada pessoa recebe só a trilha da etapa dela ==');
  async function pessoa(nome, objetivo, { novidades = true } = {}) {
    const [c] = await q("insert into contatos (email, nome, persona, respostas) values ($1, $2, 'campus_france', $3) returning id",
      [nome.toLowerCase() + '@example.com', nome, objetivo ? { objetivo } : {}]);
    await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', $2, 'teste')", [c.id, novidades]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem: 'guia-etudes-en-france-2027' }, dia(0, '09:00')]);
    await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em) values ($1, 'cf_guia_conversa', 'x', 'entregue', $2)", [c.id, dia(0, '10:00')]);
    return c.id;
  }
  await pessoa('Ana', 'cf-nao-comecei'); await pessoa('Bia', 'cf-escolhendo-curso'); await pessoa('Caio', 'cf-juntando-documentos');
  await pessoa('Duda', 'cf-dossie-enviado'); await pessoa('Eva', 'cf-entrevista-resposta'); await pessoa('Fred', null);
  await pessoa('Gabi', 'alt-pesquisando'); await pessoa('Hugo', 'cf-juntando-documentos', { novidades: false });
  // Publica a versão mais nova dos 3 D+3 e liga o Envio (o que você fará no estúdio), com a hora de ligar antes das datas.
  const D3 = ['aq_a_d3', 'aq_b_d3', 'aq_c_d3'];
  await db.query(`update modelos_email_versoes v set etapa = 'no_ar', publicado_em = now()
    where v.chave = any($1) and v.versao = (select max(versao) from modelos_email_versoes x where x.chave = v.chave)`, [D3]);
  await db.query('update modelos_email set envio_ligado = true where chave = any($1)', [D3]);
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = any($1)', [D3, dia(0, '08:00')]);
  check('antes da hora, ninguém', (await pendentes(dia(2, '09:55'))).length === 0);
  const p = await pendentes(dia(2, '10:05'));
  check('trilha A: Ana (não começou) e Bia (escolhendo o curso)', quem(p, 'aq_a_d3') === 'Ana,Bia');
  check('trilha B: só o Caio (juntando documentos)', quem(p, 'aq_b_d3') === 'Caio');
  check('trilha C: Duda (dossiê enviado) e Eva (entrevista ou resposta)', quem(p, 'aq_c_d3') === 'Duda,Eva');
  check('cada pessoa recebe uma trilha só', new Set(p.map((r) => r.nome)).size === p.length);
  check('quem não marcou etapa (Fred) e quem marcou etapa de outro guia (Gabi) não recebem', !p.some((r) => r.nome === 'Fred' || r.nome === 'Gabi'));
  check('o consentimento continua valendo (Hugo não aceitou novidades)', !p.some((r) => r.nome === 'Hugo'));
  check('a lista traz a etapa para o Worker', p.find((r) => r.nome === 'Caio').dados.respostas.objetivo === 'cf-juntando-documentos');

  console.log('\n== Sem a regra, nada muda ==');
  await db.query("update modelos_email set para_quem = para_quem - 'etapas' where chave = 'aq_a_d3'");
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', ['aq_a_d3', dia(0, '08:00')]);
  const sem = await pendentes(dia(2, '10:05'));
  check('sem etapa marcada no modelo: todo mundo que aceitou e pegou o guia, inclusive Fred e Gabi', quem(sem, 'aq_a_d3') === 'Ana,Bia,Caio,Duda,Eva,Fred,Gabi');
  check('mexer na regra com o Envio ligado recomeça a contagem (como as outras regras)', await (async () => {
    await db.query(`update modelos_email set para_quem = para_quem || '{"etapas":["cf-nao-comecei"]}' where chave = 'aq_a_d3'`);
    return (await pendentes(dia(2, '10:05'))).filter((r) => r.chave === 'aq_a_d3').length === 0;
  })());

  console.log('\n== Como desfazer ==');
  const desfazer = sql.split('-- Como desfazer')[1].split('\n').filter((l) => /^--   /.test(l)).map((l) => l.slice(5)).join('\n');
  const rd = await attempt(() => db.exec(desfazer));
  check('o "como desfazer" roda e tira a regra de todos', rd.ok && (await q("select count(*)::int n from modelos_email where para_quem ? 'etapas'"))[0].n === 0);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
