// Testa o que as fases 0, 1a e 1b do CRM puseram no Worker: o leitor de e-mail (sem biblioteca), o handler
// email() e a rota /api/crm/guia-capturado (e-mail 1 do guia). Tudo com fetch falso: não chama
// Supabase nem Brevo. Exemplos fictícios (nada de dado real neste repositório público).
//
// Estúdio de e-mails, entrega 1: o texto dos modelos em admin/crm/db/crm-modelos-email.sql monta os mesmos
// e-mails de hoje (os 2 do Worker e os 8 do painel), e o Worker usa a tabela com o texto de hoje de reserva.
//
// Estúdio de e-mails, entrega 2: os blocos (admin/crm/estudio.js) montam o e-mail 1 e o 2 com o mesmo texto de hoje,
// a rota /api/crm/modelo-teste manda só para a admin e não grava envio, e o rodapé não se repete no envio manual.
//
// Estúdio de e-mails, entrega 3: o Cron "5 * * * *" manda as sequências (só os modelos novos, versão No ar, consentimento
// conferido de novo, link do produto vindo do Worker), o "0 13 * * *" continua sendo o e-mail 2, e a ficha envia um modelo novo.
//
// Uso: node cms-oauth-worker/testes/crm-email.test.mjs   (Node 18+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// O worker.js não exporta as funções internas (o painel da Cloudflare só quer o default):
// o teste copia o arquivo para uma pasta temporária e acrescenta os exports.
const dir = mkdtempSync(path.join(tmpdir(), 'crm-email-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') +
  '\nexport { crmLerEmail, crmTirarCitacao, crmDecodePalavras, cfGuia1, crmBytesParaBinario, cfGuiaConversa, crmLinkAssinar, crmLinkConferir, CF_CIDADES, crmMontarResposta, crmAssuntoBase, crmIdMsg, crmPreencher, crmMontarModelo, cfGuia1Vars, cfGuiaConversaVars, cfBotoesCidade };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { crmLerEmail, crmTirarCitacao, crmDecodePalavras, cfGuia1, crmBytesParaBinario, cfGuiaConversa, crmLinkAssinar, crmLinkConferir, CF_CIDADES, crmMontarResposta, crmAssuntoBase, crmIdMsg,
  crmPreencher, crmMontarModelo, cfGuia1Vars, cfGuiaConversaVars, cfBotoesCidade } = mod;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const bin = (s) => crmBytesParaBinario(new TextEncoder().encode(s));
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

console.log('== Leitor de e-mail ==');
// 1. Resposta do Gmail: multipart/alternative, quoted-printable, citação "Em ... escreveu:" em 2 linhas.
const gmail = [
  'From: =?UTF-8?Q?Jo=C3=A3o_Teste?= <Joao.Teste@example.com>',
  'To: respostas@example.org',
  'Subject: Re: =?UTF-8?B?' + b64('João, aqui está o seu checklist') + '?=',
  'Message-ID: <CAF+abc123@mail.example.com>',
  'In-Reply-To: <202610141200.111@smtp-relay.example.net>',
  'References: <202610141200.111@smtp-relay.example.net>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="000000000000abcd"',
  '',
  '--000000000000abcd',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Oi! Estou de olho em Lyon, curso de Engenharia de Produ=C3=A7=C3=A3o. Ser=C3=',
  '=A1 que d=C3=A1 tempo?',
  '',
  'Em qua., 14 de out. de 2026 =C3=A0s 20:10, Ingryd =C2=B7 Por Dentro <',
  'contato@example.org> escreveu:',
  '',
  '> Jo=C3=A3o, o seu checklist est=C3=A1 aqui',
  '> Uma pergunta...',
  '',
  '--000000000000abcd',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<div>Oi! HTML</div>',
  '--000000000000abcd--',
  '',
].join('\r\n');
let m = crmLerEmail(bin(gmail));
check('remetente em minúsculas', m.de_email === 'joao.teste@example.com');
check('nome do remetente decodificado', m.de_nome === 'João Teste');
check('assunto decodificado (B)', m.assunto === 'Re: João, aqui está o seu checklist');
check('texto: só a resposta, acentos certos', m.texto === 'Oi! Estou de olho em Lyon, curso de Engenharia de Produção. Será que dá tempo?');
check('Message-ID', m.message_id === '<CAF+abc123@mail.example.com>');
check('In-Reply-To', m.em_resposta_a === '<202610141200.111@smtp-relay.example.net>');
check('não é automática', m.automatica === false);

// 2. text/plain em base64, sem multipart.
m = crmLerEmail(bin(['From: ana@example.com', 'Subject: Re: oi', 'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: base64', '', b64('Paris ou Toulouse.\n\nOn Wed, Oct 14, 2026 at 8:10 PM Ingryd wrote:\n> texto antigo'), ''].join('\r\n')));
check('base64 + citação "On ... wrote:" em inglês', m.texto === 'Paris ou Toulouse.' && m.de_nome === null);

// 3. ISO-8859-1 com quoted-printable, multipart/mixed com anexo e alternative dentro.
const latin = [
  'From: "Bia" <bia@example.com>', 'Subject: =?ISO-8859-1?Q?R=E9ponse?=', 'Content-Type: multipart/mixed; boundary=XYZ', '',
  '--XYZ', 'Content-Type: multipart/alternative; boundary="ALT"', '',
  '--ALT', 'Content-Type: text/plain; charset=ISO-8859-1', 'Content-Transfer-Encoding: quoted-printable', '',
  'Ol=E1, vou para Montpellier. Le 14/10/2026 =E0 20:10, Ingryd a =E9crit :', '',
  'Le 14 oct. 2026 =E0 20:10, Ingryd a =E9crit :', '> antigo', '--ALT--', '',
  '--XYZ', 'Content-Type: application/pdf; name="doc.pdf"', 'Content-Disposition: attachment; filename="doc.pdf"',
  'Content-Transfer-Encoding: base64', '', 'JVBERi0xLjQK', '--XYZ--', ''].join('\r\n');
m = crmLerEmail(crmBytesParaBinario(Buffer.from(latin, 'latin1')));
check('ISO-8859-1 + multipart aninhado', m.texto === 'Olá, vou para Montpellier. Le 14/10/2026 à 20:10, Ingryd a écrit :');
check('assunto Q em ISO-8859-1', m.assunto === 'Réponse');
check('nome entre aspas', m.de_nome === 'Bia');

// 4. Só HTML (Outlook/Apple Mail às vezes): vira texto e perde a citação.
m = crmLerEmail(bin(['From: cris@example.com', 'Subject: Re', 'Content-Type: text/html; charset=utf-8', '',
  '<html><head><style>p{color:red}</style></head><body><p>Quero Bordeaux &amp; Nantes.</p><br>Obrigada!<div class="gmail_quote"><p>Em qua. escreveu:</p></div></body></html>'].join('\r\n')));
check('só HTML vira texto sem tags nem citação', m.texto === 'Quero Bordeaux & Nantes.\n\nObrigada!');

// 5. Respostas automáticas.
const auto = (extra, assunto) => crmLerEmail(bin(['From: x@example.com', 'Subject: ' + (assunto || 'Re: oi'), ...extra, 'Content-Type: text/plain', '', 'Estou fora.'].join('\r\n'))).automatica;
check('Auto-Submitted: auto-replied', auto(['Auto-Submitted: auto-replied']));
check('Auto-Submitted: no não conta', !auto(['Auto-Submitted: no']));
check('Precedence: bulk', auto(['Precedence: bulk']));
check('assunto "Resposta automática"', auto([], 'Resposta automática: estou de férias'));
check('assunto "Out of Office"', auto([], 'Out of Office: Re: oi'));
check('MAILER-DAEMON', crmLerEmail(bin('From: MAILER-DAEMON@example.com\r\nSubject: Undelivered\r\n\r\nx')).automatica);

// 6. Limites.
m = crmLerEmail(bin('From: a@example.com\r\nSubject: x\r\n\r\n' + 'a'.repeat(9000)));
check('texto truncado em 5000 + "…"', m.texto.length === 5001 && m.texto.endsWith('…'));
m = crmLerEmail(bin('From: a@example.com\r\nSubject: x\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: image/png\r\n\r\nxx\r\n--B--'));
check('sem parte de texto: aviso no lugar', m.texto === '(sem texto: veja a mensagem no seu e-mail)');
check('assinatura "-- " sai', crmTirarCitacao('Oi!\n-- \nFulana\nTel') === 'Oi!');
check('cabeçalho "De: / Enviado:" do Outlook corta', crmTirarCitacao('Sim.\n\nDe: Ingryd\nEnviado: quarta\nAssunto: x') === 'Sim.');
check('palavras codificadas seguidas se juntam', crmDecodePalavras('=?UTF-8?Q?Jo=C3=A3o?= =?UTF-8?Q?_Silva?=') === 'João Silva');

console.log('\n== E-mail 1 (cf_guia_1) ==');
const NOTION = 'https://topordentroviagens.notion.site/Checklist-teste';
let e1 = cfGuia1({ email: 'ana@example.com', nome: 'Ana Maria', respostas: { objetivo: 'cf-juntando-documentos', cfNivel: 'master' } }, NOTION);
check('assunto com o primeiro nome', e1.assunto === 'Ana, aqui está o seu checklist do Études en France');
check('prazo do nível dela', e1.texto.includes('O prazo do seu nível · Master: 17/01/2027') && !e1.texto.includes('14/12/2026'));
check('trecho da etapa', e1.texto.includes('Para quem está na etapa que está juntando documentos, traduções e o teste:'));
check('link com UTM', e1.texto.includes(NOTION + '?utm_source=email&utm_medium=email&utm_campaign=guia-etudes-en-france-2027&utm_content=cf_guia_1'));
check('versão de 15/10: sem a apresentação e sem a pergunta', !e1.texto.includes('eu sou a Ingryd') && !e1.texto.includes('qual curso, ou qual cidade'));
check('linha "Ficou com dúvida?" antes da assinatura', /Ficou com dúvida\? É só responder este e-mail\. Chega direto para mim\.\n\nIngryd · Por Dentro/.test(e1.texto));
check('linha da dúvida em destaque no HTML', /<b[^>]*>Ficou com dúvida\?<\/b> É só responder este e-mail\. Chega direto para mim\.<\/p>\s*<p[^>]*>Ingryd · Por Dentro/.test(e1.html));
check('um botão só (o do Notion)', (e1.html.match(/<a /g) || []).length === 1);
check('rodapé de serviço, sem descadastro', e1.texto.includes('porque pediu o checklist Études en France') && !/sair|descadastr/i.test(e1.texto));
check('nenhum [placeholder] no texto nem no HTML', !/\[[^\]\n]{2,60}\]/.test(e1.texto + e1.html));
e1 = cfGuia1({ email: 'b@example.com', nome: '', respostas: { objetivo: 'cf-dossie-enviado' } }, NOTION);
check('sem nível: os dois prazos', e1.texto.includes('14/12/2026 · 1º ano de Licence e Arquitetura') && e1.texto.includes('17/01/2027 · 2º e 3º ano'));
check('sem nome: assunto sem vírgula solta', e1.assunto === 'Aqui está o seu checklist do Études en France');
e1 = cfGuia1({ email: 'c@example.com', nome: '<script>x</script>', respostas: {} }, NOTION);
check('sem etapa conhecida: sem o bloco da etapa', !e1.texto.includes('Para quem está na etapa'));
check('nome escapado no HTML', !e1.html.includes('<script>') && e1.html.includes('&lt;script&gt;'));

