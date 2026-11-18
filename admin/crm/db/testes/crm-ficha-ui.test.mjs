// Testa a ficha v2 do CRM (admin/crm/ficha*.js ligados ao crm.js real) em Node, com navegador e Supabase de mentira.
// NÃO testa nada em navegador real (visual, arrastar de verdade, foco).
//
// Uso: cd admin/crm/db/testes && node crm-ficha-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

function base(extra = {}) {
  return Object.assign({ 'contatos:one': { data: { dossie: {}, user_id: null }, error: null }, eventos: { data: [], error: null }, consentimentos: { data: [], error: null },
    emails_enviados: { data: [], error: null }, checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, chat_mensagens: { data: [], error: null },
    propostas: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null } }, extra);
}
async function abre(h, c) { h.mod.setC([c]); h.mod.state.sel = c.id; h.mod.state.view = 'pessoa'; h.mod.state.ptab = null; h.mod.state.pstab = 'assistente'; await h.mod.renderPessoa(); return h.el('pessoa-page').innerHTML; }

console.log('== Task 1: chave de ligação ==');
{
  const h = await carregarCrm({ respostas: base() });
  const html = await abre(h, pessoa());
  check('desligada: mantém o dossiê antigo', html.includes('id="dossie-box"'));
  check('desligada: não tem a ficha v2', !html.includes('id="ficha-v2"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: { crm_ficha_v2: '1' } });
  const html = await abre(h, pessoa());
  check('ligada pelo localStorage: tem a ficha v2', html.includes('id="ficha-v2"'));
  check('ligada: o dossiê antigo não fica fora de sessão', !html.includes('id="dossie-box"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), search: '?ficha=2' });
  const html = await abre(h, pessoa());
  check('ligada por ?ficha=2: tem a ficha v2', html.includes('id="ficha-v2"') && !html.includes('id="dossie-box"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: { crm_ficha_v2: '0' }, search: '?x=ficha=2' });
  const html = await abre(h, pessoa());
  check('valor diferente de 1 e busca sem ficha=2 mantém a antiga', !html.includes('id="ficha-v2"'));
  h.mod.pararAoVivo();
}

console.log('== Task 10: ligação aos dados, abas, ações, deep link ==');
{
  const ago = (min) => new Date(Date.now() + min * 60e3).toISOString();
  const msg = (id) => ({ id, de: 'pessoa', tipo: 'texto', texto: 'Oi ' + id, acao: null, proposta_id: null, criado_em: ago(-10 - id), lida_em: null });
  const resp = { id: 1, contato_id: 'c1', status: 'nova', canal: 'email', texto: 'Quero saber mais', recebido_em: ago(-30) };
  const montar = async (user) => {
    const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: user }, error: null }, chat_mensagens: { data: [msg(2), msg(1)], error: null } }), store: { crm_ficha_v2: '1' } });
    h.mod.setR([resp]); return h;
  };
  let h = await montar(null);
  let html = await abre(h, pessoa({ user_id: null }));
  check('renderiza fila, header, abas e carrossel', html.includes('class="fx-fila mf"') && html.includes('class="hd"') && html.includes('class="fx-abas"') && html.includes('class="fx-car"'));
  check('sem conta: abre na aba Ficha', /data-v="ficha"[^>]*aria-selected="true"/.test(html) && !/data-v="plataforma"[^>]*aria-selected="true"/.test(html));
  check('1º cartão é "Responder Ana"', /data-fx="agAbrir" data-i="0"[^>]*aria-label="Ação 1 de \d: Responder Ana\./.test(html));
  check('a fila é uma linha de chips: a pessoa aberta está destacada e a ação aparece como "Ação:" no chip', html.includes('mf-i atual') && html.split('class="hd"')[0].includes('Ação: Responder Ana'));
  {
    // só mensagem do app, sem resposta por e-mail: a fila da pessoa aberta continua igual ao 1º cartão
    const h2 = await carregarCrm({ respostas: base({ chat_mensagens: { data: [msg(2), msg(1)], error: null } }), store: { crm_ficha_v2: '1' } });
    const html2 = await abre(h2, pessoa({ user_id: null }));
    check('só chat: 1º cartão "Ler as mensagens dela no app"', /data-i="0"[^>]*aria-label="Ação 1 de \d: Ler as mensagens dela no app\./.test(html2));
    h2.mod.pararAoVivo();
  }
  check('mensagens do app viram uma ação (chat)', html.includes('Ler as mensagens dela no app'));
  check('tem o contêiner do pop-up', html.includes('id="fx-pop"'));
  h.mod.pararAoVivo();

  await h.click({ fx: 'agAbrir', i: '1' });
  check('agAbrir abre o pop-up no índice', h.mod.state.fx.ag.pop === 1 && h.el('fx-pop').innerHTML.includes('role="dialog"'));
  await h.click({ fx: 'agNav', d: '-1' });
  check('agNav volta uma ação e repinta o pop-up', h.mod.state.fx.ag.pop === 0 && h.el('fx-pop').innerHTML.includes('Ação 1 de'));
  await h.click({ fx: 'agFechar' });
  check('agFechar zera o pop-up', h.mod.state.fx.ag.pop === null && h.el('fx-pop').innerHTML === '');
  const n = h.mod.state.fx.tarefas.length;
  await h.click({ fx: 'agAbrir', i: String(n - 1) }); await h.click({ fx: 'agNav', d: '1' });
  check('na última ação, agNav não passa do fim', h.mod.state.fx.ag.pop === n - 1);
  await h.click({ fx: 'agFechar' });
  await h.click({ fx: 'agAbrir', i: '0' }); await h.click({ fx: 'agNav', d: '1' });
  check('agNav de 0 leva a 1', h.mod.state.fx.ag.pop === 1);
  await h.click({ fx: 'agAbrir', i: '99' });
  check('agAbrir com índice inválido não muda o pop-up', h.mod.state.fx.ag.pop === 1);
  await h.click({ fx: 'agIr', k: 'chat', id: 'chat' });
  check('agIr leva à Plataforma, abre a sessão e fecha o pop-up', h.mod.state.fx.tab === 'plataforma' && h.mod.state.fx.sessao === 'chat' && h.mod.state.fx.ag.pop === null);
  await h.click({ fx: 'tab', v: 'conversa' });
  check('tab muda a aba', h.mod.state.fx.tab === 'conversa' && h.el('pessoa-page').innerHTML.includes('id="ficha-v2"'));
  await h.click({ fx: 'agAbrir', i: '0' });
  for (const fn of h.handlers.keydown) await fn({ key: 'Escape', preventDefault() {}, target: {} });
  check('Esc fecha o pop-up', h.mod.state.fx.ag.pop === null && h.el('fx-pop').innerHTML === '');
  await h.click({ fx: 'tourFechar' });
  check('fechar o guia grava a preferência', h.store.crm_ficha_tour === '0' && h.mod.state.fx.tour === false);
  check('fichaClick sem data-fx devolve false', h.mod.fichaClick({ dataset: {} }) === false && h.mod.fichaClick(null) === false);
  h.mod.pararAoVivo();

  h = await montar('u1');
  html = await abre(h, pessoa({ user_id: 'u1' }));
  check('com conta: abre na aba Plataforma', /data-v="plataforma"[^>]*aria-selected="true"/.test(html));
  check('com conta: header sem o aviso de "sem conta" e sem o selo "No app" (só o de pagamento, quando há assinatura)', !html.includes('Sem conta</span>') && !html.includes('No app'));
  h.mod.pararAoVivo();
}

console.log('== Curadoria: sessão própria, esconder, ordenar e conferir ==');
{
  const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
  const itens = [{ step_key: 'k1', category: 'Documentação', label: 'Pedir o documento X', status: 'pendente', due_date: '2099-12-01', sort_order: 1, updated_at: null },
    { step_key: 'k2', category: 'Sécurité sociale', label: 'Abrir o Ameli', status: 'pendente', due_date: '2099-12-09', sort_order: 2, updated_at: null },
    { step_key: 'k3', category: 'Documentação', label: 'Passo já feito', status: 'concluido', due_date: null, sort_order: 3, updated_at: null }];
  const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, checklist_items: { data: itens, error: null }, checklist_curadoria: { data: [{ step_key: 'k2', oculto: false, ordem: 0, conferido_em: null }, { step_key: 'k3', oculto: true, ordem: null, conferido_em: null }], error: null }, caso_acoes: { data: [{ id: 12, titulo: 'Abrir a conta bancária', dono: 'ela', canal: 'plataforma', origem_chave: 'enc:1', estado: 'aberta', publicada_em: '2026-11-10', subitens: [], demarche: 'banco', prazo: '2099-12-20' }], error: null } }), store: { crm_ficha_v2: '1' } });
  await abre(h, pessoa({ user_id: 'u1' }));
  await h.click({ fx: 'ir', id: 'curadoria' }); await espera();
  let t = h.el('fx-corpo').innerHTML;
  check('a Curadoria é uma pílula e uma página própria (e a página do Checklist deixa de estar na tela)', /data-fx="ir" data-id="curadoria"/.test(t) && /data-sessao="curadoria"/.test(t) && !/data-sessao="checklist"/.test(t));
  check('mostra os passos na ordem definida (k2 tem ordem 0, vem antes de k1) e o escondido (k3) no grupo dele', t.indexOf('data-cur="k2"') > -1 && t.indexOf('data-cur="k2"') < t.indexOf('data-cur="k1"') && /Escondidos da lista dela · 1/.test(t) && /data-fx="curMostrar" data-id="k3"/.test(t) && /Voltar à ordem automática/.test(t));
  h.writes.length = 0; await h.click({ fx: 'curConf', id: 'k1' });
  const w1 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('✓ conferi grava só conferido_em (com a hora) no passo certo, da pessoa certa', w1 && w1.op === 'upsert' && w1.row[0].step_key === 'k1' && w1.row[0].contato_id === 'c1' && !!w1.row[0].conferido_em && !('oculto' in w1.row[0]) && !('ordem' in w1.row[0]));
  h.writes.length = 0; await h.click({ fx: 'curEsc', id: 'k1' });
  const w2 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('✕ esconde: grava oculto = true e mais nada', w2 && w2.row[0].step_key === 'k1' && w2.row[0].oculto === true && !('ordem' in w2.row[0]) && !('conferido_em' in w2.row[0]));
  h.writes.length = 0; await h.click({ fx: 'curMostrar', id: 'k3' });
  const w3 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('"Mostrar de novo" grava oculto = false', w3 && w3.row[0].step_key === 'k3' && w3.row[0].oculto === false);
  h.writes.length = 0; await h.click({ fx: 'curMov', id: 'k1', d: '-1' });
  const w4 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('↑ regrava a ordem de TODOS os visíveis (0..n-1), sempre com as mesmas colunas, e k1 passa para o topo', w4 && w4.row.length === 2 && w4.row.every((r) => Object.keys(r).sort().join() === 'atualizado_em,contato_id,ordem,step_key') && w4.row[0].step_key === 'k1' && w4.row[0].ordem === 0 && w4.row[1].step_key === 'k2' && w4.row[1].ordem === 1);
  h.writes.length = 0; await h.click({ fx: 'curReset' });
  const w5 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('"Voltar à ordem automática" limpa só a ordem (null) dos que têm ordem', w5 && w5.row.length === 1 && w5.row[0].step_key === 'k2' && w5.row[0].ordem === null);
  await h.click({ fx: 'curOrigem', v: 'dela' });
  check('"Só dela" esconde os gerais e os escondidos na Curadoria', h.mod.state.fx.curOrigem === 'dela' && !/Gerais da démarche/.test(h.el('fx-corpo').innerHTML));
  await h.click({ fx: 'curOrigem', v: 'todos' });
  await h.click({ fx: 'curOrigem', v: 'todos' }); await espera();
  t = h.el('fx-corpo').innerHTML;
  check('o passo só dela também tem ✓ (chave aco:12) e ✕ (tirar da lista dela), e não o ↓ de retirar de antes', /data-fx="curConf" data-id="aco:12"/.test(t) && /data-fx="curRetira" data-id="12"/.test(t) && !/data-caso="aco-retirar"/.test(t));
  h.writes.length = 0; await h.click({ fx: 'curRetira', id: '12' });
  const w6 = h.writes.find((x) => x.table === 'caso_acoes');
  check('✕ no passo só dela tira da página dela (publicada_em = null, no passo certo) e não apaga nada', w6 && w6.op === 'update' && w6.row.publicada_em === null && w6.filtros.join() === 'id=12' && !h.writes.some((x) => x.op === 'delete'));
  h.writes.length = 0; await h.click({ fx: 'curConf', id: 'aco:12' });
  const w7 = h.writes.find((x) => x.table === 'checklist_curadoria');
  check('✓ no passo só dela grava a conferência com a chave aco:12', w7 && w7.row[0].step_key === 'aco:12' && !!w7.row[0].conferido_em);
  await h.click({ caso: 'ed-chk', id: 'k2' });
  check('o ✎ da Curadoria abre o editor do passo ali mesmo', h.mod.state.fx.ckEd === 'k2' && /data-ckform="k2"/.test(h.el('fx-corpo').innerHTML));
  h.mod.pararAoVivo();
  // sem o SQL: aviso claro e nada quebra
  const er = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, checklist_items: { data: itens, error: null }, checklist_curadoria: { data: null, error: { message: 'relation "checklist_curadoria" does not exist' } } }), store: { crm_ficha_v2: '1' } });
  await abre(er, pessoa({ user_id: 'u1' })); await er.click({ fx: 'ir', id: 'curadoria' }); await espera();
  check('tabela ausente: aviso do db/crm-checklist-curadoria.sql e nenhuma linha', er.el('fx-corpo').innerHTML.includes('db/crm-checklist-curadoria.sql') && !er.el('fx-corpo').innerHTML.includes('data-cur='));
  er.mod.pararAoVivo();
}

