// Testa o CRM retrabalhado ligado ao crm.js real, em Node, com navegador e Supabase de mentira: receita estimada, indicadores da Hoje,
// abas da Hoje, Potencial nos Contatos e Panorama dela. NÃO testa nada em navegador real. Dados inventados (o repositório é público).
//
// Uso: cd admin/crm/db/testes && node crm-retrabalho-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const ha = (d) => new Date(Date.now() - d * 864e5).toISOString();
const semLixo = (t) => !/NaN|undefined|null/.test(String(t));

console.log('== Receita estimada ==');
{
  const h = await carregarCrm({ respostas: {} });
  const r = h.mod.receitaEstimada(new Date(Date.now() - 30 * 864e5), new Date());
  check('dados vazios: total 0, sem compras nem mensalidades', r.total === 0 && r.compras === 0 && r.mensalidades === 0);
  h.mod.setC([]); h.mod.renderKpis();
  check('KPIs vazios: € 0 e nenhum NaN/undefined', h.el('k-rev').textContent === '€ 0' && ['k-leads', 'k-um', 'k-plat', 'k-rev', 'k-leads-sub', 'k-um-sub', 'k-plat-sub', 'k-rev-sub'].every((k) => semLixo(h.el(k).textContent)));

  h.mod.setPRODUTOS([{ slug: 'guia-x', nome: 'Guia X', preco: 14.9 }]);
  h.mod.setCOMPRAS_EV([{ produto: 'guia-x', em: ha(3) }, { produto: 'guia-x', em: ha(200) }, { produto: 'sem-preco', em: ha(1) }]);
  h.mod.setPRECOS([{ chave: 'plano_a', valor: 70, moeda: 'EUR', mensal: true }]);
  h.mod.setASSIN({ c1: { contato_id: 'c1', status: 'active', plano: 'plano_a', criado_em: ha(75), teste_fim: null, periodo_fim: new Date(Date.now() + 10 * 864e5).toISOString() },
    c2: { contato_id: 'c2', status: 'canceled', plano: 'plano_a', criado_em: ha(75) },
    c3: { contato_id: 'c3', status: 'active', plano: 'plano_a', criado_em: 'lixo' },
    c4: { contato_id: 'c4', status: 'active', plano: 'inexistente_sem_preco', criado_em: ha(40) } });
  const r2 = h.mod.receitaEstimada(new Date(Date.now() - 30 * 864e5), new Date(Date.now() + 864e5));
  check('uma compra dentro do período, a de 200 dias e a sem preço ficam de fora', r2.compras === 1);
  check('só assinatura ativa e com data válida gera mensalidade (c1 e c4 com plano único)', r2.mensalidades >= 1 && Number.isFinite(r2.total));
  check('total = compra + mensalidades × 70', Math.abs(r2.total - (14.9 + r2.mensalidades * 70)) < 0.001);
  h.mod.renderKpis();
  check('KPI de revenue mostra o valor em euros', /^€ /.test(h.el('k-rev').textContent) && semLixo(h.el('k-rev').textContent));
}

console.log('== Indicadores da Hoje e período ==');
{
  const h = await carregarCrm({ respostas: {} });
  h.mod.setC([pessoa({ id: 'a', criado_em: ha(2) }), pessoa({ id: 'b', criado_em: ha(20) }), pessoa({ id: 'c', criado_em: ha(100), user_id: 'u1', ultimo_evento_em: ha(1) })]);
  h.mod.setUM([{ id: 1, contato_id: 'a', quando: null, status: 'agendado', criado_em: ha(1) }, { id: 2, contato_id: 'b', quando: null, status: 'cancelado', criado_em: ha(1) }]);
  h.mod.renderKpis();
  check('7 dias: 1 lead novo, 1 1:1 marcado (o cancelado não conta), 1 pessoa na plataforma', h.el('k-leads').textContent === 1 && h.el('k-um').textContent === 1 && h.el('k-plat').textContent === 1);
  h.mod.state.kper = 30; h.mod.renderKpis();
  check('30 dias recalcula: 2 leads novos', h.el('k-leads').textContent === 2 && h.el('k-per').value === '30');
  check('o texto de comparação cita o período', h.el('k-leads-sub').textContent.includes('30 dias'));
  h.mod.state.kper = 7; h.mod.setC([]); h.mod.renderKpis();
  check('sem dados anteriores o delta é +0, sem inventar número', h.el('k-leads').textContent === 0 && h.el('k-leads-sub').textContent.startsWith('+0'));
}

console.log('== Abas da Hoje ==');
{
  const h = await carregarCrm({ respostas: {} });
  h.mod.setC([pessoa({ id: 'a' })]);
  h.mod.renderHojeResumo();
  const abas = h.el('hj-abas').innerHTML;
  check('as abas aparecem, com Resumo selecionada', abas.includes('data-hojeaba="resumo"') && /data-hojeaba="resumo"[^>]*aria-selected="true"/.test(abas) && abas.includes('data-hojeaba="agenda"'));
  check('o resumo traz cartões', h.el('hj-resumo').innerHTML.includes('hj-card'));
  await h.click({ hojeaba: 'agenda' });
  check('clicar numa aba a seleciona e lembra a escolha', h.mod.state.hojeAba === 'agenda' && /data-hojeaba="agenda"[^>]*aria-selected="true"/.test(h.el('hj-abas').innerHTML) && h.store.crm_hoje_aba === 'agenda');
  check('a aba antiga deixa de estar selecionada', /data-hojeaba="resumo"[^>]*aria-selected="false"/.test(h.el('hj-abas').innerHTML));
  h.mod.hojeIrAba('nao-existe'); h.mod.renderHojeResumo();
  check('aba desconhecida cai no Resumo', /data-hojeaba="resumo"[^>]*aria-selected="true"/.test(h.el('hj-abas').innerHTML));
}

