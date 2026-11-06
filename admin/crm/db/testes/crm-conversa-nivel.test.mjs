// Testa POST /api/conversa/nivel do Worker (a pergunta de nível do e-mail do tecnólogo): confere o link assinado, grava
// contatos.respostas.tecNivel sem apagar o resto e recusa link inválido e nível desconhecido. Supabase simulado, pessoas fictícias.
// Uso: node crm-conversa-nivel.test.mjs
import { webcrypto as crypto } from 'node:crypto';
import worker from '../../../../cms-oauth-worker/worker.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
const ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const b64 = (u8) => Buffer.from(u8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function token(exp) {
  const dados = new TextEncoder().encode(ID + '.' + exp);
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(dados) + '.' + b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, dados)));
}
const env = { CRM_LINK_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'chave-de-teste' };

let contato, gravacoes;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/rest/v1/contatos') && (!init.method || init.method === 'GET')) return new Response(JSON.stringify(contato ? [contato] : []), { status: 200 });
  if (u.includes('/rest/v1/contatos') && init.method === 'PATCH') { gravacoes.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
  return new Response('{}', { status: 200 });
};
async function chamar(corpo) {
  const req = new Request('https://por-dentro-cms-oauth.example.workers.dev/api/conversa/nivel', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://imigrantepordentro.com' }, body: JSON.stringify(corpo) });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  return { status: res.status, corpo: await res.json().catch(() => ({})) };
}

const valido = await token(Math.floor(Date.now() / 1000) + 3600);
contato = { nome: 'Ana Souza', respostas: { destino: 'br', visto: 'pvt', naFranca: 'sim' } }; gravacoes = [];
let r = await chamar({ t: valido, r: 'nivel-l3' });
check('link válido + L3: 200 e rótulo L3', r.status === 200 && r.corpo.ok === true && r.corpo.rotulo === 'L3');
check('devolve o primeiro nome', r.corpo.nome === 'Ana');
check('grava tecNivel = l3 e mantém as outras respostas', gravacoes.length === 1 && gravacoes[0].respostas.tecNivel === 'l3' && gravacoes[0].respostas.destino === 'br' && gravacoes[0].respostas.visto === 'pvt');

gravacoes = [];
r = await chamar({ t: valido, r: 'nivel-licence-pro' });
check('Licence pro grava licence-pro', r.status === 200 && gravacoes[0].respostas.tecNivel === 'licence-pro' && r.corpo.rotulo === 'Licence pro');
r = await chamar({ t: valido, r: 'nivel-m1' });
check('M1 grava m1 (quem toca de novo fica com o último)', r.status === 200 && gravacoes[1].respostas.tecNivel === 'm1');

gravacoes = [];
r = await chamar({ t: valido, r: 'nivel-doutorado' });
check('nível desconhecido: 400, nada gravado', r.status === 400 && gravacoes.length === 0);
r = await chamar({ t: valido.slice(0, -3) + 'abc', r: 'nivel-l3' });
check('assinatura errada: recusa, nada gravado', r.status >= 400 && gravacoes.length === 0);
r = await chamar({ t: await token(Math.floor(Date.now() / 1000) - 10), r: 'nivel-l3' });
check('link vencido: 410, nada gravado', r.status === 410 && gravacoes.length === 0);
r = await chamar({ r: 'nivel-l3' });
check('sem link: recusa', r.status >= 400 && gravacoes.length === 0);
contato = null;
r = await chamar({ t: valido, r: 'nivel-l3' });
check('contato que não existe: 404, nada gravado', r.status === 404 && gravacoes.length === 0);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
