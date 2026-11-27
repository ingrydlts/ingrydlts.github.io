// Testa crm-sequencia-pausas.sql (a pergunta "os e-mails automáticos devem parar?" quando a pessoa marca um 1:1) num Postgres efêmero (PGlite),
// em cima dos arquivos reais do CRM. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node crm-sequencia-pausas.test.mjs
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
const q = async (sql, p) => (await db.query(sql, p)).rows;
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asService = (fn) => asRole('service_role', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const asAnon = (fn) => asRole('anon', null, fn);
const pendentes = (agora) => asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [agora]));
const nomes = (rows) => rows.map((r) => r.nome).sort().join(',');
const min = (t, n) => new Date(t.getTime() + n * 60000).toISOString();

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql', 'crm-saude-porta-ponto.sql', 'crm-assinaturas.sql', 'crm-pagamentos.sql', 'crm-compras.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-sequencia-pausas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  check('roda a 2ª vez sem erro (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana0] = await q("insert into auth.users (email, email_confirmed_at) values ('ana.conta@example.com', now()) returning id");

  console.log('== Segurança ==');
  const fns = await q(`select proname, prosecdef, proconfig, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc
    from pg_proc p where proname in ('crm_sequencia_pausa_abrir', 'crm_sequencia_pausa_decidir', 'crm_sequencia_pausa_decidir_admin', 'crm_sequencia_pendentes') order by 1`);
  const f = (n) => fns.find((x) => x.proname === n);
  check('todas são security definer com search_path fixo', fns.length === 4 && fns.every((x) => x.prosecdef && /search_path/.test(String(x.proconfig))));
  check('abrir, decidir (link) e pendentes: só o Worker (service_role)', ['crm_sequencia_pausa_abrir', 'crm_sequencia_pausa_decidir', 'crm_sequencia_pendentes'].every((n) => !f(n).anon && !f(n).auth && f(n).svc));
  check('decidir pela ficha: só quem está logada (nunca anônimo)', !f('crm_sequencia_pausa_decidir_admin').anon && f('crm_sequencia_pausa_decidir_admin').auth);
  check('a tabela: anônimo sem acesso', !(await attempt(() => asAnon(() => q('select * from sequencia_pausas')))).ok);

  console.log('== Quando a pergunta abre ==');
  const T = new Date(Date.now() - 5 * 36e5);
  const novo = async (nome, { email } = {}) => (await q("insert into contatos (email, nome) values ($1, $2) returning id", [email || nome.toLowerCase() + '@example.com', nome]))[0].id;
  const um = async (cid, status = 'agendado') => (await q("insert into um_a_um (contato_id, quando, status) values ($1, now() + interval '3 days', $2) returning id", [cid, status]))[0].id;
  const abrir = (id) => asService(() => q('select crm_sequencia_pausa_abrir($1) r', [id])).then((r) => r[0].r);
  const anaId = await novo('Ana'), biaId = await novo('Bia'), caioId = await novo('Caio'), duda = await novo('Duda');
  // Ana comprou há 3 dias; Bia recebeu e-mail de sequência; Caio não está em nenhuma sequência
  await db.query("insert into compras (referencia, slug, email_pagamento, contato_id, valor_centavos, moeda, pago_em, acesso_ate) values ('cs_1','manual-destrave-domiciliacao','ana@example.com',$1,990,'EUR', now() - interval '3 days', now() + interval '300 days')", [anaId]);
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, 'x_seq', 'x', 'entregue', now() - interval '1 day', true)", [biaId]);
  let rAna = await abrir(await um(anaId));
  check('quem comprou há pouco e marca um 1:1: a pergunta abre, com os dados do aviso', rAna.criada === true && rAna.nome === 'Ana' && rAna.email === 'ana@example.com' && Number.isInteger(rAna.pausa_id) && !!rAna.quando);
  check('quem recebeu e-mail de sequência e marca um 1:1: a pergunta abre', (await abrir(await um(biaId))).criada === true);
  const rCaio = await abrir(await um(caioId));
  check('quem não está em nenhuma sequência: não pergunta (nada a pausar)', rCaio.criada === false && rCaio.motivo === 'fora_de_sequencia');
  const umAna = (await q("select um_a_um_id from sequencia_pausas where contato_id = $1", [anaId]))[0].um_a_um_id;
  check('o mesmo 1:1 não pergunta duas vezes (aviso repetido do Cal.com)', (await abrir(umAna)).criada === false);
  check('1:1 cancelado ou inexistente: não pergunta', (await abrir(await um(duda, 'cancelado'))).criada === false && (await abrir(999999)).criada === false);
  check('só o Worker abre: nem anônimo, nem a admin', !(await attempt(() => asAnon(() => q('select crm_sequencia_pausa_abrir(1)')))).ok && !(await attempt(() => asUser(admin.id, () => q('select crm_sequencia_pausa_abrir(1)')))).ok);

  console.log('== O motor: pergunta aberta segura, parar bloqueia, continuar libera ==');
  // sequência simples: 30 minutos depois do cadastro no material guia-x, tipo serviço
  await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave, envio_gatilho, envio_depois_de, envio_minutos, envio_ligado)
    values ('t_seq', 'Teste', 'teste', 'servico', 'x', 'x', true, 'freebie', 'material', 'guia-x', 30, false)`);
  await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, publicado_em) values ('t_seq', 1, 'no_ar', 'Assunto', 'Texto', now())");
  const cad = async (cid, quando) => db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', '{\"origem\":\"guia-x\"}', $2)", [cid, quando]);
  const eva = await novo('Eva'), flor = await novo('Flor');
  await cad(eva, T.toISOString()); await cad(flor, T.toISOString()); await cad(anaId, T.toISOString());
  await db.query("update modelos_email set envio_ligado = true where chave = 't_seq'");
  await db.query("update modelos_email set envio_ligado_em = $1 where chave = 't_seq'", [min(T, -60)]);
  // Ana tem a pergunta aberta; Eva e Flor não
  check('sem pausa: todo mundo da sequência recebe (Eva, Flor)', nomes(await pendentes(min(T, 40))).includes('Eva') && nomes(await pendentes(min(T, 40))).includes('Flor'));
  check('com a pergunta ABERTA, a Ana não recebe (o e-mail fica segurado)', !(await pendentes(min(T, 40))).some((r) => r.nome === 'Ana'));
  check('as outras pessoas não são afetadas (Eva e Flor continuam)', (await pendentes(min(T, 40))).filter((r) => ['Eva', 'Flor'].includes(r.nome)).length === 2);
  const pausaAna = (await q('select id from sequencia_pausas where contato_id = $1', [anaId]))[0].id;
  const decide = (id, d) => asService(() => q('select crm_sequencia_pausa_decidir($1,$2) r', [id, d])).then((r) => r[0].r);
  let d1 = await decide(pausaAna, 'continuar');
  check('"continuar" grava a decisão e libera a Ana', d1.ok && d1.decisao === 'continuar' && d1.ja_decidida === false && (await pendentes(min(T, 40))).some((r) => r.nome === 'Ana'));
  check('um segundo clique (ou o link do "parar") não troca a primeira decisão', (await decide(pausaAna, 'parar')).decisao === 'continuar' && (await decide(pausaAna, 'parar')).ja_decidida === true);
  // Bia: parar
  await cad(biaId, T.toISOString());
  const pausaBia = (await q('select id from sequencia_pausas where contato_id = $1', [biaId]))[0].id;
  check('Bia com a pergunta aberta: não recebe', !(await pendentes(min(T, 40))).some((r) => r.nome === 'Bia'));
  check('"parar" grava a decisão', (await decide(pausaBia, 'parar')).decisao === 'parar');
  check('depois de "parar", a Bia não recebe nada', !(await pendentes(min(T, 40))).some((r) => r.nome === 'Bia'));
  check('mesmo bem depois (dentro da janela de outra sequência), a Bia continua parada', !(await pendentes(min(T, 100))).some((r) => r.nome === 'Bia'));
  check('decisão inválida e pausa inexistente são recusadas', !(await attempt(() => decide(pausaAna, 'talvez'))).ok && (await decide(424242, 'parar')).ok === false);
  check('se ela marcar outro 1:1 depois de parada, não pergunta de novo', (await abrir(await um(biaId))).criada === false);

  console.log('== A decisão pela ficha (admin) ==');
  const adm = (id, d) => asUser(admin.id, () => q('select crm_sequencia_pausa_decidir_admin($1,$2) r', [id, d])).then((r) => r[0].r);
  check('a admin retoma uma sequência parada ("continuar")', (await adm(pausaBia, 'continuar')).ok === true && (await pendentes(min(T, 40))).some((r) => r.nome === 'Bia'));
  check('uma pessoa comum não decide pela ficha', !(await attempt(() => asUser(ana0.id, () => q('select crm_sequencia_pausa_decidir_admin($1,$2)', [pausaBia, 'parar'])))).ok);
  check('anônimo não decide', !(await attempt(() => asAnon(() => q('select crm_sequencia_pausa_decidir_admin($1,$2)', [pausaBia, 'parar'])))).ok);
  check('a admin lê as pausas; a pessoa comum não lê nenhuma', (await asUser(admin.id, () => q('select * from sequencia_pausas'))).length >= 2 && (await asUser(ana0.id, () => q('select * from sequencia_pausas'))).length === 0);
  check('a admin não grava direto na tabela (só pela função)', !(await attempt(() => asUser(admin.id, () => q("update sequencia_pausas set decisao = 'parar'")))).ok);

  console.log('== Limpeza e sem resposta ==');
  const gil = await novo('Gil'); await cad(gil, T.toISOString());
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, 'x_seq', 'x', 'entregue', now(), true)", [gil]);
  await abrir(await um(gil));
  check('sem resposta, nada sai: nem na hora, nem depois', !(await pendentes(min(T, 40))).some((r) => r.nome === 'Gil') && !(await pendentes(min(T, 300))).some((r) => r.nome === 'Gil'));
  await db.query('delete from contatos where id = $1', [gil]);
  check('apagar a pessoa apaga a pausa', (await q('select count(*)::int n from sequencia_pausas where contato_id = $1', [gil]))[0].n === 0);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
