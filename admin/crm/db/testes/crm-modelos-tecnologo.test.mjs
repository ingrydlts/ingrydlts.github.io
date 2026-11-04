// Testa crm-modelos-tecnologo-etapas.sql (um e-mail para cada uma das 4 etapas do guia do tecnólogo + o recap com o parágrafo da
// etapa) num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:tecnologo
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { gerar, ETAPAS } from '../modelos-tecnologo.mjs';
import { CHAVE as RECAP } from '../modelo-tecnologo-recap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asService(fn) { await db.exec('set role service_role;'); try { return await fn(); } finally { await db.exec('reset role;'); } }
const pendentes = (agora) => asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [agora]));
const quem = (rows, chave) => rows.filter((r) => r.chave === chave).map((r) => r.nome).sort().join(',');
const min = (t, n) => new Date(t.getTime() + n * 60000).toISOString();
const ks = Object.keys(ETAPAS), chaves = Object.values(ETAPAS).map((e) => e.chave);

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
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql', 'crm-modelo-tecnologo-recap.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const antes = await q('select * from modelos_email order by chave');
  const versAntes = await q('select * from modelos_email_versoes where chave <> $1 order by chave, versao', [RECAP]);

  console.log('\n== O arquivo SQL ==');
  const arq = readFileSync(path.resolve(HERE, '../crm-modelos-tecnologo-etapas.sql'), 'utf8');
  check('o arquivo está em dia com o gerador (rode node admin/crm/db/modelos-tecnologo.mjs)', arq === gerar());
  const r1 = await attempt(() => db.exec(arq)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(arq)); check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  const depois = await q('select * from modelos_email order by chave');
  check('só 4 modelos novos (nenhum outro mudou)', depois.length === antes.length + 4 && JSON.stringify(antes) === JSON.stringify(depois.filter((m) => !chaves.includes(m.chave))));
  check('as versões dos outros modelos não mudaram', JSON.stringify(versAntes) === JSON.stringify(await q('select * from modelos_email_versoes where chave <> $1 and chave <> all($2) order by chave, versao', [RECAP, chaves])));

  console.log('\n== Os 4 e-mails de 3 dias depois ==');
  for (const [k, e] of Object.entries(ETAPAS)) {
    const [m] = await q('select * from modelos_email where chave = $1', [e.chave]);
    check(`${e.chave}: Envio desligado, 3 dias depois do recap, às 10h`, m && !m.envio_ligado && m.envio_gatilho === 'email' && m.envio_depois_de === RECAP && m.envio_dias === 3 && m.envio_hora === 10 && m.envio_minutos === null);
    check(`${e.chave}: só para quem pegou o guia e marcou ${k}`, JSON.stringify(m.para_quem.materiais) === '["guia-tecnologo"]' && JSON.stringify(m.para_quem.etapas) === JSON.stringify([k]) && Object.keys(m.para_quem).length === 2);
    check(`${e.chave}: novidades (só quem aceitou)`, m.tipo === 'novidades');
    const vs = await q('select * from modelos_email_versoes where chave = $1', [e.chave]);
    check(`${e.chave}: uma versão em rascunho`, vs.length === 1 && vs[0].etapa === 'rascunho' && vs[0].versao === 1);
    check(`${e.chave}: assunto próprio da etapa e sem marcador de conferência`, vs[0].assunto.length > 10 && !/\[[^\]]+\]/.test(vs[0].corpo_texto.replace(/\{[^}]*\}/g, '')));
  }
  const assuntos = new Set((await q('select assunto from modelos_email_versoes where chave = any($1)', [chaves])).map((r) => r.assunto));
  check('os 4 assuntos são diferentes entre si (cada opção tem o seu)', assuntos.size === 4);

  console.log('\n== O recap com o parágrafo da etapa ==');
  const rv = await q('select * from modelos_email_versoes where chave = $1 order by versao', [RECAP]);
  check('a v1 continua como estava e a v2 é rascunho', rv.length === 2 && rv[0].etapa === 'rascunho' && rv[1].etapa === 'rascunho' && rv[1].versao === 2);
  const m = { chave: RECAP, criado_no_estudio: true, tipo: 'servico', para_quem: { materiais: ['guia-tecnologo'] } };
  const oferecidos = ES.varsDoModelo(RECAP, m);
  check('o modelo oferece os 4 dados de etapa do tecnólogo', ks.every((k) => oferecidos.includes(ETAPAS[k].var)));
  const frase = (e) => e.recap.slice(0, 40);
  for (const k of ks) {
    const v = {}; oferecidos.forEach((x) => { v[x] = ''; }); ks.forEach((kk) => { v[ETAPAS[kk].var] = kk === k; });
    v.nome = 'Ingryd'; v.email = 'ingryd@example.com'; v.assunto = 'x'; v.pre = 'y';
    const texto = ES.preencher(rv[1].corpo_texto, v, false), html = ES.preencher(rv[1].corpo_html, v, true, false);
    check(`recap v2 para ${k}: mostra a frase dele`, texto.includes(frase(ETAPAS[k])) && html.includes(frase(ETAPAS[k])));
    check(`recap v2 para ${k}: não mostra a frase das outras 3`, ks.filter((kk) => kk !== k).every((kk) => !texto.includes(frase(ETAPAS[kk]))));
    check(`recap v2 para ${k}: o link do checklist continua lá`, texto.includes('topordentroviagens.notion.site'));
  }
  const semEtapa = {}; oferecidos.forEach((x) => { semEtapa[x] = ''; }); ks.forEach((kk) => { semEtapa[ETAPAS[kk].var] = false; }); semEtapa.nome = 'Ana'; semEtapa.email = 'a@x.com';
  check('recap v2 sem etapa marcada: não mostra nenhum parágrafo de etapa', ks.every((kk) => !ES.preencher(rv[1].corpo_texto, semEtapa, false).includes(frase(ETAPAS[kk]))));

  console.log('\n== Cada pessoa recebe só o e-mail da etapa dela ==');
  const T = new Date(Date.now() - 6 * 36e5);   // o cadastro, 6 horas atrás
  async function pessoa(nome, objetivo, { novidades = true } = {}) {
    const [c] = await q("insert into contatos (email, nome, respostas) values ($1, $2, $3) returning id", [nome.toLowerCase() + '@example.com', nome, objetivo ? { objetivo } : {}]);
    await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', $2, 'teste')", [c.id, novidades]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem: 'guia-tecnologo' }, T.toISOString()]);
    // o recap já saiu 30 minutos depois do cadastro
    await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, $2, 'x', 'entregue', $3, true)", [c.id, RECAP, min(T, 31)]);
    return c.id;
  }
  await pessoa('Ana', 'tec-nao-sei'); await pessoa('Bia', 'tec-juntando'); await pessoa('Caio', 'tec-escrevi'); await pessoa('Duda', 'tec-resposta');
  await pessoa('Eva', null); await pessoa('Fred', 'cf-nao-comecei'); await pessoa('Gabi', 'tec-resposta', { novidades: false });
  for (const c of chaves) await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [c]);
  await db.query('update modelos_email set envio_ligado = true where chave = any($1)', [chaves]);
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = any($1)', [chaves, min(T, -60)]);
  // 3 dias depois do recap (enviado em T+31min), às 10h de Brasília do dia seguinte aos 3 dias: usa a mesma conta do banco
  const [{ d }] = await q("select ((($1::timestamptz at time zone 'America/Sao_Paulo')::date + 3) + make_interval(hours => 10)) at time zone 'America/Sao_Paulo' as d", [min(T, 31)]);
  const dev = new Date(d);
  check('antes da hora, ninguém recebe os e-mails de 3 dias', (await pendentes(new Date(dev.getTime() - 60000).toISOString())).length === 0);
  const p = await pendentes(new Date(dev.getTime() + 60000).toISOString());
  check('tec_d3_nao_sei: só a Ana', quem(p, 'tec_d3_nao_sei') === 'Ana');
  check('tec_d3_juntando: só a Bia', quem(p, 'tec_d3_juntando') === 'Bia');
  check('tec_d3_escrevi: só o Caio', quem(p, 'tec_d3_escrevi') === 'Caio');
  check('tec_d3_resposta: só a Duda (a Gabi não aceitou novidades)', quem(p, 'tec_d3_resposta') === 'Duda');
  check('sem etapa (Eva) e etapa de outro guia (Fred) não recebem', !p.some((r) => r.nome === 'Eva' || r.nome === 'Fred'));
  check('cada pessoa recebe um e-mail só', new Set(p.map((r) => r.nome)).size === p.length);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
