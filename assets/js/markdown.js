// Por Dentro — conversor markdown → HTML minimalista, só para o corpo dos
// artigos do blog (títulos, parágrafos, negrito/itálico, links e listas).
// Não é um parser completo — é o suficiente para texto editorial simples,
// sem depender de nenhuma biblioteca externa.
//
// Além do markdown básico, suporta blocos "ricos" (mesmos componentes
// visuais rt-* usados nos artigos com página própria, ver assets/css/style.css)
// via marcadores de texto simples — assim qualquer artigo editado pelo /admin
// pode usá-los, sem precisar de HTML feito à mão:
//
//   [[BAND]]
//   Texto da faixa colorida de destaque no topo do artigo
//   [[/BAND]]
//
//   [[STATS]]
//   110 | Centros credenciados
//   3 | Ministérios envolvidos
//   [[/STATS]]
//
//   [[CARDS]]
//   🎂 | Entre 18 e 30 anos | Faixa etária fixa — não tem exceção documentada.
//   🔄 | Uma vez na vida | Não é renovável.
//   [[/CARDS]]
//
//   [[LIST]]
//   🎯 | Nível de entrada aceito | A0? A1? A2? É o filtro nº1.
//   📄 | O "estatuto" concedido | Confirme se dá direito a trabalho.
//   [[/LIST]]
//
//   [[STEPS]]
//   Título do passo 1 | Descrição do passo 1
//   Título do passo 2 | Descrição do passo 2
//   [[/STEPS]]
//
//   [[FAQ]]
//   Pergunta 1 | Resposta 1
//   Pergunta 2 | Resposta 2
//   [[/FAQ]]
//   (o acordeão já funciona sozinho — clique é tratado em assets/js/main.js;
//   toda pergunta aberta também vira 1 evento no bot, pra saber quais
//   dúvidas a audiência mais tem em cada artigo)
//
//   [[RESOURCES]]
//   Título | Descrição curta | Texto do link | URL
//   [[/RESOURCES]]
//   (cada link abre em nova aba e o clique vira 1 evento no bot — mostra
//   quais fontes a audiência realmente confere)
//
//   [[CHECKLIST]]
//   Título da checklist
//   Item 1
//   Item 2
//   [[/CHECKLIST]]
//   (a 1ª linha é sempre o título; as demais viram itens marcáveis, com
//   barra de progresso que atualiza sozinha — o estado marcado fica salvo
//   no navegador de quem lê, entre visitas)
//
//   [[FEEDBACK]]
//   Esse artigo te ajudou?
//   [[/FEEDBACK]]
//   (texto opcional — sem nada dentro, usa a pergunta padrão. Os votos
//   👍/👎 alimentam o painel de insights, via window.PDEvents)
//
//   [[AFILIADO]]
//   Texto do botão | URL de afiliado | URL da imagem (opcional)
//   [[/AFILIADO]]
//   (link afiliado avulso — cada um é seu próprio bloco independente,
//   criado pelo botão "+ Link afiliado" no editor visual do /admin e
//   arrastável pra qualquer posição do artigo, sem depender de nenhum
//   catálogo. Abre em nova aba com rel="sponsored", como pede a lei pra
//   conteúdo patrocinado)
//
//   [[POLL]]
//   Pergunta da enquete
//   Opção 1
//   Opção 2
//   [[/POLL]]
//   (a 1ª linha é a pergunta, as demais viram botões de resposta única —
//   clique é tratado em assets/js/main.js. Cada resposta vira 1 evento
//   event_type="poll" no bot [payload: poll_id + option], pra dar
//   conhecer a audiência sem depender de assunto sensível — idade,
//   planos futuros etc. Some pro painel de insights, agrupado por
//   pergunta e opção. Um voto por pessoa por enquete, travado no
//   navegador de quem lê — igual ao FEEDBACK)
//
//
// ---- Microengajamento e ferramenta-assinatura (ver MICROENGAJAMENTO.md) ----
// Comportamento em assets/js/microengajamento.js; todo clique vira evento
// "block" no PDEvents (payload.type = nome do bloco em minúsculas + ação).
//
//   [[RESUMO]]                      → "Sem tempo? O resumo em 20 segundos"
//   Ponto 1                           (cada linha vira um tópico)
//   [[/RESUMO]]
//
//   [[CONFIANCA]]                   → "quão segura você está?" de 1 a 5.
//   Quão segura você está sobre X?    O "depois" aparece sozinho no fim do
//   [[/CONFIANCA]]                    artigo, com a diferença.
//
//   [[MITO]]
//   Afirmação | mito | Explicação    (2ª coluna: "mito" ou "verdade")
//   [[/MITO]]
//
//   [[QUIZ]]
//   Título do quiz
//   Pergunta | opção | *opção certa | opção || Explicação
//   [[/QUIZ]]
//
//   [[SELETOR]]                     → "qual é o seu caso?" (soma pontos)
//   Título
//   ? Pergunta | Opção > chave | Opção > chave1, chave2
//   = chave | Título do resultado | Texto | Texto do botão | URL
//   [[/SELETOR]]
//
//   [[PRAZO]]                       → calculadora de prazo com status
//   Título
//   Rótulo da data | 3 meses          (ou "90 dias", "1 ano")
//   [[/PRAZO]]
//
//   [[LINHA-DO-TEMPO]]              → marcos a partir de uma data
//   Título
//   Rótulo da data
//   -12 meses | O que fazer          ("+30 dias", "-2 semanas", "0")
//   [[/LINHA-DO-TEMPO]]
//
//   [[ROTEIRO]]                     → lista salvável "quero ir / já fui"
//   Título
//   Nome | descrição | link (opcional)
//   [[/ROTEIRO]]
//
//   [[PERGUNTA]]                    → caixa anônima "pergunta pra Ingryd"
//   Texto de chamada (opcional)
//   [[/PERGUNTA]]
//
//   [[PROXIMO-PASSO]]               → recomenda uma Solução digital de
//   se prazo<=45 | Título | Texto | Botão | URL      acordo com as respostas
//   se enquete=Opção exata | Título | Texto | Botão | URL
//   se seletor=chave | ...   se quiz<60 | ...   se checklist=completo | ...
//   padrao | Título | Texto | Botão | URL
//   [[/PROXIMO-PASSO]]
//
//   [[TRILHA]]                      → "você está no passo 2 de 3"
//   Nome da trilha
//   slug-do-artigo-1
//   slug-do-artigo-2
//   [[/TRILHA]]
//
// Cada linha dentro de STATS/CARDS/LIST/STEPS/FAQ/RESOURCES usa "|" pra
// separar as colunas. Um parágrafo que comece com "**Atenção:**" também
// vira automaticamente uma caixa de aviso colorida (callout-warn) — não
// precisa de marcador.

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

