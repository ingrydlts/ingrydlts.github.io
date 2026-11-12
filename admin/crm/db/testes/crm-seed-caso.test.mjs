// Testa o caso de cada persona no ambiente de teste (db/seed-teste.sql do app: caso_teste_montar / aplicar_caso_teste) com os SQL reais do app e do site.
// Confere: cada cenário publica o seu Espaço (prazo, escolas do time, escolas dela, pergunta), as respostas Sim/Não usam as chaves da lista da persona,
// trocar de persona recomeça o caso, só conta "+teste" chama a função, e a cliente de verdade não é tocada.
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-seed-caso.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const APP = path.resolve(APP_DB, '..');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: e }; } }
async function asUser(id, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const q = async (sql, p) => (await db.query(sql, p)).rows;

const { CASOS, ORDEM_CENARIOS, CENARIOS } = await import(pathToFileURL(path.join(APP, 'assets/js/cenarios-teste.js')).href);
const { CRITERIOS_POR_PERSONA, criteriosDaPersona } = await import(pathToFileURL(path.join(APP, 'assets/js/caso.js')).href);

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
for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-criterios.sql', 'crm-caso-documentos.sql', 'crm-escolas-dela.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
await db.exec(`create table assinaturas (contato_id uuid primary key references contatos(id) on delete cascade, status text not null, plano text, moeda text,
  teste_fim timestamptz, periodo_fim timestamptz, cancela_no_fim boolean not null default false, atualizado_em timestamptz not null default now())`);

const seed = readFileSync(path.join(APP_DB, 'seed-teste.sql'), 'utf8');
const nova = async (email) => { const [u] = await q('insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id', [email]);
  await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]); return u; };
const teste = await nova('voce+teste@gmail.com'), cliente = await nova('cliente@gmail.com');
const cCliente = (await q("select id from contatos where email='cliente@gmail.com'"))[0].id;
await db.query("insert into board_itens (contato_id, tipo, titulo) values ($1, 'marco', 'Da cliente de verdade')", [cCliente]);

console.log('== O seed roda e monta o caso ==');
const r = await attempt(() => db.exec(seed)); check('o seed roda sem erro com o SQL do caso presente', r.ok); if (!r.ok) { console.log(r.error.message); process.exit(1); }
check('rodar de novo é idempotente', (await attempt(() => db.exec(seed))).ok);

const espaco = async (u) => asUser(u.id, async () => (await q('select meu_caso() c'))[0].c);
const escolasDela = async (u) => asUser(u.id, () => q('select * from minhas_escolas()'));

console.log('\n== Cada persona tem o seu Espaço ==');
for (const k of ORDEM_CENARIOS) {
  const r1 = await attempt(() => asUser(teste.id, () => db.query('select aplicar_caso_teste($1)', [k])));
  check(`${k}: aplicar_caso_teste funciona`, r1.ok); if (!r1.ok) { console.log(r1.error.message); continue; }
  const c = await espaco(teste), board = c.board || [], caso = CASOS[k], persona = CENARIOS[k].persona;
  const lista = criteriosDaPersona(persona).map((x) => x[0]);
  check(`${k}: o prazo e as escolas do time foram publicados`, board.filter((b) => b.tipo === 'marco').length === (caso.marcos || []).length && board.filter((b) => b.tipo === 'escola').length === (caso.escolas || []).length);
  check(`${k}: os documentos (com selos) e o passo de documentos chegaram`, board.filter((b) => b.tipo === 'documento').length === (caso.documentos || []).length && (c.acoes || []).filter((x) => x.botao === 'conferir_documentos' && /^docs:/.test(x.passo_chave)).length === (caso.acoes || []).filter((x) => x.botao === 'conferir_documentos').length && board.filter((b) => b.tipo === 'documento').every((b) => Array.isArray(b.dados.selos)));
  const chaves = new Set(board.filter((b) => b.tipo === 'escola').flatMap((b) => Object.keys((b.dados_dela || {}).criterios || {})));
  const dela = await escolasDela(teste);
  dela.forEach((e) => Object.keys(e.criterios || {}).forEach((x) => chaves.add(x)));
  check(`${k}: as respostas Sim/Não usam só as chaves da lista da persona (${persona})`, [...chaves].every((x) => lista.includes(x)));
  check(`${k}: as escolas dela (${(caso.dela || []).length}) aparecem em minhas_escolas`, dela.length === (caso.dela || []).length);
  const av = await asUser(teste.id, () => q('select * from meus_avisos()'));
  check(`${k}: a pergunta da equipe chegou`, av.some((a) => a.tipo === 'pergunta' && a.titulo === caso.pergunta.titulo));
}
check('trocar de persona recomeça: só sobra o caso da última (conjuge), sem resto das outras', (await espaco(teste)).board.every((b) => /Renovar|GRETA/.test(b.titulo)));
check('as listas de critérios das personas são diferentes entre si (a parte que muda)', new Set(['pvt', 'au_pair_estudante', 'campus_france'].map((p) => JSON.stringify(CRITERIOS_POR_PERSONA[p].map((x) => x[0])))).size === 3);

console.log('\n== Segurança ==');
check('conta que não é "+teste" não consegue chamar aplicar_caso_teste', !(await attempt(() => asUser(cliente.id, () => db.query("select aplicar_caso_teste('pvt')")))).ok);
check('cenário inventado é recusado', !(await attempt(() => asUser(teste.id, () => db.query("select aplicar_caso_teste('x')")))).ok);
check('anônimo e authenticated não chamam caso_teste_montar direto', !(await attempt(() => asUser(teste.id, () => db.query('select caso_teste_montar($1, $2)', [cCliente, 'pvt'])))).ok);
check('o caso da cliente de verdade não foi tocado', (await q("select count(*)::int n from board_itens where contato_id=$1 and titulo='Da cliente de verdade'", [cCliente]))[0].n === 1);

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
