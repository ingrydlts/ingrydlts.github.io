// Testa o campo "Link do Notion" + botão "Ler do Notion" da tela Onboarding (os 4 estados) e o bloco do Notion dentro do Pós-call da
// ficha, rodando o crm.js de verdade em Node com um navegador, um Worker e um Supabase de mentira. Páginas e pessoas fictícias.
// NÃO testa nada em navegador real (layout em 380 px, foco, toque): isso é conferir à mão (README do Worker, seção 31).
//
// Uso: cd admin/crm/db/testes && node crm-onboarding-notion-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');
const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, disabled: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false, classList: { add() {}, remove() {} } });
  return els.get(id);
}
const document = { getElementById: el, createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }), addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null };
const rpcs = [];
let respostas = {};
function qb(table) {
  const b = new Proxy({}, { get(_, k) {
    if (k === 'maybeSingle') return async () => respostas[table + ':one'] || { data: null, error: null };
    if (k === 'update') return () => ({ eq: async () => ({ error: null }) });
    if (k === 'insert') return async () => ({ error: null });
    if (k === 'then') return (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko);
    return () => b;
  } });
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u' } } } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: null }; } };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, renderOnboarding, carregarOnboarding, getONT: function () { return ONT; }, setONT: function (v) { ONT = v; }, setONB: function (v) { ONB = v; } };')(
  supabase, {}, document, { addEventListener() {}, scrollTo() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (ds, id = '') => { const b = { id, dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); await wait(15); return b; };
const digita = (v) => handlers.input.forEach((h) => h({ target: { id: 'ont-url', value: v } }));
const box = () => el('ont-box').innerHTML;
const CID = '11111111-2222-4333-8444-555555555555';
const XSS = '<img src=x onerror=alert(1)>';
const URL_OK = 'https://www.notion.so/Ligacao-ficticia-abcdef0123456789abcdef0123456789';
const base = { id: CID, email: 'ana.exemplo@example.org', nome: 'Ana Exemplo', estagio: 'em_uso', urgencia: 'baixa', persona: 'campus_france', fase: 'planejando' };
respostas.crm_contatos = { data: [Object.assign({}, base)], error: null };
mod.setC([Object.assign({}, base)]);

let status = { ia_configurada: true, aviso: null, notion_configurado: true, notion_aviso: null };
let bilan = async () => ({ body: {} });
let leitura = null;   // função(opt) → { status, body } (ou uma promessa)
const pedidos = [];
globalThis.fetch = async (url, opt = {}) => {
  pedidos.push({ url: String(url), opt });
  if (/onboarding\/status$/.test(url)) return new Response(JSON.stringify(status), { status: 200 });
  if (/onboarding\/bilan-email$/.test(url)) { const r = await bilan(JSON.parse(opt.body)); return new Response(JSON.stringify(r.body), { status: r.status || 200 }); }
  if (/onboarding\/notion\/ler$/.test(url)) { const r = await leitura(opt); return new Response(JSON.stringify(r.body), { status: r.status || 200 }); }
  return new Response('{}', { status: 404 });
};
const lidos = () => pedidos.filter((p) => /notion\/ler$/.test(p.url));

const RESUMO = { ok: true, contato_id: CID, criado: true, reutilizada: false, proposta_id: 50, email: 'ana.exemplo@example.org', pessoa: 'Ana Exemplo', persona: 'campus_france', fase: 'planejando',
  avisos: ['O consentimento de gravação NÃO está marcado na página. Confirme com a pessoa antes de seguir (isto não bloqueia a leitura).'],
  na_proposta: { campos: ['telefone', 'maior_preocupacao', 'ligacao_resumo', 'proximos_passos'], pendencias: 3, abertas: 1, aguardando_ela: 1, concluidas: 1, lembretes: 2, canais_lembrete: ['Convite de acesso', 'Instagram'], linhas_email: 1, rascunho_email: true, faltam: 2 },
  de_fora: { so_eu: 1, fora_do_crm: 2 }, blocos_ignorados: { unsupported: 1 } };

console.log('== Tela e menu ==');
const html = readFileSync(path.resolve(HERE, '../../index.html'), 'utf8');
check('o texto da tela fala do Notion e diz que nada é enviado', /Cole o link da ligação no Notion/.test(html) && /Nada é enviado a ninguém/.test(html));
const vCss = (/crm\.css\?v=(\d{4}-\d{2}-\d{2}\.\d+)/.exec(html) || [])[1], vJs = (/crm\.js\?v=(\d{4}-\d{2}-\d{2}\.\d+)/.exec(html) || [])[1];
check('a versão (cache) do CSS e do JS avançou e é a mesma nos dois', !!vCss && vCss === vJs && vJs > '2026-10-29.9');
const css = readFileSync(path.resolve(HERE, '../../crm.css'), 'utf8');
check('o campo de link tem o mesmo estilo do campo de e-mail', /\.onb input\[type="url"\]/.test(css));
check('texto longo quebra de linha (nada estoura em 380 px)', /\.ont-pend\{[^}]*overflow-wrap:anywhere/.test(css) && /\.ont-lista\{[^}]*overflow-wrap:anywhere/.test(css) && /\.ont-rascunho\{[^}]*pre-wrap[^}]*overflow-wrap:anywhere|\.ont-rascunho\{[^}]*overflow-wrap:anywhere[^}]*pre-wrap/.test(css));
check('em tela estreita os botões ocupam a linha toda', /@media \(max-width: 520px\)\{[^}]*\.onb-acoes \.btn\{[^}]*flex:1 1 100%/.test(css));

