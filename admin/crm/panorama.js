// Panorama dela e "O que ela trouxe": o que a pessoa acrescenta de público ao app (títulos que mudou, observações, datas, links,
// passos próprios, passos arquivados, escolas), lido dos dados reais. Lógica pura e HTML puro: sem DOM e sem Supabase.
// Porte da subsessão "Panorama dela" da Ficha-universo. O que no protótipo era exemplo (o grupo da persona) aqui vem do banco,
// e sem amostra suficiente (menos de 3 pessoas) a comparação diz "poucos dados" em vez de inventar número.
//
// Entrada (d): { nome, personaCurto, itens: ChkItem[], escolas: [{ nome, link, nota, criterios, criado_em }], coorte: Coorte|null }
//   ChkItem = linha de checklist_items: { step_key, category, label, status, titulo_custom, nota_custom, links_custom, quando_custom, updated_at }
//   Coorte  = resultado de montaCoorte(): { n, kw: [[palavra, pessoas]], pad: { arq, ren, data, prop } }

const PRIV = ['drive.google.com', 'docs.google.com', 'dropbox.com', 'onedrive.live.com', '1drv.ms', 'icloud.com', 'wetransfer.com', 'we.tl', 'mega.nz'];
export const hostDe = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
export const privado = (u) => { const h = hostDe(u); return PRIV.some((d) => h === d || h.endsWith('.' + d)); };
// Tira e-mail, IBAN e números longos antes de mostrar qualquer texto dela. r = houve trecho ocultado.
export function limpa(s) {
  let r = false;
  const t = String(s == null ? '' : s).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => { r = true; return '[e-mail]'; })
    .replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,} ?[A-Z0-9]{0,4}\b/g, () => { r = true; return '[número]'; })
    .replace(/\d[\d .-]{6,}\d/g, () => { r = true; return '[número]'; });
  return { t, r };
}
// 'AAAA-MM-DD' ou 'AAAA-MM-DDTHH:MM' → 'DD/MM' ou 'DD/MM às HH:MM'
export const rotQ = (q) => (q ? q.slice(8, 10) + '/' + q.slice(5, 7) + (q.length > 10 ? ' às ' + q.slice(11, 16) : '') : '');
export const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set('para com que dos das uma por mais como seu sua nos nas ele ela dele dela esse essa isso este esta isto ainda sobre entre antes depois quando onde porque também tudo todo toda muito pouco vamos preciso precisa fazer ter tem pedir levar falar ligar numero mail'.split(' '));
export function palavrasDe(txt) {
  return String(txt || '').toLowerCase().split(/[^\p{L}\p{N}€]+/u).map((o) => ({ o, w: semAcento(o) })).filter((x) => x.w.length >= 4 && !STOP.has(x.w));
}
const THEMES = {
  Escola: ['escola', 'cief', 'alliance', 'curso', 'faculdade', 'universit', 'inscri', 'matricula', 'campus'],
  Dinheiro: ['parcel', 'valor', 'custo', 'extrato', 'rib', 'taxa', 'pagar', 'recurso', 'sponsor', '€'],
  Documentos: ['atesta', 'tradu', 'historico', 'diploma', 'certificado', 'passaporte', 'documento', 'dossie'],
  Visto: ['visto', 'consul', 'anef', 'prefeit', 'titre'],
  Idioma: ['nivel', 'frances', 'delf', 'tcf', 'a2', 'b1', 'b2'],
  Prazos: [],
  // Só vêm da conversa (a IA classifica); sem palavra-chave, para não mudar o que o app já mostra.
  Moradia: [], Trabalho: [], 'Família': [], 'Saúde': []
};
// Panorama vivo: o retrato de como ela está, lido das conversas (montagens.proposta.panorama). Vocabulários fechados, iguais aos do Worker.
const TERMO = { angustia: 'Angústia', duvida: 'Dúvida', urgencia: 'Urgência', confianca: 'Confiança', autonomia: 'Autonomia', app: 'Uso do app' };
const NIVEL = ['nenhuma', 'leve', 'moderada', 'alta', 'muito alta'];
const NIVEL_APP = ['nenhum', 'pouco', 'médio', 'bom', 'intenso'];
export const MANEIRAS = { prefere_ligar: 'Prefere ligar', prefere_escrever: 'Prefere escrever', quer_passo_a_passo: 'Quer passo a passo', quer_visao_geral: 'Quer a visão geral primeiro',
  decide_rapido: 'Decide rápido', decide_devagar: 'Decide devagar', pesquisa_sozinha: 'Pesquisa sozinha', precisa_de_validacao: 'Precisa de validação', adia_burocracia: 'Adia a burocracia', tem_rede_de_apoio: 'Tem rede de apoio' };
