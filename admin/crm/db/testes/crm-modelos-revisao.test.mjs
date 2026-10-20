// Testa crm-modelos-revisao.sql (a revisão de texto dos modelos de 20/10) num Postgres efêmero (PGlite), em cima dos arquivos
// reais do CRM, das entregas 1 a 3 do estúdio e de crm-modelos-prontos.sql. Não toca no Supabase real. Pessoas fictícias.
// Confere: roda 2x sem erro e sem duplicar, só cria rascunhos, não mexe em versão que já existe nem em Envio, pula o modelo que
// você mudou no estúdio, os textos guardados são os que o estúdio monta, sem travessão nem "pra", e o "como desfazer" volta ao que era.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:revisao
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { REVISADOS, NOTA, gerar } from '../modelos-revisao.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
// O jsonb guarda as chaves em outra ordem: compara com as chaves ordenadas.
const canon = (o) => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v);

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

  // O banco como está em 20/10: o e-mail 2 No ar com o texto que você escreveu (versão 3), e os modelos prontos em rascunho.
  const conversa = REVISADOS.find((r) => r.chave === 'cf_guia_conversa').base;
  let n = 2;
  for (const d of [ES.iniciais('cf_guia_conversa'), conversa]) {
    const m = ES.montar(d, 'novidades');
    await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos) values ('cf_guia_conversa', $1, 'rascunho', $2, $3, $4, $5, $6)",
      [n, m.assunto, m.preheader, m.corpo_texto, m.corpo_html, JSON.stringify(d)]);
    await db.query("select publicar_modelo_email('cf_guia_conversa', $1)", [n]); n++;
  }
  await db.exec(readFileSync(path.resolve(HERE, '../crm-modelos-prontos.sql'), 'utf8'));
  // Um modelo que você mudou no estúdio depois de 20/10: ele não pode ser tocado.
  const meu = ES.iniciais('cliquenaoapp'); meu.itens[0].texto = 'Oi {nome}! Texto que eu mudei.';
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, blocos) values ('cliquenaoapp', 3, 'rascunho', 'x', 'x', $1)", [JSON.stringify(meu)]);
  const [c] = await q("insert into contatos (email, nome) values ('zeca@example.com', 'Zeca') returning id");
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em) values ($1, 'boas_vindas', 'x', 'entregue', now() - interval '4 days')", [c.id]);

  const modelosAntes = await q('select * from modelos_email order by chave');
  const versoesAntes = await q('select * from modelos_email_versoes order by chave, versao');
  const visaoAntes = await q('select * from crm_contatos order by email');

  const sql = readFileSync(path.resolve(HERE, '../crm-modelos-revisao.sql'), 'utf8');
  check('o arquivo está igual ao que modelos-revisao.mjs gera (ninguém editou à mão)', sql === gerar());
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const depois1 = await q('select chave, versao from modelos_email_versoes order by chave, versao');
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  check('a 2ª vez não cria nada', JSON.stringify(depois1) === JSON.stringify(await q('select chave, versao from modelos_email_versoes order by chave, versao')));

  console.log('\n== O que já existia não muda ==');
  const chavesAntes = versoesAntes.map((v) => v.chave + ':' + v.versao);
  const todas = await q('select * from modelos_email_versoes order by chave, versao');
  check('nenhuma versão que já existia mudou (a No ar do e-mail 2 inclusive)', JSON.stringify(versoesAntes) === JSON.stringify(todas.filter((v) => chavesAntes.includes(v.chave + ':' + v.versao))));
  check('nenhum modelo mudou', JSON.stringify(modelosAntes) === JSON.stringify(await q('select * from modelos_email order by chave')));
  check('crm_contatos igual', JSON.stringify(visaoAntes) === JSON.stringify(await q('select * from crm_contatos order by email')));
  check('nenhum Envio ligado', (await q('select count(*)::int n from modelos_email where envio_ligado'))[0].n === 0);
  check('o e-mail 2 continua com a versão 3 No ar', (await q("select versao from modelos_email_versoes where chave = 'cf_guia_conversa' and etapa = 'no_ar'"))[0].versao === 3);

  console.log('\n== As versões novas ==');
  const novas = await q('select v.*, m.tipo, m.criado_no_estudio, m.para_quem from modelos_email_versoes v join modelos_email m using (chave) where v.nota = $1 order by v.chave', [NOTA]);
  const esperadas = REVISADOS.map((r) => r.chave).filter((k) => k !== 'cliquenaoapp').sort();
  check('ganham rascunho os ' + esperadas.length + ' revisados, menos o que você mudou (cliquenaoapp)', novas.map((v) => v.chave).join(',') === esperadas.join(','));
  check('todas em rascunho, uma versão depois da mais nova', novas.every((v) => v.etapa === 'rascunho' && v.versao === Math.max(...versoesAntes.filter((x) => x.chave === v.chave).map((x) => x.versao)) + 1));
  check('cf_guia_1, D+10, D+15 e entrega de freebie não ganham versão', !novas.some((v) => /^cf_guia_1$|_d10$|_d15$/.test(v.chave)));
  let iguais = true, monta = true;
  for (const v of novas) {
    const r = REVISADOS.find((x) => x.chave === v.chave), mt = ES.montar(v.blocos, v.tipo);
    if (canon(v.blocos) !== canon(r.blocos)) { iguais = false; console.log('  blocos diferentes:', v.chave); }
    if (mt.assunto !== v.assunto || mt.corpo_texto !== v.corpo_texto || mt.corpo_html !== v.corpo_html || (mt.preheader || null) !== v.preheader) { iguais = false; console.log('  texto diferente:', v.chave); }
    const vars = {}, m = { chave: v.chave, criado_no_estudio: v.criado_no_estudio, para_quem: v.para_quem };
    ES.varsDoModelo(v.chave, m).forEach((k) => { vars[k] = ES.CAT[k] && ES.CAT[k].t === 'sim' ? true : (ES.CAT[k] && ES.CAT[k].t === 'pronto' ? { texto: 'x', html: 'x' } : 'x'); });
    try { ES.montarComDados(v, vars); } catch (e) { monta = false; console.log('  não monta:', v.chave, e.message); }
    const trava = ES.conferir(v.blocos, m, v, false).filter((x) => x.trava && !x.ok && !/colchetes/.test(x.txt));
    if (trava.length) { monta = false; console.log('  não passa no "Pronto para usar?":', v.chave, trava.map((x) => x.txt).join('; ')); }
  }
  check('o texto guardado é o que o estúdio monta com esses blocos', iguais);
  check('todas montam com os dados do modelo e passam no "Pronto para usar?"', monta);
  check('sem travessão e sem "pra" no texto escrito', novas.every((v) => !/—|\bpra\b|\bpro\b/.test(JSON.stringify(v.blocos))));
  check('assunto e primeira frase com versão sem nome', novas.filter((v) => /\{nome\}/.test(v.blocos.assunto)).every((v) => v.blocos.assunto_alt));
  // Sem nome: o assunto e o "Oi!" saem sem vírgula solta.
  const bv = novas.find((v) => v.chave === 'boas_vindas');
  const semNome = ES.montarComDados(bv, { nome: '', persona: 'au pair', link_acesso: 'https://example.com/a', link_agenda: 'https://example.com/b', au_pair: false, motivo: '',
    prazo_vencido: false, prazo_a_vencer: false, prazo_limite: '', dias_para_prazo: '', etapa_pesquisando: false, etapa_escolhendo_escola: false, etapa_recusa_idade: false,
    etapa_buscando_empresa: false, etapa_montando_contrato: false });
  check('boas_vindas sem nome: "O seu link de acesso chegou" e "Oi! Aqui está…"', semNome.assunto === 'O seu link de acesso chegou' && semNome.texto.startsWith('Oi! Aqui está'));
  check('rodapé: novidades com "responda sair"; compra e serviço sem', novas.every((v) => (v.tipo === 'novidades') === /responda com a palavra sair/.test(v.corpo_texto)));
  check('nenhum link privado digitado no texto', novas.every((v) => !/notion\.(so|site)|[?&]t=|\/conversa\/\?/.test(JSON.stringify(v.blocos))));
  check('só o parouapp fica com [colchetes] (o [dica], manual)', novas.filter((v) => /\[[^\]\n]{2,60}\]/.test(v.corpo_texto)).map((v) => v.chave).join(',') === 'parouapp');
  check('aquecimento D+6 com "desde 2023"', novas.filter((v) => /_d6$/.test(v.chave)).every((v) => /desde 2023/.test(v.corpo_texto)) && novas.filter((v) => /_d6$/.test(v.chave)).length === 3);

  console.log('\n== Como desfazer ==');
  const desfazer = sql.split('-- Como desfazer')[1].split('\n').filter((l) => /^--   /.test(l)).map((l) => l.slice(5)).join('\n');
  await db.query("select publicar_modelo_email('hub_estudos_d3', (select max(versao) from modelos_email_versoes where chave = 'hub_estudos_d3'))");
  const rd = await attempt(() => db.exec(desfazer));
  check('o "como desfazer" roda', rd.ok); if (!rd.ok) console.log(rd.error.message, '\n', desfazer);
  const sobra = await q('select chave from modelos_email_versoes where nota = $1', [NOTA]);
  check('sobra só a versão que você publicou', sobra.length === 1 && sobra[0].chave === 'hub_estudos_d3');
  check('as outras voltam ao que eram', JSON.stringify(versoesAntes.filter((v) => v.chave !== 'hub_estudos_d3').map((v) => v.chave + ':' + v.versao)) ===
    JSON.stringify((await q("select chave, versao from modelos_email_versoes where chave <> 'hub_estudos_d3' order by chave, versao")).map((v) => v.chave + ':' + v.versao)));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
