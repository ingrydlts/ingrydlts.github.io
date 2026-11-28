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
  BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org', STRIPE_PLINK_MANUAL_DOMICILIACAO: PLINK_9 + ', ' + PLINK_14, STRIPE_PLINK_GUIA_VIVO: PLINK_VIVO,
  REVIEWS_KV: new KV(), ...extra });

const agora = Math.floor(Date.now() / 1000);
const assina = (corpo) => `t=${agora},v1=${createHmac('sha256', SEGREDO).update(agora + '.' + corpo).digest('hex')}`;
const hook = (evento, env) => { const corpo = JSON.stringify(evento);
  return worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': assina(corpo) }, body: corpo }), env, {}); };
const api = async (env, caminho, chave, ip = '1.1.1.1') => { const r = await worker.fetch(new Request('https://w.example/api/guia' + caminho, { headers: { 'CF-Connecting-IP': ip, ...(chave ? { Authorization: 'Bearer ' + chave } : {}) } }), env, ctxFalso); await Promise.all(esperar.splice(0)); return r; };
const get = (env, caminho) => worker.fetch(new Request('https://w.example' + caminho), env, {});
const esperar = [];
const entrar = (env, chave, email = 'ana@example.com', ip = '1.1.1.1') => worker.fetch(new Request('https://w.example/api/guia/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ email, chave }) }), env, {});
const sessaoDe = async (env, chave, ip) => (await (await entrar(env, chave, undefined, ip)).json()).sessao;
const ctxFalso = { waitUntil: (p) => esperar.push(p) };
class D1 {
  constructor() { this.sql = []; this.linhas = new Map(); }
  prepare(sql) { const d1 = this; return { bind: (...a) => ({ run: async () => { d1.sql.push({ sql, a }); if (/INSERT INTO guia_uso/.test(sql)) { const k = a.join('|'); d1.linhas.set(k, (d1.linhas.get(k) || 0) + 1); } return {}; } }), run: async () => { d1.sql.push({ sql, a: [] }); return {}; } }; }
}

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
const SESSAO = (extra = {}) => ({ id: 'cs_g1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', client_reference_id: 'manual-destrave-domiciliacao', payment_link: PLINK_9,
  amount_total: 900, currency: 'eur', created: agora, customer_details: { email: 'Ana@Example.com', name: 'Ana Maria' }, metadata: {}, ...extra });
const EV = (obj = SESSAO(), tipo = 'checkout.session.completed', id = 'evt_g1') => ({ id, type: tipo, created: agora, data: { object: obj } });
const quieto = async (fn) => { const a = [console.log, console.error, console.warn]; const logs = []; console.log = console.error = console.warn = (...x) => logs.push(x.join(' ')); try { return [await fn(), logs]; } finally { [console.log, console.error, console.warn] = a; } };

console.log('== Compra do Manual: registra, cria a chave, manda o e-mail ==');
let env = mkEnv(); chamadas = []; fakeFetch(fluxo());
let [res, logs] = await quieto(() => hook(EV(), env));
let j = await res.json();
check('200, entregue', res.status === 200 && j.ok === true && j.entregue === true);
const reg = toca(/crm_compra_registrar/)[0];
check('registra no CRM com a sessão, o produto, o e-mail minúsculo, centavos e EUR', reg.body.p_referencia === 'cs_g1' && reg.body.p_slug === 'manual-destrave-domiciliacao' && reg.body.p_email === 'ana@example.com' && reg.body.p_valor_centavos === 900 && reg.body.p_moeda === 'EUR');
check('chama o banco só com a service_role', reg.headers.Authorization === 'Bearer srv');
const chaves = env.REVIEWS_KV.chaves('guia:chave:');
check('uma chave única de 43 caracteres, ligada à sessão', chaves.length === 1 && /^guia:chave:[A-Za-z0-9_-]{43}$/.test(chaves[0]) && env.REVIEWS_KV.m.get('guia:sessao:cs_g1') === chaves[0].slice('guia:chave:'.length));
const token = chaves[0].slice('guia:chave:'.length);
const regKv = JSON.parse(env.REVIEWS_KV.m.get(chaves[0]));
check('a chave guarda produto, sessão, validade e revogado=false, e NUNCA o e-mail', regKv.slug === 'manual-destrave-domiciliacao' && regKv.sessao === 'cs_g1' && regKv.revogado === false && regKv.expira_em === ACESSO && !JSON.stringify(regKv).includes('ana@'));
const mail = toca(/api\.brevo\.com/)[0];
check('um e-mail só, para o e-mail do Stripe, com o remetente e a resposta configurados', toca(/api\.brevo\.com/).length === 1 && mail.body.to[0].email === 'ana@example.com' && mail.body.sender.email === 'contato@example.org' && mail.body.replyTo.email === 'respostas@example.org');
check('o e-mail leva o link único do próprio Worker, com a chave depois do # (não vai ao servidor nem ao log)', mail.body.textContent.includes('https://w.example/guia/#k=' + token) && mail.body.htmlContent.includes('/guia/#k=' + token));
check('só os cupons que existem neste manual (DOMICILIACAO-5 e MUDANCA-5), 12 meses de atualização, garantia de 7 dias e "responda este e-mail"', ['DOMICILIACAO-5', 'MUDANCA-5'].every((c) => mail.body.textContent.includes(c)) && !/ABERTURA-5|ESTUDANTE-5/.test(mail.body.textContent) &&
  /12 meses/.test(mail.body.textContent) && /7 dias/.test(mail.body.textContent) && /responder? este e-mail|responda este e-mail/.test(mail.body.textContent) && mail.body.subject === 'Seu Manual Destrave: Endereço e Domiciliação chegou');
check('nenhum [trecho entre colchetes] esquecido e saudação com o primeiro nome', !/\[[^\]\n]{2,60}\]/.test(mail.body.textContent) && mail.body.textContent.startsWith('Oi Ana,'));
const hist = toca(/emails_enviados$/)[0];
check('o histórico fica na ficha, SEM o link', hist.body.contato_id === CID && hist.body.modelo === 'guia_compra' && !hist.body.corpo.includes(token) && hist.body.corpo.includes('[link do guia]') && hist.body.corpo.includes('[chave de acesso, só do comprador]'));
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
env = mkEnv({ STRIPE_PLINK_MANUAL_DOMICILIACAO: undefined }); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(), env));
check('sem STRIPE_PLINK_MANUAL_DOMICILIACAO: 500 (falha fechada; o Stripe tenta de novo quando você configurar)', res.status === 500 && chamadas.length === 0);
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ customer_details: {} })), env));
check('sem e-mail do comprador: 500, nada entregue', res.status === 500 && toca(/api\.brevo\.com/).length === 0);
env = mkEnv(); chamadas = []; fakeFetch([[/crm_compra_registrar/, { status: 404, body: { message: 'not found' } }]]);
[res] = await quieto(() => hook(EV(), env));
check('falta rodar crm-compras.sql: 500 e nada entregue', res.status === 500 && env.REVIEWS_KV.chaves('guia:').length === 0);

