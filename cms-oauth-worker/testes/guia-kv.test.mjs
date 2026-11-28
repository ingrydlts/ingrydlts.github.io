// Testa scripts/guia-kv.mjs (enviar, promover, voltar) contra uma API do Cloudflare de mentira, local: não toca na KV de verdade.
// Uso: node cms-oauth-worker/testes/guia-kv.test.mjs   (Node 20+, sem dependências)
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '../scripts/guia-kv.mjs');
const run = promisify(execFile);
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const kv = new Map(); let pedidos = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let corpo = '';
  req.on('data', (c) => (corpo += c)); req.on('end', () => {
    pedidos.push(req.method + ' ' + u.pathname);
    const m = /^\/accounts\/ACC\/storage\/kv\/namespaces\/NS(\/.*)$/.exec(u.pathname);
    const ok = (result) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, result })); };
    if (!m) { res.writeHead(404); return res.end('{}'); }
    const rota = m[1];
    if (req.method === 'GET' && rota === '/keys') { const p = u.searchParams.get('prefix') || ''; return ok([...kv.keys()].filter((k) => k.startsWith(p)).sort().map((name) => ({ name }))); }
    if (req.method === 'GET' && rota.startsWith('/values/')) { const k = decodeURIComponent(rota.slice(8)); if (!kv.has(k)) { res.writeHead(404); return res.end('{}'); } res.writeHead(200); return res.end(kv.get(k)); }
    if (req.method === 'PUT' && rota === '/bulk') { for (const i of JSON.parse(corpo)) kv.set(i.key, i.value); return ok({ successful_key_count: 1 }); }
    if (req.method === 'POST' && rota === '/bulk/delete') { for (const k of JSON.parse(corpo)) kv.delete(k); return ok({}); }
    res.writeHead(404); res.end('{}');
  });
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'ACC', KV_NAMESPACE_ID: 'NS', CLOUDFLARE_API_BASE: `http://localhost:${srv.address().port}`, CLOUDFLARE_API_TOKEN: 'x', NODE_NO_WARNINGS: '1', NODE_USE_ENV_PROXY: '0' };
delete env.HTTPS_PROXY; delete env.HTTP_PROXY; delete env.https_proxy; delete env.http_proxy;
const kvs = async (...args) => { try { const r = await run('node', [SCRIPT, ...args], { env }); return { ok: true, out: r.stdout }; } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; } };
const dir = mkdtempSync(path.join(tmpdir(), 'guia-kv-'));
const arq = (nome, itens) => { const f = path.join(dir, nome); writeFileSync(f, JSON.stringify(itens)); return f; };
const S = 'manual-x';
const pacote = (pre, v, caps = ['1', '2']) => [{ key: pre + 'pagina', value: 'casco ' + v }, { key: `${pre}manual:${S}`, value: 'indice ' + v }, ...caps.map((c) => ({ key: `${pre}cap:${S}:${c}`, value: `cap${c} ${v}` }))];

console.log('== Rascunho: só chaves de rascunho, nada no ar ==');
kv.set('guia:chave:' + 'A'.repeat(43), 'registro de comprador'); kv.set('guia:sessao:cs_1', 'tok');
let r = await kvs('enviar', arq('r1.json', pacote('guia:rascunho:', 'v1')));
check('enviar rascunho grava as 4 chaves e não cria nada no ar nem em "anterior"', r.ok && kv.get(`guia:rascunho:manual:${S}`) === 'indice v1' && ![...kv.keys()].some((k) => /^guia:(pagina|manual:|cap:|anterior:)/.test(k)));
check('as chaves de comprador (guia:chave, guia:sessao) ficam intactas', kv.get('guia:chave:' + 'A'.repeat(43)) === 'registro de comprador' && kv.get('guia:sessao:cs_1') === 'tok');

console.log('\n== Promover: o rascunho vai ao ar e o que estava no ar vira "anterior" ==');
pedidos = [];
r = await kvs('promover', S);
check('1ª promoção: casco, índice e capítulos no ar com o conteúdo do rascunho', r.ok && kv.get('guia:pagina') === 'casco v1' && kv.get(`guia:manual:${S}`) === 'indice v1' && kv.get(`guia:cap:${S}:2`) === 'cap2 v1');
check('o rascunho continua igual (promover copia, não move)', kv.get(`guia:rascunho:manual:${S}`) === 'indice v1');
await kvs('enviar', arq('r2.json', pacote('guia:rascunho:', 'v2', ['1'])));   // v2: o capítulo 2 saiu e o índice mudou
r = await kvs('promover', S);
check('2ª promoção: no ar fica a v2', r.ok && kv.get('guia:pagina') === 'casco v2' && kv.get(`guia:manual:${S}`) === 'indice v2' && kv.get(`guia:cap:${S}:1`) === 'cap1 v2');
check('o capítulo que saiu do rascunho sai do ar', !kv.has(`guia:cap:${S}:2`) && /saíram do ar/.test(r.out));
check('o que estava no ar (v1) ficou em guia:anterior:..., inclusive o capítulo que saiu', kv.get('guia:anterior:pagina') === 'casco v1' && kv.get(`guia:anterior:manual:${S}`) === 'indice v1' && kv.get(`guia:anterior:cap:${S}:2`) === 'cap2 v1');

console.log('\n== Voltar: devolve a versão de antes da última promoção ==');
r = await kvs('voltar', S);
check('volta a v1 no ar, com o capítulo 2 de volta', r.ok && kv.get('guia:pagina') === 'casco v1' && kv.get(`guia:manual:${S}`) === 'indice v1' && kv.get(`guia:cap:${S}:2`) === 'cap2 v1' && kv.get(`guia:cap:${S}:1`) === 'cap1 v1');
check('as chaves de comprador seguem intactas depois de tudo', kv.get('guia:chave:' + 'A'.repeat(43)) === 'registro de comprador' && kv.get('guia:sessao:cs_1') === 'tok');

console.log('\n== Recusas: nada é alterado ==');
kv.delete('guia:rascunho:pagina');
const antes = JSON.stringify([...kv.entries()]);
r = await kvs('promover', S);
check('rascunho sem o casco: recusa e não altera nada', !r.ok && /incompleto/.test(r.out) && JSON.stringify([...kv.entries()]) === antes);
r = await kvs('promover', 'Slug Ruim');
check('slug fora do formato: recusa', !r.ok);
r = await kvs('voltar', 'produto-sem-anterior');
check('voltar sem versão anterior guardada: recusa e não altera nada', !r.ok && /Não há versão anterior/.test(r.out) && JSON.stringify([...kv.entries()]) === antes);
r = await kvs('enviar', arq('ruim.json', [{ key: 'outra-coisa:x', value: 'y' }]));
check('arquivo com chave fora de guia:... é recusado (não escreve em outras chaves da KV)', !r.ok && !kv.has('outra-coisa:x'));

console.log('\n== Enviar direto ao ar guarda o anterior ==');
r = await kvs('enviar', arq('ar.json', pacote('guia:', 'v3', ['1'])));
check('enviar chaves do ar: o que estava lá vai para guia:anterior:... antes', r.ok && kv.get('guia:pagina') === 'casco v3' && kv.get('guia:anterior:pagina') === 'casco v1' && kv.get(`guia:anterior:manual:${S}`) === 'indice v1');

srv.close(); rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
