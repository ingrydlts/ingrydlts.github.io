// Testa a etapa Pós-call na ficha (dentro do dossiê), rodando o crm.js de verdade em Node com um navegador, um Worker e um
// Supabase de mentira. NÃO testa nada em navegador real (layout, clique de verdade, foco).
//
// Uso: cd admin/crm/db/testes && node crm-pos-call-ui.test.mjs
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
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null };
const VOCAB = [{ chave: 'sem_graduacao', rotulo: 'Só o ensino médio', descricao: null }, { chave: 'dap_verte', rotulo: 'Mora na França, vaga em L1 (DAP verte)', descricao: null }, { chave: 'quer_plano_b', rotulo: 'Quer um plano B', descricao: null }];
const rpcs = [];
let rpcResp = {}, respostas = {}, vocabErro = false;
function qb(table) {
  // Qualquer método de consulta devolve o próprio construtor (select, eq, is, order...); só o que importa tem comportamento.
  const b = new Proxy({}, { get(_, k) {
    if (k === 'maybeSingle') return async () => respostas[table + ':one'] || { data: null, error: null };
    if (k === 'update') return () => ({ eq: async () => ({ error: null }) });
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(table === 'sinais_vocabulario' ? (vocabErro ? { data: null, error: { message: 'relation does not exist' } } : { data: VOCAB, error: null }) : (respostas[table] || { data: [], error: null })).then(ok, ko);
    return () => b;
  } });
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); if (rpcResp[n] !== undefined) return typeof rpcResp[n] === 'function' ? rpcResp[n](a) : rpcResp[n]; return { data: null, error: null }; } };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, pcMontarAplicacao };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });

const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
const XSS = '<img src=x onerror=alert(1)>';
const TRANSCRICAO = 'Ela chegou há quatro semanas como au pair e quer estudar cinema. '.repeat(6);
respostas.crm_contatos = { data: [Object.assign({}, base)], error: null };
mod.setC([Object.assign({}, base)]);
mod.state.dosAberto = true;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function pagina(dossie) {
  respostas['contatos:one'] = { data: { dossie: dossie || {}, user_id: null }, error: null };
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'ficha';
  await mod.renderPessoa(); await wait(10);
  return el('pessoa-page').innerHTML;
}
const caixa = () => el('poscall-box').innerHTML;
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); await wait(10); return b; };
const muda = (ds, extra = {}) => handlers.change.forEach((h) => h({ target: Object.assign({ id: '', dataset: ds, checked: true, value: '', matches: () => false }, extra) }));

const PROP = {
  mapa_da_call: [{ titulo: 'Por que a França', resumo: 'Quer estudar cinema aqui.', tema: 'outro' }, { titulo: 'Como entrar na L1', resumo: 'Calendário e DAP verte.', tema: 'dap_verte' }],
  perguntas_para_ela: [{ texto: 'Você tem o diploma do ensino médio em PDF ou em papel?', motivo: 'A call não fechou isso.', campo: 'ensino_medio_ano' }, { texto: 'Quando termina o seu contrato de au pair?', motivo: 'Só se falou em 8 meses.', campo: 'contrato_fim' }, { texto: 'Você já tem aula de francês marcada?', motivo: 'Disse que ainda procura professor.' }],
  campos: { ensino_medio_ano: { valor: 2018, confianca: 'alta', trecho: 'terminei em 2018' }, formacao_alvo: { valor: 'l1_universidade', confianca: 'media', trecho: 'cinema' },
    plano_b: { valor: true, confianca: 'baixa', trecho: 'e se não der?' }, cidade: { valor: 'Paris', confianca: 'alta', trecho: 'moro em Paris' } },
  sinais: [{ chave: 'sem_graduacao', motivo: 'Só o ensino médio.' }, { chave: 'dap_verte', motivo: 'Já mora na França.' }],
  perguntas_dela: [{ texto: 'Existe limite de idade?', tema: 'outro' }],
  respostas_dadas: [{ texto: 'Cinema segue o ciclo.', tema: 'dap_verte', precisa_fonte: true }],
  itens_candidatos: [{ fator: 'legal', titulo: 'DAP verte', texto: 'Quem já mora na França usa a DAP verte.', impacto: 'Não é o Campus France.', camada: 'padrao', motivo_camada: 'Vale para qualquer au pair.', tema: 'dap_verte', a_conferir: true }],
  a_conferir: ['Janela até meados de dezembro.']
};
let workerResp = { status: 200, body: { ok: true, id: 41, reutilizada: false, proposta: PROP, custo_usd: 0.02, vocabulario: VOCAB } };
const pedidos = [];
globalThis.fetch = async (url, opt) => { pedidos.push({ url: String(url), opt }); return new Response(JSON.stringify(workerResp.body), { status: workerResp.status }); };

