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

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    markActiveNav();
  });
})();
