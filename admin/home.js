// Início do /admin ("Estúdio") — a tela de entrada do painel, no lugar da
// lista de coleções do Decap: menu agrupado (Conteúdo, Vitrine, Site,
// Acompanhar), "Hoje" com o que pede atenção (calculado dos arquivos de
// content/ e das avaliações pendentes), o próximo artigo agendado, as
// últimas mudanças (histórico do GitHub) e atalhos. "Ir para…" (⌘K / Ctrl+K)
// procura telas e artigos.
//
// Não muda nada no Decap: cada item do menu abre a mesma coleção de sempre
// (#/collections/<coleção>/entries/<arquivo>) e já abre o estúdio dela. A
// seta "←" do Decap volta pra cá. "Lista clássica" (no pé do menu) mostra a
// tela antiga do Decap até fechar a aba.
//
// Só lê: nada aqui grava arquivo. Publicar continua sendo o botão de cada tela.
(function () {
  var REPO = "ingrydlts/ingrydlts.github.io";
  var WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";

  // --- ícones (traço simples) -------------------------------------------------
  var ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    cols: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="6" rx="1.5"/>',
    map: '<path d="M4 5h16M4 10h10M4 15h16M4 20h8"/>',
    megaphone: '<path d="M3 10v4h4l6 4V6L7 10H3z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h7"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-9 9"/>',
    link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>',
    cookie: '<circle cx="12" cy="12" r="9"/><path d="M8.5 9.5v.01M14 8v.01M15.5 14v.01M9.5 15v.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9L12 3z"/>',
    hands: '<path d="M8 12l3 3 5-5"/><circle cx="12" cy="12" r="9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v6H4V5h6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
  };
  function icon(name) {
    return '<svg class="pdh-i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  // --- menu ------------------------------------------------------------------
  // open: texto do botão do estúdio dentro da coleção (clicado sozinho).
  var NAV = [
    { group: "Conteúdo" },
    { id: "artigos", label: "Artigos", icon: "cols", c: "posts", e: "posts", open: "Abrir quadro de artigos" },
    { id: "vitrine-artigo", label: "Banners nos artigos", icon: "map", c: "vitrine_artigo", e: "vitrine_artigo", open: "Abrir mapa do artigo" },
    { id: "anuncios", label: "Anúncios nos artigos", icon: "megaphone", c: "ads_config", e: "ads_config", open: "Abrir mapa do artigo" },
    { group: "Vitrine" },
    { id: "produtos", label: "Produtos digitais", icon: "bag", c: "produtos_digitais", e: "produtos_digitais", open: "Abrir estúdio de produtos" },
    { id: "estudo", label: "Produtos de estudo", icon: "book", c: "produtos_estudo", e: "produtos_estudo" },
    { id: "compras", label: "Produtos de compras", icon: "tag", c: "produtos_compras", e: "produtos_compras" },
    { id: "banners", label: "Banners e destaques", icon: "image", c: "banners", e: "banners", open: "Abrir banners e destaques" },
    { group: "Site" },
    { id: "bio", label: "Link na bio", icon: "link", c: "links_page", e: "links_page", open: "Abrir estúdio da Link na bio" },
    { id: "menu", label: "Menu do site", icon: "menu", c: "header_config", e: "header_config", open: "Abrir estúdio do menu" },
    { id: "paginas", label: "Cabeçalho e rodapé", icon: "layout", c: "nav_visibility", e: "nav_visibility", open: "Abrir estúdio de cabeçalho e rodapé" },
    { id: "quiz", label: "Questionário VIP", icon: "quiz", c: "quiz_config", e: "quiz_config" },
    { id: "cookies", label: "Consentimento e cookies", icon: "cookie", c: "analytics_config", e: "analytics_config" },
    { group: "Acompanhar" },
    { id: "numeros", label: "Números", icon: "chart", href: "/admin/dashboard/" },
    { id: "avaliacoes", label: "Avaliações", icon: "star", href: "/admin/avaliacoes/" },
    { id: "parcerias", label: "Parcerias", icon: "hands", href: "/admin/parcerias/" }
  ];
  var BY_ID = {};
  NAV.forEach(function (n) { if (n.id) BY_ID[n.id] = n; });

  // --- estilos ---------------------------------------------------------------
  var CSS = [
    ".pdh{--bg:#F4F1EC;--surface:#FBFAF7;--surface-2:#EFEBE4;--ink:#2B2B2B;--muted:#6E6862;--faint:#9A938A;--line:#E2DCD2;--line-strong:#CFC7BA;--accent:#577328;--accent-ink:#FBFAF7;--accent-soft:#E7ECDC;--accent-text:#4A6222;--warn:#A8741A;--warn-soft:#F6ECD6;--bad:#A63A2E;--bad-soft:#F5E1DD;--merlot:#501318;--shadow:0 1px 2px rgba(43,35,25,.06),0 6px 20px -10px rgba(43,35,25,.18);}",
    ".pdh[data-theme=dark]{color-scheme:dark;--bg:#171614;--surface:#211F1C;--surface-2:#2A2723;--ink:#EEE9E1;--muted:#A8A095;--faint:#7C756C;--line:#35312C;--line-strong:#4A453E;--accent:#9DB86A;--accent-ink:#1A1D12;--accent-soft:#2A3220;--accent-text:#B5CE86;--warn:#E0B060;--warn-soft:#3A301C;--bad:#E48A7C;--bad-soft:#3E2521;--shadow:0 1px 2px rgba(0,0,0,.4),0 6px 20px -10px rgba(0,0,0,.6);}",
    ".pdh{position:fixed;inset:0;z-index:99990;background:var(--bg);color:var(--ink);font:14px/1.5 'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;display:grid;grid-template-columns:236px minmax(0,1fr);}",
    ".pdh[hidden]{display:none;}",
    ".pdh *,.pdh *::before,.pdh *::after{box-sizing:border-box;}",
    ".pdh button,.pdh input{font:inherit;color:inherit;}",
    ".pdh button{cursor:pointer;}",
    ".pdh :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px;}",
    ".pdh h1,.pdh h2,.pdh h3{font-family:'Fraunces',Georgia,serif;font-weight:600;letter-spacing:-.01em;margin:0;color:var(--ink);}",
    ".pdh-i{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}",
    ".pdh-rail{background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:18px 12px;gap:2px;overflow-y:auto;min-height:0;}",
    ".pdh-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 14px;}",
    ".pdh-mark{width:34px;height:34px;border-radius:10px;background:var(--merlot);color:#F4F1EC;display:grid;place-items:center;font:700 17px 'Fraunces',Georgia,serif;flex:none;}",
    ".pdh-brand b{font:600 16px/1.1 'Fraunces',Georgia,serif;display:block;}",
    ".pdh-brand span{font-size:11.5px;color:var(--muted);}",
    ".pdh-group{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:600;padding:14px 10px 4px;}",
    ".pdh-nav{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:8px 10px;border-radius:9px;color:var(--muted);font-weight:500;text-align:left;text-decoration:none;}",
    ".pdh-nav:hover{background:var(--surface-2);color:var(--ink);}",
    ".pdh-nav[aria-current=page]{background:var(--accent-soft);color:var(--accent-text);font-weight:600;}",
    ".pdh-nav .n{margin-left:auto;font:11px ui-monospace,Menlo,monospace;background:var(--surface-2);border-radius:20px;padding:0 7px;color:var(--muted);}",
    ".pdh-nav .n.warn{background:var(--warn-soft);color:var(--warn);}",
    ".pdh-foot{margin-top:auto;padding:12px 8px 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px;}",
    ".pdh-foot button,.pdh-foot a{border:0;background:none;padding:4px 2px;color:var(--muted);font-size:12px;text-align:left;text-decoration:none;display:flex;gap:6px;align-items:center;}",
    ".pdh-foot button:hover,.pdh-foot a:hover{color:var(--ink);}",
    ".pdh-foot .pdh-i{width:15px;height:15px;}",
    ".pdh-main{min-width:0;min-height:0;display:flex;flex-direction:column;}",
    ".pdh-top{display:flex;align-items:center;gap:10px;padding:12px 24px;padding-top:calc(12px + env(safe-area-inset-top));border-bottom:1px solid var(--line);background:var(--bg);flex-shrink:0;}",
    ".pdh-crumb{min-width:0;flex:1;}",
    ".pdh-crumb small{display:block;font-size:11.5px;color:var(--muted);}",
    ".pdh-crumb h1{font-size:21px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdh-search{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 10px;color:var(--muted);}",
    ".pdh-search kbd{font:11px ui-monospace,Menlo,monospace;border:1px solid var(--line);border-radius:5px;padding:0 5px;}",
    ".pdh-sq{border:1px solid var(--line);background:var(--surface);border-radius:10px;width:38px;height:38px;display:grid;place-items:center;color:var(--muted);flex:none;text-decoration:none;}",
    ".pdh-sq:hover,.pdh-search:hover{color:var(--ink);border-color:var(--line-strong);}",
    ".pdh-site{display:flex;align-items:center;gap:7px;border:0;border-radius:10px;padding:9px 14px;background:var(--surface-2);color:var(--ink);font-weight:600;text-decoration:none;white-space:nowrap;}",
    ".pdh-site:hover{background:var(--line);}",
    ".pdh-view{flex:1;min-height:0;overflow-y:auto;padding:24px 24px 90px;}",
    ".pdh-today{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:18px;max-width:1180px;}",
    ".pdh-col{display:flex;flex-direction:column;gap:14px;min-width:0;}",
    ".pdh-eyebrow{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600;}",
    ".pdh-hello h2{font-size:28px;margin-top:6px;}",
    ".pdh-hello p{margin:6px 0 0;color:var(--muted);}",
    ".pdh-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);}",
    ".pdh-card-h{padding:12px 16px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600;display:flex;justify-content:space-between;gap:8px;}",
    ".pdh-card-h a,.pdh-card-h button{border:0;background:none;color:var(--accent-text);font-size:12px;letter-spacing:0;text-transform:none;text-decoration:none;padding:0;}",
    ".pdh-task{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--line);}",
    ".pdh-task:last-child{border-bottom:0;}",
    ".pdh-task .ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--surface-2);color:var(--muted);}",
    ".pdh-task.warn .ic{background:var(--warn-soft);color:var(--warn);}",
    ".pdh-task.bad .ic{background:var(--bad-soft);color:var(--bad);}",
    ".pdh-task.ok .ic{background:var(--accent-soft);color:var(--accent-text);}",
    ".pdh-task .tt{flex:1;min-width:0;}",
    ".pdh-task b{display:block;font-size:14px;}",
    ".pdh-task small{display:block;color:var(--muted);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".pdh-btn{border:1px solid var(--line-strong);background:var(--surface);border-radius:9px;padding:6px 12px;font-weight:500;font-size:13px;white-space:nowrap;text-decoration:none;color:var(--ink);}",
    ".pdh-btn:hover{border-color:var(--ink);}",
    ".pdh-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}",
    ".pdh-quick button{border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:14px;text-align:left;display:flex;flex-direction:column;gap:8px;font-weight:600;font-size:13.5px;box-shadow:var(--shadow);}",
    ".pdh-quick button:hover{border-color:var(--accent);}",
    ".pdh-quick .pdh-i{color:var(--accent-text);}",
    ".pdh-next{display:flex;gap:12px;align-items:center;padding:14px 16px;border:0;background:none;width:100%;text-align:left;}",
    ".pdh-next .ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-text);flex:none;}",
    ".pdh-next b{display:block;font-size:14px;}",
    ".pdh-next small{color:var(--muted);font-size:12.5px;}",
    ".pdh-pipe{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--line);border-radius:0 0 14px 14px;overflow:hidden;}",
    ".pdh-pipe button{border:0;background:var(--surface);padding:10px 6px;text-align:center;display:flex;flex-direction:column;gap:2px;}",
    ".pdh-pipe button:hover{background:var(--surface-2);}",
    ".pdh-pipe b{font:600 20px 'Fraunces',Georgia,serif;}",
    ".pdh-pipe span{font-size:11px;color:var(--muted);}",
    ".pdh-feed div{display:flex;gap:10px;padding:9px 16px;font-size:13px;border-bottom:1px solid var(--line);}",
    ".pdh-feed div:last-child{border-bottom:0;}",
    ".pdh-feed time{font:11px ui-monospace,Menlo,monospace;color:var(--faint);width:52px;flex:none;padding-top:2px;}",
    ".pdh-note{font-size:12px;color:var(--faint);font-style:italic;margin:0;}",
    ".pdh-empty{padding:14px 16px;color:var(--muted);font-size:13px;}",
    ".pdh-sk{height:14px;border-radius:6px;background:linear-gradient(90deg,var(--surface-2),var(--line),var(--surface-2));background-size:200% 100%;animation:pdhsk 1.2s linear infinite;margin:14px 16px;}",
    "@keyframes pdhsk{to{background-position:-200% 0}}",
    // Ir para…
    ".pdh-pal-bg{position:fixed;inset:0;z-index:99995;background:rgba(20,16,14,.4);display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;}",
    ".pdh-pal{width:min(560px,100%);background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5);overflow:hidden;font:14px/1.5 'Inter',-apple-system,sans-serif;}",
    ".pdh-pal input{width:100%;border:0;border-bottom:1px solid var(--line);padding:14px 16px;font-size:15px;background:transparent;outline:none;color:var(--ink);}",
    ".pdh-pal ul{list-style:none;margin:0;padding:6px;max-height:50vh;overflow-y:auto;}",
    ".pdh-pal li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;}",
    ".pdh-pal li small{margin-left:auto;color:var(--faint);font-size:11.5px;}",
    ".pdh-pal li[aria-selected=true]{background:var(--accent-soft);color:var(--accent-text);}",
    // abrindo o estúdio
    ".pdh-going{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99996;background:#2B2B2B;color:#fff;border-radius:12px;padding:10px 16px;font:13px 'Inter',sans-serif;box-shadow:0 12px 30px -12px rgba(0,0,0,.5);}",
    // celular
    ".pdh-tabbar{display:none;}",
    "@media (max-width:900px){",
    "  .pdh{grid-template-columns:minmax(0,1fr);}",
    "  .pdh-rail{position:fixed;inset:0 auto 0 0;width:min(290px,86vw);z-index:5;transform:translateX(-105%);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.25);}",
    "  .pdh.rail-open .pdh-rail{transform:none;}",
    "  .pdh-scrim{position:fixed;inset:0;background:rgba(20,16,14,.35);z-index:4;}",
    "  .pdh-today{grid-template-columns:minmax(0,1fr);}",
    "  .pdh-quick button{padding:10px;font-size:12.5px;gap:6px;}",
    "  .pdh-top{padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));}",
    "  .pdh-view{padding:16px 16px 100px;}",
    "  .pdh-search span,.pdh-search kbd,.pdh-site span{display:none;}",
    "  .pdh-hello h2{font-size:24px;}",
    "  .pdh-tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:3;background:var(--surface);border-top:1px solid var(--line);padding:6px 6px calc(6px + env(safe-area-inset-bottom));justify-content:space-around;}",
    "  .pdh-tabbar button{border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10.5px;color:var(--muted);padding:4px 6px;border-radius:10px;flex:1;min-width:0;}",
    "  .pdh-tabbar button[aria-current=page]{color:var(--accent-text);background:var(--accent-soft);}",
    "}",
    "@media (min-width:901px){.pdh-scrim,.pdh-burger{display:none;}}",
    "@media (prefers-reduced-motion:reduce){.pdh *{animation:none!important;transition:none!important;}}",
    "html.pdh-open,html.pdh-open body{overflow:hidden!important;}"
  ].join("\n");

  // --- dados -----------------------------------------------------------------
  function decapUser() {
    try { return JSON.parse(localStorage.getItem("decap-cms-user") || "null"); } catch (e) { return null; }
  }
  function token() { var u = decapUser(); return u && u.token; }

  // Arquivo do repositório: pela API do GitHub (versão mais nova, sem o cache
  // do site) quando há login; senão, o arquivo publicado.
  function content(path) {
    var t = token();
    var viaSite = function () { return fetch("/" + path, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); }); };
    if (!t) return viaSite();
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + path + "?ref=main", {
      headers: { Authorization: "token " + t, Accept: "application/vnd.github.raw+json" }, cache: "no-store"
    }).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); }).catch(viaSite);
  }

  function todayISO() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function day(s) { return s ? String(s).slice(0, 10) : ""; }
  function isLive(p) {
    if (p.status === "publicado") return true;
    if (p.status === "agendado") return !!p.date && day(p.date) <= todayISO();
    if (!p.status) return p.published === true;
    return false;
  }
  function fmtDay(iso) {
    var d = new Date(day(iso) + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  }
  function rel(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d)) return "";
    var now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((a - b) / 86400000);
    if (diff <= 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (diff === 1) return "ontem";
    if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  function daysAgo(dateStr) {
    var d = new Date(dateStr);
    return isNaN(d) ? null : Math.max(0, Math.floor((Date.now() - d) / 86400000));
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // Mensagens de commit do Decap ("Update Coleção “arquivo”") em português.
  function commitText(msg) {
    var line = String(msg || "").split("\n")[0];
    var m = line.match(/^(Update|Create|Delete|Upload|Publish)\s+(.*?)\s*“([^”]*)”/);
    if (m) {
      var verb = { Update: "Atualizou", Create: "Criou", Delete: "Apagou", Upload: "Enviou", Publish: "Publicou" }[m[1]];
      return verb + " <b>" + esc(m[2] || m[3]) + "</b>";
    }
    return esc(line.length > 90 ? line.slice(0, 88) + "…" : line);
  }

  // O que pede atenção, do mais sério pro mais leve.
  function buildTasks(d) {
    var tasks = [];
    var posts = (d.posts && d.posts.items) || [];
    if (d.reviews && d.reviews.pending && d.reviews.pending.length) {
      var pend = d.reviews.pending, age = daysAgo(pend[0].createdAt);
      tasks.push({ kind: "warn", icon: "star", title: plural(pend.length, "avaliação esperando aprovação", "avaliações esperando aprovação"),
        sub: age == null ? "Aprove ou recuse em Avaliações" : age === 0 ? "A mais antiga chegou hoje" : "A mais antiga chegou há " + plural(age, "dia", "dias"), btn: "Revisar", go: "avaliacoes" });
    }
    var ads = d.ads || {};
    var P = ads.positions || {};
    if (ads.enabled && (P.top === "network" || P.mid === "network") && !(ads.network && ads.network.adSnippet)) {
      tasks.push({ kind: "bad", icon: "alert", title: "Anúncio de rede sem código", sub: "A posição existe, mas o código da rede não foi colado", btn: "Resolver", go: "anuncios" });
    }
    if (ads.enabled && (P.top === "own" || P.mid === "own") && !(ads.ownBanner && ads.ownBanner.title)) {
      tasks.push({ kind: "bad", icon: "alert", title: "Banner próprio sem título", sub: "Sem título, ele não aparece nos artigos", btn: "Resolver", go: "anuncios" });
    }
    var cats = (d.banners && d.banners.categoryBanners) || {};
    Object.keys(cats).forEach(function (k) {
      var b = cats[k];
      if (b.enabled === false) return;
      var p = posts.filter(function (x) { return x.slug === b.postSlug; })[0];
      if (!p || !isLive(p)) tasks.push({ kind: "warn", icon: "image", title: "Banner de " + k.replace(/-/g, " ") + " sem artigo no ar", sub: p ? "“" + p.title + "” ainda não está publicado" : "O artigo escolhido não existe — o botão leva pra lista do blog", btn: "Escolher", go: "banners" });
    });
    var noDate = posts.filter(function (p) { return p.status === "agendado" && !p.date; });
    if (noDate.length) tasks.push({ kind: "warn", icon: "send", title: plural(noDate.length, "artigo agendado sem data", "artigos agendados sem data"), sub: noDate.map(function (p) { return p.title; }).join(" · "), btn: "Ver quadro", go: "artigos" });
    var review = posts.filter(function (p) { return p.status === "revisao"; });
    if (review.length) tasks.push({ kind: "info", icon: "cols", title: plural(review.length, "artigo em revisão", "artigos em revisão"), sub: review.map(function (p) { return p.title; }).join(" · "), btn: "Ver quadro", go: "artigos" });
    var noRules = posts.filter(function (p) { return isLive(p) && !p.url && !(/\[\[FAQ\]\]/.test(p.body || "") && /\[\[FEEDBACK\]\]/.test(p.body || "")); });
    if (noRules.length) tasks.push({ kind: "info", icon: "check", title: plural(noRules.length, "artigo no ar sem FAQ ou Feedback", "artigos no ar sem FAQ ou Feedback"), sub: noRules.map(function (p) { return p.title; }).join(" · "), btn: "Ver quadro", go: "artigos" });
    var prods = (d.products && d.products.items) || [];
    var noStripe = prods.filter(function (p) { return p.active && !/^https:\/\/buy\.stripe\.com\//.test(p.stripeLink || ""); });
    if (noStripe.length) tasks.push({ kind: "bad", icon: "bag", title: plural(noStripe.length, "produto no ar sem pagamento", "produtos no ar sem pagamento"), sub: noStripe.map(function (p) { return p.title; }).join(" · "), btn: "Abrir", go: "produtos" });
    var hidden = prods.filter(function (p) { return !p.active; });
    if (hidden.length) tasks.push({ kind: "info", icon: "bag", title: plural(hidden.length, "produto escondido da vitrine", "produtos escondidos da vitrine"), sub: hidden.map(function (p) { return p.title + (p.price ? " (" + String(p.price).replace(".", ",") + " €)" : ""); }).join(" · "), btn: "Abrir", go: "produtos" });
    var expiredCp = prods.filter(function (p) { return p.coupon && p.coupon.code && p.coupon.enabled !== false && p.coupon.until && String(p.coupon.until).slice(0, 10) < todayISO(); });
    if (expiredCp.length) tasks.push({ kind: "info", icon: "tag", title: plural(expiredCp.length, "cupom venceu", "cupons venceram"), sub: expiredCp.map(function (p) { return p.coupon.code + " · " + p.title; }).join(" · ") + " — já saiu do site", btn: "Ver", go: "produtos" });
    var noSteps = prods.filter(function (p) { return p.active && !(p.nextSteps && p.nextSteps.length); });
    if (noSteps.length) tasks.push({ kind: "info", icon: "list", title: "Próximos passos da compra em branco", sub: noSteps.map(function (p) { return p.title; }).join(" · "), btn: "Preencher", go: "produtos" });
    var order = { bad: 0, warn: 1, info: 2 };
    return tasks.sort(function (a, b) { return order[a.kind] - order[b.kind]; });
  }

  // --- tela --------------------------------------------------------------------
  var root, state = { data: null, loading: false, loadedAt: 0, railOpen: false };

  function theme() { try { return localStorage.getItem("pd-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) { return "light"; } }

  function renderRail() {
    var d = state.data || {};
    var posts = (d.posts && d.posts.items) || [];
    var badges = {
      artigos: posts.filter(function (p) { return p.status === "escrevendo" || p.status === "revisao"; }).length,
      avaliacoes: d.reviews && d.reviews.pending ? d.reviews.pending.length : 0
    };
    var out = '<div class="pdh-brand"><span class="pdh-mark">P</span><div><b>Estúdio</b><span>Por Dentro · admin</span></div></div>' +
      '<button type="button" class="pdh-nav" aria-current="page" data-go="home">' + icon("home") + "Hoje</button>";
    NAV.forEach(function (n) {
      if (n.group) { out += '<div class="pdh-group">' + esc(n.group) + "</div>"; return; }
      var badge = badges[n.id] ? '<span class="n' + (n.id === "avaliacoes" ? " warn" : "") + '">' + badges[n.id] + "</span>" : "";
      out += n.href
        ? '<a class="pdh-nav" href="' + n.href + '">' + icon(n.icon) + esc(n.label) + badge + "</a>"
        : '<button type="button" class="pdh-nav" data-go="' + n.id + '">' + icon(n.icon) + esc(n.label) + badge + "</button>";
    });
    out += '<div class="pdh-foot">' +
      '<a href="/" target="_blank" rel="noopener">' + icon("ext") + "Abrir o site</a>" +
      '<button type="button" data-classic="1">' + icon("list") + "Lista clássica do Decap</button></div>";
    return out;
  }

  function renderToday() {
    var d = state.data;
    var now = new Date();
    var hour = now.getHours();
    var hi = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    var u = decapUser();
    var first = u && (u.name || u.login) ? String(u.name || u.login).split(" ")[0] : "";
    var dateLine = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    if (!d) {
      return '<div class="pdh-today"><div class="pdh-col"><div class="pdh-hello"><div class="pdh-eyebrow">' + esc(dateLine) + "</div><h2>" + esc(hi) + (first ? ", " + esc(first) : "") + '.</h2><p>Olhando o que mudou…</p></div><div class="pdh-card"><div class="pdh-sk"></div><div class="pdh-sk"></div><div class="pdh-sk"></div></div></div><div class="pdh-col"><div class="pdh-card"><div class="pdh-sk"></div></div></div></div>';
    }
    var tasks = buildTasks(d);
    var urgent = tasks.filter(function (t) { return t.kind !== "info"; }).length;
    var lead = !tasks.length ? "Nada pedindo atenção. Está tudo no ar e funcionando."
      : urgent ? plural(urgent, "coisa pede", "coisas pedem") + " sua atenção" + (tasks.length > urgent ? ", e " + plural(tasks.length - urgent, "lembrete", "lembretes") + "." : ".")
      : plural(tasks.length, "lembrete", "lembretes") + " pra quando der. O resto está no ar e funcionando.";
    var taskHtml = tasks.length ? tasks.map(function (t) {
      return '<div class="pdh-task ' + t.kind + '"><span class="ic">' + icon(t.icon) + '</span><div class="tt"><b>' + esc(t.title) + "</b><small title=\"" + esc(t.sub) + "\">" + esc(t.sub) + '</small></div><button type="button" class="pdh-btn" data-go="' + t.go + '">' + esc(t.btn) + "</button></div>";
    }).join("") : '<div class="pdh-task ok"><span class="ic">' + icon("check") + '</span><div class="tt"><b>Tudo em ordem</b><small>Sem pendência nos artigos, produtos e banners.</small></div></div>';

    var posts = (d.posts && d.posts.items) || [];
    var today = todayISO();
    var queue = posts.filter(function (p) { return p.status === "agendado" && p.date && day(p.date) > today; })
      .sort(function (a, b) { return day(a.date) < day(b.date) ? -1 : 1; });
    var next = queue[0];
    var nextHtml = next
      ? '<button type="button" class="pdh-next" data-go="artigos" data-article="' + esc(next.title) + '"><span class="ic">' + icon("send") + '</span><span><b>' + esc(next.title) + "</b><small>Entra no ar " + esc(fmtDay(next.date)) + (queue.length > 1 ? " · e mais " + (queue.length - 1) + " na fila" : "") + "</small></span></button>"
      : '<button type="button" class="pdh-next" data-go="artigos"><span class="ic">' + icon("send") + "</span><span><b>Nada agendado</b><small>Arraste um artigo pra “Agendado” no quadro e escolha a data.</small></span></button>";
    var counts = [["ideia", "Ideia"], ["escrevendo", "Escrevendo"], ["revisao", "Revisão"], ["agendado", "Agendado"], ["publicado", "No ar"]].map(function (s) {
      var n = posts.filter(function (p) { return (p.status || (p.published ? "publicado" : "ideia")) === s[0]; }).length;
      return '<button type="button" data-go="artigos"><b>' + n + "</b><span>" + s[1] + "</span></button>";
    }).join("");
    var feed = d.commits === null ? '<div class="pdh-empty">Não consegui carregar o histórico agora.</div>'
      : !d.commits ? '<div class="pdh-sk"></div><div class="pdh-sk"></div>'
      : d.commits.length ? '<div class="pdh-feed">' + d.commits.map(function (c) { return "<div><time>" + esc(rel(c.date)) + "</time><span>" + commitText(c.message) + "</span></div>"; }).join("") + "</div>"
      : '<div class="pdh-empty">Nenhuma mudança ainda.</div>';

    return '<div class="pdh-today">' +
      '<div class="pdh-col">' +
        '<div class="pdh-hello"><div class="pdh-eyebrow">' + esc(dateLine) + "</div><h2>" + esc(hi) + (first ? ", " + esc(first) : "") + ".</h2><p>" + esc(lead) + "</p></div>" +
        '<div class="pdh-card">' + taskHtml + "</div>" +
        '<div class="pdh-quick">' +
          '<button type="button" data-go="artigos" data-action="new">' + icon("plus") + "Novo artigo</button>" +
          '<button type="button" data-go="produtos" data-action="new">' + icon("bag") + "Novo produto</button>" +
          '<button type="button" data-go="bio">' + icon("link") + "Trocar destaque da bio</button>" +
        "</div>" +
      "</div>" +
      '<div class="pdh-col">' +
        '<div class="pdh-card"><div class="pdh-card-h"><span>Próximo na fila</span></div>' + nextHtml + '<div class="pdh-pipe">' + counts + "</div></div>" +
        '<div class="pdh-card"><div class="pdh-card-h"><span>Últimas mudanças</span><a href="https://github.com/' + REPO + '/commits/main" target="_blank" rel="noopener">ver tudo ↗</a></div>' + feed + "</div>" +
        '<p class="pdh-note">Pendências calculadas dos arquivos publicados' + (token() ? " (versão mais nova do GitHub)" : "") + ". Atualiza sempre que você volta pra cá.</p>" +
      "</div>" +
    "</div>";
  }

  function render() {
    if (!root) return;
    root.setAttribute("data-theme", theme());
    root.className = "pdh" + (state.railOpen ? " rail-open" : "");
    var dark = theme() === "dark";
    root.innerHTML =
      '<nav class="pdh-rail" aria-label="Menu do painel">' + renderRail() + "</nav>" +
      (state.railOpen ? '<div class="pdh-scrim" data-close-rail="1"></div>' : "") +
      '<div class="pdh-main">' +
        '<header class="pdh-top">' +
          '<button type="button" class="pdh-sq pdh-burger" aria-label="Abrir menu" data-open-rail="1">' + icon("menu") + "</button>" +
          '<div class="pdh-crumb"><small>Início</small><h1>O que pede atenção</h1></div>' +
          '<button type="button" class="pdh-search" data-palette="1">' + icon("search") + "<span>Ir para…</span><kbd>" + (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K") + "</kbd></button>" +
          '<button type="button" class="pdh-sq" data-theme-toggle="1" aria-label="' + (dark ? "Tema claro" : "Tema escuro") + '">' + icon(dark ? "sun" : "moon") + "</button>" +
          '<a class="pdh-site" href="/" target="_blank" rel="noopener">' + icon("ext") + "<span>Ver o site</span></a>" +
        "</header>" +
        '<main class="pdh-view">' + renderToday() + "</main>" +
      "</div>" +
      '<nav class="pdh-tabbar" aria-label="Atalhos">' +
        '<button type="button" aria-current="page" data-go="home">' + icon("home") + "Hoje</button>" +
        '<button type="button" data-go="artigos">' + icon("cols") + "Artigos</button>" +
        '<button type="button" data-go="produtos">' + icon("bag") + "Produtos</button>" +
        '<button type="button" data-go="bio">' + icon("link") + "Bio</button>" +
        '<button type="button" data-open-rail="1">' + icon("dots") + "Mais</button>" +
      "</nav>";
  }

  function load() {
    if (state.loading) return;
    state.loading = true;
    var t = token();
    var d = { commits: undefined };
    var jobs = [
      content("content/posts.json").then(function (x) { d.posts = x; }).catch(function () {}),
      content("content/produtos-digitais.json").then(function (x) { d.products = x; }).catch(function () {}),
      content("content/ads-config.json").then(function (x) { d.ads = x; }).catch(function () {}),
      content("content/banners.json").then(function (x) { d.banners = x; }).catch(function () {})
    ];
    if (t) {
      jobs.push(fetch(WORKER_BASE + "/api/reviews/all", { headers: { Authorization: "Bearer " + t } })
        .then(function (r) { return r.ok ? r.json() : null; }).then(function (x) { d.reviews = x; }).catch(function () {}));
    }
    Promise.all(jobs).then(function () {
      state.data = d;
      state.loading = false;
      state.loadedAt = Date.now();
      render();
      var h = { Accept: "application/vnd.github+json" };
      if (t) h.Authorization = "token " + t;
      fetch("https://api.github.com/repos/" + REPO + "/commits?path=content&per_page=7", { headers: h })
        .then(function (r) { if (!r.ok) throw new Error("commits"); return r.json(); })
        .then(function (list) {
          d.commits = list.map(function (c) { return { date: c.commit.author.date, message: c.commit.message }; });
        })
        .catch(function () { d.commits = null; })
        .then(function () { if (state.data === d) render(); });
    });
  }

  // --- ir pra uma tela -----------------------------------------------------------
  // Abre a coleção no Decap e, quando o botão do estúdio aparecer, clica nele
  // (e no "Novo…", se foi um atalho de criar).
  function waitFor(find, cb, ms) {
    var t0 = Date.now();
    (function tick() {
      var el = find();
      if (el) return cb(el);
      if (Date.now() - t0 < (ms || 9000)) setTimeout(tick, 150);
      else hideGoing();
    })();
  }
  function buttonByText(re, scope) {
    var list = (scope || document).querySelectorAll("button");
    for (var i = 0; i < list.length; i++) if (re.test(list[i].textContent) && list[i].offsetParent !== null) return list[i];
    return null;
  }
  var goingEl = null;
  function showGoing(text) {
    hideGoing();
    goingEl = document.createElement("div");
    goingEl.className = "pdh-going";
    goingEl.setAttribute("role", "status");
    goingEl.textContent = text;
    document.body.appendChild(goingEl);
  }
  function hideGoing() { if (goingEl) { goingEl.remove(); goingEl = null; } }

  function go(id, opts) {
    opts = opts || {};
    if (id === "home") { state.railOpen = false; render(); return; }
    var n = BY_ID[id];
    if (!n) return;
    if (n.href) { window.location.href = n.href; return; }
    state.railOpen = false;
    window.location.hash = "#/collections/" + n.c + "/entries/" + n.e;
    if (!n.open) return;
    showGoing("Abrindo " + n.label.toLowerCase() + "…");
    var openRe = new RegExp("^\\s*" + n.open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$");
    waitFor(function () { return buttonByText(openRe); }, function (btn) {
      btn.click();
      hideGoing();
      if (opts.action === "new") {
        var re = id === "artigos" ? /Novo artigo/ : /^\s*\+\s*Novo\s*$/;
        waitFor(function () { return buttonByText(re); }, function (b) { b.click(); }, 4000);
      }
      if (opts.article) {
        waitFor(function () {
          var cards = document.querySelectorAll(".pdb-card");
          for (var i = 0; i < cards.length; i++) if ((cards[i].getAttribute("aria-label") || "").indexOf(opts.article) === 0) return cards[i];
          return null;
        }, function (c) { c.click(); }, 4000);
      }
    });
  }

  // --- Ir para… (⌘K) ------------------------------------------------------------
  var pal = null;
  function openPalette() {
    if (pal) return;
    var items = NAV.filter(function (n) { return n.id; }).map(function (n) { return { label: n.label, hint: n.href ? "página" : "tela", run: function () { go(n.id); } }; });
    items.unshift({ label: "Novo artigo", hint: "atalho", run: function () { go("artigos", { action: "new" }); } }, { label: "Novo produto", hint: "atalho", run: function () { go("produtos", { action: "new" }); } });
    var posts = (state.data && state.data.posts && state.data.posts.items) || [];
    posts.forEach(function (p) { if (p.title) items.push({ label: p.title, hint: "artigo", run: function () { go("artigos", { article: p.title }); } }); });
    pal = document.createElement("div");
    pal.className = "pdh-pal-bg pdh";
    pal.style.display = "flex";
    pal.style.background = "rgba(20,16,14,.4)";
    pal.setAttribute("data-theme", theme());
    pal.innerHTML = '<div class="pdh-pal" role="dialog" aria-label="Ir para"><input type="search" placeholder="Ir para… (tela, artigo, atalho)" aria-label="Ir para"><ul role="listbox"></ul></div>';
    document.body.appendChild(pal);
    var input = pal.querySelector("input"), ul = pal.querySelector("ul"), sel = 0, shown = [];
    function norm(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
    function draw() {
      var q = norm(input.value.trim());
      shown = items.filter(function (it) { return !q || norm(it.label).indexOf(q) !== -1; }).slice(0, 40);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ul.innerHTML = shown.length ? shown.map(function (it, i) { return '<li role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '">' + esc(it.label) + "<small>" + esc(it.hint) + "</small></li>"; }).join("") : '<li aria-disabled="true">Nada encontrado</li>';
    }
    function run(i) { var it = shown[i]; closePalette(); if (it) it.run(); }
    input.addEventListener("input", function () { sel = 0; draw(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter") { run(sel); e.preventDefault(); }
      else if (e.key === "Escape") closePalette();
    });
    ul.addEventListener("click", function (e) { var li = e.target.closest("li[data-i]"); if (li) run(Number(li.getAttribute("data-i"))); });
    pal.addEventListener("click", function (e) { if (e.target === pal) closePalette(); });
    draw();
    input.focus();
  }
  function closePalette() { if (pal) { pal.remove(); pal = null; } }

  // --- quando aparecer ----------------------------------------------------------
  // Na tela inicial do Decap e nas listas de coleção, com login feito.
  function isHomeRoute() {
    var h = window.location.hash || "";
    return h === "" || h === "#" || h === "#/" || /^#\/collections(\/[^/?]+)?\/?(\?.*)?$/.test(h);
  }
  function loggedIn() {
    return !!document.querySelector('[class*="AppHeader"], [class*="CollectionContainer"], [class*="SidebarContainer"]');
  }
  function classic() { try { return sessionStorage.getItem("pd-classic") === "1"; } catch (e) { return false; } }

  function update() {
    var show = isHomeRoute() && loggedIn() && !classic() && !document.documentElement.classList.contains("pds-open");
    if (!root) {
      if (!show) return;
      var st = document.createElement("style");
      st.id = "pdh-style";
      st.textContent = CSS;
      document.head.appendChild(st);
      root = document.createElement("div");
      root.className = "pdh";
      root.hidden = true;
      document.body.appendChild(root);
      bind();
    }
    var wasHidden = root.hidden;
    root.hidden = !show;
    document.documentElement.classList.toggle("pdh-open", show);
    if (show && wasHidden) {
      // voltou pra cá: recarrega as pendências (algo pode ter sido publicado)
      if (!state.data || Date.now() - state.loadedAt > 15000) load();
      render();
    }
  }

  function bind() {
    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-go],[data-classic],[data-theme-toggle],[data-palette],[data-open-rail],[data-close-rail]");
      if (!el) return;
      if (el.hasAttribute("data-go")) { e.preventDefault(); go(el.getAttribute("data-go"), { action: el.getAttribute("data-action"), article: el.getAttribute("data-article") }); }
      else if (el.hasAttribute("data-classic")) { try { sessionStorage.setItem("pd-classic", "1"); } catch (err) {} update(); }
      else if (el.hasAttribute("data-theme-toggle")) { try { localStorage.setItem("pd-theme", theme() === "dark" ? "light" : "dark"); } catch (err) {} render(); }
      else if (el.hasAttribute("data-palette")) openPalette();
      else if (el.hasAttribute("data-open-rail")) { state.railOpen = true; render(); }
      else if (el.hasAttribute("data-close-rail")) { state.railOpen = false; render(); }
    });
  }

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K") && root && !root.hidden) { e.preventDefault(); openPalette(); }
  });
  window.addEventListener("hashchange", update);
  // O Decap desenha a tela depois do login sem trocar o endereço.
  setInterval(update, 500);
  update();
})();
