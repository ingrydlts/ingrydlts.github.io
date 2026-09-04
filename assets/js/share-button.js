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

  // Mesmo padrão de slug usado no resto do site (getArticleSlug em
  // assets/js/main.js) — lido direto da URL porque este script roda fora
  // do #article-root e não tem acesso ao objeto `post`.
  function getArticleSlug() {
    try {
      return new URLSearchParams(window.location.search).get("slug");
    } catch (e) {
      return null;
    }
  }

  // Reaproveita o pipeline de eventos já usado pelo resto do site
  // (assets/js/events.js → Worker → D1 → /admin/dashboard/). "share_open"
  // é o aperto no botão flutuante; "share_click" é o destino escolhido no
  // popup (whatsapp / instagram_dm / instagram_stories / email).
  function trackShare(type, id) {
    if (!window.PDEvents) return;
    var payload = { type: type };
    if (id) payload.id = id;
    window.PDEvents.send("block", getArticleSlug(), payload);
  }

  // Busca a imagem de capa do artigo (guardada em data-image pelo
  // artigos/post/index.html) e converte pra File — é o formato que o
  // Web Share API (nível 2) aceita pra anexar imagem numa story real.
  function loadCoverImageFile() {
    var fab = document.getElementById("share-fab");
    var src = fab && fab.dataset.image;
    if (!src) return Promise.reject(new Error("sem imagem de capa"));
    var absoluteUrl = new URL(src, window.location.origin).href;
    return fetch(absoluteUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("falha ao buscar a capa");
        return res.blob();
      })
      .then(function (blob) {
        var ext = (blob.type && blob.type.split("/")[1]) || "jpg";
        return new File([blob], "capa." + ext, { type: blob.type || "image/jpeg" });
      });
  }

  // Cache do File da capa — o navigator.share precisa rodar bem perto do
  // clique (o navegador pode revogar a permissão de "gesto do usuário" se
  // demorar), então a busca da imagem começa assim que o popup abre em vez
  // de só quando a pessoa clica em "Instagram Stories".
  var coverFilePromise = null;
  function getCoverImageFile() {
    if (!coverFilePromise) coverFilePromise = loadCoverImageFile();
    return coverFilePromise;
  }

  // Compartilha os Stories com a capa do artigo como imagem de fundo —
  // só funciona onde o Web Share API aceita arquivos (a maioria dos
  // navegadores mobile atuais). Sem suporte a arquivo, cai pro
  // compartilhamento simples (só título + link).
  function shareStoryWithCover(data) {
    return getCoverImageFile().then(function (file) {
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error("compartilhamento de arquivo não suportado");
      }
      return navigator.share({ files: [file], title: data.title, url: data.url });
    });
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
    trackShare("share_click", target === "dm" ? "instagram_dm" : "instagram_stories");

    if (target === "stories" && navigator.share) {
      shareStoryWithCover(data).catch(function (err) {
        if (err && err.name === "AbortError") return; // usuário cancelou o share sheet
        navigator.share({ title: data.title, url: data.url }).catch(function () {});
      });
      return;
    }

    if (navigator.share) {
      navigator.share({ title: data.title, url: data.url }).catch(function () {});
      return;
    }

    copyLink(data.url).then(function (copied) {
      if (target === "dm") window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener");
      var where = target === "stories" ? "story" : "mensagem";
      showHint(copied ? "Link copiado! Abra o Instagram no celular e cole na sua " + where + "." : "Copie o link e cole no Instagram: " + data.url);
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
    getCoverImageFile().catch(function () {}); // aquece o cache da capa
    trackShare("share_open");
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
    var waLink = overlay.querySelector('[data-share="whatsapp"]');
    if (waLink) waLink.addEventListener("click", function () { trackShare("share_click", "whatsapp"); });
    var emailLink = overlay.querySelector('[data-share="email"]');
    if (emailLink) emailLink.addEventListener("click", function () { trackShare("share_click", "email"); });
  });
})();
