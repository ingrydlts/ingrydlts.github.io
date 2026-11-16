// Testa crm-1a1-registro.sql (a coluna um_a_um.registro) num Postgres efêmero (PGlite). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:1a1-registro
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
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const q = async (sql, p) => (await db.query(sql, p)).rows;
const um = async (sql, p) => (await q(sql, p))[0];

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '..', 'crm-fase2.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1-registro.sql'), 'utf8');
  check('roda a 1ª vez', (await attempt(() => db.exec(sql))).ok);
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [dona] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  const [outra] = await q("insert into auth.users (email, email_confirmed_at) values ('bia@example.com', now()) returning id");
  const ficha = async (email, uid) => { await db.query('insert into contatos (email, user_id) values ($1, $2) on conflict (email) do update set user_id = excluded.user_id', [email, uid]); return (await um('select id from contatos where email=$1', [email])).id; };
  const ana = await ficha('ana@example.com', dona.id), bia = await ficha('bia@example.com', outra.id);
  const u1 = (await um("insert into um_a_um (contato_id, status) values ($1, 'feito') returning id", [ana])).id;
  const u2 = (await um("insert into um_a_um (contato_id, status) values ($1, 'agendado') returning id", [bia])).id;
  const grava = (id, doc) => attempt(() => asRole('authenticated', admin.id, () => db.query('update um_a_um set registro = $2::jsonb where id = $1', [id, JSON.stringify(doc)])));

  console.log('== Formato do registro ==');
  const bom = { origem: 'I03', perguntas: [{ k: 'apAno', l: 'Em que ano você está?' }], identificadas: ['apAno'], conclusao: 'Quer o link.', encaminhamento: 'Mandar o guia.', interesse: 'sim', link_enviado: true, link_enviado_em: '2026-11-16T10:00:00Z', atualizado_em: '2026-11-16T10:05:00Z' };
  check('o documento que o crm.js grava é aceito', (await grava(u1, bom)).ok);
  check('sem registro (nulo) continua valendo', (await attempt(() => db.exec(`update um_a_um set registro = null where id = ${u1}`))).ok);
  check('origem e interesse nulos são aceitos', (await grava(u1, { origem: null, interesse: null })).ok);
  const ruins = {
    'chave que não existe': { ...bom, extra: 1 }, 'origem fora do padrão': { ...bom, origem: 'XX' }, 'interesse fora da lista': { ...bom, interesse: 'quase' },
    'conclusão com mais de 1500 caracteres': { ...bom, conclusao: 'x'.repeat(1501) }, 'mais de 40 perguntas': { ...bom, perguntas: Array.from({ length: 41 }, (_, i) => ({ k: 'k' + i })) },
    'pergunta com chave extra': { ...bom, perguntas: [{ k: 'a', z: 1 }] }, 'link_enviado que não é booleano': { ...bom, link_enviado: 'sim' }, 'documento que não é objeto': [1, 2], 'identificadas com número': { ...bom, identificadas: [1] }
  };
  for (const [nome, doc] of Object.entries(ruins)) check('recusa: ' + nome, !(await grava(u1, doc)).ok);

  console.log('\n== Ligação com as outras tabelas e isolamento ==');
  await grava(u1, bom);
  check('a admin lê e grava', (await um('select registro from um_a_um where id=$1', [u1])).registro.origem === 'I03');
  const comoPessoa = (id) => asRole('authenticated', id, () => q('select id, registro from um_a_um'));
  check('a cliente não enxerga nenhum 1:1, nem o dela nem o de outra', (await comoPessoa(dona.id)).length === 0 && (await comoPessoa(outra.id)).length === 0);
  check('a cliente não consegue gravar registro', !(await attempt(() => asRole('authenticated', dona.id, () => db.query("update um_a_um set registro = '{}'::jsonb where id = $1", [u1])))).ok || (await um('select registro from um_a_um where id=$1', [u1])).registro.origem === 'I03');
  check('anônimo não lê a tabela', !(await attempt(() => asRole('anon', null, () => q('select registro from um_a_um')))).ok);
  await db.query('delete from contatos where id = $1', [ana]);
  check('apagar o contato apaga a conversa e o registro junto (cascata)', (await um('select count(*)::int n from um_a_um where id=$1', [u1])).n === 0 && (await um('select count(*)::int n from um_a_um where id=$1', [u2])).n === 1);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
