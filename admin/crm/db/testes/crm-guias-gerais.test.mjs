// Testa crm-guias-gerais.sql (esconder, ordenar e conferir os passos do checklist, por pessoa) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-guias-gerais.test.mjs
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
  const sql = readFileSync(path.resolve(HERE, '../crm-guias-gerais.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  const g = (k, extra = {}) => db.query('insert into guias_gerais (step_key, por_que, atencao, passos, links, estado) values ($1,$2,$3,$4::jsonb,$5::jsonb,$6) on conflict (step_key) do update set estado = excluded.estado, passos = excluded.passos, links = excluded.links',
    [k, extra.por_que ?? 'Porque sim', extra.atencao ?? null, JSON.stringify(extra.passos ?? ['Abra o portal']), JSON.stringify(extra.links ?? [{ url: 'https://exemplo.gouv.fr/a', rotulo: 'Portal' }]), extra.estado ?? 'rascunho']);

  console.log('== Só admin lê e escreve ==');
  check('RLS ligada, uma política (admin)', (await um("select relrowsecurity r from pg_class where oid = 'public.guias_gerais'::regclass")).r && (await q("select 1 from pg_policy where polrelid = 'public.guias_gerais'::regclass")).length === 1);
  check('admin grava', (await attempt(() => asUser(admin.id, () => g('visa_x', { estado: 'publicado' })))).ok);
  check('pessoa comum não lê a tabela (0 linhas)', (await asUser(ana.id, () => q('select * from guias_gerais'))).length === 0);
  check('pessoa comum não grava', await falha(() => asUser(ana.id, () => g('visa_y'))));
  check('anon não lê a tabela', await falha(() => asAnon(() => q('select * from guias_gerais'))));
  check('anon não chama guias_gerais_publicos()', await falha(() => asAnon(() => q('select guias_gerais_publicos()'))));

  console.log('== O que o app recebe ==');
  await asUser(admin.id, async () => { await g('visa_r', { estado: 'rascunho', por_que: 'segredo de rascunho' }); });
  const pub = (await asUser(ana.id, () => um('select guias_gerais_publicos() r'))).r;
  check('só publicados, sem rascunho', pub.length === 1 && pub[0].step_key === 'visa_x');
  check('só os campos do guia (sem autor, estado nem data)', Object.keys(pub[0]).sort().join() === 'atencao,links,passos,por_que,step_key' && !JSON.stringify(pub).includes('segredo'));

  console.log('== Validação no banco ==');
  const ruim = (extra) => falha(() => asUser(admin.id, () => g('visa_z', extra)));
  check('mais de 8 passos', await ruim({ passos: Array(9).fill('a') }));
  check('passo longo demais (221)', await ruim({ passos: ['a'.repeat(221)] }));
  check('passo que não é texto', await ruim({ passos: [1] }));
  check('link http (só https)', await ruim({ links: [{ url: 'http://x.org/a' }] }));
  check('link javascript:', await ruim({ links: [{ url: 'javascript:alert(1)' }] }));
  check('mais de 6 links', await ruim({ links: Array(7).fill({ url: 'https://x.org/a' }) }));
  check('por_que acima de 400', await falha(() => asUser(admin.id, () => g('visa_z', { por_que: 'a'.repeat(401) }))));
  check('step_key inválida', await falha(() => asUser(admin.id, () => g('com espaço'))));
  check('estado inválido', await falha(() => asUser(admin.id, () => g('visa_z', { estado: 'x' }))));

  console.log('== Funções ==');
  for (const f of ['guias_gerais_publicos()', 'guia_passos_ok(jsonb)', 'guia_links_ok(jsonb)'])
    check(f + ': anon sem EXECUTE', !(await um(`select has_function_privilege('anon', 'public.${f}', 'execute') p`)).p);
  check('security definer com search_path fixo', (await um("select prosecdef d, proconfig::text c from pg_proc where proname = 'guias_gerais_publicos'")).c.includes('search_path'));

  console.log(failed ? `\n${failed} falharam, ${passed} passaram` : `\n${passed} passaram, 0 falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
