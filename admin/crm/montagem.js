// Tela "Montagem do espaço" da aba Dossiê (lógica e HTML puros; o crm.js liga os botões ao Worker e ao banco).
// Fluxo: transcript colado no Dossiê → "Propor a montagem" (IA, só propõe) → você marca o que vale → "Criar rascunhos" (nada chega a ela)
// → situação do acesso → convite (pessoa sem conta) ou aviso de espaço atualizado (pessoa com conta), sempre com o seu "pode enviar".
// As chaves dos itens (enc:, lista:, chk:, doc:, perg:, bloco:) são as mesmas de crm_montagem_aplicar (db/crm-montagem-aplicar.sql).

export var MOTIVOS = [['fato_errado', 'Fato extraído errado'], ['regra_inadequada', 'Regra do percurso inadequada'], ['prazo_desatualizado', 'Prazo desatualizado'], ['excecao', 'Exceção desta pessoa']];
export var GRUPOS = ['Gerais da persona', 'Particulares do percurso', 'Entregas da equipe', 'Prometido na chamada e ainda sem item', 'Checklists', 'Documentos para reunir', 'Perguntas da equipe', 'Lembretes no Início', 'Contatos para acionar'];
var GRUPO_CAMADA = { persona: 'Gerais da persona', particular: 'Particulares do percurso', entrega_equipe: 'Entregas da equipe' };
var DIAS_TESTE = 7;
// As démarches (tipos de checklist) do catálogo processos.json; um teste confere que as chaves são as mesmas.
export var DEMARCHES = { visa_aupair: 'Visa au pair', visa: 'Visa', visa_estudante: 'Visa étudiante', estudos: 'Universidade', trabalho: 'Trabalho', profissao: 'Profissão regulamentada',
  cir: 'Integração (CIR)', ameli: 'Ameli', caf: 'CAF', banco: 'Banco', moradia: 'Moradia', orcamento: 'Orçamento' };

function lista(v) { return Array.isArray(v) ? v : []; }
function dia(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] : ''; }

