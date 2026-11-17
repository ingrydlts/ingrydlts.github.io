// Testa crm-modelos-mapa-saude.sql, crm-saude-porta-ponto.sql e crm-guia-mapa-saude-link.sql (os 2 e-mails do guia "Mapa da saúde na França") num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:saude
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { gerar, CHAVE_1, CHAVE_2, ORIGEM, SLUG } from '../modelo-mapa-saude.mjs';

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
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const modelosAntes = await q('select * from modelos_email order by chave');
  const sqlModelos = gerar();
  const r1 = await attempt(() => db.exec(sqlModelos));
  check('modelos: roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sqlModelos));
  check('modelos: roda a 2ª vez sem erro e não duplica', r2.ok && (await q('select count(*)::int n from modelos_email_versoes where chave in ($1, $2)', [CHAVE_1, CHAVE_2]))[0].n === 2);
  const ms = await q('select * from modelos_email where chave in ($1, $2) order by chave', [CHAVE_1, CHAVE_2]);
  check('dois modelos novos, com o Envio DESLIGADO', ms.length === 2 && ms.every((m) => m.criado_no_estudio && m.envio_ligado === false));
  check('e-mail 1: serviço, 5 minutos depois de pegar o guia', ms[0].tipo === 'servico' && ms[0].envio_gatilho === 'material' && ms[0].envio_depois_de === ORIGEM && ms[0].envio_minutos === 5);
  check('e-mail 2: novidades, 3 dias depois do e-mail 1, às 10h', ms[1].tipo === 'novidades' && ms[1].envio_depois_de === CHAVE_1 && ms[1].envio_dias === 3 && ms[1].envio_hora === 10);
  const vs = await q('select * from modelos_email_versoes where chave in ($1, $2) order by chave', [CHAVE_1, CHAVE_2]);
  check('uma versão 1 de cada, em rascunho (nada publicado)', vs.length === 2 && vs.every((v) => v.versao === 1 && v.etapa === 'rascunho'));
  const oferecidos = [...new Set([CHAVE_1, CHAVE_2].flatMap((c, i) => ES.varsDoModelo(c, { chave: c, criado_no_estudio: true, tipo: ms[i].tipo, para_quem: ms[i].para_quem })))];
  const usados = [...vs.map((v) => v.assunto + v.corpo_texto + v.corpo_html).join('').matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]).filter((k) => !['assunto', 'pre'].includes(k));
  check('só usa dados que o estúdio oferece (porta_*, ponto_*, astúcias, seção, assuntos)', usados.every((k) => oferecidos.includes(k)));

  console.log('\n== crm-saude-porta-ponto.sql ==');
  const sqlPP = readFileSync(path.resolve(HERE, '../crm-saude-porta-ponto.sql'), 'utf8');
  const p1 = await attempt(() => db.exec(sqlPP));
  check('roda sem erro', p1.ok); if (!p1.ok) console.log(p1.error.message);
  const p2 = await attempt(() => db.exec(sqlPP));
  check('roda de novo sem erro (idempotente)', p2.ok);
  const fn = await q("select p.proname, prosecdef, proconfig, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc from pg_proc p where proname in ('capturar_lead_guia', 'crm_sequencia_pendentes') order by proname");
  const cl = fn.find((f) => f.proname === 'capturar_lead_guia'), sp = fn.find((f) => f.proname === 'crm_sequencia_pendentes');
  check('capturar_lead_guia: security definer, search_path fixo, liberada ao site público como antes', cl.prosecdef && JSON.stringify(cl.proconfig).includes('search_path') && cl.anon && cl.auth);
  check('crm_sequencia_pendentes: security definer, search_path fixo, só service_role executa', sp.prosecdef && JSON.stringify(sp.proconfig).includes('search_path') && !sp.anon && !sp.auth && sp.svc);

  const lead = (email, nome, respostas) => asRole('anon', () => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: SLUG, email, nome, persona: 'sem', origem: ORIGEM, aceita_servico: true, consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.', respostas })]));
  await lead('ana@example.com', 'Ana', { porta: 'estudante', ponto: 'nao_cheguei' });
  await lead('bia@example.com', 'Bia', { porta: 'admin', ponto: '<script>' });
  await lead('caio@example.com', 'Caio', { porta: 'aupair' });
  await lead('duda@example.com', 'Duda', {});
  const resp = async (email) => (await q('select respostas from contatos where email = $1', [email]))[0].respostas || {};
  const ra = await resp('ana@example.com');
  check('porta e ponto válidos ficam gravados', ra.porta === 'estudante' && ra.ponto === 'nao_cheguei');
  const rb = await resp('bia@example.com');
  check('valor fora da lista é ignorado (nada de texto livre no banco)', rb.porta === undefined && rb.ponto === undefined);
  const rc = await resp('caio@example.com');
  check('só a porta válida: grava a porta e não inventa o ponto', rc.porta === 'aupair' && rc.ponto === undefined);
  check('sem respostas de saúde: nada gravado', Object.keys(await resp('duda@example.com')).every((k) => !['porta', 'ponto'].includes(k)));

  console.log('\n== O Worker recebe porta e ponto ==');
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [CHAVE_1]);
  await db.query('update modelos_email set envio_ligado = true where chave = $1', [CHAVE_1]);
  await db.query("update modelos_email set envio_ligado_em = now() - interval '1 hour' where chave = $1", [CHAVE_1]);
  const pend = await asRole('service_role', () => q("select * from public.crm_sequencia_pendentes(100, now() + interval '10 minutes')"));
  const pa = pend.find((r) => r.chave === CHAVE_1 && r.nome === 'Ana');
  check('a Ana aparece na fila do e-mail 1 com porta e ponto em respostas', pa && pa.dados.respostas.porta === 'estudante' && pa.dados.respostas.ponto === 'nao_cheguei');
  check('quem não tem porta nem ponto também entra na fila (o Worker usa o plano B)', pend.some((r) => r.chave === CHAVE_1 && r.nome === 'Duda'));

  console.log('\n== crm-guia-mapa-saude-link.sql ==');
  const sqlLink = readFileSync(path.resolve(HERE, '../crm-guia-mapa-saude-link.sql'), 'utf8');
  const l0 = await attempt(() => db.exec(sqlLink));
  check('com o endereço de exemplo o script para com aviso (não registra link falso)', !l0.ok && /Cole antes o endereço/.test(l0.error.message));
  const sqlOk = sqlLink.replace('COLE-AQUI-O-ENDERECO-NOTION-SITE', 'https://exemplo.notion.site/mapa-da-saude-123');
  const l1 = await attempt(() => db.exec(sqlOk)), l2 = await attempt(() => db.exec(sqlOk));
  check('com um https válido registra a linha, e roda de novo sem duplicar', l1.ok && l2.ok && (await q("select count(*)::int n from guias_links where slug = $1", [SLUG]))[0].n === 1);

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
