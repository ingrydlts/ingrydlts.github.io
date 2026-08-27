// Por Dentro — anúncios nos artigos (rede + banner próprio), posições
// definidas em /admin ("Anúncios nos artigos"). Duas fontes possíveis por
// posição, escolhidas manualmente lá — nunca as duas competindo no mesmo
// lugar:
//   "own"     — banner promovendo produto próprio, sem cookies, aparece
//               independente de consentimento (mesma natureza do banner
//               in-article que já existia).
//   "network" — código de rede de anúncios (ex. AdSense), só carrega
//               depois do consentimento aceito (window.PDConsent).
//
// innerHTML não executa <script> — por isso o código de rede é montado via
// injectScript(), que recria os <script> como elementos de verdade.

import { fetchJSON, escapeHtml } from "/assets/js/render.js";

let cachedConfig = null;
export async function getAdsConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    cachedConfig = await fetchJSON("/content/ads-config.json");
  } catch (e) {
    cachedConfig = { enabled: false };
  }
  return cachedConfig;
}

export function ownBannerHTML(cfg) {
  const b = (cfg && cfg.ownBanner) || {};
  if (!b.title) return "";
  return (
    '<div class="ad-slot ad-slot-own" style="border-top:3px solid ' + escapeHtml(b.color || "var(--downtown-brown)") + ';">' +
    (b.kicker ? '<span class="eyebrow">' + escapeHtml(b.kicker) + "</span>" : "") +
    "<h3>" + escapeHtml(b.title) + "</h3>" +
    (b.body ? "<p>" + escapeHtml(b.body) + "</p>" : "") +
    (b.ctaHref ? '<a class="btn btn-pill" href="' + escapeHtml(b.ctaHref) + '">' + escapeHtml(b.ctaText || "Saiba mais") + "</a>" : "") +
    "</div>"
  );
}

export function networkPlaceholderHTML(positionKey) {
  return '<div class="ad-slot ad-slot-network" data-ad-mount="' + escapeHtml(positionKey) + '"><span class="ad-slot-label">Publicidade</span></div>';
}

// HTML de UMA posição, já resolvendo qual fonte usar (ou nada).
export function slotHTML(cfg, positionKey) {
  if (!cfg || !cfg.enabled) return "";
  const source = (cfg.positions || {})[positionKey];
  if (source === "own") return ownBannerHTML(cfg);
  if (source === "network") return networkPlaceholderHTML(positionKey);
  return "";
}

// Insere HTML em índices do array de blocos (markdownToBlocks), várias
// posições de uma vez, sem que uma inserção bagunce o índice da próxima —
// cada índice é sempre relativo ao array ORIGINAL, não ao HTML já montado.
export function insertAtIndices(blocks, insertions) {
  const sorted = insertions
    .filter((i) => i.html)
    .map((i) => ({ index: Math.min(Math.max(i.index, 0), blocks.length), html: i.html }))
    .sort((a, b) => a.index - b.index);
  let result = "";
  let cursor = 0;
  for (const { index, html } of sorted) {
    result += blocks.slice(cursor, index).join("") + html;
    cursor = index;
  }
  result += blocks.slice(cursor).join("");
  return result;
}

function runScripts(container) {
  container.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

let networkHeadLoaded = false;
function loadNetworkHead(cfg) {
  if (networkHeadLoaded || !cfg.network || !cfg.network.headSnippet) return;
  networkHeadLoaded = true;
  const wrap = document.createElement("div");
  wrap.innerHTML = cfg.network.headSnippet;
  wrap.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
    s.textContent = old.textContent;
    document.head.appendChild(s);
  });
}

function mountNetworkAds(cfg) {
  if (!window.PDConsent || !window.PDConsent.isGranted()) return;
  const mounts = document.querySelectorAll("[data-ad-mount]:not([data-ad-mounted])");
  if (!mounts.length) return;
  loadNetworkHead(cfg);
  mounts.forEach((el) => {
    el.setAttribute("data-ad-mounted", "1");
    el.insertAdjacentHTML("beforeend", cfg.network.adSnippet || "");
    runScripts(el);
  });
}

// Chamar depois que o HTML dos slots já estiver na página (inclusive
// reaproveitável depois que o consentimento mudar de recusado pra aceito,
// sem precisar recarregar a página).
export function activateNetworkAds(cfg) {
  if (!cfg || !cfg.enabled || !cfg.network || !cfg.network.adSnippet) return;
  mountNetworkAds(cfg);
  if (window.PDConsent) window.PDConsent.onChange(() => mountNetworkAds(cfg));
}
