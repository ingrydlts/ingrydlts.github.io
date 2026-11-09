// Taxonomia dos modelos de e-mail do CRM: família, página, etapa e persona. Módulo puro, sem DOM e sem dependências.
// É a única fonte dos rótulos e da ordem na tela; o banco (modelos_email.familia/pagina/etapa/persona) guarda só os códigos.
//
// Sincronia com o vault (o CRM é público e o vault é privado, então o catálogo é COPIADO, não lido em tempo de execução):
//   - PAGINAS e etapas: espelham emails-por-pagina.json do vault e ETAPAS_GUIA em estudio.js.
//   - Tabela de classificação de reserva (reserva): espelha a seção 4 de
//     docs/superpowers/specs/2026-11-09-crm-taxonomia-modelos-design.md (chaves conferidas contra db/modelos-*.mjs).
//   - Última conferência: 2026-11-09.
// Mudou página ou etapa no Obsidian: atualizar este arquivo no mesmo dia.

// Ordem de exibição na lista de modelos.
export var FAMILIAS = [
  ['entrega', 'Entrega do material'],
  ['personalizado', 'E-mail personalizado da página'],
  ['aquecimento', 'Aquecimento'],
  ['serie', 'Séries por persona'],
  ['compra', 'Teste, oferta e compra'],
  ['acesso', 'Acesso e boas-vindas'],
  ['reimpacto', 'Reimpacto'],
  ['campanha', 'Campanhas']
];

export var PAGINAS = [
  { k: 'I01', nome: 'Alternância 30+', rota: '/guias/email-alternancia-30-mais/', etapas: [
    ['alt-pesquisando', 'Pesquisando'],
    ['alt-escolhendo-escola', 'Escolhendo escola'],
    ['alt-recusa-idade', 'Ouviu "só até 29"'],
    ['alt-buscando-empresa', 'Buscando empresa'],
    ['alt-montando-contrato', 'Montando contrato']
  ] },
  { k: 'I02', nome: 'Tecnólogo do Brasil', rota: '/guias/tecnologo-nivel-na-franca/', etapas: [
    ['tec-nao-sei', 'Não sei o nível'],
    ['tec-juntando', 'Juntando documentos'],
    ['tec-escrevi', 'Esperando resposta'],
    ['tec-resposta', 'Tenho resposta']
  ] },
  { k: 'I03', nome: 'Études en France 2027-2028', rota: '/guias/etudes-en-france-2027-2028/', etapas: [
    ['cf-nao-comecei', 'Ainda não começou'],
    ['cf-escolhendo-curso', 'Escolhendo o curso'],
    ['cf-juntando-documentos', 'Juntando documentos'],
    ['cf-dossie-enviado', 'Dossiê enviado'],
    ['cf-entrevista-resposta', 'Entrevista ou resposta']
  ] },
  { k: 'I04', nome: 'VLS-TS travou na ANEF', rota: '/guias/vls-ts-validacao-travou/', etapas: [
    ['vls-ainda-nao', 'Ainda não cheguei'],
    ['vls-mais-60', 'Mais de 60 dias'],
    ['vls-30-60', 'De 30 a 60 dias'],
    ['vls-menos-30', 'Menos de 30 dias'],
    ['vls-passou', 'Passaram os 3 meses']
  ] }
];

export var PERSONAS = [
  ['au_pair', 'Au pair'],
  ['pvt', 'PVT'],
  ['estudante', 'Estudante'],
  ['conjuge', 'Cônjuge']
];

function achaPar(lista, k) {
  for (var i = 0; i < lista.length; i++) if (lista[i][0] === k) return lista[i];
  return null;
}
function achaPagina(k) {
  for (var i = 0; i < PAGINAS.length; i++) if (PAGINAS[i].k === k) return PAGINAS[i];
  return null;
}

export function rotuloFamilia(k) {
  if (k == null) return 'Sem classificação';
  var p = achaPar(FAMILIAS, k);
  return p ? p[1] : k;
}
export function rotuloPagina(k) {
  var p = achaPagina(k);
  return p ? p.k + ' · ' + p.nome : k;
}
export function rotuloEtapa(pagina, etapa) {
  var p = achaPagina(pagina);
  var e = p ? achaPar(p.etapas, etapa) : null;
  return e ? e[1] : etapa;
}

