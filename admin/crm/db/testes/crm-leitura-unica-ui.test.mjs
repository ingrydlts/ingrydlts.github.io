// Testa o fluxo único: "Ler a call com IA" lê o Pós-call E a montagem; uma lista só (marcar e EDITAR o texto); um "Aplicar o que marquei" só,
// que já monta a plataforma. Rodando o crm.js de verdade em Node, com Worker e Supabase de mentira. Dados inventados.
// Uso: cd admin/crm/db/testes && node crm-leitura-unica-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const POS = { ok: true, id: 9, vocabulario: [], proposta: { resumo: 'Resumo da call.', proximos_passos: ['Ligar'], campos: {}, sinais: [], itens_candidatos: [{ titulo: 'Notícia', texto: 'Texto', tema: 'outro', fator: 'legal', camada: 'padrao', motivo_camada: 'm' }], perguntas_dela: [{ texto: 'Ela perguntou X', tema: 'outro' }], respostas_dadas: [], a_conferir: ['Conferir A'], perguntas_para_ela: [{ texto: 'Qual o ano?', motivo: 'faltou' }], pontos_de_atencao: [] } };
const MONT = () => ({ ok: true, id: 5, versao: 1, proposta: { bilan: { resumo: 'R', afirmacoes: [], email: { duvidas: [], proximos: ['Ligar'], respostas: [] } }, encaminhamentos: [{ chave: 'ligar', texto: 'Ligar para a escola', camada: 'particular', dono: 'ela', prazo: null, prazo_texto: '', origem: { momento: '', trecho: '' }, certeza: 'literal', cobre: [] }],
  checklists: [{ chave: 'l', titulo: 'Lista', origem: 'particular', itens: [{ chave: 'a', titulo: 'Item A', demarche: 'banco', subitens: [], prazo: null, fonte: null, nivel: null, a_conferir: true }] }], documentos: [], perguntas_equipe: [], blocos: [], compromissos: [], omissoes: [], lembretes: [], mensagens_chat: [], panorama: {} } });
const pub = { ha_rascunho_aprovado: true, itens_prontos: 1, itens_proposta: 0, itens_a_conferir: 1, conta_ja_existe: false, tem_assinatura: false, a_conferir_itens: [{ id: 41, titulo: 'Item A' }] };
const TRANSC = 'Ela contou que o PVT termina em fevereiro e quer estudar francês. '.repeat(8);

const monta = async ({ pos = POS, mont = MONT(), posOk = true, montOk = true } = {}) => {
  const chamadas = [];
  const fetch = async (url, opt) => { chamadas.push(String(url)); const u = String(url);
    if (/pos-call\/ler/.test(u)) return posOk ? { ok: true, status: 200, json: async () => pos } : { ok: false, status: 502, json: async () => ({ ok: false, error: 'IA fora do ar' }) };
    if (/montagem\/ler/.test(u)) return montOk ? { ok: true, status: 200, json: async () => mont } : { ok: false, status: 502, json: async () => ({ ok: false, error: 'resposta cortada' }) };
    return { ok: false, json: async () => ({}) }; };
  const rpcResp = { crm_montagem_diff: { data: null, error: null }, crm_montagem_aplicar: { data: { criados: 2, atualizados: 0, mantidos: 0, rejeitados: 0, conflitos: [] }, error: null }, crm_montagem_publicavel: { data: pub, error: null },
    crm_acao_conferida: { data: null, error: null }, crm_montagem_liberar: { data: { liberados: 2, a_conferir_pulados: 0, publicados_agora: false }, error: null }, crm_pos_call_aplicar: { data: null, error: null }, crm_montagem_descartar: { data: null, error: null }, crm_pos_call_descartar: { data: null, error: null } };
  const h = await carregarCrm({ sessao: { access_token: 'tok' }, fetch, rpcResp, respostas: { montagens: { data: [], error: null } }, expor: ['pcLer', 'poscallHtml', 'montSlotHtml', 'montEstado', 'pcEstado', 'pcAplicarTudo', 'pcDescartarTudo', 'montEmbutido'] });
  const c = pessoa({ id: 'p1' }); h.mod.setC([c]); h.mod.state.sel = 'p1'; h.mod.state.view = 'contatos';
  h.mod.state.dos = { cid: 'p1', chk: { semConta: true, itens: [] }, d: {}, rasc: { ligacao_transcricao: TRANSC } };
  const pc = h.mod.pcEstado('p1'); pc.carregou = true; pc.vocab = [];
  return { h, c, chamadas };
};

