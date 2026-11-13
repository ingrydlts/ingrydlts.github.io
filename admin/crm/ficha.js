// Ficha-universo, fase 1: lógica pura (sem DOM, sem Supabase). O crm.js faz a ligação com os dados e os eventos.
// Padrão de estudio.js e taxonomia.js: funções puras, testadas em Node (db/testes/ficha.test.mjs).

// ---------- Urgência dos passos do checklist (spec §5.4) ----------
// ChkItem = { step_key, category, label, status, due_date, sort_order } (colunas de buscaChecklist em crm.js).
const DIA = 86400e3;
function diasEntre(hoje, data) {
  const a = Date.parse(hoje + 'T00:00:00Z'), b = Date.parse(String(data).slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DIA) : 500;
}
// Feito ou arquivado = 9999 (por último); sem data = 500; com data = dias até ela (negativo se atrasado).
export function urgenciaItem(item, hoje) {
  if (!item || item.status === 'concluido' || item.status === 'arquivado') return 9999;
  if (!item.due_date) return 500;
  return diasEntre(hoje, item.due_date);
}
// Os n mais urgentes, numa cópia (não mexe na lista de entrada). Ordenação estável: empate fica na ordem de entrada.
export function maisUrgentes(itens, n, hoje) {
  return (itens || []).map((x, i) => ({ x, i, u: urgenciaItem(x, hoje) }))
    .sort((a, b) => a.u - b.u || a.i - b.i).slice(0, n).map((o) => o.x);
}

// ---------- Démarches (spec §5.4) ----------
// `mapa` é o bloco `processos` de content/checklist-templates.json do app (cópia em processos.json):
// { porItem, porCategoria, definicoes, abas, ordem }. Porte de assets/js/processos.js do app, sem o marcador {trilha}.
const PROCESSO_PADRAO = 'visa';
const mp = (mapa) => mapa || {};

// Démarche de um passo: criado por ela ("meu:<chave>") > exceção por step_key > categoria > 'visa'.
export function processoDoItem(mapa, stepKey, categoria) {
  const m = mp(mapa);
  if (typeof categoria === 'string' && categoria.indexOf('meu:') === 0 && categoria.length > 4) return categoria.slice(4);
  if (m.porItem && m.porItem[stepKey]) return m.porItem[stepKey];
  if (m.porCategoria && m.porCategoria[categoria]) return m.porCategoria[categoria];
  return PROCESSO_PADRAO;
}
// Nome curto da pílula: o da persona (abas), senão o genérico (definicoes), senão a própria chave. "{trilha}" cai no genérico.
export function rotuloDemarche(mapa, chave, persona) {
  const m = mp(mapa), def = (m.definicoes && m.definicoes[chave]) || { label: chave };
  const t = m.abas && m.abas[persona] && m.abas[persona][chave];
  return !t || String(t).indexOf('{trilha}') >= 0 ? def.label : t;
}
function ordemDemarches(mapa) {
  const m = mp(mapa), base = Array.isArray(m.ordem) ? m.ordem : Object.keys(m.definicoes || {});
  return base;
}
// As pílulas (sem "Todas"): só démarches com ao menos 1 passo. Ordem: a do catálogo, depois as chaves próprias em ordem alfabética.
export function demarchesDe(mapa, persona, itens) {
  const por = {};
  (itens || []).forEach((i) => {
    const k = processoDoItem(mapa, i.step_key, i.category);
    (por[k] = por[k] || { k, nome: rotuloDemarche(mapa, k, persona), feitos: 0, total: 0 });
    por[k].total++; if (i.status === 'concluido') por[k].feitos++;
  });
  const ord = ordemDemarches(mapa), conhecidas = ord.filter((k) => por[k]);
  const extras = Object.keys(por).filter((k) => ord.indexOf(k) < 0).sort();
  return conhecidas.concat(extras).map((k) => por[k]);
}
export function filtrarPorDemarche(mapa, itens, k) {
  if (!k || k === 'todas') return (itens || []).slice();
  return (itens || []).filter((i) => processoDoItem(mapa, i.step_key, i.category) === k);
}

