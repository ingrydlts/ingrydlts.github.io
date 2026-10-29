// Testa a aba "Problemas" da Caixa de entrada (avisos que a cliente manda pelo botão do app, tabela problemas_app do repositório
// do app), rodando o crm.js de verdade em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real.
//
// Uso: cd admin/crm/db/testes && node crm-problemas-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', scrollTop: 0, scrollHeight: 0, clientHeight: 0, addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
const writes = [];
let respostas = {};
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => ({ data: null, error: null }),
    update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, setP: function (v, e) { P = v; PERR = e ? e : String(); }, renderQuestions, loadAll, getP: function () { return P; }, getPERR: function () { return PERR; } };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const XSS = '<img src=x onerror=alert(1)>';
const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };

mod.setC([{ id: 'c1', user_id: 'u1', email: 'ana@example.com', nome: 'Ana Souza', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante' }]);
const AV = (id, o = {}) => Object.assign({ id, user_id: 'u1', categoria: 'nao_funciona', texto: 'O botão Concluído não marca', tela: '/dashboard/', status: 'novo', criado_em: ago(2),
  contexto: { ambiente: 'producao', navegador: 'Safari 17', tela: '380x760', online: true, erros: [{ msg: 'TypeError: x is undefined', arquivo: '/assets/js/home.js', linha: 12 }] } }, o);

console.log('== A aba Problemas ==');
mod.state.inbox = 'problemas';
mod.setP([AV(1), AV(2, { user_id: 'u-sem-ficha', texto: XSS, categoria: 'outro', contexto: { erros: [{ msg: XSS }] } }), AV(3, { status: 'resolvido', texto: 'Já resolvido' })]);
mod.renderQuestions();
check('contador de novos na aba (2) e no menu', el('c-ib-problemas').textContent === 2 && el('c-ib-problemas').hidden === false);
check('duas sub-abas com a contagem: Novos 2 e Resolvidos 1', /Novos <span class="num">2<\/span>/.test(el('qtabs').innerHTML) && /Resolvidos <span class="num">1<\/span>/.test(el('qtabs').innerHTML));
check('lista só os novos, o mais antigo primeiro', (el('qitems').innerHTML.match(/data-p="/g) || []).length === 2 && !el('qitems').innerHTML.includes('Já resolvido'));
check('mostra quem é (pela ficha) e a categoria', el('qitems').innerHTML.includes('Ana') && el('qitems').innerHTML.includes('Algo não funciona'));
check('conta sem ficha vira "Conta sem ficha"', el('qitems').innerHTML.includes('Conta sem ficha'));
check('nada do texto da cliente entra como HTML', !el('qitems').innerHTML.includes('<img') && !el('qdetail').innerHTML.includes('<img'));
check('o detalhe abre no primeiro: texto, tela, navegador, tamanho e erro da página', el('qdetail').innerHTML.includes('O botão Concluído não marca') && el('qdetail').innerHTML.includes('Safari 17')
  && el('qdetail').innerHTML.includes('380x760') && el('qdetail').innerHTML.includes('TypeError: x is undefined') && el('qdetail').innerHTML.includes('/assets/js/home.js'));
check('tem "Abrir ficha" e o botão de resolver', el('qdetail').innerHTML.includes('data-open="c1"') && el('qdetail').innerHTML.includes('data-pstatus="resolvido"'));

await click({ p: '2' });
check('escolher outro aviso troca o detalhe (conta sem ficha: sem "Abrir ficha", texto escapado)', el('qdetail').innerHTML.includes('Conta sem ficha no CRM') && !el('qdetail').innerHTML.includes('data-open=') && el('qdetail').innerHTML.includes('&lt;img'));

console.log('\n== Resolver e reabrir ==');
await click({ p: '1' });
respostas = { crm_contatos: { data: [], error: null }, problemas_app: { data: [AV(1, { status: 'resolvido' }), AV(2), AV(3, { status: 'resolvido' })], error: null } };
await click({ pstatus: 'resolvido' });
const u = writes[writes.length - 1];
check('marca no banco: status resolvido, hora, só aquele aviso', u && u.table === 'problemas_app' && u.row.status === 'resolvido' && !!u.row.resolvido_em && u.filtros.join() === 'id=1');
check('recarrega e o aviso sai dos novos', mod.getP().filter((x) => x.status === 'novo').length === 1);
await click({ ps: 'resolvido' });
check('aba Resolvidos mostra os dois resolvidos', (el('qitems').innerHTML.match(/data-p="/g) || []).length === 2 && el('qdetail').innerHTML.includes('data-pstatus="novo"'));
await click({ pstatus: 'novo' });
const v = writes[writes.length - 1];
check('voltar para novos zera a hora de resolvido', v.row.status === 'novo' && v.row.resolvido_em === null);

console.log('\n== Sem o SQL, e sem avisos ==');
mod.state.ps = 'novo'; mod.setP([], 'Falta rodar db/problemas-app.sql');
mod.renderQuestions();
check('sem a tabela, a aba avisa o que rodar e não quebra', el('qitems').innerHTML.includes('Falta rodar db/problemas-app.sql') && el('qdetail').innerHTML.includes('SQL estiver rodado'));
mod.setP([]); mod.renderQuestions();
check('sem avisos: estado vazio com texto', el('qitems').innerHTML.includes('Nenhum aviso novo') && el('qdetail').innerHTML.includes('Quando uma cliente avisar'));
respostas = { crm_contatos: { data: [{ id: 'c1' }], error: null }, problemas_app: { data: null, error: { message: 'relation "problemas_app" does not exist' } } };
await mod.loadAll();
check('loadAll com a tabela faltando: lista vazia e o aviso certo, sem derrubar o resto', mod.getP().length === 0 && /problemas-app\.sql/.test(mod.getPERR()));

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
