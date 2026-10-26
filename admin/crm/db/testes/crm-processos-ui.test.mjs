// Testa os processos sugeridos no CRM (a notificação na ficha, a lista "Processos para revisar" em Hoje e os botões
// Aprovar/Descartar), rodando o crm.js de verdade em Node com um navegador e um Supabase de mentira. Mesmo arranjo de
// crm-radar-ui.test.mjs. NÃO testa nada em navegador real (visual).
//
// Uso: cd admin/crm/db/testes && node crm-processos-ui.test.mjs
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
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, loadAll, renderToday, processosSugeridosHtml, getPSUG: function () { return PSUG; } };')(
  supabase, {}, document, { addEventListener() {}, confirm: () => true, scrollTo() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const pessoa = (id, nome, persona, extra = {}) => Object.assign({ id, email: id + '@example.com', nome, persona, user_id: 'u-' + id, estagio: 'em_uso', urgencia: 'baixa' }, extra);
const XSS = '<img src=x onerror=alert(1)>';
const GENTE = [pessoa('a', 'Ana Souza', 'campus_france'), pessoa('b', 'Bia Lima', 'campus_france'), pessoa('c', 'Cris Dias', 'campus_france', { user_id: null, estagio: 'lead' }),
  pessoa('d', 'Dani Reis', 'campus_france', { estagio: 'inativo' }), pessoa('e', 'Eva Costa', 'au_pair_estudante')];
mod.setC(GENTE);
const item = (id, o = {}) => Object.assign({ id, persona: 'campus_france', fator: 'economico', titulo: 'Recursos mínimos subiram', texto: 'O visto exige 877,50 €/mês.', impacto: 'Refaça a conta.', acao: 'Atualize a prova de recursos.',
  fonte_rotulo: 'Decreto 2026-526', fonte_url: 'https://www.legifrance.gouv.fr/', verificado_em: '2026-10-16', vigente_ate: null, origem: 'manual', avisado_em: null }, o);
const click = async (ds, id = '') => { const b = { id, dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id, closest: () => b } }); return b; };

console.log('== Sem o SQL rodado ==');
respostas = { crm_contatos: { data: GENTE, error: null }, processos_sugeridos: { data: null, error: { message: 'relation "processos_sugeridos" does not exist' } } };
await mod.loadAll(); mod.renderToday();
check('sem a tabela, nada aparece e o resto segue', mod.getPSUG().length === 0 && el('today-procs-box').hidden === true);
check('ficha sem sugestão não ganha bloco', mod.processosSugeridosHtml([]) === '' && mod.processosSugeridosHtml(null) === '');

console.log('\n== Hoje: Processos para revisar ==');
respostas = { crm_contatos: { data: GENTE, error: null }, processos_sugeridos: { data: [{ id: 5, contato_id: 'e', processo: 'caf', atualizada_em: '2026-10-26T10:00:00Z' }, { id: 6, contato_id: 'sumiu', processo: 'caf', atualizada_em: '2026-10-26T10:00:00Z' }], error: null } };
await mod.loadAll(); mod.renderToday();
check('o painel aparece com quem tem sugestão', el('today-procs-box').hidden === false && /Possível novo processo: CAF/.test(el('today-procs').innerHTML) && /data-open="e"/.test(el('today-procs').innerHTML));
check('sugestão de ficha que não está na lista não aparece', !/sumiu/.test(el('today-procs').innerHTML));

console.log('\n== A notificação na ficha ==');
const sug = (o) => Object.assign({ id: 5, processo: 'caf', status: 'detectada', mensagem: null, sinais: [{ codigo: 'x', texto: 'Respondeu que a moradia já está resolvida.' }], detectada_em: '2026-10-25T10:00:00Z', decidida_em: '2026-10-26T10:00:00Z', respondida_em: '2026-10-27T10:00:00Z' }, o);
let h = mod.processosSugeridosHtml([sug({ sinais: [{ codigo: 'x', texto: XSS }] })]);
check('detectada: título, sinais, recado e os dois botões', /Possível novo processo: <b>CAF<\/b>/.test(h) && /data-proc-aprovar="5"/.test(h) && /data-proc-descartar="5"/.test(h) && /id="proc-msg-5"/.test(h) && /maxlength="500"/.test(h));
check('os sinais entram escapados (sem HTML)', !h.includes(XSS) && h.includes('&lt;img'));
h = mod.processosSugeridosHtml([sug({ status: 'aprovada', mensagem: 'Recado ' + XSS })]);
check('aprovada: esperando a resposta, com o seu recado escapado e sem botões de decisão', /Esperando a resposta/.test(h) && h.includes('Recado &lt;img') && !/data-proc-descartar/.test(h));
h = mod.processosSugeridosHtml([sug({ status: 'aceita' })]);
check('aceita: diz que a aba está no checklist dela', /aceitou/.test(h) && /a aba CAF está no checklist/.test(h));
h = mod.processosSugeridosHtml([sug({ status: 'recusada' })]);
check('recusada: oferece perguntar de novo', /agora não/.test(h) && /Perguntar de novo/.test(h) && /data-proc-aprovar="5"/.test(h));
check('descartada não aparece', mod.processosSugeridosHtml([sug({ status: 'descartada' })]) === '');
check('processo sem rótulo usa a chave', /<b>novo_proc<\/b>/.test(mod.processosSugeridosHtml([sug({ processo: 'novo_proc' })])));

console.log('\n== Aprovar e descartar ==');
mod.state.view = 'hoje';
el('proc-msg-5').value = '  Vi que você saiu da casa da família.  ';
rpcRetorno = { data: 'aprovada', error: null }; rpcs.length = 0;
await click({ procAprovar: '5' });
check('aprovar chama crm_decidir_processo com o recado sem espaços', rpcs.length === 1 && rpcs[0].n === 'crm_decidir_processo' && rpcs[0].a.p_id === 5 && rpcs[0].a.p_decisao === 'aprovar' && rpcs[0].a.p_mensagem === 'Vi que você saiu da casa da família.');
check('sai da lista de Hoje e avisa', !mod.getPSUG().some((p) => p.id === 5) && /Aprovado/.test(el('toast').textContent));
el('proc-msg-6').value = '';
rpcs.length = 0;
await click({ procDescartar: '6' });
check('descartar não manda recado', rpcs.length === 1 && rpcs[0].a.p_decisao === 'descartar' && rpcs[0].a.p_mensagem === null);
rpcRetorno = { data: null, error: { message: 'sem_permissao' } }; rpcs.length = 0;
const b = await click({ procAprovar: '9' });
check('erro do banco: avisa e o botão volta a funcionar', /Não consegui aprovar o processo/.test(el('toast').textContent) && b.disabled === false);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
