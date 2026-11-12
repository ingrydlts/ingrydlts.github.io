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
