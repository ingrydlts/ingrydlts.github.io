// Por Dentro — vitrine de produtos digitais: monta a lista
// (/produtos-digitais/), a página de cada produto (/produtos-digitais/
// produto/?slug=) e a tela de compra confirmada (/produtos-digitais/
// obrigado/). Estilos em assets/css/vitrine.css. Os dados vêm de
// content/produtos-digitais.json (editado no estúdio de produtos do /admin).
//
// O que cada tela faz pra quem compra (design aprovado no rascunho):
//   - botões com estados (passar o mouse, pressionado, bloqueado, carregando);
//   - esqueleto no formato dos cards enquanto a lista carrega;
//   - galeria que passa com o dedo, com setas e miniaturas;
//   - comprar sem marcar a caixa de retratação balança a caixa e explica;
//   - barra de compra fixa no celular quando o botão principal sai da tela;
//   - avaliações reais (Worker) perto do preço, só quando existem;
//   - combo com a soma e o desconto na hora;
//   - confirmação animada com os próximos passos do produto (nextSteps).

import { escapeHtml, formatPrice } from "/assets/js/render.js";
import { withProductSlug } from "/assets/js/purchase.js";

export const WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";
const IS_PREVIEW = window.name === "pd-preview";

const ICON = {
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  once: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>'
};

export function productHref(slug) {
  return "/produtos-digitais/produto/?slug=" + encodeURIComponent(slug);
}
export function activeItems(items) {
  return (items || []).filter((p) => p.active !== false);
}
function discount(p) {
  return p.priceOld && Number(p.priceOld) > Number(p.price) ? Math.round((1 - p.price / p.priceOld) * 100) : 0;
}
function priceHTML(p) {
  const d = discount(p);
  return (
    '<span class="vt-price"><b>' + formatPrice(p.price) + "</b>" +
    (p.priceOld ? "<s>" + formatPrice(p.priceOld) + "</s>" : "") +
    (d ? '<span class="vt-badge is-off">−' + d + "%</span>" : "") +
    "</span>"
  );
}
// Cupom do produto (campo "coupon" em content/produtos-digitais.json):
// { enabled, code, label, percent?, until? }. Só aparece ligado, com código e
// dentro da validade. O código também vai preenchido no pagamento do Stripe
// (prefilled_promo_code) — pra funcionar, o mesmo código precisa existir no
// Stripe e o Payment Link precisa aceitar códigos promocionais.
function todayISO() {
  const d = new Date(), pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
export function activeCoupon(p) {
  const c = p && p.coupon;
  if (!c || c.enabled === false || !c.code) return null;
  if (c.until && String(c.until).slice(0, 10) < todayISO()) return null;
  return c;
}
function couponLabel(c) {
  return c.label || (c.percent ? Number(c.percent) + "% de desconto" : "desconto");
}
function couponUntil(c) {
  if (!c.until) return "";
  const d = new Date(String(c.until).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function couponBandHTML(p, c) {
  const pct = Number(c.percent) || 0;
  const withPrice = pct > 0 && pct < 100 ? formatPrice(Math.round(p.price * (1 - pct / 100) * 100) / 100) : "";
  const until = couponUntil(c);
  return (
    '<div class="vt-coupon" id="vt-coupon">' +
      '<div class="vt-coupon-l"><span class="vt-coupon-k">Cupom</span>' +
        "<b>" + escapeHtml(couponLabel(c)) + "</b>" +
        '<small>' + (withPrice ? "Com o cupom, fica " + withPrice + ". " : "") + (until ? "Válido até " + until + ". " : "") + "Ele já vai preenchido no pagamento — se não aparecer, é só colar.</small>" +
      "</div>" +
      '<button type="button" class="vt-coupon-code" data-copy="' + escapeHtml(c.code) + '" aria-label="Copiar o cupom ' + escapeHtml(c.code) + '"><code>' + escapeHtml(c.code) + '</code><span data-copy-label>Copiar</span></button>' +
    "</div>"
  );
}
function checkoutUrl(p) {
  let url = withProductSlug(p.stripeLink, p.slug);
  const c = activeCoupon(p);
  if (url && c) url += (url.includes("?") ? "&" : "?") + "prefilled_promo_code=" + encodeURIComponent(c.code);
  return url;
}

// Mesma regra de sempre: 10% com 2 produtos, 15% com 3, 20% com 4 ou mais,
// nunca mais que 50% da soma.
export function bundlePrice(items) {
  const sum = items.reduce((s, it) => s + Number(it.price || 0), 0);
  const n = items.length;
  const tier = n >= 4 ? 0.2 : n === 3 ? 0.15 : 0.1;
  const finalPrice = n > 1 ? Math.max(sum * (1 - tier), sum * 0.5) : sum;
  return { sum, finalPrice, pct: sum > 0 ? Math.round((1 - finalPrice / sum) * 100) : 0 };
}
function bundleOf(p, items) {
  return (p.bundleWith || []).map((s) => items.find((it) => it.slug === s && it.active !== false)).filter(Boolean);
}
function faqHTML(list) {
  if (!list || !list.length) return "";
  return (
    '<div class="vt-faq">' +
    list.map((f) =>
      '<div class="vt-faq-i"><button type="button" class="vt-faq-q" aria-expanded="false">' + escapeHtml(f.q) +
      '<i aria-hidden="true">+</i></button><div class="vt-faq-a"><div><p>' + escapeHtml(f.a) + "</p></div></div></div>"
    ).join("") +
    "</div>"
  );
}
function initFaq(root) {
  root.querySelectorAll(".vt-faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const it = q.parentNode, open = !it.classList.contains("is-open");
      it.classList.toggle("is-open", open);
      q.setAttribute("aria-expanded", String(open));
    });
  });
}
let toastTimer;
function toast(text) {
  let el = document.getElementById("vt-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "vt-toast";
    el.className = "vt-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-show"), 1800);
}

