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
var ORIG = { instagram: 'Instagram', bot: 'Assistente de vistos', blog: 'Blog', direto: 'Direto', artigo: 'Artigo', login_direto: 'Login direto' };
var SEGMENTS = [
  { k: 'naoabriu', t: 'Não abriu o e-mail', lever: 'Gatilho ausente', why: 'O e-mail chegou mas nunca foi aberto — sem gatilho, nada acontece. Ação: reenviar com outro assunto, ou checar se caiu no spam.' },
  { k: 'naoclicou', t: 'Abriu mas não clicou', lever: 'Falta motivação/prova', why: 'Leu e não sentiu motivo pra agir. Ação: prova social (quem já passou pelo mesmo) e botão mais simples.' },
  { k: 'cliquenaoapp', t: 'Clicou mas não abriu o app', lever: 'Fricção de capacidade', why: 'Clicou no link mas travou antes de entrar. Ação: lembrar que o acesso é sem senha, um clique só.' },
  { k: 'parouapp', t: 'Abriu o app mas parou', lever: 'Motivação caiu', why: 'Entrou, viu o checklist e não voltou. Ação: uma dica extra de graça + o prazo real dela, nunca um prazo inventado.' }
];
var MAIL_ST = { clicado: 'Clicou', aberto: 'Abriu', entregue: 'Entregue, não abriu', nao_entregue: 'Não entregue', agendado: 'Ainda não enviado' };
var MODELO = { boas_vindas: 'Boas-vindas + link de acesso', naoabriu: 'Reimpacto — não abriu', naoclicou: 'Reimpacto — abriu, não clicou', cliquenaoapp: 'Reimpacto — clicou, não abriu o app', parouapp: 'Reimpacto — abriu o app e parou' };
var TYPE_META = {
  sistema: ['Sistema', ''], app: ['Abriu o app', 'u-baixa'], checklist: ['Checklist', 'u-baixa'], pergunta: ['Pergunta única', 'tp-pergunta'],
  artigo: ['Artigo', 'tp-artigo'], uma_um: ['1:1', 'out'], email: ['E-mail', 'out'], sinal: ['Sinal no dashboard', 'out']
};

var WORKER_BASE = 'https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev';
// Link que vai nos e-mails ("[link do acesso]"). Se ficar vazio, o trecho fica entre colchetes e o
// Worker RECUSA o envio — de propósito, pra nunca sair e-mail com placeholder.
var APP_LINK = 'https://plataforma.imigrantepordentro.com/';
var EXIGEM_NOVIDADES = { naoclicou: 1, parouapp: 1, guia_chamada: 1, guia_plataforma: 1 };   // igual ao Worker (CRM_MODELOS_EXIGEM_NOVIDADES)
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
var TPL_ORDER = ['boas_vindas', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp', 'guia_chamada', 'guia_plataforma'];
function defaultTpl(c) { return c.segmento || (c.origem === 'guia-vls-ts' ? 'guia_chamada' : 'boas_vindas'); }
function splitTpl(c, k) { var t = TPLS[k].make(c); return { subject: t[0].replace(/^Assunto: /, ''), body: t[1] }; }

var C = [], Q = [], L = [], SUBS = {};
var state = { view: 'hoje', persona: '', sub: '', urg: '', stage: '', orig: '', q: '', sel: null, qs: 'nova', qsel: null, preset: 'todos', seg: '', prevView: 'contatos' };
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
function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600); }
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
    supabase.from('lembretes_prazo').select('*').eq('status', 'agendado').order('avisar_em', { ascending: true }).limit(500)
  ]);
  if (r[0].error) return fail('carregar os contatos', r[0].error);
  C = r[0].data || [];
  Q = r[1].error ? [] : (r[1].data || []);
  L = r[3] && !r[3].error ? (r[3].data || []) : [];
  SUBS = {};
  (r[2].data || []).forEach(function (o) { SUBS[o.persona + '|' + o.chave] = o.rotulo; });
}
async function reload() { await loadAll(); renderToday(); renderReimpacto(); }

