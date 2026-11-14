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

// ---------- Cascata: a página de inbound decide o que as próximas escolhas mostram ----------

function achaPag(paginas, k) { return lista(paginas).filter(function (p) { return p.k === k; })[0] || null; }

// k da página cujo material é o ÚNICO valor de para.materiais; qualquer outro caso (zero, dois, token desconhecido) = null.
export function paginaAtual(para, paginas) {
  var mat = lista((para || {}).materiais), ps = lista(paginas);
  if (mat.length !== 1) return null;
  for (var i = 0; i < ps.length; i++) if (ps[i].material === mat[0]) return ps[i].k;
  return null;
}

// As etapas da página que o filtro do Worker entende (existem em etapasFiltro), na ordem da página: [[codigo, rotulo]].
export function etapasDaPagina(pagina, etapasFiltro) {
  var out = [];
  if (!pagina) return out;
  lista(pagina.etapas).forEach(function (e) {
    var f = lista(etapasFiltro).filter(function (x) { return x[0] === e[0]; })[0];
    if (f) out.push([f[0], f[1]]);
  });
  return out;
}

// Escolher a página grava o material dela e zera etapa e persona (que pertenciam à página anterior). Não muda o original.
// k vazio ou desconhecido = "qualquer página": tira material, etapa e persona. Devolve também o que voltou para "qualquer".
export function aplicarPagina(para, k, paginas) {
  var novo = JSON.parse(JSON.stringify(para || {})), limpou = [], pag = achaPag(paginas, k);
  if (pag && paginaAtual(para, paginas) === pag.k) return { para: novo, limpou: limpou };
  if (lista(novo.etapas).length) limpou.push('etapa');
  if (lista(novo.personas).length) limpou.push('persona');
  delete novo.etapas; delete novo.personas;
  if (pag) novo.materiais = [pag.material]; else delete novo.materiais;
  return { para: novo, limpou: limpou };
}

// Partes da frase do passo "Quem": personas = null quando a página não tem personas ligadas (a tela não mostra o campo).
export function fraseCascata(m, paginas, rot) {
  var p = (m && m.para_quem) || {}, pag = achaPag(paginas, paginaAtual(p, paginas)), mats = lista(p.materiais);
  var por = function (l, f) { return l.map(function (x) { return f(x); }).join(' ou '); };
  return {
    pagina: pag ? pag.k + ' · ' + pag.nome : mats.length ? por(mats, rot.material) : 'qualquer página',
    personas: pag && lista(pag.personas).length ? (lista(p.personas).length ? por(p.personas, rot.persona) : 'qualquer persona') : null,
    etapas: lista(p.etapas).length ? por(p.etapas, rot.etapa) : 'qualquer resposta',
    novidades: !!(m && m.tipo === 'novidades')
  };
}