console.log('\n== Rota /api/crm/guia-capturado (fetch falso) ==');
const SEGREDO = 'segredo-de-teste-com-mais-de-24-caracteres';
const CID = '11111111-2222-4333-8444-555555555555';
const env = { CRM_HOOK_SECRET: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: 'srv', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'contato@example.org',
  CRM_REPLY_TO: 'respostas@example.org', CRM_ENCAMINHAR_PARA: 'dona@example.org' };
let chamadas = [];
function fakeFetch(regras) {
  globalThis.fetch = async (url, opt = {}) => {
    chamadas.push({ url: String(url), method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null, headers: opt.headers || {} });
    for (const [re, res] of regras) if (re.test(String(url)) && (!res.method || res.method === (opt.method || 'GET')))
      return new Response(JSON.stringify(res.body ?? {}), { status: res.status || 200 });
    return new Response('{}', { status: 200 });
  };
}
const req = (corpo, segredo = SEGREDO) => new Request('https://w.example/api/crm/guia-capturado', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crm-Hook': segredo }, body: JSON.stringify(corpo) });
const contatoOk = [/\/contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana', respostas: { objetivo: 'cf-nao-comecei', cfNivel: 'l1' } }] }];
const linkOk = [/\/guias_links\?/, { body: [{ notion_url: NOTION }] }];

fakeFetch([contatoOk, linkOk]);
let res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }, 'errado-errado-errado-errado-errado-err'), env, {});
check('segredo errado: 401 e nada chamado', res.status === 401 && chamadas.length === 0);
res = await worker.fetch(req({ contato_id: CID, guia: 'outro-guia' }), env, {});
check('guia sem e-mail: 400', res.status === 400);

chamadas = [];
fakeFetch([contatoOk, linkOk, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 7 }] }],
  [/api\.brevo\.com/, { body: { messageId: '<m1@smtp.example.net>' } }]]);
res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
const brevo = chamadas.find((c) => /brevo/.test(c.url));
const reserva = chamadas.find((c) => /emails_enviados$/.test(c.url));
check('envia: 200', res.status === 200);
check('reserva antes de enviar', chamadas.indexOf(reserva) < chamadas.indexOf(brevo) && reserva.body.modelo === 'cf_guia_1');
check('Brevo: para ela, Reply-To = respostas', brevo.body.to[0].email === 'ana@example.com' && brevo.body.replyTo.email === 'respostas@example.org');
check('Brevo: sem List-Unsubscribe (serviço)', !brevo.body.headers);
check('Brevo: HTML com o prazo do nível', brevo.body.htmlContent.includes('14/12/2026') && brevo.body.htmlContent.includes('1º ano de Licence'));
check('grava o messageId do Brevo', chamadas.some((c) => c.method === 'PATCH' && /emails_enviados\?id=eq\.7/.test(c.url) && c.body.provedor_id === '<m1@smtp.example.net>'));

chamadas = [];
fakeFetch([contatoOk, linkOk, [/\/emails_enviados$/, { method: 'POST', status: 409, body: { code: '23505' } }]]);
res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
check('já recebeu (409): não chama o Brevo', res.status === 200 && !chamadas.some((c) => /brevo/.test(c.url)));

chamadas = [];
fakeFetch([contatoOk, linkOk, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 9 }] }], [/api\.brevo\.com/, { status: 400, body: { message: 'x' } }]]);
res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
check('Brevo recusou: 502 e desfaz a reserva', res.status === 502 &&
  chamadas.some((c) => c.method === 'DELETE' && /emails_enviados\?id=eq\.9/.test(c.url)) &&
  chamadas.some((c) => c.method === 'DELETE' && /eventos\?.*tipo=eq\.email_enviado/.test(c.url)));

console.log('\n== Handler email() ==');
function mensagem(raw, falharForward) {
  const enc = new TextEncoder().encode(raw);
  const msg = { from: 'bounce@example.com', to: 'respostas@example.org', encaminhou: null,
    raw: new ReadableStream({ start(c) { c.enqueue(enc); c.close(); } }),
    async forward(para) { if (falharForward) throw new Error('destino não verificado'); msg.encaminhou = para; } };
  return msg;
}
const errosAntes = console.error; console.error = () => {};
chamadas = []; fakeFetch([[/\/respostas_email$/, { method: 'POST', status: 201 }]]);
let msg = mensagem(gmail);
await worker.email(msg, env, {});
const grav = chamadas.find((c) => /respostas_email$/.test(c.url));
check('grava a resposta com a service_role', grav && grav.headers.apikey === 'srv' && grav.body.de_email === 'joao.teste@example.com');
check('grava o In-Reply-To para ligar ao e-mail', grav && grav.body.em_resposta_a === '<202610141200.111@smtp-relay.example.net>');
check('reencaminha para a dona', msg.encaminhou === 'dona@example.org');

chamadas = []; fakeFetch([[/\/respostas_email$/, { method: 'POST', status: 500 }]]);
msg = mensagem(gmail);
await worker.email(msg, env, {});
check('se o Supabase falhar, reencaminha assim mesmo', msg.encaminhou === 'dona@example.org');

chamadas = []; fakeFetch([]);
msg = mensagem('From: x@example.com\r\nAuto-Submitted: auto-replied\r\nSubject: Ausente\r\n\r\nFora.');
await worker.email(msg, env, {});
check('automática: não grava, mas reencaminha', !chamadas.length && msg.encaminhou === 'dona@example.org');

msg = mensagem('From: Respostas@Example.org\r\nSubject: loop\r\n\r\nx');
await worker.email(msg, env, {});
check('mensagem do próprio endereço: não grava', !chamadas.length);

msg = mensagem(gmail, true);
let estourou = false;
try { await worker.email(msg, env, {}); } catch (e) { estourou = true; }
check('forward com erro não derruba o handler', !estourou);
console.error = errosAntes;

console.log('\n== Fase 1a: link assinado ==');
const LINK = 'segredo-do-link-de-teste-com-mais-de-32-caracteres';
const envL = { ...env, CRM_LINK_SECRET: LINK };
const AGORA = Date.UTC(2026, 9, 16, 13, 0, 0);
let tk = await crmLinkAssinar(envL, CID, AGORA);
check('formato base64url.base64url', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tk));
const conteudo = Buffer.from(tk.split('.')[0], 'base64url').toString('utf8');
check('leva só o id e a validade (sem e-mail nem nome)', conteudo === CID + '.' + (AGORA / 1000 + 30 * 86400) && !/@|Ana/.test(conteudo));
check('confere: devolve o contato', (await crmLinkConferir(envL, tk, AGORA + 1000)).contato_id === CID);
check('dia 29: ainda vale', !(await crmLinkConferir(envL, tk, AGORA + 29 * 864e5)).erro);
check('dia 31: vencido', (await crmLinkConferir(envL, tk, AGORA + 31 * 864e5)).erro === 'vencido');
const outroId = '99999999-2222-4333-8444-555555555555';
const falso = Buffer.from(outroId + '.' + (AGORA / 1000 + 30 * 86400)).toString('base64url') + '.' + tk.split('.')[1];
check('trocar o contato invalida a assinatura', (await crmLinkConferir(envL, falso, AGORA)).erro === 'invalido');
check('segredo diferente: inválido', (await crmLinkConferir({ CRM_LINK_SECRET: LINK + 'x' }, tk, AGORA)).erro === 'invalido');
check('lixo: inválido', (await crmLinkConferir(envL, 'abc', AGORA)).erro === 'invalido' && (await crmLinkConferir(envL, '###.###', AGORA)).erro === 'invalido');
check('vencido com assinatura falsa conta como inválido', (await crmLinkConferir(envL, Buffer.from(CID + '.1000000000').toString('base64url') + '.AAAA', AGORA)).erro === 'invalido');
check('sem CRM_LINK_SECRET (ou curta): config', (await crmLinkConferir({ CRM_LINK_SECRET: 'curta' }, tk, AGORA)).erro === 'config');

