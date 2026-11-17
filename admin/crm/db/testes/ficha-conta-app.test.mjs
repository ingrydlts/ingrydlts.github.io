// A conta "X de Y" do checklist no CRM tem de ser a do app. Dados inventados.
// Uso: cd admin/crm/db/testes && node ficha-conta-app.test.mjs
import * as FX from '../../ficha.js';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const mapa = { porCategoria: { Visto: 'visa', Banco: 'banco' }, definicoes: { visa: { label: 'Visa' }, banco: { label: 'Banco' } }, ordem: ['visa', 'banco'] };
const it = (k, cat, st) => ({ step_key: k, category: cat, label: k, status: st });
const ac = (id, estado, extra) => Object.assign({ id, titulo: 't' + id, dono: 'ela', canal: 'plataforma', estado, publicada_em: '2026-11-10', lista_chave: null, origem_chave: null, prazo_texto: '' }, extra || {});
const itens = [it('a', 'Visto', 'concluido'), it('b', 'Visto', 'concluido'), it('c', 'Banco', 'pendente'), it('x', 'Visto', 'arquivado')];
const listas = [{ chave: 'l1', estado: 'publicado' }, { chave: 'l2', estado: 'rascunho' }];
const acoes = [
  ac(1, 'concluida'), ac(2, 'aberta', { lista_chave: 'l1' }), ac(3, 'aberta', { origem_chave: 'enc:1' }),
  ac(4, 'aberta', { publicada_em: null }),                       // rascunho: não conta
  ac(5, 'aberta', { lista_chave: 'l2' }),                        // lista não publicada: não conta
  ac(6, 'aberta', { prazo_texto: 'na mesma ligação' }),          // absorvida: não conta
  ac(7, 'aberta', { dono: 'ingryd' }), ac(8, 'aberta', { canal: 'email' })
];
const base = { mapa, persona: 'x', itens, acoes, listas };
const t = FX.contaChecklistApp(base);
check('todas: 3 itens (sem arquivado) + 3 ações publicadas, qualquer origem', t.total === 6 && t.feitos === 3);
const v = FX.contaChecklistApp({ ...base, dem: 'visa' });
check('aba principal (visa tem aberto? não: 2/2) → principal é banco', v.principal === 'banco');
check('aba visa não leva as ações da equipe', v.total === 2 && v.feitos === 2 && v.passos.length === 0);
const b = FX.contaChecklistApp({ ...base, dem: 'banco' });
check('aba principal leva itens + ações', b.total === 4 && b.feitos === 1);
check('sem itens (sem conta): conta só as ações publicadas', FX.contaChecklistApp({ ...base, itens: [] }).total === 3);
check('démarche desconhecida cai em todas', FX.contaChecklistApp({ ...base, dem: 'zzz' }).total === 6);
check('sem nada', FX.contaChecklistApp({}).total === 0);
console.log(bad ? `${bad} falhou, ${ok} ok` : `ok: ${ok} verificações`); process.exit(bad ? 1 : 0);
