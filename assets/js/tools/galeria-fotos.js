// Por Dentro — galeria de fotos embutida no artigo, com carrossel (reaproveita
// as classes .pdp-carousel do PDP) e um modo tela cheia pra ver cada foto em
// detalhe. Fica num módulo à parte pelo mesmo motivo dos outros [[TOKEN]]s: o
// corpo do artigo é markdown puro editado pelo /admin, e o parser
// (assets/js/markdown.js) escapa qualquer HTML de propósito. O marcador
// "[[GALERIA]]" no corpo vira um <div id="tool-galeria-fotos" data-images="...">
// (ver /artigos/post/index.html), com as fotos vindas do campo "gallery" do
// próprio artigo — assim cada artigo edita suas fotos e legendas pelo painel,
// sem precisar de HTML feito à mão.

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

const CSS = `
.gt-tool{margin:28px 0;}
.gt-carousel-thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:2px;}
.gt-thumb{flex:0 0 auto;width:64px;height:64px;border-radius:6px;border:2px solid transparent;overflow:hidden;cursor:pointer;background:var(--off-white-soft);padding:0;}
.gt-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.gt-thumb.is-active{border-color:var(--verde-moss);}
.gt-caption{margin-top:10px;font-size:13px;color:var(--texto-secundario);text-align:center;}
.gt-viewport{cursor:zoom-in;}
.gt-lightbox{position:fixed;inset:0;background:rgba(20,18,16,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}
.gt-lightbox[hidden]{display:none;}
.gt-lightbox-img{max-width:min(92vw,1000px);max-height:76vh;object-fit:contain;border-radius:4px;}
.gt-lightbox-caption{color:#F4F1EC;font-size:13px;margin-top:14px;text-align:center;max-width:70ch;}
.gt-lightbox-close{position:absolute;top:18px;right:18px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.3);color:#fff;font-size:20px;cursor:pointer;}
.gt-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.3);color:#fff;font-size:20px;cursor:pointer;}
.gt-lightbox-nav.prev{left:18px;} .gt-lightbox-nav.next{right:18px;}
`;

function carouselHTML(images) {
  const thumbs = images
    .map(
      (img, i) =>
        '<button type="button" class="gt-thumb' + (i === 0 ? " is-active" : "") + '" data-idx="' + i + '" aria-label="Foto ' + (i + 1) + '">' +
        '<img src="' + escapeHtml(img.image) + '" alt="" loading="lazy"></button>'
    )
    .join("");

  return (
    '<div class="gt-tool" data-gallery>' +
    '<div class="pdp-carousel">' +
    '<div class="pdp-carousel-main">' +
    '<div class="pdp-carousel-viewport gt-viewport" data-gt-viewport tabindex="0" role="button" aria-label="Ver foto em tela cheia">' +
    '<img src="' + escapeHtml(images[0].image) + '" alt="' + escapeHtml(images[0].caption || "") + '" loading="lazy"></div>' +
    (images.length > 1
      ? '<button type="button" class="pdp-car-nav prev" data-gt-prev aria-label="Foto anterior">‹</button>' +
        '<button type="button" class="pdp-car-nav next" data-gt-next aria-label="Próxima foto">›</button>'
      : "") +
    "</div>" +
    (images.length > 1 ? '<div class="gt-carousel-thumbs">' + thumbs + "</div>" : "") +
    "</div>" +
    '<p class="gt-caption" data-gt-caption>' + escapeHtml(images[0].caption || "") + "</p>" +
    '<div class="gt-lightbox" data-gt-lightbox hidden>' +
    '<button type="button" class="gt-lightbox-close" data-gt-close aria-label="Fechar">✕</button>' +
    (images.length > 1
      ? '<button type="button" class="gt-lightbox-nav prev" data-gt-lb-prev aria-label="Foto anterior">‹</button>' +
        '<button type="button" class="gt-lightbox-nav next" data-gt-lb-next aria-label="Próxima foto">›</button>'
      : "") +
    '<img class="gt-lightbox-img" data-gt-lb-img src="" alt="">' +
    '<p class="gt-lightbox-caption" data-gt-lb-caption></p>' +
    "</div></div>"
  );
}

export function mount(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  let images;
  try {
    images = JSON.parse(root.getAttribute("data-images") || "[]");
  } catch (e) {
    images = [];
  }
  images = images.filter((img) => img && img.image);
  if (!images.length) return;

  if (!document.getElementById("gt-tool-css")) {
    const style = document.createElement("style");
    style.id = "gt-tool-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  root.innerHTML = carouselHTML(images);

  const viewport = root.querySelector("[data-gt-viewport]");
  const captionEl = root.querySelector("[data-gt-caption]");
  const thumbs = Array.from(root.querySelectorAll(".gt-thumb"));
  const lightbox = root.querySelector("[data-gt-lightbox]");
  const lbImg = root.querySelector("[data-gt-lb-img]");
  const lbCaption = root.querySelector("[data-gt-lb-caption]");
  let idx = 0;

  function show(i) {
    idx = (i + images.length) % images.length;
    viewport.querySelector("img").src = images[idx].image;
    captionEl.textContent = images[idx].caption || "";
    thumbs.forEach((t, ti) => t.classList.toggle("is-active", ti === idx));
    if (!lightbox.hidden) openLightbox(idx);
  }

  function openLightbox(i) {
    idx = i;
    lbImg.src = images[idx].image;
    lbImg.alt = images[idx].caption || "";
    lbCaption.textContent = images[idx].caption || "";
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
  }

  thumbs.forEach((t, ti) => t.addEventListener("click", () => show(ti)));
  const prev = root.querySelector("[data-gt-prev]");
  const next = root.querySelector("[data-gt-next]");
  if (prev) prev.addEventListener("click", () => show(idx - 1));
  if (next) next.addEventListener("click", () => show(idx + 1));

  viewport.addEventListener("click", () => openLightbox(idx));
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(idx); }
  });

  root.querySelector("[data-gt-close]").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  const lbPrev = root.querySelector("[data-gt-lb-prev]");
  const lbNext = root.querySelector("[data-gt-lb-next]");
  if (lbPrev) lbPrev.addEventListener("click", () => openLightbox((idx - 1 + images.length) % images.length));
  if (lbNext) lbNext.addEventListener("click", () => openLightbox((idx + 1) % images.length));

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft" && images.length > 1) openLightbox((idx - 1 + images.length) % images.length);
    if (e.key === "ArrowRight" && images.length > 1) openLightbox((idx + 1) % images.length);
  });
}
