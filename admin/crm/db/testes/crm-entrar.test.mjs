// Testa crm-entrar.sql (aceitar o convite de acesso: consentimento e publicação do que você liberou; o cartão e o teste são do Stripe) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:entrar
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql', 'crm-caso-listas.sql', 'crm-montagem.sql', 'crm-montagem-aplicar.sql', 'crm-assinaturas.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-entrar.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [uAna] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await db.query("insert into contatos (email, nome, user_id, estagio) values ('ana@example.com', 'Ana Souza', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [uAna.id]);
  await db.query("insert into contatos (email, nome, estagio) values ('bia@example.com', 'Bia Lima', 'lead')");
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id, cBia = (await um("select id from contatos where email='bia@example.com'")).id;
  const TEXTO = 'Aceito usar a plataforma Por Dentro e receber mensagens do serviço sobre o meu caso.';
  const consentir = (c, versao = 'entrar-v1', texto = TEXTO) => asRole('service_role', null, () => um('select crm_entrar_consentir($1,$2,$3) r', [c, versao, texto])).then((x) => x.r);
  const item = (c, tipo, titulo, dados = {}) => um('insert into board_itens (contato_id, tipo, titulo, dados) values ($1,$2,$3,$4) returning id', [c, tipo, titulo, JSON.stringify(dados)]);

  console.log('== Quem pode registrar o aceite ==');
  check('só o servidor (service_role) executa crm_entrar_consentir: a pessoa, o admin e o anônimo não', await falha(() => asUser(uAna.id, () => db.query('select crm_entrar_consentir($1,$2,$3)', [cBia, 'v', TEXTO]))) && await falha(() => asUser(admin.id, () => db.query('select crm_entrar_consentir($1,$2,$3)', [cBia, 'v', TEXTO]))) && !(await attempt(() => asAnon(() => db.query('select crm_entrar_consentir($1,$2,$3)', [cBia, 'v', TEXTO])))).ok);
  check('consentimento sem texto ou sem versão e contato inexistente são recusados', await falha(() => consentir(cBia, 'v', 'curto'), 'consentimento_invalido') && await falha(() => consentir(cBia, '', TEXTO), 'consentimento_invalido') && await falha(() => consentir('00000000-0000-4000-8000-000000000000'), 'contato_nao_encontrado'));

  console.log('\n== O aceite: só o consentimento (o cartão e o teste de 7 dias são do Stripe) ==');
  await item(cBia, 'documento', 'Documento revisado', { rotulo: 'x' }); await db.query("update board_itens set estado='revisado', origem_chave='doc:diploma' where contato_id=$1", [cBia]);
  await item(cBia, 'bilan', 'Bilan editado pela metade', {}); await db.query("update board_itens set estado='revisado' where contato_id=$1 and tipo='bilan'", [cBia]);
  await item(cBia, 'escola', 'Escola ainda proposta', {});
  await um("insert into caso_listas (contato_id, chave, titulo, origem_chave) values ($1,'dossie','Dossiê','lista:dossie') returning id", [cBia]); await db.query("update caso_listas set estado='revisado' where contato_id=$1", [cBia]);
  const r = await consentir(cBia);
  check('devolve ok e NÃO cria assinatura nem conta: quem abre o teste é o pagamento no Stripe', r.ok === true && (await um('select count(*)::int n from assinaturas where contato_id=$1', [cBia])).n === 0);
  const cons = await um("select * from consentimentos where contato_id=$1 and finalidade='servico' order by id desc limit 1", [cBia]);
  check('o consentimento "servico" fica gravado com a versão e o texto exato que ela viu', cons.aceito === true && cons.versao === 'entrar-v1' && cons.texto === TEXTO && cons.origem === 'entrar');
  check('o evento convite_aceito entra na linha do tempo', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='convite_aceito'", [cBia])).n === 1);
  check('o que veio da montagem e foi liberado (revisado) é publicado; um Bilan que ela só editou e o que ainda é proposta, não', (await um("select estado from board_itens where contato_id=$1 and titulo='Documento revisado'", [cBia])).estado === 'publicado' && (await um("select estado from board_itens where contato_id=$1 and tipo='bilan'", [cBia])).estado === 'revisado' && (await um("select estado from board_itens where contato_id=$1 and titulo='Escola ainda proposta'", [cBia])).estado === 'proposto' && (await um("select estado from caso_listas where contato_id=$1", [cBia])).estado === 'publicado');
  await consentir(cBia);
  check('aceitar de novo com a mesma versão não duplica o consentimento', (await um("select count(*)::int n from consentimentos where contato_id=$1 and finalidade='servico' and versao='entrar-v1'", [cBia])).n === 1);
  await consentir(cBia, 'entrar-v2');
  check('versão nova do texto grava um consentimento novo', (await um("select count(*)::int n from consentimentos where contato_id=$1 and finalidade='servico'", [cBia])).n === 2);
  await db.query("insert into assinaturas (contato_id, status, plano, teste_fim) values ($1, 'trialing', 'Mensal', now() + interval '7 days')", [cAna]);
  check('depois do pagamento no Stripe a conta ligada à ficha entra (meu_acesso do banco, que já existia)', (await asUser(uAna.id, () => um('select meu_acesso() r'))).r.acesso === true);

  console.log('\n== O botão de convite sabe se há espaço pronto ==');
  const pub = (c) => asUser(admin.id, () => um('select crm_montagem_publicavel($1) r', [c])).then((x) => x.r);
  await q("insert into auth.users (email) values ('dan@example.com') returning id");   // e-mail ainda não confirmado: a conta não se liga à ficha
  await db.query("insert into contatos (email, nome) values ('dan@example.com', 'Dan') on conflict (email) do nothing");
  const cDan = (await um("select id from contatos where email='dan@example.com'")).id;
  let p = await pub(cDan);
  check('sem nada revisado: não há espaço pronto, e ela ainda não tem conta', p.ha_rascunho_aprovado === false && p.itens_prontos === 0 && p.conta_ja_existe === false);
  const it = await item(cDan, 'documento', 'Doc', { rotulo: 'x' });
  p = await pub(cDan);
  check('item só proposto ainda não conta como pronto', p.itens_prontos === 0 && p.itens_proposta === 1);
  await db.query("update board_itens set estado='revisado' where id=$1", [it.id]);
  await db.query("insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, publicada_em, a_conferir) values ($1,'Passo com fonte','ela','plataforma','p1', now(), false)", [cDan]);
  await db.query("insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, a_conferir) values ($1,'Passo sem fonte','ela','plataforma','p2', true)", [cDan]);
  p = await pub(cDan);
  check('revisado e passo publicado contam como pronto; o item sem fonte aparece como a conferir', p.ha_rascunho_aprovado === true && p.itens_prontos === 2 && p.itens_a_conferir === 1);
  check('conta_ja_existe é verdadeiro para quem já tem conta ligada à ficha (Ana), e tem_assinatura diz se ela já tem teste ou plano', (await pub(cAna)).conta_ja_existe === true && (await pub(cAna)).tem_assinatura === true && p.tem_assinatura === false);
  await db.query("insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, a_conferir) values ($1,'Passo a conferir','ela','plataforma','p3', true)", [cDan]);
  check('a lista de itens a conferir vem com o id e o título (para o botão "Conferi a fonte")', (await pub(cDan)).a_conferir_itens.some((x) => x.titulo === 'Passo a conferir' && Number.isInteger(x.id)));
  check('só admin consulta; anônimo não executa', await falha(() => asUser(uAna.id, () => db.query('select crm_montagem_publicavel($1)', [cDan])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select crm_montagem_publicavel($1)', [cDan])))).ok);

  console.log('\n== Eventos do convite (só os permitidos) ==');
  const ev = (t, d = {}) => asUser(admin.id, () => db.query('select crm_evento_admin($1,$2,$3::jsonb)', [cDan, t, JSON.stringify(d)]));
  await ev('convite_enviado', { dias: 7 }); await ev('espaco_atualizado_aviso', { montagem: 3 });
  check('convite_enviado e espaco_atualizado_aviso entram na linha do tempo', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo in ('convite_enviado','espaco_atualizado_aviso')", [cDan])).n === 2);
  check('tipo fora da lista, não-admin e anônimo são recusados', await falha(() => ev('assinatura_ativada'), 'evento_nao_permitido') && await falha(() => asUser(uAna.id, () => db.query("select crm_evento_admin($1,'convite_enviado','{}'::jsonb)", [cDan])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query("select crm_evento_admin($1,'convite_enviado','{}'::jsonb)", [cDan])))).ok);

  for (const f of ['crm_entrar_consentir', 'crm_montagem_publicavel', 'crm_evento_admin']) {
    const x = await um("select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec, array_to_string(p.proconfig, ',') as cfg from pg_proc p where p.proname = $1", [f]);
    check(`${f}: security definer, search_path fixo, anon não executa`, x.prosecdef && /search_path=/.test(x.cfg) && !x.anon_exec);
  }
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