console.log('\n== Estado VAZIO ==');
mod.state.view = 'onboarding';
await mod.carregarOnboarding();
let h = box();
check('tem o campo "Link do Notion" (url, sem autocompletar) e o botão "Ler do Notion"', /for="ont-url">Link do Notion</.test(h) && /id="ont-url" type="url" autocomplete="off"/.test(h) && />Ler do Notion</.test(h));
check('estado vazio explica o que fazer', /Nenhuma ligação lida ainda/.test(h));
check('a dica diz que só lê, não escreve e não envia', /só lê: não escreve no Notion e não envia nada a ninguém/.test(h) && /bilan-notion/.test(h));
check('Notion configurado: sem aviso e o botão liberado', !/onb-aviso/.test(h) && !/id="ont-ler" disabled/.test(h));
check('o campo de documentos continua na tela', /id="onb-email"/.test(el('onb-page').innerHTML) && /id="onb-drop"/.test(el('onb-page').innerHTML));
check('pergunta o status ao Worker (que agora diz se o Notion está ligado)', pedidos.some((p) => /onboarding\/status$/.test(p.url) && p.opt.headers.Authorization === 'Bearer tok'));

console.log('\n== Notion NÃO configurado ==');
status = { ia_configurada: true, aviso: null, notion_configurado: false, notion_aviso: 'A leitura do Notion ainda não está ligada: falta o secret NOTION_TOKEN no Worker (README, seção 31). A ficha manual continua funcionando.' };
await mod.carregarOnboarding();
h = box();
check('mostra o aviso do Worker (NOTION_TOKEN) e diz que o resto funciona', /onb-aviso/.test(h) && /NOTION_TOKEN/.test(h) && /continuam funcionando/.test(h));
check('o botão fica desligado', /id="ont-ler" disabled/.test(h));
status = { ia_configurada: true, aviso: null };   // Worker antigo: não manda o campo
await mod.carregarOnboarding();
check('Worker antigo (sem o campo): não trava o botão', !/id="ont-ler" disabled/.test(box()));
status = { ia_configurada: true, aviso: null, notion_configurado: true, notion_aviso: null };
await mod.carregarOnboarding();

console.log('\n== Validação no navegador ==');
digita('');
await click({}, 'ont-ler');
check('sem link: erro claro e nada vai ao Worker', /Cole o link da página do Notion/.test(box()) && /role="alert"/.test(box()) && lidos().length === 0);
digita('http://www.notion.so/x');
await click({}, 'ont-ler');
check('link sem https: erro claro e nada vai ao Worker', /precisa começar com https/.test(box()) && lidos().length === 0);
check('depois do erro o botão vira "Tentar de novo" e o link digitado continua no campo', />Tentar de novo</.test(box()) && el('ont-url').value === 'http://www.notion.so/x');

console.log('\n== Estado CARREGANDO (esqueleto) ==');
let solta; leitura = () => new Promise((r) => { solta = r; });
digita(URL_OK);
const pendente = click({}, 'ont-ler');
await wait(15);
h = box();
check('mostra o esqueleto, avisa que está lendo (aria-busy) e desliga o botão e o campo', /onb-sk/.test(h) && /aria-busy="true"/.test(h) && /Lendo a página do Notion/.test(h) && /id="ont-ler" disabled>Lendo…</.test(h) && /id="ont-url"[^>]* disabled/.test(h));
check('o pedido foi um POST com o link e o token da admin (e só isso)', lidos().length === 1 && lidos()[0].opt.method === 'POST' && lidos()[0].opt.headers.Authorization === 'Bearer tok' && JSON.stringify(JSON.parse(lidos()[0].opt.body)) === JSON.stringify({ url: URL_OK }));
solta({ status: 422, body: { error: 'O Status da ligação é “Gravada”. Só leio quando estiver “Bilan pronto”: rode a skill /bilan-notion nela, confira, e tente de novo.', codigo: 'status_nao_pronto' } });
await pendente; await wait(15);

console.log('\n== Estado ERRO (com "tentar de novo") ==');
h = box();
check('mostra a mensagem do Worker dizendo o que falta, num alerta', /role="alert"/.test(h) && /Só leio quando estiver “Bilan pronto”/.test(h));
check('botão "Tentar de novo", e avisa que o link continua e nada foi aplicado', />Tentar de novo</.test(h) && /O link continua aqui\. Nada foi aplicado na ficha/.test(h) && !/onb-sk/.test(h));
check('o link continua no campo', el('ont-url').value === URL_OK);
leitura = async () => ({ status: 422, body: { error: 'Mensagem com HTML: ' + XSS, codigo: 'x' } });
await click({}, 'ont-ler');
check('o texto do servidor entra escapado (HTML malicioso vira texto)', !/<img src=x/.test(box()) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(box()));
leitura = async () => { throw new TypeError('Failed to fetch'); };
await click({}, 'ont-ler');
check('sem rede: mensagem clara, sem quebrar', /Não consegui falar com o Worker/.test(box()) && />Tentar de novo</.test(box()));
leitura = async () => ({ status: 503, body: { error: 'A leitura do Notion ainda não está ligada: falta o secret NOTION_TOKEN no Worker.', codigo: 'notion_nao_configurada' } });
await click({}, 'ont-ler');
check('Worker sem o secret: mostra o erro claro dele', /NOTION_TOKEN/.test(box()));

