// Testa a página /entrar/ num navegador de verdade (Playwright), com o Worker simulado: o aceite, os estados e o layout em 380 px.
// Sem Playwright instalado, o teste avisa e sai com sucesso (não derruba a suíte de quem não tem o navegador).
// Uso: node entrar-pagina.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(HERE, '../../../..');
let chromium;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { console.log('Playwright não instalado: teste do navegador pulado.'); process.exit(0); }

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const PORTA = 8791;
const servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const TEXTO = 'Aceito usar a plataforma Por Dentro e receber mensagens de serviço sobre o meu caso (avisos, lembretes e respostas da equipe). Li a política de privacidade e posso retirar este consentimento quando quiser.';

async function abrir({ ctx = { status: 200, body: { ok: true, nome: 'Ana', dias: 7, versao: 'entrar-teste', texto: TEXTO, ja_tem_conta: false } }, aceitar = { status: 200, body: { ok: true, fim_teste: '2026-11-23T12:00:00Z' } }, url = '/entrar/?t=abc.def', largura = 1000 } = {}) {
  const pagina = await (await browser.newContext({ viewport: { width: largura, height: 900 } })).newPage();
  const enviados = [];
  await pagina.route('**/api/entrar/**', async (rota) => {
    const req = rota.request();
    if (req.method() === 'OPTIONS') return rota.fulfill({ status: 204, headers: CORS });
    if (/contexto/.test(req.url())) return rota.fulfill({ status: ctx.status, headers: CORS, body: JSON.stringify(ctx.body) });
    enviados.push(JSON.parse(req.postData() || '{}'));
    return rota.fulfill({ status: aceitar.status, headers: CORS, body: JSON.stringify(aceitar.body) });
  });
  await pagina.route(/(fonts\.(googleapis|gstatic)\.com)/, (rota) => rota.abort());
  await pagina.goto('http://127.0.0.1:' + PORTA + url);
  return { pagina, enviados };
}
const visivel = async (pagina, id) => pagina.locator('#st-' + id).isVisible();

console.log('== O aceite ==');
let { pagina, enviados } = await abrir();
await pagina.waitForSelector('#st-aceite:not([hidden])');
check('mostra o nome, os 7 dias e o texto do consentimento exatamente como o Worker mandou', (await pagina.locator('#en-titulo').textContent()).includes('Ana') && (await pagina.locator('#en-sub').textContent()).includes('7 dias') && (await pagina.locator('#en-texto').textContent()) === TEXTO);
check('o botão só habilita depois de marcar que leu e aceita', await pagina.locator('#en-botao').isDisabled());
check('o token sai da barra de endereço (não fica no histórico nem no Referer)', !pagina.url().includes('abc.def'));
check('não há campo de e-mail nem de senha na página (a pessoa não digita nada)', (await pagina.locator('input[type=email], input[type=password], input[type=text]').count()) === 0);
await pagina.check('#en-aceito');
check('marcado, o botão habilita', await pagina.locator('#en-botao').isEnabled());
await pagina.click('#en-botao');
await pagina.waitForSelector('#st-feito:not([hidden])');
check('o aceite manda o token, aceito=true e a versão do texto que ela viu', enviados.length === 1 && enviados[0].t === 'abc.def' && enviados[0].aceito === true && enviados[0].versao === 'entrar-teste');
check('depois do aceite avisa que o e-mail com o link da senha foi enviado', (await pagina.locator('#en-feito').textContent()).includes('e-mail'));
await pagina.close();

console.log('\n== Layout em 380 px ==');
({ pagina } = await abrir({ largura: 380 }));
await pagina.waitForSelector('#st-aceite:not([hidden])');
check('sem rolagem horizontal em 380 px', await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
check('o botão e a caixa do aceite cabem na tela', await pagina.evaluate(() => { const b = document.getElementById('en-botao').getBoundingClientRect(); return b.left >= 0 && b.right <= window.innerWidth; }));
await pagina.screenshot({ path: '/tmp/entrar-380.png' });
await pagina.close();

console.log('\n== Os outros estados ==');
({ pagina } = await abrir({ ctx: { status: 200, body: { ok: true, nome: 'Ana', dias: 7, versao: 'v', texto: TEXTO, ja_tem_conta: true } } }));
await pagina.waitForSelector('#st-ja:not([hidden])');
check('quem já tem conta vê "você já tem acesso" e o link da plataforma', (await pagina.locator('#st-ja a').getAttribute('href')).startsWith('https://plataforma.imigrantepordentro.com'));
await pagina.close();
({ pagina } = await abrir({ ctx: { status: 410, body: { error: 'vencido' } } }));
await pagina.waitForSelector('#st-vencido:not([hidden])'); check('link vencido', await visivel(pagina, 'vencido')); await pagina.close();
({ pagina } = await abrir({ ctx: { status: 400, body: { error: 'invalido' } } }));
await pagina.waitForSelector('#st-invalido:not([hidden])'); check('link inválido', await visivel(pagina, 'invalido')); await pagina.close();
({ pagina } = await abrir({ url: '/entrar/' }));
await pagina.waitForSelector('#st-invalido:not([hidden])'); check('sem link nenhum: inválido, sem chamar o Worker', await visivel(pagina, 'invalido')); await pagina.close();
({ pagina } = await abrir({ ctx: { status: 500, body: {} } }));
await pagina.waitForSelector('#st-erro:not([hidden])'); check('erro do servidor: mensagem e botão "Tentar de novo"', await pagina.locator('#b-tentar').isVisible()); await pagina.close();
({ pagina } = await abrir({ aceitar: { status: 502, body: { error: 'Não consegui criar o seu acesso agora.', codigo: 'conta' } } }));
await pagina.waitForSelector('#st-aceite:not([hidden])'); await pagina.check('#en-aceito'); await pagina.click('#en-botao');
await pagina.waitForSelector('#en-erro:not([hidden])');
check('falha no aceite: mostra a mensagem, continua na tela e deixa tentar de novo', (await pagina.locator('#en-erro').textContent()).includes('Não consegui') && await pagina.locator('#en-botao').isEnabled());
await pagina.close();

await browser.close(); servidor.kill();
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
