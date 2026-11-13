// Testa a lógica pura do Funil por próxima ação (admin/crm/funil.js) em Node, sem navegador e sem Supabase.
//
// Uso: cd admin/crm/db/testes && node funil.test.mjs
import { VISOES, COLUNAS, visaoDe, pontosDe, temperaturaDe, faltaDe, colunaDe, cartaoDe, quadroDe, indicadoresDe, passosDe } from '../../funil.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const AGORA = Date.parse('2026-11-13T12:00:00Z');
const ha = (dias) => new Date(AGORA - dias * 864e5).toISOString();
const lead = (extra = {}) => Object.assign({ id: 'c1', nome: 'Ana', persona: 'campus_france', estagio: 'lead', dias: 1, aceita_novidades: true,
  email_status: null, email_enviado_em: null, segmento: null, user_id: null, capturas: 1, dias_para_prazo: null }, extra);
const ctx = (extra = {}) => Object.assign({ agora: AGORA, assinatura: null, comprou: false }, extra);
const ctxDe = () => ctx();

console.log('== Pontos e temperatura ==');
{
  const q = pontosDe(lead({ email_status: 'clicado', dias_para_prazo: 40 }));
  check('clique + prazo de 40 dias = 5 pontos', q.total === 5);
  check('5 pontos = quente', temperaturaDe(q.total) === 'q');
  check('cada linha tem rótulo e delta', q.linhas.length === 2 && q.linhas.every((l) => l.length === 2 && /^[+−]/.test(l[1])));
  check('abertura sozinha = 1 ponto, fria', pontosDe(lead({ email_status: 'aberto' })).total === 1 && temperaturaDe(1) === 'f');
  check('clique pesa mais que abertura', pontosDe(lead({ email_status: 'clicado' })).total > pontosDe(lead({ email_status: 'aberto' })).total);
  check('parada há 40 dias perde 3', pontosDe(lead({ dias: 40 })).total === -3);
  check('prazo de 90 dias não pontua', pontosDe(lead({ dias_para_prazo: 90 })).total === 0);
  check('prazo vencido não pontua', pontosDe(lead({ dias_para_prazo: -5 })).total === 0);
  check('2 a 4 = morna', temperaturaDe(2) === 'm' && temperaturaDe(4) === 'm');
}

console.log('== Visão ==');
{
  check('sem conta = leads', visaoDe(lead(), ctx()) === 'leads');
  check('com conta = app', visaoDe(lead({ user_id: 'u1' }), ctx()) === 'app');
  check('assinatura ativa = clientes', visaoDe(lead({ user_id: 'u1' }), ctx({ assinatura: { status: 'active' } })) === 'clientes');
  check('em teste grátis = clientes', visaoDe(lead({ user_id: 'u1' }), ctx({ assinatura: { status: 'trialing' } })) === 'clientes');
  check('cancelada não é cliente', visaoDe(lead({ user_id: 'u1' }), ctx({ assinatura: { status: 'canceled' } })) === 'app');
  check('compra registrada = clientes', visaoDe(lead(), ctx({ comprou: true })) === 'clientes');
  check('sem assinaturas (tabela ausente) não quebra', visaoDe(lead(), { agora: AGORA }) === 'leads');
}

console.log('== Coluna ==');
{
  check('resposta aberta vence 1:1 marcado', colunaDe(lead({ resposta_aberta_id: 7, um_a_um_quando: ha(-2) }), 'leads', ctx()) === 'responder');
  check('pergunta aberta = responder', colunaDe(lead({ pergunta_aberta_id: 3 }), 'leads', ctx()) === 'responder');
  check('1:1 marcado', colunaDe(lead({ um_a_um_quando: ha(-2) }), 'leads', ctx()) === 'um_a_um');
  check('sem nenhum e-mail enviado = próximo (primeiro contato)', colunaDe(lead(), 'leads', ctx()) === 'proximo');
  check('e-mail de ontem = esperar', colunaDe(lead({ email_status: 'entregue', email_enviado_em: ha(1) }), 'leads', ctx()) === 'esperar');
  check('e-mail de 4 dias = próximo', colunaDe(lead({ email_status: 'entregue', email_enviado_em: ha(4), segmento: 'naoabriu' }), 'leads', ctx()) === 'proximo');
  check('não entregue nunca espera', colunaDe(lead({ email_status: 'nao_entregue', email_enviado_em: ha(1) }), 'leads', ctx()) === 'proximo');
  check('mais de 30 dias = parados', colunaDe(lead({ dias: 45 }), 'leads', ctx()) === 'parados');
  check('quente sem resposta = pronto para o 1:1', colunaDe(lead({ email_status: 'clicado', dias_para_prazo: 20, email_enviado_em: ha(5) }), 'leads', ctx()) === 'pronto');
  check('app parado há 9 dias = parou', colunaDe(lead({ user_id: 'u', estagio: 'ativado', dias: 9 }), 'app', ctx()) === 'parou');
  check('app com 2 dias = usando', colunaDe(lead({ user_id: 'u', estagio: 'em_uso', dias: 2 }), 'app', ctx()) === 'usando');
  const cli = lead({ user_id: 'u', dias: 2 });
  check('cliente com pagamento falho = atenção', colunaDe(cli, 'clientes', ctx({ assinatura: { status: 'past_due' } })) === 'atencao');
  check('cliente que cancela no fim = atenção', colunaDe(cli, 'clientes', ctx({ assinatura: { status: 'active', cancela_no_fim: true } })) === 'atencao');
  check('cliente renovando em 10 dias = atenção', colunaDe(cli, 'clientes', ctx({ assinatura: { status: 'active', periodo_fim: ha(-10) } })) === 'atencao');
  check('cliente renovando em 60 dias = em dia', colunaDe(cli, 'clientes', ctx({ assinatura: { status: 'active', periodo_fim: ha(-60) } })) === 'emdia');
  check('toda coluna devolvida existe na visão', ['leads', 'app', 'clientes'].every((v) => COLUNAS[v].every((c) => c.k && c.t && c.d)));
  check('três visões', VISOES.length === 3);
}

