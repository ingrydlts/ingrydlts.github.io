// Testa o Roteiro de perguntas na ficha (dentro do "Falta perguntar" do dossiê): a próxima pergunta, o rascunho para o chat, o ritmo
// (esperar resposta) e a fila. Roda o crm.js de verdade em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real.
//
// Uso: cd admin/crm/db/testes && node crm-roteiro-perguntas-ui.test.mjs
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
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null };
let respostas = {};
function qb(table) {
  const b = new Proxy({}, { get(_, k) {
    if (k === 'maybeSingle') return async () => respostas[table + ':one'] || { data: null, error: null };
    if (k === 'update') return () => ({ eq: async () => ({ error: null }) });
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko);
    return () => b;
  } });
  return b;
}
const rpcs = [];
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: null }; } };
const store = {};
const win = { addEventListener() {} };
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, pergFila, pergMensagem, PERGUNTAS, PERG_ESPERA_DIAS };')(
  supabase, {}, document, win, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const XSS = '<img src=x onerror=alert(1)>';
const agora = Date.now();
const haDias = (n) => new Date(agora - n * 86400000).toISOString();
const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Silva', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
mod.setC([Object.assign({}, base)]);
// Chat do banco vem do mais novo para o mais antigo (o crm.js inverte).
let id = 0;
const M = (de, texto, dias, o = {}) => Object.assign({ id: ++id, de, tipo: 'texto', texto, acao: null, proposta_id: null, criado_em: haDias(dias), lida_em: null }, o);
async function pagina(dossie, msgs, extra = {}) {
  id = 0;
  respostas['contatos:one'] = { data: Object.assign({ dossie: dossie || {}, user_id: 'u1', onboarding_em: '2026-10-01T10:00:00Z', dossie_origem: {} }, extra.contato || {}), error: null };
  const lista = (msgs || []).map((m, i) => Object.assign({}, m, { id: i + 1 }));
  respostas.chat_mensagens = { data: lista.slice().reverse(), error: null };
  respostas.propostas = { data: [], error: null };
  respostas.checklist_items = extra.semConta ? { data: [], error: null } : { data: [{ step_key: 'a', label: 'Passo', status: 'pendente', category: 'X', due_date: null }], error: null };
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'ficha';
  await mod.renderPessoa(); await wait(15);
  return el('pessoa-page').innerHTML;
}
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); await wait(15); };
const TODOS = { ano_au_pair: 'primeiro', intencao_au_pair: 'migrar_estudante', contrato_fim: '2027-06-30', documento_vencimento: '2027-09-01', data_chegada: '2026-09-01', numero_secu: 'recebi', trilha_estudo: 'licence', conta_anef: 'sim',
  comprova_recursos: 'false', tem_sponsor: 'false', tem_certificado_matricula: 'false', moradia_resolvida: true, comprovante_endereco: 'sim', conta_resolvida: true, securite_resolvida: true, nivel_frances: 'a1_a2', faixa_idade: '26_29', maior_preocupacao: 'frances', cidade: 'Paris', certificado_frances_qual: 'delf' };

console.log('== O rascunho da pergunta do certificado de francês ==');
const rasc = mod.pergMensagem({ nome: 'Ana Silva' }, mod.PERGUNTAS.certificado_frances);
check('texto exato: nome, UMA pergunta, o que destrava no app e convite a responder', rasc === 'Oi, Ana! Uma pergunta rápida para eu acertar o seu caminho: você já tem algum certificado de francês (DELF, DALF, TCF ou TEF)?\n\nSe ainda não tem, o Painel do Certificado já está esperando na sua Home, em "Guias, materiais e conteúdos".\n\nPode me responder por aqui mesmo, com calma.');
check('sem nome: só "Oi!"', mod.pergMensagem({}, mod.PERGUNTAS.cidade).startsWith('Oi! Uma pergunta rápida'));
check('todo rascunho cabe no chat (1000 letras) e tem exatamente uma interrogação de pergunta', Object.values(mod.PERGUNTAS).every((d) => mod.pergMensagem({ nome: 'Ana' }, d).length < 700 && (d.q.match(/\?/g) || []).length === 1));
check('todo rascunho de pergunta com gancho diz o que destrava no app', Object.entries(mod.PERGUNTAS).every(([k, d]) => d.g && d.g.length > 10));