console.log('\n== Estado SUCESSO (resumo do que entrou e do que ficou de fora) ==');
rpcs.length = 0;
leitura = async () => ({ status: 200, body: { ...RESUMO, pessoa: 'Ana ' + XSS, avisos: RESUMO.avisos.concat([XSS]) } });
await click({}, 'ont-ler'); await wait(20);
h = box();
check('diz que a ficha foi criada e para quem', /Ficha criada: Ana/.test(h) && /ana\.exemplo@example\.org/.test(h));
check('diz que NADA foi aplicado nem enviado: tudo ficou como proposta pendente', /Nada foi aplicado na ficha e nada foi enviado/.test(h) && /proposta pendente/.test(h));
check('o que entrou: fatos do Dossiê (com o nome dos campos)', /Entrou na proposta \(pendente\)/.test(h) && /4 fatos do Dossiê/.test(h) && /Telefone/.test(h));
check('o que entrou: pendências com a contagem por estado', /3 pendências da Plataforma/.test(h) && /1 abertas, 1 aguardando ela, 1 concluídas/.test(h));
check('o que entrou: lembretes, e-mail e tarefas', /2 lembretes para você/.test(h) && /Convite de acesso e Instagram/.test(h) && /Rascunho de e-mail<\/b> pronto/.test(h) && /1 linha de pendência por e-mail/.test(h) && /2 tarefas<\/b> em “Faltam para o CRM”/.test(h));
check('o que ficou de fora: "Só eu" e "Fora do CRM" contados, sem virar nada; persona só como sugestão', /Ficou de fora/.test(h) && /1 linha\(s\) “Só eu” e 2 “Fora do CRM”: não viram nada na ficha/.test(h) && /Persona no Notion: <b>campus_france<\/b>/.test(h) && /não muda persona nem fase/.test(h));
check('o aviso do consentimento aparece (e não bloqueia)', /onb-aviso/.test(h) && /consentimento de gravação NÃO está marcado/.test(h) && /2 avisos/.test(h));
check('texto de terceiros (nome e avisos) entra escapado', !/<img src=x/.test(h) && (h.match(/&lt;img src=x onerror=alert\(1\)&gt;/g) || []).length === 2);
check('botões: "Abrir a ficha e aplicar" e "Ler outra ligação"; o campo some', /id="ont-abrir"/.test(h) && /id="ont-outra"/.test(h) && !/id="ont-url"/.test(h));
check('a leitura não aplicou nada no banco pelo navegador (nenhum rpc)', rpcs.length === 0);
check('a ficha criada pelo Onboarding abre sozinha em Plataforma → Interações, com o resumo guardado', mod.state.view === 'pessoa' && mod.state.sel === CID && mod.state.ptab === 'plataforma' && mod.state.pstab === 'interacoes' && !!mod.state.ontResumo && mod.state.ontResumo.contato_id === CID);

console.log('\n== Abrir a ficha e ler outra ligação ==');
mod.state.dosAberto = true;
respostas['contatos:one'] = { data: { dossie: {}, user_id: null }, error: null };
mod.state.pstab = 'assistente'; mod.state.ptab = 'ficha'; mod.state.view = 'onboarding';
mod.setONT({ fase: 'ok', url: URL_OK, erro: '', res: RESUMO });
await click({}, 'ont-abrir');
check('"Abrir a ficha e aplicar" abre a ficha em Plataforma → Interações', mod.state.sel === CID && mod.state.view === 'pessoa' && mod.state.ptab === 'plataforma' && mod.state.pstab === 'interacoes');
mod.state.view = 'onboarding';
await click({}, 'ont-outra');
check('"Ler outra ligação" volta ao estado vazio, com o campo limpo', /Nenhuma ligação lida ainda/.test(box()) && mod.getONT().url === '' && el('ont-url').value === '');
leitura = async () => ({ status: 200, body: { ...RESUMO, reutilizada: true, criado: false } });
digita(URL_OK);
handlers.keydown.forEach((hd) => hd({ key: 'Enter', target: { id: 'ont-url', matches: () => false }, preventDefault() {} }));
await wait(30);
check('Enter no campo lê (como o botão) e avisa que a proposta já estava pendente', /Ficha encontrada/.test(box()) && /já tinha sido lida e a proposta continua pendente/.test(box()));

