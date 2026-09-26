// Estúdios do menu do site — dois widgets, um pra cada arquivo que já existe:
//
//   "menu-studio"        header_config → content/header-config.json
//     Links do menu: arraste pra mudar a ordem (vale pro topo, pro menu do
//     celular e pro rodapé — ver orderLinks em assets/js/header.js), mude o
//     texto e o endereço, ligue/desligue.
//
//   "visibility-studio"  nav_visibility → content/nav-visibility.json
//     Cabeçalho, rodapé e logo por página: a categoria liga/desliga tudo de
//     uma vez; cada página segue a categoria ou tem regra própria. Toque numa
//     página pra ver a prévia dela. Fica no campo "pages"; "categories" usa o
//     widget "studio-part" (ver studio-kit.js), e o estúdio grava nele também.
//
// Os mesmos campos de antes; a página real aparece ao lado como prévia.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[menu-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;

  K.css("pds-menu-style", [
    ".pdm-list{display:flex;flex-direction:column;gap:6px;}",
    ".pdm-row{display:grid;grid-template-columns:24px minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:center;background:#FBFAF7;border:1px solid #E2DCD2;border-radius:11px;padding:6px 10px 6px 3px;}",
    ".pdm-row.off{opacity:.6;}",
    ".pdm-row .pds-input{padding:6px 8px;}",
    ".pdm-row .href{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#6E6862;}",
    ".pdv-matrix{border:1px solid #E2DCD2;border-radius:12px;overflow:hidden;background:#FBFAF7;}",
    ".pdv-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,92px);gap:6px;align-items:center;padding:7px 10px;border-bottom:1px solid #E2DCD2;font-size:13px;}",
    ".pdv-row:last-child{border-bottom:0;}",
    ".pdv-row.head{background:#EFEBE4;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#6E6862;font-weight:600;}",
    ".pdv-row.head span{text-align:center;}",
    ".pdv-row.head span:first-child{text-align:left;}",
    ".pdv-row.cat{background:#F6F3EE;font-weight:600;}",
    ".pdv-row.page{cursor:pointer;}",
    ".pdv-row.page:hover{background:#F6F3EE;}",
    ".pdv-row.sel{box-shadow:inset 3px 0 0 #BB9351;background:#F6F3EE;}",
    ".pdv-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".pdv-name small{font-family:ui-monospace,Menlo,monospace;color:#9A938A;font-weight:400;margin-left:6px;font-size:11px;}",
    ".pdv-cell{display:flex;justify-content:center;}",
    ".pdv-tri{border:0;border-radius:20px;padding:4px 0;font:600 11.5px " + K.FONT + ";width:100%;cursor:pointer;}",
    ".pdv-tri.on{background:#E3EDDA;color:#3F6E2B;}",
    ".pdv-tri.off{background:#F5E1DD;color:#A63A2E;}",
    ".pdv-tri.follow{background:#EFEBE4;color:#6E6862;}",
    "@media (max-width:560px){.pdm-row{grid-template-columns:24px minmax(0,1fr) auto;}.pdm-row .href{grid-column:2/3;}.pdv-row{grid-template-columns:minmax(0,1fr) repeat(3,64px);}}"
  ].join("\n"));

  // ---------------------------------------------------------------- menu ----
  var MENU_PATH = "/content/header-config.json";

  var MenuStudioControl = createClass({
    getInitialState: function () { return { open: false, tab: "edit", device: "desktop", version: 0 }; },
    componentWillUnmount: function () { window.PDPreview.clear(MENU_PATH); K.lockPage(false); },
    links: function () { return K.toJS(this.props.value, {}); },
    push: function (links) { window.PDPreview.set(MENU_PATH, { links: links }); },
    change: function (links) {
      this.props.onChange(links);
      this.push(links);
      this.setState({ version: this.state.version + 1 });
    },
    setKey: function (key, prop, value) {
      var links = this.links();
      links[key] = Object.assign({}, links[key]);
      links[key][prop] = value;
      this.change(links);
    },
    open: function () { this.push(this.links()); K.lockPage(true); this.setState({ open: true, tab: "edit" }); },
    close: function () { K.lockPage(false); this.setState({ open: false }); },

    render: function () {
      var self = this;
      var links = this.links();
      var keys = Object.keys(links);
      var on = keys.filter(function (k) { return links[k] && links[k].enabled !== false; });
      var bar = K.launcher([on.length + " de " + keys.length + " links no menu"], "Abrir estúdio do menu", this.open);
      if (!this.state.open) return bar;
      var edit = [
        h("section", { key: "m", className: "pds-card" },
          h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Links do menu"),
            h("small", null, "Arraste pela alça ⠿ pra mudar a ordem. Vale pro menu do topo, do celular e do rodapé."))),
          h(K.SortableList, {
            className: "pdm-list", handle: ".pds-grip",
            onSort: function (e) {
              var order = K.moveIn(keys, e.oldIndex, e.newIndex), next = {};
              order.forEach(function (k) { next[k] = links[k]; });
              self.change(next);
            }
          }, keys.map(function (k) {
            var l = links[k] || {};
            return h("div", { key: k, className: "pdm-row" + (l.enabled === false ? " off" : "") },
              h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar " + (l.label || k) }, "⠿"),
              h("input", { className: "pds-input", value: l.label || "", "aria-label": "Texto do link", onChange: function (e) { self.setKey(k, "label", e.target.value); } }),
              h("input", { className: "pds-input href", value: l.href || "", "aria-label": "Endereço do link", onChange: function (e) { self.setKey(k, "href", e.target.value.trim()); } }),
              h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(l.enabled !== false), "aria-label": "Mostrar " + (l.label || k) + " no menu",
                onClick: function () { self.setKey(k, "enabled", l.enabled === false); } }));
          })),
          h("p", { className: "pds-hint" }, "Desligue pra esconder uma seção que ainda não lançou, sem apagar nada.")
        ),
        h("p", { key: "v", className: "pds-hint" }, "Pra esconder o menu inteiro em alguma página (ex. uma landing isolada), use “Cabeçalho e rodapé (menu do site)”.")
      ];
      return h("div", null, bar, K.shell(this, { title: "Menu do site", onClose: this.close, url: "/", device: "desktop", version: this.state.version, edit: edit }));
    }
  });

  CMS.registerWidget("menu-studio", MenuStudioControl, createClass({
    render: function () {
      var links = K.toJS(this.props.value, {});
      return h("div", { style: { fontFamily: K.FONT, fontSize: "13px" } }, Object.keys(links).filter(function (k) { return links[k].enabled !== false; }).map(function (k) { return links[k].label; }).join(" · "));
    }
  }));

  // ---------------------------------------------------------- visibilidade ----
  var VIS_PATH = "/content/nav-visibility.json";
  var CATEGORIES = [
    { key: "home", label: "Home" },
    { key: "produtos", label: "Produtos" },
    { key: "blog", label: "Blog" },
    { key: "institucional", label: "Institucional" }
  ];
  // Mesmas páginas de PAGE_REGISTRY em assets/js/header.js.
  var PAGES = [
    { key: "home", cat: "home", label: "Home", url: "/" },
    { key: "produtos-digitais", cat: "produtos", label: "Produtos digitais", url: "/produtos-digitais/" },
    { key: "produtos-digitais-produto", cat: "produtos", label: "Página de um produto", url: "/produtos-digitais/produto/" },
    { key: "produtos-de-estudo", cat: "produtos", label: "Produtos de estudo", url: "/produtos-de-estudo/" },
    { key: "produtos-de-compras", cat: "produtos", label: "Produtos de compras", url: "/produtos-de-compras/" },
    { key: "artigos", cat: "blog", label: "Blog (lista de artigos)", url: "/artigos/" },
    { key: "artigos-post-template", cat: "blog", label: "Modelo de artigo", url: "/artigos/post/" },
    { key: "sobre", cat: "institucional", label: "Sobre", url: "/sobre/" },
    { key: "links", cat: "institucional", label: "Link na bio", url: "/links/" },
    { key: "acesso-vip", cat: "institucional", label: "Acesso VIP (questionário)", url: "/acesso-vip/" },
    { key: "cgv", cat: "institucional", label: "CGV", url: "/cgv/" },
    { key: "confidentialite", cat: "institucional", label: "Confidentialité", url: "/confidentialite/" },
    { key: "mentions-legales", cat: "institucional", label: "Mentions légales", url: "/mentions-legales/" }
  ];
  var FIELDS = [{ key: "header", label: "Cabeçalho" }, { key: "footer", label: "Rodapé" }, { key: "logo", label: "Logo = link" }];
  var CYCLE = ["categoria", "ativado", "desativado"];

  var VisibilityStudioControl = createClass({
    getInitialState: function () { return { open: false, tab: "edit", device: "desktop", version: 0, cats: null, sel: "links" }; },
    componentWillUnmount: function () { window.PDPreview.clear(VIS_PATH); K.lockPage(false); },
    pages: function () { return K.toJS(this.props.value, {}); },
    cats: function () {
      if (this.state.cats) return this.state.cats;
      var p = K.part("categories");
      return (p && p.value) || {};
    },
    push: function (pages, cats) { window.PDPreview.set(VIS_PATH, { categories: cats, pages: pages }); },
    open: function () {
      var p = K.part("categories");
      var cats = (p && p.value) || {};
      this.push(this.pages(), cats);
      K.lockPage(true);
      this.setState({ open: true, tab: "edit", cats: cats });
    },
    close: function () { K.lockPage(false); this.setState({ open: false, cats: null }); },

    setCat: function (cat, field) {
      var cats = JSON.parse(JSON.stringify(this.cats()));
      cats[cat] = Object.assign({ header: true, footer: true, logo: true }, cats[cat]);
      cats[cat][field] = cats[cat][field] === false;
      var p = K.part("categories");
      if (p) p.set(cats);
      this.push(this.pages(), cats);
      this.setState({ cats: cats, version: this.state.version + 1 });
    },
    cyclePage: function (key, field) {
      var pages = this.pages();
      pages[key] = Object.assign({ header: "categoria", footer: "categoria", logo: "categoria" }, pages[key]);
      pages[key][field] = CYCLE[(CYCLE.indexOf(pages[key][field]) + 1) % CYCLE.length];
      this.props.onChange(pages);
      this.push(pages, this.cats());
      this.setState({ sel: key, version: this.state.version + 1 });
    },

    render: function () {
      var self = this;
      var pages = this.pages(), cats = this.cats();
      var custom = Object.keys(pages).filter(function (k) { var p = pages[k] || {}; return p.header !== "categoria" || p.footer !== "categoria" || p.logo !== "categoria"; });
      var bar = K.launcher([custom.length + " página(s) com regra própria"], "Abrir estúdio de cabeçalho e rodapé", this.open);
      if (!this.state.open) return bar;
      var catOn = function (c, f) { return !cats[c] || cats[c][f] !== false; };
      var rows = [h("div", { key: "head", className: "pdv-row head" }, h("span", null, "Página"), FIELDS.map(function (f) { return h("span", { key: f.key }, f.label); }))];
      CATEGORIES.forEach(function (c) {
        rows.push(h("div", { key: "c-" + c.key, className: "pdv-row cat" },
          h("span", { className: "pdv-name" }, c.label, h("small", null, "categoria")),
          FIELDS.map(function (f) {
            return h("span", { key: f.key, className: "pdv-cell" }, h("button", {
              type: "button", className: "pds-switch", role: "switch", "aria-checked": String(catOn(c.key, f.key)),
              "aria-label": f.label + " em " + c.label, onClick: function () { self.setCat(c.key, f.key); }
            }));
          })));
        PAGES.filter(function (p) { return p.cat === c.key; }).forEach(function (pg) {
          var cfg = pages[pg.key] || {};
          rows.push(h("div", {
            key: pg.key, className: "pdv-row page" + (self.state.sel === pg.key ? " sel" : ""),
            onClick: function () { self.setState({ sel: pg.key }); }
          },
            h("span", { className: "pdv-name" }, pg.label, h("small", null, pg.url)),
            FIELDS.map(function (f) {
              var mode = cfg[f.key] || "categoria";
              var eff = mode === "categoria" ? catOn(pg.cat, f.key) : mode === "ativado";
              return h("span", { key: f.key, className: "pdv-cell" }, h("button", {
                type: "button", className: "pdv-tri " + (mode === "categoria" ? "follow" : eff ? "on" : "off"),
                title: "Toque pra alternar: segue a categoria → ligado → desligado",
                "aria-label": f.label + " em " + pg.label + ": " + (mode === "categoria" ? "segue a categoria" : mode),
                onClick: function (e) { e.stopPropagation(); self.cyclePage(pg.key, f.key); }
              }, mode === "categoria" ? (eff ? "Segue · on" : "Segue · off") : (eff ? "Ligado" : "Desligado")));
            })));
        });
      });
      var sel = PAGES.filter(function (p) { return p.key === self.state.sel; })[0] || PAGES[0];
      var edit = [
        h("section", { key: "m", className: "pds-card" },
          h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Cabeçalho, rodapé e logo por página"),
            h("small", null, "A categoria liga ou desliga tudo de uma vez. Cada página segue a categoria ou tem regra própria. Toque numa página pra ver a prévia."))),
          h("div", { className: "pdv-matrix", role: "table" }, rows),
          h("p", { className: "pds-hint" }, "“Cabeçalho” desligado deixa só a logo, sem menu. “Rodapé” desligado tira o bloco Navegação. “Logo = link” desligado mostra a logo sem levar pra Home."),
          h("p", { className: "pds-hint" }, "Cada artigo do blog tem os seus próprios ajustes, na edição do artigo (Blog — artigos).")
        )
      ];
      return h("div", null, bar, K.shell(this, { title: "Cabeçalho e rodapé", onClose: this.close, url: sel.url, device: "desktop", version: this.state.version, edit: edit,
        previewExtra: h("span", { className: "pds-pill off" }, sel.label) }));
    }
  });

  CMS.registerWidget("visibility-studio", VisibilityStudioControl, createClass({ render: function () { return h("span", null, ""); } }));
})();
