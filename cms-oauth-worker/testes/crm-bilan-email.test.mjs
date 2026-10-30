// Testa o e-mail "Bilan da nossa conversa": POST /api/crm/onboarding/bilan-email (prévia e envio). Tudo com fetch falso: não chama o Supabase
// nem o Brevo. Pessoas fictícias.
// Uso: node cms-oauth-worker/testes/crm-bilan-email.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-bilan-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmBilanMontar };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const ADMIN = 'aaaaaaaa-2222-4333-8444-555555555555';
const CID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'token-da-admin';
const env = { BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org', REVIEWS_KV: { get: async () => null, put: async () => {} } };
const XSS = '<img src=x onerror=alert(1)>';

let chamadas = [], logs = [];
const origErr = console.error; console.error = (...a) => { logs.push(a.join(' ')); };
function instalar(o = {}) {
  const { adminOk = true, contato = { id: CID, email: 'ana.exemplo@example.org', nome: 'Ana Maria Exemplo' }, recente = [], brevo = { status: 201, body: { messageId: '<abc@x>' } }, registro = { status: 201 } } = o;
  chamadas = []; logs = [];
  globalThis.fetch = async (url, opt = {}) => {
    let body = null;
    if (typeof opt.body === 'string') { try { body = JSON.parse(opt.body); } catch (e) { body = opt.body; } }
    const c = { url: String(url), method: opt.method || 'GET', body, headers: opt.headers || {} };
    chamadas.push(c);
    const r = (status, b) => new Response(status === 204 ? null : JSON.stringify(b ?? {}), { status });
    if (/\/auth\/v1\/user$/.test(c.url)) return r(200, adminOk ? { id: ADMIN } : { id: 'bbbbbbbb-2222-4333-8444-555555555555' });
    if (/\/admins\?/.test(c.url)) return r(200, adminOk ? [{ user_id: ADMIN }] : []);
    if (/crm_contatos\?/.test(c.url)) return r(200, contato ? [contato] : []);
    if (/emails_enviados\?.*modelo=eq\.bilan_conversa/.test(c.url) && c.method === 'GET') return r(200, recente);
    if (/emails_enviados$/.test(c.url) && c.method === 'POST') return r(registro.status, {});
    if (/api\.brevo\.com/.test(c.url)) return r(brevo.status, brevo.body);
    return r(404, {});
  };
}
const brevoCalls = () => chamadas.filter((c) => /api\.brevo\.com/.test(c.url));
const post = (b, e = env, token = TOKEN) => worker.fetch(new Request('https://w.example/api/crm/onboarding/bilan-email', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(b) }), e, {});
const SEC = { duvidas: ['Curso de 20 h por semana é o mínimo.', 'A atestação precisa de horas, duração e Qualiopi.'], proximos: ['Ligar para a escola de francês (prazo: no dia seguinte)', 'Conferir quais documentos precisam de tradução'],
  respostas: ['O pagamento do semestre pode vir depois da inscrição?', 'A prova financeira cobre toda a duração do curso?'] };
const base = { contato_id: CID, secoes: SEC, codigo: 'LISTA-ESPERA25' };

console.log('== Só admin ==');
instalar({ adminOk: false });
let res = await post({ ...base, enviar: true, confirmo: true });
check('quem não é admin: 401 e nada enviado', res.status === 401 && brevoCalls().length === 0);
instalar();
res = await worker.fetch(new Request('https://w.example/api/crm/onboarding/bilan-email', { method: 'POST', body: '{}' }), env, {});
check('sem token: 401', res.status === 401);

