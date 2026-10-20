// Testa o e-mail do guia gratuito Painel do Certificado (cert_guia_1) no Worker: a prova que a pessoa marcou escolhe o
// trecho "Para a sua prova", o texto de reserva (certGuia1) sai igual ao da tabela (admin/crm/db/crm-cert-guia-modelo.sql),
// e a rota /api/crm/guia-capturado envia o e-mail do painel sem mexer no do Campus France.
// Tudo com fetch falso: não chama Supabase nem Brevo. Exemplos fictícios (nada de dado real neste repositório público).
//
// Uso: node cms-oauth-worker/testes/cert-guia-email.test.mjs   (Node 18+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'cert-email-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') +
  '\nexport { certGuia1, certGuia1Vars, certProva, cfGuia1, crmMontarModelo, crmPreencher };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { certGuia1, certGuia1Vars, certProva, cfGuia1, crmMontarModelo } = mod;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const NOTION = 'https://exemplo.notion.site/Painel-teste';
const TOKENS = ['cert-delf', 'cert-dalf', 'cert-tcf-francais', 'cert-tcf-canada', 'cert-exame-civico', 'cert-toeic', 'cert-cae', 'cert-cpe', 'cert-outro', 'cert-indeciso'];
const GRUPO = { 'cert-delf': 'delf', 'cert-dalf': 'delf', 'cert-tcf-francais': 'tcf', 'cert-tcf-canada': 'tcf', 'cert-exame-civico': 'exame_civico',
  'cert-toeic': 'ingles', 'cert-cae': 'ingles', 'cert-cpe': 'ingles', 'cert-outro': 'outro', 'cert-indeciso': 'indeciso' };
// Uma frase só de cada bloco "Para a sua prova", para saber qual saiu.
const MARCA = { delf: 'checklist "DELF / DALF"', tcf: 'checklist "TCF (Français & Canada)"', exame_civico: 'checklist "Exame Cívico"',
  ingles: 'checklist "TOEIC / CAE / CPE"', outro: 'O painel funciona para qualquer prova', indeciso: 'abra "Saiba antes"' };