console.log('== Task 11: sessão Checklist (ligação) ==');
{
  const itens = [{ step_key: 'k1', category: 'Documentação', label: 'Pedir o documento X', status: 'pendente', due_date: '2099-12-01', sort_order: 1, updated_at: null },
    { step_key: 'k2', category: 'Sécurité sociale', label: 'Abrir o Ameli', status: 'pendente', due_date: null, sort_order: 2, updated_at: null },
    { step_key: 'k3', category: 'Documentação', label: 'Passo já feito', status: 'concluido', due_date: null, sort_order: 3, updated_at: null }];
  const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, checklist_items: { data: itens, error: null } }), store: { crm_ficha_v2: '1' } });
  await abre(h, pessoa({ user_id: 'u1' }));
  let corpo = h.el('pessoa-page').innerHTML;
  check('aba Plataforma mostra as pílulas das duas démarches', corpo.includes('data-fx="dem" data-v="visa"') && corpo.includes('data-fx="dem" data-v="ameli"') && corpo.includes('data-v="todas"'));
  check('contagem de feitos por démarche', /data-v="visa"[^>]*>.*?1\/2/.test(corpo));
  await h.click({ fx: 'dem', v: 'ameli' });
  check('dem muda a démarche e a sessão lista só os passos dela', h.mod.state.fx.dem === 'ameli' && h.el('fx-chk-corpo').innerHTML.includes('Abrir o Ameli') && !h.el('fx-chk-corpo').innerHTML.includes('Pedir o documento X'));
  await h.click({ fx: 'dem', v: 'todas' });
  check('Todas volta a listar tudo', h.el('fx-chk-corpo').innerHTML.includes('Pedir o documento X') && h.el('fx-chk-corpo').innerHTML.includes('Abrir o Ameli'));
  await h.click({ fx: 'ckTodos' });
  check('ckTodos alterna', h.mod.state.fx.ckTodos === true);
  await h.click({ fx: 'ckTodos' });
  check('ckTodos alterna de volta', h.mod.state.fx.ckTodos === false);
  const corpoChk = () => h.el('fx-chk-corpo').innerHTML;
  check('o Checklist é uma lista só no desenho novo: progresso, origens, etiqueta Geral e o ícone de editar em cada passo', /fx-ck-top/.test(corpoChk()) && (corpoChk().match(/data-fx="ckOrigem"/g) || []).length === 3 && /class="fx-cp ger">Geral/.test(corpoChk()) && /data-caso="ed-chk"/.test(corpoChk()) && !/fx-pasta|Pasta do Drive dela/.test(corpoChk()));
  await h.click({ fx: 'ckOrigem', v: 'dela' });
  check('"Só dela" esconde os passos gerais', h.mod.state.fx.ckOrigem === 'dela' && !/Gerais da démarche/.test(corpoChk()));
  await h.click({ fx: 'ckOrigem', v: 'todos' });
  check('"Todos" volta a mostrar os gerais', /Gerais da démarche/.test(corpoChk()));
  await h.click({ caso: 'ed-chk', id: 'k1' });
  check('o ✎ de um passo geral abre o editor do texto dele (ckEd) e o editor aparece no lugar da linha', h.mod.state.fx.ckEd === 'k1' && /data-ckform="k1"/.test(corpoChk()));
  await h.click({ fx: 'ckCancelar' });
  check('Ver mais fechado: sem o resumo do dossiê', !h.el('fx-chk-corpo').innerHTML.includes('Checklist e cliques'));
  await h.click({ fx: 'ckMais' });
  check('ckMais abre o resto da sessão', h.mod.state.fx.ckMais === true && h.el('fx-chk-corpo').innerHTML.includes('Checklist e cliques'));
  check('atividade recente (ou nenhuma) não mostra o banner de dado velho', !corpo.includes('fx-velho'));
  check('a pasta do Drive é só texto de privacidade', corpo.includes('é privada') && !/docs\.google|drive\.google/.test(corpo));
  h.mod.pararAoVivo();
  // pessoa sem conta e tabela ausente (Review Focus 1 e 2)
  const sc = await carregarCrm({ respostas: base(), store: { crm_ficha_v2: '1' } });
  await abre(sc, pessoa({ user_id: null })); sc.mod.state.fx.tab = 'plataforma'; await sc.mod.renderPessoa();
  check('sem conta: "ainda não entrou no app", sem pílulas e sem erro', sc.el('pessoa-page').innerHTML.includes('Ela ainda não entrou no app') && !sc.el('pessoa-page').innerHTML.includes('data-fx="dem"'));
  sc.mod.pararAoVivo();
  const er = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, checklist_items: { data: null, error: { message: 'relation "checklist_items" does not exist' } } }), store: { crm_ficha_v2: '1' } });
  await abre(er, pessoa({ user_id: 'u1' }));
  check('tabela ausente: aviso do db/crm-checklist.sql e nada quebra', er.el('pessoa-page').innerHTML.includes('db/crm-checklist.sql') && !er.el('pessoa-page').innerHTML.includes('data-fx="dem"'));
  er.mod.pararAoVivo();
}

