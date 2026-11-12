// Testa a lógica pura da ficha v2 (admin/crm/ficha.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node ficha.test.mjs
import * as FX from '../../ficha.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

console.log('== Task 2: urgência ==');
{
  const hoje = '2026-11-12';
  const it = (step_key, status, due_date) => ({ step_key, category: 'Visto', label: step_key, status, due_date, sort_order: 0 });
  const L = [it('A', 'pendente', '2026-11-14'), it('B', 'pendente', '2026-11-12'), it('C', 'pendente', null), it('D', 'concluido', '2026-11-10'),
    it('E', 'arquivado', null), it('F', 'pendente', '2026-11-20'), it('G', 'pendente', '2026-11-01')];
  const antes = L.map((x) => x.step_key).join();
  check('ordem completa', FX.maisUrgentes(L, 7, hoje).map((x) => x.step_key).join() === 'G,B,A,F,C,D,E');
  check('os 4 mais urgentes', FX.maisUrgentes(L, 4, hoje).map((x) => x.step_key).join() === 'G,B,A,F');
  check('feito e arquivado valem 9999', FX.urgenciaItem(L[3], hoje) === 9999 && FX.urgenciaItem(L[4], hoje) === 9999);
  check('sem data vale 500, atrasado é negativo', FX.urgenciaItem(L[2], hoje) === 500 && FX.urgenciaItem(L[6], hoje) < 0 && FX.urgenciaItem(L[1], hoje) === 0);
  check('lista vazia', FX.maisUrgentes([], 4, hoje).length === 0);
  check('não muda a entrada', L.map((x) => x.step_key).join() === antes);
}

console.log('== Task 3: démarches ==');
{
  const m = { porItem: { 'cf-dossie': 'candidatura' }, porCategoria: { Visto: 'visa', 'Saúde': 'ameli' },
    definicoes: { visa: { label: 'Visa étudiante' }, ameli: { label: 'Ameli' }, candidatura: { label: 'Campus France' }, caf: { label: 'CAF' } }, abas: { pvt: { visa: 'Visto de estudante' } } };
  check('passo criado por ela fica na démarche dela', FX.processoDoItem(m, 'x', 'meu:caf') === 'caf');
  check('exceção por step_key', FX.processoDoItem(m, 'cf-dossie', 'Qualquer') === 'candidatura');
  check('por categoria', FX.processoDoItem(m, 'x', 'Saúde') === 'ameli');
  check('categoria desconhecida cai em visa', FX.processoDoItem(m, 'x', 'Desconhecida') === 'visa');
  check('meu: vazio cai no padrão', FX.processoDoItem(m, 'x', 'meu:') === 'visa');
  check('rótulo por persona', FX.rotuloDemarche(m, 'visa', 'pvt') === 'Visto de estudante');
  check('rótulo genérico', FX.rotuloDemarche(m, 'visa', 'conjuge') === 'Visa étudiante');
  check('chave sem definição vira a própria chave', FX.rotuloDemarche(m, 'zzz', 'pvt') === 'zzz');
  const itens = [{ step_key: 'a', category: 'Visto', status: 'concluido' }, { step_key: 'b', category: 'Visto', status: 'pendente' }, { step_key: 'c', category: 'Saúde', status: 'pendente' }];
  const dm = FX.demarchesDe(m, 'conjuge', itens);
  check('démarches com contagem, sem vazias', JSON.stringify(dm) === JSON.stringify([{ k: 'visa', nome: 'Visa étudiante', feitos: 1, total: 2 }, { k: 'ameli', nome: 'Ameli', feitos: 0, total: 1 }]));
  check('sem passo não vira pílula', !dm.some((x) => x.k === 'caf' || x.k === 'candidatura'));
  check('filtra por démarche', FX.filtrarPorDemarche(m, itens, 'ameli').length === 1 && FX.filtrarPorDemarche(m, itens, 'todas').length === 3);
  check('mapa vazio não quebra', FX.demarchesDe({}, 'pvt', itens).length === 1 && FX.demarchesDe(null, 'pvt', []).length === 0);
  const m2 = Object.assign({}, m, { ordem: ['ameli', 'visa'] });
  check('usa a ordem do catálogo quando existe', FX.demarchesDe(m2, 'pvt', itens).map((x) => x.k).join() === 'ameli,visa');
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
