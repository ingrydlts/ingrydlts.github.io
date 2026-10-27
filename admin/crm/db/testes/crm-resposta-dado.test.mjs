// Testa "cada resposta vira dado": o leitor de respostas (sim/não, opções, datas, números, cidade), a gravação no Dossiê com a origem
// "Resposta dela no chat", a dúvida de confiança média, o desfazer/ignorar e o agradecimento que diz o que foi anotado.
// Roda o crm.js de verdade em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real.
//
// Uso: cd admin/crm/db/testes && node crm-resposta-dado.test.mjs
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
const rpcs = [], updates = [];
let respostas = {}, rpcResp = {};
function qb(table) {
  const b = new Proxy({}, { get(_, k) {
    if (k === 'maybeSingle') return async () => respostas[table + ':one'] || { data: null, error: null };
    if (k === 'update') return (p) => { updates.push({ table, p }); return qb('__update'); };
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(JSON.parse(JSON.stringify(respostas[table] || { data: [], error: null }))).then(ok, ko);
    return () => b;
  } });
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return rpcResp[n] !== undefined ? (typeof rpcResp[n] === 'function' ? rpcResp[n](a) : rpcResp[n]) : { data: null, error: null }; },
  channel: () => { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; }, removeChannel() {} };
const store = {};
const win = { addEventListener() {} };
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, chatSugestao, pergAgradecimento, PERGUNTAS, dosCampo, respInterpreta, respPlano, respHtml, respAnotadas };')(
  supabase, {}, document, win, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});


const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana Silva', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
mod.setC([Object.assign({}, base)]);
const agora = () => Date.now();
const haDias = (n) => new Date(agora() - n * 86400000).toISOString();
let id = 0;
const M = (de, texto, dias, o = {}) => Object.assign({ id: ++id, de, tipo: 'texto', texto, acao: null, proposta_id: null, criado_em: haDias(dias), lida_em: haDias(dias) }, o);
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); await wait(20); return b; };

const F = (k) => mod.dosCampo(k);
const L = (k, t, agoraMs = new Date('2026-10-27T12:00:00').getTime()) => mod.respInterpreta(F(k), t, agoraMs);
const v = (k, t) => { const r = L(k, t); return r ? r.valor : null; };

console.log('== O leitor: sim/não ==');
check('"Ainda não tenho!" → certificado: nao', v('certificado_frances', 'Ainda não tenho!') === 'nao');
check('"Sim, tenho o DELF B2" → certificado: tenho', v('certificado_frances', 'Sim, tenho o DELF B2') === 'tenho');
check('"Já tenho" → tenho; "Não" → nao', v('certificado_frances', 'Já tenho') === 'tenho' && v('certificado_frances', 'Não') === 'nao');
check('campo sim/não de verdade (moradia_resolvida) vira boolean', v('moradia_resolvida', 'Sim, já resolvi') === true && v('moradia_resolvida', 'ainda não') === false);
check('"Não sei o que é" na ANEF → nao_sei; "sim" → sim', v('conta_anef', 'Não sei o que é isso') === 'nao_sei' && v('conta_anef', 'Sim') === 'sim');
check('"sim, mas depende" NÃO é lido (ambíguo)', L('moradia_resolvida', 'Sim, mas depende do contrato') === null);
check('texto sem sim/não claro não vira dado', L('conta_resolvida', 'Estou vendo isso com o banco') === null);
check('resposta longa vira confiança média (não grava sozinha)', L('moradia_resolvida', 'Sim, ' + 'a verdade é que '.repeat(6) + 'está tudo certo').conf === 'media');

