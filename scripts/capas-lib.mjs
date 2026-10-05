// Por Dentro — nome do PNG da capa por palavra-chave (usado por gerar-capas.mjs e gerar-artigos.mjs).
//
// A capa por palavra-chave (assets/js/cover.js) é desenhada no navegador, então não existe como
// arquivo. Redes sociais e WhatsApp precisam de PNG/JPG no og:image: gerar-capas.mjs desenha a
// capa num navegador sem tela e grava /images/capas/<slug>-<hash>.png. O hash vem dos campos que
// aparecem na capa e do próprio cover.js: mudou a palavra, o formato ou o desenho, o nome muda
// (e a rede social não serve a imagem antiga do cache).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PASTA = "images/capas";

const coverJs = () => fs.readFileSync(path.join(ROOT, "assets/js/cover.js"), "utf8");

function tags(post) {
  let t = post.coverTags;
  if (typeof t === "string") t = t.split(",");
  return Array.isArray(t) ? t.map((x) => String(x && x.tag != null ? x.tag : x).trim()).filter(Boolean).slice(0, 3) : [];
}

// Só artigo com palavra-chave e SEM foto própria ganha capa em PNG: a foto, quando existe, manda.
export function precisaDeCapa(post) {
  return !!(post && String(post.coverKeyword || "").trim() && !post.image);
}

export function nomeDaCapa(post, js = coverJs()) {
  const dados = JSON.stringify([
    post.category || "", String(post.coverKeyword || "").trim(), tags(post), post.coverFormat || "Guia",
    post.readMinutes || "", String(post.updatedDate || post.date || "").slice(0, 4), post.title || "", js
  ]);
  const hash = crypto.createHash("sha1").update(dados).digest("hex").slice(0, 8);
  return `${PASTA}/${post.slug}-${hash}.png`;
}
