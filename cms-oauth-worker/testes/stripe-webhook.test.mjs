// Testa o webhook do Stripe no Worker: POST /api/stripe/webhook. Tudo com fetch falso (não chama Stripe, Supabase nem Brevo).
// Confere a assinatura, o reenvio de evento, a criação da conta e o e-mail de acesso, e que o link de entrada (uso único) nunca
// vai para o histórico nem para o log. Pessoas e ids fictícios.
//
// Uso: node cms-oauth-worker/testes/stripe-webhook.test.mjs   (Node 20+, sem dependências)
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'stripe-wh-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { stripeAssinaturaConfere, stripeAssinaturaJson };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { stripeAssinaturaConfere, stripeAssinaturaJson } = mod;
const E = await import(pathToFileURL(path.resolve(HERE, '../../admin/crm/estudio.js')).href);
const { BLOCOS } = await import(pathToFileURL(path.resolve(HERE, '../../admin/crm/db/modelo-acesso-confirmado.mjs')).href);

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const SEGREDO = 'whsec_teste_segredo_do_endpoint';
const CID = '11111111-2222-4333-8444-555555555555';
const UID = 'aaaaaaaa-2222-4333-8444-555555555555';
const LINK = 'https://hslhpktfgxwfvljvsxkj.supabase.co/auth/v1/verify?token=TOKEN-DE-USO-UNICO-123&type=magiclink&redirect_to=https://plataforma.imigrantepordentro.com/';
const env = { STRIPE_WEBHOOK_SECRET: SEGREDO, STRIPE_SECRET_KEY: 'sk_test_x', SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k',
  BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org' };

const agora = Math.floor(Date.now() / 1000);
function assina(corpo, { t = agora, segredo = SEGREDO, extra = [] } = {}) {
  const v1 = createHmac('sha256', segredo).update(t + '.' + corpo).digest('hex');
  return `t=${t},${extra.map((x) => 'v1=' + x + ',').join('')}v1=${v1}`;
}
const hook = (evento, opt = {}) => {
  const corpo = typeof evento === 'string' ? evento : JSON.stringify(evento);
  return worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'POST',
    headers: opt.semCabecalho ? {} : { 'Stripe-Signature': opt.cabecalho ?? assina(corpo, opt), 'Content-Type': 'application/json' }, body: opt.corpoReal ?? corpo }), opt.env ?? env, {});
};

let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    const c = { url: String(url), method: opt.method || 'GET', body: typeof opt.body === 'string' ? (() => { try { return JSON.parse(opt.body); } catch (e) { return opt.body; } })() : null, headers: opt.headers || {} };
    chamadas.push(c);
    for (const [re, resp0] of regras) {
      if (!re.test(c.url)) continue;
      const resp = typeof resp0 === 'function' ? resp0(c) : resp0;
      if (resp.method && resp.method !== c.method) continue;
      return new Response(resp.status === 204 ? null : (typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body ?? {})), { status: resp.status || 200 });
    }
    return new Response('{}', { status: 404 });
  };
}
const toca = (re) => chamadas.filter((c) => re.test(c.url));
const tpl = { versao: 1, ...E.montar(BLOCOS, 'servico') };

const SUB = (extra = {}) => ({ id: 'sub_1', object: 'subscription', status: 'trialing', customer: 'cus_1', trial_end: agora + 30 * 86400, cancel_at_period_end: false,
  items: { data: [{ current_period_end: agora + 30 * 86400, price: { id: 'price_1', currency: 'brl', nickname: null, product: { name: 'Por Dentro · Básico mensal' } } }] }, ...extra });
const CHECKOUT = (extra = {}, evExtra = {}) => ({ id: 'evt_c1', type: 'checkout.session.completed', created: agora,
  data: { object: { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: CID, customer_details: { email: 'ana@example.com', name: 'Ana Maria' }, ...extra } }, ...evExtra });
