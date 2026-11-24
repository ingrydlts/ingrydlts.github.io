// Testa os pop-ups dos quatro indicadores da Hoje e o "Registrar pagamento" (pagamento direto, fora do Stripe), ligados ao crm.js real,
// em Node, com navegador e Supabase de mentira. NÃO testa nada em navegador real. Dados inventados (o repositório é público).
//
// Uso: cd admin/crm/db/testes && node crm-kpi-pop.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const ha = (d) => new Date(Date.now() - d * 864e5).toISOString();
const dia = (d) => ha(d).slice(0, 10);
const EXPOR = ['kpiPop', 'pagRegLer', 'pagRegAbrir', 'pagRegSalvar', 'pagRegApagar', 'kpiPopHtml', 'kpiJanela'];
const novo = async () => {
  const h = await carregarCrm({ respostas: {}, expor: EXPOR });
  h.mod.setC([
    pessoa({ id: 'c1', nome: 'Ana Souza', email: 'ana@example.com', criado_em: ha(2), user_id: 'u1', ultimo_evento_em: ha(1) }),
    pessoa({ id: 'c2', nome: 'Bia Lima', email: 'bia@example.com', criado_em: ha(30), user_id: 'u2', ultimo_evento_em: ha(20) }),
    pessoa({ id: 'c3', nome: 'Caio Reis <b>', email: 'caio@example.com', criado_em: ha(1), user_id: null })]);
  h.mod.setPRODUTOS([{ slug: 'guia-x', nome: 'Guia X', preco: 14.9 }]);
  h.mod.setCOMPRAS_EV([{ produto: 'guia-x', em: ha(3), contato_id: 'c3' }]);
  h.mod.setPRECOS([]); h.mod.setASSIN({});
  h.mod.setUM([{ id: 'u1', contato_id: 'c1', quando: ha(-3), status: 'agendado', criado_em: ha(2) }, { id: 'u2', contato_id: 'c2', quando: ha(-3), status: 'cancelado', criado_em: ha(2) }]);
  h.mod.setPAG1A1([{ contato_id: 'c1', minutos: 20, pago_em: ha(2), um_a_um_id: 'u1' }]);
  h.mod.setPAGOS([
    { contato_id: 'c1', referencia: 'cs_1', tipo: '1a1', servico: '1:1 de 20 min', valor_centavos: 2000, moeda: 'EUR', pago_em: ha(2) },
    { contato_id: 'c2', referencia: 'manual-pix-abc', tipo: 'outro', servico: 'Ligue sem Medo à Ameli', valor_centavos: 9000, moeda: 'EUR', pago_em: ha(4) },
    { contato_id: 'c2', referencia: 'manual-transferencia-def', tipo: 'outro', servico: 'Acompanhamento', valor_centavos: 60000, moeda: 'BRL', pago_em: ha(5) },
    { contato_id: 'c1', referencia: 'cs_velho', tipo: '1a1', servico: 'Antigo', valor_centavos: 5000, moeda: 'EUR', pago_em: ha(100) }]);
  return h;
};

console.log('== Receita: cada pagamento sai com serviço e origem ==');
{
  const h = await novo();
  const r = h.mod.receitaEstimada(new Date(Date.now() - 7 * 864e5), new Date(Date.now() + 1000));
  check('4 itens no período: Stripe, 2 diretos e 1 compra estimada; o de 100 dias fica de fora', r.itens.length === 4 && !r.itens.some((x) => x.servico === 'Antigo'));
  check('origem: cs_ = stripe, manual- = direto (com a forma), compra = estimado', r.itens.find((x) => x.ref === 'cs_1').origem === 'stripe' &&
    r.itens.find((x) => x.ref === 'manual-pix-abc').origem === 'direto' && r.itens.find((x) => x.ref === 'manual-pix-abc').forma === 'pix' &&
    r.itens.find((x) => x.servico === 'Guia X').origem === 'estimado' && r.itens.find((x) => x.servico === 'Guia X').contato_id === 'c3');
  check('o total em € soma Stripe + direto + estimado; o real não entra no total', Math.abs(r.total - (20 + 90 + 14.9)) < 0.001 && r.porMoeda.BRL === 600);
}

