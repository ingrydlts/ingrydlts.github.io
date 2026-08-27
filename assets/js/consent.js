// Por Dentro — banner de consentimento (cookies / medição de audiência).
//
// Inclua este script em toda página que precisar do banner (ver
// assets/js/main.js para o padrão de inclusão). Ele:
//   1. Mostra um banner na primeira visita, com texto editável em
//      /admin (content/analytics-config.json).
//   2. Guarda a escolha (aceitar/recusar) em localStorage — nada é
//      carregado (GA4, Clarity, anúncios, eventos de produto) antes do
//      aceite.
//   3. Expõe window.PDConsent para outros scripts (ex. o loader do GA4/
//      Clarity na Fase 3, o carregador de anúncios na Fase 2) saberem se
//      podem rodar, e reagirem caso a escolha mude depois.
//   4. Se existir um elemento com id="pd-consent-manage" na página (usado
//      em /confidentialite/), um clique nele reabre o banner pra trocar
//      a escolha.
//
// Se o fetch da config falhar, usa o texto padrão abaixo — o banner nunca
// deixa de funcionar por causa disso.

(function () {
  var STORAGE_KEY = "pd_consent"; // "granted" | "denied"
  var STORAGE_TS_KEY = "pd_consent_ts";
  var listeners = [];
  // Otimista até a config carregar (mesmo comportamento de sempre: nada é
  // bloqueado por atraso de rede). Uma vez lido, se o interruptor geral
  // estiver desligado, isGranted() nunca mais retorna true nesta página —
  // mesmo que exista uma escolha "granted" salva de antes do interruptor
  // ser desligado.
  var trackingEnabled = true;
  var readyResolve;

  var DEFAULT_CONFIG = {
    trackingEnabled: true,
    consentBanner: {
      title: "Usamos cookies e ferramentas de medição",
      body: "Guardamos sua escolha no seu navegador e, se você aceitar, usamos ferramentas de medição de audiência (como Google Analytics e Microsoft Clarity) e registramos de forma anônima interações como respostas de utilidade dos artigos. Você pode recusar sem prejudicar a navegação.",
      acceptLabel: "Aceitar",
      declineLabel: "Recusar",
      linkLabel: "Saiba mais",
      linkHref: "/confidentialite/"
    }
  };

  function getStoredChoice() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return v === "granted" || v === "denied" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function storeChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
      window.localStorage.setItem(STORAGE_TS_KEY, new Date().toISOString());
    } catch (e) {
      // localStorage indisponível (modo privado restrito, etc.) — a escolha
      // não persiste entre visitas, mas a navegação atual continua normal.
    }
  }

  function notify(granted) {
    listeners.forEach(function (cb) {
      try { cb(granted); } catch (e) {}
    });
    document.dispatchEvent(new CustomEvent("pd:consent-change", { detail: { granted: granted } }));
  }

  function injectStyles() {
    if (document.getElementById("pd-consent-style")) return;
    var style = document.createElement("style");
    style.id = "pd-consent-style";
    style.textContent =
      "#pd-consent-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;" +
      "background:var(--off-white-soft,#FBFAF7);border-top:1px solid var(--borda,rgba(43,43,43,.14));" +
      "box-shadow:var(--shadow-card,0 8px 24px -10px rgba(43,43,43,.18));" +
      "font-family:var(--font-body,-apple-system,sans-serif);color:var(--grafite,#2B2B2B);}" +
      "#pd-consent-banner .pd-consent-inner{max-width:var(--container,1160px);margin:0 auto;" +
      "padding:18px 24px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;}" +
      "#pd-consent-banner p{margin:0;font-size:13px;line-height:1.5;color:var(--texto-secundario,#6E6862);flex:1 1 320px;}" +
      "#pd-consent-banner strong{display:block;font-size:15px;color:var(--grafite,#2B2B2B);margin-bottom:4px;}" +
      "#pd-consent-banner a{color:inherit;text-decoration:underline;}" +
      "#pd-consent-banner .pd-consent-actions{display:flex;gap:10px;flex-wrap:wrap;flex:0 0 auto;}" +
      "@media (max-width:640px){#pd-consent-banner .pd-consent-actions{width:100%;}" +
      "#pd-consent-banner .pd-consent-actions .btn{flex:1;}}";
    document.head.appendChild(style);
  }

  function removeBanner() {
    var el = document.getElementById("pd-consent-banner");
    if (el) el.remove();
  }

  function renderBanner(cfg) {
    injectStyles();
    removeBanner();
    var b = cfg.consentBanner || DEFAULT_CONFIG.consentBanner;
    var wrap = document.createElement("div");
    wrap.id = "pd-consent-banner";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", b.title || DEFAULT_CONFIG.consentBanner.title);
    wrap.innerHTML =
      '<div class="pd-consent-inner">' +
      "<p><strong>" + escapeHtml(b.title) + "</strong>" + escapeHtml(b.body) +
      ' <a href="' + escapeHtml(b.linkHref || "/confidentialite/") + '">' + escapeHtml(b.linkLabel || "Saiba mais") + "</a></p>" +
      '<div class="pd-consent-actions">' +
      '<button type="button" class="btn btn-outline" data-pd-decline>' + escapeHtml(b.declineLabel || "Recusar") + "</button>" +
      '<button type="button" class="btn" data-pd-accept>' + escapeHtml(b.acceptLabel || "Aceitar") + "</button>" +
      "</div></div>";
    document.body.appendChild(wrap);
    wrap.querySelector("[data-pd-accept]").addEventListener("click", function () { decide("granted"); });
    wrap.querySelector("[data-pd-decline]").addEventListener("click", function () { decide("denied"); });
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function decide(choice) {
    storeChoice(choice);
    removeBanner();
    notify(choice === "granted");
  }

  function wireManageButtons(cfg) {
    document.querySelectorAll("#pd-consent-manage").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        renderBanner(cfg);
      });
    });
  }

  function boot(cfg) {
    trackingEnabled = cfg.trackingEnabled !== false;
    wireManageButtons(cfg);
    if (trackingEnabled) {
      var stored = getStoredChoice();
      if (stored === null) {
        renderBanner(cfg);
      } else {
        notify(stored === "granted");
      }
    }
    readyResolve();
  }

  window.PDConsent = {
    get: getStoredChoice,
    isGranted: function () { return trackingEnabled && getStoredChoice() === "granted"; },
    onChange: function (cb) { if (typeof cb === "function") listeners.push(cb); },
    // Resolve quando a config real já foi lida (trackingEnabled definitivo).
    // Scripts que decidem algo baseado em isGranted() logo ao carregar (ex.
    // analytics.js, ad-slots.js) devem esperar isso antes da 1ª checagem —
    // sem isso, um "granted" salvo de antes do interruptor geral ser
    // desligado passaria pela checagem otimista de trackingEnabled=true.
    ready: new Promise(function (resolve) { readyResolve = resolve; })
  };

  fetch("/content/analytics-config.json")
    .then(function (r) { return r.ok ? r.json() : DEFAULT_CONFIG; })
    .then(function (cfg) {
      boot(Object.assign({}, DEFAULT_CONFIG, cfg, {
        consentBanner: Object.assign({}, DEFAULT_CONFIG.consentBanner, cfg && cfg.consentBanner)
      }));
    })
    .catch(function () { boot(DEFAULT_CONFIG); });
})();
