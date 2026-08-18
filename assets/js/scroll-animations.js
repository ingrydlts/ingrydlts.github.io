// Por Dentro — animações de entrada na home, acionadas por scroll (GSAP ScrollTrigger).
(function () {
  "use strict";

  function ready() {
    return typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  }

  function initHomeScrollAnimations() {
    if (!ready()) return;
    gsap.registerPlugin(ScrollTrigger);

    var heroText = document.querySelector(".hero > div:first-child");
    var heroImage = document.querySelector("#hero-image");
    if (heroText) {
      gsap.from(heroText, {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: heroText, start: "top 85%", once: true }
      });
    }
    if (heroImage) {
      gsap.from(heroImage, {
        opacity: 0,
        y: 24,
        duration: 0.8,
        delay: 0.15,
        ease: "power2.out",
        scrollTrigger: { trigger: heroImage, start: "top 85%", once: true }
      });
    }

    var categoryCards = document.querySelectorAll('.grid.grid-3[aria-label="Categorias"] .card');
    if (categoryCards.length) {
      gsap.from(categoryCards, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: { trigger: categoryCards[0].closest(".grid"), start: "top 80%", once: true }
      });
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

  // Os cards do blog são injetados via fetch assíncrono (ver index.html) e
  // não existem no DOM ainda quando DOMContentLoaded dispara — por isso
  // animam à parte, quando o evento abaixo confirma que o innerHTML já foi
  // preenchido.
  function initBlogTeaserAnimation() {
    if (!ready()) return;
    var blogCards = document.querySelectorAll("#home-blog-teaser .card");
    if (!blogCards.length) return;
    gsap.from(blogCards, {
      opacity: 0,
      y: 30,
      duration: 0.7,
      stagger: 0.12,
      ease: "power2.out",
      scrollTrigger: { trigger: "#home-blog-teaser", start: "top 85%", once: true }
    });
    ScrollTrigger.refresh();
  }

  document.addEventListener("DOMContentLoaded", initHomeScrollAnimations);
  document.addEventListener("home:blog-teaser-ready", initBlogTeaserAnimation);
})();
