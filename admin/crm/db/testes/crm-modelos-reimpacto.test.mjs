// Testa crm-modelos-reimpacto.sql (os 4 reimpactos com a base da aula de CRO) num Postgres efêmero (PGlite), em cima dos
// arquivos reais do CRM, das entregas 1 a 3 do estúdio, de crm-modelos-prontos.sql e de crm-modelos-revisao.sql.
// Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:reimpacto
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { REVISADOS } from '../modelos-revisao.mjs';
import { REIMPACTOS, NOTA, gerar } from '../modelos-reimpacto.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
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
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  // Um reimpacto que você mudou no estúdio depois da revisão: ele não pode ser tocado.
  const meu = JSON.parse(JSON.stringify(REVISADOS.find((r) => r.chave === 'cliquenaoapp').blocos)); meu.itens[0].texto = 'Oi {nome}! Texto que eu mudei.';
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, blocos) values ('cliquenaoapp', (select max(versao) + 1 from modelos_email_versoes where chave = 'cliquenaoapp'), 'rascunho', 'x', 'x', $1)", [JSON.stringify(meu)]);

  const modelosAntes = await q('select * from modelos_email order by chave');
  const versoesAntes = await q('select * from modelos_email_versoes order by chave, versao');

  const sql = readFileSync(path.resolve(HERE, '../crm-modelos-reimpacto.sql'), 'utf8');
  check('o arquivo está igual ao que modelos-reimpacto.mjs gera', sql === gerar());
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const depois1 = await q('select chave, versao from modelos_email_versoes order by chave, versao');
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  check('a 2ª vez não cria nada', JSON.stringify(depois1) === JSON.stringify(await q('select chave, versao from modelos_email_versoes order by chave, versao')));

  console.log('\n== O que já existia não muda ==');
  const chavesAntes = versoesAntes.map((v) => v.chave + ':' + v.versao);
  check('nenhuma versão que já existia mudou', JSON.stringify(versoesAntes) === JSON.stringify((await q('select * from modelos_email_versoes order by chave, versao')).filter((v) => chavesAntes.includes(v.chave + ':' + v.versao))));
  check('nenhum modelo mudou', JSON.stringify(modelosAntes) === JSON.stringify(await q('select * from modelos_email order by chave')));

  console.log('\n== As versões novas ==');
  const novas = await q('select v.*, m.tipo from modelos_email_versoes v join modelos_email m using (chave) where v.nota = $1 order by v.chave', [NOTA]);
  check('ganham rascunho naoabriu, naoclicou e parouapp (o cliquenaoapp que você mudou fica)', novas.map((v) => v.chave).join(',') === 'naoabriu,naoclicou,parouapp');
  check('todas em rascunho, versão 4', novas.every((v) => v.etapa === 'rascunho' && v.versao === 4));
  let ok = true;
  for (const v of novas) {
    const r = REIMPACTOS.find((x) => x.chave === v.chave), mt = ES.montar(v.blocos, v.tipo);
    if (canon(v.blocos) !== canon(r.blocos)) { ok = false; console.log('  blocos diferentes:', v.chave); }
    if (mt.assunto !== v.assunto || mt.corpo_texto !== v.corpo_texto || mt.corpo_html !== v.corpo_html || (mt.preheader || null) !== v.preheader) { ok = false; console.log('  texto diferente:', v.chave); }
    const m = { chave: v.chave }, vars = {};
    ES.varsDoModelo(v.chave, m).forEach((k) => { vars[k] = ES.CAT[k] && ES.CAT[k].t === 'sim' ? true : 'x'; });
    try { ES.montarComDados(v, vars); } catch (e) { ok = false; console.log('  não monta:', v.chave, e.message); }
    const trava = ES.conferir(v.blocos, m, v, false).filter((x) => x.trava && !x.ok && !/colchetes/.test(x.txt));
    if (trava.length) { ok = false; console.log('  "Pronto para usar?":', v.chave, trava.map((x) => x.txt).join('; ')); }
  }
  check('texto guardado = o que o estúdio monta, monta com os dados e passa no "Pronto para usar?"', ok);
  check('sem travessão e sem "pra"', novas.every((v) => !/—|\bpra\b|\bpro\b/.test(JSON.stringify(v.blocos))));
  check('assunto e abertura com versão sem nome', novas.every((v) => v.blocos.assunto_alt && v.blocos.itens[0].alt && v.blocos.itens[0].alt.startsWith('Oi! ')));
  check('só o parouapp fica com [colchetes] (o [dica])', novas.filter((v) => /\[[^\]\n]{2,60}\]/.test(v.corpo_texto)).map((v) => v.chave).join(',') === 'parouapp');
  check('rodapé: novidades (naoclicou, parouapp) com "responda sair"; serviço sem', novas.every((v) => (v.tipo === 'novidades') === /responda com a palavra sair/.test(v.corpo_texto)));
  const semMotivo = ES.montarComDados(novas.find((v) => v.chave === 'parouapp'), Object.assign(Object.fromEntries(ES.varsDoModelo('parouapp', {}).map((k) => [k, ES.CAT[k] && ES.CAT[k].t === 'sim' ? false : ''])), { nome: 'Bia' }));
  check('parouapp sem motivo: o trecho do motivo some', !/Também vi que/.test(semMotivo.texto) && /Oi Bia!/.test(semMotivo.texto));

  console.log('\n== Como desfazer ==');
  const desfazer = sql.split('-- Como desfazer')[1].split('\n').filter((l) => /^--   /.test(l)).map((l) => l.slice(5)).join('\n');
  const rd = await attempt(() => db.exec(desfazer));
  check('o "como desfazer" roda e volta ao que era', rd.ok && JSON.stringify(versoesAntes.map((v) => v.chave + ':' + v.versao)) === JSON.stringify((await q('select chave, versao from modelos_email_versoes order by chave, versao')).map((v) => v.chave + ':' + v.versao)));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
