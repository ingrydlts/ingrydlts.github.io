// Testa a tela "Montagem do espaço" da aba Dossiê (admin/crm/montagem.js e o que crm.js liga a ela), rodando o crm.js de verdade em Node
// com um navegador, um Worker e um Supabase de mentira. NÃO testa nada em navegador real (layout, clique de verdade, foco).
// Dados de teste inventados (o repositório é público).
//
// Uso: cd admin/crm/db/testes && node crm-montagem-ui.test.mjs
import * as MT from '../../montagem.js';
import { carregarCrm, pessoa } from './ficha-harness.mjs';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const PROP = () => ({
  bilan: { resumo: 'Ela quer estudar francês e decidir como falar com a escola.', afirmacoes: [
    { texto: 'Ligar para a escola em vez de escrever', quem: 'ingryd', momento: '20:05', trecho: 'tu peux les appeler', certeza: 'literal', vezes_dito: 3 },
    { texto: 'Escrever um e-mail para a escola', quem: 'incerto', momento: '31:40', trecho: 'on peut aussi écrire', certeza: 'inferido', vezes_dito: 1 }] },
  encaminhamentos: [
    { chave: 'ligar_escola', texto: 'Ligar para a escola', camada: 'particular', dono: 'ela', prazo: '2026-11-30', prazo_texto: '', origem: { momento: '20:05', trecho: 'tu peux les appeler' }, certeza: 'literal', cobre: [] },
    { chave: 'mandar_guia', texto: 'Enviar o guia de escolas', camada: 'entrega_equipe', dono: 'ingryd', prazo: null, prazo_texto: '', origem: { momento: '45:10', trecho: 'je t\'envoie' }, certeza: 'literal', cobre: [0] },
    { chave: 'abrir_conta', texto: 'Abrir a conta no banco', camada: 'persona', dono: 'ela', prazo: null, prazo_texto: '', origem: { momento: '', trecho: '' }, certeza: 'inferido', cobre: [] }],
  checklists: [{ chave: 'dossie_empresa', titulo: 'Dossiê para empresas', origem: 'particular', itens: [
    { chave: 'cv_fr', titulo: 'Montar o CV em francês', demarche: 'trabalho', subitens: ['Versão em francês', 'Revisar com a equipe'], prazo: '2026-12-05', fonte: null, nivel: null, a_conferir: true },
    { chave: 'carta', titulo: 'Escrever a carta de motivação', prazo: null, fonte: { rotulo: 'Guia', url: 'https://exemplo.org/guia' }, nivel: 'institucional', a_conferir: false }] }],
  documentos: [{ chave: 'diploma', rotulo: 'Diploma do ensino médio', selos: ['traducao'], checklists: ['dossie_empresa'], direcao: 'ela_envia', cobre: [] }],
  perguntas_equipe: [{ chave: 'fim_pvt', texto: 'Quando termina o seu PVT?', resposta_tipo: 'data', grava_em: 'respostas.fim_pvt' }],
  blocos: [{ tipo: 'empresa', titulo: 'Empresas para contactar', itens: [{ chave: 'acme', nome: 'Acme SAS', link: 'https://acme.example', canal: 'e-mail', nota: 'Pedir atestado' }] }],
  compromissos: [{ texto: 'Enviar o guia', momento: '45:10', trecho: 'je t\'envoie' }, { texto: 'Mandar o link da gravação', momento: '50:00', trecho: 'je te mande' }],
  omissoes: [{ chave: 'compromisso_2', texto: 'Conferir se foi entregue: Mandar o link da gravação', camada: 'entrega_equipe', dono: 'ingryd', origem: { momento: '50:00', trecho: 'je te mande' }, certeza: 'confirmar' }]
});
const CHAVES = ['enc:ligar_escola', 'enc:mandar_guia', 'enc:abrir_conta', 'enc:compromisso_2', 'lista:dossie_empresa', 'chk:dossie_empresa:cv_fr', 'chk:dossie_empresa:carta', 'doc:diploma', 'perg:fim_pvt', 'bloco:empresa:acme'];

