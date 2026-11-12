// Testa as funções puras do editor de e-mail (admin/crm/editor-blocos.js): texto guardado ⇄ HTML editável (com as etiquetas dos
// dados da pessoa), operações nos blocos (inserir, excluir, mover, duplicar, trocar tipo), a paleta e os menus "/" e "@", e o
// histórico de desfazer. Sem DOM, sem banco.
//
// Uso: cd admin/crm/db/testes && node crm-editor-blocos.test.mjs
import * as EB from '../../editor-blocos.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const ida = (t, r) => EB.htmlParaTexto(EB.textoParaHtml(t, r));

// ---------- Texto guardado → HTML editável ----------
check('texto simples sem mudança', EB.textoParaHtml('Oi, tudo bem?') === 'Oi, tudo bem?');
check('vazio', EB.textoParaHtml('') === '' && EB.textoParaHtml(null) === '' && EB.textoParaHtml(undefined) === '');
let h = EB.textoParaHtml('Oi {nome}!', { nome: 'nome' });
check('{nome} vira uma etiqueta, sem chaves no texto visível', !h.replace(/<[^>]*>/g, '').includes('{') && h.includes('class="ed-chip"') && h.includes('data-raw="{nome}"') && h.includes('>nome</span>'));
check('a etiqueta não é editável', h.includes('contenteditable="false"'));
check('rótulo da etiqueta vem do catálogo', EB.textoParaHtml('{etapa}', { etapa: 'etapa do guia' }).includes('>etapa do guia</span>'));
check('dado sem rótulo usa o próprio nome', EB.textoParaHtml('{prazo_limite}', {}).includes('>prazo_limite</span>'));
h = EB.textoParaHtml('um **negrito** aqui');
check('**negrito** vira <b>', h === 'um <b>negrito</b> aqui');
check('quebra de linha vira <br>', EB.textoParaHtml('a\nb') === 'a<br>b');
check('escapa HTML', EB.textoParaHtml('a < b & "c"') === 'a &lt; b &amp; &quot;c&quot;');
check('não deixa passar tag escrita pela pessoa', !EB.textoParaHtml('<img src=x onerror=alert(1)>').includes('<img'));
h = EB.textoParaHtml('{#nome}{nome}, oi{/nome}{^nome}Oi{/nome}', { nome: 'nome' });
check('marcadores de condição viram etiquetas de controle', (h.match(/class="ed-chip ctl"/g) || []).length === 4);
check('marcador "se tem" legível', h.includes('se tem nome') && h.includes('se não tem nome') && h.includes('fim'));
check('dado desconhecido também vira etiqueta', EB.textoParaHtml('{algo_novo}').includes('data-raw="{algo_novo}"'));
check('chaves que não são dado ficam como texto', EB.textoParaHtml('use {assim com espaço}') === 'use {assim com espaço}');
check('** sem par fica como texto', EB.textoParaHtml('a ** b') === 'a ** b');

// ---------- HTML editável → texto guardado (e a volta inteira) ----------
const casos = [
  'Oi {nome}!', 'um **negrito** aqui', 'linha 1\nlinha 2\n\nlinha 4', 'a < b & "c" \'d\'', '{#nome}{nome}, oi{/nome}{^nome}Oi{/nome}',
  '**{nome}**, veja https://exemplo.com/x?a=1&b=2', '{#etapa_recusa_idade}Você disse que ouviu "só até 29".{/etapa_recusa_idade}', '{algo_novo} e {prazo_limite}',
  'Moro na França desde 2023', '', '   espaços   ', 'a ** b', '🙂 emoji e acentuação: ação, coração'
];
casos.forEach((c) => check('volta idêntica: ' + JSON.stringify(c).slice(0, 50), ida(c, { nome: 'nome' }) === c));

// O que o navegador pode devolver depois de a pessoa digitar.
check('<div> por linha vira quebra', EB.htmlParaTexto('a<div>b</div><div>c</div>') === 'a\nb\nc');
check('<div><br></div> é uma linha vazia', EB.htmlParaTexto('a<div><br></div><div>b</div>') === 'a\n\nb');
check('<br> no fim (que o navegador deixa) é ignorado', EB.htmlParaTexto('texto<br>') === 'texto');
check('espaço duro vira espaço comum', EB.htmlParaTexto('a&nbsp;b') === 'a b');
check('caractere de largura zero some', EB.htmlParaTexto('a​b') === 'ab');
check('<strong> também vira **', EB.htmlParaTexto('<strong>x</strong>') === '**x**');
check('negrito vazio some', EB.htmlParaTexto('a<b></b>b') === 'ab');
check('negrito dentro de negrito vira um só', EB.htmlParaTexto('<b>a<b>b</b></b>') === '**ab**');
check('entidades', EB.htmlParaTexto('a &lt; b &amp; c &quot;d&quot; &#39;e&#39;') === 'a < b & c "d" \'e\'');
check('etiqueta volta como {dado}', EB.htmlParaTexto('Oi <span class="ed-chip" contenteditable="false" data-raw="{nome}">nome</span>!') === 'Oi {nome}!');
check('tag desconhecida é descartada, o texto fica', EB.htmlParaTexto('a<span style="color:red">b</span>c') === 'abc');
check('script não vira texto executável', !EB.htmlParaTexto('<script>alert(1)</script>x').includes('<'));

