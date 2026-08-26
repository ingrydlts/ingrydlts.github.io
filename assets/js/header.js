// Por Dentro — cabeçalho e rodapé controlados pelo /admin.
//
// O HTML de cada página já traz o menu completo (cabeçalho e rodapé de
// navegação), hardcoded, como estado "seguro": se este script falhar ou a
// rede estiver lenta, o site continua funcionando com o menu padrão. Este
// módulo só ajusta o que já está na página, a partir de três fontes
// editáveis no /admin, em "Cabeçalho e rodapé (menu do site)":
//
//   - content/header-config.json — liga/desliga, renomeia ou reaponta cada
//     link do menu. O mesmo link aparece no cabeçalho E no rodapé.
//   - content/nav-visibility.json — liga/desliga o cabeçalho e o rodapé por
//     categoria de página (Home, Produtos, Blog, Institucional) — o
//     "select all / unselect all" pedido — e, se precisar, por página
//     individual (sobrepõe a categoria).
//   - content/posts.json (campos "headerMode"/"footerMode" de cada artigo)
//     — sobrepõe a categoria Blog pra um artigo específico, ex. transformar
//     um artigo numa landing page isolada antes do site lançar.
import { fetchJSON } from "/assets/js/render.js";

// Páginas que não são artigo de blog: caminho -> { key, category }. As
// chaves batem com content/nav-visibility.json (blocos "pages" e
// "categories"). Artigos de blog não entram aqui — eles são resolvidos por
// slug/URL direto em content/posts.json, na categoria "blog".
var PAGE_REGISTRY = {
  "/": { key: "home", category: "home" },
  "/produtos-digitais/": { key: "produtos-digitais", category: "produtos" },
  "/produtos-digitais/produto/": { key: "produtos-digitais-produto", category: "produtos" },
  "/produtos-de-estudo/": { key: "produtos-de-estudo", category: "produtos" },
  "/produtos-de-compras/": { key: "produtos-de-compras", category: "produtos" },
  "/sobre/": { key: "sobre", category: "institucional" },
  "/cgv/": { key: "cgv", category: "institucional" },
  "/confidentialite/": { key: "confidentialite", category: "institucional" },
  "/mentions-legales/": { key: "mentions-legales", category: "institucional" },
  "/artigos/": { key: "artigos", category: "blog" },
  "/artigos/post/": { key: "artigos-post-template", category: "blog" },
  "/artigos/assinatura-confirmada/": { key: "artigos-assinatura-confirmada", category: "blog" }
};

function normalizedPath() {
  return window.location.pathname.replace(/index\.html$/, "");
}

function applyLinks(links) {
  document.querySelectorAll("[data-nav-key]").forEach(function (a) {
    var cfg = links[a.dataset.navKey];
    if (!cfg || cfg.enabled === false) {
      a.remove();
      return;
    }
    if (cfg.label) a.textContent = cfg.label;
    if (cfg.href) a.setAttribute("href", cfg.href);
  });
}

function hideHeaderNav() {
  document.querySelectorAll("[data-header-nav]").forEach(function (nav) {
    nav.innerHTML = "";
  });
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) toggle.style.display = "none";
}

function hideFooterNav() {
  document.querySelectorAll("[data-footer-nav]").forEach(function (block) {
    block.remove();
  });
}

// Artigos no template dinâmico (/artigos/post/?slug=) não têm URL própria
// no pathname — identifica o post pelo slug na querystring nesse caso;
// nas páginas de artigo com URL própria, casa pelo pathname.
function findCurrentPost(posts) {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get("slug");
  if (slug) return posts.find(function (p) { return p.slug === slug; }) || null;
  var path = normalizedPath();
  return posts.find(function (p) { return p.url && p.url.replace(/index\.html$/, "") === path; }) || null;
}

// "categoria" (ou vazio) segue o interruptor mestre da categoria;
// "ativado"/"desativado" sobrepõe, só pra essa página.
function resolveMode(pageMode, category, visibility, field) {
  if (pageMode === "ativado") return true;
  if (pageMode === "desativado") return false;
  var cat = visibility && visibility.categories && visibility.categories[category];
  return cat ? cat[field] !== false : true;
}

(async function init() {
  var configPromise = fetchJSON("/content/header-config.json").catch(function () { return null; });
  var visibilityPromise = fetchJSON("/content/nav-visibility.json").catch(function () { return null; });
  var postsPromise = fetchJSON("/content/posts.json").catch(function () { return null; });
  var config = await configPromise;
  var visibility = await visibilityPromise;
  var postsData = await postsPromise;
  var posts = postsData && Array.isArray(postsData.items) ? postsData.items : [];

  var registryEntry = PAGE_REGISTRY[normalizedPath()];

  var category, headerMode, footerMode;
  if (registryEntry) {
    category = registryEntry.category;
    var pageCfg = visibility && visibility.pages && visibility.pages[registryEntry.key];
    headerMode = (pageCfg && pageCfg.header) || "categoria";
    footerMode = (pageCfg && pageCfg.footer) || "categoria";
  } else {
    var post = findCurrentPost(posts);
    category = "blog";
    headerMode = (post && post.headerMode) || "categoria";
    footerMode = (post && post.footerMode) || "categoria";
  }

  if (config && config.links) applyLinks(config.links);
  if (!resolveMode(headerMode, category, visibility, "header")) hideHeaderNav();
  if (!resolveMode(footerMode, category, visibility, "footer")) hideFooterNav();
})();
