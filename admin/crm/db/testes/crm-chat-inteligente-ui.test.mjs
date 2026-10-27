// Testa o "cérebro do chat": a sugestão única (perguntar, esperar, agradecer, parar), a caixa já preenchida, o menu de quando enviar
// (agora, amanhã, 3 dias úteis, sequência, data escolhida), o agendamento e a lista de agendadas. Roda o crm.js de verdade em Node com um
// navegador e um Supabase de mentira. NÃO testa nada em navegador real.
//
// Uso: cd admin/crm/db/testes && node crm-chat-inteligente-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', scrollTop: 0, scrollHeight: 0, clientHeight: 0, addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
const rpcs = [];
let respostas = {}, rpcResp = {};
function qb(table) {
  const b = new Proxy({}, { get(_, k) {
    if (k === 'maybeSingle') return async () => respostas[table + ':one'] || { data: null, error: null };
    if (k === 'update') return () => qb('__update');
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko);
    return () => b;
  } });
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return rpcResp[n] !== undefined ? (typeof rpcResp[n] === 'function' ? rpcResp[n](a) : rpcResp[n]) : { data: null, error: null }; },
  channel: () => { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; }, removeChannel() {} };
const store = {};
const win = { addEventListener() {} };
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, chatSugestao, pergDatasSequencia, pergMensagem, pergAgradecimento, PERGUNTAS };')(
  supabase, {}, document, win, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const XSS = '<img src=x onerror=alert(1)>';
const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Silva', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
mod.setC([Object.assign({}, base)]);
const agora = () => Date.now();
const haDias = (n) => new Date(agora() - n * 86400000).toISOString();
const TODOS = { ano_au_pair: 'primeiro', intencao_au_pair: 'migrar_estudante', contrato_fim: '2027-06-30', documento_vencimento: '2027-09-01', data_chegada: '2026-09-01', numero_secu: 'recebi', trilha_estudo: 'licence', conta_anef: 'sim',
  comprova_recursos: 'false', tem_sponsor: 'false', tem_certificado_matricula: 'false', moradia_resolvida: true, comprovante_endereco: 'sim', conta_resolvida: true, securite_resolvida: true, nivel_frances: 'a1_a2', faixa_idade: '26_29', maior_preocupacao: 'frances', cidade: 'Paris', certificado_frances_qual: 'delf' };
