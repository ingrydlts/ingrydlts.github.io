// Por Dentro — carrega Google Analytics (GA4) e Microsoft Clarity, só depois
// do consentimento aceito (window.PDConsent, definido em consent.js — inclua
// esse script ANTES deste). IDs editáveis em /admin ("Consentimento e
// cookies"). Sem IDs preenchidos, nada é carregado — mesmo com consentimento.

(function () {
  var loaded = false;

  function loadGA4(measurementId) {
    if (!measurementId) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
  }

  function loadClarity(projectId) {
    if (!projectId) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    fetch("/content/analytics-config.json")
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (cfg) {
        if (cfg.ga4MeasurementId) loadGA4(cfg.ga4MeasurementId);
        if (cfg.clarityProjectId) loadClarity(cfg.clarityProjectId);
      })
      .catch(function () {});
  }

  if (!window.PDConsent) return;
  // Espera a config real (trackingEnabled definitivo) antes da 1ª checagem —
  // ver o comentário de PDConsent.ready em consent.js. Sem isso, um
  // "granted" salvo de antes do interruptor geral ser desligado carregaria
  // GA4/Clarity mesmo assim, na fração de segundo antes da config chegar.
  window.PDConsent.ready.then(function () {
    if (window.PDConsent.isGranted()) load();
  });
  window.PDConsent.onChange(function (granted) {
    if (granted) load();
  });
})();
