// Testa os passos propostos pela montagem na sessão Checklist da Plataforma (démarche, subitens, origem), no crm.js de verdade com Supabase de mentira.
// Dados inventados. Uso: cd admin/crm/db/testes && node crm-passos-propostos-ui.test.mjs
import * as MT from '../../montagem.js';
import * as FH from '../../ficha-html.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = { esc, rotulo: (d) => ({ banco: 'Banco', estudos: 'Universidade' }[d] || d), prazo: (a) => (a.prazo ? a.prazo.slice(8, 10) + '/' + a.prazo.slice(5, 7) : ''), pil: (t, c) => '<span class="pill ' + (c || '') + '">' + esc(t) + '</span>',
  btn: (a, id, r) => '<button data-caso="' + a + '" data-id="' + id + '">' + esc(r) + '</button>', conferi: (id) => '<button data-montconferido="' + id + '">Conferi a fonte</button>', linha: (e, m, b) => '<div class="linha">' + e + m + b + '</div>' };
const ACO = [
  { id: 1, titulo: 'Abrir conta em banco francês', dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: null, a_conferir: false, origem_chave: 'chk:l:banco', lista_chave: 'l', camada: 'particular', demarche: 'banco', subitens: ['Reunir comprovante', 'Pedir o RIB'], prazo: '2026-11-30' },
  { id: 2, titulo: 'Ligar para a escola', dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: null, a_conferir: true, origem_chave: 'chk:l:ligar', lista_chave: 'l', camada: 'persona', demarche: 'estudos', subitens: [] },
  { id: 3, titulo: 'Passo publicado', dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: '2026-11-10T10:00:00Z', a_conferir: false, origem_chave: 'enc:x', demarche: null, subitens: null },
  { id: 4, titulo: 'Tarefa só da equipe', dono: 'ingryd', canal: 'so_eu', estado: 'aberta', origem_chave: 'enc:y' },
  { id: 5, titulo: 'Passo antigo sem montagem', dono: 'ela', canal: 'plataforma', estado: 'aberta', origem_chave: null }];

console.log('== passosPropostosHtml ==');
{
  const h = MT.passosPropostosHtml(ACO, [{ chave: 'l', titulo: 'Do PVT à faculdade' }], H);
  check('mostra só os passos dela vindos da montagem (não a tarefa da equipe nem o passo antigo)', h.includes('Abrir conta em banco francês') && h.includes('Ligar para a escola') && h.includes('Passo publicado') && !h.includes('Tarefa só da equipe') && !h.includes('Passo antigo'));
  check('o detalhe segue o do Checklist: démarche, subitens, de onde vem, prazo e lista', h.includes('Banco · 2 subitens · só deste percurso · 30/11 · lista &quot;Do PVT à faculdade&quot;') || h.includes('Banco · 2 subitens · só deste percurso · 30/11 · lista "Do PVT à faculdade"'));
  check('os subitens aparecem em lista', h.includes('<li>Reunir comprovante</li>') && h.includes('<li>Pedir o RIB</li>'));
  check('passo da persona diz "da persona"; sem démarche diz "Sem démarche"', h.includes('Universidade · da persona') && h.includes('Sem démarche · só deste percurso'));
  check('estado em palavras: Rascunho, A conferir, Publicado', h.includes('Rascunho') && h.includes('A conferir') && h.includes('Publicado'));
  check('cada linha tem uma ação: rascunho "Publicar para ela"; a conferir "Conferi a fonte" (não publica); publicado "Retirar"', /data-caso="aco-pub" data-id="1"/.test(h) && !/data-caso="aco-pub" data-id="2"/.test(h) && /data-montconferido="2"/.test(h) && /data-caso="aco-retirar" data-id="3"/.test(h));
  check('concluído não tem botão', !/data-id="9"|data-montconferido="9"/.test(MT.passosPropostosHtml([{ id: 9, titulo: 'Feito', dono: 'ela', canal: 'plataforma', estado: 'concluida', origem_chave: 'enc:f' }], [], H).replace(/<div class="linha">.*?<\/div>/s, '')) && !/<button/.test(MT.passosPropostosHtml([{ id: 9, titulo: 'Feito', dono: 'ela', canal: 'plataforma', estado: 'concluida', origem_chave: 'enc:f' }], [], H)));
  check('o passo a conferir explica por que não vai para ela', h.includes('Falta conferir a fonte'));
  check('nada de NaN/undefined e vazio devolve texto vazio', !/NaN|undefined/.test(h) && MT.passosPropostosHtml([], [], H) === '' && MT.passosPropostosHtml(null, null, H) === '');
  check('o título escapa HTML', MT.passosPropostosHtml([{ id: 9, titulo: '<img src=x>', dono: 'ela', canal: 'plataforma', origem_chave: 'enc:z' }], [], H).indexOf('<img') < 0);
}

