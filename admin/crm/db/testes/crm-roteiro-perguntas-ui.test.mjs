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
    if (k === 'update') return () => qb('__update');
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko);
    return () => b;
  } });
  return b;
}
const rpcs = [];
let rpcResp = {};
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async (n, a) => { rpcs.push({ n, a }); return rpcResp[n] !== undefined ? (typeof rpcResp[n] === 'function' ? rpcResp[n](a) : rpcResp[n]) : { data: null, error: null }; } };
const store = {};
const win = { addEventListener() {} };
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, pergFila, pergMensagem, pergDatasSequencia, pergAgradecimento, PERGUNTAS, PERG_ESPERA_DIAS };')(
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
  respostas.mensagens_agendadas = extra.agendadas ? { data: extra.agendadas, error: null } : { data: [], error: null };
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

console.log('\n== Agendar a data de cada mensagem ==');
const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const emHoras = (h) => fmtLocal(new Date(Date.now() + h * 3600e3));
const digitaTexto = (k, v) => handlers.input.forEach((h) => h({ target: { id: 'perg-texto', value: v, dataset: { cid: 'c1', pergk: k }, matches: () => false } }));
html = await pagina(Object.assign({}, TODOS));
check('o rascunho vira uma caixa que você pode editar, e há o seletor de data e hora com o botão de agendar', /<textarea id="perg-texto"[^>]*data-pergk="certificado_frances"/.test(html) && html.includes('id="perg-quando" type="datetime-local"') && html.includes('data-pergagendar="certificado_frances"'));
check('o padrão é amanhã às 10h', /id="perg-quando" type="datetime-local" value="\d{4}-\d{2}-\d{2}T10:00"/.test(html));
check('explica a hora de saída (rodada de hora em hora, às :05) e que dá para cancelar', html.includes('às :05') && html.includes('cancelar antes'));
rpcs.length = 0; el('perg-quando').value = emHoras(30);
digitaTexto('certificado_frances', 'Oi, Ana! Texto que eu mesma ajustei.');
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
let ag = rpcs.find((r) => r.n === 'crm_agendar_mensagem');
check('agendar chama crm_agendar_mensagem com o TEXTO EDITADO, a data em ISO, a origem e o campo', ag && ag.a.p_contato === 'c1' && ag.a.p_texto === 'Oi, Ana! Texto que eu mesma ajustei.' && ag.a.p_origem === 'roteiro' && ag.a.p_campo === 'certificado_frances' && !isNaN(new Date(ag.a.p_enviar_em).getTime()) && new Date(ag.a.p_enviar_em).getTime() > Date.now() + 29 * 3600e3);
check('NÃO manda nada para o chat agora (a mensagem só sai na hora marcada, pelo Worker)', !rpcs.some((r) => /chat/.test(r.n)));
rpcs.length = 0; el('perg-quando').value = emHoras(0.05);
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('menos de 10 minutos à frente: recusa sem chamar o banco', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
el('perg-quando').value = emHoras(24 * 125);
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('além de 119 dias: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
el('perg-quando').value = '';
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('sem data: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
el('perg-quando').value = emHoras(30); digitaTexto('certificado_frances', 'x'.repeat(1001));
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('mais de 1000 letras: recusa (o limite do chat)', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
mod.state.pergEdit = null;
rpcResp.crm_agendar_mensagem = { data: null, error: { message: 'data_invalida' } };
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('se o banco recusar, mostra o erro (não some em silêncio)', el('toast').textContent.includes('agendar a mensagem'));
delete rpcResp.crm_agendar_mensagem;

const AGENDADA = { id: 41, texto: 'Oi, Ana! ' + Q, enviar_em: new Date(Date.now() + 30 * 3600e3).toISOString(), status: 'pendente', campo: 'certificado_frances', erro: null, enviada_em: null };
html = await pagina(Object.assign({}, TODOS), [], { agendadas: [AGENDADA] }); await wait(20);
html = el('dossie-box').innerHTML;
check('mensagem já agendada: aparece em "Agendadas para ela", com a data e o botão cancelar', html.includes('Agendadas para ela') && html.includes('agendada ·') && html.includes('data-pergcancelar="41"'));
f = mod.pergFila(Object.assign({}, base), TODOS, {}, Date.now());
check('a pergunta agendada sai de "próxima" (não agenda duas vezes) e vai para o fim, marcada', f.itens.find((i) => i.k === 'certificado_frances').agendada.id === 41 && f.proxima.k !== 'certificado_frances' && /agendada para/.test(html));
rpcs.length = 0; rpcResp.crm_cancelar_mensagem_agendada = { data: true, error: null };
await click({ pergcancelar: '41', cid: 'c1' });
check('cancelar chama crm_cancelar_mensagem_agendada', rpcs.some((r) => r.n === 'crm_cancelar_mensagem_agendada' && r.a.p_id === 41));
rpcResp.crm_cancelar_mensagem_agendada = { data: false, error: null };
await click({ pergcancelar: '41', cid: 'c1' });
check('se já tinha saído, avisa em vez de dizer que cancelou', el('toast').textContent.includes('já tinha saído'));
delete rpcResp.crm_cancelar_mensagem_agendada;
html = await pagina(Object.assign({}, TODOS), [], { agendadas: [Object.assign({}, AGENDADA, { status: 'erro', erro: 'chat 500' }), Object.assign({}, AGENDADA, { id: 42, status: 'enviada', enviada_em: new Date().toISOString() })] }); await wait(20);
html = el('dossie-box').innerHTML;
check('o que não saiu mostra o motivo; o enviado não tem botão de cancelar', html.includes('não saiu') && html.includes('chat 500') && html.includes('enviada ·') && !html.includes('data-pergcancelar'));
respostas.mensagens_agendadas = { data: null, error: { message: 'relation "mensagens_agendadas" does not exist' } };
mod.state.ag = null; await mod.renderPessoa(); await wait(20);
html = el('dossie-box').innerHTML;
check('SQL não rodado: avisa o nome do arquivo e desliga o agendamento, sem derrubar o resto', html.includes('db/crm-mensagens-agendadas.sql') && /data-pergagendar[^>]*disabled/.test(html) && html.includes('data-pergchat='));
respostas.mensagens_agendadas = { data: [], error: null }; mod.state.ag = null;

console.log('\n== Sequência de reimpacto ==');
const seg = mod.pergDatasSequencia(new Date(2026, 10, 3, 15, 0).getTime(), 3);   // terça, 3/11/2026
check('datas: amanhã às 10h e depois de 3 em 3 dias, sempre em dia útil', seg.map((d) => d.getDate() + '/' + (d.getMonth() + 1) + ' ' + d.getHours() + 'h').join() === '4/11 10h,9/11 10h,12/11 10h' && seg.every((d) => d.getDay() !== 0 && d.getDay() !== 6));
check('sexta de tarde: o "amanhã" (sábado) passa para segunda', mod.pergDatasSequencia(new Date(2026, 10, 6, 15, 0).getTime(), 1)[0].getDay() === 1);
check('uma data que cairia no fim de semana passa para segunda e a seguinte conta a partir dela', (() => { const d = mod.pergDatasSequencia(new Date(2026, 10, 4, 15, 0).getTime(), 3); return d.map((x) => x.getDay()).every((w) => w >= 1 && w <= 5) && d[1].getTime() - d[0].getTime() >= 3 * 86400000; })());
html = await pagina(Object.assign({}, TODOS, { certificado_frances: undefined, cidade: undefined, faixa_idade: undefined }));
f = mod.pergFila(Object.assign({}, base), Object.assign({}, TODOS, { cidade: undefined }), {}, Date.now());
check('a sequência propõe as próximas 3 perguntas pela ordem do roteiro', f.sequencia.length === 3 && f.sequencia.map((i) => i.k).join() === f.itens.filter((i) => !i.feita && !i.agendada).slice(0, 3).map((i) => i.k).join());
html = await pagina(Object.assign({}, TODOS));
check('o bloco "Sequência de reimpacto" mostra cada pergunta com data, hora e mensagem editáveis', html.includes('Sequência de reimpacto') && (html.match(/type="datetime-local" data-seqk=/g) || []).length >= 2 && (html.match(/data-seqon=/g) || []).length >= 2 && html.includes('data-seqagendar="c1"'));
const linhasK = [...html.matchAll(/data-seqon="([^"]+)"/g)].map((m) => m[1]);
check('explica o ritmo (a cada 3 dias, 10h) e a trava de 3 sem resposta', html.includes('a cada 3 dias') && html.includes('3 mensagens sem responder'));
rpcs.length = 0;
linhasK.forEach((k, i) => { el('seq-quando-' + k).value = emHoras(24 * (i + 1)); el('seq-texto-' + k).value = 'Mensagem ' + k; handlers.input.forEach((h) => { h({ target: { id: 'seq-quando-' + k, value: emHoras(24 * (i + 1)), dataset: { seqk: k }, matches: () => false } }); h({ target: { id: 'seq-texto-' + k, value: 'Mensagem ' + k, dataset: { seqk: k }, matches: () => false } }); }); });
handlers.change.forEach((h) => h({ target: { id: '', dataset: { seqon: linhasK[1] }, checked: false, matches: () => false } }));
await click({ seqagendar: 'c1' });
const agds = rpcs.filter((r) => r.n === 'crm_agendar_mensagem');
check('agenda só as marcadas, cada uma com a SUA data, o SEU texto e o campo', agds.length === linhasK.length - 1 && agds.every((x) => x.a.p_campo !== linhasK[1]) && agds[0].a.p_texto === 'Mensagem ' + linhasK[0] && agds[0].a.p_campo === linhasK[0]);
check('as datas agendadas são as que você escolheu, em ordem', agds.every((x, i, a) => i === 0 || new Date(x.a.p_enviar_em) > new Date(a[i - 1].a.p_enviar_em)));
check('nada vai para o chat agora', !rpcs.some((r) => /chat/.test(r.n)));
rpcs.length = 0; mod.state.seq = null;
await pagina(Object.assign({}, TODOS));
handlers.change.forEach((h) => linhasK.forEach((k) => h({ target: { id: '', dataset: { seqon: k }, checked: false, matches: () => false } })));
await click({ seqagendar: 'c1' });
check('nenhuma marcada: avisa e não chama o banco', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
mod.state.seq = null; await pagina(Object.assign({}, TODOS));
let n2 = 0; rpcResp.crm_agendar_mensagem = () => (++n2 === 2 ? { data: null, error: { message: 'data_invalida' } } : { data: 1, error: null });
rpcs.length = 0; await click({ seqagendar: 'c1' });
check('se uma falhar no meio, para ali e diz quantas foram agendadas (sem repetir nem esconder)', rpcs.filter((r) => r.n === 'crm_agendar_mensagem').length === 2 && /1 de \d foram agendadas/.test(el('toast').textContent));
delete rpcResp.crm_agendar_mensagem; mod.state.seq = null;

console.log('\n== Trava: ela não responde ==');
html = await pagina(Object.assign({}, TODOS), [M('ingryd', 'Pergunta 1', 12), M('ingryd', 'Pergunta 2', 9), M('ingryd', 'Pergunta 3', 6)]);
f = mod.pergFila(Object.assign({}, base), TODOS, {}, Date.now());
check('3 mensagens suas seguidas sem resposta: parar', f.semResposta === 3 && f.parar === true);
check('o aviso manda parar, propor 1:1 ou e-mail, e oferece o botão de 1:1', html.includes('3 mensagens seguidas e ela não respondeu') && html.includes('Proponha um 1:1') && html.includes('data-open1a1="c1"'));
f = (await pagina(Object.assign({}, TODOS), [M('ingryd', 'a', 12), M('ingryd', 'b', 9), M('pessoa', 'oi', 8), M('ingryd', 'c', 6)]), mod.pergFila(Object.assign({}, base), TODOS, {}, Date.now()));
check('se ela respondeu no meio, a contagem recomeça (só 1 sem resposta)', f.semResposta === 1 && f.parar === false);
f = (await pagina(Object.assign({}, TODOS), [M('ingryd', 'a', 12), M('ingryd', 'b', 9), M('ingryd', 'Um 1:1?', 6, { tipo: 'proposta' })]), mod.pergFila(Object.assign({}, base), TODOS, {}, Date.now()));
check('proposta de 1:1 não conta como pergunta sem resposta', f.semResposta === 2 && f.parar === false);
await pagina(Object.assign({}, TODOS), [M('ingryd', 'Pergunta 1', 12), M('ingryd', 'Pergunta 2', 9), M('ingryd', 'Pergunta 3', 6)]);
mod.state.chatRasc = 'antes'; win.confirm = () => false;
await click({ pergchat: 'certificado_frances', cid: 'c1' });
check('levar para o chat com a trava ativa pergunta antes; dizendo não, nada muda', mod.state.chatRasc === 'antes');
rpcs.length = 0; el('perg-quando').value = emHoras(30);
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('agendar com a trava ativa também pergunta (e não agenda se você disser não)', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
await click({ seqagendar: 'c1' });
check('a sequência também pergunta antes', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
win.confirm = () => true; el('perg-quando').value = emHoras(30);
await click({ pergagendar: 'certificado_frances', cid: 'c1' });
check('confirmando, agenda', rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
delete win.confirm;

console.log('\n== Agradecer quando ela responde ==');
html = await pagina(Object.assign({}, TODOS), [M('ingryd', 'Oi! ' + Q, 2), M('pessoa', 'Ainda não tenho!', 1)]);
check('ela respondeu a uma pergunta do roteiro há pouco: sugere agradecer e mostrar o que mudou', html.includes('Ela respondeu.') && html.includes('Obrigada, Ana! Com a sua resposta eu ajustei o seu caminho') && html.includes('data-pergagradecer="c1"'));
mod.state.chatRasc = '';
await click({ pergagradecer: 'c1' });
check('o agradecimento vai para o rascunho do chat, sem enviar', mod.state.chatRasc === mod.pergAgradecimento({ nome: 'Ana Silva' }) && mod.state.pstab === 'chat' && !rpcs.some((r) => /chat/.test(r.n)));
html = await pagina(Object.assign({}, TODOS), [M('ingryd', 'Bom dia! Como você está?', 2), M('pessoa', 'Tudo bem!', 1)]);
check('resposta a uma conversa que não era pergunta do roteiro: não sugere agradecer', !html.includes('Ela respondeu.'));
html = await pagina(Object.assign({}, TODOS), [M('ingryd', 'Oi! ' + Q, 9), M('pessoa', 'Ainda não tenho!', 8)]);
check('resposta antiga (mais de 3 dias): não sugere agradecer', !html.includes('Ela respondeu.'));

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
