// Testa crm-montagem-metricas.sql (o painel de manutenção do catálogo: o que a IA propõe, o que você rejeita e por quê) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:montagem-metricas
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
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    alter default privileges in schema public grant all on tables to service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql', 'crm-caso-listas.sql', 'crm-montagem.sql', 'crm-montagem-aplicar.sql', 'crm-assinaturas.sql', 'crm-entrar.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-montagem-metricas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [uAna] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await db.query("insert into contatos (email, user_id) values ('ana@example.com', $1) on conflict (email) do update set user_id = excluded.user_id", [uAna.id]);
  await db.query("insert into contatos (email) values ('bia@example.com')");
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id, cBia = (await um("select id from contatos where email='bia@example.com'")).id;
  const prop = (n, omissoes = 0) => ({ encaminhamentos: Array.from({ length: n }, (_, i) => ({ chave: 'e' + i })), omissoes: Array.from({ length: omissoes }, (_, i) => ({ chave: 'compromisso_' + (i + 1) })), checklists: [], documentos: [], perguntas_equipe: [], blocos: [], compromissos: [] });
  await db.query("insert into montagens (contato_id, hash_entrada, proposta, persona) values ($1, $2, $3, 'pvt'), ($4, $5, $6, 'pvt')", [cAna, 'a'.repeat(64), JSON.stringify(prop(4, 1)), cBia, 'b'.repeat(64), JSON.stringify(prop(2, 0))]);
  await db.query("insert into montagens (contato_id, hash_entrada, proposta, persona) values ($1, $2, $3, 'campus_france')", [cBia, 'c'.repeat(64), JSON.stringify(prop(3, 2))]);
  const ev = (c, t, d = {}, quando = 'now()') => db.query(`insert into eventos (contato_id, tipo, dados, criado_em) values ($1, $2, $3::jsonb, ${quando})`, [c, t, JSON.stringify(d)]);
  await ev(cAna, 'montagem_item_rejeitado', { motivo: 'excecao' }); await ev(cAna, 'montagem_item_rejeitado', { motivo: 'excecao' }); await ev(cAna, 'montagem_item_rejeitado', { motivo: 'prazo_desatualizado' });
  await ev(cAna, 'montagem_item_editado', { motivo: 'fato_errado' }); await ev(cBia, 'montagem_item_rejeitado', { motivo: 'regra_inadequada' });
  await ev(cAna, 'convite_aceito', {}, "now() - interval '5 days'"); await ev(cAna, 'caso_acao_concluida', {}, "now() - interval '3 days'");
  const rows = (await asUser(admin.id, () => q('select * from crm_montagem_metricas()'))).reduce((o, r) => { o[r.persona] = r; return o; }, {});

  console.log('== Por percurso ==');
  check('uma linha por persona', Object.keys(rows).sort().join() === 'campus_france,pvt');
  check('PVT: 2 leituras, 6 itens propostos (4 + 2), 1 compromisso sem item', rows.pvt.montagens === 2 && rows.pvt.itens_propostos === 6 && rows.pvt.compromissos_ausentes === 1);
  check('PVT: 4 itens rejeitados e 1 editado, e a taxa de rejeição (4 de 6)', rows.pvt.itens_rejeitados === 4 && rows.pvt.itens_editados === 1 && Number(rows.pvt.taxa_rejeicao) === 0.67);
  check('os motivos vêm contados (excecao 2, prazo 1, regra 1, fato_errado 1 da edição)', rows.pvt.motivos.excecao === 2 && rows.pvt.motivos.prazo_desatualizado === 1 && rows.pvt.motivos.regra_inadequada === 1 && rows.pvt.motivos.fato_errado === 1);
  check('tempo entre o aceite do convite e o primeiro passo concluído: 2 dias', Number(rows.pvt.dias_ate_primeira_acao) === 2);
  check('persona sem rejeições: taxa 0 e sem tempo até a primeira ação', Number(rows.campus_france.taxa_rejeicao) === 0 && rows.campus_france.dias_ate_primeira_acao === null && rows.campus_france.compromissos_ausentes === 2);
  console.log('\n== Acesso ==');
  check('só admin lê; a pessoa e o anônimo não', await falha(() => asUser(uAna.id, () => db.query('select * from crm_montagem_metricas()')), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select * from crm_montagem_metricas()')))).ok);
  const f = await um("select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec, array_to_string(p.proconfig, ',') as cfg from pg_proc p where p.proname = 'crm_montagem_metricas'");
  check('crm_montagem_metricas: security definer, search_path fixo, anon não executa', f.prosecdef && /search_path=/.test(f.cfg) && !f.anon_exec);
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
