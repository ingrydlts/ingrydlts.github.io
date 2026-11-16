// Testa o Panorama dela e "O que ela trouxe" (admin/crm/panorama.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node panorama.test.mjs
import { panorama, sugestoes, montaCoorte, logColetado, htmlPanorama, htmlTrouxe, limpa, privado, hostDe, rotQ } from '../../panorama.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const h = { esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
const ui = { sugs: {}, dd: {} };

console.log('== limpa, privado, hostDe, rotQ ==');
{
  const o = limpa('a@b.com 12345678901');
  check('limpa oculta e-mail e número longo', o.r === true && o.t.includes('[e-mail]') && o.t.includes('[número]') && !/\d{5}/.test(o.t));
  check('limpa sem dado pessoal não muda o texto', limpa('Pedir parcelamento') .r === false && limpa('Pedir parcelamento').t === 'Pedir parcelamento');
  check('limpa aceita vazio e nulo', limpa(null).t === '' && limpa(undefined).r === false);
  check('limpa oculta IBAN', limpa('FR76 3000 6000 0112 3456 7890 189').r === true);
  check('privado: Drive é privado', privado('https://drive.google.com/x') === true);
  check('privado: site público não é', privado('https://campusfrance.org') === false);
  check('privado: subdomínio de serviço privado', privado('https://meu.dropbox.com/x') === true);
  check('hostDe tira www e tolera lixo', hostDe('https://www.exemplo.fr/a') === 'exemplo.fr' && hostDe('lixo') === '');
  check('rotQ com hora', rotQ('2026-11-20T09:30') === '20/11 às 09:30');
  check('rotQ só data e vazio', rotQ('2026-11-20') === '20/11' && rotQ('') === '');
}

console.log('== panorama ==');
{
  const vazio = panorama({ itens: [], escolas: [], coorte: null });
  check('sem sinais: leitura começa com "Ainda sem sinais"', vazio.leitura.indexOf('Ainda sem sinais') === 0 && vazio.n === 0);
  check('sem sinais: nada de coorte nem NaN', vazio.co === null && vazio.temas.length === 0 && vazio.imp.length === 0);
  const hv = htmlPanorama(vazio, sugestoes(vazio), ui, h);
  check('sem sinais: html diz "poucos dados" e não tem NaN/undefined', hv.indexOf('poucos dados') >= 0 && !/NaN|undefined/.test(hv));

  const itens = [
    { step_key: 'a', category: 'escola', label: 'Escolher escola', titulo_custom: 'Escolher escola com parcelamento', nota_custom: 'Ver valor e parcelamento da matrícula', quando_custom: '2026-11-20T09:30', updated_at: '2026-11-10T10:00:00Z' },
    { step_key: 'b', category: 'meu:x', label: 'Ligar para a prefeitura', updated_at: '2026-11-12T10:00:00Z' },
    { step_key: 'c', category: 'visto', label: 'Traduzir diploma', status: 'arquivado', updated_at: '2026-11-11T10:00:00Z' },
    { step_key: 'd', category: 'visto', label: 'Anexar', links_custom: [{ url: 'https://drive.google.com/x', label: 'pasta' }, { url: 'https://campusfrance.org/a', label: 'Campus France' }], updated_at: '2026-11-09T10:00:00Z' }
  ];
  const escolas = [{ nome: 'Escola Modelo', link: 'https://escola-modelo.fr', nota: 'contato: ana@exemplo.fr', criterios: { nivel: 'sim', parcela: 'nao' }, criado_em: '2026-11-13T10:00:00Z' }];
  const p = panorama({ nome: 'Ana Teste', itens, escolas, coorte: { n: 2, kw: [], pad: { arq: 0, ren: 0, data: 0, prop: 0 } } });
  check('conta sinais: 4 passos distintos + 1 escola', p.n === 5);
  check('link do Drive não vira fonte, só conta como ignorado', p.priv === 1 && p.fontes.some((f) => f.host === 'campusfrance.org') && !p.fontes.some((f) => f.host === 'drive.google.com'));
  check('e-mail da nota da escola é ocultado', p.red >= 1);
  check('coorte n=2: co é null e html diz "Poucos dados para comparar"', p.co === null && htmlPanorama(p, sugestoes(p), ui, h).indexOf('Poucos dados para comparar') >= 0);
  check('há datas e prazo nos temas', p.datas.length === 1 && p.temas.some((t) => t[0] === 'Prazos'));
  check('impulsos no máximo 3', p.imp.length <= 3 && p.imp.length > 0);

  const co3 = { n: 3, kw: [['parcelamento', 2]], pad: { arq: 2, ren: 1, data: 1, prop: 2 } };
  const p3 = panorama({ nome: 'Ana Teste', itens, escolas, coorte: co3 });
  check('coorte n=3: co.n === 3', p3.co && p3.co.n === 3);
  check('coorte n=3: html compara com o grupo', htmlPanorama(p3, sugestoes(p3), ui, h).indexOf('No grupo (3 pessoas na plataforma)') >= 0);
  const sg = sugestoes(p3);
  check('sugestões trazem ids únicos', new Set(sg.map((s) => s.id)).size === sg.length && sg.length > 0);
  const t = htmlTrouxe(p, ui, h);
  check('O que ela trouxe lista escola, sem e-mail e sem Drive', t.indexOf('Escola Modelo') >= 0 && t.indexOf('ana@exemplo.fr') < 0 && t.indexOf('drive.google.com') < 0);
  check('html escapa texto dela', htmlTrouxe(panorama({ itens: [{ step_key: 'z', category: 'meu:y', label: '<img onerror=x>' }], escolas: [] }), ui, h).indexOf('<img') < 0);
}

console.log('== montaCoorte ==');
{
  const linhas = [
    { user_id: 'u1', status: 'arquivado', category: 'x' },
    { user_id: 'u1', titulo_custom: 'Pagar parcelamento', category: 'x' },
    { user_id: 'u2', category: 'meu:a', label: 'Pedir parcelamento', quando_custom: '2026-11-20' },
    { user_id: 'fora', status: 'arquivado', category: 'x', titulo_custom: 'Parcelamento' }
  ];
  const c = montaCoorte(linhas, ['u1', 'u2', 'u3']);
  check('só conta usuários da lista', c.n === 3 && c.pad.arq === 1 && c.pad.ren === 1 && c.pad.data === 1 && c.pad.prop === 1);
  check('palavra repetida por 2 pessoas entra em kw', c.kw.some((k) => k[0].toLowerCase().indexOf('parcelamento') >= 0 && k[1] === 2));
  check('lista vazia: n 0 sem quebrar', montaCoorte(null, null).n === 0);
}

console.log('== logColetado ==');
{
  const l = logColetado({ itens: [
    { step_key: 'a', category: 'x', label: 'Velho', nota_custom: 'n', updated_at: '2026-11-01T10:00:00Z' },
    { step_key: 'b', category: 'meu:x', label: 'Novo', updated_at: '2026-11-12T10:00:00Z' }
  ], escolas: [{ nome: 'Escola', criado_em: '2026-11-05T10:00:00Z' }] });
  check('ordena do mais recente ao mais antigo', l.map((x) => x.label).join('|') === 'Novo|Escola|Velho');
  check('tipos certos', l[0].tipo === 'Criou' && l[1].tipo === 'Adicionou escola' && l[2].tipo === 'Editou');
}

console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
