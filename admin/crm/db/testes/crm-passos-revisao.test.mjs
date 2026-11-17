// Testa crm-passos-revisao.sql (passo recusado e edição de passo do checklist pelo CRM) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-passos-revisao.test.mjs
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
  await db.exec(readFileSync(path.join(APP_DB, 'checklist-editar.sql'), 'utf8')); await db.exec(readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8')); await db.exec(readFileSync(path.resolve(HERE, '../crm-montagem.sql'), 'utf8')); await db.exec(readFileSync(path.resolve(HERE, '../crm-montagem-aplicar.sql'), 'utf8'));   // pré-requisitos
  const sql = readFileSync(path.resolve(HERE, '../crm-passos-revisao.sql'), 'utf8');
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

  const nova_acao = (p, extra = {}) => um("insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, estado, origem_chave) values ($1,'Passo','ela','plataforma',$2,$3,$4) returning id", [p.c, 'p_' + Math.random().toString(36).slice(2, 8), extra.estado || 'aberta', extra.origem ?? null]).then((r) => r.id);

  console.log('== Passo recusado ==');
  const a1 = await nova_acao(ana, { origem: 'enc:ligar' });
  check('o admin recusa: estado "recusada" é aceito', (await attempt(() => asUser(admin.id, () => db.query("update caso_acoes set estado = 'recusada' where id = $1", [a1])))).ok);
  check('estado inventado continua recusado', await falha(() => db.query("update caso_acoes set estado = 'lixo' where id = $1", [a1])));
  check('os estados antigos seguem valendo (aberta, aguardando_ela, concluida)', (await attempt(() => db.query("update caso_acoes set estado = 'aguardando_ela' where id = $1", [a1]))).ok && (await attempt(() => db.query("update caso_acoes set estado = 'concluida' where id = $1", [a1]))).ok);
  await db.query("update caso_acoes set estado = 'recusada', publicada_em = null where id = $1", [a1]);
  check('a linha recusada continua lá (a origem_chave segura: reler a conversa não recria)', (await um('select origem_chave, estado from caso_acoes where id = $1', [a1])).estado === 'recusada' && await falha(() => nova_acao(ana, { origem: 'enc:ligar' })));
  const m = (await asUser(ana.u.id, () => um('select meu_caso() r'))).r;
  check('a pessoa nunca recebe passo recusado', !(m.acoes || []).some((x) => x.id === a1));
  check('rodar o arquivo de novo não quebra (idempotente)', (await attempt(() => db.exec(sql))).ok);

  console.log('\n== Editar o texto de um passo do checklist ==');
  await db.query('insert into profiles (id) values ($1), ($2) on conflict do nothing', [ana.u.id, bia.u.id]);
  await db.query("insert into checklist_items (user_id, step_key, category, label, sort_order) values ($1,'k1','Visto','Texto original',0), ($2,'k1','Visto','Da Bia',0)", [ana.u.id, bia.u.id]);
  const ed = (p, k, t, n) => asUser(admin.id, () => db.query('select crm_checklist_editar($1,$2,$3,$4)', [p.u.id, k, t, n]));
  await ed(ana, 'k1', '  Validar o VLS-TS no OFII até a data  ', 'Faça pelo celular');
  const it = await um('select label, titulo_custom, nota_custom from checklist_items where user_id = $1 and step_key = $2', [ana.u.id, 'k1']);
  check('muda titulo_custom e nota_custom (sem espaços nas pontas) e NÃO toca o texto original', it.titulo_custom === 'Validar o VLS-TS no OFII até a data' && it.nota_custom === 'Faça pelo celular' && it.label === 'Texto original');
  check('só mexe na pessoa certa', (await um('select titulo_custom from checklist_items where user_id = $1', [bia.u.id])).titulo_custom === null);
  await ed(ana, 'k1', '', '');
  check('título e nota vazios voltam ao original', (await um('select titulo_custom, nota_custom from checklist_items where user_id = $1', [ana.u.id])).titulo_custom === null);
  check('título com mais de 120 caracteres e nota com mais de 100 são recusados', await falha(() => ed(ana, 'k1', 'x'.repeat(121), ''), 'titulo_longo') && await falha(() => ed(ana, 'k1', 't', 'y'.repeat(101)), 'nota_longa'));
  check('passo que não existe', await falha(() => ed(ana, 'nao_existe', 't', ''), 'item_nao_encontrado'));
  check('a pessoa NÃO executa (só admin) e anônimo também não', await falha(() => asUser(ana.u.id, () => db.query('select crm_checklist_editar($1,$2,$3,$4)', [ana.u.id, 'k1', 'meu', ''])), 'sem_permissao') && await falha(() => asAnon(() => q("select crm_checklist_editar($1,'k1','x','')".replace('$1', "'" + ana.u.id + "'")))));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
