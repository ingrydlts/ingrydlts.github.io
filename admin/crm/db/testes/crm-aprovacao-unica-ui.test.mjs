// Testa a aprovação única da montagem (um clique: aplicar → conferir → liberar), as gavetas da tela e a edição da escrita dos passos.
// Rodando o crm.js de verdade em Node, com Supabase de mentira. Dados inventados.
// Uso: cd admin/crm/db/testes && node crm-aprovacao-unica-ui.test.mjs
import * as MT from '../../montagem.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PROP = () => ({ bilan: { resumo: 'Resumo.', afirmacoes: [{ texto: 'Ligar', quem: 'ingryd', momento: '20:05', trecho: 't', certeza: 'literal', vezes_dito: 1 }], email: { duvidas: [], proximos: [], respostas: [] } },
  encaminhamentos: [{ chave: 'ligar', texto: 'Ligar para a escola', camada: 'particular', dono: 'ela', prazo: null, prazo_texto: '', origem: { momento: '', trecho: '' }, certeza: 'literal', cobre: [] }],
  checklists: [{ chave: 'l', titulo: 'Lista', origem: 'particular', itens: [{ chave: 'a', titulo: 'Item A', demarche: 'banco', subitens: [], prazo: null, fonte: null, nivel: null, a_conferir: true }, { chave: 'b', titulo: 'Item B', demarche: 'caf', subitens: [], prazo: null, fonte: { rotulo: 'G', url: 'https://x.org/g' }, nivel: 'oficial', a_conferir: false }] }],
  documentos: [], perguntas_equipe: [], blocos: [], compromissos: [], omissoes: [], lembretes: [], mensagens_chat: [] });

