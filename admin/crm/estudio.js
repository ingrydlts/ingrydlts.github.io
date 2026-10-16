// Estúdio de e-mails (entrega 2): os blocos de um modelo viram o assunto, a prévia, o texto puro e o HTML.
// Sem dependências e sem DOM: o painel (crm.js) usa no navegador e o teste do Worker
// (cms-oauth-worker/testes/crm-email.test.mjs) usa no Node, para conferir que o e-mail montado sai certo.
//
// O que sai daqui é o mesmo formato que o Worker preenche na hora de enviar (crmPreencher em worker.js):
//   {nome}             troca pelo valor
//   {#nivel}…{/nivel}  só aparece se houver nível;  {^nivel}…{/nivel}  só se não houver
// O estúdio escreve esse formato sozinho a partir do plano B de cada dado e do "texto se faltar dado" de cada
// bloco. Ninguém escreve HTML: cada bloco tem o seu desenho fixo, igual ao dos e-mails do guia.

// ---------- Os dados da pessoa ----------
// t: texto (pode faltar; tem plano B) · link (vem do banco ou do código; sem ele o envio é recusado) ·
//    fixo (sempre existe) · sim (sim/não, usado em "só para…") · pronto (vem montado do Worker, ex.: botões)
// plano: o que aparece se faltar. Texto = troca por ele ('' = fica vazio); null = o bloco some.
export var CAT = {
  nome: { t: 'texto', o: 'primeiro nome', plano: '' },
  email: { t: 'fixo', o: 'o e-mail dela' },
  persona: { t: 'texto', o: 'o checklist dela, em minúsculas', plano: 'checklist' },
  nivel: { t: 'texto', o: 'o nível que ela marcou no guia', plano: null },
  prazo_nivel: { t: 'texto', o: 'o prazo do nível no calendário', plano: null },
  etapa: { t: 'texto', o: 'a etapa que ela marcou no guia, por extenso', plano: null },
  cidade: { t: 'texto', o: 'a cidade que ela tocou no e-mail 2', plano: 'a cidade que você escolher' },
  motivo: { t: 'texto', o: 'o motivo do "Precisa de você"', plano: null },
  prazo_limite: { t: 'texto', o: 'a data do prazo de 3 meses (DD/MM/AAAA)', plano: null },
  dias_para_prazo: { t: 'texto', o: 'os dias até o prazo', plano: null },
  link_checklist: { t: 'link', o: 'o link privado do guia no Notion (vem do banco, com UTM)', privado: true },
  link_acesso: { t: 'link', o: 'o link do app' },
  link_agenda: { t: 'link', o: 'o link da agenda (cal.com)' },
  botoes_cidade: { t: 'pronto', o: 'os 8 botões de cidade, com o link assinado dela (vêm do Worker)', privado: true },
  au_pair: { t: 'sim', o: 'a persona é au pair → estudante' },
  prazo_vencido: { t: 'sim', o: 'o prazo de 3 meses já venceu' },
  prazo_a_vencer: { t: 'sim', o: 'o prazo de 3 meses ainda vai vencer' }
};
var ETAPAS_CF = { nao_comecei: 'ainda não começou', escolhendo_curso: 'está escolhendo o curso', juntando_documentos: 'está juntando documentos, traduções e o teste',
  dossie_enviado: 'já enviou o dossiê', entrevista_resposta: 'está esperando a entrevista ou a resposta' };
var ETAPAS_ALT = { pesquisando: 'ainda está pesquisando', escolhendo_escola: 'está escolhendo escola', recusa_idade: 'ouviu "só até 29"',
  buscando_empresa: 'está buscando empresa', montando_contrato: 'está montando o contrato' };
Object.keys(ETAPAS_CF).forEach(function (k) { CAT['etapa_' + k] = { t: 'sim', o: 'etapa do guia: ' + ETAPAS_CF[k], etapa: true }; });
Object.keys(ETAPAS_ALT).forEach(function (k) { CAT['etapa_' + k] = { t: 'sim', o: 'etapa do guia: ' + ETAPAS_ALT[k], etapa: true }; });

