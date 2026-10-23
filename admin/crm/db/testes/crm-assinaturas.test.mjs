// Testa crm-assinaturas.sql (webhook do Stripe → assinaturas, e meu_acesso(), a regra de acesso do app) num Postgres efêmero
// (PGlite). Não toca no Supabase real. Pessoas fictícias. Como em crm-onboarding.test.mjs, o esquema do app é um mínimo próprio.
//
// Uso: cd admin/crm/db/testes && npm install && npm run test:assinaturas
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.admins (user_id uuid primary key);
    create or replace function public.eh_admin() returns boolean language sql stable security definer
      set search_path = public as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;
    create table public.contatos (id uuid primary key default gen_random_uuid(), email text not null unique, nome text, user_id uuid,
      ultimo_evento_em timestamptz default now(), criado_em timestamptz not null default now());
    create table public.eventos (id bigint generated always as identity primary key, contato_id uuid not null references contatos(id) on delete cascade,
      tipo text not null, dados jsonb not null default '{}'::jsonb, criado_em timestamptz not null default now());
    grant select on public.contatos, public.eventos, public.admins to service_role;
    grant select on public.contatos to authenticated;
    grant insert on public.eventos to service_role;
    grant update on public.contatos to service_role;
    create or replace function public.crm_evento_recente() returns trigger language plpgsql security definer as $f$
    begin update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id; return new; end $f$;
    create trigger crm_eventos_recente after insert on public.eventos for each row execute function public.crm_evento_recente();`);
  const sql = readFileSync(path.resolve(HERE, '../crm-assinaturas.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [adm] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [adm.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  const [cAna] = await q("insert into contatos (email, nome, user_id) values ('ana@example.com', 'Ana', $1) returning id", [ana.id]);
  const [cBia] = await q("insert into contatos (email, nome, user_id) values ('bia@example.com', 'Bia', $1) returning id", [bia.id]);
  const [cSem] = await q("insert into contatos (email, nome) values ('sem@example.com', 'Sem Conta') returning id");
  const aplicar = (ev, tipo, contato, a) => asRole('service_role', null, () => db.query('select crm_stripe_aplicar($1, $2, $3, $4) as r', [ev, tipo, contato, JSON.stringify(a)]));
  const acessoDe = async (userId) => (await asRole('authenticated', userId, () => db.query('select meu_acesso() as r'))).rows[0].r;
  const ass = async (cid) => (await q('select * from assinaturas where contato_id=$1', [cid]))[0];

  console.log('\n== Quem pode chamar ==');
  const base = { status: 'trialing', customer: 'cus_1', subscription: 'sub_1', plano: 'Básico mensal', moeda: 'brl', teste_fim: dia(30), periodo_fim: dia(30), evento_em: dia(0) };
  for (const [rotulo, papel] of [['anon', 'anon'], ['pessoa logada', 'authenticated']]) {
    const r = await attempt(() => asRole(papel, ana.id, () => db.query("select crm_stripe_aplicar('evt_x1', 'checkout.session.completed', $1, '{}')", [cAna.id])));
    check(rotulo + ' não aplica evento do Stripe', !r.ok && /permission denied/.test(r.error.message));
  }
  const rEnv = await attempt(() => asRole('authenticated', ana.id, () => db.query('select crm_stripe_acesso_enviado($1)', [cAna.id])));
  check('pessoa logada não marca "acesso enviado"', !rEnv.ok);
  check('pessoa logada não lê a tabela de assinaturas', !(await attempt(() => asRole('authenticated', ana.id, () => db.query('select * from assinaturas')))).ok || (await asRole('authenticated', ana.id, () => db.query('select * from assinaturas'))).rows.length === 0);
  check('ninguém além do Worker lê os eventos do Stripe', !(await attempt(() => asRole('authenticated', ana.id, () => db.query('select * from stripe_eventos')))).ok);

  console.log('\n== Pagamento confirmado ==');
  const antes = (await q('select ultimo_evento_em from contatos where id=$1', [cAna.id]))[0].ultimo_evento_em;
  await new Promise((r) => setTimeout(r, 20));
  const p1 = await attempt(() => aplicar('evt_1', 'checkout.session.completed', cAna.id, base));
  check('aplica', p1.ok); if (!p1.ok) console.log(p1.error.message);
  const a1 = await ass(cAna.id);
  check('guarda status, ids, plano e moeda em maiúsculas', a1 && a1.status === 'trialing' && a1.stripe_subscription_id === 'sub_1' && a1.stripe_customer_id === 'cus_1' && a1.plano === 'Básico mensal' && a1.moeda === 'BRL');
  check('guarda o fim do teste que o Stripe informou (não conta 30 dias sozinho)', Math.abs(new Date(a1.teste_fim) - new Date(base.teste_fim)) < 1000);
  const ev = await q("select tipo, dados from eventos where contato_id=$1", [cAna.id]);
  check('registra pagamento_confirmado com plano e fim do teste', ev.length === 1 && ev[0].tipo === 'pagamento_confirmado' && ev[0].dados.plano === 'Básico mensal' && !!ev[0].dados.teste_fim);
  check('não zera o "parada há N dias" dela', (await q('select ultimo_evento_em from contatos where id=$1', [cAna.id]))[0].ultimo_evento_em.getTime() === antes.getTime());
  check('devolve o contato e que o e-mail de acesso ainda não saiu', p1.value.rows[0].r.contato_id === cAna.id && p1.value.rows[0].r.acesso_enviado_em === null && p1.value.rows[0].r.duplicado === false);

  console.log('\n== O Stripe repete o evento ==');
  const rep = await aplicar('evt_1', 'checkout.session.completed', cAna.id, { ...base, status: 'canceled' });
  check('evento repetido é reconhecido e não faz nada', rep.rows[0].r.duplicado === true && (await ass(cAna.id)).status === 'trialing');
  check('e não cria outro evento na linha do tempo', (await q('select count(*)::int n from eventos where contato_id=$1', [cAna.id]))[0].n === 1);
  await asRole('service_role', null, () => db.query('select crm_stripe_acesso_enviado($1)', [cAna.id]));
  const env1 = (await ass(cAna.id)).acesso_enviado_em;
  check('"acesso enviado" é marcado', !!env1);
  await new Promise((r) => setTimeout(r, 10));
  await asRole('service_role', null, () => db.query('select crm_stripe_acesso_enviado($1)', [cAna.id]));
  check('e só uma vez (marcar de novo não muda a hora)', (await ass(cAna.id)).acesso_enviado_em.getTime() === env1.getTime());
  const rep2 = await aplicar('evt_1', 'checkout.session.completed', cAna.id, base);
  check('o reenvio do Stripe diz que o e-mail já saiu', rep2.rows[0].r.acesso_enviado_em !== null);

  console.log('\n== Eventos seguintes (sem o id da ficha) ==');
  await aplicar('evt_2', 'customer.subscription.updated', null, { status: 'trialing', customer: 'cus_1', subscription: 'sub_1', teste_fim: base.teste_fim, periodo_fim: base.periodo_fim, evento_em: dia(0.01) });
  check('acha a ficha pelo id da assinatura', (await ass(cAna.id)).stripe_subscription_id === 'sub_1');
  check('atualização que não muda nada não enche a linha do tempo', (await q('select count(*)::int n from eventos where contato_id=$1', [cAna.id]))[0].n === 1);
  await aplicar('evt_3', 'customer.subscription.updated', null, { status: 'active', customer: 'cus_1', subscription: 'sub_1', periodo_fim: dia(30), evento_em: dia(0.02) });
  check('mudança de status vira evento e atualiza', (await ass(cAna.id)).status === 'active' && (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='assinatura_atualizada'", [cAna.id]))[0].n === 1);
  check('o plano e a moeda que já estavam ficam (o evento não os trouxe)', (await ass(cAna.id)).plano === 'Básico mensal' && (await ass(cAna.id)).moeda === 'BRL');
  const velho = await aplicar('evt_4', 'customer.subscription.updated', null, { status: 'trialing', customer: 'cus_1', subscription: 'sub_1', evento_em: dia(-5) });
  check('evento mais velho que o gravado (fora de ordem) não desfaz o novo', velho.rows[0].r.antigo === true && (await ass(cAna.id)).status === 'active');
  await aplicar('evt_5', 'invoice.payment_failed', null, { status: 'past_due', customer: 'cus_1', subscription: 'sub_1', evento_em: dia(0.03) });
  check('pagamento que falhou vira evento e status past_due', (await ass(cAna.id)).status === 'past_due' && (await q("select 1 from eventos where contato_id=$1 and tipo='pagamento_falhou'", [cAna.id])).length === 1);
  await aplicar('evt_6', 'customer.subscription.updated', null, { status: 'active', customer: 'cus_1', subscription: 'sub_1', cancela_no_fim: true, evento_em: dia(0.04) });
  check('pedir cancelamento no fim do período é gravado', (await ass(cAna.id)).cancela_no_fim === true);
  await aplicar('evt_7', 'customer.subscription.deleted', null, { status: 'canceled', customer: 'cus_1', subscription: 'sub_1', evento_em: dia(0.05) });
  check('assinatura encerrada vira assinatura_cancelada', (await ass(cAna.id)).status === 'canceled' && (await q("select 1 from eventos where contato_id=$1 and tipo='assinatura_cancelada'", [cAna.id])).length === 1);

  console.log('\n== Eventos recusados ==');
  check('tipo que não tratamos é recusado', !(await attempt(() => aplicar('evt_8', 'charge.refunded', cAna.id, base))).ok);
  check('sem ficha e sem assinatura conhecida: recusa (o Stripe tenta de novo)', !(await attempt(() => aplicar('evt_9', 'customer.subscription.updated', null, { status: 'active', customer: 'cus_desconhecido', subscription: 'sub_x' }))).ok);
  check('e o evento recusado não fica marcado como processado (a nova tentativa vale)', (await q("select 1 from stripe_eventos where id='evt_9'")).length === 0);
  check('id de evento curto demais é recusado', !(await attempt(() => aplicar('x', 'checkout.session.completed', cAna.id, base))).ok);
  check('contato que não existe é recusado', !(await attempt(() => aplicar('evt_10', 'checkout.session.completed', '00000000-0000-4000-8000-000000000000', base))).ok);

  console.log('\n== meu_acesso(): quem entra no app ==');
  check('quem não está logado nem consegue chamar', !(await attempt(() => asRole('anon', null, () => db.query('select meu_acesso() as r')))).ok);
  check('admin sempre entra', (await acessoDe(adm.id)).acesso === true && (await acessoDe(adm.id)).motivo === 'admin');
  check('sem assinatura: bloqueado (todo mundo precisa de assinatura)', (await acessoDe(bia.id)).acesso === false && (await acessoDe(bia.id)).motivo === 'sem_assinatura');
  const set = (cid, campos) => db.query(`insert into assinaturas (contato_id, status, teste_fim, periodo_fim, cancela_no_fim) values ($1, $2, $3, $4, $5)
    on conflict (contato_id) do update set status=excluded.status, teste_fim=excluded.teste_fim, periodo_fim=excluded.periodo_fim, cancela_no_fim=excluded.cancela_no_fim`,
    [cid, campos.status, campos.teste_fim ?? null, campos.periodo_fim ?? null, !!campos.cancela]);
  const casos = [
    ['teste em andamento', { status: 'trialing', teste_fim: dia(10), periodo_fim: dia(10) }, true, 'teste'],
    ['teste acabou há 1 dia (o aviso do Stripe pode atrasar): ainda entra', { status: 'trialing', teste_fim: dia(-1), periodo_fim: dia(-1) }, true, 'teste'],
    ['teste acabou há 3 dias sem virar assinatura: bloqueado', { status: 'trialing', teste_fim: dia(-3), periodo_fim: dia(-3) }, false, 'teste_encerrado'],
    ['assinatura ativa', { status: 'active', periodo_fim: dia(20) }, true, 'ativa'],
    ['ativa, mas pediu para cancelar no fim: entra até o fim', { status: 'active', periodo_fim: dia(5), cancela: true }, true, 'cancelada_ate'],
    ['ativa com o período vencido há 5 dias (Stripe sumiu): bloqueado', { status: 'active', periodo_fim: dia(-5) }, false, 'assinatura_encerrada'],
    ['cancelada, mas o período pago ainda não acabou', { status: 'canceled', periodo_fim: dia(7) }, true, 'cancelada_ate'],
    ['cancelada e o período acabou', { status: 'canceled', periodo_fim: dia(-1) }, false, 'assinatura_encerrada'],
    ['pagamento falhou, período pago ainda vale', { status: 'past_due', periodo_fim: dia(7) }, true, 'pagamento_falhou_ate'],
    ['pagamento falhou e o período acabou', { status: 'past_due', periodo_fim: dia(-1) }, false, 'pagamento_pendente'],
    ['unpaid', { status: 'unpaid', periodo_fim: dia(7) }, false, 'pagamento_pendente'],
    ['incomplete', { status: 'incomplete' }, false, 'pagamento_pendente'],
    ['paused', { status: 'paused', periodo_fim: dia(7) }, false, 'pagamento_pendente']];
  for (const [rotulo, campos, acesso, motivo] of casos) {
    await set(cBia.id, campos);
    const r = await acessoDe(bia.id);
    check(rotulo + ' → ' + (acesso ? 'entra' : 'bloqueado') + ' (' + motivo + ')', r.acesso === acesso && r.motivo === motivo);
  }
  await set(cBia.id, { status: 'active', periodo_fim: dia(20) });
  check('cada pessoa vê o próprio acesso (Ana cancelou mas o período pago vale; Bia está ativa)', (await acessoDe(ana.id)).motivo === 'cancelada_ate' && (await acessoDe(bia.id)).motivo === 'ativa');
  check('devolve até quando vale', !!(await acessoDe(bia.id)).ate);

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