const BLOCK_TAGS = ["BAND", "STATS", "CARDS", "LIST", "STEPS", "FAQ", "RESOURCES", "CHECKLIST", "FEEDBACK", "AFILIADO", "POLL",
  "RESUMO", "CONFIANCA", "MITO", "QUIZ", "SELETOR", "PRAZO", "LINHA-DO-TEMPO", "ROTEIRO", "PERGUNTA", "PROXIMO-PASSO", "TRILHA"];

function escapeAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderBand(lines) {
  return '<div class="rt-band">' + inline(lines.join(" ")) + "</div>";
}

function renderStats(lines) {
  const items = lines
    .map((line) => {
      const [value, label] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-hero-stat"><span class="rt-hero-stat-num">' + inline(value || "") +
        '</span><span class="rt-hero-stat-label">' + inline(label || "") + "</span></div>"
      );
    })
    .join("");
  return '<div class="rt-hero-stats">' + items + "</div>";
}

function renderCards(lines) {
  const items = lines
    .map((line) => {
      const [icon, title, desc] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-exempt-item"><span class="rt-exempt-icon">' + inline(icon || "") +
        "</span><div><h5>" + inline(title || "") + "</h5><p>" + inline(desc || "") + "</p></div></div>"
      );
    })
    .join("");
  return '<div class="rt-exempt-grid">' + items + "</div>";
}

function renderList(lines) {
  const items = lines
    .map((line) => {
      const [icon, title, desc] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-stat-row"><span class="rt-exempt-icon">' + inline(icon || "") +
        "</span><div><h4>" + inline(title || "") + "</h4><p>" + inline(desc || "") + "</p></div></div>"
      );
    })
    .join("");
  return '<div class="rt-stat-list">' + items + "</div>";
}

