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
  check('a fila é uma linha de chips: a pessoa aberta está destacada e o texto da ação não repete na fila', html.includes('mf-i atual') && !/class="mf[^"]*"[^>]*>[^<]*Responder Ana/.test(html.split('class="hd"')[0].split('class="fx-fila mf"')[1] || ''));
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
  check('Plataforma tem os dois grupos e as 6 sessões', pg.includes('Acompanhar o app dela') && pg.includes('Conhecer e registrar') && ['chat', 'inicio', 'checklist', 'bilan', 'dossie', 'hist'].every((id) => pg.includes('data-sessao="' + id + '"')));
  check('só o Checklist abre por padrão; dossiê fechado não está na página', pg.includes('id="fx-chk-corpo"') && !pg.includes('id="dossie-box"') && !pg.includes('id="int-box"') && !pg.includes('id="chat-box"'));
  check('ordem padrão: chat, início, checklist', pg.indexOf('data-sessao="chat"') < pg.indexOf('data-sessao="inicio"') && pg.indexOf('data-sessao="inicio"') < pg.indexOf('data-sessao="checklist"'));
  // sessão fechada: o repaint ao vivo do dossiê não lança
  let ok = true; try { h.mod.pintaDossie(h.mod.byC('c1')); } catch (e) { ok = false; }
  check('com a sessão fechada, pintaDossie não lança', ok);
  await h.click({ fx: 'sessao', id: 'dossie' });
  check('sessao abre o dossiê dentro da pílula', h.mod.state.fx.abertas.dossie === true && h.el('fx-corpo').innerHTML.includes('id="dossie-box"'));
  await h.mod.renderPessoa(); pg = h.el('pessoa-page').innerHTML;
  check('depois de repintar tudo, o dossiê segue aberto', pg.includes('id="dossie-box"'));
  await h.click({ fx: 'sessao', id: 'dossie' });
  check('sessao de novo fecha', h.mod.state.fx.abertas.dossie === false && !h.el('fx-corpo').innerHTML.includes('id="dossie-box"'));
  await h.click({ fx: 'sessao', id: 'hist' }); await h.click({ fx: 'sessao', id: 'bilan' }); await h.click({ fx: 'sessao', id: 'chat' }); await h.click({ fx: 'sessao', id: 'inicio' });
  const tudo = h.el('fx-corpo').innerHTML;
  check('todas as sessões abrem com os painéis existentes', tudo.includes('id="int-box"') && tudo.includes('id="bilan-box"') && tudo.includes('id="chat-box"') && tudo.includes('id="ins-box"'));
  await h.click({ fx: 'mover', id: 'chat', d: '1' });
  check('mover troca a ordem e grava crm_ficha_ord_v1', h.mod.state.fx.ord.app.join() === 'inicio,chat,checklist' && JSON.parse(h.store.crm_ficha_ord_v1).app.join() === 'inicio,chat,checklist');
  await h.click({ fx: 'mover', id: 'inicio', d: '-1' });
  check('mover para cima na ponta não muda', h.mod.state.fx.ord.app.join() === 'inicio,chat,checklist');
  // arrastar
  const ev = (g, s) => ({ target: { closest: (sel) => (sel === '.fx-grab' ? g : sel === '.fx-sess' ? s : null) }, dataTransfer: { setData() {} }, preventDefault() {} });
  const chamar = async (tipo, e) => { for (const fn of h.handlers[tipo] || []) await fn(e); };
  await chamar('dragstart', ev({ dataset: { area: 'app', id: 'inicio' } }, null));
  await chamar('drop', ev(null, { dataset: { area: 'app', sessao: 'checklist' } }));
  check('arrastar para baixo cai depois do alvo', h.mod.state.fx.ord.app.join() === 'chat,checklist,inicio');
  await chamar('dragstart', ev({ dataset: { area: 'app', id: 'inicio' } }, null));
  await chamar('drop', ev(null, { dataset: { area: 'app', sessao: 'chat' } }));
  check('arrastar para cima cai antes do alvo', h.mod.state.fx.ord.app.join() === 'inicio,chat,checklist');
  await chamar('dragstart', ev({ dataset: { area: 'app', id: 'chat' } }, null));
  await chamar('drop', ev(null, { dataset: { area: 'ela', sessao: 'bilan' } }));
  check('arrastar para outro grupo é ignorado', h.mod.state.fx.ord.app.join() === 'inicio,chat,checklist' && h.mod.state.fx.ord.ela.join() === 'bilan,dossie,hist' && h.mod.state.fx.drag === null);
  h.mod.pararAoVivo();
  // preferência salva volta ao abrir de novo; preferência inválida volta ao padrão
  h = await mk({ crm_ficha_ord_v1: JSON.stringify({ app: ['checklist', 'chat'], ela: ['hist'] }) });
  pg = h.el('pessoa-page').innerHTML;
  check('a ordem salva é aplicada e completada com o que faltava', pg.indexOf('data-sessao="checklist"') < pg.indexOf('data-sessao="chat"') && pg.indexOf('data-sessao="chat"') < pg.indexOf('data-sessao="inicio"') && pg.indexOf('data-sessao="hist"') < pg.indexOf('data-sessao="bilan"'));
  h.mod.pararAoVivo();
  h = await mk({ crm_ficha_ord_v1: '{lixo' });
  pg = h.el('pessoa-page').innerHTML;
  check('ordem inválida volta ao padrão', pg.indexOf('data-sessao="chat"') < pg.indexOf('data-sessao="inicio"'));
  h.mod.pararAoVivo();
  // localStorage indisponível (Review Focus 5): a ficha abre, mover e fechar o guia funcionam na tela sem lançar
  const hb = await carregarCrm({ respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null } }), search: '?ficha=2', storageBloqueado: true });
  let lancou = false;
  try { await abre(hb, pessoa({ user_id: 'u1' })); await hb.click({ fx: 'mover', id: 'chat', d: '1' }); await hb.click({ fx: 'tourFechar' }); } catch (e) { lancou = true; }
  check('com localStorage bloqueado nada lança e a ordem muda na tela', !lancou && hb.mod.state.fx.ord.app.join() === 'inicio,chat,checklist' && hb.el('pessoa-page').innerHTML.includes('id="ficha-v2"'));
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
  check('Ficha: perguntas, consentimento, Instagram e anotações seguem na ficha', pg.includes('Consentimento') && pg.includes('id="ig-handle"') && pg.includes('id="nota"'));
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

