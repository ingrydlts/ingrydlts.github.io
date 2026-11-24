// Ficha-universo, fase 1: HTML puro das peças novas. Todas recebem h = { esc, fmtDay } e escapam todo texto vindo do banco.
import { ETAPAS_FUNIL, maisUrgentes } from './ficha.js?v=2026-11-17.12';   // o ?v= acompanha o de crm.js (cache do navegador)


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
    (c.id ? '<button type="button" class="btn hd-pag-btn" data-pagar="' + e(c.id) + '" title="Manda o e-mail Link de pagamento. Você revisa a escolha antes de enviar.">' + (d.linkPagamentoEnviado ? 'Reenviar link de pagamento' : 'Enviar link de pagamento') + '</button>' : '') +
    (c.id ? '<button type="button" class="btn hd-pag-btn hd-pag-reg" data-pagreg="' + e(c.id) + '" title="Lança um pagamento que não passou pelo Stripe (Pix, transferência, dinheiro).">Registrar pagamento</button>' : '') + '</div>' +
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
// "Adicionar na home": põe o passo (ou o item do Espaço / dos Guias) nos destaques do Início dela. Usa o despachante data-caso do CRM.
// Minimalista: "+" põe na home e "×" tira (com rótulo escrito para leitor de tela e dica ao passar o mouse).
export function iconeHome(tem, ref, e) {
  const rot = /^checklist:/.test(ref) ? (tem ? 'Tirar do Em seguida' : 'Fixar no Em seguida') : (tem ? 'Tirar da página inicial' : 'Adicionar na página inicial');
  return '<button type="button" class="fx-ic' + (tem ? ' on' : '') + '" data-caso="' + (tem ? 'home-del' : 'home-add') + '" data-id="' + e(ref) + '" aria-pressed="' + !!tem + '" aria-label="' + rot + '" title="' + rot + '">' + (tem ? '×' : '+') + '</button>';
}
export function botaoHome(tem, ref, e) {
  return iconeHome(tem, 'checklist:' + ref, e);
}
// O texto de um passo do checklist dela. O original do template continua guardado; vazio volta ao original; ela vê o novo texto no app.
function guiaEditor(i, e, g) {
  if (g === undefined) return '';
  if (g && g.erro) return '<div class="fx-gd"><p class="sub" style="margin:0">Falta rodar <b>db/crm-guias-gerais.sql</b> no SQL Editor do Supabase para escrever o guia deste passo.</p></div>';
  const r = (g && g.row) || {};
  const linhas = (Array.isArray(r.links) ? r.links : []).map((l) => (l.rotulo ? l.rotulo + ' | ' : '') + l.url).join('\n');
  const estado = r.estado === 'publicado' ? '<span class="fx-cp ok">Publicado para todas</span>' : r.step_key ? '<span class="fx-cp">Rascunho</span>' : '';
  return '<fieldset class="fx-gd"><legend>Guia do passo <small>vale para todas as pessoas</small> ' + estado + '</legend>' +
    '<div class="fx-gd-url"><input id="fx-g-url" type="url" inputmode="url" placeholder="Cole um link (site oficial, busca, artigo)" value="' + e(r.fonte_url || '') + '" aria-label="Link para analisar">' +
    '<button type="button" class="btn" data-fx="guiaAnalisar" data-id="' + e(i.step_key) + '"' + (g && g.analisando ? ' disabled' : '') + '>' + (g && g.analisando ? 'Analisando…' : 'Analisar link') + '</button></div>' +
    (g && g.msg ? '<p class="sub fx-gd-msg" role="status">' + e(g.msg) + '</p>' : '') +
    '<details class="fx-gd-colar"' + (g && g.colar ? ' open' : '') + '><summary>ou cole o texto da página</summary><textarea id="fx-g-txt" rows="4" maxlength="18000" placeholder="Cole aqui o texto, se o link não abrir para mim"></textarea><button type="button" class="btn" data-fx="guiaAnalisar" data-id="' + e(i.step_key) + '" data-texto="1">Analisar o texto</button></details>' +
    '<label class="fx-ck-l">Por que importa (até 400)<textarea id="fx-g-pq" rows="2" maxlength="400">' + e(r.por_que || '') + '</textarea></label>' +
    '<label class="fx-ck-l">Atenção (até 500)<textarea id="fx-g-at" rows="2" maxlength="500">' + e(r.atencao || '') + '</textarea></label>' +
    '<label class="fx-ck-l">Passo a passo (um por linha, até 8)<textarea id="fx-g-ps" rows="4">' + e((Array.isArray(r.passos) ? r.passos : []).join('\n')) + '</textarea></label>' +
    '<label class="fx-ck-l">Links (um por linha: Rótulo | https://…, até 6)<textarea id="fx-g-ln" rows="3">' + e(linhas) + '</textarea></label>' +
    (g && g.lacunas && g.lacunas.length ? '<p class="sub fx-gd-msg">A página não diz, confira: ' + e(g.lacunas.join('; ')) + '</p>' : '') +
    '<p class="sub" style="margin:0">Sugestão da IA: confira antes de publicar. Campo vazio deixa o texto original do template.</p>' +
    '<div class="actions"><button type="button" class="btn" data-fx="guiaSalvar" data-id="' + e(i.step_key) + '" data-estado="rascunho">Salvar rascunho</button><button type="button" class="btn primary" data-fx="guiaSalvar" data-id="' + e(i.step_key) + '" data-estado="publicado">Publicar para todas</button>' +
    (r.step_key ? '<button type="button" class="btn" data-fx="guiaApagar" data-id="' + e(i.step_key) + '">Voltar ao original</button>' : '') + '</div></fieldset>';
}
function editorPasso(i, e, g) {
  return '<div class="fx-passo fx-passo-ed"><form class="fx-ck-ed" data-ckform="' + e(i.step_key) + '">' +
    '<label class="fx-ck-l">Texto do passo<input id="fx-ck-t" type="text" maxlength="120" value="' + e(i.titulo_custom || i.label) + '" data-orig="' + e(i.label) + '"></label>' +
    '<label class="fx-ck-l">Observação (opcional, até 100 letras)<input id="fx-ck-n" type="text" maxlength="100" value="' + e(i.nota_custom || '') + '"></label>' +
    '<p class="sub" style="margin:2px 0 8px">Original: ' + e(i.label) + '. Deixar o texto vazio volta ao original. Ela vê o novo texto no app.</p>' +
    '<div class="actions"><button type="button" class="btn primary" data-fx="ckSalvar" data-id="' + e(i.step_key) + '">Salvar</button><button type="button" class="btn" data-fx="ckCancelar">Cancelar</button></div></form>' + guiaEditor(i, e, g) + '</div>';
}
const ORIGENS_CK = [['todos', 'Todos'], ['gerais', 'Gerais'], ['dela', 'Só dela']];
// d = { semConta, erro, velhoDias, demarches, ativa, origem, itens (gerais, já filtrados), equipeHtml, equipeN, alertas: {lista, porRef}, homeRefs, ckEd, totalFeitos, total,
//       hoje, todos, mais, extraMais, demDe(item) }. h.linhaPasso(o) desenha a linha (a mesma nas duas listas).
export function htmlChecklistSessao(d, h) {
  const e = h.esc;
  if (d.semConta) return '<p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não tem checklist.</p>';
  if (d.erro) return '<p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p>';
  const itens = d.itens || [], hoje = d.hoje || '', origem = d.origem || 'todos', alertas = d.alertas || { lista: [], porRef: {} };
  const velho = d.velhoDias > 0 ? '<p class="fx-velho" role="status">Sem atividade dela no checklist há ' + e(d.velhoDias) + ' dias. O que aparece aqui pode estar desatualizado.</p>' : '';
  const pct = d.total ? Math.round(100 * d.totalFeitos / d.total) : 0;
  const topo = '<div class="fx-ck-top"><div class="fx-ck-prog"><b>' + e(d.totalFeitos) + ' de ' + e(d.total) + '</b><small>feitos por ela</small>' +
    '<span class="fx-i" tabindex="0" title="A pasta do Drive dela é privada: o CRM não vê o link nem guarda nada dela. Se a equipe precisar de um documento, ela autoriza por e-mail.">ⓘ</span>' +
    '<div class="fx-ck-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div>' +
    '<div class="fx-orig" role="group" aria-label="Mostrar">' + ORIGENS_CK.map((o) => '<button type="button" data-fx="ckOrigem" data-v="' + o[0] + '" aria-pressed="' + (o[0] === origem) + '">' + o[1] + '</button>').join('') + '</div></div>';
  const pilulas = '<div class="fx-dems" role="group" aria-label="Démarches">' +
    [{ k: 'todas', nome: 'Todas', feitos: d.totalFeitos, total: d.total }].concat(d.demarches || []).map((x) =>
      '<button type="button" class="fx-dem" data-fx="dem" data-v="' + e(x.k) + '" aria-pressed="' + (x.k === d.ativa) + '"><span class="fx-dem-nome">' + e(x.nome) + '</span> <span class="fx-dem-n">' + e(x.feitos) + '/' + e(x.total) + '</span></button>').join('') + '</div>';
  const acaoAlerta = (a) => /^chk:/.test(a.ref) ? '<button type="button" class="link" data-fx="ckEditar" data-id="' + e(a.ref.slice(4)) + '">Editar</button>' : '<button type="button" class="link" data-caso="ed-aco" data-id="' + e(a.ref.slice(4)) + '">Editar</button>';
  const painel = alertas.lista.length ? '<div class="fx-valid" role="status"><span class="fx-valid-ic" aria-hidden="true">!</span><div><b>' + alertas.lista.length + (alertas.lista.length === 1 ? ' coisa para validar' : ' coisas para validar') + '</b><ul>' +
    alertas.lista.slice(0, 6).map((a) => '<li><span>“' + e(a.titulo) + '”: ' + e(a.texto) + '</span> ' + acaoAlerta(a) + '</li>').join('') + '</ul>' + (alertas.lista.length > 6 ? '<small>e mais ' + (alertas.lista.length - 6) + '</small>' : '') + '</div></div>' : '';
  const linhaGeral = (i) => {
    if (d.ckEd && d.ckEd === i.step_key) return editorPasso(i, e, d.guiaEd);
    const feito = i.status === 'concluido', arq = i.status === 'arquivado', venc = i.due_date ? String(i.due_date).slice(0, 10) : '', atras = !feito && !arq && !!venc && venc < hoje;
    const chips = [{ t: 'Geral', c: 'ger' }];
    if (d.ativa === 'todas' && d.demDe) chips.push({ t: d.demDe(i), c: 'dem' });
    if (feito) chips.push({ t: 'feito', c: 'ok' }); else if (arq) chips.push({ t: 'arquivado por ela', c: '' });
    else if (venc) chips.push({ t: (atras ? 'atrasado · ' : 'vence ') + h.fmtDay(venc), c: 'due' + (atras ? ' atraso' : '') }); else chips.push({ t: 'sem data', c: 'vz' });
    return h.linhaPasso({ estado: feito ? 'ok' : atras ? 'bad' : 'off', rot: feito ? 'Feito por ela' : arq ? 'Arquivado por ela' : atras ? 'Atrasado' : 'Pendente', cls: feito ? 'feito' : arq ? 'arq' : '',
      titulo: e(i.titulo_custom || i.label), nota: i.nota_custom ? e(i.nota_custom) : '', chips, alerta: ((alertas.porRef['chk:' + i.step_key]) || [])[0] || '', ed: 'ed-chk', id: i.step_key,
      home: d.homeRefs && !arq ? botaoHome(d.homeRefs.indexOf(i.step_key) >= 0, i.step_key, e) : '' });
  };
  // Os passos "Documento: …" são os documentos a preparar: ficam numa seção própria, separados dos passos.
  const ehDoc = (i) => /^Documento:/i.test(String(i.titulo_custom || i.label || '')), docs = itens.filter(ehDoc), passosSo = itens.filter((i) => !ehDoc(i));
  const lista = d.todos ? maisUrgentes(passosSo, passosSo.length, hoje) : maisUrgentes(passosSo, 6, hoje), esc6 = passosSo.length - 6;
  const grupoDocs = origem === 'dela' || !docs.length ? '' : '<div class="fx-g"><span>Documentos a preparar · ' + docs.length + '</span><span>' + docs.filter((i) => i.status === 'concluido').length + ' de ' + docs.length + ' prontos</span></div><div class="fx-ck-lista">' + maisUrgentes(docs, docs.length, hoje).map(linhaGeral).join('') + '</div>';
  const grupoG = origem === 'dela' ? '' : '<div class="fx-g"><span>Gerais da démarche · ' + passosSo.length + '</span><span>vale para toda a persona</span></div>' +
    (passosSo.length ? '<div class="fx-ck-lista">' + lista.map(linhaGeral).join('') + '</div>' +
      (passosSo.length > 6 ? '<button type="button" class="link" data-fx="ckTodos" aria-expanded="' + !!d.todos + '">' + (d.todos ? 'Mostrar só os 6 mais urgentes' : 'Mostrar os ' + esc6 + (esc6 === 1 ? ' restante' : ' restantes')) + '</button>' : '')
      : '<p class="sub" style="margin:0 0 8px">O checklist dela ainda está vazio.</p>');
  const grupoD = origem === 'gerais' || !d.equipeHtml ? '' : '<div class="fx-g"><span>Só dela · ' + (d.equipeN || 0) + '</span><span>combinado com ela</span></div><div class="fx-ck-lista">' + d.equipeHtml + '</div>';
  return velho + topo + pilulas + painel + grupoG + grupoDocs + grupoD +
    '<div class="fx-mais"><button type="button" class="link" data-fx="ckMais" aria-expanded="' + !!d.mais + '">' + (d.mais ? 'Ver menos detalhes' : 'Ver detalhes completos do checklist') + '</button>' + (d.mais ? '<div class="fx-mais-corpo">' + (d.extraMais || '') + '</div>' : '') + '</div>';
}

