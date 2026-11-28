// Testa crm-modelos-rota-da-secu.sql (o e-mail 1 do guia "Rota da Sécu") num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM,
// junto com crm-saude-porta-ponto.sql (que grava porta e ponto). Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db node crm-modelos-rota-da-secu.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import * as JR from '../../jornada.js';
import * as TX from '../../taxonomia.js';
import { caso, PORTAS, PONTOS, OFICIAL } from '../../../../guias/rota-da-secu/casos.js';
import { gerar, D1, CHAVE_1, ORIGEM, SLUG } from '../modelo-rota-da-secu.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
const asRole = async (role, fn) => { await db.exec(`set role ${role};`); try { return await fn(); } finally { await db.exec('reset role;'); } };

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
  const ORDEM_CRM = ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql'];
  for (const f of ORDEM_CRM) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  console.log('\n== Sem os pré-requisitos o SQL para com aviso claro ==');
  const sqlModelos = gerar();
  const semMin = await attempt(() => db.exec(sqlModelos));
  check('sem crm-sequencia-minutos.sql: erro que diz o que rodar antes', !semMin.ok && /crm-sequencia-minutos\.sql/.test(semMin.error.message));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-sequencia-minutos.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-saude-porta-ponto.sql'), 'utf8'));
  const semTax = await attempt(() => db.exec(sqlModelos));
  check('sem crm-taxonomia-modelos.sql e crm-pagina-i05.sql: erro que diz o que rodar antes', !semTax.ok && /crm-taxonomia-modelos\.sql/.test(semTax.error.message) && /crm-pagina-i05\.sql/.test(semTax.error.message));
  for (const f of ['crm-taxonomia-modelos.sql', 'crm-pagina-i05.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  check('antes do SQL novo o banco recusa a página I06', !(await attempt(() => db.query("update modelos_email set pagina = 'I06' where chave = 'guia_chamada'"))).ok);

  console.log('\n== crm-modelos-rota-da-secu.sql ==');
  const r1 = await attempt(() => db.exec(sqlModelos));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sqlModelos));
  check('roda a 2ª vez sem erro e não duplica', r2.ok && (await q('select count(*)::int n from modelos_email_versoes where chave = $1', [CHAVE_1]))[0].n === 1);
  const ms = await q("select * from modelos_email where chave like 'saude\\_%' order by chave");
  check('só o e-mail 1 da Rota é criado (o e-mail 2 fica para depois; o Mapa não é criado)', ms.length === 1 && ms[0].chave === CHAVE_1);
  const m = ms[0];
  check('novo, do estúdio, com o Envio DESLIGADO', m.criado_no_estudio === true && m.envio_ligado === false);
  check('serviço, 5 minutos depois de se cadastrar na origem guia-rota-da-secu', m.tipo === 'servico' && m.envio_gatilho === 'material' && m.envio_depois_de === ORIGEM && m.envio_minutos === 5 && ORIGEM === 'guia-rota-da-secu' && SLUG === 'rota-da-secu');
  const vs = await q('select * from modelos_email_versoes where chave = $1', [CHAVE_1]);
  check('uma versão 1, em rascunho (nada publicado)', vs.length === 1 && vs[0].versao === 1 && vs[0].etapa === 'rascunho');

  console.log('\n== A Jornada: o e-mail 1 fica na linha I06 (Saúde · Rota da Sécu) ==');
  check('familia entrega e página I06', m.familia === 'entrega' && m.pagina === 'I06');
  check('o banco aceita I06 e continua recusando página inventada', (await attempt(() => db.query("update modelos_email set pagina = 'I06' where chave = $1", [CHAVE_1]))).ok && !(await attempt(() => db.query("update modelos_email set pagina = 'I99' where chave = $1", [CHAVE_1]))).ok);
  const i06 = TX.PAGINAS.find((x) => x.k === 'I06');
  check('a linha I06 da taxonomia é a da Rota da Sécu, não a do Mapa', i06 && /Rota da Sécu/.test(i06.nome) && i06.rota === '/guias/rota-da-secu/' && TX.PAGINAS.length === 9);
  const jor = JR.montaJornada(await q('select * from modelos_email order by chave'), TX);
  const l6 = (jor.linhas || jor).find((l) => l.k === 'I06');
  check('a Jornada tem o e-mail 1 no Inbound lead da linha I06 e nada na linha de todos os percursos', l6 && l6.celulas.lead.some((x) => x.chave === CHAVE_1) && !((jor.linhas || jor).find((l) => l.k === 'TR').celulas.lead || []).some((x) => x.chave === CHAVE_1));

  console.log('\n== Só usa dados que o estúdio oferece ==');
  const oferecidos = ES.varsDoModelo(CHAVE_1, { chave: CHAVE_1, criado_no_estudio: true, tipo: m.tipo, para_quem: m.para_quem });
  const tudo = vs[0].assunto + '\n' + vs[0].corpo_texto + '\n' + vs[0].corpo_html;
  const usados = [...tudo.matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]).filter((k) => !['assunto', 'pre'].includes(k));
  check('todo {dado} usado é oferecido (inclui caso_*, caso_geral, assunto_rota, link_pagina)', usados.every((k) => oferecidos.includes(k)));
  check('o estúdio oferece as 20 variáveis caso_*, a reserva, o assunto e o link', PORTAS.every((p) => PONTOS.every((o) => oferecidos.includes('caso_' + p.id + '_' + o.id))) && ['caso_geral', 'assunto_rota', 'link_pagina'].every((k) => oferecidos.includes(k)));
  check('link_pagina é um link do catálogo, não privado', ES.CAT.link_pagina && ES.CAT.link_pagina.t === 'link' && !ES.CAT.link_pagina.privado);

  console.log('\n== O texto ==');
  const corpo = vs[0].corpo_texto;
  const semRodape = corpo.split(/\n—\n/)[0];
  check('sem [colchetes] (o Worker recusa o envio), sem travessão, sem "sempre", sem "app beta"', !/[\[\]]/.test(tudo) && !/[—–]/.test(semRodape + vs[0].assunto) && !/\bsempre\b/i.test(tudo) && !/app beta|beta/i.test(tudo));
  const iLemb = semRodape.indexOf('service-public.gouv.fr/particuliers/vosdroits/R45084'), iSaud = semRodape.indexOf('Oi, {nome}');
  check('o lembrete do link oficial é a primeira frase depois da saudação', OFICIAL.endsWith('R45084') && iSaud >= 0 && iLemb > iSaud && !/\{#caso_/.test(semRodape.slice(iSaud, iLemb)));
  check('o aviso do estudante (etudiant-etranger.ameli.fr) vem logo depois do lembrete e fora de qualquer bloco de caso (vale também para a reserva)', /Estudante\?[^\n]*etudiant-etranger\.ameli\.fr/.test(semRodape) && semRodape.indexOf('Estudante?') > iLemb && semRodape.indexOf('Estudante?') < semRodape.indexOf('{#caso_'));
  check('Cerfa S1106 no lembrete', /Cerfa S1106/.test(semRodape.slice(iSaud, iLemb + 200)));
  check('o botão volta para {link_pagina} e o outro link é só o oficial', /\{link_pagina\}/.test(tudo) && !/https?:\/\/(?!www\.service-public\.gouv\.fr)[^\s"')<]*/.test(corpo.replace(/\{link_\w+\}/g, '')));
  const foraDosCasos = corpo.replace(/\{#caso_[a-z_]+\}[\s\S]*?\{\/caso_[a-z_]+\}/g, '');
  check('a oferta existe, traz as 3 opções e NÃO tem preço', /Prefere ter alguém com você\?/.test(foraDosCasos) && /Ligue sem medo/.test(foraDosCasos) && /Escreva sem erro/.test(foraDosCasos) && /Resolva de ponta a ponta/.test(foraDosCasos) && !/€|R\$|reais|euros/i.test(foraDosCasos));
  check('o aviso de escopo e a proteção estão no e-mail', /Não sou advogada/.test(corpo) && /Ingryd · Por Dentro/.test(corpo) && /quem fala com a CPAM é você/i.test(foraDosCasos));
  check('uma pergunta por porta (4 blocos)', (corpo.match(/Para eu entender melhor/g) || []).length === 4);
  check('o assunto usa {assunto_rota} e há assunto reserva', /\{assunto_rota\}/.test(vs[0].assunto) && /Sécu/.test(D1.assunto_alt));

  console.log('\n== Cada uma das 20 combinações tem o texto de caso(porta, ponto) ==');
  const bloco = (k) => (corpo.match(new RegExp('\\{#' + k + '\\}([\\s\\S]*?)\\{/' + k + '\\}', 'g')) || []).join('\n');
  for (const p of PORTAS) for (const o of PONTOS) {
    const c = caso(p.id, o.id), t = bloco('caso_' + p.id + '_' + o.id);
    check(p.id + '.' + o.id + ': o bloco existe e traz o primeiro passo e cada passo da página', t.length > 0 && t.includes(c.primeiro) && c.passos.every((s) => t.includes(s.x)));
    check(p.id + '.' + o.id + ': a frase em francês de apoio aparece com o aviso de revisão', c.passos.filter((s) => s.fr).every((s) => t.includes(s.fr)) && (!c.passos.some((s) => s.fr) || /em revisão/.test(t)));
  }
  check('a reserva (caso_geral) leva à página, sem inventar roteiro', /\{#caso_geral\}[\s\S]*?\{\/caso_geral\}/.test(corpo) && !/\{#caso_geral\}[\s\S]*?Primeiro passo[\s\S]*?\{\/caso_geral\}/.test(corpo));

  console.log('\n== Cadastro e atribuição (a função que a página chama) ==');
  const lead = (email, nome, extra) => asRole('anon', () => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: SLUG, email, nome, origem: ORIGEM, aceita_servico: true, consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.', ...extra })]));
  const l1 = await lead('ana@example.com', 'Ana', { respostas: { porta: 'aupair', ponto: 'esperando' }, utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'saude-sistema', utm_content: 'x-0075' });
  const ra = (await q("select respostas, utm_campaign, utm_content, origem from contatos where email = 'ana@example.com'"))[0];
  check('sem linha em guias_links o cadastro funciona e não devolve notion_url', l1.rows[0].r && !('notion_url' in l1.rows[0].r) && (await q("select count(*)::int n from guias_links where slug = $1", [SLUG]))[0].n === 0);
  check('porta e ponto ficam gravados; origem e utm_* também', ra.respostas.porta === 'aupair' && ra.respostas.ponto === 'esperando' && ra.origem === ORIGEM && ra.utm_campaign === 'saude-sistema' && ra.utm_content === 'x-0075');
  const ev = (await q("select dados from eventos e join contatos c on c.id = e.contato_id where c.email = 'ana@example.com' and e.tipo = 'email_capturado'"))[0];
  check('o evento email_capturado leva origem e utm_content (liga a visita ao post)', ev && ev.dados.origem === ORIGEM && ev.dados.utm_content === 'x-0075' && ev.dados.utm_campaign === 'saude-sistema');
  await lead('bia@example.com', 'Bia', { respostas: { porta: 'admin', ponto: '<script>' } });
  const rb = (await q("select respostas from contatos where email = 'bia@example.com'"))[0].respostas || {};
  check('valor fora da lista é ignorado (nada de texto livre no banco)', rb.porta === undefined && rb.ponto === undefined);

  console.log('\n== O que o comportamento de hoje faz num segundo cadastro (a etapa 2 muda isto) ==');
  await lead('ana@example.com', 'Ana', { respostas: { porta: 'estudante', ponto: 'nao_cheguei' } });
  const ra2 = (await q("select respostas from contatos where email = 'ana@example.com'"))[0].respostas;
  check('hoje o segundo cadastro SOBRESCREVE porta e ponto (sem histórico)', ra2.porta === 'estudante' && ra2.ponto === 'nao_cheguei');
  const evs = await q("select tipo, dados from eventos e join contatos c on c.id = e.contato_id where c.email = 'ana@example.com' and e.tipo in ('email_capturado', 'email_recapturado') order by e.criado_em");
  check('hoje o recadastro vira evento email_recapturado, e o evento não guarda as respostas antigas', evs.some((e) => e.tipo === 'email_recapturado') && !evs.some((e) => e.dados && e.dados.respostas && e.dados.respostas.porta === 'aupair'));

  console.log('\n== A fila do Worker ==');
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [CHAVE_1]);
  await db.query('update modelos_email set envio_ligado = true where chave = $1', [CHAVE_1]);
  await db.query("update modelos_email set envio_ligado_em = now() - interval '1 hour' where chave = $1", [CHAVE_1]);
  const pend = await asRole('service_role', () => q("select * from public.crm_sequencia_pendentes(100, now() + interval '10 minutes')"));
  const pa = pend.find((r) => r.chave === CHAVE_1 && r.nome === 'Ana');
  check('a Ana entra na fila do e-mail 1 com porta e ponto em dados.respostas', pa && pa.dados.respostas.porta === 'estudante' && pa.dados.respostas.ponto === 'nao_cheguei');
  check('quem não tem porta nem ponto também entra (o Worker usa a reserva)', pend.some((r) => r.chave === CHAVE_1 && r.nome === 'Bia'));

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