console.log('\n== Fase 1a: e-mail 2 (cf_guia_conversa) ==');
let e2 = cfGuiaConversa({ id: CID, email: 'ana@example.com', nome: 'Ana Maria' }, tk);
check('assunto com o primeiro nome', e2.assunto === 'Ana, uma pergunta rápida');
check('pergunta com o nome', e2.texto.includes('Ana, para qual cidade você quer ir?') && e2.html.includes('Ana, para qual cidade você quer ir?'));
check('foto do site', e2.html.includes('src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg"'));
check('8 botões, na ordem aprovada', CF_CIDADES.map((c) => c[1]).join('|') === 'Paris|Lyon|Toulouse|Montpellier|Bordeaux|Lille|Outra cidade|Ainda não sei' &&
  (e2.html.match(/href="https:\/\/imigrantepordentro\.com\/conversa\/\?r=/g) || []).length === 8);
check('botão leva cidade e link assinado', e2.html.includes('href="https://imigrantepordentro.com/conversa/?r=lyon&amp;t=' + tk + '"') &&
  e2.texto.includes('Lyon: https://imigrantepordentro.com/conversa/?r=lyon&t=' + tk));
check('frase sobre a Ingryd', e2.texto.includes('Oi, eu sou a Ingryd. Moro na França e criei o Por Dentro para quem está fazendo esse caminho agora.'));
check('convite para responder por e-mail', e2.texto.includes('Prefere escrever? Responda este e-mail. Eu leio cada resposta.'));
check('rodapé de novidades com "responda sair"', /aceitou receber novidades do Por Dentro\. Para não receber mais, responda com a palavra sair\.$/.test(e2.texto));
check('nenhum [placeholder]', !/\[[^\]\n]{2,60}\]/.test(e2.texto + e2.html));
e2 = cfGuiaConversa({ id: CID, email: 'b@example.com', nome: '<b>' }, tk);
check('nome escapado', !e2.html.includes('<b>,') && e2.html.includes('&lt;b&gt;'));
e2 = cfGuiaConversa({ id: CID, email: 'b@example.com', nome: '' }, tk);
check('sem nome: "Uma pergunta rápida" e "Para qual cidade"', e2.assunto === 'Uma pergunta rápida' && e2.texto.includes('\nPara qual cidade você quer ir?'));

console.log('\n== Fase 1a: agendamento diário (scheduled) ==');
const CID2 = '22222222-2222-4333-8444-555555555555';
const pend = [/\/rpc\/crm_conversa_pendentes$/, { method: 'POST', body: [
  { contato_id: CID, email: 'ana@example.com', nome: 'Ana' }, { contato_id: CID2, email: 'bia@example.com', nome: 'Bia' }] }];
chamadas = [];
fakeFetch([pend, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 21 }] }], [/api\.brevo\.com/, { body: { messageId: '<m2@smtp.example.net>' } }]]);
let esperou = null;
await worker.scheduled({ cron: '0 13 * * *' }, envL, { waitUntil(p) { esperou = p; } });
let resumo = await esperou;
check('scheduled usa waitUntil e envia aos dois', resumo.enviados === 2 && resumo.falhas === 0);
const lista = chamadas.find((c) => /crm_conversa_pendentes/.test(c.url));
check('pede a lista com a service_role e o lote padrão 15', lista.headers.apikey === 'srv' && lista.body.p_limite === 15);
const reservas = chamadas.filter((c) => /emails_enviados$/.test(c.url) && c.method === 'POST');
check('reserva cf_guia_conversa por pessoa', reservas.length === 2 && reservas.every((c) => c.body.modelo === 'cf_guia_conversa') && reservas[0].body.contato_id === CID);
const envios = chamadas.filter((c) => /brevo/.test(c.url));
check('Brevo: List-Unsubscribe (novidades) e Reply-To = respostas', envios.length === 2 && /^<mailto:/.test(envios[0].body.headers['List-Unsubscribe']) && envios[0].body.replyTo.email === 'respostas@example.org');
check('Brevo: assunto e botões do e-mail 2', envios[1].body.subject === 'Bia, uma pergunta rápida' && envios[1].body.htmlContent.includes('/conversa/?r=paris&amp;t='));
const tkEnviado = /t=([A-Za-z0-9_.-]+)/.exec(envios[0].body.textContent)[1];
check('o link do e-mail confere para a pessoa certa', (await crmLinkConferir(envL, tkEnviado)).contato_id === CID);
check('grava o provedor_id', chamadas.filter((c) => c.method === 'PATCH' && c.body.provedor_id === '<m2@smtp.example.net>').length === 2);

chamadas = [];
fakeFetch([pend, [/\/emails_enviados$/, { method: 'POST', status: 409 }]]);
resumo = await (async () => { let p; await worker.scheduled({}, { ...envL, CRM_CONVERSA_LOTE: '3' }, { waitUntil(x) { p = x; } }); return p; })();
check('índice barrou (409): não envia, conta como já enviado', resumo.ja_enviados === 2 && !chamadas.some((c) => /brevo/.test(c.url)));
check('CRM_CONVERSA_LOTE muda o lote', chamadas.find((c) => /crm_conversa_pendentes/.test(c.url)).body.p_limite === 3);

chamadas = [];
fakeFetch([pend, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 30 }] }], [/api\.brevo\.com/, { status: 400, body: { message: 'x' } }]]);
console.error = () => {};
resumo = await (async () => { let p; await worker.scheduled({}, envL, { waitUntil(x) { p = x; } }); return p; })();
check('Brevo recusou: desfaz a reserva (tenta de novo amanhã)', resumo.falhas === 2 &&
  chamadas.filter((c) => c.method === 'DELETE' && /emails_enviados\?id=eq\.30/.test(c.url)).length === 2);
chamadas = []; fakeFetch([pend]);
resumo = await (async () => { let p; await worker.scheduled({}, env, { waitUntil(x) { p = x; } }); return p; })();
check('sem CRM_LINK_SECRET: não chama nada', resumo.erro === 'config' && chamadas.length === 0);
console.error = errosAntes;

chamadas = []; fakeFetch([[/\/rpc\/crm_conversa_pendentes$/, { method: 'POST', body: [] }]]);
const rodar = (seg) => worker.fetch(new Request('https://w.example/api/crm/conversa-rodar', { method: 'POST', headers: { 'X-Crm-Hook': seg } }), envL, {});
res = await rodar('errado-errado-errado-errado-errado-err');
check('rodar na hora: segredo errado 401', res.status === 401 && chamadas.length === 0);
res = await rodar(SEGREDO);
check('rodar na hora: devolve o resumo', res.status === 200 && (await res.json()).pendentes === 0);

console.log('\n== Fase 1a: rotas da página /conversa/ ==');
const post = (rota, corpo) => worker.fetch(new Request('https://w.example/api/conversa/' + rota, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }), envL, {});
tk = await crmLinkAssinar(envL, CID);
chamadas = [];
fakeFetch([[/\/rpc\/crm_conversa_toque$/, { method: 'POST', body: { ok: true, nome: 'Ana Maria', cidade: 'Lyon' } }], linkOk]);
res = await post('toque', { t: tk, r: 'lyon' });
let corpo = await res.json();
check('toque: 200 com primeiro nome e cidade', res.status === 200 && corpo.nome === 'Ana' && corpo.cidade === 'Lyon');
check('toque: link do checklist com UTM do e-mail 2', corpo.checklist === NOTION + '?utm_source=email&utm_medium=email&utm_campaign=guia-etudes-en-france-2027&utm_content=cf_guia_conversa');
const rpcT = chamadas.find((c) => /crm_conversa_toque/.test(c.url));
check('toque: grava pela service_role com o contato do link', rpcT.headers.apikey === 'srv' && rpcT.body.p_contato === CID && rpcT.body.p_cidade === 'lyon');
check('toque: CORS liberado', res.headers.get('Access-Control-Allow-Origin') === '*');
chamadas = [];
res = await post('toque', { t: tk, r: 'marte' });
check('toque: cidade fora da lista 400, nada gravado', res.status === 400 && chamadas.length === 0);
res = await post('toque', { t: 'x.y', r: 'lyon' });
check('toque: link inválido 400', res.status === 400 && (await res.json()).error === 'invalido' && chamadas.length === 0);
const vencido = await crmLinkAssinar(envL, CID, Date.now() - 31 * 864e5);
res = await post('toque', { t: vencido, r: 'lyon' });
check('toque: link vencido 410', res.status === 410 && (await res.json()).error === 'vencido' && chamadas.length === 0);
fakeFetch([[/\/rpc\/crm_conversa_toque$/, { method: 'POST', body: { erro: 'contato' } }], linkOk]);
res = await post('toque', { t: tk, r: 'lyon' });
check('toque: ficha apagada 404', res.status === 404);
res = await worker.fetch(new Request('https://w.example/api/conversa/toque?r=lyon&t=' + tk), envL, {});
check('toque: GET não grava (404)', res.status === 404);

chamadas = [];
fakeFetch([[/\/rpc\/crm_conversa_texto$/, { method: 'POST', body: { ok: true } }]]);
res = await post('texto', { t: tk, texto: '  Master em Ciência Política na Lyon 2  ' });
const rpcX = chamadas.find((c) => /crm_conversa_texto/.test(c.url));
check('texto: 200 e grava sem espaços nas pontas', res.status === 200 && rpcX.body.p_texto === 'Master em Ciência Política na Lyon 2' && rpcX.body.p_contato === CID);
chamadas = [];
res = await post('texto', { t: tk, texto: 'x'.repeat(2001) });
check('texto: grande demais 400, nada gravado', res.status === 400 && chamadas.length === 0);
res = await post('texto', { t: vencido, texto: 'oi oi' });
check('texto: link vencido 410', res.status === 410);
fakeFetch([[/\/rpc\/crm_conversa_texto$/, { method: 'POST', body: { erro: 'limite' } }]]);
res = await post('texto', { t: tk, texto: 'oi oi' });
check('texto: limite do banco vira 429', res.status === 429);

console.log('\n== Fase 1b: montar a resposta no fio ==');
check('assunto base tira Re:/RES:/Fwd: empilhados', crmAssuntoBase('Re: RES: Fwd:  Ana, aqui está') === 'Ana, aqui está');
check('Message-ID ganha <>', crmIdMsg('abc@x.net') === '<abc@x.net>' && crmIdMsg('<abc@x.net>') === '<abc@x.net>');
check('Message-ID estranho vira null', crmIdMsg('a b@x') === null && crmIdMsg('') === null && crmIdMsg(null) === null);
check('sem nenhuma mensagem de e-mail: null', crmMontarResposta([], [{ message_id: null, assunto: null, recebido_em: '2026-10-16T10:41:00Z' }]) === null);
const E1 = { provedor_id: '<e1@smtp.example.net>', assunto: 'Ana, aqui está o seu checklist', enviado_em: '2026-10-15T09:02:00Z' };
const E2 = { provedor_id: '<e2@smtp.example.net>', assunto: 'Ana, uma pergunta rápida', enviado_em: '2026-10-16T10:00:00Z' };
const R1 = { message_id: '<r1@mail.example.com>', assunto: 'Re: Ana, aqui está o seu checklist', recebido_em: '2026-10-15T20:00:00Z' };
let fio = crmMontarResposta([E1], [R1]);
check('responde à resposta dela (a mais nova)', fio.inReplyTo === '<r1@mail.example.com>' && fio.assunto === 'Re: Ana, aqui está o seu checklist');
check('References: do primeiro ao último do fio', fio.references === '<e1@smtp.example.net> <r1@mail.example.com>');
fio = crmMontarResposta([E2, E1], [R1]);
check('e-mail 2 mais novo: o fio passa a ser o dele', fio.inReplyTo === '<e2@smtp.example.net>' && fio.assunto === 'Re: Ana, uma pergunta rápida' && fio.references === '<e2@smtp.example.net>');
const NOSSA = { provedor_id: '<n1@smtp.example.net>', assunto: 'Re: Ana, aqui está o seu checklist', enviado_em: '2026-10-17T11:20:00Z' };
fio = crmMontarResposta([NOSSA, E2, E1], [R1]);
check('depois da nossa resposta: não empilha "Re: Re:"', fio.assunto === 'Re: Ana, aqui está o seu checklist' && fio.inReplyTo === '<n1@smtp.example.net>');
check('References sem o e-mail 2 (outro assunto)', fio.references === '<e1@smtp.example.net> <r1@mail.example.com> <n1@smtp.example.net>');
const muitas = Array.from({ length: 14 }, (_, i) => ({ provedor_id: '<m' + i + '@x.net>', assunto: 'Re: Oi', enviado_em: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }));
fio = crmMontarResposta(muitas, []);
check('References fica nas 10 últimas', fio.references.split(' ').length === 10 && fio.references.endsWith('<m13@x.net>'));
check('sem assunto: "Re: Por Dentro"', crmMontarResposta([{ provedor_id: '<z@x.net>', assunto: null, criado_em: '2026-10-01T00:00:00Z' }], []).assunto === 'Re: Por Dentro');

