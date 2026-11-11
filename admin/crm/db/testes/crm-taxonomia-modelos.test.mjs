// Testa crm-taxonomia-modelos.sql (colunas familia, pagina, etapa, persona em modelos_email + preenchimento dos modelos atuais)
// num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM, e a sincronia com o modo de reserva de taxonomia.js.
// Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:taxonomia
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifica } from '../../taxonomia.js';

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
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql', 'crm-modelo-tecnologo-recap.sql', 'crm-modelos-chegada-au-pair.sql',
    'crm-link-pagamento-email.sql', 'crm-acesso-email.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const modelosAntes = await q('select * from modelos_email order by chave');
  check('o banco de teste tem modelos', modelosAntes.length > 10);

  console.log('\n== crm-taxonomia-modelos.sql ==');
  const sql = readFileSync(path.resolve(HERE, '../crm-taxonomia-modelos.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  const depois = await q('select * from modelos_email order by chave');
  const sem4 = (m) => { const { familia, pagina, etapa, persona, ...r } = m; return r; };
  check('nenhuma outra coluna mudou', JSON.stringify(modelosAntes) === JSON.stringify(depois.map(sem4)));
  check('etapa fica vazia em todos', depois.every((m) => m.etapa === null));

  console.log('\n== As regras das colunas ==');
  const set = (s) => attempt(() => db.query(`update modelos_email set ${s} where chave = 'cf_guia_1'`));
  check('família inválida: recusa', !(await set("familia = 'x'")).ok);
  check('página I09: recusa', !(await set("pagina = 'I09'")).ok);
  check('persona inválida: recusa', !(await set("persona = 'x'")).ok);
  check('etapa sem página: recusa', !(await set("pagina = null, etapa = 'tec-nao-sei'")).ok);
  check('página I02 com etapa tec-nao-sei: aceita', (await set("pagina = 'I02', etapa = 'tec-nao-sei'")).ok);
  check('etapa fora do formato: recusa', !(await set("etapa = 'Tec Nao Sei'")).ok);
  await set("pagina = 'I03', etapa = null");

  console.log('\n== O preenchimento bate com a tabela da seção 4 da spec ==');
  const esperado = {
    boas_vindas: ['acesso', null, null], hub_estudos_compra: ['compra', null, null], hub_estudos_d3: ['compra', null, null],
    naoabriu: ['reimpacto', null, null], naoclicou: ['reimpacto', null, null], cliquenaoapp: ['reimpacto', null, null], parouapp: ['reimpacto', null, null],
    cf_guia_1: ['entrega', 'I03', null], cf_guia_conversa: ['entrega', 'I03', null], guia_alternancia: ['entrega', 'I01', null],
    guia_chamada: ['entrega', 'I04', null], guia_plataforma: ['entrega', 'I04', null], tec_recap_30min: ['entrega', 'I02', null],
    aupair_chegada_1: ['entrega', 'I05', 'au_pair'], aupair_chegada_2: ['entrega', 'I05', 'au_pair'],
    hub_estudos_lancamento: ['campanha', null, null], lembrete_prazo_vlsts: ['campanha', null, null]
  };
  const porChave = Object.fromEntries(depois.map((m) => [m.chave, m]));
  let presentes = 0;
  for (const [k, [f, p, pe]] of Object.entries(esperado)) {
    const m = porChave[k]; if (!m) continue; presentes++;
    check(`${k}: ${f}/${p}/${pe}`, m.familia === f && m.pagina === p && m.persona === pe);
  }
  check('a maioria das chaves da tabela existe no banco de teste', presentes >= 12);
  for (const m of depois.filter((x) => x.chave.startsWith('acesso_'))) check(`${m.chave}: acesso`, m.familia === 'acesso');
  for (const m of depois.filter((x) => x.chave.startsWith('aq_'))) check(`${m.chave}: aquecimento I03`, m.familia === 'aquecimento' && m.pagina === 'I03');
  for (const m of depois.filter((x) => x.chave.startsWith('link_pagamento'))) check(`${m.chave}: compra`, m.familia === 'compra');

  console.log('\n== Sincronia com o modo de reserva de taxonomia.js ==');
  for (const m of depois) {
    const c = classifica(sem4(m));
    check(`reserva == banco para ${m.chave}`, c.origem === 'reserva' && c.familia === m.familia && c.pagina === m.pagina && c.persona === m.persona && c.etapa === null);
  }

  console.log('\n== Não sobrescreve o que já está preenchido ==');
  await db.query("update modelos_email set familia = 'campanha', pagina = 'I04' where chave = 'boas_vindas'");
  await db.query("update modelos_email set familia = 'campanha', pagina = 'I01' where chave = 'cf_guia_1'");
  await db.query("update modelos_email set persona = null where chave = 'aupair_chegada_1'");
  const r3 = await attempt(() => db.exec(sql));
  check('roda de novo sem erro', r3.ok);
  const [bv] = await q("select familia, pagina from modelos_email where chave = 'boas_vindas'");
  check('boas_vindas continua campanha/I04', bv.familia === 'campanha' && bv.pagina === 'I04');
  const [cf] = await q("select familia, pagina from modelos_email where chave = 'cf_guia_1'");
  check('cf_guia_1 continua campanha/I01 (não volta para entrega/I03)', cf.familia === 'campanha' && cf.pagina === 'I01');
  const [ap] = await q("select familia, persona from modelos_email where chave = 'aupair_chegada_1'");
  check('aupair_chegada_1: persona vazia de propósito não é refeita', ap.familia === 'entrega' && ap.persona === null);

  console.log('\n== crm-pagina-i05.sql: um banco que já tinha a taxonomia só com I01 a I04 ==');
  const sqlI05 = readFileSync(path.resolve(HERE, '../crm-pagina-i05.sql'), 'utf8');
  await db.query("update modelos_email set pagina = null where chave in ('aupair_chegada_1', 'aupair_chegada_2')");
  await db.exec('alter table modelos_email drop constraint modelos_email_pagina_check');
  await db.exec("alter table modelos_email add constraint modelos_email_pagina_check check (pagina is null or pagina in ('I01', 'I02', 'I03', 'I04'))");
  const setI5 = (chave) => attempt(() => db.query("update modelos_email set pagina = 'I05' where chave = $1", [chave]));
  check('antes: a I05 é recusada (a regra antiga)', !(await setI5('guia_chamada')).ok);
  await db.query("update modelos_email set pagina = 'I02' where chave = 'aupair_chegada_2'");   // classificado à mão: não pode ser sobrescrito
  const m1 = await attempt(() => db.exec(sqlI05));
  check('roda a 1ª vez sem erro', m1.ok); if (!m1.ok) console.log(m1.error.message);
  const m2 = await attempt(() => db.exec(sqlI05));
  check('roda a 2ª vez sem erro', m2.ok); if (!m2.ok) console.log(m2.error.message);
  check('depois: a I05 é aceita', (await setI5('guia_chamada')).ok);
  await db.query("update modelos_email set pagina = 'I04' where chave = 'guia_chamada'");
  check('página I06 continua recusada', !(await attempt(() => db.query("update modelos_email set pagina = 'I06' where chave = 'guia_chamada'"))).ok);
  const [a1] = await q("select pagina from modelos_email where chave = 'aupair_chegada_1'");
  const [a2] = await q("select pagina from modelos_email where chave = 'aupair_chegada_2'");
  check('aupair_chegada_1 (vazio) foi para a I05', a1.pagina === 'I05');
  check('aupair_chegada_2 (classificado à mão como I02) não foi sobrescrito', a2.pagina === 'I02');
  const outras = await q("select count(*)::int n from modelos_email where pagina = 'I05' and chave not in ('aupair_chegada_1')");
  check('nenhum outro modelo foi para a I05', outras[0].n === 0);
  check('etapa de uma página I05 aceita um código do guia', (await attempt(() => db.query("update modelos_email set pagina = 'I05', etapa = 'ap-medo-prazo' where chave = 'guia_chamada'"))).ok);
  await db.query("update modelos_email set pagina = 'I04', etapa = null where chave = 'guia_chamada'");

  console.log('\n== O gatilho ==');
  const g = await attempt(() => db.query("update modelos_email set familia = 'acesso' where chave = 'boas_vindas'"));
  check('classificar um dos modelos de antes do estúdio não dá erro', g.ok); if (!g.ok) console.log(g.error.message);
  const g2 = await attempt(() => db.query("update modelos_email set familia = 'serie', pagina = 'I02', etapa = 'tec-nao-sei', persona = 'pvt' where chave = 'boas_vindas'"));
  check('as quatro colunas juntas também passam', g2.ok);
  const g3 = await attempt(() => db.query("update modelos_email set envio_gatilho = 'material' where chave = 'boas_vindas'"));
  check('o Envio de um modelo de antes continua proibido', !g3.ok);

  console.log('\n== Leitura do Worker ==');
  const w = await q("select * from modelos_email where chave = 'cf_guia_1'");
  check('select * por chave devolve a linha, com as quatro colunas', w.length === 1 && 'familia' in w[0] && 'etapa' in w[0]);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
