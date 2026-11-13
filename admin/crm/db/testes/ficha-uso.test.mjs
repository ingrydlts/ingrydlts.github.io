// Testa o cálculo de uso da plataforma (admin/crm/ficha-uso.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node ficha-uso.test.mjs
import { calcularUso } from '../../ficha-uso.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const AGORA = Date.parse('2026-11-13T12:00:00Z');
const t = (diasAtras, segs = 0) => new Date(AGORA - diasAtras * 864e5 + segs * 1000).toISOString();
// n cliques de uma sessão, a partir de `diasAtras`, um a cada `passo` segundos
const sessao = (id, diasAtras, n, passo) => Array.from({ length: n }, (_, i) => ({ sessao: id, criado_em: t(diasAtras, i * passo) }));

console.log('== Uso da plataforma ==');
{
  const v = calcularUso([], AGORA);
  check('lista vazia: zero sessões, médias nulas, sem última', v.sessoes === 0 && v.cliquesPorSessao === null && v.duracaoSeg === null && v.ultimaEm === null && v.diasDesdeUltima === null && v.suficiente === false);
}
{
  const c = [...sessao('a', 1, 4, 10), ...sessao('b', 2, 6, 10), ...sessao('c', 3, 8, 10)];
  const v = calcularUso(c, AGORA);
  check('3 sessões com 4, 6 e 8 cliques: média 6 e suficiente', v.sessoes === 3 && v.cliquesPorSessao === 6 && v.suficiente === true);
}
{
  const c = [...sessao('a', 1, 2, 120), ...sessao('b', 2, 3, 120), ...sessao('c', 3, 1, 0), ...sessao('d', 4, 4, 10)];
  const v = calcularUso(c, AGORA);
  check('duração: média só das sessões de 2+ cliques (120, 240 e 30 s)', v.duracaoSeg === 130);
  const so2 = calcularUso([...sessao('a', 1, 2, 120), ...sessao('b', 2, 3, 120), ...sessao('c', 3, 1, 0), ...sessao('d', 4, 3, 0)], AGORA);
  check('sessão de 1 clique não entra na duração (120 e 240 → 180)', calcularUso([...sessao('a', 1, 2, 120), ...sessao('b', 2, 3, 120), ...sessao('c', 3, 1, 0)], AGORA).duracaoSeg === 180 && so2.sessoes === 4);
}
{
  const c = [...sessao('a', 1, 3, 10), { sessao: null, criado_em: t(1) }, { sessao: '', criado_em: t(1) }];
  const v = calcularUso(c, AGORA);
  check('cliques sem sessão ficam à parte e não viram sessão', v.sessoes === 1 && v.semSessao === 2);
}
{
  const c = [...sessao('a', 1, 3, 10), { sessao: 'x', criado_em: 'xx' }, { sessao: 'y', criado_em: new Date(AGORA + 864e5).toISOString() }];
  const v = calcularUso(c, AGORA);
  check('data inválida ou no futuro é ignorada, sem NaN', v.sessoes === 1 && Number.isFinite(v.cliquesPorSessao === null ? 0 : v.cliquesPorSessao) && !String(v.duracaoSeg).includes('NaN'));
}
{
  const c = [...sessao('velha', 40, 5, 10), ...sessao('a', 2, 3, 10)];
  const v = calcularUso(c, AGORA);
  check('mais de 30 dias fica fora de sessões', v.sessoes === 1);
  const so = calcularUso(sessao('velha', 40.5, 5, 10), AGORA);
  check('só clique antigo: 0 sessões na janela, mas a última atividade aparece', so.sessoes === 0 && so.diasDesdeUltima === 40 && so.ultimaEm !== null);
}
{
  const v = calcularUso([...sessao('a', 1.5, 4, 10), ...sessao('b', 2, 6, 10)], AGORA);
  check('2 sessões: não suficiente e sem média de cliques', v.sessoes === 2 && v.suficiente === false && v.cliquesPorSessao === null);
  check('última atividade há 1 dia', v.diasDesdeUltima === 1);
}

console.log(`\n${failed ? failed + ' FALHARAM, ' : ''}${passed} passaram`);
process.exit(failed ? 1 : 0);
