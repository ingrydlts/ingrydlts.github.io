// Testa a ficha v2 do CRM (admin/crm/ficha*.js ligados ao crm.js real) em Node, com navegador e Supabase de mentira.
// NÃO testa nada em navegador real (visual, arrastar de verdade, foco).
//
// Uso: cd admin/crm/db/testes && node crm-ficha-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

function base(extra = {}) {
  return Object.assign({ 'contatos:one': { data: { dossie: {}, user_id: null }, error: null }, eventos: { data: [], error: null }, consentimentos: { data: [], error: null },
    emails_enviados: { data: [], error: null }, checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, chat_mensagens: { data: [], error: null },
    propostas: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null } }, extra);
}
async function abre(h, c) { h.mod.setC([c]); h.mod.state.sel = c.id; h.mod.state.view = 'pessoa'; h.mod.state.ptab = null; h.mod.state.pstab = 'assistente'; await h.mod.renderPessoa(); return h.el('pessoa-page').innerHTML; }

console.log('== Task 1: chave de ligação ==');
{
  const h = await carregarCrm({ respostas: base() });
  const html = await abre(h, pessoa());
  check('desligada: mantém o dossiê antigo', html.includes('id="dossie-box"'));
  check('desligada: não tem a ficha v2', !html.includes('id="ficha-v2"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: { crm_ficha_v2: '1' } });
  const html = await abre(h, pessoa());
  check('ligada pelo localStorage: tem a ficha v2', html.includes('id="ficha-v2"'));
  check('ligada: o dossiê antigo não fica fora de sessão', !html.includes('id="dossie-box"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), search: '?ficha=2' });
  const html = await abre(h, pessoa());
  check('ligada por ?ficha=2: tem a ficha v2', html.includes('id="ficha-v2"') && !html.includes('id="dossie-box"'));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: { crm_ficha_v2: '0' }, search: '?x=ficha=2' });
  const html = await abre(h, pessoa());
  check('valor diferente de 1 e busca sem ficha=2 mantém a antiga', !html.includes('id="ficha-v2"'));
  h.mod.pararAoVivo();
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
