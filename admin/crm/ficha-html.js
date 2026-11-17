// Ficha-universo, fase 1: HTML puro das peças novas. Todas recebem h = { esc, fmtDay } e escapam todo texto vindo do banco.
import { ETAPAS_FUNIL, maisUrgentes } from './ficha.js?v=2026-11-17.8';   // o ?v= acompanha o de crm.js (cache do navegador)


const URG = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const ABAS = [['conversa', 'E-mail'], ['plataforma', 'Plataforma'], ['ficha', 'Ficha'], ['dossie', 'Dossiê']];

// ---------- Fila de hoje, header, abas e guia (Task 8) ----------
// itens: [{ c, novas, proxima, sub? }]; selId: id da pessoa aberta.
export function htmlFila(itens, selId, h) {
  const e = h.esc, lista = itens || [];
  if (!lista.length) return '<section class="fx-fila mf" aria-label="Fila de hoje"><span class="mf-t">Fila de hoje</span><span class="sub">Ninguém na fila hoje.</span></section>';
  const urgDe = (c) => ['alta', 'media', 'baixa'].includes(c.urgencia) ? c.urgencia : 'baixa';
  const idx = Math.max(0, lista.findIndex((o) => String((o.c || {}).id) === String(selId)));
  const atual = lista[idx].c || {}, altas = lista.filter((o) => urgDe(o.c || {}) === 'alta').length, novas = lista.reduce((n, o) => n + (o.novas || 0), 0);
  const vai = (o, rot, sinal) => o ? '<button type="button" class="mf-seta" data-fx="pessoa" data-id="' + e((o.c || {}).id) + '" aria-label="' + rot + ': ' + e((o.c || {}).nome || '') + '">' + sinal + '</button>' : '<span class="mf-seta off" aria-hidden="true">' + sinal + '</span>';
  const resumo = lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas') + (altas ? ' · ' + altas + (altas === 1 ? ' urgente' : ' urgentes') : '') + (novas ? ' · ' + novas + (novas === 1 ? ' resposta nova' : ' respostas novas') : '');
  const linhas = lista.map((o) => {
    const c = o.c || {}, aberta = String(c.id) === String(selId), urg = urgDe(c);
    return '<button type="button" class="mf-i' + (aberta ? ' atual' : '') + '" data-fx="pessoa" data-id="' + e(c.id) + '" aria-pressed="' + aberta + '" title="' + e(URG[urg]) + '">' +
      '<span class="mf-d ' + urg + '" aria-hidden="true"></span><span class="mf-corpo"><span class="mf-l1"><span class="mf-nome">' + e(c.nome || c.email || 'Sem nome') + '</span>' +
      (o.novas > 0 ? '<span class="mf-n">' + o.novas + (o.novas === 1 ? ' nova' : ' novas') + '</span>' : '') + '<span class="mf-urg ' + urg + '">' + e(URG[urg]) + '</span></span>' +
      (c.motivo ? '<span class="mf-acao">' + e(c.motivo) + '</span>' : '') + (o.proxima && o.proxima !== 'Abrir a ficha' ? '<span class="mf-motivo">Ação: ' + e(o.proxima) + '</span>' : '') +
      (o.sub ? '<span class="mf-sub">' + e(o.sub) + '</span>' : '') + '</span></button>';
  }).join('');
  return '<section class="fx-fila mf" aria-label="Fila de hoje"><details class="mf-dd"><summary class="mf-sum"><span class="mf-t">Fila de hoje</span>' +
    '<span class="mf-conta">' + e(resumo) + '</span><span class="mf-atual"><span class="mf-d ' + urgDe(atual) + '" aria-hidden="true"></span>' + e(atual.nome || atual.email || 'Sem nome') + '</span><span class="mf-chev" aria-hidden="true">▾</span></summary>' +
    '<div class="mf-menu">' + linhas + '</div></details>' + vai(lista[idx - 1], 'Pessoa anterior da fila', '‹') + vai(lista[idx + 1], 'Próxima pessoa da fila', '›') + '</section>';
}

