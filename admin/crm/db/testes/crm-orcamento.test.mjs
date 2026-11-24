// Testa o "Novo orçamento" (aba E-mail da ficha): a conta com desconto por linha, o texto do e-mail, o PDF (jsPDF de verdade) e a tela ligada
// ao crm.js real, em Node, com navegador e Supabase de mentira. NÃO testa nada em navegador real. Dados inventados (o repositório é público).
//
// Uso: cd admin/crm/db/testes && node crm-orcamento.test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarCrm, pessoa } from './ficha-harness.mjs';
import * as OC from '../../orcamento.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { jsPDF } = createRequire(import.meta.url)(path.resolve(HERE, '../../vendor/jspdf.umd.min.js'));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const L = (servico, preco, desc) => ({ servico, preco, desc: desc || { ativo: false, tipo: 'pct', valor: '' } });

console.log('== Valor e conta ==');
check('lerValor: 70, 70,5, 1.200,50, € 70, R$ 1.000', OC.lerValor('70') === 70 && OC.lerValor('70,5') === 70.5 && OC.lerValor('1.200,50') === 1200.5 && OC.lerValor('€ 70') === 70 && OC.lerValor('R$ 1.000') === 1000);
check('lerValor recusa vazio, zero, negativo, texto, enorme', [null, '', '0', '-5', 'abc', '2000000'].every((v) => OC.lerValor(v) === null));
{
  const r = OC.calcular([L('Ligação inicial', '40'), L('Acompanhamento', '90', { ativo: true, tipo: 'pct', valor: '10' }), L('Revisão', '120,50', { ativo: true, tipo: 'val', valor: '20' })], 'EUR');
  check('desconto % só onde marcado: 90 − 10% = 81; valor: 120,50 − 20 = 100,50; sem marca: 40', r.linhas[0].total === 40 && r.linhas[1].total === 81 && r.linhas[1].desconto === 9 && r.linhas[2].total === 100.5);
  check('subtotal 250,50, descontos 29, total 221,50', r.subtotal === 250.5 && r.descontos === 29 && r.total === 221.5 && r.moeda === 'EUR');
  check('o desconto desmarcado é ignorado mesmo com valor digitado', OC.calcular([L('X', '100', { ativo: false, tipo: 'pct', valor: '50' })]).total === 100);
  check('arredonda em centavos (33,33% de 10 = 3,33)', OC.calcular([L('X', '10', { ativo: true, tipo: 'pct', valor: '33,33' })]).linhas[0].desconto === 3.33);
  check('desconto de 100% zera a linha; de 100,01% ou 0% é recusado', OC.calcular([L('X', '10', { ativo: true, tipo: 'pct', valor: '100' })]).total === 0 && OC.calcular([L('X', '10', { ativo: true, tipo: 'pct', valor: '100,01' })]).erro && OC.calcular([L('X', '10', { ativo: true, tipo: 'pct', valor: '0' })]).erro);
  check('desconto em valor maior que o preço é recusado', /Linha 1/.test(OC.calcular([L('X', '10', { ativo: true, tipo: 'val', valor: '11' })]).erro));
  check('linhas em branco são ignoradas; erro aponta a linha certa', OC.calcular([L('', ''), L('A', '5'), L('', '')]).linhas.length === 1 && OC.calcular([L('A', '5'), L('', '9')]).linha === 2 && OC.calcular([L('A', '5'), L('B', 'x')]).linha === 2);
  check('nada preenchido: pede pelo menos um serviço', /pelo menos um/.test(OC.calcular([L('', ''), L('', '')]).erro) && /pelo menos um/.test(OC.calcular([]).erro));
  check('serviço de 161 letras é recusado', OC.calcular([L('x'.repeat(161), '5')]).erro);
  check('real (BRL) e moeda desconhecida cai em euro', OC.calcular([L('A', '5')], 'BRL').moeda === 'BRL' && OC.calcular([L('A', '5')], 'USD').moeda === 'EUR');
  check('fmt: € 70, € 70,50, R$ 1.200', OC.fmt(70, 'EUR') === '€ 70' && OC.fmt(70.5, 'EUR') === '€ 70,50' && OC.fmt(1200, 'BRL') === 'R$ 1.200');
}