// ---------- Funil de conversão e aba padrão (spec §3.1) ----------
export const ETAPAS_FUNIL = ['Entrou no funil', 'Recebeu o guia', '1:1 oferecido', '1:1 marcado', '1:1 feito', 'Plataforma oferecida', 'Na plataforma'];
// A maior etapa atingida (1 a 7). Cada etapa tem a sua condição, sem exigir as anteriores: o dado real tem buracos.
// Contato = linha de `contatos` (user_id, estagio); ctx = { mails, propostas: [{ titulo }], temBilan }.
export function etapaFunil(c, ctx) {
  const x = ctx || {}, mails = x.mails || [], props = x.propostas || [], cc = c || {};
  const feito1a1 = cc.estagio === 'um_a_um' || cc.estagio === 'concluido';
  const conds = [
    true,
    mails.length > 0,
    mails.some((m) => m.modelo === 'guia_chamada') || props.some((p) => /1:1/.test(String((p && p.titulo) || ''))),
    cc.estagio === 'um_a_um',
    feito1a1 && !!x.temBilan,
    mails.some((m) => m.modelo === 'boas_vindas'),
    !!cc.user_id
  ];
  let n = 1;
  conds.forEach((ok, i) => { if (ok) n = i + 1; });
  return n;
}
// Quem já converteu (tem conta no app) abre em Plataforma; quem está na captação, em Ficha.
export function abaPadrao(c) { return c && c.user_id ? 'plataforma' : 'ficha'; }

// ---------- Minhas próximas ações: só tarefas da equipe (spec §4) ----------
// Tarefa = { id, k, t, why, tag: 'Dela'|'Reunião'|'Funil', cta, dest: { tab, sessao? } }. O que a pessoa adiciona não entra.
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const comNome = (verbo, nome) => (primeiroNome(nome) ? verbo + ' ' + primeiroNome(nome) : verbo);
export function tarefasDe(ctx, rotuloProcesso) {
  const x = ctx || {}, rot = rotuloProcesso || ((k) => k), out = [];
  if (x.respostasNovas > 0) out.push({ id: 'resposta', k: 'resposta', t: comNome('Responder', x.nome), tag: 'Dela', cta: 'Abrir a conversa',
    why: x.respostasNovas === 1 ? 'Ela respondeu um e-mail e ainda não foi vista.' : 'Ela mandou ' + x.respostasNovas + ' respostas por e-mail que ainda não foram vistas.', dest: { tab: 'conversa' } });
  if (x.chatNaoLidas > 0) out.push({ id: 'chat', k: 'chat', t: 'Ler as mensagens dela no app', tag: 'Dela', cta: 'Abrir o chat',
    why: x.chatNaoLidas === 1 ? 'Há 1 mensagem dela no chat do app sem ler.' : 'Há ' + x.chatNaoLidas + ' mensagens dela no chat do app sem ler.', dest: { tab: 'plataforma', sessao: 'chat' } });
  (x.processosDetectados || []).forEach((k) => out.push({ id: 'processo:' + k, k: 'processo', t: 'Decidir o processo ' + rot(k), tag: 'Dela', cta: 'Ver o processo',
    why: 'O app percebeu sinais de que ela pode precisar de ' + rot(k) + '. Aprove ou descarte a sugestão.', dest: { tab: 'plataforma', sessao: 'checklist' } }));
  if (x.bilanPendente) out.push({ id: 'bilan', k: 'bilan', t: 'Enviar o bilan da conversa', tag: 'Reunião', cta: 'Abrir o bilan',
    why: 'A leitura da reunião está pronta e o e-mail do bilan ainda não saiu.', dest: { tab: 'plataforma', sessao: 'bilan' } });
  if (x.dossieFalta > 0) out.push({ id: 'dossie', k: 'dossie', t: 'Completar o dossiê (' + x.dossieFalta + (x.dossieFalta === 1 ? ' pergunta' : ' perguntas') + ')', tag: 'Reunião', cta: 'Abrir o dossiê',
    why: 'Faltam respostas do dossiê dela. Pergunte na próxima conversa ou peça que ela complete no app.', dest: { tab: 'dossie' } });
  const pe = x.proximoEmail;
  if (pe && pe.quando === 'agora') out.push({ id: 'funil', k: 'funil', t: pe.titulo || 'Próximo passo do funil', tag: 'Funil', cta: 'Escrever a mensagem',
    why: pe.angulo || 'É a hora de dar o próximo passo no funil.', dest: { tab: 'conversa' } });
  return out;
}