// Os itens da proposta, na ordem dos grupos. aConferir = não tem fonte ou a conversa não deixa certo: pode virar rascunho, mas não vai para ela.
export function itensDaProposta(p) {
  if (!p || typeof p !== 'object') return [];
  var saida = [];
  function enc(e, grupo, forcaConferir) {
    saida.push({ k: 'enc:' + e.chave, grupo: grupo, titulo: String(e.texto || ''),
      detalhe: (e.dono === 'ela' ? 'Ela faz' : 'Você faz') + (e.prazo ? ' · prazo ' + dia(e.prazo) : e.prazo_texto ? ' · ' + e.prazo_texto : ''),
      momento: (e.origem && e.origem.momento) || '', trecho: (e.origem && e.origem.trecho) || '', certeza: e.certeza || 'confirmar', aConferir: !!forcaConferir || e.certeza === 'confirmar' });
  }
  lista(p.encaminhamentos).forEach(function (e) { enc(e, GRUPO_CAMADA[e.camada] || 'Particulares do percurso', false); });
  lista(p.omissoes).forEach(function (e) { enc(e, 'Prometido na chamada e ainda sem item', true); });
  lista(p.checklists).forEach(function (c) {
    saida.push({ k: 'lista:' + c.chave, grupo: 'Checklists', titulo: 'Lista: ' + String(c.titulo || ''), detalhe: lista(c.itens).length + (lista(c.itens).length === 1 ? ' item · ' : ' itens · ') + (c.origem === 'modelo' ? 'modelo da persona' : 'só deste percurso'), momento: '', trecho: '', certeza: 'inferido', aConferir: false });
    lista(c.itens).forEach(function (i) {
      // O mesmo detalhe do Checklist dela: démarche · quantos subitens · da persona ou só deste percurso · prazo · fonte.
      var subs = lista(i.subitens).map(String), dem = i.demarche && DEMARCHES[i.demarche] ? DEMARCHES[i.demarche] : '';
      saida.push({ k: 'chk:' + c.chave + ':' + i.chave, grupo: 'Checklists', titulo: String(i.titulo || ''), demarche: dem, subitens: subs,
        detalhe: [dem || 'Sem démarche', subs.length ? subs.length + (subs.length === 1 ? ' subitem' : ' subitens') : '', c.origem === 'modelo' ? 'da persona' : 'só deste percurso', i.prazo ? 'prazo ' + dia(i.prazo) : '', 'em "' + String(c.titulo || '') + '"',
          i.fonte ? 'Fonte: ' + i.fonte.rotulo + (i.nivel ? ' (' + i.nivel + ')' : ' (sem nível)') + ' · ' + i.fonte.url : 'Sem fonte'].filter(Boolean).join(' · '),
        momento: '', trecho: '', certeza: 'inferido', aConferir: i.a_conferir !== false });
    });
  });
  lista(p.documentos).forEach(function (d) {
    saida.push({ k: 'doc:' + d.chave, grupo: 'Documentos para reunir', titulo: String(d.rotulo || ''), detalhe: lista(d.selos).length ? 'Exige: ' + d.selos.join(', ') : 'Sem selo', momento: '', trecho: '', certeza: 'inferido', aConferir: false });
  });
  lista(p.perguntas_equipe).forEach(function (q) {
    saida.push({ k: 'perg:' + q.chave, grupo: 'Perguntas da equipe', titulo: String(q.texto || ''), detalhe: 'Resposta em ' + (q.resposta_tipo === 'data' ? 'data' : 'opções') + ' · grava em ' + q.grava_em, momento: '', trecho: '', certeza: 'inferido', aConferir: false });
  });
  lista(p.lembretes).forEach(function (l) {
    saida.push({ k: 'lemb:' + l.chave, grupo: 'Lembretes no Início', titulo: String(l.titulo || ''), detalhe: String(l.texto || '') + ' · aviso em rascunho no Início, chega ' + (l.dias_apos ? l.dias_apos + ' dias depois do primeiro acesso' : 'no primeiro acesso'), momento: l.momento || '', trecho: '', certeza: 'inferido', aConferir: false });
  });
  lista(p.blocos).forEach(function (b) {
    lista(b.itens).forEach(function (i) {
      saida.push({ k: 'bloco:' + b.tipo + ':' + i.chave, grupo: 'Contatos para acionar', titulo: String(i.nome || ''), detalhe: String(b.titulo || b.tipo) + (i.canal ? ' · ' + i.canal : '') + (i.link ? ' · ' + i.link : '') + (i.nota ? ' · ' + i.nota : ''), momento: '', trecho: '', certeza: 'inferido', aConferir: false });
    });
  });
  return saida.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { var d = GRUPOS.indexOf(a.grupo) - GRUPOS.indexOf(b.grupo); return d || a.i - b.i; }).map(function (x) { delete x.i; return x; });
}

// Promessas da chamada cujo(s) único(s) item(ns) você desmarcou: a pendência "conferir se foi entregue" só nasce para promessa SEM item,
// então o aviso evita que a promessa suma sem ninguém ver.
export function promessasAfetadas(p, sel) {
  sel = sel || {};
  var marcado = function (k) { return sel[k] === undefined ? true : !!sel[k]; };
  var cobridores = lista(p && p.encaminhamentos).map(function (e) { return { k: 'enc:' + e.chave, cobre: lista(e.cobre) }; })
    .concat(lista(p && p.documentos).map(function (d) { return { k: 'doc:' + d.chave, cobre: lista(d.cobre) }; }));
  return lista(p && p.compromissos).map(function (c, i) {
    var cs = cobridores.filter(function (x) { return x.cobre.indexOf(i) >= 0; });
    return cs.length && cs.every(function (x) { return !marcado(x.k); }) ? String(c.texto || '') : null;
  }).filter(Boolean);
}

