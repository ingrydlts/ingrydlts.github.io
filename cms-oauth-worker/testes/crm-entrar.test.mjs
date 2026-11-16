// Testa o convite de acesso no Worker: o botão da ficha (POST /api/crm/convite e /api/crm/espaco-atualizado, só admin) e a página
// pública /entrar/ (POST /api/entrar/contexto e /api/entrar/aceitar). Tudo com fetch falso: não chama Supabase, Brevo nem Stripe.
// O que o banco faz no aceite (consentimento, teste de 7 dias, publicar o revisado) é testado em admin/crm/db/testes/crm-entrar.test.mjs.
//
// Uso: node cms-oauth-worker/testes/crm-entrar.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-entrar-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmEntrarAssinar, crmEntrarConferir, crmLinkAssinar, CRM_ENTRAR_TEXTO, CRM_ENTRAR_VERSAO };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { crmEntrarAssinar, crmEntrarConferir, crmLinkAssinar, CRM_ENTRAR_TEXTO, CRM_ENTRAR_VERSAO } = mod;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const ADMIN = 'aaaaaaaa-2222-4333-8444-555555555555';
const CID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'token-da-admin';
const env = { CRM_LINK_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres', SUPABASE_SERVICE_ROLE_KEY: 'service-key', BREVO_API_KEY: 'brevo-key', BREVO_SENDER_EMAIL: 'oi@exemplo.org',
  REVIEWS_KV: { get: async () => null, put: async () => {} } };

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
const adminOk = [[/\/auth\/v1\/user$/, { body: { id: ADMIN } }], [/\/admins\?/, { body: [{ user_id: ADMIN }] }]];
const naoAdmin = [[/\/auth\/v1\/user$/, { body: { id: 'bbbbbbbb-2222-4333-8444-555555555555' } }], [/\/admins\?/, { body: [] }]];
const crmContato = [/\/rest\/v1\/crm_contatos\?select=/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Souza' }] }];
const publicavel = (o) => [/\/rpc\/crm_montagem_publicavel/, { body: { ha_rascunho_aprovado: true, itens_prontos: 3, itens_proposta: 0, itens_a_conferir: 0, conta_ja_existe: false, ...o } }];
const brevoOk = [/api\.brevo\.com\/v3\/smtp\/email/, { body: { messageId: '<m1>' } }];
const historicoOk = [/\/rest\/v1\/emails_enviados$/, { method: 'POST', status: 201, body: [] }];
const eventoOk = [/\/rpc\/crm_evento_admin/, { status: 204 }];
const doBrevo = () => chamadas.filter((c) => /api\.brevo\.com/.test(c.url));
const doHistorico = () => chamadas.filter((c) => /\/rest\/v1\/emails_enviados$/.test(c.url) && c.method === 'POST');
const doEvento = () => chamadas.filter((c) => /\/rpc\/crm_evento_admin/.test(c.url));
const post = (caminho, corpo, { token = TOKEN } = {}) => worker.fetch(new Request('https://w.example' + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(corpo) }), env);

console.log('== O link de /entrar/ ==');
const t = await crmEntrarAssinar(env, CID);
check('o link assinado volta com o id da ficha', (await crmEntrarConferir(env, t)).contato_id === CID);
check('link de outra finalidade (o da página de planos) NÃO abre o /entrar/', (await crmEntrarConferir(env, await crmLinkAssinar(env, CID))).erro === 'invalido');
check('link adulterado, vazio ou de outra ficha é inválido', (await crmEntrarConferir(env, t.slice(0, -2) + 'xx')).erro === 'invalido' && (await crmEntrarConferir(env, '')).erro === 'invalido' && (await crmEntrarConferir(env, 'a.b')).erro === 'invalido');
check('link vencido é "vencido" (a assinatura é conferida antes)', (await crmEntrarConferir({ ...env }, await crmEntrarAssinar(env, CID, Date.now() - 40 * 86400000))).erro === 'vencido');
check('sem o secret do Worker: erro de configuração', (await crmEntrarConferir({ ...env, CRM_LINK_SECRET: '' }, t)).erro === 'config');
check('o texto do consentimento é o único e tem uma versão', /Por Dentro/.test(CRM_ENTRAR_TEXTO) && CRM_ENTRAR_TEXTO.length > 40 && /^entrar-/.test(CRM_ENTRAR_VERSAO));

