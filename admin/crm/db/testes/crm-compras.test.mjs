// Testa crm-compras.sql (compras dos guias digitais: ficha, consentimento, 12 meses de acesso, isolamento) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:compras
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
  for (const f of ['crm-fase2.sql', 'crm-onboarding.sql', 'crm-assinaturas.sql', 'crm-pagamentos.sql', 'crm-compras.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-compras.sql'), 'utf8');
  check('roda de novo (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  // ficha COM conta: e-mail da conta confirmado (ou não) e e-mail da ficha escolhidos por cada caso
  const comConta = async (emailFicha, emailConta, confirmado = true) => {
    const [u] = await q('insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id', [emailConta, confirmado ? new Date().toISOString() : null]);
    await db.query('delete from contatos where user_id = $1', [u.id]);   // o gatilho de auth.users já abriu uma ficha pelo e-mail da conta: o cenário escolhe a sua
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [emailFicha, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [emailFicha])).id };
  };
  const ana = await comConta('ana@example.com', 'ana@example.com');
  const reg = (o) => asServico(() => um('select crm_compra_registrar($1,$2,$3,$4,$5,$6,$7) r',
    [o.ref, o.slug ?? 'manual-destrave-ameli', o.email, o.valor ?? 900, o.moeda ?? 'EUR', o.quando ?? '2026-11-25T10:00:00Z', o.origem ?? null])).then((x) => x.r);
  const nCompras = async () => (await um('select count(*)::int n from compras')).n;

  console.log('== Quem pode chamar ==');
  const args = ['cs_x', 'manual-destrave-ameli', 'ana@example.com', 900, 'EUR', null, null];
  const chama = () => db.query('select crm_compra_registrar($1,$2,$3,$4,$5,$6,$7)', args);
  check('só o Worker (service_role): nem anônimo, nem a pessoa, nem a admin', !(await attempt(() => asAnon(chama))).ok && !(await attempt(() => asUser(ana.u.id, chama))).ok && !(await attempt(() => asUser(admin.id, chama))).ok);
  const entrega = () => db.query("select crm_compra_entregue('cs_x')");
  check('entregue: também só o Worker', !(await attempt(() => asAnon(entrega))).ok && !(await attempt(() => asUser(ana.u.id, entrega))).ok && !(await attempt(() => asUser(admin.id, entrega))).ok);
  check('produto fora da lista, e-mail ruim, valor zero, moeda inválida e referência vazia são recusados',
    await falha(() => reg({ ref: 'a', slug: 'outro-produto', email: 'a@example.com' }), 'compra_invalida') && await falha(() => reg({ ref: 'a', email: 'sem-arroba' }), 'compra_invalida') &&
    await falha(() => reg({ ref: 'a', email: 'a@example.com', valor: 0 }), 'compra_invalida') && await falha(() => reg({ ref: 'a', email: 'a@example.com', moeda: 'eu' }), 'compra_invalida') &&
    await falha(() => reg({ ref: '', email: 'a@example.com' }), 'compra_invalida'));
  check('nada foi gravado pelas recusas', (await nCompras()) === 0);

  console.log('\n== 1. Ficha com conta e e-mail confirmado igual ==');
  const r1 = await reg({ ref: 'cs_ana', email: 'Ana@Example.com', origem: 'story-1' });
  const l1 = await um("select * from compras where referencia='cs_ana'");
  check('liga à ficha da conta (e-mail em maiúscula do Stripe casa) e não abre ficha nova', r1.duplicado === false && r1.contato_id === ana.c && r1.ficha_nova === false && l1.contato_id === ana.c && (await um('select count(*)::int n from contatos')).n === 1);
  check('guarda e-mail minúsculo, valor em centavos, EUR, origem; acesso = pagamento + 12 meses', l1.email_pagamento === 'ana@example.com' && l1.valor_centavos === 900 && l1.moeda === 'EUR' && l1.origem === 'story-1' &&
    new Date(l1.pago_em).toISOString() === '2026-11-25T10:00:00.000Z' && new Date(l1.acesso_ate).toISOString() === '2027-11-25T10:00:00.000Z' && l1.entregue_em === null);
  const cons = await q("select finalidade, aceito, origem from consentimentos where contato_id=$1", [ana.c]);
  check('grava o consentimento de SERVIÇO uma vez e NUNCA o de novidades por e-mail', cons.length === 1 && cons[0].finalidade === 'servico' && cons[0].aceito === true && cons[0].origem === 'compra');
  const r1b = await reg({ ref: 'cs_ana', email: 'ana@example.com' });
  check('o Stripe reenviou o evento: duplicado, nenhuma compra nem consentimento a mais', r1b.duplicado === true && (await nCompras()) === 1 && (await um('select count(*)::int n from consentimentos where contato_id=$1', [ana.c])).n === 1);
  check('segunda compra da mesma pessoa não repete o consentimento', (await reg({ ref: 'cs_ana_2', email: 'ana@example.com', slug: 'guia-vivo-destrave-ameli', valor: 1900 })).duplicado === false &&
    (await um('select count(*)::int n from consentimentos where contato_id=$1', [ana.c])).n === 1 && (await nCompras()) === 2);

  console.log('\n== 2. Ficha sem conta ==');
  await db.query("insert into contatos (email, nome) values ('bia@example.com', 'Bia Souza')");
  const r2 = await reg({ ref: 'cs_bia', email: 'bia@example.com' });
  check('liga à ficha sem conta, devolve o nome e não abre outra', r2.contato_id === (await um("select id from contatos where email='bia@example.com'")).id && r2.nome === 'Bia Souza' && r2.ficha_nova === false);

  console.log('\n== 3. Ninguém no CRM com este e-mail: abre a ficha ==');
  const r3 = await reg({ ref: 'cs_cris', email: 'Cris@Example.com' });
  const fc = await um("select * from contatos where email='cris@example.com'");
  check('ficha nova com origem stripe, sem conta, e a compra ligada a ela', r3.ficha_nova === true && fc && fc.origem === 'stripe' && fc.user_id === null && r3.contato_id === fc.id);
  check('só consentimento de serviço na ficha nova', (await q('select finalidade from consentimentos where contato_id=$1', [fc.id])).map((x) => x.finalidade).join() === 'servico');

  console.log('\n== 4. Ficha com conta, mas o e-mail do pagamento não prova nada: NÃO liga ==');
  const dana = await comConta('dana@example.com', 'outro-email-da-dana@example.com');
  const r4 = await reg({ ref: 'cs_dana', email: 'dana@example.com' });
  check('e-mail da ficha igual, e-mail da conta diferente: compra sem ficha, sem ficha nova, com o e-mail guardado', r4.contato_id === null && r4.ficha_nova === false &&
    (await um("select contato_id, email_pagamento from compras where referencia='cs_dana'")).email_pagamento === 'dana@example.com' && (await um('select count(*)::int n from consentimentos where contato_id=$1', [dana.c])).n === 0);
  const edu = await comConta('edu@example.com', 'edu@example.com', false);
  const r4b = await reg({ ref: 'cs_edu', email: 'edu@example.com' });
  check('conta com e-mail NÃO confirmado: não liga', r4b.contato_id === null && (await um("select contato_id from compras where referencia='cs_edu'")).contato_id === null);
  const r4c = await reg({ ref: 'cs_x1', email: 'ana@example.com' });
  check('o e-mail do pagamento acha a ficha pelo e-mail confirmado dela, e só ela', r4c.contato_id === ana.c);
  const dupDana = await reg({ ref: 'cs_dana', email: 'dana@example.com' });
  check('reenvio de compra sem ficha continua sem ficha (não inventa ligação)', dupDana.duplicado === true && dupDana.contato_id === null);
  const apos = await um("select count(*)::int n from contatos where email='dana@example.com'");
  check('nenhuma ficha duplicada para o e-mail da Dana', apos.n === 1);

  console.log('\n== Entrega ==');
  await asServico(() => db.query("select crm_compra_entregue('cs_ana')"));
  const e1 = (await um("select entregue_em from compras where referencia='cs_ana'")).entregue_em;
  await asServico(() => db.query("select crm_compra_entregue('cs_ana')"));
  const e2 = (await um("select entregue_em from compras where referencia='cs_ana'")).entregue_em;
  check('marca a entrega uma vez; a data da primeira não muda', e1 !== null && String(e1) === String(e2));
  check('reenvio devolve entregue_em, para o Worker não mandar o e-mail de novo', !!(await reg({ ref: 'cs_ana', email: 'ana@example.com' })).entregue_em);

  console.log('\n== Quem lê (RLS) ==');
  check('a admin lê todas as compras', (await asUser(admin.id, () => q('select * from compras'))).length === (await nCompras()));
  check('a pessoa não lê nem as próprias; anônimo não lê', (await asUser(ana.u.id, () => q('select * from compras'))).length === 0 && !(await attempt(() => asAnon(() => q('select * from compras')))).ok);
  check('a pessoa não escreve na tabela nem muda uma compra', !(await attempt(() => asUser(ana.u.id, () => db.query("insert into compras (referencia, slug, email_pagamento, valor_centavos, moeda, acesso_ate) values ('meu','manual-destrave-ameli','a@example.com',1,'EUR',now())")))).ok &&
    ((await asUser(ana.u.id, () => db.query("update compras set acesso_ate = now() + interval '100 years' where referencia='cs_ana'"))).affectedRows ?? 0) === 0);
  check('apagar a ficha mantém a compra (registro de venda), sem ficha', (await db.query('delete from contatos where id=$1', [ana.c]), (await um("select contato_id from compras where referencia='cs_ana'")).contato_id === null));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
