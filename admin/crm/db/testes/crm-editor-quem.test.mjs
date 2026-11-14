import { estimar, motivoFora, fraseQuem, paginaAtual, etapasDaPagina, aplicarPagina, fraseCascata } from '../../editor-quem.js';
import { PAGINAS } from '../../taxonomia.js';
import { readFileSync } from 'node:fs';
var falhas = 0; function check(n, ok) { console.log((ok ? 'ok   ' : 'FALHA ') + n); if (!ok) falhas++; }
var org = function (c) { return c.origens || []; };
var C = [
  { persona: 'a', origens: ['g1'], respostas: { objetivo: 'ap-x' }, estagio: 'lead', aceita_novidades: true },
  { persona: 'a', origens: ['g2'], respostas: {}, estagio: 'lead', aceita_novidades: false },
  { persona: 'b', origens: ['g1'], respostas: { objetivo: 'ap-y' }, estagio: 'ativado', aceita_novidades: true }];
check('sem regra: todos entram', estimar(C, { para_quem: {} }, org).n === 3);
check('material g1: 2', estimar(C, { para_quem: { materiais: ['g1'] } }, org).n === 2);
check('etapa ap-x: quem não respondeu entra (como o Worker)', estimar(C, { para_quem: { etapas: ['ap-x'] } }, org).n === 2);
check('novidades exige aceite', estimar(C, { tipo: 'novidades', para_quem: {} }, org).n === 2);
check('motivo persona', motivoFora(C[2], { para_quem: { personas: ['a'] } }, org) === 'persona');
check('porMotivo conta', estimar(C, { para_quem: { personas: ['a'] } }, org).porMotivo.persona === 1);
var f = fraseQuem({ tipo: 'novidades', para_quem: { materiais: ['g1'] } }, { material: function (x) { return 'M' + x; }, etapa: String });
check('frase', f.materiais === 'Mg1' && f.etapas === 'qualquer resposta' && f.novidades === true);
// Task 1: a página de inbound sabe seu material (token de origem) e suas personas.
var pg = function (k) { return PAGINAS.filter(function (p) { return p.k === k; })[0]; };
check('I01 liga ao guia alt30 e à persona alternancia_emprego', pg('I01').material === 'guia-email-alt30' && pg('I01').personas.join() === 'alternancia_emprego');
check('I03 liga ao Campus France', pg('I03').material === 'guia-etudes-en-france-2027' && pg('I03').personas.join() === 'campus_france');
check('I05 liga ao au pair', pg('I05').material === 'guia-checklist-chegada-au-pair' && pg('I05').personas.join() === 'au_pair_estudante');
check('I02 e I04 sem persona', pg('I02').personas.length === 0 && pg('I04').personas.length === 0 && pg('I02').material === 'guia-tecnologo' && pg('I04').material === 'guia-vls-ts');
check('todo material é único', new Set(PAGINAS.map(function (p) { return p.material; })).size === PAGINAS.length);
// Task 2: funções puras da cascata página → persona → etapa.
var P = PAGINAS, EF = [['alt-pesquisando', 'Alternância 30+: Pesquisando'], ['ap-travado', 'Au pair: Um passo travado']];
check('paginaAtual: um material conhecido', paginaAtual({ materiais: ['guia-email-alt30'] }, P) === 'I01');
check('paginaAtual: dois materiais = nenhuma', paginaAtual({ materiais: ['guia-email-alt30', 'guia-vls-ts'] }, P) === null);
check('paginaAtual: token desconhecido = nenhuma', paginaAtual({ materiais: ['instagram'] }, P) === null);
check('paginaAtual: sem regra = nenhuma', paginaAtual({}, P) === null);
check('etapasDaPagina só as filtráveis', etapasDaPagina(P[0], EF).map(function (e) { return e[0]; }).join() === 'alt-pesquisando');
check('etapasDaPagina I02 vazia', etapasDaPagina(P[1], EF).length === 0 && etapasDaPagina(null, EF).length === 0);
var a = aplicarPagina({ materiais: ['guia-vls-ts'], etapas: ['ap-travado'], personas: ['campus_france'], estagios: ['lead'] }, 'I01', P);
check('aplicarPagina grava material, zera etapa e persona', a.para.materiais.join() === 'guia-email-alt30' && !a.para.etapas && !a.para.personas && a.para.estagios.join() === 'lead' && a.limpou.join() === 'etapa,persona');
var b = aplicarPagina({ materiais: ['guia-email-alt30'], etapas: ['alt-pesquisando'] }, 'I01', P);
check('mesma página: nada é zerado', b.para.etapas.join() === 'alt-pesquisando' && b.limpou.length === 0);
var orig0 = { materiais: ['guia-vls-ts'], etapas: ['x'] }; aplicarPagina(orig0, 'I03', P);
check('não muda o original', orig0.materiais.join() === 'guia-vls-ts' && orig0.etapas.join() === 'x');
var c0 = aplicarPagina({ materiais: ['guia-vls-ts'], etapas: ['x'] }, null, P);
check('sem página limpa tudo', !c0.para.materiais && !c0.para.etapas && c0.limpou.join() === 'etapa');
var rot = { material: function (x) { return 'M' + x; }, etapa: String, persona: function (x) { return 'P' + x; } };
var f1 = fraseCascata({ tipo: 'novidades', para_quem: { materiais: ['guia-checklist-chegada-au-pair'] } }, P, rot);
check('frase com página e persona disponível', f1.pagina === 'I05 · Au pair · checklist de chegada' && f1.personas === 'qualquer persona' && f1.etapas === 'qualquer resposta' && f1.novidades === true);
var f2 = fraseCascata({ para_quem: { materiais: ['instagram', 'blog'] } }, P, rot);
check('frase com materiais soltos', f2.pagina === 'Minstagram ou Mblog' && f2.personas === null);
var f3 = fraseCascata({ para_quem: {} }, P, rot);
check('frase vazia', f3.pagina === 'qualquer página' && f3.personas === null);
var f4 = fraseCascata({ para_quem: { materiais: ['guia-etudes-en-france-2027'], personas: ['campus_france'] } }, P, rot);
check('frase com persona marcada', f4.personas === 'Pcampus_france');
check('estimar com a regra da página', estimar(C, { para_quem: aplicarPagina({}, 'I01', P).para }, org).n === 0);
// Task 3: a tela usa a cascata (a tela não roda em Node, então a ligação é conferida no fonte).
var fonte = readFileSync(new URL('../../crm.js', import.meta.url), 'utf8');
var indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
check('passoQuem usa a cascata', /EQ\.fraseCascata\(/.test(fonte) && /EQ\.etapasDaPagina\(/.test(fonte));
check('linhas Quem, Quando e Hoje', /<b>Quem:<\/b>/.test(fonte) && /<b>Quando:<\/b>/.test(fonte) && /<b>Hoje:<\/b>/.test(fonte));
check('troca de página usa aplicarPagina', /data-qpagina/.test(fonte) && /EQ\.aplicarPagina\(/.test(fonte));
check('o campo de material solto saiu do passo', !/data-qpop="mat"|chip\('mat'/.test(fonte));
check('versão de cache nova em crm.js e index.html', !/2026-11-13\.11/.test(fonte) && !/2026-11-13\.11/.test(indexHtml));
if (falhas) { console.log(falhas + ' falhas'); process.exit(1); }
