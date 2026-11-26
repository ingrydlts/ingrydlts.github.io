// Testa a compra dos guias digitais no Worker: webhook do Stripe -> compra no CRM -> chave única na KV -> e-mail (Brevo) -> GET /guia/<chave>.
// Tudo com fetch e KV falsos (não chama Stripe, Supabase nem Brevo). Pessoas e ids fictícios.
//
// Uso: node cms-oauth-worker/testes/guia-compra.test.mjs   (Node 20+, sem dependências)
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'guia-compra-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(arq).href)).default;
rmSync(dir, { recursive: true, force: true });

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

class KV {
  constructor() { this.m = new Map(); this.ttl = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v, o) { this.m.set(k, String(v)); if (o && o.expirationTtl) this.ttl.set(k, o.expirationTtl); }
  chaves(prefixo) { return [...this.m.keys()].filter((k) => k.startsWith(prefixo)); }
}
const SEGREDO = 'whsec_teste_segredo_do_endpoint';
const PLINK_9 = 'plink_manual_9', PLINK_14 = 'plink_manual_14', PLINK_VIVO = 'plink_vivo_19';
const CID = '11111111-2222-4333-8444-555555555555';
const mkEnv = (extra = {}) => ({ STRIPE_WEBHOOK_SECRET: SEGREDO, STRIPE_SECRET_KEY: 'sk_test_x', SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k',
  BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org', STRIPE_PLINK_MANUAL: PLINK_9 + ', ' + PLINK_14, STRIPE_PLINK_GUIA_VIVO: PLINK_VIVO,
  REVIEWS_KV: new KV(), ...extra });

const agora = Math.floor(Date.now() / 1000);
const assina = (corpo) => `t=${agora},v1=${createHmac('sha256', SEGREDO).update(agora + '.' + corpo).digest('hex')}`;
const hook = (evento, env) => { const corpo = JSON.stringify(evento);
  return worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': assina(corpo) }, body: corpo }), env, {}); };
const api = (env, caminho, chave, ip = '1.1.1.1') => worker.fetch(new Request('https://w.example/api/guia' + caminho, { headers: { 'CF-Connecting-IP': ip, ...(chave ? { Authorization: 'Bearer ' + chave } : {}) } }), env, {});
const get = (env, caminho) => worker.fetch(new Request('https://w.example' + caminho), env, {});

let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    const c = { url: String(url), method: opt.method || 'GET', body: typeof opt.body === 'string' ? (() => { try { return JSON.parse(opt.body); } catch (e) { return opt.body; } })() : null, headers: opt.headers || {} };
    chamadas.push(c);
    for (const [re, resp0] of regras) {
      if (!re.test(c.url)) continue;
      const resp = typeof resp0 === 'function' ? resp0(c) : resp0;
      return new Response(resp.status === 204 ? null : (typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body ?? {})), { status: resp.status || 200 });
    }
    return new Response('{}', { status: 404 });
  };
}
const toca = (re) => chamadas.filter((c) => re.test(c.url));
const ACESSO = new Date(Date.now() + 365 * 86400000).toISOString();
const REG = (extra = {}) => [/\/rpc\/crm_compra_registrar$/, { body: { duplicado: false, contato_id: CID, nome: 'Ana Maria', ficha_nova: false, acesso_ate: ACESSO, entregue_em: null, ...extra } }];
const ENTREGUE = [/\/rpc\/crm_compra_entregue$/, { status: 204 }];
const BREVO = [/api\.brevo\.com/, { body: { messageId: '<g1@x.net>' } }];
const HIST = [/\/rest\/v1\/emails_enviados$/, { status: 201, body: [] }];
const fluxo = (reg = REG()) => [reg, ENTREGUE, BREVO, HIST];
const SESSAO = (extra = {}) => ({ id: 'cs_g1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', client_reference_id: 'manual-destrave-ameli', payment_link: PLINK_9,
  amount_total: 900, currency: 'eur', created: agora, customer_details: { email: 'Ana@Example.com', name: 'Ana Maria' }, metadata: {}, ...extra });
const EV = (obj = SESSAO(), tipo = 'checkout.session.completed', id = 'evt_g1') => ({ id, type: tipo, created: agora, data: { object: obj } });
const quieto = async (fn) => { const a = [console.log, console.error, console.warn]; const logs = []; console.log = console.error = console.warn = (...x) => logs.push(x.join(' ')); try { return [await fn(), logs]; } finally { [console.log, console.error, console.warn] = a; } };

