// Testa o HTML puro da ficha v2 (admin/crm/ficha-html.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node ficha-html.test.mjs
import * as FH from '../../ficha-html.js';
import * as FX from '../../ficha.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const h = { esc, linhaPasso: (o) => '<div class="lp" data-ed="' + o.ed + '" data-id="' + o.id + '" data-estado="' + o.estado + '">' + o.titulo + '|' + o.chips.map((c) => c.t).join(',') + '|' + (o.nota || '') + '|' + (o.alerta || '') + '|' + (o.home || '') + '</div>', fmtDay: (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; } };
const count = (s, re) => (s.match(re) || []).length;
const XSS = '<img src=x onerror=alert(1)>';

console.log('== Task 8: fila, header, abas, guia ==');
{
  const itens = [{ c: { id: 'c1', nome: XSS, urgencia: 'alta' }, novas: 2, proxima: 'Responder Ana', sub: 'Au pair · captação' }, { c: { id: 'c2', nome: 'Bia Lima', urgencia: 'baixa' }, novas: 0, proxima: 'Abrir a ficha' }];
  const f = FH.htmlFila(itens, 'c1', h);
  check('fila: a aberta tem aria-pressed true, a outra false', count(f, /aria-pressed="true"/g) === 1 && count(f, /aria-pressed="false"/g) === 1);
  check('fila: novas, e a linha "Ação:" só aparece quando a ação não é só abrir a ficha', f.includes('2 novas') && f.includes('Ação: Responder Ana') && !f.includes('Abrir a ficha') && f.includes('Au pair · captação') && !f.includes('1 nova<'));
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
  const oito = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => it(k, 'pendente', '2026-12-0' + (i + 1)));
  const ok = FH.htmlChecklistSessao(d({ itens: oito, total: 8 }), h);
  check('Todas + 3 démarches, com contagem', count(ok, /data-fx="dem"/g) === 4 && ok.includes('1/4') && ok.includes('0/1'));
  check('aria-pressed: uma démarche ativa e uma origem ativa (Todos)', count(ok, /aria-pressed="true"/g) === 2 && /data-v="todas"[^>]*aria-pressed="true"/.test(ok) && /data-fx="ckOrigem" data-v="todos" aria-pressed="true"/.test(ok));
  check('o topo mostra o progresso e as três origens (Todos, Gerais, Só dela)', ok.includes('1 de 8') && ok.includes('feitos por ela') && count(ok, /data-fx="ckOrigem"/g) === 3 && ok.includes('fx-ck-bar'));
  check('6 linhas dos mais urgentes por data e o botão para os 2 restantes', count(ok, /class="lp"/g) === 6 && ok.includes('Passo a') && ok.includes('Passo f') && !ok.includes('Passo g') && ok.includes('Mostrar os 2 restantes'));
  const tod = FH.htmlChecklistSessao(d({ itens: oito, total: 8, todos: true }), h);
  check('todos: 8 linhas e "Mostrar só os 6 mais urgentes"', count(tod, /class="lp"/g) === 8 && tod.includes('Mostrar só os 6 mais urgentes'));
  const tres = FH.htmlChecklistSessao(d({ itens: seis.slice(0, 3), total: 3 }), h);
  check('com até 6 passos não há botão de ver os restantes', !tres.includes('restante') && !tres.includes('Mostrar só os 6') && count(tres, /class="lp"/g) === 3);
  check('1 restante no singular', FH.htmlChecklistSessao(d({ itens: oito.slice(0, 7) }), h).includes('Mostrar os 1 restante'));
  check('cada passo geral traz a etiqueta Geral, a démarche (em "Todas") e o prazo; o texto abre o editor (ed-chk)', /class="lp" data-ed="ed-chk" data-id="a"[^>]*>Passo a\|Geral,[^|]*,vence 01\/12\/2026/.test(FH.htmlChecklistSessao(d({ itens: oito, total: 8, demDe: () => 'Visa' }), h)));
  check('privacidade do Drive vira dica do ⓘ (sem caixa, sem link, sem campo)', ok.includes('title="A pasta do Drive dela é privada') && ok.includes('não vê o link') && !ok.includes('<input') && !ok.includes('href') && !ok.includes('fx-pasta'));
  check('Ver detalhes: fechado não traz o extra; aberto traz', ok.includes('Ver detalhes completos do checklist') && !ok.includes('EXTRA') && FH.htmlChecklistSessao(d({ mais: true }), h).includes('EXTRA') && FH.htmlChecklistSessao(d({ mais: true }), h).includes('Ver menos detalhes'));
  check('a equipe não dá check', !ok.includes('data-fx="marcar"') && !/type="checkbox"/.test(ok));
  check('dado velho: banner só quando há dias sem atividade', FH.htmlChecklistSessao(d({ velhoDias: 5 }), h).includes('há 5 dias') && !ok.includes('fx-velho') && !FH.htmlChecklistSessao(d({ velhoDias: 0 }), h).includes('fx-velho'));
  check('vazio com conta', FH.htmlChecklistSessao(d({ itens: [], demarches: [], total: 0, totalFeitos: 0 }), h).includes('ainda está vazio'));
  check('rótulo com HTML escapado', FH.htmlChecklistSessao(d({ itens: [it('x', 'pendente', null, { label: XSS })] }), h).includes('&lt;img'));
  check('feito, arquivado, atrasado e sem data têm estado e texto próprios', (() => { const t = FH.htmlChecklistSessao(d({ itens: [it('f', 'concluido', null), it('g', 'arquivado', null), it('h', 'pendente', '2026-11-01'), it('i', 'pendente', null)] }), h); return /data-estado="ok"[^>]*>Passo f\|Geral,[^|]*feito/.test(t) && t.includes('arquivado por ela') && /data-estado="bad"[^>]*>Passo h\|[^|]*atrasado · 01\/11\/2026/.test(t) && t.includes('sem data'); })());
  // origem, equipe e validação
  const eq = '<div class="lp-eq">EQUIPE</div>';
  const so = FH.htmlChecklistSessao(d({ origem: 'dela', equipeHtml: eq, equipeN: 2 }), h), ge = FH.htmlChecklistSessao(d({ origem: 'gerais', equipeHtml: eq, equipeN: 2 }), h), to = FH.htmlChecklistSessao(d({ equipeHtml: eq, equipeN: 2 }), h);
  check('Só dela: mostra o grupo da equipe e esconde os gerais; Gerais: o contrário; Todos: os dois, com contagem', so.includes('EQUIPE') && !so.includes('Gerais da démarche') && /Só dela · 2/.test(so) && ge.includes('Gerais da démarche') && !ge.includes('EQUIPE') && to.includes('EQUIPE') && to.includes('Gerais da démarche'));
  const al = { lista: [{ ref: 'aco:7', tipo: 'sem_data', titulo: 'Abrir a conta', texto: 'Sem data: ela não vê quando fazer.' }, { ref: 'chk:k9', tipo: 'sem_data', titulo: '<img src=x>', texto: 'Sem data.' }], porRef: { 'chk:a': ['Sem data: ela não vê quando fazer.'] } };
  const va = FH.htmlChecklistSessao(d({ alertas: al }), h);
  check('faixa de validação: contagem, texto e o botão certo para cada tipo de passo (geral: ckEditar; só dela: ed-aco), título escapado', va.includes('2 coisas para validar') && /data-caso="ed-aco" data-id="7"/.test(va) && /data-fx="ckEditar" data-id="k9"/.test(va) && va.includes('&lt;img') && !va.includes('<img'));
  check('sem alertas, sem faixa; o alerta do passo vai para a linha dele', !ok.includes('coisa') && /Passo a\|[^|]*\|[^|]*\|Sem data: ela não vê quando fazer\./.test(va));
  check('o passo em edição mostra o editor no lugar da linha', FH.htmlChecklistSessao(d({ ckEd: 'a' }), h).includes('data-ckform="a"'));
}

