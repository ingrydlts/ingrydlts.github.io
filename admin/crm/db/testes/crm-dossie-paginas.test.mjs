// Testa crm-dossie-paginas.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (repositório POR-DENTRO-APP),
// da fase 2 do CRM, do crm-dossie.sql e do crm-pos-call.sql. Não toca no Supabase real. Pessoas fictícias.
//
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:dossie-paginas
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
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-dossie.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-pos-call.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-dossie-paginas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  await db.query("insert into contatos (email) values ('bia@example.com') on conflict (email) do nothing");
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const salvar = (id, dados, quem = admin.id) => asUser(quem, () => db.query('select crm_salvar_dossie($1, $2) as d', [id, JSON.stringify(dados)]));
  const dossie = async (id) => (await q('select dossie from contatos where id=$1', [id]))[0].dossie;

  console.log('\n== As cinco chaves das páginas de entrada ==');
  const chaves = { etapa_i01: 'alt-buscando-empresa', etapa_i02: 'tec-nao-sei', etapa_i03: 'cf-escolhendo-curso', etapa_i04: 'vls-30-60', etapa_i05: 'ap-travado' };
  const r = await attempt(() => salvar(cBia.id, chaves));
  check('o admin salva as cinco etapas de uma vez', r.ok); if (!r.ok) console.log(r.error.message);
  const d = await dossie(cBia.id);
  check('as cinco etapas ficam no dossiê', Object.keys(chaves).every((k) => d[k] === chaves[k]));
  check('null apaga a etapa de uma página', (await attempt(() => salvar(cBia.id, { etapa_i02: null }))).ok && !('etapa_i02' in (await dossie(cBia.id))));
  check('valor que não é texto é recusado', !(await attempt(() => salvar(cBia.id, { etapa_i01: 5 }))).ok);
  check('texto longo demais é recusado', !(await attempt(() => salvar(cBia.id, { etapa_i03: 'x'.repeat(301) }))).ok);

  console.log('\n== O que continua como antes ==');
  check('as chaves antigas seguem funcionando (cidade, cfNivel e a das sinais da call)', (await attempt(() => salvar(cBia.id, { cidade: 'Lyon', cfNivel: 'master', formacao_alvo: 'bts' }))).ok);
  check('chave desconhecida segue recusada', !(await attempt(() => salvar(cBia.id, { etapa_i06: 'x' }))).ok);
  check('a validação das sinais da call não se perdeu', !(await attempt(() => salvar(cBia.id, { formacao_alvo: 'inventada' }))).ok);
  check('pessoa logada não salva dossiê', !(await attempt(() => salvar(cBia.id, { etapa_i05: 'ap-travado' }, ana.id))).ok);
  check('anon não salva dossiê', !(await attempt(() => asAnon(() => db.query("select crm_salvar_dossie($1, '{}')", [cBia.id])))).ok);
  const perm = await q("select has_function_privilege('anon', 'public.crm_salvar_dossie(uuid, jsonb)', 'execute') as anon, has_function_privilege('authenticated', 'public.crm_salvar_dossie(uuid, jsonb)', 'execute') as logada");
  check('anon sem EXECUTE e logada com EXECUTE (a função decide por eh_admin)', perm[0].anon === false && perm[0].logada === true);
  const def = (await q("select prosecdef, array_to_string(proconfig, ',') as cfg from pg_proc where proname='crm_salvar_dossie'"))[0];
  check('segue security definer, com search_path fixo', def.prosecdef === true && /search_path=public, pg_temp/.test(def.cfg));

  console.log('\n' + (failed ? failed + ' FALHARAM, ' : '') + passed + ' passaram' + (failed ? '' : ', 0 falharam'));
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
