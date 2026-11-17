// Testa o e-mail "O que combinamos + convite para o Por Dentro das Démarches": POST /api/crm/conversa-email (prévia e envio).
// Tudo com fetch falso: não chama o Supabase nem o Brevo. Pessoas fictícias.
// Uso: node cms-oauth-worker/testes/crm-conversa-email.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-conversa-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const ADMIN = 'aaaaaaaa-2222-4333-8444-555555555555';
const CID = '11111111-2222-4333-8444-555555555555';
const env = { BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org', CRM_LINK_SECRET: 'x'.repeat(40), REVIEWS_KV: { get: async () => null, put: async () => {} } };

let chamadas = [];
const origErr = console.error; console.error = () => {};
function instalar(o = {}) {
  const { adminOk = true, pub = { conta_ja_existe: false, tem_assinatura: false, ha_rascunho_aprovado: true, itens_prontos: 3 }, recente = [] } = o;
  chamadas = [];
  globalThis.fetch = async (url, opt = {}) => {
    let body = null;
    if (typeof opt.body === 'string') { try { body = JSON.parse(opt.body); } catch (e) { body = opt.body; } }
    const c = { url: String(url), method: opt.method || 'GET', body };
    chamadas.push(c);
    const r = (status, b) => new Response(status === 204 ? null : JSON.stringify(b ?? {}), { status });
    if (/\/auth\/v1\/user$/.test(c.url)) return r(200, adminOk ? { id: ADMIN } : { id: 'bbbbbbbb-2222-4333-8444-555555555555' });
    if (/\/admins\?/.test(c.url)) return r(200, adminOk ? [{ user_id: ADMIN }] : []);
    if (/crm_contatos\?/.test(c.url)) return r(200, [{ id: CID, email: 'ana.exemplo@example.org', nome: 'Ana Maria Exemplo' }]);
    if (/rpc\/crm_montagem_publicavel/.test(c.url)) return r(200, pub);
    if (/rpc\/crm_evento_admin/.test(c.url)) return r(204);
    if (/emails_enviados\?.*modelo=eq\.conversa_convite/.test(c.url) && c.method === 'GET') return r(200, recente);
    if (/emails_enviados$/.test(c.url) && c.method === 'POST') return r(201, {});
    if (/api\.brevo\.com/.test(c.url)) return r(201, { messageId: '<abc@x>' });
    return r(404, {});
  };
}
const brevo = () => chamadas.filter((c) => /api\.brevo\.com/.test(c.url));
const post = (b, token = 'tok') => worker.fetch(new Request('https://w.example/api/crm/conversa-email', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(b) }), env, {});
const SEC = { conversamos: ['Licence de Psicologia (L1), alternativa BTS.'], ela: ['Validar o VLS-TS na OFII'], ingryd: ['Enviar o convite de acesso'] };
const base = { contato_id: CID, secoes: SEC };

console.log('== Só admin ==');
instalar({ adminOk: false });
let res = await post({ ...base, enviar: true, confirmo: true });
check('quem não é admin: 401 e nada enviado', res.status === 401 && brevo().length === 0);

console.log('\n== Prévia (nunca envia, nunca mostra o link) ==');
instalar();
res = await post(base); let j = await res.json();
check('prévia: 200, enviado=false, nada ao Brevo', res.status === 200 && j.enviado === false && brevo().length === 0);
check('as 4 seções, na ordem, com o convite para o Por Dentro das Démarches', ['1. O que conversamos', '2. O que você faz agora', '3. O que eu faço por você', '4. Seu espaço no Por Dentro das Démarches'].map((t) => j.texto.indexOf(t)).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1])));
check('o convite fala de espaço exclusivo, todas as démarches num só lugar e avançar', /espaço exclusivo/.test(j.texto) && /num só lugar/.test(j.texto) && /avançar/.test(j.texto));
check('na prévia não há link de acesso assinado', !/\/entrar\/\?t=/.test(j.texto) && !/\/entrar\/\?t=/.test(j.html) && j.acesso === 'convite');
check('o conteúdo da Ingryd entra no texto', /Validar o VLS-TS/.test(j.texto) && /Enviar o convite de acesso/.test(j.texto));
res = await post({ ...base, secoes: { ...SEC, ela: ['<img src=x onerror=alert(1)>'] } }); j = await res.json();
check('HTML do conteúdo é escapado', !/<img src=x/.test(j.html) && /&lt;img/.test(j.html));

console.log('\n== Envio ==');
instalar();
res = await post({ ...base, enviar: true }); j = await res.json();
check('sem o "pode enviar": 400 e nada enviado', res.status === 400 && j.codigo === 'sem_confirmacao' && brevo().length === 0);
instalar({ pub: { conta_ja_existe: false, tem_assinatura: false, ha_rascunho_aprovado: false, itens_prontos: 0 } });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('espaço vazio: 409 e nada enviado', res.status === 409 && j.codigo === 'sem_rascunho_aprovado' && brevo().length === 0);
instalar({ recente: [{ id: 1 }] });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('enviado há menos de 3 dias: 409', res.status === 409 && j.codigo === 'enviado_recentemente' && brevo().length === 0);
instalar();
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
const b = brevo()[0] && brevo()[0].body;
check('envio ok: 1 chamada ao Brevo com o link assinado de /entrar/', res.status === 200 && j.enviado === true && brevo().length === 1 && /https:\/\/imigrantepordentro\.com\/entrar\/\?t=/.test(b.textContent) && b.tags.includes('conversa_convite'));
const reg = chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST');
check('o histórico guarda o e-mail SEM o link', reg && reg.body.modelo === 'conversa_convite' && !/\?t=/.test(reg.body.corpo) && /\[link de acesso, uso único\]/.test(reg.body.corpo));
check('registra o evento convite_enviado', chamadas.some((c) => /crm_evento_admin/.test(c.url) && c.body.p_tipo === 'convite_enviado'));
instalar({ pub: { conta_ja_existe: true, tem_assinatura: true, ha_rascunho_aprovado: true, itens_prontos: 2 } });
res = await post({ ...base, enviar: true, confirmo: true }); j = await res.json();
check('quem já tem acesso recebe o link do app, não o convite', j.acesso === 'app' && /plataforma\.imigrantepordentro\.com/.test(brevo()[0].body.textContent) && !/\/entrar\/\?t=/.test(brevo()[0].body.textContent));

console.error = origErr;
console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
