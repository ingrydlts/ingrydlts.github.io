// Por Dentro — conversor markdown → HTML minimalista, só para o corpo dos
// artigos do blog (títulos, parágrafos, negrito/itálico, links e listas).
// Não é um parser completo — é o suficiente para texto editorial simples,
// sem depender de nenhuma biblioteca externa.

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

// Devolve um array de blocos HTML (cada parágrafo/título/lista é 1 item),
// útil pra quem precisar inserir algo (como o banner in-article) no meio do texto.
export function markdownToBlocks(md) {
  if (!md) return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listBuffer = null;

  function flushList() {
    if (listBuffer) {
      blocks.push("<ul>" + listBuffer.join("") + "</ul>");
      listBuffer = null;
    }
  }

  lines.forEach((raw) => {
    const line = raw.trim();
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
      blocks.push("<p>" + inline(line) + "</p>");
    }
  });
  flushList();
  return blocks;
}

export function markdownToHtml(md) {
  return markdownToBlocks(md).join("");
}
