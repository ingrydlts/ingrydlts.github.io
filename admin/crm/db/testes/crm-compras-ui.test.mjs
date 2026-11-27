// Testa a sessão "Compras" da ficha (aba, selo "Comprou", lista e "Mostrar a chave") ligada ao crm.js real, em Node, com navegador e Supabase de mentira.
// NÃO testa nada em navegador real (visual). Dados de teste inventados.
//
// Uso: cd admin/crm/db/testes && node crm-compras-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
function base(extra = {}) {
  return Object.assign({ 'contatos:one': { data: { dossie: {}, user_id: null }, error: null }, eventos: { data: [], error: null }, consentimentos: { data: [], error: null },
    emails_enviados: { data: [], error: null }, checklist_items: { data: [], error: null }, plataforma_cliques: { data: [], error: null }, chat_mensagens: { data: [], error: null },
    propostas: { data: [], error: null }, insights_historico: { data: [], error: null }, insights_manuais: { data: [], error: null }, 'insights_vivos:one': { data: null, error: null } }, extra);
}
async function abre(h, c) { h.mod.setC([c]); h.mod.state.sel = c.id; h.mod.state.view = 'pessoa'; h.mod.state.ptab = null; h.mod.state.pstab = 'assistente'; await h.mod.renderPessoa(); return h.el('pessoa-page').innerHTML; }
const agora = Date.now(), iso = (d) => new Date(agora - d * 864e5).toISOString();
const COMPRA = { id: 7, referencia: 'cs_test_7', slug: 'manual-destrave-domiciliacao', email_pagamento: 'ana@example.com', contato_id: 'c1', valor_centavos: 990, moeda: 'EUR', pago_em: iso(4), acesso_ate: iso(-361), entregue_em: iso(4), origem: null };
const MAIL = { id: 'm1', modelo: 'guia_compra', assunto: 'Seu Manual chegou', status: 'entregue', enviado_em: iso(4), criado_em: iso(4) };
const STORE = { crm_ficha_v2: '1' };

console.log('== Quem não comprou: nada muda ==');
{
  const h = await carregarCrm({ respostas: base(), store: STORE });
  h.mod.setCOMPRAS_GUIA([]); h.mod.setENTRADAS_GUIA([]);
  const html = await abre(h, pessoa());
  check('sem compra: não há aba Compras nem selo', !/data-v="compras"/.test(html) && !/Comprou/.test(html));
  h.mod.pararAoVivo();
}
console.log('== Quem comprou: selo, aba e sessão ==');
{
  const h = await carregarCrm({ respostas: base({ emails_enviados: { data: [MAIL], error: null } }), store: STORE });
  h.mod.setCOMPRAS_GUIA([COMPRA, { ...COMPRA, id: 8, referencia: 'cs_outra', contato_id: 'outra-pessoa' }]); h.mod.setENTRADAS_GUIA([{ compra_id: 7, em: iso(1) }, { compra_id: 7, em: iso(3) }, { compra_id: 8, em: iso(0) }]);
  let html = await abre(h, pessoa());
  check('o cabeçalho mostra o selo Comprou com as 2 entradas dela (não as da outra pessoa)', /Comprou · entrou 2 vezes/.test(html));
  check('a aba Compras aparece só para quem comprou', /data-fx="tab" data-v="compras"[^>]*>Compras/.test(html));
  await h.click({ fx: 'tab', v: 'compras' });
  html = h.el('pessoa-page').innerHTML;
  check('a sessão mostra o produto, o fluxo de entrada e o bloco de insights de e-mail', /Manual Destrave: Endereço e Domiciliação/.test(html) && /Fluxo de entrada no material/.test(html) && /2 entradas/.test(html) && /Insights de e-mail/.test(html) && /Abriu|e-mail de entrega/.test(html));
  check('não mostra a compra da outra pessoa', !/cs_outra/.test(html));
  check('a chave não está na página: só o botão', /data-fx="chaveCompra"/.test(html) && !/[A-Za-z0-9_-]{43}/.test(html.replace(/cs_test_7/g, '')));
  h.mod.pararAoVivo();
}
console.log('== Mostrar a chave ==');
{
  const chamadas = [];
  const CH = 'Z'.repeat(43);
  const fetchFalso = async (u, o) => { chamadas.push({ u: String(u), o }); return { ok: true, status: 200, json: async () => ({ chave: CH, link: 'https://w.example/guia/#k=' + CH, revogado: false }) }; };
  const h = await carregarCrm({ respostas: base({ emails_enviados: { data: [MAIL], error: null } }), store: STORE, sessao: { access_token: 'tok-admin' }, fetch: fetchFalso });
  h.mod.setCOMPRAS_GUIA([COMPRA]); h.mod.setENTRADAS_GUIA([]);
  await abre(h, pessoa());
  await h.click({ fx: 'tab', v: 'compras' });
  await h.click({ fx: 'chaveCompra', ref: 'cs_test_7', id: '7' }); await new Promise((r) => setTimeout(r, 20));
  const r = chamadas.find((c) => /compra-chave/.test(c.u));
  check('pede ao Worker a chave daquela compra, com o token de admin', !!r && /compra-chave\?ref=cs_test_7$/.test(r.u) && r.o.headers.Authorization === 'Bearer tok-admin');
  check('mostra a chave e os botões de copiar na própria sessão', h.el('cmp-chave-7').innerHTML.includes(CH) && /Copiar a chave/.test(h.el('cmp-chave-7').innerHTML));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: STORE, sessao: null, fetch: async () => { throw new Error('não devia chamar'); } });
  h.mod.setCOMPRAS_GUIA([COMPRA]); h.mod.setENTRADAS_GUIA([]);
  await abre(h, pessoa());
  await h.click({ fx: 'tab', v: 'compras' });
  await h.click({ fx: 'chaveCompra', ref: 'cs_test_7', id: '7' }); await new Promise((r) => setTimeout(r, 20));
  check('sem sessão do CRM: avisa para entrar de novo e não chama o Worker', /Sessão expirada/.test(h.el('cmp-chave-7').innerHTML));
  h.mod.pararAoVivo();
}
{
  const h = await carregarCrm({ respostas: base(), store: STORE, sessao: { access_token: 't' }, fetch: async () => ({ ok: false, status: 404, json: async () => ({ error: 'Não achei a chave desta compra na KV.' }) }) });
  h.mod.setCOMPRAS_GUIA([COMPRA]); h.mod.setENTRADAS_GUIA([]);
  await abre(h, pessoa());
  await h.click({ fx: 'tab', v: 'compras' });
  await h.click({ fx: 'chaveCompra', ref: 'cs_test_7', id: '7' }); await new Promise((r) => setTimeout(r, 20));
  check('erro do Worker vira aviso na sessão, sem chave', /Não achei a chave desta compra/.test(h.el('cmp-chave-7').innerHTML));
  h.mod.pararAoVivo();
}
console.log('== A lista de pessoas ==');
{
  const h = await carregarCrm({ respostas: base(), store: STORE });
  h.mod.setC([pessoa(), pessoa({ id: 'c2', email: 'bia@example.com', nome: 'Bia' })]);
  h.mod.setCOMPRAS_GUIA([COMPRA]); h.mod.setENTRADAS_GUIA([]);
  h.mod.state.view = 'contatos'; h.mod.renderContacts();
  const t = h.el('tbody').innerHTML;
  check('a lista marca quem comprou, e só quem comprou', /Ana Souza[^]*?Comprou/.test(t) && (t.match(/Comprou/g) || []).length === 1 && /ainda não entrou/.test(t));
}
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
