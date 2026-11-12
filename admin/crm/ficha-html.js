// Ficha-universo, fase 1: HTML puro das peças novas. Todas recebem h = { esc, fmtDay } e escapam todo texto vindo do banco.
import { ETAPAS_FUNIL, maisUrgentes } from './ficha.js?v=2026-11-12.10';   // o ?v= acompanha o de crm.js (cache do navegador)


const URG = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const ABAS = [['conversa', 'Conversa'], ['plataforma', 'Plataforma'], ['ficha', 'Ficha']];

// ---------- Fila de hoje, header, abas e guia (Task 8) ----------
// itens: [{ c, novas, proxima, sub? }]; selId: id da pessoa aberta.
export function htmlFila(itens, selId, h) {
  const e = h.esc, lista = itens || [];
  if (!lista.length) return '<section class="fx-fila" aria-label="Fila de hoje"><h3 class="fx-h3">Fila de hoje</h3><p class="sub" style="margin:0">Ninguém na fila hoje.</p></section>';
  return '<section class="fx-fila" aria-label="Fila de hoje"><h3 class="fx-h3">Fila de hoje</h3><div class="fx-fila-lista">' + lista.map((o) => {
    const c = o.c || {}, aberta = String(c.id) === String(selId);
    return '<button type="button" class="fx-fcard' + (aberta ? ' sel' : '') + '" data-fx="pessoa" data-id="' + e(c.id) + '" aria-pressed="' + aberta + '">' +
      '<span class="fx-fnome">' + e(c.nome || c.email || 'Sem nome') + '</span>' +
      '<span class="fx-fmeta"><span class="pill u-' + e(c.urgencia) + '"><span class="dot"></span>' + e(URG[c.urgencia] || c.urgencia || '—') + '</span>' +
      (o.novas > 0 ? '<span class="fx-novas">' + o.novas + (o.novas === 1 ? ' nova' : ' novas') + '</span>' : '') + '</span>' +
      '<span class="fx-fprox">' + e(o.proxima || '') + '</span>' +
      (o.sub ? '<span class="fx-fsub">' + e(o.sub) + '</span>' : '') + '</button>';
  }).join('') + '</div></section>';
}

// d = { c, urgLabel, estagioLabel, personaLabel, cidade, temConta, motivo, etapa (1..7), estagios: [{k,l}], chk: { pct, feitos, abertos, vencem3, adicionados } | null, ultima }
export function htmlHeader(d, h) {
  const e = h.esc, c = d.c || {}, etapa = Math.min(7, Math.max(1, d.etapa || 1));
  const funil = '<ol class="fx-funil" aria-label="Funil de conversão">' + ETAPAS_FUNIL.map((nome, i) => {
    const n = i + 1, cls = n < etapa ? 'done' : n === etapa ? 'cur' : 'next';
    return '<li class="fx-seg ' + cls + '" data-etapa="' + n + '"' + (n === etapa ? ' aria-current="step"' : '') + '><span class="fx-segn">' + n + '</span><span class="fx-segt">' + e(nome) + '</span></li>';
  }).join('') + '</ol>' +
    '<p class="sub fx-funil-txt">Etapa atual: <b>' + e(ETAPAS_FUNIL[etapa - 1]) + '</b>' + (etapa < 7 ? ' · Próxima: ' + e(ETAPAS_FUNIL[etapa]) : '') + '</p>';
  const k = d.chk;
  const avanco = k
    ? '<h4 class="fx-h4">Avanço do projeto dela</h4><div class="dprog" role="progressbar" aria-label="Checklist feito por ela" aria-valuenow="' + e(k.pct) + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + e(k.pct) + '%"></span></div>' +
      '<p class="sub fx-av-txt">' + e(k.pct) + '% · feitos por ela ' + e(k.feitos) + ' · abertos ' + e(k.abertos) + ' · vencem em até 3 dias ' + e(k.vencem3) + ' · adicionados por ela ' + e(k.adicionados) + '</p>'
    : '<h4 class="fx-h4">Avanço do projeto dela</h4><p class="sub fx-av-txt">' + e(d.chkMsg || 'Ela ainda não entrou no app, então ainda não tem checklist.') + '</p>';
  return '<header class="fx-head">' +
    '<div class="fx-h-pessoa"><h2 class="fx-nome">' + e(c.nome || c.email || 'Sem nome') + '</h2><p class="sub" style="margin:2px 0 0">' + e(c.email || '') + '</p>' +
    '<div class="ctx" style="margin-top:8px"><span class="pill u-' + e(c.urgencia) + '"><span class="dot"></span>' + e(d.urgLabel || '') + '</span><span class="pill">' + e(d.estagioLabel || '') + '</span><span class="pill">' + e(d.personaLabel || '') + '</span>' +
    (d.cidade ? '<span class="pill">' + e(d.cidade) + '</span>' : '') + '<span class="pill">' + (d.temConta ? 'No app' : 'Sem conta') + '</span></div>' +
    (d.motivo ? '<p class="sub" style="margin:8px 0 0">Por que precisa de atenção: ' + e(d.motivo) + '</p>' : '') +
    '<div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-emailfor="' + e(c.id) + '">Escrever mensagem</button>' +
    '<button class="btn" type="button" data-open1a1="' + e(c.id) + '">Marcar 1:1</button>' +
    '<div class="sel"><select id="stage-pick" aria-label="Mudar estágio">' + (d.estagios || []).map((s) => '<option value="' + e(s.k) + '"' + (s.k === c.estagio ? ' selected' : '') + '>Estágio: ' + e(s.l) + '</option>').join('') + '</select></div></div></div>' +
    '<div class="fx-h-funil"><h4 class="fx-h4">Funil de conversão</h4>' + funil + '</div>' +
    '<div class="fx-h-avanco">' + avanco + (d.ultima ? '<p class="sub fx-av-txt">Última atividade: ' + e(d.ultima) + '</p>' : '') + '</div></header>';
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
    '<li><b>Abas</b>: Conversa (e-mails), Plataforma (o app dela) e Ficha (captação e onboarding).</li>' +
    '<li><b>Sessões</b>: cada uma abre e fecha. Arraste, ou use as setas, para pôr na ordem que preferir.</li></ol>' +
    '<button class="btn" type="button" data-fx="tourFechar">Entendi</button></section>';
}