console.log('== Os itens da proposta (as mesmas chaves que o banco usa) ==');
const itens = MT.itensDaProposta(PROP());
check('cada item da proposta tem a chave estável que crm_montagem_aplicar espera (mesmas do teste do banco)', JSON.stringify(itens.map((i) => i.k).sort()) === JSON.stringify(CHAVES.slice().sort()));
check('os itens vêm agrupados: gerais da persona, particulares do percurso, entregas da equipe, checklists, documentos, perguntas, contatos', ['Gerais da persona', 'Particulares do percurso', 'Entregas da equipe', 'Checklists', 'Documentos para reunir', 'Perguntas da equipe', 'Contatos para acionar'].every((g) => itens.some((i) => i.grupo === g)));
check('a pendência de compromisso não cumprido aparece à parte, com o trecho da conversa', itens.find((i) => i.k === 'enc:compromisso_2').grupo === 'Prometido na chamada e ainda sem item' && /je te mande/.test(itens.find((i) => i.k === 'enc:compromisso_2').trecho));
check('item sem fonte ou de certeza "confirmar" fica marcado a conferir; com fonte, não', itens.find((i) => i.k === 'chk:dossie_empresa:cv_fr').aConferir === true && itens.find((i) => i.k === 'chk:dossie_empresa:carta').aConferir === false && itens.find((i) => i.k === 'enc:compromisso_2').aConferir === true);
check('o momento e o trecho da conversa acompanham o item (para você conferir de onde veio)', itens.find((i) => i.k === 'enc:ligar_escola').momento === '20:05' && itens.find((i) => i.k === 'enc:ligar_escola').trecho === 'tu peux les appeler');
check('o singular e o plural dos itens da lista ficam certos (2 itens, 1 item)', itens.find((i) => i.k === 'lista:dossie_empresa').detalhe.startsWith('2 itens') && MT.itensDaProposta({ checklists: [{ chave: 'a', titulo: 'A', origem: 'modelo', itens: [{ chave: 'x', titulo: 'X' }] }] }).find((i) => i.k === 'lista:a').detalhe.startsWith('1 item '));
check('a fonte do item (rótulo, nível e o LINK) aparece na revisão: o link que a IA citou nunca fica escondido', /https:\/\/exemplo\.org\/guia/.test(itens.find((i) => i.k === 'chk:dossie_empresa:carta').detalhe) && /institucional/.test(itens.find((i) => i.k === 'chk:dossie_empresa:carta').detalhe));
check('o link do contato também aparece (a pessoa recebe "Abrir o site": você precisa ver para onde ele vai)', /https:\/\/acme\.example/.test(itens.find((i) => i.k === 'bloco:empresa:acme').detalhe));
check('proposta vazia ou estranha não quebra', MT.itensDaProposta({}).length === 0 && MT.itensDaProposta(null).length === 0);

