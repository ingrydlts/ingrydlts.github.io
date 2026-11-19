// Testa que a ficha do CRM mostra a Rota da Sécu com palavras, não com chaves: "Situação", "Ponto na Sécu" e a origem do guia.
// Usa o crm.js de verdade em Node (ficha-harness.mjs). Pessoas inventadas.
//
// Uso: node admin/crm/db/testes/crm-rota-ficha.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';
import { PORTAS, PONTOS } from '../../../../guias/rota-da-secu/casos.js';

let ok = 0, falhou = 0;
const check = (r, c) => { if (c) ok++; else { falhou++; console.log('  FALHOU:', r); } };

const h = await carregarCrm({ respostas: {}, expor: ['respostasKv', 'origLabel', 'eventText'] });
const linhas = (resp) => h.mod.respostasKv(pessoa({ respostas: resp, origem: 'guia-rota-da-secu' }));
const valor = (rows, rotulo) => { const r = rows.find((x) => x[0] === rotulo); return r ? r[1] : undefined; };

for (const p of PORTAS) for (const q of PONTOS) {
  const rows = linhas({ porta: p.id, ponto: q.id });
  check(p.id + '.' + q.id + ': "Situação" mostra o texto da porta e "Ponto na Sécu" o do ponto', valor(rows, 'Situação') === p.desc && valor(rows, 'Ponto na Sécu') === q.rot);
}
check('valor fora da lista não quebra: mostra a chave crua', valor(linhas({ porta: 'admin', ponto: 'x' }), 'Situação') === 'admin');
check('a origem do guia tem nome legível', h.mod.origLabel('guia-rota-da-secu') === 'Guia Rota da Sécu');
check('as respostas do Mapa antigo e dos outros guias continuam (cfNivel)', valor(h.mod.respostasKv(pessoa({ respostas: { cfNivel: 'l1' }, origem: 'guia-etudes-en-france-2027' })), 'Nível da candidatura') !== undefined);

const ev = (tipo, dados) => h.mod.eventText({ tipo, dados, criado_em: '2026-11-19T10:00:00Z' });
check('a Jornada mostra o pedido de acompanhamento com o nome da opção', JSON.stringify(ev('pedido_acompanhamento', { acompanhamento: 'chamada', origem: 'guia-rota-da-secu' })) === JSON.stringify(['resposta', 'Pediu orçamento de acompanhamento: Ligue sem medo']));
check('as três opções têm o nome da página', ['email', 'mes'].every((k, i) => ev('pedido_acompanhamento', { acompanhamento: k })[1] === ['Pediu orçamento de acompanhamento: Escreva sem erro', 'Pediu orçamento de acompanhamento: Resolva de ponta a ponta'][i]));
check('opção desconhecida não quebra a Jornada', /Pediu orçamento de acompanhamento/.test(ev('pedido_acompanhamento', { acompanhamento: 'x<b>' })[1]));

console.log(`${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
