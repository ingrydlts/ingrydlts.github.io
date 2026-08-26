// Por Dentro — cabeçalho controlado pelo /admin.
//
// O HTML de cada página já traz o menu completo, hardcoded, como estado
// "seguro": se este script falhar ou a rede estiver lenta, o site continua
// funcionando com o menu padrão. Este módulo só ajusta o que já está na
// página, a partir de duas fontes editáveis no /admin:
//
//   - content/header-config.json — liga/desliga, renomeia ou reaponta cada
//     link do menu, em TODAS as páginas do site.
//   - content/posts.json (campo "headerMode" de cada artigo) — sobrepõe o
//     menu de uma página de artigo específica, ex. "somente-logo" pra usar
//     o artigo como landing page antes do site lançar.
import { fetchJSON } from "/assets/js/render.js";

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

function hideAllNav() {
  document.querySelectorAll("[data-header-nav]").forEach(function (nav) {
    nav.innerHTML = "";
  });
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) toggle.style.display = "none";
}

// Artigos no template dinâmico (/artigos/post/?slug=) não têm URL própria
// no pathname — identifica o post pelo slug na querystring nesse caso;
// nas páginas de artigo com URL própria, casa pelo pathname.
function findCurrentPost(posts) {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get("slug");
  if (slug) return posts.find(function (p) { return p.slug === slug; }) || null;
  var path = window.location.pathname.replace(/index\.html$/, "");
  return posts.find(function (p) { return p.url && p.url.replace(/index\.html$/, "") === path; }) || null;
}

(async function init() {
  var configPromise = fetchJSON("/content/header-config.json").catch(function () { return null; });
  var postsPromise = fetchJSON("/content/posts.json").catch(function () { return null; });
  var config = await configPromise;
  var postsData = await postsPromise;

  var post = postsData && Array.isArray(postsData.items) ? findCurrentPost(postsData.items) : null;
  if (post && post.headerMode === "somente-logo") {
    hideAllNav();
    return;
  }

  if (config && config.links) applyLinks(config.links);
})();
