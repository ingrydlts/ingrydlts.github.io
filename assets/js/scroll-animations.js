// Por Dentro — animações de entrada na home, acionadas por scroll (GSAP ScrollTrigger).
(function () {
  "use strict";

  function ready() {
    return typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function initHomeScrollAnimations() {
    if (!ready() || reducedMotion()) return;
    gsap.registerPlugin(ScrollTrigger);

    // Hero: o texto lê primeiro (eyebrow → título → parágrafo, em cascata leve),
    // e a foto assenta por último com um leve zoom-out — a imagem chega depois
    // da leitura, como um respiro visual, não como concorrente do texto.
    var heroEyebrow = document.querySelector(".hero .eyebrow");
    var heroHeading = document.querySelector(".hero h1");
    var heroPara = document.querySelector(".hero p");
    var heroImage = document.querySelector("#hero-image");
    var heroTextParts = [heroEyebrow, heroHeading, heroPara].filter(Boolean);

    if (heroTextParts.length) {
      var heroTl = gsap.timeline({
        scrollTrigger: { trigger: heroTextParts[0], start: "top 90%", once: true }
      });
      heroTl.from(heroTextParts, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1
      });
      if (heroImage) {
        heroTl.from(heroImage, {
          opacity: 0,
          y: 20,
          scale: 1.04,
          duration: 0.8,
          ease: "power3.out"
        }, "-=0.35");
      }
    }

    // Cards de categoria: sobem em stagger e, ao pousar, a faixa de cor no
    // topo se revela da esquerda pra direita — a cor é a identidade de cada
    // categoria, então ela ganha o próprio momento em vez de só aparecer.
    var categoryGrid = document.querySelector('.grid.grid-3[aria-label="Categorias"]');
    var categoryCards = categoryGrid ? categoryGrid.querySelectorAll(".card") : [];
    if (categoryCards.length) {
      animateCardGrid(categoryCards, categoryGrid);
    }

    var blogHeader = document.querySelector('.section[aria-label="Últimos guias e artigos"] > div:first-child');
    if (blogHeader) {
      gsap.from(blogHeader, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: blogHeader, start: "top 85%", once: true }
      });
    }
  }

  // Stagger dos cards + revelação da faixa de cor superior (quando existir).
  function animateCardGrid(cards, triggerEl) {
    var bars = Array.prototype.map.call(cards, function (card) {
      return card.querySelector(":scope > div:first-child[style*='background']");
    }).filter(Boolean);

    if (bars.length) gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });

    var tl = gsap.timeline({
      scrollTrigger: { trigger: triggerEl, start: "top 80%", once: true }
    });
    tl.from(cards, {
      opacity: 0,
      y: 28,
      scale: 0.98,
      duration: 0.5,
      stagger: 0.09,
      ease: "power2.out"
    });
    if (bars.length) {
      tl.to(bars, {
        scaleX: 1,
        duration: 0.45,
        stagger: 0.09,
        ease: "power2.out"
      }, "-=0.35");
    }
  }

  // Os cards do blog são injetados via fetch assíncrono (ver index.html) e
  // não existem no DOM ainda quando DOMContentLoaded dispara — por isso
  // animam à parte, quando o evento abaixo confirma que o innerHTML já foi
  // preenchido.
  function initBlogTeaserAnimation() {
    if (!ready() || reducedMotion()) return;
    var blogGrid = document.getElementById("home-blog-teaser");
    var blogCards = blogGrid ? blogGrid.querySelectorAll(".card") : [];
    if (!blogCards.length) return;
    animateCardGrid(blogCards, blogGrid);
    ScrollTrigger.refresh();
  }

  document.addEventListener("DOMContentLoaded", initHomeScrollAnimations);
  document.addEventListener("home:blog-teaser-ready", initBlogTeaserAnimation);
})();