const Q = mod.PERGUNTAS.certificado_frances.q;
const PRO = mod.PERGUNTAS.profissao_regulamentada.q;
let id = 0;
const M = (de, texto, dias, o = {}) => Object.assign({ id: ++id, de, tipo: 'texto', texto, acao: null, proposta_id: null, criado_em: haDias(dias), lida_em: haDias(dias) }, o);
async function chat(dossie, msgs, extra = {}) {
  id = 0;
  const lista = (msgs || []).map((m, i) => Object.assign({}, m, { id: i + 1 }));
  respostas = { 'contatos:one': { data: Object.assign({ dossie: dossie || {}, user_id: extra.semConta ? null : 'u1', onboarding_em: '2026-10-01T10:00:00Z', dossie_origem: {} }, {}), error: null },
    chat_mensagens: { data: lista.slice().reverse(), error: null }, propostas: { data: [], error: null }, checklist_items: { data: extra.semConta ? [] : [{ step_key: 'a', label: 'Passo', status: 'pendente', category: 'X', due_date: null }], error: null },
    plataforma_cliques: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, mensagens_agendadas: extra.semSql ? { data: null, error: { message: 'relation "mensagens_agendadas" does not exist' } } : { data: extra.agendadas || [], error: null } };
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = extra.tab || 'plataforma'; mod.state.pstab = 'chat';
  mod.state.chatCtl = null; mod.state.chatEditado = false; mod.state.chatSugPula = 0; mod.state.chatRasc = ''; mod.state.pc = extra.pc || null;
  respostas.processos_sugeridos = { data: extra.procs || [], error: null };
  el('chat-txt').value = '';
  await mod.renderPessoa(); await wait(25);
  const h = el('pessoa-page').innerHTML;
  // Num navegador de verdade o .value de uma <textarea> é o texto que ela tem dentro: o mesmo aqui.
  const m = /<textarea class="notebox" id="chat-txt"[^>]*>([\s\S]*?)<\/textarea>/.exec(h);
  if (!el('chat-txt').value) el('chat-txt').value = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : '';   // se a leitura das agendadas já repintou a caixa, vale o que ela escreveu
  return h;
}
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); await wait(20); return b; };
const escolhe = async (valor) => { handlers.change.forEach((h) => h({ target: { id: 'chat-quando', value: valor, dataset: {}, matches: () => false } })); await wait(10); };
const digita = (texto) => { el('chat-txt').value = texto; handlers.input.forEach((h) => h({ target: { id: 'chat-txt', value: texto, dataset: {}, matches: () => false } })); };
const sug = () => mod.chatSugestao(Object.assign({}, base), agora());
const ctl = () => el('chat-ctl').innerHTML;
const agsHtml = () => el('chat-agendadas').innerHTML;
const SEQ3 = Object.assign({}, TODOS, { cidade: undefined });
const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const RASC = 'Oi, Ana! Uma pergunta rápida para eu acertar o seu caminho: você já tem algum certificado de francês (DELF, DALF, TCF ou TEF)?\n\nSe ainda não tem, o Painel do Certificado já está esperando na sua Home, em "Guias, materiais e conteúdos".\n\nPode me responder por aqui mesmo, com calma.';

