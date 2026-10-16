// Painel do CRM — lê e escreve no Supabase como a admin logada (RLS: tabela `admins`).
// Nada de service_role aqui. O banco é db/crm-fase2.sql; o desenho é o artefato "CRM Por Dentro".
// Tudo que vem do banco é texto de terceiros (nome, e-mail, pergunta): passa sempre por esc().
import { supabase } from '/assets/js/supabase-client.js';
import * as ES from './estudio.js?v=2026-10-16.2';   // os blocos do estúdio de e-mails (entrega 2)

var PERSONAS = {
  au_pair_estudante: 'Au pair → estudante', campus_france: 'Campus France', alternancia_emprego: 'Alternância / emprego',
  conjuge: 'Cônjuge', pvt: 'PVT', sem: 'Sem checklist'
};
var URG = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
var URG_WHY = { alta: 'marcou urgência ou já está na França com prazo', media: 'já está na França', baixa: 'ainda planejando' };
var STAGES = [
  { k: 'lead', l: 'Lead', d: 'deixou o e-mail' }, { k: 'ativado', l: 'Ativado', d: 'abriu o app' },
  { k: 'em_uso', l: 'Em uso', d: 'marcando itens' }, { k: 'um_a_um', l: '1:1', d: 'agendou conversa' },
  { k: 'concluido', l: 'Concluído', d: 'terminou o percurso' }, { k: 'inativo', l: 'Inativo', d: 'sumiu há 30+ dias' }
];
var ORIG = { instagram: 'Instagram', bot: 'Assistente de vistos', blog: 'Blog', direto: 'Direto', artigo: 'Artigo', login_direto: 'Login direto',
  'guia-vls-ts': 'Guia VLS-TS', 'guia-email-alt30': 'Guia alternância 30+', 'guia-etudes-en-france-2027': 'Guia Campus France' };
function origLabel(o) { return ORIG[o] || o; }
var SEGMENTS = [
  { k: 'naoabriu', t: 'Não abriu o e-mail', lever: 'Gatilho ausente', why: 'O e-mail chegou mas nunca foi aberto — sem gatilho, nada acontece. Ação: reenviar com outro assunto, ou checar se caiu no spam.' },
  { k: 'naoclicou', t: 'Abriu mas não clicou', lever: 'Falta motivação/prova', why: 'Leu e não sentiu motivo pra agir. Ação: prova social (quem já passou pelo mesmo) e botão mais simples.' },
  { k: 'cliquenaoapp', t: 'Clicou mas não abriu o app', lever: 'Fricção de capacidade', why: 'Clicou no link mas travou antes de entrar. Ação: lembrar que o acesso é sem senha, um clique só.' },
  { k: 'parouapp', t: 'Abriu o app mas parou', lever: 'Motivação caiu', why: 'Entrou, viu o checklist e não voltou. Ação: uma dica extra de graça + o prazo real dela, nunca um prazo inventado.' }
];
var MAIL_ST = { clicado: 'Clicou', aberto: 'Abriu', entregue: 'Entregue, não abriu', nao_entregue: 'Não entregue', agendado: 'Ainda não enviado' };
var MODELO = { boas_vindas: 'Boas-vindas + link de acesso', naoabriu: 'Reimpacto — não abriu', naoclicou: 'Reimpacto — abriu, não clicou', cliquenaoapp: 'Reimpacto — clicou, não abriu o app', parouapp: 'Reimpacto — abriu o app e parou', guia_alternancia: 'Guia alternância 30+ — convite pra conversa', cf_guia_1: 'Guia Campus France — e-mail 1 (checklist, automático)', cf_guia_conversa: 'Guia Campus France — e-mail 2 (a conversa, automático)', resposta: 'Sua resposta (aba Conversa)' };
var TYPE_META = {
  sistema: ['Sistema', ''], app: ['Abriu o app', 'u-baixa'], checklist: ['Checklist', 'u-baixa'], pergunta: ['Pergunta única', 'tp-pergunta'],
  artigo: ['Artigo', 'tp-artigo'], uma_um: ['1:1', 'out'], email: ['E-mail', 'out'], sinal: ['Sinal no dashboard', 'out'],
  resposta: ['Respondeu e-mail', 'tp-pergunta']
};

// Respostas do funil com rótulo legível na ficha (o resto aparece com a chave crua).
var CF_NIVEL = { l1: '1º ano de Licence', arq: 'Arquitetura', l2l3: '2º ou 3º ano de Licence', lpro: 'Licence Pro', master: 'Master', escola: 'Escola (engenharia, comércio)' };
// Botões do e-mail 2 do guia (fase 1a); a chave vem de contatos.respostas.cfCidade.
var CF_CIDADE = { paris: 'Paris', lyon: 'Lyon', toulouse: 'Toulouse', montpellier: 'Montpellier', bordeaux: 'Bordeaux', lille: 'Lille', outra: 'Outra cidade', 'nao-sei': 'Ainda não sei' };
var RESP_LABEL = { cfNivel: ['Nível da candidatura (Campus France)', function (v) { return CF_NIVEL[v] || v; }], cfCidade: ['Cidade (tocou no e-mail 2)', function (v) { return CF_CIDADE[v] || v; }] };
// Prazo de cada nível no calendário Campus France 2027-2028 (igual a CF_NIVEIS no worker.js) e a etapa do guia.
var CF_PRAZO = { l1: '2026-12-14', arq: '2026-12-14', l2l3: '2027-01-17', lpro: '2027-01-17', master: '2027-01-17', escola: '2027-01-17' };
var CF_ETAPA = { 'cf-nao-comecei': 'Ainda não começou', 'cf-escolhendo-curso': 'Escolhendo o curso', 'cf-juntando-documentos': 'Juntando documentos, traduções e o teste',
  'cf-dossie-enviado': 'Já enviou o dossiê', 'cf-entrevista-resposta': 'Esperando a entrevista ou a resposta' };
var RS_TABS = [['nova', 'Novas'], ['respondida', 'Respondidas'], ['arquivada', 'Arquivadas']];
// Por onde a resposta chegou (respostas_email.canal, db/crm-fase1a-conversa.sql). Sem a migração, tudo é 'email'.
var CANAL = { email: ['✉', 'por e-mail'], toque: ['☝', 'tocou no e-mail 2'], pagina: ['✎', 'escreveu na página da conversa'] };
function canalDe(x) { return CANAL[x.canal] || CANAL.email; }

var WORKER_BASE = 'https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev';
// Link que vai nos e-mails ("[link do acesso]"). Se ficar vazio, o trecho fica entre colchetes e o
// Worker RECUSA o envio — de propósito, pra nunca sair e-mail com placeholder.
var APP_LINK = 'https://plataforma.imigrantepordentro.com/';
var EXIGEM_NOVIDADES = { naoclicou: 1, parouapp: 1, guia_chamada: 1, guia_plataforma: 1, guia_alternancia: 1 };   // igual ao Worker (CRM_MODELOS_EXIGEM_NOVIDADES)
function pn(c) { return displayName(c).trim().split(/\s+/)[0]; }
var CAL_LINK = 'https://cal.com/ingryd-silva-jf1cnx/1-1?overlayCalendar=true';
function lk() { return APP_LINK || '[link do acesso]'; }
var TPLS = {
  boas_vindas: { label: 'Boas-vindas + link de acesso', when: 'Sai assim que a pessoa deixa o e-mail no funil.', lever: 'Dispara o gatilho',
    make: function (c) { return ['Assunto: ' + pn(c) + ', seu link de acesso chegou', 'Oi ' + pn(c) + '! Aqui está o link pra ver o seu checklist de ' + personaLabel(c).toLowerCase() + ', já com prazos reais: ' + lk() + '\n\nÉ sem senha — um clique e você já entra.\n\nIngryd · Por Dentro']; } },
  naoabriu: { label: 'Reimpacto — não abriu o e-mail', when: 'Entregue e não aberto há 3+ dias.', lever: 'Gatilho ausente',
    make: function (c) { return ['Assunto: ' + pn(c) + ', isso ainda te interessa?', 'Oi ' + pn(c) + '! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui: ' + lk() + '\n\nSe caiu no spam, vale marcar como "não é spam" pra não perder os próximos.\n\nIngryd · Por Dentro']; } },
  naoclicou: { label: 'Reimpacto — abriu, não clicou', when: 'Aberto e não clicado há 3+ dias.', lever: 'Falta motivação/prova',
    make: function (c) { return ['Assunto: outras ' + (c.persona === 'au_pair_estudante' ? 'au pairs' : 'pessoas') + ' que já passaram por isso', 'Oi ' + pn(c) + '! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist: ' + lk() + '\n\nQualquer dúvida, é só responder.\nIngryd · Por Dentro']; } },
  cliquenaoapp: { label: 'Reimpacto — clicou, não abriu o app', when: 'Clicou no link mas nunca chegou a ativar.', lever: 'Fricção de capacidade',
    make: function (c) { return ['Assunto: seu link ainda funciona, ' + pn(c), 'Oi ' + pn(c) + '! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só: ' + lk() + '\n\nSe travou em algo, me conta que eu ajudo.\nIngryd · Por Dentro']; } },
  parouapp: { label: 'Reimpacto — abriu o app e parou', when: 'Ativado ou em uso, sem sinal há 7+ dias.', lever: 'Motivação caiu',
    make: function (c) { return ['Assunto: uma dica rápida pro seu caso', 'Oi ' + pn(c) + '! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]\n\n' + (c.motivo ? 'Também vi que ' + c.motivo + ' — vale resolver isso antes de qualquer outra coisa.\n\n' : '') + 'Ingryd · Por Dentro']; } }
};
TPLS.guia_chamada = { label: 'Guia VLS-TS — convite pra conversa', when: 'Quem baixou o guia do VLS-TS (1º e-mail). Usa o prazo, se a pessoa informou a data.', lever: 'Ajuda de perto',
  make: function (c) {
    var prazo = c.dias_para_prazo == null ? '' :
      Number(c.dias_para_prazo) < 0 ? 'Pelas suas contas, o prazo de 3 meses venceu em ' + fmtDay(c.prazo_limite) + ' — então vale agir logo.\n\n' :
      'Pelas suas contas, o prazo de 3 meses vence em ' + fmtDay(c.prazo_limite) + ' (' + c.dias_para_prazo + ' dias).\n\n';
    return ['Assunto: ' + pn(c) + ', como está o seu VLS-TS?', 'Oi ' + pn(c) + '! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.\n\n' + prazo +
      'Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida. É só escolher um horário: ' + CAL_LINK + '&utm_source=email&utm_campaign=guia-chamada\n\nIngryd · Por Dentro']; } };
TPLS.guia_plataforma = { label: 'Guia VLS-TS — apresentar a plataforma (tester)', when: 'Depois do convite pra conversa, pra quem aceitou novidades.', lever: 'Convite de teste',
  make: function (c) { return ['Assunto: ' + pn(c) + ', quer testar a plataforma do Por Dentro?', 'Oi ' + pn(c) + '! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só.\n\nSe quiser testar, o acesso é por aqui: ' + lk() + '\n\nÉ sem senha, um clique e você entra. Em troca, só peço o seu feedback.\n\nIngryd · Por Dentro']; } };
TPLS.guia_alternancia = { label: 'Guia alternância 30+ — convite pra conversa', when: 'Quem pegou o e-mail em francês para a escola (1º e-mail). Usa a etapa que a pessoa escolheu.', lever: 'Ajuda de perto',
  make: function (c) {
    var etapas = {
      'alt-pesquisando': 'Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico.',
      'alt-escolhendo-escola': 'Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer "só até 29".',
      'alt-recusa-idade': 'Você disse que já ouviu "só até 29" de uma escola. Esse "não" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal.',
      'alt-buscando-empresa': 'Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão.',
      'alt-montando-contrato': 'Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.'
    };
    var obj = c.respostas && c.respostas.objetivo;
    var linha = etapas[obj] ? etapas[obj] + '\n\n' : '';
    return ['Assunto: ' + pn(c) + ', o e-mail para a escola e o próximo passo', 'Oi ' + pn(c) + '! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.\n\n' + linha +
      'Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/\n\n' +
      'E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário: ' + CAL_LINK + '&utm_source=email&utm_campaign=guia-alternancia\n\nIngryd · Por Dentro']; } };
var TPL_ORDER = ['boas_vindas', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp', 'guia_chamada', 'guia_plataforma', 'guia_alternancia'];
// Jornada da pessoa. Sem a migração crm-enriquecimento.sql as colunas novas não existem: cai na origem da ficha.
function origensDe(c) { return c.origens && c.origens.length ? c.origens : (c.origem ? [c.origem] : []); }
function ultimaOrigem(c) { return c.ultima_origem || c.origem; }
function nCapturas(c) { return Math.max(1, c.capturas || 0); }
function voltou(c) { return nCapturas(c) >= 2; }
// Voltou a deixar o e-mail depois do último e-mail que você mandou (ou nunca recebeu e-mail).
function voltouDepoisDoEmail(c) { return voltou(c) && !!c.ultima_captura_em && (!c.email_enviado_em || c.ultima_captura_em > c.email_enviado_em); }
function guiaTpl(o) { return o === 'guia-vls-ts' ? 'guia_chamada' : o === 'guia-email-alt30' ? 'guia_alternancia' : null; }
function defaultTpl(c) {
  var g = guiaTpl(ultimaOrigem(c));
  if (g && (!c.segmento || voltouDepoisDoEmail(c))) return g;
  return c.segmento || 'boas_vindas';
}
function splitTpl(c, k) { var t = TPLS[k].make(c); return { subject: t[0].replace(/^Assunto: /, ''), body: t[1] }; }

var C = [], Q = [], L = [], R = [], RM = {}, SUBS = {}, M = null, MV = [];
var state = { ptab: null, rascunho: {}, view: 'hoje', persona: '', sub: '', urg: '', stage: '', orig: '', camp: '', q: '', sel: null, qs: 'nova', qsel: null, inbox: 'perguntas', rs: 'nova', rsel: null, preset: 'todos', seg: '', prevView: 'contatos' };
var activeCid = null;
var me = null;

function $(id) { return document.getElementById(id); }
function byC(id) { for (var i = 0; i < C.length; i++) if (C[i].id === id) return C[i]; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
function personaKey(c) { return c.persona || 'sem'; }
function personaLabel(c) { return PERSONAS[personaKey(c)] || c.persona; }
function subLabel(c) { return (c.subpersona && SUBS[personaKey(c) + '|' + c.subpersona]) || (c.subpersona ? c.subpersona : ''); }
function displayName(c) { return c.nome || c.email.split('@')[0]; }
function ini(c) { var p = displayName(c).trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
function short(c) { var p = displayName(c).trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); }
function avClass(c) { var p = personaKey(c); return p === 'sem' ? 'av b' : (p === 'conjuge' || p === 'pvt') ? 'av c' : 'av'; }
function urgPill(u) { return '<span class="pill u-' + esc(u) + '"><span class="dot"></span>' + esc(URG[u] || u) + '</span>'; }
function stageLabel(k) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].k === k) return STAGES[i].l; return k; }
function ago(d) { return d === 0 ? 'hoje' : d === 1 ? 'ontem' : d + ' dias'; }
function hrsSince(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 36e5)); }
function hrs(h) { return h < 24 ? h + 'h' : Math.round(h / 24) + ' dias'; }
function fmtDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }
function prazoKey(c) { return c.dias_para_prazo == null ? 99999 : Number(c.dias_para_prazo); }
function prazoTxt(c) {
  if (c.dias_para_prazo == null) return '';
  var d = Number(c.dias_para_prazo);
  return d < 0 ? 'venceu há ' + (-d) + ' d' : d === 0 ? 'vence hoje' : 'faltam ' + d + ' d';
}
function prazoCell(c) {
  if (c.dias_para_prazo == null) return '<span class="sub">—</span>';
  var d = Number(c.dias_para_prazo), hot = d <= 30 && d >= -90;
  return '<b class="num" style="' + (hot ? 'color:var(--red)' : '') + '">' + esc(fmtDay(c.prazo_limite)) + '</b><div class="sub num">' + esc(prazoTxt(c)) + '</div>';
}
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'; }
function fmtWhen(iso) { return iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'a combinar'; }
function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 2600); }
function fail(what, error) { console.error(what, error); toast('Não consegui ' + what + ' — ' + (error && error.message ? error.message : 'tente de novo')); }