console.log('\n== O leitor: opções ==');
check('ano de au pair: "segundo ano" / "1º" / "estou no primeiro"', v('ano_au_pair', 'Segundo ano') === 'segundo' && v('ano_au_pair', '1º') === 'primeiro' && v('ano_au_pair', 'Estou no primeiro') === 'primeiro');
check('ano de au pair com os dois ("primeiro, vou para o segundo") não é lido', L('ano_au_pair', 'primeiro, vou para o segundo') === null);
check('depois do au pair: renovar / estudante', v('intencao_au_pair', 'Quero renovar') === 'renovar' && v('intencao_au_pair', 'Pretendo virar estudante') === 'migrar_estudante');
check('sécu: "ainda não recebi" é aguardando; "recebi" é recebi; "nem pedi" é nao_pedi', v('numero_secu', 'Ainda não recebi') === 'aguardando' && v('numero_secu', 'Recebi semana passada') === 'recebi' && v('numero_secu', 'Nem pedi ainda') === 'nao_pedi');
check('certificado: "DELF B2" → delf; "DELF e TCF" não é lido', v('certificado_frances_qual', 'DELF B2') === 'delf' && L('certificado_frances_qual', 'DELF e TCF') === null);
check('nível de francês: B1, "A2", "fluente" → c1_mais', v('nivel_frances', 'Acho que B1') === 'b1' && v('nivel_frances', 'A2') === 'a1_a2' && v('nivel_frances', 'sou fluente') === 'c1_mais');
check('faixa de idade a partir do número: 24 / 27 / 31 / "26 a 29"', v('faixa_idade', 'Tenho 24') === 'menos_26' && v('faixa_idade', '27 anos') === '26_29' && v('faixa_idade', 'tenho 31 anos') === '30_mais' && v('faixa_idade', '26 a 29') === '26_29');
check('"26 e 31" (faixas diferentes) não é lido', L('faixa_idade', '26 e 31') === null);
check('caminho de estudo: Master em alternância, FLE, "ainda não sei"', v('trilha_estudo', 'Quero um master em alternância') === 'master_alternancia' && v('trilha_estudo', 'FLE') === 'fle' && v('trilha_estudo', 'Ainda não sei') === 'indefinido');
check('maior preocupação: dinheiro, prazo; duas juntas não é lido', v('maior_preocupacao', 'O dinheiro') === 'dinheiro' && v('maior_preocupacao', 'Prazo') === 'prazo' && L('maior_preocupacao', 'prazo e dinheiro') === null);
check('profissão regulamentada: enfermagem; "não" → nao', v('profissao_regulamentada', 'Sou enfermeira') === 'enfermagem' && v('profissao_regulamentada', 'Não') === 'nao');
check('teste de francês (Campus France): inscrita / já tenho / não fiz', v('cfTeste', 'Estou inscrita') === 'inscrito' && v('cfTeste', 'Já tenho o resultado') === 'tenho' && v('cfTeste', 'Ainda não fiz') === 'nada');
check('nível da candidatura: L1, Master, Licence Pro', v('cfNivel', 'L1') === 'l1' && v('cfNivel', 'Master') === 'master' && v('cfNivel', 'Licence Pro') === 'lpro');

console.log('\n== O leitor: datas, mês, número e cidade ==');
check('vencimento "15/03/2027" e "15 de março de 2027"', v('documento_vencimento', '15/03/2027') === '2027-03-15' && v('documento_vencimento', 'vence em 15 de março de 2027') === '2027-03-15');
check('vencimento sem ano ("15/03") é o próximo, com confiança MÉDIA', L('documento_vencimento', '15/03').valor === '2027-03-15' && L('documento_vencimento', '15/03').conf === 'media');
check('chegada sem ano ("2 de setembro") é a última, com confiança média', L('data_chegada', '2 de setembro').valor === '2026-09-02' && L('data_chegada', '2 de setembro').conf === 'media');
check('data impossível (31/02/2027) não é lida', L('documento_vencimento', '31/02/2027') === null);
check('fim do contrato: "junho de 2027", "06/2027", "jun/27" → 2027-06-01', v('contrato_fim', 'termina em junho de 2027') === '2027-06-01' && v('contrato_fim', '06/2027') === '2027-06-01' && v('contrato_fim', 'jun/27') === '2027-06-01');
check('ano do ensino médio: 2018', v('ensino_medio_ano', 'Terminei em 2018') === 2018);
check('cidade: "Moro em Lyon" → Lyon; "em Saint-Denis" → Saint-Denis; frase longa não é lida', v('cidade', 'Moro em Lyon.') === 'Lyon' && v('cidade', 'em saint-denis') === 'Saint-Denis' && L('cidade', 'moro numa cidade pequena perto de Paris com a família') === null);
check('cidade: "Não moro ainda" não vira cidade', L('cidade', 'Não moro ainda') === null);