const origemConv = (v, m) => 'conversa ' + v + (m ? ' · ' + m : '');
// Só entram conversas com panorama no formato certo (propostas antigas, sem panorama, ficam de fora). Da mais antiga para a mais recente.
const conversasValidas = (d) => (d.conversas || []).filter((x) => x && x.p && typeof x.p === 'object' && Array.isArray(x.p.termometros)).slice().sort((a, b) => a.versao - b.versao);
const juntar = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]);
const conta = (crit) => { let sim = 0, nao = 0; Object.keys(crit || {}).forEach((k) => { if (crit[k] === 'sim') sim++; else if (crit[k] === 'nao') nao++; }); return { sim, nao }; };

// Os itens do checklist no formato que o Panorama lê. Passo "meu:" = criado por ela; status arquivado = ela arquivou.
export function normaliza(itens) {
  return (itens || []).map((i) => {
    const links = Array.isArray(i.links_custom) ? i.links_custom.filter((l) => l && l.url) : [];
    const propria = String(i.category || '').indexOf('meu:') === 0;
    return { k: i.step_key, orig: i.label || '', label: i.titulo_custom || i.label || '', nota: i.nota_custom || '', links, quando: i.quando_custom || '', arq: i.status === 'arquivado',
      propria, ts: i.updated_at || '', editado: !!(i.titulo_custom || i.nota_custom || links.length || i.quando_custom) };
  });
}