console.log('== Task 12: sessões em pílulas ==');
{
  const mk = async (store) => {
    const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null } }), store: Object.assign({ crm_ficha_v2: '1' }, store) });
    await abre(h, pessoa({ user_id: 'u1' })); return h;
  };
  let h = await mk({});
  let pg = h.el('pessoa-page').innerHTML;
  check('Plataforma tem as pílulas "Ir para" de todas as sessões (o Dossiê virou aba) e nenhum dropdown de sessão', ['home', 'chat', 'checklist', 'espaco', 'perfil', 'eu', 'bilan', 'hist'].every((id) => pg.includes('data-fx="ir" data-id="' + id + '"')) && !pg.includes('data-id="dossie"') && !/data-fx="sessao"|fx-sess-cab|fx-grupo/.test(pg));
  check('só o Checklist abre por padrão, como página inteira; as outras sessões e o dossiê não estão na página', pg.includes('id="fx-chk-corpo"') && /class="fx-pagina[^"]*" data-sessao="checklist"/.test(pg) && (pg.match(/<section class="fx-pagina /g) || []).length === 1 && !pg.includes('id="dossie-box"') && !pg.includes('id="int-box"') && !pg.includes('id="chat-box"'));
  check('sem o SQL da home, a sessão pede o crm-caso-home.sql (e não quebra)', pg.includes('Página inicial'));
  // sessão fechada: o repaint ao vivo do dossiê não lança
  let ok = true; try { h.mod.pintaDossie(h.mod.byC('c1')); } catch (e) { ok = false; }
  check('fora da aba Dossiê, pintaDossie não lança', ok);
  check('a barra de abas tem Dossiê ao lado de Ficha', pg.indexOf('data-v="ficha"') > 0 && pg.indexOf('data-v="ficha"') < pg.indexOf('data-v="dossie"'));
  await h.click({ fx: 'tab', v: 'dossie' });
  const dz = h.el('pessoa-page').innerHTML;
  check('a aba Dossiê abre o dossiê sempre aberto, sem botão de fechar', dz.includes('id="dossie-box"') && dz.includes('data-dossalvar') && !dz.includes('data-dostoggle'));
  // A ligação em 3 etapas, uma por vez
  check('a ligação tem as 3 etapas, com a 1ª aberta (só ela renderiza)', (dz.match(/data-fx="lgPasso"/g) || []).length === 3 && dz.includes('aria-current="step"') && !dz.includes('id="pc-an"'));
  await h.click({ fx: 'lgPasso', v: 'b' });
  const dzb = h.el('fx-corpo').innerHTML;   check('"Depois do 1:1" junta a análise e a montagem', dzb.includes('id="pc-an"') && h.mod.state.fx.lgPasso === 'b');
  await h.click({ fx: 'lgPasso', v: 'c' });
  check('"O que sai da conversa" mostra o e-mail e o .md', h.el('fx-corpo').innerHTML.includes('data-convabrir') && h.el('fx-corpo').innerHTML.includes('data-dosmd'));
  await h.click({ fx: 'lgPasso', v: 'a' });
  await h.mod.renderPessoa(); pg = h.el('pessoa-page').innerHTML;
  check('depois de repintar tudo, a aba Dossiê segue aberta', h.mod.state.fx.tab === 'dossie' && pg.includes('id="dossie-box"'));
  await h.click({ fx: 'tab', v: 'plataforma' });
  check('de volta à Plataforma, o dossiê não aparece lá', !h.el('pessoa-page').innerHTML.includes('id="dossie-box"'));
  const abreIr = async (id) => { await h.click({ fx: 'ir', id }); return h.el('fx-corpo').innerHTML; };
  const tHist = await abreIr('hist'), tBilan = await abreIr('bilan'), tChat = await abreIr('chat'), tEsp = await abreIr('espaco');
  check('cada pílula abre a sessão inteira, com os painéis existentes, uma por vez', tHist.includes('id="int-box"') && !tHist.includes('id="bilan-box"') && tBilan.includes('id="bilan-box"') && !tBilan.includes('id="int-box"') && tChat.includes('id="chat-box"') && !tChat.includes('id="bilan-box"'));
  check('clicar de novo na pílula da página aberta não fecha nada', (await abreIr('espaco')).includes('Seu espaço') && h.mod.state.fx.sessao === 'espaco');
  check('a sessão Espaço (como o Início dela) não carrega as notas nem outras sessões', tEsp.includes('Seu espaço') && !tEsp.includes('data-sessao="inicio"') && !tEsp.includes('data-sessao="guias"') && !tEsp.includes('id="ins-box"') && !tEsp.includes('Escreva uma nota para ela'));
  // Espaço refeito: só perguntas (carrossel), bilans, encaminhamentos e mensagens prontas; checklist e guias têm pílula própria
  check('o Espaço tem as quatro seções novas e não tem mais Checklist nem Guias', ['Perguntas da equipe Por Dentro', 'Bilans das nossas conversas', 'Encaminhamentos da Ingryd', 'Mensagens prontas'].every((t) => tEsp.includes(t)) && !tEsp.includes('>Checklist</span>') && !/<span>Guias<\/span>/.test(tEsp));
  check('a pílula Guias existe, depois do Espaço', h.el('pessoa-page').innerHTML.indexOf('data-fx="ir" data-id="guias"') > h.el('pessoa-page').innerHTML.indexOf('data-fx="ir" data-id="espaco"'));
  const tGuias = await abreIr('guias');
  check('a sessão Guias abre a página própria dos guias', tGuias.includes('Guias') && h.mod.state.fx.sessao === 'guias');
  const tChat2 = await abreIr('chat');
  check('o chat tem o dropdown "Interações" com os botões de proposta e o "+ Criar meu botão"', tChat2.includes('>Interações<') && tChat2.includes('id="chat-drop"') && tChat2.includes('+ Criar meu botão') && tChat2.includes('Propor 1:1 de 20 min') && !tChat2.includes('no avatar que flutua'));
  await abreIr('espaco');
  // carrossel: um card por vez, na ordem; setas e pontos trocam; "Ordem e saída" lista todos
  const cid = h.mod.state.sel;
  h.mod.state.caso = { cid, err: false, ach: [], aco: [], itens: [], consent: true, escolasDela: [], listas: [], home: [], ed: null, agenda: null,
    avs: [{ id: 1, tipo: 'pergunta', titulo: 'Qual é o seu nível de francês hoje?', estado: 'agendado', ordem: 1, pausa_dias: 1, liberar_em: null }, { id: 2, tipo: 'pergunta', titulo: 'Ela prioriza escola pública ou privada?', estado: 'rascunho', ordem: 2, pausa_dias: 0 }, { id: 3, tipo: 'proposta', titulo: 'O bilan está aqui', estado: 'cancelado', ordem: 3, pausa_dias: 0 }] };
  await h.click({ fx: 'ir', id: 'espaco' });
  let car = h.el('fx-corpo').innerHTML;
  check('o carrossel mostra só o 1º card, com "1 de 2" (o cancelado fica fora) e o relógio', car.includes('1 de 2') && car.includes('nível de francês') && !/fxp-big[^>]*>[^<]*escola pública/.test(car) && car.includes('fxp-relogio') && car.includes('data-caso="ag-abrir"'));
  await h.click({ fx: 'perProx' });
  car = h.el('fx-corpo').innerHTML;
  check('a seta troca para o 2º card; no último a seta de próximo desliga', car.includes('2 de 2') && car.includes('escola pública ou privada') && /data-fx="perProx"[^>]*disabled/.test(car));
  // Reordenar perguntas: só o que ainda não saiu é arrastável; o banco decide (crm_aviso_reordenar)
  const avsBase = h.mod.state.caso.avs.map((a) => ({ ...a })), cidB = h.mod.state.sel;
  const injeta = async (home) => { await new Promise((r) => setTimeout(r, 40)); h.mod.state.caso = { cid: cidB, err: false, ach: [], aco: [], itens: [], consent: true, escolasDela: [], listas: [], home, homeSemDestaque: false, ed: null, agenda: null, avs: avsBase.map((a) => ({ ...a })) }; };
  await h.click({ fx: 'perIr', v: '0' });
  const ordemH = h.el('fx-corpo').innerHTML;
  check('em "Ordem e saída" cada card pendente tem alça de arrastar e ▲ ▼', (ordemH.match(/class="fx-ordem-l[^"]*mexe"[^>]*draggable="true"/g) || []).length === 2 && ordemH.includes('data-fx="perMov"'));
  await h.click({ fx: 'perMov', id: '1', d: '1' });
  const rr = h.rpcs.filter((r) => r.n === 'crm_aviso_reordenar');
  check('▼ no 1º card chama crm_aviso_reordenar com a nova ordem dos pendentes ([2, 1])', rr.length === 1 && JSON.stringify(rr[0].a.p_ids) === '[2,1]' && rr[0].a.p_contato === h.mod.state.sel);
  h.rpcs.length = 0;
  await h.click({ fx: 'perMov', id: '1', d: '-1' });
  check('▲ no que já é o 1º não faz nada (nenhuma chamada ao banco)', !h.rpcs.some((r) => r.n === 'crm_aviso_reordenar'));
  // O item em destaque da Página inicial
  const HOME2 = [{ id: 1, categoria: 'checklist', step_key: 'k1', board_id: null, ordem: 0, destaque: true }, { id: 2, categoria: 'checklist', step_key: 'k2', board_id: null, ordem: 1, destaque: false }];
  h.mod.state.dos.chk = { itens: [{ step_key: 'k1', label: 'Passo 1', status: 'pendente' }, { step_key: 'k2', label: 'Passo 2', status: 'pendente' }] };
  await injeta(HOME2);
  await h.click({ fx: 'ir', id: 'home' });
  const hm = h.el('fx-corpo').innerHTML;
  check('a Página inicial mostra "Em destaque 1 de 1" com o passo marcado e ★ Destacar no outro', hm.includes('Em destaque') && hm.includes('1 de 1') && hm.includes('Tirar destaque') && /data-fx="homeDestaque" data-id="k2"[^>]*>★ Destacar/.test(hm));
  h.rpcs.length = 0;
  await h.click({ fx: 'homeDestaque', id: 'k2' });
  const rd = h.rpcs.filter((r) => r.n === 'crm_home_destacar');
  check('★ Destacar chama crm_home_destacar com o passo (e tirar o destaque manda null)', rd.length === 1 && rd[0].a.p_step_key === 'k2');
  await injeta(HOME2); h.rpcs.length = 0; await h.click({ fx: 'homeDestaque', id: 'k1' });
  check('no que já é o destaque, o clique limpa (p_step_key null)', h.rpcs.some((r) => r.n === 'crm_home_destacar' && r.a.p_step_key === null));
  await injeta(HOME2); h.mod.state.caso.homeSemDestaque = true; await h.click({ fx: 'ir', id: 'home' });
  check('sem o SQL do destaque, a home avisa qual arquivo rodar', h.el('fx-corpo').innerHTML.includes('crm-caso-home-destaque.sql'));
  await injeta([]);
  // Curadoria como fila de aprovação (chegou da montagem)
  const avsOrig = h.mod.state.caso.avs; h.mod.state.caso.avs = [];
  await h.click({ fx: 'ir', id: 'curadoria' });
  let cf = h.el('fx-corpo').innerHTML;
  check('a Curadoria sem nada pendente explica como chegar lá a partir do Dossiê', cf.includes('Nada esperando a sua decisão') && cf.includes('data-v="dossie"'));
  h.mod.state.caso.itens = [{ id: 11, tipo: 'documento', titulo: 'Contrato de au pair', estado: 'proposto', dados: { direcao: 'pede' } }, { id: 12, tipo: 'documento', titulo: 'Fonte oficial do visto', estado: 'proposto', dados: { direcao: 'recebe' } }, { id: 13, tipo: 'modelo', titulo: 'Como pedir o atestado', estado: 'proposto', dados: {} }, { id: 14, tipo: 'documento', titulo: 'Já publicado', estado: 'publicado', dados: { direcao: 'recebe' } }];
  h.mod.state.caso.avs = [{ id: 21, tipo: 'pergunta', titulo: 'Qual a data de chegada?', estado: 'rascunho', ordem: 1, pausa_dias: 0 }];
  await h.click({ fx: 'ir', id: 'curadoria' });
  cf = h.el('fx-corpo').innerHTML;
  check('a fila reúne, por destino, só o que espera decisão (o publicado fica de fora)', cf.includes('Documentos a preparar') && cf.includes('Contrato de au pair') && cf.includes('Perguntas da equipe') && cf.includes('Qual a data de chegada?') && cf.includes('Encaminhamentos da Ingryd') && cf.includes('Fonte oficial do visto') && cf.includes('Mensagens prontas') && cf.includes('Como pedir o atestado') && !cf.includes('Já publicado') && cf.includes('4 itens esperam'));
  check('sem montagem proposta carregada não há "Aprovar tudo" (aprova-se item por item)', !cf.includes('data-montaprovar'));
  h.mod.state.caso.avs = avsOrig; h.mod.state.caso.itens = [];
  await h.click({ fx: 'ir', id: 'espaco' });
  await h.click({ fx: 'perIr', v: '0' });
  check('o ponto volta ao 1º card e "Ordem e saída" lista os dois', h.el('fx-corpo').innerHTML.includes('1 de 2') && h.el('fx-corpo').innerHTML.includes('Ordem e saída · 2 cards'));
  // preferência salva volta ao abrir de novo; preferência inválida volta ao padrão
  h = await mk({ crm_ficha_ord_v2: JSON.stringify({ app: ['checklist', 'chat'], ela: ['hist'] }) });
  pg = h.el('pessoa-page').innerHTML;
  const pos = (t, id) => t.indexOf('data-fx="ir" data-id="' + id + '"');
  check('a ordem salva é a das pílulas, completada com o que faltava', pos(pg, 'checklist') < pos(pg, 'chat') && pos(pg, 'chat') < pos(pg, 'espaco') && pos(pg, 'hist') < pos(pg, 'bilan'));
  h.mod.pararAoVivo();
  h = await mk({ crm_ficha_ord_v2: '{lixo' });
  pg = h.el('pessoa-page').innerHTML;
  check('ordem inválida volta ao padrão das pílulas', pos(pg, 'curadoria') < pos(pg, 'home') && pos(pg, 'espaco') < pos(pg, 'chat') && pos(pg, 'home') < pos(pg, 'chat'));
  h.mod.pararAoVivo();
  // localStorage indisponível: a ficha abre e trocar de sessão pela pílula funciona sem lançar
  const hb = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null } }), search: '?ficha=2', storageBloqueado: true });
  let lancou = false;
  try { await abre(hb, pessoa({ user_id: 'u1' })); await hb.click({ fx: 'ir', id: 'chat' }); await hb.click({ fx: 'tourFechar' }); } catch (e) { lancou = true; }
  check('com localStorage bloqueado nada lança e a pílula troca a página', !lancou && hb.mod.state.fx.sessao === 'chat' && hb.el('pessoa-page').innerHTML.includes('id="ficha-v2"'));
  hb.mod.pararAoVivo();
}