console.log('\n== A fila: uma por vez, por impacto ==');
let html = await pagina({});
check('o roteiro aparece no "Falta perguntar", mesmo com o dossiê fechado', html.includes('Roteiro de perguntas') && html.includes('data-pergchat='));
let f = mod.pergFila(Object.assign({}, base), {}, {}, agora);
check('a primeira é a de mais impacto (vencimento do documento) e a ordem segue a prioridade', f.proxima.k === 'documento_vencimento' && f.itens.every((it, i, a) => i === 0 || a[i - 1].def.p >= it.def.p));
check('telefone e aceite de lembretes nunca entram', !f.itens.some((i) => ['telefone', 'aceita_notificacao_externa'].includes(i.k)));
check('campo sem texto próprio entra com prioridade baixa e pergunta genérica (não quebra)', (() => { const it = mod.pergFila(Object.assign({}, base, { persona: 'campus_france' }), {}, {}, agora).itens.find((i) => i.k === 'cfEtapa'); return it && it.def.p === 40 && /^me conta: /.test(it.def.q) && it.def.g === ''; })());
html = await pagina(Object.assign({}, TODOS));
check('com quase tudo respondido, sobra só o que falta (certificado de francês) como próxima', /Próxima: Tem certificado de francês\?/.test(html) && html.includes('Painel do Certificado'));
check('campos que moram em colunas de contatos (estudos, preocupação do funil) não viram pergunta de chat', !f.itens.some((i) => ['nivel_estudos', 'preocupacao', 'nome', 'persona', 'fase'].includes(i.k)) && f.itens.some((i) => i.k === 'profissao_regulamentada'));
check('o campo respondido some da fila', !mod.pergFila(Object.assign({}, base), TODOS, {}, agora).itens.some((i) => i.k === 'cidade'));

console.log('\n== Não repete, e espera a resposta ==');
const Q = mod.PERGUNTAS.certificado_frances.q;
f = (await pagina(Object.assign({}, TODOS), [M('ingryd', 'Oi! Uma pergunta rápida: ' + Q, 5)]), mod.pergFila(Object.assign({}, base), TODOS, {}, agora));
check('pergunta já feita há 5 dias vai para o fim da fila e mostra há quantos dias', f.itens.find((i) => i.k === 'certificado_frances').feita.dias === 5 && f.proxima.k !== 'certificado_frances' && f.itens[f.itens.length - 1].k === 'certificado_frances');
const todasFeitas = mod.pergFila(Object.assign({}, base), TODOS, {}, agora).itens.map((i, n) => M('ingryd', 'Oi! ' + i.def.q, 10 - Math.min(n, 5)));
html = await pagina(Object.assign({}, TODOS), todasFeitas);
check('todas já feitas: diz para esperar as respostas', html.includes('já foram feitas') && html.includes('perguntada há'));
f = (await pagina(Object.assign({}, TODOS), [M('ingryd', Q, 5), M('pessoa', 'Ainda não tenho.', 4)]), mod.pergFila(Object.assign({}, base), TODOS, {}, agora));
check('se ela respondeu depois, marca como perguntada e respondida', f.itens.find((i) => i.k === 'certificado_frances').feita.respondida === true);
check('o casamento ignora maiúsculas', (await pagina(Object.assign({}, TODOS), [M('ingryd', Q.toUpperCase(), 2)]), mod.pergFila(Object.assign({}, base), TODOS, {}, agora).itens.find((i) => i.k === 'certificado_frances').feita !== null));
check('mensagem DELA com o mesmo texto não conta como pergunta nossa', (await pagina(Object.assign({}, TODOS), [M('pessoa', Q, 2)]), mod.pergFila(Object.assign({}, base), TODOS, {}, agora).itens.find((i) => i.k === 'certificado_frances').feita === null));
html = await pagina({}, [M('ingryd', 'Bom dia! Como estão as coisas?', 1)]);
check('você escreveu por último há menos de 3 dias: manda esperar, com a data', /Espere até \d{2}\/\d{2}\/\d{4}/.test(html));
html = await pagina({}, [M('ingryd', 'Bom dia! Como estão as coisas?', 4)]);
check('passaram 3 dias sem resposta: não segura mais', !html.includes('Espere até'));
html = await pagina({}, [M('ingryd', 'Bom dia!', 1), M('pessoa', 'Oi, tudo bem!', 0)]);
check('ela respondeu: pode perguntar a próxima na hora', !html.includes('Espere até'));
check('proposta de 1:1 não conta como pergunta nem segura a fila', !(await pagina({}, [M('ingryd', 'Um 1:1?', 1, { tipo: 'proposta' })])).includes('Espere até'));

