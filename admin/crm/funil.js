// Funil por próxima ação: lógica pura (sem DOM, sem Supabase). O crm.js liga os dados e os eventos.
// Padrão de ficha.js e estudio.js: funções puras, testadas em Node (db/testes/funil.test.mjs).
// Design: docs/superpowers/specs/2026-11-13-funil-acao-design.md (repositório do hub).
//
// c   = linha de `crm_contatos` (a view que o painel já lê).
// ctx = { assinatura: { status, periodo_fim, cancela_no_fim } | null, comprou: boolean, escreveu: boolean, agora?: ms }

const DIA = 86400e3;

// ---------- Pontos da temperatura (valores de partida, ajustáveis) ----------
// Clique pesa mais que abertura: a abertura é inflada pelo Apple Mail desde 2021.
export const PONTOS = { clique: 3, aberto: 1, escreveu: 3, voltou: 2, conta: 1, usando: 1, prazo: 2, parada: -3 };
export const LIMITE_QUENTE = 5;
export const LIMITE_MORNA = 2;
const PRAZO_CURTO = 60;       // dias até o VLS-TS que contam como urgência real
const DIAS_ESPERA = 3;        // cadência: o último e-mail precisa de 3 dias de silêncio
const DIAS_PARADO = 30;
const DIAS_RENOVA = 15;

export const VISOES = [['leads', 'Leads'], ['app', 'No app'], ['clientes', 'Clientes']];

const RESP = { k: 'responder', t: 'Responder agora', d: 'Escreveram ou perguntaram. Resposta rápida vale mais que e-mail perfeito.' };
const UM = { k: 'um_a_um', t: '1:1 marcado', d: 'Nada de campanha: só um lembrete curto perto do dia.' };
const PRONTO = { k: 'pronto', t: 'Pronto para o 1:1', d: 'Sinais fortes de interesse. Convide para a conversa.' };
const PARADOS = { k: 'parados', t: 'Paradas há mais de 30 dias', d: 'Pergunte se querem continuar. Escrever a quem não lê piora a entregabilidade.' };
export const COLUNAS = {
  leads: [RESP, UM, PRONTO,
    { k: 'proximo', t: 'Enviar o próximo e-mail', d: 'Mostrou interesse e travou. O e-mail certo depende do que falta.' },
    { k: 'esperar', t: 'Esperar', d: 'O último e-mail é recente. Silêncio até o terceiro dia é normal.' }, PARADOS],
  app: [RESP, UM, PRONTO,
    { k: 'parou', t: 'Parou de usar', d: 'Tem conta e sumiu há 7 dias ou mais.' },
    { k: 'usando', t: 'Usando', d: 'Em movimento. Nada a fazer agora.' }, PARADOS],
  clientes: [RESP, UM,
    { k: 'atencao', t: 'Assinatura pede atenção', d: 'Pagamento falhou, cancela no fim do período ou renova em até 15 dias.' },
    { k: 'parou', t: 'Parou de usar', d: 'Paga e sumiu há 7 dias ou mais.' },
    { k: 'emdia', t: 'Em dia', d: 'Pagando e usando.' }]
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const agoraDe = (ctx) => (ctx && ctx.agora) || Date.now();
function diasDesde(iso, agora) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? (agora - t) / DIA : null;
}
const temEscrita = (c) => !!(c.resposta_aberta_id || c.pergunta_aberta_id);
const temUmAUm = (c) => !!c.um_a_um_quando || c.estagio === 'um_a_um';
const assinaturaPaga = (a) => !!a && (a.status === 'active' || a.status === 'trialing');

// ---------- Visão: lead, no app ou cliente ----------
export function visaoDe(c, ctx) {
  const x = ctx || {};
  if (assinaturaPaga(x.assinatura) || x.comprou) return 'clientes';
  return c && c.user_id ? 'app' : 'leads';
}

// ---------- Temperatura ----------
export function pontosDe(c) {
  const linhas = []; let total = 0;
  const add = (rot, v) => { total += v; linhas.push([rot, (v > 0 ? '+' : '−') + Math.abs(v)]); };
  if (c.email_status === 'clicado') add('Clicou no último e-mail', PONTOS.clique);
  else if (c.email_status === 'aberto') add('Abriu o último e-mail (a abertura é menos confiável que o clique)', PONTOS.aberto);
  if (temEscrita(c)) add('Escreveu ou perguntou e ainda não teve resposta', PONTOS.escreveu);
  if ((c.capturas || 0) >= 2) add('Voltou a pedir material', PONTOS.voltou);
  if (c.user_id) add('Tem conta no app', PONTOS.conta);
  if (c.estagio === 'em_uso') add('Está marcando itens no app', PONTOS.usando);
  const pz = num(c.dias_para_prazo);
  if (pz !== null && pz >= 0 && pz <= PRAZO_CURTO) add('Prazo do VLS-TS em ' + pz + (pz === 1 ? ' dia' : ' dias'), PONTOS.prazo);
  if ((num(c.dias) || 0) > DIAS_PARADO) add('Parada há mais de 30 dias', PONTOS.parada);
  return { total, linhas };
}
export function temperaturaDe(total) { return total >= LIMITE_QUENTE ? 'q' : total >= LIMITE_MORNA ? 'm' : 'f'; }