console.log('== A prova que ela marcou ==');
check('os 10 tokens do formulário caem no grupo certo', TOKENS.every((t) => certProva(t) === GRUPO[t]));
check('sem resposta, vazio ou token desconhecido: "ainda não sei"', [undefined, null, '', 'cf-nao-comecei', 'cert-xyz', 42].every((t) => certProva(t) === 'indeciso'));
let ok = true;
for (const t of [...TOKENS, undefined, 'cert-xyz']) {
  const mail = certGuia1({ email: 'ana@example.com', nome: 'Ana', respostas: { objetivo: t } }, NOTION);
  const grupo = GRUPO[t] || 'indeciso';
  for (const g of Object.keys(MARCA)) {
    const tem = mail.texto.includes(MARCA[g]);
    if (tem !== (g === grupo)) { ok = false; console.log('  ', t, g, tem); }
    if (mail.html.includes(MARCA[g].replace(/&/g, '&amp;').replace(/"/g, '&quot;')) !== (g === grupo)) { ok = false; console.log('  html', t, g); }
  }
  if ((mail.texto.match(/Para a sua prova:/g) || []).length !== 1) ok = false;
}
check('cada prova mostra só o próprio trecho, uma vez (texto e HTML)', ok);
const exame = certGuia1({ email: 'a@example.com', respostas: { objetivo: 'cert-exame-civico' } }, NOTION).texto;
check('Exame Cívico: obrigatório desde 1º/01/2026, três pedidos, confirmar valor e data', exame.includes('obrigatório desde 1º de janeiro de 2026') &&
  exame.includes('carte pluriannuelle, carte de résident e naturalização') && exame.includes('Confirme no centro onde vai fazer o valor e a data.'));
check('TCF: número do processo do IRCC para o TCF Canada',
  certGuia1({ email: 'a@example.com', respostas: { objetivo: 'cert-tcf-canada' } }, NOTION).texto.includes('o número do processo do IRCC é pedido na inscrição'));
check('"Outro": pede para responder dizendo qual é',
  certGuia1({ email: 'a@example.com', respostas: { objetivo: 'cert-outro' } }, NOTION).texto.includes('Responda este e-mail dizendo qual é'));

console.log('\n== O e-mail ==');
const e = certGuia1({ email: 'ana@example.com', nome: 'Ana Maria Souza', respostas: { objetivo: 'cert-delf' } }, NOTION);
check('assunto aprovado', e.assunto === 'Seu painel do certificado está aqui');
check('abre com o primeiro nome', e.texto.startsWith('Olá, Ana.\n'));
check('sem nome: "Olá."', certGuia1({ email: 'a@example.com', nome: '', respostas: {} }, NOTION).texto.startsWith('Olá.\n'));
check('link do Notion com UTM, no texto e no botão', e.texto.includes('Abrir o painel no Notion: ' + NOTION + '?utm_source=email&utm_medium=email&utm_campaign=guia-painel-do-certificado&utm_content=cert_guia_1') &&
  e.html.includes('<a href="' + NOTION + '?utm_source=email&amp;utm_medium=email&amp;utm_campaign=guia-painel-do-certificado&amp;utm_content=cert_guia_1"'));
check('link que já tem "?" recebe os parâmetros com "&"', certGuia1({ email: 'a@example.com', respostas: {} }, NOTION + '?pvs=4').texto.includes(NOTION + '?pvs=4&utm_source=email'));
check('passos do texto aprovado', ['clique em "Duplicate" (duplicar), no canto superior direito', 'abra o certificado "EXEMPLO · DELF B2 até fevereiro"',
  'Revisão Semanal, que leva 10 minutos', 'Se travar em alguma parte, responda este e-mail.', 'Ingryd, do Por Dentro'].every((t) => e.texto.includes(t)));
check('rodapé de serviço, sem "responda sair"', e.texto.includes('porque pediu o Painel do Certificado no Por Dentro com ana@example.com.') && !/sair/.test(e.texto));
check('voz da marca: sem palavras proibidas, sem preço nem urgência', !/incrível|exclusiv|jornada|segredo|€|R\$|últimas vagas|corra|urgente/i.test(e.texto));
check('nome escapado no HTML', certGuia1({ email: 'a@example.com', nome: '<script>x</script>', respostas: {} }, NOTION).html.includes('&lt;script&gt;') &&
  !certGuia1({ email: 'a@example.com', nome: '<script>x</script>', respostas: {} }, NOTION).html.includes('<script>'));

console.log('\n== Reserva = tabela (crm-cert-guia-modelo.sql) ==');
const SQL = readFileSync(path.resolve(HERE, '../../admin/crm/db/crm-cert-guia-modelo.sql'), 'utf8');
const tagSql = (campo) => { const r = new RegExp('\\$cert_guia_1_' + campo + '\\$([\\s\\S]*?)\\$cert_guia_1_' + campo + '\\$').exec(SQL); return r ? r[1] : null; };
const linha = (versao = 1) => ({ versao, assunto: tagSql('a'), preheader: tagSql('p'), corpo_texto: tagSql('t'), corpo_html: tagSql('h') });
check('o SQL tem assunto, prévia, texto e HTML', ['a', 'p', 't', 'h'].every((c) => tagSql(c)));
let difs = 0, casos = 0;
for (const nome of ['Ana Maria', '', '  Bia  ', '<b>&"\'']) for (const objetivo of [undefined, ...TOKENS, 'outra']) for (const url of [NOTION, NOTION + '?pvs=4']) {
  const c = { email: 'ana@example.com', nome, respostas: { objetivo } };
  const reserva = certGuia1(c, url), tabela = crmMontarModelo(linha(), certGuia1Vars(c, url));
  casos++; for (const f of ['assunto', 'pre', 'texto', 'html']) if (reserva[f] !== tabela[f]) { difs++; if (difs < 3) console.log('  ', f, nome, objetivo); }
}
check('e-mail da tabela = e-mail de reserva (' + casos + ' combinações de nome, prova e link)', difs === 0 && casos === 4 * 12 * 2);
check('exatamente uma prova é "sim" nas variáveis', TOKENS.concat([undefined]).every((t) => Object.entries(certGuia1Vars({ email: 'a@example.com', respostas: { objetivo: t } }, NOTION)).filter(([k, v]) => k.startsWith('prova_') && v === true).length === 1));

console.log('\n== Rota /api/crm/guia-capturado ==');
const SEGREDO = 'segredo-de-teste-com-mais-de-24-caracteres';
const CID = '11111111-2222-4333-8444-555555555555';
const env = { CRM_HOOK_SECRET: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org', CRM_REPLY_TO: 'respostas@example.org' };
let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    chamadas.push({ url: String(url), method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null, headers: opt.headers || {} });
    for (const [re, res] of regras) if (re.test(String(url)) && (!res.method || res.method === (opt.method || 'GET')))
      return new Response(JSON.stringify(res.body ?? {}), { status: res.status || 200 });
    return new Response('{}', { status: 200 });
  };
}
const req = (corpo) => new Request('https://w.example/api/crm/guia-capturado', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crm-Hook': SEGREDO }, body: JSON.stringify(corpo) });
const contato = (objetivo) => [/\/contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana', respostas: { objetivo } }] }];
const links = { 'painel-do-certificado': 'https://exemplo.notion.site/Painel-teste', 'etudes-en-france-2027-2028': 'https://exemplo.notion.site/Checklist-teste' };
const linkOk = [/\/guias_links\?/, { body: [{ notion_url: NOTION }] }];
const reservaOk = [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 7 }] }];
const brevoOk = [/api\.brevo\.com/, { body: { messageId: '<m1@smtp.example.net>' } }];
const painel = (extra = {}) => worker.fetch(req({ contato_id: CID, guia: 'painel-do-certificado', ...extra }), env, {});
const modeloRota = (l) => [/\/modelos_email_versoes\?/, { body: l ? [l] : [] }];

const errosAntes = console.error; console.error = () => {};
chamadas = []; fakeFetch([contato('cert-tcf-canada'), linkOk, reservaOk, brevoOk]);
let res = await painel();
let brevo = chamadas.find((c) => /brevo/.test(c.url)), reserva = chamadas.find((c) => /emails_enviados$/.test(c.url));
check('painel: 200 e envia pelo Brevo', res.status === 200 && !!brevo);
check('painel: lê o link do slug do painel em guias_links', /guias_links\?select=notion_url&slug=eq\.painel-do-certificado/.test(chamadas.find((c) => /guias_links/.test(c.url)).url));
check('painel: reserva com o modelo cert_guia_1 antes de enviar', reserva.body.modelo === 'cert_guia_1' && chamadas.indexOf(reserva) < chamadas.indexOf(brevo));
check('painel: assunto, destinatária e Reply-To', brevo.body.subject === 'Seu painel do certificado está aqui' && brevo.body.to[0].email === 'ana@example.com' && brevo.body.replyTo.email === 'respostas@example.org');
check('painel: serviço, sem List-Unsubscribe; tag cert_guia_1', !brevo.body.headers && brevo.body.tags.includes('cert_guia_1'));
check('painel: trecho do TCF e link do Notion no e-mail', brevo.body.textContent.includes('checklist "TCF (Français & Canada)"') && brevo.body.textContent.includes(NOTION + '?utm_source=email') && brevo.body.htmlContent.includes(NOTION));
check('painel: grava o messageId', chamadas.some((c) => c.method === 'PATCH' && /emails_enviados\?id=eq\.7/.test(c.url) && c.body.provedor_id === '<m1@smtp.example.net>'));
check('painel: o Campus France não é chamado nem mencionado', !/Campus|Études|cf_guia/.test(brevo.body.textContent));

chamadas = []; fakeFetch([contato('cert-delf'), linkOk, modeloRota(linha(4)), reservaOk, brevoOk]);
await painel(); brevo = chamadas.find((c) => /brevo/.test(c.url)); reserva = chamadas.find((c) => /emails_enviados$/.test(c.url));
check('painel: lê só a versão No ar de cert_guia_1, com a service_role', /modelos_email_versoes\?.*chave=eq\.cert_guia_1&etapa=eq\.no_ar/.test(chamadas.find((c) => /modelos_email_versoes/.test(c.url)).url) &&
  chamadas.find((c) => /modelos_email_versoes/.test(c.url)).headers.apikey === 'srv');
check('painel: usa o texto da tabela e grava a versão que saiu', reserva.body.modelo_versao === 4 && brevo.body.textContent.includes('checklist "DELF / DALF"'));

chamadas = []; fakeFetch([contato('cert-delf'), linkOk, modeloRota({ ...linha(5), corpo_texto: 'Oi {apelido}!' }), reservaOk, brevoOk]);
res = await painel(); brevo = chamadas.find((c) => /brevo/.test(c.url));
check('painel: tabela com variável que não existe → cai no texto de reserva', res.status === 200 && brevo.body.subject === 'Seu painel do certificado está aqui' && brevo.body.textContent.includes('Duplicate'));
chamadas = []; fakeFetch([contato('cert-delf'), linkOk, modeloRota({ ...linha(6), corpo_texto: 'Oi {nome}! [escrever aqui]' }), reservaOk, brevoOk]);
res = await painel(); brevo = chamadas.find((c) => /brevo/.test(c.url));
check('painel: [trecho entre colchetes] esquecido no modelo não sai (usa a reserva)', res.status === 200 && !/\[escrever aqui\]/.test(brevo.body.textContent));

chamadas = []; fakeFetch([contato('cert-delf'), linkOk, [/\/emails_enviados$/, { method: 'POST', status: 409, body: { code: '23505' } }]]);
res = await painel();
check('painel: já recebeu (409) → 200 sem chamar o Brevo', res.status === 200 && !chamadas.some((c) => /brevo/.test(c.url)));

chamadas = []; fakeFetch([contato('cert-delf'), [/\/guias_links\?/, { body: [] }], reservaOk, brevoOk]);
res = await painel();
check('painel sem linha em guias_links: 500 e nada enviado nem reservado', res.status === 500 && !chamadas.some((c) => /brevo/.test(c.url)) && !chamadas.some((c) => /emails_enviados$/.test(c.url)));
chamadas = []; fakeFetch([contato('cert-delf'), [/\/guias_links\?/, { body: [{ notion_url: 'http://sem-https' }] }], reservaOk, brevoOk]);
res = await painel();
check('link sem https: 500 e nada enviado', res.status === 500 && !chamadas.some((c) => /brevo/.test(c.url)));

chamadas = []; fakeFetch([contato('cert-delf'), linkOk, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 9 }] }], [/api\.brevo\.com/, { status: 400, body: { message: 'x' } }]]);
res = await painel();
check('Brevo recusou: 502 e desfaz a reserva', res.status === 502 && chamadas.some((c) => c.method === 'DELETE' && /emails_enviados\?id=eq\.9/.test(c.url)));

