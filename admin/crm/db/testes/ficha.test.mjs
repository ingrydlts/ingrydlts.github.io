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

console.log('== Task 5: tarefas ==');
{
  const rot = (k) => ({ caf: 'CAF' }[k] || k);
  const ctx = (o) => Object.assign({ nome: 'Ana Souza', respostasNovas: 0, chatNaoLidas: 0, processosDetectados: [], bilanPendente: false, dossieFalta: 0, proximoEmail: null }, o);
  const cheio = ctx({ respostasNovas: 2, chatNaoLidas: 1, processosDetectados: ['caf'], bilanPendente: true, dossieFalta: 3, proximoEmail: { titulo: 'Reimpacto: parou no app', angulo: 'x', quando: 'agora' } });
  const ts = FX.tarefasDe(cheio, rot);
  check('ordem do spec §4.3', ts.map((x) => x.k).join() === 'resposta,chat,processo,bilan,dossie,funil');
  check('resposta: título, selo e destino', ts[0].t === 'Responder Ana' && ts[0].tag === 'Dela' && ts[0].dest.tab === 'conversa');
  check('chat e bilan levam à Plataforma; o dossiê leva à aba Dossiê', ts[1].dest.tab === 'plataforma' && ts[1].dest.sessao === 'chat' && ts[3].dest.sessao === 'bilan' && ts[4].dest.tab === 'dossie' && !ts[4].dest.sessao);
  check('processo usa o rótulo', /CAF/.test(ts[2].t) && ts[2].id === 'processo:caf');
  check('funil é o último e tem selo Funil', ts[5].tag === 'Funil' && ts[5].id === 'funil');
  check('todas têm id único, texto "por que" e cta', new Set(ts.map((x) => x.id)).size === ts.length && ts.every((x) => x.why && x.cta));
  check('tudo zerado = vazio', FX.tarefasDe(ctx({ proximoEmail: { titulo: 't', angulo: 'a', quando: 'nao' } }), rot).length === 0 && FX.tarefasDe(ctx(), rot).length === 0);
  check('funil só quando quando === "agora"', FX.tarefasDe(ctx({ proximoEmail: { titulo: 't', angulo: 'a', quando: 'espera' } }), rot).length === 0);
  check('nome vazio não quebra', FX.tarefasDe(ctx({ nome: '', respostasNovas: 1 }), rot)[0].t === 'Responder');
}

console.log('== Task 6: fila ==');
{
  const A = { c: { id: 'A', urgencia: 'alta' }, novas: 0 }, B = { c: { id: 'B', urgencia: 'baixa' }, novas: 2 }, C = { c: { id: 'C', urgencia: 'alta' }, novas: 2 }, D = { c: { id: 'D', urgencia: 'media' }, novas: 0 };
  const ent = [A, B, C, D], f = FX.ordenarFila(ent);
  check('mais novas, empate por urgência', f.map((x) => x.c.id).join() === 'C,B,A,D');
  check('não altera a entrada', ent.map((x) => x.c.id).join() === 'A,B,C,D');
  check('urgência ausente vai por último', FX.ordenarFila([{ c: { id: 'X' }, novas: 0 }, D]).map((x) => x.c.id).join() === 'D,X');
  const rot = (k) => ({ caf: 'CAF' }[k] || k);
  check('ação rápida: responder com o primeiro nome', FX.acaoRapida({ nome: 'Ana Souza' }, { respostasNovas: 1, processosDetectados: [] }, rot) === 'Responder Ana');
  check('ação rápida: processo', /CAF/.test(FX.acaoRapida({ nome: 'Ana' }, { respostasNovas: 0, processosDetectados: ['caf'] }, rot)));
  check('ação rápida: nada', FX.acaoRapida({ nome: 'Ana' }, { respostasNovas: 0, processosDetectados: [] }, rot) === 'Abrir a ficha');
}