console.log('\n== Levar para o chat ==');
await pagina(Object.assign({}, TODOS));
mod.state.chatRasc = '';
await click({ pergchat: 'certificado_frances', cid: 'c1' });
check('o rascunho vai para o chat, com a pergunta e o gancho do app', mod.state.chatRasc === rasc && mod.state.ptab === 'plataforma' && mod.state.pstab === 'chat');
check('NÃO envia nada sozinho', !rpcs.some((r) => /chat/.test(r.n)));
await pagina(Object.assign({}, TODOS), [M('ingryd', 'Bom dia!', 1)]);
mod.state.chatRasc = 'antes'; win.confirm = () => false;
await click({ pergchat: 'certificado_frances', cid: 'c1' });
check('esperando resposta: pergunta antes de empilhar, e se você disser não, nada muda', mod.state.chatRasc === 'antes');
win.confirm = () => true;
await click({ pergchat: 'certificado_frances', cid: 'c1' });
check('se você confirmar, leva mesmo assim', mod.state.chatRasc === rasc);
delete win.confirm;
await pagina(Object.assign({}, TODOS, { certificado_frances: 'tenho' }));
mod.state.chatRasc = 'antes';
await click({ pergchat: 'certificado_frances', cid: 'c1' });
check('pergunta que já foi respondida: avisa e não mexe no rascunho', mod.state.chatRasc === 'antes');

console.log('\n== Sem conta no app, sem chat, e texto do banco ==');
html = await pagina(Object.assign({}, TODOS), [], { semConta: true, contato: { user_id: null } });
check('ainda sem conta: avisa que o chat só existe no app e oferece o e-mail em vez do chat', /Ela ainda não entrou no app/.test(html) && !html.includes('data-pergchat=') && html.includes('data-emailfor="c1"'));
respostas.chat_mensagens = { data: null, error: { message: 'relation "chat_mensagens" does not exist' } };
respostas['contatos:one'] = { data: { dossie: TODOS, user_id: 'u1', onboarding_em: '2026-10-01T10:00:00Z', dossie_origem: {} }, error: null };
mod.state.sel = 'c1'; await mod.renderPessoa(); await wait(15);
check('sem o SQL do chat: o roteiro diz que não sabe o que já foi perguntado, e segue', /não sei o que já foi perguntado/.test(el('pessoa-page').innerHTML) && el('pessoa-page').innerHTML.includes('Próxima'));
mod.setC([Object.assign({}, base, { nome: XSS })]);
html = await pagina(Object.assign({}, TODOS));
check('nome vindo do banco passa por esc() no rascunho mostrado', !html.includes(XSS) && html.includes('Oi, &lt;img'));
mod.setC([Object.assign({}, base)]);

console.log('\n== Processos que o assistente sugeriu (a pergunta com mais ganho) ==');
mod.state.procs = [{ id: 5, processo: 'caf', status: 'detectada', sinais: [{ texto: 'x' }], detectada_em: '2026-10-26T10:00:00Z' }];
respostas.processos_sugeridos = { data: mod.state.procs, error: null };
html = await pagina(Object.assign({}, TODOS));
check('processo detectado aparece antes de tudo, com o botão do recado sugerido', html.includes('Antes de tudo') && html.includes('data-pergproc="5"') && html.indexOf('Antes de tudo') < html.indexOf('Próxima:'));
el('proc-msg-5').value = '';
await click({ pergproc: '5' });
check('o recado sugerido vai para o cartão da CAF (você revisa e aprova)', el('proc-msg-5').value === 'Vi que você já tem moradia: a CAF pode devolver parte do aluguel. Vale abrir esse processo no seu checklist?');
check('nada foi aprovado sozinho', !rpcs.some((r) => r.n === 'crm_decidir_processo'));

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
