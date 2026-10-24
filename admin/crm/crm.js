// Painel do CRM — lê e escreve no Supabase como a admin logada (RLS: tabela `admins`).
// Nada de service_role aqui. O banco é db/crm-fase2.sql; o desenho é o artefato "CRM Por Dentro".
// Tudo que vem do banco é texto de terceiros (nome, e-mail, pergunta): passa sempre por esc().
import { supabase } from '/assets/js/supabase-client.js';
import * as ES from './estudio.js?v=2026-10-23.3';   // os blocos do estúdio de e-mails (entregas 2 e 3)

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
  'guia-vls-ts': 'Guia VLS-TS', 'guia-email-alt30': 'Guia alternância 30+', 'guia-etudes-en-france-2027': 'Guia Campus France',
  // Newsletter da bolsa Eiffel, no artigo de bolsas (o CRM guarda a origem como token; aqui volta a ser o endereço).
  'artigo-como-conseguir-bolsa-de-estudo': '/artigos/post/como-conseguir-bolsa-de-estudo/' };
function origLabel(o) { return ORIG[o] || o; }
// O nome de um modelo: os de antes têm rótulo fixo; os criados no estúdio, o nome que você deu.
function modeloNome(k) { var m = (M || []).filter(function (x) { return x.chave === k; })[0]; return MODELO[k] || (m && m.nome) || k; }
var SEGMENTS = [
  { k: 'naoabriu', t: 'Não abriu o e-mail', lever: 'Gatilho ausente', why: 'O e-mail chegou mas nunca foi aberto — sem gatilho, nada acontece. Ação: reenviar com outro assunto, ou checar se caiu no spam.' },
  { k: 'naoclicou', t: 'Abriu mas não clicou', lever: 'Falta motivação/prova', why: 'Leu e não sentiu motivo pra agir. Ação: prova social (quem já passou pelo mesmo) e botão mais simples.' },
  { k: 'cliquenaoapp', t: 'Clicou mas não abriu o app', lever: 'Fricção de capacidade', why: 'Clicou no link mas travou antes de entrar. Ação: lembrar que o acesso é sem senha, um clique só.' },
  { k: 'parouapp', t: 'Abriu o app mas parou', lever: 'Motivação caiu', why: 'Entrou, viu o checklist e não voltou. Ação: uma dica extra de graça + o prazo real dela, nunca um prazo inventado.' }
];
// 'agendado' = o Brevo aceitou o envio (a linha só é gravada depois disso) e ainda não avisou entrega/abertura pelo webhook.
var MAIL_ST = { clicado: 'Clicou', aberto: 'Abriu', entregue: 'Entregue, não abriu', nao_entregue: 'Não entregue', agendado: 'Enviado' };
var MAIL_ST_DICA = { agendado: 'O Brevo aceitou o envio. Entrega e abertura aparecem aqui quando o webhook do Brevo avisar.' };
var MODELO = { boas_vindas: 'Boas-vindas + link de acesso', guia_chamada: 'Guia VLS-TS — convite pra conversa', guia_plataforma: 'Guia VLS-TS — teste da plataforma',naoabriu: 'Reimpacto — não abriu', naoclicou: 'Reimpacto — abriu, não clicou', cliquenaoapp: 'Reimpacto — clicou, não abriu o app', parouapp: 'Reimpacto — abriu o app e parou', guia_alternancia: 'Guia alternância 30+ — convite pra conversa', cf_guia_1: 'Guia Campus France — e-mail 1 (checklist, automático)', cf_guia_conversa: 'Guia Campus France — e-mail 2 (a conversa, automático)', resposta: 'Sua resposta (aba Conversa)' };
var TYPE_META = {
  sistema: ['Sistema', ''], app: ['Abriu o app', 'u-baixa'], checklist: ['Checklist', 'u-baixa'], pergunta: ['Pergunta única', 'tp-pergunta'],
  artigo: ['Artigo', 'tp-artigo'], uma_um: ['1:1', 'out'], email: ['E-mail', 'out'], sinal: ['Sinal no dashboard', 'out'], proposta: ['Proposta', 'out'],
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
// Os modelos novos do estúdio que você envia pela ficha (sem Envio) e já têm versão No ar.
// Excluído (o X do estúdio, db/crm-estudio-emails-3.sql): some da lista e do "Escrever e-mail"; as versões ficam e dá para restaurar.
function excluido(k) { var m = modeloDe(k); return !!(m && m.excluido_em); }
function novosManuais() { return (M || []).filter(function (m) { return m.chave !== 'link_pagamento' && m.chave !== 'acesso_confirmado' && m.criado_no_estudio && !m.automatico && !m.excluido_em && versoesDe(m.chave).some(function (v) { return v.etapa === 'no_ar'; }); }); }
function exigeNovidades(k) { var m = modeloDe(k); return m && m.criado_no_estudio ? m.tipo === 'novidades' : !!EXIGEM_NOVIDADES[k]; }
// Rótulo, alavanca e quando usar, para o pop-up: os 8 do código (TPLS) ou o modelo novo.
function tplInfo(k) {
  if (TPLS[k]) return TPLS[k];
  var m = modeloDe(k) || {};
  return { label: m.nome || k, lever: (TIPO_EMAIL[m.tipo] || [''])[0], when: m.como_sai || '' };
}
// Categorias dos modelos (só para organizar a lista e o seletor; não vão para o banco). A primeira regra que bater vale.
var CATEGORIAS = [
  { k: 'acesso', nome: 'Acesso e boas-vindas', ok: function (m) { return /^(boas_vindas|acesso_)/.test(m.chave) || m.objetivo_chave === 'boas_vindas'; } },
  { k: 'compra', nome: 'Compra e pagamento', ok: function (m) { return m.tipo === 'compra' || /^link_pagamento/.test(m.chave); } },
  { k: 'reimpacto', nome: 'Reimpacto', ok: function (m) { return /^(naoabriu|naoclicou|cliquenaoapp|parouapp)$/.test(m.chave); } },
  { k: 'guias', nome: 'Guias e materiais', ok: function (m) { return /^(cf_)?guia_/.test(m.chave) || m.objetivo_chave === 'freebie' || m.objetivo_chave === 'conversa'; } },
  { k: 'outros', nome: 'Outros', ok: function () { return true; } }
];
function categoriaDe(m) { return CATEGORIAS.filter(function (c) { return c.ok(m); })[0]; }
// Agrupa mantendo a ordem em que os modelos chegam; categorias vazias não aparecem.
function porCategoria(lista) {
  return CATEGORIAS.map(function (c) { return { k: c.k, nome: c.nome, itens: lista.filter(function (m) { return categoriaDe(m) === c; }) }; })
    .filter(function (g) { return g.itens.length; });
}
var CAT_FECHADA = {};   // categorias que você recolheu na lista (vale até recarregar a página)
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

function lerDosAberto() { try { return localStorage.getItem('crm_dossie_aberto') === '1'; } catch (e) { return false; } }
var C = [], Q = [], L = [], R = [], RM = {}, SUBS = {}, M = null, MV = [];
var state = { dosAberto: lerDosAberto(), dos: null, ptab: null, pstab: 'assistente', pdias: {}, int: null, chatRasc: '', rascunho: {}, view: 'hoje', persona: '', sub: '', urg: '', stage: '', orig: '', camp: '', q: '', sel: null, qs: 'nova', qsel: null, inbox: 'perguntas', rs: 'nova', rsel: null, preset: 'todos', seg: '', prevView: 'contatos' };
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
  await Promise.all([loadAll(), carregarProdutos()]);
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
    supabase.from('modelos_email_versoes').select('*').order('versao', { ascending: false }),
    // As compras registradas (evento 'compra', db/crm-estudio-emails-3.sql): a prévia diz se a pessoa cumpre o "Para quem".
    supabase.from('eventos').select('contato_id,dados').eq('tipo', 'compra').limit(5000),
    // O Radar (db/crm-radar.sql): os itens do PESTEL por persona e o que já foi enviado. Sem a migração, a tela avisa.
    supabase.from('radar_itens').select('*').is('arquivado_em', null).order('criado_em', { ascending: false }).limit(500),
    supabase.from('radar_envios').select('item_id,contato_id,visto_em').limit(20000)
  ]);
  if (r[0].error) return fail('carregar os contatos', r[0].error);
  COMPRAS = {};
  ((r[7] && !r[7].error && r[7].data) || []).forEach(function (e) { var p = (e.dados || {}).produto; if (p) (COMPRAS[e.contato_id] = COMPRAS[e.contato_id] || {})[p] = 1; });
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
  RD = r[8] && !r[8].error ? (r[8].data || []) : null;
  RE = {};
  ((r[9] && !r[9].error && r[9].data) || []).forEach(function (e) {
    var x = RE[e.item_id] = RE[e.item_id] || { enviados: 0, vistos: 0, contatos: {} };
    x.enviados++; if (e.visto_em) x.vistos++; x.contatos[e.contato_id] = true;
  });
}
// Os produtos pagos da vitrine (content/produtos-digitais.json, público): nome e slug, para "Para quem" e "Registrar compra".
var PRODUTOS = [], COMPRAS = {};
function comprou(cid, prod) { return !!(COMPRAS[cid] && COMPRAS[cid][prod]); }
async function carregarProdutos() {
  try {
    var r = await fetch('/content/produtos-digitais.json', { cache: 'no-store' });
    var d = r.ok ? await r.json() : {};
    PRODUTOS = (d.items || []).filter(function (p) { return p.slug && p.title && p.active !== false && !/-teste$/.test(p.slug); })
      .map(function (p) { return { slug: p.slug, nome: p.title }; });
  } catch (e) { PRODUTOS = []; }
}
function produtoNome(slug) { var p = PRODUTOS.filter(function (x) { return x.slug === slug; })[0]; return p ? p.nome : (slug || '—'); }
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
  renderRadarHoje();
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
  var aQue = m ? modeloNome(m.modelo) + (m.assunto ? ' · "' + m.assunto + '"' : '') : (x.assunto ? 'assunto "' + x.assunto + '"' : '—');
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
    radar_visto: ['app', 'Viu no Radar: ' + (d.titulo || '')],
    chat_mensagem: ['resposta', 'Escreveu no chat' + (d.acao ? ' (' + (CHAT_ACOES[d.acao] || d.acao).toLowerCase() + ')' : '') + ': ' + (d.trecho || '')],
    insights_alterados: ['sistema', 'Os insights dela mudaram' + ((d.entrou || []).length ? ' · entrou: ' + d.entrou.join(', ') : '') + ((d.saiu || []).length ? ' · saiu: ' + d.saiu.join(', ') : '')],
    onboarding_documento_lido: ['sistema', 'Onboarding: documento lido' + (d.campos && d.campos.length ? ' (' + d.campos.length + (d.campos.length === 1 ? ' campo preenchido)' : ' campos preenchidos)') : ' (nenhum campo preenchido)')],
    pagamento_confirmado: ['sistema', 'Pagamento confirmado' + (d.plano ? ': ' + d.plano : '') + (d.status === 'trialing' ? ' (teste grátis)' : '')],
    assinatura_atualizada: ['sistema', 'Assinatura: ' + (ASSIN_ST[d.status] || d.status || 'atualizada') + (d.cancela_no_fim ? ' (cancela no fim do período)' : '')],
    assinatura_cancelada: ['sistema', 'Assinatura cancelada'],
    pagamento_falhou: ['sistema', 'O pagamento falhou'],
    link_pagamento_enviado: ['email', 'Link de pagamento enviado' + (d.rotulo ? ': ' + d.rotulo : d.plano ? ': ' + d.plano : '')],
    dossie_atualizado: ['sistema', 'Você atualizou o dossiê' + (d.campos ? ' (' + d.campos + (d.campos === 1 ? ' campo)' : ' campos)') : '')],
    // Propostas (db/crm-propostas.sql): o título vem do banco e passa por esc() onde a linha é montada.
    proposta_enviada: ['proposta', 'Proposta enviada: ' + (d.titulo || '')],
    proposta_vista: ['proposta', 'Viu a proposta: ' + (d.titulo || '')],
    proposta_aceita: ['proposta', 'Aceitou a proposta: ' + (d.titulo || '')],
    proposta_recusada: ['proposta', 'Recusou a proposta: ' + (d.titulo || '')],
    proposta_adiada: ['proposta', 'Deixou a proposta para depois: ' + (d.titulo || '')],
    email_enviado: ['email', 'E-mail enviado: ' + (MODELO[d.modelo] || (M && modeloNome(d.modelo)) || d.assunto || d.modelo || '')],
    // Com email_id = respondeu a um e-mail do CRM; sem = escreveu direto para respostas@ (sem ligação com um envio).
    // canal (fase 1a): 'toque' = tocou numa cidade do e-mail 2; 'pagina' = escreveu na página /conversa/.
    email_respondido: ['resposta', d.canal === 'toque' ? 'Tocou no e-mail 2: ' + (d.cidade || '—')
      : d.canal === 'pagina' ? 'Escreveu na página da conversa'
      : (d.email_id ? 'Respondeu o seu e-mail' : 'Mandou um e-mail para você') + (d.assunto ? ': "' + d.assunto + '"' : '')],
    estagio_alterado: ['sistema', 'Estágio: ' + stageLabel(d.de) + ' → ' + stageLabel(d.para)],
    compra: ['sistema', 'Comprou: ' + produtoNome(d.produto)]
  };
  return m[t] || ['sistema', t];
}
// tab: 'conversa' ou 'ficha'; sem tab, a ficha abre na Conversa se já houver alguma mensagem.
async function openPessoa(id, tab) {
  if (state.view !== 'pessoa') state.prevView = state.view;
  state.sel = id; state.ptab = tab || null; state.pstab = 'assistente'; state.pdias = {}; state.chatRasc = '';
  show('pessoa');
}
// ---------- E-mails da pessoa: o que já saiu e o próximo, como ela vai ver ----------
function fmtQuando(iso) { return iso ? fmtDay(new Date(iso).toISOString()) + ' às ' + fmtHora(iso) : '—'; }
function mailPill(m) { return '<span class="pill st-' + esc(m.status) + '" title="' + esc(MAIL_ST_DICA[m.status] || '') + '">' + esc(MAIL_ST[m.status] || m.status) + '</span>'; }
// Igual a crmTextToHtml do Worker: é assim que sai um e-mail cujo modelo não tem HTML (os 8 manuais na versão 1).
function htmlSimples(texto) {
  var safe = esc(texto).replace(/(https?:\/\/[^\s<]+)/g, function (u) { return '<a href="' + u + '">' + u + '</a>'; });
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;background:#fff">' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2B2B2B">' + safe.replace(/\n/g, '<br>') + '</div></body></html>';
}
// O rodapé que o Worker acrescenta nos modelos de novidades quando o texto ainda não traz o "palavra sair".
function comRodape(k, corpo) {
  var mn = modeloDe(k), mk = mn && mn.criado_no_estudio ? mn.tipo === 'novidades' : k !== 'boas_vindas' && k !== 'cf_guia_1' && k !== 'resposta';
  return mk && !/palavra\s+"?sair"?/i.test(corpo) ? corpo + '\n\n—\nPra não receber mais e-mails, é só responder este com a palavra "sair".' : corpo;
}
// O e-mail k pronto para ela: o texto No ar com os dados dela e, se a versão tiver HTML (feita no estúdio), esse HTML.
function emailPronto(c, k) {
  var t = textoDoModelo(c, k), v = M && t.versao ? versaoAtual(k) : null, html = null;
  if (v && v.versao === t.versao) { var vd = comMoldura(v); if (vd) { try { html = ES.montarComDados(vd, dadosPara(k, c)).html; } catch (e) { html = null; } } }
  return { k: k, subject: t.subject, body: t.body, versao: t.versao, html: html };
}
// A versão com o template do Por Dentro (logo, papel, botão verde). Se ela não guardou HTML (os 8 manuais na versão 1),
// monta a partir dos blocos dela ou, na versão 1, dos blocos de partida do estúdio, que repetem o texto da versão 1.
function comMoldura(v) {
  if (v.corpo_html) return v;
  var d = v.blocos || (v.versao === 1 && ES.INICIAIS[v.chave]);
  var mo = (M || []).filter(function (x) { return x.chave === v.chave; })[0];
  if (!d || !mo) return null;
  try { return Object.assign({}, v, { corpo_html: ES.montar(d, mo.tipo).corpo_html }); } catch (e) { return null; }
}
// Um e-mail que já saiu, do jeito que chegou: o template (automáticos sempre; manuais quando o Worker gravou formato html)
// refeito com a versão e os dados dela; o resto, no formato simples.
function htmlDoEnviado(m, c) {
  var auto = /^cf_guia_/.test(m.modelo), v = m.modelo_versao ? MV.filter(function (x) { return x.chave === m.modelo && x.versao === m.modelo_versao; })[0] : null;
  if (v && (auto || m.formato === 'html')) {
    var vd = comMoldura(v);
    if (vd) { try { return ES.montarComDados(vd, dadosPara(m.modelo, c)).html; } catch (e) { /* cai no simples */ } }
  }
  return htmlSimples(auto || m.modelo === 'resposta' ? (m.corpo || '') : comRodape(m.modelo, m.corpo || ''));
}
function mailView(m) { return '<div class="mailview" id="mb-' + m.id + '" hidden></div>'; }
// O que a prévia mostra: o HTML do estúdio, ou o texto no formato simples em que o Worker manda.
function previaDoc(k, e, editado) { return !editado && e.html ? e.html : htmlSimples(comRodape(k, editado != null ? editado : e.body)); }
function previaFrame(doc, cls) { return '<iframe class="' + cls + '" sandbox="allow-popups" title="Prévia do e-mail" srcdoc="' + esc(doc) + '"></iframe>'; }