const contatoRota = (extra = {}) => [/\/rest\/v1\/contatos\?select=id,email,nome,user_id&id=eq\./, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Maria', user_id: null, ...extra }] }];
const aplicarRota = (r = {}) => [/\/rpc\/crm_stripe_aplicar$/, { body: { duplicado: false, contato_id: CID, acesso_enviado_em: null, status: 'trialing', ...r } }];
const stripeSub = (s = SUB()) => [/api\.stripe\.com\/v1\/subscriptions\/sub_1/, { body: s }];
const modeloRota = (v = tpl) => [/\/modelos_email_versoes\?select=.*chave=eq\.acesso_confirmado/, { body: v ? [v] : [] }];
const authOk = [/\/auth\/v1\/admin\/users$/, { status: 200, body: { id: UID } }];
const linkOk = [/\/auth\/v1\/admin\/generate_link$/, { body: { action_link: LINK, email_otp: '123456' } }];
const brevoOk = [/api\.brevo\.com/, { body: { messageId: '<ac1@x.net>' } }];
const gravaOk = [/\/rest\/v1\/emails_enviados$/, { method: 'POST', status: 201, body: [] }];
const marcaOk = [/\/rpc\/crm_stripe_acesso_enviado$/, { status: 204 }];
const fluxoCompleto = () => [contatoRota(), aplicarRota(), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk];

console.log('== O modelo de e-mail ==');
const { gerar } = await import(pathToFileURL(path.resolve(HERE, '../../admin/crm/db/modelo-acesso-confirmado.mjs')).href);
check('o arquivo SQL versionado é o que o gerador produz hoje', readFileSync(path.resolve(HERE, '../../admin/crm/db/crm-acesso-email.sql'), 'utf8') === gerar());
check('o Estúdio conhece os dados: nome, email, link_entrada e fim_teste', E.varsDoModelo('acesso_confirmado', null).join() === 'nome,email,link_entrada,fim_teste' && E.CAT.link_entrada.t === 'link' && E.CAT.link_entrada.privado === true);

console.log('\n== A assinatura do Stripe ==');
const corpoTeste = JSON.stringify({ id: 'evt_x' });
check('assinatura certa passa', await stripeAssinaturaConfere(SEGREDO, corpoTeste, assina(corpoTeste)));
check('uma de várias v1 certa basta (o Stripe pode mandar mais de uma)', await stripeAssinaturaConfere(SEGREDO, corpoTeste, assina(corpoTeste, { extra: ['0'.repeat(64)] })));
check('segredo errado', !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, assina(corpoTeste, { segredo: 'outro' }))));
check('corpo mudado depois de assinado', !(await stripeAssinaturaConfere(SEGREDO, corpoTeste + ' ', assina(corpoTeste))));
check('carimbo velho (reenvio de pedido capturado)', !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, assina(corpoTeste, { t: agora - 600 }))));
check('carimbo do futuro', !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, assina(corpoTeste, { t: agora + 600 }))));
check('sem cabeçalho, sem v1, sem t, lixo', !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, null)) && !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, `t=${agora}`)) && !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, 'v1=abc'))
  && !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, 'lixo')) && !(await stripeAssinaturaConfere(SEGREDO, corpoTeste, `t=${agora},v1=`)));
check('segredo vazio nunca valida', !(await stripeAssinaturaConfere('', corpoTeste, assina(corpoTeste, { segredo: '' }))));

console.log('\n== O endpoint recusa quem não é o Stripe ==');
for (const [rotulo, opt] of [['sem cabeçalho', { semCabecalho: true }], ['assinatura errada', { cabecalho: 't=' + agora + ',v1=' + 'a'.repeat(64) }],
  ['segredo de outro endpoint', { segredo: 'whsec_outro' }], ['carimbo velho', { t: agora - 3600 }]]) {
  chamadas = []; fakeFetch(fluxoCompleto());
  const res = await hook(CHECKOUT(), opt);
  check(rotulo + ': 400 e nada é chamado (nem Stripe, nem banco, nem e-mail)', res.status === 400 && chamadas.length === 0);
}
chamadas = []; fakeFetch(fluxoCompleto());
let res = await hook(CHECKOUT(), { corpoReal: JSON.stringify(CHECKOUT({ client_reference_id: '99999999-2222-4333-8444-555555555555' })) });
check('corpo trocado depois de assinado (ficha de outra pessoa): 400', res.status === 400 && chamadas.length === 0);
for (const falta of ['STRIPE_WEBHOOK_SECRET', 'STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  chamadas = []; fakeFetch(fluxoCompleto());
  const lg = console.error; console.error = () => {};
  res = await hook(CHECKOUT(), { env: { ...env, [falta]: undefined } });
  console.error = lg;
  check('sem ' + falta + ': 500 (o Stripe tenta de novo depois que você configurar)', res.status === 500 && chamadas.length === 0);
}
res = await worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'GET' }), env, {});
check('GET não é o webhook', res.status === 404);

