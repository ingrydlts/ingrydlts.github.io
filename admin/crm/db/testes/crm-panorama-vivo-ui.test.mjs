// Testa o Panorama vivo no CRM: a conversa lida (montagens.proposta.panorama) aparece no Panorama dela, mesmo sem conta no app,
// e as hipóteses podem ser confirmadas ou descartadas. Rodando o crm.js de verdade em Node, com Supabase de mentira. Dados inventados.
// Uso: cd admin/crm/db/testes && node crm-panorama-vivo-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const PAN = { leitura: 'Ansiosa com o prazo, mas decidida a estudar.', termometros: [{ chave: 'angustia', nivel: 3, porque: 'Volta ao prazo', momento: '12:30' }],
  temas: [{ tema: 'Visto', peso: 3, nota: 'O prazo pesa', momento: '12:30' }], palavras: [{ palavra: 'prazo', vezes: 4 }], acoes: [{ texto: 'Ligar para a escola', dono: 'ela', momento: '20:05' }],
  maneiras: [{ chave: 'prefere_ligar', momento: '08:00' }], hipoteses: [{ texto: 'Provavelmente trava no telefone', evidencia: 'Evitou ligar', confirmar: 'Ver se concluiu Ligar', momento: '20:05' }] };
const MONT = [{ versao: 1, estado: 'publicada', criado_em: '2026-11-10T10:00:00Z', proposta: { bilan: { resumo: 'não vai para o panorama', afirmacoes: [] }, panorama: PAN } },
  { versao: 0, estado: 'pendente', criado_em: '2026-11-01T10:00:00Z', proposta: { bilan: { resumo: 'antiga, sem panorama', afirmacoes: [] } } }];

const monta = async (montagens) => {
  const h = await carregarCrm({ respostas: { montagens: { data: montagens, error: null } }, expor: ['fxCarregaConversas', 'fxSugAcao', 'fxPanoramaDados'] });
  const c = pessoa({ id: 'p2', user_id: null }); h.mod.setC([c]); h.mod.state.sel = 'p2';
  h.mod.state.dos = { cid: 'p2', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  return { h, c };
};

console.log('== Panorama vivo no CRM ==');
{
  let { h, c } = await monta([]);
  check('sem conta e sem conversa: continua o aviso de "ainda não entrou no app"', h.mod.fxSinaisCorpo(c).includes('ainda não entrou no app'));
  ({ h, c } = await monta(MONT));
  await h.mod.fxCarregaConversas(c, true);
  const html = h.mod.fxSinaisCorpo(c);
  check('com conversa lida e SEM conta no app, o Panorama já aparece, com "Como ela está"', html.includes('Como ela está') && html.includes('Angústia') && !html.includes('ainda não entrou no app'));
  check('a leitura da conversa é a leitura rápida; leituras sem panorama (antigas) são ignoradas', html.includes('Ansiosa com o prazo') && !html.includes('antiga, sem panorama'));
  check('nada do bilan nem de trechos vai para o Panorama', !html.includes('não vai para o panorama'));
  check('as conversas vão para o Panorama sem NaN/undefined', !/NaN|undefined/.test(html));
  check('os dados do Panorama carregam as conversas', h.mod.fxPanoramaDados(c).conversas.length === 2);
  const hid = (html.match(/data-id="(h-[^"]+)"/) || [])[1];
  check('a hipótese tem botão com id estável', !!hid);
  h.mod.fxSugAcao({ id: hid, v: 'confirmada' });
  check('confirmar a hipótese guarda a decisão neste navegador e o painel mostra', (h.store['crm_ficha_sugs_p2'] || '').includes('confirmada') && h.mod.fxSinaisCorpo(c).includes('Confirmada'));
  h.mod.fxSugAcao({ id: hid, v: 'descartada' });
  check('descartar a hipótese a tira do painel', !h.mod.fxSinaisCorpo(c).includes('Provavelmente trava'));
  const err = await carregarCrm({ respostas: { montagens: { data: null, error: { message: 'sem tabela' } } }, expor: ['fxCarregaConversas'] });
  const c3 = pessoa({ id: 'p3', user_id: null }); err.mod.setC([c3]); err.mod.state.sel = 'p3'; err.mod.state.dos = { cid: 'p3', chk: { semConta: true, itens: [] }, d: {}, rasc: {} };
  await err.mod.fxCarregaConversas(c3, true);
  check('se a tabela da montagem não existe, o Panorama segue como antes', err.mod.fxSinaisCorpo(c3).includes('ainda não entrou no app'));
}

console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
