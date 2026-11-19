// Testa POST /api/rota/pedido: o pedido de acompanhamento que a página Rota da Sécu manda (opção + descrição + e-mail).
// O texto entra na Conversa da ficha (crm_conversa_texto, que já existe) e a Jornada ganha o evento pedido_acompanhamento.
// Tudo com fetch falso: não chama o Supabase. Pessoas fictícias. Nenhum SQL novo.
// Uso: node cms-oauth-worker/testes/crm-rota-pedido.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-rota-pedido-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const CID = '11111111-2222-4333-8444-555555555555';
const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv', REVIEWS_KV: { get: async () => null, put: async () => {} } };
const origErr = console.error; console.error = () => {};

let chamadas = [];
function instalar(o = {}) {
  const { contato = { id: CID, email: 'ana@example.com', nome: 'Ana Souza' }, veioDaRota = true, rpc = { ok: true }, eventoStatus = 201 } = o;
  chamadas = [];
  globalThis.fetch = async (url, opt = {}) => {
    let body = null;
    if (typeof opt.body === 'string') { try { body = JSON.parse(opt.body); } catch (e) { body = opt.body; } }
    const c = { url: String(url), method: opt.method || 'GET', body };
    chamadas.push(c);
    const r = (status, b) => new Response(status === 204 ? null : JSON.stringify(b ?? {}), { status });
    if (/\/rest\/v1\/contatos\?/.test(c.url)) return r(200, contato && c.url.includes(encodeURIComponent(contato.email)) ? [contato] : []);
    if (/\/rest\/v1\/eventos\?/.test(c.url) && c.method === 'GET') return r(200, veioDaRota ? [{ id: 1 }] : []);
    if (/\/rest\/v1\/rpc\/crm_conversa_texto/.test(c.url)) return r(200, rpc);
    if (/\/rest\/v1\/eventos$/.test(c.url) && c.method === 'POST') return r(eventoStatus, {});
    return r(404, {});
  };
}
const post = (b) => worker.fetch(new Request('https://w.example/api/rota/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://imigrantepordentro.com' }, body: JSON.stringify(b) }), env, { waitUntil() {} });
const OK = { email: 'Ana@Example.com ', acompanhamento: 'chamada', texto: 'Já enviei o pedido há duas semanas e nunca recebi resposta da CPAM.' };
const rpcs = () => chamadas.filter((c) => /rpc\/crm_conversa_texto/.test(c.url));
const eventos = () => chamadas.filter((c) => /\/rest\/v1\/eventos$/.test(c.url) && c.method === 'POST');

console.log('== Pedido válido ==');
instalar();
let res = await post(OK), j = await res.json();
check('200 e só { ok: true } (nada da ficha volta para o navegador)', res.status === 200 && JSON.stringify(j) === '{"ok":true}');
check('a resposta tem CORS aberto, como as outras rotas públicas', res.headers.get('Access-Control-Allow-Origin') === '*');
check('achou a ficha pelo e-mail em minúsculas e sem espaços', chamadas.some((c) => /contatos\?/.test(c.url) && c.url.includes('ana%40example.com')));
check('conferiu que a pessoa se cadastrou na Rota da Sécu (origem guia-rota-da-secu)', chamadas.some((c) => /eventos\?/.test(c.url) && /guia-rota-da-secu/.test(decodeURIComponent(c.url))));
check('a mensagem entra na Conversa: crm_conversa_texto com o contato, a opção e o texto', rpcs().length === 1 && rpcs()[0].body.p_contato === CID && /Pedido de orçamento: Ligue sem medo/.test(rpcs()[0].body.p_texto) && rpcs()[0].body.p_texto.includes('nunca recebi resposta da CPAM'));
check('a Jornada ganha o evento pedido_acompanhamento com a opção', eventos().length === 1 && eventos()[0].body.contato_id === CID && eventos()[0].body.tipo === 'pedido_acompanhamento' && eventos()[0].body.dados.acompanhamento === 'chamada' && eventos()[0].body.dados.origem === 'guia-rota-da-secu');
check('o evento não guarda o texto da pessoa (o texto fica só na Conversa)', !JSON.stringify(eventos()[0].body).includes('CPAM'));
for (const [id, rot] of [['email', 'Escreva sem erro'], ['mes', 'Resolva de ponta a ponta']]) {
  instalar(); await post({ ...OK, acompanhamento: id });
  check('opção ' + id + ' vira "' + rot + '"', rpcs().length === 1 && rpcs()[0].body.p_texto.includes('Pedido de orçamento: ' + rot));
}

