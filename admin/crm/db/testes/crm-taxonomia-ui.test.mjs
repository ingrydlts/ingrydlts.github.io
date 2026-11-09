// Testa o catálogo e a classificação dos modelos de e-mail (admin/crm/taxonomia.js). Módulo puro, sem DOM.
//
// Uso: cd admin/crm/db/testes && node crm-taxonomia-ui.test.mjs
import { FAMILIAS, PAGINAS, PERSONAS, classifica, temColunas, rotuloFamilia, rotuloPagina, rotuloEtapa, familiaDoObjetivo, agrupa, filtroVazio, situacaoDe, aplicaFiltros, limpaEtapasOrfas, VISOES } from '../../taxonomia.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

// ---------- Catálogo ----------
check('8 famílias na ordem', FAMILIAS.map((f) => f[0]).join() === 'entrega,personalizado,aquecimento,serie,compra,acesso,reimpacto,campanha');
check('4 páginas', PAGINAS.map((p) => p.k).join() === 'I01,I02,I03,I04');
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
['aupair_chegada_1', 'aupair_chegada_2'].forEach((k) => res(k, 'entrega', null, 'au_pair'));
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
check('aupair_chegada_1 em entrega', chavesDe(gr('entrega')).indexOf('aupair_chegada_1') >= 0);
check('itens do grupo = soma dos subgrupos', gs.every((g) => !g.subgrupos.length || g.subgrupos.reduce((n, sg) => n + sg.itens.length, 0) === g.itens.length));
check('ordem: páginas, famílias, sem', gs.map((g) => g.id).join() === 'I01,I02,I03,I04,entrega,compra,acesso,reimpacto,campanha,sem');

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

console.log(passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