console.log('\n== Fase 1b: rota /api/crm/responder (fetch falso) ==');
const TOKEN = 'token-da-admin';
const responder = (corpo, token = TOKEN) => worker.fetch(new Request('https://w.example/api/crm/responder', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(corpo) }), env, {});
const adminOk = [[/\/auth\/v1\/user$/, { body: { id: 'aaaaaaaa-2222-4333-8444-555555555555' } }], [/\/admins\?/, { body: [{ user_id: 'x' }] }]];
const fichaOk = [/\/crm_contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana Maria' }] }];
const enviadosOk = [/\/emails_enviados\?select=/, { body: [E1] }];
const recebidasOk = [/\/respostas_email\?select=/, { body: [R1] }];
const gravaOk = [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 50, modelo: 'resposta' }] }];
const marcaOk = [/\/respostas_email\?contato_id=/, { method: 'PATCH', status: 200 }];

chamadas = []; fakeFetch([]);
res = await responder({ contato_id: CID, texto: 'oi' }, null);
check('sem login: 401 e nada enviado', res.status === 401 && !chamadas.some((c) => /brevo/.test(c.url)));
chamadas = []; fakeFetch([[/\/auth\/v1\/user$/, { body: { id: 'u' } }], [/\/admins\?/, { body: [] }]]);
res = await responder({ contato_id: CID, texto: 'oi' });
check('logada que não é admin: 401', res.status === 401 && !chamadas.some((c) => /brevo/.test(c.url)));
fakeFetch([...adminOk]);
check('contato inválido: 400', (await responder({ contato_id: 'x', texto: 'oi' })).status === 400);
check('texto vazio: 400', (await responder({ contato_id: CID, texto: '   ' })).status === 400);
check('texto grande demais: 400', (await responder({ contato_id: CID, texto: 'x'.repeat(10001) })).status === 400);

chamadas = [];
fakeFetch([...adminOk, fichaOk, enviadosOk, recebidasOk, gravaOk, marcaOk, [/api\.brevo\.com/, { status: 201, body: { messageId: '<n9@smtp.example.net>' } }]]);
res = await responder({ contato_id: CID, texto: 'Ana, que bom saber!\nMe manda o link do Master.' });
corpo = await res.json();
let bv = chamadas.find((c) => /brevo/.test(c.url));
check('envia: 200, no fio', res.status === 200 && corpo.ok && corpo.no_fio === true && !corpo.aviso);
check('Brevo: assunto "Re: <assunto do fio>"', bv.body.subject === 'Re: Ana, aqui está o seu checklist' && corpo.assunto === bv.body.subject);
check('Brevo: In-Reply-To e References', bv.body.headers['In-Reply-To'] === '<r1@mail.example.com>' && bv.body.headers.References === '<e1@smtp.example.net> <r1@mail.example.com>');
check('Brevo: sem List-Unsubscribe e sem rodapé "sair"', !('List-Unsubscribe' in bv.body.headers) && !/sair/.test(bv.body.textContent));
check('Brevo: Reply-To = respostas, para ela, texto e HTML', bv.body.replyTo.email === 'respostas@example.org' && bv.body.to[0].email === 'ana@example.com' &&
  bv.body.textContent === 'Ana, que bom saber!\nMe manda o link do Master.' && bv.body.htmlContent.includes('Ana, que bom saber!<br>Me manda'));
check('Brevo: tag resposta', bv.body.tags.includes('resposta'));
const lidas = chamadas.filter((c) => /\/(crm_contatos|emails_enviados|respostas_email)\?select=/.test(c.url));
check('lê ficha e fio com o token da admin (não a service_role)', lidas.length === 3 && lidas.every((c) => c.headers.Authorization === 'Bearer ' + TOKEN));
check('lê só mensagens com Message-ID', lidas.some((c) => /emails_enviados\?.*provedor_id=not\.is\.null/.test(c.url)) && lidas.some((c) => /respostas_email\?.*message_id=not\.is\.null/.test(c.url)));
const gr = chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST');
check('grava em emails_enviados: modelo resposta, provedor_id do Brevo, assunto e corpo', gr.body.modelo === 'resposta' && gr.body.provedor_id === '<n9@smtp.example.net>' &&
  gr.body.assunto === 'Re: Ana, aqui está o seu checklist' && gr.body.corpo.startsWith('Ana, que bom') && gr.headers.Authorization === 'Bearer ' + TOKEN);
const mk = chamadas.find((c) => c.method === 'PATCH');
check('marca as respostas novas dela como respondidas', /respostas_email\?contato_id=eq\.11111111-2222-4333-8444-555555555555&status=eq\.nova$/.test(mk.url) && mk.body.status === 'respondida' && !!mk.body.respondida_em);
check('envia antes de gravar', chamadas.indexOf(bv) < chamadas.indexOf(gr));

// Brevo recusa os cabeçalhos padrão: reenvia sem eles e avisa.
chamadas = [];
let tentativas = 0;
fakeFetch([...adminOk, fichaOk, enviadosOk, recebidasOk, gravaOk, marcaOk]);
const fetchBase = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => {
  if (/brevo/.test(String(url))) { tentativas++; const b = JSON.parse(opt.body); chamadas.push({ url: String(url), method: 'POST', body: b });
    return b.headers ? new Response('{"code":"invalid_parameter","message":"headers"}', { status: 400 }) : new Response('{"messageId":"<n10@x.net>"}', { status: 201 }); }
  return fetchBase(url, opt);
};
console.error = () => {};
res = await responder({ contato_id: CID, texto: 'Oi de novo' });
console.error = errosAntes;
corpo = await res.json();
check('cabeçalhos recusados: reenvia sem eles e avisa', res.status === 200 && tentativas === 2 && corpo.no_fio === false && /cabeçalhos da conversa/.test(corpo.aviso) &&
  !chamadas.filter((c) => /brevo/.test(c.url))[1].body.headers);

chamadas = [];
fakeFetch([...adminOk, fichaOk, enviadosOk, recebidasOk, [/api\.brevo\.com/, { status: 401, body: { message: 'key' } }]]);
console.error = () => {};
res = await responder({ contato_id: CID, texto: 'Oi' });
console.error = errosAntes;
check('Brevo recusou de vez: 502, nada gravado nem marcado', res.status === 502 && !chamadas.some((c) => c.method === 'POST' && /emails_enviados$/.test(c.url)) && !chamadas.some((c) => c.method === 'PATCH'));