console.log('\n== No chat: a resposta vira dado no Dossiê ==');
const q = mod.PERGUNTAS;
const QSECU = q.numero_secu.q, QCERT = q.certificado_frances.q;
const ficha = { ano_au_pair: 'primeiro' };
async function abre(dossie, msgs, extra = {}) {
  id = 0; updates.length = 0; rpcs.length = 0; mod.state.resp = null;
  const lista = msgs.map((m, i) => Object.assign({}, m, { id: i + 1 }));
  respostas = { 'contatos:one': { data: { dossie, user_id: 'u1', onboarding_em: null, dossie_origem: extra.origem || {} }, error: null },
    chat_mensagens: { data: lista.slice().reverse(), error: null }, propostas: { data: [], error: null }, checklist_items: { data: [{ step_key: 'a', label: 'Passo', status: 'pendente', category: 'X', due_date: null }], error: null },
    plataforma_cliques: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, mensagens_agendadas: { data: [], error: null }, processos_sugeridos: { data: [], error: null } };
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'plataforma'; mod.state.pstab = 'chat'; mod.state.chatCtl = null; mod.state.chatEditado = false; mod.state.chatSugPula = 0; mod.state.chatRasc = ''; mod.state.pc = null;
  el('chat-txt').value = '';
  await mod.renderPessoa(); await wait(60);
  return el('pessoa-page').innerHTML;
}
const salvo = () => rpcs.filter((r) => r.n === 'crm_salvar_dossie').map((r) => r.a.p_dados);
const origemGravada = () => { const u = updates.filter((x) => x.table === 'contatos' && x.p.dossie_origem).pop(); return u ? u.p.dossie_origem : null; };

