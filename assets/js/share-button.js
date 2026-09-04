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

  // Template de story (1080×1920, o padrão do Instagram) montado na hora,
  // por artigo: fundo sólido na cor da marca, a concha do logo + "Por
  // Dentro" no topo, a capa do artigo contida num cartão com cantos
  // arredondados (não em tela cheia — várias capas já têm o título
  // desenhado nelas, então um fundo cheio duplicaria o texto) e o título
  // do artigo, limpo, logo abaixo. O "clicar na foto e ir pro artigo" em
  // si é o link sticker do Instagram — não dá pra desenhar um link dentro
  // de um PNG/JPEG — então mandamos a `url` junto no navigator.share (o
  // Instagram costuma anexar o sticker automaticamente ao receber imagem +
  // link pela mesma partilha) e, de garantia, copiamos o link pro
  // clipboard antes: se o sticker não vier sozinho, é só a pessoa tocar em
  // "adicionar link" e colar.
  var STORY_W = 1080;
  var STORY_H = 1920;
  var STORY_LOGO_SRC = "/images/logo-por-dentro.png";

  function fetchImageBitmap(url) {
    var absoluteUrl = new URL(url, window.location.origin).href;
    return fetch(absoluteUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("falha ao buscar imagem: " + url);
        return res.blob();
      })
      .then(function (blob) { return createImageBitmap(blob); });
  }

  function ensureStoryFontsReady() {
    if (!document.fonts) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 84px "Fraunces"'),
      document.fonts.load('600 30px "Inter"')
    ]).catch(function () {});
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    var words = text.split(/\s+/);
    var lines = [];
    var current = "";
    words.forEach(function (word) {
      var test = current ? current + " " + word : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderStoryCanvas(coverImg, logoImg, title) {
    var canvas = document.createElement("canvas");
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    var ctx = canvas.getContext("2d");

    // fundo sólido na cor da marca (--downtown-brown do site)
    ctx.fillStyle = "#604034";
    ctx.fillRect(0, 0, STORY_W, STORY_H);

    // concha + "Por Dentro", como lockup centralizado no topo
    var logoW = 88;
    var logoH = logoW * (logoImg.height / logoImg.width);
    ctx.fillStyle = "#F4F1EC";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = '700 44px "Fraunces", Georgia, serif';
    var wordmark = "Por Dentro";
    var wordmarkWidth = ctx.measureText(wordmark).width;
    var lockupGap = 22;
    var lockupY = 172;
    var lockupX = (STORY_W - (logoW + lockupGap + wordmarkWidth)) / 2;
    ctx.drawImage(logoImg, lockupX, lockupY - logoH / 2, logoW, logoH);
    ctx.fillText(wordmark, lockupX + logoW + lockupGap, lockupY);

    // cartão com a capa do artigo — contida, não em tela cheia, pra nunca
    // brigar com texto que a própria capa já possa ter
    var cardW = 900;
    var cardH = Math.round(cardW * (coverImg.height / coverImg.width));
    var cardX = (STORY_W - cardW) / 2;
    var cardY = 300;
    var radius = 28;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = "#000";
    roundedRectPath(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, cardX, cardY, cardW, cardH, radius);
    ctx.clip();
    ctx.drawImage(coverImg, cardX, cardY, cardW, cardH);
    ctx.restore();

    // título, abaixo do cartão, centralizado, ajustando a fonte até caber
    // em até 4 linhas
    var maxWidth = STORY_W - 168;
    var fontSize = title.length > 70 ? 58 : title.length > 40 ? 68 : 80;
    var lines;
    ctx.textAlign = "center";
    do {
      ctx.font = '700 ' + fontSize + 'px "Fraunces", Georgia, serif';
      lines = wrapCanvasText(ctx, title, maxWidth);
      if (lines.length <= 4) break;
      fontSize -= 6;
    } while (fontSize > 40);

    // centraliza o bloco do título no espaço livre entre o cartão e a dica
    // do rodapé — evita um vão grande quando o título é curto
    var lineHeight = fontSize * 1.2;
    var titleAreaTop = cardY + cardH + 80;
    var titleAreaBottom = STORY_H - 320;
    var blockHeight = lines.length * lineHeight;
    var titleY = titleAreaTop + Math.max(0, (titleAreaBottom - titleAreaTop - blockHeight) / 2);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#F4F1EC";
    lines.forEach(function (line, i) {
      ctx.fillText(line, STORY_W / 2, titleY + i * lineHeight);
    });

    // dica de toque — fica fora da faixa de baixo que o Instagram reserva
    // pra própria interface (caixa de resposta) por cima da story
    ctx.font = '600 30px "Inter", sans-serif';
    ctx.fillStyle = "rgba(244,241,236,.78)";
    ctx.fillText("Toque no link para ler o artigo completo ↗", STORY_W / 2, STORY_H - 260);

    return canvas;
  }

  function canvasToFile(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) return reject(new Error("falha ao gerar a imagem da story"));
        resolve(new File([blob], "story-por-dentro.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });
  }

  function buildStoryFile(data) {
    var fab = document.getElementById("share-fab");
    var coverUrl = fab && fab.dataset.image;
    if (!coverUrl) return Promise.reject(new Error("sem imagem de capa"));
    return Promise.all([
      fetchImageBitmap(coverUrl),
      fetchImageBitmap(STORY_LOGO_SRC),
      ensureStoryFontsReady()
    ]).then(function (results) {
      return canvasToFile(renderStoryCanvas(results[0], results[1], data.title));
    });
  }

  // Cache do File da story — o navigator.share precisa rodar bem perto do
  // clique (o navegador pode revogar a permissão de "gesto do usuário" se
  // demorar), então a montagem do template começa assim que o popup abre
  // em vez de só quando a pessoa clica em "Instagram Stories".
  var storyFilePromise = null;
  function getStoryFile(data) {
    if (!storyFilePromise) storyFilePromise = buildStoryFile(data);
    return storyFilePromise;
  }

  // Compartilha os Stories com o template da marca (capa + concha do logo +
  // título) como imagem de fundo — só funciona onde o Web Share API aceita
  // arquivos (a maioria dos navegadores mobile atuais). Sem suporte a
  // arquivo, cai pro compartilhamento simples (só título + link).
  function shareStoryWithCover(data) {
    return getStoryFile(data).then(function (file) {
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error("compartilhamento de arquivo não suportado");
      }
      return copyLink(data.url).then(function () {
        return navigator.share({ files: [file], title: data.title, url: data.url });
      });
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
    getStoryFile(data).catch(function () {}); // aquece o cache do template da story
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
