// Testa as variáveis que o Worker oferece aos e-mails da Rota da Sécu (saude_rota_1): um booleano por combinação porta.ponto
// (caso_<porta>_<ponto>), a reserva (caso_geral), o assunto por porta e o link de volta à página.
// Sem rede, sem Supabase, sem Brevo. Pessoas fictícias.
//
// Uso: node cms-oauth-worker/testes/crm-rota-da-secu.test.mjs   (Node 18+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as ES from '../../admin/crm/estudio.js';
import { D1 } from '../../admin/crm/db/modelo-rota-da-secu.mjs';
import { caso } from '../../guias/rota-da-secu/casos.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-rota-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8') + '\nexport { crmVarsRota, crmVarsNovos, crmMontarNovo, SAUDE_PORTAS, SAUDE_PONTOS };\n');
const W = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });

let ok = 0, falhou = 0;
const check = (rotulo, cond) => { if (cond) ok++; else { falhou++; console.log('  FALHOU:', rotulo); } };

console.log('== 20 combinações: exatamente um caso_<porta>_<ponto> ==');
for (const porta of W.SAUDE_PORTAS) for (const ponto of W.SAUDE_PONTOS) {
  const v = W.crmVarsRota({ porta, ponto }, 'saude_rota_1');
  const acesos = Object.keys(v).filter((k) => k.startsWith('caso_') && k !== 'caso_geral' && v[k] === true);
  check(porta + '.' + ponto + ': só o seu caso fica verdadeiro', acesos.length === 1 && acesos[0] === 'caso_' + porta + '_' + ponto && v.caso_geral === false);
  check(porta + '.' + ponto + ': há 20 variáveis caso_*', Object.keys(v).filter((k) => /^caso_[a-z]+_[a-z_]+$/.test(k)).length === 20);
}

console.log('== Reserva (lead antigo, valor fora da lista) ==');
for (const [rot, r] of [['resp vazio', {}], ['resp ausente', undefined], ['porta fora da lista', { porta: 'admin', ponto: 'esperando' }], ['ponto fora da lista', { porta: 'aupair', ponto: '<b>x</b>' }], ['só a porta', { porta: 'trabalho' }]]) {
  const v = W.crmVarsRota(r, 'saude_rota_1');
  check(rot + ': caso_geral verdadeiro e nenhum dos 20', v.caso_geral === true && Object.keys(v).filter((k) => /^caso_[a-z]+_[a-z_]+$/.test(k)).every((k) => v[k] === false));
}

console.log('== Assunto por porta ==');
const ass = W.SAUDE_PORTAS.map((p) => W.crmVarsRota({ porta: p, ponto: 'esperando' }, 'saude_rota_1').assunto_rota);
check('4 assuntos, todos diferentes, sem travessão, sem "mapa"', new Set(ass).size === 4 && ass.every((a) => a.length > 10 && !/[—–]/.test(a) && !/mapa/i.test(a) && /Sécu/.test(a)));
check('porta inválida: assunto vazio (o e-mail cai no assunto reserva)', W.crmVarsRota({ porta: 'x', ponto: 'esperando' }, 'saude_rota_1').assunto_rota === '');
check('ponto inválido com porta válida: o assunto por porta continua', W.crmVarsRota({ porta: 'aupair' }, 'saude_rota_1').assunto_rota === ass[2]);

console.log('== Link de volta à página ==');
const l = new URL(W.crmVarsRota({ porta: 'aupair', ponto: 'esperando' }, 'saude_rota_1').link_pagina);
check('link_pagina: https, domínio e caminho da página', l.protocol === 'https:' && l.hostname === 'imigrantepordentro.com' && l.pathname === '/guias/rota-da-secu/');
check('link_pagina: utm do e-mail e porta/ponto/aberto', l.searchParams.get('utm_source') === 'email' && l.searchParams.get('utm_medium') === 'email' && l.searchParams.get('utm_campaign') === 'rota-da-secu'
  && l.searchParams.get('utm_content') === 'saude_rota_1' && l.searchParams.get('porta') === 'aupair' && l.searchParams.get('ponto') === 'esperando' && l.searchParams.get('aberto') === '1');