let h = await abre(ficha, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Ainda não tenho!', 1)]);
check('resposta clara ("Ainda não tenho!") grava SOZINHA no Dossiê: certificado_frances = nao', salvo().length === 1 && salvo()[0].certificado_frances === 'nao');
check('e marca a origem "chat", com a confiança e o id da mensagem dela', origemGravada() && origemGravada().certificado_frances.origem === 'chat' && origemGravada().certificado_frances.msg === 2 && origemGravada().certificado_frances.confianca === 'alta');
check('a aba do chat tem o lugar da faixa de registro, em cima da sugestão', h.indexOf('id="chat-resp"') > 0 && h.indexOf('id="chat-resp"') < h.indexOf('id="chat-sug"'));
await wait(30);
const faixa = el('chat-resp').innerHTML;
check('faixa "Anotei no Dossiê: Tem certificado de francês? → Ainda não" com a resposta e botão Desfazer', /Anotei no Dossiê: <b>Tem certificado de francês\?<\/b> → Ainda não/.test(faixa) && faixa.includes('data-respdesfazer="certificado_frances"') && faixa.includes('Ainda não tenho!'));
check('a sugestão agora agradece E diz o que foi anotado', /Anotei no seu perfil: tem certificado de francês: ainda não\./.test(mod.chatSugestao(Object.assign({}, base), agora()).texto));
check('o campo não está mais "faltando": a pergunta saiu da fila (nem é sugerida de novo)', mod.chatSugestao(Object.assign({}, base), agora()).cand.every((c) => c.k !== 'certificado_frances'));

console.log('\n== Regras que se abrem sozinhas ==');
h = await abre({}, [M('ingryd', 'Oi! ' + q.ano_au_pair.q, 2), M('pessoa', 'Primeiro ano', 1)]);
check('"Primeiro ano" grava ano_au_pair = primeiro', salvo()[0] && salvo()[0].ano_au_pair === 'primeiro');
const cand = mod.chatSugestao(Object.assign({}, base), agora()).cand.map((c) => c.k);
check('a pergunta condicional "depois do au pair" passa a valer na fila (a regra q do Dossiê reage à resposta)', cand.includes('intencao_au_pair'));
h = await abre({}, [M('ingryd', 'Oi! ' + q.ano_au_pair.q, 2), M('pessoa', 'Segundo ano', 1)]);
check('"Segundo ano" abre "fim do contrato" e NÃO pergunta "depois do au pair"', (() => { const c2 = mod.chatSugestao(Object.assign({}, base), agora()).cand.map((c) => c.k); return c2.includes('contrato_fim') && !c2.includes('intencao_au_pair'); })());

console.log('\n== Segurança: nunca sobrescreve, nunca repete, sempre desfaz ==');
await abre({ certificado_frances: 'tenho' }, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Ainda não tenho!', 1)]);
check('campo que você já preencheu NÃO é sobrescrito pela resposta dela', salvo().length === 0);
await abre({}, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Ainda não tenho!', 1)], { origem: { certificado_frances: { valor: 'nao', origem: 'chat', confianca: 'alta', msg: 2 } } });
check('resposta já tratada (marcador msg na origem) NÃO é gravada de novo, mesmo com o campo vazio (você apagou)', salvo().length === 0);
await abre({}, [M('ingryd', 'Oi! ' + QCERT, 4), M('pessoa', 'Ainda não tenho!', 3), M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Já tenho!', 1)], { origem: { certificado_frances: { valor: 'nao', origem: 'chat', confianca: 'alta', msg: 2 } } });
check('uma resposta NOVA (mensagem mais nova que o marcador) volta a valer', salvo().length === 1 && salvo()[0].certificado_frances === 'tenho');
await abre({}, [M('ingryd', 'Conversa solta, sem pergunta do roteiro', 2), M('pessoa', 'Sim!', 1)]);
check('resposta a uma mensagem que não é pergunta do roteiro NÃO vira dado', salvo().length === 0);
await abre({}, [M('ingryd', 'Oi! ' + QCERT + ' ' + QSECU, 2), M('pessoa', 'Recebi semana passada', 1)]);
check('duas perguntas na mesma mensagem: a resposta vale só para a última (sécu), nunca para as duas', salvo().length === 1 && salvo()[0].numero_secu === 'recebi' && salvo()[0].certificado_frances === undefined);

console.log('\n== Confiança média: um clique, nada gravado antes ==');
h = await abre({}, [M('ingryd', 'Oi! ' + q.documento_vencimento.q, 2), M('pessoa', 'vence 15/03', 1)]);
check('data sem ano é só proposta: NADA gravado', salvo().length === 0);
let dv = el('chat-resp').innerHTML;
check('aparece "Entendi como 15/03/2027 em Vencimento… Registrar?" com Registrar e Ignorar', /Entendi como <b>15\/03\/2027<\/b>/.test(dv) && dv.includes('data-respok="documento_vencimento"') && dv.includes('data-respnao="documento_vencimento"'));
rpcs.length = 0; updates.length = 0;
await click({ respok: 'documento_vencimento' });
check('"Registrar" grava o valor entendido e a origem (confiança média)', salvo()[0] && salvo()[0].documento_vencimento === '2027-03-15' && origemGravada().documento_vencimento.confianca === 'media');
h = await abre({}, [M('ingryd', 'Oi! ' + q.documento_vencimento.q, 2), M('pessoa', 'vence 15/03', 1)]);
rpcs.length = 0; updates.length = 0;
await click({ respnao: 'documento_vencimento' });
check('"Ignorar" não grava no Dossiê, mas lembra (origem com ignorada) para não perguntar de novo', salvo().length === 0 && origemGravada() && origemGravada().documento_vencimento.ignorada === true && !el('chat-resp').innerHTML.includes('data-respok'));

console.log('\n== Resposta que não deu para ler ==');
await abre({}, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Estou vendo isso ainda, depois te falo', 1)]);
check('não grava nada e avisa: "Não consegui ler a resposta sobre… Preencha no Dossiê"', salvo().length === 0 && /Não consegui ler a resposta sobre <b>Tem certificado de francês\?<\/b>/.test(el('chat-resp').innerHTML));

console.log('\n== Desfazer ==');
await abre(ficha, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', 'Ainda não tenho!', 1)]);
await wait(30);
rpcs.length = 0;
await click({ respdesfazer: 'certificado_frances' });
check('"Desfazer" limpa o campo (null) no Dossiê', salvo()[0] && salvo()[0].certificado_frances === null);
check('a faixa some e a mesma resposta não volta a ser gravada', !el('chat-resp').innerHTML.includes('data-respdesfazer'));

console.log('\n== Segurança do texto ==');
await abre({}, [M('ingryd', 'Oi! ' + QCERT, 2), M('pessoa', '<img src=x onerror=alert(1)> não sei', 1)]);
check('texto da pessoa com HTML não vira HTML na tela', !el('chat-resp').innerHTML.includes('<img'));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