// Objetivo do modelo (campo `objetivo`) -> família sugerida.
var OBJETIVO_FAMILIA = {
  freebie: 'entrega', boas_vindas: 'acesso', conversa: 'entrega', aquecimento: 'aquecimento', reimpacto: 'reimpacto',
  convite: 'compra', compra: 'compra', lembrete: 'campanha', lancamento: 'campanha'
};
export function familiaDoObjetivo(k) {
  return Object.prototype.hasOwnProperty.call(OBJETIVO_FAMILIA, k) ? OBJETIVO_FAMILIA[k] : null;
}

// ---------- Modo de reserva (SQL ainda não rodado: as colunas não existem) ----------
// Chave exata -> [familia, pagina, persona]
var RESERVA_CHAVE = {
  boas_vindas: ['acesso', null, null],
  hub_estudos_compra: ['compra', null, null],
  hub_estudos_d3: ['compra', null, null],
  naoabriu: ['reimpacto', null, null],
  naoclicou: ['reimpacto', null, null],
  cliquenaoapp: ['reimpacto', null, null],
  parouapp: ['reimpacto', null, null],
  cf_guia_1: ['entrega', 'I03', null],
  cf_guia_conversa: ['entrega', 'I03', null],
  guia_alternancia: ['entrega', 'I01', null],
  guia_chamada: ['entrega', 'I04', null],
  guia_plataforma: ['entrega', 'I04', null],
  tec_recap_30min: ['entrega', 'I02', null],
  aupair_chegada_1: ['entrega', null, 'au_pair'],
  aupair_chegada_2: ['entrega', null, 'au_pair'],
  hub_estudos_lancamento: ['campanha', null, null],
  lembrete_prazo_vlsts: ['campanha', null, null]
};
// Prefixo -> [familia, pagina, persona]
var RESERVA_PREFIXO = [
  ['acesso_', ['acesso', null, null]],
  ['link_pagamento', ['compra', null, null]],
  ['cf_guia_', ['entrega', 'I03', null]],
  ['aq_', ['aquecimento', 'I03', null]]
];

function reserva(m) {
  var chave = String((m && m.chave) || '');
  var r = Object.prototype.hasOwnProperty.call(RESERVA_CHAVE, chave) ? RESERVA_CHAVE[chave] : null;
  if (!r) {
    for (var i = 0; i < RESERVA_PREFIXO.length; i++) {
      if (chave.indexOf(RESERVA_PREFIXO[i][0]) === 0) { r = RESERVA_PREFIXO[i][1]; break; }
    }
  }
  if (!r && m && m.tipo === 'compra') r = ['compra', null, null];
  if (!r) r = [null, null, null];
  return { familia: r[0], pagina: r[1], etapa: null, persona: r[2] };
}

// Classificação de um modelo: do banco, se ele já tem as colunas; senão, da tabela de reserva (em memória, sem gravar).
export function classifica(m) {
  if (m && Object.prototype.hasOwnProperty.call(m, 'familia')) {
    return { familia: m.familia == null ? null : m.familia, pagina: m.pagina == null ? null : m.pagina,
      etapa: m.etapa == null ? null : m.etapa, persona: m.persona == null ? null : m.persona, origem: 'banco' };
  }
  var r = reserva(m);
  r.origem = 'reserva';
  return r;
}

// O SQL de taxonomia já rodou? (a primeira linha traz a coluna; lista vazia não prova o contrário)
export function temColunas(lista) {
  if (!lista || !lista.length) return true;
  return Object.prototype.hasOwnProperty.call(lista[0], 'familia');
}

// ---------- Agrupamento da lista ----------
function texto(v, padrao) { return typeof v === 'string' && v ? v : padrao; }

function ordenaItens(itens) {
  return itens.slice().sort(function (a, b) {
    var oa = typeof a.ordem === 'number' ? a.ordem : Infinity;
    var ob = typeof b.ordem === 'number' ? b.ordem : Infinity;
    if (oa !== ob) return oa < ob ? -1 : 1;
    return String(a.nome || a.chave || '').localeCompare(String(b.nome || b.chave || ''), 'pt-BR');
  });
}

