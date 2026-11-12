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