// ---------- Blocos ----------
const A = { tipo: 'titulo', texto: 'A' }, B = { tipo: 'texto', texto: 'B', estilo: 'caixa' }, C = { tipo: 'assinatura', texto: 'C' };
const base = () => [A, B, C].map((x) => Object.assign({}, x));
let r = EB.inserirBloco(base(), 1, { tipo: 'botao', rotulo: 'Ir', link: '' });
check('inserir no meio', r.map((b) => b.tipo).join() === 'titulo,botao,texto,assinatura');
check('inserir no fim', EB.inserirBloco(base(), 3, { tipo: 'texto', texto: '' }).length === 4);
check('inserir além do fim vai para o fim', EB.inserirBloco(base(), 99, { tipo: 'texto', texto: '' })[3].tipo === 'texto');
check('inserir com índice negativo vai para o começo', EB.inserirBloco(base(), -5, { tipo: 'texto', texto: 'x' })[0].texto === 'x');
const orig = base(); EB.inserirBloco(orig, 0, { tipo: 'texto', texto: 'x' });
check('não altera a lista original', orig.length === 3);

const ex = EB.excluirBloco(base(), 1);
check('excluir devolve a lista sem o bloco', ex.itens.map((b) => b.texto).join() === 'A,C');
check('excluir devolve o bloco removido e o índice (para desfazer)', ex.removido.texto === 'B' && ex.indice === 1);
check('desfazer a exclusão volta à mesma posição', EB.inserirBloco(ex.itens, ex.indice, ex.removido).map((b) => b.texto).join() === 'A,B,C');
check('excluir índice inválido não muda nada', EB.excluirBloco(base(), 9).itens.length === 3 && EB.excluirBloco(base(), 9).removido === null);

let mv = EB.moverBloco(base(), 1, -1);
check('mover para cima', mv.itens.map((b) => b.texto).join() === 'B,A,C' && mv.indice === 0);
mv = EB.moverBloco(base(), 1, 1);
check('mover para baixo', mv.itens.map((b) => b.texto).join() === 'A,C,B' && mv.indice === 2);
mv = EB.moverBloco(base(), 0, -1);
check('mover o primeiro para cima não faz nada', mv.itens.map((b) => b.texto).join() === 'A,B,C' && mv.indice === 0);
mv = EB.moverBloco(base(), 2, 1);
check('mover o último para baixo não faz nada', mv.indice === 2);
mv = EB.moverBloco(base(), 0, 2);
check('mover várias casas (arrastar)', mv.itens.map((b) => b.texto).join() === 'B,C,A' && mv.indice === 2);

const dup = EB.duplicarBloco(base(), 1);
check('duplicar põe a cópia logo abaixo', dup.map((b) => b.texto).join() === 'A,B,B,C');
dup[2].texto = 'mudou';
check('a cópia é independente do original', dup[1].texto === 'B');

let t = EB.trocarTipoTexto(base(), 1, 'titulo');
check('texto → título mantém o texto e tira o estilo de caixa', t[1].tipo === 'titulo' && t[1].texto === 'B' && !('estilo' in t[1]));
t = EB.trocarTipoTexto(base(), 0, 'texto');
check('título → texto mantém o texto', t[0].tipo === 'texto' && t[0].texto === 'A');
t = EB.trocarTipoTexto(base(), 2, 'titulo');
check('só troca entre texto e título (assinatura fica)', t[2].tipo === 'assinatura');

check('resumo de um texto', EB.resumoBloco({ tipo: 'texto', texto: 'Olá   mundo' }) === 'Olá mundo');
check('resumo de um botão usa o rótulo', EB.resumoBloco({ tipo: 'botao', rotulo: 'Marcar uma call' }) === 'Marcar uma call');
check('resumo corta em 60 e põe reticências', EB.resumoBloco({ tipo: 'texto', texto: 'x'.repeat(100) }).length === 61 && EB.resumoBloco({ tipo: 'texto', texto: 'x'.repeat(100) }).endsWith('…'));
check('resumo de bloco vazio', EB.resumoBloco({ tipo: 'texto', texto: '' }) === '');

