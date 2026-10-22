// Testa o chat com ela na aba Plataforma da ficha (no lugar dos sinais), rodando o crm.js de verdade em Node com um
// navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual, Realtime de verdade).
//
// Uso: cd admin/crm/db/testes && node crm-chat-ui.test.mjs
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
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, pararAoVivo };')(
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
async function pagina(tab) { mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = tab; await mod.renderPessoa(); return el('pessoa-page').innerHTML; }
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
const clickId = async (id) => { const b = { id, dataset: {}, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id, closest: () => b } }); return b; };

console.log('== No lugar dos sinais ==');
fixture([M(1, 'ingryd', 'Oi, Ana!')]);
let html = await pagina('plataforma');
check('a aba Plataforma tem o chat', html.includes('Chat com ela') && html.includes('id="chat-box"') && html.includes('id="chat-fio"'));
check('não há mais sinais em lugar nenhum da ficha', !/Enviar sinal|data-opensinal|>Sinais</.test(html));
for (const tab of ['conversa', 'ficha']) check('aba ' + tab + ' também sem o botão de sinal', !/Enviar sinal|data-opensinal/.test(await pagina(tab)));
fixture([]);
html = await pagina('plataforma');
check('sem mensagens: convida a escrever', /Nenhuma mensagem ainda/.test(html));
respostas.chat_mensagens = { data: null, error: { message: 'relation "chat_mensagens" does not exist' } };
html = await pagina('plataforma');
check('sem o SQL: avisa o arquivo e a aba segue', /crm-chat\.sql/.test(html) && html.includes('role="tablist"'));

console.log('\n== A conversa ==');
fixture([
  M(1, 'ingryd', 'Oi, Ana!', { lida_em: ago(-60) }),
  M(2, 'pessoa', 'Quero um 1:1 de 20 minutos.', { acao: 'pedido_1a1', lida_em: null }),
  M(3, 'ingryd', 'Claro!', { lida_em: null }),
  M(4, 'ingryd', 'Um 1:1 de 20 minutos?', { tipo: 'proposta', proposta_id: 9 }),
  M(5, 'pessoa', XSS, { lida_em: null })],
  [P(9, { status: 'aceita', respondido_em: ago(-10), prazo: ago(1000) })]);
