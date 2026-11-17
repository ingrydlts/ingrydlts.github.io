// Ficha-universo, fase 1: lógica pura (sem DOM, sem Supabase). O crm.js faz a ligação com os dados e os eventos.
// Padrão de estudio.js e taxonomia.js: funções puras, testadas em Node (db/testes/ficha.test.mjs).

// ---------- Urgência dos passos do checklist (spec §5.4) ----------
// ChkItem = { step_key, category, label, status, due_date, sort_order } (colunas de buscaChecklist em crm.js).
export { calcularUso } from './ficha-uso.js?v=2026-11-17.12';
export * as funil from './funil.js?v=2026-11-17.12';   // Funil por próxima ação (lógica pura); o crm.js usa FX.funil
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

// ---------- A conta do checklist, igual à do app ----------
// Uma regra só para todo "X de Y" do CRM (cabeçalho, pílula "Todas", prévia). Porte do que o app faz:
//  · os passos que ela vê são os de checklist_items (sem os arquivados) + as ações da equipe que meu_caso() entrega:
//    dono 'ela', canal 'plataforma', publicada, e (sem lista, ou de uma lista publicada); as "na mesma ligação" não contam (absorvido);
//  · as ações da equipe só aparecem na aba principal (a primeira démarche que ainda tem passo aberto); numa aba só dos itens, essas ações não entram.
const absorvidoApp = (p) => !!p && /mesma\s+liga[cç][aã]o/i.test(p.prazo_texto || '');
export function passosPublicadosDoApp(acoes, listas) {
  const pub = new Set((listas || []).filter((l) => l && l.estado === 'publicado').map((l) => l.chave));
  return (acoes || []).filter((a) => a && a.dono === 'ela' && a.canal === 'plataforma' && a.publicada_em && (!a.lista_chave || pub.has(a.lista_chave)) && !absorvidoApp(a));
}
// dem = 'todas' (tudo o que o app mostra, somando as abas) ou a chave da démarche (como a aba dela no app).
// Devolve { feitos, total, itens (checklist_items da vista), passos (ações publicadas da vista), principal }.
export function contaChecklistApp(o) {
  const x = o || {}, ativos = (x.itens || []).filter((i) => i.status !== 'arquivado');
  const grupos = demarchesDe(x.mapa, x.persona, ativos), principal = ((grupos.find((g) => g.feitos < g.total) || grupos[0]) || {}).k || null;
  const todosPassos = passosPublicadosDoApp(x.acoes, x.listas);
  const dem = !x.dem || x.dem === 'todas' || !grupos.some((g) => g.k === x.dem) ? 'todas' : x.dem;
  const itens = filtrarPorDemarche(x.mapa, ativos, dem);
  const passos = dem === 'todas' || dem === principal ? todosPassos : [];
  const feitos = itens.filter((i) => i.status === 'concluido').length + passos.filter((a) => a.estado === 'concluida').length;
  return { dem, principal, itens, passos, feitos, total: itens.length + passos.length };
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
    feito1a1 && (!!x.temBilan || !!x.umFeito),   // o Bilan só vive na tela; um_a_um 'feito' fica gravado
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
  // A próxima ação do Potencial (faixa × situação) também vira cartão. "Responder" já tem o seu cartão acima; "manter na sequência" não é ação.
  const pa = x.potAcao;
  if (pa && pa.titulo && pa.canal !== 'Nenhuma' && !/^Responder/.test(pa.titulo)) out.push({ id: 'potencial', k: 'potencial', t: pa.titulo, tag: 'Potencial', cta: 'Abrir a conversa', why: pa.porque + (x.potNota != null ? ' (Potencial ' + x.potNota + ' de 100)' : ''), texto: pa.texto || '', dest: { tab: 'conversa' } });
  if (x.bilanPendente) out.push({ id: 'bilan', k: 'bilan', t: 'Enviar o bilan da conversa', tag: 'Reunião', cta: 'Abrir o bilan',
    why: 'A leitura da reunião está pronta e o e-mail do bilan ainda não saiu.', dest: { tab: 'plataforma', sessao: 'bilan' } });
  if (x.dossieFalta > 0) out.push({ id: 'dossie', k: 'dossie', t: 'Completar o dossiê (' + x.dossieFalta + (x.dossieFalta === 1 ? ' pergunta' : ' perguntas') + ')', tag: 'Reunião', cta: 'Abrir o dossiê',
    why: 'Faltam respostas do dossiê dela. Pergunte na próxima conversa ou peça que ela complete no app.', dest: { tab: 'dossie' } });
  // As ações da equipe gravadas no caso (caso_acoes, dono "ingryd"): as da reunião (Notion) e as que a Ingryd acrescenta com "Adicionar" (canal "so_eu").
  (x.acoes || []).slice(0, 12).forEach((a) => {
    const so = a.canal === 'so_eu';
    out.push({ id: 'acao:' + a.id, k: 'acao', acaoId: a.id, t: a.titulo, tag: so ? 'Só eu' : 'Reunião', cta: 'Abrir em Só eu',
      why: (so ? 'Tarefa sua neste caso. Ela não vê nada daqui.' : 'Encaminhamento da reunião' + (a.canalRotulo ? ' · ' + a.canalRotulo : '') + '.') + (a.prazoTxt ? ' Prazo: ' + a.prazoTxt + '.' : ''),
      dest: { tab: 'plataforma', sessao: 'eu' } });
  });
  const pe = x.proximoEmail;
  if (pe && pe.quando === 'agora') out.push({ id: 'funil', k: 'funil', t: pe.titulo || 'Próximo passo do funil', tag: 'Funil', cta: 'Escrever a mensagem',
    why: pe.angulo || 'É a hora de dar o próximo passo no funil.', dest: { tab: 'conversa' } });
  return out;
}