chamadas = []; fakeFetch([[/\/contatos\?/, { body: [] }], linkOk, reservaOk, brevoOk]);
res = await painel();
check('ficha não encontrada: 404', res.status === 404 && !chamadas.some((c) => /brevo/.test(c.url)));

chamadas = []; fakeFetch([contato('cf-nao-comecei'), linkOk, reservaOk, brevoOk]);
res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
reserva = chamadas.find((c) => /emails_enviados$/.test(c.url)); brevo = chamadas.find((c) => /brevo/.test(c.url));
check('Campus France continua igual: modelo cf_guia_1 e o mesmo e-mail de hoje', res.status === 200 && reserva.body.modelo === 'cf_guia_1' &&
  brevo.body.textContent === cfGuia1({ email: 'ana@example.com', nome: 'Ana', respostas: { objetivo: 'cf-nao-comecei' } }, NOTION).texto);
res = await worker.fetch(req({ contato_id: CID, guia: 'outro-guia' }), env, {});
check('guia que não manda e-mail: 400', res.status === 400);
res = await worker.fetch(new Request('https://w.example/api/crm/guia-capturado', { method: 'POST', headers: { 'X-Crm-Hook': 'errado-errado-errado-errado-errado-err' }, body: '{}' }), env, {});
check('segredo errado: 401', res.status === 401);

console.log('\n== O cert_guia_1 não sai pela ficha nem pela sequência ==');
const adminOk = [[/\/auth\/v1\/user$/, { body: { id: 'aaaaaaaa-2222-4333-8444-555555555555' } }], [/\/admins\?/, { body: [{ user_id: 'x' }] }]];
chamadas = []; fakeFetch([...adminOk, [/\/modelos_email\?/, { body: [{ chave: 'cert_guia_1', tipo: 'servico', automatico: true, criado_no_estudio: false }] }], contato('cert-delf'), brevoOk]);
res = await worker.fetch(new Request('https://w.example/api/crm/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tk' },
  body: JSON.stringify({ contato_id: CID, modelo: 'cert_guia_1', assunto: 'oi', corpo: 'Oi Ana!' }) }), env, {});
check('envio manual de cert_guia_1: 400, nada enviado', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
console.error = errosAntes;

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