chamadas = [];
fakeFetch([...adminOk, fichaOk, [/\/emails_enviados\?select=/, { body: [] }], [/\/respostas_email\?select=/, { body: [] }], gravaOk, marcaOk, [/api\.brevo\.com/, { status: 201, body: { messageId: '<n11@x.net>' } }]]);
res = await responder({ contato_id: CID, texto: 'Oi' });
check('sem conversa por e-mail e sem assunto: 400', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
res = await responder({ contato_id: CID, texto: 'Oi', assunto: 'Sobre o seu Master' });
bv = chamadas.find((c) => /brevo/.test(c.url));
check('sem conversa: usa o assunto escrito e não manda cabeçalhos de fio', res.status === 200 && bv.body.subject === 'Sobre o seu Master' && !bv.body.headers);

fakeFetch([...adminOk, [/\/crm_contatos\?/, { body: [] }]]);
check('ficha não encontrada: 404', (await responder({ contato_id: CID, texto: 'Oi' })).status === 404);

console.log('\n== Estúdio de e-mails 1: o texto dos modelos (crm-modelos-email.sql) ==');
// O texto de cada modelo fica entre as tags $<chave>_<campo>$ do SQL; o teste do banco confere que é o que fica gravado.
const SQL = readFileSync(path.resolve(HERE, '../../admin/crm/db/crm-modelos-email.sql'), 'utf8');
const tagSql = (k, campo) => { const r = new RegExp('\\$' + k + '_' + campo + '\\$([\\s\\S]*?)\\$' + k + '_' + campo + '\\$').exec(SQL); return r ? r[1] : null; };
const linhaSql = (k, versao = 1) => ({ versao, assunto: tagSql(k, 'assunto'), preheader: tagSql(k, 'pre'), corpo_texto: tagSql(k, 'texto'), corpo_html: tagSql(k, 'html') });

check('formato: variável, trecho com e sem valor', crmPreencher('{#a}A={a}{/a}{^a}sem a{/a}.{^b}sem b{/b}', { a: 'x', b: '' }, false) === 'A=x.sem b');
check('formato: no HTML o valor é escapado; o pronto para HTML não', crmPreencher('{a}|{b}', { a: '<i>', b: { texto: 't', html: '<b>h</b>' } }, true) === '&lt;i&gt;|<b>h</b>' &&
  crmPreencher('{b}', { b: { texto: 't', html: '<b>' } }, false) === 't');
check('formato: trechos dentro de trechos', crmPreencher('{#a}1{#b}2{/b}3{/a}', { a: 1, b: false }, false) === '13');
check('formato: valor com {chaves} não é lido de novo', crmPreencher('{a}', { a: '{b}' }, false) === '{b}');
let estoura = (f) => { try { f(); return false; } catch (e) { return true; } };
check('formato: variável desconhecida dá erro (vira reserva)', estoura(() => crmPreencher('Oi {apelido}', { nome: 'a' }, false)) && estoura(() => crmPreencher('{#x}a{/x}', {}, false)));
check('formato: trecho sem fechamento dá erro', estoura(() => crmPreencher('{#a}aberto', { a: 1 }, false)));

// O e-mail 1 e o e-mail 2 montados com o texto da tabela são idênticos aos de hoje (cfGuia1 e cfGuiaConversa).
let difs = 0, casos = 0;
for (const nome of ['Ana Maria', '', '  Bia  ', '<b>&"\'']) for (const objetivo of [undefined, 'cf-nao-comecei', 'cf-escolhendo-curso', 'cf-juntando-documentos', 'cf-dossie-enviado', 'cf-entrevista-resposta', 'outra'])
  for (const cfNivel of [undefined, 'l1', 'arq', 'l2l3', 'lpro', 'master', 'escola', 'zz']) for (const url of [NOTION, NOTION + '?pvs=4']) {
    const c = { email: 'ana@example.com', nome, respostas: { objetivo, cfNivel } };
    const hoje = cfGuia1(c, url), tabela = crmMontarModelo(linhaSql('cf_guia_1'), cfGuia1Vars(c, url));
    casos++; for (const f of ['assunto', 'pre', 'texto', 'html']) if (hoje[f] !== tabela[f]) difs++;
  }
check('e-mail 1 da tabela = e-mail 1 de hoje (' + casos + ' combinações de nome, etapa, nível e link)', difs === 0 && casos === 448);
difs = 0;
for (const nome of ['Ana Maria', '', '<b>']) {
  const c = { id: CID, email: 'ana@example.com', nome };
  const hoje = cfGuiaConversa(c, tk), tabela = crmMontarModelo(linhaSql('cf_guia_conversa'), cfGuiaConversaVars(c, tk));
  for (const f of ['assunto', 'pre', 'texto', 'html']) if (hoje[f] !== tabela[f]) difs++;
}
check('e-mail 2 da tabela = e-mail 2 de hoje (com e sem nome)', difs === 0);
check('a tabela diz a versão que saiu', crmMontarModelo(linhaSql('cf_guia_1', 3), cfGuia1Vars({ email: 'a@example.com', respostas: {} }, NOTION)).versao === 3);

// Os 8 do painel: o texto da tabela, preenchido como o painel preenche hoje, dá o mesmo e-mail de TPLS (crm.js).
const crmJs = readFileSync(path.resolve(HERE, '../../admin/crm/crm.js'), 'utf8');
const trecho = crmJs.slice(crmJs.indexOf('var TPLS = {'), crmJs.indexOf('var TPL_ORDER'));
const PERS = { au_pair_estudante: 'Au pair → estudante', campus_france: 'Campus France', conjuge: 'Cônjuge', sem: 'Sem checklist' };
const CAL = 'https://cal.example/1-1?overlayCalendar=true', APP = 'https://app.example/';
const pnT = (c) => (c.nome || c.email.split('@')[0]).trim().split(/\s+/)[0];
const personaT = (c) => PERS[c.persona || 'sem'] || c.persona;
const fmtT = (s) => { const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return r ? r[3] + '/' + r[2] + '/' + r[1] : '—'; };
const TPLS = new Function('pn', 'personaLabel', 'lk', 'fmtDay', 'CAL_LINK', trecho + '; return TPLS;')(pnT, personaT, () => APP, fmtT, CAL);
const varsPainel = (c) => {
  const v = { nome: pnT(c), persona: personaT(c).toLowerCase(), link_acesso: APP, link_agenda: CAL, au_pair: c.persona === 'au_pair_estudante', motivo: c.motivo || '',
    prazo_vencido: c.dias_para_prazo != null && Number(c.dias_para_prazo) < 0, prazo_a_vencer: c.dias_para_prazo != null && Number(c.dias_para_prazo) >= 0,
    prazo_limite: fmtT(c.prazo_limite), dias_para_prazo: c.dias_para_prazo };
  for (const k of ['pesquisando', 'escolhendo_escola', 'recusa_idade', 'buscando_empresa', 'montando_contrato']) v['etapa_' + k] = !!(c.respostas && c.respostas.objetivo === 'alt-' + k.replace(/_/g, '-'));
  return v;
};
const pessoas = [
  { email: 'ana.maria@example.com', nome: 'Ana Maria', persona: 'au_pair_estudante', motivo: 'o prazo do VLS-TS vence em 20 dias', dias_para_prazo: 20, prazo_limite: '2026-11-05', respostas: { objetivo: 'alt-recusa-idade' } },
  { email: 'bia@example.com', nome: null, persona: 'campus_france', dias_para_prazo: -4, prazo_limite: '2026-10-12', respostas: { objetivo: 'alt-montando-contrato' } },
  { email: 'cris@example.com', nome: 'Cris', persona: null, dias_para_prazo: 0, prazo_limite: '2026-10-16', respostas: {} },
  { email: 'dani@example.com', nome: 'Dani', persona: 'conjuge', dias_para_prazo: null, respostas: null },
  ...['pesquisando', 'escolhendo-escola', 'buscando-empresa'].map((o) => ({ email: 'e@example.com', nome: 'Eva', persona: 'pvt', respostas: { objetivo: 'alt-' + o } })),
];
const OITO = ['boas_vindas', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp', 'guia_chamada', 'guia_plataforma', 'guia_alternancia'];
difs = 0; casos = 0;
for (const k of OITO) for (const c of pessoas) {
  const t = TPLS[k].make(c), m8 = crmMontarModelo(linhaSql(k), varsPainel(c));
  casos++; if (m8.assunto !== t[0].replace(/^Assunto: /, '') || m8.texto !== t[1]) { difs++; if (difs < 3) console.log('  ', k, JSON.stringify(m8.assunto), JSON.stringify(t[0])); }
}
check('os 8 do painel: texto da tabela = texto de hoje (' + casos + ' casos)', difs === 0 && casos === 8 * pessoas.length);
check('são 10 modelos no SQL', [...OITO, 'cf_guia_1', 'cf_guia_conversa'].every((k) => tagSql(k, 'assunto') && tagSql(k, 'texto')));

console.log('\n== Estúdio de e-mails 1: o Worker lê a versão No ar ==');
const modeloRota = (linha) => [/\/modelos_email_versoes\?/, { body: linha ? [linha] : [] }];
const envioOk = [[/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 41 }] }], [/api\.brevo\.com/, { body: { messageId: '<m41@smtp.example.net>' } }]];
const capturar = async (regras) => {
  chamadas = []; fakeFetch([contatoOk, linkOk, ...regras, ...envioOk]);
  const r = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
  return { status: r.status, brevo: chamadas.find((c) => /brevo/.test(c.url)), reserva: chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST'),
    leitura: chamadas.find((c) => /modelos_email_versoes/.test(c.url)) };
};
const contatoTeste = contatoOk[1].body[0];
const hoje1 = cfGuia1(contatoTeste, NOTION);
let cap = await capturar([modeloRota(linhaSql('cf_guia_1'))]);
check('e-mail 1: lê só a versão No ar de cf_guia_1, com a service_role', /modelos_email_versoes\?.*chave=eq\.cf_guia_1&etapa=eq\.no_ar/.test(cap.leitura.url) && cap.leitura.headers.apikey === 'srv');
check('e-mail 1 com o texto da tabela sai idêntico ao de hoje', cap.status === 200 && cap.brevo.body.subject === hoje1.assunto &&
  cap.brevo.body.textContent === hoje1.texto && cap.brevo.body.htmlContent === hoje1.html);
check('grava a versão que saiu', cap.reserva.body.modelo_versao === 1 && cap.reserva.body.corpo === hoje1.texto);

// Trocar o texto na tabela muda o e-mail, sem colar o Worker.
const mudada = { ...linhaSql('cf_guia_1', 2), assunto: '{nome}, o seu checklist chegou', corpo_texto: tagSql('cf_guia_1', 'texto').replace('Ficou com dúvida?', 'Alguma dúvida?') };
mudada.corpo_html = mudada.corpo_html.replace('Ficou com dúvida?', 'Alguma dúvida?');
cap = await capturar([modeloRota(mudada)]);
check('trocar o texto na tabela muda o e-mail', cap.brevo.body.subject === 'Ana, o seu checklist chegou' &&
  cap.brevo.body.textContent.includes('Alguma dúvida? É só responder') && cap.brevo.body.htmlContent.includes('Alguma dúvida?</b>') && cap.reserva.body.modelo_versao === 2);
check('o modelo novo pode ser só texto (o HTML sai do texto)', (await capturar([modeloRota({ versao: 4, assunto: 'Oi {nome}', corpo_texto: 'Seu link: {link_checklist}', corpo_html: null })]))
  .brevo.body.htmlContent.includes('<a href="' + NOTION + '?utm_source=email'));

console.error = () => {};
cap = await capturar([[/\/modelos_email_versoes\?/, { status: 500, body: { message: 'fora do ar' } }]]);
check('tabela fora do ar: sai o texto de hoje, sem versão', cap.status === 200 && cap.brevo.body.textContent === hoje1.texto && !('modelo_versao' in cap.reserva.body));
cap = await capturar([modeloRota(null)]);
check('sem versão No ar: sai o texto de hoje', cap.brevo.body.htmlContent === hoje1.html && !('modelo_versao' in cap.reserva.body));
cap = await capturar([[/\/modelos_email_versoes\?/, { status: 404, body: { code: '42P01', message: 'relation does not exist' } }]]);
check('antes de rodar o SQL (tabela não existe): sai o texto de hoje', cap.brevo.body.textContent === hoje1.texto);
cap = await capturar([modeloRota({ ...linhaSql('cf_guia_1', 5), corpo_texto: 'Oi {apelido}!' })]);
check('texto com variável que não existe: sai o texto de hoje', cap.brevo.body.textContent === hoje1.texto && !('modelo_versao' in cap.reserva.body));
cap = await capturar([modeloRota({ ...linhaSql('cf_guia_1', 7), corpo_texto: 'Oi {nome}! [escrever aqui]' })]);
check('texto com [colchetes] esquecido: sai o texto de hoje', cap.brevo.body.textContent === hoje1.texto);
cap = await capturar([modeloRota({ ...linhaSql('cf_guia_1', 6), assunto: '{^nome}{/nome}' })]);
check('assunto que fica vazio: sai o texto de hoje', cap.brevo.body.subject === hoje1.assunto);
const fetchAntes = globalThis.fetch;
chamadas = []; fakeFetch([contatoOk, linkOk, ...envioOk]);
const fetchFalso = globalThis.fetch;
globalThis.fetch = async (url, opt) => { if (/modelos_email_versoes/.test(String(url))) throw new Error('rede caiu'); return fetchFalso(url, opt); };
res = await worker.fetch(req({ contato_id: CID, guia: 'etudes-en-france-2027-2028' }), env, {});
check('rede caiu na leitura do modelo: sai o texto de hoje', res.status === 200 && chamadas.find((c) => /brevo/.test(c.url)).body.textContent === hoje1.texto);
globalThis.fetch = fetchAntes;
console.error = errosAntes;

