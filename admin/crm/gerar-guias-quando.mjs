// Gera guias-quando.json: o texto "quando" de cada passo do checklist, copiado de content/checklist-templates.json do app.
// A prévia do Início (ficha.js) usa para escrever o prazo curto dos "Em seguida", como o app.
// Uso: node admin/crm/gerar-guias-quando.mjs <caminho do por-dentro-app>   (o teste ficha-inicio-app.test.mjs avisa se estiver velho)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function extrairQuando(templates) {
  const out = {};
  const anda = (l) => (Array.isArray(l) ? l : []).forEach((it) => { if (it && it.key && it.quando && !(it.key in out)) out[it.key] = it.quando; });
  Object.keys(templates).forEach((k) => { if (Array.isArray(templates[k])) anda(templates[k]); else if (k === 'profissao_regulamentada') Object.values(templates[k]).forEach(anda); });
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = process.argv[2]; if (!app) { console.error('Passe o caminho do repositório do app.'); process.exit(1); }
  const t = JSON.parse(readFileSync(path.join(app, 'content/checklist-templates.json'), 'utf8'));
  writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'guias-quando.json'), JSON.stringify(extrairQuando(t), null, 0));
}
