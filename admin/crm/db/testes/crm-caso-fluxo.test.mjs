// Testa crm-caso-fluxo.sql (a fila de avisos com pausas, enviar agora, atrasar/adiantar e a rotina) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:caso-fluxo
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
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  // Uma pessoa com avisos já existentes ANTES do fluxo (dias_apos 0, 0, 1): o preenchimento deve virar pausas 0, 0, 1.
  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cAna]);
  const mk = async (cid, titulo, dias) => (await um("insert into caso_avisos (contato_id, tipo, titulo, dias_apos) values ($1, 'proposta', $2, $3) returning id", [cid, titulo, dias])).id;
  const a1 = await mk(cAna, 'A', 0), a2 = await mk(cAna, 'B', 0), a3 = await mk(cAna, 'C', 1);

  const sql = readFileSync(path.resolve(HERE, '../crm-caso-fluxo.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez (sem pg_cron: só avisa)', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);
  const fila = async (cid) => q("select titulo, ordem, pausa_dias, estado, liberar_em, modo from caso_avisos where contato_id=$1 order by ordem", [cid]);
  let f = await fila(cAna);
  check('avisos criados antes do fluxo viram ordem 1,2,3 e pausas 0,0,1', f.map((x) => x.ordem).join() === '1,2,3' && f.map((x) => x.pausa_dias).join() === '0,0,1');
  const novo = await mk(cAna, 'D', 3);
  check('aviso novo entra no fim e a pausa sai da diferença (3 − 1 = 2)', (await um('select ordem, pausa_dias from caso_avisos where id=$1', [novo])).pausa_dias === 2 && (await um('select ordem from caso_avisos where id=$1', [novo])).ordem === 4);
  await db.exec(sql);
  check('rodar de novo não desfaz pausas já preenchidas', (await fila(cAna)).map((x) => x.pausa_dias).join() === '0,0,1,2');
  await db.query('delete from caso_avisos where id=$1', [novo]);

  const agendar = (id, extra) => asUser(admin.id, () => db.query('select crm_aviso_agendar($1, $2, $3)', [id, extra && extra.quando || null, extra && extra.dias != null ? extra.dias : null]));
  const rpc = (nome, ...args) => asUser(admin.id, () => db.query(`select ${nome}(${args.map((_, i) => '$' + (i + 1)).join(',')})`, args));
  const dia = (t) => t ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) : null;
  const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  const somaDias = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

  console.log('== Aprovar e a fila ==');
  await agendar(a1); await agendar(a2); await agendar(a3);
  f = await fila(cAna);
  check('antes do primeiro acesso a fila inteira fica sem data (ninguém digita data)', f.every((x) => x.estado === 'agendado' && x.liberar_em === null));
  await asUser(ana.id, () => db.query('select caso_primeiro_acesso()'));
  f = await fila(cAna);
  const d0 = hoje();
  check('o primeiro acesso dá data à fila toda: dia 0, dia 0 e dia 1 (pausas 0, 0, 1)', dia(f[0].liberar_em) === d0 && dia(f[1].liberar_em) === d0 && dia(f[2].liberar_em) === somaDias(d0, 1));
  check('as datas saem às 9h de Paris', (await um("select to_char(liberar_em at time zone 'Europe/Paris', 'HH24:MI') h from caso_avisos where id=$1", [a3])).h === '09:00');
  check('non-admin não agenda, envia nem desloca', await falha(() => asUser(ana.id, () => db.query('select crm_aviso_enviar_agora($1)', [a1])), 'sem_permissao') && await falha(() => asUser(ana.id, () => db.query('select crm_aviso_deslocar($1, 1)', [a1])), 'sem_permissao') && !(await attempt(() => asAnon(() => db.query('select crm_aviso_enviar_agora($1)', [a1])))).ok);

  console.log('\n== Adiantar e atrasar mantêm as pausas ==');
  // Fila de uma segunda pessoa, com pausas grandes, para ver o deslocamento: pausas 2, 3, 4 depois do primeiro acesso.
  const [bia] = await q("insert into auth.users (email, email_confirmed_at) values ('bia@example.com', now()) returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('bia@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [bia.id]);
  const cBia = (await um("select id from contatos where email='bia@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cBia]);
  const b1 = await mk(cBia, 'B1', 2), b2 = await mk(cBia, 'B2', 5), b3 = await mk(cBia, 'B3', 9);
  for (const id of [b1, b2, b3]) await agendar(id);
  await asUser(bia.id, () => db.query('select caso_primeiro_acesso()'));
  const datas = async (cid) => (await fila(cid)).map((x) => dia(x.liberar_em));
  check('pausas 2, 3 e 4: dias +2, +5 e +9', (await datas(cBia)).join() === [somaDias(d0, 2), somaDias(d0, 5), somaDias(d0, 9)].join());
  await rpc('crm_aviso_deslocar', b1, 3);
  check('atrasar o primeiro em 3 dias empurra os outros dois junto (as pausas entre eles não mudam)', (await datas(cBia)).join() === [somaDias(d0, 5), somaDias(d0, 8), somaDias(d0, 12)].join());
  await rpc('crm_aviso_deslocar', b1, -1);
  check('adiantar 1 dia traz tudo de volta 1 dia', (await datas(cBia)).join() === [somaDias(d0, 4), somaDias(d0, 7), somaDias(d0, 11)].join());
  await rpc('crm_aviso_deslocar', b2, 2);
  check('atrasar o do meio só empurra o do meio e o seguinte; o primeiro fica', (await datas(cBia)).join() === [somaDias(d0, 4), somaDias(d0, 9), somaDias(d0, 13)].join());
  check('a pausa nunca fica negativa (adiantar além de zero para em zero)', (await rpc('crm_aviso_deslocar', b1, -60), (await um('select pausa_dias from caso_avisos where id=$1', [b1])).pausa_dias === 0));
  check('dias zero, fora de ±60 e aviso que não existe são recusados', await falha(() => rpc('crm_aviso_deslocar', b1, 0), 'dias_invalidos') && await falha(() => rpc('crm_aviso_deslocar', b1, 61), 'dias_invalidos') && await falha(() => rpc('crm_aviso_deslocar', 999999, 1), 'aviso_nao_encontrado'));

  console.log('\n== Enviar agora ==');
  // Estado: B1 pausa 0 → dia 0; B2 pausa 5 → dia +5; B3 pausa 4 → dia +9. Mando B1 agora: B2 e B3 contam a partir de hoje.
  await rpc('crm_aviso_deslocar', b1, 2);   // B1 em +2 de novo (pausa 2)
  await rpc('crm_aviso_deslocar', b2, -2);  // B2: pausa 3 depois de B1
  const antes = await datas(cBia);
  await rpc('crm_aviso_enviar_agora', b1);
  const bi = await um('select estado, liberado_em, liberar_em from caso_avisos where id=$1', [b1]);
  check('o aviso sai na hora: liberado, com sinal para ela', bi.estado === 'liberado' && !!bi.liberado_em && (await um("select count(*)::int n from sinais where contato_id=$1 and mensagem like 'Nova mensagem do assistente: B1%'", [cBia])).n === 1);
  const depois = await datas(cBia);
  check('o que vem depois andou 2 dias para a frente (a pausa de 3 e 4 dias se mantém: hoje+3 e hoje+7)', depois[1] === somaDias(d0, 3) && depois[2] === somaDias(d0, 7) && antes[1] === somaDias(d0, 5) && antes[2] === somaDias(d0, 9));
  check('mandar a mesma de novo, ou uma que não é a próxima, é recusado', await falha(() => rpc('crm_aviso_enviar_agora', b1), 'aviso_ja_saiu') && await falha(() => rpc('crm_aviso_enviar_agora', b3), 'nao_e_a_proxima'));
  check('o que já saiu não se desloca', await falha(() => rpc('crm_aviso_deslocar', b1, 1), 'aviso_ja_saiu'));
  check('a pessoa vê o aviso enviado antes da hora (meus_avisos)', (await asUser(bia.id, () => q('select titulo from meus_avisos()'))).some((x) => x.titulo === 'B1'));
  // Rascunho não se envia; sem consentimento também não.
  const rasc = await mk(cBia, 'R', 20);
  check('rascunho: aprove antes', await falha(() => rpc('crm_aviso_enviar_agora', rasc), 'aprove_antes'));
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', false)", [cBia]);
  check('sem consentimento (retirado) não envia', await falha(() => rpc('crm_aviso_enviar_agora', b2), 'sem_consentimento'));
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cBia]);

  console.log('\n== Data fixa e cancelar ==');
  await agendar(b3, { quando: '2027-03-01T09:00:00+01:00' });
  await agendar(rasc, { dias: 2 });
  f = await fila(cBia);
  const fx = f.find((x) => x.titulo === 'B3'), rr = f.find((x) => x.titulo === 'R');
  check('data fixa não se mexe e o que vem depois conta dela (R = dia 01/03 + 2)', dia(fx.liberar_em) === '2027-03-01' && fx.modo === 'data' && dia(rr.liberar_em) === '2027-03-03');
  await db.query("update caso_avisos set estado='cancelado' where id=$1", [b3]);
  await rpc('crm_aviso_deslocar', rasc, 1);
  f = await fila(cBia);
  check('um aviso cancelado sai da fila: o seguinte conta do último que vale (B2)', dia(f.find((x) => x.titulo === 'R').liberar_em) === somaDias(dia(f.find((x) => x.titulo === 'B2').liberar_em), 3));

  console.log('\n== A rotina (crm_avisos_materializar) ==');
  const p = await mk(cAna, 'Vencido', 0); await agendar(p);
  await db.query("update caso_avisos set liberar_em = now() - interval '1 hour', modo = 'data' where id=$1", [p]);
  const n = (await um('select crm_avisos_materializar() n')).n;
  check('entrega o que já venceu e acende o sininho', n >= 1 && (await um('select estado from caso_avisos where id=$1', [p])).estado === 'liberado' && (await um("select count(*)::int n from sinais where contato_id=$1 and mensagem like '%Vencido'", [cAna])).n === 1);
  check('rodar de novo não entrega duas vezes', (await um('select crm_avisos_materializar() n')).n === 0);
  check('a rotina só o servidor chama: nem a admin, nem a pessoa, nem anônimo', !(await attempt(() => asUser(admin.id, () => db.query('select crm_avisos_materializar()')))).ok && !(await attempt(() => asUser(ana.id, () => db.query('select crm_avisos_materializar()')))).ok && !(await attempt(() => asAnon(() => db.query('select crm_avisos_materializar()')))).ok);
  check('funções internas fechadas para quem está logado', ['caso_reencadear(uuid)', 'caso_aviso_liberar(bigint)'].every(() => true) && !(await attempt(() => asUser(admin.id, () => db.query('select caso_reencadear($1)', [cAna])))).ok && !(await attempt(() => asUser(admin.id, () => db.query('select caso_aviso_liberar($1)', [a1])))).ok);

  console.log('\n== O "Agora não" dela não mexe na fila ==');
  const sem = await q("select id from caso_avisos where contato_id=$1 and titulo='B2'", [cBia]);
  const antesAdiar = await datas(cBia);
  await db.query("update caso_avisos set estado='liberado', liberado_em=now() where id=$1", [sem[0].id]);
  await asUser(bia.id, () => db.query('select adiar_aviso($1)', [sem[0].id]));
  check('adiar_aviso volta a agendado com a data dele; a fila recalculada não quebra', (await attempt(() => asUser(admin.id, () => db.query('select crm_aviso_deslocar($1, 1)', [rasc])))).ok && (await datas(cBia)).length === antesAdiar.length);

  console.log('\n== pg_cron ==');
  await db.exec(`create schema cron; create table cron.job (jobid serial, jobname text, schedule text, command text);
    create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid::bigint $$;
    create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n returning true $$;`);
  await db.exec(sql); await db.exec(sql);
  const jobs = await q("select schedule, command from cron.job where jobname='crm-avisos-materializar'");
  check('com a pg_cron ligada: um agendamento de hora em hora, e rodar de novo não duplica', jobs.length === 1 && jobs[0].schedule === '7 * * * *' && /crm_avisos_materializar/.test(jobs[0].command));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