function renderSteps(lines) {
  const items = lines
    .map((line, i) => {
      const [title, desc] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-step"><div class="rt-step-num">' + (i + 1) + '</div><div><h4>' + inline(title || "") +
        "</h4><p>" + inline(desc || "") + "</p></div></div>"
      );
    })
    .join("");
  return '<div class="rt-steps">' + items + "</div>";
}

// data-article-slug (no wrapper) + data-faq-id/data-faq-question (por item)
// deixam assets/js/main.js registrar, no bot, qual pergunta foi aberta em
// qual artigo — ver initFaqAccordion.
function renderFaq(lines, ctx) {
  const slug = (ctx && ctx.slug) || "artigo";
  const blockId = slug + "-faq-" + ((ctx && ctx.index) || 0);
  const items = lines
    .map((line, i) => {
      const [q, a] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-faq-item"><button type="button" class="rt-faq-q" data-faq-id="' +
        escapeAttr(blockId + "-" + i) + '" data-faq-question="' + escapeAttr(q || "") + '">' + inline(q || "") +
        '<span class="rt-faq-arrow">▼</span></button><div class="rt-faq-a"><div class="rt-faq-a-inner">' +
        inline(a || "") + "</div></div></div>"
      );
    })
    .join("");
  return '<div class="rt-faq" data-article-slug="' + escapeAttr(slug) + '">' + items + "</div>";
}

// target="_blank" pra não tirar a leitora do artigo ao seguir uma fonte
// externa. data-article-slug + data-resource-title alimentam o rastreio de
// clique em assets/js/main.js (initResourceTracking).
function renderResources(lines, ctx) {
  const slug = (ctx && ctx.slug) || "artigo";
  const items = lines
    .map((line) => {
      const [title, desc, linkText, href] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-resource-card"><h4>' + inline(title || "") + "</h4><p>" + inline(desc || "") + "</p>" +
        '<a href="' + escapeAttr(href || "#") + '" target="_blank" rel="noopener" data-resource-title="' +
        escapeAttr(title || href || "") + '">' + inline(linkText || "Saiba mais") + " →</a></div>"
      );
    })
    .join("");
  return '<div class="rt-resource-grid" data-article-slug="' + escapeAttr(slug) + '">' + items + "</div>";
}

// 1ª linha = título, o resto vira itens marcáveis. blockIndex (posição do
// bloco no artigo) entra no id pra dar um identificador estável e único —
// tanto pra guardar o progresso no navegador de quem lê quanto pra permitir
// mais de uma checklist no mesmo artigo sem colidir.
function renderChecklist(lines, ctx) {
  if (!lines.length) return "";
  const title = lines[0];
  const items = lines.slice(1);
  const slug = (ctx && ctx.slug) || "artigo";
  const blockId = slug + "-checklist-" + ((ctx && ctx.index) || 0);
  const itemsHtml = items
    .map(
      (label, i) =>
        '<label class="rt-checklist-item"><input type="checkbox" data-checklist-item="' + i + '"><span>' +
        inline(label) + "</span></label>"
    )
    .join("");
  return (
    '<div class="rt-checklist rt-progress-wrap" data-checklist-id="' + escapeAttr(blockId) +
    '" data-checklist-total="' + items.length + '">' +
    '<div class="rt-progress-label"><span>' + inline(title) +
    '</span><strong class="rt-checklist-count">0 de ' + items.length + "</strong></div>" +
    '<div class="rt-progress-bar"><div class="rt-checklist-fill rt-progress-fill" style="width:0%; background:var(--verde-moss);"></div></div>' +
    '<div class="rt-checklist-items">' + itemsHtml + "</div></div>"
  );
}