console.log('== Painel fechado e aberto ==');
mod.state.dosAberto = false;
let html = await pagina({});
check('dossiê fechado: o painel Pós-call não aparece', !html.includes('poscall-box') && !html.includes('Ler a call com IA'));
mod.state.dosAberto = true;
rpcResp.crm_curadoria_contagem = { data: [{ tema: 'dap_verte', n_pessoas: 3, n_itens: 4, pronto: true }, { tema: 'outro', n_pessoas: 1, n_itens: 1, pronto: false }], error: null };
html = await pagina({});
check('aberto: o painel aparece dentro do dossiê, antes do checklist', html.includes('id="poscall-box"') && html.indexOf('id="poscall-box"') < html.indexOf('id="chk-box"'));
check('tem a caixa de sinais com o vocabulário carregado, sem IA', caixa().includes('data-pcsinal="dap_verte"') && caixa().includes('Mora na França, vaga em L1'));
check('sem transcrição, avisa e oferece ler', caixa().includes('Ainda não há transcrição colada') && caixa().includes('data-pcler="c1"'));
check('mostra a fila de curadoria: 3 pessoas = pronto para virar padrão; "outro" nunca fica pronto', /DAP verte[\s\S]*3 pessoas[\s\S]*pronto para virar padrão/.test(caixa()) && /Outros temas[\s\S]*1 pessoa(?!s)/.test(caixa()) && (caixa().match(/dchip insnovo/g) || []).length === 1);
check('o bloco Sinais da call (chaves novas) está no formulário e fora da barra de progresso', html.includes('Sinais da call</h4>') && html.includes('data-dk="formacao_alvo"') && html.includes('data-dk="plano_b"'));
check('as chaves novas não inflam o "respondidas"', (await pagina({})).match(/(\d+) de (\d+) respondidas/)[2] === (await pagina({ formacao_alvo: 'bts', plano_b: true })).match(/(\d+) de (\d+) respondidas/)[2]);
check('chip Sinais no resumo quando há sinais', (await pagina({ sinais: ['dap_verte'] })).includes('<b>Sinais</b> 1'));
vocabErro = true; mod.state.pc = null;
html = await pagina({});
check('sem o SQL rodado: avisa o nome do arquivo e o resto do dossiê segue', caixa().includes('db/crm-pos-call.sql') && html.includes('data-dossalvar="c1"'));
vocabErro = false; mod.state.pc = null;

console.log('\n== Sinais à mão (sem IA) ==');
await pagina({ sinais: ['sem_graduacao'] });
check('os sinais salvos vêm marcados', /data-pcsinal="sem_graduacao" checked/.test(caixa()) && !/data-pcsinal="dap_verte" checked/.test(caixa()));
check('"Salvar sinais" começa desligado', /data-pcsalvarsinais="c1" disabled/.test(caixa()));
muda({ pcsinal: 'dap_verte' }, { checked: true }); muda({ pcsinal: 'sem_graduacao' }, { checked: false });
rpcs.length = 0;
await click({ pcsalvarsinais: 'c1' });
const sv = rpcs.find((r) => r.n === 'crm_salvar_dossie');
check('salva exatamente o que ficou marcado, pelo crm_salvar_dossie', sv && sv.a.p_contato === 'c1' && JSON.stringify(sv.a.p_dados) === '{"sinais":["dap_verte"]}');

console.log('\n== Ler a call ==');
mod.state.pc = null;
await pagina({ ligacao_transcricao: 'curta' });
await click({ pcler: 'c1' });
check('transcrição curta: não chama o Worker e diz o que fazer', pedidos.length === 0 && /Cole a gravação transcrita/.test(caixa()));
await pagina({ ligacao_transcricao: TRANSCRICAO, ligacao_resumo: 'Resumo da call.' });
await click({ pcler: 'c1' });
check('chama o Worker certo, com o token, o contato, a transcrição e as notas', pedidos.length === 1 && /\/api\/crm\/pos-call\/ler$/.test(pedidos[0].url) && pedidos[0].opt.headers.Authorization === 'Bearer tok'
  && JSON.parse(pedidos[0].opt.body).contato_id === 'c1' && JSON.parse(pedidos[0].opt.body).transcricao === TRANSCRICAO.trim() && JSON.parse(pedidos[0].opt.body).notas === 'Resumo da call.');
