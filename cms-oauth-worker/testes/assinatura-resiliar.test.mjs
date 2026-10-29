// Testa a resiliação pelo app no Worker: GET /api/assinatura/minha e POST /api/assinatura/resiliar.
// Tudo com fetch falso (não chama Stripe, Supabase nem Brevo). Pessoas e ids fictícios.
// Confere: só com o token da própria pessoa, só a assinatura da ficha dela, cancela no fim do período (nunca na hora),
// nada do Stripe vaza para o app, a confirmação por e-mail sai com a data, e uma segunda vez não faz nada.
//
// Uso: node cms-oauth-worker/testes/assinatura-resiliar.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'resiliar-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { assinaturaPublica, resiliacaoEmail };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { assinaturaPublica, resiliacaoEmail } = mod;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const CID = '11111111-2222-4333-8444-555555555555';
const UID = 'aaaaaaaa-2222-4333-8444-555555555555';
const env = { STRIPE_SECRET_KEY: 'sk_test_x', SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org' };
const agora = Math.floor(Date.now() / 1000);
const fimTeste = new Date((agora + 20 * 86400) * 1000).toISOString();

let chamadas = [];
function fakeFetch(regras) {
  chamadas = [];
  globalThis.fetch = async (url, opt = {}) => {
    const c = { url: String(url), method: opt.method || 'GET', body: opt.body || null, headers: opt.headers || {} };
    chamadas.push(c);
    for (const [re, resp0, metodo] of regras) {
      if (!re.test(c.url) || (metodo && metodo !== c.method)) continue;
      const resp = typeof resp0 === 'function' ? resp0(c) : resp0;
      return new Response(resp.status === 204 ? null : JSON.stringify(resp.body ?? {}), { status: resp.status || 200 });
    }
    return new Response('{}', { status: 404 });
  };
}
const toca = (re, metodo) => chamadas.filter((c) => re.test(c.url) && (!metodo || c.method === metodo));
const ASSIN = (extra = {}) => ({ stripe_subscription_id: 'sub_1', status: 'trialing', plano: 'Plataforma Por Dentro', moeda: 'EUR', teste_fim: fimTeste, periodo_fim: fimTeste, cancela_no_fim: false, ...extra });
const userOk = [/\/auth\/v1\/user$/, { body: { id: UID, email: 'ana@example.com' } }];
const contatoOk = [/\/rest\/v1\/contatos\?select=id,email,nome&user_id=eq\./, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Maria' }] }];
const assinRota = (a = ASSIN()) => [/\/rest\/v1\/assinaturas\?select=/, { body: a ? [a] : [] }, 'GET'];
const stripeOk = (extra = {}) => [/api\.stripe\.com\/v1\/subscriptions\/sub_1$/, { body: { id: 'sub_1', status: 'trialing', cancel_at_period_end: true, trial_end: agora + 20 * 86400,
  items: { data: [{ current_period_end: agora + 20 * 86400, price: { currency: 'eur', product: 'prod_1' } }] }, ...extra } }, 'POST'];
const patchOk = [/\/rest\/v1\/assinaturas\?contato_id=eq\./, { status: 204 }, 'PATCH'];
const eventoOk = [/\/rest\/v1\/eventos$/, { status: 201 }, 'POST'];
const brevoOk = [/api\.brevo\.com/, { body: { messageId: '<r1@x.net>' } }];
const gravaOk = [/\/rest\/v1\/emails_enviados$/, { status: 201 }, 'POST'];
const tudo = (a) => [userOk, contatoOk, assinRota(a), stripeOk(), patchOk, eventoOk, brevoOk, gravaOk];

const pede = (metodo, rota, { token = 'tok-ana', body } = {}) => worker.fetch(new Request('https://w.example' + rota, {
  method: metodo, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, {});

console.log('== O que o app pode ver ==');
check('sem assinatura: tem = false', assinaturaPublica(null).tem === false);
const pubT = assinaturaPublica(ASSIN());
check('teste grátis: fim é o fim do teste e pode resiliar', pubT.em_teste && pubT.fim === fimTeste && pubT.pode_resiliar);
check('nada do Stripe vai para o app', !JSON.stringify(pubT).includes('sub_1'));
check('já resiliada: não pode de novo', assinaturaPublica(ASSIN({ cancela_no_fim: true })).pode_resiliar === false);
check('cancelada ou encerrada: não pode resiliar', assinaturaPublica(ASSIN({ status: 'canceled' })).pode_resiliar === false);
check('pagamento falhou: ainda pode resiliar', assinaturaPublica(ASSIN({ status: 'past_due' })).pode_resiliar === true);
check('sem id no Stripe (cortesia criada à mão): não mostra o botão', assinaturaPublica(ASSIN({ stripe_subscription_id: null })).pode_resiliar === false);

console.log('\n== GET /api/assinatura/minha ==');
fakeFetch(tudo());
let r = await pede('GET', '/api/assinatura/minha', { token: null });
check('sem token: 401 e nada consultado', r.status === 401 && chamadas.length === 0);
fakeFetch([[/\/auth\/v1\/user$/, { status: 401, body: {} }]]);
r = await pede('GET', '/api/assinatura/minha', { token: 'falso' });
check('token falso: 401', r.status === 401);
fakeFetch(tudo());
r = await pede('GET', '/api/assinatura/minha');
let j = await r.json();
check('pessoa logada vê o próprio plano', r.status === 200 && j.tem && j.plano === 'Plataforma Por Dentro' && j.pode_resiliar);
check('a ficha é buscada pela conta do token, não por nada que o navegador mande', toca(/contatos\?select=id,email,nome&user_id=eq\.aaaaaaaa/).length === 1);
fakeFetch([userOk, [/\/rest\/v1\/contatos/, { body: [] }]]);
j = await (await pede('GET', '/api/assinatura/minha')).json();
check('conta sem ficha: tem = false', j.ok && j.tem === false);

console.log('\n== POST /api/assinatura/resiliar ==');
fakeFetch(tudo());
r = await pede('POST', '/api/assinatura/resiliar', { body: { motivo: '  Já consegui o visto  ', subscription: 'sub_de_outra' } });
j = await r.json();
check('resilia: 200 e devolve até quando', r.status === 200 && j.ok && j.cancela_no_fim === true && j.fim && j.email_enviado === true);
const st = toca(/api\.stripe\.com/, 'POST')[0];
check('no Stripe: cancela no fim do período, nunca na hora', st && /cancel_at_period_end=true/.test(st.body) && st.method === 'POST' && !toca(/api\.stripe\.com/, 'DELETE').length);
check('no Stripe: a assinatura da ficha dela, não a que veio no corpo', st && /subscriptions\/sub_1$/.test(st.url));
check('no Stripe: o motivo vai junto, limpo', st && new URLSearchParams(st.body).get('cancellation_details[comment]') === 'Já consegui o visto');
check('marca na ficha e registra o evento', toca(/assinaturas\?contato_id=eq\./, 'PATCH').length === 1 && JSON.parse(toca(/\/eventos$/)[0].body).tipo === 'resiliacao_pedida');
const mail = JSON.parse(toca(/api\.brevo\.com/)[0].body);
check('confirmação por e-mail para ela, com a data do fim', mail.to[0].email === 'ana@example.com' && mail.textContent.includes(new Date(fimTeste).toISOString().slice(8, 10) + '/') && /teste grátis: nada foi cobrado/.test(mail.textContent));
check('confirmação cita a lei francesa', /L215-1-1/.test(mail.textContent));
check('confirmação registrada no histórico de e-mails', JSON.parse(toca(/emails_enviados$/)[0].body).modelo === 'resiliacao_confirmada');

fakeFetch(tudo(ASSIN({ cancela_no_fim: true })));
j = await (await pede('POST', '/api/assinatura/resiliar', { body: {} })).json();
check('segunda vez: ok, já resiliada, sem tocar no Stripe nem mandar e-mail', j.ok && j.ja_resiliada && toca(/api\.stripe\.com/).length === 0 && toca(/brevo/).length === 0);

fakeFetch(tudo(null));
r = await pede('POST', '/api/assinatura/resiliar', { body: {} });
check('sem assinatura: 404', r.status === 404);
fakeFetch(tudo(ASSIN({ status: 'canceled' })));
r = await pede('POST', '/api/assinatura/resiliar', { body: {} });
check('já encerrada: 409, sem Stripe', r.status === 409 && toca(/api\.stripe\.com/).length === 0);

fakeFetch([userOk, contatoOk, assinRota(), [/api\.stripe\.com/, { status: 500, body: { error: {} } }]]);
const errAntes = console.error; console.error = () => {};
r = await pede('POST', '/api/assinatura/resiliar', { body: {} });
console.error = errAntes;
check('Stripe falhou: 502 e nada marcado nem enviado', r.status === 502 && toca(/PATCH/).length === 0 && toca(/brevo/).length === 0 && toca(/assinaturas\?contato_id/, 'PATCH').length === 0);

fakeFetch([userOk, contatoOk, assinRota(ASSIN({ status: 'active', teste_fim: null })), stripeOk({ status: 'active', trial_end: null }), patchOk, eventoOk, [/api\.brevo\.com/, { status: 400, body: {} }]]);
console.error = () => {};
j = await (await pede('POST', '/api/assinatura/resiliar', { body: {} })).json();
console.error = errAntes;
check('e-mail recusado: a resiliação vale e o app sabe que o e-mail não saiu', j.ok && j.cancela_no_fim && j.email_enviado === false);

console.log('\n== O texto da confirmação ==');
const ativa = resiliacaoEmail({ nome: 'Bia Souza' }, { plano: 'Plataforma Por Dentro', fim: '2026-12-06T10:00:00Z', em_teste: false }, new Date('2026-11-10T09:00:00Z'));
check('plano pago: sem cobrança nova e período pago vale até o fim', /Não haverá nenhuma cobrança nova/.test(ativa.texto) && /06\/12\/2026/.test(ativa.texto) && /^Oi Bia,/.test(ativa.texto));
check('diz o que acontece depois e como apagar os dados', /Nada é apagado/.test(ativa.texto) && /apagados/.test(ativa.texto));
check('hora do pedido em horário de Paris', /10\/11\/2026.*10:00/.test(ativa.texto));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
