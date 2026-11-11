// Testa os blocos do estúdio de e-mails (admin/crm/estudio.js e taxonomia.js): o destaque sólido com cor, o bloco Intro
// (tipo "apresentacao") e as etapas e a página do guia do Au pair. Módulos puros: sem banco e sem DOM.
//
// Uso: cd admin/crm/db/testes && node crm-estudio-blocos.test.mjs
import * as ES from '../../estudio.js';
import { PAGINAS, classifica, rotuloPagina, rotuloEtapa } from '../../taxonomia.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const monta = (itens, extra) => ES.montar(Object.assign({ assunto: 'a', itens }, extra || {}), 'servico');
const dest = (b) => monta([Object.assign({ tipo: 'destaque', rotulo: 'O passo com prazo', valor: 'Valide o visto', nota: 'Fonte: x' }, b)]);

// ---------- Destaque: faixa sólida, sem o cartão creme com borda dourada ----------
let h = dest({}).corpo_html;
check('padrão: fundo grafite no bgcolor e no style', h.includes('bgcolor="#2B2B2B"') && h.includes('background:#2B2B2B'));
check('padrão: rótulo em ouro, em caixa alta e espaçado', h.includes('color:#DEB975') && h.includes('text-transform:uppercase') && h.includes('letter-spacing:.16em'));
check('padrão: valor em off-white', h.includes('color:#FBFAF7'));
check('padrão: cantos quase retos', h.includes('border-radius:2px'));
check('sem o cartão creme antigo', !h.includes('border:1px solid #DEB975') && !h.includes('border-radius:8px; padding:16px 18px'));
check('sem barra lateral', !/border-left/.test(h));

h = dest({ estilo: 'verde' }).corpo_html;
check('verde da marca', h.includes('bgcolor="#577328"') && h.includes('background:#577328'));
h = dest({ estilo: 'terra' }).corpo_html;
check('terra', h.includes('bgcolor="#604034"'));
h = dest({ estilo: 'claro' }).corpo_html;
check('claro: fundo off-white e contorno grafite de 2 px', h.includes('bgcolor="#FBFAF7"') && h.includes('border:2px solid #2B2B2B'));
check('claro: valor em grafite', /<div style="[^"]*color:#2B2B2B[^"]*">Valide o visto/.test(h));
h = dest({ estilo: 'rosa' }).corpo_html;
check('estilo desconhecido cai no escuro', h.includes('bgcolor="#2B2B2B"'));
h = dest({ estilo: '' }).corpo_html;
check('estilo vazio cai no escuro', h.includes('bgcolor="#2B2B2B"'));

// Tamanho do valor: curto (até 40 caracteres, uma linha) grande; senão, médio.
check('valor curto: 23 px', dest({ valor: 'Valide o visto' }).corpo_html.includes('font-size:23px'));
check('valor de 40 caracteres: ainda 23 px', dest({ valor: 'x'.repeat(40) }).corpo_html.includes('font-size:23px'));
check('valor de 41 caracteres: 18 px', dest({ valor: 'x'.repeat(41) }).corpo_html.includes('font-size:18px'));
check('valor com várias linhas: 18 px', dest({ valor: 'linha 1\nlinha 2' }).corpo_html.includes('font-size:18px'));
check('valor com várias linhas mantém a quebra', dest({ valor: 'linha 1\nlinha 2' }).corpo_html.includes('linha 1<br>linha 2'));