console.log('\n== Démarche e subitens no item do checklist ==');
{
  const it = MT.itensDaProposta(PROP()).find((i) => i.k === 'chk:dossie_empresa:cv_fr');
  check('o item traz a démarche pelo rótulo do catálogo e os subitens', it.demarche === 'Trabalho' && it.subitens.length === 2);
  check('o detalhe segue o do Checklist real: démarche, subitens, de onde vem, prazo', /^Trabalho · 2 subitens · só deste percurso · prazo 05\/12 · em "Dossiê para empresas"/.test(it.detalhe));
  check('item sem démarche (proposta antiga) diz "Sem démarche" e não quebra', MT.itensDaProposta(PROP()).find((i) => i.k === 'chk:dossie_empresa:carta').detalhe.startsWith('Sem démarche · '));
  check('lista de modelo da persona diz "da persona"', MT.itensDaProposta({ checklists: [{ chave: 'a', titulo: 'A', origem: 'modelo', itens: [{ chave: 'x', titulo: 'X', demarche: 'banco', subitens: ['Um'] }] }] }).find((i) => i.k === 'chk:a:x').detalhe.startsWith('Banco · 1 subitem · da persona'));
  const h = MT.painelHtml({ cid: 'c1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: PROP() }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null }, pessoa(), esc);
  check('a tela mostra a pílula da démarche e os subitens do passo', h.includes('<span class="pill">Trabalho</span>') && h.includes('Versão em francês') && h.includes('mont-sub'));
  check('as démarches da tela são as do catálogo processos.json', JSON.stringify(Object.keys(MT.DEMARCHES).sort()) === JSON.stringify(Object.keys(JSON.parse(readFileSync(new URL('../../processos.json', import.meta.url), 'utf8')).definicoes).sort()));
}

console.log('\n== Itens repetidos que o Worker juntou ==');
{
  const prop = PROP(); prop.duplicados = [{ texto: 'Reunir diploma, passaporte e comprovante', motivo: 'ja_em_documentos', em: 'Diploma, Passaporte' }, { texto: 'Perguntar às escolas a carga', motivo: 'ja_no_checklist', em: 'Perguntar a carga' }];
  const mk = (p) => MT.painelHtml({ cid: 'c1', estado: 'proposta', erro: '', prop: { id: 1, versao: 1, proposta: p }, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true, diff: null, lib: null }, pessoa(), esc);
  const h = mk(prop);
  check('a tela avisa quantos repetidos foram juntados e quais', h.includes('Juntei 2 itens repetidos') && h.includes('já está em documentos') && h.includes('já está no checklist'));
  check('sem repetidos, nenhum aviso', !mk(PROP()).includes('Juntei'));
}

console.log('\n== O que ficou da conversa ==');
check('promessas que só um item cumpria e foi desmarcado são avisadas (a pendência não nasce sozinha)', JSON.stringify(MT.promessasAfetadas(PROP(), { 'enc:mandar_guia': false })) === JSON.stringify(['Enviar o guia']) && MT.promessasAfetadas(PROP(), {}).length === 0);

console.log('\n== O que vai para o banco ==');
let d = MT.decisoesDe(itens, {}, {});
check('tudo marcado por padrão: uma decisão "aprovar" por item', d.length === 10 && d.every((x) => x.decisao === 'aprovar'));
d = MT.decisoesDe(itens, { 'enc:mandar_guia': false }, { 'enc:mandar_guia': 'excecao' });
check('desmarcar vira "rejeitar" com o motivo', d.find((x) => x.origem_chave === 'enc:mandar_guia').decisao === 'rejeitar' && d.find((x) => x.origem_chave === 'enc:mandar_guia').motivo === 'excecao');
d = MT.decisoesDe(itens, { 'lista:dossie_empresa': false }, {});
check('item de uma lista desmarcada na lista mas marcado no item: a lista entra junto (senão o banco recusa)', d.find((x) => x.origem_chave === 'lista:dossie_empresa').decisao === 'aprovar');
d = MT.decisoesDe(itens, { 'lista:dossie_empresa': false, 'chk:dossie_empresa:cv_fr': false, 'chk:dossie_empresa:carta': false }, {});
check('lista e todos os itens dela desmarcados: a lista fica rejeitada', d.find((x) => x.origem_chave === 'lista:dossie_empresa').decisao === 'rejeitar');
check('motivo desconhecido é descartado (o banco só aceita a lista fechada)', MT.decisoesDe(itens, { 'enc:mandar_guia': false }, { 'enc:mandar_guia': 'porque_sim' }).find((x) => x.origem_chave === 'enc:mandar_guia').motivo === undefined);

console.log('\n== O painel ==');
const pubOk = { ha_rascunho_aprovado: true, itens_prontos: 6, itens_proposta: 2, itens_a_conferir: 1, conta_ja_existe: false, tem_assinatura: false, a_conferir_itens: [{ id: 41, titulo: 'Montar o CV em francês' }] };
const base = { cid: 'c1', estado: 'vazio', erro: '', prop: null, sel: {}, motivos: {}, res: null, pub: null, previa: null, pode: false, forcar: false, msg: '', temTranscricao: true };
const c = pessoa();
let h = MT.painelHtml(base, c, esc);
check('vazio: botão de propor a montagem e a explicação de que nada chega a ela sem aprovação', /data-montler="c1"/.test(h) && !/data-montler="c1"[^>]*disabled/.test(h) && /nada chega/i.test(h));
check('vazio sem transcrição: o botão fica desligado e diz o que fazer', /data-montler="c1"[^>]*disabled/.test(MT.painelHtml({ ...base, temTranscricao: false }, c, esc)) && /Vincule uma conversa/.test(MT.painelHtml({ ...base, temTranscricao: false }, c, esc)));
h = MT.painelHtml({ ...base, estado: 'lendo' }, c, esc);
check('lendo: mostra o estado de carregamento (sem texto solto) e não oferece reler', /role="status"/.test(h) && /mont-skel/.test(h) && !/data-montler/.test(h));
h = MT.painelHtml({ ...base, erro: 'A IA está ocupada agora.' }, c, esc);
check('erro: mostra a mensagem e o botão "Tentar de novo"', /role="alert"/.test(h) && /A IA está ocupada/.test(h) && /Tentar de novo/.test(h));
const comProp = { ...base, estado: 'proposta', prop: { id: 5, versao: 2, proposta: PROP() }, sel: {}, motivos: {} };
h = MT.painelHtml(comProp, c, esc);
check('proposta: um checkbox por item, marcados, com o trecho e o momento da conversa', (h.match(/data-montmarca=/g) || []).length === 10 && !/data-montmarca="[^"]*"[^>]*>/.test('') && /20:05/.test(h) && /tu peux les appeler/.test(h) && (h.match(/data-montmarca="[^"]*" checked/g) || []).length === 10);
check('item a conferir tem o rótulo escrito "a conferir" (não só cor) e a explicação de que não vai para ela', /a conferir/.test(h) && /não vai para ela/.test(h));
check('desmarcado mostra o seletor de motivo; marcado não', /data-montmotivo="enc:mandar_guia"/.test(MT.painelHtml({ ...comProp, sel: { 'enc:mandar_guia': false } }, c, esc)) && !/data-montmotivo/.test(h));
check('botões: criar rascunhos (com a contagem) e descartar', /data-montaplicar="c1"/.test(h) && /10/.test(h.match(/data-montaplicar[^<]*</)[0]) && /data-montdescartar="c1"/.test(h));
check('o bilan aparece: resumo e cada afirmação com quem disse, o momento, o trecho, a certeza e quantas vezes foi dita', /decidir como falar com a escola/.test(h) && /dito 3 vezes/.test(h) && /31:40/.test(h) && /incerto/.test(h) && /on peut aussi écrire/.test(h) && /inferido/.test(h));
check('as DUAS posições da conversa (ligar × escrever) aparecem lado a lado', /Ligar para a escola em vez de escrever/.test(h) && /Escrever um e-mail para a escola/.test(h));
check('os compromissos da chamada aparecem; o que nenhum item cobre vem escrito "sem item"', /Mandar o link da gravação/.test(h) && /sem item/.test(h) && /coberto/.test(h));
check('desmarcar o item que cumpre uma promessa mostra o aviso com a promessa', /cumpre uma promessa da chamada/.test(MT.painelHtml({ ...comProp, sel: { 'enc:mandar_guia': false } }, c, esc)) && /Enviar o guia/.test(MT.painelHtml({ ...comProp, sel: { 'enc:mandar_guia': false } }, c, esc)));
check('a comparação com a leitura anterior mostra o que sai (sugestão: nada é apagado) e o que já foi tratado', /Saiu da proposta nova/.test(MT.painelHtml({ ...comProp, diff: { novos: [], mantidos: [], conflitos: ['doc:diploma'], retirar_sugerido: ['bloco:escola:alliance'] } }, c, esc)) && /bloco:escola:alliance/.test(MT.painelHtml({ ...comProp, diff: { novos: [], mantidos: [], conflitos: ['doc:diploma'], retirar_sugerido: ['bloco:escola:alliance'] } }, c, esc)) && /não é apagado/.test(MT.painelHtml({ ...comProp, diff: { novos: [], mantidos: [], conflitos: [], retirar_sugerido: ['x'] } }, c, esc)));
check('versão da leitura aparece (v2)', /versão 2/.test(h) || /v2/.test(h));
h = MT.painelHtml({ ...comProp, prop: { id: 5, versao: 1, proposta: { ...PROP(), encaminhamentos: [{ ...PROP().encaminhamentos[0], texto: '<img src=x onerror=alert(1)>' }] } } }, c, esc);
check('texto vindo da IA é escapado (nada de HTML solto na tela)', !/<img src=x/.test(h) && /&lt;img src=x/.test(h));
h = MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, atualizados: 1, mantidos: 0, rejeitados: 1, conflitos: ['doc:diploma'] } }, c, esc);
h = MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, atualizados: 0, mantidos: 0, rejeitados: 0, conflitos: [] }, pub: pubOk }, c, esc);
check('aplicado: botão "Liberar para ela" (a sua aprovação) e os itens a conferir, cada um com "Conferi a fonte"', /data-montliberar="c1"/.test(h) && /Liberar para ela/.test(h) && /data-montconferido="41"/.test(h) && /Conferi a fonte/.test(h) && /Montar o CV em francês/.test(h));
check('depois de liberar: diz quantos foram liberados, que os a conferir ficaram de fora e quando ela vê', /3 liberados/.test(MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, conflitos: [] }, lib: { liberados: 3, a_conferir_pulados: 1, publicados_agora: false } }, c, esc)) && /quando aceitar/.test(MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, conflitos: [] }, lib: { liberados: 3, a_conferir_pulados: 1, publicados_agora: false } }, c, esc)) && /já estão no espaço dela/.test(MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, conflitos: [] }, lib: { liberados: 3, a_conferir_pulados: 0, publicados_agora: true } }, c, esc)));
h = MT.painelHtml({ ...base, estado: 'aplicado', res: { criados: 8, atualizados: 1, mantidos: 0, rejeitados: 1, conflitos: ['doc:diploma'] } }, c, esc);
check('aplicado: resumo (criados, atualizados, rejeitados) e os conflitos explicados', /8 criados/.test(h) && /1 atualizado/.test(h) && /1 rejeitado/.test(h) && /doc:diploma/.test(h) && /já revisou ou ela já fez/.test(h));