console.log('== Compra do Manual: registra, cria a chave, manda o e-mail ==');
let env = mkEnv(); chamadas = []; fakeFetch(fluxo());
let [res, logs] = await quieto(() => hook(EV(), env));
let j = await res.json();
check('200, entregue', res.status === 200 && j.ok === true && j.entregue === true);
const reg = toca(/crm_compra_registrar/)[0];
check('registra no CRM com a sessão, o produto, o e-mail minúsculo, centavos e EUR', reg.body.p_referencia === 'cs_g1' && reg.body.p_slug === 'manual-destrave-ameli' && reg.body.p_email === 'ana@example.com' && reg.body.p_valor_centavos === 900 && reg.body.p_moeda === 'EUR');
check('chama o banco só com a service_role', reg.headers.Authorization === 'Bearer srv');
const chaves = env.REVIEWS_KV.chaves('guia:chave:');
check('uma chave única de 43 caracteres, ligada à sessão', chaves.length === 1 && /^guia:chave:[A-Za-z0-9_-]{43}$/.test(chaves[0]) && env.REVIEWS_KV.m.get('guia:sessao:cs_g1') === chaves[0].slice('guia:chave:'.length));
const token = chaves[0].slice('guia:chave:'.length);
const regKv = JSON.parse(env.REVIEWS_KV.m.get(chaves[0]));
check('a chave guarda produto, sessão, validade e revogado=false, e NUNCA o e-mail', regKv.slug === 'manual-destrave-ameli' && regKv.sessao === 'cs_g1' && regKv.revogado === false && regKv.expira_em === ACESSO && !JSON.stringify(regKv).includes('ana@'));
const mail = toca(/api\.brevo\.com/)[0];
check('um e-mail só, para o e-mail do Stripe, com o remetente e a resposta configurados', toca(/api\.brevo\.com/).length === 1 && mail.body.to[0].email === 'ana@example.com' && mail.body.sender.email === 'contato@example.org' && mail.body.replyTo.email === 'respostas@example.org');
check('o e-mail leva o link único do próprio Worker, com a chave depois do # (não vai ao servidor nem ao log)', mail.body.textContent.includes('https://w.example/guia/#k=' + token) && mail.body.htmlContent.includes('/guia/#k=' + token));
check('os 4 cupons, 12 meses de atualização, garantia de 7 dias e "responda este e-mail"', ['DOMICILIACAO-5', 'ABERTURA-5', 'ESTUDANTE-5', 'MUDANCA-5'].every((c) => mail.body.textContent.includes(c)) &&
  /12 meses/.test(mail.body.textContent) && /7 dias/.test(mail.body.textContent) && /responder? este e-mail|responda este e-mail/.test(mail.body.textContent) && mail.body.subject === 'Seu Manual Destrave da Ameli chegou');
check('nenhum [trecho entre colchetes] esquecido e saudação com o primeiro nome', !/\[[^\]\n]{2,60}\]/.test(mail.body.textContent) && mail.body.textContent.startsWith('Oi Ana,'));
const hist = toca(/emails_enviados$/)[0];
check('o histórico fica na ficha, SEM o link', hist.body.contato_id === CID && hist.body.modelo === 'guia_compra' && !hist.body.corpo.includes(token) && hist.body.corpo.includes('[link do guia, só do comprador]'));
check('marca a entrega depois do e-mail', toca(/crm_compra_entregue/)[0].body.p_referencia === 'cs_g1');
check('o link nunca vai para o log', !logs.join('\n').includes(token));

console.log('\n== O Stripe repete o evento ==');
chamadas = []; fakeFetch(fluxo(REG({ duplicado: true, entregue_em: new Date().toISOString() })));
res = await hook(EV(), env); j = await res.json();
check('já entregue: 200, duplicado, nenhum e-mail novo, nenhuma chave nova', res.status === 200 && j.duplicado === true && toca(/api\.brevo\.com/).length === 0 && env.REVIEWS_KV.chaves('guia:chave:').length === 1);

console.log('\n== O e-mail falhou: o Stripe tenta de novo e a chave é a mesma ==');
env = mkEnv(); chamadas = []; fakeFetch([REG(), ENTREGUE, [/api\.brevo\.com/, { status: 500, body: 'erro' }], HIST]);
[res] = await quieto(() => hook(EV(), env));
check('Brevo fora do ar: 500 (o Stripe tenta de novo) e nada marcado como entregue', res.status === 500 && toca(/crm_compra_entregue/).length === 0);
const t1 = env.REVIEWS_KV.chaves('guia:chave:')[0];
chamadas = []; fakeFetch(fluxo(REG({ duplicado: true })));
res = await hook(EV(), env);
check('segunda tentativa entrega, com a MESMA chave (uma chave só por compra)', res.status === 200 && env.REVIEWS_KV.chaves('guia:chave:').length === 1 && toca(/api\.brevo\.com/)[0].body.textContent.includes(t1.slice('guia:chave:'.length)));
chamadas = []; fakeFetch([REG(), [/api\.brevo\.com/, { body: { messageId: 'm' } }], [/crm_compra_entregue/, { status: 500, body: 'x' }], [/emails_enviados/, { status: 500, body: 'x' }]]);
env = mkEnv();
[res] = await quieto(() => hook(EV(), env));
check('e-mail saiu mas o registro falhou: 200 (um 500 mandaria o e-mail duas vezes)', res.status === 200);