// Cabeçalho fixo: pessoa, etiqueta de pagamento, ações e cartões por tipo de pessoa (os blocos vêm de FX.cartoesDe).
// d = { c, estagioLabel, personaLabel, temConta, etiqueta: { texto, tom }, estagios: [{k,l}], blocos: [{ titulo|null, cartoes: [{rotulo, valor, sub, tom?}] }], nota|null }
function iniciais(c) {
  const partes = String((c && c.nome) || '').trim().split(/\s+/).filter(Boolean);
  const base = partes.length ? partes.slice(0, 2).map((p) => p.charAt(0)).join('') : String((c && c.email) || '?').charAt(0);
  return base.toUpperCase();
}
export function htmlCabecalho(d, h) {
  const e = h.esc, c = d.c || {}, et = d.etiqueta || { texto: '', tom: 'neutro' };
  const card = (k) => {
    const cls = 'k' + (k.tom === 'alerta' ? ' alerta' : k.tom === 'ok' ? ' ok' : '');
    const corpo = '<b class="l">' + e(k.rotulo) + (k.pill ? ' <span class="pill hd-pill' + (k.pillTom ? ' pt-' + e(k.pillTom) : '') + '">' + e(k.pill) + '</span>' : '') + '</b><div class="v">' + e(k.valor) + '</div>' + (k.sub ? '<div class="s">' + e(k.sub) + '</div>' : '');
    const dl = k.detalhes && k.detalhes.length ? '<dl class="hd-det">' + k.detalhes.map((x) => '<dt>' + e(x[0]) + '</dt><dd>' + e(x[1]) + '</dd>').join('') + '</dl>' : '';
    const fz = k.fazer && k.fazer.length ? '<div class="hd-faz"><b>O que fazer</b><ul>' + k.fazer.map((x) => '<li>' + e(x) + '</li>').join('') + '</ul></div>' : '';
    const ac = k.acao ? '<div class="hd-acao"><b class="hd-acao-k">Próxima ação</b><div class="hd-acao-t">' + e(k.acao.titulo) + ' <span class="pill">' + e(k.acao.canal) + '</span></div><p class="hd-acao-p">' + e(k.acao.porque) + '</p>' +
      '<div class="hd-acao-b">' + (k.acao.texto ? '<button type="button" class="btn" data-fx="copiarTxt" data-txt="' + e(k.acao.texto) + '">Copiar mensagem</button>' : '') + '<button type="button" class="btn" data-fx="tab" data-v="conversa">Abrir a conversa</button></div></div>' : '';
    const ls = k.lista && k.lista.itens.length ? '<div class="hd-faz"><b>' + e(k.lista.titulo) + '</b><ul class="hd-ls">' + k.lista.itens.map((x) => '<li>' + e(x) + '</li>').join('') + '</ul></div>' : '';
    const et = k.etapas ? '<ol class="hd-et" aria-label="Etapas do funil">' + k.etapas.lista.map((nome, i) => {
      const n = i + 1, cls2 = n < k.etapas.atual ? 'done' : n === k.etapas.atual ? 'cur' : 'next';
      return '<li class="' + cls2 + '"' + (n === k.etapas.atual ? ' aria-current="step"' : '') + '><span class="hd-etn">' + (n < k.etapas.atual ? '✓' : n) + '</span>' + e(nome) + '</li>';
    }).join('') + '</ol>' : '';
    if (!dl && !fz && !et && !ls && !ac) return '<div class="' + cls + '">' + corpo + '</div>';
    return '<details name="hd" class="' + cls + ' hd-dd"' + (k.dica ? ' title="' + e(k.dica) + '"' : '') + '><summary>' + corpo + '</summary><div class="hd-pop">' + ac + dl + ls + fz + et + '</div></details>';
  };
  const blocos = (d.blocos || []).map((b) => (b.titulo ? '<span class="tag">' + e(b.titulo) + '</span>' : '') + '<div class="hd-k" style="--n:' + (b.cartoes || []).length + '">' + (b.cartoes || []).map(card).join('') + '</div>').join('');
  // Quem está na plataforma ou assina: um selo só (assinar e "no app" não divergem). Lead sem conta: nenhum selo de conta.
  const conta = et.texto ? '<span class="pill pg-' + e(et.tom) + '">' + e(et.texto) + '</span>' : '';
  return '<header class="hd" id="fx-hd">' +
    '<div class="hd-l1"><span class="hd-av" aria-hidden="true">' + e(iniciais(c)) + '</span><h2 class="hd-n">' + e(c.nome || c.email || 'Sem nome') + '</h2>' +
    (d.estagioLabel ? '<span class="pill"><span class="dot"></span>' + e(d.estagioLabel) + '</span>' : '') +
    (d.personaLabel ? '<span class="pill">' + e(d.personaLabel) + '</span>' : '') + conta +
    (c.id ? '<button type="button" class="btn hd-pag-btn" data-pagar="' + e(c.id) + '" title="Manda o e-mail Link de pagamento. Você revisa a escolha antes de enviar.">' + (d.linkPagamentoEnviado ? 'Reenviar link de pagamento' : 'Enviar link de pagamento') + '</button>' : '') + '</div>' +
    blocos + (d.nota ? '<p class="est">' + e(d.nota) + '</p>' : '') + '</header>';
}

// O funil de conversão (7 etapas), em faixa larga: vive na aba Ficha, logo acima de Jornada, Quem é ela e E-mails.
// d = { etapa (1..7), semCaixa }: com semCaixa devolve só a lista (para entrar dentro do cartão da Jornada, na coluna lateral).
export function htmlFunil(d, h) {
  const e = h.esc, etapa = Math.min(7, Math.max(1, d.etapa || 1));
  const funil = '<ol class="fx-funil" aria-label="Funil de conversão">' + ETAPAS_FUNIL.map((nome, i) => {
    const n = i + 1, cls = n < etapa ? 'done' : n === etapa ? 'cur' : 'next';
    return '<li class="fx-seg ' + cls + '" data-etapa="' + n + '"' + (n === etapa ? ' aria-current="step"' : '') + '><span class="fx-segn">' + n + '</span><span class="fx-segt">' + e(nome) + '</span></li>';
  }).join('') + '</ol>' +
    '<p class="sub fx-funil-txt">Etapa atual: <b>' + e(ETAPAS_FUNIL[etapa - 1]) + '</b>' + (etapa < 7 ? ' · Próxima: ' + e(ETAPAS_FUNIL[etapa]) : '') + '</p>';
  if (d.semCaixa) return '<div class="fx-funil-v" aria-label="Funil de conversão">' + funil + '</div>';
  return '<section class="panel fx-funilbox" aria-label="Funil de conversão"><h4 class="fx-h4">Funil de conversão</h4>' + funil + '</section>';
}