console.log('\n== O acesso dela (convite e aviso) ==');
h = MT.painelHtml({ ...base, pub: pubOk }, c, esc);
check('mostra quantos itens ela veria e quantos ficam de fora por falta de fonte', /6 itens prontos/.test(h) && /1 a conferir/.test(h));
check('sem conta: oferece o convite (teste de 7 dias); com a prévia, e só habilita "Enviar" depois da prévia e do "pode enviar"', /data-montprevia="convite"/.test(h) && /7 dias/.test(h) && /data-montenviar="convite"[^>]*disabled/.test(h));
const prev = { tipo: 'convite', assunto: 'Ana, o seu espaço está pronto', texto: 'Oi Ana!\n\nhttps://x/entrar/?t=abc', para: 'ana@example.com' };
h = MT.painelHtml({ ...base, pub: pubOk, previa: prev }, c, esc);
check('a prévia mostra para quem vai, o assunto e o texto', /ana@example\.com/.test(h) && /o seu espaço está pronto/.test(h) && /Oi Ana!/.test(h) && /data-montenviar="convite"[^>]*disabled/.test(h));
h = MT.painelHtml({ ...base, pub: pubOk, previa: prev, pode: true }, c, esc);
check('com a prévia e o "pode enviar" marcado, o envio liga', /data-montpode[^>]*checked/.test(h) && !/data-montenviar="convite"[^>]*disabled/.test(h));
h = MT.painelHtml({ ...base, pub: { ...pubOk, ha_rascunho_aprovado: false, itens_prontos: 0 }, previa: prev, pode: true }, c, esc);
check('sem nada revisado: avisa que o espaço dela estaria vazio e só envia se você marcar "enviar assim mesmo"', /espaço dela estaria vazio/.test(h) && /data-montforcar/.test(h) && /data-montenviar="convite"[^>]*disabled/.test(h) && !/data-montenviar="convite"[^>]*disabled/.test(MT.painelHtml({ ...base, pub: { ...pubOk, ha_rascunho_aprovado: false }, previa: prev, pode: true, forcar: true }, c, esc)));
h = MT.painelHtml({ ...base, pub: { ...pubOk, conta_ja_existe: true, tem_assinatura: true } }, c, esc);
check('quem já tem conta e acesso: o caminho é avisar que o espaço mudou (e-mail com o seu "pode enviar"), não um novo convite', /data-montprevia="espaco"/.test(h) && /Ela já tem conta/.test(h) && !/data-montprevia="convite"/.test(h));
h = MT.painelHtml({ ...base, pub: { ...pubOk, conta_ja_existe: true, tem_assinatura: false } }, c, esc);
check('conta sem teste nem plano (veio do funil): oferece o CONVITE (abre o teste de 7 dias), com a explicação', /data-montprevia="convite"/.test(h) && /ainda não tem teste/.test(h) && !/data-montprevia="espaco"/.test(h));
check('mensagem de resultado aparece com role=status', /role="status"[^>]*><b>Convite enviado/.test(MT.painelHtml({ ...base, pub: pubOk, msg: 'Convite enviado.' }, c, esc)));

