// Testa as mensagens agendadas no Worker: a rodada de hora em hora (crmAgendadasRodada), a rota POST /api/crm/agendadas-rodar, o handler
// scheduled() e o e-mail de aviso (POST /api/crm/chat-aviso, que agora é compartilhado). Tudo com fetch falso: não chama Supabase nem Brevo.
//
// O que o banco faz (validar data, cancelar, RLS) é testado em admin/crm/db/testes/crm-mensagens-agendadas.test.mjs. Aqui se confere o que o
// Worker lê, reivindica, cria no chat e avisa por e-mail.
//
// Uso: node cms-oauth-worker/testes/crm-agendadas.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-ag-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmAgendadasRodada };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { crmAgendadasRodada } = mod;
const log = console.error; console.error = () => {};   // os erros esperados não poluem a saída

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; log('  FALHOU:', label); } }

const ADMIN = 'aaaaaaaa-2222-4333-8444-555555555555';
const CID = '11111111-2222-4333-8444-555555555555';
const env = { SUPABASE_SERVICE_ROLE_KEY: 'srv-key', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org', CRM_HOOK_SECRET: 'segredo-do-hook-com-mais-de-24-letras' };
let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    let body = null;
    if (typeof opt.body === 'string') { try { body = JSON.parse(opt.body); } catch (e) { body = opt.body; } }
    const c = { url: String(url), method: opt.method || 'GET', body, headers: opt.headers || {} };
    chamadas.push(c);
    for (const [re, res0] of regras) {
      if (!re.test(c.url)) continue;
      const res = typeof res0 === 'function' ? res0(c) : res0;
      if (res.method && res.method !== c.method) continue;
      return new Response(res.status === 204 ? null : JSON.stringify(res.body ?? {}), { status: res.status || 200 });
    }
    return new Response('{}', { status: 200 });
  };
}
const FILA = [/\/rest\/v1\/mensagens_agendadas\?select=/, { method: 'GET', body: [{ id: 7, contato_id: CID, texto: 'Oi, Ana! Você já tem certificado de francês?', tentativas: 0 }] }];
const CLAIM_OK = [/\/mensagens_agendadas\?id=eq\.7&status=eq\.pendente/, { method: 'PATCH', body: [{ id: 7 }] }];
const CHAT_OK = [/\/rest\/v1\/chat_mensagens$/, { method: 'POST', status: 201, body: [{ id: 501 }] }];
const CONTATO = [/\/rest\/v1\/contatos\?select=id,email,nome/, { method: 'GET', body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Silva' }] }];
const BREVO_OK = [/api\.brevo\.com/, { body: { messageId: '<abc@brevo>' } }];
const EMAILS_OK = [/\/rest\/v1\/emails_enviados$/, { method: 'POST', status: 201, body: {} }];
const todas = () => [FILA, CLAIM_OK, CHAT_OK, CONTATO, BREVO_OK, EMAILS_OK];
const de = (re, metodo) => chamadas.filter((c) => re.test(c.url) && (!metodo || c.method === metodo));

console.log('== Rodada: caminho feliz ==');
chamadas = []; fakeFetch(todas());
const AGORA = Date.UTC(2026, 10, 3, 13, 5);
let r = await crmAgendadasRodada(env, AGORA);
check('conta: 1 devida, 1 enviada, 1 e-mail, nenhuma falha', r.devidas === 1 && r.enviadas === 1 && r.emails === 1 && r.falhas === 0 && r.puladas === 0);
const consulta = de(/mensagens_agendadas\?select=/)[0];
check('lê só as pendentes cuja hora já passou, das mais antigas, com limite', /status=eq\.pendente/.test(consulta.url) && /enviar_em=lte\.2026-11-03T13%3A05%3A00\.000Z/.test(consulta.url) && /order=enviar_em\.asc/.test(consulta.url) && /limit=20/.test(consulta.url));
check('usa a chave de serviço em todas as chamadas ao banco', chamadas.filter((c) => /supabase\.co/.test(c.url)).every((c) => c.headers.Authorization === 'Bearer srv-key' && c.headers.apikey === 'srv-key'));
const claim = de(/mensagens_agendadas\?id=eq\.7&status=eq\.pendente/, 'PATCH')[0];
check('reivindica ANTES de criar a mensagem (só se ainda estava pendente), marcando enviada', claim && claim.body.status === 'enviada' && chamadas.indexOf(claim) < chamadas.indexOf(de(/chat_mensagens$/, 'POST')[0]));
const chat = de(/\/rest\/v1\/chat_mensagens$/, 'POST')[0];
check('a mensagem entra no chat como da Ingryd, texto igual, tipo texto', chat.body.de === 'ingryd' && chat.body.tipo === 'texto' && chat.body.contato_id === CID && chat.body.texto === 'Oi, Ana! Você já tem certificado de francês?');
check('guarda o id da mensagem criada na linha agendada', de(/mensagens_agendadas\?id=eq\.7$/, 'PATCH').some((c) => c.body.mensagem_id === 501));
const brevo = de(/api\.brevo\.com/)[0];
check('o e-mail de aviso vai para a pessoa, com o nome no assunto e o link do app', brevo.body.to[0].email === 'ana@example.com' && brevo.body.subject === 'Ana, a Ingryd te respondeu no Por Dentro' && /plataforma\.imigrantepordentro\.com/.test(brevo.body.textContent) && /até 3 dias úteis/.test(brevo.body.textContent));
check('o e-mail mostra o começo da pergunta e fica registrado em emails_enviados', /Você já tem certificado de francês/.test(brevo.body.textContent) && de(/emails_enviados$/, 'POST')[0].body.modelo === 'chat_aviso');
check('uma única mensagem no chat (nada duplicado)', de(/chat_mensagens$/, 'POST').length === 1);

console.log('\n== Rodada: nada a fazer, SQL ausente, config ==');
chamadas = []; fakeFetch([[/mensagens_agendadas\?select=/, { method: 'GET', body: [] }]]);
r = await crmAgendadasRodada(env, AGORA);
check('fila vazia: zeros e nenhuma escrita', r.devidas === 0 && r.enviadas === 0 && chamadas.every((c) => c.method === 'GET'));
chamadas = []; fakeFetch([[/mensagens_agendadas\?select=/, { method: 'GET', status: 404, body: { code: 'PGRST205' } }]]);
r = await crmAgendadasRodada(env, AGORA);
check('SQL não rodado (404): erro claro, sem quebrar', r.erro === 'fila_404');
chamadas = []; fakeFetch([]);
r = await crmAgendadasRodada({ ...env, SUPABASE_SERVICE_ROLE_KEY: '' }, AGORA);
check('sem chave de serviço: erro de config e nenhuma chamada', r.erro === 'config' && chamadas.length === 0);

console.log('\n== Rodada: concorrência e falhas ==');
chamadas = []; fakeFetch([FILA, [/\/mensagens_agendadas\?id=eq\.7&status=eq\.pendente/, { method: 'PATCH', body: [] }], CHAT_OK, CONTATO, BREVO_OK]);
r = await crmAgendadasRodada(env, AGORA);
check('outra rodada (ou o cancelamento) já pegou: pula, sem criar mensagem nem e-mail', r.puladas === 1 && r.enviadas === 0 && de(/chat_mensagens$/, 'POST').length === 0 && de(/api\.brevo/).length === 0);
chamadas = []; fakeFetch([FILA, [/\/mensagens_agendadas\?id=eq\.7&status=eq\.pendente/, { method: 'PATCH', status: 409, body: {} }], CHAT_OK]);
r = await crmAgendadasRodada(env, AGORA);
check('erro na reivindicação também pula (não manda)', r.puladas === 1 && de(/chat_mensagens$/, 'POST').length === 0);
chamadas = []; fakeFetch([FILA, CLAIM_OK, [/\/rest\/v1\/chat_mensagens$/, { method: 'POST', status: 500, body: {} }], CONTATO, BREVO_OK]);
r = await crmAgendadasRodada(env, AGORA);
const volta = de(/mensagens_agendadas\?id=eq\.7$/, 'PATCH')[0];
check('falha ao criar no chat: volta a pendente com tentativa 1 e o motivo; sem e-mail', r.falhas === 1 && r.enviadas === 0 && volta.body.status === 'pendente' && volta.body.tentativas === 1 && /chat 500/.test(volta.body.erro) && volta.body.enviada_em === null && de(/api\.brevo/).length === 0);
chamadas = []; fakeFetch([[/mensagens_agendadas\?select=/, { method: 'GET', body: [{ id: 7, contato_id: CID, texto: 'x', tentativas: 2 }] }], CLAIM_OK, [/\/rest\/v1\/chat_mensagens$/, { method: 'POST', status: 500, body: {} }]]);
r = await crmAgendadasRodada(env, AGORA);
check('na 3ª falha seguida vira "erro" e para de tentar', de(/mensagens_agendadas\?id=eq\.7$/, 'PATCH')[0].body.status === 'erro' && de(/mensagens_agendadas\?id=eq\.7$/, 'PATCH')[0].body.tentativas === 3);
chamadas = []; fakeFetch([FILA, CLAIM_OK, CHAT_OK, CONTATO, [/api\.brevo\.com/, { status: 500, body: { message: 'x' } }], EMAILS_OK]);
r = await crmAgendadasRodada(env, AGORA);
check('o Brevo falhou: a mensagem JÁ está no chat e não volta para a fila (não repete)', r.enviadas === 1 && r.emails === 0 && r.falhas === 0 && !de(/mensagens_agendadas\?id=eq\.7$/, 'PATCH').some((c) => c.body.status === 'pendente'));
chamadas = []; fakeFetch([FILA, CLAIM_OK, CHAT_OK]);
r = await crmAgendadasRodada({ ...env, BREVO_API_KEY: '' }, AGORA);
check('sem Brevo configurado: a mensagem entra no chat e o aviso é pulado', r.enviadas === 1 && r.emails === 0 && de(/api\.brevo/).length === 0);
const varias = Array.from({ length: 3 }, (_, i) => ({ id: 10 + i, contato_id: CID, texto: 'msg ' + i, tentativas: 0 }));
chamadas = []; fakeFetch([[/mensagens_agendadas\?select=/, { method: 'GET', body: varias }], [/mensagens_agendadas\?id=eq\.\d+&status=eq\.pendente/, { method: 'PATCH', body: [{ id: 1 }] }], CHAT_OK, CONTATO, BREVO_OK, EMAILS_OK]);
r = await crmAgendadasRodada(env, AGORA);
check('várias na mesma rodada: cada uma sai uma vez, na ordem', r.enviadas === 3 && de(/chat_mensagens$/, 'POST').map((c) => c.body.texto).join() === 'msg 0,msg 1,msg 2');

console.log('\n== Rota e cron ==');
const post = (headers) => worker.fetch(new Request('https://w.example/api/crm/agendadas-rodar', { method: 'POST', headers }), env, {});
chamadas = []; fakeFetch(todas());
let res = await post({});
check('sem o segredo do hook: 401 e nada roda', res.status === 401 && chamadas.length === 0);
res = await post({ 'X-Crm-Hook': 'errado' });
check('segredo errado: 401', res.status === 401 && chamadas.length === 0);
res = await post({ 'X-Crm-Hook': 'segredo-do-hook-com-mais-de-24-letras' });
const j = await res.json();
check('segredo certo: roda e devolve o resumo', res.status === 200 && j.enviadas === 1);
res = await worker.fetch(new Request('https://w.example/api/crm/agendadas-rodar', { method: 'GET', headers: { 'X-Crm-Hook': 'segredo-do-hook-com-mais-de-24-letras' } }), env, {});
check('só aceita POST', res.status !== 200);
chamadas = []; fakeFetch(todas());
const esperas = [];
await worker.scheduled({ cron: '5 * * * *' }, env, { waitUntil: (p) => esperas.push(p) });
await Promise.all(esperas);
check('o cron de hora em hora também roda as agendadas (junto das sequências)', de(/mensagens_agendadas\?select=/).length === 1 && de(/chat_mensagens$/, 'POST').length === 1);
chamadas = []; fakeFetch(todas());
const esperas2 = [];
await worker.scheduled({ cron: '0 13 * * *' }, env, { waitUntil: (p) => esperas2.push(p) });
await Promise.all(esperas2.map((p) => p.catch(() => {})));
check('o cron diário das 10h (e-mail 2) NÃO mexe nas agendadas', de(/mensagens_agendadas\?select=/).length === 0);

console.log('\n== E-mail de aviso do chat (rota compartilhada) ==');
const adminOk = [[/\/auth\/v1\/user$/, { body: { id: ADMIN } }], [/\/admins\?/, { body: [{ user_id: ADMIN }] }]];
const aviso = (corpo, token = 't') => worker.fetch(new Request('https://w.example/api/crm/chat-aviso', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(corpo) }), env, {});
const regrasAviso = [...adminOk, [/\/rest\/v1\/crm_contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Silva' }] }], [/\/rest\/v1\/chat_mensagens\?select=/, { body: [{ id: 9, de: 'ingryd', tipo: 'texto', texto: 'Uma resposta minha.' }] }], BREVO_OK, EMAILS_OK];
chamadas = []; fakeFetch(regrasAviso);
res = await aviso({ contato_id: CID, mensagem_id: 9 });
let ja = await res.json();
check('o aviso sai, com o texto novo (Central de perguntas, 3 dias úteis)', res.status === 200 && ja.enviado === true && ja.registrado === true && /Central de perguntas/.test(de(/api\.brevo/)[0].body.textContent));
res = await aviso({ contato_id: CID, mensagem_id: 9 });
check('um segundo aviso logo em seguida TAMBÉM sai (sem limite de 30 minutos)', res.status === 200 && de(/api\.brevo/).length === 2);
res = await aviso({ contato_id: CID, mensagem_id: 9 }, '');
fakeFetch([...adminOk.map(([re]) => [re, { status: 401, body: {} }])]);
res = await aviso({ contato_id: CID, mensagem_id: 9 }, 'invalido');
check('sem permissão: 401', res.status === 401);
chamadas = []; fakeFetch([...adminOk, [/\/rest\/v1\/crm_contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana' }] }], [/\/rest\/v1\/chat_mensagens\?select=/, { body: [{ id: 9, de: 'pessoa', tipo: 'texto', texto: 'minha' }] }], BREVO_OK]);
res = await aviso({ contato_id: CID, mensagem_id: 9 });
check('mensagem que não é da Ingryd não gera aviso (404)', res.status === 404 && de(/api\.brevo/).length === 0);
chamadas = []; fakeFetch([...regrasAviso.slice(0, 4), [/api\.brevo\.com/, { status: 500, body: {} }]]);
res = await aviso({ contato_id: CID, mensagem_id: 9 });
check('Brevo recusou: 502 com mensagem', res.status === 502 && /Brevo recusou/.test((await res.json()).error));

console.error = log;
console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