export function htmlAbas(tab, convertida, h) {
  const e = h.esc;
  return '<div class="fx-abas"><div class="ptabs" role="tablist" aria-label="Ficha da pessoa">' + ABAS.map((t) =>
    '<button class="ptab" role="tab" type="button" data-fx="tab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + e(t[1]) +
    (t[0] === 'plataforma' ? ' <span class="fx-selo">' + (convertida ? 'convertida' : 'prévia') + '</span>' : '') + '</button>').join('') +
    '</div><button class="link fx-tour-btn" type="button" data-fx="tourAbrir">Como usar esta tela</button></div>';
}

export function htmlTour(aberto, h) {
  if (!aberto) return '';
  return '<section class="fx-tour" aria-label="Como ler esta tela"><h3 class="fx-h3">Como ler esta tela</h3><ol class="fx-tour-lista">' +
    '<li><b>Fila de hoje</b>: quem precisa de você primeiro. Um clique abre a ficha.</li>' +
    '<li><b>Minhas próximas ações</b>: o que a equipe precisa fazer. Clique num cartão para ver o contexto e ir direto ao lugar certo.</li>' +
    '<li><b>Abas</b>: E-mail (a troca de e-mails, o próximo da fila e os modelos), Plataforma (o app dela), Ficha (captação e onboarding) e Dossiê (as perguntas da plataforma, que se preenchem conforme ela responde).</li>' +
    '<li><b>Sessões</b>: cada uma abre e fecha. Arraste, ou use as setas, para pôr na ordem que preferir.</li></ol>' +
    '<button class="btn" type="button" data-fx="tourFechar">Entendi</button></section>';
}

// ---------- Minhas próximas ações: carrossel e pop-ups ----------
// tarefas: Tarefa[] de FX.tarefasDe; i = índice do primeiro cartão visível (0 por padrão).
// o = { nome, concluidas (n), urgente: [frases] }. Cabeçalho como na Ficha-universo: nome da pessoa, "1 de n", setas, Adicionar e Concluídas.
// O quadro de urgência (o.urgente) só aparece quando há algo que não pode esperar.
const slugTag = (t) => String(t || '').toLowerCase().replace(/\s+/g, '');
export function htmlCarrossel(tarefas, h, i, o) {
  const e = h.esc, ts = tarefas || [], n = ts.length, ini = Math.min(Math.max(0, i || 0), Math.max(0, n - 1)), op = o || {}, urg = op.urgente || [];
  const titulo = 'Minhas próximas ações' + (op.nome ? ' · ' + e(op.nome) : '');
  const quadro = '';   // o quadro vermelho "Precisa de você agora" saiu: o aviso da esquerda já diz isso
  const extra = '<button type="button" class="btn s fx-add" data-fx="agNovo">+ Adicionar</button>' +
    (op.concluidas > 0 ? '<button type="button" class="fx-conc" data-fx="agFeitas">Concluídas (' + op.concluidas + ')</button>' : '');
  const cls = 'fx-acoes' + (urg.length ? ' urg' : '');
  if (!n) return '<section class="' + cls + '" id="fx-acoes" aria-label="Minhas próximas ações">' + quadro + '<div class="fx-acoes-cab"><h3 class="fx-h3">' + titulo + '</h3><div class="fx-acoes-nav">' + extra + '</div></div>' +
    '<p class="sub" style="margin:0">Nenhuma ação pendente. Quando ela responder ou o app perceber algo, aparece aqui. Use Adicionar para anotar uma tarefa sua.</p></section>';
  return '<section class="' + cls + '" id="fx-acoes" aria-label="Minhas próximas ações">' + quadro + '<div class="fx-acoes-cab"><h3 class="fx-h3">' + titulo + '</h3>' +
    '<div class="fx-acoes-nav"><span class="fx-cont" aria-live="polite">' + (ini + 1) + ' de ' + n + '</span>' +
    '<button type="button" class="fx-seta" data-fx="agPrev" aria-label="Ações anteriores"' + (ini <= 0 ? ' disabled' : '') + '>‹</button>' +
    '<button type="button" class="fx-seta" data-fx="agNext" aria-label="Próximas ações"' + (ini >= n - 1 ? ' disabled' : '') + '>›</button>' + extra + '</div></div>' +
    '<div class="fx-car" role="region" aria-roledescription="carrossel" aria-label="Minhas próximas ações" tabindex="0">' + ts.map((t, k) =>
      '<button type="button" class="fx-card' + (k === 0 ? ' first' : '') + '" data-fx="agAbrir" data-i="' + k + '" aria-label="Ação ' + (k + 1) + ' de ' + n + ': ' + e(t.t) + '. Abrir detalhes">' +
      '<span class="fx-n">' + (k + 1) + '</span><span class="fx-t">' + e(t.t) + '</span><span class="fx-tag fx-tag-' + e(slugTag(t.tag)) + '">' + e(t.tag) + '</span></button>').join('') + '</div></section>';
}

