// Guias gratuitos de cada pessoa (sessão Guias da Plataforma): o catálogo (content/guias.json), o que ela já pediu (contatos.origens), o que vale
// sugerir para a situação dela e o HTML da lista. Lógica pura e HTML puro: sem DOM e sem Supabase. O banco é db/crm-guias.sql.
//
// Regras: o que ela PEDIU aparece sozinho no app dela (sem ninguém publicar nada); o que você INDICA entra quando você clica em "Mostrar para ela".
// As sugestões são só uma indicação por regra (persona), com o motivo em palavras: quem decide é você.

// A "origem" de cada guia é a marca que a página do guia grava no contato quando a pessoa o pede. Um teste confere que é a mesma que está em /guias/<slug>/.
export const GUIAS_ORIGEM = {
  'vls-ts-validacao-travou': 'guia-vls-ts',
  'email-alternancia-30-mais': 'guia-email-alt30',
  'etudes-en-france-2027-2028': 'guia-etudes-en-france-2027',
  'tecnologo-nivel-na-franca': 'guia-tecnologo',
  'checklist-chegada-au-pair': 'guia-checklist-chegada-au-pair'
};
// Guias que existem em /guias/ mas não estão na lista de content/guias.json (quem pediu precisa vê-lo no app mesmo assim).
const EXTRAS = [{ slug: 'checklist-chegada-au-pair', titulo: 'Cheguei como au pair: por onde eu me estabilizo?', categoria: 'Au pair', leitura_min: null,
  resumo: 'Au pair na França: os 7 passos de chegada, na ordem, com o que ter em mãos em cada um. Checklist gratuito.' }];

// Para quem cada guia serve (personas do CRM) e por quê. A frase vira o motivo mostrado na sugestão.
const REGRAS = {
  'vls-ts-validacao-travou': [['campus_france', 'Quem vai estudar precisa validar o VLS-TS depois de chegar.'], ['au_pair_estudante', 'Quem troca o visto de au pair por estudante passa pela validação do VLS-TS.'], ['pvt', 'Quem muda do PVT para estudante passa pela validação do VLS-TS.']],
  'email-alternancia-30-mais': [['alternancia_emprego', 'O e-mail em francês para pedir a alternância é o passo que mais trava quem busca empresa.']],
  'etudes-en-france-2027-2028': [['campus_france', 'A candidatura Études en France é o caminho de quem vai estudar via Campus France.'], ['au_pair_estudante', 'Quem quer estudar depois do au pair precisa da linha do tempo da candidatura.'], ['pvt', 'Quem quer estudar depois do PVT precisa da linha do tempo da candidatura.']],
  'tecnologo-nivel-na-franca': [['campus_france', 'Quem tem tecnólogo precisa saber em que nível entra na França (L3 ou M1).'], ['pvt', 'Quem tem tecnólogo e quer estudar depois do PVT precisa saber em que nível entra.'], ['au_pair_estudante', 'Quem tem tecnólogo e quer estudar depois do au pair precisa saber em que nível entra.']],
  'checklist-chegada-au-pair': [['au_pair_estudante', 'Para quem chega como au pair: os 7 passos de chegada, na ordem.']]
};

const lista = (v) => (Array.isArray(v) ? v : []);

