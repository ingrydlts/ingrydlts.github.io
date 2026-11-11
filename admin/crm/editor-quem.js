// "Quem recebe e quando": funções puras (sem DOM) que a tela do passo 1 usa.
// Estimativa de quantas pessoas da base cumprem as regras de um modelo hoje e a frase que resume as regras.

function lista(v) { return Array.isArray(v) ? v : []; }

// Motivo pelo qual a pessoa NÃO entra nas regras do modelo (null = entra). c.origens já vem normalizado em origensDe.
export function motivoFora(c, m, origensDe) {
  var p = (m && m.para_quem) || {};
  if (lista(p.personas).length && lista(p.personas).indexOf(c.persona) < 0) return 'persona';
  if (lista(p.materiais).length && !origensDe(c).some(function (o) { return p.materiais.indexOf(o) >= 0; })) return 'material';
  var et = c.respostas && c.respostas.objetivo;
  if (lista(p.etapas).length && et && p.etapas.indexOf(et) < 0) return 'etapa';
  if (lista(p.estagios).length && lista(p.estagios).indexOf(c.estagio) < 0) return 'estagio';
  if (m && m.tipo === 'novidades' && !c.aceita_novidades) return 'novidades';
  return null;
}

// { n, total, porMotivo } — n é quem entra hoje.
export function estimar(contatos, m, origensDe) {
  var r = { n: 0, total: lista(contatos).length, porMotivo: {} };
  lista(contatos).forEach(function (c) {
    var mo = motivoFora(c, m, origensDe);
    if (!mo) r.n++; else r.porMotivo[mo] = (r.porMotivo[mo] || 0) + 1;
  });
  return r;
}

// Partes da frase: [{g:'materiais'|'etapas'|'novidades', texto}]; vazio = "qualquer".
export function fraseQuem(m, rotulos) {
  var p = (m && m.para_quem) || {}, j = function (l, f) { return l.map(f).join(' ou '); };
  return {
    materiais: lista(p.materiais).length ? j(p.materiais, rotulos.material) : 'qualquer material',
    etapas: lista(p.etapas).length ? j(p.etapas, rotulos.etapa) : 'qualquer resposta',
    novidades: !!(m && m.tipo === 'novidades')
  };
}
