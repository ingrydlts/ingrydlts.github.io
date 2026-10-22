// Testa o dossiê da ficha (topo, igual em todas as abas), rodando o crm.js de verdade em Node com um navegador e
// um Supabase de mentira. NÃO testa nada em navegador real (layout, clique de verdade, foco).
//
// Uso: cd admin/crm/db/testes && node crm-dossie-ui.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const src = readFileSync(path.resolve(HERE, '../../crm.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^boot\(\)\.catch.*$/m, '');

const els = new Map(), handlers = {};
function el(id) {
  if (!els.has(id)) els.set(id, { id, innerHTML: '', value: '', hidden: false, style: {}, dataset: {}, textContent: '', addEventListener() {}, setAttribute() {}, focus() {}, matches: () => false });
  return els.get(id);
}
const document = { getElementById: el, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); }, querySelectorAll: () => [], querySelector: () => null };
const writes = [], rpcs = [];
let respostas = {};
function qb(table) {
  const b = { select: () => b, eq: () => b, or: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => respostas[table + ':one'] || { data: null, error: null },
    update: (row) => ({ eq: async () => { writes.push({ table, row }); return { error: null }; } }),
    insert: async () => ({ error: null }),
    then: (ok, ko) => Promise.resolve(respostas[table] || { data: [], error: null }).then(ok, ko) };
  return b;
}
const supabase = { from: qb, auth: { getSession: async () => ({ data: { session: null } }) },
  rpc: async (n, a) => { rpcs.push({ n, a }); return { data: null, error: null }; } };
const store = {};
const mod = new Function('supabase', 'ES', 'document', 'window', 'location', 'localStorage',
  src + '\n;return { state, setC: function (v) { C = v; }, renderPessoa, eventText, dosProgresso, dosVisiveis };')(
  supabase, {}, document, { addEventListener() {} }, { href: '' }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } });

const base = { id: 'c1', email: 'ana@example.com', nome: 'Ana', estagio: 'em_uso', urgencia: 'baixa', persona: 'au_pair_estudante', fase: 'adaptando' };
const XSS = '<img src=x onerror=alert(1)>';
mod.setC([Object.assign({}, base)]);
async function pagina(tab, dossie, err) {
  respostas['contatos:one'] = err ? { data: null, error: { message: 'column "dossie" does not exist' } } : { data: { dossie: dossie || {}, user_id: respostas.__uid || null }, error: null };
  mod.state.sel = 'c1'; mod.state.view = 'pessoa'; mod.state.ptab = tab;
  await mod.renderPessoa();
  return el('pessoa-page').innerHTML;
}
const click = async (ds) => { const b = { id: '', dataset: ds, disabled: false, matches: () => false }; await handlers.click[0]({ target: { id: '', closest: () => b } }); return b; };
const digita = (k, valor) => handlers.input.forEach((h) => h({ target: { id: 'dk-' + k, value: valor, dataset: { dk: k, cid: 'c1' }, matches: () => false } }));

console.log('== Fica no topo, em todas as abas ==');
for (const tab of ['conversa', 'plataforma', 'ficha']) {
  const html = await pagina(tab, { cidade: 'Lyon' });
  check('aba ' + tab + ': dossiê aparece antes das abas', html.includes('id="dossie-box"') && html.indexOf('id="dossie-box"') < html.indexOf('role="tablist"'));
}

console.log('\n== Resumo fechado ==');
let html = await pagina('ficha', { cidade: 'Lyon', ano_au_pair: 'primeiro', moradia_resolvida: true });
check('mostra o progresso', /\d+ de \d+ respondidas/.test(html));
check('mostra os chips do que já sabe (cidade, persona)', html.includes('Lyon') && html.includes('Au pair → estudante'));
check('fechado: não mostra o formulário', !html.includes('data-dk="cidade"') && html.includes('Abrir dossiê completo'));