console.log('\n== Guia vivo, 1:1 e pagamento que confirma depois ==');
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
[res] = await quieto(() => hook(EV(SESSAO({ id: 'cs_v1', client_reference_id: 'guia-vivo-destrave-ameli', payment_link: PLINK_VIVO, amount_total: 1900 })), env));
check('Guia vivo: os 4 cupons', ['DOMICILIACAO-5', 'ABERTURA-5', 'ESTUDANTE-5', 'MUDANCA-5'].every((c) => toca(/api\.brevo\.com/)[0].body.textContent.includes(c)));
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
const sk = await sessaoDe(env, tk);
const kvm = env.REVIEWS_KV.m;
kvm.set('guia:pagina', '<!doctype html><html><body>CASCO sem texto pago</body></html>');
kvm.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: { versao: '1.0' }, capitulos: [{ id: '1', titulo: 'Domiciliação' }] }));
kvm.set('guia:cap:manual-destrave-domiciliacao:1', JSON.stringify({ id: '1', titulo: 'Domiciliação', grupos: [{ id: 'a' }] }));
const putsAntes = [...kvm.keys()].filter((k) => k.startsWith('throttle:')).length;
let res2 = await get(env, '/guia/app/');
check('/guia/app/ serve o casco (HTML sem texto pago)', res2.status === 200 && (await res2.text()).includes('CASCO') );
check('cabeçalhos do casco: sem cache, noindex, sem referrer, sem moldura, fala só com o próprio Worker', res2.headers.get('Cache-Control') === 'no-store' && /noindex/.test(res2.headers.get('X-Robots-Tag')) && res2.headers.get('Referrer-Policy') === 'no-referrer' &&
  res2.headers.get('X-Frame-Options') === 'DENY' && /connect-src 'self'/.test(res2.headers.get('Content-Security-Policy')) && /default-src 'none'/.test(res2.headers.get('Content-Security-Policy')));
