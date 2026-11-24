// Testa o que o Cal.com traz para o Worker: POST /api/cal/webhook (a reserva entra, muda de data e é cancelada na agenda) e o pagamento
// do 1:1 reservado pelo Cal.com (payment_intent.succeeded em /api/stripe/webhook). Tudo com fetch falso (não chama Cal.com, Stripe nem
// Supabase). Pessoas e ids fictícios.
//
// Uso: node cms-oauth-worker/testes/cal-webhook.test.mjs   (Node 20+, sem dependências)
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'cal-wh-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(arq).href)).default;
rmSync(dir, { recursive: true, force: true });

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const CAL_SEGREDO = 'segredo-do-cal-com-com-mais-de-24-caracteres';
const STRIPE_SEGREDO = 'whsec_teste_segredo_do_endpoint';
const CID = '11111111-2222-4333-8444-555555555555';
const env = { CAL_WEBHOOK_SECRET: CAL_SEGREDO, STRIPE_WEBHOOK_SECRET: STRIPE_SEGREDO, STRIPE_SECRET_KEY: 'sk_test_x', SUPABASE_SERVICE_ROLE_KEY: 'srv' };

let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    const c = { url: String(url), method: opt.method || 'GET', body: typeof opt.body === 'string' ? (() => { try { return JSON.parse(opt.body); } catch (e) { return opt.body; } })() : null };
    chamadas.push(c);
    for (const [re, resp] of regras) {
      if (!re.test(c.url)) continue;
      return new Response(resp.status === 204 ? null : JSON.stringify(resp.body ?? {}), { status: resp.status || 200 });
    }
    return new Response('{}', { status: 404 });
  };
}
const toca = (re) => chamadas.filter((c) => re.test(c.url));

// ---------- Cal.com ----------
const calHook = (evento, opt = {}) => {
  const corpo = typeof evento === 'string' ? evento : JSON.stringify(evento);
  const cab = opt.cabecalho ?? createHmac('sha256', opt.segredo ?? CAL_SEGREDO).update(corpo).digest('hex');
  return worker.fetch(new Request('https://w.example/api/cal/webhook', { method: 'POST', headers: opt.semCabecalho ? {} : { 'x-cal-signature-256': cab }, body: corpo }), opt.env ?? env, {});
};
const RESERVA = (triggerEvent, p = {}) => ({ triggerEvent, createdAt: '2026-11-20T14:22:00Z',
  payload: { uid: 'bk_1', title: '1:1 (20 min) between Ingryd Silva and Wellington', startTime: '2026-11-23T10:00:00Z', endTime: '2026-11-23T10:20:00Z',
    attendees: [{ email: 'Wellington@Example.com', name: 'Wellington', timeZone: 'Europe/Paris' }], ...p } });
const achaPorEmail = [/\/rest\/v1\/contatos\?select=id,email,nome,user_id&email=eq\./, { body: [{ id: CID, email: 'wellington@example.com', nome: 'Wellington', user_id: null }] }];
const achaSoId = (corpo) => [/\/rest\/v1\/contatos\?select=id&email=eq\./, { body: corpo }];
const rpcCal = (body = { ok: true, acao: 'criada', um_a_um_id: 7 }) => [/\/rpc\/crm_cal_reserva$/, { body }];

console.log('== Assinatura do Cal.com ==');
fakeFetch([achaPorEmail, rpcCal()]); chamadas = [];
let r = await calHook(RESERVA('BOOKING_CREATED'), { cabecalho: 'a'.repeat(64) });
check('assinatura errada: 400 e nada é gravado', r.status === 400 && chamadas.length === 0);
r = await calHook(RESERVA('BOOKING_CREATED'), { semCabecalho: true });
check('sem cabeçalho: 400', r.status === 400 && chamadas.length === 0);
r = await calHook(RESERVA('BOOKING_CREATED'), { segredo: 'outro-segredo-com-mais-de-24-caracteres' });
check('assinada com outro segredo: 400', r.status === 400);
r = await calHook(RESERVA('BOOKING_CREATED'), { env: { ...env, CAL_WEBHOOK_SECRET: undefined } });
check('Worker sem CAL_WEBHOOK_SECRET: 500 (não aceita nada)', r.status === 500);
r = await calHook(RESERVA('BOOKING_CREATED'), { env: { ...env, CAL_WEBHOOK_SECRET: 'curto' }, cabecalho: createHmac('sha256', 'curto').update(JSON.stringify(RESERVA('BOOKING_CREATED'))).digest('hex') });
check('segredo curto demais não vale, nem com assinatura certa', r.status === 400);

