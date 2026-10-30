// Testa o bloco "Próximo e-mail" (conselho em vez de prévia) e a "Jornada no funil" da ficha, rodando o crm.js de verdade
// em Node com um navegador e um Supabase de mentira. NÃO testa nada em navegador real (visual).
//
// Uso: cd admin/crm/db/testes && node crm-proximo-email-ui.test.mjs
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
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
let respostas = {}, jornadaErro = false;
function qb(table) {
  const b = { select: () => b, eq: () => b, in: () => b, order: () => b, limit: () => b,
    or: (f) => { if (jornadaErro && /email_capturado/.test(f)) throw new Error('sem or'); return b; },
    maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
    then: (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: null, error: null }),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage', 'setInterval', 'clearInterval',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, proximoEmail, montaJornada, jornadaHtml, emailsPanel };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, () => 1, () => {});

const dias = (n) => new Date(Date.now() - n * 864e5).toISOString();
const base = (o = {}) => Object.assign({ id: 'c1', email: 'isa@example.com', nome: 'Isabelle', estagio: 'lead', urgencia: 'baixa', persona: 'au_pair_estudante', origem: 'bot',
  capturas: 1, aceita_novidades: true, respostas: {} }, o);
const mail = (o = {}) => Object.assign({ id: 1, modelo: 'boas_vindas', status: 'entregue', assunto: 'Seu link', enviado_em: dias(5), criado_em: dias(5), aberto_em: null, clicado_em: null }, o);
const J = (evs = []) => mod.montaJornada(evs);
const prox = (c, mails = [], resps = [], jor = J()) => mod.proximoEmail(c, mails, resps, jor);
const XSS = '<img src=x onerror=alert(1)>';

console.log('== Quando ela nunca recebeu e-mail ==');
let p = prox(base());
check('primeiro contato: pode enviar agora, com o modelo de boas-vindas', p.quando === 'agora' && p.k === 'boas_vindas' && /Primeiro contato/.test(p.titulo));
check('o ângulo cita o funil e pede uma pergunta fácil', /Assistente de vistos/.test(p.angulo) && /pergunta/.test(p.angulo));
check('os sinais dizem que não recebeu nenhum e-mail', p.sinais.some((s) => /nenhum e-mail pelo CRM/.test(s)));
p = prox(base({ respostas: { objetivo: 'cf-escolhendo-curso' } }));
check('cita a etapa que ela escolheu', /escolhendo o curso/i.test(p.angulo));

console.log('\n== Espere / não mande ==');
p = prox(base(), [mail({ enviado_em: dias(1), criado_em: dias(1) })]);
check('e-mail de ontem: espera, e diz até quando', p.quando === 'esperar' && /^\d\d\/\d\d$/.test(p.espera) && /Espere/.test(p.titulo));
p = prox(base(), [mail({ status: 'nao_entregue' })]);
check('não entregue: manda corrigir o endereço, sem modelo', p.k === null && p.quando === 'nao' && /endereço/.test(p.titulo));
p = prox(base({ um_a_um_quando: new Date(Date.now() + 864e5).toISOString() }), [mail()]);
check('1:1 marcado: sem campanha', p.k === null && /1:1 marcado/.test(p.titulo));
p = prox(base(), [mail()], [{ status: 'nova' }]);
check('resposta nova esperando: manda responder primeiro e abre a conversa', p.conversa === true && p.k === null && /Responda/.test(p.titulo));
p = prox(base({ origem: 'guia-etudes-en-france-2027', origens: ['guia-etudes-en-france-2027'] }), [mail({ modelo: 'cf_guia_1', enviado_em: dias(1), criado_em: dias(1) })]);
check('guia Campus France com o e-mail 2 a caminho: deixa sair sozinho', p.k === null && /e-mail 2/.test(p.titulo));

console.log('\n== Sinais fortes ==');
p = prox(base({ capturas: 2, origem: 'guia-vls-ts', origens: ['guia-vls-ts'], ultima_origem: 'guia-vls-ts', ultima_captura_em: dias(0), email_enviado_em: dias(10) }), [mail({ enviado_em: dias(10), criado_em: dias(10) })]);
check('voltou depois do e-mail: pode enviar agora o guia da última origem', p.quando === 'agora' && p.k === 'guia_chamada' && /voltou a pedir/.test(p.titulo));
check('o sinal diz quantas vezes ela entrou', p.sinais[0].includes('2 vezes') && p.sinais[0].includes('Guia VLS-TS'));
p = prox(base({ segmento: 'naoabriu' }), [mail()]);
check('segmento de reimpacto: usa o modelo e o porquê do segmento', p.k === 'naoabriu' && /não abriu/i.test(p.titulo) && /spam|assunto/i.test(p.angulo));
p = prox(base({ estagio: 'ativado', dias_para_prazo: 10, prazo_limite: '2026-11-09' }), [mail({ status: 'aberto', aberto_em: dias(4) })]);
check('prazo próximo e nenhum modelo certo: fala do prazo real e não inventa e-mail', p.k === null && p.quando === 'nao' && /prazo/i.test(p.titulo) && /VLS-TS em 09\/11\/2026/.test(p.angulo));
p = prox(base({ estagio: 'em_uso' }), [mail({ status: 'clicado', aberto_em: dias(4), clicado_em: dias(4) })], [], J([{ tipo: 'app_aberto', criado_em: dias(3) }, { tipo: 'app_aberto', criado_em: dias(2) }]));
check('ativa, sem gatilho: não precisa de e-mail e conta as aberturas do app', p.k === null && /ativa/.test(p.titulo) && /2 vezes/.test(p.angulo));
p = prox(base(), [mail({ enviado_em: dias(4), criado_em: dias(4) })]);
check('sem gatilho nenhum: espera um sinal', p.k === null && /Sem gatilho/.test(p.titulo));

p = prox(base({ capturas: 2, origem: 'bot', origens: ['bot'], ultima_origem: 'bot', ultima_captura_em: dias(0), email_enviado_em: dias(10) }), [mail({ enviado_em: dias(10), criado_em: dias(10) })]);
check('voltou, mas já recebeu as boas-vindas: não sugere reenviá-las', p.k === null && /Escrever e-mail/.test(p.angulo));

console.log('\n== O bloco na tela ==');
let html = mod.emailsPanel(base(), [], 'x', [], J());
check('sem prévia em miniatura (o que não servia)', !html.includes('mailthumb') && !html.includes('thumbframe') && !html.includes('<iframe'));
check('mostra selo em texto, título e ângulo', html.includes('Pode enviar agora') && html.includes('Primeiro contato') && html.includes('ins-ang'));
check('mantém o botão que abre o e-mail para revisar', /data-emailfor="c1"[^>]*data-tplk="boas_vindas"/.test(html) && html.includes('Revisar e enviar'));
check('os sinais ficam num bloco que abre e fecha', html.includes('O que a ficha mostra') && html.includes('<details'));
html = mod.emailsPanel(base({ origem: 'guia-vls-ts', origens: ['guia-vls-ts'] }), [mail({ enviado_em: dias(1), criado_em: dias(1) })], 'x', [], J());
check('esperar: selo diz até quando e o botão deixa de ser o principal', /Espere até \d\d\/\d\d/.test(html) && html.includes('Ver o e-mail mesmo assim') && !html.includes('btn primary" type="button" style="margin-top:10px" data-emailfor'));
html = mod.emailsPanel(base(), [mail()], 'x', [{ status: 'nova' }], J());
check('resposta nova: botão leva à conversa', html.includes('data-openconv="c1"') && !html.includes('data-emailfor="c1" data-tplk'));
html = mod.emailsPanel(base({ aceita_novidades: false, segmento: 'naoclicou' }), [mail({ status: 'aberto', aberto_em: dias(4) })], 'x', [], J());
check('sem aceite de novidades: avisa e não oferece enviar', /não pode ser enviado/.test(html) && !html.includes('Revisar e enviar'));

console.log('\n== Jornada no funil ==');
const evs = [
  { tipo: 'quiz_respondido', dados: { persona: 'campus_france', objetivo: 'cf-escolhendo-curso' }, criado_em: '2026-10-10T10:00:00Z' },
  { tipo: 'email_capturado', dados: { origem: 'bot', utm_campaign: 'camp-x', utm_content: 'post-1' }, criado_em: '2026-10-10T10:00:00Z' },
  { tipo: 'email_recapturado', dados: { origem: 'guia-vls-ts', utm_source: 'instagram' }, criado_em: '2026-10-20T10:00:00Z' },
  { tipo: 'acesso_ativado', dados: {}, criado_em: '2026-10-11T10:00:00Z' },
  { tipo: 'artigo_lido', dados: {}, criado_em: '2026-10-12T10:00:00Z' }
];
const jor = J(evs);
check('a jornada ordena as entradas e conta app e artigos', jor.entradas.length === 2 && jor.entradas[0].origem === 'bot' && jor.ativouEm === '2026-10-11T10:00:00Z' && jor.artigos === 1);
const cj = base({ capturas: 2, origens: ['bot', 'guia-vls-ts'], ultima_origem: 'guia-vls-ts', ultima_captura_em: '2026-10-20T10:00:00Z', estagio: 'em_uso', criado_em: '2026-10-10T10:00:00Z' });
html = mod.jornadaHtml(cj, [mail({ aberto_em: dias(3), status: 'aberto' })], [], jor, 'x');
check('diz o funil de entrada e o tipo', html.includes('Funil de entrada') && html.includes('Assistente de vistos (funil de classificação)'));
check('lista cada entrada com número, origem, campanha e post', html.includes('1ª vez') && html.includes('2ª vez') && html.includes('campanha camp-x') && html.includes('post post-1') && html.includes('fonte instagram'));
check('a entrada mostra a persona e a etapa do quiz da mesma hora', html.includes('Campus France') && html.includes('Escolhendo o curso'));
check('diz quantas vezes ela entrou e o caminho', html.includes('2 vezes') && html.includes('Assistente de vistos → Guia VLS-TS'));
check('degraus: tem ✓ onde chegou e texto "Ainda não" onde não', html.includes('Abriu o e-mail') && html.includes('Ainda não clicou em nenhum link') && html.includes('Ainda não respondeu') && html.includes('Ainda sem 1:1'));
html = mod.jornadaHtml(base(), [], [], J(), 'x');
check('sem nada na linha do tempo: diz isso em vez de quebrar', html.includes('Sem registro de captura') && html.includes('Ainda não recebeu e-mail do CRM'));
html = mod.jornadaHtml(base({ capturas: 3 }), [], [], J(evs.slice(1, 2)), 'x');
check('capturas a mais que os eventos: avisa que faltam entradas', /2 entradas mais antigas sem detalhe/.test(html));
html = mod.jornadaHtml(base({ origens: [XSS], utm_campaign: XSS }), [], [], J([{ tipo: 'email_capturado', dados: { origem: XSS, utm_campaign: XSS, utm_content: XSS }, criado_em: dias(1) }]), 'x');
check('texto de terceiros (origem, UTM) passa por esc()', !html.includes(XSS) && html.includes('&lt;img src=x onerror=alert(1)&gt;'));

console.log('\n== A ficha inteira ==');
mod.setC([cj]);
respostas = { eventos: { data: evs, error: null }, 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, emails_enviados: { data: [], error: null } };
mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = 'ficha';
await mod.renderPessoa();
html = el('pessoa-page').innerHTML;
check('a aba Ficha traz o próximo e-mail e a jornada, e não mais "De onde veio"', html.includes('nextmail insight') && html.includes('Jornada no funil') && !html.includes('>De onde veio<'));
jornadaErro = true;
await mod.renderPessoa();
html = el('pessoa-page').innerHTML;
check('se a busca da jornada falhar, a ficha abre mesmo assim', html.includes('Jornada no funil') && html.includes('nextmail insight'));
jornadaErro = false;

console.log('\n' + (failed ? failed + ' FALHARAM, ' : '') + passed + ' passaram');
process.exit(failed ? 1 : 0);
