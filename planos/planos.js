// A lógica da página /planos/ (a que a pessoa recebe no e-mail com o link de pagamento): ler planos.json, saber o que mostrar para
// cada moeda e periodicidade, formatar preço e montar o link de compra. Sem DOM aqui: dá para testar em Node (admin/crm/db/testes/planos.test.mjs).
export var PERIODOS = [['mensal', 'Mensal', 1], ['semestral', 'Semestral', 6], ['anual', 'Anual', 12]];
export var MOEDAS = [['BRL', 'R$ Reais'], ['EUR', '€ Euros']];

// O arquivo é { niveis, itens, teste_dias }. Item ou nível fora do formato é ignorado (não derruba a página).
// Um item com url vazia é um preço que ainda não tem Payment Link: a página mostra o preço e o botão "Em breve" (você cola o link quando criar).
export function lerPlanos(j) {
  var niveis = (j && Array.isArray(j.niveis) ? j.niveis : []).filter(function (n) {
    return n && /^[a-z0-9_-]{1,40}$/.test(String(n.chave || '')) && typeof n.nome === 'string' && n.nome.trim();
  }).map(function (n) {
    return { chave: n.chave, nome: n.nome.trim().slice(0, 40), para: typeof n.para === 'string' ? n.para.slice(0, 200) : '', destaque: n.destaque === true,
      beneficios: (Array.isArray(n.beneficios) ? n.beneficios : []).filter(function (b) { return typeof b === 'string' && b.trim(); }).map(function (b) { return b.trim().slice(0, 200); }).slice(0, 15) };
  });
  var chaves = {};
  var itens = (j && Array.isArray(j.itens) ? j.itens : []).filter(function (i) {
    return i && /^[a-z0-9_-]{1,40}$/.test(String(i.chave || '')) && niveis.some(function (n) { return n.chave === i.nivel; }) &&
      PERIODOS.some(function (p) { return p[0] === i.periodicidade; }) && MOEDAS.some(function (m) { return m[0] === i.moeda; }) &&
      typeof i.valor === 'number' && isFinite(i.valor) && i.valor > 0 && (i.url === undefined || i.url === null || i.url === '' || (typeof i.url === 'string' && /^https:\/\/[^\s]+$/.test(i.url)));
  }).filter(function (i) { return chaves[i.chave] ? false : (chaves[i.chave] = true); })
    .map(function (i) { return { chave: i.chave, nivel: i.nivel, periodicidade: i.periodicidade, moeda: i.moeda, valor: i.valor, url: i.url || '', exemplo: i.exemplo === true }; });
  // Um nível aparece se tem pelo menos um preço no arquivo (com ou sem link ainda). O item de exemplo não conta.
  var comLink = niveis.filter(function (n) { return itens.some(function (i) { return i.nivel === n.chave && !i.exemplo; }); });
  var dias = j && Number.isInteger(j.teste_dias) && j.teste_dias > 0 && j.teste_dias <= 90 ? j.teste_dias : 0;
  return { niveis: comLink, itens: itens.filter(function (i) { return !i.exemplo; }), teste_dias: dias };
}
// Moedas e periodicidades que têm pelo menos um preço (a ordem é a de MOEDAS e PERIODOS).
export function opcoes(d) {
  return {
    moedas: MOEDAS.filter(function (m) { return d.itens.some(function (i) { return i.moeda === m[0]; }); }),
    periodos: PERIODOS.filter(function (p) { return d.itens.some(function (i) { return i.periodicidade === p[0]; }); })
  };
}
export function formatarValor(valor, moeda) {
  var inteiro = Math.abs(valor - Math.round(valor)) < 0.005;
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: 2 }).format(valor).replace(/ /g, ' '); }
  catch (e) { return moeda + ' ' + valor; }
}
function meses(periodicidade) { return PERIODOS.filter(function (p) { return p[0] === periodicidade; })[0][2]; }
// Um cartão por nível, para a moeda e a periodicidade escolhidas. item = null quando ainda não há link dessa combinação ("em breve").
export function cartoes(d, moeda, periodicidade) {
  return d.niveis.map(function (n) {
    var item = d.itens.filter(function (i) { return i.nivel === n.chave && i.moeda === moeda && i.periodicidade === periodicidade; })[0] || null;
    var mensal = d.itens.filter(function (i) { return i.nivel === n.chave && i.moeda === moeda && i.periodicidade === 'mensal'; })[0];
    var m = meses(periodicidade), c = { nivel: n, item: item, comLink: !!(item && item.url), preco: null, sufixo: null, equivale: null, economia: null };
    if (item) {
      c.preco = formatarValor(item.valor, moeda);
      c.sufixo = periodicidade === 'mensal' ? 'por mês' : periodicidade === 'semestral' ? 'a cada 6 meses' : 'por ano';
      if (m > 1) c.equivale = 'equivale a ' + formatarValor(item.valor / m, moeda) + ' por mês';
      if (m > 1 && mensal) { var e = Math.round((1 - item.valor / (mensal.valor * m)) * 100); if (e > 0) c.economia = e; }
    }
    return c;
  });
}
// O link de compra: o Payment Link com o e-mail já preenchido e o id da ficha (o webhook do Stripe casa o pagamento com a ficha por ele).
export function urlCompra(urlBase, ctx) {
  var u;
  try { u = new URL(urlBase); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;   // (url vazia cai no catch acima: new URL('') dá erro)
  if (ctx && ctx.email) u.searchParams.set('prefilled_email', ctx.email);
  if (ctx && /^[0-9a-f-]{36}$/i.test(String(ctx.contato_id || ''))) u.searchParams.set('client_reference_id', ctx.contato_id);
  return u.toString();
}
// A escolha inicial: a moeda e a periodicidade que têm mais links de compra (empate: a primeira da lista, R$ mensal). Sem nenhum link, a primeira.
export function escolhaInicial(d) {
  var o = opcoes(d), melhor = null;
  o.moedas.forEach(function (m) { o.periodos.forEach(function (p) {
    var n = cartoes(d, m[0], p[0]).filter(function (c) { return c.comLink; }).length;
    if (!melhor || n > melhor.n) melhor = { moeda: m[0], periodo: p[0], n: n };
  }); });
  return melhor ? { moeda: melhor.moeda, periodo: melhor.periodo } : null;
}
