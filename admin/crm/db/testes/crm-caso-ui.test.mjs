// Testa a aba Caso na ficha (achados, ações, board e avisos, tudo como rascunho até você publicar), rodando o crm.js de verdade em Node com um
// navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual, Realtime de verdade).
//
// Uso: cd admin/crm/db/testes && node crm-caso-ui.test.mjs
import * as TXMOD from '../../taxonomia.js';
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
const mod = new Function('supabase', 'ES', 'TX', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, pararAoVivo };')(
  supabase, {}, TXMOD, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});


const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Souza', estagio: 'em_uso', urgencia: 'baixa', persona: 'pvt' };
mod.setC([Object.assign({}, base)]);
const XSS = '<img src=x onerror=alert(1)>';
function fixture(o = {}) {
  respostas = { 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, chat_mensagens: { data: [], error: null }, propostas: { data: [], error: null },
    checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null },
    caso_achados: { data: o.ach || [], error: o.err || null }, caso_acoes: { data: o.aco || [], error: null }, board_itens: { data: o.itens || [], error: null }, caso_avisos: { data: o.avs || [], error: null },
    consentimentos: { data: o.consent === false ? [] : [{ aceito: true, criado_em: '2026-11-01T10:00:00Z' }], error: null } };
}
const ACH = [{ id: 1, chave: 'resumo', tipo: 'fato', texto: 'PVT perto do fim. ' + XSS, origem: 'conversa', certeza: 'inferido', estado: 'conferir' },
  { id: 2, chave: 'nb_a', tipo: 'duvida', texto: 'O pagamento pode vir depois?', origem: 'conversa', certeza: 'a_confirmar', estado: 'ok' }];
const ACO = [{ id: 10, n: 1, titulo: 'Ligar para a escola', dono: 'ela', canal: 'plataforma', botao: 'gerar_rascunho', prazo: null, prazo_texto: 'dia seguinte à ligação', prazo_a_confirmar: true, estado: 'aberta', certeza: 'literal', publicada_em: null },
  { id: 11, n: 9, titulo: 'Responder sobre o pagamento', dono: 'ingryd', canal: 'email', botao: null, prazo: '2026-11-30', prazo_texto: null, prazo_a_confirmar: false, estado: 'aberta', certeza: 'inferido', publicada_em: null },
  { id: 12, n: 2, titulo: 'Fim do PVT', dono: 'ela', canal: 'plataforma', botao: null, prazo: null, prazo_texto: null, prazo_a_confirmar: false, estado: 'concluida', certeza: 'literal', publicada_em: '2026-11-02T10:00:00Z', concluida_por: 'ela', concluida_em: '2026-11-03T10:00:00Z' }];
const ITENS = [{ id: 20, tipo: 'bilan', titulo: 'Bilan da nossa conversa', resumo: null, dados: { secoes: [{}, {}] }, estado: 'proposto', ordem: 1, link: null, versao: 1 },
  { id: 21, tipo: 'marco', titulo: 'Prazo-chave', resumo: null, dados: { data: '2026-11-30', a_confirmar: false }, estado: 'revisado', ordem: 5, link: null, versao: 1 },
  { id: 22, tipo: 'documento', titulo: 'Passaporte', resumo: null, dados: { direcao: 'reune' }, estado: 'publicado', ordem: 20, link: null, versao: 1 }];
const AVS = [{ id: 30, tipo: 'pergunta', titulo: 'Quando termina o seu PVT?', texto: null, resposta_tipo: 'data', grava_em: 'respostas.fim_pvt', modo: 'apos_primeiro_acesso', dias_apos: 0, liberar_em: null, estado: 'rascunho', resposta: null },
  { id: 31, tipo: 'proposta', titulo: 'Seu bilan', texto: null, resposta_tipo: null, grava_em: null, modo: 'apos_primeiro_acesso', dias_apos: 1, liberar_em: '2026-11-20T08:00:00Z', estado: 'agendado', resposta: null }];
async function pagina() { mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'plataforma'; mod.state.pstab = 'caso'; mod.state.caso = null; await mod.renderPessoa(); await wait(20); return el('pessoa-page').innerHTML; }
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
const html = () => (els.get('caso-box') || {}).innerHTML || '';