console.log('\n== Reserva nova ==');
chamadas = []; fakeFetch([achaPorEmail, rpcCal()]);
r = await calHook(RESERVA('BOOKING_CREATED'));
let rpc = toca(/crm_cal_reserva/)[0];
check('200 e chama crm_cal_reserva com a ficha, o id e a data da reserva', r.status === 200 && rpc && rpc.body.p_contato === CID && rpc.body.p_uid === 'bk_1' && rpc.body.p_evento === 'criada' && rpc.body.p_quando === '2026-11-23T10:00:00.000Z' && rpc.body.p_uid_anterior === null);
check('o e-mail é procurado em minúsculas', /email=eq\.wellington%40example\.com/.test(toca(/contatos\?/)[0].url));
chamadas = []; fakeFetch([achaPorEmail, rpcCal()]);
await calHook({ triggerEvent: 'BOOKING_PAID', payload: RESERVA('x').payload });
check('BOOKING_PAID vale como reserva criada', toca(/crm_cal_reserva/)[0]?.body.p_evento === 'criada');

console.log('\n== Remarcar e cancelar ==');
chamadas = []; fakeFetch([achaPorEmail, rpcCal({ ok: true, acao: 'remarcada', um_a_um_id: 7 })]);
await calHook(RESERVA('BOOKING_RESCHEDULED', { uid: 'bk_2', rescheduleUid: 'bk_1', startTime: '2026-11-30T14:00:00Z' }));
rpc = toca(/crm_cal_reserva/)[0];
check('remarcar manda o id novo, a data nova e o id antigo', rpc.body.p_evento === 'remarcada' && rpc.body.p_uid === 'bk_2' && rpc.body.p_uid_anterior === 'bk_1' && rpc.body.p_quando === '2026-11-30T14:00:00.000Z');
chamadas = []; fakeFetch([achaSoId([{ id: CID }]), rpcCal({ ok: true, acao: 'cancelada', um_a_um_id: 7 })]);
await calHook(RESERVA('BOOKING_CANCELLED', { uid: 'bk_2' }));
rpc = toca(/crm_cal_reserva/)[0];
check('cancelar chama a função como cancelada, sem data', rpc.body.p_evento === 'cancelada' && rpc.body.p_uid === 'bk_2' && rpc.body.p_quando === null);
chamadas = []; fakeFetch([achaSoId([]), rpcCal()]);
r = await calHook(RESERVA('BOOKING_CANCELLED', { uid: 'bk_9' }));
check('cancelar para quem não tem ficha não abre ficha nem chama a função', r.status === 200 && toca(/crm_cal_reserva/).length === 0 && !chamadas.some((c) => c.method === 'POST'));

console.log('\n== O que é ignorado ==');
for (const [nome, corpo] of [['evento que não é de reserva (PING)', { triggerEvent: 'PING', payload: {} }], ['reserva sem participante', RESERVA('BOOKING_CREATED', { attendees: [] })],
  ['e-mail inválido', RESERVA('BOOKING_CREATED', { attendees: [{ email: 'sem-arroba' }] })], ['data inválida', RESERVA('BOOKING_CREATED', { startTime: 'amanhã' })], ['sem id da reserva', RESERVA('BOOKING_CREATED', { uid: '' })]]) {
  chamadas = []; fakeFetch([achaPorEmail, rpcCal()]);
  r = await calHook(corpo);
  check(nome + ': 200 sem gravar nada', r.status === 200 && chamadas.length === 0);
}
r = await calHook('isto não é json');
check('corpo que não é JSON (mas assinado): 400', r.status === 400);