// Os dados que cada modelo tem na hora do envio (o Worker ou o painel preenche exatamente estes).
var PAINEL = ['nome', 'persona', 'link_acesso', 'link_agenda', 'au_pair', 'motivo', 'prazo_vencido', 'prazo_a_vencer', 'prazo_limite', 'dias_para_prazo'];
var ALT = Object.keys(ETAPAS_ALT).map(function (k) { return 'etapa_' + k; });
export var VARS_DE = {
  boas_vindas: PAINEL.concat(ALT), naoabriu: PAINEL.concat(ALT), naoclicou: PAINEL.concat(ALT), cliquenaoapp: PAINEL.concat(ALT),
  parouapp: PAINEL.concat(ALT), guia_chamada: PAINEL.concat(ALT), guia_plataforma: PAINEL.concat(ALT), guia_alternancia: PAINEL.concat(ALT),
  cf_guia_1: ['nome', 'email', 'link_checklist', 'nivel', 'prazo_nivel', 'etapa', 'cidade'].concat(Object.keys(ETAPAS_CF).map(function (k) { return 'etapa_' + k; })),
  cf_guia_conversa: ['nome', 'email', 'botoes_cidade']
};
export function varsDoModelo(chave) { return VARS_DE[chave] || ['nome', 'email']; }

// ---------- Os blocos ----------
export var TIPOS = {
  texto: { nome: 'Texto', d: 'Um parágrafo. **assim** fica em negrito.' },
  titulo: { nome: 'Título', d: 'A frase grande do topo.' },
  botao: { nome: 'Botão', d: 'Um botão para um link que vem do banco.' },
  destaque: { nome: 'Destaque', d: 'Uma caixa com rótulo, valor e nota (ex.: o prazo dela).' },
  apresentacao: { nome: 'Apresentação com foto', d: 'A sua foto, o seu nome e uma linha sobre você.' },
  pergunta: { nome: 'Pergunta', d: 'A pergunta grande e uma linha de ajuda.' },
  toques: { nome: 'Respostas de um toque', d: 'Os botões que ela toca para responder (vêm prontos do Worker).' },
  etapa: { nome: 'Só para uma etapa', d: 'Um trecho que só aparece para quem marcou aquela etapa.' },
  assinatura: { nome: 'Assinatura', d: 'Ingryd · Por Dentro.' }
};
export var FOTO_URL = 'https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg';
export var TIPO_RODAPE = {
  novidades: 'Novidades: só sai para quem aceitou receber novidades, com "responda sair" no rodapé.',
  servico: 'Serviço: é o que ela pediu. Sai para todo mundo, sem rodapé de descadastro.',
  compra: 'Compra: sobre algo que ela comprou. Sai para quem comprou, sem rodapé de descadastro.'
};

