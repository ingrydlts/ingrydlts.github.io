// O Início e o Espaço da prévia do CRM têm de ser os do app. Dados inventados.
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<app>/db node ficha-inicio-app.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as FX from '../../ficha.js';
import * as FH from '../../ficha-html.js';
import { extrairQuando } from '../../gerar-guias-quando.mjs';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db'), '..');
const AGORA = new Date(2026, 10, 17, 12).getTime();
const mapa = { ordem: ['visa_aupair', 'visa', 'estudos'], definicoes: { visa_aupair: { label: 'Visa au pair' }, visa: { label: 'Visa' }, estudos: { label: 'Estudos' } },
  porItem: { a1: 'visa_aupair', a2: 'visa_aupair' }, porCategoria: { Licence: 'estudos' }, titulos: { au_pair_estudante: { visa_aupair: 'Visa au pair: o status de hoje' } } };
const it = (k, cat, st, due) => ({ step_key: k, category: cat, label: 'L ' + k, status: st, due_date: due || null });
const ac = (id, titulo, extra) => Object.assign({ id, n: id, titulo, dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: '2026-11-10', lista_chave: null, prazo: null, prazo_texto: '', botao: null, passo_chave: 'p' + id }, extra || {});

console.log('== Início: o "Agora" e o "Em seguida" ==');
{
  const acoes = [ac(1, 'Sem data'), ac(2, 'Com data', { prazo: '2026-12-01' }), ac(3, 'Atrasado', { prazo: '2026-11-10' }), ac(4, 'Pronto', { estado: 'concluida' }), ac(5, 'Dentro da ligação', { prazo_texto: 'na mesma ligação' })];
  const itens = [it('a1', 'Visto', 'pendente'), it('a2', 'Visto', 'concluido'), it('c1', 'Licence', 'pendente', '2026-12-20'), it('c2', 'Licence', 'pendente'), it('c3', 'Licence', 'pendente', '2026-12-05'), it('x', 'Licence', 'arquivado')];
  const r = FX.inicioDoApp({ nome: 'Letícia', mapa, persona: 'au_pair_estudante', itens, board: [{ tipo: 'escola', titulo: 'DU Aix' }, { tipo: 'bilan', titulo: 'B' }], acoes, listas: [], quando: { c2: 'Antes de se candidatar · mais texto', c1: 'Texto muito longo que não cabe na pílula de vinte e duas letras' }, agora: AGORA });
  check('é Início pessoal (tem caso)', r.pessoal === true && r.nome === 'Letícia' && r.escolas.join() === 'DU Aix');
  check('"Agora" = o atrasado primeiro, com o rótulo "Atrasado" e os dias em atraso', r.foco.rotulo === 'Atrasado' && r.foco.titulo === 'Atrasado' && /7 dias em atraso/.test(r.foco.quando) && r.foco.botao === 'Feito');
  check('"Em seguida": passos da equipe (com data, sem data) antes dos gerais; o absorvido e o concluído não entram', r.seguintes[0].titulo === 'Com data' && r.seguintes[1].titulo === 'Sem data' && !r.seguintes.some((q) => /Dentro|Pronto/.test(q.titulo)));
  check('"Em seguida" tem no máximo 4', r.seguintes.length === 4);
  check('os gerais completam: abertos, por data, o título do processo da aba principal', r.seguintes[2].titulo === 'L c3' && r.seguintes[2].meta === '05/12' && r.seguintes[2].de === 'Visa au pair: o status de hoje' && r.seguintes[3].titulo === 'L c1');
  check('Só seu: sem escolha da Ingryd, o bilan da conversa segue como atalho; escola e mensagem pronta não são mais atalhos', r.soSeu.atalhoBilan === true && r.soSeu.docs.length === 0 && r.soSeu.bilans.length === 0 && r.atalhos === undefined);
  const sem = FX.inicioDoApp({ mapa, persona: 'au_pair_estudante', itens, board: [], acoes: [ac(1, 'A')], listas: [], agora: AGORA });
  check('sem nenhum passo além do foco, sem "Em seguida" da equipe, só os gerais', sem.foco.titulo === 'A' && sem.seguintes.every((q) => /^L /.test(q.titulo)));
  const vazio = FX.inicioDoApp({ mapa, persona: 'au_pair_estudante', itens, board: [], acoes: [], listas: [], agora: AGORA });
  check('sem board nem passos: Início genérico (pessoal falso) e sem "Agora"', vazio.pessoal === false && vazio.foco === null && vazio.seguintes.length === 0);
  check('pílula do "quando": a parte curta; longa demais não vira pílula', FX.pilulaDoQuando('Antes de se candidatar · x') === 'Antes de se candidatar' && FX.pilulaDoQuando('Texto muito longo que não cabe na pílula') === '');
  const m = FX.inicioDoApp({ mapa, persona: 'x', itens: [], board: [{ tipo: 'marco', titulo: 'Inscrição', dados: { data: '2026-11-30' } }], acoes: [], listas: [], agora: AGORA });
  check('prazo (marco com data): dias que faltam', m.marcos[0].dias === 13 && m.marcos[0].quando === 'faltam 13 dias' && m.marcos[0].data === '30/11/2026');
  check('passo de data e de documentos têm o botão do app', FX.inicioDoApp({ mapa, persona: 'x', itens: [], board: [], acoes: [ac(1, 'D', { botao: 'marcar_marco' })], listas: [], agora: AGORA }).foco.botao === 'Informar a data' && FX.inicioDoApp({ mapa, persona: 'x', itens: [], board: [], acoes: [ac(1, 'Docs', { botao: 'conferir_documentos', passo_chave: 'docs:tr' })], listas: [], agora: AGORA }).foco.botao === 'Ver os documentos');
  const h = { esc: (x) => String(x), fmtDay: (x) => x };
  const html = FH.htmlPreviaApp({ nome: 'Letícia', semConta: true, aba: 'inicio', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: r, esp: FX.espacoDoApp({ board: [] }) }, h);
  check('a prévia do Início mostra "Oi, Letícia.", Agora, Em seguida e Só seu — e não o cartão "Hoje"', /Oi, Letícia\./.test(html) && /Agora|Atrasado/.test(html) && /Em seguida/.test(html) && /Só seu/.test(html) && !/>Hoje</.test(html));
  const gen = FH.htmlPreviaApp({ nome: 'L', semConta: true, aba: 'inicio', dia: 1, camadas: false, pct: 11, feitos: 1, total: 9, naoLidas: 0, marco: null, prox: { label: 'X', due: null }, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: vazio, esp: FX.espacoDoApp({ board: [] }) }, h);
  check('sem caso, a prévia cai no Início genérico, como o app', />Hoje</.test(gen) && /Próximo passo/.test(gen));
}

