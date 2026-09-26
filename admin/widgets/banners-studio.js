// Banners e destaques — content/banners.json numa tela só: a foto do topo
// da página inicial, o banner "vitrine → blog" de cada página de produtos e
// o banner lateral do blog. Cada cartão mostra a página certa na prévia e
// rola até o banner que você está mexendo.
//
// Grava os mesmos campos de sempre:
//   home{heroImage, heroImageDesktop, heroImageAlt}
//   categoryBanners{produtos-digitais|produtos-de-estudo|produtos-de-compras:
//     {enabled, kicker, title, image, color, ctaText, postSlug}}
//   blogSidebar{kicker, title, body, image, color, ctaText, ctaHref}
// O widget fica no campo "home"; categoryBanners e blogSidebar usam
// "studio-part" (ver studio-kit.js).
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[banners-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var DATA_PATH = "/content/banners.json";

  var CATS = [
    { k: "produtos-digitais", label: "Produtos digitais", url: "/produtos-digitais/" },
    { k: "produtos-de-estudo", label: "Produtos de estudo", url: "/produtos-de-estudo/" },
    { k: "produtos-de-compras", label: "Produtos de compras", url: "/produtos-de-compras/" }
  ];
  var LINKS = [
    ["/produtos-digitais/", "Produtos digitais"], ["/produtos-de-estudo/", "Produtos de estudo"],
    ["/produtos-de-compras/", "Produtos de compras"], ["/artigos/", "Blog"], ["/sobre/", "Sobre"]
  ];

  K.css("pds-banners-style", [
    ".pdn-sec{flex-shrink:0;background:#fff;border:1px solid #E2DCD2;border-radius:14px;overflow:hidden;}",
    ".pdn-sec.is-open{border-color:#CFC7BA;box-shadow:0 10px 26px -18px rgba(43,35,25,.4);}",
    ".pdn-h{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;background:none;text-align:left;cursor:pointer;font:inherit;color:inherit;}",
    ".pdn-h .th{width:54px;height:36px;border-radius:8px;background:#EFEBE4 center/cover no-repeat;flex:none;border-left:4px solid transparent;}",
    ".pdn-h .tt{flex:1;min-width:0;}",
    ".pdn-h .tt b{display:block;font-size:14px;}",
    ".pdn-h .tt small{display:block;color:#6E6862;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdn-h .chev{color:#9A938A;transition:transform .2s;}",
    ".pdn-sec.is-open .chev{transform:rotate(180deg);}",
    ".pdn-in{padding:4px 14px 16px;display:flex;flex-direction:column;gap:12px;}",
    ".pdn-where{align-self:flex-start;font-size:11.5px;font-weight:600;color:#604034;background:#F3E9E4;border-radius:20px;padding:2px 9px;}",
    ".pdn-imgs{display:grid;grid-template-columns:minmax(0,.62fr) minmax(0,1fr);gap:10px;align-items:start;}",
    ".pdn-warn{font-size:12px;color:#8A5F12;background:#F6ECD6;border-radius:10px;padding:8px 10px;margin:0;}",
    ".pdn-ok{font-size:12px;color:#3F6E2B;margin:0;}",
    ".pdn-row-x{display:flex;gap:8px;align-items:flex-end;}",
    ".pdn-row-x .pds-img{flex:1;max-width:340px;}"
  ].join("\n"));

  var BannersStudio = createClass({
    getInitialState: function () {
      return { open: false, tab: "edit", device: "mobile", version: 0, sec: "home", posts: [] };
    },
    data: function () {
      var cb = K.part("categoryBanners"), bs = K.part("blogSidebar");
      return {
        home: K.toJS(this.props.value, {}) || {},
        categoryBanners: (cb && cb.value) || {},
        blogSidebar: (bs && bs.value) || {}
      };
    },
    update: function (fn) {
      var d = this.data();
      fn(d);
      var cb = K.part("categoryBanners"), bs = K.part("blogSidebar");
      if (cb) cb.set(d.categoryBanners);
      if (bs) bs.set(d.blogSidebar);
      this.props.onChange(d.home);
      window.PDPreview.set(DATA_PATH, d);
      this.setState({ version: this.state.version + 1 });
    },
    open: function () {
      var self = this;
      window.PDPreview.set(DATA_PATH, this.data());
      K.lockPage(true);
      this.setState({ open: true, tab: "edit" });
      var v = window.PDPreview.get("/content/posts.json");
      (v !== undefined ? Promise.resolve(v) : fetch("/content/posts.json", { cache: "no-store" }).then(function (r) { return r.json(); }))
        .then(function (d) { self.setState({ posts: d.items || [] }); }).catch(function () {});
    },
    close: function () { K.lockPage(false); this.setState({ open: false }); },
    // Os campos irmãos (studio-part) montam depois deste — redesenha o resumo.
    componentDidMount: function () { var self = this; setTimeout(function () { self.forceUpdate(); }, 0); },
    componentWillUnmount: function () { K.lockPage(false); },
    componentDidUpdate: function () {
      var self = this;
      K.Media.collect(this, function (target, path) {
        var t = String(target).split(":");
        self.update(function (d) {
          if (t[0] === "home") d.home[t[1]] = path;
          else if (t[0] === "cat") d.categoryBanners[t[1]].image = path;
          else if (t[0] === "side") d.blogSidebar.image = path;
        });
      });
    },

    // Abrir um cartão troca a página da prévia e rola até o banner.
    openSec: function (key) {
      var self = this;
      var dev = key === "side" ? "desktop" : key === "home" ? this.state.device : this.state.device;
      this.setState({ sec: key, device: dev });
      var sel = key === "home" ? "#hero-image" : key === "side" ? "#sidebar-banner" : "#category-banner";
      setTimeout(function () { if (self.preview) self.preview.focus(sel); }, 60);
    },
    url: function () {
      var s = this.state.sec;
      if (s === "home") return "/";
      if (s === "side") return "/artigos/";
      var c = CATS.filter(function (x) { return "cat-" + x.k === s; })[0];
      return c ? c.url : "/";
    },

    input: function (label, value, onChange, opts) {
      opts = opts || {};
      return h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, label),
        h(opts.area ? "textarea" : "input", { className: "pds-input", value: value || "", rows: 2, placeholder: opts.ph || "", onChange: function (e) { onChange(e.target.value); } }),
        opts.hint ? h("span", { className: "pds-hint" }, opts.hint) : null);
    },
    image: function (target, value, label, ratio) {
      var self = this, url = K.assetUrl(this.props, value);
      return h("div", { className: "pds-field" },
        h("span", { className: "pds-label" }, label),
        h("div", { className: "pdn-row-x" },
          h("div", { className: "pds-img" + (url ? " has" : ""), role: "button", tabIndex: 0, style: { aspectRatio: ratio, backgroundImage: url ? "url(" + JSON.stringify(url) + ")" : null },
            onClick: function () { K.Media.open(self, target, value); },
            onKeyDown: function (e) { if (e.key === "Enter") K.Media.open(self, target, value); } }, url ? null : "Escolher foto"),
          url ? h("button", { type: "button", className: "pds-x", "aria-label": "Tirar foto", onClick: function () {
            var t = target.split(":");
            self.update(function (d) {
              if (t[0] === "home") d.home[t[1]] = "";
              else if (t[0] === "cat") d.categoryBanners[t[1]].image = "";
              else d.blogSidebar.image = "";
            });
          } }, "×") : null));
    },
    section: function (key, title, summary, thumb, color, where, body) {
      var self = this, open = this.state.sec === key;
      return h("section", { key: key, className: "pdn-sec" + (open ? " is-open" : "") },
        h("button", { type: "button", className: "pdn-h", "aria-expanded": String(open), onClick: function () { self.openSec(key); } },
          h("span", { className: "th", style: { backgroundImage: thumb ? "url(" + JSON.stringify(K.assetUrl(self.props, thumb)) + ")" : null, borderLeftColor: color || "transparent" } }),
          h("span", { className: "tt" }, h("b", null, title), h("small", null, summary)),
          h("span", { className: "chev", "aria-hidden": "true" }, "⌄")),
        open ? h("div", { className: "pdn-in" }, h("span", { className: "pdn-where" }, "↗ " + where), body) : null);
    },

    renderHome: function (d) {
      var self = this, H = d.home;
      var set = function (k) { return function (v) { self.update(function (x) { x.home[k] = v; }); }; };
      return this.section("home", "Foto do topo da página inicial", H.heroImage ? (H.heroImageDesktop ? "celular e computador" : "só a do celular (vale pros dois)") : "sem foto", H.heroImageDesktop || H.heroImage, null, "Página inicial, logo no topo", [
        h("div", { key: "imgs", className: "pdn-imgs" },
          h("div", { onClick: function () { self.setState({ device: "mobile" }); } }, this.image("home:heroImage", H.heroImage, "Celular · vertical 2:3", "2/3")),
          h("div", { onClick: function () { self.setState({ device: "desktop" }); } }, this.image("home:heroImageDesktop", H.heroImageDesktop, "Computador · horizontal 3:2", "3/2"))),
        !H.heroImageDesktop && H.heroImage ? h("p", { key: "w", className: "pds-hint" }, "Sem a foto de computador, a do celular aparece nas duas telas.") : null,
        h("div", { key: "alt" }, this.input("Descrição da foto (pra leitores de tela e Google)", H.heroImageAlt, set("heroImageAlt"), { ph: "Ex.: Vista da janela do avião chegando em Paris" }))
      ]);
    },

    renderCat: function (d, c) {
      var self = this, B = d.categoryBanners[c.k] || {};
      var set = function (k) { return function (v) { self.update(function (x) { x.categoryBanners[c.k][k] = v; }); }; };
      var posts = this.state.posts;
      var post = posts.filter(function (p) { return p.slug === B.postSlug; })[0];
      var live = post && (post.status === "publicado" || (post.status === "agendado" && post.date && String(post.date).slice(0, 10) <= new Date().toISOString().slice(0, 10)));
      var options = posts.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title), "pt-BR"); });
      var on = B.enabled !== false;
      return this.section("cat-" + c.k, "Banner em " + c.label, on ? (B.title || "sem título") : "desligado", B.image, B.color, "Página " + c.url + " · leva pra um artigo do blog", [
        h("div", { key: "sw", className: "pds-row", style: { justifyContent: "space-between" } },
          h("span", { className: "pds-label" }, on ? "Aparecendo na página" : "Escondido (o conteúdo fica guardado)"),
          h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(on), "aria-label": "Mostrar o banner em " + c.label,
            onClick: function () { self.update(function (x) { x.categoryBanners[c.k].enabled = !on; }); } })),
        h("div", { key: "t", className: "pds-grid2" },
          this.input("Selo (pequeno, em cima)", B.kicker, set("kicker")),
          this.input("Título", B.title, set("title"))),
        h("div", { key: "img" }, this.image("cat:" + c.k, B.image, "Foto · 1200×675, horizontal", "16/9")),
        h("div", { key: "p", className: "pds-grid2" },
          h("label", { className: "pds-field" }, h("span", { className: "pds-label" }, "Artigo que o botão abre"),
            h("select", { className: "pds-input", value: B.postSlug || "", onChange: function (e) { set("postSlug")(e.target.value); } },
              h("option", { value: "" }, "— escolha um artigo —"),
              post ? null : (B.postSlug ? h("option", { value: B.postSlug }, B.postSlug + " (não existe)") : null),
              options.map(function (p) { return h("option", { key: p.slug, value: p.slug }, (p.status === "publicado" ? "" : "◌ ") + p.title.slice(0, 60)); }))),
          this.input("Texto do botão", B.ctaText, set("ctaText"), { ph: "Ler no blog →" })),
        !B.postSlug || !post ? h("p", { key: "w", className: "pdn-warn" }, (B.postSlug ? "O artigo “" + B.postSlug + "” não existe" : "Nenhum artigo escolhido") + " — o botão leva pra lista do blog (/artigos/).")
          : !live ? h("p", { key: "w", className: "pdn-warn" }, "Esse artigo ainda não está no ar — até ele entrar, o botão leva pra lista do blog.")
          : h("p", { key: "ok", className: "pdn-ok" }, "✓ Leva pra “" + post.title + "”."),
        h("div", { key: "c" }, K.colorField("Cor (selo e botão)", B.color, set("color")))
      ]);
    },

    renderSide: function (d) {
      var self = this, B = d.blogSidebar;
      var set = function (k) { return function (v) { self.update(function (x) { x.blogSidebar[k] = v; }); }; };
      return this.section("side", "Banner lateral do blog", B.title || "sem título", B.image, B.color, "Blog (/artigos/): na lateral no computador, entre os artigos no celular", [
        h("div", { key: "t", className: "pds-grid2" },
          this.input("Selo (pequeno, em cima)", B.kicker, set("kicker")),
          this.input("Título", B.title, set("title"))),
        h("div", { key: "b" }, this.input("Texto", B.body, set("body"), { area: true })),
        h("div", { key: "img" }, this.image("side:img", B.image, "Foto · 1200×900, horizontal", "4/3")),
        h("div", { key: "l", className: "pds-grid2" },
          this.input("Texto do botão", B.ctaText, set("ctaText"), { ph: "Ver produtos →" }),
          this.input("Link do botão", B.ctaHref, set("ctaHref"), { ph: "/produtos-digitais/" })),
        h("div", { key: "q", className: "pds-row", style: { gap: "6px" } },
          h("span", { className: "pds-label" }, "Atalhos:"),
          LINKS.map(function (l) { return h("button", { key: l[0], type: "button", className: "pds-btn sm", "aria-pressed": String(B.ctaHref === l[0]), onClick: function () { set("ctaHref")(l[0]); } }, l[1]); })),
        h("div", { key: "c" }, K.colorField("Cor (selo, borda e botão)", B.color, set("color")))
      ]);
    },

    render: function () {
      var self = this;
      var d = this.data();
      var onCats = CATS.filter(function (c) { return (d.categoryBanners[c.k] || {}).enabled !== false; }).length;
      var bar = K.launcher(["Foto da home " + (d.home.heroImage ? "✓" : "—"), onCats + " de 3 banners de categoria ligados"], "Abrir banners e destaques", this.open);
      if (!this.state.open) return bar;
      var edit = [
        h("p", { key: "hint", className: "pds-hint" }, "Toque num banner pra editar — a prévia vai pra página em que ele aparece."),
        this.renderHome(d)
      ].concat(CATS.map(function (c) { return self.renderCat(d, c); })).concat([this.renderSide(d)]);
      return h("div", null, bar,
        h("div", { className: "pds-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Banners e destaques" },
          h("div", { className: "pds-top" },
            h("h2", null, "Banners e destaques"),
            h("small", null, "As mudanças vão pro site quando você clicar em Publicar no /admin."),
            h("button", { type: "button", className: "pds-btn primary", onClick: this.close }, "Concluir")),
          h("div", { className: "pds-mobile-tabs" },
            h("div", { className: "pds-tabs" },
              h("button", { type: "button", "aria-pressed": String(this.state.tab !== "preview"), onClick: function () { self.setState({ tab: "edit" }); } }, "Editar"),
              h("button", { type: "button", "aria-pressed": String(this.state.tab === "preview"), onClick: function () { self.setState({ tab: "preview" }); } }, "Ver prévia"))),
          h("div", { className: "pds-body", "data-tab": this.state.tab === "preview" ? "preview" : "edit" },
            h("div", { className: "pds-edit" }, edit),
            h("div", { className: "pds-side" },
              h(K.Preview, { ref: function (c) { self.preview = c; }, url: this.url(), device: this.state.device, version: this.state.version,
                onDevice: function (dv) { self.setState({ device: dv }); } })))));
    }
  });

  var BannersPreview = createClass({ render: function () { return null; } });
  CMS.registerWidget("banners-studio", BannersStudio, BannersPreview);
})();