console.log('== Task 7: sessões e preferências ==');
{
  check('mover nas pontas não muda', FX.moverSessao(['a', 'b', 'c'], 'a', -1).join() === 'a,b,c' && FX.moverSessao(['a', 'b', 'c'], 'c', 1).join() === 'a,b,c');
  check('mover no meio', FX.moverSessao(['a', 'b', 'c'], 'b', 1).join() === 'a,c,b');
  check('mover id desconhecido não muda', FX.moverSessao(['a', 'b'], 'z', 1).join() === 'a,b');
  check('reordenar antes de', FX.reordenarSessao(['a', 'b', 'c'], 'c', 'a').join() === 'c,a,b');
  check('reordenar para o fim', FX.reordenarSessao(['a', 'b', 'c'], 'a', null).join() === 'b,c,a');
  check('reordenar sobre si mesmo não muda', FX.reordenarSessao(['a', 'b', 'c'], 'b', 'b').join() === 'a,b,c');
  check('normalizar descarta e acrescenta', FX.normalizarOrdem(['x', 'b'], ['a', 'b', 'c']).join() === 'b,a,c');
  check('normalizar lixo', FX.normalizarOrdem('lixo', ['a']).join() === 'a' && FX.normalizarOrdem(null, ['a', 'b']).join() === 'a,b');
  check('normalizar repetidos', FX.normalizarOrdem(['b', 'b', 'a'], ['a', 'b']).join() === 'b,a');
  check('padrão das sessões da fase 1', FX.SESSOES_PADRAO.app.join() === 'chat,inicio,checklist' && FX.SESSOES_PADRAO.ela.join() === 'bilan,hist');   // o dossiê virou aba própria
  // Review Focus 5: localStorage indisponível
  const bloqueado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cheio'); } };
  let ok = true, p; try { p = FX.lerPrefs(bloqueado); FX.gravarPrefs(bloqueado, { tour: false }); } catch (e) { ok = false; }
  check('storage bloqueado não lança', ok && p.ord === null && p.tour === true);
  const mem = {}, st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  FX.gravarPrefs(st, { ord: { app: ['inicio', 'chat'], ela: ['hist'] }, tour: false });
  const lido = FX.lerPrefs(st);
  check('grava e lê', lido.tour === false && lido.ord.app.join() === 'inicio,chat,checklist' && lido.ord.ela.join() === 'hist,bilan');
  check('chaves do spec', 'crm_ficha_ord_v1' in mem && 'crm_ficha_tour' in mem);
  mem.crm_ficha_ord_v1 = JSON.stringify({ app: ['chat'], ela: ['hist', 'dossie', 'bilan'] });
  check('ordem salva com o dossiê antigo: ele some, o resto fica', FX.lerPrefs(st).ord.ela.join() === 'hist,bilan');
  mem.crm_ficha_ord_v1 = '{lixo'; check('JSON inválido volta ao padrão', FX.lerPrefs(st).ord === null);
  mem.crm_ficha_ord_v1 = '"texto"'; check('formato errado volta ao padrão', FX.lerPrefs(st).ord === null);
}

