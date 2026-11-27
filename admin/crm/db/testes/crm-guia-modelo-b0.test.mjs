// Testa crm-guia-modelo-b0.sql (o e-mail B0 do modelo grátis de mudança de endereço) num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Não toca no Supabase real. pg_net e Vault não existem no PGlite: o teste cria
// versões falsas que só anotam a chamada.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:b0
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asRole(role, fn) {
  await db.exec(`set role ${role};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
const asAnon = (fn) => asRole('anon', fn);
const GUIA = 'modelo-mudanca-endereco-mesma-cidade';

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
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql', 'crm-saude-porta-ponto.sql', 'crm-taxonomia-modelos.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const sql = readFileSync(path.resolve(HERE, '../crm-guia-modelo-b0.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  console.log('\n== O modelo no Estúdio ==');
  const [m] = await q("select * from modelos_email where chave = 'guia_modelo_b0'");
  check('modelo criado: serviço e automático', m && m.tipo === 'servico' && m.automatico === true && m.criado_no_estudio === false);
  check('classificado como entrega', m && m.familia === 'entrega');
  const vs = await q("select * from modelos_email_versoes where chave = 'guia_modelo_b0'");
  check('uma versão 1 No ar (e só uma, mesmo rodando 2x)', vs.length === 1 && vs[0].versao === 1 && vs[0].etapa === 'no_ar');
  const t = vs[0]?.corpo_texto || '';
  check('a carta em francês, com campos em ___', t.includes("Objet : Changement d'adresse au sein de la même commune") && t.includes('___'));
  check('sem [colchetes] e sem rodapé de descadastro', !/\[[^\]\n]{2,60}\]/.test(vs[0].assunto + t) && !/palavra\s+"?sair/i.test(t));
  const usados = [...(vs[0].assunto + t).matchAll(/\{[#^/]?(\w+)\}/g)].map((x) => x[1]);
  check('só usa as variáveis declaradas (nome, email)', usados.every((k) => ['nome', 'email'].includes(k)));
  const vars = m.variaveis.map((v) => v.nome);
  check('as variáveis do modelo são nome e email', JSON.stringify(vars) === JSON.stringify(['nome', 'email']));

  console.log('\n== Cadastro no modelo grátis: pede o B0 ao Worker ==');
  await db.exec(`
    create schema net; create schema vault;
    create table net.chamadas (url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql
      as $$ insert into net.chamadas values (url, body, headers); select 1::bigint $$;
    create table vault.decrypted_secrets (name text, decrypted_secret text);
  `);
  const lead = (extra) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: GUIA, email: 'ana@example.com', nome: 'Ana', origem: 'manual-destrave-domiciliacao',
    aceita_servico: true, aceita_novidades: false, consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.', ...extra })]));

  let r = await attempt(() => lead({}));
  check('cadastro passa sem Vault (desligado)', r.ok); if (!r.ok) console.log(r.error.message);
  check('sem segredos no Vault: não chama', (await q('select * from net.chamadas')).length === 0);
  await db.exec(`insert into vault.decrypted_secrets values ('crm_worker_url', 'https://worker.example.com/'),
    ('crm_hook_secret', 'segredo-de-teste-com-mais-de-24-caracteres')`);
  await lead({});
  const [ana] = await q("select id from contatos where email = 'ana@example.com'");
  let ch = await q('select * from net.chamadas');
  check('chama a rota do Worker uma vez, com contato e guia', ch.length === 1 && ch[0].url === 'https://worker.example.com/api/crm/guia-capturado'
    && ch[0].body.contato_id === ana.id && ch[0].body.guia === GUIA);
  check('manda o segredo no cabeçalho', ch[0]?.headers['X-Crm-Hook'] === 'segredo-de-teste-com-mais-de-24-caracteres');

  await lead({ email: 'bia@example.com', nome: 'Bia', aceita_novidades: true });
  check('quem marcou a caixa de marketing também recebe o B0', (await q('select * from net.chamadas')).length === 2);

  await lead({ email: 'cris@example.com', guia: 'vls-ts-validacao-travou', origem: 'guia-vls-ts' });
  check('outro guia sem e-mail não chama', (await q('select * from net.chamadas')).length === 2);
  await lead({ email: 'dani@example.com', guia: 'etudes-en-france-2027-2028', origem: 'guia-etudes-en-france-2027' });
  const chs = await q('select * from net.chamadas order by body->>\'guia\'');
  check('o e-mail 1 do Campus France continua saindo', chs.length === 3 && chs.some((c) => c.body.guia === 'etudes-en-france-2027-2028'));

  console.log('\n== Um B0 por pessoa ==');
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, provedor_id) values ($1, 'guia_modelo_b0', 'Teste', 'agendado', '<b0-1@smtp.example.com>')", [ana.id]);
  await lead({});
  check('quem já recebeu não pede de novo', (await q('select * from net.chamadas')).length === 3);
  const dup = await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'guia_modelo_b0', 'agendado')", [ana.id]));
  check('índice barra um 2º B0 para a mesma pessoa', !dup.ok);
  const outro = await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_1', 'agendado')", [ana.id]));
  check('outros modelos da mesma pessoa continuam possíveis', outro.ok);

  console.log('\n== Segurança ==');
  check('anon não chama crm_guia_email_pedir direto',
    !(await attempt(() => asAnon(() => db.query('select crm_guia_email_pedir($1, $2)', [ana.id, GUIA])))).ok);
  check('anon não lê os modelos de e-mail', await asAnon(async () => (await attempt(() => db.query('select * from modelos_email'))).value?.rows.length ?? 0) === 0);

  await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql
      as $$ begin raise exception 'pg_net fora do ar'; end $$;`);
  r = await attempt(() => lead({ email: 'eva@example.com' }));
  check('pg_net com erro não derruba o cadastro', r.ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
