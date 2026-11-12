// Funções puras do editor de e-mail do estúdio (sem DOM, sem banco, sem dependências). Quem desenha a tela é editor-email.js.
//
//  - texto guardado ⇄ HTML editável: o texto dos blocos continua sendo o de sempre ({nome}, {#x}…{/x}, **negrito**); na tela, o
//    dado vira uma etiqueta e o marcador de condição vira uma etiqueta de controle. A volta devolve o mesmo texto.
//  - operações nos blocos (sempre devolvem uma lista nova: nada é alterado no lugar).
//  - a paleta de blocos e os menus "/" e "@".
//  - o histórico de desfazer.

// ---------- Texto guardado ⇄ HTML editável ----------
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

// Uma etiqueta. op: '' (dado), '#' (só se tiver), '^' (só se não tiver), '/' (fim do trecho).
function etiqueta(op, k, bruto, rotulos) {
  var nome = (rotulos && rotulos[k]) || k;
  var label = op === '#' ? 'se tem ' + nome : op === '^' ? 'se não tem ' + nome : op === '/' ? 'fim' : nome;
  return '<span class="ed-chip' + (op ? ' ctl' : '') + '" contenteditable="false" data-raw="' + esc(bruto) + '">' + esc(label) + '</span>';
}
function emLinha(s, rotulos) {
  var out = '', re = /\{([#^/]?)(\w+)\}/g, ultimo = 0, m;
  while ((m = re.exec(s))) { out += esc(s.slice(ultimo, m.index)) + etiqueta(m[1], m[2], m[0], rotulos); ultimo = re.lastIndex; }
  return (out + esc(s.slice(ultimo))).replace(/\n/g, '<br>');
}
// rotulos: { dado: 'nome legível' } para as etiquetas; o que não tem rótulo mostra o próprio nome do dado.
export function textoParaHtml(texto, rotulos) {
  var s = String(texto == null ? '' : texto), out = '', re = /\*\*([^*\n]+)\*\*/g, ultimo = 0, m;
  while ((m = re.exec(s))) { out += emLinha(s.slice(ultimo, m.index), rotulos) + '<b>' + emLinha(m[1], rotulos) + '</b>'; ultimo = re.lastIndex; }
  return out + emLinha(s.slice(ultimo), rotulos);
}

function decodifica(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, function (tudo, e) {
    if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'quot') return '"'; if (e === 'apos') return "'"; if (e === 'nbsp') return ' ';
    if (e[0] === '#') { var n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : tudo; }
    return tudo;
  });
}
// O que o navegador devolve depois de alguém digitar → o texto guardado. Aceita só o que o editor gera e o que o navegador costuma
// acrescentar (<div> por linha, <br> no fim, espaço duro); qualquer outra tag é descartada e o texto dela fica.
export function htmlParaTexto(html) {
  var s = String(html == null ? '' : html);
  var re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g, m;
  var out = '', negrito = 0, buf = null, pular = 0, chip = 0;
  var emite = function (t) { if (negrito > 0) buf += t; else out += t; };
  var atual = function () { return negrito > 0 ? buf : out; };
  var fechaNegrito = function () {
    var partes = buf.split('\n').map(function (p) { return p.trim() === '' ? p : '**' + p + '**'; });
    out += partes.join('\n'); buf = null;
  };
  while ((m = re.exec(s))) {
    if (m[4] !== undefined) { if (!pular && !chip) emite(m[4] === '<' ? '<' : decodifica(m[4]).replace(/​/g, '').replace(/ /g, ' ')); continue; }
    if (!m[2]) continue;   // comentário
    var fecha = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
    if (pular) { if (fecha && tag === pular) pular = 0; continue; }
    if (chip) { if (tag === 'span') chip += fecha ? -1 : 1; if (chip < 0) chip = 0; continue; }
    if (tag === 'script' || tag === 'style') { if (!fecha) pular = tag; continue; }
    if (tag === 'span' && !fecha && /class\s*=\s*"[^"]*\bed-chip\b/.test(attrs)) {
      var bruto = /data-raw\s*=\s*"([^"]*)"/.exec(attrs);
      if (bruto) emite(decodifica(bruto[1]));
      chip = 1; continue;
    }
    if (tag === 'br') { emite('\n'); continue; }
    if (tag === 'div' || tag === 'p') {
      if (!fecha) { var a = atual(); if (a !== '' && !/\n$/.test(a)) emite('\n'); }
      continue;
    }
    if (tag === 'b' || tag === 'strong') {
      if (!fecha) { if (negrito === 0) buf = ''; negrito++; }
      else if (negrito > 0) { negrito--; if (negrito === 0) fechaNegrito(); }
    }
  }
  if (negrito > 0) fechaNegrito();
  return out.replace(/\n$/, '');   // o <br> que o navegador deixa no fim de uma linha
}

