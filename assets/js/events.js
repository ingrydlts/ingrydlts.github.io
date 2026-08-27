// Por Dentro — envio de eventos de produto (feedback dos artigos, bot,
// blocos interativos) pro Worker (/api/events), que grava num banco D1.
//
// Só envia nada depois do consentimento aceito (window.PDConsent, definido
// em assets/js/consent.js — inclua esse script ANTES deste). Enquanto não
// há decisão, ou se a leitora recusar, os eventos são descartados
// silenciosamente — a funcionalidade em si (ex. o botão de feedback)
// continua respondendo normalmente, só não fica registrada.
//
// Uso: window.PDEvents.send("feedback", "slug-do-artigo", { vote: "up" });

(function () {
  var API_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";
  var SID_KEY = "pd_sid";

  function getSessionId() {
    try {
      var sid = window.localStorage.getItem(SID_KEY);
      if (!sid) {
        sid = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        window.localStorage.setItem(SID_KEY, sid);
      }
      return sid;
    } catch (e) {
      return null; // sem localStorage, manda sem session_id — o evento ainda é gravado, só não agrupável por sessão
    }
  }

  function send(eventType, articleSlug, payload) {
    if (!window.PDConsent || !window.PDConsent.isGranted()) return;
    try {
      fetch(API_BASE + "/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          article_slug: articleSlug || null,
          session_id: getSessionId(),
          payload: payload || {}
        })
      }).catch(function () {}); // falha de rede não deve afetar a leitora
    } catch (e) {}
  }

  window.PDEvents = { send: send };
})();
