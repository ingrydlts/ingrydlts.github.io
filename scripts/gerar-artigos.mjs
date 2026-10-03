// Por Dentro — gera uma página estática por artigo publicado, o sitemap.xml e o robots.txt.
//
// Por quê: o template dinâmico (/artigos/post/?slug=) monta o artigo no navegador, então o HTML
// servido não tem título, descrição nem texto — o Google não tem o que ranquear. Este script lê
// content/posts.json e escreve /artigos/<slug>/index.html com tudo isso já no HTML. O mesmo JS do
// template continua rodando por cima (propaganda, vitrine, blocos interativos [[...]]).
//
// Roda sem dependência: `node scripts/gerar-artigos.mjs` (Node 22+, por causa do import de
// assets/js/markdown.js, que é ES module sem package.json). A GitHub Action
// .github/workflows/gerar-artigos.yml roda isto a cada mudança em content/posts.json e todo dia
// (artigos "agendado" entram no ar sozinhos quando a data chega).
//
// Regras:
// - Só artigo publicado (mesma regra de isPublished em assets/js/render.js) ganha página e entra
//   no sitemap. Página gerada de artigo que saiu do ar é apagada na rodada seguinte.
// - Artigo com página feita à mão (campo `url` apontando pra /artigos/post/<slug>/): o texto vive
//   só nesse HTML, então a página nova é uma cópia dele com canonical/Open Graph, e a página antiga
//   ganha canonical pra /artigos/<slug>/. Página feita à mão de artigo não publicado ganha noindex.
// - Só são apagadas páginas que têm a marca GERADO abaixo — nada feito à mão é removido.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToBlocks } from "../assets/js/markdown.js";

const SITE = "https://imigrantepordentro.com";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GERADO = "<!-- gerado por scripts/gerar-artigos.mjs a partir de content/posts.json: não edite à mão -->";
const RESERVADOS = new Set(["post", "categoria"]); // pastas que já existem em /artigos/
// Páginas fixas do site que também entram no sitemap.
const PAGINAS_FIXAS = ["/", "/artigos/", "/guias/", "/guias/vls-ts-validacao-travou/", "/sobre/", "/produtos-digitais/", "/produtos-de-estudo/", "/produtos-de-compras/", "/assistente-de-vistos/"];

const ler = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(ROOT, rel));
function gravarSeMudou(rel, conteudo) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === conteudo) return false;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, conteudo);
  return true;
}

function hojeISO() {
  // Data de Paris: é o fuso da Ingryd e de quem lê.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function publicado(post) {
  if (!post) return false;
  if (typeof post.status === "string" && post.status) {
    if (post.status === "publicado") return true;
    if (post.status === "agendado") return !!post.date && String(post.date).slice(0, 10) <= hojeISO();
    return false;
  }
  return post.published === true;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textoPuro(html) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cortar(s, max) {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  return corte.slice(0, corte.lastIndexOf(" ") > 80 ? corte.lastIndexOf(" ") : corte.length) + "…";
}

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

const urlAbsoluta = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : SITE + (u.startsWith("/") ? u : "/" + u));
const urlDoArtigo = (slug) => `${SITE}/artigos/${slug}/`;

// Corpo do artigo como o template monta, sem as partes que dependem do navegador (propaganda,
// vitrine, ferramentas): os marcadores [[...]] que sobram viram nada; o JS desenha por cima.
function corpoEstatico(post) {
  const blocos = markdownToBlocks(post.body || "", { slug: post.slug });
  let html = blocos.join("\n").replace(/<p>\[\[[^\]]*\]\]<\/p>/g, "");
  const usados = new Set();
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_, dentro) => {
    const base =
      textoPuro(dentro)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "secao";
    let id = base;
    for (let n = 2; usados.has(id); n++) id = base + "-" + n;
    usados.add(id);
    return `<h2 id="${id}">${dentro}</h2>`;
  });
  return html;
}

