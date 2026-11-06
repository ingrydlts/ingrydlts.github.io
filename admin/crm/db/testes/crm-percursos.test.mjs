// Testa crm-percursos.sql (tabela de referência dos percursos, publicada pelo hub) num Postgres efêmero (PGlite).
// Não toca no Supabase real e não usa o conteúdo real dos percursos: só um conteúdo mínimo de teste.
//
// Uso:
//   cd admin/crm/db/testes && npm install
//   APP_DB_DIR="/caminho/para/POR-DENTRO-APP/db" npm run test:percursos
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();

let passed = 0, failed = 0;
const check = (label, cond) => { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } };
const attempt = async (fn) => { try { return { ok: true, value: await fn(), error: null }; } catch (e) { return { ok: false, value: null, error: e }; } };
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const erro = (r, re) => !r.ok && re.test(r.error.message);

const CHAVE = 'p'.repeat(64);        // chave de teste do rótulo 'percurso', só existe aqui
const CHAVE_METRICAS = 'm'.repeat(64); // chave de outro rótulo: NÃO pode publicar
const HASH_1 = 'a'.repeat(64);
const HASH_2 = 'b'.repeat(64);

const conteudo = (versao, hash, extra = {}) => ({
  schema_version: 1, versao, gerado_em: versao.slice(0, 10), hash,
  camadas: [['partida', 'Ponto de partida', '']],
  nos: { ensino_medio: { camada: 'partida', id: 'ensino_medio', nome: 'Ensino médio' } },
  percursos: [{ partida: 'ensino_medio' }],
  faixas: [{ id: '18-26' }],
  ...extra,
});

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
  for (const f of ['../crm-fase2.sql', '../crm-fase2c-lembretes.sql', '../crm-fase3-cerebro.sql'])
    await db.exec(readFileSync(path.resolve(HERE, f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-percursos.sql'), 'utf8');
  await db.exec(sql);
  check('o SQL é idempotente (roda duas vezes)', (await attempt(() => db.exec(sql))).ok);

  await db.query("insert into cerebro_chaves (rotulo, hash) values ('percurso', sha256(convert_to($1, 'UTF8')))", [CHAVE]);
  await db.query("insert into cerebro_chaves (rotulo, hash) values ('actions', sha256(convert_to($1, 'UTF8')))", [CHAVE_METRICAS]);
  const [admin] = await q("insert into auth.users (email, email_confirmed_at) values ('admin@example.com', now()) returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [cliente] = await q("insert into auth.users (email, email_confirmed_at) values ('cliente@example.com', now()) returning id");
  const novaCliente = async (email, persona) => {
    const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query('insert into profiles (id, persona) values ($1, $2) on conflict (id) do update set persona = excluded.persona', [u.id, persona]);
    return u.id;
  };
  const aupair = await novaCliente('aupair@example.com', 'au_pair_estudante');
  const pvt = await novaCliente('pvt@example.com', 'pvt');
  const alt = await novaCliente('alt@example.com', 'alternancia_emprego');
  const semPersona = await novaCliente('sem@example.com', null);
  const meu = (id) => attempt(() => asUser(id, () => db.query('select meu_percurso() as r')));

  console.log('\n== meu_percurso sem nenhuma versão publicada ==');
  const sv = await meu(aupair);
  check('sem versão ativa devolve sem_versao (não quebra)', sv.ok && sv.value.rows[0].r.status === 'sem_versao');

  const publica = (chave, c) => attempt(() => asAnon(() => db.query('select publicar_percurso($1, $2::jsonb) as r', [chave, JSON.stringify(c)])));

  console.log('\n== Chave: só a do rótulo percurso publica ==');
  for (const [label, ch] of [['sem chave', null], ['chave errada', 'x'.repeat(64)], ['chave curta', 'abc'], ['chave de outro rótulo (actions)', CHAVE_METRICAS]]) {
    const r = await publica(ch, conteudo('2026-11-05.1', HASH_1));
    check(`recusa ${label}`, erro(r, /chave_invalida/));
  }
  check('cliente logada, mesmo sem chave, não publica', erro(await attempt(() => asUser(cliente.id, () => db.query('select publicar_percurso($1, $2::jsonb)', ['x'.repeat(64), JSON.stringify(conteudo('2026-11-05.1', HASH_1))]))), /chave_invalida/));
  check('nada foi gravado pelas tentativas recusadas', (await q('select count(*)::int n from percurso_versoes'))[0].n === 0);

  console.log('\n== Publicar ==');
  const p1 = await publica(CHAVE, conteudo('2026-11-05.1', HASH_1));
  check('chave certa publica', p1.ok && p1.value.rows[0].r.status === 'publicada' && p1.value.rows[0].r.versao === '2026-11-05.1');
  let ativas = await q('select versao from percurso_versoes where ativa');
  check('a versão publicada fica ativa', ativas.length === 1 && ativas[0].versao === '2026-11-05.1');
  const igual = await publica(CHAVE, conteudo('2026-11-05.1', HASH_1));
  check('mesmo hash é idempotente: status igual, nada novo', igual.ok && igual.value.rows[0].r.status === 'igual' && (await q('select count(*)::int n from percurso_versoes'))[0].n === 1);
  const p2 = await publica(CHAVE, conteudo('2026-11-09.1', HASH_2));
  check('versão nova publica e passa a ser a única ativa', p2.ok && (await q("select versao from percurso_versoes where ativa")).length === 1 && (await q("select versao from percurso_versoes where ativa"))[0].versao === '2026-11-09.1');
  const velha = await publica(CHAVE, conteudo('2026-11-05.1', HASH_1));
  check('republicar o conteúdo antigo NÃO reativa a versão velha', velha.ok && velha.value.rows[0].r.status === 'igual' && velha.value.rows[0].r.ativa === false);
  check('mesma versão com outro conteúdo é recusada', erro(await publica(CHAVE, conteudo('2026-11-09.1', 'c'.repeat(64))), /versao_ja_existe/));

  console.log('\n== Recusas de formato ==');
  const casos = [
    ['versão fora do padrão', conteudo('hoje', 'd'.repeat(64)), /versao_invalida/],
    ['hash fora do padrão', conteudo('2026-12-01.1', 'xyz'), /hash_invalido/],
    ['schema_version desconhecido', conteudo('2026-12-01.1', 'e'.repeat(64), { schema_version: 2 }), /schema_nao_suportado/],
    ['sem schema_version', (() => { const c = conteudo('2026-12-01.1', 'e'.repeat(64)); delete c.schema_version; return c; })(), /schema_/],
    ['sem percursos', conteudo('2026-12-01.1', 'f'.repeat(64), { percursos: [] }), /conteudo_vazio/],
    ['nós como lista', conteudo('2026-12-01.1', '1'.repeat(64), { nos: [] }), /estrutura_invalida/],
    ['e-mail dentro do conhecimento', conteudo('2026-12-01.1', '2'.repeat(64), { nos: { a: { nome: 'fale com maria@exemplo.com' } } }), /dado_pessoal/],
    ['conteúdo grande demais', conteudo('2026-12-01.1', '3'.repeat(64), { lixo: 'x'.repeat(2100000) }), /conteudo_grande_demais/],
  ];
  for (const [label, c, re] of casos) check(`recusa ${label}`, erro(await publica(CHAVE, c), re));
  check('conteúdo que não é objeto é recusado', erro(await attempt(() => asAnon(() => db.query("select publicar_percurso($1, '[]'::jsonb)", [CHAVE]))), /conteudo_invalido/));
  check('nenhuma recusa gravou linha', (await q('select count(*)::int n from percurso_versoes'))[0].n === 2);

  console.log('\n== Acesso à tabela ==');
  check('anon não lê a tabela', !(await attempt(() => asAnon(() => db.query('select * from percurso_versoes')))).ok);
  const lc = await attempt(() => asUser(cliente.id, () => db.query('select * from percurso_versoes')));
  check('cliente logada vê 0 linhas', lc.ok && lc.value.rows.length === 0);
  const la = await attempt(() => asUser(admin.id, () => db.query('select versao, ativa from percurso_versoes order by id')));
  check('admin vê as versões', la.ok && la.value.rows.length === 2);
  for (const [label, sqlEscrita] of [
    ['insere', "insert into percurso_versoes (versao, schema_version, hash, conteudo) values ('2027-01-01.1', 1, repeat('9', 64), '{}'::jsonb)"],
    ['altera', 'update percurso_versoes set ativa = false'],
    ['apaga', 'delete from percurso_versoes'],
  ]) {
    check(`nem o admin ${label} direto na tabela`, !(await attempt(() => asUser(admin.id, () => db.query(sqlEscrita)))).ok);
    check(`cliente não ${label} direto na tabela`, !(await attempt(() => asUser(cliente.id, () => db.query(sqlEscrita)))).ok);
  }
  check('a chave nunca é chamável por fora (crm_percurso_chave_ok)', !(await attempt(() => asAnon(() => db.query('select crm_percurso_chave_ok($1)', [CHAVE])))).ok
    && !(await attempt(() => asUser(admin.id, () => db.query('select crm_percurso_chave_ok($1)', [CHAVE])))).ok);
  check('o conteúdo guardado não contém a chave', !JSON.stringify(await q('select conteudo from percurso_versoes')).includes(CHAVE));

  console.log('\n== Ativar (voltar atrás) ==');
  check('anon não ativa', !(await attempt(() => asAnon(() => db.query("select percurso_ativar('2026-11-05.1')")))).ok);
  check('cliente logada não ativa', erro(await attempt(() => asUser(cliente.id, () => db.query("select percurso_ativar('2026-11-05.1')"))), /sem_permissao/));
  check('versão que não existe é recusada', erro(await attempt(() => asUser(admin.id, () => db.query("select percurso_ativar('2000-01-01.1')"))), /versao_inexistente/));
  const at = await attempt(() => asUser(admin.id, () => db.query("select percurso_ativar('2026-11-05.1') as r")));
  ativas = await q('select versao from percurso_versoes where ativa');
  check('admin volta para a versão antiga e fica uma só ativa', at.ok && ativas.length === 1 && ativas[0].versao === '2026-11-05.1');

  console.log('\n== meu_percurso: só o pedaço da própria persona ==');
  const no = (camada, id, extra = {}) => ({ camada, id, nome: id, fonte: 'repo', ...extra });
  const rico = conteudo('2026-12-01.1', '7'.repeat(64), {
    nos: {
      ensino_medio: no('partida', 'ensino_medio'),
      au_pair: no('visto', 'au_pair', { persona: 'au_pair_estudante' }),
      pvt: no('visto', 'pvt', { persona: 'pvt' }),
      dap: no('ingresso', 'dap'), contato: no('ingresso', 'contato'),
      l1: no('nivel', 'l1'), fle: no('nivel', 'fle'),
      universite: no('inst', 'universite'), cfa: no('inst', 'cfa', { fonte: 'geral' }),
    },
    percursos: [
      { partida: 'ensino_medio', visto: 'au_pair', ingresso: 'dap', nivel: 'l1', inst: 'universite', modalidade: 'presencial', faixas: ['18-26'] },
      { partida: 'ensino_medio', visto: 'au_pair', ingresso: 'contato', nivel: 'fle', inst: 'cfa', modalidade: 'presencial', faixas: ['18-26'] },
      { partida: 'ensino_medio', visto: 'pvt', ingresso: 'contato', nivel: 'fle', inst: 'cfa', modalidade: 'presencial', faixas: ['18-26'] },
    ],
    regra_alternancia: 'regra de teste',
  });
  check('publica o conteúdo de teste com duas personas', (await publica(CHAVE, rico)).ok);

  const ra = (await meu(aupair)).value.rows[0].r;
  check('au pair: status ok, versão e visto certos', ra.status === 'ok' && ra.versao === '2026-12-01.1' && ra.visto === 'au_pair');
  check('au pair: só as 2 combinações do visto dela', ra.percursos.length === 2 && ra.percursos.every((p) => p.visto === 'au_pair'));
  check('au pair: só os nós que essas combinações citam', JSON.stringify(Object.keys(ra.nos).sort()) === JSON.stringify(['au_pair', 'cfa', 'contato', 'dap', 'ensino_medio', 'fle', 'l1', 'universite']));
  check('au pair: nada da persona pvt vaza (nó, persona nem combinação)', !('pvt' in ra.nos) && !JSON.stringify(ra).includes('"pvt"'));
  check('o campo fonte vem junto, para avisar "a confirmar"', ra.nos.cfa.fonte === 'geral' && ra.nos.dap.fonte === 'repo');
  check('faixas, camadas e regra de alternância vêm inteiras', ra.faixas.length === 1 && ra.camadas.length === 1 && ra.regra_alternancia === 'regra de teste');
  const rp = (await meu(pvt)).value.rows[0].r;
  check('pvt: 1 combinação e nenhum nó do au pair', rp.status === 'ok' && rp.percursos.length === 1 && !('au_pair' in rp.nos) && !('dap' in rp.nos) && !('l1' in rp.nos) && !JSON.stringify(rp).includes('"au_pair"'));
  const rn = (await meu(alt)).value.rows[0].r;
  check('persona sem nó de visto (alternancia_emprego) devolve sem_percurso, sem dado de outra persona', rn.status === 'sem_percurso' && !rn.nos && !rn.percursos);
  const rs = (await meu(semPersona)).value.rows[0].r;
  check('perfil sem persona devolve sem_persona', rs.status === 'sem_persona');
  check('quem não tem perfil não recebe nada além de sem_persona', (await attempt(() => asUser(admin.id, () => db.query('select meu_percurso() as r')))).value.rows[0].r.status === 'sem_persona');
  check('anon não chama meu_percurso', !(await attempt(() => asAnon(() => db.query('select meu_percurso()')))).ok);
  check('authenticated sem sessão (sem sub) é recusado', erro(await attempt(() => asUser('', () => db.query('select meu_percurso()'))), /sem_sessao/));
  check('a persona não vem de parâmetro: a função não aceita argumento', !(await attempt(() => asUser(aupair, () => db.query("select meu_percurso('pvt')")))).ok);

  console.log('\n== Chave revogada ==');
  await db.query("update cerebro_chaves set revogada_em = now() where rotulo = 'percurso'");
  check('chave revogada deixa de publicar', erro(await publica(CHAVE, conteudo('2027-02-01.1', '4'.repeat(64))), /chave_invalida/));

  console.log(`\n${passed} verificações ok, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