console.log('\n== Venda que não é a do guia: não entrega ==');
const casos = [['link de pagamento de outro produto', SESSAO({ payment_link: 'plink_outro' })], ['sem link de pagamento (sessão criada por fora)', SESSAO({ payment_link: null })],
  ['valor abaixo do preço (9 €)', SESSAO({ amount_total: 100 })], ['moeda diferente', SESSAO({ currency: 'brl' })],
  ['Guia vivo pago no link de 9 € do Manual (client_reference_id adulterado)', SESSAO({ client_reference_id: 'guia-vivo-destrave-ameli' })]];
for (const [rotulo, obj] of casos) {
  env = mkEnv(); chamadas = []; fakeFetch(fluxo());
  [res] = await quieto(() => hook(EV(obj), env)); j = await res.json();
  check(rotulo + ': 200 ignorado, sem banco, sem chave, sem e-mail', res.status === 200 && j.ignorado === true && chamadas.length === 0 && env.REVIEWS_KV.chaves('guia:').length === 0);
}
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ payment_status: 'unpaid' })), env)); j = await res.json();
check('ainda não pago: ignorado', res.status === 200 && j.ignorado === true && chamadas.length === 0);
env = mkEnv({ STRIPE_PLINK_MANUAL: undefined }); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(), env));
check('sem STRIPE_PLINK_MANUAL: 500 (falha fechada; o Stripe tenta de novo quando você configurar)', res.status === 500 && chamadas.length === 0);
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ customer_details: {} })), env));
check('sem e-mail do comprador: 500, nada entregue', res.status === 500 && toca(/api\.brevo\.com/).length === 0);
env = mkEnv(); chamadas = []; fakeFetch([[/crm_compra_registrar/, { status: 404, body: { message: 'not found' } }]]);
[res] = await quieto(() => hook(EV(), env));
check('falta rodar crm-compras.sql: 500 e nada entregue', res.status === 500 && env.REVIEWS_KV.chaves('guia:').length === 0);

console.log('\n== Guia vivo, 1:1 e pagamento que confirma depois ==');
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ id: 'cs_v1', client_reference_id: 'guia-vivo-destrave-ameli', payment_link: PLINK_VIVO, amount_total: 1900 })), env));
check('Guia vivo no link de 19 €: entregue, com o nome do produto', res.status === 200 && toca(/api\.brevo\.com/)[0].body.subject === 'Seu Guia vivo Destrave da Ameli chegou' && toca(/crm_compra_registrar/)[0].body.p_slug === 'guia-vivo-destrave-ameli');
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ payment_link: PLINK_14, amount_total: 1400 })), env));
check('Manual no link de 14 € (depois do lançamento): entregue', res.status === 200 && toca(/api\.brevo\.com/).length === 1);
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ payment_status: 'paid' }), 'checkout.session.async_payment_succeeded'), env));
check('débito que confirma depois (async_payment_succeeded): entregue', res.status === 200 && toca(/api\.brevo\.com/).length === 1);
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ client_reference_id: CID, mode: 'payment', metadata: {} })), env)); j = await res.json();
check('compra avulsa de outro produto continua seguindo o caminho de antes (1:1): nada do guia', res.status === 200 && toca(/crm_compra_registrar/).length === 0 && toca(/api\.brevo\.com/).length === 0);

