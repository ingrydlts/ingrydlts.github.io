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

console.log('== Task 4: funil ==');
{
  const c0 = { user_id: null, estagio: 'lead' }, vazio = { mails: [], propostas: [], temBilan: false };
  const ctx = (o) => Object.assign({}, vazio, o);
  check('sem e-mails = 1', FX.etapaFunil(c0, vazio) === 1);
  check('com 1 e-mail = 2', FX.etapaFunil(c0, ctx({ mails: [{ modelo: 'x' }] })) === 2);
  check('guia_chamada = 3', FX.etapaFunil(c0, ctx({ mails: [{ modelo: 'guia_chamada' }] })) === 3);
  check('proposta de 1:1 = 3', FX.etapaFunil(c0, ctx({ propostas: [{ titulo: 'Um 1:1 de 20 minutos?' }] })) === 3);
  check('um_a_um = 4', FX.etapaFunil({ user_id: null, estagio: 'um_a_um' }, vazio) === 4);
  check('um_a_um com bilan = 5', FX.etapaFunil({ user_id: null, estagio: 'um_a_um' }, ctx({ temBilan: true })) === 5);
  check('boas_vindas sem conta = 6', FX.etapaFunil(c0, ctx({ mails: [{ modelo: 'boas_vindas' }] })) === 6);
  check('com conta = 7', FX.etapaFunil({ user_id: 'u1', estagio: 'em_uso' }, vazio) === 7);
  check('bilan sozinho não pula etapa de quem não fez 1:1', FX.etapaFunil(c0, ctx({ temBilan: true })) === 1);
  check('ctx ausente não quebra', FX.etapaFunil(c0, undefined) === 1 && FX.etapaFunil(c0, {}) === 1);
  check('7 etapas na ordem do spec', FX.ETAPAS_FUNIL.length === 7 && FX.ETAPAS_FUNIL[0] === 'Entrou no funil' && FX.ETAPAS_FUNIL[1] === 'Recebeu o guia' && FX.ETAPAS_FUNIL[2] === '1:1 oferecido' && FX.ETAPAS_FUNIL[3] === '1:1 marcado' && FX.ETAPAS_FUNIL[4] === '1:1 feito' && FX.ETAPAS_FUNIL[5] === 'Plataforma oferecida' && FX.ETAPAS_FUNIL[6] === 'Na plataforma');
  check('aba padrão: converteu = plataforma, captação = ficha', FX.abaPadrao({ user_id: 'u1', estagio: 'inativo' }) === 'plataforma' && FX.abaPadrao({ user_id: null }) === 'ficha');
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