console.log('== Cabeçalho fixo por tipo de pessoa ==');
{
  const agora = Date.now(), iso = (dias, seg = 0) => new Date(agora - dias * 864e5 + seg * 1000).toISOString();
  const cliques = [].concat(...['a', 'b', 'c'].map((sid, i) => [0, 1, 2, 3].map((j) => ({ sessao: sid, tela: 'inicio', alvo: 'x', rotulo: 'x', criado_em: iso(i + 1.5, j * 30) }))));
  const montar = async (user, assinatura) => carregarCrm({ store: { crm_ficha_v2: '1' }, respostas: base({ 'contatos:one': { data: { dossie: {}, user_id: user }, error: null }, plataforma_cliques: { data: cliques, error: null },
    'assinaturas:one': { data: assinatura, error: null } }) });
  let h = await montar(null, null);
  let html = await abre(h, pessoa({ user_id: null, dias_sem_sinal: 6 }));
  check('lead: tem Parada há e Próximo e-mail, e não tem uso nem pagamento', html.includes('Parada há') && html.includes('Próximo e-mail') && !html.includes('Cliques por sessão') && !html.includes('class="tag">Pagamento<') && html.includes('Não assina'));
  h.mod.pararAoVivo();
  h = await montar('u1', { status: 'active', plano: 'Intermediário', periodo_fim: new Date(agora + 5 * 864e5).toISOString(), cancela_no_fim: false, criado_em: iso(95) });
  html = await abre(h, pessoa({ user_id: 'u1' }));
  check('assinante: Pagamento, Plano, Assinatura ativa e o uso (sessões e cliques por sessão)', html.includes('class="tag">Pagamento<') && html.includes('Intermediário') && html.includes('Assinatura ativa') && html.includes('Sessões') && html.includes('Cliques por sessão') && html.includes('Duração (estimada)'));
  check('assinante: 3 sessões de 4 cliques → 4 cliques por sessão; nota sobre LTV', html.includes('>4<') && html.includes('LTV'));
  h.mod.pararAoVivo();
  h = await montar('u2', null);
  html = await abre(h, pessoa({ user_id: 'u2' }));
  check('na plataforma sem assinar: Não assina, Sessões e sem bloco Pagamento', html.includes('Não assina') && html.includes('Sessões') && !html.includes('class="tag">Pagamento<'));
  h.mod.pararAoVivo();
  h = await montar('u3', { status: 'canceled', plano: 'Básico', periodo_fim: iso(1), cancela_no_fim: false, criado_em: iso(200) });
  html = await abre(h, pessoa({ user_id: 'u3' }));
  check('assinatura cancelada nunca aparece como ativa', !html.includes('Assinatura ativa') && html.includes('Cancelada'));
  h.mod.pararAoVivo();
  h = await montar(null, null);
  html = await abre(h, pessoa({ user_id: null, nome: '<img src=x onerror=alert(1)>', dias_sem_sinal: null }));
  check('nome com HTML sai escapado no cabeçalho e na fila; sem dias_sem_sinal mostra traço', !html.includes('<img src=x') && html.includes('&lt;img') && html.includes('sem atividade registrada'));
  h.mod.pararAoVivo();
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
