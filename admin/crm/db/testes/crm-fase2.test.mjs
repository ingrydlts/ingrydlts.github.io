// Testa crm-fase2.sql num Postgres efêmero (PGlite), em cima dos arquivos reais da fase 1
// (que vivem no repositório POR-DENTRO-APP). Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install
//   APP_DB_DIR=/caminho/para/POR-DENTRO-APP/db npm test
// (padrão de APP_DB_DIR: ../../../../../../por-dentro-app/db, irmão deste repositório)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const FASE2 = path.resolve(HERE, '../crm-fase2.sql');
const FASE2C = path.resolve(HERE, '../crm-fase2c-lembretes.sql');
const db = new PGlite();

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) passed++; else { failed++; console.log('  FALHOU:', label); }
}
async function attempt(fn) {
  try { return { ok: true, value: await fn(), error: null }; }
  catch (e) { return { ok: false, value: null, error: e }; }
}
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); }
  finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const estagio = async (email) => (await q('select estagio from contatos where email=$1', [email]))[0]?.estagio;

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
  const sql2 = readFileSync(FASE2, 'utf8');
  await db.exec(sql2);
  const idem = await attempt(() => db.exec(sql2));
  check('fase 2 é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);
  const sql2c = readFileSync(FASE2C, 'utf8');
  await db.exec(sql2c);
  const idemC = await attempt(() => db.exec(sql2c));
  check('fase 2c (lembretes) é idempotente', idemC.ok);
  if (!idemC.ok) console.log(idemC.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [outra] = await q("insert into auth.users (email) values ('curiosa@example.com') returning id");

  console.log('\n== Público: enviar_pergunta_unica ==');
  const base = { email: 'Ana@Example.com', nome: 'Ana', texto: 'Posso trocar de visto?', artigo: 'troca-de-visto',
    aceita_servico: true, consentimento_versao: 'v1', texto_servico: 'Li e aceito.' };
  check('anon envia pergunta', (await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(base)])))).ok);
  const [ana] = await q("select * from contatos where email='ana@example.com'");
  check('cria o contato em minúsculas com origem = slug do artigo', ana?.origem === 'troca-de-visto' && ana?.estagio === 'lead');
  check('grava a pergunta como nova', (await q('select status from perguntas_unicas where contato_id=$1', [ana.id]))[0]?.status === 'nova');
  check('registra consentimento do serviço', (await q("select 1 from consentimentos where contato_id=$1 and finalidade='servico'", [ana.id])).length === 1);
  const evs = (await q('select tipo from eventos where contato_id=$1', [ana.id])).map((r) => r.tipo);
  check('eventos email_capturado + pergunta_unica', evs.includes('email_capturado') && evs.includes('pergunta_unica'));

  for (const [label, p, re] of [
    ['exige aceite', { ...base, aceita_servico: false }, /consentimento_obrigatorio/],
    ['rejeita e-mail inválido', { ...base, email: 'x' }, /email_invalido/],
    ['rejeita pergunta vazia', { ...base, texto: '   ' }, /pergunta_vazia/],
    ['rejeita pergunta gigante', { ...base, texto: 'a'.repeat(2001) }, /pergunta_grande_demais/],
  ]) {
    const r = await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(p)])));
    check(`enviar_pergunta_unica ${label}`, !r.ok && re.test(r.error.message));
  }
  await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(base)])));
  await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(base)])));
  const quarta = await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(base)])));
  check('limita a 3 perguntas abertas por pessoa', !quarta.ok && /muitas_perguntas_abertas/.test(quarta.error.message));
  check('mesmo e-mail não duplica contato', (await q("select count(*)::int n from contatos where email='ana@example.com'"))[0].n === 1);

  console.log('\n== Acesso: anon e não-admin ==');
  for (const t of ['perguntas_unicas', 'um_a_um', 'sinais', 'emails_enviados', 'crm_contatos']) {
    check(`anon não lê ${t}`, !(await attempt(() => asAnon(() => db.query(`select * from ${t} limit 1`)))).ok);
    const r = await attempt(() => asUser(outra.id, () => db.query(`select * from ${t}`)));
    check(`não-admin vê 0 linhas em ${t}`, r.ok && r.value.rows.length === 0);
  }
  check('anon não chama crm_marcar_inativos', !(await attempt(() => asAnon(() => db.query('select crm_marcar_inativos()')))).ok);
  check('logado não chama crm_marcar_inativos', !(await attempt(() => asUser(outra.id, () => db.query('select crm_marcar_inativos()')))).ok);

  console.log('\n== crm_contatos: urgência, motivo, subpersona ==');
  const lead = async (o) => db.query('select capturar_lead($1)', [JSON.stringify({ aceita_servico: true, ...o })]);
  await lead({ email: 'urg@example.com', nome: 'Urg', persona: 'au_pair_estudante', fase: 'urgente' });
  await lead({ email: 'prazo@example.com', persona: 'pvt', fase: 'adaptando', preocupacao: 'prazo' });
  await lead({ email: 'adapt@example.com', persona: 'pvt', fase: 'adaptando', preocupacao: 'caro' });
  await lead({ email: 'plan@example.com', persona: 'conjuge', fase: 'planejando' });
  const vis = async (email) => (await asUser(admin.id, () => db.query('select * from crm_contatos where email=$1', [email]))).rows[0];
  check('urgente → alta', (await vis('urg@example.com')).urgencia === 'alta');
  check('adaptando + prazo → alta', (await vis('prazo@example.com')).urgencia === 'alta');
  check('adaptando → média', (await vis('adapt@example.com')).urgencia === 'media');
  check('planejando → baixa', (await vis('plan@example.com')).urgencia === 'baixa');
  check('motivo explica a urgência', /urgência/.test((await vis('urg@example.com')).motivo || ''));
  check('sem motivo quando não há nada', (await vis('plan@example.com')).motivo === null);
  const todos = (await asUser(admin.id, () => db.query('select email from crm_contatos'))).rows.map((r) => r.email).sort(); console.log('   contatos:', todos.join(', ')); check('admin enxerga todos', todos.length === (await q('select count(*)::int n from contatos'))[0].n && todos.length > 0);

  await db.query("update contatos set caminho='indefinido' where email='plan@example.com'");
  check('subpersona vem do caminho + motivo "Não sei ainda"',
    (await vis('plan@example.com')).subpersona === 'indefinido' && /Não sei ainda/.test((await vis('plan@example.com')).motivo));

  console.log('\n== Estágio anda sozinho ==');
  const [urg] = await q("select id from contatos where email='urg@example.com'");
  const ins = (tipo) => db.query('insert into eventos (contato_id, tipo) values ($1,$2)', [urg.id, tipo]);
  await ins('app_aberto');
  check('app_aberto: lead → ativado', (await estagio('urg@example.com')) === 'ativado');
  await ins('checklist_marcado');
  check('checklist_marcado: ativado → em_uso', (await estagio('urg@example.com')) === 'em_uso');
  await ins('app_aberto');
  check('app_aberto não faz retroceder em_uso', (await estagio('urg@example.com')) === 'em_uso');
  const mudou = (await q("select dados from eventos where contato_id=$1 and tipo='estagio_alterado' order by id", [urg.id])).map((r) => r.dados);
  check('cada mudança de estágio vira evento com de/para', mudou.length === 2 && mudou[1].de === 'ativado' && mudou[1].para === 'em_uso');

  console.log('\n== 1:1 ==');
  await db.query("insert into um_a_um (contato_id, quando) values ($1, now() + interval '2 days')", [urg.id]);
  check('marcar 1:1 move para um_a_um', (await estagio('urg@example.com')) === 'um_a_um');
  check('1:1 aparece na visão', (await vis('urg@example.com')).um_a_um_quando !== null);
  await db.query("update contatos set estagio='concluido' where id=$1", [urg.id]);
  await db.query('insert into um_a_um (contato_id) values ($1)', [urg.id]);
  check('novo 1:1 não desfaz "concluído"', (await estagio('urg@example.com')) === 'concluido');

  console.log('\n== Pergunta respondida ==');
  const [perg] = await q('select id from perguntas_unicas where contato_id=$1 limit 1', [ana.id]);
  const semResp = await attempt(() => db.query("update perguntas_unicas set status='respondida' where id=$1", [perg.id]));
  check('não marca respondida sem resposta', !semResp.ok);
  await asUser(admin.id, () => db.query("update perguntas_unicas set status='respondida', resposta='Sim, dá.', respondida_em=now() where id=$1", [perg.id]));
  check('admin responde pergunta', (await q('select status from perguntas_unicas where id=$1', [perg.id]))[0].status === 'respondida');
  check('resposta vira evento', (await q("select 1 from eventos where contato_id=$1 and tipo='pergunta_respondida'", [ana.id])).length === 1);

  console.log('\n== Sinais ==');
  const [u] = await q("insert into auth.users (email) values ('ana@example.com') returning id"); // liga a conta ao contato pelo trigger da fase 1
  check('conta ligada ao contato', (await q('select user_id from contatos where id=$1', [ana.id]))[0].user_id === u.id);
  await asUser(admin.id, () => db.query("insert into sinais (contato_id, mensagem) values ($1, 'Lembrete de prazo')", [ana.id]));
  const meus = (await asUser(u.id, () => db.query('select * from meus_sinais()'))).rows;
  check('pessoa vê o próprio sinal', meus.length === 1 && meus[0].lido_em === null);
  check('pessoa não vê sinal de outra', (await asUser(outra.id, () => db.query('select * from meus_sinais()'))).rows.length === 0);
  await asUser(outra.id, () => db.query('select marcar_sinal_lido($1)', [meus[0].id]));
  check('outra pessoa não marca o sinal alheio', (await q('select lido_em from sinais where id=$1', [meus[0].id]))[0].lido_em === null);
  await asUser(u.id, () => db.query('select marcar_sinal_lido($1)', [meus[0].id]));
  check('pessoa marca o próprio sinal como lido', (await q('select lido_em from sinais where id=$1', [meus[0].id]))[0].lido_em !== null);
  check('não-admin não insere sinal', !(await attempt(() => asUser(u.id, () => db.query("insert into sinais (contato_id, mensagem) values ($1,'oi')", [ana.id])))).ok);
  check('registrar_evento aceita os tipos novos', (await attempt(() => asUser(u.id, () => db.query("select registrar_evento('checklist_marcado')")))).ok);
  check('registrar_evento ainda barra tipo fora da lista', !(await attempt(() => asUser(u.id, () => db.query("select registrar_evento('estagio_alterado')")))).ok);
  check('checklist_marcado da pessoa avança o estágio', (await estagio('ana@example.com')) === 'em_uso');

  console.log('\n== Reimpacto: segmentos ==');
  await lead({ email: 'seg1@example.com' }); await lead({ email: 'seg2@example.com' });
  await lead({ email: 'seg3@example.com' }); await lead({ email: 'seg4@example.com', fase: 'adaptando' });
  const cid = async (e) => (await q('select id from contatos where email=$1', [e]))[0].id;
  const mail = (e, status, dias) => db.query(
    "insert into emails_enviados (contato_id, modelo, status, enviado_em) values ($1,'boas_vindas',$2, now() - ($3 || ' days')::interval)", [e, status, String(dias)]);
  await mail(await cid('seg1@example.com'), 'entregue', 4);
  await mail(await cid('seg2@example.com'), 'aberto', 4);
  await mail(await cid('seg3@example.com'), 'clicado', 1);
  const c4 = await cid('seg4@example.com');
  await mail(c4, 'clicado', 10);
  await db.query("update contatos set estagio='ativado', ultimo_evento_em = now() - interval '9 days' where id=$1", [c4]);
  check('entregue há 3+ dias → naoabriu', (await vis('seg1@example.com')).segmento === 'naoabriu');
  check('aberto há 3+ dias → naoclicou', (await vis('seg2@example.com')).segmento === 'naoclicou');
  check('clicou e ainda é lead → cliquenaoapp', (await vis('seg3@example.com')).segmento === 'cliquenaoapp');
  check('ativado parado há 7+ dias → parouapp', (await vis('seg4@example.com')).segmento === 'parouapp');
  await mail(await cid('seg1@example.com'), 'entregue', 0);
  check('e-mail novo (recente) tira da fila do reimpacto', (await vis('seg1@example.com')).segmento === null);
  check('parado há 9 dias aparece em "dias" e no motivo', (await vis('seg4@example.com')).dias === 9 && /9 dias/.test((await vis('seg4@example.com')).motivo));
  check('e-mail enviado vira evento', (await q("select 1 from eventos where contato_id=$1 and tipo='email_enviado'", [await cid('seg1@example.com')])).length === 2);

  console.log('\n== Enviar e-mail não zera "parada há N dias" ==');
  await db.query("insert into eventos (contato_id, tipo) values ($1,'sinal_enviado')", [c4]);
  check('ação do admin não mexe em ultimo_evento_em', (await vis('seg4@example.com')).dias === 9);
  await db.query("insert into eventos (contato_id, tipo) values ($1,'artigo_lido')", [c4]);
  check('ação da pessoa zera o contador', (await vis('seg4@example.com')).dias === 0);

  console.log('\n== Rotina de inativos ==');
  await lead({ email: 'sumiu@example.com' });
  await db.query("update contatos set estagio='em_uso', ultimo_evento_em = now() - interval '31 days' where email='sumiu@example.com'");
  await lead({ email: 'recente@example.com' });
  await db.query("update contatos set estagio='em_uso', ultimo_evento_em = now() - interval '5 days' where email='recente@example.com'");
  const n = (await q('select crm_marcar_inativos() n'))[0].n;
  check('marca quem sumiu há 30+ dias', (await estagio('sumiu@example.com')) === 'inativo' && n >= 1);
  check('não mexe em quem está ativo', (await estagio('recente@example.com')) === 'em_uso');
  check('não conta a mudança como atividade', (await vis('sumiu@example.com')).dias >= 31);

  console.log('\n== Público: pergunta com newsletter ==');
  const pn = { email: 'news@example.com', nome: 'News', texto: 'Tenho uma dúvida sobre a APL', artigo: 'ajudas-de-moradia-apl-alf-als',
    aceita_servico: true, aceita_novidades: true, consentimento_versao: 'v1', texto_servico: 'Li e aceito.', texto_novidades: 'Quero a newsletter.' };
  check('pergunta com newsletter passa', (await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(pn)])))).ok);
  const [news] = await q("select id from contatos where email='news@example.com'");
  const nov = await q("select aceito from consentimentos where contato_id=$1 and finalidade='novidades_email'", [news.id]);
  check('registra aceite de novidades', nov.length === 1 && nov[0].aceito === true);
  await attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify({ ...pn, aceita_novidades: false })])));
  const nov2 = await q("select aceito from consentimentos where contato_id=$1 and finalidade='novidades_email' order by criado_em", [news.id]);
  check('caixinha desmarcada não retira o aceite nem duplica', nov2.length === 1);

  console.log('\n== Público: pedir_lembrete_prazo ==');
  const daqui = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const lb = { email: 'Bia@Example.com', nome: 'Bia', prazo: daqui(60), artigo: 'vls-ts-3-meses-para-validar',
    aceita_servico: true, consentimento_versao: 'v1', texto_servico: 'Li e aceito.' };
  check('anon pede lembrete', (await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify(lb)])))).ok);
  const [bia] = await q("select * from contatos where email='bia@example.com'");
  check('cria o contato com origem = artigo', bia?.origem === 'vls-ts-3-meses-para-validar');
  const [lem] = await q('select * from lembretes_prazo where contato_id=$1', [bia.id]);
  const fmtD = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
  check('grava o lembrete 15 dias antes do prazo', lem && fmtD(lem.prazo) === daqui(60) && fmtD(lem.avisar_em) === daqui(45) && lem.status === 'agendado');
  const evB = (await q('select tipo from eventos where contato_id=$1', [bia.id])).map((r) => r.tipo);
  check('eventos email_capturado + lembrete_pedido', evB.includes('email_capturado') && evB.includes('lembrete_pedido'));
  await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify(lb)])));
  check('mesmo prazo de novo não duplica', (await q('select count(*)::int n from lembretes_prazo where contato_id=$1', [bia.id]))[0].n === 1);
  await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify({ ...lb, prazo: daqui(5) })])));
  const [perto] = await q('select avisar_em from lembretes_prazo where contato_id=$1 and prazo=$2', [bia.id, daqui(5)]);
  check('prazo perto: avisa amanhã', perto && fmtD(perto.avisar_em) === daqui(1));
  for (const [label, p, re] of [
    ['exige aceite', { ...lb, aceita_servico: false }, /consentimento_obrigatorio/],
    ['rejeita e-mail inválido', { ...lb, email: 'x' }, /email_invalido/],
    ['rejeita prazo passado', { ...lb, prazo: daqui(-3) }, /prazo_invalido/],
    ['rejeita prazo sem data', { ...lb, prazo: 'amanhã' }, /prazo_invalido/],
    ['rejeita prazo a mais de 2 anos', { ...lb, prazo: daqui(800) }, /prazo_invalido/],
  ]) {
    const r = await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify(p)])));
    check(`pedir_lembrete_prazo ${label}`, !r.ok && re.test(r.error.message));
  }
  await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify({ ...lb, prazo: daqui(90) })])));
  const quarto = await attempt(() => asAnon(() => db.query('select pedir_lembrete_prazo($1)', [JSON.stringify({ ...lb, prazo: daqui(120) })])));
  check('limita a 3 lembretes agendados por pessoa', !quarto.ok && /muitos_lembretes/.test(quarto.error.message));
  check('anon não lê lembretes_prazo', !(await attempt(() => asAnon(() => db.query('select * from lembretes_prazo limit 1')))).ok);
  const rOutra = await attempt(() => asUser(outra.id, () => db.query('select * from lembretes_prazo')));
  check('não-admin vê 0 lembretes', rOutra.ok && rOutra.value.rows.length === 0);
  const rAdm = await asUser(admin.id, () => db.query("update lembretes_prazo set status='avisado', avisado_em=now() where contato_id=$1 and prazo=$2 returning id", [bia.id, daqui(60)]));
  check('admin marca como avisado', rAdm.rows.length === 1);
  await db.query('delete from contatos where id=$1', [bia.id]);
  check('apagar o contato leva os lembretes junto', (await q('select count(*)::int n from lembretes_prazo where contato_id=$1', [bia.id]))[0].n === 0);

  console.log('\n== Apagamento em cascata ==');
  await db.query('delete from contatos where id=$1', [ana.id]);
  const resto = await q('select (select count(*) from perguntas_unicas where contato_id=$1) p, (select count(*) from sinais where contato_id=$1) s', [ana.id]);
  check('apagar o contato leva perguntas e sinais junto', Number(resto[0].p) === 0 && Number(resto[0].s) === 0);

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
