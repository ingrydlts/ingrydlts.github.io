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

console.log('\n== Identidade visual do Por Dentro (a mesma dos outros e-mails do CRM) ==');
instalar();
res = await post({ ...base, anexos: [] }); j = await res.json();
const H = j.html;
check('marca "Por Dentro" em serifa no topo, com o marrom da identidade', /Por <span style="color:#604034;">Dentro<\/span>/.test(H) && /Fraunces/.test(H));
check('fundo off-white, cartão claro com borda e cantos arredondados', /background:#F4F1EC/.test(H) && /background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px/.test(H));
check('foto da Ingryd com a moldura bege, e a saudação ao lado', /<img src="https:\/\/imigrantepordentro\.com\/images\/uploads\/foto-de-perfil\.jpg"[^>]*border:2px solid #DEB975/.test(H) && />Olá, Ana!</.test(H));
check('o código fica num quadro bege, em serifa verde moss', /border:1px solid #DEB975[\s\S]*font-size:26px; font-weight:700; color:#577328[^>]*>LISTA-ESPERA25</.test(H));
check('número das seções em verde moss; assinatura em itálico serifado', (H.match(/color:#577328;">\d<\/span> ·/g) || []).length === 4 && /font-style:italic[^>]*>Ingryd · Por Dentro</.test(H));
check('rodapé com a opção de sair, no HTML e no texto', /palavra &quot;sair&quot;/.test(H) && /palavra "sair"/.test(j.texto));
check('compatível com e-mail: tabelas, sem script, título e idioma', /<table role="presentation"/.test(H) && !/<script/i.test(H) && /<html lang="pt-BR">/.test(H) && /<title>Ana, o bilan/.test(H));

console.log('\n== Anexos ==');
const b64 = (u8) => Buffer.from(u8).toString('base64');
const pdf = (n = 100) => { const u = new Uint8Array(n); u.set(Buffer.from('%PDF-1.7\n')); return u; };
const png = () => { const u = new Uint8Array(60); u.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return u; };
const jpg = () => { const u = new Uint8Array(60); u.set([0xff, 0xd8, 0xff, 0xe0]); return u; };
const ax = (name, u8) => ({ name, b64: b64(u8) });
instalar();
res = await post({ ...base, anexos: [{ name: 'escolas-de-FLE.pdf', size: 245760 }, { name: 'percurso.png', size: 3000 }] }); j = await res.json();
check('prévia só precisa do nome e do tamanho (não manda o arquivo) e não envia nada', res.status === 200 && j.enviado === false && j.anexos === 2 && brevoCalls().length === 0);
check('a prévia mostra "Em anexo" com os nomes e tamanhos, no HTML e no texto', /Em anexo: escolas-de-FLE\.pdf \(240 KB\), percurso\.png \(3 KB\)/.test(j.texto) && /<b[^>]*>Em anexo:<\/b> escolas-de-FLE\.pdf \(240 KB\), percurso\.png/.test(j.html));
instalar();
res = await post({ ...base, enviar: true, confirmo: true, anexos: [ax('PDF das escolas.pdf', pdf(500)), ax('percurso.PNG', png()), ax('foto.jpeg', jpg())] }); j = await res.json();
let bb = brevoCalls()[0];
check('envio com 3 anexos: 200 e o Brevo recebe os 3, com nome e conteúdo em base64', res.status === 200 && j.anexos === 3 && bb.body.attachment.length === 3 && bb.body.attachment[0].name === 'PDF das escolas.pdf' && bb.body.attachment[0].content === b64(pdf(500)) && bb.body.attachment[1].name === 'percurso.PNG');
check('o e-mail diz o que vai em anexo e isso fica registrado na ficha', /Em anexo: PDF das escolas\.pdf \(1 KB\), percurso\.PNG/.test(bb.body.textContent) && /Em anexo:/.test(chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST').body.corpo));
check('o arquivo não é guardado: o registro na ficha não leva o conteúdo', !JSON.stringify(chamadas.find((c) => /emails_enviados$/.test(c.url) && c.method === 'POST').body).includes(b64(pdf(500))));
check('os logs não trazem nome nem conteúdo do anexo', logs.every((l) => !/escolas|percurso|JVBER/.test(l)));
instalar();
await post({ ...base, enviar: true, confirmo: true });
check('sem anexo, o Brevo não recebe o campo "attachment"', !('attachment' in brevoCalls()[0].body));
const anexoRuim = async (rot, anexos, trecho, enviar = true) => {
  instalar(); res = await post({ ...base, enviar, confirmo: true, anexos }); j = await res.json();
  check(rot + ' → 400 anexo_invalido, nada enviado', res.status === 400 && j.codigo === 'anexo_invalido' && trecho.test(j.error) && brevoCalls().length === 0);
};
await anexoRuim('mais de 5 anexos', Array.from({ length: 6 }, (_, i) => ax('a' + i + '.pdf', pdf())), /No máximo 5/);
await anexoRuim('executável', [ax('virus.exe', pdf())], /não é PDF, JPG ou PNG/);
await anexoRuim('Word', [ax('carta.docx', pdf())], /não é PDF, JPG ou PNG/);
await anexoRuim('sem extensão', [ax('arquivo', pdf())], /extensão/);
await anexoRuim('extensão .pdf, mas o conteúdo é PNG', [ax('falso.pdf', png())], /não parece ser um PDF de verdade/);
await anexoRuim('extensão .png, mas o conteúdo é texto', [{ name: 'x.png', b64: Buffer.from('<html>oi</html>').toString('base64') }], /não parece ser um PNG de verdade/);
await anexoRuim('envio sem o conteúdo do arquivo', [{ name: 'a.pdf', size: 10 }], /vazio ou corrompido/);
await anexoRuim('base64 corrompido', [{ name: 'a.pdf', b64: '%%%não-é-base64%%%' }], /vazio ou corrompido/);
await anexoRuim('mais de 3 MB no total', [ax('a.pdf', pdf(2 * 1024 * 1024)), ax('b.pdf', pdf(2 * 1024 * 1024))], /passam de 3,0 MB/);
await anexoRuim('um só arquivo grande demais', [ax('a.pdf', pdf(3 * 1024 * 1024 + 10))], /passam de 3,0 MB/);
await anexoRuim('na prévia, o tamanho declarado também conta', [{ name: 'a.pdf', size: 4 * 1024 * 1024 }], /passam de 3,0 MB/, false);
await anexoRuim('anexos que não são lista', 'a.pdf', /No máximo 5/);
await anexoRuim('item que não é objeto', ['a.pdf'], /formato inválido/);
instalar();
res = await post({ ...base, anexos: [{ name: '../../etc/<img src=x onerror=alert(1)>\u0000relatório.pdf', size: 2048 }] }); j = await res.json();
check('caminho, < >, aspas e caracteres de controle somem do nome (fica só o nome do arquivo)', res.status === 200 && /Em anexo: img src=x onerror=alert\(1\) ?relatório\.pdf \(2 KB\)/.test(j.texto) && !/\.\.\/|etc\//.test(j.html + j.texto) && !/<img src=x/.test(j.html) && !/\u0000/.test(j.texto));
instalar();
res = await post({ ...base, anexos: [{ name: 'x&y "z".pdf', size: 2048 }] }); j = await res.json();
check('o "&" do nome é escapado no HTML e as aspas são tiradas', /x&amp;y z\.pdf/.test(j.html) && !/"z"/.test(j.texto));
instalar();
res = await post({ ...base, enviar: true, confirmo: true, anexos: [ax('ok.pdf', pdf())] }, { ...env, BREVO_API_KEY: undefined });
check('sem Brevo configurado nada sai, mesmo com anexo', res.status === 500);

console.error = origErr;
console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
