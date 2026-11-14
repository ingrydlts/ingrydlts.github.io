// Testa crm-respostas-porta-ponto.sql (a porta e o ponto da saúde da página S2 chegam ao e-mail) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:porta-ponto
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerar, CHAVE } from '../modelo-tecnologo-recap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asRole(role, fn) {
  await db.exec(`set role ${role};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
const asAnon = (fn) => asRole('anon', fn);
const asService = (fn) => asRole('service_role', fn);

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const modelosAntes = await q('select * from modelos_email order by chave');

  console.log('\n== crm-respostas-porta-ponto.sql ==');
  const sql = readFileSync(path.resolve(HERE, '../crm-respostas-porta-ponto.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  check('nenhum modelo mudou', JSON.stringify(modelosAntes) === JSON.stringify(await q('select * from modelos_email order by chave')));
  const tabelas = await q("select count(*)::int n from information_schema.tables where table_schema = 'public'");
  check('nenhuma tabela nova (só as funções mudam)', tabelas[0].n > 0 && !/porta|ponto/.test(sql.replace(/--.*$/gm, '').match(/create table[^;]*/gi)?.join(' ') || ''));

  console.log('\n== Segurança das duas funções ==');
  const fn = (nome) => q(`select prosecdef, proconfig, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc from pg_proc p where proname = '${nome}'`);
  const g = await fn('capturar_lead_guia');
  check('capturar_lead_guia: uma só função, security definer, search_path fixo', g.length === 1 && g[0].prosecdef && /search_path/.test(String(g[0].proconfig)));
  check('capturar_lead_guia: continua executável por anon e authenticated (a porta de entrada do site)', g[0].anon && g[0].auth);
  const s = await fn('crm_sequencia_pendentes');
  check('crm_sequencia_pendentes: uma só função, security definer, search_path fixo', s.length === 1 && s[0].prosecdef && /search_path/.test(String(s[0].proconfig)));
  check('crm_sequencia_pendentes: só service_role executa', !s[0].anon && !s[0].auth && s[0].svc);

  console.log('\n== A página manda porta e ponto ==');
  const lead = (extra) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'etudes-en-france-2027-2028', email: 'ana@example.com', nome: 'Ana', persona: 'campus_france',
    origem: 'guia-etudes-en-france-2027', aceita_servico: true, consentimento_versao: 'guia-v1',
    texto_servico: 'Li e aceito.', respostas: { objetivo: 'cf-nao-comecei' }, ...extra })]));
  const resp = async (email) => (await q('select respostas from contatos where email = $1', [email]))[0].respostas;

  let r = await attempt(() => lead({ respostas: { objetivo: 'cf-nao-comecei', porta: 'estudante', ponto: 'sem_numero' } }));
  check('o cadastro passa', r.ok); if (!r.ok) console.log(r.error.message);
  let ana = await resp('ana@example.com');
  check('grava porta e ponto em respostas', ana.porta === 'estudante' && ana.ponto === 'sem_numero');
  check('o que já era gravado continua (objetivo)', ana.objetivo === 'cf-nao-comecei');
  const [quiz] = await q("select e.dados from eventos e join contatos c on c.id = e.contato_id where c.email = 'ana@example.com' and e.tipo = 'quiz_respondido' order by e.criado_em desc limit 1");
  check('o quiz_respondido da chamada mostra porta e ponto', quiz.dados.porta === 'estudante' && quiz.dados.ponto === 'sem_numero');
  check('devolve o link do Notion como antes', /^https:\/\/topordentroviagens\.notion\.site\//.test(r.value?.rows[0].r.notion_url || ''));

  await lead({ email: 'bia@example.com', nome: 'Bia', respostas: { porta: 'hacker', ponto: '<script>' } });
  const bia = await resp('bia@example.com');
  check('valores fora da lista são ignorados', bia.porta === undefined && bia.ponto === undefined);
  await lead({ email: 'caio@example.com', nome: 'Caio', respostas: { porta: 'trabalho', ponto: 'qualquer_coisa' } });
  const caio = await resp('caio@example.com');
  check('porta válida e ponto inválido: grava só a porta', caio.porta === 'trabalho' && caio.ponto === undefined);
  await lead({ email: 'duda@example.com', nome: 'Duda', respostas: { objetivo: 'cf-nao-comecei', cfNivel: 'l1', porta: 'aupair', ponto: 'esperando' } });
  const duda = await resp('duda@example.com');
  check('o nível do Campus France continua sendo gravado junto', duda.cfNivel === 'l1' && duda.porta === 'aupair' && duda.ponto === 'esperando');
  await lead({ email: 'ana@example.com', respostas: { objetivo: 'cf-nao-comecei', porta: 'estudante', ponto: 'esperando' } });
  check('quem volta e responde de novo atualiza o ponto', (await resp('ana@example.com')).ponto === 'esperando');
  await lead({ email: 'eva@example.com', nome: 'Eva', respostas: { objetivo: 'cf-nao-comecei' } });
  const eva = await resp('eva@example.com');
  check('sem porta nem ponto (guias de hoje): nada muda', eva.porta === undefined && eva.ponto === undefined && eva.objetivo === 'cf-nao-comecei');

  let todas = true, n = 0;
  for (const porta of ['estudante', 'trabalho', 'aupair', 'outro']) for (const ponto of ['nao_cheguei', 'sem_numero', 'esperando', 'sem_vitale', 'completo']) {
    const email = `p${n++}@example.com`;
    await lead({ email, nome: 'P' + n, respostas: { porta, ponto } });
    const x = await resp(email);
    todas = todas && x.porta === porta && x.ponto === ponto;
  }
  check('as 4 portas e os 5 pontos (20 personas) são aceitos', todas);
  check('anônimo não lê as respostas de ninguém', (await attempt(() => asAnon(() => q('select respostas from contatos')))).ok === false || (await asAnon(() => q('select respostas from contatos'))).length === 0);

  console.log('\n== O Worker recebe porta e ponto ==');
  const sqlModelo = gerar();
  await db.exec(sqlModelo);
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = $1", [CHAVE]);
  const T = new Date(Date.now() - 5 * 36e5);
  async function pessoa(nome, respostas) {
    const [c] = await q("insert into contatos (email, nome, persona, respostas) values ($1, $2, 'campus_france', $3) returning id",
      [nome.toLowerCase() + '.seq@example.com', nome, respostas]);
    await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', false, 'teste')", [c.id]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem: 'guia-tecnologo' }, T.toISOString()]);
    return c.id;
  }
  await db.query('update modelos_email set envio_ligado = true where chave = $1', [CHAVE]);
  await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', [CHAVE, new Date(T.getTime() - 3600e3).toISOString()]);
  await pessoa('Fabi', { objetivo: 'tec-escrevi', porta: 'trabalho', ponto: 'sem_numero' });
  await pessoa('Gabi', { objetivo: 'tec-escrevi' });
  const lista = await asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [new Date(T.getTime() + 40 * 60000).toISOString()]));
  const fabi = lista.find((x) => x.nome === 'Fabi'), gabi = lista.find((x) => x.nome === 'Gabi');
  check('a lista traz porta e ponto em dados.respostas', fabi && fabi.dados.respostas.porta === 'trabalho' && fabi.dados.respostas.ponto === 'sem_numero');
  check('quem não respondeu continua saindo, só sem porta e ponto', gabi && gabi.dados.respostas.porta === undefined && gabi.dados.respostas.ponto === undefined && gabi.dados.respostas.objetivo === 'tec-escrevi');
  check('o resto do que o Worker lê não mudou (e-mail, versão, tipo, objetivo)', fabi.email.endsWith('@example.com') && fabi.versao === 1 && fabi.tipo === 'servico' && fabi.dados.respostas.objetivo === 'tec-escrevi');

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
