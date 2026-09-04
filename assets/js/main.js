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

  // Slug do artigo pra anexar aos eventos do bot (ver assets/js/events.js).
  // Ordem de prioridade: 1) atributo data-article-slug mais próximo do
  // elemento clicado (blocos ricos do markdown.js já vêm com isso), 2) o
  // parâmetro ?slug= da URL (template dinâmico /artigos/post/), 3)
  // data-article-slug no <body> (páginas com HTML próprio, ex. Exame Cívico
  // — precisa ser adicionado à mão nelas pra essa 3ª opção valer).
  function getArticleSlug(el) {
    var withSlug = el && el.closest ? el.closest("[data-article-slug]") : null;
    if (withSlug) return withSlug.dataset.articleSlug;
    try {
      var qsSlug = new URLSearchParams(window.location.search).get("slug");
      if (qsSlug) return qsSlug;
    } catch (e) {}
    return document.body.dataset.articleSlug || null;
  }

  // Abas de conteúdo (ex. "Os 5 temas" da página do Exame Cívico) e acordeão
  // de FAQ — mesmo motivo da delegação acima: em seções premium, esses
  // elementos só existem depois do desbloqueio, não no carregamento inicial.
  // Toda troca de aba pra uma aba diferente da atual vira 1 evento no bot —
  // mostra qual opção a audiência mais explora.
  function initTabSwitcher() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".rt-tab-btn");
      if (!btn) return;
      var panel = document.getElementById(btn.dataset.tab);
      if (!panel) return;
      var wasActive = btn.classList.contains("is-active");
      document.querySelectorAll(".rt-tab-panel").forEach(function (p) { p.classList.remove("is-active"); });
      document.querySelectorAll(".rt-tab-btn").forEach(function (b) { b.classList.remove("is-active"); });
      panel.classList.add("is-active");
      btn.classList.add("is-active");
      if (!wasActive && window.PDEvents) {
        window.PDEvents.send("block", getArticleSlug(btn), { type: "tab_click", id: btn.dataset.tab });
      }
    });
  }

  // Toda pergunta aberta (não o fechar) vira 1 evento no bot — ver
  // renderFaq em assets/js/markdown.js pra data-faq-id/data-faq-question.
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
        if (window.PDEvents) {
          window.PDEvents.send("block", getArticleSlug(q), {
            type: "faq_open",
            id: q.dataset.faqId || null,
            question: (q.dataset.faqQuestion || "").slice(0, 80)
          });
        }
      }
    });
  }

  // Clique em fonte externa ([[RESOURCES]], ver markdown.js) vira 1 evento
  // no bot — mostra quais fontes a audiência realmente confere. O link abre
  // em nova aba (target="_blank"), então o fetch do evento não é cortado
  // pela navegação.
  function initResourceTracking() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest(".rt-resource-card a");
      if (!link || !window.PDEvents) return;
      window.PDEvents.send("block", getArticleSlug(link), {
        type: "resource_click",
        id: link.dataset.resourceTitle || link.href
      });
    });
  }

  // De onde a leitora veio até o artigo — 1 evento por carregamento de
  // página (não trava por localStorage como feedback/enquete: aqui o
  // interesse é contar visitas, não pessoas únicas). "source" é, em ordem
  // de prioridade: 1) ?utm_source= da URL (link marcado à mão, ex.
  // newsletter, bio do Instagram), 2) o domínio de document.referrer se for
  // de outro site, 3) "(navegação interna)" se o referrer for o próprio
  // site, 4) "(direto)" se não houver referrer nenhum — caso comum de
  // link colado em WhatsApp/Instagram, que não repassam o referrer.
  function trackPageSource() {
    if (!window.PDEvents) return;
    var slug = getArticleSlug();
    if (!slug) return; // só interessa em página de artigo

    var qs;
    try { qs = new URLSearchParams(window.location.search); } catch (e) { qs = null; }
    var utmSource = qs ? qs.get("utm_source") : null;

    var refHost = null;
    if (document.referrer) {
      try { refHost = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch (e) {}
    }
    var siteHost = window.location.hostname;

    var source;
    if (utmSource) {
      source = utmSource.trim().toLowerCase().slice(0, 60);
    } else if (refHost && refHost !== siteHost) {
      source = refHost;
    } else if (refHost === siteHost) {
      source = "(navegação interna)";
    } else {
      source = "(direto)";
    }

    window.PDEvents.send("block", slug, {
      type: "page_view",
      source: source,
      medium: qs ? (qs.get("utm_medium") || null) : null,
      referrer: document.referrer ? document.referrer.slice(0, 300) : null
    });
  }

  // ---- Checklist (bloco [[CHECKLIST]], ver assets/js/markdown.js) ----
  // Progresso fica salvo no navegador de quem lê (localStorage), por
  // checklist (data-checklist-id) — sobrevive a reload, não é enviado a
  // lugar nenhum. Ao chegar em 100%, dispara 1 evento de conclusão
  // (window.PDEvents, só se o consentimento tiver sido aceito).
  var checklistCompletedThisVisit = {};

  function checklistStorageKey(id) {
    return "pd_checklist_" + id;
  }

  function updateChecklistUI(wrap) {
    var total = parseInt(wrap.dataset.checklistTotal, 10) || 0;
    var checked = wrap.querySelectorAll('input[data-checklist-item]:checked').length;
    var fill = wrap.querySelector(".rt-checklist-fill");
    var count = wrap.querySelector(".rt-checklist-count");
    if (fill) fill.style.width = (total ? Math.round((checked / total) * 100) : 0) + "%";
    if (count) count.textContent = checked + " de " + total;
    wrap.querySelectorAll(".rt-checklist-item").forEach(function (item) {
      var input = item.querySelector("input");
      item.classList.toggle("is-checked", !!(input && input.checked));
    });
    return { checked: checked, total: total };
  }

  function saveChecklistState(wrap) {
    var state = {};
    wrap.querySelectorAll("input[data-checklist-item]").forEach(function (input) {
      state[input.dataset.checklistItem] = input.checked;
    });
    try {
      window.localStorage.setItem(checklistStorageKey(wrap.dataset.checklistId), JSON.stringify(state));
    } catch (e) {}
  }

  function restoreChecklistState(wrap) {
    var raw;
    try {
      raw = window.localStorage.getItem(checklistStorageKey(wrap.dataset.checklistId));
    } catch (e) {
      return;
    }
    if (!raw) return;
    var state;
    try {
      state = JSON.parse(raw);
    } catch (e) {
      return;
    }
    wrap.querySelectorAll("input[data-checklist-item]").forEach(function (input) {
      if (state[input.dataset.checklistItem]) input.checked = true;
    });
  }

  function initChecklist() {
    document.addEventListener("change", function (e) {
      var input = e.target.closest("[data-checklist-item]");
      if (!input) return;
      var wrap = input.closest(".rt-checklist");
      if (!wrap) return;
      var result = updateChecklistUI(wrap);
      saveChecklistState(wrap);
      var id = wrap.dataset.checklistId;
      if (result.total && result.checked === result.total && !checklistCompletedThisVisit[id]) {
        checklistCompletedThisVisit[id] = true;
        if (window.PDEvents) window.PDEvents.send("block", null, { type: "checklist_complete", id: id });
      }
    });
  }

  // ---- Feedback (bloco [[FEEDBACK]], ver assets/js/markdown.js) ----
  // Um voto por checklist/pessoa (localStorage evita reenvio ao recarregar
  // a página). O evento em si vai pro Worker/D1 via window.PDEvents.
  function showFeedbackThanks(wrap, vote) {
    wrap.querySelectorAll(".rt-feedback-btn").forEach(function (btn) {
      btn.disabled = true;
      btn.classList.toggle("is-selected", btn.dataset.vote === vote);
    });
    var thanks = wrap.querySelector(".rt-feedback-thanks");
    if (thanks) thanks.hidden = false;
  }

  function initFeedbackButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".rt-feedback-btn");
      if (!btn) return;
      var wrap = btn.closest(".rt-feedback");
      if (!wrap) return;
      var id = wrap.dataset.feedbackId;
      var already = null;
      try {
        already = window.localStorage.getItem("pd_feedback_" + id);
      } catch (e) {}
      if (already) return;
      var vote = btn.dataset.vote;
      try {
        window.localStorage.setItem("pd_feedback_" + id, vote);
      } catch (e) {}
      showFeedbackThanks(wrap, vote);
      if (window.PDEvents) window.PDEvents.send("feedback", wrap.dataset.articleSlug, { vote: vote });
    });
  }

  // ---- Enquete (bloco [[POLL]], ver assets/js/markdown.js) ----
  // Objetivo é conhecer a audiência (faixa etária, planos futuros etc.),
  // não devolver resultado ao vivo pra quem responde — por isso, ao votar,
  // só mostra "obrigada" (sem percentual). 1 voto por pessoa por enquete,
  // travado no navegador (localStorage), igual ao FEEDBACK.
  function showPollThanks(wrap, option) {
    wrap.querySelectorAll(".rt-poll-option").forEach(function (btn) {
      btn.disabled = true;
      btn.classList.toggle("is-selected", btn.dataset.pollOption === option);
    });
    var thanks = wrap.querySelector(".rt-poll-thanks");
    if (thanks) thanks.hidden = false;
  }

  function initPollButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".rt-poll-option");
      if (!btn) return;
      var wrap = btn.closest(".rt-poll");
      if (!wrap) return;
      var id = wrap.dataset.pollId;
      var already = null;
      try {
        already = window.localStorage.getItem("pd_poll_" + id);
      } catch (e) {}
      if (already) return;
      var option = btn.dataset.pollOption;
      try {
        window.localStorage.setItem("pd_poll_" + id, option);
      } catch (e) {}
      showPollThanks(wrap, option);
      if (window.PDEvents) {
        window.PDEvents.send("poll", wrap.dataset.articleSlug, { poll_id: id, option: option });
      }
    });
  }

  // Roda toda vez que blocos ricos entram na página — no carregamento
  // inicial E de novo depois que o template dinâmico injeta o corpo do
  // artigo via fetch (que acontece depois do DOMContentLoaded). Restaura
  // checklists marcadas, feedback e enquetes já respondidos, sem reenviar
  // nada.
  function hydrateInteractiveBlocks() {
    document.querySelectorAll(".rt-checklist").forEach(function (wrap) {
      restoreChecklistState(wrap);
      updateChecklistUI(wrap);
    });
    document.querySelectorAll(".rt-feedback").forEach(function (wrap) {
      var voted = null;
      try {
        voted = window.localStorage.getItem("pd_feedback_" + wrap.dataset.feedbackId);
      } catch (e) {}
      if (voted) showFeedbackThanks(wrap, voted);
    });
    document.querySelectorAll(".rt-poll").forEach(function (wrap) {
      var answered = null;
      try {
        answered = window.localStorage.getItem("pd_poll_" + wrap.dataset.pollId);
      } catch (e) {}
      if (answered) showPollThanks(wrap, answered);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    markActiveNav();
    initCopyButtons();
    initTabSwitcher();
    initFaqAccordion();
    initResourceTracking();
    initChecklist();
    initFeedbackButtons();
    initPollButtons();
    hydrateInteractiveBlocks();
    trackPageSource();
  });
  document.addEventListener("pd:blocks-rendered", hydrateInteractiveBlocks);
})();