// ================= A ficha: o bloco do Notion dentro do Pós-call =================
const PROP = {
  origem: 'notion',
  notion: { pagina: 'abcdef0123456789abcdef0123456789', editada_em: '2026-10-29T12:00:00.000Z', pessoa: 'Ana Exemplo', persona: 'campus_france', fase: 'planejando', objetivo: 'Estudar FLE em Lyon.', dores: ['Prazo'],
    documentos_pendentes: 'Passaporte', prazo_chave: { texto: '2026-12-01', data: '2026-12-01', a_confirmar: false }, consentimento: false, enviado_ao_crm: false, id_no_crm: '',
    pendencias: [
      { n: 1, titulo: 'Anexar o passaporte ' + XSS, dono: 'Ela', canal: 'Plataforma', botao: 'anexar_documento', botao_obs: 'passaporte e visto', prazo: { texto: '15/12/2026 (a confirmar)', data: null, a_confirmar: true }, estado: 'aberta', origem_certeza: 'Documento · alta' },
      { n: 2, titulo: 'Marcar o prazo do Campus France', dono: 'Ela', canal: 'Plataforma', botao: 'pesquisar', botoes: ['pesquisar', 'gerar_rascunho'], botao_obs: '', prazo: { texto: '2026-11-30', data: '2026-11-30', a_confirmar: false }, estado: 'aguardando_ela', origem_certeza: 'Fala · média' },
      { n: 6, titulo: 'Reservar o horário no consulado', dono: 'Ela', canal: 'Plataforma', botao: 'lembrar_ela', botao_obs: '', prazo: { texto: '2026-12-05 (a confirmar)', data: '2026-12-05', a_confirmar: true }, estado: 'aberta', origem_certeza: '' },
      { n: 3, titulo: 'Conferir a carta de aceite', dono: 'Ingryd', canal: 'Plataforma', botao: 'n/a', botao_obs: '', prazo: { texto: '', data: null, a_confirmar: false }, estado: 'concluida', origem_certeza: '' }],
    lembretes: [{ n: 5, titulo: 'Mandar o convite de acesso', dono: 'Ingryd', canal: 'Convite de acesso', botao: 'enviar_convite', botao_obs: '', prazo: { texto: '', data: null, a_confirmar: false }, estado: 'aberta', origem_certeza: 'Combinado' }],
    email: { linhas: [{ n: 4, titulo: 'Pedir a tradução juramentada', dono: 'Ela', canal: 'E-mail', botao: 'gerar_rascunho', botao_obs: '', prazo: { texto: '10/12/2026', data: '2026-12-10', a_confirmar: false }, estado: 'aberta', origem_certeza: 'Fala · alta' }], rascunho: 'Oi, Ana!\nSegue a lista do que falta.\n' + XSS },
    faltam: [{ texto: 'Confirmar o WhatsApp', feito: false }, { texto: 'Pedir o consentimento por escrito', feito: true }], fora: { so_eu: 1, fora_do_crm: 1 },
    avisos: ['O consentimento de gravação NÃO está marcado na página. Confirme com a pessoa antes de seguir (isto não bloqueia a leitura).'], blocos_ignorados: { unsupported: 1 } },
  mapa_da_call: [], campos: { telefone: { valor: '+33 6 12 34 56 78', confianca: 'alta', trecho: 'Notion · WhatsApp' }, maior_preocupacao: { valor: 'prazo', confianca: 'alta', trecho: 'Notion · Dores e preocupações' },
    proximos_passos: { valor: 'Enviar o passaporte.', confianca: 'alta', trecho: 'Notion · Próximos passos e Documentos pendentes' } },
  sinais: [], perguntas_dela: [], respostas_dadas: [], itens_candidatos: [], perguntas_para_ela: [], a_conferir: []
};
async function ficha(dossie) {
  respostas['contatos:one'] = { data: { dossie: dossie || {}, user_id: null }, error: null };
  mod.state.pc = null; mod.state.sel = CID; mod.state.view = 'pessoa'; mod.state.ptab = 'ficha'; mod.state.dosAberto = true;
  await mod.renderPessoa(); await wait(20);
  return el('poscall-box').innerHTML;
}
console.log('\n== Ficha: proposta PENDENTE do Notion no Pós-call ==');
respostas.pos_call_propostas = { data: [{ id: 50, proposta: PROP, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }], error: null };
h = await ficha();
check('a proposta pendente do Notion reaparece na ficha, sem ler de novo', /Proposta da página do Notion/.test(h) && /Nada entrou na ficha ainda/.test(h));
check('1 · fatos do Dossiê, com caixa para marcar e a confiança', /1 · Fatos/.test(h) && /data-pccampo="telefone" checked/.test(h) && /data-pccampo="maior_preocupacao" checked/.test(h) && /confiança alta/.test(h));
check('2 · pendências com dono, prazo, estado e botão sugerido', /2 · Pendências da Plataforma/.test(h) && /Dono: ela · Prazo: 15\/12\/2026 \(a confirmar\) · Estado: aberta · Botão sugerido: anexar_documento \(passaporte e visto\) · Documento · alta/.test(h));
check('prazo "(a confirmar)" aparece como o TEXTO que veio, e prazo certo como data', /Prazo: 15\/12\/2026 \(a confirmar\)/.test(h) && /Prazo: 30\/11\/2026 · Estado: aguardando ela · Botão sugerido: pesquisar → gerar_rascunho/.test(h) && /Prazo: sem prazo · Estado: concluída/.test(h));
check('mesmo que venha uma data junto, "(a confirmar)" continua aparecendo como texto, nunca como data certa', /Prazo: 2026-12-05 \(a confirmar\)/.test(h) && !/05\/12\/2026/.test(h));
check('pendência concluída fica riscada', /ont-pend feita/.test(h) && (h.match(/class="ont-pend feita"/g) || []).length === 1);
check('avisa que nenhum botão envia nada sozinho', /nenhum botão envia nada sozinho/.test(h) && /pode enviar/.test(h));
check('3 · lembretes para ela, com o canal', /3 · Lembretes para você/.test(h) && /Mandar o convite de acesso/.test(h) && /Convite de acesso<\/span>/.test(h));
check('4 · e-mail: a linha de pendência e o rascunho único, com "Copiar"', /4 · E-mail/.test(h) && /Pedir a tradução juramentada/.test(h) && /<pre class="ont-rascunho">Oi, Ana!\nSegue a lista/.test(h) && /data-ontcopiar="1">Copiar o rascunho</.test(h));
check('5 · "Faltam para o CRM" com ☐ e ☑', /5 · Faltam para o CRM/.test(h) && /☐ Confirmar o WhatsApp/.test(h) && /☑ Pedir o consentimento por escrito/.test(h));
check('de fora: "Só eu" e "Fora do CRM" só contados; persona e fase só como sugestão', /Ficaram de fora[^<]*: 1 e 1/.test(h) && /persona campus_france, fase planejando \(a proposta não muda persona nem fase\)/.test(h));
check('o aviso do consentimento aparece também na ficha', /onb-aviso/.test(h) && /consentimento de gravação NÃO está marcado/.test(h));
check('HTML malicioso da página (título e rascunho) entra escapado', !/<img src=x/.test(h) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(h));
check('não aparecem as seções de ligação por transcrição (sinais, itens, perguntas)', !/Sinais \(leitura/.test(h) && !/Padrão ou individual/.test(h) && !/Perguntas para confirmar/.test(h));
check('os botões "Aplicar o que marquei" e "Descartar a proposta" existem', /data-pcaplicar="/.test(h) && /data-pcdescartar="/.test(h));
rpcs.length = 0;
await click({ pcaplicar: CID });
const ap = rpcs.find((r) => r.n === 'crm_pos_call_aplicar');
check('aplicar manda só os fatos marcados do Dossiê para crm_pos_call_aplicar, sem fila e sem sinais', !!ap && ap.a.p_proposta === 50 && Object.keys(ap.a.p_campos).sort().join() === 'maior_preocupacao,proximos_passos,telefone' && ap.a.p_fila.length === 0 && !('sinais' in ap.a.p_campos));
check('o que a página tem de persona/fase não vai no aplicar', !('persona' in ap.a.p_campos) && !('fase' in ap.a.p_campos) && !('nome' in ap.a.p_campos));
check('nenhum outro rpc foi chamado (nada de e-mail, convite, envio)', rpcs.filter((r) => r.n !== 'crm_pos_call_aplicar' && r.n !== 'crm_curadoria_contagem').length === 0);
h = await ficha({ telefone: '+33 1 00 00 00 00' });
check('o que a Ingryd já digitou não vem marcado (e mostra o valor de hoje)', /data-pccampo="telefone"(?! checked)/.test(h) && /hoje: \+33 1 00 00 00 00/.test(h) && /data-pccampo="maior_preocupacao" checked/.test(h));
rpcs.length = 0;
await click({ pcdescartar: CID });
check('descartar chama só crm_pos_call_descartar', rpcs.some((r) => r.n === 'crm_pos_call_descartar' && r.a.p_proposta === 50));

console.log('\n== Ficha: copiar o rascunho (nada é enviado) ==');
respostas.pos_call_propostas = { data: [{ id: 50, proposta: PROP, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }], error: null };
await ficha();
let copiado = null;
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (t) => { copiado = t; } } }, configurable: true });
await click({ ontcopiar: '1' });
check('copia o rascunho para a área de transferência, e só isso', copiado === PROP.notion.email.rascunho && /Rascunho copiado\. Nada foi enviado/.test(el('toast').textContent) && !pedidos.some((p) => /brevo|enviar|responder|chat-aviso|link-pagamento/.test(p.url)));
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('negado'); } } }, configurable: true });
await click({ ontcopiar: '1' });
check('sem permissão para copiar: avisa, sem quebrar', /Não consegui copiar/.test(el('toast').textContent));

