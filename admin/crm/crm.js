// Painel do CRM — lê e escreve no Supabase como a admin logada (RLS: tabela `admins`).
// Nada de service_role aqui. O banco é db/crm-fase2.sql; o desenho é o artefato "CRM Por Dentro".
// Tudo que vem do banco é texto de terceiros (nome, e-mail, pergunta): passa sempre por esc().
import { supabase } from '/assets/js/supabase-client.js';

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

var C = [], Q = [], L = [], R = [], RM = {}, SUBS = {};
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
    supabase.from('respostas_email').select('*').order('recebido_em', { ascending: true }).limit(2000)
  ]);
  if (r[0].error) return fail('carregar os contatos', r[0].error);
  C = r[0].data || [];
  Q = r[1].error ? [] : (r[1].data || []);
  L = r[3] && !r[3].error ? (r[3].data || []) : [];
  R = r[4] && !r[4].error ? (r[4].data || []) : [];
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

function renderModelos() {
  var c = C.filter(function (x) { return x.id === state.mdContact; })[0] || C[0];
  state.tplKey = state.tplKey || 'boas_vindas';
  $('mod-contact').innerHTML = C.map(function (x) { return '<option value="' + esc(x.id) + '"' + (c && x.id === c.id ? ' selected' : '') + '>' + esc(displayName(x)) + '</option>'; }).join('');
  $('mod-list').innerHTML = TPL_ORDER.map(function (k) {
    var t = TPLS[k];
    return '<button class="tplcard" data-tpl-pick="' + k + '" aria-pressed="' + (state.tplKey === k) + '" type="button"><b>' + esc(t.label) + '</b><span>' + esc(t.when) + '</span>' +
      '<span class="vartag">' + esc(t.lever) + '</span>' + (EXIGEM_NOVIDADES[k] ? '<span class="vartag" style="background:var(--brown-soft);color:var(--brown)">só p/ quem aceitou novidades</span>' : '') + '</button>';
  }).join('');
  if (!c) { $('mod-preview').innerHTML = '<div class="empty">Sem contatos ainda.</div>'; return; }
  var t = splitTpl(c, state.tplKey);
  $('mod-preview').innerHTML = '<p class="previewsubj">' + esc(t.subject) + '</p><div class="mailbody">' + esc(t.body) + '</div>' +
    '<div class="actions"><button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '" data-tplk="' + state.tplKey + '">Escrever este e-mail →</button></div>' +
    '<p class="sub" style="margin-top:8px">Preenchido sozinho com o nome, a persona (' + esc(personaLabel(c)) + ')' + (state.tplKey === 'parouapp' && c.motivo ? ' e o motivo (' + esc(c.motivo) + ')' : '') + '. Você edita antes de enviar.</p>';
}
function openCompose(cid, key) {
  var c = byC(cid); if (!c) return;
  activeCid = cid;
  var k = key || defaultTpl(c), t = splitTpl(c, k);
  var bloqueado = EXIGEM_NOVIDADES[k] && !c.aceita_novidades;
  modalOpen(modalTop(c) +
    '<div class="ctx" style="margin-top:12px"><div class="sel"><select id="compose-tpl" aria-label="Modelo">' + TPL_ORDER.map(function (m) { return '<option value="' + m + '"' + (m === k ? ' selected' : '') + '>' + esc(TPLS[m].label) + '</option>'; }).join('') + '</select></div><span class="lever" style="display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--brown);background:var(--brown-soft);padding:2px 8px;border-radius:999px">' + esc(TPLS[k].lever) + '</span></div>' +
    (bloqueado ? '<p class="sub" style="color:var(--red);margin:8px 0 0">Essa pessoa não aceitou novidades por e-mail — este modelo não pode ser enviado a ela.</p>' : '') +
    '<div class="reply" style="margin-top:14px"><label for="compose-subj">Assunto</label><input id="compose-subj" maxlength="200" style="height:38px;border:1px solid var(--line-2);border-radius:var(--r);padding:0 10px;background:var(--surface-2)" value="' + esc(t.subject) + '">' +
    '<label for="compose-txt">Mensagem — edite antes de enviar</label><textarea id="compose-txt" style="min-height:210px">' + esc(t.body) + '</textarea>' +
    '<p class="sub" id="compose-err" style="margin:0;color:var(--red)" role="alert" hidden></p></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="compose-send" data-tpl="' + k + '"' + (bloqueado ? ' disabled' : '') + '>Enviar e-mail</button></div>');
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
      body: JSON.stringify({ contato_id: activeCid, modelo: btn.dataset.tpl, assunto: $('compose-subj').value.trim(), corpo: $('compose-txt').value.trim() })
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
  if (t.dataset.tplPick) { state.tplKey = t.dataset.tplPick; return renderModelos(); }
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
  if (t.id === 'export') {
    var blob = new Blob(['﻿' + csv(filtered())], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contatos-por-dentro.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return toast('Lista exportada');
  }
});
document.addEventListener('change', async function (e) {
  if (e.target.id === 'compose-tpl') return openCompose(activeCid, e.target.value);
  if (e.target.id === 'mod-contact') { state.mdContact = e.target.value; return renderModelos(); }
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
document.addEventListener('input', function (e) {
  if (e.target.id === 'reply-txt') $('reply-err').hidden = true;
  if (e.target.id === 'conv-txt') { state.rascunho[e.target.dataset.cid] = e.target.value; $('conv-err').hidden = true; }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('tr[data-id]')) openPessoa(e.target.dataset.id);
  if (e.key === 'Escape' && !$('compose-modal').hidden) closeCompose();
});

boot().catch(function (err) { console.error(err); showGate('Erro ao abrir o CRM. Recarregue a página.'); });
