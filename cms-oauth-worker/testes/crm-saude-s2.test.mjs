// Testa os 2 e-mails do guia "Mapa da saúde na França" (S2) montados pelo Worker para as 20 personas porta.ponto:
// o assunto, a seção, a astúcia (e o vencimento dela), a pergunta, o gancho do e-mail 2 e o plano B do lead antigo.
// Sem rede, sem Supabase, sem Brevo. Pessoas fictícias.
//
// Uso: node cms-oauth-worker/testes/crm-saude-s2.test.mjs   (Node 18+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as ES from '../../admin/crm/estudio.js';
import { D1, D2 } from '../../admin/crm/db/modelo-mapa-saude.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-saude-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmVarsSaude, crmVarsNovos, crmMontarNovo, SAUDE_PORTAS, SAUDE_PONTOS };\n');
const W = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });

let ok = 0, falhou = 0;
const check = (rotulo, cond) => { if (cond) ok++; else { falhou++; console.log('  FALHOU:', rotulo); } };

const tpl = (D, tipo) => { const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {}; const m = ES.montar(d, tipo); return { assunto: m.assunto, preheader: m.preheader, corpo_texto: m.corpo_texto, corpo_html: m.corpo_html }; };
const T1 = tpl(D1, 'servico'), T2 = tpl(D2, 'novidades');
const LINKS = { link_checklist: 'https://exemplo.notion.site/mapa?utm_source=email' };
const monta = (T, resp, agora) => {
  const vars = { ...W.crmVarsNovos({}, { nome: 'Ana Souza', email: 'ana@example.com', dados: { respostas: resp } }), ...LINKS };
  if (agora != null) Object.assign(vars, W.crmVarsSaude(resp, agora));
  return W.crmMontarNovo(T, vars);
};

const ASTUCIA = { 'estudante.nao_cheguei': 'ameli', 'estudante.sem_numero': 'ameli', 'trabalho.nao_cheguei': 'Puma', 'trabalho.sem_numero': 'Puma',
  'aupair.nao_cheguei': 'Urssaf', 'aupair.sem_numero': 'Urssaf', 'aupair.esperando': 'Urssaf' };
const SECAO = { estudante: 'seção Estudante', trabalho: 'seção Trabalho', aupair: 'seção Au pair', outro: 'tronco' };

console.log('== 20 personas, e-mail 1 e e-mail 2 ==');
for (const porta of W.SAUDE_PORTAS) for (const ponto of W.SAUDE_PONTOS) {
  const k = porta + '.' + ponto, r = { porta, ponto };
  let m1, m2;
  try { m1 = monta(T1, r); m2 = monta(T2, r); } catch (e) { check(k + ': monta sem erro (' + e.message + ')', false); continue; }
  const t1 = m1.texto, t2 = m2.texto;
  check(k + ': e-mail 1, assunto próprio da persona', m1.assunto.length > 10 && !/\{|\}/.test(m1.assunto) && m1.assunto === W.crmVarsSaude(r, Date.now()).assunto_persona);
  check(k + ': e-mail 1, título, nome e botões', /O mapa da saúde está no botão abaixo/.test(t1) && /Oi, Ana,/.test(t1) && m1.html.includes('https://exemplo.notion.site/mapa') && /Marcar uma conversa/.test(t1));
  check(k + ': e-mail 1, seção ou tronco certo', new RegExp(SECAO[porta]).test(t1));
  check(k + ': e-mail 1, astúcia só onde há fonte conferida', ASTUCIA[k] ? t1.includes('Astúcia da Equipe Por Dentro') && t1.includes(ASTUCIA[k]) : !t1.includes('Astúcia da Equipe'));
  check(k + ': e-mail 1, exatamente uma pergunta da porta', (t1.match(/Para eu orientar melhor/g) || []).length === 1);
  check(k + ': e-mail 2, assunto, nome, um gancho e o botão', m2.assunto.length > 5 && /Oi, Ana,/.test(t2) && (t2.match(/Passando para retomar/g) || []).length === 1 && /Marcar uma conversa/.test(t2));
  check(k + ': e-mail 2, o gancho segue a carte vitale', ponto === 'sem_vitale' ? /passo da carte vitale/.test(t2) : ponto === 'completo' ? /depois da carte vitale/.test(t2) : !/carte vitale\. Conto/.test(t2));
  // O traço sozinho numa linha é o separador do rodapé que o montador do estúdio põe: não faz parte do texto dela.
  const tudo = [m1.assunto, t1, m1.html, m2.assunto, t2, m2.html].join('\n').replace(/^—$/gm, '').replace(/>—</g, '><');
  check(k + ': sem chave solta, sem "você pode", sem travessão, sem "sempre", sem app beta', !/\{[#^\/]?\w+\}/.test(tudo) && !/voc[êe] (não )?pode/i.test(tudo) && !/[—–]/.test(tudo) && !/\bsempre\b/i.test(tudo) && !/beta|link_acesso/i.test(tudo));
  check(k + ': frase de proteção e assinatura nos dois', [t1, t2].every((t) => t.includes('Não sou advogada') && t.includes('Ingryd · Por Dentro')));
}

console.log('== Astúcia vence em 14/02/2027 ==');
const depois = Date.UTC(2027, 1, 15, 12);
const v = W.crmVarsSaude({ porta: 'trabalho', ponto: 'sem_numero' }, depois);
check('depois da revisão as 3 astúcias viram falsas', !v.astucia_a0007 && !v.astucia_a0008 && !v.astucia_a0009);
check('depois da revisão o e-mail 1 sai sem a caixa', !monta(T1, { porta: 'trabalho', ponto: 'sem_numero' }, depois).texto.includes('Astúcia da Equipe'));
check('no dia 14/02/2027 ainda vale', W.crmVarsSaude({ porta: 'trabalho', ponto: 'sem_numero' }, Date.UTC(2027, 1, 14, 20)).astucia_a0008 === true);

console.log('== Lead antigo e valores inválidos ==');
for (const [rot, r] of [['sem porta nem ponto', {}], ['valores fora da lista', { porta: 'admin', ponto: '<b>x</b>' }], ['porta ok, ponto inválido', { porta: 'trabalho', ponto: 'x' }]]) {
  let m1, m2; try { m1 = monta(T1, r); m2 = monta(T2, r); } catch (e) { check(rot + ': monta (' + e.message + ')', false); continue; }
  check(rot + ': e-mail 1 cai no plano B, sem chave solta', m1.assunto === 'O seu mapa da saúde na França, na ordem' && !/\{[#^\/]?\w+\}/.test(m1.texto));
  check(rot + ': e-mail 2 sai com o convite e sem gancho quebrado', /Marcar uma conversa/.test(m2.texto) && !/\{/.test(m2.texto));
}
check('sem porta o lead antigo vira "outro" (tronco e pergunta do visto)', /tronco/.test(monta(T1, {}).texto) && /qual é o seu visto/.test(monta(T1, {}).texto));
check('sem o link do mapa o envio é recusado (nunca sai com o botão quebrado)', (() => { try { W.crmMontarNovo(T1, W.crmVarsNovos({}, { nome: 'Ana', email: 'a@e.com', dados: { respostas: { porta: 'outro', ponto: 'completo' } } })); return false; } catch (e) { return /link_checklist/.test(e.message); } })());

console.log(`\n${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