// ---------- Filtros ----------
function fillSelect(el, first, map) {
  var html = '<option value="">' + esc(first) + '</option>';
  Object.keys(map).forEach(function (k) { html += '<option value="' + esc(k) + '">' + esc(map[k]) + '</option>'; });
  el.innerHTML = html;
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
  $('f-urg').value = state.urg; $('f-stage').value = state.stage; $('f-orig').value = state.orig; $('q').value = state.q;
  ['f-persona', 'f-sub', 'f-urg', 'f-stage', 'f-orig'].forEach(function (id) { $(id).classList.toggle('on', !!$(id).value); });
  document.querySelectorAll('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)); });
}
function initControls() {
  fillSelect($('f-persona'), 'Toda persona', PERSONAS);
  fillSelect($('f-urg'), 'Toda urgência', URG);
  var stMap = {}; STAGES.forEach(function (s) { stMap[s.k] = s.l; });
  fillSelect($('f-stage'), 'Todo estágio', stMap);
  var origs = {}; Object.keys(ORIG).forEach(function (k) { origs[k] = ORIG[k]; });
  C.forEach(function (c) { if (c.origem && !origs[c.origem]) origs[c.origem] = c.origem; });
  fillSelect($('f-orig'), 'Toda origem', origs);
  fillSelect($('funil-persona'), 'Toda persona', PERSONAS);
  syncControls();
  [['f-persona', 'persona'], ['f-sub', 'sub'], ['f-urg', 'urg'], ['f-stage', 'stage'], ['f-orig', 'orig']].forEach(function (p) {
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
    if (state.orig && c.origem !== state.orig) return false;
    if (state.preset === 'parados' && !(c.dias >= 7 && c.estagio !== 'concluido')) return false;
    if (state.preset === 'prazo' && !(c.dias_para_prazo != null && c.dias_para_prazo <= 30 && c.dias_para_prazo >= -90 && c.estagio !== 'concluido')) return false;
    if (state.preset === 'aupair' && !(c.persona === 'au_pair_estudante' && c.respostas && c.respostas.apCertificado === 'nao')) return false;
    if (q && ((c.nome || '') + ' ' + c.email).toLowerCase().indexOf(q) === -1) return false;
    return true;
  }).sort(function (a, b) { var o = { alta: 0, media: 1, baixa: 2 }; return o[a.urgencia] - o[b.urgencia] || prazoKey(a) - prazoKey(b) || a.dias - b.dias; });
}
function applyPreset(p) {
  state.preset = p; state.persona = ''; state.sub = ''; state.urg = ''; state.stage = ''; state.orig = ''; state.q = '';
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
  $('today-q').innerHTML = nq.slice(0, 5).map(function (x) {
    var c = byC(x.contato_id); if (!c) return '';
    var h = hrsSince(x.criado_em);
    return '<button class="row" data-openq="' + x.id + '" type="button"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) + '</b><span>' + esc(x.texto) + '</span></div><span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + hrs(h) + '</span></button>';
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
  $('k-perg').textContent = nq.length;
  var atrasadas = nq.filter(function (x) { return hrsSince(x.criado_em) >= 72; }).length;
  $('k-perg-sub').textContent = atrasadas ? atrasadas + ' passou de 72h' : 'nenhuma passou de 72h';
  $('k-urg').textContent = C.filter(function (c) { return c.urgencia === 'alta' && c.estagio !== 'concluido' && c.estagio !== 'inativo'; }).length;
  $('hello-sub').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + (att.length + nq.length) + ' coisas pedem você hoje';

  $('c-perguntas').textContent = nq.length; $('c-perguntas').hidden = nq.length === 0;
  $('c-contatos').textContent = C.length;

  var um = C.filter(function (c) { return c.estagio === 'um_a_um'; });
  $('today-1a1').innerHTML = um.map(function (c) {
    return '<button class="row" data-open="' + esc(c.id) + '" type="button"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) + '</b><span>' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></div><span class="when">' + esc(fmtWhen(c.um_a_um_quando)) + '</span></button>';
  }).join('') || '<div class="empty">Nenhum 1:1 marcado.</div>';
  renderLembretes();
}

// Card "Lembretes de prazo" do Hoje: quem pediu, na calculadora de um artigo, pra ser
// avisada antes de um prazo. Mostra primeiro o que já passou da data de avisar.
function fmtDay(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'; }
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
      '<td><div class="nm"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><b>' + esc(displayName(c)) + '</b><span>' + esc(c.email) + '</span></div></div></td>' +
      '<td><span class="persona">' + esc(personaLabel(c)) + '</span><div class="sub">' + esc(subLabel(c)) + '</div></td>' +
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

function renderQuestions() {
  var list = Q.filter(function (x) { return x.status === state.qs; }).sort(function (a, b) { return state.qs === 'nova' ? (a.criado_em < b.criado_em ? -1 : 1) : (a.respondida_em < b.respondida_em ? 1 : -1); });
  $('qn').textContent = Q.filter(function (x) { return x.status === 'nova'; }).length;
  $('qr').textContent = Q.filter(function (x) { return x.status === 'respondida'; }).length;
  document.querySelectorAll('.qtab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.qs === state.qs)); });
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
    email_capturado: ['sistema', 'Deixou o e-mail' + (d.origem ? ' (' + d.origem + ')' : '')],
    lembrete_pedido: ['artigo', 'Pediu lembrete do prazo de ' + fmtDay(d.prazo) + (d.artigo ? ' (' + d.artigo + ')' : '')],
    email_recapturado: ['sistema', 'Refez o quiz'],
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
    estagio_alterado: ['sistema', 'Estágio: ' + stageLabel(d.de) + ' → ' + stageLabel(d.para)]
  };
  return m[t] || ['sistema', t];
}
async function openPessoa(id) {
  if (state.view !== 'pessoa') state.prevView = state.view;
  state.sel = id;
  show('pessoa');
}
async function renderPessoa() {
  var c = byC(state.sel);
  if (!c) { $('pessoa-page').innerHTML = '<div class="empty">Pessoa não encontrada.</div>'; return; }
  $('pessoa-page').innerHTML = '<div class="loading">Carregando a ficha…</div>';
  var r = await Promise.all([
    supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(200),
    supabase.from('consentimentos').select('finalidade,aceito,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    supabase.from('emails_enviados').select('id,modelo,assunto,corpo,status,enviado_em,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false })
  ]);
  if (state.sel !== c.id || state.view !== 'pessoa') return;   // trocou de tela enquanto carregava
  var eventos = r[0].data || [], cons = r[1].data || [], mails = r[2].data || [];
  var last = function (f) { var x = cons.filter(function (k) { return k.finalidade === f; })[0]; return x ? x.aceito : false; };
  var perg = Q.filter(function (x) { return x.contato_id === c.id; });
  var resp = c.respostas || {};
  var kv = [['Entrada na França', fmtDay(c.data_entrada)], ['Prazo do VLS-TS', c.prazo_limite ? fmtDay(c.prazo_limite) + ' (' + prazoTxt(c) + ')' : '—'], ['Fase', c.fase || '—'], ['Nível de estudos', c.nivel_estudos || '—'], ['Preocupação', c.preocupacao || '—'], ['Origem', ORIG[c.origem] || c.origem || '—']]
    .concat(Object.keys(resp).map(function (k) { return [k, resp[k]]; }));
  var h4 = 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px';
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
    '<div class="pessoa-grid" style="margin-top:18px">' +
    '<div class="panel" style="padding:16px"><h3 style="font-size:15px; margin-bottom:8px">Tudo que ela fez</h3>' +
    '<p class="sub" style="margin:0 0 10px">Checklist, pergunta única, artigos e o resto do app — mais o que você mandou pra ela. Mais recente primeiro.</p>' +
    '<div class="feed">' + (eventos.map(function (e) {
      var tx = eventText(e), m = TYPE_META[tx[0]];
      return '<div class="feeditem"><span class="pill ' + m[1] + '">' + esc(m[0]) + '</span><div class="fbody"><p>' + esc(tx[1]) + '</p><time>' + esc(fmtDate(e.criado_em)) + '</time></div></div>';
    }).join('') || '<div class="empty">Nada registrado ainda.</div>') + '</div></div>' +
    '<div style="display:flex; flex-direction:column; gap:16px">' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">O que respondeu no funil</h4><dl class="kv">' + kv.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>' +
    (perg.length ? '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Perguntas únicas</h4>' + perg.map(function (x) { return '<p style="margin:0 0 6px;font-size:13px">"' + esc(x.texto) + '" <button class="link" data-openq="' + x.id + '" type="button">' + (x.status === 'nova' ? 'Responder' : 'Ver resposta') + ' →</button></p>'; }).join('') + '</div>' : '') +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">E-mails enviados</h4>' + (mails.map(function (m) {
      return '<div class="mailrow"><button class="mh" data-mailtoggle="' + m.id + '" type="button"><b>' + esc(MODELO[m.modelo] || m.modelo) + '</b><span class="pill st-' + esc(m.status) + '">' + esc(MAIL_ST[m.status] || m.status) + '</span><time>' + esc(fmtDate(m.enviado_em || m.criado_em)) + '</time></button><div class="mailbody" id="mb-' + m.id + '" hidden>' + esc(m.corpo || '(sem corpo salvo)') + '</div></div>';
    }).join('') || '<p class="sub" style="margin:0">Nenhum e-mail enviado por aqui ainda.</p>') + '</div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Consentimento</h4><div class="consent"><span class="pill ' + (last('servico') ? 'u-baixa' : '') + '">Política de privacidade ' + (last('servico') ? '✓' : '—') + '</span><span class="pill ' + (last('novidades_email') ? 'u-baixa' : '') + '">Novidades por e-mail ' + (last('novidades_email') ? '✓' : '—') + '</span></div></div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Suas anotações</h4><textarea class="notebox" id="nota" data-nota="' + esc(c.id) + '" placeholder="Só você vê. Ex.: prefere falar por e-mail, tem sponsor na família.">' + esc(c.nota || '') + '</textarea></div>' +
    '</div></div>';
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
  var head = ['nome', 'email', 'persona', 'subpersona', 'urgencia', 'estagio', 'origem', 'dias_sem_sinal', 'aceita_novidades', 'data_entrada', 'prazo_limite', 'dias_para_prazo'];
  // Neutraliza fórmulas (=,+,-,@) pra a planilha não executar texto vindo do formulário público.
  var cell = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return [head.join(',')].concat(rows.map(function (c) {
    return [c.nome, c.email, personaLabel(c), subLabel(c), c.urgencia, c.estagio, c.origem, c.dias, c.aceita_novidades ? 'sim' : 'não', c.data_entrada, c.prazo_limite, c.dias_para_prazo].map(cell).join(',');
  })).join('\n');
}