check('/guia/app (sem barra) também serve o casco', (await get(env, '/guia/app')).status === 200);
res2 = await get(env, '/guia/' + tk);
check('link digitado como /guia/<chave> vira /guia/#k=<chave>', res2.status === 302 && res2.headers.get('Location') === 'https://w.example/guia/#k=' + tk);
res2 = await api(env, '/manual', sk);
let jj = await res2.json();
check('índice com a chave certa: 200 e JSON, sem cache', res2.status === 200 && jj.meta.versao === '1.0' && jj.capitulos.length === 1 && jj.capitulos[0].grupos === undefined && res2.headers.get('Cache-Control') === 'no-store' && /json/.test(res2.headers.get('Content-Type')));
res2 = await api(env, '/capitulos/1', sk); jj = await res2.json();
check('capítulo com a chave certa: 200 com os grupos', res2.status === 200 && jj.grupos.length === 1);
check('abrir o guia com chave válida não gasta escrita na KV (o limite só conta tentativas inválidas)', [...kvm.keys()].filter((k) => k.startsWith('throttle:')).length === putsAntes);
for (const [rotulo, ch] of [['sem chave', null], ['chave inventada', 'A'.repeat(43)], ['chave curta', 'abc'], ['chave com caracteres estranhos', '../../etc/passwd']]) {
  res2 = await api(env, '/manual', ch);
  check(rotulo + ': 401 e nenhum texto', res2.status === 401 && !(await res2.text()).includes('Domicilia'));
}
res2 = await api(env, '/capitulos/1', null);
check('capítulo sem chave: 401 (o texto pago nunca sai sem a chave)', res2.status === 401);
check('capítulo com id estranho ou inexistente: 404', (await api(env, '/capitulos/..%2F1', sk)).status === 404 && (await api(env, '/capitulos/99', sk)).status === 404 && (await api(env, '/outra-coisa', sk)).status === 404);
const k = 'guia:chave:' + tk, orig = JSON.parse(kvm.get(k));
kvm.set(k, JSON.stringify({ ...orig, revogado: true }));
check('chave revogada depois do login: a sessão cai (401 no índice e no capítulo)', (await api(env, '/manual', sk)).status === 401 && (await api(env, '/capitulos/1', sk)).status === 401);
kvm.set(k, JSON.stringify(orig));
const ks = 'guia:chave:' + sk, origS = JSON.parse(kvm.get(ks));
kvm.set(ks, JSON.stringify({ ...origS, expira_em: new Date(Date.now() - 1000).toISOString() }));
res2 = await api(env, '/manual', sk);
check('sessão vencida: 401 "expirado" (volta ao login)', res2.status === 401 && (await res2.json()).error === 'expirado');
kvm.set(ks, JSON.stringify(origS)); kvm.delete('guia:manual:manual-destrave-domiciliacao');
[res2] = await quieto(() => api(env, '/manual', sk));
check('comprador válido mas índice ainda não carregado: 503 (e erro no log para você)', res2.status === 503);
kvm.set('guia:chave:' + 'C'.repeat(43), JSON.stringify({ ...orig, slug: 'produto-que-nao-existe' }));
check('chave de produto que não existe mais: 401', (await api(env, '/manual', 'C'.repeat(43))).status === 401);
kvm.delete('guia:pagina');
[res2] = await quieto(() => get(env, '/guia/app/'));
check('casco ainda não carregado: 503 neutro', res2.status === 503);
let ultimo; for (let i = 0; i < 32; i++) ultimo = await api(env, '/manual', 'D'.repeat(43), '9.9.9.9');
check('muitas tentativas inválidas do mesmo IP: 429', ultimo.status === 429);
res2 = await api(env, '/manual', sk, '9.9.9.9');
check('o limite só pega quem erra: o mesmo IP com a sessão certa continua entrando', res2.status !== 429);
res2 = await worker.fetch(new Request('https://w.example/api/guia/manual', { method: 'POST', headers: { Authorization: 'Bearer ' + sk } }), env, {});
check('só GET', res2.status === 404);