// O que vai ao banco: tudo marcado por padrão; desmarcado vira "rejeitar" (com o motivo, se for um dos conhecidos).
// Item de uma lista marcado puxa a lista junto: o banco recusa um item cuja lista não existe.
export function decisoesDe(itens, sel, motivos) {
  sel = sel || {}; motivos = motivos || {};
  var marcado = function (k) { return sel[k] === undefined ? true : !!sel[k]; };
  var listasPuxadas = {};
  itens.forEach(function (i) { var m = /^chk:([a-z0-9_]+):/.exec(i.k); if (m && marcado(i.k)) listasPuxadas['lista:' + m[1]] = true; });
  var validos = MOTIVOS.map(function (m) { return m[0]; });
  return itens.map(function (i) {
    if (marcado(i.k) || listasPuxadas[i.k]) return { origem_chave: i.k, decisao: 'aprovar' };
    var d = { origem_chave: i.k, decisao: 'rejeitar' };
    if (validos.indexOf(motivos[i.k]) >= 0) d.motivo = motivos[i.k];
    return d;
  });
}

function itemHtml(i, m, esc) {
  var marcado = m.sel[i.k] === undefined ? true : !!m.sel[i.k];
  var h = '<li class="mont-item"><label><input type="checkbox" data-montmarca="' + esc(i.k) + '"' + (marcado ? ' checked' : '') + '> <span>' + (i.demarche ? '<span class="pill">' + esc(i.demarche) + '</span> ' : '') + '<b>' + esc(i.titulo) + '</b>' +
    (i.aConferir ? ' <span class="pill u-media">a conferir</span>' : '') + '<br><small class="sub">' + esc(i.demarche && i.detalhe.indexOf(i.demarche + ' · ') === 0 ? i.detalhe.slice(i.demarche.length + 3) : i.detalhe) + (i.aConferir ? ' · não vai para ela até você conferir a fonte' : '') + '</small>' +
    (i.subitens && i.subitens.length ? '<ul class="mont-sub" aria-label="Subitens">' + i.subitens.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
    (i.trecho || i.momento ? '<br><small class="sub">' + (i.momento ? 'Na conversa, ' + esc(i.momento) : 'Na conversa') + (i.trecho ? ': “' + esc(i.trecho) + '”' : '') + '</small>' : '') + '</span></label>';
  if (!marcado) {
    h += '<select data-montmotivo="' + esc(i.k) + '" aria-label="Por que não entra"><option value="">Por que não entra? (opcional)</option>' +
      MOTIVOS.map(function (mo) { return '<option value="' + mo[0] + '"' + (m.motivos[i.k] === mo[0] ? ' selected' : '') + '>' + esc(mo[1]) + '</option>'; }).join('') + '</select>';
  }
  return h + '</li>';
}

// O que ficou da conversa: o resumo, cada afirmação com quem disse, quando, o trecho e quantas vezes (duas posições aparecem as duas),
// e as promessas da equipe com o que as cumpre. É a base para você conferir a proposta contra o que foi dito.
// Uma gaveta (details): a tela era uma lista longa; agora cada grupo abre e fecha. O estado aberto vive em m.dd (o CRM o guarda entre repaints).
function gaveta(m, chave, titulo, resumo, corpo, padrao) {
  var dd = (m && m.dd) || {}, aberto = dd['mont-' + chave] === undefined ? !!padrao : !!dd['mont-' + chave];
  return '<details class="mont-gaveta" data-dd="mont-' + chave + '"' + (aberto ? ' open' : '') + '><summary><b>' + titulo + '</b>' + (resumo ? ' <span class="sub">' + resumo + '</span>' : '') + '</summary>' + corpo + '</details>';
}
function conversaHtml(p, esc, m) {
  if (!p) return '';
  var b = p.bilan || {}, afs = lista(b.afirmacoes), cs = lista(p.compromissos), h = '';
  if (b.resumo || afs.length) {
    var corpo = (b.resumo ? '<p class="sub" style="margin:0 0 6px">' + esc(b.resumo) + '</p>' : '');
    if (afs.length) corpo += '<ul class="mont-lista">' + afs.map(function (a) {
      return '<li class="mont-item"><b>' + esc(a.texto) + '</b><br><small class="sub">' + esc(a.quem === 'ingryd' ? 'Você' : a.quem === 'pessoa' ? 'Ela' : 'incerto') + (a.momento ? ' · ' + esc(a.momento) : '') + ' · ' + esc(a.certeza) +
        (a.vezes_dito > 1 ? ' · dito ' + a.vezes_dito + ' vezes' : '') + (a.trecho ? '<br>“' + esc(a.trecho) + '”' : '') + '</small></li>';
    }).join('') + '</ul>';
    h += gaveta(m, 'conversa', 'O que ficou da conversa', afs.length + (afs.length === 1 ? ' afirmação' : ' afirmações'), corpo, false);
  }
  if (cs.length) {
    var cobre = function (i) { return lista(p.encaminhamentos).concat(lista(p.documentos)).filter(function (x) { return lista(x.cobre).indexOf(i) >= 0; }).map(function (x) { return x.texto || x.rotulo; }); };
    var semItem = cs.filter(function (c, i) { return !cobre(i).length; }).length;
    h += gaveta(m, 'prometido', 'Prometido na chamada · ' + cs.length, semItem ? semItem + ' sem item' : 'tudo coberto', '<ul class="mont-lista">' + cs.map(function (c, i) {
      var q = cobre(i);
      return '<li class="mont-item"><b>' + esc(c.texto) + '</b> ' + (q.length ? '<span class="pill u-baixa">coberto</span><br><small class="sub">por: ' + q.map(esc).join('; ') + '</small>' : '<span class="pill u-media">sem item</span><br><small class="sub">vira pendência para você</small>') +
        (c.momento || c.trecho ? '<br><small class="sub">' + (c.momento ? esc(c.momento) : '') + (c.trecho ? ' “' + esc(c.trecho) + '”' : '') + '</small>' : '') + '</li>';
    }).join('') + '</ul>', semItem > 0);
  }
  return h;
}
// Comparação com o que já existe da leitura anterior: sugestão do que retirar (nada é apagado sozinho) e o que já foi tratado.
function diffHtml(d, esc) {
  if (!d) return '';
  var h = '', ret = lista(d.retirar_sugerido), conf = lista(d.conflitos), cod = function (l) { return l.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', '); };
  if (ret.length) h += '<p class="sub" style="margin:0 0 6px"><b>Saiu da proposta nova</b> (sugestão, não é apagado: retire na aba Caso se já não vale): ' + cod(ret) + '</p>';
  if (conf.length) h += '<p class="sub" style="margin:0 0 6px">Já tratados por você ou por ela (ficam como estão): ' + cod(conf) + '</p>';
  return h;
}
// O que a IA repetiu e o Worker juntou: cada coisa fica num lugar só (o passo da pessoa no checklist, os documentos em documentos).
var MOTIVO_DUP = { ja_no_checklist: 'já está no checklist', ja_em_documentos: 'já está em documentos', repetido: 'repetido' };
function duplicadosHtml(p, esc) {
  var d = lista(p && p.duplicados);
  if (!d.length) return '';
  return '<details class="mont-dup" style="margin:0 0 8px"><summary class="sub">Juntei ' + d.length + (d.length === 1 ? ' item repetido' : ' itens repetidos') + ' (cada coisa fica num lugar só)</summary><ul class="mont-sub">' +
    d.map(function (x) { return '<li>' + esc(String(x.texto || '')) + ' <span class="sub">· ' + esc(MOTIVO_DUP[x.motivo] || 'repetido') + (x.em ? ': ' + esc(String(x.em)) : '') + '</span></li>'; }).join('') + '</ul></details>';
}
function propostaHtml(m, c, esc) {
  var itens = itensDaProposta(m.prop && m.prop.proposta), marcados = decisoesDe(itens, m.sel, m.motivos).filter(function (d) { return d.decisao === 'aprovar'; }).length;
  var h = '<p class="sub" style="margin:0 0 8px">Leitura' + (m.prop && m.prop.versao ? ' (versão ' + esc(String(m.prop.versao)) + ')' : '') + '. Marque o que vale; o que você desmarcar fica de fora e o motivo ajuda a melhorar os modelos.</p>';
  h += conversaHtml(m.prop && m.prop.proposta, esc, m);
  h += duplicadosHtml(m.prop && m.prop.proposta, esc);
  var pb = (m.prop && m.prop.proposta && m.prop.proposta.bilan) || {};
  if (pb.resumo || lista(pb.email && pb.email.proximos).length) h += '<p style="margin:0 0 8px"><button class="btn" type="button" data-montdossie="' + esc(String(c.id)) + '">Atualizar Resumo e Próximos passos do Dossiê com esta leitura</button> <small class="sub">Eles já foram preenchidos se estavam vazios. Este botão sobrescreve.</small></p>';
  var afet = promessasAfetadas(m.prop && m.prop.proposta, m.sel);
  if (afet.length) h += '<p class="err" role="alert" style="margin:0 0 8px">Você desmarcou o que cumpre uma promessa da chamada: ' + afet.map(esc).join('; ') + '. Anote à mão, ou ela some do plano.</p>';
  h += diffHtml(m.diff, esc);
  var nConf = itens.filter(function (i) { return i.aConferir && (m.sel[i.k] === undefined ? true : m.sel[i.k]); }).length;
  h += '<p class="sub" style="margin:0 0 6px"><b>' + itens.length + (itens.length === 1 ? ' item' : ' itens') + '</b> em ' + GRUPOS.filter(function (g) { return itens.some(function (i) { return i.grupo === g; }); }).length + ' grupos · ' + marcados + ' marcados' + (nConf ? ' · ' + nConf + ' sem fonte oficial' : '') + '. Abra cada grupo para revisar.</p>';
  GRUPOS.forEach(function (g) {
    var lst = itens.filter(function (i) { return i.grupo === g; });
    if (!lst.length) return;
    var marc = lst.filter(function (i) { return m.sel[i.k] === undefined ? true : !!m.sel[i.k]; }).length, conf = lst.filter(function (i) { return i.aConferir; }).length;
    h += gaveta(m, g.toLowerCase().replace(/[^a-z0-9]+/g, '-'), esc(g) + ' · ' + lst.length, marc + (marc === 1 ? ' marcado' : ' marcados') + (conf ? ' · ' + conf + ' a conferir' : ''), '<ul class="mont-lista">' + lst.map(function (i) { return itemHtml(i, m, esc); }).join('') + '</ul>', false);
  });
  if (!itens.length) h += '<p class="sub">A conversa não trouxe nada para montar. Cole uma transcrição mais completa ou monte à mão na aba Caso.</p>';
  // Uma aprovação só: os itens marcados já entram no Checklist, nos Avisos e no Espaço dela (nada de segunda etapa em outra sessão).
  return h + '<div class="actions" style="margin-top:10px"><button class="btn primary" type="button" data-montaplicar="' + esc(c.id) + '"' + (m.estado === 'aplicando' ? ' disabled' : '') + '>' +
    (m.estado === 'aplicando' ? 'Levando…' : 'Levar para a Curadoria (' + marcados + ')') + '</button> <button class="btn" type="button" data-montdescartar="' + esc(c.id) + '">Descartar a proposta</button></div>' +
    '<p class="sub" style="margin:6px 0 0">Levar cria os rascunhos e abre a Curadoria, onde você aprova item por item. Nada chega a ela antes disso.</p>';
}

