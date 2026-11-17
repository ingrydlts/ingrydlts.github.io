// Testa crm-guias.sql (os guias gratuitos de cada pessoa: os que ela pediu aparecem sozinhos; os que a Ingryd indica entram quando ela decide) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-guias.test.mjs
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

const CAT = () => [
  { slug: 'vls-ts-validacao-travou', origem: 'guia-vls-ts', titulo: 'VLS-TS travou na ANEF?', resumo: 'O que fazer antes do prazo.', categoria: 'Visto de estudante', url: '/guias/vls-ts-validacao-travou/', leitura_min: 6, publicado: true },
  { slug: 'email-alternancia-30-mais', origem: 'guia-email-alt30', titulo: 'E-mail em francês para alternância', resumo: 'Modelo pronto.', categoria: 'Alternância', url: '/guias/email-alternancia-30-mais/', leitura_min: 4, publicado: true },
  { slug: 'etudes-en-france-2027-2028', origem: 'guia-etudes-en-france-2027', titulo: 'Études en France 2027-2028', resumo: null, categoria: 'Candidatura', url: '/guias/etudes-en-france-2027-2028/', leitura_min: 8, publicado: true },
  { slug: 'rascunho-guia', origem: null, titulo: 'Guia ainda não publicado', resumo: null, categoria: null, url: '/guias/rascunho-guia/', leitura_min: null, publicado: false }];

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
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql']) { const rr = await attempt(() => db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'))); if (!rr.ok && process.env.DBG) console.log('ERRO em', f, rr.error.message); }
  const semGuias = await attempt(() => db.exec(readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8')));
  check('antes do crm-guias.sql, meu_caso() continua funcionando (sem a chave "guias" não quebra ninguém)', semGuias.ok);
  const sql = readFileSync(path.resolve(HERE, '../crm-guias.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);
  await db.exec(readFileSync(path.resolve(HERE, '../crm-caso-listas.sql'), 'utf8'));   // rodar a listas depois do guias: meu_caso() continua devolvendo os guias

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email, origens) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio, origens) values ($1, $2, 'em_uso', $3) on conflict (email) do update set user_id = excluded.user_id, origens = excluded.origens", [email, u.id, origens]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com', ['guia-vls-ts']), bia = await nova('bia@example.com', []), cai = await nova('cai@example.com', ['guia-vls-ts', 'guia-email-alt30', 'guia-desconhecido']);
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));
  const meu = async (p) => (await asUser(p.u.id, () => um('select meu_caso() r'))).r;
  const sync = (itens) => asUser(admin.id, () => um('select crm_guias_catalogo_sincronizar($1::jsonb) n', [JSON.stringify(itens)]));

  console.log('== As tabelas: só admin ==');
  for (const t of ['guias_catalogo', 'caso_guias']) {
    const pol = await q("select pg_get_expr(polqual, polrelid) as q from pg_policy where polrelid = ('public.' || $1)::regclass", [t]);
    check(t + ': RLS ligada e uma só política, a do admin', (await um("select relrowsecurity r from pg_class where oid = ('public.' || $1)::regclass", [t])).r && pol.length === 1 && /eh_admin\(\)/.test(pol[0].q));
    check(t + ': anônimo e a pessoa não leem pela tabela', !(await attempt(() => asAnon(() => q('select * from ' + t)))).ok && (await asUser(ana.u.id, () => q('select * from ' + t))).length === 0);
  }

  console.log('\n== Catálogo: o CRM sincroniza com content/guias.json ==');
  check('só admin sincroniza o catálogo', await falha(() => asUser(ana.u.id, () => db.query("select crm_guias_catalogo_sincronizar('[]'::jsonb)")), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query("select crm_guias_catalogo_sincronizar('[]'::jsonb)")))).ok);
  check('sincronizar grava os guias e devolve quantos', (await sync(CAT())).n === 4 && (await um('select count(*)::int n from guias_catalogo')).n === 4);
  check('sincronizar de novo não duplica e atualiza o título', (await sync(CAT().map((g) => (g.slug === 'vls-ts-validacao-travou' ? { ...g, titulo: 'VLS-TS travou? (atualizado)' } : g)))).n === 4 && (await um("select titulo from guias_catalogo where slug='vls-ts-validacao-travou'")).titulo === 'VLS-TS travou? (atualizado)');
  check('slug ou url fora do formato, ou lista grande demais, derrubam tudo', await falha(() => sync([{ ...CAT()[0], slug: 'Slug Ruim' }])) && await falha(() => sync([{ ...CAT()[0], url: 'https://outro.site/x' }])) && await falha(() => sync(Array.from({ length: 41 }, (_, i) => ({ ...CAT()[0], slug: 'g' + i, url: '/guias/g' + i + '/' })))) && await falha(() => sync('x')));
  await sync(CAT());

  console.log('\n== O que ela pediu aparece sozinho ==');
  let g = (await meu(ana)).guias;
  check('quem pediu o guia (origem guia-vls-ts) já o vê, sem ninguém publicar nada', g.length === 1 && g[0].slug === 'vls-ts-validacao-travou' && g[0].motivo === 'pediu');
  check('o guia vem com título, resumo, categoria, tempo de leitura e o endereço', g[0].titulo.length > 0 && g[0].categoria === 'Visto de estudante' && g[0].leitura_min === 6 && g[0].url === '/guias/vls-ts-validacao-travou/');
  check('quem não pediu nada não vê guia nenhum', (await meu(bia)).guias.length === 0);
  g = (await meu(cai)).guias;
  check('vários pedidos aparecem todos; origem sem guia no catálogo é ignorada', g.length === 2 && g.every((x) => x.motivo === 'pediu'));
  await adm("update contatos set origens = array_append(origens, 'guia-etudes-en-france-2027') where id = $1", [ana.c]);
  check('um pedido novo aparece na próxima vez que o app abre', (await meu(ana)).guias.length === 2);

  console.log('\n== O que você indica ==');
  check('só admin indica e retira', await falha(() => asUser(ana.u.id, () => db.query('select crm_guia_indicar($1,$2)', [ana.c, 'email-alternancia-30-mais'])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select crm_guia_indicar($1,$2)', [ana.c, 'email-alternancia-30-mais'])))).ok && await falha(() => asUser(ana.u.id, () => db.query('select crm_guia_retirar($1,$2)', [ana.c, 'x'])), 'sem_permissao'));
  await adm('select crm_guia_indicar($1,$2)', [bia.c, 'email-alternancia-30-mais']);
  g = (await meu(bia)).guias;
  check('o guia que você indica aparece para ela, marcado como indicado', g.length === 1 && g[0].slug === 'email-alternancia-30-mais' && g[0].motivo === 'indicado');
  await adm('select crm_guia_indicar($1,$2)', [bia.c, 'email-alternancia-30-mais']);
  check('indicar de novo não duplica', (await um('select count(*)::int n from caso_guias where contato_id=$1', [bia.c])).n === 1);
  await adm('select crm_guia_indicar($1,$2)', [cai.c, 'vls-ts-validacao-travou']);
  check('guia que ela pediu E você indicou aparece uma vez só, como "pediu"', (await meu(cai)).guias.filter((x) => x.slug === 'vls-ts-validacao-travou').length === 1 && (await meu(cai)).guias.find((x) => x.slug === 'vls-ts-validacao-travou').motivo === 'pediu');
  check('indicar um guia que não existe é recusado', await falha(() => adm('select crm_guia_indicar($1,$2)', [bia.c, 'nao-existe']), 'guia_nao_encontrado'));
  await adm('select crm_guia_retirar($1,$2)', [bia.c, 'email-alternancia-30-mais']);
  check('retirar tira o guia indicado do app dela', (await meu(bia)).guias.length === 0);
  check('retirar não esconde o que ela mesma pediu', (await adm('select crm_guia_retirar($1,$2)', [ana.c, 'vls-ts-validacao-travou'])) && (await meu(ana)).guias.some((x) => x.slug === 'vls-ts-validacao-travou'));

  console.log('\n== Guia não publicado e isolamento ==');
  await adm('select crm_guia_indicar($1,$2)', [bia.c, 'rascunho-guia']).catch(() => {});
  check('guia não publicado no catálogo não aparece para ninguém, nem se foi indicado', !(await meu(bia)).guias.some((x) => x.slug === 'rascunho-guia'));
  await adm('select crm_guia_indicar($1,$2)', [bia.c, 'email-alternancia-30-mais']);
  await sync(CAT().map((x) => (x.slug === 'email-alternancia-30-mais' ? { ...x, publicado: false } : x)));
  check('guia que sai do catálogo (despublicado) some do app, sem apagar a indicação', !(await meu(bia)).guias.some((x) => x.slug === 'email-alternancia-30-mais') && (await um('select count(*)::int n from caso_guias where contato_id=$1 and slug=$2', [bia.c, 'email-alternancia-30-mais'])).n === 1);
  await sync(CAT());
  check('uma pessoa nunca vê o guia indicado para outra', (await meu(bia)).guias.every((x) => x.slug !== 'etudes-en-france-2027-2028') && (await meu(ana)).guias.every((x) => x.motivo === 'pediu'));
  check('as funções de apoio não são chamáveis pela pessoa nem por anônimo (só o meu_caso as usa)', await falha(() => asUser(ana.u.id, () => db.query('select guias_da_pessoa($1)', [bia.c]))) && !(await attempt(() => asAnon(() => db.query('select guias_da_pessoa($1)', [bia.c])))).ok);
  check('meu_caso continua devolvendo o resto (board, listas, acoes, avisos) junto dos guias', (() => true)() && Object.keys(await meu(ana)).sort().join(',') === 'acoes,avisos,board,guias,listas,respondidas');
  const sec = await q("select proname, prosecdef, proconfig from pg_proc where proname in ('crm_guias_catalogo_sincronizar','crm_guia_indicar','crm_guia_retirar','guias_da_pessoa')");
  check('as quatro funções são security definer com search_path fixo', sec.length === 4 && sec.every((f) => f.prosecdef && (f.proconfig || []).some((c) => /search_path/.test(c))));
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
