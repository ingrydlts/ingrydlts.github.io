// Testa crm-caso-listas.sql (listas/checklists particulares do percurso e a camada de cada encaminhamento) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:listas
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [ana.c]); // a Bia NÃO consentiu
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));
  const lista = (p, chave, titulo, origem = 'particular') => um('insert into caso_listas (contato_id, chave, titulo, origem) values ($1,$2,$3,$4) returning id', [p.c, chave, titulo, origem]);
  const acao = (p, titulo, extra = {}) => um(`insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, publicada_em, lista_chave, camada) values ($1,$2,'ela','plataforma',$3, now(), $4, $5) returning id`,
    [p.c, titulo, extra.passo ?? ('p_' + Math.random().toString(36).slice(2, 8)), extra.lista ?? null, extra.camada ?? null]);
  const meu = async (p) => (await asUser(p.u.id, () => um('select meu_caso() r'))).r;

  console.log('== A tabela: só admin ==');
  const pol = await q("select pg_get_expr(polqual, polrelid) as q from pg_policy where polrelid = 'public.caso_listas'::regclass");
  check('caso_listas: RLS ligada e uma só política, a do admin', (await um("select relrowsecurity r from pg_class where oid = 'public.caso_listas'::regclass")).r && pol.length === 1 && /eh_admin\(\)/.test(pol[0].q));
  check('anônimo não lê e a pessoa não lê pela tabela', !(await attempt(() => asAnon(() => q('select * from caso_listas')))).ok && (await asUser(ana.u.id, () => q('select * from caso_listas'))).length === 0);

  console.log('\n== Formato e unicidade ==');
  const l1 = await lista(ana, 'dossie_empresa', 'Dossiê para empresas');
  check('lista nasce como proposta', (await um('select estado from caso_listas where id=$1', [l1.id])).estado === 'proposto');
  check('chave repetida na mesma pessoa é recusada; em outra pessoa vale', !(await attempt(() => lista(ana, 'dossie_empresa', 'Outra'))).ok && (await attempt(() => lista(bia, 'dossie_empresa', 'Dossiê da Bia'))).ok);
  check('chave com formato inseguro, título vazio e origem desconhecida são recusados', !(await attempt(() => lista(ana, 'Dossiê X', 'T'))).ok && !(await attempt(() => lista(ana, 'ok_chave', '   '))).ok && !(await attempt(() => lista(ana, 'ok_chave2', 'T', 'ia'))).ok);

  console.log('\n== Revisar e publicar (mesma regra do board) ==');
  check('pular a revisão não vale (proposto → publicado)', await falha(() => adm('select crm_lista_publicar($1)', [l1.id]), 'revise_antes_de_publicar'));
  await db.query("update caso_listas set estado='revisado' where id=$1", [l1.id]);
  check('pessoa logada e anônimo não publicam', await falha(() => asUser(ana.u.id, () => db.query('select crm_lista_publicar($1)', [l1.id])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select crm_lista_publicar($1)', [l1.id])))).ok);
  const lb = await lista(bia, 'so_da_bia', 'Da Bia'); await db.query("update caso_listas set estado='revisado' where id=$1", [lb.id]);
  check('sem consentimento da pessoa não publica (Bia), nem escrevendo direto', await falha(() => adm('select crm_lista_publicar($1)', [lb.id]), 'sem_consentimento') && await falha(() => db.query("update caso_listas set estado='publicado' where id=$1", [lb.id]), 'sem_consentimento'));
  check('lista já publicada não nasce publicada', await falha(() => db.query("insert into caso_listas (contato_id, chave, titulo, estado) values ($1,'x','X','publicado')", [ana.c]), 'publique_depois_de_criar'));

  console.log('\n== Ações ligadas a uma lista ==');
  check('ação só liga a uma lista que existe na MESMA pessoa', await falha(() => acao(ana, 'Item', { lista: 'nao_existe' }), 'lista_invalida') && await falha(() => acao(ana, 'Item', { lista: 'so_da_bia' }), 'lista_invalida'));
  check('camada aceita persona, particular e entrega_equipe; outra é recusada', (await attempt(() => acao(ana, 'A', { camada: 'persona' }))).ok && (await attempt(() => acao(ana, 'B', { camada: 'particular' }))).ok && (await attempt(() => acao(ana, 'C', { camada: 'entrega_equipe' }))).ok && !(await attempt(() => acao(ana, 'D', { camada: 'geral' }))).ok);
  const aSolta = await acao(ana, 'Ação sem lista');
  const aLista = await acao(ana, 'Enviar CV à empresa', { lista: 'dossie_empresa', camada: 'particular' });
  let m = await meu(ana);
  check('lista ainda revisada: a pessoa não vê a lista nem as ações dela', m.listas.length === 0 && !m.acoes.some((a) => a.id === aLista.id));
  check('ação sem lista aparece como sempre, com lista_chave nula (regressão)', m.acoes.some((a) => a.id === aSolta.id && a.lista_chave === null));
  await adm('select crm_lista_publicar($1)', [l1.id]);
  m = await meu(ana);
  check('publicada: a pessoa vê a lista (chave e título) e as ações dela com lista_chave', m.listas.length === 1 && m.listas[0].chave === 'dossie_empresa' && m.listas[0].titulo === 'Dossiê para empresas' && m.acoes.some((a) => a.id === aLista.id && a.lista_chave === 'dossie_empresa'));
  check('a Bia não vê a lista nem as ações da Ana', (await meu(bia)).listas.length === 0 && !(await meu(bia)).acoes.some((a) => a.id === aLista.id));
  await asUser(ana.u.id, () => db.query('select marcar_acao($1, true)', [aLista.id]));
  await adm('select crm_lista_retirar($1)', [l1.id]);
  m = await meu(ana);
  check('retirada: some de novo, mas o que ela concluiu continua concluído', m.listas.length === 0 && !m.acoes.some((a) => a.id === aLista.id) && (await um('select estado from caso_acoes where id=$1', [aLista.id])).estado === 'concluida');
  await adm('select crm_lista_publicar($1)', [l1.id]);
  check('publicar de novo traz a lista de volta com o andamento dela', (await meu(ana)).acoes.find((a) => a.id === aLista.id).estado === 'concluida');
  check('apagar a lista não apaga a ação nem deixa lista_chave pendurada', await (async () => { await db.query("delete from caso_listas where id=$1", [l1.id]); const r = await um('select lista_chave from caso_acoes where id=$1', [aLista.id]); return r && r.lista_chave === null; })());

  console.log('\n== Funções ==');
  for (const f of ['crm_lista_publicar', 'crm_lista_retirar']) {
    const r = await um("select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec, has_function_privilege('authenticated', p.oid, 'execute') as auth_exec, array_to_string(p.proconfig, ',') as cfg from pg_proc p where p.proname = $1", [f]);
    check(`${f}: security definer, search_path fixo, anon não executa`, r.prosecdef && /search_path=/.test(r.cfg) && !r.anon_exec);
  }

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