function novoBloco(tipo) {
  if (tipo === 'texto') return { tipo: 'texto', texto: '' };
  if (tipo === 'titulo') return { tipo: 'titulo', texto: '' };
  if (tipo === 'botao') return { tipo: 'botao', rotulo: '', link: '' };
  if (tipo === 'destaque') return { tipo: 'destaque', rotulo: '', valor: '', nota: '' };
  if (tipo === 'apresentacao') return { tipo: 'apresentacao', titulo: 'Oi, eu sou a Ingryd', texto: 'Moro na França e criei o Por Dentro para quem está fazendo esse caminho agora.' };
  if (tipo === 'pergunta') return { tipo: 'pergunta', texto: '', ajuda: '' };
  if (tipo === 'toques') return { tipo: 'toques', var: 'botoes_cidade' };
  if (tipo === 'etapa') return { tipo: 'etapa', se: '', rotulo: '', titulo: '', texto: '' };
  return { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
}
export { novoBloco };

// ---------- Montar ----------
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var SANS = "font-family:'Inter', Arial, Helvetica, sans-serif;";
var SERIF = "font-family:'Fraunces', Georgia, 'Times New Roman', serif;";
// Texto escrito no bloco → texto puro (tira os **) ou HTML (escapa, **negrito**, links públicos e quebras de linha).
function fmt(s, html) {
  s = String(s == null ? '' : s);
  if (!html) return s.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  return escH(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(https:\/\/[^\s<{]+[^\s<{.,;:!?)])/g, '<a href="$1" style="color:#577328;">$1</a>').replace(/\n/g, '<br>');
}
function varsEm(s) { var r = [], m, re = /\{(\w+)\}/g; while ((m = re.exec(String(s || '')))) if (r.indexOf(m[1]) < 0) r.push(m[1]); return r; }
function planoDe(d, k) { var p = d.planos || {}; if (Object.prototype.hasOwnProperty.call(p, k)) return p[k]; return CAT[k] ? CAT[k].plano : null; }
function textuais(s) { return varsEm(s).filter(function (k) { return CAT[k] && CAT[k].t === 'texto'; }); }
function todas(op, vs, x) { vs.slice().reverse().forEach(function (k) { x = '{' + op + k + '}' + x + '{/' + k + '}'; }); return x; }
function falta(vs, x) { if (!vs.length) return ''; var k = vs[0], resto = vs.slice(1); return '{^' + k + '}' + x + '{/' + k + '}' + (resto.length ? '{#' + k + '}' + falta(resto, x) + '{/' + k + '}' : ''); }
// Um campo de texto com dados. Devolve { s, ess }: ess = dados sem plano B, sem os quais o bloco some.
// Com "texto se faltar dado" (alt): todos os dados do campo são essenciais e, se faltar algum, entra o alt.
function campo(src, alt, d, html, fora) {
  var vs = textuais(src).filter(function (k) { return (fora || []).indexOf(k) < 0; });
  if (alt && String(alt).trim() && vs.length) {
    return { s: todas('#', vs, fmt(src, html)) + falta(vs, campo(alt, '', d, html, fora).s), ess: [] };
  }
  var ess = [];
  var s = fmt(src, html).replace(/\{(\w+)\}/g, function (m, k) {
    if (vs.indexOf(k) < 0) return m;
    var p = planoDe(d, k);
    if (p == null) { if (ess.indexOf(k) < 0) ess.push(k); return m; }
    if (p === '') return m;   // vazio: {nome} sem valor já sai vazio
    return '{#' + k + '}{' + k + '}{/' + k + '}{^' + k + '}' + fmt(p, html) + '{/' + k + '}';
  });
  return { s: s, ess: ess };
}
function juntaEss() { var r = []; for (var i = 0; i < arguments.length; i++) arguments[i].forEach(function (k) { if (r.indexOf(k) < 0) r.push(k); }); return r; }
function linkDe(b, html) { return b.link ? '{' + b.link + '}' + (html ? escH(b.complemento || '') : (b.complemento || '')) : ''; }

// Um bloco → { txt, html, ess }.
function bloco(b, d) {
  var t, h, a, x, y, z;
  switch (b.tipo) {
    case 'texto':
      a = campo(b.texto, b.alt, d, false); x = campo(b.texto, b.alt, d, true);
      if (b.estilo === 'caixa') h = '<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; ' + SANS + ' font-size:14px; line-height:1.55; color:#6E6862;">' + x.s.replace(/<b>/g, '<b style="color:#2B2B2B;">') + '</p>';
      else if (b.estilo === 'discreto') h = '<p style="margin:0 0 16px; ' + SANS + ' font-size:14px; line-height:1.55; color:#6E6862;">' + x.s + '</p>';
      else h = '<p style="margin:0 0 16px; ' + SANS + ' font-size:15px; line-height:1.6; color:#2B2B2B;">' + x.s + '</p>';
      return { txt: a.s, html: (b.linha ? '<div style="border-top:1px solid #E2DED7; margin:8px 0 16px;"></div>\n' : '') + h, ess: a.ess };
    case 'titulo':
      a = campo(b.texto, b.alt, d, false); x = campo(b.texto, b.alt, d, true);
      return { txt: a.s, html: '<h1 style="margin:0 0 14px; ' + SERIF + ' font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">' + x.s + '</h1>', ess: a.ess };
    case 'pergunta':
      a = campo(b.texto, b.alt, d, false); x = campo(b.texto, b.alt, d, true);
      y = campo(b.ajuda, '', d, false); z = campo(b.ajuda, '', d, true);
      return { txt: a.s + (b.ajuda ? '\n' + y.s : ''), ess: juntaEss(a.ess, y.ess),
        html: '<h1 style="margin:0 0 10px; ' + SERIF + ' font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">' + x.s + '</h1>' +
          (b.ajuda ? '\n<p style="margin:0 0 16px; ' + SANS + ' font-size:14px; line-height:1.55; color:#6E6862;">' + z.s + '</p>' : '') };
    case 'botao':
      a = campo(b.rotulo, b.alt, d, false); x = campo(b.rotulo, b.alt, d, true);
      return { txt: a.s + ': ' + linkDe(b), ess: a.ess,
        html: '<p style="margin:0 0 24px;"><a href="' + linkDe(b, true) + '" style="display:inline-block; background:#577328; color:#FBFAF7; ' + SANS + ' font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">' + x.s + '</a></p>' };
    case 'destaque':
      a = campo(b.rotulo, '', d, false); x = campo(b.rotulo, '', d, true);
      y = campo(b.valor, '', d, false); z = campo(b.valor, '', d, true);
      var n1 = campo(b.nota, '', d, false), n2 = campo(b.nota, '', d, true);
      var curto = String(b.valor || '').indexOf('\n') < 0 && String(b.valor || '').length <= 40;
      t = curto ? a.s + ': ' + y.s : a.s + '\n' + y.s;
      if (b.nota) t += '\n' + n1.s;
      h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;">' +
        '<div style="' + SANS + ' font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">' + x.s + '</div>' +
        (curto ? '<div style="' + SERIF + ' font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">' + z.s + '</div>'
          : '<div style="' + SANS + ' font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">' + z.s + '</div>') +
        (b.nota ? '<div style="' + SANS + ' font-size:13px; line-height:1.5; color:#6E6862;">' + n2.s + '</div>' : '') + '</td></tr></table>';
      return { txt: t, html: h, ess: juntaEss(a.ess, y.ess, n1.ess) };
    case 'apresentacao':
      a = campo(b.titulo, '', d, false); x = campo(b.titulo, '', d, true);
      y = campo(b.texto, '', d, false); z = campo(b.texto, '', d, true);
      return { txt: a.s + (/[.!?]$/.test(String(b.titulo || '').trim()) ? ' ' : '. ') + y.s, ess: juntaEss(a.ess, y.ess),
        html: '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>\n' +
          '<td style="width:68px; vertical-align:middle;"><img src="' + FOTO_URL + '" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>\n' +
          '<td style="padding-left:14px; vertical-align:middle;"><div style="' + SERIF + ' font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">' + x.s + '</div>\n' +
          '<div style="' + SANS + ' font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">' + z.s + '</div></td></tr></table>' };
    case 'toques':
      return { txt: '{' + (b.var || 'botoes_cidade') + '}', html: '<div style="margin:0 0 12px;">{' + (b.var || 'botoes_cidade') + '}</div>', ess: [] };
    case 'etapa':
      a = campo(b.rotulo, '', d, false); x = campo(b.rotulo, '', d, true);
      y = campo(b.titulo, '', d, false); z = campo(b.titulo, '', d, true);
      var c1 = campo(b.texto, '', d, false), c2 = campo(b.texto, '', d, true);
      t = [b.rotulo ? a.s : '', b.titulo ? y.s : '', b.texto ? c1.s : ''].filter(Boolean).join('\n');
      h = (b.rotulo ? '<p style="margin:0 0 4px; ' + SANS + ' font-size:12px; color:#6E6862;">' + x.s + '</p>\n       ' : '') +
        '<p style="margin:0 0 16px; ' + SANS + ' font-size:15px; line-height:1.6; color:#2B2B2B;">' + (b.titulo ? '<b>' + z.s + '</b>' + (b.texto ? '<br>' : '') : '') + c2.s + '</p>';
      return { txt: t, html: h, ess: juntaEss(a.ess, y.ess, c1.ess) };
    default:
      a = campo(b.texto, '', d, false); x = campo(b.texto, '', d, true);
      return { txt: a.s, html: '<p style="margin:0; ' + SERIF + ' font-size:16px; font-style:italic; color:#2B2B2B;">' + x.s + '</p>', ess: a.ess };
  }
}
// "Só se tiver" / "Só se não tiver": b.se = '#var' ou '^var'. O tipo etapa usa '#etapa_x'.
function condDe(b) { var m = /^([#^])(\w+)$/.exec(String(b.se || '')); return m ? { op: m[1], k: m[2] } : null; }

export function rodapeDe(d, tipo) {
  var motivo = String(d.rodape || '').trim().replace(/[.\s]+$/, '');
  if (tipo === 'novidades') return 'Você recebe este e-mail porque ' + (motivo ? motivo + ' e aceitou' : 'aceitou') + ' receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.';
  return motivo ? 'Você recebeu este e-mail porque ' + motivo + '.' : '';
}

// O modelo inteiro: d = os blocos guardados (modelos_email_versoes.blocos), tipo = servico | novidades | compra.
export function montar(d, tipo) {
  var assunto = campo(d.assunto, d.assunto_alt, d, false);
  var pre = campo(d.pre, d.pre_alt, d, false);
  var txt = '', html = '';
  (d.itens || []).forEach(function (b) {
    var r = bloco(b, d), c = condDe(b);
    var ess = r.ess.filter(function (k) { return !c || k !== c.k; });
    var t = todas('#', ess, r.txt + '\n\n'), h = todas('#', ess, r.html + '\n');
    if (c) { t = '{' + c.op + c.k + '}' + t + '{/' + c.k + '}'; h = '{' + c.op + c.k + '}' + h + '{/' + c.k + '}'; }
    txt += t; html += h;
  });
  var rod = rodapeDe(d, tipo);
  var rodT = rod ? campo(rod, '', d, false).s : '', rodH = rod ? campo(rod, '', d, true).s : '';
  txt = rodT ? txt + '—\n' + rodT : txt.replace(/\n\n$/, '');
  var doc = '<!DOCTYPE html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>\n' +
    '<body style="margin:0; padding:0; background:#F4F1EC;">\n' +
    '<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">\n' +
    '<tr><td style="padding:0 4px 20px; ' + SERIF + ' font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>\n' +
    '<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">\n' + html + '</td></tr>\n' +
    (rodH ? '<tr><td style="padding:20px 4px 0; ' + SANS + ' font-size:12px; line-height:1.55; color:#6E6862;">' + rodH + '</td></tr>\n' : '') +
    '</table></td></tr></table>\n</body></html>';
  return { assunto: assunto.s, preheader: pre.s || null, corpo_texto: txt, corpo_html: doc,
    ess_assunto: assunto.ess };
}

// ---------- Preencher (igual a crmPreencher do Worker) ----------
function temValor(v) { return !(v == null || v === false || v === ''); }
// marcar: no HTML, pinta o valor de cada dado (só na prévia).
export function preencher(tpl, vars, html, marcar) {
  var secoes = function (s) {
    return s.replace(/\{([#^])(\w+)\}([\s\S]*?)\{\/\2\}/g, function (_, tipo, k, dentro) {
      if (!(k in vars)) throw new Error('o dado {' + k + '} não existe neste modelo');
      return (tipo === '#') === temValor(vars[k]) ? secoes(dentro) : '';
    });
  };
  var out = secoes(String(tpl)).replace(/\{(\w+)\}/g, function (_, k) {
    if (!(k in vars)) throw new Error('o dado {' + k + '} não existe neste modelo');
    var v = vars[k];
    if (v && typeof v === 'object') return html ? v.html : v.texto;
    if (!temValor(v) || v === true) return '';
    if (!html) return String(v);
    return marcar && k !== 'assunto' && k !== 'pre' && !/^link_/.test(k) ? '<span style="background:#F3E7CD;border-radius:3px">' + escH(v) + '</span>' : escH(v);
  });
  if (/\{[#^/]\w+\}/.test(out)) throw new Error('um trecho {#…} ficou sem fechamento');
  return out;
}
// Igual a crmMontarModelo: devolve { assunto, pre, texto, html } ou dá erro.
export function montarComDados(v, vars, marcar) {
  var assunto = preencher(v.assunto, vars, false);
  if (!assunto.trim()) throw new Error('o assunto ficou vazio');
  if (assunto.length > 200) throw new Error('o assunto passou de 200 letras');
  var pre = v.preheader ? preencher(v.preheader, vars, false) : '';
  var all = Object.assign({}, vars, { assunto: assunto, pre: pre });
  var texto = preencher(v.corpo_texto, all, false);
  if (!texto.trim()) throw new Error('o texto ficou vazio');
  return { assunto: assunto, pre: pre, texto: texto, html: v.corpo_html ? preencher(v.corpo_html, all, true, marcar) : null };
}

// ---------- Conferências do "Pronto para usar?" ----------
// Devolve [{ ok, txt, trava }]: trava = não deixa publicar.
export function conferir(d, m, montado, automatico) {
  var r = [], vs = varsDoModelo(m.chave), usados = [];
  var campos = [d.assunto, d.assunto_alt, d.pre, d.pre_alt, d.rodape];
  (d.itens || []).forEach(function (b) { Object.keys(b).forEach(function (k) { if (typeof b[k] === 'string') campos.push(b[k]); }); if (b.link) usados.push(b.link); if (b.var) usados.push(b.var); var c = condDe(b); if (c) usados.push(c.k); });
  campos.forEach(function (s) { varsEm(s).forEach(function (k) { if (usados.indexOf(k) < 0) usados.push(k); }); var re = /\{[#^/](\w+)\}/g, mm; while ((mm = re.exec(String(s || '')))) if (usados.indexOf(mm[1]) < 0) usados.push(mm[1]); });
  var estranhos = usados.filter(function (k) { return vs.indexOf(k) < 0; });
  r.push({ ok: !!String(d.assunto || '').trim(), txt: 'Assunto preenchido', trava: true });
  r.push({ ok: (d.itens || []).length > 0, txt: 'Pelo menos um bloco', trava: true });
  r.push({ ok: !estranhos.length, txt: estranhos.length ? 'Dados que este modelo não tem: ' + estranhos.map(function (k) { return '{' + k + '}'; }).join(', ') : 'Só usa dados que este modelo tem', trava: true });
  var semLink = (d.itens || []).filter(function (b) { return b.tipo === 'botao' && !b.link; }).length;
  r.push({ ok: !semLink, txt: semLink ? semLink + ' botão sem link' : 'Botões com link', trava: true });
  var escritos = campos.join('\n').match(/https?:\/\/[^\s]+/g) || [];
  var privados = escritos.filter(function (u) { return /notion\.(so|site)|[?&]t=|\/conversa\/\?/.test(u); });
  r.push({ ok: !privados.length, txt: privados.length ? 'Link privado digitado no texto: use o dado do link (vem do banco)' : 'Links privados só por dado (nenhum digitado)', trava: true });
  var comp = (d.itens || []).filter(function (b) { return b.complemento && !/^[&?][\w=&.%-]*$/.test(b.complemento); }).length;
  r.push({ ok: !comp, txt: comp ? 'Complemento de link inválido (use só ?utm_… ou &utm_…)' : 'Complementos de link ok', trava: true });
  var colchete = /\[[^\]\n]{2,60}\]/.test(campos.join('\n'));
  r.push({ ok: !colchete, txt: colchete ? (automatico ? 'Há um [trecho entre colchetes]: o Worker recusa' : 'Há um [trecho entre colchetes]: você troca antes de enviar') : 'Nenhum [trecho entre colchetes]', trava: automatico });
  var erro = null;
  try {
    var teste = {}; vs.forEach(function (k) { teste[k] = CAT[k] && CAT[k].t === 'sim' ? true : 'x'; });
    if (montado) { montarComDados(montado, teste); vs.forEach(function (k) { teste[k] = ''; }); teste.email = 'x'; try { montarComDados(montado, teste); } catch (e) { if (!/assunto|texto ficou/.test(e.message)) throw e; } }
  } catch (e) { erro = e.message; }
  r.push({ ok: !erro, txt: erro ? 'O texto tem um erro: ' + erro : 'O texto monta sem erro', trava: true });
  if (montado && montado.ess_assunto && montado.ess_assunto.length) r.push({ ok: false, txt: 'O assunto fica vazio sem ' + montado.ess_assunto.map(function (k) { return '{' + k + '}'; }).join(', ') + ': dê um plano B ou um assunto se faltar dado', trava: false });
  var assin = (d.itens || []).some(function (b) { return b.tipo === 'assinatura'; });
  r.push({ ok: assin, txt: assin ? 'Assinatura no fim' : 'Sem assinatura', trava: false });
  return r;
}

// ---------- Os dados de uma pessoa do CRM, para a prévia ----------
// Os mesmos que o Worker (e-mails 1 e 2) e o painel (os 8 manuais) preenchem. h = { pn, persona, fmtDay, appLink, calLink }.
var CF_NIVEIS = { l1: ['1º ano de Licence', '14/12/2026'], arq: ['Arquitetura', '14/12/2026'], l2l3: ['2º ou 3º ano de Licence', '17/01/2027'],
  lpro: ['Licence Pro', '17/01/2027'], master: ['Master', '17/01/2027'], escola: ['Escola (engenharia, comércio)', '17/01/2027'] };
var CF_CIDADES = [['paris', 'Paris'], ['lyon', 'Lyon'], ['toulouse', 'Toulouse'], ['montpellier', 'Montpellier'], ['bordeaux', 'Bordeaux'], ['lille', 'Lille'], ['outra', 'Outra cidade'], ['nao-sei', 'Ainda não sei']];
var CF_CIDADE = {}; CF_CIDADES.forEach(function (c) { CF_CIDADE[c[0]] = c[1]; });
export var ETAPA_NOME = { 'cf-nao-comecei': 'ainda não começou', 'cf-escolhendo-curso': 'escolhendo o curso', 'cf-juntando-documentos': 'juntando documentos, traduções e o teste',
  'cf-dossie-enviado': 'já enviou o dossiê', 'cf-entrevista-resposta': 'esperando a entrevista ou a resposta' };
function primeiroNome(nome) { return (String(nome || '').replace(/[\r\n\t]+/g, ' ').trim().split(/\s+/)[0] || '').slice(0, 40); }
// Os botões de cidade da prévia: o link de verdade só existe no envio (é assinado para cada pessoa).
function botoesPrevia() {
  var sans = "font-family:'Inter', Arial, Helvetica, sans-serif;";
  return { texto: CF_CIDADES.map(function (c) { return c[1] + ': https://imigrantepordentro.com/conversa/?r=' + c[0] + '&t=…'; }).join('\n'),
    html: CF_CIDADES.map(function (c, i) {
      return '<a href="#" style="display:inline-block; margin:0 6px 8px 0; ' + sans + ' font-size:14px; font-weight:600; text-decoration:none; padding:9px 16px; border-radius:999px; ' +
        (i >= 6 ? 'border:1.5px solid #CFC9C0; background:#FFFFFF; color:#6E6862;' : 'border:1.5px solid #577328; background:#E4EAD6; color:#3F5519;') + '">' + escH(c[1]) + '</a>';
    }).join('') };
}
export function dadosDe(chave, c, h) {
  var resp = c.respostas || {};
  if (chave === 'cf_guia_1' || chave === 'cf_guia_conversa') {
    var nv = CF_NIVEIS[resp.cfNivel];
    var v = { nome: primeiroNome(c.nome), email: c.email };
    if (chave === 'cf_guia_conversa') { v.botoes_cidade = botoesPrevia(); return v; }
    v.link_checklist = 'https://www.notion.so/…';
    v.nivel = nv ? nv[0] : ''; v.prazo_nivel = nv ? nv[1] : '';
    v.etapa = ETAPA_NOME[resp.objetivo] || ''; v.cidade = CF_CIDADE[resp.cfCidade] || '';
    Object.keys(ETAPAS_CF).forEach(function (k) { v['etapa_' + k] = resp.objetivo === 'cf-' + k.replace(/_/g, '-'); });
    return v;
  }
  var p = {
    nome: h.pn(c), persona: h.persona(c).toLowerCase(), link_acesso: h.appLink, link_agenda: h.calLink, au_pair: c.persona === 'au_pair_estudante', motivo: c.motivo || '',
    prazo_vencido: c.dias_para_prazo != null && Number(c.dias_para_prazo) < 0, prazo_a_vencer: c.dias_para_prazo != null && Number(c.dias_para_prazo) >= 0,
    prazo_limite: h.fmtDay(c.prazo_limite), dias_para_prazo: c.dias_para_prazo
  };
  Object.keys(ETAPAS_ALT).forEach(function (k) { p['etapa_' + k] = !!(resp.objetivo === 'alt-' + k.replace(/_/g, '-')); });
  return p;
}

// ---------- Os blocos de partida: os 10 modelos de hoje, montados em blocos ----------
// Para o e-mail 1 e o e-mail 2, o texto puro montado daqui sai igual ao de hoje (o teste do Worker confere).
var ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
function agenda(rot, camp) { return { tipo: 'botao', rotulo: rot, link: 'link_agenda', complemento: '&utm_source=email&utm_campaign=' + camp }; }
export var INICIAIS = {
  boas_vindas: { assunto: '{nome}, seu link de acesso chegou', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Aqui está o link pra ver o seu checklist de {persona}, já com prazos reais.' },
    { tipo: 'botao', rotulo: 'Abrir o meu checklist', link: 'link_acesso' },
    { tipo: 'texto', texto: 'É sem senha — um clique e você já entra.' }, ASS] },
  naoabriu: { assunto: '{nome}, isso ainda te interessa?', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui.' },
    { tipo: 'botao', rotulo: 'Abrir o meu checklist', link: 'link_acesso' },
    { tipo: 'texto', texto: 'Se caiu no spam, vale marcar como "não é spam" pra não perder os próximos.' }, ASS] },
  naoclicou: { assunto: 'outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist.' },
    { tipo: 'botao', rotulo: 'Ver o meu checklist', link: 'link_acesso' },
    { tipo: 'texto', texto: 'Qualquer dúvida, é só responder.' }, ASS] },
  cliquenaoapp: { assunto: 'seu link ainda funciona, {nome}', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só.' },
    { tipo: 'botao', rotulo: 'Entrar no meu checklist', link: 'link_acesso' },
    { tipo: 'texto', texto: 'Se travou em algo, me conta que eu ajudo.' }, ASS] },
  parouapp: { assunto: 'uma dica rápida pro seu caso', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]' },
    { tipo: 'texto', se: '#motivo', texto: 'Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa.' }, ASS] },
  guia_chamada: { assunto: '{nome}, como está o seu VLS-TS?', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.' },
    { tipo: 'texto', se: '#prazo_vencido', texto: 'Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo.' },
    { tipo: 'texto', se: '#prazo_a_vencer', texto: 'Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias).' },
    { tipo: 'texto', texto: 'Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida.' },
    agenda('Escolher um horário', 'guia-chamada'), ASS] },
  guia_plataforma: { assunto: '{nome}, quer testar a plataforma do Por Dentro?', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só.' },
    { tipo: 'botao', rotulo: 'Quero testar', link: 'link_acesso' },
    { tipo: 'texto', texto: 'É sem senha, um clique e você entra. Em troca, só peço o seu feedback.' }, ASS] },
  guia_alternancia: { assunto: '{nome}, o e-mail para a escola e o próximo passo', itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.' },
    { tipo: 'etapa', se: '#etapa_pesquisando', texto: 'Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico.' },
    { tipo: 'etapa', se: '#etapa_escolhendo_escola', texto: 'Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer "só até 29".' },
    { tipo: 'etapa', se: '#etapa_recusa_idade', texto: 'Você disse que já ouviu "só até 29" de uma escola. Esse "não" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal.' },
    { tipo: 'etapa', se: '#etapa_buscando_empresa', texto: 'Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão.' },
    { tipo: 'etapa', se: '#etapa_montando_contrato', texto: 'Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.' },
    { tipo: 'texto', texto: 'Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/' },
    { tipo: 'texto', texto: 'E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário.' },
    agenda('Escolher um horário', 'guia-alternancia'), ASS] },
  cf_guia_1: {
    assunto: '{nome}, aqui está o seu checklist do Études en France', assunto_alt: 'Aqui está o seu checklist do Études en France',
    pre: '{#nivel}O link para guardar, o prazo do seu nível e o seu próximo passo.{/nivel}{^nivel}O link para guardar, os prazos e o seu próximo passo.{/nivel}',
    rodape: 'pediu o checklist Études en France no Por Dentro com {email}',
    itens: [
      { tipo: 'titulo', texto: '{nome}, o seu checklist está aqui', alt: 'O seu checklist está aqui' },
      { tipo: 'texto', texto: 'Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.' },
      { tipo: 'botao', rotulo: 'Abrir o checklist no Notion', link: 'link_checklist' },
      { tipo: 'destaque', se: '#nivel', rotulo: 'O prazo do seu nível · {nivel}', valor: '{prazo_nivel}', nota: 'Se algum curso que você escolher tiver prazo próprio, vale o menor.' },
      { tipo: 'destaque', se: '^nivel', rotulo: 'Prazos para submeter o dossiê · ciclo 2027-2028', valor: '**14/12/2026** · 1º ano de Licence e Arquitetura\n**17/01/2027** · 2º e 3º ano de Licence, Licence Pro, Master e escolas', nota: 'Se algum curso tiver prazo próprio, vale o menor.' },
      { tipo: 'etapa', se: '#etapa_nao_comecei', rotulo: 'Para quem está na etapa que ainda não começou:', titulo: 'Comece pelo passo 1: o projeto de estudos.', texto: 'Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista.' },
      { tipo: 'etapa', se: '#etapa_escolhendo_curso', rotulo: 'Para quem está na etapa que está escolhendo o curso:', titulo: 'Anote o prazo de cada curso que você escolher.', texto: 'Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr.' },
      { tipo: 'etapa', se: '#etapa_juntando_documentos', rotulo: 'Para quem está na etapa que está juntando documentos, traduções e o teste:', titulo: 'Comece pelo que depende de outras pessoas.', texto: 'Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027.' },
      { tipo: 'etapa', se: '#etapa_dossie_enviado', rotulo: 'Para quem está na etapa que já enviou o dossiê:', titulo: 'Pague a taxa e declare o pagamento.', texto: 'A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma.' },
      { tipo: 'etapa', se: '#etapa_entrevista_resposta', rotulo: 'Para quem está na etapa que está esperando a entrevista ou a resposta:', titulo: 'Treine a entrevista em voz alta.', texto: 'Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha.' },
      { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' },
      ASS] },
  cf_guia_conversa: {
    assunto: '{nome}, uma pergunta rápida', assunto_alt: 'Uma pergunta rápida', pre: 'Um toque e eu já sei para onde você vai.',
    rodape: 'pediu o checklist Études en France com {email}',
    itens: [
      { tipo: 'apresentacao', titulo: 'Oi, eu sou a Ingryd', texto: 'Moro na França e criei o Por Dentro para quem está fazendo esse caminho agora.' },
      { tipo: 'pergunta', texto: '{nome}, para qual cidade você quer ir?', alt: 'Para qual cidade você quer ir?', ajuda: 'Toque numa opção. Leva dois segundos e me ajuda a te mandar o que importa para o seu caso.' },
      { tipo: 'toques', var: 'botoes_cidade' },
      { tipo: 'texto', estilo: 'discreto', linha: true, texto: 'Prefere escrever? Responda este e-mail. Eu leio cada resposta.' },
      ASS] }
};
export function iniciais(chave) {
  var d = INICIAIS[chave] ? JSON.parse(JSON.stringify(INICIAIS[chave])) : { assunto: '', itens: [ASS] };
  d.v = 1; d.planos = d.planos || {}; return d;
}
