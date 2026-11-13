// Testa o HTML puro da ficha v2 (admin/crm/ficha-html.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node ficha-html.test.mjs
import * as FH from '../../ficha-html.js';
import * as FX from '../../ficha.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const h = { esc, fmtDay: (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; } };
const count = (s, re) => (s.match(re) || []).length;
const XSS = '<img src=x onerror=alert(1)>';

console.log('== Task 8: fila, header, abas, guia ==');
{
  const itens = [{ c: { id: 'c1', nome: XSS, urgencia: 'alta' }, novas: 2, proxima: 'Responder Ana', sub: 'Au pair · captação' }, { c: { id: 'c2', nome: 'Bia Lima', urgencia: 'baixa' }, novas: 0, proxima: 'Abrir a ficha' }];
  const f = FH.htmlFila(itens, 'c1', h);
  check('fila: a aberta tem aria-pressed true, a outra false', count(f, /aria-pressed="true"/g) === 1 && count(f, /aria-pressed="false"/g) === 1);
  check('fila: novas, e o texto da próxima ação não aparece mais', f.includes('2 novas') && !f.includes('Responder Ana') && !f.includes('Au pair · captação') && !f.includes('1 nova<'));
  check('fila: chips em uma linha, bolinha com a classe da urgência', f.includes('class="mf-i') && f.includes('mf-d alta') && f.includes('mf-d baixa') && !f.includes('fx-fcard'));
  check('fila: HTML do nome sai escapado', f.includes('&lt;img') && !f.includes('<img'));
  check('fila: cartão abre a pessoa', f.includes('data-fx="pessoa"') && f.includes('data-id="c2"'));
  check('fila vazia tem mensagem', FH.htmlFila([], null, h).includes('Ninguém'));
  check('fila: 1 nova no singular', FH.htmlFila([{ c: { id: 'z', nome: 'Z', urgencia: 'media' }, novas: 1, proxima: 'x' }], null, h).includes('1 nova'));

  const ab = FH.htmlAbas('plataforma', true, h);
  check('abas: três abas com data-fx', ['conversa', 'plataforma', 'ficha'].every((v) => ab.includes('data-fx="tab" data-v="' + v + '"')) && ab.includes('role="tablist"'));
  check('abas: só Plataforma selecionada', count(ab, /aria-selected="true"/g) === 1 && /data-v="plataforma"[^>]*aria-selected="true"/.test(ab));
  check('abas: selo convertida ou prévia', ab.includes('convertida') && FH.htmlAbas('ficha', false, h).includes('prévia'));
  check('abas: botão do guia', ab.includes('data-fx="tourAbrir"'));
  const tr = FH.htmlTour(true, h);
  check('guia: 4 itens e fechar', count(tr, /<li/g) === 4 && tr.includes('data-fx="tourFechar"') && FH.htmlTour(false, h) === '');
}