console.log('\n== Ficha: leitura do Notion já aplicada (só consulta) ==');
respostas.pos_call_propostas = { data: [{ id: 50, proposta: PROP, status: 'aplicada', criado_em: '2026-10-30T10:00:00Z' }], error: null };
h = await ficha();
check('mostra as pendências, lembretes e o rascunho como consulta', /Última ligação lida do Notion \(já aplicada em 30\/10\/2026\)/.test(h) && /2 · Pendências da Plataforma/.test(h) && /Oi, Ana!/.test(h));
check('não oferece "Aplicar" de novo', !/data-pcaplicar="/.test(h.split('pcnotion-lido')[1] || '') && !/Proposta da página do Notion/.test(h));
console.log('\n== Ficha: o que não é do Notion não muda ==');
respostas.pos_call_propostas = { data: [{ id: 51, proposta: { campos: {}, sinais: [] }, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }], error: null };
h = await ficha();
check('proposta pendente que não é do Notion não reaparece sozinha (segue o fluxo da transcrição)', !/Proposta da página do Notion/.test(h) && /Ler a call com IA/.test(h));
respostas.pos_call_propostas = { data: [], error: null };
h = await ficha();
check('sem nenhuma leitura do Notion: o Pós-call é o de sempre', /Ler a call com IA/.test(h) && !/Notion/.test(h));
respostas.pos_call_propostas = { data: null, error: { message: 'relation does not exist' } };
h = await ficha();
check('sem a tabela (SQL do Pós-call não rodou): o Pós-call segue sem quebrar', /Pós-call/.test(h) && !/Proposta da página do Notion/.test(h));


// ================= E-mail com o bilan da conversa (Plataforma → Interações) =================
const PROPB = JSON.parse(JSON.stringify(PROP));
PROPB.notion.resumo = 'PVT perto do fim, quer estudar francês e depois a universidade.';
PROPB.notion.email.linhas.push({ n: 9, titulo: 'Responder: o pagamento do semestre pode vir depois da inscrição?', dono: 'Ingryd', canal: 'E-mail', botao: 'pesquisar', botoes: ['pesquisar', 'gerar_rascunho'], botao_obs: '', prazo: { texto: 'antes de 30/11', data: null, a_confirmar: false }, estado: 'aberta', origem_certeza: '' });
PROPB.notion.pendencias.push({ n: 7, titulo: 'Enviar o PDF das escolas de FLE', dono: 'Ingryd', canal: 'Plataforma', botao: 'anexar_documento', botoes: ['anexar_documento'], botao_obs: '', prazo: { texto: 'n/a', data: null, a_confirmar: false }, estado: 'aberta', origem_certeza: '' });
async function fichaInt(propostas) {
  respostas.pos_call_propostas = { data: propostas, error: null };
  respostas['contatos:one'] = { data: { dossie: {}, user_id: null }, error: null };
  mod.state.pc = null; mod.state.sel = CID; mod.state.view = 'pessoa'; mod.state.ptab = 'plataforma'; mod.state.pstab = 'interacoes'; mod.state.ontResumo = null;
  await mod.renderPessoa(); await wait(20);
  return el('pessoa-page').innerHTML;
}
console.log('\n== Interações: o botão do bilan ==');
h = await fichaInt([{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }]);
check('a subaba Interações tem o botão "Enviar e-mail com bilan da conversa", ligado', /E-mail com o bilan da conversa/.test(h) && /data-bilanabrir="[^"]+"(?! disabled)>Enviar e-mail com bilan da conversa</.test(h));
check('explica as seções fixas e que o conteúdo vem do Bilan d’action', /dúvidas tiradas, próximos passos, o que você responde ou confirma e o código de redução/.test(h) && /Bilan d’action/.test(h));
check('a lista de interações continua abaixo do botão', /Interações na plataforma/.test(h) && h.indexOf('bilan-box') < h.indexOf('Interações na plataforma'));
h = await fichaInt([{ id: 50, proposta: PROPB, status: 'aplicada', criado_em: '2026-10-30T10:00:00Z' }]);
check('leitura já aplicada também serve de base', /data-bilanabrir="[^"]+"(?! disabled)>/.test(h));
h = await fichaInt([{ id: 51, proposta: PROPB, status: 'descartada', criado_em: '2026-10-30T11:00:00Z' }, { id: 50, proposta: PROPB, status: 'aplicada', criado_em: '2026-10-30T10:00:00Z' }]);
check('proposta descartada é pulada: vale a mais recente que não foi descartada', /data-bilanabrir="[^"]+"(?! disabled)>/.test(h));
h = await fichaInt([]);
check('sem leitura do Notion: o botão fica desligado e diz o que fazer', /data-bilanabrir="[^"]+" disabled>/.test(h) && /Cole o link em Onboarding → Link do Notion/.test(h));
h = await fichaInt([{ id: 51, proposta: PROPB, status: 'descartada', criado_em: '2026-10-30T11:00:00Z' }]);
check('só proposta descartada: botão desligado', /data-bilanabrir="[^"]+" disabled>/.test(h));
respostas.pos_call_propostas = { data: [{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }], error: null };
mod.state.ontResumo = null; mod.state.sel = CID; mod.state.ptab = 'plataforma'; mod.state.pstab = 'interacoes';
await mod.renderPessoa(); await wait(20); mod.state.ontResumo = Object.assign({}, RESUMO, { pessoa: 'Ana ' + XSS }); mod.state.view = 'pessoa';
await mod.renderPessoa(); await wait(20);
h = el('pessoa-page').innerHTML;
check('logo depois da leitura, o resumo do Notion aparece no topo da subaba (escapado)', /Leitura do Notion/.test(h) && /Ficha criada: Ana/.test(h) && !/<img src=x/.test(h) && /data-ontresfechar="1"/.test(h));
await click({ ontresfechar: '1' });
check('"Entendi" tira o resumo da tela', mod.state.ontResumo === null);

console.log('\n== Modal do e-mail do bilan ==');
await fichaInt([{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }]);
const prevs = []; bilan = async (b) => { prevs.push(b); return { body: { ok: true, enviado: false, assunto: 'Ana, o bilan da nossa conversa · Por Dentro', html: '<p>prévia</p>', texto: 't', para: 'ana.exemplo@example.org' } }; };
await click({ bilanabrir: CID });
let m = el('compose-modal').innerHTML;
check('abre o modal com as 4 seções, na ordem e com os títulos fixos', ['1 · Dúvidas que tiramos na conversa', '2 · Seus próximos passos', '3 · O que eu respondo ou confirmo para você', '4 · Código de redução (lista de espera)'].map((t) => m.indexOf(t)).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1])));
check('o texto fixo diz que o desconto vale 6 meses e que ela ganha 7 dias grátis', /6 meses/.test(m) && /7 dias grátis/.test(m));
check('as dúvidas vêm do Resumo quando a página não tem "Dúvidas tiradas" (e avisa)', el('bl-duvidas').value === PROPB.notion.resumo && /não tem “Dúvidas tiradas”/.test(m));
check('próximos passos = só o que é dela e ainda não foi feito, com o prazo (e "a confirmar" preservado)', el('bl-proximos').value.split('\n').length === 4 && /^Anexar o passaporte/.test(el('bl-proximos').value) && /\(prazo: 15\/12\/2026 \(a confirmar\)\)/.test(el('bl-proximos').value) && /Pedir a tradução juramentada \(prazo: 10\/12\/2026\)/.test(el('bl-proximos').value) && !/Conferir a carta de aceite/.test(el('bl-proximos').value));
check('o que eu respondo ou confirmo = o que é da Ingryd (e-mail e plataforma), sem o que já está concluído e sem lembretes internos', el('bl-respostas').value === 'Enviar o PDF das escolas de FLE\nResponder: o pagamento do semestre pode vir depois da inscrição?');
check('HTML da página entra como valor do campo, nunca como marcação do modal', !/<img src=x/.test(m) && /<img src=x onerror=alert\(1\)>/.test(el('bl-proximos').value));
check('o modal mostra para quem vai e o campo de código vazio', /id="bl-para"/.test(m) && el('bl-para').textContent === 'ana.exemplo@example.org' && el('bl-codigo').value === '');
check('a prévia é pedida ao abrir, sem enviar, e usa um código provisório enquanto está vazio', prevs.length === 1 && prevs[0].enviar === undefined && prevs[0].codigo === 'SEU-CODIGO' && prevs[0].contato_id === CID && prevs[0].secoes.duvidas.length === 1 && prevs[0].secoes.proximos.length === 4 && prevs[0].secoes.respostas.length === 2);
check('a prévia aparece num iframe isolado (sandbox), com o assunto e o aviso de código não digitado', /<iframe class="cmpframe" sandbox="allow-popups"/.test(el('bl-previa').innerHTML) && /o código ainda não foi digitado/.test(el('bl-previa').innerHTML) && el('bl-assunto').textContent === 'Ana, o bilan da nossa conversa · Por Dentro');
check('o pedido do bilan leva o token da admin', pedidos.filter((p) => /bilan-email$/.test(p.url)).every((p) => p.opt.headers.Authorization === 'Bearer tok'));

