// Testa crm-propostas.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (que vivem no
// repositório POR-DENTRO-APP) e da fase 2 do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:propostas
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-propostas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  const [cAna] = await q("select id from contatos where email='ana@example.com'");
  await db.query("insert into contatos (email, user_id, estagio) values ('bia@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [bia.id]);
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const tipos = async (cid) => (await q('select tipo from eventos where contato_id=$1 and tipo like $2 order by id', [cid, 'proposta_%'])).map((r) => r.tipo);

  console.log('\n== Quem escreve ==');
  const nova = (o) => ({ contato_id: cAna.id, titulo: 'Quer um 1:1?', texto: 'Tenho um horário na quinta.', ...o });
  const ins = (o) => asUser(admin.id, () => db.query('insert into propostas (contato_id, titulo, texto, link, prazo) values ($1,$2,$3,$4,$5) returning id',
    [o.contato_id, o.titulo, o.texto, o.link || null, o.prazo || null]));
  const p1 = (await ins(nova({}))).rows[0].id;
  check('admin cria proposta', !!p1);
  check('pessoa logada não insere direto', !(await attempt(() => asUser(ana.id, () => db.query("insert into propostas (contato_id, titulo, texto) values ($1,'x','y')", [cAna.id])))).ok);
  check('pessoa logada não lê a tabela direto (RLS)', (await asUser(ana.id, () => db.query('select * from propostas'))).rows.length === 0);
  check('pessoa logada não altera direto (RLS)', (await asUser(ana.id, () => db.query("update propostas set status='aceita' where id=$1", [p1]))).rowCount === 0);
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from propostas')))).ok);
  check('anon não chama minhas_propostas', !(await attempt(() => asAnon(() => db.query('select * from minhas_propostas()')))).ok);
  check('link precisa ser https', !(await attempt(() => ins(nova({ link: 'http://x.com' })))).ok && !(await attempt(() => ins(nova({ link: 'javascript:alert(1)' })))).ok);
  check('link https é aceito', (await attempt(() => ins(nova({ link: 'https://exemplo.com/a' })))).ok);
  check('título vazio é recusado', !(await attempt(() => ins(nova({ titulo: '' })))).ok);
  check('texto gigante é recusado', !(await attempt(() => ins(nova({ texto: 'a'.repeat(1001) })))).ok);
  check('enviar vira evento proposta_enviada', (await tipos(cAna.id))[0] === 'proposta_enviada');

  console.log('\n== Só a dona vê ==');
  const minhas = async (u) => (await asUser(u, () => db.query('select * from minhas_propostas()'))).rows;
  check('Ana vê as suas', (await minhas(ana.id)).length >= 1);
  check('Bia não vê as da Ana', (await minhas(bia.id)).length === 0);
  check('Bia não marca a da Ana como vista', ((await asUser(bia.id, () => db.query('select marcar_proposta_vista($1)', [p1]))), (await q('select status from propostas where id=$1', [p1]))[0].status === 'enviada'));
  const rb = await attempt(() => asUser(bia.id, () => db.query("select responder_proposta($1,'aceitar')", [p1])));
  check('Bia não responde a da Ana', !rb.ok && /proposta_nao_encontrada/.test(rb.error.message));

  console.log('\n== Ciclo: enviada → vista → aceita ==');
  await asUser(ana.id, () => db.query('select marcar_proposta_vista($1)', [p1]));
  let [p] = await q('select * from propostas where id=$1', [p1]);
  check('marcar vista: enviada → vista com visto_em', p.status === 'vista' && p.visto_em);
  await asUser(ana.id, () => db.query('select marcar_proposta_vista($1)', [p1]));
  check('marcar vista 2x não duplica evento', (await tipos(cAna.id)).filter((t) => t === 'proposta_vista').length === 1);
  await asUser(ana.id, () => db.query("select responder_proposta($1,'aceitar')", [p1]));
  [p] = await q('select * from propostas where id=$1', [p1]);
  check('aceitar: status aceita com respondido_em', p.status === 'aceita' && p.respondido_em);
  check('aceitar vira evento na linha do tempo', (await tipos(cAna.id)).includes('proposta_aceita'));
  const dep = await attempt(() => asUser(ana.id, () => db.query("select responder_proposta($1,'recusar')", [p1])));
  check('não troca de resposta depois de aceitar', !dep.ok && /proposta_ja_respondida/.test(dep.error.message));

  console.log('\n== Recusar, Agora não, resposta inválida ==');
  const p2 = (await ins(nova({ titulo: 'Oferta' }))).rows[0].id;
  await asUser(ana.id, () => db.query("select responder_proposta($1,'recusar')", [p2]));
  check('recusar direto (sem ver antes) grava recusada + visto_em', (await q('select status, visto_em from propostas where id=$1', [p2]))[0].status === 'recusada');
  check('recusar vira evento', (await tipos(cAna.id)).includes('proposta_recusada'));

  const p3 = (await ins(nova({ titulo: 'Depois' }))).rows[0].id;
  await asUser(ana.id, () => db.query("select responder_proposta($1,'depois')", [p3]));
  [p] = await q('select * from propostas where id=$1', [p3]);
  check('agora não: fica vista e adiada ~3 dias', p.status === 'vista' && p.adiada_ate && p.adiada_ate > new Date(Date.now() + 2.9 * 864e5));
  const t3 = await tipos(cAna.id);
  check('agora não vira proposta_adiada (e não proposta_vista)', t3.filter((t) => t === 'proposta_adiada').length === 1 && t3.filter((t) => t === 'proposta_vista').length === 1);
  await asUser(ana.id, () => db.query("select responder_proposta($1,'aceitar')", [p3]));
  check('depois de adiar ainda pode aceitar', (await q('select status from propostas where id=$1', [p3]))[0].status === 'aceita');

  const p6 = (await ins(nova({}))).rows[0].id;
  const bad = await attempt(() => asUser(ana.id, () => db.query("select responder_proposta($1,'talvez')", [p6])));
  check('resposta fora da lista é recusada', !bad.ok && /resposta_invalida/.test(bad.error.message));

  console.log('\n== Prazo ==');
  const p4 = (await ins(nova({ titulo: 'Vencida', prazo: new Date(Date.now() - 3600e3).toISOString() }))).rows[0].id;
  const exp = await attempt(() => asUser(ana.id, () => db.query("select responder_proposta($1,'aceitar')", [p4])));
  check('proposta vencida não aceita resposta', !exp.ok && /proposta_expirada/.test(exp.error.message));
  const mine = await minhas(ana.id);
  check('minhas_propostas marca expirada=true', mine.find((x) => x.id == p4).expirada === true);
  const p5 = (await ins(nova({ titulo: 'No prazo', prazo: new Date(Date.now() + 864e5).toISOString() }))).rows[0].id;
  check('no prazo: expirada=false e aceita', (await minhas(ana.id)).find((x) => x.id == p5).expirada === false
    && (await attempt(() => asUser(ana.id, () => db.query("select responder_proposta($1,'aceitar')", [p5])))).ok);

  console.log('\n== "Parada há N dias" ==');
  await db.query("update contatos set ultimo_evento_em = now() - interval '20 days' where id=$1", [cBia.id]);
  await ins({ contato_id: cBia.id, titulo: 'Oi', texto: 'Oi' });
  check('enviar proposta (você) não zera o "último sinal" dela', (await q('select ultimo_evento_em from contatos where id=$1', [cBia.id]))[0].ultimo_evento_em < new Date(Date.now() - 19 * 864e5));
  const pb = (await q('select id from propostas where contato_id=$1', [cBia.id]))[0].id;
  await asUser(bia.id, () => db.query("select responder_proposta($1,'recusar')", [pb]));
  check('a resposta dela zera', (await q('select ultimo_evento_em from contatos where id=$1', [cBia.id]))[0].ultimo_evento_em > new Date(Date.now() - 60e3));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