// ---------- O que travou a pessoa (modelo de Fogg) ----------
// gatilho = o sinal não chegou; motivacao = não viu motivo; facilidade = há atrito; entrega = o endereço não recebe.
export function faltaDe(c) {
  if (c.email_status === 'nao_entregue') return 'entrega';
  return { naoabriu: 'gatilho', naoclicou: 'motivacao', cliquenaoapp: 'facilidade', parouapp: 'motivacao' }[c.segmento] || null;
}

// ---------- Coluna ----------
function assinaturaPedeAtencao(a, agora) {
  if (!a) return null;
  if (a.status === 'past_due' || a.status === 'unpaid') return 'Pagamento falhou';
  if (a.cancela_no_fim) return 'Cancela no fim do período';
  const d = diasDesde(a.periodo_fim, agora);
  if (d !== null && d <= 0 && d >= -DIAS_RENOVA) return 'Renova em ' + Math.max(0, Math.ceil(-d)) + ' dias';
  return null;
}
export function colunaDe(c, visao, ctx) {
  const agora = agoraDe(ctx), dias = num(c.dias) || 0, temp = temperaturaDe(pontosDe(c).total);
  if (temEscrita(c)) return 'responder';
  if (temUmAUm(c)) return 'um_a_um';
  if (dias > DIAS_PARADO && visao !== 'clientes') return 'parados';
  if (visao === 'clientes') {
    if (assinaturaPedeAtencao(ctx && ctx.assinatura, agora)) return 'atencao';
    return dias >= 7 || c.segmento === 'parouapp' ? 'parou' : 'emdia';
  }
  if (temp === 'q') return 'pronto';
  if (visao === 'app') return dias >= 7 || c.segmento === 'parouapp' ? 'parou' : 'usando';
  const d = diasDesde(c.email_enviado_em, agora);
  return c.email_status && c.email_status !== 'nao_entregue' && d !== null && d < DIAS_ESPERA ? 'esperar' : 'proximo';
}

const ROTULO_FALTA = {
  gatilho: ['Falta gatilho', 'O sinal não chegou ou não foi visto.'],
  motivacao: ['Falta motivação', 'Não viu motivo para agir.'],
  facilidade: ['Falta facilidade', 'Há atrito entre o e-mail e o app.'],
  entrega: ['Endereço sem entrega', 'O último e-mail não foi entregue.']
};
export const rotuloFalta = (f) => (f && ROTULO_FALTA[f]) || null;

function porque(c, coluna, falta, ctx, agora) {
  const dias = Math.floor(num(c.dias) || 0);
  switch (coluna) {
    case 'responder': return 'Escreveu e ainda não teve resposta.';
    case 'um_a_um': return 'Tem 1:1 marcado. O único e-mail útil é um lembrete curto perto do dia.';
    case 'parados': return 'Parada há ' + dias + ' dias.';
    case 'atencao': return assinaturaPedeAtencao(ctx && ctx.assinatura, agora) + '.';
    case 'pronto': return 'Sinais fortes de interesse. Vale convidar para o 1:1.';
    case 'parou': return 'Parou de usar há ' + dias + ' dias.';
    case 'usando': return 'Usando o app.';
    case 'emdia': return 'Assinatura em dia.';
    case 'esperar': return 'O último e-mail é recente (menos de 3 dias). Silêncio é normal.';
    default:
      if (falta === 'gatilho') return 'O e-mail foi entregue e não foi aberto.';
      if (falta === 'motivacao') return 'Abriu e não clicou.';
      if (falta === 'facilidade') return 'Clicou e ainda não entrou no app.';
      if (falta === 'entrega') return 'O último e-mail não foi entregue. Confira o endereço.';
      return c.email_status ? 'Próximo passo da conversa.' : 'Ainda não recebeu e-mail do CRM: primeiro contato.';
  }
}

// ---------- Botão ----------
const BOTAO = {
  responder: ['Responder', 'conversa'], um_a_um: ['Abrir ficha', 'ficha'], pronto: ['Convidar para o 1:1', 'email'],
  proximo: ['Escrever e-mail', 'email'], parou: ['Escrever e-mail', 'email'], parados: ['Escrever e-mail', 'email'],
  esperar: ['Abrir ficha', 'ficha'], usando: ['Abrir ficha', 'ficha'], emdia: ['Abrir ficha', 'ficha'], atencao: ['Abrir ficha', 'ficha']
};
export function cartaoDe(c, ctx) {
  const agora = agoraDe(ctx), visao = visaoDe(c, ctx), coluna = colunaDe(c, visao, ctx);
  const p = pontosDe(c), falta = faltaDe(c), b = BOTAO[coluna];
  const semAceite = b[1] === 'email' && !c.aceita_novidades;
  return {
    id: c.id, visao, coluna, temp: temperaturaDe(p.total), pontos: p.total, linhas: p.linhas, falta,
    motivo: porque(c, coluna, falta, ctx, agora),
    prazo: num(c.dias_para_prazo) !== null && num(c.dias_para_prazo) >= 0 && num(c.dias_para_prazo) <= PRAZO_CURTO ? num(c.dias_para_prazo) : null,
    botao: { rotulo: b[0], acao: b[1], desabilitado: semAceite, aviso: semAceite ? 'Não aceitou novidades por e-mail' : '' }
  };
}