// ---------- Operações nos blocos ----------
function copia(itens) { return (itens || []).map(function (b) { return JSON.parse(JSON.stringify(b)); }); }
export function inserirBloco(itens, indice, bloco) {
  var l = copia(itens), i = Math.max(0, Math.min(Number.isInteger(indice) ? indice : l.length, l.length));
  l.splice(i, 0, JSON.parse(JSON.stringify(bloco)));
  return l;
}
// Devolve o bloco tirado e o lugar dele: com os dois, desfazer é inserirBloco(itens, indice, removido).
export function excluirBloco(itens, indice) {
  var l = copia(itens);
  if (!Number.isInteger(indice) || indice < 0 || indice >= l.length) return { itens: l, removido: null, indice: indice };
  var removido = l.splice(indice, 1)[0];
  return { itens: l, removido: removido, indice: indice };
}
// delta: -1 sobe uma casa, +1 desce uma, e qualquer número serve para arrastar. indice = onde o bloco ficou.
export function moverBloco(itens, indice, delta) {
  var l = copia(itens);
  if (!Number.isInteger(indice) || indice < 0 || indice >= l.length) return { itens: l, indice: indice };
  var alvo = Math.max(0, Math.min(l.length - 1, indice + delta));
  if (alvo === indice) return { itens: l, indice: indice };
  var b = l.splice(indice, 1)[0]; l.splice(alvo, 0, b);
  return { itens: l, indice: alvo };
}
export function duplicarBloco(itens, indice) {
  var l = copia(itens);
  if (!Number.isInteger(indice) || indice < 0 || indice >= l.length) return l;
  l.splice(indice + 1, 0, JSON.parse(JSON.stringify(l[indice])));
  return l;
}
// Só texto ⇄ título (os dois guardam o mesmo campo). O estilo e a linha são do texto e não existem no título.
export function trocarTipoTexto(itens, indice, tipo) {
  var l = copia(itens), b = l[indice];
  if (!b || (tipo !== 'texto' && tipo !== 'titulo') || (b.tipo !== 'texto' && b.tipo !== 'titulo')) return l;
  b.tipo = tipo;
  if (tipo === 'titulo') { delete b.estilo; delete b.linha; }
  return l;
}
export function resumoBloco(b) {
  var t = String((b && (b.texto || b.rotulo || b.titulo)) || '').replace(/\s+/g, ' ').trim();
  return t.length > 60 ? t.slice(0, 60) + '…' : t;
}

// ---------- Paleta e menus ----------
function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
// A ordem é a da tela. "Intro" é o bloco que o sistema chama de "Apresentação com foto" (tipo apresentacao).
export var PALETA = [
  { tipo: 'apresentacao', nome: 'Intro', d: 'Sua foto e uma linha sobre você' },
  { tipo: 'titulo', nome: 'Título', d: 'Um título grande' },
  { tipo: 'texto', nome: 'Texto', d: 'Um parágrafo' },
  { tipo: 'botao', nome: 'Botão', d: 'Leva a um link' },
  { tipo: 'destaque', nome: 'Destaque', d: 'Faixa de cor com um dado importante' },
  { tipo: 'pergunta', nome: 'Pergunta', d: 'Convida a responder' },
  { tipo: 'assinatura', nome: 'Assinatura', d: 'Fecha o e-mail' }
];
// Só aparecem quando o modelo tem o que eles precisam (as etapas do guia; os botões de um toque do Worker).
var EXTRAS = [
  { tipo: 'etapa', nome: 'Só para uma etapa', d: 'Um trecho para quem marcou aquela etapa', extra: 'etapa' },
  { tipo: 'toques', nome: 'Respostas de um toque', d: 'Botões que ela toca para responder', extra: 'toques' }
];
export function filtrarPaleta(q, disponiveis) {
  var todos = PALETA.concat(EXTRAS.filter(function (e) { return disponiveis && disponiveis[e.extra]; })), nq = norm(q);
  if (!nq) return todos;
  return todos.filter(function (p) { return norm(p.nome).indexOf(nq) === 0 || norm(p.tipo).indexOf(nq) === 0; });
}
// "/bot" no começo de um bloco de texto abre o menu de blocos; "@no" no fim abre o de dados da pessoa.
export function detectaComando(texto) {
  var s = String(texto == null ? '' : texto), m = /^\/(\w*)$/.exec(s);
  if (m) return { tipo: 'slash', q: m[1] };
  m = /(^|\s)@(\w*)$/.exec(s);
  if (m) return { tipo: 'at', q: m[2] };
  return null;
}
// dados: [[nome, descrição], …]. Acha pelo começo do nome ou de uma palavra da descrição.
export function filtrarDados(dados, q) {
  var nq = norm(q);
  if (!nq) return dados.slice();
  return dados.filter(function (d) {
    return norm(d[0]).indexOf(nq) === 0 || norm(d[1]).split(/[^a-z0-9]+/).some(function (w) { return w.indexOf(nq) === 0; });
  });
}

// ---------- Histórico (desfazer e refazer) ----------
// Guarda cópias (texto JSON), no máximo `max`. Quem usa registra o estado ANTES de cada mudança.
export function criarHistorico(max) {
  var undo = [], redo = [];
  return {
    registrar: function (estado) { undo.push(JSON.stringify(estado)); if (undo.length > max) undo.shift(); redo = []; },
    desfazer: function (atual) { if (!undo.length) return null; redo.push(JSON.stringify(atual)); return JSON.parse(undo.pop()); },
    refazer: function (atual) { if (!redo.length) return null; undo.push(JSON.stringify(atual)); return JSON.parse(redo.pop()); },
    podeDesfazer: function () { return undo.length > 0; },
    podeRefazer: function () { return redo.length > 0; }
  };
}
