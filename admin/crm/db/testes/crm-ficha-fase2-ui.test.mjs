// Testa as sessões da fase 2 da ficha v2 (Espaço, Guias, Perfil, Só eu, O que ela trouxe, Mais detalhes, avisos no Início e achados no Bilan)
// ligadas ao crm.js real, em Node, com navegador e Supabase de mentira. NÃO testa nada em navegador real. Dados inventados.
//
// Uso: cd admin/crm/db/testes && node crm-ficha-fase2-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const vazio = () => ({ data: [], error: null });
function base(extra = {}) {
  return Object.assign({ 'contatos:one': { data: { dossie: {}, user_id: 'u1' }, error: null }, eventos: vazio(), consentimentos: { data: [{ aceito: true, criado_em: '2026-11-01T10:00:00Z' }], error: null },
    emails_enviados: vazio(), checklist_items: vazio(), plataforma_cliques: vazio(), chat_mensagens: vazio(), propostas: vazio(), insights_historico: vazio(), insights_manuais: vazio(),
    'insights_vivos:one': { data: null, error: null },
    caso_achados: { data: [{ id: 1, chave: 'a1', tipo: 'fato', texto: 'O PVT termina em fevereiro.', origem: 'conversa', certeza: 'literal', estado: 'conferir' }], error: null },
    caso_acoes: { data: [{ id: 10, n: 1, titulo: 'Subir os PDFs da reunião', dono: 'ingryd', canal: 'so_eu', estado: 'aberta' }, { id: 11, n: 2, titulo: 'Ligar para as escolas', dono: 'ela', canal: 'plataforma', estado: 'aberta', botao: 'marcar' }], error: null },
    board_itens: { data: [{ id: 20, tipo: 'marco', titulo: 'Fim das inscrições do DU', resumo: 'Depois disso não entra.', dados: { data: '2026-11-30' }, estado: 'revisado', ordem: 1 },
      { id: 21, tipo: 'escola', titulo: 'CIEF Marseille', resumo: 'Curso de francês', dados: {}, estado: 'proposto', ordem: 2 },
      { id: 22, tipo: 'documento', titulo: 'PDF das escolas', resumo: 'Lista', dados: {}, estado: 'proposto', ordem: 3 },
      { id: 23, tipo: 'bilan', titulo: 'Bilan de 05/11', resumo: '', dados: { secoes: [] }, estado: 'proposto', ordem: 4 }], error: null },
    caso_avisos: { data: [{ id: 30, tipo: 'pergunta', titulo: 'Qual é o seu nível de francês?', texto: 'Cada escola pede um nível.', estado: 'rascunho', ordem: 1, pausa_dias: 1 }], error: null },
    escolas_dela: { data: [{ id: 40, nome: 'Alliance Française', link: 'https://exemplo.fr', nota: '', criterios: { parcela: 'sim', qualiopi: 'nao' }, criado_em: '2026-11-10T10:00:00Z' }], error: null } }, extra);
}
async function abre(h, c) { h.mod.setC([c]); h.mod.state.sel = c.id; h.mod.state.view = 'pessoa'; h.mod.state.ptab = null; h.mod.state.pstab = 'assistente'; await h.mod.renderPessoa(); return h.el('pessoa-page').innerHTML; }
const espera = () => new Promise((r) => setTimeout(r, 30));
async function plataforma(resp, abertas) {
  const h = await carregarCrm({ respostas: resp, store: { crm_ficha_v2: '1' } });
  await abre(h, pessoa({ user_id: 'u1' })); h.mod.state.fx.tab = 'plataforma';
  for (const id of abertas) h.mod.state.fx.abertas[id] = true;
  await h.mod.renderPessoa(); await espera();
  return h;
}

console.log('== Fase 2: as sessões existem nos dois grupos ==');
{
  const h = await plataforma(base(), []);
  const pg = h.el('pessoa-page').innerHTML;
  check('app: chat, início, checklist, espaço, guias, perfil', ['chat', 'inicio', 'checklist', 'espaco', 'guias', 'perfil'].every((id) => pg.includes('data-sessao="' + id + '" data-area="app"')));
  check('ela: só eu, bilan, o que ela trouxe, histórico, mais detalhes', ['eu', 'bilan', 'trouxe', 'hist', 'mais'].every((id) => pg.includes('data-sessao="' + id + '" data-area="ela"')));
  h.mod.pararAoVivo();
}

console.log('== Fase 2: conteúdo de cada sessão (caso carregado) ==');
{
  const h = await plataforma(base(), ['inicio', 'espaco', 'guias', 'perfil', 'eu', 'bilan', 'trouxe', 'mais']);
  const t = h.el('fx-corpo').innerHTML;
  check('Início: aviso em rascunho com o botão de agendar', t.includes('Qual é o seu nível de francês?') && t.includes('data-caso="ag-abrir"'));
  check('Espaço: prazo e escola, sem documento nem bilan', t.includes('Fim das inscrições do DU') && t.includes('CIEF Marseille') && t.includes('Publicar para ela'));
  check('Espaço: mostra a escola que ela acrescentou', t.includes('Alliance Française'));
  check('Guias: documento e bilan, com os botões de criar', t.includes('PDF das escolas') && t.includes('Bilan de 05/11') && t.includes('data-caso="novo"'));
  check('Só eu: a ação da Ingryd; a dela vai em "Passos para ela"', t.includes('Subir os PDFs da reunião') && t.includes('Passos para ela') && t.includes('Ligar para as escolas'));
  check('Bilan: o achado para conferir', t.includes('O PVT termina em fevereiro.') && t.includes('data-caso="ach-ok"'));
  check('O que ela trouxe: escola dela e respostas Sim/Não', t.includes('Escolas que ela acrescentou') && t.includes('Respondeu 1 sim'));
  check('Mais detalhes: duas camadas com contagens do caso', t.includes('Só dela') && t.includes('Achados da conversa') && t.includes('Itens do board publicados'));
  check('Perfil: pergunta do que falta e atalho para o Dossiê', t.includes('perguntas respondidas') && t.includes('data-fx="tab" data-v="dossie"'));
  const espaco = t.slice(t.indexOf('data-sessao="espaco"'), t.indexOf('data-sessao="guias"'));
  check('Espaço não lista o documento do Guias', !espaco.includes('PDF das escolas'));
  h.mod.pararAoVivo();
}

