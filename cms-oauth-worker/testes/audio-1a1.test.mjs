// Testa as duas rotas do 1:1 pago no Worker, com fetch falso (não chama Stripe, Supabase nem Workers AI):
//   POST /api/stripe/webhook (compra avulsa 1a1_20 / 1a1_40 → crm_1a1_pago)  e  POST /api/audio/transcrever.
// Uso: node cms-oauth-worker/testes/audio-1a1.test.mjs   (Node 20+)
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'audio-1a1-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(arq).href)).default;
rmSync(dir, { recursive: true, force: true });
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const CID = '11111111-2222-4333-8444-555555555555', UID = 'aaaaaaaa-2222-4333-8444-555555555555';
const SEGREDO = 'whsec_teste';
const agora = Math.floor(Date.now() / 1000);
const kv = new Map();
const baseEnv = { STRIPE_WEBHOOK_SECRET: SEGREDO, STRIPE_SECRET_KEY: 'sk_test_x', SUPABASE_SERVICE_ROLE_KEY: 'srv', REVIEWS_KV: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
let chamadas = [], logs = [];
const origErr = console.error; console.error = (...a) => { logs.push(a.join(' ')); };
function falso({ contato = { id: CID, email: 'ana@example.com', nome: 'Ana', user_id: UID }, pago = { status: 200, body: { duplicado: false, aviso_agendado: true } }, audioLiberado = true, userOk = true } = {}) {
  chamadas = []; logs = [];
  globalThis.fetch = async (url, opt = {}) => {
    const c = { url: String(url), method: opt.method || 'GET', body: typeof opt.body === 'string' ? opt.body : null, headers: opt.headers || {} };
    chamadas.push(c);
    const r = (st, b) => new Response(JSON.stringify(b ?? {}), { status: st });
    if (/\/rest\/v1\/contatos\?select=id,email,nome,user_id&id=eq\./.test(c.url)) return r(200, contato ? [contato] : []);
    if (/\/rest\/v1\/contatos\?select=id,email,nome,user_id&email=eq\./.test(c.url)) return r(200, contato ? [contato] : []);
    if (/\/rpc\/crm_1a1_pago$/.test(c.url)) return r(pago.status, pago.body);
    if (/\/auth\/v1\/user$/.test(c.url)) return userOk ? r(200, { id: UID }) : r(401, {});
    if (/\/rpc\/meu_1a1$/.test(c.url)) return r(200, { audio: audioLiberado });
    return r(404, {});
  };
}
const assina = (corpo) => `t=${agora},v1=${createHmac('sha256', SEGREDO).update(agora + '.' + corpo).digest('hex')}`;
const hook = (obj, env = baseEnv) => { const corpo = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', created: agora, data: { object: obj } });
  return worker.fetch(new Request('https://w.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': assina(corpo), 'Content-Type': 'application/json' }, body: corpo }), env, {}); };
const SESSAO = (extra = {}) => ({ id: 'cs_1a1', mode: 'payment', payment_status: 'paid', client_reference_id: CID, customer_details: { email: 'ana@example.com', name: 'Ana' }, metadata: { por_dentro: '1a1_20' }, ...extra });

console.log('== O pagamento do 1:1 (webhook do Stripe) ==');
falso();
let res = await hook(SESSAO()), j = await res.json();
const pagoCh = chamadas.find((c) => /crm_1a1_pago$/.test(c.url));
check('compra avulsa com por_dentro=1a1_20 chama crm_1a1_pago com a sessão, os minutos e a ficha', res.status === 200 && j.um_a_um === true && pagoCh && JSON.parse(pagoCh.body).p_minutos === 20 && JSON.parse(pagoCh.body).p_sessao === 'cs_1a1' && JSON.parse(pagoCh.body).p_contato === CID);
check('a chamada vai com a chave de serviço, nunca com token de pessoa', pagoCh.headers.Authorization === 'Bearer srv' || /srv/.test(JSON.stringify(pagoCh.headers)));
falso(); res = await hook(SESSAO({ metadata: { por_dentro: '1a1_40' } })); 
check('1a1_40 manda 40 minutos', JSON.parse(chamadas.find((c) => /crm_1a1_pago$/.test(c.url)).body).p_minutos === 40);
falso({ pago: { status: 200, body: { duplicado: true } } }); res = await hook(SESSAO()); j = await res.json();
check('evento repetido: responde ok e duplicado (o Stripe para de tentar)', res.status === 200 && j.duplicado === true);
for (const [rot, o] of [['outra compra avulsa (sem o metadado)', SESSAO({ metadata: {} })], ['metadado fora do combinado', SESSAO({ metadata: { por_dentro: '1a1_99' } })], ['ainda não pago', SESSAO({ payment_status: 'unpaid' })]]) {
  falso(); res = await hook(o); j = await res.json();
  check(rot + ': ignorado, sem tocar no banco', res.status === 200 && j.ignorado === true && !chamadas.some((c) => /crm_1a1_pago/.test(c.url)));
}
falso({ pago: { status: 500, body: {} } }); res = await hook(SESSAO());
check('o banco falhou: 500, para o Stripe tentar de novo', res.status === 500);
falso({ pago: { status: 404, body: {} } }); res = await hook(SESSAO()); j = await res.json();
check('sem o SQL novo: manda rodar crm-1a1.sql (500)', res.status === 500 && /crm-1a1\.sql/.test(j.error));
falso({ contato: null }); res = await hook(SESSAO({ client_reference_id: null, customer_details: { email: 'sem-ficha@example.com' } }));
check('sem achar nem criar a ficha: 500 para o Stripe tentar de novo', res.status === 500 && !chamadas.some((c) => /crm_1a1_pago$/.test(c.url)));

