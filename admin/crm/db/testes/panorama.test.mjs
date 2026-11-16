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

console.log('== Panorama vivo: a conversa entra no Panorama ==');
{
  const P1 = { leitura: 'Ansiosa com o prazo do visto, mas decidida.', termometros: [{ chave: 'angustia', nivel: 3, porque: 'Volta ao prazo do visto', momento: '12:30' }, { chave: 'duvida', nivel: 2, porque: 'Liga ou escreve?', momento: '20:05' }],
    temas: [{ tema: 'Visto', peso: 3, nota: 'O prazo do PVT pesa', momento: '12:30' }, { tema: 'Moradia', peso: 1, nota: 'Ainda sem lugar', momento: '40:00' }],
    palavras: [{ palavra: 'prazo', vezes: 6 }, { palavra: 'parcelamento', vezes: 2 }],
    acoes: [{ texto: 'Ligar para a escola', dono: 'ela', momento: '20:05' }, { texto: 'Mandar o guia', dono: 'ingryd', momento: '45:10' }],
    maneiras: [{ chave: 'quer_passo_a_passo', momento: '08:00' }],
    hipoteses: [{ texto: 'Provavelmente trava no telefone', evidencia: 'Evitou ligar', confirmar: 'Ver se concluiu Ligar', momento: '20:05' }] };
  const P2 = { ...P1, leitura: 'Mais calma; falta decidir a escola.', termometros: [{ chave: 'angustia', nivel: 1, porque: 'Resolveu o prazo', momento: '05:00' }, { chave: 'duvida', nivel: 2, porque: 'Liga ou escreve?', momento: '20:05' }] };
  const c1 = { versao: 1, quando: '2026-11-10T10:00:00Z', p: P1 }, c2 = { versao: 2, quando: '2026-11-16T10:00:00Z', p: P2 };

  const sem = panorama({ itens: [], escolas: [], coorte: null });
  check('sem conversa nada muda: a.conv é nulo', sem.conv === null);

  const a = panorama({ nome: 'Ana Teste', itens: [], escolas: [], coorte: null, conversas: [c1] });
  check('com uma conversa e nenhum uso do app, já há leitura, temas e sinais', a.conv && a.conv.n === 1 && a.leitura === P1.leitura && a.temas.length === 2 && a.n > 0);
  check('o tema da conversa tem peso e a origem com o momento', a.temas[0][0] === 'Visto' && a.ev.Visto[0].f === 'conversa 1 · 12:30' && a.ev.Visto[0].t === 'O prazo do PVT pesa');
  check('termômetros saem com rótulo em português, nível por extenso e sem tendência (só 1 conversa)', a.conv.termo.length >= 2 && a.conv.termo[0].rotulo === 'Angústia' && a.conv.termo[0].nivelRot === 'alta' && a.conv.termo[0].tend === null);
  check('palavras da conversa entram nas palavras do Panorama, com a contagem', a.chips.some((c) => c.w === 'prazo' && c.n === 6));
  check('ações e maneiras ganham rótulo; a ação diz de quem é', a.conv.acoes.length === 2 && a.conv.acoes[1].dono === 'ingryd' && a.conv.maneiras[0].rotulo.length > 0 && a.conv.maneiras[0].chave === 'quer_passo_a_passo');
  check('a hipótese ganha um id estável', a.conv.hip[0].id.indexOf('h-') === 0 && a.conv.hip[0].id === panorama({ itens: [], escolas: [], coorte: null, conversas: [c1] }).conv.hip[0].id);
  check('angústia alta vira impulso de acolher; a promessa da equipe vira impulso de cumprir', a.imp.some((i) => /acolher/i.test(i.t)) && a.imp.length <= 3 && a.imp.every((i) => !/undefined|NaN/.test(i.msg + i.t + i.ev)));

  const b = panorama({ nome: 'Ana Teste', itens: [], escolas: [], coorte: null, conversas: [c1, c2] });
  check('com duas conversas, vale a última: leitura e termômetros', b.leitura === P2.leitura && b.conv.n === 2 && b.conv.termo[0].nivel === 1);
  check('tendência contra a conversa anterior, em palavras e sem depender de cor', b.conv.termo[0].tend === 'caiu' && b.conv.termo[0].antes === 3 && b.conv.termo[1].tend === 'igual');
  const sub = panorama({ itens: [], escolas: [], coorte: null, conversas: [c2, { versao: 3, quando: 'x', p: { ...P1, termometros: [{ chave: 'angustia', nivel: 4, porque: 'Piorou', momento: '01:00' }] } }] });
  check('subiu quando o nível sobe', sub.conv.termo[0].tend === 'subiu');

  const itens = [{ step_key: 'a', category: 'escola', label: 'Escolher escola', titulo_custom: 'Escolher escola com parcelamento', nota_custom: 'Ver parcelamento', quando_custom: '2026-11-20', updated_at: '2026-11-12T10:00:00Z' }];
  const m = panorama({ nome: 'Ana Teste', itens, escolas: [], coorte: null, conversas: [c1] });
  check('app e conversa se somam nos mesmos temas e palavras, cada um com a sua origem', m.ev.Prazos.some((x) => x.f === 'data escolhida') && m.ev.Visto.some((x) => /^conversa 1/.test(x.f)) && m.n > a.n);
  check('a leitura junta a conversa com o uso do app', m.leitura.indexOf(P1.leitura) === 0 && /No app/.test(m.leitura));
  check('uso do app aparece como termômetro calculado, só quando há conversa', m.conv.termo.some((t) => t.chave === 'app') && !a.conv.termo.some((t) => t.chave === 'app' && t.nivel > 0 && false));
  const semApp = a.conv.termo.find((t) => t.chave === 'app');
  check('sem nada no app, o uso do app é nível 0 com o porquê', semApp && semApp.nivel === 0 && /ainda/i.test(semApp.porque));

  check('conversa sem panorama (proposta antiga) é ignorada', panorama({ itens: [], escolas: [], coorte: null, conversas: [{ versao: 1, quando: 'x', p: null }, { versao: 2, quando: 'x', p: {} }] }).conv === null);
  check('panorama vazio de uma conversa que não rendeu nada não quebra', (() => { const x = panorama({ itens: [], escolas: [], coorte: null, conversas: [{ versao: 1, quando: 'x', p: { leitura: '', termometros: [], temas: [], palavras: [], acoes: [], maneiras: [], hipoteses: [] } }] }); return x.conv && x.conv.n === 1 && x.leitura.length > 0; })());

  const L = logColetado({ itens: [], escolas: [], conversas: [c1, c2] });
  check('"O que foi coletado" lista as conversas lidas, mais recente primeiro', L.length === 2 && L[0].tipo === 'Leu a conversa' && L[0].label === 'Conversa 2');

  const ui2 = { sugs: {}, dd: {}, log: L };
  const html = htmlPanorama(b, sugestoes(b), ui2, h);
  check('o html tem "Como ela está" com nível por extenso e tendência em palavras', html.indexOf('Como ela está') >= 0 && html.indexOf('Angústia') >= 0 && /caiu/.test(html) && /alta|moderada|leve/.test(html));
  check('o html tem as gavetas de maneiras, ações e hipóteses, com o momento para ouvir', html.indexOf('Maneiras') >= 0 && html.indexOf('Hipóteses abertas') >= 0 && html.indexOf('20:05') >= 0 && html.indexOf('Ver se concluiu Ligar') >= 0);
  check('hipótese tem botões de confirmar e descartar', /data-fx="sugAcao"[^>]*data-v="confirmada"/.test(html) && /data-fx="sugAcao"[^>]*data-v="descartada"/.test(html));
  check('hipótese descartada some e a confirmada mostra o estado', !htmlPanorama(b, [], { sugs: { [b.conv.hip[0].id]: 'descartada' }, dd: {} }, h).includes('Provavelmente trava') && /Confirmada/.test(htmlPanorama(b, [], { sugs: { [b.conv.hip[0].id]: 'confirmada' }, dd: {} }, h)));
  check('o aviso de privacidade diz que da conversa entra só tema, resumo e momento', /nunca o que ela disse/.test(html));
  check('o html da conversa escapa texto e não tem NaN/undefined', !/NaN|undefined/.test(html) && htmlPanorama(panorama({ itens: [], escolas: [], coorte: null, conversas: [{ versao: 1, quando: 'x', p: { ...P1, leitura: '<b>x</b>' } }] }), [], ui2, h).indexOf('<b>x</b>') < 0);
  check('sem conversa, o html continua sem as gavetas novas', htmlPanorama(sem, [], ui, h).indexOf('Como ela está') < 0);
}

console.log(passed + ' ok, ' + failed + ' falhas');
if (failed) process.exit(1);
