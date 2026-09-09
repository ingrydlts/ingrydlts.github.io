// Editor visual do corpo do artigo — WYSIWYG mobile-first: os blocos
// aparecem na mesma coluna, com a mesma largura e estilo que a leitora vê
// no site (parágrafos, títulos, imagens, banners, FAQ, checklist etc.),
// em vez de uma lista de formulário ao lado de uma pré-visualização
// separada. Cada bloco é independente: toque para editar o conteúdo dele,
// arraste pela alcinha "⠿" (funciona com o dedo, no celular, e com o
// mouse) ou use as setas ▲▼ pra reordenar, e um botão "+" flutuante abre
// uma gaveta (bottom sheet) com todos os tipos de bloco que dá pra inserir
// — parágrafo, título, lista, blocos ricos (FAQ/Checklist/Steps/...),
// banner de vitrine, link afiliado, galeria e o bloqueio premium.
//
// Armazenamento: continua sendo o MESMO texto markdown de sempre (com os
// tokens [[STEPS]]...[[/STEPS]], [[FAQ]]...[[/FAQ]] etc. já usados nos
// artigos existentes) — este editor só lê/escreve esse texto de um jeito
// mais fácil de mexer, principalmente no celular. Nada muda no site
// (/artigos/post/) além do que já foi feito pra reconhecer as linhas
// "[[VITRINE-BANNER]]" e "[[PROPAGANDA]]".
//
// Decap CMS expõe "createClass" e "h" (alias de React.createElement)
// globalmente — por isso este arquivo não usa JSX nem precisa de build.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined") {
    console.error("[article-composer] Globais do Decap CMS (CMS/createClass/h) não encontrados — confira a ordem dos <script> em admin/index.html.");
    return;
  }

  var PAIR_TAGS = ["BAND", "STATS", "CARDS", "LIST", "STEPS", "FAQ", "RESOURCES", "CHECKLIST", "FEEDBACK", "AFILIADO", "POLL"];
  var AFILIADO_NAME = "AFILIADO";
  var TOOL_TOKENS = [
    "[[MAPA-FLE]]",
    "[[VAE-CHECKLIST]]",
    "[[VAE-ETAPAS]]",
    "[[VAE-SIMULADOR]]",
    "[[VAE-TAXA-SUCESSO]]",
    "[[VAE-NEWSLETTER]]",
    "[[EXAME-TEMPLATE-GRATIS]]",
    "[[EXAME-PRICING]]",
    "[[GALERIA]]",
    "[[GALERIA-2]]",
    "[[GYG-WIDGET]]"
  ];
  var VITRINE_BANNER_TOKEN = "[[VITRINE-BANNER]]";
  var PROPAGANDA_TOKEN = "[[PROPAGANDA]]";
  var NO_VITRINE_BANNER_TOKEN = "[[NO-VITRINE-BANNER]]";
  var NO_PROPAGANDA_TOKEN = "[[NO-PROPAGANDA]]";
  var PREMIUM_SPLIT_TOKEN = "[[PREMIUM-SPLIT]]";
  var SINGLE_TOKENS = TOOL_TOKENS.concat([
    VITRINE_BANNER_TOKEN,
    PROPAGANDA_TOKEN,
    NO_VITRINE_BANNER_TOKEN,
    NO_PROPAGANDA_TOKEN,
    PREMIUM_SPLIT_TOKEN
  ]);

  // --- banner de vitrine com produto específico ------------------------------
  // "[[VITRINE-BANNER]]" sozinho continua sendo o banner genérico (texto de
  // /content/vitrine-artigo.json). Escolher um produto no seletor vira
  // "[[VITRINE-BANNER|catalogo|ref]]" — catalogo é "digital"/"estudo"/
  // "compras", ref é o slug (produtos digitais) ou o título com
  // encodeURIComponent (produtos de estudo/compras, que não têm slug).
  function isBannerToken(raw) {
    return raw === VITRINE_BANNER_TOKEN || raw.indexOf("[[VITRINE-BANNER|") === 0;
  }

  function parseBannerToken(raw) {
    if (raw === VITRINE_BANNER_TOKEN) return { catalog: null, ref: null };
    var inner = raw.slice(2, -2);
    var parts = inner.split("|");
    if (parts.length < 3) return { catalog: null, ref: null };
    return { catalog: parts[1], ref: parts.slice(2).join("|") };
  }

  function buildBannerToken(catalog, ref) {
    if (!catalog || !ref) return VITRINE_BANNER_TOKEN;
    return "[[VITRINE-BANNER|" + catalog + "|" + ref + "]]";
  }

  function findProduct(catalogs, catalog, ref) {
    if (!catalogs) return null;
    var list = catalog === "digital" ? catalogs.digital : catalog === "estudo" ? catalogs.estudo : catalog === "compras" ? catalogs.compras : null;
    if (!list) return null;
    if (catalog === "digital") return list.find(function (p) { return p.slug === ref; }) || null;
    var title = decodeURIComponent(ref);
    return list.find(function (p) { return p.title === title; }) || null;
  }

  function bannerState(blocks) {
    var block = null;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === "token" && isBannerToken(blocks[i].raw)) { block = blocks[i]; break; }
    }
    if (block) return { state: "ativado", block: block };
    if (hasToken(blocks, NO_VITRINE_BANNER_TOKEN)) return { state: "desativado", block: null };
    return { state: "padrao", block: null };
  }

  // Troca o produto (ou volta a genérico) do banner de vitrine já existente
  // no artigo. Preserva a posição atual do bloco (oldIndex) — só cai para o
  // meio da lista quando não havia nenhum banner antes (inserção nova).
  function setBannerState(blocks, newState, catalog, ref, atIndex) {
    var oldIndex = -1;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === "token" && (isBannerToken(blocks[i].raw) || blocks[i].raw === NO_VITRINE_BANNER_TOKEN)) { oldIndex = i; break; }
    }
    var copy = blocks.filter(function (b) {
      return !(b.type === "token" && (isBannerToken(b.raw) || b.raw === NO_VITRINE_BANNER_TOKEN));
    });
    if (newState === "padrao") return copy;
    var raw = newState === "ativado" ? buildBannerToken(catalog, ref) : NO_VITRINE_BANNER_TOKEN;
    var pos = atIndex != null ? atIndex : oldIndex !== -1 ? Math.min(oldIndex, copy.length) : Math.max(0, Math.ceil(copy.length / 2));
    copy.splice(pos, 0, { id: uid(), type: "token", raw: raw });
    return copy;
  }

  // Catálogos de produtos (pra popular o seletor) — carregados uma vez só,
  // sob demanda, e compartilhados entre todos os artigos abertos na página.
  var sharedCatalogsPromise = null;
  function fetchCatalogs() {
    if (!sharedCatalogsPromise) {
      function safeFetch(url) {
        return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return d.items || []; }).catch(function () { return []; });
      }
      sharedCatalogsPromise = Promise.all([
        safeFetch("/content/produtos-digitais.json"),
        safeFetch("/content/produtos-estudo.json"),
        safeFetch("/content/produtos-compras.json")
      ]).then(function (results) {
        return { digital: results[0], estudo: results[1], compras: results[2] };
      });
    }
    return sharedCatalogsPromise;
  }

  // --- conteúdo pago: mesmo Worker e mesmos endpoints de /admin/premium/,
  // só que agora acessíveis também daqui, arrastando o marcador de bloqueio
  // pro meio do artigo. O texto pago NUNCA passa por onChange/body — ele é
  // sempre separado do texto livre ANTES de qualquer envio (ver updateValue),
  // e só é gravado quando alguém clica "Salvar conteúdo pago", direto no
  // Worker (não vai pro Git). Token e cache ficam em variáveis do módulo,
  // compartilhadas entre os widgets de todos os artigos abertos na página —
  // login com o GitHub uma vez só por sessão, não uma vez por artigo.
  var PREMIUM_WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";
  var sharedPremiumToken = null;
  var sharedPremiumContentPromise = null;

  function openPremiumLoginPopup() {
    return new Promise(function (resolve, reject) {
      var popup = window.open(PREMIUM_WORKER_BASE + "/auth", "github-oauth-premium", "width=600,height=700");
      function handleMessage(e) {
        if (e.data === "authorizing:github") {
          if (popup) popup.postMessage("confirm", "*");
          return;
        }
        if (typeof e.data === "string" && e.data.indexOf("authorization:github:") === 0) {
          window.removeEventListener("message", handleMessage);
          var rest = e.data.slice("authorization:github:".length);
          var sep = rest.indexOf(":");
          var status = rest.slice(0, sep);
          var payload;
          try { payload = JSON.parse(rest.slice(sep + 1)); } catch (err) { payload = {}; }
          if (popup) popup.close();
          if (status === "success" && payload.token) {
            sharedPremiumToken = payload.token;
            resolve(payload.token);
          } else {
            reject(new Error(payload.message || "Não foi possível entrar com o GitHub."));
          }
        }
      }
      window.addEventListener("message", handleMessage);
    });
  }

  function withPremiumToken() {
    return sharedPremiumToken ? Promise.resolve(sharedPremiumToken) : openPremiumLoginPopup();
  }

  function fetchAllPremiumContent(token) {
    return fetch(PREMIUM_WORKER_BASE + "/api/premium/content", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 ? "Essa conta não tem permissão de escrita no repositório." : "Falha ao carregar o conteúdo pago.");
        return r.json();
      })
      .then(function (data) { return data.items || {}; });
  }

  function savePremiumContentApi(token, slug, body) {
    return fetch(PREMIUM_WORKER_BASE + "/api/premium/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ slug: slug, body: body })
    }).then(function (r) {
      if (!r.ok) throw new Error("Falha ao salvar o conteúdo pago.");
    });
  }

  function deletePremiumContentApi(token, slug) {
    return fetch(PREMIUM_WORKER_BASE + "/api/premium/content?slug=" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    }).then(function (r) {
      if (!r.ok) throw new Error("Falha ao remover o conteúdo pago.");
    });
  }

  // Acha o índice do marcador de bloqueio premium (se houver) e separa os
  // blocos em duas listas. "free" é SEMPRE a única coisa que vira o valor do
  // campo body/Decap — "premium" nunca sai do estado local deste widget a
  // não ser via savePremiumContentApi, explicitamente.
  function splitAtPremiumMarker(blocks) {
    var idx = -1;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === "token" && blocks[i].raw === PREMIUM_SPLIT_TOKEN) { idx = i; break; }
    }
    if (idx === -1) return { free: blocks, premium: [] };
    return { free: blocks.slice(0, idx), premium: blocks.slice(idx + 1) };
  }

  var uidCounter = 0;
  function uid() {
    uidCounter += 1;
    return "b" + Date.now().toString(36) + uidCounter;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function inlineLite(text) {
    var s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }

  // --- link afiliado avulso: 1 linha, "texto do botão | url | imagem" -------
  // Cada bloco novo é independente (não um estado único como Banner) — por
  // isso pode haver quantos o artigo precisar, cada um arrastável pra sua
  // própria posição.
  function parseAffiliateInner(inner) {
    var parts = String(inner || "").split("|");
    return {
      label: (parts[0] || "").trim(),
      url: (parts[1] || "").trim(),
      image: (parts[2] || "").trim()
    };
  }

  function buildAffiliateInner(label, url, image) {
    return [label || "", url || "", image || ""].join("|");
  }

  // --- parse: texto markdown → array de blocos -----------------------------
  function parseBody(text) {
    var lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    var blocks = [];
    var listLines = null;
    var i = 0;

    function flushList() {
      if (listLines) {
        blocks.push({ id: uid(), type: "list", raw: listLines.join("\n") });
        listLines = null;
      }
    }

    while (i < lines.length) {
      var rawLine = lines[i];
      var line = rawLine.trim();

      if (!line) {
        flushList();
        i += 1;
        continue;
      }

      if (SINGLE_TOKENS.indexOf(line) !== -1 || isBannerToken(line)) {
        flushList();
        blocks.push({ id: uid(), type: "token", raw: line });
        i += 1;
        continue;
      }

      var openTag = null;
      for (var t = 0; t < PAIR_TAGS.length; t++) {
        if (line === "[[" + PAIR_TAGS[t] + "]]") {
          openTag = PAIR_TAGS[t];
          break;
        }
      }
      if (openTag) {
        flushList();
        var closeTag = "[[/" + openTag + "]]";
        var inner = [];
        i += 1;
        while (i < lines.length && lines[i].trim() !== closeTag) {
          inner.push(lines[i]);
          i += 1;
        }
        blocks.push({ id: uid(), type: "richblock", name: openTag, inner: inner.join("\n") });
        i += 1; // pula a linha de fechamento
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        if (!listLines) listLines = [];
        listLines.push(rawLine);
        i += 1;
        continue;
      }

      flushList();
      blocks.push({ id: uid(), type: "text", raw: rawLine });
      i += 1;
    }
    flushList();
    return blocks;
  }

  // --- serialize: array de blocos → texto markdown --------------------------
  function blockToRaw(b) {
    if (b.type === "richblock") return "[[" + b.name + "]]\n" + b.inner + "\n[[/" + b.name + "]]";
    return b.raw;
  }

  function serializeBlocks(blocks) {
    if (!blocks.length) return "";
    return blocks.map(blockToRaw).join("\n\n") + "\n";
  }

  function hasToken(blocks, tokenLine) {
    return blocks.some(function (b) { return b.type === "token" && b.raw === tokenLine; });
  }

  // Banner de vitrine tem 3 estados possíveis nesse artigo: "padrao" (segue
  // o que estiver configurado pro site inteiro, em "Vitrine dentro dos
  // artigos" — nenhum bloco presente), "ativado" (um bloco 🎯 na lista, na
  // posição arrastada) e "desativado" (um bloco 🚫 na lista, força NÃO
  // aparecer aqui mesmo que o site inteiro esteja com esse banner ligado).
  //
  // "[[PROPAGANDA]]" e "[[NO-PROPAGANDA]]" foram o mesmo tipo de controle
  // pra publicidade, antes do bloco "Link afiliado" (ver ADD_MENU) substituir
  // esse fluxo por blocos avulsos, repetíveis e arrastáveis. Os tokens
  // continuam reconhecidos aqui só pra não quebrar artigos antigos que já os
  // usam — não há mais como criar um novo a partir desta tela.

  var SPECIAL_TOKEN_LABEL = {};
  SPECIAL_TOKEN_LABEL[VITRINE_BANNER_TOKEN] = "🎯 Banner de vitrine";
  SPECIAL_TOKEN_LABEL[PROPAGANDA_TOKEN] = "📢 Propaganda";
  SPECIAL_TOKEN_LABEL[NO_VITRINE_BANNER_TOKEN] = "🚫 Sem banner de vitrine aqui";
  SPECIAL_TOKEN_LABEL[NO_PROPAGANDA_TOKEN] = "🚫 Sem propaganda aqui";
  SPECIAL_TOKEN_LABEL[PREMIUM_SPLIT_TOKEN] = "🔒 Bloqueio premium";

  function blockLabel(b, catalogs) {
    if (b.type === "token") {
      if (isBannerToken(b.raw)) {
        var parsed = parseBannerToken(b.raw);
        if (parsed.catalog) {
          var product = findProduct(catalogs, parsed.catalog, parsed.ref);
          return "🎯 Banner: " + (product ? product.title : "carregando produto…");
        }
        return "🎯 Banner de vitrine (genérico)";
      }
      return SPECIAL_TOKEN_LABEL[b.raw] || ("🧩 " + b.raw);
    }
    if (b.type === "list") return "• Lista";
    if (b.type === "richblock") {
      if (b.name === AFILIADO_NAME) {
        var affInfo = parseAffiliateInner(b.inner);
        return "🔗 Link afiliado: " + (affInfo.label || "(sem texto)");
      }
      return "📦 Bloco " + b.name;
    }
    var t = b.raw.trim();
    if (/^#{1,3}\s/.test(t)) return "Título: " + t.replace(/^#{1,3}\s*/, "").slice(0, 44);
    return "Parágrafo: " + (t.slice(0, 44) || "(vazio)");
  }

  // --- pré-visualização de UM bloco, com as classes reais do site -----------
  function renderBlockPreviewHTML(b, catalogs) {
    if (b.type === "token") {
      if (isBannerToken(b.raw)) {
        var parsed = parseBannerToken(b.raw);
        var product = parsed.catalog ? findProduct(catalogs, parsed.catalog, parsed.ref) : null;
        var title = product ? product.title : "Banner de vitrine — posição atual";
        var image = product ? product.image || "" : "";
        return (
          '<div class="in-article-banner"><div class="blog-banner">' +
          (image
            ? '<div class="img-slot"><img src="' + escapeHtml(image) + '" alt=""></div>'
            : '<div class="img-slot" style="display:flex;align-items:center;justify-content:center;color:var(--texto-secundario);font-size:12px;">Foto do item indicado</div>') +
          '<div class="blog-banner-body"><div><span class="eyebrow" style="color:#5F87AE;">Da vitrine</span>' +
          "<h3>" + escapeHtml(title) + "</h3></div>" +
          '<a class="btn btn-pill" style="background:#8AACD2;">Ver mais →</a></div></div></div>'
        );
      }
      if (b.raw === PROPAGANDA_TOKEN) {
        return (
          '<div class="ad-slot ad-slot-own" style="border-top:3px solid var(--merlot);">' +
          '<span class="eyebrow">Publicidade</span><h3>Propaganda — posição atual</h3></div>'
        );
      }
      if (b.raw === PREMIUM_SPLIT_TOKEN) {
        return (
          '<div style="display:flex; align-items:center; gap:12px; margin:28px 0; color:var(--merlot);">' +
          '<div style="flex:1; border-top:2px dashed var(--merlot);"></div>' +
          '<strong style="font-family:var(--font-body); font-size:12px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap;">🔒 A partir daqui, só assinantes</strong>' +
          '<div style="flex:1; border-top:2px dashed var(--merlot);"></div>' +
          "</div>"
        );
      }
      if (b.raw === NO_VITRINE_BANNER_TOKEN || b.raw === NO_PROPAGANDA_TOKEN) {
        return ""; // nada aparece no site de verdade — nada aparece aqui também
      }
      return (
        '<div style="border:1px dashed var(--borda); border-radius:6px; padding:10px 14px; font-size:13px; color:var(--texto-secundario);">🧩 Ferramenta embutida: ' +
        escapeHtml(b.raw) +
        "</div>"
      );
    }
    if (b.type === "list") {
      var items = b.raw.split("\n").map(function (l) { return l.trim().replace(/^[-*]\s+/, ""); });
      return "<ul>" + items.map(function (it) { return "<li>" + inlineLite(it) + "</li>"; }).join("") + "</ul>";
    }
    if (b.type === "richblock") {
      if (b.name === AFILIADO_NAME) {
        var affInfo = parseAffiliateInner(b.inner);
        var affText = affInfo.label || "Ver oferta";
        return (
          '<div class="in-article-banner"><div class="blog-banner">' +
          (affInfo.image
            ? '<div class="img-slot"><img src="' + escapeHtml(affInfo.image) + '" alt=""></div>'
            : '') +
          '<div class="blog-banner-body"><div><span class="badge badge-publicite">Publicidade</span></div>' +
          '<a class="btn btn-pill" style="background:var(--merlot,#501318); margin-top:10px;">' + escapeHtml(affText) + ' →</a></div></div></div>'
        );
      }
      var lineCount = b.inner.split("\n").filter(function (l) { return l.trim(); }).length;
      return (
        '<div style="border:1px dashed var(--borda); border-radius:6px; padding:12px 14px; background:#FAF8F4; margin:12px 0;">' +
        '<strong style="font-family:var(--font-body); font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--texto-secundario);">Bloco ' +
        escapeHtml(b.name) +
        '</strong><p class="muted" style="margin:6px 0 0; font-size:13px;">' +
        lineCount +
        " linha(s) — toque no bloco pra editar o conteúdo.</p></div>"
      );
    }
    var t = b.raw.trim();
    if (t.indexOf("### ") === 0) return "<h3>" + inlineLite(t.slice(4)) + "</h3>";
    if (t.indexOf("## ") === 0) return "<h2>" + inlineLite(t.slice(3)) + "</h2>";
    if (t.indexOf("# ") === 0) return "<h2>" + inlineLite(t.slice(2)) + "</h2>";
    if (!t) return "";
    return "<p>" + inlineLite(t) + "</p>";
  }

  function renderPreviewHTML(blocks, catalogs) {
    return blocks.map(function (b) { return renderBlockPreviewHTML(b, catalogs); }).join("");
  }

  // --- injeta o CSS real do site uma única vez, pra pré-visualização bater --
  function ensureSiteStyles() {
    if (document.getElementById("pd-widget-styles")) return;
    var fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap";
    document.head.appendChild(fonts);

    var site = document.createElement("link");
    site.id = "pd-widget-styles";
    site.rel = "stylesheet";
    site.href = "/assets/css/style.css";
    document.head.appendChild(site);
  }
  ensureSiteStyles();

  // --- CSS do editor mobile-first (injetado uma única vez) -------------------
  var FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  function ensureEditorStyles() {
    if (document.getElementById("pdac-editor-styles")) return;
    var style = document.createElement("style");
    style.id = "pdac-editor-styles";
    style.textContent = [
      ".pdac-overlay{position:fixed;inset:0;z-index:999999;background:#F4F1EC;display:flex;flex-direction:column;box-sizing:border-box;height:100vh;height:100dvh;font-family:" + FONT_STACK + ";}",
      ".pdac-header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));border-bottom:1px solid rgba(43,43,43,.14);background:#fff;flex-shrink:0;}",
      ".pdac-header strong{font-size:14px;}",
      ".pdac-header-actions{display:flex;gap:6px;flex-wrap:wrap;}",
      ".pdac-icon-btn{font-family:" + FONT_STACK + ";font-weight:600;font-size:13px;padding:8px 12px;border-radius:8px;border:1px solid rgba(43,43,43,.16);background:#fff;color:#3A3632;cursor:pointer;min-height:38px;}",
      ".pdac-icon-btn.primary{background:#604034;border-color:#604034;color:#fff;}",
      ".pdac-summary{display:flex;gap:8px;flex-wrap:wrap;padding:8px 14px;font-size:12px;color:#6E6862;background:#fff;border-bottom:1px solid rgba(43,43,43,.08);}",
      ".pdac-summary span{padding:3px 9px;border-radius:999px;background:#F4F1EC;}",
      ".pdac-canvas-scroll{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 12px 130px;box-sizing:border-box;}",
      ".pdac-canvas{max-width:720px;margin:0 auto;}",
      ".pdac-block{position:relative;margin:2px 0;border-radius:10px;border:1px solid transparent;}",
      ".pdac-block.is-selected{border-color:rgba(96,64,52,.4);background:rgba(255,255,255,.7);}",
      ".pdac-block.is-dragging{opacity:.45;}",
      ".pdac-block.is-special{border-left:3px solid #8AACD2;}",
      ".pdac-block.is-premium{border-left:3px solid #501318;}",
      ".pdac-block-bar{display:flex;align-items:center;gap:2px;padding:2px;}",
      ".pdac-bar-btn{border:none;background:transparent;cursor:pointer;font-size:15px;line-height:1;padding:6px;border-radius:6px;color:#8A7A6C;min-width:34px;min-height:34px;}",
      ".pdac-bar-btn:active{background:rgba(43,43,43,.08);}",
      ".pdac-bar-btn.drag{cursor:grab;touch-action:none;}",
      ".pdac-bar-label{font-size:11px;font-weight:600;color:#8A7A6C;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}",
      ".pdac-block-content{padding:2px 8px 12px;cursor:pointer;}",
      ".pdac-block-empty{color:#9C948A;font-style:italic;font-size:13px;padding:10px 8px;}",
      ".pdac-edit-area{padding:0 8px 14px;}",
      ".pdac-textarea{width:100%;box-sizing:border-box;font-family:" + FONT_STACK + ";font-size:15px;line-height:1.55;border:1px solid rgba(43,43,43,.2);border-radius:8px;padding:10px 12px;resize:vertical;}",
      ".pdac-input{width:100%;box-sizing:border-box;font-family:" + FONT_STACK + ";font-size:14px;border:1px solid rgba(43,43,43,.2);border-radius:8px;padding:9px 10px;margin-bottom:6px;}",
      ".pdac-hint{font-size:11.5px;color:#8A7A6C;margin:6px 2px 0;line-height:1.4;}",
      ".pdac-add-inline{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px auto 0;max-width:720px;width:100%;padding:14px;border:1.5px dashed rgba(96,64,52,.4);border-radius:10px;color:#604034;font-weight:600;font-size:14px;cursor:pointer;background:transparent;font-family:" + FONT_STACK + ";}",
      ".pdac-fab{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));width:58px;height:58px;border-radius:50%;background:#604034;color:#fff;border:none;font-size:28px;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;line-height:0;}",
      ".pdac-sheet-backdrop{position:fixed;inset:0;background:rgba(20,16,14,.45);z-index:1000000;display:flex;align-items:flex-end;justify-content:center;}",
      ".pdac-sheet{background:#fff;width:100%;max-width:560px;max-height:78vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:16px 16px 0 0;padding:8px 0 calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;font-family:" + FONT_STACK + ";}",
      ".pdac-sheet-grabber{width:36px;height:4px;background:rgba(43,43,43,.2);border-radius:2px;margin:8px auto 6px;}",
      ".pdac-sheet-header{display:flex;justify-content:space-between;align-items:center;padding:4px 16px 8px;}",
      ".pdac-sheet-header strong{font-size:15px;}",
      ".pdac-sheet-group-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8A7A6C;padding:14px 16px 6px;}",
      ".pdac-sheet-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:0 16px;}",
      ".pdac-sheet-item{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:1px solid rgba(43,43,43,.14);border-radius:10px;padding:10px 12px;background:#FAF8F4;cursor:pointer;font-family:" + FONT_STACK + ";min-height:56px;}",
      ".pdac-sheet-item:active{background:#F0EAE3;}",
      ".pdac-sheet-item .emoji{font-size:18px;}",
      ".pdac-sheet-item .label{font-size:12.5px;font-weight:600;color:#3A3632;}",
      ".pdac-raw-wrap{flex:1 1 auto;display:flex;min-height:0;}"
    ].join("\n");
    document.head.appendChild(style);
  }
  ensureEditorStyles();

  // --- estilos inline usados só na barra fechada do campo (fora do overlay) -
  var SUMMARY_BAR_STYLE = { display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid rgba(43,43,43,0.14)", borderRadius: "6px", background: "#fff", fontSize: "13px", fontFamily: FONT_STACK };
  var BTN_STYLE = { fontFamily: FONT_STACK, fontWeight: 600, fontSize: "13px", padding: "8px 14px", borderRadius: "4px", border: "1px solid #604034", background: "#604034", color: "#fff", cursor: "pointer" };
  var RAW_TEXTAREA_STYLE = { flex: "1 1 auto", width: "100%", boxSizing: "border-box", padding: "20px", fontFamily: "monospace", fontSize: "13px", border: "none", resize: "none" };
  var PREMIUM_BTN_STYLE = { fontFamily: FONT_STACK, fontWeight: 600, fontSize: "12px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #501318", background: "#fff", color: "#501318", cursor: "pointer" };
  var PREMIUM_BTN_DANGER_STYLE = { fontFamily: FONT_STACK, fontWeight: 600, fontSize: "12px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #501318", background: "#501318", color: "#fff", cursor: "pointer" };
  var PREMIUM_STATUS_STYLE = { fontSize: "12px", fontWeight: 600, margin: "0 0 8px", color: "#501318" };
  var PREMIUM_ERROR_STYLE = { fontSize: "12px", color: "#501318", margin: "8px 0 0", fontWeight: 600 };

  // --- exemplos/instruções por tipo de bloco rico (mesmo formato que o site
  // espera em assets/js/markdown.js) — usados como conteúdo inicial ao
  // inserir e como dica permanente enquanto o bloco está sendo editado.
  var RICH_TEMPLATE = {
    BAND: "Texto de destaque",
    STATS: "110 | Legenda",
    CARDS: "🎯 | Título | Descrição",
    LIST: "🎯 | Título | Descrição",
    STEPS: "Passo 1 | Descrição",
    FAQ: "Pergunta | Resposta",
    RESOURCES: "Título | Descrição | Saiba mais | https://",
    CHECKLIST: "Título da checklist\nItem 1\nItem 2",
    FEEDBACK: "Esse artigo te ajudou?",
    POLL: "Pergunta da enquete\nOpção 1\nOpção 2"
  };
  var RICH_HINT = {
    BAND: "Texto livre da faixa de destaque.",
    STATS: "Uma linha por item: número | legenda",
    CARDS: "Uma linha por item: emoji | título | descrição",
    LIST: "Uma linha por item: emoji | título | descrição",
    STEPS: "Uma linha por passo: título do passo | descrição",
    FAQ: "Uma linha por pergunta: pergunta | resposta",
    RESOURCES: "Uma linha por fonte: título | descrição | texto do link | URL",
    CHECKLIST: "1ª linha = título da checklist, as demais = itens marcáveis.",
    FEEDBACK: "Pergunta opcional — em branco usa a pergunta padrão.",
    POLL: "1ª linha = pergunta, as demais = opções de resposta única."
  };

  function richBlock(name) {
    return { id: uid(), type: "richblock", name: name, inner: RICH_TEMPLATE[name] || "" };
  }

  // --- menu do botão "+" flutuante -------------------------------------------
  var ADD_MENU = [
    {
      group: "Texto", items: [
        { key: "p", emoji: "📝", label: "Parágrafo", make: function () { return { id: uid(), type: "text", raw: "" }; } },
        { key: "h2", emoji: "H2", label: "Título", make: function () { return { id: uid(), type: "text", raw: "## Título" }; } },
        { key: "h3", emoji: "H3", label: "Subtítulo", make: function () { return { id: uid(), type: "text", raw: "### Subtítulo" }; } },
        { key: "ul", emoji: "•≡", label: "Lista", make: function () { return { id: uid(), type: "list", raw: "- Item 1\n- Item 2" }; } }
      ]
    },
    {
      group: "Blocos ricos", items: [
        { key: "FAQ", emoji: "❓", label: "Pergunta frequente", make: function () { return richBlock("FAQ"); } },
        { key: "CHECKLIST", emoji: "✅", label: "Checklist", make: function () { return richBlock("CHECKLIST"); } },
        { key: "RESOURCES", emoji: "📚", label: "Fontes / recursos", make: function () { return richBlock("RESOURCES"); } },
        { key: "STEPS", emoji: "🪜", label: "Passo a passo", make: function () { return richBlock("STEPS"); } },
        { key: "POLL", emoji: "🗳️", label: "Enquete", make: function () { return richBlock("POLL"); } },
        { key: "FEEDBACK", emoji: "🙏", label: "Pergunta de feedback", make: function () { return richBlock("FEEDBACK"); } },
        { key: "BAND", emoji: "🎗️", label: "Faixa de destaque", make: function () { return richBlock("BAND"); } },
        { key: "STATS", emoji: "📊", label: "Números", make: function () { return richBlock("STATS"); } },
        { key: "CARDS", emoji: "🗂️", label: "Cartões", make: function () { return richBlock("CARDS"); } },
        { key: "LIST", emoji: "📋", label: "Lista com ícones", make: function () { return richBlock("LIST"); } }
      ]
    },
    {
      group: "Vitrine & links", items: [
        { key: "banner-on", emoji: "🎯", label: "Banner de vitrine", special: "banner-on" },
        { key: "banner-off", emoji: "🚫", label: "Sem banner aqui", special: "banner-off" },
        { key: "AFILIADO", emoji: "🔗", label: "Card de afiliado", make: function () { return { id: uid(), type: "richblock", name: AFILIADO_NAME, inner: buildAffiliateInner("Ver oferta", "", "") }; } }
      ]
    },
    {
      group: "Mídia", items: [
        { key: "GALERIA", emoji: "🖼️", label: "Galeria de fotos", make: function () { return { id: uid(), type: "token", raw: "[[GALERIA]]" }; } },
        { key: "GALERIA-2", emoji: "🖼️", label: "Galeria de fotos 2", make: function () { return { id: uid(), type: "token", raw: "[[GALERIA-2]]" }; } }
      ]
    },
    {
      group: "Estrutura", items: [
        { key: "premium", emoji: "🔒", label: "Bloqueio premium", special: "premium" }
      ]
    }
  ];

  var ArticleComposerControl = createClass({
    getInitialState: function () {
      var text = this.props.value || "";
      return {
        blocks: parseBody(text),
        lastSerialized: text,
        open: false,
        mode: "visual",
        rawDraft: "",
        selectedId: null,
        draggingId: null,
        sheetOpen: false,
        premiumStatus: "idle", // idle | loading | loaded | empty | saving | saved | error
        premiumError: "",
        catalogs: null
      };
    },

    componentDidUpdate: function (prevProps) {
      if (prevProps.value !== this.props.value && this.props.value !== this.state.lastSerialized) {
        this.setState({ blocks: parseBody(this.props.value), lastSerialized: this.props.value });
      }
    },

    componentWillUnmount: function () {
      this._detachDragListeners();
    },

    // Correlaciona este campo com o item correspondente em content/posts.json
    // (pra saber o "slug" do artigo, necessário pra falar com o Worker do
    // conteúdo pago) comparando o texto do body — não existe, na API pública
    // de widgets do Decap, um jeito documentado de ler o "slug" do campo
    // irmão diretamente, então usamos o valor atual do próprio campo como
    // chave de correspondência dentro de entry.data.items.
    getCurrentItem: function () {
      try {
        var entryData = this.props.entry && this.props.entry.toJS ? this.props.entry.toJS().data : null;
        var items = entryData && entryData.items;
        if (!items || !items.length) return null;
        var value = this.props.value || "";
        var matches = items.filter(function (it) { return it.body === value; });
        return matches.length === 1 ? matches[0] : null;
      } catch (e) {
        return null;
      }
    },

    updateValue: function (newBlocks) {
      var split = splitAtPremiumMarker(newBlocks);
      var freeText = serializeBlocks(split.free);
      this.setState({ blocks: newBlocks, lastSerialized: freeText });
      this.props.onChange(freeText);
    },

    open: function () {
      var self = this;
      this.setState({ open: true, selectedId: null, sheetOpen: false });
      if (!this.state.catalogs) {
        fetchCatalogs().then(function (catalogs) { self.setState({ catalogs: catalogs }); });
      }
    },

    close: function () {
      var split = splitAtPremiumMarker(this.state.blocks);
      var hasUnsavedPremium = split.premium.length > 0 && this.state.premiumStatus !== "saved" && this.state.premiumStatus !== "loaded";
      if (hasUnsavedPremium) {
        var ok = window.confirm("O conteúdo depois do bloqueio premium ainda não foi salvo — ele SÓ existe aqui nesta tela. Fechar sem clicar em \"Salvar conteúdo pago\" descarta essa parte. Fechar mesmo assim?");
        if (!ok) return;
      }
      if (this.state.mode === "raw") {
        this.updateValue(parseBody(this.state.rawDraft));
      }
      this.setState({ open: false, mode: "visual", selectedId: null, sheetOpen: false });
    },

    // Busca o conteúdo pago já salvo (se houver) e junta depois do marcador,
    // pra quem está reabrindo um artigo premium já existente ver tudo junto
    // e poder arrastar o marcador pra uma posição diferente da atual.
    loadPremiumContent: function () {
      var self = this;
      var item = this.getCurrentItem();
      if (!item || !item.slug) {
        this.setState({ premiumStatus: "error", premiumError: "Salve o artigo (com um slug preenchido) antes de carregar o conteúdo pago." });
        return;
      }
      this.setState({ premiumStatus: "loading", premiumError: "" });
      withPremiumToken()
        .then(function (token) {
          if (!sharedPremiumContentPromise) sharedPremiumContentPromise = fetchAllPremiumContent(token);
          return sharedPremiumContentPromise;
        })
        .then(function (allItems) {
          var text = (allItems[item.slug] || "").trim();
          if (text) {
            var blocks = self.state.blocks.slice();
            var alreadyHasContent = splitAtPremiumMarker(blocks).premium.length > 0;
            if (!alreadyHasContent) {
              blocks = blocks.concat(parseBody(text));
              self.updateValue(blocks);
            }
          }
          self.setState({ premiumStatus: text ? "loaded" : "empty" });
        })
        .catch(function (err) {
          sharedPremiumContentPromise = null;
          self.setState({ premiumStatus: "error", premiumError: err.message || "Erro ao carregar o conteúdo pago." });
        });
    },

    savePremiumNow: function () {
      var self = this;
      var item = this.getCurrentItem();
      if (!item || !item.slug) {
        this.setState({ premiumStatus: "error", premiumError: "Salve o artigo (com um slug preenchido) antes de salvar o conteúdo pago." });
        return;
      }
      var split = splitAtPremiumMarker(this.state.blocks);
      var text = serializeBlocks(split.premium);
      if (!text.trim()) {
        this.setState({ premiumStatus: "error", premiumError: "Mova algum bloco pra depois do 🔒 Bloqueio premium antes de salvar." });
        return;
      }
      this.setState({ premiumStatus: "saving", premiumError: "" });
      withPremiumToken()
        .then(function (token) { return savePremiumContentApi(token, item.slug, text); })
        .then(function () {
          sharedPremiumContentPromise = null;
          self.setState({ premiumStatus: "saved" });
        })
        .catch(function (err) {
          self.setState({ premiumStatus: "error", premiumError: err.message || "Erro ao salvar o conteúdo pago." });
        });
    },

    removePremiumContent: function () {
      var self = this;
      var item = this.getCurrentItem();
      if (!item || !item.slug) return;
      if (!window.confirm("Remover o conteúdo pago salvo no servidor pra este artigo? As assinantes deixam de ver essa continuação até você salvar de novo.")) return;
      this.setState({ premiumStatus: "saving", premiumError: "" });
      withPremiumToken()
        .then(function (token) { return deletePremiumContentApi(token, item.slug); })
        .then(function () {
          sharedPremiumContentPromise = null;
          self.setState({ premiumStatus: "empty" });
        })
        .catch(function (err) {
          self.setState({ premiumStatus: "error", premiumError: err.message || "Erro ao remover o conteúdo pago." });
        });
    },

    toggleMode: function () {
      if (this.state.mode === "visual") {
        this.setState({ mode: "raw", rawDraft: serializeBlocks(this.state.blocks), selectedId: null, sheetOpen: false });
      } else {
        this.updateValue(parseBody(this.state.rawDraft));
        this.setState({ mode: "visual" });
      }
    },

    editBlock: function (id, newValue) {
      var blocks = this.state.blocks.map(function (b) {
        if (b.id !== id) return b;
        if (b.type === "richblock") return { id: b.id, type: b.type, name: b.name, inner: newValue };
        return { id: b.id, type: b.type, raw: newValue };
      });
      this.updateValue(blocks);
    },

    removeBlock: function (id) {
      var removed = this.state.blocks.filter(function (b) { return b.id === id; })[0];
      this.updateValue(this.state.blocks.filter(function (b) { return b.id !== id; }));
      if (this.state.selectedId === id) this.setState({ selectedId: null });
      if (removed && removed.type === "token" && removed.raw === PREMIUM_SPLIT_TOKEN) {
        this.setState({ premiumStatus: "idle", premiumError: "" });
      }
    },

    // Insere um bloco novo logo depois do bloco selecionado no momento (o
    // último em que a autora tocou) — ou no fim da lista, se nada estiver
    // selecionado — e já deixa ele selecionado/aberto pra edição.
    insertBlock: function (makeFn) {
      var blocks = this.state.blocks.slice();
      var newBlock = makeFn();
      var idx = blocks.length;
      var selId = this.state.selectedId;
      if (selId) {
        for (var i = 0; i < blocks.length; i++) {
          if (blocks[i].id === selId) { idx = i + 1; break; }
        }
      }
      blocks.splice(idx, 0, newBlock);
      this.updateValue(blocks);
      this.setState({ selectedId: newBlock.id, sheetOpen: false });
    },

    // Banner de vitrine é um estado único (só pode haver um "ativado" ou um
    // "desativado" por artigo) — tocar de novo no mesmo tipo só seleciona o
    // bloco que já existe, em vez de duplicar.
    addBannerBlock: function (mode) {
      var blocks = this.state.blocks;
      var info = bannerState(blocks);
      if (mode === "on" && info.state === "ativado") { this.setState({ selectedId: info.block.id, sheetOpen: false }); return; }
      var existingOff = blocks.filter(function (b) { return b.type === "token" && b.raw === NO_VITRINE_BANNER_TOKEN; })[0];
      if (mode === "off" && existingOff) { this.setState({ selectedId: existingOff.id, sheetOpen: false }); return; }
      var copy = blocks.filter(function (b) {
        return !(b.type === "token" && (isBannerToken(b.raw) || b.raw === NO_VITRINE_BANNER_TOKEN));
      });
      var idx = copy.length;
      var selId = this.state.selectedId;
      if (selId) {
        for (var i = 0; i < copy.length; i++) {
          if (copy[i].id === selId) { idx = i + 1; break; }
        }
      }
      var raw = mode === "on" ? VITRINE_BANNER_TOKEN : NO_VITRINE_BANNER_TOKEN;
      var newBlock = { id: uid(), type: "token", raw: raw };
      copy.splice(idx, 0, newBlock);
      this.updateValue(copy);
      this.setState({ selectedId: newBlock.id, sheetOpen: false });
    },

    addPremiumBlock: function () {
      var existing = this.state.blocks.filter(function (b) { return b.type === "token" && b.raw === PREMIUM_SPLIT_TOKEN; })[0];
      if (existing) { this.setState({ selectedId: existing.id, sheetOpen: false }); return; }
      var copy = this.state.blocks.slice();
      var idx = copy.length;
      var selId = this.state.selectedId;
      if (selId) {
        for (var i = 0; i < copy.length; i++) {
          if (copy[i].id === selId) { idx = i + 1; break; }
        }
      }
      var newBlock = { id: uid(), type: "token", raw: PREMIUM_SPLIT_TOKEN };
      copy.splice(idx, 0, newBlock);
      this.updateValue(copy);
      this.setState({ selectedId: newBlock.id, sheetOpen: false });
      this.loadPremiumContent();
    },

    insertFromMenu: function (item) {
      if (item.special === "banner-on") return this.addBannerBlock("on");
      if (item.special === "banner-off") return this.addBannerBlock("off");
      if (item.special === "premium") return this.addPremiumBlock();
      this.insertBlock(item.make);
    },

    moveBlock: function (id, dir) {
      var blocks = this.state.blocks.slice();
      var idx = -1;
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) { idx = i; break; }
      }
      if (idx === -1) return;
      var swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= blocks.length) return;
      var tmp = blocks[idx];
      blocks[idx] = blocks[swapIdx];
      blocks[swapIdx] = tmp;
      this.updateValue(blocks);
    },

    // --- arrastar pra reordenar, via Pointer Events (funciona igual com o
    // dedo no celular e com o mouse no desktop — API unificada, sem
    // depender do HTML5 drag-and-drop nativo, que não funciona em touch). A
    // cada movimento, recalcula em qual posição o bloco arrastado deveria
    // estar comparando a posição do dedo/cursor com o meio de cada linha.
    handleDragHandleDown: function (id, e) {
      e.preventDefault();
      this._dragPointerId = e.pointerId;
      if (!this._boundMove) this._boundMove = this._onPointerMoveDrag.bind(this);
      if (!this._boundUp) this._boundUp = this._onPointerUpDrag.bind(this);
      window.addEventListener("pointermove", this._boundMove);
      window.addEventListener("pointerup", this._boundUp);
      window.addEventListener("pointercancel", this._boundUp);
      this.setState({ draggingId: id });
    },

    _onPointerMoveDrag: function (e) {
      if (this.state.draggingId == null || e.pointerId !== this._dragPointerId) return;
      var container = this._canvasEl;
      if (!container) return;
      var rows = container.querySelectorAll("[data-block-row]");
      var rects = {};
      for (var r = 0; r < rows.length; r++) {
        rects[rows[r].getAttribute("data-block-row")] = rows[r].getBoundingClientRect();
      }
      var draggingId = this.state.draggingId;
      var blocks = this.state.blocks;
      var dragged = blocks.filter(function (b) { return b.id === draggingId; })[0];
      if (!dragged) return;
      var without = blocks.filter(function (b) { return b.id !== draggingId; });
      var y = e.clientY;
      var insertIdx = without.length;
      for (var i = 0; i < without.length; i++) {
        var rect = rects[without[i].id];
        if (!rect) continue;
        var mid = rect.top + rect.height / 2;
        if (y < mid) { insertIdx = i; break; }
      }
      without.splice(insertIdx, 0, dragged);
      var changed = without.length !== blocks.length || without.some(function (b, i) { return b.id !== blocks[i].id; });
      if (changed) this.updateValue(without);
    },

    _onPointerUpDrag: function (e) {
      if (e.pointerId !== this._dragPointerId) return;
      this._detachDragListeners();
      this.setState({ draggingId: null });
    },

    _detachDragListeners: function () {
      this._dragPointerId = null;
      if (this._boundMove) window.removeEventListener("pointermove", this._boundMove);
      if (this._boundUp) {
        window.removeEventListener("pointerup", this._boundUp);
        window.removeEventListener("pointercancel", this._boundUp);
      }
    },

    render: function () {
      var blocks = this.state.blocks;
      var bannerInfo = bannerState(blocks);
      var affiliateCount = blocks.filter(function (b) { return b.type === "richblock" && b.name === AFILIADO_NAME; }).length;
      var hasPremiumMarker = hasToken(blocks, PREMIUM_SPLIT_TOKEN);
      return h(
        "div",
        null,
        h(
          "div",
          { style: SUMMARY_BAR_STYLE },
          h("span", null, blocks.length + " bloco(s)"),
          h("span", null, "Banner: " + bannerInfo.state),
          h("span", null, "Links afiliados: " + affiliateCount),
          h("span", null, "Bloqueio premium: " + (hasPremiumMarker ? "ativado" : "desativado")),
          h("button", { type: "button", onClick: this.open, style: BTN_STYLE }, "Editar artigo visualmente")
        ),
        this.state.open ? this.renderOverlay() : null
      );
    },

    renderOverlay: function () {
      var self = this;
      return h(
        "div",
        { className: "pdac-overlay" },
        this.renderHeader(),
        this.renderSummary(),
        this.state.mode === "raw" ? this.renderRawEditor() : this.renderCanvas(),
        this.state.mode === "visual"
          ? h("button", { type: "button", className: "pdac-fab", "aria-label": "Adicionar bloco", onClick: function () { self.setState({ sheetOpen: true }); } }, "+")
          : null,
        this.state.sheetOpen ? this.renderAddSheet() : null
      );
    },

    renderHeader: function () {
      return h(
        "div",
        { className: "pdac-header" },
        h("strong", null, "Editor visual do artigo"),
        h(
          "div",
          { className: "pdac-header-actions" },
          h("button", { type: "button", className: "pdac-icon-btn", onClick: this.toggleMode }, this.state.mode === "visual" ? "Ver texto bruto" : "Ver visual"),
          h("button", { type: "button", className: "pdac-icon-btn primary", onClick: this.close }, "Fechar")
        )
      );
    },

    renderSummary: function () {
      var blocks = this.state.blocks;
      var bannerInfo = bannerState(blocks);
      var affiliateCount = blocks.filter(function (b) { return b.type === "richblock" && b.name === AFILIADO_NAME; }).length;
      var hasPremiumMarker = hasToken(blocks, PREMIUM_SPLIT_TOKEN);
      return h(
        "div",
        { className: "pdac-summary" },
        h("span", null, blocks.length + " bloco(s)"),
        h("span", null, "Banner: " + bannerInfo.state),
        h("span", null, "Afiliados: " + affiliateCount),
        h("span", null, "Premium: " + (hasPremiumMarker ? "ativado" : "desativado")),
        h("span", null, "Toque num bloco pra editar • arraste ⠿ ou use ▲▼ pra reordenar")
      );
    },

    renderRawEditor: function () {
      var self = this;
      return h(
        "div",
        { className: "pdac-raw-wrap" },
        h("textarea", {
          style: RAW_TEXTAREA_STYLE,
          value: this.state.rawDraft,
          onChange: function (e) { self.setState({ rawDraft: e.target.value }); }
        })
      );
    },

    renderCanvas: function () {
      var self = this;
      var blocks = this.state.blocks;
      return h(
        "div",
        {
          className: "pdac-canvas-scroll",
          ref: function (el) { self._canvasEl = el; },
          // Toque num espaço vazio (fora de qualquer bloco) desmarca o bloco
          // selecionado — assim o próximo "+" volta a inserir no fim, em vez
          // de logo depois do último bloco editado.
          onClick: function (e) { if (e.target === e.currentTarget) self.setState({ selectedId: null }); }
        },
        h("div", { className: "article-body pdac-canvas" }, blocks.map(function (b) { return self.renderBlock(b); })),
        h(
          "button",
          { type: "button", className: "pdac-add-inline", onClick: function () { self.setState({ selectedId: null, sheetOpen: true }); } },
          "+ Adicionar bloco no fim do artigo"
        )
      );
    },

    renderBlock: function (b) {
      var self = this;
      var selected = this.state.selectedId === b.id;
      var dragging = this.state.draggingId === b.id;
      var isPremiumMarker = b.type === "token" && b.raw === PREMIUM_SPLIT_TOKEN;
      var isBanner = b.type === "token" && isBannerToken(b.raw);
      var isBannerOff = b.type === "token" && b.raw === NO_VITRINE_BANNER_TOKEN;
      var isAffiliate = b.type === "richblock" && b.name === AFILIADO_NAME;
      var isSpecial = isBanner || isBannerOff || isAffiliate;
      var canEdit = b.type === "text" || b.type === "list" || b.type === "richblock" || isBanner || isPremiumMarker;
      var className = "pdac-block" +
        (selected ? " is-selected" : "") +
        (dragging ? " is-dragging" : "") +
        (isSpecial ? " is-special" : "") +
        (isPremiumMarker ? " is-premium" : "");

      function selectBlock() { self.setState({ selectedId: selected ? null : b.id }); }

      return h(
        "div",
        { key: b.id, "data-block-row": b.id, className: className },
        h(
          "div",
          { className: "pdac-block-bar" },
          h("button", {
            type: "button",
            className: "pdac-bar-btn drag",
            onPointerDown: function (e) { self.handleDragHandleDown(b.id, e); },
            "aria-label": "Arrastar pra reordenar"
          }, "⠿"),
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.moveBlock(b.id, -1); }, "aria-label": "Mover pra cima" }, "▲"),
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.moveBlock(b.id, 1); }, "aria-label": "Mover pra baixo" }, "▼"),
          h("span", { className: "pdac-bar-label" }, blockLabel(b, self.state.catalogs)),
          canEdit ? h("button", { type: "button", className: "pdac-bar-btn", onClick: selectBlock, "aria-label": "Editar bloco" }, selected ? "✅" : "✏️") : null,
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.removeBlock(b.id); }, "aria-label": "Excluir bloco" }, "🗑")
        ),
        selected && canEdit ? this.renderBlockEditor(b) : this.renderBlockReadOnly(b, selectBlock)
      );
    },

    renderBlockReadOnly: function (b, onSelect) {
      var html = renderBlockPreviewHTML(b, this.state.catalogs);
      if (!html) {
        return h("div", { className: "pdac-block-content pdac-block-empty", onClick: onSelect }, blockLabel(b, this.state.catalogs) + " — não aparece no site.");
      }
      return h("div", { className: "pdac-block-content", onClick: onSelect, dangerouslySetInnerHTML: { __html: html } });
    },

    renderBlockEditor: function (b) {
      var self = this;
      if (b.type === "richblock" && b.name === AFILIADO_NAME) {
        return h("div", { className: "pdac-edit-area" }, this.renderAffiliateFields(b));
      }
      if (b.type === "token" && isBannerToken(b.raw)) {
        return h("div", { className: "pdac-edit-area" }, this.renderProductPicker(parseBannerToken(b.raw)));
      }
      if (b.type === "token" && b.raw === PREMIUM_SPLIT_TOKEN) {
        return h("div", { className: "pdac-edit-area" }, this.renderPremiumPanel());
      }
      var value = b.type === "richblock" ? b.inner : b.raw;
      return h(
        "div",
        { className: "pdac-edit-area" },
        h("textarea", {
          className: "pdac-textarea",
          value: value,
          autoFocus: true,
          style: { minHeight: b.type === "richblock" ? "96px" : "56px" },
          onChange: function (e) { self.editBlock(b.id, e.target.value); }
        }),
        b.type === "richblock" && RICH_HINT[b.name] ? h("p", { className: "pdac-hint" }, RICH_HINT[b.name]) : null,
        b.type === "text" ? h("p", { className: "pdac-hint" }, "Use \"## \" pra título ou \"### \" pra subtítulo no início da linha.") : null
      );
    },

    renderAffiliateFields: function (b) {
      var self = this;
      var info = parseAffiliateInner(b.inner);
      function update(patch) {
        var next = { label: info.label, url: info.url, image: info.image };
        Object.assign(next, patch);
        self.editBlock(b.id, buildAffiliateInner(next.label, next.url, next.image));
      }
      return h(
        "div",
        null,
        h("input", {
          type: "text",
          className: "pdac-input",
          value: info.label,
          placeholder: "Texto do botão (ex: Ver oferta)",
          onChange: function (e) { update({ label: e.target.value }); }
        }),
        h("input", {
          type: "text",
          className: "pdac-input",
          value: info.url,
          placeholder: "URL de afiliado (https://...)",
          onChange: function (e) { update({ url: e.target.value }); }
        }),
        h("input", {
          type: "text",
          className: "pdac-input",
          value: info.image,
          placeholder: "Imagem (opcional, URL)",
          onChange: function (e) { update({ image: e.target.value }); }
        })
      );
    },

    renderProductPicker: function (parsed) {
      var self = this;
      var catalogs = this.state.catalogs;
      if (!catalogs) {
        return h("p", { className: "pdac-hint" }, "Carregando produtos…");
      }
      var value = parsed.catalog && parsed.ref ? parsed.catalog + "|" + parsed.ref : "";
      var options = [h("option", { key: "none", value: "" }, "Genérico (texto de \"Vitrine dentro dos artigos\")")];
      if (catalogs.digital.length) {
        options.push(
          h(
            "optgroup",
            { key: "og-digital", label: "Produtos digitais" },
            catalogs.digital.map(function (p) { return h("option", { key: "digital-" + p.slug, value: "digital|" + p.slug }, p.title); })
          )
        );
      }
      if (catalogs.estudo.length) {
        options.push(
          h(
            "optgroup",
            { key: "og-estudo", label: "Produtos de estudo" },
            catalogs.estudo.map(function (p, i) { return h("option", { key: "estudo-" + i, value: "estudo|" + encodeURIComponent(p.title) }, p.title); })
          )
        );
      }
      if (catalogs.compras.length) {
        options.push(
          h(
            "optgroup",
            { key: "og-compras", label: "Produtos de compras" },
            catalogs.compras.map(function (p, i) { return h("option", { key: "compras-" + i, value: "compras|" + encodeURIComponent(p.title) }, p.title); })
          )
        );
      }
      return h(
        "div",
        null,
        h(
          "select",
          {
            className: "pdac-input",
            value: value,
            onChange: function (e) {
              var v = e.target.value;
              var newBlocks = !v
                ? setBannerState(self.state.blocks, "ativado", null, null)
                : setBannerState(self.state.blocks, "ativado", v.slice(0, v.indexOf("|")), v.slice(v.indexOf("|") + 1));
              self.updateValue(newBlocks);
              var newBannerBlock = newBlocks.filter(function (bb) { return bb.type === "token" && isBannerToken(bb.raw); })[0];
              self.setState({ selectedId: newBannerBlock ? newBannerBlock.id : null });
            }
          },
          options
        ),
        h("p", { className: "pdac-hint" }, "Escolha um produto pra este banner puxar título, imagem e link automaticamente dele.")
      );
    },

    renderPremiumPanel: function () {
      var status = this.state.premiumStatus;
      var STATUS_LABEL = {
        idle: "ainda não carregado nem salvo",
        loading: "carregando conteúdo já salvo…",
        loaded: "conteúdo já salvo foi carregado abaixo",
        empty: "nenhum conteúdo salvo ainda pra este artigo",
        saving: "salvando…",
        saved: "salvo no servidor ✓",
        error: "erro — veja abaixo"
      };
      return h(
        "div",
        null,
        h("p", { style: PREMIUM_STATUS_STYLE }, "Conteúdo pago: " + (STATUS_LABEL[status] || status)),
        h(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          h("button", { type: "button", onClick: this.loadPremiumContent, style: PREMIUM_BTN_STYLE, disabled: status === "loading" }, "Carregar já salvo"),
          h("button", { type: "button", onClick: this.savePremiumNow, style: PREMIUM_BTN_STYLE, disabled: status === "saving" }, "Salvar conteúdo pago"),
          h("button", { type: "button", onClick: this.removePremiumContent, style: PREMIUM_BTN_DANGER_STYLE, disabled: status === "saving" }, "Remover do servidor")
        ),
        this.state.premiumError ? h("p", { style: PREMIUM_ERROR_STYLE }, this.state.premiumError) : null,
        h("p", { className: "pdac-hint" }, "Tudo que estiver DEPOIS deste bloco vira a continuação paga. Só é enviado ao clicar em \"Salvar conteúdo pago\" — nunca vai pro Git/GitHub, só pro Worker do conteúdo pago (mesmo lugar que /admin/premium/ usa). Só funciona de verdade se \"Artigo premium (assinatura)\", mais abaixo no formulário, também estiver marcado.")
      );
    },

    renderAddSheet: function () {
      var self = this;
      return h(
        "div",
        { className: "pdac-sheet-backdrop", onClick: function () { self.setState({ sheetOpen: false }); } },
        h(
          "div",
          { className: "pdac-sheet", onClick: function (e) { e.stopPropagation(); } },
          h("div", { className: "pdac-sheet-grabber" }),
          h(
            "div",
            { className: "pdac-sheet-header" },
            h("strong", null, "Adicionar bloco"),
            h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.setState({ sheetOpen: false }); }, "aria-label": "Fechar" }, "✕")
          ),
          ADD_MENU.map(function (group) {
            return h(
              "div",
              { key: group.group },
              h("div", { className: "pdac-sheet-group-title" }, group.group),
              h(
                "div",
                { className: "pdac-sheet-grid" },
                group.items.map(function (item) {
                  return h(
                    "button",
                    { type: "button", key: item.key, className: "pdac-sheet-item", onClick: function () { self.insertFromMenu(item); } },
                    h("span", { className: "emoji" }, item.emoji),
                    h("span", { className: "label" }, item.label)
                  );
                })
              )
            );
          })
        )
      );
    }
  });

  var ArticleComposerPreview = createClass({
    render: function () {
      var blocks = parseBody(this.props.value);
      return h("div", { className: "article-body", dangerouslySetInnerHTML: { __html: renderPreviewHTML(blocks) } });
    }
  });

  CMS.registerWidget("article-composer", ArticleComposerControl, ArticleComposerPreview);
})();
