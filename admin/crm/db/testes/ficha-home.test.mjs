// Página inicial: destaques 3 / 3 / 2 (checklist, Só seu, Guias), botão "Adicionar na home" e a prévia do Início. Uso: node ficha-home.test.mjs
import * as FX from '../../ficha.js';
import * as FH from '../../ficha-html.js';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const h = { esc: (x) => String(x), fmtDay: (x) => x };

console.log('== Limites e categorias ==');
check('limites 3 / 3 / 2', FX.HOME_LIMITES.checklist === 3 && FX.HOME_LIMITES.so_seu === 3 && FX.HOME_LIMITES.guias === 2 && FX.HOME_LIMITES.espaco === undefined);
const rec = { dados: { direcao: 'recebe' } };
check('Só seu: bilan e documento que ela recebe; Guias: documento e mensagem pronta; prazo e escola não vão para a home',
  FX.itemPodeNaHome({ tipo: 'bilan' }, 'so_seu') && FX.itemPodeNaHome({ tipo: 'documento', ...rec }, 'so_seu') && !FX.itemPodeNaHome({ tipo: 'documento', dados: { direcao: 'reune' } }, 'so_seu') && !FX.itemPodeNaHome({ tipo: 'modelo' }, 'so_seu')
  && FX.itemPodeNaHome({ tipo: 'documento', ...rec }, 'guias') && !FX.itemPodeNaHome({ tipo: 'documento', dados: { direcao: 'reune' } }, 'guias') && FX.itemPodeNaHome({ tipo: 'modelo' }, 'guias') && !FX.itemPodeNaHome({ tipo: 'bilan' }, 'guias')
  && ['marco', 'escola', 'contato'].every((t) => !FX.itemPodeNaHome({ tipo: t }, 'so_seu') && !FX.itemPodeNaHome({ tipo: t }, 'guias')));
const home = [{ id: 1, categoria: 'so_seu', board_id: 10, ordem: 0 }, { id: 2, categoria: 'so_seu', board_id: 11, ordem: 1 }, { id: 6, categoria: 'so_seu', board_id: 12, ordem: 2 }, { id: 3, categoria: 'checklist', step_key: 'k1', ordem: 0 }];
check('só seu cheio recusa ("cheia", 3 de 3); checklist ainda cabe', FX.podeAdicionarHome(home, 'so_seu').ok === false && FX.podeAdicionarHome(home, 'so_seu').motivo === 'cheia' && FX.podeAdicionarHome(home, 'so_seu').n === 3 && FX.podeAdicionarHome(home, 'checklist').ok === true && FX.podeAdicionarHome(home, 'guias').ok === true && FX.podeAdicionarHome(home, 'espaco').ok === false);
check('homeTem acha por step_key (checklist) e por board_id (os outros)', FX.homeTem(home, 'checklist', 'k1').id === 3 && FX.homeTem(home, 'so_seu', '10').id === 1 && FX.homeTem(home, 'so_seu', 99) === null);