console.log('== Task 13: abas Ficha e Conversa ==');
{
  const mailX = { id: 9, modelo: 'x', status: 'enviado', criado_em: new Date().toISOString(), enviado_em: new Date().toISOString(), assunto: 'Oi' };
  const comEtapa = async (etapa) => {
    const user = etapa === 7 ? 'u1' : null;
    const resp = base({ 'contatos:one': { data: { dossie: {}, user_id: user }, error: null }, emails_enviados: { data: etapa === 2 ? [mailX] : [], error: null } });
    const h = await carregarCrm({ respostas: resp, store: { crm_ficha_v2: '1' } });
    await abre(h, pessoa({ user_id: user, estagio: etapa === 4 ? 'um_a_um' : 'lead' })); return h;
  };
  let h = await comEtapa(2);
  await h.click({ fx: 'tab', v: 'ficha' });
  let pg = h.el('pessoa-page').innerHTML;
  check('Ficha, etapa 2: passo 1 destacado', /data-passo="1"[^>]*aria-current="step"/.test(pg) && (pg.match(/aria-current="step"/g) || []).length === 2);   // 1 do fluxo + 1 do funil
  check('Ficha: painéis existentes de jornada e e-mails', pg.includes('class="fx-ficha3"') && pg.includes('Tudo que ela fez') && /Jornada|jornada/.test(pg) && pg.includes('Quem é ela'));
  check('Ficha: perguntas, consentimento, Instagram e anotações seguem na ficha', pg.includes('Consentimento') && pg.includes('id="ig-handle"'));   // a caixa "Suas anotações" (id="nota") não existe mais no artefato aprovado: pendência registrada no PLANO.md
  check('Ficha não traz o Checklist nem as sessões', !pg.includes('data-sessao='));
  h.mod.pararAoVivo();
  h = await comEtapa(4); await h.click({ fx: 'tab', v: 'ficha' });
  check('Ficha, etapa 4: passo 2 destacado', /data-passo="2"[^>]*aria-current="step"/.test(h.el('pessoa-page').innerHTML));
  h.mod.pararAoVivo();
  h = await comEtapa(7); await h.click({ fx: 'tab', v: 'ficha' });
  check('Ficha, etapa 7: passo 3 destacado', /data-passo="3"[^>]*aria-current="step"/.test(h.el('pessoa-page').innerHTML));
  await h.click({ fx: 'tab', v: 'conversa' });
  pg = h.el('pessoa-page').innerHTML;
  check('Conversa reaproveita o painel de e-mail', pg.includes('id="conv-send"') && pg.includes('id="conv-txt"') && !pg.includes('data-sessao='));
  // sem o checklist carregado: skeleton, não erro
  h.mod.state.dos.chk = null; await h.click({ fx: 'tab', v: 'plataforma' });
  pg = h.el('pessoa-page').innerHTML;
  check('sem chk carregado, o Checklist mostra skeleton e o header não diz "sem conta"', pg.includes('class="skel"') && !pg.includes('db/crm-checklist.sql') && !pg.includes('Ela ainda não entrou no app'));
  h.mod.pararAoVivo();
}