console.log('\n== Pop-ups dos quatro blocos ==');
{
  const h = await novo(), modal = () => h.el('compose-modal').innerHTML;
  h.mod.kpiPop('leads');
  check('leads (7 dias): Ana e Caio, não a Bia (30 dias atrás); HTML escapado', /Ana S\./.test(modal()) && /Caio R\./.test(modal()) && !/Bia L\./.test(modal()) && !/<b>/.test(modal().replace(/<\/?b>|<b[ >]/g, '')) );
  check('cada linha abre a ficha (data-kpiopen)', /data-kpiopen="c1"/.test(modal()) && /data-kpiopen="c3"/.test(modal()));
  h.mod.kpiPop('um');
  check('1:1: só o não cancelado (Ana), com os minutos do pagamento', /Ana S\./.test(modal()) && !/Bia L\./.test(modal()) && /20 min/.test(modal()));
  h.mod.kpiPop('plat');
  check('plataforma: Ana com atividade; Bia (com conta, parada) na seção "sem atividade"; Caio (sem conta) fora', /Ana S\./.test(modal()) && /sem atividade no período \(1\)/.test(modal()) && /Bia L\./.test(modal()) && !/Caio/.test(modal()));
  h.mod.kpiPop('rev');
  check('revenue: valor + serviço + pessoa de cada linha', /€ 20/.test(modal()) && /1:1 de 20 min/.test(modal()) && /Ligue sem Medo à Ameli/.test(modal()) && /€ 90/.test(modal()) && /R\$ 600/.test(modal()) && /Guia X/.test(modal()));
  check('revenue: origem de cada linha e o resumo por origem', /Stripe/.test(modal()) && /direto · Pix/.test(modal()) && /direto · Transferência/.test(modal()) && /estimado, preço de tabela/.test(modal()) && /Direto € 90/.test(modal()));
  check('revenue: só os lançados à mão têm "Apagar"; o do Stripe e o estimado não', (modal().match(/data-pagapagar=/g) || []).length === 2 && !/data-pagapagar="cs_1"/.test(modal()));
  check('revenue: botão de registrar pagamento e Fechar', /data-pagreg=""/.test(modal()) && /id="modal-cancel"/.test(modal()));
  h.mod.setPAGOS([]); h.mod.setCOMPRAS_EV([]); h.mod.kpiPop('rev');
  check('revenue vazio: mensagem e a dica do registro direto, sem NaN', /Nenhum pagamento/.test(modal()) && /Registrar pagamento/.test(modal()) && !/NaN|undefined/.test(modal()));
  h.mod.setC([]); h.mod.setUM([]); ['leads', 'um', 'plat'].forEach((k) => { h.mod.kpiPop(k); check('vazio sem erro: ' + k, /Nenhum|Ninguém/.test(modal()) && !/NaN|undefined/.test(modal())); });
}

console.log('\n== Cliques ==');
{
  const h = await novo();
  await h.click({ kpi: 'rev' });
  check('tocar no bloco do revenue abre o pop-up', /Revenue estimado/.test(h.el('compose-modal').innerHTML) && h.el('compose-modal').hidden === false);
  await h.click({ kpiopen: 'c1' });
  check('tocar numa pessoa fecha o pop-up e abre a ficha', h.el('compose-modal').hidden === true && h.mod.state.sel === 'c1');
}