html = await pagina('plataforma');
check('mensagens dela e suas, cada uma de um lado', /class="cm eu">Oi, Ana!/.test(html) && /class="cm ela nova">[\s\S]*?Quero um 1:1/.test(html));
check('pedido rápido dela vira etiqueta', html.includes('Pediu um 1:1 de 20 min'));
check('o que você mandou mostra lida ou não lida', html.includes('· lida') && html.includes('· ainda não lida'));
check('proposta aparece como cartão, com o estado', html.includes('Proposta: Um 1:1 de 20 minutos?') && html.includes('>Aceita<'));
check('proposta aceita mostra a ação combinada', html.includes('Ela disse sim. Combinado: Te mando o link por e-mail.'));
check('texto do banco passa por esc()', !html.includes(XSS) && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
check('mensagens dela por ler: contador no título e destaque', /Chat com ela <span class="count">2 novas<\/span>/.test(html) && (html.match(/class="cm ela nova"/g) || []).length === 2);
check('em outra aba, o chip do dossiê avisa', /<b>Chat<\/b> 2 mensagens dela sem ler/.test(await pagina('ficha')));
writes.length = 0;
await pagina('plataforma');
const ml = writes.find((w) => w.table === 'chat_mensagens' && w.op === 'update');
check('ao ver o chat, marca as dela como lidas (só as dela, só as não lidas)', ml && !!ml.row.lida_em && ml.filtros.includes('contato_id=c1') && ml.filtros.includes('de=pessoa') && ml.filtros.includes('lida_em is null'));
fixture([M(1, 'pessoa', 'Já lida')]);
writes.length = 0; await pagina('plataforma');
check('sem mensagens por ler, não escreve nada', !writes.some((w) => w.table === 'chat_mensagens'));
fixture([M(1, 'ingryd', 'Proposta', { tipo: 'proposta', proposta_id: 1 })], [P(1, { status: 'vista', prazo: ago(-60) }), ]);
check('proposta vencida aparece como Expirou', (await pagina('plataforma')).includes('>Expirou<'));
fixture([M(1, 'ingryd', 'P', { tipo: 'proposta', proposta_id: 1 })], [P(1, { status: 'vista', adiada_ate: ago(3000) })]);
check('proposta adiada aparece como Para depois', (await pagina('plataforma')).includes('>Para depois<'));

console.log('\n== Enviar ==');
fixture([M(1, 'ingryd', 'Oi')]);
await pagina('plataforma');
el('chat-txt').value = '   ';
await click({ chatenviar: 'c1' });
check('mensagem vazia não envia', rpcs.length === 0);
el('chat-txt').value = '  Como está o seu processo?  ';
await click({ chatenviar: 'c1' });
const env = rpcs.find((r) => r.n === 'crm_chat_enviar');
check('envia por crm_chat_enviar, aparada, para a pessoa certa', env && env.a.p_contato === 'c1' && env.a.p_texto === 'Como está o seu processo?' && !('p_proposta' in env.a));
check('limpa a caixa depois de enviar', el('chat-txt').value === '');
rpcErro = { message: 'sem_permissao' }; el('chat-txt').value = 'tenta'; el('toast').textContent = '';
await click({ chatenviar: 'c1' });
check('erro do banco: avisa e NÃO apaga o que você escreveu', /Não consegui enviar a mensagem/.test(el('toast').textContent) && el('chat-txt').value === 'tenta');
rpcErro = null;

console.log('\n== Botões de ação ==');
await pagina('plataforma');
html = el('pessoa-page').innerHTML;
check('os botões estão no chat', ['um_a_um', 'como_vai', 'documentos', 'prazo', 'proposta'].every((k) => html.includes('data-chatquick="' + k + '"')));
await click({ chatquick: 'um_a_um' });
let modal = el('compose-modal').innerHTML;
check('"Propor 1:1 de 20 min" abre a proposta já pronta', /id="prop-titulo"[^>]*value="Um 1:1 de 20 minutos\?"/.test(modal) && modal.includes('Que tal conversarmos 20 minutos') && modal.includes('Ótimo! Te mando os horários disponíveis aqui no chat.'));
await click({ chatquick: 'proposta' });
modal = el('compose-modal').innerHTML;
check('"Nova proposta" abre em branco', /id="prop-titulo"[^>]*value=""/.test(modal) && !modal.includes('Que tal conversarmos'));
el('chat-txt').value = '';
const antesEnv = rpcs.filter((r) => r.n === 'crm_chat_enviar').length;
await click({ chatquick: 'como_vai' });
check('"Perguntar como está" preenche a caixa com o primeiro nome, sem enviar', /^Oi, Ana! Passando para saber como está/.test(el('chat-txt').value) && rpcs.filter((r) => r.n === 'crm_chat_enviar').length === antesEnv);
await click({ chatquick: 'documentos' });
check('"Pedir documentos" preenche a caixa', /documentação/.test(el('chat-txt').value));
await click({ chatquick: 'prazo' });
check('"Lembrar do prazo" sem checklist usa o texto geral', /ficar de olho nos prazos/.test(el('chat-txt').value));
respostas.checklist_items = { data: [{ step_key: 'a', category: 'x', label: 'Cadastro na Ameli', status: 'pendente', due_date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), sort_order: 1, updated_at: ago(-5) }], error: null };
await pagina('plataforma'); await click({ chatquick: 'prazo' });
check('"Lembrar do prazo" com checklist cita o próximo item e a data', /Cadastro na Ameli" tem prazo em \d\d\/\d\d\/\d{4}/.test(el('chat-txt').value));

console.log('\n== Proposta pelo chat ==');
await click({ chatquick: 'proposta' });
const set = (t, x, sim, l, r, d) => { el('prop-titulo').value = t; el('prop-texto').value = x; el('prop-sim').value = sim; el('prop-link').value = l; el('prop-rotulo').value = r; el('prop-prazo').value = d; };
rpcs.length = 0;
set('', 'x', '', '', '', ''); await clickId('proposta-send');
check('sem título não envia', rpcs.length === 0);
set('T', 'x', '', 'http://inseguro.com', '', ''); await clickId('proposta-send');
set('T', 'x', '', 'javascript:alert(1)', '', ''); await clickId('proposta-send');
check('link http ou javascript: não envia', rpcs.length === 0);
set('  Um 1:1?  ', ' Quinta às 10h. ', ' Te mando o link. ', 'https://exemplo.com/h', 'Ver horários', '2030-01-31');
await clickId('proposta-send');
const pr = rpcs.find((r) => r.n === 'crm_chat_enviar');
check('envia a proposta por crm_chat_enviar, com tudo aparado', pr && pr.a.p_contato === 'c1' && pr.a.p_proposta.titulo === 'Um 1:1?' && pr.a.p_proposta.texto === 'Quinta às 10h.' && pr.a.p_proposta.acao_sim === 'Te mando o link.' && pr.a.p_proposta.link === 'https://exemplo.com/h' && pr.a.p_proposta.link_rotulo === 'Ver horários');
check('"vale até" vira o fim daquele dia', pr && new Date(pr.a.p_proposta.prazo).getTime() >= new Date('2030-01-31T23:59:00').getTime() && new Date(pr.a.p_proposta.prazo).getTime() <= new Date('2030-01-31T23:59:59').getTime());
await click({ chatquick: 'proposta' });
set('T2', 'x', '', '', 'rótulo sem link', ''); await clickId('proposta-send');
const p2 = rpcs.filter((r) => r.n === 'crm_chat_enviar')[1];
check('sem link o rótulo é descartado; sem prazo e sem ação vão null', p2.a.p_proposta.link === null && p2.a.p_proposta.link_rotulo === null && p2.a.p_proposta.prazo === null && p2.a.p_proposta.acao_sim === null);

console.log('\n== Ao vivo ==');
mod.pararAoVivo(); canais.length = 0;
fixture([M(1, 'ingryd', 'Oi, Ana!')]);
await pagina('plataforma');
const ch = canais[canais.length - 1];
el('chat-txt').value = 'rascunho que não pode sumir';
fixture([M(1, 'ingryd', 'Oi, Ana!'), M(2, 'pessoa', 'Posso marcar o 1:1?', { acao: 'pedido_1a1', lida_em: null })]);
el('toast').textContent = '';
ch.ons.find((x) => x.o.table === 'chat_mensagens').cb({ eventType: 'INSERT' });
await wait(900);
check('chegou mensagem dela: o fio se atualiza sozinho', el('chat-fio').innerHTML.includes('Posso marcar o 1:1?') && el('chat-fio').innerHTML.includes('Pediu um 1:1 de 20 min'));
check('avisa quem escreveu e o começo da mensagem', el('toast').textContent === 'Ana Souza escreveu no chat: Posso marcar o 1:1?');
check('o que você estava digitando continua lá', el('chat-txt').value === 'rascunho que não pode sumir');
check('com a aba aberta, já marca como lida', writes.some((w) => w.table === 'chat_mensagens' && w.op === 'update' && w.filtros.includes('de=pessoa')));
fixture([M(1, 'ingryd', 'Oi, Ana!', { lida_em: ago(0) }), M(2, 'pessoa', 'Posso marcar o 1:1?', { acao: 'pedido_1a1' })]);
el('toast').textContent = '';
ch.ons.find((x) => x.o.table === 'chat_mensagens').cb({}); await wait(900);
check('ela leu a sua mensagem: sem aviso novo, e o estado muda para lida', el('toast').textContent === '' || !/escreveu/.test(el('toast').textContent));
fixture([M(1, 'ingryd', 'P', { tipo: 'proposta', proposta_id: 5 })], [P(5, { status: 'aceita', respondido_em: ago(0) })]);
ch.ons.find((x) => x.o.table === 'propostas').cb({}); await wait(900);
check('ela respondeu a proposta: o cartão muda de estado ao vivo', el('chat-fio').innerHTML.includes('>Aceita<') && el('chat-fio').innerHTML.includes('Ela disse sim'));

console.log('\n== Linha do tempo ==');
const t = mod.eventText({ tipo: 'chat_mensagem', dados: { trecho: 'Quero marcar', acao: 'pedido_1a1' } });
check('chat_mensagem diz o que ela escreveu e o pedido', t[0] === 'resposta' && /pediu um 1:1 de 20 min/.test(t[1]) && /Quero marcar/.test(t[1]));
for (const [tipo, re] of [['proposta_enviada', /Proposta enviada: Oi/], ['proposta_aceita', /Aceitou a proposta: Oi/], ['proposta_recusada', /Recusou a proposta: Oi/], ['proposta_adiada', /para depois: Oi/], ['proposta_vista', /Viu a proposta: Oi/]])
  check(tipo + ' tem texto', re.test(mod.eventText({ tipo, dados: { titulo: 'Oi' } })[1]));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
