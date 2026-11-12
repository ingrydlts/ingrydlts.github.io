import * as TX from '../../taxonomia.js';
import { ETAPAS, etapaDaJornada, montaJornada } from '../../jornada.js';
var falhas = 0; function check(n, ok) { console.log((ok ? 'ok   ' : 'FALHA ') + n); if (!ok) falhas++; }
var m = (chave, o) => Object.assign({ chave, nome: chave, tipo: 'servico', excluido_em: null, familia: null, pagina: null, etapa: null, persona: null }, o);
check('4 etapas com e-mail, na ordem do funil', ETAPAS.map((e) => e.k).join() === 'lead,contato,reimp,plat');
check('freebie é Entrega (lead)', etapaDaJornada(m('x', { familia: 'entrega', objetivo_chave: 'freebie' })) === 'lead');
check('conversa/convite é Primeiro contato', etapaDaJornada(m('x', { familia: 'entrega', objetivo_chave: 'conversa' })) === 'contato' && etapaDaJornada(m('guia_chamada', { familia: 'entrega' })) === 'contato');
check('cf_guia_conversa é Primeiro contato', etapaDaJornada(m('cf_guia_conversa', { familia: 'entrega' })) === 'contato');
check('reimpacto é Reimpacto', etapaDaJornada(m('naoabriu', { familia: 'reimpacto' })) === 'reimp');
check('acesso e compra são Plataforma', etapaDaJornada(m('boas_vindas', { familia: 'acesso' })) === 'plat' && etapaDaJornada(m('hub_estudos_compra', { familia: 'compra' })) === 'plat');
check('aupair_chegada_2 (beta) é Plataforma', etapaDaJornada(m('aupair_chegada_2', { familia: 'entrega' })) === 'plat');
check('aquecimento e campanha ficam fora da matriz', etapaDaJornada(m('aq_a_d3', { familia: 'aquecimento' })) === null && etapaDaJornada(m('lembrete', { familia: 'campanha' })) === null);
var lista = [m('aupair_chegada_1', { familia: 'entrega', pagina: 'I05' }), m('aupair_chegada_2', { familia: 'entrega', pagina: 'I05' }), m('naoabriu', { familia: 'reimpacto' }),
  m('aq_a_d3', { familia: 'aquecimento', pagina: 'I03' }), m('hub_estudos_lancamento', { familia: 'campanha' }), m('velho', { familia: 'entrega', pagina: 'I01', excluido_em: '2026-01-01' })];
var J = montaJornada(lista, TX);
var i05 = J.linhas.find((l) => l.k === 'I05');
check('uma linha por página + a linha transversal', J.linhas.map((l) => l.k).join() === 'I01,I02,I03,I04,I05,TR');
check('I05 tem e-mail em lead e plataforma, falta contato e reimpacto', i05.celulas.lead.length === 1 && i05.celulas.plat.length === 1 && !i05.celulas.contato.length && !i05.celulas.reimp.length);
check('cobertura da I05 = 2 de 4', i05.cobertas === 2);
check('cadeia quebrada: contato entre lead e plataforma', i05.quebrada.contato === true && !i05.quebrada.reimp);
check('transversal recebe o reimpacto sem página', J.linhas.find((l) => l.k === 'TR').celulas.reimp.length === 1);
check('excluído não conta', J.linhas.find((l) => l.k === 'I01').cobertas === 0);
check('aquecimento e campanhas vão para as bandejas', J.bandejas.aquecimento.length === 1 && J.bandejas.campanhas.length === 1);
check('estatística: etapas sem e-mail só nas páginas (4+4+4+4+2)', J.stats.semEmail === 18 && J.stats.total === 5);
check('linha tem rota e nome da página', i05.rota === '/guias/checklist-chegada-au-pair/' && /Au pair/.test(i05.nome));
if (falhas) { console.log(falhas + ' falhas'); process.exit(1); }
