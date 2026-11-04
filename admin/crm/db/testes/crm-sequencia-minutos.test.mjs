// Testa crm-sequencia-minutos.sql (Envio "N minutos depois") e crm-modelo-tecnologo-recap.sql (o recap do guia do tecnólogo,
// 30 minutos depois do cadastro) num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real.
// Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:minutos
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { gerar, CHAVE } from '../modelo-tecnologo-recap.mjs';

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
const quem = (rows, chave) => rows.filter((r) => r.chave === chave).map((r) => r.nome).sort().join(',');
const min = (t, n) => new Date(t.getTime() + n * 60000).toISOString();

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
    'crm-filtro-etapa.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const modelosAntes = await q('select * from modelos_email order by chave');

  console.log('\n== crm-sequencia-minutos.sql ==');
  const sql = readFileSync(path.resolve(HERE, '../crm-sequencia-minutos.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  const depois = await q('select * from modelos_email order by chave');
  const semMin = (m) => { const { envio_minutos, ...r } = m; return r; };
  check('nenhum modelo mudou (só ganharam a coluna envio_minutos, vazia)',
    JSON.stringify(modelosAntes) === JSON.stringify(depois.map(semMin)) && depois.every((m) => m.envio_minutos === null));
  const fn = await q("select prosecdef, proconfig, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc from pg_proc p where proname = 'crm_sequencia_pendentes'");
  check('crm_sequencia_pendentes: security definer, search_path fixo, só service_role executa',
    fn.length === 1 && fn[0].prosecdef && /search_path/.test(String(fn[0].proconfig)) && !fn[0].anon && !fn[0].auth && fn[0].svc);

  console.log('\n== A regra do Envio ==');
  await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave, envio_gatilho, envio_depois_de)
    values ('t_regra', 'Teste da regra', 'teste', 'servico', 'x', 'x', true, 'freebie', 'material', 'guia-tecnologo')`);
  const ligar = (set) => attempt(() => db.query(`update modelos_email set ${set} where chave = 't_regra'`));
  check('ligar sem dias, sem hora e sem minutos: recusa', !(await ligar('envio_ligado = true')).ok);
  check('ligar só com minutos: aceita', (await ligar('envio_minutos = 30, envio_ligado = true')).ok);
  check('minutos 0: recusa', !(await ligar('envio_minutos = 0')).ok);
  check('minutos 1441: recusa', !(await ligar('envio_minutos = 1441')).ok);
  check('minutos 1440: aceita', (await ligar('envio_minutos = 1440')).ok);
  check('ligar só com dias e hora (como antes): aceita', (await ligar('envio_minutos = null, envio_dias = 1, envio_hora = 10')).ok);
  check('tirar dias e hora com o Envio ligado e sem minutos: recusa', !(await ligar('envio_dias = null')).ok);
  const antes = (await q("select envio_ligado_em from modelos_email where chave = 't_regra'"))[0].envio_ligado_em;
  await db.query("select pg_sleep(0.05)");
  await ligar('envio_minutos = 45');
  check('mudar os minutos com o Envio ligado recomeça a contagem', (await q("select envio_ligado_em from modelos_email where chave = 't_regra'"))[0].envio_ligado_em > antes);
  const velho = await attempt(() => db.query("update modelos_email set envio_minutos = 30 where chave = 'boas_vindas'"));
  check('um dos 10 modelos de antes não ganha Envio em minutos', !velho.ok);
  await db.query("delete from modelos_email where chave = 't_regra'");

  console.log('\n== crm-modelo-tecnologo-recap.sql ==');
  const sqlModelo = gerar();
  const m1 = await attempt(() => db.exec(sqlModelo));
  check('roda a 1ª vez sem erro', m1.ok); if (!m1.ok) console.log(m1.error.message);
  const m2 = await attempt(() => db.exec(sqlModelo));
  check('roda a 2ª vez sem erro e não duplica', m2.ok && (await q('select count(*)::int n from modelos_email_versoes where chave = $1', [CHAVE]))[0].n === 1);
  const [mod] = await q('select * from modelos_email where chave = $1', [CHAVE]);
  check('modelo novo do estúdio, tipo serviço, objetivo freebie, Envio DESLIGADO', mod.criado_no_estudio && mod.tipo === 'servico' && mod.objetivo_chave === 'freebie' && mod.envio_ligado === false);
  check('Envio: 30 minutos depois de pegar o guia-tecnologo', mod.envio_gatilho === 'material' && mod.envio_depois_de === 'guia-tecnologo' && mod.envio_minutos === 30);
  check('Para quem: só quem pegou o guia-tecnologo', JSON.stringify(mod.para_quem) === '{"materiais":["guia-tecnologo"]}');
  const vs = await q('select * from modelos_email_versoes where chave = $1', [CHAVE]);
  check('uma versão 1, em rascunho (nada publicado)', vs.length === 1 && vs[0].versao === 1 && vs[0].etapa === 'rascunho');
  check('o link do Notion está no texto e no HTML', vs[0].corpo_texto.includes('topordentroviagens.notion.site') && vs[0].corpo_html.includes('topordentroviagens.notion.site'));
  check('sem marcador de conferência no texto', !/\[[^\]]+\]/.test(vs[0].corpo_texto.replace(/\{[^}]*\}/g, '')));
  check('só usa dados que o modelo oferece (nome e e-mail)', (() => {
    const oferecidos = ES.varsDoModelo(CHAVE, { chave: CHAVE, criado_no_estudio: true, tipo: 'servico', para_quem: mod.para_quem });
    const usados = [...(vs[0].assunto + vs[0].corpo_texto + vs[0].corpo_html).matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]).filter((k) => !['assunto', 'pre'].includes(k));
    return usados.every((k) => oferecidos.includes(k));
  })());
  check('rodapé de serviço: sem "responda sair" (é o que ela pediu)', !/responda sair/i.test(vs[0].corpo_texto));
  check('nenhum outro modelo mudou', JSON.stringify(modelosAntes) === JSON.stringify((await q('select * from modelos_email order by chave')).filter((m) => m.chave !== CHAVE).map(semMin)));

  console.log('\n== Quem recebe e quando ==');
  // T = o cadastro da Ana. O Envio é ligado 1h antes (o que você fará no estúdio, mais cedo que os cadastros do teste).
  const T = new Date(Date.now() - 5 * 36e5);
  async function pessoa(nome, quando, { origem = 'guia-tecnologo', novidades = false } = {}) {
    const [c] = await q("insert into contatos (email, nome, persona, respostas) values ($1, $2, 'campus_france', '{\"objetivo\":\"tec-escrevi\"}') returning id",
      [nome.toLowerCase() + '@example.com', nome]);
    await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', $2, 'teste')", [c.id, novidades]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem }, quando]);
    return c.id;
  }
  const ana = await pessoa('Ana', T.toISOString());
  await pessoa('Bia', min(T, 20));
  await pessoa('Caio', min(T, -180));                       // se cadastrou ANTES de o Envio ser ligado
  await pessoa('Duda', min(T, 5), { origem: 'guia-email-alt30' });   // pegou outro guia
  await pessoa('Eva', min(T, 10), { novidades: true });
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [CHAVE]);
  await db.query('update modelos_email set envio_ligado = true where chave = $1', [CHAVE]);
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', [CHAVE, min(T, -60)]);
  check('29 minutos depois do cadastro da Ana: ninguém ainda', (await pendentes(min(T, 29))).length === 0);
  check('31 minutos: só a Ana (30 min depois do cadastro dela)', quem(await pendentes(min(T, 31)), CHAVE) === 'Ana');
  check('41 minutos: Ana e Eva (a Eva cadastrou aos 10 min)', quem(await pendentes(min(T, 41)), CHAVE) === 'Ana,Eva');
  check('51 minutos: Ana, Bia e Eva', quem(await pendentes(min(T, 51)), CHAVE) === 'Ana,Bia,Eva');
  const p = await pendentes(min(T, 51));
  check('serviço sai para quem não aceitou novidades (Ana não aceitou)', p.some((r) => r.nome === 'Ana'));
  check('quem se cadastrou antes de o Envio ser ligado (Caio) não recebe', !p.some((r) => r.nome === 'Caio'));
  check('quem pegou outro guia (Duda) não recebe', !p.some((r) => r.nome === 'Duda'));
  check('a lista traz o que o Worker precisa (e-mail, versão, tipo, etapa da pessoa)',
    p[0].email.endsWith('@example.com') && p[0].versao === 1 && p[0].tipo === 'servico' && p[0].dados.respostas.objetivo === 'tec-escrevi');
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, $2, 'x', 'entregue', $3, true)", [ana, CHAVE, min(T, 33)]);
  check('depois de enviado, a Ana não recebe de novo', !(await pendentes(min(T, 60))).some((r) => r.nome === 'Ana'));
  await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_recapturado', $2, $3)", [ana, { origem: 'guia-tecnologo' }, min(T, 90)]);
  check('se ela se cadastrar de novo, também não recebe outro', !(await pendentes(min(T, 130))).some((r) => r.nome === 'Ana'));
  check('passadas 2 dias do horário, quem não recebeu perde a vez (Bia)', !(await pendentes(min(T, 20 + 30 + 48 * 60 + 1))).some((r) => r.nome === 'Bia'));

  console.log('\n== O que já existia continua igual (dias e horário) ==');
  await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave, para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora)
    values ('t_dias', 'Teste dias e hora', 'teste', 'servico', 'x', 'x', true, 'freebie', '{"materiais":["guia-tecnologo"]}', 'material', 'guia-tecnologo', 1, 10)`);
  await db.query(`insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, corpo_html, blocos, publicado_em)
    values ('t_dias', 1, 'no_ar', 'x', 'x', 'x', '{"v":1,"itens":[]}', now())`);
  await db.query('update modelos_email set envio_ligado = true where chave = $1', ['t_dias']);
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', ['t_dias', min(T, -60)]);
  const [{ d }] = await q("select ((($1::timestamptz at time zone 'America/Sao_Paulo')::date + 1) + make_interval(hours => 10)) at time zone 'America/Sao_Paulo' as d", [T.toISOString()]);
  const dev = new Date(d);
  check('um modelo em dias e hora não sai 30 minutos depois', quem(await pendentes(min(T, 31)), 't_dias') === '');
  check('um modelo em dias e hora sai no dia seguinte, na hora de Brasília (Ana e Eva, as que não receberam este)',
    quem(await pendentes(new Date(dev.getTime() + 60000)), 't_dias').includes('Ana'));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