console.log('\n== Prévia (nunca envia) ==');
instalar();
res = await post(base); let j = await res.json();
check('prévia: 200, enviado=false e NENHUMA chamada ao Brevo nem gravação', res.status === 200 && j.ok && j.enviado === false && brevoCalls().length === 0 && !chamadas.some((c) => c.method === 'POST' && /emails_enviados/.test(c.url)));
check('assunto com o primeiro nome', j.assunto === 'Ana, o bilan da nossa conversa · Por Dentro');
const T = j.texto;
check('mesmo título e as 4 seções, sempre, nesta ordem', /BILAN DA NOSSA CONVERSA/.test(T) && ['1. Dúvidas que tiramos na conversa', '2. Seus próximos passos', '3. O que eu respondo ou confirmo para você', '4. Seu código para entrar na plataforma'].map((t) => T.indexOf(t)).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1])));
check('o conteúdo de cada pessoa entra em cada seção', /Curso de 20 h/.test(T) && /Ligar para a escola de francês \(prazo: no dia seguinte\)/.test(T) && /prova financeira cobre toda a duração/.test(T));
check('o código, os 6 meses e os 7 dias grátis aparecem, ligados à lista de espera', /código LISTA-ESPERA25 para confirmar a sua vaga na lista de espera/.test(T) && /desconto vale por 6 meses/.test(T) && /7 dias grátis/.test(T));
check('o HTML tem o título, as seções e o código em destaque', /<h1[^>]*>Bilan da nossa conversa<\/h1>/.test(j.html) && (j.html.match(/<h2/g) || []).length === 4 && />LISTA-ESPERA25</.test(j.html) && /<b>6 meses<\/b>/.test(j.html));
check('a prévia diz para quem iria', j.para === 'ana.exemplo@example.org');
instalar();
res = await post({ ...base, secoes: { duvidas: [XSS], proximos: [], respostas: [] } }); j = await res.json();
check('HTML digitado nas seções é escapado no e-mail', !j.html.includes('<img src=x') && j.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
check('seção vazia continua existindo, com uma frase fixa (o formato nunca muda)', (j.texto.match(/Nada por aqui desta vez\./g) || []).length === 2 && (j.html.match(/<h2/g) || []).length === 4);
instalar({ contato: { id: CID, email: 'sem.nome@example.org', nome: null } });
res = await post(base); j = await res.json();
check('sem nome: "Olá!" e assunto sem nome', /^Olá!/.test(j.texto) && j.assunto === 'O bilan da nossa conversa · Por Dentro');
instalar();
res = await post({ ...base, secoes: { duvidas: ['a\u0000b\u001bc'], proximos: ['  espaços   demais  '], respostas: ['x'.repeat(900)] } }); j = await res.json();
check('texto é limpo (controle, espaços) e cortado em 400 letras', !/[\u0000-\u0008\u001b]/.test(j.texto) && /- espaços demais/.test(j.texto) && !j.texto.includes('x'.repeat(401)));

console.log('\n== Validação ==');
instalar();
const ruim = async (rot, b, codigo) => { res = await post(b); j = await res.json(); check(rot + ' → 400 ' + codigo + ', nada enviado', res.status === 400 && j.codigo === codigo && brevoCalls().length === 0); };
await ruim('sem código', { ...base, codigo: '' }, 'codigo_invalido');
await ruim('código com espaço', { ...base, codigo: 'LISTA ESPERA' }, 'codigo_invalido');
await ruim('código com HTML', { ...base, codigo: '<b>x</b>' }, 'codigo_invalido');
await ruim('código curto demais', { ...base, codigo: 'ab' }, 'codigo_invalido');
await ruim('seção com mais de 12 itens', { ...base, secoes: { ...SEC, duvidas: Array.from({ length: 13 }, (_, i) => 'd' + i) } }, 'secao_invalida');
await ruim('seção que não é lista', { ...base, secoes: { ...SEC, proximos: 'texto solto' } }, 'secao_invalida');
await ruim('item que não é texto', { ...base, secoes: { ...SEC, respostas: [{ a: 1 }] } }, 'secao_invalida');
res = await post({ ...base, contato_id: 'x' }); check('contato inválido: 400', res.status === 400);
instalar({ contato: null }); res = await post(base); check('contato que não existe: 404', res.status === 404);

console.log('\n== Envio: só com o "pode enviar" ==');
instalar();
res = await post({ ...base, enviar: true }); j = await res.json();
check('sem a confirmação de que a pessoa aceitou: 400 e nada enviado', res.status === 400 && j.codigo === 'sem_confirmacao' && brevoCalls().length === 0);
res = await post({ ...base, enviar: true, confirmo: 'sim' });
check('confirmação precisa ser exatamente true', res.status === 400 && brevoCalls().length === 0);
instalar();
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('envio: 200, enviado=true, registrado=true', res.status === 200 && j.ok && j.enviado === true && j.registrado === true && j.para === 'ana.exemplo@example.org');
const b = brevoCalls();
check('um único envio, para a pessoa certa, com o texto e o HTML da prévia', b.length === 1 && b[0].body.to[0].email === 'ana.exemplo@example.org' && b[0].body.subject === 'Ana, o bilan da nossa conversa · Por Dentro' && /Curso de 20 h/.test(b[0].body.textContent) && /LISTA-ESPERA25/.test(b[0].body.htmlContent));
check('remetente, responder-para e cabeçalho de descadastro', b[0].body.sender.email === 'contato@example.org' && b[0].body.replyTo.email === 'respostas@example.org' && /List-Unsubscribe/.test(JSON.stringify(b[0].body.headers)) && b[0].body.tags.includes('bilan_conversa'));
const reg = chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST');
check('fica registrado na ficha (modelo bilan_conversa) com o token da admin', reg.body.contato_id === CID && reg.body.modelo === 'bilan_conversa' && reg.body.provedor_id === '<abc@x>' && reg.headers.Authorization === 'Bearer ' + TOKEN);
check('só o destinatário recebe: nenhum outro endereço no pedido', JSON.stringify(b[0].body.to) === JSON.stringify([{ email: 'ana.exemplo@example.org', name: 'Ana Maria Exemplo' }]));

console.log('\n== No máximo um a cada 3 dias ==');
instalar({ recente: [{ id: 9 }] });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('já enviado há menos de 3 dias: 409 e nada enviado', res.status === 409 && j.codigo === 'enviado_recentemente' && brevoCalls().length === 0);
check('a checagem olha só os últimos 3 dias do modelo bilan_conversa dessa pessoa', chamadas.some((c) => /contato_id=eq\.1111/.test(c.url) && /modelo=eq\.bilan_conversa/.test(c.url) && /enviado_em=gte\./.test(c.url)));
instalar({ recente: [{ id: 9 }] });
res = await post({ ...base, enviar: true, confirmo: true, forcar: true });
check('"enviar mesmo assim" (forcar) passa', res.status === 200 && brevoCalls().length === 1);

console.log('\n== Falhas ==');
instalar({ brevo: { status: 401, body: { message: 'Key not found' } } });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('Brevo recusa: 502 claro e nada registrado como enviado', res.status === 502 && /Brevo recusou/.test(j.error) && !chamadas.some((c) => /emails_enviados$/.test(c.url) && c.method === 'POST'));
check('o log do Brevo traz só o status, nunca o texto do e-mail', logs.length === 1 && !/Ana|Curso|LISTA/.test(logs[0]));
res = await post({ ...base, enviar: true, confirmo: true }, { ...env, BREVO_API_KEY: undefined });
check('sem Brevo configurado: 500 claro (e a prévia continua funcionando)', res.status === 500);
instalar(); res = await post(base, { ...env, BREVO_API_KEY: undefined });
check('prévia não exige o Brevo', res.status === 200);
instalar({ registro: { status: 500 } });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('enviou mas não conseguiu registrar: avisa (registrado=false), sem repetir o envio', res.status === 200 && j.enviado === true && j.registrado === false && brevoCalls().length === 1);

console.error = origErr;
console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