console.log('== Potencial nos Contatos ==');
{
  const h = await carregarCrm({ respostas: {} });
  const quente = pessoa({ id: 'q', nome: 'Quente Teste', resposta_aberta_id: 7, email_status: 'clicado', dias: 1, urgencia: 'baixa', persona: 'campus_france' });
  const frio = pessoa({ id: 'f', nome: 'Frio Teste', email_status: 'entregue', dias: 40, urgencia: 'alta', persona: 'campus_france' });
  h.mod.setC([frio, quente]);
  h.mod.state.potOrd = '';
  h.mod.renderContacts();
  let t = h.el('tbody').innerHTML;
  check('a coluna mostra o Potencial de cada pessoa', (t.match(/class="pill pot-/g) || []).length === 2 && t.includes('Alto') && t.includes('Baixo'));
  check('sem ordenar, a ordem padrão (por urgência) é mantida: Frio, que é mais urgente, antes de Quente', t.indexOf('Frio Teste') < t.indexOf('Quente Teste'));
  await h.click({ potsort: '1' });
  t = h.el('tbody').innerHTML;
  check('1º clique em Potencial ordena do maior para o menor', t.indexOf('Quente Teste') < t.indexOf('Frio Teste') && h.el('th-pot').textContent === 'Potencial ↓');
  await h.click({ potsort: '1' });
  t = h.el('tbody').innerHTML;
  check('2º clique ordena do menor para o maior', t.indexOf('Frio Teste') < t.indexOf('Quente Teste') && h.el('th-pot').textContent === 'Potencial ↑');
  await h.click({ potsort: '1' });
  check('3º clique volta à ordem original', h.mod.state.potOrd === '' && h.el('th-pot').textContent === 'Potencial');
  const p = h.mod.potDe(quente);
  check('Potencial é inteiro entre 0 e 100 e a dica traz os motivos', Number.isInteger(p.nota) && p.nota >= 0 && p.nota <= 100 && t.includes('title="Alto'));
  h.mod.setC([pessoa({ id: 'x', nome: '<img src=x onerror=alert(1)>' })]); h.mod.renderContacts();
  check('nome com HTML continua escapado na lista', !h.el('tbody').innerHTML.includes('<img') && h.el('tbody').innerHTML.includes('&lt;img'));
  h.mod.setC([]); h.mod.renderContacts();
  check('lista vazia não quebra', h.el('tbody').innerHTML === '' && h.el('empty').hidden === false);
}

console.log('== Panorama dela ==');
{
  const itens = [{ step_key: 'a', category: 'escola', label: 'Escolher escola', titulo_custom: 'Escolher escola com parcelamento', nota_custom: 'falar com ana@exemplo.fr', quando_custom: '2026-11-20T09:30', updated_at: ha(2) }];
  const monta = async (coorte) => {
    const h = await carregarCrm({ respostas: {} });
    const c = pessoa({ id: 'p1', user_id: 'u1', persona: 'campus_france' });
    h.mod.setC([c]); h.mod.state.sel = 'p1';
    h.mod.state.dos = { cid: 'p1', chk: { itens }, d: {}, rasc: {} };
    h.mod.state.fx.coorte = { persona: h.mod.personaKey(c), v: coorte, carregando: false };
    return { h, c };
  };
  let { h, c } = await monta({ n: 2, kw: [], pad: { arq: 0, ren: 0, data: 0, prop: 0 } });
  let html = h.mod.fxSinaisCorpo(c);
  check('coorte com 2 pessoas: "Poucos dados para comparar", sem número do grupo', html.includes('Poucos dados para comparar') && !html.includes('No grupo ('));
  check('e-mail da nota não aparece (limpa oculta antes de mostrar)', !html.includes('ana@exemplo.fr'));
  check('o painel não traz NaN nem undefined', semLixo(html));
  ({ h, c } = await monta({ n: 3, kw: [['parcelamento', 2]], pad: { arq: 1, ren: 2, data: 1, prop: 0 } }));
  html = h.mod.fxSinaisCorpo(c);
  check('coorte com 3 pessoas: compara com o grupo', html.includes('No grupo (3 pessoas na plataforma)'));
  ({ h, c } = await monta(null));
  html = h.mod.fxSinaisCorpo(c);
  check('sem coorte carregada: não inventa comparação', html.includes('Poucos dados para comparar') || html.includes('Carregando o grupo'));
  const sem = await carregarCrm({ respostas: {} });
  const c2 = pessoa({ id: 'p2', user_id: null }); sem.mod.setC([c2]); sem.mod.state.sel = 'p2';
  sem.mod.state.dos = { cid: 'p2', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  check('quem não tem conta: texto de "ainda não entrou no app"', sem.mod.fxSinaisCorpo(c2).includes('ainda não entrou no app'));
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
