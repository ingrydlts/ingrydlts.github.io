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
      '<span class="pd-quiz-badge"><span class="pd-quiz-badge-dot" aria-hidden="true"></span>' + escapeHtml(hero.eyebrow || "") + "</span>" +
      "<h1>" + escapeHtml(hero.title || "") + "</h1>" +
      '<p class="pd-quiz-subtitle">' + escapeHtml(hero.subtitle || "") + "</p>" +
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

  function renderHowItWorks(cfg) {
    var how = cfg.howItWorks;
    var mount = document.getElementById("pdq-how-mount");
    if (!mount || !how) return;

    var items = (how.items || []).map(function (item) {
      return '<div class="pd-quiz-how-item"><span class="pd-quiz-how-item-icon" aria-hidden="true">' + escapeHtml(item.icon || "✅") + "</span><p>" + escapeHtml(item.text || "") + "</p></div>";
    }).join("");

    var expectations = (how.expectations || []).map(function (item) {
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("");

    mount.innerHTML =
      '<span class="eyebrow">' + escapeHtml(how.eyebrow || "") + "</span>" +
      "<h2>" + escapeHtml(how.title || "") + "</h2>" +
      '<div class="pd-quiz-how-items">' + items + "</div>" +
      '<div class="pd-quiz-expect"><h3>' + escapeHtml(how.expectationsTitle || "O que esperar") + "</h3><ul>" + expectations + "</ul></div>";
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

    try {
      var status = await fetch(WORKER_BASE + "/api/quiz/status").then(function (r) { return r.json(); });
      renderCounter(cfg.hero || {}, status);
    } catch (e) {
      // sem status ao vivo, o formulário continua funcionando normalmente —
      // só não mostra o contador de vagas restantes.
    }
  })();
})();
