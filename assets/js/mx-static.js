// Por Dentro — microengajamento nos artigos que têm página própria (HTML
// fixo em /artigos/post/<slug>/, campo "url" em content/posts.json).
//
// O texto dessas páginas não passa pelo editor do /admin, então os blocos
// de microengajamento delas ficam num campo à parte do artigo:
// "Blocos de microengajamento (página própria)" = mxBlocks. Mesmo formato
// do corpo ([[PRAZO]], [[QUIZ]], [[PROXIMO-PASSO]]…, ver MICROENGAJAMENTO.md).
//
// Onde entram: [[RESUMO]] e [[CONFIANCA]] logo depois do topo do artigo;
// o resto numa seção nova antes do FAQ (ou no fim, se não houver FAQ).
// Uso na página: <script type="module" src="/assets/js/mx-static.js" data-slug="slug"></script>
import { fetchJSON } from "/assets/js/render.js";
import { markdownToBlocks } from "/assets/js/markdown.js";

const me = document.querySelector('script[src$="/assets/js/mx-static.js"]');
const SLUG = (me && me.dataset.slug) || location.pathname.split("/").filter(Boolean).pop();

(async function () {
  let data;
  try { data = await fetchJSON("/content/posts.json"); } catch (e) { return; }
  const post = (data.items || []).find((p) => p.slug === SLUG);
  if (!post || !post.mxBlocks) return;
  const root = document.querySelector("main");
  if (!root) return;
  const html = markdownToBlocks(post.mxBlocks, { slug: SLUG });
  const top = [], rest = [];
  html.forEach((b) => (/data-mx="(resumo|confianca)"/.test(b) ? top : rest).push(b));

  const hero = root.querySelector(".rt-hero");
  const heroSection = hero ? hero.closest("section") || hero : null;
  if (top.length) {
    const wrap = document.createElement("div");
    wrap.className = "container mx-static mx-static-top";
    wrap.innerHTML = top.join("");
    if (heroSection && heroSection.parentNode) heroSection.parentNode.insertBefore(wrap, heroSection.nextSibling);
    else root.prepend(wrap);
  }
  if (rest.length) {
    const sec = document.createElement("section");
    sec.className = "section mx-static";
    sec.innerHTML = '<div class="mx-static-in">' + rest.join("") + "</div>";
    const faq = root.querySelector("#faq") || (root.querySelector(".rt-faq") && root.querySelector(".rt-faq").closest("section"));
    if (faq && faq.parentNode) faq.parentNode.insertBefore(sec, faq);
    else root.appendChild(sec);
  }
  document.dispatchEvent(new CustomEvent("pd:blocks-rendered"));
  const { init } = await import("/assets/js/microengajamento.js");
  init({ slug: SLUG, post: Object.assign({}, post, { sectionReactions: false }), posts: data.items.filter((p) => p.status === "publicado"), root: root });
})();
