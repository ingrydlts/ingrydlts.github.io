// Por Dentro — animações de entrada nos artigos, mesma linguagem de movimento
// já usada na home (assets/js/scroll-animations.js): texto em cascata leve,
// imagens assentam com um leve zoom-out, blocos do corpo revelam em stagger
// conforme entram na tela. Como o conteúdo do artigo é montado via fetch
// assíncrono (ver /artigos/post/index.html), este script expõe uma função
// que o template chama depois de preencher o DOM — não roda sozinho em
// DOMContentLoaded, porque nesse momento o artigo ainda não existe na página.
//
// Rede de segurança: se a aba estiver em segundo plano (ou qualquer outro
// motivo impedir o tween de terminar), o navegador pode pausar/atrasar a
// animação por tempo indefinido — e como o conteúdo começa com opacity:0,
// isso deixaria o artigo invisível pra sempre. Por isso, depois de um tempo
// curto, força todo mundo pra opacity:1 independente do estado da animação.
(function () {
  "use strict";

  function ready() {
    return typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function initArticleAnimations() {
    var animatedEls = [];

    if (!ready() || reducedMotion()) return;
    gsap.registerPlugin(ScrollTrigger);

    // Cabeçalho: eyebrow → título → meta → "atualizado em", em cascata leve.
    var headerParts = [
      document.querySelector(".article-header .eyebrow"),
      document.querySelector(".article-header h1"),
      document.querySelector(".article-header .article-meta"),
      document.querySelector(".article-updated")
    ].filter(Boolean);
    if (headerParts.length) {
      animatedEls = animatedEls.concat(headerParts);
      gsap.from(headerParts, { opacity: 0, y: 18, duration: 0.55, ease: "power2.out", stagger: 0.08 });
    }

    // Foto de capa: assenta com leve zoom-out, como na home.
    var hero = document.querySelector(".article-hero");
    if (hero) {
      animatedEls.push(hero);
      gsap.from(hero, { opacity: 0, y: 16, scale: 1.03, duration: 0.7, ease: "power3.out", delay: 0.15 });
    }

    // Corpo do artigo: cada bloco (título de seção, parágrafo, lista, banner,
    // ferramenta embutida...) revela em stagger conforme entra na tela.
    var blocks = document.querySelectorAll(
      ".article-body > *, .in-article-banner, .buy-box, .related > *"
    );
    if (blocks.length) {
      animatedEls = animatedEls.concat(Array.prototype.slice.call(blocks));
      gsap.set(blocks, { opacity: 0, y: 22 });
      ScrollTrigger.batch(blocks, {
        start: "top 88%",
        once: true,
        onEnter: function (els) {
          gsap.to(els, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", stagger: 0.08, overwrite: true });
        }
      });
    }

    ScrollTrigger.refresh();

    // Rede de segurança (ver comentário no topo do arquivo).
    if (animatedEls.length) {
      setTimeout(function () {
        gsap.set(animatedEls, { clearProps: "opacity,transform" });
      }, 2500);
    }
  }

  window.initArticleAnimations = initArticleAnimations;
})();