console.log('\n== crm.js: ler, aplicar, convite ==');
const rpcResp = {
  crm_montagem_aplicar: { data: { criados: 9, atualizados: 0, mantidos: 0, rejeitados: 1, conflitos: [] }, error: null },
  crm_montagem_publicavel: { data: pubOk, error: null },
  crm_montagem_descartar: { data: null, error: null },
  crm_montagem_diff: { data: { novos: [], mantidos: [], conflitos: ['doc:diploma'], retirar_sugerido: ['bloco:escola:alliance'] }, error: null },
  crm_montagem_liberar: { data: { liberados: 4, a_conferir_pulados: 1, publicados_agora: false }, error: null },
  crm_acao_conferida: { data: null, error: null }
};
const chamadas = [];
let respostaWorker = (url) => ({ ok: true, status: 200, json: async () => ({ ok: true, id: 5, versao: 1, proposta: PROP() }) });
const fetch = async (url, opt) => { chamadas.push({ url: String(url), opt }); return respostaWorker(String(url), opt); };
const { mod, rpcs } = await carregarCrm({ sessao: { access_token: 'tok-admin' }, fetch, rpcResp, expor: ['montLiberar', 'montConferido', 'montEstado', 'montLer', 'montMarca', 'montAplicar', 'montDescartar', 'montPub', 'montPrevia', 'montEnviar', 'montHtml'] });
mod.setC([pessoa({ id: 'c1' })]);
mod.state.sel = 'c1'; mod.state.dos = { cid: 'c1', d: {}, rasc: { ligacao_transcricao: 'Ela contou que o PVT termina em fevereiro. '.repeat(10), ligacao_resumo: 'Resumo da call.' } };
check('crm.js expõe o painel (montHtml) dentro de um #mont-box', typeof mod.montHtml === 'function' && /id="mont-box"/.test(mod.montHtml(pessoa({ id: 'c1' }))) && /data-montler="c1"/.test(mod.montHtml(pessoa({ id: 'c1' }))));
await mod.montLer('c1', { disabled: false });
const lido = chamadas.find((x) => /\/api\/crm\/montagem\/ler$/.test(x.url));
check('ler: chama o Worker com o token de quem está logada, o contato e a transcrição do Dossiê (o mesmo texto do Pós-call)', lido && lido.opt.method === 'POST' && lido.opt.headers.Authorization === 'Bearer tok-admin' && JSON.parse(lido.opt.body).contato_id === 'c1' && /PVT termina/.test(JSON.parse(lido.opt.body).transcricao) && JSON.parse(lido.opt.body).notas === 'Resumo da call.');
check('ao ler, compara com o que já existe (crm_montagem_diff) para sugerir o que retirar', rpcs.some((r) => r.n === 'crm_montagem_diff' && r.a.p_montagem === 5) && mod.montEstado('c1').diff.retirar_sugerido[0] === 'bloco:escola:alliance');
check('depois de ler: estado "proposta", com a proposta guardada e nada aplicado ainda', mod.montEstado('c1').estado === 'proposta' && mod.montEstado('c1').prop.id === 5 && !rpcs.some((r) => r.n === 'crm_montagem_aplicar'));
mod.montMarca('c1', 'enc:mandar_guia', false);
mod.montMarca('c1', 'enc:mandar_guia', false, 'excecao');
await mod.montAplicar('c1', { disabled: false });
const ap = rpcs.find((r) => r.n === 'crm_montagem_aplicar');
check('aplicar: manda ao banco o contato, a montagem e as decisões (o item desmarcado vai como rejeitado, com o motivo)', ap && ap.a.p_contato === 'c1' && ap.a.p_montagem === 5 && ap.a.p_decisoes.length === 10 && ap.a.p_decisoes.find((x) => x.origem_chave === 'enc:mandar_guia').decisao === 'rejeitar' && ap.a.p_decisoes.find((x) => x.origem_chave === 'enc:mandar_guia').motivo === 'excecao');
check('depois de aplicar: estado "aplicado", resumo guardado e a situação do acesso é consultada', mod.montEstado('c1').estado === 'aplicado' && mod.montEstado('c1').res.criados === 9 && rpcs.some((r) => r.n === 'crm_montagem_publicavel') && mod.montEstado('c1').pub.itens_prontos === 6);

