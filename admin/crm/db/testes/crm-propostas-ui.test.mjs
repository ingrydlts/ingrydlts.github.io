// Testa a parte do CRM que mostra e cria propostas (aba Plataforma da ficha), rodando o crm.js de verdade em Node
// com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (layout, clique de verdade).
//
// Uso: cd admin/crm/db/testes && node crm-propostas-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^boot\(\)\.catch.*$/m, '');   // não sobe o CRM: só carrega as funções

// --- navegador de mentira
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null };
const inserts = [];
function qb(table, res) {
  const b = { select: () => b, eq: () => b, or: () => b, order: () => b, limit: () => b, maybeSingle: async () => ({ data: null, error: null }),
    insert: async (row) => { inserts.push({ table, row }); return { error: null }; },
    then: (ok, ko) => Promise.resolve(res[table] || { data: [], error: null }).then(ok, ko) };
  return b;
}
let respostas = {};
const supabase = { from: (t) => qb(t, respostas), auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: [], error: null }) };

const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'toast_', 'console_',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, TYPE_META, propostaEstado };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem() { return null; }, setItem() {} });

const ana = { id: 'c1', email: 'ana@example.com', nome: 'Ana', estagio: 'em_uso', urgencia: 'baixa', persona: 'pvt' };
mod.setC([ana]);
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
const XSS = '<img src=x onerror=alert(1)>';

async function aba() {
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'plataforma';
  await mod.renderPessoa();
  return el('pessoa-page').innerHTML;
}

console.log('== Linha do tempo (eventText) ==');
for (const [tipo, re] of [['proposta_enviada', /Proposta enviada: Oi/], ['proposta_vista', /Viu a proposta: Oi/], ['proposta_aceita', /Aceitou a proposta: Oi/],
  ['proposta_recusada', /Recusou a proposta: Oi/], ['proposta_adiada', /para depois: Oi/]]) {
  const t = mod.eventText({ tipo, dados: { titulo: 'Oi' } });
  check(tipo + ' tem texto e categoria com rótulo', re.test(t[1]) && !!mod.TYPE_META[t[0]]);
}

console.log('\n== Aba Plataforma: propostas ==');
respostas = { propostas: { data: [
  { id: 1, titulo: XSS, texto: XSS, prazo: null, status: 'enviada', adiada_ate: null, criado_em: dia(-1), visto_em: null, respondido_em: null },
  { id: 2, titulo: 'B', texto: 't', prazo: null, status: 'aceita', adiada_ate: null, criado_em: dia(-2), visto_em: dia(-2), respondido_em: dia(-2) },
  { id: 3, titulo: 'C', texto: 't', prazo: null, status: 'recusada', adiada_ate: null, criado_em: dia(-3), visto_em: dia(-3), respondido_em: dia(-3) },
  { id: 4, titulo: 'D', texto: 't', prazo: null, status: 'vista', adiada_ate: dia(2), criado_em: dia(-4), visto_em: dia(-4), respondido_em: null },
  { id: 5, titulo: 'E', texto: 't', prazo: dia(-1), status: 'vista', adiada_ate: null, criado_em: dia(-5), visto_em: dia(-5), respondido_em: null },
], error: null } };
let html = await aba();
check('mostra o botão Nova proposta', /data-openproposta="c1"/.test(html));
check('texto do banco passa por esc() (título e texto)', !html.includes(XSS) && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
for (const rot of ['Enviada', 'Aceita', 'Recusada', 'Para depois', 'Expirou']) check('estado "' + rot + '" aparece', html.includes('>' + rot + '<'));
check('a vencida vira Expirou e não Vista', !/>Vista</.test(html));

respostas = { propostas: { data: [], error: null } };
html = await aba();
check('sem propostas: mensagem vazia', /Nenhuma proposta enviada ainda/.test(html));

respostas = { propostas: { data: null, error: { message: 'relation "propostas" does not exist' } } };
html = await aba();
check('sem o SQL rodado: avisa qual arquivo falta, sem quebrar a aba', /crm-propostas\.sql/.test(html) && /data-opensinal/.test(html));

console.log('\n== Modal e envio ==');
const click = async (id, ds = {}) => {
  const btn = { id, dataset: ds, disabled: false, matches: () => false };
  await handlers.click[0]({ target: { id, closest: () => btn } });
  return btn;
};
await click('', { openproposta: 'c1' });
const modal = el('compose-modal').innerHTML;
check('modal abre com título, texto, link, rótulo e prazo', ['prop-titulo', 'prop-texto', 'prop-link', 'prop-rotulo', 'prop-prazo', 'proposta-send'].every((i) => modal.includes('id="' + i + '"')));

const setF = (t, x, l, r, d) => { el('prop-titulo').value = t; el('prop-texto').value = x; el('prop-link').value = l; el('prop-rotulo').value = r; el('prop-prazo').value = d; };
setF('', 'x', '', '', ''); await click('proposta-send');
check('título vazio não envia', inserts.length === 0);
setF('T', 'x', 'http://inseguro.com', '', ''); await click('proposta-send');
check('link http não envia', inserts.length === 0);
setF('T', 'x', 'javascript:alert(1)', '', ''); await click('proposta-send');
check('link javascript: não envia', inserts.length === 0);
setF('  Quer um 1:1?  ', ' Quinta às 10h. ', 'https://exemplo.com/h', 'Ver horários', '2030-01-31'); await click('proposta-send');
const ins = inserts[0];
check('envia para a tabela propostas, da pessoa certa', ins && ins.table === 'propostas' && ins.row.contato_id === 'c1');
check('apara espaços e guarda link e rótulo', ins && ins.row.titulo === 'Quer um 1:1?' && ins.row.texto === 'Quinta às 10h.' && ins.row.link === 'https://exemplo.com/h' && ins.row.link_rotulo === 'Ver horários');
check('"vale até" vira o fim daquele dia', ins && new Date(ins.row.prazo).getTime() >= new Date('2030-01-31T23:59:00').getTime() && new Date(ins.row.prazo).getTime() <= new Date('2030-01-31T23:59:59').getTime());
setF('T2', 'x', '', 'rótulo sem link', ''); await click('proposta-send');
check('sem link, o rótulo é descartado e sem prazo vai null', inserts[1].row.link === null && inserts[1].row.link_rotulo === null && inserts[1].row.prazo === null);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