check('a proposta aparece com os 4 baldes e diz que nada entrou na ficha', /Nada entrou na ficha ainda/.test(caixa()) && caixa().includes('1 · Fatos') && caixa().includes('2 · Sinais') && caixa().includes('3 · Padrão ou individual') && caixa().includes('4 · Perguntas dela') && caixa().includes('5 · A conferir'));
check('fato novo com confiança alta/média vem marcado; confiança baixa NÃO', /data-pccampo="ensino_medio_ano" checked/.test(caixa()) && /data-pccampo="formacao_alvo" checked/.test(caixa()) && !/data-pccampo="plano_b" checked/.test(caixa()) && caixa().includes('confiança baixa: confira'));
check('mostra o trecho que sustenta cada fato', caixa().includes('terminei em 2018'));
check('item candidato sai com #fator e "a conferir", e a camada sugerida pela IA', caixa().includes('#Legal') && caixa().includes('DAP verte') && caixa().includes('a conferir') && /data-pccamada="i0"[\s\S]*<option value="padrao" selected>/.test(caixa()));
check('sinais da IA vêm marcados, com o rótulo do vocabulário e o motivo', /data-pcsinalprop="dap_verte" checked/.test(caixa()) && caixa().includes('Já mora na França.'));
check('resposta que precisa de fonte vem avisada', caixa().includes('Você explicou (precisa de fonte)'));
check('a lista a conferir aparece, como coisa para você conferir na fonte', caixa().includes('Janela até meados de dezembro.') && caixa().includes('A conferir na fonte, com você'));
check('o mapa da call organiza o que rolou, no topo, antes dos fatos', caixa().includes('O que rolou na call') && caixa().includes('Por que a França') && caixa().indexOf('O que rolou na call') < caixa().indexOf('1 · Fatos') && /Como entrar na L1[\s\S]*Mora na França, vaga em L1 \(DAP verte\)/.test(caixa()));
check('perguntas para confirmar com ela: todas marcadas, com o motivo e o campo que preenchem', caixa().includes('6 · Perguntas para confirmar com ela') && (caixa().match(/data-pcperg="q\d" checked/g) || []).length === 3 && caixa().includes('A call não fechou isso.') && caixa().includes('preenche “Ano em que terminou o ensino médio”') && caixa().includes('data-pcchat="c1"'));
check('nenhuma chamada de gravação foi feita só por ler (nada entra sem aplicar)', !rpcs.some((r) => /aplicar|salvar_dossie/.test(r.n) && r.a.p_proposta === 41));

