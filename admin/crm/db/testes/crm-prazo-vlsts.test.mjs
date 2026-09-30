// Testa crm-prazo-vlsts.sql (data de entrada + prazo do VLS-TS) num Postgres efêmero (PGlite),
// em cima dos arquivos reais das fases 1 e 2. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install
//   APP_DB_DIR="../../../../../POR DENTRO APP/db" npm run test:prazo
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
const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };

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
  const sql3 = readFileSync(path.resolve(HERE, '../crm-prazo-vlsts.sql'), 'utf8');
  await db.exec(sql3);
  const idem = await attempt(() => db.exec(sql3));
  check('migração do prazo é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const vis = async (email) => (await asUser(admin.id, () => db.query('select * from crm_contatos where email=$1', [email]))).rows[0];
  const lead = (email, extra = {}) => asAnon(() => db.query('select capturar_lead($1)', [JSON.stringify({
    email, origem: 'guia-vls-ts', aceita_servico: true, aceita_novidades: true, consentimento_versao: 'guia-v1',
    texto_servico: 'Li e aceito.', texto_novidades: 'Quero receber.', ...extra })]));

  console.log('\n== Conta do prazo = mesma da calculadora do guia ==');
  const conta = async (d) => (await q("select to_char(((date '" + d + "' + interval '3 months')::date - 1), 'YYYY-MM-DD') p"))[0].p;
  check('31/07 → 30/10 (exemplo do manual)', (await conta('2026-07-31')) === '2026-10-30');
  check('30/11 → 27/02 (fim de mês: fevereiro tem 28)', (await conta('2026-11-30')) === '2027-02-27');
  check('31/05 → 30/08', (await conta('2026-05-31')) === '2026-08-30');
  check('29/11/2023 → 28/02/2024 (ano bissexto segue o calendário)', (await conta('2023-11-29')) === '2024-02-28');

  console.log('\n== capturar_lead com data_entrada ==');
  const e20 = iso(-20);
  check('aceita data de entrada válida', (await attempt(() => lead('a@example.com', { data_entrada: e20, nome: 'Ana' }))).ok);
  const [a] = await q("select * from contatos where email='a@example.com'");
  check('guarda data_entrada', String(a.data_entrada.toISOString?.().slice(0, 10) ?? a.data_entrada).startsWith(e20));
  const evA = await q("select dados from eventos where contato_id=$1 and tipo='data_entrada_informada'", [a.id]);
  check('registra o evento data_entrada_informada', evA.length === 1 && evA[0].dados.origem === 'guia-vls-ts');
  const pz = await conta(e20);
  check('evento traz o prazo_limite certo', evA[0].dados.prazo_limite === pz);
  check('origem e consentimento continuam registrados', a.origem === 'guia-vls-ts' &&
    (await q("select 1 from consentimentos where contato_id=$1 and finalidade='novidades_email' and aceito and versao='guia-v1'", [a.id])).length === 1);

  console.log('\n== Entrada suja não derruba o lead ==');
  for (const [label, val] of [['data impossível', '2026-02-31'], ['texto', 'amanhã'], ['futuro distante', iso(900)],
    ['passado distante', iso(-900)], ['formato errado', '31/07/2026'], ['vazio', '']]) {
    const email = `sujo-${label.replace(/\W/g, '')}@example.com`;
    const r = await attempt(() => lead(email, { data_entrada: val }));
    const row = (await q('select data_entrada from contatos where email=$1', [email]))[0];
    check(`${label}: lead criado e data ignorada`, r.ok && row && row.data_entrada === null);
  }
  check('sem o campo: funciona como antes', (await attempt(() => lead('sem@example.com'))).ok &&
    (await q("select 1 from contatos where email='sem@example.com' and data_entrada is null")).length === 1);

  console.log('\n== Quem volta ==');
  await lead('a@example.com');
  check('sem data nova, mantém a antiga', (await q("select 1 from contatos where email='a@example.com' and data_entrada = $1", [e20])).length === 1);
  const e5 = iso(-5);
  await lead('a@example.com', { data_entrada: e5 });
  check('com data nova, a mais recente vence', (await q("select 1 from contatos where email='a@example.com' and data_entrada = $1", [e5])).length === 1);
  check('não duplica o contato', Number((await q("select count(*) n from contatos where email='a@example.com'"))[0].n) === 1);

  console.log('\n== crm_contatos: prazo, urgência e motivo ==');
  const casos = [
    ['vence-em-10', -80, 'alta', /vence em \d+ dias/],
    ['venceu-20', -110, 'alta', /venceu há \d+ dias/],
    ['media-50', -40, 'media', /vence em \d+ dias/],
    ['baixa-80', -10, 'baixa', null],
    ['antigo-200', -300, 'baixa', null],
  ];
  for (const [nome, off, urg, re] of casos) { await lead(`${nome}@example.com`, { data_entrada: iso(off) }); }
  for (const [nome, off, urg, re] of casos) {
    const v = await vis(`${nome}@example.com`);
    check(`${nome}: urgência ${urg}`, v.urgencia === urg);
    check(`${nome}: motivo ${re ? 'cita o prazo' : 'não cita o prazo'}`, re ? re.test(v.motivo || '') : !/VLS-TS/.test(v.motivo || ''));
  }
  const v10 = await vis('vence-em-10@example.com');
  const esperado = Math.round((new Date(await conta(iso(-80))) - new Date(iso(0))) / 864e5);
  check('dias_para_prazo bate com a conta (±1 dia de fuso)', Math.abs(Number(v10.dias_para_prazo) - esperado) <= 1);
  check('prazo_limite exposto na visão', String(v10.prazo_limite.toISOString?.().slice(0, 10) ?? v10.prazo_limite).startsWith(await conta(iso(-80))));
  check('quem não informou data tem prazo nulo', (await vis('sem@example.com')).dias_para_prazo === null);
  check('regras antigas intactas: sem data e sem fase = baixa', (await vis('sem@example.com')).urgencia === 'baixa');

  console.log('\n== Segurança ==');
  check('anon continua sem ler a visão', !(await attempt(() => asAnon(() => db.query('select * from crm_contatos')))).ok);
  check('anon continua sem ler contatos', !(await attempt(() => asAnon(() => db.query('select data_entrada from contatos')))).ok);

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