const li = new URL(W.crmVarsRota({ porta: 'x', ponto: '"><script>' }, 'saude_rota_1').link_pagina);
check('porta/ponto inválidos não entram no link e não abrem o roteiro', !li.searchParams.has('porta') && !li.searchParams.has('ponto') && !li.searchParams.has('aberto') && !/script/.test(li.href));
check('modelo que não é da Rota não ganha link_pagina', !('link_pagina' in W.crmVarsRota({ porta: 'aupair', ponto: 'esperando' }, 'saude_mapa_1')));

console.log('== crmVarsNovos entrega as variáveis da Rota ==');
const vn = W.crmVarsNovos({}, { chave: 'saude_rota_1', nome: 'Ana Souza', email: 'ana@example.com', dados: { respostas: { porta: 'estudante', ponto: 'sem_numero' } } });
check('crmVarsNovos traz caso_estudante_sem_numero, assunto_rota e link_pagina', vn.caso_estudante_sem_numero === true && vn.assunto_rota.includes('estudante') && /utm_content=saude_rota_1/.test(vn.link_pagina));
check('as variáveis do Mapa continuam (porta_estudante, ponto_sem_numero)', vn.porta_estudante === true && vn.ponto_sem_numero === true);

console.log('== O e-mail 1 montado pelo Worker (as 20 combinações) ==');
const tpl = (() => { const d = JSON.parse(JSON.stringify(D1)); d.v = 1; d.planos = d.planos || {}; const m = ES.montar(d, 'servico'); return { assunto: m.assunto, preheader: m.preheader, corpo_texto: m.corpo_texto, corpo_html: m.corpo_html }; })();
const monta = (resp) => W.crmMontarNovo(tpl, W.crmVarsNovos({}, { chave: 'saude_rota_1', nome: 'Ana Souza', email: 'ana@example.com', dados: { respostas: resp } }));
const OFICIAL = 'service-public.gouv.fr/particuliers/vosdroits/R45084';
const corte = (t) => t.split(/\n—\n/)[0];
for (const porta of W.SAUDE_PORTAS) for (const ponto of W.SAUDE_PONTOS) {
  const k = porta + '.' + ponto, c = caso(porta, ponto);
  let m; try { m = monta({ porta, ponto }); } catch (e) { check(k + ': monta sem erro (' + e.message + ')', false); continue; }
  const t = corte(m.texto);
  check(k + ': o assunto é o da porta, sem chave solta', m.assunto.includes('Sécu') && !/[{}]/.test(m.assunto));
  check(k + ': saudação e depois o lembrete do link oficial, antes do roteiro', /Oi, Ana,/.test(t) && t.indexOf(OFICIAL) > t.indexOf('Oi, Ana,') && t.indexOf(OFICIAL) < t.indexOf(c.primeiro));
  check(k + ': traz o primeiro passo e todos os passos do caso, iguais aos da página', t.includes(c.primeiro) && c.passos.every((s) => t.includes(s.x)));
  const outros = W.SAUDE_PORTAS.flatMap((a) => W.SAUDE_PONTOS.map((b) => [a, b])).filter(([a, b]) => !(a === porta && b === ponto));
  check(k + ': não traz o primeiro passo de nenhum outro caso', outros.every(([a, b]) => { const o = caso(a, b).primeiro; return o === c.primeiro || !t.includes(o); }));
  check(k + ': o botão volta à página aberta no caso dela', m.html.includes('/guias/rota-da-secu/?') && m.html.includes('porta=' + porta) && m.html.includes('ponto=' + ponto) && m.html.includes('aberto=1'));
  check(k + ': a oferta, uma só pergunta e a proteção', t.includes('Prefere ter alguém com você?') && (t.match(/Para eu entender melhor/g) || []).length === 1 && t.includes('Não sou advogada'));
  check(k + ': sem chave solta, sem [colchetes], sem travessão no corpo', !/\{[#^\/]?\w+\}/.test(m.texto + m.html) && !/[\[\]]/.test(m.texto) && !/[—–]/.test(t));
}

console.log('== Lead antigo: a reserva, nunca um e-mail em branco ==');
for (const [rot, r] of [['sem porta nem ponto', {}], ['valores fora da lista', { porta: 'admin', ponto: '<b>x</b>' }], ['só a porta', { porta: 'trabalho' }], ['sem respostas', undefined]]) {
  let m; try { m = monta(r); } catch (e) { check(rot + ': monta (' + e.message + ')', false); continue; }
  const t = corte(m.texto);
  check(rot + ': assunto reserva, lembrete, botão e oferta', (m.assunto === 'Seu roteiro da Sécu, na ordem' || m.assunto.includes('Sécu')) && t.includes(OFICIAL) && t.includes('abra a página e responda as duas perguntas') && /\/guias\/rota-da-secu\/\?/.test(m.html) && t.includes('Prefere ter alguém com você?'));
  check(rot + ': nenhum passo de caso entra, e a página não abre o roteiro sozinha', !/Primeiro passo|Roteiro de ligação|Faça isto antes de chegar/.test(t) && !m.html.includes('aberto=1'));
}
check('sem o link da página o envio é recusado (nunca sai com o botão quebrado)', (() => { try { W.crmMontarNovo(tpl, W.crmVarsNovos({}, { chave: 'saude_mapa_1', nome: 'Ana', email: 'a@e.com', dados: { respostas: { porta: 'aupair', ponto: 'esperando' } } })); return false; } catch (e) { return /link_pagina/.test(e.message); } })());

console.log('== O Estúdio (prévia e "Enviar teste para mim") entrega as variáveis da Rota ==');
// O envio de teste manda ao Worker os dados que o painel calcula (dadosDe); o Worker aceita no máximo 40 (crmVarsDoPainel).
const H = { pn: (c) => String(c.nome || '').split(' ')[0], persona: () => '', fmtDay: (d) => d, appLink: 'https://app.exemplo', calLink: 'https://cal.exemplo', };
const MOD = { chave: 'saude_rota_1', criado_no_estudio: true, para_quem: { materiais: ['guia-rota-da-secu'] } };
for (const porta of W.SAUDE_PORTAS) for (const ponto of W.SAUDE_PONTOS) {
  const c = { nome: 'Ana Souza', email: 'ana@example.com', respostas: { porta, ponto } };
  const dados = ES.dadosDe('saude_rota_1', c, H, MOD), esperado = W.crmVarsRota({ porta, ponto }, 'saude_rota_1');
  check(porta + '.' + ponto + ': dadosDe traz as variáveis da Rota iguais às do Worker', Object.keys(esperado).every((k) => dados[k] === esperado[k]));
  check(porta + '.' + ponto + ': dadosDe traz nome, e-mail e as 4 portas, em no máximo 40 dados', dados.nome === 'Ana' && dados.email === 'ana@example.com' && W.SAUDE_PORTAS.every((x) => dados['porta_' + x] === (x === porta)) && Object.keys(dados).length <= 40);
  let m; try { m = W.crmMontarNovo(tpl, dados); } catch (e) { check(porta + '.' + ponto + ': o teste do Estúdio monta (' + e.message + ')', false); continue; }
  check(porta + '.' + ponto + ': o teste do Estúdio sai com o roteiro do caso e o botão', m.texto.includes(caso(porta, ponto).primeiro) && m.html.includes('/guias/rota-da-secu/?'));
}
const dSem = ES.dadosDe('saude_rota_1', { nome: 'Ana', email: 'a@e.com', respostas: {} }, H, MOD);
check('prévia sem porta/ponto: acende só a reserva e o teste ainda monta', dSem.caso_geral === true && !!W.crmMontarNovo(tpl, dSem).texto);

console.log(`\n${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