console.log('\n== Enviar: só com código e com o "pode enviar" ==');
const enviados = () => prevs.filter((b) => b.enviar === true);
el('bl-codigo').value = '';
await click({}, 'bl-enviar');
check('sem código: erro claro e nada enviado', /Digite o código de redução/.test(el('bl-err').textContent) && el('bl-err').hidden === false && enviados().length === 0);
el('bl-codigo').value = 'LISTA-ESPERA25';
await click({}, 'bl-enviar');
check('sem marcar que a pessoa aceitou: erro claro e nada enviado', /aceitou receber/.test(el('bl-err').textContent) && enviados().length === 0);
el('bl-confirmo').checked = true;
el('bl-proximos').value = 'Ligar para a escola (editado)\n\n  \nConferir a tradução';
bilan = async (b) => { prevs.push(b); return { status: 409, body: { error: 'O bilan já foi enviado para esta pessoa há menos de 3 dias.', codigo: 'enviado_recentemente' } }; };
await click({}, 'bl-enviar');
check('o envio leva o que você editou (linhas vazias saem), o código, enviar e confirmo', enviados().length === 1 && enviados()[0].codigo === 'LISTA-ESPERA25' && enviados()[0].confirmo === true && enviados()[0].forcar === false && enviados()[0].secoes.proximos.join('|') === 'Ligar para a escola (editado)|Conferir a tradução');
check('enviado há menos de 3 dias: mostra o aviso e oferece "Enviar mesmo assim"', /menos de 3 dias/.test(el('bl-err').textContent) && el('bl-forcar').hidden === false && el('bl-enviar').disabled === false);
bilan = async (b) => { prevs.push(b); return { body: { ok: true, enviado: true, registrado: true, para: 'ana.exemplo@example.org', assunto: 'x' } }; };
await click({}, 'bl-forcar');
check('"Enviar mesmo assim" manda forcar = true', enviados().length === 2 && enviados()[1].forcar === true);
check('depois de enviar: fecha o modal, avisa para quem foi e nada mais sai', el('compose-modal').hidden === true && /Bilan enviado para ana\.exemplo@example\.org/.test(el('toast').textContent));
check('só o Worker foi chamado para enviar: nenhum outro endereço de envio', pedidos.every((p) => !/brevo\.com|link-pagamento|chat-aviso|responder|\/enviar$/.test(p.url)));
await fichaInt([{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }]);
bilan = async () => ({ status: 400, body: { error: 'Digite o código de redução (3 a 40 letras…).', codigo: 'codigo_invalido' } });
await click({ bilanabrir: CID });
el('bl-codigo').value = 'x y'; el('bl-confirmo').checked = true;
await click({}, 'bl-enviar');
check('erro do Worker aparece no modal, o botão volta ao normal e o modal continua aberto', /código de redução/.test(el('bl-err').textContent) && el('bl-enviar').disabled === false && el('bl-enviar').textContent === 'Enviar e-mail' && el('compose-modal').hidden === false && el('bl-forcar').hidden === true);
bilan = async () => { throw new TypeError('Failed to fetch'); };
await click({}, 'bl-previa-btn');
check('sem rede ao pedir a prévia: mensagem clara', /Não consegui falar com o Worker/.test(el('bl-err').textContent));