function descricao(post, corpoHtml) {
  const base = post.excerpt || textoPuro((corpoHtml.match(/<p>(?!\s*\[\[)[\s\S]*?<\/p>/) || [""])[0]);
  return cortar(textoPuro(base), 160);
}

// Bloco de SEO do <head>. `comTituloEDescricao` = false para as páginas feitas à mão, que já têm os
// dois escritos por alguém.
function blocoSeo(post, desc, { comTituloEDescricao = true } = {}) {
  const url = urlDoArtigo(post.slug);
  const imagem = urlAbsoluta(post.image);
  const publicadoEm = post.date ? String(post.date).slice(0, 10) : "";
  const atualizadoEm = post.updatedDate ? String(post.updatedDate).slice(0, 10) : publicadoEm;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: desc,
    inLanguage: "pt-BR",
    mainEntityOfPage: url,
    ...(imagem && { image: [imagem] }),
    ...(publicadoEm && { datePublished: publicadoEm }),
    ...(atualizadoEm && { dateModified: atualizadoEm }),
    author: { "@type": "Person", name: "Ingryd", url: `${SITE}/sobre/` },
    publisher: { "@type": "Organization", name: "Por Dentro", logo: { "@type": "ImageObject", url: `${SITE}/images/logo-por-dentro.png` } },
  };
  const linhas = [];
  if (comTituloEDescricao) {
    linhas.push(`<title>${esc(post.title)} — Por Dentro</title>`, `<meta name="description" content="${esc(desc)}">`);
  }
  linhas.push(
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Por Dentro">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:title" content="${esc(post.title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    ...(imagem ? [`<meta property="og:image" content="${esc(imagem)}">`] : []),
    ...(publicadoEm ? [`<meta property="article:published_time" content="${publicadoEm}">`] : []),
    ...(atualizadoEm ? [`<meta property="article:modified_time" content="${atualizadoEm}">`] : []),
    `<meta name="twitter:card" content="${imagem ? "summary_large_image" : "summary"}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`
  );
  return linhas.join("\n");
}

// Tira do <head> o que o bloco de SEO vai repor (canonical, robots, Open Graph, Twitter).
function limparHead(html) {
  return html
    .replace(/^[ \t]*<link rel="canonical"[^>]*>\r?\n?/gim, "")
    .replace(/^[ \t]*<meta name="robots"[^>]*>\r?\n?/gim, "")
    .replace(/^[ \t]*<meta (property="(og|article):[^"]*"|name="twitter:[^"]*")[^>]*>\r?\n?/gim, "");
}

const marcar = (html) => html.replace(/^<!DOCTYPE html>\r?\n?/i, (m) => m + GERADO + "\n");

// O slug também vai no <body>: header.js, main.js, share-button.js e o template leem dali quando
// a URL não tem ?slug=.
function comSlugNoBody(html, slug) {
  return html.replace(/<body([^>]*)>/i, (m, attrs) => (/data-article-slug=/.test(attrs) ? m : `<body${attrs} data-article-slug="${esc(slug)}">`));
}

function paginaDoTemplate(template, post) {
  const corpo = corpoEstatico(post);
  const desc = descricao(post, corpo);
  const atualizado = post.updatedDate || post.date;
  const artigo =
    "<article>" +
    '<div class="article-header">' +
    '<span class="eyebrow" style="color:#604034;">' + esc(post.category) + "</span>" +
    "<h1>" + esc(post.title) + "</h1>" +
    '<div class="article-meta">' + esc(formatarData(post.date)) + (post.readMinutes ? " · " + esc(post.readMinutes) + " min de leitura" : "") + "</div>" +
    (atualizado ? '<div class="article-updated">↻ Atualizado em ' + esc(formatarData(atualizado)) + "</div>" : "") +
    "</div>\n" +
    '<div class="article-body">\n' + corpo + "\n</div>" +
    "</article>";
  let html = limparHead(template).replace(/<title>[\s\S]*?<\/title>/i, blocoSeo(post, desc));
  if (!html.includes('id="article-root">\n      <p class="muted">Carregando artigo...</p>')) {
    throw new Error("artigos/post/index.html mudou: não achei o '#article-root' com 'Carregando artigo...'. Ajuste scripts/gerar-artigos.mjs.");
  }
  html = html.replace('<p class="muted">Carregando artigo...</p>', artigo);
  return marcar(comSlugNoBody(html, post.slug));
}

function paginaFeitaAMao(fonte, post) {
  const desc = (fonte.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || descricao(post, corpoEstatico(post));
  let html = limparHead(fonte);
  const temDescricao = /<meta name="description"/i.test(html);
  const bloco = (temDescricao ? "" : `<meta name="description" content="${esc(desc)}">\n`) + blocoSeo(post, textoPuro(desc), { comTituloEDescricao: false });
  html = html.replace(/<\/head>/i, bloco + "\n</head>");
  return marcar(comSlugNoBody(html, post.slug));
}

// Ajusta a página feita à mão em /artigos/post/<slug>/: canonical pro endereço novo se o artigo está
// no ar; noindex se não está. Os redirecionamentos antigos passam a mandar direto pro endereço novo.
function ajustarPaginaAntiga(html, post, noAr) {
  const ehRedirecionamento = /http-equiv="refresh"/i.test(html);
  if (ehRedirecionamento) {
    if (!noAr) return html;
    const novo = `/artigos/${post.slug}/`;
    return html
      .split(`/artigos/post/?slug=${post.slug}`).join(novo)
      .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${urlDoArtigo(post.slug)}">`);
  }
  let limpo = html.replace(/^[ \t]*<link rel="canonical"[^>]*>\r?\n?/gim, "").replace(/^[ \t]*<meta name="robots"[^>]*>\r?\n?/gim, "");
  const linha = noAr ? `<link rel="canonical" href="${urlDoArtigo(post.slug)}">` : `<meta name="robots" content="noindex">`;
  return limpo.replace(/<\/head>/i, linha + "\n</head>");
}

function sitemap(entradas) {
  const urls = entradas
    .map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const ROBOTS = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /acesso-vip/

Sitemap: ${SITE}/sitemap.xml
`;

function main() {
  const posts = JSON.parse(ler("content/posts.json")).items || [];
  const template = ler("artigos/post/index.html");
  const log = { geradas: [], mudadas: [], apagadas: [], antigas: [], avisos: [] };
  const noAr = new Set();
  const entradas = PAGINAS_FIXAS.filter((p) => existe(path.join(p, "index.html"))).map((p) => ({ loc: SITE + p }));

  for (const post of posts) {
    const slug = post && post.slug;
    if (!slug) continue;
    const antiga = `artigos/post/${slug}/index.html`;
    const vivo = publicado(post);

    // Páginas feitas à mão em /artigos/post/<slug>/ (cópia de conteúdo ou redirecionamento).
    if (existe(antiga)) {
      const atual = ler(antiga);
      const ajustada = ajustarPaginaAntiga(atual, post, vivo);
      if (ajustada !== atual && gravarSeMudou(antiga, ajustada)) log.antigas.push(`${antiga} (${vivo ? "canonical" : "noindex"})`);
    }
    if (!vivo) continue;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVADOS.has(slug)) {
      log.avisos.push(`slug "${slug}" não serve como endereço (/artigos/${slug}/): página não gerada.`);
      continue;
    }

    let html;
    if (post.url) {
      const fonte = post.url.replace(/^\//, "").replace(/\/?$/, "/") + "index.html";
      if (!post.url.startsWith("/artigos/post/") || !existe(fonte) || /http-equiv="refresh"/i.test(ler(fonte))) {
        log.avisos.push(`"${slug}" tem url=${post.url}, mas não há página feita à mão lá: página não gerada.`);
        continue;
      }
      html = paginaFeitaAMao(ler(fonte), post);
    } else {
      html = paginaDoTemplate(template, post);
    }

    const destino = `artigos/${slug}/index.html`;
    if (existe(destino) && !ler(destino).includes(GERADO)) {
      log.avisos.push(`${destino} existe e não foi gerado por este script: não mexi.`);
      continue;
    }
    noAr.add(slug);
    if (gravarSeMudou(destino, html)) log.geradas.push(destino);
    const lastmod = String(post.updatedDate || post.date || "").slice(0, 10);
    entradas.push({ loc: urlDoArtigo(slug), lastmod: /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? lastmod : "" });
  }

  // Apaga páginas geradas de artigos que saíram do ar (ou mudaram de slug).
  for (const nome of fs.readdirSync(path.join(ROOT, "artigos"))) {
    const rel = `artigos/${nome}/index.html`;
    if (RESERVADOS.has(nome) || noAr.has(nome) || !existe(rel)) continue;
    if (ler(rel).includes(GERADO)) {
      fs.rmSync(path.join(ROOT, "artigos", nome), { recursive: true });
      log.apagadas.push(rel);
    }
  }

  if (gravarSeMudou("sitemap.xml", sitemap(entradas))) log.mudadas.push("sitemap.xml");
  if (gravarSeMudou("robots.txt", ROBOTS)) log.mudadas.push("robots.txt");

  console.log(`Artigos no ar: ${noAr.size}. Páginas escritas: ${log.geradas.length}. Apagadas: ${log.apagadas.length}.`);
  for (const [k, v] of Object.entries(log)) for (const linha of v) console.log(`  ${k}: ${linha}`);
}

main();