// ---------- Minhas próximas ações: carrossel e pop-up (Task 9) ----------
// tarefas: Tarefa[] de FX.tarefasDe; i = índice do primeiro cartão visível (0 por padrão).
export function htmlCarrossel(tarefas, h, i) {
  const e = h.esc, ts = tarefas || [], n = ts.length, ini = Math.min(Math.max(0, i || 0), Math.max(0, n - 1));
  if (!n) return '<section class="fx-acoes" id="fx-acoes" aria-label="Minhas próximas ações"><div class="fx-acoes-cab"><h3 class="fx-h3">Minhas próximas ações</h3></div><p class="sub" style="margin:0">Nenhuma ação pendente. Quando ela responder ou o app perceber algo, aparece aqui.</p></section>';
  return '<section class="fx-acoes" id="fx-acoes" aria-label="Minhas próximas ações"><div class="fx-acoes-cab"><h3 class="fx-h3">Minhas próximas ações</h3>' +
    '<div class="fx-acoes-nav"><span class="fx-cont" aria-live="polite">' + (ini + 1) + ' de ' + n + '</span>' +
    '<button type="button" class="fx-seta" data-fx="agPrev" aria-label="Ações anteriores"' + (ini <= 0 ? ' disabled' : '') + '>‹</button>' +
    '<button type="button" class="fx-seta" data-fx="agNext" aria-label="Próximas ações"' + (ini >= n - 1 ? ' disabled' : '') + '>›</button></div></div>' +
    '<div class="fx-car" role="region" aria-roledescription="carrossel" aria-label="Minhas próximas ações" tabindex="0">' + ts.map((t, k) =>
      '<button type="button" class="fx-card' + (k === 0 ? ' first' : '') + '" data-fx="agAbrir" data-i="' + k + '" aria-label="Ação ' + (k + 1) + ' de ' + n + ': ' + e(t.t) + '. Abrir detalhes">' +
      '<span class="fx-n">' + (k + 1) + '</span><span class="fx-t">' + e(t.t) + '</span><span class="fx-tag fx-tag-' + e(String(t.tag || '').toLowerCase()) + '">' + e(t.tag) + '</span></button>').join('') + '</div></section>';
}

