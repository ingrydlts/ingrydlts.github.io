// O e-mail editável do estúdio (passo "Texto"): o próprio e-mail na tela, com cada texto editável no lugar, "+" entre os blocos,
// o menu "/" (tipo de bloco) e "@" (dado da pessoa), um × em cada bloco com "Desfazer", e as opções do bloco num painel.
// As regras que não precisam de tela (texto ⇄ etiquetas, mover, excluir, paleta, histórico) estão em editor-blocos.js.
//
// Não importa nada além de editor-blocos.js: crm.js entrega o resto em iniciar(dep) (o rascunho, o salvamento, o catálogo de
// dados). Assim este arquivo não carrega uma segunda cópia de estudio.js.
//
// dep = {
//   ES,                                   estudio.js (novoBloco, TIPOS, FOTO_URL, ESTILOS_DESTAQUE)
//   rascunho(): ST.d | null,              os blocos em edição ({ assunto, assunto_alt, pre, rodape, itens })
//   somenteLeitura(): boolean,
//   setCampo(caminho, valor),             grava no rascunho (apaga a chave se o valor é vazio)
//   mudou(),                              avisa o estúdio: guardar sozinho, atualizar a prévia, pedir teste novo
//   camposDoBloco(b, i, semTexto): html,  o formulário das opções do bloco (campos data-f que o estúdio já trata)
//   dados(): [[nome, descrição], …],      os dados da pessoa que o menu "@" oferece
//   disponiveis(): { etapa, toques },     blocos de guia que este modelo pode ter
//   rodapeTexto(): string                 o rodapé automático (pelo tipo), só para mostrar
// }
import * as EB from './editor-blocos.js?v=2026-11-13.9';

var DEP = null;
var S = { sel: -1, pal: -2, menu: null, foco: null, hist: EB.criarHistorico(60), campo: null, ultimo: null, arrasto: null, toastT: null };
export function iniciar(dep) { DEP = dep; }

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function itens() { var d = DEP.rascunho(); if (!d) return []; return d.itens || (d.itens = []); }
function nomeTipo(t) { var p = EB.PALETA.filter(function (x) { return x.tipo === t; })[0]; return p ? p.nome : ((DEP.ES.TIPOS[t] || {}).nome || t); }