// Do JSON do site para o formato que o banco recebe (crm_guias_catalogo_sincronizar). Só os publicados; mais os extras.
export function montaCatalogo(json) {
  const itens = lista(json && json.items).filter((i) => i && typeof i.slug === 'string' && i.publicado !== false);
  const base = itens.map((i) => ({ slug: i.slug, origem: GUIAS_ORIGEM[i.slug] || null, titulo: String(i.titulo || i.slug), resumo: i.resumo ? String(i.resumo).slice(0, 400) : null,
    categoria: i.categoria ? String(i.categoria).slice(0, 60) : null, url: '/guias/' + i.slug + '/', leitura_min: Number.isInteger(i.leituraMin) ? i.leituraMin : null, publicado: true }));
  EXTRAS.forEach((x) => { if (!base.some((b) => b.slug === x.slug)) base.push({ slug: x.slug, origem: GUIAS_ORIGEM[x.slug] || null, titulo: x.titulo, resumo: x.resumo, categoria: x.categoria, url: '/guias/' + x.slug + '/', leitura_min: x.leitura_min, publicado: true }); });
  return base.filter((g) => g.origem);
}
// Os guias que ela pediu: a origem do guia está entre as origens do contato.
export function pedidos(catalogo, origens) {
  const o = lista(origens);
  return lista(catalogo).filter((g) => g.origem && o.indexOf(g.origem) >= 0);
}
// O que vale sugerir para a persona dela (regra, não IA). Cada sugestão leva o motivo.
export function sugeridos(catalogo, persona) {
  const out = [];
  lista(catalogo).forEach((g) => { const r = (REGRAS[g.slug] || []).filter((x) => x[0] === persona)[0]; if (r) out.push({ slug: g.slug, motivo: r[1] }); });
  return out;
}
const ORDEM = { pediu: 0, indicado: 1, sugerido: 2, livre: 3 };
// A lista da sessão: cada guia do catálogo com o seu estado, na ordem pediu → indicado → sugerido → livre.
export function linhas({ catalogo, origens, persona, indicados }) {
  const ped = pedidos(catalogo, origens).map((g) => g.slug), ind = lista(indicados), sug = sugeridos(catalogo, persona);
  return lista(catalogo).map((g, i) => {
    const s = sug.filter((x) => x.slug === g.slug)[0];
    const estado = ped.indexOf(g.slug) >= 0 ? 'pediu' : ind.indexOf(g.slug) >= 0 ? 'indicado' : s ? 'sugerido' : 'livre';
    return { slug: g.slug, titulo: g.titulo, categoria: g.categoria || '', leitura_min: g.leitura_min, url: g.url, estado, motivo: s ? s.motivo : '', i };
  }).sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado] || a.i - b.i);
}
const ROTULO = { pediu: ['Ela pediu', 'u-baixa'], indicado: ['Indicado por você', 'u-baixa'], sugerido: ['Sugerido', 'u-media'], livre: ['', ''] };
// h = { esc, btn(acao, slug, rotulo) }
export function guiasHtml(ls, h) {
  const e = h.esc, l = lista(ls);
  if (!l.length) return '<p class="sub" style="margin:0">O catálogo de guias ainda não carregou.</p>';
  const n = (est) => l.filter((x) => x.estado === est).length;
  const resumo = n('pediu') + (n('pediu') === 1 ? ' pediu' : ' pediram') + ' · ' + n('indicado') + (n('indicado') === 1 ? ' indicado' : ' indicados') + (n('sugerido') ? ' · ' + n('sugerido') + (n('sugerido') === 1 ? ' sugerido' : ' sugeridos') : '');
  let html = '<p class="sub" style="margin:0 0 8px">' + e(resumo) + '. O que ela pediu aparece sozinho no app dela; o resto só quando você clicar em “Mostrar para ela”.</p>';
  html += l.map((x) => {
    const r = ROTULO[x.estado], meta = [x.categoria, x.leitura_min ? x.leitura_min + ' min' : ''].filter(Boolean).join(' · ');
    const btn = x.estado === 'pediu' ? '' : x.estado === 'indicado' ? h.btn('retirar', x.slug, 'Retirar') : h.btn('indicar', x.slug, 'Mostrar para ela');
    return '<div class="feeditem" style="align-items:flex-start"><div style="flex:none;min-width:116px">' + (r[0] ? '<span class="pill ' + r[1] + '">' + e(r[0]) + '</span>' : '') + '</div>' +
      '<div class="fbody" style="min-width:0"><p style="margin:0"><b>' + e(x.titulo) + '</b>' + (meta ? ' <span class="sub">· ' + e(meta) + '</span>' : '') + '</p>' + (x.motivo ? '<small class="sub">' + e(x.motivo) + '</small>' : '') + '</div>' +
      '<div style="flex:none;display:flex;gap:6px">' + btn + '</div></div>';
  }).join('');
  if (n('sugerido')) html += '<div class="actions" style="margin-top:8px">' + h.btn('sugeridos', '', 'Mostrar todos os sugeridos') + '</div>';
  return html;
}
