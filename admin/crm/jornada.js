// A jornada dos e-mails: uma linha por página (landing) e uma coluna por etapa do funil. Módulo puro, sem DOM.
// Serve à tela "Jornada" do estúdio: mostra o que existe, o que falta e onde a cadeia quebra.

// As etapas que têm e-mail. Post e Landing page vêm antes, como contexto (a página dá a landing).
export var ETAPAS = [
  { k: 'lead', nome: 'Inbound lead', sub: 'entrega do material', objetivo: 'freebie' },
  { k: 'contato', nome: 'Primeiro contato', sub: 'puxa a conversa', objetivo: 'conversa' },
  { k: 'reimp', nome: 'Reimpacto', sub: 'reengajar quem esfriou', objetivo: 'reimpacto' },
  { k: 'plat', nome: 'Plataforma', sub: 'conversão final', objetivo: 'boas_vindas' }
];

// Modelos cuja etapa não se deduz da família nem do objetivo (nomes do código).
var POR_CHAVE = { aupair_chegada_2: 'plat', guia_plataforma: 'plat', cf_guia_conversa: 'contato', guia_chamada: 'contato' };
var POR_OBJETIVO = { freebie: 'lead', conversa: 'contato', convite: 'contato', reimpacto: 'reimp', boas_vindas: 'plat', compra: 'plat' };
var POR_FAMILIA = { entrega: 'lead', personalizado: 'lead', reimpacto: 'reimp', acesso: 'plat', compra: 'plat' };

// Etapa da jornada de um modelo, ou null quando ele não pertence à matriz (aquecimento, campanhas, sem classificação).
export function etapaDaJornada(m) {
  var chave = String((m && m.chave) || '');
  if (Object.prototype.hasOwnProperty.call(POR_CHAVE, chave)) return POR_CHAVE[chave];
  if (m && m.objetivo_chave && Object.prototype.hasOwnProperty.call(POR_OBJETIVO, m.objetivo_chave)) return POR_OBJETIVO[m.objetivo_chave];
  var f = m && m.familia;
  return f && Object.prototype.hasOwnProperty.call(POR_FAMILIA, f) ? POR_FAMILIA[f] : null;
}

// TX é o módulo de taxonomia (PAGINAS e classifica). Devolve { linhas, bandejas, stats }.
export function montaJornada(modelos, TX) {
  var linhas = TX.PAGINAS.map(function (p) { return novaLinha(p.k, p.nome, p.rota); });
  linhas.push(novaLinha('TR', 'Todos os percursos', null));
  var porK = {}; linhas.forEach(function (l) { porK[l.k] = l; });
  var bandejas = { aquecimento: [], campanhas: [], semEtapa: [] };
  (modelos || []).forEach(function (m) {
    if (m.excluido_em) return;
    var c = TX.classifica(m), mm = Object.assign({}, m, { familia: c.familia, pagina: c.pagina });
    if (c.familia === 'aquecimento' || c.familia === 'serie') return bandejas.aquecimento.push(m);
    if (c.familia === 'campanha') return bandejas.campanhas.push(m);
    var e = etapaDaJornada(mm);
    if (!e) return bandejas.semEtapa.push(m);
    var linha = c.pagina && porK[c.pagina] ? porK[c.pagina] : porK.TR;
    linha.celulas[e].push(m);
  });
  var stats = { total: TX.PAGINAS.length, semEmail: 0, quebradas: 0 };
  linhas.forEach(function (l) {
    var tem = ETAPAS.map(function (e) { return l.celulas[e.k].length > 0; });
    l.cobertas = tem.filter(Boolean).length;
    // A cadeia é lead → primeiro contato → plataforma. O reimpacto é um ramo lateral (quem esfriou): falta, mas não quebra a cadeia.
    var cadeia = ETAPAS.map(function (e) { return e.k !== 'reimp'; });
    ETAPAS.forEach(function (e, i) {
      var antes = tem.some(function (t, j) { return j < i && t && cadeia[j]; }), depois = tem.some(function (t, j) { return j > i && t && cadeia[j]; });
      l.quebrada[e.k] = cadeia[i] && !tem[i] && antes && depois;
      if (l.quebrada[e.k] && l.k !== 'TR') stats.quebradas++;
      if (!tem[i] && l.k !== 'TR') stats.semEmail++;
    });
  });
  return { linhas: linhas, bandejas: bandejas, stats: stats };
}

function novaLinha(k, nome, rota) {
  var celulas = {}; ETAPAS.forEach(function (e) { celulas[e.k] = []; });
  return { k: k, nome: nome, rota: rota, celulas: celulas, cobertas: 0, quebrada: {} };
}