// O quadro de urgência do bloco "Minhas próximas ações": só existe quando há algo que não pode esperar. Devolve as razões em frases curtas.
export function urgentes(ctx) {
  const x = ctx || {}, out = [], pl = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  if (x.respostasNovas > 0) out.push(pl(x.respostasNovas, 'resposta dela esperando', 'respostas dela esperando'));
  if (x.chatNaoLidas > 0) out.push(pl(x.chatNaoLidas, 'mensagem dela no app sem ler', 'mensagens dela no app sem ler'));
  if ((x.processosDetectados || []).length) out.push(pl(x.processosDetectados.length, 'processo para decidir', 'processos para decidir'));
  if (x.atrasados > 0) out.push(pl(x.atrasados, 'passo do checklist atrasado', 'passos do checklist atrasados'));
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
// Fase 2: o app dela ganha Espaço, Guias e Perfil; "Conhecer e registrar" ganha Só eu, O que ela trouxe e Mais detalhes.
export const SESSOES_PADRAO = { app: ['home', 'chat', 'checklist', 'espaco', 'perfil'], ela: ['eu', 'bilan', 'trouxe', 'sinais', 'hist', 'mais'] };
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
    if (v && typeof v === 'object' && !Array.isArray(v)) out.ord = { app: normalizarOrdem(Array.isArray(v.app) && v.app.indexOf('home') < 0 ? ['home'].concat(v.app) : v.app, SESSOES_PADRAO.app), ela: normalizarOrdem(v.ela, SESSOES_PADRAO.ela) };
  } catch (e) { out.ord = null; }
  return out;
}
export function gravarPrefs(storage, prefs) {
  const p = prefs || {};
  try { if (p.ord) storage.setItem(CHAVE_ORD, JSON.stringify({ app: p.ord.app, ela: p.ord.ela })); } catch (e) { /* ignora */ }
  try { if (typeof p.tour === 'boolean') storage.setItem(CHAVE_TOUR, p.tour ? '1' : '0'); } catch (e) { /* ignora */ }
}

// ---------- Cabeçalho fixo: tipo da pessoa e cartões (spec 2026-11-13-crm-cabecalho-fixo-design.md) ----------
// assinante = assinatura ativa ou em teste; plataforma = tem conta no app e não assina (ou a assinatura não está em dia); lead = o resto.
export function tipoCabecalho(c, assin) {
  if (assin && (assin.status === 'active' || assin.status === 'trialing')) return 'assinante';
  // O app só abre para quem paga: sem nenhuma assinatura registrada a pessoa é lead, mesmo com conta criada.
  return assin ? 'plataforma' : 'lead';
}
const ETIQUETA_PAGTO = {
  active: ['Assinatura ativa', 'ok'], trialing: ['Em teste', 'ok'], past_due: ['Pagamento em atraso', 'aviso'],
  canceled: ['Cancelada', 'aviso'], unpaid: ['Pagamento pendente', 'aviso'], incomplete: ['Pagamento pendente', 'aviso']
};
export function etiquetaPagamento(assin) {
  if (!assin) return { texto: 'Não assinante', tom: 'neutro' };
  const e = ETIQUETA_PAGTO[assin.status];
  return e ? { texto: e[0], tom: e[1] } : { texto: String(assin.status || 'Assinatura'), tom: 'neutro' };
}
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const dm = (iso) => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(String(iso || '')); return m ? m[2] + '/' + m[1] : '—'; };
const dma = (iso) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
function fmtDuracao(seg) {
  if (seg < 60) return Math.round(seg) + ' s';
  const min = Math.round(seg / 60);
  return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
}
const haDias = (n) => (n === 0 ? 'hoje' : 'há ' + plural(n, 'dia', 'dias'));
const cartao = (rotulo, valor, sub, tom, detalhes) => { const o = tom ? { rotulo, valor, sub, tom } : { rotulo, valor, sub }; if (detalhes) o.detalhes = detalhes; return o; };

function cartoesUso(d) {
  const u = d.uso || {}, k = d.chk;
  let sessoes;
  if (u.sessoes > 0) sessoes = cartao('Sessões', String(u.sessoes), u.diasDesdeUltima != null ? 'última ' + haDias(u.diasDesdeUltima) : '');
  else if (u.semSessao > 0) sessoes = cartao('Sessões', '—', plural(u.semSessao, 'clique sem sessão registrada', 'cliques sem sessão registrada'));
  else sessoes = cartao('Sessões', '—', u.diasDesdeUltima != null ? 'nenhuma nos últimos 30 dias · última ' + haDias(u.diasDesdeUltima) : 'ainda sem cliques');
  const pouco = u.sessoes > 0 && !u.suficiente ? 'poucos dados (menos de 3 sessões)' : u.semSessao > 0 ? 'sessões não identificadas' : u.diasDesdeUltima != null ? 'nenhuma sessão nos últimos 30 dias' : 'sem cliques para calcular';
  const cliques = u.suficiente && u.cliquesPorSessao != null ? cartao('Cliques por sessão', String(u.cliquesPorSessao).replace('.', ','), 'média das sessões') : cartao('Cliques por sessão', '—', pouco);
  const dur = u.suficiente && u.duracaoSeg != null ? cartao('Duração (estimada)', fmtDuracao(u.duracaoSeg), 'do 1º ao último clique') : cartao('Duração (estimada)', '—', pouco);
  let chk;
  if (k) {
    const alerta = k.atrasados > 0 || k.vencem3 > 0;
    chk = cartao('Checklist', k.feitos + ' de ' + k.total, k.atrasados > 0 ? plural(k.atrasados, 'atrasado', 'atrasados') : k.vencem3 > 0 ? plural(k.vencem3, 'prazo vence', 'prazos vencem') + ' em 3 dias' : 'sem prazo perto', alerta ? 'alerta' : undefined);
  } else chk = cartao('Checklist', '—', d.chkMsg || 'ainda não carregou');
  return [sessoes, cliques, dur, chk];
}
// ---------- O que ela já pagou (db/crm-pagamentos.sql) ----------
// Valor com o símbolo da moeda: € 20, € 20,50, R$ 600. Moeda fora do comum cai no código (USD 10).
export function fmtMoeda(valor, moeda) {
  const v = Number(valor), m = String(moeda || 'EUR').toUpperCase();
  if (!Number.isFinite(v)) return '—';
  const n = v.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return (m === 'EUR' ? '€' : m === 'BRL' ? 'R$' : m) + ' ' + n;
}
// pagamentos: [{ servico, valor_centavos, moeda, pago_em }]. Soma por moeda (nunca mistura € com R$), do mais recente ao mais antigo.
// Devolve { n, texto: '€ 70' | '€ 70 + R$ 600' | '€ 0', linhas: [[quando, 'valor · serviço']] }
export function resumoPagamentos(pagamentos) {
  const lista = (pagamentos || []).filter((p) => p && Number(p.valor_centavos) > 0).slice().sort((a, b) => String(b.pago_em).localeCompare(String(a.pago_em)));
  const porMoeda = new Map();
  for (const p of lista) { const m = String(p.moeda || 'EUR').toUpperCase(); porMoeda.set(m, (porMoeda.get(m) || 0) + Number(p.valor_centavos)); }
  const moedas = [...porMoeda.keys()].sort((a, b) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b)));
  const quando = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) : '—'; };
  return {
    n: lista.length,
    texto: moedas.length ? moedas.map((m) => fmtMoeda(porMoeda.get(m) / 100, m)).join(' + ') : '€ 0',
    linhas: lista.map((p) => [quando(p.pago_em), fmtMoeda(Number(p.valor_centavos) / 100, p.moeda) + ' · ' + String(p.servico || 'Pagamento')])
  };
}
// O cartão "Já gastou": o acumulado e, ao abrir, cada pagamento (quando, valor e serviço). Sem pagamento: só para quem é cliente.
function cartaoGasto(d, sempre) {
  const r = resumoPagamentos(d.pagamentos);
  if (!r.n) return sempre ? [cartao('Já gastou', '€ 0', 'nenhum pagamento registrado')] : [];
  return [cartao('Já gastou', r.texto, plural(r.n, 'pagamento', 'pagamentos'), 'ok', r.linhas)];
}