// ---------- Eventos ----------
document.addEventListener('click', async function (e) {
  if (e.target.id === 'compose-backdrop') return closeCompose();
  var t = e.target.closest('button, tr[data-id]'); if (!t) return;
  if (t.matches('.nav')) return show(t.dataset.view);
  if (t.dataset.go) { if (t.dataset.viewPreset) applyPreset(t.dataset.viewPreset); return show(t.dataset.go); }
  if (t.dataset.preset) return applyPreset(t.dataset.preset);
  if (t.dataset.clear) {
    if (t.dataset.clear === 'all') return applyPreset('todos');
    state[t.dataset.clear] = ''; if (t.dataset.clear === 'persona') state.sub = ''; state.preset = '';
    syncControls(); return renderContacts();
  }
  if (t.matches('tr[data-id]')) return openPessoa(t.dataset.id);
  if (t.dataset.open) return openPessoa(t.dataset.open);
  if (t.dataset.avisado) {
    t.disabled = true;
    var up = await supabase.from('lembretes_prazo').update({ status: 'avisado', avisado_em: new Date().toISOString() }).eq('id', t.dataset.avisado);
    if (up.error) { t.disabled = false; return fail('marcar o lembrete', up.error); }
    L = L.filter(function (l) { return String(l.id) !== String(t.dataset.avisado); });
    renderLembretes(); return toast('Lembrete marcado como avisado');
  }
  if (t.dataset.back !== undefined) return show(state.prevView || 'contatos');
  if (t.dataset.openq) { var qq = Q.filter(function (y) { return String(y.id) === t.dataset.openq; })[0]; if (!qq) return; state.qs = qq.status; state.qsel = qq.id; return show('perguntas'); }
  if (t.dataset.qs) { state.qs = t.dataset.qs; state.qsel = null; return renderQuestions(); }
  if (t.dataset.q) { state.qsel = Number(t.dataset.q); return renderQuestions(); }
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
document.addEventListener('focusout', async function (e) {
  if (!e.target.dataset || !e.target.dataset.nota) return;
  var c = byC(e.target.dataset.nota), v = e.target.value.trim();
  if (!c || v === (c.nota || '')) return;
  var r = await supabase.from('contatos').update({ nota: v || null }).eq('id', c.id);
  if (r.error) return fail('salvar a anotação', r.error);
  c.nota = v || null; toast('Anotação salva');
});
document.addEventListener('input', function (e) { if (e.target.id === 'reply-txt') $('reply-err').hidden = true; });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('tr[data-id]')) openPessoa(e.target.dataset.id);
  if (e.key === 'Escape' && !$('compose-modal').hidden) closeCompose();
});

boot().catch(function (err) { console.error(err); showGate('Erro ao abrir o CRM. Recarregue a página.'); });
