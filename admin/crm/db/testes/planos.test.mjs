// Testa a lógica da página /planos/ (planos/planos.js) e confere o planos.json e o HTML da página. Em Node, sem navegador:
// o layout e os cliques de verdade são conferidos à mão (ou no Chromium, ver o roteiro em ONBOARDING.md, seção 15).
// Uso: cd admin/crm/db/testes && node planos.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(HERE, '../../../..');
const P = await import(pathToFileURL(path.join(RAIZ, 'planos/planos.js')).href);
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const n = (x) => String(x).replace(/\u00a0/g, ' ');   // o preço usa espaço sem quebra (não quebra linha no meio de "R$ 69")
const item = (nivel, periodicidade, moeda, valor, extra = {}) => ({ chave: `${nivel}_${periodicidade}_${moeda.toLowerCase()}`, nivel, periodicidade, moeda, valor, url: `https://buy.stripe.com/${nivel}${periodicidade}${moeda}`, ...extra });
const niveis = [{ chave: 'basico', nome: 'Básico', para: 'Quer se organizar sozinha.', beneficios: ['Checklist', 'Prazos'] }, { chave: 'inter', nome: 'Intermediário', destaque: true, beneficios: ['Tudo do Básico', '1 conversa por mês'] }, { chave: 'completo', nome: 'Completo', beneficios: [] }];
const arq = { teste_dias: 30, niveis, itens: [
  item('basico', 'mensal', 'BRL', 69), item('basico', 'semestral', 'BRL', 393), item('basico', 'anual', 'BRL', 745), item('basico', 'mensal', 'EUR', 12),
  item('inter', 'mensal', 'BRL', 149), item('inter', 'anual', 'BRL', 1609)] };

console.log('== Ler o planos.json ==');
let d = P.lerPlanos(arq);
check('mostra os níveis que têm algum preço no arquivo (o Completo não tem nenhuma linha: fica de fora)', d.niveis.map((n) => n.chave).join() === 'basico,inter' && d.itens.length === 6);
const semLink = P.lerPlanos({ niveis, itens: [item('basico', 'mensal', 'BRL', 69, { url: '' }), item('inter', 'mensal', 'BRL', 149, { url: undefined }), { ...item('basico', 'anual', 'BRL', 745), url: null }] });
check('preço sem link ainda (url vazia) fica na página, só sem botão de compra', semLink.itens.length === 3 && semLink.niveis.length === 2 && semLink.itens.every((i) => i.url === ''));
const cs = P.cartoes(semLink, 'BRL', 'mensal');
check('o cartão mostra o preço e marca que ainda não tem link ("em breve")', cs.every((c) => c.preco && c.comLink === false && c.item) && n(cs[0].preco) === 'R$ 69');
check('e o preço sem link ainda calcula a economia contra o mensal', P.cartoes(semLink, 'BRL', 'anual')[0].economia === 10);
check('com tudo sem link a escolha inicial é a primeira (R$ mensal)', JSON.stringify(P.escolhaInicial(semLink)) === JSON.stringify({ moeda: 'BRL', periodo: 'mensal' }));
check('guarda os dias de teste', d.teste_dias === 30 && P.lerPlanos({ ...arq, teste_dias: 0 }).teste_dias === 0 && P.lerPlanos({ ...arq, teste_dias: 'x' }).teste_dias === 0);
check('item de exemplo não conta: nível só com exemplo não aparece', P.lerPlanos({ niveis, itens: [item('basico', 'mensal', 'BRL', 69, { exemplo: true })] }).niveis.length === 0);
check('item fora do formato é ignorado (url http, valor zero, moeda ou nível desconhecidos, chave repetida)', P.lerPlanos({ niveis, itens: [
  { ...item('basico', 'mensal', 'BRL', 69), url: 'http://x' }, item('basico', 'mensal', 'BRL', 0), item('basico', 'mensal', 'USD', 5), item('nada', 'mensal', 'BRL', 5), item('basico', 'quinzenal', 'BRL', 5),
  item('basico', 'mensal', 'BRL', 69), item('basico', 'mensal', 'BRL', 70)] }).itens.length === 1);
