// Painel do CRM — lê e escreve no Supabase como a admin logada (RLS: tabela `admins`).
// Nada de service_role aqui. O banco é db/crm-fase2.sql; o desenho é o artefato "CRM Por Dentro".
// Tudo que vem do banco é texto de terceiros (nome, e-mail, pergunta): passa sempre por esc().
import { supabase } from '/assets/js/supabase-client.js';
import * as TX from './taxonomia.js?v=2026-11-19.5';   // páginas, famílias e agrupamento dos modelos
import * as ES from './estudio.js?v=2026-11-19.5';   // os blocos do estúdio de e-mails (entregas 2 e 3)
import * as EE from './editor-email.js?v=2026-11-19.5';
import * as EQ from './editor-quem.js?v=2026-11-19.5';
import * as JR from './jornada.js?v=2026-11-19.5';   // a matriz página × etapa do funil   // o e-mail editável do passo Texto
import * as FX from './ficha.js?v=2026-11-19.5';   // ficha v2: lógica pura (fila, démarches, funil, ações)
import * as FH from './ficha-html.js?v=2026-11-19.5';   // ficha v2: HTML puro
import * as PN from './panorama.js?v=2026-11-19.5';
import * as MT from './montagem.js?v=2026-11-19.5';   // Montagem do espaço a partir do transcript (lógica e HTML puros)   // Panorama dela e O que ela trouxe (lógica e HTML puros)

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
  'guia-vls-ts': 'Guia VLS-TS', 'guia-checklist-chegada-au-pair': 'Guia au pair: checklist de chegada', 'guia-mapa-saude-franca': 'Guia mapa da saúde na França', 'guia-rota-da-secu': 'Guia Rota da Sécu', 'guia-email-alt30': 'Guia alternância 30+', 'guia-tecnologo': 'Guia tecnólogo', 'guia-etudes-en-france-2027': 'Guia Campus France',
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
// Rota da Sécu (e Mapa da saúde): as duas perguntas gravam respostas.porta e respostas.ponto. Os textos são os mesmos de guias/rota-da-secu/casos.js
// (o teste crm-rota-ficha.test.mjs confere as duas listas).
var ROTA_PORTA = { estudante: 'Vim ou vou estudar na França', trabalho: 'Tenho contrato de trabalho', aupair: 'Vim ou vou como au pair', outro: 'Visto de família, PVT ou outro' };
var ROTA_PONTO = { nao_cheguei: 'Ainda não cheguei à França', sem_numero: 'Cheguei e ainda não pedi o meu número de sécu', esperando: 'Já pedi e estou esperando resposta', sem_vitale: 'Tenho o número, mas ainda não a carte vitale', completo: 'Já tenho a carte vitale' };
var ROTA_ACOMP = { chamada: 'Ligue sem medo', email: 'Escreva sem erro', mes: 'Resolva de ponta a ponta' };   // o pedido de acompanhamento da página Rota da Sécu (worker.js, ROTA_ACOMP)
var RESP_LABEL = { porta: ['Situação', function (v) { return ROTA_PORTA[v] || v; }], ponto: ['Ponto na Sécu', function (v) { return ROTA_PONTO[v] || v; }], cfNivel: ['Nível da candidatura (Campus France)', function (v) { return CF_NIVEL[v] || v; }], cfCidade: ['Cidade (tocou no e-mail 2)', function (v) { return CF_CIDADE[v] || v; }] };
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
function novosManuais() { return (M || []).filter(function (m) { return m.chave !== 'link_pagamento' && m.chave !== 'acesso_confirmado' && m.chave !== 'chat_aviso' && m.criado_no_estudio && !m.automatico && !m.excluido_em && versoesDe(m.chave).some(function (v) { return v.etapa === 'no_ar'; }); }); }
function exigeNovidades(k) { var m = modeloDe(k); return m && m.criado_no_estudio ? m.tipo === 'novidades' : !!EXIGEM_NOVIDADES[k]; }
// Rótulo, alavanca e quando usar, para o pop-up: os 8 do código (TPLS) ou o modelo novo.
function tplInfo(k) {
  if (TPLS[k]) return TPLS[k];
  var m = modeloDe(k) || {};
  return { label: m.nome || k, lever: (TIPO_EMAIL[m.tipo] || [''])[0], when: m.como_sai || '' };
}
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
// Avisos de problema que a cliente manda pelo botão do app (db/problemas-app.sql, no repositório do app). Sem o SQL, a aba avisa.
var P = [], PERR = '';
// Processos sugeridos esperando a sua decisão (db/crm-processos-sugeridos.sql). Sem a migração, fica vazio.
var PSUG = [];
var FILA = [];   // avisos agendados que ainda não saíram, de todas as pessoas (para o bloco da Hoje)
var state = { funilVisao: 'leads', funilPorque: null, dosAberto: lerDosAberto(), dos: null, pc: null, ptab: null, pstab: 'assistente', pdias: {}, int: null, chatRasc: '', rascunho: {}, view: 'hoje', persona: '', sub: '', urg: '', stage: '', orig: '', camp: '', q: '', sel: null, qs: 'nova', qsel: null, inbox: 'perguntas', rs: 'nova', rsel: null, ps: 'novo', psel: null, preset: 'todos', seg: '', prevView: 'contatos',
  fx: { tab: null, ord: null, abertas: {}, ag: { i: 0, pop: null }, dem: 'todas', ckTodos: false, ckMais: false, tour: true, r1: null, lg: { main: 1, a: 1 }, dd: {}, tema: null, coorte: null } };
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
// ---------- Potencial (0 a 100) ----------
// A lista de Contatos só tem as colunas de crm_contatos (e-mail mais recente, capturas, dias sem sinal, urgência, conta, assinatura); a ficha soma a isso
// os e-mails, as respostas, os cliques, o checklist e o link de pagamento. Os pesos são os de FX.potencial (rascunho a calibrar com a base real).
function potEntrada(c, o) {
  o = o || {};
  var assin = o.assin !== undefined ? o.assin : (ASSIN[c.id] || null);
  var dias = function (iso) { var t = Date.parse(iso || ''); return isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : null; };
  var ms = o.mails, st = c.email_status;
  var m = ms ? { total: ms.length, abertos: ms.filter(function (x) { return x.aberto_em || x.status === 'aberto' || x.status === 'clicado'; }).length,
    clicados: ms.filter(function (x) { return x.clicado_em || x.status === 'clicado'; }).length }
    : { total: st ? 1 : 0, abertos: st === 'aberto' || st === 'clicado' ? 1 : 0, clicados: st === 'clicado' ? 1 : 0 };
  var resp = o.respostas != null ? o.respostas : (c.resposta_aberta_id || c.pergunta_aberta_id ? 1 : 0);
  return { tipo: FX.tipoCabecalho(c, assin), etapa: FX.etapaFunil(c, { mails: ms || [], propostas: [], temBilan: !!o.temBilan, umFeito: umFeito(c.id) }), mails: m, respostas: resp,
    respostasNovas: o.respostasNovas != null ? o.respostasNovas : resp, capturas: Number(c.capturas) || 0, materiais: origensDe(c).length,
    diasSemSinal: c.dias != null && isFinite(Number(c.dias)) ? Number(c.dias) : null, urgencia: c.urgencia, linkPagamento: !!o.linkPagamento, assin: assin,
    ultimoAcessoDias: o.ultimoAcessoDias !== undefined ? o.ultimoAcessoDias : dias(c.ultimo_evento_em || c.criado_em), sessoes30: o.sessoes30, chk: o.chk || null, nome: displayName(c) };
}
function potDe(c) { return FX.potencial(potEntrada(c)); }
function potPill(p) {
  var tip = p.motivos.map(function (z) { return z.t + ' (' + (z.p > 0 ? '+' : '−') + Math.abs(z.p) + ')'; }).join(' · ') || 'Sem sinais ainda';
  return '<span class="pill pot-' + esc(p.faixa.toLowerCase().replace('é', 'e')) + '" title="' + esc(p.faixa + (p.poucosDados ? ' · poucos dados' : '') + ': ' + tip) + '"><b class="num">' + p.nota + '</b> ' + esc(p.faixa) + '</span>';
}
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
  await Promise.all([loadAll(), carregarProdutos(), carregarArtigos(), carregarPrecos()]);
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
    supabase.from('eventos').select('contato_id,dados,criado_em').eq('tipo', 'compra').limit(5000),
    // O Radar (db/crm-radar.sql): os itens do PESTEL por persona e o que já foi enviado. Sem a migração, a tela avisa.
    supabase.from('radar_itens').select('*').is('arquivado_em', null).order('criado_em', { ascending: false }).limit(500),
    supabase.from('radar_envios').select('item_id,contato_id,visto_em').limit(20000),
    supabase.from('processos_sugeridos').select('id,contato_id,processo,atualizada_em').eq('status', 'detectada').order('atualizada_em', { ascending: false }).limit(200),
    // Avisos de problema do app (db/problemas-app.sql do app). Sem o SQL, a tabela não existe: a aba Problemas avisa.
    supabase.from('problemas_app').select('*').order('criado_em', { ascending: false }).limit(1000),
    // A fila de avisos da IAssistente que ainda não saíram (db/crm-caso-fluxo.sql). Sem o SQL, o bloco da Hoje fica escondido.
    supabase.from('caso_avisos').select('id,contato_id,titulo,tipo,ordem,pausa_dias,liberar_em,modo').eq('estado', 'agendado').is('liberado_em', null).order('ordem', { ascending: true }).limit(500),
    // As assinaturas (db/crm-assinaturas.sql): separam quem já é cliente no Funil. Sem o SQL, todos ficam em Leads ou No app.
    supabase.from('assinaturas').select('contato_id,status,plano,moeda,teste_fim,periodo_fim,cancela_no_fim,criado_em').limit(5000),
    // Os 1:1 (db/crm-fase2.sql): alimentam o calendário e o indicador "1:1 marcados". Sem a tabela, ficam vazios.
    supabase.from('um_a_um').select('id,contato_id,quando,status,criado_em,registro').order('quando', { ascending: true }).limit(2000),
    // Os 1:1 pagos (db/crm-1a1.sql): quantos minutos e quando pagou. O valor em euros não é guardado: o Worker só repassa os minutos.
    supabase.from('um_a_um_pagamentos').select('contato_id,minutos,pago_em,um_a_um_id').order('pago_em', { ascending: false }).limit(2000),
    // O dinheiro que entrou de verdade (db/crm-pagamentos.sql, alimentado pelo webhook do Stripe): valor, serviço e quando. Sem o SQL, fica vazio.
    supabase.from('pagamentos').select('contato_id,tipo,servico,valor_centavos,moeda,pago_em').order('pago_em', { ascending: false }).limit(5000)
  ]);
  PAGOS = r[16] && !r[16].error ? (r[16].data || []) : [];
  PAGOS_ERRO = r[16] && r[16].error ? String(r[16].error.message || 'erro') : '';
  if (r[0].error) return fail('carregar os contatos', r[0].error);
  COMPRAS = {}; COMPRAS_EV = [];
  ((r[7] && !r[7].error && r[7].data) || []).forEach(function (e) { var p = (e.dados || {}).produto; if (p) { (COMPRAS[e.contato_id] = COMPRAS[e.contato_id] || {})[p] = 1; COMPRAS_EV.push({ produto: p, em: e.criado_em }); } });
  UM = r[14] && !r[14].error ? (r[14].data || []) : [];
  if (r[14] && r[14].error && /registro/.test(String(r[14].error.message || ''))) {   // a coluna registro ainda não existe (db/crm-1a1-registro.sql não rodou): carrega sem ela
    var u2 = await supabase.from('um_a_um').select('id,contato_id,quando,status,criado_em').order('quando', { ascending: true }).limit(2000);
    UM = u2 && !u2.error ? (u2.data || []) : [];
  }
  PAG1A1 = r[15] && !r[15].error ? (r[15].data || []) : [];
  if (r[15] && r[15].error && /um_a_um_id/.test(String(r[15].error.message || ''))) {   // o vínculo ainda não existe (db/crm-1a1-vinculo.sql não rodou): carrega sem ele
    var g2 = await supabase.from('um_a_um_pagamentos').select('contato_id,minutos,pago_em').order('pago_em', { ascending: false }).limit(2000);
    PAG1A1 = g2 && !g2.error ? (g2.data || []) : [];
  }
  C = r[0].data || [];
  ASSIN = {};
  ((r[13] && !r[13].error && r[13].data) || []).forEach(function (a) { ASSIN[a.contato_id] = a; });
  PSUG = r[10] && !r[10].error ? (r[10].data || []) : [];
  FILA = r[12] && !r[12].error ? (r[12].data || []) : [];
  P = r[11] && !r[11].error ? (r[11].data || []) : [];
  PERR = r[11] && r[11].error ? 'Falta rodar db/problemas-app.sql (repositório do app) neste banco, ou a leitura foi recusada.' : '';
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
var PRODUTOS = [], COMPRAS = {}, COMPRAS_EV = [], UM = [], PAG1A1 = [], PRECOS = [], PAGOS = [], PAGOS_ERRO = '';
function comprou(cid, prod) { return !!(COMPRAS[cid] && COMPRAS[cid][prod]); }
async function carregarProdutos() {
  try {
    var r = await fetch('/content/produtos-digitais.json', { cache: 'no-store' });
    var d = r.ok ? await r.json() : {};
    PRODUTOS = (d.items || []).filter(function (p) { return p.slug && p.title && p.active !== false && !/-teste$/.test(p.slug); })
      .map(function (p) { return { slug: p.slug, nome: p.title, preco: Number(p.price) > 0 ? Number(p.price) : null }; });
  } catch (e) { PRODUTOS = []; }
}
// Os preços de tabela das assinaturas (planos/planos.json, o mesmo da página /planos/). Sem o arquivo, a receita das assinaturas fica em zero.
async function carregarPrecos() {
  try {
    var r = await fetch('/planos/planos.json', { cache: 'no-store' });
    var d = r.ok ? await r.json() : {};
    PRECOS = (d.itens || []).filter(function (x) { return x && x.chave && Number(x.valor) > 0; }).map(function (x) { return { chave: x.chave, valor: Number(x.valor), moeda: x.moeda || 'EUR', mensal: !x.periodicidade || /mensal/i.test(x.periodicidade) }; });
  } catch (e) { PRECOS = []; }
}
function produtoNome(slug) { var p = PRODUTOS.filter(function (x) { return x.slug === slug; })[0]; return p ? p.nome : (slug || '—'); }
// Os artigos do site (content/posts.json, público): a pergunta única guarda só o "token" do artigo (o slug sem acento, até 40 letras).
// Aqui o token volta a ser o título e o endereço do artigo. Sem o arquivo, a tela mostra o próprio token.
var ARTIGOS = {};
function artigoToken(slug) { return String(slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); }
async function carregarArtigos() {
  try {
    var r = await fetch('/content/posts.json', { cache: 'no-store' });
    var d = r.ok ? await r.json() : {};
    ARTIGOS = {};
    (d.items || []).forEach(function (p) { if (p.slug && p.title) ARTIGOS[artigoToken(p.slug)] = { titulo: p.title, url: '/artigos/post/' + p.slug + '/' }; });
  } catch (e) { ARTIGOS = {}; }
}
function artigoDe(origem) {
  if (!origem) return null;
  var a = ARTIGOS[origem];
  return a ? { titulo: a.titulo, url: a.url } : { titulo: origem, url: null };
}
// Só o link do artigo de onde veio a pergunta (o título fica na dica). Sem o artigo na lista, mostra o código dele.
function artigoLink(origem) {
  var a = artigoDe(origem); if (!a) return '';
  return a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" title="' + esc(a.titulo) + '">Ver o artigo ↗</a>' : 'Artigo: ' + esc(a.titulo);
}
function artigoHtml(origem) {
  var a = artigoDe(origem); if (!a) return '';
  return a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.titulo) + '</a>' : esc(a.titulo);
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
// ---------- Indicadores da Hoje: um período só (7, 14, 30 dias, 3 e 6 meses) vale para os quatro ----------
var KPER_ROT = { 7: '7 dias', 14: '14 dias', 30: '30 dias', 90: '3 meses', 180: '6 meses' };
function eur(v) { return '€ ' + (Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
// Receita entre ini e fim. O que o Stripe confirmou (tabela pagamentos, valor real) entra como veio. O que ainda não tem registro entra
// por conta de tabela: compras de produto registradas à mão (preço da vitrine) e, só para quem NÃO tem mensalidade paga registrada, as
// mensalidades das assinaturas ativas (1ª cobrança no fim do teste, ou na criação, e uma por mês). Cupom e reembolso não entram na parte estimada.
// Devolve { total (em €), porMoeda: { EUR: x, BRL: y }, pagamentos, compras, mensalidades }. Outras moedas ficam fora do total em €.
function receitaEstimada(ini, fim) {
  var porMoeda = {}, nPag = 0, nCompras = 0, nMens = 0, agora = Date.now();
  var soma = function (moeda, v) { porMoeda[moeda] = (porMoeda[moeda] || 0) + v; };
  var comMensalidadeReal = {};
  PAGOS.forEach(function (g) {
    if (g.tipo === 'assinatura') comMensalidadeReal[g.contato_id] = true;
    var t = new Date(g.pago_em);
    if (t >= ini && t < fim && Number(g.valor_centavos) > 0) { soma(String(g.moeda || 'EUR').toUpperCase(), Number(g.valor_centavos) / 100); nPag++; }
  });
  COMPRAS_EV.forEach(function (e) {
    var t = new Date(e.em), p = PRODUTOS.filter(function (x) { return x.slug === e.produto; })[0];
    if (t >= ini && t < fim && p && p.preco) { soma('EUR', p.preco); nCompras++; }
  });
  Object.keys(ASSIN).forEach(function (k) {
    var a = ASSIN[k]; if (a.status !== 'active' || comMensalidadeReal[k]) return;
    var pl = PRECOS.filter(function (x) { return x.chave === a.plano; })[0] || (PRECOS.length === 1 ? PRECOS[0] : null);
    if (!pl || !pl.mensal) return;
    var base = new Date(a.teste_fim || a.criado_em); if (isNaN(base)) return;
    var limite = Math.min(agora, a.periodo_fim ? new Date(a.periodo_fim).getTime() + 864e5 : agora);
    for (var i = 0; i < 120; i++) {
      var d = new Date(base.getTime()); d.setMonth(d.getMonth() + i);
      if (d.getTime() > limite) break;
      if (d >= ini && d < fim) { soma(String(pl.moeda || 'EUR').toUpperCase(), pl.valor); nMens++; }
    }
  });
  return { total: porMoeda.EUR || 0, porMoeda: porMoeda, pagamentos: nPag, compras: nCompras, mensalidades: nMens };
}
// As moedas que não são euro, para o texto abaixo do indicador: "+ R$ 600".
function receitaOutras(rv) { return Object.keys(rv.porMoeda).filter(function (m) { return m !== 'EUR' && rv.porMoeda[m] > 0; }).map(function (m) { return FX.fmtMoeda(rv.porMoeda[m], m); }); }
function renderKpis() {
  var sel = $('k-per'); if (!sel) return;
  var dias = Number(state.kper || 7), agora = Date.now(), ini = new Date(agora - dias * 864e5), ant = new Date(agora - 2 * dias * 864e5), rot = KPER_ROT[dias] || dias + ' dias';
  sel.value = String(dias);
  var delta = function (n, m) { return (n - m >= 0 ? '+' : '') + (n - m) + ' vs. os ' + rot + ' antes'; };
  var noPer = function (iso, a, b) { var t = new Date(iso); return t >= a && t < b; };
  // Novos leads
  var l1 = C.filter(function (c) { return noPer(c.criado_em, ini, new Date(agora + 1)); }).length, l0 = C.filter(function (c) { return noPer(c.criado_em, ant, ini); }).length;
  $('k-leads').textContent = l1; $('k-leads-sub').textContent = delta(l1, l0); $('k-leads-sub').className = l1 >= l0 ? 'up' : '';
  // 1:1 marcados (a data em que você marcou, não a da conversa)
  var vivos = UM.filter(function (x) { return x.status !== 'cancelado'; });
  var u1 = vivos.filter(function (x) { return noPer(x.criado_em, ini, new Date(agora + 1)); }).length, u0 = vivos.filter(function (x) { return noPer(x.criado_em, ant, ini); }).length;
  $('k-um').textContent = u1; $('k-um-sub').textContent = delta(u1, u0); $('k-um-sub').className = u1 >= u0 ? 'up' : '';
  // Pessoas na plataforma: com conta e com atividade no período
  var comConta = C.filter(function (c) { return c.user_id && c.estagio !== 'inativo'; });
  var ativas = comConta.filter(function (c) { return noPer(c.ultimo_evento_em || c.criado_em, ini, new Date(agora + 1)); }).length;
  $('k-plat').textContent = ativas; $('k-plat-sub').textContent = 'com atividade, de ' + comConta.length + ' com conta';
  // Revenue estimado
  var rv = receitaEstimada(ini, new Date(agora + 1)), rv0 = receitaEstimada(ant, ini);
  var outras = receitaOutras(rv), partes = [];
  if (rv.pagamentos) partes.push(rv.pagamentos + (rv.pagamentos === 1 ? ' pagamento' : ' pagamentos'));
  if (rv.compras) partes.push(rv.compras + (rv.compras === 1 ? ' compra' : ' compras'));
  if (rv.mensalidades) partes.push(rv.mensalidades + (rv.mensalidades === 1 ? ' mensalidade estimada' : ' mensalidades estimadas'));
  $('k-rev').textContent = eur(rv.total);
  $('k-rev-sub').textContent = (partes.length ? partes.join(' + ') : 'nada registrado no período') + (outras.length ? ' · + ' + outras.join(' + ') : '') + ' · antes: ' + eur(rv0.total);
  $('k-rev-sub').title = 'Pagamentos confirmados pelo Stripe entram com o valor real (db/crm-pagamentos.sql). Compras de produto e mensalidades sem registro entram pelo preço de tabela, sem cupom.' + (PAGOS_ERRO ? ' Atenção: não consegui ler a tabela pagamentos (' + PAGOS_ERRO + '): falta rodar o SQL?' : '');
  $('k-rev-sub').className = rv.total >= rv0.total ? 'up' : '';
}
// ---------- Calendário de 1:1: o mês (com os dias que têm conversa) e a lista do que vem pela frente ----------
function renderCalendario() {
  var box = $('today-cal'); if (!box) return;
  var agora = new Date(), off = state.calOff || 0, mes = new Date(agora.getFullYear(), agora.getMonth() + off, 1);
  var ag = UM.filter(function (x) { return x.status === 'agendado'; });
  var comData = ag.filter(function (x) { return x.quando; }), semData = ag.filter(function (x) { return !x.quando; });
  var dia = function (iso) { var d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  var porDia = {}; comData.forEach(function (x) { porDia[dia(x.quando)] = (porDia[dia(x.quando)] || 0) + 1; });
  var rotMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  $('cal-mes').textContent = rotMes.charAt(0).toUpperCase() + rotMes.slice(1);
  var primeiro = (mes.getDay() + 6) % 7, nDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate(), hoje = dia(agora.toISOString()), sel = state.calDia || '';
  var grade = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(function (l) { return '<span class="cal-h" aria-hidden="true">' + l + '</span>'; }).join('');
  for (var i = 0; i < primeiro; i++) grade += '<span></span>';
  for (var d = 1; d <= nDias; d++) {
    var k = mes.getFullYear() + '-' + (mes.getMonth() + 1) + '-' + d, n = porDia[k] || 0, cls = 'cal-d' + (k === hoje ? ' hoje' : '') + (n ? ' tem' : '') + (k === sel ? ' dia-sel' : '');
    grade += n ? '<button type="button" class="' + cls + '" data-caldia="' + k + '" aria-pressed="' + (k === sel) + '" aria-label="' + d + ': ' + n + (n === 1 ? ' conversa' : ' conversas') + '">' + d + '<i class="cal-n">' + n + '</i></button>'
      : '<span class="' + cls + '">' + d + '</span>';
  }
  // Minutos e pagamento de cada 1:1: o último pagamento da pessoa até a hora da conversa (ou o mais recente).
  var pagDe = function (x) {
    var ps = PAG1A1.filter(function (p) { return p.contato_id === x.contato_id; }); if (!ps.length) return null;
    var antes = ps.filter(function (p) { return !x.quando || p.pago_em <= x.quando; });
    return (antes.length ? antes : ps)[0];
  };
  // Uma conversa: a hora à esquerda, quem é, a persona e o que ela pagou (minutos).
  var linha = function (x, hora) {
    var c = byC(x.contato_id); if (!c) return '';
    var p = pagDe(x), det = [personaLabel(c)];
    det.push(p ? 'pago em ' + fmtDate(p.pago_em) : 'sem pagamento registrado');
    return '<button class="row cal-ag" data-open="' + esc(c.id) + '" type="button"><span class="cal-hora num">' + esc(hora) + '</span><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) + '</b><span>' + esc(det.join(' · ')) + '</span></div>' + (p ? '<span class="pill out num">' + p.minutos + ' min</span>' : '') + '</button>';
  };
  // As conversas agrupadas por dia: um cabeçalho por dia (Hoje, Amanhã ou o dia da semana) e as horas embaixo.
  var rotDia = function (iso) {
    var d0 = new Date(iso), a0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()), b0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()), dif = Math.round((b0 - a0) / 864e5);
    var base = d0.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace('-feira', '');
    return (dif === 0 ? 'Hoje · ' : dif === 1 ? 'Amanhã · ' : '') + base.charAt(0).toUpperCase() + base.slice(1);
  };
  var agrupa = function (xs) {
    var out = '', i = 0;
    while (i < xs.length) {
      var k = dia(xs[i].quando), g = []; while (i < xs.length && dia(xs[i].quando) === k) g.push(xs[i++]);
      out += '<section class="cal-dia"><header class="cal-dia-h"><b>' + esc(rotDia(g[0].quando)) + '</b><span class="sub">' + g.length + (g.length === 1 ? ' conversa' : ' conversas') + '</span></header>' + g.map(function (x) { return linha(x, fmtHora(x.quando)); }).join('') + '</section>';
    }
    return out;
  };
  var fil = state.calFil || '', lista, cab = '';
  var filBtn = function (v, rot) { return '<button type="button" class="chip" data-calfil="' + v + '" aria-pressed="' + (fil === v) + '">' + rot + '</button>'; };
  var filtros = '<div class="cal-fil" role="group" aria-label="Período da lista">' + filBtn('', 'Próximas') + filBtn('7', '7 dias') + filBtn('30', '30 dias') + filBtn('mes', 'Mês') + '</div>';
  var porHora = function (a, b) { return a.quando < b.quando ? -1 : 1; };
  if (sel) {
    var doDia = comData.filter(function (x) { return dia(x.quando) === sel; }).sort(porHora);
    cab = '<div class="cal-cab"><button class="link" type="button" data-caldia="">← Ver as próximas</button></div>';
    lista = agrupa(doDia);
  } else if (fil) {
    var t0 = fil === 'mes' ? mes.getTime() : agora.getTime() - 36e5, t1 = fil === 'mes' ? new Date(mes.getFullYear(), mes.getMonth() + 1, 1).getTime() : agora.getTime() + Number(fil) * 864e5;
    var noPeriodo = comData.filter(function (x) { var t = new Date(x.quando).getTime(); return t >= t0 && t < t1; }).sort(porHora);
    cab = '<div class="cal-cab"><span class="sub">' + noPeriodo.length + (noPeriodo.length === 1 ? ' conversa' : ' conversas') + (fil === 'mes' ? ' neste mês' : ' nos próximos ' + fil + ' dias') + '</span></div>';
    lista = agrupa(noPeriodo);
  } else {
    var prox = comData.filter(function (x) { return new Date(x.quando).getTime() >= agora.getTime() - 36e5; }).sort(porHora);
    lista = agrupa(prox.slice(0, 6)) + (semData.length ? '<section class="cal-dia"><header class="cal-dia-h"><b>A combinar</b><span class="sub">' + semData.length + ' sem data</span></header>' + semData.map(function (x) { return linha(x, '—'); }).join('') + '</section>' : '') + (prox.length > 6 ? '<p class="sub cal-mais">Mais ' + (prox.length - 6) + ' depois destas: escolha um dia no calendário ou um período acima.</p>' : '');
  }
  box.innerHTML = filtros + '<div class="cal-corpo"><div class="cal-grade">' + grade + '</div><div class="cal-direita">' + cab + (lista ? '<div class="cal-lista">' + lista + '</div>' : '<div class="empty">' + (fil ? 'Nenhum 1:1 neste período.' : 'Nenhum 1:1 marcado.') + '</div>') + '</div></div>';
}
// ---------- Por onde começar: tudo o que espera por você, por tipo, na ordem que você escolhe ----------
// Cada item vem com a data desde quando espera (desde) e, se tem, os dias até o prazo. Quem já está com o prazo vencido vai sempre
// para o fim da fila: o atraso não é seu. A ordem padrão é a dos mais antigos primeiro; a outra põe o prazo mais próximo na frente.
var FILA_CATS = [
  ['tudo', 'Tudo que precisa de mim'], ['responder', 'Responder: caixa de entrada'], ['prazo', 'Prazos chegando'], ['voltou', 'Voltaram a pedir material'],
  ['urgencia', 'Marcaram urgência'], ['paradas', 'Paradas'], ['problemas', 'Problemas do app'], ['processos', 'Processos para revisar'], ['vencido', 'Prazo já vencido (por último)']
];
function catDoContato(c) {
  var m = String(c.motivo || '');
  if (/^(respondeu|escreveu)/.test(m)) return null;   // já entram pela caixa de entrada
  if (/venceu há/.test(m)) return 'vencido';           // antes do "vence": "venceu" também começa com "vence"
  if (/^prazo do VLS-TS vence/.test(m)) return 'prazo';
  if (/^voltou a deixar/.test(m)) return 'voltou';
  if (/^parada há/.test(m)) return 'paradas';
  return 'urgencia';
}
function itensDeHoje() {
  var out = [];
  Q.filter(function (x) { return x.status === 'nova' && byC(x.contato_id); }).forEach(function (x) { out.push({ cat: 'responder', k: 'q', x: x, desde: x.criado_em }); });
  R.filter(function (x) { return x.status === 'nova'; }).forEach(function (x) { out.push({ cat: 'responder', k: 'r', x: x, desde: x.recebido_em }); });
  P.filter(function (x) { return x.status === 'novo'; }).forEach(function (x) { out.push({ cat: 'problemas', k: 'p', x: x, desde: x.criado_em }); });
  PSUG.filter(function (p) { return byC(p.contato_id); }).forEach(function (p) { out.push({ cat: 'processos', k: 'proc', x: p, c: byC(p.contato_id), desde: p.atualizada_em }); });
  C.filter(function (c) { return c.motivo && c.estagio !== 'concluido' && c.estagio !== 'inativo'; }).forEach(function (c) {
    var cat = catDoContato(c); if (!cat) return;
    out.push({ cat: cat, k: 'c', c: c, desde: (cat === 'voltou' && c.ultima_captura_em) || c.ultimo_evento_em || c.criado_em, dias: c.dias_para_prazo == null ? null : Number(c.dias_para_prazo) });
  });
  return out;
}
function ordenaFila(l, ord) {
  var porData = function (a, b) { return a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0; };
  var cmp = function (a, b) {
    var va = a.cat === 'vencido', vb = b.cat === 'vencido';
    if (va !== vb) return va ? 1 : -1;                                   // vencidos sempre por último
    if (va && vb) return (b.dias || 0) - (a.dias || 0);                  // entre eles, o que venceu há menos tempo primeiro
    if (ord === 'prazo') {
      var pa = a.dias != null && a.dias >= 0 ? a.dias : 99999, pb = b.dias != null && b.dias >= 0 ? b.dias : 99999;
      if (pa !== pb) return pa - pb;
    }
    return porData(a, b);
  };
  return l.slice().sort(cmp);
}
function itemFilaHtml(it) {
  var h = hrsSince(it.desde), idade = '<span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + hrs(h) + '</span>';
  if (it.k === 'q' || it.k === 'r') {
    var x = it.x, c = byC(x.contato_id);
    var who = c ? esc(short(c)) : esc(x.de_email) + ' <span class="persona" style="display:inline;font-size:11.5px">· sem ficha</span>';
    return '<button class="row" ' + (it.k === 'q' ? 'data-openq' : 'data-openr') + '="' + x.id + '" type="button">' + (c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div>' : '<div class="av b">@</div>') +
      '<div class="who"><b>' + who + '</b><span>' + (it.k === 'r' ? canalDe(x)[0] + ' ' : 'Pergunta: ') + esc(x.texto) + '</span></div>' + idade + '</button>';
  }
  if (it.k === 'p') return '<button class="row" data-hojeprob="1" type="button"><div class="av b">!</div><div class="who"><b>Problema no app</b><span>' + esc(PROB_CAT[it.x.categoria] || it.x.categoria) + ': ' + esc(it.x.texto) + '</span></div>' + idade + '</button>';
  var c2 = it.c;
  if (it.k === 'proc') return '<button class="row" data-open="' + esc(c2.id) + '" type="button"><div class="' + avClass(c2) + '">' + esc(ini(c2)) + '</div><div class="who"><b>' + esc(short(c2)) + '</b><span>Possível novo processo: ' + esc(procLabel(it.x.processo)) + '</span></div><span class="pill u-media">revisar</span></button>';
  return '<button class="row" data-open="' + esc(c2.id) + '" type="button"><div class="' + avClass(c2) + '">' + esc(ini(c2)) + '</div><div class="who"><b>' + esc(short(c2)) +
    ' <span class="persona" style="display:inline;font-size:11.5px">· ' + esc(personaLabel(c2)) + '</span></b><span>' + esc(c2.motivo) + '</span></div>' + urgPill(c2.urgencia) + '</button>';
}
function renderFila(todos) {
  var box = $('attention'), sel = $('h-cat'); if (!box || !sel) return;
  todos = todos || itensDeHoje();
  var cat = state.hCat || 'tudo', ord = state.hOrd || 'antigos';
  var n = function (k) { return k === 'tudo' ? todos.length : todos.filter(function (i) { return i.cat === k; }).length; };
  if (document.activeElement !== sel) sel.innerHTML = FILA_CATS.filter(function (k) { return k[0] === 'tudo' || n(k[0]) > 0 || k[0] === cat; }).map(function (k) {
    return '<option value="' + k[0] + '"' + (k[0] === cat ? ' selected' : '') + '>' + esc(k[1]) + ' (' + n(k[0]) + ')</option>';
  }).join('');
  $('h-ord').value = ord;
  var lista = ordenaFila(cat === 'tudo' ? todos : todos.filter(function (i) { return i.cat === cat; }), ord);
  var vel = lista.filter(function (i) { return i.desde; }).sort(function (a, b) { return a.desde < b.desde ? -1 : 1; })[0];
  $('h-resumo').textContent = lista.length ? lista.length + (lista.length === 1 ? ' item' : ' itens') + (vel ? ' · o mais antigo espera há ' + hrs(hrsSince(vel.desde)) : '') : '';
  var lim = state.hMais ? lista.length : 8;
  box.innerHTML = lista.slice(0, lim).map(itemFilaHtml).join('') || '<div class="empty">Nada pedindo você agora.</div>';
  if (lista.length > lim) box.innerHTML += '<button class="link fila-mais" type="button" data-hojemais="1">Ver mais ' + (lista.length - lim) + '</button>';
}
function renderToday() {
  var d = new Date();
  $('hello').textContent = (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite') + ', Ingryd';
  var itensHoje = itensDeHoje();
  renderFila(itensHoje);

  // Processos sugeridos esperando você: um por linha, abre a ficha (onde estão os sinais e os botões).
  var procs = PSUG.filter(function (p) { return byC(p.contato_id); });
  $('today-procs-box').hidden = !procs.length;
  $('today-procs').innerHTML = procs.slice(0, 8).map(function (p) {
    var c = byC(p.contato_id);
    return '<button class="row" data-open="' + esc(c.id) + '" type="button"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div class="who"><b>' + esc(short(c)) +
      '</b><span>Possível novo processo: ' + esc(procLabel(p.processo)) + '</span></div><span class="pill u-media">revisar</span></button>';
  }).join('');

  var nq = Q.filter(function (x) { return x.status === 'nova'; }), nr = R.filter(function (x) { return x.status === 'nova'; });
  var caixa = caixaLista();
  $('today-q').innerHTML = caixa.slice(0, 5).map(function (it) {
    var x = it.x, c = byC(x.contato_id), h = hrsSince(it.em);
    if (it.k === 'q' && !c) return '';
    var who = c ? esc(short(c)) : esc(x.de_email) + ' <span class="persona" style="display:inline;font-size:11.5px">· sem ficha</span>';
    return '<button class="row" ' + (it.k === 'q' ? 'data-openq' : 'data-openr') + '="' + x.id + '" type="button">' + (c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div>' : '<div class="av b">@</div>') +
      '<div class="who"><b>' + who + '</b><span>' + (it.k === 'r' ? canalDe(x)[0] + ' ' : '') + esc(x.texto) + '</span></div><span class="sla num ' + (h >= 72 ? 'late' : 'ok') + '">' + hrs(h) + '</span></button>';
  }).join('') || '<div class="empty">Tudo respondido.</div>';

  renderKpis();
  $('hello-sub').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + itensHoje.length + (itensHoje.length === 1 ? ' coisa pede' : ' coisas pedem') + ' você hoje';

  var np = P.filter(function (x) { return x.status === 'novo'; }).length;
  $('c-perguntas').textContent = nq.length + nr.length + np; $('c-perguntas').hidden = nq.length + nr.length + np === 0;
  $('c-contatos').textContent = C.length;

  renderCalendario();
  renderLembretes();
  renderGuias();
  renderRadarHoje();
  renderFilaHoje();
  renderHojeResumo();
}

// Caixa de entrada: perguntas e respostas por e-mail juntas, a mais antiga primeiro.
function caixaLista() {
  var nq = Q.filter(function (x) { return x.status === 'nova'; }), nr = R.filter(function (x) { return x.status === 'nova'; });
  return nq.map(function (x) { return { k: 'q', x: x, em: x.criado_em }; })
    .concat(nr.map(function (x) { return { k: 'r', x: x, em: x.recebido_em }; }))
    .sort(function (a, b) { return a.em < b.em ? -1 : 1; });
}
// ---------- Hoje: Resumo e abas (uma seção por vez, nada rola por dentro) ----------
var HOJE_ABAS = [['resumo', 'Resumo'], ['fila', 'Precisa de você'], ['agenda', 'Agenda'], ['msgs', 'Mensagens'], ['caixa', 'Caixa'], ['procs', 'Processos'], ['radar', 'Radar'], ['guias', 'Guias'], ['prazos', 'Prazos']];
function cortaTxt(t, n) { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
function linhaDoItem(it) {
  if (it.k === 'q' || it.k === 'r') { var c = byC(it.x.contato_id); return (c ? short(c) : it.x.de_email || 'Sem ficha') + ': ' + cortaTxt(it.x.texto, 70); }
  if (it.k === 'p') return 'Problema no app: ' + cortaTxt(it.x.texto, 70);
  if (it.k === 'proc') return short(it.c) + ': possível novo processo (' + procLabel(it.x.processo) + ')';
  return short(it.c) + ': ' + cortaTxt(it.c.motivo, 70);
}
// O mais urgente da fila: problema do app, depois resposta parada há 72 h ou mais, depois prazo em até 7 dias; senão o primeiro.
function itemMaisUrgente(lista) {
  var pontos = function (it) { return it.k === 'p' ? 3 : (it.k === 'q' || it.k === 'r') && hrsSince(it.desde) >= 72 ? 2 : it.dias != null && it.dias >= 0 && it.dias <= 7 ? 2 : 0; };
  var melhor = null, mp = -1; lista.forEach(function (it) { var p = pontos(it); if (p > mp) { mp = p; melhor = it; } });
  return { it: melhor, urgente: mp >= 2 };
}
function filaProximas() {
  var proximas = {}; FILA.forEach(function (a) { if (!proximas[a.contato_id]) proximas[a.contato_id] = a; });
  var t = function (a) { return a.liberar_em ? new Date(a.liberar_em).getTime() : Infinity; };
  return Object.keys(proximas).map(function (cid) { return proximas[cid]; }).filter(function (a) { return byC(a.contato_id); }).sort(function (a, b) { return t(a) - t(b); });
}
// Os números e a linha de cada seção, calculados com o que a Hoje já carregou (nenhuma chamada nova).
function hojeSecoes() {
  var agora = Date.now(), r = {}, o;
  var fila = ordenaFila(itensDeHoje(), 'antigos'); o = itemMaisUrgente(fila);
  r.fila = { n: fila.length, urg: o.urgente, linha: o.it ? linhaDoItem(o.it) : '', btn: 'Começar pela fila →' };
  var um = UM.filter(function (x) { return x.status === 'agendado' && x.quando; }).sort(function (a, b) { return a.quando < b.quando ? -1 : 1; });
  var prox = um.filter(function (x) { return new Date(x.quando).getTime() >= agora - 36e5; }), n30 = prox.filter(function (x) { return new Date(x.quando).getTime() <= agora + 30 * 864e5; });
  var p1 = prox[0], c1 = p1 && byC(p1.contato_id), hojeIso = new Date().toISOString().slice(0, 10);
  r.agenda = { n: n30.length, urg: !!(p1 && p1.quando.slice(0, 10) === hojeIso), linha: p1 ? 'Próximo: ' + (c1 ? short(c1) : 'contato') + ' · ' + new Date(p1.quando).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') + ' · ' + fmtHora(p1.quando) : '', btn: 'Abrir agenda →' };
  var fp = filaProximas(), f1 = fp[0];
  r.msgs = { n: fp.length, urg: false, linha: f1 ? short(byC(f1.contato_id)) + ': ' + cortaTxt(f1.titulo, 50) + ' · ' + casoSaiEm(f1) : '', btn: 'Revisar fila →' };
  var cx = caixaLista().filter(function (it) { return it.k !== 'q' || byC(it.x.contato_id); }), x1 = cx[0];
  r.caixa = { n: cx.length, urg: !!(x1 && hrsSince(x1.em) >= 72), linha: x1 ? (byC(x1.x.contato_id) ? short(byC(x1.x.contato_id)) : x1.x.de_email || 'Sem ficha') + ' espera há ' + hrs(hrsSince(x1.em)) : '', btn: 'Responder →', go: 'perguntas' };
  var pr = PSUG.filter(function (p) { return byC(p.contato_id); });
  r.procs = { n: pr.length, urg: false, linha: pr[0] ? short(byC(pr[0].contato_id)) + ': ' + procLabel(pr[0].processo) : '', btn: 'Revisar →' };
  var sem = [], tot = 0;
  if (RD !== null) PERSONAS_RADAR.forEach(function (p) { var n = radarSemAviso(radarDaPersona(p)).length; if (n) { tot += n; sem.push(PERSONAS[p]); } });
  r.radar = { n: tot, urg: false, linha: RD === null ? 'O Radar ainda não está ligado.' : sem.length ? 'Sem aviso: ' + sem.join(', ') : '', btn: 'Abrir Radar →', go: 'radar' };
  var vol = C.filter(voltou).length, ng = {}; C.forEach(function (c) { origensDe(c).forEach(function (o2) { if (o2.indexOf('guia-') === 0) ng[o2] = 1; }); });
  r.guias = { n: vol, urg: false, linha: vol ? vol + (vol === 1 ? ' pessoa voltou' : ' pessoas voltaram') + ' a pedir material · ' + Object.keys(ng).length + ' guias' : '', btn: 'Quem voltou →', go: 'contatos', preset: 'voltaram' };
  var hoje = hojeIso, em7 = new Date(agora + 7 * 864e5).toISOString().slice(0, 10), lm = L.filter(function (l) { return l.avisar_em <= em7; }).sort(function (a, b) { return a.avisar_em < b.avisar_em ? -1 : 1; }), l1 = lm[0], cl = l1 && byC(l1.contato_id);
  r.prazos = { n: lm.length, urg: !!(l1 && l1.avisar_em <= hoje), linha: l1 ? (cl ? short(cl) : 'Contato') + ' · prazo ' + fmtDay(l1.prazo) + (l1.avisar_em <= hoje ? ' · avisar hoje' : '') : '', btn: 'Ver prazos →' };
  return r;
}
var HOJE_CARTOES = [['fila', 'Precisa de você'], ['agenda', 'Agenda 1:1'], ['msgs', 'Mensagens da Equipe Por Dentro'], ['caixa', 'Caixa de entrada'], ['procs', 'Processos para revisar'], ['radar', 'Radar por persona'], ['guias', 'Guias'], ['prazos', 'Prazos']];
function hojeAbaAtual(sec) {
  var k = state.hojeAba; if (!k) { try { k = localStorage.getItem('crm_hoje_aba') || ''; } catch (e) { k = ''; } }
  if (!HOJE_ABAS.some(function (a) { return a[0] === k; }) || (k === 'procs' && !sec.procs.n)) k = 'resumo';
  return (state.hojeAba = k);
}
function renderHojeResumo() {
  var box = $('hj-resumo'), tabs = $('hj-abas'); if (!box || !tabs) return;
  var sec = hojeSecoes(), atual = hojeAbaAtual(sec);
  tabs.innerHTML = HOJE_ABAS.filter(function (a) { return a[0] !== 'procs' || sec.procs.n; }).map(function (a) {
    var s = sec[a[0]], b = s && s.n ? '<span class="hj-b' + (s.urg ? ' urg' : '') + ' num">' + s.n + '</span>' : '';
    return '<button type="button" class="hj-aba" role="tab" data-hojeaba="' + a[0] + '" aria-selected="' + (a[0] === atual) + '">' + esc(a[1]) + b + '</button>';
  }).join('');
  box.innerHTML = HOJE_CARTOES.filter(function (c) { return c[0] !== 'procs' || sec.procs.n; }).map(function (c) {
    var s = sec[c[0]], vazio = !s.n, go = s.go ? ' data-go="' + s.go + '"' + (s.preset ? ' data-view-preset="' + s.preset + '"' : '') : ' data-hojeaba="' + c[0] + '"';
    return '<article class="hj-card' + (s.urg ? ' urg' : '') + (vazio ? ' vazio' : '') + '"><header><button type="button" class="hj-tit" data-hojeaba="' + c[0] + '">' + esc(c[1]) + '</button><span class="hj-n num">' + s.n + '</span></header>' +
      '<p class="hj-linha">' + (vazio ? (s.linha ? esc(s.linha) : 'Nada pendente.') : esc(s.linha)) + '</p>' +
      (vazio ? '' : '<button type="button" class="hj-go"' + go + '>' + esc(s.btn) + '</button>') + '</article>';
  }).join('');
  document.querySelectorAll('[data-hojepane]').forEach(function (p) { p.hidden = p.getAttribute('data-hojepane') !== atual; });
}
function hojeIrAba(k) {
  state.hojeAba = k; try { localStorage.setItem('crm_hoje_aba', k); } catch (e) { /* sem localStorage */ }
  renderHojeResumo(); var t = $('hj-abas'); if (t && t.scrollIntoView && k !== 'resumo') t.scrollIntoView({ block: 'nearest' });
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
  var list = filtered().map(function (c) { return { c: c, p: potDe(c) }; });
  if (state.potOrd) list.sort(function (a, b) { return state.potOrd === 'asc' ? a.p.nota - b.p.nota : b.p.nota - a.p.nota; });
  var thp = $('th-pot'); if (thp) { thp.textContent = 'Potencial' + (state.potOrd === 'asc' ? ' ↑' : state.potOrd === 'desc' ? ' ↓' : ''); thp.setAttribute('aria-sort', state.potOrd === 'asc' ? 'ascending' : state.potOrd === 'desc' ? 'descending' : 'none'); }
  $('result-count').textContent = list.length;
  $('tbody').innerHTML = list.map(function (it) {
    var c = it.c;
    return '<tr data-id="' + esc(c.id) + '" aria-selected="' + (c.id === state.sel) + '" tabindex="0">' +
      '<td><div class="nm"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div><b>' + esc(displayName(c)) + (voltou(c) ? ' <span class="pill" title="Deixou o e-mail ' + nCapturas(c) + ' vezes">voltou ×' + nCapturas(c) + '</span>' : '') + '</b><span>' + esc(c.email) + '</span></div></div></td>' +
      '<td><span class="persona">' + esc(personaLabel(c)) + '</span><div class="sub">' + esc(subLabel(c)) + '</div>' + (origensDe(c).length > 1 ? '<div class="sub">' + esc(origensDe(c).map(origLabel).join(' · ')) + '</div>' : '') + '</td>' +
      '<td>' + potPill(it.p) + '</td><td>' + urgPill(c.urgencia) + '</td><td><span class="stage">' + esc(stageLabel(c.estagio)) + '</span></td>' +
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

// Funil por próxima ação (lógica pura em funil.js; design: docs/superpowers/specs/2026-11-13-funil-acao-design.md no hub).
// Cada pessoa cai na coluna do que fazer com ela agora. Nenhum botão envia nada: todos abrem prévia, conversa ou ficha.
var ASSIN = {};   // assinatura de cada pessoa (db/crm-assinaturas.sql); vazio se a tabela não existir
var FUNIL_TEMP = { q: 'Quente', m: 'Morna', f: 'Fria' };
function funilCtxDe() {
  var escreveu = {};
  R.forEach(function (x) { if (x.contato_id) escreveu[x.contato_id] = true; });
  Q.forEach(function (x) { if (x.contato_id) escreveu[x.contato_id] = true; });
  return function (c) { var cp = COMPRAS[c.id]; return { assinatura: ASSIN[c.id] || null, comprou: !!cp && Object.keys(cp).length > 0, escreveu: !!escreveu[c.id] }; };
}
function funilBotao(k) {
  var b = k.botao, at = { conversa: 'data-openconv', email: 'data-emailfor', um_a_um: 'data-open1a1', ficha: 'data-open' }[b.acao];
  if (b.desabilitado) return '<button class="btn" type="button" disabled>' + esc(b.rotulo) + '</button><span class="fn-aviso">' + esc(b.aviso) + '</span>';
  return '<button class="btn' + (b.acao === 'ficha' ? '' : ' primary') + '" type="button" ' + at + '="' + esc(k.id) + '">' + esc(b.rotulo) + '</button>';
}
function funilCartao(k, c) {
  var aberto = state.funilPorque === k.id, fl = FX.funil.rotuloFalta(k.falta);
  var tags = (fl ? '<span class="fn-tag" title="' + esc(fl[1]) + '">' + esc(fl[0]) + '</span>' : '') +
    (k.prazo !== null ? '<span class="fn-tag pz num">VLS-TS em ' + k.prazo + (k.prazo === 1 ? ' dia' : ' dias') + '</span>' : '');
  var det = aberto ? '<div class="fn-mais">' + (k.linhas.length ? k.linhas.map(function (l) { return '<div><span>' + esc(l[0]) + '</span><b class="num">' + esc(l[1]) + '</b></div>'; }).join('') : '<div><span>Nenhum sinal ainda</span><b>0</b></div>') +
    '<div><span>Total</span><b class="num">' + k.pontos + ' pontos</b></div>' + (fl ? '<div><span>' + esc(fl[0]) + '</span><b>' + esc(fl[1]) + '</b></div>' : '') + '</div>' : '';
  return '<div class="fn-card"><div class="fn-r1"><div style="min-width:0"><button class="fn-nome" type="button" data-open="' + esc(k.id) + '">' + esc(short(c)) + '</button><span class="persona">' + esc(personaLabel(c)) + '</span></div>' +
    '<span class="fn-temp t-' + k.temp + '">' + FUNIL_TEMP[k.temp] + '</span></div>' +
    '<p class="fn-why">' + esc(k.motivo) + '</p>' + (tags ? '<div class="fn-tags">' + tags + '</div>' : '') +
    '<div class="fn-acao">' + funilBotao(k) + '</div>' +
    '<button class="fn-porque" type="button" data-fporque="' + esc(k.id) + '" aria-expanded="' + aberto + '">' + (aberto ? 'Ocultar o porquê' : 'Por que aqui?') + '</button>' + det + '</div>';
}
function renderBoard() {
  var fp = $('funil-persona').value, F = FX.funil, ctxDe = funilCtxDe();
  var lista = C.filter(function (c) { return !fp || personaKey(c) === fp; });
  var visao = state.funilVisao || 'leads';
  var nv = {}; lista.forEach(function (c) { var v = F.visaoDe(c, ctxDe(c)); nv[v] = (nv[v] || 0) + 1; });
  $('funil-abas').innerHTML = F.VISOES.map(function (v) {
    return '<button type="button" data-fv="' + v[0] + '" aria-pressed="' + (v[0] === visao) + '">' + v[1] + ' <span class="num">' + (nv[v[0]] || 0) + '</span></button>';
  }).join('');
  $('funil-painel').innerHTML = F.indicadoresDe(lista, ctxDe).map(function (k) {
    return '<div class="fn-kpi' + (k.alerta ? ' warn' : '') + '"><span class="l">' + esc(k.rotulo) + '</span><strong class="num">' + esc(k.valor) + '</strong><span class="n num">' + esc(k.n) + '</span><span class="al">' + (k.alerta ? '⚠ ' : '') + esc(k.aviso) + '</span></div>';
  }).join('');
  var ps = F.passosDe(lista, ctxDe);
  $('funil-passos').innerHTML = ps.passos.map(function (p, i) {
    return '<div class="fn-passo' + (i === ps.perda ? ' perda' : '') + '"><span class="t">' + esc(p.rotulo) + '</span><strong class="num">' + p.n + '</strong><span class="p num">' + (i === 0 ? 'ponto de partida' : p.pct === null ? 'sem base' : p.pct + '% do passo anterior') + '</span></div>';
  }).join('');
  $('funil-passos-nota').textContent = ps.perda > 0 ? 'Maior perda depois do clique, onde a intenção já é alta: de "' + ps.passos[ps.perda - 1].rotulo + '" para "' + ps.passos[ps.perda].rotulo + '". Com ' + lista.length + ' contatos, leia como pista, não como taxa.' : '';
  var porId = {}; lista.forEach(function (c) { porId[c.id] = c; });
  $('board').innerHTML = F.quadroDe(lista, ctxDe, visao).map(function (col) {
    return '<div class="col"><h3>' + esc(col.t) + ' <span class="num">' + col.cartoes.length + '</span></h3><p class="desc">' + esc(col.d) + '</p>' +
      (col.cartoes.length ? col.cartoes.map(function (k) { return funilCartao(k, porId[k.id]); }).join('') : '<p class="fn-vazio">Ninguém aqui agora.</p>') + '</div>';
  }).join('');
}

// Caixa de entrada: duas abas (perguntas únicas e respostas por e-mail), cada uma com os seus status.
function renderQuestions() {
  var nq = Q.filter(function (x) { return x.status === 'nova'; }).length, nr = R.filter(function (x) { return x.status === 'nova'; }).length;
  $('c-ib-perguntas').textContent = nq; $('c-ib-perguntas').hidden = !nq;
  $('c-ib-emails').textContent = nr; $('c-ib-emails').hidden = !nr;
  document.querySelectorAll('.itab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.inbox === state.inbox)); });
  var npb = P.filter(function (x) { return x.status === 'novo'; }).length;
  $('c-ib-problemas').textContent = npb; $('c-ib-problemas').hidden = !npb;
  if (state.inbox === 'emails') return renderRespostas();
  if (state.inbox === 'problemas') return renderProblemas();
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
      '</div><p>' + esc(x.texto) + '</p>' + '<span class="persona">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></button>';
  }).join('') || '<div class="empty">' + (state.qs === 'nova' ? 'Nenhuma pergunta nova. Tudo respondido.' : 'Nada respondido ainda.') + '</div>';
  var x = Q.filter(function (y) { return y.id === state.qsel; })[0];
  var c = x && byC(x.contato_id);
  if (!x || !c) { $('qdetail').innerHTML = '<div class="empty">Escolha uma pergunta na lista.</div>'; return; }
  $('qdetail').innerHTML =
    '<div style="display:flex;gap:12px;align-items:center"><div class="' + avClass(c) + '">' + esc(ini(c)) + '</div><div style="min-width:0"><b style="font-weight:600">' + esc(displayName(c)) + '</b><div class="mail">' + esc(c.email) + ' · enviada há ' + hrs(hrsSince(x.criado_em)) + '</div></div><button class="link" style="margin-left:auto" data-open="' + esc(c.id) + '" type="button">Abrir ficha →</button></div>' +
    (x.origem ? '<p class="sub" style="margin:10px 0 4px">' + artigoLink(x.origem) + '</p>' : '') +
    '<blockquote>' + esc(x.texto) + '</blockquote>' +
    '<div class="ctx">' + urgPill(c.urgencia) + '<span class="pill">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span><span class="pill">Estágio: ' + esc(stageLabel(c.estagio)) + '</span></div>' +
    (x.status === 'nova'
      ? '<div class="reply"><label for="reply-txt">Sua resposta · fica salva na ficha de ' + esc(c.email) + '</label>' +
        '<textarea id="reply-txt" placeholder="Escreva aqui."></textarea>' +
        '<p class="sub" id="reply-err" style="margin:0;color:var(--red)" hidden>Escreva a resposta antes de salvar.</p>' +
        '<div class="reply-foot"><small>O envio por e-mail entra na fase 3 — por ora copie a resposta e mande pelo seu e-mail.</small><button class="btn primary" type="button" id="send-reply">Marcar como respondida</button></div></div>'
      : '<div class="sec" style="margin:0"><h4>Sua resposta · ' + esc(fmtDate(x.respondida_em)) + '</h4><div class="sent" style="white-space:pre-wrap">' + esc(x.resposta) + '</div></div>');
}

// Problemas: o que a cliente avisou pelo botão "Algo não está funcionando?" do app. O texto e o contexto técnico vêm do banco e
// passam por esc() onde a linha é montada. Só você lê esta tabela (RLS pelo admin).
var PROB_CAT = { nao_funciona: 'Algo não funciona', informacao_errada: 'Informação errada', nao_encontro: 'Não encontra o que procura', outro: 'Outro' };
var PS_TABS = [['novo', 'Novos'], ['resolvido', 'Resolvidos']];
function byUser(uid) { for (var i = 0; i < C.length; i++) if (C[i].user_id && C[i].user_id === uid) return C[i]; }
function renderProblemas() {
  $('qtabs').innerHTML = PS_TABS.map(function (k) {
    return '<button class="qtab" role="tab" data-ps="' + k[0] + '" aria-selected="' + (state.ps === k[0]) + '" type="button">' + k[1] + ' <span class="num">' + P.filter(function (x) { return x.status === k[0]; }).length + '</span></button>';
  }).join('');
  if (PERR) { $('qitems').innerHTML = '<div class="empty">' + esc(PERR) + '</div>'; $('qdetail').innerHTML = '<div class="empty">Quando o SQL estiver rodado, os avisos das clientes aparecem aqui.</div>'; return; }
  var list = P.filter(function (x) { return x.status === state.ps; }).sort(function (a, b) { return state.ps === 'novo' ? (a.criado_em < b.criado_em ? -1 : 1) : (a.criado_em < b.criado_em ? 1 : -1); });
  if (!list.some(function (x) { return x.id === state.psel; })) state.psel = list.length ? list[0].id : null;
  $('qitems').innerHTML = list.map(function (x) {
    var c = byUser(x.user_id), h = hrsSince(x.criado_em);
    return '<button class="qitem" data-p="' + x.id + '" aria-current="' + (x.id === state.psel) + '" type="button"><div class="l1"><b>' + esc(c ? short(c) : 'Conta sem ficha') + '</b>' +
      (x.status === 'novo' ? '<span class="sla num ' + (h >= 24 ? 'late' : 'ok') + '">' + (h >= 24 ? 'sem olhar · ' : '') + hrs(h) + '</span>' : '<span class="sla ok">resolvido</span>') +
      '</div><p>' + esc(x.texto) + '</p><span class="persona">' + esc(PROB_CAT[x.categoria] || x.categoria) + (x.tela ? ' · ' + esc(x.tela) : '') + '</span></button>';
  }).join('') || '<div class="empty">' + (state.ps === 'novo' ? 'Nenhum aviso novo. Tudo olhado.' : 'Nada resolvido ainda.') + '</div>';
  var x = P.filter(function (y) { return y.id === state.psel; })[0];
  if (!x) { $('qdetail').innerHTML = '<div class="empty">' + (P.length ? 'Escolha um aviso na lista.' : 'Quando uma cliente avisar um problema pelo app, ele aparece aqui.') + '</div>'; return; }
  var c = byUser(x.user_id), k = x.contexto || {}, erros = Array.isArray(k.erros) ? k.erros : [];
  $('qdetail').innerHTML =
    '<div style="display:flex;gap:12px;align-items:center">' + (c ? '<div class="' + avClass(c) + '">' + esc(ini(c)) + '</div>' : '<div class="av b">?</div>') +
    '<div style="min-width:0"><b style="font-weight:600">' + esc(c ? displayName(c) : 'Conta sem ficha no CRM') + '</b><div class="mail">' + (c ? esc(c.email) + ' · ' : '') + 'aviso nº ' + esc(x.id) + ' · há ' + hrs(hrsSince(x.criado_em)) + '</div></div>' +
    (c ? '<button class="link" style="margin-left:auto" data-open="' + esc(c.id) + '" type="button">Abrir ficha →</button>' : '') + '</div>' +
    '<div class="ctx"><span class="pill">' + esc(PROB_CAT[x.categoria] || x.categoria) + '</span>' + (x.tela ? '<span class="pill">Tela: ' + esc(x.tela) + '</span>' : '') + (k.ambiente ? '<span class="pill">' + esc(k.ambiente) + '</span>' : '') + '</div>' +
    '<blockquote style="white-space:pre-wrap">' + esc(x.texto) + '</blockquote>' +
    '<div class="sec" style="margin:0"><h4>Contexto técnico</h4><dl class="kv">' +
      '<dt>Navegador</dt><dd>' + esc(k.navegador || '—') + '</dd><dt>Tela</dt><dd>' + esc(k.tela || '—') + '</dd><dt>Online</dt><dd>' + (k.online === true ? 'sim' : k.online === false ? 'não' : '—') + '</dd>' +
      '<dt>Erros da página</dt><dd>' + (erros.length ? erros.map(function (e) { return esc((e && e.msg) || '') + (e && e.arquivo ? ' <span class="sub">(' + esc(e.arquivo) + (e.linha ? ':' + esc(e.linha) : '') + ')</span>' : ''); }).join('<br>') : 'nenhum') + '</dd></dl></div>' +
    '<div class="reply"><div class="reply-foot"><small>' + (c ? 'Responda pelo chat, na ficha dela. ' : '') + 'Marque como resolvido quando terminar: o aviso sai da fila.</small><div class="btns">' +
    (x.status === 'novo' ? '<button class="btn primary" type="button" data-pstatus="resolvido">Marcar como resolvido</button>' : '<button class="btn" type="button" data-pstatus="novo">Voltar para novos</button>') +
    '</div></div></div>';
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
    '<div class="reply"><div class="reply-foot"><small>' + (c ? 'Responda na aba E-mail da ficha: sai do e-mail do Por Dentro, na mesma conversa do Gmail ' + (viaEmail ? 'dela' : 'dela (o toque e a página não chegam no seu e-mail)') + ', e esta resposta é marcada como respondida sozinha.'
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
    // Pedido de acompanhamento feito na página Rota da Sécu (POST /api/rota/pedido no Worker); o texto que ela escreveu fica na Conversa.
    pedido_acompanhamento: ['resposta', 'Pediu orçamento de acompanhamento' + (ROTA_ACOMP[d.acompanhamento] ? ': ' + ROTA_ACOMP[d.acompanhamento] : '')],
    estagio_alterado: ['sistema', 'Estágio: ' + stageLabel(d.de) + ' → ' + stageLabel(d.para)],
    compra: ['sistema', 'Comprou: ' + produtoNome(d.produto)]
  };
  return m[t] || ['sistema', t];
}
// tab: 'conversa' ou 'ficha'; sem tab, a ficha abre na Conversa se já houver alguma mensagem.
async function openPessoa(id, tab, sub) {
  if (state.view !== 'pessoa') state.prevView = state.view;
  state.sel = id; state.ptab = tab || null; state.pstab = sub || 'assistente'; state.pdias = {}; state.chatRasc = ''; state.caso = null; fxReset();
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
// ---------- O próximo e-mail: os sinais da ficha dizem qual mandar, quando e com que ângulo ----------
// Regras fixas sobre o que a ficha já sabe (não é IA): a primeira que bate vale. Nunca inventa prazo: só usa os que existem.
function diasDesde(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null; }
function vezes(n) { return n + (n === 1 ? ' vez' : ' vezes'); }
function haDias(d) { return d === 0 ? 'menos de 1 dia' : d + (d === 1 ? ' dia' : ' dias'); }
// Os eventos que contam a jornada (db/crm-enriquecimento.sql grava um por captura, com a origem e as UTMs).
function montaJornada(evs) {
  var j = { entradas: [], quizzes: [], ativouEm: null, appVezes: 0, artigos: 0 };
  (evs || []).slice().sort(function (a, b) { return a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0; }).forEach(function (e) {
    var d = e.dados || {};
    if (e.tipo === 'email_capturado' || e.tipo === 'email_recapturado') j.entradas.push({ em: e.criado_em, origem: d.origem || '', camp: d.utm_campaign || '', post: d.utm_content || '', fonte: d.utm_source || '' });
    else if (e.tipo === 'quiz_respondido') j.quizzes.push({ em: e.criado_em, persona: d.persona || '', objetivo: d.objetivo || '' });
    else if (e.tipo === 'acesso_ativado') j.ativouEm = j.ativouEm || e.criado_em;
    else if (e.tipo === 'app_aberto') { j.appVezes++; j.ativouEm = j.ativouEm || e.criado_em; }
    else if (e.tipo === 'artigo_lido') j.artigos++;
  });
  return j;
}
function tipoFunil(o) {
  return /^guia-/.test(o) ? 'guia gratuito' : o === 'bot' ? 'funil de classificação' : (o === 'blog' || o === 'artigo' || /^artigo-/.test(o) || /^\/artigos\//.test(o)) ? 'artigo do blog'
    : o === 'instagram' ? 'link do Instagram' : (o === 'direto' || o === 'login_direto') ? 'acesso direto' : '';
}
// A página (landing) de onde a pessoa veio, pela origem que o site grava. É a linha da matriz do Estúdio de e-mails (Jornada).
var ORIGEM_PAGINA = { 'guia-email-alt30': 'I01', 'guia-tecnologo': 'I02', 'guia-etudes-en-france-2027': 'I03', 'guia-vls-ts': 'I04', 'guia-checklist-chegada-au-pair': 'I05', 'guia-mapa-saude-franca': 'I06', 'guia-rota-da-secu': 'I06' };
// Os modelos de uma página numa etapa da jornada (lead, contato, reimp, plat), do jeito que o Estúdio os organiza.
// Só entram os que têm versão No ar (sem a tabela de modelos, vale a lista do código).
function modelosDaEtapa(pagina, etapa, incluiRascunho) {
  if (!pagina || !JR.etapaDaJornada) return [];
  return listaModelos().filter(function (m) {
    var cl = TX.classifica(m);
    if (cl.pagina !== pagina) return false;
    if (JR.etapaDaJornada(Object.assign({}, m, { familia: cl.familia, pagina: cl.pagina })) !== etapa) return false;
    return incluiRascunho || !M || versoesDe(m.chave).some(function (v) { return v.etapa === 'no_ar'; });
  });
}
// Devolve { k, quando: 'agora'|'esperar'|'nao', titulo, angulo, sinais, conversa }. k = o modelo a revisar (null = nenhum e-mail agora).
function proximoEmail(c, mails, resps, jor) {
  var r = c.respostas || {}, ult = mails[0], diasUlt = ult ? diasDesde(ult.enviado_em || ult.criado_em) : null;
  var abriu = mails.filter(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }).length;
  var clicou = mails.filter(function (m) { return m.clicado_em || m.status === 'clicado'; }).length;
  var n = nCapturas(c), origem = origLabel(ultimaOrigem(c) || ''), etapa = r.objetivo ? etapaDe(r.objetivo) : '';
  var ativa = !!jor.ativouEm || ['ativado', 'em_uso', 'um_a_um', 'concluido'].indexOf(c.estagio) >= 0;
  var prazoDias = null, prazoDe = '';
  if (CF_PRAZO[r.cfNivel]) { prazoDias = diasAte(CF_PRAZO[r.cfNivel]); prazoDe = 'Campus France (' + (CF_NIVEL[r.cfNivel] || r.cfNivel) + ') em ' + fmtDay(CF_PRAZO[r.cfNivel]); }
  else if (c.dias_para_prazo != null) { prazoDias = Number(c.dias_para_prazo); prazoDe = 'VLS-TS em ' + fmtDay(c.prazo_limite); }
  var prazoFrase = prazoDias == null ? '' : prazoDias > 1 ? 'faltam ' + prazoDias + ' dias' : prazoDias === 1 ? 'falta 1 dia' : prazoDias === 0 ? 'vence hoje' : 'venceu há ' + (-prazoDias) + ' dias';
  var sinais = [n === 1 ? 'Deixou o e-mail 1 vez' + (origem ? ', pelo ' + origem : '') : 'Deixou o e-mail ' + n + ' vezes' + (origem ? '; a última pelo ' + origem : '')];
  if (etapa) sinais.push('Etapa que ela escolheu: ' + etapa);
  sinais.push(mails.length ? 'Recebeu ' + mails.length + (mails.length === 1 ? ' e-mail' : ' e-mails') + ' do CRM · abriu ' + abriu + ' · clicou ' + clicou + ' · o último há ' + haDias(diasUlt) : 'Ainda não recebeu nenhum e-mail pelo CRM');
  sinais.push(ativa ? 'Já abriu o link de acesso ou o app' : 'Ainda não abriu o app');
  if (prazoDias != null && prazoDias >= -90) sinais.push('Prazo: ' + prazoDe + ' (' + prazoFrase + ')');
  var k0 = defaultTpl(c), kReal = c.segmento || guiaTpl(ultimaOrigem(c)) || null;
  var out = function (o) { return Object.assign({ k: null, quando: 'nao', sinais: sinais, conversa: false }, o); };
  var m1 = mails.filter(function (m) { return m.modelo === 'cf_guia_1'; })[0], m2 = mails.filter(function (m) { return m.modelo === 'cf_guia_conversa'; })[0];

  var nova = resps.filter(function (x) { return x.status === 'nova'; });
  var toque = nova.filter(function (x) { return x.canal === 'toque'; })[0];
  if (toque) {
    var cidade = String(toque.texto || '').replace(/^Cidade: /, '') || 'uma cidade';
    return out({ titulo: 'Ela tocou em “' + cidade + '”: continue a conversa a partir daí', conversa: true,
      angulo: 'Escolher a cidade no e-mail 2 foi o gesto mais claro de interesse que ela fez. Responda na aba E-mail (sai na mesma conversa do Gmail dela) com UMA pergunta concreta sobre ' + cidade +
        (prazoDias != null && prazoDias >= 0 ? ' e o prazo dela (' + prazoDe + ', ' + prazoFrase + ')' : '') + (ativa ? '' : '. Ela ainda não abriu o app: ofereça o checklist só depois que ela responder, não antes') + '.' });
  }
  if (nova.length)
    return out({ titulo: 'Responda a mensagem dela antes de mandar qualquer coisa', conversa: true,
      angulo: 'Ela escreveu e ainda não teve resposta. Um e-mail novo por cima parece que você não leu. Responder é o melhor e-mail que existe para manter o engajamento.' });
  if (ult && ult.status === 'nao_entregue')
    return out({ titulo: 'Corrija o endereço antes de mandar outro',
      angulo: 'O último e-mail não foi entregue. Confira se o endereço tem erro de digitação (gmial, hotmial) ou chame pelo Instagram. Mandar de novo para o mesmo endereço só queima a reputação do remetente.' });
  // 1:1 já aconteceu (a leitura da call grava como feito): não é lembrete, é o pós-conversa. O Bilan sai pelo botão da ficha, escrito por você.
  if (umFeito(c.id) && !mails.some(function (x) { return x.modelo === 'boas_vindas'; }))
    return out({ titulo: 'O 1:1 já aconteceu: mande o Bilan e ofereça a plataforma',
      angulo: 'Nada de campanha nem de lembrete. O próximo e-mail útil é o resumo da conversa (o Bilan, que você escreve e confere antes de enviar) com o convite para a plataforma. Quanto mais perto da conversa, melhor.' });
  if (c.um_a_um_quando || c.estagio === 'um_a_um')
    return out({ titulo: 'Nada de campanha: ela tem 1:1 marcado',
      angulo: 'Com a conversa marcada' + (c.um_a_um_quando ? ' (' + fmtWhen(c.um_a_um_quando) + ')' : '') + ', o único e-mail útil é um lembrete curto perto do dia, com o que ela deve levar. Fora isso, é ruído.' });
  if (origensDe(c).indexOf(CF_GUIA_ORIGEM) >= 0 && m1 && !m2 && c.aceita_novidades && diasDesde(m1.enviado_em || m1.criado_em) <= 7)
    return out({ titulo: 'Deixe o e-mail 2 do guia sair sozinho',
      angulo: 'A sequência do Campus France já tem o e-mail 2 (a conversa) programado para o próximo envio diário, às 10h de Brasília. Mandar outro na frente atropela ele.' });
  if (!mails.length) {
    // A captação convida para o 1:1; o app não é a primeira oferta. O primeiro contato é o e-mail da etapa "Primeiro contato"
    // da página dela no Estúdio (Jornada). A entrega do material (etapa "Inbound lead") sai sozinha, não é este botão.
    var pag = ORIGEM_PAGINA[ultimaOrigem(c)] || null, conv = modelosDaEtapa(pag, 'contato').filter(function (m) { return !m.automatico; });
    var contexto = (origem ? 'Ela pediu “' + origem + '”' : 'Ela deixou o e-mail') + (etapa ? ' e disse que está em: ' + etapa.toLowerCase() : '') + '. ';
    if (conv.length)
      return out({ k: conv[0].chave, quando: 'agora', titulo: 'Primeiro contato: convide para o 1:1',
        angulo: contexto + 'Convide para a conversa com uma pergunta fácil de responder; o objetivo é o 1:1, não o app. Uma resposta dela vale mais do que mil cliques.' });
    return out({ titulo: pag ? 'Falta o e-mail de primeiro contato desta página' : 'Convide para o 1:1 com um e-mail escrito por você',
      angulo: (etapa ? 'Etapa dela: ' + etapa.toLowerCase() + '. ' : '') + (pag ? 'Esta página ainda não tem o convite para o 1:1 no Estúdio (Jornada, etapa Primeiro contato). Crie e publique lá e ele aparece aqui. Até lá, convide pelo Instagram ou em “Escrever mensagem”. Sem boas-vindas com link do app.'
        : 'Esta origem não tem página no Estúdio, então não há modelo para sugerir. Convide para o 1:1 em “Escrever mensagem”. Sem boas-vindas com link do app.') });
  }
  if (voltouDepoisDoEmail(c)) {
    // Sem guia próprio para a última origem, o padrão seria as boas-vindas: ela já recebeu e-mail nosso (qualquer um), então fica sem modelo.
    var kVolta = k0 === 'boas_vindas' ? null : k0;
    return out({ k: kVolta, quando: kVolta ? 'agora' : 'nao', titulo: 'Ela voltou a pedir material: este é o melhor momento',
      angulo: 'Voltar a deixar o e-mail depois do seu último envio é o sinal mais forte de interesse que a ficha tem. Reconheça isso (“vi que você pegou o ' + (origem || 'guia') + '”), não repita o e-mail anterior e convide para a conversa.' + (kVolta ? '' : ' Escreva um e-mail novo com “Escrever e-mail” no topo da ficha: as boas-vindas não fazem sentido para quem já recebeu e-mail seu.') });
  }
  if (diasUlt < 3) {
    var volta = fmtDate(new Date(new Date(ult.enviado_em || ult.criado_em).getTime() + 3 * 864e5).toISOString());
    return out({ k: kReal, quando: 'esperar', espera: volta, titulo: 'Espere: o último e-mail é muito recente',
      angulo: 'Saiu há ' + haDias(diasUlt) + '. Silêncio até o terceiro dia é normal; insistir antes cansa. Volte em ' + volta + ', ou antes se ela abrir, clicar ou responder.' });
  }
  var sg = SEGMENTS.filter(function (s) { return s.k === c.segmento; })[0];
  if (sg)
    return out({ k: c.segmento, quando: 'agora', titulo: 'Reimpacto: ' + sg.t.toLowerCase(),
      angulo: sg.why + (prazoDias != null && prazoDias >= 0 && prazoDias <= 60 ? ' Use o prazo real dela (' + prazoDe + ') como gancho.' : '') });
  if (prazoDias != null && prazoDias >= -90 && prazoDias <= 30)
    return out({ k: kReal, quando: kReal ? 'agora' : 'nao', titulo: 'O prazo dela é o gancho: fale dele',
      angulo: 'Ela tem ' + prazoDe + ' (' + prazoFrase + '). Ponha a data real no assunto ou na primeira linha e diga o próximo passo concreto. Nunca um prazo inventado.' });
  if (ativa)
    return out({ titulo: 'Ela está ativa: não precisa de e-mail agora',
      angulo: 'Ela já usa o que você entregou' + (jor.appVezes ? ' (abriu o app ' + vezes(jor.appVezes) + ')' : '') + '. O próximo passo natural é uma conversa pessoal, não mais conteúdo. Se quiser escrever mesmo assim, use “Escrever e-mail” no topo da ficha.' });
  return out({ titulo: 'Sem gatilho claro: espere um sinal',
    angulo: 'Nada na ficha pede um e-mail agora. Espere ela abrir o e-mail, voltar a deixar o e-mail ou escrever. Se quiser escrever mesmo assim, use “Escrever e-mail” no topo da ficha.' });
}
// ---------- Jornada no funil: por onde ela entrou, quantas vezes e até onde chegou ----------
function jornadaHtml(c, mails, resps, jor, h4, funil) {
  var es = jor.entradas, origens = origensDe(c), primeira = origens[0] || c.origem || '';
  var rows = [];
  if (primeira) rows.push(['Funil de entrada', origLabel(primeira) + (tipoFunil(primeira) ? ' (' + tipoFunil(primeira) + ')' : '')]);
  var dias = diasDesde(es.length ? es[0].em : c.criado_em);
  if (dias != null) rows.push(['Na base há', haDias(dias)]);
  var linhas = es.map(function (x, i) {
    var q = jor.quizzes.filter(function (z) { return z.em === x.em; })[0];
    var det = [q && q.persona ? PERSONAS[q.persona] || q.persona : '', q && q.objetivo ? etapaDe(q.objetivo) : '', x.camp ? 'campanha ' + x.camp : '', x.post ? 'post ' + x.post : '', x.fonte ? 'fonte ' + x.fonte : ''].filter(Boolean);
    return '<li><time>' + esc(fmtDate(x.em)) + '</time> <b>' + (i === 0 ? '1ª vez' : (i + 1) + 'ª vez') + '</b> · ' + esc(origLabel(x.origem) || '—') +
      (det.length ? '<div class="sub">' + esc(det.join(' · ')) + '</div>' : '') + '</li>';
  }).join('');
  var faltam = nCapturas(c) - es.length;
  var antes = function (f) { var x = mails.map(f).filter(Boolean).sort()[0]; return x ? ' · ' + fmtDate(x) : ''; };
  var usa = ['em_uso', 'um_a_um', 'concluido'].indexOf(c.estagio) >= 0;
  var degraus = [
    [true, 'Deixou o e-mail' + (es.length ? ' · ' + fmtDate(es[0].em) : ''), ''],
    [mails.length > 0, mails.length ? 'Recebeu e-mail do CRM' + antes(function (m) { return m.enviado_em || m.criado_em; }) : 'Ainda não recebeu e-mail do CRM', ''],
    [mails.some(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }), 'Abriu o e-mail' + antes(function (m) { return m.aberto_em; }), 'Ainda não abriu nenhum e-mail'],
    [mails.some(function (m) { return m.clicado_em || m.status === 'clicado'; }), 'Clicou no link' + antes(function (m) { return m.clicado_em; }), 'Ainda não clicou em nenhum link'],
    [!!jor.ativouEm || ['ativado', 'em_uso', 'um_a_um', 'concluido'].indexOf(c.estagio) >= 0, 'Abriu o app' + (jor.ativouEm ? ' · ' + fmtDate(jor.ativouEm) : ''), 'Ainda não abriu o app'],
    [usa, 'Está marcando itens no checklist', 'Ainda não marcou itens no checklist'],
    [resps.length > 0, 'Respondeu a você (' + resps.length + ')', 'Ainda não respondeu'],
    [c.estagio === 'um_a_um' || !!c.um_a_um_quando, 'Marcou 1:1', 'Ainda sem 1:1']
  ];
  var ok = degraus.filter(function (d) { return d[0]; }), ult = ok[ok.length - 1];
  // Mais de um funil: uma linha curta por funil (nome, 1ª data, quantas vezes) em vez de uma frase corrida.
  var grupos = [], gi = {};
  es.forEach(function (x) { var o = x.origem || '—'; if (gi[o] == null) { gi[o] = grupos.length; grupos.push({ o: o, n: 0, em: x.em }); } grupos[gi[o]].n++; grupos[gi[o]].ult = x.em; });
  if (!grupos.length) origens.forEach(function (o) { grupos.push({ o: o, n: 0, em: null }); });
  grupos.sort(function (a, b) { return (b.ult || b.em || '') < (a.ult || a.em || '') ? -1 : (b.ult || b.em || '') > (a.ult || a.em || '') ? 1 : 0; });   // o mais recente primeiro
  var multi = grupos.length > 1, ultimaO = ultimaOrigem(c);
  var funisHtml = !multi ? '' : '<div class="fx-funis"><div class="k">Entrou por ' + grupos.length + ' funis</div><ul>' + grupos.map(function (g) {
    return '<li><span class="fx-funis-nome">' + esc(origLabel(g.o)) + '</span><span class="fx-funis-meta">' + (g.ult || g.em ? esc(fmtDate(g.ult || g.em)) : '') + (g.n > 1 ? ' · ' + g.n + '×' : '') +
      (g.o === ultimaO ? ' <b class="fx-funis-ult">mais recente</b>' : '') + '</span></li>';
  }).join('') + '</ul></div>';
  var resumo = (multi ? [] : rows.slice(0, 1)).concat([['Entradas', vezes(nCapturas(c)) + (dias != null ? ' · na base há ' + haDias(dias) : '')],
    ['Chegou até', ult[1].replace(/ · \d\d\/\d\d$/, '') + ' (' + ok.length + ' de ' + degraus.length + ' passos)']])
    .concat(origemKv(c).filter(function (x) { return multi ? /^(Campanha|Post)/.test(x[0]) : /^(Por onde passou|Campanha|Post)/.test(x[0]); }));
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Jornada no funil</h4>' + (funil || '') + funisHtml + kvHtml(resumo) +
    '<details class="mais-det"><summary>Cada entrada e todos os passos</summary><div class="k jn-k">Cada vez que ela entrou (' + vezes(nCapturas(c)) + ')</div>' +
    (linhas ? '<ol class="jn-list">' + linhas + '</ol>' : '<p class="sub" style="margin:0">Sem registro de captura na linha do tempo.</p>') +
    (faltam > 0 && es.length ? '<p class="sub" style="margin:6px 0 0">' + faltam + (faltam === 1 ? ' entrada mais antiga' : ' entradas mais antigas') + ' sem detalhe na linha do tempo.</p>' : '') +
    '<div class="k jn-k">Até onde ela chegou</div><ul class="jn-steps">' + degraus.map(function (d) {
      return '<li class="' + (d[0] ? 'ok' : 'no') + '"><span aria-hidden="true">' + (d[0] ? '✓' : '·') + '</span> ' + esc(d[0] ? d[1] : (d[2] || d[1])) + '</li>';
    }).join('') + '</ul></details></div>';
}
function emailsPanel(c, mails, h4, resps, jor) {
  var em = function (m) { return m.enviado_em || m.criado_em; };
  mails = mails.slice().sort(function (a, b) { return em(a) < em(b) ? 1 : em(a) > em(b) ? -1 : 0; });   // mais recente primeiro
  var ultimo = mails[0];
  var head = ultimo ? '<p style="margin:0 0 12px;font-size:13px">Último: <b>' + esc(modeloNome(ultimo.modelo)) + '</b> · ' + esc(fmtQuando(ultimo.enviado_em || ultimo.criado_em)) + ' ' + mailPill(ultimo) + '</p>'
    : '<p style="margin:0 0 12px;font-size:13px"><b>Nenhum e-mail saiu pelo CRM para ela.</b> <span class="sub">E-mails mandados direto do seu Gmail não entram aqui.</span></p>';
  var p = proximoEmail(c, mails, resps || [], jor || montaJornada([]));
  var bloq = p.k && exigeNovidades(p.k) && !c.aceita_novidades;
  var selo = p.conversa ? 'Responda agora' : p.quando === 'agora' ? 'Pode enviar agora' : p.quando === 'esperar' ? 'Espere até ' + p.espera : 'Não envie agora';
  var acao = p.conversa ? '<button class="btn primary" type="button" style="margin-top:10px" data-openconv="' + esc(c.id) + '">Abrir a aba E-mail →</button>'
    : !p.k ? ''
    : bloq ? '<p class="sub" style="margin:8px 0 0;color:var(--red)">Não aceitou novidades por e-mail: o modelo “' + esc(tplInfo(p.k).label) + '” não pode ser enviado.</p>'
    : '<p class="sub" style="margin:8px 0 0">Modelo sugerido: <b style="color:var(--ink)">' + esc(tplInfo(p.k).label) + '</b><br>Assunto: ' + esc(emailPronto(c, p.k).subject) + '</p>' +
      '<button class="btn' + (p.quando === 'agora' ? ' primary' : '') + '" type="button" style="margin-top:10px" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(p.k) + '">' + (p.quando === 'agora' ? 'Revisar e enviar →' : 'Ver o e-mail mesmo assim') + '</button>';
  var prox = '<div class="nextmail insight"><div class="k">Próximo e-mail <span class="selo selo-' + p.quando + '">' + esc(selo) + '</span></div>' +
    '<p class="ins-t">' + esc(p.titulo) + '</p><p class="ins-ang">' + esc(p.angulo) + '</p>' +
    '<details class="ins-sinais"><summary>O que a ficha mostra</summary><ul>' + p.sinais.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></details>' + acao + '</div>';
  var hist = mails.map(function (m) {
    return '<div class="mailrow"><button class="mh" data-mailtoggle="' + m.id + '" type="button"><b>' + esc(m.assunto || modeloNome(m.modelo)) + '</b>' + mailPill(m) +
      '<time>' + esc(fmtQuando(m.enviado_em || m.criado_em)) + '</time></button><div class="sub" style="font-size:11.5px;margin-top:2px">' + esc(modeloNome(m.modelo)) +
      (m.aberto_em ? ' · abriu ' + esc(fmtQuando(m.aberto_em)) : '') + (m.clicado_em ? ' · clicou ' + esc(fmtQuando(m.clicado_em)) : '') + '</div>' +
      mailView(m) + '</div>';
  }).join('');
  return '<div class="panel mailpanel" style="padding:16px"><h4 style="' + h4 + '">E-mails</h4>' + prox + '<div style="margin-top:12px">' + head + '</div>' +
    '<details class="mais-det"><summary>Sequência, e-mails enviados (' + mails.length + ') e compra</summary>' + seqGuiaCF(c, mails) +
    (hist ? '<div class="k" style="margin-top:14px">Já enviados (' + mails.length + ')</div>' + hist : '') + compraHtml(c) + '</details></div>';
}
// ---------- Caminho de e-mail da pessoa e "Preparar e-mail" ----------
// O mapa é o mesmo da tela Jornada (página de entrada × etapa): cada etapa mostra o e-mail do modelo que ela recebeu, o que ainda
// não foi enviado e o que falta criar. O rascunho parte de onde ela está e do que ela respondeu (ou não respondeu). Nada sai sozinho:
// o botão abre o e-mail no modal de envio (ou a conversa) já com o texto, para você revisar.
function truncaTxt(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
function situacaoEmail(mails, resps) {
  var rs = (resps || []).slice().sort(function (a, b) { return a.recebido_em < b.recebido_em ? -1 : 1; });
  if (rs.length) return { k: 'respondeu', rot: 'Ela respondeu o seu e-mail', resp: rs[rs.length - 1], nova: rs.some(function (x) { return x.status === 'nova'; }) };
  if (!mails.length) return { k: 'sem_email', rot: 'Ainda não recebeu nenhum e-mail do CRM' };
  var ult = mails[0], dias = diasDesde(ult.enviado_em || ult.criado_em);
  if (ult.status === 'nao_entregue') return { k: 'nao_entregue', rot: 'O último e-mail não foi entregue', dias: dias };
  if (ult.clicado_em || ult.status === 'clicado') return { k: 'clicou', rot: 'Clicou no link do último e-mail e não respondeu', dias: dias };
  if (ult.aberto_em || ult.status === 'aberto') return { k: 'abriu', rot: 'Abriu o último e-mail e não respondeu', dias: dias };
  return { k: 'nao_abriu', rot: 'Não abriu o último e-mail (enviado há ' + haDias(dias) + ')', dias: dias };
}
function passosDoCaminho(c, mails) {
  var pag = ORIGEM_PAGINA[ultimaOrigem(c)] || null;
  var passos = JR.ETAPAS.map(function (e) {
    var ms = modelosDaEtapa(pag, e.k), chaves = ms.map(function (m) { return m.chave; });
    var env = mails.filter(function (m) { return chaves.indexOf(m.modelo) >= 0; });
    var rasc = ms.length ? [] : modelosDaEtapa(pag, e.k, true);   // existem no Estúdio mas ainda não estão No ar
    return { k: e.k, nome: e.nome, sub: e.sub, modelos: ms, rascunhos: rasc, env: env };
  });
  var atual = null;
  passos.forEach(function (x) { if (x.k !== 'reimp' && x.env.length) atual = x.k; });
  return { pag: pag, passos: passos, atual: atual };
}
function rascunhoDoEmail(c, sit, mails, jor) {
  var r = c.respostas || {}, nome = pn(c), origem = origLabel(ultimaOrigem(c) || ''), etapa = r.objetivo ? etapaDe(r.objetivo) : '';
  var prazoDias = CF_PRAZO[r.cfNivel] ? diasAte(CF_PRAZO[r.cfNivel]) : c.dias_para_prazo != null ? Number(c.dias_para_prazo) : null;
  var prazoDe = CF_PRAZO[r.cfNivel] ? 'o prazo do Campus France (' + fmtDay(CF_PRAZO[r.cfNivel]) + ')' : c.prazo_limite ? 'o prazo do VLS-TS (' + fmtDay(c.prazo_limite) + ')' : '';
  var prazoFrase = prazoDias == null || prazoDias < -90 ? '' : prazoDias > 1 ? 'faltam ' + prazoDias + ' dias' : prazoDias === 1 ? 'falta 1 dia' : prazoDias === 0 ? 'vence hoje' : 'venceu há ' + (-prazoDias) + ' dias';
  var gancho = '';
  if (prazoDe && prazoFrase) gancho = ' Pelo que você me contou, ' + prazoDe + ' ' + (prazoDias > 0 ? 'chega em ' + prazoDias + (prazoDias === 1 ? ' dia' : ' dias') : prazoDias === 0 ? 'é hoje' : 'já passou (' + prazoFrase + ')') + '.';
  var pergunta = prazoDe && prazoFrase ? 'Qual é o passo que mais está te travando agora?' : etapa ? 'O que mais te trava nessa etapa hoje?' : 'Qual é a dúvida que mais te trava hoje?';
  var convite = c.estagio === 'um_a_um' || c.um_a_um_quando ? '' : '\n\nSe ficar mais fácil falar ao vivo, posso te encaixar numa conversa rápida (1:1).';
  var funisP = funisDaPessoa(c, jor || { entradas: [] });
  if (sit.k !== 'respondeu' && funisP.length >= 2) return rascunhoMultiFunil(c, funisP, jor || { entradas: [] });
  var L = ['Oi ' + nome + '!', ''];
  if (sit.k === 'respondeu') L.push('Obrigada por me responder. Li com atenção: “' + truncaTxt(sit.resp.texto, 140) + '”.' + gancho, '', pergunta);
  else if (sit.k === 'sem_email') L.push('Vi que você pediu ' + (origem ? 'o ' + origem : 'o nosso material') + (etapa ? ' e que está em: ' + etapa.toLowerCase() : '') + '.' + gancho, '', pergunta);
  else if (sit.k === 'clicou' || sit.k === 'abriu') L.push('Passei para saber como está indo com ' + (origem ? 'o ' + origem : 'o material') + '.' + gancho, '', pergunta);
  else if (sit.k === 'nao_abriu') L.push('Te mandei ' + (origem ? 'o ' + origem : 'o material') + ' há ' + haDias(sit.dias) + ' e queria ter certeza de que chegou na sua caixa (às vezes cai no spam ou em Promoções).' + gancho, '', pergunta);
  else return '';
  return L.join('\n') + convite + '\n\nIngryd · Por Dentro';
}
// O que está na fila para ela: os e-mails automáticos (sequência ligada no Estúdio) cujo "depois de" ela já recebeu e que ainda não saíram.
// A data é a do e-mail de base mais os dias (ou minutos) do modelo. É uma previsão: a regra de "Para quem" e o aceite de novidades
// valem na hora do envio.
function filaDaPessoa(c, mails) {
  if (!M) return [];
  var enviados = {}; mails.forEach(function (m) { var t = m.enviado_em || m.criado_em; if (!enviados[m.modelo] || t > enviados[m.modelo]) enviados[m.modelo] = t; });
  var out = [];
  listaModelos().forEach(function (m) {
    if (!m.envio_ligado || m.envio_gatilho !== 'email' || !enviados[m.envio_depois_de] || enviados[m.chave]) return;
    var base = new Date(enviados[m.envio_depois_de]), quando;
    if (m.envio_minutos != null) quando = new Date(base.getTime() + m.envio_minutos * 6e4);
    else { quando = new Date(base.getTime() + (m.envio_dias || 0) * 864e5); if (m.envio_hora != null) quando.setHours(m.envio_hora, 0, 0, 0); }
    out.push({ k: m.chave, nome: m.nome || modeloNome(m.chave), quando: quando, bloqueado: exigeNovidades(m.chave) && !c.aceita_novidades });
  });
  return out.sort(function (x, y) { return x.quando - y.quando; });
}
function itemEmailEnviado(m) {
  var ev = [mailPill(m)];
  var det = [m.aberto_em ? 'abriu ' + fmtQuando(m.aberto_em) : '', m.clicado_em ? 'clicou no link ' + fmtQuando(m.clicado_em) : ''].filter(Boolean);
  return '<div class="mailrow cam-t-env"><button class="mh" data-mailtoggle="' + m.id + '" type="button"><span class="cam-dir" title="Você enviou">↑</span><b>' + esc(m.assunto || modeloNome(m.modelo)) + '</b>' + ev.join('') +
    '<time>' + esc(fmtQuando(m.enviado_em || m.criado_em)) + '</time></button><div class="sub" style="font-size:11.5px;margin-top:2px">' + esc(modeloNome(m.modelo)) +
    (det.length ? ' · ' + esc(det.join(' · ')) : '') + ' · <span>clique para ver o e-mail</span></div>' + mailView(m) + '</div>';
}
function itemResposta(x) {
  return '<div class="mailrow cam-t-resp"><div class="mh" style="cursor:default"><span class="cam-dir" title="Ela respondeu">↓</span><b>Ela respondeu' + (x.canal === 'toque' ? ' com um toque' : x.canal === 'pagina' ? ' na página da conversa' : '') + '</b>' +
    (x.status === 'nova' ? '<span class="pill u-alta">sem resposta sua</span>' : '') + '<time>' + esc(fmtQuando(x.recebido_em)) + '</time></div>' +
    '<div class="cam-resp">' + esc(x.texto) + '</div></div>';
}
// ---------- Jornada e pistas: por onde ela entrou, o que respondeu em cada entrada e o que isso sugere ----------
var TEMA_FUNIL = { 'guia-etudes-en-france-2027': 'estudar na França (Campus France)', 'guia-tecnologo': 'o diploma de tecnólogo e o nível de francês', 'guia-email-alt30': 'a alternância depois dos 30',
  'guia-vls-ts': 'a validação do VLS-TS', 'guia-checklist-chegada-au-pair': 'a chegada como au pair', 'guia-mapa-saude-franca': 'a saúde na França (o sistema e a ordem do cadastro)', 'guia-rota-da-secu': 'a Rota da Sécu (o caminho até a carte vitale)' };
function funisDaPessoa(c, jor) {
  var out = [], vistos = {};
  (jor.entradas || []).forEach(function (x) { var o = x.origem || ''; if (o && !vistos[o]) { vistos[o] = 1; out.push(o); } });
  if (!out.length) origensDe(c).forEach(function (o) { if (o && !vistos[o]) { vistos[o] = 1; out.push(o); } });
  return out;
}
function nomeGuia(o) { return origLabel(o).replace(/^Guia (do |da |de )?/i, '').replace(/^Guia /i, ''); }
// Pistas por regra (nada de IA, e nada inventado): só o que a ficha já sabe.
function pistasDaJornada(c, jor, mails, resps) {
  var es = (jor.entradas || []).slice(), funis = funisDaPessoa(c, jor), n = nCapturas(c), pistas = [];
  var rotulos = funis.map(function (o) { return origLabel(o); });
  if (funis.length >= 2) pistas.push('Pegou ' + funis.length + ' materiais diferentes: ' + rotulos.join(', depois ') + '. Está comparando caminhos, o que mostra interesse de verdade.');
  else if (n >= 2) pistas.push('Pediu o mesmo material ' + n + ' vezes. Provavelmente não resolveu o que procurava ali: vale perguntar o que faltou.');
  if (es.length >= 2) {
    var d = Math.round((new Date(es[es.length - 1].em) - new Date(es[0].em)) / 864e5);
    pistas.push(d <= 0 ? 'As entradas foram no mesmo dia: decidiu rápido de olhar mais de um caminho.' : 'A última entrada veio ' + haDias(d) + ' depois da primeira' + (d <= 7 ? ': o interesse é recente.' : '.'));
  }
  var qs = jor.quizzes || [], ps = {}, obs = {};
  qs.forEach(function (q) { if (q.persona) ps[q.persona] = 1; if (q.objetivo) obs[q.objetivo] = 1; });
  if (Object.keys(ps).length > 1) pistas.push('Respondeu o quiz como pessoas diferentes (' + qs.map(function (q) { return PERSONAS[q.persona] || q.persona; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(' e ') + '): ainda está definindo o próprio caminho.');
  else if (Object.keys(obs).length > 1) pistas.push('Mudou a resposta de etapa entre as entradas: vale a última (o Dossiê usa essa).');
  var abriu = mails.filter(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }).length, clicou = mails.filter(function (m) { return m.clicado_em || m.status === 'clicado'; }).length;
  if (!mails.length) pistas.push('Ainda não recebeu nenhum e-mail do CRM: o primeiro contato é seu.');
  else if (!abriu) pistas.push('Recebeu ' + mails.length + (mails.length === 1 ? ' e-mail' : ' e-mails') + ' e não abriu nenhum: tente outro assunto, ou o Instagram.');
  else if (!(resps || []).length) pistas.push('Abriu ' + abriu + (clicou ? ' e clicou em ' + clicou : '') + ' e ainda não respondeu: falta um convite concreto, com uma pergunta fácil.');
  if ((resps || []).length) pistas.push('Já escreveu para você ' + resps.length + (resps.length === 1 ? ' vez' : ' vezes') + ': é o sinal mais forte.');
  pistas.push(c.user_id ? 'Já tem conta no app.' : 'Ainda não tem conta no app: a plataforma ainda é uma novidade para ela.');
  return { funis: funis, pistas: pistas, multi: funis.length >= 2 };
}
// O e-mail de quem pegou mais de um material: reconhece os dois e pergunta qual está mais perto da realidade dela.
function rascunhoMultiFunil(c, funis, jor) {
  var a = nomeGuia(funis[0]), b = nomeGuia(funis[funis.length - 1]), nome = pn(c), ult = jor.entradas && jor.entradas.length ? jor.entradas[jor.entradas.length - 1].em : null;
  var convite = c.estagio === 'um_a_um' || c.um_a_um_quando ? '' : '\n\nSe preferir, a gente conversa 20 minutos e eu te digo por onde eu começaria no seu caso.';
  return 'Oi ' + nome + '!\n\nVi que você pegou o guia ' + a + ' e, depois, o guia ' + b + (ult ? ' (o último em ' + fmtDay(ult) + ')' : '') + '. Isso me diz que você está olhando mais de um caminho, e faz sentido: eu prefiro entender o seu caso do que mandar material genérico.\n\n' +
    'Qual dos dois está mais perto da sua realidade hoje? E o que está te travando para dar o próximo passo?' + convite + '\n\nIngryd · Por Dentro';
}
function jornadaPistasHtml(c, mails, resps, jor, h4) {
  var P = pistasDaJornada(c, jor, mails, resps || []), es = (jor.entradas || []).slice().reverse(), qs = jor.quizzes || [];
  var linhas = es.slice(0, 5).map(function (x, i) {
    var q = qs.filter(function (z) { return z.em === x.em; })[0], det = [q && q.persona ? PERSONAS[q.persona] || q.persona : '', q && q.objetivo ? etapaDe(q.objetivo) : '', x.camp ? 'campanha ' + x.camp : ''].filter(Boolean);
    return '<li class="jp-i"><time>' + esc(fmtDate(x.em)) + '</time><div><b>' + esc(origLabel(x.origem) || '—') + '</b>' + (det.length ? '<div class="sub">' + esc(det.join(' · ')) + '</div>' : '') + '</div></li>';
  }).join('');
  var r = c.respostas || {}, mapeadas = {};
  Object.keys(DOS_FUNIL).forEach(function (k) { mapeadas[DOS_FUNIL[k][0]] = 1; });
  var noDossie = Object.keys(DOS_FUNIL).filter(function (k) { return dosDoFunil(c, k) !== null; }).length;
  var sem = Object.keys(r).filter(function (k) { return !mapeadas[k] && r[k] !== '' && r[k] != null && typeof r[k] !== 'object'; });
  var dossie = '<p class="sub jp-dos">' + (noDossie ? noDossie + (noDossie === 1 ? ' resposta do funil já está' : ' respostas do funil já estão') + ' no Dossiê. ' : 'Nenhuma resposta do funil caiu no Dossiê ainda. ') +
    (sem.length ? 'Ainda sem campo no Dossiê: ' + esc(sem.map(function (k) { return k === 'objetivo' ? 'a etapa que ela escolheu no guia' : rotuloChave(k).toLowerCase(); }).join(', ')) + '. ' : '') + '<button class="link" type="button" data-fx="tab" data-v="dossie">Ver o Dossiê →</button></p>';
  var abord = '';
  if (P.multi) {
    var rasc = rascunhoMultiFunil(c, P.funis, jor);
    state.rascPista = state.rascPista || {}; state.rascPista[c.id] = rasc;
    abord = '<div class="jp-abord"><div class="k">Abordagem sugerida</div><p style="margin:0 0 6px">Escreva um e-mail só dela: reconheça os dois materiais e pergunte qual está mais perto da realidade dela. Mostra que você olhou o caso dela, em vez de só mandar mais material.</p>' +
      '<button class="btn primary" type="button" data-pistaemail="' + esc(c.id) + '">Escrever e-mail personalizado →</button></div>';
  }
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Jornada e pistas</h4>' +
    (linhas ? '<ol class="jp-lista">' + linhas + '</ol>' + (es.length > 5 ? '<p class="sub" style="margin:0 0 6px">Mais ' + (es.length - 5) + ' entradas antigas em "Cada entrada e todos os passos".</p>' : '') : '<p class="sub" style="margin:0">Sem entradas registradas na linha do tempo.</p>') +
    '<div class="k jp-k">Pistas</div><ul class="jp-pistas">' + P.pistas.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' + abord + dossie + '</div>';
}
// A coluna da aba E-mail: o próximo da fila, o que ela já disse (e o rascunho sugerido) e o mapa do caminho, recolhido.
function emailLateralHtml(c, mails, resps, jor, h4) {
  if (!JR || !JR.ETAPAS || !TX.rotuloPagina) return '';   // os testes antigos não injetam o módulo da jornada
  mails = mails.slice().sort(function (a, b) { var x = a.enviado_em || a.criado_em, y = b.enviado_em || b.criado_em; return x < y ? 1 : x > y ? -1 : 0; });
  resps = resps || [];
  var cam = passosDoCaminho(c, mails), sit = situacaoEmail(mails, resps), p = proximoEmail(c, mails, resps, jor || montaJornada([]));
  state.rascSug = state.rascSug || {}; state.rascSug[c.id] = rascunhoDoEmail(c, sit, mails, jor);

  var fila = filaDaPessoa(c, mails), prox;
  if (fila.length) {
    var f = fila[0], pronto = emailPronto(c, f.k);
    prox = '<div class="cam-fila"><div class="k">Próximo na fila' + (fila.length > 1 ? ' <span class="sub" style="text-transform:none;letter-spacing:0">(depois dele, mais ' + (fila.length - 1) + ')</span>' : '') + '</div>' +
      '<p class="ins-t" style="margin:0 0 2px">' + esc(f.nome) + '</p><p class="sub" style="margin:0">Previsto para <b style="color:var(--ink)">' + esc(fmtQuando(f.quando.toISOString())) + '</b> · assunto: ' + esc(pronto.subject) + '</p>' +
      (f.bloqueado ? '<p class="sub" style="margin:4px 0 0;color:var(--red)">Ela não aceitou novidades por e-mail: este não vai sair.</p>' : '') +
      '<button class="btn" type="button" style="margin-top:8px" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(f.k) + '">Ver o e-mail →</button></div>';
  } else {
    prox = '<div class="cam-fila"><div class="k">Próximo na fila</div><p class="ins-t" style="margin:0 0 2px">Nada programado para ela</p><p class="sub" style="margin:0">' + esc(p.titulo) + '. ' + esc(p.angulo) + '</p>' +
      (p.k && !(exigeNovidades(p.k) && !c.aceita_novidades) ? '<button class="btn" type="button" style="margin-top:8px" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(p.k) + '">Ver o e-mail sugerido: ' + esc(tplInfo(p.k).label) + ' →</button>' : '') + '</div>';
  }
  var disse = [], r = c.respostas || {};
  if (r.objetivo) disse.push('Etapa que ela escolheu: ' + etapaDe(r.objetivo));
  if (r.cfNivel) disse.push('Nível: ' + (CF_NIVEL[r.cfNivel] || r.cfNivel));
  resps.slice(-2).forEach(function (x) { disse.push('Respondeu' + (x.canal === 'toque' ? ' com um toque' : x.canal === 'pagina' ? ' na página da conversa' : ' por e-mail') + ': “' + truncaTxt(x.texto, 120) + '”'); });
  if (sit.k !== 'respondeu' && mails.length) disse.push('Não respondeu a nenhum e-mail enviado');
  var sitHtml = '<div class="cam-sitbox"><div class="k">Onde ela está</div><p class="cam-sit" style="margin:0 0 4px"><b>' + esc(sit.rot) + '</b></p>' +
    (disse.length ? '<ul class="cam-disse">' + disse.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
    '<p class="sub" style="margin:0"><b style="color:var(--ink)">' + esc(p.titulo) + '</b> ' + esc(p.angulo) + '</p></div>';

  var mapa;
  if (!cam.pag) mapa = '<p class="sub" style="margin:0">Esta origem' + (ultimaOrigem(c) ? ' (' + esc(origLabel(ultimaOrigem(c))) + ')' : '') + ' não tem página no Estúdio, então não há caminho de e-mail para mostrar. Veja a tela Jornada para criar um.</p>';
  else mapa = '<p class="sub" style="margin:0 0 10px">Página de entrada: <b style="color:var(--ink)">' + esc(TX.rotuloPagina(cam.pag)) + '</b></p><ol class="cam">' + cam.passos.map(function (x) {
    var ult = x.env[0], estado = ult ? 'ok' : (x.modelos.length || x.rascunhos.length) ? 'pend' : 'falta';
    var corpo = ult ? '<b>' + esc(modeloNome(ult.modelo)) + '</b> ' + mailPill(ult) + '<time>' + esc(fmtQuando(ult.enviado_em || ult.criado_em)) + '</time>'
      : x.modelos.length ? 'Ainda não enviado: <b>' + esc(x.modelos[0].nome || modeloNome(x.modelos[0].chave)) + '</b>' + (x.modelos[0].automatico ? ' <span class="sub">(sai sozinho)</span>' : '')
      : x.rascunhos.length ? 'Em rascunho no Estúdio: <b>' + esc(x.rascunhos[0].nome || modeloNome(x.rascunhos[0].chave)) + '</b> <span class="sub">(ainda não está No ar)</span>'
      : '<span class="sub">Falta criar o modelo no Estúdio.</span>';
    return '<li class="cam-i cam-' + estado + (cam.atual === x.k ? ' cam-atual' : '') + '"><div class="cam-t"><b>' + esc(x.nome) + '</b><span class="sub">' + esc(x.sub) + '</span>' +
      (cam.atual === x.k ? '<span class="cam-aqui">ela está aqui</span>' : '') + '</div><div class="cam-m">' + corpo + '</div></li>';
  }).join('') + '</ol>';
  return prox + sitHtml + '<details class="mais-det cam-mapa"><summary>Caminho de e-mail desta pessoa</summary><div style="margin-top:8px">' + mapa + '</div></details>';
}
// O pop-up de modelos: os e-mails reais do Estúdio, agrupados como na Jornada. Escolher um abre o envio com o texto dela, para editar assunto e texto.
function abrirModelosPicker(cid) {
  var c = byC(cid); if (!c) return;
  activeCid = cid; CMP = null;
  // Os mesmos modelos que o envio sabe mandar (os 8 de sempre e os manuais criados no Estúdio). Automáticos e especiais (link de pagamento, acesso) ficam fora.
  var permitidos = TPL_ORDER.filter(function (k) { return !excluido(k); }).concat(novosManuais().map(function (m) { return m.chave; }));
  var gs = TX.agrupa(listaModelos().filter(function (m) { return permitidos.indexOf(m.chave) >= 0; }));
  var linha = function (m) {
    var sit = M ? situacaoDoModelo(m) : ['No ar', 'noar'], noAr = sit[1] === 'noar', bloq = exigeNovidades(m.chave) && !c.aceita_novidades;
    var pode = noAr && !bloq, motivo = !noAr ? sit[0] + ': ainda não pode sair' : bloq ? 'Ela não aceitou novidades por e-mail' : '';
    return '<button type="button" class="tplrow' + (pode ? '' : ' off') + '" data-tplsel="' + esc(m.chave) + '" data-q="' + esc((m.nome + ' ' + (m.objetivo || '')).toLowerCase()) + '"' + (pode ? '' : ' disabled') + '>' +
      '<span class="tplrow-t"><b>' + esc(m.nome || modeloNome(m.chave)) + '</b><small>' + esc(m.objetivo || tplInfo(m.chave).when || '') + '</small></span>' +
      '<span class="pill ' + (pode ? 'u-baixa' : 'out') + '">' + esc(pode ? 'No ar' : motivo) + '</span></button>';
  };
  var corpo = gs.map(function (g) {
    return '<div class="tplgrp" data-grp><div class="k">' + esc(g.titulo) + '</div>' + g.itens.map(linha).join('') + '</div>';
  }).join('') || '<div class="empty">Nenhum modelo cadastrado.</div>';
  modalOpen(modalTop(c) + '<h3 style="margin:14px 0 4px">Escolher um modelo de e-mail</h3>' +
    '<p class="sub" style="margin:0 0 8px">Os e-mails reais do Estúdio. Ao escolher, abre com os dados dela: você edita o assunto e o texto antes de enviar.</p>' +
    '<label class="sr" for="tplpick-q">Buscar modelo</label><input id="tplpick-q" class="tplpick-q" type="search" placeholder="Buscar pelo nome ou objetivo" autocomplete="off">' +
    '<div class="tplpick" id="tplpick">' + corpo + '</div>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Fechar</button></div>', true);
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
function etapaDe(v) { return CF_ETAPA[v] || ALT_ETAPA[v] || (/^ap-/.test(v) ? TX.rotuloEtapa('I05', v) : /^tec-/.test(v) ? TX.rotuloEtapa('I02', v) : v); }
// Chave crua do funil vira rótulo legível (camelCase, traço e sublinhado viram espaço; só a 1ª letra maiúscula).
function rotuloChave(k) { var t = String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
function respostasKv(c, jor) {
  var r = c.respostas || {}, rows = [], cf = /^cf-/.test(r.objetivo || '') || r.cfNivel || origensDe(c).indexOf(CF_GUIA_ORIGEM) >= 0;
  var add = function (l, v, falta) { if (v != null && v !== '') rows.push([l, String(v)]); else if (falta) rows.push([l, falta, 1]); };
  add('Persona', personaLabel(c) + (subLabel(c) ? ' · ' + subLabel(c) : ''));
  // Entrou por mais de um funil: a etapa de cada um, do mais recente para o mais antigo (cada guia pergunta a sua).
  var qs = jor && jor.quizzes ? jor.quizzes.filter(function (q) { return q.objetivo; }) : [];
  var eMulti = qs.length > 1 && jor.entradas.length > 1;
  if (eMulti) qs.slice().reverse().forEach(function (q) { var en = jor.entradas.filter(function (x) { return x.em === q.em; })[0]; add('Etapa · ' + (en && en.origem ? origLabel(en.origem) : fmtDate(q.em)), etapaDe(q.objetivo)); });
  else if (r.objetivo) add(/^alt-/.test(r.objetivo) ? 'Etapa na alternância' : /^cf-/.test(r.objetivo) ? 'Etapa no Campus France' : 'Etapa', etapaDe(r.objetivo));
  if (cf) add('Nível da candidatura', CF_NIVEL[r.cfNivel] || r.cfNivel, 'não respondeu (pergunta nova, de 14/10)');
  if (r.cfNivel && CF_PRAZO[r.cfNivel]) { var d = diasAte(CF_PRAZO[r.cfNivel]); add('Prazo Campus France', fmtDay(CF_PRAZO[r.cfNivel]) + (d >= 0 ? ' (faltam ' + d + ' dias)' : ' (venceu)')); }
  if (cf) add('Cidade', CF_CIDADE[r.cfCidade] || r.cfCidade, 'ainda não disse (toca no e-mail 2)');
  add('Entrada na França', c.data_entrada ? fmtDay(c.data_entrada) : '');
  add('Prazo do VLS-TS', c.prazo_limite ? fmtDay(c.prazo_limite) + ' (' + prazoTxt(c) + ')' : '');
  add('Fase', c.fase); add('Nível de estudos', c.nivel_estudos); add('Preocupação', c.preocupacao);
  Object.keys(r).forEach(function (k) {
    if (k === 'objetivo' || k === 'cfNivel' || k === 'cfCidade') return;
    var l = RESP_LABEL[k]; add(l ? l[0] : rotuloChave(k), l ? l[1](r[k]) : (typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]));
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
function conversaCtx(c, h4, lateral) {
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
    (lateral || '') + '</aside>';
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
      '<div class="stat"><span class="pill st-' + esc(x.status) + '">' + esc(MAIL_ST[x.status] || x.status) + '</span>' +
      (x.aberto_em ? '<span class="sub">abriu ' + esc(fmtQuando(x.aberto_em)) + '</span>' : '') + (x.clicado_em ? '<span class="sub">clicou no link ' + esc(fmtQuando(x.clicado_em)) + '</span>' : '') + quando + '</div></div>';
  }
  var nome = pn(c), nova = x.status === 'nova' ? '<span class="pill u-alta">nova</span>' : '';
  if (x.canal === 'toque') return '<div class="msg her"><span class="who">' + esc(nome) + ' · tocou no e-mail 2</span><span class="tapchip">' + esc(String(x.texto).replace(/^Cidade: /, '')) + '</span><div class="stat">' + nova + quando + '</div></div>';
  var via = x.canal === 'pagina' ? 'escreveu na página' : x.email_id ? 'respondeu por e-mail' : 'mandou um e-mail';
  return '<div class="msg her"><span class="who">' + esc(nome) + ' · ' + via + '</span>' + (x.canal !== 'pagina' && x.assunto ? '<span class="sub">' + esc(x.assunto) + '</span>' : '') +
    '<div class="txt">' + esc(x.texto) + '</div><div class="stat">' + nova + quando + '</div></div>';
}
function conversaPanel(c, mails, resps, h4, jor) {
  var itens = mails.map(function (m) { return { k: 'm', x: m, em: m.enviado_em || m.criado_em }; })
    .concat(resps.map(function (r) { return { k: 'r', x: r, em: r.recebido_em }; }))
    .sort(function (a, b) { return a.em < b.em ? -1 : a.em > b.em ? 1 : 0; });
  var dia = '', fio = itens.map(function (it) {
    var d = fmtDia(it.em), sep = d !== dia ? '<span class="day">' + esc(d) + '</span>' : '';
    dia = d; return sep + conversaMsg(it, c);
  }).join('') || '<div class="empty">Nenhuma mensagem ainda. O que você escrever aqui sai por e-mail para ' + esc(c.email) + '.</div>';
  var assunto = assuntoDoFio(mails, resps), rasc = state.rascunho[c.id] || '';
  var lateral = emailLateralHtml(c, mails, resps, jor, h4), sug = state.rascSug && state.rascSug[c.id];
  return '<div class="conv">' + conversaCtx(c, h4, lateral) +
    '<section class="thread" aria-label="Conversa com ' + esc(pn(c)) + '"><div class="msgs" id="conv-thread">' + fio + '</div>' +
    '<div class="compose">' +
    '<div class="cam-acoes"><button class="btn primary" type="button" data-tplpick="' + esc(c.id) + '">Usar um modelo de e-mail…</button>' +
      (sug ? '<button class="btn" type="button" data-usarrasc="' + esc(c.id) + '">Usar o rascunho sugerido</button>' : '') + '</div>' +
    (assunto ? '<p class="sub" style="margin:0">Vai como <b>' + esc(assunto) + '</b></p>'
      : '<label class="sub" for="conv-assunto">Assunto (ainda não há conversa por e-mail com ela)</label><input id="conv-assunto" maxlength="200" autocomplete="off">') +
    '<label class="sr" for="conv-txt">Sua resposta</label><textarea id="conv-txt" maxlength="10000" data-cid="' + esc(c.id) + '" placeholder="Responder a ' + esc(pn(c)) + '…">' + esc(rasc) + '</textarea>' +
    '<div class="conv-anexos"><label class="btn" for="conv-anexos">Anexar arquivos</label><input id="conv-anexos" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" class="sr" data-cid="' + esc(c.id) + '"> <small class="sub">PDF, JPG ou PNG · até 5 arquivos · 3 MB no total</small><ul class="onb-arqs" id="conv-anexos-lista">' + convAnexosLi(c.id) + '</ul></div>' +
    '<p class="sub" id="conv-err" style="margin:0;color:var(--red)" role="alert" hidden></p>' +
    '<div class="row"><small>Sai do e-mail do Por Dentro, na mesma conversa do Gmail dela. Se ela responder, volta para esta aba e uma cópia chega no seu e-mail.</small>' +
    '<button class="btn" type="button" id="conv-previa" data-cid="' + esc(c.id) + '">Ver como vai chegar</button> ' +
    '<button class="btn primary" type="button" id="conv-send" data-cid="' + esc(c.id) + '">Enviar</button></div></div></section></div>';
}
// Anexos da resposta (ficha → E-mail): ficam só na memória, por contato. Mesma regra do bilan (bilanJuntar).
var CONV_AX = {};
// Prévia do e-mail como ela vai receber (o mesmo HTML simples do Worker), sem enviar nada.
function convPrevia(cid) {
  var c = byC(cid), t = $('conv-txt'), as = $('conv-assunto'), txt = t ? t.value.trim() : '';
  if (!c || !txt) { var er = $('conv-err'); if (er) { er.textContent = 'Escreva a resposta para ver a prévia.'; er.hidden = false; } return; }
  var assunto = as ? as.value.trim() : ((document.querySelector('.compose p.sub b') || {}).textContent || '');
  var ax = (CONV_AX[cid] || []).map(function (f) { return esc(f.name) + ' (' + esc(onbMb(f.size)) + ')'; });
  modalOpen(modalTop(c) + '<h3 style="margin:14px 0 4px">Como vai chegar</h3>' +
    '<p class="sub" style="margin:0 0 8px">Para <b>' + esc(c.email) + '</b>' + (assunto ? ' · Assunto: <b>' + esc(assunto) + '</b>' : '') + (ax.length ? ' · Anexos: ' + ax.join(', ') : '') + '</p>' +
    '<iframe class="st-mail" style="height:420px;max-width:none" sandbox title="Prévia do e-mail" srcdoc="' + esc(textoParaHtml(txt)) + '"></iframe>' +
    '<div class="actions"><button class="btn primary" type="button" id="modal-cancel">Voltar e editar</button></div>', true);
}
function convAnexosLi(cid) {
  return (CONV_AX[cid] || []).map(function (f, i) {
    return '<li><span class="nome">' + esc(f.name || 'arquivo') + '</span><span class="tam num">' + esc(onbMb(f.size)) + '</span><button class="btn" type="button" data-convrem="' + i + '" data-cid="' + esc(cid) + '" aria-label="Tirar ' + esc(f.name || 'arquivo') + '">Tirar</button></li>';
  }).join('');
}
function convAdicionar(cid, lista) {
  var r = bilanJuntar(CONV_AX[cid] || [], Array.prototype.slice.call(lista || []));
  CONV_AX[cid] = r.arquivos;
  var ul = $('conv-anexos-lista'); if (ul) ul.innerHTML = convAnexosLi(cid);
  var err = $('conv-err'); if (err) { err.textContent = r.recusas.join(' '); err.hidden = !r.recusas.length; }
}
async function arquivosB64(lista) {
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var u8 = new Uint8Array(await lista[i].arrayBuffer()), bin = '';
    for (var k = 0; k < u8.length; k += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
    out.push({ name: lista[i].name, b64: btoa(bin) });
  }
  return out;
}
async function sendResposta(btn) {
  var err = $('conv-err'), txt = $('conv-txt').value.trim(), as = $('conv-assunto'), cid = btn.dataset.cid;
  err.hidden = true;
  if (!txt) { err.textContent = 'Escreva a resposta antes de enviar.'; err.hidden = false; return; }
  if (as && !as.value.trim()) { err.textContent = 'Escreva um assunto: ainda não há conversa por e-mail com ela.'; err.hidden = false; return; }
  var axs = CONV_AX[cid] || [];
  if (!axs.length && /\b(em anexo|anexad[oa]s?|segue (o|a|em))\b/i.test(txt) && !confirm('O texto fala em anexo, mas nenhum arquivo foi anexado. Enviar assim mesmo?')) return;
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { err.textContent = 'Sessão expirada. Recarregue a página e entre de novo.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var anexosB64 = await arquivosB64(axs);
    var res = await fetch(WORKER_BASE + '/api/crm/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token },
      body: JSON.stringify({ contato_id: cid, texto: txt, assunto: as ? as.value.trim() : undefined, anexos: anexosB64 })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    delete state.rascunho[cid]; delete CONV_AX[cid];
    await reload();
    if (state.view === 'pessoa' && state.sel === cid) { state.ptab = 'conversa'; await renderPessoa(); }
    toast(data.aviso || ('Resposta enviada' + (data.anexos ? ' com ' + data.anexos + (data.anexos === 1 ? ' anexo' : ' anexos') : '')), data.aviso ? 9000 : 0);
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
  var cab = '<h3 style="font-size:15px;margin:0 0 4px">Equipe Por Dentro</h3>';
  if (!ins) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Carregando…</p></div>';
  if (ins.err) return '<div class="panel" style="padding:16px">' + cab + '<p class="sub" style="margin:0">Falta rodar <b>db/crm-insights.sql</b> no SQL Editor do Supabase.</p></div>';
  var notas = (ins.vivos && ins.vivos.notas) || [], vivosIds = {};
  notas.forEach(function (n) { vivosIds[n.id] = 1; });
  var card = notas.length
    ? '<div class="inscard"><div class="inskicker">Equipe Por Dentro</div>' + notas.map(function (n) { return insNota(n, /^ingryd:/.test(n.id) ? 'nota sua' : 'automática'); }).join('') + '</div>'
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
  return '<span class="dchip' + (novo ? ' insnovo' : '') + '"><b>Equipe Por Dentro</b> ' + ins.vivos.notas.length + (ins.vivos.notas.length === 1 ? ' nota no ar' : ' notas no ar') + (novo ? ' · mudou agora' : '') + '</span>';
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
    [['insights_vivos', 'contato_id=eq.' + cid], ['insights_historico', 'contato_id=eq.' + cid], ['plataforma_cliques', 'contato_id=eq.' + cid], ['chat_mensagens', 'contato_id=eq.' + cid], ['propostas', 'contato_id=eq.' + cid], ['contatos', 'id=eq.' + cid]]
      .concat(uid ? [['checklist_items', 'user_id=eq.' + uid]] : [])
      .forEach(function (t) { ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t[0], filter: t[1] }, avisa); });
    VIVO.ch = ch.subscribe(function (status) { if (status !== 'SUBSCRIBED') poll(); });
  } catch (e) { poll(); }
}
async function atualizaAoVivo(cid, forca) {
  if (state.view !== 'pessoa' || state.sel !== cid || !state.ins || state.ins.cid !== cid) return pararAoVivo();
  var c = byC(cid); if (!c) return;
  var antes = state.ins, chatAntes = state.chat;
  var rk = await Promise.all([buscaChecklist(cid, VIVO.uid), buscaInsights(cid), buscaChat(cid), (state.ptab === 'plataforma' || fichaV2Ativa()) ? buscaInteracoes(cid) : null,
    supabase.from('contatos').select('dossie,respostas').eq('id', cid).maybeSingle()]);   // o dossiê se preenche conforme ela responde (funil e app)
  if (state.view !== 'pessoa' || state.sel !== cid) return;
  var rc = rk[4] && !rk[4].error && rk[4].data ? rk[4].data : null;
  var mudouDos = !!rc && state.dos && state.dos.cid === cid && JSON.stringify([rc.dossie || {}, rc.respostas || {}]) !== JSON.stringify([state.dos.d || {}, c.respostas || {}]);
  var sigChat = function (ch) { return JSON.stringify(ch ? [ch.msgs.length, ch.msgs.length ? ch.msgs[ch.msgs.length - 1].id : 0, Object.keys(ch.props).map(function (k) { return ch.props[k].status + ch.props[k].adiada_ate; })] : null); };
  var mudouIns = JSON.stringify([rk[1].vivos && rk[1].vivos.atualizado_em, rk[1].hist.length, rk[1].manuais.length]) !== JSON.stringify([antes.vivos && antes.vivos.atualizado_em, antes.hist.length, antes.manuais.length]);
  var mudouChk = JSON.stringify([rk[0].itens, rk[0].cliques.length]) !== JSON.stringify([state.dos && state.dos.chk && state.dos.chk.itens, state.dos && state.dos.chk && state.dos.chk.cliques.length]);
  var mudouChat = sigChat(rk[2]) !== sigChat(chatAntes);
  var sigInt = function (i) { return i && !i.err ? JSON.stringify([i.cliques.length, i.cliques[0] && i.cliques[0].criado_em, i.evs.length, i.evs[0] && i.evs[0].criado_em]) : ''; };
  var mudouInt = !!rk[3] && !rk[3].err && sigInt(rk[3]) !== sigInt(state.int);
  if (!mudouIns && !mudouChk && !mudouChat && !mudouInt && !mudouDos && !forca) return;
  if (mudouDos) { state.dos.d = rc.dossie || {}; c.respostas = rc.respostas || {}; if (!(state.dos.rasc && Object.keys(state.dos.rasc).length)) toast('O dossiê dela foi atualizado'); }
  state.ins = rk[1]; state.chat = rk[2]; if (rk[3] && !rk[3].err) state.int = rk[3]; if (state.dos && state.dos.cid === cid) state.dos.chk = rk[0];
  var painel = $('ins-box'); if (painel) painel.innerHTML = insightsHtml(state.ins, Date.now());
  var cb = $('chk-box'); if (cb) cb.innerHTML = checklistHtml(state.dos && state.dos.chk, Date.now());
  var ca = $('chk-aba'); if (ca) ca.innerHTML = checklistPanel(c);
  var cl = $('chk-lateral'); if (cl) cl.innerHTML = checklistLateralHtml(state.dos && state.dos.chk, Date.now(), 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px');
  pintaChat();   // só o fio: o que você está digitando na caixa fica
  if (fichaV2Ativa()) fxLive(c);
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
  return '<div class="cm ' + (eu ? 'eu' : 'ela') + (!eu && !m.lida_em ? ' nova' : '') + '">' + (m.acao ? '<span class="pill u-media">' + esc(CHAT_ACOES[m.acao] || m.acao) + '</span> ' : '') + esc(String(m.texto || '').replace(/\[([^\]\n]{1,60})\]\((https:\/\/\S+?)\)/g, '🔗 $1')) +
    '<small>' + hora + (eu ? (m.lida_em ? ' · lida' : ' · ainda não lida') : '') + '</small></div>';
}
function chatFioHtml(chat, agora) {
  if (!chat) return '<div class="empty">Carregando…</div>';
  if (chat.err) return '<div class="empty">Falta rodar <b>db/crm-chat.sql</b> no SQL Editor do Supabase.</div>';
  return chat.msgs.map(function (m) { return chatMsgHtml(m, chat, agora); }).join('') || '<div class="empty">Nenhuma mensagem ainda. Escreva abaixo e ela vê no chat do app.</div>';
}
// As mensagens que a montagem sugere para o chat (o que pode puxar um 1:1 ou levá-la a outro lugar). Só sugestão: você revisa e envia.
var CHAT_MOTIVO = { propor_1a1: 'Propor 1:1', redirecionar: 'Redirecionar', cobrar_passo: 'Cobrar um passo' };
function chatSugLista(c) {
  var cv = state.pnConv && state.pnConv.cid === c.id ? state.pnConv.lista : [], ult = null, dec = fxSugsLidas(c.id);
  cv.forEach(function (x) { if (x.m && x.m.length) ult = x; });
  if (!ult) return [];
  return ult.m.map(function (x, i) { return { id: 'm-' + ult.versao + '-' + i, texto: x.texto, motivo: x.motivo, momento: x.momento || '', v: ult.versao, est: dec['m-' + ult.versao + '-' + i] || '' }; })
    .filter(function (x) { return x.est !== 'descartada'; });
}
function chatSugestoesHtml(c) {
  if (!state.pnConv || state.pnConv.cid !== c.id) setTimeout(function () { fxCarregaConversas(c); }, 0);   // as sugestões vêm das leituras da montagem
  var l = chatSugLista(c);
  if (!l.length) return '';
  return '<div class="msgsug" style="margin:10px 0 0"><div class="k">Sugeridas pela montagem · você revisa antes de enviar</div>' + l.map(function (x) {
    return '<div class="feeditem" style="align-items:flex-start"><div style="flex:none;min-width:84px"><span class="pill">' + esc(CHAT_MOTIVO[x.motivo] || x.motivo) + '</span></div><div class="fbody" style="min-width:0"><p style="margin:0">' + esc(x.texto) + '</p>' +
      '<time>conversa ' + esc(String(x.v)) + (x.momento ? ' · ' + esc(x.momento) : '') + (x.est === 'usada' ? ' · já levada para a caixa' : '') + '</time></div>' +
      '<div style="flex:none;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn" style="padding:5px 10px;font-size:12px" data-chatsug="' + esc(x.id) + '">Usar no chat</button>' +
      '<button type="button" class="btn" style="padding:5px 10px;font-size:12px" data-chatsugdesc="' + esc(x.id) + '">Descartar</button></div></div>';
  }).join('') + '</div>';
}
function chatSugUsar(id) {
  var c = byC(state.sel); if (!c) return;
  var x = chatSugLista(c).filter(function (y) { return y.id === id; })[0]; if (!x) return;
  var nome = (c.nome || '').split(/\s+/)[0], tx = (!/^oi\b/i.test(x.texto) && nome ? 'Oi, ' + nome + '! ' : '') + x.texto;
  state.chatRasc = tx; var box = $('chat-txt'); if (box) { box.value = tx; if (box.focus) box.focus(); }
  fxSugGuarda(c.id, id, 'usada');
}
function chatSugDescartar(id) { var c = byC(state.sel); if (!c) return; fxSugGuarda(c.id, id, 'descartada'); var b = $('chat-box'); if (b) b.innerHTML = chatPanelHtml(c, state.chat, H4_PLAT); else fxPintaCorpo(); }
// Interações: os botões que escrevem (ou abrem a proposta) por você, num dropdown. Os seus próprios botões ficam só neste navegador.
function chatAtalhos() { try { var v = JSON.parse(localStorage.getItem('crm_chat_atalhos') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function chatAtalhosSalva(l) { try { localStorage.setItem('crm_chat_atalhos', JSON.stringify(l)); } catch (e) { /* sem localStorage */ } }
function chatInteracoesConteudo() {
  var chip = function (k, rot) { return '<button class="chip" type="button" data-chatquick="' + k + '">' + esc(rot) + '</button>'; };
  var meus = chatAtalhos().map(function (a) { return '<span class="fx-chipb"><button class="chip" type="button" data-chatquick="' + esc(a.k) + '" title="' + (a.u ? 'Escreve a mensagem e anexa o link' : 'Escreve a mensagem') + '">' + esc(a.r) + (a.u ? ' ↗' : '') + '</button><button type="button" class="fx-x" data-chatatdel="' + esc(a.k) + '" aria-label="Apagar o botão ' + esc(a.r) + '">×</button></span>'; }).join('');
  var novo = state.chatNovoAt ? '<div class="fx-atal"><input id="chat-at-nome" type="text" maxlength="28" placeholder="Nome do botão (ex.: Revisão de dossiê)" aria-label="Nome do botão"><textarea id="chat-at-msg" class="notebox" maxlength="600" placeholder="Mensagem que o botão escreve para ela" aria-label="Mensagem do botão" style="min-height:64px"></textarea><input id="chat-at-url" type="url" placeholder="https://link (opcional): vira botão na mensagem" aria-label="Link do botão (opcional)"><p class="sub" id="chat-at-err" hidden style="margin:0"></p><div class="actions"><button class="btn" type="button" data-chatatnovo="1">Cancelar</button><button class="btn primary" type="button" data-chatatsalva="1">Salvar botão</button></div></div>' : '';
  return '<h4 class="fx-h4">Propor serviço</h4><div class="tpls">' + chip('um_a_um', 'Propor 1:1 de 20 min') + chip('proposta', 'Nova proposta') + meus + '<button class="chip" type="button" data-chatatnovo="1" aria-expanded="' + !!state.chatNovoAt + '">+ Criar meu botão</button></div>' + novo +
    '<h4 class="fx-h4">Perguntar e lembrar</h4><div class="tpls">' + chip('como_vai', 'Perguntar como está') + chip('documentos', 'Pedir documentos') + chip('prazo', 'Lembrar do prazo') + '</div>';
}
function chatInteracoesHtml() {
  return '<h4 class="fx-h4" style="margin:12px 0 6px">Interações</h4><details class="fx-drop" id="chat-drop"><summary><span>Propor serviço, perguntar e lembrar <small>' + (5 + chatAtalhos().length) + ' botões</small></span></summary><div class="fx-drop-c" id="chat-inter-c">' + chatInteracoesConteudo() + '</div></details>';
}
function chatAtalhoAcao(t) {
  var box = $('chat-inter-c'); if (!box) return;
  if (t.dataset.chatatnovo) { state.chatNovoAt = !state.chatNovoAt; box.innerHTML = chatInteracoesConteudo(); var n = $('chat-at-nome'); if (n) n.focus(); return; }
  if (t.dataset.chatatdel) { chatAtalhosSalva(chatAtalhos().filter(function (a) { return a.k !== t.dataset.chatatdel; })); box.innerHTML = chatInteracoesConteudo(); return; }
  var r = $('chat-at-nome').value.replace(/[\[\]()\n]/g, ' ').trim(), m = $('chat-at-msg').value.trim(), u = $('chat-at-url').value.trim(), er = $('chat-at-err');
  var falha = function (x) { er.textContent = x; er.hidden = false; };
  if (!r) return falha('Dê um nome ao botão.'); if (!m) return falha('Escreva a mensagem que o botão coloca para ela.');
  if (u && (!/^https:\/\/\S+$/i.test(u) || /[()\s]/.test(u))) return falha('O link precisa começar com https:// e não ter espaços nem parênteses.');
  var l = chatAtalhos(); l.push({ k: 'c_' + Date.now(), r: r, t: m, u: u }); chatAtalhosSalva(l); state.chatNovoAt = false; box.innerHTML = chatInteracoesConteudo();
  var dr = $('chat-drop'); if (dr) { var sm = dr.querySelector('summary small'); if (sm) sm.textContent = (5 + l.length) + ' botões'; }
}
function chatPanelHtml(c, chat, h4) {
  var btn = function (k, rot) { return '<button class="chip" type="button" data-chatquick="' + k + '">' + esc(rot) + '</button>'; };
  var nova = chatNaoLidas(chat);
  return '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Chat com ela' + (nova ? ' <span class="count">' + nova + (nova === 1 ? ' nova' : ' novas') + '</span>' : '') + '</h4>' +
    '<div class="cfio chatfio" id="chat-fio" aria-live="polite">' + chatFioHtml(chat, Date.now()) + '</div>' + chatSugestoesHtml(c) +
    '<div id="chat-inter">' + chatInteracoesHtml() + '</div>' +
    '<textarea class="notebox" id="chat-txt" maxlength="1000" placeholder="Escreva para ela. Aparece no chat do app." aria-label="Mensagem para ela" style="min-height:76px"></textarea>' +
    '<div class="tpls" style="margin:8px 0 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input id="chat-bt-rot" type="text" maxlength="40" placeholder="Texto do botão" aria-label="Texto do botão" style="flex:1 1 130px;min-width:0">' +
    '<input id="chat-bt-url" type="url" placeholder="https://link" aria-label="Link do botão (https)" style="flex:2 1 190px;min-width:0"><button class="btn" type="button" data-chatbotao="1">+ Botão com link</button></div>' +
    '<p class="sub" style="margin:4px 0 0">Ela vê o botão abaixo da mensagem. Só links https.</p>' +
    '<div class="actions" style="margin-top:8px"><button class="btn primary" type="button" data-chatenviar="' + esc(c.id) + '">Enviar</button></div></div>';
}
// Botão de link no chat: vira [texto](https://…) no fim da mensagem; o app transforma em botão (assets/js/chat.js, extrairBotoes).
function chatInserirBotao() {
  var r = $('chat-bt-rot'), u = $('chat-bt-url'), tx = $('chat-txt'); if (!r || !u || !tx) return;
  var rot = r.value.replace(/[\[\]()\n]/g, ' ').trim(), url = u.value.trim();
  if (!rot) return toast('Escreva o texto do botão.', 3500);
  if (!/^https:\/\/\S+$/i.test(url) || /[()\s]/.test(url)) return toast('O link precisa começar com https:// e não ter espaços nem parênteses.', 5000);
  tx.value = (tx.value.trim() ? tx.value.replace(/\s+$/, '') + '\n' : '') + '[' + rot + '](' + url + ')';
  state.chatRasc = tx.value; r.value = ''; u.value = ''; tx.focus();
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
// Sai um e-mail por mensagem sua (o chat é a Central de perguntas: resposta em até 3 dias úteis). Se falhar, a mensagem já foi: só avisa que o e-mail não saiu.
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
var PLAT_ABAS = [['assistente', 'Equipe Por Dentro'], ['chat', 'Chat'], ['checklist', 'Checklist'], ['caso', 'Caso'], ['interacoes', 'Interações']];
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
}, true);
// ---------- Aba Caso: o que o CRM entendeu da conversa e o que vai para ela (db/crm-caso.sql, crm-caso-importar.sql) ----------
// Tudo nasce como rascunho (a leitura do Notion). Nada chega à pessoa sem você revisar e publicar; ela só vê o que está publicado
// ou agendado, e só se houver consentimento de serviço. As regras ficam no banco (gatilhos): aqui só se mostra e se aperta o botão.
var CASO_ERROS = { ordem_invalida: 'A ordem pedida não vale (aviso repetido ou de outra pessoa). Atualize a aba.', sem_consentimento: 'Falta o consentimento de serviço dela (aba Ficha). Sem ele nada é publicado nem agendado.', revise_antes_de_publicar: 'Revise o item antes de publicar.',
  sem_permissao: 'Sem permissão. Entre de novo no CRM.', aviso_encerrado: 'Esse aviso já foi encerrado.', item_nao_encontrado: 'O item não existe mais. Atualize a aba.', caso_acoes_estado_check: 'Falta rodar db/crm-passos-revisao.sql no Supabase (primeiro no teste) para recusar um passo.', titulo_longo: 'O texto do passo passa de 120 caracteres.', nota_longa: 'A observação passa de 100 caracteres.', home_cheia: 'A home já está cheia nessa categoria. Tire um item na Página inicial para trocar.', item_invalido: 'Esse item não cabe nessa categoria da home.' };
var CASO_TIPO_ACH = { fato: 'Fato', deducao: 'Dedução', duvida: 'Dúvida' };
var CASO_CERTEZA = { literal: 'literal', inferido: 'inferido', a_confirmar: 'a confirmar', nao_bate: 'não bate' };
var CASO_CANAL = { plataforma: 'Plataforma', email: 'E-mail', convite: 'Convite', instagram: 'Instagram', so_eu: 'Só eu' };
var CASO_TIPO_ITEM = { bilan: 'Bilan', marco: 'Prazo', documento: 'Documento', escola: 'Escola', modelo: 'Modelo de e-mail' };
var CASO_TIPO_AVISO = { pergunta: 'Pergunta', proposta: 'Proposta', inteligencia: 'Inteligência', oferta: 'Oferta' };
var CASO_ESTADO_AVISO = { rascunho: 'Rascunho', agendado: 'Agendado', liberado: 'Liberado', lido: 'Lido', respondido: 'Respondido', dispensado: 'Dispensado', cancelado: 'Cancelado' };
var CASO_ACO_COLS = 'id,n,titulo,dono,canal,botao,prazo,prazo_texto,prazo_a_confirmar,estado,certeza,publicada_em,concluida_em,concluida_por';
var CASO_ACO_COLS_MONT = 'lista_chave,camada,a_conferir,origem_chave,demarche,subitens,editado_em';   // db/crm-caso-listas.sql e crm-montagem-aplicar.sql
async function buscaCaso(cid) {
  var r = await Promise.all([
    supabase.from('caso_achados').select('id,chave,tipo,texto,origem,certeza,estado,conferido_em').eq('contato_id', cid).order('id', { ascending: true }).limit(80),
    supabase.from('caso_acoes').select(CASO_ACO_COLS + ',' + CASO_ACO_COLS_MONT).eq('contato_id', cid).order('n', { ascending: true }).limit(150),
    supabase.from('board_itens').select('id,tipo,titulo,resumo,dados,estado,ordem,link,versao,descricao,arquivo_caminho').eq('contato_id', cid).order('ordem', { ascending: true }).limit(80),   // descricao/arquivo: db/crm-caso-arquivos.sql
    supabase.from('caso_avisos').select('id,tipo,titulo,texto,resposta_tipo,grava_em,modo,dias_apos,ordem,pausa_dias,liberar_em,liberado_em,estado,resposta,adiado_ate').eq('contato_id', cid).order('ordem', { ascending: true }).limit(40),
    supabase.from('consentimentos').select('aceito,criado_em').eq('contato_id', cid).eq('finalidade', 'servico').order('criado_em', { ascending: false }).limit(1),
    supabase.from('escolas_dela').select('id,nome,link,nota,criterios,criado_em').eq('contato_id', cid).order('criado_em', { ascending: true }).limit(40),   // db/crm-escolas-dela.sql; sem ele, a seção some
    supabase.from('caso_listas').select('chave,titulo,estado,origem').eq('contato_id', cid).order('ordem', { ascending: true }).limit(20),   // db/crm-caso-listas.sql; sem ele, só some o nome da lista
    supabase.from('caso_home').select('id,categoria,step_key,board_id,ordem,destaque').eq('contato_id', cid).order('ordem', { ascending: true }).limit(20)   // db/crm-caso-home.sql (destaque: db/crm-caso-home-destaque.sql); sem ele, a Página inicial pede o SQL
  ]);
  // Sem a coluna destaque (db/crm-caso-home-destaque.sql ainda não rodado), a home volta sem ela: o resto continua abrindo.
  if (r[7].error) { r[7] = await supabase.from('caso_home').select('id,categoria,step_key,board_id,ordem').eq('contato_id', cid).order('ordem', { ascending: true }).limit(20); r[7].semDestaque = true; }
  // Sem as colunas da montagem (SQL ainda não rodado), volta à busca antiga: o caso continua abrindo.
  if (r[1].error) r[1] = await supabase.from('caso_acoes').select(CASO_ACO_COLS).eq('contato_id', cid).order('n', { ascending: true }).limit(150);
  if (r[2].error) r[2] = await supabase.from('board_itens').select('id,tipo,titulo,resumo,dados,estado,ordem,link,versao').eq('contato_id', cid).order('ordem', { ascending: true }).limit(80);   // sem crm-caso-arquivos.sql: abre sem o upload
  var err = r[0].error || r[1].error || r[2].error || r[3].error || null;
  return { cid: cid, err: err, ach: r[0].data || [], aco: r[1].data || [], itens: r[2].data || [], avs: r[3].data || [], consent: !!(r[4].data && r[4].data[0] && r[4].data[0].aceito === true), escolasDela: r[5] && !r[5].error ? (r[5].data || []) : [], listas: r[6] && !r[6].error ? (r[6].data || []) : [], home: r[7] && !r[7].error ? (r[7].data || []) : null, homeSemDestaque: !!(r[7] && r[7].semDestaque), ed: null, agenda: null };
}
function casoPendentes(k) {
  if (!k || k.err) return 0;
  return k.ach.filter(function (x) { return x.estado === 'conferir'; }).length + k.itens.filter(function (x) { return x.estado === 'proposto'; }).length + k.avs.filter(function (x) { return x.estado === 'rascunho'; }).length;
}
function casoPil(txt, cls) { return '<span class="pill' + (cls ? ' ' + cls : '') + '">' + esc(txt) + '</span>'; }
// Botão só com um símbolo (+ ou ×): o rótulo vai em aria-label e na dica.
function casoIco(acao, id, glifo, rot, ligado) { return '<button type="button" class="fx-ic' + (ligado ? ' on' : '') + '" data-caso="' + acao + '" data-id="' + esc(String(id)) + '"' + (ligado ? ' aria-pressed="true"' : '') + ' aria-label="' + esc(rot) + '" title="' + esc(rot) + '">' + esc(glifo) + '</button>'; }
function casoBtn(acao, id, rot, extra) { return '<button type="button" class="btn" data-caso="' + acao + '" data-id="' + esc(String(id)) + '"' + (extra || '') + ' style="padding:5px 10px;font-size:12px">' + esc(rot) + '</button>'; }
function casoSecao(titulo, sub, corpo) { var longo = sub && sub.length > 28; return '<section class="dbloco" style="margin-top:14px"><h4' + (longo ? ' title="' + esc(sub) + '"' : '') + '>' + esc(titulo) + (sub && !longo ? ' <span class="sub fx-sub">' + esc(sub) + '</span>' : '') + '</h4>' + corpo + '</section>'; }
// Linha minimalista, a mesma em todas as listas do caso: ponto de estado, texto, ícones. Dois cliques no texto (ou Enter) editam; no celular o ✎ faz o mesmo.
// Ícones em SVG (traço de 1,8 px, mesma família): nítidos em qualquer tela e iguais em todos os sistemas.
var CASO_SVG = { check: 'M5 12.5l4.5 4.5L19 7.5', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', pencil: 'M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1zM14 7l3 3', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12', undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 010 10', clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', more: 'M6 12h.01M12 12h.01M18 12h.01',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5', mail: 'M4 6h16v12H4zM4 7l8 6 8-6', quote: 'M8 7H5v6h3a3 3 0 01-3 3M18 7h-3v6h3a3 3 0 01-3 3', cal: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4', school: 'M3 10l9-5 9 5-9 5zM7 12v4c2 2 8 2 10 0v-4', clip: 'M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.5 17.2a1.7 1.7 0 01-2.4-2.4L15 7' };
function casoSvg(n, tam) { return '<svg viewBox="0 0 24 24" width="' + (tam || 16) + '" height="' + (tam || 16) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + CASO_SVG[n] + '"/></svg>'; }
// Posição fixa de cada ação: os ícones ficam alinhados em colunas, mesmo quando a linha tem menos ações.
var CASO_ICONES = { 'item-rev': ['check', 'Marcar como revisado', 1], 'item-pub': ['up', 'Publicar para ela', 1], 'item-ret': ['down', 'Retirar', 1], 'aco-pub': ['up', 'Publicar para ela', 1], 'aco-retirar': ['down', 'Retirar', 1],
  'aco-fim': ['check', 'Concluir', 0], 'aco-reabrir': ['undo', 'Reabrir', 0], 'ed-item': ['pencil', 'Editar', 2], 'ed-aco': ['pencil', 'Editar', 2], 'ed-ach': ['pencil', 'Editar', 2], 'ed-av': ['pencil', 'Editar a pergunta', 2], 'ed-chk': ['pencil', 'Editar', 2], 'aco-recusar': ['x', 'Recusar este passo', 4], 'ag-abrir': ['clock', 'Mudar a pausa', 2],
  'home-add': ['plus', 'Adicionar na página inicial', 3], 'home-del': ['x', 'Tirar da página inicial', 3], 'item-del-pede': ['trash', 'Excluir', 4], 'av-cancel': ['x', 'Cancelar', 4] };
function casoLinha(esq, meio, btns, cls) {
  var ed = /data-caso="(ed-[a-z]+)" data-id="([^"]*)"/.exec(btns || '');
  var ponto = String(esq || '').replace(/<span class="pill([^"]*)">([^<]*)<\/span>/, function (m, cls, txt) {
    return '<span class="fx-dot ' + (/u-baixa/.test(cls) ? 'ok' : /u-media/.test(cls) ? 'mid' : /u-alta/.test(cls) ? 'bad' : 'off') + '" role="img" aria-label="' + txt + '" title="' + txt + '"></span>';
  });
  var slots = ['', '', '', ''], resto = '';
  var sem = String(btns || '').replace(/<button type="button" class="(?:btn|fx-ic(?: on)?)" data-caso="([^"]+)" data-id="([^"]*)"([^>]*)>([^<]*)<\/button>/g, function (m, acao, id, resto2, txt) {
    var i = CASO_ICONES[acao]; if (!i) return m;
    var al = /aria-label="([^"]*)"/.exec(resto2), r = al ? al[1] : (acao.indexOf('home-') === 0 ? i[1] : txt || i[1]), on = acao === 'home-del';   // já vêm escapados
    slots[i[2]] = '<button type="button" class="fx-ic' + (on ? ' on' : '') + '" data-caso="' + acao + '" data-id="' + id + '"' + (on ? ' aria-pressed="true"' : '') + ' aria-label="' + r + '" title="' + r + '">' + casoSvg(i[0], 16) + '</button>';
    return '';
  });
  var icones = slots.map(function (x) { return x || '<span class="fx-slot" aria-hidden="true"></span>'; }).join('') + sem;
  return '<div class="feeditem fx-ln' + (cls ? ' ' + cls : '') + '"><div class="fx-ln-e">' + ponto + '</div><div class="fbody fx-ln-t"' + (ed ? ' data-dbl="' + ed[1] + '" data-id="' + ed[2] + '" tabindex="0" title="Dois cliques para editar"' : '') + '><p style="margin:0">' + meio + '</p></div><div class="fx-ln-b">' + icones + '</div></div>';
}
function casoEditor(tipo, id, campos) {
  return '<div class="feeditem"><div class="fbody" style="width:100%">' + campos + '<div style="display:flex;gap:6px;margin-top:6px">' + casoBtn('salvar-' + tipo, id, 'Salvar') + casoBtn('cancelar', id, 'Cancelar') + '</div></div></div>';
}
function casoAchadosHtml(k) {
  if (!k.ach.length) return '<div class="empty" style="padding:14px">Nenhum achado. Leia a página do Notion no Onboarding.</div>';
  return k.ach.map(function (x) {
    if (k.ed && k.ed.t === 'ach' && k.ed.id === x.id) return casoEditor('ach', x.id, '<textarea id="caso-ed-texto" maxlength="400" rows="3" style="width:100%">' + esc(x.texto) + '</textarea>');
    var est = x.estado === 'ok' ? casoPil('Conferido', 'u-baixa') : x.estado === 'descartado' ? casoPil('Descartado') : casoPil('Conferir', 'u-media');
    var btns = (x.estado === 'conferir' ? casoBtn('ach-ok', x.id, 'Conferido') : casoBtn('ach-voltar', x.id, 'Voltar a conferir')) +
      (x.estado !== 'descartado' ? casoBtn('ach-desc', x.id, 'Descartar') : '') + casoBtn('ed-ach', x.id, 'Editar');
    return casoLinha(est, esc(x.texto) + ' <span class="sub">· ' + esc(CASO_TIPO_ACH[x.tipo] || x.tipo) + ', ' + esc(CASO_CERTEZA[x.certeza] || x.certeza) + '</span>', btns);
  }).join('');
}
function casoPrazo(a) {
  if (a.prazo) return fmtDay(a.prazo) + (a.prazo_a_confirmar ? ' (a confirmar)' : '');
  return a.prazo_texto || (a.prazo_a_confirmar ? 'a confirmar' : '');
}
function casoAcoesHtml(k, dono) {
  var lista = dono ? k.aco.filter(function (a) { return a.dono === dono; }) : k.aco;
  if (!lista.length) return '<div class="empty" style="padding:14px">Nenhuma ação.</div>';
  return lista.map(function (a) {
    if (k.ed && k.ed.t === 'aco' && k.ed.id === a.id) return casoEditor('aco', a.id, '<input id="caso-ed-titulo" class="t" maxlength="160" style="width:100%" value="' + esc(a.titulo) + '">');
    var fim = a.estado === 'concluida';
    var pub = a.estado === 'recusada' ? casoPil('Recusada') : a.publicada_em ? casoPil('Publicada', 'u-baixa') : casoPil('Rascunho', 'u-media');
    var vis = a.dono === 'ela' && a.canal === 'plataforma';   // só estas aparecem para ela no Checklist
    var btns = (fim ? casoBtn('aco-reabrir', a.id, 'Reabrir') : casoBtn('aco-fim', a.id, 'Concluir')) +
      (vis ? (a.publicada_em ? casoBtn('aco-retirar', a.id, 'Retirar') : casoBtn('aco-pub', a.id, 'Publicar para ela')) : '') + casoBtn('ed-aco', a.id, 'Editar');
    var dentro = a.dono === 'ela' && /mesma\s+liga[cç][aã]o/i.test(a.prazo_texto || '');   // o app não põe na fila: já está nas perguntas da ligação
    var pede = a.dono === 'ela' && a.canal === 'plataforma' ? (a.botao === 'marcar_marco' ? 'ela informa uma data' : a.botao === 'gerar_rascunho' && /ligar|liga[cç]/i.test(a.titulo) ? 'ela vê as perguntas da ligação' : 'ela só marca “Feito”') : '';
    var meta = [a.dono === 'ela' ? 'Ela' : 'Ingryd', CASO_CANAL[a.canal] || a.canal, casoPrazo(a), dentro ? 'dentro da ligação (não vai para a fila)' : pede].filter(Boolean).join(' · ');
    return casoLinha((vis ? pub : casoPil('Só equipe')), (fim ? '<s>' + esc(a.titulo) + '</s>' : esc(a.titulo)) + ' <span class="sub">· ' + esc(meta) + (fim ? ' · concluída' + (a.concluida_por === 'ela' ? ' por ela' : ' pela equipe') : '') + '</span>', btns);
  }).join('');
}
// Seções do bilan <-> texto editável. "# Título" abre seção; cada linha é um item; "? texto" = em conferência.
function casoSecoesTexto(secoes) {
  return (Array.isArray(secoes) ? secoes : []).map(function (sec) {
    return '# ' + (sec.titulo || '') + '\n' + (Array.isArray(sec.itens) ? sec.itens : []).map(function (x) { return (x.estado === 'em_conferencia' ? '? ' : '') + (x.texto || ''); }).join('\n');
  }).join('\n\n');
}
function casoTextoSecoes(txt) {
  var secoes = [], atual = null;
  String(txt || '').split('\n').forEach(function (l) {
    l = l.trim(); if (!l) return;
    if (l.charAt(0) === '#') { atual = { titulo: l.replace(/^#+\s*/, '').slice(0, 80) || 'Sem título', itens: [] }; secoes.push(atual); return; }
    if (!atual) { atual = { titulo: 'Conversa', itens: [] }; secoes.push(atual); }
    var conf = l.charAt(0) === '?'; if (conf) l = l.replace(/^\?\s*/, '');
    if (l) atual.itens.push({ texto: l.slice(0, 220), estado: conf ? 'em_conferencia' : 'confirmado' });
  });
  return secoes.slice(0, 8).map(function (sec) { sec.itens = sec.itens.slice(0, 12); return sec; });
}
var CASO_GLIFO = { documento: casoSvg('file', 14), modelo: casoSvg('mail', 14), bilan: casoSvg('quote', 14), marco: casoSvg('cal', 14), escola: casoSvg('school', 14) };
// O resto da linha, curto: só o que muda a decisão.
function casoItemMeta(it) {
  var d = it.dados || {};
  if (it.tipo === 'marco') return d.data ? fmtDay(d.data) + (d.a_confirmar ? ' · a confirmar' : '') : 'a confirmar';
  if (it.tipo === 'bilan') return ((d.secoes || []).length) + ' seções';
  if (it.tipo === 'documento') return d.direcao === 'recebe' ? (it.arquivo_caminho ? 'arquivo' : it.link ? 'link' : it.descricao ? 'texto' : 'sem arquivo') : 'ela reúne';
  if (it.tipo === 'escola') return d.cidade || '';
  return it.resumo || '';
}
// Anexar direto da linha: escolhe o arquivo e ele sobe na hora (o controle nativo evita o bloqueio de pop-up do navegador).
function casoAnexarIco(it) {
  var r = it.arquivo_caminho ? 'Trocar o arquivo (PDF, imagem, ZIP, MD ou TXT, até 10 MB)' : 'Anexar arquivo (PDF, imagem, ZIP, MD ou TXT, até 10 MB)';
  return '<label class="fx-ic fx-anexar' + (it.arquivo_caminho ? ' on' : '') + '" title="' + r + '">' + casoSvg('clip', 16) + '<input type="file" data-anexar="' + esc(String(it.id)) + '" aria-label="' + r + '" accept="' + CASO_ARQ_ACCEPT + '"></label>';
}
function casoItemResumo(it) {
  var d = it.dados || {};
  if (it.tipo === 'marco') return d.data ? fmtDay(d.data) + (d.a_confirmar ? ' (a confirmar)' : '') : (d.nota || 'a confirmar');
  if (it.tipo === 'bilan') return ((d.secoes || []).length) + ' seções';
  if (it.tipo === 'documento') return d.direcao === 'recebe' ? 'ela recebe de você' + (it.arquivo_caminho ? ' · arquivo ' + casoNomeArquivo(it.arquivo_caminho) : it.link ? ' · link' : ' · sem arquivo ainda') + (it.descricao ? ' · com descrição' : '') : 'ela reúne';
  return it.resumo || '';
}
// O editor de um item do board. O que a pessoa vê (nome, data, escola) você corrige aqui: quando ela sinalizar "algo está errado", é este o lugar.
function casoCampo(rot, html) { return '<label style="display:block;margin-top:8px"><span class="sub" style="display:block;margin-bottom:2px">' + esc(rot) + '</span>' + html + '</label>'; }
// "PVT, visto de estudante, DU Aix" → ['PVT', 'visto de estudante', 'DU Aix']. Mais de 6 ou palavra de mais de 30 letras: recusa (null).
function casoPalavras(txt) {
  var l = String(txt || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return l.length > 6 || l.some(function (x) { return x.length > 30; }) ? null : l;
}
function casoItemCampos(it) {
  var d = it.dados || {};
  var tit = function (rot) { return casoCampo(rot, '<input id="caso-ed-titulo" class="t" maxlength="120" style="width:100%" value="' + esc(it.titulo) + '">'); };
  if (it.tipo === 'marco') {
    return tit('O que é este prazo? (ela lê este texto)') +
      casoCampo('Data', '<input id="caso-ed-data" type="date" style="min-height:40px" value="' + esc(d.data || '') + '">') +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input id="caso-ed-conf" type="checkbox"' + (d.a_confirmar ? ' checked' : '') + '> <span>A confirmar (ela vê "a confirmar" ao lado da data)</span></label>' +
      casoCampo('Explicação (opcional)', '<textarea id="caso-ed-nota" maxlength="200" rows="2" style="width:100%">' + esc(d.nota || '') + '</textarea>');
  }
  if (it.tipo === 'escola') {
    return tit('Nome da escola ou do curso') +
      casoCampo('Cidade', '<input id="caso-ed-cidade" class="t" maxlength="80" style="width:100%" value="' + esc(d.cidade || '') + '">') +
      casoCampo('Curso', '<input id="caso-ed-curso" class="t" maxlength="120" style="width:100%" value="' + esc(d.curso || '') + '">') +
      casoCampo('Custo estimado (€)', '<input id="caso-ed-custo" type="number" min="0" max="100000" step="50" style="min-height:40px" value="' + esc(d.custo_eur == null ? '' : d.custo_eur) + '">') +
      casoCampo('Site (https://…)', '<input id="caso-ed-link" class="t" maxlength="500" style="width:100%" value="' + esc(it.link || '') + '">');
  }
  if (it.tipo === 'documento' && d.direcao !== 'recebe') {
    // Os selos (o que o documento exige) aparecem no Checklist dela como palavras-chave; só para o que ela reúne.
    var selosAtuais = (d && d.selos) || [], selosHtml = '';
    if (d.direcao !== 'recebe') {
      selosHtml = casoCampo('Selos (o que este documento exige)', CASO_SELOS.map(function (s) {
        return '<label style="margin-right:12px"><input type="checkbox" class="caso-ed-selo" value="' + s[0] + '"' + (selosAtuais.indexOf(s[0]) >= 0 ? ' checked' : '') + '> ' + esc(s[1]) + '</label>';
      }).join(''));
    }
    return tit('Nome do documento') + casoResumoCampo(it.resumo) + selosHtml + casoCampo('Arquivo (link https://…; vazio = "chega em breve")', '<input id="caso-ed-link" class="t" maxlength="500" style="width:100%" value="' + esc(it.link || '') + '">');
  }
  if (it.tipo === 'modelo') {
    return tit('Nome da mensagem') + casoResumoCampo(it.resumo) +
      casoCampo('Assunto (e-mail)', '<input id="caso-ed-assunto" class="t" maxlength="150" style="width:100%" value="' + esc(d.assunto || '') + '">') +
      casoCampo('Texto', '<textarea id="caso-ed-corpo" maxlength="3000" rows="6" style="width:100%">' + esc(d.corpo || '') + '</textarea>') +
      casoCampo('Tradução (opcional)', '<textarea id="caso-ed-traducao" maxlength="3000" rows="3" style="width:100%">' + esc(d.traducao || '') + '</textarea>');
  }
  if (it.tipo === 'bilan') {
    return tit('Nome da conversa (ela lê este título)') +
      casoCampo('Dia da conversa', '<input id="caso-ed-data" type="date" style="min-height:40px" value="' + esc(d.data || '') + '">') +
      casoCampo('Palavras-chave (até 6, separadas por vírgula: é o que faz ela lembrar do assunto)', '<input id="caso-ed-palavras" class="t" maxlength="200" style="width:100%" value="' + esc((d.palavras || []).join(', ')) + '">') +
      casoResumoCampo(it.resumo, 'Resumo de uma linha (opcional)') +
      casoCampo('O que ela lê na conversa. Uma linha com # abre uma seção; cada linha abaixo é um item; começar com ? marca “a equipe ainda vai confirmar”', '<textarea id="caso-ed-secoes" rows="14" maxlength="6000" style="width:100%">' + esc(casoSecoesTexto(d.secoes)) + '</textarea>');
  }
  if (it.tipo === 'documento' && d.direcao === 'recebe') {
    return tit('Nome do documento') + casoResumoCampo(it.resumo) + casoDescricaoCampo(it.descricao, 'caso-ed-') +
      casoCampo('Link (Notion público ou privado, Drive… https://…)', '<input id="caso-ed-link" class="t" maxlength="500" placeholder="https://…" style="width:100%" value="' + esc(it.link || '') + '">') + casoArquivoCampo(it);
  }
  return tit('Título') + casoCampo('Link (opcional)', '<input id="caso-ed-link" class="t" maxlength="500" placeholder="https://…" style="width:100%" value="' + esc(it.link || '') + '">');
}
function casoResumoCampo(valor, rot) { return casoCampo(rot || 'O que é (uma linha, ela lê antes de abrir)', '<input id="caso-ed-resumo" class="t" maxlength="240" style="width:100%" value="' + esc(valor || '') + '">'); }
// Formulário de um item novo (documento, mensagem pronta ou bilan). Entra como "proposto": você revisa e publica como os outros.
function casoNovoHtml(tipo) {
  var d = new Date().toISOString().slice(0, 10);
  var campos = tipo === 'documento'
    ? casoCampo('Nome do documento', '<input id="caso-novo-titulo" class="t" maxlength="120" style="width:100%" placeholder="ex.: PDF das escolas de FLE">') + casoResumoCampoNovo() + casoDescricaoCampo('', 'caso-novo-') + casoCampo('Link (Notion público ou privado, Drive… https://…)', '<input id="caso-novo-link" class="t" maxlength="500" style="width:100%">') + casoArquivoCampo(null, 'caso-novo-arq') + '<p class="sub" style="margin:6px 0 0">Sem link nem arquivo, ela vê “chega em breve”. Notion privado: ela precisa ter acesso à página.</p>'
    : tipo === 'modelo'
    ? casoCampo('Nome da mensagem', '<input id="caso-novo-titulo" class="t" maxlength="120" style="width:100%" placeholder="ex.: E-mail para as escolas">') + casoResumoCampoNovo() +
      casoCampo('Assunto (e-mail)', '<input id="caso-novo-assunto" class="t" maxlength="150" style="width:100%">') + casoCampo('Texto', '<textarea id="caso-novo-corpo" maxlength="3000" rows="6" style="width:100%"></textarea>') + casoCampo('Tradução (opcional)', '<textarea id="caso-novo-traducao" maxlength="3000" rows="3" style="width:100%"></textarea>')
    : casoCampo('Nome da conversa', '<input id="caso-novo-titulo" class="t" maxlength="120" style="width:100%" placeholder="ex.: Conversa de ' + d.split('-').reverse().join('/') + '">') +
      casoCampo('Dia da conversa', '<input id="caso-novo-data" type="date" style="min-height:40px" value="' + d + '">') +
      casoCampo('Palavras-chave (até 6, separadas por vírgula)', '<input id="caso-novo-palavras" class="t" maxlength="200" style="width:100%" placeholder="ex.: PVT, visto de estudante, DU Aix">') +
      casoCampo('O que combinamos (uma frase por linha)', '<textarea id="caso-novo-texto" maxlength="2000" rows="5" style="width:100%"></textarea>');
  return '<div class="feeditem"><div class="fbody" style="width:100%"><b>Novo: ' + esc(tipo === 'documento' ? 'documento que a equipe manda' : tipo === 'modelo' ? 'mensagem pronta' : 'bilan de uma conversa') + '</b>' + campos +
    '<div style="display:flex;gap:6px;margin-top:8px">' + casoBtn('salvar-novo', tipo, 'Criar') + casoBtn('cancelar', 0, 'Cancelar') + '</div></div></div>';
}
// Arquivo do documento (PDF, imagem, ZIP, MD ou TXT) no bucket privado `casos-arquivos` (db/crm-caso-arquivos.sql). Caminho: <contato>/<uuid>-<nome>.
var CASO_ARQ_TIPOS = { pdf: 'application/pdf', md: 'text/markdown', markdown: 'text/markdown', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', zip: 'application/zip' }, CASO_ARQ_MAX = 10 * 1024 * 1024,
  CASO_ARQ_ACCEPT = '.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.gif,.zip,application/pdf,text/markdown,text/plain,image/png,image/jpeg,image/webp,image/gif,application/zip';
function casoArquivoCampo(it, idp) {
  var tem = it && it.arquivo_caminho;
  return casoCampo('Arquivo (PDF, imagem, ZIP, MD ou TXT, até 10 MB) — ou use o link do Notion/Drive acima', '<input id="' + (idp || 'caso-arq') + '" type="file" accept="' + CASO_ARQ_ACCEPT + '" style="width:100%">') +
    (tem ? '<label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input id="caso-arq-tirar" type="checkbox"> <span>Tirar o arquivo atual (<b>' + esc(casoNomeArquivo(it.arquivo_caminho)) + '</b>)</span></label>' : '');
}
function casoNomeArquivo(caminho) { return String(caminho || '').split('/').pop().replace(/^[0-9a-f-]{36}-/, ''); }
function casoDescricaoCampo(valor, idp) {
  return casoCampo('Descrição longa (opcional: ela lê e copia; serve para um modelo de e-mail, por exemplo)', '<textarea id="' + idp + 'descricao" maxlength="8000" rows="8" style="width:100%">' + esc(valor || '') + '</textarea>');
}
// Sobe o arquivo escolhido. Devolve { caminho } ou { erro }. Sem arquivo escolhido: {}.
async function casoSobeArquivo(contatoId, idp) {
  var inp = $(idp || 'caso-arq'); return casoSobeArquivoDe(contatoId, inp && inp.files && inp.files[0]);
}
async function casoSobeArquivoDe(contatoId, f) {
  if (!f) return {};
  var ext = (f.name.split('.').pop() || '').toLowerCase(), tipo = CASO_ARQ_TIPOS[ext];
  if (!tipo) return { erro: 'Use PDF, imagem (PNG, JPG, WebP, GIF), ZIP, MD ou TXT' };
  if (f.size > CASO_ARQ_MAX) return { erro: 'O arquivo passa de 10 MB' };
  var base = f.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'arquivo';
  var caminho = contatoId + '/' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '-' + base + '.' + ext;
  var up = await supabase.storage.from('casos-arquivos').upload(caminho, f, { contentType: tipo, upsert: false });
  return up.error ? { erro: 'Não consegui subir o arquivo (' + (up.error.message || 'erro') + '). O SQL crm-caso-arquivos.sql já rodou?' } : { caminho: caminho };
}
function casoResumoCampoNovo() { return casoCampo('O que é (uma linha, ela lê antes de abrir)', '<input id="caso-novo-resumo" class="t" maxlength="240" style="width:100%">'); }
function casoBarraNovo(k, so) {
  var b = { documento: casoBtn('novo', 'documento', '+ Documento'), modelo: casoBtn('novo', 'modelo', '+ Mensagem pronta'), bilan: casoBtn('novo', 'bilan', '+ Bilan') };
  return '<div class="ab" style="margin:0 0 8px">' + (so || ['documento', 'modelo', 'bilan']).map(function (t) { return b[t]; }).join('') + '</div>' + (k.novo && (!so || so.indexOf(k.novo) >= 0) ? casoNovoHtml(k.novo) : '');
}
function casoAvisoRepetidos(k) {
  var lista = k.itens || [];
  var rep = FX.repetidosDoBoard(lista), nrep = rep.reduce(function (n, g) { return n + g.excluir.length; }, 0);
  return nrep ? '<div class="fx-valid" role="status"><span class="fx-valid-ic" aria-hidden="true">!</span><div><b>' + nrep + (nrep === 1 ? ' repetido' : ' repetidos') + '</b><ul>' + rep.map(function (g) { return '<li>“' + esc(g.manter.titulo) + '”: ' + (g.excluir.length + 1) + ' cópias. Fica a mais completa.</li>'; }).join('') + '</ul>' +
    (k.confirmaDedup ? casoBtn('item-dedup', 0, 'Excluir ' + nrep + (nrep === 1 ? ' repetido' : ' repetidos')) + ' ' + casoBtn('cancelar', 0, 'Não') : casoBtn('item-dedup-pede', 0, 'Juntar repetidos')) + '</div></div>' : '';
}
function casoItensHtml(k, tipos, vazio, homeCat) {
  var lista = tipos ? k.itens.filter(function (it) { return tipos.indexOf(it.tipo) >= 0; }) : k.itens;
  if (!lista.length) return '<div class="empty" style="padding:14px">' + esc(vazio || 'Nenhum item. Escolas e modelos de e-mail são acrescentados pela equipe.') + '</div>';
  var temDoc = lista.some(function (x) { return x.tipo === 'documento' && (x.dados || {}).direcao === 'recebe'; });
  return lista.map(function (it) {
    if (k.ed && k.ed.t === 'item' && k.ed.id === it.id) return casoEditor('item', it.id, casoItemCampos(it));
    var est = it.estado === 'publicado' ? casoPil('Publicado', 'u-baixa') : it.estado === 'revisado' ? casoPil('Revisado', 'u-media') : casoPil('Proposto');
    var docRecebe = it.tipo === 'documento' && (it.dados || {}).direcao === 'recebe';
    var btns = (docRecebe ? casoAnexarIco(it) : temDoc ? '<i class="fx-s0"></i>' : '') + (it.estado === 'proposto' ? casoBtn('item-rev', it.id, 'Marcar como revisado') : it.estado === 'revisado' ? casoBtn('item-pub', it.id, 'Publicar para ela') : casoBtn('item-ret', it.id, 'Retirar')) + casoBtn('ed-item', it.id, 'Editar') + casoHomeBtn(k, it, homeCat) + (k.confirmaDel === it.id ? casoBtn('item-del', it.id, it.estado === 'publicado' ? 'Excluir (ela deixa de ver)' : 'Excluir') + casoBtn('cancelar', it.id, 'Não') : casoBtn('item-del-pede', it.id, 'Excluir'));
    var generico = it.tipo === 'marco' && /^prazo-chave$/i.test(it.titulo) ? ' <span class="fx-aviso">sem nome: dois cliques para dizer qual prazo é (ex.: Inscrição na licence)</span>' : '';
    var leitura = it.tipo === 'bilan' && ((it.dados || {}).secoes || []).length ? '<details style="margin-top:6px"><summary class="sub" style="cursor:pointer">Ler o bilan</summary>' + it.dados.secoes.map(function (sec) { return '<p style="margin:8px 0 2px"><b>' + esc(sec.titulo) + '</b></p><ul style="margin:0 0 0 18px">' + (sec.itens || []).map(function (x) { return '<li>' + esc(x.texto) + (x.estado === 'em_conferencia' ? ' <span class="sub">(a confirmar)</span>' : '') + '</li>'; }).join('') + '</ul>'; }).join('') + '</details>' : '';
    return casoLinha(est, '<span class="fx-tp" aria-hidden="true">' + (CASO_GLIFO[it.tipo] || '') + '</span>' + esc(it.titulo) + generico + (casoItemMeta(it) ? ' <small class="fx-meta">' + esc(casoItemMeta(it)) + '</small>' : '') + leitura, btns);
  }).join('');
}
// A fila: o que ainda não saiu, na ordem. A primeira é "a próxima mensagem".
function filaDe(avs) { return avs.filter(function (a) { return a.estado === 'agendado' && !a.liberado_em; }).sort(function (a, b) { return (a.ordem - b.ordem) || (a.id - b.id); }); }
function diasAteIso(iso) { var h = new Date(); h.setHours(0, 0, 0, 0); var d = new Date(iso); d.setHours(0, 0, 0, 0); return Math.round((d - h) / 864e5); }
function casoSaiEm(a) {
  if (!a.liberar_em) return 'sai quando ela entrar no app';
  var d = diasAteIso(a.liberar_em);
  return 'sai ' + (d <= 0 ? 'na próxima rodada (de hora em hora)' : d === 1 ? 'amanhã' : 'em ' + d + ' dias') + ' · ' + fmtDay(new Date(a.liberar_em).toISOString());
}
function casoQuando(a) {
  if (a.estado === 'rascunho') return 'sem data (pausa de ' + a.pausa_dias + (a.pausa_dias === 1 ? ' dia' : ' dias') + ')';
  if (a.estado === 'agendado' && !a.liberado_em) return casoSaiEm(a) + ' · pausa de ' + a.pausa_dias + (a.pausa_dias === 1 ? ' dia' : ' dias') + (a.ordem > 1 ? ' depois do anterior' : ' depois do 1º acesso');
  return a.liberado_em ? 'saiu em ' + fmtDay(new Date(a.liberado_em).toISOString()) : '';
}
// Botões de ritmo: valem para qualquer aviso agendado que ainda não saiu. Enviar agora só para a próxima da fila.
// Ações secundárias dentro de um menu "⋯" (fecha ao clicar fora). Os botões de texto ficam empilhados dentro dele.
function casoMenu(html) { return html ? '<details class="fx-mn"><summary class="fx-ic" aria-label="Mais ações" title="Mais ações">' + casoSvg('more', 16) + '</summary><div class="fx-mn-p">' + html + '</div></details>' : ''; }
function casoRitmoBtns(a, proxima, pre) {
  var b = '';
  if (proxima) b += casoBtn(pre + 'enviar-agora', a.id, 'Enviar agora', ' data-c="' + esc(String(a.contato_id || '')) + '"');
  b += casoBtn(pre + 'atrasar-1', a.id, 'Atrasar 1 dia', ' data-c="' + esc(String(a.contato_id || '')) + '"') + casoBtn(pre + 'atrasar-3', a.id, 'Atrasar 3 dias', ' data-c="' + esc(String(a.contato_id || '')) + '"');
  if (a.pausa_dias > 0) b += casoBtn(pre + 'adiantar-1', a.id, 'Adiantar 1 dia', ' data-c="' + esc(String(a.contato_id || '')) + '"');
  return b;
}
function casoProximaHtml(c, k) {
  var f = filaDe(k.avs), a = f[0];
  if (!a) return '';
  a = Object.assign({ contato_id: c.id }, a);
  var dc = ' data-c="' + esc(String(a.contato_id || '')) + '"';
  var resto = casoBtn('atrasar-1', a.id, 'Atrasar 1 dia', dc) + casoBtn('atrasar-3', a.id, 'Atrasar 3 dias', dc) + (a.pausa_dias > 0 ? casoBtn('adiantar-1', a.id, 'Adiantar 1 dia', dc) : '');
  return '<div class="panel fx-prox"><div class="fx-prox-t"><span class="fx-prox-k">Próxima para ' + esc(pn(c)) + '</span><b>' + esc(CASO_TIPO_AVISO[a.tipo] || a.tipo) + ':</b> ' + esc(a.titulo) +
    '<small class="fx-meta" title="Se você adiantar ou atrasar, o que vem depois acompanha e as pausas se mantêm.">' + esc(casoSaiEm(a)) + (f.length > 1 ? ' · +' + (f.length - 1) + ' na fila' : '') + '</small></div>' +
    '<div class="fx-prox-b">' + casoBtn('enviar-agora', a.id, 'Enviar agora', dc) + casoMenu(resto) + '</div></div>';
}
// Tudo depois do primeiro "?" é observação do sistema, não a pergunta que a Ingryd faz a ela.
function casoSeparaPergunta(titulo) {
  var t = String(titulo || ''), i = t.indexOf('?'), resto = i >= 0 ? t.slice(i + 1).trim() : '';
  return resto ? { p: t.slice(0, i + 1).trim(), obs: resto } : { p: t, obs: '' };
}
function casoAvisosHtml(k) {
  if (!k.avs.length) return '<div class="empty" style="padding:14px">Nenhum aviso.</div>';
  return k.avs.map(function (a) {
    var est = casoPil(CASO_ESTADO_AVISO[a.estado] || a.estado, a.estado === 'rascunho' ? 'u-media' : a.estado === 'respondido' ? 'u-baixa' : '');
    var sp = a.tipo === 'pergunta' ? casoSeparaPergunta(a.titulo) : { p: a.titulo, obs: '' };
    var meio = '<b>' + esc(CASO_TIPO_AVISO[a.tipo] || a.tipo) + ':</b> ' + (sp.obs ? esc(sp.p) + ' <span class="fx-aviso fx-sis" title="Observação do sistema, não é a pergunta. Ela ainda vê esta frase no app: ✎ para deixar só a pergunta.">sistema: ' + esc(sp.obs) + '</span>' : esc(a.titulo)) + ' <small class="fx-meta">' + esc(casoQuando(a)) + (a.estado === 'respondido' && a.resposta ? ' · resposta: ' + esc(typeof a.resposta === 'object' ? String(a.resposta.valor !== undefined ? a.resposta.valor : JSON.stringify(a.resposta)) : String(a.resposta)) : '') + '</small>';
    var editavel = a.estado === 'rascunho' || a.estado === 'agendado';
    if (k.ed && k.ed.t === 'av' && k.ed.id === a.id) {
      return casoEditor('av', a.id, casoCampo('A pergunta que ela lê no app (só a pergunta)', '<input id="caso-ed-titulo" class="t" maxlength="120" style="width:100%" value="' + esc(sp.p) + '">') +
        (sp.obs ? '<p class="sub" style="margin:6px 0 0">Ao salvar, “' + esc(sp.obs) + '” sai da pergunta dela. É observação do sistema.</p>' : ''));
    }
    if (k.agenda === a.id) {
      var form = '<div class="feeditem"><div class="fbody"><p style="margin:0 0 6px"><b>Quando ela recebe: ' + esc(a.titulo) + '</b></p>' +
        '<label class="sub">Pausa depois ' + (a.ordem > 1 ? 'do aviso anterior' : 'do primeiro acesso dela') + ' (dias) <select id="caso-ag-dias">' + [0, 1, 2, 3, 5, 7, 14].map(function (n) { return '<option value="' + n + '"' + (n === a.pausa_dias ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label> ' +
        casoBtn('ag-dias', a.id, 'Agendar com esta pausa') + '<br><label class="sub" style="display:inline-block;margin-top:6px">ou numa data fixa (9h de Paris) <input type="date" id="caso-ag-data"></label> ' + casoBtn('ag-data', a.id, 'Agendar nesta data') +
        ' ' + casoBtn('cancelar', a.id, 'Fechar') + '</div></div>';
      return casoLinha(est, meio, '') + form;
    }
    var btns = (editavel && a.tipo === 'pergunta' ? casoBtn('ed-av', a.id, 'Editar a pergunta') : '') + (editavel ? casoBtn('ag-abrir', a.id, a.estado === 'rascunho' ? 'Aprovar e agendar' : 'Mudar a pausa') : '');
    if (a.estado === 'agendado' && !a.liberado_em) btns += casoMenu(casoRitmoBtns(Object.assign({ contato_id: k.cid }, a), filaDe(k.avs)[0] === a, ''));
    if (a.estado === 'rascunho' || a.estado === 'agendado') btns += casoBtn('av-cancel', a.id, 'Cancelar');
    return casoLinha(est, meio, btns);
  }).join('');
}
// As escolas que a própria pessoa acrescentou no Espaço (nome, link e o que ela já sabe). Só leitura: você vê o que ela anda olhando.
// As perguntas Sim/Não que ela já respondeu sobre uma escola (a lista muda por persona; aqui só a contagem e o que foi respondido).
var CASO_SELOS = [['traducao', 'tradução juramentada'], ['haia', 'apostila de Haia'], ['equivaler', 'equivalência (não vale para Campus France)'], ['original', 'original']];
function casoCriteriosResumo(c) {
  var sim = [], nao = [], k;
  for (k in (c || {})) { if (c[k] === 'sim') sim.push(k); else if (c[k] === 'nao') nao.push(k); }
  if (!sim.length && !nao.length) return '';
  return '<br><span class="sub">Respondeu ' + sim.length + ' sim' + (nao.length ? ' · ' + nao.length + ' não' : '') + ' (' + esc(sim.concat(nao).join(', ')) + ')</span>';
}
function casoEscolasDelaHtml(k) {
  var l = k.escolasDela || [];
  if (!l.length) return '';
  return casoSecao('Escolas que ela acrescentou', l.length + (l.length === 1 ? ' escola' : ' escolas'), l.map(function (e) {
    var link = /^https:\/\//.test(e.link || '') ? ' <a href="' + esc(e.link) + '" target="_blank" rel="noopener noreferrer">site</a>' : '';
    return '<div class="feeditem"><div class="fbody"><p><b>' + esc(e.nome) + '</b>' + link + (e.nota ? '<br><span class="sub">' + esc(e.nota) + '</span>' : '') + casoCriteriosResumo(e.criterios) + '</p><time>' + esc(fmtDay(String(e.criado_em || '').slice(0, 10))) + '</time></div></div>';
  }).join(''));
}
function casoPanelHtml(c, k) {
  if (!k || k.cid !== c.id) return '<div class="panel" style="padding:16px"><p class="sub" style="margin:0">Carregando o caso…</p></div>';
  if (k.err) return '<div class="panel" style="padding:16px"><h3 style="font-size:15px;margin-bottom:8px">Caso ainda não ligado</h3><p class="sub" style="margin:0">Falta rodar <b>db/crm-caso.sql</b> e <b>db/crm-caso-importar.sql</b> no SQL Editor do Supabase. Depois, ler a página do Notion no Onboarding preenche esta aba.</p></div>';
  var vazio = !k.ach.length && !k.aco.length && !k.itens.length && !k.avs.length;
  var cab = '<div class="panel" style="padding:16px"><h3 style="font-size:15px;margin:0 0 4px">O caso de ' + esc(pn(c)) + '</h3><p class="sub" style="margin:0">Tudo veio da leitura da página do Notion como <b>rascunho</b>. Ela só vê o que você revisar e publicar' +
    (k.consent ? '.' : ', e <b>só depois do consentimento de serviço</b>, que ainda não está registrado: publicar e agendar ficam bloqueados.') + ' O que você já decidiu não é refeito se a página for lida de novo.</p></div>';
  if (vazio) return cab + '<div class="panel empty" style="margin-top:14px">Ainda sem caso. Cole o link da página no menu Onboarding e use “Ler do Notion”, ou acrescente à mão o que ela vai ver:</div>' + casoSecao('Board dela', 'o que aparece no Espaço', casoBarraNovo(k));
  var pend = casoPendentes(k);
  return cab + casoProximaHtml(c, k) + (pend ? '<p class="sub" style="margin:10px 2px 0"><b>' + pend + '</b> ' + (pend === 1 ? 'coisa espera' : 'coisas esperam') + ' a sua revisão.</p>' : '') +
    casoSecao('O que entendi', k.ach.length + ' achados', casoAchadosHtml(k)) +
    casoSecao('Ações', k.aco.length + ' linhas', casoAcoesHtml(k)) +
    casoSecao('Board dela', 'o que aparece no Espaço', casoBarraNovo(k) + casoItensHtml(k)) +
    casoEscolasDelaHtml(k) +
    casoSecao('Avisos da Equipe Por Dentro', 'você decide a data de cada um', casoAvisosHtml(k));
}
function pintaCaso() { var b = $('caso-box'); if (b) b.innerHTML = casoPanelHtml(byC(state.sel) || {}, state.caso); var ab = $('plat-abas'); if (ab) ab.innerHTML = platAbasHtml(); if (fichaV2Ativa() && state.fx && state.fx.tab === 'plataforma' && state.fx.dados) fxPintaCorpo(); if (fichaV2Ativa() && state.fx && state.fx.dados) { fxAtualizaAcoes(); fxPintaPrevia(); } }
async function carregaCaso(cid) {
  if (state.casoCarregando === cid) return;
  state.casoCarregando = cid;
  try { var k = await buscaCaso(cid); if (state.sel === cid) { state.caso = k; pintaCaso(); } } finally { state.casoCarregando = null; }
}
async function casoRecarrega() { var cid = state.sel, ed = state.caso && state.caso.ed, ag = state.caso && state.caso.agenda; var k = await buscaCaso(cid); if (state.sel !== cid) return; k.ed = ed; k.agenda = ag; state.caso = k; pintaCaso(); }
function casoFalha(o, e) { var m = String((e && (e.message || e.hint)) || ''); for (var k in CASO_ERROS) if (m.indexOf(k) >= 0) return toast(CASO_ERROS[k], 4200); fail(o, e); }
var CASO_TABELA = { ach: 'caso_achados', aco: 'caso_acoes', item: 'board_itens' };
// Um clique de botão da aba. O banco confere (consentimento, revisão antes de publicar); aqui só se mostra o motivo.
// Enviar agora, atrasar ou adiantar um aviso da fila. Vale na Hoje e na aba Caso. O banco recalcula as datas de tudo que vem depois.
var FILA_MSG = { aprove_antes: 'Aprove o aviso antes.', aviso_ja_saiu: 'Esse aviso já saiu.', nao_e_a_proxima: 'Só a próxima da fila pode sair agora.', sem_consentimento: CASO_ERROS.sem_consentimento };
async function filaAcao(acao, id, t, cid) {
  if (t) t.disabled = true;
  var m = /^(atrasar|adiantar)-(\d+)$/.exec(acao), r;
  if (acao === 'enviar-agora') r = await supabase.rpc('crm_aviso_enviar_agora', { p_id: id });
  else if (m) r = await supabase.rpc('crm_aviso_deslocar', { p_id: id, p_dias: (m[1] === 'atrasar' ? 1 : -1) * Number(m[2]) });
  else return;
  if (r.error) { if (t) t.disabled = false; var msg = String(r.error.message || ''); for (var k in FILA_MSG) if (msg.indexOf(k) >= 0) return toast(FILA_MSG[k], 4200); return fail('mexer na fila', r.error); }
  var f = await supabase.from('caso_avisos').select('id,contato_id,titulo,tipo,ordem,pausa_dias,liberar_em,modo').eq('estado', 'agendado').is('liberado_em', null).order('ordem', { ascending: true }).limit(500);
  if (!f.error) FILA = f.data || [];
  if (state.view === 'hoje') renderFilaHoje();
  if (cid && state.sel === cid && state.caso) await casoRecarrega();
  toast(acao === 'enviar-agora' ? 'Enviada. O resto da fila andou junto.' : acao.indexOf('atrasar') === 0 ? 'Atrasado. O que vem depois acompanha.' : 'Adiantado. O que vem depois acompanha.', 3200);
}
// O bloco da Hoje: a próxima mensagem de cada pessoa, a que sai mais cedo primeiro.
function renderFilaHoje() {
  var box = $('today-fila-box'); if (!box) return;
  var lista = filaProximas().slice(0, 8);
  box.hidden = !lista.length; if ($('today-fila-vazio')) $('today-fila-vazio').hidden = !!lista.length;
  $('today-fila').innerHTML = lista.map(function (a) {
    var c = byC(a.contato_id);
    return '<div class="fila-item"><button class="fila-quem" data-caso-ficha="' + esc(c.id) + '" type="button">' +
      '<b>' + esc(short(c)) + '</b><span>' + esc(a.titulo) + ' · ' + esc(casoSaiEm(a)) + '</span></button><div class="fila-acoes">' + casoRitmoBtns(a, true, 'h-') + '</div></div>';
  }).join('');
}
// Página inicial: pôr um item nos destaques do Início dela ("categoria:ref") ou tirar. Limites 3 (checklist) / 3 (só seu) / 2 (guias); o banco confere de novo.
async function casoHome(acao, id, t) {
  var k = state.caso, p = String(id).split(':'), cat = p[0], ref = p.slice(1).join(':');
  if (!k || !Array.isArray(k.home)) return toast('A Página inicial ainda não está ligada: falta rodar db/crm-caso-home.sql no Supabase.', 4600);
  var ja = FX.homeTem(k.home, cat, ref), r;
  if (acao === 'home-del') { if (!ja) return; if (t) t.disabled = true; r = await supabase.from('caso_home').delete().eq('id', ja.id); }
  else {
    if (ja) return toast('Esse item já está na home.');
    var pode = FX.podeAdicionarHome(k.home, cat);
    if (!pode.ok) return toast('A home já tem ' + pode.n + ' de ' + pode.max + ' em ' + FX.HOME_ROTULOS[cat] + '. Tire um na Página inicial para trocar.', 5200);
    var linha = { contato_id: state.sel, categoria: cat, ordem: pode.n }; if (cat === 'checklist') linha.step_key = ref; else linha.board_id = Number(ref);
    if (t) t.disabled = true; r = await supabase.from('caso_home').insert(linha);
  }
  if (r.error) { if (t) t.disabled = false; return casoFalha('mexer na home', r.error); }
  await casoRecarrega();
  toast(acao === 'home-add' ? 'Na home: ' + FX.HOME_ROTULOS[cat] + '. Ela vê no Início.' : 'Tirado da home.');
}
// O botão "Adicionar na home" de um item do board: bilan e encaminhamento (documento que ela recebe) → Só seu; documento e mensagem pronta → Guias.
// `cat` diz de qual lista o botão é; sem ele, vale a primeira categoria em que o item cabe. Prazo e escola não vão para a página inicial.
function casoHomeBtn(k, it, cat) {
  if (!k) return '';
  cat = cat || ['so_seu', 'guias'].filter(function (c) { return FX.itemPodeNaHome(it, c); })[0];
  if (!cat || !FX.itemPodeNaHome(it, cat)) return '';
  var tem = Array.isArray(k.home) && FX.homeTem(k.home, cat, it.id);
  return casoIco(tem ? 'home-del' : 'home-add', cat + ':' + it.id, tem ? '×' : '+', tem ? 'Tirar da página inicial' : 'Adicionar na página inicial', tem);
}
async function casoAcao(acao, id, t) {
  if (acao === 'ed-chk') { fxFechaQuadro(); state.fx.ckEd = String(id); fxRepintaChkDe(); fxGuiaCarrega(String(id)); return; }
  var k = state.caso; if (!k) return;
  var agora = new Date().toISOString(), nid = Number(id), r = null;
  if (acao === 'cancelar') { k.ed = null; k.agenda = null; k.novo = null; k.confirmaDel = null; k.confirmaDedup = false; return pintaCaso(); }
  if (acao.indexOf('ed-') === 0) { k.ed = { t: acao.slice(3), id: nid }; k.agenda = null; pintaCaso(); var f = $('caso-ed-texto') || $('caso-ed-titulo'); if (f && f.focus) f.focus(); return; }
  if (acao === 'ag-abrir') { k.agenda = nid; k.ed = null; return pintaCaso(); }
  if (acao === 'novo') { k.novo = id; k.ed = null; pintaCaso(); var fn = $('caso-novo-titulo'); if (fn && fn.focus) fn.focus(); return; }
  if (acao === 'item-del-pede') { k.confirmaDel = nid; return pintaCaso(); }
  if (acao === 'item-dedup-pede') { k.confirmaDedup = true; return pintaCaso(); }
  if (acao === 'item-dedup') {
    k.confirmaDedup = false; var excl = [], arqs = [];
    FX.repetidosDoBoard(k.itens).forEach(function (g) { g.excluir.forEach(function (x) { excl.push(x.id); if (x.arquivo_caminho && x.arquivo_caminho !== g.manter.arquivo_caminho) arqs.push(x.arquivo_caminho); }); });
    if (!excl.length) return pintaCaso();
    r = await supabase.from('board_itens').delete().in('id', excl);
    if (!r.error && arqs.length) { try { await supabase.storage.from('casos-arquivos').remove(arqs); } catch (e) { /* sobra de arquivo não quebra nada */ } }
    if (r.error) return casoFalha('juntar os repetidos', r.error);
    await casoRecarrega(); return toast(excl.length + (excl.length === 1 ? ' repetido excluído.' : ' repetidos excluídos.'));
  }
  if (/^(enviar-agora|atrasar-\d+|adiantar-\d+)$/.test(acao)) return filaAcao(acao, nid, t, state.sel);
  if (acao === 'home-add' || acao === 'home-del') return casoHome(acao, id, t);
  if (t) t.disabled = true;
  if (acao === 'ach-ok') r = await supabase.from('caso_achados').update({ estado: 'ok', conferido_em: agora }).eq('id', nid);
  else if (acao === 'ach-voltar') r = await supabase.from('caso_achados').update({ estado: 'conferir', conferido_em: null }).eq('id', nid);
  else if (acao === 'ach-desc') r = await supabase.from('caso_achados').update({ estado: 'descartado' }).eq('id', nid);
  else if (acao === 'salvar-ach') { var tx = $('caso-ed-texto') ? $('caso-ed-texto').value.trim() : ''; if (!tx) { if (t) t.disabled = false; return toast('O texto não pode ficar vazio'); } r = await supabase.from('caso_achados').update({ texto: tx.slice(0, 400), origem: 'ingryd' }).eq('id', nid); k.ed = null; }
  else if (acao === 'aco-fim') r = await supabase.from('caso_acoes').update({ estado: 'concluida', concluida_em: agora, concluida_por: 'equipe' }).eq('id', nid);
  else if (acao === 'aco-reabrir') r = await supabase.from('caso_acoes').update({ estado: 'aberta', concluida_em: null, concluida_por: null }).eq('id', nid);
  else if (acao === 'aco-pub') r = await supabase.from('caso_acoes').update({ publicada_em: agora }).eq('id', nid);
  else if (acao === 'aco-retirar') r = await supabase.from('caso_acoes').update({ publicada_em: null }).eq('id', nid);
  else if (acao === 'aco-recusar') r = await supabase.from('caso_acoes').update({ estado: 'recusada', publicada_em: null }).eq('id', nid);   // db/crm-passos-revisao.sql
  else if (acao === 'salvar-av') {
    var tav = $('caso-ed-titulo') ? $('caso-ed-titulo').value.trim() : ''; if (!tav) { if (t) t.disabled = false; return toast('A pergunta não pode ficar vazia'); }
    r = await supabase.from('caso_avisos').update({ titulo: tav.slice(0, 120) }).eq('id', nid); k.ed = null;
  }
  else if (acao === 'salvar-aco') { var ti = $('caso-ed-titulo') ? $('caso-ed-titulo').value.trim() : ''; if (!ti) { if (t) t.disabled = false; return toast('O título não pode ficar vazio'); } var upd = { titulo: ti.slice(0, 160) }, sbx = $('caso-ed-subitens');
    if (sbx) { var lin = String(sbx.value || '').split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean); if (lin.length > 6) { if (t) t.disabled = false; return toast('No máximo 6 subitens'); } upd.subitens = lin.length ? lin : null; upd.editado_em = agora; }
    r = await supabase.from('caso_acoes').update(upd).eq('id', nid);
    if (r.error && /editado_em/.test(String(r.error.message || ''))) { delete upd.editado_em; r = await supabase.from('caso_acoes').update(upd).eq('id', nid); }   // sem a coluna nova (SQL ainda não rodado)
    k.ed = null; }
  else if (acao === 'item-aprova') {   // Curadoria: aprovar = revisar e publicar, num clique só (o banco confere consentimento)
    var itA = (k.itens || []).filter(function (x) { return x.id === nid; })[0];
    r = itA && itA.estado === 'proposto' ? await supabase.from('board_itens').update({ estado: 'revisado' }).eq('id', nid) : { error: null };
    if (!r.error) r = await supabase.rpc('crm_board_publicar', { p_id: nid });
  }
  else if (acao === 'item-rev') r = await supabase.from('board_itens').update({ estado: 'revisado' }).eq('id', nid);
  else if (acao === 'item-pub') r = await supabase.rpc('crm_board_publicar', { p_id: nid });
  else if (acao === 'item-ret') r = await supabase.rpc('crm_board_retirar', { p_id: nid });
  else if (acao === 'item-del') {
    var apagar = k.itens.filter(function (x) { return x.id === nid; })[0];
    r = await supabase.from('board_itens').delete().eq('id', nid); k.confirmaDel = null;
    if (!r.error && apagar && apagar.arquivo_caminho) { try { await supabase.storage.from('casos-arquivos').remove([apagar.arquivo_caminho]); } catch (e) { /* sobra de arquivo não quebra nada */ } }
  }
  else if (acao === 'salvar-novo') {
    var vn = function (id) { return $(id) ? $(id).value.trim() : ''; };
    var fl = function (m) { if (t) t.disabled = false; return toast(m); };
    var tnovo = id, tn = vn('caso-novo-titulo'), dn = {}, linha = { contato_id: state.sel, tipo: tnovo, titulo: tn.slice(0, 120), estado: 'proposto' };
    if (!tn) return fl('Dê um nome');
    if (tnovo === 'documento') {
      var lk = vn('caso-novo-link'); if (lk && !/^https:\/\//.test(lk)) return fl('O link precisa começar com https://');
      dn = { direcao: 'recebe', rotulo: tn.slice(0, 120) }; linha.link = lk || null; linha.resumo = vn('caso-novo-resumo').slice(0, 240) || null; linha.ordem = 20;
      var dsc = vn('caso-novo-descricao'); if (dsc) linha.descricao = dsc.slice(0, 8000);
      var sb = await casoSobeArquivo(state.sel, 'caso-novo-arq'); if (sb.erro) return fl(sb.erro);
      if (sb.caminho) { linha.arquivo_caminho = sb.caminho; linha.arquivo_anexado_em = new Date().toISOString(); }
    } else if (tnovo === 'modelo') {
      var cp = vn('caso-novo-corpo'); if (!cp) return fl('Escreva o texto da mensagem');
      dn = { corpo: cp.slice(0, 3000) }; if (vn('caso-novo-assunto')) dn.assunto = vn('caso-novo-assunto').slice(0, 150); if (vn('caso-novo-traducao')) dn.traducao = vn('caso-novo-traducao').slice(0, 3000);
      linha.resumo = vn('caso-novo-resumo').slice(0, 240) || null; linha.ordem = 30;
    } else {
      var di = vn('caso-novo-data'); if (di && !/^\d{4}-\d{2}-\d{2}$/.test(di)) return fl('Escolha um dia válido');
      var pal = casoPalavras(vn('caso-novo-palavras')); if (pal === null) return fl('Use até 6 palavras-chave, de até 30 letras cada');
      dn = { secoes: [] }; if (di) dn.data = di; if (pal.length) dn.palavras = pal;
      var linhas = vn('caso-novo-texto').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
      if (linhas.length) dn.secoes.push({ titulo: 'O que combinamos', itens: linhas.map(function (x) { return { texto: x.slice(0, 220), estado: 'confirmado' }; }) });
      linha.ordem = 1;
    }
    linha.dados = dn;
    r = await supabase.from('board_itens').insert(linha); k.novo = null;
  }
  else if (acao === 'salvar-item') {
    var itm = k.itens.filter(function (x) { return x.id === nid; })[0];
    var val = function (id) { return $(id) ? $(id).value.trim() : ''; };
    var tt = val('caso-ed-titulo'), ln = val('caso-ed-link');
    var falha = function (m) { if (t) t.disabled = false; return toast(m); };
    if (!itm) return falha('O item não existe mais. Atualize a aba.');
    if (!tt) return falha('O título não pode ficar vazio');
    if (ln && !/^https:\/\//.test(ln)) return falha('O link precisa começar com https://');
    var dados = Object.assign({}, itm.dados || {});
    if (itm.tipo === 'marco') {
      var dt = val('caso-ed-data');
      if (dt && !/^\d{4}-\d{2}-\d{2}$/.test(dt)) return falha('Escolha uma data válida');
      if (dt) dados.data = dt; else delete dados.data;
      dados.a_confirmar = !!($('caso-ed-conf') && $('caso-ed-conf').checked);
      var nota = val('caso-ed-nota'); if (nota) dados.nota = nota.slice(0, 200); else delete dados.nota;
    } else if (itm.tipo === 'escola') {
      ['cidade', 'curso'].forEach(function (c) { var v = val('caso-ed-' + c); if (v) dados[c] = v.slice(0, 120); else delete dados[c]; });
      var cu = val('caso-ed-custo'); if (cu !== '' && (isNaN(Number(cu)) || Number(cu) < 0 || Number(cu) > 100000)) return falha('O custo precisa ser um número entre 0 e 100000');
      if (cu !== '') dados.custo_eur = Number(cu); else delete dados.custo_eur;
    }
    if (itm.tipo === 'documento') dados.rotulo = tt.slice(0, 120)
    if (itm.tipo === 'documento' && dados.direcao !== 'recebe') {
      var selosMarcados = Array.prototype.map.call(document.querySelectorAll('.caso-ed-selo'), function (x) { return x.checked ? x.value : null; }).filter(Boolean);
      if (selosMarcados.length) dados.selos = selosMarcados; else delete dados.selos;
    }
    if (itm.tipo === 'modelo') {
      ['assunto', 'corpo', 'traducao'].forEach(function (c) { var v = val('caso-ed-' + c); if (v) dados[c] = v; else delete dados[c]; });
      if (!dados.corpo) return falha('Escreva o texto da mensagem');
    }
    if (itm.tipo === 'bilan') {
      var dib = val('caso-ed-data'); if (dib && !/^\d{4}-\d{2}-\d{2}$/.test(dib)) return falha('Escolha um dia válido');
      if (dib) dados.data = dib; else delete dados.data;
      var palb = casoPalavras(val('caso-ed-palavras')); if (palb === null) return falha('Use até 6 palavras-chave, de até 30 letras cada');
      if (palb.length) dados.palavras = palb; else delete dados.palavras;
      if ($('caso-ed-secoes')) dados.secoes = casoTextoSecoes($('caso-ed-secoes').value);
    }
    var mud = { titulo: tt.slice(0, 120), dados: dados, link: ln || null }, arqAntigo = null;
    if ($('caso-ed-resumo')) mud.resumo = val('caso-ed-resumo').slice(0, 240) || null;
    if ($('caso-ed-descricao')) mud.descricao = val('caso-ed-descricao').slice(0, 8000) || null;
    if (itm.tipo === 'documento' && $('caso-arq')) {
      var sbe = await casoSobeArquivo(itm.contato_id || state.sel); if (sbe.erro) return falha(sbe.erro);
      if (sbe.caminho) { arqAntigo = itm.arquivo_caminho || null; mud.arquivo_caminho = sbe.caminho; mud.arquivo_anexado_em = new Date().toISOString(); }
      else if ($('caso-arq-tirar') && $('caso-arq-tirar').checked) { arqAntigo = itm.arquivo_caminho; mud.arquivo_caminho = null; mud.arquivo_anexado_em = null; }
    }
    if (itm.estado === 'proposto') mud.estado = 'revisado';   // você mexeu: é seu. Ler o Notion de novo não desfaz.
    r = await supabase.from('board_itens').update(mud).eq('id', nid); k.ed = null;
    if (!r.error && arqAntigo) { try { await supabase.storage.from('casos-arquivos').remove([arqAntigo]); } catch (e) { /* sobra de arquivo não quebra nada */ } }
    if (!r.error) { await casoRecarrega(); toast(itm.estado === 'publicado' ? 'Salvo. Ela já vê a correção.' : 'Salvo.'); return; }
  }
  else if (acao === 'ag-dias') { var dd = $('caso-ag-dias'); r = await supabase.rpc('crm_aviso_agendar', { p_id: nid, p_quando: null, p_dias_apos: Number(dd ? dd.value : 1) }); k.agenda = null; }
  else if (acao === 'ag-data') {
    var dv = $('caso-ag-data') ? $('caso-ag-data').value : ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(dv)) { if (t) t.disabled = false; return toast('Escolha a data'); }
    r = await supabase.rpc('crm_aviso_agendar', { p_id: nid, p_quando: dv + 'T09:00:00+01:00', p_dias_apos: null }); k.agenda = null;
  }
  else if (acao === 'av-cancel') r = await supabase.from('caso_avisos').update({ estado: 'cancelado' }).eq('id', nid);
  else { if (t) t.disabled = false; return; }
  if (r && r.error) { if (t) t.disabled = false; return casoFalha('salvar', r.error); }
  await casoRecarrega();
  toast(acao === 'item-del' ? 'Excluído.' : acao === 'aco-recusar' ? 'Recusado: o passo sai da fila.' : acao === 'item-pub' || acao === 'item-aprova' || acao === 'aco-pub' ? 'Publicado: ela já pode ver' : acao === 'ag-dias' || acao === 'ag-data' ? 'Aviso agendado' : 'Salvo');
}
function platAbasHtml() {
  var nova = chatNaoLidas(state.chat);
  return '<div class="ptabs" role="tablist" aria-label="Plataforma" style="margin:0 0 14px">' + PLAT_ABAS.map(function (t) {
    return '<button class="ptab" role="tab" type="button" data-pstab="' + t[0] + '" aria-selected="' + (state.pstab === t[0]) + '">' + t[1] +
      (t[0] === 'chat' && nova ? ' <span class="count">' + nova + '</span>' : '') + (t[0] === 'checklist' ? chkSeloAtraso() : '') + (t[0] === 'caso' && casoPendentes(state.caso) ? ' <span class="count">' + casoPendentes(state.caso) + '</span>' : '') + '</button>';
  }).join('') + '</div>';
}
// O selo "N atrasados" da subaba Checklist (vazio sem conta, sem checklist ou sem atraso).
function chkSeloAtraso() {
  var chk = state.dos && state.dos.chk; if (!chk || chk.err || chk.semConta) return '';
  var n = chkCalc(chk, Date.now()).atrasados.length;
  return n ? ' <span class="count">' + n + ' atrasado' + (n > 1 ? 's' : '') + '</span>' : '';
}
function platConteudoHtml(c, h4) {
  if (state.pstab === 'checklist') return '<div id="chk-aba">' + checklistPanel(c) + '</div>';
  if (state.pstab === 'chat') return '<div id="chat-box">' + chatPanelHtml(c, state.chat, h4) + '</div>';
  if (state.pstab === 'caso') { if (!state.caso || state.caso.cid !== c.id) setTimeout(function () { carregaCaso(c.id); }, 0); return '<div id="caso-box">' + casoPanelHtml(c, state.caso) + '</div>'; }
  if (state.pstab === 'interacoes') return '<div id="int-box">' + bilanResumoHtml(c) + interacoesHtml(state.int) + '</div>';
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
    return '<div style="margin-top:18px">' + pagamentoHtml(c, h4) + '</div><div style="margin-top:18px">' + bilanBlocoHtml(c, h4) + '</div><div class="panel" style="padding:16px;margin-top:18px"><h3 style="font-size:15px;margin-bottom:8px">Plataforma ainda não ligada</h3>' +
      '<p class="sub" style="margin:0">Falta rodar <b>db/crm-plataforma.sql</b> no SQL Editor do Supabase (depois dele, os cliques novos começam a aparecer aqui).</p></div>';
  }
  return '<div class="pessoa-grid" style="margin-top:18px">' +
    '<div style="min-width:0"><div id="plat-abas">' + platAbasHtml() + '</div><div id="plat-conteudo">' + platConteudoHtml(c, h4) + '</div></div>' +
    '<div class="plat-fixa">' + pagamentoHtml(c, h4) + bilanBlocoHtml(c, h4) +
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
  // As perguntas das páginas de entrada (os quizzes dos guias): sempre à mão, para você somar o que ela respondeu em cada uma. Se o quiz
  // já foi respondido, a etapa vem preenchida (ver dosDoFunil). Fica fora da conta do "faltam": nem toda pessoa passou por todas as páginas.
  { t: 'Respostas das páginas de entrada', livre: 1, campos: (TX.PAGINAS || []).map(function (p) {
    return { k: 'etapa_' + p.k.toLowerCase(), l: p.k + ' · ' + p.nome + ': em que etapa está', t: 'op', o: p.etapas, ajuda: 'A pergunta do quiz desta página. Se ela já respondeu, vem preenchida.' };
  }) },
  { t: 'Sinais da call', livre: 1, campos: [
    { k: 'formacao_alvo', l: 'Formação que quer', t: 'op', o: [['l1_universidade', '1º ano de licence (universidade)'], ['bts', 'BTS'], ['escola_arte', 'Escola de arte'], ['administracao', 'Administração'], ['du', 'DU (diplôme d\'université)'], ['nao_sei', 'Ainda não sabe']] },
    { k: 'grupo_area', l: 'Grande área', t: 'op', o: [['artes_audiovisual', 'Artes e audiovisual'], ['negocios', 'Negócios'], ['saude', 'Saúde'], ['frances_b2', 'Francês (chegar ao B2)'], ['outra', 'Outra']] },
    { k: 'area_interesse', l: 'Área em poucas palavras', t: 'tx', ajuda: 'Só aparece para você (ex.: cinema).' },
    { k: 'ensino_medio_ano', l: 'Ano em que terminou o ensino médio', t: 'tx', ajuda: 'Quatro dígitos (ex.: 2018). Diploma antigo pede tradução juramentada e conferência.' },
    { k: 'tem_graduacao', l: 'Tem graduação concluída', t: 'sn' },
    { k: 'frances_gargalo', l: 'Onde o francês trava', t: 'op', o: [['oral', 'Fala'], ['escrita', 'Escrita'], ['ambos', 'Fala e escrita'], ['nenhum', 'Em nenhum']] },
    { k: 'tem_aula_frances', l: 'Faz aula de francês agora', t: 'sn' },
    { k: 'plano_b', l: 'Quer um plano B', t: 'sn' }
  ] },
  { t: 'A ligação', livre: 1, campos: [
    { k: 'ligacao_data', l: 'Data da ligação', t: 'dt' },
    { k: 'ligacao_resumo', l: 'Resumo', t: 'lg', ajuda: 'O que ficou combinado, em poucas linhas.' },
    { k: 'proximos_passos', l: 'Próximos passos', t: 'lg' },
    { k: 'ligacao_transcricao', l: 'Gravação transcrita', t: 'lg', alto: 1, ajuda: 'Cole aqui o texto da ligação gravada.' }
  ] }
];
var DOS_NUM = { cfEtapa: 1, ensino_medio_ano: 1 }, DOS_MES = { contrato_fim: 1 };
// O funil público (freebie, checklist-preview, bot) grava o que ela respondeu em contatos.respostas, com outros nomes. Cada
// resposta cai na pergunta equivalente do dossiê, no formato do formulário. Só vale enquanto o dossiê não tem resposta própria:
// o que você digita ou a IA lê do documento sempre ganha. Pergunta nova do funil = uma linha aqui.
var FN_SN = function (v) { return v === 'sim' ? 'true' : v === 'nao' ? 'false' : null; };
var DOS_FUNIL = {
  ano_au_pair: ['apAno'], intencao_au_pair: ['apPretende', function (v) { return v === 'migrar' ? 'migrar_estudante' : v; }],
  contrato_fim: ['apDataFinal'], tem_certificado_matricula: ['apCertificado', FN_SN], comprova_recursos: ['apRecursos', FN_SN], tem_sponsor: ['apSponsor', FN_SN],
  cfNivel: ['cfNivel'], cfTeste: ['cfTeste'], cidade: ['cfCidade', function (v) { return CF_CIDADE[v] || v; }]
};
// A etapa que ela marcou no quiz de uma página: o quiz mais recente daquela página (eventos da jornada) ou, na falta, a última resposta do cadastro.
function etapaDaPaginaDoFunil(c, k) {
  var f = dosCampo(k); if (!f || !f.o) return null;
  var vale = function (v) { return typeof v === 'string' && f.o.some(function (o) { return o[0] === v; }); };
  var qs = state.jorQuiz && state.jorQuiz.cid === c.id ? state.jorQuiz.quizzes : [];
  for (var i = qs.length - 1; i >= 0; i--) if (vale(qs[i].objetivo)) return qs[i].objetivo;
  var r = c && c.respostas;
  return r && typeof r === 'object' && vale(r.objetivo) ? r.objetivo : null;
}
function dosDoFunil(c, k) {
  if (/^etapa_i0[1-5]$/.test(k)) return etapaDaPaginaDoFunil(c, k);
  var m = DOS_FUNIL[k], r = c && c.respostas; if (!m || !r || typeof r !== 'object') return null;
  var v = r[m[0]]; if (v === null || v === undefined || v === '') return null;
  v = m[1] ? m[1](v) : v; if (v === null || v === undefined || v === '') return null;
  var f = dosCampo(k); if (f && f.o && !f.o.some(function (o) { return o[0] === String(v); })) return null;   // valor que o formulário não conhece: ignora
  return String(v);
}
// A resposta que está na tela veio do funil (e não do dossiê nem do que você digitou)?
function dosVeioDoFunil(c, d, rasc, k) {
  var f = dosCampo(k); if (!f || f.col || (rasc && Object.prototype.hasOwnProperty.call(rasc, k))) return false;
  var s = (d || {})[k]; return (s === null || s === undefined || s === '') && dosDoFunil(c, k) !== null;
}
// O valor de um campo como texto de formulário: o que você já digitou e ainda não salvou, ou o que está salvo.
function dosValor(c, d, rasc, k) {
  var f = dosCampo(k), v;
  if (rasc && Object.prototype.hasOwnProperty.call(rasc, k)) v = rasc[k];
  else {
    v = f && f.col ? c[k] : (d || {})[k];
    if (v === null || v === undefined || v === '') v = dosDoFunil(c, k);   // ainda sem resposta no dossiê: vale o que ela respondeu no funil
  }
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
// De onde veio a resposta que está na tela: o que você digitou agora, o que a IA leu da call, o que ela respondeu nas páginas de entrada ou no funil, ou o que já estava salvo.
function dosFonteDe(f, c, d, rasc, v) {
  if (v === '') return '';
  if (rasc && Object.prototype.hasOwnProperty.call(rasc, f.k)) return 'voce';
  if (onbOrigemDe(f.k, v)) return 'call';
  if (dosVeioDoFunil(c, d, rasc, f.k)) return /^etapa_i0[1-5]$/.test(f.k) ? 'entrada' : 'funil';
  return 'voce';
}
var DOS_FONTES = { funil: 'Funil', entrada: 'Páginas de entrada', call: 'Call', voce: 'Você' };
function dosCampoHtml(f, c, d, rasc, modo) {
  var v = dosValor(c, d, rasc, f.k), id = 'dk-' + f.k, a = ' id="' + id + '" data-dk="' + esc(f.k) + '" data-cid="' + esc(c.id) + '"', ctl;
  var opcoes = f.t === 'sn' ? SN : f.o;
  if (modo === 'fixo' && (f.t === 'op' || f.t === 'sn') && opcoes.length <= 6) {   // poucas opções: um toque, em vez de abrir a lista
    ctl = '<div class="dk-seg" role="group" aria-label="' + esc(f.l) + '">' + opcoes.map(function (o) { return '<button type="button" data-fx="dosChip" data-k="' + esc(f.k) + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (o[0] === v) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  } else if (f.t === 'op' || f.t === 'sn') {
    ctl = '<select' + a + '><option value="">— sem resposta</option>' + (f.t === 'sn' ? SN : f.o).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  } else if (f.t === 'lg') {
    ctl = '<textarea' + a + ' style="min-height:' + (f.alto ? 190 : 84) + 'px">' + esc(v) + '</textarea>';
  } else {
    ctl = '<input' + a + ' type="' + (f.t === 'dt' ? 'date' : f.t === 'mes' ? 'month' : 'text') + '" value="' + esc(v) + '" maxlength="300">';
  }
  var og = onbOrigemDe(f.k, v), fn = dosVeioDoFunil(c, d, rasc, f.k);
  var fonte = modo === 'fixo' ? dosFonteDe(f, c, d, rasc, v) : '';
  return '<div class="dfield' + (f.t === 'lg' ? ' wide' : '') + (v === '' ? ' vazio' : '') + '"><label for="' + id + '">' + esc(f.l) + (fonte ? '<span class="ds ' + fonte + '">' + DOS_FONTES[fonte] + '</span>' : '') + '</label>' + ctl + (f.ajuda ? '<small>' + esc(f.ajuda) + '</small>' : '') +
    (og ? '<small class="orig ' + og.conf + '">' + esc(og.origem) + ' · ' + esc(ONB_CONF[og.conf]) + '</small>' : '') +
    (fn ? '<small class="orig alta">Veio do funil, ela mesma respondeu · salve para guardar no dossiê</small>' : '') + '</div>';
}
var DOS_CHIPS = ['persona', 'data_chegada', 'cidade', 'nivel_frances', 'cfNivel', 'ano_au_pair', 'trilha_estudo', 'telefone'];
function dosChipSinais(d) {
  var n = d && Array.isArray(d.sinais) ? d.sinais.length : 0;
  return n ? '<span class="dchip"><b>Sinais</b> ' + n + '</span>' : '';
}
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
  // titulo_custom, nota_custom, links_custom e quando_custom são o que ela edita no app (db/checklist-editar.sql do app): alimentam o Panorama.
  var rk = await Promise.all([
    uid ? supabase.from('checklist_items').select('step_key,category,label,status,due_date,sort_order,updated_at,titulo_custom,nota_custom,links_custom,quando_custom').eq('user_id', uid).order('sort_order', { ascending: true }) : null,
    supabase.from('plataforma_cliques').select('tela,alvo,rotulo,criado_em').eq('contato_id', cid).or(CHK_FILTRO).order('criado_em', { ascending: false }).limit(300)
  ]);
  if (rk[0] && rk[0].error) rk[0] = await supabase.from('checklist_items').select('step_key,category,label,status,due_date,sort_order,updated_at').eq('user_id', uid).order('sort_order', { ascending: true });   // sem as colunas novas
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
    out.push({ nivel: esperando ? 'baixa' : 'alta', rotulo: esperando ? 'Aguardando' : 'Atrasado',
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
  // Visão enxuta: o que pede ação agora (no máximo 3), o que falta fazer em ordem de prazo, e o resto recolhido.
  var sug = state.chkSug.slice(0, 3).map(function (x, n) {
    return '<div class="feeditem chk-sug"><span class="pill chk-rot ' + CHK_NIVEL[x.nivel] + '">' + esc(x.rotulo) + '</span><div class="fbody"><p title="' + esc(x.porque) + '">' + esc(x.titulo) + '</p></div>' +
      '<div class="chk-acoes"><button class="btn primary" type="button" data-chkvia="chat" data-chki="' + n + '">Escrever no chat</button>' +
      '<details class="chk-mais"><summary class="btn" aria-label="Outras ações">⋯</summary><div class="chk-menu">' +
      '<button type="button" data-chkvia="nota" data-chki="' + n + '">Nota no app dela</button><button type="button" data-chkvia="email" data-chki="' + n + '">E-mail</button>' +
      (x.prop ? '<button type="button" data-chkvia="prop" data-chki="' + n + '">Propor 1:1</button>' : '') + '</div></details></div></div>';
  }).join('') || '<p class="sub" style="margin:0">Nada a fazer agora: sem atrasos nem prazo chegando.</p>';
  var pend = cc.itens.filter(function (i) { return i.status !== 'concluido'; }).sort(function (a, b) { return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1; });
  var feitos = cc.itens.filter(function (i) { return i.status === 'concluido'; });
  var linha = function (i) {
    var feito = i.status === 'concluido', atras = cc.atrasados.indexOf(i) >= 0, d = atras ? chkDias(cc.hoje, i.due_date) : 0;
    return '<div class="chk-item"><span class="chk-dot ' + (feito ? 'ok' : atras ? 'atr' : '') + '" aria-hidden="true"></span><span class="chk-txt">' + esc(i.label) + '</span><span class="chk-qd' + (atras ? ' atr' : '') + '">' +
      (feito ? 'concluído' : atras ? chkPlural(d, 'dia', 'dias') + ' de atraso' : i.due_date ? 'até ' + esc(fmtDay(i.due_date)) : 'sem prazo') + '</span></div>';
  };
  var feed = (chk.cliques || []).filter(function (x) { return /^(Marcou como concluído|Desmarcou): /.test(x.rotulo || ''); }).slice(0, 10).map(function (x) {
    var t = chkClique(x);
    return '<div class="chk-item"><span class="chk-dot ' + (t[0] === 'Marcou' ? 'ok' : '') + '" aria-hidden="true"></span><span class="chk-txt">' + esc(t[0] + ': ' + t[2]) + '</span><span class="chk-qd">' + esc(fmtDia(x.criado_em) + ' ' + fmtHora(x.criado_em)) + '</span></div>';
  }).join('');
  return '<div class="panel" style="padding:16px"><div class="chk-topo"><h3 style="font-size:15px;margin:0">Checklist dela</h3><span class="sub">' + cc.feitos + ' de ' + cc.itens.length + ' · ' + pct + '%</span></div>' +
    '<div class="dprog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
    '<h4 class="chk-h">Precisa de ação</h4>' + sug +
    '<h4 class="chk-h">O que falta</h4>' + (pend.map(linha).join('') || '<p class="sub" style="margin:0">Tudo concluído.</p>') +
    (feitos.length ? '<details class="chk-rec"><summary>' + chkPlural(feitos.length, 'concluído', 'concluídos') + '</summary>' + feitos.map(linha).join('') + '</details>' : '') +
    (feed ? '<details class="chk-rec"><summary>O que ela marcou, ao vivo</summary>' + feed + '</details>' : '') + '</div>';
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
function dossieHtml(c, d, err, rasc, aberto, chk, fixo) {
  if (err) return '<div class="panel dossie"><div class="dhead"><h3>Dossiê</h3></div><p class="sub" style="margin:0">Falta rodar <b>db/crm-dossie.sql</b> no SQL Editor do Supabase.</p></div>';
  var pr = dosProgresso(c, d, rasc), pct = pr.tot ? Math.round(pr.n * 100 / pr.tot) : 0, sujo = rasc && Object.keys(rasc).length;
  var corpo = '';
  if (aberto && fixo) {
    var fx = state.fx, filtro = fx.dosFiltro || 'falta', fonteF = fx.dosFonte || 'todas', blocos = dosVisiveis(c, d, rasc).filter(function (b) { return b.t !== 'A ligação'; });
    var resp = function (f) { return dosValor(c, d, rasc, f.k) !== ''; }, ordem = ['funil', 'entrada', 'call', 'voce'], cont = { todas: 0 };
    ordem.forEach(function (o) { cont[o] = 0; });
    blocos.forEach(function (b) { if (!b.livre) b.campos.forEach(function (f) { var v = dosValor(c, d, rasc, f.k); if (v !== '') { cont.todas++; cont[dosFonteDe(f, c, d, rasc, v)]++; } }); });
    var faixa = '<div class="fontes" role="group" aria-label="Fonte da resposta"><span class="t">Fonte</span>' + [['todas', 'Todas']].concat(ordem.map(function (o) { return [o, DOS_FONTES[o]]; })).map(function (x) {
      return '<button type="button" class="fonte" data-fx="dosFonte" data-v="' + x[0] + '" aria-pressed="' + (fonteF === x[0]) + '">' + esc(x[1]) + '<small>' + cont[x[0]] + '</small></button>'; }).join('') + '</div>';
    var tog = '<span class="filtro" role="group" aria-label="Mostrar"><button type="button" data-fx="dosFiltro" data-v="falta" aria-pressed="' + (filtro === 'falta') + '">Só o que falta · ' + pr.falta + '</button><button type="button" data-fx="dosFiltro" data-v="tudo" aria-pressed="' + (filtro === 'tudo') + '">Tudo · ' + pr.tot + '</button></span>';
    var grupos = blocos.map(function (b, i) {
      var todos = b.campos, feitos = todos.filter(resp).length, vis = todos;
      if (fonteF !== 'todas') vis = todos.filter(function (f) { var v = dosValor(c, d, rasc, f.k); return v !== '' && dosFonteDe(f, c, d, rasc, v) === fonteF; });
      else if (filtro === 'falta' && !b.livre) vis = todos.filter(function (f) { return !resp(f) || (rasc && Object.prototype.hasOwnProperty.call(rasc, f.k)); });   // o que você mexeu agora não some da tela
      if (!vis.length) return '';
      var aberto2 = fonteF !== 'todas' || (fx.dosAb && fx.dosAb[b.t] !== undefined ? fx.dosAb[b.t] : i === 0);
      return '<details class="fg-d" data-dosg="' + esc(b.t) + '"' + (aberto2 ? ' open' : '') + '><summary><span>' + esc(b.t) + (b.livre ? '' : '<small>' + feitos + ' de ' + todos.length + (todos.length - feitos ? ' · faltam ' + (todos.length - feitos) : '') + '</small>') + '</span></summary><div class="dgrid">' + vis.map(function (f) { return dosCampoHtml(f, c, d, rasc, 'fixo'); }).join('') + '</div></details>';
    }).join('') || '<p class="sub" style="margin:12px 0 0">Nada com esse filtro.</p>';
    var nSujo = sujo || 0;
    corpo = '<div class="dcorpo"><div class="prog">' + tog + '</div>' + faixa + grupos +
      (nSujo ? '<div class="fx-salvar"><span class="sub">' + nSujo + (nSujo === 1 ? ' alteração' : ' alterações') + ' sem salvar</span><button class="btn primary" type="button" data-dossalvar="' + esc(c.id) + '">Salvar dossiê</button></div>' : '<div class="actions" style="margin-top:10px"><button class="btn primary" type="button" data-dossalvar="' + esc(c.id) + '">Salvar dossiê</button></div>') +
      '<div id="chk-box">' + checklistHtml(chk, Date.now()) + '</div></div>';
  } else if (aberto) {
    corpo = '<div class="dcorpo">' + dosVisiveis(c, d, rasc).filter(function (b) { return !(fixo && b.t === 'A ligação'); }).map(function (b) {
      return '<section class="dbloco"><h4>' + esc(b.t) + '</h4><div class="dgrid">' + b.campos.map(function (f) { return dosCampoHtml(f, c, d, rasc); }).join('') + '</div></section>';
    }).join('') + '<div class="actions" style="margin-top:6px"><button class="btn primary" type="button" data-dossalvar="' + esc(c.id) + '">Salvar dossiê</button>' +
      (sujo ? '<span class="sub" style="align-self:center">Há alterações ainda não salvas.</span>' : '') + '</div>' + (fixo ? '' : '<div id="poscall-box">' + poscallHtml(c) + '</div>') + '<div id="chk-box">' + checklistHtml(chk, Date.now()) + '</div></div>';
  }
  return '<div class="panel dossie' + (fixo ? ' in' : '') + '"><div class="dhead"><h3>Dossiê</h3><span class="sub">' + pr.n + ' de ' + pr.tot + ' respondidas' + (pr.falta ? ' · faltam ' + pr.falta : ' · completo') + '</span>' +
    (fixo ? '' : '<button class="btn" type="button" data-dostoggle="1" aria-expanded="' + !!aberto + '" style="margin-left:auto">' + (aberto ? 'Fechar dossiê' : 'Abrir dossiê completo') + '</button>') + '</div>' +
    '<div class="dprog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
    (fixo ? '' : '<div class="dchips">' + dosChipChk(chk) + dosChipSinais(d) + dosChipIns(state.ins) + dosChipChat(state.chat) + (dosChips(c, d, rasc) || '<span class="sub">Nada preenchido ainda. Abra o dossiê para preencher durante a ligação.</span>') + '</div>' + onbFaltaHtml(c, d, rasc)) + corpo + '</div>';
}
function pintaDossie(c) {
  var box = $('dossie-box'); if (!box || !state.dos || state.dos.cid !== c.id) return;
  var fixo = !!(fichaV2Ativa() && state.fx && state.fx.tab === 'dossie');   // na aba Dossiê ele fica sempre aberto
  box.innerHTML = dossieHtml(c, state.dos.d, state.dos.err, state.dos.rasc, fixo || state.dosAberto, state.dos.chk, fixo);
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

// ---------- Pós-call: a call fluida vira Dossiê + sinais + fila de curadoria (db/crm-pos-call.sql; Worker: POST /api/crm/pos-call/ler) ----------
// A IA lê a gravação transcrita e só PROPÕE. Nada entra na ficha até você marcar o que vale e aplicar. Os baldes são fixos:
//   fatos → chaves do Dossiê · leitura → sinais (vocabulário fechado) · perguntas e respostas → fila de curadoria por tema ·
//   itens candidatos → padrão (vale para qualquer pessoa da mesma situação) ou individual (depende de um dado só dela).
// Regra dos 3: um tema com 3 pessoas ou mais na fila está pronto para virar padrão (material, assunto ou notícia do Radar).
// Os sinais também podem ser marcados à mão, sem IA. A transcrição não é guardada pelo Worker; só a proposta.
var PC_FATORES = { politico: 'Político', economico: 'Econômico', social: 'Social', tecnologico: 'Tecnológico', ambiental: 'Ambiental', legal: 'Legal' };
function pcInicial(cid) { return { cid: cid, estado: 'vazio', erro: '', prop: null, vocab: [], vocabErro: false, cont: [], carregando: false, carregou: false, sel: { campos: {}, sinais: {}, fila: {}, perg: {} }, camadas: {}, manual: null }; }
function pcEstado(cid) { if (!state.pc || state.pc.cid !== cid) state.pc = pcInicial(cid); return state.pc; }
function pcRotuloSinal(pc, chave) { var v = (pc.vocab || []).filter(function (x) { return x.chave === chave; })[0]; return v ? v.rotulo : chave; }
function pcSinaisDela(d) { return d && Array.isArray(d.sinais) ? d.sinais.slice() : []; }
function pcTextoCampo(f, v) { if (v === true || v === 'true') return 'Sim'; if (v === false || v === 'false') return 'Não'; var o = f && f.o ? f.o.filter(function (x) { return x[0] === String(v); })[0] : null; return o ? o[1] : String(v); }

function poscallHtml(c, fixo) {
  var pc = pcEstado(c.id), d = (state.dos && state.dos.d) || {}, h = '';
  if (!pc.carregou && !pc.carregando) pcCarregarDados(c.id);
  h += '<section class="dbloco poscall"><h4>Pós-call</h4>';
  if (pc.vocabErro) return h + '<p class="sub" style="margin:0">Falta rodar <b>db/crm-pos-call.sql</b> no SQL Editor do Supabase.</p></section>';

  if (pc.estado === 'lendo') return h + (fixo ? '' : '<p class="sub" role="status">Lendo a call… (leva alguns segundos)</p>') + '</section>';
  if (pc.estado === 'proposta' && pc.prop) return h + poscallPropostaHtml(c, pc, d, fixo) + poscallCuradoriaHtml(pc) + '</section>';

  if (!fixo) {   // na aba Dossiê o botão de ler fica no alto da sessão (pcTopoHtml)
  var tem = dosValor(c, d, (state.dos && state.dos.rasc) || {}, 'ligacao_transcricao');
    h += '<div class="pcler"><p class="sub" style="margin:0 0 8px">Cole a gravação transcrita em <b>A ligação</b> e peça a leitura. A IA só propõe: você marca o que vale e aplica. ' +
      (tem ? '' : '<b>Ainda não há transcrição colada.</b>') + '</p>' +
      (pc.erro ? '<p class="err" role="alert">' + esc(pc.erro) + '</p>' : '') +
      '<div class="actions"><button class="btn primary" type="button" data-pcler="' + esc(c.id) + '">Ler a call com IA</button></div></div>';
  }
  return h + (pc.notionAplicada ? '<div class="pcnotion-lido"><h5>Última ligação lida do Notion (já aplicada em ' + esc(fmtDay(String(pc.notionAplicada.quando || '').slice(0, 10))) + ')</h5>' + poscallNotionHtml(pc.notionAplicada.proposta.notion) + '</div>' : '') + poscallCuradoriaHtml(pc) + '</section>';
}

function poscallPropostaHtml(c, pc, d, fixo) {
  var p = pc.prop.proposta, h = '<div class="pcprop">', ehN = p.origem === 'notion' && !!p.notion;
  h += ehN ? '<p class="sub" style="margin:10px 0">Leitura da página do Notion (a IA não leu nada: é a página padronizada). <b>A ficha já foi preenchida na leitura.</b> Aqui ficam os fatos que a ficha já tinha de outro jeito (marque só se quiser trocar) e, mais abaixo, pendências, lembretes e rascunho.</p>' : '<p class="sub" style="margin:10px 0">Proposta da IA' + (pc.prop.reutilizada ? ' (a mesma call já tinha sido lida; sem custo novo)' : '') +
    '. Marque o que vale e aplique. <b>Nada entrou na ficha ainda.</b></p>';

  if (!fixo && (p.mapa_da_call || []).length) {
    h += '<h5>O que rolou na call</h5><ol class="pcmapa">' + p.mapa_da_call.map(function (b) {
      return '<li><b>' + esc(b.titulo) + '</b>' + (b.tema && b.tema !== 'outro' ? ' <span class="dchip">' + esc(pcRotuloSinal(pc, b.tema)) + '</span>' : '') + '<br><small class="sub">' + esc(b.resumo) + '</small></li>';
    }).join('') + '</ol>';
  }
  var ks = Object.keys(p.campos || {});
  h += '<h5>1 · Fatos (vão para o Dossiê)</h5>';
  h += ks.length ? ks.map(function (k) {
    var f = dosCampo(k), x = p.campos[k], atual = dosValor(c, d, {}, k), propTxt = pcTextoCampo(f, x.valor), igual = atual !== '' && String(atual) === String(x.valor);
    var marcado = pc.sel.campos[k] === undefined ? (!igual && atual === '' && x.confianca !== 'baixa') : pc.sel.campos[k];
    return '<label class="pclinha"><input type="checkbox" data-pccampo="' + esc(k) + '"' + (marcado ? ' checked' : '') + (igual ? ' disabled' : '') + '> <span><b>' + esc(f ? f.l : k) + ':</b> ' + esc(propTxt) +
      (atual !== '' && !igual ? ' <i class="sub">(hoje: ' + esc(pcTextoCampo(f, atual)) + ' — o que você digitou só muda se você marcar)</i>' : '') + (igual ? ' <i class="sub">(já está assim)</i>' : '') +
      ' <span class="dchip ' + (x.confianca === 'baixa' ? 'falta' : '') + '">' + esc(ONB_CONF[x.confianca] || x.confianca) + '</span>' +
      (x.trecho ? '<br><small class="sub">“' + esc(x.trecho) + '”</small>' : '') + '</span></label>';
  }).join('') : '<p class="sub">Nenhum fato novo com fonte clara.</p>';

  if (ehN) return h + poscallNotionHtml(p.notion) + poscallAplicarHtml(c, pc);

  h += '<h5>2 · Sinais (leitura da situação)</h5>';
  h += (p.sinais || []).length ? p.sinais.map(function (s) {
    var ja = pcSinaisDela(d).indexOf(s.chave) >= 0, marcado = pc.sel.sinais[s.chave] === undefined ? true : pc.sel.sinais[s.chave];
    return '<label class="pclinha"><input type="checkbox" data-pcsinalprop="' + esc(s.chave) + '"' + (marcado || ja ? ' checked' : '') + (ja ? ' disabled' : '') + '> <span><b>' + esc(pcRotuloSinal(pc, s.chave)) + '</b>' +
      (ja ? ' <i class="sub">(já marcado)</i>' : '') + (s.motivo ? '<br><small class="sub">' + esc(s.motivo) + '</small>' : '') + '</span></label>';
  }).join('') : '<p class="sub">Nenhum sinal sustentado pela call.</p>';

  h += '<h5>3 · Padrão ou individual? (notícias que a call sugere)</h5>' +
    '<p class="sub" style="margin:0 0 6px">Padrão = você diria o mesmo a qualquer pessoa na mesma situação (vira notícia do Radar ou material). Individual = depende de um dado só dela (vai com uma nota sua). Todo item sai <b>a conferir</b>: ache a fonte antes de enviar.</p>';
  h += (p.itens_candidatos || []).length ? p.itens_candidatos.map(function (it, i) {
    var cam = pc.camadas['i' + i] || it.camada, marcado = pc.sel.fila['i' + i] === undefined ? true : pc.sel.fila['i' + i];
    return '<div class="pcitem"><label class="pclinha"><input type="checkbox" data-pcfila="i' + i + '"' + (marcado ? ' checked' : '') + '> <span><b>#' + esc(PC_FATORES[it.fator] || it.fator) + ' · ' + esc(it.titulo) + '</b> <span class="dchip falta">a conferir</span><br>' +
      esc(it.texto) + (it.impacto ? '<br><small class="sub">Para ela: ' + esc(it.impacto) + '</small>' : '') + '<br><small class="sub">IA: ' + esc(it.camada === 'padrao' ? 'padrão' : 'individual') + ' — ' + esc(it.motivo_camada) + '</small></span></label>' +
      '<div class="sel"><select data-pccamada="i' + i + '" aria-label="Camada do item ' + (i + 1) + '"><option value="padrao"' + (cam === 'padrao' ? ' selected' : '') + '>Padrão</option><option value="individual"' + (cam === 'individual' ? ' selected' : '') + '>Individual</option></select></div></div>';
  }).join('') : '<p class="sub">A call não sugeriu notícia.</p>';

  h += '<h5>4 · Perguntas dela e o que você explicou (vão para a fila de curadoria)</h5>';
  var qs = (p.perguntas_dela || []).map(function (x, i) { return { id: 'p' + i, rot: 'Ela perguntou', x: x }; }).concat((p.respostas_dadas || []).map(function (x, i) { return { id: 'r' + i, rot: 'Você explicou' + (x.precisa_fonte ? ' (precisa de fonte)' : ''), x: x }; }));
  h += qs.length ? qs.map(function (q) {
    var marcado = pc.sel.fila[q.id] === undefined ? true : pc.sel.fila[q.id];
    return '<label class="pclinha"><input type="checkbox" data-pcfila="' + q.id + '"' + (marcado ? ' checked' : '') + '> <span><b>' + esc(q.rot) + ':</b> ' + esc(q.x.texto) + ' <span class="dchip">' + esc(q.x.tema === 'outro' ? 'outro tema' : pcRotuloSinal(pc, q.x.tema)) + '</span></span></label>';
  }).join('') : '<p class="sub">Nada para a fila.</p>';

  if (!fixo && (p.a_conferir || []).length) h += '<h5>5 · A conferir na fonte, com você (antes de enviar qualquer coisa)</h5><ul class="pcconferir">' + p.a_conferir.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';

  if (fixo) return h + poscallAplicarHtml(c, pc);   // o que confirmar com ela já está nos quadros do alto
  var pe = p.perguntas_para_ela || [];
  h += '<h5>6 · Perguntas para confirmar com ela</h5>';
  h += pe.length ? '<p class="sub" style="margin:0 0 6px">O que ficou incerto ou faltou. Marque as que quer fazer: elas vão para o rascunho do chat, e você revisa antes de enviar.</p>' + pe.map(function (q, i) {
    var marcado = pc.sel.perg['q' + i] === undefined ? true : pc.sel.perg['q' + i], f = q.campo ? dosCampo(q.campo) : null;
    return '<label class="pclinha"><input type="checkbox" data-pcperg="q' + i + '"' + (marcado ? ' checked' : '') + '> <span>' + esc(q.texto) +
      (q.motivo ? '<br><small class="sub">Por quê: ' + esc(q.motivo) + (f ? ' · preenche “' + esc(f.l) + '”' : '') + '</small>' : '') + '</span></label>';
  }).join('') + '<div class="actions" style="margin-top:8px"><button class="btn" type="button" data-pcchat="' + esc(c.id) + '">Levar para o chat</button></div>'
    : '<p class="sub">A call fechou tudo o que importava: nada a confirmar com ela.</p>';

  return h + poscallAplicarHtml(c, pc);
}
function poscallAplicarHtml(c, pc) {
  return '<div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-pcaplicar="' + esc(c.id) + '">Aplicar o que marquei</button>' +
    '<button class="btn" type="button" data-pcdescartar="' + esc(c.id) + '">Descartar a proposta</button></div>' +
    (pc.erro ? '<p class="err" role="alert">' + esc(pc.erro) + '</p>' : '') + '</div>';
}

function poscallCuradoriaHtml(pc) {
  var cont = pc.cont || [];
  if (!cont.length) return '<div class="pccur"><h5>Fila de curadoria</h5><p class="sub" style="margin:0">Vazia. Quando o mesmo tema aparecer em 3 pessoas, ele fica pronto para virar padrão.</p></div>';
  return '<div class="pccur"><h5>Fila de curadoria (3 pessoas = pronto para virar padrão)</h5>' + cont.map(function (t) {
    var rot = t.tema === 'outro' ? 'Outros temas' : pcRotuloSinal(pc, t.tema);
    return '<div class="pccurlinha"><span><b>' + esc(rot) + '</b> · ' + t.n_pessoas + (Number(t.n_pessoas) === 1 ? ' pessoa' : ' pessoas') + ' · ' + t.n_itens + (Number(t.n_itens) === 1 ? ' linha' : ' linhas') + '</span>' +
      (t.pronto && t.tema !== 'outro' ? '<span class="dchip insnovo">pronto para virar padrão</span>' : '') +
      '<button class="btn" type="button" data-pcresolver="' + esc(t.tema) + '">Virou conteúdo</button></div>';
  }).join('') + '</div>';
}

function pintaPoscall(cid) {
  var box = $('poscall-box'), c = byC(cid);
  if (!(c && state.pc && state.pc.cid === cid)) return;
  var topo = $('pc-topo'), quad = $('pc-quadros');
  if (topo) topo.innerHTML = pcTopoHtml(c);
  if (quad) quad.innerHTML = pcQuadrosHtml(c);
  if (box) box.innerHTML = poscallHtml(c, !!(topo && state.pc.fixo));
}
async function pcCarregarDados(cid) {
  var pc = pcEstado(cid); pc.carregando = true;
  var r = await Promise.all([
    supabase.from('sinais_vocabulario').select('chave,rotulo,descricao').eq('ativo', true).order('chave'),
    supabase.rpc('crm_curadoria_contagem'),
    supabase.from('pos_call_propostas').select('id,proposta,status,criado_em').eq('contato_id', cid).eq('proposta->>origem', 'notion').order('criado_em', { ascending: false }).limit(5)
  ]);
  pc.carregando = false; pc.carregou = true;
  if (r[0].error) pc.vocabErro = true; else pc.vocab = r[0].data || [];
  pc.cont = r[1].error ? [] : (r[1].data || []);
  // A leitura do Notion mais recente: pendente volta a ser a proposta da tela; já aplicada fica só como consulta (pendências, lembretes, rascunho).
  var nt = r[2] && !r[2].error && (r[2].data || []).filter(function (x) { return x.status !== 'descartada'; })[0];
  if (nt && nt.proposta && nt.proposta.origem === 'notion' && nt.proposta.notion) {
    if (nt.status === 'pendente') { if (pc.estado !== 'proposta') { pc.prop = { id: nt.id, proposta: nt.proposta, reutilizada: false }; pc.estado = 'proposta'; pc.sel = { campos: {}, sinais: {}, fila: {}, perg: {} }; pc.camadas = {}; } }
    else pc.notionAplicada = { id: nt.id, proposta: nt.proposta, quando: nt.criado_em };
  }
  pintaPoscall(cid); pintaMont(cid);
}
// O alto da sessão "A ligação": anexar o arquivo da ligação transcrita (.txt, PDF ou imagem) e pedir a leitura da IA.
function pcTopoHtml(c) {
  var pc = pcEstado(c.id), lendo = pc.estado === 'lendo' || pc.notionLendo;
  return '<div class="pc-linha pc-uma"><input type="file" id="pc-arq" class="pc-arq-in" accept=".txt,.pdf,.jpg,.jpeg,.png,text/plain,application/pdf,image/jpeg,image/png" data-pcarq="' + esc(c.id) + '"><label class="btn pc-arq" for="pc-arq">' + (pc.arqNome ? 'Trocar arquivo' : 'Anexar arquivo') + '</label>' +
    '<input type="url" id="pc-notion" class="pc-notion-in" placeholder="…ou cole o link da página do Notion da ligação" value="' + esc(pc.notionUrl || '') + '" aria-label="Link da página do Notion da ligação">' +
    '<button class="btn primary" type="button" data-pcler="' + esc(c.id) + '"' + (lendo ? ' disabled' : '') + '>' + (lendo ? 'Lendo…' : 'Ler a conversa') + '</button></div>' +
    (pc.notionMsg ? '<p class="sub" role="status" style="margin:0 0 6px">' + esc(pc.notionMsg) + '</p>' : '') +
    '<p class="sub pc-dica">' + (pc.arqNome ? '<b>' + esc(pc.arqNome) + '</b>. ' : 'Aceita .txt, PDF, imagem ou o link do Notion: o botão percebe sozinho qual é. ') + 'A IA só propõe: nada entra na ficha sem você conferir. A leitura de arquivo usa tokens pagos da Anthropic.</p>' +
    (pc.estado === 'lendo' ? '<p class="sub" role="status">Lendo a call… (leva alguns segundos)</p>' : '') + (pc.erro ? '<p class="err" role="alert">' + esc(pc.erro) + '</p>' : '');
}
// Os quadros que a leitura preenche além de Resumo e Próximos passos (que são os campos do Dossiê): pontos de atenção e o que confirmar.
// Texto do Dossiê em blocos legíveis: o resumo vira parágrafo + linhas "Rótulo: texto"; os próximos passos viram listas de quem faz o quê.
function pcItensDe(txt) {
  var out = [], atual = '', nivel = 0;
  String(txt || '').split('').forEach(function (ch) {
    if (ch === '(') nivel++; if (ch === ')') nivel = Math.max(0, nivel - 1);
    if ((ch === ',' || ch === ';') && !nivel) { out.push(atual); atual = ''; } else atual += ch;
  });
  out.push(atual);
  return out.map(function (x) { return x.trim().replace(/^(e|and)\s+/i, '').replace(/[.\s]+$/, ''); }).filter(Boolean).map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); });
}
function pcResumoAmigavel(txt) {
  var linhas = String(txt || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  if (!linhas.length) return '<p class="sub" style="margin:0">Sem resumo ainda. Leia a conversa acima ou escreva em “Registro”.</p>';
  return linhas.map(function (l, i) {
    var m = i > 0 ? /^([^:]{2,40}):\s*(.+)$/.exec(l) : null;
    return m ? '<p class="pc-rl"><span class="pc-rk">' + esc(m[1]) + '</span>' + esc(m[2]) + '</p>' : '<p class="pc-rp">' + esc(l) + '</p>';
  }).join('');
}
function pcPassosDados(txt) {
  var quem = { ela: [], ingryd: [], outros: [] }, linhas = String(txt || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  linhas.forEach(function (l) {
    var re = /(^|[.\s])(Ela|Ingryd)\s*:\s*/gi, marcas = [], m;
    while ((m = re.exec(l))) marcas.push({ k: m[2].toLowerCase(), de: m.index + m[1].length, ini: m.index + m[0].length });
    if (!marcas.length) { var o = /^([^:]{2,40}):\s*(.+)$/.exec(l); if (o) quem.outros.push(o[1] + ': ' + pcItensDe(o[2]).join('; ')); else pcItensDe(l.replace(/^[-•*]\s*/, '')).forEach(function (x) { quem.outros.push(x); }); return; }
    marcas.forEach(function (mk, i) { var fim = i + 1 < marcas.length ? marcas[i + 1].de : l.length; pcItensDe(l.slice(mk.ini, fim)).forEach(function (x) { quem[mk.k].push(x); }); });
  });
  return quem;
}
function pcPassosAmigavel(txt) {
  var quem = pcPassosDados(txt);
  var col = function (t, arr) { return arr.length ? '<div class="dv-card"><div class="k">' + t + ' · ' + arr.length + '</div><ul class="dv-ul pc-ul">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : ''; };
  var h = col('Com ela', quem.ela) + col('Comigo', quem.ingryd);
  if (!h && !quem.outros.length) return '<p class="sub" style="margin:0">Sem encaminhamentos ainda.</p>';
  return '<div class="dv-grid">' + h + '</div>' + (quem.outros.length ? '<ul class="dv-ul pc-ul" style="margin-top:8px">' + quem.outros.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
}
// O que a leitura entrega além de Resumo e Próximos passos: Resumo e Encaminhamentos legíveis e UM bloco só para pontos de atenção + o que confirmar.
function pcQuadrosHtml(c) {
  var pc = pcEstado(c.id), p = pc.estado === 'proposta' && pc.prop && pc.prop.proposta && pc.prop.proposta.origem !== 'notion' ? pc.prop.proposta : null;
  var S = state.dos && state.dos.cid === c.id ? state.dos : null, dv = function (k) { return S ? String(dosValor(c, S.d, S.rasc || {}, k) || '') : ''; };
  var Sf = S ? dosFaltaPorCanal(c, S) : null, lacs = Sf ? Sf.conversa.concat(Sf.doc).slice(0, 5) : [], nLac = Sf ? Sf.conversa.length + Sf.doc.length : 0;
  var h = '<div class="pc-leitura"><div class="pc-card"><h5 class="pc-h">Resumo</h5>' + pcResumoAmigavel(dv('ligacao_resumo')) + '</div><div class="pc-card"><h5 class="pc-h">Próximos passos</h5>' + pcPassosAmigavel(dv('proximos_passos')) + '</div></div>' +
    (lacs.length ? '<div class="pc-lac"><span>Ainda não sabemos:</span>' + lacs.map(function (f) { return '<span class="pc-lac-t">' + esc(f.l) + '</span>'; }).join('') + (nLac > lacs.length ? '<span class="sub">e mais ' + (nLac - lacs.length) + '</span>' : '') + '</div>' : '');
  var aten = p ? (p.pontos_de_atencao || []) : [], pe = p ? (p.perguntas_para_ela || []) : [], conf = p ? (p.a_conferir || []) : [];
  var corpo = '';
  if (aten.length) corpo += '<p class="sub" style="margin:0 0 4px"><b>Pontos de atenção</b></p><ul class="dv-ul">' + aten.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  if (conf.length) corpo += '<p class="sub" style="margin:8px 0 4px"><b>Conferir na fonte oficial</b></p><ul class="dv-ul">' + conf.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  if (pe.length) corpo += '<p class="sub" style="margin:8px 0 4px"><b>Confirmar com ela</b> (marque as que quer fazer; vão para o rascunho do chat)</p>' + pe.map(function (q, i) {
    var marcado = pc.sel.perg['q' + i] === undefined ? true : pc.sel.perg['q' + i], f = q.campo ? dosCampo(q.campo) : null;
    return '<label class="pclinha"><input type="checkbox" data-pcperg="q' + i + '"' + (marcado ? ' checked' : '') + '> <span>' + esc(q.texto) + (q.motivo ? '<br><small class="sub">Por quê: ' + esc(q.motivo) + (f ? ' · preenche “' + esc(f.l) + '”' : '') + '</small>' : '') + '</span></label>';
  }).join('') + '<div class="actions" style="margin-top:8px"><button class="btn" type="button" data-pcchat="' + esc(c.id) + '">Levar para o chat</button></div>';
  if (!corpo) corpo = '<p class="sub" style="margin:0">' + (p ? 'A leitura não apontou nada a confirmar.' : 'Aparece depois da leitura da conversa.') + '</p>';
  var preencher = p && (p.resumo || (p.proximos_passos || []).length) ? '<div class="actions" style="margin:0 0 10px"><button class="btn" type="button" data-pcpreencher="' + esc(c.id) + '">Preencher Resumo e Próximos passos com a leitura</button></div>' : '';
  return preencher + h + '<details class="lg-det" data-lg="atencao"' + (lgAberto('atencao') ? ' open' : '') + '><summary>Pontos de atenção e a confirmar' + (aten.length + conf.length + pe.length ? ' · ' + (aten.length + conf.length + pe.length) : '') + '</summary><div class="dv-card pc-unico">' + corpo + '</div></details>';
}
function pcEscolheArquivo(inp) {
  var cid = inp.dataset.pcarq, pc = pcEstado(cid), f = inp.files && inp.files[0]; if (!f) return;
  var nome = f.name || 'arquivo', ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1] || '';
  pc.arquivo = null; pc.erro = '';
  if (/^(txt)$/i.test(ext) || f.type === 'text/plain') {
    if (f.size > 400000) { pc.erro = 'O .txt é grande demais (limite de 400 KB). Corte a parte que não interessa.'; return pintaPoscall(cid); }
    f.text().then(function (t) {
      t = String(t || '').trim(); if (t.length > 120000) { pc.erro = 'A transcrição passou de 120 mil letras. Corte a parte que não interessa.'; return pintaPoscall(cid); }
      if (state.dos && state.dos.cid === cid) { state.dos.rasc = state.dos.rasc || {}; state.dos.rasc.ligacao_transcricao = t; var el = $('dk-ligacao_transcricao'); if (el) { el.value = t; var fd = el.closest && el.closest('.dfield'); if (fd) fd.classList.remove('vazio'); } }
      pc.arqNome = nome + ' (o texto foi para “Gravação transcrita”)'; pintaPoscall(cid);
    });
    return;
  }
  if (/^(pdf|jpe?g|png)$/i.test(ext) || /^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) {
    if (f.size > 10 * 1048576) { pc.erro = 'O arquivo passa de 10 MB.'; return pintaPoscall(cid); }
    pc.arquivo = f; pc.arqNome = nome; return pintaPoscall(cid);
  }
  pc.erro = 'Use um arquivo .txt, PDF, JPG ou PNG.'; pintaPoscall(cid);
}
// Copia o resumo e os próximos passos da leitura para os campos do Dossiê. Sozinho (logo após ler) só preenche o que está vazio.
function pcPreencher(cid, auto) {
  var pc = pcEstado(cid), c = byC(cid), p = pc.prop && pc.prop.proposta; if (!c || !p || !state.dos || state.dos.cid !== cid) return;
  var rasc = state.dos.rasc = state.dos.rasc || {}, mudou = 0;
  var poe = function (k, v) {
    if (!v || (auto && dosValor(c, state.dos.d, rasc, k) !== '')) return;
    rasc[k] = v; mudou++; var el = $('dk-' + k); if (el) { el.value = v; var fd = el.closest && el.closest('.dfield'); if (fd) fd.classList.remove('vazio'); }
  };
  poe('ligacao_resumo', p.resumo || '');
  poe('proximos_passos', (p.proximos_passos || []).map(function (x) { return '- ' + x; }).join('\n'));
  if (!auto) toast(mudou ? 'Resumo e próximos passos preenchidos. Salve o dossiê para guardar.' : 'A leitura não trouxe resumo nem próximos passos.');
}
// 1:1 feito: a leitura da call (IA ou Notion) prova que a conversa aconteceu. Grava em `um_a_um` (status 'feito', já existente) e leva o estágio
// para '1:1' se a pessoa ainda estava antes dele. Idempotente: ler de novo não duplica. Se falhar, a leitura continua valendo; só avisa.
function umFeito(cid) { return (UM || []).some(function (u) { return u.contato_id === cid && u.status === 'feito'; }); }
function estagioRotulo(c) { return c.estagio === 'um_a_um' && umFeito(c.id) ? '1:1 feito' : stageLabel(c.estagio); }
async function sincronizarUmAUm(cid, origem) {
  var c = byC(cid); if (!c) return false;
  try {
    if (!umFeito(cid)) {
      var marcado = (UM || []).filter(function (u) { return u.contato_id === cid && u.status === 'agendado'; })[0];
      var w = marcado ? await supabase.from('um_a_um').update({ status: 'feito' }).eq('id', marcado.id)
        : await supabase.from('um_a_um').insert({ contato_id: cid, quando: new Date().toISOString(), status: 'feito', nota: 'Registrado ao ler a call (' + origem + ')' });
      if (w.error) throw w.error;
    }
    if (['lead', 'ativado', 'em_uso', 'inativo'].indexOf(c.estagio) >= 0) {
      var e = await supabase.from('contatos').update({ estagio: 'um_a_um' }).eq('id', cid);
      if (e.error) throw e.error;
    }
    await reload();
    return true;
  } catch (err) { toast('A leitura deu certo, mas não consegui marcar o 1:1 como feito: ' + ((err && err.message) || 'tente de novo') + '.'); return false; }
}
// Ler a página do Notion da ligação (a mesma leitura do menu Onboarding), sem sair da ficha. O Worker acha a ficha pelo e-mail da página:
// se for outra pessoa, não mexo nesta ficha e aviso. O Notion só é lido, nada é escrito lá nem enviado a ninguém.
async function pcLerNotion(cid) {
  var pc = pcEstado(cid), inp = $('pc-notion'), url = String((inp && inp.value) || pc.notionUrl || '').trim();
  pc.notionUrl = url; pc.erro = ''; pc.notionMsg = '';
  if (!url) { pc.erro = 'Cole o link da página do Notion.'; return pintaPoscall(cid); }
  if (!/^https:\/\//i.test(url)) { pc.erro = 'O link precisa começar com https:// e ser de notion.so, notion.com ou notion.site.'; return pintaPoscall(cid); }
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) { pc.erro = 'Sessão expirada. Recarregue a página e entre de novo.'; return pintaPoscall(cid); }
  pc.notionLendo = true; pintaPoscall(cid);
  var ctl = new AbortController(), cedo = setTimeout(function () { ctl.abort(); }, 60000), data;
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/onboarding/notion/ler', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: JSON.stringify({ url: url }), signal: ctl.signal });
    data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || ('Erro ' + res.status));
  } catch (e) {
    pc.notionLendo = false;
    pc.erro = e && e.name === 'AbortError' ? 'A leitura demorou mais de 1 minuto e foi cancelada. Tente de novo.' : e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : (e.message || 'Algo deu errado.');
    return pintaPoscall(cid);
  } finally { clearTimeout(cedo); }
  pc.notionLendo = false;
  await reload();
  if (data.contato_id !== cid) {   // a página é de outra pessoa: a ficha dela foi criada ou atualizada, esta não mudou
    pc.erro = 'Essa página é de outra pessoa' + (data.pessoa ? ' (' + data.pessoa + ')' : '') + '. A ficha dela foi ' + (data.criado ? 'criada' : 'atualizada') + '; esta ficha não mudou.';
    if (byC(data.contato_id)) pc.erro += ' Abra a ficha dela pela lista.';
    return pintaPoscall(cid);
  }
  var n = ((data.aplicado || {}).preenchidos || []).length;
  await sincronizarUmAUm(cid, 'Notion');
  state.ontResumo = data; state.pc = null;
  pcEstado(cid).notionUrl = url; pcEstado(cid).notionMsg = 'Notion lido: ' + (n ? n + (n === 1 ? ' campo preenchido' : ' campos preenchidos') + ' no Dossiê' : 'nenhum campo novo no Dossiê') + '. O que ficou como proposta aparece abaixo.';
  toast('Notion lido.');
  if (state.view === 'pessoa') renderPessoa();
  montAutoLer(cid);
}
async function pcLer(cid, t) {
  var pc = pcEstado(cid), c = byC(cid), transcricao = String(dosValor(c, state.dos.d, state.dos.rasc || {}, 'ligacao_transcricao') || '').trim();
  if (!pc.arquivo && transcricao.length < 200) { pc.erro = 'Anexe a ligação transcrita (.txt, PDF ou imagem) ou cole o texto em "Gravação transcrita" (pelo menos algumas frases).'; return pintaPoscall(cid); }
  pc.estado = 'lendo'; pc.erro = ''; pintaPoscall(cid);
  try {
    var sess = await supabase.auth.getSession();
    if (!sess.data.session) throw new Error('Entre de novo no CRM.');
    var notasTx = String(dosValor(c, state.dos.d, state.dos.rasc || {}, 'ligacao_resumo') || '').trim(), pedido;
    if (pc.arquivo) {   // PDF ou imagem: vai como formulário; o Worker confere o tipo de verdade pelos primeiros bytes
      var fd = new FormData(); fd.append('contato_id', cid); fd.append('notas', notasTx); if (transcricao) fd.append('transcricao', transcricao); fd.append('arquivo', pc.arquivo, pc.arquivo.name);
      pedido = { method: 'POST', headers: { Authorization: 'Bearer ' + sess.data.session.access_token }, body: fd };
    } else pedido = { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: JSON.stringify({ contato_id: cid, transcricao: transcricao, notas: notasTx }) };
    var res = await fetch(WORKER_BASE + '/api/crm/pos-call/ler', pedido);
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok || !j.ok) throw new Error(j.error || 'A leitura falhou (' + res.status + ').');
    pc.prop = j; pc.vocab = j.vocabulario && j.vocabulario.length ? j.vocabulario : pc.vocab; pc.estado = 'proposta'; pc.sel = { campos: {}, sinais: {}, fila: {}, perg: {} }; pc.camadas = {};
    pintaPoscall(cid); pcPreencher(cid, true);
    if (await sincronizarUmAUm(cid, 'IA') && state.view === 'pessoa') renderPessoa();
  } catch (e) { pc.estado = 'vazio'; pc.erro = e && e.message ? e.message : 'A leitura falhou.'; }
  pintaPoscall(cid);
  if (pc.estado === 'proposta') montAutoLer(cid);
}
// Um clique só: depois de ler a conversa, a montagem do espaço já é proposta (sem o segundo botão "Propor a montagem").
async function montAutoLer(cid) {
  var m = montEstado(cid), c = byC(cid);
  if (!c || m.estado === 'lendo' || m.estado === 'proposta' || m.estado === 'aplicando' || m.estado === 'aplicado') return;
  if (montTranscricao(c).texto.length < 200 && !montNotionUrl(c)) return;
  return montLer(cid);
}
// Monta o que vai ao banco a partir do que está marcado na tela.
function pcMontarAplicacao(c, pc, d) {
  var p = pc.prop.proposta, campos = {}, fila = [], sinais = pcSinaisDela(d);
  Object.keys(p.campos || {}).forEach(function (k) {
    var x = p.campos[k], atual = dosValor(c, d, {}, k), igual = atual !== '' && String(atual) === String(x.valor);
    var marcado = pc.sel.campos[k] === undefined ? (!igual && atual === '' && x.confianca !== 'baixa') : pc.sel.campos[k];
    if (marcado && !igual) campos[k] = x.valor;
  });
  (p.sinais || []).forEach(function (s) { if ((pc.sel.sinais[s.chave] === undefined ? true : pc.sel.sinais[s.chave]) && sinais.indexOf(s.chave) < 0) sinais.push(s.chave); });
  if (sinais.length !== pcSinaisDela(d).length) campos.sinais = sinais;
  (p.itens_candidatos || []).forEach(function (it, i) {
    if (pc.sel.fila['i' + i] === undefined ? true : pc.sel.fila['i' + i]) {
      fila.push({ tipo: 'item', texto: (it.titulo + ': ' + it.texto).slice(0, 600), tema: it.tema, camada: pc.camadas['i' + i] || it.camada,
        payload: { fator: it.fator, titulo: it.titulo, texto: it.texto, impacto: it.impacto || '', acao: it.acao || '', motivo_camada: it.motivo_camada, a_conferir: true } });
    }
  });
  (p.perguntas_dela || []).forEach(function (x, i) { if (pc.sel.fila['p' + i] === undefined ? true : pc.sel.fila['p' + i]) fila.push({ tipo: 'pergunta', texto: x.texto, tema: x.tema }); });
  (p.respostas_dadas || []).forEach(function (x, i) { if (pc.sel.fila['r' + i] === undefined ? true : pc.sel.fila['r' + i]) fila.push({ tipo: 'resposta', texto: x.texto, tema: x.tema }); });
  return { campos: campos, fila: fila };
}
async function pcAplicar(cid, t) {
  var pc = pcEstado(cid), c = byC(cid), a = pcMontarAplicacao(c, pc, state.dos.d);
  if (t) t.disabled = true;
  var r = await supabase.rpc('crm_pos_call_aplicar', { p_proposta: pc.prop.id, p_campos: a.campos, p_fila: a.fila });
  if (t) t.disabled = false;
  if (r.error) { pc.erro = 'Não consegui aplicar: ' + (r.error.message || 'tente de novo'); return pintaPoscall(cid); }
  state.pc = pcInicial(cid); state.pc.vocab = pc.vocab;
  await reload(); if (state.view === 'pessoa') renderPessoa();
  toast('Pós-call aplicado: ' + Object.keys(a.campos).length + (Object.keys(a.campos).length === 1 ? ' campo' : ' campos') + ' e ' + a.fila.length + (a.fila.length === 1 ? ' linha na fila' : ' linhas na fila'));
}
// ---------- Montagem do espaço: o transcript vira checklists, documentos, perguntas da equipe e contatos (rascunhos) ----------
// Lógica e HTML em montagem.js. Banco: db/crm-montagem.sql, crm-montagem-aplicar.sql, crm-entrar.sql. Worker: POST /api/crm/montagem/ler,
// /api/crm/convite e /api/crm/espaco-atualizado (estas duas só enviam com o seu "pode enviar"). A IA só propõe; nada chega a ela sem você.
function montInicial(cid) { return { cid: cid, estado: 'vazio', erro: '', prop: null, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '' }; }
function montEstado(cid) { if (!state.mont || state.mont.cid !== cid) state.mont = montInicial(cid); return state.mont; }
function montTranscricao(c) { var S = state.dos && state.dos.cid === c.id ? state.dos : null; return { texto: String(dosValor(c, (S && S.d) || {}, (S && S.rasc) || {}, 'ligacao_transcricao') || '').trim(), notas: String(dosValor(c, (S && S.d) || {}, (S && S.rasc) || {}, 'ligacao_resumo') || '').trim() }; }
// Sem transcrição colada, a Montagem lê a página do Notion da ligação: o link digitado agora ou a página já lida no Onboarding.
function montNotionUrl(c) {
  var pc = pcEstado(c.id), u = String(pc.notionUrl || '').trim(), B = state.bilan && state.bilan.cid === c.id ? state.bilan : null;
  // A página lida no Onboarding: vale a proposta aplicada, a pendente ou a que a ficha já carregou (state.bilan), o que vier primeiro.
  var n = (pc.notionAplicada && pc.notionAplicada.proposta && pc.notionAplicada.proposta.notion) || (pc.prop && pc.prop.proposta && pc.prop.proposta.notion) || (B && B.proposta && B.proposta.notion);
  return /^https:\/\//i.test(u) ? u : (n && /^[0-9a-f]{32}$/i.test(String(n.pagina || '')) ? 'https://www.notion.so/' + n.pagina : '');
}
// De onde a Montagem lê: a conversa vinculada a esta pessoa (pelo e-mail da ficha), seja a página do Notion lida ou a transcrição do Registro.
function montFonte(c) {
  var pc = pcEstado(c.id), n = pc.notionAplicada;
  if (montTranscricao(c).texto.length >= 200) return 'a transcrição colada em “Análise 1:1”';
  if (n) return 'a ligação do Notion lida em ' + fmtDay(String(n.quando || '').slice(0, 10));
  if (montNotionUrl(c)) return 'a ligação do Notion já lida';
  return montNotionUrl(c) ? 'o link do Notion informado' : '';
}
function montPainel(c) { var m = montEstado(c.id); m.dd = (state.fx && state.fx.dd) || {}; m.temTranscricao = montTranscricao(c).texto.length >= 200 || !!montNotionUrl(c); m.fonte = montFonte(c); return MT.painelHtml(m, c, esc); }
function montHtml(c) { return typeof MT === 'undefined' ? '' : '<div id="mont-box">' + montPainel(c) + '</div>'; }   // (os testes antigos montam o crm.js sem este módulo)
function pintaMont(cid) { var b = $('mont-box'), c = byC(cid); if (typeof MT !== 'undefined' && b && c) b.innerHTML = montPainel(c); }
async function montToken() { var sess = await supabase.auth.getSession(); if (!sess.data.session) throw new Error('Entre de novo no CRM.'); return sess.data.session.access_token; }
async function montWorker(caminho, corpo) {
  var res = await fetch(WORKER_BASE + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await montToken()) }, body: JSON.stringify(corpo) });
  var j = await res.json().catch(function () { return {}; });
  return { ok: res.ok && j.ok !== false, status: res.status, j: j };
}
// O Resumo e os Próximos passos do Dossiê ("A ligação") já nascem da leitura: preenche só o que estiver VAZIO (o que você escreveu nunca é sobrescrito),
// salvo se pedir de novo (forcar). Salva direto: sem outro botão.
async function montPreencheDossie(cid, forcar) {
  var c = byC(cid), p = state.mont && state.mont.cid === cid && state.mont.prop ? state.mont.prop.proposta : null;
  if (!c || !p || !state.dos || state.dos.cid !== cid) return 0;
  var b = p.bilan || {}, e = b.email || {}, rasc = state.dos.rasc || {}, dados = {};
  var alvo = { ligacao_resumo: String(b.resumo || ''), proximos_passos: (e.proximos || []).map(function (x) { return '- ' + x; }).join('\n') };
  Object.keys(alvo).forEach(function (k) { if (alvo[k] && (forcar || String(dosValor(c, state.dos.d, rasc, k) || '').trim() === '')) dados[k] = alvo[k]; });
  if (!Object.keys(dados).length) return 0;
  var r = await supabase.rpc('crm_salvar_dossie', { p_contato: cid, p_dados: dados });
  if (r.error) { fail('preencher o Resumo e os Próximos passos', r.error); return 0; }
  Object.keys(dados).forEach(function (k) { delete rasc[k]; });
  await reload(); if (state.view === 'pessoa') renderPessoa();
  return Object.keys(dados).length;
}
// O e-mail do bilan, rascunhado pela leitura da conversa (sem precisar do Notion). Vale a leitura mais recente que trouxe o e-mail.
function bilanDaMontagem(c) {
  var cv = state.pnConv && state.pnConv.cid === c.id ? state.pnConv.lista : [], ult = null;
  cv.forEach(function (x) { if (x.e && ((x.e.duvidas || []).length || (x.e.proximos || []).length || (x.e.respostas || []).length)) ult = x; });
  return ult ? { duvidas: ult.e.duvidas || [], proximos: ult.e.proximos || [], respostas: ult.e.respostas || [], doRascunho: 0, usouResumo: false, daLeitura: ult.versao } : null;
}
async function montLer(cid, t) {
  var m = montEstado(cid), c = byC(cid), tr = montTranscricao(c);
  var nUrl = tr.texto.length < 200 ? montNotionUrl(c) : '';
  if (tr.texto.length < 200 && !nUrl) { m.erro = 'Cole a transcrição em “Gravação transcrita” ou o link do Notion da ligação (em “Análise 1:1”).'; return pintaMont(cid); }
  m.estado = 'lendo'; m.erro = ''; m.msg = ''; pintaMont(cid);
  try {
    var r = await montWorker('/api/crm/montagem/ler', nUrl ? { contato_id: cid, notion_url: nUrl, notas: tr.notas } : { contato_id: cid, transcricao: tr.texto, notas: tr.notas });
    if (!r.ok || !r.j.proposta) throw new Error(r.j.error || 'A leitura falhou (' + r.status + ').');
    m.prop = { id: r.j.id, versao: r.j.versao, proposta: r.j.proposta, reutilizada: !!r.j.reutilizada }; m.sel = {}; m.motivos = {}; m.res = null; m.lib = null; m.previa = null; m.estado = 'proposta';
    var df = await supabase.rpc('crm_montagem_diff', { p_contato: cid, p_montagem: r.j.id }); m.diff = df.error ? null : df.data;   // o que já existe da leitura anterior
    if (c) fxCarregaConversas(c, true);   // o Panorama dela já nasce (ou se atualiza) com esta conversa
    var nPre = await montPreencheDossie(cid, false);
    if (nPre) m.msg = 'Preenchi ' + (nPre === 1 ? 'um campo' : 'os dois campos') + ' do Dossiê (Resumo e Próximos passos) com a leitura.';
  } catch (e) { m.estado = 'vazio'; m.erro = e && e.message ? e.message : 'A leitura falhou.'; }
  pintaMont(cid);
}
function montMarca(cid, k, marcado, motivo) {
  var m = montEstado(cid); m.sel[k] = !!marcado;
  if (marcado) delete m.motivos[k]; else if (motivo !== undefined) m.motivos[k] = motivo;
  pintaMont(cid);
}
async function montPub(cid) {
  var m = montEstado(cid), r = await supabase.rpc('crm_montagem_publicavel', { p_contato: cid });
  if (r.error) { m.erro = 'Falta rodar admin/crm/db/crm-entrar.sql no SQL Editor do Supabase.'; return pintaMont(cid); }
  m.pub = r.data || null; pintaMont(cid);
}
async function montAplicar(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  var dec = MT.decisoesDe(MT.itensDaProposta(m.prop.proposta), m.sel, m.motivos);
  m.estado = 'aplicando'; m.erro = ''; pintaMont(cid);
  var r = await supabase.rpc('crm_montagem_aplicar', { p_contato: cid, p_montagem: m.prop.id, p_decisoes: dec });
  if (r.error) { m.estado = 'proposta'; m.erro = 'Não consegui criar os rascunhos: ' + (r.error.message || 'tente de novo'); return pintaMont(cid); }
  m.res = r.data || {}; m.estado = 'aplicado'; m.msg = '';
  await montPub(cid);
  if (state.sel === cid && state.caso) casoRecarrega();
}
// A aprovação única: cria os rascunhos, confere os itens sem fonte (se você marcou que conferiu) e libera, tudo de uma vez.
// (Os passos já aparecem no Checklist e os avisos no Início; a escrita se edita lá.)
async function montAprovar(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  await montAplicar(cid, t);
  if (m.estado !== 'aplicado' || m.erro) return;
  return montAprovarFila(cid, t);
}
// "Levar para a Curadoria": cria os rascunhos da montagem (nada chega a ela) e abre a Curadoria, onde você aprova item por item.
async function montLevar(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  await montAplicar(cid, t);
  if (m.estado !== 'aplicado' || m.erro) return;
  toast('Montagem levada para a Curadoria.', 3200);
  if (state.sel === cid && state.fx) irPara({ tab: 'plataforma', sessao: 'curadoria' });
}
// A aprovação única de tudo o que espera na Curadoria: confere os itens sem fonte (se você marcou que conferiu) e libera.
async function montAprovarFila(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  var confiro = m.confiro === undefined ? true : !!m.confiro;
  if (confiro) {
    var ids = (m.pub && m.pub.a_conferir_itens || []).map(function (x) { return x.id; });
    for (var i = 0; i < ids.length; i++) {
      var rc = await supabase.rpc('crm_acao_conferida', { p_id: Number(ids[i]) });
      if (rc.error) { m.erro = 'Não consegui marcar um item como conferido: ' + (rc.error.message || 'tente de novo'); return pintaMont(cid); }
    }
  }
  await montLiberar(cid, t);
  if (state.sel === cid && state.caso) casoRecarrega();
}
async function montLiberar(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  m.erro = '';
  var r = await supabase.rpc('crm_montagem_liberar', { p_contato: cid, p_montagem: m.prop.id });
  if (r.error) { m.erro = 'Não consegui liberar: ' + (r.error.message || 'tente de novo'); return pintaMont(cid); }
  m.lib = r.data || {};
  await montPub(cid);
  if (state.sel === cid && state.caso) casoRecarrega();
}
async function montConferido(cid, id) {
  var m = montEstado(cid), r = await supabase.rpc('crm_acao_conferida', { p_id: Number(id) });
  if (r.error) { m.erro = 'Não consegui marcar como conferido: ' + (r.error.message || 'tente de novo'); return pintaMont(cid); }
  toast('Marcado como conferido. Agora você pode publicar para ela.');
  await montPub(cid);
  if (state.sel === cid && state.caso) casoRecarrega();   // o Checklist e a prévia mostram o passo já conferido
}
async function montDescartar(cid, t) {
  var m = montEstado(cid); if (!m.prop) return;
  var r = await supabase.rpc('crm_montagem_descartar', { p_id: m.prop.id });
  if (r.error) { m.erro = 'Não consegui descartar: ' + (r.error.message || 'tente de novo'); return pintaMont(cid); }
  state.mont = montInicial(cid); state.mont.msg = 'Proposta descartada.'; pintaMont(cid);
}
var MONT_ROTA = { convite: '/api/crm/convite', espaco: '/api/crm/espaco-atualizado' };
async function montPrevia(cid, tipo) {
  var m = montEstado(cid); m.erro = ''; m.msg = ''; m.pode = false;
  try {
    var r = await montWorker(MONT_ROTA[tipo], { contato_id: cid });
    if (!r.ok) throw new Error(r.j.error || 'Não consegui montar o e-mail (' + r.status + ').');
    m.previa = { tipo: tipo, para: r.j.para, assunto: r.j.assunto, texto: r.j.texto };
  } catch (e) { m.erro = e && e.message ? e.message : 'Não consegui montar o e-mail.'; }
  pintaMont(cid);
}
async function montEnviar(cid, tipo, t) {
  var m = montEstado(cid); if (!m.previa || !m.pode) return;
  m.erro = ''; m.msg = '';
  var corpo = { contato_id: cid, enviar: true, confirmo: true }; if (tipo === 'convite' && m.forcar) corpo.forcar = true;
  try {
    var r = await montWorker(MONT_ROTA[tipo], corpo);
    if (!r.ok) throw new Error(r.j.error || 'O envio falhou (' + r.status + ').');
    m.msg = tipo === 'espaco' ? 'Aviso enviado.' : 'Convite enviado.'; m.pode = false; m.forcar = false;
    toast(m.msg);
  } catch (e) { m.erro = e && e.message ? e.message : 'O envio falhou.'; }
  pintaMont(cid);
  if (m.msg) montPub(cid);
}
// Leva as perguntas marcadas para o rascunho do chat dela (aba Plataforma → Chat). Nada é enviado: você revisa e envia, e ela recebe
// o e-mail de aviso como em toda mensagem sua. O chat aceita até 1000 letras.
function pcChat(cid) {
  var pc = pcEstado(cid), c = byC(cid), pe = (pc.prop && pc.prop.proposta.perguntas_para_ela) || [], nome = String((c && c.nome) || '').trim().split(/\s+/)[0];
  var cab = (nome ? 'Oi, ' + nome + '! ' : 'Oi! ') + 'Para eu acertar o seu caminho, me conta:\n\n', rod = '\n\nPode responder aqui mesmo, com calma.', corpo = '', n = 0, cortadas = 0;
  pe.forEach(function (q, i) {
    if (!(pc.sel.perg['q' + i] === undefined ? true : pc.sel.perg['q' + i])) return;
    var linha = (n + 1) + '. ' + q.texto + '\n';
    if ((cab + corpo + linha).length + rod.length > 1000) { cortadas++; return; }
    corpo += linha; n++;
  });
  if (!n) return toast(cortadas ? 'As perguntas passam do limite do chat (1000 letras). Marque menos.' : 'Marque pelo menos uma pergunta.');
  state.chatRasc = (cab + corpo).replace(/\n$/, '') + rod;
  state.ptab = 'plataforma'; state.pstab = 'chat';
  renderPessoa();
  toast('Rascunho no chat: revise e envie.' + (cortadas ? ' ' + cortadas + (cortadas === 1 ? ' pergunta não coube.' : ' perguntas não couberam.') : ''), 4200);
}
async function pcDescartar(cid, t) {
  var pc = pcEstado(cid);
  if (t) t.disabled = true;
  var r = await supabase.rpc('crm_pos_call_descartar', { p_proposta: pc.prop.id });
  if (t) t.disabled = false;
  if (r.error) return fail('descartar a proposta', r.error);
  var vocab = pc.vocab; state.pc = pcInicial(cid); state.pc.vocab = vocab; state.pc.carregou = true;
  pcCarregarDados(cid); toast('Proposta descartada');
}
async function pcResolver(cid, tema, t) {
  if (t) t.disabled = true;
  var r = await supabase.rpc('crm_curadoria_resolver', { p_tema: tema, p_status: 'virou_conteudo' });
  if (t) t.disabled = false;
  if (r.error) return fail('fechar o tema', r.error);
  pcCarregarDados(cid);
  toast('Tema fechado: a contagem recomeça do zero');
}

// Só o que conta a jornada (capturas, quiz, acesso, app, artigos), do mais antigo ao mais novo. A lista de eventos da ficha
// tem só os 200 mais recentes: quem usa muito o checklist empurraria a 1ª entrada para fora. Falhou = jornada vazia, a ficha segue.
async function buscaJornada(cid) {
  try {
    var r = await supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', cid)
      .or('tipo.eq.email_capturado,tipo.eq.email_recapturado,tipo.eq.quiz_respondido,tipo.eq.acesso_ativado,tipo.eq.app_aberto,tipo.eq.artigo_lido')
      .order('criado_em', { ascending: true }).limit(1000);
    return r.error ? [] : (r.data || []);
  } catch (e) { return []; }
}
// Peças da aba Ficha, usadas pela ficha antiga e pela v2 (uma fonte só).
function fichaFeedHtml(eventos) {
  return '<div class="panel" style="padding:16px"><h3 style="font-size:15px; margin-bottom:8px">Tudo que ela fez</h3>' +
    '<p class="sub" style="margin:0 0 10px">Checklist, pergunta única, artigos e o resto do app — mais o que você mandou pra ela. Mais recente primeiro.</p>' +
    '<div class="feed">' + (eventos.map(function (e) {
      var tx = eventText(e), m = TYPE_META[tx[0]];
      return '<div class="feeditem"><span class="pill ' + m[1] + '">' + esc(m[0]) + '</span><div class="fbody"><p>' + esc(tx[1]) + '</p><time>' + esc(fmtDate(e.criado_em)) + '</time></div></div>';
    }).join('') || '<div class="empty">Nada registrado ainda.</div>') + '</div></div>';
}
function fichaMaisHtml(c, d) {
  var perg = d.perg, resps = d.resps, cons = d.cons, last = d.last, h4 = d.h4;
  return '<details class="mais"><summary>Mais: perguntas, respostas, consentimento e Instagram' + (resps.some(function (x) { return x.status === "nova"; }) ? ' · tem resposta nova' : '') + '</summary><div class="mais-col">' +
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
    '</div></details>';
}
// Ficha v2 (ficha-universo, fase 1): atrás de uma chave até a Ingryd aprovar. ?ficha=2 na URL ou localStorage.crm_ficha_v2 = '1'.
// FX e FH só são tocados dentro de funções chamadas com a chave ligada (os testes antigos não os injetam).
function fichaV2Ativa() {
  try { if (/[?&]ficha=2(&|$)/.test(String(location.search || ''))) return true; } catch (e) { /* sem location */ }
  try { return localStorage.getItem('crm_ficha_v2') === '1'; } catch (e) { return false; }
}
// A linha do passo do Checklist: a mesma para os gerais e os só dela (ponto de estado, título, etiquetas, ícones).
// o = { estado, rot, cls, titulo (já escapado), nota (já escapada), chips: [{t, c}], alerta, ed, id, home, extra }
function fxLinhaPasso(o) {
  var cps = (o.chips || []).map(function (c) { return '<span class="fx-cp ' + (c.c || '') + '">' + esc(c.t) + '</span>'; }).join('');
  var meio = '<span class="fx-pt">' + o.titulo + '</span><span class="fx-cps">' + cps + (o.nota ? '<span class="fx-nota">' + o.nota + '</span>' : '') + '</span>' +
    (o.alerta ? '<span class="fx-alerta">' + casoSvg('alerta', 13) + ' ' + esc(o.alerta) + '</span>' : '') + (o.sub || '');
  var btns = (o.ed ? casoBtn(o.ed, o.id, 'Editar') : '') + (o.home || '') + (o.extra || '');
  return casoLinha(casoPil(o.rot, o.estado === 'ok' ? 'u-baixa' : o.estado === 'bad' ? 'u-alta' : o.estado === 'mid' ? 'u-media' : ''), meio, btns, ((o.cls || '') + (o.alerta ? ' alerta' : '')).trim());
}
var H_FX = { esc: esc, fmtDay: fmtDay, linhaPasso: fxLinhaPasso };
var FX_ABAS = ['conversa', 'plataforma', 'ficha', 'dossie'];
// Zera o que é "desta pessoa" ao abrir outra ficha. A ordem das sessões e o guia são preferências do navegador e ficam.
function fxReset() {
  var f = state.fx; f.tab = null; f.ag = { i: 0, pop: null }; f.dem = 'todas'; f.ckTodos = false; f.ckMais = false; f.ckEd = null; f.ckOrigem = 'todos'; f.curOrigem = 'todos'; state.cur = null; f.abertas = {}; f.sessao = null; f.flash = null; f.tarefas = []; f.dados = null; f.appAba = 'inicio'; f.dia = 1; f.camadas = false; f.dd = {}; f.tema = null; f.coorte = null; f.urg = [];
}
function fxPrefs() {
  var f = state.fx;
  if (f.prefsLidas) return;
  var p = FX.lerPrefs(localStorage); f.tour = p.tour; f.ord = p.ord; f.prefsLidas = true;
}
function fxContato(c, uid) { return Object.assign({}, c, { user_id: uid || c.user_id || null }); }
// A fila de hoje: quem tem resposta nova, processo para decidir ou urgência alta (e a pessoa aberta), mais novidades primeiro.
function fxFilaItens(c) {
  var novas = {}, procs = {};
  R.forEach(function (x) { if (x.status === 'nova') novas[x.contato_id] = (novas[x.contato_id] || 0) + 1; });
  PSUG.forEach(function (p) { (procs[p.contato_id] = procs[p.contato_id] || []).push(p.processo); });
  var mk = function (x) {
    var n = novas[x.id] || 0, aberta = x.id === c.id && state.fx.cid === c.id;
    // A pessoa aberta mostra a mesma ação do 1º cartão do carrossel (spec §15); as outras, a ação rápida que dá para saber sem abrir a ficha.
    if (aberta) return { c: x, novas: n, proxima: state.fx.tarefas && state.fx.tarefas.length ? state.fx.tarefas[0].t : 'Nenhuma ação pendente', sub: personaLabel(x) + ' · ' + (x.user_id ? 'plataforma' : 'captação') };
    return { c: x, novas: n, proxima: FX.acaoRapida({ nome: displayName(x) }, { respostasNovas: n, processosDetectados: procs[x.id] || [] }, procLabel),
      sub: personaLabel(x) + ' · ' + (x.user_id ? 'plataforma' : 'captação') };
  };
  var itens = FX.ordenarFila(C.filter(function (x) { return novas[x.id] || procs[x.id] || x.urgencia === 'alta' || x.id === c.id; }).map(mk)).slice(0, 8);
  if (!itens.some(function (o) { return o.c.id === c.id; })) itens.push(mk(c));
  return itens;
}
// As ações da equipe para esta pessoa, com os dados que o CRM já lê hoje (spec §4.3).
// A conta de "X de Y" do checklist, igual à do app (itens + ações publicadas da equipe): um lugar só para o cabeçalho, as pílulas e a prévia.
function fxContaApp(c, chk, dem) {
  var k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null;
  return FX.contaChecklistApp({ mapa: FX_PROC, persona: personaKey(c), itens: chk.itens || [], acoes: k ? k.aco : [], listas: k ? k.listas : [], dem: dem || 'todas' });
}
function fxChkResumo(c, chk) {
  if (!chk || chk.err || chk.semConta) return null;
  var cc = chkCalc(chk, Date.now()), n = fxContaApp(c, chk);
  return { feitos: n.feitos, total: n.total, atrasados: cc.atrasados.length };
}
function fxTarefas(c, d) {
  var resps = d.resps || [], bilanEnviado = (d.mails || []).some(function (m) { return m.modelo === 'bilan_conversa'; });
  var dosFalta = state.dos && state.dos.cid === c.id ? dosProgresso(c, state.dos.d, state.dos.rasc).falta : 0;
  var k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null;
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null;
  var x = {
    nome: displayName(c), respostasNovas: resps.filter(function (r) { return r.status === 'nova'; }).length, chatNaoLidas: chatNaoLidas(state.chat),
    processosDetectados: (state.procs || []).filter(function (p) { return p.status === 'detectada'; }).map(function (p) { return p.processo; }),
    bilanPendente: !!(state.bilan && state.bilan.cid === c.id && !bilanEnviado), dossieFalta: dosFalta,
    acoes: k ? k.aco.filter(function (a) { return a.dono === 'ingryd' && a.estado !== 'concluida'; }).map(function (a) { return { id: a.id, titulo: a.titulo, canal: a.canal, canalRotulo: CASO_CANAL[a.canal] || '', prazoTxt: casoPrazo(a) }; }) : [],
    atrasados: chk && !chk.err && !chk.semConta ? chkCalc(chk, Date.now()).atrasados.length : 0,
    proximoEmail: proximoEmail(c, d.mails || [], resps, d.jor)
  };
  var pe = potEntrada(c, { mails: d.mails || [], respostas: resps.length, respostasNovas: x.respostasNovas, temBilan: !!(state.bilan && state.bilan.cid === c.id), umFeito: umFeito(c.id),
    linkPagamento: !!state.pagto, assin: state.assin || null, chk: fxChkResumo(c, chk) });
  if (state.int && state.int.cid === c.id) { var uso = FX.calcularUso(state.int.err ? [] : state.int.cliques || [], Date.now()); pe.ultimoAcessoDias = uso.diasDesdeUltima; pe.sessoes30 = uso.sessoes; }
  var pot = FX.potencial(pe); x.potNota = pot.nota; x.potAcao = FX.proximaAcao(pe, pot);
  state.fx.urg = FX.urgentes(x);   // o quadro de urgência do carrossel
  return FX.tarefasDe(x, procLabel);
}
// O bloco "Minhas próximas ações": cabeçalho com o nome, Adicionar e Concluídas (as ações da equipe vêm de caso_acoes) e, só quando precisa, o quadro de urgência.
function fxCarrossel(c) {
  var f = state.fx, k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null;
  var conc = k ? k.aco.filter(function (a) { return a.dono === 'ingryd' && a.estado === 'concluida'; }).length : 0;
  return FH.htmlCarrossel(f.tarefas, H_FX, f.ag.i, { nome: pn(c), concluidas: conc, urgente: f.urg || [] });
}
// Depois que o caso carrega ou muda (nova ação, "Já fiz"): recalcula as ações e repinta só o carrossel.
function fxAtualizaAcoes() {
  var c = byC(state.sel), f = state.fx, d = f.dados; if (!c || !d || f.cid !== c.id) return;
  var cv = fxContato(c, d.uid); f.tarefas = fxTarefas(cv, d);
  f.ag.i = Math.min(f.ag.i || 0, Math.max(0, f.tarefas.length - 1));
  if (f.ag.pop === null) { var ab = $('fx-acoes-box'); if (ab) ab.innerHTML = fxCarrossel(cv); }
}
// Adicionar uma tarefa só sua: vira uma linha de caso_acoes (dono "ingryd", canal "so_eu"), que aparece em Só eu e no quadro como "Só eu".
async function fxAddAcao() {
  var c = byC(state.sel), f = state.fx, inp = $('fx-add-in'), err = $('fx-add-err'); if (!c || !inp) return;
  var tx = inp.value.trim();
  if (!tx) { if (err) { err.textContent = 'Escreva a tarefa antes de adicionar.'; err.hidden = false; } inp.focus(); return; }
  var r = await supabase.from('caso_acoes').insert({ contato_id: c.id, titulo: tx.slice(0, 160), dono: 'ingryd', canal: 'so_eu', estado: 'aberta', certeza: 'literal' });
  if (r.error) { if (err) { err.textContent = /caso_acoes/.test(String(r.error.message || '')) ? 'Falta rodar db/crm-caso.sql no Supabase.' : 'Não salvou: ' + (r.error.message || 'erro'); err.hidden = false; } return; }
  f.ag.pop = null; var box = $('fx-pop'); if (box) box.innerHTML = '';
  await casoRecarrega(); toast('Tarefa adicionada em Só eu', 2800);
}
async function fxFeitoAcao(id) {
  var f = state.fx; f.ag.pop = null; var box = $('fx-pop'); if (box) box.innerHTML = '';
  var r = await supabase.from('caso_acoes').update({ estado: 'concluida', concluida_em: new Date().toISOString(), concluida_por: 'equipe' }).eq('id', Number(id));
  if (r.error) return fail('concluir a ação', r.error);
  await casoRecarrega(); toast('Feito. Foi para Concluídas.', 2800);
}
function fxFeitas() {
  var k = state.caso && state.caso.cid === state.sel && !state.caso.err ? state.caso : null;
  return k ? k.aco.filter(function (a) { return a.dono === 'ingryd' && a.estado === 'concluida'; }).sort(function (a, b) { return String(b.concluida_em || '') < String(a.concluida_em || '') ? -1 : 1; })
    .map(function (a) { return { titulo: a.titulo, quando: a.concluida_em ? fmtDay(a.concluida_em) : '', quem: a.concluida_por === 'ela' ? 'por ela' : 'pela equipe' }; }) : [];
}
// ---------- O cabeçalho da ficha: o que importa da pessoa, na mesma ordem para todo mundo ----------
// 1:1 (dia, hora, minutos e se pagou), plataforma (conta e uso), dossiê (quanto falta), prazo e e-mails.
function fxResumoCartoes(c, d) {
  var agora = Date.now(), cartao = function (r, v, sub, tom) { return { rotulo: r, valor: v, sub: sub || '', tom: tom }; };
  var mails = d.mails || [], resps = d.resps || [];
  // 1:1: o que já aconteceu, o que vem aí e a próxima data. Um 1:1 sem dia não conta como marcado (só vale com dia e pagamento).
  var ums = UM.filter(function (x) { return x.contato_id === c.id && x.status !== 'cancelado'; }), pags = PAG1A1.filter(function (p) { return p.contato_id === c.id; });
  var comDia = ums.filter(function (x) { return x.quando; }), passou = function (x) { return new Date(x.quando).getTime() < agora - 36e5; };
  var feitos = comDia.filter(function (x) { return x.status === 'feito' || passou(x); }).length;
  var vindo = comDia.filter(function (x) { return x.status === 'agendado' && !passou(x); }).sort(function (a, b) { return a.quando < b.quando ? -1 : 1; }), prox = vindo[0], pago = pags[0];
  var pagTxt = pago ? pago.minutos + ' min · pago em ' + fmtDate(pago.pago_em) : 'sem pagamento registrado';
  var histo = feitos ? 'já fez ' + feitos : 'nenhum feito ainda';
  var um;
  if (prox) um = cartao('1:1', new Date(prox.quando).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + fmtHora(prox.quando) + (pago ? ' · ' + pago.minutos + ' min' : ''),
    pagTxt + ' · ' + histo + (vindo.length > 1 ? ' · +' + (vindo.length - 1) + ' depois' : ''), pago ? 'ok' : undefined);
  else if (pago && pags.length > feitos) um = cartao('1:1', 'Pago, falta marcar', pagTxt + ' · ' + histo, 'alerta');
  else if (feitos) um = cartao('1:1', 'Já fez ' + feitos, 'nenhum vindo agora', undefined);
  else um = cartao('1:1', 'Nenhum', ums.some(function (x) { return !x.quando; }) ? 'convite aberto, sem dia' : 'ainda não fez 1:1');
  // Plataforma
  var a = state.assin, conta = !!c.user_id, ult = diasDesde(c.ultimo_evento_em);
  var rotA = a ? (a.status === 'trialing' ? 'Em teste' : a.status === 'active' ? 'Assinante' : (ASSIN_ST[a.status] || a.status)) : '';
  var plat = !conta ? null   // sem conta: nada a mostrar aqui (a pílula do alto já diz "Lead" e "Não assinante")
    : cartao('Plataforma', rotA || 'No app', (a && a.status === 'trialing' ? 'teste até ' + fmtDay(String(a.teste_fim || a.periodo_fim || '').slice(0, 10)) + ' · ' : '') + (ult == null ? 'sem atividade' : ult === 0 ? 'ativa hoje' : 'última atividade há ' + haDias(ult)), 'ok');
  // Dossiê
  var dos = state.dos && state.dos.cid === c.id && state.dos.d ? dosProgresso(c, state.dos.d, state.dos.rasc) : null;
  var dosC = dos ? cartao('Dossiê', dos.n + ' de ' + dos.tot, dos.falta ? 'faltam ' + dos.falta + ' respostas' : 'completo', dos.falta === 0 ? 'ok' : undefined) : cartao('Dossiê', '—', 'carregando…');
  // Prazo
  var r = c.respostas || {}, prazo;
  if (CF_PRAZO[r.cfNivel]) { var dc = diasAte(CF_PRAZO[r.cfNivel]); prazo = cartao('Prazo', fmtDay(CF_PRAZO[r.cfNivel]), 'Campus France · ' + (dc > 1 ? 'faltam ' + dc + ' dias' : dc === 1 ? 'falta 1 dia' : dc === 0 ? 'vence hoje' : 'venceu há ' + (-dc) + ' dias'), dc <= 30 && dc >= -90 ? 'alerta' : undefined); }
  else if (c.prazo_limite) prazo = cartao('Prazo', fmtDay(c.prazo_limite), 'VLS-TS · ' + prazoTxt(c), c.dias_para_prazo != null && c.dias_para_prazo <= 30 && c.dias_para_prazo >= -90 ? 'alerta' : undefined);
  else prazo = cartao('Prazo', '—', 'sem prazo registrado');
  // E-mails
  var abriu = mails.filter(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }).length, clicou = mails.filter(function (m) { return m.clicado_em || m.status === 'clicado'; }).length, novas = resps.filter(function (x) { return x.status === 'nova'; }).length;
  var em = mails.length || resps.length ? cartao('E-mails', mails.length ? 'abriu ' + abriu + ' de ' + mails.length : '—', (mails.length ? 'clicou ' + clicou + ' · ' : '') + 'respostas ' + resps.length + (novas ? ' (' + novas + ' sem resposta sua)' : ''), novas ? 'alerta' : undefined) : cartao('E-mails', '—', 'nenhum e-mail ainda');
  [um, plat, dosC, prazo, em].forEach(function (k, i) { if (k) k.id = ['um', 'plat', 'dos', 'prazo', 'email'][i]; });
  return [um, plat, dosC, prazo, em].filter(Boolean);
}
// A linha dos dados-chave do dossiê (só o que já foi respondido).
function fxFatosChave(c) {
  if (!(state.dos && state.dos.cid === c.id && state.dos.d)) return null;
  var v = function (k) { return dosValor(c, state.dos.d, state.dos.rasc, k); }, out = [];
  var op = function (k) { var f = dosCampo(k), x = v(k); if (x === '') return ''; var o = f && f.o ? f.o.filter(function (y) { return y[0] === x; })[0] : null; return o ? o[1] : x; };
  if (v('cidade')) out.push('mora em ' + v('cidade'));
  if (v('data_chegada')) out.push('chegou em ' + fmtDay(v('data_chegada')));
  if (op('nivel_frances')) out.push('francês ' + op('nivel_frances'));
  if (v('moradia_resolvida') === 'true') out.push('moradia resolvida');
  return out.length ? 'Dossiê: ' + out.join(' · ') : 'Dossiê ainda sem os dados-chave (cidade, chegada, francês).';
}
// Os detalhes de cada cartão do cabeçalho, no mesmo lugar, quando você clica: nada de tudo à vista de uma vez.
function fxHdDetalhe(c, d, id) {
  if (!id) return '';
  var agora = Date.now(), mails = d.mails || [], resps = d.resps || [];
  var linha = function (l, v) { return '<div class="hd-l"><span>' + esc(l) + '</span><b>' + v + '</b></div>'; };
  var btn = function (rot, attrs, primario) { return '<button type="button" class="btn' + (primario ? ' primary' : '') + '" ' + attrs + '>' + esc(rot) + '</button>'; };
  var fecha = '<button type="button" class="hd-x" data-fx="hdTile" data-id="' + esc(id) + '" aria-label="Fechar os detalhes">Fechar ✕</button>';
  var corpo = '', titulo = '';
  if (id === 'um') {
    titulo = '1:1 de ' + pn(c);
    var ums = UM.filter(function (x) { return x.contato_id === c.id && x.status !== 'cancelado'; }).filter(function (x) { return x.quando; }).sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    var pags = PAG1A1.filter(function (p) { return p.contato_id === c.id; });
    var pagDe = function (x) { var antes = pags.filter(function (p) { return p.pago_em <= x.quando; }); return (antes.length ? antes : pags)[0]; };
    corpo = (ums.length ? '<ul class="hd-lista">' + ums.map(function (x) {
      var feito = x.status === 'feito' || new Date(x.quando).getTime() < agora - 36e5, p = pagDe(x);
      return '<li><span class="pill ' + (feito ? '' : 'u-baixa') + '">' + (feito ? 'Feito' : 'Vem aí') + '</span> <b>' + esc(new Date(x.quando).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })) + ' · ' + esc(fmtHora(x.quando)) + '</b>' +
        ' <span class="sub">' + esc(p ? p.minutos + ' min · pago em ' + fmtDate(p.pago_em) : 'sem pagamento registrado') + '</span></li>';
    }).join('') + '</ul>' : '<p class="sub" style="margin:0">Nenhum 1:1 com dia marcado.</p>') +
      (pags.length ? '<p class="sub" style="margin:8px 0 0">' + pags.length + (pags.length === 1 ? ' pagamento de 1:1' : ' pagamentos de 1:1') + ': ' + esc(pags.map(function (p) { return p.minutos + ' min em ' + fmtDate(p.pago_em); }).join(' · ')) + '.</p>' : '') +
      '<div class="cam-acoes" style="margin-top:10px">' + btn('Marcar 1:1', 'data-open1a1="' + esc(c.id) + '"', true) + '</div>';
  } else if (id === 'plat') {
    titulo = 'Plataforma';
    var a = state.assin, ult = diasDesde(c.ultimo_evento_em);
    corpo = linha('Conta no app', c.user_id ? 'Sim' : 'Não') + linha('Última atividade', ult == null ? '—' : ult === 0 ? 'hoje' : 'há ' + haDias(ult)) +
      (a ? linha('Assinatura', esc(ASSIN_ST[a.status] || a.status) + (a.plano ? ' · ' + esc(a.plano) : '')) + linha(a.status === 'trialing' ? 'Fim do teste' : a.cancela_no_fim ? 'Acesso até' : 'Próxima cobrança', esc(fmtDay(String(a.status === 'trialing' ? a.teste_fim || a.periodo_fim : a.periodo_fim).slice(0, 10)))) : linha('Assinatura', 'Não assina')) +
      '<div class="cam-acoes" style="margin-top:10px">' + btn('Abrir a aba Plataforma', 'data-fx="tab" data-v="plataforma"', true) + '</div>';
  } else if (id === 'dos') {
    titulo = 'Dossiê';
    var ok = state.dos && state.dos.cid === c.id && state.dos.d;
    if (!ok) corpo = '<p class="sub" style="margin:0">Carregando o dossiê…</p>';
    else {
      var blocos = dosVisiveis(c, state.dos.d, state.dos.rasc).filter(function (b) { return !b.livre; });
      corpo = '<div class="hd-dos">' + blocos.map(function (b) {
        var feitos = b.campos.filter(function (f) { return dosValor(c, state.dos.d, state.dos.rasc, f.k) !== ''; }).length, falta = b.campos.filter(function (f) { return dosValor(c, state.dos.d, state.dos.rasc, f.k) === ''; });
        return '<div class="hd-dos-b"><b>' + esc(b.t) + '</b> <span class="sub">' + feitos + ' de ' + b.campos.length + '</span>' + (falta.length ? '<div class="sub">Falta: ' + esc(falta.slice(0, 4).map(function (f) { return f.l; }).join(', ')) + (falta.length > 4 ? ' e mais ' + (falta.length - 4) : '') + '</div>' : '') + '</div>';
      }).join('') + '</div><div class="cam-acoes" style="margin-top:10px">' + btn('Abrir o Dossiê', 'data-fx="tab" data-v="dossie"', true) + '</div>';
    }
  } else if (id === 'prazo') {
    titulo = 'Prazo';
    var r = c.respostas || {};
    corpo = (CF_PRAZO[r.cfNivel] ? linha('Campus France', esc(fmtDay(CF_PRAZO[r.cfNivel])) + ' · ' + esc(CF_NIVEL[r.cfNivel] || r.cfNivel)) : '') +
      (c.prazo_limite ? linha('VLS-TS', esc(fmtDay(c.prazo_limite)) + ' · ' + esc(prazoTxt(c))) + (c.data_entrada ? linha('Entrada na França', esc(fmtDay(c.data_entrada))) : '') + '<p class="sub" style="margin:6px 0 0">O prazo é a data de entrada + 3 meses − 1 dia, a mesma conta da calculadora do guia.</p>' : '') ||
      '<p class="sub" style="margin:0">Sem prazo registrado: falta a data de entrada na França (ou o nível do Campus France).</p>';
  } else if (id === 'email') {
    titulo = 'E-mails';
    var ord = mails.slice().sort(function (a, b) { var x = a.enviado_em || a.criado_em, y = b.enviado_em || b.criado_em; return x < y ? 1 : -1; }).slice(0, 5);
    corpo = (ord.length ? '<ul class="hd-lista">' + ord.map(function (m) { return '<li>' + mailPill(m) + ' <b>' + esc(m.assunto || modeloNome(m.modelo)) + '</b> <span class="sub">' + esc(fmtQuando(m.enviado_em || m.criado_em)) + (m.aberto_em ? ' · abriu ' + esc(fmtQuando(m.aberto_em)) : '') + (m.clicado_em ? ' · clicou ' + esc(fmtQuando(m.clicado_em)) : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="sub" style="margin:0">Nenhum e-mail enviado pelo CRM ainda.</p>') +
      (resps.length ? '<p class="sub" style="margin:8px 0 0">Ela respondeu ' + resps.length + (resps.length === 1 ? ' vez' : ' vezes') + (resps.some(function (x) { return x.status === 'nova'; }) ? ', e há resposta sem retorno seu' : '') + '.</p>' : '') +
      '<div class="cam-acoes" style="margin-top:10px">' + btn('Abrir a aba E-mail', 'data-fx="tab" data-v="conversa"', true) + '</div>';
  }
  return '<div class="hd-det-cab"><b>' + esc(titulo) + '</b>' + fecha + '</div>' + corpo;
}
function fxPintaHeader() {
  var c = byC(state.fx.cid), d = state.fx.dados, hb = $('fx-head-box'); if (!c || !d || !hb) return;
  hb.innerHTML = fxHeaderHtml(fxContato(c, d.uid), d); fxMedeCabecalho();
}
function fxHeaderHtml(c, d) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, k = null, agora = Date.now();
  if (chk && !chk.err && !chk.semConta) {
    var cc = chkCalc(chk, agora), ativos = cc.itens.filter(function (i) { return i.status !== 'arquivado'; }), lim = new Date(agora + 3 * 864e5).toISOString().slice(0, 10), nApp = fxContaApp(c, chk);
    k = { feitos: nApp.feitos, total: nApp.total, atrasados: cc.atrasados.length,
      vencem3: ativos.filter(function (i) { return i.status !== 'concluido' && i.due_date && i.due_date >= cc.hoje && i.due_date <= lim; }).length };
  }
  var mails = d.mails || [], resps = d.resps || [], jor = d.jor || montaJornada([]), assin = state.assin || null, tipo = FX.tipoCabecalho(c, assin);
  var cliques = state.int && state.int.cid === c.id && !state.int.err ? state.int.cliques || [] : [];
  var primeira = jor.entradas.length ? jor.entradas[0].em : c.criado_em, dd = diasDesde(primeira);
  var dados = { c: c, estagioLabel: estagioRotulo(c), assin: assin, uso: FX.calcularUso(cliques, agora), chk: k,
    chkMsg: !chk ? 'carregando o checklist…' : chk.err ? 'não carregou (falta rodar db/crm-checklist.sql)' : 'ela ainda não entrou no app',
    mailsTotal: mails.length, mailsAbertos: mails.filter(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }).length,
    mailsClicados: mails.filter(function (m) { return m.clicado_em || m.status === 'clicado'; }).length,
    entradas: Math.max(jor.entradas.length ? origensDe(c).length : 0, origensDe(c).length, 1), diasNaBase: dd,
    respostas: resps.length, respostasNovas: resps.filter(function (x) { return x.status === 'nova'; }).length,
    proximo: proximoEmail(c, mails, resps, jor), agora: agora };
  // Cabeçalho minimalista: lead = quando entrou, onde deixou o e-mail e se abriu; 1:1 = a data; plataforma = último acesso; o plano vira dropdown.
  var meus1a1 = UM.filter(function (x) { return x.contato_id === c.id && x.status !== 'cancelado' && x.quando; }).sort(function (a, b) { return a.quando < b.quando ? -1 : 1; });
  var prox1a1 = meus1a1.filter(function (x) { return new Date(x.quando).getTime() >= agora - 36e5; })[0] || meus1a1[meus1a1.length - 1];
  var orig = ultimaOrigem(c);
  dados.entradaEm = primeira; dados.origemLabel = orig ? 'em ' + orig : '';
  dados.um1a1 = prox1a1 ? prox1a1.quando : null; dados.um1a1Hora = prox1a1 ? fmtHora(prox1a1.quando) : '';
  dados.ultimoAcesso = cliques[0] ? cliques[0].criado_em : null;
  dados.pagamentos = PAGOS.filter(function (g) { return g.contato_id === c.id; });
  var cart = FX.cartoesMinimos(tipo, dados);
  return FH.htmlCabecalho({ c: c, linkPagamentoEnviado: !!state.pagto, estagioLabel: estagioRotulo(c), personaLabel: personaLabel(c) + (subLabel(c) ? ' · ' + subLabel(c) : ''),
    temConta: !!c.user_id, etiqueta: assin ? FX.etiquetaPagamento(assin) : null, estagios: STAGES, blocos: cart.blocos, nota: cart.nota }, H_FX);
}
// Catálogo de démarches (cópia do app, processos.json): carregado uma vez; sem ele, tudo cai na démarche padrão.
var FX_PROC = null, FX_QUANDO = null;   // FX_QUANDO: o "quando" de cada passo do template (guias-quando.json), para o prazo curto do Início
async function fxCarregaProcessos() {
  try { var r = await fetch('processos.json?v=2026-11-19.5'); return r.ok ? await r.json() : {}; } catch (e) { return {}; }
}
// A sessão Checklist: pílulas por démarche, os 4 mais urgentes, pasta do Drive privada e "Ver mais desta sessão".
// Os passos que a montagem do espaço propôs para ela, com démarche, subitens e origem: o mesmo detalhe do Checklist. Existem antes de ela ter conta.
// Os ganchos dos cards de passo da montagem (editar o texto, rótulos, botões): os mesmos na fila e nos publicados.
function fxHooksPassos(c, k) {
  return { editando: function (a) { return !!(k.ed && k.ed.t === 'aco' && k.ed.id === a.id); },
    editor: function (a) { return casoEditor('aco', a.id, '<input id="caso-ed-titulo" class="t" maxlength="160" style="width:100%" value="' + esc(a.titulo) + '" aria-label="Texto do passo">' +
      casoCampo('Subitens (um por linha, até 6)', '<textarea id="caso-ed-subitens" rows="4" style="width:100%" maxlength="800">' + esc((a.subitens || []).join('\n')) + '</textarea>')); },
    linhaPasso: fxLinhaPasso, esc: esc, rotulo: function (d) { return FX.rotuloDemarche(FX_PROC, d, personaKey(c)); }, prazo: casoPrazo, pil: casoPil, btn: casoBtn, ico: casoIco,
    alerta: function (a) { var al = fxAlertasChk(c); return (al.porRef['aco:' + a.id] || [])[0] || ''; },
    conferi: function (id) { return '<button type="button" class="btn" data-montconferido="' + esc(String(id)) + '" style="padding:5px 10px;font-size:12px">Conferi a fonte</button>'; }, linha: casoLinha };
}
function fxCasoPassos(c) {
  var k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null;
  if (!state.caso || state.caso.cid !== c.id) setTimeout(function () { carregaCaso(c.id); }, 0);
  return k;
}
// A fila: só o que espera a sua decisão. Publicar ou recusar tira o card; vazia, a seção some.
function fxPassosPropostos(c) {
  var k = fxCasoPassos(c); if (!k) return '';
  var h = MT.passosPropostosHtml(k.aco, k.listas, fxHooksPassos(c, k), 'fila');
  return h ? casoSecao('Passos propostos para ela', 'da montagem do espaço · publique ou recuse: o card sai daqui', fxSemConsent(k) + h) : '';
}
// Os passos da montagem que você já publicou (ou que ela concluiu): moram junto dos passos do checklist, com Editar e Retirar.
function fxPassosPublicados(c) {
  var k = fxCasoPassos(c); if (!k) return '';
  return MT.passosPropostosHtml(k.aco, k.listas, fxHooksPassos(c, k), 'publicados');
}
// Os passos só dela já publicados (ou concluídos), como o app os conta.
function fxEquipePublicada(c) {
  var k = fxCasoPassos(c); if (!k) return [];
  return k.aco.filter(function (a) { return a.dono === 'ela' && a.canal === 'plataforma' && /^(enc|chk):/.test(a.origem_chave || '') && a.estado !== 'recusada' && (a.publicada_em || a.estado === 'concluida'); });
}
function fxAlertasChk(c) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null;
  return FX.alertasChecklist({ itens: chk && !chk.err && !chk.semConta ? chk.itens || [] : [], equipe: fxEquipePublicada(c), quando: FX_QUANDO || {} });
}
// ---------- Curadoria: limpar, editar, posicionar e validar os passos dela (db/crm-checklist-curadoria.sql) ----------
async function fxCarregaCur(cid) {
  var r = await supabase.from('checklist_curadoria').select('step_key, oculto, ordem, conferido_em').eq('contato_id', cid);
  state.cur = { cid: cid, err: !!r.error, linhas: r.error ? [] : (r.data || []) };
  if (state.sel === cid && state.fx && state.fx.tab === 'plataforma' && fxSessaoAberta('curadoria')) fxPintaCorpo();
}
function fxCur(c) {
  if (!state.cur || state.cur.cid !== c.id) { if (!state.curCarregando) { state.curCarregando = true; setTimeout(function () { fxCarregaCur(c.id).then(function () { state.curCarregando = false; }, function () { state.curCarregando = false; }); }, 0); } return null; }
  return state.cur;
}
// Grava linhas (todas com as mesmas colunas) e recarrega. Só o que veio no objeto muda; o resto da linha fica.
async function fxCurGrava(c, linhas, aviso) {
  var agora = new Date().toISOString();
  var r = await supabase.from('checklist_curadoria').upsert(linhas.map(function (l) { return Object.assign({ contato_id: c.id, atualizado_em: agora }, l); }), { onConflict: 'contato_id,step_key' });
  if (r && r.error) return casoFalha('salvar a curadoria', r.error);
  await fxCarregaCur(c.id); if (aviso) toast(aviso);
}
// Os passos gerais visíveis, na ordem dela (para mover e arrastar).
function fxCurChaves(c) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, cur = state.cur && state.cur.cid === c.id ? state.cur : null; if (!chk || !cur) return [];
  var mapa = FX.mapaDaCuradoria(cur.linhas), itens = (chk.itens || []).filter(function (i) { return i.status !== 'arquivado' && !(mapa[i.step_key] && mapa[i.step_key].oculto); });
  return FX.ordenarGerais(itens, mapa, new Date().toISOString().slice(0, 10)).map(function (i) { return i.step_key; });
}
async function fxCurOrdena(c, chaves) { return fxCurGrava(c, chaves.map(function (k, i) { return { step_key: k, ordem: i }; }), 'Ordem guardada. Ela vê nessa ordem no app.'); }
async function fxCurAcao(c, ds) {
  var cur = state.cur && state.cur.cid === c.id ? state.cur : null; if (!cur) return;
  var mapa = FX.mapaDaCuradoria(cur.linhas), k = ds.id, m = mapa[k] || {};
  if (ds.fx === 'curRetira') return casoAcao('aco-retirar', ds.id, null);   // só dela: tira da página dela (volta a rascunho; dá para publicar de novo)
  if (ds.fx === 'curConf') return fxCurGrava(c, [{ step_key: k, conferido_em: m.conferido_em ? null : new Date().toISOString() }], m.conferido_em ? 'Conferência desfeita.' : 'Conferido.');
  if (ds.fx === 'curEsc') return fxCurGrava(c, [{ step_key: k, oculto: true }], 'Escondido: ela não vê mais este passo no app.');
  if (ds.fx === 'curMostrar') return fxCurGrava(c, [{ step_key: k, oculto: false }], 'Ela volta a ver este passo.');
  if (ds.fx === 'curReset') return fxCurGrava(c, fxCurChaves(c).filter(function (x) { return mapa[x] && mapa[x].ordem != null; }).map(function (x) { return { step_key: x, ordem: null }; }), 'Voltou à ordem automática.');
  if (ds.fx === 'curMov') return fxCurOrdena(c, FX.moverSessao(fxCurChaves(c), k, Number(ds.d) < 0 ? -1 : 1));
}
function fxLinhaCur(o) {
  var e = esc, cps = (o.chips || []).map(function (x) { return '<span class="fx-cp ' + (x.c || '') + '">' + e(x.t) + '</span>'; }).join('');
  var ic = function (acao, cls, rot, svg, extra) { return '<button type="button" class="fx-ic ' + cls + '" data-fx="' + acao + '" data-id="' + e(o.chave) + '"' + (extra || '') + ' aria-label="' + e(rot) + '" title="' + e(rot) + '">' + casoSvg(svg, 16) + '</button>'; };
  var btns = o.escondido ? '<button type="button" class="btn" data-fx="curMostrar" data-id="' + e(o.chave) + '">Mostrar de novo</button>'
    : ic('curMov', '', 'Subir', 'up', ' data-d="-1"' + (o.pos === 0 ? ' disabled' : '')) + ic('curMov', '', 'Descer', 'down', ' data-d="1"' + (o.pos === o.n - 1 ? ' disabled' : '')) +
      ic('curConf', o.conferido ? 'on' : '', o.conferido ? 'Conferido: clique para desfazer' : 'Marcar como conferido', 'check', ' aria-pressed="' + !!o.conferido + '"') +
      '<button type="button" class="fx-ic" data-caso="ed-chk" data-id="' + e(o.chave) + '" aria-label="Editar" title="Editar">' + casoSvg('pencil', 16) + '</button>' + ic('curEsc', '', 'Esconder da lista dela', 'x');
  return '<div class="fx-cur-row' + (o.alerta ? ' alerta' : '') + (o.escondido ? ' escondido' : '') + '" data-cur="' + e(o.chave) + '">' + (o.escondido ? '<span class="fx-cur-gap"></span>' : '<span class="fx-cur-grab" draggable="true" data-cur="' + e(o.chave) + '" role="img" aria-label="Arrastar para posicionar">⋮⋮</span>') +
    '<span class="fx-dot ' + (o.estado || 'off') + '" aria-hidden="true"></span><div class="fx-cur-t"><span class="fx-pt">' + o.titulo + '</span><span class="fx-cps">' + cps + '</span>' +
    (o.alerta ? '<span class="fx-alerta">' + casoSvg('alerta', 13) + ' ' + e(o.alerta) + '</span>' : '') + '</div><div class="fx-cur-b">' + btns + '</div></div>';
}
function fxCuradoriaPassos(c) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, cur = fxCur(c), f = state.fx, H = Object.assign({}, H_FX, { linhaCur: fxLinhaCur });
  if (!chk || !cur) return FH.htmlCuradoria({ carregando: true }, H);
  if (cur.err) return FH.htmlCuradoria({ erro: true }, H);
  if (chk.err || chk.semConta) return '<p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não tem checklist para curar.</p>';
  var mapa = FX.mapaDaCuradoria(cur.linhas), itens = (chk.itens || []).filter(function (i) { return i.status !== 'arquivado'; }), hoje = new Date().toISOString().slice(0, 10);
  var oc = function (i) { return !!(mapa[i.step_key] && mapa[i.step_key].oculto); }, visiveis = itens.filter(function (i) { return !oc(i); }), escondidos = itens.filter(oc);
  var equipe = fxEquipePublicada(c), k = fxCasoPassos(c);
  var hk = k ? Object.assign({}, fxHooksPassos(c, k), { semRetirar: true, extraLinha: function (a) { var ok = !!(mapa['aco:' + a.id] && mapa['aco:' + a.id].conferido_em), rot = ok ? 'Conferido: clique para desfazer' : 'Marcar como conferido';
    return '<button type="button" class="fx-ic ' + (ok ? 'on' : '') + '" data-fx="curConf" data-id="aco:' + esc(String(a.id)) + '" aria-pressed="' + ok + '" aria-label="' + rot + '" title="' + rot + '">' + casoSvg('check', 16) + '</button>' +
      (a.estado === 'concluida' ? '' : '<button type="button" class="fx-ic" data-fx="curRetira" data-id="' + esc(String(a.id)) + '" aria-label="Tirar da lista dela (volta a rascunho)" title="Tirar da lista dela (volta a rascunho)">' + casoSvg('x', 16) + '</button>'); } }) : null;
  return FH.htmlCuradoria({ origem: f.curOrigem || 'todos', resumo: FX.resumoCuradoria({ itens: itens, equipe: equipe, mapa: mapa }), alertas: fxAlertasChk(c), gerais: FX.ordenarGerais(visiveis, mapa, hoje), escondidos: escondidos,
    equipeHtml: k && hk ? MT.passosPropostosHtml(k.aco, k.listas, hk, 'publicados') : '', equipeN: equipe.length, mapa: mapa, hoje: hoje, guiaEd: f.guiaEd && f.guiaEd.key === f.ckEd ? f.guiaEd : undefined, ckEd: f.ckEd || null,
    temOrdem: visiveis.some(function (i) { return mapa[i.step_key] && mapa[i.step_key].ordem != null; }),
    demDe: function (i) { return FX.rotuloDemarche(FX_PROC, FX.processoDoItem(FX_PROC, i.step_key, i.category), personaKey(c)); } }, H);
}
// Chegou da montagem: tudo o que a leitura da conversa propôs e espera a sua decisão, por destino. Cada item é um card com Aprovar, Editar e Recusar.
var CUR_TIPO = { documento: 'Documento', modelo: 'Mensagem pronta', bilan: 'Bilan' };
function fxCurChip(t, cls) { return '<span class="fxc-chip' + (cls ? ' ' + cls : '') + '">' + esc(t) + '</span>'; }
function fxCurBtn(acao, id, rot, pri) { return '<button type="button" class="btn' + (pri ? ' primary' : '') + '" data-caso="' + acao + '" data-id="' + esc(String(id)) + '">' + esc(rot) + '</button>'; }
function fxCurCard(o) {
  return '<div class="fxc-card"><div class="fxc-t"' + (o.dbl ? ' data-dbl="' + o.dbl[0] + '" data-id="' + esc(String(o.dbl[1])) + '" tabindex="0" title="Dois cliques (ou Enter) para editar"' : '') + '><b>' + esc(o.titulo) + '</b>' + (o.chips ? '<div class="fxc-m">' + o.chips + '</div>' : '') + (o.extra || '') + '</div><div class="fxc-ac">' + o.acoes + '</div></div>';
}
function fxCurItens(k, lista) {
  return lista.map(function (it) {
    if (k.ed && k.ed.t === 'item' && k.ed.id === it.id) return casoEditor('item', it.id, casoItemCampos(it));
    var meta = casoItemMeta(it), secs = it.tipo === 'bilan' ? ((it.dados || {}).secoes || []) : [];
    var leit = secs.length ? '<details class="fxc-leit"><summary>Ler o bilan</summary>' + secs.map(function (sec) { return '<p><b>' + esc(sec.titulo) + '</b></p><ul>' + (sec.itens || []).map(function (x) { return '<li>' + esc(x.texto) + (x.estado === 'em_conferencia' ? ' <span class="sub">(a confirmar)</span>' : '') + '</li>'; }).join('') + '</ul>'; }).join('') + '</details>' : '';
    var ac = k.confirmaDel === it.id ? fxCurBtn('item-del', it.id, 'Recusar e excluir', 1) + fxCurBtn('cancelar', it.id, 'Não') : fxCurBtn('item-aprova', it.id, 'Aprovar', 1) + fxCurBtn('ed-item', it.id, 'Editar') + fxCurBtn('item-del-pede', it.id, 'Recusar');
    return fxCurCard({ titulo: it.titulo, chips: fxCurChip(CUR_TIPO[it.tipo] || it.tipo) + (meta ? fxCurChip(meta, 'est') : '') + fxCurChip(it.estado === 'revisado' ? 'Revisado' : 'Proposto', 'est'), extra: leit, acoes: ac, dbl: ['ed-item', it.id] });
  }).join('');
}
function fxCurAvisos(k, lista) {
  return lista.map(function (a) {
    if ((k.ed && k.ed.t === 'av' && k.ed.id === a.id) || k.agenda === a.id) return casoAvisosHtml({ avs: [a], ed: k.ed, agenda: k.agenda });
    var sp = a.tipo === 'pergunta' ? casoSeparaPergunta(a.titulo) : { p: a.titulo };
    return fxCurCard({ titulo: sp.p, chips: fxCurChip(CASO_TIPO_AVISO[a.tipo] || a.tipo) + fxCurChip(casoQuando(a), 'est'), acoes: fxCurBtn('ag-abrir', a.id, 'Aprovar e agendar', 1) + (a.tipo === 'pergunta' ? fxCurBtn('ed-av', a.id, 'Editar') : '') + fxCurBtn('av-cancel', a.id, 'Recusar'), dbl: a.tipo === 'pergunta' ? ['ed-av', a.id] : null });
  }).join('');
}
function fxCuradoriaFila(c) {
  var k = fxCasoPassos(c); if (!k) return '<div class="skel" aria-busy="true" style="height:64px"></div>';
  var m = state.mont && state.mont.cid === c.id ? state.mont : null, nao = function (it) { return it.estado !== 'publicado'; };
  var passos = MT.passosPropostosHtml(k.aco, k.listas, fxHooksPassos(c, k), 'fila');
  var docs = (k.itens || []).filter(function (it) { return it.tipo === 'documento' && (it.dados || {}).direcao !== 'recebe' && nao(it); });
  var perg = (k.avs || []).filter(function (a) { return a.estado === 'rascunho'; });
  var enc = (k.itens || []).filter(function (it) { return (it.tipo === 'bilan' || (it.tipo === 'documento' && (it.dados || {}).direcao === 'recebe')) && nao(it); });
  var msgs = (k.itens || []).filter(function (it) { return it.tipo === 'modelo' && nao(it); });
  var conferir = (m && m.pub && m.pub.a_conferir_itens) || [];
  var sec = function (t, n, corpo) { return n ? '<details class="fx-drop fxc-sec" open><summary><span>' + esc(t) + '<small>' + n + (n === 1 ? ' pendente' : ' pendentes') + '</small></span></summary><div class="fx-drop-c">' + corpo + '</div></details>' : ''; };
  var nPassos = (k.aco || []).filter(function (a) { return a.estado === 'rascunho' || a.estado === 'a_conferir'; }).length, total = nPassos + docs.length + perg.length + enc.length + msgs.length;
  if (!total) return '<div class="fx-cf-vazio"><b>Nada esperando a sua decisão.</b> Leia a conversa no Dossiê: a montagem proposta chega aqui com <i>Levar para a Curadoria</i>. <button type="button" class="link" data-fx="tab" data-v="dossie">Ir para o Dossiê</button></div>';
  var confiro = m && m.confiro !== undefined ? !!m.confiro : true;
  var topo = '<div class="fx-cf-topo"><p class="sub" style="margin:0"><b>' + total + (total === 1 ? ' item espera' : ' itens esperam') + '</b> a sua decisão. Nada chega a ela antes de você aprovar.</p>' +
    (m && m.prop ? '<span class="fx-cf-ac">' + (conferir.length ? '<label class="pccheck"><input type="checkbox" data-montconfiro' + (confiro ? ' checked' : '') + '> <span>Conferi os ' + conferir.length + ' sem fonte</span></label>' : '') + '<button type="button" class="btn primary" data-montaprovar="' + esc(c.id) + '">Aprovar tudo</button></span>' : '') + '</div>';
  return '<div class="fx-cf">' + topo + fxSemConsent(k) + sec('Checklist', nPassos, passos) + sec('Documentos a preparar', docs.length, fxCurItens(k, docs)) +
    sec('Perguntas da equipe', perg.length, fxCurAvisos(k, perg)) + sec('Encaminhamentos da Ingryd', enc.length, fxCurItens(k, enc)) + sec('Mensagens prontas', msgs.length, fxCurItens(k, msgs)) + '</div>';
}
function fxCuradoriaCorpo(c) {
  return fxCuradoriaFila(c) + '<h4 class="fx-h4" style="margin:22px 0 8px">Passos dela: organizar e validar</h4>' + fxCuradoriaPassos(c);
}
function fxChecklistCorpo(c) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, f = state.fx;
  if (!chk) return '<div class="skel" aria-busy="true" style="height:64px"></div>';
  var pre = fxPassosPropostos(c) + processosSugeridosHtml(state.procs);
  if (chk.err || chk.semConta) return pre + FH.htmlChecklistSessao({ semConta: !!chk.semConta && !chk.err, erro: !!chk.err }, H_FX);
  var agora = Date.now(), cc = chkCalc(chk, agora), itens = chk.itens || [];
  var dem = FX.demarchesDe(FX_PROC, personaKey(c), itens), ativa = f.dem !== 'todas' && dem.some(function (x) { return x.k === f.dem; }) ? f.dem : 'todas';
  var ult = chk.cliques && chk.cliques[0], horas = ult ? (agora - new Date(ult.criado_em).getTime()) / 36e5 : 0;   // dado velho: mais de 48 h sem atividade dela
  var origem = f.ckOrigem || 'todos', equipe = fxEquipePublicada(c);
  return pre + FH.htmlChecklistSessao({ semConta: false, erro: false, velhoDias: horas > 48 ? Math.floor(horas / 24) : 0, demarches: dem, ativa: ativa, origem: origem,
    homeRefs: state.caso && state.caso.cid === c.id && Array.isArray(state.caso.home) ? state.caso.home.filter(function (x) { return x.categoria === 'checklist'; }).map(function (x) { return x.step_key; }) : null,
    equipeHtml: fxPassosPublicados(c), equipeN: equipe.length, alertas: fxAlertasChk(c), guiaEd: f.guiaEd && f.guiaEd.key === f.ckEd ? f.guiaEd : undefined, ckEd: f.ckEd || null,
    demDe: function (i) { return FX.rotuloDemarche(FX_PROC, FX.processoDoItem(FX_PROC, i.step_key, i.category), personaKey(c)); },
    totalFeitos: fxContaApp(c, chk).feitos, total: fxContaApp(c, chk).total, itens: FX.filtrarPorDemarche(FX_PROC, itens, ativa),
    hoje: cc.hoje, todos: f.ckTodos, mais: f.ckMais, extraMais: f.ckMais ? checklistLateralHtml(chk, agora, H4_PLAT) + checklistHtml(chk, agora) : '' }, H_FX);
}
function fxRepintaChkDe() { var cm = byC(state.sel); if (cm) fxPintaChk(fxContato(cm, state.fx.dados && state.fx.dados.uid)); if (fxSessaoAberta('curadoria')) fxPintaCorpo(); }

// ---- Guia do passo (biblioteca de guias gerais): carregar, analisar um link, salvar, publicar, voltar ao original ----
function fxGuiaCampos() { var v = function (id) { var el = $(id); return el ? el.value : ''; }; return { pq: v('fx-g-pq'), at: v('fx-g-at'), ps: v('fx-g-ps'), ln: v('fx-g-ln') }; }
async function fxGuiaCarrega(stepKey) {
  var f = state.fx; f.guiaEd = { key: stepKey, row: null, erro: false };
  try {
    var r = await supabase.from('guias_gerais').select('step_key,por_que,atencao,passos,links,fonte_url,estado').eq('step_key', stepKey).maybeSingle();
    if (f.ckEd !== stepKey) return;
    if (r.error) f.guiaEd.erro = true; else f.guiaEd.row = r.data || null;
  } catch (e) { f.guiaEd.erro = true; }
  fxRepintaChkDe();
}
function fxGuiaRascunhoLocal(stepKey) {   // guarda o que está digitado antes de repintar, para não perder
  var f = state.fx, g = f.guiaEd; if (!g || g.key !== stepKey) return;
  var c = fxGuiaCampos(), u = $('fx-g-url');
  g.row = Object.assign({}, g.row || {}, { por_que: c.pq, atencao: c.at, passos: c.ps.split('\n').filter(Boolean), links: c.ln.split('\n').map(function (x) { x = x.trim(); var i = x.lastIndexOf('|'); return x ? { url: (i >= 0 ? x.slice(i + 1) : x).trim(), rotulo: i >= 0 ? x.slice(0, i).trim() : '' } : null; }).filter(Boolean), fonte_url: u ? u.value.trim() : '' });
}
async function fxGuiaAnalisar(stepKey, doTexto) {
  var f = state.fx, g = f.guiaEd; if (!g || g.key !== stepKey || g.analisando) return;
  var url = $('fx-g-url') ? $('fx-g-url').value.trim() : '', texto = doTexto && $('fx-g-txt') ? $('fx-g-txt').value.trim() : '';
  if (!url && !texto) { g.msg = 'Cole um link (ou o texto da página) para eu analisar.'; return fxRepintaChkDe(); }
  fxGuiaRascunhoLocal(stepKey); g.analisando = true; g.msg = 'Lendo a página e montando a proposta…'; g.lacunas = null; fxRepintaChkDe();
  var chk = state.dos && state.dos.chk, it = chk && (chk.itens || []).filter(function (i) { return i.step_key === stepKey; })[0];
  var r; try { r = await montWorker('/api/crm/guia/analisar', texto ? { texto: texto, titulo: it ? (it.titulo_custom || it.label) : '' } : { url: url, titulo: it ? (it.titulo_custom || it.label) : '' }); } catch (e) { r = { ok: false, j: { error: (e && e.message) || 'Entre de novo no CRM.' } }; }
  g.analisando = false;
  if (f.ckEd !== stepKey) return;
  if (!r.ok) { g.msg = (r.j && r.j.error) || 'Não consegui analisar agora.'; g.colar = !!(r.j && (r.j.codigo === 'pagina_vazia' || r.j.codigo === 'pagina_nao_abriu')); return fxRepintaChkDe(); }
  var gd = r.j.guia || {};
  g.row = Object.assign({}, g.row || {}, { por_que: gd.por_que || '', atencao: gd.atencao || '', passos: gd.passos || [], links: gd.links || [], fonte_url: r.j.url || url || (g.row && g.row.fonte_url) || '' });
  g.lacunas = gd.lacunas || []; g.msg = 'Proposta pronta. Confira, edite o que quiser e salve ou publique.'; g.colar = false;
  fxRepintaChkDe();
}
async function fxGuiaSalva(stepKey, estado) {
  var f = state.fx, g = f.guiaEd; if (!g || g.key !== stepKey) return;
  var v = FX.guiaDeCampos(fxGuiaCampos()); if (!v.ok) { g.msg = v.erro; return fxRepintaChkDe(); }
  var u = $('fx-g-url'), fonte = u && /^https?:\/\/\S+$/.test(u.value.trim()) ? u.value.trim().slice(0, 500) : null;
  var ses = await supabase.auth.getSession(), uid = ses && ses.data && ses.data.session ? ses.data.session.user.id : null;
  var r = await supabase.from('guias_gerais').upsert({ step_key: stepKey, por_que: v.por_que, atencao: v.atencao, passos: v.passos, links: v.links, fonte_url: fonte, estado: estado === 'publicado' ? 'publicado' : 'rascunho', atualizado_em: new Date().toISOString(), atualizado_por: uid }, { onConflict: 'step_key' }).select('step_key,por_que,atencao,passos,links,fonte_url,estado').maybeSingle();
  if (r.error) { g.msg = 'Não consegui salvar: ' + (r.error.message || 'erro'); return fxRepintaChkDe(); }
  g.row = r.data || g.row; g.msg = estado === 'publicado' ? 'Publicado. Todas as pessoas veem este guia no app.' : 'Rascunho salvo. Só a equipe vê.'; g.lacunas = null;
  toast(g.msg); fxRepintaChkDe();
}
async function fxGuiaApaga(stepKey) {
  var f = state.fx, g = f.guiaEd; if (!g || g.key !== stepKey) return;
  var r = await supabase.from('guias_gerais').delete().eq('step_key', stepKey);
  if (r.error) { g.msg = 'Não consegui voltar ao original: ' + (r.error.message || 'erro'); return fxRepintaChkDe(); }
  g.row = null; g.msg = 'Voltou ao texto original do template.'; g.lacunas = null; toast(g.msg); fxRepintaChkDe();
}
// Salva o texto de um passo do checklist dela (rpc só de admin). Título vazio = volta ao original.
async function fxSalvaPasso(stepKey) {
  var c = byC(state.sel), f = state.fx, chk = state.dos && c && state.dos.cid === c.id ? state.dos.chk : null; if (!c || !chk || !c.user_id) return true;
  var t = ($('fx-ck-t') ? $('fx-ck-t').value : '').trim(), n = ($('fx-ck-n') ? $('fx-ck-n').value : '').trim(), orig = $('fx-ck-t') ? $('fx-ck-t').getAttribute('data-orig') : '';
  if (t.length > 120) return toast('O texto do passo passa de 120 caracteres.'), true;
  if (n.length > 100) return toast('A observação passa de 100 caracteres.'), true;
  if (t === orig) t = '';   // igual ao original: não guarda cópia
  var r = await supabase.rpc('crm_checklist_editar', { p_user: c.user_id, p_step_key: stepKey, p_titulo: t, p_nota: n });
  if (r.error) { casoFalha('salvar o passo', r.error); return true; }
  (chk.itens || []).forEach(function (i) { if (i.step_key === stepKey) { i.titulo_custom = t || null; i.nota_custom = n || null; } });
  f.ckEd = null; fxRepintaChkDe(); fxPintaPrevia(); toast('Passo salvo. Ela vê o novo texto no app.'); return true;
}
function fxPintaChk(c) { var b = $('fx-chk-corpo'); if (b) b.innerHTML = fxChecklistCorpo(c); }
// As sessões da aba Plataforma, em pílulas e em dois grupos. O corpo só é montado nas abertas: os ids antigos (dossie-box,
// ins-box, int-box, chat-fio) existem enquanto a sessão está aberta, e as atualizações ao vivo ignoram o que não está na tela.
// Página inicial: o que você escolheu para o Início dela. Cada categoria tem espaços fixos (3 / 3 / 2). Para pôr um item, use o "+" em Espaço
// (Checklist, Só seu ou Guias); aqui você vê o que está nos espaços e tira para trocar.
// O item principal: um dos passos do checklist da home, mostrado grande no topo do Início dela (coluna caso_home.destaque).
function fxHomeDestaqueBloco(d, k) {
  if (k.homeSemDestaque) return '<p class="sub" style="margin:0 0 10px">Para destacar um item falta rodar <b>db/crm-caso-home-destaque.sql</b> no SQL Editor do Supabase (primeiro no teste, depois na produção).</p>';
  var x = (d.checklist.itens || []).filter(function (i) { return i.destaque; })[0];
  return '<section class="fx-home-bloco fx-home-dest" aria-label="Em destaque no app"><h4 class="fx-h4">Em destaque <span class="sub">' + (x ? 1 : 0) + ' de 1</span></h4>' +
    (x ? '<div class="fx-home-slot on"><span class="fx-home-t"><b>' + esc(x.titulo) + '</b> <small>Aparece grande no topo do Início dela</small></span><span class="fx-home-ac"><button type="button" class="btn" data-fx="homeDestaque" data-id="' + esc(String(x.ref)) + '">Tirar destaque</button></span></div>'
      : '<div class="fx-home-slot vazio"><span class="sub">Nenhum item em destaque. Use ★ Destacar num dos passos do Checklist abaixo.</span></div>') + '</section>';
}
async function fxHomeDestacar(ref) {
  var k = state.caso; if (!k || !Array.isArray(k.home) || k.homeSemDestaque) return toast('Falta rodar db/crm-caso-home-destaque.sql no Supabase (primeiro no teste).', 4600);
  var ja = (k.home || []).filter(function (h) { return h.categoria === 'checklist' && h.step_key === ref && h.destaque; })[0];
  var r = await supabase.rpc('crm_home_destacar', { p_contato: state.sel, p_step_key: ja ? null : ref });
  if (r.error) { var m = String(r.error.message || ''); if (/crm_home_destacar|schema cache|does not exist/i.test(m)) return toast('Falta rodar db/crm-caso-home-destaque.sql no Supabase (primeiro no teste).', 4600); if (/item_invalido/.test(m)) return toast('Esse passo não está na home. Adicione-o no Checklist primeiro.', 4200); return casoFalha('destacar na home', r.error); }
  await casoRecarrega(); fxPintaCorpo(); fxPintaPrevia();
  toast(ja ? 'Destaque retirado.' : 'Em destaque: ela vê esse item grande no topo do Início.');
}
function fxHomeCorpo(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var k = g.k;
  if (!Array.isArray(k.home)) return '<p class="sub" style="margin:0">A Página inicial ainda não está ligada: falta rodar <b>db/crm-caso-home.sql</b> no SQL Editor do Supabase (primeiro no teste, depois na produção).</p>';
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null;
  var itens = chk && !chk.err && !chk.semConta ? (chk.itens || []).filter(function (i) { return i.status !== 'arquivado'; }) : [];
  var d = FX.destaquesDaHome({ home: k.home, itens: itens, board: k.itens });
  var onde = { checklist: ['pílula Checklist', 'o “+” num passo, que entra no “Em seguida”', 'checklist'], so_seu: ['Espaço › Bilans ou Encaminhamentos', 'o “+” num bilan ou encaminhamento da Ingryd', 'espaco'], guias: ['pílula Guias', 'o “+” num documento ou mensagem pronta', 'guias'] };
  var bloco = function (cat) {
    var b = d[cat], linhas = b.itens.map(function (x) {
      return '<div class="fx-home-slot' + (x.destaque ? ' on' : '') + '"><span class="fx-home-t"><b>' + esc(x.titulo) + '</b>' + (x.meta ? ' <small>' + esc(x.meta) + '</small>' : '') +
        (x.falta ? ' ' + casoPil('o item não existe mais', 'u-media') : !x.publicado ? ' ' + casoPil('não publicado: ela só vê depois de publicar', 'u-media') : '') + '</span><span class="fx-home-ac">' + (cat === 'checklist' && !x.falta ? '<button type="button" class="btn fx-star' + (x.destaque ? ' on' : '') + '" data-fx="homeDestaque" data-id="' + esc(String(x.ref)) + '" aria-pressed="' + !!x.destaque + '" title="O item principal que aparece grande no topo do Início dela">★ ' + (x.destaque ? 'Em destaque' : 'Destacar') + '</button> ' : '') + casoBtn('home-del', cat + ':' + x.ref, 'Tirar') + '</span></div>';
    });
    for (var i = b.itens.length; i < b.max; i++) linhas.push('<div class="fx-home-slot vazio"><span class="sub">Espaço livre. Em <b>' + esc(onde[cat][0]) + '</b>, use ' + esc(onde[cat][1]) + '.</span><button type="button" class="link" data-fx="ir" data-id="' + onde[cat][2] + '">Ir para a sessão</button></div>');
    return '<section class="fx-home-bloco" aria-label="' + esc(FX.HOME_ROTULOS[cat]) + ' na home"><h4 class="fx-h4">' + esc(FX.HOME_ROTULOS[cat]) + ' <span class="sub">' + b.n + ' de ' + b.max + (b.n >= b.max ? ' · cheio' : '') + '</span></h4>' + linhas.join('') + '</section>';
  };
  return '<p class="sub" style="margin:0 0 14px;max-width:66ch">Ela vê isto no Início do app. O item em destaque aparece grande no topo; os passos do checklist entram primeiro no “Em seguida”; abaixo vêm “Só seu” e “Guias” (o que não está publicado fica fora até você publicar). Para trocar um item: tire aqui e escolha outro na pílula indicada.</p>' +
    fxHomeDestaqueBloco(d, k) + '<div class="fx-home-grade">' + bloco('checklist') + bloco('so_seu') + bloco('guias') + '</div>';
}
function fxOrdem() {
  var f = state.fx;
  return f.ord || { app: FX.SESSOES_PADRAO.app.slice(), ela: FX.SESSOES_PADRAO.ela.slice() };
}
// Fase 2: as sessões abaixo usam o mesmo caso (achados, ações, board, avisos, escolas) da aba Caso antiga. Carrega uma vez por pessoa;
// quando chega, pintaCaso() repinta o corpo. Sem db/crm-caso.sql, cada sessão avisa o que falta em vez de ficar em branco.
function fxCasoGuarda(c) {
  var k = state.caso;
  if (!k || k.cid !== c.id) { setTimeout(function () { carregaCaso(c.id); }, 0); return { html: '<div class="skel" aria-busy="true" style="height:64px"></div>' }; }
  if (k.err) return { html: '<p class="sub" style="margin:0">Caso ainda não ligado: falta rodar <b>db/crm-caso.sql</b> e <b>db/crm-caso-importar.sql</b> no SQL Editor do Supabase.</p>' };
  return { k: k };
}
function fxSemConsent(k) { return k.consent ? '' : '<p class="pill u-media" style="margin:0 0 10px">Sem consentimento de serviço: publicar e agendar ficam bloqueados.</p>'; }
// Perguntas da equipe: um card por vez, na ordem em que saem. O relógio abre a agenda de sempre (pausa em dias, data fixa às 9h de Paris, enviar agora)
// e dois cliques no texto editam. "Ordem e saída" lista todos com a data de cada um.
function fxPerLista(k) { return (k.avs || []).filter(function (a) { return a.estado !== 'cancelado'; }).sort(function (a, b) { return (a.ordem - b.ordem) || (a.id - b.id); }); }
function fxPerPendentes(k) { return fxPerLista(k).filter(function (a) { return (a.estado === 'rascunho' || a.estado === 'agendado') && !a.liberado_em; }); }
// Muda a ordem dos avisos que ainda não saíram: o banco (crm_aviso_reordenar) confere, troca só entre as vagas deles e recalcula as datas da fila.
async function fxPerReordenar(cid, ids, seguir) {
  var r = await supabase.rpc('crm_aviso_reordenar', { p_contato: cid, p_ids: ids });
  if (r.error) {
    var m = String(r.error.message || '');
    if (/crm_aviso_reordenar|schema cache|does not exist/i.test(m)) return toast('Falta rodar db/crm-aviso-reordenar.sql no SQL Editor do Supabase (primeiro no teste).', 4800);
    return casoFalha('mudar a ordem', r.error);
  }
  await casoRecarrega();
  var k = state.caso; if (k && seguir) { var n = fxPerLista(k).findIndex(function (x) { return String(x.id) === String(seguir); }); if (n >= 0) state.fx.carPerg = n; }
  fxPintaCorpo(); fxPintaPrevia();
}
function fxPerMover(id, delta) {
  var k = state.caso; if (!k) return; var ids = fxPerPendentes(k).map(function (x) { return String(x.id); }), i = ids.indexOf(String(id)), j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return; var x = ids.splice(i, 1)[0]; ids.splice(j, 0, x);
  return fxPerReordenar(state.sel, ids.map(Number), id);
}
function fxPerSoltar(de, para) {
  var k = state.caso; if (!k || String(de) === String(para)) return; var ids = fxPerPendentes(k).map(function (x) { return String(x.id); }), i = ids.indexOf(String(de)), j = ids.indexOf(String(para));
  if (i < 0 || j < 0) return; var x = ids.splice(i, 1)[0]; ids.splice(j, 0, x);
  return fxPerReordenar(state.sel, ids.map(Number), de);
}
var perArrasta = null;
document.addEventListener('dragstart', function (e) { var l = e.target.closest && e.target.closest('.fx-ordem-l.mexe'); if (!l) return; perArrasta = l.dataset.aid; l.classList.add('arrasta'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', perArrasta); } catch (x) { /* ok */ } });
document.addEventListener('dragover', function (e) { var l = e.target.closest && e.target.closest('.fx-ordem-l.mexe'); if (!l || !perArrasta) return; e.preventDefault(); document.querySelectorAll('.fx-ordem-l.sobre').forEach(function (x) { x.classList.remove('sobre'); }); l.classList.add('sobre'); });
document.addEventListener('drop', function (e) { var l = e.target.closest && e.target.closest('.fx-ordem-l.mexe'); if (!l || !perArrasta) return; e.preventDefault(); var de = perArrasta; perArrasta = null; fxPerSoltar(de, l.dataset.aid); });
document.addEventListener('dragend', function () { perArrasta = null; document.querySelectorAll('.fx-ordem-l.arrasta, .fx-ordem-l.sobre').forEach(function (x) { x.classList.remove('arrasta', 'sobre'); }); });
function fxPerCard(k, a, editavel) {
  if ((k.ed && k.ed.t === 'av' && k.ed.id === a.id) || k.agenda === a.id) return '<div class="fxp-card">' + casoAvisosHtml({ avs: [a], ed: k.ed, agenda: k.agenda }) + '</div>';
  var sp = a.tipo === 'pergunta' ? casoSeparaPergunta(a.titulo) : { p: a.titulo }, edita = a.tipo === 'pergunta' && editavel;
  return '<article class="fxp-big"' + (edita ? ' data-dbl="ed-av" data-id="' + esc(String(a.id)) + '" tabindex="0" title="Dois cliques (ou Enter) para editar"' : '') + '>' + esc(sp.p) + '</article>';
}
function fxPerAcoes(k, a, editavel) {
  if (!editavel || (k.ed && k.ed.t === 'av' && k.ed.id === a.id) || k.agenda === a.id) return '';
  var ritmo = a.estado === 'agendado' && !a.liberado_em ? casoMenu(casoRitmoBtns(Object.assign({ contato_id: k.cid }, a), filaDe(k.avs)[0] === a, '')) : '';
  return '<div class="fxp-ac">' + (a.estado === 'rascunho' ? fxCurBtn('ag-abrir', a.id, 'Aprovar e agendar', 1) : '') + (a.tipo === 'pergunta' ? fxCurBtn('ed-av', a.id, 'Editar') : '') + fxCurBtn('av-cancel', a.id, 'Cancelar') + ritmo + '</div>';
}
function fxPerguntasCarrossel(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var k = g.k, f = state.fx, avs = fxPerLista(k);
  if (!avs.length) return fxSemConsent(k) + casoProximaHtml(c, k) + '<div class="empty" style="padding:14px">Nenhuma pergunta da equipe ainda.</div>';
  var foco = k.ed && k.ed.t === 'av' ? k.ed.id : k.agenda, fi = avs.findIndex(function (x) { return x.id === foco; });
  if (fi >= 0) f.carPerg = fi;
  var i = Math.min(Math.max(0, f.carPerg || 0), avs.length - 1), a = avs[i], n = avs.length;
  var editavel = a.estado === 'rascunho' || a.estado === 'agendado';
  var pontos = avs.map(function (x, j) { return '<button type="button" class="fxp-pt" data-fx="perIr" data-v="' + j + '" aria-label="Card ' + (j + 1) + ': ' + esc(x.titulo) + '"' + (j === i ? ' aria-current="true"' : '') + '></button>'; }).join('');
  var relogio = editavel ? '<button type="button" class="fxp-relogio" data-caso="ag-abrir" data-id="' + esc(String(a.id)) + '" aria-label="Definir quando este card sai">' + casoSvg('clock', 18) + '<span>' + esc(casoQuando(a)) + '</span></button>' : '<span class="fxp-relogio off">' + casoSvg('clock', 18) + '<span>' + esc(casoQuando(a) || 'já saiu') + '</span></span>';
  var pend = fxPerPendentes(k), pendIds = pend.map(function (x) { return x.id; });
  var ordem = '<p class="sub" style="margin:0 0 8px">Arraste os cards que ainda não saíram, ou use ▲ ▼. Os que já saíram ficam onde estão.</p><div class="fx-ordem" id="fx-ordem">' + avs.map(function (x, j) {
    var mexe = pendIds.indexOf(x.id) >= 0, pi = pendIds.indexOf(x.id);
    return '<div class="fx-ordem-l' + (j === i ? ' on' : '') + (mexe ? ' mexe' : '') + '"' + (mexe ? ' draggable="true"' : '') + ' data-aid="' + esc(String(x.id)) + '">' +
      (mexe ? '<span class="fx-alca" aria-hidden="true" title="Arraste para mudar a ordem">⋮⋮</span>' : '<span class="fx-alca off" aria-hidden="true"></span>') +
      '<button type="button" class="fx-ordem-b" data-fx="perIr" data-v="' + j + '"><span class="fx-ordem-n">' + (j + 1) + '</span><span class="fx-ordem-t">' + esc(x.titulo) + '</span><small>' + esc(casoQuando(x) || 'já saiu') + '</small></button>' +
      (mexe ? '<span class="fx-mv"><button type="button" data-fx="perMov" data-id="' + esc(String(x.id)) + '" data-d="-1" aria-label="Subir"' + (pi === 0 ? ' disabled' : '') + '>▲</button><button type="button" data-fx="perMov" data-id="' + esc(String(x.id)) + '" data-d="1" aria-label="Descer"' + (pi === pendIds.length - 1 ? ' disabled' : '') + '>▼</button></span>' : '') + '</div>';
  }).join('') + '</div>';
  return fxSemConsent(k) + '<div class="fxp"><div class="fxp-top">' + fxCurChip(CASO_TIPO_AVISO[a.tipo] || a.tipo) + '<span class="sub">' + (i + 1) + ' de ' + n + '</span></div>' +
    '<div class="fxp-palco"><button type="button" class="fxp-seta" data-fx="perAnt" aria-label="Card anterior"' + (i === 0 ? ' disabled' : '') + '>‹</button>' + fxPerCard(k, a, editavel) +
    '<button type="button" class="fxp-seta" data-fx="perProx" aria-label="Próximo card"' + (i === n - 1 ? ' disabled' : '') + '>›</button></div>' +
    '<div class="fxp-pts">' + pontos + '</div><div class="fxp-rel">' + relogio + '</div>' + fxPerAcoes(k, a, editavel) + (a.tipo === 'pergunta' && editavel ? '<p class="sub" style="margin:8px 0 0;text-align:center">Dois cliques no texto para editar.</p>' : '') + '</div>' +
    fxSub('ordem', 'Ordem e saída · ' + n + ' cards', ordem);
}
// Subseção de uma sessão (aberta por padrão; lembra o que você fechou).
function fxSub(chave, titulo, corpo) {
  var o = state.fx.dd['sb-' + chave]; if (o === undefined) o = true;
  return '<details class="fx-sb" data-dd="sb-' + chave + '"' + (o ? ' open' : '') + '><summary><span>' + esc(titulo) + '</span></summary><div class="fx-sb-c">' + corpo + '</div></details>';
}
// O Espaço aqui segue o Início dela: você escolhe o que aparece em cada parte. Checklist (até 3 passos, entram no "Em seguida"), Só seu (o bilan e os
// encaminhamentos da Ingryd, até 3) e Guias (até 2); embaixo, a pergunta da equipe, que o app mostra sempre no fim do Início.
// Prazos e escolas não vão para a página inicial; ficam no fim, fechados, só para criar e publicar o que ela vê na aba Espaço do app.
function fxEspacoTudo(c) {
  var dd = state.fx.dd; if (dd['sb-prazos'] === undefined) dd['sb-prazos'] = false; if (dd['sb-ordem'] === undefined) dd['sb-ordem'] = false;
  var gk = fxCasoGuarda(c).k;
  return (gk && Array.isArray(gk.itens) ? casoAvisoRepetidos(gk) : '') + fxSub('perg', 'Perguntas da equipe Por Dentro', fxPerguntasCarrossel(c)) + fxSub('bil', 'Bilans das nossas conversas', fxEspacoBilans(c)) +
    fxSub('enc', 'Encaminhamentos da Ingryd', fxEspacoEncam(c)) + fxSub('msg', 'Mensagens prontas', fxEspacoMsgs(c)) + fxSub('prazos', 'Prazos e escolas (fora da página inicial)', fxEspacoCorpo(c)) + fxZonas(c, 'espaco');
}
function fxHomeAviso() { return '<p class="sub" style="margin:0">A Página inicial ainda não está ligada: falta rodar <b>db/crm-caso-home.sql</b> e <b>db/crm-caso-home-so-seu.sql</b> no SQL Editor do Supabase (primeiro no teste, depois na produção).</p>'; }
// Só o que cabe em cada parte: "Só seu" = bilan e documento que ela recebe; "Guias" = documento que ela recebe e mensagem pronta.
function fxKDe(k, tipos) { return Object.assign({}, k, { itens: k.itens.filter(function (it) { return tipos(it); }) }); }
// Itens do Espaço (bilans, encaminhamentos, mensagens prontas) como cards: título, etiquetas, estado e os botões à direita.
function fxEspItens(k, vazio, homeCat) {
  var lista = k.itens || [];
  if (!lista.length) return '<div class="fx-cf-vazio">' + esc(vazio) + '</div>';
  var temDoc = lista.some(function (x) { return x.tipo === 'documento' && (x.dados || {}).direcao === 'recebe'; });
  return lista.map(function (it) {
    if (k.ed && k.ed.t === 'item' && k.ed.id === it.id) return casoEditor('item', it.id, casoItemCampos(it));
    var meta = casoItemMeta(it), secs = it.tipo === 'bilan' ? ((it.dados || {}).secoes || []) : [], docRecebe = it.tipo === 'documento' && (it.dados || {}).direcao === 'recebe';
    var leit = secs.length ? '<details class="fxc-leit"><summary>Ler o bilan</summary>' + secs.map(function (sec) { return '<p><b>' + esc(sec.titulo) + '</b></p><ul>' + (sec.itens || []).map(function (x) { return '<li>' + esc(x.texto) + (x.estado === 'em_conferencia' ? ' <span class="sub">(a confirmar)</span>' : '') + '</li>'; }).join('') + '</ul>'; }).join('') + '</details>' : '';
    var pub = it.estado === 'publicado', est = '<span class="fxc-est' + (pub ? ' on' : '') + '"><i></i>' + (pub ? 'Publicado' : it.estado === 'revisado' ? 'Revisado' : 'Rascunho') + '</span>';
    var principal = it.estado === 'proposto' ? fxCurBtn('item-rev', it.id, 'Marcar como revisado') : it.estado === 'revisado' ? fxCurBtn('item-pub', it.id, 'Publicar para ela', 1) : fxCurBtn('item-ret', it.id, 'Despublicar');
    var excluir = k.confirmaDel === it.id ? fxCurBtn('item-del', it.id, pub ? 'Excluir (ela deixa de ver)' : 'Confirmar exclusão', 1) + fxCurBtn('cancelar', it.id, 'Não') : fxCurBtn('item-del-pede', it.id, 'Excluir');
    var ico = (docRecebe ? casoAnexarIco(it) : '') + casoHomeBtn(k, it, homeCat);
    return fxCurCard({ titulo: it.titulo, chips: (CUR_TIPO[it.tipo] ? fxCurChip(CUR_TIPO[it.tipo]) : '') + (meta ? fxCurChip(meta, 'est') : ''), extra: leit, acoes: est + principal + fxCurBtn('ed-item', it.id, 'Editar') + excluir + (ico ? '<span class="fxc-ico">' + ico + '</span>' : ''), dbl: ['ed-item', it.id] });
  }).join('');
}
function fxEspacoBilans(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var kk = fxKDe(g.k, function (it) { return it.tipo === 'bilan'; });
  return fxSemConsent(g.k) + '<p class="sub" style="margin:0 0 8px">Cada bilan resume uma conversa. Marque com “+” o que ela vê no “Só seu” do Início (até ' + FX.HOME_LIMITES.so_seu + ').</p>' +
    casoBarraNovo(g.k, ['bilan']) + fxEspItens(kk, 'Nenhum bilan ainda. Use “+ Bilan” para registrar a conversa.', 'so_seu');
}
function fxEspacoEncam(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var kk = fxKDe(g.k, function (it) { return it.tipo === 'documento' && (it.dados || {}).direcao === 'recebe'; });
  return fxSemConsent(g.k) + '<p class="sub" style="margin:0 0 8px">Documentos e links que você manda para ela. Marque com “+” o que ela vê no “Só seu” do Início.</p>' +
    casoBarraNovo(g.k, ['documento']) + fxEspItens(kk, 'Nenhum encaminhamento ainda. Use “+ Documento”.', 'so_seu');
}
function fxEspacoMsgs(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var kk = fxKDe(g.k, function (it) { return it.tipo === 'modelo'; });
  return fxSemConsent(g.k) + '<p class="sub" style="margin:0 0 8px">Mensagens prontas para ela copiar e usar. O destaque na Página inicial dos Guias é feito na pílula Guias.</p>' +
    casoBarraNovo(g.k, ['modelo']) + fxEspItens(kk, 'Nenhuma mensagem pronta ainda. Use “+ Mensagem pronta”.', 'nenhuma');
}
function fxEspacoGuias(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var kk = fxKDe(g.k, function (it) { return it.tipo === 'modelo' || (it.tipo === 'documento' && (it.dados || {}).direcao === 'recebe'); });
  return fxSemConsent(g.k) + '<p class="sub" style="margin:0 0 8px">Documentos e mensagens prontas. Marque com “+” o que ela vê em “Guias” no Início (até ' + FX.HOME_LIMITES.guias + ').</p>' +
    casoBarraNovo(g.k, ['modelo']) + fxEspItens(kk, 'Nada para ela em Guias ainda. Crie uma mensagem pronta acima ou use um documento dos Encaminhamentos.', 'guias');
}
function fxEspacoCorpo(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
    return fxSemConsent(g.k) +
    casoItensHtml(g.k, ['marco', 'escola'], 'Nada de prazo ou escola ainda. Leia a página do Notion no Onboarding para a IA propor.') + casoEscolasDelaHtml(g.k);
}
// Perfil: o que o Dossiê ainda não tem, para perguntar na call (o Dossiê é a aba ao lado).
function fxPerfilCorpo(c) {
  var d = state.dos && state.dos.cid === c.id ? state.dos : null;
  if (!d) return '<div class="skel" aria-busy="true" style="height:64px"></div>';
  var pr = dosProgresso(c, d.d, d.rasc), falta = [];
  dosVisiveis(c, d.d, d.rasc).forEach(function (b) { if (b.livre) return; b.campos.forEach(function (f) { if (dosValor(c, d.d, d.rasc, f.k) === '') falta.push(f.l); }); });
  return '<p class="sub" style="margin:0 0 8px"><b>' + pr.n + ' de ' + pr.tot + '</b> perguntas respondidas. Cada resposta ajuda a ajustar o que aparece para ela.</p>' +
    (falta.length ? '<ul class="fx-falta" style="margin:0 0 10px;padding-left:18px">' + falta.slice(0, 6).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' + (falta.length > 6 ? '<p class="sub" style="margin:0 0 8px">E mais ' + (falta.length - 6) + ' no Dossiê.</p>' : '') : '<p class="sub" style="margin:0 0 8px">Tudo respondido.</p>') +
    '<button type="button" class="btn" data-fx="tab" data-v="dossie">Abrir o Dossiê</button>';
}
// Só eu: o que é seu neste caso (nada aparece no app dela). As linhas dela, que você publica no Checklist, ficam em "Passos para ela".
function fxEuCorpo(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  // Só o que é para VOCÊ fazer. Os passos dela são revisados e publicados no Checklist (um lugar só); aqui nada se publica para ela.
  return '<p class="sub" style="margin:0 0 8px">Tarefas suas neste caso. Ela não vê nada daqui. Os passos dela ficam no Checklist.</p>' + casoAcoesHtml(g.k, 'ingryd');
}
// ---------- Panorama dela e O que ela trouxe (porte da Ficha-universo, com dados reais) ----------
// Lê o que ela acrescenta de público ao app: títulos que mudou, observações, datas, links, passos próprios e arquivados (checklist_items)
// e as escolas que ela adicionou (escolas_dela). Sem pasta do Drive, sem conteúdo de documentos e sem número pessoal (PN.limpa).
var H_PN = { esc: esc, quando: function (iso) { return iso ? fmtQuando(iso) : ''; } };
function fxPanoramaDados(c) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null, g = state.fx.coorte;
  if (!state.caso || state.caso.cid !== c.id) setTimeout(function () { carregaCaso(c.id); }, 0);
  var cv = state.pnConv && state.pnConv.cid === c.id ? state.pnConv.lista : [];
  return { nome: displayName(c), itens: chk && !chk.err && !chk.semConta ? (chk.itens || []) : [], escolas: k ? (k.escolasDela || []) : [], coorte: g && g.persona === personaKey(c) ? g.v : null, conversas: cv };
}
// As conversas lidas (montagens.proposta.panorama): o Panorama nasce delas e depois se mistura com o que ela faz no app. Só o panorama
// de cada leitura vem para cá (nada de bilan nem trecho); leituras descartadas ficam de fora. Vazio se o SQL da montagem não foi rodado.
async function fxCarregaConversas(c, forcar) {
  if (!forcar && state.pnConv && state.pnConv.cid === c.id) return;
  state.pnConv = { cid: c.id, lista: [], carregando: true };
  var r;
  try { r = await supabase.from('montagens').select('versao,estado,criado_em,proposta').eq('contato_id', c.id).neq('estado', 'descartada').order('versao', { ascending: true }); } catch (e) { r = { error: e }; }   // sem a tabela ou sem rede: o Panorama e o chat seguem como antes
  if (!state.pnConv || state.pnConv.cid !== c.id) return;
  var lista = r.error ? [] : (r.data || []).map(function (m) { return { versao: m.versao, quando: m.criado_em, p: m.proposta && m.proposta.panorama ? m.proposta.panorama : null, m: m.proposta && Array.isArray(m.proposta.mensagens_chat) ? m.proposta.mensagens_chat : [], e: m.proposta && m.proposta.bilan && m.proposta.bilan.email ? m.proposta.bilan.email : null }; });
  state.pnConv = { cid: c.id, lista: lista, carregando: false };
  if (state.sel === c.id && state.fx && state.fx.tab === 'plataforma' && fxSessaoAberta('sinais')) fxPintaCorpo();
}
// Os sinais que ela já mostrou e o que a Ingryd decidiu fazer com as sugestões: guardado neste navegador (não vai para o banco).
function fxSugsLidas(cid) { try { return JSON.parse(localStorage.getItem('crm_ficha_sugs_' + cid) || '{}') || {}; } catch (e) { return {}; } }
function fxSugGuarda(cid, id, v) { var m = fxSugsLidas(cid); m[id] = v; try { localStorage.setItem('crm_ficha_sugs_' + cid, JSON.stringify(m)); } catch (e) { /* sem localStorage */ } }
// O grupo: as pessoas da mesma persona que já têm conta, lido uma vez por persona. Menos de 3 pessoas = "poucos dados".
async function fxCarregaCoorte(c) {
  var f = state.fx, pk = personaKey(c);
  if (f.coorte && f.coorte.persona === pk) return;
  f.coorte = { persona: pk, v: null, carregando: true };
  var ids = C.filter(function (x) { return x.user_id && personaKey(x) === pk; }).map(function (x) { return x.user_id; }), linhas = [];
  if (ids.length >= 3) {
    var r = await supabase.from('checklist_items').select('user_id,step_key,category,label,status,titulo_custom,nota_custom,quando_custom').in('user_id', ids).limit(5000);
    if (r.error) r = await supabase.from('checklist_items').select('user_id,step_key,category,label,status').in('user_id', ids).limit(5000);   // sem as colunas novas
    linhas = r.data || [];
  }
  if (!state.fx.coorte || state.fx.coorte.persona !== pk) return;
  f.coorte = { persona: pk, v: PN.montaCoorte(linhas, ids), carregando: false };
  if (state.sel === c.id && f.tab === 'plataforma' && fxSessaoAberta('sinais')) fxPintaCorpo();
}
function fxSemSinais(c, titulo) {
  var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null;
  if (!chk) return '<div class="skel" aria-busy="true" style="height:64px"></div>';
  if (!c.user_id || chk.semConta) return '<p class="sub" style="margin:0">Ela ainda não entrou no app, então ainda não há o que ler aqui. ' + titulo + ' nasce do que ela edita, cria ou arquiva depois do primeiro acesso.</p>';
  if (chk.err) return '<p class="sub" style="margin:0">Falta rodar <b>db/crm-checklist.sql</b> no SQL Editor do Supabase.</p>';
  return '';
}
function fxSinaisCorpo(c) {
  setTimeout(function () { fxCarregaConversas(c); }, 0);
  var temConversa = state.pnConv && state.pnConv.cid === c.id && state.pnConv.lista.some(function (x) { return x.p; });
  var vazio = fxSemSinais(c, 'O Panorama'); if (vazio && !temConversa) return vazio;   // com conversa lida, o Panorama já existe mesmo sem conta no app
  setTimeout(function () { fxCarregaCoorte(c); }, 0);
  var d = fxPanoramaDados(c), a = PN.panorama(d), f = state.fx;
  return PN.htmlPanorama(a, PN.sugestoes(a), { tema: f.tema, dd: f.dd, sugs: fxSugsLidas(c.id), log: PN.logColetado(d), personaLabel: personaLabel(c), personaCurto: personaLabel(c), carregandoGrupo: !!(f.coorte && f.coorte.carregando) }, H_PN);
}
// O que ela trouxe: só o que ela mesma acrescentou e é público, por tipo. Sem pasta do Drive e sem dado pessoal.
function fxTrouxeCorpo(c) {
  var vazio = fxSemSinais(c, 'Esta sessão'); if (vazio) return vazio;
  return PN.htmlTrouxe(PN.panorama(fxPanoramaDados(c)), { dd: state.fx.dd }, H_PN);
}
// Criar o aviso sugerido como rascunho de Início (caso_avisos, tipo "inteligencia"): você decide a data depois, em Início.
async function fxSugCriaAviso(c, s) {
  var r = await supabase.from('caso_avisos').insert({ contato_id: c.id, tipo: s.aviso.tipo, titulo: s.aviso.tit.slice(0, 120), texto: s.aviso.txt.slice(0, 600), estado: 'rascunho', modo: 'apos_primeiro_acesso', dias_apos: 1 });
  if (r.error) return fail('criar o aviso', r.error);
  fxSugGuarda(c.id, s.id, 'aviso'); await casoRecarrega(); fxPintaCorpo(); toast('Aviso criado como rascunho em Início', 3000);
}
function fxSugAcao(ds) {
  var c = byC(state.sel); if (!c) return true;
  if (/^h-/.test(ds.id || '')) { fxSugGuarda(c.id, ds.id, ds.v === 'descartada' ? 'descartada' : 'confirmada'); fxPintaCorpo(); return true; }   // hipótese do Panorama: decisão guardada neste navegador
  var a = PN.panorama(fxPanoramaDados(c)), s = PN.sugestoes(a).filter(function (x) { return x.id === ds.id; })[0]; if (!s) return true;
  if (ds.v === 'aviso') return fxSugCriaAviso(c, s);
  fxSugGuarda(c.id, s.id, ds.v === 'descartada' ? 'descartada' : 'modelo'); fxPintaCorpo(); return true;
}
// "Escrever sobre isso": a mensagem entra pronta na caixa do chat dela, para você revisar antes de enviar.
function fxImpulso(id) {
  var c = byC(state.sel); if (!c) return true;
  var im = PN.panorama(fxPanoramaDados(c)).imp.filter(function (x) { return x.id === id; })[0]; if (!im) return true;
  state.chatRasc = im.msg; var f = state.fx; f.sessao = 'chat'; fxPintaCorpo();
  var tx = $('chat-txt'); if (tx) { if (tx.scrollIntoView) tx.scrollIntoView({ block: 'center' }); if (tx.focus) tx.focus(); }
  return true;
}
document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-dd]') && state.fx && state.fx.dd) state.fx.dd[d.dataset.dd] = d.open; }, true);
document.addEventListener('submit', function (e) { if (e.target && e.target.id === 'fx-add-form' && e.preventDefault) e.preventDefault(); });

// ---------- Zonas das sessões do app: "O que ela vê agora" e "O que ela faz" (só leitura, com dados reais) ----------
var FX_ZONAS = {
  inicio: { pode: ['Responder a pergunta da equipe', '“Agora não” (adia 3 dias)', 'Responder as perguntas rápidas do perfil, na mesma fila'], re: /abriu|respond|adi|assistente|in[ií]cio|pergunta/i },
  checklist: { pode: ['Marcar um passo', 'Editar título, data, observação e links', 'Adicionar um passo (+)', 'Arquivar e restaurar', 'Colar a pasta do Drive'], re: /marcou|desmarcou|edit|arquiv|adicion|restaur|checklist/i },
  espaco: { pode: ['Marcar Sim ou Não nos critérios da escola', 'Adicionar a própria escola (+)', 'Remover a escola que adicionou', 'Responder a pergunta da equipe'], re: /escola|crit[ée]rio|espa[cç]o|pergunta/i },
  guias: { pode: ['Abrir um guia', 'Ler o bilan', 'Abrir o documento', 'Copiar o texto da mensagem pronta', 'Ver a tradução'], re: /guia|bilan|arquivo|documento|mensagem/i },
  perfil: { pode: ['Editar o próprio perfil', 'Responder perguntas do assistente'], re: /perfil|dossi/i }
};
function fxVeAgora(c, id) {
  var v = fxPreviaDados(c), li = function (a) { return a.length ? '<ul class="fx-zl">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : ''; };
  if (id === 'inicio') {   // a sessão "Perguntas da equipe": o que ela vê no Espaço, em "Pergunta da equipe"
    var pq = v.esp.perguntas;
    return li([pq.length + (pq.length === 1 ? ' pergunta da equipe visível' : ' perguntas da equipe visíveis') + ' no dia ' + v.dia + (pq.length ? ': ' + pq.map(function (a) { return esc(a.titulo); }).join(' · ') : ''),
      'As perguntas rápidas do perfil entram na mesma fila, no Espaço (só o app sabe quais ainda faltam)', v.naoLidas ? v.naoLidas + (v.naoLidas === 1 ? ' recado' : ' recados') + ' no sino, ainda não lidos' : 'Nada pendente no sino']);
  }
  if (id === 'checklist') {
    var chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, it = chk && !chk.err && !chk.semConta ? PN.normaliza(chk.itens) : [], abertos = v.total - v.feitos;
    return li(['<b>' + v.total + ' passos</b> no app: ' + (v.total - it.filter(function (x) { return x.propria; }).length) + ' da persona e ' + it.filter(function (x) { return x.propria; }).length + ' criados por ela', v.pct + '% feito por ela · ' + abertos + (abertos === 1 ? ' aberto' : ' abertos'),
      'Pasta do Drive: só ela vê o link', it.filter(function (x) { return x.editado; }).length + ' passo(s) editado(s) por ela (veja no Panorama dela)', it.filter(function (x) { return x.arq; }).length ? it.filter(function (x) { return x.arq; }).length + ' arquivado(s) por ela' : 'Nenhum passo arquivado por ela']);
  }
  if (id === 'espaco') {
    var it2 = v.espaco.marcos.map(function (m) { return 'Prazo: <b>' + esc(m.titulo) + '</b>'; }).concat(v.espaco.escolas.map(function (x) { return 'Escola: <b>' + esc(x.titulo) + '</b>'; }), v.espaco.dela.map(function (x) { return 'Escola dela: <b>' + esc(x.nome) + '</b>'; }));
    return it2.length ? li(it2) : '<p class="nota">Nada publicado ainda: ela vê “Ainda não tem nada seu aqui”.</p>';
  }
  if (id === 'guias') return li(['Bilans das nossas conversas: ' + (v.guias.bilan ? '<b>1 publicado</b>' : 'em breve'), 'Documentos que a equipe manda: ' + (v.guias.docs.length ? '<b>' + v.guias.docs.length + ' publicado' + (v.guias.docs.length > 1 ? 's' : '') + '</b>' : 'em breve'), 'Mensagens prontas: ' + (v.guias.msgs.length ? '<b>' + v.guias.msgs.length + ' publicada' + (v.guias.msgs.length > 1 ? 's' : '') + '</b>' : 'em breve')]);
  return li([v.perfil.n + ' de ' + v.perfil.tot + ' perguntas respondidas'].concat(v.perfil.kv.filter(function (x) { return x[1]; }).map(function (x) { return esc(x[0]) + ': <b>' + esc(x[1]) + '</b>'; })));
}
function fxJaFez(c, re) {
  var cli = state.int && state.int.cid === c.id && !state.int.err ? state.int.cliques || [] : [];
  var r = cli.filter(function (x) { return re.test(String(x.rotulo || '') + ' ' + telaNome(x.tela || '')); }).slice(0, 3);
  return r.length ? '<ul class="fx-zl">' + r.map(function (x) { return '<li>' + esc(x.alvo === 'tela' ? 'Abriu ' + telaNome(x.tela) : (x.rotulo || '(sem texto)')) + ' <span class="nota">· ' + esc(fmtQuando(x.criado_em)) + '</span></li>'; }).join('') + '</ul>' : '<p class="nota">Ela ainda não fez nada aqui.</p>';
}
function fxZonas(c, id) {
  var z = FX_ZONAS[id]; if (!z) return '';
  var det = function (cls, titulo, sub, corpo, aberto) {
    var o = state.fx.dd['z-' + id + cls]; if (o === undefined) o = aberto;
    return '<details class="fx-z fx-z-' + cls + '" data-dd="z-' + id + cls + '"' + (o ? ' open' : '') + '><summary><span>' + titulo + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</summary>' + corpo + '</details>';
  };
  return '<div class="fx-zonas">' + det('ve', 'O que ela vê agora', 'o mesmo que a prévia ao lado', fxVeAgora(c, id), false) +
    det('ela', 'O que ela faz aqui', 'só consulta', '<p class="nota"><b>O que ela pode fazer no app</b></p><div class="fx-pode">' + z.pode.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</div><p class="nota" style="margin-top:10px"><b>O que ela já fez aqui</b></p>' + fxJaFez(c, z.re), false) + '</div>';
}
// Mais detalhes: o que é da persona (igual para quem tem a mesma situação) e o que é só dela.
function fxMaisCorpo(c) {
  var g = fxCasoGuarda(c); if (!g.k) return g.html;
  var k = g.k, chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null, d = state.dos && state.dos.cid === c.id ? state.dos : null, pr = d ? dosProgresso(c, d.d, d.rasc) : null;
  var pub = k.itens.filter(function (x) { return x.estado === 'publicado'; }).length;
  return '<p class="sub" style="margin:0 0 8px">O app dela tem duas camadas: a da persona vem pronta; a dela você constrói conversando.</p>' +
    casoSecao('Persona', personaLabel(c), kvHtml([['Passos no checklist', chk && !chk.err && !chk.semConta ? String(chk.itens.length) : '—'], ['Perguntas no Dossiê', pr ? String(pr.tot) : '—']])) +
    casoSecao('Só dela', pn(c), kvHtml([['Respostas no Dossiê', pr ? pr.n + ' de ' + pr.tot : '—'], ['Achados da conversa', String(k.ach.length)], ['Ações', String(k.aco.length)],
      ['Itens do board publicados', pub + ' de ' + k.itens.length], ['Avisos', String(k.avs.length)], ['Escolas que ela acrescentou', String((k.escolasDela || []).length)]]));
}
// Prévia do app dela com dados reais (só leitura). O dia simula quando cada aviso agendado chega, somando as pausas em ordem.
function fxPreviaDados(c) {
  var f = state.fx, k = state.caso && state.caso.cid === c.id && !state.caso.err ? state.caso : null, chk = state.dos && state.dos.cid === c.id ? state.dos.chk : null;
  var ok = chk && !chk.err && !chk.semConta, hoje = new Date().toISOString().slice(0, 10), dia = f.dia == null ? 1 : f.dia;
  // A conta vem de FX.contaChecklistApp: a mesma regra do app (itens + ações publicadas, só na aba principal), para o número bater com o dela.
  var cnt = FX.contaChecklistApp({ mapa: FX_PROC, persona: personaKey(c), itens: ok ? chk.itens : [], acoes: k ? k.aco : [], listas: k ? k.listas : [], dem: f.dem || 'todas' });
  var itens = cnt.itens, feitos = itens.filter(function (i) { return i.status === 'concluido'; });
  var abertos = itens.filter(function (i) { return i.status !== 'concluido'; }).sort(function (a, b) { return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1; });
  var pub = function (tipos) { return k ? k.itens.filter(function (x) { return x.estado === 'publicado' && tipos.indexOf(x.tipo) >= 0; }) : []; };
  var marcos = pub(['marco']).map(function (x) { return { titulo: x.titulo, resumo: x.resumo, data: x.dados && x.dados.data }; });
  var m = marcos.filter(function (x) { return x.data; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; })[0];
  // Os passos que a montagem propôs: os publicados já contam como passos dela (é o que o app mostra); os rascunhos aparecem à parte, esmaecidos.
  var det = function (a) { var n = (a.subitens || []).length; return [a.demarche ? FX.rotuloDemarche(FX_PROC, a.demarche, personaKey(c)) : '', n ? n + (n === 1 ? ' subitem' : ' subitens') : ''].filter(Boolean).join(' · '); };
  var prop = k ? k.aco.filter(function (a) { return a.dono === 'ela' && a.canal === 'plataforma' && /^(enc|chk):/.test(a.origem_chave || '') && a.estado !== 'recusada' && a.estado !== 'concluida'; }) : [];
  var pubP = cnt.passos.map(function (a) { return { label: a.titulo, tag: det(a), feito: a.estado === 'concluida', due: a.prazo, atrasado: !!(a.prazo && a.prazo < hoje && a.estado !== 'concluida') }; });
  var rascP = prop.filter(function (a) { return !a.publicada_em; }).map(function (a) { return { label: a.titulo, tag: det(a), conferir: !!a.a_conferir, due: a.prazo }; });
  var acum = 0, avisos = [];
  if (k) filaDe(k.avs).concat([]).forEach(function (a) { acum += a.pausa_dias || 0; if (acum <= dia) avisos.push({ tipo: CASO_TIPO_AVISO[a.tipo] || a.tipo, titulo: a.titulo, texto: a.texto, cru: a.tipo, estado: 'liberado' }); });
  if (k) k.avs.filter(function (a) { return a.liberado_em && (a.estado === 'liberado' || a.estado === 'lido'); }).forEach(function (a) { avisos.unshift({ tipo: CASO_TIPO_AVISO[a.tipo] || a.tipo, titulo: a.titulo, texto: a.texto, cru: a.tipo, estado: a.estado }); });
  var dd = state.dos && state.dos.cid === c.id ? state.dos : null, pr = dd ? dosProgresso(c, dd.d, dd.rasc) : { n: 0, tot: 0 };
  var feitosN = cnt.feitos, totalN = cnt.total;
  // O Início e o Espaço, montados pela mesma regra do app (FX.inicioDoApp / FX.espacoDoApp).
  var boardPub = k ? k.itens.filter(function (x) { return x.estado === 'publicado'; }) : [];
  var inicio = FX.inicioDoApp({ nome: String(pn(c) || '').trim().split(/\s+/)[0], mapa: FX_PROC, persona: personaKey(c), itens: ok ? chk.itens : [], board: boardPub, acoes: k ? k.aco : [], listas: k ? k.listas : [], home: k && Array.isArray(k.home) ? k.home : [], quando: FX_QUANDO || {} });
  var esp = FX.espacoDoApp({ board: boardPub, avisos: avisos.map(function (a) { return { tipo: a.cru, titulo: a.titulo, texto: a.texto, estado: a.estado }; }), escolasDela: k ? (k.escolasDela || []) : [] });
  var passosL = abertos.map(function (i) { return { label: i.label, tag: i.category, feito: false, due: i.due_date, atrasado: !!(i.due_date && i.due_date < hoje) }; }).concat(pubP.filter(function (x) { return !x.feito; }));
  var feitosL = feitos.map(function (i) { return { label: i.label, tag: i.category, feito: true, due: i.due_date, atrasado: false }; }).concat(pubP.filter(function (x) { return x.feito; }));
  return { nome: pn(c), semConta: !c.user_id, aba: f.appAba || 'inicio', dia: dia, camadas: !!f.camadas, pct: totalN ? Math.round(feitosN / totalN * 100) : 0, feitos: feitosN, total: totalN, rascunhos: rascP,
    naoLidas: chatNaoLidas(state.chat), marco: m ? { titulo: m.titulo, dias: diasAteIso(m.data), data: m.data } : null, prox: passosL[0] ? { label: passosL[0].label, due: passosL[0].due } : null, avisos: avisos,
    inicio: inicio, esp: esp, passos: passosL.concat(feitosL),
    espaco: { marcos: marcos, escolas: pub(['escola']).map(function (x) { return { titulo: x.titulo, resumo: x.resumo }; }), dela: k ? (k.escolasDela || []).map(function (x) { return { nome: x.nome }; }) : [] },
    guias: { bilan: pub(['bilan']).length > 0, docs: pub(['documento']).filter(function (x) { return x.dados && x.dados.direcao === 'recebe'; }).map(function (x) { return { titulo: x.titulo, resumo: x.resumo }; }), msgs: pub(['modelo']).map(function (x) { return { titulo: x.titulo }; }) },
    perfil: { n: pr.n, tot: pr.tot, kv: [['Situação', personaLabel(c)], ['Cidade', (dd && dosValor(c, dd.d, dd.rasc, 'cidade')) || ''], ['Fase', (dd && dosValor(c, dd.d, dd.rasc, 'fase')) || '']] } };
}
function fxPreviaHtml(c) {
  if (!state.caso || state.caso.cid !== c.id) setTimeout(function () { carregaCaso(c.id); }, 0);
  return FH.htmlPreviaApp(fxPreviaDados(c), H_FX);
}
function fxPintaPrevia() { var c = byC(state.sel), b = $('fx-previa'); if (c && b) b.innerHTML = fxPreviaHtml(fxContato(c, state.fx.dados && state.fx.dados.uid)); }
// ---------- Dossiê: a visão geral (a janela-mãe da pessoa) ----------
// Junta o que as bases já sabem dela (cadastro, quizzes das páginas de entrada, e-mails, perguntas, artigos, 1:1, app, o que a chamada trouxe),
// mostra onde as fontes batem ou divergem e diz como completar o que falta. Tudo por regra: nada inventado.
var DOS_CANAL_DOC = { numero_secu: 1, comprovante_endereco: 1, documento_vencimento: 1, certificado_frances_qual: 1 };
var DOS_CANAL_APP = { moradia_resolvida: 1, conta_resolvida: 1, securite_resolvida: 1, conta_anef: 1, tem_certificado_matricula: 1, comprova_recursos: 1, tem_sponsor: 1 };
function dosRotuloOpcao(f, v) {
  var o = f && f.o ? f.o.filter(function (x) { return x[0] === String(v); })[0] : null;
  return o ? o[1] : (v === 'true' ? 'Sim' : v === 'false' ? 'Não' : String(v));
}
// Onde as fontes batem: o que o funil disse x o que está no dossiê; o que veio só do funil; o que a chamada trouxe.
// Divergência entre o funil e o dossiê: "Manter o do dossiê" fica guardado neste navegador (some da lista); "Usar o do funil" troca o valor (salve o dossiê).
function dosDivResolvida(cid, k) { try { return !!(JSON.parse(localStorage.getItem('crm_dos_div_' + cid) || '{}') || {})[k]; } catch (e) { return false; } }
function dosDivGuarda(cid, k) { try { var m = JSON.parse(localStorage.getItem('crm_dos_div_' + cid) || '{}') || {}; m[k] = 1; localStorage.setItem('crm_dos_div_' + cid, JSON.stringify(m)); } catch (e) { /* sem localStorage */ } }
function dosCruzamentos(c, S) {
  var out = { confere: [], diverge: [], soFunil: [], daChamada: [] };
  if (!S) return out;
  dosVisiveis(c, S.d, S.rasc).forEach(function (b) {
    b.campos.forEach(function (f) {
      var fun = dosDoFunil(c, f.k), sv = (S.d || {})[f.k], salvo = sv === undefined || sv === null || sv === '' ? null : String(sv);
      var org = salvo === null ? null : onbOrigemDe(f.k, salvo);
      if (org) out.daChamada.push({ l: f.l, v: dosRotuloOpcao(f, salvo), conf: org.conf, origem: org.origem });
      if (fun !== null && salvo !== null) ((String(fun) === salvo || dosDivResolvida(c.id, f.k)) ? out.confere : out.diverge).push({ k: f.k, l: f.l, funil: dosRotuloOpcao(f, fun), dossie: dosRotuloOpcao(f, salvo) });
      else if (fun !== null && salvo === null) out.soFunil.push({ l: f.l, v: dosRotuloOpcao(f, fun) });
    });
  });
  return out;
}
// O que falta, por jeito de completar: perguntar numa conversa, ela completar no app, ou pedir o documento.
function dosFaltaPorCanal(c, S) {
  var out = { conversa: [], app: [], doc: [] };
  if (!S) return out;
  dosVisiveis(c, S.d, S.rasc).forEach(function (b) {
    if (b.livre) return;
    b.campos.forEach(function (f) {
      if (dosValor(c, S.d, S.rasc, f.k) !== '') return;
      (DOS_CANAL_DOC[f.k] ? out.doc : DOS_CANAL_APP[f.k] && c.user_id ? out.app : out.conversa).push(f);
    });
  });
  return out;
}
function dosMensagemTexto(c, campos, doc) {
  var qs = campos.slice(0, 5).map(function (f) { return '• ' + f.l + (doc ? '' : '?'); }).join('\n');
  return doc ? 'Oi ' + pn(c) + '! Um lembrete para não se perder nas démarches. Guarde na pasta certa do seu Drive:\n' + qs + '\n\nDepois cole o link fechado da pasta no app e dê o check no passo. Qualquer dúvida é só falar.'
    : 'Oi ' + pn(c) + '! Para eu te ajudar melhor, me conta rapidinho:\n' + qs + '\n\nPode responder por aqui mesmo.';
}
function dosMontaMensagem(cid, tipo) {
  var c = byC(cid), falta = c && dosFaltaPorCanal(c, state.dos && state.dos.cid === c.id ? state.dos : null); if (!c || !falta) return;
  var campos = tipo === 'doc' ? falta.doc : falta.conversa, txt = dosMensagemTexto(c, campos, tipo === 'doc');
  if (c.user_id) {   // já está na plataforma: a mensagem vai para o chat do app
    state.chatRasc = txt; var f = state.fx; f.tab = 'plataforma'; f.hd = null; f.sessao = 'chat'; fxRepinta();
    setTimeout(function () { var tx = $('chat-txt'); if (tx) { tx.value = txt; tx.focus(); } }, 0);
  } else { state.rascunho[cid] = txt; openPessoa(cid, 'conversa'); }
}
function dosFonteTag(c, S, k) {
  var sv = S && S.d ? S.d[k] : null;
  if (sv !== undefined && sv !== null && sv !== '') return onbOrigemDe(k, String(sv)) ? 'chamada' : 'dossiê';
  return dosDoFunil(c, k) !== null ? 'funil' : '';
}
// ---------- Registro dos 1:1 (Dossiê · visão geral) ----------
// Cada 1:1 é um toggle com o código da página de onde ela veio. IL05 = "inbound lead" da página I05: só o rótulo muda, o código guardado continua I05.
var R1_INTERESSE = [['', 'Ainda não sei'], ['sim', 'Sim, quer o link'], ['talvez', 'Talvez, pensando'], ['nao', 'Não por agora']];
function r1Codigo(c, u) {
  var reg = u && u.registro && typeof u.registro === 'object' ? u.registro : {}, o = reg.origem || ORIGEM_PAGINA[ultimaOrigem(c)] || '';
  return /^I0\d$/.test(o) ? o : '';
}
function r1Rotulo(cod) { return cod ? cod.replace(/^I/, 'IL') : ''; }
// O roteiro que valia para este 1:1: o que ficou salvo no registro; sem registro, o que ainda falta perguntar por conversa.
function r1Roteiro(c, u, S) {
  var reg = u.registro && typeof u.registro === 'object' ? u.registro : null;
  if (reg && Array.isArray(reg.perguntas) && reg.perguntas.length) return { salvo: true, qs: reg.perguntas.filter(function (q) { return q && q.k; }) };
  var F = dosFaltaPorCanal(c, S);
  return { salvo: false, qs: F.conversa.map(function (f) { return { k: f.k, l: f.l }; }) };
}
function r1Resposta(c, S, k) { return S ? dosValor(c, S.d, S.rasc, k) : ''; }
function r1Html(c, S) {
  var lista = UM.filter(function (x) { return x.contato_id === c.id && x.status !== 'cancelado'; }).sort(function (a, b) { return String(a.quando || '9').localeCompare(String(b.quando || '9')); });
  var corpo;
  if (!lista.length) corpo = '<p class="sub" style="margin:0">Nenhum 1:1 marcado ou feito ainda. Quando ela marcar, ele aparece aqui, com o roteiro e o que você registrar.</p>';
  else corpo = '<div class="r1-lista">' + lista.map(function (u) {
    var cod = r1Rotulo(r1Codigo(c, u)), aberto = state.fx.r1 === String(u.id), passou = u.status === 'feito' || (u.quando && new Date(u.quando).getTime() < Date.now() - 36e5);
    var reg = u.registro && typeof u.registro === 'object' ? u.registro : {};
    var estado = reg.conclusao || reg.encaminhamento ? 'registrado' : passou ? 'feito, sem registro' : 'marcado';
    var pg = PAG1A1.filter(function (p) { return p.um_a_um_id != null && String(p.um_a_um_id) === String(u.id); })[0];
    if (pg) estado += ' · pago (' + pg.minutos + ' min)';
    return '<button type="button" class="r1-tg' + (aberto ? ' on' : '') + '" data-r1="' + esc(u.id) + '" aria-expanded="' + (aberto ? 'true' : 'false') + '">' +
      (cod ? '<b class="r1-cod">' + esc(cod) + '</b>' : '') + '<span>1:1 ' + (u.quando ? 'de ' + esc(fmtDate(u.quando)) + ' ' + esc(fmtHora(u.quando)) : 'sem data') + '</span><i class="dv-fonte">' + esc(estado) + '</i></button>';
  }).join('') + '</div>' + r1PainelHtml(c, S, lista.filter(function (u) { return String(u.id) === state.fx.r1; })[0]);
  return '<div class="dv-sec" id="dos-1a1"><div class="k">Registro dos 1:1</div>' + corpo + '</div>';
}
function r1PainelHtml(c, S, u) {
  if (!u) return '';
  var reg = u.registro && typeof u.registro === 'object' ? u.registro : {}, R = r1Roteiro(c, u, S), cod = r1Codigo(c, u);
  var ident = R.qs.filter(function (q) { return r1Resposta(c, S, q.k) !== ''; });
  var item = function (q) { var v = r1Resposta(c, S, q.k), f = dosCampo(q.k); return '<li' + (v !== '' ? ' class="ok"' : '') + '>' + (v !== '' ? '✓ ' : '') + esc(q.l) + (v !== '' ? ': <b>' + esc(f ? dosRotuloOpcao(f, v) : v) + '</b>' : '') + '</li>'; };
  var b1 = '<div class="r1-b"><div class="k">Perguntas do roteiro</div>' + (R.qs.length ? '<ol class="dv-ol">' + R.qs.map(function (q) { return '<li>' + esc(q.l) + '</li>'; }).join('') + '</ol>' : '<p class="sub" style="margin:0">Nada a perguntar: o dossiê já está completo.</p>') +
    (R.salvo ? '' : '<p class="sub" style="margin:6px 0 0">Ainda não fixado: é o que falta hoje. “Salvar registro” fixa esta lista como o roteiro deste 1:1.</p>') + '</div>';
  var b2 = '<div class="r1-b"><div class="k">Identificadas</div><p class="r1-n"><b>' + ident.length + '</b> de ' + R.qs.length + '</p>' +
    (R.qs.length ? '<ul class="dv-ul r1-ul">' + R.qs.map(item).join('') + '</ul>' : '') + '</div>';
  var b3 = '<div class="r1-b"><div class="k">Conclusão e encaminhamento</div>' +
    '<label class="r1-f">Conclusão<textarea id="r1-conc" rows="3" maxlength="1500" placeholder="Em uma ou duas frases: qual é o caso dela.">' + esc(reg.conclusao || '') + '</textarea></label>' +
    '<label class="r1-f">Encaminhamento<textarea id="r1-enc" rows="2" maxlength="1500" placeholder="O próximo passo combinado.">' + esc(reg.encaminhamento || '') + '</textarea></label>' +
    '<label class="r1-f">Interesse em converter<select id="r1-int">' + R1_INTERESSE.map(function (o) { return '<option value="' + o[0] + '"' + ((reg.interesse || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
    '<label class="r1-c"><input type="checkbox" id="r1-link"' + (reg.link_enviado ? ' checked' : '') + '> Link do produto enviado' + (reg.link_enviado && reg.link_enviado_em ? ' em ' + esc(fmtDate(reg.link_enviado_em)) : '') + '</label>' +
    '<button type="button" class="btn primary" data-r1save="' + esc(u.id) + '">Salvar registro</button></div>';
  return '<div class="r1-painel" id="r1-p" data-origem="' + esc(cod) + '">' + b1 + b2 + b3 + '</div>';
}
async function r1Salvar(id) {
  var u = UM.filter(function (x) { return String(x.id) === String(id); })[0], c = u && byC(u.contato_id); if (!u || !c) return;
  var S = state.dos && state.dos.cid === c.id && state.dos.d ? state.dos : null, R = r1Roteiro(c, u, S), ant = u.registro && typeof u.registro === 'object' ? u.registro : {};
  var interesse = $('r1-int') ? $('r1-int').value : '', link = !!($('r1-link') && $('r1-link').checked);
  var reg = Object.assign({}, ant, {
    origem: r1Codigo(c, u) || null, perguntas: R.qs,
    identificadas: R.qs.filter(function (q) { return r1Resposta(c, S, q.k) !== ''; }).map(function (q) { return q.k; }),
    conclusao: ($('r1-conc') ? $('r1-conc').value : '').trim().slice(0, 1500), encaminhamento: ($('r1-enc') ? $('r1-enc').value : '').trim().slice(0, 1500),
    interesse: interesse || null, link_enviado: link, link_enviado_em: link ? (ant.link_enviado_em || new Date().toISOString()) : null, atualizado_em: new Date().toISOString()
  });
  var o = await supabase.from('um_a_um').update({ registro: reg }).eq('id', u.id);
  if (o.error) return toast(/registro/.test(String(o.error.message || '')) ? 'Rode primeiro db/crm-1a1-registro.sql no Supabase.' : 'Não salvou: ' + o.error.message, 5000);
  u.registro = reg; toast('Registro salvo.'); fxRepinta();
}
// ---------- A ligação, no topo do Dossiê: antes (contexto, o que ela já deu, o que perguntar), durante (registro) e depois (ler a call, bilan, e-mail, .md) ----------
function dosMdTexto(c, S) {
  var dv = function (k) { return S ? dosValor(c, S.d, S.rasc, k) : ''; }, B = state.bilan && state.bilan.cid === c.id ? state.bilan : null, L = [];
  var quando = dv('ligacao_data');
  L.push('# Bilan da conversa: ' + (c.nome || c.email || ''), '', (quando ? 'Data da ligação: ' + fmtDay(quando) + '\n' : '') + 'Situação: ' + personaLabel(c) + (subLabel(c) ? ' · ' + subLabel(c) : ''), '');
  var feito = [];
  if (S) dosVisiveis(c, S.d, S.rasc).forEach(function (b) { if (b.livre) return; b.campos.forEach(function (f) { var v = dv(f.k); if (v !== '') feito.push('- ' + f.l + ': ' + dosRotuloOpcao(f, v)); }); });
  L.push('## O que ela informou', '', feito.length ? feito.join('\n') : '_Nada registrado._', '');
  L.push('## Resumo da conversa', '', dv('ligacao_resumo') || '_Sem resumo._', '');
  var passos = String(dv('proximos_passos') || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  L.push('## Encaminhamentos', '', passos.length ? passos.map(function (x) { return '- [ ] ' + x.replace(/^[-•*]\s*/, ''); }).join('\n') : '_Nenhum registrado._', '');
  if (B) L.push('_Leitura do Notion de ' + fmtDay(String(B.quando || '').slice(0, 10)) + '._', '');
  return L.join('\n');
}
function dosBaixaMd(cid) {
  var c = byC(cid); if (!c) return;
  var S = state.dos && state.dos.cid === c.id && state.dos.d ? state.dos : null, txt = dosMdTexto(c, S);
  var nome = 'bilan-' + String(c.nome || 'pessoa').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.md';
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/markdown;charset=utf-8' })); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  toast('Arquivo ' + nome + ' baixado');
}
// Os dropdowns da sessão "A ligação" (o grande e os três passos): lembram o que você deixou aberto.
function lgAberto(k) { var g = state.fx.lg || { main: 1, a: 1 }; return !!g[k]; }
document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-lg]')) { var g = state.fx.lg || (state.fx.lg = { main: 1, a: 1 }); if (d.open) g[d.dataset.lg] = 1; else delete g[d.dataset.lg]; } }, true);
function dosLigacaoHtml(c, d, formHtml) {
  var S = state.dos && state.dos.cid === c.id && state.dos.d ? state.dos : null; if (!S) return '';
  var dv = function (k) { return dosValor(c, S.d, S.rasc, k); }, F = dosFaltaPorCanal(c, S), X = dosCruzamentos(c, S), nFalta = F.conversa.length + F.app.length + F.doc.length;
  var campo = function (k) { var f = dosCampo(k); return f ? dosCampoHtml(f, c, S.d, S.rasc) : ''; };
  var B = state.bilan && state.bilan.cid === c.id ? state.bilan : null, enviado = (d.mails || []).filter(function (m) { return m.modelo === 'bilan_conversa' || m.modelo === 'conversa_convite'; })[0], enviadoConv = (d.mails || []).filter(function (m) { return m.modelo === 'conversa_convite'; })[0];
  var col = function (t, n, corpo) { return '<div class="dv-card"><div class="k">' + esc(t) + (n != null ? ' · ' + n : '') + '</div>' + corpo + '</div>'; };
  var p1 = dosPerguntarHtml(c, S) || '<p class="sub" style="margin:0">Nada a perguntar.</p>';
  var pcs = pcEstado(c.id), notionLido = !!(pcs.notionAplicada || pcs.notionMsg || pcs.notionUrl);
  // Um toggle só: ler a conversa, ver o resumo e os encaminhamentos e, recolhido, editar o registro (resumo, passos, data, transcrição).
  // O texto editável fica uma vez só, dentro do "Editar o registro"; a visão de cima é a mesma informação, só mais legível.
  var pAn = '<div id="pc-an"><div id="pc-topo">' + pcTopoHtml(c) + '</div><div id="pc-quadros">' + pcQuadrosHtml(c) + '</div>' +
    '<details class="lg-edit" data-lg="e"' + (lgAberto('e') ? ' open' : '') + '><summary>Editar o registro (resumo, passos, data e transcrição)</summary><div class="lg-corpo">' +
    '<div class="dgrid lg-form">' + campo('ligacao_resumo') + campo('proximos_passos') + '</div>' +
    '<div class="dgrid lg-form">' + campo('ligacao_data') + campo('ligacao_transcricao') + '</div>' +
    '<div class="actions" style="margin-top:6px"><button class="btn primary" type="button" data-dossalvar="' + esc(c.id) + '">Salvar dossiê</button></div></div></details>' +
    (pcs.estado === 'proposta' || pcs.notionAplicada
      ? '<details class="lg-det" data-lg="leitura"' + (lgAberto('leitura') ? ' open' : '') + '><summary>Detalhes da leitura: fatos, pendências, lembretes e e-mail</summary><div id="poscall-box">' + poscallHtml(c, (pcEstado(c.id).fixo = true)) + '</div></details>'
      : '<div id="poscall-box">' + poscallHtml(c, (pcEstado(c.id).fixo = true)) + '</div>') + '</div>';
  var pMont = montHtml(c);
  var p3 = '<div class="lg-saidas">' +
    '<div class="dv-card"><div class="k">E-mail para ela</div><p class="sub" style="margin:0 0 8px">O rascunho junta o que foi conversado, o que ela faz, o que você faz e o convite para o espaço dela no <b>Por Dentro das Démarches</b> (um lugar só dela, com todas as démarches e o próximo passo). Você revisa e só sai com o seu “pode enviar”.' +
    (enviadoConv ? ' <b>Enviado em ' + esc(fmtDay(String(enviadoConv.enviado_em || enviadoConv.criado_em || '').slice(0, 10))) + '.</b>' : '') + '</p>' +
    '<button type="button" class="btn primary" data-convabrir="' + esc(c.id) + '">' + (enviadoConv ? 'Fazer novo rascunho' : 'Fazer rascunho') + '</button></div>' +
    '<div class="dv-card"><div class="k">Arquivo para o seu sistema</div><p class="sub" style="margin:0 0 8px">Um .md com o que ela informou, o resumo e os encaminhamentos em lista de tarefas.</p><button type="button" class="btn" data-dosmd="' + esc(c.id) + '">Baixar o .md</button></div></div>';
  // Três etapas, uma por vez (sem rolar): antes da ligação; depois do 1:1 (a análise e a montagem juntas); o que sai da conversa.
  var ps = state.fx.lgPasso || 'a', mp = state.mont && state.mont.cid === c.id ? state.mont : null;
  var resB = (mp && mp.estado === 'aplicado') ? 'montagem aprovada' : (mp && mp.estado === 'proposta') ? 'montagem para revisar' : (notionLido || pcs.estado === 'proposta') ? 'conversa lida' : dv('ligacao_resumo') ? 'resumo no dossiê' : 'conversa ainda não lida';
  var etapas = [['a', 'Antes da ligação', nFalta + (nFalta === 1 ? ' resposta falta' : ' respostas faltam') + (X.diverge.length ? ' · ' + X.diverge.length + ' a confirmar' : '')], ['b', 'Depois do 1:1', resB], ['c', 'O que sai da conversa', enviado ? 'e-mail enviado' : 'e-mail ainda não feito']];
  var nav = '<nav class="lg-nav" aria-label="Etapas da ligação">' + etapas.map(function (e, i) {
    return '<button type="button" class="lg-et' + (e[0] === ps ? ' on' : '') + '" data-fx="lgPasso" data-v="' + e[0] + '"' + (e[0] === ps ? ' aria-current="step"' : '') + '><span class="lg-n">' + (i + 1) + '</span><span><b>' + e[1] + '</b><small>' + esc(e[2]) + '</small></span></button>';
  }).join('') + '</nav>';
  var ajuda = p1 ? '<details class="lg-det" data-lg="completar"' + (lgAberto('completar') ? ' open' : '') + '><summary>Cruzamentos entre as fontes e como completar o que falta' + (nFalta ? ' · ' + nFalta : '') + '</summary><div>' + p1 + '</div></details>' : '';
  var painel = ps === 'b' ? pAn + (pMont ? '<div class="lg-mont"><h4 class="fx-h4">Montagem proposta para o espaço dela</h4>' + pMont + '</div>' : '') : ps === 'c' ? p3 : (formHtml ? formHtml + ajuda : p1);
  return '<section class="panel dv lg" id="dos-ligacao" style="padding:16px;margin-bottom:14px"><h3 style="font-size:17px;margin:0 0 10px">Dossiê e ligação</h3>' + nav + '<div class="lg-painel">' + painel + '</div></section>';
}
// O que conferir e o que perguntar: cada resposta que falta aparece só aqui, separada pelo canal (conversa, app, documento).
function dosPerguntarHtml(c, S) {
  var conta = !!c.user_id, pos = !!(S && S.onbEm);
  // Cruzamentos
  var X = dosCruzamentos(c, S), cruz = '';
  if (S && (X.confere.length || X.diverge.length || X.soFunil.length || X.daChamada.length)) {
    cruz = '<div class="dv-sec"><div class="k">Cruzamentos entre as fontes</div><p class="sub" style="margin:0 0 6px">' + X.confere.length + ' confirmados por mais de uma fonte · ' + X.diverge.length + ' divergem · ' + X.soFunil.length + ' só vêm do funil' + (pos ? ' · ' + X.daChamada.length + ' lidos da chamada' : '') + '.</p>' +
      (X.diverge.length ? '<ul class="dv-ul dv-div">' + X.diverge.map(function (x) { return '<li><b>' + esc(x.l) + ':</b> o funil disse “' + esc(x.funil) + '”, o dossiê diz “' + esc(x.dossie) + '”. Confirme no 1:1.<span class="dv-div-ac"><button type="button" class="btn" data-fx="dosUsa" data-k="' + esc(x.k) + '" data-v="funil">Usar o do funil</button><button type="button" class="btn" data-fx="dosUsa" data-k="' + esc(x.k) + '" data-v="dossie">Manter o do dossiê</button></span></li>'; }).join('') + '</ul>' : '') +
      (X.soFunil.length ? '<p class="sub" style="margin:6px 0 0"><b>Só vieram do funil, confirme com ela:</b> ' + esc(X.soFunil.map(function (x) { return x.l; }).join(', ')) + '.</p>' : '') +
      (pos && X.daChamada.length ? '<ul class="dv-ul">' + X.daChamada.slice(0, 8).map(function (x) { return '<li>' + esc(x.l) + ' <i class="dv-fonte">' + esc(x.origem) + ' · ' + esc(ONB_CONF[x.conf] || x.conf) + '</i></li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  // O que falta e como completar
  var F = dosFaltaPorCanal(c, S), total = F.conversa.length + F.app.length + F.doc.length, falta = '';
  if (S && total) {
    var lista = function (campos) { return '<ul class="dv-ul">' + campos.slice(0, 6).map(function (f) { return '<li>' + esc(f.l) + '</li>'; }).join('') + (campos.length > 6 ? '<li class="sub">e mais ' + (campos.length - 6) + '</li>' : '') + '</ul>'; };
    if (!conta) {
      var todos = F.conversa.concat(F.doc).concat(F.app);
      falta = '<div class="dv-sec"><div class="k">Perguntas para o 1:1</div><p class="sub" style="margin:0 0 6px">' + 'O que você perguntar na conversa já entra no formulário abaixo.</p>' +
        '<div class="dv-chips">' + todos.slice(0, 10).map(function (f) { return '<span class="dv-chip">' + esc(f.l) + '</span>'; }).join('') + (todos.length > 10 ? '<span class="dv-chip mais">+ ' + (todos.length - 10) + ' no formulário</span>' : '') + '</div></div>';
    } else {
      falta = '<div class="dv-sec"><div class="k">Como completar o que falta' + (pos ? '' : ' (depois do 1:1)') + '</div><div class="dv-estr">' +
        (F.conversa.length ? '<div class="dv-e"><b>Perguntar por mensagem</b><span class="sub">' + F.conversa.length + ' respostas: ela responde no chat.</span>' + lista(F.conversa) + '<button type="button" class="btn" data-dosmsg="' + esc(c.id) + '" data-tipo="conversa">Montar a mensagem →</button></div>' : '') +
        (F.app.length ? '<div class="dv-e"><b>Ela completa no app</b><span class="sub">' + F.app.length + ' respostas: o checklist pergunta quando ela chega nesse passo.</span>' + lista(F.app) + '</div>' : '') +
        (F.doc.length ? '<div class="dv-e"><b>Lembrar dos documentos</b><span class="sub">' + F.doc.length + ' itens: ela guarda no Drive dela e só cola o link fechado no app (nada sensível vai para o app).</span>' + lista(F.doc) + '<button type="button" class="btn" data-dosmsg="' + esc(c.id) + '" data-tipo="doc">Mandar o lembrete →</button></div>' : '') + '</div></div>';
    }
  } else if (S) falta = '<div class="dv-sec"><div class="k">O que falta</div><p class="sub" style="margin:0">Nada falta no dossiê.</p></div>';
  return cruz + falta;
}
function dosVisaoHtml(c, d) {
  var S = state.dos && state.dos.cid === c.id && state.dos.d ? state.dos : null, conta = !!c.user_id, pos = !!(S && S.onbEm);
  var jor = d.jor || montaJornada([]), mails = d.mails || [], resps = d.resps || [], perg = d.perg || [], evs = d.eventos || [];
  var titulo = !conta ? 'Preparação do 1:1' : pos ? 'Depois do 1:1' : 'Visão geral';
  var sub = !conta ? 'Lead sem conta no app. O que já sabemos dela, o que bate entre as fontes e o que perguntar na conversa.'
    : pos ? 'O que a chamada trouxe, como bate com o resto e como completar o que falta.' : 'Já está na plataforma. O que sabemos, o que bate e como completar o que falta.';
  var dv = function (k) { return S ? dosValor(c, S.d, S.rasc, k) : ''; };
  var linhaKv = function (l, v, tag) { return v === '' || v == null ? '' : '<div class="dv-l"><span>' + esc(l) + '</span><b>' + esc(v) + (tag ? ' <i class="dv-fonte">' + esc(tag) + '</i>' : '') + '</b></div>'; };
  var op = function (k) { var v = dv(k); return v === '' ? '' : dosRotuloOpcao(dosCampo(k), v); };
  var quem = linhaKv('Situação', personaLabel(c) + (subLabel(c) ? ' · ' + subLabel(c) : '')) + linhaKv('Fase', op('fase'), dosFonteTag(c, S, 'fase')) +
    linhaKv('Faixa de idade', op('faixa_idade'), dosFonteTag(c, S, 'faixa_idade')) + linhaKv('Cidade', dv('cidade')) + linhaKv('Chegou na França', dv('data_chegada') ? fmtDay(dv('data_chegada')) : '') +
    linhaKv('Francês', op('nivel_frances')) +
    linhaKv('Maior preocupação', op('preocupacao') || (c.preocupacao ? String(c.preocupacao) : ''));
  // Estudos, certificados e prazo: um cartão só, com cada linha dizendo o que é (sempre aparece, mesmo sem resposta).
  var vazio = '<span class="sub">ainda não informado</span>';
  var kvX = function (l, v, extra) { return '<div class="dv-l"><span>' + esc(l) + '</span><b>' + (v ? esc(v) : vazio) + '</b></div>' + (extra ? '<p class="sub dv-ctx">' + extra + '</p>' : ''); };
  var fNiv = dosCampo('nivel_estudos'), vNiv = dv('nivel_estudos'), diploma = fNiv && fNiv.o.some(function (o) { return o[0] === vNiv; }) ? dosRotuloOpcao(fNiv, vNiv) : '';
  var certFr = dv('certificado_frances') === 'tenho' ? (op('certificado_frances_qual') ? op('certificado_frances_qual') : 'tem, não disse qual') : dv('certificado_frances') === 'nao' ? 'ainda não tem' : '';
  var certMat = dv('tem_certificado_matricula') === 'true' ? 'tem' : dv('tem_certificado_matricula') === 'false' ? 'ainda não tem' : '';
  var cfData = CF_PRAZO[(c.respostas || {}).cfNivel];
  var prazoTxtX = c.prazo_limite ? fmtDay(c.prazo_limite) + ' (' + prazoTxt(c) + ')' : cfData ? fmtDay(cfData) : '';
  var prazoCtx = c.prazo_limite ? 'Validar o VLS-TS na ANEF: 3 meses depois da entrada na França' + (c.data_entrada ? ' (' + fmtDay(c.data_entrada) + ')' : '') + '.' : cfData ? 'Prazo do Campus France para o nível que ela marcou no funil.' : '';
  var estudos = kvX('Diploma mais recente', diploma) + kvX('Certificado de francês', certFr) + (certMat ? kvX('Certificado de matrícula', certMat) : '') +
    kvX(c.prazo_limite ? 'Prazo do VLS-TS' : cfData ? 'Prazo do Campus France' : 'Prazo', prazoTxtX, esc(prazoCtx));
  var entradas = (jor.entradas || []).slice().reverse().slice(0, 4).map(function (x) {
    var q = (jor.quizzes || []).filter(function (z) { return z.em === x.em; })[0];
    return '<div class="dv-l"><span>' + esc(fmtDate(x.em)) + '</span><b>' + esc((ORIGEM_PAGINA[x.origem] ? r1Rotulo(ORIGEM_PAGINA[x.origem]) + ' · ' : '') + (origLabel(x.origem) || '—')) + (q && q.objetivo ? ' <i class="dv-fonte">' + esc(etapaDe(q.objetivo)) + '</i>' : '') + '</b></div>';
  }).join('');
  var veio = entradas + linhaKv('Campanha', c.utm_campaign || '') + linhaKv('Instagram', c.instagram || '');
  var abriu = mails.filter(function (m) { return m.aberto_em || m.status === 'aberto' || m.status === 'clicado'; }).length, clicou = mails.filter(function (m) { return m.clicado_em || m.status === 'clicado'; }).length;
  var arts = evs.filter(function (e) { return e.tipo === 'artigo_lido'; }).slice(0, 3).map(function (e) { var x = e.dados || {}; return x.titulo || x.slug || ''; }).filter(Boolean);
  var fez = linhaKv('E-mails', mails.length ? mails.length + ' enviados · abriu ' + abriu + ' · clicou ' + clicou : 'nenhum enviado') + linhaKv('Respostas dela', resps.length ? String(resps.length) : '') +
    linhaKv('Artigos lidos', arts.length ? arts.join(' · ') : jor.artigos ? String(jor.artigos) : '') +
    perg.slice(0, 2).map(function (p) { return '<div class="dv-l"><span>Perguntou</span><b>' + esc(truncaTxt(p.texto, 90)) + (p.origem ? ' <i class="dv-fonte">' + artigoHtml(p.origem) + '</i>' : '') + '</b></div>'; }).join('') +
    linhaKv('App', conta ? 'tem conta · ' + (c.ultimo_evento_em ? 'última atividade há ' + haDias(diasDesde(c.ultimo_evento_em)) : 'sem atividade') : 'ainda sem conta');
  var card = function (t, corpo) { return '<div class="dv-card"><div class="k">' + esc(t) + '</div>' + (corpo || '<p class="sub" style="margin:0">Nada registrado ainda.</p>') + '</div>'; };

  return '<section class="panel dv" id="dos-visao" style="padding:16px;margin-bottom:14px"><h3 style="font-size:17px;margin:0 0 2px">' + esc(titulo) + '</h3><p class="sub" style="margin:0 0 12px">' + esc(sub) + '</p>' +
    '<div class="dv-grid">' + card('Quem ela é', quem) + card('Estudos, certificados e prazo', estudos) + card('De onde veio e o que respondeu', veio) + card('O que ela fez', fez) + '</div>' + r1Html(c, S) + '</section>';
}
function fxSessoes(c) {
  var mk = function (titulo, sub, id, corpo) { var a = fxSessaoAberta(id); return { titulo: titulo, sub: sub, aberto: a, corpo: a ? corpo() : '' }; };
  var mapa = {
    home: mk('Página inicial', 'O que fica em destaque no Início dela: 1 item principal, 3 passos do checklist, 3 do Só seu e 2 dos Guias.', 'home', function () { return fxHomeCorpo(c); }),
    chat: mk('Conversa com ela', 'As mensagens da equipe, do assistente e dela, dentro do app.', 'chat', function () { return '<div id="chat-box">' + chatPanelHtml(c, state.chat, H4_PLAT) + '</div>'; }),
    checklist: mk('Checklist', 'Os passos dela por démarche, do mais urgente ao mais distante. Aqui você escolhe os 3 que aparecem na Página inicial.', 'checklist', function () { return '<div id="fx-chk-corpo">' + fxChecklistCorpo(c) + '</div>' + fxZonas(c, 'checklist'); }),
    curadoria: mk('Curadoria', 'A montagem proposta a partir do Dossiê e da conversa. Aprove, edite ou recuse; cada item aprovado vai para a pílula certa.', 'curadoria', function () { return fxCuradoriaCorpo(c); }),
    espaco: mk('Espaço', 'O que ela vê na aba Espaço: perguntas da equipe, bilans, encaminhamentos da Ingryd e mensagens prontas.', 'espaco', function () { return fxEspacoTudo(c); }),
    guias: mk('Guias', 'Documentos e mensagens prontas que ela vê em “Guias” no Início (até 2). Guias vive só aqui.', 'guias', function () { return fxEspacoGuias(c); }),
    perfil: mk('Perfil', 'O que ela já respondeu e o que falta perguntar.', 'perfil', function () { return fxPerfilCorpo(c) + fxZonas(c, 'perfil'); }),
    eu: mk('Só eu · minhas tarefas', 'Tarefas suas neste caso. Ela não vê nada daqui.', 'eu', function () { return fxEuCorpo(c); }),
    bilan: mk('Bilan', 'O que a conversa mostrou, os achados para conferir e o e-mail do bilan.', 'bilan', function () { var g = fxCasoGuarda(c); return (g.k ? casoSecao('O que entendi', g.k.ach.length + ' achados', casoAchadosHtml(g.k)) : g.html) + bilanResumoHtml(c) + bilanBlocoHtml(c, H4_PLAT); }),
    trouxe: mk('O que ela trouxe', 'Tudo o que ela adicionou de público ao app.', 'trouxe', function () { return fxTrouxeCorpo(c); }),
    sinais: mk('Panorama dela', 'Como ela está: lido das conversas e do que ela faz no app, com impulsos para você.', 'sinais', function () { return fxSinaisCorpo(c); }),
    mais: mk('Mais detalhes do universo', 'O que é da persona e o que é só dela.', 'mais', function () { return fxMaisCorpo(c); }),
    hist: mk('Histórico', 'Tudo que ela fez no app, dia a dia.', 'hist', function () { return '<div id="int-box">' + interacoesHtml(state.int) + '</div>'; })
  };
  if (c.user_id) mapa.insights = mk('Insights', 'O que o uso do app diz sobre ela, depois do 1:1.', 'insights', function () { return insightsPlatHtml(c); });
  return { ir: FH.htmlIrPara(fxOrdem(), mapa, H_FX), sessoes: FH.htmlPaginaSessao(fxOrdem(), mapa, H_FX) };
}
// ---------- Plataforma: a sessão "Insights" (depois do 1:1, com ela no app) ----------
function insightsDaPlataforma(c, X) {
  var out = [], agora = X.agora || Date.now(), cliques = X.cliques || [];
  var ult = diasDesde(c.ultimo_evento_em);
  if (ult != null && ult >= 7) out.push({ tom: 'alerta', t: 'Parada há ' + haDias(ult) + ' no app.', acao: 'chat', rot: 'Mandar um oi no chat' });
  else if (ult != null) out.push({ tom: 'ok', t: ult === 0 ? 'Usou o app hoje.' : 'Última atividade há ' + haDias(ult) + '.' });
  if (X.umEm) {
    var sessoes = {}; cliques.forEach(function (x) { if (x.criado_em >= X.umEm) sessoes[x.sessao || x.criado_em.slice(0, 13)] = 1; });
    var n = Object.keys(sessoes).length;
    out.push(n ? { tom: 'ok', t: 'Depois do 1:1 de ' + fmtDate(X.umEm) + ', abriu o app em ' + n + (n === 1 ? ' sessão.' : ' sessões.') } : { tom: 'alerta', t: 'Depois do 1:1 de ' + fmtDate(X.umEm) + ', ainda não abriu o app.', acao: 'chat', rot: 'Lembrar do app no chat' });
  }
  if (X.chk && !X.chk.err && !X.chk.semConta && X.chk.itens) {
    var cc = chkCalc(X.chk, agora), ativos = cc.itens.filter(function (i) { return i.status !== 'arquivado'; });
    if (!ativos.length) out.push({ tom: 'alerta', t: 'O checklist dela ainda está vazio.' });
    else {
      out.push({ tom: 'ok', t: 'Checklist: ' + cc.feitos + ' de ' + ativos.length + ' concluídos.' });
      if (cc.atrasados.length) out.push({ tom: 'alerta', t: cc.atrasados.length + (cc.atrasados.length === 1 ? ' item atrasado' : ' itens atrasados') + ': ' + cc.atrasados.slice(0, 2).map(function (i) { return i.label; }).join(', ') + '.', acao: 'chat', rot: 'Perguntar se precisa de ajuda' });
      if (cc.prox) out.push({ tom: '', t: 'Próximo prazo: ' + fmtDay(cc.prox.due_date) + ' · ' + cc.prox.label + '.' });
    }
  }
  if (X.chatNaoLidas > 0) out.push({ tom: 'alerta', t: X.chatNaoLidas + (X.chatNaoLidas === 1 ? ' mensagem dela no chat sem ler.' : ' mensagens dela no chat sem ler.'), acao: 'chat', rot: 'Abrir o chat' });
  if (X.dosFalta > 0) out.push({ tom: '', t: 'O dossiê ainda tem ' + X.dosFalta + ' respostas em aberto.', acao: 'dossie', rot: 'Ver como completar' });
  var porTela = {}; cliques.forEach(function (x) { if (x.alvo === 'tela') porTela[telaNome(x.tela)] = (porTela[telaNome(x.tela)] || 0) + 1; });
  var top = Object.keys(porTela).sort(function (a, b) { return porTela[b] - porTela[a]; }).slice(0, 2);
  if (top.length) out.push({ tom: '', t: 'Passa mais tempo em ' + top.join(' e ') + '.' });
  if (X.notasVivas > 0) out.push({ tom: '', t: 'Há ' + X.notasVivas + (X.notasVivas === 1 ? ' nota' : ' notas') + ' da iAssistente no card dela agora.' });
  return out;
}
function insightsPlatHtml(c) {
  var int = state.int && state.int.cid === c.id ? state.int : null, S = state.dos && state.dos.cid === c.id ? state.dos : null;
  var um = UM.filter(function (x) { return x.contato_id === c.id && x.quando && (x.status === 'feito' || new Date(x.quando).getTime() < Date.now() - 36e5); }).sort(function (a, b) { return a.quando < b.quando ? 1 : -1; })[0];
  var lista = insightsDaPlataforma(c, { agora: Date.now(), cliques: int && !int.err ? int.cliques || [] : [], chk: S ? S.chk : null, chatNaoLidas: chatNaoLidas(state.chat),
    dosFalta: S && S.d ? dosProgresso(c, S.d, S.rasc).falta : 0, umEm: um ? um.quando : null, notasVivas: state.ins && state.ins.vivos && state.ins.vivos.notas ? state.ins.vivos.notas.length : 0 });
  var pedem = lista.filter(function (i) { return i.tom === 'alerta'; }).length;
  return '<div class="ins-plat"><p class="sub" style="margin:0 0 8px"><b>' + lista.length + (lista.length === 1 ? ' insight' : ' insights') + '</b>' + (pedem ? ' · ' + pedem + (pedem === 1 ? ' pede ação' : ' pedem ação') : ' · nada pede ação agora') + '. Por regra, a partir do uso do app, do checklist e do chat (sem IA).</p>' +
    (lista.length ? '<ul class="ins-lista">' + lista.map(function (i) {
      return '<li class="ins-i ins-' + (i.tom || 'neutro') + '"><span class="ins-p ' + (i.tom === 'alerta' ? 'u-alta' : i.tom === 'ok' ? 'u-baixa' : '') + '">' + (i.tom === 'alerta' ? 'Atenção' : i.tom === 'ok' ? 'Bom sinal' : 'Nota') + '</span><span class="ins-t">' + esc(i.t) + '</span>' +
        (i.acao ? '<button type="button" class="btn" data-insacao="' + esc(i.acao) + '">' + esc(i.rot) + '</button>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="sub" style="margin:0">Ainda sem dados do app para ler.</p>') + '</div>';
}
function fxCorpo(c, d, tab) {
  if (tab === 'plataforma') {
    if (state.int && state.int.err) return '<div class="panel" style="padding:16px;margin-top:14px"><h3 style="font-size:15px;margin-bottom:8px">Plataforma ainda não ligada</h3><p class="sub" style="margin:0">Falta rodar <b>db/crm-plataforma.sql</b> no SQL Editor do Supabase (depois dele, os cliques novos começam a aparecer aqui).</p></div>';
    var sess = fxSessoes(c);   // "Ir para" em largura total, como o Pagamento; as sessões e a prévia do app ficam abaixo
    return '<div class="fx-plat">' + pagamentoHtml(c, H4_PLAT) + sess.ir + '<div class="fx-plat-grade"><div class="fx-plat-esq">' + sess.sessoes + '</div><aside class="fx-previa" id="fx-previa" aria-label="O app dela (prévia)">' + fxPreviaHtml(c) + '</aside></div></div>';
  }
  if (tab === 'conversa') return conversaPanel(c, d.mails || [], d.resps || [], d.h4 || H4_PLAT, d.jor);
  // Dossiê: aba própria, sempre aberta. Preenche sozinho com o que ela responde no funil e no app (ver DOS_FUNIL).
  if (tab === 'dossie') return dosVisaoHtml(c, d) + dosLigacaoHtml(c, d, '<div id="dossie-box">' + dossieHtml(c, state.dos.d, state.dos.err, state.dos.rasc, true, state.dos.chk, true) + '</div>');
  // Ficha (captação): o fluxo de 3 passos e os painéis que já existiam (feed, e-mails, jornada, quem é ela, mais).
  var etapa = FX.etapaFunil(c, { mails: d.mails || [], propostas: [], temBilan: !!(state.bilan && state.bilan.cid === c.id), umFeito: umFeito(c.id) }), h4 = d.h4 || H4_PLAT;
  // Três colunas, cada uma com um papel: à esquerda quem ela é e onde está no funil; no meio o que ela fez; à direita o que fazer (e-mail).
  // Quem é ela abre e fecha: fechado mostra só o essencial (persona e etapa) numa linha; aberto, todas as respostas.
  var qrows = respostasKv(c, d.jor), qresumo = qrows.slice(0, 2).filter(function (x) { return !x[2]; }).map(function (x) { return x[1]; }).join(' · ');
  var quem = '<details class="panel fx-quem"><summary><span class="fx-quem-t">Quem é ela</span>' + (qresumo ? '<span class="fx-quem-r">' + esc(qresumo) + '</span>' : '') + '</summary>' + kvHtml(qrows) + '</details>';
  return FH.htmlFluxo(etapa <= 3 ? 1 : etapa <= 5 ? 2 : 3, H_FX) + onbResumoHtml(c) +
    '<div class="fx-ficha3">' +
    '<aside class="fx-rail fx-ctx" aria-label="Quem é ela e jornada">' + quem + jornadaHtml(c, d.mails || [], d.resps || [], d.jor, h4, FH.htmlFunil({ etapa: etapa, semCaixa: true }, H_FX)) + '</aside>' +
    '<section class="fx-centro" aria-label="Tudo que ela fez">' + fichaFeedHtml(d.eventos || []) +
    fichaMaisHtml(c, { perg: d.perg || [], resps: d.resps || [], cons: d.cons || [], last: d.last, h4: h4 }) + '</section>' +
    '<aside class="fx-rail fx-mail" aria-label="E-mails">' + emailsPanel(c, d.mails || [], h4, d.resps || [], d.jor) + '</aside></div>';
}
// Repinta só o corpo da aba (abrir/fechar/mover sessão): o resto da tela e a rolagem ficam.
function fxPintaCorpo() {
  var c = byC(state.sel), f = state.fx, d = f.dados, box = $('fx-corpo'); if (!c || !d || !box) return;
  var tx = $('chat-txt'); if (tx) state.chatRasc = tx.value;
  box.innerHTML = fxCorpo(fxContato(c, d.uid), d, f.tab);
  fxPos(c);
}
// O aviso no alto da ficha: o mesmo motivo que pôs a pessoa na lista "Precisa de você" da Hoje, o que fazer (a regra do "Próximo e-mail")
// e o botão da ação. Assim não precisa vasculhar a ficha para entender o problema.
function avisoDaPessoaHtml(c, mails, resps, jor) {
  if (!c.motivo || c.estagio === 'concluido' || c.estagio === 'inativo') return '';
  var p = proximoEmail(c, mails || [], resps || [], jor || montaJornada([])), bloq = p.k && exigeNovidades(p.k) && !c.aceita_novidades;
  var primario = p.conversa ? '<button class="btn primary" type="button" data-openconv="' + esc(c.id) + '">Responder agora →</button>'
    : p.k && !bloq && p.quando === 'agora' ? '<button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '" data-tplk="' + esc(p.k) + '">Revisar e enviar: ' + esc(tplInfo(p.k).label) + ' →</button>'
    : '<button class="btn primary" type="button" data-openconv="' + esc(c.id) + '">Abrir a aba E-mail →</button>';
  var seg = c.estagio === 'um_a_um' || c.um_a_um_quando ? '' : '<button class="btn" type="button" data-open1a1="' + esc(c.id) + '">Marcar 1:1</button>';
  return '<section class="aviso aviso-' + esc(c.urgencia || 'baixa') + '" aria-label="O que pede atenção nesta pessoa"><div class="aviso-t"><span class="k">Precisa de você</span>' + urgPill(c.urgencia) + '</div>' +
    '<p class="aviso-motivo">' + esc(c.motivo) + '</p>' +
    '<p class="aviso-fazer" title="' + esc(p.angulo) + '"><b>O que fazer:</b> ' + esc(p.titulo) + '</p>' +
    '<div class="cam-acoes">' + primario + seg + '</div></section>';
}
function renderFichaV2(c, d) {
  fxPrefs();
  var f = state.fx, cv = fxContato(c, d.uid);
  f.tab = f.tab || (FX_ABAS.indexOf(state.ptab) >= 0 ? state.ptab : null) || FX.abaPadrao(cv);
  if (!state.caso || state.caso.cid !== c.id) setTimeout(function () { carregaCaso(c.id); }, 0);   // as ações da equipe vêm do caso
  var tarefas = fxTarefas(cv, d);
  f.tarefas = tarefas; f.dados = d; f.cid = c.id; f.ag.pop = null; f.ag.i = Math.min(f.ag.i || 0, Math.max(0, tarefas.length - 1));
  return '<div id="ficha-v2" class="fx" data-cid="' + esc(c.id) + '">' +
    '<button class="link" data-back type="button">← Voltar</button>' +
    '<div id="fx-tour">' + FH.htmlTour(f.tour, H_FX) + '</div>' +
    '<div id="fx-fila-box">' + FH.htmlFila(fxFilaItens(cv), c.id, H_FX) + '</div>' +
    '<div id="fx-head-box">' + fxHeaderHtml(cv, d) + '</div>' +
    '<div class="fx-topo" id="fx-topo"><div id="fx-aviso-box">' + avisoDaPessoaHtml(c, d.mails, d.resps, d.jor) + '</div>' +
    '<div id="fx-acoes-box">' + fxCarrossel(cv) + '</div></div>' +
    FH.htmlAbas(f.tab, !!cv.user_id, H_FX) +
    '<div id="fx-corpo">' + fxCorpo(cv, d, f.tab) + '</div>' +
    '<div id="fx-pop"></div></div>';
}
// Repinta a ficha inteira com os dados já carregados (troca de aba, deep link). O que ela digitou no chat sobrevive.
function fxRepinta() {
  var c = byC(state.sel), d = state.fx.dados; if (!c || !d) return;
  var tx = $('chat-txt'); if (tx) state.chatRasc = tx.value;
  $('pessoa-page').innerHTML = renderFichaV2(c, d);
  fxPos(c);
}
// Depois de pintar: rola o chat para o fim (e marca como lido, como a ficha antiga fazia) e destaca a sessão do deep link.
// A altura do cabeçalho fixo vira --hd-h: as colunas fixas e o destino de "Ir para" começam logo abaixo dele (sem ficar escondidos).
function fxMedeCabecalho() {
  var hb = $('fx-head-box'), r = document.documentElement;
  if (!hb || !r || !r.style || !r.style.setProperty) return;
  var fixo = window.matchMedia ? !window.matchMedia('(max-width: 760px)').matches : true;
  r.style.setProperty('--hd-h', fixo && hb.offsetHeight ? hb.offsetHeight + 'px' : '0px');
}
function fxPos(c) {
  var f = state.fx;
  fxMedeCabecalho();
  if (f.tab === 'plataforma' && fxSessaoAberta('chat')) {
    var fio = $('chat-fio'); if (fio) fio.scrollTop = fio.scrollHeight;
    var tx = $('chat-txt'); if (tx && state.chatRasc) tx.value = state.chatRasc;
    marcaChatLido(c.id);
  }
  if (f.flash) {
    var alvo = document.querySelector('[data-sessao="' + f.flash + '"]');
    if (alvo) { if (alvo.scrollIntoView) alvo.scrollIntoView({ block: 'start' }); if (alvo.classList) { alvo.classList.add('fx-flash'); setTimeout(function () { alvo.classList.remove('fx-flash'); }, 2200); } }
    f.flash = null;
  }
}
// A prévia do app vai para a aba da sessão que você abriu.
var FX_ABA_DA_SESSAO = { home: 'inicio', inicio: 'inicio', checklist: 'checklist', curadoria: 'checklist', espaco: 'espaco', guias: 'guias', bilan: 'espaco', perfil: 'perfil' };
function fxPrevia(id) { if (FX_ABA_DA_SESSAO[id]) { state.fx.appAba = FX_ABA_DA_SESSAO[id]; fxPintaPrevia(); } }
// Uma sessão por vez, em página inteira: o que está aberta é a que a pílula "Ir para" escolheu (Checklist é a de entrada).
function fxSessaoAtual() { var f = state.fx, o = fxOrdem(), todos = o.app.concat(o.ela); return f.sessao && todos.indexOf(f.sessao) >= 0 ? f.sessao : 'checklist'; }
function fxSessaoAberta(id) { return id === fxSessaoAtual(); }
function fxVaiPara(id) {
  // Trocar de pílula não move a tela: guarda a rolagem, repinta e devolve (nada de scrollIntoView).
  var x = window.pageXOffset || 0, y = window.pageYOffset || 0;
  state.fx.sessao = id; fxPintaCorpo(); fxPrevia(id);
  if (window.scrollTo) window.scrollTo(x, y);
}
// Atualização ao vivo: só as peças de cima e o corpo do Checklist; o que ela digita (chat, dossiê) não é tocado.
function fxLive(c) {
  var f = state.fx, d = f.dados; if (!d || f.cid !== c.id) return;
  var cv = fxContato(c, d.uid);
  f.tarefas = fxTarefas(cv, d);
  var hb = $('fx-head-box'); if (hb) { hb.innerHTML = fxHeaderHtml(cv, d); fxMedeCabecalho(); }
  fxPintaChk(cv);
  if (f.ag.pop === null) { var ab = $('fx-acoes-box'); if (ab) ab.innerHTML = fxCarrossel(cv); }
}
function irPara(dest) {
  var f = state.fx; if (!dest) return;
  f.tab = dest.tab;
  if (dest.sessao) { f.sessao = dest.sessao; f.flash = dest.sessao; }
  fxRepinta();
}
function fxFocaPop() { var dlg = document.querySelector('#fx-pop .fx-pop'); if (dlg && dlg.focus) dlg.focus(); }
function fxFechaPop(devolveFoco) {
  var f = state.fx, i = f.ag.pop; f.ag.pop = null;
  var box = $('fx-pop'); if (box) box.innerHTML = '';
  if (devolveFoco && i !== null) { var card = document.querySelector(typeof i === 'number' ? '.fx-card[data-i="' + i + '"]' : '[data-fx="' + (i === 'add' ? 'agNovo' : 'agFeitas') + '"]'); if (card && card.focus) card.focus(); }
}
function fxPintaPop() {
  var box = $('fx-pop'), p = state.fx.ag.pop; if (!box) return;
  box.innerHTML = p === 'add' ? FH.htmlPopupAdd(H_FX) : p === 'feitas' ? FH.htmlPopupFeitas(fxFeitas(), H_FX) : FH.htmlPopup(state.fx.tarefas, p, H_FX);
  fxFocaPop();
  if (p === 'add') { var inp = $('fx-add-in'); if (inp && inp.focus) inp.focus(); }
}
// Contador e setas do carrossel, sem repintar (a rolagem do carrossel é preservada).
function fxCarMostra(i, car) {
  var f = state.fx, n = f.tarefas.length; f.ag.i = i;
  var ct = document.querySelector('.fx-cont'), pv = document.querySelector('[data-fx="agPrev"]'), nx = document.querySelector('[data-fx="agNext"]');
  if (ct) ct.textContent = (i + 1) + ' de ' + n;
  if (pv) pv.disabled = i <= 0;
  if (nx) nx.disabled = car ? car.scrollLeft + car.clientWidth >= car.scrollWidth - 4 : i >= n - 1;
}
function fxCarGo(delta) {
  var f = state.fx, n = f.tarefas.length; if (!n) return;
  var i = Math.min(Math.max(0, f.ag.i + delta), n - 1), car = document.querySelector('.fx-car'), card = car && car.children && car.children[i];
  fxCarMostra(i, null);
  if (car && card && car.scrollTo) {
    var reduz = false; try { reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduz = false; }
    car.scrollTo({ left: card.offsetLeft, behavior: reduz ? 'auto' : 'smooth' });
  }
}
function fxCarScroll(car) {
  var cards = car.children || [], i = 0;
  for (var k = 0; k < cards.length; k++) if (cards[k].offsetLeft <= car.scrollLeft + 8) i = k;
  fxCarMostra(i, car);
}
function fichaClick(el) {
  if (!el || !el.dataset || !el.dataset.fx) return false;
  var f = state.fx, ds = el.dataset, n = f.tarefas ? f.tarefas.length : 0;
  switch (ds.fx) {
    case 'pessoa': fxReset(); openPessoa(ds.id); return true;
    case 'tab': if (FX_ABAS.indexOf(ds.v) >= 0) { f.tab = ds.v; f.hd = null; fxRepinta(); } return true;
    case 'hdTile': f.hd = f.hd === ds.id ? null : ds.id; fxPintaHeader(); return true;
    case 'tourAbrir': case 'tourFechar':
      f.tour = ds.fx === 'tourAbrir'; FX.gravarPrefs(localStorage, { tour: f.tour });
      var tb = $('fx-tour'); if (tb) tb.innerHTML = FH.htmlTour(f.tour, H_FX); return true;
    case 'agAbrir': { var i = Number(ds.i); if (!(i >= 0 && i < n)) return true; f.ag.pop = i; fxPintaPop(); return true; }
    case 'agFechar': fxFechaPop(true); return true;
    case 'tema': f.tema = f.tema === ds.v ? null : ds.v; fxPintaCorpo(); return true;
    case 'impulso': return fxImpulso(ds.id);
    case 'sugAcao': return fxSugAcao(ds);
    case 'agNovo': f.ag.pop = 'add'; fxPintaPop(); return true;
    case 'agFeitas': f.ag.pop = 'feitas'; fxPintaPop(); return true;
    case 'agAdd': return fxAddAcao();
    case 'agFeito': return fxFeitoAcao(ds.id);
    case 'agNav': { if (typeof f.ag.pop !== 'number') return true; f.ag.pop = Math.min(Math.max(0, f.ag.pop + Number(ds.d || 0)), n - 1); fxPintaPop(); return true; }
    case 'agIr': {
      var t = (f.tarefas || []).filter(function (x) { return x.id === ds.id; })[0] || (f.tarefas || []).filter(function (x) { return x.k === ds.k; })[0] || (f.ag.pop !== null ? f.tarefas[f.ag.pop] : null);
      fxFechaPop(false); if (t) irPara(t.dest); return true;
    }
    case 'sessao': case 'abrir': case 'ir': fxVaiPara(ds.id); return true;
    case 'appaba': f.appAba = ds.v; fxPintaPrevia(); return true;
    case 'appdia': f.dia = Number(ds.v); fxPintaPrevia(); return true;
    case 'camadas': f.camadas = !f.camadas; fxPintaPrevia(); return true;
    case 'dem': { f.dem = ds.v || 'todas'; f.appAba = 'checklist'; var cd = byC(state.sel); if (cd) { fxPintaChk(fxContato(cd, f.dados && f.dados.uid)); fxPintaPrevia(); } return true; }
    case 'lgPasso': f.lgPasso = ds.v; fxPintaCorpo(); return true;
    case 'dosChip': { var cc2 = byC(state.sel); if (!cc2 || !state.dos || state.dos.cid !== cc2.id) return true; var at2 = dosValor(cc2, state.dos.d, state.dos.rasc, ds.k); state.dos.rasc[ds.k] = at2 === ds.v ? '' : ds.v; pintaDossie(cc2); return true; }
    case 'perMov': fxPerMover(ds.id, Number(ds.d)); return true;
    case 'homeDestaque': fxHomeDestacar(ds.id); return true;
    case 'dosUsa': { var cdu = byC(state.sel); if (!cdu || !state.dos || state.dos.cid !== cdu.id) return true;
      if (ds.v === 'funil') { var fv = dosDoFunil(cdu, ds.k); if (fv !== null) { state.dos.rasc[ds.k] = String(fv); toast('Valor do funil no formulário: salve o dossiê para guardar.', 3600); } } else dosDivGuarda(cdu.id, ds.k);
      pintaDossie(cdu); fxPintaCorpo(); return true; }
    case 'dosFiltro': f.dosFiltro = ds.v; f.dosFonte = 'todas'; { var cdf = byC(state.sel); if (cdf) pintaDossie(cdf); } return true;
    case 'dosFonte': f.dosFonte = ds.v; { var cds = byC(state.sel); if (cds) pintaDossie(cds); } return true;
    case 'curOrigem': f.curOrigem = ds.v; fxPintaCorpo(); return true;
    case 'curConf': case 'curEsc': case 'curMostrar': case 'curMov': case 'curReset': case 'curRetira': { var cc = byC(state.sel); if (cc) fxCurAcao(cc, ds); return true; }
    case 'ckOrigem': f.ckOrigem = ds.v; fxRepintaChkDe(); return true;
    case 'ckEditar': fxFechaQuadro(); f.ckEd = ds.id; fxRepintaChkDe(); fxGuiaCarrega(ds.id); return true;
    case 'qdFechar': fxFechaQuadro(); return true;
    case 'ckCancelar': f.ckEd = null; fxRepintaChkDe(); return true;
    case 'ckSalvar': return fxSalvaPasso(ds.id);
    case 'guiaAnalisar': fxGuiaAnalisar(ds.id, !!ds.texto); return true;
    case 'guiaSalvar': fxGuiaSalva(ds.id, ds.estado); return true;
    case 'guiaApagar': fxGuiaApaga(ds.id); return true;
    case 'ckTodos': case 'ckMais': { if (ds.fx === 'ckTodos') f.ckTodos = !f.ckTodos; else f.ckMais = !f.ckMais; var cm = byC(state.sel); if (cm) fxPintaChk(fxContato(cm, f.dados && f.dados.uid)); return true; }
    case 'perAnt': case 'perProx': case 'perIr': { var gp = fxCasoGuarda(byC(state.sel) || {}).k; if (!gp) return true; var np = fxPerLista(gp).length; f.carPerg = ds.fx === 'perIr' ? Number(ds.v) : (f.carPerg || 0) + (ds.fx === 'perAnt' ? -1 : 1); f.carPerg = Math.min(Math.max(0, f.carPerg), Math.max(0, np - 1)); if (gp.ed && gp.ed.t === 'av') gp.ed = null; gp.agenda = null; fxPintaCorpo(); return true; }
    case 'agPrev': fxCarGo(-1); return true;
    case 'agNext': fxCarGo(1); return true;
  }
  return true;
}
// Teclado do pop-up: Esc fecha e devolve o foco ao cartão; Tab fica preso; setas ‹ › passam de uma ação à outra.
function fxTecla(e) {
  var f = state.fx; if (!f || !f.ag || f.ag.pop === null) return;
  if (e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); return fxFechaPop(true); }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && typeof f.ag.pop === 'number') {
    var ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (e.preventDefault) e.preventDefault(); f.ag.pop = Math.min(Math.max(0, f.ag.pop + (e.key === 'ArrowLeft' ? -1 : 1)), f.tarefas.length - 1); return fxPintaPop();
  }
  if (e.key === 'Tab') {
    var dlg = document.querySelector('#fx-pop .fx-pop'); if (!dlg || !dlg.querySelectorAll) return;
    var fs = dlg.querySelectorAll('button:not([disabled])'); if (!fs.length) return;
    var ult = fs[fs.length - 1], pri = fs[0], at = document.activeElement;
    if (e.shiftKey && (at === pri || at === dlg)) { if (e.preventDefault) e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && at === ult) { if (e.preventDefault) e.preventDefault(); pri.focus(); }
    else if (!dlg.contains(at)) { if (e.preventDefault) e.preventDefault(); pri.focus(); }
  }
}
document.addEventListener('keydown', fxTecla);
document.addEventListener('scroll', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('fx-car')) fxCarScroll(t); }, true);
async function renderPessoa() {
  var c = byC(state.sel);
  if (!c) { $('pessoa-page').innerHTML = '<div class="empty">Pessoa não encontrada.</div>'; return; }
  $('pessoa-page').innerHTML = '<div class="loading">Carregando a ficha…</div>';
  if (fichaV2Ativa() && FX_PROC === null) FX_PROC = await fxCarregaProcessos();
  if (fichaV2Ativa() && FX_QUANDO === null) { try { var rq = await fetch('guias-quando.json?v=2026-11-19.5'); FX_QUANDO = rq.ok ? await rq.json() : {}; } catch (e) { FX_QUANDO = {}; } }
  var r = await Promise.all([
    supabase.from('eventos').select('tipo,dados,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(200),
    supabase.from('consentimentos').select('finalidade,aceito,texto,origem,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    supabase.from('emails_enviados').select('*').eq('contato_id', c.id).order('criado_em', { ascending: false }),
    (state.ptab === 'plataforma' || fichaV2Ativa()) ? supabase.from('plataforma_cliques').select('sessao,tela,alvo,rotulo,criado_em').eq('contato_id', c.id).order('criado_em', { ascending: false }).limit(300) : null,
    supabase.from('contatos').select('dossie,user_id').eq('id', c.id).maybeSingle(),
    supabase.from('contatos').select('dossie_origem,onboarding_em').eq('id', c.id).maybeSingle(),
    supabase.from('assinaturas').select('status,plano,moeda,teste_fim,periodo_fim,cancela_no_fim,criado_em').eq('contato_id', c.id).maybeSingle(),   // db/crm-assinaturas.sql
    supabase.from('processos_sugeridos').select('id,processo,sinais,status,mensagem,detectada_em,atualizada_em,decidida_em,respondida_em').eq('contato_id', c.id).order('atualizada_em', { ascending: false }),   // db/crm-processos-sugeridos.sql
    supabase.from('pos_call_propostas').select('id,proposta,status,criado_em').eq('contato_id', c.id).eq('proposta->>origem', 'notion').order('criado_em', { ascending: false }).limit(5),   // a leitura do Notion: base do e-mail do bilan
    buscaJornada(c.id)
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
  state.procs = r[7] && !r[7].error ? (r[7].data || []) : [];
  var lp = eventos.filter(function (e) { return e.tipo === 'link_pagamento_enviado'; })[0];
  state.pagto = lp ? { quando: lp.criado_em, rotulo: (lp.dados && lp.dados.rotulo) || (lp.dados && lp.dados.plano) || '' } : null;
  state.mails = mails;
  var nb = r[8] && !r[8].error && (r[8].data || []).filter(function (x) { return x.status !== 'descartada'; })[0];   // a mais recente que não foi descartada
  state.bilan = nb && nb.proposta && nb.proposta.origem === 'notion' && nb.proposta.notion ? { cid: c.id, id: nb.id, status: nb.status, proposta: nb.proposta, quando: nb.criado_em } : null;
  var last = function (f) { var x = cons.filter(function (k) { return k.finalidade === f; })[0]; return x ? x.aceito : false; };
  var perg = Q.filter(function (x) { return x.contato_id === c.id; });
  var resps = R.filter(function (x) { return x.contato_id === c.id; });
  var h4 = 'font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px';
  var jor = montaJornada(r[9]);
  state.jorQuiz = { cid: c.id, quizzes: jor.quizzes };   // o Dossiê usa os quizzes de cada página de entrada
  if (!state.ptab && !fichaV2Ativa()) state.ptab = mails.length || resps.length ? 'conversa' : 'ficha';   // a ficha v2 abre pela conversão (FX.abaPadrao)
  var tabs = '<div class="ptabs" role="tablist" aria-label="Ficha da pessoa">' + [['conversa', 'E-mail'], ['plataforma', 'Plataforma'], ['ficha', 'Ficha']].map(function (t) {
    return '<button class="ptab" role="tab" type="button" data-ptab="' + t[0] + '" aria-selected="' + (state.ptab === t[0]) + '">' + t[1] +
      (t[0] === 'conversa' && resps.some(function (x) { return x.status === 'nova'; }) ? ' <span class="count">nova</span>' : '') +
      '</button>';
  }).join('') + '</div>';
  if (fichaV2Ativa()) $('pessoa-page').innerHTML = renderFichaV2(c, { eventos: eventos, cons: cons, mails: mails, resps: resps, perg: perg, jor: jor, uid: uid, h4: h4, last: last });
  else $('pessoa-page').innerHTML =
    '<button class="link" data-back type="button">← Voltar</button>' +
    '<div class="pessoa-head" style="margin-top:12px"><div class="' + avClass(c) + '" style="width:52px;height:52px;font-size:16px">' + esc(ini(c)) + '</div>' +
    '<div style="min-width:0;flex:1"><h2 style="font-size:24px">' + esc(displayName(c)) + '</h2><p class="sub" style="margin:2px 0 0">' + esc(c.email) + '</p>' +
    '<div class="ctx" style="margin-top:8px">' + urgPill(c.urgencia) + '<span class="pill">' + esc(stageLabel(c.estagio)) + '</span><span class="pill">' + esc(personaLabel(c)) + (subLabel(c) ? ' · ' + esc(subLabel(c)) : '') + '</span></div></div></div>' +
    '<p class="sub" style="margin-top:10px">' + (c.motivo ? 'Por que precisa de atenção: ' + esc(c.motivo) : 'Urgência ' + esc(URG[c.urgencia].toLowerCase()) + ': ' + esc(URG_WHY[c.urgencia])) + '</p>' +
    '<div class="actions" style="margin-top:14px">' +
    '<button class="btn primary" type="button" data-emailfor="' + esc(c.id) + '">Escrever e-mail</button>' +
    '<button class="btn" type="button" data-open1a1="' + esc(c.id) + '">Marcar 1:1</button>' +
    '<div class="sel"><select id="stage-pick" aria-label="Mudar estágio">' + STAGES.map(function (s) { return '<option value="' + s.k + '"' + (s.k === c.estagio ? ' selected' : '') + '>Estágio: ' + s.l + '</option>'; }).join('') + '</select></div></div>' +
    processosSugeridosHtml(state.procs) +
    onbResumoHtml(c) +
    '<div id="dossie-box">' + dossieHtml(c, state.dos.d, state.dos.err, state.dos.rasc, state.dosAberto, state.dos.chk) + '</div>' +
    tabs + (state.ptab === 'conversa' ? conversaPanel(c, mails, resps, h4, jor) : state.ptab === 'plataforma' ? plataformaPanel(c, h4) :
    '<div class="pessoa-grid" style="margin-top:18px">' +
    fichaFeedHtml(eventos) +
    '<div style="display:flex; flex-direction:column; gap:16px">' +
    emailsPanel(c, mails, h4, resps, jor) +
    jornadaHtml(c, mails, resps, jor, h4) +
    '<div class="panel" style="padding:16px"><h4 style="' + h4 + '">Quem é ela</h4>' + kvHtml(respostasKv(c)) + '</div>' +
    '<div id="chk-lateral">' + checklistLateralHtml(state.dos && state.dos.chk, Date.now(), h4) + '</div>' +
    fichaMaisHtml(c, { perg: perg, resps: resps, cons: cons, last: last, h4: h4 }) +
    '</div></div>');
  var ct = $('conv-txt');
  if (ct) { var th = $('conv-thread'); if (th) th.scrollTop = th.scrollHeight; }
  ligarAoVivo(c, uid);
  if (fichaV2Ativa()) return fxPos(c);
  if (state.ptab === 'plataforma' && state.pstab === 'chat') { var fio0 = $('chat-fio'); if (fio0) fio0.scrollTop = fio0.scrollHeight; marcaChatLido(c.id).then(function () { var a0 = $('plat-abas'); if (a0) a0.innerHTML = platAbasHtml(); }); }
}

// ---------- Processos sugeridos (db/crm-processos-sugeridos.sql) ----------
// O app percebe sinais de que a pessoa pode precisar de um processo novo (ex.: moradia resolvida → CAF) e grava a
// sugestão com os sinais em palavras. Aqui você lê os sinais e decide: aprovar (com um recado opcional, que vai junto
// da pergunta do assistente no chat dela) ou descartar. Aceito por ela, o processo vira uma aba no checklist.
var PROC_LABEL = { caf: 'CAF', ameli: 'Ameli', banco: 'Banco', moradia: 'Moradia', orcamento: 'Orçamento', trabalho: 'Trabalho',
  profissao: 'Profissão regulamentada', cir: 'Integração (CIR)', estudos: 'Universidade', visa: 'Visa', visa_aupair: 'Visa au pair' };
function procLabel(k) { return PROC_LABEL[k] || k; }
function processosSugeridosHtml(lista) {
  var vivos = (lista || []).filter(function (p) { return p.status !== 'descartada'; });
  if (!vivos.length) return '';
  return '<div class="procs" style="margin-top:16px">' + vivos.map(function (p) {
    var nome = esc(procLabel(p.processo));
    var sinais = '<ul class="procs-sinais">' + (p.sinais || []).map(function (x) { return '<li>' + esc(x.texto) + '</li>'; }).join('') + '</ul>';
    if (p.status === 'detectada') {
      return '<section class="procs-card procs-novo" aria-label="Possível novo processo: ' + nome + '">' +
        '<div class="procs-tit">🔔 Possível novo processo: <b>' + nome + '</b> <span class="sub">· desde ' + esc(fmtDate(p.detectada_em)) + '</span></div>' +
        '<p class="sub" style="margin:4px 0 6px">Os sinais que ela deu na plataforma:</p>' + sinais +
        '<label class="sub" for="proc-msg-' + p.id + '" style="display:block;margin:10px 0 4px">Seu recado, junto da pergunta do assistente (opcional)</label>' +
        '<textarea id="proc-msg-' + p.id + '" class="notebox" maxlength="500" style="min-height:64px" placeholder="Ex.: Vi que você já tem moradia: a CAF pode devolver parte do aluguel."></textarea>' +
        '<div class="btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn primary" type="button" data-proc-aprovar="' + p.id + '">Aprovar e perguntar a ela</button>' +
        '<button class="btn" type="button" data-proc-descartar="' + p.id + '">Descartar</button></div>' +
        '<p class="sub" style="margin:8px 0 0">Aprovado, o assistente pergunta no chat dela se quer abrir o processo. Se ela aceitar, a aba ' + nome + ' aparece no checklist no próximo login.</p>' +
        '</section>';
    }
    var estado = p.status === 'aprovada' ? 'Perguntado a ela em ' + fmtDate(p.decidida_em) + '. Esperando a resposta.'
      : p.status === 'aceita' ? 'Ela aceitou em ' + fmtDate(p.respondida_em) + ': a aba ' + procLabel(p.processo) + ' está no checklist dela.'
      : 'Ela respondeu "agora não" em ' + fmtDate(p.respondida_em) + '.';
    return '<section class="procs-card" aria-label="Processo ' + nome + '"><div class="procs-tit">' + (p.status === 'aceita' ? '✓ ' : '') + 'Processo <b>' + nome + '</b>: <span class="sub">' + esc(estado) + '</span></div>' +
      (p.mensagem ? '<p class="sub" style="margin:4px 0 0">Seu recado: "' + esc(p.mensagem) + '"</p>' : '') +
      '<details style="margin-top:6px"><summary class="sub">Os sinais</summary>' + sinais + '</details>' +
      (p.status === 'recusada' ? '<div style="margin-top:8px"><button class="btn" type="button" data-proc-aprovar="' + p.id + '" data-proc-denovo="1">Perguntar de novo</button></div>' : '') +
      '</section>';
  }).join('') + '</div>';
}
async function decidirProcesso(t, decisao) {
  var id = Number(decisao === 'aprovar' ? t.dataset.procAprovar : t.dataset.procDescartar);
  var txt = $('proc-msg-' + id);
  if (decisao === 'descartar' && !window.confirm('Descartar esta sugestão? Ela não volta sozinha, mesmo que a pessoa dê novos sinais.')) return;
  t.disabled = true;
  var r = await supabase.rpc('crm_decidir_processo', { p_id: id, p_decisao: decisao, p_mensagem: txt && txt.value.trim() ? txt.value.trim() : null });
  if (r.error) { t.disabled = false; return fail(decisao === 'aprovar' ? 'aprovar o processo' : 'descartar o processo', r.error); }
  toast(decisao === 'aprovar' ? 'Aprovado: o assistente vai perguntar a ela.' : 'Sugestão descartada.');
  PSUG = PSUG.filter(function (p) { return p.id !== id; });
  renderToday();
  if (state.view === 'pessoa') renderPessoa();
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
var ST = { caso: null, verTodos: false, vista: 'jornada', qpop: '', previa: null, modo: 'exemplo', k: null, v: null, passo: 'texto', who: null, q: '', dev: 'pc', marcar: true, tab: 'editar', d: null, dKey: null, montado: null, vistos: {}, foco: null, salvo: '', timer: null, vazio: false, pg: null };
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
  ST.k = k; ST.vazio = false;
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

// Os modelos da lista: os da tabela sem os excluídos, ou os 8 do código quando a tabela ainda não existe.
function listaModelos() {
  return M ? M.filter(function (m) { return !m.excluido_em; }) : TPL_ORDER.map(function (k) { return { chave: k, nome: TPLS[k].label, objetivo: TPLS[k].when, automatico: false, tipo: EXIGEM_NOVIDADES[k] ? 'novidades' : 'servico' }; });
}
// A prévia abre sozinha só no passo Texto de um modelo que já existe; quem apertar o botão decide (e a escolha vale em todo lugar).
function previaAberta() { if (ST.vazio) return false; return ST.previa == null ? (!ST.criar && ST.passo === 'texto') : !!ST.previa; }
function renderModelos() {
  var aviso = $('mod-aviso');
  var msg = !M ? 'A tabela de modelos ainda não está no banco (rode db/crm-modelos-email.sql). Mostrando os 8 modelos do painel, com o texto do código, sem editar.'
    : !temBlocos() ? 'Para editar no estúdio, rode db/crm-estudio-emails-2.sql no Supabase. Até lá, a tela mostra os modelos e as versões sem editar.' : '';
  aviso.hidden = !msg; aviso.textContent = msg;
  $('mod-export').disabled = !M;
  $('studio').dataset.tab = ST.tab;
  $('studio').dataset.previa = previaAberta() ? '1' : '0';
  var naJornada = ST.vista === 'jornada';
  $('mod-jornada').hidden = !naJornada; $('mod-estudio').hidden = naJornada;
  document.querySelectorAll('[data-vista]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.vista === ST.vista)); });
  if (naJornada) return renderJornada();
  document.querySelectorAll('[data-sttab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sttab === ST.tab)); });
  var lista = listaModelos();
  if (ST.vazio) { /* página sem e-mail: nada a abrir */ }
  else if (!ST.k || !lista.some(function (m) { return m.chave === ST.k; })) { if (lista.length) abrirModelo(lista[0].chave); }
  else if (ST.v != null && !versaoAberta() && M) abrirModelo(ST.k);
  if (ST.criar && temEstudio3()) { $('st-cab').innerHTML = ''; renderCriar(); } else { ST.criar = null; renderEditor(lista); }
  renderPrevia();
  ajustaCab();
}


// ---------- Jornada: uma linha por página, uma coluna por etapa do funil ----------
function situacaoDoModelo(m) {
  var v = M ? versaoAtual(m.chave) : null, obra = M ? versaoEmObra(m.chave) : null;
  if (!v) return ['Sem versão', 'rasc'];
  if (obra && obra.etapa === 'revisao') return ['Em revisão', 'rev'];
  if (obra && v.etapa !== 'no_ar') return ['Rascunho', 'rasc'];
  if (v.etapa === 'no_ar') return [m.criado_no_estudio && m.envio_gatilho && !m.envio_ligado ? 'No ar · envio desligado' : 'No ar', 'noar'];
  return [(ETAPA_EMAIL[v.etapa] || [v.etapa])[0], 'rasc'];
}
function jrCard(m) {
  var s = situacaoDoModelo(m);
  return '<button type="button" class="jr-mc" data-jr-abrir="' + esc(m.chave) + '"><span class="t">' + esc(m.nome) + '</span><span class="jr-pill ' + s[1] + '">' + esc(s[0]) + '</span></button>';
}
function jrCelula(l, e) {
  var it = l.celulas[e.k];
  if (it.length) return it.map(jrCard).join('');
  var qb = !!l.quebrada[e.k], criavel = temEstudio3() && l.k !== 'TR';
  var rot = '<b>Falta' + (qb ? ' · cadeia quebrada' : '') + '</b>' + (criavel ? '<span>+ criar aqui</span>' : '');
  return criavel ? '<button type="button" class="jr-vazio' + (qb ? ' gap' : '') + '" data-jr-criar="' + esc(l.k + '|' + e.k) + '">' + rot + '</button>'
    : '<div class="jr-vazio sem">' + rot + '</div>';
}
function jrCobertura(l) {
  return '<div class="jr-cov"><span class="pips" aria-hidden="true">' + JR.ETAPAS.map(function (e) { return '<span class="pip' + (l.celulas[e.k].length ? ' on' : '') + '"></span>'; }).join('') + '</span>' + l.cobertas + ' de ' + JR.ETAPAS.length + ' etapas com e-mail</div>';
}
function renderJornada() {
  var J = JR.montaJornada(listaModelos(), TX), box = $('mod-jornada');
  var stats = '<div class="jr-stats" role="status"><span><b>' + J.stats.total + '</b>percursos</span><span><b>' + J.stats.semEmail + '</b>etapas sem e-mail</span><span><b>' + J.stats.quebradas + '</b>cadeias quebradas</span></div>';
  var guia = '<p class="jr-guia">Cada linha é um percurso (uma landing page de entrada). Cada coluna é uma etapa do funil. <b>Clique num e-mail</b> para editar; <b>clique em “Falta”</b> para criar o que ainda não existe.</p>';
  var cab = '<div class="jr-h">Percurso</div><div class="jr-h">Entrada<small>landing page</small></div>' + JR.ETAPAS.map(function (e) { return '<div class="jr-h">' + esc(e.nome) + '<small>' + esc(e.sub) + '</small></div>'; }).join('');
  var linhas = J.linhas.map(function (l) {
    var entrada = l.rota ? '<a href="' + esc(l.rota) + '" target="_blank" rel="noopener" class="jr-lp">' + esc(l.rota.replace(/^\/guias\/|\/$/g, '')) + '</a><span class="sub">abre no site</span>' : '<span class="sub">e-mails de todos os percursos</span>';
    return '<div class="jr-r"><span class="jr-id">' + esc(l.k) + '</span><h3>' + esc(l.nome) + '</h3>' + jrCobertura(l) + '</div><div class="jr-c ctx">' + entrada + '</div>' +
      JR.ETAPAS.map(function (e) { return '<div class="jr-c">' + jrCelula(l, e) + '</div>'; }).join('');
  }).join('');
  var celular = J.linhas.map(function (l, i) {
    return '<details class="jr-tl"' + (i === 0 ? ' open' : '') + '><summary><span class="jr-id">' + esc(l.k) + '</span><h3>' + esc(l.nome) + '</h3>' + jrCobertura(l) + '</summary><ol>' +
      JR.ETAPAS.map(function (e) { return '<li class="' + (l.celulas[e.k].length ? 'has' : l.quebrada[e.k] ? 'gap' : '') + '"><div class="e">' + esc(e.nome) + '</div>' + jrCelula(l, e) + '</li>'; }).join('') + '</ol></details>';
  }).join('');
  var bandeja = function (titulo, itens, dica) {
    return itens.length ? '<details class="jr-band"><summary>' + esc(titulo) + ' <span class="jr-pill grp">' + itens.length + '</span></summary><p class="sub">' + esc(dica) + '</p><div class="jr-band-l">' + itens.map(jrCard).join('') + '</div></details>' : '';
  };
  var novo = temEstudio3() ? '<div class="jr-acoes"><button class="btn primary" type="button" id="st-novo-modelo">+ Modelo novo</button></div>' : '';
  var exc = (M || []).filter(function (m) { return m.excluido_em; });
  var excluidos = exc.length ? '<details class="jr-band"><summary>Excluídos <span class="jr-pill grp">' + exc.length + '</span></summary><p class="sub">Dá para restaurar: o e-mail volta com o Envio desligado.</p><div class="jr-band-l">' + exc.map(function (m) {
    return '<div class="st-excl-i"><span><b>' + esc(m.nome) + '</b><span class="sub">excluído em ' + esc(fmtDay(m.excluido_em)) + '</span></span><button class="btn" type="button" data-strestaurar="' + esc(m.chave) + '">Restaurar</button></div>';
  }).join('') + '</div></details>' : '';
  box.innerHTML = guia + novo + stats + '<div class="jr-scroll"><div class="jr-mx" role="table" aria-label="Percursos por etapa do funil">' + cab + linhas + '</div></div><div class="jr-cel">' + celular + '</div>' +
    '<div class="jr-bandejas">' + bandeja('Aquecimento', J.bandejas.aquecimento, 'Sequências por trilha. Não têm coluna na jornada.') + bandeja('Campanhas avulsas', J.bandejas.campanhas, 'Não pertencem a um percurso.') +
    bandeja('Sem etapa definida', J.bandejas.semEtapa, 'Classifique em “Avançado” do editor para eles entrarem na matriz.') + excluidos + '</div>';
}
// Falta um e-mail numa etapa: cria o rascunho direto (página e etapa da célula, esqueleto do objetivo, nome automático) e abre no editor novo,
// no passo Texto. "Quem recebe e quando" se ajusta no passo 1. Objetivo que pede produto ainda passa pelo assistente (precisa escolher o produto).
async function criarNaJornada(valor) {
  ST.vazio = false;
  var p = valor.split('|'), pg = p[0], et = JR.ETAPAS.filter(function (e) { return e.k === p[1]; })[0], o = et && ES.objetivo(et.objetivo), pag = TX.PAGINAS.filter(function (x) { return x.k === pg; })[0];
  if (!o || !pag || ST.criando) return;
  // O que a célula já diz: o material é o guia da página (quem pegou aquele guia) e, se o e-mail sai depois de outro e-mail, é o da etapa anterior da mesma página.
  var para = paraVazio(), mat = Object.keys(ORIGEM_PAGINA).filter(function (k) { return ORIGEM_PAGINA[k] === pg; })[0];
  if (mat) para.materiais = [mat];
  var anterior = null;
  if (o.gatilho === 'email') {
    var ordem = JR.ETAPAS.map(function (e) { return e.k; }), ate = ordem.indexOf(et.k);
    var idx = function (m) { return ordem.indexOf(JR.etapaDaJornada(Object.assign({}, m, { familia: TX.classifica(m).familia }))); };
    var antes = listaModelos().filter(function (m) { return TX.classifica(m).pagina === pg && idx(m) >= 0 && idx(m) < ate; }).sort(function (x, y) { return idx(y) - idx(x); });
    anterior = antes[0] ? antes[0].chave : null;   // o mais perto, na etapa de antes
  }
  ST.criar = { passo: 2, obj: o.k, nome: pag.nome + ' · ' + et.nome, para: para, depois_de: anterior, classe: { familia: TX.familiaDoObjetivo(o.k), pagina: pg, etapa: null, persona: null } };
  ST.vista = 'estudio'; ST.tab = 'editar';
  if (o.produto) return renderModelos();
  ST.criando = true;
  toast('Criando o e-mail em rascunho…', 3000);
  try { await criarModelo({}); } finally { ST.criando = false; }
  if (ST.criar) renderModelos();   // não gravou: cai no assistente, com o aviso de erro
}

// Os e-mails 1 e 2 do guia Campus France saem pelo código: excluir aqui não pararia o envio, então não têm o X.
function podeExcluir(m) { return !!(M && M.length && Object.prototype.hasOwnProperty.call(M[0], 'excluido_em')) && !/^cf_guia_/.test(m.chave); }
async function excluirModelo(k, voltar) {
  var m = modeloDe(k); if (!m) return;
  var pgAntes = !voltar && ST.k === k ? pgAtual(jornadaAtual()) : null;
  if (!voltar && !window.confirm('Excluir "' + m.nome + '"? Ele sai da Jornada e do "Escrever e-mail"' + (m.envio_ligado ? ' e a sequência para de sair' : '') +
    '. As versões ficam guardadas em "Excluídos", no fim da Jornada, onde dá para restaurar.')) return;
  await salvar();
  var r = await supabase.from('modelos_email').update({ excluido_em: voltar ? null : new Date().toISOString() }).eq('chave', k).select();
  if (r.error) return fail(voltar ? 'restaurar o modelo' : 'excluir o modelo', r.error);
  Object.assign(m, (r.data && r.data[0]) || { excluido_em: voltar ? null : new Date().toISOString() });
  if (!voltar && ST.k === k) {
    var irm = modelosDaPagina(jornadaAtual(), pgAntes).filter(function (x) { return x.chave !== k; });
    if (irm.length) abrirModelo(irm[0].chave); else { ST.vazio = true; ST.pg = pgAntes; ST.k = null; ST.v = null; ST.d = null; ST.dKey = null; ST.montado = null; }
  }
  if (voltar) { ST.k = k; abrirModelo(k); }
  toast(voltar ? '"' + m.nome + '" restaurado' + (m.envio_gatilho ? ' (com o Envio desligado)' : '') : '"' + m.nome + '" excluído', 3200);
  renderModelos();
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

// ---------- O editor: três passos ----------
// 1. Quem recebe e quando · 2. Texto (o próprio e-mail, editável: editor-email.js) · 3. Conferir e publicar.
var PASSOS = [['quem', 'Quem recebe e quando'], ['texto', 'Texto'], ['conferir', 'Conferir e publicar']];

// As opções de um bloco (o painel que abre sobre o bloco). semTexto: o texto do bloco se edita no próprio e-mail, então aqui só
// ficam as opções (estilo, texto se faltar um dado, "mostrar só se…"). Os campos são os de sempre (data-f = caminho no rascunho).
function camposDoBloco(b, i, semTexto) {
  var k = ST.k, ro = !podeEditar(versaoAberta());
  var f = function (campo) { return 'itens.' + i + '.' + campo; };
  var dis = ro ? ' disabled' : '';
  var corpo = '';
  var alt = function () { return campoTxt(f('alt'), b.alt, 'Se faltar um dado deste bloco, escrever', { ro: ro, ph: 'vazio: cada dado usa o plano B dele' }); };
  var txt = function (campo, rot, opts) { return semTexto ? '' : campoTxt(f(campo), b[campo], rot, opts); };
  if (b.tipo === 'texto') {
    corpo = txt('texto', 'Texto', { area: true, rows: 3, ro: ro, max: 3000 }) +
      '<label class="st-fld"><span>Estilo</span><select class="st-in" data-f="' + f('estilo') + '"' + dis + '>' + opcoes([['', 'Normal'], ['caixa', 'Em caixa (ex.: "Ficou com dúvida?")'], ['discreto', 'Discreto, em cinza']], b.estilo) + '</select></label>' + alt();
  } else if (b.tipo === 'titulo') {
    corpo = txt('texto', 'Título', { ro: ro }) + alt();
  } else if (b.tipo === 'astucia') {
    corpo = txt('texto', 'A astúcia', { area: true, rows: 3, ro: ro, max: 600 }) + txt('fonte', 'Fonte (oficial) e data', { ro: ro, max: 200, ph: 'service-public.fr F473 (06/06/2025)' }) +
      campoTxt(f('codigo'), b.codigo, 'Código da astúcia (só para você achar depois)', { ro: ro, max: 20, ph: 'A-0009' }) +
      campoTxt(f('conferida_em'), b.conferida_em, 'Conferida em (só para você)', { ro: ro, max: 20, ph: '14/11/2026' }) +
      campoTxt(f('rotulo'), b.rotulo, 'Frase de cima do cartão', { ro: ro, max: 120 }) + alt();
  } else if (b.tipo === 'pergunta') {
    corpo = txt('texto', 'Pergunta', { ro: ro }) + alt() + txt('ajuda', 'Linha de ajuda (opcional)', { ro: ro });
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
      campoTxt(f('nota'), b.nota, 'Nota (embaixo, opcional)', { ro: ro }) +
      '<label class="st-fld"><span>Cor</span><select class="st-in" data-f="' + f('estilo') + '"' + dis + '>' +
      opcoes(Object.keys(ES.ESTILOS_DESTAQUE).map(function (x) { return [x, ES.ESTILOS_DESTAQUE[x].nome]; }), b.estilo || 'escuro') + '</select></label>';
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
      (semTexto ? '' : campoTxt(f('rotulo'), b.rotulo, 'Linha pequena de cima (opcional)', { ro: ro }) + campoTxt(f('titulo'), b.titulo, 'Frase em negrito (opcional)', { ro: ro }) +
        campoTxt(f('texto'), b.texto, 'Texto', { area: true, rows: 3, ro: ro, max: 3000 }));
  } else {
    corpo = semTexto ? '' : campoTxt(f('texto'), b.texto, 'Assinatura', { ro: ro });
  }
  // "Mostrar só se…": vale para todo bloco, menos o de etapa (que já é condição).
  if (b.tipo !== 'etapa') {
    var cond = varsDe(k).filter(function (x) { return ES.CAT[x] && (ES.CAT[x].t === 'texto' || ES.CAT[x].t === 'sim'); });
    var ops = [];
    cond.forEach(function (x) { ops.push(['#' + x, 'Só se tiver {' + x + '}']); ops.push(['^' + x, 'Só se NÃO tiver {' + x + '}']); });
    corpo += '<label class="st-fld"><span>Mostrar</span><select class="st-in" data-f="' + f('se') + '"' + dis + '>' + opcoes(ops, b.se, 'Sempre') + '</select></label>';
  }
  return corpo;
}

// Dados da pessoa e plano B: cada dado, o que é e o que acontece se faltar. O plano B vale para o modelo todo.
function contextoHtml(k, d, ro) {
  return varsDe(k).map(function (x) {
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
}

function passoTexto(m, v, d, ro) {
  if (!d) {
    return v ? '<p class="st-msg tip">Texto guardado desta versão (ainda sem blocos):</p><p class="previewsubj" style="font-size:15px">' + marcarVars(v.assunto) + '</p>' +
      (v.preheader ? '<p class="sub" style="margin:0">Prévia: ' + marcarVars(v.preheader) + '</p>' : '') + '<div class="mailbody">' + marcarVars(v.corpo_texto) + '</div>' : '<div class="empty">Sem versão.</div>';
  }
  return EE.html() + '<details class="ee-ctx"><summary>Dados da pessoa e plano B <span class="sub">' + varsDe(m.chave).length + ' dados</span></summary><div class="ee-ctx-in">' + contextoHtml(m.chave, d, ro) + '</div></details>';
}

function passoConferir(m, v, d, confs, travas, testado, vistos, vs) {
  var novoM = !!m.criado_no_estudio;
  var s5 = d ? '<ul class="st-ready">' + confs.map(function (x) { return '<li class="' + (x.ok ? 'y' : x.trava ? 'n' : 'w') + '">' + esc(x.txt) + '</li>'; }).join('') +
    '<li class="' + (vistos >= 2 ? 'y' : 'w') + '">Prévia vista com ' + vistos + (vistos === 1 ? ' pessoa' : ' pessoas') + (vistos >= 2 ? '' : ' (veja com pelo menos duas)') + '</li>' +
    '<li class="' + (testado ? 'y' : 'n') + '">' + (testado ? 'Teste enviado em ' + esc(fmtWhen(v.testado_em)) : 'Teste para você ainda não enviado (precisa para publicar)') + '</li></ul>' +
    (novoM && m.envio_gatilho ? '<p class="st-msg tip">Sequência: ao publicar, ' + (m.envio_ligado ? 'o próximo envio já sai com este texto.' : 'ligue o Envio (em Quem recebe e quando) para começar a sair.') + '</p>'
    : m.automatico ? '<p class="st-msg tip">Saem sozinhos: ao publicar, o próximo envio já sai com este texto. A versão de agora fica guardada.</p>' : '<p class="st-msg tip">Ao publicar, o "Escrever este e-mail" da ficha passa a abrir com este texto (os manuais saem em texto simples, como hoje).</p>')
    : '<p class="st-msg tip">Crie uma versão nova para montar em blocos e conferir.</p>';
  var s6 = '<ul class="st-vers">' + vs.map(function (x) {
    var quando = x.etapa === 'no_ar' ? 'no ar desde ' + fmtDay(x.publicado_em) : x.publicado_em ? 'saiu em ' + fmtDay(x.publicado_em) : 'criada em ' + fmtDay(x.criado_em);
    return '<li' + (x.versao === ST.v ? ' aria-current="true"' : '') + '><button type="button" class="st-verbtn" data-stver="' + x.versao + '"><b>v' + x.versao + '</b> ' + pillDe(ETAPA_EMAIL, x.etapa) +
      '<span class="sub">' + esc(quando) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span></button>' +
      (x.etapa === 'arquivado' && temBlocos() ? '<button type="button" class="btn" data-stvoltar="' + x.versao + '">Voltar para esta</button>' : '') + '</li>';
  }).join('') + '</ul>';
  return '<section class="ee-sec"><h4>Pronto para usar?</h4>' + s5 + '</section><section class="ee-sec"><h4>Versões</h4>' + s6 + '</section>';
}

// Passo 1 — "Quem recebe e quando": uma frase com o essencial e o contador de quem entra hoje; os detalhes abrem só quando pedidos.
function passoQuem(m, ro) {
  var k = m.chave, novoM = !!m.criado_no_estudio, objM = novoM ? ES.objetivo(m.objetivo_chave) : null;
  var est = EQ.estimar(C, m, origensDe), fr = EQ.fraseQuem(m, { material: origLabel, etapa: etapaGuiaLabel });
  var MOT = { persona: 'de outra persona', material: 'de outro material', etapa: 'de outra resposta', estagio: 'de outro estágio', novidades: 'sem aceitar novidades' };
  var fora = Object.keys(est.porMotivo).map(function (x) { return est.porMotivo[x] + ' ' + MOT[x]; }).join(', ');
  var contador = '<div class="ee-conta" role="status"><span class="n">' + est.n + '</span><span><b>pessoas</b> recebem este e-mail hoje<span class="sub">de ' + est.total + ' na base' + (fora && est.n !== est.total ? ' · de fora: ' + esc(fora) : '') + '. É uma estimativa pelas regras; o Worker confere de novo a cada envio.</span></span></div>';
  var avancado = '<details class="ee-av"><summary>Avançado</summary>' + classeHtml(m) + '<label class="st-fld"><span>Objetivo</span><textarea class="st-in" id="st-objetivo" rows="2" maxlength="300">' + esc(m.objetivo) + '</textarea></label>' +
    (novoM ? '<dl class="tplmeta"><dt>Do catálogo</dt><dd>' + esc(objM ? objM.nome : '—') + '</dd><dt>Tipo</dt><dd>' + pillDe(TIPO_EMAIL, m.tipo) + ' <span class="sub">' + esc(ES.TIPO_RODAPE[m.tipo] || '') + '</span></dd></dl>' : '') +
    (podeExcluir(m) ? '<div class="ee-excluir"><button type="button" class="btn" data-stexcluir="' + esc(m.chave) + '">Excluir este modelo</button><small class="sub">Sai da Jornada e do "Escrever e-mail". As versões ficam guardadas em "Excluídos", na Jornada, e dá para restaurar.</small></div>' : '') + '</details>';
  if (!novoM) {
    var sai0 = esc(String(m.como_sai || 'conforme o código').replace(/\.$/, '').replace(/^./, function (x) { return x.toLowerCase(); }));
    return '<section class="ee-quem"><p class="ee-frase">Vai para quem entrou por <span class="ee-ch fixo">' + esc(fr.materiais) + '</span> e respondeu <span class="ee-ch fixo">' + esc(fr.etapas) + '</span>' + (fr.novidades ? ' <span class="ee-ch fixo">só quem aceitou novidades</span>' : '') + '. Sai <span class="ee-ch fixo">' + sai0 + '</span>.</p>' + contador +
      '<p class="st-msg tip">Neste modelo antigo, quem recebe e quando continuam no código: o Worker confere o aceite de novidades a cada envio, mesmo que alguém mude o texto aqui.</p></section>' + avancado;
  }
  var chip = function (id, rot, vazio) { return '<button type="button" class="ee-ch' + (vazio ? ' vazio' : '') + '" data-qpop="' + id + '" aria-expanded="' + (ST.qpop === id) + '">' + esc(rot) + ' <span aria-hidden="true">▾</span></button>'; };
  var seq = !!m.envio_gatilho, minutos = m.envio_minutos, quando = !seq ? 'só quando você envia' : minutos != null ? minutos + (minutos === 1 ? ' minuto' : ' minutos') + ' depois' : m.envio_dias != null ? (m.envio_dias === 0 ? 'no mesmo dia' : m.envio_dias + (m.envio_dias === 1 ? ' dia' : ' dias') + ' depois') : 'defina o envio';
  var semBase = seq && m.envio_gatilho !== 'compra' && !m.envio_depois_de;
  var base = m.envio_gatilho === 'material' ? ' de pegar ' + origLabel(m.envio_depois_de) : m.envio_gatilho === 'email' ? ' do e-mail "' + modeloNome(m.envio_depois_de) + '"' : m.envio_gatilho === 'compra' ? ' da compra' : '';
  var pop = '';
  if (ST.qpop === 'mat') pop = '<fieldset class="st-pq"><legend>Entrou por (material)</legend><div class="st-pq-op">' + materiaisConhecidos().map(function (o) { return '<label class="st-check"><input type="checkbox" data-pq="materiais" value="' + esc(o[0]) + '"' + ((((m.para_quem || {}).materiais || []).indexOf(o[0]) >= 0) ? ' checked' : '') + '> ' + '> ' + esc(o[1]) + '</label>'; }).join('') + '</div><small>Nenhum marcado = qualquer material.</small></fieldset>';
  else if (ST.qpop === 'etapa') pop = '<fieldset class="st-pq"><legend>Respondeu (etapa do guia)</legend><div class="st-pq-op">' + etapasDosMateriais(m.para_quem).map(function (o) { return '<label class="st-check"><input type="checkbox" data-pq="etapas" value="' + esc(o[0]) + '"' + (((m.para_quem || {}).etapas || []).indexOf(o[0]) >= 0 ? ' checked' : '') + '> ' + esc(o[1]) + '</label>'; }).join('') + '</div>' + (etapasDosMateriais(m.para_quem).length ? '' : '<small>O material escolhido não tem pergunta de etapa: vale para qualquer resposta.</small>') + '<small>Nenhuma marcada = qualquer resposta (quem não marcou etapa também recebe).</small></fieldset>';
  else if (ST.qpop === 'sai') pop = envioHtml(m);
  var popHtml = pop ? '<div class="ee-pop2" role="dialog" aria-label="Mudar">' + pop + '<button type="button" class="btn" data-qpop="">Pronto</button></div>' : '';
  var mats = ((m.para_quem || {}).materiais || []).length, ets = ((m.para_quem || {}).etapas || []).length;
  return '<section class="ee-quem"><p class="ee-frase">Vai para quem entrou por ' + chip('mat', fr.materiais, !mats) + ' e respondeu ' + chip('etapa', fr.etapas, !ets) +
    (m.tipo === 'novidades' ? ' <span class="ee-ch fixo">só quem aceitou novidades</span>' : '') + '. Sai ' + chip('sai', semBase ? 'escolha depois de quê' : quando + base, !seq || semBase) + '.</p>' + popHtml + contador +
    '<p class="sub ee-dica">Toque nos campos coloridos para mudar.</p></section>' + avancado;
}

// O cabeçalho do editor parte da página de entrada (a landing): escolha a página e veja os e-mails dela por etapa do funil. A etapa
// que ainda não tem e-mail vira "+ criar" (cria o rascunho já preenchido). Os dados vêm da mesma matriz da Jornada.
var PONTO_ESTADO = { noar: 'ok', rev: 'rev', rasc: 'dr' };
function jornadaAtual() { return JR.montaJornada(listaModelos(), TX); }
function linhaDoModelo(J, k) {
  var achou = null;
  J.linhas.forEach(function (l) { JR.ETAPAS.forEach(function (e) { if (l.celulas[e.k].some(function (m) { return m.chave === k; })) achou = l.k; }); });
  if (achou) return achou;
  return ['aquecimento', 'campanhas', 'semEtapa'].some(function (g) { return J.bandejas[g].some(function (m) { return m.chave === k; }); }) ? 'OUT' : null;
}
function pgAtual(J) { return ST.vazio && ST.pg ? ST.pg : (linhaDoModelo(J, ST.k) || 'OUT'); }
function modelosDaPagina(J, pg) {   // na ordem das etapas; "OUT" são os que não moram numa página (aquecimento, campanhas, sem etapa)
  if (pg === 'OUT') return [].concat(J.bandejas.aquecimento, J.bandejas.campanhas, J.bandejas.semEtapa);
  var l = J.linhas.filter(function (x) { return x.k === pg; })[0], r = [];
  if (l) JR.ETAPAS.forEach(function (e) { l.celulas[e.k].forEach(function (m) { r.push(m); }); });
  return r;
}
function cabecalhoHtml(J, pg) {
  var temOutros = ['aquecimento', 'campanhas', 'semEtapa'].some(function (g) { return J.bandejas[g].length; });
  // As páginas de entrada num dropdown (a escolha abre o primeiro e-mail da página, ou mostra as etapas para criar).
  var paginas = '<select class="ee-pg-sel" id="st-pg-sel" aria-label="Página de entrada">' + J.linhas.map(function (l) {
    return '<option value="' + esc(l.k) + '" data-stpg="' + esc(l.k) + '" aria-current="' + (l.k === pg) + '"' + (l.k === pg ? ' selected' : '') + ' title="' + esc(l.nome) + ' · ' + l.cobertas + ' de ' + JR.ETAPAS.length + ' etapas com e-mail">' + esc(l.k) + ' · ' + esc(l.nome) + '</option>';
  }).join('') + (temOutros ? '<option value="OUT" data-stpg="OUT" aria-current="' + (pg === 'OUT') + '"' + (pg === 'OUT' ? ' selected' : '') + '>Outros e-mails</option>' : '') + '</select>';
  var pill = function (m, rotulo) {
    var sit = situacaoDoModelo(m), atual = !ST.vazio && ST.k === m.chave;
    var ac = (temEstudio3() ? '<button type="button" class="ee-mini add" data-stnovo-aqui="1" aria-label="Novo e-mail nesta página" title="Novo e-mail nesta página">+</button>' : '') +
      (podeExcluir(m) ? '<button type="button" class="ee-mini del" data-stexcluir="' + esc(m.chave) + '" aria-label="Excluir ' + esc(m.nome) + '" title="Excluir este e-mail (dá para restaurar em Excluídos)">×</button>' : '');
    return '<span class="ee-et-w"><button type="button" class="ee-passo ee-et" data-tpl-pick="' + esc(m.chave) + '" aria-current="' + atual + '" title="' + esc(m.nome + ' · ' + sit[0]) + '"><i class="ee-sd ' + (PONTO_ESTADO[sit[1]] || 'dr') + '" aria-hidden="true"></i><span class="t"><small>' + esc(rotulo) + '</small>' + esc(m.nome) + '</span></button>' + (ac ? '<span class="ee-et-ac">' + ac + '</span>' : '') + '</span>';
  };
  var etapas, linha = J.linhas.filter(function (l) { return l.k === pg; })[0];
  if (pg === 'OUT' || !linha) {
    var nomes = { aquecimento: 'Aquecimento', campanhas: 'Campanha', semEtapa: 'Sem etapa' };
    etapas = ['aquecimento', 'campanhas', 'semEtapa'].map(function (g) { return J.bandejas[g].map(function (m) { return pill(m, nomes[g]); }).join(''); }).join('');
  } else {
    etapas = JR.ETAPAS.map(function (e) {
      var cel = linha.celulas[e.k];
      if (cel.length) return cel.map(function (m) { return pill(m, e.nome); }).join('');
      if (linha.k === 'TR' || !temEstudio3()) return '<span class="ee-passo ee-et falta sem" title="Ainda não existe"><span class="t"><small>' + esc(e.nome) + '</small>falta</span></span>';
      return '<button type="button" class="ee-passo ee-et falta" data-jr-criar="' + esc(linha.k + '|' + e.k) + '" title="Criar o e-mail desta etapa, já preenchido"><span class="t"><small>' + esc(e.nome) + '</small>+ criar</span></button>';
    }).join('');
  }
  return '<div class="ee-linha-pg"><button type="button" class="ee-volta" data-vista="jornada">← Jornada</button><span class="ee-rot">Página de entrada</span><nav class="ee-irmaos" aria-label="Páginas de entrada">' + paginas + '</nav></div>' +
    '<div class="ee-linha-pg"><span class="ee-rot">E-mails da página</span><nav class="ee-irmaos" aria-label="E-mails da página, por etapa">' + etapas + '</nav></div>';
}
// A altura do cabeçalho fixo vai para o CSS: os painéis de baixo se ajustam para caber na tela.
function ajustaCab() {
  var st = $('studio'), c = $('st-cab');
  if (st && st.style && st.style.setProperty) st.style.setProperty('--st-head-h', ((c && c.offsetHeight) || 0) + 'px');
}

function renderEditor(lista) {
  var box = $('st-edit'), cab = $('st-cab');
  if (ST.vazio && M) {   // escolheu uma página de entrada que ainda não tem e-mail
    var Jv = jornadaAtual(); cab.innerHTML = '<div class="ee-fixo">' + cabecalhoHtml(Jv, pgAtual(Jv)) + '</div>';
    box.innerHTML = '<div class="empty">Esta página ainda não tem e-mail. Clique em <b>+ criar</b> numa etapa, acima, para começar pelo rascunho já preenchido.</div>';
    ajustaCab(); return;
  }
  cab.innerHTML = '';
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
  acoes = acoes + '<button class="btn" type="button" id="st-previa-tg" aria-pressed="' + previaAberta() + '">' + (previaAberta() ? 'Esconder prévia' : 'Ver como chega') + '</button>';
  var topo = '<div class="st-head"><div class="st-head-t"><h3 class="st-title">' + esc(m.nome) + '</h3><div class="st-pills">' + pillDe(TIPO_EMAIL, m.tipo) + (v ? pillDe(ETAPA_EMAIL, v.etapa) + '<span class="sub">v' + v.versao + '</span>' : '') +
    '<span class="sub" id="st-salvo">' + esc(ST.salvo) + '</span></div></div><div class="st-acts">' + acoes + '</div></div>' +
    (v && ro && temBlocos() ? '<p class="st-msg tip">' + (v.etapa === 'no_ar' ? 'Esta é a versão No ar: é ela que sai. ' : v.etapa === 'arquivado' ? 'Esta versão já saiu e fica guardada como está. ' : '') +
      (v.blocos ? '' : 'Ainda está em texto corrido (como era no código). ') + 'Para mudar, crie uma versão nova: a de agora continua saindo até você publicar a nova.</p>' : '') +
    (v && !ro && v.etapa === 'revisao' ? '<p class="st-msg tip">Em revisão. ' + (testado ? 'Teste enviado em ' + esc(fmtWhen(v.testado_em)) + '.' : 'Falta enviar o teste para você.') + ' Mudar o texto pede um teste novo.</p>' : '');

  var passos = '<div class="ee-passos" role="tablist" aria-label="Passos do e-mail">' + PASSOS.map(function (p, n) {
    var aviso = p[0] === 'conferir' && d && travas ? '<span class="ee-aviso" title="' + travas + ' para resolver">' + travas + '</span>' : '';
    return '<button type="button" role="tab" class="ee-passo" data-eepasso="' + p[0] + '" aria-selected="' + (ST.passo === p[0]) + '"><span class="n">' + (n + 1) + '</span>' + esc(p[1]) + aviso + '</button>';
  }).join('') + '</div>';
  var corpo = ST.passo === 'quem' ? passoQuem(m, ro) : ST.passo === 'conferir' ? passoConferir(m, v, d, confs, travas, testado, vistos, vs) : passoTexto(m, v, d, ro);
  // O header fica fixo logo abaixo das abas Jornada / Editar e-mails (o e-mail rola por baixo): página de entrada, e-mails dela por etapa,
  // nome e ações, passos e, no Texto, a barra de desfazer.
  var Jc = jornadaAtual();
  cab.innerHTML = '<div class="ee-fixo">' + cabecalhoHtml(Jc, pgAtual(Jc)) + topo + '<div class="ee-barra-passos">' + passos + (ST.passo === 'texto' && d ? EE.topo() : '') + '</div></div>';
  box.innerHTML = corpo;
  ajustaCab();
  EE.depois();
}
// O e-mail editável pede ao estúdio o rascunho, o catálogo de dados e o salvamento (tudo isto já existe aqui).
// Com a prévia aberta em "com exemplo" e um caso escolhido, o editor mostra só os blocos daquele caso (os outros seguem guardados).
function casoDoEditor() {
  var m = M ? modeloAtual() : null;
  if (!m || ST.criar || ST.verTodos || !previaAberta() || (ST.modo === 'dados' || ST.modo === 'chaves')) return null;
  var casos = casosDaPrevia(ST.k), caso = casoEscolhido(casos);
  return caso ? { caso: caso, dados: dadosPara(ST.k, pessoaExemplo(m, caso)) } : null;
}
function blocoDoCasoVisivel(b) {
  var cx = casoDoEditor(), c = cx && /^([#^])(\w+)$/.exec(String(b.se || ''));
  if (!c || !(c[2] in cx.dados) || ES.CAT[c[2]] == null || ES.CAT[c[2]].t !== 'sim') return true;
  return (c[1] === '#') === !!cx.dados[c[2]];
}
function notaDoFiltro(ocultos) {
  var cx = casoDoEditor();
  if (cx) return '<p class="ee-filtro">Só os trechos de <b>' + esc(cx.caso.grupo + ' · ' + cx.caso.rotulo) + '</b>' + (ocultos ? ' (' + ocultos + ' de outros casos escondidos)' : '') + '. <button type="button" class="ee-volta" data-stvertodos="1">Mostrar todos os casos</button></p>';
  if (ST.verTodos && previaAberta() && ES.casosDe(ST.k).length) return '<p class="ee-filtro">Mostrando todos os casos. <button type="button" class="ee-volta" data-stvertodos="1">Só o caso da prévia</button></p>';
  return '';
}
EE.iniciar({
  ES: ES,
  rascunho: function () { return ST.d; },
  somenteLeitura: function () { return !podeEditar(versaoAberta()); },
  setCampo: function (caminho, valor) { setCampo(caminho, valor); },
  mudou: function () { aoEditar({ canvas: true }); },
  camposDoBloco: camposDoBloco,
  dados: function () { return varsDe(ST.k).filter(function (x) { return ES.CAT[x] && ES.CAT[x].t !== 'sim' && ES.CAT[x].t !== 'pronto' && !/^link_/.test(x); }).map(function (x) { return [x, ES.CAT[x].o]; }); },
  disponiveis: function () { var vs = varsDe(ST.k); return { etapa: vs.some(function (x) { return ES.CAT[x] && ES.CAT[x].etapa; }), toques: vs.some(function (x) { return ES.CAT[x] && ES.CAT[x].t === 'pronto'; }) }; },
  visivel: blocoDoCasoVisivel,
  notaFiltro: notaDoFiltro,
  rodapeTexto: function () { var m = modeloAtual(); return ST.d && m ? ES.rodapeDe(ST.d, m.tipo) : ''; }
});

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
// `meio` (opcional) entra no lugar dos grupos Persona, Material de origem e Etapa do guia: no passo 2 do modelo novo, "Onde este
// e-mail mora" substitui os três. Persona/material/etapa continuam editáveis depois, no próprio modelo (popovers do "Para quem").
function paraQuemHtml(para, attr, obj, produtoFixo, meio) {
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
  return prod + (meio != null ? meio :
    grupo('Persona', 'personas', Object.keys(PERSONAS).filter(function (k) { return k !== 'sem'; }).map(function (k) { return [k, PERSONAS[k]]; }), 'Nenhuma marcada = todas.') +
    grupo('Material de origem', 'materiais', materiaisConhecidos(), 'Só quem pegou um destes guias. Nenhum = qualquer origem.') +
    grupo('Etapa do guia', 'etapas', etapasDosMateriais(para), 'Só quem marcou uma destas etapas no guia. Nenhuma = qualquer etapa (quem não marcou etapa também recebe).')) +
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
// As etapas do guia dependem do material: cada guia tem a sua pergunta (Campus France, Alternância 30+, Au pair). Com materiais marcados,
// só entram as etapas deles (mais as já marcadas, para dar para desmarcar); sem material marcado, entram todas, como antes.
var ETAPA_DO_MATERIAL = { 'guia-etudes-en-france-2027': 'cf-', 'guia-email-alt30': 'alt-', 'guia-checklist-chegada-au-pair': 'ap-' };
function etapasDosMateriais(para) {
  var mats = (para && para.materiais) || [], marcadas = (para && para.etapas) || [];
  if (!mats.length) return ES.ETAPAS_FILTRO;
  var pre = mats.map(function (x) { return ETAPA_DO_MATERIAL[x]; }).filter(Boolean);
  return ES.ETAPAS_FILTRO.filter(function (e) { return pre.some(function (p) { return e[0].indexOf(p) === 0; }) || marcadas.indexOf(e[0]) >= 0; });
}
function etapaGuiaLabel(k) { var e = ES.ETAPAS_FILTRO.filter(function (x) { return x[0] === k; })[0]; return e ? e[1].replace(/^[^:]+: /, '') : k; }
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
      '<p class="st-msg tip">' + esc(ES.TIPO_RODAPE[o.tipo]) + '</p>' + paraQuemHtml(cr.para, 'data-novopara', o, false,
      '<fieldset class="st-classe" style="border:0;padding:0;margin:0"><legend class="sub">Onde este e-mail mora</legend>' +
      (temColunasReais() ? '' : '<p class="st-msg warn">Para classificar, rode db/crm-taxonomia-modelos.sql no Supabase.</p>') +
      classeSelects(cr.classe, 'data-novoclasse', !temColunasReais()) + '</fieldset>');
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
  if (temColunasReais()) { var cc = cr.classe || {}; linha.familia = cc.familia || null; linha.pagina = cc.pagina || null; linha.etapa = cc.etapa || null; linha.persona = cc.persona || null; }
  var dep = cr.depois_de !== undefined ? cr.depois_de : o.depois_de;   // criado pela Jornada: o e-mail da etapa de antes (ou nenhum)
  if (o.sai === 'sequencia') {
    linha.envio_gatilho = o.gatilho; linha.envio_dias = o.dias; linha.envio_hora = o.hora;
    linha.envio_depois_de = o.gatilho === 'compra' ? para.produto : o.gatilho === 'material' ? ((para.materiais || [])[0] || null) : (modeloDe(dep) ? dep : null);
  }
  var d = ES.esqueleto(o.k), mt = ES.montar(d, o.tipo);
  var r1 = await supabase.from('modelos_email').insert(linha);
  if (r1.error) { btn.disabled = false; btn.textContent = 'Criar o modelo (rascunho)'; return fail('criar o modelo', r1.error); }
  var r2 = await supabase.from('modelos_email_versoes').insert({ chave: chave, versao: 1, etapa: 'rascunho', assunto: mt.assunto, preheader: mt.preheader, corpo_texto: mt.corpo_texto,
    corpo_html: mt.corpo_html, blocos: d, nota: 'criada pelo objetivo ' + o.nome });
  if (r2.error) return fail('criar a versão 1', r2.error);
  ST.criar = null; ST.k = chave; ST.passo = 'texto';
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
  var minutos = m.envio_minutos != null ? m.envio_minutos : null;
  var completo = m.envio_gatilho && m.envio_depois_de && (minutos != null || (m.envio_dias != null && m.envio_hora != null));
  var quando = minutos != null ? minutos + (minutos === 1 ? ' minuto' : ' minutos') + ' depois' : (m.envio_dias === 0 ? 'no mesmo dia' : m.envio_dias + (m.envio_dias === 1 ? ' dia' : ' dias') + ' depois');
  var resumo = completo ? 'Sai sozinho ' + quando + ' ' +
    (m.envio_gatilho === 'email' ? 'do e-mail "' + modeloNome(m.envio_depois_de) + '"' : m.envio_gatilho === 'material' ? 'de pegar ' + origLabel(m.envio_depois_de) : 'da compra do ' + (pq.produto_nome || produtoNome(m.envio_depois_de))) +
    (minutos != null ? ', na primeira rodada do Worker depois disso' : ', por volta das ' + m.envio_hora + 'h05 de Brasília') + ', uma vez por pessoa, para: ' + paraResumo(m) + '.' : 'Complete o Envio para poder ligar.';
  h += '<div class="st-envio"><label class="st-fld"><span>Depois de quê</span><select class="st-in" data-envio="gatilho">' + opcoes(gats, m.envio_gatilho) + '</select></label>' +
    '<label class="st-fld"><span>Qual</span><select class="st-in" data-envio="depois_de">' + qual + '</select></label>' +
    '<label class="st-fld"><span>Quantos dias depois</span><input class="st-in" type="number" min="0" max="120" data-envio="dias" value="' + esc(m.envio_dias == null ? '' : m.envio_dias) + '"></label>' +
    '<label class="st-fld"><span>Em que horário</span><select class="st-in" data-envio="hora">' + opcoes(HORAS, m.envio_hora == null ? '' : String(m.envio_hora), 'Escolha') + '</select></label>' +
    '<label class="st-fld"><span>Ou quantos minutos depois (vale no lugar de dias e horário)</span><input class="st-in" type="number" min="1" max="1440" data-envio="minutos" placeholder="vazio = dias e horário" value="' + esc(minutos == null ? '' : minutos) + '"></label></div>' +
    '<p class="st-msg tip">' + esc(resumo) + '</p>' +
    '<div class="st-ligado ' + (m.envio_ligado ? 'on' : '') + '"><span><b>' + (m.envio_ligado ? 'Envio ligado' : 'Envio desligado') + '</b>' +
    (m.envio_ligado ? ' desde ' + esc(fmtWhen(m.envio_ligado_em)) + '. Quem já tinha passado do horário antes disso não recebe.' : noAr ? ' Ao ligar, vale para quem passar do horário daqui para a frente.' : ' Publique uma versão (No ar) para poder ligar.') + '</span>' +
    '<button class="btn' + (m.envio_ligado ? '' : ' primary') + '" type="button" id="st-envio-ligar"' + (!m.envio_ligado && (!completo || !noAr) ? ' disabled' : '') + '>' + (m.envio_ligado ? 'Desligar' : 'Ligar o envio') + '</button></div>' +
    (m.tipo === 'novidades' ? '<p class="st-msg tip">Novidades: o banco e o Worker conferem o aceite mais recente a cada envio. Quem pedir para sair para de receber na rodada seguinte.</p>' : '') +
    '<p class="st-msg tip">O Worker roda as sequências de hora em hora (Cron Trigger "5 * * * *") e, para o Envio em minutos, a cada 5 minutos ("*/5 * * * *"); README do Worker, seção 23. Mudar o Envio ou o Para quem com ele ligado recomeça a contagem a partir de agora.</p>';
  return h;
}
// Onde o e-mail mora: família, página, etapa e persona. Serve para todo modelo, criado no estúdio ou não.
// Colunas de classificação existem de fato: tabela vazia não prova nada (temColunas([]) é true).
function temColunasReais() { return !!(M && M.length && TX.temColunas(M)); }
// Etapa que o banco guarda mas o catálogo da página não tem: aparece selecionada, com o próprio código como rótulo.
function etapasComAtual(pg, atual) {
  var l = pg ? pg.etapas.slice() : [];
  if (pg && atual && !l.some(function (e) { return e[0] === atual; })) l.push([atual, atual]);
  return l;
}
function classeSelects(c, attr, off) {
  var pg = TX.PAGINAS.filter(function (p) { return p.k === c.pagina; })[0], dis = off ? ' disabled' : '';
  var h = '<label class="st-fld"><span>Família</span><select class="st-in" ' + attr + '="familia"' + dis + '>' + opcoes(TX.FAMILIAS, c.familia, 'Sem família') + '</select></label>' +
    '<label class="st-fld"><span>Página</span><select class="st-in" ' + attr + '="pagina"' + dis + '>' + opcoes(TX.PAGINAS.map(function (p) { return [p.k, p.k + ' · ' + p.nome]; }), c.pagina, 'Sem página') + '</select></label>' +
    '<label class="st-fld"><span>Etapa</span><select class="st-in" ' + attr + '="etapa"' + (off || !pg ? ' disabled' : '') + '>' + opcoes(etapasComAtual(pg, c.etapa), c.etapa, 'Sem etapa') + '</select></label>' +
    '<label class="st-fld"><span>Persona</span><select class="st-in" ' + attr + '="persona"' + dis + '>' + opcoes(TX.PERSONAS, c.persona, 'Sem persona') + '</select></label>';
  return h;
}
function classeHtml(m) {
  var off = !temColunasReais(), c = TX.classifica(m);
  return '<fieldset class="st-classe" style="border:0;padding:0;margin:0"><legend class="sub">Onde este e-mail mora</legend>' +
    (!off && !c.familia && !c.pagina ? '<p class="st-msg warn">Escolha onde este e-mail mora</p>' : '') +
    (off ? '<p class="st-msg warn">Para classificar, rode db/crm-taxonomia-modelos.sql no Supabase.</p>' : '') +
    classeSelects(c, 'data-classe', off) + '</fieldset>';
}
async function mudarClasse(campo, valor) {
  var m = modeloAtual(); if (!m || !temColunasReais()) return;
  var c = TX.classifica(m), v = valor || null;
  var p = { familia: c.familia, pagina: c.pagina, etapa: c.etapa, persona: c.persona };
  p[campo] = v;
  if (campo === 'pagina') p.etapa = null;
  return salvarModelo(p, 'Classificação salva');
}
async function salvarModelo(patch, msg) {
  var m = modeloAtual(); if (!m) return;
  var r = await supabase.from('modelos_email').update(patch).eq('chave', m.chave).select();
  if (r.error) { fail('salvar o modelo', r.error); return renderEditor(); }
  Object.assign(m, (r.data && r.data[0]) || patch);
  if (msg) toast(msg);
  renderEditor(); renderPrevia();
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
  else if (campo === 'minutos') { if (String(valor).trim() === '') p = { envio_minutos: null }; else { var mn = parseInt(valor, 10); if (!(mn >= 1 && mn <= 1440)) return toast('Minutos: de 1 a 1440'); p = { envio_minutos: mn }; } }
  if (m.envio_ligado && (p.envio_depois_de === null || (p.envio_minutos === null && m.envio_dias == null) || (p.envio_hora === null && m.envio_minutos == null))) p.envio_ligado = false;
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
// A pessoa de exemplo da prévia: tudo preenchido, para o e-mail aparecer inteiro (nunca é uma pessoa de verdade).
function pessoaExemplo(m, caso) {
  var pq = (m && m.para_quem) || {};
  var p = { id: '_exemplo', nome: 'Ana', email: 'ana@exemplo.com', persona: (pq.personas || [])[0] || 'au_pair_estudante', personas: [], aceita_novidades: true,
    respostas: { objetivo: (pq.etapas || [])[0] || 'cf-juntando-documentos', cfNivel: 'l2l3', cfCidade: 'paris' }, dias_para_prazo: 30, prazo_limite: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) };
  if (caso) p.respostas = Object.assign({}, p.respostas, caso.resp);   // o caso escolhido no seletor (porta e ponto da Rota da Sécu)
  return p;
}
// Os casos do modelo aberto e o escolhido (o primeiro, se ainda não escolheu ou se mudou de modelo).
function casosDaPrevia(k) { return ES.casosDe(k); }
function casoEscolhido(casos) { return casos.filter(function (x) { return x.id === ST.caso; })[0] || casos[0] || null; }
// A prévia do e-mail cresce até o fim do texto: a página rola uma vez só, sem rolagem dentro do e-mail.
function ajustaIframes() {
  document.querySelectorAll('#st-prev iframe.st-mail').forEach(function (f) {
    var fit = function () {
      try {
        var d = f.contentDocument; if (!d || !d.documentElement) return;
        f.style.height = '0px';
        f.style.height = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0) + 'px';
        d.querySelectorAll('img').forEach(function (im) { if (!im._fit) { im._fit = 1; im.addEventListener('load', fit); } });
      } catch (e) { /* sem acesso: fica a altura padrão */ }
    };
    f.addEventListener('load', fit); fit();
  });
}
window.addEventListener('resize', function () { clearTimeout(ajustaIframes._t); ajustaIframes._t = setTimeout(ajustaIframes, 200); });
// "Com chaves": o modelo cru, com cada {dado} e cada "só se…" marcados, em vez do valor de uma pessoa.
function chavesEmHtml(html) {
  var pilula = function (txt, cor) { return '<span style="display:inline-block;background:' + cor[0] + ';border:1px solid ' + cor[1] + ';color:' + cor[2] + ';border-radius:6px;padding:0 6px;font:600 12px/1.6 system-ui,sans-serif;white-space:nowrap">' + txt + '</span>'; };
  return String(html || '').replace(/(<[^>]*>)|\{([#^\/]?)(\w+)\}/g, function (m, tag, op, k) {
    if (tag) return tag;
    if (op === '#') return pilula('só se ' + k, ['#F3E5C8', '#B9904A', '#6B4A10']);
    if (op === '^') return pilula('se não ' + k, ['#F3E5C8', '#B9904A', '#6B4A10']);
    if (op === '/') return pilula('fim', ['#EEE9DF', '#C9C2B2', '#5A5446']);
    return pilula(k, ['#E3EAD3', '#577328', '#2F430C']);
  });
}
function chavesDe(v) { return { assunto: v.assunto || '', pre: v.preheader || '', html: v.corpo_html ? chavesEmHtml(v.corpo_html) : null, texto: v.corpo_texto || '' }; }
function pessoasDaPrevia() {
  var q = ST.q.trim().toLowerCase();
  var l = C.filter(function (c) { return !q || (displayName(c) + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
  return l.slice(0, 200);
}
function renderPrevia() { renderPreviaCorpo(); ajustaIframes(); }
function renderPreviaCorpo() {
  var box = $('st-prev');
  if (ST.vazio) { box.innerHTML = ''; return; }
  var m = M ? modeloAtual() : null, k = ST.k;
  var lista = pessoasDaPrevia();
  var modo = ST.modo === 'dados' || (ST.modo === 'chaves' && !ST.criar) ? ST.modo : 'exemplo';
  var casos = modo === 'exemplo' && M && !ST.criar ? casosDaPrevia(k) : [], caso = casoEscolhido(casos);
  var c = modo === 'dados' ? (C.filter(function (x) { return x.id === ST.who; })[0] || lista[0] || C[0]) : pessoaExemplo(m, caso);
  if (modo === 'dados' && c) ST.who = c.id;
  var modos = '<div class="seg" role="group" aria-label="Como mostrar">' + [['chaves', 'com chaves'], ['exemplo', 'com exemplo'], ['dados', 'com dados']].filter(function (o) { return !(ST.criar && o[0] === 'chaves'); }).map(function (o) { return '<button type="button" data-stmodo="' + o[0] + '" aria-pressed="' + (modo === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  var iCaso = caso ? casos.indexOf(caso) : -1, grupos = [];
  casos.forEach(function (x) { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
  var seletorCaso = !casos.length ? '' : '<div class="st-caso"><button type="button" class="btn" data-stcaso-passo="-1" aria-label="Caso anterior"' + (iCaso <= 0 ? ' disabled' : '') + '>‹</button>' +
    '<select class="st-in" id="st-caso" aria-label="Caso de e-mail">' + grupos.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + casos.filter(function (x) { return x.grupo === g; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (caso && x.id === caso.id ? ' selected' : '') + '>' + esc(x.grupo + ' · ' + x.rotulo) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select><button type="button" class="btn" data-stcaso-passo="1" aria-label="Próximo caso"' + (iCaso >= casos.length - 1 ? ' disabled' : '') + '>›</button>' +
    '<span class="st-caso-n">' + (iCaso + 1) + ' de ' + casos.length + '</span></div>';
  var barra = '<div class="st-bar">' + modos + seletorCaso + (modo !== 'dados' ? '' : '<label class="st-fld" style="flex:1 1 220px"><span>Prévia para</span><input class="st-in" id="st-q" type="search" placeholder="Buscar pelo nome ou e-mail" value="' + esc(ST.q) + '">' +
    '<select class="st-in" id="st-who" aria-label="Pessoa da prévia">' + (lista.some(function (x) { return c && x.id === c.id; }) || !c ? '' : '<option value="' + esc(c.id) + '" selected>' + esc(displayName(c)) + '</option>') +
    lista.map(function (x) { return '<option value="' + esc(x.id) + '"' + (c && x.id === c.id ? ' selected' : '') + '>' + esc(displayName(x)) + ' · ' + esc(personaLabel(x)) + '</option>'; }).join('') + '</select></label>') +
    '<div class="seg" role="group" aria-label="Aparelho"><button type="button" data-stdev="pc" aria-pressed="' + (ST.dev === 'pc') + '">Computador</button><button type="button" data-stdev="cel" aria-pressed="' + (ST.dev === 'cel') + '">Celular</button></div>' +
    (modo === 'chaves' ? '' : '<label class="st-check"><input type="checkbox" id="st-marcar"' + (ST.marcar ? ' checked' : '') + '> Destacar os dados' + (modo === 'dados' ? ' dela' : '') + '</label>') + '</div>';
  if (!c) { box.innerHTML = barra + '<div class="empty">Sem contatos ainda para a prévia.</div>'; return; }
  if (ST.criar) {
    var oc = ST.criar.obj && ES.objetivo(ST.criar.obj);
    if (!oc) { box.innerHTML = barra + '<div class="empty">Escolha o objetivo: a prévia mostra o esqueleto com os dados da pessoa.</div>'; return; }
    var fk = { chave: '_novo', criado_no_estudio: true, tipo: oc.tipo, para_quem: ST.criar.para }, rk = null;
    try { var ve = ES.montar(ES.esqueleto(oc.k), oc.tipo); rk = ES.montarComDados(ve, ES.dadosDe('_novo', c, ajudantes(), fk), ST.marcar); } catch (e) { rk = null; }
    box.innerHTML = barra + '<p class="st-msg tip">Esqueleto de "' + esc(oc.nome) + '" com os dados de ' + esc(displayName(c)) + '. Os [trechos] são para você escrever.</p>' +
      (rk ? '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="st-env"><span class="sub">Ingryd · Por Dentro</span><b>' + esc(rk.assunto) + '</b></div>' +
        '<iframe class="st-mail" sandbox="allow-same-origin" scrolling="no" title="Prévia do e-mail" srcdoc="' + esc(rk.html || textoParaHtml(rk.texto)) + '"></iframe></div>' : '<div class="empty">Sem prévia.</div>');
    return;
  }
  if (!M) {
    var t = splitTpl(c, k);
    box.innerHTML = barra + '<div class="st-env"><b>' + esc(t.subject) + '</b></div><div class="mailbody">' + esc(t.body) + '</div>';
    return;
  }
  var v = textoDaPrevia();
  if (!v) { box.innerHTML = barra + '<div class="empty">Este modelo ainda não tem versão.</div>'; return; }
  if (modo === 'chaves') {
    var ch = chavesDe(v);
    box.innerHTML = barra + '<p class="st-msg tip">O modelo como está escrito: cada <b>{dado}</b> é trocado pelo valor da pessoa no envio, e "só se…" … "fim" é um trecho que só aparece para quem tem aquele dado.</p>' +
      '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="st-env"><span class="sub">Ingryd · Por Dentro</span><b>' + marcarVars(ch.assunto) + '</b>' + (ch.pre ? '<span class="sub">' + marcarVars(ch.pre) + '</span>' : '') + '</div>' +
      (ch.html ? '<iframe class="st-mail" sandbox="allow-same-origin" scrolling="no" title="Prévia do e-mail com chaves" srcdoc="' + esc(ch.html) + '"></iframe>' : '<div class="mailbody">' + marcarVars(ch.texto) + '</div>') + '</div>';
    return;
  }
  var dados = dadosPara(k, c), avisos = [], erro = null, r = null;
  try { r = ES.montarComDados(v, dados, ST.marcar); } catch (e) { erro = e.message; }
  if (modo === 'dados' && m && m.criado_no_estudio) {
    var pqv = m.para_quem || {}, fora = [];
    if (pqv.produto && !comprou(c.id, pqv.produto)) fora.push('não tem a compra do ' + (pqv.produto_nome || produtoNome(pqv.produto)) + ' registrada (confira na ficha)');
    if ((pqv.personas || []).length && pqv.personas.indexOf(c.persona) < 0 && !(c.personas || []).some(function (x) { return pqv.personas.indexOf(x) >= 0; })) fora.push('é de outra persona');
    if ((pqv.materiais || []).length && !origensDe(c).some(function (x) { return pqv.materiais.indexOf(x) >= 0; })) fora.push('não pegou o material');
    if ((pqv.etapas || []).length && pqv.etapas.indexOf((c.respostas || {}).objetivo) < 0) fora.push((c.respostas || {}).objetivo ? 'marcou outra etapa no guia' : 'não marcou etapa no guia');
    if ((pqv.estagios || []).length && pqv.estagios.indexOf(c.estagio) < 0) fora.push('está em outro estágio');
    if ((pqv.segmentos || []).length && pqv.segmentos.indexOf(c.segmento) < 0) fora.push('está fora do segmento');
    if (fora.length) avisos.push(displayName(c) + ' ' + fora.join(', ') + ': pelas regras de Para quem, este e-mail não sai para essa pessoa.');
  }
  if (modo === 'dados' && m && m.tipo === 'novidades' && !c.aceita_novidades) avisos.push(displayName(c) + ' não aceitou novidades: este e-mail não sai para essa pessoa.');
  if (modo === 'dados' && k.indexOf('cf_') === 0 && origensDe(c).indexOf('guia-etudes-en-france-2027') < 0) avisos.push(displayName(c) + ' não pegou o guia Campus France: este e-mail não sai sozinho para ela.');
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
  if (r && modo === 'dados') { ST.vistos[ST.dKey] = ST.vistos[ST.dKey] || {}; ST.vistos[ST.dKey][c.id] = 1; }
  var html = r ? (r.html || textoParaHtml(r.texto)) : '';
  box.innerHTML = barra +
    (erro ? '<div class="st-alert no">O texto tem um erro: ' + esc(erro) + '. Nada sai com ele: os automáticos usariam o texto de reserva.</div>' : '') +
    (avisos.length ? '<div class="st-alert">' + avisos.map(esc).join('<br>') + '</div>' : (r && modo === 'exemplo' ? '<p class="st-msg tip">' + (caso ? 'Caso: <b>' + esc(caso.grupo + ' · ' + caso.rotulo) + '</b>. ' : '') + 'Pessoa de exemplo (Ana), com todos os dados preenchidos. Para ver uma pessoa de verdade, escolha “com dados”.</p>' : r ? '<div class="st-alert ok"><b>Pronto para ' + esc(displayName(c)) + '.</b> Todos os dados que o texto usa existem.</div>' : '')) +
    (dicas.length ? '<p class="st-msg tip">' + dicas.map(esc).join(' ') + '</p>' : '') +
    (r ? '<div class="st-frame' + (ST.dev === 'cel' ? ' cel' : '') + '"><div class="st-env"><span class="sub">Ingryd · Por Dentro</span><b>' + esc(r.assunto) + '</b>' + (r.pre ? '<span class="sub">' + esc(r.pre) + '</span>' : '') + '</div>' +
      '<iframe class="st-mail" sandbox="allow-same-origin" scrolling="no" title="Prévia do e-mail" srcdoc="' + esc(html) + '"></iframe></div>' +
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
// Depois de mudar um campo: guarda e atualiza a prévia, sem redesenhar o editor (o cursor fica).
// opcoes.canvas: a mudança veio do e-mail editável; a prévia da coluna ao lado se atualiza com uma pequena espera (um recarregamento
// por tecla piscaria), e o rodapé automático do e-mail acompanha o que foi escrito.
function agendarPrevia() { clearTimeout(ST.tPrev); ST.tPrev = setTimeout(renderPrevia, 350); }
function aoEditar(opcoes) {
  agendarSalvar();
  var v = versaoAberta(); if (v) { v.testado_em = null; }
  var pub = $('st-publicar'); if (pub) pub.disabled = true;   // mudou o texto: precisa de um teste novo
  if (opcoes && opcoes.canvas) agendarPrevia(); else renderPrevia();
  var rod = document.querySelector('#ee .ee-rodtxt');
  if (rod && ST.d) { var mo = modeloAtual(); rod.textContent = (mo && ES.rodapeDe(ST.d, mo.tipo)) || 'Sem rodapé (serviço sem motivo escrito).'; }
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
  ST.passo = 'texto'; renderModelos();
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
  toast('Versão ' + v.versao + ' em revisão'); ST.passo = 'conferir';
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
// O seletor de modelo do "Escrever e-mail", em grupos (optgroup) pelos mesmos grupos da lista.
function opcoesPorCategoria(chaves, atual) {
  var opt = function (m) { return '<option value="' + m + '"' + (m === atual ? ' selected' : '') + '>' + esc(tplInfo(m).label) + '</option>'; };
  // Cópias sem excluido_em: o modelo atual do compose pode estar excluído e deve continuar na lista (agrupa esconde excluídos).
  var itens = chaves.map(function (k) { var m = modeloDe(k) || { chave: k, tipo: EXIGEM_NOVIDADES[k] ? 'novidades' : 'servico' }; return Object.assign({}, m, { excluido_em: null }); });
  return TX.agrupa(itens).map(function (g) { return '<optgroup label="' + esc(g.titulo) + '">' + g.itens.map(function (m) { return opt(m.chave); }).join('') + '</optgroup>'; }).join('');
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
    '<div id="ont-box"></div>' +
    '<h3 class="ont-t ont-ou">Ou, a partir de documentos</h3>' +
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
  ontPinta();
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
  if (state.view === 'onboarding') { onbPintaAviso(); ontPinta(); }
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
  if (byC(data.contato_id)) { openPessoa(data.contato_id, 'plataforma', 'interacoes'); return toast(state.onbResumo.criado ? 'Ficha criada. Confira o que a IA leu.' : 'Ficha atualizada. Confira o que a IA leu.', 5000); }
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

// ---------- Onboarding pelo Notion: o link da ligação vira uma proposta PENDENTE (Worker: POST /api/crm/onboarding/notion/ler) ----------
// O CRM só LÊ o Notion (não escreve) e não envia nada a ninguém: a ficha é criada ou achada pelo e-mail e o que a página trouxe fica como
// proposta pendente no bloco Pós-call da ficha, para a Ingryd aplicar. Todo texto que vem do Worker entra na tela por esc() ou textContent.
function ontInicial() { return { fase: 'vazio', url: '', erro: '', res: null }; }
var ONT = ontInicial();
var ONT_ESTADO = { aberta: 'aberta', aguardando_ela: 'aguardando ela', concluida: 'concluída' };
function ontN(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
function ontPrazo(pz) { if (!pz || !pz.texto) return 'sem prazo'; return pz.data && !pz.a_confirmar ? fmtDay(pz.data) : pz.texto; }   // "(a confirmar)" aparece como o texto que veio
function ontResumoHtml(r) {
  var np = r.na_proposta || {}, df = r.de_fora || {}, ap = r.aplicado || { preenchidos: [], ja_preenchidos: [] };
  var rot = function (k) { if (k === 'nome') return 'Nome'; if (k === 'persona') return 'Situação (qual checklist)'; var f = dosCampo(k); return f ? f.l : k; };
  var h = '<div class="onb-ok" role="status"><b>' + (r.criado ? 'Ficha criada' : 'Ficha encontrada') + (r.pessoa ? ': ' + esc(r.pessoa) : '') + '</b>' + (r.email ? ' · ' + esc(r.email) : '') + '<br>' +
    (r.reutilizada ? 'Esta página já tinha sido lida antes. ' : '') + 'Preenchi a ficha com o que a página trouxe; o que você já tinha digitado ficou como estava. Nada foi enviado a ninguém.</div>';
  h += '<h4 class="ont-h">Preenchido na ficha</h4><ul class="ont-lista">' +
    '<li>' + (ap.preenchidos.length ? '<b>' + ontN(ap.preenchidos.length, 'campo', 'campos') + ':</b> ' + esc(ap.preenchidos.map(rot).join(', ')) : 'Nenhum campo novo: tudo o que a página tem já estava na ficha.') + '</li>' +
    (ap.ja_preenchidos.length ? '<li>Já estavam preenchidos e ficaram como estavam: ' + esc(ap.ja_preenchidos.map(rot).join(', ')) + '.</li>' : '') + '</ul>';
  h += '<h4 class="ont-h">Ficou como proposta, só para consulta</h4><ul class="ont-lista">' +
    '<li>' + (np.pendencias ? '<b>' + ontN(np.pendencias, 'pendência da Plataforma', 'pendências da Plataforma') + '</b> (' + np.abertas + ' abertas, ' + np.aguardando_ela + ' aguardando ela, ' + np.concluidas + ' concluídas)' : 'Nenhuma pendência da Plataforma') + '</li>' +
    '<li>' + (np.lembretes ? '<b>' + ontN(np.lembretes, 'lembrete para você', 'lembretes para você') + '</b> (' + esc((np.canais_lembrete || []).join(' e ')) + ')' : 'Nenhum lembrete (convite de acesso ou Instagram)') + '</li>' +
    '<li>' + (np.rascunho_email || np.linhas_email ? '<b>Rascunho de e-mail</b>' + (np.rascunho_email ? ' pronto' : ' ainda vazio') + ' · ' + ontN(np.linhas_email || 0, 'linha de pendência por e-mail', 'linhas de pendência por e-mail') : 'Nada por e-mail') + '</li>' +
    '<li>' + (np.faltam ? '<b>' + ontN(np.faltam, 'tarefa', 'tarefas') + '</b> em “Faltam para o CRM”' : 'Nada em “Faltam para o CRM”') + '</li></ul>';
  h += '<h4 class="ont-h">Ficou de fora</h4><ul class="ont-lista">' +
    ((df.so_eu || df.fora_do_crm) ? '<li>' + (df.so_eu || 0) + ' linha(s) “Só eu” e ' + (df.fora_do_crm || 0) + ' “Fora do CRM”: não viram nada na ficha.</li>' : '<li>Nenhuma linha “Só eu” ou “Fora do CRM”.</li>') +
    (r.fase ? '<li>Fase no Notion: <b>' + esc(r.fase) + '</b> (texto livre: foi para o resumo, não para o campo Fase da ficha).</li>' : '') +
    (r.persona && ap.preenchidos.indexOf('persona') < 0 ? '<li>Persona no Notion: <b>' + esc(r.persona) + '</b>' + (ap.ja_preenchidos.indexOf('persona') >= 0 ? ' (a ficha já tinha uma situação: não troquei).' : ' (não existe no CRM: escolha na ficha).') + '</li>' : '') + '</ul>';
  if ((r.avisos || []).length) h += '<div class="onb-aviso" role="status"><b>' + ontN(r.avisos.length, 'aviso', 'avisos') + ':</b><ul class="ont-lista">' + r.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
  return h;
}
function ontPinta() {
  var box = $('ont-box'); if (!box) return;
  var off = !!(ONB.ia && ONB.ia.notion_configurado === false), lendo = ONT.fase === 'lendo', h = '<div class="panel onb-notion"><h3 class="ont-t">Da ligação no Notion</h3>';
  if (ONT.fase === 'ok' && ONT.res) {
    box.innerHTML = h + ontResumoHtml(ONT.res) + '<div class="onb-acoes" style="margin-top:12px"><button class="btn primary" type="button" id="ont-abrir">Abrir a ficha e aplicar</button><button class="btn" type="button" id="ont-outra">Ler outra ligação</button></div></div>';
    return;
  }
  h += '<label class="rot" for="ont-url">Link do Notion</label><input id="ont-url" type="url" autocomplete="off" inputmode="url" maxlength="500" placeholder="https://www.notion.so/…"' + (lendo ? ' disabled' : '') + '>' +
    '<small class="dica">Cole o link da página da ligação que a skill /bilan-notion deixou padronizada (Status “Bilan pronto”). O CRM só lê: não escreve no Notion e não envia nada a ninguém. A ficha é preenchida com o que a página trouxe (o que você já digitou não é trocado).</small>';
  if (off) h += '<div class="onb-aviso" role="status" style="margin-top:10px">' + esc(ONB.ia.notion_aviso || 'A leitura do Notion ainda não está ligada.') + ' As fichas e o Dossiê continuam funcionando.</div>';
  if (lendo) h += '<div role="status" aria-live="polite" aria-busy="true" style="margin-top:12px"><div class="onb-sk" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="sub" style="margin:10px 0 0">Lendo a página do Notion… costuma levar alguns segundos.</p></div>';
  else if (ONT.fase === 'erro') h += '<div class="onb-erro" role="alert" style="margin-top:10px">' + esc(ONT.erro) + '</div><p class="sub" style="margin:8px 0 0">O link continua aqui. Nada foi alterado na ficha.</p>';
  else h += '<p class="sub" id="ont-vazio" style="margin:10px 0 0">Nenhuma ligação lida ainda. Cole o link acima.</p>';
  h += '<div class="onb-acoes" style="margin-top:12px"><button class="btn primary" type="button" id="ont-ler"' + (lendo || off ? ' disabled' : '') + '>' + (lendo ? 'Lendo…' : ONT.fase === 'erro' ? 'Tentar de novo' : 'Ler do Notion') + '</button></div></div>';
  box.innerHTML = h;
  var inp = $('ont-url'); if (inp) inp.value = ONT.url;
}
async function ontLer() {
  var url = String(ONT.url || '').trim();
  var falha = function (msg) { ONT.fase = 'erro'; ONT.erro = msg; ontPinta(); };
  if (!url) return falha('Cole o link da página do Notion.');
  if (!/^https:\/\//i.test(url)) return falha('O link precisa começar com https:// e ser de notion.so, notion.com ou notion.site.');
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) return falha('Sessão expirada. Recarregue a página e entre de novo.');
  ONT.fase = 'lendo'; ONT.erro = ''; ontPinta();
  var ctl = new AbortController(), cedo = setTimeout(function () { ctl.abort(); }, 60000), data;
  try {
    var res = await fetch(WORKER_BASE + '/api/crm/onboarding/notion/ler', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: JSON.stringify({ url: url }), signal: ctl.signal });
    data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || ('Erro ' + res.status));
  } catch (e) {
    ONT.fase = 'erro';
    ONT.erro = e && e.name === 'AbortError' ? 'A leitura demorou mais de 1 minuto e foi cancelada. Tente de novo.' : e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : (e.message || 'Algo deu errado.');
    if (state.view === 'onboarding') ontPinta();
    return;
  } finally { clearTimeout(cedo); }
  ONT.fase = 'ok'; ONT.res = data;
  if (state.view === 'onboarding') ontPinta();
  await reload();   // a ficha nova entra na lista
  // A ficha criada pelo Onboarding abre em Plataforma → Interações, com o resumo da leitura no topo e o botão do e-mail do bilan.
  if (byC(data.contato_id) && state.view === 'onboarding') { state.ontResumo = data; openPessoa(data.contato_id, 'plataforma', 'interacoes'); toast(data.criado ? 'Ficha criada. Confira o resumo e envie o bilan.' : 'Ficha encontrada. Confira o resumo e envie o bilan.', 5000); }
}
async function ontCopiar() {
  var pc = state.pc, n = pc && ((pc.prop && pc.prop.proposta && pc.prop.proposta.notion) || (pc.notionAplicada && pc.notionAplicada.proposta.notion)), txt = n && n.email ? n.email.rascunho : '';
  if (!txt) return toast('Não há rascunho para copiar.');
  try { await navigator.clipboard.writeText(txt); toast('Rascunho copiado. Nada foi enviado.'); } catch (e) { toast('Não consegui copiar. Selecione o texto e copie à mão.', 4200); }
}
// A parte do Notion dentro do Pós-call da ficha: pendências, lembretes, rascunho de e-mail e "faltam". Só mostra; nenhum botão envia nada.
function ontLinhaHtml(x, canal) {
  return '<li class="ont-pend' + (x.estado === 'concluida' ? ' feita' : '') + '"><b>' + esc(x.titulo) + '</b>' + (canal ? ' <span class="dchip">' + esc(x.canal) + '</span>' : '') + '<br><small class="sub">' +
    esc('Dono: ' + (x.dono === 'Ela' ? 'ela' : 'Ingryd') + ' · Prazo: ' + ontPrazo(x.prazo) + ' · Estado: ' + (ONT_ESTADO[x.estado] || x.estado) + (x.botao && x.botao !== 'n/a' ? ' · Botão sugerido: ' + (x.botoes && x.botoes.length > 1 ? x.botoes.join(' → ') : x.botao) + (x.botao_obs ? ' (' + x.botao_obs + ')' : '') : '') + (x.origem_certeza ? ' · ' + x.origem_certeza : '')) + '</small></li>';
}
function poscallNotionHtml(n) {
  var h = '<h5>2 · Pendências da Plataforma</h5>' + (n.pendencias.length ? '<ul class="ont-pends">' + n.pendencias.map(function (x) { return ontLinhaHtml(x, false); }).join('') + '</ul>' : '<p class="sub">Nenhuma pendência com canal Plataforma.</p>') +
    '<p class="sub" style="margin:6px 0 0">O “botão sugerido” é só uma indicação: nenhum botão envia nada sozinho. Tudo só sai com o seu “pode enviar”.</p>';
  h += '<h5>3 · Lembretes para você</h5>' + (n.lembretes.length ? '<ul class="ont-pends">' + n.lembretes.map(function (x) { return ontLinhaHtml(x, true); }).join('') + '</ul>' : '<p class="sub">Nenhum lembrete de convite de acesso ou Instagram.</p>');
  h += '<h5>4 · E-mail (um rascunho só)</h5>';
  h += n.email.linhas.length ? '<ul class="ont-pends">' + n.email.linhas.map(function (x) { return ontLinhaHtml(x, false); }).join('') + '</ul>' : '<p class="sub">Nenhuma pendência pelo canal e-mail.</p>';
  h += n.email.rascunho ? '<pre class="ont-rascunho">' + esc(n.email.rascunho) + '</pre><div class="actions"><button class="btn" type="button" data-ontcopiar="1">Copiar o rascunho</button></div>' : '<p class="sub">Sem rascunho de e-mail na página.</p>';
  h += '<h5>5 · Faltam para o CRM</h5>' + (n.faltam.length ? '<ul class="ont-lista">' + n.faltam.map(function (x) { return '<li>' + (x.feito ? '☑ ' : '☐ ') + esc(x.texto) + '</li>'; }).join('') + '</ul>' : '<p class="sub">Nada listado.</p>');
  h += '<p class="sub" style="margin:10px 0 0">Ficaram de fora (“Só eu” e “Fora do CRM”): ' + (n.fora.so_eu || 0) + ' e ' + (n.fora.fora_do_crm || 0) + '. ' +
    (n.persona || n.fase ? 'No Notion: ' + (n.persona ? 'persona ' + esc(n.persona) : '') + (n.persona && n.fase ? ', ' : '') + (n.fase ? 'fase ' + esc(n.fase) : '') + ' (a proposta não muda persona nem fase).' : '') + '</p>';
  if ((n.avisos || []).length) h += '<div class="onb-aviso" role="status" style="margin-top:8px"><ul class="ont-lista">' + n.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
  return h;
}

// ---------- E-mail com o bilan da conversa (subaba Interações): o Bilan d'action lido do Notion vira um e-mail de formato fixo ----------
// Título e 4 seções são fixos (Worker: POST /api/crm/onboarding/bilan-email); o conteúdo vem da página e você edita antes. Nada sai sem o seu clique
// e sem a marca de que a pessoa aceitou receber.
function bilanIniciais(n) {
  var prazo = function (pz) { return pz && pz.texto && pz.texto !== 'n/a' ? ' (prazo: ' + (pz.data && !pz.a_confirmar ? fmtDay(pz.data) : pz.texto) + ')' : ''; };
  var ela = [], ing = [], todas = [].concat(n.pendencias || [], n.lembretes || [], (n.email && n.email.linhas) || []);
  todas.forEach(function (x) { if (x.estado !== 'concluida' && x.dono === 'Ela') ela.push(x.titulo + prazo(x.prazo)); });
  [].concat(n.pendencias || [], (n.email && n.email.linhas) || []).forEach(function (x) { if (x.estado !== 'concluida' && x.dono === 'Ingryd') ing.push(x.titulo); });
  // O rascunho escrito no Notion ("### Rascunho de e-mail" com as seções 1, 2 e 3) vale mais que o derivado da tabela; seção que o rascunho não tem cai no fallback.
  var rb = n.bilan || {}, doRasc = function (k) { return rb[k] && rb[k].length ? rb[k].slice() : null; };
  var tem = n.duvidas && n.duvidas.length;
  var duv = doRasc('duvidas') || (tem ? n.duvidas.slice() : (n.resumo ? [n.resumo] : []));
  return { duvidas: duv, proximos: doRasc('proximos') || ela, respostas: doRasc('respostas') || ing, usouResumo: !doRasc('duvidas') && !tem && !!n.resumo,
    doRascunho: ['duvidas', 'proximos', 'respostas'].filter(function (k) { return !!doRasc(k); }).length };
}
// O resumo da leitura do Notion logo depois do Onboarding: fica na subaba Interações (onde a ficha abre).
function bilanResumoHtml(c) {
  if (!(state.ontResumo && state.ontResumo.contato_id === c.id)) return '';
  return '<div class="panel onb-notion onb-resumo" id="ont-resumo-ficha" style="margin:0 0 14px"><h3 class="ont-t">Leitura do Notion</h3>' + ontResumoHtml(state.ontResumo) +
    '<div class="actions" style="margin-top:8px"><button class="btn" type="button" data-ontresfechar="1">Entendi</button></div></div>';
}
// O botão do e-mail do bilan: coluna da direita da aba Plataforma, logo abaixo do Pagamento (fora da subaba Interações).
function bilanBlocoHtml(c, h4) {
  if (!state.pnConv || state.pnConv.cid !== c.id) setTimeout(function () { fxCarregaConversas(c); }, 0);   // o rascunho vem da leitura da conversa
  var b = state.bilan && state.bilan.cid === c.id ? state.bilan : null, pm = bilanDaMontagem(c);
  var ultimo = (state.mails || []).filter(function (m) { return m.modelo === 'bilan_conversa'; })[0];
  return '<div class="panel bilan-box" id="bilan-box" style="padding:16px"><h4 style="' + h4 + '">Bilan da conversa</h4>' +
    '<button class="btn primary" type="button" data-bilanabrir="' + esc(c.id) + '"' + (b || pm ? '' : ' disabled') + '>Enviar e-mail com bilan da conversa</button>' +
    '<p class="sub" style="margin:8px 0 0">Sempre o mesmo título e as mesmas seções: dúvidas tiradas, próximos passos, o que você responde ou confirma e o código de redução da lista de espera. O conteúdo vem do Notion e você revisa e anexa arquivos antes de enviar.</p>' +
    (pm ? '<p class="sub" style="margin:8px 0 0">O rascunho já vem da leitura da conversa (Montagem do espaço): você só revisa.</p>' : b ? '' : '<p class="sub" style="margin:8px 0 0">Ainda não há uma ligação lida do Notion para esta pessoa. Cole o link em Onboarding → Link do Notion. Ou leia a transcrição em Dossiê → A ligação → Montagem do espaço: o rascunho nasce dela.</p>') +
    (ultimo ? '<p class="sub" style="margin:8px 0 0">Último bilan enviado em ' + esc(fmtDay(String(ultimo.enviado_em || ultimo.criado_em || '').slice(0, 10))) + '.</p>' : '') + '</div>';
}
var BL = null;
function bilanLinhas(id) { return String(($(id) && $(id).value) || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
function bilanCorpo(extra) {
  return JSON.stringify(Object.assign({ contato_id: BL.cid, secoes: { duvidas: bilanLinhas('bl-duvidas'), proximos: bilanLinhas('bl-proximos'), respostas: bilanLinhas('bl-respostas') },
    codigo: String(($('bl-codigo') && $('bl-codigo').value) || '').trim(),
    anexos: (BL.anexos || []).map(function (f) { return { name: f.name, size: f.size }; }) }, extra || {}));   // na prévia vão só nome e tamanho
}
// Anexos: PDF, JPG ou PNG, até 5 e 3 MB no total (a mesma regra do Worker, que confere tudo de novo, inclusive os bytes). O arquivo fica só na memória.
var BL_MAX_N = 5, BL_MAX_TOTAL = 3 * 1048576;
function bilanJuntar(atuais, novos) {
  var ok = atuais.slice(), recusas = [], total = ok.reduce(function (s, f) { return s + f.size; }, 0);
  novos.forEach(function (f) {
    var nome = String(f.name || 'arquivo').slice(0, 60);
    if (ok.some(function (o) { return o.name === f.name && o.size === f.size && o.lastModified === f.lastModified; })) return;
    if (!onbTipoDe(f)) return recusas.push(nome + ': só PDF, JPG ou PNG.');
    if (!f.size) return recusas.push(nome + ': o arquivo está vazio.');
    if (ok.length >= BL_MAX_N) return recusas.push(nome + ': no máximo ' + BL_MAX_N + ' anexos.');
    if (total + f.size > BL_MAX_TOTAL) return recusas.push(nome + ': os anexos passariam de 3 MB no total.');
    ok.push(f); total += f.size;
  });
  return { arquivos: ok, recusas: recusas };
}
function bilanPintaAnexos() {
  var ul = $('bl-anexos-lista'); if (!ul) return;
  ul.innerHTML = (BL.anexos || []).map(function (f, i) {
    return '<li><span class="nome">' + esc(f.name || 'arquivo') + '</span><span class="tam num">' + esc(onbMb(f.size)) + '</span><button class="btn" type="button" data-blrem="' + i + '" aria-label="Tirar ' + esc(f.name || 'arquivo') + '">Tirar</button></li>';
  }).join('');
}
function bilanAdicionar(lista) {
  if (!BL) return;
  var r = bilanJuntar(BL.anexos || [], Array.prototype.slice.call(lista || []));
  BL.anexos = r.arquivos; bilanPintaAnexos();
  bilanPrevia().then(function () { if (r.recusas.length) bilanErro(r.recusas.join(' ')); });
}
async function bilanAnexosB64() {
  var out = [];
  for (var i = 0; i < (BL.anexos || []).length; i++) {
    var f = BL.anexos[i], u8 = new Uint8Array(await f.arrayBuffer()), bin = '';
    for (var k = 0; k < u8.length; k += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
    out.push({ name: f.name, b64: btoa(bin) });
  }
  return out;
}
function bilanErro(msg, forcar) {
  var er = $('bl-err'); if (!er) return;
  er.textContent = msg || ''; er.hidden = !msg;
  var f = $('bl-forcar'); if (f) f.hidden = !forcar;
}
function bilanAbrir(cid) {
  var c = byC(cid), b = state.bilan && state.bilan.cid === cid ? state.bilan : null, pm = c ? bilanDaMontagem(c) : null; if (!c || (!b && !pm)) return;
  var ini = pm || bilanIniciais(b.proposta.notion); BL = { cid: cid, ini: ini, anexos: [] };
  modalOpen(modalTop(c) + '<h4 style="margin:14px 0 6px;font-size:14px">E-mail com o bilan da conversa</h4>' +
    '<p class="sub" style="margin:0 0 10px">Vai para <b id="bl-para"></b>. Título e seções são sempre os mesmos; você edita o conteúdo. Um item por linha.' + (ini.daLeitura ? ' Preenchido a partir da leitura da conversa (versão ' + ini.daLeitura + ').' : '') + (ini.doRascunho ? ' Preenchido a partir do “Rascunho de e-mail” da página do Notion' + (ini.doRascunho < 3 ? ' (o que o rascunho não tem veio do resto da página)' : '') + '.' : '') + (ini.usouResumo ? ' A página não tem “Dúvidas tiradas”: usei o Resumo do Bilan d’action. Ajuste.' : '') + '</p>' +
    '<label class="sub" for="bl-duvidas" style="display:block;margin:0 0 4px">1 · Dúvidas que tiramos na conversa</label><textarea id="bl-duvidas" class="bl-ta" rows="4"></textarea>' +
    '<label class="sub" for="bl-proximos" style="display:block;margin:10px 0 4px">2 · Seus próximos passos</label><textarea id="bl-proximos" class="bl-ta" rows="4"></textarea>' +
    '<label class="sub" for="bl-respostas" style="display:block;margin:10px 0 4px">3 · O que eu respondo ou confirmo pra você</label><textarea id="bl-respostas" class="bl-ta" rows="4"></textarea>' +
    '<label class="sub" for="bl-codigo" style="display:block;margin:10px 0 4px">4 · Código de redução (lista de espera)</label><input id="bl-codigo" class="bl-in" type="text" autocomplete="off" maxlength="40" placeholder="ex.: LISTA-ESPERA">' +
    '<small class="sub" style="display:block;margin-top:4px">O texto fixo diz que o desconto vale por 6 meses e que ela ganha 7 dias grátis.</small>' +
    '<label class="sub" style="display:block;margin:10px 0 4px">Anexos (opcional)</label>' +
    '<label class="onb-drop bl-drop" for="bl-anexos"><span><b>Toque para escolher</b> os arquivos</span><span class="sub">PDF, JPG ou PNG · até 5 arquivos · 3 MB no total</span>' +
    '<input id="bl-anexos" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label><ul class="onb-arqs" id="bl-anexos-lista"></ul>' +
    '<div id="bl-previa" class="bl-previa"></div>' +
    '<label class="pccheck" style="margin:12px 0 0"><input type="checkbox" id="bl-confirmo"> <span>Esta pessoa aceitou receber este e-mail (lista de espera).</span></label>' +
    '<p class="onb-erro" id="bl-err" role="alert" hidden style="margin:10px 0 0"></p>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn" type="button" id="bl-previa-btn">Atualizar prévia</button><button class="btn" type="button" id="bl-forcar" hidden>Enviar mesmo assim</button><button class="btn primary" type="button" id="bl-enviar">Enviar e-mail</button></div>', true);
  $('bl-para').textContent = c.email;
  $('bl-duvidas').value = ini.duvidas.join('\n'); $('bl-proximos').value = ini.proximos.join('\n'); $('bl-respostas').value = ini.respostas.join('\n');
  bilanPrevia();
}
async function bilanChamar(corpo) {
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) throw new Error('Sessão expirada. Recarregue a página e entre de novo.');
  var res = await fetch(WORKER_BASE + '/api/crm/onboarding/bilan-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: corpo });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) { var e = new Error(data.error || ('Erro ' + res.status)); e.codigo = data.codigo; throw e; }
  return data;
}
async function bilanPrevia() {
  if (!BL) return;
  var box = $('bl-previa'); if (box) box.innerHTML = '<p class="sub" role="status" style="margin:12px 0 0">Montando a prévia…</p>';
  bilanErro('');
  var cod = String(($('bl-codigo') && $('bl-codigo').value) || '').trim();
  try {
    var d = await bilanChamar(JSON.stringify(Object.assign(JSON.parse(bilanCorpo()), cod ? {} : { codigo: 'SEU-CODIGO' })));
    if (box) box.innerHTML = '<p class="sub" style="margin:12px 0 4px">Prévia do e-mail' + (cod ? '' : ' (o código ainda não foi digitado)') + ' · assunto: <b id="bl-assunto"></b></p>' + previaFrame(d.html, 'cmpframe');
    var as = $('bl-assunto'); if (as) as.textContent = d.assunto;
  } catch (e) { if (box) box.innerHTML = ''; bilanErro(e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : e.message); }
}
async function bilanEnviar(forcar) {
  if (!BL) return;
  var cod = String(($('bl-codigo') && $('bl-codigo').value) || '').trim();
  if (!cod) return bilanErro('Digite o código de redução antes de enviar.');
  if (!($('bl-confirmo') && $('bl-confirmo').checked)) return bilanErro('Marque que a pessoa aceitou receber este e-mail.');
  var bt = $('bl-enviar'); if (bt) { bt.disabled = true; bt.textContent = 'Enviando…'; }
  try {
    var d = await bilanChamar(bilanCorpo({ enviar: true, confirmo: true, forcar: !!forcar, anexos: await bilanAnexosB64() }));
    closeCompose(); toast('Bilan enviado para ' + d.para + (d.anexos ? ' com ' + d.anexos + (d.anexos === 1 ? ' anexo' : ' anexos') : '') + (d.registrado === false ? ' (mas não consegui registrar na ficha)' : ''), 5000);
    var cid = BL.cid; BL = null;
    if (state.view === 'pessoa' && state.sel === cid) await renderPessoa();
  } catch (e) {
    if (bt) { bt.disabled = false; bt.textContent = 'Enviar e-mail'; }
    bilanErro(e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : e.message, e.codigo === 'enviado_recentemente');
  }
}

// ---------- O e-mail da conversa: o que conversamos, o que ela faz, o que eu faço e o convite para o Por Dentro das Démarches ----------
// O rascunho nasce do que já foi lido (Montagem, página do Notion ou o texto do Dossiê); não chama a IA de novo. Worker: POST /api/crm/conversa-email.
var CV = null;
function conversaRascunho(c) {
  var B = state.bilan && state.bilan.cid === c.id ? state.bilan : null, pm = bilanDaMontagem(c), ini = pm || (B && B.proposta && B.proposta.notion ? bilanIniciais(B.proposta.notion) : null);
  var conv = ini ? ini.duvidas.slice() : [], ela = ini ? ini.proximos.slice() : [], ing = ini ? ini.respostas.slice() : [];
  if (!conv.length && !ela.length && !ing.length) {   // sem leitura: vale o que está no Dossiê
    var S = state.dos && state.dos.cid === c.id ? state.dos : null, dv = function (k) { return S ? String(dosValor(c, S.d, S.rasc || {}, k) || '') : ''; };
    var q = pcPassosDados(dv('proximos_passos'));
    conv = dv('ligacao_resumo').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
    ela = q.ela.concat(q.outros); ing = q.ingryd;
  }
  return { conversamos: conv, ela: ela, ingryd: ing };
}
function conversaLinhas(id) { return String(($(id) && $(id).value) || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
function conversaCorpo(extra) { return JSON.stringify(Object.assign({ contato_id: CV.cid, secoes: { conversamos: conversaLinhas('cv-conversamos'), ela: conversaLinhas('cv-ela'), ingryd: conversaLinhas('cv-ingryd') } }, extra || {})); }
function conversaErro(msg, forcar) { var er = $('cv-err'); if (er) { er.textContent = msg || ''; er.hidden = !msg; } var f = $('cv-forcar'); if (f) f.hidden = !forcar; }
function conversaAbrir(cid) {
  var c = byC(cid); if (!c) return;
  var ini = conversaRascunho(c); CV = { cid: cid };
  var vazio = !ini.conversamos.length && !ini.ela.length && !ini.ingryd.length;
  modalOpen(modalTop(c) + '<h4 style="margin:14px 0 6px;font-size:14px">E-mail da conversa e convite para o Por Dentro das Démarches</h4>' +
    '<p class="sub" style="margin:0 0 10px">Vai para <b id="cv-para"></b>. Um item por linha. O quarto bloco, o convite para o espaço dela, é fixo e leva o link de acesso só na hora de enviar.' + (vazio ? ' <b>Ainda não há leitura da conversa nem resumo no Dossiê:</b> leia a conversa em Análise 1:1 e faça o rascunho de novo, ou escreva aqui.' : '') + '</p>' +
    '<label class="sub" for="cv-conversamos" style="display:block;margin:0 0 4px">1 · O que conversamos</label><textarea id="cv-conversamos" class="bl-ta" rows="4"></textarea>' +
    '<label class="sub" for="cv-ela" style="display:block;margin:10px 0 4px">2 · O que você faz agora</label><textarea id="cv-ela" class="bl-ta" rows="4"></textarea>' +
    '<label class="sub" for="cv-ingryd" style="display:block;margin:10px 0 4px">3 · O que eu faço por você</label><textarea id="cv-ingryd" class="bl-ta" rows="4"></textarea>' +
    '<div id="cv-previa" class="bl-previa"></div>' +
    '<label class="pccheck" style="margin:12px 0 0"><input type="checkbox" id="cv-confirmo"> <span>Pode enviar: esta pessoa aceitou receber este e-mail.</span></label>' +
    '<p class="onb-erro" id="cv-err" role="alert" hidden style="margin:10px 0 0"></p>' +
    '<div class="actions"><button class="btn" type="button" id="modal-cancel">Cancelar</button><button class="btn" type="button" id="cv-previa-btn">Atualizar prévia</button><button class="btn" type="button" id="cv-forcar" hidden>Enviar mesmo assim</button><button class="btn primary" type="button" id="cv-enviar">Enviar e-mail</button></div>', true);
  $('cv-para').textContent = c.email;
  $('cv-conversamos').value = ini.conversamos.join('\n'); $('cv-ela').value = ini.ela.join('\n'); $('cv-ingryd').value = ini.ingryd.join('\n');
  conversaPrevia();
}
async function conversaChamar(corpo) {
  var sess = await supabase.auth.getSession();
  if (!sess.data.session) throw new Error('Sessão expirada. Recarregue a página e entre de novo.');
  var res = await fetch(WORKER_BASE + '/api/crm/conversa-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: corpo });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) { var e = new Error(data.error || ('Erro ' + res.status)); e.codigo = data.codigo; throw e; }
  return data;
}
async function conversaPrevia() {
  if (!CV) return;
  var box = $('cv-previa'); if (box) box.innerHTML = '<p class="sub" role="status" style="margin:12px 0 0">Montando a prévia…</p>';
  conversaErro('');
  try {
    var d = await conversaChamar(conversaCorpo());
    if (box) box.innerHTML = '<p class="sub" style="margin:12px 0 4px">Prévia · assunto: <b id="cv-assunto"></b>' + (d.acesso === 'convite' ? ' · ela ainda não tem acesso: vai o link de convite' : ' · ela já tem acesso: vai o link do app') + '</p>' + previaFrame(d.html, 'cmpframe') +
      (d.acesso === 'convite' && !d.ha_rascunho_aprovado ? '<p class="err" role="alert" style="margin:8px 0 0">Ainda não há nada revisado no espaço dela: aprove a Montagem App antes, ou envie assim mesmo.</p>' : '');
    var as = $('cv-assunto'); if (as) as.textContent = d.assunto;
  } catch (e) { if (box) box.innerHTML = ''; conversaErro(e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : e.message); }
}
async function conversaEnviar(forcar) {
  if (!CV) return;
  if (!($('cv-confirmo') && $('cv-confirmo').checked)) return conversaErro('Marque que a pessoa aceitou receber este e-mail.');
  var bt = $('cv-enviar'); if (bt) { bt.disabled = true; bt.textContent = 'Enviando…'; }
  try {
    var d = await conversaChamar(conversaCorpo({ enviar: true, confirmo: true, forcar: !!forcar }));
    closeCompose(); toast('E-mail enviado para ' + d.para + '.', 5000);
    var cid = CV.cid; CV = null;
    if (state.view === 'pessoa' && state.sel === cid) await renderPessoa();
  } catch (e) {
    if (bt) { bt.disabled = false; bt.textContent = 'Enviar e-mail'; }
    conversaErro(e instanceof TypeError ? 'Não consegui falar com o Worker. Confira a internet e tente de novo.' : e.message, e.codigo === 'enviado_recentemente' || e.codigo === 'sem_rascunho_aprovado');
  }
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
  return '<details class="fx-pag" id="pag-box"><summary><b>Pagamento</b><span class="sub">' + (p ? 'link enviado em ' + esc(fmtDate(p.quando)) : 'nenhum link enviado') + '</span></summary>' +
    '<div class="fx-pag-corpo"><div class="pag-linha">' +
    (p ? '<span class="pill u-baixa" title="' + esc(p.rotulo || '') + '">Link enviado em ' + esc(fmtDate(p.quando)) + '</span><button class="btn" type="button" data-pagar="' + esc(c.id) + '">Reenviar</button>'
      : '<button class="btn primary" type="button" data-pagar="' + esc(c.id) + '">Enviar link de pagamento</button>') + '</div>' +
    (p && p.rotulo ? '<p class="sub" style="margin:8px 0 0">' + esc(p.rotulo) + '</p>' : '') + assinaturaHtml() +
    '<p class="sub" style="margin:8px 0 0">Manda o e-mail “Link de pagamento” do Estúdio, com o Payment Link do plano. O link leva o e-mail dela e o id da ficha.</p></div></details>';
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
// Editar sem botão: dois cliques (ou Enter) no texto de um passo. data-dbl = a ação; data-id = o passo.
// ---------- Quadro do passo (checklist dela): clique no passo abre o que ela vê no app; dois cliques editam o texto ----------
var FX_DETALHE = null, qdTimer = null, qdOrigem = null, qdAberto = false;
async function fxCarregaDetalhe() {
  if (FX_DETALHE) return FX_DETALHE;
  try { var r = await fetch('guias-detalhe.json?v=2026-11-19.5'); FX_DETALHE = r.ok ? await r.json() : {}; } catch (e) { FX_DETALHE = {}; }
  return FX_DETALHE;
}
function fxFechaQuadro() {
  if (!qdAberto) return;
  qdAberto = false;
  var h = document.getElementById('fx-qd-host'); if (h) h.remove();
  document.body.classList.remove('qd-aberto');
  if (qdOrigem && qdOrigem.focus && document.contains(qdOrigem)) qdOrigem.focus();
  qdOrigem = null;
}
async function fxAbreQuadro(stepKey, origem) {
  var chk = state.dos && state.dos.chk; if (!chk || !chk.itens) return;
  var item = chk.itens.filter(function (i) { return i.step_key === stepKey; })[0]; if (!item) return;
  var det = await fxCarregaDetalhe();
  fxFechaQuadro(); qdOrigem = origem || null;
  var host = document.createElement('div'); host.id = 'fx-qd-host';
  host.innerHTML = FH.htmlQuadroPasso({ item: item, guia: det[stepKey] || null, hoje: new Date().toISOString().slice(0, 10) }, H_FX);
  document.body.appendChild(host); document.body.classList.add('qd-aberto'); qdAberto = true;
  var fe = host.querySelector('.qd-x'); if (fe && fe.focus) fe.focus();
}
function editaPorDuploClique(e) {
  clearTimeout(qdTimer);
  var t = e.target && e.target.closest && e.target.closest('[data-dbl]'); if (!t) return false;
  if (t.dataset.dbl === 'ckEditar') { fichaClick({ dataset: { fx: 'ckEditar', id: t.dataset.id } }); return true; }
  if (/^ed-[a-z]+$/.test(t.dataset.dbl)) { casoAcao(t.dataset.dbl, t.dataset.id, null); return true; }
  return false;
}
document.addEventListener('change', async function (e) {
  var inp = e.target && e.target.matches && e.target.matches('input[data-anexar]') ? e.target : null; if (!inp || !inp.files || !inp.files[0]) return;
  var k = state.caso, itm = k && k.itens.filter(function (x) { return String(x.id) === inp.dataset.anexar; })[0], f = inp.files[0]; if (!itm) return;
  toast('Subindo ' + f.name + '…');
  var sb = await casoSobeArquivoDe(itm.contato_id || state.sel, f); inp.value = '';
  if (sb.erro) return toast(sb.erro);
  var r = await supabase.from('board_itens').update({ arquivo_caminho: sb.caminho, arquivo_anexado_em: new Date().toISOString() }).eq('id', itm.id);
  if (r.error) return casoFalha('anexar o arquivo', r.error);
  if (itm.arquivo_caminho) { try { await supabase.storage.from('casos-arquivos').remove([itm.arquivo_caminho]); } catch (x) { /* sobra de arquivo não quebra nada */ } }
  await casoRecarrega(); toast(itm.estado === 'publicado' ? 'Arquivo anexado. Ela já pode abrir.' : 'Arquivo anexado. Publique para ela ver.');
});
document.addEventListener('dblclick', function (e) { if (editaPorDuploClique(e)) e.preventDefault(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.dbl && editaPorDuploClique(e)) e.preventDefault(); });
document.addEventListener('click', async function (e) {
  if (e.target.id === 'compose-backdrop') return closeCompose();
  document.querySelectorAll('details.mf-dd[open], details.fx-mn[open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });   // a fila de hoje fecha ao clicar fora
  var t = e.target.closest('button, tr[data-id]'); if (!t) return;
  if (t.dataset.potsort) { state.potOrd = !state.potOrd ? 'desc' : state.potOrd === 'desc' ? 'asc' : ''; return renderContacts(); }
  if (t.dataset.caldia !== undefined) { state.calDia = state.calDia === t.dataset.caldia ? '' : t.dataset.caldia; return renderCalendario(); }
  if (t.dataset.calfil !== undefined) { state.calFil = t.dataset.calfil; state.calDia = ''; return renderCalendario(); }
  if (t.dataset.hojeaba) return hojeIrAba(t.dataset.hojeaba);
  if (t.dataset.calmes) { state.calOff = (state.calOff || 0) + Number(t.dataset.calmes); return renderCalendario(); }
  if (t.dataset.hojemais) { state.hMais = true; return renderFila(); }
  if (t.dataset.hojeprob) { state.inbox = 'problemas'; return show('perguntas'); }
  if (t.dataset.dosmd) return dosBaixaMd(t.dataset.dosmd);
  if (t.dataset.dosmsg) return dosMontaMensagem(t.dataset.dosmsg, t.dataset.tipo);
  if (t.dataset.r1) { state.fx.r1 = state.fx.r1 === t.dataset.r1 ? null : t.dataset.r1; return fxRepinta(); }
  if (t.dataset.r1save) return r1Salvar(t.dataset.r1save);
  if (t.dataset.pcpreencher) return pcPreencher(t.dataset.pcpreencher, false);
  if (t.dataset.pcnotion) return pcLerNotion(t.dataset.pcnotion);
  var fxr = fichaClick(t); if (fxr !== false) return fxr;   // ficha v2 (data-fx); false = não é com ela
  if (t.dataset.fv) { state.funilVisao = t.dataset.fv; state.funilPorque = null; return renderBoard(); }
  if (t.dataset.fporque) { state.funilPorque = state.funilPorque === t.dataset.fporque ? null : t.dataset.fporque; return renderBoard(); }
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
  if (t.dataset.caldia !== undefined) { state.calDia = state.calDia === t.dataset.caldia ? '' : t.dataset.caldia; return renderCalendario(); }
  if (t.dataset.calfil !== undefined) { state.calFil = t.dataset.calfil; state.calDia = ''; return renderCalendario(); }
  if (t.dataset.pistaemail) { state.rascunho[t.dataset.pistaemail] = (state.rascPista || {})[t.dataset.pistaemail] || ''; return openPessoa(t.dataset.pistaemail, 'conversa'); }
  if (t.dataset.insacao) {
    var cc0 = byC(state.sel); if (!cc0) return;
    if (t.dataset.insacao === 'dossie') { state.fx.tab = 'dossie'; return fxRepinta(); }
    state.fx.sessao = 'chat'; state.fx.flash = 'chat'; return fxPintaCorpo();
  }
  if (t.dataset.openconv) return openPessoa(t.dataset.openconv, 'conversa');
  if (t.dataset.tplpick) return abrirModelosPicker(t.dataset.tplpick);
  if (t.dataset.tplsel) return openCompose(activeCid, t.dataset.tplsel);
  if (t.dataset.usarrasc) { var sg = (state.rascSug || {})[t.dataset.usarrasc], ct = $('conv-txt'); if (sg && ct) { ct.value = sg; state.rascunho[t.dataset.usarrasc] = sg; ct.focus(); } return; }
  if (t.dataset.ptab) { state.ptab = t.dataset.ptab; return renderPessoa(); }
  if (t.dataset.pstab) return trocaPlatAba(t.dataset.pstab);
  if (t.dataset.caso) {
    if (t.dataset.caso.indexOf('h-') === 0) return filaAcao(t.dataset.caso.slice(2), Number(t.dataset.id), t, t.dataset.c);
    return casoAcao(t.dataset.caso, t.dataset.id, t);
  }
  if (t.dataset.casoFicha) return openPessoa(t.dataset.casoFicha, 'plataforma', 'caso');
  if (t.id === 'conv-send') return sendResposta(t);
  if (t.id === 'conv-previa') return convPrevia(t.dataset.cid);
  if (t.dataset.convrem !== undefined) { (CONV_AX[t.dataset.cid] || []).splice(Number(t.dataset.convrem), 1); var ul = $('conv-anexos-lista'); if (ul) ul.innerHTML = convAnexosLi(t.dataset.cid); return; }
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
  if (t.dataset.ps) { state.ps = t.dataset.ps; state.psel = null; return renderQuestions(); }
  if (t.dataset.p) { state.psel = Number(t.dataset.p); return renderQuestions(); }
  if (t.dataset.pstatus) {
    var pnovo = t.dataset.pstatus, pid = state.psel;
    t.disabled = true;
    var pu = await supabase.from('problemas_app').update({ status: pnovo, resolvido_em: pnovo === 'resolvido' ? new Date().toISOString() : null }).eq('id', pid);
    if (pu.error) { t.disabled = false; return fail('mudar o aviso', pu.error); }
    await reload(); renderQuestions();
    return toast(pnovo === 'resolvido' ? 'Aviso marcado como resolvido' : 'Aviso de volta em Novos');
  }
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
  if (t.dataset.pcler) {   // um botão só: link do Notion no campo → lê o Notion; senão lê o arquivo ou a transcrição colada
    var uNotion = String(($('pc-notion') || {}).value || pcEstado(t.dataset.pcler).notionUrl || '').trim();
    return uNotion ? pcLerNotion(t.dataset.pcler) : pcLer(t.dataset.pcler, t);
  }
  if (t.dataset.montler) return montLer(t.dataset.montler, t);
  if (t.dataset.montgrupo) { montEstado(state.sel).grupo = t.dataset.montgrupo; return pintaMont(state.sel); }
  if (t.dataset.montaplicar) return montLevar(t.dataset.montaplicar, t);
  if (t.dataset.montaprovar) return montAprovarFila(t.dataset.montaprovar, t);
  if (t.dataset.montdescartar) return montDescartar(t.dataset.montdescartar, t);
  if (t.dataset.montpub) return montPub(t.dataset.montpub);
  if (t.dataset.montliberar) return montLiberar(t.dataset.montliberar, t);
  if (t.dataset.montconferido) return montConferido(state.sel, t.dataset.montconferido);
  if (t.dataset.montdossie) { if (!window.confirm('Isto troca o Resumo e os Próximos passos do Dossiê pelo texto desta leitura. Continuar?')) return; return montPreencheDossie(t.dataset.montdossie, true).then(function (n) { toast(n ? 'Resumo e Próximos passos atualizados.' : 'A leitura não trouxe resumo nem próximos passos.'); }); }
  if (t.dataset.chatsug) return chatSugUsar(t.dataset.chatsug);
  if (t.dataset.chatsugdesc) return chatSugDescartar(t.dataset.chatsugdesc);
  if (t.dataset.montprevia) return montPrevia(state.sel, t.dataset.montprevia);
  if (t.dataset.montenviar) return montEnviar(state.sel, t.dataset.montenviar, t);
  if (t.dataset.pcaplicar) return pcAplicar(t.dataset.pcaplicar, t);
  if (t.dataset.pcdescartar) return pcDescartar(t.dataset.pcdescartar, t);
  if (t.dataset.pcchat) return pcChat(t.dataset.pcchat);
  if (t.dataset.pcresolver) return pcResolver(state.sel, t.dataset.pcresolver, t);
  if (t.id === 'onb-enviar') return onbEnviar();
  if (t.id === 'onb-abrir') return openPessoa(ONB.contato, 'ficha');
  if (t.id === 'onb-outra') { ONB = onbInicial(); return carregarOnboarding(); }
  if (t.id === 'ont-ler') return ontLer();
  if (t.id === 'ont-abrir') { state.ontResumo = ONT.res; return openPessoa(ONT.res.contato_id, 'plataforma', 'interacoes'); }
  if (t.dataset.ontresfechar) { state.ontResumo = null; return pintaPlat(byC(state.sel)); }
  if (t.id === 'ont-outra') { ONT = ontInicial(); return ontPinta(); }
  if (t.dataset.ontcopiar) return ontCopiar();
  if (t.dataset.onbrem !== undefined) { ONB.arquivos.splice(Number(t.dataset.onbrem), 1); return onbPintaArquivos(); }
  if (t.dataset.onbfechar) { state.onbResumo = null; var rb = $('onb-resumo'); if (rb) rb.hidden = true; return; }
  if (t.dataset.pagar) return abrirLinkPagamento(t.dataset.pagar);
  if (t.id === 'pg-enviar') return enviarLinkPagamento(t);
  if (t.dataset.bilanabrir) return bilanAbrir(t.dataset.bilanabrir);
  if (t.dataset.convabrir) return conversaAbrir(t.dataset.convabrir);
  if (t.id === 'cv-previa-btn') return conversaPrevia();
  if (t.id === 'cv-enviar') return conversaEnviar(false);
  if (t.id === 'cv-forcar') return conversaEnviar(true);
  if (t.id === 'bl-previa-btn') return bilanPrevia();
  if (t.id === 'bl-enviar') return bilanEnviar(false);
  if (t.id === 'bl-forcar') return bilanEnviar(true);
  if (t.dataset.blrem !== undefined) { BL.anexos.splice(Number(t.dataset.blrem), 1); bilanPintaAnexos(); return bilanPrevia(); }
  if (t.dataset.chatatnovo || t.dataset.chatatdel || t.dataset.chatatsalva) return chatAtalhoAcao(t);
  if (t.dataset.chatbotao) return chatInserirBotao();
  if (t.dataset.chatenviar) return enviarChat(t.dataset.chatenviar, t);
  if (t.dataset.chkvia) return chkAgir(t.dataset.chkvia, Number(t.dataset.chki));
  if (t.dataset.chatquick) {
    var cq = byC(state.sel);
    if (/^c_/.test(t.dataset.chatquick)) {
      var meu = chatAtalhos().filter(function (a) { return a.k === t.dataset.chatquick; })[0], cm = $('chat-txt');
      if (meu && cm) { cm.value = (cm.value.trim() ? cm.value.replace(/\s+$/, '') + '\n' : '') + meu.t + (meu.u ? '\n[' + meu.r + '](' + meu.u + ')' : ''); state.chatRasc = cm.value; cm.focus(); }
      return;
    }
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
  if (t.dataset.procAprovar) return decidirProcesso(t, 'aprovar');
  if (t.dataset.procDescartar) return decidirProcesso(t, 'descartar');
  if (t.id === 'modal-cancel') return closeCompose();
  if (t.dataset.emailfor) return openCompose(t.dataset.emailfor, t.dataset.tplk);
  if (t.dataset.cmpaba) return cmpAba(t.dataset.cmpaba);
  if (t.id === 'cmp-restaurar') { CMP.editado = null; $('compose-txt').value = CMP.e.body; return cmpFormato(); }
  if (t.dataset.tplPick) { ST.criar = null; await salvar(); abrirModelo(t.dataset.tplPick); ST.tab = 'editar'; return renderModelos(); }
  if (t.dataset.eepasso) { await salvar(); ST.passo = t.dataset.eepasso; $('studio').dataset.previa = previaAberta() ? '1' : '0'; renderEditor(); return renderPrevia(); }
  if (t.dataset.stdev) { ST.dev = t.dataset.stdev; return renderPrevia(); }
  if (t.dataset.stvertodos) { ST.verTodos = !ST.verTodos; return renderModelos(); }
  if (t.dataset.stmodo) { ST.modo = t.dataset.stmodo; renderPrevia(); return renderEditor(); }
  if (t.dataset.stcasoPasso) {
    var cs = casosDaPrevia(ST.k), ic = cs.indexOf(casoEscolhido(cs)) + Number(t.dataset.stcasoPasso);
    if (cs[ic]) { ST.caso = cs[ic].id; renderPrevia(); renderEditor(); }
    return;
  }
  if (t.dataset.sttab) { ST.tab = t.dataset.sttab; return renderModelos(); }
  if (t.dataset.stver) { await salvar(); abrirModelo(ST.k, Number(t.dataset.stver)); return renderModelos(); }
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
  if (t.dataset.qpop !== undefined) { ST.qpop = ST.qpop === t.dataset.qpop ? '' : t.dataset.qpop; return renderEditor(); }
  if (t.id === 'st-previa-tg') { ST.previa = !previaAberta(); return renderModelos(); }
  if (t.dataset.vista) { await salvar(); ST.vista = t.dataset.vista; return renderModelos(); }
  if (t.dataset.jrAbrir) { await salvar(); ST.criar = null; abrirModelo(t.dataset.jrAbrir); ST.vista = 'estudio'; ST.tab = 'editar'; ST.passo = 'texto'; return renderModelos(); }
  if (t.dataset.jrCriar) return criarNaJornada(t.dataset.jrCriar);
  if (t.dataset.stnovoAqui) {
    await salvar();
    var pgN = pgAtual(jornadaAtual()), paraN = paraVazio(), matN = Object.keys(ORIGEM_PAGINA).filter(function (x) { return ORIGEM_PAGINA[x] === pgN; })[0];
    if (matN) paraN.materiais = [matN];
    ST.criar = { passo: 1, obj: null, nome: '', para: paraN, classe: { familia: null, pagina: TX.PAGINAS.some(function (p) { return p.k === pgN; }) ? pgN : null, etapa: null, persona: null } };
    ST.vazio = false; ST.vista = 'estudio'; ST.tab = 'editar'; return renderModelos();
  }
  if (t.id === 'st-novo-modelo') { await salvar(); ST.criar = { passo: 1, obj: null, nome: '', para: paraVazio(), classe: { familia: null, pagina: null, etapa: null, persona: null } }; ST.vista = 'estudio'; ST.tab = 'editar'; return renderModelos(); }
  if (t.id === 'novo-cancelar') { ST.criar = null; ST.vista = 'jornada'; return renderModelos(); }
  if (t.dataset.novoobj) { var ob = ES.objetivo(t.dataset.novoobj); ST.criar.obj = ob.k; ST.criar.classe.familia = TX.familiaDoObjetivo(ob.k); if (!ST.criar.nome || ES.OBJETIVOS.some(function (x) { return x.nome === ST.criar.nome; })) ST.criar.nome = ob.nome; ST.criar.passo = 2; return renderModelos(); }
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
// Escolheu uma página de entrada no dropdown: abre o primeiro e-mail dela, ou mostra as etapas para criar.
async function abrirPaginaEntrada(pg) {
  await salvar(); ST.criar = null; ST.vista = 'estudio'; ST.tab = 'editar';
  var pri = modelosDaPagina(jornadaAtual(), pg)[0];
  if (pri) abrirModelo(pri.chave); else { ST.vazio = true; ST.pg = pg; ST.k = null; ST.v = null; ST.d = null; ST.dKey = null; ST.montado = null; }
  return renderModelos();
}
document.addEventListener('change', async function (e) {
  if (e.target.id === 'st-pg-sel') return abrirPaginaEntrada(e.target.value);
  if (e.target.id === 'pc-arq') return pcEscolheArquivo(e.target);
  if (e.target.id === 'pc-notion' && state.sel) { pcEstado(state.sel).notionUrl = e.target.value; return; }
  if (e.target.dataset && e.target.dataset.montmarca) return montMarca(state.sel, e.target.dataset.montmarca, e.target.checked);
  if (e.target.dataset && e.target.dataset.montmotivo) return montMarca(state.sel, e.target.dataset.montmotivo, false, e.target.value);
  if (e.target.dataset && e.target.dataset.montpode !== undefined) { montEstado(state.sel).pode = e.target.checked; return pintaMont(state.sel); }
  if (e.target.dataset && e.target.dataset.montconfiro !== undefined) { montEstado(state.sel).confiro = e.target.checked; return pintaMont(state.sel); }
  if (e.target.dataset && e.target.dataset.montforcar !== undefined) { montEstado(state.sel).forcar = e.target.checked; return pintaMont(state.sel); }
  if (e.target.id === 'h-cat') { state.hCat = e.target.value; state.hMais = false; return renderFila(); }
  if (e.target.id === 'h-ord') { state.hOrd = e.target.value; return renderFila(); }
  if (e.target.id === 'k-per') { state.kper = Number(e.target.value); return renderKpis(); }
  if (e.target.id === 'compose-tpl') return openCompose(activeCid, e.target.value);
  if (e.target.id === 'st-caso') { ST.caso = e.target.value; renderPrevia(); return renderEditor(); }
  if (e.target.id === 'st-who') { ST.who = e.target.value; return renderPrevia(); }
  if (e.target.dataset && e.target.dataset.novopara && ST.criar) { mudarPara(ST.criar.para, e.target.dataset.novopara, e.target.value, e.target.checked); if (e.target.dataset.novopara === 'produto' || e.target.dataset.novopara === 'materiais') renderCriar(); criarPode(); return renderPrevia(); }
  if (e.target.dataset && e.target.dataset.pq) {
    var mq = modeloAtual(), np = JSON.parse(JSON.stringify(mq.para_quem || {}));
    mudarPara(np, e.target.dataset.pq, e.target.value, e.target.checked);
    ['personas', 'materiais', 'etapas', 'segmentos', 'estagios'].forEach(function (g) { if (np[g] && !np[g].length) delete np[g]; });
    return salvarModelo({ para_quem: np, quem_recebe: paraResumo({ tipo: mq.tipo, para_quem: np }) }, 'Para quem salvo');
  }
  if (e.target.dataset && e.target.dataset.classe) return mudarClasse(e.target.dataset.classe, e.target.value);
  if (e.target.dataset && e.target.dataset.novoclasse && ST.criar) {
    var cl = ST.criar.classe, campo = e.target.dataset.novoclasse; cl[campo] = e.target.value || null;
    if (campo === 'pagina') cl.etapa = null;
    return renderCriar();
  }
  if (e.target.dataset && e.target.dataset.envio) return mudarEnvio(e.target.dataset.envio, e.target.value);
  if (e.target.id === 'st-marcar') { ST.marcar = e.target.checked; return renderPrevia(); }
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
  if (e.target.id === 'tplpick-q') {
    var q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#tplpick .tplrow').forEach(function (b) { b.hidden = !!q && b.dataset.q.indexOf(q) < 0; });
    document.querySelectorAll('#tplpick [data-grp]').forEach(function (g) { g.hidden = !g.querySelector('.tplrow:not([hidden])'); });
    return;
  }
  if (CMP && e.target.id === 'compose-txt') { CMP.editado = e.target.value === CMP.e.body ? null : e.target.value; return cmpFormato(); }
  if (CMP && e.target.id === 'compose-subj') { $('cmp-env-subj').textContent = e.target.value; return; }
  if (e.target.matches && e.target.matches('input[data-f], textarea[data-f]') && ST.d) { setCampo(e.target.dataset.f, e.target.value); EE.campoMudou(e.target.dataset.f); return aoEditar(); }
  if (e.target.id === 'novo-nome' && ST.criar) { ST.criar.nome = e.target.value; return criarPode(); }
  if (e.target.id === 'st-q') {
    ST.q = e.target.value; var pos = e.target.selectionStart; renderPrevia();
    var q2 = $('st-q'); if (q2) { q2.focus(); q2.selectionStart = q2.selectionEnd = pos; }
  }
});
document.addEventListener('change', function (e) {
  var dsx = e.target.dataset || {}, cidPc = state.sel;
  if (state.pc && state.pc.cid === cidPc && (dsx.pccampo !== undefined || dsx.pcsinalprop !== undefined || dsx.pcfila !== undefined || dsx.pccamada !== undefined || dsx.pcperg !== undefined)) {
    var pcx = state.pc;
    if (dsx.pccampo !== undefined) pcx.sel.campos[dsx.pccampo] = !!e.target.checked;
    if (dsx.pcsinalprop !== undefined) pcx.sel.sinais[dsx.pcsinalprop] = !!e.target.checked;
    if (dsx.pcfila !== undefined) pcx.sel.fila[dsx.pcfila] = !!e.target.checked;
    if (dsx.pcperg !== undefined) pcx.sel.perg[dsx.pcperg] = !!e.target.checked;
    if (dsx.pccamada !== undefined) pcx.camadas[dsx.pccamada] = e.target.value;
    return;
  }
  if (!e.target.dataset || !e.target.dataset.radarsel || !RS) return;
  if (e.target.checked) RS.sel[e.target.dataset.radarsel] = true; else delete RS.sel[e.target.dataset.radarsel];
  var go = $('radar-enviar-go'); if (go) go.textContent = radarRotuloEnviar();
});
document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-dosg]')) { var fx = state.fx; fx.dosAb = fx.dosAb || {}; fx.dosAb[d.dataset.dosg] = d.open; } }, true);
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
  if (e.target.id === 'ont-url') ONT.url = e.target.value;
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'conv-anexos') { convAdicionar(e.target.dataset.cid, e.target.files); e.target.value = ''; return; }
  if (e.target.id === 'bl-anexos') { bilanAdicionar(e.target.files); e.target.value = ''; return; }
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
  if (e.key === 'Enter' && e.target.id === 'ont-url') { e.preventDefault(); return ontLer(); }
  if (e.key === 'Enter' && e.target.matches('tr[data-id]')) openPessoa(e.target.dataset.id);
  if (e.key === 'Escape' && !$('compose-modal').hidden) closeCompose();
});

boot().catch(function (err) { console.error(err); showGate('Erro ao abrir o CRM. Recarregue a página.'); });
// O quadro do passo registra os seus ouvintes por último: os testes (e a ordem de tratamento) esperam o clique principal primeiro.
document.addEventListener('click', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('qd-fundo')) return fxFechaQuadro();
  var t = e.target && e.target.closest && e.target.closest('.fx-ln-t[data-dbl="ed-chk"]'); if (!t) return;
  clearTimeout(qdTimer); qdTimer = setTimeout(function () { fxAbreQuadro(t.dataset.id, t); }, 260);   // dois cliques cancelam: viram edição
});
document.addEventListener('keydown', function (e) {
  if (!qdAberto) return;
  if (e.key === 'Escape') { e.preventDefault(); fxFechaQuadro(); return; }
  if (e.key !== 'Tab') return;   // o foco fica preso dentro do quadro
  var fs = Array.prototype.slice.call(document.getElementById('fx-qd-host').querySelectorAll('button, a[href]')); if (!fs.length) return;
  var a = document.activeElement, i = fs.indexOf(a);
  if (e.shiftKey && i <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); } else if (!e.shiftKey && (i === fs.length - 1 || i < 0)) { e.preventDefault(); fs[0].focus(); }
});
// Página inicial: escolher ou trocar o item de uma vaga direto no seletor.
async function fxHomeMuda(sel) {
  var troca = sel.dataset && sel.dataset.homeTroca, add = sel.dataset && sel.dataset.homeAdd;
  if (!sel.value) return;
  if (troca) { var p = troca.split(':'); return casoHomeTroca(p[0], p.slice(1).join(':'), sel.value); }
  if (add) return casoHome('home-add', add + ':' + sel.value, null);
}
document.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('select[data-home-troca], select[data-home-add]')) fxHomeMuda(t); });
// Curadoria: arrastar um passo geral pela alça ⋮⋮ (quem não arrasta usa ↑ ↓: mesma função, FX.reordenarSessao).
document.addEventListener('dragstart', function (e) {
  var g = e.target && e.target.closest && e.target.closest('.fx-cur-grab'); if (!g) return;
  state.curDrag = g.dataset.cur; if (e.dataTransfer) { try { e.dataTransfer.setData('text/plain', g.dataset.cur); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* sem dataTransfer */ } }
});
document.addEventListener('dragover', function (e) { if (state.curDrag && e.target && e.target.closest && e.target.closest('.fx-cur-row:not(.escondido)')) e.preventDefault(); });
document.addEventListener('drop', function (e) {
  var de = state.curDrag; if (!de) return; state.curDrag = null;
  var r = e.target && e.target.closest && e.target.closest('.fx-cur-row:not(.escondido)'); if (!r) return;
  var c = byC(state.sel); if (!c) return; e.preventDefault();
  var lista = fxCurChaves(c), i = lista.indexOf(de), j = lista.indexOf(r.dataset.cur); if (i < 0 || j < 0 || i === j) return;
  var antes = i < j ? (lista[j + 1] === undefined ? null : lista[j + 1]) : r.dataset.cur;   // arrastou para baixo: cai depois do alvo
  fxCurOrdena(c, FX.reordenarSessao(lista, de, antes));
});
document.addEventListener('dragend', function () { state.curDrag = null; });