// ---------- Desenho ----------
function campo(caminho, valor, cls, rot, ph, multi, ro) {
  return '<div class="ee-f ' + cls + '"' + (ro ? '' : ' contenteditable="true" role="textbox" aria-multiline="' + (multi ? 'true' : 'false') + '" spellcheck="true"') +
    ' data-ee="' + esc(caminho) + '"' + (multi ? ' data-multi="1"' : '') + ' aria-label="' + esc(rot) + '" data-ph="' + esc(ph || rot) + '">' + EB.textoParaHtml(valor, null) + '</div>';
}
function condTxt(b) {
  if (!b.se) return '';
  var k = b.se.slice(1);
  var t = b.tipo === 'etapa' ? 'só para a etapa: ' + (((DEP.ES.CAT || {})[k] || {}).o || k).replace(/^etapa do guia: /, '') : (b.se[0] === '#' ? 'só se tiver ' : 'só se não tiver ') + k;
  return '<small class="ee-cond">' + esc(t) + '</small>';
}
function destaqueHtml(b, aberto, ro) {
  var v = String(b.valor || ''), longo = !(v.indexOf('\n') < 0 && v.length <= 40);
  return '<div class="ee-dest t-' + esc(b.estilo || 'escuro') + '"' + (ro ? '' : ' role="button" tabindex="0" data-eeabre="' + aberto + '"') + '><div class="r">' + esc(b.rotulo || '') + '</div><div class="v' + (longo ? ' l' : '') + '">' + esc(v) + '</div>' + (b.nota ? '<div class="n">' + esc(b.nota) + '</div>' : '') + '</div>';
}
function introHtml(b, aberto, ro) {
  return '<div class="ee-intro"' + (ro ? '' : ' role="button" tabindex="0" data-eeabre="' + aberto + '"') + '><img src="' + esc(DEP.ES.FOTO_URL) + '" alt="Foto da Ingryd" width="84" height="84"><div><div class="it">' + esc(b.titulo || '') + '</div><div class="ix">' + esc(b.texto || '') + '</div></div></div>';
}
function textoDoBloco(b, i, ro) {
  var p = function (c) { return 'itens.' + i + '.' + c; }, h = '';
  if (b.tipo === 'texto') h = campo(p('texto'), b.texto, b.estilo === 'caixa' ? 'ee-caixa' : b.estilo === 'discreto' ? 'ee-disc' : 'ee-texto', 'Texto', 'Escreva aqui, ou digite / para escolher um bloco', true, ro);
  else if (b.tipo === 'titulo') h = campo(p('texto'), b.texto, 'ee-titulo', 'Título', 'Escreva o título', false, ro);
  else if (b.tipo === 'pergunta') h = campo(p('texto'), b.texto, 'ee-titulo', 'Pergunta', 'Escreva a pergunta', false, ro) + campo(p('ajuda'), b.ajuda, 'ee-disc', 'Linha de ajuda', 'Linha de ajuda (opcional)', false, ro);
  else if (b.tipo === 'assinatura') h = campo(p('texto'), b.texto, 'ee-ass', 'Assinatura', 'Assinatura', false, ro);
  else if (b.tipo === 'etapa') h = campo(p('rotulo'), b.rotulo, 'ee-disc', 'Linha pequena de cima', 'Linha pequena de cima (opcional)', false, ro) + campo(p('titulo'), b.titulo, 'ee-forte', 'Frase em negrito', 'Frase em negrito (opcional)', false, ro) + campo(p('texto'), b.texto, 'ee-texto', 'Texto', 'Escreva o texto', true, ro);
  return h;
}
function conteudo(b, i, ro) {
  if (b.tipo === 'botao') return '<div class="ee-botao"' + (ro ? '' : ' role="button" tabindex="0" data-eeabre="' + i + '"') + '>' + esc(b.rotulo || 'Botão') + '</div><small class="ee-nota">leva para ' + esc(b.url ? b.url : b.link ? '{' + b.link + '}' : 'o link que você escolher nas opções') + '</small>';
  if (b.tipo === 'destaque') return destaqueHtml(b, i, ro);
  if (b.tipo === 'apresentacao') return introHtml(b, i, ro);
  if (b.tipo === 'toques') return '<div class="ee-toques">Os botões de um toque ({' + esc(b.var || 'botoes_cidade') + '}) entram aqui, prontos do Worker.</div>';
  var alt = b.alt != null && b.alt !== '' ? '<div class="ee-alt"><small>Se faltar um dado deste bloco:</small>' + campo('itens.' + i + '.alt', b.alt, 'ee-disc', 'Texto se faltar um dado', 'Texto se faltar um dado', false, ro) + '</div>' : '';
  return textoDoBloco(b, i, ro) + alt;
}
var EDITA_NO_LUGAR = { texto: 1, titulo: 1, pergunta: 1, assinatura: 1, etapa: 1 };
function barraDoBloco(b, i) {
  var txt = b.tipo === 'texto' || b.tipo === 'titulo', noLugar = !!EDITA_NO_LUGAR[b.tipo];
  var h = '<div class="ee-bar" role="toolbar" aria-label="Ferramentas do bloco">';
  if (txt) h += '<button type="button" data-eetipo="' + i + ':texto" aria-pressed="' + (b.tipo === 'texto') + '">Texto</button><button type="button" data-eetipo="' + i + ':titulo" aria-pressed="' + (b.tipo === 'titulo') + '">Título</button><span class="sp"></span>';
  if (noLugar) h += '<button type="button" data-eenegrito="1" aria-label="Negrito"><b>B</b></button><button type="button" data-eedado="1">+ Dado</button><span class="sp"></span><button type="button" data-eeabre="' + i + '">Opções</button>';
  else h += '<button type="button" data-eeabre="' + i + '">Editar</button>';
  return h + '<span class="sp"></span><button type="button" data-eedup="' + i + '">Duplicar</button></div>';
}
function blocoHtml(b, i, n, ro) {
  var h = '<div class="ee-bk' + (S.sel === i ? ' sel' : '') + '" data-eebk="' + i + '" data-t="' + esc(b.tipo) + '">';
  if (!ro) {
    h += '<button type="button" class="ee-x" data-eex="' + i + '" aria-label="Excluir o bloco ' + esc(nomeTipo(b.tipo)) + '">×</button>' +
      '<div class="ee-grip"><button type="button" class="gb" data-eemv="' + i + ':-1" aria-label="Subir o bloco"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button type="button" class="gb drag" draggable="true" data-eearrasta="' + i + '" aria-label="Arrastar o bloco">⋮⋮</button>' +
      '<button type="button" class="gb" data-eemv="' + i + ':1" aria-label="Descer o bloco"' + (i === n - 1 ? ' disabled' : '') + '>↓</button></div>' + barraDoBloco(b, i);
  }
  h += '<div class="ee-ct">' + condTxt(b) + conteudo(b, i, ro) + '</div>';
  if (!ro && S.sel === i) h += '<div class="ee-pop" role="group" aria-label="Opções do bloco ' + esc(nomeTipo(b.tipo)) + '">' + DEP.camposDoBloco(b, i, !!EDITA_NO_LUGAR[b.tipo]) + '<div class="ee-pop-f"><button type="button" class="btn" data-eefecha="1">Pronto</button></div></div>';
  return h + '</div>';
}
function linhaMais(i) {
  var aberta = S.pal === i;
  return '<div class="ee-ins' + (aberta ? ' open' : '') + '"><button type="button" class="ee-plus" data-eemais="' + i + '" aria-label="Adicionar um bloco aqui" aria-expanded="' + aberta + '">+</button></div>' +
    (aberta ? '<div class="ee-pal" role="group" aria-label="Escolha o tipo de bloco">' + EB.filtrarPaleta('', DEP.disponiveis()).map(function (p) { return '<button type="button" data-eeadd="' + i + ':' + p.tipo + '" title="' + esc(p.d) + '">' + esc(p.nome) + '</button>'; }).join('') + '</div>' : '');
}
function tela() {
  var d = DEP.rascunho(), ro = DEP.somenteLeitura(), its = itens();
  var linha = '<div class="ee-linha"><div class="ee-l">Assunto</div>' + campo('assunto', d.assunto, 'ee-assunto', 'Assunto', 'Escreva o assunto', false, ro) +
    '<details class="ee-reserva"' + (d.pre || d.assunto_alt ? ' open' : '') + '><summary>Prévia e assunto de reserva</summary><div class="ee-l">Prévia <span class="sub">(a linha cinza depois do assunto)</span></div>' +
    campo('pre', d.pre, 'ee-pre', 'Prévia', 'A linha cinza depois do assunto (opcional)', false, ro) + '<div class="ee-l">Assunto de reserva <span class="sub">(se faltar um dado da pessoa)</span></div>' +
    campo('assunto_alt', d.assunto_alt, 'ee-pre', 'Assunto se faltar um dado', 'Assunto se faltar um dado (opcional)', false, ro) + '</details></div>';
  var corpo = '';
  if (!its.length) corpo = '<p class="ee-vazio">E-mail vazio. Comece por um bloco.</p>' + (ro ? '' : linhaMais(0));
  else for (var i = 0; i < its.length; i++) corpo += (ro ? '' : linhaMais(i)) + blocoHtml(its[i], i, its.length, ro);
  if (!ro && its.length) corpo += linhaMais(its.length);
  var rod = DEP.rodapeTexto();
  var rodape = '<div class="ee-rodape"><div class="ee-l">Rodapé</div><p class="ee-rodtxt">' + esc(rod || 'Sem rodapé (serviço sem motivo escrito).') + '</p>' +
    campo('rodape', d.rodape, 'ee-pre', 'Por que ela recebe', 'Por que ela recebe (opcional), ex.: pediu o checklist com {email}', false, ro) + '</div>';
  return linha + '<div class="ee-papel"><div class="ee-mail"><div class="ee-marca">Por <span>Dentro</span></div>' + corpo + '</div></div>' + rodape;
}
function barraTopo() {
  if (DEP.somenteLeitura()) return '';
  return '<div class="ee-topo"><span class="sub">Digite <kbd>/</kbd> para blocos e <kbd>@</kbd> para dados da pessoa</span>' +
    '<span class="ee-hist"><button type="button" class="btn" data-eedesfaz="1" title="Desfazer bloco" aria-label="Desfazer bloco"' + (S.hist.podeDesfazer() ? '' : ' disabled') + '>↶</button><button type="button" class="btn" data-eerefaz="1" title="Refazer" aria-label="Refazer"' + (S.hist.podeRefazer() ? '' : ' disabled') + '>↷</button></span></div>';
}
export function html() { return '<div id="ee" class="ee">' + barraTopo() + '<div id="ee-canvas">' + tela() + '</div></div>'; }
function redesenha() {
  fechaMenu();
  var c = document.getElementById('ee-canvas'); if (!c) return;
  c.innerHTML = tela();
  var t = document.querySelector('#ee .ee-topo'); if (t) t.outerHTML = barraTopo();
  aplicaFoco();
}
// Um campo das opções de um bloco mudou (o painel usa os campos de formulário do estúdio): o bloco no e-mail acompanha na hora,
// sem redesenhar nada (o cursor continua no painel).
export function campoMudou(caminho) {
  var m = /^itens\.(\d+)\./.exec(String(caminho || '')); if (!m || !DEP) return;
  var i = +m[1], b = itens()[i], ct = document.querySelector('#ee [data-eebk="' + i + '"] .ee-ct');
  if (b && ct && !EDITA_NO_LUGAR[b.tipo]) ct.innerHTML = condTxt(b) + conteudo(b, i, false);
}
// Depois de o estúdio redesenhar a coluna do meio: devolve o foco ao campo em que a pessoa estava.
export function depois() { aplicaFoco(); }
function aplicaFoco() {
  var f = S.foco; S.foco = null; if (!f) return;
  var el = f.caminho ? document.querySelector('#ee [data-ee="' + f.caminho + '"]') : document.querySelector('#ee [data-eebk="' + f.bloco + '"] [data-ee]');
  if (!el) return;
  el.focus();
  if (f.fim !== false) { var r = document.createRange(); r.selectNodeContents(el); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}

// ---------- Mudanças na estrutura (sempre com histórico) ----------
function aplica(novos, foco) {
  S.hist.registrar(itens());
  DEP.rascunho().itens = novos; S.sel = -1; S.pal = -2; S.foco = foco || null;
  redesenha(); DEP.mudou();
}
function bloco(tipo) { var b = DEP.ES.novoBloco(tipo); if (tipo === 'destaque') b.estilo = 'escuro'; return b; }
function precisaOpcoes(tipo) { return tipo === 'botao' || tipo === 'destaque' || tipo === 'apresentacao' || tipo === 'toques'; }
function adiciona(i, tipo) {
  var novos = EB.inserirBloco(itens(), i, bloco(tipo));
  aplica(novos, precisaOpcoes(tipo) ? null : { bloco: i });
  if (tipo === 'botao' || tipo === 'destaque') { S.sel = i; redesenha(); }
}
function exclui(i) {
  var r = EB.excluirBloco(itens(), i); if (!r.removido) return;
  var nome = nomeTipo(r.removido.tipo);
  aplica(r.itens, null);
  toast('Bloco “' + nome + '” excluído.');
}
function move(i, delta) { var r = EB.moverBloco(itens(), i, delta); if (r.indice !== i) aplica(r.itens, null); }
function duplica(i) { aplica(EB.duplicarBloco(itens(), i), null); }
function trocaTipo(i, tipo) { aplica(EB.trocarTipoTexto(itens(), i, tipo), { bloco: i }); }
function desfaz() { var a = S.hist.desfazer(itens()); if (!a) return; DEP.rascunho().itens = a; S.sel = -1; esconde(); redesenha(); DEP.mudou(); }
function refaz() { var a = S.hist.refazer(itens()); if (!a) return; DEP.rascunho().itens = a; S.sel = -1; redesenha(); DEP.mudou(); }

// ---------- Aviso com "Desfazer" ----------
function toast(msg) {
  var t = document.getElementById('ee-toast');
  if (!t) { t = document.createElement('div'); t.id = 'ee-toast'; t.className = 'ee-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.innerHTML = esc(msg) + ' <button type="button" data-eedesfaz="1">Desfazer</button>'; t.hidden = false;
  clearTimeout(S.toastT); S.toastT = setTimeout(esconde, 7000);
}
function esconde() { var t = document.getElementById('ee-toast'); if (t) t.hidden = true; }

// ---------- Menus "/" e "@" ----------
function menuEl() {
  var m = document.getElementById('ee-menu');
  if (!m) { m = document.createElement('div'); m.id = 'ee-menu'; m.className = 'ee-menu'; m.setAttribute('role', 'listbox'); m.hidden = true; document.body.appendChild(m); }
  return m;
}
function fechaMenu() { S.menu = null; var m = document.getElementById('ee-menu'); if (m) m.hidden = true; }
function abreMenu(tipo, el, q, remover) {
  var its = tipo === 'slash' ? EB.filtrarPaleta(q, DEP.disponiveis()).map(function (p) { return { k: p.tipo, l: p.nome, d: p.d }; })
    : EB.filtrarDados(DEP.dados(), q).map(function (x) { return { k: x[0], l: x[0], d: x[1] }; });
  if (!its.length) return fechaMenu();
  var idx = S.menu && S.menu.tipo === tipo && S.menu.el === el ? Math.min(S.menu.idx, its.length - 1) : 0;
  S.menu = { tipo: tipo, el: el, its: its, idx: idx, remover: !!remover };
  var m = menuEl(), r = el.getBoundingClientRect();
  m.innerHTML = '<div class="h">' + (tipo === 'slash' ? 'Tipo de bloco' : 'Dado da pessoa') + '</div>' + its.map(function (x, j) { return '<button type="button" role="option" id="ee-mi' + j + '" data-eemi="' + j + '" aria-selected="' + (j === idx) + '">' + esc(x.l) + '<small>' + esc(x.d) + '</small></button>'; }).join('');
  m.hidden = false; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 270)) + 'px'; m.style.top = Math.min(r.bottom + 6, window.innerHeight - 280) + 'px';
}
function escolheMenu(j) {
  var ms = S.menu; if (!ms) return; var it = ms.its[j], el = ms.el; fechaMenu();
  if (ms.tipo === 'at') {
    // Tira o "@no" que a pessoa digitou. Recolocar o texto faz o intervalo guardado apontar para o começo do campo: descarta, e a
    // etiqueta entra no fim (onde o "@" estava).
    if (ms.remover) { el.innerHTML = EB.textoParaHtml(EB.htmlParaTexto(el.innerHTML).replace(/(^|\s)@\w*$/, '$1')); S.ultimo = null; }
    return insereEtiqueta(el, '{' + it.k + '}');
  }
  var i = +el.closest('[data-eebk]').dataset.eebk, novo = bloco(it.k);
  var novos = itens().slice(); novos[i] = novo;
  aplica(novos, precisaOpcoes(it.k) ? null : { bloco: i });
  if (precisaOpcoes(it.k)) { S.sel = i; redesenha(); }
}
function insereEtiqueta(el, bruto) {
  el.focus();
  var sel = getSelection(), r;
  if (S.ultimo && el.contains(S.ultimo.startContainer)) r = S.ultimo; else { r = document.createRange(); r.selectNodeContents(el); r.collapse(false); }
  sel.removeAllRanges(); sel.addRange(r); r.deleteContents();
  var tmp = document.createElement('div'); tmp.innerHTML = EB.textoParaHtml(bruto, null);
  var chip = tmp.firstChild; r.insertNode(chip);
  var z = document.createTextNode('\u200b'); chip.after(z); r.setStartAfter(z); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  sincroniza(el);
}

