// Por Dentro — conversor markdown → HTML minimalista, só para o corpo dos
// artigos do blog (títulos, parágrafos, negrito/itálico, links e listas).
// Não é um parser completo — é o suficiente para texto editorial simples,
// sem depender de nenhuma biblioteca externa.
//
// Além do markdown básico, suporta 4 blocos "ricos" (mesmos componentes
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
// Cada linha dentro de STATS/CARDS/LIST usa "|" pra separar as colunas.
// Um parágrafo que comece com "**Atenção:**" também vira automaticamente
// uma caixa de aviso colorida (callout-warn) — não precisa de marcador.

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

const BLOCK_TAGS = ["BAND", "STATS", "CARDS", "LIST"];

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

const BLOCK_RENDERERS = { BAND: renderBand, STATS: renderStats, CARDS: renderCards, LIST: renderList };

// Devolve um array de blocos HTML (cada parágrafo/título/lista/bloco rico é
// 1 item), útil pra quem precisar inserir algo (como o banner in-article) no
// meio do texto.
export function markdownToBlocks(md) {
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
        blocks.push(BLOCK_RENDERERS[blockTag](blockLines));
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
    if (line.startsWith("## ") || line.startsWith("# ")) {
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
  if (blockTag) blocks.push(BLOCK_RENDERERS[blockTag](blockLines));
  return blocks;
}

export function markdownToHtml(md) {
  return markdownToBlocks(md).join("");
}