// Pop-up de uma ação (i = índice), de "Adicionar" (i = 'add') ou de "Concluídas" (i = 'feitas', com a lista em feitas).
const fundo = '<button type="button" class="fx-pop-bg" data-fx="agFechar" aria-label="Fechar" tabindex="-1"></button>';
export function htmlPopup(tarefas, i, h) {
  const e = h.esc, ts = tarefas || [], n = ts.length;
  if (!n) return '';
  const k = Math.min(Math.max(0, i || 0), n - 1), t = ts[k];
  return fundo +
    '<div class="fx-pop" role="dialog" aria-modal="true" aria-labelledby="fx-pop-t" tabindex="-1">' +
    '<p class="fx-pop-tipo"><span class="fx-tag fx-tag-' + e(slugTag(t.tag)) + '">' + e(t.tag) + '</span> Ação ' + (k + 1) + ' de ' + n + '</p>' +
    '<h3 class="fx-pop-t" id="fx-pop-t">' + e(t.t) + '</h3>' +
    '<p class="fx-pop-why"><b>Por que agora:</b> ' + e(t.why) + '</p>' +
    '<div class="actions fx-pop-acoes"><button type="button" class="btn primary" data-fx="agIr" data-k="' + e(t.k) + '" data-id="' + e(t.id) + '">' + e(t.cta) + ' →</button>' +
    (t.texto ? '<button type="button" class="btn" data-fx="copiarTxt" data-txt="' + e(t.texto) + '">Copiar mensagem</button>' : '') + (t.acaoId != null ? '<button type="button" class="btn" data-fx="agFeito" data-id="' + e(t.acaoId) + '">Já fiz</button>' : '') +
    '<button type="button" class="btn" data-fx="agFechar">Fechar</button>' +
    '<span class="fx-pop-nav"><button type="button" class="fx-seta" data-fx="agNav" data-d="-1" aria-label="Ação anterior"' + (k <= 0 ? ' disabled' : '') + '>‹</button>' +
    '<button type="button" class="fx-seta" data-fx="agNav" data-d="1" aria-label="Próxima ação"' + (k >= n - 1 ? ' disabled' : '') + '>›</button></span></div></div>';
}
export function htmlPopupAdd(h) {
  return fundo + '<div class="fx-pop" role="dialog" aria-modal="true" aria-labelledby="fx-pop-t" tabindex="-1">' +
    '<p class="fx-pop-tipo">Novo encaminhamento</p><h3 class="fx-pop-t" id="fx-pop-t">Adicionar uma tarefa minha</h3>' +
    '<p class="fx-pop-why">Só você vê. Nada disto aparece no app dela. Fica em Só eu e entra no quadro como “Só eu”.</p>' +
    '<form id="fx-add-form" class="fx-add-form"><label class="sr" for="fx-add-in">Tarefa</label><input id="fx-add-in" class="t" maxlength="160" autocomplete="off" placeholder="Ex.: Pedir o resumo financeiro à escola">' +
    '<p class="sub" id="fx-add-err" role="alert" hidden style="margin:6px 0 0;color:var(--red)"></p>' +
    '<div class="actions fx-pop-acoes"><button type="submit" class="btn primary" data-fx="agAdd">Adicionar</button><button type="button" class="btn" data-fx="agFechar">Fechar</button></div></form></div>';
}
// feitas: [{ titulo, quando, quem }]
export function htmlPopupFeitas(feitas, h) {
  const e = h.esc, f = feitas || [];
  return fundo + '<div class="fx-pop" role="dialog" aria-modal="true" aria-labelledby="fx-pop-t" tabindex="-1">' +
    '<p class="fx-pop-tipo">Concluídas</p><h3 class="fx-pop-t" id="fx-pop-t">Já feitas neste caso</h3>' +
    (f.length ? '<ul class="fx-feitas">' + f.map((x) => '<li><span>' + e(x.titulo) + '</span>' + (x.quando ? '<small>' + e(x.quando) + (x.quem ? ' · ' + e(x.quem) : '') + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="sub">Nada concluído ainda.</p>') +
    '<div class="actions fx-pop-acoes"><button type="button" class="btn" data-fx="agFechar">Fechar</button></div></div>';
}

// ---------- Sessão Checklist: démarches, os 4 mais urgentes, Drive privado, Ver mais (Task 11) ----------
// d = { semConta, erro, demarches: [{k,nome,feitos,total}], ativa, totalFeitos, total, itens: ChkItem[], hoje, todos, mais, extraMais, velhoDias? }.
// velhoDias > 0 = dado velho (spec §11: banner depois de 48 h sem atividade).
// A equipe não dá check no checklist dela e o CRM nunca lê nem mostra o link da pasta do Drive (spec §5.4, §8.2).
function rotuloPasso(i, hoje, e, fmtDay) {
  if (i.status === 'concluido') return '<span class="fx-p-d ok">feito</span>';
  if (i.status === 'arquivado') return '<span class="fx-p-d">Arquivado por ela</span>';
  if (!i.due_date) return '<span class="fx-p-d">sem data</span>';
  return '<span class="fx-p-d' + (String(i.due_date).slice(0, 10) < hoje ? ' atraso' : '') + '">' + (String(i.due_date).slice(0, 10) < hoje ? 'atrasado · ' : 'vence ') + e(fmtDay(i.due_date)) + '</span>';
}
export function htmlChecklistSessao(d, h) {
  const e = h.esc;
  if (d.semConta) return '<p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não tem checklist.</p>';
  if (d.erro) return '<p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p>';
  const itens = d.itens || [], hoje = d.hoje || '';
  const velho = d.velhoDias > 0 ? '<p class="fx-velho" role="status">Sem atividade dela no checklist há ' + e(d.velhoDias) + ' dias. O que aparece aqui pode estar desatualizado.</p>' : '';
  const pilulas = '<div class="fx-dems" role="group" aria-label="Démarches">' +
    [{ k: 'todas', nome: 'Todas', feitos: d.totalFeitos, total: d.total }].concat(d.demarches || []).map((x) =>
      '<button type="button" class="fx-dem" data-fx="dem" data-v="' + e(x.k) + '" aria-pressed="' + (x.k === d.ativa) + '"><span class="fx-dem-nome">' + e(x.nome) + '</span> <span class="fx-dem-n">' + e(x.feitos) + '/' + e(x.total) + '</span></button>').join('') + '</div>';
  const drive = '<div class="fx-pasta"><h4 class="fx-h4">Pasta do Drive dela</h4><p class="sub" style="margin:0">A pasta é privada: o CRM não vê o link e não guarda nada dela. Se a equipe precisar de um documento, ela autoriza por e-mail.</p></div>';
  const lista = d.todos ? maisUrgentes(itens, itens.length, hoje) : maisUrgentes(itens, 4, hoje);
  const esc4 = itens.length - 4;
  const passos = '<div class="fx-passos"><h4 class="fx-h4">Passos do checklist</h4>' + (itens.length
    ? '<ul class="fx-passos-lista">' + lista.map((i) => '<li class="fx-passo ' + (i.status === 'concluido' ? 'feito' : i.status === 'arquivado' ? 'arq' : 'pend') + '"><span class="fx-p-t">' + e(i.label) + '</span>' + rotuloPasso(i, hoje, e, h.fmtDay) + '</li>').join('') + '</ul>' +
      (itens.length > 4 ? '<button type="button" class="link" data-fx="ckTodos" aria-expanded="' + !!d.todos + '">' + (d.todos ? 'Mostrar só os 4 mais urgentes' : 'Ver todos os ' + itens.length + ' passos (' + esc4 + (esc4 === 1 ? ' escondido)' : ' escondidos)')) + '</button>' : '')
    : '<p class="sub" style="margin:0">O checklist dela ainda está vazio.</p>') + '</div>';
  return velho + pilulas + drive + passos +
    '<div class="fx-mais"><button type="button" class="btn" data-fx="ckMais" aria-expanded="' + !!d.mais + '">' + (d.mais ? 'Ver menos desta sessão' : 'Ver mais desta sessão') + '</button>' + (d.mais ? '<div class="fx-mais-corpo">' + (d.extraMais || '') + '</div>' : '') + '</div>';
}

// ---------- Sessões em pílulas (Task 12) ----------
// s = { id, titulo, sub, corpo, aberto, area: 'app'|'ela', ativa }. O corpo só vem pintado quando a sessão está aberta.
export function htmlSessao(s, h) {
  const e = h.esc;
  return '<section class="fx-sess' + (s.aberto ? ' aberta' : '') + (s.ativa ? ' ativa' : '') + '" data-sessao="' + e(s.id) + '" data-area="' + e(s.area) + '">' +
    '<div class="fx-sess-cab">' +
    (s.area === 'home' ? '' : '<span class="fx-grab" draggable="true" role="img" aria-label="Arrastar ' + e(s.titulo) + '" data-id="' + e(s.id) + '" data-area="' + e(s.area) + '">⋮⋮</span>') +
    '<button type="button" class="fx-sess-t" data-fx="sessao" data-id="' + e(s.id) + '" aria-expanded="' + !!s.aberto + '" aria-controls="fx-s-' + e(s.id) + '">' +
    '<span class="fx-sess-nome">' + e(s.titulo) + '</span><span class="fx-sess-sub">' + e(s.sub || '') + '</span></button>' +
    '<button type="button" class="fx-pin' + (s.fixada ? ' on' : '') + '" data-fx="home" data-id="' + e(s.id) + '" aria-pressed="' + !!s.fixada + '" aria-label="' + (s.fixada ? 'Tirar ' : 'Pôr ') + e(s.titulo) + (s.fixada ? ' da página inicial' : ' na página inicial') + '"><span class="fx-pin-sw" aria-hidden="true"></span>Página inicial</button>' +
    '<span class="fx-mover"><button type="button" class="fx-seta" data-fx="mover" data-id="' + e(s.id) + '" data-area="' + e(s.area) + '" data-d="-1" aria-label="Subir ' + e(s.titulo) + '">↑</button>' +
    '<button type="button" class="fx-seta" data-fx="mover" data-id="' + e(s.id) + '" data-area="' + e(s.area) + '" data-d="1" aria-label="Descer ' + e(s.titulo) + '">↓</button></span></div>' +
    (s.aberto ? '<div class="fx-sess-corpo" id="fx-s-' + e(s.id) + '">' + (s.corpo || '') + '</div>' : '') + '</section>';
}
// ord = { app: [ids], ela: [ids] }; mapa = { id: { titulo, sub, corpo, aberto } }. Dois grupos, como no spec §5.2.
export function htmlSessoes(ord, mapa, h, fechados, home) {
  const fech = fechados || {};
  const fixadas = (home || []).filter((id) => mapa && mapa[id]);
  const grupo = (area, titulo, dica) => {
    const itens = ((ord && ord[area]) || []).filter((id) => mapa && mapa[id] && !fixadas.includes(id));
    if (!itens.length) return '';
    return '<details class="fx-grupo fx-grupo-' + area + '" data-grupo="' + area + '"' + (fech[area] ? '' : ' open') + '><summary class="fx-grupo-sum"><h3 class="fx-h3" id="fx-g-' + area + '">' + h.esc(titulo) + '</h3>' +
      '<span class="sub fx-grupo-dica">' + h.esc(dica) + '</span><span class="fx-grupo-n">' + itens.length + (itens.length === 1 ? ' sessão' : ' sessões') + '</span><span class="fx-grupo-chev" aria-hidden="true">▾</span></summary>' +
      itens.map((id) => htmlSessao(Object.assign({ id, area, fixada: false }, mapa[id]), h)).join('') + '</details>';
  };
  const todos = [].concat((ord && ord.app) || [], (ord && ord.ela) || []).filter((id) => mapa && mapa[id]);
  const ir = todos.length ? '<nav class="fx-ir" aria-label="Ir para uma sessão"><span class="fx-ir-t">Ir para</span>' + todos.map((id) => '<button type="button" class="fx-ir-b' + (mapa[id].aberto ? ' on' : '') + '" data-fx="ir" data-id="' + h.esc(id) + '">' + h.esc(mapa[id].titulo) + '</button>').join('') + '</nav>' : '';
  const topo = '<section class="fx-home" aria-labelledby="fx-g-home"><div class="fx-home-cab"><h3 class="fx-h3" id="fx-g-home">Página inicial</h3><span class="sub fx-grupo-dica">' +
    (fixadas.length ? 'O mais importante dela, sempre no topo. “Página inicial” em qualquer sessão põe ou tira daqui.' : 'Nada fixado. Use “Página inicial” em uma sessão para ela ficar aqui, no topo.') + '</span></div>' +
    fixadas.map((id) => htmlSessao(Object.assign({ id, area: 'home', fixada: true }, mapa[id]), h)).join('') + '</section>';
  return '<div class="fx-sessoes">' + ir + topo + grupo('app', 'Acompanhar o app dela', 'O que ela vê e faz no app.') + grupo('ela', 'Conhecer e registrar', 'Só a equipe vê.') + '</div>';
}

// ---------- Aba Ficha: fluxo de 3 passos (Task 13) ----------
// passo: 1 = Captação por e-mail, 2 = Onboarding (descrição da reunião), 3 = Plataforma (spec §7.1).
const PASSOS_FLUXO = [['Captação por e-mail', 'Entregar o que ela pediu e convidar para o 1:1.'], ['Onboarding: descrição da reunião', 'Registrar a conversa e conferir o bilan.'], ['Plataforma', 'Acompanhar o projeto dela no app.']];
export function htmlFluxo(passo, h) {
  const e = h.esc, p = Math.min(3, Math.max(1, Number(passo) || 1));
  return '<ol class="fx-fluxo" aria-label="Fluxo da pessoa">' + PASSOS_FLUXO.map((x, i) => {
    const n = i + 1;
    return '<li class="fx-passo-fluxo ' + (n < p ? 'done' : n === p ? 'cur' : 'next') + '" data-passo="' + n + '"' + (n === p ? ' aria-current="step"' : '') + '><span class="fx-segn">' + n + '</span><span><b>' + e(x[0]) + '</b><span class="sub fx-fluxo-frase">' + e(x[1]) + '</span></span></li>';
  }).join('') + '</ol>';
}

// ---------- Fase 2: prévia do app dela (coluna da direita da aba Plataforma) ----------
// d = { nome, semConta, aba, dia, camadas, pct, feitos, total, naoLidas, marco: {titulo, dias, data}|null, prox: {label, due}|null,
//       avisos: [{tipo, titulo, texto}], passos: [{label, tag, feito, due, atrasado}], espaco: {marcos: [{titulo, resumo}], escolas: [{titulo, resumo}], dela: [{nome}]},
//       guias: {bilan, docs: [{titulo, resumo}], msgs: [{titulo}]}, perfil: {n, tot, kv: [[rotulo, valor]]} }
// Tudo é dado real da pessoa, só leitura. Nada aqui grava.
const ABAS_APP = [['inicio', 'Início'], ['checklist', 'Checklist'], ['espaco', 'Espaço'], ['perfil', 'Perfil']];
const LEGENDA_ABA = {
  inicio: 'Início = o prazo mais perto, o passo de agora, os que vêm em seguida e os atalhos do que é só dela. As perguntas da equipe moram no Espaço.',
  checklist: 'Checklist = passos da persona e o que ela adicionou. Só ela marca.',
  espaco: 'Espaço = a pergunta da equipe (com as perguntas rápidas do perfil na mesma fila), o que a equipe percebeu, o que a Ingryd manda, escolas, mensagens prontas e o bilan.',
  perfil: 'Perfil = respostas do Dossiê que já existem.'
};
export function htmlPreviaApp(d, h) {
  const e = h.esc, L = (l, t) => (d.camadas ? ' data-l="' + l + '"' : '') + (t || '');
  const aba = LEGENDA_ABA[d.aba] ? d.aba : 'inicio';
  const vz = (t) => '<p class="fx-pv-vz">' + e(t) + '</p>';
  let corpo = '';
  if (aba === 'inicio' && d.inicio && d.inicio.pessoal) {
    // O Início de quem já tem caso: igual ao do app (Oi, prazos, Agora, Em seguida, atalhos).
    const n = d.inicio, linhaSeg = (q) => '<div class="fx-pv-row"><span class="bx" aria-hidden="true">✓</span><span>' + (q.de ? '<small>Checklist · ' + e(q.de) + '</small>' : '') + e(q.titulo) + '</span>' + (q.meta ? '<em class="' + (q.atrasado ? 'at' : '') + '">' + e(q.meta) + '</em>' : '') + '</div>';
    corpo = '<section class="fx-pv-cab-in"' + L('Dela') + '><h3 class="fx-pv-oi">' + (n.nome ? 'Oi, ' + e(n.nome) + '.' : 'Oi.') + '</h3>' + (n.escolas.length ? '<p class="fx-pv-vz">O seu caso: ' + e(n.escolas.join(' e ')) + '.</p>' : '') + '</section>' +
      n.marcos.map((m) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">Prazo</span><h4>' + e(m.titulo) + '</h4><p>' + (m.aConfirmar ? 'Data a confirmar' : e(m.data) + (m.quando ? ' · ' + e(m.quando) : '')) + '</p></section>').join('') +
      (n.foco ? '<section class="fx-pv-card fx-pv-foco' + (n.foco.atrasado ? ' urg' : '') + '"' + L('Dela') + '><span class="k">' + e(n.foco.rotulo) + '</span><h4>' + e(n.foco.titulo) + '</h4>' + (n.foco.quando ? '<p>' + e(n.foco.quando) + '</p>' : '') + '<span class="fx-pv-btn">' + e(n.foco.botao) + '</span></section>' : '') +
      (n.seguintes.length ? '<section class="fx-pv-card"' + L('Persona') + '><span class="k">Em seguida</span>' + n.seguintes.map(linhaSeg).join('') + '</section>' : '') +
      (n.atalhos.length ? '<section class="fx-pv-card"' + L('Dela') + '><span class="k">Só seu</span>' + n.atalhos.map((a) => '<div class="fx-pv-row"><span><b>' + e(a.tit) + '</b><small>' + e(a.sub) + '</small></span></div>').join('') + '</section>' : '');
  } else if (aba === 'inicio') {
    const frase = d.marco ? 'Faltam ' + d.marco.dias + ' dias: ' + d.marco.titulo + '.' : 'Nada vence nesta semana. O próximo passo está logo abaixo.';
    corpo = '<section class="fx-pv-card fx-pv-hero' + (d.marco && d.marco.dias <= 21 ? ' urg' : '') + '"' + L('Dela') + '><span class="k">Hoje</span><h4>Olá, ' + e(d.nome) + '</h4><p>' + e(frase) + '</p><b class="fx-pv-pct">' + d.pct + '%</b></section>' +
      (d.prox ? '<section class="fx-pv-card"' + L('Persona') + '><span class="k">Próximo passo</span><h4>' + e(d.prox.label) + '</h4><p>' + (d.prox.due ? 'Prazo: ' + e(h.fmtDay(d.prox.due)) : 'Sem data ainda') + '</p></section>' : '');
  } else if (aba === 'checklist') {
    const linha = (x) => '<div class="fx-pv-row' + (x.feito ? ' f' : '') + '"><span class="bx" aria-hidden="true">' + (x.feito ? '✓' : '') + '</span><span><small>' + e(x.tag || '') + '</small>' + e(x.label) + '</span>' +
      (x.due && !x.feito ? '<em class="' + (x.atrasado ? 'at' : '') + '">' + e(h.fmtDay(x.due)) + '</em>' : '') + '</div>';
    corpo = '<section class="fx-pv-card"' + L('Persona') + '><span class="k">Seus passos</span><h4>' + d.feitos + ' de ' + d.total + ' feitos</h4><div class="fx-pv-bar"><i style="width:' + d.pct + '%"></i></div>' +
      (d.passos.length ? d.passos.map(linha).join('') : (d.rascunhos || []).length ? '' : vz(d.semConta ? 'Ela ainda não entrou no app: o checklist nasce no primeiro acesso.' : 'Nenhum passo ainda.')) +
      ((d.rascunhos || []).length ? '<p class="fx-pv-rasc-t">Rascunho: só você vê, ainda não foi publicado</p>' + d.rascunhos.map((x) => '<div class="fx-pv-row rasc"><span class="bx" aria-hidden="true"></span><span><small>' + e([x.conferir ? 'A conferir' : 'Rascunho', x.tag].filter(Boolean).join(' · ')) + '</small>' + e(x.label) + '</span>' +
        (x.due ? '<em>' + e(h.fmtDay(x.due)) + '</em>' : '') + '</div>').join('') : '') +
      (d.semConta && (d.passos.length || (d.rascunhos || []).length) ? '<p class="fx-pv-vz">Prévia do que ela verá ao entrar.</p>' : '') + '</section>';
  } else if (aba === 'espaco') {
    const p = d.esp || { perguntas: [], percebeu: [], docs: [], escolas: [], dela: [], mensagens: [], bilans: [], vazio: true };
    const bloco = (tit, linhas) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">' + e(tit) + '</span>' + linhas + '</section>';
    const lin = (t, s2, em) => '<div class="fx-pv-row"><span><b>' + e(t) + '</b>' + (s2 ? '<small>' + e(s2) + '</small>' : '') + '</span>' + (em ? '<em>' + e(em) + '</em>' : '') + '</div>';
    const perguntas = p.perguntas.map((a) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">Pergunta da equipe</span><h4>' + e(a.titulo) + '</h4>' + (a.texto ? '<p>' + e(a.texto) + '</p>' : '') + '</section>').join('');
    const novos = p.docs.filter((x) => x.novo).length;
    const daIngryd = p.docs.length ? bloco('Da Ingryd para você' + (novos ? ' · ' + novos + (novos === 1 ? ' novo' : ' novos') : ''), p.docs.map((x) => lin(x.titulo, x.resumo || (x.descricao ? 'com descrição para ler e copiar' : ''), x.conteudo ? 'Abrir' : x.descricao ? 'Ler' : 'chega em breve')).join('')) : '';
    const esc2 = p.escolas.length || p.dela.length ? bloco('Escolas para você contatar', p.escolas.map((x) => lin(x.titulo, x.resumo)).join('') + p.dela.map((x) => lin(x.nome, 'adicionada por ela')).join('')) : '';
    corpo = '<h3 class="fx-pv-oi">Materiais pro seu caso</h3>' + (p.vazio && !p.dela.length
      ? '<section class="fx-pv-card"' + L('Dela') + '><h4>Seu espaço ainda está sendo preparado.</h4><p>Depois da nossa conversa, a Ingryd coloca aqui o que é só do seu caso: arquivos, mensagens e contatos. Quando ela publicar, aparece aqui e a equipe avisa.</p></section>'
      : perguntas + p.percebeu.map((a) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">O que a equipe percebeu</span><h4>' + e(a.titulo) + '</h4>' + (a.texto ? '<p>' + e(a.texto) + '</p>' : '') + '</section>').join('') + daIngryd + esc2 +
        (p.mensagens.length ? bloco('Mensagens prontas', p.mensagens.map((x) => lin(x.titulo, x.resumo)).join('')) : '') + (p.bilans.length ? bloco('Meu Bilan', p.bilans.map((x) => lin(x.titulo, x.resumo)).join('')) : ''));
  } else {
    corpo = '<section class="fx-pv-card"' + L('Dela') + '><h4>' + e(d.nome) + '</h4>' + d.perfil.kv.map((x) => '<div class="fx-pv-row"><span>' + e(x[0]) + '</span><em>' + e(x[1] || '—') + '</em></div>').join('') + '</section>' +
      '<section class="fx-pv-card"><span class="k">Seu perfil</span><p>' + d.perfil.n + ' de ' + d.perfil.tot + ' respondidas.</p></section>';
  }
  return '<div class="fx-pv-cab"><b>Como ' + e(d.nome) + ' vê no app</b><span class="fx-pv-dias" role="group" aria-label="Dias depois do primeiro acesso">' +
    [0, 1, 3, 7].map((n) => '<button type="button" data-fx="appdia" data-v="' + n + '" aria-pressed="' + (d.dia === n) + '">Dia ' + n + '</button>').join('') + '</span></div>' +
    '<div class="fx-pv-tel"><div class="fx-pv-top"><span class="fx-pv-marca">Por <i>Dentro</i></span><span class="fx-pv-sino" aria-label="' + (d.naoLidas + d.avisos.length) + ' novidades">🔔' + (d.naoLidas + d.avisos.length ? '<i>' + (d.naoLidas + d.avisos.length) + '</i>' : '') + '</span></div>' +
    '<div class="fx-pv-corpo">' + (d.semConta ? '<p class="fx-pv-prev"><b>Prévia.</b> ' + e(d.nome) + ' ainda não entrou no app. É o que ela vê ' + (d.dia === 0 ? 'no primeiro acesso' : 'no dia ' + d.dia + ' depois de entrar') + '.</p>' : '') + corpo + '</div>' +
    '<nav class="fx-pv-nav" aria-label="Seções do app">' + ABAS_APP.map((a) => '<button type="button" data-fx="appaba" data-v="' + a[0] + '"' + (a[0] === aba ? ' aria-current="page"' : '') + '>' + a[1] + '</button>').join('') + '</nav></div>' +
    '<p class="fx-pv-leg">' + e(LEGENDA_ABA[aba]) + '</p>' +
    '<button type="button" class="fx-pv-tg" data-fx="camadas" aria-pressed="' + d.camadas + '"><span class="fx-pv-sw" aria-hidden="true"></span><span class="fx-pv-tgt">Mostrar as camadas (<span class="p">Persona</span> igual para quem tem a mesma situação · <span class="d">Dela</span> só desta pessoa)</span></button>';
//
}