export function panorama(d) {
  const L = normaliza(d.itens), escolasD = d.escolas || [];
  const cv = conversasValidas(d), ult = cv.length ? cv[cv.length - 1] : null, ant = cv.length > 1 ? cv[cv.length - 2] : null, pc = ult ? ult.p : null;
  const ed = L.filter((x) => x.editado), prop = L.filter((x) => x.propria), arq = L.filter((x) => x.arq);
  let priv = 0, red = 0; const textos = [];
  const push = (s, f) => { const o = limpa(s); if (o.r) red++; if (o.t) textos.push({ t: o.t, f }); };
  ed.forEach((x) => { if (x.label !== x.orig && !x.propria) push(x.label, 'título'); push(x.nota, 'observação'); });
  prop.forEach((x) => push(x.label, 'passo próprio'));
  escolasD.forEach((e) => { push(e.nome, 'escola'); push(e.nota, 'observação da escola'); });
  const fontes = [];
  ed.forEach((x) => x.links.forEach((l) => { if (privado(l.url)) priv++; else fontes.push({ label: limpa(l.label).t, host: hostDe(l.url), passo: x.orig }); }));
  escolasD.forEach((e) => { if (e.link) { if (privado(e.link)) priv++; else fontes.push({ label: e.nome, host: hostDe(e.link), passo: 'escola' }); } });
  const escolas = escolasD.map((e) => ({ nome: e.nome, host: e.link && !privado(e.link) ? hostDe(e.link) : '', conf: conta(e.criterios) }));
  const datas = ed.filter((x) => x.quando).map((x) => ({ passo: x.orig, q: x.quando }));
  const notas = ed.filter((x) => x.nota).map((x) => ({ passo: x.orig, txt: limpa(x.nota).t, r: limpa(x.nota).r }));
  const renom = ed.filter((x) => x.label !== x.orig && !x.propria).map((x) => ({ de: x.orig, para: limpa(x.label).t }));
  const sc = {}, ev = {};
  Object.keys(THEMES).forEach((k) => { sc[k] = 0; ev[k] = []; });
  textos.forEach((o) => { const n = semAcento(o.t); Object.keys(THEMES).forEach((k) => { const ws = THEMES[k]; if (ws.some((w) => n.indexOf(w) >= 0)) { sc[k] += ws.filter((w) => n.indexOf(w) >= 0).length; ev[k].push({ t: o.t, f: o.f }); } }); });
  datas.forEach((x) => ev.Prazos.push({ t: x.passo + ' · ' + rotQ(x.q), f: 'data escolhida' }));
  escolas.forEach((e) => ev.Escola.push({ t: e.nome + (e.host ? ' · ' + e.host : ''), f: 'escola adicionada' }));
  sc.Prazos += datas.length * 2; sc.Escola += escolas.length * 2;
  if (pc) (pc.temas || []).forEach((t) => { if (sc[t.tema] === undefined) { sc[t.tema] = 0; ev[t.tema] = []; } sc[t.tema] += (t.peso || 1) * 2; ev[t.tema].push({ t: limpa(t.nota).t || 'Assunto da conversa ' + ult.versao, f: origemConv(ult.versao, t.momento) }); });
  const temas = Object.keys(sc).map((k) => [k, sc[k]]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]), max = temas.length ? temas[0][1] : 1;
  const cnt = {}; textos.forEach((o) => palavrasDe(o.t).forEach((x) => { cnt[x.w] = cnt[x.w] || { n: 0, o: x.o }; cnt[x.w].n++; }));
  if (pc) (pc.palavras || []).forEach((x) => { const w = semAcento(x.palavra); cnt[w] = { n: (cnt[w] ? cnt[w].n : 0) + (x.vezes || 1), o: cnt[w] ? cnt[w].o : x.palavra }; });
  const chips = Object.keys(cnt).map((w) => ({ w, o: cnt[w].o, n: cnt[w].n })).sort((a, b) => b.n - a.n || a.w.localeCompare(b.w)).slice(0, 10);
  const distintos = new Set(); ed.concat(prop, arq).forEach((x) => distintos.add(x.k));
  const nApp = distintos.size + escolasD.length;
  const n = nApp + (pc ? (pc.temas || []).length + (pc.acoes || []).length + (pc.maneiras || []).length + (pc.hipoteses || []).length : 0);
  const ritmo = [datas.length ? 'define as próprias datas' : '', ed.length >= 2 ? 'personaliza o checklist' : '', prop.length ? 'cria os próprios passos' : '', arq.length ? 'arquiva o que não serve' : ''].filter(Boolean);
  const rt = juntar(ritmo);
  let leitura = n === 0 ? 'Ainda sem sinais: ela não editou, criou nem arquivou nada no app.' : (temas.length ? 'Foco em ' + juntar(temas.slice(0, 2).map((x) => x[0])) + '. ' : '') + (rt ? rt.charAt(0).toUpperCase() + rt.slice(1) + '.' : '');
  if (pc) leitura = (limpa(pc.leitura).t || 'Conversa lida, sem leitura resumida.') + (nApp > 0 && rt ? ' No app: ' + rt + '.' : '');
  const nm = String(d.nome || '').trim().split(/\s+/)[0] || 'tudo bem', imp = [];
  if (sc.Dinheiro >= 2) imp.push({ id: 'i-din', t: 'Falar de parcelamento e custo', ev: 'Dinheiro é um dos temas dela: ' + sc.Dinheiro + ' menções', msg: 'Oi, ' + nm + '! Vi que o valor e o parcelamento estão no seu radar. Posso te mandar as escolas que parcelam?' });
  if (datas.length) imp.push({ id: 'i-data', t: 'Reforçar o dia ' + rotQ(datas[0].q), ev: 'Ela escolheu essa data em “' + datas[0].passo + '”', msg: 'Oi, ' + nm + '! Vi que você marcou ' + rotQ(datas[0].q) + ' para "' + datas[0].passo + '". Quer que eu te lembre na véspera?' });
  escolas.forEach((e) => { if (e.conf.sim + e.conf.nao === 0) imp.push({ id: 'i-esc-' + semAcento(e.nome).replace(/[^a-z0-9]+/g, '-').slice(0, 24), t: 'Ajudar a completar os critérios de ' + e.nome, ev: 'Ela ainda não respondeu nenhum critério', msg: 'Oi, ' + nm + '! Vi que você adicionou ' + e.nome + '. Quer ajuda para confirmar o que falta (como nível e parcelamento)?' }); });
  if (arq.length) imp.push({ id: 'i-arq', t: 'Entender por que arquivou “' + arq[0].orig + '”', ev: 'Passo da persona arquivado', msg: 'Oi, ' + nm + '! Vi que você arquivou "' + arq[0].orig + '". Esse passo não fazia sentido para o seu caso? Me conta que eu ajusto.' });
  if (prop.length) imp.push({ id: 'i-prop', t: 'Apoiar o passo próprio “' + prop[0].label + '”', ev: 'Ela criou um passo que o modelo não tem', msg: 'Oi, ' + nm + '! Gostei do passo "' + prop[0].label + '" que você criou. Se precisar de ajuda com ele, me conta.' });
  let conv = null;
  if (pc) {
    const termo = (pc.termometros || []).map((t) => { const o = ant ? (ant.p.termometros || []).filter((x) => x.chave === t.chave)[0] : null;
      return { chave: t.chave, rotulo: TERMO[t.chave] || t.chave, nivel: t.nivel, nivelRot: NIVEL[t.nivel] || '', porque: limpa(t.porque).t, momento: t.momento || '', v: ult.versao, antes: o ? o.nivel : null,
        tend: o ? (t.nivel < o.nivel ? 'caiu' : t.nivel > o.nivel ? 'subiu' : 'igual') : null }; });
    const un = nApp === 0 ? 0 : nApp < 3 ? 1 : nApp < 6 ? 2 : nApp < 10 ? 3 : 4;
    termo.push({ chave: 'app', rotulo: TERMO.app, nivel: un, nivelRot: NIVEL_APP[un], porque: nApp === 0 ? 'Ainda não mexeu em nada no app' : nApp + (nApp === 1 ? ' sinal' : ' sinais') + ' no app', momento: '', v: 0, antes: null, tend: null, calc: true });
    conv = { n: cv.length, ult: ult.versao, quando: ult.quando || '', termo,
      acoes: (pc.acoes || []).map((x) => ({ texto: limpa(x.texto).t, dono: x.dono, momento: x.momento || '', v: ult.versao })),
      maneiras: (pc.maneiras || []).map((x) => ({ chave: x.chave, rotulo: MANEIRAS[x.chave] || x.chave, momento: x.momento || '', v: ult.versao })),
      hip: (pc.hipoteses || []).map((x) => ({ id: 'h-' + semAcento(x.texto).replace(/[^a-z0-9]+/g, '-').slice(0, 30), texto: limpa(x.texto).t, evidencia: limpa(x.evidencia).t, confirmar: limpa(x.confirmar).t, momento: x.momento || '', v: ult.versao })) };
    const impC = [], alto = (k) => termo.filter((t) => t.chave === k && t.nivel >= 3)[0];
    const ang = alto('angustia'), duv = alto('duvida'), prom = conv.acoes.filter((x) => x.dono === 'ingryd')[0];
    if (ang) impC.push({ id: 'i-ang', t: 'Acolher antes de listar tarefas', ev: 'Angústia ' + ang.nivelRot + ' (' + origemConv(ult.versao, ang.momento) + ')', msg: 'Oi, ' + nm + '! Quero te lembrar que não precisa resolver tudo de uma vez. Qual é o próximo passo que mais pesa para você agora?' });
    if (duv) impC.push({ id: 'i-duv', t: 'Tirar a dúvida que mais trava', ev: 'Dúvida ' + duv.nivelRot + ' (' + origemConv(ult.versao, duv.momento) + ')', msg: 'Oi, ' + nm + '! Qual é a dúvida que mais está te travando agora? Me conta que a gente resolve junto.' });
    if (prom) impC.push({ id: 'i-prom', t: 'Cumprir o que ficou combinado: ' + prom.texto, ev: 'Promessa da equipe (' + origemConv(ult.versao, prom.momento) + ')', msg: 'Oi, ' + nm + '! Sobre o que combinamos (' + prom.texto + '): te aviso assim que estiver pronto.' });
    imp.unshift(...impC);
  }
  const co = d.coorte && d.coorte.n >= 3 ? d.coorte : null, palavras = new Set(chips.map((c) => c.w));
  const comum = co ? co.kw.filter((k) => palavras.has(semAcento(k[0]))) : [];
  return { ev, n, leitura, temas, max, chips, conv, escolas, fontes, datas, notas, renom, prop, arq, imp: imp.slice(0, 3), priv, red, co, comum, coorteN: d.coorte ? d.coorte.n : 0 };
}

