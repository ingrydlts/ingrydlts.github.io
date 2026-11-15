// Testa a fila "Por onde começar" da Hoje (categorias, ordem, prazo vencido por último) e a receita estimada dos indicadores,
// rodando o crm.js de verdade em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual).
//
// Uso: cd admin/crm/db/testes && node crm-fila-hoje-ui.test.mjs
import * as TXMOD from '../../taxonomia.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null, body: { contains: () => true } };
const writes = [], rpcs = [];
let respostas = {}, rpcRetorno = { data: 2, error: null };
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
    single: async () => ({ data: { id: 77, persona: writes[writes.length - 1].row.persona }, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert: (row) => { writes.push({ op: 'insert', table, row }); return b; },
    update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async (n, a) => { rpcs.push({ n, a }); return rpcRetorno; }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'TX', 'EE', 'EQ', 'JR', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, setQ: function (v) { Q = v; }, setR: function (v) { R = v; }, setP: function (v) { P = v; }, setPSUG: function (v) { PSUG = v; }, setFin: function (o) { PRODUTOS = o.produtos; COMPRAS_EV = o.compras; ASSIN = o.assin; PRECOS = o.precos; }, itensDeHoje, ordenaFila, catDoContato, renderFila, receitaEstimada, pistasDaJornada, rascunhoMultiFunil, funisDaPessoa, fxResumoCartoes, setUM: function (v) { UM = v; }, setPAG: function (v) { PAG1A1 = v; } };')(
  supabase, {}, TXMOD, { iniciar() {}, depois() {}, campoMudou() {} }, {}, {}, document, { addEventListener() {}, confirm: () => true, scrollTo() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
const pessoa = (id, nome, extra = {}) => Object.assign({ id, email: id + '@example.com', nome, persona: 'campus_france', estagio: 'lead', urgencia: 'baixa', criado_em: dia(-30), ultimo_evento_em: dia(-5), dias_para_prazo: null }, extra);

console.log('== Categorias ==');
check('prazo à frente', mod.catDoContato({ motivo: 'prazo do VLS-TS vence em 6 dias (21/11/2026)' }) === 'prazo');
check('prazo vencido', mod.catDoContato({ motivo: 'prazo do VLS-TS venceu há 9 dias (06/11/2026)' }) === 'vencido');
check('voltou a deixar o e-mail', mod.catDoContato({ motivo: 'voltou a deixar o e-mail em 12/11 (bot)' }) === 'voltou');
check('parada', mod.catDoContato({ motivo: 'parada há 9 dias' }) === 'paradas');
check('resposta já entra pela caixa de entrada (fora da lista de contatos)', mod.catDoContato({ motivo: 'respondeu o seu e-mail em 15/11' }) === null && mod.catDoContato({ motivo: 'escreveu na página da conversa em 15/11' }) === null);
check('o resto é urgência marcada', mod.catDoContato({ motivo: 'marcou urgência no funil' }) === 'urgencia');

console.log('== Itens e ordem ==');
const A = pessoa('a', 'Ana', { motivo: 'prazo do VLS-TS vence em 20 dias (05/12/2026)', dias_para_prazo: 20, urgencia: 'alta', ultimo_evento_em: dia(-2) });
const B = pessoa('b', 'Bia', { motivo: 'prazo do VLS-TS vence em 3 dias (18/11/2026)', dias_para_prazo: 3, urgencia: 'alta', ultimo_evento_em: dia(-9) });
const V = pessoa('v', 'Vera', { motivo: 'prazo do VLS-TS venceu há 9 dias (06/11/2026)', dias_para_prazo: -9, urgencia: 'alta', ultimo_evento_em: dia(-40) });
const N = pessoa('n', 'Nina', { motivo: 'parada há 12 dias', ultimo_evento_em: dia(-12) });
const R1 = pessoa('r', 'Rita', { motivo: 'respondeu o seu e-mail em 15/11' });
const Z = pessoa('z', 'Zeca', { motivo: 'voltou a deixar o e-mail em 12/11 (bot)', ultima_captura_em: dia(-3) });
const F = pessoa('f', 'Fim', { motivo: 'parada há 30 dias', estagio: 'concluido' });
mod.setC([A, B, V, N, R1, Z, F]);
mod.setQ([{ id: 1, contato_id: 'a', texto: 'Posso trocar de visto?', status: 'nova', criado_em: dia(-4) }, { id: 2, contato_id: 'b', texto: 'Já respondida', status: 'respondida', criado_em: dia(-6) }]);
mod.setR([{ id: 5, contato_id: 'r', texto: 'Oi!', status: 'nova', recebido_em: dia(-1), canal: 'email' }]);
mod.setP([{ id: 9, status: 'novo', categoria: 'outro', texto: 'Botão travado', criado_em: dia(-7) }, { id: 10, status: 'resolvido', categoria: 'outro', texto: 'x', criado_em: dia(-8) }]);
mod.setPSUG([]);
const itens = mod.itensDeHoje();
const cats = (l) => l.map((i) => i.cat + ':' + (i.c ? i.c.id : i.x.id)).join(',');
check('conta só o que espera: 1 pergunta nova, 1 resposta nova, 1 problema novo e 5 contatos (sem a Rita, sem o concluído)', itens.length === 8 && itens.filter((i) => i.k === 'c').length === 5 && !itens.some((i) => i.c && (i.c.id === 'r' || i.c.id === 'f')));
const antigos = mod.ordenaFila(itens, 'antigos');
check('mais antigos primeiro (o problema de 7 dias é o mais velho dos que não estão vencidos? não: a Nina, de 12 dias)', antigos[0].c && antigos[0].c.id === 'n' || antigos[0].desde <= antigos[1].desde);
check('quem já venceu fica sempre por último', antigos[antigos.length - 1].c.id === 'v');
const porPrazo = mod.ordenaFila(itens, 'prazo');
check('por prazo: o prazo mais próximo à frente (Bia, 3 dias; depois Ana, 20 dias)', porPrazo[0].c.id === 'b' && porPrazo[1].c.id === 'a');
check('por prazo: depois do prazo vêm os sem prazo, do mais antigo ao mais novo, e a Vera por último', porPrazo[porPrazo.length - 1].c.id === 'v' && porPrazo.slice(2, -1).every((i, k, l) => k === 0 || l[k - 1].desde <= i.desde));
check('cada contato entra uma vez só', new Set(itens.filter((i) => i.k === 'c').map((i) => i.c.id)).size === 5);

console.log('== Fila na tela ==');
mod.state.hCat = 'tudo'; mod.state.hOrd = 'antigos'; mod.renderFila();
const sel = el('h-cat').innerHTML;
check('o dropdown mostra a contagem de cada tipo', /Tudo que precisa de mim \(8\)/.test(sel) && /Responder: caixa de entrada \(2\)/.test(sel) && /Prazos chegando \(2\)/.test(sel) && /Prazo já vencido \(por último\) \(1\)/.test(sel) && /Problemas do app \(1\)/.test(sel));
check('não oferece tipo vazio', !/Processos para revisar/.test(sel));
check('o resumo diz quantos itens e há quanto tempo o mais antigo espera', /8 itens · o mais antigo espera há/.test(el('h-resumo').textContent));
mod.state.hCat = 'responder'; mod.renderFila();
check('"Responder" lista a pergunta e a resposta por e-mail', /data-openq="1"/.test(el('attention').innerHTML) && /data-openr="5"/.test(el('attention').innerHTML) && !/data-open="/.test(el('attention').innerHTML));
mod.state.hCat = 'tudo'; mod.state.hMais = false;
mod.setC(Array.from({ length: 12 }, (_, i) => pessoa('p' + i, 'P' + i, { motivo: 'parada há ' + (10 + i) + ' dias', ultimo_evento_em: dia(-10 - i) })));
mod.setQ([]); mod.setR([]); mod.setP([]);
mod.renderFila();
check('mostra 8 e oferece "Ver mais 4"', (el('attention').innerHTML.match(/class="row"/g) || []).length === 8 && /Ver mais 4/.test(el('attention').innerHTML));

console.log('== Receita estimada dos indicadores ==');
mod.setFin({ produtos: [{ slug: 'hub', nome: 'Hub', preco: 14.9 }], compras: [{ produto: 'hub', em: dia(-3) }, { produto: 'hub', em: dia(-40) }, { produto: 'outro', em: dia(-0.5) }],
  assin: { a: { status: 'active', plano: 'x', criado_em: dia(-50), teste_fim: dia(-33), periodo_fim: dia(25), cancela_no_fim: false }, b: { status: 'trialing', criado_em: dia(-2), teste_fim: dia(5) }, c: { status: 'canceled', criado_em: dia(-60), teste_fim: null } },
  precos: [{ chave: 'plataforma_mensal_eur', valor: 70, moeda: 'EUR', mensal: true }] });
const r30 = mod.receitaEstimada(new Date(Date.now() - 30 * 864e5), new Date(Date.now() + 1000));
check('30 dias: 1 compra do Hub (14,90) + 1 mensalidade (a 1ª cobrança foi há 33 dias, a 2ª há 2 ou 3, conforme o mês)', r30.compras === 1 && r30.mensalidades === 1 && Math.abs(r30.total - 84.9) < 0.001);
const r90 = mod.receitaEstimada(new Date(Date.now() - 90 * 864e5), new Date(Date.now() + 1000));
check('90 dias: 2 compras e 2 mensalidades; teste grátis e assinatura cancelada não entram', r90.compras === 2 && r90.mensalidades === 2 && Math.abs(r90.total - (29.8 + 140)) < 0.001);
const r0 = mod.receitaEstimada(new Date(Date.now() - 1 * 864e5), new Date(Date.now() + 1000));
check('produto desconhecido não soma', r0.total === 0);

console.log('== Jornada e pistas ==');
const mkJ = (ent, quiz) => ({ entradas: ent, quizzes: quiz || [], ativouEm: null, appVezes: 0, artigos: 0 });
const E1 = { em: dia(-9), origem: 'guia-etudes-en-france-2027' }, E2 = { em: dia(-2), origem: 'guia-tecnologo' };
const Nat = pessoa('nat', 'Natália Reis', { capturas: 2, origens: ['guia-etudes-en-france-2027', 'guia-tecnologo'], user_id: null });
const J2 = mkJ([E1, E2], [{ em: E1.em, persona: 'campus_france', objetivo: 'cf-escolhendo' }, { em: E2.em, persona: 'pvt', objetivo: 'tec-nao-sei' }]);
let pj = mod.pistasDaJornada(Nat, J2, [], []);
check('dois funis: reconhece que ela compara caminhos e lista os dois em ordem', pj.multi && pj.funis.join() === 'guia-etudes-en-france-2027,guia-tecnologo' && /2 materiais diferentes/.test(pj.pistas[0]));
check('a pista do intervalo e a da mudança de persona aparecem', pj.pistas.some((x) => /7 dias depois da primeira/.test(x)) && pj.pistas.some((x) => /pessoas diferentes/.test(x)));
check('sem e-mail do CRM e sem conta: as duas pistas finais', pj.pistas.some((x) => /primeiro contato é seu/.test(x)) && pj.pistas.some((x) => /Ainda não tem conta/.test(x)));
const um = pessoa('um', 'Uma', { capturas: 1, origens: ['guia-vls-ts'] });
pj = mod.pistasDaJornada(um, mkJ([{ em: dia(-3), origem: 'guia-vls-ts' }]), [], []);
check('um funil só: não diz que compara caminhos', !pj.multi && !pj.pistas.some((x) => /materiais diferentes/.test(x)));
pj = mod.pistasDaJornada(pessoa('rep', 'Rep', { capturas: 3, origens: ['guia-vls-ts'] }), mkJ([{ em: dia(-9), origem: 'guia-vls-ts' }, { em: dia(-1), origem: 'guia-vls-ts' }]), [], []);
check('o mesmo material 3 vezes: pergunta o que faltou', /mesmo material 3 vezes/.test(pj.pistas[0]));
pj = mod.pistasDaJornada(Nat, J2, [{ id: 1, status: 'entregue', enviado_em: dia(-1) }], []);
check('e-mail recebido e não aberto', pj.pistas.some((x) => /não abriu nenhum/.test(x)));
pj = mod.pistasDaJornada(Nat, J2, [{ id: 1, status: 'clicado', clicado_em: dia(-1), aberto_em: dia(-1) }], []);
check('abriu, clicou e não respondeu: pede um convite concreto', pj.pistas.some((x) => /Abriu 1 e clicou em 1/.test(x) && /não respondeu/.test(x)));
const rasc = mod.rascunhoMultiFunil(Nat, mod.funisDaPessoa(Nat, J2), J2);
check('o e-mail personalizado cita os dois guias, pergunta qual está mais perto e convida para o 1:1', /Oi Natália!/.test(rasc) && /Campus France/.test(rasc) && /Tecnólogo/i.test(rasc) && /Qual dos dois/.test(rasc) && /conversa 20 minutos/.test(rasc));
check('com 1:1 já marcado, não convida de novo', !/conversa 20 minutos/.test(mod.rascunhoMultiFunil(Object.assign({}, Nat, { estagio: 'um_a_um' }), mod.funisDaPessoa(Nat, J2), J2)));

console.log('== Cabeçalho da ficha: o cartão do 1:1 ==');
{
  const J = pessoa('j', 'Julia'), em = (c) => mod.fxResumoCartoes(c, { mails: [], resps: [] })[0];
  mod.setUM([]); mod.setPAG([]);
  check('sem 1:1: traço e "nenhum marcado"', em(J).valor === '—' && /nenhum marcado/.test(em(J).sub));
  mod.setPAG([{ contato_id: 'j', minutos: 20, pago_em: dia(-5) }]);
  check('pagou e não tem dia: "Pago, sem data", em alerta, com os minutos', em(J).valor === 'Pago, sem data' && em(J).tom === 'alerta' && /20 min · pago em/.test(em(J).sub) && /falta marcar o dia/.test(em(J).sub));
  mod.setUM([{ id: 1, contato_id: 'j', quando: dia(2), status: 'agendado', criado_em: dia(-4) }]);
  check('marcado e pago: dia e hora no valor, minutos e pagamento no apoio, tom ok', /\d{2}\/\d{2} · \d{2}:\d{2}/.test(em(J).valor) && /20 min · pago em/.test(em(J).sub) && em(J).tom === 'ok');
  mod.setPAG([]);
  check('marcado e sem pagamento: avisa que não há pagamento registrado', /sem pagamento registrado/.test(em(J).sub) && em(J).tom === undefined);
  mod.setUM([{ id: 2, contato_id: 'j', quando: null, status: 'agendado', criado_em: dia(-1) }]);
  check('marcado sem dia: "a combinar" em alerta', em(J).valor === 'a combinar' && em(J).tom === 'alerta');
  const todos = mod.fxResumoCartoes(J, { mails: [], resps: [] });
  check('sem conta: 4 cartões (1:1, Dossiê, Prazo e E-mails), sem o da Plataforma', todos.map((k) => k.rotulo).join() === '1:1,Dossiê,Prazo,E-mails');
  const comConta = mod.fxResumoCartoes(Object.assign({}, J, { user_id: 'u-j' }), { mails: [], resps: [] });
  check('com conta: 5 cartões, com a Plataforma em segundo', comConta.map((k) => k.rotulo).join() === '1:1,Plataforma,Dossiê,Prazo,E-mails');
}

console.log('\n' + (failed ? failed + ' FALHARAM, ' : '') + passed + ' passaram' + (failed ? '' : ', 0 falharam'));
process.exit(failed ? 1 : 0);
