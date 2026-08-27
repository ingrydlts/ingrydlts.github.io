// Por Dentro — "atualizado em" + sugestões relacionadas no fim do artigo.
// Compartilhado entre o template dinâmico (/artigos/post/) e as páginas
// estáticas (/artigos/post/<slug>/) — um lugar só pra manter os dois iguais.
import { fetchJSON, imgSlotHTML, escapeHtml, postHref } from "/assets/js/render.js";
import { renderFeedback } from "/assets/js/markdown.js";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// Mesma categoria primeiro (mais relevante pra quem acabou de ler este artigo),
// depois completa com os demais — sempre os mais recentes primeiro.
export function pickRelated(items, post, max) {
  max = max || 3;
  const others = items.filter((p) => p.slug !== post.slug);
  const byRecency = (a, b) =>
    new Date(b.updatedDate || b.date || 0) - new Date(a.updatedDate || a.date || 0);
  const sameCategory = others.filter((p) => p.category === post.category).sort(byRecency);
  const rest = others.filter((p) => p.category !== post.category).sort(byRecency);
  return sameCategory.concat(rest).slice(0, max);
}

export function relatedSectionHTML(items) {
  if (!items || !items.length) return "";
  const cards = items
    .map(
      (p) =>
        '<a class="card" href="' + escapeHtml(postHref(p)) + '" style="color:inherit;">' +
        imgSlotHTML(p.image, p.title, "Foto do artigo") +
        '<div class="card-body"><h3 style="font-size:16px;">' + escapeHtml(p.title) + "</h3>" +
        '<span style="font-weight:600; font-size:13px; color:#604034;">Ler artigo →</span></div></a>'
    )
    .join("");
  return (
    '<div class="related"><div class="eyebrow" style="color:#6E6862;">Veja também</div>' +
    '<div class="related-list">' + cards + "</div></div>"
  );
}

export function updatedLineHTML(post) {
  const updated = post.updatedDate || post.date;
  if (!updated) return "";
  return '<div class="article-updated">↻ Atualizado em ' + escapeHtml(formatDate(updated)) + "</div>";
}

// Pras páginas estáticas: acha o post pelo slug fixo da página e substitui os
// mount points pelo conteúdo renderizado. Se algo falhar (fetch, slug não
// encontrado), a página continua normal — só sem esses blocos.
export async function mountArticleExtras(opts) {
  const slug = opts.slug;
  let data;
  try {
    data = await fetchJSON("/content/posts.json");
  } catch (e) {
    return;
  }
  const post = data.items.find((p) => p.slug === slug);
  if (!post) return;

  if (opts.updatedMountId) {
    const el = document.getElementById(opts.updatedMountId);
    if (el) el.outerHTML = updatedLineHTML(post);
  }
  // Bloco genérico de "esse artigo te ajudou?" — regra: todo artigo tem
  // Feedback, mesmo os com HTML próprio (que não passam pelo corpo em
  // markdown, então não podem usar [[FEEDBACK]] direto). index fixo
  // ("static") porque cada página estática só tem 1 bloco de feedback.
  if (opts.feedbackMountId) {
    const el = document.getElementById(opts.feedbackMountId);
    if (el) el.outerHTML = renderFeedback([], { slug: post.slug, index: "static" });
  }
  if (opts.relatedMountId) {
    const el = document.getElementById(opts.relatedMountId);
    if (el) el.outerHTML = relatedSectionHTML(pickRelated(data.items, post, opts.relatedMax));
  }
  document.dispatchEvent(new CustomEvent("pd:blocks-rendered"));
}
