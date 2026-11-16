// Testa: a leitura da conversa preenche o Resumo e os Próximos passos do Dossiê (só se vazios) e rascunha o e-mail do bilan, sem o Notion.
// Rodando o crm.js de verdade em Node, com Supabase de mentira. Dados inventados. Uso: cd admin/crm/db/testes && node crm-bilan-montagem-ui.test.mjs
import * as MT from '../../montagem.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const EMAIL = { duvidas: ['Como funciona o visto de estudante'], proximos: ['Ligar para a Alliance amanhã', 'Reunir os documentos'], respostas: ['Eu te mando o guia de escolas'] };
const PROP = { bilan: { resumo: 'Ela quer estudar francês e decidir entre duas escolas.', afirmacoes: [], email: EMAIL }, encaminhamentos: [], checklists: [], documentos: [], perguntas_equipe: [], blocos: [], compromissos: [], omissoes: [] };
const monta = async (dossie, mont) => {
  const h = await carregarCrm({ respostas: { montagens: { data: mont || [], error: null } }, expor: ['montPreencheDossie', 'bilanDaMontagem', 'bilanBlocoHtml', 'fxCarregaConversas', 'montEstado'] });
  const c = pessoa({ id: 'p1', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1'; h.mod.state.view = 'contatos';
  h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: dossie || {}, rasc: {} };
  const m = h.mod.montEstado('p1'); m.prop = { id: 1, versao: 2, proposta: PROP };
  return { h, c };
};

console.log('== Dossiê preenchido pela leitura ==');
{
  let { h } = await monta({});
  const n = await h.mod.montPreencheDossie('p1', false);
  const sv = h.rpcs.find((r) => r.n === 'crm_salvar_dossie');
  check('com os dois campos vazios, preenche os dois e salva direto (sem outro botão)', n === 2 && sv && sv.a.p_dados.ligacao_resumo.startsWith('Ela quer estudar francês') && sv.a.p_dados.proximos_passos === '- Ligar para a Alliance amanhã\n- Reunir os documentos');
  ({ h } = await monta({ ligacao_resumo: 'Escrevi à mão.' }));
  const n2 = await h.mod.montPreencheDossie('p1', false);
  const sv2 = h.rpcs.find((r) => r.n === 'crm_salvar_dossie');
  check('o que você já escreveu nunca é sobrescrito: só o campo vazio é preenchido', n2 === 1 && sv2 && !('ligacao_resumo' in sv2.a.p_dados) && 'proximos_passos' in sv2.a.p_dados);
  ({ h } = await monta({ ligacao_resumo: 'Escrevi à mão.', proximos_passos: '- meu' }));
  check('com os dois já escritos, não grava nada', (await h.mod.montPreencheDossie('p1', false)) === 0 && !h.rpcs.some((r) => r.n === 'crm_salvar_dossie'));
  const forc = await h.mod.montPreencheDossie('p1', true);
  check('pedindo de novo (forçar), sobrescreve os dois', forc === 2 && h.rpcs.filter((r) => r.n === 'crm_salvar_dossie').length === 1);
  ({ h } = await monta({}));
  h.mod.montEstado('p1').prop.proposta = { bilan: { resumo: '', afirmacoes: [], email: { duvidas: [], proximos: [], respostas: [] } } };
  check('leitura sem resumo nem próximos passos não grava nada', (await h.mod.montPreencheDossie('p1', false)) === 0 && !h.rpcs.some((r) => r.n === 'crm_salvar_dossie'));
}
console.log('== E-mail do bilan sem o Notion ==');
{
  const { h, c } = await monta({}, [{ versao: 1, estado: 'pendente', criado_em: '2026-11-10T10:00:00Z', proposta: { bilan: { resumo: 'x', afirmacoes: [], email: EMAIL } } }, { versao: 2, estado: 'pendente', criado_em: '2026-11-16T10:00:00Z', proposta: { bilan: { resumo: 'y', afirmacoes: [] } } }]);
  check('antes de carregar as leituras, o botão do e-mail fica desabilitado, como antes', /data-bilanabrir="p1" disabled/.test(h.mod.bilanBlocoHtml(c, '')));
  await h.mod.fxCarregaConversas(c, true);
  const pm = h.mod.bilanDaMontagem(c);
  check('depois de carregar, o rascunho vem da leitura mais recente QUE TROUXE e-mail, com as três seções', pm && pm.daLeitura === 1 && pm.duvidas.length === 1 && pm.proximos.length === 2 && pm.respostas.length === 1);
  const html = h.mod.bilanBlocoHtml(c, '');
  check('o botão habilita e a tela explica que o rascunho vem da leitura', !/data-bilanabrir="p1" disabled/.test(html) && html.includes('rascunho já vem da leitura da conversa'));
}
console.log('== Botão de atualizar o Dossiê na tela da montagem ==');
{
  const painel = (p) => MT.painelHtml({ cid: 'p1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: p }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null }, { id: 'p1' }, (s) => String(s));
  check('a tela oferece atualizar o Resumo e os Próximos passos quando a leitura os trouxe', painel(PROP).includes('data-montdossie="p1"'));
  check('sem resumo nem próximos passos, o botão não aparece', !painel({ ...PROP, bilan: { resumo: '', afirmacoes: [] } }).includes('data-montdossie'));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