console.log('\n== Login: página de acesso, e-mail da compra + chave, toda vez ==');
env = mkEnv(); chamadas = []; fakeFetch([...fluxo(), [/\/rpc\/crm_compra_entrada$/, { status: 204 }],
  [/\/auth\/v1\/user$/, (c) => (/Bearer admin-ok/.test(c.headers.Authorization || '') ? { body: { id: 'u-admin' } } : { status: 401 })], [/\/rest\/v1\/admins/, { body: [{ user_id: 'u-admin' }] }]]);
await quieto(() => hook(EV(), env));
const kl = env.REVIEWS_KV.m, tl = env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length);
kl.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: { versao: '1.0' }, capitulos: [] }));
const brevoL = toca(/api\.brevo\.com/)[0].body;
check('o e-mail da compra traz a chave, o link da página de acesso e o e-mail a usar', brevoL.textContent.includes(tl) && brevoL.textContent.includes('/guia/#k=' + tl) && brevoL.textContent.includes('ana@example.com') && /e-mail que você usou na compra/.test(brevoL.textContent));
const regL = JSON.parse(kl.get('guia:chave:' + tl));
check('a chave guarda só o hash do e-mail, nunca o e-mail', /^[0-9a-f]{64}$/.test(regL.email_hash) && !JSON.stringify(regL).includes('ana@') && !JSON.stringify(regL).includes('Ana'));
let pg = await get(env, '/guia/');
let htmlL = await pg.text();
check('/guia/ é a página de login: campo de e-mail, campo de chave, sem texto pago, sem cache, sem moldura', pg.status === 200 && /id="e"/.test(htmlL) && /id="k"/.test(htmlL) && /type="password"/.test(htmlL) && pg.headers.get('Cache-Control') === 'no-store' && pg.headers.get('X-Frame-Options') === 'DENY' && !/Domicilia/.test(htmlL.replace(/Entrar no Manual/g, '')));
check('/guia (sem barra) também é o login', (await get(env, '/guia')).status === 200 && /id="k"/.test(await (await get(env, '/guia')).text()));
check('link digitado como /guia/<chave> cai no login com a chave preenchida', (await get(env, '/guia/' + tl)).headers.get('Location') === 'https://w.example/guia/#k=' + tl);
let rl = await api(env, '/manual', tl);
check('a chave do comprador sozinha, direto na API, NÃO abre o texto (401 "login")', rl.status === 401 && (await rl.json()).error === 'login');
rl = await entrar(env, tl, 'ANA@Example.com ');
let jl = await rl.json();
check('e-mail certo (maiúsculas e espaços não importam) + chave certa: 200 e uma sessão nova', rl.status === 200 && /^[A-Za-z0-9_-]{43}$/.test(jl.sessao) && jl.sessao !== tl && !!jl.expira_em);
const regS = JSON.parse(kl.get('guia:chave:' + jl.sessao));
check('a sessão dura 3 horas na KV, é de login e aponta para a chave de origem', env.REVIEWS_KV.ttl.get('guia:chave:' + jl.sessao) <= 3 * 3600 + 600 && regS.via === 'login' && regS.chave_origem === tl && Date.parse(regS.expira_em) - Date.now() <= 3 * 3600 * 1000 + 1000);
rl = await api(env, '/manual', jl.sessao);
check('com a sessão do login o índice abre', rl.status === 200 && (await rl.json()).meta.versao === '1.0');
check('/guia/app/ continua público, mas sem sessão a API nega', (await api(env, '/manual', null)).status === 401);
const [r1, r2, r3] = await Promise.all([entrar(env, tl, 'outra@example.com', '7.7.7.1'), entrar(env, 'B'.repeat(43), 'ana@example.com', '7.7.7.2'), entrar(env, tl, 'isto não é e-mail', '7.7.7.3')]);
const [m1, m2, m3] = [await r1.json(), await r2.json(), await r3.json()];
check('e-mail errado, chave errada e e-mail malformado: 401 e a MESMA mensagem (não revela qual falhou)', r1.status === 401 && r2.status === 401 && r3.status === 401 && m1.mensagem === m2.mensagem && m2.mensagem === m3.mensagem && !m1.sessao);
let ult; for (let i = 0; i < 12; i++) ult = await entrar(env, tl, 'errado@example.com', '8.8.8.8');
check('depois de 10 tentativas erradas do mesmo IP: 429', ult.status === 429);
check('o limite só pega quem erra: o IP bloqueado errando não impede outro IP de entrar', (await entrar(env, tl, 'ana@example.com', '8.8.4.4')).status === 200);
kl.set('guia:chave:' + 'E'.repeat(43), JSON.stringify({ slug: 'manual-destrave-domiciliacao', canal: 'rascunho', criado_em: 'x', expira_em: '2100-01-01T00:00:00.000Z', revogado: false }));
check('a chave de prévia não entra pelo login', (await entrar(env, 'E'.repeat(43), 'ana@example.com', '1.2.3.4')).status === 401);
kl.set('guia:chave:' + 'F'.repeat(43), JSON.stringify({ slug: 'manual-destrave-domiciliacao', criado_em: 'x', expira_em: '2100-01-01T00:00:00.000Z', revogado: false }));
check('chave sem e-mail guardado (antiga) não entra', (await entrar(env, 'F'.repeat(43), 'ana@example.com', '1.2.3.5')).status === 401);
const sessaoNova = await sessaoDe(env, tl, '5.5.4.4');
kl.set('guia:chave:' + tl, JSON.stringify({ ...regL, revogado: true }));
check('chave revogada: não entra mais, e a sessão que já existia cai', (await entrar(env, tl, 'ana@example.com', '1.2.3.6')).status === 401 && (await api(env, '/manual', sessaoNova)).status === 401);
kl.set('guia:chave:' + tl, JSON.stringify({ ...regL, expira_em: new Date(Date.now() - 1000).toISOString() }));
rl = await entrar(env, tl, 'ana@example.com', '1.2.3.7');
check('passou dos 12 meses: o login diz que o acesso terminou', rl.status === 401 && (await rl.json()).error === 'expirado');
check('o login só aceita POST', (await get(env, '/api/guia/entrar')).status !== 200);

