// Testa guias-link-privado.sql (link do Notion só depois do cadastro) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install
//   APP_DB_DIR="../../../../../POR DENTRO APP/db" npm run test:guias
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, value: await fn(), error: null }; } catch (e) { return { ok: false, value: null, error: e }; } }
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
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../guias-link-privado.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [comum] = await q("insert into auth.users (email) values ('comum@example.com') returning id");

  const guia = (extra = {}) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'vls-ts-validacao-travou', email: 'lead@example.com', origem: 'guia-vls-ts', aceita_servico: true,
    aceita_novidades: false, consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.', ...extra })]));

  console.log('\n== Cadastro devolve o link ==');
  const r1 = (await guia()).rows[0].r;
  check('ok = true', r1.ok === true);
  check('devolve o link do guia certo', r1.notion_url?.includes('VLS-TS-estudante-trava'));
  check('devolve o texto do botão', r1.notion_texto === 'Abrir o guia no Notion');
  const [c] = await q("select * from contatos where email = 'lead@example.com'");
  check('o lead foi gravado no CRM como antes', !!c && c.origem === 'guia-vls-ts');
  const ev = await q("select tipo from eventos where contato_id = $1", [c.id]);
  check('evento email_capturado registrado', ev.some((e) => e.tipo === 'email_capturado'));

  const r2 = (await guia({ guia: 'etudes-en-france-2027-2028', email: 'outra@example.com', origem: 'guia-etudes-en-france-2027' })).rows[0].r;
  check('cada guia devolve o próprio link', r2.notion_url?.includes('Checklist-tudes-en-France'));
  const r3 = (await guia({ guia: 'nao-existe', email: 'x@example.com' })).rows[0].r;
  check('guia desconhecido: cadastra, mas sem link', r3.ok === true && !('notion_url' in r3));
  const r4 = (await guia({ guia: undefined, email: 'y@example.com' })).rows[0].r;
  check('sem guia no payload: cadastra, mas sem link', r4.ok === true && !('notion_url' in r4));

  console.log('\n== Sem cadastro válido, sem link ==');
  const semConsent = await attempt(() => guia({ email: 'z@example.com', aceita_servico: false }));
  check('sem consentimento: erro e nada de link', !semConsent.ok && /consentimento_obrigatorio/.test(semConsent.error.message));
  const emailRuim = await attempt(() => guia({ email: 'nao-e-email' }));
  check('e-mail inválido: erro e nada de link', !emailRuim.ok && /email_invalido/.test(emailRuim.error.message));
  check('e-mail inválido não virou contato', (await q("select 1 from contatos where email = 'nao-e-email'")).length === 0);

  console.log('\n== Segurança ==');
  check('anon NÃO lê guias_links', !(await attempt(() => asAnon(() => db.query('select * from guias_links')))).ok);
  check('anon NÃO edita guias_links', !(await attempt(() => asAnon(() => db.query("update guias_links set notion_url = 'https://x'")))).ok);
  const vistoComum = await asUser(comum.id, () => db.query('select * from guias_links'));
  check('usuária logada que não é admin não vê links', vistoComum.rows.length === 0);
  const vistoAdmin = await asUser(admin.id, () => db.query('select * from guias_links'));
  check('admin vê os 3 links', vistoAdmin.rows.length === 3);
  await asUser(admin.id, () => db.query("update guias_links set notion_url = 'https://exemplo.notion.site/novo' where slug = 'vls-ts-validacao-travou'"));
  const r5 = (await guia({ email: 'depois@example.com' })).rows[0].r;
  check('admin troca o link e o próximo cadastro já recebe o novo', r5.notion_url === 'https://exemplo.notion.site/novo');
  await db.exec(sql);
  check('rodar a migração de novo não desfaz a troca', (await q("select notion_url from guias_links where slug = 'vls-ts-validacao-travou'"))[0].notion_url === 'https://exemplo.notion.site/novo');
  check('link precisa começar com https://', !(await attempt(() => db.query("update guias_links set notion_url = 'javascript:alert(1)'"))).ok);

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
