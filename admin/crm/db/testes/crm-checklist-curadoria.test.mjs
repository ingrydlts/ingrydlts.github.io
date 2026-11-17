// Testa crm-checklist-curadoria.sql (esconder, ordenar e conferir os passos do checklist, por pessoa) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-checklist-curadoria.test.mjs
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
  const sql = readFileSync(path.resolve(HERE, '../crm-checklist-curadoria.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const cur = (p, k, extra = {}) => db.query('insert into checklist_curadoria (contato_id, step_key, oculto, ordem, conferido_em) values ($1,$2,$3,$4,$5)', [p.c, k, extra.oculto ?? false, extra.ordem ?? null, extra.conf ?? null]);
  const minha = async (p) => (await asUser(p.u.id, () => um('select minha_curadoria() r'))).r;

  console.log('== A tabela: só admin ==');
  check('RLS ligada e uma só política, a do admin', (await um("select relrowsecurity r from pg_class where oid = 'public.checklist_curadoria'::regclass")).r && (await q("select 1 from pg_policy where polrelid = 'public.checklist_curadoria'::regclass")).length === 1);
  await cur(ana, 'k1', { oculto: true });
  check('anônimo não lê nem grava; a pessoa não lê (nem o que é dela) nem grava pela tabela', !(await attempt(() => asAnon(() => q('select * from checklist_curadoria')))).ok && (await asUser(ana.u.id, () => q('select * from checklist_curadoria'))).length === 0 && !(await attempt(() => asUser(ana.u.id, () => db.query("insert into checklist_curadoria (contato_id, step_key) values ($1,'x')", [ana.c])))).ok && (await asUser(ana.u.id, () => db.query("update checklist_curadoria set oculto = false where contato_id = $1", [ana.c]))).affectedRows === 0 && (await um("select oculto from checklist_curadoria where step_key = 'k1'")).oculto === true);
  check('o admin lê e grava', (await asUser(admin.id, () => q('select * from checklist_curadoria'))).length === 1 && (await attempt(() => asUser(admin.id, () => db.query("insert into checklist_curadoria (contato_id, step_key, ordem) values ($1,'k2',3)", [ana.c])))).ok);
  await db.query('delete from checklist_curadoria');

  console.log('\n== Regras da linha ==');
  check('uma linha por pessoa e passo (a chave é única)', (await attempt(() => cur(ana, 'a'))).ok && !(await attempt(() => cur(ana, 'a'))).ok && (await attempt(() => cur(bia, 'a'))).ok);
  check('step_key só aceita o formato seguro (sem espaço, sem aspas, até 80)', !(await attempt(() => cur(ana, 'tem espaço'))).ok && !(await attempt(() => cur(ana, "x'y"))).ok && !(await attempt(() => cur(ana, 'a'.repeat(81)))).ok && (await attempt(() => cur(ana, 'aco:12'))).ok);
  check('ordem fica entre 0 e 999', !(await attempt(() => cur(ana, 'o1', { ordem: -1 }))).ok && !(await attempt(() => cur(ana, 'o2', { ordem: 1000 }))).ok && (await attempt(() => cur(ana, 'o3', { ordem: 999 }))).ok);
  check('apagar a pessoa apaga a curadoria dela (on delete cascade)', await (async () => { const cai = await nova('cai@example.com'); await db.query("insert into checklist_curadoria (contato_id, step_key) values ($1,'z')", [cai.c]); await db.query('delete from contatos where id = $1', [cai.c]); return (await q('select 1 from checklist_curadoria where contato_id = $1', [cai.c])).length === 0; })());
  await db.query('delete from checklist_curadoria');

  console.log('\n== O que a pessoa recebe (minha_curadoria) ==');
  await cur(ana, 'esc', { oculto: true }); await cur(ana, 'p2', { ordem: 2 }); await cur(ana, 'p1', { ordem: 1 }); await cur(ana, 'so_conf', { conf: new Date().toISOString() }); await cur(bia, 'da_bia', { oculto: true, ordem: 0 });
  const m = await minha(ana);
  check('só o que muda algo: escondidos e com ordem; quem só foi conferido não aparece', m.map((x) => x.step_key).sort().join() === 'esc,p1,p2');
  check('vem ordenado: primeiro os com ordem (1, 2), depois os sem ordem', m.map((x) => x.step_key).join() === 'p1,p2,esc');
  check('nunca traz "conferido" nem o dono: só step_key, oculto e ordem', m.every((x) => Object.keys(x).sort().join() === 'oculto,ordem,step_key'));
  check('só a dela: a linha da Bia não vem para a Ana, e a Bia só recebe a sua', !m.some((x) => x.step_key === 'da_bia') && (await minha(bia)).map((x) => x.step_key).join() === 'da_bia');
  check('quem não tem curadoria recebe lista vazia (não null)', await (async () => { const cris = await nova('cris@example.com'); const r = await minha(cris); return Array.isArray(r) && r.length === 0; })());
  check('anônimo não executa a função', !(await attempt(() => asAnon(() => q('select minha_curadoria()')))).ok);
  check('a função é security definer com search_path fixo e fora do público', (await um("select prosecdef d, proconfig c from pg_proc where proname = 'minha_curadoria'")).d === true && /search_path/.test(String((await um("select proconfig c from pg_proc where proname = 'minha_curadoria'")).c)));

  console.log('\n' + (failed ? 'FALHOU: ' : '') + passed + ' passaram, ' + failed + ' falharam');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
