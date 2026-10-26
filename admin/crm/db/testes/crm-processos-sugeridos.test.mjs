// Testa crm-processos-sugeridos.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (que vivem
// no repositório POR-DENTRO-APP). Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:processos
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
const erro = (r) => String((r.error && r.error.message) || '');

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
    -- Como no Supabase: EXECUTE direto a anon em toda função nova (o "revoke ... from public" não alcança).
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-processos-sugeridos.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(erro(r1));
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(erro(r2));

  const [admin] = await q("insert into auth.users (email, email_confirmed_at) values ('admin@example.com', now()) returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  const [bia] = await q("insert into auth.users (email, email_confirmed_at) values ('bia@example.com', now()) returning id");
  const [semFicha] = await q("insert into auth.users (email, email_confirmed_at) values ('sem@example.com', now()) returning id");
  await db.query("delete from contatos where user_id = $1", [semFicha.id]);
  const [cAna] = await q("select id from contatos where user_id = $1", [ana.id]);
  const [cBia] = await q("select id from contatos where user_id = $1", [bia.id]);
  check('setup: Ana e Bia com ficha ligada', !!cAna && !!cBia);
  const SINAIS = [{ codigo: 'moradia_resolvida', texto: 'Respondeu que a moradia na França já está resolvida.' }];
  const sinalizar = (u, proc, sinais) => asUser(u, () => db.query('select sinalizar_processo($1, $2)', [proc, JSON.stringify(sinais)]));
  const linha = async (cid, proc) => (await q('select * from processos_sugeridos where contato_id=$1 and processo=$2', [cid, proc]))[0];
  const meus = async (u) => (await asUser(u, () => db.query('select * from meus_processos()'))).rows;
  const decidir = (u, id, d, msg) => asUser(u, () => db.query('select crm_decidir_processo($1, $2, $3) as s', [id, d, msg || null]));
  const responder = (u, id, r) => asUser(u, () => db.query('select responder_processo($1, $2) as s', [id, r]));

  console.log('\n== Site público e acesso direto ==');
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from processos_sugeridos')))).ok);
  for (const f of ["sinalizar_processo('caf', '[]')", 'meus_processos()', "responder_processo(1, 'aceitar')", "crm_decidir_processo(1, 'aprovar')"])
    check('anon não chama ' + f.split('(')[0], !(await attempt(() => asAnon(() => db.query('select ' + f)))).ok);
  check('pessoa não insere direto', !(await attempt(() => asUser(ana.id, () => db.query("insert into processos_sugeridos (contato_id, processo) values ($1, 'caf')", [cAna.id])))).ok);

  console.log('\n== O app sinaliza ==');
  await sinalizar(ana.id, 'caf', SINAIS);
  let caf = await linha(cAna.id, 'caf');
  check('cria a sugestão detectada, com os sinais, na ficha DELA', caf && caf.status === 'detectada' && caf.sinais[0].texto === SINAIS[0].texto);
  check('pessoa não lê a tabela direto (RLS)', (await asUser(ana.id, () => db.query('select * from processos_sugeridos'))).rows.length === 0);
  check('detectada não aparece para ela (nada muda até você aprovar)', (await meus(ana.id)).length === 0);
  await sinalizar(ana.id, 'caf', [...SINAIS, { codigo: 'comprovante_endereco', texto: 'Tem comprovante de endereço no nome dela.', extra: 'x' }]);
  caf = await linha(cAna.id, 'caf');
  check('novos sinais atualizam a detectada (sem duplicar)', caf.sinais.length === 2 && Number((await q('select count(*) n from processos_sugeridos where contato_id=$1', [cAna.id]))[0].n) === 1);
  check('chaves fora do formato são descartadas', caf.sinais[1].extra === undefined && caf.sinais[1].codigo === 'comprovante_endereco');
  await sinalizar(ana.id, 'banco', [{ codigo: 'x', texto: 'a'.repeat(500) }]);
  check('texto longo é cortado em 200', (await linha(cAna.id, 'banco')).sinais[0].texto.length === 200);
  for (const [proc, sinais, motivo] of [['CAF!', SINAIS, 'processo fora do formato'], ['caf', [], 'sem sinais'], ['caf', Array(11).fill(SINAIS[0]), 'sinais demais'], ['caf', [{ codigo: 'x' }], 'sinal sem texto'], ['caf', { a: 1 }, 'sinais que não são lista']])
    check('recusa ' + motivo, !(await attempt(() => sinalizar(ana.id, proc, sinais))).ok);
  check('conta sem ficha: sinalizar não faz nada nem quebra', (await attempt(() => sinalizar(semFicha.id, 'caf', SINAIS))).ok && Number((await q("select count(*) n from processos_sugeridos")).at(0).n) === 2);
  await sinalizar(bia.id, 'caf', SINAIS);
  check('a sugestão da Bia fica na ficha da Bia', (await linha(cBia.id, 'caf')).status === 'detectada' && (await linha(cAna.id, 'caf')).sinais.length === 2);

  console.log('\n== Você decide ==');
  check('pessoa não decide', !(await attempt(() => decidir(ana.id, caf.id, 'aprovar'))).ok);
  check('decisão inválida é recusada', !(await attempt(() => decidir(admin.id, caf.id, 'talvez'))).ok);
  check('recado com mais de 500 caracteres é recusado', !(await attempt(() => decidir(admin.id, caf.id, 'aprovar', 'a'.repeat(501)))).ok);
  check('você aprova com recado', (await decidir(admin.id, caf.id, 'aprovar', '  Vi que você já tem moradia: a CAF pode te ajudar.  ')).rows[0].s === 'aprovada');
  check('o recado vai sem espaços sobrando', (await linha(cAna.id, 'caf')).mensagem === 'Vi que você já tem moradia: a CAF pode te ajudar.');
  await sinalizar(ana.id, 'caf', [{ codigo: 'outro', texto: 'Outro sinal.' }]);
  check('depois de aprovada, novos sinais não mexem nela', (await linha(cAna.id, 'caf')).sinais.length === 2 && (await linha(cAna.id, 'caf')).status === 'aprovada');
  const banco = await linha(cAna.id, 'banco');
  check('você descarta', (await decidir(admin.id, banco.id, 'descartar')).rows[0].s === 'descartada');
  await sinalizar(ana.id, 'banco', SINAIS);
  check('descartada não volta sozinha', (await linha(cAna.id, 'banco')).status === 'descartada');

  console.log('\n== Ela responde ==');
  let m = await meus(ana.id);
  check('aprovada aparece para ela, com o recado e sem os sinais', m.length === 1 && m[0].processo === 'caf' && m[0].status === 'aprovada' && /CAF/.test(m[0].mensagem) && m[0].sinais === undefined);
  check('a Bia não vê a sugestão da Ana', (await meus(bia.id)).length === 0);
  check('a Bia não responde pela Ana', /processo_nao_encontrado/.test(erro(await attempt(() => responder(bia.id, caf.id, 'aceitar')))));
  check('resposta inválida é recusada', !(await attempt(() => responder(ana.id, caf.id, 'talvez'))).ok);
  check('Ana aceita', (await responder(ana.id, caf.id, 'aceitar')).rows[0].s === 'aceita');
  check('responder de novo não muda nada', /processo_nao_encontrado/.test(erro(await attempt(() => responder(ana.id, caf.id, 'recusar')))));
  m = await meus(ana.id);
  check('aceita continua em meus_processos (vira aba)', m.length === 1 && m[0].status === 'aceita');
  check('você não desfaz uma aceita por aqui', /processo_nao_encontrado/.test(erro(await attempt(() => decidir(admin.id, caf.id, 'descartar')))));
  const cafBia = await linha(cBia.id, 'caf');
  await decidir(admin.id, cafBia.id, 'aprovar');
  check('Bia recusa', (await responder(bia.id, cafBia.id, 'recusar')).rows[0].s === 'recusada' && (await meus(bia.id)).length === 0);
  check('você pode perguntar de novo (aprovar uma recusada)', (await decidir(admin.id, cafBia.id, 'aprovar')).rows[0].s === 'aprovada' && (await meus(bia.id)).length === 1);

  console.log('\n== Catálogo ==');
  const fns = (await q(`select p.proname, coalesce(array_to_string(p.proconfig, ','), '') cfg, has_function_privilege('anon', p.oid, 'execute') anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('sinalizar_processo', 'meus_processos', 'responder_processo', 'crm_decidir_processo')`));
  check('as 4 funções existem', fns.length === 4);
  check('todas com search_path fixo e fora do alcance de anon', fns.every((f) => /search_path=/.test(f.cfg) && !f.anon));
  check('RLS ligada e anon sem acesso à tabela', (await q(`select c.relrowsecurity r, has_table_privilege('anon', c.oid, 'select') a from pg_class c where relname = 'processos_sugeridos'`)).every((x) => x.r && !x.a));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
