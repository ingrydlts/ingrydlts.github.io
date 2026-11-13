// Testa o Funil por próxima ação (admin/crm/funil.js ligado ao crm.js real) em Node, com navegador e Supabase de mentira.
// NÃO testa nada em navegador real (visual, foco, 380px). Dados inventados (o repositório é público).
//
// Uso: cd admin/crm/db/testes && node crm-funil-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const ha = (d) => new Date(Date.now() - d * 864e5).toISOString();
const lead = (o = {}) => pessoa(Object.assign({ aceita_novidades: true, dias: 1, email_status: null, email_enviado_em: null, segmento: null, capturas: 1, persona: 'campus_france' }, o));

async function abre(lista, extra = {}) {
  const h = await carregarCrm({ respostas: {} });
  h.mod.setC(lista); if (extra.assin) h.mod.setASSIN(extra.assin);
  h.mod.state.funilVisao = extra.visao || 'leads';
  h.el('funil-persona').value = extra.persona || '';
  h.mod.renderBoard();
  return h;
}

console.log('== Visão Leads ==');
{
  const h = await abre([
    lead({ id: 'a', nome: 'Ana Souza', resposta_aberta_id: 5 }),
    lead({ id: 'b', nome: 'Bia Lima', email_status: 'entregue', email_enviado_em: ha(5), segmento: 'naoabriu' }),
    lead({ id: 'c', nome: 'Caio Reis', user_id: 'u1', estagio: 'em_uso' })
  ]);
  const b = h.el('board').innerHTML;
  check('colunas de leads', b.includes('Responder agora') && b.includes('Enviar o próximo e-mail') && b.includes('Esperar'));
  check('resposta aberta traz o botão que abre a conversa', b.includes('data-openconv="a"'));
  check('e-mail por escrever traz data-emailfor', b.includes('data-emailfor="b"'));
  check('contato com conta não aparece em Leads', !b.includes('Caio'));
  check('o que travou aparece como rótulo de texto', b.includes('Falta gatilho'));
  check('abas mostram contagem por visão', h.el('funil-abas').innerHTML.includes('data-fv="app"'));
  check('painel tem 6 indicadores', (h.el('funil-painel').innerHTML.match(/fn-kpi/g) || []).length === 6);
  check('faixa tem 7 passos', (h.el('funil-passos').innerHTML.match(/fn-passo/g) || []).length === 7);
}

console.log('== Trocar de visão e assinaturas ==');
{
  const h = await abre([lead({ id: 'c', nome: 'Caio Reis', user_id: 'u1', estagio: 'em_uso', dias: 2 }), lead({ id: 'd', nome: 'Duda Melo', user_id: 'u2', dias: 3 })],
    { visao: 'clientes', assin: { d: { contato_id: 'd', status: 'active', cancela_no_fim: true } } });
  let b = h.el('board').innerHTML;
  check('cliente que cancela no fim cai em "pede atenção"', b.includes('Assinatura pede atenção') && b.includes('Duda'));
  check('quem não paga não está em Clientes', !b.includes('Caio'));
  h.mod.state.funilVisao = 'app'; h.mod.renderBoard(); b = h.el('board').innerHTML;
  check('visão No app mostra quem tem conta e não paga', b.includes('Caio') && !b.includes('Duda'));
  const h2 = await abre([lead({ id: 'e', user_id: 'u3' })], { visao: 'app' });
  check('sem a tabela de assinaturas ainda renderiza', h2.el('board').innerHTML.includes('Ana'));
}

console.log('== Segurança e regras ==');
{
  const h = await abre([lead({ id: 'x', nome: '<img src=x onerror=alert(1)>', aceita_novidades: false })]);
  const b = h.el('board').innerHTML;
  check('nome com HTML sai escapado', !b.includes('<img') && b.includes('&lt;img'));
  check('sem aceite: botão de e-mail desabilitado e sem data-emailfor', b.includes('disabled') && !b.includes('data-emailfor') && b.includes('Não aceitou novidades'));
  check('o nome ainda abre a ficha', b.includes('data-open="x"'));
  const h2 = await abre([lead({ id: 'y', nome: 'Yara', email_status: 'clicado', dias_para_prazo: 20, email_enviado_em: ha(6) })]);
  check('"Por que aqui?" começa fechado', !h2.el('board').innerHTML.includes('fn-mais'));
  h2.mod.state.funilPorque = 'y'; h2.mod.renderBoard();
  check('aberto mostra a conta dos pontos', h2.el('board').innerHTML.includes('fn-mais') && h2.el('board').innerHTML.includes('Clicou no último e-mail'));
}

console.log('== Cliques ==');
{
  const h = await abre([lead({ id: 'z', nome: 'Zeca', resposta_aberta_id: 1 })]);
  await h.click({ fv: 'clientes' });
  check('clicar na aba troca a visão', h.mod.state.funilVisao === 'clientes');
  await h.click({ fporque: 'z' });
  check('clicar em "Por que aqui?" guarda o cartão aberto', h.mod.state.funilPorque === 'z');
  await h.click({ fporque: 'z' });
  check('clicar de novo fecha', h.mod.state.funilPorque === null);
}

console.log(failed ? `\n${failed} falhou, ${passed} passou` : `\nOK: ${passed} verificações`);
process.exit(failed ? 1 : 0);