// ---------- Quadro ----------
// `contatos` já vem filtrado por persona; `ctxDe(c)` devolve o ctx de cada contato.
export function quadroDe(contatos, ctxDe, visao) {
  const cartoes = (contatos || []).map((c) => ({ c, k: cartaoDe(c, ctxDe(c)) })).filter((x) => x.k.visao === visao).map((x) => x.k);
  return COLUNAS[visao].map((col) => ({
    k: col.k, t: col.t, d: col.d,
    cartoes: cartoes.filter((k) => k.coluna === col.k).sort((a, b) => b.pontos - a.pontos || (a.prazo === null ? 9999 : a.prazo) - (b.prazo === null ? 9999 : b.prazo))
  }));
}

// ---------- Painel da semana ----------
export function contagens(contatos, ctxDe) {
  const L = contatos || [];
  return {
    total: L.length,
    comEmail: L.filter((c) => c.email_status).length,
    clicou: L.filter((c) => c.email_status === 'clicado').length,
    conta: L.filter((c) => c.user_id).length,
    escrevendo: L.filter(temEscrita).length,
    paradas: L.filter((c) => { const d = num(c.dias) || 0; return d >= 7 && d <= DIAS_PARADO && !temUmAUm(c); }).length,
    inativas: L.filter((c) => (num(c.dias) || 0) > DIAS_PARADO).length,
    prazoCurto: L.filter((c) => { const p = num(c.dias_para_prazo); return p !== null && p >= 0 && p <= PRAZO_CURTO; }).length,
    itens: L.filter((c) => ['em_uso', 'um_a_um', 'concluido'].includes(c.estagio)).length,
    umAUm: L.filter(temUmAUm).length,
    pagou: L.filter((c) => { const x = ctxDe(c) || {}; return assinaturaPaga(x.assinatura) || !!x.comprou; }).length,
    escreveu: L.filter((c) => (ctxDe(c) || {}).escreveu || temEscrita(c)).length
  };
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
export function indicadoresDe(contatos, ctxDe) {
  const n = contagens(contatos, ctxDe), p1 = pct(n.clicou, n.comEmail), p2 = pct(n.conta, n.total);
  return [
    { k: 'cliques', rotulo: 'Clicaram no último e-mail', valor: p1 === null ? '—' : p1 + '%', n: n.clicou + ' de ' + n.comEmail + ' com e-mail', alerta: p1 !== null && p1 < 40, aviso: 'Alerta abaixo de 40%' },
    { k: 'app', rotulo: 'Entraram no app', valor: p2 === null ? '—' : p2 + '%', n: n.conta + ' de ' + n.total + ' pessoas', alerta: p2 !== null && p2 < 30, aviso: 'Alerta abaixo de 30%' },
    { k: 'respostas', rotulo: 'Respostas esperando', valor: String(n.escrevendo), n: 'sem resposta sua', alerta: n.escrevendo >= 1, aviso: 'Alerta com 1 ou mais' },
    { k: 'paradas', rotulo: 'Paradas de 7 a 30 dias', valor: String(n.paradas), n: 'de ' + n.total + ' pessoas', alerta: n.paradas >= 3, aviso: 'Alerta com 3 ou mais' },
    { k: 'inativas', rotulo: 'Paradas há mais de 30 dias', valor: String(n.inativas), n: 'para perguntar se querem ficar', alerta: n.inativas >= 1, aviso: 'Limpar a lista todo mês' },
    { k: 'prazo', rotulo: 'Com prazo do VLS-TS em até 60 dias', valor: String(n.prazoCurto), n: 'urgência real', alerta: false, aviso: 'Sempre no topo da fila' }
  ];
}

// ---------- Passos da jornada ----------
// Os passos não são aninhados (dado real tem buracos): cada um conta quem tem aquele sinal.
export function passosDe(contatos, ctxDe) {
  const n = contagens(contatos, ctxDe);
  const lista = [['E-mail recebido', n.comEmail], ['Clicou', n.clicou], ['Entrou no app', n.conta], ['Marcou um item', n.itens], ['Escreveu para você', n.escreveu], ['1:1 marcado', n.umAUm], ['Pagou', n.pagou]];
  const passos = lista.map((p, i) => ({ rotulo: p[0], n: p[1], pct: i === 0 ? null : pct(p[1], lista[i - 1][1]) }));
  let perda = -1, maior = 0;
  for (let i = 2; i < lista.length; i++) { const q = lista[i - 1][1] - lista[i][1]; if (q > maior) { maior = q; perda = i; } }
  return { passos, perda };
}