console.log('== Task 9: carrossel e pop-up ==');
{
  const T = (i, o = {}) => Object.assign({ id: 't' + i, k: 'resposta', t: 'Ação ' + i, why: 'Porque ' + i, tag: 'Dela', cta: 'Abrir a conversa', dest: { tab: 'conversa' } }, o);
  const seis = [1, 2, 3, 4, 5, 6].map((i) => T(i, i === 2 ? { tag: 'Reunião' } : i === 3 ? { tag: 'Funil' } : {}));
  const v = FH.htmlCarrossel([], h);
  check('0 ações: mensagem amigável, sem setas nem contador', v.includes('Nenhuma ação pendente') && !v.includes('data-fx="agPrev"') && !v.includes('data-fx="agNext"') && !/\d de \d/.test(v));
  const um = FH.htmlCarrossel([T(1)], h);
  check('1 ação: "1 de 1" e as duas setas desabilitadas', um.includes('1 de 1') && /data-fx="agPrev"[^>]*disabled/.test(um) && /data-fx="agNext"[^>]*disabled/.test(um));
  const c6 = FH.htmlCarrossel(seis, h);
  check('6 ações: "1 de 6" e 6 cartões', c6.includes('1 de 6') && count(c6, /data-fx="agAbrir"/g) === 6 && c6.includes('data-i="0"') && c6.includes('data-i="5"'));
  check('6 ações: região de carrossel', c6.includes('role="region"') && c6.includes('aria-roledescription="carrossel"'));
  check('6 ações: só o 1º cartão é first', count(c6, /fx-card first/g) === 1);
  check('6 ações: seta anterior desabilitada, seguinte habilitada', /data-fx="agPrev"[^>]*disabled/.test(c6) && !/data-fx="agNext"[^>]*disabled/.test(c6));
  check('cartão: aria-label e selos', c6.includes('aria-label="Ação 1 de 6: Ação 1. Abrir detalhes"') && c6.includes('Dela') && c6.includes('Reunião') && c6.includes('Funil'));
  check('seta seguinte desabilita no fim (i = N-1)', /data-fx="agNext"[^>]*disabled/.test(FH.htmlCarrossel(seis, h, 5)) && FH.htmlCarrossel(seis, h, 5).includes('6 de 6'));
  const xs = FH.htmlCarrossel([T(1, { t: '<b>negrito</b>' })], h);
  check('título com HTML sai escapado', xs.includes('&lt;b&gt;') && !xs.includes('<b>negrito'));

  const p0 = FH.htmlPopup(seis, 0, h);
  check('pop-up: dialog modal com título e por quê', p0.includes('role="dialog"') && p0.includes('aria-modal="true"') && p0.includes('Ação 1') && p0.includes('Porque 1'));
  check('pop-up: botão de ir com cta e seta', /data-fx="agIr"[^>]*>Abrir a conversa →/.test(p0));
  check('pop-up: "Ação 1 de 6" e fechar', p0.includes('Ação 1 de 6') && p0.includes('data-fx="agFechar"'));
  check('pop-up: primeira com anterior desabilitada', /data-fx="agNav" data-d="-1"[^>]*disabled/.test(p0) && !/data-fx="agNav" data-d="1"[^>]*disabled/.test(p0));
  check('pop-up: última com seguinte desabilitada', /data-fx="agNav" data-d="1"[^>]*disabled/.test(FH.htmlPopup(seis, 5, h)));
  check('pop-up: índice grande usa a última; vazio devolve ""', FH.htmlPopup(seis, 99, h).includes('Ação 6 de 6') && FH.htmlPopup([], 0, h) === '');
  check('pop-up: título com HTML escapado', FH.htmlPopup([T(1, { t: XSS })], 0, h).includes('&lt;img') && !FH.htmlPopup([T(1, { t: XSS })], 0, h).includes('<img'));
}

