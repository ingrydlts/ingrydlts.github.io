// Testa a pausa dos e-mails automáticos quando a pessoa marca um 1:1 no Cal.com: o aviso para a Ingryd (e-mail com dois links assinados),
// a página de confirmação e a decisão. Fetch falso e "banco" em memória: não chama Supabase nem Brevo. Pessoas fictícias.
// Uso: node cms-oauth-worker/testes/crm-pausa-1a1.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-pausa-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(arq).href)).default;
rmSync(dir, { recursive: true, force: true });

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const SEGREDO = 'segredo-de-teste-do-cal';
const env = { CAL_WEBHOOK_SECRET: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'ingryd@example.org',
  CRM_LINK_SECRET: 'x'.repeat(40), REVIEWS_KV: { get: async () => null, put: async () => {} } };
console.error = () => {};
const logs = [];
let chamadas, abrirResp, decidirResp, brevoOk;
function instalar() {
  globalThis.fetch = async (url, opt = {}) => {
    const u = new URL(String(url)), metodo = opt.method || 'GET', body = typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
    chamadas.push({ url: String(url), metodo, body });
    const r = (status, b) => new Response(status === 204 ? null : JSON.stringify(b ?? {}), { status });
    if (u.hostname === 'api.brevo.com') return brevoOk ? r(201, { messageId: '<x@y>' }) : r(400, {});
    if (u.pathname.endsWith('/rest/v1/contatos')) return metodo === 'GET' ? r(200, [{ id: 'c-ana' }]) : r(201, []);
    if (u.pathname.endsWith('/rest/v1/um_a_um')) {
      if (metodo === 'GET') return r(200, []);
      if (metodo === 'POST') return r(201, [{ id: 41 }]);
    }
    if (u.pathname.endsWith('/rpc/crm_sequencia_pausa_abrir')) return typeof abrirResp === 'function' ? abrirResp(body) : abrirResp;
    if (u.pathname.endsWith('/rpc/crm_sequencia_pausa_decidir')) return typeof decidirResp === 'function' ? decidirResp(body) : decidirResp;
    if (u.pathname.endsWith('/rest/v1/sequencia_pausas')) return r(200, [{ contatos: { nome: 'Ana <b>Souza</b>' } }]);
    return r(404, {});
  };
}
const zerar = () => { chamadas = []; brevoOk = true; abrirResp = new Response(JSON.stringify({ criada: true, pausa_id: 7, contato_id: 'c-ana', nome: 'Ana Souza', email: 'ana@example.com', quando: '2026-11-30T14:40:00.000Z' }), { status: 200 }); decidirResp = new Response(JSON.stringify({ ok: true, decisao: 'parar', ja_decidida: false }), { status: 200 }); };
const assina = (corpo) => createHmac('sha256', SEGREDO).update(corpo).digest('hex');
const cal = (e = env) => { const corpo = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { type: '1-1', title: '1:1 (20 min) between Ingryd and Ana', uid: 'uid-p1', startTime: '2026-11-30T14:40:00.000Z', endTime: '2026-11-30T15:00:00.000Z', attendees: [{ name: 'Ana Souza', email: 'ana@example.com' }] } });
  return worker.fetch(new Request('https://w.example/api/cal/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cal-Signature-256': assina(corpo) }, body: corpo }), e, { waitUntil() {} }); };
const emailsBrevo = () => chamadas.filter((c) => c.url.includes('api.brevo.com'));
const linksDe = (texto) => [...texto.matchAll(/https:\/\/w\.example\/api\/crm\/sequencia-decidir\?t=[\w.-]+/g)].map((m) => m[0]);

