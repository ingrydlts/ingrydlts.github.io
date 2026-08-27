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
//   (o acordeão já funciona sozinho — clique é tratado em assets/js/main.js)
//
//   [[RESOURCES]]
//   Título | Descrição curta | Texto do link | URL
//   [[/RESOURCES]]
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

const BLOCK_TAGS = ["BAND", "STATS", "CARDS", "LIST", "STEPS", "FAQ", "RESOURCES", "CHECKLIST", "FEEDBACK"];

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

function renderFaq(lines) {
  const items = lines
    .map((line) => {
      const [q, a] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-faq-item"><button type="button" class="rt-faq-q">' + inline(q || "") +
        '<span class="rt-faq-arrow">▼</span></button><div class="rt-faq-a"><div class="rt-faq-a-inner">' +
        inline(a || "") + "</div></div></div>"
      );
    })
    .join("");
  return '<div class="rt-faq">' + items + "</div>";
}

function renderResources(lines) {
  const items = lines
    .map((line) => {
      const [title, desc, linkText, href] = line.split("|").map((s) => s.trim());
      return (
        '<div class="rt-resource-card"><h4>' + inline(title || "") + "</h4><p>" + inline(desc || "") + "</p>" +
        '<a href="' + escapeAttr(href || "#") + '">' + inline(linkText || "Saiba mais") + " →</a></div>"
      );
    })
    .join("");
  return '<div class="rt-resource-grid">' + items + "</div>";
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

function renderFeedback(lines, ctx) {
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

const BLOCK_RENDERERS = {
  BAND: renderBand,
  STATS: renderStats,
  CARDS: renderCards,
  LIST: renderList,
  STEPS: renderSteps,
  FAQ: renderFaq,
  RESOURCES: renderResources,
  CHECKLIST: renderChecklist,
  FEEDBACK: renderFeedback
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
