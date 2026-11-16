// Testa crm-1a1-registro.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (repositório POR-DENTRO-APP) e da fase 2
// do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:1a1-registro
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
  const sql = readFileSync(path.resolve(HERE, '../crm-1a1-registro.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  await db.query("insert into contatos (email) values ('bia@example.com') on conflict (email) do nothing");
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const [um] = await q("insert into um_a_um (contato_id, quando, status) values ($1, now(), 'agendado') returning id", [cBia.id]);
  const grava = (id, reg, quem = admin.id) => asUser(quem, () => db.query('update um_a_um set registro = $2 where id = $1', [id, reg === null ? null : JSON.stringify(reg)]));

  console.log('\n== O registro ==');
  check('a coluna existe e começa vazia (os 1:1 de antes não mudam)', (await q('select registro from um_a_um where id=$1', [um.id]))[0].registro === null);
  const reg = { origem: 'I05', perguntas: [{ k: 'cidade', l: 'Cidade' }], identificadas: ['cidade'], conclusao: 'Quer estudar FLE.', encaminhamento: 'Mandar o link.', interesse: 'sim', link_enviado: true };
  const g = await attempt(() => grava(um.id, reg));
  check('o admin grava o registro', g.ok && g.value.rowCount === 1); if (!g.ok) console.log(g.error.message);
  const lido = (await q('select registro from um_a_um where id=$1', [um.id]))[0].registro;
  check('e lê de volta igual', lido.origem === 'I05' && lido.interesse === 'sim' && lido.perguntas[0].k === 'cidade' && lido.link_enviado === true);
  check('pode voltar a vazio', (await attempt(() => grava(um.id, null))).ok && (await q('select registro from um_a_um where id=$1', [um.id]))[0].registro === null);
  check('só objeto: lista é recusada', !(await attempt(() => grava(um.id, ['x']))).ok);
  check('texto solto é recusado', !(await attempt(() => grava(um.id, 'oi'))).ok);
  check('registro grande demais (acima de 20 mil bytes) é recusado', !(await attempt(() => grava(um.id, { conclusao: 'x'.repeat(21000) }))).ok);

  console.log('\n== Permissões (as de antes) ==');
  check('pessoa logada não muda o registro (RLS)', (await grava(um.id, { origem: 'x' }, ana.id)).rowCount === 0);
  check('pessoa logada não lê o 1:1', (await asUser(ana.id, () => db.query('select registro from um_a_um'))).rows.length === 0);
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select registro from um_a_um')))).ok);

  console.log('\n' + (failed ? failed + ' FALHARAM, ' : '') + passed + ' passaram' + (failed ? '' : ', 0 falharam'));
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
