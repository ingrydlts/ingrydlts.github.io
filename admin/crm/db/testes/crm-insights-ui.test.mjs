// Testa a "Minha iAssistente" da ficha (o que ela vê, o que mudou, notas suas, ao vivo), rodando o crm.js de verdade
// em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual, Realtime de verdade).
//
// Uso: cd admin/crm/db/testes && node crm-insights-ui.test.mjs
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
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
const writes = [], canais = [], removidos = [], intervalos = [];
let respostas = {};
function qb(table) {
  const b = { select: () => b, eq: (c, v) => { b._eq = [c, v]; return b; }, or: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
    insert: async (row) => { writes.push({ op: 'insert', table, row }); return { error: respostas.__insertErro || null }; },
    update: (row) => ({ eq: async (c, v) => { writes.push({ op: 'update', table, row, eq: [c, v] }); return { error: null }; } }),
    then: (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }),
  channel: (nome) => { const ch = { nome, ons: [], on(t, o, cb) { ch.ons.push({ o, cb }); return ch; }, subscribe(cb) { ch.status = cb; return ch; } }; canais.push(ch); return ch; },
  removeChannel: (ch) => { removidos.push(ch.nome); } };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, pararAoVivo };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  (f, ms) => { intervalos.push(ms); return intervalos.length; }, () => {});

const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante' };
mod.setC([Object.assign({}, base)]);
const XSS = '<img src=x onerror=alert(1)>';
const agora = (n) => new Date(Date.now() + n * 60e3).toISOString();
const N = (id, texto, icone = '⚠️') => ({ id, icone, texto });
function fixture(o = {}) {
  respostas = { 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null },
    insights_vivos: undefined, 'insights_vivos:one': { data: o.vivos === undefined ? { notas: [N('sem_matricula', 'Vi que você ainda não tem a matrícula fechada.'), N('ingryd:7', 'Ligue para o OFII antes de sexta.', '💡')], atualizado_em: agora(-2) } : o.vivos, error: o.err || null },
    insights_historico: { data: o.hist || [], error: null },
    insights_manuais: { data: o.manuais || [], error: null }, checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null } };
}
async function pagina(tab) {
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = tab;
  await mod.renderPessoa();
  return el('pessoa-page').innerHTML;
}
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };

