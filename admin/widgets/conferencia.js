// Conferência do artigo — o que o quadro de artigos (posts-board.js) e o editor
// do artigo (article-composer.js) têm em comum pra tratar os trechos a conferir.
//
// Um trecho a conferir é uma marca no texto: {{VERIFICAR: …}} (escritor do
// Cérebro) ou [CONFERIR: …] (robô, ver admin/prompts/). O hub pesquisa cada
// marca em sites oficiais, confere em código se o trecho citado está na
// página e manda o resultado no campo "conferencia" do artigo:
//
//   { marca, status: conferida | sem_conferencia | sem_fonte, sugestao,
//     fontes: [{ url, titulo, trecho, status }], buscas: [...] }
//
// Aqui ficam: achar as marcas, casar a marca com a fonte dela, trocar a marca
// pelo texto, acrescentar a página no bloco [[RESOURCES]] e o cartão que
// mostra um trecho por vez. Quem grava é quem chama (cada tela sabe o que é
// "o texto" dela).
//
// Precisa carregar DEPOIS do decap-cms.js (usa o global h) e ANTES dos dois.
(function () {
  if (typeof h === "undefined") {
    console.error("[conferencia] Global h do Decap CMS não encontrado — confira a ordem dos <script> em admin/index.html.");
    return;
  }

  var MARK_SRC = "\\{\\{\\s*VERIFICAR[^}]*\\}\\}|\\[\\s*CONFERIR[^\\]]*\\]";
  var OFFICIAL_SITES = ["ameli.fr", "service-public.gouv.fr", "legifrance.gouv.fr", "france-visas.gouv.fr"];

  function markRe() { return new RegExp(MARK_SRC, "gi"); }
  function marksIn(text) { return String(text || "").match(markRe()) || []; }
  function markText(tok) { return String(tok).replace(/^\{\{\s*VERIFICAR\s*:?|^\[\s*CONFERIR\s*:?|\}\}$|\]$/gi, "").trim(); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function sourceFor(list, tok) {
    list = Array.isArray(list) ? list : [];
    var k = norm(markText(tok));
    for (var i = 0; i < list.length; i++) if (list[i] && norm(list[i].marca) === k) return list[i];
    return null;
  }
  function safeUrl(u) { return /^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? String(u) : ""; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  // O fórum oficial da Ameli vale como fonte, mas não é página institucional: quem responde é um
  // atendente, caso a caso. O selo diz isso pra você pesar antes de usar.
  function isForum(u) { return hostOf(u) === "forum-assures.ameli.fr"; }
  function searchUrl(terms) {
    return "https://www.google.com/search?q=" + encodeURIComponent(terms + " " + OFFICIAL_SITES.map(function (s) { return "site:" + s; }).join(" OR "));
  }

  // Acrescenta a página usada no bloco de fontes do artigo (cria o bloco antes do próximo passo, se não houver).
  function addResource(body, src) {
    var url = safeUrl(src && src.url);
    if (!url || body.indexOf(url) !== -1) return body;
    var line = String(src.titulo || hostOf(url)).replace(/\s*\|\s*/g, " / ") + " | " + hostOf(url) + " | Acessar | " + url;
    var end = body.indexOf("[[/RESOURCES]]");
    if (end !== -1) return body.slice(0, end).replace(/\s*$/, "\n") + line + "\n" + body.slice(end);
    var block = "[[RESOURCES]]\n" + line + "\n[[/RESOURCES]]\n\n";
    var at = body.indexOf("[[PROXIMO-PASSO]]");
    if (at === -1) at = body.indexOf("[[FEEDBACK]]");
    return at === -1 ? body.replace(/\s*$/, "\n\n") + block : body.slice(0, at) + block + body.slice(at);
  }
  // Troca a 1ª ocorrência da marca pelo texto (vazio = só tira a marca) e arruma o espaço que sobra.
  function swapMark(text, tok, by) {
    var i = String(text || "").indexOf(tok);
    if (i === -1) return null;
    var out = text.slice(0, i) + by + text.slice(i + tok.length);
    return by ? out : out.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1").replace(/[ \t]+\n/g, "\n");
  }

  if (!document.getElementById("pdcf-style")) {
    var st = document.createElement("style");
    st.id = "pdcf-style";
    st.textContent = [
      ".pdb-conf{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #E6E0D6;border-radius:12px;padding:11px 12px;}",
      ".pdb-conf-h{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#6E6862;}",
      ".pdb-conf-h b{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;}",
      ".pdb-conf-q{font-size:13.5px;font-weight:600;line-height:1.4;margin:0;}",
      ".pdb-src{display:flex;flex-direction:column;gap:5px;border:1px solid #E6E0D6;border-radius:10px;padding:9px 10px;background:#FBFAF7;}",
      ".pdb-src a{color:#3F6E2B;font-weight:600;font-size:12.5px;overflow-wrap:anywhere;}",
      ".pdb-src q{font-size:12.5px;font-style:italic;color:#6E6862;line-height:1.5;quotes:'«' '»';}",
      ".pdb-sug{font-size:13.5px;line-height:1.55;border-left:3px solid #577328;padding:2px 0 2px 10px;margin:0;}",
      ".pdb-conf textarea{min-height:70px;}",
      ".pdb-flag{font-size:10.5px;font-weight:600;border-radius:20px;padding:1px 7px;background:#F6ECD6;color:#8A5F12;}",
      ".pdb-flag.ok{background:#E3EDDA;color:#3F6E2B;}",
      ".pdb-msg{font-size:12px;margin:0;color:#6E6862;}"
    ].join("\n");
    document.head.appendChild(st);
  }

  // O cartão de um trecho: pergunta, fonte (ou buscas prontas), frase sugerida e as três ações.
  // o = { tok, entry, at, total, withSource (ou null), own, onNav(d), onUse(text, src), onOwn(text|null), onCut() }
  function card(o) {
    var c = o.entry, tok = o.tok, own = o.own;
    var srcs = c && Array.isArray(c.fontes) ? c.fontes.filter(function (f) { return f && safeUrl(f.url); }) : [];
    var checked = !!(c && c.status === "conferida"), src = srcs[0];
    var searches = c && Array.isArray(c.buscas) && c.buscas.length ? c.buscas : [markText(tok)];
    return h("div", { className: "pdb-conf" },
      h("div", { className: "pdb-conf-h" },
        h("b", null, "Trecho " + (o.at + 1) + " de " + o.total),
        o.withSource != null ? h("span", null, "· " + o.withSource + " com fonte") : null,
        h("span", { style: { marginLeft: "auto" } }),
        h("button", { type: "button", className: "pds-btn sm", "aria-label": "Trecho anterior", disabled: o.total < 2, onClick: function () { o.onNav(-1); } }, "←"),
        h("button", { type: "button", className: "pds-btn sm", "aria-label": "Próximo trecho", disabled: o.total < 2, onClick: function () { o.onNav(1); } }, "→")),
      h("p", { className: "pdb-conf-q" }, markText(tok)),
      src ? h("div", { className: "pdb-src" },
          h("div", { className: "pds-row", style: { gap: "5px", flexWrap: "wrap" } },
            h("span", { className: "pdb-flag " + (checked ? "ok" : "") }, checked ? "trecho conferido na página" : "link oficial · o sistema não conseguiu conferir o trecho"),
            isForum(src.url) ? h("span", { className: "pdb-flag", title: "Resposta de atendente no fórum oficial da Ameli, não página institucional" }, "resposta no fórum oficial") : null),
          h("a", { href: safeUrl(src.url), target: "_blank", rel: "noopener noreferrer" }, (src.titulo || hostOf(src.url)) + " · " + hostOf(src.url) + " ↗"),
          src.trecho ? h("q", null, src.trecho) : null,
          srcs[1] ? h("a", { href: safeUrl(srcs[1].url), target: "_blank", rel: "noopener noreferrer" }, "Outra página: " + (srcs[1].titulo || hostOf(srcs[1].url)) + " ↗") : null)
        : h("div", { className: "pdb-src" },
          h("span", { className: "pdb-flag", style: { alignSelf: "flex-start" } }, c ? "nenhuma página oficial com resposta clara" : "as fontes deste trecho ainda não chegaram do Cérebro"),
          h("span", { className: "pdb-msg" }, "Buscas prontas nos sites oficiais:"),
          searches.slice(0, 3).map(function (t, i) { return h("a", { key: i, href: searchUrl(t), target: "_blank", rel: "noopener noreferrer" }, t + " ↗"); })),
      src && c.sugestao ? h("div", null, h("span", { className: "pds-label" }, "Texto sugerido" + (checked ? "" : " · confira na página antes de usar")), h("p", { className: "pdb-sug" }, c.sugestao)) : null,
      own != null ? h("textarea", { className: "pds-input", "aria-label": "Seu texto para este trecho", value: own, placeholder: "Escreva o texto que entra no lugar da marca", onChange: function (e) { o.onOwn(e.target.value); } }) : null,
      h("div", { className: "pds-row", style: { gap: "6px", flexWrap: "wrap" } },
        own != null
          ? [h("button", { key: "ok", type: "button", className: "pds-btn primary sm", disabled: !own.trim(), onClick: function () { o.onUse(own.trim(), null); } }, "Trocar pelo meu texto"),
             h("button", { key: "no", type: "button", className: "pds-btn ghost sm", onClick: function () { o.onOwn(null); } }, "Cancelar")]
          : [src && c.sugestao ? h("button", { key: "use", type: "button", className: "pds-btn primary sm", onClick: function () { o.onUse(c.sugestao, src); } }, "Usar este texto") : null,
             h("button", { key: "own", type: "button", className: "pds-btn sm", onClick: function () { o.onOwn(""); } }, "Escrever eu mesma"),
             h("button", { key: "cut", type: "button", className: "pds-btn sm", title: "Tira só a marca; o texto em volta fica como está", onClick: function () { o.onCut(); } }, "Tirar a marca")]),
      src && c.sugestao && own == null ? h("p", { className: "pdb-msg" }, "“Usar este texto” troca a marca pela frase e acrescenta a página no bloco Fontes do artigo.") : null);
  }

  window.PDConferencia = {
    markRe: markRe, marksIn: marksIn, markText: markText, norm: norm, plural: plural,
    sourceFor: sourceFor, safeUrl: safeUrl, hostOf: hostOf, isForum: isForum, searchUrl: searchUrl,
    addResource: addResource, swapMark: swapMark, card: card
  };
})();