console.log('\n== Botão "Enviar convite de acesso" ==');
chamadas = []; fakeFetch(naoAdmin);
let r = await post('/api/crm/convite', { contato_id: CID });
check('quem não é admin: 401 e nada é enviado', r.status === 401 && doBrevo().length === 0);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({}), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/convite', { contato_id: CID });
let j = await r.json();
check('sem "enviar": só a prévia (assunto, texto com o link e quantos dias de teste), nada sai', r.status === 200 && j.enviado === false && /\/entrar\/\?t=/.test(j.texto) && /7 dias/.test(j.texto) && j.para === 'ana@example.com' && doBrevo().length === 0 && doEvento().length === 0);
r = await post('/api/crm/convite', { contato_id: CID, enviar: true });
j = await r.json();
check('enviar sem "pode enviar" (confirmo): 400 e nada sai', r.status === 400 && j.codigo === 'sem_confirmacao' && doBrevo().length === 0);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({}), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/convite', { contato_id: CID, enviar: true, confirmo: true });
j = await r.json();
const mail = doBrevo()[0];
check('com o "pode enviar": o e-mail sai uma vez, para o e-mail da ficha, com o link assinado', r.status === 200 && j.enviado === true && doBrevo().length === 1 && mail.body.to[0].email === 'ana@example.com' && /\/entrar\/\?t=/.test(mail.body.textContent));
check('o texto fala do teste de 7 dias e não promete pagamento nem cobrança', /7 dias/.test(mail.body.textContent) && !/pagamento confirmado|cobrança/i.test(mail.body.textContent));
check('o histórico guarda o e-mail SEM o link (é uma credencial) e o evento convite_enviado entra na linha do tempo', doHistorico().length === 1 && !/\/entrar\/\?t=/.test(JSON.stringify(doHistorico()[0].body)) && doHistorico()[0].body.modelo === 'convite_acesso' && doEvento().length === 1 && doEvento()[0].body.p_tipo === 'convite_enviado');
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({ ha_rascunho_aprovado: false, itens_prontos: 0 }), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/convite', { contato_id: CID, enviar: true, confirmo: true });
j = await r.json();
check('sem espaço pronto o convite é recusado, mesmo com "pode enviar" (não manda link para um espaço vazio)', r.status === 409 && j.codigo === 'sem_rascunho_aprovado' && doBrevo().length === 0);
r = await post('/api/crm/convite', { contato_id: CID, enviar: true, confirmo: true, forcar: true });
check('só "forcar" (decisão explícita) envia sem espaço pronto', r.status === 200 && doBrevo().length === 1);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({ conta_ja_existe: true }), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/convite', { contato_id: CID, enviar: true, confirmo: true });
j = await r.json();
check('quem já tem conta: 409 "conta_ja_existe" (o caminho é o aviso de espaço atualizado)', r.status === 409 && j.codigo === 'conta_ja_existe' && doBrevo().length === 0);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({}), brevoOk]);
const semBrevo = { ...env, BREVO_API_KEY: '' };
r = await worker.fetch(new Request('https://w.example/api/crm/convite', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ contato_id: CID, enviar: true, confirmo: true }) }), semBrevo);
check('Brevo não configurado: 500 com mensagem e nada sai', r.status === 500 && doBrevo().length === 0);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({}), brevoOk]);
r = await post('/api/crm/convite', { contato_id: 'x' });
check('contato inválido: 400', r.status === 400);

