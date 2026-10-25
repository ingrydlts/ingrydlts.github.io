// Testa a tela "Sites úteis" do CRM (árvore persona → etapa → link, formulário, exclusão), rodando o crm.js de verdade em
// Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual).
//
// Uso: cd admin/crm/db/testes && node crm-sites-ui.test.mjs
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
const writes = [];
let respostas = {};
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
    single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }),
    insert: (row) => { writes.push({ op: 'insert', table, row }); return Promise.resolve({ error: null }); },
    update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, loadAll, renderSites, getSU: function () { return SU; } };')(
  supabase, {}, document, { addEventListener() {}, confirm: () => true, scrollTo() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const click = async (ds, id = '') => { const b = { id, dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id, closest: () => b } }); return b; };
const site = (id, o = {}) => Object.assign({ id, persona: 'au_pair_estudante', ramo: 'geral', titulo: 'ANEF', descricao: 'Mudança de statut.', url: 'https://administration-etrangers-en-france.interieur.gouv.fr', ordem: 10 }, o);
const XSS = '<img src=x onerror=alert(1)>';

console.log('== Sem o SQL rodado ==');
respostas = { crm_contatos: { data: [], error: null }, sites_uteis: { data: null, error: { message: 'relation "sites_uteis" does not exist' } } };
await mod.loadAll();
check('sem a tabela, os sites ficam desligados (null) e o resto do CRM segue', mod.getSU() === null);
mod.renderSites();
check('a tela avisa qual arquivo rodar', /crm-sites\.sql/.test(el('sites-grid').innerHTML));
await click({ sitesnovo: 'geral' });
check('"Novo link" sem o SQL só avisa', /Rode o crm-sites\.sql/.test(el('toast').textContent));

console.log('\n== Com links ==');
respostas = { crm_contatos: { data: [], error: null }, sites_uteis: { data: [
  site(1), site(2, { ramo: 'saindo_do_au_pair', titulo: 'France-Visas ' + XSS, url: 'https://france-visas.gouv.fr' }),
  site(3, { titulo: 'Perigoso', url: 'javascript:alert(1)' }), site(4, { persona: 'pvt', titulo: 'Ameli' })], error: null } };
await mod.loadAll();
mod.renderSites();
const html = el('sites-grid').innerHTML;
check('mostra uma coluna por etapa da persona', /Todas da persona/.test(html) && /Saindo do regime de au pair/.test(html) && /Renovando como au pair/.test(html));
check('só os links da persona escolhida aparecem', /ANEF/.test(html) && !/Ameli/.test(html));
check('o texto vindo do banco é escapado', !html.includes(XSS) && /&lt;img/.test(html));
check('link que não é https não vira <a>', !/href="javascript/.test(html));
check('cada link tem botão de excluir', (html.match(/data-sitesexcluir=/g) || []).length === 3);
check('cada etapa tem + Adicionar link', (html.match(/data-sitesnovo=/g) || []).length === 3);

await click({ sitespersona: 'pvt' });
check('trocar de persona mostra a árvore dela, só com a etapa geral', /Ameli/.test(el('sites-grid').innerHTML) && !/Saindo do regime/.test(el('sites-grid').innerHTML));
await click({ sitespersona: 'au_pair_estudante' });

console.log('\n== Adicionar e excluir ==');
await click({ sitesnovo: 'saindo_do_au_pair' });
check('o formulário abre na etapa clicada', /value="saindo_do_au_pair" selected/.test(readFormHtml()));
function readFormHtml() { return el('compose-modal').innerHTML; }
el('su-ramo').value = 'saindo_do_au_pair'; el('su-titulo').value = 'Campus France'; el('su-descricao').value = ''; el('su-url').value = 'http://inseguro.example';
await click({}, 'sites-salvar');
check('link sem https é recusado e nada é gravado', /https:\/\//.test(el('toast').textContent) && !writes.length);
el('su-url').value = 'https://www.campusfrance.org';
await click({}, 'sites-salvar');
const w = writes[0];
check('grava na persona e etapa certas, com ordem depois do último da etapa',
  w && w.table === 'sites_uteis' && w.row.persona === 'au_pair_estudante' && w.row.ramo === 'saindo_do_au_pair' && w.row.url === 'https://www.campusfrance.org' && w.row.ordem === 20 && w.row.descricao === null);
writes.length = 0;
await click({ sitesexcluir: '1' });
const x = writes[0];
check('excluir arquiva (não apaga) o link certo', x && x.op === 'update' && x.table === 'sites_uteis' && x.filtros.includes('id=1') && !!x.row.arquivado_em);

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
