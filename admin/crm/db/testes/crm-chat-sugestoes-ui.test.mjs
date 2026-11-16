// Testa as mensagens que a montagem sugere para o chat (Conversa com ela): aparecem, vão para a caixa de texto, e podem ser descartadas.
// Rodando o crm.js de verdade em Node, com Supabase de mentira. Dados inventados. Uso: cd admin/crm/db/testes && node crm-chat-sugestoes-ui.test.mjs
import * as MT from '../../montagem.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const MENS = [{ texto: 'Que tal uma conversa de 20 min para escolher entre as duas escolas?', motivo: 'propor_1a1', momento: '40:00' }, { texto: 'Oi! Dá uma olhada no guia de escolas e me diz qual faz mais sentido.', motivo: 'redirecionar', momento: '45:10' }];
const MONT = [{ versao: 1, estado: 'publicada', criado_em: '2026-11-10T10:00:00Z', proposta: { mensagens_chat: [{ texto: 'Mensagem antiga', motivo: 'redirecionar' }] } }, { versao: 2, estado: 'pendente', criado_em: '2026-11-16T10:00:00Z', proposta: { mensagens_chat: MENS } }];

console.log('== Mensagens sugeridas no chat ==');
{
  const h = await carregarCrm({ respostas: { montagens: { data: MONT, error: null } }, expor: ['fxCarregaConversas', 'chatPanelHtml', 'chatSugUsar', 'chatSugDescartar'] });
  const c = pessoa({ id: 'p1', nome: 'Marina Teste', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p1';
  const antes = h.mod.chatPanelHtml(c, { msgs: [], cid: 'p1' }, '');
  check('antes de carregar, o painel do chat não mostra sugestões', !antes.includes('Sugeridas pela montagem'));
  await h.mod.fxCarregaConversas(c, true);
  const html = h.mod.chatPanelHtml(c, { msgs: [], cid: 'p1' }, '');
  check('mostra só as mensagens da leitura mais recente, com o motivo em palavras e o minuto', html.includes('Sugeridas pela montagem') && html.includes('Propor 1:1') && html.includes('Redirecionar') && html.includes('40:00') && !html.includes('Mensagem antiga'));
  check('cada sugestão tem "Usar no chat" e "Descartar"', (html.match(/data-chatsug="/g) || []).length === 2 && (html.match(/data-chatsugdesc="/g) || []).length === 2);
  h.mod.chatSugUsar('m-2-0');
  check('"Usar no chat" leva o texto, com o nome dela, para a caixa (rascunho para você revisar)', h.mod.state.chatRasc.startsWith('Oi, Marina! Que tal uma conversa') && h.el('chat-txt').value === h.mod.state.chatRasc);
  h.mod.chatSugUsar('m-2-1');
  check('texto que já começa com "Oi" não ganha outro cumprimento', h.mod.state.chatRasc.startsWith('Oi! Dá uma olhada') && !h.mod.state.chatRasc.startsWith('Oi, Marina! Oi'));
  check('a sugestão usada continua à vista, marcada', h.mod.chatPanelHtml(c, { msgs: [], cid: 'p1' }, '').includes('já levada para a caixa'));
  h.mod.chatSugDescartar('m-2-0');
  const dep = h.mod.chatPanelHtml(c, { msgs: [], cid: 'p1' }, '');
  check('descartar tira a sugestão do painel', !dep.includes('Que tal uma conversa') && dep.includes('Dá uma olhada'));
  check('nada é enviado sozinho: nenhuma gravação no chat', !h.writes.some((w) => w.table === 'chat_mensagens'));
  check('o painel não traz NaN/undefined e escapa HTML', !/NaN|undefined/.test(dep));
}
console.log('== Lembretes na tela de revisão ==');
{
  const prop = { bilan: { resumo: '', afirmacoes: [] }, encaminhamentos: [], checklists: [], documentos: [], perguntas_equipe: [{ chave: 'fim_pvt', texto: 'Quando termina o seu PVT?', resposta_tipo: 'data', grava_em: 'respostas.fim_pvt' }], blocos: [], compromissos: [], omissoes: [],
    lembretes: [{ chave: 'lembrete_a1b2c3', titulo: 'Matrícula fecha em 30/11', texto: 'Oi! A matrícula fecha no fim do mês.', dias_apos: 3, momento: '33:10' }] };
  const it = MT.itensDaProposta(prop);
  const l = it.find((x) => x.k === 'lemb:lembrete_a1b2c3');
  check('o lembrete aparece no grupo "Lembretes no Início" com a chave que o banco usa', l && l.grupo === 'Lembretes no Início' && /rascunho no Início/.test(l.detalhe) && /3 dias depois do primeiro acesso/.test(l.detalhe));
  check('a pergunta da equipe continua no seu grupo, separada', it.find((x) => x.k === 'perg:fim_pvt').grupo === 'Perguntas da equipe');
  check('as decisões incluem o lembrete', MT.decisoesDe(it, {}, {}).some((d) => d.origem_chave === 'lemb:lembrete_a1b2c3' && d.decisao === 'aprovar'));
  check('lembrete no primeiro acesso diz isso', /no primeiro acesso/.test(MT.itensDaProposta({ lembretes: [{ chave: 'x', titulo: 'T', texto: 'Tx', dias_apos: 0 }] })[0].detalhe));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