export function renderFeedback(lines, ctx) {
  const question = lines.join(" ").trim() || "Esse artigo foi útil pra você?";
  const slug = (ctx && ctx.slug) || "artigo";
  const blockId = slug + "-feedback-" + ((ctx && ctx.index) || 0);
  return (
    '<div class="rt-feedback" data-feedback-id="' + escapeAttr(blockId) + '" data-article-slug="' + escapeAttr(slug) + '">' +
    '<p class="rt-feedback-q">' + inline(question) + "</p>" +
    '<div class="rt-feedback-actions">' +
    '<button type="button" class="rt-feedback-btn" data-vote="up" aria-label="Sim, ajudou">👍</button>' +
    '<button type="button" class="rt-feedback-btn" data-vote="down" aria-label="Não ajudou">👎</button>' +
    "</div>" +
    '<p class="rt-feedback-thanks" hidden>Obrigada pelo retorno! 🙏</p>' +
    "</div>"
  );
}

// Link afiliado avulso — 1 linha só: "texto do botão | url | imagem (opcional)".
// rel="sponsored" (além de "noopener") é a marcação que Google recomenda pra
// link patrocinado/afiliado; "nofollow" fica implícito em "sponsored".
function renderAfiliado(lines) {
  const [label, url, image] = (lines[0] || "").split("|").map((s) => (s || "").trim());
  const text = label || "Ver oferta";
  const href = url || "#";
  return (
    '<div class="in-article-banner"><div class="blog-banner">' +
    (image ? '<div class="img-slot"><img src="' + escapeAttr(image) + '" alt="" loading="lazy"></div>' : "") +
    '<div class="blog-banner-body"><div><span class="badge badge-publicite">Publicidade</span></div>' +
    '<a class="btn btn-pill" href="' + escapeAttr(href) + '" target="_blank" rel="sponsored noopener" style="background:var(--merlot); margin-top:10px;">' +
    inline(text) + " →</a></div></div></div>"
  );
}

// 1ª linha = pergunta, as demais viram botões de resposta única. Sem
// aggregate ao vivo pro leitor (diferente do FEEDBACK) — o objetivo aqui é
// dar à autora um retrato da audiência (faixa etária, planos etc.), não
// mostrar resultado pra quem responde. Mesmo padrão de id estável do
// CHECKLIST/FEEDBACK (slug + posição no artigo).
function renderPoll(lines, ctx) {
  if (!lines.length) return "";
  const question = lines[0];
  const options = lines.slice(1);
  const slug = (ctx && ctx.slug) || "artigo";
  const blockId = slug + "-poll-" + ((ctx && ctx.index) || 0);
  const optionsHtml = options
    .map(
      (label, i) =>
        '<button type="button" class="rt-poll-option" data-poll-option="' + escapeAttr(label) + '">' +
        inline(label) + "</button>"
    )
    .join("");
  return (
    '<div class="rt-poll" data-poll-id="' + escapeAttr(blockId) + '" data-article-slug="' + escapeAttr(slug) + '">' +
    '<p class="rt-poll-q">' + inline(question) + "</p>" +
    '<div class="rt-poll-options">' + optionsHtml + "</div>" +
    '<p class="rt-poll-thanks" hidden>Valeu por responder! 🙏</p>' +
    "</div>"
  );
}


// ---- microengajamento ------------------------------------------------------
// Cada bloco sai com data-mx (tipo), data-mx-id (id estável: slug + tipo +
// posição) e os dados que o microengajamento.js precisa. O conteúdo que a
// leitora lê já vem no HTML (funciona mesmo antes do JS carregar).
function cols(line) {
  return line.split("|").map((x) => x.trim());
}
function mxOpen(type, ctx, label, extra) {
  const slug = (ctx && ctx.slug) || "artigo";
  const id = slug + "-" + type + "-" + ((ctx && ctx.index) || 0);
  return (
    '<div class="mx mx-' + type + '" data-mx="' + type + '" data-mx-id="' + escapeAttr(id) + '" data-article-slug="' + escapeAttr(slug) + '"' +
    (extra || "") + ">" + (label ? '<span class="mx-lab">' + label + "</span>" : "")
  );
}

function renderResumo(lines, ctx) {
  const slug = (ctx && ctx.slug) || "artigo";
  return (
    '<details class="mx mx-resumo" data-mx="resumo" data-article-slug="' + escapeAttr(slug) + '"><summary>Sem tempo? O resumo em 20 segundos</summary><ul>' +
    lines.map((l) => "<li>" + inline(l.replace(/^[-*]\s+/, "")) + "</li>").join("") + "</ul></details>"
  );
}

