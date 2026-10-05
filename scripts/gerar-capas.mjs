// Por Dentro — gera o PNG (1600×900) da capa por palavra-chave de cada artigo publicado sem foto.
//
// Uso:
//   node scripts/gerar-capas.mjs --pendentes   só diz quantas capas faltam (não precisa de navegador)
//   node scripts/gerar-capas.mjs               desenha as que faltam e apaga as antigas
//
// Desenha com o próprio assets/js/cover.js dentro de um Chromium sem tela, então o PNG sai
// igual à capa que aparece no site. Precisa do pacote `playwright` (ou `playwright-core` + a
// variável CHROME_PATH apontando pro Chrome instalado). A Action instala só quando há capa pendente.
import fs from "node:fs";
import path from "node:path";
import { ROOT, PASTA, precisaDeCapa, nomeDaCapa } from "./capas-lib.mjs";

const posts = (JSON.parse(fs.readFileSync(process.env.POSTS_JSON || path.join(ROOT, "content/posts.json"), "utf8")).items || []);

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}
// mesma regra de gerar-artigos.mjs: só o que está no ar precisa de imagem de compartilhamento
function noAr(p) {
  if (p.status === "publicado") return true;
  if (p.status === "agendado") return !!p.date && String(p.date).slice(0, 10) <= hojeISO();
  return !p.status && p.published === true;
}

const alvo = posts.filter((p) => noAr(p) && precisaDeCapa(p)).map((p) => ({ post: p, rel: nomeDaCapa(p) }));
const faltam = alvo.filter((a) => !fs.existsSync(path.join(ROOT, a.rel)));

if (process.argv.includes("--pendentes")) {
  console.log(faltam.length);
  process.exit(0);
}

if (faltam.length) {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("playwright-core")); }
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const coverJs = fs.readFileSync(path.join(ROOT, "assets/js/cover.js"), "utf8");
  for (const { post, rel } of faltam) {
    await page.setContent(
      '<!doctype html><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">' +
      "<style>html,body{margin:0;background:#fff}</style><body></body>",
      { waitUntil: "networkidle" }
    );
    await page.addScriptTag({ content: coverJs });
    await page.evaluate((p) => { document.body.innerHTML = window.PDCover.html(p); }, post);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(["600 40px Fraunces", "500 20px Inter", "700 20px Inter"].map((f) => document.fonts.load(f))));
    const png = await page.locator(".pdc").screenshot({ type: "png" });
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, png);
    console.log("capa gerada:", rel);
  }
  await browser.close();
}

// Limpeza: PNG de artigo que mudou de capa, ganhou foto ou saiu do ar.
const vivos = new Set(alvo.map((a) => path.basename(a.rel)));
const dir = path.join(ROOT, PASTA);
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".png") && !vivos.has(f)) { fs.unlinkSync(path.join(dir, f)); console.log("capa antiga apagada:", f); }
  }
}
