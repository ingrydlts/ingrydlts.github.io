// Testa a pergunta "os e-mails automáticos devem parar?" na ficha (aberta, Parar, Continuar, Retomar) ligada ao crm.js real, em Node,
// com navegador e Supabase de mentira. NÃO testa nada em navegador real (visual). Dados inventados.
// Uso: cd admin/crm/db/testes && node crm-pausa-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
function base(extra = {}) {
  return Object.assign({ 'contatos:one': { data: { dossie: {}, user_id: null }, error: null }, eventos: { data: [], error: null }, consentimentos: { data: [], error: null },
    emails_enviados: { data: [], error: null }, checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, chat_mensagens: { data: [], error: null },
    propostas: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null } }, extra);
}
async function abre(h, c) { h.mod.setC([c]); h.mod.state.sel = c.id; h.mod.state.view = 'pessoa'; h.mod.state.ptab = null; h.mod.state.pstab = 'assistente'; await h.mod.renderPessoa(); return h.el('pessoa-page').innerHTML; }
const STORE = { crm_ficha_v2: '1' };
const futuro = new Date(Date.now() + 3 * 864e5).toISOString();
const wait = () => new Promise((r) => setTimeout(r, 20));

console.log('== Sem pergunta, nada aparece ==');
{
  const h = await carregarCrm({ respostas: base(), store: STORE });
  h.mod.setPAUSAS([]);
  const html = await abre(h, pessoa());
  check('sem pausa: sem aviso e sem botões', !/Os e-mails automáticos devem parar/.test(html) && !/data-fx="pausa"/.test(html));
  h.mod.pararAoVivo();
}
console.log('== Pergunta aberta ==');
{
  const h = await carregarCrm({ respostas: base(), store: STORE, rpcResp: { crm_sequencia_pausa_decidir_admin: { data: { ok: true }, error: null } } });
  h.mod.setUM([{ id: 55, contato_id: 'c1', quando: futuro, status: 'agendado' }]);
  h.mod.setPAUSAS([{ id: 9, contato_id: 'c1', um_a_um_id: 55, criada_em: new Date().toISOString(), decisao: null }, { id: 10, contato_id: 'outra', um_a_um_id: 56, decisao: null }]);
  let html = await abre(h, pessoa());
  check('a pergunta aparece no alto da ficha, com o nome', /Ana Souza marcou um 1:1/.test(html) && /Os e-mails automáticos devem parar\?/.test(html));
  check('traz os dois botões, ligados à pausa dela (não à da outra pessoa)', /data-fx="pausa" data-v="parar" data-id="9"/.test(html) && /data-fx="pausa" data-v="continuar" data-id="9"/.test(html) && !/data-id="10"/.test(html));
  check('avisa que nada sai enquanto ela não responder', /nenhum e-mail automático sai/.test(html));
  await h.click({ fx: 'pausa', v: 'parar', id: '9' }); await wait();
  const rpc = h.rpcs.find((x) => x.n === 'crm_sequencia_pausa_decidir_admin');
  check('"Parar a sequência" chama a função da admin com a pausa e a decisão', !!rpc && rpc.a.p_id === 9 && rpc.a.p_decisao === 'parar');
  check('depois de parar, a pergunta some e aparece "parados" com o botão Retomar', !/devem parar\?/.test(h.el('fx-pausa-box').innerHTML) && /parados/.test(h.el('fx-pausa-box').innerHTML) && /data-v="continuar" data-id="9"/.test(h.el('fx-pausa-box').innerHTML));
  await h.click({ fx: 'pausa', v: 'continuar', id: '9' }); await wait();
  check('"Retomar" grava "continuar" e o aviso de parada some', h.rpcs.filter((x) => x.n === 'crm_sequencia_pausa_decidir_admin').length === 2 && h.el('fx-pausa-box').innerHTML === '');
  h.mod.pararAoVivo();
}
console.log('== Erro ao gravar ==');
{
  const h = await carregarCrm({ respostas: base(), store: STORE, rpcResp: { crm_sequencia_pausa_decidir_admin: { data: null, error: { message: 'sem_permissao' } } } });
  h.mod.setUM([{ id: 55, contato_id: 'c1', quando: futuro, status: 'agendado' }]);
  h.mod.setPAUSAS([{ id: 9, contato_id: 'c1', um_a_um_id: 55, decisao: null }]);
  await abre(h, pessoa());
  await h.click({ fx: 'pausa', v: 'parar', id: '9' }); await wait();
  check('se o banco recusar, o erro aparece e nada vira "parado"', /Não consegui gravar a decisão/.test(h.el('toast').textContent) && !/parados/.test(h.el('fx-pausa-box').innerHTML) && /devem parar\?/.test(h.el('pessoa-page').innerHTML));
  h.mod.pararAoVivo();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