// ---------- Curadoria: limpar, editar, posicionar e validar os passos dela ----------
// d = { erro, carregando, origem, resumo: {total, conferidos, ocultos}, alertas, gerais (já na ordem dela), escondidos, equipeHtml, equipeN, mapa, hoje, ckEd, temOrdem, demDe(item) }
// h.linhaCur(o) desenha a linha do passo geral (alça, ponto, título, etiquetas, ↑ ↓ ✓ ✎ ✕).
export function htmlCuradoria(d, h) {
  const e = h.esc;
  if (d.carregando) return '<div class="skel" aria-busy="true" style="height:64px"></div>';
  if (d.erro) return '<p class="sub" style="margin:0">A curadoria ainda não está ligada: falta rodar <b>db/crm-checklist-curadoria.sql</b> no SQL Editor do Supabase (primeiro no teste, depois na produção).</p>';
  const r = d.resumo || { total: 0, conferidos: 0, ocultos: 0 }, origem = d.origem || 'todos', m = d.mapa || {}, alertas = d.alertas || { lista: [], porRef: {} }, hoje = d.hoje || '';
  const pct = r.total ? Math.round(100 * r.conferidos / r.total) : 0;
  const topo = '<div class="fx-ck-top"><div class="fx-ck-prog"><b>' + e(r.conferidos) + ' de ' + e(r.total) + '</b><small>conferidos por você' + (r.ocultos ? ' · ' + e(r.ocultos) + (r.ocultos === 1 ? ' escondido' : ' escondidos') : '') + '</small>' +
    '<div class="fx-ck-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div>' +
    '<div class="fx-orig" role="group" aria-label="Mostrar">' + ORIGENS_CK.map((o) => '<button type="button" data-fx="curOrigem" data-v="' + o[0] + '" aria-pressed="' + (o[0] === origem) + '">' + o[1] + '</button>').join('') + '</div></div>';
  const acaoAlerta = (a) => /^chk:/.test(a.ref) ? '<button type="button" class="link" data-caso="ed-chk" data-id="' + e(a.ref.slice(4)) + '">Editar</button>' : '<button type="button" class="link" data-caso="ed-aco" data-id="' + e(a.ref.slice(4)) + '">Editar</button>';
  const painel = alertas.lista.length ? '<div class="fx-valid" role="status"><span class="fx-valid-ic" aria-hidden="true">!</span><div><b>' + alertas.lista.length + (alertas.lista.length === 1 ? ' coisa para validar' : ' coisas para validar') + '</b><ul>' +
    alertas.lista.slice(0, 6).map((a) => '<li><span>“' + e(a.titulo) + '”: ' + e(a.texto) + '</span> ' + acaoAlerta(a) + '</li>').join('') + '</ul>' + (alertas.lista.length > 6 ? '<small>e mais ' + (alertas.lista.length - 6) + '</small>' : '') + '</div></div>' : '<p class="fx-valid-ok" role="status">Nada para validar: todos os passos têm data, démarche e título único.</p>';
  const gerais = d.gerais || [], n = gerais.length;
  const linha = (i, k) => {
    if (d.ckEd && d.ckEd === i.step_key) return editorPasso(i, e, d.guiaEd);
    const c = m[i.step_key] || {}, feito = i.status === 'concluido', venc = i.due_date ? String(i.due_date).slice(0, 10) : '', atras = !feito && !!venc && venc < hoje;
    const chips = [{ t: 'Geral', c: 'ger' }];
    if (d.demDe) chips.push({ t: d.demDe(i), c: 'dem' });
    if (feito) chips.push({ t: 'feito por ela', c: 'ok' }); else if (venc) chips.push({ t: (atras ? 'atrasado · ' : 'vence ') + h.fmtDay(venc), c: 'due' + (atras ? ' atraso' : '') }); else chips.push({ t: 'sem data', c: 'vz' });
    return h.linhaCur({ chave: i.step_key, pos: k, n, estado: feito ? 'ok' : atras ? 'bad' : 'off', titulo: e(i.titulo_custom || i.label), chips, alerta: ((alertas.porRef['chk:' + i.step_key]) || [])[0] || '', conferido: !!c.conferido_em, escondido: false });
  };
  const grupoG = origem === 'dela' ? '' : '<div class="fx-g"><span>Gerais da démarche · ' + n + '</span><span>' + (d.temOrdem ? '<button type="button" class="link" data-fx="curReset">Voltar à ordem automática</button>' : 'arraste ⋮⋮ ou use ↑ ↓ para posicionar') + '</span></div>' +
    (n ? '<div class="fx-cur-lista">' + gerais.map(linha).join('') + '</div>' : '<p class="sub" style="margin:0 0 8px">Nenhum passo geral para mostrar.</p>');
  const esc = d.escondidos || [];
  const grupoE = origem === 'dela' || !esc.length ? '' : '<div class="fx-g"><span>Escondidos da lista dela · ' + esc.length + '</span><span>ela não vê</span></div><div class="fx-cur-lista">' + esc.map((i) =>
    h.linhaCur({ chave: i.step_key, estado: 'off', titulo: e(i.titulo_custom || i.label), chips: [{ t: 'Geral', c: 'ger' }, { t: 'escondido', c: '' }], alerta: '', conferido: false, escondido: true })).join('') + '</div>';
  const grupoD = origem === 'gerais' || !d.equipeHtml ? '' : '<div class="fx-g"><span>Só dela · ' + (d.equipeN || 0) + '</span><span>combinado com ela · retire pelo ↓</span></div><div class="fx-ck-lista">' + d.equipeHtml + '</div>';
  return topo + painel + grupoG + grupoE + grupoD;
}

