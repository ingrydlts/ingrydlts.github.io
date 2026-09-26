// Por Dentro — helpers compartilhados para ler o conteúdo em /content/*.json
// e desenhar cards/banners na tela. Sem framework, sem build step.

// Prévia do /admin: as telas do painel abrem a página real do site num
// <iframe name="pd-preview"> e deixam em window.parent.PDPreview os dados
// que ainda estão sendo editados (antes de publicar). Aqui, se a página
// estiver dentro dessa prévia, lê esses dados em vez do arquivo publicado.
// Fora da prévia (window.name diferente), nada muda.
function previewData(path) {
  if (window.name !== "pd-preview") return undefined;
  try {
    const store = window.parent && window.parent.PDPreview;
    const data = store && store.get(path);
    return data === undefined ? undefined : JSON.parse(JSON.stringify(data));
  } catch (e) {
    return undefined;
  }
}

// Dentro da prévia do /admin (ver acima)?
export const IN_PREVIEW = window.name === "pd-preview";

// Na prévia, o painel pede pra rolar até a parte que está sendo editada
// ({type:"pd-focus", selector}) — a página rola até ela e dá um destaque.
if (IN_PREVIEW) {
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin || !e.data || e.data.type !== "pd-focus") return;
    const selector = e.data.selector;
    // A página desenha depois de buscar os dados — tenta por um tempinho.
    let tries = 0;
    (function attempt() {
      let el = null;
      try { el = document.querySelector(selector); } catch (err) { return; }
      if (!el || !el.offsetHeight) {
        if (++tries < 10) setTimeout(attempt, 200);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const prev = el.style.outline, prevOff = el.style.outlineOffset;
      el.style.outline = "2.5px solid #604034";
      el.style.outlineOffset = "6px";
      setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = prevOff; }, 1600);
    })();
  });
}

// Faixa que só aparece na prévia do /admin, em artigo que ainda não está no
// ar — assim dá pra ver o artigo antes de publicar, sabendo que a leitora
// ainda não vê.
export function previewDraftNoteHTML(post) {
  const labels = { ideia: "Ideia", escrevendo: "Escrevendo", revisao: "Revisão", agendado: "Agendado" };
  const st = labels[post && post.status] || "Rascunho";
  return '<p style="margin:0 0 18px;padding:9px 14px;border-radius:10px;background:#F6ECD6;color:#8A5F12;font-size:13px;font-weight:600;">Prévia · ainda não está no ar (' + escapeHtml(st) + ")</p>";
}

export async function fetchJSON(path) {
  const override = previewData(path);
  if (override !== undefined) return override;
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

// Slug de categoria pra URL (ex.: "Custo de Vida" → "custo-de-vida") — usado
// pela subpágina /artigos/categoria/?cat=. Não é persistido em lugar nenhum:
// é sempre recalculado a partir do nome da categoria em posts.json, então
// renomear uma categoria no /admin já muda a URL correspondente sozinho.
export function categorySlug(category) {
  return String(category || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryHref(category) {
  return "/artigos/categoria/?cat=" + encodeURIComponent(categorySlug(category));
}

// Etapa do artigo, escolhida em /admin no campo "Status" (content/posts.json):
//   ideia → escrevendo → revisao → agendado → publicado
// Só "publicado" aparece no site — e "agendado" aparece sozinho quando a
// "Data de publicação" chega. Qualquer outra etapa deixa o artigo invisível:
// fora de qualquer lista (home, blog, "Veja também", banners de categoria) e
// fora do acesso direto (ver o gate em article-extras.js e artigos/post/).
// Artigos antigos, sem "status", continuam usando o booleano "published".
export const POST_STATUSES = ["ideia", "escrevendo", "revisao", "agendado", "publicado"];

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function isPublished(post) {
  if (!post) return false;
  if (typeof post.status === "string" && post.status) {
    if (post.status === "publicado") return true;
    if (post.status === "agendado") return !!post.date && String(post.date).slice(0, 10) <= todayISO();
    return false;
  }
  return post.published === true;
}

export function publishedItems(items) {
  return (items || []).filter(isPublished);
}
