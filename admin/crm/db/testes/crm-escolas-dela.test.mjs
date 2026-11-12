// Testa crm-escolas-dela.sql (as escolas que a pessoa acrescenta no Espaço) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:escolas-dela
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-escolas-dela.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email, confirmado = true) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id", [email, confirmado ? new Date().toISOString() : null]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]); return u; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id;
  const add = (u, ...a) => asUser(u.id, () => um('select adicionar_escola($1, $2, $3, $4::jsonb) id', [a[0] ?? null, a[1] ?? null, a[2] ?? null, JSON.stringify(a[3] ?? {})]));

  console.log('== Acrescentar e ler ==');
  const id1 = (await add(ana, 'Alliance Française de Lyon', 'https://exemplo.org/af', 'Curso intensivo, 20 h por semana.')).id;
  const mina = await asUser(ana.id, () => q('select * from minhas_escolas()'));
  check('a pessoa acrescenta e lê a própria escola (nome, link e o que já sabe)', mina.length === 1 && mina[0].nome === 'Alliance Française de Lyon' && mina[0].link === 'https://exemplo.org/af' && /20 h/.test(mina[0].nota));
  await add(ana, '  Université de Lyon  ', '', '   ');
  const m2 = await asUser(ana.id, () => q('select nome, link, nota from minhas_escolas()'));
  check('só o nome basta: espaços são aparados e link e nota vazios viram nulos', m2[1].nome === 'Université de Lyon' && m2[1].link === null && m2[1].nota === null);
  check('acrescentar vira evento na linha do tempo da ficha', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='escola_adicionada'", [cAna])).n === 2);
  check('cada pessoa vê só as suas (a Bia não vê as da Ana)', (await asUser(bia.id, () => q('select * from minhas_escolas()'))).length === 0);

  console.log('\n== Perguntas Sim/Não (a lista muda por persona) ==');
  const comCrit = (await add(ana, 'DU Aix', 'https://exemplo.org/du', null, { carga: 'sim', dur: 'nao', visto_ok: 'sim' })).id;
  check('ela acrescenta a escola já com as respostas Sim/Não da persona dela', (await asUser(ana.id, () => q('select criterios from minhas_escolas() where id=$1', [comCrit])))[0].criterios.carga === 'sim');
  const marca = (u, ...a) => asUser(u.id, () => db.query('select marcar_criterio_escola($1, $2, $3)', a));
  await marca(ana, comCrit, 'prazo', 'sim');
  await marca(ana, comCrit, 'carga', null);
  const cr = (await asUser(ana.id, () => q('select criterios from minhas_escolas() where id=$1', [comCrit])))[0].criterios;
  check('marcar uma pergunta soma; desmarcar (nulo) tira a chave; as outras ficam', cr.prazo === 'sim' && !('carga' in cr) && cr.dur === 'nao' && cr.visto_ok === 'sim');
  check('chave de formato inseguro, valor que não é sim/não e escola de outra pessoa são recusados', await falha(() => marca(ana, comCrit, 'Carga', 'sim'), 'valor_invalido') && await falha(() => marca(ana, comCrit, 'x; drop', 'sim'), 'valor_invalido') && await falha(() => marca(ana, comCrit, 'prazo', 'talvez'), 'valor_invalido') && await falha(() => marca(bia, comCrit, 'prazo', 'sim'), 'escola_nao_encontrada'));
  check('critérios inválidos ao acrescentar são recusados (chave, valor, não-objeto, mais de 12)', await falha(() => add(ana, 'X', null, null, { 'A-b': 'sim' }), 'criterios_invalidos') && await falha(() => add(ana, 'X', null, null, { a: 'talvez' }), 'criterios_invalidos') && await falha(() => add(ana, 'X', null, null, ['sim']), 'criterios_invalidos') && await falha(() => add(ana, 'X', null, null, Object.fromEntries(Array.from({ length: 13 }, (_, i) => ['k' + i, 'sim']))), 'criterios_invalidos'));
  check('anônimo não marca critério', !(await attempt(() => asAnon(() => db.query("select marcar_criterio_escola(1, 'a', 'sim')")))).ok);
  await asUser(ana.id, () => db.query('select remover_escola($1)', [comCrit]));

  console.log('\n== Regras ==');
  check('nome vazio ou longo demais é recusado', await falha(() => add(ana, '   '), 'nome_invalido') && await falha(() => add(ana, 'x'.repeat(121)), 'nome_invalido') && await falha(() => add(ana, null), 'nome_invalido'));
  check('link que não é https é recusado (http, javascript:, texto)', await falha(() => add(ana, 'X', 'http://x.org'), 'link_invalido') && await falha(() => add(ana, 'X', 'javascript:alert(1)'), 'link_invalido') && await falha(() => add(ana, 'X', 'alliance.fr'), 'link_invalido'));
  check('nota acima de 600 letras é recusada', await falha(() => add(ana, 'X', null, 'n'.repeat(601)), 'nota_longa'));
  for (let i = 0; i < 18; i++) await add(ana, 'Escola ' + i);
  check('o limite é de 20 escolas por pessoa', (await asUser(ana.id, () => q('select * from minhas_escolas()'))).length === 20 && await falha(() => add(ana, 'A 21ª'), 'limite_de_escolas'));
  check('conta que não está ligada a nenhuma ficha não acrescenta', await (async () => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ('semficha@example.com', now()) returning id"); await db.query("delete from contatos where email='semficha@example.com'"); return falha(() => add(u, 'X'), 'nao_autenticado'); })());

  console.log('\n== Remover e isolamento ==');
  await asUser(bia.id, () => db.query('select remover_escola($1)', [id1]));
  check('a Bia não consegue remover a escola da Ana', (await asUser(ana.id, () => q('select * from minhas_escolas()'))).some((e) => e.id === id1));
  await asUser(ana.id, () => db.query('select remover_escola($1)', [id1]));
  check('a Ana remove a sua', !(await asUser(ana.id, () => q('select * from minhas_escolas()'))).some((e) => e.id === id1));
  check('a tabela só o admin lê (a pessoa não lê pela tabela, só pela função); o admin vê as da Ana', (await asUser(ana.id, () => q('select * from escolas_dela'))).length === 0 && (await asUser(admin.id, () => q('select * from escolas_dela where contato_id=$1', [cAna]))).length === 19);
  check('anônimo não executa nenhuma das funções nem lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from minhas_escolas()')))).ok && !(await attempt(() => asAnon(() => db.query("select adicionar_escola('X')")))).ok && !(await attempt(() => asAnon(() => db.query('select remover_escola(1)')))).ok && !(await attempt(() => asAnon(() => db.query('select * from escolas_dela')))).ok);
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
