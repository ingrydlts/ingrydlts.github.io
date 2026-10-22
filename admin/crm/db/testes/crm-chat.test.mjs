// Testa crm-chat.sql (o chat entre você e a pessoa, com propostas dentro) num Postgres efêmero (PGlite).
// Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:chat
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
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-chat.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);
  await db.exec('create publication supabase_realtime');
  check('com Realtime: roda e roda de novo', (await attempt(() => db.exec(sql))).ok && (await attempt(() => db.exec(sql))).ok);
  const pub = (await q("select tablename from pg_publication_tables where pubname='supabase_realtime'")).map((r) => r.tablename);
  check('Realtime recebe chat_mensagens e propostas', pub.includes('chat_mensagens') && pub.includes('propostas'));

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  for (const [u, e] of [[ana, 'ana@example.com'], [bia, 'bia@example.com']])
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [e, u.id]);
  const [cAna] = await q("select id from contatos where email='ana@example.com'");
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const env = (cid, texto, prop, quem = admin.id) => asUser(quem, () => db.query('select crm_chat_enviar($1, $2, $3) as id', [cid, texto, prop ? JSON.stringify(prop) : null]));
  const meu = async (quem) => (await asUser(quem, () => db.query('select * from meu_chat()'))).rows;
  const msgs = async (cid) => q('select * from chat_mensagens where contato_id=$1 order by id', [cid]);

  console.log('\n== Permissões ==');
  check('anon não chama as funções', !(await attempt(() => asAnon(() => db.query("select chat_enviar('oi')")))).ok && !(await attempt(() => asAnon(() => db.query('select * from meu_chat()')))).ok && !(await attempt(() => asAnon(() => db.query("select crm_chat_enviar($1,'x')", [cAna.id])))).ok);
  check('pessoa logada não usa crm_chat_enviar', !(await attempt(() => env(cBia.id, 'oi', null, ana.id))).ok);
  check('pessoa logada não escreve direto na tabela (RLS)', !(await attempt(() => asUser(ana.id, () => db.query("insert into chat_mensagens (contato_id, de, texto) values ($1,'pessoa','x')", [cAna.id])))).ok);
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from chat_mensagens')))).ok);

  console.log('\n== Você escreve ==');
  await env(cAna.id, '  Oi, Ana!  ');
  const m1 = (await msgs(cAna.id))[0];
  check('texto simples: de ingryd, aparado, sem proposta', m1.de === 'ingryd' && m1.tipo === 'texto' && m1.texto === 'Oi, Ana!' && m1.proposta_id === null && m1.lida_em === null);
  check('mensagem vazia ou gigante é recusada', !(await attempt(() => env(cAna.id, '   '))).ok && !(await attempt(() => env(cAna.id, 'a'.repeat(1001)))).ok && !(await attempt(() => env(cAna.id, null))).ok);
  check('contato que não existe é recusado', !(await attempt(() => env('00000000-0000-0000-0000-000000000000', 'oi'))).ok);

  console.log('\n== Proposta dentro do chat ==');
  const prazo = new Date(Date.now() + 864e5).toISOString();
  await env(cAna.id, null, { titulo: 'Um 1:1 de 20 minutos?', texto: 'Tenho horário na quinta.', acao_sim: 'Te mando os horários por aqui.', prazo, link: 'https://exemplo.com/h', link_rotulo: 'Ver horários' });
  const m2 = (await msgs(cAna.id))[1], [p] = await q('select * from propostas where id=$1', [m2.proposta_id]);
  check('cria a proposta e a mensagem juntas', m2.tipo === 'proposta' && m2.texto === 'Um 1:1 de 20 minutos?' && p && p.contato_id === cAna.id && p.status === 'enviada');
  check('guarda o "o que acontece no sim", o prazo e o link', p.acao_sim === 'Te mando os horários por aqui.' && p.link === 'https://exemplo.com/h' && p.link_rotulo === 'Ver horários' && new Date(p.prazo).getTime() === new Date(prazo).getTime());
  check('a proposta vira evento proposta_enviada (gatilho de antes)', (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='proposta_enviada'", [cAna.id]))[0].n === 1);
  const nProp = (await q('select count(*)::int n from propostas'))[0].n, nMsg = (await q('select count(*)::int n from chat_mensagens'))[0].n;
  for (const [rot, pr] of [['sem título', { titulo: '', texto: 'x' }], ['título gigante', { titulo: 'a'.repeat(121), texto: 'x' }], ['texto vazio', { titulo: 'T', texto: '' }],
    ['link http', { titulo: 'T', texto: 'x', link: 'http://x.com' }], ['não é objeto', 'texto']])
    check('proposta inválida (' + rot + ') não deixa nada pela metade', !(await attempt(() => env(cAna.id, null, pr))).ok && (await q('select count(*)::int n from propostas'))[0].n === nProp && (await q('select count(*)::int n from chat_mensagens'))[0].n === nMsg);

  console.log('\n== Ela vê só a dela ==');
  await env(cBia.id, 'Só da Bia.');
  const a = await meu(ana.id);
  check('Ana vê as suas, da mais nova para a mais antiga, e não a da Bia', a.length === 2 && a[0].tipo === 'proposta' && a[1].texto === 'Oi, Ana!');
  check('a proposta vem junto, com o estado e a ação', a[0].proposta.titulo === 'Um 1:1 de 20 minutos?' && a[0].proposta.status === 'enviada' && a[0].proposta.acao_sim === 'Te mando os horários por aqui.' && a[0].proposta.expirada === false);
  check('mensagem de texto vem sem proposta', a[1].proposta === null);
  check('Ana lê as suas pela tabela (Realtime), não as da Bia', (await asUser(ana.id, () => db.query('select * from chat_mensagens'))).rows.length === 2);
  check('Ana não altera mensagem nenhuma direto', (await asUser(ana.id, () => db.query("update chat_mensagens set texto='x'"))).rowCount === 0);
  check('admin lê tudo', (await asUser(admin.id, () => db.query('select * from chat_mensagens'))).rows.length === 3);

  console.log('\n== Responder a proposta (função de antes) aparece no chat ==');
  await asUser(ana.id, () => db.query("select responder_proposta($1,'aceitar')", [m2.proposta_id]));
  const a2 = await meu(ana.id);
  check('depois do Sim a proposta vem aceita', a2[0].proposta.status === 'aceita');

  console.log('\n== Ela escreve ==');
  await asUser(ana.id, () => db.query("select chat_enviar('  Quero um 1:1 de 20 minutos.  ', 'pedido_1a1')"));
  const m3 = (await msgs(cAna.id)).pop();
  check('mensagem dela: de pessoa, aparada, com a ação do botão', m3.de === 'pessoa' && m3.texto === 'Quero um 1:1 de 20 minutos.' && m3.acao === 'pedido_1a1');
  check('grava na ficha de quem chamou (Bia não ganhou nada)', (await msgs(cBia.id)).filter((m) => m.de === 'pessoa').length === 0);
  const ev = await q("select dados from eventos where contato_id=$1 and tipo='chat_mensagem'", [cAna.id]);
  check('vira evento na linha do tempo, com o trecho e a ação', ev.length === 1 && ev[0].dados.trecho === 'Quero um 1:1 de 20 minutos.' && ev[0].dados.acao === 'pedido_1a1');
  await db.query("update contatos set ultimo_evento_em = now() - interval '20 days' where id=$1", [cAna.id]);
  await asUser(ana.id, () => db.query("select chat_enviar('Oi de novo')"));
  check('o que ela escreve conta como atividade dela (zera o "parada há N dias")', (await q('select ultimo_evento_em from contatos where id=$1', [cAna.id]))[0].ultimo_evento_em > new Date(Date.now() - 60e3));
  const bad = async (t, ac) => !(await attempt(() => asUser(ana.id, () => db.query('select chat_enviar($1,$2)', [t, ac || null])))).ok;
  check('recusa vazio, gigante e ação desconhecida', await bad('  ') && await bad('a'.repeat(1001)) && await bad('oi', 'hack'));
  check('quem não tem ficha não escreve', !(await attempt(async () => { const [x] = await q("insert into auth.users (email) values ('x@example.com') returning id"); await db.query('delete from contatos where user_id=$1', [x.id]); return asUser(x.id, () => db.query("select chat_enviar('oi')")); })).ok);
  for (let i = 0; i < 18; i++) await asUser(ana.id, () => db.query("select chat_enviar('spam')"));
  check('limite: no máximo 20 mensagens em 10 minutos', await bad('mais uma'));

  console.log('\n== Lidas ==');
  check('o que você mandou começa não lido', (await msgs(cAna.id)).filter((m) => m.de === 'ingryd' && m.lida_em === null).length === 2);
  await asUser(ana.id, () => db.query('select chat_marcar_lidas()'));
  check('ela abriu o chat: as suas ficam lidas', (await msgs(cAna.id)).filter((m) => m.de === 'ingryd').every((m) => m.lida_em !== null));
  check('as da Bia continuam não lidas (cada uma marca só as suas)', (await msgs(cBia.id))[0].lida_em === null);
  check('as mensagens DELA não são marcadas por ela', (await msgs(cAna.id)).filter((m) => m.de === 'pessoa').every((m) => m.lida_em === null));
  await asUser(admin.id, () => db.query("update chat_mensagens set lida_em = now() where contato_id=$1 and de='pessoa' and lida_em is null", [cAna.id]));
  check('você marca as dela como lidas pela tabela', (await msgs(cAna.id)).filter((m) => m.de === 'pessoa').every((m) => m.lida_em !== null));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