console.log('\n== Espaço: a pergunta da equipe e o material ==');
{
  const board = [{ id: 1, tipo: 'documento', titulo: 'Guia PDF', resumo: 'r', dados: { direcao: 'recebe' }, arquivo_caminho: 'c/a.pdf' }, { id: 2, tipo: 'documento', titulo: 'Sem nada', dados: { direcao: 'recebe' } },
    { id: 3, tipo: 'documento', titulo: 'Modelo de e-mail', descricao: 'Bonjour…', dados: { direcao: 'recebe' } }, { id: 4, tipo: 'documento', titulo: 'Reúne', dados: {} }, { id: 5, tipo: 'modelo', titulo: 'Msg' },
    { id: 6, tipo: 'marco', titulo: 'Fecha', dados: { data: '2026-11-30' } }];
  const avisos = [{ tipo: 'pergunta', titulo: 'Quando você chega?', estado: 'liberado' }, { tipo: 'pergunta', titulo: 'Já respondi', estado: 'respondido' }, { tipo: 'inteligencia', titulo: 'A inscrição fecha em 13 dias', estado: 'liberado' }, { tipo: 'inteligencia', titulo: 'Vale olhar o OFII', estado: 'lido' }];
  const e = FX.espacoDoApp({ board, avisos, escolasDela: [{ nome: 'Escola dela' }], agora: AGORA });
  check('perguntas: só as abertas', e.perguntas.map((a) => a.titulo).join() === 'Quando você chega?');
  check('"o que a equipe percebeu" não repete o prazo', e.percebeu.map((a) => a.titulo).join() === 'Vale olhar o OFII');
  check('"Encaminhamentos da Ingryd": só os que ela recebe; com conteúdo primeiro; o sem arquivo por último', e.docs.map((d) => d.titulo).join() === 'Guia PDF,Modelo de e-mail,Sem nada' && e.docs[0].conteudo === 'arquivo' && e.docs[2].conteudo === '' && e.docs.filter((d) => d.novo).length === 2);
  check('mensagens prontas e escolas dela', e.mensagens.length === 1 && e.dela[0].nome === 'Escola dela' && e.vazio === false);
  check('sem nada: vazio', FX.espacoDoApp({ board: [], avisos: [] }).vazio === true);
  const h = { esc: (x) => String(x), fmtDay: (x) => x };
  const html = FH.htmlPreviaApp({ nome: 'Letícia', semConta: false, aba: 'espaco', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: { pessoal: false }, esp: e }, h);
  check('a prévia do Espaço: Materiais pro seu caso, a pergunta da equipe, Encaminhamentos da Ingryd (2 novos) — sem os "Em breve" de mentira', /Materiais pro seu caso/.test(html) && /Pergunta da equipe/.test(html) && /Encaminhamentos da Ingryd · 2 novos/.test(html) && /chega em breve/.test(html) && !/Em breve/.test(html));
  const vz = FH.htmlPreviaApp({ nome: 'L', semConta: true, aba: 'espaco', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: { pessoal: false }, esp: FX.espacoDoApp({ board: [] }) }, h);
  check('Espaço vazio: "Seu espaço ainda está sendo preparado."', /Seu espaço ainda está sendo preparado/.test(vz));
}

