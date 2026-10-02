// Por Dentro — capa de artigo por palavra-chave (sistema de capas v3).
//
// A capa não é mais uma imagem exportada: é desenhada pelo navegador a
// partir de 3 campos do artigo em content/posts.json:
//
//   coverKeyword  → a palavra enorme (1 termo, até 15 caracteres: "VLS-TS",
//                   "Carte Vitale"); a letra diminui pra caber na largura
//   coverTags     → até 3 palavras de apoio (["prazo", "3 meses", "validação"]);
//                   a linha quebra a cada 25 caracteres, mais ou menos
//   coverFormat   → Guia · Passo a passo · Comparativo · Mapa · Roteiro ·
//                   Checklist · Série · ep. N
//
// A cor de fundo vem do pilar da categoria (PILLARS abaixo). Sem
// coverKeyword, o site continua usando a foto do campo "image" — por isso
// artigos antigos não quebram.
//
// Script clássico (não módulo) de propósito: é usado tanto pelo site
// (assets/js/render.js) quanto pelo /admin (quadro de artigos), que não
// carrega módulos. Injeta o próprio CSS na primeira chamada.
(function () {
  var PILLARS = {
    tramites: { name: "Trâmites", bg: "#577328", ink: "#FBFAF7", dim: "rgba(251,250,247,.74)", rule: "rgba(251,250,247,.3)",
      cats: ["Visto", "ANEF", "Exame Cívico", "Au Pair", "Documentos", "Préfecture"] },
    pratico: { name: "Vida prática", bg: "#8AACD2", ink: "#1F2A36", dim: "rgba(31,42,54,.72)", rule: "rgba(31,42,54,.25)",
      cats: ["Custo de Vida", "Moradia", "Saúde", "Trabalho", "Dinheiro"] },
    vinculo: { name: "Vínculos", bg: "#DEB975", ink: "#3A2A12", dim: "rgba(58,42,18,.72)", rule: "rgba(58,42,18,.25)",
      cats: ["Família", "Relacionamento"] },
    crescimento: { name: "Crescimento", bg: "#063B35", ink: "#F4E7CE", dim: "rgba(244,231,206,.72)", rule: "rgba(244,231,206,.25)",
      cats: ["Francês", "Formação", "Bolsas de Estudo", "Estudos"] },
    leveza: { name: "Leveza", bg: "#F4E7CE", ink: "#4A2E24", dim: "rgba(74,46,36,.72)", rule: "rgba(74,46,36,.22)",
      cats: ["Viagens", "Lifestyle"] }
  };

  function pillarOf(category) {
    var c = String(category || "").toLowerCase();
    for (var k in PILLARS) {
      if (PILLARS[k].cats.some(function (x) { return x.toLowerCase() === c; })) return k;
    }
    return "tramites";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function tagsOf(post) {
    var t = post.coverTags;
    if (typeof t === "string") t = t.split(",");
    if (!Array.isArray(t)) return [];
    return t.map(function (x) { return String(x && x.tag != null ? x.tag : x).trim(); }).filter(Boolean).slice(0, 3);
  }

  var CSS = [
    ".pdc{position:relative;width:100%;aspect-ratio:16/9;background:var(--pdc-bg);color:var(--pdc-ink);overflow:hidden;container-type:inline-size;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;text-align:left;}",
    ".pdc-in{position:absolute;inset:8.5% 16%;display:flex;flex-direction:column;justify-content:space-between;}",
    ".pdc-top{display:flex;justify-content:space-between;align-items:center;font:700 1.45cqw/1 'Inter',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--pdc-dim);}",
    ".pdc-mark{display:flex;gap:.8cqw;align-items:center;}",
    ".pdc-mark i{width:1.6cqw;height:1.6cqw;border-radius:50%;background:var(--pdc-dim);}",
    ".pdc-kw{font-family:'Fraunces',Georgia,serif;font-weight:600;line-height:.9;letter-spacing:-.035em;color:var(--pdc-ink);white-space:nowrap;}",
    // apoio: texto corrido que quebra a cada ~25 caracteres (25ch); o ponto separador fica no fim da linha, nunca no começo
    ".pdc-tags{font:500 2.1cqw/1.35 'Inter',sans-serif;color:var(--pdc-dim);margin-top:2.6cqw;max-width:25ch;overflow-wrap:break-word;}",
    ".pdc-tags span:not(:last-child)::after{content:'';display:inline-block;width:.7cqw;height:.7cqw;border-radius:50%;background:var(--pdc-dim);opacity:.6;margin:0 1.2cqw;vertical-align:middle;}",
    ".pdc-foot{display:flex;justify-content:space-between;font:700 1.35cqw/1 'Inter',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--pdc-dim);border-top:1px solid var(--pdc-rule);padding-top:1.8cqw;}",
    // caixa com altura própria (destaque do blog no desktop): a capa enche a caixa
    ".img-slot.pdc-slot{aspect-ratio:16/9;background:none;border:none;}",
    ".img-slot.pdc-slot .pdc{height:100%;aspect-ratio:auto;}",
    ".featured-post .img-slot.pdc-slot{aspect-ratio:16/9;}",
    "@media (min-width:780px){.featured-post .img-slot.pdc-slot{aspect-ratio:auto;min-height:100%;}}",
    // miniatura quadrada ("mais curtidos"): só a palavra
    ".pdc.pdc-mini .pdc-in{inset:12% 10%;justify-content:center;}",
    ".pdc.pdc-mini .pdc-top,.pdc.pdc-mini .pdc-tags,.pdc.pdc-mini .pdc-foot{display:none;}",
    ".pdc.pdc-mini{aspect-ratio:auto;height:100%;}"
  ].join("\n");

  function ensureCss() {
    if (typeof document === "undefined" || document.getElementById("pdc-style")) return;
    var st = document.createElement("style");
    st.id = "pdc-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function kwSize(kw, mini) {
    var n = Math.max(String(kw).length, 3);
    if (mini) return Math.min(38, 150 / n).toFixed(2);
    return Math.min(18, 122 / n).toFixed(2);
  }

  // opts: { mini: true } pra miniatura só com a palavra
  function html(post, opts) {
    ensureCss();
    opts = opts || {};
    var p = PILLARS[pillarOf(post.category)];
    var kw = String(post.coverKeyword || "").trim();
    var tags = tagsOf(post);
    var fmt = post.coverFormat || "Guia";
    var mins = post.readMinutes ? " · " + post.readMinutes + " min" : "";
    var year = String(post.updatedDate || post.date || "").slice(0, 4);
    var style = "--pdc-bg:" + p.bg + ";--pdc-ink:" + p.ink + ";--pdc-dim:" + p.dim + ";--pdc-rule:" + p.rule;
    return (
      '<div class="pdc' + (opts.mini ? " pdc-mini" : "") + '" style="' + style + '" role="img" aria-label="' + esc(post.title || kw) + '">' +
      '<div class="pdc-in">' +
      '<div class="pdc-top"><span>' + esc(post.category || "") + '</span><span class="pdc-mark"><i></i>Por Dentro</span></div>' +
      '<div class="pdc-mid"><div class="pdc-kw" style="font-size:' + kwSize(kw, opts.mini) + 'cqw">' + esc(kw) + "</div>" +
      '<div class="pdc-tags">' + tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div></div>" +
      '<div class="pdc-foot"><span>' + esc(fmt) + esc(mins) + "</span><span>" + esc(year) + "</span></div>" +
      "</div></div>"
    );
  }

  window.PDCover = { html: html, pillarOf: pillarOf, PILLARS: PILLARS, has: function (post) { return !!(post && String(post.coverKeyword || "").trim()); } };
})();