function cartaoRespostas(d) {
  return cartao('Respostas', String(d.respostas || 0), d.respostasNovas > 0 ? d.respostasNovas + ' esperando você' : 'nenhuma esperando você');
}
// d = { c, estagioLabel, assin, uso, mailsTotal, mailsAbertos, mailsClicados, entradas, diasNaBase, respostas, respostasNovas, proximo: { titulo, quando }, chk, chkMsg, agora }
export function cartoesDe(tipo, d) {
  const c = d.c || {}, estagio = cartao('Estágio', d.estagioLabel || '—', c.criado_em ? 'deixou o e-mail em ' + dm(c.criado_em) : '');
  if (tipo === 'assinante') {
    const a = d.assin || {}, fimTeste = a.status === 'trialing';
    const dataCobr = fimTeste ? (a.teste_fim || a.periodo_fim) : a.periodo_fim;
    const rotCobr = fimTeste ? 'Fim do teste' : a.cancela_no_fim ? 'Acesso até' : 'Próxima cobrança';
    const passou = !!dataCobr && Date.parse(dataCobr) < (d.agora || Date.now()) && !a.cancela_no_fim;
    const subCobr = passou ? 'data já passou: confira no Stripe' : fimTeste ? (a.cancela_no_fim ? 'cancela no fim do teste' : 'depois vira cobrança') : a.cancela_no_fim ? 'cancela no fim do período' : 'renovação automática';
    const dias = a.criado_em ? Math.floor(((d.agora || Date.now()) - Date.parse(a.criado_em)) / 864e5) : null;
    const desde = dias == null || !Number.isFinite(dias) ? cartao('Assinante desde', '—', '') : cartao('Assinante desde', dias < 30 ? plural(Math.max(dias, 0), 'dia', 'dias') : plural(Math.floor(dias / 30), 'mês', 'meses'), 'desde ' + dma(a.criado_em));
    return { blocos: [
      { titulo: 'Pagamento', cartoes: [cartao('Plano', a.plano || '—', etiquetaPagamento(a).texto, 'ok'), cartao(rotCobr, dm(dataCobr), subCobr, passou ? 'alerta' : undefined), desde] },
      { titulo: 'Uso da plataforma · últimos 30 dias', cartoes: cartoesUso(d) }
    ], nota: 'Baseado nos 300 cliques mais recentes. Valor mensal, ticket e LTV ficam para uma segunda etapa.' };
  }
  if (tipo === 'plataforma') {
    const uso = cartoesUso(d);
    return { blocos: [{ titulo: null, cartoes: [estagio, uso[0], uso[1], uso[2], uso[3], cartaoRespostas(d)] }], nota: 'Uso baseado nos 300 cliques mais recentes.' };
  }
  // lead
  const n = c.dias_sem_sinal;
  const parada = n == null ? cartao('Parada há', '—', 'sem atividade registrada') : cartao('Parada há', plural(n, 'dia', 'dias'), d.ultimoSinal || 'último sinal dela', n >= 5 ? 'alerta' : undefined);
  const emails = d.mailsTotal > 0 ? cartao('E-mails', d.mailsAbertos + ' de ' + d.mailsTotal, 'abriu · clicou em ' + d.mailsClicados) : cartao('E-mails', '—', 'nenhum e-mail pelo CRM ainda');
  const entradas = cartao('Entradas', plural(d.entradas || 1, 'funil', 'funis'), d.diasNaBase != null ? 'na base há ' + plural(d.diasNaBase, 'dia', 'dias') : '');
  const p = d.proximo || {}, quando = p.quando === 'agora' ? 'Pode enviar' : p.quando === 'esperar' ? 'Aguarde' : 'Nada agora';
  const prox = cartao('Próximo e-mail', quando, String(p.titulo || '').slice(0, 48));
  return { blocos: [{ titulo: null, cartoes: [estagio, parada, emails, entradas, cartaoRespostas(d), prox] }], nota: null };
}