function resultadoHtml(m, c, esc) {
  var r = m.res || {};
  var n = function (v, um, varios) { return v + ' ' + (v === 1 ? um : varios); };
  var h = '<p class="sub" role="status" style="margin:0 0 6px"><b>Aprovado:</b> ' + n(r.criados || 0, 'criado', 'criados') + ', ' + n(r.atualizados || 0, 'atualizado', 'atualizados') + ', ' + n(r.rejeitados || 0, 'rejeitado', 'rejeitados') + '.</p>';
  var conf = lista(r.conflitos);
  if (conf.length) h += '<p class="sub" style="margin:0 0 6px">Ficaram como estavam (você já revisou ou ela já fez): ' + conf.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') + '.</p>';
  if (!m.lib) h += '<p class="sub" style="margin:0 0 6px">Falta só liberar para ela:</p><div class="actions" style="margin:0 0 6px"><button class="btn primary" type="button" data-montliberar="' + esc(c.id) + '">Liberar para ela</button></div>';
  else h += '<p class="sub" style="margin:0 0 6px">Os passos estão no <b>Checklist</b> dela (e os avisos no <b>Início</b>): é lá que você edita a escrita.</p>';
  if (m.lib) h += '<p class="sub" role="status" style="margin:0 0 6px"><b>Liberado:</b> ' + n(m.lib.liberados || 0, 'liberado', 'liberados') + '. ' +
    (m.lib.publicados_agora ? 'Os itens do espaço já estão no espaço dela.' : 'Os itens do espaço aparecem para ela quando aceitar o convite.') +
    (m.lib.a_conferir_pulados ? ' ' + m.lib.a_conferir_pulados + ' ficaram de fora por falta de fonte (abaixo).' : '') + '</p>';
  var conferir = lista(m.pub && m.pub.a_conferir_itens);
  if (conferir.length) h += '<h5 class="mont-grupo">A conferir · ' + conferir.length + '</h5><p class="sub" style="margin:0 0 6px">Não vão para ela até você conferir a fonte oficial.</p><ul class="mont-lista">' +
    conferir.map(function (x) { return '<li class="mont-item"><span><b>' + esc(x.titulo) + '</b></span> <button class="btn" type="button" data-montconferido="' + esc(String(x.id)) + '">Conferi a fonte</button></li>'; }).join('') + '</ul>';
  return h;
}