console.log('== Task 14: dado velho ==');
{
  const antigo = new Date(Date.now() - 5 * 86400e3).toISOString();
  const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null },
    checklist_items: { data: [{ step_key: 'k1', category: 'Documentação', label: 'Passo', status: 'pendente', due_date: null, sort_order: 1 }], error: null },
    plataforma_cliques: { data: [{ tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Marcou como concluído: Passo', criado_em: antigo }], error: null } }), store: { crm_ficha_v2: '1' } });
  await abre(h, pessoa({ user_id: 'u1' }));
  check('mais de 48 h sem atividade: banner "há 5 dias"', h.el('pessoa-page').innerHTML.includes('Sem atividade dela no checklist há 5 dias'));
  h.mod.pararAoVivo();
}

console.log('== Aba Dossiê: se preenche com o que ela responde no funil ==');
{
  const resp = { apAno: 'primeiro', apPretende: 'migrar', apRecursos: 'nao', apSponsor: 'sim', apCertificado: 'nao', cfNivel: 'l1', cfCidade: 'lyon', cfTeste: 'inventado' };
  const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: { cfNivel: 'master' }, user_id: null }, error: null } }), store: { crm_ficha_v2: '1' } });
  const c = pessoa({ respostas: resp });
  await abre(h, c);
  await h.click({ fx: 'tab', v: 'dossie' });
  await h.click({ fx: 'dosFiltro', v: 'tudo' });   // o padrão é "Só o que falta"; o que veio do funil já conta como respondido
  const pg = h.el('dossie-box').innerHTML;
  const sel = (k, v) => new RegExp('data-k="' + k + '" data-v="' + v + '" aria-pressed="true"').test(pg) || new RegExp('data-dk="' + k + '"[^>]*>(?:(?!</select>).)*<option value="' + v + '" selected', 's').test(pg);
  check('ano de au pair, intenção (migrar → migrar_estudante) e sim/não vêm do funil', sel('ano_au_pair', 'primeiro') && sel('intencao_au_pair', 'migrar_estudante') && sel('comprova_recursos', 'false') && sel('tem_sponsor', 'true') && sel('tem_certificado_matricula', 'false'));
  check('a cidade do funil entra como texto legível', pg.includes('data-dk="cidade"') && pg.includes('value="Lyon"'));
  // Formulário do Dossiê: grupos recolhíveis, filtros e fonte de cada resposta
  check('os blocos viram grupos recolhíveis e só o 1º vem aberto', (pg.match(/<details class="fg-d"/g) || []).length >= 3 && (pg.match(/<details class="fg-d"[^>]*open/g) || []).length === 1);
  check('a faixa de fontes conta as respostas por origem (funil)', /data-v="funil"[^>]*>Funil<small>[1-9]/.test(pg));
  await h.click({ fx: 'dosFonte', v: 'funil' });
  const soFunil = h.el('dossie-box').innerHTML;
  check('filtrar por fonte "Funil" mostra só campos respondidos pelo funil', soFunil.includes('data-dk="cidade"') && !soFunil.includes('data-dk="telefone"') && !/class="ds (call|voce)"/.test(soFunil));
  await h.click({ fx: 'dosFiltro', v: 'falta' });
  const soFalta = h.el('dossie-box').innerHTML;
  check('"Só o que falta" esconde o que já está respondido (cidade veio do funil)', !soFalta.includes('data-dk="cidade"') && soFalta.includes('data-dk="telefone"'));
  await h.click({ fx: 'dosChip', k: 'fase', v: 'adaptando' });
  check('um toque num chip grava a resposta (e outro toque desmarca)', h.mod.state.dos.rasc.fase === 'adaptando' && /data-fx="dosChip" data-k="fase" data-v="adaptando" aria-pressed="true"/.test(h.el('dossie-box').innerHTML) && h.el('dossie-box').innerHTML.includes('fx-salvar'));
  await h.click({ fx: 'dosChip', k: 'fase', v: 'adaptando' });
  check('tocar de novo no mesmo chip limpa a resposta', h.mod.state.dos.rasc.fase === '');
  await h.click({ fx: 'dosFiltro', v: 'tudo' });
  // Divergência funil × dossiê: "Usar o do funil" ou "Manter o do dossiê"
  h.mod.state.dos.d = { ...(h.mod.state.dos.d || {}), ano_au_pair: 'segundo' };
  await h.click({ fx: 'lgPasso', v: 'a' });
  const divH = h.el('fx-corpo').innerHTML;
  check('a divergência do ano de au pair (funil: primeiro, dossiê: segundo) ganha os botões de resolver', divH.includes('data-fx="dosUsa" data-k="ano_au_pair" data-v="funil"') && divH.includes('data-fx="dosUsa" data-k="ano_au_pair" data-v="dossie"'));
  await h.click({ fx: 'dosUsa', k: 'ano_au_pair', v: 'funil' });
  check('"Usar o do funil" põe o valor do funil no formulário (para salvar)', h.mod.state.dos.rasc.ano_au_pair === 'primeiro');
  delete h.mod.state.dos.rasc.ano_au_pair;
  await h.click({ fx: 'dosUsa', k: 'ano_au_pair', v: 'dossie' });
  await h.click({ fx: 'lgPasso', v: 'a' });
  check('"Manter o do dossiê" tira a divergência da lista', !h.el('fx-corpo').innerHTML.includes('data-fx="dosUsa" data-k="ano_au_pair"') && h.mod.state.dos.rasc.ano_au_pair === undefined);
  check('o que já está no dossiê ganha do funil (cfNivel: master, não l1)', h.mod.dosValor(c, { cfNivel: 'master' }, {}, 'cfNivel') === 'master' && h.mod.dosValor(c, {}, {}, 'cfNivel') === 'l1');
  check('valor que o formulário não conhece é ignorado (cfTeste "inventado")', !sel('cfTeste', 'inventado') && h.mod.dosDoFunil(c, 'cfTeste') === null);
  check('campo vindo do funil traz a etiqueta de fonte e o dossiê conta como respondido', pg.includes('Veio do funil') && pg.includes('class="ds funil"') && h.mod.dosProgresso(c, {}, {}).n >= 6);
  check('o que você apagou no formulário não volta do funil', h.mod.dosValor(c, {}, { ano_au_pair: '' }, 'ano_au_pair') === '');
  h.mod.pararAoVivo();
}
console.log('== Aba Dossiê: atualização ao vivo ==');
{
  const h = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null } }), store: { crm_ficha_v2: '1' } });
  await abre(h, pessoa({ user_id: 'u1', respostas: {} }));
  await h.click({ fx: 'tab', v: 'dossie' });
  check('antes: ano de au pair sem resposta', !/data-dk="ano_au_pair"[^>]*>(?:(?!<\/select>).)*selected/s.test(h.el('pessoa-page').innerHTML));
  h.respostas['contatos:one'] = { data: { dossie: {}, respostas: { apAno: 'segundo' }, user_id: 'u1' }, error: null };
  await h.mod.atualizaAoVivo('c1');
  check('ela responde no funil: o state do dossiê e a pessoa recebem a resposta sem recarregar a página', h.mod.byC('c1').respostas.apAno === 'segundo' && h.mod.dosValor(h.mod.byC('c1'), h.mod.state.dos.d, {}, 'ano_au_pair') === 'segundo');
  h.mod.pararAoVivo();
}

