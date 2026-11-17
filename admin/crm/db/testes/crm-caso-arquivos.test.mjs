// Testa crm-caso-arquivos.sql (descrição longa e arquivo do documento, bucket privado) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-caso-arquivos.test.mjs
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8'));   // pré-requisito: meu_caso() com as listas
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-arquivos.sql'), 'utf8');
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

  console.log('== A coluna e o bucket ==');
  const b = await um("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'casos-arquivos'");
  check('bucket privado, 10 MB, só PDF/MD/texto', b && b.public === false && Number(b.file_size_limit) === 10485760 && b.allowed_mime_types.join() === 'application/pdf,text/markdown,text/plain');
  const doc = async (p, extra = {}) => um(`insert into board_itens (contato_id, tipo, titulo, dados, estado, arquivo_caminho, descricao) values ($1,'documento','Guia', '{"direcao":"recebe","rotulo":"Guia"}', $2, $3, $4) returning id`,
    [p.c, extra.estado || 'revisado', extra.arq ?? null, extra.desc ?? null]);
  check('descrição de 8000 cabe; 8001 não', (await attempt(() => doc(ana, { desc: 'x'.repeat(8000) }))).ok && !(await attempt(() => doc(ana, { desc: 'x'.repeat(8001) }))).ok);

  console.log('\n== Quem abre o arquivo ==');
  const arqAna = ana.c + '/aaaa-guia.pdf', arqBia = bia.c + '/bbbb-guia.pdf';
  const dAna = await doc(ana, { arq: arqAna, desc: 'Texto do e-mail' }), dBia = await doc(bia, { arq: arqBia });
  await db.query("insert into storage.objects (bucket_id, name) values ('casos-arquivos', $1), ('casos-arquivos', $2)", [arqAna, arqBia]);
  const nomes = (p) => asUser(p.u.id, () => q("select name from storage.objects where bucket_id = 'casos-arquivos' order by name")).then((r) => r.map((x) => x.name));
  check('item ainda não publicado: nem a dona abre', (await nomes(ana)).length === 0);
  await adm('update board_itens set estado = $2 where id = $1', [dAna.id, 'revisado']);
  await db.exec('reset role');
  await db.query("update board_itens set estado = 'publicado' where id = $1", [dAna.id]);
  check('publicado: a dona abre o dela e SÓ o dela', JSON.stringify(await nomes(ana)) === JSON.stringify([arqAna]));
  check('a Bia não abre o da Ana, e o dela não está publicado', (await nomes(bia)).length === 0);
  check('anônimo não abre nada', (await asAnon(() => q("select name from storage.objects"))).length === 0);
  check('o admin abre todos', (await asUser(admin.id, () => q('select name from storage.objects'))).length === 2);
  check('só o admin grava no bucket', await falha(() => asUser(ana.u.id, () => db.query("insert into storage.objects (bucket_id, name) values ('casos-arquivos', $1)", [ana.c + '/x.pdf']))) && (await attempt(() => asUser(admin.id, () => db.query("insert into storage.objects (bucket_id, name) values ('casos-arquivos', $1)", [ana.c + '/y.pdf'])))).ok);
  check('caso_arquivo_dela: anônimo não executa', await falha(() => asAnon(() => q("select caso_arquivo_dela('x')"))));

  console.log('\n== O que a pessoa recebe ==');
  const m = (await asUser(ana.u.id, () => um('select meu_caso() r'))).r;
  const it = m.board.find((x) => x.id === dAna.id);
  check('meu_caso devolve descricao e arquivo (caminho) do item publicado, e tem_arquivo', it && it.descricao === 'Texto do e-mail' && it.arquivo === arqAna && it.tem_arquivo === true);
  check('meu_caso da Bia não traz nada da Ana', !((await asUser(bia.u.id, () => um('select meu_caso() r'))).r.board || []).some((x) => x.id === dAna.id));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
