// Carrega o crm.js de verdade em Node, com um navegador e um Supabase de mentira (mesmo preparo de crm-plataforma-abas-ui.test.mjs).
// NÃO testa nada em navegador real. Dados de teste inventados (o repositório é público).
//
// Uso: const { mod, el, click, writes, rpcs, respostas } = await carregarCrm({ store: { crm_ficha_v2: '1' } });
import * as TXMOD from '../../taxonomia.js';
import * as FX from '../../ficha.js';
import * as FH from '../../ficha-html.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');

// opts = { respostas, store, search }. `respostas` é mutável: o teste pode trocar tabelas depois de carregar.
export async function carregarCrm(opts = {}) {
  const els = new Map(), handlers = {};
  const el = (id) => {
    if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      addEventListener() {}, setAttribute() {}, focus() {}, scrollIntoView() {}, matches: () => false, closest: () => null, classList: { add() {}, remove() {}, toggle() {} } });
    return els.get(id);
  };
  const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
  const writes = [], rpcs = [], canais = [];
  const respostas = opts.respostas || {};
  function qb(table) {
    const b = { select: () => b, eq: () => b, or: () => b, is: () => b, in: () => b, neq: () => b, gte: () => b, lte: () => b, order: () => b, limit: () => b,
      maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
      insert: async (row) => { writes.push({ op: 'insert', table, row }); return { error: null }; },
      upsert: async (row) => { writes.push({ op: 'upsert', table, row }); return { error: null }; },
      update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, is(c, v) { f.filtros.push(c + ' is ' + v); return ch; },
        then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
      then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };   // cópia nova a cada busca, como o banco
    return b;
  }
  const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: null }; },
    channel: (nome) => { const ch = { nome, ons: [], on(t, o, cb) { ch.ons.push({ o, cb }); return ch; }, subscribe(cb) { ch.status = cb; return ch; } }; canais.push(ch); return ch; }, removeChannel() {} };
  const store = Object.assign({}, opts.store || {});
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const mod = new Function('supabase', 'ES', 'TX', 'EE', 'EQ', 'FX', 'FH', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
    SRC + '\n;return { state, setC: function (v) { C = v; }, setR: function (v) { R = v; }, setPSUG: function (v) { PSUG = v; }, renderPessoa, fichaClick: (typeof fichaClick === "function" ? fichaClick : null), byC, pararAoVivo, trocaPlatAba };')(
    supabase, {}, TXMOD, { iniciar() {}, depois() {}, campoMudou() {} }, {}, FX, FH, document, { addEventListener() {} }, { href: '', search: opts.search || '' }, localStorage, () => 1, () => {});
  const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
  return { mod, el, click, writes, rpcs, respostas, store, handlers };
}

// Fixture comum: uma pessoa inventada, com ou sem conta no app.
export const hojeISO = () => new Date().toISOString();
export function pessoa(o = {}) { return Object.assign({ id: 'c1', email: 'ana@example.com', nome: 'Ana Souza', estagio: 'lead', urgencia: 'alta', persona: 'au_pair_estudante', user_id: null }, o); }