const CONF_LABELS = ["perdida", "insegura", "mais ou menos", "segura", "tranquila"];
function confScale(moment) {
  return '<div class="mx-scale" data-moment="' + moment + '">' +
    CONF_LABELS.map((l, i) => '<button type="button" data-v="' + (i + 1) + '">' + (i + 1) + "<small>" + l + "</small></button>").join("") + "</div>";
}
function renderConfianca(lines, ctx) {
  const q = lines.join(" ").trim() || "Quão segura você está sobre esse assunto?";
  return mxOpen("confianca", ctx, "Antes de ler", ' data-question="' + escapeAttr(q) + '"') +
    "<h3>" + inline(q) + "</h3>" + confScale("antes") + '<p class="mx-note" hidden>Anotado. No fim do artigo eu te pergunto de novo.</p></div>';
}

function renderMito(lines, ctx) {
  let title = "Mito ou verdade?";
  const rows = [];
  lines.forEach((l) => {
    const c = cols(l);
    if (c.length >= 2 && /^(mito|verdade)$/i.test(c[1])) rows.push(c);
    else if (!rows.length) title = l;
  });
  return mxOpen("mito", ctx, "Mito ou verdade?") + "<h3>" + inline(title) + "</h3>" +
    rows.map((c, i) =>
      '<div class="mx-myth" data-i="' + i + '" data-answer="' + c[1].toLowerCase() + '"><p>“' + inline(c[0]) + '”</p>' +
      '<div class="mx-choices"><button type="button" data-guess="verdade">Verdade</button><button type="button" data-guess="mito">Mito</button></div>' +
      '<div class="mx-answer" hidden><b></b> ' + inline(c[2] || "") + "</div></div>"
    ).join("") + '<p class="mx-score" hidden></p></div>';
}

function renderQuiz(lines, ctx) {
  const title = lines[0] || "Teste rápido";
  const qs = lines.slice(1).map((l) => {
    const [main, expl] = l.split("||");
    const c = cols(main);
    return { q: c[0], opts: c.slice(1).filter(Boolean), expl: (expl || "").trim() };
  }).filter((q) => q.q && q.opts.length > 1);
  return mxOpen("quiz", ctx, "Teste rápido", ' data-total="' + qs.length + '"') + "<h3>" + inline(title) + "</h3>" +
    qs.map((q, i) =>
      '<div class="mx-q" data-i="' + i + '"><p class="mx-q-t"><span>' + (i + 1) + "/" + qs.length + "</span> " + inline(q.q) + "</p>" +
      '<div class="mx-opts">' + q.opts.map((o) => {
        const ok = o.startsWith("*");
        return '<button type="button"' + (ok ? ' data-ok="1"' : "") + ">" + inline(ok ? o.slice(1).trim() : o) + "</button>";
      }).join("") + "</div>" +
      (q.expl ? '<p class="mx-expl" hidden>' + inline(q.expl) + "</p>" : "") + "</div>"
    ).join("") + '<div class="mx-result" hidden></div></div>';
}

function renderSeletor(lines, ctx) {
  let title = "Qual é o seu caso?";
  const qs = [];
  const res = [];
  lines.forEach((l, i) => {
    if (l.startsWith("?")) {
      const c = cols(l.slice(1));
      qs.push({ q: c[0], opts: c.slice(1).map((o) => { const [t, k] = o.split(">"); return { t: (t || "").trim(), k: (k || "").trim() }; }) });
    } else if (l.startsWith("=")) {
      const c = cols(l.slice(1));
      res.push({ k: c[0], t: c[1] || c[0], d: c[2] || "", b: c[3] || "", u: c[4] || "" });
    } else if (i === 0) title = l;
  });
  return mxOpen("seletor", ctx, "Descubra o seu caso") + "<h3>" + inline(title) + "</h3>" +
    qs.map((q, i) =>
      '<div class="mx-q" data-i="' + i + '"' + (i ? " hidden" : "") + '><p class="mx-q-t"><span>' + (i + 1) + "/" + qs.length + "</span> " + inline(q.q) + "</p>" +
      '<div class="mx-opts">' + q.opts.map((o) => '<button type="button" data-keys="' + escapeAttr(o.k) + '">' + inline(o.t) + "</button>").join("") + "</div></div>"
    ).join("") +
    res.map((r) =>
      '<div class="mx-res" data-key="' + escapeAttr(r.k) + '" hidden><span class="mx-lab">Seu resultado</span><h4>' + inline(r.t) + "</h4><p>" + inline(r.d) + "</p>" +
      (r.u ? '<a class="btn btn-pill" href="' + escapeAttr(r.u) + '" data-mx-link="seletor">' + inline(r.b || "Ver mais") + " →</a>" : "") + "</div>"
    ).join("") + '<button type="button" class="mx-restart" hidden>Refazer</button></div>';
}

