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
  src + '\n;return { state, setC: function (v) { C = v; }, setQ: function (v) { Q = v; }, setR: function (v) { R = v; }, setP: function (v) { P = v; }, setPSUG: function (v) { PSUG = v; }, setFin: function (o) { PRODUTOS = o.produtos; COMPRAS_EV = o.compras; ASSIN = o.assin; PRECOS = o.precos; }, itensDeHoje, ordenaFila, catDoContato, renderFila, receitaEstimada, pistasDaJornada, rascunhoMultiFunil, funisDaPessoa, fxResumoCartoes, setUM: function (v) { UM = v; }, setPAG: function (v) { PAG1A1 = v; }, dosDoFunil, dosCampo, dosProgresso, dosVisiveis, dosCruzamentos, dosFaltaPorCanal, dosMensagemTexto, insightsDaPlataforma, r1Codigo, r1Rotulo, r1Roteiro, r1Html, r1PainelHtml, ltItens, ltResumo, ltHtml, dosVisaoHtml };')(
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
  check('nunca fez e nada vindo: "Nenhum" e "ainda não fez 1:1"', em(J).valor === 'Nenhum' && /ainda não fez 1:1/.test(em(J).sub));
  mod.setPAG([{ contato_id: 'j', minutos: 20, pago_em: dia(-5) }]);
  check('pagou e não tem dia: "Pago, falta marcar", em alerta, com os minutos', em(J).valor === 'Pago, falta marcar' && em(J).tom === 'alerta' && /20 min · pago em/.test(em(J).sub));
  mod.setUM([{ id: 1, contato_id: 'j', quando: dia(2), status: 'agendado', criado_em: dia(-4) }]);
  check('vindo e pago: dia e hora no valor; minutos, pagamento e histórico no apoio; tom ok', /\d{2}\/\d{2} · \d{2}:\d{2}/.test(em(J).valor) && /20 min · pago em/.test(em(J).sub) && /nenhum feito ainda/.test(em(J).sub) && em(J).tom === 'ok');
  mod.setUM([{ id: 1, contato_id: 'j', quando: dia(2), status: 'agendado' }, { id: 2, contato_id: 'j', quando: dia(9), status: 'agendado' }, { id: 3, contato_id: 'j', quando: dia(-20), status: 'feito' }, { id: 4, contato_id: 'j', quando: dia(-40), status: 'agendado' }]);
  check('histórico: 2 já feitos (um marcado como feito e um que já passou) e mais 1 depois do próximo', /já fez 2/.test(em(J).sub) && /\+1 depois/.test(em(J).sub));
  mod.setPAG([]);
  check('vindo sem pagamento registrado: avisa', /sem pagamento registrado/.test(em(J).sub) && em(J).tom === undefined);
  mod.setUM([{ id: 5, contato_id: 'j', quando: dia(-20), status: 'feito' }]);
  check('só feitos: "Já fez 1" e nenhum vindo', em(J).valor === 'Já fez 1' && /nenhum vindo/.test(em(J).sub));
  mod.setUM([{ id: 6, contato_id: 'j', quando: null, status: 'agendado' }]);
  check('1:1 sem dia não conta como marcado: "Nenhum", com "convite aberto, sem dia"', em(J).valor === 'Nenhum' && /convite aberto, sem dia/.test(em(J).sub));
  mod.setUM([{ id: 7, contato_id: 'j', quando: dia(3), status: 'cancelado' }]);
  check('cancelado não conta', em(J).valor === 'Nenhum');
  const todos = mod.fxResumoCartoes(J, { mails: [], resps: [] });
  check('sem conta: 4 cartões (1:1, Dossiê, Prazo e E-mails), sem o da Plataforma', todos.map((k) => k.rotulo).join() === '1:1,Dossiê,Prazo,E-mails');
  const comConta = mod.fxResumoCartoes(Object.assign({}, J, { user_id: 'u-j' }), { mails: [], resps: [] });
  check('com conta: 5 cartões, com a Plataforma em segundo', comConta.map((k) => k.rotulo).join() === '1:1,Plataforma,Dossiê,Prazo,E-mails');
}

