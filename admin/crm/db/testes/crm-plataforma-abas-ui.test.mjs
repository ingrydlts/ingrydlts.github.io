// Testa as sub-abas da aba Plataforma (iAssistente, Chat, Interações por dia), rodando o crm.js de verdade em Node com um
// navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual, Realtime de verdade).
//
// Uso: cd admin/crm/db/testes && node crm-plataforma-abas-ui.test.mjs
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
const writes = [], rpcs = [], canais = [];
let respostas = {}, rpcErro = null;
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, is: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
    insert: async (row) => { writes.push({ op: 'insert', table, row }); return { error: null }; },
    update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, is(c, v) { f.filtros.push(c + ' is ' + v); return ch; },
      then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };   // cópia nova a cada busca, como o banco
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: rpcErro }; },
  channel: (nome) => { const ch = { nome, ons: [], on(t, o, cb) { ch.ons.push({ o, cb }); return ch; }, subscribe(cb) { ch.status = cb; return ch; } }; canais.push(ch); return ch; }, removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, pararAoVivo, trocaPlatAba };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Souza', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante' };
mod.setC([Object.assign({}, base)]);
const XSS = '<img src=x onerror=alert(1)>';
const ago = (min) => new Date(Date.now() + min * 60e3).toISOString();
const M = (id, de, texto, o = {}) => Object.assign({ id, de, tipo: 'texto', texto, acao: null, proposta_id: null, criado_em: ago(-100 + id), lida_em: de === 'ingryd' ? ago(-1) : ago(-1) }, o);
const P = (id, o = {}) => Object.assign({ id, titulo: 'Um 1:1 de 20 minutos?', texto: 'Quinta às 10h.', acao_sim: 'Te mando o link por e-mail.', prazo: null, status: 'enviada', adiada_ate: null, criado_em: ago(-50), visto_em: null, respondido_em: null }, o);
function fixture(msgs, props) {
  respostas = { 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, chat_mensagens: { data: msgs.slice().reverse(), error: null }, propostas: { data: props || [], error: null },
    checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null } };
}
async function pagina(tab) { mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = tab; mod.state.pstab = 'chat'; /* o chat é a sub-aba Chat da Plataforma */ await mod.renderPessoa(); return el('pessoa-page').innerHTML; }
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
const clickId = async (id) => { const b = { id, dataset: {}, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id, closest: () => b } }); return b; };


const hoje = new Date().toISOString(), ontem = new Date(Date.now() - 86400e3).toISOString();
respostas = { 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, chat_mensagens: { data: [], error: null }, propostas: { data: [], error: null },
  checklist_items: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null },
  plataforma_cliques: { data: [
    { sessao: 's', tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Marcou como concluído: Abrir conta', criado_em: hoje },
    { sessao: 's', tela: '/perfil/', alvo: 'tela', rotulo: '/perfil/', criado_em: hoje },
    { sessao: 's', tela: '/dashboard/#home', alvo: 'tela', rotulo: '/dashboard/#home', criado_em: ontem }], error: null },
  eventos: { data: [{ tipo: 'dossie_atualizado', dados: { campos: 2 }, criado_em: hoje }], error: null } };
mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'plataforma'; mod.state.pstab = 'assistente';
await mod.renderPessoa();
let html = el('pessoa-page').innerHTML;
console.log('== Sub-abas ==');
check('três sub-abas', ['assistente', 'chat', 'interacoes'].every((k) => html.includes('data-pstab="' + k + '"')));
check('abre na iAssistente, sem o chat nem as interações', html.includes('id="ins-box"') && !html.includes('id="chat-box"') && !html.includes('id="int-box"'));
check('coluna fixa: pagamento, checklist e resumo', html.includes('plat-fixa') && html.includes('id="chk-lateral"') && html.includes('id="resumo-lateral"'));
mod.trocaPlatAba('interacoes');
check('Interações: um dropdown por dia', (el('plat-conteudo').innerHTML.match(/<details class="dcat intdia"/g) || []).length === 2);
check('só o dia mais recente abre', (el('plat-conteudo').innerHTML.match(/intdia" data-dia="[^"]*" open/g) || []).length === 1);
check('conta checklist e dossiê do dia', /<b>Checklist<\/b> 1/.test(el('plat-conteudo').innerHTML) && /<b>Dossiê<\/b> 2/.test(el('plat-conteudo').innerHTML));
check('marcação do checklist e salvamento do dossiê aparecem', el('plat-conteudo').innerHTML.includes('Abrir conta') && el('plat-conteudo').innerHTML.includes('Você atualizou o dossiê (2 campos)'));
check('o resumo da coluna fixa soma as interações', /Interações no checklist<\/dt><dd>1/.test(el('resumo-lateral').innerHTML) && /Interações no dossiê<\/dt><dd>2/.test(el('resumo-lateral').innerHTML));
mod.trocaPlatAba('chat');
check('Chat: troca o miolo e mantém a coluna da direita', el('plat-conteudo').innerHTML.includes('id="chat-fio"') && el('resumo-lateral').innerHTML.includes('Resumo'));
mod.pararAoVivo();
console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
