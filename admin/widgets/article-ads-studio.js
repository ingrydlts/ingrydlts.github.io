// Banners dentro do artigo — um mapa do artigo (topo, blocos de texto, meio
// automático e fim) onde você arrasta cada banner/anúncio pro lugar em que
// ele aparece, com a página real de um artigo como prévia.
//
// Duas coleções usam esta mesma tela, cada uma gravando o próprio arquivo:
//   "Anúncios nos artigos"       content/ads-config.json   (studio: ads)
//     enabled, network{headSnippet, adSnippet}, ownBanner{...},
//     positions{top, mid, midAfterBlock}
//   "Vitrine dentro dos artigos" content/vitrine-artigo.json (studio: vitrine)
//     inArticleBanner{enabled, position, afterBlock, ...},
//     endArticleBanner{enabled, position, afterBlock, ...}
// O mapa mostra os dois juntos (é o artigo inteiro), mas cada coleção só
// mexe nos seus — os da outra aparecem com cadeado e o nome de onde editar.
// As regras de posição são as de artigos/post/index.html.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[article-ads-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var PATHS = { ads: "/content/ads-config.json", vitrine: "/content/vitrine-artigo.json" };
  var TITLES = { ads: "Anúncios nos artigos", vitrine: "Vitrine dentro dos artigos" };

  // Cada peça que pode ir pro artigo.
  var CHIPS = {
    own: { file: "ads", label: "Banner próprio", sub: "anúncio de produto seu", color: "#604034", focus: ".ad-slot-own" },
    network: { file: "ads", label: "Anúncio de rede", sub: "AdSense ou outra rede", color: "#6E6862", focus: ".ad-slot-network" },
    vin: { file: "vitrine", label: "Banner com foto", sub: "vitrine no meio do texto", color: "#5F87AE", focus: ".in-article-banner" },
    vend: { file: "vitrine", label: "Faixa de fechamento", sub: "vitrine larga", color: "#577328", focus: ".buy-box" }
  };
  // Onde cada tipo pode entrar (o site não tem outras combinações).
  function accepts(slot, file) {
    if (slot === "tray") return true;
    if (file === "ads") return slot === "top" || slot.charAt(0) === "b";
    return slot === "meio" || slot === "fim" || slot.charAt(0) === "b";
  }

  K.css("pds-adstudio-style", [
    ".pdz-map{background:#fff;border:1px solid #E2DCD2;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:4px;}",
    ".pdz-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px;}",
    ".pdz-hd b{font-family:" + K.DISPLAY + ";font-size:16px;}",
    ".pdz-hd small{color:#6E6862;font-size:12px;}",
    ".pdz-block{height:22px;border-radius:6px;background:repeating-linear-gradient(180deg,#EFEBE4 0 5px,transparent 5px 9px);position:relative;margin:2px 0;}",
    ".pdz-block span{position:absolute;right:0;top:3px;font-size:10.5px;color:#9A938A;background:#fff;padding:0 4px;}",
    ".pdz-title{height:14px;width:55%;border-radius:4px;background:#D8D0C3;margin:6px 0 2px;}",
    ".pdz-slot{min-height:10px;border-radius:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;transition:min-height .15s,background .15s,outline-color .15s;outline:1.5px dashed transparent;outline-offset:-1px;padding:0 6px;}",
    ".pdz-slot.named{min-height:40px;padding:6px 8px;background:#FBFAF7;outline-color:#D8D0C3;}",
    ".pdz-slot .nm{font-size:11px;font-weight:600;color:#6E6862;text-transform:uppercase;letter-spacing:.06em;margin-right:4px;}",
    ".pdz-slot .nm small{display:block;text-transform:none;letter-spacing:0;font-weight:400;font-size:11px;color:#9A938A;}",
    ".pdz-slot:not(.named):not(:empty){padding:5px 6px;background:#FBFAF7;}",
    "html.pdz-drag-ads .pdz-slot[data-acc~=ads],html.pdz-drag-vitrine .pdz-slot[data-acc~=vitrine]{min-height:38px;outline-color:#577328;background:#F1F5EA;}",
    "html.pdz-drag-ads .pdz-slot:not([data-acc~=ads]),html.pdz-drag-vitrine .pdz-slot:not([data-acc~=vitrine]){opacity:.45;}",
    ".pdz-chip{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1.5px solid #E2DCD2;border-left-width:4px;border-radius:10px;padding:5px 10px 5px 8px;font-size:12.5px;font-weight:600;cursor:grab;touch-action:none;max-width:100%;}",
    ".pdz-chip small{font-weight:400;color:#6E6862;font-size:11px;}",
    ".pdz-chip.is-off{opacity:.55;}",
    ".pdz-chip.is-off::after{content:'desligado';font-weight:500;font-size:10.5px;color:#8A5F12;background:#F6ECD6;border-radius:20px;padding:0 6px;}",
    ".pdz-chip.is-locked{cursor:default;border-style:dashed;background:#FBFAF7;color:#6E6862;}",
    ".pdz-chip.is-sel{box-shadow:0 0 0 3px #E7ECDC;border-color:#577328;}",
    ".pdz-chip .lk{font-size:11px;}",
    ".pdz-tray{background:#EFEBE4;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;}",
    ".pdz-tray b{font-size:12px;color:#6E6862;}",
    ".pdz-tray .pdz-slot{min-height:40px;}",
    ".pdz-note{font-size:12px;color:#6E6862;margin:0;}",
    ".pdz-warn{font-size:12px;color:#8A5F12;background:#F6ECD6;border-radius:10px;padding:8px 10px;margin:0;}",
    ".pdz-code{font-family:ui-monospace,Menlo,monospace;font-size:12px;min-height:80px;}"
  ].join("\n"));

  function toBool(v) { return v === true; }
  function blockOf(slot) { return Number(slot.slice(1)); }

  var AdsStudio = createClass({
    getInitialState: function () {
      return { open: false, tab: "edit", device: "mobile", version: 0, sel: null, posts: [], slug: "", other: null };
    },
    mode: function () { return this.props.field.get("studio") === "vitrine" ? "vitrine" : "ads"; },

    // --- dados ---------------------------------------------------------------
    // Junta o campo deste widget com os campos irmãos (studio-part).
    data: function () {
      var own = K.toJS(this.props.value, {});
      if (this.mode() === "ads") {
        var en = K.part("enabled"), net = K.part("network"), ob = K.part("ownBanner");
        return {
          enabled: en ? toBool(en.value) : false,
          network: (net && net.value) || { headSnippet: "", adSnippet: "" },
          ownBanner: (ob && ob.value) || {},
          positions: Object.assign({ top: "none", mid: "none", midAfterBlock: 4 }, own)
        };
      }
      var end = K.part("endArticleBanner");
      return { inArticleBanner: own || {}, endArticleBanner: (end && end.value) || {} };
    },
    save: function (d) {
      if (this.mode() === "ads") {
        var en = K.part("enabled"), net = K.part("network"), ob = K.part("ownBanner");
        if (en) en.set(!!d.enabled);
        if (net) net.set(d.network);
        if (ob) ob.set(d.ownBanner);
        this.props.onChange(d.positions);
      } else {
        var end = K.part("endArticleBanner");
        if (end) end.set(d.endArticleBanner);
        this.props.onChange(d.inArticleBanner);
      }
      window.PDPreview.set(PATHS[this.mode()], d);
      this.setState({ version: this.state.version + 1 });
    },
    update: function (fn) {
      var d = this.data();
      fn(d);
      this.save(d);
    },
    // Os dados da outra coleção (só pra desenhar o mapa inteiro).
    both: function () {
      var d = this.data(), o = this.state.other || {};
      return this.mode() === "ads" ? { ads: d, vitrine: o } : { ads: o, vitrine: d };
    },

    open: function () {
      var self = this, mode = this.mode();
      var otherPath = PATHS[mode === "ads" ? "vitrine" : "ads"];
      window.PDPreview.set(PATHS[mode], this.data());
      K.lockPage(true);
      this.setState({ open: true, tab: "edit", sel: null });
      var get = function (p) {
        var v = window.PDPreview.get(p);
        return v !== undefined ? Promise.resolve(v) : fetch(p, { cache: "no-store" }).then(function (r) { return r.json(); });
      };
      get(otherPath).then(function (o) { self.setState({ other: o }); }).catch(function () { self.setState({ other: {} }); });
      get("/content/posts.json").then(function (d) {
        // Os banners só entram nos artigos do modelo dinâmico (sem página própria).
        var posts = (d.items || []).filter(function (p) { return !p.url && p.status === "publicado"; })
          .sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
        self.setState({ posts: posts, slug: self.state.slug || (posts[0] && posts[0].slug) || "" });
      }).catch(function () {});
    },
    close: function () {
      K.lockPage(false);
      this.destroySortables();
      this.setState({ open: false });
    },
    componentWillUnmount: function () { K.lockPage(false); this.destroySortables(); },
    // Os campos irmãos (studio-part) montam depois deste — redesenha o resumo.
    componentDidMount: function () { var self = this; setTimeout(function () { self.forceUpdate(); }, 0); },
    componentDidUpdate: function () {
      var self = this;
      K.Media.collect(this, function (target, path) {
        self.update(function (d) { d.inArticleBanner.image = path; });
      });
    },

    // --- onde cada peça está ---------------------------------------------------
    placements: function () {
      var b = this.both(), out = { top: [], meio: [], fim: [], tray: [] };
      var n = 8;
      var A = b.ads || {}, P = A.positions || {};
      var put = function (slot, chip) { (out[slot] = out[slot] || []).push(chip); };
      if (P.top && P.top !== "none") put("top", { id: "ad-top", kind: P.top, off: !A.enabled });
      if (P.mid && P.mid !== "none") {
        var k = Math.max(1, Math.floor(P.midAfterBlock || 4));
        n = Math.max(n, k);
        put("b" + k, { id: "ad-mid", kind: P.mid, off: !A.enabled });
      }
      var V = b.vitrine || {};
      [["vin", V.inArticleBanner], ["vend", V.endArticleBanner]].forEach(function (x) {
        var c = x[1] || {}, chip = { id: x[0], kind: x[0], off: c.enabled === false };
        if (c.position === "meio") put("meio", chip);
        else if (c.position === "fim") put("fim", chip);
        else if (c.position === "bloco") { var kb = Math.max(1, Math.floor(c.afterBlock || 4)); n = Math.max(n, kb); put("b" + kb, chip); }
        else put("tray", chip);
      });
      out.n = n;
      return out;
    },

    // Soltar uma peça num lugar.
    drop: function (chipId, slot) {
      var mode = this.mode();
      var kind = chipId.indexOf("src-") === 0 ? chipId.slice(4) : null;
      var self = this;
      var msg = "";
      var P0 = mode === "ads" ? this.data().positions : null;
      var focusKind = kind || (chipId === "ad-top" ? P0.top : chipId === "ad-mid" ? P0.mid : chipId);
      if (mode === "ads" && (kind || chipId === "ad-top" || chipId === "ad-mid")) {
        this.update(function (d) {
          var P = d.positions;
          var src = kind || (chipId === "ad-top" ? P.top : P.mid);
          if (chipId === "ad-top") P.top = "none";
          if (chipId === "ad-mid" && slot !== "tray") P.mid = "none";
          if (slot === "tray") {
            if (chipId === "ad-mid") P.mid = "none";
            msg = "Tirado do artigo";
          } else if (slot === "top") {
            if (P.top !== "none" && P.top !== src) msg = "Troquei o que estava no topo";
            P.top = src;
            msg = msg || CHIPS[src].label + " no topo";
          } else {
            if (P.mid !== "none" && chipId !== "ad-mid") msg = "O site tem uma posição de anúncio no meio — troquei a que estava";
            P.mid = src;
            P.midAfterBlock = blockOf(slot);
            msg = msg || CHIPS[src].label + " depois do bloco " + blockOf(slot);
          }
          if (!d.enabled && slot !== "tray") msg += " · os anúncios estão desligados (liga no topo da tela)";
        });
        this.setState({ sel: kind || (slot === "top" ? "ad-top" : slot === "tray" ? null : "ad-mid") });
      } else if (mode === "vitrine" && (chipId === "vin" || chipId === "vend")) {
        var key = chipId === "vin" ? "inArticleBanner" : "endArticleBanner";
        this.update(function (d) {
          var c = d[key];
          if (slot === "tray") { c.position = "none"; msg = "Fora dos artigos"; }
          else if (slot === "meio") { c.position = "meio"; msg = "No meio de cada artigo (se ajusta ao tamanho)"; }
          else if (slot === "fim") { c.position = "fim"; msg = "No fim do artigo"; }
          else { c.position = "bloco"; c.afterBlock = blockOf(slot); msg = "Depois do bloco " + blockOf(slot) + " em todo artigo"; }
          if (slot !== "tray" && c.enabled === false) { c.enabled = true; msg += " · ligado"; }
        });
        this.setState({ sel: chipId });
      }
      this.setState({ toast: msg });
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function () { self.setState({ toast: null }); }, 3200);
      var focus = CHIPS[focusKind];
      if (focus && slot !== "tray" && this.preview) this.preview.focus(focus.focus);
    },

    // --- arrastar (SortableJS direto: peças "fonte" são copiadas) -------------
    bindSlot: function (slot, el) {
      var self = this;
      this.sortables = this.sortables || {};
      if (!el) return;
      if (this.sortables[slot] && this.sortables[slot].el === el) return;
      if (this.sortables[slot]) this.sortables[slot].destroy();
      if (typeof Sortable === "undefined") return;
      this.sortables[slot] = Sortable.create(el, {
        group: {
          name: "pdz",
          pull: function (to, from, dragEl) { return dragEl.getAttribute("data-src") ? "clone" : true; },
          put: function (to, from, dragEl) { return accepts(to.el.getAttribute("data-slot"), dragEl.getAttribute("data-file")) && dragEl.getAttribute("data-file") === self.mode(); }
        },
        sort: false, animation: 150, forceFallback: true, fallbackTolerance: 4,
        filter: ".is-locked,.nm", preventOnFilter: false, draggable: ".pdz-chip",
        ghostClass: "pds-ghost", dragClass: "pds-drag",
        onChoose: function (evt) {
          document.documentElement.classList.add("pds-dragging", "pdz-drag-" + evt.item.getAttribute("data-file"));
        },
        onUnchoose: function () {
          document.documentElement.classList.remove("pds-dragging", "pdz-drag-ads", "pdz-drag-vitrine");
          try { window.getSelection().removeAllRanges(); } catch (e) {}
        },
        onEnd: function (evt) {
          var item = evt.item, from = evt.from, to = evt.to;
          if (from === to) return;
          if (evt.pullMode === "clone" && evt.clone && evt.clone.parentNode === from) {
            if (item.parentNode) item.parentNode.removeChild(item);
            from.insertBefore(item, evt.clone);
            from.removeChild(evt.clone);
          } else {
            if (item.parentNode) item.parentNode.removeChild(item);
            from.insertBefore(item, from.children[evt.oldIndex] || null);
          }
          self.drop(item.getAttribute("data-chip"), to.getAttribute("data-slot"));
        }
      });
    },
    destroySortables: function () {
      var s = this.sortables || {};
      Object.keys(s).forEach(function (k) { try { s[k].destroy(); } catch (e) {} });
      this.sortables = {};
    },

    chip: function (c, opts) {
      var self = this, info = CHIPS[c.kind];
      var mine = info.file === this.mode();
      opts = opts || {};
      var id = opts.src ? "src-" + c.kind : c.id;
      var selKey = opts.src ? c.kind : c.id;
      return h("div", {
        key: id, className: "pdz-chip" + (mine ? "" : " is-locked") + (c.off ? " is-off" : "") + (this.state.sel === selKey ? " is-sel" : ""),
        "data-chip": id, "data-file": info.file, "data-src": opts.src ? "1" : null,
        style: { borderLeftColor: info.color },
        title: mine ? "Arraste pra mudar o lugar · toque pra editar" : "Editado em “" + TITLES[info.file] + "”",
        onClick: function () { if (mine) self.setState({ sel: selKey }); if (info.focus && self.preview) self.preview.focus(info.focus); }
      }, mine ? null : h("span", { className: "lk", "aria-hidden": "true" }, "🔒"), info.label, opts.src ? h("small", null, "arraste pro artigo") : null);
    },
    slot: function (slot, chips, name, sub) {
      var self = this;
      var acc = [accepts(slot, "ads") ? "ads" : "", accepts(slot, "vitrine") ? "vitrine" : ""].join(" ");
      return h("div", {
        key: slot, className: "pdz-slot" + (name ? " named" : ""), "data-slot": slot, "data-acc": acc,
        ref: function (el) { self.bindSlot(slot, el); }
      },
        name ? h("span", { className: "nm" }, name, sub ? h("small", null, sub) : null) : null,
        (chips || []).map(function (c) { return self.chip(c); }));
    },

    renderMap: function () {
      var pl = this.placements();
      var rows = [this.slot("top", pl.top, "Topo", "antes do texto")];
      var half = Math.ceil(pl.n / 2);
      for (var k = 1; k <= pl.n; k++) {
        if (k === 1 || k === 4 || k === 7) rows.push(h("div", { key: "t" + k, className: "pdz-title", "aria-hidden": "true" }));
        rows.push(h("div", { key: "blk" + k, className: "pdz-block", "aria-hidden": "true" }, h("span", null, "bloco " + k)));
        rows.push(this.slot("b" + k, pl["b" + k]));
        if (k === half) rows.push(this.slot("meio", pl.meio, "Meio automático", "vai pro meio de cada artigo, curto ou longo"));
      }
      rows.push(this.slot("fim", pl.fim, "Fim do artigo", "depois do texto, antes dos relacionados"));
      return h("div", { className: "pdz-map", "aria-label": "Mapa do artigo" },
        h("div", { className: "pdz-hd" }, h("b", null, "Mapa do artigo"), h("small", null, "cada parágrafo, título ou bloco conta 1")), rows);
    },

    renderTray: function () {
      var self = this, mode = this.mode(), pl = this.placements();
      var sources = mode === "ads" ? [{ kind: "own" }, { kind: "network" }] : [];
      return h("div", { className: "pdz-tray" },
        h("b", null, mode === "ads" ? "Arraste pro mapa · pra tirar, arraste de volta" : "Fora dos artigos · arraste pro mapa"),
        h("div", { className: "pdz-slot named", "data-slot": "tray", "data-acc": "ads vitrine", ref: function (el) { self.bindSlot("tray", el); } },
          sources.map(function (c) { return self.chip(c, { src: true }); }),
          pl.tray.map(function (c) { return self.chip(c); }),
          !sources.length && !pl.tray.length ? h("span", { className: "nm" }, h("small", null, "Os dois banners estão no artigo.")) : null));
    },

    // --- edição de cada peça -----------------------------------------------------
    input: function (label, value, onChange, opts) {
      opts = opts || {};
      return h("div", { className: "pds-field" },
        h("label", null, label,
          h(opts.area ? "textarea" : "input", { className: "pds-input" + (opts.code ? " pdz-code" : ""), value: value || "", rows: opts.rows || 2, placeholder: opts.ph || "", style: { marginTop: "5px" },
            onChange: function (e) { onChange(e.target.value); } })),
        opts.hint ? h("p", { className: "pds-hint" }, opts.hint) : null);
    },
    whereSelect: function (value, options, onChange) {
      return h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Onde aparece"),
        h("select", { className: "pds-input", value: value, onChange: function (e) { onChange(e.target.value); } },
          options.map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
    },
    blockOptions: function (n) {
      var out = [];
      for (var k = 1; k <= Math.max(8, n); k++) out.push(["b" + k, "Depois do bloco " + k]);
      return out;
    },

    renderAdsCards: function () {
      var self = this, d = this.data(), P = d.positions, B = d.ownBanner || {};
      var pl = this.placements();
      var posOf = function (kind) {
        var out = [];
        if (P.top === kind) out.push("topo");
        if (P.mid === kind) out.push("depois do bloco " + P.midAfterBlock);
        return out.length ? out.join(" e ") : "fora do artigo";
      };
      var setB = function (k) { return function (v) { self.update(function (x) { x.ownBanner[k] = v; }); }; };
      var ownCard = h("div", { key: "own", className: "pds-card" },
        h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Banner próprio"), h("small", null, "Promove um produto seu · " + posOf("own")))),
        !B.title ? h("p", { className: "pdz-warn" }, "Sem título, o banner próprio não aparece no site.") : null,
        h("div", { className: "pds-grid2" },
          this.input("Selo (pequeno, em cima)", B.kicker, setB("kicker")),
          this.input("Título", B.title, setB("title"))),
        this.input("Texto", B.body, setB("body"), { area: true }),
        h("div", { className: "pds-grid2" },
          this.input("Texto do botão", B.ctaText, setB("ctaText"), { ph: "Saiba mais" }),
          this.input("Link do botão", B.ctaHref, setB("ctaHref"), { ph: "/produtos-digitais/" })),
        K.colorField("Cor da borda", B.color, setB("color")));
      var netCard = h("div", { key: "net", className: "pds-card" },
        h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Anúncio de rede"), h("small", null, "AdSense ou outra rede · " + posOf("network")))),
        (P.top === "network" || P.mid === "network") && !(d.network && d.network.adSnippet)
          ? h("p", { className: "pdz-warn" }, "Tem uma posição de anúncio de rede, mas o código do anúncio está vazio — o espaço fica em branco.") : null,
        h("p", { className: "pdz-note" }, "Só carrega pra quem aceitou os cookies. Na prévia aparece só a caixa “Publicidade”."),
        this.input("Código do <head> (1× por página)", d.network.headSnippet, function (v) { self.update(function (x) { x.network.headSnippet = v; }); }, { area: true, code: true, rows: 3 }),
        this.input("Código do anúncio (repete em cada posição)", d.network.adSnippet, function (v) { self.update(function (x) { x.network.adSnippet = v; }); }, { area: true, code: true, rows: 3 }));
      var where = h("div", { key: "where", className: "pds-card" },
        h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Posições"), h("small", null, "O mesmo que arrastar no mapa"))),
        h("div", { className: "pds-grid2" },
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Topo do artigo"),
            h("select", { className: "pds-input", value: P.top || "none", onChange: function (e) { var v = e.target.value; self.update(function (x) { x.positions.top = v; }); } },
              h("option", { value: "none" }, "Nada"), h("option", { value: "own" }, "Banner próprio"), h("option", { value: "network" }, "Anúncio de rede"))),
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Meio do artigo"),
            h("select", { className: "pds-input", value: P.mid || "none", onChange: function (e) { var v = e.target.value; self.update(function (x) { x.positions.mid = v; }); } },
              h("option", { value: "none" }, "Nada"), h("option", { value: "own" }, "Banner próprio"), h("option", { value: "network" }, "Anúncio de rede")))),
        P.mid && P.mid !== "none" ? this.whereSelect("b" + P.midAfterBlock, this.blockOptions(pl.n), function (v) { self.update(function (x) { x.positions.midAfterBlock = blockOf(v); }); }) : null);
      return [where, ownCard, netCard];
    },

    renderVitrineCards: function () {
      var self = this, d = this.data(), pl = this.placements();
      var posValue = function (c) { return c.position === "bloco" ? "b" + (c.afterBlock || 4) : (c.position || "none"); };
      var posOptions = [["none", "Não mostrar em nenhum artigo"], ["meio", "Meio automático"]].concat(this.blockOptions(pl.n)).concat([["fim", "Fim do artigo"]]);
      var setPos = function (key) {
        return function (v) {
          self.update(function (x) {
            var c = x[key];
            if (v.charAt(0) === "b") { c.position = "bloco"; c.afterBlock = blockOf(v); } else c.position = v;
          });
        };
      };
      var card = function (key, chip, title, sub, withImage, withBody) {
        var c = d[key] || {};
        var set = function (k) { return function (v) { self.update(function (x) { x[key][k] = v; }); }; };
        return h("div", { key: key, className: "pds-card" + (self.state.sel === chip ? "" : "") },
          h("div", { className: "pds-card-h" },
            h("div", null, h("b", null, title), h("small", null, sub)),
            h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(c.enabled !== false), "aria-label": "Mostrar " + title,
              onClick: function () { self.update(function (x) { x[key].enabled = x[key].enabled === false; }); } })),
          c.enabled === false ? h("p", { className: "pdz-warn" }, "Desligado: não aparece em nenhum artigo.") : null,
          self.whereSelect(posValue(c), posOptions, setPos(key)),
          h("div", { className: "pds-grid2" },
            self.input("Selo (pequeno, em cima)", c.kicker, set("kicker")),
            self.input("Título", c.title, set("title"))),
          withBody ? self.input("Texto", c.body, set("body"), { area: true }) : null,
          withImage ? h("div", { className: "pds-field" },
            h("span", { className: "pds-label" }, "Foto · 1200×675, horizontal"),
            h("div", { className: "pds-img" + (c.image ? " has" : ""), role: "button", tabIndex: 0, style: { aspectRatio: "16/9", maxWidth: "340px", backgroundImage: c.image ? "url(" + JSON.stringify(K.assetUrl(self.props, c.image)) + ")" : null },
              onClick: function () { K.Media.open(self, "img", c.image); } }, c.image ? null : "Escolher foto")) : null,
          h("div", { className: "pds-grid2" },
            self.input("Texto do botão", c.ctaText, set("ctaText"), { ph: "Ver mais →" }),
            self.input("Link do botão", c.ctaHref, set("ctaHref"), { ph: "/produtos-digitais/" })),
          K.colorField("Cor (selo e botão)", c.color, set("color")));
      };
      return [
        card("inArticleBanner", "vin", "Banner com foto", "Encaixado no texto", true, false),
        card("endArticleBanner", "vend", "Faixa de fechamento", "Larga, pensada pro fim", false, true)
      ];
    },

    renderPreviewExtra: function () {
      var self = this;
      if (!this.state.posts.length) return null;
      return h("select", { className: "pds-input", style: { width: "auto", maxWidth: "220px", padding: "5px 8px", fontSize: "12.5px" }, "aria-label": "Artigo da prévia", value: this.state.slug,
        onChange: function (e) { self.setState({ slug: e.target.value }); } },
        this.state.posts.map(function (p) { return h("option", { key: p.slug, value: p.slug }, p.title.slice(0, 48)); }));
    },

    render: function () {
      var self = this, mode = this.mode();
      var d = this.data(), pl = this.placements();
      var placed = ["top", "meio", "fim"].concat(Object.keys(pl).filter(function (k) { return /^b\d+$/.test(k); }))
        .reduce(function (n, k) { return n + (pl[k] || []).filter(function (c) { return CHIPS[c.kind].file === mode; }).length; }, 0);
      var summary = mode === "ads"
        ? [d.enabled ? "Anúncios ligados" : "Anúncios desligados", placed + " posição(ões) no artigo"]
        : [placed + " banner(s) nos artigos"];
      var bar = K.launcher(summary, "Abrir mapa do artigo", this.open);
      if (!this.state.open) return bar;
      var otherName = TITLES[mode === "ads" ? "vitrine" : "ads"];
      var edit = [
        mode === "ads" ? h("div", { key: "master", className: "pds-card", style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } },
          h("div", null, h("b", null, "Anúncios nos artigos"), h("p", { className: "pds-hint" }, "Desligado: nenhum anúncio aparece, nem nas posições marcadas. É o botão de emergência.")),
          h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(!!d.enabled), "aria-label": "Ligar anúncios",
            onClick: function () { self.update(function (x) { x.enabled = !x.enabled; }); } })) : null,
        h("p", { key: "how", className: "pdz-note" }, "Arraste cada peça pro lugar em que ela aparece em todos os artigos. As que têm cadeado são de “" + otherName + "” — aparecem aqui pra você ver o artigo inteiro."),
        h("div", { key: "tray" }, this.renderTray()),
        h("div", { key: "map" }, this.renderMap()),
        h("p", { key: "per", className: "pdz-note" }, "Um artigo pode fugir da regra: no editor visual dele, o “+” tem “Banner de vitrine” (fixa num lugar ou escolhe o produto) e “Sem banner aqui” (desliga só nele).")
      ].concat(mode === "ads" ? this.renderAdsCards() : this.renderVitrineCards());
      var url = this.state.slug ? "/artigos/post/?slug=" + encodeURIComponent(this.state.slug) : "/artigos/";
      return h("div", null, bar,
        h("div", { className: "pds-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Banners dentro do artigo" },
          h("div", { className: "pds-top" },
            h("h2", null, "Banners dentro do artigo · " + TITLES[mode]),
            h("small", null, "As mudanças vão pro site quando você clicar em Publicar no /admin."),
            h("button", { type: "button", className: "pds-btn primary", onClick: this.close }, "Concluir")),
          h("div", { className: "pds-mobile-tabs" },
            h("div", { className: "pds-tabs" },
              h("button", { type: "button", "aria-pressed": String(this.state.tab !== "preview"), onClick: function () { self.setState({ tab: "edit" }); } }, "Mapa"),
              h("button", { type: "button", "aria-pressed": String(this.state.tab === "preview"), onClick: function () { self.setState({ tab: "preview" }); } }, "Ver prévia"))),
          h("div", { className: "pds-body", "data-tab": this.state.tab === "preview" ? "preview" : "edit" },
            h("div", { className: "pds-edit" }, edit),
            h("div", { className: "pds-side" },
              h(K.Preview, { ref: function (c) { self.preview = c; }, url: url, device: this.state.device, version: this.state.version,
                onDevice: function (dv) { self.setState({ device: dv }); }, extra: this.renderPreviewExtra() }))),
          this.state.toast ? h("div", { className: "pdb-toast", role: "status", style: { position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)", background: "#2B2B2B", color: "#fff", borderRadius: "12px", padding: "10px 14px", fontSize: "13px", zIndex: 1000001 } }, this.state.toast) : null));
    }
  });

  var AdsPreview = createClass({ render: function () { return null; } });
  CMS.registerWidget("article-ads-studio", AdsStudio, AdsPreview);
})();