// ---------- Acesso ----------
async function boot() {
  var s = await supabase.auth.getSession();
  if (!s.data.session) return showGate();
  me = s.data.session.user;
  var adm = await supabase.from('admins').select('user_id').eq('user_id', me.id).maybeSingle();
  if (adm.error || !adm.data) {
    await supabase.auth.signOut();
    showGate('Essa conta não tem acesso ao CRM.');
    return;
  }
  $('gate').hidden = true; $('app').hidden = false;
  await loadAll();
  initControls();
  show('hoje');
}
function showGate(msg) {
  $('app').hidden = true; $('gate').hidden = false;
  $('gate-err').textContent = msg || '';
}
$('gate-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = $('gate-btn'); btn.disabled = true; $('gate-err').textContent = '';
  var r = await supabase.auth.signInWithOtp({
    email: $('gate-email').value.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname }
  });
  btn.disabled = false;
  if (r.error) { $('gate-err').textContent = 'Não consegui enviar o link. Confere o e-mail e tenta de novo.'; return; }
  $('gate-err').textContent = 'Link enviado — abre o e-mail neste aparelho.';
});
$('signout').addEventListener('click', async function () { await supabase.auth.signOut(); location.reload(); });

// ---------- Dados ----------
async function loadAll() {
  var r = await Promise.all([
    supabase.from('crm_contatos').select('*').order('criado_em', { ascending: false }).limit(5000),
    supabase.from('perguntas_unicas').select('*').order('criado_em', { ascending: true }).limit(2000),
    supabase.from('caminhos_opcoes').select('persona,chave,rotulo'),
    // Lembretes de prazo pedidos na calculadora dos artigos (db/crm-fase2c-lembretes.sql).
    // Se a fase 2c ainda não rodou, a tabela não existe: o card só fica vazio.
    supabase.from('lembretes_prazo').select('*').eq('status', 'agendado').order('avisar_em', { ascending: true }).limit(500),
    // Respostas por e-mail (db/crm-fase0-email-guia.sql). Sem a migração, a aba só fica vazia.
    supabase.from('respostas_email').select('*').order('recebido_em', { ascending: true }).limit(2000),
    // Modelos de e-mail e as versões (db/crm-modelos-email.sql). Sem a migração, a tela mostra os modelos do código.
    supabase.from('modelos_email').select('*').order('ordem', { ascending: true }),
    supabase.from('modelos_email_versoes').select('*').order('versao', { ascending: false })
  ]);
  if (r[0].error) return fail('carregar os contatos', r[0].error);
  C = r[0].data || [];
  Q = r[1].error ? [] : (r[1].data || []);
  L = r[3] && !r[3].error ? (r[3].data || []) : [];
  R = r[4] && !r[4].error ? (r[4].data || []) : [];
  M = r[5] && !r[5].error && !r[6].error ? (r[5].data || []) : null;
  MV = M ? (r[6].data || []) : [];
  // O e-mail do CRM a que cada resposta respondeu (assunto e modelo).
  RM = {};
  var ids = R.map(function (x) { return x.email_id; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  if (ids.length) {
    var em = await supabase.from('emails_enviados').select('id,modelo,assunto').in('id', ids.slice(0, 500));
    (em.data || []).forEach(function (m) { RM[m.id] = m; });
  }
  SUBS = {};
  (r[2].data || []).forEach(function (o) { SUBS[o.persona + '|' + o.chave] = o.rotulo; });
}
async function reload() { await loadAll(); fillCampanhas(); renderToday(); renderReimpacto(); }

// ---------- Filtros ----------
function fillSelect(el, first, map) {
  var html = '<option value="">' + esc(first) + '</option>';
  Object.keys(map).forEach(function (k) { html += '<option value="' + esc(k) + '">' + esc(map[k]) + '</option>'; });
  el.innerHTML = html;
}
// Campanhas (UTM) que aparecem nos contatos, com a contagem. "__sem" = chegou sem campanha.
function fillCampanhas() {
  var el = $('f-camp'); if (!el) return;
  var n = {}, sem = 0;
  C.forEach(function (c) { if (c.utm_campaign) n[c.utm_campaign] = (n[c.utm_campaign] || 0) + 1; else sem++; });
  var map = {};
  Object.keys(n).sort().forEach(function (k) { map[k] = k + ' (' + n[k] + ')'; });
  if (sem) map.__sem = 'Sem campanha (' + sem + ')';
  fillSelect(el, 'Toda campanha', map);
  el.value = state.camp;
}
function subsOf(persona) {
  var m = {};
  Object.keys(SUBS).forEach(function (k) { var p = k.split('|'); if (p[0] === persona) m[p[1]] = SUBS[k]; });
  return m;
}
function refreshSub() {
  var el = $('f-sub');
  if (!state.persona) { el.innerHTML = '<option value="">Subpersona (escolha a persona)</option>'; state.sub = ''; return; }
  fillSelect(el, 'Toda subpersona', subsOf(state.persona));
  el.value = state.sub;
}
function syncControls() {
  $('f-persona').value = state.persona; refreshSub();
  $('f-urg').value = state.urg; $('f-stage').value = state.stage; $('f-orig').value = state.orig; $('f-camp').value = state.camp; $('q').value = state.q;
  ['f-persona', 'f-sub', 'f-urg', 'f-stage', 'f-orig', 'f-camp'].forEach(function (id) { $(id).classList.toggle('on', !!$(id).value); });
  document.querySelectorAll('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)); });
}
function initControls() {
  fillSelect($('f-persona'), 'Toda persona', PERSONAS);
  fillSelect($('f-urg'), 'Toda urgência', URG);
  var stMap = {}; STAGES.forEach(function (s) { stMap[s.k] = s.l; });
  fillSelect($('f-stage'), 'Todo estágio', stMap);
  var origs = {}; Object.keys(ORIG).forEach(function (k) { origs[k] = ORIG[k]; });
  C.forEach(function (c) { origensDe(c).forEach(function (o) { if (!origs[o]) origs[o] = o; }); });
  fillSelect($('f-orig'), 'Toda origem', origs);
  fillCampanhas();
  fillSelect($('funil-persona'), 'Toda persona', PERSONAS);
  syncControls();
  [['f-persona', 'persona'], ['f-sub', 'sub'], ['f-urg', 'urg'], ['f-stage', 'stage'], ['f-orig', 'orig'], ['f-camp', 'camp']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () {
      state[p[1]] = this.value; if (p[1] === 'persona') state.sub = ''; state.preset = '';
      syncControls(); renderContacts();
    });
  });
  $('q').addEventListener('input', function () { state.q = this.value; renderContacts(); });
  $('funil-persona').addEventListener('change', renderBoard);
}
function filtered() {
  var q = state.q.trim().toLowerCase();
  return C.filter(function (c) {
    if (state.persona && personaKey(c) !== state.persona) return false;
    if (state.sub && c.subpersona !== state.sub) return false;
    if (state.urg && c.urgencia !== state.urg) return false;
    if (state.stage && c.estagio !== state.stage) return false;
    if (state.orig && origensDe(c).indexOf(state.orig) === -1) return false;
    if (state.camp && (state.camp === '__sem' ? !!c.utm_campaign : c.utm_campaign !== state.camp)) return false;
    if (state.preset === 'voltaram' && !voltou(c)) return false;
    if (state.preset === 'parados' && !(c.dias >= 7 && c.estagio !== 'concluido')) return false;
    if (state.preset === 'prazo' && !(c.dias_para_prazo != null && c.dias_para_prazo <= 30 && c.dias_para_prazo >= -90 && c.estagio !== 'concluido')) return false;
    if (state.preset === 'aupair' && !(c.persona === 'au_pair_estudante' && c.respostas && c.respostas.apCertificado === 'nao')) return false;
    if (q && ((c.nome || '') + ' ' + c.email).toLowerCase().indexOf(q) === -1) return false;
    return true;
  }).sort(function (a, b) { var o = { alta: 0, media: 1, baixa: 2 }; return o[a.urgencia] - o[b.urgencia] || prazoKey(a) - prazoKey(b) || a.dias - b.dias; });
}
function applyPreset(p) {
  state.preset = p; state.persona = ''; state.sub = ''; state.urg = ''; state.stage = ''; state.orig = ''; state.camp = ''; state.q = '';
  if (p === 'urgentes') state.urg = 'alta';
  if (p === 'semchecklist') state.persona = 'sem';
  syncControls(); renderContacts();
}

// ---------- Telas ----------
function renderToday() {
  var d = new Date();
  $('hello').textContent = (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite') + ', Ingryd';
  var att = C.filter(function (c) { return c.motivo && c.estagio !== 'concluido' && c.estagio !== 'inativo'; })
    .sort(function (a, b) { var o = { alta: 0, media: 1, baixa: 2 }; return o[a.urgencia] - o[b.urgencia] || prazoKey(a) - prazoKey(b) || b.dias - a.dias; }).slice(0, 6);
  $('attention').innerHTML = att.map(function (c) {
    return '<button class="row" data-open="' + esc(c.id) + '" type="button"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) +
      ' <span class="persona" style="display:inline;font-size:11.5px">· ' + esc(personaLabel(c)) + '</span></b><span>' + esc(c.motivo) + '</span></div>' + urgPill(c.urgencia) + '</button>';
  }).join('') || '<div class="empty">Ninguém pedindo atenção agora.</div>';

  var nq = Q.filter(function (x) { return x.status === 'nova'; }).sort(function (a, b) { return a.criado_em < b.criado_em ? -1 : 1; });
  var nr = R.filter(function (x) { return x.status === 'nova'; });
  // Caixa de entrada: perguntas e respostas por e-mail juntas, a mais antiga primeiro.
  var caixa = nq.map(function (x) { return { k: 'q', x: x, em: x.criado_em }; })
    .concat(nr.map(function (x) { return { k: 'r', x: x, em: x.recebido_em }; }))
    .sort(function (a, b) { return a.em < b.em ? -1 : 1; });
  $('today-q').innerHTML = caixa.slice(0, 5).map(function (it) {
    var x = it.x, c = byC(x.contato_id), h = hrsSince(it.em);
    if (it.k === 'q' && !c) return '';
    var who = c ? esc(short(c)) : esc(x.de_email) + ' <span class="persona" style="display:inline;font-size:11.5px">· sem ficha</span>';
    return '<button class="row" ' + (it.k === 'q' ? 'data-openq' : 'data-openr') + '="' + x.id + '" type="button">' + (c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div>' : '<div class="av b">@</div>') +
      '<div class="who"><b>' + who + '</b><span>' + (it.k === 'r' ? canalDe(x)[0] + ' ' : '') + esc(x.texto) + '</span></div><span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + hrs(h) + '</span></button>';
  }).join('') || '<div class="empty">Tudo respondido.</div>';

  var week = Date.now() - 7 * 864e5, prev = Date.now() - 14 * 864e5;
  var leads7 = C.filter(function (c) { return new Date(c.criado_em) >= week; }).length;
  var leadsPrev = C.filter(function (c) { var t = new Date(c.criado_em); return t >= prev && t < week; }).length;
  var recentes = C.filter(function (c) { return new Date(c.criado_em) >= week; });
  var abriram = recentes.filter(function (c) { return c.estagio !== 'lead'; }).length;
  $('k-leads').textContent = leads7;
  $('k-leads-sub').textContent = (leads7 - leadsPrev >= 0 ? '+' : '') + (leads7 - leadsPrev) + ' vs. semana passada';
  $('k-leads-sub').className = leads7 >= leadsPrev ? 'up' : '';
  $('k-app').textContent = recentes.length ? Math.round(100 * abriram / recentes.length) + '%' : '—';
  $('k-app-sub').textContent = abriram + ' de ' + recentes.length;
  $('k-perg').textContent = nq.length + nr.length;
  var atrasadas = caixa.filter(function (it) { return hrsSince(it.em) >= 72; }).length;
  $('k-perg-sub').textContent = atrasadas ? atrasadas + ' passou de 72h' : 'nenhuma passou de 72h';
  $('k-urg').textContent = C.filter(function (c) { return c.urgencia === 'alta' && c.estagio !== 'concluido' && c.estagio !== 'inativo'; }).length;
  $('hello-sub').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + (att.length + nq.length + nr.length) + ' coisas pedem você hoje';

  $('c-perguntas').textContent = nq.length + nr.length; $('c-perguntas').hidden = nq.length + nr.length === 0;
  $('c-contatos').textContent = C.length;

  var um = C.filter(function (c) { return c.estagio === 'um_a_um'; });
  $('today-1a1').innerHTML = um.map(function (c) {
    return '<button class="row" data-open="' + esc(c.id) + '" type="button"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) + '</b><span>' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></div><span class="when">' + esc(fmtWhen(c.um_a_um_quando)) + '</span></button>';
  }).join('') || '<div class="empty">Nenhum 1:1 marcado.</div>';
  renderLembretes();
  renderGuias();
}

// Visão macro: por guia/origem, quantas pessoas passaram, quantas voltaram e quantas aceitam novidades.
// Clicar abre a lista de contatos já filtrada naquela origem.
function renderGuias() {
  var box = $('today-guias'); if (!box) return;
  var g = {};
  C.forEach(function (c) {
    origensDe(c).forEach(function (o) {
      var x = g[o] || (g[o] = { n: 0, volta: 0, aceita: 0 });
      x.n++; if (voltou(c)) x.volta++; if (c.aceita_novidades) x.aceita++;
    });
  });
  var rows = Object.keys(g).filter(function (o) { return o.indexOf('guia-') === 0; })
    .sort(function (a, b) { return g[b].n - g[a].n; });
  box.innerHTML = rows.map(function (o) {
    var x = g[o];
    return '<button class="row" data-guia="' + esc(o) + '" type="button"><div class="who"><b>' + esc(origLabel(o)) + '</b><span>' + x.n + (x.n === 1 ? ' pessoa' : ' pessoas') +
      ' · ' + x.volta + ' voltaram · ' + x.aceita + ' aceitam novidades</span></div></button>';
  }).join('') || '<div class="empty">Nenhum guia com cadastro ainda.</div>';
}

// Card "Lembretes de prazo" do Hoje: quem pediu, na calculadora de um artigo, pra ser
// avisada antes de um prazo. Mostra primeiro o que já passou da data de avisar.
function renderLembretes() {
  var box = $('today-lembretes'); if (!box) return;
  var hoje = new Date().toISOString().slice(0, 10);
  var em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  var list = L.filter(function (l) { return l.avisar_em <= em7; });
  box.innerHTML = list.map(function (l) {
    var c = byC(l.contato_id), atrasado = l.avisar_em <= hoje;
    var who = c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) + '</b><span>Prazo ' + esc(fmtDay(l.prazo)) + (l.artigo ? ' · ' + esc(l.artigo) : '') + '</span></div>'
      : '<div class="who"><b>Contato</b><span>Prazo ' + esc(fmtDay(l.prazo)) + '</span></div>';
    return '<div class="row">' + (c ? '<button class="row" style="flex:1;border:0;padding:0;background:none" type="button" data-open="' + esc(c.id) + '">' + who + '</button>' : who) +
      '<span class="when">' + (atrasado ? 'avisar hoje' : 'avisar ' + esc(fmtDay(l.avisar_em))) + '</span>' +
      '<button class="btn" type="button" data-avisado="' + esc(l.id) + '">Avisei</button></div>';
  }).join('') || '<div class="empty">Ninguém pra avisar nos próximos 7 dias.' + (L.length ? ' ' + L.length + ' lembrete(s) mais adiante.' : '') + '</div>';
}

function renderContacts() {
  var list = filtered();
  $('result-count').textContent = list.length;
  $('tbody').innerHTML = list.map(function (c) {
    return '<tr data-id="' + esc(c.id) + '" aria-selected="' + (c.id === state.sel) + '" tabindex="0">' +
      '<td><div class="nm"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><b>' + esc(displayName(c)) + (voltou(c) ? ' <span class="pill" title="Deixou o e-mail ' + nCapturas(c) + ' vezes">voltou ×' + nCapturas(c) + '</span>' : '') + '</b><span>' + esc(c.email) + '</span></div></div></td>' +
      '<td><span class="persona">' + esc(personaLabel(c)) + '</span><div class="sub">' + esc(subLabel(c)) + '</div>' + (origensDe(c).length > 1 ? '<div class="sub">' + esc(origensDe(c).map(origLabel).join(' · ')) + '</div>' : '') + '</td>' +
      '<td>' + urgPill(c.urgencia) + '</td><td><span class="stage">' + esc(stageLabel(c.estagio)) + '</span></td>' +
      '<td>' + prazoCell(c) + '</td><td class="sub num">' + ago(c.dias) + '</td></tr>';
  }).join('');
  $('empty').hidden = list.length > 0;
  var chips = [];
  if (state.persona) chips.push(['persona', PERSONAS[state.persona]]);
  if (state.sub) chips.push(['sub', SUBS[state.persona + '|' + state.sub] || state.sub]);
  if (state.urg) chips.push(['urg', 'Urgência ' + URG[state.urg].toLowerCase()]);
  if (state.stage) chips.push(['stage', stageLabel(state.stage)]);
  if (state.orig) chips.push(['orig', ORIG[state.orig] || state.orig]);
  if (state.camp) chips.push(['camp', state.camp === '__sem' ? 'Sem campanha' : 'Campanha ' + state.camp]);
  $('active-f').innerHTML = chips.length ? 'Filtrando por: ' + chips.map(function (x) {
    return '<button class="x" data-clear="' + x[0] + '" type="button" aria-label="Remover filtro ' + esc(x[1]) + '">' + esc(x[1]) + ' ×</button>';
  }).join('') + ' <button class="link" data-clear="all" type="button">Limpar tudo</button>' : '';
}

function renderBoard() {
  var fp = $('funil-persona').value;
  $('board').innerHTML = STAGES.map(function (s) {
    var items = C.filter(function (c) { return c.estagio === s.k && (!fp || personaKey(c) === fp); });
    return '<div class="col"><h3>' + s.l + ' <span class="num">' + items.length + '</span></h3><p class="desc">' + s.d + '</p>' +
      items.map(function (c) {
        var stale = c.dias >= 7 && s.k !== 'concluido' && s.k !== 'inativo';
        return '<button class="kc" data-open="' + esc(c.id) + '" type="button"><b>' + esc(short(c)) + '</b><span class="persona">' + esc(personaLabel(c)) + '</span><div class="meta">' + urgPill(c.urgencia) + (stale ? '<span class="stale num">parada há ' + c.dias + ' dias</span>' : '') + '</div></button>';
      }).join('') + '</div>';
  }).join('');
}

// Caixa de entrada: duas abas (perguntas únicas e respostas por e-mail), cada uma com os seus status.
function renderQuestions() {
  var nq = Q.filter(function (x) { return x.status === 'nova'; }).length, nr = R.filter(function (x) { return x.status === 'nova'; }).length;
  $('c-ib-perguntas').textContent = nq; $('c-ib-perguntas').hidden = !nq;
  $('c-ib-emails').textContent = nr; $('c-ib-emails').hidden = !nr;
  document.querySelectorAll('.itab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.inbox === state.inbox)); });
  if (state.inbox === 'emails') return renderRespostas();
  $('qtabs').innerHTML = [['nova', 'Novas'], ['respondida', 'Respondidas']].map(function (k) {
    return '<button class="qtab" role="tab" data-qs="' + k[0] + '" aria-selected="' + (state.qs === k[0]) + '" type="button">' + k[1] + ' <span class="num">' + Q.filter(function (x) { return x.status === k[0]; }).length + '</span></button>';
  }).join('');
  var list = Q.filter(function (x) { return x.status === state.qs; }).sort(function (a, b) { return state.qs === 'nova' ? (a.criado_em < b.criado_em ? -1 : 1) : (a.respondida_em < b.respondida_em ? 1 : -1); });
  if (!list.some(function (x) { return x.id === state.qsel; })) state.qsel = list.length ? list[0].id : null;
  $('qitems').innerHTML = list.map(function (x) {
    var c = byC(x.contato_id); if (!c) return '';
    var h = hrsSince(x.criado_em);
    return '<button class="qitem" data-q="' + x.id + '" aria-current="' + (x.id === state.qsel) + '" type="button"><div class="l1"><b>' + esc(short(c)) + '</b>' +
      (x.status === 'nova' ? '<span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + (h >= 72 ? 'atrasada · ' : '') + hrs(h) + '</span>' : '<span class="sla ok">respondida</span>') +
      '</div><p>' + esc(x.texto) + '</p><span class="persona">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></button>';
  }).join('') || '<div class="empty">' + (state.qs === 'nova' ? 'Nenhuma pergunta nova. Tudo respondido.' : 'Nada respondido ainda.') + '</div>';
  var x = Q.filter(function (y) { return y.id === state.qsel; })[0];
  var c = x && byC(x.contato_id);
  if (!x || !c) { $('qdetail').innerHTML = '<div class="empty">Escolha uma pergunta na lista.</div>'; return; }
  $('qdetail').innerHTML =
    '<div style="display:flex;gap:12px;align-items:center"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div style="min-width:0"><b style="font-weight:600">' + esc(displayName(c)) + '</b><div class="mail">' + esc(c.email) + ' · enviada há ' + hrs(hrsSince(x.criado_em)) + (x.origem ? ' · artigo: ' + esc(x.origem) : '') + '</div></div><button class="link" style="margin-left:auto" data-open="' + esc(c.id) + '" type="button">Abrir ficha →</button></div>' +
    '<blockquote>' + esc(x.texto) + '</blockquote>' +
    '<div class="ctx">' + urgPill(c.urgencia) + '<span class="pill">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span><span class="pill">Estágio: ' + esc(stageLabel(c.estagio)) + '</span></div>' +
    (x.status === 'nova'
      ? '<div class="reply"><label for="reply-txt">Sua resposta · fica salva na ficha de ' + esc(c.email) + '</label>' +
        '<textarea id="reply-txt" placeholder="Escreva aqui."></textarea>' +
        '<p class="sub" id="reply-err" style="margin:0;color:var(--red)" hidden>Escreva a resposta antes de salvar.</p>' +
        '<div class="reply-foot"><small>O envio por e-mail entra na fase 3 — por ora copie a resposta e mande pelo seu e-mail.</small><button class="btn primary" type="button" id="send-reply">Marcar como respondida</button></div></div>'
      : '<div class="sec" style="margin:0"><h4>Sua resposta · ' + esc(fmtDate(x.respondida_em)) + '</h4><div class="sent" style="white-space:pre-wrap">' + esc(x.resposta) + '</div></div>');
}

function renderRespostas() {
  $('qtabs').innerHTML = RS_TABS.map(function (k) {
    return '<button class="qtab" role="tab" data-rs="' + k[0] + '" aria-selected="' + (state.rs === k[0]) + '" type="button">' + k[1] + ' <span class="num">' + R.filter(function (x) { return x.status === k[0]; }).length + '</span></button>';
  }).join('');
  var list = R.filter(function (x) { return x.status === state.rs; }).sort(function (a, b) { return state.rs === 'nova' ? (a.recebido_em < b.recebido_em ? -1 : 1) : (a.recebido_em < b.recebido_em ? 1 : -1); });
  if (!list.some(function (x) { return x.id === state.rsel; })) state.rsel = list.length ? list[0].id : null;
  $('qitems').innerHTML = list.map(function (x) {
    var c = byC(x.contato_id), h = hrsSince(x.recebido_em);
    return '<button class="qitem" data-r="' + x.id + '" aria-current="' + (x.id === state.rsel) + '" type="button"><div class="l1"><b>' + esc(c ? short(c) : x.de_email) + '</b>' +
      (x.status === 'nova' ? '<span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + (h >= 72 ? 'atrasada · ' : '') + hrs(h) + '</span>' : '<span class="sla ok">' + (x.status === 'respondida' ? 'respondida' : 'arquivada') + '</span>') +
      '</div><p>' + esc(canalDe(x)[0] + ' ' + x.texto) + '</p><span class="persona">' + (c ? esc(personaLabel(c)) : 'sem ficha') + ' · ' + esc(canalDe(x)[1]) + (x.assunto ? ' · ' + esc(x.assunto) : '') + '</span></button>';
  }).join('') || '<div class="empty">' + (state.rs === 'nova' ? 'Nenhuma resposta nova por e-mail.' : 'Nada aqui ainda.') + '</div>';
  var x = R.filter(function (y) { return y.id === state.rsel; })[0];
  if (!x) { $('qdetail').innerHTML = '<div class="empty">' + (R.length ? 'Escolha uma resposta na lista.' : 'Quando alguém responder a um e-mail do CRM, a resposta aparece aqui e também chega no seu e-mail.') + '</div>'; return; }
  var c = byC(x.contato_id), m = x.email_id && RM[x.email_id];
  var aQue = m ? (MODELO[m.modelo] || m.modelo) + (m.assunto ? ' · "' + m.assunto + '"' : '') : (x.assunto ? 'assunto "' + x.assunto + '"' : '—');
  var assuntoRe = x.assunto || (m && m.assunto) || '', viaEmail = !x.canal || x.canal === 'email';
  var mailto = 'mailto:' + encodeURIComponent(x.de_email) + '?subject=' + encodeURIComponent(/^re:/i.test(assuntoRe) ? assuntoRe : 'Re: ' + assuntoRe);
  $('qdetail').innerHTML =
    '<div style="display:flex;gap:12px;align-items:center">' + (c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div>' : '<div class="av b">@</div>') +
    '<div style="min-width:0"><b style="font-weight:600">' + esc(c ? displayName(c) : (x.de_nome || 'Sem nome')) + '</b><div class="mail">' + esc(x.de_email) + ' · recebida há ' + hrs(hrsSince(x.recebido_em)) + '</div></div>' +
    (c ? '<button class="link" style="margin-left:auto" data-open="' + esc(c.id) + '" type="button">Abrir ficha →</button>' : '<span class="pill" style="margin-left:auto">Sem ficha no CRM</span>') + '</div>' +
    '<p class="sub" style="margin:12px 0 0"><span class="pill">' + esc(canalDe(x)[0] + ' ' + canalDe(x)[1]) + '</span> Respondeu a: ' + esc(aQue) + '</p>' +
    '<blockquote style="white-space:pre-wrap">' + esc(x.texto) + '</blockquote>' +
    (c ? '<div class="ctx">' + urgPill(c.urgencia) + '<span class="pill">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span><span class="pill">Estágio: ' + esc(stageLabel(c.estagio)) + '</span></div>' : '') +
    '<div class="reply"><div class="reply-foot"><small>' + (c ? 'Responda na aba Conversa da ficha: sai do e-mail do Por Dentro, na mesma conversa do Gmail ' + (viaEmail ? 'dela' : 'dela (o toque e a página não chegam no seu e-mail)') + ', e esta resposta é marcada como respondida sozinha.'
      : 'Sem ficha no CRM: responda pelo seu e-mail (a mensagem completa também chegou lá) e marque aqui.') + '</small><div class="btns">' +
    (x.status === 'nova'
      ? (c ? '<button class="btn primary" type="button" data-openconv="' + esc(c.id) + '">Abrir conversa</button>' : '<a class="btn" href="' + esc(mailto) + '">Responder pelo e-mail</a>') +
        '<button class="btn" type="button" data-rstatus="arquivada">Arquivar</button><button class="btn' + (c ? '' : ' primary') + '" type="button" data-rstatus="respondida">Marcar como respondida</button>'
      : '<button class="btn" type="button" data-rstatus="nova">Voltar para novas</button>') +
    '</div></div></div>';
}

function renderReimpacto() {
  var total = 0;
  $('segs').innerHTML = SEGMENTS.map(function (sg) {
    var n = C.filter(function (c) { return c.segmento === sg.k; }).length; total += n;
    return '<button class="segc" data-seg="' + sg.k + '" aria-pressed="' + (state.seg === sg.k) + '" type="button"><span class="n num">' + n + '</span><span class="t">' + esc(sg.t) + '</span><span class="lever">' + esc(sg.lever) + '</span><span class="why">' + esc(sg.why) + '</span></button>';
  }).join('');
  $('c-reimpacto').textContent = total; $('c-reimpacto').hidden = total === 0;
  var list = C.filter(function (c) { return c.segmento && (!state.seg || c.segmento === state.seg); });
  var sd = SEGMENTS.filter(function (s) { return s.k === state.seg; })[0];
  $('seg-title').textContent = sd ? sd.t : 'Todos os segmentos';
  $('seg-count').textContent = list.length + ' pessoas';
  $('seg-tbody').innerHTML = list.map(function (c) {
    var sg = SEGMENTS.filter(function (s) { return s.k === c.segmento; })[0];
    return '<tr data-id="' + esc(c.id) + '" tabindex="0"><td><div class="nm"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><b>' + esc(displayName(c)) + '</b><span>' + esc(c.email) + '</span></div></div></td>' +
      '<td><span class="persona">' + esc(personaLabel(c)) + '</span><div class="sub">' + esc(subLabel(c)) + '</div></td>' +
      '<td><span class="pill st-' + esc(c.email_status) + '">' + esc(MAIL_ST[c.email_status] || '—') + '</span></td>' +
      '<td class="sub">' + esc(sg ? sg.t : '—') + ' · ' + ago(c.dias) + '</td>' +
      '<td>' + (EXIGEM_NOVIDADES[c.segmento] && !c.aceita_novidades ? '<span class="sub">sem aceite de novidades</span>' : '<button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '">Preparar e-mail</button>') + '</td></tr>';
  }).join('');
  $('seg-empty').hidden = list.length > 0;
}

// Página da pessoa: junta o que ela fez (eventos) com o que você mandou/marcou.
function eventText(e) {
  var d = e.dados || {}, t = e.tipo;
  var m = {
    email_capturado: ['sistema', 'Deixou o e-mail' + (d.origem ? ' (' + origLabel(d.origem) + ')' : '')],
    lembrete_pedido: ['artigo', 'Pediu lembrete do prazo de ' + fmtDay(d.prazo) + (d.artigo ? ' (' + d.artigo + ')' : '')],
    email_recapturado: ['sistema', 'Voltou a deixar o e-mail' + (d.origem ? ' (' + origLabel(d.origem) + ')' : '')],
    quiz_respondido: ['sistema', 'Respondeu o quiz do funil'],
    acesso_ativado: ['app', 'Abriu o link de acesso'],
    senha_definida: ['sistema', 'Definiu uma senha'],
    senha_adiada: ['sistema', 'Adiou a criação de senha'],
    caminho_escolhido: ['sistema', 'Escolheu o caminho: ' + (d.rotulo_para || d.para || '—')],
    app_aberto: ['app', 'Abriu o app'],
    checklist_marcado: ['checklist', 'Marcou um item do checklist' + (d.item ? ': ' + d.item : '')],
    artigo_lido: ['artigo', 'Leu o artigo' + (d.titulo ? ' "' + d.titulo + '"' : d.slug ? ' ' + d.slug : '')],
    pergunta_unica: ['pergunta', 'Enviou uma pergunta única'],
    pergunta_respondida: ['pergunta', 'Você respondeu a pergunta única'],
    um_a_um_agendado: ['uma_um', '1:1 marcado · ' + fmtWhen(d.quando)],
    sinal_enviado: ['sinal', 'Sinal enviado: ' + (d.mensagem || '')],
    email_enviado: ['email', 'E-mail enviado: ' + (MODELO[d.modelo] || d.assunto || d.modelo || '')],
    // Com email_id = respondeu a um e-mail do CRM; sem = escreveu direto para respostas@ (sem ligação com um envio).
    // canal (fase 1a): 'toque' = tocou numa cidade do e-mail 2; 'pagina' = escreveu na página /conversa/.
    email_respondido: ['resposta', d.canal === 'toque' ? 'Tocou no e-mail 2: ' + (d.cidade || '—')
      : d.canal === 'pagina' ? 'Escreveu na página da conversa'
      : (d.email_id ? 'Respondeu o seu e-mail' : 'Mandou um e-mail para você') + (d.assunto ? ': "' + d.assunto + '"' : '')],
    estagio_alterado: ['sistema', 'Estágio: ' + stageLabel(d.de) + ' → ' + stageLabel(d.para)]
  };
  return m[t] || ['sistema', t];
}
// tab: 'conversa' ou 'ficha'; sem tab, a ficha abre na Conversa se já houver alguma mensagem.
async function openPessoa(id, tab) {
  if (state.view !== 'pessoa') state.prevView = state.view;
  state.sel = id; state.ptab = tab || null;
  show('pessoa');
}
// Resumo da jornada: por onde a pessoa passou, quantas vezes voltou e qual e-mail faz sentido agora.
function jornadaPanel(c, h4) {
  var os = origensDe(c), ps = (c.personas && c.personas.length > 1) ? c.personas : [];
  var k = defaultTpl(c), t = TPLS[k];
  var linhas = [];
  linhas.push('<p style="margin:0 0 6px;font-size:13px"><b>Deixou o e-mail ' + nCapturas(c) + (nCapturas(c) === 1 ? ' vez' : ' vezes') + '</b>' +
    (c.ultima_captura_em ? ' · última em ' + esc(fmtDay(c.ultima_captura_em)) : '') + '</p>');
  if (os.length) linhas.push('<div class="ctx" style="margin:0 0 8px">' + os.map(function (o) { return '<span class="pill">' + esc(origLabel(o)) + '</span>'; }).join('') + '</div>');
  if (ps.length) linhas.push('<p class="sub" style="margin:0 0 8px">Personas: ' + esc(ps.map(function (p) { return PERSONAS[p] || p; }).join(' → ')) + '</p>');
  linhas.push('<p class="sub" style="margin:0 0 8px">' + (voltouDepoisDoEmail(c) ? 'Voltou depois do seu último e-mail: ' : 'E-mail sugerido agora: ') + '<b>' + esc(t.label) + '</b>.</p>');
  var bloq = EXIGEM_NOVIDADES[k] && !c.aceita_novidades;
  linhas.push(bloq ? '<p class="sub" style="margin:0;color:var(--red)">Não aceitou novidades por e-mail: este modelo não pode ser enviado.</p>'
    : '<button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(k) + '">Escrever este e-mail →</button>');
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Jornada</h4>' + linhas.join('') + '</div>';
}
// ---------- Aba Conversa (fase 1b) ----------
// Um fio só, em ordem: os e-mails que saíram (automáticos e os seus), o que ela tocou ou escreveu na
// página /conversa/ e as respostas por e-mail. Embaixo, a caixa que responde pelo Worker
// (/api/crm/responder) na mesma conversa do Gmail dela.
function fmtHora(iso) { return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; }
function fmtDia(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '').toUpperCase() : ''; }
function assuntoBase(s) { var t = String(s || '').replace(/\s+/g, ' ').trim(), a; do { a = t; t = t.replace(/^(re|res|enc|fw|fwd|tr|aw)\s*:\s*/i, ''); } while (t !== a); return t; }
// O assunto com que a resposta vai sair: o da última mensagem com Message-ID (a mesma conta do Worker).
function assuntoDoFio(mails, resps) {
  var ult = null;
  mails.forEach(function (m) { var em = m.enviado_em || m.criado_em; if (m.provedor_id && (!ult || em > ult.em)) ult = { em: em, assunto: m.assunto }; });
  resps.forEach(function (r) { if (r.message_id && (!ult || r.recebido_em > ult.em)) ult = { em: r.recebido_em, assunto: r.assunto }; });
  return ult ? 'Re: ' + (assuntoBase(ult.assunto) || 'Por Dentro') : null;
}
function diasAte(ymd) { return Math.round((Date.parse(ymd + 'T12:00:00') - Date.now()) / 864e5); }
function conversaCtx(c, h4) {
  var r = c.respostas || {}, nivel = r.cfNivel, prazo = CF_PRAZO[nivel], top = '';
  if (prazo) {
    var d = diasAte(prazo);
    top = '<div><div class="k">Prazo dela · ' + esc(CF_NIVEL[nivel] || nivel) + '</div><div class="big num">' + esc(fmtDay(prazo)) + '</div><div class="sub">' +
      (d > 1 ? 'faltam ' + d + ' dias' : d === 1 ? 'falta 1 dia' : d === 0 ? 'vence hoje' : 'venceu há ' + (-d) + (d === -1 ? ' dia' : ' dias')) + '</div></div>';
  } else if (c.prazo_limite) {
    top = '<div><div class="k">Prazo do VLS-TS</div><div class="big num">' + esc(fmtDay(c.prazo_limite)) + '</div><div class="sub">' + esc(prazoTxt(c)) + '</div></div>';
  }
  var cidade = r.cfCidade ? esc(CF_CIDADE[r.cfCidade] || r.cfCidade) + ' <span class="pill u-baixa" style="font-size:10.5px">tocou no e-mail</span>' : '—';
  var veio = esc(origLabel(ultimaOrigem(c)) || '—') + (c.utm_content ? ' <span class="sub">· ' + esc(c.utm_content) + '</span>' : '') +
    (voltou(c) ? ' <span class="sub">· deixou o e-mail ' + nCapturas(c) + ' vezes</span>' : '');
  var kv = [['Etapa', esc(CF_ETAPA[r.objetivo] || r.objetivo || '—')], ['Cidade', cidade], ['Veio de', veio],
    ['Novidades', c.aceita_novidades ? 'Aceitou' : 'Não aceitou'], ['Estágio', esc(stageLabel(c.estagio))]];
  return '<aside class="ctxcol">' + top + '<dl class="kv">' + kv.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>' +
    '<div><h4 style="' + h4 + '">Suas anotações</h4><textarea class="notebox" id="nota" data-nota="' + esc(c.id) + '" placeholder="Só você vê.">' + esc(c.nota || '') + '</textarea></div></aside>';
}
function conversaMsg(it, c) {
  var x = it.x, quando = '<time>' + esc(fmtHora(it.em)) + '</time>';
  if (it.k === 'm') {
    var auto = /^cf_guia_/.test(x.modelo), resp = x.modelo === 'resposta';
    var quem = auto ? 'Automático · ' + (x.modelo === 'cf_guia_1' ? 'e-mail 1' : x.modelo === 'cf_guia_conversa' ? 'e-mail 2' : x.modelo)
      : resp ? 'Você · respondeu daqui' : 'Você · ' + (MODELO[x.modelo] || x.modelo);
    var corpo = resp ? '<div class="txt">' + esc(x.corpo || '') + '</div>'
      : '<b class="assunto">' + esc(x.assunto || '(sem assunto)') + '</b>' + (x.corpo ? '<button class="link" type="button" data-mailtoggle="' + x.id + '">ver o e-mail</button><div class="mailbody" id="mb-' + x.id + '" hidden>' + esc(x.corpo) + '</div>' : '');
    return '<div class="msg ' + (auto ? 'auto' : 'me') + '"><span class="who">' + esc(quem) + '</span>' + corpo +
      '<div class="stat"><span class="pill st-' + esc(x.status) + '">' + esc(MAIL_ST[x.status] || x.status) + '</span>' + quando + '</div></div>';
  }
  var nome = pn(c), nova = x.status === 'nova' ? '<span class="pill u-alta">nova</span>' : '';
  if (x.canal === 'toque') return '<div class="msg her"><span class="who">' + esc(nome) + ' · tocou no e-mail 2</span><span class="tapchip">' + esc(String(x.texto).replace(/^Cidade: /, '')) + '</span><div class="stat">' + nova + quando + '</div></div>';
  var via = x.canal === 'pagina' ? 'escreveu na página' : x.email_id ? 'respondeu por e-mail' : 'mandou um e-mail';
  return '<div class="msg her"><span class="who">' + esc(nome) + ' · ' + via + '</span>' + (x.canal !== 'pagina' && x.assunto ? '<span class="sub">' + esc(x.assunto) + '</span>' : '') +
    '<div class="txt">' + esc(x.texto) + '</div><div class="stat">' + nova + quando + '</div></div>';
}
function conversaPanel(c, mails, resps, h4) {
  var itens = mails.map(function (m) { return { k: 'm', x: m, em: m.enviado_em || m.criado_em }; })
    .concat(resps.map(function (r) { return { k: 'r', x: r, em: r.recebido_em }; }))
    .sort(function (a, b) { return a.em < b.em ? -1 : a.em > b.em ? 1 : 0; });
  var dia = '', fio = itens.map(function (it) {
    var d = fmtDia(it.em), sep = d !== dia ? '<span class="day">' + esc(d) + '</span>' : '';
    dia = d; return sep + conversaMsg(it, c);
  }).join('') || '<div class="empty">Nenhuma mensagem ainda. O que você escrever aqui sai por e-mail para ' + esc(c.email) + '.</div>';
  var assunto = assuntoDoFio(mails, resps), rasc = state.rascunho[c.id] || '';
  return '<div class="conv">' + conversaCtx(c, h4) +
    '<section class="thread" aria-label="Conversa com ' + esc(pn(c)) + '"><div class="msgs" id="conv-thread">' + fio + '</div>' +
    '<div class="compose">' +
    (assunto ? '<p class="sub" style="margin:0">Vai como <b>' + esc(assunto) + '</b></p>'
      : '<label class="sub" for="conv-assunto">Assunto (ainda não há conversa por e-mail com ela)</label><input id="conv-assunto" maxlength="200" autocomplete="off">') +
    '<label class="sr" for="conv-txt">Sua resposta</label><textarea id="conv-txt" maxlength="10000" data-cid="' + esc(c.id) + '" placeholder="Responder a ' + esc(pn(c)) + '…">' + esc(rasc) + '</textarea>' +
    '<p class="sub" id="conv-err" style="margin:0;color:var(--red)" role="alert" hidden></p>' +
    '<div class="row"><small>Sai do e-mail do Por Dentro, na mesma conversa do Gmail dela. Se ela responder, volta para esta aba e uma cópia chega no seu e-mail.</small>' +
    '<button class="btn primary" type="button" id="conv-send" data-cid="' + esc(c.id) + '">Enviar</button></div></div></section></div>';
}
async function sendResposta(btn) {
  var err = $('conv-err'), txt = $('conv-txt').value.trim(), as = $('conv-assunto'), cid = btn.dataset.cid;
  err.hidden = true;
  if (!txt) { err.textContent = 'Escreva a resposta antes de enviar.'; err.hidden = false; return; }
  if (as && !as.value.trim()) { err.textContent = 'Escreva um assunto: ainda não há conversa por e-mail com ela.'; err.hidden = false; return; }
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { err.textContent = 'Sessão expirada. Recarregue a página e entre de novo.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ contato_id: cid, texto: txt, assunto: as ? as.value.trim() : undefined })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    delete state.rascunho[cid];
    await reload();
    if (state.view === 'pessoa' && state.sel === cid) { state.ptab = 'conversa'; await renderPessoa(); }
    toast(data.aviso || 'Resposta enviada', data.aviso ? 9000 : 0);
  } catch (e) {
    err.textContent = e.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Enviar';
  }
}
async function renderPessoa() {
  var c = byC(state.sel);
  if (!c) { $('pessoa-page').innerHTML = '<div class="empty">Pessoa não encontrada.</div>'; return; }
  $('pessoa-page').innerHTML = '<div class="loading">Carregando a ficha…</div>';
  var r = await Promise.all([
    supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(200),
    supabase.from('consentimentos').select('finalidade,aceito,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    supabase.from('emails_enviados').select('id,modelo,assunto,corpo,status,provedor_id,enviado_em,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false })
  ]);
  if (state.sel !== c.id || state.view !== 'pessoa') return;   // trocou de tela enquanto carregava
  var eventos = r[0].data || [], cons = r[1].data || [], mails = r[2].data || [];
  var last = function (f) { var x = cons.filter(function (k) { return k.finalidade === f; })[0]; return x ? x.aceito : false; };
  var perg = Q.filter(function (x) { return x.contato_id === c.id; });
  var resps = R.filter(function (x) { return x.contato_id === c.id; });
  var resp = c.respostas || {};
  var kv = [['Entrada na França', fmtDay(c.data_entrada)], ['Prazo do VLS-TS', c.prazo_limite ? fmtDay(c.prazo_limite) + ' (' + prazoTxt(c) + ')' : '—'], ['Fase', c.fase || '—'], ['Nível de estudos', c.nivel_estudos || '—'], ['Preocupação', c.preocupacao || '—'], ['Origem (1ª vez)', origLabel(c.origem) || '—'], ['Última origem', origLabel(ultimaOrigem(c)) || '—'], ['Campanha (UTM)', c.utm_campaign || '—'], ['Conteúdo / post (UTM)', c.utm_content || '—'], ['Fonte (UTM)', c.utm_source || '—']]
    .concat(Object.keys(resp).map(function (k) { var l = RESP_LABEL[k]; return l ? [l[0], l[1](resp[k])] : [k, resp[k]]; }));
  var h4 = 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px';
  if (!state.ptab) state.ptab = mails.length || resps.length ? 'conversa' : 'ficha';
  var tabs = '<div class="ptabs" role="tablist" aria-label="Ficha da pessoa">' + [['conversa', 'Conversa'], ['ficha', 'Ficha']].map(function (t) {
    return '<button class="ptab" role="tab" type="button" data-ptab="' + t[0] + '" aria-selected="' + (state.ptab === t[0]) + '">' + t[1] +
      (t[0] === 'conversa' && resps.some(function (x) { return x.status === 'nova'; }) ? ' <span class="count">nova</span>' : '') + '</button>';
  }).join('') + '</div>';
  $('pessoa-page').innerHTML =
    '<button class="link" data-back type="button">← Voltar</button>' +
    '<div class="pessoa-head" style="margin-top:12px"><div class="' + avClass(c) + '" style="width:52px;height:52px;font-size:16px">' + esc(ini(c)) + '</div>' +
    '<div style="min-width:0;flex:1"><h2 style="font-size:24px">' + esc(displayName(c)) + '</h2><p class="sub" style="margin:2px 0 0">' + esc(c.email) + '</p>' +
    '<div class="ctx" style="margin-top:8px">' + urgPill(c.urgencia) + '<span class="pill">' + esc(stageLabel(c.estagio)) + '</span><span class="pill">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></div></div></div>' +
    '<p class="sub" style="margin-top:10px">' + (c.motivo ? 'Por que precisa de atenção: ' + esc(c.motivo) : 'Urgência ' + esc(URG[c.urgencia].toLowerCase()) + ': ' + esc(URG_WHY[c.urgencia])) + '</p>' +
    '<div class="actions" style="margin-top:14px">' +
    '<button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '">Escrever e-mail</button>' +
    '<button class="btn" type="button" data-open1a1="' + esc(c.id) + '">Marcar 1:1</button>' +
    '<button class="btn" type="button" data-opensinal="' + esc(c.id) + '">Enviar sinal ao dashboard</button>' +
    '<div class="sel"><select id="stage-pick" aria-label="Mudar estágio">' + STAGES.map(function (s) { return '<option value="' + s.k + '"' + (s.k === c.estagio ? ' selected' : '') + '>Estágio: ' + s.l + '</option>'; }).join('') + '</select></div></div>' +
    tabs + (state.ptab === 'conversa' ? conversaPanel(c, mails, resps, h4) :
    '<div class="pessoa-grid" style="margin-top:18px">' +
    '<div class="panel" style="padding:16px"><h3 style="font-size:15px; margin-bottom:8px">Tudo que ela fez</h3>' +
    '<p class="sub" style="margin:0 0 10px">Checklist, pergunta única, artigos e o resto do app — mais o que você mandou pra ela. Mais recente primeiro.</p>' +
    '<div class="feed">' + (eventos.map(function (e) {
      var tx = eventText(e), m = TYPE_META[tx[0]];
      return '<div class="feeditem"><span class="pill ' + m[1] + '">' + esc(m[0]) + '</span><div class="fbody"><p>' + esc(tx[1]) + '</p><time>' + esc(fmtDate(e.criado_em)) + '</time></div></div>';
    }).join('') || '<div class="empty">Nada registrado ainda.</div>') + '</div></div>' +
    '<div style="display:flex; flex-direction:column; gap:16px">' +
    jornadaPanel(c, h4) +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">O que respondeu no funil</h4><dl class="kv">' + kv.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>' +
    (perg.length ? '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Perguntas únicas</h4>' + perg.map(function (x) { return '<p style="margin:0 0 6px;font-size:13px">"' + esc(x.texto) + '" <button class="link" data-openq="' + x.id + '" type="button">' + (x.status === 'nova' ? 'Responder' : 'Ver resposta') + ' →</button></p>'; }).join('') + '</div>' : '') +
    (resps.length ? '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Respostas</h4>' + resps.map(function (x) { return '<p style="margin:0 0 6px;font-size:13px"><span title="' + esc(canalDe(x)[1]) + '">' + canalDe(x)[0] + '</span> "' + esc(x.texto.length > 160 ? x.texto.slice(0, 160) + '…' : x.texto) + '" <span class="sub">' + esc(canalDe(x)[1]) + ' · ' + esc(fmtDate(x.recebido_em)) + '</span> <button class="link" data-openr="' + x.id + '" type="button">' + (x.status === 'nova' ? 'Abrir na caixa' : 'Ver') + ' →</button></p>'; }).join('') + '</div>' : '') +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">E-mails enviados</h4>' + (mails.map(function (m) {
      return '<div class="mailrow"><button class="mh" data-mailtoggle="' + m.id + '" type="button"><b>' + esc(MODELO[m.modelo] || m.modelo) + '</b><span class="pill st-' + esc(m.status) + '">' + esc(MAIL_ST[m.status] || m.status) + '</span><time>' + esc(fmtDate(m.enviado_em || m.criado_em)) + '</time></button><div class="mailbody" id="mb-' + m.id + '" hidden>' + esc(m.corpo || '(sem corpo salvo)') + '</div></div>';
    }).join('') || '<p class="sub" style="margin:0">Nenhum e-mail enviado por aqui ainda.</p>') + '</div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Consentimento</h4><div class="consent"><span class="pill ' + (last('servico') ? 'u-baixa' : '') + '">Política de privacidade ' + (last('servico') ? '✓' : '—') + '</span><span class="pill ' + (last('novidades_email') ? 'u-baixa' : '') + '">Novidades por e-mail ' + (last('novidades_email') ? '✓' : '—') + '</span></div></div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Instagram</h4>' +
      '<label class="sub" for="ig-handle" style="display:block;margin:0 0 4px">@ do Instagram</label>' +
      '<input id="ig-handle" data-ig="instagram" data-cid="' + esc(c.id) + '" maxlength="40" autocomplete="off" placeholder="Ainda sem @. Se descobrir, cole aqui (sem o @ ou com)." value="' + esc(c.instagram || '') + '" style="width:100%;height:38px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;font:inherit">' +
      (c.instagram ? '<p class="sub" style="margin:6px 0 0"><a href="https://instagram.com/' + esc(c.instagram) + '" target="_blank" rel="noopener">Abrir o perfil no Instagram</a></p>' : '') +
      '<label class="sub" for="ig-id" style="display:block;margin:12px 0 4px">ID do contato na automação</label>' +
      '<input id="ig-id" data-ig="ig_id" data-cid="' + esc(c.id) + '" maxlength="60" autocomplete="off" placeholder="Vem do link da automação. Pode colar à mão." value="' + esc(c.ig_id || '') + '" style="width:100%;height:38px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;font:inherit">' +
      '<p class="sub" style="margin:8px 0 0">Quando a pessoa volta a deixar o e-mail, o que estiver vazio aqui é completado. O que você escreve não é apagado.</p></div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Suas anotações</h4><textarea class="notebox" id="nota" data-nota="' + esc(c.id) + '" placeholder="Só você vê. Ex.: prefere falar por e-mail, tem sponsor na família.">' + esc(c.nota || '') + '</textarea></div>' +
    '</div></div>');
  var ct = $('conv-txt');
  if (ct) { var th = $('conv-thread'); if (th) th.scrollTop = th.scrollHeight; }
}

// ---------- Modais ----------
function modalOpen(html) { $('compose-modal').innerHTML = '<div class="card">' + html + '</div>'; $('compose-modal').hidden = false; $('compose-backdrop').hidden = false; }
function closeCompose() { $('compose-modal').hidden = true; $('compose-backdrop').hidden = true; }
function modalTop(c) { return '<div class="top"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><h3>' + esc(displayName(c)) + '</h3><div class="mail">' + esc(c.email) + '</div></div></div>'; }
var SINAIS = [
  { label: 'Lembrete de prazo', body: function (c) { return c.motivo ? 'Lembrete: ' + c.motivo + '.' : 'Lembrete: fique de olho no seu prazo.'; } },
  { label: 'Dica extra', body: function () { return 'Separei uma dica extra pro seu momento — dá uma olhada no seu checklist.'; } },
  { label: 'Convite pro 1:1', body: function () { return 'Que tal marcarmos um 1:1 pra destravar o seu caso?'; } }
];
function openSinal(cid) {
  var c = byC(cid); activeCid = cid;
  modalOpen(modalTop(c) + '<div class="ctx" style="margin-top:12px"><span class="pill out">Aparece no dashboard dela</span></div>' +
    '<p class="sub" style="margin-top:8px">Não é e-mail — é um aviso dentro do app dela, na próxima vez que abrir.</p>' +
    '<div class="reply" style="margin-top:10px"><label>Um ponto de partida, se quiser</label><div class="tpls">' +
    SINAIS.map(function (s, i) { return '<button class="chip" type="button" data-sinalpick="' + i + '">' + esc(s.label) + '</button>'; }).join('') + '</div>' +
    '<textarea id="compose-txt" maxlength="500" placeholder="Escreva a mensagem do sinal..." style="min-height:110px"></textarea></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="sinal-send">Enviar sinal →</button></div>');
}

// ---------- Modelos de e-mail: o estúdio (Estúdio de e-mails, entregas 1 e 2) ----------
// Três colunas, no padrão do estúdio de produtos do admin: os modelos · o editor em seções · a prévia com uma pessoa
// de verdade. O texto é feito de blocos (estudio.js monta o assunto, o texto puro e o HTML) e fica na versão do modelo
// (modelos_email_versoes). Rascunho e Revisão só aparecem aqui e no teste para você; o que sai é a versão No ar: os
// 2 automáticos pelo Worker e os 8 manuais pelo "Escrever este e-mail" da ficha (o texto vem daqui, com TPLS de reserva).
// Sem a migração da entrega 1, a tela mostra os 8 do código; sem a da entrega 2, mostra tudo sem editar.
var TIPO_EMAIL = { servico: ['Serviço', 'u-baixa'], novidades: ['Novidades', 'u-media'], compra: ['Compra', 'tp-pergunta'] };
var ETAPA_EMAIL = { rascunho: ['Rascunho', ''], revisao: ['Revisão', 'u-media'], no_ar: ['No ar', 'u-baixa'], arquivado: ['Arquivado', 'out'] };
var ST = { k: null, v: null, blk: null, sec: 'texto', who: null, q: '', dev: 'pc', marcar: true, tab: 'editar', d: null, dKey: null, montado: null, vistos: {}, foco: null, salvo: '', timer: null };
var SECOES = [['obj', 'Objetivo e envio'], ['para', 'Para quem'], ['ctx', 'Contexto da pessoa'], ['texto', 'Texto'], ['pronto', 'Pronto para usar?'], ['versoes', 'Versões']];
function versoesDe(k) { return MV.filter(function (v) { return v.chave === k; }); }   // da mais nova para a mais velha
function versaoAtual(k) { var vs = versoesDe(k); return vs.filter(function (v) { return v.etapa === 'no_ar'; })[0] || vs[0] || null; }
function versaoEmObra(k) { return versoesDe(k).filter(function (v) { return v.etapa === 'rascunho' || v.etapa === 'revisao'; })[0] || null; }
function pillDe(map, k) { var p = map[k] || [k, '']; return '<span class="pill ' + p[1] + '"><span class="dot"></span>' + esc(p[0]) + '</span>'; }
function etapaTxt(v) { return v ? (ETAPA_EMAIL[v.etapa] || [v.etapa])[0] + ' · v' + v.versao : 'Sem versão'; }
// Mostra as variáveis ({nome}, {#nivel}…{/nivel}) destacadas no texto guardado.
function marcarVars(txt) { return esc(txt).replace(/\{([#^/]?)(\w+)\}/g, function (m) { return '<span class="var">' + m + '</span>'; }); }
// Igual ao crmTextToHtml do Worker: o HTML que sai dos modelos que só têm texto.
function textoParaHtml(text) {
  var safe = esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (u) { return '<a href="' + u + '">' + u + '</a>'; });
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2B2B2B">' + safe.replace(/\n/g, '<br>') + '</div>';
}
var temBlocos = function () { return MV.length > 0 && Object.prototype.hasOwnProperty.call(MV[0], 'blocos'); };   // migração da entrega 2
function modeloAtual() { return (M || []).filter(function (x) { return x.chave === ST.k; })[0] || null; }
function versaoAberta() { return MV.filter(function (x) { return x.chave === ST.k && x.versao === ST.v; })[0] || null; }
function podeEditar(v) { return !!(v && v.blocos && temBlocos() && (v.etapa === 'rascunho' || v.etapa === 'revisao')); }
function ajudantes() { return { pn: pn, persona: personaLabel, fmtDay: fmtDay, appLink: APP_LINK, calLink: CAL_LINK }; }
function dadosPara(k, c) { return ES.dadosDe(k, c, ajudantes()); }

// O texto que o painel manda num envio manual: a versão No ar do modelo, preenchida para a pessoa. TPLS é a reserva.
function textoDoModelo(c, k) {
  var v = M ? versaoAtual(k) : null;
  if (v && v.etapa === 'no_ar' && !(M.filter(function (m) { return m.chave === k; })[0] || {}).automatico) {
    try { var r = ES.montarComDados(v, dadosPara(k, c)); return { subject: r.assunto, body: r.texto, versao: v.versao }; }
    catch (e) { console.error('modelo ' + k + ' v' + v.versao + ': ' + e.message + ' — uso o texto do código'); }
  }
  var t = splitTpl(c, k); t.versao = null; return t;
}

// Abre o modelo k: a versão em obra (rascunho ou revisão), se houver; senão a No ar.
function abrirModelo(k, versao) {
  ST.k = k;
  var v = versao ? MV.filter(function (x) { return x.chave === k && x.versao === versao; })[0] : (versaoEmObra(k) || versaoAtual(k));
  ST.v = v ? v.versao : null;
  ST.d = v && v.blocos ? JSON.parse(JSON.stringify(v.blocos)) : null;
  ST.dKey = k + ':' + ST.v;
  ST.montado = null;
}
function montarRascunho() {
  var m = modeloAtual();
  if (!ST.d || !m) { ST.montado = null; return null; }
  ST.montado = ES.montar(ST.d, m.tipo);
  return ST.montado;
}
// O texto que a prévia usa: o que está sendo editado, ou o guardado na versão.
function textoDaPrevia() {
  var v = versaoAberta();
  if (podeEditar(v) && ST.d) return montarRascunho() || v;
  return v;
}

function renderModelos() {
  var aviso = $('mod-aviso');
  var msg = !M ? 'A tabela de modelos ainda não está no banco (rode db/crm-modelos-email.sql). Mostrando os 8 modelos do painel, com o texto do código, sem editar.'
    : !temBlocos() ? 'Para editar no estúdio, rode db/crm-estudio-emails-2.sql no Supabase. Até lá, a tela mostra os modelos e as versões sem editar.' : '';
  aviso.hidden = !msg; aviso.textContent = msg;
  $('mod-export').disabled = !M;
  $('studio').dataset.tab = ST.tab;
  document.querySelectorAll('[data-sttab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sttab === ST.tab)); });
  var lista = M || TPL_ORDER.map(function (k) { return { chave: k, nome: TPLS[k].label, objetivo: TPLS[k].when, automatico: false, tipo: EXIGEM_NOVIDADES[k] ? 'novidades' : 'servico' }; });
  if (!ST.k || !lista.some(function (m) { return m.chave === ST.k; })) { if (lista.length) abrirModelo(lista[0].chave); }
  else if (ST.v != null && !versaoAberta() && M) abrirModelo(ST.k);
  renderLista(lista);
  renderEditor(lista);
  renderPrevia();
}

function renderLista(lista) {
  var card = function (m) {
    var v = M ? versaoAtual(m.chave) : null, obra = M ? versaoEmObra(m.chave) : null;
    var dot = !v ? 'dr' : obra ? (obra.etapa === 'revisao' ? 'rev' : 'dr') : v.etapa === 'no_ar' ? 'ok' : 'dr';
    var linha = !M ? 'Texto do código' : etapaTxt(v) + (obra ? ' · ' + etapaTxt(obra).toLowerCase() : '');
    return '<button class="st-item" data-tpl-pick="' + esc(m.chave) + '" aria-pressed="' + (ST.k === m.chave) + '" type="button"><span class="sdot ' + dot + '"></span><span><b>' + esc(m.nome) + '</b>' +
      '<span>' + esc(linha) + '</span></span></button>';
  };
  var grupo = function (titulo, itens) { return itens.length ? '<p class="tplgrp">' + esc(titulo) + ' · ' + itens.length + '</p>' + itens.map(card).join('') : ''; };
  $('mod-list').innerHTML = grupo('Você envia', lista.filter(function (m) { return !m.automatico; })) + grupo('Saem sozinhos', lista.filter(function (m) { return m.automatico; })) +
    '<div class="st-legend"><span><i class="sdot ok"></i>No ar</span><span><i class="sdot rev"></i>Em revisão</span><span><i class="sdot dr"></i>Rascunho</span></div>';
}

function secao(id, titulo, dica, corpo) {
  var on = ST.sec === id;
  return '<div class="st-sec' + (on ? ' is-open' : '') + '"><button type="button" class="st-sec-h" data-stsec="' + id + '" aria-expanded="' + on + '"><b>' + esc(titulo) + '</b><span>' + esc(dica) + '</span><i aria-hidden="true">▾</i></button>' +
    (on ? '<div class="st-sec-in">' + corpo + '</div>' : '') + '</div>';
}
function campoTxt(f, valor, rot, opts) {
  opts = opts || {};
  var dis = opts.ro ? ' disabled' : '';
  var ctl = opts.area
    ? '<textarea class="st-in" data-f="' + f + '" rows="' + (opts.rows || 3) + '"' + dis + ' placeholder="' + esc(opts.ph || '') + '">' + esc(valor || '') + '</textarea>'
    : '<input class="st-in" data-f="' + f + '" value="' + esc(valor || '') + '"' + dis + ' placeholder="' + esc(opts.ph || '') + '" maxlength="' + (opts.max || 400) + '">';
  return '<label class="st-fld"><span>' + esc(rot) + '</span>' + ctl + (opts.dica ? '<small>' + esc(opts.dica) + '</small>' : '') + '</label>';
}
function opcoes(lista, atual, primeira) {
  return (primeira ? '<option value="">' + esc(primeira) + '</option>' : '') + lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === (atual || '') ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
}
function varsDoTipo(k, t) { return ES.varsDoModelo(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].t === t; }); }

function blocoEditor(b, i, n, k, ro) {
  var f = function (campo) { return 'itens.' + i + '.' + campo; };
  var dis = ro ? ' disabled' : '';
  var corpo = '';
  var alt = function () { return campoTxt(f('alt'), b.alt, 'Se faltar um dado deste bloco, escrever', { ro: ro, ph: 'vazio: cada dado usa o plano B dele' }); };
  if (b.tipo === 'texto') {
    corpo = campoTxt(f('texto'), b.texto, 'Texto', { area: true, rows: 3, ro: ro, max: 3000 }) +
      '<label class="st-fld"><span>Estilo</span><select class="st-in" data-f="' + f('estilo') + '"' + dis + '>' + opcoes([['', 'Normal'], ['caixa', 'Em caixa (ex.: "Ficou com dúvida?")'], ['discreto', 'Discreto, em cinza']], b.estilo) + '</select></label>' + alt();
  } else if (b.tipo === 'titulo') {
    corpo = campoTxt(f('texto'), b.texto, 'Título', { ro: ro }) + alt();
  } else if (b.tipo === 'pergunta') {
    corpo = campoTxt(f('texto'), b.texto, 'Pergunta', { ro: ro }) + alt() + campoTxt(f('ajuda'), b.ajuda, 'Linha de ajuda (opcional)', { ro: ro });
  } else if (b.tipo === 'botao') {
    var links = varsDoTipo(k, 'link').map(function (x) { return [x, '{' + x + '} · ' + ES.CAT[x].o]; });
    corpo = campoTxt(f('rotulo'), b.rotulo, 'O que está escrito no botão', { ro: ro, max: 80 }) +
      '<label class="st-fld"><span>Para onde leva</span><select class="st-in" data-f="' + f('link') + '"' + dis + '>' + opcoes(links, b.link, links.length ? 'Escolha o link' : 'Este modelo não tem link') + '</select>' +
      '<small>O link vem do banco ou do código na hora do envio: nunca é digitado.</small></label>' +
      campoTxt(f('complemento'), b.complemento, 'Complemento do link (opcional)', { ro: ro, ph: '&utm_source=email&utm_campaign=…', max: 200 });
  } else if (b.tipo === 'destaque') {
    corpo = campoTxt(f('rotulo'), b.rotulo, 'Rótulo (em cima, pequeno)', { ro: ro }) + campoTxt(f('valor'), b.valor, 'Valor (curto fica grande; várias linhas ficam em lista)', { area: true, rows: 2, ro: ro }) +
      campoTxt(f('nota'), b.nota, 'Nota (embaixo, opcional)', { ro: ro });
  } else if (b.tipo === 'apresentacao') {
    corpo = '<div class="st-foto"><img src="' + esc(ES.FOTO_URL) + '" alt="" width="40" height="40"><small>A foto é sempre a sua, do site.</small></div>' +
      campoTxt(f('titulo'), b.titulo, 'Nome', { ro: ro }) + campoTxt(f('texto'), b.texto, 'Uma linha sobre você', { ro: ro });
  } else if (b.tipo === 'toques') {
    var pr = varsDoTipo(k, 'pronto');
    corpo = pr.length ? '<label class="st-fld"><span>Botões</span><select class="st-in" data-f="' + f('var') + '"' + dis + '>' + opcoes(pr.map(function (x) { return [x, ES.CAT[x].o]; }), b.var) + '</select>' +
      '<small>Cada botão leva o link assinado dela e registra o toque na ficha. Vêm prontos do Worker.</small></label>'
      : '<p class="st-msg warn">Este modelo não tem respostas de um toque (hoje só o e-mail 2 do guia tem os botões de cidade).</p>';
  } else if (b.tipo === 'etapa') {
    var etapas = ES.varsDoModelo(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].etapa; });
    corpo = '<label class="st-fld"><span>Só para quem está na etapa</span><select class="st-in" data-f="' + f('se') + '"' + dis + '>' +
      opcoes(etapas.map(function (x) { return ['#' + x, ES.CAT[x].o.replace(/^etapa do guia: /, '')]; }), b.se, etapas.length ? 'Escolha a etapa' : 'Este modelo não tem etapa') + '</select></label>' +
      campoTxt(f('rotulo'), b.rotulo, 'Linha pequena de cima (opcional)', { ro: ro }) + campoTxt(f('titulo'), b.titulo, 'Frase em negrito (opcional)', { ro: ro }) +
      campoTxt(f('texto'), b.texto, 'Texto', { area: true, rows: 3, ro: ro, max: 3000 });
  } else {
    corpo = campoTxt(f('texto'), b.texto, 'Assinatura', { ro: ro });
  }
  // "Mostrar só se…": vale para todo bloco, menos o de etapa (que já é condição).
  if (b.tipo !== 'etapa') {
    var cond = ES.varsDoModelo(k).filter(function (x) { return ES.CAT[x] && (ES.CAT[x].t === 'texto' || ES.CAT[x].t === 'sim'); });
    var ops = [];
    cond.forEach(function (x) { ops.push(['#' + x, 'Só se tiver {' + x + '}']); ops.push(['^' + x, 'Só se NÃO tiver {' + x + '}']); });
    corpo += '<label class="st-fld"><span>Mostrar</span><select class="st-in" data-f="' + f('se') + '"' + dis + '>' + opcoes(ops, b.se, 'Sempre') + '</select></label>';
  }
  var cTxt = b.se ? ' · ' + (b.se[0] === '#' ? 'só se tiver ' : 'só se não tiver ') + b.se.slice(1) : '';
  var resumo = String(b.texto || b.rotulo || b.titulo || '').replace(/\s+/g, ' ').slice(0, 60);
  var aberto = ST.blk === i;
  return '<div class="st-blk' + (aberto ? ' is-open' : '') + '"><div class="st-blk-h"><button type="button" class="st-blk-t" data-blkopen="' + i + '" aria-expanded="' + aberto + '"><b>' + esc((ES.TIPOS[b.tipo] || {}).nome || b.tipo) + '</b>' +
    '<span>' + esc(resumo + cTxt) + '</span></button>' +
    (ro ? '' : '<button type="button" class="st-ic" data-bmove="' + i + ':-1" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="st-ic" data-bmove="' + i + ':1" aria-label="Descer"' + (i === n - 1 ? ' disabled' : '') + '>↓</button>' +
      '<button type="button" class="st-ic" data-bdel="' + i + '" aria-label="Tirar o bloco">✕</button>') + '</div>' +
    (aberto ? '<div class="st-blk-in">' + corpo + '</div>' : '') + '</div>';
}

function chipsDados(k) {
  return '<div class="st-chips"><span class="sub">Inserir dado:</span>' + ES.varsDoModelo(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].t !== 'sim' && ES.CAT[x].t !== 'pronto' && !/^link_/.test(x); })
    .map(function (x) { return '<button type="button" class="chip" data-insvar="' + esc(x) + '">{' + esc(x) + '}</button>'; }).join('') + '</div>';
}

function renderEditor(lista) {
  var box = $('st-edit');
  var m = (M ? modeloAtual() : null) || (lista || []).filter(function (x) { return x.chave === ST.k; })[0];
  if (!m) { box.innerHTML = '<div class="empty">Nenhum modelo ainda.</div>'; return; }
  if (!M) { box.innerHTML = '<h3 class="st-title">' + esc(m.nome) + '</h3><p class="sub">' + esc(m.objetivo) + '</p><p class="st-msg tip">Sem a tabela de modelos, o texto vem do código e não dá para editar aqui.</p>'; return; }
  var v = versaoAberta(), vs = versoesDe(m.chave), ro = !podeEditar(v), k = m.chave, obra = versaoEmObra(k);
  var d = ST.d || (v && v.blocos) || null;
  if (!ro) montarRascunho();
  var confs = d ? ES.conferir(d, m, ro ? v : ST.montado, m.automatico) : [];
  var travas = confs.filter(function (x) { return !x.ok && x.trava; }).length;
  var testado = v && v.testado_em;
  var vistos = Object.keys(ST.vistos[ST.dKey] || {}).length;

  // Topo: nome, tipo, etapa e as ações.
  var acoes = '';
  if (v && !ro) {
    acoes = '<button class="btn" type="button" id="st-teste">Enviar teste para mim</button>' +
      (v.etapa === 'rascunho' ? '<button class="btn primary" type="button" id="st-revisao"' + (travas ? ' disabled' : '') + '>Mandar para revisão</button>'
        : '<button class="btn primary" type="button" id="st-publicar"' + (travas || !testado ? ' disabled' : '') + '>Publicar (No ar)</button>');
  } else if (v && temBlocos()) {
    acoes = obra && obra.versao !== v.versao ? '<button class="btn primary" type="button" data-stver="' + obra.versao + '">Abrir a ' + esc(etapaTxt(obra).toLowerCase()) + '</button>'
      : '<button class="btn primary" type="button" id="st-nova">Editar em versão nova</button>';
    acoes = '<button class="btn" type="button" id="st-teste">Enviar teste para mim</button>' + acoes;
  }
  var topo = '<div class="st-head"><div class="st-head-t"><h3 class="st-title">' + esc(m.nome) + '</h3><div class="st-pills">' + pillDe(TIPO_EMAIL, m.tipo) + (v ? pillDe(ETAPA_EMAIL, v.etapa) + '<span class="sub">versão ' + v.versao + '</span>' : '') +
    '<span class="sub" id="st-salvo">' + esc(ST.salvo) + '</span></div></div><div class="st-acts">' + acoes + '</div></div>' +
    (v && ro && temBlocos() ? '<p class="st-msg tip">' + (v.etapa === 'no_ar' ? 'Esta é a versão No ar: é ela que sai. ' : v.etapa === 'arquivado' ? 'Esta versão já saiu e fica guardada como está. ' : '') +
      (v.blocos ? '' : 'Ainda está em texto corrido (como era no código). ') + 'Para mudar, crie uma versão nova: a de agora continua saindo até você publicar a nova.</p>' : '') +
    (v && !ro && v.etapa === 'revisao' ? '<p class="st-msg tip">Em revisão. ' + (testado ? 'Teste enviado em ' + esc(fmtWhen(v.testado_em)) + '.' : 'Falta enviar o teste para você.') + ' Mudar o texto pede um teste novo.</p>' : '');

  // 1. Objetivo e envio
  var s1 = '<label class="st-fld"><span>Objetivo</span><textarea class="st-in" id="st-objetivo" rows="2" maxlength="300">' + esc(m.objetivo) + '</textarea></label>' +
    '<dl class="tplmeta"><dt>Tipo</dt><dd>' + pillDe(TIPO_EMAIL, m.tipo) + ' <span class="sub">' + esc(ES.TIPO_RODAPE[m.tipo] || '') + '</span></dd>' +
    '<dt>Como sai</dt><dd>' + esc(m.como_sai) + '</dd></dl>' +
    '<p class="st-msg tip">Quem recebe e quando continuam no código: o Worker confere o aceite de novidades a cada envio, mesmo que alguém mude o texto aqui.</p>';
  // 2. Para quem
  var s2 = '<dl class="tplmeta"><dt>Quem recebe</dt><dd>' + esc(m.quem_recebe || 'Todos') + '</dd>' +
    (k.indexOf('cf_') === 0 ? '<dt>Material</dt><dd>Guia Études en France 2027-2028</dd>' : k.indexOf('guia_') === 0 ? '<dt>Material</dt><dd>' + esc(k === 'guia_alternancia' ? 'Guia alternância 30+' : 'Guia VLS-TS') + '</dd>' : '') +
    (m.automatico ? '' : '<dt>Sugerido</dt><dd>' + esc((TPLS[k] && TPLS[k].when) || '—') + '</dd>') + '</dl>';
  // 3. Contexto da pessoa: cada dado, o que é e o que acontece se faltar (o plano B)
  var s3 = ES.varsDoModelo(k).map(function (x) {
    var c = ES.CAT[x] || { t: 'texto', o: x }, p = d && d.planos && Object.prototype.hasOwnProperty.call(d.planos, x) ? d.planos[x] : c.plano;
    var se;
    if (c.t === 'texto') {
      se = '<div class="st-plano"><select class="st-in" data-plano="' + esc(x) + '"' + (ro ? ' disabled' : '') + '>' + opcoes([['troca', 'Se faltar, escrever:'], ['some', 'Se faltar, o bloco some']], p == null ? 'some' : 'troca') + '</select>' +
        (p == null ? '' : '<input class="st-in" data-f="planos.' + esc(x) + '" value="' + esc(p) + '" placeholder="(fica vazio)"' + (ro ? ' disabled' : '') + '>') + '</div>';
    } else if (c.t === 'link') se = '<small>' + (c.privado ? 'Link privado, vem do banco. ' : '') + 'Sem ele, o envio é recusado.</small>';
    else if (c.t === 'fixo') se = '<small>Sempre existe.</small>';
    else if (c.t === 'sim') se = '<small>Sim ou não: use em "Mostrar só se…" ou no bloco "Só para uma etapa".</small>';
    else se = '<small>Vem pronto do Worker.</small>';
    return '<div class="st-var"><code>{' + esc(x) + '}</code><span>' + esc(c.o) + '</span>' + se + '</div>';
  }).join('') + '<p class="st-msg tip">O plano B vale para o modelo todo. Um bloco pode ter o próprio texto "se faltar um dado".</p>';
  // 4. Texto
  var s4;
  if (!d) {
    s4 = v ? '<p class="st-msg tip">Texto guardado desta versão (ainda sem blocos):</p><p class="previewsubj" style="font-size:15px">' + marcarVars(v.assunto) + '</p>' +
      (v.preheader ? '<p class="sub" style="margin:0">Prévia: ' + marcarVars(v.preheader) + '</p>' : '') + '<div class="mailbody">' + marcarVars(v.corpo_texto) + '</div>' : '<div class="empty">Sem versão.</div>';
  } else {
    s4 = campoTxt('assunto', d.assunto, 'Assunto', { ro: ro, max: 300 }) + campoTxt('assunto_alt', d.assunto_alt, 'Assunto se faltar um dado (opcional)', { ro: ro, max: 300 }) +
      campoTxt('pre', d.pre, 'Prévia (a linha cinza depois do assunto, opcional)', { ro: ro, max: 300 }) +
      (ro ? '' : chipsDados(k)) +
      '<div class="st-blks">' + (d.itens || []).map(function (b, i) { return blocoEditor(b, i, d.itens.length, k, ro); }).join('') + '</div>' +
      (ro ? '' : '<div class="st-add"><select class="st-in" id="st-novo-bloco" aria-label="Tipo do bloco novo">' + opcoes(Object.keys(ES.TIPOS).map(function (t) { return [t, ES.TIPOS[t].nome + ' · ' + ES.TIPOS[t].d]; }), '', '+ Acrescentar um bloco') + '</select></div>') +
      '<div class="st-rodape"><b>Rodapé (automático pelo tipo)</b>' + campoTxt('rodape', d.rodape, 'Por que ela recebe (opcional)', { ro: ro, ph: 'ex.: pediu o checklist Études en France com {email}', max: 300 }) +
      '<small>' + esc(ES.rodapeDe(d, m.tipo) || 'Sem rodapé (serviço sem motivo escrito).') + '</small></div>';
  }
  // 5. Pronto para usar?
  var s5 = d ? '<ul class="st-ready">' + confs.map(function (x) { return '<li class="' + (x.ok ? 'y' : x.trava ? 'n' : 'w') + '">' + esc(x.txt) + '</li>'; }).join('') +
    '<li class="' + (vistos >= 2 ? 'y' : 'w') + '">Prévia vista com ' + vistos + (vistos === 1 ? ' pessoa' : ' pessoas') + (vistos >= 2 ? '' : ' (veja com pelo menos duas)') + '</li>' +
    '<li class="' + (testado ? 'y' : 'n') + '">' + (testado ? 'Teste enviado em ' + esc(fmtWhen(v.testado_em)) : 'Teste para você ainda não enviado (precisa para publicar)') + '</li></ul>' +
    (m.automatico ? '<p class="st-msg tip">Saem sozinhos: ao publicar, o próximo envio já sai com este texto. A versão de agora fica guardada.</p>' : '<p class="st-msg tip">Ao publicar, o "Escrever este e-mail" da ficha passa a abrir com este texto (os manuais saem em texto simples, como hoje).</p>')
    : '<p class="st-msg tip">Crie uma versão nova para montar em blocos e conferir.</p>';
  // 6. Versões
  var s6 = '<ul class="st-vers">' + vs.map(function (x) {
    var quando = x.etapa === 'no_ar' ? 'no ar desde ' + fmtDay(x.publicado_em) : x.publicado_em ? 'saiu em ' + fmtDay(x.publicado_em) : 'criada em ' + fmtDay(x.criado_em);
    return '<li' + (x.versao === ST.v ? ' aria-current="true"' : '') + '><button type="button" class="st-verbtn" data-stver="' + x.versao + '"><b>v' + x.versao + '</b> ' + pillDe(ETAPA_EMAIL, x.etapa) +
      '<span class="sub">' + esc(quando) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span></button>' +
      (x.etapa === 'arquivado' && temBlocos() ? '<button type="button" class="btn" data-stvoltar="' + x.versao + '">Voltar para esta</button>' : '') + '</li>';
  }).join('') + '</ul>';

  var dica3 = ES.varsDoModelo(k).length + ' dados', dica4 = d ? (d.itens || []).length + ' blocos' : 'texto corrido';
  var dica5 = d ? (travas ? travas + ' para resolver' : testado ? 'tudo certo' : 'falta o teste') : '—';
  box.innerHTML = topo +
    secao('obj', 'Objetivo e envio', m.automatico ? 'sai sozinho' : 'você envia', s1) +
    secao('para', 'Para quem', m.quem_recebe || 'Todos', s2) +
    secao('ctx', 'Contexto da pessoa', dica3, s3) +
    secao('texto', 'Texto', dica4, s4) +
    secao('pronto', 'Pronto para usar?', dica5, s5) +
    secao('versoes', 'Versões', vs.length + (vs.length === 1 ? ' versão' : ' versões'), s6);
}

// ---------- A prévia ----------
function pessoasDaPrevia() {
  var q = ST.q.trim().toLowerCase();
  var l = C.filter(function (c) { return !q || (displayName(c) + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
  return l.slice(0, 200);
}
function renderPrevia() {
  var box = $('st-prev');
  var m = M ? modeloAtual() : null, k = ST.k;
  var lista = pessoasDaPrevia();
  var c = C.filter(function (x) { return x.id === ST.who; })[0] || lista[0] || C[0];
  if (c) ST.who = c.id;
  var barra = '<div class="st-bar"><label class="st-fld" style="flex:1 1 220px"><span>Prévia para</span><input class="st-in" id="st-q" type="search" placeholder="Buscar pelo nome ou e-mail" value="' + esc(ST.q) + '">' +
    '<select class="st-in" id="st-who" aria-label="Pessoa da prévia">' + (lista.some(function (x) { return c && x.id === c.id; }) || !c ? '' : '<option value="' + esc(c.id) + '" selected>' + esc(displayName(c)) + '</option>') +
    lista.map(function (x) { return '<option value="' + esc(x.id) + '"' + (c && x.id === c.id ? ' selected' : '') + '>' + esc(displayName(x)) + ' · ' + esc(personaLabel(x)) + '</option>'; }).join('') + '</select></label>' +
    '<div class="seg" role="group" aria-label="Aparelho"><button type="button" data-stdev="pc" aria-pressed="' + (ST.dev === 'pc') + '">Computador</button><button type="button" data-stdev="cel" aria-pressed="' + (ST.dev === 'cel') + '">Celular</button></div>' +
    '<label class="st-check"><input type="checkbox" id="st-marcar"' + (ST.marcar ? ' checked' : '') + '> Destacar os dados dela</label></div>';
  if (!c) { box.innerHTML = barra + '<div class="empty">Sem contatos ainda para a prévia.</div>'; return; }
  if (!M) {
    var t = splitTpl(c, k);
    box.innerHTML = barra + '<div class="st-env"><b>' + esc(t.subject) + '</b></div><div class="mailbody">' + esc(t.body) + '</div>';
    return;
  }
  var v = textoDaPrevia();
  if (!v) { box.innerHTML = barra + '<div class="empty">Este modelo ainda não tem versão.</div>'; return; }
  var dados = dadosPara(k, c), avisos = [], erro = null, r = null;
  try { r = ES.montarComDados(v, dados, ST.marcar); } catch (e) { erro = e.message; }
  if (m && m.tipo === 'novidades' && !c.aceita_novidades) avisos.push(displayName(c) + ' não aceitou novidades: este e-mail não sai para essa pessoa.');
  if (k.indexOf('cf_') === 0 && origensDe(c).indexOf('guia-etudes-en-france-2027') < 0) avisos.push(displayName(c) + ' não pegou o guia Campus France: este e-mail não sai sozinho para ela.');
  // Dados usados no texto que ela não tem, e o que acontece (o plano B).
  var usados = [], tudo = [v.assunto, v.preheader, v.corpo_texto].join('\n'), re = /\{[#^/]?(\w+)\}/g, mm;
  while ((mm = re.exec(tudo))) if (usados.indexOf(mm[1]) < 0) usados.push(mm[1]);
  var d = ST.d && podeEditar(versaoAberta()) ? ST.d : (versaoAberta() || {}).blocos;
  var faltam = usados.filter(function (x) { return ES.CAT[x] && ES.CAT[x].t === 'texto' && (dados[x] == null || dados[x] === ''); });
  if (faltam.length) avisos.push('Sem ' + faltam.map(function (x) {
    var p = d && d.planos && Object.prototype.hasOwnProperty.call(d.planos, x) ? d.planos[x] : (d ? ES.CAT[x].plano : undefined);
    return ES.CAT[x].o + ' ({' + x + '}): ' + (p === undefined || p == null ? 'o trecho que depende dele some (ou entra o que foi escrito para quem não tem)' : p === '' ? 'fica vazio' : 'aparece "' + p + '"');
  }).join('; ') + '.');
  var dicas = [];
  if (usados.indexOf('link_checklist') >= 0) dicas.push('O link do checklist é privado: na prévia o botão não abre. No envio (e no teste) ele vem do banco.');
  if (usados.indexOf('botoes_cidade') >= 0) dicas.push('Os botões de cidade levam o link assinado dela, que só existe no envio. No teste, eles levam um link de teste.');
  if (r) { ST.vistos[ST.dKey] = ST.vistos[ST.dKey] || {}; ST.vistos[ST.dKey][c.id] = 1; }
  var html = r ? (r.html || textoParaHtml(r.texto)) : '';
  box.innerHTML = barra +
    (erro ? '<div class="st-alert no">O texto tem um erro: ' + esc(erro) + '. Nada sai com ele: os automáticos usariam o texto de reserva.</div>' : '') +
    (avisos.length ? '<div class="st-alert">' + avisos.map(esc).join('<br>') + '</div>' : (r ? '<div class="st-alert ok"><b>Pronto para ' + esc(displayName(c)) + '.</b> Todos os dados que o texto usa existem.</div>' : '')) +
    (dicas.length ? '<p class="st-msg tip">' + dicas.map(esc).join(' ') + '</p>' : '') +
    (r ? '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="st-env"><span class="sub">Ingryd · Por Dentro</span><b>' + esc(r.assunto) + '</b>' + (r.pre ? '<span class="sub">' + esc(r.pre) + '</span>' : '') + '</div>' +
      '<iframe class="st-mail" sandbox="" title="Prévia do e-mail" srcdoc="' + esc(html) + '"></iframe></div>' +
      '<details class="tplvars"><summary>Ver o texto puro (o que sai para quem não abre HTML)</summary><div class="mailbody">' + esc(r.texto) + '</div></details>' : '') +
    (versaoAberta() && versaoAberta().etapa !== 'no_ar' ? '<p class="sub" style="margin-top:8px">Prévia da versão ' + ST.v + ' (' + esc(etapaTxt(versaoAberta()).toLowerCase()) + '). Ela só sai depois de publicada.</p>' : '');
}

// ---------- Editar, guardar, testar, publicar ----------
function setCampo(path, valor) {
  var p = path.split('.'), o = ST.d;
  for (var i = 0; i < p.length - 1; i++) { if (o[p[i]] == null) o[p[i]] = {}; o = o[p[i]]; }
  var ult = p[p.length - 1];
  if (valor === '' && p[0] !== 'planos') delete o[ult]; else o[ult] = valor;
}
function marcarSalvo(txt) { ST.salvo = txt; var el = $('st-salvo'); if (el) el.textContent = txt; }
function agendarSalvar() { clearTimeout(ST.timer); marcarSalvo('Guardando…'); ST.timer = setTimeout(salvar, 900); }
async function salvar() {
  clearTimeout(ST.timer); ST.timer = null;
  var v = versaoAberta(); if (!podeEditar(v) || !ST.d) return true;
  var mt = montarRascunho();
  if (!String(mt.assunto || '').trim() || !String(mt.corpo_texto || '').trim()) { marcarSalvo('Não guardado: falta o assunto ou o texto'); return false; }
  var linha = { blocos: ST.d, assunto: mt.assunto, preheader: mt.preheader, corpo_texto: mt.corpo_texto, corpo_html: mt.corpo_html };
  var mudou = ['assunto', 'preheader', 'corpo_texto', 'corpo_html'].some(function (f) { return (v[f] || null) !== (linha[f] || null); }) || JSON.stringify(v.blocos) !== JSON.stringify(ST.d);
  if (!mudou) { marcarSalvo('Guardado'); return true; }
  var r = await supabase.from('modelos_email_versoes').update(linha).eq('chave', v.chave).eq('versao', v.versao);
  if (r.error) { marcarSalvo('Não guardado'); fail('guardar o rascunho', r.error); return false; }
  Object.assign(v, linha, { blocos: JSON.parse(JSON.stringify(ST.d)), testado_em: null, testado_por: null });
  marcarSalvo('Guardado'); return true;
}
// Depois de mudar um campo: guarda e atualiza a prévia e a lista de conferências, sem redesenhar o editor (o cursor fica).
function aoEditar() {
  agendarSalvar();
  var v = versaoAberta(); if (v) { v.testado_em = null; }
  var pub = $('st-publicar'); if (pub) pub.disabled = true;   // mudou o texto: precisa de um teste novo
  renderPrevia();
  if (ST.sec === 'pronto' || ST.sec === 'texto') {
    var el = document.querySelector('.st-sec.is-open .st-rodape small');
    if (el && ST.d) el.textContent = ES.rodapeDe(ST.d, modeloAtual().tipo) || 'Sem rodapé (serviço sem motivo escrito).';
  }
}
async function recarregarModelos(manterVersao) {
  var r = await Promise.all([
    supabase.from('modelos_email').select('*').order('ordem', { ascending: true }),
    supabase.from('modelos_email_versoes').select('*').order('versao', { ascending: false })
  ]);
  if (r[0].error || r[1].error) return fail('carregar os modelos', r[0].error || r[1].error);
  M = r[0].data || []; MV = r[1].data || [];
  abrirModelo(ST.k, manterVersao || null);
  renderModelos();
}
async function novaVersao() {
  var k = ST.k;
  var r = await supabase.rpc('modelo_email_nova_versao', { p_chave: k });
  if (r.error) return fail('criar a versão nova', r.error);
  var nova = r.data;
  await recarregarModelos(nova);
  var v = versaoAberta();
  if (v && !v.blocos) {
    ST.d = ES.iniciais(k); await salvarForcado();
    toast('Versão ' + nova + ' criada. Montei os blocos a partir do texto de hoje: confira na prévia.', 4200);
  } else toast('Versão ' + nova + ' criada (rascunho)');
  ST.sec = 'texto'; renderModelos();
}
async function salvarForcado() { var v = versaoAberta(); if (v) v.blocos = v.blocos || {}; await salvar(); }
async function enviarTeste(btn) {
  var c = byC(ST.who);
  if (!c) return toast('Escolha a pessoa da prévia');
  if (!(await salvar())) return;
  var v = versaoAberta();
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) return toast('Sessão expirada. Recarregue a página e entre de novo.');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    // Nos automáticos o Worker lê os dados do banco (com o link privado); nos manuais vão os que o painel preenche.
    var dados = (modeloAtual() || {}).automatico ? {} : dadosPara(ST.k, c), vars = {};
    Object.keys(dados).forEach(function (x) { if (typeof dados[x] !== 'object' || dados[x] == null) vars[x] = dados[x]; });
    var res = await fetch(WORKER_BASE + '/api/crm/modelo-teste', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ chave: ST.k, versao: v.versao, contato_id: c.id, vars: vars })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    toast('Teste enviado para ' + data.para + ', com os dados de ' + displayName(c), 4200);
    await recarregarModelos(v.versao);
  } catch (e) {
    toast('Não enviei o teste — ' + e.message, 5000);
    btn.disabled = false; btn.textContent = 'Enviar teste para mim';
  }
}
async function mandarRevisao() {
  if (!(await salvar())) return;
  var v = versaoAberta();
  var r = await supabase.from('modelos_email_versoes').update({ etapa: 'revisao' }).eq('chave', v.chave).eq('versao', v.versao);
  if (r.error) return fail('mandar para revisão', r.error);
  toast('Versão ' + v.versao + ' em revisão'); ST.sec = 'pronto';
  await recarregarModelos(v.versao);
}
async function publicar(versao, voltando) {
  if (!voltando && !(await salvar())) return;
  var m = modeloAtual(), atual = versaoAtual(ST.k);
  var msg = voltando ? 'Voltar para a versão ' + versao + '? Ela volta a sair' + (atual ? ' e a versão ' + atual.versao + ' fica guardada.' : '.')
    : 'Publicar a versão ' + versao + ' de "' + m.nome + '"? ' + (m.automatico ? 'O próximo e-mail já sai com este texto.' : 'A ficha passa a abrir com este texto.') + (atual && atual.etapa === 'no_ar' ? ' A versão ' + atual.versao + ' fica guardada.' : '');
  if (!window.confirm(msg)) return;
  var r = await supabase.rpc('publicar_modelo_email', { p_chave: ST.k, p_versao: versao });
  if (r.error) return fail('publicar', r.error);
  toast('Versão ' + versao + ' No ar', 3200);
  await recarregarModelos(versao);
}

// Baixa todos os modelos e todas as versões num arquivo só (JSON), com o texto e o HTML de cada versão.
function exportModelos() {
  if (!M) return toast('Rode db/crm-modelos-email.sql para exportar');
  var dados = {
    exportado_em: new Date().toISOString(),
    formato: 'Variáveis: {nome} troca pelo valor; {#x}…{/x} só aparece se x tiver valor; {^x}…{/x} só se não tiver. blocos = como o estúdio edita.',
    modelos: M.map(function (m) {
      return Object.assign({}, m, { versoes: versoesDe(m.chave).map(function (v) {
        return Object.assign({}, v, { corpo_html: v.corpo_html || textoParaHtml(v.corpo_texto), html_gerado_do_texto: !v.corpo_html });
      }) });
    })
  };
  var blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'modelos-email-por-dentro-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  toast(M.length + ' modelos exportados');
}
function openCompose(cid, key) {
  var c = byC(cid); if (!c) return;
  activeCid = cid;
  var k = key || defaultTpl(c), t = textoDoModelo(c, k);
  var bloqueado = EXIGEM_NOVIDADES[k] && !c.aceita_novidades;
  modalOpen(modalTop(c) +
    '<div class="ctx" style="margin-top:12px"><div class="sel"><select id="compose-tpl" aria-label="Modelo">' + TPL_ORDER.map(function (m) { return '<option value="' + m + '"' + (m === k ? ' selected' : '') + '>' + esc(TPLS[m].label) + '</option>'; }).join('') + '</select></div><span class="lever" style="display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--brown);background:var(--brown-soft);padding:2px 8px;border-radius:999px">' + esc(TPLS[k].lever) + '</span></div>' +
    (bloqueado ? '<p class="sub" style="color:var(--red);margin:8px 0 0">Essa pessoa não aceitou novidades por e-mail — este modelo não pode ser enviado a ela.</p>' : '') +
    '<div class="reply" style="margin-top:14px"><label for="compose-subj">Assunto</label><input id="compose-subj" maxlength="200" style="height:38px;border:1px solid var(--line-2);border-radius:var(--r);padding:0 10px;background:var(--surface-2)" value="' + esc(t.subject) + '">' +
    '<label for="compose-txt">Mensagem — edite antes de enviar</label><textarea id="compose-txt" style="min-height:210px">' + esc(t.body) + '</textarea>' +
    '<p class="sub" id="compose-err" style="margin:0;color:var(--red)" role="alert" hidden></p></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="compose-send" data-tpl="' + k + '" data-versao="' + (t.versao || '') + '"' + (bloqueado ? ' disabled' : '') + '>Enviar e-mail</button></div>');
}
async function sendEmail(btn) {
  var err = $('compose-err'); err.hidden = true;
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { err.textContent = 'Sessão expirada. Recarregue a página e entre de novo.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ contato_id: activeCid, modelo: btn.dataset.tpl, assunto: $('compose-subj').value.trim(), corpo: $('compose-txt').value.trim(),
        modelo_versao: btn.dataset.versao ? Number(btn.dataset.versao) : null })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    closeCompose(); await reload();
    if (state.view === 'pessoa') renderPessoa(); else if (state.view === 'reimpacto') renderReimpacto();
    toast(data.aviso || 'E-mail enviado');
  } catch (e) {
    err.textContent = e.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Enviar e-mail';
  }
}

function open1a1(cid) {
  var c = byC(cid); activeCid = cid;
  modalOpen(modalTop(c) + '<div class="reply" style="margin-top:14px"><label for="modal-date">Data e horário do 1:1</label><input id="modal-date" type="datetime-local"></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="um1a1-send">Confirmar 1:1</button></div>');
}

function show(view) {
  state.view = view;
  document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== view; });
  document.querySelectorAll('.nav').forEach(function (n) { if (n.dataset.view === view) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
  if (view === 'hoje') renderToday();
  if (view === 'contatos') renderContacts();
  if (view === 'funil') renderBoard();
  if (view === 'perguntas') renderQuestions();
  if (view === 'reimpacto') renderReimpacto();
  if (view === 'modelos') renderModelos();
  if (view === 'pessoa') renderPessoa();
  window.scrollTo({ top: 0 });
}

function csv(rows) {
  var head = ['nome', 'email', 'persona', 'subpersona', 'urgencia', 'estagio', 'origem', 'origens', 'capturas', 'dias_sem_sinal', 'aceita_novidades', 'data_entrada', 'prazo_limite', 'dias_para_prazo', 'utm_source', 'utm_campaign', 'utm_content', 'instagram', 'ig_id'];
  // Neutraliza fórmulas (=,+,-,@) pra a planilha não executar texto vindo do formulário público.
  var cell = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return [head.join(',')].concat(rows.map(function (c) {
    return [c.nome, c.email, personaLabel(c), subLabel(c), c.urgencia, c.estagio, c.origem, origensDe(c).join(' | '), nCapturas(c), c.dias, c.aceita_novidades ? 'sim' : 'não', c.data_entrada, c.prazo_limite, c.dias_para_prazo, c.utm_source, c.utm_campaign, c.utm_content, c.instagram, c.ig_id].map(cell).join(',');
  })).join('\n');
}

// ---------- Eventos ----------
document.addEventListener('click', async function (e) {
  if (e.target.id === 'compose-backdrop') return closeCompose();
  var t = e.target.closest('button, tr[data-id]'); if (!t) return;
  if (t.matches('.nav')) return show(t.dataset.view);
  if (t.dataset.go) { if (t.dataset.viewPreset) applyPreset(t.dataset.viewPreset); return show(t.dataset.go); }
  if (t.dataset.preset) return applyPreset(t.dataset.preset);
  if (t.dataset.guia) { applyPreset('todos'); state.orig = t.dataset.guia; syncControls(); return show('contatos'); }
  if (t.dataset.clear) {
    if (t.dataset.clear === 'all') return applyPreset('todos');
    state[t.dataset.clear] = ''; if (t.dataset.clear === 'persona') state.sub = ''; state.preset = '';
    syncControls(); return renderContacts();
  }
  if (t.matches('tr[data-id]')) return openPessoa(t.dataset.id);
  if (t.dataset.open) return openPessoa(t.dataset.open);
  if (t.dataset.openconv) return openPessoa(t.dataset.openconv, 'conversa');
  if (t.dataset.ptab) { state.ptab = t.dataset.ptab; return renderPessoa(); }
  if (t.id === 'conv-send') return sendResposta(t);
  if (t.dataset.avisado) {
    t.disabled = true;
    var up = await supabase.from('lembretes_prazo').update({ status: 'avisado', avisado_em: new Date().toISOString() }).eq('id', t.dataset.avisado);
    if (up.error) { t.disabled = false; return fail('marcar o lembrete', up.error); }
    L = L.filter(function (l) { return String(l.id) !== String(t.dataset.avisado); });
    renderLembretes(); return toast('Lembrete marcado como avisado');
  }
  if (t.dataset.back !== undefined) return show(state.prevView || 'contatos');
  if (t.dataset.openq) { var qq = Q.filter(function (y) { return String(y.id) === t.dataset.openq; })[0]; if (!qq) return; state.inbox = 'perguntas'; state.qs = qq.status; state.qsel = qq.id; return show('perguntas'); }
  if (t.dataset.openr) { var rr = R.filter(function (y) { return String(y.id) === t.dataset.openr; })[0]; if (!rr) return; state.inbox = 'emails'; state.rs = rr.status; state.rsel = rr.id; return show('perguntas'); }
  if (t.dataset.inbox) { state.inbox = t.dataset.inbox; return renderQuestions(); }
  if (t.dataset.qs) { state.qs = t.dataset.qs; state.qsel = null; return renderQuestions(); }
  if (t.dataset.q) { state.qsel = Number(t.dataset.q); return renderQuestions(); }
  if (t.dataset.rs) { state.rs = t.dataset.rs; state.rsel = null; return renderQuestions(); }
  if (t.dataset.r) { state.rsel = Number(t.dataset.r); return renderQuestions(); }
  if (t.dataset.rstatus) {
    var novo = t.dataset.rstatus, rid = state.rsel;
    t.disabled = true;
    var ru = await supabase.from('respostas_email').update({ status: novo, respondida_em: novo === 'respondida' ? new Date().toISOString() : null }).eq('id', rid);
    if (ru.error) { t.disabled = false; return fail('mudar a resposta', ru.error); }
    await reload(); renderQuestions();
    return toast(novo === 'respondida' ? 'Resposta marcada como respondida' : novo === 'arquivada' ? 'Resposta arquivada' : 'Resposta de volta em Novas');
  }
  if (t.dataset.seg) { state.seg = state.seg === t.dataset.seg ? '' : t.dataset.seg; return renderReimpacto(); }
  if (t.dataset.mailtoggle) { var mb = $('mb-' + t.dataset.mailtoggle); mb.hidden = !mb.hidden; return; }
  if (t.dataset.opensinal) return openSinal(t.dataset.opensinal);
  if (t.dataset.open1a1) return open1a1(t.dataset.open1a1);
  if (t.dataset.sinalpick) { $('compose-txt').value = SINAIS[+t.dataset.sinalpick].body(byC(activeCid)); return; }
  if (t.id === 'modal-cancel') return closeCompose();
  if (t.dataset.emailfor) return openCompose(t.dataset.emailfor, t.dataset.tplk);
  if (t.dataset.tplPick) { await salvar(); abrirModelo(t.dataset.tplPick); ST.blk = null; ST.tab = 'editar'; return renderModelos(); }
  if (t.dataset.stsec) { ST.sec = ST.sec === t.dataset.stsec ? '' : t.dataset.stsec; return renderEditor(); }
  if (t.dataset.blkopen !== undefined) { ST.blk = ST.blk === Number(t.dataset.blkopen) ? null : Number(t.dataset.blkopen); return renderEditor(); }
  if (t.dataset.bmove) {
    var mv = t.dataset.bmove.split(':'), bi = Number(mv[0]), bj = bi + Number(mv[1]), its = ST.d.itens;
    if (bj < 0 || bj >= its.length) return;
    var tmp = its[bi]; its[bi] = its[bj]; its[bj] = tmp; if (ST.blk === bi) ST.blk = bj; else if (ST.blk === bj) ST.blk = bi;
    aoEditar(); return renderEditor();
  }
  if (t.dataset.bdel !== undefined) {
    var bd = Number(t.dataset.bdel), nomeB = (ES.TIPOS[ST.d.itens[bd].tipo] || {}).nome || 'bloco';
    if (!window.confirm('Tirar o bloco "' + nomeB + '"?')) return;
    ST.d.itens.splice(bd, 1); ST.blk = null; aoEditar(); return renderEditor();
  }
  if (t.dataset.insvar) {
    var alvo = ST.foco && document.body.contains(ST.foco) ? ST.foco : null;
    if (!alvo) return toast('Clique antes no campo onde o dado entra');
    var ini0 = alvo.selectionStart == null ? alvo.value.length : alvo.selectionStart, fim0 = alvo.selectionEnd == null ? ini0 : alvo.selectionEnd, ins = '{' + t.dataset.insvar + '}';
    alvo.value = alvo.value.slice(0, ini0) + ins + alvo.value.slice(fim0); alvo.focus(); alvo.selectionStart = alvo.selectionEnd = ini0 + ins.length;
    setCampo(alvo.dataset.f, alvo.value); return aoEditar();
  }
  if (t.dataset.stdev) { ST.dev = t.dataset.stdev; return renderPrevia(); }
  if (t.dataset.sttab) { ST.tab = t.dataset.sttab; return renderModelos(); }
  if (t.dataset.stver) { await salvar(); abrirModelo(ST.k, Number(t.dataset.stver)); ST.blk = null; return renderModelos(); }
  if (t.dataset.stvoltar) return publicar(Number(t.dataset.stvoltar), true);
  if (t.id === 'st-teste') return enviarTeste(t);
  if (t.id === 'st-revisao') return mandarRevisao();
  if (t.id === 'st-publicar') return publicar(ST.v, false);
  if (t.id === 'st-nova') { t.disabled = true; return novaVersao(); }
  if (t.id === 'compose-send') return sendEmail(t);

  if (t.id === 'send-reply') {
    var txt = $('reply-txt').value.trim();
    if (!txt) { $('reply-err').hidden = false; return; }
    t.disabled = true;
    var r = await supabase.from('perguntas_unicas').update({ status: 'respondida', resposta: txt, respondida_em: new Date().toISOString() }).eq('id', state.qsel);
    if (r.error) { t.disabled = false; return fail('salvar a resposta', r.error); }
    await reload(); renderQuestions(); return toast('Pergunta marcada como respondida');
  }
  if (t.id === 'sinal-send') {
    var msg = $('compose-txt').value.trim(); if (!msg) return;
    t.disabled = true;
    var s = await supabase.from('sinais').insert({ contato_id: activeCid, mensagem: msg });
    if (s.error) { t.disabled = false; return fail('enviar o sinal', s.error); }
    closeCompose(); if (state.view === 'pessoa') renderPessoa();
    return toast('Sinal enviado ao dashboard da pessoa');
  }
  if (t.id === 'um1a1-send') {
    var dv = $('modal-date').value;
    t.disabled = true;
    var o = await supabase.from('um_a_um').insert({ contato_id: activeCid, quando: dv ? new Date(dv).toISOString() : null });
    if (o.error) { t.disabled = false; return fail('marcar o 1:1', o.error); }
    closeCompose(); await reload(); if (state.view === 'pessoa') renderPessoa();
    return toast('1:1 confirmado');
  }
  if (t.id === 'mod-export') return exportModelos();
  if (t.id === 'export') {
    var blob = new Blob(['﻿' + csv(filtered())], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contatos-por-dentro.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return toast('Lista exportada');
  }
});
document.addEventListener('change', async function (e) {
  if (e.target.id === 'compose-tpl') return openCompose(activeCid, e.target.value);
  if (e.target.id === 'st-who') { ST.who = e.target.value; return renderPrevia(); }
  if (e.target.id === 'st-marcar') { ST.marcar = e.target.checked; return renderPrevia(); }
  if (e.target.id === 'st-novo-bloco') {
    if (!e.target.value || !ST.d) return;
    ST.d.itens = ST.d.itens || []; ST.d.itens.push(ES.novoBloco(e.target.value)); ST.blk = ST.d.itens.length - 1;
    aoEditar(); return renderEditor();
  }
  if (e.target.dataset && e.target.dataset.plano) {
    var pk = e.target.dataset.plano; ST.d.planos = ST.d.planos || {};
    ST.d.planos[pk] = e.target.value === 'some' ? null : ((ES.CAT[pk] && ES.CAT[pk].plano) || '');
    aoEditar(); return renderEditor();
  }
  if (e.target.matches && e.target.matches('select[data-f]')) { setCampo(e.target.dataset.f, e.target.value); aoEditar(); return renderEditor(); }
  if (e.target.id === 'st-objetivo') {
    var ob = e.target.value.trim(), mo = modeloAtual();
    if (!mo || !ob || ob === mo.objetivo) return;
    var ru = await supabase.from('modelos_email').update({ objetivo: ob }).eq('chave', mo.chave);
    if (ru.error) return fail('salvar o objetivo', ru.error);
    mo.objetivo = ob; return toast('Objetivo salvo');
  }
  if (e.target.id !== 'stage-pick') return;
  var c = byC(state.sel), novo = e.target.value;
  var r = await supabase.from('contatos').update({ estagio: novo }).eq('id', c.id);
  if (r.error) { e.target.value = c.estagio; return fail('mudar o estágio', r.error); }
  await reload(); renderPessoa(); toast('Estágio: ' + stageLabel(novo));
});
// Instagram da ficha: salva ao sair do campo. O @ vira minúsculo, sem arroba nem endereço.
document.addEventListener('focusout', async function (e) {
  var campo = e.target.dataset && e.target.dataset.ig;
  if (!campo) return;
  var c = byC(e.target.dataset.cid), v = e.target.value.trim();
  if (!c) return;
  if (campo === 'instagram') {
    v = v.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '').toLowerCase();
    if (v && !/^[a-z0-9._]{1,30}$/.test(v)) return toast('@ inválido: use só letras, números, ponto e sublinhado');
  } else if (v && !/^[A-Za-z0-9_.-]{1,60}$/.test(v)) {
    return toast('ID inválido: use só letras, números, ponto, hífen e sublinhado');
  }
  e.target.value = v;
  if (v === (c[campo] || '')) return;
  var patch = {}; patch[campo] = v || null;
  var r = await supabase.from('contatos').update(patch).eq('id', c.id);
  if (r.error) return fail('salvar o Instagram', r.error);
  c[campo] = v || null; toast('Instagram salvo');
});
document.addEventListener('focusout', async function (e) {
  if (!e.target.dataset || !e.target.dataset.nota) return;
  var c = byC(e.target.dataset.nota), v = e.target.value.trim();
  if (!c || v === (c.nota || '')) return;
  var r = await supabase.from('contatos').update({ nota: v || null }).eq('id', c.id);
  if (r.error) return fail('salvar a anotação', r.error);
  c.nota = v || null; toast('Anotação salva');
});
// Estúdio: campos de texto dos blocos (data-f = o caminho dentro de blocos) e a busca da pessoa da prévia.
document.addEventListener('input', function (e) {
  if (e.target.matches && e.target.matches('input[data-f], textarea[data-f]') && ST.d) { setCampo(e.target.dataset.f, e.target.value); return aoEditar(); }
  if (e.target.id === 'st-q') {
    ST.q = e.target.value; var pos = e.target.selectionStart; renderPrevia();
    var q2 = $('st-q'); if (q2) { q2.focus(); q2.selectionStart = q2.selectionEnd = pos; }
  }
});
document.addEventListener('focusin', function (e) { if (e.target.dataset && e.target.dataset.f && e.target.matches('input, textarea')) ST.foco = e.target; });
document.addEventListener('input', function (e) {
  if (e.target.id === 'reply-txt') $('reply-err').hidden = true;
  if (e.target.id === 'conv-txt') { state.rascunho[e.target.dataset.cid] = e.target.value; $('conv-err').hidden = true; }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('tr[data-id]')) openPessoa(e.target.dataset.id);
  if (e.key === 'Escape' && !$('compose-modal').hidden) closeCompose();
});

boot().catch(function (err) { console.error(err); showGate('Erro ao abrir o CRM. Recarregue a página.'); });
