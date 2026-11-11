import { estimar, motivoFora, fraseQuem } from '../../editor-quem.js';
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
if (falhas) { console.log(falhas + ' falhas'); process.exit(1); }
