// Testa crm-dossie.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (repositório
// POR-DENTRO-APP) e da fase 2 do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:dossie
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
  const sql = readFileSync(path.resolve(HERE, '../crm-dossie.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  await db.query("insert into contatos (email) values ('bia@example.com') on conflict (email) do nothing");
  const [cAna] = await q("select id from contatos where email='ana@example.com'");
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const salvar = (id, dados, quem = admin.id) => asUser(quem, () => db.query('select crm_salvar_dossie($1, $2) as d', [id, JSON.stringify(dados)]));
  const dossie = async (id) => (await q('select dossie from contatos where id=$1', [id]))[0].dossie;

  console.log('\n== Permissões ==');
  check('pessoa logada não salva dossiê', !(await attempt(() => salvar(cBia.id, { cidade: 'Lyon' }, ana.id))).ok);
  check('anon não salva dossiê', !(await attempt(() => asAnon(() => db.query("select crm_salvar_dossie($1, '{}')", [cBia.id])))).ok);
  check('pessoa logada não lê o dossiê de outra (RLS)', (await asUser(ana.id, () => db.query('select dossie from contatos where id=$1', [cBia.id]))).rows.length === 0);
  check('pessoa logada não escreve direto na coluna (RLS)', (await asUser(ana.id, () => db.query("update contatos set dossie='{\"x\":1}' where id=$1", [cAna.id]))).rowCount === 0);

  console.log('\n== Gravar e mesclar ==');
  const base = { cidade: 'Lyon', ano_au_pair: 'primeiro', contrato_fim: '2027-09-01', moradia_resolvida: true, cfEtapa: 8, ligacao_data: '2026-10-22',
    ligacao_transcricao: 'Ana: oi!\nIngryd: oi, Ana!' };
  const r = await salvar(cBia.id, base);
  const ord = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));   // jsonb não guarda a ordem das chaves
  check('grava os campos', ord(await dossie(cBia.id)) === ord(base) && r.rows[0].d.cidade === 'Lyon');
  check('marca dossie_atualizado_em', (await q('select dossie_atualizado_em from contatos where id=$1', [cBia.id]))[0].dossie_atualizado_em !== null);
  await salvar(cBia.id, { cidade: 'Paris' });
  const d2 = await dossie(cBia.id);
  check('mescla: muda só o que veio', d2.cidade === 'Paris' && d2.ano_au_pair === 'primeiro' && d2.cfEtapa === 8);
  await salvar(cBia.id, { cidade: null, moradia_resolvida: false });
  const d3 = await dossie(cBia.id);
  check('null apaga a resposta; false é resposta, não ausência', !('cidade' in d3) && d3.moradia_resolvida === false);

  console.log('\n== Validação ==');
  const bad = async (dados) => !(await attempt(() => salvar(cBia.id, dados))).ok;
  check('recusa campo que não existe', await bad({ senha: 'x' }));
  check('recusa tipo errado (sim/não como texto)', await bad({ moradia_resolvida: 'sim' }));
  check('recusa data fora do formato', await bad({ data_chegada: '22/10/2026' }));
  check('recusa etapa que não é número', await bad({ cfEtapa: 'oito' }));
  check('recusa texto curto gigante', await bad({ cidade: 'a'.repeat(301) }));
  check('aceita texto longo da ligação', (await attempt(() => salvar(cBia.id, { ligacao_transcricao: 'a'.repeat(50000) }))).ok);
  check('recusa objeto no lugar de texto', await bad({ cidade: { a: 1 } }));
  check('recusa contato que não existe', !(await attempt(() => salvar('00000000-0000-0000-0000-000000000000', { cidade: 'x' }))).ok);
  check('uma chave ruim não grava nenhuma das boas', await (async () => { await attempt(() => salvar(cBia.id, { cidade: 'Nice', senha: 'x' })); return (await dossie(cBia.id)).cidade !== 'Nice'; })());

  console.log('\n== Linha do tempo ==');
  await db.query("update contatos set ultimo_evento_em = now() - interval '20 days' where id=$1", [cBia.id]);
  await salvar(cBia.id, { cidade: 'Lille' });
  check('registra dossie_atualizado', (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='dossie_atualizado'", [cBia.id]))[0].n >= 1);
  check('preencher o dossiê não zera o "parada há N dias"', (await q('select ultimo_evento_em from contatos where id=$1', [cBia.id]))[0].ultimo_evento_em < new Date(Date.now() - 19 * 864e5));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
