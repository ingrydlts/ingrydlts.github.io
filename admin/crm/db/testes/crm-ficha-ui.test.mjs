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
  check('renderiza fila, header, abas e carrossel', html.includes('class="fx-fila"') && html.includes('class="fx-head"') && html.includes('class="fx-abas"') && html.includes('class="fx-car"'));
  check('sem conta: abre na aba Ficha', /data-v="ficha"[^>]*aria-selected="true"/.test(html) && !/data-v="plataforma"[^>]*aria-selected="true"/.test(html));
  check('1º cartão é "Responder Ana"', /data-fx="agAbrir" data-i="0"[^>]*aria-label="Ação 1 de \d: Responder Ana\./.test(html));
  const fila1 = (html.match(/class="fx-fprox">([^<]*)</) || [])[1];
  check('o 1º item da fila mostra o mesmo texto do 1º cartão', fila1 === 'Responder Ana');
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
  check('agIr leva à Plataforma, abre a sessão e fecha o pop-up', h.mod.state.fx.tab === 'plataforma' && h.mod.state.fx.abertas.chat === true && h.mod.state.fx.ag.pop === null);
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
  check('com conta: header sem o aviso de "sem conta"', !html.includes('Sem conta</span>') && html.includes('No app'));
  h.mod.pararAoVivo();
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
  check('Ver mais fechado: sem o resumo do dossiê', !h.el('fx-chk-corpo').innerHTML.includes('Checklist e cliques'));
  await h.click({ fx: 'ckMais' });
  check('ckMais abre o resto da sessão', h.mod.state.fx.ckMais === true && h.el('fx-chk-corpo').innerHTML.includes('Checklist e cliques'));
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

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
