// Tela "Montagem do espaço" da aba Dossiê (lógica e HTML puros; o crm.js liga os botões ao Worker e ao banco).
// Fluxo: transcript colado no Dossiê → "Propor a montagem" (IA, só propõe) → você marca o que vale → "Criar rascunhos" (nada chega a ela)
// → situação do acesso → convite (pessoa sem conta) ou aviso de espaço atualizado (pessoa com conta), sempre com o seu "pode enviar".
// As chaves dos itens (enc:, lista:, chk:, doc:, perg:, bloco:) são as mesmas de crm_montagem_aplicar (db/crm-montagem-aplicar.sql).

export var MOTIVOS = [['fato_errado', 'Fato extraído errado'], ['regra_inadequada', 'Regra do percurso inadequada'], ['prazo_desatualizado', 'Prazo desatualizado'], ['excecao', 'Exceção desta pessoa']];
export var GRUPOS = ['Gerais da persona', 'Particulares do percurso', 'Entregas da equipe', 'Prometido na chamada e ainda sem item', 'Checklists', 'Documentos para reunir', 'Perguntas da equipe', 'Contatos para acionar'];
var GRUPO_CAMADA = { persona: 'Gerais da persona', particular: 'Particulares do percurso', entrega_equipe: 'Entregas da equipe' };
var DIAS_TESTE = 7;

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
      saida.push({ k: 'chk:' + c.chave + ':' + i.chave, grupo: 'Checklists', titulo: String(i.titulo || ''), detalhe: 'Em "' + String(c.titulo || '') + '" · ' + (i.fonte ? 'Fonte: ' + i.fonte.rotulo + (i.nivel ? ' (' + i.nivel + ')' : ' (sem nível)') + ' · ' + i.fonte.url : 'Sem fonte'), momento: '', trecho: '', certeza: 'inferido', aConferir: i.a_conferir !== false });
    });
  });
  lista(p.documentos).forEach(function (d) {
    saida.push({ k: 'doc:' + d.chave, grupo: 'Documentos para reunir', titulo: String(d.rotulo || ''), detalhe: lista(d.selos).length ? 'Exige: ' + d.selos.join(', ') : 'Sem selo', momento: '', trecho: '', certeza: 'inferido', aConferir: false });
  });
  lista(p.perguntas_equipe).forEach(function (q) {
    saida.push({ k: 'perg:' + q.chave, grupo: 'Perguntas da equipe', titulo: String(q.texto || ''), detalhe: 'Resposta em ' + (q.resposta_tipo === 'data' ? 'data' : 'opções') + ' · grava em ' + q.grava_em, momento: '', trecho: '', certeza: 'inferido', aConferir: false });
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
  var h = '<li class="mont-item"><label><input type="checkbox" data-montmarca="' + esc(i.k) + '"' + (marcado ? ' checked' : '') + '> <span><b>' + esc(i.titulo) + '</b>' +
    (i.aConferir ? ' <span class="pill u-media">a conferir</span>' : '') + '<br><small class="sub">' + esc(i.detalhe) + (i.aConferir ? ' · não vai para ela até você conferir a fonte' : '') + '</small>' +
    (i.trecho || i.momento ? '<br><small class="sub">' + (i.momento ? 'Na conversa, ' + esc(i.momento) : 'Na conversa') + (i.trecho ? ': “' + esc(i.trecho) + '”' : '') + '</small>' : '') + '</span></label>';
  if (!marcado) {
    h += '<select data-montmotivo="' + esc(i.k) + '" aria-label="Por que não entra"><option value="">Por que não entra? (opcional)</option>' +
      MOTIVOS.map(function (mo) { return '<option value="' + mo[0] + '"' + (m.motivos[i.k] === mo[0] ? ' selected' : '') + '>' + esc(mo[1]) + '</option>'; }).join('') + '</select>';
  }
  return h + '</li>';
}

// O que ficou da conversa: o resumo, cada afirmação com quem disse, quando, o trecho e quantas vezes (duas posições aparecem as duas),
// e as promessas da equipe com o que as cumpre. É a base para você conferir a proposta contra o que foi dito.
function conversaHtml(p, esc) {
  if (!p) return '';
  var b = p.bilan || {}, afs = lista(b.afirmacoes), cs = lista(p.compromissos), h = '';
  if (b.resumo || afs.length) {
    h += '<h5 class="mont-grupo">O que ficou da conversa</h5>' + (b.resumo ? '<p class="sub" style="margin:0 0 6px">' + esc(b.resumo) + '</p>' : '');
    if (afs.length) h += '<ul class="mont-lista">' + afs.map(function (a) {
      return '<li class="mont-item"><b>' + esc(a.texto) + '</b><br><small class="sub">' + esc(a.quem === 'ingryd' ? 'Você' : a.quem === 'pessoa' ? 'Ela' : 'incerto') + (a.momento ? ' · ' + esc(a.momento) : '') + ' · ' + esc(a.certeza) +
        (a.vezes_dito > 1 ? ' · dito ' + a.vezes_dito + ' vezes' : '') + (a.trecho ? '<br>“' + esc(a.trecho) + '”' : '') + '</small></li>';
    }).join('') + '</ul>';
  }
  if (cs.length) {
    var cobre = function (i) { return lista(p.encaminhamentos).concat(lista(p.documentos)).filter(function (x) { return lista(x.cobre).indexOf(i) >= 0; }).map(function (x) { return x.texto || x.rotulo; }); };
    h += '<h5 class="mont-grupo">Prometido na chamada · ' + cs.length + '</h5><ul class="mont-lista">' + cs.map(function (c, i) {
      var q = cobre(i);
      return '<li class="mont-item"><b>' + esc(c.texto) + '</b> ' + (q.length ? '<span class="pill u-baixa">coberto</span><br><small class="sub">por: ' + q.map(esc).join('; ') + '</small>' : '<span class="pill u-media">sem item</span><br><small class="sub">vira pendência para você</small>') +
        (c.momento || c.trecho ? '<br><small class="sub">' + (c.momento ? esc(c.momento) : '') + (c.trecho ? ' “' + esc(c.trecho) + '”' : '') + '</small>' : '') + '</li>';
    }).join('') + '</ul>';
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
function propostaHtml(m, c, esc) {
  var itens = itensDaProposta(m.prop && m.prop.proposta), marcados = decisoesDe(itens, m.sel, m.motivos).filter(function (d) { return d.decisao === 'aprovar'; }).length;
  var h = '<p class="sub" style="margin:0 0 8px">Leitura' + (m.prop && m.prop.versao ? ' (versão ' + esc(String(m.prop.versao)) + ')' : '') + '. Marque o que vale; o que você desmarcar fica de fora e o motivo ajuda a melhorar os modelos.</p>';
  h += conversaHtml(m.prop && m.prop.proposta, esc);
  var afet = promessasAfetadas(m.prop && m.prop.proposta, m.sel);
  if (afet.length) h += '<p class="err" role="alert" style="margin:0 0 8px">Você desmarcou o que cumpre uma promessa da chamada: ' + afet.map(esc).join('; ') + '. Anote à mão, ou ela some do plano.</p>';
  h += diffHtml(m.diff, esc);
  GRUPOS.forEach(function (g) {
    var lst = itens.filter(function (i) { return i.grupo === g; });
    if (lst.length) h += '<h5 class="mont-grupo">' + esc(g) + ' · ' + lst.length + '</h5><ul class="mont-lista">' + lst.map(function (i) { return itemHtml(i, m, esc); }).join('') + '</ul>';
  });
  if (!itens.length) h += '<p class="sub">A conversa não trouxe nada para montar. Cole uma transcrição mais completa ou monte à mão na aba Caso.</p>';
  return h + '<div class="actions" style="margin-top:10px"><button class="btn primary" type="button" data-montaplicar="' + esc(c.id) + '"' + (m.estado === 'aplicando' ? ' disabled' : '') + '>' +
    (m.estado === 'aplicando' ? 'Criando os rascunhos…' : 'Criar rascunhos dos itens marcados (' + marcados + ')') + '</button> <button class="btn" type="button" data-montdescartar="' + esc(c.id) + '">Descartar a proposta</button></div>' +
    '<p class="sub" style="margin:6px 0 0">Nada chega a ela agora: viram rascunhos na aba Caso, onde você revisa e publica.</p>';
}

function resultadoHtml(m, c, esc) {
  var r = m.res || {};
  var n = function (v, um, varios) { return v + ' ' + (v === 1 ? um : varios); };
  var h = '<p class="sub" role="status" style="margin:0 0 6px"><b>Rascunhos criados:</b> ' + n(r.criados || 0, 'criado', 'criados') + ', ' + n(r.atualizados || 0, 'atualizado', 'atualizados') + ', ' + n(r.rejeitados || 0, 'rejeitado', 'rejeitados') + '.</p>';
  var conf = lista(r.conflitos);
  if (conf.length) h += '<p class="sub" style="margin:0 0 6px">Ficaram como estavam (você já revisou ou ela já fez): ' + conf.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ') + '.</p>';
  h += '<p class="sub" style="margin:0 0 6px">Revise os rascunhos na aba <b>Caso</b> se quiser mexer em algo. Quando estiver certo, libere:</p>' +
    '<div class="actions" style="margin:0 0 6px"><button class="btn primary" type="button" data-montliberar="' + esc(c.id) + '">Liberar para ela</button></div>';
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
  if (p.conta_ja_existe && !p.tem_assinatura) h += '<p class="sub" style="margin:0 0 6px">Ela tem conta, mas ainda não tem teste nem plano: o convite abre o teste de ' + DIAS_TESTE + ' dias (um aviso a mandaria para o bloqueio).</p>';
  if (tipo === 'espaco') h += '<p class="sub" style="margin:0 0 6px">Ela já tem conta. Se mudou algo no espaço, avise por e-mail (só sai com o seu "pode enviar").</p>';
  else h += '<p class="sub" style="margin:0 0 6px">O convite leva um link: ela aceita os termos, cria a senha com o e-mail que já está na ficha e ganha ' + DIAS_TESTE + ' dias de teste. O que você já revisou aparece para ela quando aceitar.</p>';
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
  var h = '<section class="dbloco montagem"><h4>Montagem do espaço</h4>';
  if (m.estado === 'lendo') return h + '<p class="sub" role="status">Lendo o onboarding… (leva alguns segundos)</p><div class="mont-skel" aria-hidden="true"><i></i><i></i><i></i></div></section>';
  if (m.estado === 'vazio' || m.estado === 'erro' || !m.estado) {
    h += '<p class="sub" style="margin:0 0 8px">A partir do transcript colado em <b>A ligação</b>, a IA propõe checklists, documentos, perguntas da equipe e contatos para ela acionar. Ela só propõe: nada chega a ela sem a sua aprovação.</p>';
    if (m.erro) h += '<p class="err" role="alert">' + esc(m.erro) + '</p>';
    var tentar = !!m.erro;
    h += '<div class="actions"><button class="btn primary" type="button" data-montler="' + esc(c.id) + '"' + (m.temTranscricao ? '' : ' disabled') + '>' + (tentar ? 'Tentar de novo' : 'Propor a montagem do espaço') + '</button></div>' +
      (m.temTranscricao ? '' : '<p class="sub" style="margin:6px 0 0">Cole a transcrição em “Gravação transcrita” (pelo menos algumas frases) para liberar.</p>');
  } else if (m.estado === 'proposta' || m.estado === 'aplicando') h += propostaHtml(m, c, esc);
  else if (m.estado === 'aplicado' && m.res) h += resultadoHtml(m, c, esc);
  if (m.erro && (m.estado === 'proposta' || m.estado === 'aplicando' || m.estado === 'aplicado')) h += '<p class="err" role="alert">' + esc(m.erro) + '</p>';
  if (m.estado !== 'proposta' && m.estado !== 'aplicando') h += acessoHtml(m, c, esc);
  if (m.msg) h += '<p class="sub" role="status" style="margin:8px 0 0"><b>' + esc(m.msg) + '</b></p>';
  return h + '</section>';
}
