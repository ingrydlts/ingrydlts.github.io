// Testa crm-radar.sql (o Radar: PESTEL por persona que vira a seção da Home de cada pessoa) num Postgres efêmero
// (PGlite), em cima dos arquivos reais das fases anteriores. Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:radar
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../POR-DENTRO-APP/db');
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
const CHAVE = 'c'.repeat(64);
const OUTRA = 'd'.repeat(64);

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
  for (const f of ['crm-fase2.sql', 'crm-fase2c-lembretes.sql', 'crm-fase3-cerebro.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-radar.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  await db.query("insert into cerebro_chaves (rotulo, hash) values ('hub', sha256(convert_to($1, 'UTF8')))", [CHAVE]);
  const mk = async (email, persona, { conta = true, estagio = 'em_uso' } = {}) => {
    let uid = null;
    if (conta) uid = (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id;
    await db.query('insert into contatos (email, persona, user_id, estagio) values ($1, $2, $3, $4) on conflict (email) do update set persona = excluded.persona, user_id = excluded.user_id, estagio = excluded.estagio', [email, persona, uid, estagio]);
    const [c] = await q('select id from contatos where email = $1', [email]);
    return { uid, cid: c.id };
  };
  const ana = await mk('ana@example.com', 'campus_france');
  const bia = await mk('bia@example.com', 'campus_france');
  const cris = await mk('cris@example.com', 'campus_france', { conta: false });          // lead: sem conta, não vê a Home
  const dani = await mk('dani@example.com', 'campus_france', { estagio: 'inativo' });
  const eva = await mk('eva@example.com', 'au_pair_estudante');

  const item = { persona: 'campus_france', fator: 'economico', titulo: 'Recursos mínimos subiram', texto: 'O visto passou a exigir 877,50 €/mês.',
    impacto: 'Sua prova de recursos precisa cobrir o novo valor.', acao: 'Refaça a conta com o novo mínimo.',
    fonte_rotulo: 'Decreto 2026-526', fonte_url: 'https://www.legifrance.gouv.fr/', verificado_em: '2026-10-16' };
  const novoItem = async (o = {}) => {
    const x = { ...item, ...o };
    return (await asUser(admin.id, () => db.query(
      `insert into radar_itens (persona, fator, titulo, texto, impacto, acao, fonte_rotulo, fonte_url, verificado_em, vigente_ate)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [x.persona, x.fator, x.titulo, x.texto, x.impacto, x.acao, x.fonte_rotulo, x.fonte_url, x.verificado_em, x.vigente_ate || null]))).rows[0].id;
  };

  console.log('\n== Permissões e validação ==');
  check('anon não lê nem escreve as tabelas', !(await attempt(() => asAnon(() => db.query('select * from radar_itens')))).ok && !(await attempt(() => asAnon(() => db.query('select * from radar_envios')))).ok);
  check('pessoa logada não lê as tabelas (RLS só admin)', (await asUser(ana.uid, () => db.query('select * from radar_itens'))).rows.length === 0);
  check('pessoa logada não cria item', !(await attempt(() => asUser(ana.uid, () => db.query("insert into radar_itens (persona, fator, titulo, texto) values ('pvt','legal','x','y')")))).ok);
  const id1 = await novoItem();
  check('admin cria item', Number.isInteger(Number(id1)));
  check('persona inválida é recusada', !(await attempt(() => novoItem({ persona: 'turista' }))).ok);
  check('fator inválido é recusado', !(await attempt(() => novoItem({ fator: 'cultural' }))).ok);
  check('link da fonte precisa ser https', !(await attempt(() => novoItem({ fonte_url: 'http://exemplo.fr' }))).ok && !(await attempt(() => novoItem({ fonte_url: 'javascript:alert(1)' }))).ok);
  check('título vazio ou gigante é recusado', !(await attempt(() => novoItem({ titulo: '' }))).ok && !(await attempt(() => novoItem({ titulo: 'a'.repeat(121) }))).ok);
  check('anon não chama radar_enviar, meu_radar nem marcar_radar_visto',
    !(await attempt(() => asAnon(() => db.query('select radar_enviar($1)', [id1])))).ok
    && !(await attempt(() => asAnon(() => db.query('select * from meu_radar()')))).ok
    && !(await attempt(() => asAnon(() => db.query('select marcar_radar_visto(1)')))).ok);
  check('pessoa logada não usa radar_enviar', !(await attempt(() => asUser(ana.uid, () => db.query('select radar_enviar($1)', [id1])))).ok);

  console.log('\n== Enviar para a persona inteira ==');
  const env = (itemId, contatos, nota) => asUser(admin.id, async () => (await db.query('select radar_enviar($1, $2, $3) as n', [itemId, contatos, nota])).rows[0].n);
  check('item que não existe é recusado', !(await attempt(() => env(999999, null, null))).ok);
  const n1 = await env(id1, null, '  Olha essa antes de refazer a conta  ');
  check('chega só a quem tem conta, é da persona e não está inativo (ana e bia)', n1 === 2);
  const envios = await q('select e.contato_id, e.nota from radar_envios e where e.item_id = $1', [id1]);
  check('não chega ao lead sem conta, ao inativo nem a outra persona', !envios.some((e) => [cris.cid, dani.cid, eva.cid].includes(e.contato_id)));
  check('a nota vem aparada', envios.every((e) => e.nota === 'Olha essa antes de refazer a conta'));
  check('mandar de novo não duplica (devolve 0)', (await env(id1, null, null)) === 0 && (await q('select count(*)::int n from radar_envios where item_id=$1', [id1]))[0].n === 2);
  const [it1] = await q('select avisado_em from radar_itens where id = $1', [id1]);
  check('o item passa a "cliente avisado" no 1º envio', it1.avisado_em !== null);

  console.log('\n== Enviar para pessoas específicas ==');
  const id2 = await novoItem({ fator: 'legal', titulo: 'ENEM mínimo' });
  check('lista explícita: só quem tem conta recebe (cris, sem conta, fica de fora)', (await env(id2, [ana.cid, cris.cid], 'só para você')) === 1);
  check('lista explícita pode ser de outra persona', (await env(id2, [eva.cid], null)) === 1);
  check('lista vazia não manda para ninguém', (await env(id2, [], null)) === 0);
  const [it2] = await q('select avisado_em from radar_itens where id = $1', [id2]);
  const id3 = await novoItem({ fator: 'social', titulo: 'Ainda sem aviso' });
  check('item sem nenhum envio continua sem "avisado"', (await q('select avisado_em from radar_itens where id = $1', [id3]))[0].avisado_em === null && it2.avisado_em !== null);
  await asUser(admin.id, () => db.query('update radar_itens set arquivado_em = now() where id = $1', [id3]));
  check('item arquivado não pode ser enviado', !(await attempt(() => env(id3, null, null))).ok);

  console.log('\n== O aviso para a pessoa ==');
  const sin = await q('select s.mensagem from sinais s where s.contato_id = $1 order by s.id', [ana.cid]);
  check('cada envio cria um sinal (sininho) com o título', sin.length === 2 && sin.every((s) => /^Novo no seu Radar: /.test(s.mensagem)) && sin[0].mensagem.includes('Recursos mínimos subiram'));
  const meus = await asUser(ana.uid, () => db.query('select * from meus_sinais()'));
  check('a pessoa vê o sinal em meus_sinais()', meus.rows.length === 2);
  check('o envio aparece na linha do tempo como sinal enviado', (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='sinal_enviado'", [ana.cid]))[0].n === 2);
  check('mandar o Radar não zera o "parada há N dias"', (await q('select ultimo_evento_em from contatos where id=$1', [ana.cid]))[0].ultimo_evento_em === null);

  console.log('\n== A pessoa lê ==');
  const lista = async (u) => (await asUser(u, () => db.query('select * from meu_radar()'))).rows;
  const dela = await lista(ana.uid);
  check('ana vê os 2 itens que recebeu, o mais novo primeiro', dela.length === 2 && dela[0].titulo === 'ENEM mínimo' && dela[1].titulo === 'Recursos mínimos subiram');
  const r = dela[1];
  check('o item vem completo, com nota, fonte e data', r.fator === 'economico' && r.impacto && r.acao && r.fonte_rotulo === 'Decreto 2026-526' && r.fonte_url.startsWith('https://') && String(r.verificado_em).includes('2026') && r.nota === 'Olha essa antes de refazer a conta' && r.visto_em === null && r.vencido === false);
  check('bia vê só o que recebeu (o item da persona), sem o ENEM que foi só para a ana', (await lista(bia.uid)).length === 1 && (await lista(bia.uid))[0].titulo === 'Recursos mínimos subiram');
  check('quem não recebeu nada vê lista vazia', (await lista((await mk('fabi@example.com', 'pvt')).uid)).length === 0);
  await asUser(admin.id, () => db.query('update radar_itens set vigente_ate = $2 where id = $1', [id1, '2020-01-01']));
  check('item com vigência vencida vem marcado como vencido', (await lista(ana.uid)).find((x) => x.item_id === id1).vencido === true);
  await asUser(admin.id, () => db.query('update radar_itens set arquivado_em = now() where id = $1', [id2]));
  check('item arquivado some da Home', (await lista(ana.uid)).length === 1);

  console.log('\n== A pessoa viu ==');
  const envAna = (await lista(ana.uid))[0].envio_id;
  const viu = (u, e) => asUser(u, () => db.query('select marcar_radar_visto($1)', [e]));
  await viu(bia.uid, envAna);
  check('outra pessoa não marca o envio dela', (await q('select visto_em from radar_envios where id=$1', [envAna]))[0].visto_em === null);
  await viu(ana.uid, envAna);
  const v1 = (await q('select visto_em from radar_envios where id=$1', [envAna]))[0].visto_em;
  check('ela marca o seu: visto_em preenchido', v1 !== null);
  await viu(ana.uid, envAna);
  check('marcar de novo não muda a data nem repete o evento', String((await q('select visto_em from radar_envios where id=$1', [envAna]))[0].visto_em) === String(v1) && (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='radar_visto'", [ana.cid]))[0].n === 1);
  check('ver o Radar é coisa dela: zera o "parada há N dias"', (await q('select ultimo_evento_em from contatos where id=$1', [ana.cid]))[0].ultimo_evento_em !== null);
  check('envio que não existe não estoura', (await attempt(() => viu(ana.uid, 999999))).ok);

  console.log('\n== Ponte com o Cérebro ==');
  const imp = (chave, itens) => attempt(() => asAnon(() => db.query('select radar_importar_cerebro($1, $2) as r', [chave, JSON.stringify(itens)])));
  const base = { persona: 'campus_france', fator: 'politico', titulo: 'Taxas diferenciadas', texto: 'Decreto 2026-385 aplicado de fato.', tema: 'candidatura-2027', cerebro_ref: 'candidatura-2027#politico' };
  for (const [label, ch] of [['sem chave', null], ['chave curta', 'abc'], ['chave errada', OUTRA]]) {
    const r0 = await imp(ch, [base]);
    check(`recusa ${label}`, !r0.ok && /chave_invalida/.test(r0.error.message));
  }
  check('formato que não é lista é recusado', !(await imp(CHAVE, { a: 1 })).ok);
  const i1 = await imp(CHAVE, [base, { ...base, persona: 'alternancia_emprego', cerebro_ref: 'candidatura-2027#politico' }, { ...base, fator: 'cultural', cerebro_ref: 'x' }, { ...base, cerebro_ref: '' }]);
  check('importa 2 novos e pula os 2 inválidos (fator inexistente, sem referência)', i1.ok && i1.value.rows[0].r.novos === 2 && i1.value.rows[0].r.pulados === 2);
  check('o que veio do Cérebro fica marcado como origem cerebro', (await q("select count(*)::int n from radar_itens where origem='cerebro' and tema='candidatura-2027'"))[0].n === 2);
  const [imp1] = await q("select id from radar_itens where cerebro_ref='candidatura-2027#politico' and persona='campus_france'");
  await env(imp1.id, [ana.cid], null);
  const i2 = await imp(CHAVE, [{ ...base, titulo: 'Taxas diferenciadas (atualizado)', verificado_em: '2026-10-20' }]);
  check('reimportar atualiza em vez de duplicar', i2.ok && i2.value.rows[0].r.atualizados === 1 && i2.value.rows[0].r.novos === 0 && (await q("select count(*)::int n from radar_itens where cerebro_ref='candidatura-2027#politico' and persona='campus_france'"))[0].n === 1);
  check('o que já foi enviado continua enviado e mostra o texto novo', (await lista(ana.uid)).some((x) => x.titulo === 'Taxas diferenciadas (atualizado)'));
  check('reimportar não apaga o "cliente avisado"', (await q('select avisado_em from radar_itens where id=$1', [imp1.id]))[0].avisado_em !== null);
  const pc = await attempt(() => asAnon(() => db.query('select radar_para_cerebro($1) as r', [CHAVE])));
  const tema = pc.ok ? pc.value.rows[0].r.find((t) => t.cerebro_ref === 'candidatura-2027#politico') : null;
  check('o hub vê por tema quantos itens já foram avisados a clientes (regra: cliente antes do post)', pc.ok && tema && tema.itens === 2 && tema.avisados === 1);
  check('radar_para_cerebro recusa chave errada e não devolve pessoa nenhuma', !(await attempt(() => asAnon(() => db.query('select radar_para_cerebro($1)', [OUTRA])))).ok && !JSON.stringify(pc.value.rows[0].r).includes('example.com'));

  console.log('\n== Exclusão do contato ==');
  await db.query('delete from contatos where id = $1', [ana.cid]);
  check('apagar o contato apaga os envios dele (e só deles)', (await q('select count(*)::int n from radar_envios where contato_id=$1', [ana.cid]))[0].n === 0 && (await q('select count(*)::int n from radar_envios'))[0].n > 0);

  console.log(`\n${passed} verificações ok, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
