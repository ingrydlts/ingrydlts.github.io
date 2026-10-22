// Testa crm-insights.sql (insights da iAssistente: lista viva, histórico, notas suas) num Postgres efêmero (PGlite).
// Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:insights
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-plataforma.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-checklist.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-insights.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);
  // Com a publicação do Realtime presente, as tabelas entram uma vez só e rodar de novo não quebra.
  await db.exec('create publication supabase_realtime');
  const r3 = await attempt(() => db.exec(sql)); check('com Realtime: roda sem erro', r3.ok); if (!r3.ok) console.log(r3.error.message);
  const r4 = await attempt(() => db.exec(sql)); check('com Realtime: 2ª vez também', r4.ok);
  const pub = (await q("select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1")).map((r) => r.tablename);
  check('Realtime recebe insights_vivos, insights_historico, plataforma_cliques e checklist_items', ['checklist_items', 'insights_historico', 'insights_vivos', 'plataforma_cliques'].every((t) => pub.includes(t)));

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  for (const [u, e] of [[ana, 'ana@example.com'], [bia, 'bia@example.com']])
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [e, u.id]);
  const [cAna] = await q("select id from contatos where email='ana@example.com'");
  const [cBia] = await q("select id from contatos where email='bia@example.com'");
  const reg = (quem, notas) => asUser(quem, () => db.query('select registrar_insights($1)', [JSON.stringify(notas)]));
  const N = (id, texto, icone = '⚠️') => ({ id, icone, texto });
  const hist = async (cid) => q('select * from insights_historico where contato_id=$1 order by id', [cid]);
  const vivos = async (cid) => (await q('select * from insights_vivos where contato_id=$1', [cid]))[0];
  const evs = async (cid) => q("select dados from eventos where contato_id=$1 and tipo='insights_alterados' order by id", [cid]);

  console.log('\n== Permissões ==');
  check('anon não registra', !(await attempt(() => asAnon(() => db.query("select registrar_insights('[]')")))).ok);
  check('anon não chama meus_insights_manuais', !(await attempt(() => asAnon(() => db.query('select * from meus_insights_manuais()')))).ok);
  await reg(ana.id, [N('sem_matricula', 'Sem matrícula.')]);
  for (const t of ['insights_vivos', 'insights_historico', 'insights_manuais'])
    check('pessoa logada não lê ' + t + ' direto (RLS)', (await asUser(ana.id, () => db.query(`select * from ${t}`))).rows.length === 0);
  check('pessoa logada não escreve em insights_vivos direto', (await asUser(ana.id, () => db.query("update insights_vivos set notas='[]'"))).rowCount === 0);
  check('admin lê a lista viva', (await asUser(admin.id, () => db.query('select * from insights_vivos'))).rows.length === 1);

  console.log('\n== Primeira leitura ==');
  check('guarda a lista e marca a 1ª leitura no histórico', (await vivos(cAna.id)).notas.length === 1 && (await hist(cAna.id)).length === 1 && (await hist(cAna.id))[0].inicial === true);
  check('a 1ª leitura não vira evento na linha do tempo', (await evs(cAna.id)).length === 0);
  check('grava só na ficha de quem chamou (Bia continua sem nada)', !(await vivos(cBia.id)));

  console.log('\n== Mudanças ==');
  await reg(ana.id, [N('sem_matricula', 'Sem matrícula.')]);
  check('mesma lista não cria histórico nem evento', (await hist(cAna.id)).length === 1 && (await evs(cAna.id)).length === 0);
  await db.query("update contatos set ultimo_evento_em = now() - interval '20 days' where id=$1", [cAna.id]);
  await reg(ana.id, [N('sem_matricula', 'Sem matrícula.'), N('sem_recursos', 'Sem recursos.', '📄')]);
  let h = await hist(cAna.id);
  check('uma nota nova entra: histórico com entrou=[nova] e saiu=[]', h.length === 2 && h[1].entrou.length === 1 && h[1].entrou[0].id === 'sem_recursos' && h[1].saiu.length === 0 && h[1].inicial === false);
  check('vira evento com os ids', (await evs(cAna.id)).length === 1 && (await evs(cAna.id))[0].dados.entrou[0] === 'sem_recursos');
  check('a mudança não zera o "parada há N dias"', (await q('select ultimo_evento_em from contatos where id=$1', [cAna.id]))[0].ultimo_evento_em < new Date(Date.now() - 19 * 864e5));
  await reg(ana.id, [N('sem_recursos', 'Sem recursos.', '📄')]);
  h = await hist(cAna.id);
  check('uma nota sai (ela marcou o item): saiu=[sem_matricula]', h[2].saiu.length === 1 && h[2].saiu[0].id === 'sem_matricula' && h[2].entrou.length === 0);
  await reg(ana.id, [N('sem_recursos', 'Sem recursos. Texto novo.', '📄')]);
  h = await hist(cAna.id);
  check('texto mudado conta como saiu + entrou', h[3].saiu.length === 1 && h[3].entrou.length === 1);
  await reg(ana.id, []);
  check('lista vazia é uma lista válida (nada mais no ar)', (await vivos(cAna.id)).notas.length === 0 && (await hist(cAna.id)).length === 5);
  await reg(ana.id, [N('b', 'B'), N('a', 'A')]);
  await reg(ana.id, [N('a', 'A'), N('b', 'B')]);
  check('só mudar a ordem também é mudança (ela vê em outra ordem)', (await hist(cAna.id)).length === 7);

  console.log('\n== Validação ==');
  const bad = async (v) => !(await attempt(() => reg(ana.id, v))).ok;
  check('recusa o que não é lista', await bad({ id: 'x' }));
  check('recusa lista gigante', await bad(Array.from({ length: 31 }, (_, i) => N('n' + i, 'x'))));
  const antes = (await hist(cAna.id)).length;
  await reg(ana.id, [N('a', 'x'.repeat(5000)), { id: '', texto: 'sem id' }, 'lixo']);
  const v = await vivos(cAna.id);
  check('apara o texto e ignora item sem id ou que não é objeto', v.notas.length === 1 && v.notas[0].texto.length === 1500 && (await hist(cAna.id)).length === antes + 1);
  await attempt(() => reg(ana.id, [{ id: 'z', texto: 't', icone: 'i', senha: 'segredo' }]));
  check('só id, ícone e texto ficam guardados', !JSON.stringify((await vivos(cAna.id)).notas).includes('segredo'));

  console.log('\n== Notas suas ==');
  const ins = (cid, texto, ate) => asUser(admin.id, () => db.query('insert into insights_manuais (contato_id, texto, ate) values ($1,$2,$3) returning id', [cid, texto, ate || null]));
  await ins(cAna.id, 'Ligue para o OFII antes de sexta.');
  await ins(cAna.id, 'Nota vencida.', new Date(Date.now() - 3600e3).toISOString());
  await ins(cAna.id, 'Nota com prazo.', new Date(Date.now() + 864e5).toISOString());
  const retirada = (await ins(cAna.id, 'Retirada.')).rows[0].id;
  await asUser(admin.id, () => db.query('update insights_manuais set ativo=false, retirado_em=now() where id=$1', [retirada]));
  await ins(cBia.id, 'Só da Bia.');
  const ma = (await asUser(ana.id, () => db.query('select * from meus_insights_manuais()'))).rows.map((r) => r.texto).sort();
  check('Ana recebe só as suas que valem (não a vencida, não a retirada, não a da Bia)', JSON.stringify(ma) === JSON.stringify(['Ligue para o OFII antes de sexta.', 'Nota com prazo.']));
  check('pessoa logada não cria nota para si nem para outra (RLS)', !(await attempt(() => asUser(ana.id, () => db.query("insert into insights_manuais (contato_id, texto) values ($1, 'x')", [cAna.id])))).ok);
  check('texto vazio ou gigante é recusado', !(await attempt(() => ins(cAna.id, ''))).ok && !(await attempt(() => ins(cAna.id, 'a'.repeat(801)))).ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