console.log('\n== A transcrição do áudio ==');
const AUDIO = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const audioReq = (o = {}) => new Request('https://w.example/api/audio/transcrever', { method: 'POST', headers: { Authorization: o.semToken ? '' : 'Bearer tok', 'Content-Type': o.tipo ?? 'audio/webm' }, body: o.corpo ?? AUDIO });
const ai = (texto = '  Oi, Ingryd. Meu prazo na préfecture vence em março.  ') => { const f = async (m, e) => { f.chamadas.push({ m, e }); return { text: texto }; }; f.chamadas = []; return f; };
const envA = (AI) => ({ ...baseEnv, AI });
let a = ai(); falso();
res = await worker.fetch(audioReq(), envA({ run: a }), {}); j = await res.json();
check('quem pagou: devolve só o texto, limpo', res.status === 200 && j.ok === true && j.texto === 'Oi, Ingryd. Meu prazo na préfecture vence em março.' && j.cortado === false);
check('manda ao Whisper o áudio em base64, em português e com a dica de vocabulário (préfecture, Campus France…)', a.chamadas.length === 1 && a.chamadas[0].m === '@cf/openai/whisper-large-v3-turbo' && a.chamadas[0].e.audio === Buffer.from(AUDIO).toString('base64') && a.chamadas[0].e.language === 'pt' && /préfecture/.test(a.chamadas[0].e.initial_prompt));
check('nada do áudio nem do texto vai para o log', logs.every((l) => !/préfecture|Ingryd|AQID/.test(l)));
check('a resposta leva o cabeçalho de CORS (o app chama de outra origem)', res.headers.get('Access-Control-Allow-Origin') === '*');
falso(); res = await worker.fetch(audioReq({ semToken: true }), envA({ run: ai() }), {});
check('sem token: 401, e não chama a IA', res.status === 401);
falso({ userOk: false }); a = ai(); res = await worker.fetch(audioReq(), envA({ run: a }), {});
check('token que o Supabase recusa: 401', res.status === 401 && a.chamadas.length === 0);
falso({ audioLiberado: false }); a = ai(); res = await worker.fetch(audioReq(), envA({ run: a }), {}); j = await res.json();
check('quem não pagou o 1:1: 403 audio_nao_liberado, e a IA não é chamada', res.status === 403 && j.codigo === 'audio_nao_liberado' && a.chamadas.length === 0);
falso(); res = await worker.fetch(audioReq(), baseEnv, {}); j = await res.json();
check('sem o binding AI: 503 transcricao_nao_configurada', res.status === 503 && j.codigo === 'transcricao_nao_configurada');
falso(); res = await worker.fetch(audioReq({ tipo: 'text/plain' }), envA({ run: ai() }), {});
check('tipo que não é áudio: 415', res.status === 415);
falso(); res = await worker.fetch(audioReq({ corpo: new Uint8Array(0) }), envA({ run: ai() }), {});
check('áudio vazio: 400', res.status === 400);
falso(); a = ai(); res = await worker.fetch(audioReq({ corpo: new Uint8Array(3 * 1024 * 1024 + 1) }), envA({ run: a }), {});
check('áudio acima de 3 MB: 413, sem chamar a IA', res.status === 413 && a.chamadas.length === 0);
falso(); res = await worker.fetch(audioReq(), envA({ run: async () => { throw new Error('modelo fora do ar'); } }), {}); j = await res.json();
check('a IA falhou: 502 amigável, e o erro não vai ao log com conteúdo', res.status === 502 && j.codigo === 'transcricao_falhou' && logs.every((l) => !/modelo fora do ar/.test(l)));
falso(); res = await worker.fetch(audioReq(), envA({ run: ai('   ') }), {}); j = await res.json();
check('sem fala no áudio: 422', res.status === 422 && j.codigo === 'sem_fala');
falso(); res = await worker.fetch(audioReq(), envA({ run: ai('a'.repeat(1500)) }), {}); j = await res.json();
check('texto acima de 1000 letras é cortado (o chat aceita 1000) e avisa', j.texto.length === 1000 && j.cortado === true);
kv.clear(); let ult = 0;
for (let i = 0; i < 22; i++) { falso(); const r = await worker.fetch(audioReq(), envA({ run: ai() }), {}); ult = r.status; if (r.status === 429) break; }
check('depois de 20 áudios na janela: 429', ult === 429);
res = await worker.fetch(new Request('https://w.example/api/audio/transcrever', { method: 'OPTIONS' }), baseEnv, {});
check('o preflight do navegador é aceito (Authorization e Content-Type)', res.status === 204 && /Authorization/.test(res.headers.get('Access-Control-Allow-Headers')));

console.error = origErr;
console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