console.log('\n== A cópia do "quando" dos passos não pode ficar velha ==');
{
  let t = null; try { t = JSON.parse(readFileSync(path.join(APP, 'content/checklist-templates.json'), 'utf8')); } catch (e) { /* sem o app ao lado */ }
  const copia = JSON.parse(readFileSync(path.resolve(HERE, '../../guias-quando.json'), 'utf8'));
  if (t) check('guias-quando.json = o do template do app (rode: node admin/crm/gerar-guias-quando.mjs <app>)', JSON.stringify(extrairQuando(t)) === JSON.stringify(copia));
  else console.log('  (app não encontrado em ' + APP + ': conferência da cópia pulada)');
}
console.log('\n== Em seguida: o passo do checklist fixado no CRM vai primeiro ==');
{
  const itens = [it('c1', 'Licence', 'pendente', '2026-12-20'), it('c2', 'Licence', 'pendente'), it('c3', 'Licence', 'concluido')];
  const r = FX.inicioDoApp({ nome: 'L', mapa, persona: 'au_pair_estudante', itens, board: [], acoes: [], listas: [], home: [{ id: 1, categoria: 'checklist', step_key: 'c2', ordem: 0 }, { id: 2, categoria: 'checklist', step_key: 'c3', ordem: 1 }], agora: AGORA });
  check('o fixado abre a fila do "Em seguida" (mesmo sem passo da equipe)', r.seguintes[0] && r.seguintes[0].titulo === 'L c2');
  check('o fixado que ela já concluiu não entra; o mesmo título não se repete (fixado e do checklist geral)', !r.seguintes.some((q) => q.titulo === 'L c3') && r.seguintes.filter((q) => q.titulo === 'L c2').length === 1);
  const sem = FX.inicioDoApp({ nome: 'L', mapa, persona: 'au_pair_estudante', itens, board: [], acoes: [], listas: [], home: [], agora: AGORA });
  check('sem passo da equipe nem fixado, o "Em seguida" fica vazio, como no app', sem.seguintes.length === 0);
}
console.log(bad ? `\n${bad} falhou, ${ok} ok` : `\nok: ${ok} verificações`); process.exit(bad ? 1 : 0);