// Sugestões para o sistema (o modelo da persona), com a evidência do grupo quando há amostra (3 pessoas ou mais).
export function sugestoes(a) {
  const co = a.co, out = [], tem = (w) => a.chips.filter((c) => c.w.indexOf(w) >= 0)[0];
  const grupo = (k, frase) => (co && k >= 2 ? '; ' + k + ' de ' + co.n + ' pessoas do grupo ' + frase : (co ? '' : '; grupo pequeno demais para comparar'));
  if (tem('parcel')) {
    const k = co ? (co.kw.filter((x) => semAcento(x[0]).indexOf('parcel') >= 0)[0] || [0, 0])[1] : 0;
    out.push({ id: 's-parcel', t: 'Aviso de inteligência: “Pergunte sobre parcelamento antes de pagar a matrícula”', ev: 'Ela anotou “parcelamento”' + (co && k >= 2 ? ' e ' + k + ' de ' + co.n + ' pessoas do grupo também' : (co ? '' : ' (grupo pequeno demais para comparar)')),
      tipo: 'aviso', aviso: { tipo: 'inteligencia', tit: 'Pergunte sobre parcelamento antes de pagar a matrícula', txt: 'Muitas escolas aceitam pagar em parcelas. Vale perguntar antes de fechar.' } });
  }
  if (a.arq.length || (co && co.pad.arq >= 2)) out.push({ id: 's-arq', t: 'Revisar o modelo: passo arquivado por várias pessoas', tipo: 'modelo',
    ev: (a.arq.length ? 'Ela arquivou “' + a.arq[0].orig + '”' : 'Nenhum passo arquivado por ela') + grupo(co ? co.pad.arq : 0, 'arquivaram algum passo') });
  if (a.prop.length || (co && co.pad.prop >= 2)) out.push({ id: 's-add', t: 'Incluir no modelo da persona um passo que as pessoas adicionam sozinhas', tipo: 'modelo',
    ev: (a.prop.length ? 'Ela criou “' + a.prop[0].label + '”' : 'Ela não criou passo próprio') + grupo(co ? co.pad.prop : 0, 'criaram passo próprio') });
  if (a.datas.length) out.push({ id: 's-data', t: 'Lembrete automático na data que a pessoa escolhe para o passo', tipo: 'modelo',
    ev: 'Ela definiu ' + a.datas.length + (a.datas.length === 1 ? ' data' : ' datas') + grupo(co ? co.pad.data : 0, 'também escolhem datas') });
  return out;
}