console.log('\n== Eventos que não são do Por Dentro ==');
for (const [rotulo, ev] of [['tipo que não tratamos', { id: 'evt_o', type: 'charge.refunded', data: { object: {} } }],
  ['compra avulsa (modo pagamento, produto digital)', CHECKOUT({ mode: 'payment', subscription: null })],
  ['sem id de evento', { type: 'checkout.session.completed', data: { object: {} } }]]) {
  chamadas = []; fakeFetch(fluxoCompleto());
  res = await hook(ev);
  check(rotulo + ': 200, ignorado, nada é chamado', res.status === 200 && (await res.json()).ignorado === true && chamadas.length === 0);
}
chamadas = []; fakeFetch(fluxoCompleto());
res = await hook('isto não é json');
check('corpo que não é JSON (mas assinado): 400', res.status === 400);

console.log('\n== Pagamento novo: ficha, assinatura, conta e e-mail ==');
const logs = []; const logAntes = [console.log, console.error, console.warn, console.info];
console.log = console.error = console.warn = console.info = (...a) => logs.push(a.join(' '));
chamadas = []; fakeFetch(fluxoCompleto());
res = await hook(CHECKOUT());
[console.log, console.error, console.warn, console.info] = logAntes;
let j = await res.json();
check('200 e processado', res.status === 200 && j.ok === true && j.duplicado === false);
const ap = toca(/crm_stripe_aplicar/)[0];
check('guarda a assinatura com o que o Stripe informou, pelo id do evento', ap.body.p_evento === 'evt_c1' && ap.body.p_tipo === 'checkout.session.completed' && ap.body.p_contato === CID);
check('status, ids, plano (nome do produto) e moeda', ap.body.p_assinatura.status === 'trialing' && ap.body.p_assinatura.subscription === 'sub_1' && ap.body.p_assinatura.customer === 'cus_1'
  && ap.body.p_assinatura.plano === 'Por Dentro · Básico mensal' && ap.body.p_assinatura.moeda === 'brl');
check('fim do teste e do período vêm do Stripe, em ISO (o Worker não conta 30 dias)', ap.body.p_assinatura.teste_fim === new Date((agora + 30 * 86400) * 1000).toISOString() && ap.body.p_assinatura.periodo_fim === ap.body.p_assinatura.teste_fim);
check('usa a service_role do Supabase', ap.headers.Authorization === 'Bearer srv');
check('pede a assinatura ao Stripe com a chave secreta (e o nome do produto)', /expand\[\]=items\.data\.price\.product/.test(toca(/api\.stripe\.com/)[0].url) && toca(/api\.stripe\.com/)[0].headers.Authorization === 'Bearer sk_test_x');
const cria = toca(/auth\/v1\/admin\/users$/)[0];
check('cria a conta já confirmada, com o e-mail da ficha', cria.body.email === 'ana@example.com' && cria.body.email_confirm === true && !('password' in cria.body));
const gl = toca(/generate_link/)[0];
check('gera o link de entrada para o app', gl.body.type === 'magiclink' && gl.body.email === 'ana@example.com' && gl.body.redirect_to === 'https://plataforma.imigrantepordentro.com/');
const bv = toca(/brevo/)[0];
check('e-mail para a ficha, com o link de entrada no botão e no texto', bv.body.to[0].email === 'ana@example.com' && bv.body.textContent.includes(LINK) && bv.body.htmlContent.includes('href="' + LINK.replace(/&/g, '&amp;') + '"'));
check('assunto com o primeiro nome e fim do teste preenchido', bv.body.subject === 'Ana, o seu acesso ao Por Dentro está liberado' && bv.body.textContent.includes('Teste grátis até: ' + new Date((agora + 30 * 86400) * 1000).toISOString().slice(8, 10)));
check('é transacional: sem List-Unsubscribe', !bv.body.headers && bv.body.tags.join() === 'crm,acesso_confirmado');
const hist = toca(/emails_enviados$/)[0];
check('o histórico guarda o e-mail SEM o link de entrada (uso único)', hist.body.modelo === 'acesso_confirmado' && hist.body.modelo_versao === 1 && !JSON.stringify(hist.body).includes('TOKEN-DE-USO-UNICO') && /link de entrada, uso único/.test(hist.body.corpo));
check('marca que o e-mail saiu (para o reenvio do Stripe não mandar de novo)', toca(/crm_stripe_acesso_enviado/)[0].body.p_contato === CID);
check('ordem: assinatura gravada antes da conta, conta antes do e-mail', chamadas.indexOf(toca(/crm_stripe_aplicar/)[0]) < chamadas.indexOf(cria) && chamadas.indexOf(cria) < chamadas.indexOf(gl) && chamadas.indexOf(gl) < chamadas.indexOf(bv));
check('o link de entrada nunca vai para o log', !logs.join('\n').includes('TOKEN-DE-USO-UNICO') && !logs.join('\n').includes('123456'));