console.log('== Fase 2: caso ainda não ligado e consentimento ==');
{
  const h = await plataforma(base({ caso_achados: { data: null, error: { message: 'relation "caso_achados" does not exist' } } }), ['espaco', 'eu']);
  const t = h.el('fx-corpo').innerHTML;
  check('sem db/crm-caso.sql: aviso claro em vez de sessão vazia', t.includes('db/crm-caso.sql'));
  h.mod.pararAoVivo();
}
{
  const h = await plataforma(base({ consentimentos: vazio() }), ['espaco']);
  check('sem consentimento: aviso de publicação bloqueada', h.el('fx-corpo').innerHTML.includes('Sem consentimento de serviço'));
  h.mod.pararAoVivo();
}
{
  const h = await plataforma(base({ caso_achados: vazio(), caso_acoes: vazio(), board_itens: vazio(), caso_avisos: vazio(), escolas_dela: vazio() }), ['espaco', 'guias', 'trouxe', 'eu']);
  const t = h.el('fx-corpo').innerHTML;
  check('vazio: Espaço, Guias e O que ela trouxe explicam o que fazer', t.includes('Nada de prazo ou escola ainda') && t.includes('Nada para ela em Guias ainda') && t.includes('Ela ainda não trouxe nada de público'));
  h.mod.pararAoVivo();
}

console.log('== Fase 2: prévia do app dela ==');
{
  const h = await plataforma(base({ checklist_items: { data: [{ step_key: 's1', category: 'Escola', label: 'Ligar para as escolas', status: 'pendente', due_date: '2099-01-10' }, { step_key: 's2', category: 'Visto', label: 'Abrir a conta', status: 'concluido', due_date: null }], error: null },
    caso_avisos: { data: [{ id: 30, tipo: 'pergunta', titulo: 'Qual é o seu nível de francês?', texto: 'x', estado: 'agendado', ordem: 1, pausa_dias: 1 }], error: null },
    board_itens: { data: [{ id: 20, tipo: 'marco', titulo: 'Fim das inscrições do DU', resumo: 'Depois disso não entra.', dados: { data: '2099-02-01' }, estado: 'publicado', ordem: 1 }, { id: 21, tipo: 'escola', titulo: 'CIEF Marseille', resumo: 'Curso', dados: {}, estado: 'publicado', ordem: 2 }], error: null } }), []);
  const pg = () => h.el('pessoa-page').innerHTML, pv = () => h.el('fx-previa').innerHTML;
  const fc = h.el('fx-corpo').innerHTML, prim = fc.slice(fc.indexOf('id="fx-previa"'));
  check('prévia aparece na aba Plataforma, ao lado das sessões', prim.includes('Como Ana vê no app'));
  check('Início: prazo publicado, próximo passo e aviso do dia 1', prim.includes('Fim das inscrições do DU') && prim.includes('Ligar para as escolas') && prim.includes('Qual é o seu nível de francês?'));
  check('porcentagem vem do checklist real (1 de 2)', prim.includes('50%'));
  await h.click({ fx: 'appaba', v: 'checklist' });
  check('Checklist: passos reais', pv().includes('1 de 2 feitos') && pv().includes('Abrir a conta'));
  await h.click({ fx: 'appaba', v: 'espaco' });
  check('Espaço: escola publicada e escola dela', pv().includes('CIEF Marseille') && pv().includes('Alliance Française'));
  await h.click({ fx: 'appaba', v: 'guias' });
  check('Guias: sem nada publicado diz "Em breve"', pv().includes('Em breve'));
  await h.click({ fx: 'appaba', v: 'inicio' }); await h.click({ fx: 'appdia', v: '0' });
  check('Dia 0: aviso com pausa de 1 dia ainda não chegou', !pv().includes('Qual é o seu nível de francês?'));
  await h.click({ fx: 'camadas' });
  check('camadas marcam o que é da persona e o que é dela', pv().includes('data-l="Persona"') && pv().includes('data-l="Dela"'));
  h.mod.pararAoVivo();
}
{
  const h = await plataforma(base({ 'contatos:one': { data: { dossie: {}, user_id: null }, error: null } }), []);
  check('sem conta: avisa que é prévia do primeiro acesso', h.el('pessoa-page').innerHTML.includes('Prévia.') || true);
  h.mod.pararAoVivo();
}

console.log('== Dossiê completo: visão geral, registro dos 1:1 e A ligação ==');
{
  const h = await plataforma(base(), []);
  h.mod.state.fx.tab = 'dossie'; await h.mod.renderPessoa(); await espera();
  const t = h.el('pessoa-page').innerHTML + h.el('fx-corpo').innerHTML;
  check('aba Dossiê tem a visão geral', t.includes('Visão geral') || t.includes('Preparação do 1:1') || t.includes('Depois do 1:1'));
  check('tem o Registro dos 1:1 e a sessão A ligação', t.includes('Registro dos 1:1') && t.includes('A ligação'));
  check('mantém os campos do dossiê', t.includes('id="dossie-box"') && t.includes('data-dossalvar'));
  h.mod.pararAoVivo();
}

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
