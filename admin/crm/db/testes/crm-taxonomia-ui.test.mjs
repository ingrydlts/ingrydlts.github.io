// Testa o catálogo e a classificação dos modelos de e-mail (admin/crm/taxonomia.js). Módulo puro, sem DOM.
//
// Uso: cd admin/crm/db/testes && node crm-taxonomia-ui.test.mjs
import { FAMILIAS, PAGINAS, PERSONAS, classifica, temColunas, rotuloFamilia, rotuloPagina, rotuloEtapa, familiaDoObjetivo, agrupa, filtroVazio, situacaoDe, aplicaFiltros, limpaEtapasOrfas, VISOES } from '../../taxonomia.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

// ---------- Catálogo ----------
check('8 famílias na ordem', FAMILIAS.map((f) => f[0]).join() === 'entrega,personalizado,aquecimento,serie,compra,acesso,reimpacto,campanha');
check('6 páginas (a I05 é a do Au pair, a I06 a do Mapa da saúde)', PAGINAS.map((p) => p.k).join() === 'I01,I02,I03,I04,I05,I06');
check('4 personas', PERSONAS.map((p) => p[0]).join() === 'au_pair,pvt,estudante,conjuge');
check('I03 tem 5 etapas', PAGINAS[2].etapas.length === 5);

// ---------- Modo banco ----------
const b = classifica({ chave: 'x', familia: 'acesso', pagina: null, etapa: null, persona: null });
check('banco: origem', b.origem === 'banco');
check('banco: valores', b.familia === 'acesso' && b.pagina === null && b.etapa === null && b.persona === null);
check('banco: familia null continua banco', classifica({ chave: 'boas_vindas', familia: null }).origem === 'banco');

// ---------- Modo de reserva ----------
function res(chave, fam, pag, persona, extra) {
  const c = classifica(Object.assign({ chave: chave }, extra || {}));
  check(chave + ' reserva origem', c.origem === 'reserva');
  check(chave + ' familia=' + fam, c.familia === fam);
  check(chave + ' pagina=' + pag, c.pagina === (pag || null));
  check(chave + ' etapa null', c.etapa === null);
  check(chave + ' persona=' + persona, c.persona === (persona || null));
}
res('boas_vindas', 'acesso');
res('acesso_confirmado', 'acesso');
res('link_pagamento', 'compra');
res('hub_estudos_compra', 'compra', null, null, { tipo: 'compra' });
res('hub_estudos_d3', 'compra', null, null, { tipo: 'compra' });
['naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp'].forEach((k) => res(k, 'reimpacto'));
['cf_guia_1', 'cf_guia_conversa'].forEach((k) => res(k, 'entrega', 'I03'));
['aq_a_d3', 'aq_b_d6', 'aq_c_d15'].forEach((k) => res(k, 'aquecimento', 'I03'));
res('guia_alternancia', 'entrega', 'I01');
['guia_chamada', 'guia_plataforma'].forEach((k) => res(k, 'entrega', 'I04'));
res('tec_recap_30min', 'entrega', 'I02');
['aupair_chegada_1', 'aupair_chegada_2'].forEach((k) => res(k, 'entrega', 'I05', 'au_pair'));
['hub_estudos_lancamento', 'lembrete_prazo_vlsts'].forEach((k) => res(k, 'campanha'));

let desconhecida;
let lancou = false;
try { desconhecida = classifica({ chave: 'chave_que_nao_existe' }); } catch (e) { lancou = true; }
check('desconhecida não lança', !lancou);
check('desconhecida tudo null', desconhecida && desconhecida.familia === null && desconhecida.pagina === null && desconhecida.etapa === null && desconhecida.persona === null);

// ---------- Rótulos ----------
check('rotuloEtapa conhecida', rotuloEtapa('I02', 'tec-nao-sei') === 'Não sei o nível');
check('rotuloEtapa desconhecida', rotuloEtapa('I02', 'etapa-nova') === 'etapa-nova');
check('rotuloFamilia', rotuloFamilia('entrega') === 'Entrega do material');
check('rotuloFamilia null', rotuloFamilia(null) === 'Sem classificação');
check('rotuloFamilia desconhecida', rotuloFamilia('zzz') === 'zzz');
check('rotuloPagina', rotuloPagina('I03') === 'I03 · Études en France 2027-2028');
check('rotuloPagina desconhecida', rotuloPagina('I99') === 'I99');

