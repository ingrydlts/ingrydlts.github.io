// Testa crm-pos-call.sql (a etapa "Pós-call") num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1 (repositório
// POR-DENTRO-APP) e do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:poscall
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-dossie.sql'), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-pos-call.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const ids = {};
  for (const n of ['ana', 'bia', 'cla', 'dan']) {
    await db.query("insert into contatos (email) values ($1) on conflict (email) do nothing", [n + '@example.com']);
    ids[n] = (await q('select id from contatos where email=$1', [n + '@example.com']))[0].id;
  }
  await db.query('update contatos set user_id=$1 where id=$2', [ana.id, ids.ana]);
  const salvar = (id, dados, quem = admin.id) => asUser(quem, () => db.query('select crm_salvar_dossie($1, $2) as d', [id, JSON.stringify(dados)]));
  const dossie = async (id) => (await q('select dossie from contatos where id=$1', [id]))[0].dossie;

  console.log('\n== Vocabulário de sinais ==');
  check('os 8 sinais iniciais existem e estão ativos', (await q('select count(*)::int n from sinais_vocabulario where ativo'))[0].n === 8);
  check('a 2ª rodada não duplicou', (await q("select count(*)::int n from sinais_vocabulario where chave='dap_verte'"))[0].n === 1);
  check('chave fora do formato é recusada', !(await attempt(() => db.query("insert into sinais_vocabulario (chave, rotulo) values ('Tem Espaço', 'x')"))).ok);

  console.log('\n== Dossiê: chaves novas ==');
  check('formacao_alvo, grupo_area, frances_gargalo, ensino_medio_ano, booleanos e area_interesse entram', (await attempt(() => salvar(ids.ana, {
    formacao_alvo: 'l1_universidade', grupo_area: 'artes_audiovisual', frances_gargalo: 'ambos', ensino_medio_ano: 2018,
    tem_graduacao: false, tem_aula_frances: false, plano_b: true, area_interesse: 'cinema' }))).ok);
  const d1 = await dossie(ids.ana);
  check('ficaram gravadas com o tipo certo', d1.formacao_alvo === 'l1_universidade' && d1.ensino_medio_ano === 2018 && d1.plano_b === true && d1.tem_graduacao === false);
  check('DU e francês B2 entram (formação e grande área)', (await attempt(() => salvar(ids.ana, { formacao_alvo: 'du', grupo_area: 'frances_b2' }))).ok);
  check('valor fora da lista é recusado', !(await attempt(() => salvar(ids.ana, { formacao_alvo: 'medicina' }))).ok && !(await attempt(() => salvar(ids.ana, { grupo_area: 'x' }))).ok && !(await attempt(() => salvar(ids.ana, { frances_gargalo: 'x' }))).ok);
  check('ano inválido é recusado (texto, futuro distante, antigo)', !(await attempt(() => salvar(ids.ana, { ensino_medio_ano: '2018' }))).ok && !(await attempt(() => salvar(ids.ana, { ensino_medio_ano: 2150 }))).ok && !(await attempt(() => salvar(ids.ana, { ensino_medio_ano: 1950 }))).ok);
  check('booleano como texto é recusado', !(await attempt(() => salvar(ids.ana, { plano_b: 'sim' }))).ok);
  check('o que já existia continua valendo (cfEtapa, cidade) e chave desconhecida continua recusada', (await attempt(() => salvar(ids.ana, { cidade: 'Paris', cfEtapa: 3 }))).ok && !(await attempt(() => salvar(ids.ana, { chave_inventada: 1 }))).ok);

  console.log('\n== Dossiê: sinais ==');
  check('lista de sinais do vocabulário entra', (await attempt(() => salvar(ids.ana, { sinais: ['sem_graduacao', 'dap_verte'] }))).ok && (await dossie(ids.ana)).sinais.join() === 'sem_graduacao,dap_verte');
  check('sinal que não existe é recusado', !(await attempt(() => salvar(ids.ana, { sinais: ['inventado'] }))).ok);
  await db.query("update sinais_vocabulario set ativo=false where chave='quer_plano_b'");
  check('sinal desativado é recusado', !(await attempt(() => salvar(ids.ana, { sinais: ['quer_plano_b'] }))).ok);
  await db.query("update sinais_vocabulario set ativo=true where chave='quer_plano_b'");
  check('não-lista e item que não é texto são recusados', !(await attempt(() => salvar(ids.ana, { sinais: 'dap_verte' }))).ok && !(await attempt(() => salvar(ids.ana, { sinais: [1] }))).ok);
  check('uma recusa não deixa meia gravação (o dossiê da Ana segue com os 2 sinais)', (await dossie(ids.ana)).sinais.length === 2);

  console.log('\n== Permissões ==');
  for (const t of ['sinais_vocabulario', 'pos_call_propostas', 'curadoria_fila']) {
    check(t + ': pessoa logada não lê', (await asUser(ana.id, () => db.query(`select * from ${t}`))).rows.length === 0);
    check(t + ': anon não lê', !(await attempt(() => asAnon(() => db.query(`select * from ${t}`)))).ok);
    check(t + ': pessoa logada não escreve', !(await attempt(() => asUser(ana.id, () => db.query(`insert into ${t} default values`)))).ok);
  }
  check('admin lê o vocabulário', (await asUser(admin.id, () => db.query('select * from sinais_vocabulario'))).rows.length === 8);

  console.log('\n== Propostas ==');
  const H = (c) => c.repeat(64);
  const proposta = { campos: { cidade: { valor: 'Paris', confianca: 'alta' } } };
  const ins = (cid, hash = H('a')) => asUser(admin.id, () => db.query("insert into pos_call_propostas (contato_id, hash_entrada, proposta) values ($1, $2, $3) returning id", [cid, hash, JSON.stringify(proposta)]));
  const p1 = (await ins(ids.ana)).rows[0].id;
  check('a mesma entrada pendente não duplica (não gasta outra leitura)', !(await attempt(() => ins(ids.ana))).ok);
  check('outra entrada da mesma pessoa pode', (await attempt(() => ins(ids.ana, H('b')))).ok);
  check('hash fora do tamanho é recusado', !(await attempt(() => ins(ids.ana, 'curto'))).ok);

  console.log('\n== Aplicar ==');
  const aplicar = (pid, campos, fila, quem = admin.id) => asUser(quem, () => db.query('select crm_pos_call_aplicar($1, $2, $3) as r', [pid, JSON.stringify(campos), JSON.stringify(fila)]));
  check('pessoa logada não aplica', !(await attempt(() => aplicar(p1, {}, [], ana.id))).ok);
  check('anon não aplica', !(await attempt(() => asAnon(() => db.query("select crm_pos_call_aplicar(1, '{}', '[]')")))).ok);
  await db.query("update contatos set ultimo_evento_em = '2026-01-01T00:00:00Z' where id=$1", [ids.ana]);
  const fila1 = [
    { tipo: 'pergunta', texto: 'Qual a diferença entre BTS e L1?', tema: 'curso_calendario_fixo' },
    { tipo: 'resposta', texto: 'Cursos artísticos seguem o ciclo.', tema: 'curso_calendario_fixo' },
    { tipo: 'item', texto: 'DAP verte para quem já mora na França', tema: 'dap_verte', camada: 'padrao', payload: { fator: 'legal', titulo: 'DAP verte', a_conferir: true } }
  ];
  const ap = await attempt(() => aplicar(p1, { cidade: 'Lyon', sinais: ['sem_graduacao', 'dap_verte', 'curso_calendario_fixo'] }, fila1));
  check('aplicar funciona', ap.ok); if (!ap.ok) console.log(ap.error.message);
  const da = await dossie(ids.ana);
  check('o dossiê recebeu os campos e os sinais', da.cidade === 'Lyon' && da.sinais.length === 3);
  check('a fila recebeu as 3 linhas, com camada e payload', (await q('select count(*)::int n from curadoria_fila where contato_id=$1', [ids.ana]))[0].n === 3 && (await q("select payload->>'titulo' t from curadoria_fila where tipo='item'"))[0].t === 'DAP verte');
  check('a proposta ficou aplicada, com data', (await q('select status, decidida_em is not null d from pos_call_propostas where id=$1', [p1]))[0].status === 'aplicada');
  check('entrou na linha do tempo sem zerar o "parada há N dias" dela', (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='pos_call_aplicada'", [ids.ana]))[0].n === 1 && new Date((await q('select ultimo_evento_em u from contatos where id=$1', [ids.ana]))[0].u).toISOString() === '2026-01-01T00:00:00.000Z');
  check('aplicar de novo a mesma proposta é recusado', !(await attempt(() => aplicar(p1, {}, []))).ok);

  const p2 = (await ins(ids.bia)).rows[0].id;
  check('sinal inventado derruba tudo: nada entra na fila e a proposta segue pendente', !(await attempt(() => aplicar(p2, { sinais: ['inventado'] }, fila1))).ok
    && (await q('select count(*)::int n from curadoria_fila where contato_id=$1', [ids.bia]))[0].n === 0 && (await q('select status from pos_call_propostas where id=$1', [p2]))[0].status === 'pendente');
  check('linha de fila com tipo inválido derruba tudo', !(await attempt(() => aplicar(p2, { cidade: 'Nice' }, [{ tipo: 'outro', texto: 'x', tema: 'dap_verte' }]))).ok && !('cidade' in (await dossie(ids.bia))));
  check('tema fora do formato é recusado', !(await attempt(() => aplicar(p2, {}, [{ tipo: 'pergunta', texto: 'x', tema: 'Tem Espaço' }]))).ok);
  check('texto vazio na fila é recusado', !(await attempt(() => aplicar(p2, {}, [{ tipo: 'pergunta', texto: '   ', tema: 'outro' }]))).ok);
  check('fila grande demais é recusada', !(await attempt(() => aplicar(p2, {}, Array.from({ length: 41 }, () => ({ tipo: 'pergunta', texto: 'x', tema: 'outro' }))))).ok);

  console.log('\n== Descartar ==');
  check('pessoa logada não descarta', !(await attempt(() => asUser(ana.id, () => db.query('select crm_pos_call_descartar($1)', [p2])))).ok);
  await asUser(admin.id, () => db.query('select crm_pos_call_descartar($1)', [p2]));
  check('descartada: status certo, e nada foi aplicado', (await q('select status from pos_call_propostas where id=$1', [p2]))[0].status === 'descartada' && !('cidade' in (await dossie(ids.bia))));

  console.log('\n== Regra dos 3 (curadoria) ==');
  const contagem = async () => (await asUser(admin.id, () => db.query('select * from crm_curadoria_contagem()'))).rows;
  let c = (await contagem()).find((x) => x.tema === 'curso_calendario_fixo');
  check('1 pessoa, 2 linhas: conta 1 pessoa (a mesma pessoa não vale duas vezes) e não está pronto', c && Number(c.n_pessoas) === 1 && Number(c.n_itens) === 2 && c.pronto === false);
  check('item candidato não entra na contagem do tema', !(await contagem()).some((x) => x.tema === 'dap_verte'));
  const mais = async (cid, tema, hash) => { const pid = (await ins(cid, hash)).rows[0].id; await aplicar(pid, {}, [{ tipo: 'pergunta', texto: 'Dúvida de ' + tema, tema }]); };
  await mais(ids.bia, 'curso_calendario_fixo', H('c'));
  c = (await contagem()).find((x) => x.tema === 'curso_calendario_fixo');
  check('2 pessoas: ainda não está pronto', Number(c.n_pessoas) === 2 && c.pronto === false);
  await mais(ids.cla, 'curso_calendario_fixo', H('d'));
  c = (await contagem()).find((x) => x.tema === 'curso_calendario_fixo');
  check('3 pessoas: pronto para virar padrão', Number(c.n_pessoas) === 3 && c.pronto === true);
  check('pessoa logada não vê a contagem', (await asUser(ana.id, () => db.query('select * from crm_curadoria_contagem()'))).rows.length === 0);
  check('pessoa logada não resolve tema', !(await attempt(() => asUser(ana.id, () => db.query("select crm_curadoria_resolver('curso_calendario_fixo', 'virou_conteudo')")))).ok);
  check('status inválido é recusado', !(await attempt(() => asUser(admin.id, () => db.query("select crm_curadoria_resolver('curso_calendario_fixo', 'aberta')")))).ok);
  const fechadas = (await asUser(admin.id, () => db.query("select crm_curadoria_resolver('curso_calendario_fixo', 'virou_conteudo') n"))).rows[0].n;
  check('resolver fecha as linhas abertas do tema e devolve quantas', fechadas === 4);
  check('depois de resolver, o tema recomeça do zero', !(await contagem()).some((x) => x.tema === 'curso_calendario_fixo'));
  check('o histórico das linhas fechadas continua', (await q("select count(*)::int n from curadoria_fila where status='virou_conteudo'"))[0].n === 4);

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
