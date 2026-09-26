// Kit compartilhado das telas novas do /admin ("estúdios"). Cada estúdio é
// um widget do Decap (mesmo caminho do editor de artigos, ver
// article-composer.js) que abre por cima do formulário, edita o MESMO
// arquivo de content/*.json com arrastar e soltar, e mostra ao lado a
// página real do site já com as mudanças — antes de publicar.
//
// O que fica aqui, pra ser reaproveitado por todos os estúdios:
//   PDStudio.css(id, texto)       estilos (uma vez por página)
//   PDStudio.SortableList         lista arrastável (dedo e mouse)
//   PDStudio.Preview              prévia com a página real, por aparelho
//   PDStudio.Media                escolher imagem na biblioteca do Decap
//   PDStudio.assetUrl             mostrar imagem ainda não publicada
//
// Como a prévia funciona: a página do site abre num <iframe name=
// "pd-preview">, e assets/js/render.js (fetchJSON) lê os dados de
// window.parent.PDPreview em vez do arquivo publicado. assets/js/consent.js
// não mostra banner nem mede nada dentro da prévia.
//
// Precisa carregar DEPOIS do decap-cms.js (usa os globais createClass/h) e
// do admin/vendor/Sortable.min.js, e ANTES dos estúdios.
(function () {
  if (typeof createClass === "undefined" || typeof h === "undefined") {
    console.error("[studio-kit] Globais do Decap CMS (createClass/h) não encontrados — confira a ordem dos <script> em admin/index.html.");
    return;
  }

  var FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  var DISPLAY = "'Fraunces', Georgia, serif";

  // --- dados da prévia -------------------------------------------------------
  window.PDPreview = window.PDPreview || {
    store: {},
    get: function (path) { return this.store[path]; },
    set: function (path, data) { this.store[path] = data; },
    clear: function (path) { delete this.store[path]; }
  };

  // --- estilos ---------------------------------------------------------------
  var injected = {};
  function css(id, text) {
    if (injected[id] || document.getElementById(id)) return;
    injected[id] = true;
    var el = document.createElement("style");
    el.id = id;
    el.textContent = text;
    document.head.appendChild(el);
  }

  css("pds-kit-style", [
    ".pds-overlay{position:fixed;inset:0;z-index:999999;background:#F4F1EC;color:#2B2B2B;display:flex;flex-direction:column;height:100vh;height:100dvh;font-family:" + FONT + ";font-size:14px;line-height:1.45;box-sizing:border-box;}",
    ".pds-overlay *,.pds-overlay *::before,.pds-overlay *::after{box-sizing:border-box;}",
    ".pds-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));background:#FBFAF7;border-bottom:1px solid #E2DCD2;flex-shrink:0;}",
    ".pds-top h2{font-family:" + DISPLAY + ";font-size:19px;font-weight:600;margin:0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pds-top small{color:#6E6862;font-size:12px;}",
    ".pds-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);}",
    ".pds-edit{overflow-y:auto;padding:18px 18px 90px;display:flex;flex-direction:column;gap:14px;}",
    ".pds-side{border-left:1px solid #E2DCD2;display:flex;flex-direction:column;min-height:0;background:#FBFAF7;}",
    ".pds-tabs{display:inline-flex;background:#EFEBE4;border-radius:10px;padding:3px;gap:2px;}",
    ".pds-tabs button{border:0;background:none;padding:6px 11px;border-radius:8px;color:#6E6862;font:500 13px " + FONT + ";cursor:pointer;}",
    ".pds-tabs button[aria-pressed=true]{background:#fff;color:#2B2B2B;box-shadow:0 1px 3px rgba(43,35,25,.12);}",
    ".pds-mobile-tabs{display:none;padding:8px 16px;background:#FBFAF7;border-bottom:1px solid #E2DCD2;}",
    "html.pds-dragging,html.pds-dragging *{-webkit-user-select:none!important;user-select:none!important;cursor:grabbing!important;}",
    ".pds-btn{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;border:1px solid #CFC7BA;background:#fff;border-radius:9px;padding:7px 12px;font:500 13px " + FONT + ";color:#2B2B2B;cursor:pointer;min-height:36px;}",
    ".pds-btn:hover{border-color:#2B2B2B;}",
    ".pds-btn.primary{background:#577328;border-color:#577328;color:#fff;}",
    ".pds-btn.ghost{border-color:transparent;background:none;color:#6E6862;}",
    ".pds-btn.danger{color:#A63A2E;border-color:#E9C8C2;}",
    ".pds-btn.sm{min-height:30px;padding:4px 10px;font-size:12.5px;}",
    ".pds-btn:disabled{opacity:.5;cursor:default;}",
    ".pds-card{background:#FBFAF7;border:1px solid #E2DCD2;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;}",
    ".pds-card-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}",
    ".pds-card-h b{display:block;font-size:14px;}",
    ".pds-card-h small{color:#6E6862;font-size:12px;}",
    ".pds-field{display:flex;flex-direction:column;gap:5px;min-width:0;}",
    ".pds-field label,.pds-label{font-size:12px;color:#6E6862;font-weight:500;}",
    ".pds-input{width:100%;border:1px solid #E2DCD2;background:#fff;border-radius:9px;padding:8px 10px;font:14px " + FONT + ";color:#2B2B2B;outline:none;}",
    ".pds-input:focus{border-color:#577328;box-shadow:0 0 0 3px rgba(87,115,40,.15);}",
    "textarea.pds-input{resize:vertical;min-height:64px;line-height:1.5;}",
    ".pds-input.bare{border-color:transparent;background:transparent;padding:4px 6px;}",
    ".pds-input.bare:hover{border-color:#E2DCD2;}",
    ".pds-input.bare:focus{background:#fff;border-color:#577328;}",
    ".pds-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}",
    ".pds-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}",
    ".pds-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:end;}",
    ".pds-hint{font-size:12px;color:#6E6862;margin:0;}",
    ".pds-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;border-radius:20px;padding:2px 9px;white-space:nowrap;}",
    ".pds-pill.on{background:#E3EDDA;color:#3F6E2B;}",
    ".pds-pill.off{background:#EFEBE4;color:#6E6862;}",
    ".pds-pill.warn{background:#F6ECD6;color:#8A5F12;}",
    ".pds-switch{position:relative;width:38px;height:22px;flex:none;border:0;border-radius:20px;background:#CFC7BA;cursor:pointer;padding:0;transition:background .2s;}",
    ".pds-switch::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .2s;}",
    ".pds-switch[aria-checked=true]{background:#577328;}",
    ".pds-switch[aria-checked=true]::after{transform:translateX(16px);}",
    ".pds-grip{cursor:grab;color:#9A938A;display:grid;place-items:center;width:24px;height:32px;border-radius:6px;flex:none;border:0;background:none;padding:0;touch-action:none;font-size:15px;line-height:1;}",
    ".pds-grip:hover{color:#2B2B2B;background:#EFEBE4;}",
    ".pds-x{border:0;background:none;color:#9A938A;width:28px;height:28px;border-radius:6px;display:grid;place-items:center;flex:none;cursor:pointer;font-size:16px;line-height:1;padding:0;}",
    ".pds-x:hover{background:#F5E1DD;color:#A63A2E;}",
    ".pds-ghost{opacity:.35;outline:2px dashed #577328;outline-offset:-2px;}",
    ".pds-chosen{box-shadow:0 14px 34px -12px rgba(43,35,25,.35);}",
    ".pds-drag{box-shadow:0 14px 34px -12px rgba(43,35,25,.35)!important;opacity:1!important;}",
    ".pds-empty{font-size:12.5px;color:#9A938A;text-align:center;padding:14px 8px;border:1.5px dashed #CFC7BA;border-radius:10px;}",
    ".pds-img{position:relative;border-radius:10px;background:#EFEBE4 center/cover no-repeat;border:1.5px dashed #CFC7BA;display:grid;place-items:center;color:#6E6862;font-size:12px;text-align:center;cursor:pointer;overflow:hidden;padding:6px;}",
    ".pds-img.has{border-style:solid;border-color:#E2DCD2;}",
    ".pds-img:hover{border-color:#577328;}",
    // prévia
    ".pds-prev-bar{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #E2DCD2;flex-wrap:wrap;}",
    ".pds-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#6E6862;font-weight:500;}",
    ".pds-live i{width:7px;height:7px;border-radius:50%;background:#3F6E2B;box-shadow:0 0 0 3px #E3EDDA;}",
    ".pds-url{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#9A938A;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%;}",
    ".pds-stage{flex:1;min-height:0;background:#E6E1D8;overflow:hidden;position:relative;}",
    ".pds-frame-wrap{position:absolute;top:14px;left:50%;transform-origin:top center;background:#fff;box-shadow:0 10px 30px -12px rgba(0,0,0,.35);border-radius:12px;overflow:hidden;}",
    ".pds-frame-wrap.mobile{border:8px solid #1d1c1a;border-radius:28px;}",
    ".pds-frame-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;transition:opacity .15s;}",
    ".pds-frame-wrap iframe.back{opacity:0;pointer-events:none;}",
    ".pds-loading{position:absolute;right:12px;bottom:10px;font-size:11px;color:#6E6862;background:rgba(251,250,247,.9);border-radius:20px;padding:2px 9px;}",
    "@media (max-width:900px){",
    "  .pds-body{grid-template-columns:minmax(0,1fr);}",
    "  .pds-mobile-tabs{display:block;}",
    "  .pds-body[data-tab=edit] .pds-side{display:none;}",
    "  .pds-body[data-tab=preview] .pds-edit{display:none;}",
    "  .pds-side{border-left:0;}",
    "  .pds-grid3{grid-template-columns:repeat(2,minmax(0,1fr));}",
    "}",
    "@media (max-width:560px){.pds-grid2{grid-template-columns:minmax(0,1fr);}.pds-edit{padding:14px 14px 90px;}.pds-top{flex-wrap:nowrap;}.pds-top small{display:none;}.pds-top h2{font-size:17px;}}",
    "@media (prefers-reduced-motion:reduce){.pds-overlay *{transition:none!important;animation:none!important;}}",
    // Com o estúdio aberto, a tela do Decap por baixo (que tem larguras
    // mínimas de computador) fica recortada no tamanho da janela — senão o
    // celular reduz a página inteira pra caber, e o estúdio fica minúsculo.
    "html.pds-open,html.pds-open body{overflow:hidden!important;height:100%;min-width:0!important;}",
    "html.pds-open #nc-root{position:relative;width:100%;height:100%;overflow:hidden;}"
  ].join("\n"));

  // --- lista arrastável ------------------------------------------------------
  // O SortableJS mexe no DOM direto; o React é quem precisa redesenhar. Então,
  // ao soltar, o item volta pro lugar de origem no DOM e a mudança vai só pro
  // estado (onSort) — o React redesenha na ordem nova. Cada lista tem um
  // "listKey"; listas com o mesmo "group" trocam itens entre si.
  var SortableList = createClass({
    componentDidMount: function () {
      var self = this;
      if (typeof Sortable === "undefined") {
        console.error("[studio-kit] SortableJS não carregou — confira admin/vendor/Sortable.min.js em admin/index.html.");
        return;
      }
      var p = this.props;
      this.sortable = Sortable.create(this.el, {
        animation: 160,
        forceFallback: true,
        fallbackTolerance: 4,
        handle: p.handle || null,
        filter: p.filter || null,
        preventOnFilter: false,
        group: p.group ? { name: p.group, pull: true, put: true } : undefined,
        sort: p.sort !== false,
        ghostClass: "pds-ghost",
        chosenClass: "pds-chosen",
        dragClass: "pds-drag",
        scrollSensitivity: 90,
        bubbleScroll: true,
        // sem isso, arrastar com o mouse vai selecionando o texto da tela
        onChoose: function () { document.documentElement.classList.add("pds-dragging"); },
        onUnchoose: function () {
          document.documentElement.classList.remove("pds-dragging");
          try { window.getSelection().removeAllRanges(); } catch (e) {}
        },
        onEnd: function (evt) {
          var from = evt.from, to = evt.to, item = evt.item;
          var moved = from !== to || evt.oldIndex !== evt.newIndex;
          if (!moved) return;
          if (item.parentNode) item.parentNode.removeChild(item);
          from.insertBefore(item, from.children[evt.oldIndex] || null);
          self.props.onSort({
            from: from.getAttribute("data-list"),
            to: to.getAttribute("data-list"),
            oldIndex: evt.oldIndex,
            newIndex: evt.newIndex
          });
        }
      });
    },
    componentWillUnmount: function () {
      if (this.sortable) this.sortable.destroy();
    },
    render: function () {
      var self = this;
      return h(this.props.tag || "div", {
        ref: function (el) { self.el = el; },
        className: this.props.className,
        style: this.props.style,
        "data-list": this.props.listKey || "main"
      }, this.props.children);
    }
  });

  // Aplica o resultado de um onSort a uma lista simples (mesma lista).
  function moveIn(list, oldIndex, newIndex) {
    var copy = list.slice();
    var it = copy.splice(oldIndex, 1)[0];
    copy.splice(newIndex, 0, it);
    return copy;
  }

  // --- prévia real, por aparelho ---------------------------------------------
  var DEVICES = {
    mobile: { w: 390, label: "Celular" },
    tablet: { w: 820, label: "Tablet" },
    desktop: { w: 1280, label: "Computador" }
  };

  // Duas iframes: a de trás carrega a versão nova e só aparece quando termina
  // de desenhar — assim a prévia não pisca a cada letra digitada. Mantém a
  // posição de rolagem entre uma versão e outra.
  var Preview = createClass({
    getInitialState: function () {
      return { front: 0, loading: false, box: { w: 0, h: 0 } };
    },
    componentDidMount: function () {
      var self = this;
      this.seq = this.seq || 0;
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(function () { self.measure(); });
        this.ro.observe(this.stage);
      }
      this.measure();
      this.load(true);
    },
    componentWillUnmount: function () {
      if (this.ro) this.ro.disconnect();
      clearTimeout(this.timer);
    },
    componentDidUpdate: function (prev) {
      if (prev.version !== this.props.version || prev.url !== this.props.url) this.schedule();
      if (prev.device !== this.props.device) this.measure();
    },
    measure: function () {
      if (!this.stage) return;
      var r = this.stage.getBoundingClientRect();
      if (r.width !== this.state.box.w || r.height !== this.state.box.h) this.setState({ box: { w: r.width, h: r.height } });
    },
    schedule: function () {
      var self = this;
      clearTimeout(this.timer);
      this.scheduled = true;
      this.timer = setTimeout(function () { self.load(false); }, 350);
    },
    frameUrl: function () {
      var u = this.props.url;
      this.seq = (this.seq || 0) + 1;
      return u + (u.indexOf("?") === -1 ? "?" : "&") + "_pv=" + this.seq;
    },
    load: function (first) {
      var self = this;
      var backIdx = first ? this.state.front : 1 - this.state.front;
      var frames = this.frames || [];
      var back = frames[backIdx], front = frames[this.state.front];
      this.scheduled = false;
      if (!back) return;
      var scrollY = 0;
      try { scrollY = front && front.contentWindow ? front.contentWindow.scrollY : 0; } catch (e) {}
      this.setState({ loading: true });
      back.onload = function () {
        // espera o script da página desenhar (ele é assíncrono)
        setTimeout(function () {
          try { back.contentWindow.scrollTo(0, self.pendingFocus ? 0 : scrollY); } catch (e) {}
          self.setState({ front: backIdx, loading: false }, function () {
            if (self.pendingFocus && !self.scheduled) { self.post(self.pendingFocus); self.pendingFocus = null; }
          });
        }, first ? 350 : 450);
      };
      back.src = this.frameUrl();
    },
    // Rola a página da prévia até um elemento e destaca (a página precisa
    // ouvir a mensagem "pd-focus" — ver o fim de assets/js/vitrine.js).
    // Se a prévia vai trocar de página (ou está carregando), espera a nova.
    focus: function (selector) {
      this.pendingFocus = selector;
      if (!this.state.loading && !this.scheduled) { this.post(selector); this.pendingFocus = null; }
    },
    post: function (selector) {
      var f = (this.frames || [])[this.state.front];
      try { f.contentWindow.postMessage({ type: "pd-focus", selector: selector }, window.location.origin); } catch (e) {}
    },
    render: function () {
      var self = this;
      var dev = DEVICES[this.props.device] || DEVICES.mobile;
      var pad = 28;
      var scale = this.state.box.w ? Math.min(1, (this.state.box.w - pad) / dev.w) : 1;
      var height = this.state.box.h ? (this.state.box.h - pad) / scale : 700;
      var frames = [0, 1].map(function (i) {
        return h("iframe", {
          key: i,
          name: "pd-preview",
          title: "Prévia da página",
          className: i === self.state.front ? "front" : "back",
          ref: function (el) { if (el) (self.frames = self.frames || [])[i] = el; },
          tabIndex: i === self.state.front ? 0 : -1
        });
      });
      return h("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } },
        h("div", { className: "pds-prev-bar" },
          h("span", { className: "pds-live" }, h("i"), "Prévia ao vivo"),
          h("div", { className: "pds-tabs", role: "group", "aria-label": "Tamanho da tela" },
            Object.keys(DEVICES).map(function (k) {
              return h("button", { key: k, type: "button", "aria-pressed": String(self.props.device === k), onClick: function () { self.props.onDevice(k); } }, DEVICES[k].label);
            })
          ),
          this.props.extra || null,
          h("span", { className: "pds-url" }, this.props.url)
        ),
        h("div", { className: "pds-stage", ref: function (el) { self.stage = el; } },
          h("div", {
            className: "pds-frame-wrap" + (this.props.device === "mobile" ? " mobile" : ""),
            style: { width: dev.w + "px", height: height + "px", transform: "translateX(-50%) scale(" + scale + ")" }
          }, frames),
          this.state.loading ? h("span", { className: "pds-loading" }, "Atualizando…") : null
        )
      );
    }
  });

  // --- imagens ---------------------------------------------------------------
  // Mostra uma imagem do site mesmo que ela ainda não esteja publicada (foi
  // escolhida agora na biblioteca e só sobe junto com o "Publicar").
  function assetUrl(props, path) {
    if (!path) return "";
    try {
      if (props.getAsset) {
        var a = props.getAsset(path, props.field);
        if (a && typeof a.toString === "function") {
          var s = a.toString();
          if (s && s !== "[object Object]") return s;
        }
      }
    } catch (e) {}
    return path;
  }

  // Abre a biblioteca de mídia do Decap pra um "alvo" (ex. "cover:2") e, quando
  // a imagem é escolhida, chama onPick(alvo, caminho). Use Media.open(...) no
  // clique e Media.collect(this) no componentDidUpdate do widget.
  var Media = {
    open: function (comp, target, current) {
      var id = comp.props.forID + "::" + target;
      comp._pdsMedia = comp._pdsMedia || {};
      comp._pdsMedia[id] = target;
      comp.props.onOpenMediaLibrary({
        controlID: id,
        forImage: true,
        value: current || "",
        allowMultiple: false,
        field: comp.props.field
      });
    },
    collect: function (comp, onPick) {
      var pending = comp._pdsMedia;
      var paths = comp.props.mediaPaths;
      if (!pending || !paths || !paths.get) return;
      Object.keys(pending).forEach(function (id) {
        var v = paths.get(id);
        if (!v) return;
        if (typeof v !== "string" && v.get) v = v.get(0);
        var target = pending[id];
        delete pending[id];
        comp.props.onRemoveInsertedMedia(id);
        if (v) onPick(target, v);
      });
    }
  };

  // Valor do Decap (Immutable ou já JS) → JS puro, copiado.
  function toJS(value, fallback) {
    if (value == null) return fallback;
    if (typeof value.toJS === "function") return value.toJS();
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(text) {
    return String(text || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  // --- campos "irmãos" -------------------------------------------------------
  // No Decap, cada widget só consegue gravar o próprio campo. Quando um
  // arquivo tem vários campos no topo (ex. links.json: hero, bot, sections),
  // os outros campos usam o widget "studio-part": ele não desenha formulário,
  // só se registra aqui pelo nome do campo, e o estúdio lê e grava por ele.
  //   K.part("hero")              → { value (JS), set(novoValor), pickImage(alvo, atual, cb) } ou null
  // Ao trocar de coleção sem recarregar, o Decap pode manter por um tempo um
  // formulário antigo montado — então guarda todas as instâncias vivas e
  // escolhe a que pertence ao conteúdo aberto (os dados dela têm esse campo).
  var live = [];
  function findPart(name) {
    for (var i = live.length - 1; i >= 0; i--) {
      var inst = live[i], pr = inst.props;
      if (!pr.field || pr.field.get("name") !== name || pr.value == null) continue;
      var data = pr.entry && pr.entry.get && pr.entry.get("data");
      if (data && data.has && !data.has(name)) continue;
      return inst;
    }
    return null;
  }
  function part(name) {
    var inst = findPart(name);
    if (!inst) return null;
    return {
      value: toJS(inst.props.value, null),
      set: function (v) { inst.props.onChange(v); },
      pickImage: function (target, current, cb) {
        inst._pdsPick = inst._pdsPick || {};
        inst._pdsPick[target] = cb;
        Media.open(inst, target, current);
      },
      props: inst.props
    };
  }
  var StudioPart = createClass({
    componentDidMount: function () { live.push(this); },
    componentDidUpdate: function () {
      var self = this;
      Media.collect(this, function (target, path) {
        var cb = self._pdsPick && self._pdsPick[target];
        if (cb) { delete self._pdsPick[target]; cb(path); }
      });
    },
    componentWillUnmount: function () {
      var i = live.indexOf(this);
      if (i !== -1) live.splice(i, 1);
    },
    // O Decap já mostra o "hint" do campo (ver config.yml); nada a desenhar.
    render: function () { return null; }
  });
  if (typeof CMS !== "undefined") CMS.registerWidget("studio-part", StudioPart);

  // Liga/desliga o modo "estúdio aberto" (ver html.pds-open acima).
  function lockPage(on) {
    document.documentElement.classList.toggle("pds-open", !!on);
  }

  // Molde da tela de um estúdio: topo com "Concluir", abas Editar/Ver prévia
  // no celular, edição à esquerda e prévia real à direita. "comp" é o widget
  // (usa comp.state.tab/device e comp.setState).
  function shell(comp, opts) {
    return h("div", { className: "pds-overlay", role: "dialog", "aria-modal": "true", "aria-label": opts.label || opts.title },
      h("div", { className: "pds-top" },
        h("h2", null, opts.title),
        h("small", null, "As mudanças vão pro site quando você clicar em Publicar no /admin."),
        h("button", { type: "button", className: "pds-btn primary", onClick: opts.onClose }, "Concluir")
      ),
      h("div", { className: "pds-mobile-tabs" },
        h("div", { className: "pds-tabs" },
          h("button", { type: "button", "aria-pressed": String(comp.state.tab !== "preview"), onClick: function () { comp.setState({ tab: "edit" }); } }, "Editar"),
          h("button", { type: "button", "aria-pressed": String(comp.state.tab === "preview"), onClick: function () { comp.setState({ tab: "preview" }); } }, "Ver prévia"))),
      h("div", { className: "pds-body", "data-tab": comp.state.tab === "preview" ? "preview" : "edit" },
        h("div", { className: "pds-edit" }, opts.edit),
        h("div", { className: "pds-side" },
          h(Preview, {
            url: opts.url, device: comp.state.device || opts.device || "mobile", version: opts.version,
            onDevice: function (d) { comp.setState({ device: d }); }, extra: opts.previewExtra
          }),
          opts.below || null)
      )
    );
  }

  // Barra que fica no formulário do Decap, com o botão que abre o estúdio.
  function launcher(summary, label, onOpen) {
    return h("div", { style: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid rgba(43,43,43,.14)", borderRadius: "6px", background: "#fff", fontSize: "13px", fontFamily: FONT } },
      summary.map(function (s, i) { return h("span", { key: i }, s); }),
      h("button", { type: "button", className: "pds-btn primary", onClick: onOpen }, label));
  }

  // Cor da marca com atalhos (as cores que o site já usa) + qualquer outra.
  var SWATCHES = [
    ["#577328", "Musgo"], ["#604034", "Marrom"], ["#5F87AE", "Azul"], ["#8AACD2", "Azul claro"], ["#B8933F", "Dourado"], ["#2B2B2B", "Grafite"]
  ];
  css("pds-color-style", [
    ".pds-colors{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}",
    ".pds-sw{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #E2DCD2;cursor:pointer;padding:0;}",
    ".pds-sw[aria-pressed=true]{box-shadow:0 0 0 2px #2B2B2B;}",
    ".pds-colors input[type=color]{width:30px;height:28px;border:1px solid #E2DCD2;border-radius:8px;background:#fff;padding:2px;cursor:pointer;}",
    ".pds-colors code{font-size:11.5px;color:#6E6862;}"
  ].join("\n"));
  function colorField(label, value, onChange) {
    var v = String(value || "").toUpperCase();
    return h("div", { className: "pds-field" },
      h("span", { className: "pds-label" }, label),
      h("div", { className: "pds-colors", role: "group", "aria-label": label },
        SWATCHES.map(function (s) {
          return h("button", { key: s[0], type: "button", className: "pds-sw", title: s[1], "aria-label": s[1], "aria-pressed": String(v === s[0]), style: { background: s[0] }, onClick: function () { onChange(s[0]); } });
        }),
        h("input", { type: "color", "aria-label": "Outra cor", value: /^#[0-9A-F]{6}$/.test(v) ? v.toLowerCase() : "#577328", onChange: function (e) { onChange(e.target.value.toUpperCase()); } }),
        h("code", null, v || "sem cor")));
  }

  window.PDStudio = {
    colorField: colorField,
    lockPage: lockPage,
    part: part,
    shell: shell,
    launcher: launcher,
    css: css,
    SortableList: SortableList,
    moveIn: moveIn,
    Preview: Preview,
    DEVICES: DEVICES,
    assetUrl: assetUrl,
    Media: Media,
    toJS: toJS,
    slugify: slugify,
    FONT: FONT,
    DISPLAY: DISPLAY
  };
})();
