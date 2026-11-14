// Testa crm-sequencia-previsao.sql (o Y, "envios previstos hoje", e a consulta do Worker num helper só) num Postgres efêmero
// (PGlite), em cima dos arquivos reais do CRM. Não toca no Supabase real. Pessoas fictícias.
//
// Uso:
//   cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR DENTRO APP>/db npm run test:previsao
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
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asService = (fn) => asRole('service_role', null, fn);
const pendentes = (agora) => asService(() => q('select * from public.crm_sequencia_pendentes(100, $1)', [agora]));
const quem = (rows, chave) => rows.filter((r) => r.chave === chave).map((r) => r.nome).sort().join(',');
const previstos = (userId, chave, agora) => asRole('authenticated', userId, async () => (await q('select public.crm_sequencia_previstos($1, $2) as y', [chave, agora]))[0].y);
// 10 de novembro de 2026, hora de Brasília (UTC-3, sem horário de verão).
const dia = (hhmm, mais = 0) => new Date(new Date('2026-11-10T' + hhmm + ':00-03:00').getTime() + mais * 864e5).toISOString();

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
    -- Como no Supabase: toda função nova em public nasce executável por anon, authenticated e service_role.
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-prazo-vlsts.sql', 'crm-origem-campanha.sql', 'guias-link-privado.sql', 'crm-enriquecimento.sql',
    'crm-fase0-email-guia.sql', 'crm-fase1a-conversa.sql', 'crm-fase1b-resposta.sql', 'crm-modelos-email.sql', 'crm-estudio-emails-2.sql',
    'crm-emails-formato.sql', 'crm-estudio-emails-3.sql', 'crm-modelos-prontos.sql', 'crm-modelos-revisao.sql', 'crm-modelos-reimpacto.sql',
    'crm-filtro-etapa.sql', 'crm-sequencia-minutos.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  const [outra] = await q("insert into auth.users (email) values ('outra@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);

  // Modelos de teste: serviço, 30 minutos depois de pegar um material.
  async function modelo(chave, { material = 'guia-tecnologo', etapas = null, ligado = true, versao = true, gatilho = true } = {}) {
    const para = JSON.stringify(Object.assign({ materiais: [material] }, etapas ? { etapas } : {}));
    await db.query(`insert into modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, criado_no_estudio, objetivo_chave, para_quem,
        envio_gatilho, envio_depois_de, envio_minutos) values ($1, $1, 'teste', 'servico', 'x', 'x', true, 'freebie', $2::jsonb, $3, $4, $5)`,
      [chave, para, gatilho ? 'material' : null, gatilho ? material : null, gatilho ? 30 : null]);
    if (versao) await db.query(`insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, corpo_html, blocos, publicado_em)
      values ($1, 1, 'no_ar', 'x', 'x', 'x', '{"v":1,"itens":[]}', now())`, [chave]);
    if (ligado) {
      await db.query('update modelos_email set envio_ligado = true where chave = $1', [chave]);
      await db.query('update modelos_email set envio_ligado_em = $2 where chave = $1', [chave, dia('08:00')]);
    }
  }
  async function pessoa(nome, quando, { origem = 'guia-tecnologo', objetivo = null } = {}) {
    const resp = JSON.stringify(objetivo ? { objetivo } : {});
    const [c] = await q("insert into contatos (email, nome, persona, respostas) values ($1, $2, 'campus_france', $3::jsonb) returning id",
      [nome.toLowerCase() + '@example.com', nome, resp]);
    await db.query("insert into eventos (contato_id, tipo, dados, criado_em) values ($1, 'email_capturado', $2, $3)", [c.id, { origem }, quando]);
    return c.id;
  }

  await modelo('t_prev');
  await pessoa('Ana', dia('09:00'));                            // devida às 09:30
  await pessoa('Bia', dia('10:20'));                            // devida às 10:50
  await pessoa('Caio', dia('07:00'));                           // devida às 07:30, ANTES de o Envio ser ligado (08:00)
  await pessoa('Duda', dia('10:25'), { origem: 'guia-email-alt30' });   // pegou outro guia
  await pessoa('Eva', dia('22:00'));                            // devida às 22:30
  await pessoa('Fabi', dia('23:50'));                           // devida às 00:20 de amanhã
  const gui = await pessoa('Gui', dia('09:10'));                // devida às 09:40, mas já recebeu
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) values ($1, 't_prev', 'x', 'entregue', $2, true)", [gui, dia('09:45')]);

  console.log('\n== O que o Worker recebe hoje (antes do SQL novo) ==');
  const antes = [dia('10:00'), dia('11:00'), dia('23:00'), dia('10:30', 2)];
  const snapAntes = [];
  for (const a of antes) snapAntes.push(JSON.stringify(await pendentes(a)));
  check('10:00: só a Ana', quem(JSON.parse(snapAntes[0]), 't_prev') === 'Ana');
  check('11:00: Ana e Bia', quem(JSON.parse(snapAntes[1]), 't_prev') === 'Ana,Bia');
  check('23:00: Ana, Bia e Eva (a Gui já recebeu, o Caio é anterior ao Envio, a Duda é de outro guia)', quem(JSON.parse(snapAntes[2]), 't_prev') === 'Ana,Bia,Eva');
  check('dois dias depois, 10:30: a Ana perdeu a vez (passou de 2 dias); Bia, Eva e Fabi (devida às 00:20 do dia 11) ainda valem', quem(JSON.parse(snapAntes[3]), 't_prev') === 'Bia,Eva,Fabi');

  console.log('\n== crm-sequencia-previsao.sql ==');
  const sql = readFileSync(path.resolve(HERE, '../crm-sequencia-previsao.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql));
  check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('roda a 2ª vez sem erro', r2.ok); if (!r2.ok) console.log(r2.error.message);
  for (let i = 0; i < antes.length; i++)
    check('o Worker recebe exatamente o mesmo de antes (' + antes[i] + ')', JSON.stringify(await pendentes(antes[i])) === snapAntes[i]);
  const fns = await q(`select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon,
      has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('crm_sequencia_candidatos', 'crm_sequencia_pendentes', 'crm_sequencia_previstos') order by 1`);
  const f = (n) => fns.filter((x) => x.proname === n)[0] || {};
  check('as 3 funções são security definer, com search_path fixo', fns.length === 3 && fns.every((x) => x.prosecdef && /search_path/.test(String(x.proconfig))));
  check('o helper não é executável por ninguém', f('crm_sequencia_candidatos').anon === false && f('crm_sequencia_candidatos').auth === false && f('crm_sequencia_candidatos').svc === false);
  check('pendentes: só o Worker (service_role)', f('crm_sequencia_pendentes').anon === false && f('crm_sequencia_pendentes').auth === false && f('crm_sequencia_pendentes').svc === true);
  check('previstos: authenticated sim, anon não', f('crm_sequencia_previstos').auth === true && f('crm_sequencia_previstos').anon === false);

  console.log('\n== O Y (previstos hoje) ==');
  check('Envio ligado, 10:00: Ana (já devida), Bia (10:50) e Eva (22:30) = 3', (await previstos(admin.id, 't_prev', dia('10:00'))) === 3);
  await db.query("insert into emails_enviados (contato_id, modelo, assunto, status, enviado_em, sequencia) select id, 't_prev', 'x', 'entregue', $1, true from contatos where nome = 'Ana'", [dia('09:50')]);
  check('depois de a Ana receber: 2', (await previstos(admin.id, 't_prev', dia('10:00'))) === 2);
  check('22:40: Bia e Eva já passaram da hora e ainda não receberam: seguem na conta = 2 (a Fabi é de amanhã)', (await previstos(admin.id, 't_prev', dia('22:40'))) === 2);

  await modelo('t_rasc', { ligado: false, versao: false });
  check('Envio desligado, 10:00: só quem ainda vai ficar devida depois de agora (Bia e Eva) = 2', (await previstos(admin.id, 't_rasc', dia('10:00'))) === 2);
  check('rascunho sem versão no ar nunca vai para o Worker', quem(await pendentes(dia('23:00')), 't_rasc') === '');
  await modelo('t_manual', { ligado: false, versao: false, gatilho: false });
  check('modelo manual (sem gatilho): null', (await previstos(admin.id, 't_manual', dia('10:00'))) === null);
  check('um dos 10 de antes (boas_vindas): null', (await previstos(admin.id, 'boas_vindas', dia('10:00'))) === null);
  check('chave que não existe: null', (await previstos(admin.id, 'nao_existe', dia('10:00'))) === null);

  console.log('\n== A regra da etapa (o banco exclui quem não marcou etapa) ==');
  await modelo('t_etapa', { material: 'guia-teste-etapa', etapas: ['tec-escrevi'] });
  await pessoa('Iris', dia('10:30'), { origem: 'guia-teste-etapa', objetivo: 'tec-escrevi' });
  await pessoa('Joel', dia('10:40'), { origem: 'guia-teste-etapa' });
  await pessoa('Kaua', dia('10:45'), { origem: 'guia-teste-etapa', objetivo: 'tec-nao-sei' });
  check('Y: só a Iris (Joel não marcou etapa, Kauã marcou outra)', (await previstos(admin.id, 't_etapa', dia('10:00'))) === 1);
  check('o Worker também: só a Iris', quem(await pendentes(dia('12:00')), 't_etapa') === 'Iris');

  console.log('\n== Quem pode perguntar ==');
  const naoAdmin = await attempt(() => previstos(outra.id, 't_prev', dia('10:00')));
  check('authenticated que não é admin: recusado (sem_permissao)', !naoAdmin.ok && /sem_permissao/.test(naoAdmin.error.message));
  const anon = await attempt(() => asRole('anon', null, () => q("select public.crm_sequencia_previstos('t_prev', now())")));
  check('anon: sem permissão', !anon.ok);
  const direto = await attempt(() => asRole('authenticated', admin.id, () => q("select * from public.crm_sequencia_candidatos('t_prev', now(), now(), true)")));
  check('nem a admin chama o helper direto', !direto.ok);

  console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