console.log('\n== Aviso de espaço atualizado (quem já tem conta) ==');
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({ conta_ja_existe: false }), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/espaco-atualizado', { contato_id: CID, enviar: true, confirmo: true });
j = await r.json();
check('sem conta ainda: 409 "sem_conta" (o caminho é o convite)', r.status === 409 && j.codigo === 'sem_conta' && doBrevo().length === 0);
chamadas = []; fakeFetch([...adminOk, crmContato, publicavel({ conta_ja_existe: true }), brevoOk, historicoOk, eventoOk]);
r = await post('/api/crm/espaco-atualizado', { contato_id: CID });
j = await r.json();
check('prévia: mostra o e-mail e não envia', r.status === 200 && j.enviado === false && /plataforma\.imigrantepordentro\.com/.test(j.texto) && doBrevo().length === 0);
r = await post('/api/crm/espaco-atualizado', { contato_id: CID, enviar: true });
check('sem o "pode enviar": 400', r.status === 400 && doBrevo().length === 0);
r = await post('/api/crm/espaco-atualizado', { contato_id: CID, enviar: true, confirmo: true });
check('com o "pode enviar": sai o aviso, fica no histórico e na linha do tempo', r.status === 200 && doBrevo().length === 1 && doHistorico()[0].body.modelo === 'espaco_atualizado' && doEvento()[0].body.p_tipo === 'espaco_atualizado_aviso');
check('o aviso não leva link de entrada de uso único nem senha', !/magiclink|token_hash|senha:/i.test(doBrevo()[0].body.textContent));