// Quando o e-mail 1 do guia Campus France passou a sair sozinho (o primeiro envio automático é de 14/10, 23h20 de Paris).
var CF_AUTO_DESDE = '2026-10-14T21:20:00Z';
var CF_GUIA_ORIGEM = 'guia-etudes-en-france-2027';
// A sequência automática do guia: e-mail 1 (na hora) e e-mail 2 (no dia seguinte, 10h de Brasília, só com novidades aceitas).
function seqGuiaCF(c, mails) {
  if (origensDe(c).indexOf(CF_GUIA_ORIGEM) < 0) return '';
  var m1 = mails.filter(function (m) { return m.modelo === 'cf_guia_1'; })[0], m2 = mails.filter(function (m) { return m.modelo === 'cf_guia_conversa'; })[0];
  var desde = c.ultima_captura_em || c.criado_em, e1, e2;
  if (m1) e1 = 'saiu em ' + fmtQuando(m1.enviado_em || m1.criado_em) + ' ' + mailPill(m1);
  else if (desde && desde < CF_AUTO_DESDE) e1 = '<span style="color:var(--red)">não saiu</span>: ela deixou o e-mail em ' + esc(fmtDay(desde)) + ', antes de o envio automático ser ligado.';
  else e1 = '<span style="color:var(--red)">não consta envio</span>. Confira o Worker (README, seção 17).';
  var dias1 = m1 ? (Date.now() - new Date(m1.enviado_em || m1.criado_em).getTime()) / 864e5 : 0;
  if (m2) e2 = 'saiu em ' + fmtQuando(m2.enviado_em || m2.criado_em) + ' ' + mailPill(m2);
  else if (!m1) e2 = 'depende do e-mail 1.';
  else if (!c.aceita_novidades) e2 = 'não sai: ela não aceitou novidades por e-mail.';
  else if (dias1 > 7) e2 = 'não sai mais: passou a janela de 7 dias depois do e-mail 1.';
  else e2 = 'sai no envio diário seguinte ao e-mail 1, às 10h de Brasília.';
  return '<div class="seq"><div class="k">Sequência do guia Campus France</div>' +
    '<p><b>E-mail 1 · checklist</b> ' + e1 + '</p><p><b>E-mail 2 · a conversa</b> ' + e2 + '</p></div>';
}
function emailsPanel(c, mails, h4) {
  var em = function (m) { return m.enviado_em || m.criado_em; };
  mails = mails.slice().sort(function (a, b) { return em(a) < em(b) ? 1 : em(a) > em(b) ? -1 : 0; });   // mais recente primeiro
  var k = defaultTpl(c), t = TPLS[k], e = emailPronto(c, k);
  var bloq = EXIGEM_NOVIDADES[k] && !c.aceita_novidades;
  var ultimo = mails[0];
  var head = ultimo ? '<p style="margin:0 0 12px;font-size:13px">Último: <b>' + esc(modeloNome(ultimo.modelo)) + '</b> · ' + esc(fmtQuando(ultimo.enviado_em || ultimo.criado_em)) + ' ' + mailPill(ultimo) + '</p>'
    : '<p style="margin:0 0 12px;font-size:13px"><b>Nenhum e-mail saiu pelo CRM para ela.</b> <span class="sub">E-mails mandados direto do seu Gmail não entram aqui.</span></p>';
  var prox = '<div class="nextmail"><div class="k">' + (voltouDepoisDoEmail(c) ? 'Voltou depois do seu último e-mail · próximo sugerido' : 'Próximo sugerido') + '</div>' +
    '<p style="margin:2px 0 2px;font-size:13.5px"><b>' + esc(t.label) + '</b></p><p class="sub" style="margin:0 0 8px">' + esc(t.when) + '</p>' +
    '<p class="sub" style="margin:0 0 6px">Assunto: <b style="color:var(--ink)">' + esc(e.subject) + '</b></p>' +
    '<button class="mailthumb" type="button" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(k) + '" aria-label="Abrir o e-mail sugerido">' + previaFrame(previaDoc(k, e), 'thumbframe') + '</button>' +
    (bloq ? '<p class="sub" style="margin:8px 0 0;color:var(--red)">Não aceitou novidades por e-mail: este modelo não pode ser enviado.</p>'
      : '<button class="btn primary" type="button" style="margin-top:10px" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(k) + '">Revisar e enviar →</button>') + '</div>';
  var hist = mails.map(function (m) {
    return '<div class="mailrow"><button class="mh" data-mailtoggle="' + m.id + '" type="button"><b>' + esc(m.assunto || modeloNome(m.modelo)) + '</b>' + mailPill(m) +
      '<time>' + esc(fmtQuando(m.enviado_em || m.criado_em)) + '</time></button><div class="sub" style="font-size:11.5px;margin-top:2px">' + esc(modeloNome(m.modelo)) +
      (m.aberto_em ? ' · abriu ' + esc(fmtQuando(m.aberto_em)) : '') + (m.clicado_em ? ' · clicou ' + esc(fmtQuando(m.clicado_em)) : '') + '</div>' +
      mailView(m) + '</div>';
  }).join('');
  return '<div class="panel mailpanel" style="padding:16px"><h4 style="' + h4 + '">E-mails</h4>' + head + prox + seqGuiaCF(c, mails) +
    (hist ? '<div class="k" style="margin-top:14px">Já enviados (' + mails.length + ')</div>' + hist : '') + compraHtml(c) + '</div>';
}
// "Registrar compra": grava o evento 'compra' (crm_registrar_compra, db/crm-estudio-emails-3.sql). É o que liga as sequências
// de compra do estúdio. Enquanto a compra pelo site não chega sozinha ao CRM, você registra aqui.
function compraHtml(c) {
  if (!M || !M.length || !Object.prototype.hasOwnProperty.call(M[0], 'criado_no_estudio') || !PRODUTOS.length) return '';
  return '<div class="k" style="margin-top:14px">Compra</div><div class="st-add" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
    '<select class="st-in" id="compra-prod" aria-label="Produto comprado" style="flex:1 1 180px">' + opcoes(PRODUTOS.map(function (p) { return [p.slug, p.nome]; }), '', 'Escolha o produto') + '</select>' +
    '<button class="btn" type="button" data-compra="' + esc(c.id) + '">Registrar compra</button></div>' +
    '<p class="sub" style="margin:6px 0 0">Liga as sequências de compra daquele produto (as que estiverem No ar, com o Envio ligado).</p>';
}

// ---------- Quem é ela: as respostas do funil com nome legível ----------
// objetivo = a etapa que ela escolheu no guia; o prefixo diz de qual guia (cf- Campus France, alt- alternância 30+).
var ALT_ETAPA = { 'alt-pesquisando': 'Pesquisando se pode fazer alternância depois dos 29', 'alt-escolhendo-escola': 'Escolhendo escola e curso',
  'alt-recusa-idade': 'Ouviu "só até 29" de uma escola', 'alt-buscando-empresa': 'Tem escola, falta a empresa', 'alt-montando-contrato': 'Tem empresa, montando o contrato' };
function etapaDe(v) { return CF_ETAPA[v] || ALT_ETAPA[v] || v; }
function respostasKv(c) {
  var r = c.respostas || {}, rows = [], cf = /^cf-/.test(r.objetivo || '') || r.cfNivel || origensDe(c).indexOf(CF_GUIA_ORIGEM) >= 0;
  var add = function (l, v, falta) { if (v != null && v !== '') rows.push([l, String(v)]); else if (falta) rows.push([l, falta, 1]); };
  add('Persona', personaLabel(c) + (subLabel(c) ? ' · ' + subLabel(c) : ''));
  if (r.objetivo) add(/^alt-/.test(r.objetivo) ? 'Etapa na alternância' : /^cf-/.test(r.objetivo) ? 'Etapa no Campus France' : 'Etapa', etapaDe(r.objetivo));
  if (cf) add('Nível da candidatura', CF_NIVEL[r.cfNivel] || r.cfNivel, 'não respondeu (pergunta nova, de 14/10)');
  if (r.cfNivel && CF_PRAZO[r.cfNivel]) { var d = diasAte(CF_PRAZO[r.cfNivel]); add('Prazo Campus France', fmtDay(CF_PRAZO[r.cfNivel]) + (d >= 0 ? ' (faltam ' + d + ' dias)' : ' (venceu)')); }
  if (cf) add('Cidade', CF_CIDADE[r.cfCidade] || r.cfCidade, 'ainda não disse (toca no e-mail 2)');
  add('Entrada na França', c.data_entrada ? fmtDay(c.data_entrada) : '');
  add('Prazo do VLS-TS', c.prazo_limite ? fmtDay(c.prazo_limite) + ' (' + prazoTxt(c) + ')' : '');
  add('Fase', c.fase); add('Nível de estudos', c.nivel_estudos); add('Preocupação', c.preocupacao);
  Object.keys(r).forEach(function (k) {
    if (k === 'objetivo' || k === 'cfNivel' || k === 'cfCidade') return;
    var l = RESP_LABEL[k]; add(l ? l[0] : k, l ? l[1](r[k]) : r[k]);
  });
  add('Novidades por e-mail', c.aceita_novidades ? 'Aceitou' : 'Não aceitou');
  return rows;
}
function origemKv(c) {
  var rows = [], add = function (l, v) { if (v) rows.push([l, String(v)]); };
  add('Deixou o e-mail', nCapturas(c) + (nCapturas(c) === 1 ? ' vez' : ' vezes') + (c.ultima_captura_em ? ' · última em ' + fmtDay(c.ultima_captura_em) : ''));
  add('Por onde passou', origensDe(c).map(origLabel).join(' → '));
  if (c.personas && c.personas.length > 1) add('Personas', c.personas.map(function (p) { return PERSONAS[p] || p; }).join(' → '));
  add('Campanha (UTM)', c.utm_campaign); add('Post / conteúdo (UTM)', c.utm_content); add('Fonte (UTM)', c.utm_source);
  return rows;
}
function kvHtml(rows) { return '<dl class="kv">' + rows.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd' + (x[2] ? ' class="falta"' : '') + '>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>'; }
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
  var kv = [['Etapa', esc(r.objetivo ? etapaDe(r.objetivo) : '—')], ['Cidade', cidade], ['Veio de', veio],
    ['Novidades', c.aceita_novidades ? 'Aceitou' : 'Não aceitou'], ['Estágio', esc(stageLabel(c.estagio))]];
  return '<aside class="ctxcol">' + top + '<dl class="kv">' + kv.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>' +
    '<div><h4 style="' + h4 + '">Suas anotações</h4><textarea class="notebox" id="nota" data-nota="' + esc(c.id) + '" placeholder="Só você vê.">' + esc(c.nota || '') + '</textarea></div></aside>';
}
function conversaMsg(it, c) {
  var x = it.x, quando = '<time>' + esc(fmtHora(it.em)) + '</time>';
  if (it.k === 'm') {
    var auto = /^cf_guia_/.test(x.modelo), resp = x.modelo === 'resposta';
    var quem = auto ? 'Automático · ' + (x.modelo === 'cf_guia_1' ? 'e-mail 1' : x.modelo === 'cf_guia_conversa' ? 'e-mail 2' : x.modelo)
      : resp ? 'Você · respondeu daqui' : 'Você · ' + modeloNome(x.modelo);
    var corpo = resp ? '<div class="txt">' + esc(x.corpo || '') + '</div>'
      : '<b class="assunto">' + esc(x.assunto || '(sem assunto)') + '</b>' + (x.corpo ? '<button class="link" type="button" data-mailtoggle="' + x.id + '">ver o e-mail</button>' + mailView(x) : '');
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
// Argumento: o texto exato que a pessoa aceitou pra receber novidades, por fonte (ex.: "receber
// novidades de perto sobre a bolsa Eiffel", vindo do artigo de bolsas). Só os "sim", sem repetir.
function argumentosHtml(cons) {
  var vistos = {};
  var itens = cons.filter(function (k) {
    if (k.finalidade !== 'novidades_email' || !k.aceito || !k.texto || vistos[k.texto]) return false;
    vistos[k.texto] = 1; return true;
  });
  if (!itens.length) return '';
  return itens.map(function (k) {
    return '<p class="sub" style="margin:8px 0 0">Argumento: "' + esc(k.texto) + '"' + (k.origem ? ' · fonte: ' + esc(origLabel(k.origem)) : '') + '</p>';
  }).join('');
}

// ---------- Minha iAssistente: o que ela vê agora, o que mudou e as notas que você publica (db/crm-insights.sql) ----------
// As notas automáticas nascem no navegador dela (assets/js/iassistente.js). O app manda para cá a lista que acabou de
// mostrar; as suas notas voltam na mesma lista com id "ingryd:<n>", e é assim que você vê que ela já as recebeu.
var INS_ICONES = [['💡', 'Dica'], ['⚠️', 'Alerta'], ['📄', 'Documento'], ['📅', 'Prazo'], ['🎉', 'Boa notícia']];
function insManualId(n) { return 'ingryd:' + n; }
async function buscaInsights(cid) {
  var r = await Promise.all([
    supabase.from('insights_vivos').select('notas,atualizado_em').eq('contato_id', cid).maybeSingle(),
    supabase.from('insights_historico').select('inicial,entrou,saiu,criado_em').eq('contato_id', cid).order('criado_em', { ascending: false }).limit(30),
    supabase.from('insights_manuais').select('id,icone,texto,ate,ativo,criado_em,retirado_em').eq('contato_id', cid).order('criado_em', { ascending: false }).limit(30)
  ]);
  return { cid: cid, err: r[0].error || r[1].error || r[2].error || null, vivos: r[0].data || null, hist: r[1].data || [], manuais: r[2].data || [] };
}
function insNota(n, quem) {
  return '<div class="insnota"><span class="insicone" aria-hidden="true">' + esc(n.icone || '•') + '</span><div><p>' + esc(n.texto) + '</p><small>' + esc(quem) + '</small></div></div>';
}
function insMudanca(h) {
  var lista = function (arr, rot, cls) {
    return (arr || []).map(function (n) { return '<div class="feeditem"><span class="pill ' + cls + '">' + rot + '</span><div class="fbody"><p>' + esc((n.icone || '') + ' ' + (n.texto || '').slice(0, 220) + ((n.texto || '').length > 220 ? '…' : '')) + '</p></div></div>'; }).join('');
  };
  return '<div class="insmud"><time>' + esc(fmtDia(h.criado_em) + ' ' + fmtHora(h.criado_em)) + '</time>' + lista(h.entrou, 'Entrou', 'u-media') + lista(h.saiu, 'Saiu', 'out') + '</div>';
}
function insightsHtml(ins, agora) {
  var cab = '<h3 style="font-size:15px;margin:0 0 4px">Minha iAssistente</h3>';
  if (!ins) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Carregando…</p></div>';
  if (ins.err) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Falta rodar <b>db/crm-insights.sql</b> no SQL Editor do Supabase.</p></div>';
  var notas = (ins.vivos && ins.vivos.notas) || [], vivosIds = {};
  notas.forEach(function (n) { vivosIds[n.id] = 1; });
  var card = notas.length
    ? '<div class="inscard"><div class="inskicker">Minha iAssistente</div>' + notas.map(function (n) { return insNota(n, /^ingryd:/.test(n.id) ? 'nota sua' : 'automática'); }).join('') + '</div>'
    : '<div class="empty">' + (ins.vivos ? 'Nenhuma nota no ar para ela agora.' : 'Ela ainda não abriu o dashboard depois que isso foi ligado.') + '</div>';
  var quando = ins.vivos ? 'Atualizado ' + fmtDia(ins.vivos.atualizado_em) + ' às ' + fmtHora(ins.vivos.atualizado_em) : '';
  var mudancas = ins.hist.filter(function (h) { return !h.inicial; });
  var recente = mudancas[0] && agora - new Date(mudancas[0].criado_em).getTime() < 10 * 60e3;
  var manuais = ins.manuais.map(function (m) {
    var venceu = m.ate && new Date(m.ate).getTime() <= agora, ativa = m.ativo && !venceu;
    var st = !m.ativo ? ['Retirada', 'out'] : venceu ? ['Venceu', 'out'] : vivosIds[insManualId(m.id)] ? ['No ar, ela já recebeu', 'u-baixa'] : ['Esperando ela abrir o app', 'u-media'];
    return '<div class="feeditem"><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span><div class="fbody"><p>' + esc((m.icone || '') + ' ' + m.texto) + '</p><time>' + esc(fmtDia(m.criado_em)) +
      (m.ate ? ' · vale até ' + esc(fmtDay(m.ate)) : '') + '</time>' + (ativa ? '<button class="link" type="button" data-insretirar="' + esc(m.id) + '">Retirar</button>' : '') + '</div></div>';
  }).join('');
  var inp = 'width:100%;border:1px solid var(--line-2);border-radius:var(--r);background:var(--surface);color:inherit;padding:9px 11px;font:inherit';
  return '<div class="panel' + (recente ? ' insrecente' : '') + '" style="padding:16px" id="ins-panel">' + cab +
    '<p class="sub" style="margin:0 0 10px">O que ela vê agora no dashboard, igual ao card dela. ' + esc(quando) + (recente ? ' <b class="insnovo">Mudou agora há pouco</b>' : '') + '</p>' + card +
    '<h4 class="dsub">Escreva uma nota para ela</h4>' +
    '<div class="insform"><div class="dfield"><label for="ins-icone">Tipo</label><select id="ins-icone" style="' + inp + '">' + INS_ICONES.map(function (i) { return '<option value="' + esc(i[0]) + '">' + esc(i[0] + ' ' + i[1]) + '</option>'; }).join('') + '</select></div>' +
    '<div class="dfield"><label for="ins-ate">Vale até (opcional)</label><input id="ins-ate" type="date" style="' + inp + '"></div></div>' +
    '<div class="dfield" style="margin-top:8px"><label for="ins-texto">Nota (primeira pessoa, como a assistente)</label><textarea id="ins-texto" maxlength="800" placeholder="Ex.: Vi que sua matrícula ainda está em aberto. Posso te ajudar a escolher o curso?" style="' + inp + ';min-height:84px"></textarea></div>' +
    '<div class="actions" style="margin-top:8px"><button class="btn primary" type="button" data-insnova="' + esc(ins.cid) + '">Publicar para ela</button><span class="sub" style="align-self:center">Aparece no card dela na próxima vez que o dashboard abrir.</span></div>' +
    (manuais ? '<h4 class="dsub">Suas notas</h4><div class="feed">' + manuais + '</div>' : '') +
    '<h4 class="dsub">O que mudou no card dela</h4><div class="feed dfeed">' + (mudancas.map(insMudanca).join('') || '<div class="empty">Nada mudou desde que começamos a acompanhar.</div>') + '</div></div>';
}
function dosChipIns(ins) {
  if (!ins || ins.err || !ins.vivos) return '';
  var rec = ins.hist.filter(function (h) { return !h.inicial; })[0], novo = rec && Date.now() - new Date(rec.criado_em).getTime() < 10 * 60e3;
  return '<span class="dchip' + (novo ? ' insnovo' : '') + '"><b>iAssistente</b> ' + ins.vivos.notas.length + (ins.vivos.notas.length === 1 ? ' nota no ar' : ' notas no ar') + (novo ? ' · mudou agora' : '') + '</span>';
}
// Ao vivo: o Realtime avisa quando algo dela muda e a ficha se atualiza sozinha. Se o Realtime não estiver ligado no
// projeto, uma consulta a cada 20 s faz o mesmo mais devagar.
var VIVO = { cid: null, ch: null, timer: null, uid: null };
function pararAoVivo() {
  if (VIVO.ch) { try { supabase.removeChannel(VIVO.ch); } catch (e) {} }
  clearInterval(VIVO.timer); VIVO = { cid: null, ch: null, timer: null, uid: null };
}
function ligarAoVivo(c, uid) {
  if (VIVO.cid === c.id && VIVO.uid === uid) return;
  pararAoVivo(); VIVO.cid = c.id; VIVO.uid = uid;
  var cid = c.id, agendado = null;
  var avisa = function () { clearTimeout(agendado); agendado = setTimeout(function () { atualizaAoVivo(cid); }, 400); };
  var poll = function () { if (!VIVO.timer && VIVO.cid === cid) VIVO.timer = setInterval(function () { atualizaAoVivo(cid); }, 20000); };
  try {
    var ch = supabase.channel('ficha-' + cid);
    [['insights_vivos', 'contato_id=eq.' + cid], ['insights_historico', 'contato_id=eq.' + cid], ['plataforma_cliques', 'contato_id=eq.' + cid], ['chat_mensagens', 'contato_id=eq.' + cid], ['propostas', 'contato_id=eq.' + cid]]
      .concat(uid ? [['checklist_items', 'user_id=eq.' + uid]] : [])
      .forEach(function (t) { ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t[0], filter: t[1] }, avisa); });
    VIVO.ch = ch.subscribe(function (status) { if (status !== 'SUBSCRIBED') poll(); });
  } catch (e) { poll(); }
}
async function atualizaAoVivo(cid, forca) {
  if (state.view !== 'pessoa' || state.sel !== cid || !state.ins || state.ins.cid !== cid) return pararAoVivo();
  var c = byC(cid); if (!c) return;
  var antes = state.ins, chatAntes = state.chat;
  var rk = await Promise.all([buscaChecklist(cid, VIVO.uid), buscaInsights(cid), buscaChat(cid), state.ptab === 'plataforma' ? buscaInteracoes(cid) : null]);
  if (state.view !== 'pessoa' || state.sel !== cid) return;
  var sigChat = function (ch) { return JSON.stringify(ch ? [ch.msgs.length, ch.msgs.length ? ch.msgs[ch.msgs.length - 1].id : 0, Object.keys(ch.props).map(function (k) { return ch.props[k].status + ch.props[k].adiada_ate; })] : null); };
  var mudouIns = JSON.stringify([rk[1].vivos && rk[1].vivos.atualizado_em, rk[1].hist.length, rk[1].manuais.length]) !== JSON.stringify([antes.vivos && antes.vivos.atualizado_em, antes.hist.length, antes.manuais.length]);
  var mudouChk = JSON.stringify([rk[0].itens, rk[0].cliques.length]) !== JSON.stringify([state.dos && state.dos.chk && state.dos.chk.itens, state.dos && state.dos.chk && state.dos.chk.cliques.length]);
  var mudouChat = sigChat(rk[2]) !== sigChat(chatAntes);
  var sigInt = function (i) { return i && !i.err ? JSON.stringify([i.cliques.length, i.cliques[0] && i.cliques[0].criado_em, i.evs.length, i.evs[0] && i.evs[0].criado_em]) : ''; };
  var mudouInt = !!rk[3] && !rk[3].err && sigInt(rk[3]) !== sigInt(state.int);
  if (!mudouIns && !mudouChk && !mudouChat && !mudouInt && !forca) return;
  state.ins = rk[1]; state.chat = rk[2]; if (rk[3] && !rk[3].err) state.int = rk[3]; if (state.dos && state.dos.cid === cid) state.dos.chk = rk[0];
  var painel = $('ins-box'); if (painel) painel.innerHTML = insightsHtml(state.ins, Date.now());
  var cb = $('chk-box'); if (cb) cb.innerHTML = checklistHtml(state.dos && state.dos.chk, Date.now());
  var ca = $('chk-aba'); if (ca) ca.innerHTML = checklistPanel(c);
  var cl = $('chk-lateral'); if (cl) cl.innerHTML = checklistLateralHtml(state.dos && state.dos.chk, Date.now(), 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px');
  pintaChat();   // só o fio: o que você está digitando na caixa fica
  var ib = $('int-box'); if (ib) ib.innerHTML = interacoesHtml(state.int);
  var rl = $('resumo-lateral'); if (rl) rl.innerHTML = resumoPlatHtml(H4_PLAT);
  var ae = document.activeElement;   // não redesenha o dossiê enquanto você digita nele
  if (!(ae && ae.closest && ae.closest('#dossie-box') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) pintaDossie(c);
  if (mudouIns && antes.vivos) toast('Os insights dela mudaram');
  var idAntes = chatAntes && chatAntes.msgs.length ? chatAntes.msgs[chatAntes.msgs.length - 1].id : 0;
  var novas = state.chat.msgs.filter(function (m) { return m.id > idAntes && m.de === 'pessoa'; });
  if (chatAntes && novas.length) toast(displayName(c) + ' escreveu no chat: ' + novas[novas.length - 1].texto.slice(0, 80));
  if (state.ptab === 'plataforma' && state.pstab === 'chat' && novas.length) marcaChatLido(cid);
  var ab = $('plat-abas'); if (ab) ab.innerHTML = platAbasHtml();
}
async function publicarInsight(cid, t) {
  var txt = $('ins-texto').value.trim(), ate = $('ins-ate').value;
  if (!txt) return toast('Escreva a nota');
  t.disabled = true;
  var r = await supabase.from('insights_manuais').insert({ contato_id: cid, icone: $('ins-icone').value || '💡', texto: txt, ate: ate ? new Date(ate + 'T23:59:59').toISOString() : null });
  if (r.error) { t.disabled = false; return fail('publicar a nota', r.error); }
  state.ins = await buscaInsights(cid);
  var b = $('ins-box'); if (b) b.innerHTML = insightsHtml(state.ins, Date.now());
  toast('Nota publicada. Ela vê na próxima vez que abrir o dashboard.');
}
async function retirarInsight(id) {
  var r = await supabase.from('insights_manuais').update({ ativo: false, retirado_em: new Date().toISOString() }).eq('id', id);
  if (r.error) return fail('retirar a nota', r.error);
  state.ins = await buscaInsights(state.sel);
  var b = $('ins-box'); if (b) b.innerHTML = insightsHtml(state.ins, Date.now());
  toast('Nota retirada');
}
// ---------- Chat com ela (db/crm-chat.sql) ----------
// Tudo passa por aqui: o que você escreve, o que ela escreve e as propostas (cartão com Sim / Não / Depois).
// No app dela, o seu avatar flutua e abre este mesmo chat. Os botões rápidos preenchem a caixa (você revisa antes de
// enviar) ou abrem a proposta pronta.
var CHAT_ACOES = { pedido_1a1: 'Pediu um 1:1 de 20 min', duvida: 'Tem uma dúvida', documento: 'Quer ajuda com um documento' };
async function buscaChat(cid) {
  var r = await Promise.all([
    supabase.from('chat_mensagens').select('id,de,tipo,texto,acao,proposta_id,criado_em,lida_em').eq('contato_id', cid).order('id', { ascending: false }).limit(100),
    supabase.from('propostas').select('id,titulo,texto,acao_sim,prazo,status,adiada_ate,criado_em,visto_em,respondido_em').eq('contato_id', cid).order('criado_em', { ascending: false }).limit(60)
  ]);
  var props = {}; ((r[1].data) || []).forEach(function (x) { props[x.id] = x; });
  return { cid: cid, err: r[0].error || null, msgs: ((r[0].data) || []).slice().reverse(), props: props };
}
function chatNaoLidas(chat) { return chat && !chat.err ? chat.msgs.filter(function (m) { return m.de === 'pessoa' && !m.lida_em; }).length : 0; }
function chatMsgHtml(m, chat, agora) {
  var hora = esc(fmtDia(m.criado_em) + ' ' + fmtHora(m.criado_em));
  if (m.tipo === 'proposta') {
    var p = chat.props[m.proposta_id];
    if (!p) return '<div class="cm eu">Proposta: ' + esc(m.texto) + '<small>' + hora + '</small></div>';
    var st = propostaEstado(p, agora);
    return '<div class="cm eu cprop"><b>Proposta: ' + esc(p.titulo) + '</b><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span><p>' + esc(p.texto) + '</p>' +
      (p.status === 'aceita' && p.acao_sim ? '<div class="cacao">Ela disse sim. Combinado: ' + esc(p.acao_sim) + '</div>' : '') +
      '<small>' + hora + (p.prazo ? ' · responder até ' + esc(fmtDay(p.prazo)) : '') + (p.respondido_em ? ' · respondida ' + esc(fmtDia(p.respondido_em) + ' ' + fmtHora(p.respondido_em)) : '') + '</small></div>';
  }
  var eu = m.de === 'ingryd';
  return '<div class="cm ' + (eu ? 'eu' : 'ela') + (!eu && !m.lida_em ? ' nova' : '') + '">' + (m.acao ? '<span class="pill u-media">' + esc(CHAT_ACOES[m.acao] || m.acao) + '</span> ' : '') + esc(m.texto) +
    '<small>' + hora + (eu ? (m.lida_em ? ' · lida' : ' · ainda não lida') : '') + '</small></div>';
}
function chatFioHtml(chat, agora) {
  if (!chat) return '<div class="empty">Carregando…</div>';
  if (chat.err) return '<div class="empty">Falta rodar <b>db/crm-chat.sql</b> no SQL Editor do Supabase.</div>';
  return chat.msgs.map(function (m) { return chatMsgHtml(m, chat, agora); }).join('') || '<div class="empty">Nenhuma mensagem ainda. Escreva abaixo e ela vê no chat do app.</div>';
}
function chatPanelHtml(c, chat, h4) {
  var btn = function (k, rot) { return '<button class="chip" type="button" data-chatquick="' + k + '">' + esc(rot) + '</button>'; };
  var nova = chatNaoLidas(chat);
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Chat com ela' + (nova ? ' <span class="count">' + nova + (nova === 1 ? ' nova' : ' novas') + '</span>' : '') + '</h4>' +
    '<p class="sub" style="margin:0 0 10px">O que você escreve aparece no chat do app dela, no avatar que flutua. Substitui os sinais.</p>' +
    '<div class="cfio chatfio" id="chat-fio" aria-live="polite">' + chatFioHtml(chat, Date.now()) + '</div>' +
    '<div class="tpls" style="margin:10px 0 8px">' + btn('um_a_um', 'Propor 1:1 de 20 min') + btn('como_vai', 'Perguntar como está') + btn('documentos', 'Pedir documentos') + btn('prazo', 'Lembrar do prazo') + btn('proposta', 'Nova proposta') + '</div>' +
    '<textarea class="notebox" id="chat-txt" maxlength="1000" placeholder="Escreva para ela. Aparece no chat do app." aria-label="Mensagem para ela" style="min-height:76px"></textarea>' +
    '<div class="actions" style="margin-top:8px"><button class="btn primary" type="button" data-chatenviar="' + esc(c.id) + '">Enviar</button></div></div>';
}
function chatTextoRapido(k, c) {
  var nome = (c.nome || '').split(/\s+/)[0], oi = nome ? 'Oi, ' + nome + '! ' : 'Oi! ';
  if (k === 'como_vai') return oi + 'Passando para saber como está o seu processo. Alguma dúvida que eu possa ajudar?';
  if (k === 'documentos') return oi + 'Me conta como está a sua documentação: o que você já tem em mãos e o que ainda falta. Com isso eu te digo o que priorizar.';
  var prox = state.dos && state.dos.chk && !state.dos.chk.err && !state.dos.chk.semConta ? chkCalc(state.dos.chk, Date.now()).prox : null;
  return prox ? oi + 'Lembrete: "' + prox.label + '" tem prazo em ' + fmtDay(prox.due_date) + '. Quer ajuda para resolver isso a tempo?' : oi + 'Passando para lembrar de ficar de olho nos prazos do seu checklist. Se algum estiver apertado, me avisa.';
}
function pintaChat() {
  var fio = $('chat-fio'); if (!fio || !state.chat) return;
  var no_fim = !fio.scrollHeight || fio.scrollTop + fio.clientHeight >= fio.scrollHeight - 40;
  fio.innerHTML = chatFioHtml(state.chat, Date.now());
  if (no_fim) fio.scrollTop = fio.scrollHeight;
}
// Ela abriu a aba com mensagens suas por ler: marca como lidas (o painel já foi desenhado com o destaque).
async function marcaChatLido(cid) {
  if (!chatNaoLidas(state.chat)) return;
  var r = await supabase.from('chat_mensagens').update({ lida_em: new Date().toISOString() }).eq('contato_id', cid).eq('de', 'pessoa').is('lida_em', null);
  if (!r.error && state.chat && state.chat.cid === cid) state.chat.msgs.forEach(function (m) { if (m.de === 'pessoa' && !m.lida_em) m.lida_em = new Date().toISOString(); });
}
// Avisa a pessoa por e-mail que você escreveu no chat (o chat só existe dentro do app, então sem isso ela não volta).
// O Worker limita a um aviso a cada 30 min por pessoa. Se falhar, a mensagem já foi: só avisa que o e-mail não saiu.
async function avisarChatPorEmail(cid, mensagemId) {
  try {
    var sess = await supabase.auth.getSession();
    if (!sess.data.session) return;
    var res = await fetch(WORKER_BASE + '/api/crm/chat-aviso', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ contato_id: cid, mensagem_id: mensagemId }) });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) return toast('Mensagem enviada, mas o e-mail de aviso não saiu: ' + (j.error || res.status), 6000);
    if (j.enviado) toast('Aviso enviado por e-mail para ela', 3000);
  } catch (e) { toast('Mensagem enviada, mas o e-mail de aviso não saiu.', 6000); }
}
async function enviarChat(cid, t) {
  var txt = $('chat-txt').value.trim();
  if (!txt) return;
  if (t) t.disabled = true;
  var r = await supabase.rpc('crm_chat_enviar', { p_contato: cid, p_texto: txt });
  if (t) t.disabled = false;
  if (r.error) return fail('enviar a mensagem', r.error);
  $('chat-txt').value = ''; state.chatRasc = '';
  avisarChatPorEmail(cid, r.data);
  await atualizaAoVivo(cid, true);
}
// ---------- Aba Plataforma: o que ela faz dentro do app, a sua iAssistente e o chat com ela ----------
// Os cliques vêm do app (assets/js/rastreio.js → registrar_cliques → plataforma_cliques, db/crm-plataforma.sql):
// só os significativos (abrir tela, botão, link), nunca o que ela digita. Mais recente primeiro.
var TELAS = { '/dashboard/': 'Dashboard', '/dashboard/#home': 'Início', '/dashboard/#checklist': 'Checklist', '/dashboard/#artigos': 'Artigos',
  '/perfil/': 'Perfil', '/landing/': 'Percurso (perguntas)', '/onboarding/': 'Onboarding' };