// ============================================================ lista ======
function skeletonCards(n) {
  let h = "";
  for (let i = 0; i < n; i++) {
    h += '<div class="vt-card is-skel" aria-hidden="true"><div class="vt-card-ph vt-sk"></div><div class="vt-card-bd">' +
      '<span class="vt-sk" style="width:40%;height:10px"></span><span class="vt-sk" style="width:75%;height:22px"></span>' +
      '<span class="vt-sk" style="width:95%;height:12px"></span><span class="vt-sk" style="width:80%;height:12px"></span>' +
      '<div class="vt-card-row"><span class="vt-sk" style="width:90px;height:26px"></span><span class="vt-sk" style="width:110px;height:18px"></span></div></div></div>';
  }
  return h;
}
function cardHTML(p) {
  const photos = (p.gallery || []).filter((g) => g.type !== "Vídeo" && g.image).map((g) => g.image);
  const main = p.image || photos[0] || "";
  const alt = photos.find((src) => src !== main) || "";
  const cp = activeCoupon(p);
  return (
    '<a class="vt-card' + (cp ? " has-coupon" : "") + '" href="' + productHref(p.slug) + (cp ? "#cupom" : "") + '">' +
      '<div class="vt-card-ph">' +
        (main ? '<img src="' + escapeHtml(main) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' : "") +
        (alt ? '<img class="is-alt" src="' + escapeHtml(alt) + '" alt="" loading="lazy">' : "") +
        (p.launchNote ? '<span class="vt-badge is-brand">' + (discount(p) ? "Preço de lançamento" : "Novo") + "</span>" : "") +
        (cp ? '<span class="vt-ctag"><i aria-hidden="true"></i>Cupom' + (cp.percent ? " −" + Number(cp.percent) + "%" : "") + "</span>" : "") +
      "</div>" +
      '<div class="vt-card-bd">' +
        (p.kicker ? '<span class="vt-eyebrow">' + escapeHtml(p.kicker) + "</span>" : "") +
        "<h3>" + escapeHtml(p.title) + "</h3>" +
        (p.summary ? "<p>" + escapeHtml(p.summary) + "</p>" : "") +
        ((p.features || []).length ? '<ul class="vt-inc">' + p.features.slice(0, 2).map((f) => "<li>" + escapeHtml(f) + "</li>").join("") + "</ul>" : "") +
        (cp ? '<p class="vt-card-coupon">Tem cupom de ' + escapeHtml(couponLabel(cp).replace(/ de desconto$/, "")) + (couponUntil(cp) ? " até " + couponUntil(cp) : "") + " — o código está na página.</p>" : "") +
        '<div class="vt-card-row">' + priceHTML(p) + '<span class="vt-go">' + (cp ? "Pegar cupom" : "Ver produto") + ' <i aria-hidden="true">→</i></span></div>' +
      "</div>" +
    "</a>"
  );
}

// Primeiro desenha o esqueleto; depois, os cards (loadItems devolve a lista).
export function renderListShell(root) {
  root.innerHTML =
    '<section class="vt-hero">' +
      '<div><span class="vt-eyebrow">Produtos digitais</span><h1>Templates pra organizar a vida <em>por aqui</em></h1>' +
      "<p>Acesso imediato depois da compra, sem espera e sem plataforma no meio. Feitos por quem já passou pela mesma bagunça.</p></div>" +
      '<div class="vt-promise">' +
        "<div>" + ICON.bolt + "Acesso liberado logo depois do pagamento</div>" +
        "<div>" + ICON.once + "Compra única, sem assinatura</div>" +
        "<div>" + ICON.lock + "Pagamento seguro pelo Stripe</div>" +
      "</div>" +
    "</section>" +
    '<section class="vt-grid" id="vt-grid" aria-label="Lista de produtos digitais" aria-busy="true">' + skeletonCards(2) + "</section>" +
    '<div id="vt-combo-teaser"></div>' +
    '<div class="vt-section-t"><h2>Como funciona</h2></div>' +
    '<div class="vt-steps">' +
      '<div class="vt-step"><span class="n">1</span><b>Escolha e pague</b><p>Pelo Stripe, com cartão ou Link.</p></div>' +
      '<div class="vt-step"><span class="n">2</span><b>Receba na hora</b><p>O acesso é liberado logo depois do pagamento.</p></div>' +
      '<div class="vt-step"><span class="n">3</span><b>Use do seu jeito</b><p>A cópia é sua, sem mensalidade.</p></div>' +
    "</div>" +
    '<div class="vt-section-t"><h2>Perguntas frequentes</h2></div>' +
    faqHTML([
      { q: "Preciso pagar alguma assinatura?", a: "Não. É compra única. Os templates funcionam nas versões gratuitas do Google Sheets e do Notion." },
      { q: "Posso pedir reembolso?", a: "Não. Por ser um produto digital de entrega imediata, a compra é final — não fazemos reembolso nem devolução depois que o acesso é liberado." }
    ]);
  initFaq(root);
}

export function renderListItems(root, items) {
  const grid = root.querySelector("#vt-grid");
  const list = activeItems(items);
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : '<p class="vt-muted">Nenhum produto disponível agora. Volte em breve!</p>';
  // Combo em destaque: só quando algum produto tem combo de verdade (bundleWith).
  const teaser = root.querySelector("#vt-combo-teaser");
  const host = list.find((p) => bundleOf(p, items).length);
  if (!host) { teaser.innerHTML = ""; return; }
  const combo = [host].concat(bundleOf(host, items));
  const calc = bundlePrice(combo);
  teaser.innerHTML =
    '<a class="vt-combo-teaser" href="' + productHref(host.slug) + '#vt-combo">' +
      '<div class="vt-stack">' + combo.slice(0, 3).map((it) => (it.image ? '<img src="' + escapeHtml(it.image) + '" alt="">' : "")).join("") + "</div>" +
      "<div><h3>Leve " + (combo.length === 2 ? "os dois" : "os " + combo.length) + " e pague menos</h3><p>" + combo.map((it) => escapeHtml(it.title)).join(" + ") + ". O desconto de combo entra sozinho.</p></div>" +
      '<span class="vt-price"><b>' + formatPrice(calc.finalPrice) + "</b><s>" + formatPrice(calc.sum) + "</s></span>" +
      '<span class="vt-go" style="color:#fff">Ver combo <i aria-hidden="true">→</i></span>' +
    "</a>";
}

// ============================================================ produto ====
function normalizeGallery(p) {
  const items = (p.gallery || []).filter((g) => (g.type === "Vídeo" && g.videoUrl) || (g.type !== "Vídeo" && g.image));
  if (items.length) return items;
  return [{ type: "Foto", image: p.image || "", caption: "" }];
}
function mediaHTML(item, alt) {
  if (item.type === "Vídeo") {
    const url = item.videoUrl || "";
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/);
    if (yt) return '<iframe src="https://www.youtube-nocookie.com/embed/' + yt[1] + '" title="' + escapeHtml(item.caption || alt) + '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return '<iframe src="https://player.vimeo.com/video/' + vm[1] + '" title="' + escapeHtml(item.caption || alt) + '" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    return '<video src="' + escapeHtml(url) + '" controls playsinline preload="metadata"></video>';
  }
  if (!item.image) return "";
  return '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.caption || alt) + '">';
}
function galleryHTML(gallery, title) {
  const many = gallery.length > 1;
  return (
    '<div class="vt-gal">' +
      '<div class="vt-gal-view' + (many ? " has-many" : "") + '" tabindex="0" aria-roledescription="carrossel" aria-label="Fotos do produto">' +
        '<div class="vt-gal-track">' + gallery.map((g) => "<figure>" + mediaHTML(g, title) + (g.caption ? "<figcaption>" + escapeHtml(g.caption) + "</figcaption>" : "") + "</figure>").join("") + "</div>" +
        (many ? '<button type="button" class="vt-gal-nav is-prev" aria-label="Foto anterior">‹</button><button type="button" class="vt-gal-nav is-next" aria-label="Próxima foto">›</button>' +
          '<div class="vt-dots" aria-hidden="true">' + gallery.map(() => "<i></i>").join("") + "</div>" +
          '<span class="vt-swipe-hint" aria-hidden="true">↔ Arraste pro lado</span>' : "") +
      "</div>" +
      (many ? '<div class="vt-thumbs">' + gallery.map((g, i) =>
        '<button type="button" data-gi="' + i + '" aria-label="' + (g.type === "Vídeo" ? "Vídeo" : "Foto " + (i + 1)) + '">' +
        (g.type === "Vídeo" ? "▶" : g.image ? '<img src="' + escapeHtml(g.image) + '" alt="">' : "") + "</button>").join("") + "</div>" : "") +
    "</div>"
  );
}
function initGallery(root, n) {
  const view = root.querySelector(".vt-gal-view"), track = root.querySelector(".vt-gal-track");
  if (!view || n < 2) return;
  let i = 0;
  function go(k) {
    i = Math.max(0, Math.min(n - 1, k));
    track.style.transform = "translateX(" + (-100 * i) + "%)";
    root.querySelectorAll(".vt-dots i").forEach((d, j) => d.classList.toggle("is-on", j === i));
    root.querySelectorAll(".vt-thumbs button").forEach((b, j) => b.classList.toggle("is-on", j === i));
    root.querySelector(".vt-gal-nav.is-prev").disabled = i === 0;
    root.querySelector(".vt-gal-nav.is-next").disabled = i === n - 1;
  }
  go(0);
  let sx = null, dx = 0, w = 1;
  view.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".vt-gal-nav") || e.pointerType === "mouse" && e.button !== 0) return;
    sx = e.clientX; dx = 0; w = view.clientWidth; track.classList.add("is-drag");
  });
  view.addEventListener("pointermove", (e) => {
    if (sx == null) return;
    dx = e.clientX - sx;
    if (Math.abs(dx) > 6 && !view.hasPointerCapture(e.pointerId)) view.setPointerCapture(e.pointerId);
    track.style.transform = "translateX(calc(" + (-100 * i) + "% + " + dx + "px))";
  });
  function end() {
    if (sx == null) return;
    track.classList.remove("is-drag");
    go(Math.abs(dx) > w * 0.18 ? i + (dx < 0 ? 1 : -1) : i);
    sx = null;
  }
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  view.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(i + 1); if (e.key === "ArrowLeft") go(i - 1); });
  root.querySelector(".vt-gal-nav.is-prev").addEventListener("click", () => go(i - 1));
  root.querySelector(".vt-gal-nav.is-next").addEventListener("click", () => go(i + 1));
  root.querySelectorAll(".vt-thumbs button").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.gi))));
}