console.log('\n== O que a sessão mostra ==');
{
  const itens = [{ step_key: 'k1', label: 'Validar o VLS-TS', status: 'pendente', due_date: '2026-12-05' }, { step_key: 'k2', label: 'Feito', status: 'concluido' }];
  const board = [{ id: 10, tipo: 'bilan', titulo: 'Conversa de 16/11', resumo: 'Aix', estado: 'publicado' }, { id: 11, tipo: 'documento', titulo: 'Plano', estado: 'revisado' }, { id: 12, tipo: 'documento', titulo: 'Outro', estado: 'publicado' }];
  const d = FX.destaquesDaHome({ home: home.concat([{ id: 4, categoria: 'checklist', step_key: 'sumiu', ordem: 1 }, { id: 5, categoria: 'guias', board_id: 77, ordem: 0 }]), itens, board });
  check('cada categoria traz max e n', d.checklist.max === 3 && d.checklist.n === 2 && d.so_seu.n === 3 && d.so_seu.max === 3 && d.guias.n === 1 && d.guias.max === 2);
  check('checklist: título e prazo do passo', d.checklist.itens[0].titulo === 'Validar o VLS-TS' && d.checklist.itens[0].meta === 'prazo 05/12' && d.checklist.itens[0].ref === 'k1');
  check('item de board não publicado é marcado (ela só vê depois)', d.so_seu.itens[0].publicado === true && d.so_seu.itens[1].publicado === false);
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

console.log('\n== A página inicial na prévia do app ==');
{
  const mapa = { ordem: ['visa'], definicoes: { visa: { label: 'Visa' } }, porCategoria: { Visto: 'visa' } };
  const itens = [{ step_key: 'k1', category: 'Visto', label: 'Validar o VLS-TS', status: 'pendente', due_date: '2026-12-05' }, { step_key: 'k9', category: 'Visto', label: 'Arquivado', status: 'arquivado' }, { step_key: 'k2', category: 'Visto', label: 'Já feito', status: 'concluido' }];
  const board = [{ id: 11, tipo: 'documento', titulo: 'Rascunho', estado: 'revisado', dados: { direcao: 'recebe' } },
    { id: 12, tipo: 'documento', titulo: 'Plano de estudos', estado: 'publicado', arquivo_caminho: 'c/a.pdf', dados: { direcao: 'recebe' } }, { id: 13, tipo: 'bilan', titulo: 'Conversa de 16/11', estado: 'publicado', dados: {} },
    { id: 14, tipo: 'documento', titulo: 'Notion de estudos', estado: 'publicado', link: 'https://x.org/n', dados: { direcao: 'recebe' } }, { id: 15, tipo: 'modelo', titulo: 'E-mail para escolas', estado: 'publicado', dados: {} }];
  const pub = board.filter((b) => b.estado === 'publicado');
  const home = [{ id: 1, categoria: 'checklist', step_key: 'k1', ordem: 0 }, { id: 2, categoria: 'checklist', step_key: 'k9', ordem: 1 }, { id: 7, categoria: 'checklist', step_key: 'k2', ordem: 2 },
    { id: 3, categoria: 'so_seu', board_id: 13, ordem: 0 }, { id: 4, categoria: 'so_seu', board_id: 11, ordem: 1 }, { id: 8, categoria: 'so_seu', board_id: 12, ordem: 2 },
    { id: 5, categoria: 'guias', board_id: 14, ordem: 0 }, { id: 6, categoria: 'guias', board_id: 15, ordem: 1 }];
  const r = FX.inicioDoApp({ nome: 'Letícia', mapa, persona: 'x', itens, board: pub, acoes: [], listas: [], home, quando: {}, agora: new Date(2026, 10, 17, 12).getTime() });
  check('só o que ela vê: o passo existente (não o arquivado) e os itens PUBLICADOS', r.destaques.checklist.map((x) => x.titulo).join() === 'Validar o VLS-TS,Já feito' && r.destaques.soSeu.map((x) => x.titulo).join() === 'Conversa de 16/11,Plano de estudos' && r.destaques.guias.map((x) => x.titulo).join() === 'Notion de estudos,E-mail para escolas');
  check('os passos escolhidos (e ainda não feitos) vão para o "Em seguida"; o feito não', r.seguintes.map((x) => x.titulo).join() === 'Validar o VLS-TS');
  check('só seu: o bilan escolhido e o encaminhamento; sem escolha, o bilan segue como atalho', r.soSeu.bilans.length === 1 && r.soSeu.docs.length === 1 && r.soSeu.atalhoBilan === false
    && FX.inicioDoApp({ mapa, persona: 'x', itens, board: pub, acoes: [], listas: [], home: [], quando: {} }).soSeu.atalhoBilan === true);
  check('só com destaques (sem passos da equipe) já é Início pessoal', FX.inicioDoApp({ mapa, persona: 'x', itens, board: [], acoes: [], listas: [], home: [{ id: 1, categoria: 'checklist', step_key: 'k1', ordem: 0 }] }).pessoal === true && FX.inicioDoApp({ mapa, persona: 'x', itens, board: [], acoes: [], listas: [], home: [] }).pessoal === false);
  const dados = (inicio, esp) => ({ nome: 'Letícia', semConta: false, aba: 'inicio', dia: 1, camadas: false, pct: 0, feitos: 0, total: 0, naoLidas: 0, marco: null, prox: null, avisos: [], passos: [], espaco: { marcos: [], escolas: [], dela: [] }, guias: { bilan: false, docs: [], msgs: [] }, perfil: { n: 0, tot: 0, kv: [] }, inicio, esp });
  const html = FH.htmlPreviaApp(dados(r, FX.espacoDoApp({ board: [], avisos: [{ tipo: 'pergunta', titulo: 'Quando você chega?', estado: 'liberado' }] })), h);
  check('a prévia: "Em seguida" com o passo escolhido, "Só seu" com os "Encaminhamentos da Ingryd", "Guias", e sem "Em destaque"', !/Em destaque/.test(html) && /Em seguida/.test(html) && /Validar o VLS-TS/.test(html) && /Só seu/.test(html) && /Encaminhamentos da Ingryd/.test(html) && /Plano de estudos/.test(html) && /Guias/.test(html) && /E-mail para escolas/.test(html));
  check('embaixo, sempre: "Você tem 1 nova pergunta da Equipe Por Dentro" (depois dos Guias)', /Você tem 1 nova pergunta da Equipe Por Dentro/.test(html) && html.indexOf('Guias') < html.indexOf('nova pergunta da Equipe Por Dentro'));
  check('sem pergunta da equipe, não aparece a mensagem', !/nova pergunta/.test(FH.htmlPreviaApp(dados(r, FX.espacoDoApp({ board: [] })), h)));
}
console.log(bad ? `\n${bad} falhou, ${ok} ok` : `\nok: ${ok} verificações`); process.exit(bad ? 1 : 0);