// ---------- Cabeçalho minimalista (comentários da Ingryd no artefato, 15/11) ----------
// Poucos cartões, poucas palavras. Lead: quando entrou, onde deixou o e-mail e se abriu. Estágio 1:1: a data do 1:1.
// Plataforma: a última vez que entrou no app. O plano e tudo que vem com ele vira um dropdown dentro do cartão do plano.
// Nada de cliques, sessões ou duração para quem ainda não está na plataforma. O cartão "Já gastou" mostra o acumulado e abre cada pagamento.
// d = { c, assin, uso, chk, entradaEm, origemLabel, mailsTotal, mailsAbertos, um1a1, ultimoAcesso, pagamentos, agora }
export function cartoesMinimos(tipo, d) {
  const c = d.c || {}, agora = d.agora || Date.now();
  const dias = (iso) => (iso ? Math.max(0, Math.floor((agora - Date.parse(iso)) / 864e5)) : null);
  if (tipo === 'lead') {
    const out = [cartao('Entrou', dm(d.entradaEm || c.criado_em), d.origemLabel || '')];
    out.push(d.mailsTotal > 0 ? cartao('E-mail', d.mailsAbertos > 0 ? 'Abriu' : 'Não abriu', plural(d.mailsTotal, 'enviado', 'enviados')) : cartao('E-mail', '—', 'nenhum enviado'));
    if (c.estagio === 'um_a_um') out.push(d.um1a1 ? cartao('1:1', dm(d.um1a1), d.um1a1Hora || '', 'ok') : cartao('1:1', 'a combinar', ''));
    out.push(...cartaoGasto(d, false));
    return { blocos: [{ titulo: null, cartoes: out }], nota: null };
  }
  const nd = dias(d.ultimoAcesso);
  const acesso = cartao('Último acesso', nd == null ? '—' : haDias(nd), nd == null ? 'ainda sem cliques' : dma(d.ultimoAcesso));
  if (tipo === 'assinante') {
    const a = d.assin || {}, teste = a.status === 'trialing', fim = teste ? (a.teste_fim || a.periodo_fim) : a.periodo_fim, k = d.chk, u = d.uso || {};
    const det = [['Situação', etiquetaPagamento(a).texto], [teste ? 'Fim do teste' : a.cancela_no_fim ? 'Acesso até' : 'Próxima cobrança', dm(fim)],
      ['Assinante desde', a.criado_em ? dma(a.criado_em) : '—']];
    if (u.sessoes > 0) det.push(['Sessões (30 dias)', String(u.sessoes)]);
    if (u.suficiente && u.cliquesPorSessao != null) det.push(['Cliques por sessão', String(u.cliquesPorSessao).replace('.', ',')]);
    if (u.suficiente && u.duracaoSeg != null) det.push(['Duração estimada', fmtDuracao(u.duracaoSeg)]);
    if (k) det.push(['Checklist', k.feitos + ' de ' + k.total + (k.atrasados ? ' · ' + plural(k.atrasados, 'atrasado', 'atrasados') : '')]);
    return { blocos: [{ titulo: null, cartoes: [cartao('Plano', a.plano || '—', etiquetaPagamento(a).texto, 'ok', det), acesso, ...cartaoGasto(d, true)] }], nota: null };
  }
  const k = d.chk;
  return { blocos: [{ titulo: null, cartoes: [acesso, k ? cartao('Checklist', k.feitos + ' de ' + k.total, k.atrasados > 0 ? plural(k.atrasados, 'atrasado', 'atrasados') : '', k.atrasados > 0 ? 'alerta' : undefined) : cartao('Checklist', '—', 'ainda não carregou'), ...cartaoGasto(d, true)] }], nota: null };
}

// ---------- Potencial: um índice de 0 a 100 por pessoa (conversa com a Ingryd, 16/11) ----------
// Alto = quem tem mais chance de aderir (lead) ou de ficar (assinante); Baixo = quem está mais longe de aderir ou mais perto de sair.
// Lead: parte de 20 e soma o que mostra interesse (resposta, e-mail aberto, etapa do funil, vários materiais, prazo urgente, link enviado) e
// desconta o que esfria (e-mails sem abrir, dias sem sinal). Assinante: parte de 50 e mede uso (último acesso, sessões, checklist) e pagamento.
// Cada ponto vem com o motivo, para a tela explicar a nota. Os pesos são um rascunho a calibrar com a base real.
export const FAIXAS_POTENCIAL = { alto: 65, medio: 35 };
export function faixaPotencial(nota) { return nota >= FAIXAS_POTENCIAL.alto ? 'Alto' : nota >= FAIXAS_POTENCIAL.medio ? 'Médio' : 'Baixo'; }
// x = { tipo: 'lead'|'plataforma'|'assinante', etapa (1..7), mails: { total, abertos, clicados }, respostas, capturas, materiais, diasSemSinal, urgencia,
//       linkPagamento, assin, ultimoAcessoDias, sessoes30, chk: { feitos, total, atrasados }|null }
export function potencial(x) {
  const o = x || {}, m = o.mails || {}, motivos = [];
  let base, sinais = 0;
  const soma = (t, p) => { motivos.push({ t, p }); sinais++; };
  if (o.tipo === 'lead') {
    base = 20;
    if (o.respostas > 0) soma('Já escreveu para você', 25);
    if (m.clicados > 0) soma('Clicou em e-mail', 15); else if (m.abertos > 0) soma('Abriu e-mail', 10);
    else if (m.total >= 2) soma(m.total + ' e-mails sem abrir', -10);
    const et = { 3: ['1:1 oferecido', 8], 4: ['1:1 marcado', 20], 5: ['1:1 feito', 25], 6: ['Plataforma oferecida', 15], 7: ['Na plataforma', 15] }[o.etapa];
    if (et) soma(et[0], et[1]);
    if (o.materiais >= 2) soma('Pegou ' + o.materiais + ' materiais', 10); else if (o.capturas >= 2) soma('Pediu o mesmo material ' + o.capturas + 'x', 8);
    if (o.urgencia === 'alta') soma('Prazo urgente', 10);
    if (o.linkPagamento) soma('Link de pagamento enviado', 10);
    if (o.diasSemSinal != null) { if (o.diasSemSinal <= 3) soma('Sinal recente', 10); else if (o.diasSemSinal > 14) soma(o.diasSemSinal + ' dias sem sinal', -15); }
  } else {
    base = 50;
    const d = o.ultimoAcessoDias;
    if (d == null) soma('Nunca acessou o app', -25); else if (d <= 7) soma('Acessou há ' + (d === 0 ? 'menos de 1 dia' : d + (d === 1 ? ' dia' : ' dias')), 20); else if (d <= 14) soma('Último acesso há ' + d + ' dias', 5); else if (d <= 30) soma('Último acesso há ' + d + ' dias', -10); else soma('Mais de 30 dias sem acessar', -25);
    if (o.sessoes30 >= 3) soma(o.sessoes30 + ' sessões em 30 dias', 10); else if (o.sessoes30 === 0 && d != null) soma('Nenhuma sessão em 30 dias', -10);   // quem nunca acessou já foi descontado acima
    if (o.chk && o.chk.total > 0) {
      const pct = o.chk.feitos / o.chk.total;
      if (pct > 0) soma('Checklist ' + Math.round(pct * 100) + '% feito', Math.round(pct * 20));
      if (o.chk.atrasados > 0) soma(o.chk.atrasados + (o.chk.atrasados === 1 ? ' passo atrasado' : ' passos atrasados'), -Math.min(15, o.chk.atrasados * 5));
    }
    const a = o.assin || {};
    if (a.status === 'active') soma('Assinatura ativa', 10); else if (a.status === 'past_due' || a.status === 'unpaid') soma('Pagamento em atraso', -25); else if (a.status === 'canceled') soma('Assinatura cancelada', -40);
    if (a.cancela_no_fim) soma('Vai cancelar no fim do período', -20);
    if (o.respostas > 0) soma('Conversa com você', 5);
  }
  const nota = Math.max(0, Math.min(100, Math.round(base + motivos.reduce((s, z) => s + z.p, 0))));
  motivos.sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  return { nota, faixa: faixaPotencial(nota), motivos, sinais, poucosDados: sinais < 2 };
}