console.log('== Marcou o 1:1: a pergunta chega para a Ingryd ==');
zerar(); instalar();
let res = await cal();
check('o webhook responde 200 e grava o 1:1 como antes', res.status === 200 && (await res.json()).criado === true);
const abrir = chamadas.find((c) => /crm_sequencia_pausa_abrir/.test(c.url));
check('pede ao banco para abrir a pergunta, com o id do 1:1 criado', !!abrir && abrir.body.p_um_a_um_id === 41);
check('manda UM e-mail, para a Ingryd (não para a pessoa)', emailsBrevo().length === 1 && emailsBrevo()[0].body.to[0].email === 'ingryd@example.org');
const mail = emailsBrevo()[0].body;
check('o assunto diz quem marcou e pergunta se devem parar', /Ana Souza marcou um 1:1: os e-mails automáticos devem parar\?/.test(mail.subject));
check('o texto traz o dia em horário de Paris e avisa que nada sai enquanto ela não responder', /30\/11/.test(mail.textContent) && /15:40/.test(mail.textContent) && /nenhum e-mail automático sai/.test(mail.textContent));
const links = linksDe(mail.textContent);
check('dois links assinados, um para parar e outro para continuar', links.length === 2 && links[0] !== links[1]);
check('o e-mail não leva o e-mail da pessoa nem o link do guia', !/ana@example\.com/.test(mail.textContent) && !/\/guia\//.test(mail.textContent));

console.log('== Sem sequência, sem pergunta ==');
zerar(); abrirResp = new Response(JSON.stringify({ criada: false, motivo: 'fora_de_sequencia' }), { status: 200 }); instalar();
res = await cal();
check('pessoa fora de sequência: 200, 1:1 gravado e nenhum e-mail', res.status === 200 && emailsBrevo().length === 0);

console.log('== O que não derruba o aviso do Cal.com ==');
zerar(); abrirResp = new Response('{}', { status: 500 }); instalar();
res = await cal();
check('banco falhou ao abrir a pergunta: o 1:1 continua gravado e responde 200', res.status === 200 && emailsBrevo().length === 0);
zerar(); abrirResp = new Response('{}', { status: 404 }); instalar();
check('SQL ainda não rodado (404): responde 200, sem e-mail', (await cal()).status === 200 && emailsBrevo().length === 0);
zerar(); brevoOk = false; instalar();
check('Brevo recusou o aviso: responde 200 (a pergunta fica na ficha)', (await cal()).status === 200);
zerar(); instalar();
check('sem CRM_LINK_SECRET: 200 e nenhum e-mail com link fraco', (await cal({ ...env, CRM_LINK_SECRET: 'curto' })).status === 200 && emailsBrevo().length === 0);
zerar(); instalar();
check('CRM_AVISO_EMAIL manda para outro endereço', (await cal({ ...env, CRM_AVISO_EMAIL: 'outro@example.org' })).status === 200 && emailsBrevo()[0].body.to[0].email === 'outro@example.org');

console.log('== O link: página de confirmação, depois a decisão ==');
zerar(); instalar();
await cal();
const [lParar, lSeguir] = linksDe(emailsBrevo()[0].body.textContent);
const get = (l) => worker.fetch(new Request(l), env, {});
chamadas = [];
let pg = await get(lParar); let html = await pg.text();
check('abrir o link NÃO decide nada: mostra a página com o botão Confirmar', pg.status === 200 && /Confirmar/.test(html) && /Parar os e-mails automáticos/.test(html) && !chamadas.some((c) => /pausa_decidir/.test(c.url)));
check('o nome vem escapado na página (nada de HTML do banco)', /Ana &lt;b&gt;Souza&lt;\/b&gt;/.test(html) && !/<b>Souza/.test(html));
check('a página não carrega nada de fora e não é indexada', /noindex/.test(pg.headers.get('X-Robots-Tag')) && /default-src 'none'/.test(pg.headers.get('Content-Security-Policy')));
pg = await get(lSeguir); html = await pg.text();
check('o link de continuar mostra o texto de continuar', /Continuar os e-mails automáticos/.test(html));
const post = (t) => worker.fetch(new Request('https://w.example/api/crm/sequencia-decidir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) }), env, {});
const tokenDe = (l) => new URL(l).searchParams.get('t');
chamadas = [];
res = await post(tokenDe(lParar)); let j = await res.json();
const dec = chamadas.find((c) => /pausa_decidir/.test(c.url));
check('confirmar (POST) grava "parar" na pausa certa', res.status === 200 && j.ok && !!dec && dec.body.p_id === 7 && dec.body.p_decisao === 'parar' && /pararam/.test(j.mensagem));
decidirResp = new Response(JSON.stringify({ ok: true, decisao: 'continuar', ja_decidida: false }), { status: 200 });
j = await (await post(tokenDe(lSeguir))).json();
check('confirmar "continuar" grava "continuar"', j.ok && /continuam/.test(j.mensagem));
decidirResp = new Response(JSON.stringify({ ok: true, decisao: 'continuar', ja_decidida: true }), { status: 200 });
j = await (await post(tokenDe(lParar))).json();
check('se já tinha respondido o contrário, avisa e manda mudar pela ficha', /já tinha sido respondida/.test(j.mensagem));

console.log('== Segurança dos links ==');
const adulterado = tokenDe(lParar).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
chamadas = [];
res = await post(adulterado);
check('link adulterado: 400 e nada gravado', res.status === 400 && !chamadas.some((c) => /pausa_decidir/.test(c.url)));
chamadas = [];
check('link adulterado na página: 400', (await get('https://w.example/api/crm/sequencia-decidir?t=' + adulterado)).status === 400);
check('sem token ou lixo: 400', (await get('https://w.example/api/crm/sequencia-decidir')).status === 400 && (await post('lixo')).status === 400 && !chamadas.some((c) => /pausa_decidir/.test(c.url)));
// trocar a decisão dentro do token (parar -> continuar) invalida a assinatura
const [dadosB64, sigB64] = tokenDe(lParar).split('.');
const dados = Buffer.from(dadosB64, 'base64url').toString().replace('.parar.', '.continuar.');
check('trocar "parar" por "continuar" dentro do link invalida a assinatura', (await post(Buffer.from(dados).toString('base64url') + '.' + sigB64)).status === 400);
// link vencido
const sigVelha = async () => {
  const exp = Math.floor(Date.now() / 1000) - 10;
  const d = Buffer.from('pausa.7.parar.' + exp); const s = createHmac('sha256', env.CRM_LINK_SECRET).update(d).digest();
  return d.toString('base64url') + '.' + s.toString('base64url');
};
check('link vencido: a página e o POST recusam com 410 / 400', (await get('https://w.example/api/crm/sequencia-decidir?t=' + await sigVelha())).status === 410 && (await post(await sigVelha())).status === 400);
check('assinado com outro segredo: recusado', (await (async () => { const exp = Math.floor(Date.now() / 1000) + 600, d = Buffer.from('pausa.7.parar.' + exp); const s = createHmac('sha256', 'y'.repeat(40)).update(d).digest(); return (await post(d.toString('base64url') + '.' + s.toString('base64url'))).status; })()) === 400);
check('sem CRM_LINK_SECRET no Worker nada é aceito', (await worker.fetch(new Request('https://w.example/api/crm/sequencia-decidir', { method: 'POST', body: JSON.stringify({ t: tokenDe(lParar) }) }), { ...env, CRM_LINK_SECRET: undefined }, {})).status === 400);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