function acessoHtml(m, c, esc) {
  var p = m.pub, h = '<h5 class="mont-grupo">Acesso dela</h5>';
  if (!p) return h + '<div class="actions"><button class="btn" type="button" data-montpub="' + esc(c.id) + '">Ver a situação do acesso</button></div>';
  var comAcesso = p.conta_ja_existe && p.tem_assinatura;
  var tipo = comAcesso ? 'espaco' : 'convite';
  var semEspaco = tipo === 'convite' && !p.ha_rascunho_aprovado;
  h += '<p class="sub" style="margin:0 0 6px">' + (p.itens_prontos || 0) + (p.itens_prontos === 1 ? ' item pronto' : ' itens prontos') + ' para ela ver · ' + (p.itens_a_conferir || 0) + ' a conferir (não vão para ela) · ' + (p.itens_proposta || 0) + ' ainda só proposta.</p>';
  if (p.conta_ja_existe && !p.tem_assinatura) h += '<p class="sub" style="margin:0 0 6px">Ela tem conta, mas ainda não tem teste nem plano: o convite leva ao pagamento com ' + DIAS_TESTE + ' dias grátis (um aviso a mandaria para o bloqueio).</p>';
  if (tipo === 'espaco') h += '<p class="sub" style="margin:0 0 6px">Ela já tem conta. Se mudou algo no espaço, avise por e-mail (só sai com o seu "pode enviar").</p>';
  else h += '<p class="sub" style="margin:0 0 6px">O convite leva um link: ela aceita os termos e segue para o pagamento (cartão, ' + DIAS_TESTE + ' dias grátis; a cobrança só começa depois). O e-mail com o link para criar a senha vem do Stripe, com o e-mail que já está na ficha. O que você liberou aparece para ela quando aceitar.</p>';
  if (semEspaco) h += '<p class="err" role="alert" style="margin:0 0 6px">Ainda não há nada revisado: o espaço dela estaria vazio.</p><label class="pccheck"><input type="checkbox" data-montforcar' + (m.forcar ? ' checked' : '') + '> <span>Enviar assim mesmo</span></label>';
  h += '<div class="actions" style="margin-top:6px"><button class="btn" type="button" data-montprevia="' + tipo + '">' + (tipo === 'espaco' ? 'Ver o aviso' : 'Ver o convite') + '</button> <button class="btn" type="button" data-montpub="' + esc(c.id) + '">Atualizar</button></div>';
  if (m.previa) {
    h += '<div class="mont-previa"><p class="sub" style="margin:0">Para: <b>' + esc(m.previa.para) + '</b></p><p style="margin:2px 0"><b>' + esc(m.previa.assunto) + '</b></p><pre class="mont-texto">' + esc(m.previa.texto) + '</pre></div>';
  }
  var pode = !!(m.previa && m.pode && (!semEspaco || m.forcar));
  h += '<div class="actions" style="margin-top:6px"><label class="pccheck"><input type="checkbox" data-montpode' + (m.pode ? ' checked' : '') + (m.previa ? '' : ' disabled') + '> <span>Pode enviar</span></label> ' +
    '<button class="btn primary" type="button" data-montenviar="' + tipo + '"' + (pode ? '' : ' disabled') + '>' + (tipo === 'espaco' ? 'Enviar o aviso' : 'Enviar o convite') + '</button></div>' +
    (m.previa ? '' : '<p class="sub" style="margin:4px 0 0">Veja o e-mail antes de enviar.</p>');
  return h;
}