// A nota: só existe se escrita, sob um filete.
check('nota aparece sob um filete', /border-top:1px solid[^"]*">Fonte: x/.test(dest({}).corpo_html));
check('sem nota, sem filete', !/border-top:1px solid/.test(dest({ nota: '' }).corpo_html.split('<table')[3] || ''));

// Link escrito no valor: legível sobre o fundo escuro (não verde), e verde no fundo claro.
const comLink = { valor: 'veja https://exemplo.com/guia agora' };
check('link no escuro sai em off-white', dest(comLink).corpo_html.includes('style="color:#FBFAF7;">https://exemplo.com/guia</a>'));
check('link no claro continua verde', dest(Object.assign({ estilo: 'claro' }, comLink)).corpo_html.includes('style="color:#577328;">https://exemplo.com/guia</a>'));

// O texto puro não muda.
let t = dest({}).corpo_texto;
check('texto puro: rótulo e valor curtos na mesma linha', t.includes('O passo com prazo: Valide o visto'));
check('texto puro: a nota vem depois', t.includes('Valide o visto\nFonte: x'));
t = dest({ valor: 'linha 1\nlinha 2' }).corpo_texto;
check('texto puro com várias linhas: rótulo, depois o valor', t.includes('O passo com prazo\nlinha 1\nlinha 2'));

// Dado essencial sem plano B: o bloco continua condicional (some se faltar).
h = monta([{ tipo: 'destaque', rotulo: 'Prazo', valor: '{prazo_nivel}' }]).corpo_html;
check('dado essencial: o destaque fica dentro de {#prazo_nivel}', h.includes('{#prazo_nivel}') && h.includes('{/prazo_nivel}'));
check('dado essencial: o dado é preenchido no valor', h.includes('{#prazo_nivel}{prazo_nivel}{/prazo_nivel}') || h.includes('{prazo_nivel}'));

// ---------- Intro (tipo apresentacao) ----------
const intro = ES.novoBloco('apresentacao');
check('Intro: título padrão', intro.titulo === 'Oi, eu sou a Ingryd');
check('Intro: texto padrão com "desde 2023"', intro.texto === 'Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.');
h = monta([intro]).corpo_html;
check('Intro: a foto do site e a borda dourada', h.includes(ES.FOTO_URL) && h.includes('border:2px solid #DEB975'));
check('Intro: título e texto no e-mail', h.includes('Oi, eu sou a Ingryd') && h.includes('desde 2023'));
check('Intro: o nome na lista de tipos continua Apresentação com foto', ES.TIPOS.apresentacao && ES.TIPOS.apresentacao.nome === 'Apresentação com foto');

// ---------- Etapas do guia do Au pair ----------
const ap = ES.ETAPAS_GUIA.filter((x) => x[0].startsWith('ap-'));
check('5 etapas do Au pair em ETAPAS_GUIA', ap.map((x) => x[0]).join() === 'ap-tudo-bem,ap-nao-sei-comecar,ap-medo-prazo,ap-travado,ap-pesado');
check('rótulos do Au pair começam com "Au pair: "', ap.every((x) => x[1].startsWith('Au pair: ')));
check('as etapas do Campus France e da Alternância continuam', ES.ETAPAS_GUIA.filter((x) => x[0].startsWith('cf-')).length === 5 && ES.ETAPAS_GUIA.filter((x) => x[0].startsWith('alt-')).length === 5);
check('as etapas do Au pair não viram dados de e-mail (o Worker não os preenche)', !('etapa_ap_medo_prazo' in ES.CAT) && !ES.VARS_NOVOS.some((x) => x.indexOf('etapa_ap') === 0));

// ---------- Página I05 no catálogo ----------
const p5 = PAGINAS.find((p) => p.k === 'I05');
check('página I05 existe', !!p5);
check('I05: nome e endereço', p5 && p5.nome === 'Au pair · checklist de chegada' && p5.rota === '/guias/checklist-chegada-au-pair/');
check('I05: as mesmas 5 etapas, com os mesmos códigos', p5 && p5.etapas.map((e) => e[0]).join() === ap.map((x) => x[0]).join());
check('rotuloPagina I05', rotuloPagina('I05') === 'I05 · Au pair · checklist de chegada');
check('rotuloEtapa I05', rotuloEtapa('I05', 'ap-medo-prazo') !== 'ap-medo-prazo');
['aupair_chegada_1', 'aupair_chegada_2'].forEach((k) => {
  const c = classifica({ chave: k });
  check(k + ' mora na página I05, família entrega e persona au pair', c.pagina === 'I05' && c.familia === 'entrega' && c.persona === 'au_pair');
});

console.log(failed ? `\n${passed} passaram, ${failed} FALHARAM` : `\n${passed} passaram, 0 falharam`);
process.exit(failed ? 1 : 0);
