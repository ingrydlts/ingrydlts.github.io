// Testa o que as fases 0 e 1a do CRM puseram no Worker: o leitor de e-mail (sem biblioteca), o handler
// email() e a rota /api/crm/guia-capturado (e-mail 1 do guia). Tudo com fetch falso: não chama
// Supabase nem Brevo. Exemplos fictícios (nada de dado real neste repositório público).
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
  '\nexport { crmLerEmail, crmTirarCitacao, crmDecodePalavras, cfGuia1, crmBytesParaBinario, cfGuiaConversa, crmLinkAssinar, crmLinkConferir, CF_CIDADES };\n');
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;
const { crmLerEmail, crmTirarCitacao, crmDecodePalavras, cfGuia1, crmBytesParaBinario, cfGuiaConversa, crmLinkAssinar, crmLinkConferir, CF_CIDADES } = mod;

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

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
