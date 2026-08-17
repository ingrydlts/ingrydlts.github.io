// Por Dentro — comportamento compartilhado: menu mobile + estado ativo da nav.
(function () {
  "use strict";

  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.querySelector(".mobile-nav");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  function markActiveNav() {
    var path = window.location.pathname.replace(/\/index\.html$/, "/");
    var links = document.querySelectorAll(".site-nav a, .mobile-nav a");
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href) return;
      var normalized = href.replace(/\/index\.html$/, "/");
      if (normalized === "/") {
        if (path === "/") link.setAttribute("aria-current", "page");
        return;
      }
      if (path.indexOf(normalized) === 0) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  // Botão "copiar" dos modelos de mensagem/carta (páginas de artigo com
  // estrutura própria, ex. ANEF). Delegado no document porque, em artigos
  // premium, esses botões só existem depois que o conteúdo pago é
  // desbloqueado e injetado na página — não estão lá no carregamento inicial.
  function initCopyButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".rt-copy-btn");
      if (!btn) return;
      var el = document.getElementById(btn.dataset.target);
      if (!el) return;
      var text = el.innerText;
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "✅ Copiado!";
        btn.classList.add("is-copied");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 2500);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        done();
      }
    });
  }

  // Abas de conteúdo (ex. "Os 5 temas" da página do Exame Cívico) e acordeão
  // de FAQ — mesmo motivo da delegação acima: em seções premium, esses
  // elementos só existem depois do desbloqueio, não no carregamento inicial.
  function initTabSwitcher() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".rt-tab-btn");
      if (!btn) return;
      var panel = document.getElementById(btn.dataset.tab);
      if (!panel) return;
      document.querySelectorAll(".rt-tab-panel").forEach(function (p) { p.classList.remove("is-active"); });
      document.querySelectorAll(".rt-tab-btn").forEach(function (b) { b.classList.remove("is-active"); });
      panel.classList.add("is-active");
      btn.classList.add("is-active");
    });
  }

  function initFaqAccordion() {
    document.addEventListener("click", function (e) {
      var q = e.target.closest(".rt-faq-q");
      if (!q) return;
      var answer = q.nextElementSibling;
      var isOpen = q.classList.contains("is-open");
      document.querySelectorAll(".rt-faq-q").forEach(function (qq) {
        qq.classList.remove("is-open");
        if (qq.nextElementSibling) qq.nextElementSibling.style.maxHeight = "0";
      });
      if (!isOpen && answer) {
        q.classList.add("is-open");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    markActiveNav();
    initCopyButtons();
    initTabSwitcher();
    initFaqAccordion();
  });
})();
