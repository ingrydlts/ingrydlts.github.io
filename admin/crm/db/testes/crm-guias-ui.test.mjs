// Testa a sessão Guias do CRM: guias gratuitos que ela pediu (sozinhos), o que você indica e o que o sistema sugere. crm.js de verdade em Node, com
// Supabase de mentira. Dados inventados. Uso: cd admin/crm/db/testes && node crm-guias-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const monta = async ({ origens = ['guia-vls-ts'], persona = 'campus_france', indicados = [], rpcResp = {}, fetch } = {}) => {
  const respostas = { caso_guias: { data: indicados.map((slug) => ({ slug })), error: null }, caso_acoes: { data: [], error: null }, caso_listas: { data: [], error: null }, caso_achados: { data: [], error: null }, board_itens: { data: [], error: null }, caso_avisos: { data: [], error: null }, consentimentos: { data: [], error: null }, escolas_dela: { data: [], error: null } };
  const h = await carregarCrm({ respostas, rpcResp: { crm_guias_catalogo_sincronizar: { data: 5, error: null }, crm_guia_indicar: { data: null, error: null }, crm_guia_retirar: { data: null, error: null }, ...rpcResp }, fetch, expor: ['fxGuiasCorpo', 'fxCarregaGuias', 'guiaAcao', 'fxPreviaDados', 'carregaCaso'] });
  const c = pessoa({ id: 'p1', user_id: null, persona, origens }); h.mod.setC([c]); h.mod.state.sel = 'p1'; h.mod.state.view = 'contatos';
  h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await h.mod.carregaCaso('p1');
  return { h, c };
};

console.log('== A sessão Guias ==');
{
  const { h, c } = await monta({ indicados: ['etudes-en-france-2027-2028'] });
  check('antes de carregar, a sessão mostra um esqueleto (não "carregando…" em texto)', h.mod.fxGuiasCorpo(c).includes('aria-busy="true"'));
  await h.mod.fxCarregaGuias(c);
  const html = h.mod.fxGuiasCorpo(c);
  check('depois de carregar: o que ela pediu (guia-vls-ts) aparece como "Ela pediu", sem botão', html.includes('Ela pediu') && html.includes('VLS-TS') && !/data-guia="[a-z]+" data-slug="vls-ts-validacao-travou"/.test(html));
  check('o que você indicou aparece com "Retirar"; o sugerido para a persona (Campus France) com "Mostrar para ela"', /data-guia="retirar" data-slug="etudes-en-france-2027-2028"/.test(html) && /data-guia="indicar" data-slug="tecnologo-nivel-na-franca"/.test(html) && html.includes('Sugerido'));
  check('o material da equipe (bilan, documentos, mensagens) continua na sessão, em seção própria', html.includes('Material da equipe'));
  check('o catálogo é sincronizado com o banco (uma vez) e as indicações dela são lidas', h.rpcs.filter((r) => r.n === 'crm_guias_catalogo_sincronizar').length === 1 && h.rpcs.find((r) => r.n === 'crm_guias_catalogo_sincronizar').a.p_itens.length >= 5);
  h.rpcs.length = 0;
  await h.mod.guiaAcao('indicar', 'tecnologo-nivel-na-franca', { disabled: false });
  check('"Mostrar para ela" chama crm_guia_indicar com a pessoa e o guia, e o guia passa a "Indicado por você"', h.rpcs.some((r) => r.n === 'crm_guia_indicar' && r.a.p_contato === 'p1' && r.a.p_slug === 'tecnologo-nivel-na-franca') && /data-guia="retirar" data-slug="tecnologo-nivel-na-franca"/.test(h.mod.fxGuiasCorpo(c)));
  await h.mod.guiaAcao('retirar', 'tecnologo-nivel-na-franca', { disabled: false });
  check('"Retirar" chama crm_guia_retirar e o guia volta a ser sugerido', h.rpcs.some((r) => r.n === 'crm_guia_retirar' && r.a.p_slug === 'tecnologo-nivel-na-franca') && /data-guia="indicar" data-slug="tecnologo-nivel-na-franca"/.test(h.mod.fxGuiasCorpo(c)));
  h.rpcs.length = 0;
  await h.mod.guiaAcao('sugeridos', '', { disabled: false });
  check('"Mostrar todos os sugeridos" indica só os sugeridos ainda não indicados (nem os pedidos)', h.rpcs.filter((r) => r.n === 'crm_guia_indicar').map((r) => r.a.p_slug).sort().join() === 'tecnologo-nivel-na-franca' && !h.mod.fxGuiasCorpo(c).includes('data-guia="sugeridos"'));
}
console.log('== A prévia do app dela ==');
{
  const { h, c } = await monta({ indicados: ['etudes-en-france-2027-2028'] });
  await h.mod.fxCarregaGuias(c);
  const d = h.mod.fxPreviaDados(c);
  check('a prévia mostra os guias que ela pediu e os que você indicou (não os apenas sugeridos)', d.guias.gratuitos.length === 2 && d.guias.gratuitos.some((x) => /VLS-TS/.test(x.titulo)) && d.guias.gratuitos.some((x) => /Études/.test(x.titulo)));
}
console.log('== Quando algo falta ==');
{
  let { h, c } = await monta({ rpcResp: { crm_guias_catalogo_sincronizar: { data: null, error: { message: 'function does not exist' } } } });
  await h.mod.fxCarregaGuias(c);
  check('sem o SQL rodado: diz qual arquivo rodar, sem quebrar o resto da sessão', h.mod.fxGuiasCorpo(c).includes('crm-guias.sql') && h.mod.fxGuiasCorpo(c).includes('Material da equipe'));
  ({ h, c } = await monta({ fetch: async () => ({ ok: false }) }));
  await h.mod.fxCarregaGuias(c);
  check('sem conseguir ler content/guias.json: avisa em palavras', h.mod.fxGuiasCorpo(c).includes('catálogo de guias'));
  ({ h, c } = await monta({ origens: [], persona: '' }));
  await h.mod.fxCarregaGuias(c);
  check('pessoa que não pediu nada e sem persona: lista só com "Mostrar para ela" e sem sugestão', !h.mod.fxGuiasCorpo(c).includes('Ela pediu') && !h.mod.fxGuiasCorpo(c).includes('data-guia="sugeridos"') && (h.mod.fxGuiasCorpo(c).match(/data-guia="indicar"/g) || []).length >= 5);
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
