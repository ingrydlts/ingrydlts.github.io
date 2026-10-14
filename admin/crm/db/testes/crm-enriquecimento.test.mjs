// Testa crm-enriquecimento.sql (ficha enriquecida a cada captura) num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install && npm run test:enriquecimento
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
const q = async (sql, params) => (await db.query(sql, params)).rows;
const asAnon = async (fn) => {
  await db.exec('set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); }
};

async function main() {
  console.log('== Setup (esquema antigo + um contato que já existia) ==');
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
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const lead = (extra) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'etudes-en-france-2027-2028', email: 'ana@example.com', nome: 'Ana', aceita_servico: true,
    consentimento_versao: 'guia-v1', texto_servico: 'Li e aceito.', ...extra })]));

  // Antes da migração: duas capturas de guias diferentes (a 2ª não muda a origem da ficha).
  await lead({ guia: 'vls-ts-validacao-travou', origem: 'guia-vls-ts', persona: 'au_pair_estudante' });
  await lead({ origem: 'guia-etudes-en-france-2027', persona: 'campus_france' });
  await db.exec(`insert into contatos (email, origem) values ('legado@example.com', 'blog')`);

  const sql = readFileSync(path.resolve(HERE, '../crm-enriquecimento.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  console.log('\n== Preenchimento do passado ==');
  let [ana] = await q("select * from crm_contatos where email = 'ana@example.com'");
  check('contou as 2 capturas', ana.capturas === 2);
  check('origens na ordem da 1ª vez', JSON.stringify(ana.origens) === '["guia-vls-ts","guia-etudes-en-france-2027"]');
  check('última origem = a mais recente', ana.ultima_origem === 'guia-etudes-en-france-2027');
  check('a 1ª origem da ficha continua intacta', ana.origem === 'guia-vls-ts');
  check('personas na ordem', JSON.stringify(ana.personas) === '["au_pair_estudante","campus_france"]');
  check('a persona da ficha é a mais recente', ana.persona === 'campus_france');
  check('motivo: voltou a deixar o e-mail', /^voltou a deixar o e-mail em \d\d\/\d\d \(guia-etudes-en-france-2027\)$/.test(ana.motivo || ''));
  const [leg] = await q("select * from crm_contatos where email = 'legado@example.com'");
  check('contato sem evento usa a origem da ficha', JSON.stringify(leg.origens) === '["blog"]' && leg.ultima_origem === 'blog');
  check('contato sem captura não ganha o motivo de volta', !(leg.motivo || '').startsWith('voltou'));

  console.log('\n== Captura nova enriquece sozinha (gatilho) ==');
  await lead({ origem: 'guia-email-alt30', guia: 'email-alternancia-30-mais', persona: 'alternancia_emprego' });
  await lead({ origem: 'guia-email-alt30', guia: 'email-alternancia-30-mais' });   // mesma origem de novo
  [ana] = await q("select * from crm_contatos where email = 'ana@example.com'");
  check('capturas = 4', ana.capturas === 4);
  check('origem repetida não duplica na lista', ana.origens.length === 3 && ana.origens[2] === 'guia-email-alt30');
  check('última origem atualizada', ana.ultima_origem === 'guia-email-alt30');
  check('persona nova entra na trilha, sem repetir', ana.personas.length === 3 && ana.personas[2] === 'alternancia_emprego');

  console.log('\n== Pessoa nova ==');
  await lead({ email: 'bia@example.com', origem: 'guia-etudes-en-france-2027', persona: 'campus_france' });
  const [bia] = await q("select * from crm_contatos where email = 'bia@example.com'");
  check('1ª captura = 1', bia.capturas === 1);
  check('1 origem', JSON.stringify(bia.origens) === '["guia-etudes-en-france-2027"]');
  check('uma captura só não vira "voltou"', !(bia.motivo || '').startsWith('voltou'));

  console.log('\n== O gatilho nunca derruba a captura ==');
  await db.exec(`alter table contatos add constraint falha_de_proposito check (capturas < 100)`);
  await db.exec(`update contatos set capturas = 99 where email = 'bia@example.com'`);
  const r = await attempt(() => lead({ email: 'bia@example.com', origem: 'guia-vls-ts' }));
  check('captura segue ok mesmo se o resumo falhar', r.ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
