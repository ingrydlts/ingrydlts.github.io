// Testa crm-aviso-reordenar.sql (arrastar para mudar a ordem das perguntas da equipe) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-aviso-reordenar.test.mjs
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


  const sql = readFileSync(path.resolve(HERE, '../crm-aviso-reordenar.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));

  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [ana.c]);
  const aviso = async (p, titulo, estado, extra = {}) => {   // todo aviso nasce como rascunho; aprovar exige consentimento (Ana tem; a Bia não precisa: o dela fica rascunho)
    const id = (await um("insert into caso_avisos (contato_id, tipo, titulo, estado, pausa_dias) values ($1,'proposta',$2,'rascunho',$3) returning id", [p.c, titulo, extra.pausa ?? 1])).id;
    if (estado !== 'rascunho') await db.query('update caso_avisos set estado = $2, liberado_em = $3 where id = $1', [id, estado, extra.liberado ?? null]);
    return id;
  };
  const ordemDe = async (p) => (await q("select titulo from caso_avisos where contato_id = $1 order by ordem, id", [p.c])).map((r) => r.titulo);
  const jaSaiu = await aviso(ana, 'Já saiu', 'liberado', { liberado: new Date().toISOString() });
  const a1 = await aviso(ana, 'A', 'agendado'), a2 = await aviso(ana, 'B', 'agendado', { pausa: 2 }), a3 = await aviso(ana, 'C', 'rascunho'), a4 = await aviso(ana, 'D', 'agendado', { pausa: 3 });
  const b1 = await aviso(bia, 'Da Bia', 'rascunho');
  const reordena = (p, ids) => adm('select crm_aviso_reordenar($1, $2::bigint[])', [p.c, ids]);

  console.log('== crm_aviso_reordenar ==');
  check('estado inicial: Já saiu, A, B, C, D', JSON.stringify(await ordemDe(ana)) === '["Já saiu","A","B","C","D"]');
  await reordena(ana, [a4, a2, a1, a3]);
  check('muda a ordem do que ainda não saiu: D, B, A, C (o que já saiu fica na frente)', JSON.stringify(await ordemDe(ana)) === '["Já saiu","D","B","A","C"]');
  check('as vagas são as mesmas de antes (nenhuma ordem nova, nenhuma repetida)', JSON.stringify((await q('select ordem from caso_avisos where contato_id = $1 order by ordem', [ana.c])).map((r) => r.ordem)) === JSON.stringify([1, 2, 3, 4, 5]));
  const datas = await q("select titulo, liberar_em from caso_avisos where contato_id = $1 and estado = 'agendado' order by ordem", [ana.c]);
  check('a fila foi recalculada (reencadear rodou sem erro)', datas.length === 3);
  await reordena(ana, [a1, a2, a4, a3]);
  check('dá para reordenar de novo', JSON.stringify(await ordemDe(ana)) === '["Já saiu","A","B","D","C"]');

  console.log('\n== Quem pode e o que recusa ==');
  check('pessoa e anônimo não reordenam', !(await attempt(() => asUser(ana.u.id, () => db.query('select crm_aviso_reordenar($1, $2::bigint[])', [ana.c, [a1, a2]])))).ok && !(await attempt(() => asAnon(() => db.query('select crm_aviso_reordenar($1, $2::bigint[])', [ana.c, [a1, a2]])))).ok);
  check('aviso que já saiu: aviso_ja_saiu', await falha(() => reordena(ana, [jaSaiu, a1]), 'aviso_ja_saiu'));
  check('aviso de OUTRA pessoa: ordem_invalida (e nada muda)', await falha(() => reordena(ana, [a1, b1]), 'ordem_invalida') && JSON.stringify(await ordemDe(bia)) === '["Da Bia"]');
  check('lista vazia ou com repetidos: ordem_invalida', await falha(() => reordena(ana, []), 'ordem_invalida') && await falha(() => reordena(ana, [a1, a1]), 'ordem_invalida'));
  check('depois dos erros, a ordem de Ana segue a mesma', JSON.stringify(await ordemDe(ana)) === '["Já saiu","A","B","D","C"]');

  console.log('\n== Permissões da função ==');
  const e = (await q("select has_function_privilege('anon', 'crm_aviso_reordenar(uuid, bigint[])', 'execute') a, has_function_privilege('public', 'crm_aviso_reordenar(uuid, bigint[])', 'execute') p, has_function_privilege('authenticated', 'crm_aviso_reordenar(uuid, bigint[])', 'execute') u"))[0];
  check('anon e public sem EXECUTE; authenticated com (o teste de admin fica dentro da função)', !e.a && !e.p && e.u);
  const sec = (await q("select prosecdef, proconfig::text c from pg_proc where proname = 'crm_aviso_reordenar'"))[0];
  check('security definer com search_path fixo', sec.prosecdef && /search_path/.test(sec.c));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