console.log('\n== Falhas ==');
chamadas = []; fakeFetch([achaPorEmail]);
r = await calHook(RESERVA('BOOKING_CREATED'));
check('falta rodar crm-1a1-cal.sql: 500 e o aviso no log, para o Cal.com poder repetir', r.status === 500);
fakeFetch([achaPorEmail, [/\/rpc\/crm_cal_reserva$/, { status: 400, body: { message: 'reserva_invalida' } }]]);
r = await calHook(RESERVA('BOOKING_CREATED'));
check('a função recusar a reserva: 500 sem vazar o motivo', r.status === 500 && !(await r.text()).includes('reserva_invalida'));

// ---------- Pagamento do Cal.com (Stripe) ----------
const agora = Math.floor(Date.now() / 1000);
const stripeHook = (evento) => {
  const corpo = JSON.stringify(evento);
  const v1 = createHmac('sha256', STRIPE_SEGREDO).update(agora + '.' + corpo).digest('hex');
  return worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${agora},v1=${v1}` }, body: corpo }), env, {});
};
const PI = (md, extra = {}) => ({ id: 'evt_pi1', type: 'payment_intent.succeeded', created: agora,
  data: { object: { id: 'pi_1', object: 'payment_intent', amount: 3500, amount_received: 3500, currency: 'eur', created: agora, metadata: md, ...extra } } });
const CAL_MD = { identifier: 'cal.com', bookingId: '123', bookerEmail: 'wellington@example.com', bookerName: 'Wellington' };
const regPag = [/\/rpc\/crm_pagamento_registrar$/, { body: '' }];
const pago = (b = { duplicado: false }) => [/\/rpc\/crm_1a1_pago$/, { body: b }];

console.log('\n== Pagamento do 1:1 pelo Cal.com ==');
chamadas = []; fakeFetch([achaPorEmail, regPag, pago()]);
r = await stripeHook(PI(CAL_MD));
let rg = toca(/crm_pagamento_registrar/)[0], pg = toca(/crm_1a1_pago/)[0];
check('registra o dinheiro real, ligado à ficha, pelo id do PaymentIntent', r.status === 200 && rg && rg.body.p_contato === CID && rg.body.p_referencia === 'pi_1' && rg.body.p_valor_centavos === 3500 && rg.body.p_moeda === 'EUR' && rg.body.p_tipo === '1a1');
check('35 € vira 1:1 de 20 min na agenda (crm_1a1_pago, sessão = id do PaymentIntent)', pg && pg.body.p_minutos === 20 && pg.body.p_sessao === 'pi_1' && pg.body.p_contato === CID);
chamadas = []; fakeFetch([achaPorEmail, regPag, pago()]);
await stripeHook(PI(CAL_MD, { id: 'pi_2', amount: 7000, amount_received: 7000 }));
check('70 € vira 1:1 de 40 min', toca(/crm_1a1_pago/)[0]?.body.p_minutos === 40);
chamadas = []; fakeFetch([achaPorEmail, regPag, pago()]);
r = await stripeHook(PI(CAL_MD, { id: 'pi_3', amount: 5000, amount_received: 5000 }));
check('valor fora da tabela: o dinheiro entra, mas a agenda não é mexida', r.status === 200 && toca(/crm_pagamento_registrar/).length === 1 && toca(/crm_1a1_pago/).length === 0);
chamadas = []; fakeFetch([achaPorEmail, regPag, pago()]);
r = await stripeHook(PI({}, { receipt_email: 'outra@example.com' }));
check('PaymentIntent sem marca do Cal.com (outra cobrança da conta) é ignorado', r.status === 200 && chamadas.length === 0);
chamadas = []; fakeFetch([achaPorEmail, regPag, pago()]);
r = await stripeHook(PI({ identifier: 'cal.com' }));
check('pagamento do Cal.com sem e-mail: ignorado, sem gravar', r.status === 200 && chamadas.length === 0);
chamadas = []; fakeFetch([achaPorEmail, regPag, [/\/rpc\/crm_1a1_pago$/, { body: { duplicado: true } }]]);
r = await stripeHook(PI(CAL_MD));
check('o Stripe reenviando o evento: 200 e duplicado, sem erro', r.status === 200 && (await r.json()).duplicado === true);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
