// Testa o Radar no CRM (painel na página Hoje, a visão por persona com os 6 fatores, o formulário e o envio), rodando o
// crm.js de verdade em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual).
//
// Uso: cd admin/crm/db/testes && node crm-radar-ui.test.mjs
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
  src + '\n;return { state, setC: function (v) { C = v; }, loadAll, renderToday, renderRadarHoje, renderRadar, eventText, getRD: function () { return RD; }, getRE: function () { return RE; } };')(
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
respostas = { crm_contatos: { data: GENTE, error: null }, radar_itens: { data: null, error: { message: 'relation "radar_itens" does not exist' } }, radar_envios: { data: null, error: { message: 'x' } } };
await mod.loadAll();
check('sem a tabela, o Radar fica desligado (null) e o resto do CRM segue', mod.getRD() === null);
mod.renderRadarHoje();
check('Hoje avisa qual arquivo rodar', /crm-radar\.sql/.test(el('today-radar').innerHTML) && el('c-radar').hidden === true);
mod.renderRadar();
check('a tela do Radar avisa o arquivo e não quebra', /crm-radar\.sql/.test(el('radar-grid').innerHTML));
await click({ radarnovo: '1' });
check('"Novo item" sem o SQL só avisa', /Rode o crm-radar\.sql/.test(el('toast').textContent));

console.log('\n== Com itens ==');
respostas = {
  crm_contatos: { data: GENTE, error: null },
  radar_itens: { data: [item(1), item(2, { fator: 'legal', titulo: 'ENEM ' + XSS, texto: 'x', impacto: null, acao: null, fonte_url: 'javascript:alert(1)', fonte_rotulo: 'Guia', origem: 'cerebro', avisado_em: '2026-10-17T10:00:00Z' }),
    item(3, { persona: 'pvt', fator: 'social', titulo: 'PVT lotou' }), item(4, { fator: 'politico', vigente_ate: '2020-01-01', titulo: 'Velho' })], error: null },
  radar_envios: { data: [{ item_id: 2, contato_id: 'a', visto_em: '2026-10-18T10:00:00Z' }, { item_id: 2, contato_id: 'b', visto_em: null }], error: null }
};
await mod.loadAll();
check('carrega os itens e conta os envios e quem viu', mod.getRD().length === 4 && mod.getRE()[2].enviados === 2 && mod.getRE()[2].vistos === 1 && mod.getRE()[2].contatos.a === true);
mod.renderRadarHoje();
let h = el('today-radar').innerHTML;
check('Hoje lista as 5 personas com quantas pessoas estão na plataforma (só com conta e não inativas)', (h.match(/class="row"/g) || []).length === 5 && /Campus France<\/b><span>2 na plataforma · 3 itens/.test(h));
check('mostra quantos itens ainda não avisaram nenhum cliente', /2 sem aviso/.test(h) && /1 sem aviso/.test(h) && /sem itens/.test(h));
check('o menu mostra o total sem aviso', String(el('c-radar').textContent) === '3' && el('c-radar').hidden === false);
check('persona sem item não vira "em dia"', !/em dia/.test(h));

mod.state.rpersona = '';
mod.renderRadar();
h = el('radar-grid').innerHTML;
check('abre na persona que tem item sem aviso', mod.state.rpersona === 'campus_france' && /aria-pressed="true"[^>]*>Campus France/.test(el('radar-personas').innerHTML));
check('mostra os 6 fatores, com o nome por extenso', ['Político', 'Econômico', 'Social', 'Tecnológico', 'Ambiental', 'Legal'].every((f) => h.includes(f)));
check('o item aparece completo: fato, para ela, o que fazer, data e fonte', h.includes('Recursos mínimos subiram') && h.includes('Para ela:') && h.includes('Refaça a conta.') && h.includes('O que fazer:') && h.includes('16/10/2026') && h.includes('href="https://www.legifrance.gouv.fr/"'));
check('item sem aviso é sinalizado; o enviado mostra quantos receberam e quantos viram', h.includes('Nenhum cliente avisado ainda') && h.includes('Enviado a 2 · 1 viu'));
check('texto do banco passa por esc()', !h.includes(XSS) && h.includes('&lt;img src=x onerror=alert(1)&gt;'));
check('link que não é https não vira link', !h.includes('javascript:alert') && h.includes('Guia'));
check('item do Cérebro é marcado', h.includes('do Cérebro'));
check('vigência encerrada aparece', h.includes('vigência encerrada'));
check('a linha explica a regra: o cliente recebe antes do post', /o cliente recebe primeiro/.test(el('radar-sub').textContent) && /2 pessoas dessa persona na plataforma · 3 itens/.test(el('radar-sub').textContent));
await click({ radarpersona: 'pvt' });
check('trocar de persona mostra só os itens dela', /PVT lotou/.test(el('radar-grid').innerHTML) && !/Recursos mínimos/.test(el('radar-grid').innerHTML));
await click({ radarabrir: 'campus_france' });

console.log('\n== Novo item ==');
writes.length = 0; rpcs.length = 0;
await click({ radarnovo: '1', radarfator: 'legal' });
let m = el('compose-modal').innerHTML;
check('o formulário abre na persona atual e no fator do botão', /<option value="campus_france" selected>/.test(m) && /<option value="legal" selected>/.test(m));
check('pede a fonte e a data em que foi conferida', m.includes('rd-fonte-url') && m.includes('Conferido na fonte em'));
el('rd-titulo').value = ''; el('rd-texto').value = 'algo';
await click({}, 'radar-salvar');
check('sem título não salva', writes.length === 0 && /título/.test(el('toast').textContent));
for (const [id, v] of [['rd-persona', 'campus_france'], ['rd-fator', 'legal'], ['rd-titulo', ' ENEM mínimo '], ['rd-texto', 'ENEM 500/450/500.'], ['rd-impacto', ''], ['rd-acao', ''], ['rd-fonte-rotulo', 'Guia do Candidato'], ['rd-fonte-url', 'http://inseguro'], ['rd-verificado', '2026-10-20'], ['rd-vigente', '']]) el(id).value = v;
await click({}, 'radar-salvar');
check('link http é recusado antes de ir ao banco', writes.length === 0 && /https/.test(el('toast').textContent));
el('rd-fonte-url').value = 'https://exemplo.fr/guia';
respostas.radar_itens = { data: [item(77, { fator: 'legal', titulo: 'ENEM mínimo' })], error: null };   // o que o banco devolve depois de salvar
await click({}, 'radar-salvar');
const ins = writes.find((w) => w.table === 'radar_itens' && w.op === 'insert');
check('salva no banco com o texto aparado e os opcionais vazios como null', ins && ins.row.titulo === 'ENEM mínimo' && ins.row.impacto === null && ins.row.acao === null && ins.row.vigente_ate === null && ins.row.fonte_url === 'https://exemplo.fr/guia' && ins.row.verificado_em === '2026-10-20');
check('depois de salvar, já abre a escolha de a quem enviar', /Enviar para quem está na plataforma/.test(el('compose-modal').innerHTML));

console.log('\n== Enviar ==');
respostas.radar_itens = { data: [item(1), item(2, { avisado_em: '2026-10-17T10:00:00Z' })], error: null };
await mod.loadAll();
rpcs.length = 0;
await click({ radarenviar: '1' });
m = el('compose-modal').innerHTML;
check('a persona inteira vem marcada e conta quem está na plataforma (2)', /aria-pressed="true">A persona inteira \(2\)/.test(m) && /Enviar para 2 pessoas/.test(m));
check('não lista a pessoa sem conta nem a inativa', !m.includes('Cris Dias') && !m.includes('Dani Reis'));
el('radar-nota').value = '  Vamos olhar no 1:1?  ';
await click({}, 'radar-enviar-go');
let go = rpcs.find((r) => r.n === 'radar_enviar');
check('envia à persona inteira: p_contatos nulo, nota aparada', go && go.a.p_item === 1 && go.a.p_contatos === null && go.a.p_nota === 'Vamos olhar no 1:1?');
check('avisa quantos receberam e que o sininho já tem o aviso', /Enviado a 2 pessoas — o aviso já está no sininho/.test(el('toast').textContent));
rpcs.length = 0; rpcRetorno = { data: 1, error: null };
await click({ radarenviar: '1' });
await click({ radarmodo: 'escolher' });
m = el('compose-modal').innerHTML;
check('escolher pessoas lista só quem tem conta (ana e bia)', m.includes('Ana Souza') && m.includes('Bia Lima') && !m.includes('Cris Dias'));
check('com ninguém marcado, o botão diz 0 e não envia', /Enviar para 0 pessoas/.test(m));
await click({}, 'radar-enviar-go');
check('escolher sem marcar ninguém não chama o banco', rpcs.length === 0 && /pelo menos uma/.test(el('toast').textContent));
el('radar-nota').value = '';   // no navegador a caixa nasce vazia a cada abertura
for (const h2 of handlers.change) h2({ target: { dataset: { radarsel: 'b' }, checked: true } });
check('marcar uma pessoa atualiza o rótulo do botão', /Enviar para 1 pessoa →/.test(el('radar-enviar-go').textContent));
await click({}, 'radar-enviar-go');
go = rpcs.find((r) => r.n === 'radar_enviar');
check('envia só para a escolhida', go && JSON.stringify(go.a.p_contatos) === '["b"]' && go.a.p_nota === null);
check('singular quando é uma pessoa', /Enviado a 1 pessoa — /.test(el('toast').textContent));
rpcRetorno = { data: 0, error: null }; rpcs.length = 0;
await click({ radarenviar: '2' });
await click({}, 'radar-enviar-go');
check('ninguém novo: avisa em vez de dizer que enviou', /Ninguém novo para receber/.test(el('toast').textContent));
rpcRetorno = { data: null, error: { message: 'sem_permissao' } };
await click({ radarenviar: '1' });
await click({}, 'radar-enviar-go');
check('erro do banco: avisa e deixa tentar de novo', /Não consegui enviar o item/.test(el('toast').textContent));
rpcRetorno = { data: 2, error: null };

console.log('\n== Arquivar e linha do tempo ==');
writes.length = 0;
await click({ radararquivar: '1' });
const arq = writes.find((w) => w.table === 'radar_itens' && w.op === 'update');
check('arquivar grava arquivado_em só naquele item', arq && !!arq.row.arquivado_em && arq.filtros.includes('id=1'));
check('quando ela vê o item, a ficha mostra "Viu no Radar"', mod.eventText({ tipo: 'radar_visto', dados: { titulo: 'Recursos mínimos subiram' } })[1] === 'Viu no Radar: Recursos mínimos subiram');

console.log(`\n${passed} verificações ok, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