// ---------- Texto digitado ----------
function sincroniza(el) {
  var caminho = el.dataset.ee, valor = EB.htmlParaTexto(el.innerHTML);
  if (valor.trim() === '') { valor = ''; if (el.innerHTML !== '') el.innerHTML = ''; }   // vazio de verdade: o texto de exemplo volta
  DEP.setCampo(caminho, valor); DEP.mudou();
  var cmd = EB.detectaComando(valor), m = /^itens\.(\d+)\.texto$/.exec(caminho);
  if (cmd && cmd.tipo === 'slash' && m && itens()[+m[1]] && itens()[+m[1]].tipo === 'texto') abreMenu('slash', el, cmd.q, true);
  else if (cmd && cmd.tipo === 'at') abreMenu('at', el, cmd.q, true);
  else fechaMenu();
}
function noFim(el) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
  var r = s.getRangeAt(0).cloneRange(); r.setEnd(el, el.childNodes.length);
  var f = r.cloneContents(); return f.textContent.replace(/\u200b/g, '') === '' && !f.querySelector('.ed-chip');
}
function campoDoFoco() { var a = document.activeElement; return a && a.matches && a.matches('#ee [data-ee]') ? a : (S.campo && document.body.contains(S.campo) ? S.campo : null); }

// ---------- Eventos (um conjunto só, na página inteira) ----------
function dentro(e) { return !!(e.target && e.target.closest && e.target.closest('#ee, #ee-menu, #ee-toast')); }
document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('#ee .ee-bar button, #ee-menu button, #ee-toast button, #ee .ee-pal button')) e.preventDefault(); });
document.addEventListener('click', function (e) {
  if (!DEP || !dentro(e)) { if (DEP && (S.pal !== -2 || S.menu)) { S.pal = -2; fechaMenu(); if (document.getElementById('ee-canvas')) redesenha(); } return; }
  var t = e.target.closest('[data-eex],[data-eemais],[data-eeadd],[data-eetipo],[data-eenegrito],[data-eedado],[data-eeabre],[data-eefecha],[data-eedup],[data-eemv],[data-eemi],[data-eedesfaz],[data-eerefaz]');
  if (!t) { if (S.menu) fechaMenu(); return; }
  var d = t.dataset;
  if (d.eex !== undefined) return exclui(+d.eex);
  if (d.eemais !== undefined) { var n = +d.eemais; S.pal = S.pal === n ? -2 : n; return redesenha(); }
  if (d.eeadd) { var a = d.eeadd.split(':'); return adiciona(+a[0], a[1]); }
  if (d.eetipo) { var q = d.eetipo.split(':'); return trocaTipo(+q[0], q[1]); }
  if (d.eenegrito) { var f = campoDoFoco(); if (f) { f.focus(); document.execCommand('bold'); sincroniza(f); } return; }
  if (d.eedado) { var f2 = campoDoFoco(); if (f2) abreMenu('at', f2, '', false); return; }
  if (d.eeabre !== undefined) { S.sel = S.sel === +d.eeabre ? -1 : +d.eeabre; return redesenha(); }
  if (d.eefecha) { S.sel = -1; return redesenha(); }
  if (d.eedup !== undefined) return duplica(+d.eedup);
  if (d.eemv) { var m = d.eemv.split(':'); return move(+m[0], +m[1]); }
  if (d.eemi !== undefined) return escolheMenu(+d.eemi);
  if (d.eedesfaz) return desfaz();
  if (d.eerefaz) return refaz();
});
document.addEventListener('input', function (e) { if (DEP && e.target.matches && e.target.matches('#ee [data-ee]')) sincroniza(e.target); });
document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('#ee [data-ee]')) S.campo = e.target; });
document.addEventListener('selectionchange', function () {
  var s = getSelection(); if (!s.rangeCount) return;
  var n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement); el = el && el.closest && el.closest('#ee [data-ee]');
  if (el) S.ultimo = s.getRangeAt(0).cloneRange();
});
document.addEventListener('paste', function (e) {
  if (!(e.target.closest && e.target.closest('#ee [data-ee]'))) return;
  e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
});
document.addEventListener('keydown', function (e) {
  if (!DEP) return;
  var menu = S.menu;
  if (menu && dentro(e)) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); var n = menu.its.length; menu.idx = (menu.idx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
      document.querySelectorAll('#ee-menu [role=option]').forEach(function (b, j) { b.setAttribute('aria-selected', String(j === menu.idx)); }); return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return escolheMenu(menu.idx); }
    if (e.key === 'Escape') { e.preventDefault(); return fechaMenu(); }
  }
  var el = e.target.closest && e.target.closest('#ee [data-ee]');
  if (!el) {
    if (e.target.closest && e.target.closest('#ee') && (e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.eeabre !== undefined) { e.preventDefault(); S.sel = +e.target.dataset.eeabre; redesenha(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && document.getElementById('ee') && !(e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) { e.preventDefault(); return e.shiftKey ? refaz() : desfaz(); }
    if (e.key === 'Escape' && (S.pal !== -2 || S.sel !== -1)) { S.pal = -2; S.sel = -1; redesenha(); }
    return;
  }
  var caminho = el.dataset.ee, m = /^itens\.(\d+)\.(\w+)$/.exec(caminho), i = m ? +m[1] : -1, b = i >= 0 ? itens()[i] : null, multi = !!el.dataset.multi;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); return sincroniza(el); }
  if (e.altKey && b && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); var delta = e.key === 'ArrowUp' ? -1 : 1, r = EB.moverBloco(itens(), i, delta); if (r.indice !== i) aplica(r.itens, { bloco: r.indice }); return; }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (b && (b.tipo === 'texto' || b.tipo === 'titulo') && m[2] === 'texto' && noFim(el)) return aplica(EB.inserirBloco(itens(), i + 1, bloco('texto')), { bloco: i + 1, fim: false });
    if (multi) document.execCommand('insertText', false, '\n');
    return;
  }
  if (e.key === 'Backspace' && b && (b.tipo === 'texto' || b.tipo === 'titulo') && m[2] === 'texto' && EB.htmlParaTexto(el.innerHTML) === '' && itens().length > 1) {
    e.preventDefault(); var r2 = EB.excluirBloco(itens(), i), nome = nomeTipo(b.tipo);
    aplica(r2.itens, { bloco: Math.max(0, i - 1) }); toast('Bloco “' + nome + '” excluído.'); return;
  }
  if (e.key === 'Escape') el.blur();
});
// Arrastar um bloco pela alça.
document.addEventListener('dragstart', function (e) { var g = e.target.closest && e.target.closest('[data-eearrasta]'); if (!g || !DEP) return; S.arrasto = +g.dataset.eearrasta; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(S.arrasto)); });
document.addEventListener('dragover', function (e) { if (S.arrasto === null) return; var bk = e.target.closest && e.target.closest('#ee [data-eebk]'); if (bk) { e.preventDefault(); document.querySelectorAll('#ee .ee-over').forEach(function (x) { x.classList.remove('ee-over'); }); bk.classList.add('ee-over'); } });
document.addEventListener('drop', function (e) {
  if (S.arrasto === null) return; var bk = e.target.closest && e.target.closest('#ee [data-eebk]'); if (!bk) return;
  e.preventDefault(); var de = S.arrasto, para = +bk.dataset.eebk; S.arrasto = null;
  var r = EB.moverBloco(itens(), de, para - de); if (r.indice !== de) aplica(r.itens, null); else redesenha();
});
document.addEventListener('dragend', function () { S.arrasto = null; document.querySelectorAll('#ee .ee-over').forEach(function (x) { x.classList.remove('ee-over'); }); });
