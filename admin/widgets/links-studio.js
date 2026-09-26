// Estúdio da Link na bio — a coleção links_page (content/links.json), com
// os MESMOS campos de antes: topo (hero), card do assistente (bot) e seções
// de links. A página /links/ de verdade aparece ao lado como prévia.
//
//   - Topo: foto (biblioteca de imagens), título, @, bio, Instagram, YouTube.
//   - Card do assistente: título, descrição, link.
//   - Seções: arraste a seção pela alça do título; arraste links entre
//     seções; ligue/desligue cada link; toque no link pra editar detalhes.
//
// Este widget fica no campo "sections"; "hero" e "bot" usam o widget
// "studio-part" (ver studio-kit.js), e o estúdio grava neles também.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[links-studio] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var DATA_PATH = "/content/links.json";

  K.css("pds-links-style", [
    ".pdl-secs{display:flex;flex-direction:column;gap:12px;}",
    ".pdl-sec{background:#EFEBE4;border-radius:14px;padding:8px 10px 10px;display:flex;flex-direction:column;gap:6px;}",
    ".pdl-sec-h{display:flex;align-items:center;gap:6px;}",
    ".pdl-sec-h .pds-input{font-weight:600;}",
    ".pdl-items{display:flex;flex-direction:column;gap:6px;min-height:46px;}",
    ".pdl-item{background:#FBFAF7;border:1px solid #E2DCD2;border-radius:11px;}",
    ".pdl-item.off{opacity:.6;}",
    ".pdl-item-row{display:flex;align-items:center;gap:6px;padding:5px 10px 5px 3px;}",
    ".pdl-emoji{width:40px;text-align:center;font-size:18px;padding:4px 2px!important;}",
    ".pdl-item-row .t{flex:1;min-width:0;cursor:pointer;}",
    ".pdl-item-row .t b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdl-item-row .t small{display:block;font-size:11.5px;color:#6E6862;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdl-more{border-top:1px solid #E2DCD2;padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px;}",
    ".pdl-avatar{width:84px;height:84px;border-radius:50%;flex:none;}",
    ".pdl-top{display:grid;grid-template-columns:84px minmax(0,1fr);gap:14px;align-items:start;}",
    "@media (max-width:560px){.pdl-top{grid-template-columns:minmax(0,1fr);}}"
  ].join("\n"));

  function isExternal(href) { return /^https?:\/\//i.test(href || ""); }
  function newItem() { return { active: true, icon: "✨", title: "", description: "", href: "", trackId: "", external: false }; }

  var LinksStudioControl = createClass({
    getInitialState: function () {
      return { open: false, tab: "edit", device: "mobile", version: 0, hero: null, bot: null, openItem: null, confirmSec: null };
    },
    componentWillUnmount: function () {
      window.PDPreview.clear(DATA_PATH);
      K.lockPage(false);
    },

    sections: function () { return K.toJS(this.props.value, []); },

    // hero e bot: cópia local enquanto o estúdio está aberto, gravada no
    // campo irmão a cada mudança.
    heroBot: function () {
      var hp = K.part("hero"), bp = K.part("bot");
      return {
        hero: this.state.hero || (hp && hp.value) || {},
        bot: this.state.bot || (bp && bp.value) || {}
      };
    },

    push: function (sections, hero, bot) {
      var hp = K.part("hero");
      var heroForPreview = JSON.parse(JSON.stringify(hero || {}));
      if (hp && heroForPreview.avatar) heroForPreview.avatar = K.assetUrl(hp.props, heroForPreview.avatar);
      window.PDPreview.set(DATA_PATH, { hero: heroForPreview, bot: bot || {}, sections: sections });
    },

    change: function (fn) {
      var sections = this.sections();
      fn(sections);
      this.props.onChange(sections);
      var hb = this.heroBot();
      this.push(sections, hb.hero, hb.bot);
      this.setState({ version: this.state.version + 1 });
    },

    setPart: function (name, key, value) {
      var hb = this.heroBot();
      var obj = Object.assign({}, hb[name]);
      obj[key] = value;
      var p = K.part(name);
      if (p) p.set(obj);
      var st = { version: this.state.version + 1 };
      st[name] = obj;
      this.setState(st);
      this.push(this.sections(), name === "hero" ? obj : hb.hero, name === "bot" ? obj : hb.bot);
    },

    open: function () {
      var hp = K.part("hero"), bp = K.part("bot");
      var hero = (hp && hp.value) || {}, bot = (bp && bp.value) || {};
      this.push(this.sections(), hero, bot);
      K.lockPage(true);
      this.setState({ open: true, tab: "edit", hero: hero, bot: bot, openItem: null, confirmSec: null });
    },
    close: function () {
      K.lockPage(false);
      this.setState({ open: false, hero: null, bot: null });
    },

    input: function (label, value, onChange, opts) {
      opts = opts || {};
      var id = "pdl-" + (opts.id || label.replace(/\W+/g, "-").toLowerCase());
      return h("div", { className: "pds-field", key: id },
        h("label", { htmlFor: id }, label),
        h(opts.multiline ? "textarea" : "input", {
          id: id, className: "pds-input", value: value == null ? "" : value, rows: opts.rows,
          placeholder: opts.placeholder || "", onChange: function (e) { onChange(e.target.value); }
        }));
    },

    renderTop: function (hero, bot) {
      var self = this;
      var hp = K.part("hero");
      var avatar = hp ? K.assetUrl(hp.props, hero.avatar) : hero.avatar;
      var setH = function (k) { return function (v) { self.setPart("hero", k, v); }; };
      var setB = function (k) { return function (v) { self.setPart("bot", k, v); }; };
      return [
        h("section", { key: "hero", className: "pds-card" },
          h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Topo"), h("small", null, "Foto, título, bio e redes"))),
          h("div", { className: "pdl-top" },
            h("button", {
              type: "button", className: "pds-img pdl-avatar" + (avatar ? " has" : ""), style: avatar ? { backgroundImage: "url(" + JSON.stringify(avatar) + ")" } : null,
              "aria-label": "Trocar foto de perfil",
              onClick: function () { if (hp) hp.pickImage("avatar", hero.avatar, function (path) { self.setPart("hero", "avatar", path); }); }
            }, avatar ? "" : "Foto"),
            h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
              h("div", { className: "pds-grid2" },
                this.input("Título", hero.title, setH("title"), { id: "h-title" }),
                this.input("Handle (@usuário)", hero.handle, setH("handle"), { id: "h-handle" })),
              this.input("Bio", hero.bio, setH("bio"), { id: "h-bio", multiline: true, rows: 3 }))
          ),
          h("div", { className: "pds-grid2" },
            this.input("Link do Instagram", hero.instagramUrl, setH("instagramUrl"), { id: "h-ig" }),
            this.input("Link do YouTube", hero.youtubeUrl, setH("youtubeUrl"), { id: "h-yt" }))
        ),
        h("section", { key: "bot", className: "pds-card" },
          h("div", { className: "pds-card-h" }, h("div", null, h("b", null, "Card do assistente"), h("small", null, "O bloco de destaque logo abaixo do topo"))),
          h("div", { className: "pds-grid2" },
            this.input("Título", bot.title, setB("title"), { id: "b-title" }),
            this.input("Link", bot.href, setB("href"), { id: "b-href", placeholder: "/assistente-de-vistos/" })),
          this.input("Descrição", bot.description, setB("description"), { id: "b-desc", multiline: true, rows: 2 })
        )
      ];
    },

    renderItem: function (s, si, it, ii) {
      var self = this;
      var key = si + ":" + ii;
      var open = this.state.openItem === key;
      var set = function (k, v) {
        self.change(function (secs) {
          var t = secs[si].items[ii];
          if (k === "title" && (!t.trackId || (self.freshItem === key && t.trackId === K.slugify(t.title)))) t.trackId = K.slugify(v);
          if (k === "href") t.external = isExternal(v);
          t[k] = v;
          if (k === "price" && !v) delete t.price;
        });
      };
      return h("div", { key: ii, className: "pdl-item" + (it.active === false ? " off" : "") },
        h("div", { className: "pdl-item-row" },
          h("button", { type: "button", className: "pds-grip", "aria-label": "Arrastar link" }, "⠿"),
          h("input", { className: "pds-input bare pdl-emoji", value: it.icon || "", "aria-label": "Emoji do ícone", onChange: function (e) { set("icon", e.target.value); } }),
          h("div", { className: "t", role: "button", tabIndex: 0, "aria-expanded": String(open),
            onClick: function () { self.setState({ openItem: open ? null : key }); },
            onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.setState({ openItem: open ? null : key }); } } },
            h("b", null, it.title || "(sem título)"),
            h("small", null, (it.price ? it.price + " · " : "") + (it.href || "sem link"))),
          !it.href ? h("span", { className: "pds-pill warn" }, "sem link") : null,
          h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(it.active !== false), "aria-label": "Mostrar " + (it.title || "link"),
            onClick: function () { set("active", it.active === false); } })
        ),
        open ? h("div", { className: "pdl-more" },
          this.input("Título", it.title, function (v) { set("title", v); }, { id: "i-title-" + key }),
          this.input("Descrição", it.description, function (v) { set("description", v); }, { id: "i-desc-" + key, multiline: true, rows: 2 }),
          h("div", { className: "pds-grid2" },
            this.input("Link", it.href, function (v) { set("href", v.trim()); }, { id: "i-href-" + key, placeholder: "/artigos/post/?slug=… ou https://…" }),
            this.input("Preço (opcional)", it.price, function (v) { set("price", v); }, { id: "i-price-" + key, placeholder: "Ex.: 25€" })),
          h("div", { className: "pds-row" },
            h("button", { type: "button", className: "pds-switch", role: "switch", "aria-checked": String(!!it.external), "aria-label": "Abrir em nova aba", onClick: function () { set("external", !it.external); } }),
            h("span", { className: "pds-hint" }, "Abre em nova aba" + (isExternal(it.href) ? " (link de fora do site)" : ""))),
          h("div", { className: "pds-field" },
            h("label", { htmlFor: "pdl-i-track-" + key }, "Id de rastreamento (conta os cliques no /admin/dashboard)"),
            h("input", { id: "pdl-i-track-" + key, className: "pds-input", value: it.trackId || "", style: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: "13px" },
              onChange: function (e) { set("trackId", K.slugify(e.target.value)); } }),
            it.trackId && this.freshItem !== key ? h("p", { className: "pds-hint" }, "Mudar o id começa uma contagem de cliques nova pra esse link.") : null),
          h("div", { className: "pds-row", style: { justifyContent: "flex-end" } },
            h("button", { type: "button", className: "pds-btn danger sm", onClick: function () {
              self.change(function (secs) { secs[si].items.splice(ii, 1); });
              self.setState({ openItem: null });
            } }, "Excluir link"))
        ) : null
      );
    },

    onItemSort: function (e) {
      var self = this;
      this.freshItem = null;
      this.change(function (secs) {
        var from = secs[Number(e.from)], to = secs[Number(e.to)];
        var it = from.items.splice(e.oldIndex, 1)[0];
        to.items.splice(e.newIndex, 0, it);
      });
      self.setState({ openItem: null });
    },

    renderSections: function (sections) {
      var self = this;
      return [
        h("div", { key: "h", className: "pds-card-h" },
          h("div", null, h("b", null, "Seções de links"), h("small", null, "Arraste a seção pela alça do título, e os links entre as seções.")),
          h("button", { type: "button", className: "pds-btn sm", onClick: function () {
            self.change(function (secs) { secs.push({ title: "Nova seção", items: [] }); });
          } }, "+ Seção")),
        h(K.SortableList, {
          key: "secs", className: "pdl-secs", handle: ".pdl-sec-grip",
          onSort: function (e) { self.freshItem = null; self.setState({ openItem: null }); self.change(function (secs) { var m = K.moveIn(secs, e.oldIndex, e.newIndex); secs.length = 0; Array.prototype.push.apply(secs, m); }); }
        }, sections.map(function (s, si) {
          s.items = s.items || [];
          var confirming = self.state.confirmSec === si;
          return h("div", { key: si, className: "pdl-sec" },
            h("div", { className: "pdl-sec-h" },
              h("button", { type: "button", className: "pds-grip pdl-sec-grip", "aria-label": "Arrastar seção" }, "⠿"),
              h("input", { className: "pds-input bare", value: s.title || "", "aria-label": "Título da seção",
                onChange: function (e) { var v = e.target.value; self.change(function (secs) { secs[si].title = v; }); } }),
              h("button", { type: "button", className: "pds-btn ghost sm", "aria-label": "Adicionar link nesta seção", onClick: function () {
                self.change(function (secs) { secs[si].items.unshift(newItem()); });
                self.freshItem = si + ":0";
                self.setState({ openItem: si + ":0" });
              } }, "+ Link"),
              confirming
                ? h("span", { className: "pds-row", style: { gap: "4px" } },
                    h("button", { type: "button", className: "pds-btn danger sm", onClick: function () {
                      self.change(function (secs) { secs.splice(si, 1); }); self.setState({ confirmSec: null, openItem: null });
                    } }, "Excluir seção e " + s.items.length + " link(s)"),
                    h("button", { type: "button", className: "pds-btn ghost sm", onClick: function () { self.setState({ confirmSec: null }); } }, "Cancelar"))
                : h("button", { type: "button", className: "pds-x", "aria-label": "Excluir seção", onClick: function () {
                    if (!s.items.length) self.change(function (secs) { secs.splice(si, 1); });
                    else self.setState({ confirmSec: si });
                  } }, "×")
            ),
            h(K.SortableList, { className: "pdl-items", listKey: String(si), group: "pdl-items", handle: ".pdl-item-row > .pds-grip", onSort: function (e) { self.onItemSort(e); } },
              s.items.map(function (it, ii) { return self.renderItem(s, si, it, ii); })),
            !s.items.length ? h("p", { className: "pds-hint", style: { textAlign: "center" } }, "Seção vazia não aparece no site. Arraste um link pra cá.") : null
          );
        })),
        h("p", { key: "hint", className: "pds-hint" }, "Links desligados continuam salvos, mas não aparecem na /links/.")
      ];
    },

    render: function () {
      var self = this;
      var sections = this.sections();
      var total = sections.reduce(function (a, s) { return a + (s.items || []).length; }, 0);
      var on = sections.reduce(function (a, s) { return a + (s.items || []).filter(function (i) { return i.active !== false; }).length; }, 0);
      var bar = K.launcher([sections.length + " seção(ões)", on + " de " + total + " links no ar"], "Abrir estúdio da Link na bio", this.open);
      if (!this.state.open) return bar;
      var hb = this.heroBot();
      return h("div", null, bar, K.shell(this, {
        title: "Link na bio", onClose: this.close, url: "/links/", version: this.state.version,
        edit: this.renderTop(hb.hero, hb.bot).concat(this.renderSections(sections))
      }));
    }
  });

  var LinksStudioPreview = createClass({
    render: function () {
      var sections = K.toJS(this.props.value, []);
      return h("div", { style: { fontFamily: K.FONT, fontSize: "13px" } }, sections.map(function (s, i) {
        return h("div", { key: i, style: { marginBottom: "8px" } }, h("b", null, s.title),
          h("ul", { style: { margin: "4px 0 0 18px", padding: 0 } }, (s.items || []).map(function (it, j) {
            return h("li", { key: j, style: { opacity: it.active === false ? 0.5 : 1 } }, (it.icon || "") + " " + it.title);
          })));
      }));
    }
  });

  CMS.registerWidget("links-studio", LinksStudioControl, LinksStudioPreview);
})();
