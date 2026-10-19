// Testa crm-estudio-emails-3.sql (Estúdio de e-mails, entrega 3: modelo novo pelo objetivo e sequências) num Postgres
// efêmero (PGlite), em cima dos arquivos reais do CRM e das entregas 1 e 2. Não toca no Supabase real. Pessoas fictícias.
// Que o Worker manda o que esta lista devolve (e confere o consentimento de novo) é testado em
// cms-oauth-worker/testes/crm-email.test.mjs.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio3
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
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); }
  finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const asService = (fn) => asRole('service_role', null, fn);
const pendentes = (agora, limite) => asService(() => q('select * from public.crm_sequencia_pendentes($1, $2)', [limite || 12, agora]));
// As datas do teste ficam 10 dias no passado (horário de Brasília): "ligar o Envio agora" fica depois de todas elas.
const D0 = new Date(Date.now() - 3 * 36e5 - 10 * 864e5).toISOString().slice(0, 10);
function dia(n, hm) { const d = new Date(D0 + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + ' ' + hm + '-03'; }
const quem = (rows, chave) => rows.filter((r) => !chave || r.chave === chave).map((r) => r.nome).sort().join(',');

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  const [outra] = await q("insert into auth.users (email) values ('outra@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  // Pessoas fictícias. novidades: o consentimento de novidades (null = nenhum registro).
  async function pessoa(nome, { persona = null, novidades = null, estagio = 'lead' } = {}) {
    const [c] = await q('insert into contatos (email, nome, persona, estagio) values ($1, $2, $3, $4) returning id', [nome.toLowerCase() + '@example.com', nome, persona, estagio]);
    if (novidades != null) await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', $2, 'teste')", [c.id, novidades]);
    return c.id;
  }
  // O que já existe hoje, para conferir que nada muda: o reimpacto (boas-vindas entregue há 4 dias) e o e-mail 2 do guia.
  const zeca = await pessoa('Zeca');
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em) values ($1, 'boas_vindas', 'x', 'entregue', now() - interval '4 days')", [zeca]);
  const lia = await pessoa('Lia', { novidades: true });
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em) values ($1, 'cf_guia_1', 'x', 'entregue', now() - interval '1 day')", [lia]);

  const visaoAntes = await q('select * from crm_contatos order by email');
  const conversaAntes = await asService(() => q('select * from crm_conversa_pendentes(15)'));
  const modelosAntes = await q('select chave, nome, tipo, automatico, variaveis from modelos_email order by chave');
  const versoesAntes = await q('select chave, versao, etapa, assunto, corpo_texto, corpo_html from modelos_email_versoes order by chave, versao');

  const sql = readFileSync(path.resolve(HERE, '../crm-estudio-emails-3.sql'), 'utf8');
  await db.exec(sql);
  const idem = await attempt(() => db.exec(sql));
  check('migração é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  console.log('\n== Os 10 de hoje e os envios de hoje não mudam ==');
  const visaoDepois = await q('select * from crm_contatos order by email');
  check('crm_contatos: mesmas linhas e mesmos valores', JSON.stringify(visaoAntes) === JSON.stringify(visaoDepois));
  check('o Zeca continua no segmento "não abriu"', visaoDepois.find((c) => c.id === zeca).segmento === 'naoabriu');
  check('crm_conversa_pendentes devolve o mesmo (e-mail 2 igual)', JSON.stringify(conversaAntes) === JSON.stringify(await asService(() => q('select * from crm_conversa_pendentes(15)'))) && conversaAntes.length === 1);
  check('os 10 modelos e as versões de hoje iguais', JSON.stringify(modelosAntes) === JSON.stringify(await q('select chave, nome, tipo, automatico, variaveis from modelos_email order by chave'))
    && JSON.stringify(versoesAntes) === JSON.stringify(await q('select chave, versao, etapa, assunto, corpo_texto, corpo_html from modelos_email_versoes order by chave, versao')));
  check('nenhum dos 10 está marcado como criado no estúdio', (await q('select count(*)::int n from modelos_email where criado_no_estudio'))[0].n === 0);
  check('um dos 10 não ganha Envio', !(await attempt(() => db.query("update modelos_email set envio_gatilho = 'email', envio_depois_de = 'cf_guia_1', envio_dias = 1, envio_hora = 10 where chave = 'naoabriu'"))).ok);
  check('nem regras de Para quem', !(await attempt(() => db.query(`update modelos_email set para_quem = '{"personas":["pvt"]}' where chave = 'cf_guia_conversa'`))).ok);
  check('nem vira "criado no estúdio"', !(await attempt(() => db.query("update modelos_email set criado_no_estudio = true where chave = 'boas_vindas'"))).ok);
  check('mudar o objetivo (texto) dos 10 continua possível', (await attempt(() => asUser(admin.id, () => db.query("update modelos_email set objetivo = 'Outro objetivo' where chave = 'boas_vindas'")))).ok);
  check('um e-mail 2 a mais continua barrado pelo índice da fase 0', !(await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_1', 'agendado')", [lia]))).ok);

  console.log('\n== Modelo novo pelo objetivo (compra · Hub de Estudos) ==');
  const novo = (chave, extra) => ({ chave, nome: 'Modelo ' + chave, objetivo: 'teste', tipo: 'compra', como_sai: 'Sozinho', quem_recebe: 'Quem comprou', criado_no_estudio: true, ...extra });
  const inserir = (m) => db.query(`insert into modelos_email (${Object.keys(m).join(',')}) values (${Object.keys(m).map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(m));
  const hub = { produto: 'hub-de-estudos', produto_nome: 'Hub de Estudos' };
  const naoAdm = await attempt(() => asUser(outra.id, () => inserir(novo('hub_x', { objetivo_chave: 'compra' }))));
  check('quem não é admin não cria modelo', !naoAdm.ok);
  const cria = await attempt(() => asUser(admin.id, async () => {
    await inserir(novo('hub_compra_1', { objetivo_chave: 'compra', para_quem: hub, envio_gatilho: 'compra', envio_depois_de: 'hub-de-estudos', envio_dias: 0, envio_hora: 10, envio_ligado: true }));
    await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, blocos) values ('hub_compra_1', 1, 'rascunho', '{nome}, o seu acesso chegou', 'Oi {nome}!', '{}')");
  }));
  check('admin cria o modelo e a versão 1 (rascunho)', cria.ok);
  if (!cria.ok) console.log(cria.error.message);
  let [m1] = await q("select * from modelos_email where chave = 'hub_compra_1'");
  check('com Envio, sai sozinho e anota quando foi ligado', m1.automatico === true && !!m1.envio_ligado_em);
  check('objetivo fora do catálogo é recusado', !(await attempt(() => inserir(novo('obj_x', { objetivo_chave: 'vender' })))).ok);
  check('Envio ligado sem horário é recusado', !(await attempt(() => inserir(novo('obj_y', { envio_gatilho: 'compra', envio_depois_de: 'hub-de-estudos', envio_dias: 0, para_quem: hub, envio_ligado: true })))).ok);
  check('compra com produto diferente do Para quem é recusada', !(await attempt(() => inserir(novo('obj_z', { para_quem: hub, envio_gatilho: 'compra', envio_depois_de: 'outro-produto', envio_dias: 0, envio_hora: 10 })))).ok);
  check('depois de um e-mail que não existe é recusado', !(await attempt(() => inserir(novo('obj_w', { envio_gatilho: 'email', envio_depois_de: 'nao_existe', envio_dias: 1, envio_hora: 10 })))).ok);
  check('depois dele mesmo é recusado', !(await attempt(() => inserir(novo('obj_v', { envio_gatilho: 'email', envio_depois_de: 'obj_v', envio_dias: 1, envio_hora: 10 })))).ok);
  check('hora 24 é recusada', !(await attempt(() => inserir(novo('obj_u', { envio_gatilho: 'email', envio_depois_de: 'boas_vindas', envio_dias: 1, envio_hora: 24 })))).ok);
  check('sequência ainda sem "depois de quê" (desligada) pode ser criada', (await attempt(() => inserir(novo('obj_t', { envio_gatilho: 'email', envio_dias: 1, envio_hora: 10 })))).ok);
  check('mas não liga', !(await attempt(() => db.query("update modelos_email set envio_ligado = true where chave = 'obj_t'"))).ok);
  await db.query("delete from modelos_email where chave = 'obj_t'");
  const semEnvio = await attempt(() => inserir(novo('convite_novo', { objetivo_chave: 'convite', tipo: 'novidades' })));
  check('sem Envio, você envia pela ficha (automatico = false)', semEnvio.ok && (await q("select automatico from modelos_email where chave = 'convite_novo'"))[0].automatico === false);

  console.log('\n== Registrar compra ==');
  const ana = await pessoa('Ana'), bia = await pessoa('Bia'), caio = await pessoa('Caio'), duda = await pessoa('Duda');
  const comprou = async (c, prod, quando) => {
    const r = await asUser(admin.id, () => q('select public.crm_registrar_compra($1, $2) as r', [c, prod]));
    if (quando) await db.query("update eventos set criado_em = $2 where contato_id = $1 and tipo = 'compra' and dados->>'produto' = $3", [c, quando, prod]);
    return r[0].r;
  };
  const r1 = await comprou(ana, 'hub-de-estudos', `${dia(0, '09:00')}`);
  check('admin registra a compra (evento na linha do tempo)', r1.ok && (await q("select count(*)::int n from eventos where contato_id = $1 and tipo = 'compra'", [ana]))[0].n === 1);
  check('a mesma compra não entra duas vezes', (await comprou(ana, 'hub-de-estudos')).ja === true && (await q("select count(*)::int n from eventos where contato_id = $1 and tipo = 'compra'", [ana]))[0].n === 1);
  await comprou(bia, 'hub-de-estudos', `${dia(0, '15:00')}`);
  await comprou(caio, 'planilha-financeira-super-integrada', `${dia(0, '09:00')}`);
  await comprou(duda, 'hub-de-estudos', `${dia(-12, '09:00')}`);
  check('quem não é admin não registra compra', !(await attempt(() => asUser(outra.id, () => q('select public.crm_registrar_compra($1, $2)', [caio, 'hub-de-estudos'])))).ok);
  check('anon não registra compra', !(await attempt(() => asAnon(() => q('select public.crm_registrar_compra($1, $2)', [caio, 'hub-de-estudos'])))).ok);
  check('produto com formato estranho é recusado', !(await attempt(() => asUser(admin.id, () => q('select public.crm_registrar_compra($1, $2)', [caio, 'Hub; drop'])))).ok);

  console.log('\n== A sequência de compra: quem recebe e quando ==');
  // O Envio foi "ligado" em 01/11 às 8h (Brasília); só vale o que vence depois disso.
  await db.query("update modelos_email set envio_ligado_em = $1 where chave = 'hub_compra_1'", [dia(0, '08:00')]);
  check('rascunho não sai (sem versão No ar)', (await pendentes(`${dia(0, '10:05')}`)).length === 0);
  await db.query("update modelos_email_versoes set etapa = 'no_ar', publicado_em = now() where chave = 'hub_compra_1' and versao = 1");
  check('antes das 10h, ninguém', (await pendentes(`${dia(0, '09:30')}`)).length === 0);
  let p = await pendentes(`${dia(0, '10:05')}`);
  check('às 10h do dia da compra: só a Ana (comprou às 9h)', quem(p) === 'Ana' && p[0].versao === 1 && p[0].tipo === 'compra');
  check('a lista traz o produto e não traz dado a mais', p[0].dados.produto === 'hub-de-estudos' && p[0].dados.produto_nome === 'Hub de Estudos' && !('email' in p[0].dados));
  p = await pendentes(`${dia(1, '10:05')}`);
  check('no dia seguinte às 10h: Ana e Bia (a Bia comprou às 15h, depois do horário)', quem(p) === 'Ana,Bia');
  check('quem comprou outro produto (Caio) e quem comprou antes de ligar (Duda) não recebem', !p.some((r) => r.nome === 'Caio' || r.nome === 'Duda'));
  check('o limite por rodada vale', (await pendentes(`${dia(1, '10:05')}`, 1)).length === 1);
  check('authenticated não chama a lista', !(await attempt(() => asUser(admin.id, () => q('select * from crm_sequencia_pendentes(12)')))).ok);
  // O Worker reserva a linha (sequencia = true) e manda.
  const reservar = (c, chave, quando) => db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, $2, 'x', 'agendado', $3, true)", [c, chave, quando]);
  await reservar(ana, 'hub_compra_1', `${dia(0, '10:05')}`);
  check('quem já recebeu sai da lista', quem(await pendentes(`${dia(1, '10:05')}`)) === 'Bia');
  check('um segundo e-mail do mesmo modelo para a mesma pessoa é barrado', !(await attempt(() => reservar(ana, 'hub_compra_1', `${dia(1, '10:05')}`))).ok);
  check('passou a janela de 2 dias: a Bia não recebe mais', (await pendentes(`${dia(3, '10:06')}`)).every((r) => r.nome !== 'Bia'));
  check('o e-mail de compra não conta como "último e-mail" do reimpacto', (await q('select email_status, segmento from crm_contatos where id = $1', [ana]))[0].email_status === null);

  console.log('\n== O 2º e-mail da sequência: 3 dias depois do 1º ==');
  await asUser(admin.id, async () => {
    await inserir(novo('hub_compra_2', { objetivo_chave: 'compra', para_quem: hub, envio_gatilho: 'email', envio_depois_de: 'hub_compra_1', envio_dias: 3, envio_hora: 10, envio_ligado: true }));
    await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto) values ('hub_compra_2', 1, 'no_ar', 'Seus primeiros passos', 'Oi {nome}!')");
  });
  await db.query("update modelos_email set envio_ligado_em = $1 where chave = 'hub_compra_2'", [dia(0, '08:00')]);
  check('2 dias depois do 1º, ainda não', (await pendentes(`${dia(2, '10:05')}`)).filter((r) => r.chave === 'hub_compra_2').length === 0);
  p = await pendentes(`${dia(3, '10:05')}`);
  check('3 dias depois do 1º, às 10h: só a Ana (a Bia não recebeu o 1º)', quem(p, 'hub_compra_2') === 'Ana');
  await db.query("update modelos_email set envio_ligado = false where chave = 'hub_compra_2'");
  check('desligar o Envio para na hora', (await pendentes(`${dia(3, '10:05')}`)).filter((r) => r.chave === 'hub_compra_2').length === 0);
  check('e apaga a hora em que foi ligado', (await q("select envio_ligado_em from modelos_email where chave = 'hub_compra_2'"))[0].envio_ligado_em === null);
  await db.query("update modelos_email set envio_ligado = true where chave = 'hub_compra_2'");
  check('religar agora não manda o que venceu antes', (await pendentes(`${dia(3, '10:05')}`)).filter((r) => r.chave === 'hub_compra_2').length === 0);

  console.log('\n== Novidades: consentimento e Para quem ==');
  const eva = await pessoa('Eva', { persona: 'campus_france', novidades: true });
  const fred = await pessoa('Fred', { persona: 'campus_france', novidades: false });
  const gabi = await pessoa('Gabi', { persona: 'pvt', novidades: true });
  const hugo = await pessoa('Hugo', { persona: 'campus_france', novidades: true, estagio: 'ativado' });
  const ivo = await pessoa('Ivo', { persona: 'campus_france' });   // nunca respondeu sobre novidades
  for (const c of [eva, fred, gabi, hugo, ivo])
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c, { origem: 'guia-etudes-en-france-2027' }, dia(0, '09:00')]);
  await asUser(admin.id, async () => {
    await inserir(novo('aquec_1', { objetivo_chave: 'aquecimento', tipo: 'novidades', envio_gatilho: 'material', envio_depois_de: 'guia-etudes-en-france-2027', envio_dias: 1, envio_hora: 10,
      para_quem: { personas: ['campus_france'], materiais: ['guia-etudes-en-france-2027'], estagios: ['lead'] }, envio_ligado: true }));
    await db.query("insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto) values ('aquec_1', 1, 'no_ar', 'Uma astúcia', 'Oi {nome}!')");
  });
  await db.query("update modelos_email set envio_ligado_em = $1 where chave = 'aquec_1'", [dia(0, '08:00')]);
  p = await pendentes(`${dia(1, '10:05')}`);
  check('aquecimento D+1: só a Eva (aceitou, persona e etapa certas)', quem(p, 'aquec_1') === 'Eva');
  check('quem não aceitou novidades (Fred, Ivo), outra persona (Gabi) e outro estágio (Hugo) não recebem',
    !p.some((r) => ['Fred', 'Ivo', 'Gabi', 'Hugo'].includes(r.nome)));
  await db.query("insert into consentimentos (contato_id, finalidade, aceito, origem) values ($1, 'novidades_email', false, 'brevo')", [eva]);
  check('a Eva pediu para sair: o consentimento mais recente vale na rodada seguinte', (await pendentes(`${dia(1, '10:05')}`)).filter((r) => r.chave === 'aquec_1').length === 0);
  await db.query("update modelos_email set para_quem = '{}' where chave = 'aquec_1'");
  check('mudar as regras com o Envio ligado recomeça a contagem (não manda o que já venceu)', (await pendentes(`${dia(1, '10:05')}`)).filter((r) => r.chave === 'aquec_1').length === 0);

  console.log('\n== O X do estúdio: excluir e restaurar ==');
  await db.query("update modelos_email set envio_ligado_em = $1 where chave = 'hub_compra_1'", [dia(0, '08:00')]);
  await db.query("delete from emails_enviados where contato_id = $1 and modelo = 'hub_compra_1'", [ana]);
  check('antes de excluir, a sequência de compra sai', quem(await pendentes(dia(1, '10:05')), 'hub_compra_1') === 'Ana,Bia');
  await asUser(admin.id, () => db.query("update modelos_email set excluido_em = now() where chave = 'hub_compra_1'"));
  let [mx] = await q("select excluido_em, envio_ligado from modelos_email where chave = 'hub_compra_1'");
  check('excluir desliga o Envio', !!mx.excluido_em && mx.envio_ligado === false);
  check('excluído não sai mais', (await pendentes(dia(1, '10:05'))).filter((r) => r.chave === 'hub_compra_1').length === 0);
  check('as versões ficam guardadas', (await q("select count(*)::int n from modelos_email_versoes where chave = 'hub_compra_1'"))[0].n === 1);
  check('ligar o Envio de um excluído não liga', (await attempt(() => db.query("update modelos_email set envio_ligado = true where chave = 'hub_compra_1'"))).ok &&
    (await q("select envio_ligado from modelos_email where chave = 'hub_compra_1'"))[0].envio_ligado === false);
  await asUser(admin.id, () => db.query("update modelos_email set excluido_em = null where chave = 'hub_compra_1'"));
  check('restaurar volta o modelo (com o Envio desligado)', (await q("select excluido_em, envio_ligado from modelos_email where chave = 'hub_compra_1'"))[0].excluido_em === null);
  await db.query("update modelos_email set envio_ligado = true where chave = 'hub_compra_1'");
  check('um dos 8 manuais pode ser excluído', (await attempt(() => db.query("update modelos_email set excluido_em = now() where chave = 'parouapp'"))).ok);
  await db.query("update modelos_email set excluido_em = null where chave = 'parouapp'");
  check('os e-mails 1 e 2 do guia não podem ser excluídos', !(await attempt(() => db.query("update modelos_email set excluido_em = now() where chave = 'cf_guia_1'"))).ok
    && !(await attempt(() => db.query("update modelos_email set excluido_em = now() where chave = 'cf_guia_conversa'"))).ok);
  check('quem não é admin não exclui', (await asUser(outra.id, () => q("update modelos_email set excluido_em = now() where chave = 'hub_compra_2' returning chave"))).length === 0);

  console.log('\n== Rodar de novo não desfaz o que você criou ==');
  await db.exec(sql);
  const novos = await q('select chave, envio_ligado from modelos_email where criado_no_estudio order by chave');
  check('os modelos novos e o Envio ficam', novos.map((x) => x.chave).join(',') === 'aquec_1,convite_novo,hub_compra_1,hub_compra_2' && novos.find((x) => x.chave === 'hub_compra_1').envio_ligado);
  check('anon não lê os modelos', !(await attempt(() => asAnon(() => db.query('select para_quem from modelos_email')))).ok);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