// O grupo: as pessoas da mesma persona que já têm conta. linhas = checklist_items delas (só o que foi mexido); usuarios = ids com conta.
export function montaCoorte(linhas, usuarios) {
  const ids = {}; (usuarios || []).forEach((u) => { ids[u] = { arq: 0, ren: 0, data: 0, prop: 0, w: {} }; });
  (linhas || []).forEach((r) => {
    const u = ids[r.user_id]; if (!u) return;
    if (r.status === 'arquivado') u.arq = 1;
    if (r.titulo_custom) u.ren = 1;
    if (r.quando_custom) u.data = 1;
    if (String(r.category || '').indexOf('meu:') === 0) u.prop = 1;
    [r.titulo_custom, r.nota_custom, String(r.category || '').indexOf('meu:') === 0 ? r.label : ''].forEach((t) => palavrasDe(limpa(t).t).forEach((x) => { u.w[x.w] = x.o; }));
  });
  const pad = { arq: 0, ren: 0, data: 0, prop: 0 }, kw = {};
  Object.keys(ids).forEach((k) => { const u = ids[k]; ['arq', 'ren', 'data', 'prop'].forEach((p) => { pad[p] += u[p]; }); Object.keys(u.w).forEach((w) => { kw[w] = kw[w] || { o: u.w[w], n: 0 }; kw[w].n++; }); });
  const lista = Object.keys(kw).map((w) => [kw[w].o, kw[w].n]).filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { n: Object.keys(ids).length, kw: lista, pad };
}