console.log('== Dossiê: as respostas das páginas de entrada ==');
{
  const ks = ['etapa_i01', 'etapa_i02', 'etapa_i03', 'etapa_i04', 'etapa_i05'];
  check('há um campo por página de entrada, sempre à mão', ks.every((k) => mod.dosCampo(k) && mod.dosCampo(k).t === 'op'));
  check('as opções são as etapas do quiz de cada página (Tecnólogo tem "Não sei o nível")', mod.dosCampo('etapa_i02').o.some((o) => o[0] === 'tec-nao-sei' && /Não sei o nível/.test(o[1])) && mod.dosCampo('etapa_i03').o.some((o) => o[0] === 'cf-escolhendo-curso'));
  const P = pessoa('d', 'Dani', { respostas: { objetivo: 'tec-nao-sei' } });
  mod.state.jorQuiz = null;
  check('sem eventos, a última resposta do cadastro preenche só a página dela', mod.dosDoFunil(P, 'etapa_i02') === 'tec-nao-sei' && mod.dosDoFunil(P, 'etapa_i03') === null && mod.dosDoFunil(P, 'etapa_i05') === null);
  mod.state.jorQuiz = { cid: 'd', quizzes: [{ em: dia(-9), objetivo: 'cf-escolhendo-curso' }, { em: dia(-2), objetivo: 'tec-nao-sei' }] };
  check('com os quizzes da jornada, cada página recebe a sua resposta (Campus France e Tecnólogo)', mod.dosDoFunil(P, 'etapa_i03') === 'cf-escolhendo-curso' && mod.dosDoFunil(P, 'etapa_i02') === 'tec-nao-sei');
  mod.state.jorQuiz = { cid: 'outro', quizzes: [{ em: dia(-9), objetivo: 'cf-escolhendo-curso' }] };
  check('quizzes de outra pessoa não vazam para esta', mod.dosDoFunil(P, 'etapa_i03') === null);
  mod.state.jorQuiz = { cid: 'd', quizzes: [{ em: dia(-2), objetivo: 'etapa-que-nao-existe' }] };
  check('resposta que o formulário não conhece é ignorada', mod.dosDoFunil(P, 'etapa_i03') === null);
  const antes = mod.dosProgresso(pessoa('e', 'Eva', { persona: 'campus_france' }), {}, {});
  check('o bloco novo não entra na conta do "faltam" (nem toda pessoa passou por todas as páginas)', mod.dosVisiveis(pessoa('e', 'Eva', { persona: 'campus_france' }), {}, {}).some((b) => b.t === 'Respostas das páginas de entrada' && b.livre) && antes.tot > 0 && antes.tot === mod.dosProgresso(pessoa('e', 'Eva', { persona: 'campus_france' }), { etapa_i02: 'tec-nao-sei' }, {}).tot);
}