// ---------- Próxima ação sugerida pelo Potencial ----------
// Cruza a faixa (Alto/Médio/Baixo) com a situação da pessoa. Devolve { titulo, canal, porque, texto }; `texto` é uma mensagem pronta para copiar
// (com o nome já no lugar). É sugestão: a Ingryd decide e edita antes de mandar. x = os mesmos dados de potencial() + { nome, gancho }.
export function proximaAcao(x, pot) {
  const o = x || {}, n = (o.nome || '').split(/\s+/)[0] || 'você', m = o.mails || {}, faixa = pot ? pot.faixa : 'Baixo', a = o.assin || {};
  const A = (titulo, canal, porque, texto) => ({ titulo, canal, porque, texto: texto ? texto.replace(/\{nome\}/g, n) : '' });
  const gancho = o.gancho ? ' ' + o.gancho : '';
  if (o.tipo === 'lead') {
    if (o.respostas > 0 && o.respostasNovas > 0) return A('Responder ' + n + ' agora', 'Mensagem', 'Ela escreveu e ainda não foi respondida: é o sinal mais forte que existe.', '');
    if (faixa === 'Alto') {
      if (o.etapa <= 3) return A('Reimpacto personalizado oferecendo o 1:1', 'E-mail', 'Interesse alto e ainda sem 1:1: é a hora de convidar.',
        'Oi, {nome}! Vi que você' + (o.gancho ? ' ' + o.gancho : ' está olhando o seu caso com atenção') + '. Queria te oferecer um 1:1 de 20 min: a gente olha a sua situação e eu te mostro o próximo passo. Qual horário fica bom para você?');
      if (o.etapa === 4) return A('Mandar o preparo do 1:1', 'Mensagem', 'O 1:1 já está marcado: chega mais útil se ela separar os documentos.', 'Oi, {nome}! Para aproveitarmos os 20 min, separe a data em que a sua situação atual termina e o que você já pesquisou. Até lá!');
      if (o.etapa === 5) return A('Oferecer a plataforma com o teste de 7 dias', 'Mensagem', 'O 1:1 já aconteceu e o interesse segue alto: o próximo passo natural é a plataforma.', 'Oi, {nome}! Montei o que combinamos num espaço só seu na plataforma: passos, prazos e o que eu acompanho com você. Dá para testar 7 dias de graça: [link]');
      return A('Fechar a adesão: lembrar do teste grátis', 'Mensagem', 'A plataforma já foi oferecida e o interesse é alto: falta tirar a última dúvida.', 'Oi, {nome}! Passando para ver se ficou alguma dúvida sobre a plataforma. O teste de 7 dias é gratuito e você cancela quando quiser: [link]');
    }
    if (faixa === 'Médio') {
      if (m.total >= 1 && !(m.abertos > 0)) return A('Trocar o assunto do e-mail ou chamar no Instagram', 'E-mail', 'Recebeu e não abriu: o canal ou o assunto não chamou.', 'Oi, {nome}! Te mandei um e-mail e acho que ele se perdeu por aí. Em uma frase: qual é a sua maior dúvida hoje sobre a França?');
      if (m.abertos > 0) return A('Convite curto para o 1:1 com uma pergunta fácil', 'E-mail', 'Abriu e ainda não respondeu: falta um convite concreto e leve.', 'Oi, {nome}! Vi que você' + gancho + '. Quer 20 min comigo? Eu te digo por onde eu começaria no seu caso.');
      return A('Mandar a pergunta única do guia', 'E-mail', 'Ainda sem sinal claro: uma pergunta simples abre a conversa.', 'Oi, {nome}! Qual é o passo que mais te trava hoje? Respondendo isso eu te mando o material certo.');
    }
    if (o.diasSemSinal != null && o.diasSemSinal > 14) return A('Último reimpacto leve, sem pedir nada', 'E-mail', 'Mais de 14 dias sem sinal: um conteúdo útil reacende sem pressionar. Se não abrir, pare por ora.', 'Oi, {nome}! Lembrei de você e separei um conteúdo que costuma ajudar quem está no seu momento: [link]. Sem pressa.');
    if (!(m.total > 0)) return A('Mandar o primeiro e-mail', 'E-mail', 'Ainda não recebeu nenhum e-mail do CRM: o primeiro contato é seu.', 'Oi, {nome}! Vi que você pediu o guia. Me conta: em que ponto você está hoje?');
    return A('Manter na sequência automática', 'Nenhuma', 'Potencial baixo e sem sinal novo: não vale tempo manual agora.', '');
  }
  // Plataforma: assinante ou conta com assinatura registrada.
  if (a.status === 'past_due' || a.status === 'unpaid') return A('Cobrança em atraso: avisar com carinho', 'Mensagem', 'Pagamento em atraso é a causa mais comum de saída, e a mais fácil de resolver.', 'Oi, {nome}! O pagamento da plataforma não passou. Pode ter sido o cartão. Aqui está o link para atualizar: [link]. Qualquer coisa me chama.');
  if (a.cancela_no_fim) return A('1:1 de retenção antes do fim do período', '1:1', 'Ela marcou para cancelar: entender o motivo vale mais que um desconto.', 'Oi, {nome}! Vi que você marcou para cancelar. Antes do fim, topa 15 min comigo? Quero entender o que não serviu e ver se dá para ajustar (ou pausar).');
  if (faixa === 'Alto') return A('Pedir depoimento ou indicação e oferecer um pacote', 'Mensagem', 'Quem usa e avança é o melhor momento para pedir um depoimento e apresentar os serviços com desconto.', 'Oi, {nome}! Fico feliz de ver o seu avanço. Posso usar um trechinho do seu relato (sem o seu nome, se preferir)? E se quiser, tenho pacotes com 20% de desconto para assinantes.');
  if (faixa === 'Médio') return o.chk && o.chk.atrasados > 0
    ? A('Replanejar os passos atrasados', 'Mensagem', 'Tem passo atrasado: o risco é ela desanimar.', 'Oi, {nome}! Vi que alguns prazos passaram. Sem drama: me conta o que travou e a gente reorganiza a ordem.')
    : A('Lembrar do próximo passo do checklist', 'Mensagem', 'Uso razoável: um empurrão no próximo passo mantém o ritmo.', 'Oi, {nome}! Passando para lembrar do seu próximo passo no checklist. Se travou em algo, me conta por aqui.');
  if (o.ultimoAcessoDias == null) return A('Primeiro acesso guiado', '1:1', 'Assina mas nunca entrou: é o maior risco de saída no primeiro mês.', 'Oi, {nome}! Vi que você ainda não entrou na plataforma. Topa 10 min comigo para fazermos o primeiro passo juntas? Aqui está o link de acesso: [link]');
  if (o.ultimoAcessoDias > 30) return A('Reativação pessoal com o passo mais urgente', 'Mensagem', 'Mais de 30 dias sem acessar: lembre do prazo que mais importa agora.', 'Oi, {nome}! Faz um tempo que você não passa por lá. O passo mais urgente do seu caso hoje é [passo]. Quer que eu te ajude a resolver?');
  if (o.chk && o.chk.atrasados > 0) return A('1:1 de 20 min para replanejar', '1:1', 'Passos atrasados e pouco uso: sem plano claro ela tende a sair.', 'Oi, {nome}! Vamos reorganizar os seus prazos juntas? 20 min e você sai com a ordem certa.');
  return A('Mensagem de acompanhamento', 'Mensagem', 'Uso baixo, sem sinal de saída imediata: um contato pessoal costuma bastar.', 'Oi, {nome}! Como está o seu caso? Se algo travou, me conta que eu ajusto o que aparece para você.');
}

