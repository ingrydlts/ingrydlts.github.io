// Testa crm-caso.sql (o caso da pessoa: compreensão, board e notificações do assistente) num Postgres efêmero (PGlite).
// Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:caso
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
// A chamada tem que falhar E dizer o motivo certo (senão o teste pode estar passando por outro erro).
async function falha(fn, motivo) { const r = await attempt(fn); return !r.ok && (!motivo || String(r.error && r.error.message).includes(motivo)); }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const um = async (sql, params) => (await q(sql, params))[0];
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    -- Como no Supabase: toda função nova de public nasce executável por anon e authenticated.
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  // Os mesmos arquivos do app que o sentinela de isolamento carrega, na mesma ordem: assim conta com e-mail não confirmado não ganha ficha.
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-caso.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);
  // O patch das perguntas por persona (a chave deixa de ser uma lista fixa): roda por cima, duas vezes.
  const sqlCrit = readFileSync(path.resolve(HERE, '../crm-caso-criterios.sql'), 'utf8');
  check('crm-caso-criterios.sql roda duas vezes sem erro', (await attempt(() => db.exec(sqlCrit))).ok && (await attempt(() => db.exec(sqlCrit))).ok);

  const TABELAS = ['caso_achados', 'caso_acoes', 'board_itens', 'caso_avisos'];
  const DA_PESSOA = ['meu_caso', 'caso_primeiro_acesso', 'meus_avisos', 'marcar_aviso_lido', 'responder_aviso', 'adiar_aviso', 'dispensar_aviso', 'salvar_dados_dela', 'marcar_acao'];
  const DO_ADMIN = ['crm_board_publicar', 'crm_board_retirar', 'crm_aviso_agendar'];
  // Lê dados que a pessoa não alcança, mas só é chamada de dentro das funções definer; por isso roda com os direitos de quem chama.
  const INVOKER = ['caso_liberar_relativo'];
  const INTERNAS = ['caso_tem_consentimento', 'caso_liberar_relativo', 'caso_board_guarda', 'caso_aviso_guarda', 'crm_on_caso_achado', 'crm_on_caso_acao',
    'crm_on_board_item', 'crm_on_caso_aviso', 'crm_avisos_materializar'];

  console.log('\n== Regras de catálogo (as mesmas do sentinela de isolamento, para o que este arquivo cria) ==');
  for (const t of TABELAS) {
    const [c] = await q(`select c.relrowsecurity rls, has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
        or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete') anon_acesso
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1`, [t]);
    check(`${t}: RLS ligada`, c.rls);
    check(`${t}: anon sem nenhum acesso direto`, !c.anon_acesso);
    check(`${t}: anon não lê`, await falha(() => asAnon(() => db.query(`select 1 from public.${t} limit 1`))));
    const pol = await q(`select policyname, coalesce(qual,'') q, coalesce(with_check,'') w from pg_policies where schemaname='public' and tablename=$1`, [t]);
    check(`${t}: só política de admin (a pessoa não tem política: entra pelas funções)`, pol.length === 1 && /eh_admin\(\)/.test(pol[0].q) && /eh_admin\(\)/.test(pol[0].w));
  }
  const fns = await q(`select p.proname f, coalesce(array_to_string(p.proconfig, ','), '') cfg, p.prosecdef def,
      has_function_privilege('anon', p.oid, 'execute') anon_exec, has_function_privilege('authenticated', p.oid, 'execute') auth_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname = any($1))`, [[...DA_PESSOA, ...DO_ADMIN, ...INTERNAS]]);
  check('achou todas as funções novas', fns.length === DA_PESSOA.length + DO_ADMIN.length + INTERNAS.length);
  for (const f of fns) {
    check(`${f.f}: search_path fixo` + (INVOKER.includes(f.f) ? '' : ' e security definer'), /search_path=/.test(f.cfg) && (INVOKER.includes(f.f) || f.def));
    check(`${f.f}: anon não executa`, !f.anon_exec);
    if (INTERNAS.includes(f.f)) check(`${f.f}: nem a pessoa logada executa (só o banco e o servidor)`, !f.auth_exec);
    else check(`${f.f}: pessoa logada executa`, f.auth_exec);
  }

  // ---------------------------------------------------------------- personagens
  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  const [cris] = await q("insert into auth.users (email) values ('cris@example.com') returning id"); // conta sem ficha ligada
  for (const [u, e] of [[ana, 'ana@example.com'], [bia, 'bia@example.com']])
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [e, u.id]);
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id;
  const cBia = (await um("select id from contatos where email='bia@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cAna]); // a Bia NÃO consentiu
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));
  const item = async (cid, tipo, titulo, extra = {}) =>
    (await um(`insert into board_itens (contato_id, tipo, titulo, dados, dados_dela) values ($1,$2,$3,$4,$5) returning id`,
      [cid, tipo, titulo, JSON.stringify(extra.dados || {}), JSON.stringify(extra.dados_dela || {})])).id;
  const meu = async (quem) => (await asUser(quem, () => um('select meu_caso() r'))).r;

  console.log('\n== O que o banco recusa (como admin) ==');
  const ach = (v) => adm(`insert into caso_achados (contato_id, tipo, texto, certeza, fonte_url, chave) values ($1,$2,$3,$4,$5,$6)`, [cAna, ...v]);
  check('achado válido entra', (await attempt(() => ach(['fato', 'O curso precisa de 20 h por semana.', 'literal', 'https://exemplo.fr/regra', 'carga_minima']))).ok);
  check('achado: tipo inventado, texto gigante, fonte http e chave maiúscula são recusados',
    !(await attempt(() => ach(['palpite', 'x', 'literal', null, null]))).ok && !(await attempt(() => ach(['fato', 'a'.repeat(401), 'literal', null, null]))).ok &&
    !(await attempt(() => ach(['fato', 'x', 'literal', 'http://exemplo.fr', null]))).ok && !(await attempt(() => ach(['fato', 'x', 'literal', null, 'Chave Ruim']))).ok);
  check('achado: a mesma chave não repete para a mesma pessoa', !(await attempt(() => ach(['fato', 'outro', 'literal', null, 'carga_minima']))).ok);
  const aco = (dono, canal, passo, botao = null) => adm(`insert into caso_acoes (contato_id, titulo, dono, canal, passo_chave, botao) values ($1,'Ligar para a escola',$2,$3,$4,$5)`, [cAna, dono, canal, passo, botao]);
  check('ação da pessoa pela plataforma exige a chave do passo', !(await attempt(() => aco('ela', 'plataforma', null))).ok && (await attempt(() => aco('ela', 'plataforma', 'ligar_escola', 'pesquisar'))).ok);
  check('ação: "fora do CRM", dono estranho e botão inventado não existem', !(await attempt(() => aco('ela', 'fora_crm', 'x'))).ok && !(await attempt(() => aco('amiga', 'email', null))).ok && !(await attempt(() => aco('ingryd', 'email', null, 'enviar_sozinho'))).ok);
  check('item: chave fora da lista do tipo, dados gigantes e tipo inventado são recusados',
    !(await attempt(() => item(cAna, 'escola', 'X', { dados: { senha: 'x' } }))).ok && !(await attempt(() => item(cAna, 'modelo', 'X', { dados: { custo_eur: 1 } }))).ok &&
    !(await attempt(() => item(cAna, 'escola', 'X', { dados: { curso: 'a'.repeat(9000) } }))).ok && !(await attempt(() => item(cAna, 'planilha', 'X'))).ok);
  check('item: o que é da equipe não vale em dados_dela, e o que é dela não vale em dados',
    !(await attempt(() => item(cAna, 'escola', 'X', { dados_dela: { curso: 'x' } }))).ok && !(await attempt(() => item(cAna, 'escola', 'X', { dados: { criterios: {} } }))).ok);
  check('item: não nasce publicado', await falha(() => db.query(`insert into board_itens (contato_id, tipo, titulo, estado) values ($1,'marco','X','publicado')`, [cAna]), 'publique_depois_de_criar'));
  const av = (o) => db.query(`insert into caso_avisos (contato_id, tipo, titulo, texto, resposta_tipo, opcoes, grava_em, destino, modo, dias_apos, liberar_em, expira_em)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [o.c || cAna, o.tipo, o.titulo || 'Aviso', o.texto || null, o.rt || null, o.op || null, o.g || null, o.d ? JSON.stringify(o.d) : null, o.modo || 'apos_primeiro_acesso', o.dias ?? 1, o.lib || null, o.exp || null]);
  check('pergunta sem lugar para gravar ou sem tipo de resposta é recusada',
    !(await attempt(() => av({ tipo: 'pergunta' }))).ok && !(await attempt(() => av({ tipo: 'pergunta', rt: 'data' }))).ok);
  check('pergunta só grava em chave da lista fechada', !(await attempt(() => av({ tipo: 'pergunta', rt: 'data', g: 'respostas.qualquer_coisa' }))).ok && !(await attempt(() => av({ tipo: 'pergunta', rt: 'data', g: 'nome' }))).ok);
  check('o que não é pergunta não tem onde gravar', !(await attempt(() => av({ tipo: 'proposta', rt: 'data', g: 'respostas.fim_pvt' }))).ok);
  check('opções: obrigatórias na pergunta de opções, no máximo 6, cada uma até 40', !(await attempt(() => av({ tipo: 'pergunta', rt: 'opcoes', g: 'respostas.sponsor' }))).ok &&
    !(await attempt(() => av({ tipo: 'pergunta', rt: 'opcoes', g: 'respostas.sponsor', op: ['1', '2', '3', '4', '5', '6', '7'] }))).ok &&
    !(await attempt(() => av({ tipo: 'pergunta', rt: 'opcoes', g: 'respostas.sponsor', op: ['x'.repeat(41)] }))).ok);
  check('destino só com tela e serviço das listas', !(await attempt(() => av({ tipo: 'proposta', d: { tela: 'admin' } }))).ok && !(await attempt(() => av({ tipo: 'oferta', d: { servico: 'brinde' } }))).ok &&
    !(await attempt(() => av({ tipo: 'proposta', d: { url: 'https://x.com' } }))).ok && (await attempt(() => av({ tipo: 'proposta', d: { tela: 'espaco', aba: 'escolas' } }))).ok);
  check('aviso nasce como rascunho, nunca agendado', await falha(() => db.query(`insert into caso_avisos (contato_id, tipo, titulo, estado) values ($1,'proposta','X','agendado')`, [cAna]), 'comece_como_rascunho'));
  const [avFixo] = (await av({ tipo: 'proposta', titulo: 'Data fixa sem data', modo: 'data' })).rows;
  check('modo data sem data não pode ser aprovado', !(await attempt(() => db.query(`update caso_avisos set estado='agendado' where id=$1`, [avFixo.id]))).ok);
  await db.query('delete from caso_avisos'); await db.query('delete from caso_acoes'); await db.query('delete from board_itens'); await db.query('delete from caso_achados');

  console.log('\n== A pessoa não alcança as tabelas direto ==');
  const iAna = await item(cAna, 'marco', 'Marcos');
  for (const t of TABELAS) {
    check(`${t}: Ana não lê`, (await asUser(ana.id, () => db.query(`select * from ${t}`))).rows.length === 0);
    check(`${t}: Ana não cria`, !(await attempt(() => asUser(ana.id, () => db.query(`insert into ${t} (contato_id) values ($1)`, [cAna])))).ok);
  }
  check('board_itens: Ana não muda nada direto', (await asUser(ana.id, () => db.query(`update board_itens set titulo='x'`))).rowCount === 0);
  check('board_itens: Ana não apaga', (await asUser(ana.id, () => db.query(`delete from board_itens`))).rowCount === 0);
  check('o admin lê e muda', (await adm('select * from board_itens')).rows.length === 1);
  await db.query('delete from board_itens');

  console.log('\n== Board: revisar, consentir e publicar ==');
  const eAna = await item(cAna, 'escola', 'Alliance Française de Marseille', { dados: { cidade: 'Marseille', custo_eur: 3600 } });
  const mAna = await item(cAna, 'modelo', 'E-mail para se aproximar das escolas', { dados: { idioma: 'fr', corpo: 'Bonjour' } });
  const eBia = await item(cBia, 'escola', 'DU de outra escola');
  check('nada aparece para ela enquanto está proposto', (await meu(ana.id)).board.length === 0);
  check('pular a revisão não vale (proposto → publicado)', await falha(() => adm('select crm_board_publicar($1)', [eAna]), 'revise_antes_de_publicar'));
  await db.query("update board_itens set estado='revisado' where id = any($1)", [[eAna, mAna, eBia]]);
  const rev = await um('select revisado_em, revisado_por from board_itens where id=$1', [eAna]);
  check('revisar marca quando', rev.revisado_em !== null);
  check('sem consentimento da pessoa não publica (Bia)', await falha(() => adm('select crm_board_publicar($1)', [eBia]), 'sem_consentimento'));
  check('mesmo o servidor, escrevendo direto, não publica sem consentimento', await falha(() => db.query("update board_itens set estado='publicado' where id=$1", [eBia]), 'sem_consentimento'));
  check('pessoa logada não publica', await falha(() => asUser(ana.id, () => db.query('select crm_board_publicar($1)', [eAna])), 'sem_permissao'));
  check('anon não publica', !(await attempt(() => asAnon(() => db.query('select crm_board_publicar($1)', [eAna])))).ok);
  await adm('select crm_board_publicar($1)', [eAna]);
  const pub = await um('select estado, publicado_em, publicado_por from board_itens where id=$1', [eAna]);
  check('publicar marca quando e quem', pub.estado === 'publicado' && pub.publicado_em !== null && pub.publicado_por === admin.id);
  const mc = await meu(ana.id);
  check('Ana vê só o publicado dela (a escola; o modelo ainda não)', mc.board.length === 1 && mc.board[0].titulo === 'Alliance Française de Marseille');
  check('vem com os dados da equipe e sem o caminho de arquivo', mc.board[0].dados.cidade === 'Marseille' && !('arquivo_caminho' in mc.board[0]) && mc.board[0].tem_arquivo === false);
  check('Bia não vê nada da Ana (e o dela está só revisado)', (await meu(bia.id)).board.length === 0);
  await adm('select crm_board_retirar($1)', [eAna]);
  check('retirar tira do app e volta para revisado, sem apagar', (await meu(ana.id)).board.length === 0 && (await um('select estado from board_itens where id=$1', [eAna])).estado === 'revisado');
  await adm('select crm_board_publicar($1)', [eAna]);
  check('publicar e retirar viram eventos na ficha', (await q("select tipo from eventos where contato_id=$1 and tipo like 'caso_item_%' order by id", [cAna])).map((r) => r.tipo).join() === 'caso_item_publicado,caso_item_retirado,caso_item_publicado');
  await db.query("update contatos set ultimo_evento_em = null where id=$1", [cAna]);
  await adm('select crm_board_retirar($1)', [eAna]); await adm('select crm_board_publicar($1)', [eAna]);
  check('o que é feito por você (publicar, retirar) NÃO zera o "parada há N dias"', (await um('select ultimo_evento_em from contatos where id=$1', [cAna])).ultimo_evento_em === null);

  console.log('\n== O que ela preenche num item publicado ==');
  const dela = (quem, id, patch) => asUser(quem, () => db.query('select salvar_dados_dela($1, $2)', [id, JSON.stringify(patch)]));
  await dela(ana.id, eAna, { criterios: { carga: 'sim' }, meses: 4 });
  await dela(ana.id, eAna, { criterios: { visto: 'nao' }, custo_eur: 3600 });
  const dd = (await um('select dados, dados_dela from board_itens where id=$1', [eAna]));
  check('critérios se mesclam (mandar um não apaga os outros)', dd.dados_dela.criterios.carga === 'sim' && dd.dados_dela.criterios.visto === 'nao' && dd.dados_dela.meses === 4 && dd.dados_dela.custo_eur === 3600);
  check('o que é da equipe (dados) não muda', dd.dados.cidade === 'Marseille' && dd.dados.custo_eur === 3600 && !('criterios' in dd.dados));
  await dela(ana.id, eAna, { criterios: { visto: null } });
  await dela(ana.id, eAna, { criterios: { horario: 'sim', etudes: 'nao' } });
  check('chave de outra persona (au pair, Campus France) é aceita e se mescla com as outras', (await um('select dados_dela from board_itens where id=$1', [eAna])).dados_dela.criterios.horario === 'sim' && (await um('select dados_dela from board_itens where id=$1', [eAna])).dados_dela.criterios.etudes === 'nao');
  check('voltar para "ainda não sei" é guardar vazio', (await um('select dados_dela from board_itens where id=$1', [eAna])).dados_dela.criterios.visto === null);
  for (const [rot, patch] of [['chave que não é dela', { curso: 'x' }], ['critério com chave de formato inseguro', { criterios: { 'Cor X': 'sim' } }], ['critério com chave de SQL', { criterios: { 'a; drop table x': 'sim' } }], ['mais de 12 critérios', { criterios: Object.fromEntries(Array.from({ length: 13 }, (_, i) => ['k' + i, 'sim'])) }], ['critérios que não é objeto', { criterios: ['sim'] }], ['valor do critério fora de sim/não', { criterios: { carga: 'talvez' } }],
    ['meses absurdos', { meses: 99 }], ['meses quebrados', { meses: 4.5 }], ['custo negativo', { custo_eur: -1 }], ['custo em texto', { custo_eur: '3600' }], ['reunido em item de escola', { reunido: true }], ['não é objeto', 'x']])
    check(`recusa: ${rot}`, !(await attempt(() => dela(ana.id, eAna, patch))).ok);
  check('item de outra pessoa é recusado', await falha(() => dela(bia.id, eAna, { meses: 4 }), 'item_nao_encontrado'));
  check('item não publicado é recusado', await falha(() => dela(ana.id, mAna, { meses: 4 }), 'item_nao_encontrado'));
  await adm("update board_itens set estado='revisado' where id=$1", [mAna]);
  check('modelo não é editável pela pessoa', await falha(() => (async () => { await adm('select crm_board_publicar($1)', [mAna]); return dela(ana.id, mAna, {}); })(), 'item_nao_editavel'));
  const dc = await item(cAna, 'documento', 'Certificado do ensino médio', { dados: { rotulo: 'Certificado', direcao: 'reune' } });
  await db.query("update board_itens set estado='revisado' where id=$1", [dc]); await adm('select crm_board_publicar($1)', [dc]);
  await dela(ana.id, dc, { reunido: true });
  check('documento: marcar como reunido', (await um('select dados_dela from board_itens where id=$1', [dc])).dados_dela.reunido === true && !(await attempt(() => dela(ana.id, dc, { reunido: 'sim' }))).ok);
  check('anon não preenche', !(await attempt(() => asAnon(() => db.query('select salvar_dados_dela($1, $2)', [eAna, '{}'])))).ok);

  console.log('\n== Passos dela no Checklist ==');
  const [aEla] = await q(`insert into caso_acoes (contato_id, n, titulo, dono, canal, passo_chave, publicada_em) values ($1,1,'Ligar para a escola','ela','plataforma','ligar_escola', now()) returning id`, [cAna]);
  const [aRasc] = await q(`insert into caso_acoes (contato_id, n, titulo, dono, canal, passo_chave) values ($1,2,'Passo ainda não publicado','ela','plataforma','trad_docs') returning id`, [cAna]);
  const [aIng] = await q(`insert into caso_acoes (contato_id, n, titulo, dono, canal, publicada_em) values ($1,3,'Responder sobre o pagamento','ingryd','email', now()) returning id`, [cAna]);
  const [aBia] = await q(`insert into caso_acoes (contato_id, n, titulo, dono, canal, passo_chave, publicada_em) values ($1,1,'Passo da Bia','ela','plataforma','x', now()) returning id`, [cBia]);
  const acoes = (await meu(ana.id)).acoes;
  check('Ana vê só o passo dela já publicado (não o rascunho, não os da Ingryd, não os da Bia)', acoes.length === 1 && acoes[0].titulo === 'Ligar para a escola' && acoes[0].passo_chave === 'ligar_escola');
  await asUser(ana.id, () => db.query('select marcar_acao($1, true)', [aEla.id]));
  const ac = await um('select estado, concluida_por, concluida_em from caso_acoes where id=$1', [aEla.id]);
  check('Ana conclui o passo: estado, quem e quando', ac.estado === 'concluida' && ac.concluida_por === 'ela' && ac.concluida_em !== null);
  check('concluir vira evento caso_acao_concluida e ZERA o "parada há N dias"',
    (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='caso_acao_concluida'", [cAna])).n === 1 && (await um('select ultimo_evento_em from contatos where id=$1', [cAna])).ultimo_evento_em !== null);
  await asUser(ana.id, () => db.query('select marcar_acao($1, false)', [aEla.id]));
  check('desfazer volta para aberta', (await um('select estado, concluida_em from caso_acoes where id=$1', [aEla.id])).estado === 'aberta');
  check('passo não publicado, da Ingryd ou da Bia: recusado', await falha(() => asUser(ana.id, () => db.query('select marcar_acao($1, true)', [aRasc.id])), 'acao_nao_encontrada') &&
    await falha(() => asUser(ana.id, () => db.query('select marcar_acao($1, true)', [aIng.id])), 'acao_nao_encontrada') && await falha(() => asUser(ana.id, () => db.query('select marcar_acao($1, true)', [aBia.id])), 'acao_nao_encontrada'));
  check('anon não marca', !(await attempt(() => asAnon(() => db.query('select marcar_acao($1, true)', [aEla.id])))).ok);

  console.log('\n== Avisos: rascunho, data e primeiro acesso ==');
  const novo = async (o) => (await av(o)).rows[0].id;
  const estado = async (id) => (await um('select estado, liberar_em, adiado_ate from caso_avisos where id=$1', [id]));
  const vis = async (quem) => (await asUser(quem, () => db.query('select * from meus_avisos()'))).rows.map((r) => r.titulo);
  const ag = (id, quando, dias) => adm('select crm_aviso_agendar($1, $2, $3)', [id, quando || null, dias ?? null]);

  const qFim = await novo({ tipo: 'pergunta', titulo: 'Quando termina o seu PVT?', rt: 'data', g: 'respostas.fim_pvt', dias: 0 });
  const iPrazo = await novo({ tipo: 'inteligencia', titulo: 'A inscrição fecha em 18 dias', dias: 1 });
  const qNivel = await novo({ tipo: 'pergunta', titulo: 'Qual é o seu nível de francês?', rt: 'opcoes', op: ['Iniciante', 'Intermediário', 'Avançado'], g: 'respostas.nivel_frances', dias: 0 });
  const pBilan = await novo({ tipo: 'proposta', titulo: 'O bilan está aqui', d: { tela: 'guias' }, dias: 0 });
  const aBiaPerg = await novo({ c: cBia, tipo: 'pergunta', titulo: 'Pergunta da Bia', rt: 'data', g: 'respostas.fim_pvt', dias: 0 });
  check('rascunho nunca aparece para ela', (await vis(ana.id)).length === 0);
  check('aprovar sem consentimento é recusado (Bia)', await falha(() => ag(aBiaPerg, null, 0), 'sem_consentimento'));
  check('pessoa logada não aprova', await falha(() => asUser(ana.id, () => db.query('select crm_aviso_agendar($1)', [qFim])), 'sem_permissao'));
  for (const id of [qFim, qNivel, pBilan]) await ag(id, null, 0);
  await ag(iPrazo, null, 1);
  const a1 = await estado(qFim);
  check('aprovado, mas ela ainda não entrou: fica agendado sem data e invisível', a1.estado === 'agendado' && a1.liberar_em === null && (await vis(ana.id)).length === 0);
  check('antes de entrar, a pessoa sem ficha não chama o primeiro acesso', await falha(() => asUser(cris.id, () => db.query('select caso_primeiro_acesso()')), 'nao_autenticado'));
  await asUser(ana.id, () => db.query('select caso_primeiro_acesso()'));
  await asUser(ana.id, () => db.query('select caso_primeiro_acesso()'));
  check('primeiro acesso: um evento só, mesmo chamando de novo', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='caso_primeiro_acesso'", [cAna])).n === 1);
  const titulos = await vis(ana.id);
  check('no dia 0 chegam as de "0 dias depois"', titulos.length === 3 && ['Quando termina o seu PVT?', 'Qual é o seu nível de francês?', 'O bilan está aqui'].every((t) => titulos.includes(t)));
  const ip = await estado(iPrazo);
  check('a inteligência (1 dia depois) fica para o dia seguinte às 9h de Paris, nunca no mesmo dia', ip.liberar_em !== null && new Date(ip.liberar_em) > new Date() &&
    new Date(ip.liberar_em) - new Date() < 3 * 864e5 && !titulos.includes('A inscrição fecha em 18 dias'));
  check('o horário é 9h de Paris', (await um(`select extract(hour from liberar_em at time zone 'Europe/Paris')::int h, extract(minute from liberar_em at time zone 'Europe/Paris')::int m from caso_avisos where id=$1`, [iPrazo])).h === 9);
  await ag(iPrazo, new Date(Date.now() - 36e5).toISOString());
  check('você escolhe uma data fixa: no passado, aparece na hora', (await vis(ana.id)).includes('A inscrição fecha em 18 dias') && (await estado(iPrazo)).estado === 'agendado');
  await ag(iPrazo, new Date(Date.now() + 5 * 864e5).toISOString());
  check('você escolhe uma data fixa: no futuro, some até lá', !(await vis(ana.id)).includes('A inscrição fecha em 18 dias'));
  await ag(iPrazo, new Date(Date.now() - 36e5).toISOString());
  await db.query("update caso_avisos set expira_em = now() - interval '1 minute' where id=$1", [iPrazo]);
  check('aviso vencido não aparece', !(await vis(ana.id)).includes('A inscrição fecha em 18 dias'));
  await db.query('update caso_avisos set expira_em = null where id=$1', [iPrazo]);
  check('pausar (voltar a rascunho) tira do ar e a data de aprovação some da frente', (await adm("update caso_avisos set estado='rascunho' where id=$1", [iPrazo])) && !(await vis(ana.id)).includes('A inscrição fecha em 18 dias'));
  await ag(iPrazo, new Date(Date.now() - 36e5).toISOString());
  check('Bia não vê os avisos da Ana', (await vis(bia.id)).length === 0);
  check('anon não vê avisos', !(await attempt(() => asAnon(() => db.query('select * from meus_avisos()')))).ok);

  console.log('\n== Ler, adiar, dispensar ==');
  await asUser(ana.id, () => db.query('select marcar_aviso_lido($1)', [pBilan]));
  check('marcar como lido', (await estado(pBilan)).estado === 'lido');
  await asUser(bia.id, () => db.query('select marcar_aviso_lido($1)', [iPrazo]));
  check('Bia não marca como lido o aviso da Ana', (await estado(iPrazo)).estado === 'agendado');
  await asUser(ana.id, () => db.query('select dispensar_aviso($1)', [qFim]));
  check('pergunta não se dispensa (responde-se ou adia-se)', (await estado(qFim)).estado === 'agendado');
  await asUser(ana.id, () => db.query('select dispensar_aviso($1)', [pBilan]));
  check('"Entendi" dispensa o que não é pergunta', (await estado(pBilan)).estado === 'dispensado' && !(await vis(ana.id)).includes('O bilan está aqui'));
  await asUser(ana.id, () => db.query('select adiar_aviso($1)', [iPrazo]));
  const ad = await estado(iPrazo);
  check('"Agora não": some por 3 dias e volta para agendado (o sininho acende de novo)', ad.estado === 'agendado' && ad.adiado_ate !== null &&
    Math.abs((new Date(ad.adiado_ate) - Date.now()) / 864e5 - 3) < 0.01 && !(await vis(ana.id)).includes('A inscrição fecha em 18 dias'));
  check('dispensar, adiar e ler viram eventos', (await q("select tipo from eventos where contato_id=$1 and tipo in ('caso_aviso_lido','caso_aviso_dispensado','caso_aviso_adiado') order by id", [cAna])).map((r) => r.tipo).join() === 'caso_aviso_lido,caso_aviso_dispensado,caso_aviso_adiado');

  console.log('\n== Responder uma pergunta ==');
  const resp = (quem, id, v) => asUser(quem, () => db.query('select responder_aviso($1, $2)', [id, JSON.stringify(v)]));
  check('opção que não existe é recusada', await falha(() => resp(ana.id, qNivel, 'Fluente'), 'resposta_invalida'));
  check('data inválida, absurda ou em texto livre é recusada', await falha(() => resp(ana.id, qFim, 'amanhã'), 'resposta_invalida') && await falha(() => resp(ana.id, qFim, '2026-02-31'), 'resposta_invalida') &&
    await falha(() => resp(ana.id, qFim, dia(900)), 'resposta_invalida') && await falha(() => resp(ana.id, qFim, dia(-500)), 'resposta_invalida') && await falha(() => resp(ana.id, qFim, 20270101), 'resposta_invalida'));
  check('proposta não se responde como pergunta', await falha(() => resp(ana.id, pBilan, 'x'), 'aviso_nao_e_pergunta') || await falha(() => resp(ana.id, pBilan, 'x'), 'aviso_nao_encontrado'));
  check('a Bia não responde a pergunta da Ana', await falha(() => resp(bia.id, qNivel, 'Iniciante'), 'aviso_nao_encontrado'));
  check('anon não responde', !(await attempt(() => asAnon(() => db.query('select responder_aviso($1, $2)', [qNivel, '"Iniciante"'])))).ok);
  await resp(ana.id, qNivel, 'Iniciante');
  await resp(ana.id, qFim, dia(100));
  const ct = (await um('select respostas from contatos where id=$1', [cAna])).respostas;
  check('a resposta grava só na chave permitida de contatos.respostas, sem apagar o que já havia', ct.nivel_frances === 'Iniciante' && ct.fim_pvt === dia(100));
  check('a pergunta fica respondida, com a resposta e o momento', (await um('select estado, resposta, respondido_em from caso_avisos where id=$1', [qNivel])).resposta === 'Iniciante');
  check('responder duas vezes é recusado', await falha(() => resp(ana.id, qNivel, 'Avançado'), 'aviso_ja_respondido'));
  const mc2 = await meu(ana.id);
  check('respondida sai da lista de novidades e entra nas respondidas', !mc2.avisos.some((a) => a.id === qNivel) && mc2.respondidas.some((r) => r.titulo.startsWith('Qual é o seu nível') && r.resposta === 'Iniciante'));
  check('responder vira evento e ZERA o "parada há N dias"', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='caso_aviso_respondido'", [cAna])).n === 2);
  check('a Bia não recebe o que a Ana respondeu', (await um('select respostas from contatos where id=$1', [cBia])).respostas.nivel_frances === undefined);

  console.log('\n== Rotina diária: acender o sininho ==');
  const x1 = await novo({ tipo: 'inteligencia', titulo: 'Para o dia seguinte', dias: 1 });
  await ag(x1, null, 1);
  await ag(x1, new Date(Date.now() - 6e4).toISOString());
  const sinaisAntes = (await um('select count(*)::int n from sinais where contato_id=$1', [cAna])).n;
  check('pessoa logada e anon não rodam a rotina', !(await attempt(() => asUser(ana.id, () => db.query('select crm_avisos_materializar()')))).ok && !(await attempt(() => asAnon(() => db.query('select crm_avisos_materializar()')))).ok);
  const n1 = (await um('select crm_avisos_materializar() n')).n;
  check('a rotina libera o que venceu e cria o sinal (sininho)', n1 >= 1 && (await estado(x1)).estado === 'liberado' &&
    (await um('select count(*)::int n from sinais where contato_id=$1', [cAna])).n === sinaisAntes + n1 && (await um("select mensagem from sinais where contato_id=$1 order by id desc limit 1", [cAna])).mensagem.includes('Para o dia seguinte'));
  check('rodar de novo não repete o sinal', (await um('select crm_avisos_materializar() n')).n === 0);
  check('liberado continua visível para ela', (await vis(ana.id)).includes('Para o dia seguinte'));

  console.log('\n== Conta sem ficha ligada ==');
  check('meu_caso() vem vazio', (await asUser(cris.id, () => um('select meu_caso() r'))).r === null);
  check('meus_avisos() vem vazio', (await asUser(cris.id, () => db.query('select * from meus_avisos()'))).rows.length === 0);
  check('nenhuma função de escrita funciona', await falha(() => asUser(cris.id, () => db.query('select responder_aviso($1, $2)', [qNivel, '"x"'])), 'nao_autenticado') &&
    await falha(() => asUser(cris.id, () => db.query('select marcar_acao($1, true)', [aEla.id])), 'nao_autenticado') && await falha(() => asUser(cris.id, () => db.query('select salvar_dados_dela($1, $2)', [eAna, '{}'])), 'nao_autenticado'));
  check('anon não chama meu_caso()', !(await attempt(() => asAnon(() => db.query('select meu_caso()')))).ok);

  console.log('\n== Achados: o que o CRM entendeu ==');
  const [ach1] = await q(`insert into caso_achados (contato_id, tipo, texto) values ($1,'duvida','A inscrição fecha em 30/11 ou em 15/12?') returning id`, [cAna]);
  check('achado nasce em conferência', (await um('select estado from caso_achados where id=$1', [ach1.id])).estado === 'conferir');
  await adm(`update caso_achados set estado='ok', conferido_por=$2, conferido_em=now() where id=$1`, [ach1.id, admin.id]);
  check('conferir vira evento e NÃO zera o "parada há N dias"', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='caso_achado_conferido'", [cAna])).n === 1);
  check('a pessoa nunca lê um achado, nem pelo meu_caso()', JSON.stringify(await meu(ana.id)).indexOf('inscrição fecha em 30/11 ou') === -1);
  check('atualizado_em acompanha a mudança', (await um('select atualizado_em > criado_em as mudou from caso_achados where id=$1', [ach1.id])).mudou === true);

  console.log('\n== Apagar a pessoa apaga o caso ==');
  const antes = (await Promise.all(TABELAS.map(async (t) => (await um(`select count(*)::int n from ${t} where contato_id=$1`, [cAna])).n))).reduce((a, b) => a + b, 0);
  check('havia coisa do caso dela nas quatro tabelas', antes > 4);
  await db.query('delete from contatos where id=$1', [cAna]);
  const depois = (await Promise.all(TABELAS.map(async (t) => (await um(`select count(*)::int n from ${t} where contato_id=$1`, [cAna])).n))).reduce((a, b) => a + b, 0);
  check('depois de apagar o contato não sobra nada', depois === 0);
  check('o caso da Bia continua intacto', (await um('select count(*)::int n from board_itens where contato_id=$1', [cBia])).n === 1);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
