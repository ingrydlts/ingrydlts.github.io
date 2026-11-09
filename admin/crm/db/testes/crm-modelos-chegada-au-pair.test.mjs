// Testa crm-modelos-chegada-au-pair.sql (os 2 e-mails do guia "Checklist de chegada da au pair") num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:chegada
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';
import { gerar, CHAVE_1, CHAVE_2, ORIGEM } from '../modelo-chegada-au-pair.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;

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

  console.log('\n== crm-modelos-chegada-au-pair.sql ==');
  const sql = gerar();
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro e não duplica', r2.ok && (await q('select count(*)::int n from modelos_email_versoes where chave in ($1, $2)', [CHAVE_1, CHAVE_2]))[0].n === 2);
  const ms = await q('select * from modelos_email where chave in ($1, $2) order by chave', [CHAVE_1, CHAVE_2]);
  const [m1, m2] = ms;
  check('dois modelos novos do estúdio, com o Envio DESLIGADO', ms.length === 2 && ms.every((m) => m.criado_no_estudio && m.envio_ligado === false));
  check('e-mail 1: serviço, freebie, 5 minutos depois de pegar o guia', m1.tipo === 'servico' && m1.objetivo_chave === 'freebie' && m1.envio_gatilho === 'material' && m1.envio_depois_de === ORIGEM && m1.envio_minutos === 5);
  check('e-mail 2: novidades, 2 dias depois do e-mail 1, às 10h', m2.tipo === 'novidades' && m2.envio_gatilho === 'email' && m2.envio_depois_de === CHAVE_1 && m2.envio_dias === 2 && m2.envio_hora === 10);
  check('Para quem: só quem pegou este guia', ms.every((m) => JSON.stringify(m.para_quem) === JSON.stringify({ materiais: [ORIGEM] })));
  const vs = await q('select * from modelos_email_versoes where chave in ($1, $2) order by chave', [CHAVE_1, CHAVE_2]);
  check('uma versão 1 de cada, em rascunho (nada publicado)', vs.length === 2 && vs.every((v) => v.versao === 1 && v.etapa === 'rascunho'));
  const [v1, v2] = vs;
  const tudo1 = v1.assunto + v1.preheader + v1.corpo_texto + v1.corpo_html;
  check('e-mail 1 NÃO fala do app beta (pedido dela)', !/beta|login|senha|link_acesso|acesso grátis/i.test(tudo1));
  check('e-mail 1 leva o botão para o checklist e a pergunta do passo mais pesado', v1.corpo_html.includes('app.notion.com') && /passo está mais pesado/.test(v1.corpo_texto));
  check('e-mail 2 oferece o beta gratuito e o botão usa link_acesso', /beta/i.test(v2.corpo_texto) && /gratuito/.test(v2.corpo_texto) && JSON.stringify(v2.blocos).includes('link_acesso'));
  check('sem travessão nos blocos que ela escreve (o rodapé do estúdio tem o seu separador)', !/[—–]/.test(vs.map((v) => v.assunto + JSON.stringify(v.blocos)).join('')));
  check('sem marcador de conferência no texto', !/\[[^\]]+\]/.test((v1.corpo_texto + v2.corpo_texto).replace(/\{[^}]*\}/g, '')));
  check('só usa dados que cada modelo oferece', ms.every((m, i) => {
    const oferecidos = ES.varsDoModelo(m.chave, { chave: m.chave, criado_no_estudio: true, tipo: m.tipo, para_quem: m.para_quem });
    const usados = [...(vs[i].assunto + vs[i].corpo_texto + vs[i].corpo_html).matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]).filter((k) => !['assunto', 'pre'].includes(k));
    return usados.every((k) => oferecidos.includes(k));
  }));
  check('nenhum outro modelo mudou', JSON.stringify(modelosAntes) === JSON.stringify((await q('select * from modelos_email order by chave')).filter((m) => ![CHAVE_1, CHAVE_2].includes(m.chave))));

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