function starString(r) {
  const n = Math.max(0, Math.min(5, Math.round(r)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function renderProduct(root, p, items) {
  const gallery = normalizeGallery(p);
  const combo = bundleOf(p, items);
  const top3 = (p.features || []).filter(Boolean).slice(0, 3);
  document.title = p.title + " — Por Dentro";

  root.innerHTML =
    '<nav class="vt-crumb" aria-label="Você está em"><a href="/produtos-digitais/">Produtos digitais</a><span aria-hidden="true">›</span><span>' + escapeHtml(p.title) + "</span></nav>" +
    '<section class="vt-pdp">' +
      galleryHTML(gallery, p.title) +
      '<div class="vt-buy" id="vt-buy">' +
        (p.kicker ? '<span class="vt-eyebrow">' + escapeHtml(p.kicker) + "</span>" : "") +
        "<h1>" + escapeHtml(p.title) + "</h1>" +
        (p.summary ? '<p class="vt-promise-line">' + escapeHtml(p.summary) + "</p>" : "") +
        '<div id="vt-rating-slot"></div>' +
        '<div id="vt-price">' + priceHTML(p) + "</div>" +
        (activeCoupon(p) ? couponBandHTML(p, activeCoupon(p)) : "") +
        (p.launchNote ? '<div class="vt-launch"><i aria-hidden="true"></i>' + escapeHtml(p.launchNote) + "</div>" : "") +
        (top3.length ? '<ul class="vt-top3">' + top3.map((f) => "<li>" + escapeHtml(f) + "</li>").join("") + "</ul>" : "") +
        '<label class="vt-gate" id="vt-gate"><input type="checkbox" id="vt-gatebox"><span class="vt-box" aria-hidden="true">' + ICON.check + "</span>" +
          "<span>Entendo que o acesso ao arquivo é imediato e renuncio ao meu direito de retratação de 14 dias.</span></label>" +
        '<p class="vt-gate-msg" id="vt-gatemsg" role="alert"></p>' +
        '<button type="button" class="vt-btn is-block" id="vt-buy-btn" aria-disabled="true">Comprar agora · ' + formatPrice(p.price) + ' <span class="vt-arrow" aria-hidden="true">→</span></button>' +
        '<div class="vt-secure">' + ICON.lock + "Pagamento seguro pelo Stripe · acesso na hora</div>" +
      "</div>" +
    "</section>" +
    '<section class="vt-trust" aria-label="Garantias da compra">' +
      "<div>" + ICON.bolt + "<p style=\"margin:0\"><b>Entrega imediata</b><span>Acesso liberado na hora</span></p></div>" +
      "<div>" + ICON.once + "<p style=\"margin:0\"><b>Compra única</b><span>Sem assinatura</span></p></div>" +
      "<div>" + ICON.shield + "<p style=\"margin:0\"><b>" + (p.guaranteeDays ? "Garantia " + p.guaranteeDays + " dias" : "Compra final") + "</b><span>" + (p.guaranteeDays ? "Devolução sem burocracia" : "Sem reembolso após o acesso") + "</span></p></div>" +
      "<div>" + ICON.lock + "<p style=\"margin:0\"><b>Pagamento seguro</b><span>Processado via Stripe</span></p></div>" +
    "</section>" +
    '<section class="vt-two">' +
      (p.description ? '<div class="vt-desc"><div class="vt-section-t"><h2>Sobre o produto</h2></div><p>' + escapeHtml(p.description) + "</p></div>" : "<div></div>") +
      ((p.features || []).length ? '<div><div class="vt-section-t"><h2>O que você recebe</h2></div><ol class="vt-inc-list">' + p.features.filter(Boolean).map((f, i) => "<li><b>" + (i + 1) + "</b>" + escapeHtml(f) + "</li>").join("") + "</ol></div>" : "") +
    "</section>" +
    (combo.length ?
      '<section class="vt-combo" id="vt-combo"><div class="vt-section-t" style="margin:0"><h2>Complete o combo</h2><span class="vt-muted" style="font-size:13px">10% com 2 · 15% com 3 · 20% com 4+</span></div>' +
        '<div class="vt-combo-items">' +
          '<div class="vt-ci is-on is-fixed">' + (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : "") + '<span class="t">' + escapeHtml(p.title) + "<small>Este produto</small></span><span>" + formatPrice(p.price) + '</span><span class="vt-tick" aria-hidden="true">' + ICON.check + "</span></div>" +
          combo.map((o) => '<button type="button" class="vt-ci is-on" data-combo="' + escapeHtml(o.slug) + '" aria-pressed="true">' + (o.image ? '<img src="' + escapeHtml(o.image) + '" alt="">' : "") + '<span class="t">' + escapeHtml(o.title) + "<small>" + escapeHtml(o.kicker || "") + "</small></span><span>" + formatPrice(o.price) + '</span><span class="vt-tick" aria-hidden="true">' + ICON.check + "</span></button>").join("") +
        "</div>" +
        '<div class="vt-combo-foot"><div id="vt-combo-price"></div><div id="vt-combo-links"></div></div>' +
        '<p class="vt-muted" style="font-size:12.5px;margin:10px 0 0">Por enquanto, cada produto tem o próprio pagamento: o valor do combo mostra quanto você economiza levando juntos.</p>' +
      "</section>" : "") +
    '<section class="vt-rev" id="vt-avaliacoes" aria-label="Avaliações">' +
      '<div class="vt-rev-sum" id="vt-rev-sum"><div class="vt-muted" style="font-size:13px">Carregando avaliações…</div></div>' +
      '<div><div id="vt-rev-list" class="vt-rev-list"></div>' +
        '<button type="button" class="vt-btn is-ghost" id="vt-rf-toggle" style="margin-top:12px;min-height:42px">Escrever uma avaliação</button>' +
        '<div class="vt-rf" id="vt-rf" hidden>' +
          '<span class="vt-eyebrow" style="color:var(--vt-muted)">Sua nota</span>' +
          '<div class="vt-rf-stars" role="radiogroup" aria-label="Sua nota">' + [1, 2, 3, 4, 5].map((i) => '<button type="button" role="radio" aria-checked="false" aria-label="' + i + ' estrela' + (i > 1 ? "s" : "") + '" data-star="' + i + '">★</button>').join("") + "</div>" +
          '<input type="text" id="vt-rf-name" placeholder="Seu nome" maxlength="80" autocomplete="given-name">' +
          '<textarea id="vt-rf-comment" placeholder="Conte como foi usar o produto…" maxlength="600"></textarea>' +
          '<input type="text" id="vt-rf-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">' +
          '<button type="button" class="vt-btn" id="vt-rf-send" style="align-self:flex-start;min-height:42px">Enviar avaliação</button>' +
          '<p class="vt-rf-msg" id="vt-rf-msg" role="status"></p>' +
          '<p class="vt-muted" style="font-size:12px;margin:0">As avaliações passam por aprovação antes de aparecer na página.</p>' +
        "</div>" +
      "</div>" +
    "</section>" +
    ((p.faq || []).filter((f) => f.q).length ? '<div class="vt-section-t"><h2>Perguntas frequentes</h2></div>' + faqHTML(p.faq.filter((f) => f.q)) : "");

  initGallery(root, gallery.length);
  initFaq(root);
  initBuy(root, p);
  initCombo(root, p, combo);
  initReviews(root, p.slug);
  initSticky(root, p);
}

function initBuy(root, p) {
  const box = root.querySelector("#vt-gatebox"), gate = root.querySelector("#vt-gate"), msg = root.querySelector("#vt-gatemsg");
  const buttons = [root.querySelector("#vt-buy-btn")];
  function sync() {
    buttons.forEach((b) => b && b.id === "vt-buy-btn" && b.setAttribute("aria-disabled", String(!box.checked)));
    if (box.checked) { gate.classList.remove("is-err"); msg.textContent = ""; }
  }
  box.addEventListener("change", sync);
  function attempt(btn) {
    if (!box.checked) {
      gate.classList.remove("is-err");
      void gate.offsetWidth; // reinicia a animação de balançar
      gate.classList.add("is-err");
      msg.textContent = "⚠ Marque a caixa acima pra liberar o pagamento.";
      gate.scrollIntoView({ behavior: "smooth", block: "center" });
      box.focus({ preventScroll: true });
      return;
    }
    if (!p.stripeLink) {
      msg.textContent = "O pagamento deste produto ainda não está disponível. Me chama no Instagram que eu te ajudo.";
      return;
    }
    if (IS_PREVIEW) { toast("Na prévia do /admin o pagamento não abre."); return; }
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    window.location.href = checkoutUrl(p);
    // Se a pessoa voltar pelo "voltar" do navegador, o botão não fica girando.
    window.addEventListener("pageshow", () => { btn.classList.remove("is-loading"); btn.removeAttribute("aria-busy"); }, { once: true });
  }
  root.addEventListener("click", (e) => {
    const cpy = e.target.closest("[data-copy]");
    if (cpy) {
      const code = cpy.getAttribute("data-copy");
      const l = cpy.querySelector("[data-copy-label]");
      const done = (ok) => {
        if (l) l.textContent = ok ? "Copiado ✓" : "Selecione e copie";
        cpy.classList.toggle("is-copied", ok);
        if (ok) toast("Cupom " + code + " copiado");
        setTimeout(() => { if (l) l.textContent = "Copiar"; cpy.classList.remove("is-copied"); }, 2400);
      };
      const fallback = () => {
        const ta = document.createElement("textarea");
        ta.value = code; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        ta.remove();
        done(ok);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => done(true), fallback);
      else fallback();
      return;
    }
    const b = e.target.closest("#vt-buy-btn, #vt-sticky-btn");
    if (b) attempt(b);
  });
  root._vtAttempt = attempt;
  sync();
}

function initCombo(root, p, combo) {
  if (!combo.length) return;
  const on = {};
  combo.forEach((o) => { on[o.slug] = true; });
  const priceEl = root.querySelector("#vt-combo-price"), linksEl = root.querySelector("#vt-combo-links");
  function draw(bump) {
    const chosen = [p].concat(combo.filter((o) => on[o.slug]));
    const c = bundlePrice(chosen);
    priceEl.innerHTML = chosen.length > 1
      ? '<span class="vt-price"><b class="' + (bump ? "is-bump" : "") + '">' + formatPrice(c.finalPrice) + "</b><s>" + formatPrice(c.sum) + '</s><span class="vt-badge is-off">−' + c.pct + "%</span></span>"
      : '<span class="vt-muted" style="font-size:13.5px">Marque outro produto pra montar o combo.</span>';
    linksEl.innerHTML = chosen.slice(1).map((o) => '<a href="' + productHref(o.slug) + '">Ver ' + escapeHtml(o.title) + " →</a>").join("<br>");
    if (bump) setTimeout(() => { const b = priceEl.querySelector(".is-bump"); if (b) b.classList.remove("is-bump"); }, 260);
  }
  root.querySelectorAll("[data-combo]").forEach((b) => {
    b.addEventListener("click", () => {
      const s = b.dataset.combo;
      on[s] = !on[s];
      b.classList.toggle("is-on", on[s]);
      b.setAttribute("aria-pressed", String(on[s]));
      draw(true);
      toast(on[s] ? "Adicionado ao combo" : "Tirado do combo");
    });
  });
  draw(false);
}

async function initReviews(root, slug) {
  const sum = root.querySelector("#vt-rev-sum"), list = root.querySelector("#vt-rev-list"), slot = root.querySelector("#vt-rating-slot");
  let data = { summary: { count: 0, average: 0, distribution: {} }, reviews: [] };
  try {
    const res = await fetch(WORKER_BASE + "/api/reviews?slug=" + encodeURIComponent(slug));
    if (res.ok) data = await res.json();
  } catch (e) {
    // Worker fora do ar: mostra o estado vazio, sem quebrar a página.
  }
  const s = data.summary || { count: 0, average: 0, distribution: {} };
  const avg = Number(s.average || 0).toFixed(1).replace(".", ",");
  if (s.count) {
    slot.innerHTML = '<button type="button" class="vt-rating" id="vt-rating"><span class="vt-stars" aria-hidden="true">' + starString(s.average) + '</span><b style="color:var(--grafite)">' + avg + "</b><u>" + s.count + " avaliaç" + (s.count > 1 ? "ões" : "ão") + "</u></button>";
    slot.querySelector("#vt-rating").addEventListener("click", () => root.querySelector("#vt-avaliacoes").scrollIntoView({ behavior: "smooth", block: "start" }));
    sum.innerHTML = '<div class="vt-rev-big">' + avg + '</div><div class="vt-stars" aria-label="' + avg + ' de 5">' + starString(s.average) + '</div><div class="vt-muted" style="font-size:13px">' + s.count + " avaliaç" + (s.count > 1 ? "ões" : "ão") + "</div>" +
      '<div class="vt-dist">' + [5, 4, 3, 2, 1].map((st) => { const n = (s.distribution || {})[st] || 0; return "<div><span>" + st + '★</span><i style="--w:' + (s.count ? (n / s.count) * 100 : 0) + '%"></i><span>' + n + "</span></div>"; }).join("") + "</div>";
  } else {
    sum.innerHTML = '<div class="vt-rev-big" style="font-size:30px">Novo por aqui</div><div class="vt-muted" style="font-size:13px;margin-top:6px">Ainda sem avaliações. Seja a primeira pessoa a contar como foi.</div>';
  }
  list.innerHTML = (data.reviews || []).length
    ? data.reviews.map((r) =>
        '<article class="vt-rv"><header><span class="vt-av">' + escapeHtml((r.name || "?").trim().charAt(0).toUpperCase()) + "</span><div><b>" + escapeHtml(r.name) +
        '</b><div class="vt-stars" style="font-size:12px" aria-label="' + r.rating + ' estrelas">' + starString(r.rating) + "</div></div><small>" + new Date(r.createdAt).toLocaleDateString("pt-BR") + "</small></header><p>" + escapeHtml(r.comment) + "</p></article>").join("")
    : '<div class="vt-rev-empty">Os comentários aparecem aqui assim que forem aprovados.</div>';

  // formulário de avaliação (mesma API de sempre: POST /api/reviews)
  const toggle = root.querySelector("#vt-rf-toggle"), form = root.querySelector("#vt-rf"), msg = root.querySelector("#vt-rf-msg");
  const stars = Array.from(root.querySelectorAll(".vt-rf-stars button"));
  let rating = 0;
  toggle.addEventListener("click", () => { form.hidden = !form.hidden; if (!form.hidden) stars[0].focus(); });
  stars.forEach((b, i) => b.addEventListener("click", () => {
    rating = i + 1;
    stars.forEach((x, j) => { x.classList.toggle("is-on", j <= i); x.setAttribute("aria-checked", String(j === i)); });
  }));
  const send = root.querySelector("#vt-rf-send");
  send.addEventListener("click", async () => {
    const name = root.querySelector("#vt-rf-name").value.trim(), comment = root.querySelector("#vt-rf-comment").value.trim();
    msg.className = "vt-rf-msg";
    if (!rating || !name || !comment) {
      msg.classList.add("is-err");
      msg.textContent = !rating ? "Escolha uma nota de 1 a 5 estrelas." : !name ? "Escreva seu nome." : "Conte em poucas palavras como foi usar o produto.";
      return;
    }
    if (IS_PREVIEW) { msg.classList.add("is-ok"); msg.textContent = "Na prévia do /admin a avaliação não é enviada."; return; }
    send.classList.add("is-loading");
    try {
      const res = await fetch(WORKER_BASE + "/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, rating, comment, hp: root.querySelector("#vt-rf-hp").value })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "");
      msg.classList.add("is-ok");
      msg.textContent = "✓ Recebemos sua avaliação. Ela aparece aqui assim que for aprovada.";
      root.querySelector("#vt-rf-name").value = "";
      root.querySelector("#vt-rf-comment").value = "";
      rating = 0;
      stars.forEach((x) => { x.classList.remove("is-on"); x.setAttribute("aria-checked", "false"); });
    } catch (e) {
      msg.classList.add("is-err");
      msg.textContent = e.message || "Não foi possível enviar agora. Tente de novo em alguns minutos.";
    }
    send.classList.remove("is-loading");
  });
}

function initSticky(root, p) {
  const bar = document.createElement("div");
  bar.className = "vt-sticky vt";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = '<div class="t"><small>' + escapeHtml(p.title) + "</small>" + priceHTML(p) + '</div><button type="button" class="vt-btn" id="vt-sticky-btn" tabindex="-1">Comprar</button>';
  document.body.appendChild(bar);
  document.body.classList.add("has-vt-sticky");
  bar.querySelector("button").addEventListener("click", () => {
    // Leva até a caixa de retratação: ela precisa ser marcada antes de pagar.
    root._vtAttempt(root.querySelector("#vt-buy-btn"));
  });
  const target = root.querySelector("#vt-buy-btn");
  if (!window.IntersectionObserver) return;
  new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const show = !en.isIntersecting && en.boundingClientRect.top < 0;
      bar.classList.toggle("is-show", show);
      bar.setAttribute("aria-hidden", String(!show));
      bar.querySelector("button").tabIndex = show ? 0 : -1;
    });
  }).observe(target);
}

