// Estúdio de produtos digitais — a lista "Produtos" da coleção
// produtos_digitais (content/produtos-digitais.json), no mesmo design
// system da vitrine (assets/css/vitrine.css). Três colunas: produtos (ordem
// da vitrine, arrastável) · editor em seções com o nome da parte da página
// que cada uma muda · prévia com a página real (lista, página do produto e
// compra confirmada). Abrir uma seção leva a prévia até aquela parte.
//
// Grava os mesmos campos de sempre — active, slug, title, kicker, summary,
// description, image, gallery[{type, image, videoUrl, caption}], price,
// priceOld, launchNote, guaranteeDays, features[], faq[{q, a}], stripeLink,
// bundleWith[] — e um campo novo: nextSteps[{title, text}], os próximos
// passos da tela de compra confirmada.
//
// Nada é salvo sozinho: o estúdio muda o valor do campo e o arquivo vai pro
// site quando você clica em "Publicar" no /admin, como sempre.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[product-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var DATA_PATH = "/content/produtos-digitais.json";
  var GALLERY_MAX = 6;
  var STRIPE_RE = /^https:\/\/buy\.stripe\.com\//;

  K.css("pds-product-coupon", [
    ".pdx-coupon{display:flex;flex-direction:column;gap:10px;border:1.5px dashed #CDB8AE;background:#FAF4F1;border-radius:12px;padding:12px;}"
  ].join("\n"));
  K.css("pds-product-style", [
    ".pdx{position:fixed;inset:0;z-index:999999;background:#F4F1EC;color:#2B2B2B;display:flex;flex-direction:column;height:100vh;height:100dvh;font:14px/1.5 " + K.FONT + ";}",
    ".pdx *,.pdx *::before,.pdx *::after{box-sizing:border-box;}",
    ".pdx h1,.pdx h2{font-family:" + K.DISPLAY + ";font-weight:600;letter-spacing:-.01em;margin:0;}",
    ".pdx-top{display:flex;align-items:center;gap:12px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));background:#FBFAF7;border-bottom:1px solid #E6E0D6;flex-shrink:0;}",
    ".pdx-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}",
    ".pdx-brand i{width:30px;height:30px;border-radius:9px;background:#604034;color:#F4EDE6;display:grid;place-items:center;font:600 16px " + K.DISPLAY + ";font-style:normal;flex:none;}",
    ".pdx-brand b{font-family:" + K.DISPLAY + ";font-size:17px;font-weight:600;display:block;line-height:1.2;}",
    ".pdx-brand small{display:block;color:#6E6862;font-size:11.5px;}",
    ".pdx-app{flex:1;min-height:0;display:grid;grid-template-columns:250px minmax(0,1fr) minmax(0,1.05fr);}",
    ".pdx-col{min-height:0;overflow-y:auto;}",
    ".pdx-list{border-right:1px solid #E6E0D6;background:#FBFAF7;padding:14px 12px;display:flex;flex-direction:column;gap:10px;}",
    ".pdx-list-h{display:flex;justify-content:space-between;align-items:center;gap:8px;}",
    ".pdx-list-h b{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#6E6862;}",
    ".pdx-items{display:flex;flex-direction:column;gap:8px;}",
    ".pdx-row{display:flex;gap:8px;align-items:center;background:#fff;border:1.5px solid #E6E0D6;border-radius:12px;padding:6px 8px 6px 2px;cursor:pointer;transition:border-color .2s,box-shadow .2s;}",
    ".pdx-row:hover{border-color:#D8D0C3;}",
    ".pdx-row.is-sel{border-color:#577328;box-shadow:0 0 0 3px #E7ECDC;}",
    ".pdx-row.is-off{opacity:.6;}",
    ".pdx-row .th{width:44px;height:33px;border-radius:7px;background:#F4F1EC center/cover no-repeat;flex:none;}",
    ".pdx-row .t{flex:1;min-width:0;}",
    ".pdx-row .t b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdx-row .t span{font-size:11.5px;color:#6E6862;}",
    ".pdx-dot{width:8px;height:8px;border-radius:50%;flex:none;}",
    ".pdx-dot.ok{background:#577328;}.pdx-dot.warn{background:#B07A1E;}.pdx-dot.off{background:#D8D0C3;}",
    ".pdx-legend{margin-top:auto;font-size:11.5px;color:#6E6862;display:flex;flex-direction:column;gap:5px;padding-top:10px;border-top:1px solid #E6E0D6;}",
    ".pdx-legend span{display:flex;align-items:center;gap:6px;}",
    ".pdx-edit{padding:18px 20px 90px;display:flex;flex-direction:column;gap:12px;}",
    ".pdx-head{display:flex;gap:12px;align-items:center;}",
    ".pdx-head h1{font-size:22px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdx-ready{background:#fff;border:1px solid #E6E0D6;border-radius:16px;padding:14px 16px;}",
    ".pdx-ready-h{display:flex;align-items:center;gap:12px;}",
    ".pdx-ring{width:44px;height:44px;flex:none;}",
    ".pdx-ring circle{fill:none;stroke-width:5;}",
    ".pdx-ring .bg{stroke:#E6E0D6;}",
    ".pdx-ring .fg{stroke:#577328;stroke-linecap:round;transition:stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1);transform:rotate(-90deg);transform-origin:center;}",
    ".pdx-ready-h b{display:block;font-size:14px;}",
    ".pdx-ready-h span{font-size:12.5px;color:#6E6862;}",
    ".pdx-todo{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}",
    ".pdx-todo button{border:1px dashed #D8D0C3;background:#FBFAF7;border-radius:20px;padding:3px 10px;font:12px " + K.FONT + ";color:#2B2B2B;cursor:pointer;}",
    ".pdx-todo button:hover{border-color:#604034;background:#EFE6E1;}",
    ".pdx-todo button::before{content:'＋ ';color:#604034;}",
    ".pdx-sec{background:#fff;border:1px solid #E6E0D6;border-radius:16px;transition:border-color .2s,box-shadow .2s;}",
    ".pdx-sec.is-open{border-color:#D8D0C3;box-shadow:0 1px 2px rgba(60,40,30,.06),0 8px 24px -14px rgba(60,40,30,.28);}",
    ".pdx-sec-h{width:100%;display:flex;gap:12px;align-items:center;padding:12px 14px;background:none;border:0;cursor:pointer;text-align:left;font:inherit;color:inherit;}",
    ".pdx-sec-h .ic{width:32px;height:32px;border-radius:9px;background:#F4F1EC;display:grid;place-items:center;flex:none;color:#604034;font-size:15px;}",
    ".pdx-sec-h .tt{flex:1;min-width:0;}",
    ".pdx-sec-h b{display:block;font-size:14px;}",
    ".pdx-sec-h small{display:block;font-size:12px;color:#6E6862;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdx-sec-h .chev{color:#A39C92;transition:transform .3s;}",
    ".pdx-sec.is-open .chev{transform:rotate(180deg);}",
    ".pdx-sec-in{padding:4px 14px 16px;display:flex;flex-direction:column;gap:12px;}",
    ".pdx-where{font-size:11.5px;color:#604034;background:#EFE6E1;border-radius:8px;padding:4px 9px;width:max-content;max-width:100%;}",
    ".pdx-msg{font-size:12px;margin:0;}",
    ".pdx-msg.err{color:#A63A2E;font-weight:600;}.pdx-msg.tip{color:#6E6862;}.pdx-msg.warn{color:#8A5F12;}",
    ".pdx .pds-input.is-err{border-color:#A63A2E;box-shadow:0 0 0 3px #F7E4E0;}",
    ".pdx-disc{height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;background:#E7ECDC;color:#3F5A1B;font-variant-numeric:tabular-nums;}",
    ".pdx-disc.none{background:#F4F1EC;color:#A39C92;font-weight:500;}",
    ".pdx-li{display:flex;gap:6px;align-items:center;background:#FBFAF7;border:1px solid #E6E0D6;border-radius:10px;padding:4px 6px 4px 2px;}",
    ".pdx-li.is-top{background:#F6F8F1;border-color:#D6DFC4;}",
    ".pdx-li.is-faq{align-items:flex-start;}",
    ".pdx-li .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}",
    ".pdx-li .tag{font-size:10.5px;font-weight:700;color:#3F5A1B;background:#E7ECDC;border-radius:20px;padding:1px 7px;white-space:nowrap;}",
    ".pdx-plist{display:flex;flex-direction:column;gap:6px;}",
    ".pdx-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;}",
    ".pdx-gi{display:flex;flex-direction:column;gap:4px;min-width:0;cursor:grab;touch-action:none;}",
    ".pdx-gi .im{position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;border:1.5px solid #E6E0D6;background:#F4F1EC center/cover no-repeat;}",
    ".pdx-gi .n{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.6);color:#fff;font-size:10.5px;font-weight:700;border-radius:20px;padding:0 7px;}",
    ".pdx-gi .role{position:absolute;left:5px;right:5px;bottom:5px;background:rgba(255,255,255,.93);font-size:10px;border-radius:6px;padding:2px 5px;line-height:1.25;color:#604034;font-weight:600;}",
    ".pdx-gi .play{position:absolute;inset:0;display:grid;place-items:center;background:#2B2B2B;color:#fff;font-size:22px;}",
    ".pdx-gi .rm{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0;}",
    ".pdx-gi .acts button{width:100%;border:1px solid #E6E0D6;background:#fff;border-radius:6px;font:11px " + K.FONT + ";padding:3px;cursor:pointer;color:#6E6862;}",
    ".pdx-cover{width:150px;aspect-ratio:4/3;flex:none;}",
    ".pdx-combo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}",
    ".pdx-zone{border:1.5px dashed #D8D0C3;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0;}",
    ".pdx-zone .z{display:flex;flex-direction:column;gap:6px;min-height:46px;}",
    ".pdx-chip{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #E6E0D6;border-radius:10px;padding:5px 9px 5px 5px;font-size:12.5px;font-weight:600;cursor:grab;touch-action:none;}",
    ".pdx-chip i{width:34px;height:26px;border-radius:5px;background:#F4F1EC center/cover no-repeat;flex:none;}",
    ".pdx-chip small{display:block;font-weight:400;color:#6E6862;font-size:11px;}",
    ".pdx-prev{border-left:1px solid #E6E0D6;display:flex;flex-direction:column;background:#FBFAF7;min-height:0;}",
    ".pdx-mtabs{display:none;padding:8px 16px;background:#FBFAF7;border-bottom:1px solid #E6E0D6;}",
    ".pdx-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translate(-50%,20px);opacity:0;background:#2B2B2B;color:#fff;border-radius:12px;padding:9px 10px 9px 14px;display:flex;gap:12px;align-items:center;font-size:13px;z-index:1000000;transition:opacity .25s,transform .35s cubic-bezier(.2,.7,.2,1);max-width:calc(100% - 32px);pointer-events:none;}",
    ".pdx-toast.is-show{opacity:1;transform:translate(-50%,0);pointer-events:auto;}",
    ".pdx-toast button{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:8px;padding:5px 10px;font:600 12.5px " + K.FONT + ";cursor:pointer;}",
    ".pdx-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(43,43,43,.14);border-radius:6px;background:#fff;font:13px " + K.FONT + ";}",
    "@media (max-width:1100px){.pdx-app{grid-template-columns:210px minmax(0,1fr) minmax(0,1fr);}}",
    "@media (max-width:900px){",
    "  .pdx-app{display:block;overflow-y:auto;}",
    "  .pdx-mtabs{display:block;}",
    "  .pdx-col{display:none;overflow:visible;}",
    "  .pdx-app[data-tab=lista] .pdx-list,.pdx-app[data-tab=editar] .pdx-edit{display:flex;}",
    "  .pdx-app[data-tab=previa]{overflow:hidden;display:flex;}",
    "  .pdx-app[data-tab=previa] .pdx-prev{display:flex;flex:1;border-left:0;}",
    "  .pdx-list{border-right:0;}",
    "  .pdx-top small{display:none;}",
    "}",
    "@media (max-width:560px){.pdx-combo{grid-template-columns:minmax(0,1fr);}.pdx-cover{width:120px;}.pdx-edit{padding:14px 14px 90px;}}"
  ].join("\n"));

  function eur(n) {
    if (n === "" || n == null || isNaN(Number(n))) return "";
    return Number(n).toFixed(2).replace(".", ",") + " €";
  }
  function discount(p) {
    return p.priceOld && Number(p.priceOld) > Number(p.price) ? Math.round((1 - p.price / p.priceOld) * 100) : 0;
  }
  // Mesma regra de bundlePrice em assets/js/vitrine.js.
  function bundlePrice(items) {
    var sum = items.reduce(function (a, it) { return a + Number(it.price || 0); }, 0), n = items.length;
    var fin = n > 1 ? Math.max(sum * (1 - (n >= 4 ? 0.2 : n === 3 ? 0.15 : 0.1)), sum * 0.5) : sum;
    return { sum: sum, fin: fin, pct: sum > 0 ? Math.round((1 - fin / sum) * 100) : 0 };
  }
  function num(text) {
    var t = String(text).trim().replace(",", ".");
    if (t === "") return null;
    var n = Number(t);
    return isNaN(n) ? undefined : n;
  }
  function clean(items) {
    items.forEach(function (p) {
      if (p.priceOld === null || p.priceOld === "" || p.priceOld === undefined) delete p.priceOld;
      if (p.launchNote === "") delete p.launchNote;
      if (p.nextSteps && !p.nextSteps.length) delete p.nextSteps;
      if (p.coupon && !p.coupon.code && !p.coupon.label && !p.coupon.percent && !p.coupon.until) delete p.coupon;
    });
    return items;
  }
  function norm(p) {
    p.gallery = p.gallery || []; p.features = p.features || []; p.faq = p.faq || [];
    p.bundleWith = p.bundleWith || []; p.nextSteps = p.nextSteps || [];
    return p;
  }
  function newProduct() {
    return { active: false, slug: "", title: "", kicker: "", summary: "", description: "", image: "", gallery: [], price: 0, guaranteeDays: 0, features: [], faq: [], stripeLink: "", bundleWith: [], nextSteps: [] };
  }
  // O que a página precisa pra ficar completa (a barra de progresso do topo).
  function checks(p) {
    return [
      ["vitrine", "Título", !!p.title],
      ["vitrine", "Resumo do card", (p.summary || "").length >= 40],
      ["vitrine", "Capa", !!p.image],
      ["galeria", "2ª foto (troca ao passar o mouse)", p.gallery.filter(function (g) { return g.type !== "Vídeo" && g.image; }).length >= 2],
      ["topo", "3 itens em “O que inclui”", p.features.filter(Boolean).length >= 3],
      ["topo", "Descrição", (p.description || "").length >= 80],
      ["faq", "Pelo menos 3 perguntas", p.faq.filter(function (f) { return f.q; }).length >= 3],
      ["pagamento", "Link do Stripe", STRIPE_RE.test(p.stripeLink || "")],
      ["confirmada", "Próximos passos depois da compra", p.nextSteps.filter(function (s) { return s.title; }).length >= 2]
    ];
  }
  function status(p) {
    if (!p.active) return ["off", "Escondido"];
    if (!STRIPE_RE.test(p.stripeLink || "")) return ["warn", "No ar · falta o pagamento"];
    var miss = checks(p).filter(function (c) { return !c[2]; }).length;
    return miss ? ["warn", "No ar · " + miss + " a completar"] : ["ok", "No ar · completo"];
  }
  // Onde cada seção aparece na prévia: [tela, seletor].
  var FOCUS = {
    vitrine: ["lista", null], topo: ["pagina", ".vt-buy"], preco: ["pagina", "#vt-price"], galeria: ["pagina", ".vt-gal"],
    faq: ["pagina", ".vt-faq"], combo: ["pagina", "#vt-combo"], pagamento: ["pagina", "#vt-buy-btn"], confirmada: ["confirmada", ".vt-done"]
  };

  var ProductStudioControl = createClass({
    getInitialState: function () {
      return { open: false, sel: 0, sec: "vitrine", view: "pagina", device: "mobile", tab: "editar", version: 0, confirmDelete: false, toast: null, drafts: {} };
    },
    componentDidUpdate: function () {
      var self = this;
      K.Media.collect(this, function (target, path) {
        var parts = target.split(":"), i = Number(parts[1]);
        self.change(function (items) {
          var p = items[i];
          if (!p) return;
          if (parts[0] === "cover") p.image = path;
          if (parts[0] === "gal") {
            var gi = Number(parts[2]);
            if (p.gallery[gi]) { p.gallery[gi].image = path; p.gallery[gi].type = "Foto"; }
            else if (p.gallery.length < GALLERY_MAX) p.gallery.push({ type: "Foto", image: path, caption: "" });
          }
        }, parts[0] === "cover" ? "Capa trocada" : "Foto na galeria");
      });
    },
    componentWillUnmount: function () {
      window.PDPreview.clear(DATA_PATH);
      K.lockPage(false);
      clearTimeout(this.toastTimer);
    },

    items: function () { return K.toJS(this.props.value, []).map(norm); },

    // Toda mudança passa por aqui: guarda o antes (pra desfazer), aplica,
    // entrega ao Decap e atualiza a prévia. Campos opcionais vazios saem.
    change: function (fn, label, undoable) {
      var before = this.items();
      var items = this.items();
      fn(items);
      clean(items);
      // Digitação seguida vira um passo só no "Desfazer".
      var now = Date.now(), typing = !label;
      if (!typing || !this.lastTyping || now - this.lastTyping > 1200) this.history = (this.history || []).concat([clean(before)]).slice(-40);
      this.lastTyping = typing ? now : 0;
      this.props.onChange(items);
      this.pushPreview(items);
      this.setState({ version: this.state.version + 1 });
      if (label) this.showToast(label, undoable);
    },
    undo: function () {
      var prev = (this.history || []).pop();
      if (!prev) return;
      this.lastTyping = 0;
      this.props.onChange(prev);
      this.pushPreview(prev);
      this.setState({ version: this.state.version + 1, sel: Math.min(this.state.sel, Math.max(0, prev.length - 1)), confirmDelete: false });
      this.showToast("Desfeito");
    },
    showToast: function (text, undoable) {
      var self = this;
      clearTimeout(this.toastTimer);
      this.setState({ toast: { text: text, undo: !!undoable } });
      this.toastTimer = setTimeout(function () { self.setState({ toast: null }); }, undoable ? 4200 : 1800);
    },
    pushPreview: function (items) {
      var props = this.props;
      window.PDPreview.set(DATA_PATH, { items: (items || this.items()).map(function (p) {
        var c = JSON.parse(JSON.stringify(p));
        c.image = K.assetUrl(props, c.image);
        (c.gallery || []).forEach(function (g) { g.image = K.assetUrl(props, g.image); });
        return c;
      }) });
    },
    open: function () {
      this.pushPreview();
      K.lockPage(true);
      this.history = [];
      this.setState({ open: true, sel: 0, sec: "vitrine", tab: window.innerWidth <= 900 ? "editar" : this.state.tab, confirmDelete: false });
    },
    close: function () {
      K.lockPage(false);
      this.setState({ open: false, toast: null });
    },
    set: function (key, value, label) {
      var i = this.state.sel;
      this.change(function (items) { items[i][key] = value; }, label);
    },
    openSection: function (key, scroll) {
      var next = this.state.sec === key && !scroll ? null : key;
      var f = FOCUS[key], st = { sec: next, confirmDelete: false };
      if (next && f) st.view = f[0];
      this.setState(st);
      var self = this;
      if (next && f) {
        var p = this.items()[this.state.sel] || {};
        var sel = f[1] || ('.vt-card[href$="' + encodeURIComponent(p.slug || "") + '"]');
        setTimeout(function () { if (self.preview) self.preview.focus(sel); }, 60);
      }
      if (scroll) setTimeout(function () { var el = document.getElementById("pdx-sec-" + key); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
    },

    // --- peças ---------------------------------------------------------------
    input: function (key, label, p, opts) {
      var self = this;
      opts = opts || {};
      var id = "pdx-" + key;
      return h("div", { className: "pds-field", key: key },
        h("label", { htmlFor: id, style: { display: "flex", justifyContent: "space-between" } }, label,
          opts.max ? h("em", { style: { fontStyle: "normal", color: "#A39C92" } }, (p[key] || "").length + "/" + opts.max) : null),
        h(opts.area ? "textarea" : "input", {
          id: id, className: "pds-input" + (opts.err ? " is-err" : ""), value: p[key] == null ? "" : p[key], rows: opts.rows,
          placeholder: opts.ph || "",
          onChange: function (e) {
            var v = e.target.value;
            // Produto recém-criado: o endereço acompanha o título até alguém mexer nele à mão.
            if (key === "title" && self.freshSlug != null && p.slug === self.freshSlug) {
              var sl = K.slugify(v);
              self.freshSlug = sl;
              self.change(function (items) { items[self.state.sel].title = v; items[self.state.sel].slug = sl; });
            }
            else self.set(key, v);
          }
        }),
        opts.msg ? h("p", { className: "pdx-msg " + (opts.msgKind || "tip") }, opts.msg) : null);
    },
    numInput: function (key, label, p, opts) {
      var self = this;
      opts = opts || {};
      var id = "pdx-" + key, draft = this.state.drafts[key];
      return h("div", { className: "pds-field", key: key },
        h("label", { htmlFor: id }, label),
        h("input", {
          id: id, className: "pds-input" + (opts.err ? " is-err" : ""), inputMode: "decimal", placeholder: opts.ph || "",
          value: draft !== undefined ? draft : (p[key] == null ? "" : String(p[key]).replace(".", ",")),
          onChange: function (e) {
            var raw = e.target.value, n = num(raw), d = Object.assign({}, self.state.drafts);
            d[key] = raw;
            self.setState({ drafts: d });
            if (n === undefined) return;
            self.set(key, n === null ? (opts.optional ? null : 0) : n);
          },
          onBlur: function () { var d = Object.assign({}, self.state.drafts); delete d[key]; self.setState({ drafts: d }); }
        }),
        opts.msg ? h("p", { className: "pdx-msg " + (opts.msgKind || "tip") }, opts.msg) : null);
    },
    section: function (key, icon, title, summary, where, body) {
      var self = this, open = this.state.sec === key;
      return h("section", { key: key, id: "pdx-sec-" + key, className: "pdx-sec" + (open ? " is-open" : "") },
        h("button", { type: "button", className: "pdx-sec-h", "aria-expanded": String(open), onClick: function () { self.openSection(key); } },
          h("span", { className: "ic", "aria-hidden": "true" }, icon),
          h("span", { className: "tt" }, h("b", null, title), h("small", null, summary)),
          h("span", { className: "chev", "aria-hidden": "true" }, "⌄")),
        open ? h("div", { className: "pdx-sec-in" }, h("span", { className: "pdx-where" }, "↗ " + where), body) : null);
    },

    // Cupom: faixa na página do produto + etiqueta "Cupom" no card da lista.
    // O código vai preenchido no pagamento (prefilled_promo_code do Stripe).
    renderCoupon: function (p, i) {
      var self = this;
      var c = p.coupon || {};
      var set = function (k, v) {
        self.change(function (it) { it[i].coupon = Object.assign({}, it[i].coupon || {}, (function () { var o = {}; o[k] = v; return o; })()); });
      };
      var today = new Date().toISOString().slice(0, 10);
      var expired = c.until && String(c.until).slice(0, 10) < today;
      var badCode = c.code && !/^[A-Z0-9_-]{3,}$/.test(c.code);
      var on = !!c.code && c.enabled !== false && !expired;
      var pct = Number(c.percent) || 0;
      var status = !c.code ? "Sem cupom" : c.enabled === false ? "Pausado — não aparece" : expired ? "Venceu — sumiu do site" : "Aparecendo na página e na lista";
      return h("div", { key: "cp", className: "pdx-coupon" },
        h("div", { className: "pds-row", style: { justifyContent: "space-between" } },
          h("div", null, h("b", { style: { fontSize: "13.5px" } }, "Cupom"), h("span", { className: "pds-pill " + (on ? "on" : c.code ? "warn" : "off"), style: { marginLeft: "8px" } }, status)),
          c.code ? h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(c.enabled !== false), "aria-label": "Mostrar o cupom",
            onClick: function () { self.change(function (it) { it[i].coupon = Object.assign({}, it[i].coupon, { enabled: c.enabled === false }); }, c.enabled === false ? "Cupom ligado" : "Cupom pausado", true); } }) : null),
        h("div", { className: "pds-grid2" },
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Código"),
            h("input", { className: "pds-input" + (badCode ? " is-err" : ""), value: c.code || "", placeholder: "Ex.: BEMVINDA10", style: { fontFamily: "ui-monospace,Menlo,monospace", textTransform: "uppercase" },
              onChange: function (e) { set("code", e.target.value.toUpperCase().replace(/\s+/g, "")); } })),
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "O que ele dá"),
            h("input", { className: "pds-input", value: c.label || "", placeholder: pct ? pct + "% de desconto" : "Ex.: 10% de desconto", onChange: function (e) { set("label", e.target.value); } }))),
        h("div", { className: "pds-grid2" },
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Desconto em % (opcional)"),
            h("input", { className: "pds-input", inputMode: "numeric", value: c.percent == null ? "" : String(c.percent), placeholder: "mostra o preço com cupom",
              onChange: function (e) { var n = parseInt(e.target.value, 10); set("percent", isNaN(n) ? undefined : Math.max(1, Math.min(99, n))); } })),
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Válido até (opcional)"),
            h("input", { type: "date", className: "pds-input" + (expired ? " is-err" : ""), value: c.until ? String(c.until).slice(0, 10) : "", onChange: function (e) { set("until", e.target.value || undefined); } }))),
        badCode ? h("p", { className: "pdx-msg err" }, "⚠ Use só letras, números, - ou _ (pelo menos 3).") : null,
        expired ? h("p", { className: "pdx-msg warn" }, "Venceu em " + String(c.until).slice(0, 10).split("-").reverse().join("/") + " — o site já parou de mostrar.") : null,
        pct ? h("p", { className: "pdx-msg tip" }, "Com o cupom: " + eur(Math.round(p.price * (1 - pct / 100) * 100) / 100) + ".") : null,
        h("p", { className: "pdx-msg tip" }, "Crie o mesmo código no Stripe (Produtos → Cupons → código promocional) e, no Payment Link, ligue “Permitir códigos promocionais”. O site já manda o código preenchido quando a pessoa clica em Comprar."));
    },

    renderList: function (items) {
      var self = this, props = this.props;
      var on = items.filter(function (p) { return p.active; }).length;
      return h("aside", { className: "pdx-col pdx-list", "aria-label": "Produtos" },
        h("div", { className: "pdx-list-h" },
          h("b", null, "Na vitrine · " + on + " de " + items.length),
          h("button", { type: "button", className: "pds-btn sm", onClick: function () {
            var np = newProduct();
            self.change(function (list) { list.unshift(np); }, "Produto novo criado (escondido até você ligar)", true);
            self.freshSlug = "";
            self.setState({ sel: 0, sec: "vitrine", tab: "editar", confirmDelete: false });
            setTimeout(function () { var t = document.getElementById("pdx-title"); if (t) t.focus(); }, 80);
          } }, "+ Novo")),
        h(K.SortableList, {
          className: "pdx-items", handle: ".pds-grip",
          onSort: function (e) {
            var selObj = items[self.state.sel];
            var moved = K.moveIn(items, e.oldIndex, e.newIndex);
            self.change(function (list) { var m = K.moveIn(list, e.oldIndex, e.newIndex); list.length = 0; Array.prototype.push.apply(list, m); }, "Nova ordem da vitrine", true);
            self.setState({ sel: moved.indexOf(selObj) });
          }
        }, items.map(function (p, i) {
          var st = status(p), img = K.assetUrl(props, p.image);
          return h("div", {
            key: i, className: "pdx-row" + (i === self.state.sel ? " is-sel" : "") + (p.active ? "" : " is-off"),
            role: "button", tabIndex: 0, "aria-current": String(i === self.state.sel),
            onClick: function (e) { if (e.target.closest(".pds-grip")) return; self.setState({ sel: i, confirmDelete: false, tab: "editar" }); },
            onKeyDown: function (e) { if (e.key === "Enter") self.setState({ sel: i, tab: "editar" }); }
          },
            h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar " + (p.title || "produto") }, "⠿"),
            h("span", { className: "th", style: img ? { backgroundImage: "url(" + JSON.stringify(img) + ")" } : null }),
            h("span", { className: "t" }, h("b", null, p.title || "(sem título)"), h("span", null, eur(p.price) + (discount(p) ? " · −" + discount(p) + "%" : ""))),
            h("span", { className: "pdx-dot " + st[0], title: st[1], "aria-label": st[1] }));
        })),
        h("div", { className: "pdx-legend" },
          h("span", null, h("i", { className: "pdx-dot ok" }), "No ar e completo"),
          h("span", null, h("i", { className: "pdx-dot warn" }), "No ar, mas falta algo"),
          h("span", null, h("i", { className: "pdx-dot off" }), "Escondido"),
          h("span", null, "A ordem daqui é a ordem na vitrine. Arraste pela alça ⠿.")));
    },

    renderEditor: function (items) {
      var self = this, props = this.props, i = this.state.sel, p = items[i];
      if (!p) return h("main", { className: "pdx-col pdx-edit" }, h("p", { className: "pds-hint" }, "Nenhum produto. Toque em “+ Novo”."));
      var st = status(p), cs = checks(p), done = cs.filter(function (c) { return c[2]; }).length, pct = done / cs.length, C = 2 * Math.PI * 19;
      var d = discount(p), badOld = p.priceOld != null && Number(p.priceOld) <= Number(p.price);
      var slugTaken = p.slug && items.some(function (o, j) { return j !== i && o.slug === p.slug; });
      var others = items.filter(function (o, j) { return j !== i && o.slug; });
      var inC = p.bundleWith.map(function (s) { return others.filter(function (o) { return o.slug === s; })[0]; }).filter(Boolean);
      var outC = others.filter(function (o) { return p.bundleWith.indexOf(o.slug) === -1; });
      var combo = bundlePrice([p].concat(inC));
      var chip = function (o) {
        var t = K.assetUrl(props, o.image);
        return h("div", { key: o.slug, className: "pdx-chip" }, h("i", { style: t ? { backgroundImage: "url(" + JSON.stringify(t) + ")" } : null }),
          h("span", null, o.title, h("small", null, eur(o.price) + (o.active ? "" : " · escondido"))));
      };
      var cover = K.assetUrl(props, p.image);
      var stripeOk = STRIPE_RE.test(p.stripeLink || "");
      var list = function (key, arr, render, addLabel, blank, labelMoved) {
        return [
          h(K.SortableList, { key: key, className: "pdx-plist", handle: ".pds-grip",
            onSort: function (e) { self.change(function (items2) { items2[i][key] = K.moveIn(items2[i][key], e.oldIndex, e.newIndex); }, labelMoved(e), true); }
          }, arr.map(render)),
          h("button", { key: key + "-add", type: "button", className: "pds-btn sm", style: { alignSelf: "flex-start" }, onClick: function () {
            self.change(function (items2) { items2[i][key].push(blank()); });
          } }, addLabel)
        ];
      };

      return h("main", { className: "pdx-col pdx-edit" },
        h("div", { className: "pdx-head" },
          h("h1", null, p.title || "Produto novo"),
          h("span", { className: "pds-pill " + (st[0] === "ok" ? "on" : st[0]) }, st[1]),
          h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(!!p.active), "aria-label": "Mostrar na vitrine",
            onClick: function () { self.set("active", !p.active, p.active ? "“" + (p.title || "Produto") + "” escondido da vitrine" : "“" + (p.title || "Produto") + "” ligado na vitrine"); } })),

        h("div", { className: "pdx-ready" },
          h("div", { className: "pdx-ready-h" },
            h("svg", { className: "pdx-ring", viewBox: "0 0 44 44", "aria-hidden": "true" },
              h("circle", { className: "bg", cx: 22, cy: 22, r: 19 }),
              h("circle", { className: "fg", cx: 22, cy: 22, r: 19, strokeDasharray: C, strokeDashoffset: C * (1 - pct) })),
            h("div", null,
              h("b", null, done === cs.length ? "Página completa" : "Página " + Math.round(pct * 100) + "% pronta"),
              h("span", null, done === cs.length ? "Tudo o que a vitrine mostra está preenchido." : "Toque num item pra ir direto nele."))),
          done < cs.length ? h("div", { className: "pdx-todo" }, cs.filter(function (c) { return !c[2]; }).map(function (c) {
            return h("button", { key: c[1], type: "button", onClick: function () { self.openSection(c[0], true); } }, c[1]);
          })) : null),

        this.section("vitrine", "▭", "Card da vitrine", (p.kicker || "sem categoria") + " · " + (p.image ? "com capa" : "sem capa"), "Aparece em /produtos-digitais/", [
          h("div", { key: "g", style: { display: "flex", gap: "12px", alignItems: "flex-start" } },
            h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" } },
              this.input("title", "Título", p, { ph: "Nome do produto", err: !p.title, msg: !p.title ? "⚠ Dê um nome ao produto." : null, msgKind: "err" }),
              this.input("kicker", "Categoria curta", p, { ph: "Ex.: Template Google Sheets" })),
            h("div", { className: "pds-field" }, h("span", { className: "pds-label" }, "Capa 4:3"),
              h("button", { type: "button", className: "pds-img pdx-cover" + (cover ? " has" : ""), style: cover ? { backgroundImage: "url(" + JSON.stringify(cover) + ")" } : null,
                onClick: function () { K.Media.open(self, "cover:" + i, p.image); } }, cover ? "" : "Escolher imagem · 1200×900"))),
          this.input("summary", "Resumo (card e topo da página)", p, { area: true, rows: 2, max: 140,
            msg: (p.summary || "").length > 140 ? "Resumo longo: no card, textos curtos são lidos inteiros." : null, msgKind: "warn" })
        ]),

        this.section("topo", "≡", "Topo da página", "Os 3 primeiros itens de “O que inclui” aparecem no topo", "Topo de /produtos-digitais/produto/", [
          this.input("description", "Descrição (“Sobre o produto”)", p, { area: true, rows: 5 }),
          h("span", { key: "l", className: "pds-label" }, "O que inclui · arraste pra escolher os 3 do topo")
        ].concat(list("features", p.features, function (f, fi) {
          return h("div", { key: fi, className: "pdx-li" + (fi < 3 ? " is-top" : "") },
            h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar item" }, "⠿"),
            h("input", { className: "pds-input bare", value: f, "aria-label": "Item " + (fi + 1), placeholder: "O que a pessoa recebe",
              onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].features[fi] = v; }); } }),
            fi < 3 ? h("span", { className: "tag" }, "No topo") : null,
            h("button", { type: "button", className: "pds-x", "aria-label": "Tirar item", onClick: function () { self.change(function (it) { it[i].features.splice(fi, 1); }, "Item tirado", true); } }, "×"));
        }, "+ Item", function () { return ""; }, function (e) { return e.newIndex < 3 ? "Item foi pro topo da página" : "Nova ordem de “O que inclui”"; }))),

        this.section("preco", "€", "Preço, selo e cupom", eur(p.price) + (d ? " · −" + d + "%" : "") + (p.launchNote ? " · com selo" : "") + (p.coupon && p.coupon.code && p.coupon.enabled !== false ? " · cupom " + p.coupon.code : ""), "Preço, selo e botão de compra", [
          h("div", { key: "g", className: "pds-grid3" },
            this.numInput("price", "Preço atual (€)", p, { err: !(p.price > 0), msg: !(p.price > 0) ? "⚠ Coloque um preço maior que zero." : null, msgKind: "err" }),
            this.numInput("priceOld", "Preço antigo (€)", p, { optional: true, ph: "sem desconto", err: badOld, msg: badOld ? "⚠ Precisa ser maior que o atual pra mostrar desconto." : null, msgKind: "err" }),
            h("div", { className: "pds-field" }, h("span", { className: "pds-label" }, "Desconto"), h("div", { className: "pdx-disc" + (d ? "" : " none") }, d ? "−" + d + "%" : "nenhum"))),
          this.input("launchNote", "Selo de lançamento (opcional)", p, { ph: "Ex.: Preço de lançamento — válido para os primeiros 30 compradores",
            msg: "Use só se for verdade: escassez inventada quebra a confiança.", msgKind: "tip" }),
          this.renderCoupon(p, i),
          h("p", { key: "r", className: "pdx-msg tip" }, "As avaliações aparecem perto do preço quando existem. Aprove as novas em /admin/avaliacoes.")
        ]),

        this.section("galeria", "▣", "Galeria", p.gallery.length + " de " + GALLERY_MAX + " · a 1ª é a principal", "Carrossel da página (e a 2ª foto na vitrine)", [
          h(K.SortableList, { key: "gal", className: "pdx-gal", filter: "input,.rm,.acts",
            onSort: function (e) { self.change(function (it) { it[i].gallery = K.moveIn(it[i].gallery, e.oldIndex, e.newIndex); }, e.newIndex === 0 ? "Nova foto principal" : "Nova ordem da galeria", true); }
          }, p.gallery.map(function (g, gi) {
            var src = g.type === "Vídeo" ? "" : K.assetUrl(props, g.image);
            return h("div", { key: gi, className: "pdx-gi" },
              h("div", { className: "im", style: src ? { backgroundImage: "url(" + JSON.stringify(src) + ")" } : null },
                g.type === "Vídeo" ? h("span", { className: "play" }, "▶") : null,
                h("span", { className: "n" }, String(gi + 1)),
                gi === 0 ? h("span", { className: "role" }, "Principal") : gi === 1 ? h("span", { className: "role" }, "Aparece ao passar o mouse") : null,
                h("button", { type: "button", className: "rm", "aria-label": "Tirar da galeria", onClick: function () { self.change(function (it) { it[i].gallery.splice(gi, 1); }, "Tirado da galeria", true); } }, "×")),
              g.type === "Vídeo"
                ? h("input", { className: "pds-input bare", value: g.videoUrl || "", placeholder: "Link do vídeo", "aria-label": "Link do vídeo",
                    onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].gallery[gi].videoUrl = v; }); } })
                : h("div", { className: "acts" }, h("button", { type: "button", onClick: function () { K.Media.open(self, "gal:" + i + ":" + gi, g.image); } }, "Trocar foto")),
              h("input", { className: "pds-input bare", value: g.caption || "", placeholder: "Legenda", "aria-label": "Legenda",
                onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].gallery[gi].caption = v; }); } }));
          })),
          p.gallery.length < GALLERY_MAX ? h("div", { key: "add", className: "pds-row" },
            h("button", { type: "button", className: "pds-btn sm", onClick: function () { K.Media.open(self, "gal:" + i + ":new", ""); } }, "+ Foto"),
            h("button", { type: "button", className: "pds-btn sm", onClick: function () { self.change(function (it) { it[i].gallery.push({ type: "Vídeo", videoUrl: "", caption: "" }); }); } }, "+ Vídeo (YouTube, Vimeo ou .mp4)"))
            : h("p", { key: "full", className: "pdx-msg tip" }, "Galeria cheia (6). Tire um item pra pôr outro.")
        ]),

        this.section("faq", "?", "Perguntas frequentes", p.faq.length + " perguntas", "FAQ no fim da página", list("faq", p.faq, function (f, qi) {
          return h("div", { key: qi, className: "pdx-li is-faq" },
            h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar pergunta" }, "⠿"),
            h("div", { className: "col" },
              h("input", { className: "pds-input bare", style: { fontWeight: 600 }, value: f.q || "", placeholder: "Pergunta", "aria-label": "Pergunta",
                onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].faq[qi].q = v; }); } }),
              h("textarea", { className: "pds-input bare", rows: 2, value: f.a || "", placeholder: "Resposta", "aria-label": "Resposta",
                onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].faq[qi].a = v; }); } })),
            h("button", { type: "button", className: "pds-x", "aria-label": "Tirar pergunta", onClick: function () { self.change(function (it) { it[i].faq.splice(qi, 1); }, "Pergunta tirada", true); } }, "×"));
        }, "+ Pergunta", function () { return { q: "", a: "" }; }, function () { return "Nova ordem do FAQ"; })),

        this.section("combo", "⧉", "Combo", inC.length ? "Combo de " + (inC.length + 1) + " · " + eur(combo.fin) : "Sem combo", "“Complete o combo” na página", [
          h("div", { key: "z", className: "pdx-combo" },
            h("div", { className: "pdx-zone" }, h("span", { className: "pds-label" }, "No combo"),
              h(K.SortableList, { className: "z", listKey: "in", group: "pdx-combo-" + i, onSort: function (e) { self.onCombo(i, e, inC, outC); } }, inC.map(chip))),
            h("div", { className: "pdx-zone" }, h("span", { className: "pds-label" }, "Outros produtos · arraste pra cá"),
              h(K.SortableList, { className: "z", listKey: "out", group: "pdx-combo-" + i, onSort: function (e) { self.onCombo(i, e, inC, outC); } }, outC.map(chip)))),
          inC.length
            ? h("p", { key: "s", className: "pdx-msg tip" }, "Combo de " + (inC.length + 1) + ": ", h("s", null, eur(combo.sum)), " ", h("b", { style: { color: "#2B2B2B" } }, eur(combo.fin)), " (−" + combo.pct + "%)")
            : h("p", { key: "s", className: "pdx-msg tip" }, "10% com 2 produtos, 15% com 3, 20% com 4 ou mais. Sem combo, a seção não aparece na página.")
        ]),

        this.section("confirmada", "✓", "Depois da compra", p.nextSteps.length ? p.nextSteps.length + " próximos passos" : "Sem próximos passos", "Tela de compra confirmada · campo novo", [
          h("p", { key: "t", className: "pdx-msg tip" }, "O último momento da compra é o que fica na memória. Diga o que fazer primeiro — só o que for verdade pra esse produto.")
        ].concat(list("nextSteps", p.nextSteps, function (s, si) {
          return h("div", { key: si, className: "pdx-li is-faq" },
            h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar passo" }, "⠿"),
            h("div", { className: "col" },
              h("input", { className: "pds-input bare", style: { fontWeight: 600 }, value: s.title || "", placeholder: "Passo " + (si + 1), "aria-label": "Passo " + (si + 1),
                onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].nextSteps[si].title = v; }); } }),
              h("input", { className: "pds-input bare", value: s.text || "", placeholder: "Detalhe (opcional)", "aria-label": "Detalhe",
                onChange: function (e) { var v = e.target.value; self.change(function (it) { it[i].nextSteps[si].text = v; }); } })),
            h("button", { type: "button", className: "pds-x", "aria-label": "Tirar passo", onClick: function () { self.change(function (it) { it[i].nextSteps.splice(si, 1); }, "Passo tirado", true); } }, "×"));
        }, "+ Passo", function () { return { title: "", text: "" }; }, function () { return "Nova ordem dos passos"; }))),

        this.section("pagamento", "🔒", "Pagamento e endereço", stripeOk ? "Stripe ok" : "Falta o link do Stripe", "Botão “Comprar agora”", [
          h("div", { key: "s", className: "pds-field" },
            h("label", { htmlFor: "pdx-stripe" }, "Link de pagamento do Stripe (Payment Link)"),
            h("input", { id: "pdx-stripe", className: "pds-input" + (p.stripeLink && !stripeOk ? " is-err" : ""), value: p.stripeLink || "", placeholder: "https://buy.stripe.com/…",
              onChange: function (e) { self.set("stripeLink", e.target.value.trim()); } }),
            h("p", { className: "pdx-msg " + (p.stripeLink && !stripeOk ? "err" : stripeOk ? "tip" : "warn") },
              p.stripeLink && !stripeOk ? "⚠ O link precisa começar com https://buy.stripe.com/" : stripeOk ? "✓ Link ok" : "Sem link, o botão avisa que o pagamento ainda não está disponível.")),
          h("div", { key: "g", className: "pds-grid2" },
            this.numInput("guaranteeDays", "Dias de garantia", p, { msg: p.guaranteeDays ? "A página mostra “Garantia " + p.guaranteeDays + " dias”." : "0 = “Compra final”, sem reembolso." }),
            h("div", { className: "pds-field" },
              h("label", { htmlFor: "pdx-slug" }, "Endereço (slug)"),
              h("input", { id: "pdx-slug", className: "pds-input" + (slugTaken ? " is-err" : ""), value: p.slug || "", style: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: "13px" },
                onChange: function (e) { self.freshSlug = null; self.set("slug", K.slugify(e.target.value)); } }),
              h("p", { className: "pdx-msg " + (slugTaken ? "err" : "tip") }, slugTaken ? "⚠ Outro produto já usa esse endereço." : p.slug ? "Mudar o endereço de um produto no ar quebra links antigos." : "Criado a partir do título."))),
          h("div", { key: "del", className: "pds-row" },
            this.state.confirmDelete
              ? [h("span", { key: "t", className: "pdx-msg tip" }, "Excluir “" + (p.title || "produto") + "” de vez?"),
                 h("button", { key: "y", type: "button", className: "pds-btn danger sm", onClick: function () {
                   self.change(function (it) {
                     var gone = it[i].slug;
                     it.splice(i, 1);
                     it.forEach(function (o) { o.bundleWith = (o.bundleWith || []).filter(function (s2) { return s2 !== gone; }); });
                   }, "“" + (p.title || "Produto") + "” excluído", true);
                   self.setState({ sel: 0, confirmDelete: false });
                 } }, "Excluir"),
                 h("button", { key: "n", type: "button", className: "pds-btn ghost sm", onClick: function () { self.setState({ confirmDelete: false }); } }, "Cancelar")]
              : h("button", { type: "button", className: "pds-btn danger sm", onClick: function () { self.setState({ confirmDelete: true }); } }, "Excluir produto…"))
        ])
      );
    },

    onCombo: function (i, e, inC, outC) {
      var lists = { in: inC.map(function (o) { return o.slug; }), out: outC.map(function (o) { return o.slug; }) };
      var s = lists[e.from].splice(e.oldIndex, 1)[0];
      lists[e.to].splice(e.newIndex, 0, s);
      this.change(function (items) { items[i].bundleWith = lists["in"]; }, e.to === "in" && e.from !== "in" ? "Adicionado ao combo" : "Combo atualizado", true);
    },

    renderPreview: function (items) {
      var self = this, p = items[this.state.sel];
      var slug = p && p.slug ? encodeURIComponent(p.slug) : "";
      var url = this.state.view === "lista" || !slug ? "/produtos-digitais/"
        : this.state.view === "confirmada" ? "/produtos-digitais/obrigado/?preview=" + slug
        : "/produtos-digitais/produto/?slug=" + slug;
      var tab = function (k, label) { return h("button", { key: k, type: "button", "aria-pressed": String(self.state.view === k), onClick: function () { self.setState({ view: k }); } }, label); };
      return h("section", { className: "pdx-col pdx-prev", "aria-label": "Prévia" },
        h(K.Preview, {
          ref: function (c) { self.preview = c; },
          url: url, device: this.state.device, version: this.state.version,
          onDevice: function (d) { self.setState({ device: d }); },
          extra: h("div", { className: "pds-tabs" }, tab("lista", "Vitrine"), tab("pagina", "Página"), tab("confirmada", "Compra confirmada"))
        }),
        p && !p.slug ? h("p", { className: "pdx-msg warn", style: { margin: "8px 12px" } }, "Dê um título ao produto pra criar o endereço da página.") : null);
    },

    render: function () {
      var self = this;
      var items = this.items();
      var active = items.filter(function (p) { return p.active; }).length;
      var bar = h("div", { className: "pdx-bar" },
        h("span", null, items.length + " produto(s)"),
        h("span", null, active + " na vitrine"),
        h("button", { type: "button", className: "pds-btn primary", onClick: this.open }, "Abrir estúdio de produtos"));
      if (!this.state.open) return bar;
      var mtab = function (k, label) { return h("button", { key: k, type: "button", "aria-pressed": String(self.state.tab === k), onClick: function () { self.setState({ tab: k }); } }, label); };
      return h("div", null, bar,
        h("div", { className: "pdx", role: "dialog", "aria-modal": "true", "aria-label": "Estúdio de produtos digitais" },
          h("div", { className: "pdx-top" },
            h("div", { className: "pdx-brand" }, h("i", null, "P"), h("div", null, h("b", null, "Produtos digitais"), h("small", null, "As mudanças vão pro site quando você clicar em Publicar no /admin."))),
            h("button", { type: "button", className: "pds-btn ghost sm", onClick: this.undo, disabled: !(this.history && this.history.length), title: "Desfazer a última mudança" }, "↶ Desfazer"),
            h("button", { type: "button", className: "pds-btn primary", onClick: this.close }, "Concluir")),
          h("div", { className: "pdx-mtabs" }, h("div", { className: "pds-tabs" }, mtab("lista", "Produtos"), mtab("editar", "Editar"), mtab("previa", "Ver prévia"))),
          h("div", { className: "pdx-app", "data-tab": this.state.tab },
            this.renderList(items), this.renderEditor(items), this.renderPreview(items)),
          this.state.toast ? h("div", { className: "pdx-toast is-show", role: "status" },
            h("span", null, this.state.toast.text),
            this.state.toast.undo ? h("button", { type: "button", onClick: this.undo }, "Desfazer") : null) : null));
    }
  });

  var ProductStudioPreview = createClass({
    render: function () {
      var items = K.toJS(this.props.value, []);
      return h("div", { style: { fontFamily: K.FONT, fontSize: "13px" } }, items.map(function (p, i) {
        return h("div", { key: i, style: { padding: "6px 0", borderBottom: "1px solid #eee", opacity: p.active ? 1 : 0.5 } },
          h("b", null, p.title), " — " + eur(p.price) + (p.active ? "" : " (escondido)"));
      }));
    }
  });

  CMS.registerWidget("product-studio", ProductStudioControl, ProductStudioPreview);
})();