console.log('== Gavetas: a tela deixa de ser uma lista comprida ==');
{
  const m = { cid: 'c1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: PROP() }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null, dd: {} };
  const h = MT.painelHtml(m, pessoa({ id: 'c1' }), esc);
  check('os grupos viram gavetas (details), fechadas por padrão', (h.match(/<details class="mont-gaveta"/g) || []).length >= 3 && !/<details class="mont-gaveta" data-dd="mont-checklists" open/.test(h));
  check('o título da gaveta traz a contagem e quantos estão marcados e a conferir', /Checklists · 3[\s\S]*?3 marcados · 1 a conferir/.test(h));
  check('há um resumo no alto: quantos itens, grupos, marcados e sem fonte', /<b>4 itens<\/b> em 2 grupos · 4 marcados · 1 sem fonte oficial/.test(h) || /itens<\/b> em \d+ grupos · \d+ marcados · 1 sem fonte oficial/.test(h));
  check('o conteúdo continua dentro das gavetas (nada some)', h.includes('Item A') && h.includes('Item B') && h.includes('Ligar para a escola'));
  check('a gaveta lembra que estava aberta (m.dd)', /<details class="mont-gaveta" data-dd="mont-checklists" open/.test(MT.painelHtml({ ...m, dd: { 'mont-checklists': true } }, pessoa({ id: 'c1' }), esc)));
}

console.log('== Editar o texto antes de aprovar (na própria lista) ==');
{
  const itens = MT.itensDaProposta(PROP());
  const k = itens.find((i) => i.k === 'chk:l:a').k;
  check('decisoesDe leva o texto editado como decisão "editar" com o texto novo (só do item marcado)', (() => { const d = MT.decisoesDe(itens, {}, {}, { [k]: '  Item A reescrito  ' }).find((x) => x.origem_chave === k); return d.decisao === 'editar' && d.texto === 'Item A reescrito'; })());
  check('texto igual ao original, vazio ou de item desmarcado não vira edição', (() => { const orig = itens.find((i) => i.k === k).titulo; const a = MT.decisoesDe(itens, {}, {}, { [k]: orig }).find((x) => x.origem_chave === k); const b = MT.decisoesDe(itens, {}, {}, { [k]: '   ' }).find((x) => x.origem_chave === k); const c = MT.decisoesDe(itens, { [k]: false }, {}, { [k]: 'Outro' }).find((x) => x.origem_chave === k); return a.decisao === 'aprovar' && !('texto' in a) && b.decisao === 'aprovar' && c.decisao === 'rejeitar' && !('texto' in c); })());
  check('a lista (título da lista) não é editável aqui', !MT.decisoesDe(itens, {}, {}, { 'lista:l': 'X' }).find((x) => x.origem_chave === 'lista:l').texto);
  const base = { cid: 'c1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: PROP() }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null, dd: { 'mont-checklists': true }, edits: {}, editando: null };
  let h = MT.painelHtml(base, pessoa({ id: 'c1' }), esc);
  check('cada item editável tem o botão Editar; a lista não tem', (h.match(/data-montedito="/g) || []).length === 3 && !/data-montedito="lista:/.test(h));
  h = MT.painelHtml({ ...base, editando: 'chk:l:a' }, pessoa({ id: 'c1' }), esc);
  check('em edição o item vira um campo de texto com o texto atual e botão OK', /<input[^>]*data-montedit="chk:l:a"[^>]*value="Item A"/.test(h) && /data-montedok="chk:l:a"/.test(h));
  h = MT.painelHtml({ ...base, edits: { 'chk:l:a': 'Item A reescrito' } }, pessoa({ id: 'c1' }), esc);
  check('o item editado mostra o texto novo e a marca "editado"', h.includes('Item A reescrito') && /editado/.test(h) && !/<b>Item A<\/b>/.test(h));
  h = MT.painelHtml({ ...base, edits: { 'chk:l:a': '<img src=x>' } }, pessoa({ id: 'c1' }), esc);
  check('o texto editado é escapado', !h.includes('<img'));
}

console.log('== Aprovar uma vez só ==');
{
  const pub = { ha_rascunho_aprovado: true, itens_prontos: 2, itens_proposta: 0, itens_a_conferir: 1, conta_ja_existe: false, tem_assinatura: false, a_conferir_itens: [{ id: 41, titulo: 'Item A' }] };
  const rpcResp = { crm_montagem_aplicar: { data: { criados: 4, atualizados: 0, mantidos: 0, rejeitados: 0, conflitos: [] }, error: null }, crm_montagem_publicavel: { data: pub, error: null },
    crm_acao_conferida: { data: null, error: null }, crm_montagem_liberar: { data: { liberados: 3, a_conferir_pulados: 0, publicados_agora: false }, error: null } };
  const monta = async () => { const h = await carregarCrm({ rpcResp, expor: ['montAprovar', 'montEstado'] }); h.mod.setC([pessoa({ id: 'c1' })]); h.mod.state.sel = 'c1'; const m = h.mod.montEstado('c1'); m.prop = { id: 5, versao: 1, proposta: PROP() }; m.estado = 'proposta'; return h; };
  let h = await monta();
  const botao = MT.painelHtml({ ...h.mod.montEstado('c1'), dd: {} }, pessoa({ id: 'c1' }), esc);
  check('o botão diz "Aprovar e adicionar ao Checklist" e há a caixa "Conferi o texto" (marcada)', botao.includes('Aprovar e adicionar ao Checklist (4)') && /data-montconfiro checked/.test(botao) && /Conferi o texto dos 1 item sem fonte oficial/.test(botao));
  await h.mod.montAprovar('c1', { disabled: false });
  const ordem = h.rpcs.map((r) => r.n).filter((n) => /crm_montagem_aplicar|crm_acao_conferida|crm_montagem_liberar/.test(n));
  check('um clique faz tudo na ordem: aplicar → conferir o item sem fonte → liberar', JSON.stringify(ordem) === JSON.stringify(['crm_montagem_aplicar', 'crm_acao_conferida', 'crm_montagem_liberar']) && h.rpcs.find((r) => r.n === 'crm_acao_conferida').a.p_id === 41);
  check('no fim está aprovado e liberado, sem pedir outro botão', h.mod.montEstado('c1').estado === 'aplicado' && h.mod.montEstado('c1').lib && h.mod.montEstado('c1').lib.liberados === 3);
  h = await monta(); h.mod.montEstado('c1').confiro = false;
  await h.mod.montAprovar('c1', { disabled: false });
  check('desmarcando "Conferi o texto", os itens sem fonte NÃO são conferidos (ficam em "A conferir")', !h.rpcs.some((r) => r.n === 'crm_acao_conferida') && h.rpcs.some((r) => r.n === 'crm_montagem_liberar'));
  h = await monta(); h.rpcs.length = 0;
  const h2 = await carregarCrm({ rpcResp: { ...rpcResp, crm_montagem_aplicar: { data: null, error: { message: 'falhou' } } }, expor: ['montAprovar', 'montEstado'] }); h2.mod.setC([pessoa({ id: 'c1' })]); h2.mod.state.sel = 'c1'; const m2 = h2.mod.montEstado('c1'); m2.prop = { id: 5, versao: 1, proposta: PROP() }; m2.estado = 'proposta';
  await h2.mod.montAprovar('c1', { disabled: false });
  check('se aplicar falhar, não confere nem libera nada e mostra o erro', !h2.rpcs.some((r) => r.n === 'crm_acao_conferida' || r.n === 'crm_montagem_liberar') && /Não consegui/.test(h2.mod.montEstado('c1').erro));
  const lib = MT.painelHtml({ cid: 'c1', estado: 'aplicado', erro: '', prop: { id: 5, versao: 1, proposta: PROP() }, sel: {}, motivos: {}, res: { criados: 4, atualizados: 0, rejeitados: 0, conflitos: [] }, pub, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: { liberados: 3, a_conferir_pulados: 0, publicados_agora: false }, dd: {} }, pessoa({ id: 'c1' }), esc);
  check('depois de aprovado, a tela não pede "Liberar para ela" de novo e diz onde editar', !/data-montliberar/.test(lib) && /Checklist<\/b> dela/.test(lib) && lib.includes('Aprovado:'));
}

console.log('== Editar a escrita dos passos no Checklist ==');
{
  const ACO = [{ id: 7, titulo: 'Ligar para a escola', dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: null, a_conferir: false, origem_chave: 'enc:ligar', demarche: 'estudos', subitens: ['Perguntar o nível'], editado_em: null },
    { id: 8, titulo: 'Passo já editado', dono: 'ela', canal: 'plataforma', estado: 'aberta', publicada_em: null, a_conferir: false, origem_chave: 'enc:x', editado_em: '2026-11-16T10:00:00Z' }];
  const H = { esc, rotulo: (d) => d, prazo: () => '', pil: (t) => '<i>' + t + '</i>', btn: (a, id, r) => '<button data-caso="' + a + '" data-id="' + id + '">' + r + '</button>', conferi: (id) => '<button data-montconferido="' + id + '">C</button>', linha: (e, m, b) => '<div>' + e + m + b + '</div>' };
  const html = MT.passosPropostosHtml(ACO, [], H);
  check('cada passo não concluído tem o botão "Editar"', (html.match(/data-caso="ed-aco"/g) || []).length === 2);
  check('o passo que você editou avisa que a releitura não o muda', html.includes('Texto editado por você'));
  check('em edição, a linha vira o editor', MT.passosPropostosHtml(ACO, [], { ...H, editando: (a) => a.id === 7, editor: (a) => '<form>EDITOR ' + a.id + '</form>' }).includes('EDITOR 7') && !MT.passosPropostosHtml(ACO, [], { ...H, editando: (a) => a.id === 7, editor: (a) => '<form>EDITOR ' + a.id + '</form>' }).includes('Ligar para a escola'));

  const respostas = { caso_acoes: { data: ACO, error: null }, caso_listas: { data: [], error: null }, caso_achados: { data: [], error: null }, board_itens: { data: [], error: null }, caso_avisos: { data: [], error: null }, consentimentos: { data: [], error: null }, escolas_dela: { data: [], error: null } };
  const h = await carregarCrm({ respostas, expor: ['carregaCaso', 'fxChecklistCorpo', 'casoAcao'] });
  const c = pessoa({ id: 'p1', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1'; h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await h.mod.carregaCaso('p1');
  await h.mod.casoAcao('ed-aco', 7, null);
  const ed = h.mod.fxChecklistCorpo(c);
  check('clicar em Editar abre o editor com o texto e os subitens (um por linha) no Checklist', ed.includes('id="caso-ed-titulo"') && ed.includes('value="Ligar para a escola"') && ed.includes('id="caso-ed-subitens"') && ed.includes('Perguntar o nível'));
  h.el('caso-ed-titulo').value = 'Ligar para a Alliance amanhã'; h.el('caso-ed-subitens').value = 'Pedir o calendário\n\n  Perguntar o nível mínimo  ';
  await h.mod.casoAcao('salvar-aco', 7, null);
  const up = h.writes.find((w) => w.op === 'update' && w.table === 'caso_acoes');
  check('salvar grava o texto, os subitens (sem linhas vazias) e marca como editado', up && up.row.titulo === 'Ligar para a Alliance amanhã' && JSON.stringify(up.row.subitens) === JSON.stringify(['Pedir o calendário', 'Perguntar o nível mínimo']) && !!up.row.editado_em && up.filtros.includes('id=7'));
  h.el('caso-ed-titulo').value = 'X'; h.el('caso-ed-subitens').value = Array.from({ length: 7 }, (_, i) => 'p' + i).join('\n');
  h.writes.length = 0; await h.mod.casoAcao('ed-aco', 7, null); h.el('caso-ed-titulo').value = 'X'; h.el('caso-ed-subitens').value = Array.from({ length: 7 }, (_, i) => 'p' + i).join('\n');
  await h.mod.casoAcao('salvar-aco', 7, null);
  check('mais de 6 subitens não grava', !h.writes.some((w) => w.op === 'update' && w.table === 'caso_acoes'));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
