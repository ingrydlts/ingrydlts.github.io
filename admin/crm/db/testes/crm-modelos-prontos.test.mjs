// Testa crm-modelos-prontos.sql (todos os modelos de e-mail prontos para revisão) num Postgres efêmero (PGlite), em cima dos
// arquivos reais do CRM e das entregas 1 a 3 do estúdio. Não toca no Supabase real. Pessoas fictícias.
// Confere: roda 2x sem erro e sem duplicar, só cria rascunhos, não mexe em versão No ar nem em Envio, não duplica um rascunho
// que já tem os mesmos blocos, os textos guardados são os que o estúdio monta, e o "como desfazer" volta ao que era.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:prontos
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { NOVOS, DE_ANTES, gerar } from '../modelos-prontos.mjs';

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
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const [outra] = await q("insert into auth.users (email) values ('outra@example.com') returning id");

  // O banco como está hoje: o e-mail 2 já tem uma versão No ar em blocos, e o boas_vindas já tem um rascunho igual ao de
  // partida (o que o estúdio cria em "Editar em versão nova"). O naoabriu tem um rascunho com texto mudado por você.
  const v2 = ES.iniciais('cf_guia_conversa'), m2 = ES.montar(v2, 'novidades');
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos) values ('cf_guia_conversa', 2, 'rascunho', $1, $2, $3, $4, $5)",
    [m2.assunto, m2.preheader, m2.corpo_texto, m2.corpo_html, JSON.stringify(v2)]);
  await db.query("select publicar_modelo_email('cf_guia_conversa', 2)");
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, blocos) values ('boas_vindas', 2, 'rascunho', 'x', 'x', $1)", [JSON.stringify(ES.iniciais('boas_vindas'))]);
  const meu = ES.iniciais('naoabriu'); meu.itens[0].texto = 'Oi {nome}! Texto que eu mudei.';
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, blocos) values ('naoabriu', 2, 'rascunho', 'x', 'x', $1)", [JSON.stringify(meu)]);
  // Uma pessoa fictícia que já recebeu um e-mail, para conferir que nada muda nos envios.
  const [c] = await q("insert into contatos (email, nome) values ('zeca@example.com', 'Zeca') returning id");
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em) values ($1, 'boas_vindas', 'x', 'entregue', now() - interval '4 days')", [c.id]);

  const modelosAntes = await q('select * from modelos_email order by chave');
  const versoesAntes = await q('select * from modelos_email_versoes order by chave, versao');
  const visaoAntes = await q('select * from crm_contatos order by email');

  const sql = readFileSync(path.resolve(HERE, '../crm-modelos-prontos.sql'), 'utf8');
  check('o arquivo está igual ao que modelos-prontos.mjs gera (ninguém editou à mão)', sql === gerar());
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const depois1 = await q('select chave, versao from modelos_email_versoes order by chave, versao');
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  check('a 2ª vez não cria nada', JSON.stringify(depois1) === JSON.stringify(await q('select chave, versao from modelos_email_versoes order by chave, versao')));

  console.log('\n== O que já existia não muda ==');
  const chavesAntes = versoesAntes.map((v) => v.chave + ':' + v.versao);
  const mesmas = await q('select * from modelos_email_versoes order by chave, versao');
  check('nenhuma versão que já existia mudou (No ar, arquivadas e rascunhos)', JSON.stringify(versoesAntes) === JSON.stringify(mesmas.filter((v) => chavesAntes.includes(v.chave + ':' + v.versao))));
  check('os 10 modelos de antes não mudaram', JSON.stringify(modelosAntes) === JSON.stringify(await q('select * from modelos_email where not criado_no_estudio order by chave')));
  check('crm_contatos igual', JSON.stringify(visaoAntes) === JSON.stringify(await q('select * from crm_contatos order by email')));
  check('nenhuma versão nova está No ar ou em revisão', (await q("select count(*)::int n from modelos_email_versoes where nota like 'modelos prontos%' and etapa <> 'rascunho'"))[0].n === 0);
  check('nenhum Envio ligado', (await q('select count(*)::int n from modelos_email where envio_ligado'))[0].n === 0);

  console.log('\n== Os modelos de antes ganham o texto de hoje em blocos ==');
  const novasDeAntes = await q("select chave, versao, blocos, assunto, preheader, corpo_texto, corpo_html from modelos_email_versoes where nota like 'modelos prontos%: o texto de hoje%' order by chave");
  const esperadas = DE_ANTES.map(([k]) => k).filter((k) => k !== 'boas_vindas').sort();
  check('os de antes ganham um rascunho, menos o boas_vindas (já tinha um igual)', novasDeAntes.map((v) => v.chave).join(',') === esperadas.join(','));
  check('o naoabriu ganha a versão 3 (o seu rascunho 2 fica)', novasDeAntes.find((v) => v.chave === 'naoabriu').versao === 3);
  check('o e-mail 2 do guia não ganha versão', !novasDeAntes.some((v) => v.chave === 'cf_guia_conversa'));
  check('o cf_guia_1 ganha a versão 2', novasDeAntes.find((v) => v.chave === 'cf_guia_1').versao === 2);
  let iguais = true;
  for (const v of novasDeAntes) {
    const tipo = DE_ANTES.find(([k]) => k === v.chave)[1], mt = ES.montar(v.blocos, tipo);
    if (mt.assunto !== v.assunto || mt.corpo_texto !== v.corpo_texto || mt.corpo_html !== v.corpo_html || (mt.preheader || null) !== v.preheader) { iguais = false; console.log('  diferente:', v.chave); }
  }
  check('o texto guardado é o que o estúdio monta com esses blocos', iguais);
  // O e-mail 1 em blocos sai com o mesmo texto puro de hoje (o mesmo teste da entrega 2, aqui pelo banco).
  const v1 = (await q("select corpo_texto from modelos_email_versoes where chave = 'cf_guia_1' and versao = 1"))[0].corpo_texto;
  const v2cf = novasDeAntes.find((v) => v.chave === 'cf_guia_1').corpo_texto;
  const dados = { nome: 'Bia', email: 'bia@example.com', link_checklist: 'https://example.com/x', nivel: 'Master', prazo_nivel: '17/01/2027', etapa: '', cidade: '',
    etapa_nao_comecei: false, etapa_escolhendo_curso: false, etapa_juntando_documentos: true, etapa_dossie_enviado: false, etapa_entrevista_resposta: false };
  const all = Object.assign({ assunto: 'x', pre: 'x' }, dados);
  check('cf_guia_1 v2 tem o mesmo texto da v1, com os dados de uma pessoa fictícia', ES.preencher(v1, all, false) === ES.preencher(v2cf, all, false));

  console.log('\n== Os modelos novos ==');
  const novos = await q('select * from modelos_email where criado_no_estudio order by chave');
  check('entram os ' + NOVOS.length + ' modelos novos', novos.length === NOVOS.length);
  check('todos com objetivo do catálogo e Envio desligado', novos.every((m) => ES.objetivo(m.objetivo_chave) && !m.envio_ligado && !m.envio_ligado_em));
  check('o tipo vem do objetivo', novos.every((m) => m.tipo === ES.objetivo(m.objetivo_chave).tipo));
  check('compra: tipo compra, produto hub-de-estudos', novos.filter((m) => m.objetivo_chave === 'compra').every((m) => m.tipo === 'compra' && m.para_quem.produto === 'hub-de-estudos'));
  check('aquecimento: 12, novidades, só quem pegou o guia Campus France', novos.filter((m) => m.objetivo_chave === 'aquecimento').length === 12
    && novos.filter((m) => m.objetivo_chave === 'aquecimento').every((m) => m.tipo === 'novidades' && m.para_quem.materiais[0] === 'guia-etudes-en-france-2027'));
  check('a ordem do aquecimento: D+3 depois do e-mail 2, e cada um depois do anterior', ['a', 'b', 'c'].every((t) => {
    const g = (d) => novos.find((m) => m.chave === 'aq_' + t + '_' + d);
    return g('d3').envio_depois_de === 'cf_guia_conversa' && g('d3').envio_dias === 2 && g('d6').envio_depois_de === 'aq_' + t + '_d3'
      && g('d10').envio_depois_de === 'aq_' + t + '_d6' && g('d15').envio_depois_de === 'aq_' + t + '_d10' && g('d15').envio_dias === 5;
  }));
  check('os de sequência ficam marcados como automáticos; os manuais, não', novos.every((m) => m.automatico === !!m.envio_gatilho)
    && !novos.find((m) => m.chave === 'hub_estudos_lancamento').automatico && !novos.find((m) => m.chave === 'lembrete_prazo_vlsts').automatico);
  const vn = await q("select v.*, m.tipo from modelos_email_versoes v join modelos_email m using (chave) where m.criado_no_estudio order by v.chave");
  check('cada modelo novo tem a versão 1 em rascunho', vn.length === NOVOS.length && vn.every((v) => v.versao === 1 && v.etapa === 'rascunho'));
  let monta = true;
  for (const v of vn) {
    const m = novos.find((x) => x.chave === v.chave), vars = {};
    ES.varsDoModelo(m.chave, m).forEach((k) => { vars[k] = ES.CAT[k] && ES.CAT[k].t === 'sim' ? true : 'x'; });
    try { ES.montarComDados(v, vars); } catch (e) { monta = false; console.log('  não monta:', v.chave, e.message); }
  }
  check('todos montam com os dados que o modelo tem', monta);
  check('rodapé: novidades com "responda sair"; compra e serviço sem', vn.every((v) => (v.tipo === 'novidades') === /responda com a palavra sair/.test(v.corpo_texto)));
  check('nenhum link privado digitado no texto', vn.every((v) => !/notion\.(so|site)|[?&]t=|\/conversa\/\?/.test(JSON.stringify(v.blocos))));
  const colchetes = vn.filter((v) => /\[[^\]\n]{2,60}\]/.test(v.corpo_texto)).map((v) => v.chave).sort().join(',');
  check('só ficam [colchetes] onde depende de você (D+15 e o presente CF09)', colchetes === 'aq_a_d15,aq_b_d15,aq_c_d10,aq_c_d15');
  check('quem não é admin não vê os modelos novos', (await asRole('authenticated', outra.id, () => q('select chave from modelos_email where criado_no_estudio'))).length === 0);

  console.log('\n== Um modelo novo que já existia não é tocado ==');
  await db.query("update modelos_email set nome = 'nome que eu mudei' where chave = 'hub_estudos_compra'");
  await db.query("update modelos_email_versoes set assunto = 'assunto que eu mudei' where chave = 'hub_estudos_compra'");
  await db.exec(sql);
  check('o nome e o rascunho que você mudou ficam', (await q("select nome from modelos_email where chave = 'hub_estudos_compra'"))[0].nome === 'nome que eu mudei'
    && (await q("select assunto from modelos_email_versoes where chave = 'hub_estudos_compra'"))[0].assunto === 'assunto que eu mudei');

  console.log('\n== Como desfazer ==');
  const desfazer = sql.split('-- Como desfazer')[1].split('\n').filter((l) => /^--   /.test(l) && !/^--   \(/.test(l)).map((l) => l.slice(5)).join('\n');
  // Publica um dos novos antes: o que foi publicado fica.
  await db.query("select publicar_modelo_email('hub_estudos_d3', 1)");
  const rd = await attempt(() => db.exec(desfazer));
  check('o "como desfazer" roda', rd.ok); if (!rd.ok) console.log(rd.error.message, '\n', desfazer);
  check('volta às versões de antes (menos a que você publicou)', JSON.stringify(versoesAntes.map((v) => v.chave + ':' + v.versao + ':' + v.etapa)) ===
    JSON.stringify((await q("select * from modelos_email_versoes where chave <> 'hub_estudos_d3' order by chave, versao")).map((v) => v.chave + ':' + v.versao + ':' + v.etapa)));
  const sobra = (await q('select chave from modelos_email where criado_no_estudio order by chave')).map((m) => m.chave).join(',');
  check('sobra só o modelo publicado', sobra === 'hub_estudos_d3');
  check('e o modelo de antes continua igual', JSON.stringify(modelosAntes) === JSON.stringify(await q('select * from modelos_email where not criado_no_estudio order by chave')));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