function renderPrazo(lines, ctx) {
  const title = lines[0] || "Quantos dias você ainda tem?";
  const [label, dur] = cols(lines[1] || "Data de início | 3 meses");
  return mxOpen("prazo", ctx, "Calculadora", ' data-duration="' + escapeAttr(dur || "3 meses") + '"') + "<h3>" + inline(title) + "</h3>" +
    '<label class="mx-field"><span>' + inline(label || "Data de início") + '</span><input type="date"></label>' +
    '<div class="mx-out" aria-live="polite"></div></div>';
}

function renderLinha(lines, ctx) {
  const title = lines[0] || "Sua linha do tempo";
  const label = lines[1] || "Data de referência";
  const steps = lines.slice(2).map(cols).filter((c) => c[1]);
  return mxOpen("linha", ctx, "Linha do tempo") + "<h3>" + inline(title) + "</h3>" +
    '<label class="mx-field"><span>' + inline(label) + '</span><input type="date"></label><ol class="mx-steps">' +
    steps.map((c) => '<li data-offset="' + escapeAttr(c[0]) + '"><span class="mx-when">' + inline(c[0]) + "</span><span>" + inline(c[1]) + "</span></li>").join("") +
    "</ol></div>";
}

function renderRoteiro(lines, ctx) {
  const title = lines[0] || "Seu roteiro";
  const items = lines.slice(1).map(cols).filter((c) => c[0]);
  return mxOpen("roteiro", ctx, "Monte seu roteiro") + "<h3>" + inline(title) + "</h3>" +
    '<p class="mx-note">Marque o que você quer fazer. Fica salvo neste aparelho.</p><ul class="mx-spots">' +
    items.map((c, i) =>
      '<li data-i="' + i + '"><div><b>' + inline(c[0]) + "</b>" + (c[1] ? "<small>" + inline(c[1]) + "</small>" : "") +
      (c[2] ? ' <a href="' + escapeAttr(c[2]) + '" target="_blank" rel="noopener">ver →</a>' : "") + "</div>" +
      '<div class="mx-spot-btns"><button type="button" data-s="quero">Quero ir</button><button type="button" data-s="fui">Já fui</button></div></li>'
    ).join("") + "</ul></div>";
}

function renderPergunta(lines, ctx) {
  const t = lines.join(" ").trim() || "Ficou alguma dúvida? Pergunta pra mim. As mais pedidas viram artigo.";
  return mxOpen("pergunta", ctx, "Pergunta pra Ingryd") + "<h3>" + inline(t) + "</h3>" +
    '<textarea rows="3" maxlength="280" placeholder="Escreva sua dúvida (sem nome, sem e-mail)" aria-label="Sua pergunta"></textarea>' +
    '<div class="mx-row"><small class="mx-count">0/280</small><button type="button" class="btn btn-pill mx-send">Enviar pergunta</button></div></div>';
}

function renderProximo(lines, ctx) {
  const rules = lines.map((l) => {
    const c = cols(l);
    const cond = c[0].replace(/^se\s+/i, "").trim();
    return { cond: /^padr[aã]o$/i.test(cond) ? "padrao" : cond, t: c[1] || "", d: c[2] || "", b: c[3] || "Ver solução", u: c[4] || "" };
  }).filter((r) => r.t);
  return mxOpen("proximo", ctx, "Seu próximo passo · Soluções digitais") +
    rules.map((r, i) =>
      '<div class="mx-rule" data-cond="' + escapeAttr(r.cond) + '"' + (r.cond === "padrao" ? "" : " hidden") + "><h3>" + inline(r.t) + "</h3><p>" + inline(r.d) + "</p>" +
      '<p class="mx-why" hidden></p>' + (r.u ? '<a class="btn btn-pill" href="' + escapeAttr(r.u) + '" data-mx-link="proximo" data-rule="' + i + '">' + inline(r.b) + " →</a>" : "") + "</div>"
    ).join("") + '<a class="mx-all" href="/produtos-digitais/" data-mx-link="proximo-todas">Ver todas as soluções digitais</a></div>';
}