console.log('== O que travou ==');
{
  check('naoabriu = gatilho', faltaDe(lead({ segmento: 'naoabriu' })) === 'gatilho');
  check('naoclicou = motivação', faltaDe(lead({ segmento: 'naoclicou' })) === 'motivacao');
  check('cliquenaoapp = facilidade', faltaDe(lead({ segmento: 'cliquenaoapp' })) === 'facilidade');
  check('não entregue = entrega', faltaDe(lead({ email_status: 'nao_entregue' })) === 'entrega');
  check('sem segmento = nada', faltaDe(lead()) === null);
}

console.log('== Cartão e botão ==');
{
  const k = cartaoDe(lead({ email_status: 'entregue', email_enviado_em: ha(5), segmento: 'naoabriu' }), ctx());
  check('cartão de e-mail: botão de e-mail habilitado', k.botao.acao === 'email' && !k.botao.desabilitado && k.botao.rotulo === 'Escrever e-mail');
  const sem = cartaoDe(lead({ aceita_novidades: false }), ctx());
  check('sem aceite: botão de e-mail desabilitado com aviso', sem.botao.acao === 'email' && sem.botao.desabilitado && /novidades/.test(sem.botao.aviso));
  const r = cartaoDe(lead({ resposta_aberta_id: 1, aceita_novidades: false }), ctx());
  check('responder abre a conversa mesmo sem aceite', r.botao.acao === 'conversa' && !r.botao.desabilitado);
  check('1:1 marcado abre a ficha', cartaoDe(lead({ um_a_um_quando: ha(-1) }), ctx()).botao.acao === 'ficha');
  check('motivo de primeiro contato', /primeiro contato/.test(cartaoDe(lead(), ctx()).motivo));
  check('prazo curto aparece no cartão', cartaoDe(lead({ dias_para_prazo: 12 }), ctx()).prazo === 12);
  check('prazo longo não aparece', cartaoDe(lead({ dias_para_prazo: 200 }), ctx()).prazo === null);
}

console.log('== Quadro, painel e passos ==');
{
  const lista = [
    lead({ id: 'a', email_status: 'clicado', dias_para_prazo: 50, email_enviado_em: ha(5) }),
    lead({ id: 'b', email_status: 'clicado', dias_para_prazo: 10, email_enviado_em: ha(5) }),
    lead({ id: 'c', email_status: 'entregue', email_enviado_em: ha(1) }),
    lead({ id: 'd', user_id: 'u', estagio: 'em_uso', dias: 2 })
  ];
  const q = quadroDe(lista, ctxDe, 'leads');
  check('quadro tem as colunas de leads', q.length === COLUNAS.leads.length);
  const pronto = q.find((c) => c.k === 'pronto').cartoes.map((x) => x.id);
  check('mesmos pontos: prazo mais curto primeiro', pronto[0] === 'b' && pronto[1] === 'a');
  check('contato com conta fica fora de leads', !q.some((c) => c.cartoes.some((x) => x.id === 'd')));
  check('esperar recebe o e-mail de ontem', q.find((c) => c.k === 'esperar').cartoes[0].id === 'c');
  const ind = indicadoresDe(lista, ctxDe);
  check('6 indicadores', ind.length === 6);
  check('cliques: 2 de 3 com e-mail = 67%', ind[0].valor === '67%' && /2 de 3/.test(ind[0].n));
  const ps = passosDe(lista, ctxDe);
  check('7 passos', ps.passos.length === 7 && ps.passos[1].n === 2);
  check('perda é índice válido ou -1', ps.perda === -1 || (ps.perda >= 2 && ps.perda < 7));
  const vazio = indicadoresDe([], ctxDe), pv = passosDe([], ctxDe);
  check('lista vazia: indicadores sem divisão por zero', vazio.length === 6 && vazio[0].valor === '—' && vazio[1].valor === '—' && !vazio[0].alerta);
  check('lista vazia: passos zerados e sem perda', pv.passos.every((p) => p.n === 0) && pv.perda === -1 && pv.passos[1].pct === null);
  check('quadro de lista vazia tem colunas sem cartões', quadroDe([], ctxDe, 'clientes').every((c) => c.cartoes.length === 0));
}

console.log(failed ? `\n${failed} falhou, ${passed} passou` : `\nOK: ${passed} verificações`);
process.exit(failed ? 1 : 0);