export function htmlPopup(tarefas, i, h) {
  const e = h.esc, ts = tarefas || [], n = ts.length;
  if (!n) return '';
  const k = Math.min(Math.max(0, i || 0), n - 1), t = ts[k];
  return '<button type="button" class="fx-pop-bg" data-fx="agFechar" aria-label="Fechar" tabindex="-1"></button>' +
    '<div class="fx-pop" role="dialog" aria-modal="true" aria-labelledby="fx-pop-t" tabindex="-1">' +
    '<p class="fx-pop-tipo"><span class="fx-tag fx-tag-' + e(String(t.tag || '').toLowerCase()) + '">' + e(t.tag) + '</span> Ação ' + (k + 1) + ' de ' + n + '</p>' +
    '<h3 class="fx-pop-t" id="fx-pop-t">' + e(t.t) + '</h3>' +
    '<p class="fx-pop-why"><b>Por que agora:</b> ' + e(t.why) + '</p>' +
    '<div class="actions fx-pop-acoes"><button type="button" class="btn primary" data-fx="agIr" data-k="' + e(t.k) + '" data-id="' + e(t.id) + '">' + e(t.cta) + ' →</button>' +
    '<button type="button" class="btn" data-fx="agFechar">Fechar</button>' +
    '<span class="fx-pop-nav"><button type="button" class="fx-seta" data-fx="agNav" data-d="-1" aria-label="Ação anterior"' + (k <= 0 ? ' disabled' : '') + '>‹</button>' +
    '<button type="button" class="fx-seta" data-fx="agNav" data-d="1" aria-label="Próxima ação"' + (k >= n - 1 ? ' disabled' : '') + '>›</button></span></div></div>';
}

// ---------- Sessão Checklist: démarches, os 4 mais urgentes, Drive privado, Ver mais (Task 11) ----------
// d = { semConta, erro, demarches: [{k,nome,feitos,total}], ativa, totalFeitos, total, itens: ChkItem[], hoje, todos, mais, extraMais }.
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
  return pilulas + drive + passos +
    '<div class="fx-mais"><button type="button" class="btn" data-fx="ckMais" aria-expanded="' + !!d.mais + '">' + (d.mais ? 'Ver menos desta sessão' : 'Ver mais desta sessão') + '</button>' + (d.mais ? '<div class="fx-mais-corpo">' + (d.extraMais || '') + '</div>' : '') + '</div>';
}

// ---------- Sessões em pílulas (Task 12) ----------
// s = { id, titulo, sub, corpo, aberto, area: 'app'|'ela', ativa }. O corpo só vem pintado quando a sessão está aberta.
export function htmlSessao(s, h) {
  const e = h.esc;
  return '<section class="fx-sess' + (s.aberto ? ' aberta' : '') + (s.ativa ? ' ativa' : '') + '" data-sessao="' + e(s.id) + '" data-area="' + e(s.area) + '">' +
    '<div class="fx-sess-cab">' +
    '<span class="fx-grab" draggable="true" role="img" aria-label="Arrastar ' + e(s.titulo) + '" data-id="' + e(s.id) + '" data-area="' + e(s.area) + '">⋮⋮</span>' +
    '<button type="button" class="fx-sess-t" data-fx="sessao" data-id="' + e(s.id) + '" aria-expanded="' + !!s.aberto + '" aria-controls="fx-s-' + e(s.id) + '">' +
    '<span class="fx-sess-nome">' + e(s.titulo) + '</span><span class="fx-sess-sub">' + e(s.sub || '') + '</span></button>' +
    '<span class="fx-mover"><button type="button" class="fx-seta" data-fx="mover" data-id="' + e(s.id) + '" data-d="-1" aria-label="Subir ' + e(s.titulo) + '">↑</button>' +
    '<button type="button" class="fx-seta" data-fx="mover" data-id="' + e(s.id) + '" data-d="1" aria-label="Descer ' + e(s.titulo) + '">↓</button></span></div>' +
    (s.aberto ? '<div class="fx-sess-corpo" id="fx-s-' + e(s.id) + '">' + (s.corpo || '') + '</div>' : '') + '</section>';
}
// ord = { app: [ids], ela: [ids] }; mapa = { id: { titulo, sub, corpo, aberto } }. Dois grupos, como no spec §5.2.
export function htmlSessoes(ord, mapa, h) {
  const grupo = (area, titulo, dica) => '<div class="fx-grupo fx-grupo-' + area + '" role="group" aria-labelledby="fx-g-' + area + '"><h3 class="fx-h3" id="fx-g-' + area + '">' + h.esc(titulo) + '</h3>' +
    '<p class="sub fx-grupo-dica">' + h.esc(dica) + '</p>' +
    ((ord && ord[area]) || []).filter((id) => mapa && mapa[id]).map((id) => htmlSessao(Object.assign({ id, area }, mapa[id]), h)).join('') + '</div>';
  return '<div class="fx-sessoes">' + grupo('app', 'Acompanhar o app dela', 'O que ela vê e faz no app.') + grupo('ela', 'Conhecer e registrar', 'Só a equipe vê.') + '</div>';
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
