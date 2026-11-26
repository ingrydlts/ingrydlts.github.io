// Publica o guia na KV do Worker pela API do Cloudflare, SEM expor o texto no repositório e guardando sempre a versão anterior.
// Feito para ser usado pelo Claude a pedido ("publica no rascunho", "promove", "volta a versão anterior"), mas funciona na mão.
//
//   enviar <kv-bulk.json>    grava as chaves do arquivo (saída de guia-preparar.mjs). Se forem chaves do AR (guia:...), antes copia o
//                            que está lá para guia:anterior:... ; se forem de rascunho (guia:rascunho:...), grava direto.
//   promover <slug>          copia o RASCUNHO do produto para o AR (guardando antes o que estava no ar em guia:anterior:...)
//   voltar <slug>            devolve ao AR o que estava em guia:anterior:... (a versão de antes da última promoção)
//   listar                   mostra as chaves guia:* (sem os valores)
//
// Variáveis: CLOUDFLARE_ACCOUNT_ID (obrigatória), KV_NAMESPACE_ID (padrão: o id da REVIEWS_KV em wrangler.toml) e CLOUDFLARE_API_TOKEN
// (token com SÓ "Workers KV Storage: Edit"; no ambiente do Claude o token é injetado pelo proxy e a variável pode ser qualquer texto).
// Node 22+ com NODE_USE_ENV_PROXY=1 quando houver proxy.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTA = process.env.CLOUDFLARE_ACCOUNT_ID;
const NS = process.env.KV_NAMESPACE_ID || (/\[\[kv_namespaces\]\][^\[]*?binding\s*=\s*"REVIEWS_KV"[^\[]*?id\s*=\s*"([0-9a-f]{32})"/.exec(readFileSync(path.join(HERE, '../wrangler.toml'), 'utf8')) || [])[1];
if (!CONTA || !NS) { console.error('Faltam CLOUDFLARE_ACCOUNT_ID e/ou o id da KV (KV_NAMESPACE_ID ou wrangler.toml).'); process.exit(1); }
const BASE = `${process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4'}/accounts/${CONTA}/storage/kv/namespaces/${NS}`;
const cab = () => ({ 'Content-Type': 'application/json', ...(process.env.CLOUDFLARE_API_TOKEN ? { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN } : {}) });
async function cf(caminho, opt = {}) {
  const r = await fetch(BASE + caminho, { ...opt, headers: { ...cab(), ...(opt.headers || {}) } });
  if (opt.texto) return r.status === 404 ? null : r.ok ? r.text() : Promise.reject(new Error(`Cloudflare ${r.status} em ${caminho}`));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j;
}
async function chaves(prefixo) {
  const nomes = []; let cursor = '';
  do {
    const j = await cf(`/keys?prefix=${encodeURIComponent(prefixo)}&limit=1000${cursor ? '&cursor=' + cursor : ''}`);
    nomes.push(...j.result.map((k) => k.name)); cursor = (j.result_info && j.result_info.cursor) || '';
  } while (cursor);
  return nomes;
}
const ler = (k) => cf('/values/' + encodeURIComponent(k), { texto: true });
const gravar = (itens) => itens.length ? cf('/bulk', { method: 'PUT', body: JSON.stringify(itens) }) : null;
const apagar = (nomes) => nomes.length ? cf('/bulk/delete', { method: 'POST', body: JSON.stringify(nomes) }) : null;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// as chaves de UM produto, em cada canal (o casco "pagina" é um só por canal)
const doProduto = (nomes, canal, slug) => nomes.filter((k) => k === `${canal}pagina` || k === `${canal}manual:${slug}` || k.startsWith(`${canal}cap:${slug}:`));

async function guardarAnterior(destinoNomes, slug) {
  // copia o que está NO AR para guia:anterior:<resto>, antes de sobrescrever
  const atuais = [];
  for (const k of destinoNomes) { const v = await ler(k); if (v !== null) atuais.push({ key: 'guia:anterior:' + k.slice('guia:'.length), value: v }); }
  const velhos = (await chaves('guia:anterior:')).filter((k) => k === 'guia:anterior:pagina' || (slug && (k === `guia:anterior:manual:${slug}` || k.startsWith(`guia:anterior:cap:${slug}:`))));
  const novosNomes = new Set(atuais.map((a) => a.key));
  await apagar(velhos.filter((k) => !novosNomes.has(k)));
  await gravar(atuais);
  return atuais.length;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'listar') {
  for (const k of await chaves('guia:')) console.log(k);
} else if (cmd === 'enviar' && arg) {
  const itens = JSON.parse(readFileSync(arg, 'utf8'));
  if (!Array.isArray(itens) || !itens.every((i) => /^guia:/.test(i.key) && typeof i.value === 'string')) throw new Error('Arquivo inesperado: precisa ser uma lista de {key, value} com chaves guia:...');
  if (itens.some((i) => /^guia:(chave|sessao|anterior):/.test(i.key))) throw new Error('O arquivo não pode conter guia:chave, guia:sessao nem guia:anterior (são do Worker e do próprio script).');
  const rascunho = itens.every((i) => i.key.startsWith('guia:rascunho:'));
  const pre = rascunho ? 'guia:rascunho:' : 'guia:';
  const manual = itens.find((i) => i.key.startsWith(pre + 'manual:'));
  const slug = manual && manual.key.slice((pre + 'manual:').length);
  // o envio espelha o arquivo: capítulo que existia e não veio agora sai (no ar, a cópia fica em guia:anterior:)
  const sobra = slug ? (await chaves(`${pre}cap:${slug}:`)).filter((k) => !itens.some((i) => i.key === k)) : [];
  if (!rascunho) {
    const n = await guardarAnterior([...itens.map((i) => i.key), ...sobra], slug);
    console.log(`Guardei ${n} chave(s) do que estava no ar em guia:anterior:...`);
  }
  await gravar(itens);
  await apagar(sobra);
  console.log(`Enviei ${itens.length} chave(s) (${rascunho ? 'rascunho' : 'NO AR'})${sobra.length ? '; saíram: ' + sobra.join(', ') : ''}.`);
} else if (cmd === 'promover' && SLUG.test(arg || '')) {
  const rasc = doProduto(await chaves('guia:rascunho:'), 'guia:rascunho:', arg);
  if (!rasc.some((k) => k === `guia:rascunho:manual:${arg}`) || !rasc.includes('guia:rascunho:pagina')) throw new Error('O rascunho está incompleto (falta o casco ou o índice). Nada foi alterado.');
  const itens = [];
  for (const k of rasc) { const v = await ler(k); if (v === null) throw new Error('Sumiu do rascunho: ' + k); itens.push({ key: 'guia:' + k.slice('guia:rascunho:'.length), value: v }); }
  const antigos = doProduto(await chaves('guia:'), 'guia:', arg).filter((k) => !k.startsWith('guia:rascunho:') && !k.startsWith('guia:anterior:'));
  await guardarAnterior(antigos, arg);
  await gravar(itens);
  const sobrou = antigos.filter((k) => !itens.some((i) => i.key === k) && k.startsWith(`guia:cap:${arg}:`));
  await apagar(sobrou);   // capítulo que saiu do rascunho sai do ar (a cópia fica em guia:anterior:)
  console.log(`Promovi ${itens.length} chave(s) do rascunho para o ar${sobrou.length ? '; saíram do ar: ' + sobrou.join(', ') : ''}.`);
} else if (cmd === 'voltar' && SLUG.test(arg || '')) {
  const ant = (await chaves('guia:anterior:')).filter((k) => k === 'guia:anterior:pagina' || k === `guia:anterior:manual:${arg}` || k.startsWith(`guia:anterior:cap:${arg}:`));
  if (!ant.some((k) => k === `guia:anterior:manual:${arg}`)) throw new Error('Não há versão anterior guardada para ' + arg + '.');
  const itens = [];
  for (const k of ant) { const v = await ler(k); if (v !== null) itens.push({ key: 'guia:' + k.slice('guia:anterior:'.length), value: v }); }
  const atuais = doProduto(await chaves('guia:'), 'guia:', arg).filter((k) => !k.startsWith('guia:rascunho:') && !k.startsWith('guia:anterior:'));
  await gravar(itens);
  await apagar(atuais.filter((k) => k.startsWith(`guia:cap:${arg}:`) && !itens.some((i) => i.key === k)));
  console.log(`Voltei ${itens.length} chave(s) para a versão anterior.`);
} else {
  console.error('Uso: guia-kv.mjs listar | enviar <kv-bulk.json> | promover <slug> | voltar <slug>');
  process.exit(1);
}