console.log('== Cabeçalho fixo por tipo de pessoa ==');
{
  const agora = Date.now(), iso = (dias, seg = 0) => new Date(agora - dias * 864e5 + seg * 1000).toISOString();
  const cliques = [].concat(...['a', 'b', 'c'].map((sid, i) => [0, 1, 2, 3].map((j) => ({ sessao: sid, tela: 'inicio', alvo: 'x', rotulo: 'x', criado_em: iso(i + 1.5, j * 30) }))));
  const montar = async (user, assinatura) => carregarCrm({ store: { crm_ficha_v2: '1' }, respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: user }, error: null }, plataforma_cliques: { data: cliques, error: null },
    'assinaturas:one': { data: assinatura, error: null } }) });
  let h = await montar(null, null);
  let html = await abre(h, pessoa({ user_id: null, dias_sem_sinal: 6 }));
  check('lead: tem Parada há e Próximo e-mail, e não tem uso nem pagamento', html.includes('>Entrou<') && html.includes('nenhum enviado') && !html.includes('Cliques por sessão') && !html.includes('Último acesso') && !html.includes('Assinatura ativa'));   // cabeçalho minimalista do lead: Entrou e E-mail
  h.mod.pararAoVivo();
  h = await montar('u1', { status: 'active', plano: 'Intermediário', periodo_fim: new Date(agora + 5 * 864e5).toISOString(), cancela_no_fim: false, criado_em: iso(95) });
  html = await abre(h, pessoa({ user_id: 'u1' }));
  check('assinante: Pagamento, Plano, Assinatura ativa e o uso (sessões e cliques por sessão)', html.includes('Intermediário') && html.includes('Assinatura ativa') && html.includes('Sessões (30 dias)') && html.includes('Cliques por sessão') && html.includes('Duração estimada') && html.includes('Último acesso'));   // o plano abre um dropdown com os detalhes
  check('assinante: 3 sessões de 4 cliques → 4 cliques por sessão', /Sessões \(30 dias\)<\/dt><dd>3</.test(html) && /Cliques por sessão<\/dt><dd>4</.test(html));
  h.mod.pararAoVivo();
  h = await montar('u2', null);
  html = await abre(h, pessoa({ user_id: 'u2' }));
  check('conta sem assinatura é lead: Entrou, sem plano nem uso', html.includes('>Entrou<') && !html.includes('Assinatura ativa') && !html.includes('Sessões (30 dias)'));
  h.mod.pararAoVivo();
  h = await montar('u3', { status: 'canceled', plano: 'Básico', periodo_fim: iso(1), cancela_no_fim: false, criado_em: iso(200) });
  html = await abre(h, pessoa({ user_id: 'u3' }));
  check('assinatura cancelada nunca aparece como ativa', !html.includes('Assinatura ativa') && html.includes('Cancelada'));
  h.mod.pararAoVivo();
  h = await montar(null, null);
  html = await abre(h, pessoa({ user_id: null, nome: '<img src=x onerror=alert(1)>', dias_sem_sinal: null }));
  check('nome com HTML sai escapado no cabeçalho e na fila; o texto "sem atividade registrada" saiu do cabeçalho minimalista', !html.includes('<img src=x') && html.includes('&lt;img'));
  h.mod.pararAoVivo();
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