// E-mail 2: lê o modelo uma vez por rodada e preenche os botões de cada pessoa.
chamadas = [];
fakeFetch([pend, modeloRota(linhaSql('cf_guia_conversa')), [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 51 }] }], [/api\.brevo\.com/, { body: { messageId: '<m5@smtp.example.net>' } }]]);
resumo = await (async () => { let p; await worker.scheduled({}, envL, { waitUntil(x) { p = x; } }); return p; })();
const env2 = chamadas.filter((c) => /brevo/.test(c.url));
const tk2 = /t=([A-Za-z0-9_.-]+)/.exec(env2[1].body.textContent)[1];
const hoje2 = cfGuiaConversa({ id: CID2, email: 'bia@example.com', nome: 'Bia' }, tk2);
check('e-mail 2: lê o modelo uma vez só para os dois', resumo.enviados === 2 && chamadas.filter((c) => /modelos_email_versoes\?.*chave=eq\.cf_guia_conversa&etapa=eq\.no_ar/.test(c.url)).length === 1);
check('e-mail 2 com o texto da tabela sai idêntico ao de hoje', env2[1].body.subject === hoje2.assunto && env2[1].body.textContent === hoje2.texto && env2[1].body.htmlContent === hoje2.html);
check('e-mail 2: grava a versão e continua com List-Unsubscribe', chamadas.filter((c) => /emails_enviados$/.test(c.url) && c.method === 'POST').every((c) => c.body.modelo_versao === 1) &&
  /^<mailto:/.test(env2[0].body.headers['List-Unsubscribe']));
chamadas = [];
fakeFetch([pend, modeloRota({ ...linhaSql('cf_guia_conversa', 2), assunto: '{nome}, para onde você vai?' }), [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 52 }] }], [/api\.brevo\.com/, { body: { messageId: '<m6@x.net>' } }]]);
resumo = await (async () => { let p; await worker.scheduled({}, envL, { waitUntil(x) { p = x; } }); return p; })();
check('e-mail 2: trocar o assunto na tabela muda o e-mail', chamadas.filter((c) => /brevo/.test(c.url)).map((c) => c.body.subject).join('|') === 'Ana, para onde você vai?|Bia, para onde você vai?');
chamadas = []; fakeFetch([[/\/rpc\/crm_conversa_pendentes$/, { method: 'POST', body: [] }]]);
resumo = await (async () => { let p; await worker.scheduled({}, envL, { waitUntil(x) { p = x; } }); return p; })();
check('ninguém para receber: nem lê o modelo', resumo.pendentes === 0 && !chamadas.some((c) => /modelos_email/.test(c.url)));


console.log('\n== Estúdio de e-mails 2: os blocos ==');
const E = await import(pathToFileURL(path.resolve(HERE, '../../admin/crm/estudio.js')).href);
const bl1 = { versao: 2, ...E.montar(E.iniciais('cf_guia_1'), 'servico') };
difs = 0; casos = 0;
for (const nome of ['Ana Maria', '', '<b>&"\'']) for (const objetivo of [undefined, 'cf-nao-comecei', 'cf-escolhendo-curso', 'cf-juntando-documentos', 'cf-dossie-enviado', 'cf-entrevista-resposta', 'outra'])
  for (const cfNivel of [undefined, 'l1', 'arq', 'l2l3', 'lpro', 'master', 'escola', 'zz']) for (const url of [NOTION, NOTION + '?pvs=4']) {
    const c = { email: 'ana@example.com', nome, respostas: { objetivo, cfNivel } };
    const hoje = cfGuia1(c, url), blocos = crmMontarModelo(bl1, cfGuia1Vars(c, url));
    casos++; for (const f of ['assunto', 'pre', 'texto']) if (hoje[f] !== blocos[f]) difs++;
    if (!blocos.html.includes('href="' + url.replace(/&/g, '&amp;'))) difs++;
  }
check('e-mail 1 em blocos: assunto, prévia e texto puro iguais aos de hoje (' + casos + ' combinações)', difs === 0 && casos === 336);
let h1 = crmMontarModelo(bl1, cfGuia1Vars({ email: 'ana@example.com', nome: '<i>Ana</i>', respostas: { objetivo: 'cf-dossie-enviado', cfNivel: 'master' } }, NOTION)).html;
check('e-mail 1 em blocos: HTML com botão, destaque do nível, etapa e rodapé de serviço', /<a href="https:[^"]+utm_content=cf_guia_1"[^>]*>Abrir o checklist no Notion<\/a>/.test(h1) &&
  h1.includes('O prazo do seu nível · Master') && h1.includes('<b>Pague a taxa e declare o pagamento.</b>') && h1.includes('porque pediu o checklist Études en France no Por Dentro com ana@example.com.') &&
  !h1.includes('Para quem está na etapa que ainda não começou') && !/sair/.test(h1) && h1.includes('&lt;i&gt;Ana') && !/\{[#^/]?\w+\}/.test(h1));
const bl2 = { versao: 2, ...E.montar(E.iniciais('cf_guia_conversa'), 'novidades') };
difs = 0;
for (const nome of ['Ana Maria', '', '<b>']) {
  const c = { id: CID, email: 'ana@example.com', nome };
  const hoje = cfGuiaConversa(c, tk), blocos = crmMontarModelo(bl2, cfGuiaConversaVars(c, tk));
  for (const f of ['assunto', 'pre', 'texto']) if (hoje[f] !== blocos[f]) difs++;
  if (!blocos.html.includes(cfBotoesCidade(tk).html) || !blocos.html.includes('responda com a palavra sair')) difs++;
}
check('e-mail 2 em blocos: texto puro igual ao de hoje, botões assinados e rodapé de novidades', difs === 0);
const naoabriu = E.montar(E.iniciais('naoabriu'), 'servico'), naoclicou = E.montar(E.iniciais('naoclicou'), 'novidades');
check('rodapé pelo tipo: serviço sem descadastro, novidades com "responda sair"', !/sair/.test(naoabriu.corpo_texto + naoabriu.corpo_html) && /palavra sair\.$/.test(naoclicou.corpo_texto));
const dPlano = { assunto: 'Oi {nome}', itens: [{ tipo: 'texto', texto: 'Você vai para {cidade}.' }, { tipo: 'texto', texto: 'Seu nível: {nivel}.' }, { tipo: 'titulo', texto: '{nome}, olá', alt: 'Olá' }] };
const vPlano = { versao: 9, ...E.montar(dPlano, 'servico') };
const semDados = crmMontarModelo(vPlano, cfGuia1Vars({ email: 'a@example.com', nome: '', respostas: {} }, NOTION));
const comDados = crmMontarModelo(vPlano, cfGuia1Vars({ email: 'a@example.com', nome: 'Ana', respostas: { cfNivel: 'master', cfCidade: 'lyon' } }, NOTION));
check('plano B: cidade troca pelo texto de reserva, nível sem plano B tira o bloco, título usa o texto se faltar',
  semDados.texto === 'Você vai para a cidade que você escolher.\n\nOlá' && comDados.texto === 'Você vai para Lyon.\n\nSeu nível: Master.\n\nAna, olá');
check('{etapa} e {cidade} no e-mail 1', cfGuia1Vars({ email: 'a@example.com', respostas: { objetivo: 'cf-dossie-enviado', cfCidade: 'nao-sei' } }, NOTION).etapa === 'já enviou o dossiê' &&
  cfGuia1Vars({ email: 'a@example.com', respostas: { cfCidade: 'nao-sei' } }, NOTION).cidade === 'Ainda não sei');
const pv = E.dadosDe('cf_guia_1', { email: 'a@example.com', nome: 'Ana Maria', respostas: { objetivo: 'cf-dossie-enviado', cfNivel: 'master', cfCidade: 'lyon' } }, {});
const wv = cfGuia1Vars({ email: 'a@example.com', nome: 'Ana Maria', respostas: { objetivo: 'cf-dossie-enviado', cfNivel: 'master', cfCidade: 'lyon' } }, NOTION);
check('a prévia do painel tem os mesmos dados do Worker (menos o link privado)', Object.keys(wv).every((k) => k === 'link_checklist' || wv[k] === pv[k]) && Object.keys(pv).sort().join() === Object.keys(wv).sort().join());
check('o painel monta igual ao Worker (preencher)', E.montarComDados(bl1, wv).texto === crmMontarModelo(bl1, wv).texto && E.montarComDados(bl1, wv).html === crmMontarModelo(bl1, wv).html);
const conf = (d, chave, auto) => E.conferir(d, { chave }, E.montar(d, 'servico'), auto);
check('pronto: o e-mail 1 em blocos passa em tudo o que trava', conf(E.iniciais('cf_guia_1'), 'cf_guia_1', true).every((x) => x.ok || !x.trava));
check('pronto: link do Notion digitado trava', conf({ assunto: 'a', itens: [{ tipo: 'texto', texto: 'veja https://x.notion.site/abc' }] }, 'cf_guia_1', true).some((x) => !x.ok && x.trava && /privado/.test(x.txt)));
check('pronto: dado que o modelo não tem trava', conf({ assunto: 'a', itens: [{ tipo: 'texto', texto: 'Oi {apelido}' }] }, 'cf_guia_1', true).some((x) => !x.ok && x.trava && /apelido/.test(x.txt)));
check('pronto: [colchetes] travam o automático, não o manual', conf({ assunto: 'a', itens: [{ tipo: 'texto', texto: '[dica]' }] }, 'cf_guia_1', true).some((x) => !x.ok && x.trava) &&
  conf({ assunto: 'a', itens: [{ tipo: 'texto', texto: '[dica]' }, { tipo: 'assinatura', texto: 'I' }] }, 'parouapp', false).every((x) => x.ok || !x.trava));
check('blocos não deixam HTML escrito passar', !E.montar({ assunto: 'a', itens: [{ tipo: 'texto', texto: '<script>alert(1)</script>' }] }, 'servico').corpo_html.includes('<script>'));

console.log('\n== Estúdio de e-mails 2: rota /api/crm/modelo-teste ==');
const teste = (corpo, token = TOKEN) => worker.fetch(new Request('https://w.example/api/crm/modelo-teste', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(corpo) }), env, {});
const adminComEmail = [[/\/auth\/v1\/user$/, { body: { id: 'aaaaaaaa-2222-4333-8444-555555555555', email: 'dona@example.org' } }], [/\/admins\?/, { body: [{ user_id: 'x' }] }]];
const versaoRota = (linha) => [/\/modelos_email_versoes\?select=/, { body: linha ? [linha] : [] }];
const brevoOk = [/api\.brevo\.com/, { body: { messageId: '<t1@x.net>' } }];
const marcaTeste = [/\/modelos_email_versoes\?chave=/, { method: 'PATCH', status: 200 }];
chamadas = []; fakeFetch([]);
res = await teste({ chave: 'cf_guia_1', versao: 2, contato_id: CID }, null);
check('teste sem login: 401, nada enviado', res.status === 401 && !chamadas.some((c) => /brevo/.test(c.url)));
chamadas = []; fakeFetch([...adminComEmail, versaoRota(bl1), contatoOk, linkOk, brevoOk, marcaTeste]);
res = await teste({ chave: 'cf_guia_1', versao: 2, contato_id: CID });
let jt = await res.json(), bt = chamadas.find((c) => /brevo/.test(c.url));
check('teste do e-mail 1: vai só para a admin, com [Teste] no assunto', res.status === 200 && jt.para === 'dona@example.org' && bt.body.to.length === 1 && bt.body.to[0].email === 'dona@example.org' &&
  bt.body.subject === '[Teste] Ana, aqui está o seu checklist do Études en France');
check('teste do e-mail 1: dados da pessoa e link privado vindos do banco', bt.body.textContent.includes(NOTION + '?utm_source=email') && bt.body.textContent.includes('O prazo do seu nível · 1º ano de Licence: 14/12/2026') &&
  chamadas.find((c) => /guias_links/.test(c.url)).headers.apikey === 'srv');
check('teste lê a versão pedida com o token da admin (rascunho vale)', /modelos_email_versoes\?select=.*chave=eq\.cf_guia_1&versao=eq\.2/.test(chamadas.find((c) => /modelos_email_versoes\?select=/.test(c.url)).url) &&
  chamadas.find((c) => /modelos_email_versoes\?select=/.test(c.url)).headers.Authorization === 'Bearer ' + TOKEN);
check('teste não grava em emails_enviados (não é envio de verdade)', !chamadas.some((c) => /emails_enviados/.test(c.url)));
const marcaV = chamadas.find((c) => c.method === 'PATCH');
check('teste marca a versão como testada', marcaV && /chave=eq\.cf_guia_1&versao=eq\.2/.test(marcaV.url) && marcaV.body.testado_em && marcaV.body.testado_por === 'aaaaaaaa-2222-4333-8444-555555555555' && jt.marcado === true);
chamadas = []; fakeFetch([...adminComEmail, versaoRota(bl2), contatoOk, brevoOk, marcaTeste]);
res = await teste({ chave: 'cf_guia_conversa', versao: 2, contato_id: CID });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('teste do e-mail 2: botões com link de teste (não registram toque de verdade)', res.status === 200 && bt.body.textContent.includes('/conversa/?r=paris&t=teste') && !chamadas.some((c) => /guias_links/.test(c.url)));
chamadas = []; fakeFetch([...adminComEmail, versaoRota({ versao: 3, assunto: '{nome}, oi', corpo_texto: 'Oi {nome}! {#au_pair}Au pair.{/au_pair} {link_acesso}', corpo_html: null }), brevoOk, marcaTeste]);
res = await teste({ chave: 'naoabriu', versao: 3, contato_id: CID, vars: { nome: 'Bia', au_pair: true, link_acesso: 'https://app.example/', '<x>': 'y', obj: { a: 1 } } });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('teste de modelo manual: usa os dados do painel', res.status === 200 && bt.body.textContent === 'Oi Bia! Au pair. https://app.example/' && !chamadas.some((c) => /\/contatos\?/.test(c.url)));
chamadas = []; fakeFetch([...adminComEmail, versaoRota({ versao: 3, assunto: 'a', corpo_texto: 'Oi {apelido}', corpo_html: null })]);
res = await teste({ chave: 'naoabriu', versao: 3, contato_id: CID, vars: { nome: 'Bia' } });
check('teste com dado que não existe: 400 explicando, nada enviado', res.status === 400 && /apelido/.test((await res.json()).error) && !chamadas.some((c) => /brevo/.test(c.url)));
chamadas = []; fakeFetch([...adminComEmail, versaoRota({ versao: 3, assunto: 'a', corpo_texto: 'Oi [dica]', corpo_html: null })]);
res = await teste({ chave: 'parouapp', versao: 3, contato_id: CID, vars: {} });
check('teste com [colchetes]: 400, nada enviado', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
chamadas = []; fakeFetch([...adminComEmail, versaoRota(null)]);
res = await teste({ chave: 'cf_guia_1', versao: 77, contato_id: CID });
check('versão que não existe: 404', res.status === 404);
chamadas = []; fakeFetch([...adminComEmail]);
res = await teste({ chave: 'cf_guia_1', versao: 2, contato_id: 'nao-e-uuid' });
check('sem pessoa da prévia: 400', res.status === 400);

console.log('\n== Estúdio de e-mails 2: envio manual com o texto da tabela ==');
const enviar = (corpo) => worker.fetch(new Request('https://w.example/api/crm/enviar', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(corpo) }), env, {});
const fichaNov = [/\/crm_contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana', aceita_novidades: true }] }];
chamadas = []; fakeFetch([...adminOk, fichaNov, brevoOk, [/\/emails_enviados$/, { method: 'POST', status: 201 }]]);
await enviar({ contato_id: CID, modelo: 'naoclicou', assunto: 'oi', corpo: naoclicou.corpo_texto.replace(/\{[^}]+\}/g, ''), modelo_versao: 4 });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('envio manual: o rodapé do estúdio não se repete', (bt.body.textContent.match(/sair/g) || []).length === 1);
check('envio manual: grava a versão de onde o texto partiu', chamadas.find((c) => /emails_enviados$/.test(c.url)).body.modelo_versao === 4);
chamadas = []; fakeFetch([...adminOk, fichaNov, brevoOk, [/\/emails_enviados$/, { method: 'POST', status: 201 }]]);
await enviar({ contato_id: CID, modelo: 'naoclicou', assunto: 'oi', corpo: 'Oi Ana!', modelo_versao: 'x' });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('envio manual de texto antigo: o Worker põe o rodapé, como hoje', /palavra "sair"/.test(bt.body.textContent) && !('modelo_versao' in chamadas.find((c) => /emails_enviados$/.test(c.url)).body));

console.log('\n== Ficha: o e-mail sai como a prévia do pop-up ==');
const DOC = '<!DOCTYPE html>\n<html><body><p>Oi Ana!</p><a href="https://app.example/">Abrir</a></body></html>';
const okEnvio = () => [...adminOk, fichaNov, brevoOk, [/\/emails_enviados$/, { method: 'POST', status: 201 }]];
chamadas = []; fakeFetch(okEnvio());
res = await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana! https://app.example/', modelo_versao: 2, html: DOC });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('com versão e HTML: o Brevo recebe o desenho e o texto puro, e a resposta diz formato html', res.status === 200 && (await res.json()).formato === 'html' && bt.body.htmlContent === DOC && bt.body.textContent === 'Oi Ana! https://app.example/');
chamadas = []; fakeFetch(okEnvio());
res = await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!', html: DOC });
bt = chamadas.find((c) => /brevo/.test(c.url));
check('HTML sem versão: ignora e sai em texto simples', (await res.json()).formato === 'texto' && bt.body.htmlContent !== DOC && /Oi Ana!/.test(bt.body.htmlContent));
chamadas = []; fakeFetch(okEnvio());
res = await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!', modelo_versao: 2, html: '<script>x</script>' });
check('HTML que não é documento: ignora', (await res.json()).formato === 'texto');
chamadas = []; fakeFetch(okEnvio());
res = await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!', modelo_versao: 2, html: '<!DOCTYPE html><p>Oi [link do acesso]</p>' });
check('HTML com [colchetes]: 400, nada enviado', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));

