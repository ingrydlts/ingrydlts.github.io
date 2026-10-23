// Testa a tela Onboarding e o botão "Enviar link de pagamento" da ficha, rodando o crm.js de verdade em Node com um navegador e
// um Supabase/Worker de mentira. NÃO testa nada em navegador real (layout em 380 px, arrastar de verdade, foco): isso é conferir à mão.
//
// Uso: cd admin/crm/db/testes && node crm-onboarding-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');

class Fake {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.attrs = {}; this._inner = ''; this.hidden = false; this.value = '';
    this.textContent = ''; this.className = ''; this.parentNode = null; this.disabled = false; this.classList = { add() {}, remove() {} }; }
  set innerHTML(v) { this._inner = v; this.children = []; }
  get innerHTML() { return this._inner; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {} matches() { return false; } focus() {}
}
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) { const e = new Fake('el'); e.id = id; e.parentNode = new Fake('div'); els.set(id, e); }
  return els.get(id);
}
const document = { getElementById: el, createElement: (t) => new Fake(t), addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
  querySelectorAll: () => [], querySelector: () => null };
let respostas = {};
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, order: () => b, limit: () => b, is: () => b, in: () => b,
    maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
    update: () => ({ eq: async () => ({ error: null }) }), insert: async () => ({ error: null }),
    then: (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u' } } } }) }, rpc: async () => ({ data: null, error: null }) };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + `\n;return { state, setC: function (v) { C = v; }, getC: function () { return C; }, renderPessoa, eventText, onbJuntar, onbFalta, pagtoItens, renderOnboarding, carregarOnboarding, onbEnviar,
  getONB: function () { return ONB; }, setPagto: function (v) { PAGTO = v; }, setONB: function (v) { ONB = v; }, abrirLinkPagamento, enviarLinkPagamento, onbOrigemDe, dosVisiveis, setActive: function (v) { activeCid = v; } };`)(
  supabase, {}, document, { addEventListener() {}, scrollTo() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });

// ---- fetch falso (o crm.js chama o Worker e o links-pagamento.json) ----
let chamadas = [];
function fakeFetch(rotas) {
  globalThis.fetch = async (url, opt = {}) => {
    chamadas.push({ url: String(url), opt });
    for (const [re, resp] of rotas) if (re.test(String(url))) {
      const r = typeof resp === 'function' ? await resp(opt) : resp;
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status || 200 });
    }
    return new Response('{}', { status: 404 });
  };
}
const arq = (nome, tipo, tam = 1000, extra = {}) => ({ name: nome, type: tipo, size: tam, lastModified: 1, ...extra });
const click = async (ds, id = '') => { const b = { id, dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
const ev = (tipo, alvo) => handlers[tipo].forEach((h) => h({ target: alvo, preventDefault() {}, dataTransfer: alvo.dataTransfer }));
const XSS = '<img src=x onerror=alert(1)>';

console.log('== O menu e a tela ==');
const html = readFileSync(path.resolve(HERE, '../../index.html'), 'utf8');
check('o menu lateral tem o item "Onboarding"', /<button class="nav" data-view="onboarding" type="button">Onboarding<\/button>/.test(html));
check('a tela existe e começa escondida', /<section data-panel="onboarding" hidden>[\s\S]*id="onb-page"/.test(html));
check('o CSS e o JS têm versão nova (cache)', /crm\.css\?v=2026-10-23/.test(html) && /crm\.js\?v=2026-10-23/.test(html));

console.log('\n== Estado vazio ==');
fakeFetch([[/onboarding\/status/, { body: { ia_configurada: true, aviso: null } }]]);
mod.setONB(JSON.parse('{"fase":"form","arquivos":[],"email":"","notas":"","erro":"","ia":null}'));
mod.state.view = 'onboarding';
await mod.carregarOnboarding();
let h = el('onb-page').innerHTML;
check('tem e-mail obrigatório, área de soltar, anotações e o botão', h.includes('id="onb-email"') && h.includes('required') && h.includes('id="onb-drop"') && h.includes('id="onb-notas"') && h.includes('>Ler e criar pessoa<'));
check('a área aceita só PDF, JPG e PNG', /accept="\.pdf,\.jpg,\.jpeg,\.png,application\/pdf,image\/jpeg,image\/png"/.test(h) && h.includes('multiple'));
check('estado vazio explica o que fazer', h.includes('Nenhum documento ainda') && el('onb-vazio').hidden === false);
check('pergunta o status da IA ao Worker, com o token da admin', chamadas.some((c) => /\/api\/crm\/onboarding\/status$/.test(c.url) && c.opt.headers.Authorization === 'Bearer tok'));
check('IA ligada: sem aviso e o botão liberado', el('onb-aviso').hidden === true && el('onb-enviar').disabled === false);
check('o campo de e-mail é um input de e-mail, sem autocompletar', /type="email"[^>]*autocomplete="off"/.test(h));

console.log('\n== IA não configurada ==');
fakeFetch([[/onboarding\/status/, { body: { ia_configurada: false, aviso: 'A leitura por IA ainda não está ligada: falta o secret ANTHROPIC_API_KEY no Worker. A ficha manual continua funcionando.' } }]]);
await mod.carregarOnboarding();
check('mostra o aviso do Worker e diz que a ficha manual funciona', el('onb-aviso').hidden === false && /ANTHROPIC_API_KEY/.test(el('onb-aviso').textContent) && /continuam funcionando/.test(el('onb-aviso').textContent));
check('o botão fica desligado', el('onb-enviar').disabled === true);
fakeFetch([[/onboarding\/status/, { status: 404, body: {} }]]);
await mod.carregarOnboarding();
check('Worker antigo (sem a rota): avisa que pode precisar atualizar, sem travar', el('onb-aviso').hidden === false && /seção 24/.test(el('onb-aviso').textContent) && el('onb-enviar').disabled !== true);
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await mod.carregarOnboarding();
check('sem rede: avisa e não quebra', /falar com o Worker/.test(el('onb-aviso').textContent));

console.log('\n== Escolher arquivos ==');
const ok = (r) => r.arquivos.length;
check('PDF, JPG e PNG entram', ok(mod.onbJuntar([], [arq('a.pdf', 'application/pdf'), arq('b.jpg', 'image/jpeg'), arq('c.png', 'image/png', 1000, { lastModified: 3 })])) === 3);
let r = mod.onbJuntar([], [arq('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), arq('b.svg', 'image/svg+xml'), arq('c.txt', 'text/plain')]);
check('Word, SVG e texto são recusados com o motivo', ok(r) === 0 && r.recusas.length === 3 && /só PDF, JPG ou PNG/.test(r.recusas[0]));
r = mod.onbJuntar([], [arq('grande.pdf', 'application/pdf', 10 * 1048576 + 1), arq('exato.pdf', 'application/pdf', 10 * 1048576)]);
check('mais de 10 MB é recusado; 10 MB exatos entra', ok(r) === 1 && /passa de 10 MB/.test(r.recusas[0]));
r = mod.onbJuntar([], [1, 2, 3, 4, 5, 6].map((i) => arq(i + '.pdf', 'application/pdf', 1000, { lastModified: i })));
check('no máximo 5 arquivos', ok(r) === 5 && /no máximo 5/.test(r.recusas[0]));
r = mod.onbJuntar([], [1, 2, 3].map((i) => arq(i + '.pdf', 'application/pdf', 9 * 1048576, { lastModified: i })));
check('a soma passa de 20 MB: o 3º é recusado', ok(r) === 2 && /20 MB/.test(r.recusas[0]));
r = mod.onbJuntar([arq('a.pdf', 'application/pdf')], [arq('a.pdf', 'application/pdf')]);
check('o mesmo arquivo duas vezes entra uma só', ok(r) === 1 && r.recusas.length === 0);
check('arquivo vazio é recusado', ok(mod.onbJuntar([], [arq('v.pdf', 'application/pdf', 0)])) === 0);
check('navegador sem tipo: vale a extensão', ok(mod.onbJuntar([], [arq('p.PDF', ''), arq('x.exe', '', 100, { lastModified: 2 })])) === 1);

console.log('\n== Montar a lista na tela (texto de terceiros por textContent) ==');
mod.setONB({ fase: 'form', arquivos: [], email: '', notas: '', erro: '', ia: null });
mod.renderOnboarding();
ev('change', { id: 'onb-file', files: [arq(XSS + '.pdf', 'application/pdf'), arq('visto.png', 'image/png', 2048, { lastModified: 9 })], value: 'x' });
const lis = el('onb-arqs').children;
check('um item por arquivo, com nome, tamanho e botão "Tirar"', lis.length === 2 && lis[1].children[0].textContent === 'visto.png' && lis[1].children[1].textContent === '2 KB' && lis[1].children[2].dataset.onbrem === '1');
check('o nome do arquivo (HTML malicioso) entra como texto, nunca como HTML', lis[0].children[0].textContent === XSS + '.pdf' && !el('onb-arqs').innerHTML.includes('onerror'));
check('com arquivo, a mensagem de vazio some', el('onb-vazio').hidden === true);
await click({ onbrem: '0' });
check('"Tirar" remove só aquele', mod.getONB().arquivos.length === 1 && el('onb-arqs').children.length === 1 && el('onb-arqs').children[0].children[0].textContent === 'visto.png');
ev('change', { id: 'onb-file', files: [arq('script.js', 'text/javascript')], value: 'x' });
check('arquivo recusado mostra o motivo na tela', el('onb-erro').hidden === false && /só PDF, JPG ou PNG/.test(el('onb-erro').textContent));
ev('input', { id: 'onb-email', value: ' ana@example.com ' });
ev('input', { id: 'onb-notas', value: 'Quer estudar FLE.' });
check('o que se digita fica guardado (e o erro some ao digitar o e-mail)', mod.getONB().email === ' ana@example.com ' && mod.getONB().notas === 'Quer estudar FLE.' && el('onb-erro').hidden === true);
const zona = { id: '', c: null }; zona.classList = { add(c) { zona.c = c; }, remove() { zona.c = null; } };
let impediu = 0;
handlers.dragover.forEach((hd) => hd({ target: { closest: (s) => (s === '#onb-drop' ? zona : null) }, preventDefault() { impediu++; } }));
check('arrastar sobre a área liga o destaque e libera o soltar', zona.c === 'arrastando' && impediu === 1);
handlers.dragover.forEach((hd) => hd({ target: { closest: () => null }, preventDefault() { impediu++; } }));
check('arrastar fora da área não mexe em nada', impediu === 1);
handlers.drop.forEach((hd) => hd({ target: { closest: (s) => (s === '#onb-drop' ? zona : null) }, preventDefault() {}, dataTransfer: { files: [arq('soltado.jpg', 'image/jpeg', 500, { lastModified: 77 })] } }));
check('soltar arquivos na área adiciona', mod.getONB().arquivos.map((f) => f.name).join() === 'visto.png,soltado.jpg' && zona.c === null);

console.log('\n== Enviar: validações no navegador ==');
chamadas = []; fakeFetch([]);
mod.setONB({ fase: 'form', arquivos: [arq('a.pdf', 'application/pdf')], email: '', notas: '', erro: '', ia: null });
mod.renderOnboarding();
await click({}, 'onb-enviar');
check('sem e-mail: pede o e-mail e não chama o Worker', /e-mail/.test(el('onb-erro').textContent) && !chamadas.some((c) => /ler/.test(c.url)));
mod.setONB({ fase: 'form', arquivos: [], email: 'ana@example.com', notas: '', erro: '', ia: null });
mod.renderOnboarding();
await click({}, 'onb-enviar');
check('sem documento: pede um documento e não chama o Worker', /pelo menos um documento/.test(el('onb-erro').textContent) && !chamadas.some((c) => /ler/.test(c.url)));
mod.setONB({ fase: 'form', arquivos: [arq('a.pdf', 'application/pdf')], email: 'sem-arroba', notas: '', erro: '', ia: null });
await click({}, 'onb-enviar');
check('e-mail inválido: não chama o Worker', !chamadas.some((c) => /ler/.test(c.url)));

console.log('\n== Enviar: progresso, erro com "tentar de novo", sucesso ==');
const NOVO = { id: 'n1', email: 'ana@example.com', nome: 'Ana Silva', estagio: 'lead', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
let vistoDuranteLeitura = null;
const f1 = new File([new Uint8Array(5000)], 'passaporte.pdf', { type: 'application/pdf' });
mod.setONB({ fase: 'form', arquivos: [f1], email: ' Ana@Example.com ', notas: 'Quer FLE em Lyon.', erro: '', ia: null });
chamadas = [];
fakeFetch([[/onboarding\/ler$/, () => { vistoDuranteLeitura = el('onb-page').innerHTML; return { status: 502, body: { error: 'Os créditos da API da Anthropic acabaram. ' + XSS, codigo: 'creditos_ia' } }; }]]);
await click({}, 'onb-enviar');
check('durante a leitura mostra o progresso (esqueleto, aria-busy), sem o formulário', /aria-busy="true"/.test(vistoDuranteLeitura) && /Lendo o documento/.test(vistoDuranteLeitura) && /onb-sk/.test(vistoDuranteLeitura) && !vistoDuranteLeitura.includes('id="onb-email"'));
const ler = chamadas.find((c) => /onboarding\/ler$/.test(c.url));
check('POST para o Worker com o token da admin (sem Content-Type: o navegador põe o multipart)', ler.opt.method === 'POST' && ler.opt.headers.Authorization === 'Bearer tok' && !('Content-Type' in ler.opt.headers));
check('o corpo é um formulário com e-mail aparado, anotações e o arquivo', ler.opt.body instanceof FormData && ler.opt.body.get('email') === 'Ana@Example.com' && ler.opt.body.get('anotacoes') === 'Quer FLE em Lyon.' && ler.opt.body.getAll('arquivos').length === 1);
check('erro do Worker: volta ao formulário com a mensagem em textContent', mod.getONB().fase === 'erro' && el('onb-erro').textContent.includes('créditos da API') && el('onb-erro').hidden === false);
check('a mensagem do servidor com HTML nunca vira HTML', !el('onb-page').innerHTML.includes('onerror') && el('onb-erro').textContent.includes(XSS));
check('mostra "Tentar de novo" e garante que nada foi salvo', el('onb-enviar').textContent === 'Tentar de novo' && /Nada foi salvo/.test(el('onb-enviar').parentNode.children.map((c) => c.textContent).join()));
check('os arquivos e as anotações continuam lá para tentar de novo', mod.getONB().arquivos.length === 1 && mod.getONB().notas === 'Quer FLE em Lyon.' && el('onb-email').value === ' Ana@Example.com ');

chamadas = [];
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await click({}, 'onb-enviar');
check('sem rede: mensagem clara e continua podendo tentar de novo', mod.getONB().fase === 'erro' && /falar com o Worker/.test(el('onb-erro').textContent));

fakeFetch([[/onboarding\/ler$/, { status: 413, body: { error: 'O arquivo 1 passa de 10 MB.' } }]]);
await click({}, 'onb-enviar');
check('erro 413 do Worker aparece como veio', /passa de 10 MB/.test(el('onb-erro').textContent));

// sucesso: a lista de contatos já traz a pessoa nova depois do reload
respostas['crm_contatos'] = { data: [NOVO], error: null };
respostas['contatos:one'] = { data: { dossie: { cidade: 'Lyon' }, user_id: null, dossie_origem: {}, onboarding_em: null }, error: null };
const toasts = [];
chamadas = [];
fakeFetch([[/onboarding\/ler$/, { body: { ok: true, contato_id: 'n1', criado: true, preenchidos: ['nome', 'data_chegada'], ja_preenchidos: ['cidade'], custo_estimado_usd: 0.0123 } }]]);
await click({}, 'onb-enviar');
await new Promise((r) => setTimeout(r, 30));
check('sucesso leva direto à ficha criada', mod.state.view === 'pessoa' && mod.state.sel === 'n1' && mod.state.ptab === 'ficha');
check('a tela solta os arquivos da memória', mod.getONB().arquivos.length === 0 && mod.getONB().email === '' && mod.getONB().fase === 'form');
check('guarda o resumo para a ficha', mod.state.onbResumo.cid === 'n1' && mod.state.onbResumo.preenchidos.join() === 'nome,data_chegada' && mod.state.onbResumo.ja.join() === 'cidade');
check('o toast avisa que a ficha foi criada', /Ficha criada/.test(el('toast').textContent));
const pag = el('pessoa-page').innerHTML;
check('a ficha mostra o resumo do Onboarding: o que entrou, o que ficou e o custo', pag.includes('Ficha criada pelo Onboarding') && pag.includes('2 campos preenchidos') && pag.includes('Já estavam preenchidos e ficaram como você deixou: Cidade onde mora hoje') && pag.includes('US$ 0,0123'));
await click({ onbfechar: '1' });
check('"Entendi" fecha o resumo', mod.state.onbResumo === null);

console.log('\n== Ficha: falta perguntar e origem de cada campo ==');
mod.setC([Object.assign({}, NOVO, { nome: 'Ana Silva' })]);
mod.state.onbResumo = null; mod.state.dosAberto = true;
respostas['contatos:one'] = { data: { dossie: { data_chegada: '2026-09-01', cidade: 'Lyon', trilha_estudo: 'fle' }, user_id: null,
  dossie_origem: { data_chegada: { valor: '2026-09-01', origem: 'documento', confianca: 'alta' }, trilha_estudo: { valor: 'fle', origem: 'anotacao', confianca: 'baixa' },
    cidade: { valor: 'Paris', origem: 'documento', confianca: 'media' }, nome: { valor: 'Ana Silva', origem: 'documento', confianca: 'media' } },
  onboarding_em: '2026-10-23T10:00:00Z' }, error: null };
mod.state.sel = 'n1'; mod.state.view = 'pessoa'; mod.state.ptab = 'ficha';
await mod.renderPessoa();
let fh = el('pessoa-page').innerHTML;
check('"Falta perguntar" no topo, com os campos vazios da situação dela', fh.includes('Falta perguntar') && fh.includes('<span class="dchip falta">Telefone / WhatsApp</span>') && fh.includes('Nível de francês'));
check('não lista o que já foi respondido', !fh.includes('<span class="dchip falta">Data de chegada na França</span>') && !fh.includes('<span class="dchip falta">Cidade onde mora hoje</span>'));
check('"Falta perguntar" vem antes do formulário do Dossiê', fh.indexOf('Falta perguntar') < fh.indexOf('class="dcorpo"'));
check('o campo lido do documento mostra a origem e a confiança', /id="dk-data_chegada"[\s\S]{0,300}Lido do documento · confiança alta/.test(fh));
check('o campo das anotações mostra "Lido das suas anotações" e pede conferir se a confiança é baixa', /Lido das suas anotações · confiança baixa: confira/.test(fh) && /class="orig baixa"/.test(fh));
check('a etiqueta de nome (coluna de contato) também aparece', /id="dk-nome"[\s\S]{0,300}Lido do documento · confiança média/.test(fh));
check('valor que a Ingryd mudou depois: a etiqueta some (cidade foi lida como Paris, hoje é Lyon)', !/id="dk-cidade"[\s\S]{0,300}Lido do documento · confiança média/.test(fh));
mod.state.dos.rasc = { data_chegada: '2026-10-01' };
check('digitar outro valor tira a etiqueta na hora', mod.onbOrigemDe('data_chegada', '2026-10-01') === null && mod.onbOrigemDe('data_chegada', '2026-09-01') !== null);
mod.state.dos.rasc = {};
respostas['contatos:one'] = { data: { dossie: {}, user_id: null }, error: null };
await mod.renderPessoa();
fh = el('pessoa-page').innerHTML;
check('ficha que não passou pelo Onboarding (ou sem o SQL novo) continua igual: sem aviso nem etiqueta', !fh.includes('Falta perguntar') && !fh.includes('Lido do documento'));
respostas['contatos:one'] = { data: { dossie: {}, user_id: null, dossie_origem: {}, onboarding_em: '2026-10-23T10:00:00Z' }, error: null };
await mod.renderPessoa();
check('"Falta perguntar" lista no máximo 12 e conta o resto', /e mais \d+/.test(el('pessoa-page').innerHTML));

console.log('\n== Aba Plataforma: Enviar link de pagamento ==');
const evLista = [];
respostas['eventos'] = { data: evLista, error: null };
respostas['contatos:one'] = { data: { dossie: {}, user_id: null, dossie_origem: {}, onboarding_em: null }, error: null };
mod.state.ptab = 'plataforma';
await mod.renderPessoa();
let ph = el('pessoa-page').innerHTML;
check('tem o botão "Enviar link de pagamento"', ph.includes('data-pagar="n1"') && ph.includes('>Enviar link de pagamento<') && !ph.includes('Reenviar'));
evLista.push({ tipo: 'link_pagamento_enviado', dados: { plano: 'basico_mensal_brl', moeda: 'BRL', rotulo: 'Básico · mensal' }, criado_em: '2026-10-23T15:00:00Z' });
await mod.renderPessoa();
ph = el('pessoa-page').innerHTML;
check('depois do envio mostra "Link enviado em dd/mm" e o botão vira "Reenviar"', /Link enviado em 23\/10/.test(ph) && ph.includes('>Reenviar<') && !ph.includes('>Enviar link de pagamento<'));
check('o rótulo do plano enviado aparece', ph.includes('Básico · mensal'));
respostas['plataforma_cliques'] = { data: [], error: { message: 'relation does not exist' } };
await mod.renderPessoa();
check('mesmo sem a tabela de cliques (SQL pendente) o botão de pagamento está lá', el('pessoa-page').innerHTML.includes('data-pagar="n1"') && el('pessoa-page').innerHTML.includes('Plataforma ainda não ligada'));
delete respostas['plataforma_cliques'];
check('a linha do tempo conhece os dois eventos novos', mod.eventText({ tipo: 'onboarding_documento_lido', dados: { campos: ['nome', 'cidade'] } })[1] === 'Onboarding: documento lido (2 campos preenchidos)'
  && mod.eventText({ tipo: 'link_pagamento_enviado', dados: { rotulo: 'Básico · mensal' } })[1] === 'Link de pagamento enviado: Básico · mensal'
  && mod.eventText({ tipo: 'onboarding_documento_lido', dados: { campos: [] } })[1].includes('nenhum campo'));

console.log('\n== Assinatura (Stripe) na aba Plataforma ==');
respostas['assinaturas:one'] = { data: { status: 'trialing', plano: 'Por Dentro · Básico mensal', moeda: 'BRL', teste_fim: '2026-11-22T10:00:00Z', periodo_fim: '2026-11-22T10:00:00Z', cancela_no_fim: false }, error: null };
mod.state.ptab = 'plataforma';
await mod.renderPessoa();
ph = el('pessoa-page').innerHTML;
check('mostra o status, o plano e até quando vale o teste', /Assinatura:<\/b> em teste grátis · Por Dentro · Básico mensal · teste até 22\/11\/2026/.test(ph));
respostas['assinaturas:one'] = { data: { status: 'active', plano: 'Básico', periodo_fim: '2026-12-22T10:00:00Z', cancela_no_fim: true }, error: null };
await mod.renderPessoa();
check('cancelamento no fim do período aparece', /ativa · Básico · acesso até 22\/12\/2026 · cancela no fim do período/.test(el('pessoa-page').innerHTML));
respostas['assinaturas:one'] = { data: { status: 'past_due', plano: '<img src=x onerror=1>', periodo_fim: '2026-12-22T10:00:00Z' }, error: null };
await mod.renderPessoa();
check('pagamento falhou, e o nome do plano vindo do Stripe passa por esc()', /pagamento falhou/.test(el('pessoa-page').innerHTML) && !el('pessoa-page').innerHTML.includes('<img src=x onerror=1>'));
respostas['assinaturas:one'] = { data: null, error: { message: 'relation "assinaturas" does not exist' } };
await mod.renderPessoa();
check('sem o SQL das assinaturas a ficha continua igual', !el('pessoa-page').innerHTML.includes('Assinatura:') && el('pessoa-page').innerHTML.includes('data-pagar'));
delete respostas['assinaturas:one'];
check('a linha do tempo conhece os eventos do Stripe', mod.eventText({ tipo: 'pagamento_confirmado', dados: { plano: 'Básico', status: 'trialing' } })[1] === 'Pagamento confirmado: Básico (teste grátis)'
  && mod.eventText({ tipo: 'assinatura_atualizada', dados: { status: 'active', cancela_no_fim: true } })[1] === 'Assinatura: ativa (cancela no fim do período)'
  && mod.eventText({ tipo: 'pagamento_falhou', dados: {} })[1] === 'O pagamento falhou' && mod.eventText({ tipo: 'assinatura_cancelada', dados: {} })[1] === 'Assinatura cancelada');

console.log('\n== O arquivo links-pagamento.json ==');
const jsonLinks = JSON.parse(readFileSync(path.resolve(HERE, '../../links-pagamento.json'), 'utf8'));
const itensArq = mod.pagtoItens(jsonLinks);
check('o arquivo versionado tem a estrutura e um item de exemplo marcado', itensArq.length === 1 && itensArq[0].exemplo === true && /EXEMPLO/.test(itensArq[0].rotulo) && /^https:\/\/buy\.stripe\.com\//.test(itensArq[0].url));
check('cada item tem chave, rótulo, moeda e url', jsonLinks.itens.every((i) => ['chave', 'rotulo', 'moeda', 'url'].every((k) => typeof i[k] === 'string')));
check('aceita lista pura ou { itens }', mod.pagtoItens([{ chave: 'a', rotulo: 'A', moeda: 'EUR', url: 'https://buy.stripe.com/x' }]).length === 1);
check('item fora do formato é ignorado, os outros ficam', mod.pagtoItens({ itens: [{ chave: 'Ruim Demais', rotulo: 'x', moeda: 'BRL', url: 'https://buy.stripe.com/x' }, { chave: 'b', rotulo: 'B', moeda: 'real', url: 'https://buy.stripe.com/x' },
  { chave: 'c', rotulo: 'C', moeda: 'BRL', url: 'http://buy.stripe.com/x' }, { chave: 'd', rotulo: 'D', moeda: 'BRL', url: 'https://buy.stripe.com/d' }, null, 'texto'] }).map((i) => i.chave).join() === 'd');
check('arquivo que não é lista não quebra', mod.pagtoItens(null).length === 0 && mod.pagtoItens({}).length === 0 && mod.pagtoItens('x').length === 0);

console.log('\n== Seletor de plano e envio do link ==');
mod.setActive('n1');
const itensReais = { itens: [
  { chave: 'basico_mensal_brl', rotulo: 'Básico · mensal', moeda: 'BRL', url: 'https://buy.stripe.com/aaa' },
  { chave: 'basico_mensal_eur', rotulo: 'Básico · mensal', moeda: 'EUR', url: 'https://buy.stripe.com/bbb' },
  { chave: 'exemplo-nao-usar', rotulo: XSS, moeda: 'BRL', url: 'https://buy.stripe.com/EXEMPLO', exemplo: true }] };
chamadas = [];
fakeFetch([[/links-pagamento\.json/, { body: itensReais }]]);
await mod.abrirLinkPagamento('n1');
const sel = el('pg-plano');
check('lê o links-pagamento.json sem usar cache', chamadas[0].url === 'links-pagamento.json' && chamadas[0].opt.cache === 'no-cache');
check('uma opção por plano e moeda, texto por textContent', sel.children.length === 3 && sel.children[1].textContent === 'Básico · mensal (EUR)' && sel.children[2].textContent.includes(XSS) && !sel.innerHTML.includes('onerror'));
check('o item de exemplo fica desligado e o primeiro real vem escolhido', sel.children[2].disabled === true && sel.value === '0' && el('pg-enviar').disabled === false);
check('mostra para quem vai o e-mail (textContent)', el('pg-email').textContent === 'ana@example.com');
sel.value = '1';
chamadas = [];
fakeFetch([[/link-pagamento$/, { body: { ok: true, enviado_em: '2026-10-23T15:00:00Z' } }]]);
respostas['crm_contatos'] = { data: [NOVO], error: null };
await mod.enviarLinkPagamento(el('pg-enviar'));
const lp = chamadas.find((c) => /\/api\/crm\/link-pagamento$/.test(c.url));
const corpo = JSON.parse(lp.opt.body);
check('manda o plano escolhido ao Worker, com o token da admin', lp.opt.method === 'POST' && lp.opt.headers.Authorization === 'Bearer tok' && corpo.contato_id === 'n1' && corpo.chave === 'basico_mensal_eur'
  && corpo.moeda === 'EUR' && corpo.url === 'https://buy.stripe.com/bbb' && corpo.rotulo === 'Básico · mensal');
check('não manda e-mail da pessoa nem id extra no endereço (o Worker acrescenta)', !/prefilled_email|client_reference_id/.test(lp.opt.body));
check('sucesso: fecha o pop-up e avisa', el('compose-modal').hidden === true && /Link de pagamento enviado/.test(el('toast').textContent));
await mod.abrirLinkPagamento('n1');
el('pg-plano').value = '2';
chamadas = [];
await mod.enviarLinkPagamento(el('pg-enviar'));
check('item de exemplo nunca é enviado', !chamadas.some((c) => /link-pagamento$/.test(c.url)) && el('pg-err').hidden === false);
el('pg-plano').value = '0';
fakeFetch([[/link-pagamento$/, { status: 502, body: { error: 'O Brevo recusou o envio (401). ' + XSS } }]]);
const bt = el('pg-enviar'); bt.textContent = 'Enviar e-mail';
await mod.enviarLinkPagamento(bt);
check('erro do Worker aparece no pop-up (como texto) e o botão volta', el('pg-err').hidden === false && el('pg-err').textContent.includes('Brevo recusou') && el('pg-err').textContent.includes(XSS) && bt.disabled === false && bt.textContent === 'Enviar e-mail');
// arquivo ausente ou vazio: o pop-up explica e não deixa enviar
for (const [rotulo, rota] of [['não existe (404)', [/links-pagamento\.json/, { status: 404, body: {} }]], ['está sem planos', [/links-pagamento\.json/, { body: { itens: [] } }]]]) {
  fakeFetch([rota]);
  // o crm.js guarda a lista lida: reabre o seletor com a lista limpa (cada rodada vale por uma sessão nova do painel)
  mod.setPagto && mod.setPagto({ itens: null, erro: '' });
  els.delete('pg-plano'); els.delete('pg-err'); els.delete('pg-enviar');
  await mod.abrirLinkPagamento('n1');
  check('links-pagamento.json ' + rotulo + ': o pop-up explica e o envio fica desligado', el('pg-err').hidden === false && /links-pagamento\.json/.test(el('pg-err').textContent) && el('pg-enviar').disabled === true);
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