function telaNome(t) { return TELAS[t] || t; }
// Estado da proposta como a ficha mostra. "Expirou" não existe no banco: é prazo vencido enquanto ainda aberta.
function propostaEstado(x, agora) {
  var aberta = x.status === 'enviada' || x.status === 'vista';
  if (aberta && x.prazo && new Date(x.prazo).getTime() <= agora) return ['Expirou', 'u-alta'];
  if (x.status === 'aceita') return ['Aceita', 'u-baixa'];
  if (x.status === 'recusada') return ['Recusada', 'u-alta'];
  if (x.status === 'vista') return [x.adiada_ate && new Date(x.adiada_ate).getTime() > agora ? 'Para depois' : 'Vista', 'u-media'];
  return ['Enviada', ''];
}
// A aba Plataforma tem três sub-abas: iAssistente, Chat e Interações. A coluna da direita (pagamento, checklist e resumo)
// fica fixa e é a mesma nas três. Interações junta cada clique dela no app (checklist, dossiê, telas, botões) com as vezes
// em que o dossiê foi salvo, separados por dia (um dropdown por dia, o mais recente aberto).
var PLAT_ABAS = [['assistente', 'iAssistente'], ['chat', 'Chat'], ['interacoes', 'Interações']];
var INT_TIPOS = { checklist: ['Checklist', 'u-baixa'], dossie: ['Dossiê', 'u-media'], tela: ['Tela', 'tp-artigo'], botao: ['Botão', 'out'], link: ['Link', 'out'] };
var TELAS_DOSSIE = /^\/(perfil|landing|onboarding)\//;   // as telas em que o app faz as perguntas do dossiê
async function buscaInteracoes(cid) {
  var r = await Promise.all([
    supabase.from('plataforma_cliques').select('sessao,tela,alvo,rotulo,criado_em').eq('contato_id', cid).order('criado_em', { ascending: false }).limit(300),
    supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', cid).or('tipo.eq.dossie_atualizado,tipo.eq.onboarding_documento_lido').order('criado_em', { ascending: false }).limit(100)
  ]);
  return { cid: cid, err: r[0].error || null, cliques: r[0].data || [], evs: r[1].data || [] };
}
function intDeClique(x) {
  var m = /^(Marcou como concluído|Desmarcou): (.*)$/.exec(x.rotulo || ''), tela = x.tela || '';
  if (m) return { t: 'checklist', pill: m[1] === 'Desmarcou' ? 'Desmarcou' : 'Marcou', cls: m[1] === 'Desmarcou' ? 'u-media' : 'u-baixa', txt: m[2], em: x.criado_em };
  var t = /checklist/i.test(tela) ? 'checklist' : TELAS_DOSSIE.test(tela) ? 'dossie' : (x.alvo === 'tela' || x.alvo === 'link') ? x.alvo : 'botao';
  return { t: t, pill: INT_TIPOS[t][0], cls: INT_TIPOS[t][1], em: x.criado_em,
    txt: x.alvo === 'tela' ? 'Abriu ' + telaNome(tela) : (x.rotulo || '(sem texto)'), onde: x.alvo === 'tela' ? '' : telaNome(tela) };
}
// Tudo em uma lista só, mais recente primeiro.
function interacoesLista(int) {
  if (!int) return [];
  var l = int.cliques.map(intDeClique);
  int.evs.forEach(function (e) { l.push({ t: 'dossie', pill: 'Dossiê', cls: INT_TIPOS.dossie[1], txt: eventText(e)[1], em: e.criado_em, onde: 'no CRM' }); });
  return l.sort(function (a, b) { return new Date(b.em) - new Date(a.em); });
}
function interacoesHtml(int) {
  var cab = '<h3 style="font-size:15px;margin:0 0 4px">Interações na plataforma</h3>';
  if (!int) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Carregando…</p></div>';
  var lista = interacoesLista(int), dias = [], por = {};
  lista.forEach(function (x) {
    var k = new Date(x.em).toLocaleDateString('pt-BR');
    if (!por[k]) { por[k] = []; dias.push(k); }
    por[k].push(x);
  });
  var corpo = dias.map(function (k, i) {
    var its = por[k], n = {}, abre = state.pdias[k] !== undefined ? state.pdias[k] : i === 0;
    its.forEach(function (x) { n[x.t] = (n[x.t] || 0) + 1; });
    var chips = ['checklist', 'dossie'].filter(function (t) { return n[t]; }).map(function (t) { return '<span class="dchip"><b>' + INT_TIPOS[t][0] + '</b> ' + n[t] + '</span>'; }).join('');
    return '<details class="dcat intdia" data-dia="' + esc(k) + '"' + (abre ? ' open' : '') + '><summary><b>' + esc(fmtDia(its[0].em)) + '</b> <span class="sub">' + its.length + (its.length === 1 ? ' interação' : ' interações') + '</span>' +
      (chips ? '<span class="dchips">' + chips + '</span>' : '') + '</summary>' + its.map(function (x) {
        return '<div class="feeditem"><span class="pill ' + x.cls + '">' + esc(x.pill) + '</span><div class="fbody"><p>' + esc(x.txt) + '</p><time>' + esc(fmtHora(x.em)) + (x.onde ? ' · ' + esc(x.onde) : '') + '</time></div></div>';
      }).join('') + '</details>';
  }).join('');
  return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0 0 10px">Telas que ela abriu, botões e links em que clicou, itens do checklist que marcou e as vezes que o dossiê foi salvo. Um bloco por dia, o mais recente primeiro.' +
    (int.cliques.length >= 300 ? ' Mostrando os 300 cliques mais recentes.' : '') + '</p>' + (corpo || '<div class="empty">Nada registrado ainda. Aparece aqui quando ela entrar no app.</div>') + '</div>';
}
document.addEventListener('toggle', function (e) {
  var d = e.target; if (d && d.matches && d.matches('details.intdia')) state.pdias[d.dataset.dia] = d.open;
  if (d && d.matches && d.matches('details.st-cat')) CAT_FECHADA[d.dataset.cat] = !d.open;
}, true);
function platAbasHtml() {
  var nova = chatNaoLidas(state.chat);
  return '<div class="ptabs" role="tablist" aria-label="Plataforma" style="margin:0 0 14px">' + PLAT_ABAS.map(function (t) {
    return '<button class="ptab" role="tab" type="button" data-pstab="' + t[0] + '" aria-selected="' + (state.pstab === t[0]) + '">' + t[1] +
      (t[0] === 'chat' && nova ? ' <span class="count">' + nova + '</span>' : '') + '</button>';
  }).join('') + '</div>';
}
function platConteudoHtml(c, h4) {
  if (state.pstab === 'chat') return '<div id="chat-box">' + chatPanelHtml(c, state.chat, h4) + '</div>';
  if (state.pstab === 'interacoes') return '<div id="int-box">' + interacoesHtml(state.int) + '</div>';
  return '<div id="ins-box">' + insightsHtml(state.ins, Date.now()) + '</div>';
}
function resumoPlatHtml(h4) {
  var int = state.int, cliques = (int && int.cliques) || [], lista = interacoesLista(int);
  var porTela = {};
  cliques.forEach(function (x) { if (x.alvo === 'tela') porTela[telaNome(x.tela)] = (porTela[telaNome(x.tela)] || 0) + 1; });
  var top = Object.keys(porTela).sort(function (a, b) { return porTela[b] - porTela[a]; }).slice(0, 5), ult = cliques[0];
  var conta = function (t) { return lista.filter(function (x) { return x.t === t; }).length; };
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Resumo</h4>' + (cliques.length
    ? kvHtml([['Última atividade', fmtDia(ult.criado_em) + ' às ' + fmtHora(ult.criado_em)], ['Cliques registrados', cliques.length + (cliques.length >= 300 ? '+ (mostrando os 300 mais recentes)' : '')],
        ['Interações no checklist', String(conta('checklist'))], ['Interações no dossiê', String(conta('dossie'))],
        ['Telas mais abertas', top.length ? top.map(function (t) { return t + ' (' + porTela[t] + ')'; }).join(', ') : '—']])
    : '<p class="sub" style="margin:0">Ainda sem cliques. Aparecem aqui quando ela entrar no app.</p>') + '</div>';
}
var H4_PLAT = 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px';
// Troca de sub-aba sem recarregar a ficha: a coluna da direita não se mexe, só o miolo.
function pintaPlat(c) {
  var box = $('plat-conteudo'); if (!box) return;
  box.innerHTML = platConteudoHtml(c, H4_PLAT);
  var ab = $('plat-abas'); if (ab) ab.innerHTML = platAbasHtml();
  var rl = $('resumo-lateral'); if (rl) rl.innerHTML = resumoPlatHtml(H4_PLAT);
  if (state.pstab === 'chat') {
    var tx = $('chat-txt'); if (tx && state.chatRasc) tx.value = state.chatRasc;
    var fio = $('chat-fio'); if (fio) fio.scrollTop = fio.scrollHeight;
    marcaChatLido(c.id).then(function () { var a2 = $('plat-abas'); if (a2) a2.innerHTML = platAbasHtml(); });
  }
}
function trocaPlatAba(ab) {
  var c = byC(state.sel); if (!c || state.pstab === ab) return;
  var tx = $('chat-txt'); if (tx) state.chatRasc = tx.value;   // o que você digitou no chat sobrevive à troca
  state.pstab = ab; pintaPlat(c);
}
function plataformaPanel(c, h4) {
  var int = state.int;
  if (int && int.err) {
    return '<div style="margin-top:18px">' + pagamentoHtml(c, h4) + '</div><div class="panel" style="padding:16px;margin-top:18px"><h3 style="font-size:15px;margin-bottom:8px">Plataforma ainda não ligada</h3>' +
      '<p class="sub" style="margin:0">Falta rodar <b>db/crm-plataforma.sql</b> no SQL Editor do Supabase (depois dele, os cliques novos começam a aparecer aqui).</p></div>';
  }
  return '<div class="pessoa-grid" style="margin-top:18px">' +
    '<div style="min-width:0"><div id="plat-abas">' + platAbasHtml() + '</div><div id="plat-conteudo">' + platConteudoHtml(c, h4) + '</div></div>' +
    '<div class="plat-fixa">' + pagamentoHtml(c, h4) +
    '<div id="chk-lateral">' + checklistLateralHtml(state.dos && state.dos.chk, Date.now(), h4) + '</div>' +
    '<div id="resumo-lateral">' + resumoPlatHtml(h4) + '</div></div></div>';
}

// ---------- Dossiê: tudo que a plataforma pergunta, preenchido por você na ligação (db/crm-dossie.sql) ----------
// Mora em contatos.dossie (jsonb) e nas colunas nome/persona/fase/nivel_estudos/preocupacao. As chaves são as do app
// (ano_au_pair, cfNivel, numero_secu...), para o app copiar o dossiê para o perfil dela sem tradução. Fica no topo da
// ficha, igual em todas as abas. Cada pergunta declara em que situação (persona) e em que condição faz sentido, como no app.
var SN = [['true', 'Sim'], ['false', 'Não']];
var DOS_PERSONAS = Object.keys(PERSONAS).filter(function (k) { return k !== 'sem'; }).map(function (k) { return [k, PERSONAS[k]]; });
var DOS_ETAPAS_CF = ['Ainda não comecei', 'Já sei o que quero estudar', 'Já escolhi as formações', 'Já tenho os documentos', 'Já escrevi as motivações', 'Já resolvi o teste',
  'Já planejei o orçamento', 'Já preenchi o dossiê', 'Já submeti', 'Já paguei a taxa', 'Dossiê validado', 'Já fiz a entrevista'].map(function (l, i) { return [String(i + 1), (i + 1) + ' · ' + l]; });