console.log('== Cabeçalho fixo: tipo e cartões ==');
{
  const ass = (status, extra) => Object.assign({ status, plano: 'Intermediário', criado_em: '2026-08-02T10:00:00Z', periodo_fim: '2026-11-02T10:00:00Z', cancela_no_fim: false }, extra || {});
  check('active é assinante', FX.tipoCabecalho({ user_id: 'u' }, ass('active')) === 'assinante');
  check('trialing é assinante', FX.tipoCabecalho({ user_id: 'u' }, ass('trialing')) === 'assinante');
  check('canceled com conta cai em plataforma', FX.tipoCabecalho({ user_id: 'u' }, ass('canceled')) === 'plataforma');
  check('past_due sem conta cai em lead', FX.tipoCabecalho({}, ass('past_due')) === 'lead');
  check('sem assinatura e com conta é plataforma; sem nada é lead', FX.tipoCabecalho({ user_id: 'u' }, null) === 'plataforma' && FX.tipoCabecalho({}, null) === 'lead');
  check('etiqueta: sem assinatura', FX.etiquetaPagamento(null).texto === 'Não assina' && FX.etiquetaPagamento(null).tom === 'neutro');
  check('etiqueta: ativa, em teste e atraso', FX.etiquetaPagamento(ass('active')).texto === 'Assinatura ativa' && FX.etiquetaPagamento(ass('trialing')).texto === 'Em teste' && FX.etiquetaPagamento(ass('past_due')).tom === 'aviso');
  check('etiqueta: cancelada nunca diz ativa', !/ativa/.test(FX.etiquetaPagamento(ass('canceled')).texto) && FX.etiquetaPagamento(ass('canceled')).tom === 'aviso');

  const uso = (o) => Object.assign({ sessoes: 12, semSessao: 0, cliquesPorSessao: 18, duracaoSeg: 360, ultimaEm: '2026-11-12T10:00:00Z', diasDesdeUltima: 1, suficiente: true }, o || {});
  const base = (o) => Object.assign({ c: { estagio: 'lead', dias_sem_sinal: 6, criado_em: '2026-10-17T10:00:00Z' }, estagioLabel: 'Lead', assin: null, uso: uso(), mailsTotal: 2, mailsAbertos: 1, mailsClicados: 0,
    entradas: 2, diasNaBase: 12, respostas: 0, respostasNovas: 0, proximo: { titulo: 'Falta o e-mail de primeiro contato', quando: 'nao' },
    chk: { feitos: 8, total: 14, vencem3: 2, atrasados: 0 }, chkMsg: '', agora: Date.parse('2026-11-13T12:00:00Z') }, o || {});
  const cart = (r) => r.blocos.reduce((a, b) => a.concat(b.cartoes), []);
  const por = (r, rot) => cart(r).filter((x) => x.rotulo === rot)[0];

  let r = FX.cartoesDe('lead', base());
  check('lead: seis cartões, sem bloco de pagamento e sem uso', cart(r).length === 6 && !por(r, 'Cliques por sessão') && !por(r, 'Plano') && r.nota === null);
  check('lead: parada há 6 dias em alerta', por(r, 'Parada há').valor === '6 dias' && por(r, 'Parada há').tom === 'alerta');
  r = FX.cartoesDe('lead', base({ c: { dias_sem_sinal: 2 } }));
  check('lead: parada há 2 dias sem alerta', por(r, 'Parada há').valor === '2 dias' && !por(r, 'Parada há').tom);
  r = FX.cartoesDe('lead', base({ c: { dias_sem_sinal: null }, mailsTotal: 0, mailsAbertos: 0 }));
  check('lead: sem dado mostra traço e o motivo, nunca zero inventado', por(r, 'Parada há').valor === '—' && por(r, 'E-mails').valor === '—' && /nenhum/i.test(por(r, 'E-mails').sub));
  check('lead: e-mails abriu 1 de 2; entradas no plural', por(FX.cartoesDe('lead', base()), 'E-mails').valor === '1 de 2' && por(FX.cartoesDe('lead', base()), 'Entradas').valor === '2 funis' && por(FX.cartoesDe('lead', base({ entradas: 1 })), 'Entradas').valor === '1 funil');
  check('lead: respostas esperando você', /2 esperando/.test(por(FX.cartoesDe('lead', base({ respostas: 3, respostasNovas: 2 })), 'Respostas').sub));

  r = FX.cartoesDe('assinante', base({ assin: ass('active') }));
  check('assinante: dois blocos, Pagamento primeiro com 3 cartões, e a nota', r.blocos.length === 2 && r.blocos[0].titulo === 'Pagamento' && r.blocos[0].cartoes.length === 3 && /LTV/.test(r.nota));
  check('assinante: plano, próxima cobrança e desde', por(r, 'Plano').valor === 'Intermediário' && por(r, 'Próxima cobrança').valor === '02/11' && por(r, 'Assinante desde').valor === '3 meses');
  check('assinante: em teste mostra fim do teste; cancelando mostra acesso até', por(FX.cartoesDe('assinante', base({ assin: ass('trialing', { teste_fim: '2026-11-20T00:00:00Z' }) })), 'Fim do teste').valor === '20/11' && por(FX.cartoesDe('assinante', base({ assin: ass('active', { cancela_no_fim: true }) })), 'Acesso até').valor === '02/11');
  check('assinante: uso com checklist e prazos em alerta', por(r, 'Sessões').valor === '12' && por(r, 'Cliques por sessão').valor === '18' && por(r, 'Duração (estimada)').valor === '6 min' && por(r, 'Checklist').valor === '8 de 14' && por(r, 'Checklist').tom === 'alerta');

  r = FX.cartoesDe('plataforma', base({ uso: uso({ sessoes: 2, suficiente: false, cliquesPorSessao: null, duracaoSeg: null }) }));
  check('plataforma: poucos dados mostra traço e diz por quê', por(r, 'Cliques por sessão').valor === '—' && /poucos dados/.test(por(r, 'Cliques por sessão').sub) && por(r, 'Duração (estimada)').valor === '—' && por(r, 'Sessões').valor === '2');
  r = FX.cartoesDe('plataforma', base({ chk: null, chkMsg: 'Ela ainda não entrou no app' }));
  check('plataforma: checklist ainda não carregou ou sem conta → traço e a mensagem', por(r, 'Checklist').valor === '—' && por(r, 'Checklist').sub === 'Ela ainda não entrou no app');
  r = FX.cartoesDe('plataforma', base({ uso: uso({ sessoes: 0, ultimaEm: null, diasDesdeUltima: null, suficiente: false, cliquesPorSessao: null, duracaoSeg: null }) }));
  check('plataforma: sem cliques nenhum → sessões traço e "ainda sem cliques"', por(r, 'Sessões').valor === '—' && /sem cliques/.test(por(r, 'Sessões').sub) && cart(r).length === 6);
}