function renderTrilha(lines, ctx) {
  const name = lines[0] || "Trilha";
  const slugs = lines.slice(1).map((l) => l.trim()).filter(Boolean);
  return mxOpen("trilha", ctx, "Trilha · " + inline(name), ' data-slugs="' + escapeAttr(slugs.join(",")) + '"') +
    '<div class="mx-trail">' + slugs.map((s) => '<a href="/artigos/post/?slug=' + escapeAttr(s) + '" data-slug="' + escapeAttr(s) + '"></a>').join("") + "</div></div>";
}

const BLOCK_RENDERERS = {
  BAND: renderBand,
  STATS: renderStats,
  CARDS: renderCards,
  LIST: renderList,
  STEPS: renderSteps,
  FAQ: renderFaq,
  RESOURCES: renderResources,
  CHECKLIST: renderChecklist,
  FEEDBACK: renderFeedback,
  AFILIADO: renderAfiliado,
  POLL: renderPoll,
  RESUMO: renderResumo,
  CONFIANCA: renderConfianca,
  MITO: renderMito,
  QUIZ: renderQuiz,
  SELETOR: renderSeletor,
  PRAZO: renderPrazo,
  "LINHA-DO-TEMPO": renderLinha,
  ROTEIRO: renderRoteiro,
  PERGUNTA: renderPergunta,
  "PROXIMO-PASSO": renderProximo,
  TRILHA: renderTrilha
};

// Devolve um array de blocos HTML (cada parágrafo/título/lista/bloco rico é
// 1 item), útil pra quem precisar inserir algo (como o banner in-article) no
// meio do texto. ctx opcional ({ slug }) é repassado aos blocos que precisam
// saber em que artigo estão (CHECKLIST, FEEDBACK) — sem ele, ainda funcionam,
// só com um id genérico em vez do slug real.
export function markdownToBlocks(md, ctx) {
  if (!md) return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listBuffer = null;
  let blockTag = null;
  let blockLines = null;

  function flushList() {
    if (listBuffer) {
      blocks.push("<ul>" + listBuffer.join("") + "</ul>");
      listBuffer = null;
    }
  }

  lines.forEach((raw) => {
    const line = raw.trim();

    if (blockTag) {
      if (line === "[[/" + blockTag + "]]") {
        blocks.push(BLOCK_RENDERERS[blockTag](blockLines, { slug: ctx && ctx.slug, index: blocks.length }));
        blockTag = null;
        blockLines = null;
      } else if (line) {
        blockLines.push(line);
      }
      return;
    }

    const openTag = BLOCK_TAGS.find((tag) => line === "[[" + tag + "]]");
    if (openTag) {
      flushList();
      blockTag = openTag;
      blockLines = [];
      return;
    }

    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push("<h3>" + inline(line.slice(4)) + "</h3>");
    } else if (line.startsWith("## ") || line.startsWith("# ")) {
      flushList();
      const text = line.startsWith("## ") ? line.slice(3) : line.slice(2);
      blocks.push("<h2>" + inline(text) + "</h2>");
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!listBuffer) listBuffer = [];
      listBuffer.push("<li>" + inline(line.slice(2)) + "</li>");
    } else {
      flushList();
      const html = inline(line);
      if (html.startsWith("<strong>Atenção:</strong>")) {
        blocks.push('<div class="callout callout-warn"><p>' + html + "</p></div>");
      } else {
        blocks.push("<p>" + html + "</p>");
      }
    }
  });
  flushList();
  if (blockTag) blocks.push(BLOCK_RENDERERS[blockTag](blockLines, { slug: ctx && ctx.slug, index: blocks.length }));
  return blocks;
}

export function markdownToHtml(md, ctx) {
  return markdownToBlocks(md, ctx).join("");
}
