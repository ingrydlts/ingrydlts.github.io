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
    delete: () => { const f = { op: 'delete', table, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    update: (row) => { const f = { op: 'update', table, row, filtros: [] }; const ch = { eq(c, v) { f.filtros.push(c + '=' + v); return ch; }, is(c, v) { f.filtros.push(c + ' is ' + v); return ch; },
      then(ok, ko) { writes.push(f); return Promise.resolve({ error: null }).then(ok, ko); } }; return ch; },
    then: (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko) };   // cópia nova a cada busca, como o banco
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: rpcErro }; },
  channel: (nome) => { const ch = { nome, ons: [], on(t, o, cb) { ch.ons.push({ o, cb }); return ch; }, subscribe(cb) { ch.status = cb; return ch; } }; canais.push(ch); return ch; }, removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'TX', 'EE', 'EQ', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, pararAoVivo };')(
  supabase, {}, TXMOD, { iniciar() {}, depois() {}, campoMudou() {} }, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});


const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Souza', estagio: 'em_uso', urgencia: 'baixa', persona: 'pvt' };
mod.setC([Object.assign({}, base)]);
const XSS = '<img src=x onerror=alert(1)>';
function fixture(o = {}) {
  respostas = { 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, chat_mensagens: { data: [], error: null }, propostas: { data: [], error: null },
    checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null },
    caso_achados: { data: o.ach || [], error: o.err || null }, caso_acoes: { data: o.aco || [], error: null }, board_itens: { data: o.itens || [], error: null }, caso_avisos: { data: o.avs || [], error: null }, escolas_dela: { data: o.escolasDela || [], error: o.escolasErr || null },
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
const AVS = [{ id: 30, tipo: 'pergunta', titulo: 'Quando termina o seu PVT?', texto: null, resposta_tipo: 'data', grava_em: 'respostas.fim_pvt', modo: 'apos_primeiro_acesso', dias_apos: 0, ordem: 1, pausa_dias: 0, liberar_em: null, liberado_em: null, estado: 'rascunho', resposta: null },
  { id: 31, tipo: 'proposta', titulo: 'Seu bilan', texto: null, resposta_tipo: null, grava_em: null, modo: 'apos_primeiro_acesso', dias_apos: 1, ordem: 2, pausa_dias: 2, liberar_em: new Date(Date.now() + 2 * 864e5).toISOString(), liberado_em: null, estado: 'agendado', resposta: null },
  { id: 32, tipo: 'inteligencia', titulo: 'Percebi algo', texto: null, resposta_tipo: null, grava_em: null, modo: 'apos_primeiro_acesso', dias_apos: 3, ordem: 3, pausa_dias: 3, liberar_em: new Date(Date.now() + 5 * 864e5).toISOString(), liberado_em: null, estado: 'agendado', resposta: null }];
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
check('aviso em rascunho pede aprovação com data; agendado mostra quando e deixa mudar', h.includes('Aprovar e agendar') && h.includes('Mudar a pausa') && h.includes('sai em 2 dias'));
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


console.log('\n== A próxima mensagem e o ritmo ==');
fixture({ avs: AVS.slice(1) }); await pagina();
h = html();
check('a próxima mensagem aparece em destaque no topo da aba, com quando sai e quantas vêm depois', /Próxima mensagem para Ana/.test(h) && /Seu bilan/.test(h.split('Avisos da IAssistente')[0]) && /sai em 2 dias/.test(h) && /vem mais 1/.test(h) && /as pausas se mantêm/.test(h));
check('só a próxima tem "Enviar agora"; atrasar vale para todas; adiantar só com pausa maior que zero', (h.match(/data-caso="enviar-agora"/g) || []).length === 2 && h.includes('data-caso="enviar-agora" data-id="31"') && !h.includes('data-caso="enviar-agora" data-id="32"') && h.includes('data-caso="atrasar-3" data-id="32"') && h.includes('data-caso="adiantar-1" data-id="32"'));
check('a lista mostra a pausa de cada uma', /pausa de 2 dias depois do anterior/.test(h) || /pausa de 2 dias depois do 1º acesso/.test(h));
rpcs.length = 0;
await click({ caso: 'enviar-agora', id: '31', c: 'c1' });
check('Enviar agora chama crm_aviso_enviar_agora', rpcs[0].n === 'crm_aviso_enviar_agora' && rpcs[0].a.p_id === 31);
await click({ caso: 'atrasar-3', id: '32', c: 'c1' });
check('Atrasar 3 dias manda +3', rpcs[1].n === 'crm_aviso_deslocar' && rpcs[1].a.p_dias === 3 && rpcs[1].a.p_id === 32);
await click({ caso: 'adiantar-1', id: '32', c: 'c1' });
check('Adiantar 1 dia manda −1', rpcs[2].a.p_dias === -1);
rpcErro = { message: 'nao_e_a_proxima' };
await click({ caso: 'enviar-agora', id: '32', c: 'c1' });
check('erro do banco vira mensagem em português', /próxima da fila/.test(els.get('toast').textContent));
rpcErro = null;
await click({ caso: 'ag-abrir', id: '31' });
check('o formulário de pausa fala em "pausa depois do aviso anterior"', /Pausa depois do aviso anterior/.test(html()));
fixture({ avs: [AVS[1]].map((x) => Object.assign({}, x, { liberado_em: '2026-11-01T09:00:00Z', estado: 'liberado' })) }); await pagina();
check('o que já saiu não tem botões de ritmo nem aparece como "próxima mensagem"', !/Próxima mensagem para/.test(html()) && !html().includes('data-caso="atrasar-1"'));

fixture({ itens: [ITENS[1]] }); await pagina();
check('prazo-chave genérico avisa que ela só vê o título; título específico não avisa', /Diga a que se refere/.test(html()));
fixture({ itens: [Object.assign({}, ITENS[1], { titulo: 'Fim da inscrição na Alliance Française' })] }); await pagina();
check('título específico não recebe o aviso', !/Diga a que se refere/.test(html()));


console.log('\n== Corrigir o que ela vê: prazo e escola ==');
const MARCO = { id: 21, tipo: 'marco', titulo: 'Prazo-chave', resumo: null, dados: { data: '2026-11-30', a_confirmar: false, nota: 'antiga' }, estado: 'publicado', ordem: 5, link: null, versao: 1 };
const ESC = { id: 23, tipo: 'escola', titulo: 'Alliance Française de Marseille', resumo: null, dados: { cidade: 'Marseille', curso: 'FLE intensivo', custo_eur: 7100 }, estado: 'proposto', ordem: 7, link: 'https://exemplo.org/af', versao: 1 };
fixture({ itens: [MARCO, ESC] }); await pagina();
await click({ caso: 'ed-item', id: '21' });
h = html();
check('editar um prazo: o que é, a data, "a confirmar" e a explicação', /id="caso-ed-titulo"/.test(h) && /id="caso-ed-data"[^>]*value="2026-11-30"/.test(h) && /id="caso-ed-conf"/.test(h) && /id="caso-ed-nota"/.test(h) && /O que é este prazo/.test(h));
el('caso-ed-titulo').value = 'Fim das inscrições no DU Aix-en-Provence'; el('caso-ed-data').value = '2026-12-05'; el('caso-ed-conf').checked = true; el('caso-ed-nota').value = '';
writes.length = 0; await click({ caso: 'salvar-item', id: '21' });
const w1 = ultimo();
check('salvar o prazo grava o nome, a data nova e "a confirmar", e tira a explicação vazia', w1.table === 'board_itens' && w1.row.titulo === 'Fim das inscrições no DU Aix-en-Provence' && w1.row.dados.data === '2026-12-05' && w1.row.dados.a_confirmar === true && !('nota' in w1.row.dados));
check('item já publicado continua publicado (a correção chega a ela na hora) e o aviso diz isso', !('estado' in w1.row) && /Ela já vê a correção/.test(els.get('toast').textContent));
el('caso-ed-data').value = ''; await click({ caso: 'ed-item', id: '21' }); el('caso-ed-titulo').value = 'Prazo'; el('caso-ed-data').value = '05/12/2026'; writes.length = 0;
await click({ caso: 'salvar-item', id: '21' });
check('data fora do formato é recusada, sem gravar', writes.length === 0);
await click({ caso: 'ed-item', id: '23' });
h = html();
check('editar uma escola: nome, cidade, curso, custo e site', /id="caso-ed-cidade"[^>]*value="Marseille"/.test(h) && /id="caso-ed-curso"/.test(h) && /id="caso-ed-custo"[^>]*value="7100"/.test(h) && /id="caso-ed-link"[^>]*value="https:\/\/exemplo.org\/af"/.test(h) && /Nome da escola ou do curso/.test(h));
el('caso-ed-titulo').value = 'DU Aix-en-Provence'; el('caso-ed-cidade').value = 'Aix-en-Provence'; el('caso-ed-curso').value = 'Diplôme d’Université de français'; el('caso-ed-custo').value = '4200'; el('caso-ed-link').value = 'https://exemplo.org/du';
writes.length = 0; await click({ caso: 'salvar-item', id: '23' });
const w2 = ultimo();
check('salvar a escola troca o nome e os dados e guarda o que não mexeu', w2.row.titulo === 'DU Aix-en-Provence' && w2.row.dados.cidade === 'Aix-en-Provence' && w2.row.dados.curso === 'Diplôme d’Université de français' && w2.row.dados.custo_eur === 4200 && w2.row.link === 'https://exemplo.org/du');
check('item que era só proposta vira revisado ao ser editado: ler o Notion de novo não desfaz a correção', w2.row.estado === 'revisado');
await click({ caso: 'ed-item', id: '23' }); el('caso-ed-custo').value = '-5'; el('caso-ed-titulo').value = 'x'; writes.length = 0;
await click({ caso: 'salvar-item', id: '23' });
check('custo negativo ou fora do limite é recusado', writes.length === 0 && /entre 0 e 100000/.test(els.get('toast').textContent));


console.log('\n== Guias dela: documentos, bilans e mensagens prontas ==');
{
  fixture({ itens: [] }); await pagina();
  check('a barra de adicionar aparece no Board: + Documento, + Mensagem pronta, + Bilan', /data-caso="novo" data-id="documento"/.test(html()) && /data-caso="novo" data-id="modelo"/.test(html()) && /data-caso="novo" data-id="bilan"/.test(html()));
  await click({ caso: 'novo', id: 'documento' });
  check('+ Documento abre o formulário (nome, o que é, link)', /id="caso-novo-titulo"/.test(html()) && /id="caso-novo-resumo"/.test(html()) && /id="caso-novo-link"/.test(html()));
  el('caso-novo-titulo').value = 'PDF das escolas de FLE'; el('caso-novo-resumo').value = 'Escolas de francês por região'; el('caso-novo-link').value = 'http://inseguro.example';
  writes.length = 0; await click({ caso: 'salvar-novo', id: 'documento' });
  check('link que não é https é recusado', writes.length === 0);
  el('caso-novo-link').value = 'https://exemplo.org/pdf'; await click({ caso: 'salvar-novo', id: 'documento' });
  const wd = writes.at(-1);
  check('criar o documento insere um item "proposto" com direção "recebe", o "o que é" e o link', wd.op === 'insert' && wd.table === 'board_itens' && wd.row.tipo === 'documento' && wd.row.estado === 'proposto' && wd.row.contato_id === 'c1' && wd.row.dados.direcao === 'recebe' && wd.row.resumo === 'Escolas de francês por região' && wd.row.link === 'https://exemplo.org/pdf');
  await click({ caso: 'novo', id: 'documento' }); el('caso-novo-titulo').value = ''; writes.length = 0; await click({ caso: 'salvar-novo', id: 'documento' });
  check('sem nome não cria', writes.length === 0);
  await click({ caso: 'cancelar', id: '0' });
  await click({ caso: 'novo', id: 'bilan' });
  el('caso-novo-titulo').value = 'Conversa de 12/11/2026'; el('caso-novo-data').value = '2026-11-12'; el('caso-novo-palavras').value = 'Prazo, DU Aix, dinheiro, a, b, c, d';
  writes.length = 0; await click({ caso: 'salvar-novo', id: 'bilan' });
  check('mais de 6 palavras-chave é recusado', writes.length === 0 && /até 6 palavras-chave/.test(els.get('toast').textContent));
  el('caso-novo-palavras').value = 'Prazo, DU Aix, dinheiro'; el('caso-novo-texto').value = 'Ligar para a escola\n\nConferir a atestação';
  await click({ caso: 'salvar-novo', id: 'bilan' });
  const wb = writes.at(-1);
  check('criar o bilan guarda a data, as palavras-chave e o que combinaram (uma frase por linha, sem linhas vazias)', wb.row.tipo === 'bilan' && wb.row.dados.data === '2026-11-12' && wb.row.dados.palavras.join() === 'Prazo,DU Aix,dinheiro' && wb.row.dados.secoes[0].itens.map((x) => x.texto).join('|') === 'Ligar para a escola|Conferir a atestação');
  await click({ caso: 'novo', id: 'modelo' }); el('caso-novo-titulo').value = 'E-mail para as escolas'; el('caso-novo-resumo').value = 'Para pedir informações de inscrição'; el('caso-novo-assunto').value = 'Inscription'; el('caso-novo-corpo').value = ''; el('caso-novo-traducao').value = 'Olá…';
  writes.length = 0; await click({ caso: 'salvar-novo', id: 'modelo' });
  check('mensagem sem texto não cria', writes.length === 0);
  el('caso-novo-corpo').value = 'Bonjour,\nje voudrais…'; await click({ caso: 'salvar-novo', id: 'modelo' });
  const wm = writes.at(-1);
  check('criar a mensagem guarda assunto, texto, tradução e o "o que é"', wm.row.tipo === 'modelo' && wm.row.dados.assunto === 'Inscription' && wm.row.dados.corpo === 'Bonjour,\nje voudrais…' && wm.row.dados.traducao === 'Olá…' && wm.row.resumo === 'Para pedir informações de inscrição');

  const BIL = { id: 40, tipo: 'bilan', titulo: 'Conversa de 29/10/2026', resumo: null, dados: { data: '2026-10-29', palavras: ['PVT'], secoes: [] }, estado: 'proposto', ordem: 1, link: null, versao: 1 };
  const DOCU = { id: 41, tipo: 'documento', titulo: 'PDF das escolas', resumo: 'Escolas', dados: { direcao: 'recebe', rotulo: 'PDF das escolas' }, estado: 'revisado', ordem: 20, link: null, versao: 1 };
  const MODE = { id: 42, tipo: 'modelo', titulo: 'E-mail', resumo: null, dados: { corpo: 'Bonjour', assunto: 'X' }, estado: 'publicado', ordem: 30, link: null, versao: 1 };
  fixture({ itens: [BIL, DOCU, MODE] }); await pagina();
  await click({ caso: 'ed-item', id: '40' });
  check('editar um bilan: nome, dia, palavras-chave e o resumo de uma linha', /id="caso-ed-data"[^>]*value="2026-10-29"/.test(html()) && /id="caso-ed-palavras"[^>]*value="PVT"/.test(html()) && /id="caso-ed-resumo"/.test(html()));
  el('caso-ed-titulo').value = 'Primeira conversa'; el('caso-ed-data').value = '2026-10-29'; el('caso-ed-palavras').value = 'PVT, visto de estudante, Alliance'; el('caso-ed-resumo').value = 'Do PVT ao visto de estudante';
  writes.length = 0; await click({ caso: 'salvar-item', id: '40' });
  const e1 = writes.at(-1);
  check('salvar o bilan grava título, palavras, resumo e vira "revisado"', e1.row.titulo === 'Primeira conversa' && e1.row.dados.palavras.join() === 'PVT,visto de estudante,Alliance' && e1.row.resumo === 'Do PVT ao visto de estudante' && e1.row.estado === 'revisado' && JSON.stringify(e1.row.dados.secoes) === '[]');
  await click({ caso: 'ed-item', id: '41' });
  check('editar um documento: nome, "o que é" e arquivo', /id="caso-ed-resumo"[^>]*value="Escolas"/.test(html()) && /Arquivo \(link https/.test(html()));
  el('caso-ed-titulo').value = 'PDF das escolas'; el('caso-ed-resumo').value = 'Escolas'; el('caso-ed-link').value = 'https://exemplo.org/pdf'; writes.length = 0; await click({ caso: 'salvar-item', id: '41' });
  check('salvar o documento grava o link e o rótulo', writes.at(-1).row.link === 'https://exemplo.org/pdf' && writes.at(-1).row.dados.rotulo === 'PDF das escolas');
  await click({ caso: 'ed-item', id: '42' });
  check('editar uma mensagem: nome, "o que é", assunto, texto e tradução', /id="caso-ed-assunto"/.test(html()) && /id="caso-ed-corpo"/.test(html()) && /id="caso-ed-traducao"/.test(html()));
  el('caso-ed-titulo').value = 'E-mail'; el('caso-ed-corpo').value = ''; writes.length = 0; await click({ caso: 'salvar-item', id: '42' });
  check('mensagem sem texto não salva', writes.length === 0);
  el('caso-ed-corpo').value = 'Bonjour, madame.'; el('caso-ed-resumo').value = 'Para a Alliance'; await click({ caso: 'salvar-item', id: '42' });
  check('mensagem publicada continua publicada e a correção chega a ela', writes.at(-1).row.dados.corpo === 'Bonjour, madame.' && writes.at(-1).row.resumo === 'Para a Alliance' && !('estado' in writes.at(-1).row));
  // Remover: dois toques; publicado não se remove
  fixture({ itens: [BIL, MODE] }); await pagina();
  check('item publicado não tem "Remover" (retire antes); os outros têm', !/data-caso="item-del-pede" data-id="42"/.test(html()) && /data-caso="item-del-pede" data-id="40"/.test(html()));
  writes.length = 0; await click({ caso: 'item-del-pede', id: '40' });
  check('o primeiro toque só pede confirmação (não apaga)', /Confirmar remoção/.test(html()) && writes.length === 0);
  await click({ caso: 'item-del', id: '40' });
  check('o segundo toque remove o item', writes.at(-1).op === 'delete' && writes.at(-1).table === 'board_itens');
}


console.log('\n== Escolas que ela acrescentou ==');
fixture({ itens: [ITENS[0]], escolasDela: [{ id: 1, nome: 'Alliance Française de Lyon', link: 'https://exemplo.org/af', nota: 'Curso intensivo, 20 h.', criado_em: '2026-11-10T10:00:00Z' }, { id: 2, nome: '<img src=x onerror=alert(1)>', link: 'javascript:alert(1)', nota: null, criado_em: '2026-11-11T10:00:00Z' }] }); await pagina();
check('a ficha mostra as escolas que ela acrescentou: nome, o que ela sabe, data e o site (só https)', /Escolas que ela acrescentou/.test(html()) && /Alliance Française de Lyon/.test(html()) && /Curso intensivo, 20 h\./.test(html()) && /href="https:\/\/exemplo.org\/af"/.test(html()) && /10\/11\/2026/.test(html()));
check('texto e link perigosos da pessoa não viram HTML nem link', !html().includes('<img src=x') && !/javascript:/.test(html()));
fixture({ itens: [ITENS[0]] }); await pagina();
check('sem escolas dela, a seção não aparece', !/Escolas que ela acrescentou/.test(html()));
fixture({ itens: [ITENS[0]], escolasErr: { message: 'relation "escolas_dela" does not exist' } }); await pagina();
check('sem o SQL das escolas, a aba segue normal e a seção some', /Board dela/.test(html()) && !/Escolas que ela acrescentou/.test(html()));

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