// ---------- Objetivo e colunas ----------
check('familiaDoObjetivo freebie', familiaDoObjetivo('freebie') === 'entrega');
check('familiaDoObjetivo zzz', familiaDoObjetivo('zzz') === null);
check('familiaDoObjetivo lancamento', familiaDoObjetivo('lancamento') === 'campanha');
check('temColunas sem', temColunas([{ chave: 'a' }]) === false);
check('temColunas com', temColunas([{ familia: null }]) === true);
check('temColunas vazia', temColunas([]) === true);

// ---------- Agrupamento ----------
export function fixture32() {
  const compra = ['hub_estudos_compra', 'hub_estudos_d3', 'link_pagamento'];
  const chaves = [];
  ['a', 'b', 'c'].forEach((l) => ['d3', 'd6', 'd10', 'd15'].forEach((d) => chaves.push('aq_' + l + '_' + d)));
  chaves.push('cf_guia_1', 'cf_guia_conversa', 'guia_alternancia', 'guia_chamada', 'guia_plataforma', 'tec_recap_30min',
    'aupair_chegada_1', 'aupair_chegada_2', 'boas_vindas', 'acesso_confirmado', 'link_pagamento', 'hub_estudos_compra',
    'hub_estudos_d3', 'hub_estudos_lancamento', 'lembrete_prazo_vlsts', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp', 'zz1');
  return chaves.map((c, i) => ({ chave: c, nome: 'Modelo ' + c, ordem: i, tipo: compra.indexOf(c) >= 0 ? 'compra' : 'email', excluido_em: null }));
}
const gs = agrupa(fixture32());
const gr = (id) => gs.find((g) => g.id === id);
const chavesDe = (g) => (g ? g.itens.map((m) => m.chave) : []);
check('fixture32 tem 32', fixture32().length === 32);
check('nenhum grupo Outros', gs.every((g) => g.titulo !== 'Outros'));
check('zz1 em sem, único', gr('sem') && chavesDe(gr('sem')).join() === 'zz1' && gr('sem').selo === 'atenção' && gr('sem').titulo === 'Sem classificação');
check('aq_* em I03', chavesDe(gr('I03')).indexOf('aq_a_d3') >= 0 && chavesDe(gr('I03')).indexOf('aq_c_d15') >= 0);
check('cf_guia_* em I03', chavesDe(gr('I03')).indexOf('cf_guia_1') >= 0 && chavesDe(gr('I03')).indexOf('cf_guia_conversa') >= 0);
check('guia_alternancia em I01', chavesDe(gr('I01')).indexOf('guia_alternancia') >= 0);
check('título da página', gr('I03').titulo === 'I03 · Études en France 2027-2028');
check('aupair_chegada_1 em I05', chavesDe(gr('I05')).indexOf('aupair_chegada_1') >= 0 && chavesDe(gr('I05')).indexOf('aupair_chegada_2') >= 0);
check('itens do grupo = soma dos subgrupos', gs.every((g) => !g.subgrupos.length || g.subgrupos.reduce((n, sg) => n + sg.itens.length, 0) === g.itens.length));
// Com o Au pair na I05, nenhum modelo do fixture sobra solto na família "entrega": o grupo some.
check('ordem: páginas, famílias, sem', gs.map((g) => g.id).join() === 'I01,I02,I03,I04,I05,compra,acesso,reimpacto,campanha,sem');

const e = agrupa([
  { chave: 'a', nome: 'A', ordem: 1, familia: 'entrega', pagina: 'I02', etapa: 'tec-nao-sei', persona: null },
  { chave: 'b', nome: 'B', ordem: 2, familia: 'entrega', pagina: 'I02', etapa: 'etapa-nova', persona: null },
  { chave: 'c', nome: 'C', ordem: 3, familia: 'entrega', pagina: 'I02', etapa: null, persona: null },
  { chave: 'd', nome: 'D', ordem: 4, familia: null, pagina: 'I02', etapa: null, persona: null }
]);
check('etapas: 1 grupo I02', e.length === 1 && e[0].id === 'I02');
check('etapa conhecida antes da nova', e[0].subgrupos[0].titulo === 'Não sei o nível' && e[0].subgrupos[1].titulo === 'etapa-nova');
check('sem etapa por último, com título da família', e[0].subgrupos[2].titulo === 'Entrega do material');
check('página sem família: subgrupo Sem classificação', e[0].subgrupos[3].titulo === 'Sem classificação');

const x = agrupa([{ chave: 'q', nome: 'Q', excluido_em: '2026-01-01', familia: 'acesso', pagina: null, etapa: null, persona: null }]);
check('excluído some', x.length === 0);
check('lista vazia', agrupa([]).length === 0 && agrupa(null).length === 0);
const s = agrupa([
  { chave: 's1', nome: 'B', ordem: 2, familia: 'serie', pagina: null, etapa: null, persona: 'pvt' },
  { chave: 's2', nome: 'A', ordem: 2, familia: 'serie', pagina: null, etapa: null, persona: 'au_pair' },
  { chave: 's3', nome: 'Z', ordem: 1, familia: 'serie', pagina: null, etapa: null, persona: 'pvt' }
]);
check('serie: subgrupos por persona', s[0].id === 'serie' && s[0].subgrupos.map((g) => g.titulo).join() === 'Au pair,PVT');
check('ordena por ordem e nome', s[0].subgrupos[1].itens.map((m) => m.chave).join() === 's3,s1');
check('malformado não lança', (() => { try { agrupa([null, {}, { chave: 1 }]); return true; } catch (er) { return false; } })());

// ---------- Filtros, situação e visões ----------
const F = (o) => Object.assign(filtroVazio(), o || {});
const sv = () => [];
const chv = (l) => l.map((m) => m.chave).join();
const M = (chave, o) => Object.assign({ chave: chave, nome: 'Modelo ' + chave, objetivo: null, excluido_em: null,
  familia: 'entrega', pagina: null, etapa: null, persona: null, tipo: 'email' }, o || {});

check('filtroVazio chaves', Object.keys(filtroVazio()).sort().join() === 'etapas,familias,paginas,personas,q,semClasse,situacoes,soEspecificos,tipos');
check('filtroVazio valores', (() => { const f = filtroVazio(); return f.q === '' && f.soEspecificos === false && f.semClasse === false && f.paginas.length === 0; })());

const pers = [M('p1', { persona: 'au_pair' }), M('p2', { persona: null }), M('p3', { persona: 'pvt' })];
check('persona mantém X e null', chv(aplicaFiltros(pers, F({ personas: ['au_pair'] }), sv)) === 'p1,p2');
check('soEspecificos tira null', chv(aplicaFiltros(pers, F({ personas: ['au_pair'], soEspecificos: true }), sv)) === 'p1');

const pg = [M('t1', { pagina: 'I02', etapa: 'tec-nao-sei' }), M('t2', { pagina: 'I02', etapa: 'tec-juntando' }), M('t3', { pagina: 'I01' }), M('t4', { pagina: null })];
check('página + etapa', chv(aplicaFiltros(pg, F({ paginas: ['I02'], etapas: ['tec-nao-sei'] }), sv)) === 't1');
check('página I02 sem etapa', chv(aplicaFiltros(pg, F({ paginas: ['I02'] }), sv)) === 't1,t2');
check('página sem', chv(aplicaFiltros(pg, F({ paginas: ['sem'] }), sv)) === 't4');
check('página sem + I01 (ou)', chv(aplicaFiltros(pg, F({ paginas: ['sem', 'I01'] }), sv)) === 't3,t4');
check('órfãs: sem página limpa tudo', limpaEtapasOrfas({ paginas: [], etapas: ['tec-nao-sei'] }).etapas.length === 0);
check('órfãs: com página mantém', limpaEtapasOrfas({ paginas: ['I02'], etapas: ['tec-nao-sei'] }).etapas.join() === 'tec-nao-sei');
check('órfãs: outra página remove', limpaEtapasOrfas({ paginas: ['I01'], etapas: ['tec-nao-sei', 'alt-pesquisando'] }).etapas.join() === 'alt-pesquisando');
check('órfãs: preserva outros campos', limpaEtapasOrfas(F({ q: 'x', etapas: ['a'] })).q === 'x');
check('órfãs: não lança', (() => { try { limpaEtapasOrfas(null); limpaEtapasOrfas({}); return true; } catch (er) { return false; } })());

const tf = [M('n1', { tipo: 'novidades', familia: 'aquecimento' }), M('n2', { tipo: 'novidades', familia: 'entrega' }), M('n3', { tipo: 'email', familia: 'aquecimento' })];
check('tipos e famílias combinam com e', chv(aplicaFiltros(tf, F({ tipos: ['novidades'], familias: ['aquecimento'] }), sv)) === 'n1');
check('família: ou dentro do filtro', chv(aplicaFiltros(tf, F({ familias: ['aquecimento', 'entrega'] }), sv)) === 'n1,n2,n3');

const vs = (rs) => rs;
const sit = situacaoDe(M('s'), vs([{ etapa: 'rascunho', testado_em: null }, { etapa: 'no_ar' }]));
check('situação: rascunho + noAr + semTeste', sit.rascunho === true && sit.noAr === true && sit.semTeste === true && sit.revisao === false);
const sit2 = situacaoDe(M('s'), [{ etapa: 'rascunho', testado_em: '2026-11-01' }, { etapa: 'no_ar' }]);
check('situação: testado => semTeste false', sit2.semTeste === false && sit2.rascunho === true);
check('situação: semTeste só olha a mais nova em rascunho/revisão', situacaoDe(M('s'), [{ etapa: 'no_ar', testado_em: null }]).semTeste === false);
check('situação: revisão', situacaoDe(M('s'), [{ etapa: 'revisao', testado_em: null }]).revisao === true);
const env = situacaoDe(M('s', { envio_gatilho: 'g', envio_ligado: true }), []);
check('envio ligado', env.envioLigado === true && env.envioDesligado === false);
const env2 = situacaoDe(M('s', { envio_gatilho: 'g', envio_ligado: false }), []);
check('envio desligado', env2.envioLigado === false && env2.envioDesligado === true);
const env3 = situacaoDe(M('s'), []);
check('sem gatilho: nenhum envio', env3.envioLigado === false && env3.envioDesligado === false);
check('situação robusta', (() => { try { const r = situacaoDe(null, null); return r.noAr === false && r.semTeste === false; } catch (er) { return false; } })());

const bs = [M('aq_b_d3', { nome: 'Aquecimento · trilha B · dossiê enviado' }), M('x', { nome: 'Outro', objetivo: 'Explica o DOSSIÊ' }), M('y', { nome: 'Nada' })];
check('q acha por nome', chv(aplicaFiltros(bs, F({ q: 'trilha b' }), sv)) === 'aq_b_d3');
check('q sem acento e caixa (nome+objetivo)', chv(aplicaFiltros(bs, F({ q: 'dossie' }), sv)) === 'aq_b_d3,x');
check('q com acento acha sem acento', chv(aplicaFiltros([M('z', { nome: 'dossie' })], F({ q: 'DOSSIÊ' }), sv)) === 'z');

const ex = [M('e1', { excluido_em: '2026-01-01' }), M('e2')];
check('excluído nunca passa', chv(aplicaFiltros(ex, filtroVazio(), sv)) === 'e2');
check('lista inválida', aplicaFiltros(null, filtroVazio(), sv).length === 0);
check('aplicaFiltros robusto', (() => { try { aplicaFiltros([null, {}, { chave: 1 }], null, null); return true; } catch (er) { return false; } })());

// Visões
const visao = (k) => VISOES.find((v) => v.k === k);
check('4 visões', VISOES.map((v) => v.k).join() === 'rascunhos,teste,ligado,semclasse');
check('nomes das visões', visao('rascunhos').nome === 'Rascunhos para revisar' && visao('teste').nome === 'Esperando o meu teste' && visao('ligado').nome === 'Envio ligado' && visao('semclasse').nome === 'Sem classificação');
const vm = [M('v_rasc'), M('v_rev'), M('v_teste'), M('v_lig', { envio_gatilho: 'g', envio_ligado: true }), M('v_sem', { familia: null, pagina: null }), M('v_ar')];
const vers = { v_rasc: [{ etapa: 'rascunho', testado_em: 'x' }], v_rev: [{ etapa: 'revisao', testado_em: 'x' }], v_teste: [{ etapa: 'rascunho', testado_em: null }], v_ar: [{ etapa: 'no_ar' }] };
const vd = (c) => vers[c] || [];
const aplicaV = (k) => chv(aplicaFiltros(vm, F(visao(k).filtros), vd));
check('visão rascunhos', aplicaV('rascunhos') === 'v_rasc,v_rev,v_teste');
check('visão teste', aplicaV('teste') === 'v_teste');
check('visão ligado', aplicaV('ligado') === 'v_lig');
check('visão semclasse', aplicaV('semclasse') === 'v_sem');
check('semClasse: reserva sem classificação', chv(aplicaFiltros([{ chave: 'zz1', nome: 'Z' }, { chave: 'boas_vindas', nome: 'B' }], F({ semClasse: true }), sv)) === 'zz1');


// ---------- crm.js: lista agrupada (harness) ----------
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TX from '../../taxonomia.js';
import * as JRM from '../../jornada.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const csrc = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const handlers = {};
let focoSpy = null;
const doc = { getElementById: el, addEventListener(t, fn) { (handlers[t] = handlers[t] || []).push(fn); }, querySelectorAll: () => [], querySelector: (sel) => (focoSpy ? focoSpy(sel) : null), activeElement: null };
const chamadas = [];
function fromFake(tab) {
  const q = { insert(v) { chamadas.push({ tab, op: 'insert', v }); return Promise.resolve({ error: null, data: [v] }); }, update(v) { chamadas.push({ tab, op: 'update', v }); return q; }, eq() { return q; }, select() { return Promise.resolve({ error: null, data: [] }); }, then(f) { return Promise.resolve({ error: null, data: [] }).then(f); } };
  return q;
}
const ESF = { casosDe: () => [] };
const sb = { from: fromFake, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
const H = new Function('supabase', 'ES', 'TX', 'EE', 'EQ', 'JR', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  csrc + '\n;return { setM: function (v) { M = v; }, setMV: function (v) { MV = v; }, renderJornada, cabecalhoHtml, jornadaAtual, pgAtual, modelosDaPagina, classeHtml, mudarClasse, criarModelo, renderEditor, renderModelos, listaModelos, opcoesPorCategoria, ST };')(
  sb, ESF, TX, { iniciar() {}, depois() {}, campoMudou() {}, topo() { return ''; }, html() { return ''; } }, {}, JRM, doc, { addEventListener() {} }, { href: '' }, { getItem: () => null, setItem() {} }, () => 1, () => {});
console.log('== crm.js: sem a lista e a barra de filtros; Jornada e header fixo ==');
const mods = fixture32().map((m) => Object.assign({ criado_no_estudio: false, excluido_em: null }, m));
mods.push({ chave: 'excl1', nome: 'Excluido um', ordem: 99, tipo: 'email', criado_no_estudio: false, excluido_em: '2026-01-01' });
H.setM(mods); H.setMV([]);
check('listaModelos: sem excluídos', H.listaModelos().every((m) => !m.excluido_em) && H.listaModelos().length === 32);
const op = H.opcoesPorCategoria(['cf_guia_1', 'naoabriu'], 'cf_guia_1');
check('opcoes: dois optgroup', (op.match(/<optgroup/g) || []).length === 2);
check('opcoes: selected em cf_guia_1', /<option value="cf_guia_1" selected>/.test(op) && op.indexOf('selected') === op.lastIndexOf('selected'));
const opEx = H.opcoesPorCategoria(['excl1', 'cf_guia_1'], 'excl1');
check('opcoes: excluído atual continua na lista e selecionado', /<option value="excl1" selected>/.test(opEx) && /<option value="cf_guia_1">/.test(opEx) && (opEx.match(/<option /g) || []).length === 2);

const htmlIdx = readFileSync(path.resolve(HERE, '../../index.html'), 'utf8');
const cssSrc = readFileSync(path.resolve(HERE, '../../crm.css'), 'utf8');
check('a tela não tem mais a coluna da lista nem o "Filtros e busca" nem a faixa de largura', !/id="mod-list"|id="mod-filtros"|id="st-grip"|Filtros e busca/.test(htmlIdx));
check('o código não tem mais a lista agrupada nem a barra de filtros', !/function renderLista|function renderFiltros|function aoClicarFiltro|function aoDigitarFiltro|CAT_FECHADA|st-grip/.test(csrc));
check('no celular as abas são só Editar e Prévia', /data-sttab="editar"/.test(htmlIdx) && /data-sttab="previa"/.test(htmlIdx) && !/data-sttab="lista"/.test(htmlIdx));

// A Jornada ficou com o que a lista fazia: criar modelo novo e restaurar os excluídos
H.renderJornada();
const jr = el('mod-jornada').innerHTML;
check('Jornada: botão + Modelo novo', jr.indexOf('id="st-novo-modelo"') >= 0);
check('Jornada: excluídos com Restaurar', jr.indexOf('Excluídos') >= 0 && jr.indexOf('data-strestaurar="excl1"') >= 0);
check('Jornada: modelo ativo abre pelo cartão', jr.indexOf('data-jr-abrir="cf_guia_1"') >= 0 && jr.indexOf('data-jr-abrir="excl1"') < 0);
check('editor: "Excluir este modelo" mora em Avançado', /function passoQuem[\s\S]*?class="ee-excluir"[\s\S]*?data-stexcluir=[\s\S]*?Excluir este modelo/.test(csrc));
check('excluir o modelo aberto volta para a Jornada', /async function excluirModelo[\s\S]*?ST\.vista = 'jornada'/.test(csrc));
check('header fixo: o editor escreve o cabeçalho em #st-cab (página de entrada, e-mails por etapa, nome, passos e barra do Texto)', /cab\.innerHTML = '<div class="ee-fixo">' \+ cabecalhoHtml\([\s\S]*?topo \+ '<div class="ee-barra-passos">' \+ passos[\s\S]*?EE\.topo\(\)/.test(csrc));
check('o cabeçalho mora logo abaixo das abas, antes do estúdio', htmlIdx.indexOf('id="st-cab"') > htmlIdx.indexOf('id="mod-estudio"') && htmlIdx.indexOf('id="st-cab"') < htmlIdx.indexOf('id="studio"'));
check('css: #st-cab é sticky no alto, e os painéis descontam a altura dele', /\.st-cab\{position:sticky; top:0;/.test(cssSrc) && (cssSrc.match(/var\(--st-head-h, 0px\)/g) || []).length >= 2);

// O cabeçalho parte da página de entrada: escolhe a página, vê os e-mails por etapa, e o que falta vira "+ criar"
H.ST.vazio = false; H.ST.k = 'cf_guia_1';
const Jx = H.jornadaAtual();
check('cabeçalho: o modelo aberto define a página (cf_guia_1 mora na I03)', H.pgAtual(Jx) === 'I03');
const cabI03 = H.cabecalhoHtml(Jx, 'I03');
check('cabeçalho: uma pílula por página de entrada (I01 a I05) e "Todos os percursos"', ['I01', 'I02', 'I03', 'I04', 'I05', 'TR'].every((k) => cabI03.indexOf('data-stpg="' + k + '"') >= 0));
check('cabeçalho: a página atual vem marcada', /data-stpg="I03" aria-current="true"/.test(cabI03) && /data-stpg="I01" aria-current="false"/.test(cabI03));
check('cabeçalho: o e-mail aberto vem marcado e abre pelo mesmo clique da lista antiga (data-tpl-pick)', /data-tpl-pick="cf_guia_1" aria-current="true"/.test(cabI03));
const faltasI03 = JRM.ETAPAS.filter((e) => Jx.linhas.find((l) => l.k === 'I03').celulas[e.k].length === 0);
check('cabeçalho: etapa sem e-mail vira "+ criar" com o mesmo valor da Jornada', faltasI03.length > 0 && faltasI03.every((e) => cabI03.indexOf('data-jr-criar="I03|' + e.k + '"') >= 0));
check('cabeçalho: etapa com e-mail não oferece criar', JRM.ETAPAS.filter((e) => !faltasI03.includes(e)).every((e) => cabI03.indexOf('data-jr-criar="I03|' + e.k + '"') < 0));
// Uma página sem nenhum e-mail: tira os da I01 do fixture e confere o estado vazio
H.setM(mods.filter((m) => classifica(m).pagina !== 'I01'));
const Jv = H.jornadaAtual();
check('sem os e-mails da I01, a página não tem e-mail', H.modelosDaPagina(Jv, 'I01').length === 0);
const cabV = H.cabecalhoHtml(Jv, 'I01');
check('cabeçalho: página sem nenhum e-mail mostra as 4 etapas para criar e nenhum e-mail para abrir', (cabV.match(/data-jr-criar="I01\|/g) || []).length === 4 && cabV.indexOf('data-tpl-pick') < 0);
H.ST.vazio = true; H.ST.pg = 'I01'; H.ST.k = null;
check('cabeçalho: página escolhida sem e-mail continua selecionada, sem e-mail aberto', H.pgAtual(Jv) === 'I01' && /data-stpg="I01" aria-current="true"/.test(H.cabecalhoHtml(Jv, H.pgAtual(Jv))) && !/class="ee-passo ee-et"[^>]*aria-current="true"/.test(H.cabecalhoHtml(Jv, 'I01')));
H.ST.vazio = false; H.ST.pg = null; H.ST.k = 'cf_guia_1';
H.setM(mods);
check('cabeçalho: modelosDaPagina da I03 tem o cf_guia_1', H.modelosDaPagina(Jx, 'I03').some((m) => m.chave === 'cf_guia_1'));
check('handler: escolher a página no dropdown abre o primeiro e-mail dela ou mostra o estado vazio', /async function abrirPaginaEntrada\(pg\)[\s\S]*?modelosDaPagina\(jornadaAtual\(\), pg\)\[0\][\s\S]*?ST\.vazio = true/.test(csrc) && /e\.target\.id === 'st-pg-sel'\) return abrirPaginaEntrada\(e\.target\.value\)/.test(csrc));

check('css: o grid do estúdio tem só o editor e a prévia', /\.studio\{position:relative; display:grid; grid-template-columns:minmax\(0,1\.25fr\) minmax\(0,\.95fr\);/.test(cssSrc));

// ---------- Classificar um modelo ----------
console.log('== crm.js: classificar ==');
const com = fixture32().map((m) => Object.assign({ familia: null, pagina: null, etapa: null, persona: null, criado_no_estudio: false }, m));
const mI02 = Object.assign({}, com[0], { chave: 'cl1', familia: 'entrega', pagina: 'I02', etapa: 'tec-nao-sei' });
H.setM(com.concat([mI02]));
const chNova = H.classeHtml(Object.assign({}, mI02, { chave: 'cl9', etapa: 'etapa-nova' }));
check('classe: etapa fora do catálogo aparece selecionada', /<option value="etapa-nova" selected>etapa-nova<\/option>/.test(chNova));
const ch = H.classeHtml(mI02);
check('classe: 4 selects', ['familia', 'pagina', 'etapa', 'persona'].every((c) => ch.indexOf('data-classe="' + c + '"') >= 0));
check('classe: etapas de I02 e nenhuma de I01', ch.indexOf('value="tec-nao-sei"') >= 0 && PAGINAS[1].etapas.every((e) => ch.indexOf('value="' + e[0] + '"') >= 0) && PAGINAS[0].etapas.every((e) => ch.indexOf('value="' + e[0] + '"') < 0));
check('classe: com colunas e com página, nada disabled', ch.indexOf('disabled') < 0);
const semPg = H.classeHtml(Object.assign({}, com[0], { chave: 'cl2', familia: 'acesso' }));
check('classe: etapa disabled sem página', /data-classe="etapa" disabled/.test(semPg));
check('classe: com família não pede onde mora', semPg.indexOf('Escolha onde este e-mail mora') < 0);
check('classe: sem família nem página pede', H.classeHtml(Object.assign({}, com[0], { chave: 'cl3' })).indexOf('Escolha onde este e-mail mora') >= 0);
H.setM(fixture32());
const off = H.classeHtml(fixture32()[0]);
check('classe: sem colunas, tudo disabled e aviso', (off.match(/<select/g) || []).length === 4 && (off.match(/<select[^>]* disabled/g) || []).length === 4 && off.indexOf('rode db/crm-taxonomia-modelos.sql') >= 0);

H.setM(com.concat([mI02])); H.ST.k = 'cl1';
chamadas.length = 0;
try { await H.mudarClasse('pagina', 'I04'); } catch (er) { console.log('  erro', er.message); }
const up = chamadas.find((c) => c.op === 'update' && c.tab === 'modelos_email');
check('mudarClasse: update com pagina I04 e etapa null', up && up.v.pagina === 'I04' && up.v.etapa === null && up.v.familia === 'entrega');
chamadas.length = 0;
try { await H.mudarClasse('persona', ''); } catch (er) {}
const up2 = chamadas.find((c) => c.op === 'update');
check('mudarClasse: vazio vira null', up2 && up2.v.persona === null);

// Criação
H.setM(com);
Object.assign(ESF, {
  OBJETIVOS: [{ k: 'freebie', nome: 'Entrega', d: 'd', tipo: 'servico', sai: 'manual' }],
  objetivo: (k) => (k === 'freebie' ? ESF.OBJETIVOS[0] : null), CAT: {}, TIPO_RODAPE: {},
  varsDoModelo: () => [], esqueleto: () => ({ itens: [] }), montar: () => ({ assunto: 'a', preheader: 'p', corpo_texto: 't', corpo_html: 'h' }) });
H.ST.criar = { passo: 1, obj: null, nome: '', para: { }, classe: { familia: null, pagina: null, etapa: null, persona: null } };
H.ST.tab = 'editar';
for (const h of handlers.click) { try { await h((() => { const alvo = { dataset: { novoobj: 'freebie' }, id: '', matches: () => false }; alvo.closest = () => alvo; return { target: alvo, preventDefault() {} }; })()); } catch (er) { console.log('  clk', er.message); } }
check('criar: objetivo freebie pré-preenche familia entrega', H.ST.criar && H.ST.criar.classe.familia === 'entrega');
async function criaCom(colunas) {
  H.setM(colunas ? com : fixture32().map((m) => Object.assign({ criado_no_estudio: false }, m)));
  H.ST.criar = { passo: 4, obj: 'freebie', nome: 'Teste x', para: {}, classe: { familia: 'entrega', pagina: 'I01', etapa: null, persona: null } };
  chamadas.length = 0;
  try { await H.criarModelo({ disabled: false, textContent: '' }); } catch (er) {}
  return chamadas.find((c) => c.op === 'insert' && c.tab === 'modelos_email');
}
const ins1 = await criaCom(true);
check('criarModelo: com colunas insere familia e pagina', ins1 && ins1.v.familia === 'entrega' && ins1.v.pagina === 'I01' && ins1.v.etapa === null);
const ins2 = await criaCom(false);
check('criarModelo: sem colunas não envia as chaves', ins2 && !('familia' in ins2.v) && !('pagina' in ins2.v) && !('etapa' in ins2.v) && !('persona' in ins2.v));
const ins3 = await (async () => { H.setM([]); H.ST.criar = { passo: 4, obj: 'freebie', nome: 'Teste x', para: {}, classe: { familia: 'entrega', pagina: 'I01', etapa: null, persona: null } }; chamadas.length = 0; try { await H.criarModelo({ disabled: false, textContent: '' }); } catch (er) {} return chamadas.find((c) => c.op === 'insert' && c.tab === 'modelos_email'); })();
check('criarModelo: tabela vazia não envia familia', ins3 && !('familia' in ins3.v));

console.log(passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
