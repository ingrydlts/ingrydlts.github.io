// Testa crm-pagamentos.sql (o que cada pessoa já pagou: valor, serviço e quando) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:pagamentos
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
const asServico = (fn) => asRole('service_role', null, fn);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const um = async (sql, p) => (await q(sql, p))[0];

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-onboarding.sql', 'crm-assinaturas.sql', 'crm-pagamentos.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-pagamentos.sql'), 'utf8');
  check('roda de novo (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => {
    const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id };
  };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  const reg = (o) => asServico(() => um('select crm_pagamento_registrar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',
    [o.c ?? null, o.ref, o.tipo ?? 'outro', o.servico ?? null, o.valor ?? 2000, o.moeda ?? 'EUR', o.quando ?? '2026-11-17T10:00:00Z', o.sub ?? null, o.cli ?? null, o.email ?? null])).then((x) => x.r);

  console.log('== Quem pode registrar ==');
  const args = [ana.c, 'cs_x', '1a1', '1:1', 2000, 'EUR', '2026-11-17T10:00:00Z', null, null, null];
  const chama = () => db.query('select crm_pagamento_registrar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', args);
  check('só o Worker (service_role): nem anônimo, nem a pessoa, nem a admin', !(await attempt(() => asAnon(chama))).ok && !(await attempt(() => asUser(ana.u.id, chama))).ok && !(await attempt(() => asUser(admin.id, chama))).ok);
  check('valor zero, moeda inválida, tipo desconhecido e referência vazia são recusados', await falha(() => reg({ c: ana.c, ref: 'a', valor: 0 }), 'pagamento_invalido') && await falha(() => reg({ c: ana.c, ref: 'a', moeda: 'eu' }), 'pagamento_invalido') &&
    await falha(() => reg({ c: ana.c, ref: 'a', tipo: 'pix' }), 'pagamento_invalido') && await falha(() => reg({ c: ana.c, ref: '' }), 'pagamento_invalido'));

  console.log('\n== 1:1 pago: a ficha já é conhecida ==');
  const r1 = await reg({ c: ana.c, ref: 'cs_ana_1', tipo: '1a1', servico: '1:1 de 20 min', valor: 2000 });
  const lin = await um('select * from pagamentos where referencia=$1', ['cs_ana_1']);
  check('grava valor em centavos, moeda, serviço e quando', r1.duplicado === false && lin.valor_centavos === 2000 && lin.moeda === 'EUR' && lin.servico === '1:1 de 20 min' && lin.tipo === '1a1' && new Date(lin.pago_em).toISOString() === '2026-11-17T10:00:00.000Z');
  const r2 = await reg({ c: ana.c, ref: 'cs_ana_1', tipo: '1a1', servico: '1:1 de 20 min', valor: 2000 });
  check('o Stripe reenviou o evento: duplicado, nada contado duas vezes', r2.duplicado === true && (await um('select count(*)::int n from pagamentos where contato_id=$1', [ana.c])).n === 1);
  check('moeda em minúscula (o Stripe manda "eur") vira EUR', (await reg({ c: ana.c, ref: 'cs_ana_2', moeda: 'brl', valor: 60000 })).duplicado === false && (await um("select moeda from pagamentos where referencia='cs_ana_2'")).moeda === 'BRL');

  console.log('\n== Mensalidade: a ficha vem pela assinatura, pelo cliente ou pelo e-mail ==');
  await db.query("insert into assinaturas (contato_id, stripe_customer_id, stripe_subscription_id, status, plano) values ($1, 'cus_bia', 'sub_bia', 'active', 'por dentro das démarches')", [bia.c]);
  const f1 = await reg({ ref: 'in_bia_1', tipo: 'assinatura', valor: 1990, sub: 'sub_bia' });
  check('acha pela assinatura e, sem nome de serviço, usa "Assinatura · plano"', f1.contato_id === bia.c && (await um("select servico from pagamentos where referencia='in_bia_1'")).servico === 'Assinatura · por dentro das démarches');
  check('acha pelo cliente do Stripe', (await reg({ ref: 'in_bia_2', tipo: 'assinatura', cli: 'cus_bia' })).contato_id === bia.c);
  check('acha pelo e-mail da fatura (sem diferença de maiúsculas)', (await reg({ ref: 'in_ana_1', tipo: 'assinatura', email: 'ANA@example.com', sub: 'sub_que_nao_existe' })).contato_id === ana.c && (await um("select servico from pagamentos where referencia='in_ana_1'")).servico === 'Assinatura');
  check('fatura de quem não está no CRM: contato_nao_encontrado (o Worker ignora)', await falha(() => reg({ ref: 'in_x', tipo: 'assinatura', email: 'ninguem@example.com' }), 'contato_nao_encontrado'));

  console.log('\n== Quem lê ==');
  check('a admin lê todos os pagamentos', (await asUser(admin.id, () => q('select * from pagamentos'))).length === 5);
  check('a pessoa não lê nem os próprios; anônimo não lê', (await asUser(ana.u.id, () => q('select * from pagamentos'))).length === 0 && !(await attempt(() => asAnon(() => q('select * from pagamentos')))).ok);
  check('a pessoa não escreve na tabela', !(await attempt(() => asUser(ana.u.id, () => db.query("insert into pagamentos (contato_id, referencia, servico, valor_centavos, moeda) values ($1,'meu',' x',1,'EUR')", [ana.c])))).ok);
  check('a admin lança um Pix à mão', (await attempt(() => asUser(admin.id, () => db.query("insert into pagamentos (contato_id, referencia, tipo, servico, valor_centavos, moeda) values ($1,'manual-1','outro','Taxa do dossiê (Pix)',60000,'BRL')", [ana.c])))).ok);
  check('apagar a ficha apaga os pagamentos dela (on delete cascade)', (await db.query('delete from contatos where id=$1', [bia.c]), (await um('select count(*)::int n from pagamentos where contato_id=$1', [bia.c])).n === 0));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
