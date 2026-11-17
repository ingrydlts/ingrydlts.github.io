// Página inicial: destaques 3 / 2 / 2, botão "Adicionar na home" e "Em destaque" na prévia. Uso: node ficha-home.test.mjs
import * as FX from '../../ficha.js';
import * as FH from '../../ficha-html.js';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const h = { esc: (x) => String(x), fmtDay: (x) => x };

console.log('== Limites e categorias ==');
check('limites 3 / 2 / 2', FX.HOME_LIMITES.checklist === 3 && FX.HOME_LIMITES.espaco === 2 && FX.HOME_LIMITES.guias === 2);
check('categoria pelo tipo: marco e escola = Espaço; bilan, documento, mensagem = Guias; o resto não tem', FX.categoriaHomeDoBoard('marco') === 'espaco' && FX.categoriaHomeDoBoard('escola') === 'espaco' && ['bilan', 'documento', 'modelo'].every((t) => FX.categoriaHomeDoBoard(t) === 'guias') && FX.categoriaHomeDoBoard('contato') === null);
const home = [{ id: 1, categoria: 'espaco', board_id: 10, ordem: 0 }, { id: 2, categoria: 'espaco', board_id: 11, ordem: 1 }, { id: 3, categoria: 'checklist', step_key: 'k1', ordem: 0 }];
check('espaço cheio recusa ("cheia", 2 de 2); checklist ainda cabe', FX.podeAdicionarHome(home, 'espaco').ok === false && FX.podeAdicionarHome(home, 'espaco').motivo === 'cheia' && FX.podeAdicionarHome(home, 'espaco').n === 2 && FX.podeAdicionarHome(home, 'checklist').ok === true && FX.podeAdicionarHome(home, 'guias').ok === true && FX.podeAdicionarHome(home, 'xx').ok === false);
check('homeTem acha por step_key (checklist) e por board_id (os outros)', FX.homeTem(home, 'checklist', 'k1').id === 3 && FX.homeTem(home, 'espaco', '10').id === 1 && FX.homeTem(home, 'espaco', 99) === null);

console.log('\n== O que a sessão mostra ==');
{
  const itens = [{ step_key: 'k1', label: 'Validar o VLS-TS', status: 'pendente', due_date: '2026-12-05' }, { step_key: 'k2', label: 'Feito', status: 'concluido' }];
  const board = [{ id: 10, tipo: 'escola', titulo: 'DU Aix', resumo: 'Aix', estado: 'publicado' }, { id: 11, tipo: 'marco', titulo: 'Prazo', estado: 'revisado' }];
  const d = FX.destaquesDaHome({ home: home.concat([{ id: 4, categoria: 'checklist', step_key: 'sumiu', ordem: 1 }, { id: 5, categoria: 'guias', board_id: 77, ordem: 0 }]), itens, board });
  check('cada categoria traz max e n', d.checklist.max === 3 && d.checklist.n === 2 && d.espaco.n === 2 && d.guias.n === 1 && d.guias.max === 2);
  check('checklist: título e prazo do passo', d.checklist.itens[0].titulo === 'Validar o VLS-TS' && d.checklist.itens[0].meta === 'prazo 05/12' && d.checklist.itens[0].ref === 'k1');
  check('item de board não publicado é marcado (ela só vê depois)', d.espaco.itens[0].publicado === true && d.espaco.itens[1].publicado === false);
  check('passo ou item que não existe mais aparece como "falta" (para você tirar)', d.checklist.itens[1].falta === true && d.guias.itens[0].falta === true && d.guias.itens[0].titulo === '(item removido)');
}

console.log('\n== Botão no Checklist ==');
{
  const base = { semConta: false, erro: false, demarches: [], ativa: 'todas', totalFeitos: 0, total: 2, itens: [{ step_key: 'k1', label: 'Passo 1', status: 'pendente' }, { step_key: 'k2', label: 'Passo 2', status: 'pendente' }, { step_key: 'k3', label: 'Arq', status: 'arquivado' }], hoje: '2026-11-17' };
  const sem = FH.htmlChecklistSessao(Object.assign({}, base, { homeRefs: null }), h);
  check('sem os dados da home (SQL não rodado ou caso carregando): nenhum botão', !/Adicionar na home/.test(sem));
  const com = FH.htmlChecklistSessao(Object.assign({}, base, { homeRefs: ['k2'] }), h);
  check('minimalista: cada passo tem "+" (põe na home); o que já está lá vira "×" (tira); com rótulo escrito', /data-caso="home-add" data-id="checklist:k1"[^>]*aria-label="Adicionar na página inicial"[^>]*>\+</.test(com) && /data-caso="home-del" data-id="checklist:k2"[^>]*aria-label="Tirar da página inicial"[^>]*>×</.test(com) && /aria-pressed="true"/.test(com) && !/Adicionar na home|Na home ✓/.test(com));
  check('sem botão "Editar": o texto do passo abre o editor com dois cliques (ou Enter)', !/>Editar</.test(com) && /class="fx-p-t fx-edita" data-dbl="ckEditar" data-id="k1" tabindex="0"/.test(com));
  check('passo arquivado por ela não tem botão', !/checklist:k3/.test(com));
}