console.log('\n== Compras no CRM: a entrada é contada e a admin vê a chave ==');
env = mkEnv(); chamadas = []; fakeFetch([...fluxo(), [/\/rpc\/crm_compra_entrada$/, { status: 204 }],
  [/\/auth\/v1\/user$/, (c) => (/Bearer admin-ok/.test(c.headers.Authorization || '') ? { body: { id: 'u-admin' } } : { status: 401 })], [/\/rest\/v1\/admins/, { body: [{ user_id: 'u-admin' }] }]]);
await quieto(() => hook(EV(), env));
const tc = env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length);
chamadas = [];
await entrar(env, tc, 'errada@example.com', '2.2.2.1'); await Promise.all(esperar.splice(0));
check('login que falha NÃO conta entrada', toca(/crm_compra_entrada/).length === 0);
const ctxEntrar = { waitUntil: (p) => esperar.push(p) };
const rEnt = await worker.fetch(new Request('https://w.example/api/guia/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '2.2.2.2' }, body: JSON.stringify({ email: 'ana@example.com', chave: tc }) }), env, ctxEntrar);
await Promise.all(esperar.splice(0));
const cont = toca(/crm_compra_entrada/);
check('login com sucesso conta UMA entrada, com a referência da compra', rEnt.status === 200 && cont.length === 1 && cont[0].body.p_referencia === 'cs_g1');
check('o que vai ao banco é só a referência: nem e-mail, nem chave, nem sessão do login', JSON.stringify(cont[0].body) === '{"p_referencia":"cs_g1"}');
check('com o contador fora do ar, a pessoa entra do mesmo jeito', await quieto(async () => { fakeFetch([[/\/rpc\/crm_compra_entrada$/, { status: 500 }]]); return (await worker.fetch(new Request('https://w.example/api/guia/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '2.2.2.3' }, body: JSON.stringify({ email: 'ana@example.com', chave: tc }) }), env, ctxEntrar)).status === 200; }).then(([v]) => v));
fakeFetch([[/\/auth\/v1\/user$/, (c) => (/Bearer admin-ok/.test(c.headers.Authorization || '') ? { body: { id: 'u-admin' } } : { status: 401 })], [/\/rest\/v1\/admins/, { body: [{ user_id: 'u-admin' }] }]]);
const chaveAdmin = (ref, tok) => worker.fetch(new Request('https://w.example/api/crm/compra-chave?ref=' + ref, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }), env, {});
let rc = await chaveAdmin('cs_g1', null);
check('sem login de admin: 401 e nenhuma chave', rc.status === 401 && !(await rc.text()).includes(tc));
rc = await chaveAdmin('cs_g1', 'token-de-comprador');
check('com token que não é de admin: 401', rc.status === 401);
rc = await chaveAdmin('cs_g1', 'admin-ok'); let jc = await rc.json();
check('admin vê a chave da compra, o link de acesso e o estado', rc.status === 200 && jc.chave === tc && jc.link === 'https://w.example/guia/#k=' + tc && jc.revogado === false && !!jc.expira_em && rc.headers.get('Cache-Control') === 'no-store');
check('a resposta libera o painel (CORS) para a admin ler', rc.headers.get('Access-Control-Allow-Origin') === '*');
check('referência inexistente: 404; referência estranha: 400', (await chaveAdmin('cs_nao_existe', 'admin-ok')).status === 404 && (await chaveAdmin('../../x', 'admin-ok')).status === 400);

console.log('\n== Rascunho: o guia novo só aparece para quem tem a chave de prévia ==');
env = mkEnv(); chamadas = []; fakeFetch(fluxo());
await quieto(() => hook(EV(), env));
const buyer = await sessaoDe(env, env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length));
const mk = env.REVIEWS_KV.m;
mk.set('guia:pagina', 'CASCO NO AR'); mk.set('guia:rascunho:pagina', 'CASCO RASCUNHO');
mk.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: { versao: '1.0' }, capitulos: [] }));
mk.set('guia:rascunho:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: { versao: '2.0-rascunho' }, capitulos: [] }));
mk.set('guia:cap:manual-destrave-domiciliacao:1', JSON.stringify({ id: '1', titulo: 'NO AR', grupos: [] }));
mk.set('guia:rascunho:cap:manual-destrave-domiciliacao:1', JSON.stringify({ id: '1', titulo: 'RASCUNHO', grupos: [] }));
const PREVIA = 'P'.repeat(43);
mk.set('guia:chave:' + PREVIA, JSON.stringify({ slug: 'manual-destrave-domiciliacao', canal: 'rascunho', criado_em: new Date().toISOString(), expira_em: '2100-01-01T00:00:00.000Z', revogado: false }));
check('/guia/rascunho/ serve o casco de rascunho e /guia/app/ o do ar', (await (await get(env, '/guia/rascunho/')).text()) === 'CASCO RASCUNHO' && (await (await get(env, '/guia/app/')).text()) === 'CASCO NO AR');
check('/guia/rascunho não vira uma chave chamada "rascunho" (nada de redirecionamento)', (await get(env, '/guia/rascunho')).status === 200);
check('o casco de rascunho também sai com noindex e sem cache', /noindex/.test((await get(env, '/guia/rascunho/')).headers.get('X-Robots-Tag')) && (await get(env, '/guia/rascunho/')).headers.get('Cache-Control') === 'no-store');
let r5 = await (await api(env, '/manual', PREVIA)).json();
check('a chave de prévia lê o índice e o capítulo de RASCUNHO', r5.meta.versao === '2.0-rascunho' && (await (await api(env, '/capitulos/1', PREVIA)).json()).titulo === 'RASCUNHO');
r5 = await (await api(env, '/manual', buyer)).json();
check('o comprador continua lendo SÓ o que está no ar', r5.meta.versao === '1.0' && (await (await api(env, '/capitulos/1', buyer)).json()).titulo === 'NO AR');
mk.delete('guia:rascunho:cap:manual-destrave-domiciliacao:1');
check('capítulo que falta no rascunho: 404 (não cai no do ar por engano)', (await api(env, '/capitulos/1', PREVIA)).status === 404);
mk.set('guia:chave:' + PREVIA, JSON.stringify({ ...JSON.parse(mk.get('guia:chave:' + PREVIA)), revogado: true }));
check('chave de prévia revogada: 401', (await api(env, '/manual', PREVIA)).status === 401);

console.log('\n== Métricas (nível A): só contadores, sem dado pessoal ==');
env = mkEnv({ EVENTS_DB: new D1() }); chamadas = []; fakeFetch(fluxo());
await quieto(() => hook(EV(), env));
const tkm0 = env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length), tkm = await sessaoDe(env, tkm0), km = env.REVIEWS_KV.m;
km.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: {}, capitulos: [] }));
km.set('guia:cap:manual-destrave-domiciliacao:2', JSON.stringify({ id: '2', grupos: [] }));
km.set('guia:rascunho:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: {}, capitulos: [] }));
km.set('guia:chave:' + 'Q'.repeat(43), JSON.stringify({ slug: 'manual-destrave-domiciliacao', canal: 'rascunho', criado_em: 'x', expira_em: '2100-01-01T00:00:00.000Z', revogado: false }));
await api(env, '/manual', tkm, '3.3.3.3'); await api(env, '/capitulos/2', tkm, '3.3.3.3'); await api(env, '/capitulos/2', tkm, '4.4.4.4');
const dia = new Date().toISOString().slice(0, 10);
check('conta 1 abertura do índice e 2 do capítulo 2, no dia, por produto', env.EVENTS_DB.linhas.get(`${dia}|manual-destrave-domiciliacao|indice|`) === 1 && env.EVENTS_DB.linhas.get(`${dia}|manual-destrave-domiciliacao|capitulo|2`) === 2);
const gravados = JSON.stringify(env.EVENTS_DB.sql);
check('NADA identifica a pessoa: nem IP, nem chave, nem sessão, nem e-mail no que foi gravado', !/3\.3\.3\.3|4\.4\.4\.4/.test(gravados) && !gravados.includes(tkm) && !gravados.includes(tkm0) && !/cs_g1|ana@/i.test(gravados));
check('a tabela só tem dia, produto, tipo, capítulo e contagem', /\(dia TEXT NOT NULL, slug TEXT NOT NULL, tipo TEXT NOT NULL, cap TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0/.test(gravados));
const antes = env.EVENTS_DB.linhas.size, total = [...env.EVENTS_DB.linhas.values()].reduce((a, b) => a + b, 0);
await api(env, '/manual', 'Q'.repeat(43), '5.5.5.5');
check('a prévia (rascunho) NÃO entra na métrica', env.EVENTS_DB.linhas.size === antes && [...env.EVENTS_DB.linhas.values()].reduce((a, b) => a + b, 0) === total);
await api(env, '/manual', 'Z'.repeat(43), '6.6.6.6'); await api(env, '/capitulos/99', tkm, '6.6.6.6');
check('chave inválida e capítulo inexistente não contam', [...env.EVENTS_DB.linhas.values()].reduce((a, b) => a + b, 0) === total);
env = mkEnv({ EVENTS_DB: { prepare: () => { throw new Error('D1 fora do ar'); } } }); chamadas = []; fakeFetch(fluxo());
await quieto(() => hook(EV(), env));
const tk3 = await sessaoDe(env, env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length));
env.REVIEWS_KV.m.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: {}, capitulos: [] }));
[res2] = await quieto(() => api(env, '/manual', tk3));
check('D1 fora do ar: o comprador continua lendo o guia (a métrica nunca derruba)', res2.status === 200);
env = mkEnv(); chamadas = []; fakeFetch(fluxo()); await quieto(() => hook(EV(), env));
const tk4 = await sessaoDe(env, env.REVIEWS_KV.chaves('guia:chave:')[0].slice('guia:chave:'.length));
env.REVIEWS_KV.m.set('guia:manual:manual-destrave-domiciliacao', JSON.stringify({ meta: {}, capitulos: [] }));
check('sem D1 configurado o guia funciona do mesmo jeito', (await api(env, '/manual', tk4)).status === 200);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