console.log('== Task 11: sessão Checklist ==');
{
  const it = (k, status, due, extra = {}) => Object.assign({ step_key: k, category: 'Documentação', label: 'Passo ' + k, status, due_date: due, sort_order: 0 }, extra);
  const seis = ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => it(k, 'pendente', '2026-12-0' + (i + 1)));
  const dem3 = [{ k: 'visa', nome: 'Visa', feitos: 1, total: 4 }, { k: 'ameli', nome: 'Ameli', feitos: 0, total: 1 }, { k: 'caf', nome: 'CAF', feitos: 0, total: 1 }];
  const d = (o = {}) => Object.assign({ semConta: false, erro: false, demarches: dem3, ativa: 'todas', totalFeitos: 1, total: 6, itens: seis, hoje: '2026-11-12', todos: false, mais: false, extraMais: '<p id="extra">EXTRA</p>' }, o);
  const sc = FH.htmlChecklistSessao(d({ semConta: true, demarches: [], itens: [] }), h);
  check('sem conta: aviso e nenhuma pílula (Review Focus 1)', sc.includes('Ela ainda não entrou no app') && !sc.includes('data-fx="dem"'));
  const er = FH.htmlChecklistSessao(d({ erro: true }), h);
  check('erro: aviso do SQL e nenhuma pílula (Review Focus 2)', er.includes('db/crm-checklist.sql') && !er.includes('data-fx="dem"'));
  const ok = FH.htmlChecklistSessao(d(), h);
  check('Todas + 3 démarches, com contagem', count(ok, /data-fx="dem"/g) === 4 && ok.includes('1/4') && ok.includes('0/1'));
  check('aria-pressed só na ativa', count(ok, /aria-pressed="true"/g) === 1 && /data-v="todas"[^>]*aria-pressed="true"/.test(ok));
  check('4 linhas de passo e botão "Ver todos"', count(ok, /class="fx-passo (feito|arq|pend)"/g) === 4 && ok.includes('Ver todos os 6 passos (2 escondidos)'));
  check('os 4 são os mais urgentes por data', ok.includes('Passo a') && ok.includes('Passo d') && !ok.includes('Passo e') && !ok.includes('Passo f'));
  const tod = FH.htmlChecklistSessao(d({ todos: true }), h);
  check('todos: 6 linhas e "Mostrar só os 4"', count(tod, /class="fx-passo (feito|arq|pend)"/g) === 6 && tod.includes('Mostrar só os 4 mais urgentes'));
  const tres = FH.htmlChecklistSessao(d({ itens: seis.slice(0, 3), total: 3 }), h);
  check('com 3 passos não há botão de ver todos', !tres.includes('Ver todos') && !tres.includes('Mostrar só os 4') && count(tres, /class="fx-passo (feito|arq|pend)"/g) === 3);
  check('1 escondido no singular', FH.htmlChecklistSessao(d({ itens: seis.slice(0, 5) }), h).includes('(1 escondido)'));
  check('pasta do Drive: só texto de privacidade', ok.includes('privada') && ok.includes('não vê o link') && !ok.includes('<input') && !ok.includes('href') && !/drive/i.test(ok.replace(/pasta do Drive/gi, '')));
  check('Ver mais: fechado não traz o extra; aberto traz', ok.includes('Ver mais desta sessão') && !ok.includes('EXTRA') && FH.htmlChecklistSessao(d({ mais: true }), h).includes('EXTRA') && FH.htmlChecklistSessao(d({ mais: true }), h).includes('Ver menos desta sessão'));
  check('a equipe não dá check', !ok.includes('data-fx="marcar"') && !/type="checkbox"/.test(ok));
  check('dado velho: banner só quando há dias sem atividade', FH.htmlChecklistSessao(d({ velhoDias: 5 }), h).includes('há 5 dias') && !ok.includes('fx-velho') && !FH.htmlChecklistSessao(d({ velhoDias: 0 }), h).includes('fx-velho'));
  check('vazio com conta', FH.htmlChecklistSessao(d({ itens: [], demarches: [], total: 0, totalFeitos: 0 }), h).includes('ainda está vazio'));
  check('rótulo com HTML escapado', FH.htmlChecklistSessao(d({ itens: [it('x', 'pendente', null, { label: XSS })] }), h).includes('&lt;img'));
  check('feito e arquivado têm texto próprio', (() => { const t = FH.htmlChecklistSessao(d({ itens: [it('f', 'concluido', null), it('g', 'arquivado', null)] }), h); return t.includes('feito') && t.includes('Arquivado'); })());
}

