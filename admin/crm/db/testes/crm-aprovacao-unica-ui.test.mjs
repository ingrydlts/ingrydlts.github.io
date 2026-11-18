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

console.log('== Abas por destino: a tela deixa de ser uma lista comprida ==');
{
  const m = { cid: 'c1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: PROP() }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null, dd: {} };
  const c = pessoa({ id: 'c1' }), h = MT.painelHtml(m, c, esc);
  check('os grupos viram abas (um botão por destino) e só o grupo ativo mostra os itens', (h.match(/class="mont-tab"/g) || []).length >= 2 && !/<details class="mont-gaveta" data-dd="mont-checklists"/.test(h));
  check('cada aba traz marcados/total do grupo', /data-montgrupo="Checklists" aria-pressed="(true|false)">Checklists<small>3\/3<\/small>/.test(h));
  check('há uma barra de resumo no rodapé: quantos itens marcados e quantos sem fonte oficial', /<b>4 de 4<\/b> itens marcados · 1 sem fonte oficial/.test(h));
  const lista = (g) => MT.painelHtml({ ...m, grupo: g }, c, esc);
  check('trocar de aba (m.grupo) mostra os itens daquele grupo, e juntas as abas mostram tudo (nada some)', (lista('Checklists') + lista('Particulares do percurso')).includes('Item A') && lista('Checklists').includes('Item B') && lista('Particulares do percurso').includes('Ligar para a escola') && !lista('Checklists').includes('Ligar para a escola'));
}

console.log('== Aprovar uma vez só ==');
{
  const pub = { ha_rascunho_aprovado: true, itens_prontos: 2, itens_proposta: 0, itens_a_conferir: 1, conta_ja_existe: false, tem_assinatura: false, a_conferir_itens: [{ id: 41, titulo: 'Item A' }] };
  const rpcResp = { crm_montagem_aplicar: { data: { criados: 4, atualizados: 0, mantidos: 0, rejeitados: 0, conflitos: [] }, error: null }, crm_montagem_publicavel: { data: pub, error: null },
    crm_acao_conferida: { data: null, error: null }, crm_montagem_liberar: { data: { liberados: 3, a_conferir_pulados: 0, publicados_agora: false }, error: null } };
  const monta = async () => { const h = await carregarCrm({ rpcResp, expor: ['montAprovar', 'montLevar', 'montEstado'] }); h.mod.setC([pessoa({ id: 'c1' })]); h.mod.state.sel = 'c1'; const m = h.mod.montEstado('c1'); m.prop = { id: 5, versao: 1, proposta: PROP() }; m.estado = 'proposta'; return h; };
  let h = await monta();
  const botao = MT.painelHtml({ ...h.mod.montEstado('c1'), dd: {} }, pessoa({ id: 'c1' }), esc);
  check('o botão diz "Levar para a Curadoria" e a proposta não traz mais a caixa de conferência (ela fica na Curadoria)', botao.includes('Levar para a Curadoria (4)') && !/data-montconfiro/.test(botao));
  await h.mod.montAprovar('c1', { disabled: false });
  const ordem = h.rpcs.map((r) => r.n).filter((n) => /crm_montagem_aplicar|crm_acao_conferida|crm_montagem_liberar/.test(n));
  check('um clique faz tudo na ordem: aplicar → conferir o item sem fonte → liberar', JSON.stringify(ordem) === JSON.stringify(['crm_montagem_aplicar', 'crm_acao_conferida', 'crm_montagem_liberar']) && h.rpcs.find((r) => r.n === 'crm_acao_conferida').a.p_id === 41);
  check('no fim está aprovado e liberado, sem pedir outro botão', h.mod.montEstado('c1').estado === 'aplicado' && h.mod.montEstado('c1').lib && h.mod.montEstado('c1').lib.liberados === 3);
  h = await monta(); h.mod.montEstado('c1').confiro = false;
  await h.mod.montAprovar('c1', { disabled: false });
  check('desmarcando "Conferi o texto", os itens sem fonte NÃO são conferidos (ficam em "A conferir")', !h.rpcs.some((r) => r.n === 'crm_acao_conferida') && h.rpcs.some((r) => r.n === 'crm_montagem_liberar'));
  h = await monta();
  await h.mod.montLevar('c1', { disabled: false });
  const ordemL = h.rpcs.map((r) => r.n).filter((n) => /crm_montagem_aplicar|crm_acao_conferida|crm_montagem_liberar/.test(n));
  check('"Levar para a Curadoria" só cria os rascunhos: não confere nem libera nada (a aprovação é na Curadoria)', JSON.stringify(ordemL) === JSON.stringify(['crm_montagem_aplicar']) && h.mod.montEstado('c1').estado === 'aplicado' && !h.mod.montEstado('c1').lib);
  h = await monta(); h.rpcs.length = 0;
  const h2 = await carregarCrm({ rpcResp: { ...rpcResp, crm_montagem_aplicar: { data: null, error: { message: 'falhou' } } }, expor: ['montAprovar', 'montLevar', 'montEstado'] }); h2.mod.setC([pessoa({ id: 'c1' })]); h2.mod.state.sel = 'c1'; const m2 = h2.mod.montEstado('c1'); m2.prop = { id: 5, versao: 1, proposta: PROP() }; m2.estado = 'proposta';
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
  check('cada passo não concluído se edita com dois cliques no título (ou Enter): é a edição de hoje, sem botão "Editar"', (html.match(/data-dbl="ed-aco"/g) || []).length === 2 && !/data-caso="ed-aco"/.test(html));
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