console.log('== Dossiê: cruzamentos e o que falta ==');
{
  const C1 = pessoa('x', 'Xena', { persona: 'campus_france', user_id: null, respostas: { objetivo: 'tec-nao-sei', cfNivel: 'master' } });
  mod.state.jorQuiz = { cid: 'x', quizzes: [{ em: dia(-9), objetivo: 'cf-escolhendo-curso' }, { em: dia(-2), objetivo: 'tec-nao-sei' }] };
  mod.state.dos = { cid: 'x', d: { etapa_i02: 'tec-nao-sei', etapa_i03: 'cf-juntando-documentos', cidade: 'Lyon' }, rasc: {}, origem: { cidade: { origem: 'documento', valor: 'Lyon', confianca: 'alta' } }, onbEm: dia(-1) };
  const X = mod.dosCruzamentos(C1, mod.state.dos);
  check('confere: o que o funil disse e o dossiê tem igual (Tecnólogo)', X.confere.some((y) => /Tecnólogo/.test(y.l)));
  check('diverge: Campus France, o funil disse "Escolhendo o curso" e o dossiê diz "Juntando documentos"', X.diverge.length === 1 && /Études en France/.test(X.diverge[0].l) && /Escolhendo o curso/.test(X.diverge[0].funil) && /Juntando documentos/.test(X.diverge[0].dossie));
  check('só do funil: o nível da candidatura ainda não está no dossiê', X.soFunil.some((y) => /Nível da candidatura/.test(y.l)));
  check('da chamada: a cidade lida do documento, com a confiança', X.daChamada.length === 1 && /Cidade/.test(X.daChamada[0].l) && X.daChamada[0].conf === 'alta' && /documento/i.test(X.daChamada[0].origem));
  const F = mod.dosFaltaPorCanal(C1, mod.state.dos);
  check('lead sem conta: o que falta vai para conversa (e documentos), nada vai para "ela completa no app"', F.conversa.length > 0 && F.app.length === 0 && F.doc.some((f) => f.k === 'numero_secu') && !F.conversa.some((f) => f.k === 'cidade'));
  const F2 = mod.dosFaltaPorCanal(Object.assign({}, C1, { user_id: 'u-x' }), mod.state.dos);
  check('com conta: moradia, conta bancária e sécu passam para "ela completa no app"', F2.app.some((f) => f.k === 'moradia_resolvida') && F2.app.some((f) => f.k === 'conta_resolvida') && !F2.conversa.some((f) => f.k === 'moradia_resolvida'));
  check('o bloco das páginas de entrada não entra no "falta" (é livre)', !F.conversa.concat(F.app, F.doc).some((f) => /^etapa_i/.test(f.k)));
  const m1 = mod.dosMensagemTexto(C1, F.conversa, false), m2 = mod.dosMensagemTexto(C1, F.doc, true);
  check('a mensagem de perguntas: saudação, até 5 itens com ?, e pede para responder', /^Oi Xena!/.test(m1) && (m1.match(/^• /gm) || []).length <= 5 && /\?/.test(m1) && /responder por aqui/.test(m1));
  check('a mensagem de documentos é um lembrete do Drive e do check no app (não pede envio), sem "?" nos itens', /Drive/.test(m2) && /link fechado/.test(m2) && !/pode me enviar/.test(m2) && !/^• .*\?$/m.test(m2));
  mod.state.dos = null;
  const vazio = mod.dosCruzamentos(C1, null), fv = mod.dosFaltaPorCanal(C1, null);
  check('sem o dossiê carregado, não quebra e não inventa', vazio.confere.length === 0 && fv.conversa.length === 0);
}

console.log('== Plataforma: insights ==');
{
  const A = pessoa('a', 'Ana', { user_id: 'u-a', ultimo_evento_em: dia(-10) });
  const itens = [{ status: 'concluido', label: 'Passaporte', due_date: '2026-01-01' }, { status: 'pendente', label: 'Moradia', due_date: '2020-01-01' }, { status: 'pendente', label: 'Banco', due_date: '2099-01-01' }];
  const I = mod.insightsDaPlataforma(A, { agora: Date.now(), cliques: [{ sessao: 's1', tela: 'checklist', alvo: 'tela', criado_em: dia(-20) }, { sessao: 's2', tela: 'checklist', alvo: 'tela', criado_em: dia(-1) }], chk: { itens }, chatNaoLidas: 2, dosFalta: 5, umEm: dia(-5), notasVivas: 1 });
  const txt = I.map((i) => i.t).join(' | ');
  check('parada há 10 dias: atenção com ação no chat', I.some((i) => i.tom === 'alerta' && /Parada há 10 dias/.test(i.t) && i.acao === 'chat'));
  check('depois do 1:1 abriu o app em 1 sessão: bom sinal (a sessão de antes do 1:1 não conta)', I.some((i) => i.tom === 'ok' && /Depois do 1:1 de \d{2}\/\d{2}, abriu o app em 1 sessão/.test(i.t)));
  const I2 = mod.insightsDaPlataforma(A, { agora: Date.now(), cliques: [{ sessao: 's1', tela: 'checklist', alvo: 'tela', criado_em: dia(-20) }], chk: null, chatNaoLidas: 0, dosFalta: 0, umEm: dia(-5), notasVivas: 0 });
  check('depois do 1:1 sem abrir o app: atenção com ação no chat', I2.some((i) => i.tom === 'alerta' && /ainda não abriu o app/.test(i.t) && i.acao === 'chat'));
  check('checklist: 1 de 3 concluídos, 1 atrasado e o próximo prazo', /1 de 3 concluídos/.test(txt) && /1 item atrasado: Moradia/.test(txt) && /Próximo prazo/.test(txt));
  check('2 mensagens sem ler, dossiê em aberto e nota da iAssistente', /2 mensagens dela no chat sem ler/.test(txt) && /dossiê ainda tem 5 respostas/.test(txt) && /1 nota da iAssistente/.test(txt));
  const ok = mod.insightsDaPlataforma(pessoa('b', 'Bia', { user_id: 'u-b', ultimo_evento_em: dia(0) }), { agora: Date.now(), cliques: [], chk: null, chatNaoLidas: 0, dosFalta: 0, umEm: null, notasVivas: 0 });
  check('ativa hoje e sem pendências: só bom sinal, sem ação', ok.length === 1 && ok[0].tom === 'ok' && !ok[0].acao);
}