console.log('== Abrir o chat: a mensagem já está pronta ==');
let html = await chat(TODOS, []);
let s = sug();
check('sem histórico: a sugestão é a próxima pergunta, por impacto (certificado de francês), para enviar agora', s.tipo === 'perguntar' && s.pick.k === 'certificado_frances' && s.quando === 'agora');
check('a caixa abre já escrita com a pergunta e o gancho do app (zero cliques para escrever)', html.includes('<textarea class="notebox" id="chat-txt"') && html.includes('você já tem algum certificado de francês (DELF, DALF, TCF ou TEF)?') && html.includes('Painel do Certificado'));
check('uma única linha de motivo, em cima da caixa', html.includes('id="chat-sug"') && /Próxima pergunta: Tem certificado de francês\?/.test(html) && (html.match(/class="chat-sug /g) || []).length === 1);
check('controles: um menu de quando e UM botão principal ("Enviar")', html.includes('id="chat-quando"') && /data-chatenviar="c1">Enviar</.test(html) && !html.includes('data-chatgo'));
check('as 5 propostas rápidas ficam recolhidas em "Mais opções" (menos botões à vista)', /<details class="chat-mais">[\s\S]*Propor 1:1 de 20 min[\s\S]*Nova proposta/.test(html));
check('o texto longo explicando tudo virou uma linha', html.includes('Ela recebe um e-mail a cada mensagem sua.') && !html.includes('avatar que flutua'));
const opcoes = [...ctl().matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
check('o menu: agora, amanhã, 3 dias úteis, a sequência e data escolhida', opcoes.join() === 'agora,amanha,d3,seq,custom');
check('o painel de roteiro/sequência do dossiê não existe mais', !(await chat(TODOS, [], { tab: 'ficha' })).includes('Sequência de reimpacto') && !el('pessoa-page').innerHTML.includes('Roteiro de perguntas'));
html = await chat(TODOS, [], { tab: 'ficha' });
check('o dossiê só aponta para o chat com UM link, sem botões de pergunta', html.includes('data-irchat="c1"') && !html.includes('data-pergchat') && !html.includes('data-pergagendar'));
await click({ irchat: 'c1' });
check('o link leva à aba Chat', mod.state.ptab === 'plataforma' && mod.state.pstab === 'chat');

console.log('\n== As situações ==');
html = await chat(TODOS, [M('ingryd', 'Bom dia! Como estão as coisas?', 1)]);
s = sug();
check('você escreveu por último há 1 dia: "esperar", com a pergunta pronta e o envio sugerido para depois do prazo', s.tipo === 'esperar' && s.quando === 'ate' && s.texto.includes('certificado de francês') && /Sugiro agendar para depois do prazo/.test(s.motivo));
check('a data sugerida é depois do prazo de 3 dias, em dia útil, às 10h', s.ate.getHours() === 10 && s.ate.getDay() >= 1 && s.ate.getDay() <= 5 && s.ate.getTime() >= agora() + 1.9 * 86400000);
check('o menu já vem em "Depois da espera" e o botão vira "Agendar" (um clique)', /<option value="ate" selected>Depois da espera/.test(ctl()) && /data-chatgo="c1">Agendar</.test(ctl()) && !ctl().includes('data-chatenviar'));
html = await chat(TODOS, [M('ingryd', 'Bom dia!', 4)]);
check('passaram 3 dias: volta a perguntar agora', sug().tipo === 'perguntar');
html = await chat(TODOS, [M('ingryd', 'Oi! ' + Q, 2), M('pessoa', 'Ainda não tenho!', 1)]);
s = sug();
check('ela respondeu a uma pergunta: "agradecer", e o motivo diz há quanto tempo', s.tipo === 'agradecer' && /Ela respondeu há 1 dia: agradeça, mostre o que mudou no app e já faça a próxima pergunta/.test(s.motivo));
check('UMA mensagem só: agradece, mostra a recompensa (o app mudou) e já faz a próxima pergunta', html.includes('Obrigada, Ana! Com a sua resposta eu ajustei o seu caminho') && html.includes('E já aproveito para a próxima pergunta: ' + PRO) && !html.includes(Q + '?\n') );
html = await chat(TODOS, [M('ingryd', 'Bom dia! Como você está?', 2), M('pessoa', 'Tudo bem!', 1)]);
check('ela respondeu uma conversa que não era pergunta do roteiro: NÃO agradece, só pergunta', sug().tipo === 'perguntar');
html = await chat(TODOS, [M('ingryd', 'Oi! ' + Q, 9), M('pessoa', 'Não tenho', 8)]);
check('resposta antiga (mais de 3 dias): não agradece mais', sug().tipo === 'perguntar');
html = await chat(TODOS, [M('ingryd', 'Pergunta 1', 12), M('ingryd', 'Pergunta 2', 9), M('ingryd', 'Pergunta 3', 6)]);
s = sug();
check('3 mensagens suas seguidas sem resposta: "parar" (e a caixa NÃO vem preenchida)', s.tipo === 'parar' && s.semResposta === 3 && !html.includes('você já tem algum certificado'));
check('o aviso explica e já traz o botão "Propor 1:1"', /Pare de perguntar por aqui/.test(html) && html.includes('data-chatquick="um_a_um">Propor 1:1'));
html = await chat(TODOS, [M('ingryd', 'a', 12), M('ingryd', 'b', 9), M('pessoa', 'oi', 8), M('ingryd', 'c', 6)]);
check('se ela respondeu no meio, a contagem recomeça', sug().semResposta === 1 && sug().tipo !== 'parar');
html = await chat(TODOS, [M('ingryd', 'a', 12), M('ingryd', 'b', 9), M('ingryd', 'Um 1:1?', 6, { tipo: 'proposta' })]);
check('proposta de 1:1 não conta como pergunta sem resposta', sug().semResposta === 2 && sug().tipo !== 'parar');
html = await chat(TODOS, [], { semConta: true });
check('sem conta no app: avisa que o chat só existe lá dentro, sem caixa pré-preenchida e só com "Enviar"', sug().tipo === 'semconta' && /o chat só existe lá dentro/.test(html) && !html.includes('você já tem algum certificado') && !html.includes('id="chat-quando"') && html.includes('data-chatenviar="c1"'));
const tudo = Object.assign({}, TODOS, { certificado_frances: 'tenho', profissao_regulamentada: 'nao' });
html = await chat(tudo, []);
check('nada a perguntar: sem sugestão e caixa vazia', sug().tipo === 'nenhuma' && !html.includes('class="chat-sug') && /<textarea class="notebox" id="chat-txt"[^>]*><\/textarea>/.test(html));

console.log('\n== Outra pergunta e edição ==');
html = await chat(TODOS, []);
const primeira = sug().pick.k;
await click({ sugpular: '1' });
check('"Outra pergunta" troca a sugestão e a caixa (a próxima da fila)', sug().pick.k !== primeira && el('chat-txt').value.includes('profissão regulamentada'));
check('o botão "Outra pergunta" só aparece quando há mais de uma candidata', html.includes('data-sugpular="1"'));
digita('Texto que eu mesma escrevi.');
await escolhe('amanha');
check('o que você digitou NÃO é apagado ao mudar o menu', el('chat-txt').value === 'Texto que eu mesma escrevi.' && mod.state.chatEditado === true);

console.log('\n== Quando enviar: o menu e o botão ==');
html = await chat(TODOS, []);
rpcs.length = 0;
await escolhe('amanha');
check('"Amanhã": o botão vira "Agendar" e explica a hora de saída e o cancelamento', /data-chatgo="c1">Agendar</.test(ctl()) && ctl().includes('às :05') && ctl().includes('cancelar antes'));
await click({ chatgo: 'c1' });
let ag = rpcs.find((r) => r.n === 'crm_agendar_mensagem');
const amanha = mod.pergDatasSequencia(agora(), 2)[0];
check('agendar chama crm_agendar_mensagem com o texto DA CAIXA, amanhã às 10h, a origem e o campo da pergunta', ag && ag.a.p_contato === 'c1' && ag.a.p_texto === RASC && new Date(ag.a.p_enviar_em).getTime() === amanha.getTime() && ag.a.p_origem === 'roteiro' && ag.a.p_campo === 'certificado_frances');
check('NÃO manda nada para o chat agora', !rpcs.some((r) => r.n === 'crm_chat_enviar'));
check('depois de agendar, o menu volta ao padrão e o que você tinha digitado deixa de valer', mod.state.chatCtl === null && mod.state.chatEditado === false && mod.state.chatRasc === '');
rpcs.length = 0; html = await chat(TODOS, []);
await escolhe('d3'); await click({ chatgo: 'c1' });
ag = rpcs.find((r) => r.n === 'crm_agendar_mensagem');
check('"Em 3 dias úteis" agenda para a 2ª data útil, às 10h', new Date(ag.a.p_enviar_em).getTime() === mod.pergDatasSequencia(agora(), 2)[1].getTime() && new Date(ag.a.p_enviar_em).getHours() === 10);
rpcs.length = 0; html = await chat(TODOS, []);
await escolhe('custom');
check('"Escolher dia e hora": aparece o seletor de data com o padrão de amanhã às 10h', ctl().includes('id="chat-quando-custom" type="datetime-local"') && new RegExp('value="' + fmtLocal(amanha) + '"').test(ctl()));
const em = (h) => fmtLocal(new Date(agora() + h * 3600e3));
handlers.input.forEach((h) => h({ target: { id: 'chat-quando-custom', value: em(0.05), dataset: {}, matches: () => false } }));
await click({ chatgo: 'c1' });
check('menos de 10 minutos à frente: recusa e não chama o banco', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
handlers.input.forEach((h) => h({ target: { id: 'chat-quando-custom', value: em(24 * 125), dataset: {}, matches: () => false } }));
await click({ chatgo: 'c1' });
check('além de 119 dias: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
handlers.input.forEach((h) => h({ target: { id: 'chat-quando-custom', value: '', dataset: {}, matches: () => false } }));
await click({ chatgo: 'c1' });
check('sem data: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
handlers.input.forEach((h) => h({ target: { id: 'chat-quando-custom', value: em(30), dataset: {}, matches: () => false } }));
digita('');
await click({ chatgo: 'c1' });
check('caixa vazia: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
digita('x'.repeat(1001));
await click({ chatgo: 'c1' });
check('mais de 1000 letras: recusa', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
digita('Mensagem com data escolhida.');
await click({ chatgo: 'c1' });
ag = rpcs.find((r) => r.n === 'crm_agendar_mensagem');
check('data escolhida: agenda exatamente aquele momento, com o texto editado', ag && ag.a.p_texto === 'Mensagem com data escolhida.' && Math.abs(new Date(ag.a.p_enviar_em).getTime() - (agora() + 30 * 3600e3)) < 120000);
rpcResp.crm_agendar_mensagem = { data: null, error: { message: 'data_invalida' } };
html = await chat(TODOS, []); await escolhe('amanha'); await click({ chatgo: 'c1' });
check('se o banco recusar, mostra o erro e NÃO apaga o que você escreveu', el('toast').textContent.includes('agendar a mensagem') );
delete rpcResp.crm_agendar_mensagem;

html = await chat(TODOS, [], { agendadas: [{ id: 50, texto: RASC, enviar_em: new Date(agora() + 30 * 3600e3).toISOString(), status: 'pendente', campo: 'certificado_frances', erro: null, enviada_em: null }] });
s = sug();
check('já há uma agendada: a próxima sugestão encadeia 3 dias úteis DEPOIS dela (nunca "agora", para não empilhar)', s.tipo === 'esperar' && s.quando === 'ate' && s.ate.getTime() >= agora() + 30 * 3600e3 + 3 * 86400000 - 86400000 && s.ate.getHours() === 10 && s.ate.getDay() >= 1 && s.ate.getDay() <= 5 && /Já há 1 mensagem agendada/.test(s.motivo) && s.pick.k !== 'certificado_frances');
check('a caixa vem com a pergunta seguinte e o menu já no dia encadeado (um clique para agendar)', el('chat-txt').value.includes('profissão regulamentada') && /<option value="ate" selected>/.test(ctl()) && /data-chatgo="c1">Agendar</.test(ctl()));

console.log('\n== A sequência em um clique ==');
html = await chat(SEQ3, []);
rpcs.length = 0;
await escolhe('seq');
check('"As próximas 3 perguntas": o botão diz quantas mensagens vai agendar', /data-chatgo="c1">Agendar 3 mensagens</.test(ctl()));
await click({ chatgo: 'c1' });
const seq = rpcs.filter((r) => r.n === 'crm_agendar_mensagem');
const datas = mod.pergDatasSequencia(agora(), 3);
check('agenda 3 mensagens, uma por pergunta, nas datas padrão (amanhã 10h, depois de 3 em 3 dias úteis)', seq.length === 3 && seq.every((x, i) => new Date(x.a.p_enviar_em).getTime() === datas[i].getTime()));
check('a 1ª é o texto da caixa; as outras são as próximas perguntas, cada uma com o seu campo', seq[0].a.p_texto === RASC && /profissão regulamentada/.test(seq[1].a.p_texto) && /em que cidade você mora/.test(seq[2].a.p_texto) && seq.every((x) => x.a.p_campo) && new Set(seq.map((x) => x.a.p_campo)).size === 3);
check('todas em dia útil, às 10h', datas.every((d) => d.getDay() >= 1 && d.getDay() <= 5 && d.getHours() === 10));
html = await chat(TODOS, []);
check('com só duas perguntas, a opção de sequência diz 2', /As próximas 2 perguntas/.test(ctl()));
html = await chat(tudo, []);
check('com nenhuma pergunta, sem sequência', !ctl().includes('value="seq"'));

console.log('\n== Enviar agora e a trava ==');
html = await chat(TODOS, []);
rpcs.length = 0; digita('Oi, Ana! Mensagem para agora.');
await click({ chatenviar: 'c1' });
check('"Enviar" (padrão) manda pelo chat com o texto da caixa', rpcs.some((r) => r.n === 'crm_chat_enviar' && r.a.p_texto === 'Oi, Ana! Mensagem para agora.') && mod.state.chatEditado === false);
html = await chat(TODOS, [M('ingryd', 'Pergunta 1', 12), M('ingryd', 'Pergunta 2', 9), M('ingryd', 'Pergunta 3', 6)]);
rpcs.length = 0; win.confirm = () => false; digita('Mais uma.'); await escolhe('amanha');
await click({ chatgo: 'c1' });
check('com a trava ativa, agendar pergunta antes; dizendo não, nada é agendado', !rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
win.confirm = () => true; digita('Mais uma.'); await escolhe('amanha');
await click({ chatgo: 'c1' });
check('confirmando, agenda', rpcs.some((r) => r.n === 'crm_agendar_mensagem'));
delete win.confirm;

console.log('\n== O que já foi perguntado ou agendado não volta ==');
html = await chat(TODOS, [M('ingryd', 'Oi! ' + Q, 5)]);
check('pergunta já feita (o texto está no histórico) sai da fila: a próxima sugerida é outra', sug().pick.k !== 'certificado_frances' && /profissão regulamentada/.test(el('chat-txt').value + html));
const AG = [{ id: 41, texto: RASC, enviar_em: new Date(agora() + 30 * 3600e3).toISOString(), status: 'pendente', campo: 'certificado_frances', erro: null, enviada_em: null }];
html = await chat(TODOS, [], { agendadas: AG });
check('pergunta já agendada também sai da fila (não agenda duas vezes)', sug().pick.k !== 'certificado_frances');
check('"Agendadas para ela (1)" aparece recolhido, com a data e o botão Cancelar', /<details class="chat-ag"><summary class="sub">Agendadas para ela \(1\)/.test(agsHtml()) && agsHtml().includes('agendada ·') && agsHtml().includes('data-pergcancelar="41"'));
rpcs.length = 0; rpcResp.crm_cancelar_mensagem_agendada = { data: true, error: null };
await click({ pergcancelar: '41' });
check('cancelar chama crm_cancelar_mensagem_agendada', rpcs.some((r) => r.n === 'crm_cancelar_mensagem_agendada' && r.a.p_id === 41));
rpcResp.crm_cancelar_mensagem_agendada = { data: false, error: null };
await click({ pergcancelar: '41' });
check('se já tinha saído, avisa em vez de dizer que cancelou', el('toast').textContent.includes('já tinha saído'));
delete rpcResp.crm_cancelar_mensagem_agendada;
html = await chat(TODOS, [], { agendadas: [Object.assign({}, AG[0], { status: 'erro', erro: 'chat 500' }), Object.assign({}, AG[0], { id: 42, status: 'enviada', enviada_em: new Date().toISOString() }), Object.assign({}, AG[0], { id: 43, status: 'cancelada' })] });
check('o que não saiu mostra o motivo; enviadas e canceladas não poluem a tela', agsHtml().includes('não saiu') && agsHtml().includes('chat 500') && !agsHtml().includes('enviada ·') && /Agendadas para ela \(1\)/.test(agsHtml()) && !agsHtml().includes('data-pergcancelar'));
html = await chat(TODOS, [], { semSql: true });
check('SQL não rodado: o menu desliga as datas, avisa o arquivo, e "Enviar agora" segue funcionando', /<option value="amanha" disabled>/.test(ctl()) && ctl().includes('db/crm-mensagens-agendadas.sql') && /<option value="agora" selected>/.test(ctl()) && ctl().includes('data-chatenviar="c1"'));

console.log('\n== As perguntas do Pós-call entram sozinhas ==');
const PC = { cid: 'c1', estado: 'proposta', prop: { id: 41, proposta: { campos: {}, sinais: [], perguntas_dela: [], respostas_dadas: [], itens_candidatos: [], a_conferir: [], mapa_da_call: [],
  perguntas_para_ela: [{ texto: 'Você tem o diploma do ensino médio em PDF ou em papel?', motivo: 'A call não fechou isso.', campo: 'ensino_medio_ano' }, { texto: 'Quando termina o seu contrato de au pair?', motivo: 'Só se falou em 8 meses.' }] } }, vocab: [], cont: [], sel: { campos: {}, sinais: {}, fila: {} }, camadas: {}, carregou: true };
html = await chat(TODOS, [], { pc: PC });
check('a 1ª pergunta do Pós-call vem na frente do catálogo, já na caixa (nenhum passo manual)', sug().pick.k === 'pc0' && el('chat-txt').value.includes('você tem o diploma do ensino médio em PDF ou em papel?'));
check('o campo da pergunta vai junto quando agendar', sug().pick.campo === 'ensino_medio_ano');
rpcs.length = 0; await escolhe('amanha'); await click({ chatgo: 'c1' });
check('agendar a do Pós-call grava o campo dela', rpcs.find((r) => r.n === 'crm_agendar_mensagem').a.p_campo === 'ensino_medio_ano');
html = await chat(TODOS, [M('ingryd', 'Oi! uma pergunta: você tem o diploma do ensino médio em PDF ou em papel?', 2)], { pc: PC });
check('se essa pergunta já foi feita, passa para a seguinte do Pós-call', sug().pick.k === 'pc1');
html = await chat(TODOS, [], { pc: PC });
await escolhe('seq');
check('a sequência mistura as do Pós-call e do catálogo, nesta ordem', /As próximas 3 perguntas/.test(ctl()) && mod.chatSugestao(Object.assign({}, base), agora()).cand.slice(0, 3).map((c) => c.k).join() === 'pc0,pc1,certificado_frances');

console.log('\n== Processo sugerido: recado já escrito ==');
html = await chat(TODOS, [], { tab: 'ficha', procs: [{ id: 5, processo: 'caf', status: 'detectada', sinais: [{ texto: 'x' }], detectada_em: '2026-10-26T10:00:00Z' }, { id: 6, processo: 'outro', status: 'detectada', sinais: [{ texto: 'y' }], detectada_em: '2026-10-26T10:00:00Z' }] });
check('o cartão da CAF já traz o recado escrito (aprovar é um clique)', /<textarea id="proc-msg-5"[^>]*>Vi que você já tem moradia: a CAF pode devolver parte do aluguel\. Vale abrir esse processo no seu checklist\?<\/textarea>/.test(html));
check('processo sem recado sugerido fica vazio, com o placeholder', /<textarea id="proc-msg-6"[^>]*placeholder="Seu recado \(opcional\)"><\/textarea>/.test(html));

console.log('\n== Texto do banco e da IA passa por esc() ==');
mod.setC([Object.assign({}, base, { nome: XSS })]);
html = await chat(TODOS, []);
check('nome com HTML não vira HTML na caixa nem no motivo', !html.includes(XSS) && html.includes('Oi, &lt;img'));
mod.setC([Object.assign({}, base)]);
const PC2 = JSON.parse(JSON.stringify(PC)); PC2.prop.proposta.perguntas_para_ela = [{ texto: XSS + '?', motivo: XSS }];
html = await chat(TODOS, [], { pc: PC2 });
check('pergunta do Pós-call com HTML é escapada', !html.includes(XSS));
mod.setC([Object.assign({}, base)]);

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
