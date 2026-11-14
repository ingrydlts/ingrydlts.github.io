import { estimar, motivoFora, fraseQuem } from '../../editor-quem.js';
import { PAGINAS } from '../../taxonomia.js';
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
if (falhas) { console.log(falhas + ' falhas'); process.exit(1); }
