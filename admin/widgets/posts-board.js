// Quadro de artigos — a lista "Artigos" da coleção posts
// (content/posts.json) vista como um quadro por etapa: Ideia → Escrevendo →
// Revisão → Agendado → No ar. Arrastar um cartão de uma coluna pra outra
// muda o campo "status" do artigo; tocar no cartão abre os dados dele
// (título, resumo, categoria, capa, datas) e a prévia mostra o artigo real.
//
// O formulário de sempre continua embaixo do botão (é a lista do próprio
// Decap, reaproveitada): galerias, cabeçalho/rodapé por artigo e o corpo
// (editor visual) seguem lá. "Editar o texto" no quadro abre direto o
// editor visual do artigo escolhido.
//
// Grava os mesmos campos de sempre em content/posts.json. Nada vai pro site
// até você clicar em "Publicar" no /admin.
(function () {
  if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined" || !window.PDStudio) {
    console.error("[posts-board] Decap CMS ou studio-kit.js não carregados — confira a ordem dos <script> em admin/index.html.");
    return;
  }
  var K = window.PDStudio;
  var DATA_PATH = "/content/posts.json";

  var COLS = [
    { k: "ideia", label: "Ideia", color: "#9A938A", hint: "Só o tema. Ninguém vê." },
    { k: "escrevendo", label: "Escrevendo", color: "#5F87AE", hint: "Em produção." },
    { k: "revisao", label: "Revisão", color: "#B07A1E", hint: "Pronto pra reler." },
    { k: "agendado", label: "Agendado", color: "#604034", hint: "Entra no ar sozinho na data." },
    { k: "publicado", label: "No ar", color: "#577328", hint: "O mais recente vira destaque do blog." }
  ];
  var LABEL = {};
  COLS.forEach(function (c) { LABEL[c.k] = c.label; });

  K.css("pds-board-style", [
    ".pdb{position:fixed;inset:0;z-index:999999;background:#F4F1EC;color:#2B2B2B;display:flex;flex-direction:column;height:100vh;height:100dvh;font:14px/1.5 " + K.FONT + ";}",
    ".pdb *,.pdb *::before,.pdb *::after{box-sizing:border-box;}",
    ".pdb h1,.pdb h2,.pdb h3{font-family:" + K.DISPLAY + ";font-weight:600;letter-spacing:-.01em;margin:0;}",
    ".pdb-top{display:flex;align-items:center;gap:10px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));background:#FBFAF7;border-bottom:1px solid #E6E0D6;flex-shrink:0;}",
    ".pdb-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}",
    ".pdb-brand i{width:30px;height:30px;border-radius:9px;background:#604034;color:#F4EDE6;display:grid;place-items:center;font:600 16px " + K.DISPLAY + ";font-style:normal;flex:none;}",
    ".pdb-brand b{font-family:" + K.DISPLAY + ";font-size:17px;font-weight:600;display:block;line-height:1.2;}",
    ".pdb-brand small{display:block;color:#6E6862;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdb-search{width:200px;}",
    ".pdb-mtabs{display:none;padding:8px 16px;background:#FBFAF7;border-bottom:1px solid #E6E0D6;}",
    ".pdb-app{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.72fr);position:relative;}",
    ".pdb-app.no-prev{grid-template-columns:minmax(0,1fr);}",
    ".pdb-app.no-prev .pdb-prev{display:none;}",
    ".pdb-boardwrap{min-height:0;display:flex;flex-direction:column;position:relative;overflow:hidden;}",
    ".pdb-filters{display:flex;gap:6px;flex-wrap:wrap;padding:12px 16px 0;}",
    ".pdb-chip{border:1px solid #E6E0D6;background:#fff;border-radius:20px;padding:3px 10px;font:500 12px " + K.FONT + ";color:#6E6862;cursor:pointer;}",
    ".pdb-chip[aria-pressed=true]{background:#2B2B2B;border-color:#2B2B2B;color:#fff;}",
    ".pdb-board{flex:1;min-height:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,1fr);gap:12px;padding:12px 16px 24px;overflow-x:auto;overflow-y:hidden;}",
    ".pdb-boardwrap.has-drawer .pdb-board{padding-right:436px;}",
    "@media (max-width:640px){.pdb-boardwrap.has-drawer .pdb-board{padding-right:16px;}}",
    ".pdb-col{display:flex;flex-direction:column;min-height:0;background:#EFEBE4;border-radius:14px;}",
    ".pdb-col-h{padding:10px 12px 6px;}",
    ".pdb-col-h div{display:flex;align-items:center;gap:7px;}",
    ".pdb-col-h i{width:9px;height:9px;border-radius:50%;flex:none;}",
    ".pdb-col-h b{font-size:13px;}",
    ".pdb-col-h em{font-style:normal;margin-left:auto;font-size:11.5px;color:#6E6862;background:#fff;border-radius:20px;padding:0 8px;}",
    ".pdb-col-h small{display:block;color:#6E6862;font-size:11.5px;margin-top:2px;}",
    ".pdb-cards{flex:1;min-height:60px;overflow-y:auto;padding:4px 8px 12px;display:flex;flex-direction:column;gap:8px;}",
    ".pdb-card{background:#fff;border:1.5px solid #E6E0D6;border-radius:12px;padding:8px;cursor:grab;display:flex;flex-direction:column;gap:6px;transition:border-color .2s,box-shadow .2s,transform .15s;touch-action:manipulation;}",
    ".pdb-card:hover{border-color:#D8D0C3;transform:translateY(-1px);}",
    ".pdb-card.is-sel{border-color:#577328;box-shadow:0 0 0 3px #E7ECDC;}",
    ".pdb-card .th{aspect-ratio:16/7;border-radius:8px;background:#F4F1EC center/cover no-repeat;display:grid;place-items:center;color:#B5AEA4;font-size:11px;}",
    ".pdb-card b{font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
    ".pdb-meta{display:flex;flex-wrap:wrap;gap:4px 8px;font-size:11.5px;color:#6E6862;align-items:center;}",
    ".pdb-flags{display:flex;flex-wrap:wrap;gap:4px;}",
    ".pdb-flag{font-size:10.5px;font-weight:600;border-radius:20px;padding:1px 7px;background:#F6ECD6;color:#8A5F12;}",
    ".pdb-flag.ok{background:#E3EDDA;color:#3F6E2B;}",
    ".pdb-flag.muted{background:#EFEBE4;color:#6E6862;}",
    ".pdb-empty{font-size:12px;color:#9A938A;text-align:center;padding:16px 6px;border:1.5px dashed #D8D0C3;border-radius:10px;}",
    ".pdb-prev{border-left:1px solid #E6E0D6;display:flex;flex-direction:column;min-height:0;background:#FBFAF7;}",
    // gaveta com os dados do artigo
    ".pdb-drawer{position:absolute;top:0;right:0;bottom:0;width:min(420px,100%);background:#FBFAF7;border-left:1px solid #E6E0D6;box-shadow:-18px 0 40px -24px rgba(43,35,25,.35);display:flex;flex-direction:column;z-index:3;animation:pdbIn .22s ease-out;}",
    "@keyframes pdbIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}",
    ".pdb-drawer-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #E6E0D6;}",
    ".pdb-drawer-h h3{font-size:17px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdb-drawer-b{flex:1;overflow-y:auto;padding:14px 14px 40px;display:flex;flex-direction:column;gap:12px;}",
    ".pdb-seg{display:flex;flex-wrap:wrap;gap:4px;}",
    ".pdb-seg button{border:1px solid #E6E0D6;background:#fff;border-radius:9px;padding:5px 9px;font:500 12px " + K.FONT + ";color:#6E6862;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}",
    ".pdb-seg button i{width:7px;height:7px;border-radius:50%;}",
    ".pdb-seg button[aria-pressed=true]{border-color:#2B2B2B;color:#2B2B2B;box-shadow:0 0 0 2px #EFEBE4;font-weight:600;}",
    ".pdb-msg{font-size:12px;margin:0;color:#6E6862;}",
    ".pdb-msg.warn{color:#8A5F12;}.pdb-msg.err{color:#A63A2E;}.pdb-msg.ok{color:#3F6E2B;}",
    ".pdb-input-err{border-color:#D9A79E!important;box-shadow:0 0 0 3px #F5E1DD!important;}",
    ".pdb-cover{aspect-ratio:16/9;}",
    ".pdb-checks{display:flex;flex-direction:column;gap:5px;background:#fff;border:1px solid #E6E0D6;border-radius:12px;padding:10px 12px;}",
    ".pdb-checks span{font-size:12.5px;display:flex;gap:7px;align-items:baseline;}",
    ".pdb-actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:4px;}",
    ".pdb-toast{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#2B2B2B;color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;display:flex;gap:12px;align-items:center;z-index:1000001;box-shadow:0 12px 30px -12px rgba(0,0,0,.5);max-width:calc(100% - 32px);}",
    ".pdb-toast button{border:0;background:#fff;color:#2B2B2B;border-radius:8px;padding:4px 10px;font:600 12.5px " + K.FONT + ";cursor:pointer;}",
    ".pdb-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(43,43,43,.14);border-radius:6px;background:#fff;font:13px " + K.FONT + ";margin-bottom:12px;}",
    "@media (max-width:1100px){",
    "  .pdb-app{grid-template-columns:minmax(0,1fr);}",
    "  .pdb-mtabs{display:block;}",
    "  .pdb-app[data-tab=quadro] .pdb-prev{display:none;}",
    "  .pdb-app[data-tab=previa] .pdb-boardwrap{display:none;}",
    "  .pdb-prev{border-left:0;}",
    "  .pdb-toggle-prev{display:none;}",
    "}",
    "@media (max-width:640px){",
    "  .pdb-board{grid-auto-columns:82vw;scroll-snap-type:x mandatory;}",
    "  .pdb-filters{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;}",
    "  .pdb-chip{flex:none;}",
    "  .pdb-card .th{aspect-ratio:16/6;}",
    "  .pdb-col{scroll-snap-align:start;}",
    "  .pdb-search{display:none;}",
    "  .pdb-brand small{display:none;}",
    "  .pdb-new-label{display:none;}",
    "}",
    "@media (prefers-reduced-motion:reduce){.pdb *{animation:none!important;transition:none!important;}}",
    ".pdb-robot{position:absolute;inset:0;z-index:5;background:rgba(43,43,43,.45);display:flex;align-items:center;justify-content:center;padding:16px;}",
    ".pdb-robot-box{background:#FBFAF7;border-radius:16px;width:min(1100px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px -20px rgba(0,0,0,.5);}",
    ".pdb-robot-h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #E6E0D6;}",
    ".pdb-robot-b{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;padding:16px 18px;overflow:auto;min-height:0;}",
    "@media (max-width:800px){.pdb-robot-b{grid-template-columns:1fr;}}",
    ".pdb-robot textarea{width:100%;min-height:52vh;font:12.5px/1.5 ui-monospace,Menlo,monospace;border:1px solid #CFC7BA;border-radius:10px;padding:12px;resize:vertical;background:#fff;}",
    ".pdb-robot-f{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 18px;border-top:1px solid #E6E0D6;}",
    ".pdb-ck{display:grid;gap:5px;font-size:12.5px;margin-top:10px;}",
    ".pdb-ck span{display:flex;gap:7px;align-items:flex-start;}",
    ".pdb-ck i{font-style:normal;width:16px;height:16px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;font-size:10px;font-weight:700;margin-top:1px;}",
    ".pdb-cover-prev{border-radius:10px;overflow:hidden;margin-top:6px;}",
    ".pdb-notes{white-space:pre-wrap;font-size:12.5px;background:#fff;border:1px solid #E6E0D6;border-radius:10px;padding:10px 12px;max-height:220px;overflow:auto;}",
  ].join("\n"));

  // --- ajudantes -------------------------------------------------------------
  function todayISO() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function day(iso) { return iso ? String(iso).slice(0, 10) : ""; }
  function fmt(iso) {
    if (!iso) return "";
    var d = new Date(day(iso) + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  }
  // Mesma regra do site (isPublished em assets/js/render.js).
  function isLive(p) {
    if (p.status === "publicado") return true;
    if (p.status === "agendado") return !!p.date && day(p.date) <= todayISO();
    return false;
  }
  function words(text) { return String(text || "").replace(/\[\[[^\]]*\]\]/g, " ").split(/\s+/).filter(Boolean).length; }
  function statusOf(p) { return LABEL[p.status] ? p.status : "ideia"; }

  // O que falta pro artigo (regras do README: todo artigo termina com FAQ e
  // Feedback). Artigos com página própria (url) têm o HTML fixo — o corpo
  // daqui não vale pra eles.
  function issues(p) {
    var out = [];
    if (!p.title) out.push("Sem título");
    if (!p.excerpt) out.push("Sem resumo");
    if (!p.category) out.push("Sem categoria");
    if (!p.image && !p.coverKeyword) out.push("Sem capa");
    if (!p.url) {
      var body = p.body || "";
      if (!/\[\[FAQ\]\]/.test(body)) out.push("Falta FAQ");
      if (!/\[\[FEEDBACK\]\]/.test(body)) out.push("Falta Feedback");
      if (body && !hasSignature(body)) out.push("Falta ferramenta-assinatura");
      if (body && !/\[\[PROXIMO-PASSO\]\]/.test(body)) out.push("Falta próximo passo");
    } else {
      if (!hasSignature(p.mxBlocks)) out.push("Falta ferramenta-assinatura");
      if (!/\[\[PROXIMO-PASSO\]\]/.test(p.mxBlocks || "")) out.push("Falta próximo passo");
    }
    if (p.status === "agendado" && !p.date) out.push("Sem data");
    return out;
  }


  // --- microengajamento e "Colar do robô" -------------------------------------
  // Ferramenta-assinatura = um dos blocos-ferramenta genéricos ou uma
  // ferramenta própria já existente (token de linha única).
  var SIGNATURE_RE = /\[\[(PRAZO|QUIZ|SELETOR|LINHA-DO-TEMPO|ROTEIRO|MAPA-FLE|VAE-SIMULADOR|DIPLOMA-DOSSIE|AU-PAIR-FLE-SCROLL|EXAME-TEMPLATE-GRATIS)\]\]/;
  function hasSignature(body) { return SIGNATURE_RE.test(body || ""); }
  var MX_PARTS = [
    { re: SIGNATURE_RE, label: "Ferramenta-assinatura", need: true },
    { re: /\[\[RESUMO\]\]/, label: "Resumo em 20s" },
    { re: /\[\[CONFIANCA\]\]/, label: "Termômetro de confiança" },
    { re: /\[\[(MITO|POLL|CHECKLIST)\]\]/, label: "Mito / enquete / checklist" },
    { re: /\[\[PERGUNTA\]\]/, label: "Pergunta pra Ingryd" },
    { re: /\[\[PROXIMO-PASSO\]\]/, label: "Próximo passo (Soluções digitais)", need: true },
    { re: /\[\[FAQ\]\]/, label: "FAQ", need: true },
    { re: /\[\[FEEDBACK\]\]/, label: "Feedback", need: true }
  ];

  var ROBOT_KEYS = {
    "titulo": "title", "título": "title", "slug": "slug", "categoria": "category", "resumo": "excerpt",
    "tempo": "readMinutes", "tempo-de-leitura": "readMinutes", "capa-palavra": "coverKeyword", "capa-apoio": "coverTags",
    "capa-formato": "coverFormat", "reacoes-por-secao": "sectionReactions", "reações-por-seção": "sectionReactions", "data": "date"
  };
  // Formato do pacote (ver admin/prompts/robo-escritor-de-artigos.md):
  //   ===ARTIGO POR DENTRO===  chave: valor …  ===CORPO===  markdown  ===NOTAS===  texto  ===FIM===
  function parseRobot(text) {
    var t = String(text || "").replace(/\r\n/g, "\n").replace(/^\s*```[a-z]*\n?/i, "").replace(/\n?```\s*$/, "");
    var out = { fields: {}, body: "", notes: "", errors: [] };
    var iBody = t.indexOf("===CORPO===");
    if (iBody === -1) { out.errors.push("Não achei a linha ===CORPO===. Cole o pacote inteiro, do ===ARTIGO POR DENTRO=== até o ===FIM==="); return out; }
    var head = t.slice(0, iBody).replace(/^[\s\S]*?===ARTIGO POR DENTRO===/, "");
    var rest = t.slice(iBody + 11);
    var iNotes = rest.indexOf("===NOTAS===");
    var iEnd = rest.indexOf("===FIM===");
    var bodyEnd = iNotes !== -1 ? iNotes : iEnd !== -1 ? iEnd : rest.length;
    out.body = rest.slice(0, bodyEnd).trim() + "\n";
    if (iNotes !== -1) out.notes = rest.slice(iNotes + 11, iEnd !== -1 && iEnd > iNotes ? iEnd : rest.length).trim();
    head.split("\n").forEach(function (line) {
      var m = line.match(/^\s*([A-Za-zÀ-ú-]+)\s*:\s*(.*)$/);
      if (!m) return;
      var key = ROBOT_KEYS[m[1].trim().toLowerCase()];
      if (!key) return;
      var v = m[2].trim();
      if (key === "readMinutes") v = parseInt(v, 10) || undefined;
      else if (key === "coverTags") v = v.split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3);
      else if (key === "sectionReactions") v = /^(sim|s|true|yes)$/i.test(v);
      out.fields[key] = v;
    });
    if (!out.fields.title) out.errors.push("Falta o título (titulo: …).");
    return out;
  }

  function robotChecks(parsed, items, skipIdx) {
    var f = parsed.fields, body = parsed.body, res = [];
    var ok = function (c, good, bad, warnOnly) { res.push({ ok: !!c, warn: !c && !!warnOnly, text: c ? good : bad }); };
    ok(!!f.title, "Título", "Sem título");
    ok(f.excerpt && f.excerpt.length <= 180, "Resumo com " + (f.excerpt || "").length + " caracteres", f.excerpt ? "Resumo longo (" + f.excerpt.length + "): no card fica cortado" : "Sem resumo", !!f.excerpt);
    ok(!!f.category, "Categoria: " + (f.category || ""), "Sem categoria");
    var kw = String(f.coverKeyword || "");
    ok(kw && kw.length <= 10, "Palavra da capa: " + kw, kw ? "Palavra da capa com " + kw.length + " caracteres (máx. 10)" : "Sem palavra da capa", !!kw);
    if (kw && window.PDCover) {
      var pil = window.PDCover.pillarOf(f.category);
      var dup = items.filter(function (o, i) { return i !== skipIdx && String(o.coverKeyword || "").toLowerCase() === kw.toLowerCase() && window.PDCover.pillarOf(o.category) === pil; })[0];
      if (dup) res.push({ ok: false, warn: false, text: "“" + kw + "” já é a capa de “" + (dup.title || "outro artigo") + "” no mesmo pilar" });
    }
    var slug = f.slug || K.slugify(f.title || "");
    if (items.some(function (o, i) { return i !== skipIdx && o.slug === slug; })) res.push({ ok: false, warn: false, text: "Outro artigo já usa o endereço " + slug });
    MX_PARTS.forEach(function (m) { ok(m.re.test(body), m.label, "Falta: " + m.label, !m.need); });
    return res;
  }


  // O Decap guarda a lista como Immutable (List de Map). O formulário de
  // baixo (a lista do Decap) precisa receber de volta no mesmo formato — então
  // converte usando os construtores do próprio valor atual.
  function toImmutable(sample, data) {
    var ListC = sample && sample.constructor;
    var first = sample && sample.first && sample.first();
    var MapC = first && first.constructor;
    if (!ListC || !MapC || typeof ListC !== "function" || typeof MapC !== "function") return data;
    function conv(v) {
      if (Array.isArray(v)) return ListC(v.map(conv));
      if (v && typeof v === "object") {
        var o = {};
        Object.keys(v).forEach(function (k) { o[k] = conv(v[k]); });
        return MapC(o);
      }
      return v;
    }
    return conv(data);
  }

  var ListWidget = CMS.getWidget && CMS.getWidget("list");
  var ListControl = ListWidget && ListWidget.control;
  var ListPreview = ListWidget && ListWidget.preview;

  var BoardControl = createClass({
    getInitialState: function () {
      return { open: false, sel: -1, tab: "quadro", device: "desktop", view: "blog", version: 0, toast: null, q: "", cat: "", listKey: 0, showPrev: true, confirmDelete: false };
    },
    componentDidUpdate: function () {
      var self = this;
      K.Media.collect(this, function (target, path) {
        var idx = Number(String(target).split(":")[1]);
        self.change(function (items) { if (items[idx]) items[idx].image = path; }, "Capa trocada", true);
      });
    },
    componentWillUnmount: function () {
      K.lockPage(false);
      clearTimeout(this.toastTimer);
    },

    items: function () { return K.toJS(this.props.value, []); },

    change: function (fn, label, undoable) {
      var before = this.items();
      var items = this.items();
      fn(items);
      var now = Date.now(), typing = !label;
      if (!typing || !this.lastTyping || now - this.lastTyping > 1200) this.history = (this.history || []).concat([before]).slice(-40);
      this.lastTyping = typing ? now : 0;
      this.commit(items);
      if (label) this.showToast(label, undoable);
    },
    commit: function (items) {
      this.props.onChange(toImmutable(this.props.value, items));
      this.pushPreview(items);
      this.setState({ version: this.state.version + 1 });
    },
    undo: function () {
      var prev = (this.history || []).pop();
      if (!prev) return;
      this.lastTyping = 0;
      this.commit(prev);
      this.setState({ sel: Math.min(this.state.sel, prev.length - 1), confirmDelete: false });
      this.showToast("Desfeito");
    },
    showToast: function (text, undoable) {
      var self = this;
      clearTimeout(this.toastTimer);
      this.setState({ toast: { text: text, undo: !!undoable } });
      this.toastTimer = setTimeout(function () { self.setState({ toast: null }); }, undoable ? 4200 : 2200);
    },
    pushPreview: function (items) {
      window.PDPreview.set(DATA_PATH, { items: items || this.items() });
    },

    open: function () {
      this.history = [];
      this.pushPreview();
      K.lockPage(true);
      this.setState({ open: true, sel: -1, tab: "quadro", view: "blog", confirmDelete: false, showPrev: window.innerWidth >= 1280 });
    },
    close: function () {
      K.lockPage(false);
      window.PDPreview.clear(DATA_PATH);
      // A lista do Decap embaixo guarda a ordem/abertura dos itens por conta
      // própria — recria ela pra acompanhar o que mudou no quadro.
      this.setState({ open: false, confirmDelete: false, listKey: this.state.listKey + 1 });
    },

    select: function (idx) {
      this.setState({ sel: idx, view: idx >= 0 ? "artigo" : "blog", confirmDelete: false });
      // Com a gaveta aberta, o cartão escolhido não pode ficar escondido atrás dela.
      if (idx >= 0) setTimeout(function () {
        var el = document.querySelector('.pdb-card[data-idx="' + idx + '"]');
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }, 40);
    },

    // Muda a etapa e aplica as regras de data do site.
    moveTo: function (idx, status) {
      var p = this.items()[idx];
      if (!p || statusOf(p) === status) return;
      var today = todayISO(), msg, askDate = false;
      if (status === "publicado") {
        if (!p.date) msg = "No ar · data de publicação: hoje";
        else if (day(p.date) > today) msg = "No ar agora (a data marcada é futura — pra esperar a data, use Agendado)";
        else msg = "No ar · vai pro blog quando você publicar no /admin";
      } else if (status === "agendado") {
        askDate = !p.date || day(p.date) <= today;
        msg = askDate ? "Agendado · escolha a data em que ele entra no ar" : "Agendado pra " + fmt(p.date);
      } else {
        msg = (isLive(p) ? "Saiu do blog (continua salvo) · " : "") + "Movido pra " + LABEL[status];
      }
      this.lastTyping = 0;
      this.change(function (items) {
        items[idx].status = status;
        if (status === "publicado" && !items[idx].date) items[idx].date = today;
      }, msg, true);
      if (askDate) {
        this.select(idx);
        setTimeout(function () { var el = document.getElementById("pdb-date"); if (el) el.focus(); }, 60);
      }
    },

    set: function (key, value) {
      var idx = this.state.sel;
      this.change(function (items) { items[idx][key] = value; });
    },

    newPost: function () {
      var self = this;
      this.freshSlug = "";
      this.change(function (items) {
        items.unshift({ status: "ideia", slug: "", title: "", excerpt: "", category: "", body: "" });
      }, "Ideia nova no quadro", true);
      this.setState({ sel: 0, view: "artigo", q: "", cat: "", tab: "quadro", confirmDelete: false });
      setTimeout(function () { var t = document.getElementById("pdb-title"); if (t) t.focus(); }, 80);
    },


    openRobot: function () { this.setState({ robot: true, robotText: this.state.robotText || "" }); },
    applyRobot: function (mode) {
      var parsed = parseRobot(this.state.robotText);
      if (parsed.errors.length) return;
      var f = parsed.fields, idx = this.state.sel;
      var data = {
        title: f.title, slug: f.slug || K.slugify(f.title || ""), excerpt: f.excerpt || "", category: f.category || "",
        readMinutes: f.readMinutes || Math.max(1, Math.round(words(parsed.body) / 200)), body: parsed.body,
        coverKeyword: f.coverKeyword || "", coverTags: f.coverTags || [], coverFormat: f.coverFormat || "Guia",
        sectionReactions: !!f.sectionReactions, editorNotes: parsed.notes || ""
      };
      if (f.date) data.date = f.date;
      if (mode === "replace" && idx >= 0) {
        this.change(function (items) { Object.keys(data).forEach(function (k) { items[idx][k] = data[k]; }); }, "Artigo substituído pelo texto do robô", true);
        this.setState({ robot: false, view: "artigo" });
      } else {
        this.change(function (items) { items.unshift(Object.assign({ status: "revisao" }, data)); }, "Artigo do robô criado em Revisão", true);
        this.setState({ robot: false, robotText: "", sel: 0, view: "artigo", q: "", tab: "quadro" });
      }
    },
    renderRobot: function (items) {
      var self = this;
      var text = this.state.robotText || "";
      var parsed = text.trim() ? parseRobot(text) : null;
      var skip = this.state.sel;
      var checks = parsed && !parsed.errors.length ? robotChecks(parsed, items, -1) : [];
      var sel = this.state.sel >= 0 ? items[this.state.sel] : null;
      var coverHtml = parsed && window.PDCover && parsed.fields.coverKeyword ? window.PDCover.html(Object.assign({}, parsed.fields, { readMinutes: parsed.fields.readMinutes })) : "";
      return h("div", { className: "pdb-robot", role: "dialog", "aria-modal": "true", "aria-label": "Colar artigo do robô" },
        h("div", { className: "pdb-robot-box" },
          h("div", { className: "pdb-robot-h" },
            h("div", null, h("h3", null, "Colar do robô"), h("small", { style: { color: "#6E6862" } }, "Cole o pacote inteiro que o robô escreveu, de ===ARTIGO POR DENTRO=== até ===FIM===. Os campos, a capa e os blocos são preenchidos sozinhos.")),
            h("button", { type: "button", className: "pds-x", "aria-label": "Fechar", onClick: function () { self.setState({ robot: false }); } }, "×")),
          h("div", { className: "pdb-robot-b" },
            h("textarea", { "aria-label": "Texto do robô", value: text, placeholder: "===ARTIGO POR DENTRO===\ntitulo: …\n…\n===CORPO===\n…\n===FIM===", onChange: function (e) { self.setState({ robotText: e.target.value }); } }),
            h("div", null,
              !parsed ? h("p", { style: { color: "#6E6862", fontSize: "13px" } }, "A prévia da capa e a conferência aparecem aqui assim que você colar.")
                : parsed.errors.length ? h("div", { className: "pdb-ck" }, parsed.errors.map(function (er, i) { return h("span", { key: i }, h("i", { style: { background: "#A63A2E" } }, "×"), er); }))
                : h("div", null,
                    h("b", { style: { fontFamily: K.DISPLAY, fontSize: "17px" } }, parsed.fields.title),
                    coverHtml ? h("div", { className: "pdb-cover-prev", dangerouslySetInnerHTML: { __html: coverHtml } }) : null,
                    h("div", { className: "pdb-ck" }, checks.map(function (c, i) {
                      return h("span", { key: i }, h("i", { style: { background: c.ok ? "#577328" : c.warn ? "#B07A1E" : "#A63A2E" } }, c.ok ? "✓" : c.warn ? "!" : "×"), c.text);
                    })),
                    parsed.notes ? h("div", { style: { marginTop: "12px" } }, h("span", { className: "pds-label" }, "Notas do robô (não vão pro site)"), h("div", { className: "pdb-notes" }, parsed.notes)) : null))),
          h("div", { className: "pdb-robot-f" },
            sel ? h("button", { type: "button", className: "pds-btn", disabled: !parsed || parsed.errors.length > 0, onClick: function () { self.applyRobot("replace"); } }, "Substituir “" + String(sel.title || "artigo aberto").slice(0, 30) + "”") : null,
            h("button", { type: "button", className: "pds-btn primary", disabled: !parsed || parsed.errors.length > 0, onClick: function () { self.applyRobot("new"); } }, "Criar artigo (vai pra Revisão)"))));
    },

    remove: function (idx) {
      var title = this.items()[idx].title || "Artigo sem título";
      this.change(function (items) { items.splice(idx, 1); }, "“" + title.slice(0, 40) + "” apagado", true);
      this.setState({ sel: -1, view: "blog", confirmDelete: false });
    },

    // Fecha o quadro e abre o editor visual do texto desse artigo, no
    // formulário de baixo (a lista do Decap).
    editBody: function (idx) {
      var self = this;
      this.close();
      setTimeout(function () {
        var list = self.listInst;
        var total = self.items().length;
        if (list && list.state && Array.isArray(list.state.itemsCollapsed)) {
          var col = [];
          for (var i = 0; i < total; i++) col.push(i !== idx);
          list.setState({ itemsCollapsed: col, listCollapsed: false });
        }
        setTimeout(function () {
          var root = self.listWrap;
          // Itens fechados continuam no DOM, escondidos — pega o botão visível.
          var btn = root && Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return /Editar artigo visualmente/.test(b.textContent) && b.offsetParent !== null; })[0];
          if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); }
        }, 250);
      }, 80);
    },

    // --- quadro ----------------------------------------------------------------
    renderCard: function (p, idx, isFeatured) {
      var self = this;
      var img = K.assetUrl(this.props, p.image);
      var flags = issues(p);
      var st = statusOf(p);
      var dateLine = null;
      if (st === "agendado") dateLine = p.date ? (isLive(p) ? "já no ar desde " + fmt(p.date) : "entra no ar " + fmt(p.date)) : "sem data";
      else if (st === "publicado") dateLine = fmt(p.date);
      return h("div", {
        key: (p.slug || "") + ":" + idx, className: "pdb-card" + (idx === this.state.sel ? " is-sel" : ""), "data-idx": idx,
        role: "button", tabIndex: 0, "aria-label": (p.title || "Artigo sem título") + " — " + LABEL[st],
        onClick: function () { self.select(idx); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.select(idx); } }
      },
        h("div", { className: "th", style: img ? { backgroundImage: "url(" + JSON.stringify(img) + ")" } : null }, img ? null : "sem capa"),
        h("b", null, p.title || "Sem título"),
        h("div", { className: "pdb-meta" },
          p.category ? h("span", null, p.category) : null,
          p.readMinutes ? h("span", null, p.readMinutes + " min") : null,
          dateLine ? h("span", null, dateLine) : null),
        (isFeatured || flags.length || p.url) ? h("div", { className: "pdb-flags" },
          isFeatured ? h("span", { className: "pdb-flag ok" }, "destaque do blog") : null,
          p.url ? h("span", { className: "pdb-flag muted", title: "Tem página própria em " + p.url }, "página própria") : null,
          flags.slice(0, 3).map(function (f) { return h("span", { key: f, className: "pdb-flag" }, f); }),
          flags.length > 3 ? h("span", { className: "pdb-flag" }, "+" + (flags.length - 3)) : null) : null);
    },

    renderBoard: function (items) {
      var self = this;
      var q = this.state.q.trim().toLowerCase(), cat = this.state.cat;
      var cats = {};
      items.forEach(function (p) { if (p.category) cats[p.category] = (cats[p.category] || 0) + 1; });
      var byCol = {};
      COLS.forEach(function (c) { byCol[c.k] = []; });
      items.forEach(function (p, i) {
        if (q && (p.title + " " + p.category + " " + p.slug).toLowerCase().indexOf(q) === -1) return;
        if (cat && p.category !== cat) return;
        byCol[statusOf(p)].push(i);
      });
      // Mesma ordem do site: mais recente primeiro (o blog ordena pela data).
      Object.keys(byCol).forEach(function (k) {
        byCol[k].sort(function (a, b) { var da = day(items[a].date), db = day(items[b].date); return da === db ? a - b : (da < db ? 1 : -1); });
      });
      this.cols = byCol;
      var featured = byCol.publicado.concat(byCol.agendado).filter(function (i) { return isLive(items[i]); })
        .sort(function (a, b) { return day(items[a].date) < day(items[b].date) ? 1 : -1; })[0];
      var chip = function (value, label) {
        return h("button", { key: value || "all", type: "button", className: "pdb-chip", "aria-pressed": String(cat === value), onClick: function () { self.setState({ cat: cat === value ? "" : value }); } }, label);
      };
      var hasDrawer = this.state.sel >= 0 && !!items[this.state.sel];
      return h("div", { className: "pdb-boardwrap" + (hasDrawer ? " has-drawer" : "") },
        h("div", { className: "pdb-filters" }, [chip("", "Todas")].concat(Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }).map(function (c) { return chip(c, c + " · " + cats[c]); }))),
        h("div", { className: "pdb-board" }, COLS.map(function (c) {
          var list = byCol[c.k];
          return h("section", { key: c.k, className: "pdb-col", "aria-label": c.label },
            h("div", { className: "pdb-col-h" },
              h("div", null, h("i", { style: { background: c.color } }), h("b", null, c.label), h("em", null, list.length)),
              h("small", null, c.hint)),
            h(K.SortableList, {
              key: c.k, listKey: c.k, group: "pdb-posts", sort: false, className: "pdb-cards", filter: ".pdb-empty",
              onSort: function (e) {
                var idx = self.cols[e.from][e.oldIndex];
                if (idx === undefined || e.from === e.to) return;
                self.moveTo(idx, e.to);
              }
            }, list.length ? list.map(function (i) { return self.renderCard(items[i], i, i === featured); })
              : [h("div", { key: "empty", className: "pdb-empty", "data-empty": "1" }, "Arraste um artigo pra cá")]));
        })),
        this.state.sel >= 0 && items[this.state.sel] ? this.renderDrawer(items, this.state.sel) : null);
    },

    // --- gaveta com os dados do artigo ----------------------------------------
    field: function (id, label, input, msg, msgKind) {
      return h("div", { className: "pds-field", key: id },
        h("label", { htmlFor: id }, label), input,
        msg ? h("p", { className: "pdb-msg " + (msgKind || "") }, msg) : null);
    },

    renderDrawer: function (items, idx) {
      var self = this;
      var p = items[idx];
      var st = statusOf(p);
      var today = todayISO();
      var dupSlug = p.slug && items.some(function (o, i) { return i !== idx && o.slug === p.slug; });
      var img = K.assetUrl(this.props, p.image);
      var flags = issues(p);
      var cats = Object.keys(items.reduce(function (a, o) { if (o.category) a[o.category] = 1; return a; }, {})).sort();
      var dateMsg = null, dateKind = "";
      if (st === "agendado") {
        if (!p.date) { dateMsg = "Escolha o dia em que ele entra no ar."; dateKind = "warn"; }
        else if (day(p.date) <= today) { dateMsg = "Essa data já chegou: ele fica no ar assim que você publicar."; dateKind = "warn"; }
        else { dateMsg = "Entra no ar sozinho em " + fmt(p.date) + "."; dateKind = "ok"; }
      } else if (st === "publicado" && p.date && day(p.date) > today) {
        dateMsg = "Data futura num artigo “No ar”: ele já aparece, e fica no topo do blog até lá."; dateKind = "warn";
      }
      var mins = Math.max(1, Math.round(words(p.body) / 200));
      return h("aside", { className: "pdb-drawer", "aria-label": "Dados do artigo" },
        h("div", { className: "pdb-drawer-h" },
          h("h3", null, p.title || "Artigo novo"),
          h("button", { type: "button", className: "pds-x", "aria-label": "Fechar dados do artigo", onClick: function () { self.select(-1); } }, "×")),
        h("div", { className: "pdb-drawer-b" },
          h("div", { className: "pds-field" },
            h("span", { className: "pds-label" }, "Etapa"),
            h("div", { className: "pdb-seg", role: "group", "aria-label": "Etapa do artigo" }, COLS.map(function (c) {
              return h("button", { key: c.k, type: "button", "aria-pressed": String(st === c.k), onClick: function () { self.moveTo(idx, c.k); } }, h("i", { style: { background: c.color } }), c.label);
            }))),
          this.field("pdb-title", "Título", h("input", { id: "pdb-title", className: "pds-input" + (p.title ? "" : " pdb-input-err"), value: p.title || "", placeholder: "Sobre o que é o artigo?",
            onChange: function (e) {
              var v = e.target.value;
              if (self.freshSlug != null && p.slug === self.freshSlug) {
                var sl = K.slugify(v);
                self.freshSlug = sl;
                self.change(function (it) { it[idx].title = v; it[idx].slug = sl; });
              } else self.set("title", v);
            } })),
          this.field("pdb-excerpt", "Resumo (aparece no card do blog)", h("textarea", { id: "pdb-excerpt", className: "pds-input", rows: 3, value: p.excerpt || "", onChange: function (e) { self.set("excerpt", e.target.value); } }),
            (p.excerpt || "").length + " caracteres" + ((p.excerpt || "").length > 180 ? " · no card, textos longos ficam cortados" : ""), (p.excerpt || "").length > 180 ? "warn" : ""),
          h("div", { className: "pds-grid2" },
            this.field("pdb-cat", "Categoria (filtros do blog)", h("input", { id: "pdb-cat", className: "pds-input", list: "pdb-cats", value: p.category || "", onChange: function (e) { self.set("category", e.target.value); } })),
            this.field("pdb-read", "Tempo de leitura (min)", h("div", { className: "pds-row", style: { flexWrap: "nowrap" } },
              h("input", { id: "pdb-read", className: "pds-input", inputMode: "numeric", value: p.readMinutes == null ? "" : String(p.readMinutes),
                onChange: function (e) { var n = parseInt(e.target.value, 10); self.set("readMinutes", isNaN(n) ? undefined : n); } }),
              !p.url && p.body ? h("button", { type: "button", className: "pds-btn sm", title: "Calcula pelo tamanho do texto (200 palavras por minuto)", onClick: function () { self.set("readMinutes", mins); } }, "≈ " + mins) : null))),
          h("datalist", { id: "pdb-cats" }, cats.map(function (c) { return h("option", { key: c, value: c }); })),
          h("div", { className: "pds-field" },
            h("span", { className: "pds-label" }, "Foto de capa · 1600×900, bem horizontal"),
            h("div", { className: "pds-img pdb-cover" + (img ? " has" : ""), role: "button", tabIndex: 0, style: img ? { backgroundImage: "url(" + JSON.stringify(img) + ")" } : null,
              onClick: function () { K.Media.open(self, "cover:" + idx, p.image); },
              onKeyDown: function (e) { if (e.key === "Enter") K.Media.open(self, "cover:" + idx, p.image); } }, img ? null : "Escolher foto"),
            h("label", { className: "pds-row", style: { gap: "8px", fontSize: "12.5px", color: "#2B2B2B" } },
              h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(p.showCoverInArticle !== false), "aria-label": "Mostrar a capa no topo do artigo",
                onClick: function () { self.set("showCoverInArticle", p.showCoverInArticle === false); } }),
              "Mostrar a capa no topo do artigo")),
          this.renderCoverFields(p, items, idx),
          this.renderMx(p),
          h("div", { className: "pds-grid2" },
            this.field("pdb-date", "Data de publicação", h("input", { id: "pdb-date", type: "date", className: "pds-input" + (st === "agendado" && (!p.date || day(p.date) <= today) ? " pdb-input-err" : ""), value: day(p.date),
              onChange: function (e) { self.set("date", e.target.value); } })),
            this.field("pdb-upd", "Última atualização", h("div", { className: "pds-row", style: { flexWrap: "nowrap" } },
              h("input", { id: "pdb-upd", type: "date", className: "pds-input", value: day(p.updatedDate), onChange: function (e) { self.set("updatedDate", e.target.value || undefined); } }),
              h("button", { type: "button", className: "pds-btn sm", title: "Revisou o conteúdo? Marque a data de hoje", onClick: function () { self.set("updatedDate", today); } }, "hoje")))),
          dateMsg ? h("p", { className: "pdb-msg " + dateKind }, dateMsg) : null,
          this.field("pdb-slug", "Endereço (slug)", h("input", { id: "pdb-slug", className: "pds-input" + (dupSlug || !p.slug ? " pdb-input-err" : ""), value: p.slug || "", style: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: "12.5px" },
            onChange: function (e) { self.freshSlug = null; self.set("slug", K.slugify(e.target.value)); } }),
            dupSlug ? "Outro artigo já usa esse endereço." : (isLive(p) ? "Mudar o endereço de um artigo no ar quebra os links que já foram compartilhados." : "/artigos/post/?slug=" + (p.slug || "…")), dupSlug ? "err" : (isLive(p) ? "warn" : "")),
          p.url ? h("p", { className: "pdb-msg" }, "Este artigo tem página própria (", h("code", null, p.url), "). O texto dela está no HTML fixo; o que muda aqui é o card, a data e a etapa.") : null,
          h("div", { className: "pdb-checks", "aria-label": "O que falta" },
            flags.length ? flags.map(function (f) { return h("span", { key: f }, h("b", { style: { color: "#B07A1E" } }, "•"), f); })
              : [h("span", { key: "ok" }, h("b", { style: { color: "#577328" } }, "✓"), "Tudo certo pra ir pro ar")],
            !p.url && flags.some(function (f) { return /FAQ|Feedback/.test(f); }) ? h("small", { style: { color: "#6E6862", fontSize: "11.5px" } }, "Regra do site: todo artigo termina com um bloco FAQ e um de Feedback (no editor visual, pelo +).") : null),
          h("div", { className: "pdb-actions" },
            !p.url ? h("button", { type: "button", className: "pds-btn primary", onClick: function () { self.editBody(idx); } }, "Editar o texto →") : null,
            h("button", { type: "button", className: "pds-btn", onClick: function () { self.setState({ view: "artigo", tab: "previa" }); } }, "Ver prévia")),
          h("p", { className: "pdb-msg" }, "Galerias, cabeçalho e rodapé deste artigo continuam no formulário do artigo, embaixo do quadro."),
          this.state.confirmDelete
            ? h("div", { className: "pds-row" }, h("span", { style: { fontSize: "12.5px" } }, "Apagar de vez este artigo?"),
                h("button", { type: "button", className: "pds-btn danger sm", onClick: function () { self.remove(idx); } }, "Apagar"),
                h("button", { type: "button", className: "pds-btn ghost sm", onClick: function () { self.setState({ confirmDelete: false }); } }, "Cancelar"))
            : h("button", { type: "button", className: "pds-btn danger sm", style: { alignSelf: "flex-start" }, onClick: function () { self.setState({ confirmDelete: true }); } }, "Apagar artigo…")));
    },


    renderCoverFields: function (p, items, idx) {
      var self = this;
      var kw = String(p.coverKeyword || "");
      var tags = Array.isArray(p.coverTags) ? p.coverTags.map(function (t) { return t && t.tag != null ? t.tag : t; }) : [];
      var pil = window.PDCover ? window.PDCover.pillarOf(p.category) : "";
      var dup = kw && window.PDCover ? items.filter(function (o, i) { return i !== idx && String(o.coverKeyword || "").toLowerCase() === kw.toLowerCase() && window.PDCover.pillarOf(o.category) === pil; })[0] : null;
      var FORMATS = ["Guia", "Passo a passo", "Comparativo", "Mapa", "Roteiro", "Checklist", "Série · ep. 1", "Série · ep. 2", "Série · ep. 3", "Série · ep. 4", "Série · ep. 5"];
      return h("div", { className: "pds-field", key: "cover-kw" },
        h("span", { className: "pds-label" }, "Capa por palavra-chave" + (window.PDCover && p.category ? " · pilar " + window.PDCover.PILLARS[pil].name : "")),
        kw && window.PDCover ? h("div", { className: "pdb-cover-prev", dangerouslySetInnerHTML: { __html: window.PDCover.html(p) } }) : null,
        h("div", { className: "pds-grid2" },
          this.field("pdb-kw", "Palavra (até 10)", h("input", { id: "pdb-kw", className: "pds-input" + (kw.length > 10 || dup ? " pdb-input-err" : ""), value: kw, onChange: function (e) { self.set("coverKeyword", e.target.value); } }),
            dup ? "Já é a capa de “" + (dup.title || "outro artigo") + "” no mesmo pilar." : kw.length > 10 ? kw.length + " caracteres: use sigla ou termo mais curto." : null, dup || kw.length > 10 ? "err" : ""),
          this.field("pdb-fmt", "Formato", h("select", { id: "pdb-fmt", className: "pds-input", value: p.coverFormat || "Guia", onChange: function (e) { self.set("coverFormat", e.target.value); } },
            FORMATS.map(function (f) { return h("option", { key: f, value: f }, f); })))),
        this.field("pdb-tags", "3 palavras de apoio (separe com vírgula)", h("input", { id: "pdb-tags", className: "pds-input", value: tags.join(", "),
          onChange: function (e) { self.set("coverTags", e.target.value.split(",").map(function (x) { return x.replace(/^\s+/, ""); }).slice(0, 3)); } })));
    },
    renderMx: function (p) {
      var self = this;
      var body = p.url ? p.mxBlocks || "" : p.body || "";
      var parts = p.url ? MX_PARTS.filter(function (m) { return !/FAQ|Feedback/.test(m.label); }) : MX_PARTS;
      return h("div", { className: "pds-field", key: "mx" },
        h("span", { className: "pds-label" }, "Microengajamento"),
        p.url ? h("p", { className: "pdb-msg" }, "Página própria: os blocos ficam no campo “Blocos de microengajamento”, no formulário embaixo do quadro.") : null,
        h("div", { className: "pdb-ck", style: { marginTop: 0 } }, parts.map(function (m, i) {
          var on = m.re.test(body);
          return h("span", { key: i }, h("i", { style: { background: on ? "#577328" : m.need ? "#B07A1E" : "#CFC7BA" } }, on ? "✓" : m.need ? "!" : "–"), m.label);
        })),
        h("label", { className: "pds-row", style: { gap: "8px", fontSize: "12.5px", color: "#2B2B2B" } },
          p.url ? null : h("button", { type: "button", role: "switch", className: "pds-switch", "aria-checked": String(!!p.sectionReactions), "aria-label": "Perguntar se cada seção ficou clara",
            onClick: function () { self.set("sectionReactions", !p.sectionReactions); } }),
          p.url ? null : "“Essa parte ficou clara?” em cada seção"),
        p.editorNotes ? h("details", null, h("summary", { style: { cursor: "pointer", fontSize: "12.5px" } }, "Notas do robô (propostas que não entraram)"), h("div", { className: "pdb-notes" }, p.editorNotes)) : null);
    },

    renderPreview: function (items) {
      var self = this;
      var p = this.state.sel >= 0 ? items[this.state.sel] : null;
      var view = p && this.state.view === "artigo" ? "artigo" : "blog";
      var url = view === "artigo" && p.slug ? (p.url || "/artigos/post/?slug=" + encodeURIComponent(p.slug)) : "/artigos/";
      var tab = function (k, label, disabled) {
        return h("button", { key: k, type: "button", disabled: disabled, "aria-pressed": String(view === k), onClick: function () { self.setState({ view: k }); } }, label);
      };
      return h("section", { className: "pdb-prev", "aria-label": "Prévia" },
        h(K.Preview, {
          url: url, device: this.state.device, version: this.state.version,
          onDevice: function (d) { self.setState({ device: d }); },
          extra: h("div", { className: "pds-tabs" }, tab("blog", "Blog"), tab("artigo", "Artigo", !p || !p.slug))
        }));
    },

    renderOverlay: function () {
      var self = this;
      var items = this.items();
      var live = items.filter(isLive).length;
      var sched = items.filter(function (p) { return p.status === "agendado" && !isLive(p); }).length;
      var mtab = function (k, label) { return h("button", { key: k, type: "button", "aria-pressed": String(self.state.tab === k), onClick: function () { self.setState({ tab: k }); } }, label); };
      return h("div", { className: "pdb", role: "dialog", "aria-modal": "true", "aria-label": "Quadro de artigos" },
        h("div", { className: "pdb-top" },
          h("div", { className: "pdb-brand" }, h("i", null, "A"),
            h("div", { style: { minWidth: 0 } }, h("b", null, "Artigos"), h("small", null, live + " no ar · " + sched + " agendado(s) · arraste entre as colunas pra mudar a etapa"))),
          h("input", { className: "pds-input pdb-search", type: "search", placeholder: "Buscar artigo…", "aria-label": "Buscar artigo", value: this.state.q, onChange: function (e) { self.setState({ q: e.target.value }); } }),
          h("button", { type: "button", className: "pds-btn", onClick: this.newPost }, "+", h("span", { className: "pdb-new-label" }, " Novo artigo")),
          h("button", { type: "button", className: "pds-btn", onClick: this.openRobot, title: "Colar o pacote que o robô escreveu" }, "🧠", h("span", { className: "pdb-new-label" }, " Colar do robô")),
          h("button", { type: "button", className: "pds-btn ghost sm pdb-toggle-prev", "aria-pressed": String(this.state.showPrev), onClick: function () { self.setState({ showPrev: !self.state.showPrev }); } }, this.state.showPrev ? "Esconder prévia" : "Mostrar prévia"),
          h("button", { type: "button", className: "pds-btn ghost sm", onClick: this.undo, disabled: !(this.history && this.history.length), title: "Desfazer a última mudança" }, "↶", h("span", { className: "pdb-new-label" }, " Desfazer")),
          h("button", { type: "button", className: "pds-btn primary", onClick: this.close }, "Concluir")),
        h("div", { className: "pdb-mtabs" }, h("div", { className: "pds-tabs" }, mtab("quadro", "Quadro"), mtab("previa", "Ver prévia"))),
        h("div", { className: "pdb-app" + (this.state.showPrev || window.innerWidth < 1100 ? "" : " no-prev"), "data-tab": this.state.tab },
          this.renderBoard(items), this.renderPreview(items)),
        this.state.toast ? h("div", { className: "pdb-toast", role: "status" },
          h("span", null, this.state.toast.text),
          this.state.toast.undo ? h("button", { type: "button", onClick: this.undo }, "Desfazer") : null) : null,
        this.state.robot ? this.renderRobot(items) : null);
    },

    render: function () {
      var self = this;
      var items = this.items();
      var counts = COLS.map(function (c) { return c.label + ": " + items.filter(function (p) { return statusOf(p) === c.k; }).length; });
      var bar = h("div", { className: "pdb-bar" },
        h("span", null, counts.join(" · ")),
        h("button", { type: "button", className: "pds-btn primary", onClick: this.open }, "Abrir quadro de artigos"));
      var list = ListControl
        ? h("div", { ref: function (el) { self.listWrap = el; } },
            h(ListControl, Object.assign({}, this.props, { key: "list-" + this.state.listKey, ref: function (c) { self.listInst = c; } })))
        : null;
      return h("div", null, bar, list, this.state.open ? this.renderOverlay() : null);
    }
  });

  var BoardPreview = ListPreview || createClass({ render: function () { return null; } });

  CMS.registerWidget("posts-board", BoardControl, BoardPreview);
})();