// t: op (lista) · sn (sim/não) · tx (texto) · dt (data) · mes (mês e ano) · lg (texto longo). col: mora numa coluna de contatos.
var DOS = [
  { t: 'Quem é ela', campos: [
    { k: 'nome', l: 'Nome', t: 'tx', col: 1 },
    { k: 'persona', l: 'Situação (qual checklist)', t: 'op', col: 1, o: DOS_PERSONAS },
    { k: 'fase', l: 'Fase', t: 'op', col: 1, o: [['planejando', 'Planejando'], ['adaptando', 'Já está se adaptando'], ['urgente', 'Urgente']] },
    { k: 'nivel_estudos', l: 'Estudos concluídos no Brasil', t: 'op', col: 1, o: [['ensino_medio', 'Ensino médio'], ['superior_incompleto', 'Superior incompleto'],
      ['superior_completo', 'Superior completo'], ['superior_tecnologo', 'Tecnólogo'], ['pos_graduacao', 'Pós-graduação']] },
    { k: 'faixa_idade', l: 'Faixa de idade', t: 'op', o: [['menos_26', 'Menos de 26'], ['26_29', '26 a 29'], ['30_mais', '30 ou mais']] },
    { k: 'profissao_regulamentada', l: 'Profissão regulamentada', t: 'op', o: [['nao', 'Não é o caso'], ['enfermagem', 'Enfermagem'], ['odontologia_medicina', 'Odontologia ou Medicina'], ['outra', 'Outra']] },
    { k: 'preocupacao', l: 'Preocupação que marcou no funil', t: 'op', col: 1, o: [['prazo', 'Prazo'], ['comeco', 'Por onde começar'], ['sozinha', 'Fazer sozinha'], ['caro', 'Custo']] },
    { k: 'maior_preocupacao', l: 'O que mais preocupa agora', t: 'op', o: [['prazo', 'Prazo'], ['dinheiro', 'Dinheiro'], ['papelada', 'Papelada'], ['moradia', 'Moradia'], ['frances', 'Francês']] }
  ] },
  { t: 'Contato', campos: [
    { k: 'telefone', l: 'Telefone / WhatsApp', t: 'tx' },
    { k: 'cidade', l: 'Cidade onde mora hoje', t: 'tx' },
    { k: 'aceita_notificacao_externa', l: 'Aceita lembretes por fora do app', t: 'sn' }
  ] },
  { t: 'Na França', campos: [
    { k: 'data_chegada', l: 'Data de chegada na França', t: 'dt', ajuda: 'Em branco = ainda não chegou.' },
    { k: 'moradia_resolvida', l: 'Moradia resolvida', t: 'sn' },
    { k: 'comprovante_endereco', l: 'Comprovante de endereço no nome dela', t: 'op', o: [['sim', 'Sim'], ['nao', 'Ainda não']], q: function (g) { return g('moradia_resolvida') !== 'false'; } },
    { k: 'conta_resolvida', l: 'Conta bancária francesa', t: 'sn' },
    { k: 'securite_resolvida', l: 'Cadastro na sécurité sociale (Ameli)', t: 'sn' },
    { k: 'numero_secu', l: 'Número de sécu', t: 'op', o: [['recebi', 'Já recebeu'], ['aguardando', 'Pediu, aguardando'], ['nao_pedi', 'Ainda não pediu']] },
    { k: 'certificado_frances', l: 'Tem certificado de francês?', t: 'op', o: [['tenho', 'Sim, tem'], ['nao', 'Ainda não']], ajuda: 'Quem ainda não tem recebe, na plataforma, o Painel do Certificado (template de estudos gratuito).' },
    { k: 'certificado_frances_qual', l: 'Qual certificado de francês', t: 'op', o: [['delf', 'DELF'], ['dalf', 'DALF'], ['tcf', 'TCF'], ['tef', 'TEF'], ['outro', 'Outro']], q: function (g) { return g('certificado_frances') === 'tenho'; } },
    { k: 'nivel_frances', l: 'Nível de francês', t: 'op', o: [['a1_a2', 'A1 ou A2'], ['b1', 'B1'], ['b2', 'B2'], ['c1_mais', 'C1 ou mais'], ['nao_sei', 'Não sabe']] },
    { k: 'documento_vencimento', l: 'Vencimento do documento / título', t: 'dt' }
  ] },
  { t: 'Au pair → estudante', p: ['au_pair_estudante'], campos: [
    { k: 'ano_au_pair', l: 'Ano de au pair', t: 'op', o: [['primeiro', 'Primeiro ano'], ['segundo', 'Segundo ano']] },
    { k: 'intencao_au_pair', l: 'Depois pretende', t: 'op', o: [['renovar', 'Renovar mais um ano'], ['migrar_estudante', 'Migrar para estudante']], q: function (g) { return g('ano_au_pair') === 'primeiro'; } },
    { k: 'contrato_fim', l: 'Fim do contrato (mês e ano)', t: 'mes', q: function (g) { return g('ano_au_pair') === 'segundo' || (g('ano_au_pair') === 'primeiro' && g('intencao_au_pair') === 'migrar_estudante'); } },
    { k: 'tem_certificado_matricula', l: 'Já tem certificado de matrícula', t: 'sn', q: function (g) { return g('intencao_au_pair') !== 'renovar'; } },
    { k: 'comprova_recursos', l: 'Comprova cerca de 877,50 €/mês', t: 'sn' },
    { k: 'tem_sponsor', l: 'Tem sponsor', t: 'sn', q: function (g) { return g('comprova_recursos') === 'false'; } },
    { k: 'conta_anef', l: 'Conta na ANEF', t: 'op', o: [['sim', 'Sim'], ['nao', 'Ainda não'], ['nao_sei', 'Não sabe o que é']], q: function (g) { return g('ano_au_pair') === 'segundo' || g('intencao_au_pair') === 'migrar_estudante'; } },
    { k: 'trilha_estudo', l: 'Caminho de estudo', t: 'op', o: [['fle', 'Curso de FLE'], ['licence', 'Licence'], ['master_alternancia', 'Master em alternância'], ['indefinido', 'Não sabe ainda']] },
    { k: 'data_prova_frances_master', l: 'Data da prova de francês', t: 'dt', q: function (g) { return g('trilha_estudo') === 'master_alternancia'; } }
  ] },
  { t: 'Campus France', p: ['campus_france'], campos: [
    { k: 'cfNivel', l: 'Nível da candidatura', t: 'op', o: [['l1', '1º ano de Licence ou BUT'], ['arq', 'Arquitetura (ENSA)'], ['l2l3', '2º ou 3º ano de Licence'], ['lpro', 'Licence Pro'],
      ['master', 'Master'], ['escola', 'Escola de engenharia ou comércio'], ['tecnologo', 'Tecnólogo (decide com os cursos)']] },
    { k: 'cfEscolaAno', l: 'Ano de entrada na escola', t: 'op', o: [['bac1', '1º ano (bac+1)'], ['bac2', '2º ano (bac+2)'], ['bac3', '3º ano (bac+3)'], ['bac4', '4º ano (bac+4)'], ['bac5', '5º ano (bac+5)'], ['nao_sei', 'Ainda não sabe']],
      q: function (g) { return g('cfNivel') === 'escola'; } },
    { k: 'cfTeste', l: 'Teste de francês', t: 'op', o: [['tenho', 'Tem resultado válido'], ['inscrito', 'Inscrita, ainda não fez'], ['nada', 'Não fez nem se inscreveu']] },
    { k: 'cfEtapa', l: 'Etapa do guia (1 a 12)', t: 'op', o: DOS_ETAPAS_CF },
    { k: 'cfPrazoCursoTem', l: 'Alguma formação fecha antes da plataforma', t: 'op', o: [['sim', 'Sim'], ['nao', 'Não']] },
    { k: 'cfPrazoCurso', l: 'Prazo da formação que fecha primeiro', t: 'dt', q: function (g) { return g('cfPrazoCursoTem') === 'sim'; } }
  ] },
  { t: 'A ligação', livre: 1, campos: [
    { k: 'ligacao_data', l: 'Data da ligação', t: 'dt' },
    { k: 'ligacao_resumo', l: 'Resumo', t: 'lg', ajuda: 'O que ficou combinado, em poucas linhas.' },
    { k: 'proximos_passos', l: 'Próximos passos', t: 'lg' },
    { k: 'ligacao_transcricao', l: 'Gravação transcrita', t: 'lg', alto: 1, ajuda: 'Cole aqui o texto da ligação gravada.' }
  ] }
];
var DOS_NUM = { cfEtapa: 1 }, DOS_MES = { contrato_fim: 1 };
// O valor de um campo como texto de formulário: o que você já digitou e ainda não salvou, ou o que está salvo.
function dosValor(c, d, rasc, k) {
  var f = dosCampo(k), v;
  if (rasc && Object.prototype.hasOwnProperty.call(rasc, k)) v = rasc[k];
  else v = f && f.col ? c[k] : (d || {})[k];
  if (v === null || v === undefined) return '';
  if (DOS_MES[k] && /^\d{4}-\d{2}/.test(v)) return String(v).slice(0, 7);
  return String(v);
}
function dosCampo(k) { for (var i = 0; i < DOS.length; i++) for (var j = 0; j < DOS[i].campos.length; j++) if (DOS[i].campos[j].k === k) return DOS[i].campos[j]; }
// Blocos e campos que valem para a situação dela agora (a persona que está no formulário).
function dosVisiveis(c, d, rasc) {
  var g = function (k) { return dosValor(c, d, rasc, k); }, persona = g('persona') || c.persona;
  return DOS.filter(function (b) { return !b.p || b.p.indexOf(persona) >= 0; }).map(function (b) {
    return { t: b.t, livre: b.livre, campos: b.campos.filter(function (f) { return !f.q || f.q(g); }) };
  });
}
function dosProgresso(c, d, rasc) {
  var n = 0, tot = 0;
  dosVisiveis(c, d, rasc).forEach(function (b) { if (b.livre) return; b.campos.forEach(function (f) { tot++; if (dosValor(c, d, rasc, f.k) !== '') n++; }); });
  return { n: n, tot: tot, falta: tot - n };
}
function dosCampoHtml(f, c, d, rasc) {
  var v = dosValor(c, d, rasc, f.k), id = 'dk-' + f.k, a = ' id="' + id + '" data-dk="' + esc(f.k) + '" data-cid="' + esc(c.id) + '"', ctl;
  if (f.t === 'op' || f.t === 'sn') {
    ctl = '<select' + a + '><option value="">— sem resposta</option>' + (f.t === 'sn' ? SN : f.o).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  } else if (f.t === 'lg') {
    ctl = '<textarea' + a + ' style="min-height:' + (f.alto ? 190 : 84) + 'px">' + esc(v) + '</textarea>';
  } else {
    ctl = '<input' + a + ' type="' + (f.t === 'dt' ? 'date' : f.t === 'mes' ? 'month' : 'text') + '" value="' + esc(v) + '" maxlength="300">';
  }
  var og = onbOrigemDe(f.k, v);
  return '<div class="dfield' + (f.t === 'lg' ? ' wide' : '') + (v === '' ? ' vazio' : '') + '"><label for="' + id + '">' + esc(f.l) + '</label>' + ctl + (f.ajuda ? '<small>' + esc(f.ajuda) + '</small>' : '') +
    (og ? '<small class="orig ' + og.conf + '">' + esc(og.origem) + ' · ' + esc(ONB_CONF[og.conf]) + '</small>' : '') + '</div>';
}
var DOS_CHIPS = ['persona', 'data_chegada', 'cidade', 'nivel_frances', 'cfNivel', 'ano_au_pair', 'trilha_estudo', 'telefone'];
function dosChipChat(chat) {
  var n = chatNaoLidas(chat);
  return n ? '<span class="dchip insnovo"><b>Chat</b> ' + n + (n === 1 ? ' mensagem dela sem ler' : ' mensagens dela sem ler') + '</span>' : '';
}
function dosChipChk(chk) {
  if (!chk || chk.err) return '';
  if (chk.semConta) return '<span class="dchip"><b>Checklist</b> ainda sem conta no app</span>';
  var it = chk.itens || []; if (!it.length) return '';
  return '<span class="dchip"><b>Checklist</b> ' + it.filter(function (i) { return i.status === 'concluido'; }).length + '/' + it.length + '</span>';
}
function dosChips(c, d, rasc) {
  var out = [];
  DOS_CHIPS.forEach(function (k) {
    var f = dosCampo(k), v = dosValor(c, d, rasc, k); if (v === '') return;
    var txt = f.o ? (f.o.filter(function (o) { return o[0] === v; })[0] || [0, v])[1] : f.t === 'dt' ? fmtDay(v) : v;
    out.push('<span class="dchip"><b>' + esc(f.l.replace(/ \(.*/, '')) + '</b> ' + esc(txt) + '</span>');
  });
  return out.join('');
}
// ---------- Checklist dela dentro do dossiê (db/crm-checklist.sql) ----------
// Os itens vêm de checklist_items (só leitura para você) e os cliques de plataforma_cliques: cada "Marcou como
// concluído: <item>" e "Desmarcou: <item>" que o app anota (assets/js/rastreio.js), mais as telas do checklist que ela abriu.
var CHK_FILTRO = 'tela.ilike.%checklist%,rotulo.ilike.Marcou%,rotulo.ilike.Desmarcou%';
function chkNome(t) { return String(t || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 90); }
function chkClique(x) {
  var m = /^(Marcou como concluído|Desmarcou): (.*)$/.exec(x.rotulo || '');
  if (m) return [m[1] === 'Desmarcou' ? 'Desmarcou' : 'Marcou', m[1] === 'Desmarcou' ? 'u-media' : 'u-baixa', m[2]];
  if (x.alvo === 'tela') return ['Tela', 'tp-artigo', 'Abriu ' + telaNome(x.tela)];
  return ['Clique', 'out', (x.rotulo || '(sem texto)') + ' · em ' + telaNome(x.tela)];
}
async function buscaChecklist(cid, uid) {
  var rk = await Promise.all([
    uid ? supabase.from('checklist_items').select('step_key,category,label,status,due_date,sort_order,updated_at').eq('user_id', uid).order('sort_order', { ascending: true }) : null,
    supabase.from('plataforma_cliques').select('tela,alvo,rotulo,criado_em').eq('contato_id', cid).or(CHK_FILTRO).order('criado_em', { ascending: false }).limit(300)
  ]);
  return { semConta: !uid, itens: (rk[0] && rk[0].data) || [], cliques: (rk[1] && rk[1].data) || [], err: (rk[0] && rk[0].error) || null };
}
// As contas do resumo, uma vez só: o dossiê e o painel lateral mostram o mesmo número.
function chkCalc(chk, agora) {
  var itens = chk.itens || [], hoje = new Date(agora).toISOString().slice(0, 10);
  var feitos = itens.filter(function (i) { return i.status === 'concluido'; }).length;
  var atrasados = itens.filter(function (i) { return i.status !== 'concluido' && i.due_date && i.due_date < hoje; });
  var prox = itens.filter(function (i) { return i.status !== 'concluido' && i.due_date && i.due_date >= hoje; }).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; })[0];
  var cats = [], porCat = {};
  itens.forEach(function (i) { var k = i.category || 'Outros'; if (!porCat[k]) { porCat[k] = []; cats.push(k); } porCat[k].push(i); });
  return { itens: itens, hoje: hoje, feitos: feitos, atrasados: atrasados, prox: prox, cats: cats, porCat: porCat };
}
function chkResumoKv(cc, cliques) {
  if (!cc.itens.length) return '<p class="sub" style="margin:0">O checklist dela ainda está vazio.</p>';
  return kvHtml([['Concluídos', cc.feitos + ' de ' + cc.itens.length + ' (' + Math.round(cc.feitos * 100 / cc.itens.length) + '%)'],
    ['Atrasados', cc.atrasados.length ? cc.atrasados.length + ' (' + cc.atrasados.slice(0, 3).map(function (i) { return i.label; }).join(', ') + (cc.atrasados.length > 3 ? '…' : '') + ')' : 'nenhum', cc.atrasados.length ? 1 : 0],
    ['Próximo prazo', cc.prox ? fmtDay(cc.prox.due_date) + ' · ' + cc.prox.label : '—'],
    ['Último clique no checklist', cliques[0] ? fmtDia(cliques[0].criado_em) + ' às ' + fmtHora(cliques[0].criado_em) : '—']]);
}
// O mesmo resumo na coluna da direita das abas Plataforma e Ficha, sem abrir o dossiê.
function checklistLateralHtml(chk, agora, h4) {
  var cab = '<h4 style="' + h4 + '">Checklist</h4>';
  if (!chk) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Carregando…</p></div>';
  if (chk.err) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p></div>';
  if (chk.semConta) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não tem checklist.</p></div>';
  var cc = chkCalc(chk, agora), pct = cc.itens.length ? Math.round(cc.feitos * 100 / cc.itens.length) : 0;
  return '<div class="panel" style="padding:16px">' + cab + chkResumoKv(cc, chk.cliques || []) +
    (cc.itens.length ? '<div class="dprog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
      '<dl class="kv">' + cc.cats.map(function (k) {
        var its = cc.porCat[k], f = its.filter(function (i) { return i.status === 'concluido'; }).length;
        return '<dt>' + esc(k) + '</dt><dd>' + f + ' de ' + its.length + '</dd>';
      }).join('') + '</dl>' : '') +
    '<p class="sub" style="margin:10px 0 0">Itens e cliques, um a um, estão no dossiê (Abrir dossiê completo).</p></div>';
}
function checklistHtml(chk, agora) {
  var cab = '<h4>Checklist e cliques</h4>';
  if (!chk) return '<section class="dbloco">' + cab + '<p class="sub" style="margin:0">Carregando…</p></section>';
  if (chk.err) return '<section class="dbloco">' + cab + '<p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p></section>';
  var cliques = chk.cliques || [];
  var feed = cliques.slice(0, 120).map(function (x) {
    var t = chkClique(x);
    return '<div class="feeditem"><span class="pill ' + t[1] + '">' + esc(t[0]) + '</span><div class="fbody"><p>' + esc(t[2]) + '</p><time>' + esc(fmtDia(x.criado_em) + ' ' + fmtHora(x.criado_em)) + '</time></div></div>';
  }).join('') || '<div class="empty">Nenhum clique no checklist ainda.</div>';
  var mexidas = {};
  cliques.forEach(function (x) { var m = /^(?:Marcou como concluído|Desmarcou): (.*)$/.exec(x.rotulo || ''); if (m) mexidas[chkNome(m[1])] = (mexidas[chkNome(m[1])] || 0) + 1; });
  var resumo, lista = '';
  if (chk.semConta) {
    resumo = '<p class="sub" style="margin:0 0 10px">Ela ainda não entrou no app, então ainda não tem checklist.</p>';
  } else {
    var cc = chkCalc(chk, agora), itens = cc.itens, hoje = cc.hoje, cats = cc.cats, porCat = cc.porCat;
    resumo = chkResumoKv(cc, cliques);
    lista = cats.map(function (k) {
      var its = porCat[k], f = its.filter(function (i) { return i.status === 'concluido'; }).length;
      return '<details class="dcat"><summary>' + esc(k) + ' <span class="sub">' + f + ' de ' + its.length + '</span></summary>' + its.map(function (i) {
        var feito = i.status === 'concluido', atras = !feito && i.due_date && i.due_date < hoje, n = mexidas[chkNome(i.label)];
        return '<div class="feeditem"><span class="pill ' + (feito ? 'u-baixa' : atras ? 'u-alta' : '') + '">' + (feito ? 'Concluído' : atras ? 'Atrasado' : 'Pendente') + '</span><div class="fbody"><p>' + esc(i.label) + '</p><time>' +
          (i.due_date ? 'prazo ' + esc(fmtDay(i.due_date)) : 'sem prazo') + (feito && i.updated_at ? ' · concluído ' + esc(fmtDia(i.updated_at) + ' ' + fmtHora(i.updated_at)) : '') +
          (n ? ' · ela mexeu ' + n + (n === 1 ? ' vez' : ' vezes') : '') + '</time></div></div>';
      }).join('') + '</details>';
    }).join('');
  }
  return '<section class="dbloco">' + cab + resumo + lista + '<h5 class="dsub">Cada clique dela no checklist</h5><div class="feed dfeed">' + feed + '</div></section>';
}
// ---------- Aba Checklist: o que ela vê, ao vivo, e o que fazer com isso ----------
// Mesma fonte do dossiê (checklist_items + cliques), mas em tela própria para acompanhar enquanto ela mexe: cada item com o prazo,
// o atraso e se você já cobrou, e as AÇÕES SUGERIDAS (atrasado, vencendo, concluiu agora, parada). Cada sugestão traz o texto
// pronto para o chat (que também avisa por e-mail), uma nota para o app dela ou uma proposta de 1:1; você revisa antes de enviar.
var CHK_VENCE_EM = 7, CHK_PARADA_DIAS = 7, CHK_COBRADO_DIAS = 3, CHK_RECENTE_H = 72;
function chkDias(a, b) { return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5); }
function chkPlural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
// Há quantos dias você escreveu no chat citando este item (null = nunca).
function chkCobradoHa(item, agora) {
  var msgs = (state.chat && !state.chat.err && state.chat.msgs) || [], k = chkNome(item.label).slice(0, 30), ult = null;
  msgs.forEach(function (m) { if (m.de === 'ingryd' && chkNome(m.texto).indexOf(k) >= 0 && (!ult || m.criado_em > ult)) ult = m.criado_em; });
  return ult ? Math.floor((agora - Date.parse(ult)) / 864e5) : null;
}
function chkSugestoes(chk, agora) {
  if (!chk || chk.err || chk.semConta) return [];
  var cc = chkCalc(chk, agora), c = byC(state.sel) || {}, nome = (c.nome || '').split(/\s+/)[0], oi = nome ? 'Oi, ' + nome + '! ' : 'Oi! ';
  var out = [], pend = cc.itens.filter(function (i) { return i.status !== 'concluido'; });
  var quando = function (i) { return fmtDay(i.due_date); };
  cc.atrasados.slice().sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }).slice(0, 4).forEach(function (i) {
    var d = chkDias(cc.hoje, i.due_date), cob = chkCobradoHa(i, agora), esperando = cob !== null && cob < CHK_COBRADO_DIAS;
    out.push({ nivel: esperando ? 'baixa' : 'alta', rotulo: esperando ? 'Aguardando resposta' : 'Atrasado',
      titulo: '"' + i.label + '" está atrasado há ' + chkPlural(d, 'dia', 'dias'),
      porque: 'O prazo era ' + quando(i) + '.' + (cob !== null ? ' Você escreveu sobre isso há ' + chkPlural(cob, 'dia', 'dias') + '.' : ' Você ainda não cobrou.'),
      chat: oi + 'O prazo de "' + i.label + '" era ' + quando(i) + ' e ainda não vi esse passo concluído no seu checklist. Aconteceu alguma coisa? Me conta onde travou que eu te ajudo a destravar.',
      nota: 'O prazo de "' + i.label + '" já passou. Se estiver travado, me chama no chat: dá para resolver por partes.',
      prop: d >= 14 || cc.atrasados.length >= 3 });
  });
  cc.itens.filter(function (i) { return i.status !== 'concluido' && i.due_date && i.due_date >= cc.hoje && chkDias(i.due_date, cc.hoje) <= CHK_VENCE_EM; }).slice(0, 3).forEach(function (i) {
    var d = chkDias(i.due_date, cc.hoje);
    out.push({ nivel: 'media', rotulo: 'Vence logo', titulo: '"' + i.label + '" vence ' + (d === 0 ? 'hoje' : 'em ' + chkPlural(d, 'dia', 'dias')),
      porque: 'Prazo ' + quando(i) + '. Um lembrete agora evita virar atraso.',
      chat: oi + 'Lembrete: "' + i.label + '" tem prazo ' + (d === 0 ? 'hoje' : 'em ' + quando(i)) + '. Precisa de ajuda para fechar isso a tempo?',
      nota: '"' + i.label + '" vence ' + (d === 0 ? 'hoje' : 'em ' + chkPlural(d, 'dia', 'dias')) + '. Vale resolver isso primeiro.', prop: false });
  });
  var recentes = cc.itens.filter(function (i) { return i.status === 'concluido' && i.updated_at && agora - Date.parse(i.updated_at) < CHK_RECENTE_H * 36e5; })
    .sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; });
  if (recentes.length) {
    var r = recentes[0], prox = pend.filter(function (i) { return i.due_date; }).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; })[0] || pend[0];
    out.push({ nivel: 'positiva', rotulo: 'Concluiu agora', titulo: 'Ela concluiu "' + r.label + '"' + (recentes.length > 1 ? ' e mais ' + (recentes.length - 1) : ''),
      porque: 'Boa hora para reconhecer e já apontar o próximo passo' + (prox ? ': "' + prox.label + '".' : '.'),
      chat: oi + 'Vi que você concluiu "' + r.label + '". Parabéns!' + (prox ? ' O próximo passo é "' + prox.label + '"' + (prox.due_date ? ' (prazo ' + quando(prox) + ')' : '') + '. Quer ajuda com ele?' : ' Está tudo em dia por aqui.'),
      nota: 'Você concluiu "' + r.label + '". ' + (prox ? 'Agora o próximo passo é "' + prox.label + '".' : 'Seu checklist está em dia.'), prop: false });
  }
  var ult = Math.max.apply(null, [0].concat((chk.cliques || []).slice(0, 1).map(function (x) { return Date.parse(x.criado_em); }),
    cc.itens.map(function (i) { return i.updated_at ? Date.parse(i.updated_at) : 0; })));
  if (pend.length && ult && agora - ult > CHK_PARADA_DIAS * 864e5) {
    var dp = Math.floor((agora - ult) / 864e5);
    out.push({ nivel: 'media', rotulo: 'Parada', titulo: 'Sem mexer no checklist há ' + chkPlural(dp, 'dia', 'dias'),
      porque: 'Ainda há ' + chkPlural(pend.length, 'item pendente', 'itens pendentes') + '. Um toque pessoal costuma trazer de volta.',
      chat: chatTextoRapido('como_vai', c), nota: 'Faz um tempo que você não passa pelo checklist. Vale abrir e ver qual é o próximo passo.', prop: dp >= 14 });
  }
  var ordem = { alta: 0, media: 1, positiva: 2, baixa: 3 };
  return out.sort(function (a, b) { return ordem[a.nivel] - ordem[b.nivel]; });
}
var CHK_NIVEL = { alta: 'u-alta', media: 'u-media', positiva: 'u-baixa', baixa: '' };
function checklistPanel(c) {
  var chk = state.dos && state.dos.chk, agora = Date.now();
  if (!chk) return '<div class="panel" style="padding:16px;margin-top:18px"><p class="sub" style="margin:0">Carregando…</p></div>';
  if (chk.err) return '<div class="panel" style="padding:16px;margin-top:18px"><p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p></div>';
  if (chk.semConta) return '<div class="panel" style="padding:16px;margin-top:18px"><h3 style="font-size:15px;margin-bottom:8px">Checklist</h3><p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não tem checklist. Quando entrar, ele aparece aqui e acompanha o que ela marcar.</p></div>';
  var cc = chkCalc(chk, agora), pct = cc.itens.length ? Math.round(cc.feitos * 100 / cc.itens.length) : 0;
  state.chkSug = chkSugestoes(chk, agora);
  var sug = state.chkSug.map(function (x, n) {
    return '<div class="feeditem"><span class="pill ' + CHK_NIVEL[x.nivel] + '">' + esc(x.rotulo) + '</span><div class="fbody"><p><b>' + esc(x.titulo) + '</b></p><p class="sub" style="margin:2px 0 8px">' + esc(x.porque) + '</p>' +
      '<div class="actions" style="margin:0"><button class="btn primary" type="button" data-chkvia="chat" data-chki="' + n + '">Mensagem no chat</button>' +
      '<button class="btn" type="button" data-chkvia="nota" data-chki="' + n + '">Nota no app dela</button>' +
      '<button class="btn" type="button" data-chkvia="email" data-chki="' + n + '">E-mail</button>' +
      (x.prop ? '<button class="btn" type="button" data-chkvia="prop" data-chki="' + n + '">Propor 1:1</button>' : '') + '</div></div></div>';
  }).join('') || '<p class="sub" style="margin:0">Nada a fazer agora: sem atrasos, sem prazo chegando e ela mexeu no checklist recentemente.</p>';
  var cliques = (chk.cliques || []).filter(function (x) { return /^(Marcou como concluído|Desmarcou): /.test(x.rotulo || ''); });
  var feed = cliques.slice(0, 15).map(function (x) {
    var t = chkClique(x);
    return '<div class="feeditem"><span class="pill ' + t[1] + '">' + esc(t[0]) + '</span><div class="fbody"><p>' + esc(t[2]) + '</p><time>' + esc(fmtDia(x.criado_em) + ' ' + fmtHora(x.criado_em)) + '</time></div></div>';
  }).join('') || '<div class="empty">Ela ainda não marcou nem desmarcou nada.</div>';
  var lista = cc.cats.map(function (k) {
    var its = cc.porCat[k], f = its.filter(function (i) { return i.status === 'concluido'; }).length, temAtraso = its.some(function (i) { return cc.atrasados.indexOf(i) >= 0; });
    return '<details class="dcat"' + (temAtraso ? ' open' : '') + '><summary>' + esc(k) + ' <span class="sub">' + f + ' de ' + its.length + (temAtraso ? ' · com atraso' : '') + '</span></summary>' + its.map(function (i) {
      var feito = i.status === 'concluido', atras = cc.atrasados.indexOf(i) >= 0, d = atras ? chkDias(cc.hoje, i.due_date) : 0, cob = !feito ? chkCobradoHa(i, agora) : null;
      return '<div class="feeditem"><span class="pill ' + (feito ? 'u-baixa' : atras ? 'u-alta' : '') + '">' + (feito ? 'Concluído' : atras ? 'Atrasado' : 'Pendente') + '</span><div class="fbody"><p>' + esc(i.label) + '</p><time>' +
        (i.due_date ? 'prazo ' + esc(fmtDay(i.due_date)) : 'sem prazo') + (atras ? ' · ' + chkPlural(d, 'dia', 'dias') + ' de atraso' : '') +
        (feito && i.updated_at ? ' · concluído ' + esc(fmtDia(i.updated_at) + ' ' + fmtHora(i.updated_at)) : '') +
        (cob !== null ? ' · você cobrou há ' + chkPlural(cob, 'dia', 'dias') : '') + '</time></div>' +
        (atras ? '<button class="btn" type="button" data-chkvia="item" data-chki="' + cc.itens.indexOf(i) + '" style="flex:none">Cobrar</button>' : '') + '</div>';
    }).join('') + '</details>';
  }).join('');
  return '<div class="pessoa-grid" style="margin-top:18px"><div style="min-width:0;display:flex;flex-direction:column;gap:16px">' +
    '<div class="panel" style="padding:16px"><h3 style="font-size:15px;margin-bottom:4px">Ações sugeridas</h3><p class="sub" style="margin:0 0 10px">Muda sozinha quando ela marca ou desmarca algo. Você revisa o texto antes de enviar.</p>' + sug + '</div>' +
    '<div class="panel" style="padding:16px"><h3 style="font-size:15px;margin-bottom:8px">Itens do checklist dela</h3>' + lista + '</div></div>' +
    '<div style="display:flex;flex-direction:column;gap:16px"><div class="panel" style="padding:16px"><h4 style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">Andamento</h4>' +
    chkResumoKv(cc, chk.cliques || []) + '<div class="dprog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div></div>' +
    '<div class="panel" style="padding:16px"><h4 style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">O que ela marcou, ao vivo</h4><div class="feed dfeed">' + feed + '</div></div></div></div>';
}
// Leva o texto da sugestão (ou do item) até onde você envia, já preenchido para revisar.
async function chkAgir(via, i) {
  var c = byC(state.sel); if (!c) return;
  var s = via === 'item' ? null : (state.chkSug || [])[i], it = via === 'item' ? state.dos.chk.itens[i] : null;
  if (via === 'item') {
    var d = chkDias(chkCalc(state.dos.chk, Date.now()).hoje, it.due_date), nome = (c.nome || '').split(/\s+/)[0];
    s = { chat: (nome ? 'Oi, ' + nome + '! ' : 'Oi! ') + 'O prazo de "' + it.label + '" era ' + fmtDay(it.due_date) + ' (' + chkPlural(d, 'dia', 'dias') + ' atrás) e ainda não vi esse passo concluído. Aconteceu alguma coisa? Me conta onde travou que eu te ajudo.' };
    via = 'chat';
  }
  if (!s) return;
  if (via === 'prop') return openProposta(c.id, 'um_a_um');
  if (via === 'email') return openCompose(c.id);
  if (via === 'chat') {
    state.ptab = 'plataforma'; state.pstab = 'chat'; state.chatRasc = s.chat; await renderPessoa();
    var x = $('chat-txt'); if (x) { x.value = s.chat; x.focus(); x.scrollIntoView({ block: 'center' }); }
    return toast('Texto no chat. Revise e envie: ela também recebe um aviso por e-mail.', 4000);
  }
  if (via === 'nota') {
    state.ptab = 'plataforma'; state.pstab = 'assistente'; await renderPessoa();
    var n = $('ins-texto'); if (n) { n.value = s.nota; n.focus(); n.scrollIntoView({ block: 'center' }); }
    return toast('Nota pronta. Revise e publique: ela vê no dashboard.', 4000);
  }
}
function dossieHtml(c, d, err, rasc, aberto, chk) {
  if (err) return '<div class="panel dossie"><div class="dhead"><h3>Dossiê</h3></div><p class="sub" style="margin:0">Falta rodar <b>db/crm-dossie.sql</b> no SQL Editor do Supabase.</p></div>';
  var pr = dosProgresso(c, d, rasc), pct = pr.tot ? Math.round(pr.n * 100 / pr.tot) : 0, sujo = rasc && Object.keys(rasc).length;
  var corpo = '';
  if (aberto) {
    corpo = '<div class="dcorpo">' + dosVisiveis(c, d, rasc).map(function (b) {
      return '<section class="dbloco"><h4>' + esc(b.t) + '</h4><div class="dgrid">' + b.campos.map(function (f) { return dosCampoHtml(f, c, d, rasc); }).join('') + '</div></section>';
    }).join('') + '<div class="actions" style="margin-top:6px"><button class="btn primary" type="button" data-dossalvar="' + esc(c.id) + '">Salvar dossiê</button>' +
      (sujo ? '<span class="sub" style="align-self:center">Há alterações ainda não salvas.</span>' : '') + '</div>' + '<div id="chk-box">' + checklistHtml(chk, Date.now()) + '</div></div>';
  }
  return '<div class="panel dossie"><div class="dhead"><h3>Dossiê</h3><span class="sub">' + pr.n + ' de ' + pr.tot + ' respondidas' + (pr.falta ? ' · faltam ' + pr.falta : ' · completo') + '</span>' +
    '<button class="btn" type="button" data-dostoggle="1" aria-expanded="' + !!aberto + '" style="margin-left:auto">' + (aberto ? 'Fechar dossiê' : 'Abrir dossiê completo') + '</button></div>' +
    '<div class="dprog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
    '<div class="dchips">' + dosChipChk(chk) + dosChipIns(state.ins) + dosChipChat(state.chat) + (dosChips(c, d, rasc) || '<span class="sub">Nada preenchido ainda. Abra o dossiê para preencher durante a ligação.</span>') + '</div>' + onbFaltaHtml(c, d, rasc) + corpo + '</div>';
}
function pintaDossie(c) {
  var box = $('dossie-box'); if (!box || !state.dos || state.dos.cid !== c.id) return;
  box.innerHTML = dossieHtml(c, state.dos.d, state.dos.err, state.dos.rasc, state.dosAberto, state.dos.chk);
}
// Salva o que mudou: colunas de contatos direto (como o estágio) e o resto por crm_salvar_dossie.
async function salvarDossie(cid, t) {
  var c = byC(cid), rasc = (state.dos && state.dos.cid === cid && state.dos.rasc) || {}, cols = {}, dados = {};
  Object.keys(rasc).forEach(function (k) {
    var f = dosCampo(k), v = rasc[k], val;
    if (!f) return;
    if (v === '' || v === null || v === undefined) val = null;
    else if (f.t === 'sn') val = v === 'true';
    else if (DOS_NUM[k]) val = parseInt(v, 10);
    else if (DOS_MES[k]) val = v + '-01';
    else val = f.t === 'lg' ? v : String(v).trim();
    if (f.col) cols[k] = val === '' ? null : val; else dados[k] = val === '' ? null : val;
  });
  if (!Object.keys(cols).length && !Object.keys(dados).length) return toast('Nada mudou');
  if (t) t.disabled = true;
  if (Object.keys(cols).length) {
    var u = await supabase.from('contatos').update(cols).eq('id', cid);
    if (u.error) { if (t) t.disabled = false; return fail('salvar o dossiê', u.error); }
  }
  if (Object.keys(dados).length) {
    var r = await supabase.rpc('crm_salvar_dossie', { p_contato: cid, p_dados: dados });
    if (r.error) { if (t) t.disabled = false; return fail('salvar o dossiê', r.error); }
  }
  state.dos.rasc = {};
  await reload(); if (state.view === 'pessoa') renderPessoa();
  toast('Dossiê salvo');
}