// Monta subgrupos a partir de [id, titulo, itens]; os vazios não aparecem.
function montaSubgrupos(defs) {
  var out = [];
  defs.forEach(function (d) {
    if (d[2].length) out.push({ id: d[0], titulo: d[1], itens: ordenaItens(d[2]) });
  });
  return out;
}

function grupo(id, titulo, selo, subgrupos, itens) {
  var todos = subgrupos.length
    ? subgrupos.reduce(function (acc, sg) { return acc.concat(sg.itens); }, [])
    : ordenaItens(itens);
  return { id: id, titulo: titulo, selo: selo, itens: todos, subgrupos: subgrupos };
}

// Agrupa os modelos para a tela: por página (com subgrupos por etapa), depois por família, depois "Sem classificação".
export function agrupa(lista) {
  var vivos = [];
  (Array.isArray(lista) ? lista : []).forEach(function (m) {
    if (m && typeof m === 'object' && !m.excluido_em) vivos.push({ m: m, c: classifica(m) });
  });
  var grupos = [];
  var usados = [];

  // 1. Páginas: as do catálogo, depois as desconhecidas.
  var codigos = PAGINAS.map(function (p) { return p.k; });
  vivos.forEach(function (v) { if (v.c.pagina && codigos.indexOf(v.c.pagina) < 0) codigos.push(v.c.pagina); });
  codigos.forEach(function (k) {
    var doGrupo = vivos.filter(function (v) { return v.c.pagina === k; });
    if (!doGrupo.length) return;
    doGrupo.forEach(function (v) { usados.push(v); });
    var pag = achaPagina(k);
    var etapasCat = pag ? pag.etapas.map(function (e) { return e[0]; }) : [];
    var defs = etapasCat.map(function (e) {
      return [e, texto(rotuloEtapa(k, e), e), doGrupo.filter(function (v) { return v.c.etapa === e; }).map(function (v) { return v.m; })];
    });
    var novas = [];
    doGrupo.forEach(function (v) {
      var e = v.c.etapa;
      if (e && etapasCat.indexOf(e) < 0 && novas.indexOf(e) < 0) novas.push(e);
    });
    novas.forEach(function (e) {
      defs.push([e, String(e), doGrupo.filter(function (v) { return v.c.etapa === e; }).map(function (v) { return v.m; })]);
    });
    // Sem etapa: um subgrupo por família (o título é o rótulo da família).
    var semEtapa = doGrupo.filter(function (v) { return !v.c.etapa; });
    var famsVistas = [];
    FAMILIAS.forEach(function (f) { famsVistas.push(f[0]); });
    famsVistas.push(null);
    semEtapa.forEach(function (v) { if (famsVistas.indexOf(v.c.familia) < 0) famsVistas.push(v.c.familia); });
    famsVistas.forEach(function (f) {
      var itens = semEtapa.filter(function (v) { return v.c.familia === f; }).map(function (v) { return v.m; });
      defs.push(['fam:' + f, texto(rotuloFamilia(f), 'Sem classificação'), itens]);
    });
    grupos.push(grupo(k, texto(rotuloPagina(k), String(k)), null, montaSubgrupos(defs), []));
  });

  // 2. Famílias sem página.
  var restantes = vivos.filter(function (v) { return usados.indexOf(v) < 0; });
  FAMILIAS.forEach(function (f) {
    var doGrupo = restantes.filter(function (v) { return v.c.familia === f[0]; });
    if (!doGrupo.length) return;
    doGrupo.forEach(function (v) { usados.push(v); });
    var subs = [];
    if (f[0] === 'serie') {
      var defs = PERSONAS.map(function (p) {
        return [p[0], p[1], doGrupo.filter(function (v) { return v.c.persona === p[0]; }).map(function (v) { return v.m; })];
      });
      var conhecidas = PERSONAS.map(function (p) { return p[0]; });
      defs.push(['sem-persona', 'Sem persona', doGrupo.filter(function (v) { return conhecidas.indexOf(v.c.persona) < 0; }).map(function (v) { return v.m; })]);
      subs = montaSubgrupos(defs);
    }
    grupos.push(grupo(f[0], texto(rotuloFamilia(f[0]), f[0]), null, subs, doGrupo.map(function (v) { return v.m; })));
  });

  // 3. O que sobrou (sem família conhecida e sem página).
  var sem = vivos.filter(function (v) { return usados.indexOf(v) < 0; }).map(function (v) { return v.m; });
  if (sem.length) grupos.push(grupo('sem', 'Sem classificação', 'atenção', [], sem));
  return grupos;
}

