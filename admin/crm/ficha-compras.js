// A sessão "Compras" da ficha: quem comprou um guia digital, o fluxo de entrada no material, a chave e os insights de e-mail.
// Módulo puro, sem DOM e sem Supabase. Testado em db/testes/ficha-compras.test.mjs.
// Os dados vêm de compras e compras_entradas (db/crm-compras.sql e db/crm-compras-entradas.sql) e dos e-mails já carregados na ficha.
// A chave NÃO vem daqui: ela só mora na KV do Worker e é pedida por clique (GET /api/crm/compra-chave).
export const PRODUTOS = {
  'manual-destrave-domiciliacao': 'Manual Destrave: Endereço e Domiciliação',
  'manual-destrave-ameli': 'Manual Destrave da Ameli',
  'guia-vivo-destrave-ameli': 'Guia vivo Destrave da Ameli'
};
export const PARADA_DIAS = 10;     // entrou 1 ou 2 vezes e não volta há tantos dias: "parou"
export const USA_BASTANTE = 5;     // entradas a partir das quais ela usa o material com frequência
const DIA = 864e5;
const MOEDA = { EUR: '€', BRL: 'R$', USD: 'US$' };

export const nomeProduto = (slug) => PRODUTOS[slug] || String(slug || 'Guia digital');
export function valorTexto(centavos, moeda) {
  const v = (Number(centavos) / 100).toFixed(2).replace('.', ',');
  const m = String(moeda || 'EUR').toUpperCase();
  return m === 'EUR' ? v + ' €' : (MOEDA[m] || m) + ' ' + v;
}
const ms = (iso) => { const n = Date.parse(iso); return Number.isFinite(n) ? n : null; };
const dia = (iso) => { const n = ms(iso); return n == null ? '—' : new Date(n).toLocaleDateString('pt-BR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }); };
const diaHora = (iso) => { const n = ms(iso); return n == null ? '—' : new Date(n).toLocaleString('pt-BR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const dias = (a, b) => Math.floor((a - b) / DIA);
const ha = (n) => (n <= 0 ? 'hoje' : n === 1 ? 'há 1 dia' : 'há ' + n + ' dias');
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

// Quem comprou: compras (linhas da tabela) de uma pessoa, da mais recente à mais antiga, cada uma com o seu fluxo de entrada.
// compras: [{ id, referencia, slug, valor_centavos, moeda, pago_em, acesso_ate, entregue_em, origem }]
// entradas: [{ compra_id, em }]  (de qualquer pessoa: aqui filtra pelo id da compra)
// mails: e-mails do CRM da pessoa [{ modelo, status, enviado_em, criado_em, aberto_em, clicado_em }]
export function montarCompras(compras, entradas, mails, agora) {
  return (compras || []).slice().sort((a, b) => String(b.pago_em).localeCompare(String(a.pago_em))).map((c) => {
    const lista = (entradas || []).filter((e) => e && e.compra_id === c.id && ms(e.em) != null).map((e) => e.em).sort().reverse();
    const pago = ms(c.pago_em), ultima = lista.length ? ms(lista[0]) : null, primeira = lista.length ? ms(lista[lista.length - 1]) : null;
    const estado = !lista.length ? 'nunca' : (agora - ultima) / DIA >= PARADA_DIAS && lista.length < USA_BASTANTE ? 'parou' : 'ativa';
    const o = {
      id: c.id, referencia: c.referencia, emailPagamento: c.email_pagamento || '', slug: c.slug, produto: nomeProduto(c.slug), valor: valorTexto(c.valor_centavos, c.moeda),
      pagoEm: c.pago_em, acessoAte: c.acesso_ate, entregueEm: c.entregue_em || null, origem: c.origem || null,
      garantiaAte: pago == null ? null : new Date(pago + 7 * DIA).toISOString(), cupomAte: pago == null ? null : new Date(pago + 30 * DIA).toISOString(),
      entradas: { n: lista.length, primeira: primeira == null ? null : new Date(primeira).toISOString(), ultima: ultima == null ? null : new Date(ultima).toISOString(),
        recentes: lista.slice(0, 10), estado, diasDesdeUltima: ultima == null ? null : Math.max(0, dias(agora, ultima)), diasDesdeCompra: pago == null ? null : Math.max(0, dias(agora, pago)) },
      mails: (mails || []).filter((m) => m && /^guia_compra/.test(String(m.modelo || ''))).sort((a, b) => String(a.criado_em || a.enviado_em).localeCompare(String(b.criado_em || b.enviado_em)))
    };
    o.insights = insightsEmail(o, agora);
    return o;
  });
}

// O bloco de insights de e-mail: por regra (sem IA), a partir da entrega, das entradas no material e dos prazos da compra.
// Cada item: { tom: 'alerta'|'ok'|'', t, acao?: { tipo: 'conversa', rot } }.
export function insightsEmail(o, agora) {
  const out = [], en = o.entradas, dCompra = en.diasDesdeCompra == null ? 0 : en.diasDesdeCompra;
  const lembrar = { tipo: 'conversa', rot: 'Escrever e-mail com o link e a chave' };
  // 1. a entrega da chave
  const entrega = o.mails[0];
  if (!entrega) out.push({ tom: 'alerta', t: 'O e-mail de entrega não aparece no histórico desta ficha. Confira se a chave chegou.', acao: lembrar });
  else if (entrega.status === 'nao_entregue') out.push({ tom: 'alerta', t: 'O e-mail de entrega NÃO foi entregue. Mande a chave de novo.', acao: lembrar });
  else if (entrega.status === 'clicado') out.push({ tom: 'ok', t: 'Abriu o e-mail de entrega e clicou no link.' });
  else if (entrega.status === 'aberto' || entrega.aberto_em) out.push({ tom: 'ok', t: 'Abriu o e-mail de entrega.' });
  else if (dCompra >= 2 && en.n === 0) out.push({ tom: 'alerta', t: 'Ainda não abriu o e-mail de entrega (' + ha(dCompra).replace('há ', 'comprou há ') + '). A chave pode estar no spam.', acao: lembrar });
  else out.push({ tom: '', t: 'E-mail de entrega enviado, ainda sem abertura registrada.' });
  // 2. o fluxo de entrada no material
  if (en.n === 0) {
    if (dCompra < 1) out.push({ tom: '', t: 'Comprou hoje: ainda não deu tempo de entrar no material.' });
    else out.push({ tom: 'alerta', t: 'Ainda não entrou no material (comprou ' + ha(dCompra) + ').', acao: lembrar });
  } else {
    out.push({ tom: 'ok', t: 'Entrou ' + plural(en.n, 'vez', 'vezes') + ' no material, a última ' + ha(en.diasDesdeUltima) + '.' });
    if (en.estado === 'parou') out.push({ tom: 'alerta', t: 'Parou: não volta ao material ' + ha(en.diasDesdeUltima) + '. Lembre o que mais ela encontra lá (modelos de carta, formulários, mudança de visto).', acao: { tipo: 'conversa', rot: 'Escrever e-mail com o link de entrada' } });
    if (en.n >= USA_BASTANTE) out.push({ tom: 'ok', t: 'Usa o material com frequência: bom momento para pedir um relato e oferecer a ligação.' });
  }
  // 3. prazos que o e-mail precisa respeitar
  const agoraIso = new Date(agora).toISOString();
  if (o.garantiaAte && o.garantiaAte > agoraIso) out.push({ tom: '', t: 'Garantia de 7 dias até ' + dia(o.garantiaAte) + '.' });
  if (o.cupomAte && o.cupomAte > agoraIso) out.push({ tom: '', t: 'Os cupons da ligação valem até ' + dia(o.cupomAte) + '.' });
  const resta = ms(o.acessoAte) == null ? null : dias(ms(o.acessoAte), agora);
  if (resta != null && resta < 0) out.push({ tom: 'alerta', t: 'O acesso de 12 meses terminou em ' + dia(o.acessoAte) + '.' });
  else if (resta != null && resta <= 30) out.push({ tom: 'alerta', t: 'O acesso termina em ' + plural(resta, 'dia', 'dias') + ' (' + dia(o.acessoAte) + ').' });
  return out;
}

// O que o Potencial lê das compras de uma pessoa (ficha.js, potencial): quantas, quantas entradas, há quantos dias não entra e da compra.
// Sem compras devolve null (o Potencial fica como era).
export function resumoParaPontos(compras, entradas, agora) {
  const cs = compras || [];
  if (!cs.length) return null;
  const ids = new Set(cs.map((c) => c.id));
  const lista = (entradas || []).filter((e) => e && ids.has(e.compra_id) && ms(e.em) != null);
  const ultima = lista.reduce((m, e) => Math.max(m, ms(e.em)), 0);
  const pagos = cs.map((c) => ms(c.pago_em)).filter((x) => x != null);
  return { n: cs.length, entradas: lista.length, diasSemEntrar: ultima ? Math.max(0, dias(agora, ultima)) : null, diasDesdeCompra: pagos.length ? Math.max(0, dias(agora, Math.max(...pagos))) : null };
}

// Selo da lista e do cabeçalho: "Comprou" (e quantas vezes ela entrou, se já entrou).
export function seloComprou(compras, entradas) {
  const cs = compras || [];
  if (!cs.length) return null;
  const ids = new Set(cs.map((c) => c.id));
  const n = (entradas || []).filter((e) => ids.has(e.compra_id)).length;
  return { texto: 'Comprou' + (cs.length > 1 ? ' ×' + cs.length : ''), sub: n ? 'entrou ' + plural(n, 'vez', 'vezes') : 'ainda não entrou' };
}

// HTML da sessão. h = { esc }. Todo texto vindo do banco é escapado.
export function htmlCompras(lista, h) {
  const e = h.esc;
  if (!lista || !lista.length) return '<section class="panel" style="padding:16px;margin-top:14px"><h3 style="font-size:17px;margin:0 0 4px">Compras</h3><p class="sub" style="margin:0">Esta pessoa ainda não comprou nenhum guia digital.</p></section>';
  const pedem = lista.reduce((n, o) => n + o.insights.filter((i) => i.tom === 'alerta').length, 0);
  const cartao = (o) => {
    const en = o.entradas;
    const fluxo = en.n ? '<ol class="cmp-fluxo" aria-label="Entradas no material, da mais recente à mais antiga">' + en.recentes.map((x) => '<li>' + e(diaHora(x)) + '</li>').join('') + '</ol>' +
      (en.n > en.recentes.length ? '<p class="sub" style="margin:4px 0 0">Mostrando as ' + en.recentes.length + ' mais recentes de ' + en.n + '.</p>' : '') : '<p class="sub" style="margin:0">Nenhuma entrada ainda.</p>';
    const estadoRot = { nunca: 'Nunca entrou', parou: 'Parou de entrar', ativa: 'Entrando' }[en.estado];
    const mails = o.mails.length ? '<ul class="cmp-mails">' + o.mails.map((m) => '<li>' + e(m.assunto || 'E-mail da compra') + ' <span class="sub">· ' + e(m.status || 'enviado') + (m.enviado_em ? ' · ' + e(diaHora(m.enviado_em)) : '') + '</span></li>').join('') + '</ul>' : '<p class="sub" style="margin:0">Nenhum e-mail da compra no histórico.</p>';
    const ins = '<ul class="ins-lista">' + o.insights.map((i) => '<li class="ins-i ins-' + (i.tom || 'neutro') + '"><span class="ins-p ' + (i.tom === 'alerta' ? 'u-alta' : i.tom === 'ok' ? 'u-baixa' : '') + '">' + (i.tom === 'alerta' ? 'Atenção' : i.tom === 'ok' ? 'Bom sinal' : 'Nota') + '</span><span class="ins-t">' + e(i.t) + '</span>' +
      (i.acao ? '<button type="button" class="btn" data-fx="tab" data-v="conversa">' + e(i.acao.rot) + '</button>' : '') + '</li>').join('') + '</ul>';
    return '<section class="panel cmp" style="padding:16px;margin-top:14px" data-compra="' + e(o.id) + '">' +
      '<h3 style="font-size:17px;margin:0 0 2px">' + e(o.produto) + '</h3><p class="sub" style="margin:0 0 12px">' + e(o.valor) + ' · pago em ' + e(dia(o.pagoEm)) + ' · acesso até ' + e(dia(o.acessoAte)) + '</p>' +
      '<div class="dv-grid">' +
      '<div class="dv-card"><div class="k">Fluxo de entrada no material</div><p style="margin:0 0 6px"><b>' + e(estadoRot) + '</b> · ' + e(plural(en.n, 'entrada', 'entradas')) + '</p>' +
        (en.n ? '<div class="dv-l"><span>Primeira</span><b>' + e(diaHora(en.primeira)) + '</b></div><div class="dv-l"><span>Última</span><b>' + e(diaHora(en.ultima)) + '</b></div>' : '') + fluxo + '</div>' +
      '<div class="dv-card"><div class="k">Chave de acesso</div><p class="sub" style="margin:0 0 8px">A chave de 43 caracteres fica só na KV do Worker, nunca no banco. Ela entra com o e-mail da compra.</p>' +
        '<div class="dv-l"><span>E-mail da compra</span><b>' + e(o.emailPagamento || '—') + '</b></div>' +
        '<div id="cmp-chave-' + e(o.id) + '"><button type="button" class="btn" data-fx="chaveCompra" data-ref="' + e(o.referencia) + '" data-id="' + e(o.id) + '">Mostrar a chave</button></div></div>' +
      '<div class="dv-card"><div class="k">E-mails da compra</div>' + mails + '</div></div>' +
      '<h4 class="fx-h4" style="margin:14px 0 6px">Insights de e-mail</h4>' + ins + '</section>';
  };
  return '<section class="panel" style="padding:16px;margin-top:14px"><h3 style="font-size:17px;margin:0 0 2px">Compras</h3><p class="sub" style="margin:0">' + plural(lista.length, 'compra', 'compras') +
    (pedem ? ' · ' + plural(pedem, 'ponto pede', 'pontos pedem') + ' atenção' : ' · nada pede ação agora') + '. Por regra, a partir do e-mail de entrega, das entradas no material e dos prazos (sem IA).</p></section>' + lista.map(cartao).join('');
}

// O resultado do clique em "Mostrar a chave" (resposta de GET /api/crm/compra-chave, ou erro).
export function htmlChave(r, h) {
  const e = h.esc;
  if (!r || r.erro) return '<p class="aviso-previa" role="alert" style="margin:8px 0 0">' + e((r && r.erro) || 'Não consegui buscar a chave.') + '</p>';
  return '<div style="margin-top:8px"><code style="word-break:break-all;display:block;padding:8px 10px;border-radius:8px;background:var(--line-2,#eee)">' + e(r.chave) + '</code>' +
    '<p style="margin:8px 0 0"><button type="button" class="btn" data-fx="copiarTxt" data-txt="' + e(r.chave) + '">Copiar a chave</button> ' +
    '<button type="button" class="btn" data-fx="copiarTxt" data-txt="' + e(String(r.link).split('#')[0]) + '">Copiar o link de entrada</button></p>' +
    (r.revogado ? '<p class="sub" style="margin:6px 0 0">Esta chave está revogada: não abre mais o material.</p>' : '') + '</div>';
}
