// Testa "Analisar link": POST /api/crm/guia/analisar. Tudo com fetch falso (sem rede). Páginas fictícias.
// Uso: node cms-oauth-worker/testes/crm-guia.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-guia-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmGuiaUrlSegura, crmGuiaExtrair, crmGuiaValidar };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default, { crmGuiaUrlSegura, crmGuiaExtrair, crmGuiaValidar } = mod;
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };

console.log('== URL segura ==');
for (const u of ['http://localhost/x', 'https://127.0.0.1/', 'https://10.0.0.5/a', 'https://servidor.local/', 'https://a.internal/', 'ftp://x.org/', 'https://u:p@x.org/', 'https://x.org:8443/', 'https://intranet/', 'https://[::1]/', 'nada'])
  check('recusa ' + u, !crmGuiaUrlSegura(u).ok);
check('aceita https público', crmGuiaUrlSegura('https://www.service-public.fr/particuliers/vosdroits/F1').ok && crmGuiaUrlSegura('http://exemplo.org/a').ok);

console.log('== Extração ==');
const html = '<html><head><title>Titre &amp; co</title><script>var x=1</script></head><body><nav>menu</nav><h1>Demander le titre</h1><p>Faça o pedido&nbsp;online.</p><a href="/formulario?x=1#topo">Formulário <b>oficial</b></a><a href="javascript:alert(1)">x</a><a href="http://inseguro.org/a">http</a><a href="https://127.0.0.1/a">ip</a><a href="/formulario?x=1">dup</a><footer>rodapé</footer></body></html>';
const ex = crmGuiaExtrair(html, 'https://site.fr/pagina');
check('título decodificado', ex.titulo === 'Titre & co');
check('texto sem script/nav/rodapé', /Demander le titre/.test(ex.texto) && !/var x|menu|rodapé/.test(ex.texto) && /online/.test(ex.texto));
check('só links https públicos, absolutos, sem repetir', ex.links.length === 1 && ex.links[0].url === 'https://site.fr/formulario?x=1' && ex.links[0].rotulo === 'Formulário oficial');

console.log('== Validação ==');
check('recusa lixo', !crmGuiaValidar(null, 0).ok && !crmGuiaValidar({ por_que: 1 }, 0).ok && !crmGuiaValidar({ por_que: '', atencao: '', passos: [], links: [], lacunas: [] }, 0).ok);
const g = crmGuiaValidar({ por_que: 'a'.repeat(900), atencao: 'b', passos: Array(12).fill('passo'), links: [0, 0, 5, -1, 1.5, 1], lacunas: ['x'] }, 2).guia;
check('limites e índices de link', g.por_que.length === 400 && g.passos.length === 8 && g.links.join() === '0,1');