console.log('== Um botão lê as duas coisas ==');
{
  const { h, c, chamadas } = await monta();
  await h.mod.pcLer('p1', { disabled: false });
  check('um clique chama o Pós-call E a montagem (uma vez cada)', chamadas.filter((u) => /pos-call\/ler/.test(u)).length === 1 && chamadas.filter((u) => /montagem\/ler/.test(u)).length === 1);
  const html = h.mod.poscallHtml(c, true);
  check('a lista da plataforma aparece DENTRO do painel do Pós-call (um "Aplicar" só, sem "Propor a montagem")', html.includes('Plataforma dela: Checklist, Avisos e Espaço') && html.includes('Item A') && (html.match(/data-pcaplicar=/g) || []).length === 1 && !html.includes('data-montler') && !html.includes('data-montaplicar'));
  check('a montagem não aparece de novo sozinha embaixo (sem duplicar)', h.mod.montEmbutido('p1') && !/Item A/.test(h.mod.montSlotHtml(c)) && !h.mod.montSlotHtml(c).includes('Propor a montagem'));
  check('a curadoria fica numa gaveta fechada e a lista da plataforma vem antes do botão de aplicar', /data-dd="pc-cur"/.test(html) && !/data-dd="pc-cur" open/.test(html) && html.indexOf('Plataforma dela') < html.indexOf('data-pcaplicar'));
  check('cada item da lista tem checkbox e botão Editar', /data-montmarca="chk:l:a"/.test(html) && /data-montedito="chk:l:a"/.test(html));
}
console.log('== Marcar, editar e aplicar tudo de uma vez ==');
{
  const { h, c } = await monta();
  await h.mod.pcLer('p1', { disabled: false });
  const m = h.mod.montEstado('p1'); m.edits = { 'chk:l:a': 'Item A reescrito por mim' }; m.sel = { 'enc:ligar': false };
  const html = h.mod.poscallHtml(c, true);
  check('o texto editado aparece na lista com a marca "editado"', html.includes('Item A reescrito por mim') && html.includes('editado'));
  h.rpcs.length = 0;
  await h.mod.pcAplicarTudo('p1', { disabled: false });
  const ordem = h.rpcs.map((r) => r.n).filter((n) => /crm_montagem_aplicar|crm_acao_conferida|crm_montagem_liberar|crm_pos_call_aplicar/.test(n));
  check('um clique: aplica a plataforma, confere, libera e só então aplica o Dossiê', JSON.stringify(ordem) === JSON.stringify(['crm_montagem_aplicar', 'crm_acao_conferida', 'crm_montagem_liberar', 'crm_pos_call_aplicar']));
  const dec = h.rpcs.find((r) => r.n === 'crm_montagem_aplicar').a.p_decisoes;
  check('o texto que você editou vai para o banco como decisão "editar"; o desmarcado vai rejeitado', dec.find((d) => d.origem_chave === 'chk:l:a').decisao === 'editar' && dec.find((d) => d.origem_chave === 'chk:l:a').texto === 'Item A reescrito por mim' && dec.find((d) => d.origem_chave === 'enc:ligar').decisao === 'rejeitar');
}
console.log('== Quando uma das leituras falha ==');
{
  let { h, c } = await monta({ montOk: false });
  await h.mod.pcLer('p1', { disabled: false });
  let html = h.mod.poscallHtml(c, true);
  check('se só a plataforma falhar, o Pós-call aparece e avisa o que falhou (sem lista da plataforma)', html.includes('data-pcaplicar') && html.includes('leitura da plataforma dela falhou') && html.includes('resposta cortada') && !html.includes('Plataforma dela: Checklist'));
  ({ h, c } = await monta({ posOk: false }));
  await h.mod.pcLer('p1', { disabled: false });
  check('se só o Pós-call falhar, a plataforma aparece sozinha, com o botão de aprovar dela', h.mod.pcEstado('p1').estado === 'vazio' && /Item A/.test(h.mod.montSlotHtml(c)) && /data-montaplicar/.test(h.mod.montSlotHtml(c)));
}
console.log('== Descartar ==');
{
  const { h } = await monta();
  await h.mod.pcLer('p1', { disabled: false });
  h.rpcs.length = 0; await h.mod.pcDescartarTudo('p1', { disabled: false });
  check('descartar a proposta descarta as duas leituras', h.rpcs.some((r) => r.n === 'crm_montagem_descartar' && r.a.p_id === 5) && h.rpcs.some((r) => r.n === 'crm_pos_call_descartar'));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