console.log('== Task 12: sessões em pílulas ==');
{
  const mapa = { chat: { titulo: 'Conversa com ela', sub: 'As mensagens no app', corpo: '<p>CORPO-CHAT</p>', aberto: true }, inicio: { titulo: XSS, sub: 'x', corpo: '<p>CORPO-INICIO</p>', aberto: false },
    checklist: { titulo: 'Checklist', sub: 'y', corpo: '<p>CORPO-CHK</p>', aberto: false }, bilan: { titulo: 'Bilan', sub: 'z', corpo: '<p>CORPO-BILAN</p>', aberto: true },
    dossie: { titulo: 'Dossiê', sub: 'z', corpo: '', aberto: false }, hist: { titulo: 'Histórico', sub: 'z', corpo: '', aberto: false } };
  const ord = { app: ['inicio', 'chat', 'checklist'], ela: ['bilan', 'dossie', 'hist'] };
  const ir = FH.htmlIrPara(ord, mapa, h), pg = FH.htmlPaginaSessao(ord, mapa, h);
  check('as pílulas "Ir para" vêm na ordem recebida, com um traço entre os dois grupos', ir.indexOf('data-id="inicio"') < ir.indexOf('data-id="chat"') && ir.indexOf('data-id="checklist"') < ir.indexOf('fx-ir-sep') && ir.indexOf('fx-ir-sep') < ir.indexOf('data-id="bilan"'));
  check('a pílula da página aberta fica marcada (aria-current) e as outras não', /data-id="chat"[^>]*aria-current="page"/.test(ir) && !/data-id="inicio"[^>]*aria-current/.test(ir));
  check('a página mostra só a primeira sessão aberta (sem dropdowns): o corpo dela e de mais nenhuma', pg.includes('CORPO-CHAT') && !pg.includes('CORPO-BILAN') && !pg.includes('CORPO-INICIO') && !pg.includes('CORPO-CHK') && /<section class="fx-pagina fx-pagina-app" data-sessao="chat"/.test(pg));
  check('sem alça de arrastar, sem setas de mover e sem aria-expanded', !/draggable|data-fx="mover"|aria-expanded/.test(pg + ir));
  check('título com HTML escapado', ir.includes('&lt;img') && !ir.includes('<img'));
  check('sessão do grupo "ela" vira página do grupo ela', FH.htmlPaginaSessao(ord, Object.assign({}, mapa, { chat: Object.assign({}, mapa.chat, { aberto: false }) }), h).includes('data-area="ela"'));
  check('id desconhecido na ordem é ignorado; sem nenhuma aberta, abre a primeira', !FH.htmlIrPara({ app: ['zzz', 'chat'], ela: [] }, mapa, h).includes('zzz') && FH.htmlPaginaSessao({ app: ['inicio', 'chat'], ela: [] }, { inicio: { titulo: 'I', corpo: '<b>PRIMEIRA</b>', aberto: false }, chat: { titulo: 'C', corpo: '', aberto: false } }, h).includes('PRIMEIRA'));
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
  check('cabeçalho: mantém os botões e o seletor de estágio', hd.includes('hd-n') && hd.includes('hd-av') && !hd.includes('data-emailfor'));   // os botões saíram do cabeçalho minimalista: o crm.js monta a barra de ações
  check('cabeçalho: classes dos cartões (alerta e ok) e título do bloco', hd.includes('k alerta') && hd.includes('k ok') && hd.includes('>Pagamento<') && count(hd, /class="k( |")/g) === 3);
  check('cabeçalho: nota aparece quando existe e some quando não existe', hd.includes('class="est"') && !FH.htmlCabecalho(Object.assign({}, d, { nota: null }), h).includes('class="est"'));
  check('cabeçalho: etiqueta de pagamento e persona', hd.includes('Assinatura ativa') && hd.includes('Au pair → estudante'));
  check('cabeçalho: iniciais (duas palavras, uma palavra, sem nome usa o e-mail) sem lançar', FH.htmlCabecalho({ c: { id: 'z', nome: 'Ana Souza' }, blocos: [] }, h).includes('>AS<') && FH.htmlCabecalho({ c: { id: 'z', nome: 'Clara' }, blocos: [] }, h).includes('>C<') && FH.htmlCabecalho({ c: { id: 'z', email: 'bruna@x.com' }, blocos: [] }, h).includes('>B<'));
  check('cabeçalho: um selo só de conta (a etiqueta de pagamento); sem etiqueta, nenhum selo e nada de No app/Sem conta', hd.includes('pg-ok') && !hd.includes('No app') && !FH.htmlCabecalho(Object.assign({}, d, { etiqueta: { texto: '', tom: 'neutro' } }), h).includes('class="pill pg-'));
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