console.log('\n== Página pública /entrar/: contexto ==');
const contatoServico = (extra = {}) => [/\/rest\/v1\/contatos\?select=id,email,nome,user_id/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Souza', user_id: null, ...extra }] }];
chamadas = []; fakeFetch([contatoServico()]);
r = await post('/api/entrar/contexto', { t }, { token: '' });
j = await r.json();
check('com o link certo: devolve o primeiro nome, os dias, a versão e o texto do consentimento (que a página mostra igual)', r.status === 200 && j.nome === 'Ana' && j.dias === 7 && j.versao === CRM_ENTRAR_VERSAO && j.texto === CRM_ENTRAR_TEXTO && j.ja_tem_conta === false);
check('não devolve o e-mail nem o id da ficha', !('email' in j) && !('contato_id' in j));
r = await post('/api/entrar/contexto', { t: 'lixo' }, { token: '' });
check('link inválido: 400; vencido: 410', r.status === 400 && (await post('/api/entrar/contexto', { t: await crmEntrarAssinar(env, CID, Date.now() - 40 * 86400000) }, { token: '' })).status === 410);
chamadas = []; fakeFetch([contatoServico({ user_id: 'cccccccc-2222-4333-8444-555555555555' })]);
r = await post('/api/entrar/contexto', { t }, { token: '' });
check('quem já tem conta: ja_tem_conta verdadeiro (a página manda para o app)', (await r.json()).ja_tem_conta === true);
chamadas = []; fakeFetch([[/\/rest\/v1\/contatos\?select=id,email,nome,user_id/, { body: [] }]]);
check('ficha que não existe mais: 404', (await post('/api/entrar/contexto', { t }, { token: '' })).status === 404);

console.log('\n== Página pública /entrar/: aceitar ==');
const registrarOk = [/\/rpc\/crm_entrar_registrar/, { body: { ja_tinha_assinatura: false, status: 'trialing', fim_teste: '2026-11-23T12:00:00Z' } }];
const contaOk = [/\/auth\/v1\/admin\/users$/, { status: 200, body: { id: 'dddddddd-2222-4333-8444-555555555555' } }];
const linkOk = [/\/auth\/v1\/admin\/generate_link/, { body: { action_link: 'https://sb.example/auth/v1/verify?token=abc' } }];
const caminhoFeliz = (...extra) => [contatoServico(), registrarOk, contaOk, linkOk, brevoOk, historicoOk, ...extra];
chamadas = []; fakeFetch(caminhoFeliz());
r = await post('/api/entrar/aceitar', { t, aceito: true, versao: CRM_ENTRAR_VERSAO }, { token: '' });
j = await r.json();
const reg = chamadas.find((c) => /crm_entrar_registrar/.test(c.url));
check('aceite: registra o consentimento com o texto exato, 7 dias de teste, e responde ok', r.status === 200 && j.ok === true && reg && reg.body.p_dias === 7 && reg.body.p_versao === CRM_ENTRAR_VERSAO && reg.body.p_texto === CRM_ENTRAR_TEXTO && reg.body.p_contato === CID);
check('a conta nasce sem senha, com o e-mail que já estava na ficha (a pessoa não digita e-mail nenhum)', chamadas.some((c) => /admin\/users$/.test(c.url) && c.body.email === 'ana@example.com' && c.body.email_confirm === true && !('password' in c.body)));
const m2 = doBrevo()[0];
check('sai o e-mail com o link para criar a senha e o dia em que o teste termina, sem falar de pagamento', doBrevo().length === 1 && m2.body.to[0].email === 'ana@example.com' && /verify\?token=abc/.test(m2.body.textContent) && /23\/11\/2026/.test(m2.body.textContent) && !/pagamento confirmado|cobrança/i.test(m2.body.textContent));
check('o histórico não guarda o link de entrada', doHistorico().length === 1 && !/verify\?token/.test(JSON.stringify(doHistorico()[0].body)) && doHistorico()[0].body.modelo === 'acesso_liberado');
check('o consentimento é gravado ANTES de a conta ser criada', chamadas.findIndex((c) => /crm_entrar_registrar/.test(c.url)) < chamadas.findIndex((c) => /admin\/users$/.test(c.url)));
chamadas = []; fakeFetch(caminhoFeliz());
check('versão do texto diferente da vigente (página velha): 400 e nada é gravado', (await post('/api/entrar/aceitar', { t, aceito: true, versao: 'entrar-antiga' }, { token: '' })).status === 400 && !chamadas.some((c) => /crm_entrar_registrar|admin\/users/.test(c.url)));
check('sem marcar "aceito": 400 e nada é gravado', (await post('/api/entrar/aceitar', { t, aceito: false, versao: CRM_ENTRAR_VERSAO }, { token: '' })).status === 400 && !chamadas.some((c) => /crm_entrar_registrar|admin\/users/.test(c.url)));
check('link inválido: 400 e nada é gravado', (await post('/api/entrar/aceitar', { t: 'lixo', aceito: true, versao: CRM_ENTRAR_VERSAO }, { token: '' })).status === 400 && !chamadas.some((c) => /crm_entrar_registrar/.test(c.url)));
chamadas = []; fakeFetch([contatoServico({ user_id: 'cccccccc-2222-4333-8444-555555555555' }), registrarOk, contaOk, linkOk, brevoOk, historicoOk]);
r = await post('/api/entrar/aceitar', { t, aceito: true, versao: CRM_ENTRAR_VERSAO }, { token: '' });
j = await r.json();
check('quem já tem conta: ok com ja_tem_conta, sem novo teste, conta ou e-mail', r.status === 200 && j.ja_tem_conta === true && !chamadas.some((c) => /crm_entrar_registrar|admin\/users/.test(c.url)) && doBrevo().length === 0);
chamadas = []; fakeFetch([contatoServico(), [/\/rpc\/crm_entrar_registrar/, { status: 500, body: { message: 'erro' } }], contaOk, linkOk, brevoOk]);
r = await post('/api/entrar/aceitar', { t, aceito: true, versao: CRM_ENTRAR_VERSAO }, { token: '' });
check('se o banco falhar ao registrar, não cria conta nem manda e-mail', r.status === 502 && !chamadas.some((c) => /admin\/users/.test(c.url)) && doBrevo().length === 0);
chamadas = []; fakeFetch([contatoServico(), registrarOk, contaOk, linkOk, [/api\.brevo\.com/, { status: 500, body: {} }]]);
r = await post('/api/entrar/aceitar', { t, aceito: true, versao: CRM_ENTRAR_VERSAO }, { token: '' });
check('se o e-mail falhar: 502 com mensagem para tentar de novo (o aceite não se perde)', r.status === 502 && (await r.json()).codigo === 'email');
chamadas = []; fakeFetch(caminhoFeliz());
let limite = null;
const envMem = { ...env, REVIEWS_KV: undefined };
for (let i = 0; i < 8 && limite === null; i++) { const x = await worker.fetch(new Request('https://w.example/api/entrar/aceitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t, aceito: true, versao: CRM_ENTRAR_VERSAO }) }), envMem); if (x.status === 429) limite = i; }
check('repetir o aceite muitas vezes seguidas é limitado (429)', limite !== null && limite <= 6);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
