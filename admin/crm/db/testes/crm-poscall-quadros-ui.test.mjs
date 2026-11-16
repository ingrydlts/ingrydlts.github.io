// Testa o quadro único "Infos para confirmar" do Pós-call (pontos de atenção + conferir na fonte + confirmar com ela, em gavetas).
// Rodando o crm.js de verdade em Node, com Supabase de mentira. Dados inventados.
// Uso: cd admin/crm/db/testes && node crm-poscall-quadros-ui.test.mjs
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const PROP = (extra) => ({ resumo: 'Resumo da call.', proximos_passos: ['Ligar'], pontos_de_atencao: [], a_conferir: ['Prazo de inscrição: 30/11 ou 15/12', 'Se o diploma precisa de tradução'],
  perguntas_para_ela: [{ texto: 'Seu visto PVT acaba em 28 de fevereiro de que ano?', motivo: 'A call deu só dia e mês', campo: null }, { texto: 'Quantos anos você tem?', motivo: 'A idade não foi dita', campo: null }], ...(extra || {}) });
const monta = async (proposta, dd) => {
  const h = await carregarCrm({ respostas: {}, expor: ['pcQuadrosHtml', 'pcEstado'] });
  const c = pessoa({ id: 'p1' }); h.mod.setC([c]); h.mod.state.sel = 'p1';
  if (dd) h.mod.state.fx.dd = dd;
  const pc = h.mod.pcEstado('p1'); if (proposta) { pc.estado = 'proposta'; pc.prop = { id: 1, proposta }; }
  return { h, c };
};

console.log('== Quadro único ==');
{
  let { h, c } = await monta(PROP());
  let html = h.mod.pcQuadrosHtml(c);
  check('há um quadro só ("Infos para confirmar"), sem os dois quadros lado a lado', (html.match(/class="dv-card"/g) || []).length === 1 && !html.includes('dv-grid') && html.includes('Infos para confirmar'));
  check('sem pontos de atenção, não aparece bloco de atenção nem "A leitura não apontou nada"', !html.includes('Pontos de atenção') && !html.includes('não apontou nada'));
  check('as seções viram gavetas com contagem: conferir na fonte (2) e confirmar com ela (2)', /<details[^>]*data-dd="pc-conf"[\s\S]*?Conferir na fonte oficial[\s\S]*?2/.test(html) && /<details[^>]*data-dd="pc-perg"[\s\S]*?Confirmar com ela[\s\S]*?2/.test(html));
  check('"Confirmar com ela" abre por padrão (é o que você age) e "Conferir na fonte" fica fechada (só leitura)', /data-dd="pc-perg" open/.test(html) && !/data-dd="pc-conf" open/.test(html));
  check('as perguntas continuam marcáveis e o botão leva para o chat', (html.match(/data-pcperg="q\d"/g) || []).length === 2 && html.includes('data-pcchat="p1"') && html.includes('Levar para o chat'));
  check('o botão de preencher Resumo e Próximos passos continua', html.includes('data-pcpreencher="p1"'));
  check('o conteúdo das gavetas fechadas continua no HTML (nada some)', html.includes('Prazo de inscrição: 30/11') && html.includes('Se o diploma precisa de tradução'));

  ({ h, c } = await monta(PROP({ pontos_de_atencao: ['O visto vence em fevereiro', 'A escola exige atestação'] })));
  html = h.mod.pcQuadrosHtml(c);
  check('com pontos de atenção, entram no mesmo quadro, no alto, e abertos', html.includes('Pontos de atenção') && html.indexOf('Pontos de atenção') < html.indexOf('Conferir na fonte oficial') && /data-dd="pc-aten" open/.test(html) && (html.match(/class="dv-card"/g) || []).length === 1);
  check('o contador do quadro soma tudo (2 atenção + 2 conferir + 2 perguntas = 6)', /Infos para confirmar[^<]*6/.test(html) || /6 itens/.test(html));

  ({ h, c } = await monta(PROP({ perguntas_para_ela: [], a_conferir: [] })));
  html = h.mod.pcQuadrosHtml(c);
  check('leitura que não deixou nada a confirmar diz isso, sem gavetas vazias', html.includes('nada a confirmar com ela') && !html.includes('<details'));

  ({ h, c } = await monta(PROP(), { 'pc-conf': true, 'pc-perg': false }));
  html = h.mod.pcQuadrosHtml(c);
  check('a gaveta lembra se você a abriu ou fechou', /data-dd="pc-conf" open/.test(html) && !/data-dd="pc-perg" open/.test(html));

  ({ h, c } = await monta(null));
  html = h.mod.pcQuadrosHtml(c);
  check('antes da leitura: o mesmo quadro com "Aparece depois da leitura."', html.includes('Infos para confirmar') && html.includes('Aparece depois da leitura') && !html.includes('<details'));
  ({ h, c } = await monta(PROP({ perguntas_para_ela: [{ texto: '<img src=x>', motivo: '<b>x</b>' }] })));
  check('escapa HTML e não traz NaN/undefined', !h.mod.pcQuadrosHtml(c).includes('<img') && !/NaN|undefined/.test(h.mod.pcQuadrosHtml(c)));
}
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