check('arquivo que não é do formato não quebra', P.lerPlanos(null).niveis.length === 0 && P.lerPlanos({}).itens.length === 0 && P.lerPlanos('x').niveis.length === 0 && P.lerPlanos({ niveis: 'x', itens: 'y' }).itens.length === 0);
check('os benefícios são texto aparado, no máximo 15', P.lerPlanos({ niveis: [{ chave: 'a', nome: 'A', beneficios: [' x ', 3, '', ...Array(20).fill('y')] }], itens: [item('a', 'mensal', 'BRL', 5)] }).niveis[0].beneficios.length === 15);

console.log('\n== Opções e preços ==');
const o = P.opcoes(d);
check('só oferece moedas e periodicidades que têm algum preço', o.moedas.map((m) => m[0]).join() === 'BRL,EUR' && o.periodos.map((p) => p[0]).join() === 'mensal,semestral,anual');
check('moeda única: uma só opção', P.opcoes(P.lerPlanos({ niveis, itens: [item('basico', 'mensal', 'BRL', 69)] })).moedas.length === 1);
check('preço em reais e em euros no formato do Brasil, com espaço que não quebra linha', n(P.formatarValor(69, 'BRL')) === 'R$ 69' && n(P.formatarValor(12, 'EUR')) === '€ 12' && n(P.formatarValor(65.5, 'BRL')) === 'R$ 65,50' && P.formatarValor(69, 'BRL').includes('\u00a0'));
let c = P.cartoes(d, 'BRL', 'mensal');
check('um cartão por nível, com o preço e "por mês"', c.length === 2 && n(c[0].preco) === 'R$ 69' && c[0].sufixo === 'por mês' && c[0].equivale === null && c[0].economia === null);
c = P.cartoes(d, 'BRL', 'semestral');
check('semestral: total, equivalente por mês e a economia contra 6 meses no mensal (393 vs 414 = 5%)', n(c[0].preco) === 'R$ 393' && c[0].sufixo === 'a cada 6 meses' && n(c[0].equivale) === 'equivale a R$ 65,50 por mês' && c[0].economia === 5);
check('combinação sem nenhuma linha no arquivo vira "em breve" (item nulo, sem preço)', c[1].item === null && c[1].preco === null && c[1].comLink === false);
c = P.cartoes(d, 'BRL', 'anual');
check('anual: 745 contra 12 × 69 = 828 dá 10%', c[0].economia === 10 && c[0].sufixo === 'por ano' && c[1].economia === 10);
check('sem o preço mensal na mesma moeda não inventa economia', P.cartoes(d, 'EUR', 'semestral')[0].item === null && P.cartoes(P.lerPlanos({ niveis, itens: [item('basico', 'anual', 'EUR', 129)] }), 'EUR', 'anual')[0].economia === null);
check('o destaque vem do arquivo', c[1].nivel.destaque === true && c[0].nivel.destaque === false);
check('a escolha inicial é a combinação com mais planos (BRL mensal tem 2)', JSON.stringify(P.escolhaInicial(d)) === JSON.stringify({ moeda: 'BRL', periodo: 'mensal' }));
check('a escolha inicial prefere a combinação com mais links de compra', JSON.stringify(P.escolhaInicial(P.lerPlanos({ niveis, itens: [item('basico', 'mensal', 'BRL', 69, { url: '' }), item('basico', 'anual', 'EUR', 129), item('inter', 'anual', 'EUR', 280)] }))) === JSON.stringify({ moeda: 'EUR', periodo: 'anual' }));
check('sem nada para mostrar, sem escolha', P.escolhaInicial(P.lerPlanos({ niveis, itens: [] })) === null);

