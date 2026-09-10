// Por Dentro — /acesso-vip/: questionário de vagas limitadas antes de
// liberar o link do Google Drive.
//
// Conteúdo (título, perguntas, textos de sucesso/travado, FAQ) vem de
// content/quiz-config.json, editável em /admin → "Questionário de vagas
// limitadas" — nada de copy fica hardcoded aqui.
//
// A trava em si (quantas vagas já foram usadas, e se esta resposta ganha
// o link) é decidida só pelo Worker (POST /api/quiz/submit) — este script
// nunca decide isso sozinho, só mostra o que o servidor responder. Ver
// cms-oauth-worker/worker.js (handleQuizSubmit) pra entender por que o
// contador é seguro mesmo com envios simultâneos.
import { fetchJSON, escapeHtml, qs } from "/assets/js/render.js";

(function () {
  var WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";

  // Ícones em SVG (linha, currentColor) — escolhidos pelo /admin por chave,
  // não emoji livre. "Dinâmico" = ganham um pop de escala ao entrar na tela
  // (ver .pd-quiz-how-icon.is-visible no CSS da página), emoji não anima bem.
  var ICONS = {
    chart: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="12" width="3.5" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="10.25" y="7" width="3.5" height="13" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="16.5" y="3" width="3.5" height="17" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>',
    cycle: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 11a8 8 0 1 0-2.6 6.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 5v6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    beta: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 3h5M10 3v6l-5.2 8.6A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3.4L14 9V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 15h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    discount: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="1.6" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 12.5l2.4 2.4 4.6-5.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="6.5" width="19" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.2S3.8 15 3.8 9.3A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 8.2 2.2C20.2 15 12 20.2 12 20.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18h6M10 21h4M8 14a4.8 4.8 0 1 1 8 0c-.9 1-1.5 1.8-1.5 3.2h-5c0-1.4-.6-2.2-1.5-3.2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function iconHTML(key) {
    return '<span class="pd-quiz-how-icon" aria-hidden="true">' + (ICONS[key] || ICONS.star) + "</span>";
  }

  function fieldHTML(q) {
    var req = q.required !== false;
    var label = '<label for="pdq-' + escapeHtml(q.id) + '">' + escapeHtml(q.label) + (req ? " *" : "") + "</label>";
    var control;
    if (q.type === "textarea") {
      control = '<textarea id="pdq-' + escapeHtml(q.id) + '" name="' + escapeHtml(q.id) + '"' +
        (q.placeholder ? ' placeholder="' + escapeHtml(q.placeholder) + '"' : "") +
        (req ? " required" : "") + " maxlength=\"600\"></textarea>";
    } else if (q.type === "select") {
      var opts = (q.options || []).map(function (o) {
        return '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + "</option>";
      }).join("");
      control = '<select id="pdq-' + escapeHtml(q.id) + '" name="' + escapeHtml(q.id) + '"' + (req ? " required" : "") + '>' +
        '<option value="">Selecione...</option>' + opts + "</select>";
    } else {
      control = '<input type="text" id="pdq-' + escapeHtml(q.id) + '" name="' + escapeHtml(q.id) + '"' +
        (q.placeholder ? ' placeholder="' + escapeHtml(q.placeholder) + '"' : "") +
        (req ? " required" : "") + ' maxlength="200">';
    }
    return '<div class="pd-quiz-field" data-question-id="' + escapeHtml(q.id) + '">' + label + control + "</div>";
  }

  function renderHero(cfg) {
    var hero = cfg.hero || {};
    document.getElementById("pdq-hero").innerHTML =
      '<span class="pd-quiz-badge pd-reveal is-visible"><span class="pd-quiz-badge-dot" aria-hidden="true"></span>' + escapeHtml(hero.eyebrow || "") + "</span>" +
      '<h1 class="pd-reveal is-visible pd-reveal-d1">' +
      '<span class="pd-quiz-title-main">' + escapeHtml(hero.titleMain || "") + "</span>" +
      '<span class="pd-quiz-title-accent">' + escapeHtml(hero.titleAccent || "") + "</span>" +
      "</h1>" +
      '<p class="pd-quiz-subtitle pd-reveal is-visible pd-reveal-d2">' + escapeHtml(hero.subtitle || "") +
      (hero.subtitleHighlight ? ' <strong class="pd-quiz-subtitle-highlight">' + escapeHtml(hero.subtitleHighlight) + "</strong>" : "") +
      "</p>" +
      '<div class="pdq-scroll-hint pd-reveal is-visible pd-reveal-d3"><span>Deslize</span><span class="pdq-scroll-hint-arrow" aria-hidden="true">↓</span></div>' +
      '<div id="pdq-counter"></div>';
  }

  function renderCounter(hero, status) {
    var el = document.getElementById("pdq-counter");
    if (!el || !status) return;
    if (status.esgotado) {
      el.innerHTML = '<div class="pd-quiz-counter"><strong>0</strong><span>' + escapeHtml(hero.vagasLabel || "vagas restantes") + "</span></div>";
    } else {
      el.innerHTML = '<div class="pd-quiz-counter"><strong>' + escapeHtml(String(status.restantes)) + '</strong><span>' + escapeHtml(hero.vagasLabel || "vagas restantes") + "</span></div>";
    }
  }

  var DELAY_CLASSES = ["pd-reveal-d1", "pd-reveal-d2", "pd-reveal-d3", "pd-reveal-d4", "pd-reveal-d5"];

  // Bloco com ícone + título curto (palavra/número-chave) + descrição de 1
  // linha — pensado pra leitura periférica (escaneável), não frase corrida.
  // Usado tanto pros destaques do produto quanto pro "o que esperar".
  function statBlockHTML(item, delayClass) {
    return '<div class="pd-quiz-how-item pd-reveal ' + delayClass + '">' +
      iconHTML(item.icon) +
      '<div class="pd-quiz-how-item-body">' +
      '<strong class="pd-quiz-how-item-title">' + escapeHtml(item.title || "") + "</strong>" +
      '<p class="pd-quiz-how-item-desc">' + escapeHtml(item.description || "") + "</p>" +
      "</div></div>";
  }

  function renderHowItWorks(cfg) {
    var how = cfg.howItWorks;
    var mount = document.getElementById("pdq-how-mount");
    if (!mount || !how) return;

    var items = (how.items || []).map(function (item, i) {
      return statBlockHTML(item, DELAY_CLASSES[i % DELAY_CLASSES.length]);
    }).join("");

    var expectations = (how.expectations || []).map(function (item, i) {
      return statBlockHTML(item, DELAY_CLASSES[i % DELAY_CLASSES.length]);
    }).join("");

    mount.innerHTML =
      '<span class="eyebrow pd-reveal">' + escapeHtml(how.eyebrow || "") + "</span>" +
      '<h2 class="pd-reveal pd-reveal-d1">' + escapeHtml(how.title || "") + "</h2>" +
      '<div class="pd-quiz-how-items">' + items + "</div>" +
      '<h2 class="pd-quiz-expect-title pd-reveal">' + escapeHtml(how.expectationsTitle || "O que esperar") + "</h2>" +
      '<div class="pd-quiz-how-items">' + expectations + "</div>";
  }

  // Revelação em blocos curtos conforme a rolagem chega em cada um — leitura
  // periférica (não parágrafo denso), incentivando continuar descendo até o
  // formulário. Um só IntersectionObserver observa todo .pd-reveal que
  // ainda não apareceu; uma vez visível, para de observar (não some de novo
  // ao rolar pra cima).
  function initScrollReveal() {
    var targets = document.querySelectorAll(".pd-reveal:not(.is-visible)");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
    targets.forEach(function (el) { observer.observe(el); });
  }

  function renderForm(cfg) {
    var form = cfg.form || {};
    var questions = (form.questions || []).map(fieldHTML).join("");
    document.getElementById("pdq-form-mount").innerHTML =
      '<form id="pdq-form" class="pd-quiz-form" novalidate>' +
      '<div class="pd-quiz-field"><label for="pdq-name">Seu nome *</label><input type="text" id="pdq-name" name="name" required maxlength="80"></div>' +
      '<div class="pd-quiz-field"><label for="pdq-instagram">Seu @ do Instagram *</label><input type="text" id="pdq-instagram" name="instagram" placeholder="@seuusuario" required maxlength="60"></div>' +
      '<div class="pd-quiz-field"><label for="pdq-email">Seu e-mail *</label><input type="email" id="pdq-email" name="email" required maxlength="150"></div>' +
      questions +
      '<input type="text" name="hp" class="pd-quiz-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="pd-quiz-error" id="pdq-error" hidden></p>' +
      '<button type="submit" class="btn btn-block" id="pdq-submit">' + escapeHtml(form.submitLabel || "Quero minha vaga") + "</button>" +
      '<p class="pd-quiz-privacy">' + escapeHtml(form.privacyNote || "") + "</p>" +
      "</form>";
  }

  function renderSuccess(cfg, driveLink) {
    var s = cfg.success || {};
    var cta = driveLink
      ? '<a class="btn" href="' + escapeHtml(driveLink) + '" target="_blank" rel="noopener">' + escapeHtml(s.ctaLabel || "Abrir material") + "</a>"
      : '<p class="muted">' + escapeHtml(s.pendingLinkNotice || "") + "</p>";
    document.getElementById("pdq-form-mount").innerHTML =
      '<div class="pd-quiz-result is-success"><h2>' + escapeHtml(s.title || "") + "</h2><p>" + escapeHtml(s.body || "") + "</p>" + cta + "</div>";
  }

  function renderLocked(cfg) {
    var l = cfg.locked || {};
    var e2 = l.etapa2 || {};
    var etapa2HTML = "";
    if (e2.enabled !== false) {
      var cta = e2.link
        ? '<a class="btn" href="' + escapeHtml(e2.link) + '" target="_blank" rel="noopener">' + escapeHtml(e2.ctaLabel || "Quero continuar") + "</a>"
        : '<p class="muted">' + escapeHtml(e2.pendingNotice || "") + "</p>";
      etapa2HTML =
        '<div class="pd-quiz-etapa2"><h3>' + escapeHtml(e2.title || "") + '</h3><span class="pd-quiz-etapa2-price">' +
        escapeHtml(e2.priceLabel || "") + "</span><p>" + escapeHtml(e2.body || "") + "</p>" + cta + "</div>";
    }
    document.getElementById("pdq-form-mount").innerHTML =
      '<div class="pd-quiz-result is-locked"><h2>' + escapeHtml(l.title || "") + "</h2><p>" + escapeHtml(l.body || "") + "</p>" + etapa2HTML + "</div>";
  }

  function renderFaq(cfg) {
    var items = cfg.faq || [];
    if (!items.length) return;
    var html = items.map(function (item, i) {
      return '<div class="rt-faq-item"><button type="button" class="rt-faq-q" data-faq-id="acesso-vip-faq-' + i + '" data-faq-question="' + escapeHtml(item.q) + '">' +
        escapeHtml(item.q) + '<span class="rt-faq-arrow">▼</span></button>' +
        '<div class="rt-faq-a"><div class="rt-faq-a-inner">' + escapeHtml(item.a) + "</div></div></div>";
    }).join("");
    document.getElementById("pdq-faq-mount").innerHTML =
      '<span class="eyebrow">Perguntas frequentes</span><div class="rt-faq" data-article-slug="acesso-vip">' + html + "</div>";
  }

  function showError(message) {
    var el = document.getElementById("pdq-error");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function wireForm(cfg) {
    var form = document.getElementById("pdq-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errorEl = document.getElementById("pdq-error");
      if (errorEl) errorEl.hidden = true;

      var fd = new FormData(form);
      var answers = {};
      (cfg.form.questions || []).forEach(function (q) {
        answers[q.id] = String(fd.get(q.id) || "").trim();
      });

      var payload = {
        name: String(fd.get("name") || "").trim(),
        instagram: String(fd.get("instagram") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        ref: qs("ref") || null,
        answers: answers,
        hp: String(fd.get("hp") || "")
      };

      var btn = document.getElementById("pdq-submit");
      var originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = (cfg.form && cfg.form.loadingLabel) || "Enviando...";

      fetch(WORKER_BASE + "/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            showError((result.data && result.data.error) || "Não deu pra enviar agora — tenta de novo em instantes.");
            btn.disabled = false;
            btn.textContent = originalLabel;
            return;
          }
          if (window.PDEvents) {
            window.PDEvents.send("block", "acesso-vip", { type: "quiz_submit", liberado: !!result.data.liberado });
          }
          if (result.data.liberado) {
            renderSuccess(cfg, result.data.driveLink);
          } else {
            renderLocked(cfg);
          }
        })
        .catch(function () {
          showError("Não deu pra enviar agora — confira sua conexão e tente de novo.");
          btn.disabled = false;
          btn.textContent = originalLabel;
        });
    });
  }

  (async function init() {
    var cfg;
    try {
      cfg = await fetchJSON("/content/quiz-config.json");
    } catch (e) {
      document.getElementById("pdq-hero").innerHTML = '<p class="empty-state">Não foi possível carregar esta página agora.</p>';
      return;
    }

    if (cfg.meta && cfg.meta.pageTitle) document.title = cfg.meta.pageTitle;

    renderHero(cfg);
    renderHowItWorks(cfg);
    renderForm(cfg);
    renderFaq(cfg);
    wireForm(cfg);
    initScrollReveal();

    try {
      var status = await fetch(WORKER_BASE + "/api/quiz/status").then(function (r) { return r.json(); });
      renderCounter(cfg.hero || {}, status);
    } catch (e) {
      // sem status ao vivo, o formulário continua funcionando normalmente —
      // só não mostra o contador de vagas restantes.
    }
  })();
})();
