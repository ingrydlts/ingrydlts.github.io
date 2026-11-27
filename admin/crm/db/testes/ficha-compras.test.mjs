// Testa ficha-compras.js (a sessão "Compras": fluxo de entrada, insights de e-mail, selo e chave). Puro, sem banco.
// Uso: cd admin/crm/db/testes && node ficha-compras.test.mjs
import * as FC from '../../ficha-compras.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const h = { esc: (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
const AGORA = Date.parse('2026-12-10T12:00:00Z'), DIA = 864e5;
const iso = (diasAtras) => new Date(AGORA - diasAtras * DIA).toISOString();
const compra = (extra = {}) => ({ id: 1, referencia: 'cs_1', slug: 'manual-destrave-domiciliacao', valor_centavos: 990, moeda: 'EUR', pago_em: iso(5), acesso_ate: iso(-360), entregue_em: iso(5), ...extra });
const entregue = (extra = {}) => ({ modelo: 'guia_compra', assunto: 'Seu Manual chegou', status: 'entregue', enviado_em: iso(5), criado_em: iso(5), ...extra });
const tem = (lista, re, tom) => lista.some((i) => re.test(i.t) && (!tom || i.tom === tom));

console.log('== Dinheiro e nome ==');
check('9,90 €', FC.valorTexto(990, 'EUR') === '9,90 €' && FC.valorTexto(1990, 'EUR') === '19,90 €');
check('outra moeda não vira euro', FC.valorTexto(5000, 'BRL') === 'R$ 50,00');
check('nome do produto, com plano B para slug novo', FC.nomeProduto('manual-destrave-domiciliacao') === 'Manual Destrave: Endereço e Domiciliação' && FC.nomeProduto('guia-novo') === 'guia-novo');

console.log('== O fluxo de entrada ==');
let [o] = FC.montarCompras([compra()], [], [entregue()], AGORA);
check('nunca entrou: estado, contagem e alerta com o dia da compra', o.entradas.n === 0 && o.entradas.estado === 'nunca' && tem(o.insights, /Ainda não entrou no material \(comprou há 5 dias\)/, 'alerta'));
check('quem nunca entrou tem a ação de escrever com link e chave', o.insights.some((i) => i.acao && /link e a chave/.test(i.acao.rot)));
[o] = FC.montarCompras([compra({ pago_em: iso(0) })], [], [entregue()], AGORA);
check('comprou hoje: não é alerta', tem(o.insights, /Comprou hoje/) && !tem(o.insights, /Ainda não entrou/, 'alerta'));
[o] = FC.montarCompras([compra()], [{ compra_id: 1, em: iso(4) }, { compra_id: 1, em: iso(1) }, { compra_id: 2, em: iso(0) }], [entregue({ status: 'aberto' })], AGORA);
check('conta só as entradas desta compra e acha primeira e última', o.entradas.n === 2 && o.entradas.estado === 'ativa' && o.entradas.diasDesdeUltima === 1 && o.entradas.recentes[0] === iso(1));
check('"entrou 2 vezes, a última há 1 dia" é bom sinal', tem(o.insights, /Entrou 2 vezes no material, a última há 1 dia/, 'ok'));
[o] = FC.montarCompras([compra({ pago_em: iso(20) })], [{ compra_id: 1, em: iso(15) }], [entregue()], AGORA);
check('entrou 1 vez e parou há 15 dias: estado "parou" e alerta com ação', o.entradas.estado === 'parou' && tem(o.insights, /Parou: não volta ao material há 15 dias/, 'alerta') && o.insights.some((i) => i.acao));
[o] = FC.montarCompras([compra({ pago_em: iso(40) })], [1, 2, 3, 4, 5, 6].map((d) => ({ compra_id: 1, em: iso(d + 12) })), [entregue()], AGORA);
check('quem usa muito (5+) não é "parou" e vira momento de pedir relato', o.entradas.estado === 'ativa' && tem(o.insights, /Usa o material com frequência/, 'ok') && !tem(o.insights, /Parou/));
check('mostra no máximo as 10 entradas mais recentes', FC.montarCompras([compra()], Array.from({ length: 14 }, (_, i) => ({ compra_id: 1, em: iso(i) })), [], AGORA)[0].entradas.recentes.length === 10);
check('entrada com data inválida é ignorada', FC.montarCompras([compra()], [{ compra_id: 1, em: 'lixo' }], [], AGORA)[0].entradas.n === 0);

console.log('== E-mail de entrega ==');
check('sem e-mail no histórico: alerta', tem(FC.montarCompras([compra()], [{ compra_id: 1, em: iso(1) }], [], AGORA)[0].insights, /e-mail de entrega não aparece/, 'alerta'));
check('não entregue: alerta', tem(FC.montarCompras([compra()], [], [entregue({ status: 'nao_entregue' })], AGORA)[0].insights, /NÃO foi entregue/, 'alerta'));
check('clicou no link: bom sinal', tem(FC.montarCompras([compra()], [], [entregue({ status: 'clicado' })], AGORA)[0].insights, /clicou no link/, 'ok'));
check('2+ dias sem abrir e sem entrar: pode estar no spam', tem(FC.montarCompras([compra()], [], [entregue()], AGORA)[0].insights, /Ainda não abriu o e-mail de entrega.*spam/, 'alerta'));
check('só os e-mails da compra entram (modelo guia_compra)', FC.montarCompras([compra()], [], [entregue(), { modelo: 'aupair_chegada_1', status: 'aberto' }], AGORA)[0].mails.length === 1);

