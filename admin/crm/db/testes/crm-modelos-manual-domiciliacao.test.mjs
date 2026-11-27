// Testa crm-modelos-manual-domiciliacao.sql (os 2 e-mails do modelo grátis "mudança de endereço" do Manual Destrave) num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:domiciliacao
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import * as JR from '../../jornada.js';
import * as TX from '../../taxonomia.js';
import { gerar, CHAVE_1, CHAVE_2, ORIGEM } from '../modelo-manual-domiciliacao.mjs';

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
  check('e-mail 1: serviço, 5 minutos depois do cadastro', ms[0].tipo === 'servico' && ms[0].envio_gatilho === 'material' && ms[0].envio_depois_de === ORIGEM && ms[0].envio_minutos === 5);
  check('e-mail 2: novidades, 2 dias depois do e-mail 1, às 10h', ms[1].tipo === 'novidades' && ms[1].envio_depois_de === CHAVE_1 && ms[1].envio_dias === 2 && ms[1].envio_hora === 10);
  const vs = await q('select * from modelos_email_versoes where chave in ($1, $2) order by chave', [CHAVE_1, CHAVE_2]);
  check('uma versão 1 de cada, em rascunho (nada publicado)', vs.length === 2 && vs.every((v) => v.versao === 1 && v.etapa === 'rascunho'));
  const oferecidos = [...new Set([CHAVE_1, CHAVE_2].flatMap((c, i) => ES.varsDoModelo(c, { chave: c, criado_no_estudio: true, tipo: ms[i].tipo, para_quem: ms[i].para_quem })))];
  const usados = [...vs.map((v) => v.assunto + v.corpo_texto + v.corpo_html).join('').matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]).filter((k) => !['assunto', 'pre'].includes(k));
  check('só usa dados que o estúdio oferece', usados.every((k) => oferecidos.includes(k)));


  console.log('\n== O fluxo de ponta a ponta ==');
  const lead = (email, nome, mkt) => asRole('anon', () => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'modelo-mudanca-endereco-mesma-cidade', email, nome, origem: ORIGEM, aceita_servico: true, aceita_novidades: mkt,
    consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.' })]));
  await lead('ana@example.com', 'Ana Souza', false);
  await lead('bia@example.com', 'Bia Lima', true);
  const ev = await q("select dados->>'origem' o from eventos where tipo = 'email_capturado' order by criado_em");
  check('o cadastro grava o evento com a origem da página', ev.length === 2 && ev.every((e) => e.o === ORIGEM));
  const sem = await q("select count(*)::int n from contatos where respostas::text ~* 'rue|adresse|dossier'");
  check('nenhum endereço nem dossiê vai para o CRM', sem[0].n === 0);
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [CHAVE_1]);
  await db.query('update modelos_email set envio_ligado = true where chave = $1', [CHAVE_1]);
  await db.query("update modelos_email set envio_ligado_em = now() - interval '1 hour' where chave = $1", [CHAVE_1]);
  const pend = await asRole('service_role', () => q("select * from public.crm_sequencia_pendentes(100, now() + interval '10 minutes')"));
  check('as duas pessoas entram na fila do e-mail 1 (serviço, sem exigir o aceite de marketing)', ['Ana Souza', 'Bia Lima'].every((n) => pend.some((r) => r.chave === CHAVE_1 && r.nome === n)));
  const none = await asRole('service_role', () => q("select * from public.crm_sequencia_pendentes(100, now())"));
  check('antes dos 5 minutos ninguém entra na fila', !none.some((r) => r.chave === CHAVE_1));

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