// ---------- Paleta e menus ----------
const nomes = EB.PALETA.map((p) => p.nome);
check('paleta: Intro primeiro, depois Título, Texto, Botão, Destaque, Pergunta, Assinatura', nomes.join() === 'Intro,Título,Texto,Botão,Destaque,Pergunta,Assinatura');
check('Intro é o tipo apresentacao', EB.PALETA[0].tipo === 'apresentacao');
check('filtrar vazio devolve tudo', EB.filtrarPaleta('').length === 7);
check('filtrar "bot" acha Botão', EB.filtrarPaleta('bot').map((p) => p.nome).join() === 'Botão');
check('filtrar ignora acento e caixa', EB.filtrarPaleta('TITU').map((p) => p.nome).join() === 'Título' && EB.filtrarPaleta('botao').length === 1);
check('filtrar "apres" acha a Intro pelo tipo', EB.filtrarPaleta('apres').map((p) => p.nome).join() === 'Intro');
check('filtrar sem resultado', EB.filtrarPaleta('zzz').length === 0);
check('blocos de guia só entram quando o modelo os tem', EB.filtrarPaleta('', { etapa: true, toques: false }).map((p) => p.tipo).join().includes('etapa') && !EB.filtrarPaleta('', { etapa: true, toques: false }).some((p) => p.tipo === 'toques'));

check('"/" no começo abre o menu de blocos', JSON.stringify(EB.detectaComando('/')) === '{"tipo":"slash","q":""}');
check('"/bot" filtra', EB.detectaComando('/bot').q === 'bot');
check('"/" no meio de uma frase não é comando', EB.detectaComando('a/b') === null && EB.detectaComando('veja /bot') === null);
check('"/bot x" (com espaço) não é mais comando', EB.detectaComando('/bot x') === null);
check('"@" no fim abre o menu de dados', JSON.stringify(EB.detectaComando('Oi @')) === '{"tipo":"at","q":""}');
check('"@no" filtra', EB.detectaComando('Oi @no').q === 'no' && EB.detectaComando('Oi @no').tipo === 'at');
check('e-mail escrito (a@b) não é comando', EB.detectaComando('fale com a@b.com') === null);
check('texto comum não é comando', EB.detectaComando('Oi, tudo bem?') === null && EB.detectaComando('') === null);

const dados = [['nome', 'primeiro nome'], ['nivel', 'o nível'], ['prazo_limite', 'a data do prazo']];
check('filtrar dados por prefixo, sem acento', EB.filtrarDados(dados, 'niv').map((d) => d[0]).join() === 'nivel' && EB.filtrarDados(dados, 'NÍV').length === 1);
check('filtrar dados também acha pelo que a descrição diz', EB.filtrarDados(dados, 'prazo').map((d) => d[0]).join() === 'prazo_limite');
check('filtrar dados vazio devolve tudo', EB.filtrarDados(dados, '').length === 3);

// ---------- Histórico (desfazer e refazer) ----------
const hi = EB.criarHistorico(3);
check('começa sem o que desfazer', !hi.podeDesfazer() && !hi.podeRefazer());
hi.registrar([1]); hi.registrar([1, 2]);
check('pode desfazer depois de registrar', hi.podeDesfazer());
let d = hi.desfazer([1, 2, 3]);
check('desfazer devolve o estado anterior', JSON.stringify(d) === '[1,2]');
check('depois de desfazer, pode refazer', hi.podeRefazer());
d = hi.refazer([1, 2]);
check('refazer devolve o que foi desfeito', JSON.stringify(d) === '[1,2,3]');
hi.desfazer([1, 2, 3]); hi.registrar([9]);
check('uma mudança nova apaga o que dava para refazer', !hi.podeRefazer());
const h2 = EB.criarHistorico(2); h2.registrar([1]); h2.registrar([2]); h2.registrar([3]);
check('guarda no máximo N estados', JSON.stringify(h2.desfazer([4])) === '[3]' && JSON.stringify(h2.desfazer([3])) === '[2]' && !h2.podeDesfazer());
const obj = [{ x: 1 }]; const h3 = EB.criarHistorico(5); h3.registrar(obj); obj[0].x = 99;
check('guarda uma cópia, não a referência', h3.desfazer([{ x: 2 }])[0].x === 1);
check('desfazer sem histórico devolve null', EB.criarHistorico(3).desfazer([1]) === null && EB.criarHistorico(3).refazer([1]) === null);

console.log(failed ? `\n${passed} passaram, ${failed} FALHARAM` : `\n${passed} passaram, 0 falharam`);
process.exit(failed ? 1 : 0);