console.log('\n== Ficha: o formato do envio fica gravado ==');
chamadas = []; fakeFetch(okEnvio());
await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!', modelo_versao: 2, html: DOC });
check('com o template: grava formato html', chamadas.find((c) => c.method === 'POST' && /emails_enviados$/.test(c.url)).body.formato === 'html');
chamadas = []; fakeFetch(okEnvio());
await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!' });
check('texto mexido: grava formato texto', chamadas.find((c) => c.method === 'POST' && /emails_enviados$/.test(c.url)).body.formato === 'texto');
{
  // Banco sem a coluna: o 1º POST falha falando de formato, o 2º grava sem ela.
  chamadas = []; let n = 0;
  fakeFetch([...adminOk, fichaNov, brevoOk]);
  const base = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    if (/emails_enviados$/.test(String(url)) && opt.method === 'POST') {
      chamadas.push({ url: String(url), method: 'POST', body: JSON.parse(opt.body) });
      return ++n === 1 ? new Response('{"message":"Could not find the \'formato\' column"}', { status: 400 }) : new Response('', { status: 201 });
    }
    return base(url, opt);
  };
  res = await enviar({ contato_id: CID, modelo: 'boas_vindas', assunto: 'oi', corpo: 'Oi Ana!' });
  const posts = chamadas.filter((c) => c.method === 'POST' && /emails_enviados$/.test(c.url));
  check('banco sem a coluna formato: grava de novo sem ela e não dá aviso', posts.length === 2 && !('formato' in posts[1].body) && !(await res.json()).aviso);
}


