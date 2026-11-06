// Testa o modelo painel_recap_30min (Painel do Certificado): o texto montado mostra só o bloco do ponto de partida e o do certificado.
// Sem banco. Pessoas fictícias.   Uso: node crm-painel-recap.test.mjs
import * as ES from '../../estudio.js';
import { gerar, CHAVE, D } from '../modelo-painel-certificado-recap.mjs';
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const o = ES.objetivo('freebie');
const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = {};
const mt = ES.montar(d, o.tipo);
const m = { chave: CHAVE, criado_no_estudio: true, tipo: o.tipo, para_quem: { materiais: ['guia-painel-do-certificado'] } };
const oferecidos = ES.varsDoModelo(CHAVE, m);
const todas = {}; oferecidos.forEach((k) => { todas[k] = false; });
const dados = (extra) => Object.assign({}, todas, { nome: 'Bia', email: 'bia@example.com', assunto: 'x', pre: 'x' }, extra);
const t = (extra) => ES.preencher(mt.corpo_texto, dados(extra), false);
check('há um bloco por ponto de partida (4) e um por certificado (10)', d.itens.filter((i) => i.tipo === 'etapa').length === 14);
check('todas as variáveis dos blocos existem no modelo', d.itens.filter((i) => i.tipo === 'etapa').every((i) => oferecidos.includes(i.se.replace('#', ''))));
const a = t({ porta_pvt: true, etapa_cert_delf: true });
check('PVT + DELF: mostra o bloco do PVT e o do DELF', a.includes('Para quem está na França por PVT') && a.includes('Para quem está preparando DELF'));
check('PVT + DELF: não mostra au pair nem TCF', !a.includes('Para quem é au pair') && !a.includes('preparando TCF'));
const b = t({});
check('sem respostas: nenhum bloco de etapa, só o e-mail base', !b.includes('Para quem') && b.includes('Oi Bia'));
check('o botão leva à página pública do painel', mt.corpo_html.includes('imigrantepordentro.com/produtos-digitais/painel-do-certificado'));
check('envio desligado e rascunho no SQL', /envio_ligado/.test(gerar()) && gerar().includes("'rascunho'") && /false\)\s*on conflict/.test(gerar()));
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