// ---------- Quadro do passo: o que ela vê ao abrir um passo do checklist (o mesmo desenho do app), com a ação da equipe no rodapé ----------
// d = { item: { step_key, label, titulo_custom, nota_custom, status, due_date, category }, guia: { c, l, q, p, t, s, k } | null, hoje: 'AAAA-MM-DD' }
const QD_SVG = { x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5', rel: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', alerta: 'M12 8v5M12 17h.01M12 3l10 18H2z', link: 'M7 17L17 7M9 7h8v8', arq: 'M5 7h14M7 7v12h10V7M10 7V4h4v3', lapis: 'M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z' };
const qdIco = (n, t) => '<svg viewBox="0 0 24 24" width="' + (t || 16) + '" height="' + (t || 16) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + QD_SVG[n] + '"/></svg>';
// Marcadores do app ({ciclo}, {nivel}…) só se resolvem lá: no CRM saem do texto para não aparecerem como chaves soltas.
export const limpaMarcadores = (t) => String(t || '').replace(/\s*\{[a-z0-9_.]+\}/gi, '').replace(/\s+([,.;:])/g, '$1');
export function htmlQuadroPasso(d, h) {
  const e = h.esc, it = d.item || {}, g = d.guia || null, hoje = d.hoje || '';
  const titulo = it.titulo_custom || it.label || (g && g.l) || '';
  const feito = it.status === 'concluido', arq = it.status === 'arquivado';
  const status = feito ? '<span class="qd-chip ok">' + qdIco('check', 13) + 'Concluído</span>' : arq ? '<span class="qd-chip">Arquivado por ela</span>' : '<span class="qd-chip">Pendente</span>';
  const venc = it.due_date ? String(it.due_date).slice(0, 10) : '';
  const prazo = venc ? '<span class="qd-chip prazo' + (!feito && venc < hoje ? ' atraso' : '') + '">' + qdIco('rel', 13) + (venc < hoje && !feito ? 'atrasado · ' : 'até ') + e(h.fmtDay(venc)) + '</span>'
    : g && g.q ? '<span class="qd-chip prazo">' + qdIco('rel', 13) + e(limpaMarcadores(g.q)) + '</span>' : '';
  const sec = (rot, corpo, cls) => '<section class="qd-sec' + (cls ? ' ' + cls : '') + '"><h4 class="qd-k">' + rot + '</h4>' + corpo + '</section>';
  let corpo = '';
  if (it.nota_custom) corpo += '<p class="qd-nota">' + e(it.nota_custom) + '</p>';
  if (g && g.p) corpo += sec('Por que importa', '<p class="qd-lead">' + e(limpaMarcadores(g.p)) + '</p>');
  if (g && g.t) corpo += '<section class="qd-sec qd-atencao"><span class="qd-ico" aria-hidden="true">' + qdIco('alerta', 16) + '</span><div><h4 class="qd-k">Atenção</h4><p>' + e(limpaMarcadores(g.t)) + '</p></div></section>';
  if (g && g.s && g.s.length) corpo += sec('Passo a passo', '<ol class="qd-passos">' + g.s.map((x) => '<li><span>' + e(limpaMarcadores(x)) + '</span></li>').join('') + '</ol>');
  const links = ((g && g.k) || []).filter((x) => x.f || /^https:\/\//.test(x.u || ''));
  if (links.length) corpo += sec('Links de apoio', '<div class="qd-links">' + links.map((x) => x.f ? '<span class="qd-link futuro">' + e(limpaMarcadores(x.l)) + ' · em breve</span>' : '<a class="qd-link" href="' + e(x.u) + '" target="_blank" rel="noopener noreferrer">' + qdIco('link', 14) + '<span>' + e(limpaMarcadores(x.l)) + '</span></a>').join('') + '</div>');
  if (!g) corpo += '<p class="qd-vazio">Este passo não tem guia no app: ela vê só o título' + (it.nota_custom ? ' e a observação' : '') + '.</p>';
  return '<div class="qd-fundo" data-fx="qdFechar"></div><div class="qd" role="dialog" aria-modal="true" aria-labelledby="qd-t">' +
    '<header class="qd-cab"><div class="qd-topo"><span class="qd-kick">' + e((g && g.c) || it.category || 'Passo') + '</span><button type="button" class="qd-x" data-fx="qdFechar" aria-label="Fechar">' + qdIco('x', 18) + '</button></div>' +
    '<h3 class="qd-tit" id="qd-t">' + e(titulo) + '</h3><div class="qd-meta">' + status + prazo + '</div></header>' +
    '<div class="qd-corpo">' + corpo + '</div>' +
    '<footer class="qd-rod"><span class="qd-aviso">É isto que ela vê no app.</span><span class="qd-acoes">' +
    '<button type="button" class="btn" data-fx="ckEditar" data-id="' + e(it.step_key) + '">' + qdIco('lapis', 14) + ' Editar texto</button><button type="button" class="btn primary" data-fx="qdFechar">Fechar</button></span></footer></div>';
}

// ---------- Sessões em pílulas (Task 12) ----------
// s = { id, titulo, sub, corpo, aberto, area: 'app'|'ela', ativa }. O corpo só vem pintado quando a sessão está aberta.
const ICONE_SESSAO = { home: 'M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z', chat: 'M4 5h16v11H9l-5 4z', checklist: 'M5 12.5l4.5 4.5L19 7.5', guias: 'M5 4h11l3 3v13H5zM9 11h6M9 15h6', espaco: 'M4 5h7v14H4zM13 5h7v6h-7zM13 13h7v6h-7z',
  perfil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6', eu: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z', bilan: 'M7 3h10v18l-5-3-5 3z', trouxe: 'M4 8h16v12H4zM9 8V5h6v3',
  sinais: 'M3 17l5-6 4 3 5-8 4 5', hist: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', curadoria: 'M4 6h10M4 12h16M4 18h7M17 4v4M19 6h-4', mais: 'M6 12h.01M12 12h.01M18 12h.01', insights: 'M12 3a6 6 0 00-4 10.5V17h8v-3.5A6 6 0 0012 3zM9 21h6' };
// A sessão aberta ocupa a página inteira (sem dropdown): cabeçalho com ícone e título em Fraunces, e o corpo logo abaixo.
// As outras sessões só se alcançam pelas pílulas "Ir para". mapa = { id: { titulo, sub, corpo, aberto, meta } }; ord = { app: [ids], ela: [ids] }.
export function htmlPaginaSessao(ord, mapa, h) {
  const e = h.esc, todos = [].concat((ord && ord.app) || [], (ord && ord.ela) || []).filter((id) => mapa && mapa[id]);
  const id = todos.find((x) => mapa[x].aberto) || todos[0]; if (!id) return '';
  const s = mapa[id], area = ((ord && ord.ela) || []).indexOf(id) >= 0 ? 'ela' : 'app', ic = ICONE_SESSAO[id] || ICONE_SESSAO.mais;
  return '<section class="fx-pagina fx-pagina-' + area + '" data-sessao="' + e(id) + '" data-area="' + area + '" aria-labelledby="fx-pg-t">' +
    '<header class="fx-pagina-cab"><span class="fx-sess-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + ic + '"/></svg></span>' +
    '<div class="fx-pagina-tt"><h3 id="fx-pg-t">' + e(s.titulo) + '</h3>' + (s.sub ? '<p>' + e(s.sub) + '</p>' : '') + '</div>' + (s.meta ? '<small class="fx-sess-meta">' + e(s.meta) + '</small>' : '') + '</header>' +
    '<div class="fx-pagina-corpo" id="fx-s-' + e(id) + '">' + (s.corpo || '') + '</div></section>';
}
// As pílulas "Ir para": a única porta para as sessões. A da página aberta fica marcada (aria-current); um traço separa os dois grupos.
export function htmlIrPara(ord, mapa, h) {
  const grupo = (ids) => ids.filter((id) => mapa && mapa[id]).map((id) => '<button type="button" class="fx-ir-b' + (mapa[id].aberto ? ' on' : '') + '" data-fx="ir" data-id="' + h.esc(id) + '"' + (mapa[id].aberto ? ' aria-current="page"' : '') + '>' + h.esc(mapa[id].titulo) + '</button>').join('');
  const app = grupo((ord && ord.app) || []), ela = grupo((ord && ord.ela) || []);
  return app || ela ? '<nav class="fx-ir" aria-label="Sessões da ficha">' + app + (app && ela ? '<span class="fx-ir-sep" aria-hidden="true"></span>' : '') + ela + '</nav>' : '';
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
const ABAS_APP = [['inicio', 'Início'], ['checklist', 'Checklist'], ['espaco', 'Espaço'], ['guias', 'Guias'], ['perfil', 'Perfil']];
const LEGENDA_ABA = {
  inicio: 'Início = o prazo mais perto, o passo de agora, os que vêm em seguida (primeiro os que você escolheu), o que é só dela e os guias. A pergunta da equipe vem sempre embaixo.',
  checklist: 'Checklist = passos da persona e o que ela adicionou. Só ela marca.',
  espaco: 'Espaço = a pergunta da equipe (com as perguntas rápidas do perfil na mesma fila), o que a equipe percebeu, o que a Ingryd manda, escolas, mensagens prontas e o bilan.',
  guias: 'Guias = o material da equipe só para ela: documentos que você manda, mensagens prontas e o bilan.',
  perfil: 'Perfil = respostas do Dossiê que já existem.'
};
// Início do app, depois do "Em seguida": "Só seu" (bilan e encaminhamentos da Ingryd) e "Guias", como ele monta (os que ela escolheu em Espaço).
function linhasHome(n, L, e) {
  const em = (x) => x.conteudo ? 'Abrir' : x.tipo === 'documento' ? 'chega em breve' : 'Ver no Espaço';
  const linha = (x) => '<div class="fx-pv-row"><span><b>' + e(x.titulo) + '</b>' + (x.sub ? '<small>' + e(x.sub) + '</small>' : '') + '</span><em>' + em(x) + '</em></div>';
  const s = n.soSeu || { atalhoBilan: false, bilans: [], docs: [] };
  const soSeu = s.atalhoBilan || s.bilans.length || s.docs.length
    ? '<section class="fx-pv-card"' + L('Dela') + '><span class="k">Só seu</span>' + (s.atalhoBilan ? '<div class="fx-pv-row"><span><b>O que combinamos na conversa</b><small>o bilan da nossa conversa</small></span></div>' : '') +
      s.bilans.map((x) => '<div class="fx-pv-row"><span><b>' + e(x.titulo) + '</b><small>' + e(x.sub || 'o bilan da nossa conversa') + '</small></span><em>Ver no Espaço</em></div>').join('') +
      (s.docs.length ? '<small class="fx-pv-dsub">Encaminhamentos da Ingryd</small>' + s.docs.map(linha).join('') : '') + '</section>' : '';
  const g = (n.destaques && n.destaques.guias) || [];
  return soSeu + (g.length ? '<section class="fx-pv-card"' + L('Dela') + '><span class="k">Guias</span>' + g.map(linha).join('') + '</section>' : '');
}
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
      (n.emDestaque ? '<section class="fx-pv-card fx-pv-dest"' + L('Dela') + '><span class="k">Em destaque</span><h4>' + e(n.emDestaque.titulo) + '</h4>' + (n.emDestaque.meta ? '<p>' + e(n.emDestaque.meta) + '</p>' : '') + '</section>' : '') +
      (n.foco ? '<section class="fx-pv-card fx-pv-foco' + (n.foco.atrasado ? ' urg' : '') + '"' + L('Dela') + '><span class="k">' + e(n.foco.rotulo) + '</span><h4>' + e(n.foco.titulo) + '</h4>' + (n.foco.quando ? '<p>' + e(n.foco.quando) + '</p>' : '') + '<span class="fx-pv-btn">' + e(n.foco.botao) + '</span></section>' : '') +
      (n.seguintes.length ? '<section class="fx-pv-card"' + L('Persona') + '><span class="k">Em seguida</span>' + n.seguintes.map(linhaSeg).join('') + '</section>' : '') +
      linhasHome(n, L, e);
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
    const daIngryd = p.docs.length ? bloco('Encaminhamentos da Ingryd' + (novos ? ' · ' + novos + (novos === 1 ? ' novo' : ' novos') : ''), p.docs.map((x) => lin(x.titulo, x.resumo || (x.descricao ? 'com descrição para ler e copiar' : ''), x.conteudo ? 'Abrir' : x.descricao ? 'Ler' : 'chega em breve')).join('')) : '';
    const esc2 = p.escolas.length || p.dela.length ? bloco('Escolas para você contatar', p.escolas.map((x) => lin(x.titulo, x.resumo)).join('') + p.dela.map((x) => lin(x.nome, 'adicionada por ela')).join('')) : '';
    corpo = '<h3 class="fx-pv-oi">Materiais pro seu caso</h3>' + (p.vazio && !p.dela.length
      ? '<section class="fx-pv-card"' + L('Dela') + '><h4>Seu espaço ainda está sendo preparado.</h4><p>Depois da nossa conversa, a Ingryd coloca aqui o que é só do seu caso: arquivos, mensagens e contatos. Quando ela publicar, aparece aqui e a equipe avisa.</p></section>'
      : perguntas + p.percebeu.map((a) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">O que a equipe percebeu</span><h4>' + e(a.titulo) + '</h4>' + (a.texto ? '<p>' + e(a.texto) + '</p>' : '') + '</section>').join('') + daIngryd + esc2 +
        (p.mensagens.length ? bloco('Mensagens prontas', p.mensagens.map((x) => lin(x.titulo, x.resumo)).join('')) : '') + (p.bilans.length ? bloco('Meu Bilan', p.bilans.map((x) => lin(x.titulo, x.resumo)).join('')) : ''));
  } else if (aba === 'guias') {
    const p = d.esp || { docs: [], mensagens: [], bilans: [], vazio: true };
    const bloco = (tit, linhas) => '<section class="fx-pv-card"' + L('Dela') + '><span class="k">' + e(tit) + '</span>' + linhas + '</section>';
    const lin = (t, s2, em) => '<div class="fx-pv-row"><span><b>' + e(t) + '</b>' + (s2 ? '<small>' + e(s2) + '</small>' : '') + '</span>' + (em ? '<em>' + e(em) + '</em>' : '') + '</div>';
    const novos = p.docs.filter((x) => x.novo).length;
    const blocos = (p.docs.length ? bloco('Da Ingryd para você' + (novos ? ' · ' + novos + (novos === 1 ? ' novo' : ' novos') : ''), p.docs.map((x) => lin(x.titulo, x.resumo || (x.descricao ? 'com descrição para ler e copiar' : ''), x.conteudo ? 'Abrir' : x.descricao ? 'Ler' : 'chega em breve')).join('')) : '') +
      (p.mensagens.length ? bloco('Mensagens prontas', p.mensagens.map((x) => lin(x.titulo, x.resumo)).join('')) : '') + (p.bilans.length ? bloco('Meu Bilan', p.bilans.map((x) => lin(x.titulo, x.resumo)).join('')) : '');
    corpo = '<h3 class="fx-pv-oi">Guias</h3>' + (blocos || '<section class="fx-pv-card"' + L('Dela') + '><h4>Ainda não tem material seu aqui.</h4><p>Quando você publicar um documento, uma mensagem pronta ou o bilan, aparece aqui.</p></section>');
  } else {
    corpo = '<section class="fx-pv-card"' + L('Dela') + '><h4>' + e(d.nome) + '</h4>' + d.perfil.kv.map((x) => '<div class="fx-pv-row"><span>' + e(x[0]) + '</span><em>' + e(x[1] || '—') + '</em></div>').join('') + '</section>' +
      '<section class="fx-pv-card"><span class="k">Seu perfil</span><p>' + d.perfil.n + ' de ' + d.perfil.tot + ' respondidas.</p></section>';
  }
  if (aba === 'inicio' && d.inicio && d.inicio.pessoal) {
    // Embaixo do Início, sempre: a pergunta da equipe (o app soma as perguntas rápidas do perfil, que só ele sabe quais faltam).
    const np = d.esp && d.esp.perguntas ? d.esp.perguntas.length : 0;
    if (np) corpo += '<p class="fx-pv-card fx-pv-aviso"' + L('Dela') + '>' + (np === 1 ? 'Você tem 1 nova pergunta da Equipe Por Dentro' : 'Você tem ' + np + ' novas perguntas da Equipe Por Dentro') + ' ›</p>';
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