console.log('\n== Texto do e-mail, número e arquivo ==');
{
  const calc = OC.calcular([L('Ligação inicial', '40'), L('Acompanhamento', '90', { ativo: true, tipo: 'pct', valor: '10' })], 'EUR');
  const ate = new Date(2026, 11, 9), t = OC.textoEmail('Wellington', calc, { ate, obs: 'Pix ou transferência.' });
  check('texto: saudação, serviços, desconto explicado, total, validade e "em anexo"', /^Oi Wellington, tudo bem\?/.test(t) && t.includes('• Ligação inicial: € 40') && t.includes('• Acompanhamento: € 90 → € 81 (desconto de 10%)') && t.includes('Total: € 121') && t.includes('em anexo (PDF) e vale até 09/12/2026') && t.includes('Pix ou transferência.'));
  check('texto sem observação nem validade não deixa buraco nem "undefined"', !/undefined|null|\[/.test(OC.textoEmail('Ana', calc, {})) && !/vale até/.test(OC.textoEmail('Ana', calc, {})));
  check('validadeAte soma os dias (15 por padrão; limita 1 a 365)', OC.validadeAte(new Date(2026, 10, 24), '15').getTime() === new Date(2026, 11, 9).getTime() && OC.validadeAte(new Date(2026, 10, 24), 'abc').getTime() === new Date(2026, 11, 9).getTime() && OC.validadeAte(new Date(2026, 0, 1), -3).getDate() === 2);
  check('número do orçamento: ORC-AAAAMMDD-HHMM', OC.numeroOrcamento(new Date(2026, 10, 24, 9, 5)) === 'ORC-20261124-0905');
  check('nome do arquivo sem acento nem símbolo', OC.nomeArquivo('José da Conceição <b>!', new Date(2026, 10, 24)) === 'Orcamento-Por-Dentro-Jose-da-Conceicao-b-2026-11-24.pdf' && OC.nomeArquivo('', new Date(2026, 10, 24)).includes('-cliente-'));
}

console.log('\n== PDF (jsPDF 2.5.2 de verdade) ==');
{
  const hoje = new Date(), calc = OC.calcular([L('Ligação inicial de 20 minutos', '40'), L('Acompanhamento na ligação à CPAM', '90', { ativo: true, tipo: 'pct', valor: '10' })], 'EUR');
  const base = { nome: 'Wellington Prado', email: 'w@example.com', calc, numero: OC.numeroOrcamento(hoje), hoje, ate: OC.validadeAte(hoje, 15), obs: 'Pagamento por Pix.' };
  const doc = OC.montarPdf(jsPDF, base), bytes = new Uint8Array(doc.output('arraybuffer'));
  check('gera um PDF válido de 1 página, pequeno', String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' && doc.getNumberOfPages() === 1 && bytes.length < 60000);
  const muitas = OC.calcular(Array.from({ length: 40 }, (_, i) => L('Serviço número ' + (i + 1) + ' com um nome comprido para quebrar linha na tabela do orçamento da Ingryd', '10')), 'EUR');
  check('40 serviços passam para a página 2 sem quebrar', OC.montarPdf(jsPDF, { ...base, calc: muitas }).getNumberOfPages() >= 2);
  check('PDF em real e sem observação também sai', OC.montarPdf(jsPDF, { ...base, calc: OC.calcular([L('A', '10')], 'BRL'), obs: '' }).getNumberOfPages() === 1);
  check('nome com caracteres especiais não quebra o PDF', OC.montarPdf(jsPDF, { ...base, nome: 'Zoë Ñandú <script>', email: '' }).getNumberOfPages() === 1);
}

console.log('\n== Tela: abrir, preencher, anexar ==');
{
  const h = await carregarCrm({ respostas: {}, expor: ['orcAbrir', 'orcGerar', 'orcLer', 'orcPinta', 'convAdicionar'] });
  h.mod.setC([pessoa({ id: 'c1', nome: 'Wellington Prado', email: 'w@example.com' })]); h.mod.setPRODUTOS([{ slug: 'g', nome: 'Guia X', preco: 10 }]);
  const modal = () => h.el('compose-modal').innerHTML, lin = () => h.el('orc-linhas').innerHTML;   // as linhas são pintadas dentro de #orc-linhas
  h.mod.orcAbrir('c1');
  check('abre com 2 linhas, moeda, validade, observações e os dois botões', /id="orc-serv-0"/.test(lin()) && /id="orc-serv-1"/.test(lin()) && !/id="orc-serv-2"/.test(lin()) && /id="orc-moeda"/.test(modal()) && /id="orc-validade"/.test(modal()) && /id="orc-obs"/.test(modal()) && /data-orcgerar="anexar"/.test(modal()) && /data-orcgerar="baixar"/.test(modal()) && /Wellington Prado/.test(modal()));
  check('sugere os serviços conhecidos (produtos da vitrine e os de ligação)', /<option value="Guia X">/.test(modal()) && /Acompanhamento na ligação à CPAM/.test(modal()));
  await h.click({ orcadd: '1' });
  check('"+ Adicionar serviço" cria a linha 3', /id="orc-serv-2"/.test(lin()));
  await h.click({ orcrm: '2' });
  check('"Tirar" remove a linha', !/id="orc-serv-2"/.test(lin()));
  h.el('orc-serv-0').value = 'Ligação inicial'; h.el('orc-preco-0').value = '40';
  h.el('orc-serv-1').value = 'Acompanhamento'; h.el('orc-preco-1').value = '90';
  h.el('orc-dchk-1').checked = true; await h.handlers.change[h.handlers.change.length - 1]({ target: { classList: { contains: () => true }, closest: () => ({}) } });
  check('marcar "Desconto" mostra o campo do desconto só naquela linha, mantendo o que foi digitado', /id="orc-dval-1"/.test(lin()) && !/id="orc-dval-0"/.test(lin()) && /value="Ligação inicial"/.test(lin()) && /value="90"/.test(lin()));
  h.el('orc-dval-1').value = '10'; h.el('orc-dtipo-1').value = 'pct';
  await h.handlers.input[h.handlers.input.length - 1]({ target: { closest: () => ({}) } });
  check('o resumo e o total de cada linha atualizam ao digitar', /Total € 121/.test(h.el('orc-resumo').textContent) && /Descontos € 9/.test(h.el('orc-resumo').textContent) && h.el('orc-tot-1').textContent === '€ 81' && h.el('orc-tot-0').textContent === '€ 40');

  h.el('orc-preco-0').value = 'abc'; await h.mod.orcGerar('anexar');
  check('preço inválido: mostra o erro da linha e não anexa', h.el('orc-err').hidden === false && /Linha 1/.test(h.el('orc-err').textContent) && (h.mod.getCONV_AX().c1 || []).length === 0);
  h.el('orc-preco-0').value = '40';
  await h.mod.orcGerar('anexar');
  check('sem o jsPDF carregável: avisa e não anexa', /gerador de PDF/.test(h.el('orc-err').textContent) && (h.mod.getCONV_AX().c1 || []).length === 0);

  h.win.jspdf = { jsPDF };
  h.el('conv-txt').value = ''; h.el('conv-assunto').value = '';
  await h.mod.orcGerar('anexar');
  const ax = h.mod.getCONV_AX().c1 || [];
  check('anexa 1 PDF com o nome do orçamento', ax.length === 1 && /^Orcamento-Por-Dentro-Wellington-Prado-\d{4}-\d{2}-\d{2}\.pdf$/.test(ax[0].name) && ax[0].type === 'application/pdf' && ax[0].size > 1000);
  check('preenche o texto do e-mail (serviços, desconto, total) e o assunto', /Oi Wellington, tudo bem\?/.test(h.el('conv-txt').value) && /€ 90 → € 81 \(desconto de 10%\)/.test(h.el('conv-txt').value) && /Total: € 121/.test(h.el('conv-txt').value) && h.el('conv-assunto').value === 'Seu orçamento · Por Dentro' && h.mod.state.rascunho.c1 === h.el('conv-txt').value);
  check('fecha o pop-up', h.el('compose-modal').hidden === true);
  h.mod.orcAbrir('c1'); h.el('orc-serv-0').value = 'Outro serviço'; h.el('orc-preco-0').value = '15';
  await h.mod.orcGerar('anexar');
  check('um orçamento novo troca o anterior (continua 1 PDF só)', (h.mod.getCONV_AX().c1 || []).length === 1);
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