async function renderPessoa() {
  var c = byC(state.sel);
  if (!c) { $('pessoa-page').innerHTML = '<div class="empty">Pessoa não encontrada.</div>'; return; }
  $('pessoa-page').innerHTML = '<div class="loading">Carregando a ficha…</div>';
  var r = await Promise.all([
    supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(200),
    supabase.from('consentimentos').select('finalidade,aceito,texto,origem,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    supabase.from('emails_enviados').select('*').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    state.ptab === 'plataforma' ? supabase.from('plataforma_cliques').select('sessao,tela,alvo,rotulo,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(300) : null,
    supabase.from('contatos').select('dossie,user_id').eq('id', c.id).maybeSingle(),
    supabase.from('contatos').select('dossie_origem,onboarding_em').eq('id', c.id).maybeSingle(),
    supabase.from('assinaturas').select('status,plano,moeda,teste_fim,periodo_fim,cancela_no_fim').eq('contato_id', c.id).maybeSingle()   // db/crm-assinaturas.sql
  ]);
  if (state.sel !== c.id || state.view !== 'pessoa') return;   // trocou de tela enquanto carregava
  var eventos = r[0].data || [], cons = r[1].data || [], mails = r[2].data || [];
  var rascAnt = state.dos && state.dos.cid === c.id ? state.dos.rasc : {};   // o que você digitou e ainda não salvou sobrevive à troca de aba
  var uid = r[4].data && r[4].data.user_id;
  var rk = await Promise.all([buscaChecklist(c.id, uid), buscaInsights(c.id), buscaChat(c.id)]);
  if (state.sel !== c.id || state.view !== 'pessoa') return;
  state.ins = rk[1]; state.chat = rk[2];
  if (r[3]) state.int = { cid: c.id, err: r[3].error || null, cliques: r[3].data || [], evs: eventos.filter(function (e) { return e.tipo === 'dossie_atualizado' || e.tipo === 'onboarding_documento_lido'; }) };
  var ob = (r[5] && !r[5].error && r[5].data) || {};   // sem crm-onboarding.sql a ficha segue igual, sem etiquetas
  state.dos = { cid: c.id, d: (r[4].data && r[4].data.dossie) || {}, err: r[4].error, rasc: rascAnt || {}, chk: rk[0], origem: ob.dossie_origem || {}, onbEm: ob.onboarding_em || null };
  state.assin = r[6] && !r[6].error && r[6].data ? r[6].data : null;
  var lp = eventos.filter(function (e) { return e.tipo === 'link_pagamento_enviado'; })[0];
  state.pagto = lp ? { quando: lp.criado_em, rotulo: (lp.dados && lp.dados.rotulo) || (lp.dados && lp.dados.plano) || '' } : null;
  state.mails = mails;
  var last = function (f) { var x = cons.filter(function (k) { return k.finalidade === f; })[0]; return x ? x.aceito : false; };
  var perg = Q.filter(function (x) { return x.contato_id === c.id; });
  var resps = R.filter(function (x) { return x.contato_id === c.id; });
  var h4 = 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px';
  if (!state.ptab) state.ptab = mails.length || resps.length ? 'conversa' : 'ficha';
  var tabs = '<div class="ptabs" role="tablist" aria-label="Ficha da pessoa">' + [['conversa', 'Conversa'], ['plataforma', 'Plataforma'], ['checklist', 'Checklist'], ['ficha', 'Ficha']].map(function (t) {
    return '<button class="ptab" role="tab" type="button" data-ptab="' + t[0] + '" aria-selected="' + (state.ptab === t[0]) + '">' + t[1] +
      (t[0] === 'conversa' && resps.some(function (x) { return x.status === 'nova'; }) ? ' <span class="count">nova</span>' : '') +
      (t[0] === 'checklist' && state.dos.chk && !state.dos.chk.err && !state.dos.chk.semConta && chkCalc(state.dos.chk, Date.now()).atrasados.length ? ' <span class="count">' + chkCalc(state.dos.chk, Date.now()).atrasados.length + ' atrasado' + (chkCalc(state.dos.chk, Date.now()).atrasados.length > 1 ? 's' : '') + '</span>' : '') + '</button>';
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
    '<div class="sel"><select id="stage-pick" aria-label="Mudar estágio">' + STAGES.map(function (s) { return '<option value="' + s.k + '"' + (s.k === c.estagio ? ' selected' : '') + '>Estágio: ' + s.l + '</option>'; }).join('') + '</select></div></div>' +
    onbResumoHtml(c) +
    '<div id="dossie-box">' + dossieHtml(c, state.dos.d, state.dos.err, state.dos.rasc, state.dosAberto, state.dos.chk) + '</div>' +
    tabs + (state.ptab === 'conversa' ? conversaPanel(c, mails, resps, h4) : state.ptab === 'plataforma' ? plataformaPanel(c, h4) : state.ptab === 'checklist' ? '<div id="chk-aba">' + checklistPanel(c) + '</div>' :
    '<div class="pessoa-grid" style="margin-top:18px">' +
    '<div class="panel" style="padding:16px"><h3 style="font-size:15px; margin-bottom:8px">Tudo que ela fez</h3>' +
    '<p class="sub" style="margin:0 0 10px">Checklist, pergunta única, artigos e o resto do app — mais o que você mandou pra ela. Mais recente primeiro.</p>' +
    '<div class="feed">' + (eventos.map(function (e) {
      var tx = eventText(e), m = TYPE_META[tx[0]];
      return '<div class="feeditem"><span class="pill ' + m[1] + '">' + esc(m[0]) + '</span><div class="fbody"><p>' + esc(tx[1]) + '</p><time>' + esc(fmtDate(e.criado_em)) + '</time></div></div>';
    }).join('') || '<div class="empty">Nada registrado ainda.</div>') + '</div></div>' +
    '<div style="display:flex; flex-direction:column; gap:16px">' +
    '<div id="chk-lateral">' + checklistLateralHtml(state.dos && state.dos.chk, Date.now(), h4) + '</div>' +
    emailsPanel(c, mails, h4) +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Quem é ela</h4>' + kvHtml(respostasKv(c)) + '</div>' +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">De onde veio</h4>' + kvHtml(origemKv(c)) + '</div>' +
    (perg.length ? '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Perguntas únicas</h4>' + perg.map(function (x) { return '<p style="margin:0 0 6px;font-size:13px">"' + esc(x.texto) + '" <button class="link" data-openq="' + x.id + '" type="button">' + (x.status === 'nova' ? 'Responder' : 'Ver resposta') + ' →</button></p>'; }).join('') + '</div>' : '') +
    (resps.length ? '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Respostas</h4>' + resps.map(function (x) { return '<p style="margin:0 0 6px;font-size:13px"><span title="' + esc(canalDe(x)[1]) + '">' + canalDe(x)[0] + '</span> "' + esc(x.texto.length > 160 ? x.texto.slice(0, 160) + '…' : x.texto) + '" <span class="sub">' + esc(canalDe(x)[1]) + ' · ' + esc(fmtDate(x.recebido_em)) + '</span> <button class="link" data-openr="' + x.id + '" type="button">' + (x.status === 'nova' ? 'Abrir na caixa' : 'Ver') + ' →</button></p>'; }).join('') + '</div>' : '') +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Consentimento</h4><div class="consent"><span class="pill ' + (last('servico') ? 'u-baixa' : '') + '">Política de privacidade ' + (last('servico') ? '✓' : '—') + '</span><span class="pill ' + (last('novidades_email') ? 'u-baixa' : '') + '">Novidades por e-mail ' + (last('novidades_email') ? '✓' : '—') + '</span></div>' + argumentosHtml(cons) + '</div>' +
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
  ligarAoVivo(c, uid);
  if (state.ptab === 'plataforma' && state.pstab === 'chat') { var fio0 = $('chat-fio'); if (fio0) fio0.scrollTop = fio0.scrollHeight; marcaChatLido(c.id).then(function () { var a0 = $('plat-abas'); if (a0) a0.innerHTML = platAbasHtml(); }); }
}

// ---------- Modais ----------
// largo: o pop-up do e-mail, que mostra a prévia do tamanho de um e-mail de verdade.
function modalOpen(html, largo) {
  if (!largo) CMP = null;
  $('compose-modal').style.maxWidth = largo ? '760px' : '560px';
  $('compose-modal').innerHTML = '<div class="card">' + html + '</div>'; $('compose-modal').hidden = false; $('compose-backdrop').hidden = false;
}
function closeCompose() { $('compose-modal').hidden = true; $('compose-backdrop').hidden = true; }
function modalTop(c) { return '<div class="top"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><h3>' + esc(displayName(c)) + '</h3><div class="mail">' + esc(c.email) + '</div></div></div>'; }
// Propostas prontas dos botões do chat. Você ainda edita tudo antes de enviar.
var PROP_PRESETS = {
  um_a_um: { titulo: 'Um 1:1 de 20 minutos?', texto: 'Que tal conversarmos 20 minutos para eu entender melhor o seu caso e te dizer qual é o próximo passo?',
    acao_sim: 'Ótimo! Te mando os horários disponíveis aqui no chat.' }
};
function openProposta(cid, preset) {
  var c = byC(cid), pr = PROP_PRESETS[preset] || {}; activeCid = cid;
  var inp = 'width:100%;border:1px solid var(--line-2);border-radius:var(--r);background:var(--surface-2);padding:10px 12px';
  modalOpen(modalTop(c) + '<div class="ctx" style="margin-top:12px"><span class="pill out">Chega no chat dela, como um cartão</span></div>' +
    '<p class="sub" style="margin-top:8px">Ela responde dentro do chat: Sim, Não ou Depois (volta em 3 dias). A resposta aparece aqui e na linha do tempo.</p>' +
    '<div class="reply" style="margin-top:10px"><label for="prop-titulo">Título</label><input id="prop-titulo" maxlength="120" placeholder="Ex.: Quer um 1:1 de 20 minutos?" value="' + esc(pr.titulo || '') + '" style="' + inp + '">' +
    '<label for="prop-texto">Texto</label><textarea id="prop-texto" maxlength="1000" placeholder="O que você está propondo e por quê..." style="min-height:100px">' + esc(pr.texto || '') + '</textarea>' +
    '<label for="prop-sim">O que acontece se ela disser sim</label><textarea id="prop-sim" maxlength="500" placeholder="Ex.: Reservei quinta às 10h. Te mando o link da chamada por e-mail." style="min-height:70px">' + esc(pr.acao_sim || '') + '</textarea>' +
    '<label for="prop-link">Link (opcional, https)</label><input id="prop-link" type="url" maxlength="500" placeholder="https://..." style="' + inp + '">' +
    '<label for="prop-rotulo">Texto do link (opcional)</label><input id="prop-rotulo" maxlength="40" placeholder="Ex.: Ver horários" style="' + inp + '">' +
    '<label for="prop-prazo">Vale até (opcional)</label><input id="prop-prazo" type="date" style="' + inp + '"></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="proposta-send">Enviar no chat →</button></div>');
}

// ---------- Radar: o PESTEL por persona (db/crm-radar.sql) ----------
// O PESTEL do Cérebro é geral, por tema, e capta quem ainda não é cliente. Aqui ele vira particular: um item é um fato de
// um fator já traduzido para UMA persona. Você manda para a persona inteira ou para pessoas específicas (com uma nota
// sua); o item aparece na Home de quem tem conta e o aviso cai no sininho (sinais). Regra: o cliente recebe antes do
// post — por isso cada item mostra se algum cliente já foi avisado (avisado_em).
var FATORES = [['politico', 'Político', '🏛'], ['economico', 'Econômico', '💶'], ['social', 'Social', '👥'],
  ['tecnologico', 'Tecnológico', '💻'], ['ambiental', 'Ambiental', '🌱'], ['legal', 'Legal', '⚖️']];
var PERSONAS_RADAR = ['au_pair_estudante', 'campus_france', 'alternancia_emprego', 'conjuge', 'pvt'];
var RD = null, RE = {}, RS = null;   // RD: itens (null = SQL ainda não rodado) · RE: envios por item · RS: o envio em andamento
function fatorDe(k) { for (var i = 0; i < FATORES.length; i++) if (FATORES[i][0] === k) return FATORES[i]; return [k, k, '']; }
function noApp(persona) { return C.filter(function (c) { return c.persona === persona && c.user_id && c.estagio !== 'inativo'; }); }
function radarDaPersona(persona) { return (RD || []).filter(function (i) { return i.persona === persona; }); }
function radarSemAviso(itens) { return itens.filter(function (i) { return !i.avisado_em; }); }
function radarHoje() { return new Date().toISOString().slice(0, 10); }
function radarLinkSeguro(u) { return typeof u === 'string' && /^https:\/\//i.test(u) ? u : null; }

function renderRadarHoje() {
  var box = $('today-radar'); if (!box) return;
  if (RD === null) {
    box.innerHTML = '<div class="empty">O Radar ainda não está ligado: rode <b>crm-radar.sql</b> no Supabase.</div>';
    $('c-radar').hidden = true; return;
  }
  var total = 0;
  box.innerHTML = PERSONAS_RADAR.map(function (p) {
    var itens = radarDaPersona(p), sem = radarSemAviso(itens).length; total += sem;
    var pill = !itens.length ? '<span class="pill out">sem itens</span>' : sem ? '<span class="pill u-media"><span class="dot"></span>' + sem + ' sem aviso</span>' : '<span class="pill u-baixa"><span class="dot"></span>em dia</span>';
    return '<button class="row" data-radarabrir="' + p + '" type="button"><div class="who"><b>' + esc(PERSONAS[p]) + '</b><span>' + noApp(p).length + ' na plataforma · ' + itens.length + (itens.length === 1 ? ' item' : ' itens') + '</span></div>' + pill + '</button>';
  }).join('');
  $('c-radar').textContent = total; $('c-radar').hidden = total === 0;
}

function renderRadar() {
  var grid = $('radar-grid'); if (!grid) return;
  if (RD === null) {
    $('radar-personas').innerHTML = ''; $('radar-sub').textContent = '';
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">O Radar ainda não está ligado: rode <b>admin/crm/db/crm-radar.sql</b> no SQL Editor do Supabase e recarregue.</div>';
    return;
  }
  if (!state.rpersona) {
    var comPendencia = PERSONAS_RADAR.filter(function (p) { return radarSemAviso(radarDaPersona(p)).length; })[0];
    state.rpersona = comPendencia || 'campus_france';
  }
  var p = state.rpersona, itens = radarDaPersona(p), sem = radarSemAviso(itens).length;
  $('radar-personas').innerHTML = '<span class="lbl">Persona</span>' + PERSONAS_RADAR.map(function (k) {
    return '<button class="chip" data-radarpersona="' + k + '" aria-pressed="' + (k === p) + '" type="button">' + esc(PERSONAS[k]) + '</button>';
  }).join('');
  $('radar-sub').textContent = noApp(p).length + ' pessoas dessa persona na plataforma · ' + itens.length + (itens.length === 1 ? ' item' : ' itens') +
    (sem ? ' · ' + sem + ' ainda sem nenhum cliente avisado (o post só depois: o cliente recebe primeiro)' : '');
  var hoje = radarHoje();
  grid.innerHTML = FATORES.map(function (f) {
    var doFator = itens.filter(function (i) { return i.fator === f[0]; });
    return '<div class="radar-col"><h3><span aria-hidden="true">' + f[2] + '</span>' + esc(f[1]) + '<span class="n num">' + doFator.length + '</span></h3>' +
      (doFator.map(function (i) {
        var env = RE[i.id], fonte = radarLinkSeguro(i.fonte_url), venc = i.vigente_ate && i.vigente_ate < hoje;
        return '<div class="radar-card"><b>' + esc(i.titulo) + '</b><p>' + esc(i.texto) + '</p>' +
          (i.impacto ? '<p><b>Para ela:</b> ' + esc(i.impacto) + '</p>' : '') + (i.acao ? '<p><b>O que fazer:</b> ' + esc(i.acao) + '</p>' : '') +
          '<div class="meta">Verificado em ' + esc(fmtDay(i.verificado_em)) + (i.fonte_rotulo ? ' · ' + (fonte ? '<a href="' + esc(fonte) + '" target="_blank" rel="noopener">' + esc(i.fonte_rotulo) + '</a>' : esc(i.fonte_rotulo)) : '') +
          (venc ? ' · <b style="color:var(--red)">vigência encerrada</b>' : i.vigente_ate ? ' · vale até ' + esc(fmtDay(i.vigente_ate)) : '') + (i.origem === 'cerebro' ? ' · do Cérebro' : '') + '</div>' +
          (env ? '<span class="radar-ok">Enviado a ' + env.enviados + ' · ' + env.vistos + (env.vistos === 1 ? ' viu' : ' viram') + '</span>' : '<span class="radar-aviso">Nenhum cliente avisado ainda</span>') +
          '<div class="acts"><button class="btn primary" type="button" data-radarenviar="' + i.id + '">Enviar</button><button class="link" type="button" data-radararquivar="' + i.id + '">Arquivar</button></div></div>';
      }).join('') || '<div class="radar-vazio">Nada neste fator.</div>') +
      '<button class="link" type="button" data-radarnovo="1" data-radarfator="' + f[0] + '">+ Adicionar</button></div>';
  }).join('');
}

var RADAR_INP = 'width:100%;border:1px solid var(--line-2);border-radius:var(--r);background:var(--surface-2);padding:10px 12px';
function radarForm(persona, fator) {
  if (RD === null) return toast('Rode o crm-radar.sql no Supabase primeiro');
  persona = persona || state.rpersona || 'campus_france'; fator = fator || 'politico';
  var opt = function (lista, atual) { return lista.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === atual ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
  modalOpen('<h3>Novo item do Radar</h3><p class="sub" style="margin-top:6px">Um fato, traduzido para uma persona. Quem recebe vê exatamente isto, com a fonte e a data.</p>' +
    '<div class="reply" style="margin-top:10px">' +
    '<label for="rd-persona">Persona</label><select id="rd-persona" style="' + RADAR_INP + '">' + opt(PERSONAS_RADAR.map(function (k) { return [k, PERSONAS[k]]; }), persona) + '</select>' +
    '<label for="rd-fator">Fator</label><select id="rd-fator" style="' + RADAR_INP + '">' + opt(FATORES.map(function (f) { return [f[0], f[2] + ' ' + f[1]]; }), fator) + '</select>' +
    '<label for="rd-titulo">Título (o que mudou, em uma linha)</label><input id="rd-titulo" maxlength="120" placeholder="Ex.: Recursos mínimos do visto subiram" style="' + RADAR_INP + '">' +
    '<label for="rd-texto">O que mudou</label><textarea id="rd-texto" maxlength="600" style="min-height:80px" placeholder="O fato, com número e data."></textarea>' +
    '<label for="rd-impacto">O que isso muda para essa persona (opcional)</label><textarea id="rd-impacto" maxlength="400" style="min-height:60px"></textarea>' +
    '<label for="rd-acao">O que fazer (opcional)</label><textarea id="rd-acao" maxlength="300" style="min-height:50px"></textarea>' +
    '<label for="rd-fonte-rotulo">Fonte (nome)</label><input id="rd-fonte-rotulo" maxlength="80" placeholder="Ex.: Decreto 2026-526" style="' + RADAR_INP + '">' +
    '<label for="rd-fonte-url">Fonte (link https)</label><input id="rd-fonte-url" type="url" maxlength="500" placeholder="https://..." style="' + RADAR_INP + '">' +
    '<label for="rd-verificado">Conferido na fonte em</label><input id="rd-verificado" type="date" value="' + radarHoje() + '" style="' + RADAR_INP + '">' +
    '<label for="rd-vigente">Vale até (opcional)</label><input id="rd-vigente" type="date" style="' + RADAR_INP + '"></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="radar-salvar">Salvar e escolher a quem enviar →</button></div>');
}
async function radarSalvar(btn) {
  var v = function (id) { return $(id).value.trim(); };
  var titulo = v('rd-titulo'), texto = v('rd-texto'), url = v('rd-fonte-url');
  if (!titulo || !texto) return toast('Preencha o título e o que mudou');
  if (url && !/^https:\/\//i.test(url)) return toast('O link da fonte precisa começar com https://');
  btn.disabled = true;
  var r = await supabase.from('radar_itens').insert({
    persona: v('rd-persona'), fator: v('rd-fator'), titulo: titulo, texto: texto, impacto: v('rd-impacto') || null, acao: v('rd-acao') || null,
    fonte_rotulo: v('rd-fonte-rotulo') || null, fonte_url: url || null, verificado_em: v('rd-verificado') || radarHoje(), vigente_ate: v('rd-vigente') || null
  }).select('id,persona').single();
  if (r.error) { btn.disabled = false; return fail('salvar o item', r.error); }
  state.rpersona = r.data.persona;
  await reload(); if (state.view === 'radar') renderRadar();
  radarEnviarForm(r.data.id);
}
async function radarArquivar(id) {
  var i = (RD || []).filter(function (x) { return x.id === id; })[0]; if (!i) return;
  if (!window.confirm('Arquivar "' + i.titulo + '"? Ele some da Home de quem já recebeu.')) return;
  var r = await supabase.from('radar_itens').update({ arquivado_em: new Date().toISOString() }).eq('id', id);
  if (r.error) return fail('arquivar o item', r.error);
  await reload(); renderRadar(); toast('Item arquivado');
}
function radarRotuloEnviar() {
  if (!RS) return 'Enviar';
  var i = (RD || []).filter(function (x) { return x.id === RS.item; })[0]; if (!i) return 'Enviar';
  var ja = (RE[i.id] || { contatos: {} }).contatos;
  var n = RS.modo === 'todos' ? noApp(i.persona).filter(function (c) { return !ja[c.id]; }).length : Object.keys(RS.sel).length;
  return 'Enviar para ' + n + (n === 1 ? ' pessoa' : ' pessoas') + ' →';
}
function radarEnviarForm(id, manter) {
  var i = (RD || []).filter(function (x) { return x.id === id; })[0]; if (!i) return;
  var notaAtual = manter && $('radar-nota') ? $('radar-nota').value : '';
  if (!manter || !RS || RS.item !== id) RS = { item: id, modo: 'todos', sel: {} };
  var pessoas = noApp(i.persona), ja = (RE[id] || { contatos: {} }).contatos, f = fatorDe(i.fator);
  var lista = pessoas.length ? pessoas.map(function (c) {
    var recebeu = !!ja[c.id];
    return '<label class="' + (recebeu ? 'off' : '') + '"><input type="checkbox" data-radarsel="' + esc(c.id) + '"' + (recebeu ? ' disabled' : '') + (RS.sel[c.id] ? ' checked' : '') + '> ' + esc(displayName(c)) + (recebeu ? ' <span class="sub">· já recebeu</span>' : '') + '</label>';
  }).join('') : '<div class="radar-vazio" style="padding:10px">Ninguém dessa persona tem conta ainda.</div>';
  modalOpen('<h3>Enviar para quem está na plataforma</h3>' +
    '<div class="ctx" style="margin-top:10px"><span class="pill out">' + f[2] + ' ' + esc(f[1]) + ' · ' + esc(PERSONAS[i.persona]) + '</span></div>' +
    '<p style="margin:8px 0 0"><b>' + esc(i.titulo) + '</b></p>' +
    '<p class="sub" style="margin-top:6px">Aparece na seção "Radar do seu caso" da Home e avisa no sininho. Quem já recebeu não recebe de novo.</p>' +
    '<div class="seg" role="group" aria-label="Para quem" style="margin-top:12px"><button type="button" data-radarmodo="todos" aria-pressed="' + (RS.modo === 'todos') + '">A persona inteira (' + pessoas.length + ')</button>' +
    '<button type="button" data-radarmodo="escolher" aria-pressed="' + (RS.modo === 'escolher') + '">Escolher pessoas</button></div>' +
    (RS.modo === 'escolher' ? '<div class="radar-pessoas">' + lista + '</div>' : '') +
    '<div class="reply" style="margin-top:12px"><label for="radar-nota">Uma nota sua para quem receber (opcional)</label><textarea id="radar-nota" maxlength="300" style="min-height:60px" placeholder="Ex.: Isso muda a sua conta — vamos olhar juntas no 1:1?">' + esc(notaAtual) + '</textarea></div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Agora não</button><button class="btn primary" type="button" id="radar-enviar-go">' + radarRotuloEnviar() + '</button></div>');
}
async function radarEnviar(btn) {
  if (!RS) return;
  var contatos = RS.modo === 'todos' ? null : Object.keys(RS.sel);
  if (contatos && !contatos.length) return toast('Escolha pelo menos uma pessoa');
  btn.disabled = true;
  var r = await supabase.rpc('radar_enviar', { p_item: RS.item, p_contatos: contatos, p_nota: ($('radar-nota').value || '').trim() || null });
  if (r.error) { btn.disabled = false; return fail('enviar o item', r.error); }
  closeCompose(); RS = null;
  await reload(); if (state.view === 'radar') renderRadar();
  toast(r.data === 0 ? 'Ninguém novo para receber' : 'Enviado a ' + r.data + (r.data === 1 ? ' pessoa' : ' pessoas') + ' — o aviso já está no sininho');
}

// ---------- Modelos de e-mail: o estúdio (Estúdio de e-mails, entregas 1 e 2) ----------
// Três colunas, no padrão do estúdio de produtos do admin: os modelos · o editor em seções · a prévia com uma pessoa
// de verdade. O texto é feito de blocos (estudio.js monta o assunto, o texto puro e o HTML) e fica na versão do modelo
// (modelos_email_versoes). Rascunho e Revisão só aparecem aqui e no teste para você; o que sai é a versão No ar: os
// 2 automáticos pelo Worker e os 8 manuais pelo "Escrever este e-mail" da ficha (o texto vem daqui, com TPLS de reserva).
// Sem a migração da entrega 1, a tela mostra os 8 do código; sem a da entrega 2, mostra tudo sem editar.
var TIPO_EMAIL = { servico: ['Serviço', 'u-baixa'], novidades: ['Novidades', 'u-media'], compra: ['Compra', 'tp-pergunta'] };
var ETAPA_EMAIL = { rascunho: ['Rascunho', ''], revisao: ['Revisão', 'u-media'], no_ar: ['No ar', 'u-baixa'], arquivado: ['Arquivado', 'out'] };
var ST = { k: null, v: null, blk: null, sec: 'texto', who: null, q: '', dev: 'pc', marcar: true, modo: 'editar', tab: 'editar', d: null, dKey: null, montado: null, vistos: {}, foco: null, salvo: '', timer: null };
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
function modeloDe(k) { return (M || []).filter(function (x) { return x.chave === k; })[0] || null; }
function dadosPara(k, c) { return ES.dadosDe(k, c, ajudantes(), modeloDe(k)); }
function varsDe(k) { return ES.varsDoModelo(k, modeloDe(k)); }

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
  var lista = M ? M.filter(function (m) { return !m.excluido_em; }) : TPL_ORDER.map(function (k) { return { chave: k, nome: TPLS[k].label, objetivo: TPLS[k].when, automatico: false, tipo: EXIGEM_NOVIDADES[k] ? 'novidades' : 'servico' }; });
  if (!ST.k || !lista.some(function (m) { return m.chave === ST.k; })) { if (lista.length) abrirModelo(lista[0].chave); }
  else if (ST.v != null && !versaoAberta() && M) abrirModelo(ST.k);
  renderLista(lista);
  if (ST.criar && temEstudio3()) renderCriar(); else { ST.criar = null; renderEditor(lista); }
  renderPrevia();
}

function renderLista(lista) {
  var card = function (m) {
    var v = M ? versaoAtual(m.chave) : null, obra = M ? versaoEmObra(m.chave) : null;
    var dot = !v ? 'dr' : obra ? (obra.etapa === 'revisao' ? 'rev' : 'dr') : v.etapa === 'no_ar' ? 'ok' : 'dr';
    var linha = !M ? 'Texto do código' : (m.automatico ? 'Sai sozinho · ' : '') + etapaTxt(v) + (obra && obra !== v ? ' · ' + etapaTxt(obra).toLowerCase() : '') +
      (m.criado_no_estudio && m.envio_gatilho ? ' · envio ' + (m.envio_ligado ? 'ligado' : 'desligado') : '');
    return '<div class="st-card"><button class="st-item" data-tpl-pick="' + esc(m.chave) + '" aria-pressed="' + (!ST.criar && ST.k === m.chave) + '" type="button"><span class="sdot ' + dot + '"></span><span><b>' + esc(m.nome) + '</b>' +
      '<span>' + esc(linha) + '</span></span></button>' +
      (podeExcluir(m) ? '<button class="st-x" type="button" data-stexcluir="' + esc(m.chave) + '" aria-label="Excluir ' + esc(m.nome) + '" title="Excluir">×</button>' : '') + '</div>';
  };
  var exc = (M || []).filter(function (m) { return m.excluido_em; });
  var lixo = exc.length ? '<details class="st-excl"><summary class="tplgrp">Excluídos · ' + exc.length + '</summary>' + exc.map(function (m) {
    return '<div class="st-excl-i"><span><b>' + esc(m.nome) + '</b><span class="sub">excluído em ' + esc(fmtDay(m.excluido_em)) + '</span></span>' +
      '<button class="btn" type="button" data-strestaurar="' + esc(m.chave) + '">Restaurar</button></div>';
  }).join('') + '</details>' : '';
  var grupo = function (g) {
    var aberta = !CAT_FECHADA[g.k] || g.itens.some(function (m) { return !ST.criar && m.chave === ST.k; });
    return '<details class="st-cat" data-cat="' + g.k + '"' + (aberta ? ' open' : '') + '><summary class="tplgrp">' + esc(g.nome) + ' · ' + g.itens.length + '</summary>' + g.itens.map(card).join('') + '</details>';
  };
  $('mod-list').innerHTML = (temEstudio3() ? '<button class="st-new" type="button" id="st-novo-modelo" aria-pressed="' + !!ST.criar + '">+ Modelo novo</button>' : '') + porCategoria(lista).map(grupo).join('') + lixo +
    '<div class="st-legend"><span><i class="sdot ok"></i>No ar</span><span><i class="sdot rev"></i>Em revisão</span><span><i class="sdot dr"></i>Rascunho</span></div>';
}

// Os e-mails 1 e 2 do guia Campus France saem pelo código: excluir aqui não pararia o envio, então não têm o X.
function podeExcluir(m) { return !!(M && M.length && Object.prototype.hasOwnProperty.call(M[0], 'excluido_em')) && !/^cf_guia_/.test(m.chave); }
async function excluirModelo(k, voltar) {
  var m = modeloDe(k); if (!m) return;
  if (!voltar && !window.confirm('Excluir "' + m.nome + '"? Ele sai da lista e do "Escrever e-mail"' + (m.envio_ligado ? ' e a sequência para de sair' : '') +
    '. As versões ficam guardadas em "Excluídos", no fim da lista, onde dá para restaurar.')) return;
  await salvar();
  var r = await supabase.from('modelos_email').update({ excluido_em: voltar ? null : new Date().toISOString() }).eq('chave', k).select();
  if (r.error) return fail(voltar ? 'restaurar o modelo' : 'excluir o modelo', r.error);
  Object.assign(m, (r.data && r.data[0]) || { excluido_em: voltar ? null : new Date().toISOString() });
  if (!voltar && ST.k === k) ST.k = null;
  if (voltar) { ST.k = k; abrirModelo(k); }
  toast(voltar ? '"' + m.nome + '" restaurado' + (m.envio_gatilho ? ' (com o Envio desligado)' : '') : '"' + m.nome + '" excluído', 3200);
  renderModelos();
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
function varsDoTipo(k, t) { return varsDe(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].t === t; }); }

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
    var comUrl = !!String(b.url || '').trim();
    corpo = campoTxt(f('rotulo'), b.rotulo, 'O que está escrito no botão', { ro: ro, max: 80 }) +
      campoTxt(f('url'), b.url, 'Link do botão (cole o endereço inteiro)', { ro: ro, ph: 'https://…', max: 1000, dica: 'Para uma página pública. Links privados (Notion, acesso da pessoa) saem do menu abaixo.' }) +
      (comUrl ? '<p class="st-msg">Este botão usa o endereço colado acima. Apague-o para usar um link do sistema.</p>'
        : '<label class="st-fld"><span>Ou use um link do sistema</span><select class="st-in" data-f="' + f('link') + '"' + dis + '>' + opcoes(links, b.link, links.length ? 'Escolha o link' : 'Este modelo não tem link') + '</select>' +
          '<small>Vem do banco na hora do envio (cada pessoa tem o seu): nunca é digitado.</small></label>' +
          (b.link ? campoTxt(f('complemento'), b.complemento, 'Final do link, para medir cliques (opcional)', { ro: ro, ph: '&utm_source=email&utm_campaign=…', max: 200 }) : ''));
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
    var etapas = varsDe(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].etapa; });
    corpo = '<label class="st-fld"><span>Só para quem está na etapa</span><select class="st-in" data-f="' + f('se') + '"' + dis + '>' +
      opcoes(etapas.map(function (x) { return ['#' + x, ES.CAT[x].o.replace(/^etapa do guia: /, '')]; }), b.se, etapas.length ? 'Escolha a etapa' : 'Este modelo não tem etapa') + '</select></label>' +
      campoTxt(f('rotulo'), b.rotulo, 'Linha pequena de cima (opcional)', { ro: ro }) + campoTxt(f('titulo'), b.titulo, 'Frase em negrito (opcional)', { ro: ro }) +
      campoTxt(f('texto'), b.texto, 'Texto', { area: true, rows: 3, ro: ro, max: 3000 });
  } else {
    corpo = campoTxt(f('texto'), b.texto, 'Assinatura', { ro: ro });
  }
  // "Mostrar só se…": vale para todo bloco, menos o de etapa (que já é condição).
  if (b.tipo !== 'etapa') {
    var cond = varsDe(k).filter(function (x) { return ES.CAT[x] && (ES.CAT[x].t === 'texto' || ES.CAT[x].t === 'sim'); });
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
  return '<div class="st-chips"><span class="sub">Inserir dado:</span>' + varsDe(k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].t !== 'sim' && ES.CAT[x].t !== 'pronto' && !/^link_/.test(x); })
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
  var novoM = !!m.criado_no_estudio, objM = novoM ? ES.objetivo(m.objetivo_chave) : null;
  var s1 = novoM ? '<label class="st-fld"><span>Objetivo</span><textarea class="st-in" id="st-objetivo" rows="2" maxlength="300">' + esc(m.objetivo) + '</textarea></label>' +
    '<dl class="tplmeta"><dt>Do catálogo</dt><dd>' + esc(objM ? objM.nome : '—') + '</dd><dt>Tipo</dt><dd>' + pillDe(TIPO_EMAIL, m.tipo) + ' <span class="sub">' + esc(ES.TIPO_RODAPE[m.tipo] || '') + '</span></dd></dl>' +
    envioHtml(m) : '<label class="st-fld"><span>Objetivo</span><textarea class="st-in" id="st-objetivo" rows="2" maxlength="300">' + esc(m.objetivo) + '</textarea></label>' +
    '<dl class="tplmeta"><dt>Tipo</dt><dd>' + pillDe(TIPO_EMAIL, m.tipo) + ' <span class="sub">' + esc(ES.TIPO_RODAPE[m.tipo] || '') + '</span></dd>' +
    '<dt>Como sai</dt><dd>' + esc(m.como_sai) + '</dd></dl>' +
    '<p class="st-msg tip">Quem recebe e quando continuam no código: o Worker confere o aceite de novidades a cada envio, mesmo que alguém mude o texto aqui.</p>';
  // 2. Para quem
  var s2 = novoM ? paraQuemHtml(m.para_quem, 'data-pq', objM || { produto: !!(m.para_quem || {}).produto }, true) +
    '<p class="st-msg tip">' + esc(m.tipo === 'novidades' ? 'E só quem aceitou novidades (o tipo garante).' : 'Serviço e compra saem para quem cumprir as regras, sem pedir novidades.') + '</p>'
    : '<dl class="tplmeta"><dt>Quem recebe</dt><dd>' + esc(m.quem_recebe || 'Todos') + '</dd>' +
    (k.indexOf('cf_') === 0 ? '<dt>Material</dt><dd>Guia Études en France 2027-2028</dd>' : k.indexOf('guia_') === 0 ? '<dt>Material</dt><dd>' + esc(k === 'guia_alternancia' ? 'Guia alternância 30+' : 'Guia VLS-TS') + '</dd>' : '') +
    (m.automatico ? '' : '<dt>Sugerido</dt><dd>' + esc((TPLS[k] && TPLS[k].when) || '—') + '</dd>') + '</dl>';
  // 3. Contexto da pessoa: cada dado, o que é e o que acontece se faltar (o plano B)
  var s3 = varsDe(k).map(function (x) {
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
    (novoM && m.envio_gatilho ? '<p class="st-msg tip">Sequência: ao publicar, ' + (m.envio_ligado ? 'o próximo envio já sai com este texto.' : 'ligue o Envio (em Objetivo e envio) para começar a sair.') + '</p>'
    : m.automatico ? '<p class="st-msg tip">Saem sozinhos: ao publicar, o próximo envio já sai com este texto. A versão de agora fica guardada.</p>' : '<p class="st-msg tip">Ao publicar, o "Escrever este e-mail" da ficha passa a abrir com este texto (os manuais saem em texto simples, como hoje).</p>')
    : '<p class="st-msg tip">Crie uma versão nova para montar em blocos e conferir.</p>';
  // 6. Versões
  var s6 = '<ul class="st-vers">' + vs.map(function (x) {
    var quando = x.etapa === 'no_ar' ? 'no ar desde ' + fmtDay(x.publicado_em) : x.publicado_em ? 'saiu em ' + fmtDay(x.publicado_em) : 'criada em ' + fmtDay(x.criado_em);
    return '<li' + (x.versao === ST.v ? ' aria-current="true"' : '') + '><button type="button" class="st-verbtn" data-stver="' + x.versao + '"><b>v' + x.versao + '</b> ' + pillDe(ETAPA_EMAIL, x.etapa) +
      '<span class="sub">' + esc(quando) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span></button>' +
      (x.etapa === 'arquivado' && temBlocos() ? '<button type="button" class="btn" data-stvoltar="' + x.versao + '">Voltar para esta</button>' : '') + '</li>';
  }).join('') + '</ul>';

  var dica3 = varsDe(k).length + ' dados', dica4 = d ? (d.itens || []).length + ' blocos' : 'texto corrido';
  var dica5 = d ? (travas ? travas + ' para resolver' : testado ? 'tudo certo' : 'falta o teste') : '—';
  box.innerHTML = topo +
    secao('obj', 'Objetivo e envio', novoM && m.envio_gatilho ? (m.envio_ligado ? 'sequência · ligada' : 'sequência · desligada') : m.automatico ? 'sai sozinho' : 'você envia', s1) +
    secao('para', 'Para quem', novoM ? paraResumo(m) : m.quem_recebe || 'Todos', s2) +
    secao('ctx', 'Contexto da pessoa', dica3, s3) +
    secao('texto', 'Texto', dica4, s4) +
    secao('pronto', 'Pronto para usar?', dica5, s5) +
    secao('versoes', 'Versões', vs.length + (vs.length === 1 ? ' versão' : ' versões'), s6);
}

// ---------- Modelo novo pelo objetivo e a parte Envio (entrega 3) ----------
// "+ Modelo novo" abre os 4 passos da proposta: objetivo (o catálogo em estudio.js: tipo, como sai e esqueleto), para quem,
// o contexto da pessoa e o esqueleto. Criar grava o modelo (criado_no_estudio) e a versão 1 em rascunho com os blocos do
// esqueleto; daí em diante ele é editado, testado e publicado como os outros. A parte Envio (sequência) e o "Para quem"
// ficam no próprio modelo (modelos_email): o banco confere as regras e o Worker manda de hora em hora (README, seção 23).
var temEstudio3 = function () { return !!(M && M.length && Object.prototype.hasOwnProperty.call(M[0], 'criado_no_estudio')); };
var HORAS = []; for (var hh = 0; hh < 24; hh++) HORAS.push([String(hh), 'às ' + hh + 'h (Brasília)']);
var GATILHO = { email: 'Depois de um e-mail', material: 'Depois de pegar um material', compra: 'Depois da compra' };
function paraVazio() { return { personas: [], materiais: [], etapas: [], segmentos: [], estagios: [] }; }
// Os materiais (guias) que já trouxeram alguém: os rótulos conhecidos e as origens guia-* da base.
function materiaisConhecidos() {
  var l = Object.keys(ORIG).filter(function (k) { return /^guia-/.test(k); });
  C.forEach(function (c) { origensDe(c).forEach(function (o) { if (/^guia-/.test(o) && l.indexOf(o) < 0) l.push(o); }); });
  return l.map(function (k) { return [k, origLabel(k)]; });
}
function chaveNova(nome) {
  var b = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+/, '').slice(0, 32).replace(/_+$/, '') || 'modelo';
  if (b.length < 2) b = 'modelo_' + b;
  var k = b, n = 2;
  while ((M || []).some(function (m) { return m.chave === k; })) k = b.slice(0, 36) + '_' + (n++);
  return k;
}
// O "Para quem": as regras de quem pode receber. attr = data-novopara (passos) ou data-pq (modelo já criado).
function paraQuemHtml(para, attr, obj, produtoFixo) {
  para = para || {};
  var marca = function (grupo, k) { return (para[grupo] || []).indexOf(k) >= 0 ? ' checked' : ''; };
  var grupo = function (titulo, g, itens, dica) {
    return '<fieldset class="st-pq"><legend>' + esc(titulo) + '</legend><div class="st-pq-op">' + itens.map(function (o) {
      return '<label class="st-check"><input type="checkbox" ' + attr + '="' + g + '" value="' + esc(o[0]) + '"' + marca(g, o[0]) + '> ' + esc(o[1]) + '</label>';
    }).join('') + '</div>' + (dica ? '<small>' + esc(dica) + '</small>' : '') + '</fieldset>';
  };
  var prod = '';
  if (obj && obj.produto) {
    prod = produtoFixo ? '<dl class="tplmeta"><dt>Produto</dt><dd>' + esc(para.produto_nome || produtoNome(para.produto)) + ' <span class="sub">só quem comprou (fica fixo depois de criado)</span></dd></dl>'
      : '<label class="st-fld"><span>Produto (só quem comprou)</span><select class="st-in" ' + attr + '="produto">' + opcoes(PRODUTOS.map(function (p) { return [p.slug, p.nome]; }), para.produto, 'Escolha o produto') + '</select>' +
        (PRODUTOS.length ? '' : '<small>Não consegui ler a lista de produtos do site.</small>') + '</label>';
  }
  return prod +
    grupo('Persona', 'personas', Object.keys(PERSONAS).filter(function (k) { return k !== 'sem'; }).map(function (k) { return [k, PERSONAS[k]]; }), 'Nenhuma marcada = todas.') +
    grupo('Material de origem', 'materiais', materiaisConhecidos(), 'Só quem pegou um destes guias. Nenhum = qualquer origem.') +
    grupo('Etapa do guia', 'etapas', ES.ETAPAS_GUIA, 'Só quem marcou uma destas etapas no guia. Nenhuma = qualquer etapa (quem não marcou etapa também recebe).') +
    grupo('Estágio', 'estagios', STAGES.map(function (x) { return [x.k, x.l]; }), 'Nenhum = qualquer estágio.') +
    grupo('Segmento do reimpacto', 'segmentos', SEGMENTS.map(function (x) { return [x.k, x.t]; }), 'Nenhum = sem regra de segmento.');
}
function paraResumo(m) {
  var p = m.para_quem || {}, r = [];
  if (p.produto) r.push('comprou ' + (p.produto_nome || produtoNome(p.produto)));
  if ((p.personas || []).length) r.push(p.personas.map(function (k) { return PERSONAS[k] || k; }).join(' ou '));
  if ((p.materiais || []).length) r.push('pegou ' + p.materiais.map(origLabel).join(' ou '));
  if ((p.etapas || []).length) r.push('etapa ' + p.etapas.map(etapaGuiaLabel).join(' ou '));
  if ((p.estagios || []).length) r.push('estágio ' + p.estagios.map(stageLabel).join(' ou '));
  if ((p.segmentos || []).length) r.push('segmento ' + p.segmentos.join(' ou '));
  if (m.tipo === 'novidades') r.push('aceitou novidades');
  return r.length ? r.join(' · ') : 'Todos';
}
function etapaGuiaLabel(k) { var e = ES.ETAPAS_GUIA.filter(function (x) { return x[0] === k; })[0]; return e ? e[1].replace(/^[^:]+: /, '') : k; }
function mudarPara(para, g, valor, ligado) {
  if (g === 'produto') { para.produto = valor || undefined; para.produto_nome = valor ? produtoNome(valor) : undefined; if (!valor) { delete para.produto; delete para.produto_nome; } return; }
  var l = para[g] = (para[g] || []).slice(), i = l.indexOf(valor);
  if (ligado && i < 0) l.push(valor); if (!ligado && i >= 0) l.splice(i, 1);
}

// Os 4 passos.
function renderCriar() {
  var box = $('st-edit'), cr = ST.criar, o = cr.obj ? ES.objetivo(cr.obj) : null;
  var passos = ['Objetivo', 'Para quem', 'Contexto da pessoa', 'Esqueleto'];
  var topo = '<div class="st-head"><div class="st-head-t"><h3 class="st-title">Modelo novo' + (o ? ' · ' + esc(o.nome) : '') + '</h3>' +
    '<ol class="st-passos">' + passos.map(function (p, i) { return '<li' + (cr.passo === i + 1 ? ' aria-current="step"' : cr.passo > i + 1 ? ' class="feito"' : '') + '><b>' + (i + 1) + '</b> ' + esc(p) + '</li>'; }).join('') + '</ol></div>' +
    '<div class="st-acts"><button class="btn" type="button" id="novo-cancelar">Cancelar</button></div></div>';
  var corpo = '', pode = true;
  if (cr.passo === 1) {
    corpo = '<p class="st-msg tip">O objetivo decide o tipo (e com ele quem pode receber e o rodapé), como sai e um esqueleto de blocos para você escrever.</p>' +
      '<div class="st-objs">' + ES.OBJETIVOS.map(function (x) {
        return '<button type="button" class="st-obj" data-novoobj="' + x.k + '" aria-pressed="' + (cr.obj === x.k) + '"><b>' + esc(x.nome) + '</b><span>' + esc(x.d) + '</span>' +
          '<span class="st-pills">' + pillDe(TIPO_EMAIL, x.tipo) + '<span class="pill">' + (x.sai === 'sequencia' ? 'sai sozinho (sequência)' : 'você envia') + '</span></span></button>';
      }).join('') + '</div>';
    pode = !!o;
  } else if (cr.passo === 2) {
    pode = !!cr.nome.trim() && (!o.produto || !!cr.para.produto);
    corpo = '<label class="st-fld"><span>Nome do modelo (só você vê)</span><input class="st-in" id="novo-nome" maxlength="120" value="' + esc(cr.nome) + '"></label>' +
      '<p class="st-msg tip">' + esc(ES.TIPO_RODAPE[o.tipo]) + '</p>' + paraQuemHtml(cr.para, 'data-novopara', o, false);
  } else if (cr.passo === 3) {
    var fake = { chave: '_novo', criado_no_estudio: true, tipo: o.tipo, para_quem: cr.para };
    corpo = '<p class="st-msg tip">O que o e-mail pode usar dela. O plano B de cada dado (o que aparece se faltar) você ajusta depois, em Contexto da pessoa.</p>' +
      ES.varsDoModelo('_novo', fake).map(function (x) {
        var c = ES.CAT[x] || { o: x };
        return '<div class="st-var"><code>{' + esc(x) + '}</code><span>' + esc(c.o) + '</span><small>' + (c.t === 'link' ? (c.privado ? 'Link privado, vem do Worker. ' : '') + 'Sem ele, não sai.' : c.t === 'sim' ? 'Sim ou não, para "Mostrar só se…".' : c.t === 'fixo' ? 'Sempre existe.' : c.plano == null ? 'Se faltar, o bloco some.' : 'Se faltar: "' + c.plano + '".') + '</small></div>';
      }).join('');
  } else {
    var d = ES.esqueleto(o.k);
    corpo = '<dl class="tplmeta"><dt>Tipo</dt><dd>' + pillDe(TIPO_EMAIL, o.tipo) + '</dd><dt>Quem recebe</dt><dd>' + esc(paraResumo({ tipo: o.tipo, para_quem: cr.para })) + '</dd>' +
      '<dt>Como sai</dt><dd>' + esc(o.sai === 'sequencia' ? 'Sozinho, pela parte Envio: ' + GATILHO[o.gatilho].toLowerCase() + ', ' + o.dias + (o.dias === 1 ? ' dia' : ' dias') + ', às ' + o.hora + 'h. Você confere e liga depois de publicar.' : 'Você envia, pela ficha.') + '</dd>' +
      '<dt>Rodapé</dt><dd>' + esc((ES.rodapeDe(d, o.tipo) || 'Sem rodapé.').replace('{produto}', cr.para.produto_nome || 'produto').replace('{email}', 'o e-mail dela')) + '</dd></dl>' +
      (o.aviso ? '<p class="st-msg warn">' + esc(o.aviso) + '</p>' : '') +
      '<div class="st-blks">' + d.itens.map(function (b) { return '<div class="st-blk"><div class="st-blk-h"><span class="st-blk-t"><b>' + esc((ES.TIPOS[b.tipo] || {}).nome || b.tipo) + '</b><span>' + esc(String(b.texto || b.rotulo || b.titulo || '').slice(0, 70)) + '</span></span></div></div>'; }).join('') + '</div>' +
      '<p class="st-msg tip">Os [trechos entre colchetes] são para você escrever. Um modelo que sai sozinho não publica com eles.</p>';
  }
  var nav = '<div class="st-acts" style="justify-content:space-between">' + (cr.passo > 1 ? '<button class="btn" type="button" data-novopasso="' + (cr.passo - 1) + '">← Voltar</button>' : '<span></span>') +
    (cr.passo < 4 ? '<button class="btn primary" type="button" id="novo-seguir" data-novopasso="' + (cr.passo + 1) + '"' + (pode ? '' : ' disabled') + '>Continuar →</button>'
      : '<button class="btn primary" type="button" id="novo-criar">Criar o modelo (rascunho)</button>') + '</div>';
  box.innerHTML = topo + '<div class="st-sec is-open"><div class="st-sec-in" style="padding-top:14px">' + corpo + '</div></div>' + nav;
}
function criarPode() {
  var cr = ST.criar, o = cr && ES.objetivo(cr.obj), b = $('novo-seguir');
  if (b && cr.passo === 2) b.disabled = !(cr.nome.trim() && (!o.produto || cr.para.produto));
}
async function criarModelo(btn) {
  var cr = ST.criar, o = ES.objetivo(cr.obj), nome = cr.nome.trim();
  if (!o || !nome) return;
  btn.disabled = true; btn.textContent = 'Criando…';
  var chave = chaveNova(nome), para = JSON.parse(JSON.stringify(cr.para));
  ['personas', 'materiais', 'etapas', 'segmentos', 'estagios'].forEach(function (g) { if (!(para[g] || []).length) delete para[g]; });
  var fake = { chave: chave, criado_no_estudio: true, tipo: o.tipo, para_quem: para };
  var linha = { chave: chave, nome: nome, objetivo: o.nome + ': ' + o.d, tipo: o.tipo, quem_recebe: paraResumo(fake), criado_no_estudio: true, objetivo_chave: o.k,
    para_quem: para, ordem: 500, como_sai: o.sai === 'sequencia' ? 'Sozinho, pela parte Envio (sequência).' : 'Você envia, pela ficha.',
    variaveis: ES.varsDoModelo(chave, fake).map(function (x) { var c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; }) };
  if (o.sai === 'sequencia') {
    linha.envio_gatilho = o.gatilho; linha.envio_dias = o.dias; linha.envio_hora = o.hora;
    linha.envio_depois_de = o.gatilho === 'compra' ? para.produto : o.gatilho === 'material' ? ((para.materiais || [])[0] || null) : (modeloDe(o.depois_de) ? o.depois_de : null);
  }
  var d = ES.esqueleto(o.k), mt = ES.montar(d, o.tipo);
  var r1 = await supabase.from('modelos_email').insert(linha);
  if (r1.error) { btn.disabled = false; btn.textContent = 'Criar o modelo (rascunho)'; return fail('criar o modelo', r1.error); }
  var r2 = await supabase.from('modelos_email_versoes').insert({ chave: chave, versao: 1, etapa: 'rascunho', assunto: mt.assunto, preheader: mt.preheader, corpo_texto: mt.corpo_texto,
    corpo_html: mt.corpo_html, blocos: d, nota: 'criada pelo objetivo ' + o.nome });
  if (r2.error) return fail('criar a versão 1', r2.error);
  ST.criar = null; ST.k = chave; ST.sec = 'texto'; ST.blk = null;
  await recarregarModelos(1);
  toast('Modelo criado em rascunho. Escreva os [trechos], confira na prévia e mande o teste.', 5000);
}

// A parte Envio de um modelo novo (dentro de "Objetivo e envio").
function envioHtml(m) {
  var seq = !!m.envio_gatilho, noAr = versoesDe(m.chave).some(function (v) { return v.etapa === 'no_ar'; }), pq = m.para_quem || {};
  var h = '<label class="st-fld"><span>Como sai</span><select class="st-in" data-envio="modo">' + opcoes([['manual', 'Você envia, pela ficha'], ['sequencia', 'Sai sozinho (sequência)']], seq ? 'sequencia' : 'manual') + '</select></label>';
  if (!seq) return h + '<p class="st-msg tip">Aparece no "Escrever e-mail" da ficha depois de publicado.' + (m.tipo === 'novidades' ? ' Só para quem aceitou novidades.' : '') + '</p>';
  var gats = [['email', GATILHO.email], ['material', GATILHO.material]]; if (pq.produto) gats.push(['compra', GATILHO.compra]);
  var qual = m.envio_gatilho === 'email' ? opcoes((M || []).filter(function (x) { return x.chave !== m.chave; }).map(function (x) { return [x.chave, x.nome]; }), m.envio_depois_de, 'Escolha o e-mail')
    : m.envio_gatilho === 'material' ? opcoes(materiaisConhecidos(), m.envio_depois_de, 'Escolha o material') : opcoes([[pq.produto, pq.produto_nome || produtoNome(pq.produto)]], m.envio_depois_de);
  var completo = m.envio_gatilho && m.envio_depois_de && m.envio_dias != null && m.envio_hora != null;
  var resumo = completo ? 'Sai sozinho ' + (m.envio_dias === 0 ? 'no mesmo dia' : m.envio_dias + (m.envio_dias === 1 ? ' dia' : ' dias') + ' depois') + ' ' +
    (m.envio_gatilho === 'email' ? 'do e-mail "' + modeloNome(m.envio_depois_de) + '"' : m.envio_gatilho === 'material' ? 'de pegar ' + origLabel(m.envio_depois_de) : 'da compra do ' + (pq.produto_nome || produtoNome(m.envio_depois_de))) +
    ', por volta das ' + m.envio_hora + 'h05 de Brasília, uma vez por pessoa, para: ' + paraResumo(m) + '.' : 'Complete o Envio para poder ligar.';
  h += '<div class="st-envio"><label class="st-fld"><span>Depois de quê</span><select class="st-in" data-envio="gatilho">' + opcoes(gats, m.envio_gatilho) + '</select></label>' +
    '<label class="st-fld"><span>Qual</span><select class="st-in" data-envio="depois_de">' + qual + '</select></label>' +
    '<label class="st-fld"><span>Quantos dias depois</span><input class="st-in" type="number" min="0" max="120" data-envio="dias" value="' + esc(m.envio_dias == null ? '' : m.envio_dias) + '"></label>' +
    '<label class="st-fld"><span>Em que horário</span><select class="st-in" data-envio="hora">' + opcoes(HORAS, m.envio_hora == null ? '' : String(m.envio_hora), 'Escolha') + '</select></label></div>' +
    '<p class="st-msg tip">' + esc(resumo) + '</p>' +
    '<div class="st-ligado ' + (m.envio_ligado ? 'on' : '') + '"><span><b>' + (m.envio_ligado ? 'Envio ligado' : 'Envio desligado') + '</b>' +
    (m.envio_ligado ? ' desde ' + esc(fmtWhen(m.envio_ligado_em)) + '. Quem já tinha passado do horário antes disso não recebe.' : noAr ? ' Ao ligar, vale para quem passar do horário daqui para a frente.' : ' Publique uma versão (No ar) para poder ligar.') + '</span>' +
    '<button class="btn' + (m.envio_ligado ? '' : ' primary') + '" type="button" id="st-envio-ligar"' + (!m.envio_ligado && (!completo || !noAr) ? ' disabled' : '') + '>' + (m.envio_ligado ? 'Desligar' : 'Ligar o envio') + '</button></div>' +
    (m.tipo === 'novidades' ? '<p class="st-msg tip">Novidades: o banco e o Worker conferem o aceite mais recente a cada envio. Quem pedir para sair para de receber na rodada seguinte.</p>' : '') +
    '<p class="st-msg tip">O Worker roda as sequências de hora em hora (Cron Trigger "5 * * * *", README do Worker, seção 23). Mudar o Envio ou o Para quem com ele ligado recomeça a contagem a partir de agora.</p>';
  return h;
}
async function salvarModelo(patch, msg) {
  var m = modeloAtual(); if (!m) return;
  var r = await supabase.from('modelos_email').update(patch).eq('chave', m.chave).select();
  if (r.error) { fail('salvar o modelo', r.error); return renderEditor(); }
  Object.assign(m, (r.data && r.data[0]) || patch);
  if (msg) toast(msg);
  renderEditor(); renderLista(M); renderPrevia();
}
function mudarEnvio(campo, valor) {
  var m = modeloAtual(), pq = m.para_quem || {}, p = {};
  if (campo === 'modo') {
    if (valor === 'manual') p = { envio_gatilho: null, envio_depois_de: null, envio_dias: null, envio_hora: null, envio_ligado: false, como_sai: 'Você envia, pela ficha.' };
    else { var o = ES.objetivo(m.objetivo_chave) || {}; var g = pq.produto ? 'compra' : (o.gatilho && o.gatilho !== 'compra' ? o.gatilho : 'email');
      p = { envio_gatilho: g, envio_depois_de: g === 'compra' ? pq.produto : null, envio_dias: o.dias != null ? o.dias : 1, envio_hora: o.hora != null ? o.hora : 10, como_sai: 'Sozinho, pela parte Envio (sequência).' }; }
  } else if (campo === 'gatilho') p = { envio_gatilho: valor, envio_depois_de: valor === 'compra' ? pq.produto : null, envio_ligado: false };
  else if (campo === 'depois_de') p = { envio_depois_de: valor || null };
  else if (campo === 'dias') { var n = parseInt(valor, 10); if (!(n >= 0 && n <= 120)) return toast('Dias: de 0 a 120'); p = { envio_dias: n }; }
  else if (campo === 'hora') p = { envio_hora: valor === '' ? null : Number(valor) };
  if (m.envio_ligado && (p.envio_depois_de === null || p.envio_hora === null)) p.envio_ligado = false;
  return salvarModelo(p, 'Envio salvo');
}
async function ligarEnvio() {
  var m = modeloAtual();
  if (m.envio_ligado) { if (!window.confirm('Desligar o envio de "' + m.nome + '"? Ninguém mais recebe até você ligar de novo.')) return; return salvarModelo({ envio_ligado: false }, 'Envio desligado'); }
  if (!window.confirm('Ligar o envio de "' + m.nome + '"? A versão No ar passa a sair sozinha para quem cumprir as regras, a partir da próxima hora.')) return;
  return salvarModelo({ envio_ligado: true }, 'Envio ligado');
}
async function registrarCompra(btn) {
  var sel = $('compra-prod'), prod = sel && sel.value;
  if (!prod) return toast('Escolha o produto');
  var c = byC(btn.dataset.compra);
  if (!window.confirm('Registrar que ' + displayName(c) + ' comprou ' + produtoNome(prod) + '? As sequências de compra deste produto passam a valer para ela.')) return;
  btn.disabled = true;
  var r = await supabase.rpc('crm_registrar_compra', { p_contato: c.id, p_produto: prod });
  btn.disabled = false;
  if (r.error) return fail('registrar a compra', r.error);
  (COMPRAS[c.id] = COMPRAS[c.id] || {})[prod] = 1;
  toast(r.data && r.data.ja ? 'Essa compra já estava registrada' : 'Compra registrada: ' + produtoNome(prod));
  renderPessoa();
}

// ---------- A prévia ----------
function pessoasDaPrevia() {
  var q = ST.q.trim().toLowerCase();
  var l = C.filter(function (c) { return !q || (displayName(c) + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
  return l.slice(0, 200);
}
// "Editar no e-mail": o e-mail desenhado como chega, com cada texto editável no lugar (data-ef = o mesmo caminho de data-f).
// Mostra o texto como está guardado, com os {dados} à vista; "Ver como chega" mostra com os dados de uma pessoa.
function edCampo(path, valor, cls, rot, ph) {
  return '<div class="ed-t ' + (cls || '') + '" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" data-ef="' + esc(path) + '" aria-label="' + esc(rot) + '" data-ph="' + esc(ph || rot) + '">' + esc(valor || '') + '</div>';
}
function edAlt(i, b) {
  return b.alt != null && b.alt !== '' ? '<div class="ed-alt"><small>Se faltar um dado deste bloco:</small>' + edCampo('itens.' + i + '.alt', b.alt, 'ed-discreto', 'Texto se faltar um dado') + '</div>' : '';
}
function edNoEmail(d, m) {
  var blocos = (d.itens || []).map(function (b, i) {
    var p = function (c) { return 'itens.' + i + '.' + c; }, h;
    if (b.tipo === 'texto') h = edCampo(p('texto'), b.texto, b.estilo === 'caixa' ? 'ed-caixa' : b.estilo === 'discreto' ? 'ed-discreto' : 'ed-texto', 'Texto') + edAlt(i, b);
    else if (b.tipo === 'titulo') h = edCampo(p('texto'), b.texto, 'ed-titulo', 'Título') + edAlt(i, b);
    else if (b.tipo === 'pergunta') h = edCampo(p('texto'), b.texto, 'ed-titulo', 'Pergunta') + edAlt(i, b) + edCampo(p('ajuda'), b.ajuda, 'ed-discreto', 'Linha de ajuda', 'Linha de ajuda (opcional)');
    else if (b.tipo === 'botao') h = '<div class="ed-botao">' + edCampo(p('rotulo'), b.rotulo, '', 'Texto do botão') + '</div><small class="ed-nota">leva para {' + esc(b.link || 'escolha o link no bloco') + '}</small>';
    else if (b.tipo === 'destaque') h = '<div class="ed-dest">' + edCampo(p('rotulo'), b.rotulo, 'ed-rot', 'Rótulo') + edCampo(p('valor'), b.valor, 'ed-val', 'Valor') + edCampo(p('nota'), b.nota, 'ed-discreto', 'Nota', 'Nota (opcional)') + '</div>';
    else if (b.tipo === 'apresentacao') h = '<div class="ed-apr"><img src="' + esc(ES.FOTO_URL) + '" alt="" width="56" height="56"><div>' + edCampo(p('titulo'), b.titulo, 'ed-nome', 'Nome') + edCampo(p('texto'), b.texto, 'ed-discreto', 'Uma linha sobre você') + '</div></div>';
    else if (b.tipo === 'toques') h = '<div class="ed-toques">Os botões de um toque ({' + esc(b.var || 'botoes_cidade') + '}) entram aqui, prontos do Worker.</div>';
    else if (b.tipo === 'etapa') h = edCampo(p('rotulo'), b.rotulo, 'ed-discreto', 'Linha pequena de cima', 'Linha pequena de cima (opcional)') + edCampo(p('titulo'), b.titulo, 'ed-forte', 'Frase em negrito', 'Frase em negrito (opcional)') + edCampo(p('texto'), b.texto, 'ed-texto', 'Texto');
    else h = edCampo(p('texto'), b.texto, 'ed-ass', 'Assinatura');
    var cond = b.se ? (b.tipo === 'etapa' ? 'só para a etapa: ' + ((ES.CAT[b.se.slice(1)] || {}).o || b.se.slice(1)).replace(/^etapa do guia: /, '') : (b.se[0] === '#' ? 'só se tiver {' : 'só se não tiver {') + b.se.slice(1) + '}') : '';
    return '<div class="ed-blk" data-edblk="' + i + '">' + (cond ? '<small class="ed-cond">' + esc(cond) + '</small>' : '') + h + '</div>';
  }).join('');
  var rod = ES.rodapeDe(d, m.tipo);
  return '<div class="ed-env">' +
    '<label class="ed-l">Assunto</label>' + edCampo('assunto', d.assunto, 'ed-assunto', 'Assunto') +
    '<label class="ed-l">Assunto se faltar um dado</label>' + edCampo('assunto_alt', d.assunto_alt, 'ed-pre', 'Assunto se faltar um dado', 'Assunto se faltar um dado (opcional)') +
    '<label class="ed-l">Prévia</label>' + edCampo('pre', d.pre, 'ed-pre', 'Prévia', 'A linha cinza depois do assunto (opcional)') + '</div>' +
    '<div class="ed-mail"><div class="ed-marca">Por <span>Dentro</span></div><div class="ed-carta">' + blocos + '</div>' +
    (rod ? '<div class="ed-rod">' + esc(rod) + '</div>' : '') + '</div>';
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
  if (ST.criar) {
    var oc = ST.criar.obj && ES.objetivo(ST.criar.obj);
    if (!oc) { box.innerHTML = barra + '<div class="empty">Escolha o objetivo: a prévia mostra o esqueleto com os dados da pessoa.</div>'; return; }
    var fk = { chave: '_novo', criado_no_estudio: true, tipo: oc.tipo, para_quem: ST.criar.para }, rk = null;
    try { var ve = ES.montar(ES.esqueleto(oc.k), oc.tipo); rk = ES.montarComDados(ve, ES.dadosDe('_novo', c, ajudantes(), fk), ST.marcar); } catch (e) { rk = null; }
    box.innerHTML = barra + '<p class="st-msg tip">Esqueleto de "' + esc(oc.nome) + '" com os dados de ' + esc(displayName(c)) + '. Os [trechos] são para você escrever.</p>' +
      (rk ? '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="st-env"><span class="sub">Ingryd · Por Dentro</span><b>' + esc(rk.assunto) + '</b></div>' +
        '<iframe class="st-mail" sandbox="" title="Prévia do e-mail" srcdoc="' + esc(rk.html || textoParaHtml(rk.texto)) + '"></iframe></div>' : '<div class="empty">Sem prévia.</div>');
    return;
  }
  if (!M) {
    var t = splitTpl(c, k);
    box.innerHTML = barra + '<div class="st-env"><b>' + esc(t.subject) + '</b></div><div class="mailbody">' + esc(t.body) + '</div>';
    return;
  }
  var v = textoDaPrevia();
  if (!v) { box.innerHTML = barra + '<div class="empty">Este modelo ainda não tem versão.</div>'; return; }
  var dados = dadosPara(k, c), avisos = [], erro = null, r = null;
  try { r = ES.montarComDados(v, dados, ST.marcar); } catch (e) { erro = e.message; }
  if (m && m.criado_no_estudio) {
    var pqv = m.para_quem || {}, fora = [];
    if (pqv.produto && !comprou(c.id, pqv.produto)) fora.push('não tem a compra do ' + (pqv.produto_nome || produtoNome(pqv.produto)) + ' registrada (confira na ficha)');
    if ((pqv.personas || []).length && pqv.personas.indexOf(c.persona) < 0 && !(c.personas || []).some(function (x) { return pqv.personas.indexOf(x) >= 0; })) fora.push('é de outra persona');
    if ((pqv.materiais || []).length && !origensDe(c).some(function (x) { return pqv.materiais.indexOf(x) >= 0; })) fora.push('não pegou o material');
    if ((pqv.etapas || []).length && pqv.etapas.indexOf((c.respostas || {}).objetivo) < 0) fora.push((c.respostas || {}).objetivo ? 'marcou outra etapa no guia' : 'não marcou etapa no guia');
    if ((pqv.estagios || []).length && pqv.estagios.indexOf(c.estagio) < 0) fora.push('está em outro estágio');
    if ((pqv.segmentos || []).length && pqv.segmentos.indexOf(c.segmento) < 0) fora.push('está fora do segmento');
    if (fora.length) avisos.push(displayName(c) + ' ' + fora.join(', ') + ': pelas regras de Para quem, este e-mail não sai para essa pessoa.');
  }
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
  var editavel = !!(ST.d && podeEditar(versaoAberta())), modo = editavel ? ST.modo : 'ver';
  var modos = editavel ? '<div class="seg" role="group" aria-label="Modo da prévia"><button type="button" data-stmodo="editar" aria-pressed="' + (modo === 'editar') + '">Editar no e-mail</button>' +
    '<button type="button" data-stmodo="ver" aria-pressed="' + (modo === 'ver') + '">Ver como chega</button></div>' : '';
  if (modo === 'editar') {
    box.innerHTML = barra + modos +
      (erro ? '<div class="st-alert no">O texto tem um erro: ' + esc(erro) + '.</div>' : '') +
      '<p class="st-msg tip">Clique em qualquer texto para mudar. Os {dados} ficam como estão; **assim** sai em negrito. Para ver com os dados de ' + esc(displayName(c)) + ', use "Ver como chega". Guarda sozinho.</p>' +
      '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="ed-wrap">' + edNoEmail(ST.d, m) + '</div></div>';
    return;
  }
  box.innerHTML = barra + modos +
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
// noEmail: a mudança veio do "Editar no e-mail"; a prévia não é redesenhada (o cursor fica lá) e o campo do bloco acompanha.
function aoEditar(noEmail) {
  agendarSalvar();
  var v = versaoAberta(); if (v) { v.testado_em = null; }
  var pub = $('st-publicar'); if (pub) pub.disabled = true;   // mudou o texto: precisa de um teste novo
  if (noEmail) {
    var f = document.querySelector('#st-edit [data-f="' + noEmail.path + '"]'); if (f) f.value = noEmail.valor;
    var res = document.querySelector('#st-edit [data-blkopen="' + noEmail.path.split('.')[1] + '"] span');
    if (res && /^itens\./.test(noEmail.path) && ST.d.itens[+noEmail.path.split('.')[1]]) { var b = ST.d.itens[+noEmail.path.split('.')[1]]; res.textContent = String(b.texto || b.rotulo || b.titulo || '').replace(/\s+/g, ' ').slice(0, 60); }
  } else renderPrevia();
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
    // Nos modelos novos (entrega 3) vão os dados do painel; o link do produto, privado, o Worker põe.
    var mt = modeloAtual() || {}, dados = mt.automatico && !mt.criado_no_estudio ? {} : dadosPara(ST.k, c), vars = {};
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
    : 'Publicar a versão ' + versao + ' de "' + m.nome + '"? ' + (m.criado_no_estudio && m.envio_gatilho ? (m.envio_ligado ? 'O próximo envio da sequência já sai com este texto.' : 'Depois, ligue o Envio para a sequência começar.') : m.automatico ? 'O próximo e-mail já sai com este texto.' : 'A ficha passa a abrir com este texto.') + (atual && atual.etapa === 'no_ar' ? ' A versão ' + atual.versao + ' fica guardada.' : '');
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
// O pop-up mostra o e-mail como ela vai ver (aba "Como ela vai ver") e deixa editar o texto (aba "Editar texto").
// Se você mexer no texto, o e-mail sai no formato simples e a prévia passa a mostrar esse formato: o que você vê é o que sai.
var CMP = null;   // { c, k, e, editado, aba }
// O seletor de modelo do "Escrever e-mail", em grupos (optgroup) pelas mesmas categorias da lista.
function opcoesPorCategoria(chaves, atual) {
  var opt = function (m) { return '<option value="' + m + '"' + (m === atual ? ' selected' : '') + '>' + esc(tplInfo(m).label) + '</option>'; };
  var itens = chaves.map(function (k) { var m = modeloDe(k) || { chave: k, tipo: EXIGEM_NOVIDADES[k] ? 'novidades' : 'servico' }; return m; });
  return porCategoria(itens).map(function (g) { return '<optgroup label="' + esc(g.nome) + '">' + g.itens.map(function (m) { return opt(m.chave); }).join('') + '</optgroup>'; }).join('');
}
function openCompose(cid, key) {
  var c = byC(cid); if (!c) return;
  activeCid = cid;
  var k = key || defaultTpl(c);
  CMP = { c: c, k: k, e: emailPronto(c, k), editado: null, aba: 'ver' };
  var bloqueado = exigeNovidades(k) && !c.aceita_novidades;
  var opcoesTpl = TPL_ORDER.filter(function (m) { return !excluido(m) || m === k; }).concat(novosManuais().map(function (m) { return m.chave; }));
  modalOpen(modalTop(c) +
    '<div class="ctx" style="margin-top:12px"><div class="sel"><select id="compose-tpl" aria-label="Modelo">' + opcoesPorCategoria(opcoesTpl, k) + '</select></div><span class="lever" style="display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--brown);background:var(--brown-soft);padding:2px 8px;border-radius:999px">' + esc(tplInfo(k).lever) + '</span></div>' +
    '<p class="sub" style="margin:8px 0 0">' + esc(tplInfo(k).when) + '</p>' +
    (bloqueado ? '<p class="sub" style="color:var(--red);margin:8px 0 0">Essa pessoa não aceitou novidades por e-mail — este modelo não pode ser enviado a ela.</p>' : '') +
    '<div class="reply" style="margin-top:14px"><label for="compose-subj">Assunto</label><input id="compose-subj" maxlength="200" style="height:38px;border:1px solid var(--line-2);border-radius:var(--r);padding:0 10px;background:var(--surface-2)" value="' + esc(CMP.e.subject) + '"></div>' +
    '<div class="ptabs" role="tablist" aria-label="E-mail" style="margin-top:12px">' +
    '<button class="ptab" role="tab" type="button" data-cmpaba="ver" aria-selected="true">Como ela vai ver</button>' +
    '<button class="ptab" role="tab" type="button" data-cmpaba="editar" aria-selected="false">Editar texto</button></div>' +
    '<div id="cmp-ver"><div class="envelope"><div><span>De</span>Ingryd · Por Dentro</div><div><span>Para</span>' + esc(c.email) + '</div><div><span>Assunto</span><b id="cmp-env-subj">' + esc(CMP.e.subject) + '</b></div></div>' +
    '<div id="cmp-frame">' + previaFrame(previaDoc(k, CMP.e), 'cmpframe') + '</div><p class="sub" id="cmp-formato" style="margin:6px 0 0"></p></div>' +
    '<div id="cmp-editar" class="reply" hidden><label for="compose-txt">Mensagem</label><textarea id="compose-txt" style="min-height:260px">' + esc(CMP.e.body) + '</textarea>' +
    '<button class="link" type="button" id="cmp-restaurar" hidden>Voltar ao texto do modelo</button></div>' +
    '<p class="sub" id="compose-err" style="margin:8px 0 0;color:var(--red)" role="alert" hidden></p>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="compose-send" data-tpl="' + k + '" data-versao="' + (CMP.e.versao || '') + '"' + (bloqueado ? ' disabled' : '') + '>Enviar e-mail</button></div>', true);
  cmpFormato();
}
function cmpFormato() {
  var p = $('cmp-formato'); if (!p || !CMP) return;
  p.textContent = CMP.editado != null ? 'Você mudou o texto: o e-mail sai no formato simples, como acima.'
    : CMP.e.html ? 'É o desenho da versão ' + CMP.e.versao + ' No ar, com os dados dela.'
    : 'Este modelo ainda não tem desenho (versão ' + (CMP.e.versao || 'do código') + '): sai em texto simples, como acima. Para ter o desenho, edite-o em Modelos de e-mail.';
  var r = $('cmp-restaurar'); if (r) r.hidden = CMP.editado == null;
}
function cmpAtualizar() {
  if (!CMP) return;
  $('cmp-frame').innerHTML = previaFrame(previaDoc(CMP.k, CMP.e, CMP.editado), 'cmpframe');
  $('cmp-env-subj').textContent = $('compose-subj').value; cmpFormato();
}
function cmpAba(a) {
  CMP.aba = a;
  document.querySelectorAll('[data-cmpaba]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.cmpaba === a)); });
  $('cmp-ver').hidden = a !== 'ver'; $('cmp-editar').hidden = a !== 'editar';
  if (a === 'ver') cmpAtualizar();
}
async function sendEmail(btn) {
  var err = $('compose-err'); err.hidden = true;
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { err.textContent = 'Sessão expirada. Recarregue a página e entre de novo.'; err.hidden = false; return; }
  var corpo = (CMP && CMP.editado != null ? CMP.editado : (CMP ? CMP.e.body : $('compose-txt').value)).trim();
  var html = CMP && CMP.editado == null && CMP.e.html ? CMP.e.html : null;
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ contato_id: activeCid, modelo: btn.dataset.tpl, assunto: $('compose-subj').value.trim(), corpo: corpo,
        modelo_versao: btn.dataset.versao ? Number(btn.dataset.versao) : null, html: html || undefined })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    closeCompose(); await reload();
    if (state.view === 'pessoa') renderPessoa(); else if (state.view === 'reimpacto') renderReimpacto();
    // Worker antigo ignora o HTML: avisa em vez de deixar a prévia dizer uma coisa e o e-mail outra.
    toast(data.aviso || (html && data.formato !== 'html' ? 'E-mail enviado, mas em texto simples: o Worker ainda não foi atualizado (README, seção 22).' : 'E-mail enviado'), data.aviso || (html && data.formato !== 'html') ? 9000 : 0);
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
  if (view === 'onboarding') carregarOnboarding();
  if (view === 'funil') renderBoard();
  if (view === 'radar') renderRadar();
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

// ---------- Onboarding: documento → ficha com o Dossiê preenchido (Worker: POST /api/crm/onboarding/ler) ----------
// O arquivo é lido pelo Worker e descartado: o navegador também só o guarda na memória desta tela, até enviar (e o solta
// no sucesso). Texto de terceiros (nome do arquivo, mensagens do servidor) entra na tela por textContent.
var ONB_MAX_ARQ = 10 * 1048576, ONB_MAX_N = 5, ONB_MAX_TOTAL = 20 * 1048576, ONB_MAX_NOTAS = 20000;
var ONB_TIPOS = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
var ONB = onbInicial();
function onbInicial() { return { fase: 'form', arquivos: [], email: '', notas: '', erro: '', ia: null }; }
function onbTipoDe(f) {
  var t = String(f.type || '').toLowerCase();
  if (t === 'application/pdf' || t === 'image/jpeg' || t === 'image/png') return t;
  return t ? '' : (ONB_TIPOS[String(f.name || '').split('.').pop().toLowerCase()] || '');   // navegador sem tipo: vale a extensão (o Worker confere os bytes)
}
function onbMb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
// Os arquivos novos que cabem, e o motivo de cada um que não coube. A mesma regra do Worker (que confere tudo de novo).
function onbJuntar(atuais, novos) {
  var ok = atuais.slice(), recusas = [], total = ok.reduce(function (s, f) { return s + f.size; }, 0);
  novos.forEach(function (f) {
    var nome = String(f.name || 'arquivo').slice(0, 60);
    if (ok.some(function (o) { return o.name === f.name && o.size === f.size && o.lastModified === f.lastModified; })) return;
    if (!onbTipoDe(f)) return recusas.push(nome + ': só PDF, JPG ou PNG.');
    if (!f.size) return recusas.push(nome + ': o arquivo está vazio.');
    if (f.size > ONB_MAX_ARQ) return recusas.push(nome + ': passa de 10 MB.');
    if (ok.length >= ONB_MAX_N) return recusas.push(nome + ': no máximo ' + ONB_MAX_N + ' arquivos por vez.');
    if (total + f.size > ONB_MAX_TOTAL) return recusas.push(nome + ': os arquivos somam mais de 20 MB.');
    ok.push(f); total += f.size;
  });
  return { arquivos: ok, recusas: recusas };
}
// O que o Dossiê ainda não tem, na ordem da ficha. Só conta o que vale para a situação dela (dosVisiveis) e não o bloco "A ligação".
function onbFalta(c, d, rasc) {
  var out = [];
  dosVisiveis(c, d, rasc).forEach(function (b) {
    if (b.livre) return;
    b.campos.forEach(function (f) { if (dosValor(c, d, rasc, f.k) === '') out.push(f.l); });
  });
  return out;
}
// A etiqueta de origem de um campo: só vale enquanto o valor ainda é o que a IA escreveu (se você mexeu, some).
function onbOrigemDe(k, atual) {
  var o = state.dos && state.dos.origem && state.dos.origem[k];
  if (!o || typeof o !== 'object') return null;
  var guardado = o.valor === null || o.valor === undefined ? '' : String(o.valor);
  if (DOS_MES[k] && /^\d{4}-\d{2}/.test(guardado)) guardado = guardado.slice(0, 7);
  if (guardado === '' || guardado !== String(atual)) return null;
  return { origem: o.origem === 'anotacao' ? 'Lido das suas anotações' : 'Lido do documento', conf: ['alta', 'media', 'baixa'].indexOf(o.confianca) >= 0 ? o.confianca : 'baixa' };
}
var ONB_CONF = { alta: 'confiança alta', media: 'confiança média', baixa: 'confiança baixa: confira' };

function renderOnboarding() {
  var box = $('onb-page'); if (!box) return;
  if (ONB.fase === 'lendo') {
    box.innerHTML = '<div class="onb"><div class="panel" role="status" aria-live="polite" aria-busy="true">' +
      '<h3 style="font-size:16px;margin-bottom:10px">Lendo o documento…</h3>' +
      '<div class="onb-sk" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<p class="sub" style="margin:14px 0 0">Costuma levar de 10 a 40 segundos. Pode deixar esta aba aberta. O arquivo é lido e descartado.</p></div></div>';
    return;
  }
  if (ONB.fase === 'ok') {   // a ficha não abriu sozinha (não achei a pessoa na lista): o caminho fica a um toque
    box.innerHTML = '<div class="onb"><div class="panel"><div class="onb-ok" role="status">Pronto: a ficha foi criada.</div>' +
      '<div class="onb-acoes" style="margin-top:12px"><button class="btn primary" type="button" id="onb-abrir">Abrir a ficha</button><button class="btn" type="button" id="onb-outra">Ler outro documento</button></div></div></div>';
    return;
  }
  box.innerHTML = '<div class="onb">' +
    '<div class="onb-aviso" id="onb-aviso" role="status" hidden></div>' +
    '<div class="panel">' +
      '<label class="rot" for="onb-email">E-mail da pessoa (obrigatório)</label>' +
      '<input id="onb-email" type="email" autocomplete="off" inputmode="email" maxlength="254" placeholder="pessoa@exemplo.com" required>' +
      '<small class="dica">A ficha é criada por este e-mail. Se já existir uma ficha com ele, ela é atualizada: o que você já digitou não é trocado.</small>' +
    '</div>' +
    '<div class="panel">' +
      '<label class="rot" for="onb-file">Documentos</label>' +
      '<label class="onb-drop" id="onb-drop" for="onb-file"><span><b>Solte aqui</b> ou toque para escolher</span>' +
        '<span class="sub">Passaporte, visto, titre de séjour, carta de aceite, certificado de matrícula…</span>' +
        '<span class="sub">PDF, JPG ou PNG · até 10 MB cada · até 5 arquivos</span>' +
        '<input id="onb-file" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label>' +
      '<ul class="onb-arqs" id="onb-arqs"></ul>' +
      '<p class="sub" id="onb-vazio" style="margin:10px 0 0">Nenhum documento ainda. Solte o primeiro acima.</p>' +
    '</div>' +
    '<div class="panel">' +
      '<label class="rot" for="onb-notas">Anotações da chamada (opcional)</label>' +
      '<textarea id="onb-notas" maxlength="' + ONB_MAX_NOTAS + '" placeholder="O que a pessoa contou: situação, cidade, caminho de estudo, prazos, o que combinaram…"></textarea>' +
      '<small class="dica">Lidas junto com o documento. O que não estiver no documento nem aqui fica vazio e aparece como “falta perguntar” na ficha.</small>' +
    '</div>' +
    '<div class="onb-erro" id="onb-erro" role="alert" hidden></div>' +
    '<div class="onb-acoes"><button class="btn primary" type="button" id="onb-enviar">Ler e criar pessoa</button></div>' +
    '</div>';
  $('onb-email').value = ONB.email;
  $('onb-notas').value = ONB.notas;
  onbPintaArquivos();
  var er = $('onb-erro');
  if (ONB.erro) {
    er.textContent = ONB.erro; er.hidden = false;
    if (ONB.fase === 'erro') {
      $('onb-enviar').textContent = 'Tentar de novo';
      var p = document.createElement('p'); p.className = 'sub'; p.style.margin = '0'; p.textContent = 'Seus arquivos e anotações continuam aqui. Nada foi salvo.';
      $('onb-enviar').parentNode.appendChild(p);
    }
  }
  onbPintaAviso();
}
function onbPintaAviso() {
  var av = $('onb-aviso'), bt = $('onb-enviar'); if (!av) return;
  if (ONB.ia && ONB.ia.ia_configurada === false) {
    av.textContent = (ONB.ia.aviso || 'A leitura por IA ainda não está ligada.') + ' As fichas e o Dossiê continuam funcionando: preencha à mão pela ficha da pessoa.';
    av.hidden = false; if (bt) bt.disabled = true;
  } else if (ONB.ia && ONB.ia.erro) {
    av.textContent = ONB.ia.erro; av.hidden = false;
  } else { av.hidden = true; if (bt) bt.disabled = false; }
}
function onbPintaArquivos() {
  var ul = $('onb-arqs'), vazio = $('onb-vazio'); if (!ul) return;
  ul.innerHTML = '';
  ONB.arquivos.forEach(function (f, i) {
    var li = document.createElement('li'), nome = document.createElement('span'), tam = document.createElement('span'), rm = document.createElement('button');
    nome.className = 'nome'; nome.textContent = f.name || 'arquivo';
    tam.className = 'tam num'; tam.textContent = onbMb(f.size);
    rm.className = 'btn'; rm.type = 'button'; rm.textContent = 'Tirar'; rm.dataset.onbrem = String(i);
    rm.setAttribute('aria-label', 'Tirar ' + (f.name || 'arquivo'));
    li.appendChild(nome); li.appendChild(tam); li.appendChild(rm); ul.appendChild(li);
  });
  if (vazio) vazio.hidden = ONB.arquivos.length > 0;
}
function onbMostraErro(msg) { ONB.erro = msg || ''; var er = $('onb-erro'); if (er) { er.textContent = ONB.erro; er.hidden = !ONB.erro; } }
function onbAdicionar(lista) {
  var r = onbJuntar(ONB.arquivos, Array.prototype.slice.call(lista || []));
  ONB.arquivos = r.arquivos; ONB.fase = 'form';
  onbMostraErro(r.recusas.join(' '));
  onbPintaArquivos();
}
async function carregarOnboarding() {
  ONB.ia = null; renderOnboarding();
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) return;
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/onboarding/status', { headers: { Authorization: 'Bearer ' + sess.data.session.access_token } });
    var data = await res.json().catch(function () { return {}; });
    ONB.ia = res.ok ? data : { erro: 'Não consegui saber se a leitura por IA está ligada (Worker respondeu ' + res.status + '). Pode ser que o Worker ainda não tenha sido atualizado (README, seção 24).' };
  } catch (e) { ONB.ia = { erro: 'Não consegui falar com o Worker para saber se a leitura por IA está ligada.' }; }
  if (state.view === 'onboarding') onbPintaAviso();
}
async function onbEnviar() {
  var email = String(ONB.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return onbMostraErro('Digite o e-mail da pessoa. É por ele que a ficha é criada ou encontrada.');
  if (!ONB.arquivos.length) return onbMostraErro('Escolha pelo menos um documento (PDF, JPG ou PNG).');
  if (String(ONB.notas || '').length > ONB_MAX_NOTAS) return onbMostraErro('As anotações passaram de ' + ONB_MAX_NOTAS + ' letras. Resuma e tente de novo.');
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) return onbMostraErro('Sessão expirada. Recarregue a página e entre de novo.');
  ONB.fase = 'lendo'; ONB.erro = ''; renderOnboarding();
  var fd = new FormData();
  fd.append('email', email); fd.append('anotacoes', String(ONB.notas || '').trim());
  ONB.arquivos.forEach(function (f) { fd.append('arquivos', f, f.name); });
  var ctl = new AbortController(), cedo = setTimeout(function () { ctl.abort(); }, 150000), data;
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/onboarding/ler', { method: 'POST', headers: { Authorization: 'Bearer ' + sess.data.session.access_token }, body: fd, signal: ctl.signal });
    data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
  } catch (e) {
    ONB.fase = 'erro';
    ONB.erro = e && e.name === 'AbortError' ? 'A leitura demorou mais de 2 minutos e foi cancelada. Tente de novo; se repetir, mande menos páginas.'
      : e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : (e.message || 'Algo deu errado.');
    if (state.view === 'onboarding') renderOnboarding();
    return;
  } finally { clearTimeout(cedo); }
  // Deu certo: solta os arquivos da memória, guarda o resumo para a ficha e abre a ficha direto.
  state.onbResumo = { cid: data.contato_id, criado: !!data.criado, preenchidos: data.preenchidos || [], ja: data.ja_preenchidos || [], custo: data.custo_estimado_usd };
  ONB = onbInicial();
  await reload();
  if (byC(data.contato_id)) { openPessoa(data.contato_id, 'ficha'); return toast(state.onbResumo.criado ? 'Ficha criada. Confira o que a IA leu.' : 'Ficha atualizada. Confira o que a IA leu.', 5000); }
  ONB.fase = 'ok'; ONB.erro = ''; ONB.contato = data.contato_id; if (state.view === 'onboarding') renderOnboarding();
}
// O aviso no topo da ficha logo depois do Onboarding: o que entrou e o que já estava preenchido e ficou como estava.
function onbResumoHtml(c) {
  var r = state.onbResumo; if (!r || r.cid !== c.id) return '';
  var nomes = function (ks) { return ks.map(function (k) { var f = dosCampo(k); return f ? f.l : k; }).join(', '); };
  return '<div class="panel onb-resumo" id="onb-resumo"><h3>' + (r.criado ? 'Ficha criada pelo Onboarding' : 'Ficha atualizada pelo Onboarding') + '</h3>' +
    '<p>' + (r.preenchidos.length ? '<b>' + r.preenchidos.length + (r.preenchidos.length === 1 ? ' campo preenchido' : ' campos preenchidos') + ':</b> ' + esc(nomes(r.preenchidos)) + '.' : 'A IA não achou nenhum campo para preencher no material.') + '</p>' +
    (r.ja.length ? '<p class="sub">Já estavam preenchidos e ficaram como você deixou: ' + esc(nomes(r.ja)) + '.</p>' : '') +
    '<p class="sub">A IA só sugere: confira cada campo no Dossiê abaixo. Cada campo lido mostra de onde veio e quanto a IA confiou' + (r.custo != null ? ' · custo estimado da leitura: US$ ' + esc(String(r.custo).replace('.', ',')) : '') + '.</p>' +
    '<div class="actions" style="margin-top:8px"><button class="btn" type="button" data-onbfechar="1">Entendi</button></div></div>';
}
function onbFaltaHtml(c, d, rasc) {
  if (!state.dos || !state.dos.onbEm) return '';
  var f = onbFalta(c, d, rasc), mostra = f.slice(0, 12);
  if (!f.length) return '<div class="onb-falta"><b>Falta perguntar</b><span class="sub">Nada: o Dossiê está completo para a situação dela.</span></div>';
  return '<div class="onb-falta"><b>Falta perguntar</b>' + mostra.map(function (l) { return '<span class="dchip falta">' + esc(l) + '</span>'; }).join('') +
    (f.length > mostra.length ? '<span class="sub">e mais ' + (f.length - mostra.length) + '</span>' : '') + '</div>';
}

// ---------- Link de pagamento (aba Plataforma): o seletor vem de planos/planos.json ----------
var PAGTO = { itens: null, erro: '' };
var ASSIN_ST = { trialing: 'em teste grátis', active: 'ativa', past_due: 'pagamento falhou', canceled: 'cancelada', unpaid: 'não paga', incomplete: 'incompleta', paused: 'pausada' };
// A assinatura que o Stripe informou (db/crm-assinaturas.sql): o status e até quando vale. O Stripe é quem manda nas datas.
function assinaturaHtml() {
  var a = state.assin; if (!a) return '';
  var ate = a.status === 'trialing' ? a.teste_fim || a.periodo_fim : a.periodo_fim;
  return '<p class="sub" style="margin:8px 0 0"><b>Assinatura:</b> ' + esc(ASSIN_ST[a.status] || a.status) + (a.plano ? ' · ' + esc(a.plano) : '') +
    (ate ? ' · ' + (a.status === 'trialing' ? 'teste até ' : a.status === 'active' && !a.cancela_no_fim ? 'renova em ' : 'acesso até ') + esc(fmtDay(String(ate).slice(0, 10))) : '') +
    (a.cancela_no_fim ? ' · cancela no fim do período' : '') + '</p>';
}
// planos/planos.json (o mesmo da página /planos/): { niveis, itens }, ou só uma lista de itens. O rótulo vem do item, ou do nome do nível + a
// periodicidade. Item fora do formato é ignorado (não derruba a lista).
function pagtoItens(j) {
  var l = Array.isArray(j) ? j : (j && Array.isArray(j.itens) ? j.itens : []);
  var nomes = {}; ((j && Array.isArray(j.niveis)) ? j.niveis : []).forEach(function (n) { if (n && n.chave && n.nome) nomes[n.chave] = String(n.nome); });
  return l.map(function (x) {
    if (!x || !/^[a-z0-9_-]{1,40}$/.test(String(x.chave || '')) || !/^[A-Z]{3}$/.test(String(x.moeda || '')) || typeof x.url !== 'string' || !/^https:\/\//.test(x.url)) return null;
    var rot = typeof x.rotulo === 'string' && x.rotulo.trim() ? x.rotulo.trim() : (nomes[x.nivel] ? nomes[x.nivel] + (x.periodicidade ? ' · ' + x.periodicidade : '') : '');
    return rot ? { chave: x.chave, rotulo: rot.slice(0, 80), moeda: x.moeda, url: x.url, exemplo: !!x.exemplo } : null;
  }).filter(Boolean);
}
async function carregarLinksPagamento() {
  if (PAGTO.itens) return PAGTO.itens;
  try {
    var res = await fetch('/planos/planos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    PAGTO.itens = pagtoItens(await res.json()); PAGTO.erro = '';
  } catch (e) { PAGTO.itens = null; PAGTO.erro = 'Não consegui ler planos/planos.json (' + (e && e.message) + ').'; }
  return PAGTO.itens;
}
function pagamentoHtml(c, h4) {
  var p = state.pagto;
  return '<div class="panel" style="padding:16px" id="pag-box"><h4 style="' + h4 + '">Pagamento</h4>' +
    '<div class="pag-linha">' +
    (p ? '<span class="pill u-baixa" title="' + esc(p.rotulo || '') + '">Link enviado em ' + esc(fmtDate(p.quando)) + '</span><button class="btn" type="button" data-pagar="' + esc(c.id) + '">Reenviar</button>'
      : '<button class="btn primary" type="button" data-pagar="' + esc(c.id) + '">Enviar link de pagamento</button>') +
    '</div>' +
    (p && p.rotulo ? '<p class="sub" style="margin:8px 0 0">' + esc(p.rotulo) + '</p>' : '') +
    assinaturaHtml() +
    '<p class="sub" style="margin:8px 0 0">Manda o e-mail “Link de pagamento” do Estúdio, com o Payment Link do plano. O link leva o e-mail dela e o id da ficha.</p></div>';
}
async function abrirLinkPagamento(cid) {
  var c = byC(cid); if (!c) return; activeCid = cid;
  modalOpen(modalTop(c) + '<h4 style="margin:14px 0 6px;font-size:14px">Enviar link de pagamento</h4>' +
    '<label class="sub" for="pg-plano" style="display:block;margin:0 0 4px">O que enviar</label>' +
    '<select id="pg-plano" class="pag-plano" disabled><option>Carregando…</option></select>' +
    '<p class="sub" style="margin:8px 0 0" id="pg-dica"></p>' +
    '<p class="sub" style="margin:8px 0 0">O e-mail “Link de pagamento” vai para <b id="pg-email"></b>.</p>' +
    '<p class="onb-erro" id="pg-err" role="alert" hidden style="margin:10px 0 0"></p>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn primary" type="button" id="pg-enviar" disabled>Enviar e-mail</button></div>');
  $('pg-email').textContent = c.email; $('pg-enviar').disabled = true;
  var itens = await carregarLinksPagamento(), sel = $('pg-plano'); if (!sel) return;
  sel.innerHTML = '';
  if (!itens || !itens.length) {
    var o0 = document.createElement('option'); o0.textContent = 'Nenhum plano em planos/planos.json'; sel.appendChild(o0);
    var er = $('pg-err'); er.textContent = PAGTO.erro || 'O arquivo planos/planos.json não tem nenhum plano. Preencha com os seus Payment Links do Stripe.'; er.hidden = false;
    return;
  }
  var reais = itens.filter(function (it) { return !it.exemplo; }).length;
  // A primeira opção manda a página /planos/, onde a pessoa escolhe nível, periodicidade e moeda. As outras mandam um Payment Link só.
  var oe = document.createElement('option'); oe.value = 'escolha'; oe.textContent = 'Deixar a pessoa escolher (página com todos os planos)'; oe.disabled = !reais; sel.appendChild(oe);
  itens.forEach(function (it, i) {
    var o = document.createElement('option'); o.value = String(i);
    o.textContent = 'Só este plano: ' + it.rotulo + ' (' + it.moeda + ')' + (it.exemplo ? ' · exemplo, troque no arquivo' : '');
    o.disabled = it.exemplo; sel.appendChild(o);
  });
  sel.disabled = false;
  if (!reais) {
    sel.selectedIndex = 0;   // só há exemplo: mostra a primeira opção (desligada) em vez de uma caixa em branco
    $('pg-dica').textContent = 'Só há o item de exemplo. Preencha planos/planos.json com os seus Payment Links do Stripe.';
    return;
  }
  sel.value = 'escolha'; $('pg-enviar').disabled = false;
  $('pg-dica').textContent = 'A página de planos mostra só o que já tem link no planos.json. O link do e-mail vale 30 dias.';
}
async function enviarLinkPagamento(btn) {
  var err = $('pg-err'); err.hidden = true;
  var v = $('pg-plano').value, escolha = v === 'escolha', it = escolha ? null : (PAGTO.itens || [])[Number(v)];
  if (!escolha && (!it || it.exemplo)) { err.textContent = 'Escolha o que enviar.'; err.hidden = false; return; }
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { err.textContent = 'Sessão expirada. Recarregue a página e entre de novo.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/link-pagamento', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify(escolha ? { contato_id: activeCid, escolha: true } : { contato_id: activeCid, chave: it.chave, rotulo: it.rotulo, moeda: it.moeda, url: it.url })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    closeCompose(); await reload();
    if (state.view === 'pessoa') renderPessoa();
    toast(data.aviso || 'Link de pagamento enviado', data.aviso ? 9000 : 0);
  } catch (e) {
    err.textContent = e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : e.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Enviar e-mail';
  }
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
  if (t.dataset.pstab) return trocaPlatAba(t.dataset.pstab);
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
  if (t.dataset.mailtoggle) {
    var mb = $('mb-' + t.dataset.mailtoggle); mb.hidden = !mb.hidden;
    if (!mb.hidden && !mb.firstChild) {   // monta o e-mail só quando abre
      var mm = (state.mails || []).filter(function (x) { return String(x.id) === t.dataset.mailtoggle; })[0], cc = byC(state.sel);
      if (mm && cc) mb.innerHTML = previaFrame(htmlDoEnviado(mm, cc), 'cmpframe');
    }
    return;
  }
  if (t.dataset.dostoggle) {
    state.dosAberto = !state.dosAberto;
    try { localStorage.setItem('crm_dossie_aberto', state.dosAberto ? '1' : '0'); } catch (e2) {}
    return pintaDossie(byC(state.sel));
  }
  if (t.dataset.dossalvar) return salvarDossie(t.dataset.dossalvar, t);
  if (t.id === 'onb-enviar') return onbEnviar();
  if (t.id === 'onb-abrir') return openPessoa(ONB.contato, 'ficha');
  if (t.id === 'onb-outra') { ONB = onbInicial(); return carregarOnboarding(); }
  if (t.dataset.onbrem !== undefined) { ONB.arquivos.splice(Number(t.dataset.onbrem), 1); return onbPintaArquivos(); }
  if (t.dataset.onbfechar) { state.onbResumo = null; var rb = $('onb-resumo'); if (rb) rb.hidden = true; return; }
  if (t.dataset.pagar) return abrirLinkPagamento(t.dataset.pagar);
  if (t.id === 'pg-enviar') return enviarLinkPagamento(t);
  if (t.dataset.chatenviar) return enviarChat(t.dataset.chatenviar, t);
  if (t.dataset.chkvia) return chkAgir(t.dataset.chkvia, Number(t.dataset.chki));
  if (t.dataset.chatquick) {
    var cq = byC(state.sel);
    if (t.dataset.chatquick === 'um_a_um') return openProposta(cq.id, 'um_a_um');
    if (t.dataset.chatquick === 'proposta') return openProposta(cq.id);
    var cx = $('chat-txt'); if (cx) { cx.value = chatTextoRapido(t.dataset.chatquick, cq); cx.focus(); }
    return;
  }
  if (t.dataset.radarpersona) { state.rpersona = t.dataset.radarpersona; return renderRadar(); }
  if (t.dataset.radarabrir) { state.rpersona = t.dataset.radarabrir; return show('radar'); }
  if (t.dataset.radarnovo) return radarForm(state.rpersona, t.dataset.radarfator);
  if (t.id === 'radar-salvar') return radarSalvar(t);
  if (t.dataset.radarenviar) return radarEnviarForm(Number(t.dataset.radarenviar));
  if (t.dataset.radararquivar) return radarArquivar(Number(t.dataset.radararquivar));
  if (t.dataset.radarmodo) { RS.modo = t.dataset.radarmodo; return radarEnviarForm(RS.item, true); }
  if (t.id === 'radar-enviar-go') return radarEnviar(t);
  if (t.dataset.insnova) return publicarInsight(t.dataset.insnova, t);
  if (t.dataset.insretirar) return retirarInsight(t.dataset.insretirar);
  if (t.dataset.openproposta) return openProposta(t.dataset.openproposta, t.dataset.preset);
  if (t.dataset.open1a1) return open1a1(t.dataset.open1a1);
  if (t.id === 'modal-cancel') return closeCompose();
  if (t.dataset.emailfor) return openCompose(t.dataset.emailfor, t.dataset.tplk);
  if (t.dataset.cmpaba) return cmpAba(t.dataset.cmpaba);
  if (t.id === 'cmp-restaurar') { CMP.editado = null; $('compose-txt').value = CMP.e.body; return cmpFormato(); }
  if (t.dataset.tplPick) { ST.criar = null; await salvar(); abrirModelo(t.dataset.tplPick); ST.blk = null; ST.tab = 'editar'; return renderModelos(); }
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
    if (alvo.dataset.ef) { alvo.focus(); return document.execCommand('insertText', false, '{' + t.dataset.insvar + '}'); }   // o input do e-mail guarda
    var ini0 = alvo.selectionStart == null ? alvo.value.length : alvo.selectionStart, fim0 = alvo.selectionEnd == null ? ini0 : alvo.selectionEnd, ins = '{' + t.dataset.insvar + '}';
    alvo.value = alvo.value.slice(0, ini0) + ins + alvo.value.slice(fim0); alvo.focus(); alvo.selectionStart = alvo.selectionEnd = ini0 + ins.length;
    setCampo(alvo.dataset.f, alvo.value); return aoEditar();
  }
  if (t.dataset.stdev) { ST.dev = t.dataset.stdev; return renderPrevia(); }
  if (t.dataset.stmodo) { ST.modo = t.dataset.stmodo; return renderPrevia(); }
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
  if (t.id === 'proposta-send') {
    var pt = $('prop-titulo').value.trim(), px = $('prop-texto').value.trim(), pl = $('prop-link').value.trim(), pd = $('prop-prazo').value;
    if (!pt || !px) return toast('Preencha o título e o texto');
    if (pl && !/^https:\/\//i.test(pl)) return toast('O link precisa começar com https://');
    t.disabled = true;
    // "Vale até" é o fim daquele dia, no horário do navegador. A proposta e a mensagem do chat nascem juntas (crm_chat_enviar).
    var po = await supabase.rpc('crm_chat_enviar', { p_contato: activeCid, p_proposta: { titulo: pt, texto: px, acao_sim: $('prop-sim').value.trim() || null,
      link: pl || null, link_rotulo: pl ? ($('prop-rotulo').value.trim() || null) : null, prazo: pd ? new Date(pd + 'T23:59:59').toISOString() : null } });
    if (po.error) { t.disabled = false; return fail('enviar a proposta', po.error); }
    avisarChatPorEmail(activeCid, po.data);
    closeCompose(); if (state.view === 'pessoa') { await atualizaAoVivo(activeCid, true); }
    return toast('Proposta enviada no chat dela');
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
  if (t.id === 'st-novo-modelo') { await salvar(); ST.criar = { passo: 1, obj: null, nome: '', para: paraVazio() }; ST.tab = 'editar'; return renderModelos(); }
  if (t.id === 'novo-cancelar') { ST.criar = null; return renderModelos(); }
  if (t.dataset.novoobj) { var ob = ES.objetivo(t.dataset.novoobj); ST.criar.obj = ob.k; if (!ST.criar.nome || ES.OBJETIVOS.some(function (x) { return x.nome === ST.criar.nome; })) ST.criar.nome = ob.nome; ST.criar.passo = 2; return renderModelos(); }
  if (t.dataset.novopasso) { ST.criar.passo = Number(t.dataset.novopasso); return renderModelos(); }
  if (t.id === 'novo-criar') return criarModelo(t);
  if (t.id === 'st-envio-ligar') return ligarEnvio();
  if (t.dataset.stexcluir) return excluirModelo(t.dataset.stexcluir, false);
  if (t.dataset.strestaurar) return excluirModelo(t.dataset.strestaurar, true);
  if (t.dataset.compra) return registrarCompra(t);
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
  if (e.target.dataset && e.target.dataset.novopara && ST.criar) { mudarPara(ST.criar.para, e.target.dataset.novopara, e.target.value, e.target.checked); if (e.target.dataset.novopara === 'produto') renderCriar(); criarPode(); return renderPrevia(); }
  if (e.target.dataset && e.target.dataset.pq) {
    var mq = modeloAtual(), np = JSON.parse(JSON.stringify(mq.para_quem || {}));
    mudarPara(np, e.target.dataset.pq, e.target.value, e.target.checked);
    ['personas', 'materiais', 'etapas', 'segmentos', 'estagios'].forEach(function (g) { if (np[g] && !np[g].length) delete np[g]; });
    return salvarModelo({ para_quem: np, quem_recebe: paraResumo({ tipo: mq.tipo, para_quem: np }) }, 'Para quem salvo');
  }
  if (e.target.dataset && e.target.dataset.envio) return mudarEnvio(e.target.dataset.envio, e.target.value);
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
  if (CMP && e.target.id === 'compose-txt') { CMP.editado = e.target.value === CMP.e.body ? null : e.target.value; return cmpFormato(); }
  if (CMP && e.target.id === 'compose-subj') { $('cmp-env-subj').textContent = e.target.value; return; }
  if (e.target.matches && e.target.matches('input[data-f], textarea[data-f]') && ST.d) { setCampo(e.target.dataset.f, e.target.value); return aoEditar(); }
  if (e.target.dataset && e.target.dataset.ef && ST.d && podeEditar(versaoAberta())) {
    var val = e.target.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    if (!val.trim()) { val = ''; if (e.target.innerHTML !== '') e.target.innerHTML = ''; }   // vazio de verdade, para o texto de exemplo voltar
    setCampo(e.target.dataset.ef, val); return aoEditar({ path: e.target.dataset.ef, valor: val });
  }
  if (e.target.id === 'novo-nome' && ST.criar) { ST.criar.nome = e.target.value; return criarPode(); }
  if (e.target.id === 'st-q') {
    ST.q = e.target.value; var pos = e.target.selectionStart; renderPrevia();
    var q2 = $('st-q'); if (q2) { q2.focus(); q2.selectionStart = q2.selectionEnd = pos; }
  }
});
document.addEventListener('change', function (e) {
  if (!e.target.dataset || !e.target.dataset.radarsel || !RS) return;
  if (e.target.checked) RS.sel[e.target.dataset.radarsel] = true; else delete RS.sel[e.target.dataset.radarsel];
  var go = $('radar-enviar-go'); if (go) go.textContent = radarRotuloEnviar();
});
document.addEventListener('focusin', function (e) { if (e.target.dataset && (e.target.dataset.ef || (e.target.dataset.f && e.target.matches('input, textarea')))) ST.foco = e.target; });
// No "Editar no e-mail", colar entra como texto puro (sem a formatação de onde veio).
document.addEventListener('paste', function (e) {
  if (!(e.target.closest && e.target.closest('[data-ef]'))) return;
  e.preventDefault();
  document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
});
document.addEventListener('input', function (e) {
  if (e.target.dataset && e.target.dataset.dk && state.dos && state.dos.cid === e.target.dataset.cid) {
    var c0 = byC(e.target.dataset.cid), k0 = e.target.dataset.dk, antes = JSON.stringify(dosVisiveis(c0, state.dos.d, state.dos.rasc).map(function (b) { return b.campos.map(function (f) { return f.k; }); }));
    state.dos.rasc[k0] = e.target.value;
    // Uma resposta pode abrir ou esconder perguntas (persona, ano de au pair...): só redesenha quando isso muda.
    if (JSON.stringify(dosVisiveis(c0, state.dos.d, state.dos.rasc).map(function (b) { return b.campos.map(function (f) { return f.k; }); })) !== antes) {
      pintaDossie(c0); var el0 = $('dk-' + k0); if (el0 && el0.focus) el0.focus();
    }
    return;
  }
  if (e.target.id === 'reply-txt') $('reply-err').hidden = true;
  if (e.target.id === 'conv-txt') { state.rascunho[e.target.dataset.cid] = e.target.value; $('conv-err').hidden = true; }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'onb-email') { ONB.email = e.target.value; onbMostraErro(''); }
  if (e.target.id === 'onb-notas') ONB.notas = e.target.value;
});
document.addEventListener('change', function (e) {
  if (e.target.id !== 'onb-file') return;
  onbAdicionar(e.target.files); e.target.value = '';
});
// Arrastar e soltar: só dentro da área de documentos (soltar um arquivo em outro lugar não deve abri-lo no navegador).
function noOnbDrop(e) { return e.target && typeof e.target.closest === 'function' && e.target.closest('#onb-drop'); }
document.addEventListener('dragover', function (e) { var z = noOnbDrop(e); if (!z) return; e.preventDefault(); z.classList.add('arrastando'); });
document.addEventListener('dragleave', function (e) { var z = noOnbDrop(e); if (z) z.classList.remove('arrastando'); });
document.addEventListener('drop', function (e) {
  var z = noOnbDrop(e); if (!z) return;
  e.preventDefault(); z.classList.remove('arrastando');
  onbAdicionar(e.dataTransfer && e.dataTransfer.files);
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('tr[data-id]')) openPessoa(e.target.dataset.id);
  if (e.key === 'Escape' && !$('compose-modal').hidden) closeCompose();
});

boot().catch(function (err) { console.error(err); showGate('Erro ao abrir o CRM. Recarregue a página.'); });