console.log('\n== Anexos no e-mail do bilan ==');
await fichaInt([{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }]);
prevs.length = 0; bilan = async (b) => { prevs.push(b); return { body: { ok: true, enviado: false, assunto: 'x', html: '<p>p</p>', anexos: b.anexos.length } }; };
await click({ bilanabrir: CID });
m = el('compose-modal').innerHTML;
check('o modal tem o campo de anexos (PDF, JPG ou PNG), com os limites visíveis', /Anexos \(opcional\)/.test(m) && /id="bl-anexos" type="file" multiple accept="\.pdf,\.jpg,\.jpeg,\.png,application\/pdf,image\/jpeg,image\/png"/.test(m) && /até 5 arquivos · 3 MB no total/.test(m));
const bytesPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 1, 2, 3]);
const arqB = (nome, tipo, tam, extra = {}) => Object.assign({ name: nome, type: tipo, size: tam, lastModified: 1, arrayBuffer: async () => bytesPdf.buffer.slice(0) }, extra);
const escolhe = async (files) => { handlers.change.forEach((hd) => hd({ target: { id: 'bl-anexos', files, value: 'x' } })); await wait(30); };
prevs.length = 0;
await escolhe([arqB('PDF das escolas.pdf', 'application/pdf', 250000), arqB('percurso.png', 'image/png', 1500, { lastModified: 2 })]);
check('os arquivos entram na lista, com nome, tamanho e botão "Tirar"', /PDF das escolas\.pdf/.test(el('bl-anexos-lista').innerHTML) && /244 KB/.test(el('bl-anexos-lista').innerHTML) && /data-blrem="1"/.test(el('bl-anexos-lista').innerHTML));
check('a prévia é atualizada e leva só nome e tamanho (nunca o conteúdo)', prevs.length === 1 && prevs[0].anexos.length === 2 && prevs[0].anexos[0].name === 'PDF das escolas.pdf' && prevs[0].anexos[0].size === 250000 && !('b64' in prevs[0].anexos[0]) && prevs[0].enviar === undefined);
await escolhe([arqB('virus.exe', 'application/x-msdownload', 100), arqB('carta.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100, { lastModified: 3 }), arqB('vazio.pdf', 'application/pdf', 0, { lastModified: 4 })]);
check('Word, executável e arquivo vazio são recusados, com o motivo, e a lista não muda', /só PDF, JPG ou PNG/.test(el('bl-err').textContent) && /vazio/.test(el('bl-err').textContent) && (el('bl-anexos-lista').innerHTML.match(/data-blrem/g) || []).length === 2);
await escolhe([arqB('grande.pdf', 'application/pdf', 3 * 1048576, { lastModified: 5 })]);
check('passou de 3 MB no total: recusa com o motivo', /passariam de 3 MB/.test(el('bl-err').textContent) && (el('bl-anexos-lista').innerHTML.match(/data-blrem/g) || []).length === 2);
await escolhe([arqB('PDF das escolas.pdf', 'application/pdf', 250000)]);
check('o mesmo arquivo duas vezes entra uma só', (el('bl-anexos-lista').innerHTML.match(/data-blrem/g) || []).length === 2);
await escolhe([3, 4, 5, 6].map((i) => arqB('a' + i + '.pdf', 'application/pdf', 100, { lastModified: 10 + i })));
check('no máximo 5 anexos', /no máximo 5 anexos/.test(el('bl-err').textContent) && (el('bl-anexos-lista').innerHTML.match(/data-blrem/g) || []).length === 5);
await escolhe([arqB(XSS + '.pdf', 'application/pdf', 100, { lastModified: 99 })]);
check('nome de arquivo com HTML malicioso entra escapado', !/<img src=x/.test(el('bl-anexos-lista').innerHTML));
prevs.length = 0;
await click({ blrem: '4' }); await click({ blrem: '3' }); await click({ blrem: '2' });
check('"Tirar" remove só aquele e atualiza a prévia', (el('bl-anexos-lista').innerHTML.match(/data-blrem/g) || []).length === 2 && prevs.length === 3 && prevs[2].anexos.length === 2);
el('bl-codigo').value = 'LISTA-ESPERA25'; el('bl-confirmo').checked = true;
prevs.length = 0; bilan = async (b) => { prevs.push(b); return { body: { ok: true, enviado: true, registrado: true, para: 'ana.exemplo@example.org', anexos: b.anexos.length } }; };
await click({}, 'bl-enviar');
const env1 = prevs.filter((b) => b.enviar === true)[0];
check('no envio, os arquivos vão em base64 (o conteúdo real do arquivo), com o nome', !!env1 && env1.anexos.length === 2 && env1.anexos[0].name === 'PDF das escolas.pdf' && env1.anexos[0].b64 === Buffer.from(bytesPdf).toString('base64') && !('size' in env1.anexos[0]));
check('avisa quantos anexos foram e fecha o modal', /Bilan enviado para ana\.exemplo@example\.org com 2 anexos/.test(el('toast').textContent) && el('compose-modal').hidden === true);
await fichaInt([{ id: 50, proposta: PROPB, status: 'pendente', criado_em: '2026-10-30T10:00:00Z' }]);
await click({ bilanabrir: CID });
check('um modal novo começa com a lista de anexos vazia', /<ul class="onb-arqs" id="bl-anexos-lista"><\/ul>/.test(el('compose-modal').innerHTML));
prevs.length = 0; el('bl-codigo').value = 'LISTA-ESPERA25'; el('bl-confirmo').checked = true;
await click({}, 'bl-enviar');
check('sem anexo, o envio leva a lista vazia', prevs.filter((b) => b.enviar === true)[0].anexos.length === 0);

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