console.log('== Revisão final: cartões ==');
{
  const uso = (o) => Object.assign({ sessoes: 12, semSessao: 0, cliquesPorSessao: 18, duracaoSeg: 360, ultimaEm: '2026-11-13T10:00:00Z', diasDesdeUltima: 0, suficiente: true }, o || {});
  const base = (o) => Object.assign({ c: { dias_sem_sinal: 1 }, estagioLabel: 'Em uso', assin: null, uso: uso(), chk: null, chkMsg: 'x', respostas: 0, respostasNovas: 0, agora: Date.parse('2026-11-13T12:00:00Z') }, o || {});
  const cart = (r) => r.blocos.reduce((a, b) => a.concat(b.cartoes), []);
  const por = (r, rot) => cart(r).filter((x) => x.rotulo === rot)[0];
  check('duração acima de 60 min mostra horas', por(FX.cartoesDe('plataforma', base({ uso: uso({ duracaoSeg: 5400 }) })), 'Duração (estimada)').valor === '1 h 30 min');
  check('"última há 0 dias" vira "última hoje"', por(FX.cartoesDe('plataforma', base()), 'Sessões').sub === 'última hoje');
  let r = FX.cartoesDe('plataforma', base({ uso: uso({ sessoes: 0, semSessao: 4, suficiente: false, cliquesPorSessao: null, duracaoSeg: null }) }));
  check('só cliques sem sessão: diz que houve uso e não afirma "sem cliques"', /sem sessão/.test(por(r, 'Sessões').sub) && !/nenhuma nos últimos/.test(por(r, 'Sessões').sub) && !/sem cliques para calcular/.test(por(r, 'Cliques por sessão').sub));
  r = FX.cartoesDe('plataforma', base({ uso: uso({ sessoes: 0, semSessao: 0, suficiente: false, cliquesPorSessao: null, duracaoSeg: null, diasDesdeUltima: 40 }) }));
  check('só cliques antigos: diz "nenhuma sessão nos últimos 30 dias", não "sem cliques"', /nenhuma/.test(por(r, 'Sessões').sub) && !/sem cliques para calcular/.test(por(r, 'Cliques por sessão').sub));
  const ass = (o) => Object.assign({ status: 'active', plano: 'P', criado_em: '2026-08-02T10:00:00Z', periodo_fim: '2026-12-02T10:00:00Z', cancela_no_fim: false }, o || {});
  r = FX.cartoesDe('assinante', base({ assin: ass({ status: 'trialing', teste_fim: '2026-11-20T00:00:00Z', cancela_no_fim: true }) }));
  check('teste que vai cancelar não diz que "vira cobrança"', !/vira cobrança/.test(por(r, 'Fim do teste').sub) && /cancela/.test(por(r, 'Fim do teste').sub));
  r = FX.cartoesDe('assinante', base({ assin: ass({ periodo_fim: '2026-11-02T10:00:00Z' }) }));
  check('data de cobrança já passada: avisa para conferir no Stripe, em alerta', /confira/.test(por(r, 'Próxima cobrança').sub) && por(r, 'Próxima cobrança').tom === 'alerta');
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