// ---------- Fila de hoje (spec §3.1) ----------
// Texto curto da próxima ação da pessoa, o mesmo da primeira ação do quadro (critério de aceite do spec §15).
export function acaoRapida(c, ctx, rotuloProcesso) {
  const x = ctx || {}, rot = rotuloProcesso || ((k) => k);
  if (x.respostasNovas > 0) return comNome('Responder', c && c.nome);
  if ((x.processosDetectados || []).length) return 'Decidir o processo ' + rot(x.processosDetectados[0]);
  return 'Abrir a ficha';
}
const RANK_URG = { alta: 0, media: 1, baixa: 2 };
// Mais respostas/mensagens não vistas primeiro; empate por urgência (Alta, Média, Baixa); depois a ordem de entrada. Devolve uma cópia.
export function ordenarFila(itens) {
  const rk = (u) => (u in RANK_URG ? RANK_URG[u] : 9);
  return (itens || []).map((o, i) => ({ o, i })).sort((a, b) => (b.o.novas || 0) - (a.o.novas || 0) || rk(a.o.c && a.o.c.urgencia) - rk(b.o.c && b.o.c.urgencia) || a.i - b.i).map((z) => z.o);
}

// ---------- Ordem das sessões e preferências do navegador (spec §5.2) ----------
export const SESSOES_PADRAO = { app: ['chat', 'inicio', 'checklist'], ela: ['bilan', 'hist'] };
export function moverSessao(ordem, id, delta) {
  const o = (ordem || []).slice(), i = o.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= o.length) return o;
  o.splice(i, 1); o.splice(j, 0, id); return o;
}
// Solta `id` antes de `antesDe` (null = no fim). Só mexe dentro da própria lista.
export function reordenarSessao(ordem, id, antesDe) {
  const o = (ordem || []).slice(), i = o.indexOf(id);
  if (i < 0 || id === antesDe) return o;
  o.splice(i, 1);
  const j = antesDe == null ? -1 : o.indexOf(antesDe);
  if (j < 0) o.push(id); else o.splice(j, 0, id);
  return o;
}
// Ordem salva → ordem válida: descarta ids desconhecidos e repetidos, acrescenta os novos no fim.
export function normalizarOrdem(salva, padrao) {
  const base = padrao || [], vistos = {}, out = [];
  (Array.isArray(salva) ? salva : []).forEach((id) => { if (base.indexOf(id) >= 0 && !vistos[id]) { vistos[id] = 1; out.push(id); } });
  base.forEach((id) => { if (!vistos[id]) out.push(id); });
  return out;
}
const CHAVE_ORD = 'crm_ficha_ord_v1', CHAVE_TOUR = 'crm_ficha_tour';
// localStorage pode estar bloqueado ou cheio: nunca lança.
export function lerPrefs(storage) {
  const out = { ord: null, tour: true };
  try {
    const t = storage.getItem(CHAVE_TOUR); if (t === '0') out.tour = false;
  } catch (e) { /* segue com o padrão */ }
  try {
    const raw = storage.getItem(CHAVE_ORD), v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.ord = { app: normalizarOrdem(v.app, SESSOES_PADRAO.app), ela: normalizarOrdem(v.ela, SESSOES_PADRAO.ela) };
  } catch (e) { out.ord = null; }
  return out;
}
export function gravarPrefs(storage, prefs) {
  const p = prefs || {};
  try { if (p.ord) storage.setItem(CHAVE_ORD, JSON.stringify({ app: p.ord.app, ela: p.ord.ela })); } catch (e) { /* ignora */ }
  try { if (typeof p.tour === 'boolean') storage.setItem(CHAVE_TOUR, p.tour ? '1' : '0'); } catch (e) { /* ignora */ }
}