// m = { estado, erro, prop, sel, motivos, res, pub, previa, pode, forcar, msg, temTranscricao }
export function painelHtml(m, c, esc) {
  var h = '<section class="dbloco montagem"><h4>Montagem App</h4>';
  if (m.estado === 'lendo') return h + '<p class="sub" role="status">Lendo o onboarding… (leva alguns segundos)</p><div class="mont-skel" aria-hidden="true"><i></i><i></i><i></i></div></section>';
  if (m.estado === 'vazio' || m.estado === 'erro' || !m.estado) {
    h += '<p class="sub" style="margin:0 0 8px">A partir da conversa vinculada a esta pessoa (transcrição ou Notion), a IA propõe checklists, documentos, perguntas da equipe e contatos para ela acionar. Ela só propõe: nada chega a ela sem a sua aprovação.</p>';
    if (m.erro) h += '<p class="err" role="alert">' + esc(m.erro) + '</p>';
    var tentar = !!m.erro;
    h += '<div class="actions"><button class="btn primary" type="button" data-montler="' + esc(c.id) + '">' + (tentar ? 'Tentar de novo' : 'Propor a montagem do espaço') + '</button></div>' +
      (m.temTranscricao ? '<p class="sub" style="margin:6px 0 0">Vai ler: ' + esc(m.fonte || 'a conversa vinculada') + '.</p>' : '<p class="sub" style="margin:6px 0 0">Vincule uma conversa para liberar: leia o link do Notion em “Análise 1:1” ou cole a transcrição em “Editar o registro”, dentro de “Análise 1:1”.</p>');
  } else if (m.estado === 'proposta' || m.estado === 'aplicando') h += propostaHtml(m, c, esc);
  else if (m.estado === 'aplicado' && m.res) h += resultadoHtml(m, c, esc);
  if (m.erro && (m.estado === 'proposta' || m.estado === 'aplicando' || m.estado === 'aplicado')) h += '<p class="err" role="alert">' + esc(m.erro) + '</p>';
  if (m.estado !== 'proposta' && m.estado !== 'aplicando') h += acessoHtml(m, c, esc);
  if (m.msg) h += '<p class="sub" role="status" style="margin:8px 0 0"><b>' + esc(m.msg) + '</b></p>';
  return h + '</section>';
}

