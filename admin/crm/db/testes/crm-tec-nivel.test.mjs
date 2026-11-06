// Testa o modelo tec_nivel_3dias (guia do tecnólogo, um bloco por nível): o texto montado mostra só o bloco do nível tocado.
// Sem banco. Pessoas fictícias.   Uso: node crm-tec-nivel.test.mjs
import * as ES from '../../estudio.js';
import { gerar, CHAVE, D } from '../modelo-tecnologo-nivel.mjs';
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const o = ES.objetivo('aquecimento');
const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = {};
const mt = ES.montar(d, o.tipo);
const m = { chave: CHAVE, criado_no_estudio: true, tipo: o.tipo, para_quem: { materiais: ['guia-tecnologo'] } };
const oferecidos = ES.varsDoModelo(CHAVE, m);
const base = {}; oferecidos.forEach((k) => { base[k] = false; });
const bot = { texto: 'L3: https://imigrantepordentro.com/conversa/?r=nivel-l3&t=X\nLicence pro: …\nM1: …', html: '<a href="#">L3</a>' };
const t = (extra) => ES.preencher(mt.corpo_texto, Object.assign({}, base, { nome: 'Bia', email: 'bia@example.com', assunto: 'x', pre: 'x', botoes_nivel_tec: bot }, extra), false);
check('há um bloco por nível (3)', d.itens.filter((i) => i.tipo === 'etapa').length === 3);
check('as variáveis dos blocos existem no modelo', d.itens.filter((i) => i.tipo === 'etapa').every((i) => oferecidos.includes(i.se.replace('#', ''))));
check('os botões de nível existem no modelo', oferecidos.includes('botoes_nivel_tec'));
const l3 = t({ nivel_l3: true }), lp = t({ nivel_licence_pro: true }), m1 = t({ nivel_m1: true }), nada = t({});
check('L3: só o bloco do L3', l3.includes('Para quem quer entrar no L3') && !l3.includes('entrar na Licence pro') && !l3.includes('entrar no M1'));
check('Licence pro: só o bloco da Licence pro e o prazo 17 de janeiro de 2027', lp.includes('Para quem quer entrar na Licence pro') && lp.includes('17 de janeiro de 2027') && !lp.includes('entrar no L3'));
check('M1: só o bloco do M1 e a regra dos 180 ECTS', m1.includes('Para quem quer entrar no M1') && m1.includes('180 ECTS') && !m1.includes('entrar no L3'));
check('quem não tocou nível: e-mail sem bloco de nível, mas com a pergunta e os botões', !nada.includes('Para quem quer entrar') && nada.includes('Em que nível você quer entrar?') && nada.includes('nivel-l3'));
check('os três blocos citam a fonte (ficha F2713 ou prazo)', [l3, lp, m1].every((x) => /F2713|17 de janeiro/.test(x)));
check('sem marcador entre colchetes no texto', !/\[[^\]\n]{2,60}\]/.test(l3 + lp + m1));
const sql = gerar();
check('SQL: sai 3 dias depois do recap, às 10h, Envio desligado, rascunho', sql.includes("'email', 'tec_recap_30min', 3, 10, null, false") && sql.includes("'rascunho'"));
check('SQL: tipo novidades (só quem aceitou) e rodapé com "responda sair"', sql.includes("'novidades'") && /palavra sair/i.test(mt.corpo_texto));
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