console.log('== O que ela vê agora ==');
fixture({ hist: [{ inicial: true, entrou: [N('sem_matricula', 'x')], saiu: [], criado_em: agora(-300) }] });
let html = await pagina('plataforma');
check('aba Plataforma mostra o card dela com as notas no ar', html.includes('Minha iAssistente') && html.includes('Vi que você ainda não tem a matrícula fechada.') && html.includes('Ligue para o OFII'));
check('cada nota diz de onde veio: automática ou nota sua', html.includes('>automática<') && html.includes('>nota sua<'));
check('mostra quando foi atualizado', /Atualizado [A-Z]{3}, \d\d\/\d\d às \d\d:\d\d/.test(html));
check('o painel mora dentro de #ins-box (repinta sozinho)', html.includes('id="ins-box"'));
fixture({ vivos: null });
html = await pagina('plataforma');
check('sem registro: diz que ela ainda não abriu o dashboard', /ainda não abriu o dashboard/.test(html));
fixture({ vivos: { notas: [], atualizado_em: agora(-1) } });
html = await pagina('plataforma');
check('lista vazia: nenhuma nota no ar', /Nenhuma nota no ar/.test(html));
fixture({ vivos: { notas: [N('x', XSS, XSS)], atualizado_em: agora(-1) }, manuais: [{ id: 1, icone: XSS, texto: XSS, ate: null, ativo: true, criado_em: agora(-5) }] });
html = await pagina('plataforma');
check('texto do banco passa por esc() (nota, ícone, suas notas)', !html.includes(XSS) && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
fixture({ err: { message: 'relation "insights_vivos" does not exist' } });
html = await pagina('plataforma');
check('sem o SQL: avisa o arquivo e a aba segue', /crm-insights\.sql/.test(html) && html.includes('role="tablist"'));

console.log('\n== O que mudou ==');
fixture({ hist: [
  { inicial: false, entrou: [], saiu: [N('sem_matricula', 'Sem matrícula.')], criado_em: agora(-3) },
  { inicial: false, entrou: [N('sem_recursos', 'Sem recursos.', '📄')], saiu: [], criado_em: agora(-120) },
  { inicial: true, entrou: [N('sem_matricula', 'Sem matrícula.')], saiu: [], criado_em: agora(-400) }] });
html = await pagina('plataforma');
check('lista o que entrou e o que saiu, sem a 1ª leitura', html.includes('>Entrou<') && html.includes('>Saiu<') && html.includes('Sem recursos.') && (html.match(/class="insmud"/g) || []).length === 2);
check('mudança de poucos minutos fica em destaque', html.includes('Mudou agora há pouco') && html.includes('insrecente'));
fixture({ hist: [{ inicial: false, entrou: [], saiu: [N('a', 'a')], criado_em: agora(-120) }] });
html = await pagina('plataforma');
check('mudança antiga não fica em destaque', !html.includes('Mudou agora há pouco'));

console.log('\n== Notas suas ==');
fixture({ vivos: { notas: [N('ingryd:1', 'No ar.', '💡')], atualizado_em: agora(-1) }, manuais: [
  { id: 1, icone: '💡', texto: 'No ar.', ate: null, ativo: true, criado_em: agora(-60), retirado_em: null },
  { id: 2, icone: '⚠️', texto: 'Ainda não recebeu.', ate: null, ativo: true, criado_em: agora(-30), retirado_em: null },
  { id: 3, icone: '📅', texto: 'Vencida.', ate: agora(-60), ativo: true, criado_em: agora(-90), retirado_em: null },
  { id: 4, icone: '📄', texto: 'Retirada.', ate: null, ativo: false, criado_em: agora(-95), retirado_em: agora(-80) }] });
html = await pagina('plataforma');
check('status: no ar e já recebeu / esperando ela abrir / venceu / retirada', ['No ar, ela já recebeu', 'Esperando ela abrir o app', 'Venceu', 'Retirada'].every((x) => html.includes('>' + x + '<')));
check('"Retirar" só nas notas que ainda valem (1 e 2)', (html.match(/data-insretirar="/g) || []).length === 2 && html.includes('data-insretirar="1"') && html.includes('data-insretirar="2"'));
mod.state.sel = 'c1';
el('ins-texto').value = '   '; el('ins-icone').value = '⚠️'; el('ins-ate').value = '';
await click({ insnova: 'c1' });
check('nota vazia não publica', writes.length === 0);
el('ins-texto').value = '  Vi que sua matrícula está em aberto.  '; el('ins-icone').value = '⚠️'; el('ins-ate').value = '2030-01-31';
await click({ insnova: 'c1' });
const w = writes.find((x) => x.table === 'insights_manuais' && x.op === 'insert');
check('publica na tabela das suas notas, da pessoa certa, aparada', w && w.row.contato_id === 'c1' && w.row.texto === 'Vi que sua matrícula está em aberto.' && w.row.icone === '⚠️');
check('"vale até" vira o fim daquele dia', w && new Date(w.row.ate).getTime() >= new Date('2030-01-31T23:59:00').getTime() && new Date(w.row.ate).getTime() <= new Date('2030-01-31T23:59:59').getTime());
el('ins-texto').value = 'Sem prazo'; el('ins-ate').value = '';
await click({ insnova: 'c1' });
check('sem prazo vai null', writes.filter((x) => x.op === 'insert')[1].row.ate === null);
await click({ insretirar: '2' });
const ret = writes.find((x) => x.op === 'update' && x.table === 'insights_manuais');
check('retirar marca inativa, com data, na nota certa', ret && ret.row.ativo === false && !!ret.row.retirado_em && ret.eq[0] === 'id' && ret.eq[1] === '2');

console.log('\n== No resumo do dossiê, em qualquer aba ==');
fixture({ hist: [{ inicial: false, entrou: [N('a', 'a')], saiu: [], criado_em: agora(-2) }] });
for (const tab of ['conversa', 'ficha']) { html = await pagina(tab); check('aba ' + tab + ': chip "iAssistente 2 notas no ar · mudou agora"', /<b>iAssistente<\/b> 2 notas no ar · mudou agora/.test(html)); }

console.log('\n== Ao vivo ==');
mod.pararAoVivo(); canais.length = 0; removidos.length = 0;
fixture({ hist: [{ inicial: true, entrou: [N('a', 'a')], saiu: [], criado_em: agora(-60) }] });
await pagina('plataforma');
const ch = canais[canais.length - 1];
check('abre um canal para a pessoa', ch && ch.nome === 'ficha-c1');
const alvo = ch.ons.map((x) => x.o.table + ':' + x.o.filter).sort();
check('escuta insights, cliques e o checklist dela, filtrados nela', JSON.stringify(alvo) === JSON.stringify(['checklist_items:user_id=eq.u1', 'insights_historico:contato_id=eq.c1', 'insights_vivos:contato_id=eq.c1', 'plataforma_cliques:contato_id=eq.c1']));
const n0 = canais.length;
await mod.renderPessoa();
check('redesenhar a ficha não abre outro canal', canais.length === n0);
// ela marcou um item: o insight saiu
fixture({ vivos: { notas: [N('ingryd:7', 'Ligue para o OFII antes de sexta.', '💡')], atualizado_em: agora(0) },
  hist: [{ inicial: false, entrou: [], saiu: [N('sem_matricula', 'Sem matrícula.')], criado_em: agora(0) }, { inicial: true, entrou: [N('a', 'a')], saiu: [], criado_em: agora(-60) }] });
el('toast').hidden = true; el('toast').textContent = '';
ch.ons[0].cb({ eventType: 'UPDATE' });
await wait(900);
check('chegou mudança: o painel se atualiza sozinho', el('ins-box').innerHTML.includes('Mudou agora há pouco') && !el('ins-box').innerHTML.includes('Vi que você ainda não'));
check('e avisa na tela que os insights dela mudaram', el('toast').textContent === 'Os insights dela mudaram' && el('toast').hidden === false);
el('toast').textContent = '';
ch.ons[0].cb({}); await wait(900);
check('sem mudança de verdade, não avisa de novo', el('toast').textContent === '');
fixture({ vivos: { notas: [N('ingryd:7', 'x', '💡')], atualizado_em: agora(0) }, hist: [{ inicial: true, entrou: [], saiu: [], criado_em: agora(-60) }] });
respostas.checklist_items = { data: [{ step_key: 'a', category: 'Moradia', label: 'Achar moradia', status: 'concluido', due_date: null, sort_order: 1, updated_at: agora(0) }], error: null };
ch.ons[3].cb({}); await wait(900);
check('item do checklist mudou: a seção do checklist se atualiza', (el('chk-box').innerHTML || '').includes('Achar moradia') || (el('chk-box').innerHTML || '').includes('1 de 1'));
document.activeElement = null;
ch.status('CHANNEL_ERROR');
check('se o Realtime não estiver ligado, passa a consultar a cada 20 s', intervalos.includes(20000));
mod.state.view = 'contatos';
ch.ons[0].cb({}); await wait(900);
check('saiu da ficha: fecha o canal', removidos.includes('ficha-c1'));

console.log('\n== Linha do tempo ==');
const t = mod.eventText({ tipo: 'insights_alterados', dados: { entrou: ['sem_recursos'], saiu: ['sem_matricula'] } });
check('insights_alterados diz o que entrou e saiu', t[0] === 'sistema' && /entrou: sem_recursos/.test(t[1]) && /saiu: sem_matricula/.test(t[1]));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
