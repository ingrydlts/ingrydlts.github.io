// Testa crm-caso-home.sql + crm-caso-home-so-seu.sql (destaques da Página inicial: tabela, limites 3/3/2, categorias e meu_caso) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-caso-home.test.mjs
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
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-home.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [ana.c]); // a Bia NÃO consentiu
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));
  const lista = (p, chave, titulo, origem = 'particular') => um('insert into caso_listas (contato_id, chave, titulo, origem) values ($1,$2,$3,$4) returning id', [p.c, chave, titulo, origem]);
  const acao = (p, titulo, extra = {}) => um(`insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, publicada_em, lista_chave, camada) values ($1,$2,'ela','plataforma',$3, now(), $4, $5) returning id`,
    [p.c, titulo, extra.passo ?? ('p_' + Math.random().toString(36).slice(2, 8)), extra.lista ?? null, extra.camada ?? null]);
  const meu = async (p) => (await asUser(p.u.id, () => um('select meu_caso() r'))).r;

  const bi = (p, tipo, estado = 'revisado', dados = '{}') => um("insert into board_itens (contato_id, tipo, titulo, dados, estado) values ($1,$2,'T', $3, $4) returning id", [p.c, tipo, dados, estado]).then((r) => r.id);
  const home = (p, cat, extra = {}) => db.query('insert into caso_home (contato_id, categoria, step_key, board_id) values ($1,$2,$3,$4)', [p.c, cat, extra.step ?? null, extra.board ?? null]);
  const pub = (id) => db.query("update board_itens set estado = 'publicado' where id = $1", [id]);

  console.log('== A tabela: só admin ==');
  check('RLS ligada e uma só política, a do admin', (await um("select relrowsecurity r from pg_class where oid = 'public.caso_home'::regclass")).r && (await q("select 1 from pg_policy where polrelid = 'public.caso_home'::regclass")).length === 1);
  check('anônimo e pessoa não leem nem gravam pela tabela', !(await attempt(() => asAnon(() => q('select * from caso_home')))).ok && (await asUser(ana.u.id, () => q('select * from caso_home'))).length === 0 && !(await attempt(() => asUser(ana.u.id, () => db.query("insert into caso_home (contato_id, categoria, step_key) values ($1,'checklist','x')", [ana.c])))).ok);
  check('o admin grava', (await attempt(() => asUser(admin.id, () => db.query("insert into caso_home (contato_id, categoria, step_key) values ($1,'checklist','k0')", [ana.c])))).ok);
  await db.query('delete from caso_home');

  console.log('\n== A migração (crm-caso-home-so-seu.sql): espaco sai, bilan de guias vira so_seu ==');
  const mig = readFileSync(path.resolve(HERE, '../crm-caso-home-so-seu.sql'), 'utf8');
  const e0 = await bi(ana, 'escola'), b0 = await bi(ana, 'bilan'), d0 = await bi(ana, 'documento');
  await home(ana, 'espaco', { board: e0 }); await home(ana, 'guias', { board: b0 }); await home(ana, 'guias', { board: d0 });
  const r2 = await attempt(() => db.exec(mig)); check('roda a 1ª vez', r2.ok); if (!r2.ok) { console.log(r2.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(mig))).ok);
  check('"espaco" foi apagado; o bilan virou so_seu; o documento continua em guias; o item do board continua existindo', (await q("select 1 from caso_home where categoria = 'espaco'")).length === 0
    && (await q("select 1 from caso_home where categoria = 'so_seu' and board_id = $1", [b0])).length === 1 && (await q("select 1 from caso_home where categoria = 'guias' and board_id = $1", [d0])).length === 1 && (await q('select 1 from board_itens where id = $1', [e0])).length === 1);
  check('"espaco" não entra mais', await falha(() => home(ana, 'espaco', { board: e0 })));
  await db.query('delete from caso_home');

  console.log('\n== Limites 3 / 3 / 2 (no banco, não só na tela) ==');
  for (const k of ['a', 'b', 'c']) await home(ana, 'checklist', { step: k });
  check('checklist: 3 cabem, o 4º não ("home_cheia")', await falha(() => home(ana, 'checklist', { step: 'd' }), 'home_cheia'));
  const rec = '{"direcao":"recebe"}';
  const s1 = await bi(ana, 'bilan'), s2 = await bi(ana, 'documento', 'revisado', rec), s3 = await bi(ana, 'documento', 'revisado', rec), s4 = await bi(ana, 'documento', 'revisado', rec);
  await home(ana, 'so_seu', { board: s1 }); await home(ana, 'so_seu', { board: s2 }); await home(ana, 'so_seu', { board: s3 });
  check('só seu: 3 cabem, o 4º não', await falha(() => home(ana, 'so_seu', { board: s4 }), 'home_cheia'));
  const g1 = await bi(ana, 'documento'), g2 = await bi(ana, 'modelo'), g3 = await bi(ana, 'modelo');
  await home(ana, 'guias', { board: g1 }); await home(ana, 'guias', { board: g2 });
  check('guias: 2 cabem, o 3º não', await falha(() => home(ana, 'guias', { board: g3 }), 'home_cheia'));
  check('o limite é por pessoa: a Bia tem o seu', (await attempt(() => home(bia, 'checklist', { step: 'a' }))).ok);
  check('o mesmo passo não entra duas vezes', await falha(() => home(bia, 'checklist', { step: 'a' })));

  console.log('\n== Item da categoria certa, da mesma pessoa ==');
  const doc = await bi(bia, 'documento'), docRec = await bi(bia, 'documento', 'revisado', rec), esc = await bi(bia, 'escola'), mod = await bi(bia, 'modelo'), bil = await bi(bia, 'bilan'), deAna = await bi(ana, 'bilan');
  check('só seu aceita bilan e encaminhamento (documento que ela recebe); recusa documento comum, mensagem e escola', (await attempt(() => home(bia, 'so_seu', { board: bil }))).ok && (await attempt(() => home(bia, 'so_seu', { board: docRec }))).ok
    && await falha(() => home(bia, 'so_seu', { board: doc }), 'item_invalido') && await falha(() => home(bia, 'so_seu', { board: mod }), 'item_invalido') && await falha(() => home(bia, 'so_seu', { board: esc }), 'item_invalido'));
  check('guias aceita documento e mensagem pronta; recusa bilan e escola', await falha(() => home(bia, 'guias', { board: bil }), 'item_invalido') && await falha(() => home(bia, 'guias', { board: esc }), 'item_invalido')
    && (await attempt(() => home(bia, 'guias', { board: doc }))).ok && (await attempt(() => home(bia, 'guias', { board: mod }))).ok);
  check('item de OUTRA pessoa não entra', await falha(() => home(bia, 'so_seu', { board: deAna }), 'item_invalido'));
  check('forma da linha: checklist exige step_key; board exige board_id', await falha(() => db.query("insert into caso_home (contato_id, categoria) values ($1,'checklist')", [bia.c])) && await falha(() => db.query("insert into caso_home (contato_id, categoria, step_key) values ($1,'guias','x')", [bia.c])));
  await db.query('delete from caso_home where contato_id = $1 and categoria <> $2', [bia.c, 'checklist']);

  console.log('\n== O que a pessoa recebe ==');
  let m = (await asUser(ana.u.id, () => um('select meu_caso() r'))).r;
  check('só o checklist vem (os itens do board ainda não foram publicados)', m.home.length === 3 && m.home.every((x) => x.categoria === 'checklist'));
  await pub(s1); await pub(g1);
  m = (await asUser(ana.u.id, () => um('select meu_caso() r'))).r;
  check('publicado: o do Só seu e o dos Guias entram; o não publicado continua fora', m.home.filter((x) => x.categoria === 'so_seu').length === 1 && m.home.filter((x) => x.categoria === 'guias').length === 1 && m.home.length === 5);
  const mb = (await asUser(bia.u.id, () => um('select meu_caso() r'))).r.home;
  check('a Bia só vê o dela (1 passo do checklist), nada da Ana', mb.length === 1 && mb[0].categoria === 'checklist' && mb[0].step_key === 'a' && mb.every((x) => !x.board_id));
  check('apagar o item do board apaga o destaque', (await db.query('delete from board_itens where id = $1', [g2]), (await q('select 1 from caso_home where board_id = $1', [g2])).length === 0));
  check('meu_caso() mantém o resto (descricao e arquivo do documento)', m.board.length >= 1 && 'descricao' in m.board[0] && 'arquivo' in m.board[0]);
  check('meu_caso: anônimo não executa', await falha(() => asAnon(() => q('select meu_caso()'))));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
