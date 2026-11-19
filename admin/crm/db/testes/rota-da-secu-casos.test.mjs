// Testa guias/rota-da-secu/casos.js: o texto dos 20 casos (4 portas × 5 pontos) que a página e o e-mail 1 da Rota da Sécu usam.
// Sem rede, sem banco. Uso: node admin/crm/db/testes/rota-da-secu-casos.test.mjs
import * as C from '../../../../guias/rota-da-secu/casos.js';

let ok = 0, falhou = 0;
const check = (rotulo, cond) => { if (cond) ok++; else { falhou++; console.log('  FALHOU:', rotulo); } };

const PORTAS = ['estudante', 'trabalho', 'aupair', 'outro'];
const PONTOS = ['nao_cheguei', 'sem_numero', 'esperando', 'sem_vitale', 'completo'];
check('PORTAS e PONTOS têm os ids do CRM, na ordem', JSON.stringify(C.PORTAS.map((p) => p.id)) === JSON.stringify(PORTAS) && JSON.stringify(C.PONTOS.map((p) => p.id)) === JSON.stringify(PONTOS));
check('OFICIAL é o link service-public R45084', C.OFICIAL === 'https://www.service-public.gouv.fr/particuliers/vosdroits/R45084');

const HOSTS_OK = (u) => { try { const h = new URL(u); return h.protocol === 'https:' && /(^|\.)(gouv\.fr|ameli\.fr|urssaf\.fr)$/.test(h.hostname); } catch (e) { return false; } };
for (const [k, f] of Object.entries(C.FONTES)) {
  check('fonte ' + k + ' tem rótulo, data DD/MM/AAAA e url oficial https', !!f.rot && /^\d{2}\/\d{2}\/\d{4}$/.test(f.data) && (f.url === null || HOSTS_OK(f.url)));
  check('fonte ' + k + ' não aponta para a página inicial do site (sem endereço exato, url é null e a página mostra só o texto)', f.url === null || new URL(f.url).pathname.length > 1);
}

const textos = (c) => [c.tipo, c.primeiro, ...c.passos.flatMap((p) => [p.t, p.x, p.fr || ''])];
const PROIBIDO = [[/—|–/, 'travessão'], [/[\[\]]/, 'colchetes'], [/\bsempre\b/i, 'sempre'], [/\(a\)|\(o\)|@/i, 'marca de gênero'], [/\b(registrad|identificad|reembolsad|afiliad)[ao]s?\b/i, 'adjetivo com gênero'], [/precisa ser registrad|, e você também precisa|já é identificad/i, 'afirmação sem fonte (au pair/NIA)']];
for (const p of PORTAS) for (const q of PONTOS) {
  const c = C.caso(p, q), rot = p + '.' + q;
  check(rot + ': primeiro passo, passos e fontes', typeof c.primeiro === 'string' && c.primeiro.length > 10 && c.passos.length >= 1 && c.fontes.length >= 1 && !!c.tipo);
  check(rot + ': toda fonte existe em FONTES', c.fontes.every((k) => k in C.FONTES));
  check(rot + ': cada passo tem título e texto', c.passos.every((s) => s.t && s.x));
  for (const [re, nome] of PROIBIDO) check(rot + ': sem ' + nome, textos(c).every((t) => !re.test(t)));
}

check('au pair: o registro na CPAM aparece como "confirme com o 3646", não como afirmação', ['nao_cheguei', 'sem_numero'].every((q) => textos(C.caso('aupair', q)).some((t) => /Confirme com o 3646/.test(t))));
check('estudante sem número manda ao etudiant-etranger.ameli.fr', /etudiant-etranger\.ameli\.fr/.test(C.caso('estudante', 'sem_numero').primeiro));
check('valor fora das listas lança erro', (() => { try { C.caso('x', 'esperando'); return false; } catch (e) { return e instanceof Error; } })());
check('ponto fora da lista lança erro', (() => { try { C.caso('aupair', 'nada'); return false; } catch (e) { return e instanceof Error; } })());
check('caso(esperando) traz a frase em francês de apoio', C.caso('aupair', 'esperando').passos.some((s) => typeof s.fr === 'string' && s.fr.length > 20));

check('o francês começa NÃO revisado, e o rótulo diz que está em revisão', C.FRANCES_REVISADO === false && /em revisão/i.test(C.rotuloFrances()));
check('com o francês revisado o rótulo some o aviso', !/revis/i.test(C.rotuloFrances(true)) && /francês/i.test(C.rotuloFrances(true)));

console.log(`${ok} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
