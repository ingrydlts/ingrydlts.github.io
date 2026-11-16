// Testa crm-montagem.sql (a tabela montagens: propostas de montagem do espaço geradas pelo Worker) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:montagem
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
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql', 'crm-caso-listas.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-montagem.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const H = (n) => String(n).repeat(64).slice(0, 64);
  const mont = (p, hash, extra = {}) => um('insert into montagens (contato_id, hash_entrada, proposta, persona, modelo, custo_usd) values ($1,$2,$3,$4,$5,$6) returning id, versao, estado',
    [p.c, hash, JSON.stringify(extra.proposta ?? { bilan: { resumo: 'x', afirmacoes: [] } }), extra.persona ?? 'pvt', 'modelo-de-teste', extra.custo ?? 0.0123]);

  console.log('== A tabela: só admin ==');
  const pol = await q("select pg_get_expr(polqual, polrelid) as q from pg_policy where polrelid = 'public.montagens'::regclass");
  check('montagens: RLS ligada e uma só política, a do admin', (await um("select relrowsecurity r from pg_class where oid = 'public.montagens'::regclass")).r && pol.length === 1 && /eh_admin\(\)/.test(pol[0].q));
  const m1 = await mont(ana, H(1));
  check('anônimo não lê; a pessoa não lê a própria montagem (é rascunho da equipe)', !(await attempt(() => asAnon(() => q('select * from montagens')))).ok && (await asUser(ana.u.id, () => q('select * from montagens'))).length === 0);
  check('o admin lê', (await asUser(admin.id, () => q('select * from montagens'))).length === 1);

  console.log('\n== Versão e estado ==');
  const m2 = await mont(ana, H(2)), mb = await mont(bia, H(1));
  check('nasce pendente, com a versão 1, 2… por pessoa (a Bia recomeça em 1)', m1.estado === 'pendente' && m1.versao === 1 && m2.versao === 2 && mb.versao === 1);
  check('a mesma entrada pendente não entra duas vezes (o Worker reaproveita)', !(await attempt(() => mont(ana, H(2)))).ok);
  await db.query("update montagens set estado = 'descartada' where id = $1", [m2.id]);
  check('descartada a proposta, a mesma entrada pode gerar outra', (await attempt(() => mont(ana, H(2)))).ok);
  check('estado fora da lista, hash que não é sha-256 e proposta que não é objeto são recusados', !(await attempt(() => db.query("update montagens set estado = 'publicada_sozinha' where id = $1", [m1.id]))).ok && !(await attempt(() => mont(ana, 'abc'))).ok && !(await attempt(() => mont(ana, H(3), { proposta: [1] }))).ok);
  check('proposta acima de 64 KB é recusada', !(await attempt(() => mont(ana, H(4), { proposta: { lixo: 'x'.repeat(70000) } }))).ok);
  check('apagar a ficha apaga as montagens dela', await (async () => { await db.query('delete from contatos where id = $1', [bia.c]); return (await um('select count(*)::int n from montagens where contato_id = $1', [bia.c])).n === 0; })());

  console.log('\n== Descartar ==');
  check('crm_montagem_descartar: só admin; anônimo não executa', await falha(() => asUser(ana.u.id, () => db.query('select crm_montagem_descartar($1)', [m1.id])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select crm_montagem_descartar($1)', [m1.id])))).ok);
  await asUser(admin.id, () => db.query('select crm_montagem_descartar($1)', [m1.id]));
  check('descartar muda o estado e não apaga a linha (fica o histórico)', (await um('select estado from montagens where id = $1', [m1.id])).estado === 'descartada');
  check('montagem que não existe ou já foi publicada não descarta', await falha(() => asUser(admin.id, () => db.query('select crm_montagem_descartar(999999)')), 'montagem_nao_encontrada'));
  const f = await um("select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec, array_to_string(p.proconfig, ',') as cfg from pg_proc p where p.proname = 'crm_montagem_descartar'");
  check('crm_montagem_descartar: security definer, search_path fixo, anon não executa', f.prosecdef && /search_path=/.test(f.cfg) && !f.anon_exec);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
