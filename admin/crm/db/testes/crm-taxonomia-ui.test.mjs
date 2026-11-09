// Testa o catálogo e a classificação dos modelos de e-mail (admin/crm/taxonomia.js). Módulo puro, sem DOM.
//
// Uso: cd admin/crm/db/testes && node crm-taxonomia-ui.test.mjs
import { FAMILIAS, PAGINAS, PERSONAS, classifica, temColunas, rotuloFamilia, rotuloPagina, rotuloEtapa, familiaDoObjetivo } from '../../taxonomia.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

// ---------- Catálogo ----------
check('8 famílias na ordem', FAMILIAS.map((f) => f[0]).join() === 'entrega,personalizado,aquecimento,serie,compra,acesso,reimpacto,campanha');
check('4 páginas', PAGINAS.map((p) => p.k).join() === 'I01,I02,I03,I04');
check('4 personas', PERSONAS.map((p) => p[0]).join() === 'au_pair,pvt,estudante,conjuge');
check('I03 tem 5 etapas', PAGINAS[2].etapas.length === 5);

// ---------- Modo banco ----------
const b = classifica({ chave: 'x', familia: 'acesso', pagina: null, etapa: null, persona: null });
check('banco: origem', b.origem === 'banco');
check('banco: valores', b.familia === 'acesso' && b.pagina === null && b.etapa === null && b.persona === null);
check('banco: familia null continua banco', classifica({ chave: 'boas_vindas', familia: null }).origem === 'banco');

// ---------- Modo de reserva ----------
function res(chave, fam, pag, persona, extra) {
  const c = classifica(Object.assign({ chave: chave }, extra || {}));
  check(chave + ' reserva origem', c.origem === 'reserva');
  check(chave + ' familia=' + fam, c.familia === fam);
  check(chave + ' pagina=' + pag, c.pagina === (pag || null));
  check(chave + ' etapa null', c.etapa === null);
  check(chave + ' persona=' + persona, c.persona === (persona || null));
}
res('boas_vindas', 'acesso');
res('acesso_confirmado', 'acesso');
res('link_pagamento', 'compra');
res('hub_estudos_compra', 'compra', null, null, { tipo: 'compra' });
res('hub_estudos_d3', 'compra', null, null, { tipo: 'compra' });
['naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp'].forEach((k) => res(k, 'reimpacto'));
['cf_guia_1', 'cf_guia_conversa'].forEach((k) => res(k, 'entrega', 'I03'));
['aq_a_d3', 'aq_b_d6', 'aq_c_d15'].forEach((k) => res(k, 'aquecimento', 'I03'));
res('guia_alternancia', 'entrega', 'I01');
['guia_chamada', 'guia_plataforma'].forEach((k) => res(k, 'entrega', 'I04'));
res('tec_recap_30min', 'entrega', 'I02');
['aupair_chegada_1', 'aupair_chegada_2'].forEach((k) => res(k, 'entrega', null, 'au_pair'));
['hub_estudos_lancamento', 'lembrete_prazo_vlsts'].forEach((k) => res(k, 'campanha'));

let desconhecida;
let lancou = false;
try { desconhecida = classifica({ chave: 'chave_que_nao_existe' }); } catch (e) { lancou = true; }
check('desconhecida não lança', !lancou);
check('desconhecida tudo null', desconhecida && desconhecida.familia === null && desconhecida.pagina === null && desconhecida.etapa === null && desconhecida.persona === null);

// ---------- Rótulos ----------
check('rotuloEtapa conhecida', rotuloEtapa('I02', 'tec-nao-sei') === 'Não sei o nível');
check('rotuloEtapa desconhecida', rotuloEtapa('I02', 'etapa-nova') === 'etapa-nova');
check('rotuloFamilia', rotuloFamilia('entrega') === 'Entrega do material');
check('rotuloFamilia null', rotuloFamilia(null) === 'Sem classificação');
check('rotuloFamilia desconhecida', rotuloFamilia('zzz') === 'zzz');
check('rotuloPagina', rotuloPagina('I03') === 'I03 · Études en France 2027-2028');
check('rotuloPagina desconhecida', rotuloPagina('I99') === 'I99');

// ---------- Objetivo e colunas ----------
check('familiaDoObjetivo freebie', familiaDoObjetivo('freebie') === 'entrega');
check('familiaDoObjetivo zzz', familiaDoObjetivo('zzz') === null);
check('familiaDoObjetivo lancamento', familiaDoObjetivo('lancamento') === 'campanha');
check('temColunas sem', temColunas([{ chave: 'a' }]) === false);
check('temColunas com', temColunas([{ familia: null }]) === true);
check('temColunas vazia', temColunas([]) === true);

console.log(passed + ' passaram, ' + failed + ' falharam');
process.exit(failed ? 1 : 0);
