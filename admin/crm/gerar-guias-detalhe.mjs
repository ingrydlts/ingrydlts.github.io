// Gera guias-detalhe.json: o que o app mostra ao abrir um passo do checklist (para que serve, dica, passo a passo, links), copiado de
// content/checklist-templates.json do app. O "quadro do passo" do CRM usa para mostrar à Ingryd exatamente o que ela lê.
// Chave = key do passo (a primeira ocorrência vence, como no app). Campos curtos: c categoria, l rótulo, q quando, p para que serve, t dica, s passos, k links.
// Uso: node admin/crm/gerar-guias-detalhe.mjs <caminho do por-dentro-app>   (o teste quadro-passo.test.mjs avisa se estiver velho)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function extrairDetalhe(templates) {
  const out = {};
  const anda = (l) => (Array.isArray(l) ? l : []).forEach((it) => {
    if (!it || !it.key || it.key in out) return;
    const d = { c: it.category || '', l: it.label || '' };
    if (it.quando) d.q = it.quando;
    if (it.paraQueServe) d.p = it.paraQueServe;
    if (it.tip) d.t = it.tip;
    if (Array.isArray(it.steps) && it.steps.length) d.s = it.steps.filter((x) => typeof x === 'string');
    const k = (Array.isArray(it.links) ? it.links : []).filter((x) => x && x.label && (x.url || x.futuro)).map((x) => (x.url ? { l: x.label, u: x.url } : { l: x.label, f: 1 }));
    if (k.length) d.k = k;
    out[it.key] = d;
  });
  Object.keys(templates).forEach((k) => { if (Array.isArray(templates[k])) anda(templates[k]); else if (k === 'profissao_regulamentada') Object.values(templates[k]).forEach(anda); });
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = process.argv[2]; if (!app) { console.error('Passe o caminho do repositório do app.'); process.exit(1); }
  const t = JSON.parse(readFileSync(path.join(app, 'content/checklist-templates.json'), 'utf8'));
  writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'guias-detalhe.json'), JSON.stringify(extrairDetalhe(t), null, 0));
}