console.log('\n== O link de compra ==');
const ctx = { email: 'ana+teste@example.com', contato_id: '11111111-2222-4333-8444-555555555555' };
const u = new URL(P.urlCompra('https://buy.stripe.com/abc', ctx));
check('leva o e-mail (codificado) e o id da ficha', u.searchParams.get('prefilled_email') === 'ana+teste@example.com' && u.searchParams.get('client_reference_id') === ctx.contato_id && u.pathname === '/abc');
check('o que já vinha na URL do Stripe fica, o e-mail e o id são sobrescritos', (() => { const x = new URL(P.urlCompra('https://buy.stripe.com/abc?locale=pt-BR&prefilled_email=outro@x.com&client_reference_id=OUTRO', ctx)); return x.searchParams.get('locale') === 'pt-BR' && x.searchParams.get('prefilled_email') === 'ana+teste@example.com' && x.searchParams.get('client_reference_id') === ctx.contato_id; })());
check('id que não é uuid não vai', !new URL(P.urlCompra('https://buy.stripe.com/abc', { email: 'a@b.co', contato_id: 'x"><script>' })).searchParams.has('client_reference_id'));
check('só https, sem usuário e senha, e URL inválida vira nulo', P.urlCompra('http://buy.stripe.com/abc', ctx) === null && P.urlCompra('https://u:p@buy.stripe.com/abc', ctx) === null && P.urlCompra('javascript:alert(1)', ctx) === null && P.urlCompra('', ctx) === null);

console.log('\n== O arquivo e a página ==');
const real = P.lerPlanos(JSON.parse(readFileSync(path.join(RAIZ, 'planos/planos.json'), 'utf8')));
check('o planos.json versionado é o lançamento: um plano, 70 € por mês, só mensal em euros', real.niveis.map((x) => x.chave).join() === 'plataforma' && real.itens.length === 1 && real.itens[0].moeda === 'EUR' && real.itens[0].periodicidade === 'mensal' && real.itens[0].valor === 70);
check('link de compra, quando houver, é um Payment Link do Stripe', real.itens.every((i) => !i.url || /^https:\/\/buy\.stripe\.com\//.test(i.url)));
check('o plano mostra benefícios e a frase de quem é', real.niveis.every((x) => x.beneficios.length >= 4 && x.para.length > 10) && real.niveis.filter((x) => x.destaque).length <= 1);
const bruto = JSON.parse(readFileSync(path.join(RAIZ, 'planos/planos.json'), 'utf8'));
check('e nenhuma chave secreta', !/sk_(live|test)_|whsec_|rk_(live|test)_/.test(JSON.stringify(bruto)));
check('o preço segue o doc de pricing (70 € por mês)', bruto.itens.every((i) => i.valor === 70 && i.moeda === 'EUR' && i.periodicidade === 'mensal'));
const pg = readFileSync(path.join(RAIZ, 'planos/index.html'), 'utf8');
check('a página não é indexada e não vaza o link no Referer', /noindex/.test(pg) && /name="referrer" content="no-referrer"/.test(pg));
check('o token sai da barra de endereço antes de qualquer outro script', pg.indexOf("history.replaceState(null, '', location.pathname)") > 0 && pg.indexOf('replaceState') < pg.indexOf('/assets/js/main.js'));
check('todo texto vindo do arquivo ou do Worker entra por textContent (nenhum innerHTML)', !/innerHTML/.test(pg.slice(pg.indexOf('<script type="module">'))));
check('tem os estados: carregando, planos, vencido, inválido, erro e vazio', ['carregando', 'planos', 'vencido', 'invalido', 'erro', 'vazio'].every((e) => pg.includes('id="st-' + e + '"')));
check('o token vai por POST, não por URL (não fica em log de acesso)', /method: 'POST'.*body: JSON\.stringify\(\{ t: t \}\)/.test(pg) && !/planos\/contexto\?/.test(pg));
check('a página usa o arquivo do site e a lógica testada aqui', pg.includes("fetch('/planos/planos.json'") && pg.includes("from '/planos/planos.js'"));
check('os controles são botões de rádio acessíveis e os botões de compra têm nome acessível', /role="radiogroup"/.test(pg) && pg.includes("setAttribute('role', 'radio')") && pg.includes("setAttribute('aria-label'"));
check('a página leva às CGV e avisa do código de lançamento antes do pagamento', pg.includes("'/cgv/'") && /código de lançamento/.test(pg));
check('a página não faz nenhuma chamada a Stripe nem guarda nada no navegador', !/stripe\.com\/v1|localStorage|sessionStorage|document\.cookie/.test(pg));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