// ---------- Filtros, situação e visões ----------
export function filtroVazio() {
  return { q: '', paginas: [], etapas: [], familias: [], personas: [], soEspecificos: false, tipos: [], situacoes: [], semClasse: false };
}

function lista(v) { return Array.isArray(v) ? v : []; }
function semAcento(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Situação do modelo. `versoes`: as de modelos_email_versoes desse modelo, da mais nova para a mais velha.
export function situacaoDe(m, versoes) {
  var vs = lista(versoes).filter(function (v) { return v && typeof v === 'object'; });
  var tem = function (etapa) { return vs.some(function (v) { return v.etapa === etapa; }); };
  var maisNova = null;
  for (var i = 0; i < vs.length; i++) {
    if (vs[i].etapa === 'rascunho' || vs[i].etapa === 'revisao') { maisNova = vs[i]; break; }
  }
  var gatilho = !!(m && m.envio_gatilho);
  var ligado = !!(m && m.envio_ligado);
  return {
    noAr: tem('no_ar'),
    rascunho: tem('rascunho'),
    revisao: tem('revisao'),
    envioLigado: gatilho && ligado,
    envioDesligado: gatilho && !ligado,
    semTeste: !!maisNova && maisNova.testado_em == null
  };
}

// Dentro de cada filtro é "ou"; entre filtros é "e". Excluído nunca passa.
export function aplicaFiltros(modelos, f, versoesDe) {
  var fl = Object.assign(filtroVazio(), f && typeof f === 'object' ? f : {});
  var busca = semAcento(String(fl.q || '').trim());
  var paginas = lista(fl.paginas), etapas = lista(fl.etapas), familias = lista(fl.familias);
  var personas = lista(fl.personas), tipos = lista(fl.tipos), situacoes = lista(fl.situacoes);
  return lista(modelos).filter(function (m) {
    if (!m || typeof m !== 'object' || m.excluido_em) return false;
    var c = classifica(m);
    if (busca && (semAcento(m.nome) + ' ' + semAcento(m.objetivo)).indexOf(busca) < 0) return false;
    if (paginas.length && paginas.indexOf(c.pagina == null ? 'sem' : c.pagina) < 0) return false;
    if (etapas.length && etapas.indexOf(c.etapa) < 0) return false;
    if (familias.length && familias.indexOf(c.familia) < 0) return false;
    if (personas.length) {
      var ok = personas.indexOf(c.persona) >= 0 || (c.persona == null && !fl.soEspecificos);
      if (!ok) return false;
    }
    if (tipos.length && tipos.indexOf(m.tipo) < 0) return false;
    if (fl.semClasse && (c.familia != null || c.pagina != null)) return false;
    if (situacoes.length) {
      var vs = typeof versoesDe === 'function' ? versoesDe(m.chave) : [];
      var s = situacaoDe(m, vs);
      if (!situacoes.some(function (k) { return s[k] === true; })) return false;
    }
    return true;
  });
}

// Tira as etapas que não pertencem a nenhuma página marcada (todas, se nenhuma página está marcada).
export function limpaEtapasOrfas(f) {
  var out = Object.assign(filtroVazio(), f && typeof f === 'object' ? f : {});
  var validas = [];
  lista(out.paginas).forEach(function (k) {
    var p = achaPagina(k);
    if (p) p.etapas.forEach(function (e) { validas.push(e[0]); });
  });
  out.etapas = lista(out.etapas).filter(function (e) { return validas.indexOf(e) >= 0; });
  return out;
}

export var VISOES = [
  { k: 'rascunhos', nome: 'Rascunhos para revisar', filtros: { situacoes: ['rascunho', 'revisao'] } },
  { k: 'teste', nome: 'Esperando o meu teste', filtros: { situacoes: ['semTeste'] } },
  { k: 'ligado', nome: 'Envio ligado', filtros: { situacoes: ['envioLigado'] } },
  { k: 'semclasse', nome: 'Sem classificação', filtros: { semClasse: true } }
];
