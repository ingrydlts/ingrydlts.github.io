// Por Dentro — helpers compartilhados para ler o conteúdo em /content/*.json
// e desenhar cards/banners na tela. Sem framework, sem build step.

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("Não consegui carregar " + path);
  return res.json();
}

export function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

export function formatPrice(value) {
  const n = Number(value || 0);
  return n.toFixed(2).replace(".", ",") + " €";
}

// Bloco de imagem: se `src` vier preenchido (via CMS), mostra a foto;
// senão mostra um placeholder com o texto de `label`, igual ao mockup.
export function imgSlotHTML(src, alt, label) {
  if (src) {
    return '<div class="img-slot"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || "") + '" loading="lazy"></div>';
  }
  return (
    '<div class="img-slot"><span class="img-slot-label">' +
    escapeHtml(label || "Foto a adicionar") +
    "</span></div>"
  );
}

export function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Alguns posts migraram para página estática própria (post.url);
// os demais continuam no template dinâmico via ?slug=
export function postHref(post) {
  return post.url || "/artigos/post/?slug=" + encodeURIComponent(post.slug);
}
