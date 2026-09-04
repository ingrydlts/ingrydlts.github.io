// Editor visual do corpo do artigo — substitui a caixa de markdown puro por
// uma lista de blocos arrastável (parágrafos, títulos, listas e blocos ricos
// como FAQ/STEPS) com pré-visualização ao vivo, usando o CSS de verdade do
// site. Banner de vitrine e propaganda viram blocos como qualquer outro —
// ativar/desativar liga ou tira o bloco da lista, e arrastar decide a posição.
//
// Armazenamento: continua sendo o MESMO texto markdown de sempre (com os
// tokens [[STEPS]]...[[/STEPS]], [[FAQ]]...[[/FAQ]] etc. já usados nos 17
// artigos existentes) — este editor só lê/escreve esse texto de um jeito
// mais fácil de mexer. Nada muda no site (/artigos/post/) além do que já foi
// feito pra reconhecer as novas linhas "[[VITRINE-BANNER]]" e "[[PROPAGANDA]]".
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

  function setBannerState(blocks, newState, catalog, ref) {
    var copy = blocks.filter(function (b) {
      return !(b.type === "token" && (isBannerToken(b.raw) || b.raw === NO_VITRINE_BANNER_TOKEN));
    });
    if (newState === "padrao") return copy;
    var raw = newState === "ativado" ? buildBannerToken(catalog, ref) : NO_VITRINE_BANNER_TOKEN;
    var pos = Math.max(0, Math.ceil(copy.length / 2));
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
  // Cada clique em "+ Link afiliado" cria um bloco novo e independente (não
  // um estado único como Banner/Propaganda) — por isso pode haver quantos o
  // artigo precisar, cada um arrastável pra sua própria posição.
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

  function toggleToken(blocks, tokenLine) {
    if (hasToken(blocks, tokenLine)) {
      return blocks.filter(function (b) { return !(b.type === "token" && b.raw === tokenLine); });
    }
    var copy = blocks.slice();
    var pos = Math.max(0, Math.ceil(copy.length / 2));
    copy.splice(pos, 0, { id: uid(), type: "token", raw: tokenLine });
    return copy;
  }

  // Banner de vitrine tem 3 estados possíveis nesse artigo: "padrao" (segue
  // o que estiver configurado pro site inteiro, em "Vitrine dentro dos
  // artigos"), "ativado" (força aparecer AQUI, na posição arrastada) e
  // "desativado" (força NÃO aparecer aqui, mesmo que o site inteiro esteja
  // com esse banner ligado) — ver bannerState/setBannerState, acima.
  //
  // "[[PROPAGANDA]]" e "[[NO-PROPAGANDA]]" foram o mesmo tipo de controle
  // pra publicidade, antes do botão "+ Link afiliado" (abaixo) substituir
  // esse fluxo por blocos de link avulsos, repetíveis e arrastáveis. Os
  // tokens continuam reconhecidos aqui só pra não quebrar artigos antigos
  // que já os usam — não há mais como CRIAR um novo a partir desta tela.

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
        " linha(s) — edite o conteúdo na lista à esquerda.</p></div>"
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

  // --- estilos do editor (inline, sem depender de classes do Decap) --------
  var FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  var SUMMARY_BAR_STYLE = { display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid rgba(43,43,43,0.14)", borderRadius: "6px", background: "#fff", fontSize: "13px", fontFamily: FONT };
  var BTN_STYLE = { fontFamily: FONT, fontWeight: 600, fontSize: "13px", padding: "8px 14px", borderRadius: "4px", border: "1px solid #604034", background: "#604034", color: "#fff", cursor: "pointer" };
  var BTN_GHOST_STYLE = { fontFamily: FONT, fontWeight: 600, fontSize: "13px", padding: "8px 14px", borderRadius: "4px", border: "1px solid rgba(43,43,43,0.14)", background: "#fff", color: "#3A3632", cursor: "pointer", marginRight: "8px" };
  var OVERLAY_STYLE = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", zIndex: 999999, background: "#F4F1EC", display: "flex", flexDirection: "column", boxSizing: "border-box" };
  var OVERLAY_HEADER_STYLE = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(43,43,43,0.14)", background: "#fff", fontFamily: FONT, flexShrink: 0 };
  var BODY_ROW_STYLE = { display: "flex", flex: "1 1 auto", minHeight: 0 };
  var LEFT_COL_STYLE = { width: "42%", maxWidth: "560px", borderRight: "1px solid rgba(43,43,43,0.14)", overflowY: "auto", padding: "16px 20px", boxSizing: "border-box", fontFamily: FONT, background: "#F4F1EC" };
  var PREVIEW_COL_STYLE = { flex: "1 1 auto", overflowY: "auto", padding: "40px 24px", boxSizing: "border-box", background: "#fff" };
  var PREVIEW_INNER_STYLE = { maxWidth: "720px", margin: "0 auto" };
  var TOOLBAR_STYLE = { marginBottom: "16px" };
  var TOGGLE_LABEL_STYLE = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, marginBottom: "8px", cursor: "pointer" };
  var OVERRIDE_ROW_STYLE = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" };
  var OVERRIDE_LABEL_STYLE = { fontSize: "13px", fontWeight: 600, width: "112px", flexShrink: 0 };
  var OVERRIDE_SELECT_STYLE = { fontFamily: FONT, fontSize: "12px", padding: "4px 6px", borderRadius: "4px", border: "1px solid rgba(43,43,43,0.14)", background: "#fff" };
  var HINT_STYLE = { fontSize: "12px", color: "#6E6862", margin: "6px 0 0" };
  var ROW_STYLE = { display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 10px", marginBottom: "2px", border: "1px solid rgba(43,43,43,0.10)", borderRadius: "6px", background: "#fff", cursor: "grab" };
  var ROW_SPECIAL_STYLE = { borderColor: "#8AACD2", background: "#F0F5FA" };
  var ROW_PREMIUM_STYLE = { borderColor: "#501318", background: "#FBF0F1" };
  var PREMIUM_PANEL_STYLE = { border: "1px solid #501318", borderRadius: "6px", padding: "10px 12px", margin: "4px 0 12px", background: "#FBF0F1" };
  var PREMIUM_STATUS_STYLE = { fontSize: "12px", fontWeight: 600, margin: "0 0 8px", color: "#501318" };
  var PREMIUM_BTN_STYLE = { fontFamily: FONT, fontWeight: 600, fontSize: "12px", padding: "6px 10px", borderRadius: "4px", border: "1px solid #501318", background: "#fff", color: "#501318", cursor: "pointer" };
  var PREMIUM_BTN_DANGER_STYLE = { fontFamily: FONT, fontWeight: 600, fontSize: "12px", padding: "6px 10px", borderRadius: "4px", border: "1px solid #501318", background: "#501318", color: "#fff", cursor: "pointer" };
  var PREMIUM_ERROR_STYLE = { fontSize: "12px", color: "#501318", margin: "8px 0 0", fontWeight: 600 };
  var ROW_LABEL_STYLE = { fontSize: "12px", fontWeight: 600, width: "130px", flexShrink: 0, paddingTop: "6px", color: "#3A3632" };
  var ROW_TEXTAREA_STYLE = { flex: "1 1 auto", minHeight: "40px", fontSize: "13px", fontFamily: FONT, border: "1px solid rgba(43,43,43,0.14)", borderRadius: "4px", padding: "6px 8px", resize: "vertical", boxSizing: "border-box" };
  // "flex: 1 1 0" (não "1 1 auto") é o que faz esta coluna preencher o
  // espaço da linha — com "auto" o navegador tenta calcular a largura pelo
  // conteúdo, mas os filhos só têm largura em "%", que não conta pra esse
  // cálculo, e a coluna inteira colapsa quase a zero.
  var AFFILIATE_FIELDS_STYLE = { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" };
  var AFFILIATE_INPUT_STYLE = { fontSize: "13px", fontFamily: FONT, border: "1px solid rgba(43,43,43,0.14)", borderRadius: "4px", padding: "6px 8px", boxSizing: "border-box", width: "100%" };
  var ADD_AFFILIATE_BTN_STYLE = { fontFamily: FONT, fontWeight: 600, fontSize: "13px", padding: "8px 14px", borderRadius: "4px", border: "1px solid #501318", background: "#fff", color: "#501318", cursor: "pointer", marginBottom: "8px" };
  var DRAG_HANDLE_STYLE = { cursor: "grab", color: "#A8A29C", paddingTop: "6px", userSelect: "none" };
  var ROW_REMOVE_STYLE = { border: "none", background: "transparent", color: "#8A6A5C", cursor: "pointer", fontSize: "16px", lineHeight: 1, paddingTop: "4px" };
  var RAW_TEXTAREA_STYLE = { flex: "1 1 auto", width: "100%", boxSizing: "border-box", padding: "20px", fontFamily: "monospace", fontSize: "13px", border: "none", resize: "none" };

  var ArticleComposerControl = createClass({
    getInitialState: function () {
      var text = this.props.value || "";
      return {
        blocks: parseBody(text),
        lastSerialized: text,
        open: false,
        mode: "visual",
        rawDraft: "",
        dragIndex: null,
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
      this.setState({ open: true });
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
      this.setState({ open: false, mode: "visual" });
    },

    togglePremiumMarker: function () {
      var hasMarker = hasToken(this.state.blocks, PREMIUM_SPLIT_TOKEN);
      if (hasMarker) {
        // Remove só o marcador — o que estava depois dele volta a ser
        // conteúdo comum, visível e editável (nada se perde silenciosamente).
        this.updateValue(this.state.blocks.filter(function (b) { return !(b.type === "token" && b.raw === PREMIUM_SPLIT_TOKEN); }));
        this.setState({ premiumStatus: "idle", premiumError: "" });
        return;
      }
      var copy = this.state.blocks.slice();
      var pos = Math.max(0, Math.ceil(copy.length / 2));
      copy.splice(pos, 0, { id: uid(), type: "token", raw: PREMIUM_SPLIT_TOKEN });
      this.updateValue(copy);
      this.loadPremiumContent();
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
        this.setState({ premiumStatus: "error", premiumError: "Arraste algum bloco pra depois do 🔒 Bloqueio premium antes de salvar." });
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
        this.setState({ mode: "raw", rawDraft: serializeBlocks(this.state.blocks) });
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
      this.updateValue(this.state.blocks.filter(function (b) { return b.id !== id; }));
    },

    // Cada clique cria um bloco novo no FIM da lista (arrastável, como
    // qualquer outro) — pode ser clicado quantas vezes for preciso, sem
    // limite, ao contrário do Banner de vitrine (que é um estado único).
    addAffiliateBlock: function () {
      var copy = this.state.blocks.slice();
      copy.push({ id: uid(), type: "richblock", name: AFILIADO_NAME, inner: buildAffiliateInner("Ver oferta", "", "") });
      this.updateValue(copy);
    },

    handleDragStart: function (index, e) {
      this.setState({ dragIndex: index });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },

    handleDrop: function (targetIndex, e) {
      e.preventDefault();
      var from = this.state.dragIndex;
      this.setState({ dragIndex: null });
      if (from === null || from === undefined || from === targetIndex) return;
      var blocks = this.state.blocks.slice();
      var moved = blocks.splice(from, 1)[0];
      var insertAt = from < targetIndex ? targetIndex - 1 : targetIndex;
      blocks.splice(insertAt, 0, moved);
      this.updateValue(blocks);
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
        { style: OVERLAY_STYLE },
        h(
          "div",
          { style: OVERLAY_HEADER_STYLE },
          h("strong", null, "Editor visual do artigo"),
          h(
            "div",
            null,
            h("button", { type: "button", onClick: this.toggleMode, style: BTN_GHOST_STYLE }, this.state.mode === "visual" ? "Ver texto bruto" : "Ver visual"),
            h("button", { type: "button", onClick: this.close, style: BTN_STYLE }, "Fechar")
          )
        ),
        this.state.mode === "raw" ? this.renderRawEditor() : this.renderVisualEditor()
      );
    },

    renderRawEditor: function () {
      var self = this;
      return h("textarea", {
        style: RAW_TEXTAREA_STYLE,
        value: this.state.rawDraft,
        onChange: function (e) { self.setState({ rawDraft: e.target.value }); }
      });
    },

    renderVisualEditor: function () {
      var self = this;
      var blocks = this.state.blocks;
      var hasPremiumMarker = hasToken(blocks, PREMIUM_SPLIT_TOKEN);

      // O marcador de bloqueio premium e os tokens "sem banner/propaganda
      // aqui" não têm posição própria no artigo (não é algo pra arrastar) —
      // por isso não entram na lista de blocos arrastáveis, só nos controles
      // do topo. Tudo o mais aparece na lista, na ordem em que vai sair.
      var draggableBlocks = blocks.filter(function (b) {
        return !(b.type === "token" && (b.raw === NO_VITRINE_BANNER_TOKEN || b.raw === NO_PROPAGANDA_TOKEN));
      });
      var rows = [];
      draggableBlocks.forEach(function (b) {
        var realIndex = blocks.indexOf(b);
        rows.push(self.renderDropZone(realIndex));
        rows.push(self.renderBlockRow(b, realIndex));
      });
      rows.push(self.renderDropZone(blocks.length));

      return h(
        "div",
        { style: BODY_ROW_STYLE },
        h(
          "div",
          { style: LEFT_COL_STYLE },
          h(
            "div",
            { style: TOOLBAR_STYLE },
            this.renderBannerControl(),
            h(
              "label",
              { style: TOGGLE_LABEL_STYLE },
              h("input", { type: "checkbox", checked: hasPremiumMarker, onChange: this.togglePremiumMarker }),
              " 🔒 Bloqueio premium"
            ),
            h("p", { style: HINT_STYLE }, "\"Ativado aqui\" ativa e deixa arrastável (destacado em azul) até a posição onde deve aparecer. A pré-visualização à direita mostra o resultado."),
            h("button", { type: "button", onClick: this.addAffiliateBlock, style: ADD_AFFILIATE_BTN_STYLE }, "+ Link afiliado"),
            h("p", { style: HINT_STYLE }, "Clique quantas vezes precisar — cada clique cria um bloco novo, independente, que aparece no fim da lista abaixo e pode ser arrastado pra qualquer posição do artigo."),
            hasPremiumMarker ? this.renderPremiumPanel() : null
          ),
          rows
        ),
        h(
          "div",
          { style: PREVIEW_COL_STYLE },
          h("div", { className: "article-body", style: PREVIEW_INNER_STYLE, dangerouslySetInnerHTML: { __html: renderPreviewHTML(blocks, this.state.catalogs) } })
        )
      );
    },

    renderDropZone: function (index) {
      var self = this;
      var active = this.state.dragIndex !== null && this.state.dragIndex !== undefined;
      return h("div", {
        key: "drop-" + index,
        onDragOver: function (e) { e.preventDefault(); },
        onDrop: function (e) { self.handleDrop(index, e); },
        style: { height: active ? "12px" : "4px", transition: "height .1s" }
      });
    },

    renderBlockRow: function (b, i) {
      var self = this;
      var isPremiumMarker = b.type === "token" && b.raw === PREMIUM_SPLIT_TOKEN;
      var isAffiliate = b.type === "richblock" && b.name === AFILIADO_NAME;
      var isSpecial = (b.type === "token" && (isBannerToken(b.raw) || b.raw === PROPAGANDA_TOKEN)) || isAffiliate;
      var editableValue = b.type === "richblock" ? b.inner : b.raw;
      var showTextarea = (b.type === "text" || b.type === "list" || b.type === "richblock") && !isAffiliate;
      var rowStyle = isPremiumMarker
        ? Object.assign({}, ROW_STYLE, ROW_PREMIUM_STYLE)
        : isSpecial
        ? Object.assign({}, ROW_STYLE, ROW_SPECIAL_STYLE)
        : ROW_STYLE;

      return h(
        "div",
        {
          key: b.id,
          draggable: true,
          onDragStart: function (e) { self.handleDragStart(i, e); },
          onDragEnd: function () { self.setState({ dragIndex: null }); },
          style: rowStyle
        },
        h("span", { style: DRAG_HANDLE_STYLE }, "⠿"),
        h("span", { style: ROW_LABEL_STYLE }, blockLabel(b, self.state.catalogs)),
        isAffiliate
          ? this.renderAffiliateFields(b)
          : showTextarea
          ? h("textarea", {
              value: editableValue,
              onChange: function (e) { self.editBlock(b.id, e.target.value); },
              style: ROW_TEXTAREA_STYLE
            })
          : null,
        h("button", { type: "button", onClick: function () { self.removeBlock(b.id); }, style: ROW_REMOVE_STYLE }, "×")
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
        { style: AFFILIATE_FIELDS_STYLE },
        h("input", {
          type: "text",
          value: info.label,
          placeholder: "Texto do botão (ex: Ver oferta)",
          style: AFFILIATE_INPUT_STYLE,
          onChange: function (e) { update({ label: e.target.value }); }
        }),
        h("input", {
          type: "text",
          value: info.url,
          placeholder: "URL de afiliado (https://...)",
          style: AFFILIATE_INPUT_STYLE,
          onChange: function (e) { update({ url: e.target.value }); }
        }),
        h("input", {
          type: "text",
          value: info.image,
          placeholder: "Imagem (opcional, URL)",
          style: AFFILIATE_INPUT_STYLE,
          onChange: function (e) { update({ image: e.target.value }); }
        })
      );
    },

    renderBannerControl: function () {
      var self = this;
      var info = bannerState(this.state.blocks);
      var parsed = info.block ? parseBannerToken(info.block.raw) : { catalog: null, ref: null };
      return h(
        "div",
        null,
        h(
          "div",
          { style: OVERRIDE_ROW_STYLE },
          h("span", { style: OVERRIDE_LABEL_STYLE }, "Banner de vitrine"),
          h(
            "select",
            {
              value: info.state,
              style: OVERRIDE_SELECT_STYLE,
              onChange: function (e) {
                self.updateValue(setBannerState(self.state.blocks, e.target.value, parsed.catalog, parsed.ref));
              }
            },
            h("option", { value: "padrao" }, "Seguir padrão do site"),
            h("option", { value: "ativado" }, "Ativado aqui (arrastável)"),
            h("option", { value: "desativado" }, "Desativado aqui")
          )
        ),
        info.state === "ativado" ? this.renderProductPicker(parsed) : null
      );
    },

    renderProductPicker: function (parsed) {
      var self = this;
      var catalogs = this.state.catalogs;
      if (!catalogs) {
        return h("p", { style: Object.assign({}, HINT_STYLE, { margin: "0 0 10px 120px" }) }, "Carregando produtos…");
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
        { style: { margin: "0 0 10px 120px" } },
        h(
          "select",
          {
            value: value,
            style: OVERRIDE_SELECT_STYLE,
            onChange: function (e) {
              var v = e.target.value;
              if (!v) {
                self.updateValue(setBannerState(self.state.blocks, "ativado", null, null));
                return;
              }
              var sep = v.indexOf("|");
              self.updateValue(setBannerState(self.state.blocks, "ativado", v.slice(0, sep), v.slice(sep + 1)));
            }
          },
          options
        ),
        h("p", { style: HINT_STYLE }, "Escolha um produto pra este banner puxar título, imagem e link automaticamente dele.")
      );
    },

    renderPremiumPanel: function () {
      var self = this;
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
        { style: PREMIUM_PANEL_STYLE },
        h("p", { style: PREMIUM_STATUS_STYLE }, "Conteúdo pago: " + (STATUS_LABEL[status] || status)),
        h(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          h("button", { type: "button", onClick: this.loadPremiumContent, style: PREMIUM_BTN_STYLE, disabled: status === "loading" }, "Carregar já salvo"),
          h("button", { type: "button", onClick: this.savePremiumNow, style: PREMIUM_BTN_STYLE, disabled: status === "saving" }, "Salvar conteúdo pago"),
          h("button", { type: "button", onClick: this.removePremiumContent, style: PREMIUM_BTN_DANGER_STYLE, disabled: status === "saving" }, "Remover do servidor")
        ),
        this.state.premiumError ? h("p", { style: PREMIUM_ERROR_STYLE }, this.state.premiumError) : null,
        h("p", { style: HINT_STYLE }, "Tudo que estiver DEPOIS do bloco 🔒 vira a continuação paga. Só é enviado ao clicar em \"Salvar conteúdo pago\" — nunca vai pro Git/GitHub, só pro Worker do conteúdo pago (mesmo lugar que /admin/premium/ usa). Só funciona de verdade se \"Artigo premium (assinatura)\", mais abaixo no formulário, também estiver marcado.")
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