console.log('== CRM retrabalhado: carrossel de ações ==');
{
  const v = FH.htmlCarrossel([], h, 0, { nome: 'Ana' });
  check('carrossel vazio: "Nenhuma ação pendente" e "+ Adicionar"', v.includes('Nenhuma ação pendente') && v.includes('+ Adicionar'));
  check('carrossel vazio: nome da pessoa no título', v.includes('Minhas próximas ações · Ana'));
  const ts = [{ t: 'Responder Ana', tag: 'Resposta', k: 'resp', id: 'r1', cta: 'Abrir', why: 'x' }, { t: 'Ligar <b>x</b>', tag: 'Só eu', k: 'acao', id: 'acao:1', cta: 'Abrir', why: 'y' }];
  const c = FH.htmlCarrossel(ts, h, 0, { nome: 'Ana', concluidas: 3 });
  check('carrossel com 2 tarefas: "1 de 2"', c.includes('1 de 2'));
  check('carrossel: "Concluídas (3)"', c.includes('Concluídas (3)'));
  check('carrossel: sem concluídas não mostra o botão', !FH.htmlCarrossel(ts, h, 0, {}).includes('Concluídas ('));
  check('carrossel: texto da tarefa sai escapado', c.includes('Ligar &lt;b&gt;x&lt;/b&gt;') && !c.includes('<b>x</b>'));
  check('carrossel: índice fora da faixa é limitado', FH.htmlCarrossel(ts, h, 99, {}).includes('2 de 2'));
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