// ============================================================ confirmada ==
function confettiHTML() {
  const cols = ["#577328", "#DEB975", "#604034", "#8AACD2", "#BB9351"];
  let h = '<div class="vt-confetti" aria-hidden="true">';
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() * 2 - 1) * 260, y = 120 + Math.random() * 260;
    h += '<i style="background:' + cols[i % 5] + ";--x:" + x.toFixed(0) + "px;--y:" + y.toFixed(0) + "px;--r:" + (Math.random() * 540).toFixed(0) + "deg;animation-delay:" + (0.25 + Math.random() * 0.3).toFixed(2) + 's"></i>';
  }
  return h + "</div>";
}

// p pode faltar (produto que não está no catálogo); extra = html depois do título.
export function renderConfirm(root, p, opts) {
  opts = opts || {};
  const steps = (p && p.nextSteps || []).filter((s) => s && s.title);
  const key = "pd-next-" + (p ? p.slug : "x");
  let done = [];
  try { done = JSON.parse(sessionStorage.getItem(key) || "[]"); } catch (e) {}
  function draw() {
    const k = steps.filter((_, i) => done[i]).length;
    root.innerHTML =
      '<section class="vt-done">' + confettiHTML() +
        '<div class="vt-done-check">' + ICON.check + "</div>" +
        '<span class="vt-eyebrow">Pagamento confirmado' + (opts.amount != null ? " · " + formatPrice(opts.amount) : "") + "</span>" +
        "<h1>" + (p ? "Pronto! " + escapeHtml(p.title) + " é seu." : "Pronto! Sua compra foi confirmada.") + "</h1>" +
        '<p class="lead">' + (opts.lead || (steps.length ? "Siga os passos abaixo pra começar." : "O acesso chega do jeito combinado na hora da compra. Qualquer dúvida, é só chamar no Instagram.")) + "</p>" +
        (opts.cta || "") +
        (steps.length ?
          '<div class="vt-next"><b style="font-size:15px">Seus próximos passos</b><div class="vt-next-bar" aria-hidden="true"><i style="--p:' + (k / steps.length) * 100 + '%"></i></div>' +
          '<div class="vt-muted" style="font-size:12.5px;margin-bottom:6px">' + k + " de " + steps.length + " feitos</div>" +
          steps.map((s, i) => '<button type="button" class="vt-ns' + (done[i] ? " is-ok" : "") + '" data-ns="' + i + '" aria-pressed="' + !!done[i] + '"><span class="c" aria-hidden="true">' + ICON.check + "</span><span><b>" + escapeHtml(s.title) + "</b>" + (s.text ? "<span>" + escapeHtml(s.text) + "</span>" : "") + "</span></button>").join("") +
          "</div>" : "") +
        '<div class="vt-actions"><a class="vt-btn is-ghost" href="/produtos-digitais/">Ver outros produtos</a></div>' +
      "</section>";
    root.querySelectorAll("[data-ns]").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.ns);
      done[i] = !done[i];
      try { sessionStorage.setItem(key, JSON.stringify(done)); } catch (e) {}
      draw();
      root.querySelector(".vt-confetti").remove();
      root.querySelector(".vt-done-check").style.animation = "none";
      if (steps.every((_, j) => done[j])) toast("Tudo pronto! Aproveite.");
    }));
  }
  draw();
}

// ============================================================ prévia =====
// Dentro da prévia do /admin, rolar até a parte que está sendo editada é
// feito em assets/js/render.js (vale pra todas as páginas).