console.log('== Estados da aba ==');
fixture({ ach: ACH, aco: ACO, itens: ITENS, avs: AVS });
await pagina();
let h = html();
check('a sub-aba Caso existe e mostra quantas coisas esperam revisão (1 achado + 1 item + 1 aviso = 3)', /data-pstab="caso"/.test(el('pessoa-page').innerHTML) && /<b>3<\/b> coisas esperam/.test(h));
check('as quatro seções aparecem', ['O que entendi', 'Ações', 'Board dela', 'Avisos da IAssistente'].every((t) => h.includes(t)));
check('texto da pessoa/Notion passa por esc(): nada de HTML vivo', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
check('ação dela pela plataforma pode ser publicada; a de e-mail é "Só equipe"', h.includes('data-caso="aco-pub" data-id="10"') && !h.includes('data-caso="aco-pub" data-id="11"') && h.includes('Só equipe'));
check('prazo em texto e prazo em data aparecem', h.includes('dia seguinte à ligação') && h.includes('30/11/2026'));
check('ação concluída por ela mostra quem concluiu e permite reabrir', h.includes('concluída por ela') && h.includes('data-caso="aco-reabrir" data-id="12"'));
check('item proposto → revisar; revisado → publicar; publicado → retirar', h.includes('data-caso="item-rev" data-id="20"') && h.includes('data-caso="item-pub" data-id="21"') && h.includes('data-caso="item-ret" data-id="22"'));
check('aviso em rascunho pede aprovação com data; agendado mostra quando e deixa mudar', h.includes('Aprovar e agendar') && h.includes('Mudar a data') && h.includes('libera em'));
fixture({ ach: ACH, aco: ACO, itens: ITENS, avs: AVS, consent: false }); await pagina();
check('sem consentimento de serviço: a aba avisa que publicar e agendar ficam bloqueados', /só depois do consentimento de serviço/.test(html()));
fixture({}); await pagina();
check('sem caso: convida a ler do Notion', /Ler do Notion/.test(html()));
fixture({ err: { message: 'relation "caso_achados" does not exist' } }); await pagina();
check('sem o SQL: nomeia os dois arquivos e a aba segue', /crm-caso\.sql/.test(html()) && /crm-caso-importar\.sql/.test(html()));

console.log('\n== Botões ==');
fixture({ ach: ACH, aco: ACO, itens: ITENS, avs: AVS }); await pagina();
const ultimo = () => writes[writes.length - 1];
writes.length = 0; rpcs.length = 0;
await click({ caso: 'ach-ok', id: '1' });
check('conferir um achado grava estado ok e a hora', ultimo().table === 'caso_achados' && ultimo().row.estado === 'ok' && !!ultimo().row.conferido_em && ultimo().filtros.includes('id=1'));
await click({ caso: 'ach-desc', id: '1' });
check('descartar um achado', ultimo().row.estado === 'descartado');
await click({ caso: 'aco-pub', id: '10' });
check('publicar uma ação grava publicada_em', ultimo().table === 'caso_acoes' && !!ultimo().row.publicada_em);
await click({ caso: 'aco-fim', id: '11' });
check('concluir pela equipe marca "equipe"', ultimo().row.estado === 'concluida' && ultimo().row.concluida_por === 'equipe');
await click({ caso: 'aco-reabrir', id: '12' });
check('reabrir limpa quem concluiu', ultimo().row.estado === 'aberta' && ultimo().row.concluida_por === null);
await click({ caso: 'item-rev', id: '20' });
check('revisar um item grava revisado', ultimo().table === 'board_itens' && ultimo().row.estado === 'revisado');
await click({ caso: 'item-pub', id: '21' });
await click({ caso: 'item-ret', id: '22' });
check('publicar e retirar passam pelas funções do banco (que impõem consentimento e revisão)', rpcs.length === 2 && rpcs[0].n === 'crm_board_publicar' && rpcs[0].a.p_id === 21 && rpcs[1].n === 'crm_board_retirar');
await click({ caso: 'av-cancel', id: '30' });
check('cancelar um aviso', ultimo().table === 'caso_avisos' && ultimo().row.estado === 'cancelado');

console.log('\n== Edição e agenda ==');
await pagina();
await click({ caso: 'ed-ach', id: '1' });
check('Editar abre uma caixa com o texto (escapado)', /id="caso-ed-texto"/.test(html()) && !html().includes('<img src=x'));
el('caso-ed-texto').value = '   ';
writes.length = 0;
await click({ caso: 'salvar-ach', id: '1' });
check('texto vazio não salva', writes.length === 0);
el('caso-ed-texto').value = 'Texto novo';
await click({ caso: 'salvar-ach', id: '1' });
check('salvar grava o texto e marca a origem como Ingryd', ultimo().row.texto === 'Texto novo' && ultimo().row.origem === 'ingryd');
await click({ caso: 'ed-item', id: '20' });
el('caso-ed-titulo').value = 'Bilan'; el('caso-ed-link').value = 'http://inseguro.example';
writes.length = 0;
await click({ caso: 'salvar-item', id: '20' });
check('link que não é https é recusado no painel', writes.length === 0);
el('caso-ed-link').value = 'https://exemplo.org/guia';
await click({ caso: 'salvar-item', id: '20' });
check('link https é salvo', ultimo().row.link === 'https://exemplo.org/guia' && ultimo().row.titulo === 'Bilan');
await click({ caso: 'ag-abrir', id: '30' });
check('Aprovar e agendar abre o formulário de data', /id="caso-ag-dias"/.test(html()) && /id="caso-ag-data"/.test(html()));
el('caso-ag-dias').value = '2'; rpcs.length = 0;
await click({ caso: 'ag-dias', id: '30' });
check('agendar por dias chama crm_aviso_agendar sem data fixa', rpcs[0].n === 'crm_aviso_agendar' && rpcs[0].a.p_id === 30 && rpcs[0].a.p_quando === null && rpcs[0].a.p_dias_apos === 2);
await click({ caso: 'ag-abrir', id: '30' });
el('caso-ag-data').value = '2026-12-05';
await click({ caso: 'ag-data', id: '30' });
check('agendar por data manda 9h e sem dias', rpcs[1].a.p_quando.startsWith('2026-12-05T09:00') && rpcs[1].a.p_dias_apos === null);
await click({ caso: 'ag-abrir', id: '30' });
el('caso-ag-data').value = '';
rpcs.length = 0; await click({ caso: 'ag-data', id: '30' });
check('data vazia não agenda', rpcs.length === 0);
rpcErro = { message: 'sem_consentimento' }; rpcs.length = 0;
await click({ caso: 'item-pub', id: '21' });
check('erro do banco vira mensagem em português', /consentimento de serviço/.test(els.get('toast').textContent));
rpcErro = null;

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