console.log('\n== Sem o id da ficha no pagamento ==');
chamadas = []; fakeFetch([[/contatos\?select=id,email,nome,user_id&email=eq\.ana%40example\.com/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana', user_id: null }] }], aplicarRota(), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT({ client_reference_id: null }));
check('acha a ficha pelo e-mail do pagamento', res.status === 200 && toca(/crm_stripe_aplicar/)[0].body.p_contato === CID);
chamadas = []; fakeFetch([[/contatos\?select=id,email,nome,user_id&email=eq\./, { body: [] }], [/\/rest\/v1\/contatos\?select=id,email,nome,user_id$/, { method: 'POST', status: 201, body: [{ id: CID, email: 'nova@example.com', nome: 'Nova', user_id: null }] }],
  aplicarRota(), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT({ client_reference_id: 'não-é-uuid', customer_details: { email: 'Nova@Example.com', name: 'Nova' } }));
const nova = toca(/\/contatos\?select=id,email,nome,user_id$/)[0];
check('pagou sem ter ficha: abre a ficha pelo e-mail (minúsculo) e segue', res.status === 200 && nova.body.email === 'nova@example.com' && nova.body.origem === 'stripe');
chamadas = []; fakeFetch([[/contatos\?select=id,email,nome,user_id&email=eq\./, { body: [] }], contatoRota(), aplicarRota(), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
const lg1 = console.error; console.error = () => {};
res = await hook(CHECKOUT({ client_reference_id: null, customer_details: {}, customer_email: null }));
console.error = lg1;
check('sem id e sem e-mail: 500 (o Stripe tenta de novo) e nenhum e-mail sai', res.status === 500 && !toca(/brevo/).length);

console.log('\n== O Stripe repete o evento ==');
chamadas = []; fakeFetch([contatoRota(), aplicarRota({ duplicado: true, acesso_enviado_em: '2026-10-23T10:00:00Z' }), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('evento repetido cujo e-mail já saiu: 200 e nada de conta nem e-mail', res.status === 200 && (await res.json()).duplicado === true && !toca(/admin\/users|generate_link|brevo/).length);
chamadas = []; fakeFetch([contatoRota(), aplicarRota({ duplicado: true, acesso_enviado_em: null }), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('evento repetido mas o e-mail NÃO saiu da primeira vez: refaz só o e-mail', res.status === 200 && toca(/brevo/).length === 1);

console.log('\n== Falhas depois de gravar: o Stripe tenta de novo ==');
const lg2 = console.error; console.error = () => {};
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(), modeloRota(), authOk, linkOk, [/api\.brevo\.com/, { status: 401, body: { message: 'Key not found' } }], gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('Brevo recusou: 500 e NÃO marca o e-mail como enviado', res.status === 500 && !toca(/crm_stripe_acesso_enviado/).length && !toca(/emails_enviados$/).length);
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(), modeloRota(null), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('modelo sem versão No ar: 500 e não cria conta nem manda e-mail', res.status === 500 && !toca(/admin\/users|brevo/).length);
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(), modeloRota(), [/\/auth\/v1\/admin\/users$/, { status: 500, body: {} }], linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('não conseguiu criar a conta: 500 e nenhum e-mail', res.status === 500 && !toca(/brevo/).length);
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(), modeloRota(), authOk, [/generate_link/, { status: 500, body: {} }], brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('não gerou o link de entrada: 500 e nenhum e-mail', res.status === 500 && !toca(/brevo/).length);
chamadas = []; fakeFetch([contatoRota(), [/\/rpc\/crm_stripe_aplicar$/, { status: 400, body: { message: 'contato_nao_encontrado' } }], stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('o banco recusou o pagamento novo: 500 e nenhum e-mail', res.status === 500 && !toca(/brevo/).length);
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), [/api\.stripe\.com/, { status: 404, body: {} }], modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('não leu a assinatura no Stripe: 500 e nada é gravado', res.status === 500 && !toca(/crm_stripe_aplicar/).length);
console.error = lg2;
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(), modeloRota(), [/\/auth\/v1\/admin\/users$/, { status: 422, body: { error_code: 'email_exists' } }], linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
check('a conta já existia (422): segue e manda o e-mail', res.status === 200 && toca(/brevo/).length === 1);

console.log('\n== Sem teste grátis, e outros formatos do Stripe ==');
chamadas = []; fakeFetch([contatoRota(), aplicarRota(), stripeSub(SUB({ status: 'active', trial_end: null })), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(CHECKOUT());
const ap2 = toca(/crm_stripe_aplicar/)[0].body.p_assinatura;
check('sem teste: teste_fim vazio e o e-mail sai sem a linha do teste', ap2.teste_fim === null && !toca(/brevo/)[0].body.textContent.includes('Teste grátis'));
const novaApi = stripeAssinaturaJson({ id: 'sub_9', status: 'active', customer: { id: 'cus_9' }, current_period_end: agora + 100, cancel_at_period_end: true, items: { data: [{ price: { currency: 'eur', nickname: 'Básico anual', product: 'prod_1' } }] } }, agora);
check('versão da API com o fim do período na assinatura, cliente como objeto e produto só com id', novaApi.customer === 'cus_9' && novaApi.periodo_fim === new Date((agora + 100) * 1000).toISOString() && novaApi.plano === 'Básico anual' && novaApi.moeda === 'eur' && novaApi.cancela_no_fim === true);

console.log('\n== Mudanças depois do pagamento ==');
const subEv = (tipo, extra = {}) => ({ id: 'evt_s_' + tipo, type: tipo, created: agora + 5, data: { object: SUB(extra) } });
chamadas = []; fakeFetch([aplicarRota({ status: 'active' }), stripeSub(), modeloRota(), authOk, linkOk, brevoOk, gravaOk, marcaOk]);
res = await hook(subEv('customer.subscription.updated', { status: 'active', trial_end: agora - 10, cancel_at_period_end: true }));
const up = toca(/crm_stripe_aplicar/)[0].body;
check('subscription.updated: grava o status novo, sem ficha (acha pela assinatura), sem ir ao Stripe', res.status === 200 && up.p_contato === null && up.p_assinatura.status === 'active' && up.p_assinatura.cancela_no_fim === true && !toca(/api\.stripe\.com/).length);
check('e nunca manda e-mail de acesso nem cria conta nesses eventos', !toca(/brevo|admin\/users/).length);
chamadas = []; fakeFetch([aplicarRota({ status: 'canceled' })]);
res = await hook(subEv('customer.subscription.deleted', { status: 'canceled' }));
check('subscription.deleted: status canceled gravado', res.status === 200 && toca(/crm_stripe_aplicar/)[0].body.p_assinatura.status === 'canceled' && toca(/crm_stripe_aplicar/)[0].body.p_tipo === 'customer.subscription.deleted');
chamadas = []; fakeFetch([aplicarRota({ status: 'past_due' }), stripeSub(SUB({ status: 'past_due' }))]);
res = await hook({ id: 'evt_i1', type: 'invoice.payment_failed', created: agora + 9, data: { object: { id: 'in_1', subscription: 'sub_1', customer: 'cus_1' } } });
check('invoice.payment_failed: lê a assinatura no Stripe e grava past_due', res.status === 200 && toca(/crm_stripe_aplicar/)[0].body.p_assinatura.status === 'past_due');
chamadas = []; fakeFetch([aplicarRota({ status: 'past_due' }), stripeSub(SUB({ status: 'past_due' }))]);
res = await hook({ id: 'evt_i2', type: 'invoice.payment_failed', created: agora + 9, data: { object: { id: 'in_2', parent: { subscription_details: { subscription: 'sub_1' } } } } });
check('invoice.payment_failed no formato novo da API (parent.subscription_details)', res.status === 200 && toca(/api\.stripe\.com\/v1\/subscriptions\/sub_1/).length === 1);
chamadas = []; fakeFetch([aplicarRota()]);
res = await hook({ id: 'evt_i3', type: 'invoice.payment_failed', created: agora, data: { object: { id: 'in_3' } } });
check('fatura que não é de assinatura: ignorada', res.status === 200 && (await res.json()).ignorado === true && !chamadas.length);
chamadas = []; fakeFetch([[/\/rpc\/crm_stripe_aplicar$/, { status: 400, body: { message: 'contato_nao_encontrado' } }]]);
res = await hook(subEv('customer.subscription.updated', { id: 'sub_de_outro_produto' }));
check('assinatura de outro produto da conta Stripe: 200 (não adianta o Stripe repetir)', res.status === 200 && (await res.json()).ignorado === true);
const lg3 = console.error; console.error = () => {};
chamadas = []; fakeFetch([[/\/rpc\/crm_stripe_aplicar$/, { status: 500, body: { message: 'boom' } }]]);
res = await hook(subEv('customer.subscription.updated'));
console.error = lg3;
check('erro de verdade no banco: 500 (o Stripe tenta de novo)', res.status === 500);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