console.log('\n== Registrar pagamento: conferência dos campos ==');
{
  const h = await novo(), ler = h.mod.pagRegLer, base = { contato_id: 'c1', servico: '  Ligue sem Medo  ', valor: '70', moeda: 'EUR', data: dia(1), forma: 'pix' };
  const ok = ler(base);
  check('válido: centavos, moeda, serviço aparado, tipo outro, referência manual-pix-…', ok.linha && ok.linha.valor_centavos === 7000 && ok.linha.moeda === 'EUR' && ok.linha.servico === 'Ligue sem Medo' && ok.linha.tipo === 'outro' && /^manual-pix-.{8,}/.test(ok.linha.referencia));
  check('data vira meio-dia UTC (cai no dia certo em Paris)', ok.linha.pago_em === dia(1) + 'T12:00:00Z');
  check('formato brasileiro: "1.200,50" = 120050 centavos; "70,5" = 7050', ler({ ...base, valor: '1.200,50' }).linha.valor_centavos === 120050 && ler({ ...base, valor: '70,5' }).linha.valor_centavos === 7050);
  check('símbolo e espaço no valor são aceitos: "€ 70"', ler({ ...base, valor: '€ 70' }).linha.valor_centavos === 7000);
  check('moeda real (BRL) e forma desconhecida cai em "outro"', ler({ ...base, moeda: 'brl', forma: 'xyz' }).linha.moeda === 'BRL' && /^manual-outro-/.test(ler({ ...base, forma: 'xyz' }).linha.referencia));
  check('recusa: sem pessoa, sem serviço, serviço longo', ler({ ...base, contato_id: '' }).erro && ler({ ...base, servico: '   ' }).erro && ler({ ...base, servico: 'x'.repeat(161) }).erro);
  check('recusa: valor zero, negativo, texto, enorme', ['0', '-5', 'abc', '', '100001'].every((v) => ler({ ...base, valor: v }).erro));
  check('recusa: moeda desconhecida, data vazia/inválida, data no futuro', ler({ ...base, moeda: 'USD' }).erro && ler({ ...base, data: '' }).erro && ler({ ...base, data: '2026-13-45' }).erro && ler({ ...base, data: dia(-10) }).erro);
  check('duas chamadas geram referências diferentes (a tabela exige única)', ler(base).linha.referencia !== ler(base).linha.referencia);
}

console.log('\n== Registrar pagamento: salvar e apagar ==');
{
  const h = await novo(), campos = { 'pg-pessoa': 'c1', 'pg-servico': 'Orçamento CPAM', 'pg-valor': '120', 'pg-moeda': 'EUR', 'pg-data': dia(0), 'pg-forma': 'transferencia' };
  const preenche = () => Object.entries(campos).forEach(([k, v]) => { h.el(k).value = v; });
  h.mod.pagRegAbrir('c1', true);
  check('o formulário abre com a pessoa fixa, serviço, valor, moeda, data e forma', /Registrar pagamento/.test(h.el('compose-modal').innerHTML) && /id="pg-valor"/.test(h.el('compose-modal').innerHTML) && /id="pg-forma"/.test(h.el('compose-modal').innerHTML) && /Ana Souza/.test(h.el('compose-modal').innerHTML));
  h.mod.pagRegAbrir('', true);
  check('sem pessoa escolhida: lista de pessoas para escolher', /<select id="pg-pessoa"/.test(h.el('compose-modal').innerHTML) && /bia@example.com/.test(h.el('compose-modal').innerHTML));
  preenche(); h.el('pg-valor').value = 'abc'; await h.mod.pagRegSalvar();
  check('campo inválido: mostra o erro e não grava', h.el('pg-err').hidden === false && /Valor inválido/.test(h.el('pg-err').textContent) && !h.writes.some((w) => w.table === 'pagamentos'));
  preenche(); const antes = h.mod.getPAGOS().length; await h.mod.pagRegSalvar();
  const w = h.writes.find((x) => x.op === 'insert' && x.table === 'pagamentos');
  check('grava em pagamentos: contato, tipo outro, 12000 centavos, EUR, referência manual-transferencia-…', w && w.row.contato_id === 'c1' && w.row.tipo === 'outro' && w.row.valor_centavos === 12000 && w.row.moeda === 'EUR' && /^manual-transferencia-/.test(w.row.referencia) && w.row.servico === 'Orçamento CPAM');
  check('entra na lista local (revenue sobe) e o pop-up volta ao revenue', h.mod.getPAGOS().length === antes + 1 && /Revenue estimado/.test(h.el('compose-modal').innerHTML) && /Orçamento CPAM/.test(h.el('compose-modal').innerHTML));
  await h.mod.pagRegApagar('cs_1');
  check('pagamento do Stripe não se apaga por aqui', !h.writes.some((x) => x.op === 'delete'));
  await h.mod.pagRegApagar('manual-pix-abc');
  const d = h.writes.find((x) => x.op === 'delete');
  check('apaga só o lançado à mão, pela referência, e some da lista', d && d.table === 'pagamentos' && d.filtros.join() === 'referencia=manual-pix-abc' && !h.mod.getPAGOS().some((g) => g.referencia === 'manual-pix-abc'));
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