console.log('== Task 12: sessões em pílulas ==');
{
  const mapa = { chat: { titulo: 'Conversa com ela', sub: 'As mensagens no app', corpo: '<p>CORPO-CHAT</p>', aberto: true }, inicio: { titulo: XSS, sub: 'x', corpo: '<p>CORPO-INICIO</p>', aberto: false },
    checklist: { titulo: 'Checklist', sub: 'y', corpo: '<p>CORPO-CHK</p>', aberto: false }, bilan: { titulo: 'Bilan', sub: 'z', corpo: '<p>CORPO-BILAN</p>', aberto: true },
    dossie: { titulo: 'Dossiê', sub: 'z', corpo: '', aberto: false }, hist: { titulo: 'Histórico', sub: 'z', corpo: '', aberto: false } };
  const ord = { app: ['inicio', 'chat', 'checklist'], ela: ['bilan', 'dossie', 'hist'] };
  const ss = FH.htmlSessoes(ord, mapa, h);
  check('dois grupos com título', ss.includes('Acompanhar o app dela') && ss.includes('Conhecer e registrar'));
  check('pílulas na ordem recebida', ss.indexOf('data-sessao="inicio"') < ss.indexOf('data-sessao="chat"') && ss.indexOf('data-sessao="chat"') < ss.indexOf('data-sessao="checklist"') && ss.indexOf('data-sessao="checklist"') < ss.indexOf('data-sessao="bilan"'));
  check('aria-expanded conforme aberto', /data-fx="sessao" data-id="chat"[^>]*aria-expanded="true"/.test(ss) && /data-fx="sessao" data-id="inicio"[^>]*aria-expanded="false"/.test(ss));
  check('corpo só das abertas', ss.includes('CORPO-CHAT') && ss.includes('CORPO-BILAN') && !ss.includes('CORPO-INICIO') && !ss.includes('CORPO-CHK'));
  check('alça de arrastar com rótulo', ss.includes('aria-label="Arrastar Conversa com ela"') && count(ss, /draggable="true"/g) === 6);
  check('dois botões de mover por pílula (Subir/Descer)', count(ss, /data-fx="mover"/g) === 12 && ss.includes('aria-label="Subir Conversa com ela"') && ss.includes('aria-label="Descer Conversa com ela"'));
  check('título com HTML escapado', ss.includes('&lt;img') && !ss.includes('<img'));
  check('a pílula sabe o grupo', /data-sessao="chat" data-area="app"/.test(ss) && /data-sessao="bilan" data-area="ela"/.test(ss));
  check('id desconhecido na ordem é ignorado', !FH.htmlSessoes({ app: ['zzz', 'chat'], ela: [] }, mapa, h).includes('zzz'));
  const um = FH.htmlSessao({ id: 'chat', titulo: 'T', sub: 's', corpo: '<i>C</i>', aberto: true, area: 'app', ativa: true }, h);
  check('htmlSessao solta tem o corpo e a classe ativa', um.includes('<i>C</i>') && um.includes('ativa'));
}

console.log('== Task 13: fluxo de 3 passos ==');
{
  for (const n of [1, 2, 3]) {
    const f = FH.htmlFluxo(n, h);
    check('fluxo passo ' + n + ': 3 passos e só o atual com aria-current', count(f, /data-passo="[1-3]"/g) === 3 && count(f, /aria-current="step"/g) === 1 && new RegExp('data-passo="' + n + '"[^>]*aria-current="step"').test(f));
  }
  const f1 = FH.htmlFluxo(1, h);
  check('fluxo: nomes do spec §7.1', f1.includes('Captação por e-mail') && f1.includes('Onboarding: descrição da reunião') && f1.includes('Plataforma'));
  check('fluxo: passo fora da faixa é limitado', FH.htmlFluxo(9, h).includes('data-passo="3"') && /data-passo="3"[^>]*aria-current="step"/.test(FH.htmlFluxo(9, h)) && /data-passo="1"[^>]*aria-current="step"/.test(FH.htmlFluxo(0, h)));
}

