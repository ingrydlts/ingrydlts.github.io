// Prepara o guia pago para a KV do Worker (seção 36 do README). NÃO guarda texto pago: lê o HTML do guia que você tem
// no seu computador e escreve, FORA do repositório, um arquivo para `wrangler kv bulk put`.
//
// O HTML do guia é um casco (HTML + CSS + JS) com o texto dentro de <script type="application/json" id="dados-exemplo">.
// Este script separa os dois: o casco vai sem texto (meta manual-api = /api/guia) e o texto vira o índice + um capítulo por chave.
//
// Uso:  node cms-oauth-worker/scripts/guia-preparar.mjs <guia.html> <slug> <pasta-de-saida>
//   ex. node cms-oauth-worker/scripts/guia-preparar.mjs ~/Downloads/manual.html manual-destrave-ameli ~/guia-kv
// Depois: npx wrangler kv bulk put <pasta-de-saida>/kv-bulk.json --binding REVIEWS_KV --remote
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [arq, slug, saida] = process.argv.slice(2);
if (!arq || !slug || !saida || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Uso: node guia-preparar.mjs <guia.html> <slug> <pasta-de-saida>');
  process.exit(1);
}
const html = readFileSync(arq, 'utf8');
const dadosRe = /<script type="application\/json" id="dados-exemplo">([\s\S]*?)<\/script>/;
const m = dadosRe.exec(html);
if (!m) { console.error('Não achei <script type="application/json" id="dados-exemplo"> no HTML.'); process.exit(1); }
const dados = JSON.parse(m[1]);
if (!dados.meta || !Array.isArray(dados.capitulos) || !dados.capitulos.length) { console.error('O JSON não tem meta e capitulos.'); process.exit(1); }

const ids = dados.capitulos.map((c) => String(c.id));
if (new Set(ids).size !== ids.length || ids.some((i) => !/^[A-Za-z0-9_-]{1,40}$/.test(i))) { console.error('Ids de capítulo repetidos ou com caracteres inválidos: ' + ids.join(', ')); process.exit(1); }

// 1. casco: sem texto pago, apontando para a API do Worker
let casco = html.replace(dadosRe, '<script type="application/json" id="dados-exemplo">{"meta":{},"capitulos":[]}</script>');
if (!/<meta name="manual-api" content="[^"]*">/.test(casco)) { console.error('Não achei <meta name="manual-api" content="">.'); process.exit(1); }
casco = casco.replace(/<meta name="manual-api" content="[^"]*">/, '<meta name="manual-api" content="/api/guia">');
if (casco.includes(dados.capitulos[0].titulo)) { console.error('O casco ainda contém texto do guia; abortei.'); process.exit(1); }

// O painel "Prévia: testar os 4 estados" é só do artefato de design ("não vai para a página real"): sai do casco.
const ini = casco.indexOf('<details class="prev" id="prev-root">');
if (ini >= 0) {
  let prof = 0, i = ini, fim = -1;
  for (const t of casco.slice(ini).matchAll(/<(\/?)details\b/g)) { prof += t[1] ? -1 : 1; if (prof === 0) { fim = ini + t.index + '</details>'.length; break; } }
  if (fim < 0) { console.error('Não achei o fim do painel de prévia.'); process.exit(1); }
  casco = casco.slice(0, ini) + casco.slice(fim);
}
if (casco.includes('id="prev-root"')) { console.error('O painel de prévia continua no casco; abortei.'); process.exit(1); }

// 2. índice: meta + capítulos sem "grupos" (o casco pede cada capítulo quando abre)
const manual = { meta: dados.meta, capitulos: dados.capitulos.map(({ grupos, ...resto }) => resto) };

const itens = [
  { key: 'guia:pagina', value: casco },
  { key: `guia:manual:${slug}`, value: JSON.stringify(manual) },
  ...dados.capitulos.map((c) => ({ key: `guia:cap:${slug}:${c.id}`, value: JSON.stringify(c) })),
];
mkdirSync(saida, { recursive: true });
writeFileSync(path.join(saida, 'kv-bulk.json'), JSON.stringify(itens));
console.log(`Pronto em ${saida}/kv-bulk.json: ${itens.length} chaves (casco ${(casco.length / 1024).toFixed(0)} KB, índice ${(JSON.stringify(manual).length / 1024).toFixed(0)} KB, ${dados.capitulos.length} capítulos).`);
console.log(`Versão ${dados.meta.versao}, estado "${dados.meta.estado}", atualizado em ${dados.meta.ultima_atualizacao}.`);
if (dados.meta.estado && /rascunho/i.test(dados.meta.estado)) console.log('ATENÇÃO: o estado do guia ainda é "rascunho" e o comprador vai ver isso. Troque no JSON antes de vender, se já estiver aprovado.');