await mod.montLiberar('c1', { disabled: false });
check('liberar: chama crm_montagem_liberar com o contato e a montagem, guarda o resultado e atualiza a situação do acesso', rpcs.some((r) => r.n === 'crm_montagem_liberar' && r.a.p_contato === 'c1' && r.a.p_montagem === 5) && mod.montEstado('c1').lib.liberados === 4 && rpcs.filter((r) => r.n === 'crm_montagem_publicavel').length >= 2);
await mod.montConferido('c1', 41);
check('"Conferi a fonte": chama crm_acao_conferida com o id do passo e atualiza a lista', rpcs.some((r) => r.n === 'crm_acao_conferida' && r.a.p_id === 41));

chamadas.length = 0;
respostaWorker = () => ({ ok: true, status: 200, json: async () => ({ ok: true, enviado: false, para: 'ana@example.com', assunto: 'Ana, o seu espaço está pronto', texto: 'Oi Ana! https://x/entrar/?t=abc' }) });
await mod.montPrevia('c1', 'convite');
const pv = chamadas.find((x) => /\/api\/crm\/convite$/.test(x.url));
check('prévia do convite: chama o Worker SEM "enviar" e guarda a prévia', pv && JSON.parse(pv.opt.body).enviar !== true && JSON.parse(pv.opt.body).contato_id === 'c1' && mod.montEstado('c1').previa.assunto.includes('espaço está pronto'));
chamadas.length = 0;
await mod.montEnviar('c1', 'convite');
check('enviar sem marcar o "pode enviar": nada é enviado', chamadas.length === 0);
mod.montEstado('c1').pode = true;
respostaWorker = () => ({ ok: true, status: 200, json: async () => ({ ok: true, enviado: true }) });
await mod.montEnviar('c1', 'convite');
const en = chamadas.find((x) => /\/api\/crm\/convite$/.test(x.url));
check('enviar com o "pode enviar": chama o Worker com enviar e confirmo, e mostra que saiu', en && JSON.parse(en.opt.body).enviar === true && JSON.parse(en.opt.body).confirmo === true && !JSON.parse(en.opt.body).forcar && /enviado/i.test(mod.montEstado('c1').msg) && mod.montEstado('c1').pode === false);
mod.montEstado('c1').previa = { tipo: 'convite', assunto: 'x', texto: 'y', para: 'ana@example.com' }; mod.montEstado('c1').pode = true;
respostaWorker = () => ({ ok: false, status: 409, json: async () => ({ error: 'Ainda não há nada revisado para ela ver.', codigo: 'sem_rascunho_aprovado' }) });
await mod.montEnviar('c1', 'convite');
check('o Worker recusa (sem espaço pronto): mostra o motivo e NÃO marca como enviado', /nada revisado/.test(mod.montEstado('c1').erro) && !/enviado/i.test(mod.montEstado('c1').msg));
mod.montEstado('c1').previa = { tipo: 'espaco', assunto: 'x', texto: 'y', para: 'ana@example.com' }; mod.montEstado('c1').pode = true; chamadas.length = 0;
respostaWorker = () => ({ ok: true, status: 200, json: async () => ({ ok: true, enviado: true }) });
await mod.montEnviar('c1', 'espaco');
check('aviso de espaço atualizado usa a rota própria', chamadas.some((x) => /\/api\/crm\/espaco-atualizado$/.test(x.url)));
respostaWorker = () => ({ ok: false, status: 502, json: async () => ({ error: 'A IA está ocupada agora.' }) });
await mod.montLer('c1', { disabled: false });
check('erro do Worker na leitura: volta ao estado inicial com a mensagem e deixa tentar de novo', /ocupada/.test(mod.montEstado('c1').erro) && mod.montEstado('c1').estado !== 'lendo');
await mod.montDescartar('c1', { disabled: false });
check('descartar a proposta chama o banco (nada é apagado) e limpa a tela', rpcs.some((r) => r.n === 'crm_montagem_descartar') && mod.montEstado('c1').prop === null);

console.log('\n== O tema escuro: nenhuma cor fixa na tela de montagem ==');
import { readFileSync } from 'node:fs';
import { fileURLToPath as _f } from 'node:url';
import _p from 'node:path';
const css = readFileSync(_p.resolve(_p.dirname(_f(import.meta.url)), '../../crm.css'), 'utf8');
const regras = css.split('\n').filter((l) => /^\s*(\.montagem|@keyframes mont-)/.test(l) || /\.montagem/.test(l));
check('as regras de .montagem usam as variáveis do tema (nada de #hex): uma cor fixa clara com texto claro apaga o texto no tema escuro', regras.length > 5 && regras.every((l) => !/#[0-9a-fA-F]{3,8}\b/.test(l)));

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