console.log('== Na sessão Checklist do CRM ==');
{
  const respostas = { caso_acoes: { data: ACO, error: null }, caso_listas: { data: [{ chave: 'l', titulo: 'Do PVT à faculdade' }], error: null }, caso_achados: { data: [], error: null }, board_itens: { data: [], error: null }, caso_avisos: { data: [], error: null }, consentimentos: { data: [], error: null }, escolas_dela: { data: [], error: null } };
  const h = await carregarCrm({ respostas, expor: ['carregaCaso', 'fxChecklistCorpo'] });
  const c = pessoa({ id: 'p1', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1';
  h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await h.mod.carregaCaso('p1');
  const html = h.mod.fxChecklistCorpo(c);
  check('sem conta no app, o Checklist já mostra os passos propostos, com démarche e subitens', html.includes('Passos propostos para ela') && html.includes('Abrir conta em banco francês') && html.includes('Reunir comprovante'));
  check('a démarche aparece com os subitens (o rótulo bonito vem do catálogo, carregado no navegador)', /banco · 2 subitens/i.test(html));
  const sem = await carregarCrm({ respostas: { ...respostas, caso_acoes: { data: [], error: null } }, expor: ['carregaCaso', 'fxChecklistCorpo'] });
  sem.mod.setC([c]); sem.mod.state.sel = 'p1'; sem.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await sem.mod.carregaCaso('p1');
  check('sem passos da montagem, a seção não aparece', !sem.mod.fxChecklistCorpo(c).includes('Passos propostos para ela'));
}

console.log('== "Só eu": só o que é para você, sem publicar para ela ==');
{
  const respostas = { caso_acoes: { data: [...ACO, { id: 6, titulo: 'Enviar o guia de escolas', dono: 'ingryd', canal: 'so_eu', estado: 'aberta', publicada_em: null, origem_chave: 'enc:guia' }], error: null }, caso_listas: { data: [], error: null }, caso_achados: { data: [], error: null }, board_itens: { data: [], error: null }, caso_avisos: { data: [], error: null }, consentimentos: { data: [], error: null }, escolas_dela: { data: [], error: null } };
  const h = await carregarCrm({ respostas, expor: ['carregaCaso', 'fxEuCorpo'] });
  const c = pessoa({ id: 'p1', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1';
  await h.mod.carregaCaso('p1');
  const html = h.mod.fxEuCorpo(c);
  check('"Só eu" mostra as tarefas da equipe', html.includes('Enviar o guia de escolas') && html.includes('Tarefa só da equipe'));
  check('"Só eu" NÃO mostra os passos dela nem nenhum botão de publicar para ela', !html.includes('Abrir conta em banco francês') && !html.includes('Passos para ela') && !/aco-pub|Publicar para ela/.test(html));
}

console.log('== A prévia do app mostra o Checklist sendo montado ==');
{
  const respostas = { caso_acoes: { data: ACO, error: null }, caso_listas: { data: [], error: null }, caso_achados: { data: [], error: null }, board_itens: { data: [], error: null }, caso_avisos: { data: [], error: null }, consentimentos: { data: [], error: null }, escolas_dela: { data: [], error: null } };
  const h = await carregarCrm({ respostas, expor: ['carregaCaso', 'fxPreviaDados'] });
  const c = pessoa({ id: 'p1', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1';
  h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await h.mod.carregaCaso('p1');
  const d = h.mod.fxPreviaDados(c);
  check('o passo publicado já conta como passo dela na prévia (1 de 1 aberto, 0 feitos)', d.total === 1 && d.feitos === 0 && d.passos.length === 1 && d.passos[0].label === 'Passo publicado');
  check('os rascunhos aparecem à parte, com "a conferir" marcado', d.rascunhos.length === 2 && d.rascunhos.find((x) => x.label === 'Ligar para a escola').conferir === true && d.rascunhos.find((x) => x.label === 'Abrir conta em banco francês').conferir === false);
  check('o rascunho traz démarche e subitens no detalhe', /banco · 2 subitens/i.test(d.rascunhos.find((x) => x.label === 'Abrir conta em banco francês').tag));
  check('a tarefa da equipe e o passo antigo não entram na prévia', !d.rascunhos.concat(d.passos).some((x) => /Tarefa só da equipe|Passo antigo/.test(x.label)));
}

console.log('== O celular de prévia (HTML) ==');
{
  const base = { nome: 'Marina', semConta: true, aba: 'checklist', dia: 1, camadas: false, pct: 0, feitos: 0, total: 1, naoLidas: 0, marco: null, prox: null, avisos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] },
    passos: [{ label: 'Passo publicado', tag: 'Banco · 1 subitem', feito: false, due: null, atrasado: false }], rascunhos: [{ label: 'Ligar para a escola', tag: 'Universidade', conferir: true, due: null }, { label: 'Abrir conta', tag: '', conferir: false, due: '2026-11-30' }] };
  const html = FH.htmlPreviaApp(base, { esc, fmtDay: (x) => x });
  check('a prévia mostra o passo publicado e os rascunhos esmaecidos, com a explicação', html.includes('Passo publicado') && html.includes('Rascunho: só você vê') && (html.match(/fx-pv-row rasc/g) || []).length === 2);
  check('o rascunho a conferir diz "A conferir" e o outro "Rascunho"', html.includes('A conferir · Universidade') && html.includes('>Rascunho<'));
  check('sem conta mas com passos, não diz que "nasce no primeiro acesso": diz que é a prévia', !html.includes('nasce no primeiro acesso') && html.includes('Prévia do que ela verá ao entrar'));
  const vazio = FH.htmlPreviaApp({ ...base, passos: [], rascunhos: [], total: 0 }, { esc, fmtDay: (x) => x });
  check('sem nada, continua o texto de "nasce no primeiro acesso"', vazio.includes('nasce no primeiro acesso') && !vazio.includes('Rascunho: só você vê'));
  check('escapa HTML no título', !FH.htmlPreviaApp({ ...base, rascunhos: [{ label: '<img src=x>', tag: '', conferir: false }] }, { esc, fmtDay: (x) => x }).includes('<img'));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