console.log('== Prazos ==');
[o] = FC.montarCompras([compra({ pago_em: iso(2) })], [], [entregue()], AGORA);
check('garantia de 7 dias e cupons de 30 dias aparecem enquanto valem', tem(o.insights, /Garantia de 7 dias até/) && tem(o.insights, /cupons da ligação valem até/));
[o] = FC.montarCompras([compra({ pago_em: iso(40), acesso_ate: iso(-20) })], [{ compra_id: 1, em: iso(1) }], [entregue({ status: 'aberto' })], AGORA);
check('depois de 7 e 30 dias, garantia e cupom somem', !tem(o.insights, /Garantia/) && !tem(o.insights, /cupons/));
check('acesso termina em 20 dias: alerta', tem(o.insights, /O acesso termina em 20 dias/, 'alerta'));
check('acesso vencido: alerta', tem(FC.montarCompras([compra({ acesso_ate: iso(3) })], [], [entregue()], AGORA)[0].insights, /terminou em/, 'alerta'));

console.log('== Várias compras, selo e HTML ==');
const duas = FC.montarCompras([compra({ id: 1, pago_em: iso(30) }), compra({ id: 2, referencia: 'cs_2', pago_em: iso(3) })], [], [], AGORA);
check('da mais recente à mais antiga', duas[0].id === 2 && duas[1].id === 1);
check('selo: sem compra não há selo', FC.seloComprou([], []) === null);
check('selo: comprou e ainda não entrou', FC.seloComprou([{ id: 1 }], []).texto === 'Comprou' && FC.seloComprou([{ id: 1 }], []).sub === 'ainda não entrou');
check('selo: comprou ×2 e entrou 3 vezes', FC.seloComprou([{ id: 1 }, { id: 2 }], [{ compra_id: 1 }, { compra_id: 2 }, { compra_id: 2 }]).texto === 'Comprou ×2' && FC.seloComprou([{ id: 1 }, { id: 2 }], [{ compra_id: 1 }, { compra_id: 2 }, { compra_id: 2 }]).sub === 'entrou 3 vezes');
check('sem compras: aviso vazio, sem erro', /ainda não comprou/.test(FC.htmlCompras([], h)));
const html = FC.htmlCompras(FC.montarCompras([{ ...compra(), slug: 'manual-destrave-domiciliacao' }], [{ compra_id: 1, em: iso(1) }], [entregue({ assunto: '<script>x</script>' })], AGORA).map((x) => ({ ...x, emailPagamento: 'a"b@example.com' })), h);
check('a sessão mostra produto, fluxo, chave e insights', /Manual Destrave: Endereço e Domiciliação/.test(html) && /Fluxo de entrada no material/.test(html) && /Chave de acesso/.test(html) && /Insights de e-mail/.test(html) && /data-fx="chaveCompra" data-ref="cs_1"/.test(html));
check('escapa o que vem do banco (assunto do e-mail e e-mail da compra)', !/<script>x/.test(html) && /&lt;script&gt;/.test(html) && /a&quot;b@example\.com/.test(html));
check('a chave NÃO vem no HTML da sessão (só ao clicar)', !/[A-Za-z0-9_-]{43}/.test(html.replace(/cs_1/g, '')));
const ch = FC.htmlChave({ chave: 'K'.repeat(43), link: 'https://w.example/guia/#k=' + 'K'.repeat(43), revogado: false }, h);
check('ao clicar: mostra a chave e copia a chave e o link SEM a chave na URL', ch.includes('K'.repeat(43)) && /data-txt="https:\/\/w\.example\/guia\/"/.test(ch));
check('chave revogada é avisada', /revogada/.test(FC.htmlChave({ chave: 'K'.repeat(43), link: 'https://w.example/guia/#k=x', revogado: true }, h)));
check('erro vira aviso, sem chave', /alert/.test(FC.htmlChave({ erro: 'Não achei a chave' }, h)) && /Não achei a chave/.test(FC.htmlChave({ erro: 'Não achei a chave' }, h)));

console.log('== O que o Potencial lê ==');
check('sem compras: nada (o Potencial fica como era)', FC.resumoParaPontos([], [], AGORA) === null);
const rp = FC.resumoParaPontos([{ id: 1, pago_em: iso(30) }, { id: 2, pago_em: iso(3) }], [{ compra_id: 1, em: iso(20) }, { compra_id: 2, em: iso(8) }, { compra_id: 9, em: iso(0) }], AGORA);
check('conta compras, entradas só das compras dela, última entrada e a compra mais recente', rp.n === 2 && rp.entradas === 2 && rp.diasSemEntrar === 8 && rp.diasDesdeCompra === 3);
check('sem entradas: diasSemEntrar fica vazio', FC.resumoParaPontos([{ id: 1, pago_em: iso(2) }], [], AGORA).diasSemEntrar === null);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