// ---------- O Início do app, como ele monta (porte de montarInicio, assets/js/caso.js do app) ----------
// Mesma ordem e mesmas contas: 1) "Oi, nome" (+ escolas); 2) prazos (marcos com data); 3) "Agora" = o primeiro passo da equipe
// (atrasados, depois com data, depois sem data); 4) "Em seguida" = os passos da equipe que sobram + os próximos do checklist geral, até 4;
// 5) atalhos "Só seu". Sem caso publicado (nem board nem passos), o app mostra o Início genérico e `pessoal` vem falso.
const DIA_MS = 864e5;
function diasAteApp(iso, agora) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null;
  const h = new Date(agora === undefined ? Date.now() : agora);
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / DIA_MS);
}
function dataBR(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function quandoTextoApp(d) { return d === null ? '' : d < 0 ? 'passou há ' + (-d) + (d === -1 ? ' dia' : ' dias') : d === 0 ? 'é hoje' : 'faltam ' + d + (d === 1 ? ' dia' : ' dias'); }
export function metaDoPassoApp(p, agora) {
  const d = p.prazo ? diasAteApp(p.prazo, agora) : null;
  if (d !== null && d < 0 && p.estado !== 'concluida') return (-d) + (d === -1 ? ' dia em atraso' : ' dias em atraso');
  return p.prazo ? dataBR(p.prazo) + (d !== null ? ' · ' + quandoTextoApp(d) : '') : (p.prazo_texto || '');
}
export function tipoDoPassoApp(p) {
  if (!p) return 'feito';
  if (p.botao === 'conferir_documentos' && /^docs:[a-z0-9_]{1,30}$/.test(p.passo_chave || '')) return 'documentos';
  if (p.botao === 'marcar_marco') return 'data';
  if (p.botao === 'gerar_rascunho' && /ligar|liga[cç]/i.test(p.titulo || '')) return 'roteiro';
  return 'feito';
}
export function ordenarPassosApp(passos, agora) {
  const grupo = (p) => { const d = p.prazo ? diasAteApp(p.prazo, agora) : null; return d === null ? 2 : d < 0 ? 0 : 1; };
  return (passos || []).filter((p) => p.estado !== 'concluida')
    .sort((a, b) => grupo(a) - grupo(b) || String(a.prazo || '').localeCompare(String(b.prazo || '')) || (a.n || 999) - (b.n || 999) || (a.id - b.id));
}
// A parte curta do "quando" de um passo (a pílula): o que vem antes de " · ", se couber em 22 letras; senão, nada.
export function pilulaDoQuando(texto) {
  if (!texto) return '';
  const i = texto.indexOf(' · '), cabeca = i > -1 ? texto.slice(0, i) : texto;
  return cabeca.length <= 22 ? cabeca : '';
}
// Título do processo na aba do app ("Visa au pair: o status de hoje"): o da persona; sem ele (ou com {trilha}), o rótulo curto.
export function tituloDemarche(mapa, chave, persona) {
  const t = mp(mapa).titulos && mp(mapa).titulos[persona] && mp(mapa).titulos[persona][chave];
  return t && String(t).indexOf('{trilha}') < 0 ? t : rotuloDemarche(mapa, chave, persona);
}
export function temCasoApp(caso) { return !!caso && ((caso.board || []).length > 0 || (caso.acoes || []).length > 0 || (caso.home || []).length > 0); }
// o = { nome, mapa, persona, itens (checklist_items), board (publicado), acoes, listas, quando ({step_key: texto}), agora }
export function inicioDoApp(o) {
  const x = o || {}, agora = x.agora === undefined ? Date.now() : x.agora, board = x.board || [];
  const passos = passosPublicadosDoApp(x.acoes, x.listas);
  const escolas = board.filter((b) => b.tipo === 'escola'), marcos = board.filter((b) => b.tipo === 'marco' && b.dados && b.dados.data);
  const base = contaChecklistApp({ mapa: x.mapa, persona: x.persona, itens: x.itens, acoes: x.acoes, listas: x.listas, dem: 'todas' });
  const ordem = ordenarPassosApp(passos, agora), p = ordem[0] || null;
  let foco = null, seguintes = [];
  if (p) {
    const d = p.prazo ? diasAteApp(p.prazo, agora) : null, tipo = tipoDoPassoApp(p), atrasado = d !== null && d < 0;
    foco = { rotulo: atrasado ? 'Atrasado' : 'Agora', atrasado, titulo: p.titulo, quando: tipo === 'documentos' ? '' : metaDoPassoApp(p, agora),
      botao: tipo === 'data' ? 'Informar a data' : tipo === 'documentos' ? 'Ver os documentos' : 'Feito', roteiro: tipo === 'roteiro' };
    const demarche = base.principal ? tituloDemarche(x.mapa, base.principal, x.persona) : '';
    const dosPassos = ordem.slice(1).map((q) => { const dq = q.prazo ? diasAteApp(q.prazo, agora) : null; return { titulo: q.titulo, atrasado: dq !== null && dq < 0, meta: metaDoPassoApp(q, agora).replace(/^(\d{2}\/\d{2})\/\d{4}/, '$1'), de: demarche }; });
    // Os próximos do checklist geral: abertos, por data (os com data primeiro; sem data mantêm a ordem), como ordenarPorUrgencia do app.
    const quando = x.quando || {};
    const gerais = base.itens.filter((i) => i.status !== 'concluido').slice().sort((a, b) => (a.due_date && b.due_date) ? (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0) : a.due_date ? -1 : b.due_date ? 1 : 0)
      .slice(0, 4).map((i) => ({ titulo: i.titulo_custom || i.label, atrasado: !!(i.due_date && diasAteApp(i.due_date, agora) < 0), meta: i.due_date ? dataBR(i.due_date).slice(0, 5) : pilulaDoQuando(quando[i.step_key]), de: demarche }));
    seguintes = dosPassos.concat(gerais);
  }
  // Página inicial: só o que ela vê — passo do checklist que existe e item do board publicado, nos limites 3 / 3 / 2. Os passos escolhidos vão para o início do "Em seguida".
  const hm = x.home || [], vivos = (x.itens || []).filter((i) => i.status !== 'arquivado');
  const porCat = (c) => hm.filter((h) => h.categoria === c).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.id - b.id);
  const doBoard = (c, max) => porCat(c).map((h) => board.find((b) => b.id === h.board_id)).filter(Boolean).slice(0, max).map((b) => ({ titulo: b.titulo, sub: b.resumo || (b.tipo === 'bilan' ? 'o bilan da nossa conversa' : ''), tipo: b.tipo, conteudo: /^https:\/\//i.test(b.link || '') ? 'link' : b.arquivo_caminho ? 'arquivo' : b.descricao ? 'descricao' : '' }));
  const picks = porCat('checklist').map((h) => vivos.find((i) => i.step_key === h.step_key)).filter(Boolean).slice(0, 3).map((i) => ({ titulo: i.titulo_custom || i.label, feito: i.status === 'concluido', meta: i.due_date ? dataBR(i.due_date).slice(0, 5) : pilulaDoQuando((x.quando || {})[i.step_key]) }));
  const destaques = { checklist: picks, soSeu: doBoard('so_seu', 3), guias: doBoard('guias', 2) };
  const vistos = {}; if (foco) vistos[foco.titulo] = true;
  seguintes = picks.filter((q) => !q.feito).map((q) => ({ titulo: q.titulo, atrasado: false, meta: q.meta, de: '' })).concat(seguintes).filter((q) => { if (vistos[q.titulo]) return false; vistos[q.titulo] = true; return true; }).slice(0, 4);
  const soSeu = { atalhoBilan: !destaques.soSeu.length && board.some((b) => b.tipo === 'bilan'), bilans: destaques.soSeu.filter((b) => b.tipo === 'bilan'), docs: destaques.soSeu.filter((b) => b.tipo !== 'bilan') };
  return { pessoal: temCasoApp({ board, acoes: x.acoes, home: hm }), nome: x.nome || '', destaques, soSeu, escolas: escolas.map((e) => e.titulo),
    marcos: marcos.map((m) => { const d = diasAteApp(m.dados.data, agora); return { titulo: m.titulo, data: dataBR(m.dados.data), dias: d, quando: quandoTextoApp(d), aConfirmar: !!m.dados.a_confirmar }; }),
    foco, seguintes };
}

// ---------- O Espaço do app, como ele monta (porte de montarEspaco, assets/js/caso.js do app) ----------
// De cima para baixo: pergunta(s) da equipe (as rápidas do perfil entram na mesma fila, só o app sabe quais faltam); "O que a equipe percebeu"
// (sem repetir prazo); "Encaminhamentos da Ingryd"; Escolas; Mensagens prontas; Meu Bilan. Seção sem nada não aparece; sem nada, "ainda sendo preparado".
export function duplicaPrazoApp(aviso, marcos, agora) {
  const t = ((aviso && aviso.titulo) || '') + ' ' + ((aviso && aviso.texto) || '');
  if (/\b(prazo|fecha|fechamento|vence|vencimento|faltam|inscri[cç][aã]o)\b/i.test(t)) return true;
  return (marcos || []).some((m) => {
    const d = m && m.dados && m.dados.data; if (!d) return false;
    const f = dataBR(d), curto = f.slice(0, 5), dias = diasAteApp(d, agora);
    return t.indexOf(f) >= 0 || new RegExp('(^|[^0-9])' + curto.replace('/', '\\/') + '([^0-9]|$)').test(t) || (dias !== null && dias > 0 && new RegExp('(^|[^0-9])' + dias + ' dias?').test(t));
  });
}
// o = { board (publicado), avisos: [{tipo, titulo, texto, estado}] (os que ela já vê), escolasDela: [{nome}], agora }
export function espacoDoApp(o) {
  const x = o || {}, agora = x.agora === undefined ? Date.now() : x.agora, board = x.board || [];
  const abertos = (x.avisos || []).filter((a) => a && a.estado !== 'respondido' && a.estado !== 'dispensado');
  const marcos = board.filter((b) => b.tipo === 'marco');
  const docs = board.filter((b) => b.tipo === 'documento' && b.dados && b.dados.direcao === 'recebe').map((d) => {
    const temLink = /^https:\/\//i.test(d.link || ''), temArquivo = !!d.arquivo_caminho, temDescricao = !!(typeof d.descricao === 'string' && d.descricao.trim());
    return { titulo: d.titulo, resumo: d.resumo || '', descricao: temDescricao ? d.descricao : '', conteudo: temLink ? 'link' : temArquivo ? 'arquivo' : '', ordem: d.ordem || 999, id: d.id, novo: temLink || temArquivo || temDescricao };
  }).sort((a, b) => (b.novo ? 1 : 0) - (a.novo ? 1 : 0) || a.ordem - b.ordem || a.id - b.id);
  const escolas = board.filter((b) => b.tipo === 'escola').map((e) => ({ titulo: e.titulo, resumo: e.resumo || '' }));
  const dela = (x.escolasDela || []).map((e) => ({ nome: e.nome }));
  const mensagens = board.filter((b) => b.tipo === 'modelo').map((m) => ({ titulo: m.titulo, resumo: m.resumo || '' }));
  const bilans = board.filter((b) => b.tipo === 'bilan').sort((a, b) => String((b.dados && b.dados.data) || '').localeCompare(String((a.dados && a.dados.data) || ''))).map((b) => ({ titulo: b.titulo, resumo: b.resumo || '' }));
  const e = { perguntas: abertos.filter((a) => a.tipo === 'pergunta'), percebeu: abertos.filter((a) => a.tipo === 'inteligencia' && !duplicaPrazoApp(a, marcos, agora)), docs, escolas, dela, mensagens, bilans };
  e.vazio = !e.perguntas.length && !e.percebeu.length && !docs.length && !escolas.length && !mensagens.length && !bilans.length;
  return e;
}

// ---------- Página inicial: os destaques que a Ingryd escolhe para o Início dela ----------
// Três categorias, as mesmas seções do Início dela (o banco confere de novo, crm-caso-home-so-seu.sql):
//   checklist  até 3 passos do checklist — entram no "Em seguida" do Início
//   so_seu     até 3: o bilan e os encaminhamentos da Ingryd (documento que ela recebe)
//   guias      até 2: documento que ela recebe ou mensagem pronta
export const HOME_LIMITES = { checklist: 3, so_seu: 3, guias: 2 };
export const HOME_ROTULOS = { checklist: 'Checklist', so_seu: 'Só seu', guias: 'Guias' };
// O item do board (bilan, documento, mensagem pronta) pode ir para esta categoria? Prazo e escola não vão para a página inicial.
export function itemPodeNaHome(it, categoria) {
  const t = it && it.tipo, recebe = !!(it && it.dados && it.dados.direcao === 'recebe');
  return categoria === 'so_seu' ? (t === 'bilan' || (t === 'documento' && recebe)) : categoria === 'guias' ? (t === 'modelo' || (t === 'documento' && recebe)) : false;
}
// home = linhas de caso_home { id, categoria, step_key, board_id, ordem }. Devolve { ok, motivo }.
export function podeAdicionarHome(home, categoria) {
  if (!HOME_LIMITES[categoria]) return { ok: false, motivo: 'categoria' };
  const n = (home || []).filter((x) => x.categoria === categoria).length;
  return n >= HOME_LIMITES[categoria] ? { ok: false, motivo: 'cheia', n, max: HOME_LIMITES[categoria] } : { ok: true, n, max: HOME_LIMITES[categoria] };
}
export function homeTem(home, categoria, ref) { return (home || []).find((x) => x.categoria === categoria && (categoria === 'checklist' ? x.step_key === ref : String(x.board_id) === String(ref))) || null; }
// o = { home, itens (checklist_items, sem arquivados), board (todos os itens do board, de qualquer estado) }.
// Devolve { checklist, espaco, guias }: cada um { max, n, itens: [{ id, titulo, meta, publicado, falta }] }. "falta" = o item não existe mais.
export function destaquesDaHome(o) {
  const x = o || {}, home = x.home || [], itens = x.itens || [], board = x.board || [], out = {};
  Object.keys(HOME_LIMITES).forEach((cat) => {
    const linhas = home.filter((h) => h.categoria === cat).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.id - b.id);
    out[cat] = { max: HOME_LIMITES[cat], n: linhas.length, itens: linhas.map((h) => {
      if (cat === 'checklist') { const i = itens.find((y) => y.step_key === h.step_key); return i ? { id: h.id, ref: h.step_key, titulo: i.titulo_custom || i.label, meta: i.status === 'concluido' ? 'feito' : (i.due_date ? 'prazo ' + String(i.due_date).slice(8, 10) + '/' + String(i.due_date).slice(5, 7) : ''), publicado: true, falta: false } : { id: h.id, ref: h.step_key, titulo: h.step_key, meta: '', publicado: true, falta: true }; }
      const b = board.find((y) => y.id === h.board_id);
      return b ? { id: h.id, ref: h.board_id, titulo: b.titulo, meta: b.resumo || '', publicado: b.estado === 'publicado', falta: false } : { id: h.id, ref: h.board_id, titulo: '(item removido)', meta: '', publicado: false, falta: true };
    }) };
  });
  return out;
}
