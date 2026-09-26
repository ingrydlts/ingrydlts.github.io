// Estúdio de produtos digitais — a lista "Produtos" da coleção
// produtos_digitais (content/produtos-digitais.json), com os MESMOS campos
// de antes, numa tela com arrastar e soltar e a página real do produto ao
// lado, já com as mudanças.
//
//   - Lista: arraste pra mudar a ordem da vitrine, ligue/desligue cada
//     produto, toque em "Editar página" pra abrir o produto.
//   - Produto: card da vitrine, preço (desconto calculado), galeria (até 6,
//     arrastável), descrição, "O que inclui" e FAQ arrastáveis, combo
//     (arraste outros produtos pra dentro) e pagamento/garantia.
//   - Prévia: /produtos-digitais/produto/?slug=... ou /produtos-digitais/,
//     no tamanho de celular, tablet ou computador.
//
// Nada é salvo sozinho: o estúdio só muda o valor do campo, e o arquivo vai
// pro site quando você fecha o estúdio e clica em "Publicar" no /admin,
// como sempre. Usa admin/widgets/studio-kit.js.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[product-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var DATA_PATH = "/content/produtos-digitais.json";
  var GALLERY_MAX = 6;
  var STRIPE_RE = /^https:\/\/buy\.stripe\.com\//;

  K.css("pds-product-style", [
    ".pdp-list{display:flex;flex-direction:column;gap:8px;}",
    ".pdp-row{display:flex;gap:10px;align-items:center;background:#FBFAF7;border:1px solid #E2DCD2;border-radius:12px;padding:8px 12px 8px 4px;}",
    ".pdp-row.off{opacity:.62;}",
    ".pdp-row .th{width:60px;height:45px;border-radius:8px;flex:none;background:#EFEBE4 center/cover no-repeat;}",
    ".pdp-row .info{flex:1;min-width:0;}",
    ".pdp-row .info b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdp-row .info span{font-size:12px;color:#6E6862;}",
    ".pdp-row .info s{color:#9A938A;margin-left:4px;}",
    ".pdp-cover{width:150px;aspect-ratio:4/3;}",
    ".pdp-badge{display:inline-flex;align-items:center;height:38px;padding:0 12px;border-radius:9px;background:#E3EDDA;color:#3F6E2B;font-weight:700;width:max-content;}",
    ".pdp-badge.none{background:#EFEBE4;color:#6E6862;font-weight:500;}",
    ".pdp-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;}",
    ".pdp-gi{display:flex;flex-direction:column;gap:4px;min-width:0;}",
    ".pdp-gi .pds-img{aspect-ratio:4/3;cursor:grab;}",
    ".pdp-gi .n{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.55);color:#fff;font-size:10.5px;font-weight:700;border-radius:20px;padding:0 7px;}",
    ".pdp-gi .play{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:22px;text-shadow:0 1px 6px rgba(0,0,0,.5);background:rgba(43,43,43,.35);}",
    ".pdp-gi .rm{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0;}",
    ".pdp-gi .acts{display:flex;gap:4px;}",
    ".pdp-gi .acts button{flex:1;border:1px solid #E2DCD2;background:#fff;border-radius:6px;font-size:11px;padding:3px 4px;cursor:pointer;color:#6E6862;}",
    ".pdp-plist{display:flex;flex-direction:column;gap:6px;}",
    ".pdp-pl{display:flex;gap:6px;align-items:center;background:#EFEBE4;border-radius:10px;padding:4px 6px 4px 2px;}",
    ".pdp-pl.faq{align-items:flex-start;}",
    ".pdp-pl .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}",
    ".pdp-combo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}",
    ".pdp-zone{border:1.5px dashed #CFC7BA;border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-width:0;}",
    ".pdp-zone .z{display:flex;flex-direction:column;gap:6px;min-height:44px;}",
    ".pdp-chip{display:flex;align-items:center;gap:8px;border:1px solid #E2DCD2;background:#fff;border-radius:10px;padding:6px 10px 6px 6px;font-size:12.5px;font-weight:600;cursor:grab;touch-action:none;}",
    ".pdp-chip i{width:28px;height:21px;border-radius:5px;background:#EFEBE4 center/cover no-repeat;flex:none;}",
    ".pdp-chip small{display:block;font-weight:400;color:#6E6862;font-size:11px;}",
    ".pdp-sum{font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}",
    ".pdp-sum s{color:#9A938A;}",
    ".pdp-summary-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(43,43,43,.14);border-radius:6px;background:#fff;font-size:13px;font-family:" + K.FONT + ";}",
    ".pdp-warn{font-size:12px;color:#8A5F12;background:#F6ECD6;border-radius:8px;padding:6px 10px;}",
    "@media (max-width:560px){.pdp-combo{grid-template-columns:minmax(0,1fr);}.pdp-cover{width:120px;}}"
  ].join("\n"));

  function eur(n) {
    if (n === "" || n == null || isNaN(Number(n))) return "";
    return Number(n).toFixed(2).replace(".", ",") + " €";
  }
  function discount(p) {
    return p.priceOld && Number(p.priceOld) > Number(p.price) ? Math.round((1 - p.price / p.priceOld) * 100) : 0;
  }
  // Mesma regra de computeBundlePrice em produtos-digitais/produto/index.html.
  function bundlePrice(items) {
    var sum = items.reduce(function (a, it) { return a + Number(it.price || 0); }, 0);
    var n = items.length;
    var tier = n >= 4 ? 0.2 : n === 3 ? 0.15 : 0.1;
    var fin = Math.max(sum * (1 - tier), sum * 0.5);
    return { sum: sum, fin: fin, pct: sum > 0 ? Math.round((1 - fin / sum) * 100) : 0 };
  }
  function num(text) {
    var t = String(text).trim().replace(",", ".");
    if (t === "") return null;
    var n = Number(t);
    return isNaN(n) ? undefined : n;
  }
  function newProduct() {
    return {
      active: false, slug: "", title: "Produto novo", kicker: "", summary: "", description: "",
      image: "", gallery: [], price: 0, guaranteeDays: 0, features: [], faq: [], stripeLink: "", bundleWith: []
    };
  }

  var ProductStudioControl = createClass({
    getInitialState: function () {
      return { open: false, sel: null, view: "page", device: "mobile", tab: "edit", version: 0, confirmDelete: false };
    },

    componentDidUpdate: function () {
      var self = this;
      K.Media.collect(this, function (target, path) {
        var parts = target.split(":");
        var i = Number(parts[1]);
        self.change(function (items) {
          var p = items[i];
          if (!p) return;
          if (parts[0] === "cover") p.image = path;
          if (parts[0] === "gal") {
            var gi = Number(parts[2]);
            if (p.gallery[gi]) { p.gallery[gi].image = path; p.gallery[gi].type = "Foto"; }
            else if ((p.gallery || []).length < GALLERY_MAX) p.gallery.push({ type: "Foto", image: path, caption: "" });
          }
        });
      });
    },

    componentWillUnmount: function () {
      window.PDPreview.clear(DATA_PATH);
      K.lockPage(false);
    },

    items: function () {
      return K.toJS(this.props.value, []);
    },

    // Toda mudança passa por aqui: copia a lista, aplica, entrega ao Decap e
    // avisa a prévia. Campos opcionais vazios saem do objeto (igual ao Decap).
    change: function (fn) {
      var items = this.items();
      fn(items);
      items.forEach(function (p) {
        if (p.priceOld === null || p.priceOld === "" || p.priceOld === undefined) delete p.priceOld;
        if (p.launchNote === "") delete p.launchNote;
      });
      this.props.onChange(items);
      this.pushPreview(items);
      this.setState({ version: this.state.version + 1 });
    },

    pushPreview: function (items) {
      var props = this.props;
      var resolved = (items || this.items()).map(function (p) {
        var c = JSON.parse(JSON.stringify(p));
        c.image = K.assetUrl(props, c.image);
        (c.gallery || []).forEach(function (g) { g.image = K.assetUrl(props, g.image); });
        return c;
      });
      window.PDPreview.set(DATA_PATH, { items: resolved });
    },

    open: function () {
      this.pushPreview();
      K.lockPage(true);
      this.setState({ open: true, sel: null, tab: "edit", view: "page" });
    },
    close: function () {
      K.lockPage(false);
      this.setState({ open: false, sel: null, confirmDelete: false });
    },

    set: function (i, key, value) {
      this.change(function (items) { items[i][key] = value; });
    },

    // --- lista -------------------------------------------------------------
    renderList: function (items) {
      var self = this;
      var props = this.props;
      return [
        h("div", { key: "head", className: "pds-card-h" },
          h("div", null, h("b", null, "Vitrine de produtos digitais"), h("small", null, "A ordem da lista é a ordem no site. Arraste pela alça ⠿.")),
          h("button", { type: "button", className: "pds-btn sm", onClick: function () {
            self.change(function (list) { list.unshift(newProduct()); });
            self.autoSlugFor = 0;
            self.setState({ sel: 0, view: "page" });
          } }, "+ Produto")
        ),
        items.length ? h(K.SortableList, {
          key: "list", className: "pdp-list", handle: ".pds-grip",
          onSort: function (e) {
            self.autoSlugFor = null;
            self.change(function (list) { var moved = K.moveIn(list, e.oldIndex, e.newIndex); list.length = 0; Array.prototype.push.apply(list, moved); });
          }
        }, items.map(function (p, i) {
          var img = K.assetUrl(props, p.image);
          return h("div", { key: i, className: "pdp-row" + (p.active ? "" : " off") },
            h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar " + (p.title || "produto") }, "⠿"),
            h("span", { className: "th", style: img ? { backgroundImage: "url(" + JSON.stringify(img) + ")" } : null }),
            h("div", { className: "info" },
              h("b", null, p.title || "(sem título)"),
              h("span", null, (p.kicker ? p.kicker + " · " : "") + eur(p.price), p.priceOld ? h("s", null, eur(p.priceOld)) : null,
                p.launchNote ? " · " : null, p.launchNote ? h("span", { className: "pds-pill warn" }, "selo") : null,
                !p.slug ? h("span", { className: "pds-pill warn", style: { marginLeft: "6px" } }, "sem endereço") : null)
            ),
            h("button", { type: "button", className: "pds-btn sm", onClick: function () { if (self.autoSlugFor !== i) self.autoSlugFor = null; self.setState({ sel: i, view: "page", confirmDelete: false }); } }, "Editar página"),
            h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(!!p.active), "aria-label": "Mostrar " + (p.title || "produto") + " na vitrine",
              onClick: function () { self.set(i, "active", !p.active); } })
          );
        })) : h("p", { key: "empty", className: "pds-empty" }, "Nenhum produto ainda. Toque em “+ Produto”."),
        h("p", { key: "hint", className: "pds-hint" }, "Produtos desligados continuam salvos, mas não aparecem na vitrine nem na página.")
      ];
    },

    // --- produto -----------------------------------------------------------
    card: function (key, title, sub, body) {
      return h("section", { key: key, className: "pds-card" },
        h("div", { className: "pds-card-h" }, h("div", null, h("b", null, title), sub ? h("small", null, sub) : null)),
        body);
    },

    field: function (i, p, key, label, opts) {
      var self = this;
      opts = opts || {};
      var id = "pds-" + key + "-" + i;
      var common = {
        id: id, className: "pds-input", value: p[key] == null ? "" : p[key], placeholder: opts.placeholder || "",
        onChange: function (e) {
          var v = e.target.value;
          // O endereço acompanha o título só em produto novo (criado agora,
          // ou ainda sem slug) — num produto no ar, mudar o slug quebra links.
          var fresh = !p.slug || (self.autoSlugFor === i && p.slug === K.slugify(p.title));
          if (key === "title" && opts.autoSlug && fresh) {
            self.change(function (items) { items[i].title = v; items[i].slug = K.slugify(v); });
          } else self.set(i, key, v);
        }
      };
      return h("div", { className: "pds-field", key: key },
        h("label", { htmlFor: id }, label),
        opts.multiline ? h("textarea", Object.assign({ rows: opts.rows || 3 }, common)) : h("input", common));
    },

    numField: function (i, p, key, label, opts) {
      var self = this;
      opts = opts || {};
      var id = "pds-" + key + "-" + i;
      var shown = this.state["draft_" + key + i];
      return h("div", { className: "pds-field", key: key },
        h("label", { htmlFor: id }, label),
        h("input", {
          id: id, className: "pds-input", inputMode: "decimal", placeholder: opts.placeholder || "",
          value: shown !== undefined ? shown : (p[key] == null ? "" : String(p[key]).replace(".", ",")),
          onChange: function (e) {
            var raw = e.target.value, n = num(raw), st = {};
            st["draft_" + key + i] = raw;
            self.setState(st);
            if (n === undefined) return;
            if (n === null) self.set(i, key, opts.optional ? null : 0);
            else self.set(i, key, n);
          },
          onBlur: function () { var st = {}; st["draft_" + key + i] = undefined; self.setState(st); }
        }));
    },

    renderProduct: function (items, i) {
      var self = this, props = this.props;
      var p = items[i];
      p.gallery = p.gallery || []; p.features = p.features || []; p.faq = p.faq || []; p.bundleWith = p.bundleWith || [];
      var cover = K.assetUrl(props, p.image);
      var pct = discount(p);
      var slugTaken = p.slug && items.some(function (o, j) { return j !== i && o.slug === p.slug; });
      var others = items.filter(function (o, j) { return j !== i && o.slug; });
      var inCombo = p.bundleWith.map(function (s) { return others.filter(function (o) { return o.slug === s; })[0]; }).filter(Boolean);
      var outCombo = others.filter(function (o) { return p.bundleWith.indexOf(o.slug) === -1; });
      var combo = bundlePrice([p].concat(inCombo));
      var chip = function (o) {
        var t = K.assetUrl(props, o.image);
        return h("div", { key: o.slug, className: "pdp-chip" },
          h("i", { style: t ? { backgroundImage: "url(" + JSON.stringify(t) + ")" } : null }),
          h("span", null, o.title, h("small", null, eur(o.price) + (o.active ? "" : " · escondido"))));
      };

      return [
        h("div", { key: "nav", className: "pds-row", style: { justifyContent: "space-between" } },
          h("button", { type: "button", className: "pds-btn ghost sm", style: { paddingLeft: 0 }, onClick: function () { self.setState({ sel: null, confirmDelete: false }); } }, "← Todos os produtos"),
          h("span", { className: "pds-row" },
            h("span", { className: "pds-pill " + (p.active ? "on" : "off") }, p.active ? "Na vitrine" : "Escondido"),
            h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(!!p.active), "aria-label": "Mostrar na vitrine", onClick: function () { self.set(i, "active", !p.active); } }))
        ),

        this.card("vitrine", "Card da vitrine", "Título, categoria curta, resumo e capa 4:3", [
          h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "12px" } },
            h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
              this.field(i, p, "title", "Título", { autoSlug: true }),
              this.field(i, p, "kicker", "Categoria curta", { placeholder: "Ex.: Template Google Sheets" })),
            h("div", { className: "pds-field" },
              h("span", { className: "pds-label" }, "Capa"),
              h("button", { type: "button", className: "pds-img pdp-cover" + (cover ? " has" : ""), style: cover ? { backgroundImage: "url(" + JSON.stringify(cover) + ")" } : null,
                onClick: function () { K.Media.open(self, "cover:" + i, p.image); } }, cover ? "" : "Escolher imagem · 1200×900"))
          ),
          this.field(i, p, "summary", "Resumo (aparece no card)", { multiline: true, rows: 2 })
        ]),

        this.card("preco", "Preço", "O desconto é calculado sozinho", [
          h("div", { key: "g", className: "pds-grid3" },
            this.numField(i, p, "price", "Preço atual (€)"),
            this.numField(i, p, "priceOld", "Preço antigo (€)", { optional: true, placeholder: "sem desconto" }),
            h("div", { className: "pds-field" }, h("span", { className: "pds-label" }, "Desconto"),
              h("span", { className: "pdp-badge" + (pct ? "" : " none") }, pct ? "−" + pct + "%" : "nenhum"))
          ),
          this.field(i, p, "launchNote", "Selo de lançamento (opcional)", { placeholder: "Ex.: Preço de lançamento — válido para os primeiros 30 compradores" })
        ]),

        this.card("galeria", "Galeria da página", p.gallery.length + " de " + GALLERY_MAX + " · arraste pra mudar a ordem · a 1ª é a principal", [
          h(K.SortableList, {
            key: "gal", className: "pdp-gal", filter: "input,button.rm,.acts",
            onSort: function (e) { self.change(function (items) { items[i].gallery = K.moveIn(items[i].gallery, e.oldIndex, e.newIndex); }); }
          }, p.gallery.map(function (g, gi) {
            var src = g.type === "Vídeo" ? "" : K.assetUrl(props, g.image);
            return h("div", { key: gi, className: "pdp-gi" },
              h("div", { className: "pds-img" + (src ? " has" : ""), style: src ? { backgroundImage: "url(" + JSON.stringify(src) + ")" } : null },
                h("span", { className: "n" }, String(gi + 1)),
                g.type === "Vídeo" ? h("span", { className: "play" }, "▶") : (src ? null : "Sem foto"),
                h("button", { type: "button", className: "rm", "aria-label": "Tirar da galeria", onClick: function () {
                  self.change(function (items) { items[i].gallery.splice(gi, 1); });
                } }, "×")
              ),
              g.type === "Vídeo"
                ? h("input", { className: "pds-input bare", value: g.videoUrl || "", placeholder: "Link do vídeo", "aria-label": "Link do vídeo",
                    onChange: function (e) { var v = e.target.value; self.change(function (items) { items[i].gallery[gi].videoUrl = v; }); } })
                : h("div", { className: "acts" }, h("button", { type: "button", onClick: function () { K.Media.open(self, "gal:" + i + ":" + gi, g.image); } }, "Trocar foto")),
              h("input", { className: "pds-input bare", value: g.caption || "", placeholder: "Legenda (opcional)", "aria-label": "Legenda",
                onChange: function (e) { var v = e.target.value; self.change(function (items) { items[i].gallery[gi].caption = v; }); } })
            );
          })),
          p.gallery.length < GALLERY_MAX ? h("div", { key: "add", className: "pds-row" },
            h("button", { type: "button", className: "pds-btn sm", onClick: function () { K.Media.open(self, "gal:" + i + ":new", ""); } }, "+ Foto"),
            h("button", { type: "button", className: "pds-btn sm", onClick: function () {
              self.change(function (items) { items[i].gallery.push({ type: "Vídeo", videoUrl: "", caption: "" }); });
            } }, "+ Vídeo (YouTube, Vimeo ou .mp4)")
          ) : h("p", { key: "full", className: "pds-hint" }, "Galeria cheia. Tire um item pra adicionar outro."),
          !p.gallery.length ? h("p", { key: "none", className: "pds-hint" }, "Sem galeria, a página do produto usa só a capa.") : null
        ]),

        this.card("desc", "Descrição", "Aparece na página do produto", [
          this.field(i, p, "description", "Texto", { multiline: true, rows: 5 })
        ]),

        this.card("inclui", "O que inclui", p.features.length + " itens · viram a lista com ✓", [
          h(K.SortableList, {
            key: "l", className: "pdp-plist", handle: ".pds-grip",
            onSort: function (e) { self.change(function (items) { items[i].features = K.moveIn(items[i].features, e.oldIndex, e.newIndex); }); }
          }, p.features.map(function (f, fi) {
            return h("div", { key: fi, className: "pdp-pl" },
              h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar item" }, "⠿"),
              h("input", { className: "pds-input bare", value: f, "aria-label": "Item " + (fi + 1),
                onChange: function (e) { var v = e.target.value; self.change(function (items) { items[i].features[fi] = v; }); } }),
              h("button", { type: "button", className: "pds-x", "aria-label": "Tirar item", onClick: function () { self.change(function (items) { items[i].features.splice(fi, 1); }); } }, "×"));
          })),
          h("button", { key: "add", type: "button", className: "pds-btn sm", style: { alignSelf: "flex-start" }, onClick: function () {
            self.change(function (items) { items[i].features.push(""); });
          } }, "+ Item")
        ]),

        this.card("faq", "Perguntas frequentes", p.faq.length + " perguntas", [
          h(K.SortableList, {
            key: "l", className: "pdp-plist", handle: ".pds-grip",
            onSort: function (e) { self.change(function (items) { items[i].faq = K.moveIn(items[i].faq, e.oldIndex, e.newIndex); }); }
          }, p.faq.map(function (f, qi) {
            return h("div", { key: qi, className: "pdp-pl faq" },
              h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar pergunta" }, "⠿"),
              h("div", { className: "col" },
                h("input", { className: "pds-input bare", style: { fontWeight: 600 }, value: f.q || "", placeholder: "Pergunta", "aria-label": "Pergunta",
                  onChange: function (e) { var v = e.target.value; self.change(function (items) { items[i].faq[qi].q = v; }); } }),
                h("textarea", { className: "pds-input bare", rows: 2, value: f.a || "", placeholder: "Resposta", "aria-label": "Resposta",
                  onChange: function (e) { var v = e.target.value; self.change(function (items) { items[i].faq[qi].a = v; }); } })),
              h("button", { type: "button", className: "pds-x", "aria-label": "Tirar pergunta", onClick: function () { self.change(function (items) { items[i].faq.splice(qi, 1); }); } }, "×"));
          })),
          h("button", { key: "add", type: "button", className: "pds-btn sm", style: { alignSelf: "flex-start" }, onClick: function () {
            self.change(function (items) { items[i].faq.push({ q: "", a: "" }); });
          } }, "+ Pergunta")
        ]),

        this.card("combo", "Combo com outros produtos", "Arraste produtos entre as caixas · 10% com 2, 15% com 3, 20% com 4 ou mais", [
          h("div", { key: "z", className: "pdp-combo" },
            h("div", { className: "pdp-zone" }, h("span", { className: "pds-label" }, "No combo"),
              h(K.SortableList, { className: "z", listKey: "in", group: "pds-combo-" + i, onSort: function (e) { self.onComboSort(i, e, inCombo, outCombo); } },
                inCombo.map(chip))),
            h("div", { className: "pdp-zone" }, h("span", { className: "pds-label" }, "Outros produtos"),
              h(K.SortableList, { className: "z", listKey: "out", group: "pds-combo-" + i, onSort: function (e) { self.onComboSort(i, e, inCombo, outCombo); } },
                outCombo.map(chip)))
          ),
          inCombo.length
            ? h("div", { key: "s", className: "pdp-sum" }, "Combo de " + (inCombo.length + 1) + ": ", h("s", null, eur(combo.sum)), h("b", null, eur(combo.fin)), h("span", { className: "pds-pill on" }, "−" + combo.pct + "%"))
            : h("p", { key: "s", className: "pds-hint" }, "Sem combo. A página mostra o aviso de combo vazio.")
        ]),

        this.card("pag", "Pagamento e garantia", "", [
          h("div", { key: "s", className: "pds-field" },
            h("label", { htmlFor: "pds-stripe-" + i }, "Link de pagamento do Stripe (Payment Link)"),
            h("div", { className: "pds-row", style: { flexWrap: "nowrap" } },
              h("input", { id: "pds-stripe-" + i, className: "pds-input", value: p.stripeLink || "", placeholder: "https://buy.stripe.com/…",
                onChange: function (e) { self.set(i, "stripeLink", e.target.value.trim()); } }),
              h("span", { className: "pds-pill " + (STRIPE_RE.test(p.stripeLink || "") ? "on" : "warn") }, STRIPE_RE.test(p.stripeLink || "") ? "Link ok" : "Falta o link"))
          ),
          h("div", { key: "g", className: "pds-row", style: { alignItems: "flex-end" } },
            h("div", { style: { width: "150px" } }, this.numField(i, p, "guaranteeDays", "Dias de garantia")),
            h("p", { className: "pds-hint", style: { paddingBottom: "10px" } }, p.guaranteeDays ? "A página mostra “Garantia " + p.guaranteeDays + " dias”." : "0 = “Compra final”, sem reembolso."))
        ]),

        this.card("adv", "Endereço da página", "Criado a partir do título enquanto o produto é novo", [
          h("div", { key: "f", className: "pds-field" },
            h("label", { htmlFor: "pds-slug-" + i }, "Slug (parte do endereço, sem espaço nem acento)"),
            h("input", { id: "pds-slug-" + i, className: "pds-input", value: p.slug || "", style: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: "13px" },
              onChange: function (e) { self.set(i, "slug", K.slugify(e.target.value)); } })),
          h("p", { key: "u", className: "pds-hint" }, "/produtos-digitais/produto/?slug=" + (p.slug || "…")),
          slugTaken ? h("p", { key: "dup", className: "pdp-warn" }, "Outro produto já usa esse endereço. Escolha outro.") : null,
          p.slug ? h("p", { key: "w", className: "pds-hint" }, "Mudar o slug de um produto que já está no ar quebra os links antigos (bio, anúncios, e-mails).") : null
        ]),

        h("div", { key: "del", className: "pds-row" },
          this.state.confirmDelete
            ? [h("span", { key: "t", className: "pds-hint" }, "Excluir “" + (p.title || "produto") + "” de vez?"),
               h("button", { key: "y", type: "button", className: "pds-btn danger sm", onClick: function () {
                 self.change(function (items) {
                   var gone = items[i].slug;
                   items.splice(i, 1);
                   items.forEach(function (o) { o.bundleWith = (o.bundleWith || []).filter(function (s) { return s !== gone; }); });
                 });
                 self.setState({ sel: null, confirmDelete: false });
               } }, "Excluir"),
               h("button", { key: "n", type: "button", className: "pds-btn ghost sm", onClick: function () { self.setState({ confirmDelete: false }); } }, "Cancelar")]
            : h("button", { type: "button", className: "pds-btn danger sm", onClick: function () { self.setState({ confirmDelete: true }); } }, "Excluir produto…")
        )
      ];
    },

    onComboSort: function (i, e, inCombo, outCombo) {
      var lists = { in: inCombo.map(function (o) { return o.slug; }), out: outCombo.map(function (o) { return o.slug; }) };
      var slug = lists[e.from].splice(e.oldIndex, 1)[0];
      lists[e.to].splice(e.newIndex, 0, slug);
      this.change(function (items) { items[i].bundleWith = lists["in"]; });
    },

    render: function () {
      var self = this;
      var items = this.items();
      var active = items.filter(function (p) { return p.active; }).length;
      var bar = h("div", { className: "pdp-summary-bar" },
        h("span", null, items.length + " produto(s)"),
        h("span", null, active + " na vitrine"),
        h("button", { type: "button", className: "pds-btn primary", onClick: this.open }, "Abrir estúdio de produtos"));
      if (!this.state.open) return bar;

      var sel = this.state.sel != null && items[this.state.sel] ? this.state.sel : null;
      var p = sel != null ? items[sel] : null;
      var url = p && this.state.view === "page" && p.slug
        ? "/produtos-digitais/produto/?slug=" + encodeURIComponent(p.slug)
        : "/produtos-digitais/";

      return h("div", null, bar,
        h("div", { className: "pds-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Estúdio de produtos digitais" },
          h("div", { className: "pds-top" },
            h("h2", null, p ? (p.title || "Produto") : "Produtos digitais"),
            h("small", null, "As mudanças vão pro site quando você clicar em Publicar no /admin."),
            h("button", { type: "button", className: "pds-btn primary", onClick: this.close }, "Concluir")
          ),
          h("div", { className: "pds-mobile-tabs" },
            h("div", { className: "pds-tabs" },
              h("button", { type: "button", "aria-pressed": String(this.state.tab === "edit"), onClick: function () { self.setState({ tab: "edit" }); } }, "Editar"),
              h("button", { type: "button", "aria-pressed": String(this.state.tab === "preview"), onClick: function () { self.setState({ tab: "preview" }); } }, "Ver prévia"))),
          h("div", { className: "pds-body", "data-tab": this.state.tab },
            h("div", { className: "pds-edit" }, p ? this.renderProduct(items, sel) : this.renderList(items)),
            h("div", { className: "pds-side" },
              h(K.Preview, {
                url: url, device: this.state.device, version: this.state.version,
                onDevice: function (d) { self.setState({ device: d }); },
                extra: p ? h("div", { className: "pds-tabs" },
                  h("button", { type: "button", "aria-pressed": String(self.state.view === "page"), onClick: function () { self.setState({ view: "page" }); } }, "Página"),
                  h("button", { type: "button", "aria-pressed": String(self.state.view === "card"), onClick: function () { self.setState({ view: "card" }); } }, "Vitrine")) : null
              }),
              p && !p.slug && this.state.view === "page" ? h("p", { className: "pdp-warn", style: { margin: "8px 12px" } }, "Dê um título ao produto pra criar o endereço da página.") : null
            )
          )
        )
      );
    }
  });

  var ProductStudioPreview = createClass({
    render: function () {
      var items = K.toJS(this.props.value, []);
      return h("div", { style: { fontFamily: K.FONT, fontSize: "13px" } },
        items.map(function (p, i) {
          return h("div", { key: i, style: { padding: "6px 0", borderBottom: "1px solid #eee", opacity: p.active ? 1 : 0.5 } },
            h("b", null, p.title), " — " + eur(p.price) + (p.active ? "" : " (escondido)"));
        }));
    }
  });

  CMS.registerWidget("product-studio", ProductStudioControl, ProductStudioPreview);
})();