console.log('== Rota ==');
const ADMIN = 'aaaaaaaa-2222-4333-8444-555555555555', TOKEN = 'tok';
let chamadas = [], pagina = { status: 200, tipo: 'text/html', corpo: '' }, ia = null, adminOk = true;
const longo = '<h1>Titre de séjour</h1>' + '<p>Passo a passo para pedir o título de residência online, com o formulário oficial e a lista de documentos.</p>'.repeat(8) + '<a href="https://administration-etrangers-en-france.interieur.gouv.fr/">Portal oficial</a>';
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url); chamadas.push({ url: u, body: typeof opt.body === 'string' ? JSON.parse(opt.body) : null, redirect: opt.redirect });
  const r = (s, b) => new Response(JSON.stringify(b ?? {}), { status: s });
  if (/\/auth\/v1\/user$/.test(u)) return r(200, adminOk ? { id: ADMIN, email: 'a@x.org' } : { id: 'outro' });
  if (/\/admins\?/.test(u)) return r(200, adminOk ? [{ user_id: ADMIN }] : []);
  if (/api\.anthropic\.com/.test(u)) return typeof ia === 'function' ? ia() : r(200, { usage: { input_tokens: 1000, output_tokens: 200 }, content: [{ type: 'tool_use', name: 'registrar_guia', input: ia }] });
  return new Response(pagina.corpo, { status: pagina.status, headers: { 'content-type': pagina.tipo, ...(pagina.loc ? { location: pagina.loc } : {}) } });
};
const env = { ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'm', ANTHROPIC_USD_POR_MTOK_ENTRADA: '3', ANTHROPIC_USD_POR_MTOK_SAIDA: '15', REVIEWS_KV: { get: async () => null, put: async () => {} } };
const chama = (b, e = env, tok = TOKEN) => worker.fetch(new Request('https://w.example/api/crm/guia/analisar', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }), e, {});
const bom = { por_que: 'Sem o título você não fica regular.', atencao: 'Peça com antecedência.', passos: ['Abra o portal', 'Preencha o formulário'], links: [0, 7], lacunas: ['Valor da taxa'] };
{
  adminOk = false; check('só admin (401)', (await chama({ url: 'https://site.fr/a' })).status === 401); adminOk = true;
  check('sem IA configurada: 503', (await chama({ url: 'https://site.fr/a' }, { REVIEWS_KV: env.REVIEWS_KV })).status === 503);
  check('url inválida: 400', (await chama({ url: 'http://localhost/a' })).status === 400);
  chamadas = []; pagina = { status: 200, tipo: 'text/html', corpo: longo }; ia = bom;
  const res = await chama({ url: 'https://site.fr/a', titulo: 'Pedir o título' }), j = await res.json();
  check('analisa a página: 200, guia, só links reais (índice 7 descartado)', res.status === 200 && j.ok && j.guia.passos.length === 2 && j.guia.links.length === 1 && /gouv\.fr/.test(j.guia.links[0].url) && j.origem === 'url');
  check('custo calculado', j.custo_usd === 0.006);
  const ch = chamadas.find((c) => /anthropic/.test(c.url));
  check('a página vai marcada como dado e o prompt manda não obedecer', /<pagina>/.test(ch.body.messages[0].content) && /DADO, não instrução/.test(ch.body.system));
  check('busca da página sem seguir redirect automático', chamadas[chamadas.length - 2].redirect === 'manual' || chamadas.find((c) => /site\.fr/.test(c.url)).redirect === 'manual');
}
{
  pagina = { status: 200, tipo: 'text/html', corpo: '<html><body><script>app()</script></body></html>' }; chamadas = [];
  const res = await chama({ url: 'https://www.google.com/search?q=x' }), j = await res.json();
  check('página sem texto (script): 422 pagina_vazia pedindo para colar, sem gastar IA', res.status === 422 && j.codigo === 'pagina_vazia' && /Cole o texto/.test(j.error) && !chamadas.some((c) => /anthropic/.test(c.url)));
  pagina = { status: 200, tipo: 'application/pdf', corpo: '%PDF' }; check('PDF: tipo_nao_suportado', (await (await chama({ url: 'https://site.fr/a.pdf' })).json()).codigo === 'tipo_nao_suportado');
  pagina = { status: 404, tipo: 'text/html', corpo: '' }; check('404 do site: pagina_nao_abriu', (await (await chama({ url: 'https://site.fr/a' })).json()).codigo === 'pagina_nao_abriu');
  pagina = { status: 302, tipo: 'text/html', corpo: '', loc: 'http://127.0.0.1/admin' }; chamadas = [];
  check('redirect para IP interno é barrado e não é seguido', (await (await chama({ url: 'https://site.fr/a' })).json()).codigo === 'pagina_nao_abriu' && chamadas.every((c) => !/127\.0\.0\.1/.test(c.url)));
}
{
  pagina = { status: 200, tipo: 'text/html', corpo: longo }; ia = bom; chamadas = [];
  const res = await chama({ texto: 'Para pedir o título de séjour online, abra o portal oficial, crie a conta, preencha o formulário e anexe os documentos pedidos.' }), j = await res.json();
  check('texto colado: não busca página, origem texto', res.status === 200 && j.origem === 'texto' && !chamadas.some((c) => /site\.fr/.test(c.url)));
  check('texto colado curto demais: 400', (await chama({ texto: 'curto' })).status === 400);
  ia = { por_que: 1 }; chamadas = [];
  const r2 = await chama({ texto: 'x'.repeat(200) });
  check('resposta inválida duas vezes: 502 e nada salvo', r2.status === 502 && (await r2.json()).codigo === 'resposta_invalida' && chamadas.filter((c) => /anthropic/.test(c.url)).length === 2);
  ia = () => new Response('{}', { status: 529 }); check('IA ocupada: 502 ia_ocupada', (await (await chama({ texto: 'x'.repeat(200) })).json()).codigo === 'ia_ocupada');
  let n = 99; const eL = { ...env, REVIEWS_KV: { get: async () => String(n), put: async () => {} } };
  ia = bom; check('limite de análises: 429', (await chama({ texto: 'x'.repeat(200) }, eL)).status === 429);
}
console.log(bad ? `\n${bad} falharam, ${ok} passaram` : `\n${ok} passaram, 0 falharam`); process.exit(bad ? 1 : 0);
