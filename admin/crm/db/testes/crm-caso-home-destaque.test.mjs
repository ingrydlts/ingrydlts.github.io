// Testa crm-caso-home-destaque.sql (o item em destaque da Página inicial) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-caso-home-destaque.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: e }; } }
async function falha(fn, motivo) { const r = await attempt(fn); return !r.ok && (!motivo || String(r.error.message).includes(motivo)); }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asUser = (id, fn) => asRole('authenticated', id, fn);
const asAnon = (fn) => asRole('anon', null, fn);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const um = async (sql, p) => (await q(sql, p))[0];

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  await db.exec(`
    create schema if not exists storage;
    create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8')); await db.exec(readFileSync(path.resolve(HERE, '../crm-caso-arquivos.sql'), 'utf8'));   // pré-requisitos
  for (const f of ['crm-caso-home.sql', 'crm-caso-home-so-seu.sql', 'crm-caso-fluxo.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));


  const sql = readFileSync(path.resolve(HERE, '../crm-caso-home-destaque.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));

  const home = (p, step) => db.query("insert into caso_home (contato_id, categoria, step_key) values ($1,'checklist',$2)", [p.c, step]);
  await home(ana, 'k1'); await home(ana, 'k2'); await home(bia, 'k9');
  const destaques = async (p) => (await q('select step_key from caso_home where contato_id = $1 and destaque order by step_key', [p.c])).map((r) => r.step_key);
  const meu = async (p) => (await asUser(p.u.id, () => um('select meu_caso() r'))).r;

  console.log('== crm_home_destacar: só admin, um por pessoa ==');
  check('pessoa e anônimo não chamam', !(await attempt(() => asUser(ana.u.id, () => db.query('select crm_home_destacar($1, $2)', [ana.c, 'k1'])))).ok && !(await attempt(() => asAnon(() => db.query('select crm_home_destacar($1, $2)', [ana.c, 'k1'])))).ok);
  check('a pessoa recebe sem_permissao, não só erro genérico', await falha(() => asUser(ana.u.id, () => db.query('select crm_home_destacar($1, $2)', [ana.c, 'k1'])), 'sem_permissao'));
  await adm('select crm_home_destacar($1, $2)', [ana.c, 'k1']);
  check('o admin marca o destaque', JSON.stringify(await destaques(ana)) === '["k1"]');
  await adm('select crm_home_destacar($1, $2)', [ana.c, 'k2']);
  check('marcar outro tira o anterior (só um por pessoa)', JSON.stringify(await destaques(ana)) === '["k2"]');
  check('o destaque de uma pessoa não toca o de outra', JSON.stringify(await destaques(bia)) === '[]');
  await adm('select crm_home_destacar($1, $2)', [bia.c, 'k9']);
  check('cada pessoa tem o seu', JSON.stringify(await destaques(ana)) === '["k2"]' && JSON.stringify(await destaques(bia)) === '["k9"]');
  check('passo que não está na home dá item_invalido e o destaque anterior continua', await falha(() => adm('select crm_home_destacar($1, $2)', [ana.c, 'nao_existe']), 'item_invalido') && JSON.stringify(await destaques(ana)) === '["k2"]');
  check('passo da OUTRA pessoa também é item_invalido', await falha(() => adm('select crm_home_destacar($1, $2)', [ana.c, 'k9']), 'item_invalido') && JSON.stringify(await destaques(ana)) === '["k2"]');
  await adm('select crm_home_destacar($1, $2)', [ana.c, null]);
  check('null limpa o destaque', JSON.stringify(await destaques(ana)) === '[]');

  console.log('\n== Regras da tabela ==');
  check('destaque só vale em linha de checklist (check)', await falha(() => db.query("insert into caso_home (contato_id, categoria, board_id, destaque) select $1, 'so_seu', b.id, true from (select id from board_itens limit 1) b", [ana.c]).then((r) => { if (!r.affectedRows) throw new Error('sem item de board para o teste'); })));
  check('dois destaques da mesma pessoa não passam (índice único)', await falha(() => db.exec(`update caso_home set destaque = true where contato_id = '${ana.c}'`)));
  await db.query("delete from caso_home where contato_id = $1 and step_key = 'k1'", [ana.c]);
  await adm('select crm_home_destacar($1, $2)', [ana.c, 'k2']);
  await db.query("delete from caso_home where contato_id = $1 and step_key = 'k2'", [ana.c]);
  check('tirar o passo da home apaga a linha e o destaque some junto', JSON.stringify(await destaques(ana)) === '[]');

  console.log('\n== meu_caso(): a pessoa recebe o destaque, só o dela ==');
  await home(ana, 'k3'); await home(ana, 'k4'); await adm('select crm_home_destacar($1, $2)', [ana.c, 'k3']);
  const ca = await meu(ana), cb = await meu(bia);
  const ha = (ca.home || []).find((h) => h.step_key === 'k3'), hb = (ca.home || []).find((h) => h.step_key === 'k4');
  check('a home dela traz destaque = true no passo marcado', ha && ha.destaque === true);
  check('o passo não marcado traz destaque = false', hb && hb.destaque === false);
  check('uma pessoa nunca vê o destaque (nem o passo) da outra', !(ca.home || []).some((h) => h.step_key === 'k9') && !(cb.home || []).some((h) => h.step_key === 'k3'));

  console.log('\n== Permissões das funções ==');
  const ex = async (fn) => (await q(`select has_function_privilege('anon', '${fn}', 'execute') a, has_function_privilege('public', '${fn}', 'execute') p, has_function_privilege('authenticated', '${fn}', 'execute') u`))[0];
  const e1 = await ex('crm_home_destacar(uuid, text)');
  check('crm_home_destacar: anon e public sem EXECUTE; authenticated com (o teste de admin está dentro)', !e1.a && !e1.p && e1.u);
  const sec = (await q("select prosecdef, proconfig::text c from pg_proc where proname in ('crm_home_destacar') ")).every((r) => r.prosecdef && /search_path/.test(r.c));
  check('security definer com search_path fixo', sec);
  const mc = await ex('meu_caso()');
  check('meu_caso continua sem EXECUTE para anon', !mc.a && !mc.p && mc.u);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