console.log('\n== O casco do guia e a API (a chave vai em Authorization: Bearer) ==');
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
await quieto(() => hook(EV(), env));
const tk = env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length);
const kvm = env.REVIEWS_KV.m;
kvm.set('guia:pagina', '<!doctype html><html><body>CASCO sem texto pago</body></html>');
kvm.set('guia:manual:manual-destrave-ameli', JSON.stringify({ meta: { versao: '1.0' }, capitulos: [{ id: '1', titulo: 'Domiciliação' }] }));
kvm.set('guia:cap:manual-destrave-ameli:1', JSON.stringify({ id: '1', titulo: 'Domiciliação', grupos: [{ id: 'a' }] }));
const putsAntes = [...kvm.keys()].filter((k) => k.startsWith('throttle:')).length;
let res2 = await get(env, '/guia/');
check('/guia/ serve o casco, sem chave nenhuma', res2.status === 200 && (await res2.text()).includes('CASCO') );
check('cabeçalhos do casco: sem cache, noindex, sem referrer, sem moldura, fala só com o próprio Worker', res2.headers.get('Cache-Control') === 'no-store' && /noindex/.test(res2.headers.get('X-Robots-Tag')) && res2.headers.get('Referrer-Policy') === 'no-referrer' &&
  res2.headers.get('X-Frame-Options') === 'DENY' && /connect-src 'self'/.test(res2.headers.get('Content-Security-Policy')) && /default-src 'none'/.test(res2.headers.get('Content-Security-Policy')));
check('/guia (sem barra) também serve o casco', (await get(env, '/guia')).status === 200);
res2 = await get(env, '/guia/' + tk);
check('link digitado como /guia/<chave> vira /guia/#k=<chave>', res2.status === 302 && res2.headers.get('Location') === 'https://w.example/guia/#k=' + tk);
res2 = await api(env, '/manual', tk);
let jj = await res2.json();
check('índice com a chave certa: 200 e JSON, sem cache', res2.status === 200 && jj.meta.versao === '1.0' && jj.capitulos.length === 1 && jj.capitulos[0].grupos === undefined && res2.headers.get('Cache-Control') === 'no-store' && /json/.test(res2.headers.get('Content-Type')));
res2 = await api(env, '/capitulos/1', tk); jj = await res2.json();
check('capítulo com a chave certa: 200 com os grupos', res2.status === 200 && jj.grupos.length === 1);
check('abrir o guia com chave válida não gasta escrita na KV (o limite só conta tentativas inválidas)', [...kvm.keys()].filter((k) => k.startsWith('throttle:')).length === putsAntes);
for (const [rotulo, ch] of [['sem chave', null], ['chave inventada', 'A'.repeat(43)], ['chave curta', 'abc'], ['chave com caracteres estranhos', '../../etc/passwd']]) {
  res2 = await api(env, '/manual', ch);
  check(rotulo + ': 401 e nenhum texto', res2.status === 401 && !(await res2.text()).includes('Domicilia'));
}
res2 = await api(env, '/capitulos/1', null);
check('capítulo sem chave: 401 (o texto pago nunca sai sem a chave)', res2.status === 401);
check('capítulo com id estranho ou inexistente: 404', (await api(env, '/capitulos/..%2F1', tk)).status === 404 && (await api(env, '/capitulos/99', tk)).status === 404 && (await api(env, '/outra-coisa', tk)).status === 404);
const k = 'guia:chave:' + tk, orig = JSON.parse(kvm.get(k));
kvm.set(k, JSON.stringify({ ...orig, revogado: true }));
check('chave revogada: 401 no índice e no capítulo', (await api(env, '/manual', tk)).status === 401 && (await api(env, '/capitulos/1', tk)).status === 401);
kvm.set(k, JSON.stringify({ ...orig, expira_em: new Date(Date.now() - 1000).toISOString() }));
res2 = await api(env, '/manual', tk);
check('passou dos 12 meses: 401 "expirado"', res2.status === 401 && (await res2.json()).error === 'expirado');
kvm.set(k, JSON.stringify(orig)); kvm.delete('guia:manual:manual-destrave-ameli');
[res2] = await quieto(() => api(env, '/manual', tk));
check('comprador válido mas índice ainda não carregado: 503 (e erro no log para você)', res2.status === 503);
kvm.set('guia:chave:' + 'C'.repeat(43), JSON.stringify({ ...orig, slug: 'produto-que-nao-existe' }));
check('chave de produto que não existe mais: 401', (await api(env, '/manual', 'C'.repeat(43))).status === 401);
kvm.delete('guia:pagina');
[res2] = await quieto(() => get(env, '/guia/'));
check('casco ainda não carregado: 503 neutro', res2.status === 503);
let ultimo; for (let i = 0; i < 32; i++) ultimo = await api(env, '/manual', 'D'.repeat(43), '9.9.9.9');
check('muitas tentativas inválidas do mesmo IP: 429', ultimo.status === 429);
res2 = await api(env, '/manual', tk, '9.9.9.9');
check('o limite só pega quem erra: o mesmo IP com a chave certa continua entrando', res2.status !== 429);
res2 = await worker.fetch(new Request('https://w.example/api/guia/manual', { method: 'POST', headers: { Authorization: 'Bearer ' + tk } }), env, {});
check('só GET', res2.status === 404);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