// ---------- Os passos propostos, na sessão Checklist da Plataforma ----------
// Cada passo que a montagem criou para ela, com o mesmo detalhe do Checklist: démarche, subitens, de onde vem (da persona ou só deste percurso),
// prazo e lista. aco = linhas de caso_acoes; listas = linhas de caso_listas. h = { esc, rotulo(chaveDemarche), prazo(acao), pil(txt, cls), btn(acao, id, rot), conferi(id), linha(esq, meio, btns) }.
// modo 'fila': só o que ainda espera a sua decisão (rascunho ou a conferir) — publicar ou recusar tira o card daqui.
// modo 'publicados': o que já virou passo dela (publicado ou concluído), para ficar junto dos passos do checklist; os recusados não aparecem em lugar nenhum. Sem modo: todos (menos os recusados).
export function passosPropostosHtml(aco, listas, h, modo) {
  var e = h.esc, tit = {};
  lista(listas).forEach(function (l) { tit[l.chave] = l.titulo; });
  var noModo = function (a) { return modo === 'publicados' ? !!(a.publicada_em || a.estado === 'concluida') : modo === 'fila' ? !a.publicada_em && a.estado !== 'concluida' : true; };
  var passos = lista(aco).filter(function (a) { return a.dono === 'ela' && a.canal === 'plataforma' && /^(enc|chk):/.test(a.origem_chave || '') && a.estado !== 'recusada' && noModo(a); });
  if (!passos.length) return '';
  return passos.map(function (a) {
    if (h.editor && h.editando && h.editando(a)) return h.editor(a);
    var subs = lista(a.subitens), fim = a.estado === 'concluida';
    var est = fim ? h.pil('Concluído', 'u-baixa') : a.publicada_em ? h.pil('Publicado', 'u-baixa') : a.a_conferir ? h.pil('A conferir', 'u-media') : h.pil('Rascunho', 'u-media');
    var meta = [a.demarche ? h.rotulo(a.demarche) : 'Sem démarche', subs.length ? subs.length + (subs.length === 1 ? ' subitem' : ' subitens') : '', a.camada === 'persona' ? 'da persona' : 'só deste percurso',
      h.prazo(a), a.lista_chave && tit[a.lista_chave] ? 'lista "' + tit[a.lista_chave] + '"' : ''].filter(Boolean).join(' · ');
    var dica = ' data-dbl="ed-aco" data-id="' + e(String(a.id)) + '" tabindex="0" title="Dois cliques (ou Enter) para editar" class="fx-edita"';
    var corpo = (fim ? '<s>' + e(a.titulo) + '</s>' : '<b' + dica + '>' + e(a.titulo) + '</b>') + '<br><span class="sub">' + e(meta) + '</span>' +
      (subs.length ? '<ul class="mont-sub" aria-label="Subitens">' + subs.map(function (x) { return '<li>' + e(String(x)) + '</li>'; }).join('') + '</ul>' : '') +
      (a.a_conferir && !a.publicada_em ? '<br><small class="sub">Falta conferir a fonte: confira e clique em "Conferi a fonte" para poder publicar.</small>' : '') + (a.editado_em ? '<br><small class="sub">Texto editado por você: a releitura não muda.</small>' : '');
    // Uma ação por linha, sempre: conferir a fonte → publicar para ela → retirar. (Concluído não tem botão.)
    // Minimalista: editar = dois cliques no texto; retirar (publicado) e recusar (rascunho) = ×. O que decide (conferir / publicar) continua em palavras.
    var x = function (acao, rot) { return h.ico ? h.ico(acao, a.id, '×', rot) : h.btn(acao, a.id, rot); };
    var btns = (fim ? '' : a.publicada_em ? (h.semRetirar ? '' : x('aco-retirar', 'Retirar da página dela')) : (a.a_conferir ? h.conferi(a.id) : h.btn('aco-pub', a.id, 'Publicar para ela')) + x('aco-recusar', 'Recusar este passo'));
    if (h.linhaPasso) {   // o mesmo desenho de linha do Checklist: ponto de estado, título, etiquetas e ícones
      var chips = [{ t: a.camada === 'persona' ? 'Da persona' : 'Só dela', c: 'del' }, { t: a.demarche ? h.rotulo(a.demarche) : 'Sem démarche', c: 'dem' }];
      var pz = h.prazo(a); if (pz) chips.push({ t: pz, c: 'due' });
      var alerta = a.a_conferir && !a.publicada_em ? 'Falta conferir a fonte para poder publicar.' : (h.alerta ? h.alerta(a) : '');
      return h.linhaPasso({ estado: fim || a.publicada_em ? 'ok' : 'mid', rot: fim ? 'Concluído' : a.publicada_em ? 'Publicado' : a.a_conferir ? 'A conferir' : 'Rascunho', cls: fim ? 'feito' : '',
        titulo: e(a.titulo), nota: fim ? 'concluído' + (a.concluida_por === 'ela' ? ' por ela' : '') : a.publicada_em ? 'publicado' : 'rascunho', chips: chips, alerta: alerta, ed: fim ? '' : 'ed-aco', id: a.id, extra: btns + (h.extraLinha ? h.extraLinha(a) : ''),
        sub: subs.length ? '<details class="fx-subs"><summary>' + subs.length + (subs.length === 1 ? ' subitem' : ' subitens') + '</summary><ul aria-label="Subitens">' + subs.map(function (x) { return '<li>' + e(String(x)) + '</li>'; }).join('') + '</ul></details>' : '' });
    }
    return h.linha(est, corpo, btns);
  }).join('');
}