console.log('\n== Texto do banco e da IA passa por esc() ==');
workerResp = { status: 200, body: { ok: true, id: 42, proposta: { ...PROP, perguntas_dela: [{ texto: XSS, tema: 'outro' }], a_conferir: [XSS], itens_candidatos: [{ ...PROP.itens_candidatos[0], titulo: XSS }] }, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' });
check('HTML na proposta não vira HTML', !caixa().includes(XSS) && caixa().includes('&lt;img src=x onerror=alert(1)&gt;'));

console.log('\n== Perguntas para ela → rascunho do chat ==');
mod.state.chatRasc = ''; rpcs.length = 0;
muda({ pcperg: 'q1' }, { checked: false });
await click({ pcchat: 'c1' });
check('leva só as marcadas, numeradas, para o rascunho do chat, na voz da Ingryd e com o nome', /^Oi, Ana! Para eu acertar o seu caminho, me conta:\n\n1\. Você tem o diploma[^\n]*\n2\. Você já tem aula de francês marcada\?\n\nPode responder aqui mesmo, com calma\.$/.test(mod.state.chatRasc) && !mod.state.chatRasc.includes('contrato'));
check('abre a aba Plataforma → Chat para você revisar', mod.state.ptab === 'plataforma' && mod.state.pstab === 'chat');
check('NÃO envia nada sozinho (nenhuma mensagem no chat)', !rpcs.some((r) => /chat/.test(r.n)) && pedidos.every((x) => !/chat/.test(x.url)));
muda({ pcperg: 'q0' }, { checked: false }); muda({ pcperg: 'q2' }, { checked: false });
mod.state.chatRasc = 'nada'; await mod.renderPessoa(); await wait(10); await click({ pcchat: 'c1' });
check('sem nenhuma marcada, avisa e não mexe no rascunho', mod.state.chatRasc === 'nada');
const longas = Array.from({ length: 6 }, (_, i) => ({ texto: ('Pergunta longa número ' + i + ' ').padEnd(290, 'x'), motivo: 'm' }));
workerResp = { status: 200, body: { ok: true, id: 43, proposta: { ...PROP, perguntas_para_ela: longas }, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' }); await click({ pcchat: 'c1' });
check('rascunho que passaria de 1000 letras é cortado nas perguntas que cabem (o chat aceita 1000)', mod.state.chatRasc.length <= 1000 && /3\. /.test(mod.state.chatRasc) && !/5\. /.test(mod.state.chatRasc));
workerResp = { status: 200, body: { ok: true, id: 44, proposta: { ...PROP, perguntas_para_ela: [{ texto: XSS, motivo: XSS }] }, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' });
check('pergunta e motivo vindos da IA passam por esc()', !caixa().includes(XSS) && caixa().includes('&lt;img src=x onerror=alert(1)&gt;'));
const antiga = { ...PROP }; delete antiga.mapa_da_call; delete antiga.perguntas_para_ela;
workerResp = { status: 200, body: { ok: true, id: 45, proposta: antiga, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' });
check('proposta antiga (sem mapa nem perguntas) ainda abre, dizendo que não há o que confirmar', caixa().includes('nada a confirmar com ela') && !caixa().includes('O que rolou na call'));

console.log('\n== Aplicar ==');
workerResp = { status: 200, body: { ok: true, id: 41, reutilizada: false, proposta: PROP, custo_usd: 0.02, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO, sinais: ['quer_plano_b'] }); await click({ pcler: 'c1' });
muda({ pcsinalprop: 'sem_graduacao' }, { checked: true });
muda({ pccampo: 'cidade' }, { checked: true });          // marca o que a IA deixou desmarcado... cidade tinha atual vazio, então já vinha marcada
muda({ pccampo: 'formacao_alvo' }, { checked: false });  // desmarca um fato
muda({ pcfila: 'p0' }, { checked: false });              // tira uma pergunta da fila
muda({ pccamada: 'i0' }, { checked: false, value: 'individual' });   // decide que o item é individual
rpcs.length = 0;
await click({ pcaplicar: 'c1' });
const ap = rpcs.find((r) => r.n === 'crm_pos_call_aplicar');
check('aplicar chama crm_pos_call_aplicar com o id da proposta', ap && ap.a.p_proposta === 41);
check('só vão os fatos marcados (o desmarcado e o de baixa confiança ficam de fora)', ap && ap.a.p_campos.ensino_medio_ano === 2018 && ap.a.p_campos.cidade === 'Paris' && !('formacao_alvo' in ap.a.p_campos) && !('plano_b' in ap.a.p_campos));
check('os sinais vão como UNIÃO do que ela já tinha com o que marcou (não apaga o existente)', ap && JSON.stringify(ap.a.p_campos.sinais) === JSON.stringify(['quer_plano_b', 'sem_graduacao', 'dap_verte']));
check('a fila leva o item com a camada que VOCÊ escolheu, e o payload "a conferir"', ap && ap.a.p_fila.some((x) => x.tipo === 'item' && x.camada === 'individual' && x.tema === 'dap_verte' && x.payload.a_conferir === true && x.payload.fator === 'legal'));
check('a pergunta desmarcada não vai; a resposta dada vai com o tema', ap && !ap.a.p_fila.some((x) => x.tipo === 'pergunta') && ap.a.p_fila.some((x) => x.tipo === 'resposta' && x.tema === 'dap_verte'));
check('depois de aplicar, o painel volta ao começo', !/Nada entrou na ficha ainda/.test(caixa()));
rpcResp.crm_pos_call_aplicar = { data: null, error: { message: 'sinal_desconhecido' } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' }); await click({ pcaplicar: 'c1' });
check('se o banco recusar, mostra o erro e a proposta continua na tela (nada se perde)', /Não consegui aplicar: sinal_desconhecido/.test(caixa()) && /Nada entrou na ficha ainda/.test(caixa()));
delete rpcResp.crm_pos_call_aplicar;

console.log('\n== Descartar, resolver tema e erros do Worker ==');
rpcs.length = 0; await click({ pcdescartar: 'c1' });
check('descartar chama crm_pos_call_descartar e some a proposta', rpcs.some((r) => r.n === 'crm_pos_call_descartar' && r.a.p_proposta === 41) && !/Nada entrou na ficha ainda/.test(caixa()));
rpcs.length = 0; mod.state.sel = 'c1';
await click({ pcresolver: 'dap_verte' });
check('"Virou conteúdo" fecha o tema pelo banco', rpcs.some((r) => r.n === 'crm_curadoria_resolver' && r.a.p_tema === 'dap_verte' && r.a.p_status === 'virou_conteudo'));
workerResp = { status: 503, body: { error: 'A leitura por IA ainda não está ligada: falta o secret ANTHROPIC_API_KEY no Worker.' } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' });
check('Worker recusando: mostra a mensagem dele e volta a oferecer a leitura', caixa().includes('falta o secret ANTHROPIC_API_KEY') && caixa().includes('data-pcler="c1"'));
workerResp = { status: 200, body: { ok: true, reutilizada: true, id: 41, proposta: PROP, vocabulario: VOCAB } };
mod.state.pc = null; await pagina({ ligacao_transcricao: TRANSCRICAO }); await click({ pcler: 'c1' });
check('proposta reaproveitada avisa que não teve custo novo', caixa().includes('sem custo novo'));

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
