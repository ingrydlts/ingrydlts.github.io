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