console.log('\n== Estúdio de e-mails 3: sequências de hora em hora ==');
{
  const HUB = 'https://www.notion.so/hub-exemplo-privado';
  const envS = { ...env, HUB_ESTUDOS_NOTION_LINK: HUB };
  // A versão No ar do modelo de compra, montada do esqueleto do catálogo com os [trechos] escritos.
  const d = E.esqueleto('compra');
  d.itens.forEach((b) => { if (b.valor) b.valor = '1. Escolha o seu nível · 2. Monte a semana'; });
  const vCompra = { versao: 1, ...E.montar(d, 'compra') };
  const dA = E.esqueleto('aquecimento');
  dA.assunto = 'Uma astúcia para o dossiê'; dA.itens = [{ tipo: 'texto', texto: 'Oi {nome}! Uma astúcia.' }, { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }];
  const vAquec = { versao: 2, ...E.montar(dA, 'novidades') };
  const dadosAna = { persona: 'campus_france', respostas: { cfNivel: 'l1' }, produto: 'hub-de-estudos', produto_nome: 'Hub de Estudos' };
  const linhas = [
    { contato_id: CID, email: 'ana@example.com', nome: 'Ana Teste', chave: 'hub_compra_1', versao: 1, tipo: 'compra', aceita_novidades: false, dados: dadosAna },
    { contato_id: CID2, email: 'bia@example.com', nome: 'Bia', chave: 'aquec_1', versao: 2, tipo: 'novidades', aceita_novidades: false, dados: {} },
    { contato_id: CID2, email: 'bia@example.com', nome: 'Bia', chave: 'cf_guia_1', versao: 1, tipo: 'servico', aceita_novidades: true, dados: {} },
    { contato_id: CID2, email: 'bia@example.com', nome: 'Bia', chave: 'aquec_1', versao: 2, tipo: 'novidades', aceita_novidades: true, dados: {} },
  ];
  const regras = (extra) => [...(extra || []), [/\/rpc\/crm_sequencia_pendentes$/, { method: 'POST', body: linhas }],
    [/modelos_email_versoes\?.*chave=eq\.hub_compra_1/, { body: [vCompra] }], [/modelos_email_versoes\?.*chave=eq\.aquec_1/, { body: [vAquec] }],
    [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 41 }] }], [/api\.brevo\.com/, { body: { messageId: '<s1@x.net>' } }]];
  const rodar = async (ev, e2) => { let p; await worker.scheduled(ev, e2 || envS, { waitUntil(x) { p = x; } }); return p; };
  chamadas = []; fakeFetch(regras());
  let r = await rodar({ cron: '5 * * * *' });
  check('o Cron "5 * * * *" roda as sequências (não o e-mail 2)', chamadas.some((c) => /crm_sequencia_pendentes/.test(c.url)) && !chamadas.some((c) => /crm_conversa_pendentes/.test(c.url)));
  check('lote padrão 12, com a service_role', chamadas.find((c) => /crm_sequencia_pendentes/.test(c.url)).body.p_limite === 12 && chamadas[0].headers.apikey === 'srv');
  check('manda 2, pula quem não aceitou novidades e nunca manda um dos 10 de antes', r.enviados === 2 && r.sem_consentimento === 1 && r.falhas === 1);
  const res3 = chamadas.filter((c) => /emails_enviados$/.test(c.url) && c.method === 'POST');
  check('reserva com sequencia = true, formato html e a versão', res3.length === 2 && res3.every((c) => c.body.sequencia === true && c.body.formato === 'html') &&
    res3[0].body.modelo === 'hub_compra_1' && res3[0].body.modelo_versao === 1);
  const env3 = chamadas.filter((c) => /brevo/.test(c.url));
  check('compra: o link do produto vem do Worker, com o nome dela e do produto', env3[0].body.subject === 'Ana, o seu acesso ao Hub de Estudos chegou' &&
    env3[0].body.textContent.includes(HUB) && env3[0].body.htmlContent.includes('href="' + HUB + '"'));
  check('compra: sem List-Unsubscribe e sem "responda sair"', !env3[0].body.headers && !/palavra sair/.test(env3[0].body.textContent));
  check('novidades: List-Unsubscribe e o rodapé "responda sair"', /^<mailto:/.test(env3[1].body.headers['List-Unsubscribe']) && /palavra sair\.$/.test(env3[1].body.textContent));
  check('cada versão é lida uma vez por rodada', chamadas.filter((c) => /modelos_email_versoes/.test(c.url)).length === 2 &&
    chamadas.filter((c) => /modelos_email_versoes/.test(c.url)).every((c) => /etapa=eq\.no_ar/.test(c.url)));

  chamadas = []; fakeFetch(regras());
  r = await rodar({ cron: '5 * * * *' }, env);
  check('sem o link do produto no Worker, o e-mail de compra não sai', r.falhas === 2 && !chamadas.filter((c) => /brevo/.test(c.url)).some((c) => /hub/i.test(c.body.subject)));
  chamadas = []; fakeFetch(regras([[/\/emails_enviados$/, { method: 'POST', status: 409 }]]));
  r = await rodar({ cron: '5 * * * *' });
  check('já recebeu (índice, 409): não manda de novo', r.ja_enviados === 2 && !chamadas.some((c) => /brevo/.test(c.url)));
  chamadas = []; fakeFetch([[/\/rpc\/crm_sequencia_pendentes$/, { method: 'POST', status: 404, body: {} }]]);
  r = await rodar({ cron: '5 * * * *' });
  check('sem o SQL da entrega 3: só anota nos Logs', r.erro === 'lista' && !chamadas.some((c) => /brevo/.test(c.url)));
  chamadas = []; fakeFetch([pend, [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 21 }] }], [/api\.brevo\.com/, { body: { messageId: '<m2@x.net>' } }]]);
  r = await rodar({ cron: '0 13 * * *' }, envL);
  check('o Cron "0 13 * * *" continua sendo só o e-mail 2', r.enviados === 2 && !chamadas.some((c) => /crm_sequencia_pendentes/.test(c.url)));
  chamadas = [];
  res = await worker.fetch(new Request('https://w.example/api/crm/sequencia-rodar', { method: 'POST', headers: { 'X-Crm-Hook': 'errado-errado-errado-errado-errado-err' } }), envS, {});
  check('rodar na hora: segredo errado dá 401', res.status === 401 && chamadas.length === 0);
  fakeFetch(regras());
  res = await worker.fetch(new Request('https://w.example/api/crm/sequencia-rodar', { method: 'POST', headers: { 'X-Crm-Hook': SEGREDO } }), envS, {});
  check('rodar na hora: com o segredo, manda', res.status === 200 && (await res.json()).enviados === 2);

  console.log('\n== Filtro por etapa do guia: a etapa chega aos modelos novos ==');
  check('o estúdio e o Worker têm as mesmas 10 etapas', E.ETAPAS_GUIA.length === 10 &&
    E.ETAPAS_GUIA.every(([k]) => E.VARS_NOVOS.includes('etapa_' + k.replace(/^(cf|alt)-/, '').replace(/-/g, '_'))));
  const dT = E.esqueleto('aquecimento');
  dT.assunto = 'Uma astúcia da sua etapa';
  dT.itens = [{ tipo: 'texto', texto: 'Oi {nome}!' }, { tipo: 'etapa', se: '#etapa_juntando_documentos', texto: 'Trecho de quem junta documentos.' },
    { tipo: 'etapa', se: '#etapa_dossie_enviado', texto: 'Trecho de quem já enviou.' }, { tipo: 'etapa', se: '#etapa_pesquisando', texto: 'Trecho da alternância.' },
    { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }];
  const vTrilha = { versao: 1, ...E.montar(dT, 'novidades') };
  const pessoaEtapa = (cid, nome, objetivo) => ({ contato_id: cid, email: nome.toLowerCase() + '@example.com', nome, chave: 'aq_b_d3', versao: 1, tipo: 'novidades',
    aceita_novidades: true, dados: { persona: 'campus_france', respostas: objetivo ? { objetivo } : {} } });
  chamadas = []; fakeFetch([[/\/rpc\/crm_sequencia_pendentes$/, { method: 'POST', body: [pessoaEtapa(CID, 'Ana', 'cf-juntando-documentos'), pessoaEtapa(CID2, 'Bia', null)] }],
    [/modelos_email_versoes\?.*chave=eq\.aq_b_d3/, { body: [vTrilha] }], [/\/emails_enviados$/, { method: 'POST', status: 201, body: [{ id: 51 }] }],
    [/api\.brevo\.com/, { body: { messageId: '<e1@x.net>' } }]]);
  r = await rodar({ cron: '5 * * * *' });
  const envE = chamadas.filter((c) => /brevo/.test(c.url));
  check('quem marcou "juntando documentos" recebe só o trecho da etapa dela', r.enviados === 2 && envE[0].body.textContent.includes('Trecho de quem junta documentos.') &&
    !envE[0].body.textContent.includes('Trecho de quem já enviou.') && !envE[0].body.textContent.includes('Trecho da alternância.') &&
    envE[0].body.htmlContent.includes('Trecho de quem junta documentos.'));
  check('quem não marcou etapa não recebe nenhum trecho de etapa', !/Trecho/.test(envE[1].body.textContent) && !/Trecho/.test(envE[1].body.htmlContent));

  console.log('\n== Estúdio de e-mails 3: um modelo novo pela ficha ==');
  const modeloNovo = (m) => [/\/modelos_email\?select=\*/, { body: m ? [m] : [] }];
  const fichaSem = [/\/crm_contatos\?/, { body: [{ id: CID, email: 'ana@example.com', nome: 'Ana', aceita_novidades: false }] }];
  chamadas = []; fakeFetch([...adminOk, modeloNovo({ chave: 'convite_novo', tipo: 'novidades', automatico: false, criado_no_estudio: true }), fichaSem, brevoOk]);
  res = await enviar({ contato_id: CID, modelo: 'convite_novo', assunto: 'oi', corpo: 'Oi Ana!' });
  check('modelo novo de novidades para quem não aceitou: 403', res.status === 403 && !chamadas.some((c) => /brevo/.test(c.url)));
  chamadas = []; fakeFetch([...adminOk, modeloNovo({ chave: 'convite_novo', tipo: 'novidades', automatico: false, criado_no_estudio: true }), fichaNov, brevoOk, [/\/emails_enviados$/, { method: 'POST', status: 201 }]]);
  res = await enviar({ contato_id: CID, modelo: 'convite_novo', assunto: 'oi', corpo: 'Oi Ana!' });
  bt = chamadas.find((c) => /brevo/.test(c.url));
  check('para quem aceitou: sai com rodapé e List-Unsubscribe', res.status === 200 && /palavra "sair"/.test(bt.body.textContent) && !!bt.body.headers);
  chamadas = []; fakeFetch([...adminOk, modeloNovo({ chave: 'boas_novas', tipo: 'servico', automatico: false, criado_no_estudio: true }), fichaSem, brevoOk, [/\/emails_enviados$/, { method: 'POST', status: 201 }]]);
  res = await enviar({ contato_id: CID, modelo: 'boas_novas', assunto: 'oi', corpo: 'Oi Ana!' });
  bt = chamadas.find((c) => /brevo/.test(c.url));
  check('modelo novo de serviço: sai para todos, sem rodapé', res.status === 200 && !/sair/.test(bt.body.textContent) && !bt.body.headers);
  chamadas = []; fakeFetch([...adminOk, modeloNovo({ chave: 'hub_compra_1', tipo: 'compra', automatico: true, criado_no_estudio: true }), fichaNov, brevoOk]);
  res = await enviar({ contato_id: CID, modelo: 'hub_compra_1', assunto: 'oi', corpo: 'Oi Ana!' });
  check('modelo de sequência não sai pela ficha', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
  chamadas = []; fakeFetch([...adminOk, modeloNovo({ chave: 'convite_novo', tipo: 'novidades', automatico: false, criado_no_estudio: true, excluido_em: '2026-10-19T10:00:00Z' }), fichaNov, brevoOk]);
  res = await enviar({ contato_id: CID, modelo: 'convite_novo', assunto: 'oi', corpo: 'Oi Ana!' });
  check('modelo excluído no estúdio não sai pela ficha', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
  chamadas = []; fakeFetch([...adminOk, modeloNovo(null), fichaNov, brevoOk]);
  res = await enviar({ contato_id: CID, modelo: 'nao_existe', assunto: 'oi', corpo: 'Oi Ana!' });
  check('modelo que não existe: 400', res.status === 400 && !chamadas.some((c) => /brevo/.test(c.url)));
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
