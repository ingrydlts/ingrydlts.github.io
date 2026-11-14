// Testa crm-saude-i06.sql (a página de saúde, I06, no CRM: página aceita pelo banco, porta gravada no cadastro do guia e filtro de
// porta no envio) num Postgres efêmero (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:saude
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
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asService = (fn) => asRole('service_role', null, fn);
const pendentes = (agora) => asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [agora]));
const quem = (rows, chave) => rows.filter((r) => r.chave === chave).map((r) => r.nome).sort().join(',');
const dia = (hhmm) => new Date('2026-11-10T' + hhmm + ':00-03:00').toISOString();

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
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-taxonomia-modelos.sql', 'crm-pagina-i05.sql', 'crm-sequencia-minutos.sql', 'crm-sequencia-previsao.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  console.log('\n== crm-saude-i06.sql ==');
  const sql = readFileSync(path.resolve(HERE, '../crm-saude-i06.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);

  console.log('\n== A página I06 no banco ==');
  await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave)
    values ('t_i06', 'Teste I06', 'teste', 'servico', 'x', 'x', true, 'freebie')`);
  const pg = (v, et) => attempt(() => db.query('update modelos_email set pagina = $1, etapa = $2 where chave = $3', [v, et, 't_i06']));
  check('I06 é aceita como página', (await pg('I06', null)).ok);
  check('I06 com a etapa sau-sem-numero é aceita', (await pg('I06', 'sau-sem-numero')).ok);
  check('I05 continua aceita', (await pg('I05', null)).ok);
  check('I07 é recusada', !(await pg('I07', null)).ok);

  console.log('\n== O cadastro do guia grava a porta ==');
  const lead = (extra) => asAnon(() => db.query('select capturar_lead_guia($1) r', [JSON.stringify({
    guia: 'saude-1', nome: 'Pessoa', origem: 'guia-saude-1', aceita_servico: true, consentimento_versao: 'guia-v1',
    texto_servico: 'Li e aceito.', ...extra })]));
  const resp = async (email) => (await q('select respostas from contatos where email = $1', [email]))[0]?.respostas;
  const ok1 = await attempt(() => lead({ email: 'ana@example.com', respostas: { porta: 'aupair', objetivo: 'sau-sem-numero' } }));
  check('cadastro com porta e ponto passa', ok1.ok); if (!ok1.ok) console.log(ok1.error.message);
  const ra = await resp('ana@example.com');
  check('grava a porta e o ponto (objetivo)', ra.porta === 'aupair' && ra.objetivo === 'sau-sem-numero');
  const evt = (await q("select dados from eventos e join contatos c on c.id = e.contato_id where c.email = 'ana@example.com' and e.tipo = 'quiz_respondido'"))[0];
  check('o quiz_respondido na linha do tempo mostra a porta', evt && evt.dados.porta === 'aupair');
  for (const [i, ruim] of [['AuPair'], ['x; drop table contatos'], [''], ['outra'], [123], [null]].entries()) {
    const email = 'ruim' + i + '@example.com';
    const r = await attempt(() => lead({ email, respostas: { porta: ruim[0], objetivo: 'sau-completo' } }));
    const rr = r.ok ? await resp(email) : null;
    check('porta inválida (' + JSON.stringify(ruim[0]) + ') não derruba o cadastro nem grava lixo', r.ok && rr && !('porta' in rr) && rr.objetivo === 'sau-completo');
  }
  const semPorta = await attempt(() => lead({ email: 'sem@example.com', respostas: { objetivo: 'sau-esperando' } }));
  check('sem porta o cadastro segue', semPorta.ok && !('porta' in (await resp('sem@example.com'))));
  const volta = await attempt(() => lead({ email: 'ana@example.com', respostas: { objetivo: 'sau-completo' } }));
  check('quem volta sem porta mantém a porta de antes', volta.ok && (await resp('ana@example.com')).porta === 'aupair');
  const muda = await attempt(() => lead({ email: 'ana@example.com', respostas: { porta: 'trabalho' } }));
  check('quem volta com outra porta troca a porta', muda.ok && (await resp('ana@example.com')).porta === 'trabalho');
  const mau = await attempt(() => lead({ email: 'invalido', respostas: { porta: 'aupair' } }));
  check('e-mail inválido continua dando erro', !mau.ok && /email_invalido/.test(mau.error.message));
  const sem = await attempt(() => lead({ email: 'sem-aceite@example.com', aceita_servico: false, respostas: { porta: 'aupair' } }));
  check('sem consentimento continua dando erro', !sem.ok && /consentimento_obrigatorio/.test(sem.error.message));
  const fn = await q(`select has_function_privilege('anon', 'public.capturar_lead_guia(jsonb)', 'execute') anon, prosecdef, proconfig
    from pg_proc where proname = 'capturar_lead_guia'`);
  check('capturar_lead_guia: anon executa, security definer, search_path fixo', fn[0].anon === true && fn[0].prosecdef && /search_path/.test(String(fn[0].proconfig)));

  console.log('\n== O filtro de porta no envio ==');
  async function modelo(chave, para) {
    await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave, para_quem,
        envio_gatilho, envio_depois_de, envio_minutos) values ($1, $1, 'teste', 'servico', 'x', 'x', true, 'freebie', $2::jsonb, 'material', 'guia-saude-1', 30)`,
      [chave, JSON.stringify(para)]);
    await db.query(`insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, corpo_html, blocos, publicado_em)
      values ($1, 1, 'no_ar', 'x', 'x', 'x', '{"v":1,"itens":[]}', now())`, [chave]);
    await db.query('update modelos_email set envio_ligado = true where chave = $1', [chave]);
    await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', [chave, dia('08:00')]);
  }
  async function pessoa(nome, quando, resp) {
    const [c] = await q("insert into contatos (email, nome, persona, respostas) values ($1, $2, 'campus_france', $3::jsonb) returning id",
      [nome.toLowerCase() + '@teste.com', nome, JSON.stringify(resp || {})]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem: 'guia-saude-1' }, quando]);
    return c.id;
  }
  await pessoa('Lia', dia('09:00'), { porta: 'aupair', objetivo: 'sau-sem-numero' });
  await pessoa('Max', dia('09:01'), { porta: 'trabalho', objetivo: 'sau-sem-numero' });
  await pessoa('Noa', dia('09:02'), { porta: 'aupair', objetivo: 'sau-completo' });
  await pessoa('Ola', dia('09:03'), { objetivo: 'sau-sem-numero' });       // não marcou porta
  await pessoa('Pia', dia('09:04'), {});                                    // lead antigo
  const agora = dia('12:00');
  await modelo('t_qualquer', { materiais: ['guia-saude-1'] });
  await modelo('t_aupair', { materiais: ['guia-saude-1'], portas: ['aupair'] });
  await modelo('t_ponto', { materiais: ['guia-saude-1'], etapas: ['sau-sem-numero'] });
  await modelo('t_aupair_ponto', { materiais: ['guia-saude-1'], portas: ['aupair'], etapas: ['sau-sem-numero'] });
  await modelo('t_duas', { materiais: ['guia-saude-1'], portas: ['aupair', 'trabalho'] });
  const p = await pendentes(agora);
  check('sem regra de porta: todas passam (inclusive quem não marcou e o lead antigo)', quem(p, 't_qualquer') === 'Lia,Max,Noa,Ola,Pia');
  check('porta aupair: só quem marcou aupair (Lia e Noa)', quem(p, 't_aupair') === 'Lia,Noa');
  check('só o ponto sau-sem-numero: Lia, Max e Ola', quem(p, 't_ponto') === 'Lia,Max,Ola');
  check('porta e ponto juntos valem pela interseção (só a Lia)', quem(p, 't_aupair_ponto') === 'Lia');
  check('duas portas: Lia, Max e Noa; quem não marcou fica de fora', quem(p, 't_duas') === 'Lia,Max,Noa');
  const lia = p.find((r) => r.nome === 'Lia' && r.chave === 't_aupair');
  check('a porta chega ao Worker em dados.respostas', lia && lia.dados.respostas.porta === 'aupair' && lia.dados.respostas.objetivo === 'sau-sem-numero');
  const y = await asRole('authenticated', admin.id, async () => (await q("select public.crm_sequencia_previstos('t_aupair', $1) y", [dia('08:30')]))[0].y);
  check('o Y respeita a porta (Lia e Noa) = 2', y === 2);
  const anonHelper = await attempt(() => asAnon(() => q("select * from public.crm_sequencia_candidatos('t_aupair', now(), now(), false)")));
  check('anon não chama o helper', !anonHelper.ok);
  const hp = await q("select has_function_privilege('authenticated', 'public.crm_sequencia_candidatos(text, timestamptz, timestamptz, boolean)', 'execute') a, has_function_privilege('service_role', 'public.crm_sequencia_candidatos(text, timestamptz, timestamptz, boolean)', 'execute') s");
  check('o helper continua sem EXECUTE para authenticated e service_role', hp[0].a === false && hp[0].s === false);

  console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
