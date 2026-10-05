// Editor visual do corpo do artigo — WYSIWYG mobile-first: os blocos
// aparecem na mesma coluna, com a mesma largura e estilo que a leitora vê
// no site (parágrafos, títulos, imagens, banners, FAQ, checklist etc.),
// em vez de uma lista de formulário ao lado de uma pré-visualização
// separada. Cada bloco é independente: toque para editar o conteúdo dele,
// arraste pela alcinha "⠿" (funciona com o dedo, no celular, e com o
// mouse) ou use as setas ▲▼ pra reordenar, e um botão "+" flutuante abre
// uma gaveta (bottom sheet) com todos os tipos de bloco que dá pra inserir
// — parágrafo, título, lista, blocos ricos (FAQ/Checklist/Steps/...),
// banner de vitrine, link afiliado e galeria.
//
// Armazenamento: continua sendo o MESMO texto markdown de sempre (com os
// tokens [[STEPS]]...[[/STEPS]], [[FAQ]]...[[/FAQ]] etc. já usados nos
// artigos existentes) — este editor só lê/escreve esse texto de um jeito
// mais fácil de mexer, principalmente no celular. Nada muda no site
// (/artigos/post/) além do que já foi feito pra reconhecer as linhas
// "[[VITRINE-BANNER]]" e "[[PROPAGANDA]]".
//
// Mesa de revisão (2026-10): a tela aberta tem três colunas. À esquerda, a
// ESTRUTURA do artigo (títulos e módulos, com a contagem de trechos a
// conferir). No centro, o TEXTO como a leitora vê; a barra de cada bloco só
// aparece no bloco em que você está. À direita, o PAINEL: "Conferir" mostra
// um trecho a conferir por vez, com a fonte que o hub pesquisou (regras em
// admin/widgets/conferencia.js), e "Módulos" lista os blocos de
// microengajamento pra tirar, subir, descer ou acrescentar a
// ferramenta-assinatura. No celular as três colunas viram três abas.
// "Desfazer" volta a última mudança.
//
// Decap CMS expõe "createClass" e "h" (alias de React.createElement)
// globalmente — por isso este arquivo não usa JSX nem precisa de build.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined") {
    console.error("[article-composer] Globais do Decap CMS (CMS/createClass/h) não encontrados — confira a ordem dos <script> em admin/index.html.");
    return;
  }

  var PAIR_TAGS = ["BAND", "STATS", "CARDS", "LIST", "STEPS", "FAQ", "RESOURCES", "CHECKLIST", "FEEDBACK", "AFILIADO", "POLL",
    "RESUMO", "CONFIANCA", "MITO", "QUIZ", "SELETOR", "PRAZO", "LINHA-DO-TEMPO", "ROTEIRO", "PERGUNTA", "PROXIMO-PASSO", "TRILHA"];
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
    "[[DIPLOMA-DOSSIE]]",
    "[[AU-PAIR-FLE-SCROLL]]",
    "[[GALERIA]]",
    "[[GALERIA-2]]",
    "[[GYG-WIDGET]]"
  ];
  var VITRINE_BANNER_TOKEN = "[[VITRINE-BANNER]]";
  var PROPAGANDA_TOKEN = "[[PROPAGANDA]]";
  var NO_VITRINE_BANNER_TOKEN = "[[NO-VITRINE-BANNER]]";
  var NO_PROPAGANDA_TOKEN = "[[NO-PROPAGANDA]]";
  var SINGLE_TOKENS = TOOL_TOKENS.concat([
    VITRINE_BANNER_TOKEN,
    PROPAGANDA_TOKEN,
    NO_VITRINE_BANNER_TOKEN,
    NO_PROPAGANDA_TOKEN
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

  // --- o que cada bloco é, pra estrutura e pro painel de módulos ---------------
  var MX_NAMES = { RESUMO: 1, CONFIANCA: 1, MITO: 1, POLL: 1, CHECKLIST: 1, "PROXIMO-PASSO": 1, TRILHA: 1, FEEDBACK: 1 };
  var SIG_NAMES = { PRAZO: 1, QUIZ: 1, SELETOR: 1, "LINHA-DO-TEMPO": 1, ROTEIRO: 1 };
  // Ferramentas próprias já existentes também contam como ferramenta-assinatura (mesma lista do quadro de artigos).
  var SIG_TOKENS = ["[[MAPA-FLE]]", "[[VAE-SIMULADOR]]", "[[DIPLOMA-DOSSIE]]", "[[AU-PAIR-FLE-SCROLL]]", "[[EXAME-TEMPLATE-GRATIS]]"];
  function kindOf(b) {
    if (b.type === "richblock") return SIG_NAMES[b.name] ? "sig" : MX_NAMES[b.name] ? "mx" : "rich";
    if (b.type === "token") return SIG_TOKENS.indexOf(b.raw) !== -1 ? "sig" : "token";
    if (b.type === "list") return "list";
    var t = b.raw.trim();
    return /^#{1,2}\s/.test(t) ? "h2" : /^###\s/.test(t) ? "h3" : "p";
  }
  var KIND_LABEL = { sig: "ferramenta-assinatura", mx: "microengajamento", rich: "bloco do artigo", token: "bloco do site" };
  function conf() { return window.PDConferencia; }
  // Gravação no site (admin/widgets/studio-kit.js carrega depois deste arquivo: só usar na hora).
  function saver() { return window.PDStudio && window.PDStudio.Save; }
  function marksOf(b) { return conf() ? conf().marksIn(blockToRaw(b)) : []; }

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

  // --- imagem solta no texto: 1 linha, "![legenda](/images/uploads/foto.jpg)" ---
  function parseImageRaw(raw) {
    var m = String(raw || "").trim().match(/^!\[([^\]]*)\]\((.*)\)$/);
    return m ? { caption: m[1], url: m[2] } : null;
  }
  function buildImageRaw(caption, url) {
    return "![" + String(caption || "").replace(/[\[\]\r\n]/g, " ") + "](" + (url || "") + ")";
  }
  var currentComposer = null; // instância aberta; a prévia usa pra mostrar foto ainda não publicada
  function imageSrc(comp, url) {
    var K = window.PDStudio;
    return K && K.assetUrl && comp ? K.assetUrl(comp.props, url) : url;
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
      return (RICH_NAME[b.name] || "📦 Bloco " + b.name);
    }
    var t = b.raw.trim();
    var imgInfo = parseImageRaw(t);
    if (imgInfo) return "🖼️ Imagem: " + (imgInfo.caption.slice(0, 44) || (imgInfo.url ? "(sem legenda)" : "(escolha a foto)"));
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
      var richLines = b.inner.split("\n").filter(function (l) { return l.trim(); });
      return (
        '<div class="pdac-rich"><strong>' + escapeHtml(plainName(b)) + "</strong>" +
        richLines.slice(0, 6).map(function (l) { return "<p>" + inlineLite(l) + "</p>"; }).join("") +
        (richLines.length > 6 ? '<p class="more">+ ' + (richLines.length - 6) + " linha(s) — toque no bloco pra ver e editar tudo.</p>" : "") +
        (richLines.length ? "" : '<p class="more">Vazio — toque pra preencher.</p>') +
        "</div>"
      );
    }
    var t = b.raw.trim();
    if (t.indexOf("### ") === 0) return "<h3>" + inlineLite(t.slice(4)) + "</h3>";
    var imgPrev = parseImageRaw(t);
    if (imgPrev) {
      return imgPrev.url
        ? '<figure class="article-figure"><img src="' + escapeHtml(imageSrc(currentComposer, imgPrev.url)) + '" alt="' + escapeHtml(imgPrev.caption) + '">' +
          (imgPrev.caption ? "<figcaption>" + escapeHtml(imgPrev.caption) + "</figcaption>" : "") + "</figure>"
        : "";
    }
    if (t.indexOf("## ") === 0) return "<h2>" + inlineLite(t.slice(3).replace(/\s*\{sem-rea[cç][aã]o\}\s*$/i, "")) + "</h2>";
    if (t.indexOf("# ") === 0) return "<h2>" + inlineLite(t.slice(2)) + "</h2>";
    if (!t) return "";
    return "<p>" + inlineLite(t) + "</p>";
  }

  // Nome curto do bloco, sem emoji (estrutura, painel de módulos e prévia).
  function plainName(b) {
    if (b.type === "richblock") return MENU_LABEL[b.name] || "Bloco " + b.name;
    return blockLabel(b).replace(/^[^A-Za-zÀ-ú]+/, "");
  }

  // Destaca cada trecho a conferir dentro do HTML do bloco. `first` é a posição do 1º trecho deste
  // bloco na lista geral; `current`, o trecho aberto no painel.
  function highlightMarks(html, first, current) {
    if (!conf()) return html;
    var n = 0;
    return html.replace(conf().markRe(), function (tok) {
      var i = first + n++;
      var plain = tok.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      var text = conf().markText(plain);
      return '<mark class="pdac-mk' + (i === current ? " cur" : "") + '" data-mk="' + i + '" title="Trecho a conferir: abrir no painel">conferir: ' +
        escapeHtml(text.length > 52 ? text.slice(0, 50) + "…" : text) + "</mark>";
    });
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
      ".pdac-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));border-bottom:1px solid #E6E0D6;background:#FBFAF7;flex-shrink:0;}",
      ".pdac-title{min-width:0;flex:1 1 200px;}",
      ".pdac-title small{display:block;font-size:11.5px;color:#6E6862;}",
      ".pdac-title strong{display:block;font:600 16px/1.25 'Fraunces',Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".pdac-pill{font-size:11px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap;background:#E3EDDA;color:#3F6E2B;}",
      ".pdac-pill.bad{background:#F5E1DD;color:#A63A2E;}",
      ".pdac-icon-btn:disabled{opacity:.45;cursor:not-allowed;}",
      // três colunas: estrutura · texto · painel
      ".pdac-main{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:240px minmax(0,1fr) 380px;}",
      ".pdac-main.raw{grid-template-columns:minmax(0,1fr);}",
      ".pdac-main.has-prev{grid-template-columns:220px minmax(0,1fr) minmax(380px,46%);}",
      ".pdac-out{border-right:1px solid #E6E0D6;background:#FBFAF7;overflow-y:auto;padding:12px 8px 30px 12px;display:flex;flex-direction:column;gap:8px;min-height:0;}",
      ".pdac-colh{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#6E6862;font-weight:700;display:flex;align-items:center;gap:8px;}",
      ".pdac-colh span{font-weight:600;letter-spacing:0;text-transform:none;background:#EFEBE4;border-radius:999px;padding:0 8px;font-size:11px;}",
      ".pdac-sw{display:flex;align-items:center;gap:7px;font-size:12px;color:#6E6862;cursor:pointer;}",
      ".pdac-sw input{accent-color:#577328;width:15px;height:15px;}",
      ".pdac-oi{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:6px;align-items:center;border:0;background:none;text-align:left;border-radius:7px;padding:4px 6px;font:12px " + FONT_STACK + ";color:#6E6862;width:100%;cursor:pointer;}",
      ".pdac-oi:hover{background:#EFEBE4;}",
      ".pdac-oi[aria-current=true]{background:#E3EDDA;color:#3F6E2B;}",
      ".pdac-oi i{font:700 9.5px ui-monospace,Menlo,monospace;font-style:normal;text-align:center;color:#9A938A;}",
      ".pdac-oi span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".pdac-oi.h2{font-weight:700;color:#2B2B2B;margin-top:8px;font-size:12.5px;}",
      ".pdac-oi.mx span,.pdac-oi.mx i{color:#3F6E9E;font-weight:600;}",
      ".pdac-oi.sig span,.pdac-oi.sig i{color:#8A5F12;font-weight:600;}",
      ".pdac-oi em{font-style:normal;font-size:10.5px;font-weight:700;border-radius:999px;padding:0 6px;background:#F5E1DD;color:#A63A2E;}",
      ".pdac-center{position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;}",
      ".pdac-side{border-left:1px solid #E6E0D6;background:#FBFAF7;overflow-y:auto;padding:12px 12px 40px;display:flex;flex-direction:column;gap:11px;min-height:0;}",
      ".pdac-tabs{display:flex;gap:4px;flex-wrap:wrap;}",
      ".pdac-tabs button{border:1px solid #E6E0D6;background:#fff;border-radius:999px;padding:4px 11px;font:600 12.5px " + FONT_STACK + ";color:#6E6862;cursor:pointer;}",
      ".pdac-tabs button[aria-pressed=true]{background:#2B2B2B;border-color:#2B2B2B;color:#fff;}",
      ".pdac-prog{height:7px;border-radius:4px;background:#EFEBE4;overflow:hidden;}",
      ".pdac-prog i{display:block;height:100%;background:#577328;border-radius:4px;}",
      ".pdac-note{font-size:12px;color:#6E6862;margin:0;line-height:1.45;}",
      ".pdac-mlist{display:flex;flex-direction:column;gap:2px;}",
      ".pdac-mi{display:grid;grid-template-columns:12px minmax(0,1fr);gap:8px;align-items:baseline;border:0;background:none;text-align:left;border-radius:7px;padding:5px 6px;font:12px " + FONT_STACK + ";color:#6E6862;width:100%;cursor:pointer;}",
      ".pdac-mi:hover{background:#EFEBE4;}",
      ".pdac-mi[aria-current=true]{background:#fff;color:#2B2B2B;box-shadow:inset 0 0 0 1px #CFC7BA;}",
      ".pdac-mi i{width:9px;height:9px;border-radius:50%;background:#A63A2E;margin-top:3px;}",
      ".pdac-mi i.ok{background:#577328;}.pdac-mi i.nf{background:#BB9351;}",
      ".pdac-mod{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #E6E0D6;border-radius:10px;padding:8px 10px;background:#fff;}",
      ".pdac-mod button.nm{border:0;background:none;text-align:left;padding:0;cursor:pointer;font-family:" + FONT_STACK + ";min-width:0;}",
      ".pdac-mod b{font-size:13px;font-weight:600;display:block;color:#2B2B2B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".pdac-mod small{font-size:11.5px;color:#6E6862;}",
      ".pdac-mod .acts{display:flex;gap:4px;}",
      ".pdac-miss{border:1px dashed #BB9351;border-radius:10px;padding:10px 12px;background:#F6ECD6;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#2B2B2B;}",
      ".pdac-miss .acts{display:flex;gap:6px;flex-wrap:wrap;}",
      ".pdac-mtabs{display:none;gap:0;padding:8px 14px;background:#FBFAF7;border-bottom:1px solid #E6E0D6;}",
      ".pdac-mtabs button{flex:1;border:1px solid #CFC7BA;background:#fff;padding:6px 8px;font:600 12.5px " + FONT_STACK + ";color:#6E6862;cursor:pointer;}",
      ".pdac-mtabs button:first-child{border-radius:9px 0 0 9px;}.pdac-mtabs button:last-child{border-radius:0 9px 9px 0;}",
      ".pdac-mtabs button[aria-pressed=true]{background:#2B2B2B;border-color:#2B2B2B;color:#fff;}",
      // bloco rico com as linhas à vista e trecho a conferir destacado no texto
      ".pdac-rich{border:1px dashed rgba(43,43,43,.25);border-radius:8px;padding:10px 14px;background:#FAF8F4;margin:8px 0;}",
      ".pdac-rich strong{display:block;font:700 11px " + FONT_STACK + ";text-transform:uppercase;letter-spacing:.06em;color:#6E6862;margin-bottom:4px;}",
      ".pdac-rich p{margin:2px 0;font-size:13.5px;line-height:1.5;color:#3A3632;}",
      ".pdac-rich p.more{color:#8A7A6C;font-style:italic;font-size:12.5px;}",
      ".pdac-mk{background:#F5E1DD;color:#A63A2E;border-radius:5px;padding:0 5px;font:600 .82em " + FONT_STACK + ";cursor:pointer;white-space:normal;}",
      ".pdac-mk.cur{outline:2px solid #A63A2E;}",
      ".pdac-header-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}",
      ".pdac-icon-btn{font-family:" + FONT_STACK + ";font-weight:600;font-size:13px;padding:8px 12px;border-radius:8px;border:1px solid rgba(43,43,43,.16);background:#fff;color:#3A3632;cursor:pointer;min-height:38px;}",
      ".pdac-icon-btn.primary{background:#604034;border-color:#604034;color:#fff;}",
      ".pdac-canvas-scroll{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 12px 130px;box-sizing:border-box;}",
      ".pdac-canvas{max-width:720px;margin:0 auto;}",
      ".pdac-block{position:relative;margin:2px 0;border-radius:10px;border:1px solid transparent;scroll-margin:70px;}",
      ".pdac-block:hover{border-color:rgba(43,43,43,.12);}",
      ".pdac-block.is-focus{border-color:#577328;background:rgba(255,255,255,.7);}",
      ".pdac-block.is-selected{border-color:rgba(96,64,52,.4);background:rgba(255,255,255,.7);}",
      ".pdac-block.is-dragging{opacity:.45;}",
      ".pdac-block.is-special{border-left:3px solid #8AACD2;}",
      ".pdac-block-bar{display:none;position:absolute;top:-15px;right:8px;z-index:1;align-items:center;gap:0;padding:1px 2px;background:#fff;border:1px solid #CFC7BA;border-radius:9px;max-width:calc(100% - 16px);}",
      ".pdac-block.is-focus > .pdac-block-bar,.pdac-block.is-selected > .pdac-block-bar,.pdac-block.is-dragging > .pdac-block-bar{display:flex;}",
      "@media (hover:hover){.pdac-block:hover > .pdac-block-bar{display:flex;}}",
      ".pdac-bar-btn{border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:5px;border-radius:6px;color:#8A7A6C;min-width:30px;min-height:28px;}",
      ".pdac-bar-btn:hover{background:#EFEBE4;color:#2B2B2B;}",
      ".pdac-bar-btn:active{background:rgba(43,43,43,.08);}",
      ".pdac-bar-btn.drag{cursor:grab;touch-action:none;}",
      ".pdac-bar-label{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8A7A6C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;padding:0 6px;}",
      ".pdac-block-content{padding:2px 8px 12px;cursor:pointer;}",
      ".pdac-block-empty{color:#9C948A;font-style:italic;font-size:13px;padding:10px 8px;}",
      ".pdac-edit-area{padding:0 8px 14px;}",
      ".pdac-textarea{width:100%;box-sizing:border-box;font-family:" + FONT_STACK + ";font-size:15px;line-height:1.55;border:1px solid rgba(43,43,43,.2);border-radius:8px;padding:10px 12px;resize:vertical;}",
      ".pdac-input{width:100%;box-sizing:border-box;font-family:" + FONT_STACK + ";font-size:14px;border:1px solid rgba(43,43,43,.2);border-radius:8px;padding:9px 10px;margin-bottom:6px;}",
      ".ReactModal__Overlay{z-index:2000000 !important;}",
      ".pdac-block-content figure.article-figure{margin:0;}",
      ".pdac-block-content figure.article-figure img{width:100%;height:auto;border-radius:6px;display:block;}",
      ".pdac-block-content figure.article-figure figcaption{font-size:13px;color:#8A7A6C;margin-top:6px;text-align:center;}",
      ".pdac-hint{font-size:11.5px;color:#8A7A6C;margin:6px 2px 0;line-height:1.4;}",
      ".pdac-add-inline{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px auto 0;max-width:720px;width:100%;padding:14px;border:1.5px dashed rgba(96,64,52,.4);border-radius:10px;color:#604034;font-weight:600;font-size:14px;cursor:pointer;background:transparent;font-family:" + FONT_STACK + ";}",
      ".pdac-fab{position:absolute;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));width:58px;height:58px;border-radius:50%;background:#604034;color:#fff;border:none;font-size:28px;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;line-height:0;}",
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
      ".pdac-raw-wrap{flex:1 1 auto;display:flex;min-height:0;}",
      // prévia no site, ao lado do editor (no celular, no lugar dele)
      ".pdac-prev{min-width:0;border-left:1px solid rgba(43,43,43,.14);display:flex;flex-direction:column;min-height:0;background:#FBFAF7;}",
      ".pdac-prev-note{margin:0;padding:8px 12px;font-size:12px;color:#8A5F12;background:#F6ECD6;}",
      ".pdac-prev-empty{margin:auto;padding:24px;text-align:center;color:#8A7A6C;font-size:13px;}",
      ".pdac-icon-btn[aria-pressed=true]{background:#2B2B2B;border-color:#2B2B2B;color:#fff;}",
      "@media (max-width:1180px){.pdac-main{grid-template-columns:210px minmax(0,1fr) 330px;}}",
      // celular e tablet em pé: uma coluna por vez, escolhida nas abas
      "@media (max-width:960px){",
      "  .pdac-mtabs{display:flex;}",
      "  .pdac-main,.pdac-main.has-prev{grid-template-columns:minmax(0,1fr);}",
      "  .pdac-main > .pdac-out,.pdac-main > .pdac-center,.pdac-main > .pdac-side{display:none;border:0;}",
      "  .pdac-main[data-pane=out] > .pdac-out,.pdac-main[data-pane=doc] > .pdac-center,.pdac-main[data-pane=side] > .pdac-side{display:flex;}",
      "  .pdac-main.raw > .pdac-center{display:flex;}",
      "  .pdac-main.has-prev > .pdac-out,.pdac-main.has-prev > .pdac-center{display:none;}",
      "  .pdac-prev{border-left:0;}",
      "  .pdac-title strong{font-size:14.5px;}",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }
  ensureEditorStyles();

  // --- estilos inline usados só na barra fechada do campo (fora do overlay) -
  var SUMMARY_BAR_STYLE = { display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid rgba(43,43,43,0.14)", borderRadius: "6px", background: "#fff", fontSize: "13px", fontFamily: FONT_STACK };
  var BTN_STYLE = { fontFamily: FONT_STACK, fontWeight: 600, fontSize: "13px", padding: "8px 14px", borderRadius: "4px", border: "1px solid #604034", background: "#604034", color: "#fff", cursor: "pointer" };
  var RAW_TEXTAREA_STYLE = { flex: "1 1 auto", width: "100%", boxSizing: "border-box", padding: "20px", fontFamily: "monospace", fontSize: "13px", border: "none", resize: "none" };

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
    POLL: "Pergunta da enquete\nOpção 1\nOpção 2",
    RESUMO: "Ponto principal 1\nPonto principal 2\nPonto principal 3",
    CONFIANCA: "Quão segura você está sobre esse assunto?",
    MITO: "Mito ou verdade?\nAfirmação que circula nos grupos | mito | Explicação curta do porquê\nOutra afirmação | verdade | Explicação curta",
    QUIZ: "Título do teste\nPergunta 1 | opção | *opção certa | opção || Explicação\nPergunta 2 | *opção certa | opção || Explicação",
    SELETOR: "Qual é o seu caso?\n? Primeira pergunta | Opção A > caso1 | Opção B > caso2\n? Segunda pergunta | Opção A > caso1 | Opção B > caso2\n= caso1 | Título do resultado 1 | Texto curto | Ler o guia | /artigos/\n= caso2 | Título do resultado 2 | Texto curto | Ler o guia | /artigos/",
    PRAZO: "Quantos dias você ainda tem?\nData de entrada na França | 3 meses",
    "LINHA-DO-TEMPO": "Sua linha do tempo\nData de referência\n-6 meses | Primeira etapa\n-3 meses | Segunda etapa\n0 | O dia D",
    ROTEIRO: "Seu roteiro\nLugar 1 | Descrição curta | https://\nLugar 2 | Descrição curta",
    PERGUNTA: "Ficou alguma dúvida? Pergunta pra mim. As mais pedidas viram artigo.",
    "PROXIMO-PASSO": "se prazo<=45 | Título pra quem está com pressa | Texto | Texto do botão | /produtos-digitais/\npadrao | Título padrão | Texto | Ver soluções | /produtos-digitais/",
    TRILHA: "Nome da trilha\nslug-do-artigo-1\nslug-do-artigo-2\nslug-do-artigo-3"
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
    POLL: "1ª linha = pergunta, as demais = opções de resposta única. A resposta também alimenta o Próximo passo (se enquete=Opção exata).",
    RESUMO: "Uma linha por tópico. Aparece fechado no topo: \"Sem tempo? O resumo em 20 segundos\".",
    CONFIANCA: "A pergunta de 1 a 5. Coloque no começo — a versão \"depois\" aparece sozinha no fim do artigo, com a diferença.",
    MITO: "1ª linha = título. Depois, uma por afirmação: afirmação | mito ou verdade | explicação.",
    QUIZ: "1ª linha = título. Depois: pergunta | opções separadas por | (a certa com * na frente) || explicação. A nota alimenta o Próximo passo (se quiz<60).",
    SELETOR: "1ª linha = título. \"?\" = pergunta, cada opção \"texto > chave\" (várias chaves com vírgula). \"=\" = resultado: chave | título | texto | botão | link. Ganha a chave mais escolhida.",
    PRAZO: "1ª linha = título. 2ª = rótulo da data | duração (3 meses, 90 dias, 1 ano). Mostra dias restantes e status; alimenta o Próximo passo (se prazo<=45).",
    "LINHA-DO-TEMPO": "1ª linha = título. 2ª = rótulo da data. Depois: deslocamento | o que fazer (-12 meses, -2 semanas, +30 dias, 0).",
    ROTEIRO: "1ª linha = título. Depois: nome | descrição | link opcional. A leitora marca \"Quero ir / Já fui\".",
    PERGUNTA: "Não é mais usado: o formulário \"Pergunta pra Ingryd\" (nome, e-mail e pergunta) aparece sozinho no fim de todo artigo. Pode apagar este bloco.",
    "PROXIMO-PASSO": "Uma regra por linha, de cima pra baixo: se condição | título | texto | botão | link. Condições: prazo<=45, prazo<0, enquete=Opção exata, seletor=chave, quiz<60, checklist=completo, confianca<=2. A linha padrao aparece quando nada bate.",
    TRILHA: "1ª linha = nome da trilha. Depois, um slug de artigo por linha, na ordem da trilha (inclua o slug deste artigo)."
  };

  var RICH_NAME = {
    PRAZO: "⏳ Ferramenta: calculadora de prazo", QUIZ: "🎓 Ferramenta: mini-simulado", SELETOR: "🧭 Ferramenta: qual é o seu caso?",
    "LINHA-DO-TEMPO": "🗓️ Ferramenta: linha do tempo", ROTEIRO: "📍 Ferramenta: roteiro salvável", RESUMO: "⚡ Resumo em 20s",
    CONFIANCA: "🌡️ Termômetro de confiança", MITO: "🤔 Mito ou verdade", PERGUNTA: "💬 (antigo) Pergunta — pode apagar",
    "PROXIMO-PASSO": "➡️ Próximo passo (Soluções digitais)", TRILHA: "🧵 Trilha de artigos"
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
      group: "Ferramenta-assinatura (1 por artigo)", items: [
        { key: "PRAZO", emoji: "⏳", label: "Calculadora de prazo", make: function () { return richBlock("PRAZO"); } },
        { key: "QUIZ", emoji: "🎓", label: "Mini-simulado", make: function () { return richBlock("QUIZ"); } },
        { key: "SELETOR", emoji: "🧭", label: "Qual é o seu caso?", make: function () { return richBlock("SELETOR"); } },
        { key: "LINHA-DO-TEMPO", emoji: "🗓️", label: "Linha do tempo", make: function () { return richBlock("LINHA-DO-TEMPO"); } },
        { key: "ROTEIRO", emoji: "📍", label: "Roteiro salvável", make: function () { return richBlock("ROTEIRO"); } }
      ]
    },
    {
      group: "Microengajamento", items: [
        { key: "RESUMO", emoji: "⚡", label: "Resumo em 20s", make: function () { return richBlock("RESUMO"); } },
        { key: "CONFIANCA", emoji: "🌡️", label: "Termômetro de confiança", make: function () { return richBlock("CONFIANCA"); } },
        { key: "MITO", emoji: "🤔", label: "Mito ou verdade", make: function () { return richBlock("MITO"); } },
        { key: "PROXIMO-PASSO", emoji: "➡️", label: "Próximo passo (Soluções)", make: function () { return richBlock("PROXIMO-PASSO"); } },
        { key: "TRILHA", emoji: "🧵", label: "Trilha de artigos", make: function () { return richBlock("TRILHA"); } }
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
        { key: "IMAGEM", emoji: "📷", label: "Imagem", make: function () { return { id: uid(), type: "text", raw: buildImageRaw("", "") }; } },
        { key: "GALERIA", emoji: "🖼️", label: "Galeria de fotos", make: function () { return { id: uid(), type: "token", raw: "[[GALERIA]]" }; } },
        { key: "GALERIA-2", emoji: "🖼️", label: "Galeria de fotos 2", make: function () { return { id: uid(), type: "token", raw: "[[GALERIA-2]]" }; } }
      ]
    }
  ];

  // Nome de cada bloco rico, tirado do próprio menu de "+" (uma lista só).
  var MENU_LABEL = {};
  ADD_MENU.forEach(function (g) { g.items.forEach(function (it) { if (!it.special) MENU_LABEL[it.key] = it.label; }); });

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
        catalogs: null,
        focusId: null,        // bloco destacado (vindo da estrutura, do painel ou de um trecho)
        panelTab: "conferir", // painel da direita: "conferir" ou "modulos"
        markAt: 0,            // qual trecho a conferir está aberto
        markOwn: null,        // texto próprio sendo digitado pro trecho (null = fechado)
        outlineOnlyMods: false,
        pane: "doc",          // no celular: "out" (estrutura), "doc" (texto) ou "side" (painel)
        addSig: false,
        canUndo: false
      };
    },

    componentDidUpdate: function (prevProps) {
      var K = window.PDStudio;
      if (K && K.Media && this._pdsMedia) {
        var self = this;
        K.Media.collect(this, function (target, path) {
          var id = String(target).replace(/^img:/, "");
          var blk = self.state.blocks.filter(function (x) { return x.id === id; })[0];
          var cur = blk && parseImageRaw(blk.raw);
          if (cur) self.editBlock(id, buildImageRaw(cur.caption, path));
        });
      }
      if (prevProps.value !== this.props.value && this.props.value !== this.state.lastSerialized) {
        this.setState({ blocks: parseBody(this.props.value), lastSerialized: this.props.value });
      }
    },

    componentDidMount: function () {
      var self = this;
      if (saver()) this._unsubSave = saver().subscribe(function () { if (self.state.open) self.forceUpdate(); });
    },
    componentWillUnmount: function () {
      this._detachDragListeners();
      if (this._unsubSave) this._unsubSave();
    },

    // typing = mudança de digitação: várias seguidas no mesmo bloco viram um passo só do Desfazer.
    updateValue: function (newBlocks, typing) {
      var now = Date.now();
      if (!typing || !this._lastTyping || now - this._lastTyping > 1500) {
        this._history = (this._history || []).concat([this.state.blocks]).slice(-30);
      }
      this._lastTyping = typing ? now : 0;
      this.commit(newBlocks);
    },
    commit: function (newBlocks) {
      var text = serializeBlocks(newBlocks);
      this.setState({ blocks: newBlocks, lastSerialized: text, canUndo: !!(this._history && this._history.length) });
      this.props.onChange(text);
      if (this.state.preview) this.pushPreview(text);
      var self = this;
      if (saver()) saver().touch(function () { self.props.onChange(self.state.lastSerialized); });
    },
    undo: function () {
      var prev = (this._history || []).pop();
      if (!prev) return;
      this._lastTyping = 0;
      this.commit(prev);
      this.setState({ selectedId: null, markOwn: null });
    },

    // --- prévia no site (admin/widgets/studio-kit.js) -------------------------
    // Este editor é o campo "body" de UM artigo da lista de content/posts.json.
    // Pra prévia, acha qual artigo é (pelo texto que ele tinha ao abrir) e
    // entrega a lista inteira com o texto novo pra página real do artigo.
    findPost: function () {
      var entry = this.props.entry;
      var data = entry && entry.get && entry.get("data");
      var raw = data && data.get && data.get("items");
      var items = raw && typeof raw.toJS === "function" ? raw.toJS() : [];
      return items;
    },
    pushPreview: function (text) {
      if (!window.PDPreview || this._postIdx == null) return;
      var items = this.findPost();
      if (!items[this._postIdx]) return;
      items[this._postIdx].body = text;
      window.PDPreview.set("/content/posts.json", { items: items });
      this.setState({ previewVersion: (this.state.previewVersion || 0) + 1 });
    },
    togglePreview: function () {
      var on = !this.state.preview;
      this.setState({ preview: on });
      if (on) this.pushPreview(this.state.lastSerialized || "");
    },
    renderPreviewPane: function () {
      var self = this;
      var K = window.PDStudio;
      var post = this._postIdx != null ? this.findPost()[this._postIdx] : null;
      if (!K || !post || !post.slug) {
        return h("div", { className: "pdac-prev" }, h("p", { className: "pdac-prev-empty" }, "Dê um endereço (slug) a este artigo pra ver a prévia."));
      }
      var url = post.url || "/artigos/post/?slug=" + encodeURIComponent(post.slug);
      return h("div", { className: "pdac-prev" },
        post.url ? h("p", { className: "pdac-prev-note" }, "Este artigo tem página própria (" + post.url + "): no site aparece o texto do HTML fixo, não o daqui.") : null,
        h(K.Preview, {
          url: url, device: this.state.previewDevice || "mobile", version: this.state.previewVersion || 0,
          onDevice: function (d) { self.setState({ previewDevice: d }); }
        }));
    },

    open: function () {
      var self = this;
      var current = this.props.value || "";
      var items = this.findPost();
      var idx = -1;
      for (var i = 0; i < items.length; i++) { if ((items[i].body || "") === current) { idx = i; break; } }
      this._postIdx = idx === -1 ? null : idx;
      this._history = [];
      var hasMarks = this.pending().length > 0;
      this.setState({ open: true, selectedId: null, sheetOpen: false, focusId: null, markAt: 0, markOwn: null, addSig: false, canUndo: false,
        panelTab: hasMarks ? "conferir" : "modulos", pane: hasMarks ? "side" : "doc" });
      if (this.state.preview) setTimeout(function () { self.pushPreview(current); }, 0);
      if (!this.state.catalogs) {
        fetchCatalogs().then(function (catalogs) { self.setState({ catalogs: catalogs }); });
      }
    },

    close: function () {
      if (this.state.mode === "raw") {
        this.updateValue(parseBody(this.state.rawDraft));
      }
      this.setState({ open: false, mode: "visual", selectedId: null, sheetOpen: false });
      if (window.PDPreview) window.PDPreview.clear("/content/posts.json");
      // "Concluir" grava no site e, se o editor foi aberto pelo quadro de artigos, volta pro cartão.
      if (saver()) saver().now();
      var back = window.PDArticleReturn;
      window.PDArticleReturn = null;
      if (back) back();
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
      this.updateValue(blocks, true);
    },

    // --- trechos a conferir ------------------------------------------------------
    // Todos os trechos do corpo, na ordem do texto, cada um com o bloco em que está.
    pending: function () {
      var out = [];
      this.state.blocks.forEach(function (b) { marksOf(b).forEach(function (tok) { out.push({ tok: tok, blockId: b.id }); }); });
      return out;
    },
    // A conferência que o hub mandou pra este artigo (campo irmão do corpo, em content/posts.json).
    sources: function () {
      var post = this._postIdx != null ? this.findPost()[this._postIdx] : null;
      return post && Array.isArray(post.conferencia) ? post.conferencia : null;
    },
    showBlock: function (id) {
      this.setState({ focusId: id });
      var root = this._canvasEl;
      setTimeout(function () {
        var el = root && root.querySelector('[data-block-row="' + id + '"]');
        if (el) el.scrollIntoView({ block: "center" });
      }, 40);
    },
    goMark: function (i, fromText) {
      var list = this.pending();
      if (!list.length) return;
      var at = (i + list.length) % list.length;
      this.setState({ markAt: at, markOwn: null, panelTab: "conferir", pane: fromText ? "side" : this.state.pane });
      this.showBlock(list[at].blockId);
    },
    // Troca a marca pelo texto (vazio = só tira a marca) e, se veio de uma fonte, acrescenta a página
    // no bloco de fontes. Mexe no texto inteiro e remonta os blocos: é a mesma regra do quadro.
    resolveMark: function (tok, by, src) {
      var C = conf();
      var out = C.swapMark(serializeBlocks(this.state.blocks), tok, by);
      if (out == null) return;
      if (src) out = C.addResource(out, src);
      this._lastTyping = 0;
      this.updateValue(parseBody(out));
      this.setState({ markOwn: null, selectedId: null, focusId: null });
    },

    removeBlock: function (id) {
      this.updateValue(this.state.blocks.filter(function (b) { return b.id !== id; }));
      if (this.state.selectedId === id || this.state.focusId === id) this.setState({ selectedId: null, focusId: null });
    },

    // A ferramenta-assinatura entra depois do bloco em que você está; sem bloco escolhido, antes das
    // perguntas frequentes (ou do próximo passo), que é onde o artigo começa a fechar.
    addSignature: function (name) {
      var blocks = this.state.blocks.slice(), at = -1, ref = this.state.selectedId || this.state.focusId;
      for (var i = 0; i < blocks.length && ref; i++) if (blocks[i].id === ref) { at = i + 1; break; }
      if (at === -1) {
        for (var j = 0; j < blocks.length; j++) {
          var b = blocks[j];
          if ((b.type === "text" && /^##\s+perguntas frequentes/i.test(b.raw.trim())) || (b.type === "richblock" && (b.name === "FAQ" || b.name === "PROXIMO-PASSO"))) { at = j; break; }
        }
      }
      var novo = richBlock(name);
      blocks.splice(at === -1 ? blocks.length : at, 0, novo);
      this.updateValue(blocks);
      this.setState({ addSig: false, selectedId: novo.id, pane: "doc" });
      this.showBlock(novo.id);
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

    insertFromMenu: function (item) {
      if (item.special === "banner-on") return this.addBannerBlock("on");
      if (item.special === "banner-off") return this.addBannerBlock("off");
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
      return h(
        "div",
        null,
        h(
          "div",
          { style: SUMMARY_BAR_STYLE },
          h("span", null, blocks.length + " bloco(s)"),
          h("span", null, "Banner: " + bannerInfo.state),
          h("span", null, "Links afiliados: " + affiliateCount),
          h("button", { type: "button", onClick: this.open, style: BTN_STYLE }, "Editar artigo visualmente")
        ),
        this.state.open ? this.renderOverlay() : null
      );
    },

    renderOverlay: function () {
      var self = this;
      var raw = this.state.mode === "raw";
      var withPreview = !!(this.state.preview && window.PDStudio);
      var pending = this.pending();
      return h(
        "div",
        { className: "pdac-overlay" },
        this.renderHeader(pending),
        raw || withPreview ? null : this.renderPaneTabs(pending),
        h("div", { className: "pdac-main" + (raw ? " raw" : "") + (withPreview ? " has-prev" : ""), "data-pane": this.state.pane },
          raw ? null : this.renderOutline(),
          h("div", { className: "pdac-center" },
            raw ? this.renderRawEditor() : this.renderCanvas(pending),
            raw ? null : h("button", { type: "button", className: "pdac-fab", "aria-label": "Adicionar bloco", onClick: function () { self.setState({ sheetOpen: true }); } }, "+")),
          raw ? null : withPreview ? this.renderPreviewPane() : this.renderSide(pending)),
        this.state.sheetOpen ? this.renderAddSheet() : null
      );
    },

    renderHeader: function (pending) {
      var post = this._postIdx != null ? this.findPost()[this._postIdx] : null;
      var n = pending.length;
      return h(
        "div",
        { className: "pdac-header" },
        h("div", { className: "pdac-title" }, h("small", null, "Editor do artigo"), h("strong", null, (post && post.title) || "Artigo sem título")),
        conf() ? h("span", { className: "pdac-pill" + (n ? " bad" : "") }, n ? conf().plural(n, "trecho", "trechos") + " a conferir" : "nada a conferir") : null,
        h(
          "div",
          { className: "pdac-header-actions" },
          h("button", { type: "button", className: "pdac-icon-btn", onClick: this.undo, disabled: !this.state.canUndo, title: "Volta a última mudança" }, "↶ Desfazer"),
          window.PDStudio ? h("button", { type: "button", className: "pdac-icon-btn", "aria-pressed": String(!!this.state.preview), onClick: this.togglePreview, title: "Mostra a página real do artigo com o texto de agora, no celular, tablet ou computador" }, this.state.preview ? "Fechar prévia" : "Prévia no site") : null,
          h("button", { type: "button", className: "pdac-icon-btn", onClick: this.toggleMode }, this.state.mode === "visual" ? "Ver texto bruto" : "Ver visual"),
          saver() ? saver().badge() : null,
          h("button", { type: "button", className: "pdac-icon-btn primary", onClick: this.close, title: "Salva e volta pro quadro de artigos" }, "Concluir")
        )
      );
    },

    // No celular, as três colunas viram três abas.
    renderPaneTabs: function (pending) {
      var self = this, pane = this.state.pane;
      var tab = function (k, label) {
        return h("button", { key: k, type: "button", "aria-pressed": String(pane === k), onClick: function () { self.setState({ pane: k }); } }, label);
      };
      return h("div", { className: "pdac-mtabs", role: "group", "aria-label": "Parte do editor" },
        tab("out", "Estrutura"), tab("doc", "Texto"), tab("side", pending.length ? "Conferir · " + pending.length : "Painel"));
    },

    // --- estrutura: títulos e módulos, com a contagem de trechos por bloco -----------
    renderOutline: function () {
      var self = this;
      var blocks = this.state.blocks, only = this.state.outlineOnlyMods;
      var ICON = { h2: "H2", h3: "H3", p: "¶", list: "•", sig: "★", mx: "◆", rich: "▣", token: "▣" };
      return h("aside", { className: "pdac-out", "aria-label": "Estrutura do artigo" },
        h("div", { className: "pdac-colh" }, "Estrutura", h("span", null, blocks.length + " blocos")),
        h("label", { className: "pdac-sw" },
          h("input", { type: "checkbox", checked: only, onChange: function (e) { self.setState({ outlineOnlyMods: e.target.checked }); } }), "Só títulos e módulos"),
        h("div", null, blocks.map(function (b) {
          var k = kindOf(b);
          if (only && (k === "p" || k === "list" || k === "h3")) return null;
          var n = marksOf(b).length;
          var text = k === "p" || k === "list" ? b.raw.replace(/\{\{[^}]*\}\}|\[\s*CONFERIR[^\]]*\]/gi, "…").replace(/[*#]/g, "").replace(/^\s*-\s+/, "").trim()
            : k === "h2" || k === "h3" ? b.raw.replace(/^#+\s*/, "") : plainName(b);
          return h("button", {
            key: b.id, type: "button", className: "pdac-oi " + k, "aria-current": String(self.state.focusId === b.id || self.state.selectedId === b.id),
            onClick: function () { self.setState({ pane: "doc" }); self.showBlock(b.id); }
          }, h("i", null, ICON[k]), h("span", null, text || "(vazio)"), n ? h("em", { title: "Trechos a conferir neste bloco" }, n) : h("b", null));
        })));
    },

    // --- painel: conferir os trechos ou cuidar dos módulos -----------------------------
    renderSide: function (pending) {
      var self = this, tab = this.state.panelTab;
      var btn = function (k, label) {
        return h("button", { key: k, type: "button", "aria-pressed": String(tab === k), onClick: function () { self.setState({ panelTab: k }); } }, label);
      };
      return h("aside", { className: "pdac-side", "aria-label": "Painel de trabalho" },
        h("div", { className: "pdac-tabs", role: "group", "aria-label": "Painel" }, btn("conferir", "Conferir · " + pending.length), btn("modulos", "Módulos")),
        tab === "conferir" ? this.renderConfer(pending) : this.renderModules());
    },

    renderConfer: function (pending) {
      var self = this, C = conf();
      if (!C) return h("p", { className: "pdac-note" }, "A conferência não carregou (admin/widgets/conferencia.js).");
      if (!pending.length) return h("p", { className: "pdac-note" }, "Nenhum trecho marcado pra conferir neste texto. No quadro, o artigo já pode ir pra Agendado ou No ar.");
      var sources = this.sources();
      var at = Math.min(this.state.markAt, pending.length - 1), cur = pending[at];
      var left = {};
      pending.forEach(function (m) { left[C.norm(C.markText(m.tok))] = 1; });
      var withSource = sources ? sources.filter(function (x) { return x && x.status !== "sem_fonte" && left[C.norm(x.marca)]; }).length : null;
      return [
        h("p", { key: "n", className: "pdac-note" }, h("b", null, C.plural(pending.length, "trecho", "trechos")), " a conferir. Enquanto houver algum, agendar e publicar ficam bloqueados no quadro."),
        h("div", { key: "c" }, C.card({
          tok: cur.tok, entry: C.sourceFor(sources, cur.tok), at: at, total: pending.length, withSource: withSource, own: this.state.markOwn,
          onNav: function (d) { self.goMark(at + d); },
          onUse: function (text, src) { self.resolveMark(cur.tok, text, src); },
          onOwn: function (text) { self.setState({ markOwn: text }); },
          onCut: function () { self.resolveMark(cur.tok, "", null); }
        })),
        h("div", { key: "h", className: "pdac-colh" }, "Todos os trechos"),
        h("div", { key: "l", className: "pdac-mlist" }, pending.map(function (m, i) {
          var e = C.sourceFor(sources, m.tok), text = C.markText(m.tok);
          return h("button", { key: i, type: "button", className: "pdac-mi", "aria-current": String(i === at), onClick: function () { self.goMark(i); } },
            h("i", { className: e && e.status === "conferida" ? "ok" : e && e.status === "sem_conferencia" ? "" : "nf" }),
            h("span", null, text.length > 74 ? text.slice(0, 72) + "…" : text));
        })),
        h("p", { key: "leg", className: "pdac-note" }, "Verde: fonte com trecho conferido na página. Vermelho: link oficial sem conferência. Dourado: sem fonte encontrada.")
      ];
    },

    renderModules: function () {
      var self = this;
      var blocks = this.state.blocks;
      var mods = blocks.filter(function (b) { var k = kindOf(b); return k === "sig" || k === "mx" || k === "rich"; });
      var hasSig = blocks.some(function (b) { return kindOf(b) === "sig"; });
      return [
        hasSig ? null : h("div", { key: "miss", className: "pdac-miss" },
          h("b", null, "Falta a ferramenta-assinatura."),
          h("span", null, "Todo artigo leva uma, na seção em que ela resolve a dúvida."),
          this.state.addSig
            ? h("div", { className: "acts" }, Object.keys(SIG_NAMES).map(function (name) {
                return h("button", { key: name, type: "button", className: "pdac-icon-btn", onClick: function () { self.addSignature(name); } }, MENU_LABEL[name] || name);
              }))
            : h("div", { className: "acts" }, h("button", { type: "button", className: "pdac-icon-btn", onClick: function () { self.setState({ addSig: true }); } }, "+ Adicionar ferramenta")),
          this.state.addSig ? h("span", { className: "pdac-note" }, "Ela entra depois do bloco em que você está; sem bloco escolhido, antes das perguntas frequentes.") : null),
        h("div", { key: "h", className: "pdac-colh" }, "Módulos do artigo", h("span", null, mods.length)),
        mods.length ? mods.map(function (b) {
          var lines = b.type === "richblock" ? b.inner.split("\n").filter(function (l) { return l.trim(); }).length : 0;
          var n = marksOf(b).length;
          return h("div", { key: b.id, className: "pdac-mod" },
            h("button", { type: "button", className: "nm", onClick: function () { self.setState({ pane: "doc" }); self.showBlock(b.id); } },
              h("b", null, plainName(b)),
              h("small", null, KIND_LABEL[kindOf(b)] + (lines ? " · " + lines + " linha(s)" : "") + (n ? " · " + n + " a conferir" : ""))),
            h("span", { className: "acts" },
              h("button", { type: "button", className: "pdac-bar-btn", "aria-label": "Subir " + plainName(b), onClick: function () { self.moveBlock(b.id, -1); self.showBlock(b.id); } }, "▲"),
              h("button", { type: "button", className: "pdac-bar-btn", "aria-label": "Descer " + plainName(b), onClick: function () { self.moveBlock(b.id, 1); self.showBlock(b.id); } }, "▼"),
              h("button", { type: "button", className: "pdac-icon-btn", onClick: function () { self.removeBlock(b.id); } }, "Tirar")));
        }) : h("p", { key: "none", className: "pdac-note" }, "Este artigo ainda não tem módulos. Use o + pra acrescentar."),
        h("p", { key: "tip", className: "pdac-note" }, "▲ e ▼ movem o módulo um bloco por vez. Tirou sem querer? “Desfazer”, lá em cima, traz de volta.")
      ];
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

    renderCanvas: function (pending) {
      var self = this;
      var blocks = this.state.blocks;
      // posição do 1º trecho de cada bloco na lista geral (pra destacar e abrir o trecho certo)
      var first = {}, n = 0;
      blocks.forEach(function (b) { first[b.id] = n; n += marksOf(b).length; });
      var current = this.state.panelTab === "conferir" && pending.length ? Math.min(this.state.markAt, pending.length - 1) : -1;
      return h(
        "div",
        {
          className: "pdac-canvas-scroll",
          ref: function (el) { self._canvasEl = el; },
          // Toque num trecho a conferir abre ele no painel. Toque num espaço vazio (fora de qualquer
          // bloco) desmarca o bloco selecionado: o próximo "+" volta a inserir no fim.
          onClickCapture: function (e) {
            var mk = e.target.closest && e.target.closest(".pdac-mk");
            if (!mk) return;
            e.stopPropagation();
            self.goMark(Number(mk.getAttribute("data-mk")), true);
          },
          onClick: function (e) { if (e.target === e.currentTarget) self.setState({ selectedId: null, focusId: null }); }
        },
        h("div", { className: "article-body pdac-canvas" }, blocks.map(function (b) { return self.renderBlock(b, first[b.id], current); })),
        h(
          "button",
          { type: "button", className: "pdac-add-inline", onClick: function () { self.setState({ selectedId: null, sheetOpen: true }); } },
          "+ Adicionar bloco no fim do artigo"
        )
      );
    },

    renderBlock: function (b, firstMark, currentMark) {
      var self = this;
      var selected = this.state.selectedId === b.id;
      var focus = this.state.focusId === b.id;
      var dragging = this.state.draggingId === b.id;
      var isBanner = b.type === "token" && isBannerToken(b.raw);
      var isBannerOff = b.type === "token" && b.raw === NO_VITRINE_BANNER_TOKEN;
      var isAffiliate = b.type === "richblock" && b.name === AFILIADO_NAME;
      var isSpecial = isBanner || isBannerOff || isAffiliate;
      var canEdit = b.type === "text" || b.type === "list" || b.type === "richblock" || isBanner;
      var className = "pdac-block" +
        (selected ? " is-selected" : "") +
        (focus && !selected ? " is-focus" : "") +
        (dragging ? " is-dragging" : "") +
        (isSpecial ? " is-special" : "");

      function selectBlock() { self.setState({ selectedId: selected ? null : b.id, focusId: b.id }); }

      return h(
        "div",
        { key: b.id, "data-block-row": b.id, className: className },
        h(
          "div",
          { className: "pdac-block-bar" },
          h("span", { className: "pdac-bar-label" }, plainName(b)),
          h("button", {
            type: "button",
            className: "pdac-bar-btn drag",
            onPointerDown: function (e) { self.handleDragHandleDown(b.id, e); },
            "aria-label": "Arrastar pra reordenar"
          }, "⠿"),
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.moveBlock(b.id, -1); }, "aria-label": "Mover pra cima" }, "▲"),
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.moveBlock(b.id, 1); }, "aria-label": "Mover pra baixo" }, "▼"),
          canEdit ? h("button", { type: "button", className: "pdac-bar-btn", onClick: selectBlock, "aria-label": selected ? "Fechar edição" : "Editar bloco" }, selected ? "✓" : "✎") : null,
          h("button", { type: "button", className: "pdac-bar-btn", onClick: function () { self.removeBlock(b.id); }, "aria-label": "Tirar bloco" }, "✕")
        ),
        selected && canEdit ? this.renderBlockEditor(b) : this.renderBlockReadOnly(b, selectBlock, firstMark, currentMark)
      );
    },

    renderBlockReadOnly: function (b, onSelect, firstMark, currentMark) {
      currentComposer = this;
      var html = highlightMarks(renderBlockPreviewHTML(b, this.state.catalogs), firstMark || 0, currentMark);
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
      if (b.type === "text" && parseImageRaw(b.raw)) {
        return h("div", { className: "pdac-edit-area" }, this.renderImageFields(b));
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

    renderImageFields: function (b) {
      var self = this;
      var info = parseImageRaw(b.raw);
      var K = window.PDStudio;
      function update(patch) {
        var next = { caption: info.caption, url: info.url };
        Object.assign(next, patch);
        self.editBlock(b.id, buildImageRaw(next.caption, next.url));
      }
      return h(
        "div",
        null,
        info.url ? h("img", { src: imageSrc(self, info.url), alt: "", style: { maxWidth: "100%", maxHeight: "220px", borderRadius: "6px", display: "block", marginBottom: "8px" } }) : null,
        K && K.Media && this.props.onOpenMediaLibrary
          ? h("button", { type: "button", className: "pdac-icon-btn primary", style: { marginBottom: "8px" }, onClick: function () { K.Media.open(self, "img:" + b.id, info.url); } },
              info.url ? "Trocar foto" : "Escolher / enviar foto")
          : h("p", { className: "pdac-hint" }, "A biblioteca de fotos não abriu — recarregue o /admin."),
        h("input", {
          type: "text",
          className: "pdac-input",
          value: info.caption,
          placeholder: "Legenda (opcional — também serve de texto alternativo)",
          onChange: function (e) { update({ caption: e.target.value }); }
        }),
        h("p", { className: "pdac-hint" }, "Tamanho ideal: foto na horizontal, ~1200px de largura. A foto aparece na largura do texto do artigo.")
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
