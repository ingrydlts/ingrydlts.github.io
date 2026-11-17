// Testa admin/crm/guias.js (guias gratuitos de cada pessoa: catálogo, o que ela pediu, o que sugerir por persona e o HTML da sessão Guias).
// Dados inventados. Uso: cd admin/crm/db/testes && node guias.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../../guias.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(HERE, '../../../..');
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JSON_GUIAS = JSON.parse(readFileSync(path.join(RAIZ, 'content/guias.json'), 'utf8'));

console.log('== O catálogo (content/guias.json + o guia de au pair que não está na lista) ==');
const cat = G.montaCatalogo(JSON_GUIAS);
check('o catálogo tem os guias publicados do JSON e o guia de chegada de au pair', cat.length === JSON_GUIAS.items.filter((i) => i.publicado !== false).length + 1 && cat.some((g) => g.slug === 'checklist-chegada-au-pair'));
check('cada guia tem slug, título, endereço /guias/<slug>/ e a origem do funil', cat.every((g) => g.slug && g.titulo && g.url === '/guias/' + g.slug + '/' && /^guia-[a-z0-9-]+$/.test(g.origem)));
check('o formato bate com o que o banco aceita (publicado, tempo de leitura numérico ou nulo)', cat.every((g) => g.publicado === true && (g.leitura_min === null || Number.isInteger(g.leitura_min))));
check('guia marcado como não publicado no JSON sai do catálogo', G.montaCatalogo({ items: [{ slug: 'a', titulo: 'A', url: '/guias/a/', publicado: false }] }).filter((g) => g.slug === 'a').length === 0);
check('JSON estranho ou vazio não quebra', G.montaCatalogo(null).length === 1 && G.montaCatalogo({}).length === 1 && G.montaCatalogo({ items: 'x' }).length === 1);
check('a origem de cada guia é a mesma que a página do guia grava no contato (confere nas páginas /guias/)', cat.every((g) => { const f = path.join(RAIZ, 'guias', g.slug, 'index.html'); return existsSync(f) && readFileSync(f, 'utf8').includes('"' + g.origem); }));

console.log('\n== O que ela pediu ==');
check('os guias pedidos são os que têm a origem em contatos.origens', JSON.stringify(G.pedidos(cat, ['guia-vls-ts', 'outra-origem']).map((g) => g.slug)) === JSON.stringify(['vls-ts-validacao-travou']));
check('sem origens ou com origem desconhecida: nada', G.pedidos(cat, []).length === 0 && G.pedidos(cat, ['x']).length === 0 && G.pedidos(cat, null).length === 0);

console.log('\n== O que sugerir ==');
const sug = (persona) => G.sugeridos(cat, persona).map((s) => s.slug);
check('au pair que vai estudar: chegada, Études en France e VLS-TS', ['checklist-chegada-au-pair', 'etudes-en-france-2027-2028', 'vls-ts-validacao-travou'].every((s) => sug('au_pair_estudante').includes(s)));
check('alternância: o e-mail em francês', sug('alternancia_emprego').includes('email-alternancia-30-mais') && !sug('alternancia_emprego').includes('checklist-chegada-au-pair'));
check('Campus France: candidatura, nível do tecnólogo e VLS-TS', ['etudes-en-france-2027-2028', 'tecnologo-nivel-na-franca', 'vls-ts-validacao-travou'].every((s) => sug('campus_france').includes(s)));
check('toda sugestão traz o motivo em palavras', G.sugeridos(cat, 'campus_france').every((s) => typeof s.motivo === 'string' && s.motivo.length > 10));
check('persona desconhecida ou vazia: nenhuma sugestão', sug('').length === 0 && sug('inventada').length === 0 && sug(null).length === 0);

console.log('\n== As linhas da sessão ==');
const L = G.linhas({ catalogo: cat, origens: ['guia-vls-ts'], persona: 'campus_france', indicados: ['etudes-en-france-2027-2028'] });
const st = (slug) => L.find((x) => x.slug === slug).estado;
check('pediu → "pediu"; indicado por você → "indicado"; bom para a persona → "sugerido"; resto → "livre"', st('vls-ts-validacao-travou') === 'pediu' && st('etudes-en-france-2027-2028') === 'indicado' && st('tecnologo-nivel-na-franca') === 'sugerido' && st('email-alternancia-30-mais') === 'livre');
check('o que ela pediu vem primeiro, depois indicados, sugeridos e o resto', L.map((x) => x.estado).join(',').replace(/(\w+)(,\1)+/g, '$1') === 'pediu,indicado,sugerido,livre');
check('o que ela pediu E você indicou conta como "pediu" (uma linha só)', G.linhas({ catalogo: cat, origens: ['guia-vls-ts'], persona: '', indicados: ['vls-ts-validacao-travou'] }).filter((x) => x.slug === 'vls-ts-validacao-travou').length === 1 && G.linhas({ catalogo: cat, origens: ['guia-vls-ts'], persona: '', indicados: ['vls-ts-validacao-travou'] }).find((x) => x.slug === 'vls-ts-validacao-travou').estado === 'pediu');
check('a linha sugerida leva o motivo', L.find((x) => x.slug === 'tecnologo-nivel-na-franca').motivo.length > 10);

console.log('\n== O HTML ==');
const H = { esc, btn: (acao, slug, rot) => '<button data-guia="' + acao + '" data-slug="' + esc(slug) + '">' + esc(rot) + '</button>' };
const html = G.guiasHtml(L, H);
check('cada estado tem o seu rótulo em palavras (não só cor)', html.includes('Ela pediu') && html.includes('Indicado por você') && html.includes('Sugerido'));
check('pediu não tem botão (aparece sozinho); indicado tem Retirar; sugerido e livre têm Mostrar para ela', !/data-guia="[a-z]+" data-slug="vls-ts-validacao-travou"/.test(html) && /data-guia="retirar" data-slug="etudes-en-france-2027-2028"/.test(html) && /data-guia="indicar" data-slug="tecnologo-nivel-na-franca"/.test(html) && /data-guia="indicar" data-slug="email-alternancia-30-mais"/.test(html));
check('há um resumo (quantos pediram, quantos indicados) e o botão de mostrar todos os sugeridos', /1 pediu/.test(html) && /1 indicado/.test(html) && /data-guia="sugeridos"/.test(html));
check('sem sugestões, não há botão de mostrar todos', !G.guiasHtml(G.linhas({ catalogo: cat, origens: [], persona: '', indicados: [] }), H).includes('data-guia="sugeridos"'));
check('título e motivo são escapados; sem NaN/undefined', !G.guiasHtml([{ slug: 'x', titulo: '<img src=x>', categoria: '', leitura_min: null, estado: 'sugerido', motivo: '<b>m</b>', url: '/guias/x/' }], H).includes('<img') && !/NaN|undefined/.test(html));
console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
