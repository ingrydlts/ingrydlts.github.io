// Botão flutuante de compartilhar — presente em todo artigo do blog
// (artigos/post/index.html). Abre um popup com WhatsApp, Instagram
// (mensagem e stories) e e-mail. Instagram não tem link web pra abrir
// direto numa DM ou story com conteúdo pré-preenchido, então no celular
// tentamos primeiro o share sheet nativo (navigator.share) — que já lista
// o Instagram como opção — e, sem suporte, copiamos o link e abrimos o
// Instagram pra colar manualmente.
(function () {
  function getShareData() {
    return {
      title: document.title.replace(/\s*—\s*Por Dentro\s*$/, ""),
      url: window.location.href
    };
  }

  function buildWhatsAppUrl(data) {
    return "https://wa.me/?text=" + encodeURIComponent(data.title + " " + data.url);
  }

  function buildMailtoUrl(data) {
    var body = data.title + "\n\n" + data.url;
    return "mailto:?subject=" + encodeURIComponent(data.title) + "&body=" + encodeURIComponent(body);
  }

  function copyLink(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  function showHint(msg) {
    var hint = document.getElementById("share-modal-hint");
    if (!hint) return;
    hint.textContent = msg;
    hint.hidden = false;
  }

  function handleInstagramShare(target) {
    var data = getShareData();
    if (navigator.share) {
      navigator.share({ title: data.title, url: data.url }).catch(function () {});
      return;
    }
    copyLink(data.url).then(function (copied) {
      var dest = target === "stories" ? "https://www.instagram.com/stories/camera/" : "https://www.instagram.com/direct/inbox/";
      window.open(dest, "_blank", "noopener");
      var where = target === "stories" ? "story" : "mensagem";
      showHint(copied ? "Link copiado! Cole na sua " + where + " do Instagram." : "Copie o link e cole no Instagram: " + data.url);
    });
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  function openModal() {
    var overlay = document.getElementById("share-modal-overlay");
    var fab = document.getElementById("share-fab");
    if (!overlay) return;
    var data = getShareData();
    var wa = overlay.querySelector('[data-share="whatsapp"]');
    var em = overlay.querySelector('[data-share="email"]');
    if (wa) wa.href = buildWhatsAppUrl(data);
    if (em) em.href = buildMailtoUrl(data);
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });
    if (fab) fab.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal() {
    var overlay = document.getElementById("share-modal-overlay");
    var fab = document.getElementById("share-fab");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    if (fab) fab.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(function () {
      overlay.hidden = true;
      var hint = document.getElementById("share-modal-hint");
      if (hint) { hint.hidden = true; hint.textContent = ""; }
    }, 200);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var fab = document.getElementById("share-fab");
    var overlay = document.getElementById("share-modal-overlay");
    if (!fab || !overlay) return;
    fab.addEventListener("click", openModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    var closeBtn = overlay.querySelector(".share-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    var dmBtn = overlay.querySelector('[data-share="instagram-dm"]');
    if (dmBtn) dmBtn.addEventListener("click", function () { handleInstagramShare("dm"); });
    var storiesBtn = overlay.querySelector('[data-share="instagram-stories"]');
    if (storiesBtn) storiesBtn.addEventListener("click", function () { handleInstagramShare("stories"); });
  });
})();