// O que foi coletado, do mais recente para o mais antigo (a hora vem do updated_at do passo e do criado_em da escola).
export function logColetado(d) {
  const L = normaliza(d.itens), out = [];
  L.forEach((x) => {
    if (x.propria) out.push({ tipo: 'Criou', label: x.label, campos: [], ts: x.ts });
    else if (x.arq) out.push({ tipo: 'Arquivou', label: x.orig, campos: [], ts: x.ts });
    else if (x.editado) out.push({ tipo: 'Editou', label: x.orig, campos: [x.label !== x.orig ? 'título' : '', x.nota ? 'observação' : '', x.links.length ? 'links' : '', x.quando ? 'data' : ''].filter(Boolean), ts: x.ts });
  });
  (d.escolas || []).forEach((e) => out.push({ tipo: 'Adicionou escola', label: e.nome, campos: [], ts: e.criado_em || '' }));
  conversasValidas(d).forEach((c) => out.push({ tipo: 'Leu a conversa', label: 'Conversa ' + c.versao, campos: [], ts: c.quando || '' }));
  return out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

// ---------- HTML ----------
// ui = { tema, dd: { chave: bool }, sugs: { id: 'aviso'|'modelo'|'descartada' }, fmtQuando }
const aberto = (ui, k, padrao) => (ui.dd && ui.dd[k] !== undefined ? !!ui.dd[k] : !!padrao);
function dd(ui, e, key, titulo, sub, corpo, padrao) {
  return '<details class="pn-d" data-dd="' + e(key) + '"' + (aberto(ui, key, padrao) ? ' open' : '') + '><summary>' + titulo + (sub ? ' <span class="nota">· ' + sub + '</span>' : '') + '</summary>' + corpo + '</details>';
}
export function htmlPanorama(a, sugs, ui, h) {
  const e = h.esc, co = a.co;
  const bars = a.temas.length ? a.temas.map((x) => '<button type="button" class="bar-r' + (ui.tema === x[0] ? ' on' : '') + '" data-fx="tema" data-v="' + e(x[0]) + '" aria-expanded="' + (ui.tema === x[0]) + '"><span class="bar-l">' + e(x[0]) + '</span><span class="bar-t"><i style="width:' + Math.round(x[1] / a.max * 100) + '%"></i></span><b>' + x[1] + '</b></button>').join('') : '<p class="nota">Sem temas ainda.</p>';
  const evh = ui.tema && a.ev[ui.tema] && a.ev[ui.tema].length
    ? '<div class="ev"><div class="k">O que ela colocou em ' + e(ui.tema) + '</div><ul>' + a.ev[ui.tema].map((x) => '<li>' + e(x.t) + ' <span class="pill">' + e(x.f) + '</span></li>').join('') + '</ul></div>'
    : (ui.tema ? '<p class="nota">Sem itens.</p>' : '<p class="nota">Clique em um tema para ver o que ela colocou.</p>');
  const imp = a.imp.length ? '<div class="pn-cards">' + a.imp.map((i) => '<article class="imp"><b>' + e(i.t) + '</b><span class="nota">' + e(i.ev) + '</span><button type="button" class="btn s" data-fx="impulso" data-id="' + e(i.id) + '">Escrever sobre isso</button></article>').join('') + '</div>' : '<p class="nota">Nenhum impulso por enquanto.</p>';
  const sgs = (sugs || []).filter((s) => ui.sugs[s.id] !== 'descartada');
  const sgh = sgs.map((s) => { const est = ui.sugs[s.id]; return '<article class="sg"><p><b>' + e(s.t) + '</b></p><p class="nota">' + e(s.ev) + '</p>' +
    (est ? '<span class="pill ok">' + (est === 'aviso' ? 'Aviso criado como rascunho em Início' : 'Marcada para a revisão do modelo (neste navegador)') + '</span>'
      : '<div class="pn-bt"><button type="button" class="btn s primary" data-fx="sugAcao" data-id="' + e(s.id) + '" data-v="' + (s.tipo === 'aviso' ? 'aviso' : 'modelo') + '">' + (s.tipo === 'aviso' ? 'Criar aviso (rascunho)' : 'Marcar para revisar o modelo') + '</button>' +
      '<button type="button" class="btn s" data-fx="sugAcao" data-id="' + e(s.id) + '" data-v="descartada">Descartar</button></div>') + '</article>'; }).join('') || '<p class="nota">Nenhuma sugestão por enquanto.</p>';
  const log = (ui.log || []).slice(0, 8).map((s) => '<li><span class="pill">' + e(s.tipo) + '</span> ' + e(s.label) + (s.campos && s.campos.length ? ' <span class="nota">(' + e(s.campos.join(', ')) + ')</span>' : '') + (s.ts ? '<time>' + e(h.quando ? h.quando(s.ts) : s.ts) + '</time>' : '') + '</li>').join('');
  const grupoN = a.coorteN || 0;
  const cv = a.conv;
  const termosH = cv ? cv.termo.map((t) => '<div class="termo"><div class="termo-h"><b>' + e(t.rotulo) + '</b> <span class="pill">' + e(t.nivelRot) + ' (' + t.nivel + '/4)</span>' +
    (t.tend ? ' <span class="pill">' + (t.tend === 'igual' ? 'igual à conversa anterior' : e(t.tend) + ' desde a conversa anterior (era ' + (NIVEL[t.antes] || t.antes) + ')') + '</span>' : '') +
    '</div><span class="bar-t"><i style="width:' + Math.round(t.nivel / 4 * 100) + '%"></i></span><p class="nota">' + e(t.porque) + (t.calc ? ' · calculado do app' : t.momento ? ' · ' + e(origemConv(t.v, t.momento)) : '') + '</p></div>').join('') : '';
  const manH = cv ? (cv.maneiras.length ? '<div class="kws">' + cv.maneiras.map((m) => '<span class="kw">' + e(m.rotulo) + (m.momento ? '<b>' + e(m.momento) + '</b>' : '') + '</span>').join('') + '</div>' : '<p class="nota">Nenhuma maneira identificada.</p>') +
    (cv.acoes.length ? '<ul class="hist">' + cv.acoes.map((x) => '<li><span class="pill">' + (x.dono === 'ingryd' ? 'Equipe' : 'Ela') + '</span> ' + e(x.texto) + ' <span class="nota">' + e(origemConv(x.v, x.momento)) + '</span></li>').join('') + '</ul>' : '<p class="nota">Nenhuma ação combinada.</p>') : '';
  const hipV = cv ? cv.hip.filter((x) => ui.sugs[x.id] !== 'descartada') : [];
  const hipH = cv ? hipV.map((x) => '<article class="sg"><p><b>' + e(x.texto) + '</b></p><p class="nota">Por quê: ' + e(x.evidencia) + ' · ' + e(origemConv(x.v, x.momento)) + '</p><p class="nota">O que confirma ou derruba: ' + e(x.confirmar) + '</p>' +
    (ui.sugs[x.id] === 'confirmada' ? '<span class="pill ok">Confirmada (neste navegador)</span>' : '<div class="pn-bt"><button type="button" class="btn s primary" data-fx="sugAcao" data-id="' + e(x.id) + '" data-v="confirmada">Confirmar</button><button type="button" class="btn s" data-fx="sugAcao" data-id="' + e(x.id) + '" data-v="descartada">Descartar</button></div>') + '</article>').join('') || '<p class="nota">Nenhuma hipótese aberta.</p>' : '';
  const comp = co
    ? '<p class="pn-c">' + (a.comum.length ? 'Ela fala de ' + a.comum.map((k) => '<b>' + e(k[0]) + '</b> (' + k[1] + ' de ' + co.n + ')').join(', ') + ', como parte do grupo. ' : '') +
      'No grupo (' + co.n + ' pessoas na plataforma): ' + [['arquivam algum passo', co.pad.arq], ['mudam títulos', co.pad.ren], ['definem datas próprias', co.pad.data], ['criam passos próprios', co.pad.prop]].map((x) => e(x[0]) + ' (' + x[1] + ' de ' + co.n + ')').join('; ') + '.</p>'
    : ui.carregandoGrupo ? '<p class="pn-c">Carregando o grupo da persona…</p>'
    : '<p class="pn-c">Poucos dados para comparar: ' + (grupoN ? 'só ' + grupoN + (grupoN === 1 ? ' pessoa' : ' pessoas') : 'ninguém') + ' desta persona está na plataforma. A comparação aparece com 3 pessoas ou mais.</p>';
  return '<div class="pn-lead"><div class="k">Leitura rápida · ' + a.n + (a.n === 1 ? ' sinal' : ' sinais') + (a.n < 3 ? ' · poucos dados' : '') + '</div><p class="pn-t">' + e(a.leitura) + '</p></div>' +
    (cv ? dd(ui, e, 'como', 'Como ela está', 'conversa ' + cv.ult + (cv.n > 1 ? ' · ' + cv.n + ' conversas lidas' : ''), termosH, true) : '') +
    '<div class="pn-sec"><div class="k">Temas · clique para ver o que ela colocou</div><div class="bars">' + bars + '</div>' + evh + '</div>' +
    dd(ui, e, 'imp', 'Impulsos possíveis', '<b>' + a.imp.length + '</b>' + (a.imp[0] ? ' · ' + e(a.imp[0].t) : ''), imp) +
    (cv ? dd(ui, e, 'man', 'Maneiras e ações', cv.maneiras.length + ' maneiras · ' + cv.acoes.length + ' ações', manH, true) + dd(ui, e, 'hip', 'Hipóteses abertas', hipV.length + ' em aberto', hipH, true) : '') +
    dd(ui, e, 'pal', 'Palavras', a.chips.length + ' no total', a.chips.length ? '<div class="kws">' + a.chips.map((c) => '<span class="kw">' + e(c.o) + '<b>' + c.n + '</b></span>').join('') + '</div>' : '<p class="nota">Sem palavras ainda.</p>') +
    dd(ui, e, 'comp', 'Comparação com ' + e(ui.personaCurto || 'a persona'), co ? 'n=' + co.n : 'poucos dados', comp) +
    dd(ui, e, 'sug', 'Sugestões para o sistema', 'revise de vez em quando', sgh) +
    dd(ui, e, 'log', 'O que foi coletado', '', '<ul class="hist">' + (log || '<li class="nota">Nada coletado ainda.</li>') + '</ul>') +
    '<p class="pn-priv"><b>Não coletado:</b> pastas privadas' + (a.priv ? ' (' + a.priv + (a.priv === 1 ? ' link ignorado' : ' links ignorados') + ')' : '') + ', conteúdo de documentos e números pessoais' + (a.red ? ' (' + a.red + (a.red === 1 ? ' trecho ocultado' : ' trechos ocultados') + ')' : '') + '. A pasta do Drive só se abre por autorização dela, por e-mail.' + (cv ? ' Da conversa entram só tema, resumo e o momento (para você ouvir o trecho), nunca o que ela disse.' : '') + '</p>';
}

// O que ela trouxe: só dado público, em dropdowns por tipo.
export function htmlTrouxe(a, ui, h) {
  const e = h.esc;
  const sec = (tt, n, itens) => '<details class="pn-d tr" data-dd="tr-' + e(tt) + '"' + (aberto(ui, 'tr-' + tt, n > 0) ? ' open' : '') + '><summary>' + e(tt) + ' <span class="pill">' + n + '</span></summary>' +
    (itens.length ? '<ul>' + itens.map((i) => '<li>' + i + '</li>').join('') + '</ul>' : '<p class="nota">Nada ainda.</p>') + '</details>';
  return '<p class="nota" style="margin-bottom:8px">' + a.n + (a.n === 1 ? ' sinal' : ' sinais') + '. Só dados públicos: escolas, links de sites, passos, datas e observações já sem número pessoal.</p>' +
    sec('Escolas', a.escolas.length, a.escolas.map((x) => e(x.nome) + (x.host ? ' · ' + e(x.host) : '') + (x.conf.sim + x.conf.nao ? ' · ' + x.conf.sim + ' sim' + (x.conf.nao ? ', ' + x.conf.nao + ' não' : '') + ' nos critérios' : ' · critérios ainda sem resposta'))) +
    sec('Links públicos', a.fontes.length, a.fontes.map((f) => e(f.label) + ' · ' + e(f.host) + ' <span class="nota">(em “' + e(f.passo) + '”)</span>')) +
    sec('Passos próprios', a.prop.length, a.prop.map((c) => e(c.label))) +
    sec('Datas que escolheu', a.datas.length, a.datas.map((x) => e(x.passo) + ' · ' + e(rotQ(x.q)))) +
    sec('Observações', a.notas.length, a.notas.map((x) => e(x.passo) + ': ' + e(x.txt) + (x.r ? ' <em>(sensível ocultado)</em>' : ''))) +
    sec('Renomeou ou arquivou', a.renom.length + a.arq.length, a.renom.map((r) => 'Renomeou “' + e(r.de) + '” → ' + e(r.para)).concat(a.arq.map((x) => 'Arquivou “' + e(x.orig) + '”')));
}