console.log('== Cabeçalho fixo ==');
{
  const cart = (rotulo, valor, sub, tom) => (tom ? { rotulo, valor, sub, tom } : { rotulo, valor, sub });
  const d = { c: { id: 'c1', nome: XSS, email: 'ana@example.com', estagio: 'lead' }, estagioLabel: 'Lead', personaLabel: 'Au pair → estudante', etiqueta: { texto: 'Assinatura ativa', tom: 'ok' },
    estagios: [{ k: 'lead', l: 'Lead' }, { k: 'em_uso', l: 'Em uso' }],
    blocos: [{ titulo: 'Pagamento', cartoes: [cart('Plano', 'Intermediário', 'ativa', 'ok')] }, { titulo: null, cartoes: [cart('Parada há', '6 dias', '<b>x</b>', 'alerta'), cart('Respostas', '0', 'nenhuma')] }],
    nota: 'Baseado nos 300 cliques mais recentes.' };
  const hd = FH.htmlCabecalho(d, h);
  check('cabeçalho: nome com HTML sai escapado', hd.includes('&lt;img') && !hd.includes('<img') && !hd.includes('<b>x</b>') && hd.includes('&lt;b&gt;x&lt;/b&gt;'));
  check('cabeçalho: mantém os botões e o seletor de estágio', hd.includes('data-emailfor="c1"') && hd.includes('data-open1a1="c1"') && hd.includes('id="stage-pick"'));
  check('cabeçalho: classes dos cartões (alerta e ok) e título do bloco', hd.includes('k alerta') && hd.includes('k ok') && hd.includes('>Pagamento<') && count(hd, /class="k( |")/g) === 3);
  check('cabeçalho: nota aparece quando existe e some quando não existe', hd.includes('class="est"') && !FH.htmlCabecalho(Object.assign({}, d, { nota: null }), h).includes('class="est"'));
  check('cabeçalho: etiqueta de pagamento e persona', hd.includes('Assinatura ativa') && hd.includes('Au pair → estudante'));
  check('cabeçalho: iniciais (duas palavras, uma palavra, sem nome usa o e-mail) sem lançar', FH.htmlCabecalho({ c: { id: 'z', nome: 'Ana Souza' }, blocos: [] }, h).includes('>AS<') && FH.htmlCabecalho({ c: { id: 'z', nome: 'Clara' }, blocos: [] }, h).includes('>C<') && FH.htmlCabecalho({ c: { id: 'z', email: 'bruna@x.com' }, blocos: [] }, h).includes('>B<'));
  check('cabeçalho: mostra No app ou Sem conta', FH.htmlCabecalho(Object.assign({}, d, { temConta: true }), h).includes('No app') && FH.htmlCabecalho(Object.assign({}, d, { temConta: false }), h).includes('Sem conta'));
  check('cabeçalho: sem blocos não quebra', FH.htmlCabecalho({ c: { id: 'z', nome: 'Z' } }, h).includes('class="hd"'));
}

console.log('== Funil de conversão (lista vertical da Jornada) ==');
{
  const fu = FH.htmlFunil({ etapa: 4, semCaixa: true }, h);
  check('funil: 7 segmentos', count(fu, /data-etapa="[1-7]"/g) === 7);
  check('funil: aria-current só na etapa atual', count(fu, /aria-current="step"/g) === 1 && /data-etapa="4"[^>]*aria-current="step"|aria-current="step"[^>]*data-etapa="4"/.test(fu));
  check('funil: etapas feitas, atual e próximas', count(fu, /fx-seg done/g) === 3 && count(fu, /fx-seg cur/g) === 1 && count(fu, /fx-seg next/g) === 3);
  check('funil: etapa 7 não tem "Próxima:" e etapa fora da faixa é limitada', !FH.htmlFunil({ etapa: 7 }, h).includes('Próxima:') && FH.htmlFunil({ etapa: 99, semCaixa: true }, h).includes('data-etapa="7"') && /data-etapa="7"[^>]*aria-current="step"|aria-current="step"[^>]*data-etapa="7"/.test(FH.htmlFunil({ etapa: 99, semCaixa: true }, h)));
  check('funil sem caixa não traz o título; com caixa traz', !fu.includes('<h4') && FH.htmlFunil({ etapa: 2 }, h).includes('Funil de conversão</h4>'));
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