console.log('\n== "Em destaque" na prévia do app ==');
{
  const mapa = { ordem: ['visa'], definicoes: { visa: { label: 'Visa' } }, porCategoria: { Visto: 'visa' } };
  const itens = [{ step_key: 'k1', category: 'Visto', label: 'Validar o VLS-TS', status: 'pendente', due_date: '2026-12-05' }, { step_key: 'k9', category: 'Visto', label: 'Arquivado', status: 'arquivado' }];
  const board = [{ id: 10, tipo: 'escola', titulo: 'DU Aix', resumo: 'Aix', estado: 'publicado', dados: {} }, { id: 11, tipo: 'marco', titulo: 'Rascunho', estado: 'revisado', dados: {} },
    { id: 12, tipo: 'documento', titulo: 'Guia PDF', estado: 'publicado', arquivo_caminho: 'c/a.pdf', dados: { direcao: 'recebe' } }, { id: 13, tipo: 'bilan', titulo: 'Bilan', estado: 'publicado', dados: {} }];
  const pub = board.filter((b) => b.estado === 'publicado');
  const home = [{ id: 1, categoria: 'checklist', step_key: 'k1', ordem: 0 }, { id: 2, categoria: 'checklist', step_key: 'k9', ordem: 1 }, { id: 3, categoria: 'espaco', board_id: 10, ordem: 0 }, { id: 4, categoria: 'espaco', board_id: 11, ordem: 1 },
    { id: 5, categoria: 'guias', board_id: 12, ordem: 0 }, { id: 6, categoria: 'guias', board_id: 13, ordem: 1 }];
  const r = FX.inicioDoApp({ nome: 'Letícia', mapa, persona: 'x', itens, board: pub, acoes: [], listas: [], home, quando: {}, agora: new Date(2026, 10, 17, 12).getTime() });
  check('só o que ela vê: o passo existente (não o arquivado) e os itens PUBLICADOS', r.destaques.checklist.length === 1 && r.destaques.checklist[0].titulo === 'Validar o VLS-TS' && r.destaques.checklist[0].meta === '05/12' && r.destaques.espaco.map((x) => x.titulo).join() === 'DU Aix' && r.destaques.guias.map((x) => x.titulo).join() === 'Guia PDF,Bilan');
  check('só com destaques (sem passos da equipe) já é Início pessoal', FX.inicioDoApp({ mapa, persona: 'x', itens, board: [], acoes: [], listas: [], home: [{ id: 1, categoria: 'checklist', step_key: 'k1', ordem: 0 }] }).pessoal === true && FX.inicioDoApp({ mapa, persona: 'x', itens, board: [], acoes: [], listas: [], home: [] }).pessoal === false);
  const html = FH.htmlPreviaApp({ nome: 'Letícia', semConta: false, aba: 'inicio', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: r, esp: FX.espacoDoApp({ board: [] }) }, h);
  check('a prévia mostra "Em destaque": Do seu checklist, Do Espaço e Guias, com "Abrir" no PDF e "Ver no Espaço" no bilan', /Em destaque/.test(html) && /Do seu checklist/.test(html) && /Do Espaço/.test(html) && />Guias</.test(html) && /Abrir/.test(html) && /Ver no Espaço/.test(html));
  const sem = FH.htmlPreviaApp({ nome: 'L', semConta: false, aba: 'inicio', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio: FX.inicioDoApp({ mapa, persona: 'x', itens, board: pub, acoes: [], listas: [], home: [] }), esp: FX.espacoDoApp({ board: [] }) }, h);
  check('sem destaques: o bloco não aparece', !/Em destaque/.test(sem));
}
console.log(bad ? `\n${bad} falhou, ${ok} ok` : `\nok: ${ok} verificações`); process.exit(bad ? 1 : 0);