console.log('== Registro dos 1:1 ==');
{
  const P5 = pessoa('p5', 'Lia', { origem: 'guia-checklist-chegada-au-pair', ultima_origem: 'guia-checklist-chegada-au-pair' });
  mod.setC([P5]);
  const feito = { id: 11, contato_id: 'p5', quando: dia(-10), status: 'feito', registro: null };
  const marcado = { id: 'u2', contato_id: 'p5', quando: dia(3), status: 'agendado', registro: { origem: 'I03' } };
  const cancel = { id: 'u3', contato_id: 'p5', quando: dia(-20), status: 'cancelado', registro: null };
  mod.setUM([marcado, cancel, feito]);
  check('código vem da página de origem (I05) e aparece como IL05', mod.r1Codigo(P5, feito) === 'I05' && mod.r1Rotulo('I05') === 'IL05');
  check('o código guardado no registro vence a origem (I03 → IL03)', mod.r1Codigo(P5, marcado) === 'I03' && mod.r1Rotulo('I03') === 'IL03');
  check('sem página conhecida: sem código nem IL', mod.r1Rotulo('') === '' && mod.r1Codigo(pessoa('x', 'X', { origem: 'instagram' }), feito) === '');
  mod.state.fx.r1 = null;
  let h = mod.r1Html(P5, null);
  check('um toggle por 1:1, sem o cancelado, em ordem de data', (h.match(/data-r1="/g) || []).length === 2 && h.indexOf('data-r1="11"') < h.indexOf('data-r1="u2"'));
  check('toggle mostra IL05 e IL03', />IL05</.test(h) && />IL03</.test(h) && !/>I05</.test(h));
  check('fechado: sem os três blocos', !/r1-painel/.test(h));
  mod.state.fx.r1 = '11'; h = mod.r1Html(P5, null);
  check('aberto: três blocos lado a lado (perguntas, identificadas, conclusão)', /Perguntas do roteiro/.test(h) && /Identificadas/.test(h) && /Conclusão e encaminhamento/.test(h) && (h.match(/class="r1-b"/g) || []).length === 3);
  check('aberto: pergunta se recebeu o link e o interesse em converter', /id="r1-int"/.test(h) && /Link do produto enviado/.test(h) && /data-r1save="11"/.test(h));
  const salvo = { id: 'u4', contato_id: 'p5', quando: dia(-2), status: 'feito', registro: { origem: 'I05', perguntas: [{ k: 'cidade', l: 'Cidade' }, { k: 'nivel_frances', l: 'Francês' }], conclusao: 'Quer FLE.', encaminhamento: 'Mandar o link.', interesse: 'sim', link_enviado: true, link_enviado_em: dia(-2) } };
  mod.setUM([salvo]); mod.state.fx.r1 = 'u4'; h = mod.r1Html(P5, null);
  check('roteiro salvo vale (2 perguntas), identificadas 0 de 2 sem dossiê carregado', mod.r1Roteiro(P5, salvo, null).salvo === true && /<b>0<\/b> de 2/.test(h));
  check('conclusão, interesse e link enviado voltam preenchidos', /Quer FLE\./.test(h) && /<option value="sim" selected>/.test(h) && /id="r1-link" checked/.test(h) && />registrado</.test(h));
  mod.setUM([]); h = mod.r1Html(P5, null);
  check('sem 1:1: mensagem de vazio', /Nenhum 1:1 marcado ou feito/.test(h) && !/data-r1=/.test(h));
}

console.log('== Tudo ligado ao e-mail ==');
{
  const P = pessoa('lt', 'Lia', { email: 'lia@example.com', user_id: 'u-lt', ultima_origem: 'guia-checklist-chegada-au-pair' });
  mod.setC([P]);
  mod.setUM([{ id: 21, contato_id: 'lt', quando: dia(-6), status: 'feito', registro: null }, { id: 22, contato_id: 'lt', quando: dia(4), status: 'agendado', registro: null }]);
  mod.setPAG([{ contato_id: 'lt', minutos: 20, pago_em: dia(-8) }]);
  const ev = (tipo, dados, d) => ({ tipo, dados, criado_em: dia(d) });
  const d = { eventos: [ev('email_capturado', { origem: 'guia-checklist-chegada-au-pair' }, -30), ev('quiz_respondido', { objetivo: 'ap-nao-sei-comecar' }, -30), ev('app_aberto', {}, -20), ev('compra', { produto: 'template-x' }, -10), ev('um_a_um_agendado', { quando: dia(4) }, -9)], jor: { entradas: [{ em: dia(-30), origem: 'guia-checklist-chegada-au-pair' }], quizzes: [], ativouEm: dia(-20) } };
  const it = mod.ltItens(P, d);
  check('junta eventos, 1:1 e pagamento do 1:1 (o evento de 1:1 marcado não duplica)', it.length === 7 && it.filter((x) => x.cat === 'um').length === 2);
  check('ordem: do mais novo ao mais antigo', it.every((x, i) => i === 0 || it[i - 1].em >= x.em));
  check('a entrada mostra o IL05', it.some((x) => x.cat === 'entrada' && /^IL05 · /.test(x.tx)));
  check('compras: produto e 1:1 pago, sem valor em euros', it.filter((x) => x.cat === 'compra').length === 2 && !it.some((x) => /€|euro/i.test(x.tx)));
  check('resumo: entrou por IL05, conta, compras e 1:1 feitos', /Entrou por IL05/.test(mod.ltResumo(P, d, it)) && /tem conta no app/.test(mod.ltResumo(P, d, it)) && /2 compras/.test(mod.ltResumo(P, d, it)) && /1 1:1 feito/.test(mod.ltResumo(P, d, it)));
  mod.state.fx.lf = 'tudo'; let h = mod.ltHtml(P, d);
  check('mostra o e-mail, os filtros com contagem e a nota do euro', /lia@example\.com/.test(h) && /data-lf="compra"/.test(h) && /Compras <i>2<\/i>/.test(h) && /não é guardado/.test(h));
  mod.state.fx.lf = 'um'; h = mod.ltHtml(P, d);
  check('filtro 1:1 mostra só os 1:1', (h.match(/<li class="lt-/g) || []).length === 2 && !/lt-compra/.test(h));
  mod.state.fx.lf = 'tudo';
}

console.log('== Estudos, certificados e prazo ==');
{
  const P = pessoa('ep', 'Eva', { email: 'eva@example.com', prazo_limite: '2026-11-21', dias_para_prazo: 6, data_entrada: '2026-08-22', nivel_estudos: 'a1' });
  mod.setC([P]); mod.setUM([]); mod.setPAG([]);
  const h = mod.dosVisaoHtml(P, { eventos: [], mails: [], resps: [], perg: [], jor: { entradas: [], quizzes: [] } });
  check('cartão próprio com diploma, certificado e prazo', /Estudos, certificados e prazo/.test(h) && /Diploma mais recente/.test(h) && /Certificado de francês/.test(h));
  check('sem resposta: "ainda não informado" em vez de sumir ou mostrar código cru', (h.match(/ainda não informado/g) || []).length >= 2 && !/<b>a1<\/b>/.test(h));
  check('o prazo diz o que é e como se calcula', /Prazo do VLS-TS/.test(h) && /21\/11\/2026 \(faltam 6 d\)/.test(h) && /Validar o VLS-TS na ANEF: 3 meses depois da entrada na França \(22\/08\/2026\)/.test(h));
}

console.log('\n' + (failed ? failed + ' FALHARAM, ' : '') + passed + ' passaram' + (failed ? '' : ', 0 falharam'));
process.exit(failed ? 1 : 0);