console.log('\n== Recusas (nada é gravado) ==');
const recusas = [
  ['e-mail inválido', { ...OK, email: 'ana@exemplo' }, 400],
  ['sem e-mail', { ...OK, email: '' }, 400],
  ['opção fora da lista', { ...OK, acompanhamento: 'gratis' }, 400],
  ['texto curto demais', { ...OK, texto: 'ajuda' }, 400],
  ['texto longo demais', { ...OK, texto: 'a'.repeat(1501) }, 400],
  ['texto que não é texto', { ...OK, texto: { x: 1 } }, 400],
];
for (const [rot, corpo, st] of recusas) {
  instalar(); res = await post(corpo);
  check(rot + ': ' + st + ', sem consultar o banco nem gravar', res.status === st && chamadas.length === 0);
}
instalar(); res = await worker.fetch(new Request('https://w.example/api/rota/pedido', { method: 'POST', body: 'isso não é json' }), env, { waitUntil() {} });
check('corpo que não é JSON: 400', res.status === 400 && chamadas.length === 0);

console.log('\n== Quem não pode pedir ==');
instalar({ contato: null }); res = await post(OK); j = await res.json();
check('e-mail sem ficha: 404 "invalido", nada gravado', res.status === 404 && j.error === 'invalido' && rpcs().length === 0 && eventos().length === 0);
instalar({ veioDaRota: false }); res = await post(OK); const j2 = await res.json();
check('ficha que nunca se cadastrou na Rota: a MESMA resposta 404 (não revela quem existe), nada gravado', res.status === 404 && j2.error === 'invalido' && rpcs().length === 0 && eventos().length === 0);
instalar({ rpc: { erro: 'limite' } }); res = await post(OK);
check('limite do dia (10 textos por pessoa, regra que já existe no banco): 429 e nenhum evento', res.status === 429 && eventos().length === 0);
instalar({ rpc: { erro: 'contato' } }); res = await post(OK);
check('banco diz que o contato não existe: 404', res.status === 404);
instalar({ rpc: null }); globalThis.fetch = (f => async (u, o) => /rpc\/crm_conversa_texto/.test(String(u)) ? new Response('boom', { status: 500 }) : f(u, o))(globalThis.fetch); res = await post(OK);
check('erro do banco: 500 e nenhum evento', res.status === 500 && eventos().length === 0);
instalar({ eventoStatus: 500 }); res = await post(OK);
check('se só o evento falhar, o pedido já está na Conversa: continua 200', res.status === 200 && rpcs().length === 1);
instalar(); res = await worker.fetch(new Request('https://w.example/api/rota/pedido', { method: 'POST', body: JSON.stringify(OK) }), { REVIEWS_KV: env.REVIEWS_KV }, { waitUntil() {} });
check('Worker sem SUPABASE_SERVICE_ROLE_KEY: 500 "config"', res.status === 500 && (await res.json()).error === 'config');
instalar(); res = await worker.fetch(new Request('https://w.example/api/rota/pedido', { method: 'OPTIONS', headers: { Origin: 'https://imigrantepordentro.com', 'Access-Control-Request-Method': 'POST' } }), env, { waitUntil() {} });
check('pré-voo CORS (OPTIONS) é aceito', res.status === 204 || res.status === 200);

console.error = origErr;
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
