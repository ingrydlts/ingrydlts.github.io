// Testa crm-caso-importar.sql (importar o caso da página do Notion como RASCUNHOS) num Postgres efêmero (PGlite).
// Não toca no Supabase real. Pessoas fictícias.
// Uso: cd admin/crm/db/testes && npm install && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:caso-importar
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
async function falha(fn, motivo) { const r = await attempt(fn); return !r.ok && (!motivo || String(r.error && r.error.message).includes(motivo)); }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const um = async (sql, params) => (await q(sql, params))[0];

// O que o Worker manda para a página da Aïssa (fictícia, como no desenho): ações, achados, itens e avisos.
const base = () => ({
  fonte: { pagina: 'abcdef0123456789abcdef0123456789', editada_em: '2026-10-31T08:57:05.347Z' },
  achados: [
    { chave: 'resumo', tipo: 'fato', texto: 'PVT perto do fim, quer visto de estudante para um curso de francês e depois a universidade.', origem: 'conversa', certeza: 'inferido' },
    { chave: 'nb_aaaaaaaaaaaa', tipo: 'fato', texto: 'O curso de 15 h por semana não serve: precisa ser intensivo, de no mínimo 20 h.', origem: 'conversa', certeza: 'literal' },
    { chave: 'nb_bbbbbbbbbbbb', tipo: 'duvida', texto: 'O pagamento do semestre pode vir depois da inscrição?', origem: 'conversa', certeza: 'a_confirmar' }
  ],
  acoes: [
    { n: 1, titulo: 'Ligar para a escola de francês', dono: 'ela', canal: 'plataforma', botao: 'gerar_rascunho', prazo: null, prazo_texto: 'dia seguinte à ligação', prazo_a_confirmar: true, estado: 'aguardando_ela', certeza: 'literal', passo_chave: 'pend_1' },
    { n: 2, titulo: 'Confirmar a data exata do fim do PVT', dono: 'ela', canal: 'plataforma', botao: 'marcar_marco', prazo: '2026-11-20', prazo_texto: null, prazo_a_confirmar: false, estado: 'aberta', certeza: 'inferido', passo_chave: 'pend_2' },
    { n: 9, titulo: 'Responder: o pagamento do semestre pode vir depois da inscrição?', dono: 'ingryd', canal: 'email', botao: 'pesquisar', prazo: null, prazo_texto: 'antes de 30/11', prazo_a_confirmar: true, estado: 'aberta', certeza: 'literal', passo_chave: null },
    { n: 11, titulo: 'Conferir carga e duração mínimas do curso', dono: 'ingryd', canal: 'so_eu', botao: null, prazo: null, prazo_texto: null, prazo_a_confirmar: false, estado: 'aberta', certeza: 'inferido', passo_chave: null }
  ],
  itens: [
    { origem_chave: 'notion:bilan', tipo: 'bilan', titulo: 'Bilan da nossa conversa', ordem: 1,
      dados: { secoes: [{ titulo: 'Dúvidas que tiramos na conversa', itens: [{ texto: 'O curso de 15 h não serve.', estado: 'confirmado' }, { texto: 'Inscrição até 30/11 (vou confirmar com a escola).', estado: 'em_conferencia' }] }] } },
    { origem_chave: 'notion:prazo_chave', tipo: 'marco', titulo: 'Prazo-chave', ordem: 5, dados: { data: '2026-11-30', a_confirmar: false } },
    { origem_chave: 'notion:doc:111111111111', tipo: 'documento', titulo: 'Certificado do ensino médio', ordem: 20, dados: { rotulo: 'Certificado do ensino médio', direcao: 'reune' } },
    { origem_chave: 'notion:envio:6', tipo: 'documento', titulo: 'PDF das escolas de FLE', ordem: 16, dados: { rotulo: 'PDF das escolas de FLE', direcao: 'recebe' } }
  ],
  avisos: [
    { origem_chave: 'notion:aviso:bilan', tipo: 'proposta', titulo: 'O bilan da nossa conversa está aqui', texto: 'Guardei a cópia do e-mail no seu Espaço.', destino: { tela: 'guias' }, dias_apos: 0 },
    { origem_chave: 'notion:aviso:fim_pvt', tipo: 'pergunta', titulo: 'Quando termina o seu PVT?', texto: 'Com essa data eu calculo o que cabe antes de você viajar.', resposta_tipo: 'data', grava_em: 'respostas.fim_pvt', dias_apos: 0 },
    { origem_chave: 'notion:aviso:nivel_frances', tipo: 'pergunta', titulo: 'Qual é o seu nível de francês hoje?', resposta_tipo: 'opcoes', opcoes: ['Iniciante (A1/A2)', 'Intermediário (B1)', 'Avançado (B2 ou mais)', 'Não sei'], grava_em: 'respostas.nivel_frances', dias_apos: 1 }
  ]
});
const clone = (o) => JSON.parse(JSON.stringify(o));

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
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql'])
    await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-importar.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez sem erro', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  const r2 = await attempt(() => db.exec(sql)); check('roda a 2ª vez sem erro (idempotente)', r2.ok);
  check('roda de novo depois do crm-caso.sql sem erro (a ordem dos dois não quebra)', (await attempt(() => db.exec(readFileSync(path.resolve(HERE, '../crm-caso.sql'), 'utf8')))).ok && (await attempt(() => db.exec(sql))).ok);

  const [fn] = await q(`select p.prosecdef def, coalesce(array_to_string(p.proconfig, ','), '') cfg, has_function_privilege('anon', p.oid, 'execute') anon_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'crm_caso_importar'`);
  check('crm_caso_importar: security definer, search_path fixo e anon não executa', fn.def && /search_path=/.test(fn.cfg) && !fn.anon_exec);
  const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and ((table_name='caso_acoes' and column_name='prazo_texto') or (table_name in ('board_itens','caso_avisos') and column_name='origem_chave'))`)).length;
  check('as colunas novas existem (prazo_texto e as duas origem_chave)', cols === 3);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email) values ('ana@example.com') returning id");
  const [bia] = await q("insert into auth.users (email) values ('bia@example.com') returning id");
  for (const [u, e] of [[ana, 'ana@example.com'], [bia, 'bia@example.com']])
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [e, u.id]);
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id;
  const cBia = (await um("select id from contatos where email='bia@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cAna]);
  const importar = async (cid, payload, quem = admin.id) => (await asUser(quem, () => um('select crm_caso_importar($1, $2) r', [cid, JSON.stringify(payload)]))).r;
  const conta = async (t, cid) => (await um(`select count(*)::int n from ${t} where contato_id=$1`, [cid])).n;
  const meu = async (quem) => (await asUser(quem, () => um('select meu_caso() r'))).r;

  console.log('\n== Quem pode importar ==');
  check('pessoa logada não importa', await falha(() => importar(cAna, base(), ana.id), 'sem_permissao'));
  check('anon não importa', !(await attempt(() => asAnon(() => db.query('select crm_caso_importar($1, $2)', [cAna, '{}'])))).ok);
  check('contato que não existe é recusado', await falha(() => importar('00000000-0000-0000-0000-000000000000', base()), 'contato_nao_encontrado'));
  check('payload que não é objeto é recusado', await falha(() => importar(cAna, [1, 2]), 'payload_invalido') && await falha(() => importar(cAna, 'x'), 'payload_invalido'));
  check('listas grandes demais são recusadas', await falha(() => importar(cAna, { achados: Array.from({ length: 61 }, (_, i) => ({ chave: 'k' + i, tipo: 'fato', texto: 'x' })) }), 'payload_invalido'));
  check('achado sem chave é recusado (sem chave, ler de novo duplicaria)', await falha(() => importar(cAna, { achados: [{ tipo: 'fato', texto: 'x' }] }), 'payload_invalido'));

  console.log('\n== A primeira leitura cria só rascunhos ==');
  const r = await importar(cAna, base());
  check('conta o que entrou', r.achados.novos === 3 && r.acoes.novos === 4 && r.itens.novos === 4 && r.avisos.novos === 3 && r.achados.pulados === 0);
  check('achados nascem em conferência, com origem e certeza', (await q("select estado, origem from caso_achados where contato_id=$1", [cAna])).every((a) => a.estado === 'conferir' && a.origem === 'conversa'));
  check('ações nascem sem publicar, e o prazo em texto não se perde', (await q('select publicada_em, prazo_texto, n from caso_acoes where contato_id=$1 order by n', [cAna])).every((a) => a.publicada_em === null) &&
    (await um('select prazo_texto, prazo_a_confirmar, prazo from caso_acoes where contato_id=$1 and n=1', [cAna])).prazo_texto === 'dia seguinte à ligação');
  check('a data de verdade vira data', String((await um('select prazo from caso_acoes where contato_id=$1 and n=2', [cAna])).prazo).startsWith('2026-11-20') || (await um("select to_char(prazo,'YYYY-MM-DD') p from caso_acoes where contato_id=$1 and n=2", [cAna])).p === '2026-11-20');
  check('itens do board nascem "proposto", com a chave de origem', (await q('select estado, origem_chave from board_itens where contato_id=$1', [cAna])).every((i) => i.estado === 'proposto' && /^notion:/.test(i.origem_chave)));
  check('avisos nascem "rascunho", em modo relativo e sem data', (await q('select estado, modo, liberar_em from caso_avisos where contato_id=$1', [cAna])).every((a) => a.estado === 'rascunho' && a.modo === 'apos_primeiro_acesso' && a.liberar_em === null));
  check('a pergunta de opções leva as quatro opções e onde gravar', (await um("select opcoes, grava_em from caso_avisos where contato_id=$1 and origem_chave='notion:aviso:nivel_frances'", [cAna])).opcoes.length === 4);
  const mc = await meu(ana.id);
  check('NADA chega à pessoa: nem board, nem ações, nem avisos (mesmo com consentimento)', mc.board.length === 0 && mc.acoes.length === 0 && mc.avisos.length === 0);
  check('a importação vira evento caso_importado e NÃO zera o "parada há N dias"', (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='caso_importado'", [cAna])).n === 1 && (await um('select ultimo_evento_em from contatos where id=$1', [cAna])).ultimo_evento_em === null);

  console.log('\n== Ler a mesma página de novo não duplica ==');
  const antes = { a: await conta('caso_achados', cAna), c: await conta('caso_acoes', cAna), i: await conta('board_itens', cAna), v: await conta('caso_avisos', cAna) };
  const r2b = await importar(cAna, base());
  check('tudo vem como "mantido" e nada de novo', r2b.achados.mantidos === 3 && r2b.acoes.mantidos === 4 && r2b.itens.mantidos === 4 && r2b.avisos.mantidos === 3 &&
    [r2b.achados, r2b.acoes, r2b.itens, r2b.avisos].every((g) => g.novos === 0 && g.atualizados === 0 && g.pulados === 0));
  check('as linhas continuam as mesmas', antes.a === await conta('caso_achados', cAna) && antes.c === await conta('caso_acoes', cAna) && antes.i === await conta('board_itens', cAna) && antes.v === await conta('caso_avisos', cAna));
  const outra = await importar(cBia, base());
  check('a Bia importa o mesmo conteúdo sem colidir com a Ana (as chaves são por pessoa)', outra.itens.novos === 4 && outra.avisos.novos === 3 && await conta('board_itens', cAna) === antes.i);

  console.log('\n== Página mudou: só o que ainda é rascunho muda ==');
  const p2 = base();
  p2.acoes[0].titulo = 'Ligar para a escola de francês e a Alliance'; p2.itens[1].dados = { data: '2026-12-15', a_confirmar: true }; p2.achados[0].texto = 'Resumo novo da conversa.'; p2.avisos[0].texto = 'Texto novo do aviso.';
  const r3 = await importar(cAna, p2);
  check('o rascunho se atualiza (ação, marco, resumo, aviso) e conta como atualizado', r3.acoes.atualizados === 1 && r3.itens.atualizados === 1 && r3.achados.atualizados === 1 && r3.avisos.atualizados === 1);
  check('a versão do item sobe quando ele é atualizado', (await um("select versao from board_itens where contato_id=$1 and origem_chave='notion:prazo_chave'", [cAna])).versao === 2);

  console.log('\n== O que você já decidiu NUNCA é mudado ==');
  await db.query("update caso_achados set estado='ok' where contato_id=$1 and chave='resumo'", [cAna]);
  await db.query("update caso_acoes set publicada_em=now() where contato_id=$1 and n=1", [cAna]);
  await db.query("update caso_acoes set concluida_por='ela', estado='concluida', concluida_em=now() where contato_id=$1 and n=2", [cAna]);
  await db.query("update board_itens set estado='revisado' where contato_id=$1 and origem_chave='notion:bilan'", [cAna]);
  await db.query("update board_itens set estado='revisado' where contato_id=$1 and origem_chave='notion:prazo_chave'", [cAna]);
  await db.query("update board_itens set estado='publicado' where contato_id=$1 and origem_chave='notion:prazo_chave'", [cAna]);
  await asUser(admin.id, () => db.query("select crm_aviso_agendar(id, null, 0::smallint) from caso_avisos where contato_id=$1 and origem_chave='notion:aviso:fim_pvt'", [cAna]));
  const p3 = base();
  p3.achados[0].texto = 'Resumo que mudou depois de conferido.'; p3.acoes[0].titulo = 'Ação publicada que a página mudou'; p3.acoes[1].titulo = 'Ação concluída por ela que a página mudou';
  p3.itens[0].dados = { secoes: [{ titulo: 'Seção nova', itens: [{ texto: 'x', estado: 'confirmado' }] }] }; p3.itens[1].dados = { data: '2027-01-01', a_confirmar: false };
  p3.avisos[1].titulo = 'Pergunta aprovada que a página mudou';
  const r4 = await importar(cAna, p3);
  check('cada grupo conta o que foi pulado', r4.achados.pulados === 1 && r4.acoes.pulados === 2 && r4.itens.pulados === 2 && r4.avisos.pulados === 1);
  check('achado conferido: texto intacto', (await um("select texto from caso_achados where contato_id=$1 and chave='resumo'", [cAna])).texto === 'Resumo novo da conversa.');
  check('ação publicada e ação concluída por ela: títulos intactos', (await q('select titulo from caso_acoes where contato_id=$1 and n in (1,2) order by n', [cAna])).map((x) => x.titulo).join('|') === 'Ligar para a escola de francês e a Alliance|Confirmar a data exata do fim do PVT');
  check('item revisado e item publicado: dados intactos', (await um("select dados from board_itens where contato_id=$1 and origem_chave='notion:bilan'", [cAna])).dados.secoes[0].titulo === 'Dúvidas que tiramos na conversa' &&
    (await um("select dados from board_itens where contato_id=$1 and origem_chave='notion:prazo_chave'", [cAna])).dados.data === '2026-12-15');
  check('aviso aprovado: título intacto e continua agendado', (await um("select titulo, estado from caso_avisos where contato_id=$1 and origem_chave='notion:aviso:fim_pvt'", [cAna])).titulo === 'Quando termina o seu PVT?' &&
    (await um("select estado from caso_avisos where contato_id=$1 and origem_chave='notion:aviso:fim_pvt'", [cAna])).estado === 'agendado');
  check('reler não publica nem aprova nada: só o que você mesmo mudou', (await q("select estado from board_itens where contato_id=$1 and estado='publicado'", [cAna])).length === 1 && (await q("select estado from caso_avisos where contato_id=$1 and estado='agendado'", [cAna])).length === 1);
  const mc2 = await meu(ana.id);
  check('meu_caso() devolve o botão sugerido de cada ação dela (o app decide a ação: data, roteiro ou só feito)', mc2.acoes.length === 1 && mc2.acoes[0].botao === 'gerar_rascunho');
  check('o que a pessoa vê é só o que você publicou (a ação publicada, com o prazo em texto, e o marco)', mc2.board.length === 1 && mc2.acoes.length === 1 && mc2.acoes[0].prazo_texto === 'dia seguinte à ligação' && mc2.acoes[0].passo_chave === 'pend_1');

  console.log('\n== Tudo ou nada ==');
  const [{ n: aA }, { n: cA }] = [{ n: await conta('caso_achados', cBia) }, { n: await conta('caso_acoes', cBia) }];
  const ruim = clone(base()); ruim.achados.push({ chave: 'nb_novo_valido', tipo: 'fato', texto: 'Um achado válido novo.' }); ruim.acoes.push({ n: 50, titulo: 'Ação inválida', dono: 'amiga', canal: 'plataforma', passo_chave: 'x' });
  check('uma ação fora das regras desfaz a importação inteira', !(await attempt(() => importar(cBia, ruim))).ok && await conta('caso_achados', cBia) === aA && await conta('caso_acoes', cBia) === cA);
  const semPasso = clone(base()); semPasso.acoes.push({ n: 51, titulo: 'Ela, plataforma, sem chave do passo', dono: 'ela', canal: 'plataforma' });
  check('ação dela pela plataforma sem a chave do passo é recusada', !(await attempt(() => importar(cBia, semPasso))).ok);
  const foraDaLista = clone(base()); foraDaLista.avisos.push({ origem_chave: 'notion:aviso:x', tipo: 'pergunta', titulo: 'Pergunta que grava em qualquer lugar', resposta_tipo: 'data', grava_em: 'nome' });
  check('aviso que grava fora da lista fechada é recusado', !(await attempt(() => importar(cBia, foraDaLista))).ok && await conta('caso_avisos', cBia) === 3);
  const dadosRuins = clone(base()); dadosRuins.itens[0].dados = { segredo: 'x' };
  check('item com chave fora da lista do tipo é recusado', !(await attempt(() => importar(cBia, dadosRuins))).ok);

  console.log('\n== Apagar a pessoa apaga o caso importado ==');
  await db.query('delete from contatos where id=$1', [cBia]);
  check('depois de apagar não sobra nada da Bia', await conta('caso_achados', cBia) + await conta('caso_acoes', cBia) + await conta('board_itens', cBia) + await conta('caso_avisos', cBia) === 0);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