console.log('\n== Aberto: formulário completo ==');
mod.state.dosAberto = true;
html = await pagina('plataforma', { cidade: 'Lyon', ano_au_pair: 'primeiro', moradia_resolvida: true });
check('aberto: tem os campos e o botão salvar', html.includes('data-dk="cidade"') && html.includes('data-dossalvar="c1"') && html.includes('Fechar dossiê'));
check('traz o valor salvo no campo', /id="dk-cidade"[^>]*value="Lyon"/.test(html));
check('sim/não vira a opção certa (moradia = Sim)', /<select id="dk-moradia_resolvida"[\s\S]*?<option value="true" selected>/.test(html));
check('au pair vê o bloco Au pair → estudante e não o do Campus France', html.includes('Au pair → estudante</h4>') && !html.includes('Campus France</h4>') && html.includes('data-dk="ano_au_pair"') && !html.includes('data-dk="cfNivel"'));
check('primeiro ano mostra "Depois pretende", e o fim do contrato espera a decisão', html.includes('data-dk="intencao_au_pair"') && !html.includes('data-dk="contrato_fim"'));
check('o bloco da ligação tem a gravação transcrita', html.includes('data-dk="ligacao_transcricao"') && html.includes('Gravação transcrita'));
html = await pagina('ficha', { cidade: XSS, ligacao_resumo: XSS });
check('texto do banco passa por esc()', !html.includes(XSS) && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
mod.setC([Object.assign({}, base, { persona: 'campus_france' })]);
html = await pagina('ficha', { cfNivel: 'escola' });
check('Campus France vê o bloco dele; ano da escola só com nível escola', html.includes('Campus France</h4>') && html.includes('data-dk="cfEscolaAno"') && !html.includes('data-dk="ano_au_pair"'));
mod.setC([Object.assign({}, base, { persona: 'pvt' })]);
html = await pagina('ficha', {});
check('PVT não tem bloco próprio (hoje o app não pergunta nada específico)', !html.includes('Campus France</h4>') && !html.includes('Au pair → estudante</h4>'));
mod.setC([Object.assign({}, base)]);
html = await pagina('ficha', null, true);
check('sem o SQL: avisa qual arquivo falta, sem quebrar a ficha', /crm-dossie\.sql/.test(html) && html.includes('role="tablist"'));

console.log('\n== Responder muda as perguntas ==');
await pagina('ficha', {});
const tot0 = mod.dosProgresso(mod.state.dos && { id: 'c1', persona: 'au_pair_estudante' }, {}, {}).tot;
digita('ano_au_pair', 'segundo');
check('segundo ano passa a perguntar o fim do contrato', /data-dk="contrato_fim"/.test(el('dossie-box').innerHTML));
check('o que você digitou fica no rascunho, não no banco', mod.state.dos.rasc.ano_au_pair === 'segundo' && writes.length === 0 && rpcs.length === 0);
check('o total de perguntas acompanha a situação', mod.dosProgresso({ id: 'c1', persona: 'au_pair_estudante' }, {}, { ano_au_pair: 'segundo' }).tot > tot0 - 1);
await pagina('plataforma', {});
check('trocar de aba não perde o que digitou', mod.state.dos.rasc.ano_au_pair === 'segundo');

console.log('\n== Salvar ==');
mod.state.dos.rasc = {};
digita('nome', '  Ana Souza ');
digita('persona', 'campus_france');
digita('cidade', 'Lyon');
digita('moradia_resolvida', 'true');
digita('conta_resolvida', 'false');
digita('cfEtapa', '8');
digita('contrato_fim', '2027-09');
digita('data_chegada', '2026-09-01');
digita('numero_secu', '');
digita('ligacao_transcricao', 'Ana: oi\nIngryd: oi');
const btn = await click({ dossalvar: 'c1' }).catch((e) => { console.log('   erro:', e.message); return null; });
const col = writes.find((w) => w.table === 'contatos');
check('colunas do contato vão direto, aparadas', col && col.row.nome === 'Ana Souza' && col.row.persona === 'campus_france' && !('cidade' in col.row));
const rpc = rpcs.find((r) => r.n === 'crm_salvar_dossie');
check('o resto vai pelo crm_salvar_dossie, da pessoa certa', rpc && rpc.a.p_contato === 'c1');
const dd = rpc && rpc.a.p_dados;
check('sim/não vira booleano, etapa vira número, mês vira dia 1', dd && dd.moradia_resolvida === true && dd.conta_resolvida === false && dd.cfEtapa === 8 && dd.contrato_fim === '2027-09-01');
check('campo vazio vira null (apaga a resposta)', dd && dd.numero_secu === null);
check('a gravação da ligação vai inteira, com quebras de linha', dd && dd.ligacao_transcricao === 'Ana: oi\nIngryd: oi' && dd.cidade === 'Lyon' && dd.data_chegada === '2026-09-01');
check('não manda coluna de contato para o dossiê', dd && !('nome' in dd) && !('persona' in dd));

console.log('\n== Checklist e cliques dentro do dossiê ==');
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
const ymd = (n) => dia(n).slice(0, 10);
respostas.__uid = 'u1';
respostas.checklist_items = { data: [
  { step_key: 'a', category: 'Moradia', label: 'Achar <b>moradia</b>', status: 'concluido', due_date: ymd(-5), sort_order: 1, updated_at: dia(-2) },
  { step_key: 'b', category: 'Moradia', label: 'Comprovante de endereço', status: 'pendente', due_date: ymd(-1), sort_order: 2, updated_at: dia(-9) },
  { step_key: 'c', category: 'Saúde', label: 'Cadastro na Ameli', status: 'pendente', due_date: ymd(10), sort_order: 3, updated_at: dia(-9) },
  { step_key: 'd', category: 'Saúde', label: 'Carte Vitale', status: 'pendente', due_date: null, sort_order: 4, updated_at: dia(-9) }], error: null };
respostas.plataforma_cliques = { data: [
  { tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Desmarcou: Achar <b>moradia</b>', criado_em: dia(-1) },
  { tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Marcou como concluído: Achar <b>moradia</b>', criado_em: dia(-2) },
  { tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Marcou como concluído: Achar <b>moradia</b>', criado_em: dia(-3) },
  { tela: '/dashboard/#checklist', alvo: 'tela', rotulo: '', criado_em: dia(-3) },
  { tela: '/dashboard/#checklist', alvo: 'botao', rotulo: 'Ver o guia', criado_em: dia(-4) }], error: null };
mod.state.dosAberto = true;
mod.setC([Object.assign({}, base)]);
let h2 = await pagina('conversa', {});
check('aparece na aba Conversa, dentro do dossiê', h2.includes('Checklist e cliques'));
check('resumo: 1 de 4 concluídos, 1 atrasado', /1 de 4 \(25%\)/.test(h2) && /Atrasados[\s\S]*?1 \(Comprovante de endereço\)/.test(h2));
check('próximo prazo é o item futuro', /Cadastro na Ameli/.test(h2) && h2.includes('Próximo prazo'));
check('itens por categoria, com contagem', /Moradia <span class="sub">1 de 2/.test(h2) && /Saúde <span class="sub">0 de 2/.test(h2));
check('item concluído, atrasado e pendente têm o rótulo certo', h2.includes('>Concluído<') && h2.includes('>Atrasado<') && h2.includes('>Pendente<'));
check('conta quantas vezes ela mexeu no item', /ela mexeu 3 vezes/.test(h2));
check('cada clique vira uma linha: Marcou, Desmarcou, Tela, Clique', ['>Marcou<', '>Desmarcou<', '>Tela<', '>Clique<'].every((x) => h2.includes(x)));
check('texto do banco passa por esc() (item e clique)', !h2.includes('<b>moradia</b>') && h2.includes('Achar &lt;b&gt;moradia&lt;/b&gt;'));
check('chip no resumo fechado: Checklist 1/4', (mod.state.dosAberto = false, true) && (await pagina('ficha', {})).includes('<b>Checklist</b> 1/4'));
respostas.__uid = null;
mod.state.dosAberto = true;
h2 = await pagina('ficha', {});
check('sem conta no app: diz que ainda não tem checklist', /ainda não entrou no app/.test(h2));
respostas.__uid = 'u1';
respostas.checklist_items = { data: null, error: { message: 'permission denied' } };
h2 = await pagina('ficha', {});
check('sem o SQL: avisa o arquivo e a ficha segue', /crm-checklist\.sql/.test(h2) && h2.includes('role="tablist"'));
delete respostas.checklist_items; delete respostas.plataforma_cliques; respostas.__uid = null;

console.log('\n== Linha do tempo ==');
const t = mod.eventText({ tipo: 'dossie_atualizado', dados: { campos: 3 } });
check('dossie_atualizado tem texto', t[0] === 'sistema' && /dossiê \(3 campos\)/.test(t[1]));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
