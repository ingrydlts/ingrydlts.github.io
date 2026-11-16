// Testa os passos propostos pela montagem na sessão Checklist da Plataforma (démarche, subitens, origem), no crm.js de verdade com Supabase de mentira.
// Dados inventados. Uso: cd admin/crm/db/testes && node crm-passos-propostos-ui.test.mjs
import * as MT from '../../montagem.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = { esc, rotulo: (d) => ({ banco: 'Banco', estudos: 'Universidade' }[d] || d), prazo: (a) => (a.prazo ? a.prazo.slice(8, 10) + '/' + a.prazo.slice(5, 7) : ''), pil: (t, c) => '<span class="pill ' + (c || '') + '">' + esc(t) + '</span>',
  btn: (a, id, r) => '<button data-caso="' + a + '" data-id="' + id + '">' + esc(r) + '</button>', linha: (e, m, b) => '<div class="linha">' + e + m + b + '</div>' };
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
  check('rascunho tem "Publicar para ela"; a conferir não tem; publicado tem "Retirar"', /data-caso="aco-pub" data-id="1"/.test(h) && !/data-caso="aco-pub" data-id="2"/.test(h) && /data-caso="aco-retirar" data-id="3"/.test(h));
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
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
