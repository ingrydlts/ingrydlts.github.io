// Os textos de todos os modelos de e-mail do CRM, em blocos, prontos para revisão no Estúdio de e-mails.
// Gera crm-modelos-prontos.sql (rode: node admin/crm/db/modelos-prontos.mjs). O SQL só cria rascunhos:
// quem revisa, testa e publica é você, pelo estúdio.
//
// - Os 9 modelos de antes (os 8 manuais e o e-mail 1 do guia) ganham uma versão nova em rascunho com os blocos de partida
//   do estúdio (ES.iniciais): o mesmo texto de hoje, agora com desenho. O e-mail 2 já está No ar em blocos.
// - Os modelos novos entram como se tivessem sido criados pelo "+ Modelo novo" (criado_no_estudio, objetivo, Para quem),
//   com o Envio desligado.
// O assunto, a prévia, o texto puro e o HTML de cada versão saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '19/10/2026';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };
const oi = (resto) => ({ tipo: 'texto', texto: 'Oi {nome}! ' + resto, alt: 'Oi! ' + resto });
const responda = (pergunta, ajuda) => ({ tipo: 'pergunta', texto: pergunta, ajuda: ajuda || 'É só responder este e-mail. Eu leio cada resposta.' });
const GUIA = 'Guia do Candidato 2027-2028';

// ---------- 1. Os modelos de antes: o texto de hoje, em blocos ----------
// tipo = modelos_email.tipo de cada um (decide o rodapé).
export const DE_ANTES = [
  ['boas_vindas', 'servico'], ['naoabriu', 'servico'], ['naoclicou', 'novidades'], ['cliquenaoapp', 'servico'],
  ['parouapp', 'novidades'], ['guia_chamada', 'novidades'], ['guia_plataforma', 'novidades'], ['guia_alternancia', 'novidades'],
  ['cf_guia_1', 'servico']
];

// ---------- 2. Os modelos novos ----------
const HUB = { produto: 'hub-de-estudos', produto_nome: 'Hub de Estudos' };
const CF = { materiais: ['guia-etudes-en-france-2027'] };
const RODAPE_CF = 'pediu o checklist Études en France no Por Dentro com {email}';

// O aquecimento da fase 1c: 4 e-mails por trilha. A = começo (não comecei, escolhendo o curso), B = dossiê (documentos,
// traduções e teste), C = depois do envio (já enviei, entrevista ou resposta). D+3 sai 2 dias depois do e-mail 2 (D+1);
// cada um dos outros sai depois do anterior da mesma trilha.
const TRILHAS = { a: 'trilha A · começo', b: 'trilha B · dossiê', c: 'trilha C · depois do envio' };
const PERGUNTA_ASTUCIA = responda('Isso já tinha passado pela sua cabeça?');
const PERGUNTA_DUVIDA = responda('Quer que eu responda a sua dúvida?', 'Me conte em uma frase o que está travando. É só responder este e-mail.');
const BASTIDOR_GUIA = { tipo: 'texto', estilo: 'discreto', linha: true, texto: 'Um bastidor: cada dica destes e-mails sai do ' + GUIA + ' do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide.' };

const D3 = {
  a: { assunto: '{nome}, o prazo que não está no calendário', assunto_alt: 'O prazo que não está no calendário', pre: 'Alguns cursos fecham antes da data geral.', itens: [
    { tipo: 'titulo', texto: 'O prazo que vale é o menor' },
    oi('Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'Anote o prazo de cada curso', nota: 'Entre o prazo do curso e o do calendário, vale sempre o menor (' + GUIA + ', p. 3).' },
    { tipo: 'texto', texto: 'Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.', alt: 'Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda.' },
    PERGUNTA_ASTUCIA, ASS] },
  b: { assunto: '{nome}, o documento que ainda não existe', assunto_alt: 'O documento que ainda não existe', pre: 'Ele não precisa travar o seu dossiê.', itens: [
    { tipo: 'titulo', texto: 'Documento que ainda não existe entra provisório' },
    oi('Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'Envie o provisório', nota: 'O guia prevê documento provisório para o que ainda não foi emitido (' + GUIA + ', p. 6). Você completa depois, sem perder o prazo.' },
    { tipo: 'texto', texto: 'Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo.' },
    PERGUNTA_ASTUCIA, ASS] },
  c: { assunto: '{nome}, o passo que destrava a verificação', assunto_alt: 'O passo que destrava a verificação', pre: 'Sem ele, o seu dossiê fica parado.', itens: [
    { tipo: 'titulo', texto: 'A verificação só começa depois do Pix declarado' },
    oi('Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'Declare o pagamento', nota: 'A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (' + GUIA + ', p. 5).' },
    { tipo: 'texto', texto: 'Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia.' },
    PERGUNTA_ASTUCIA, ASS] }
};
// D+6, a sua história: o mesmo texto nas três trilhas (do carrossel "Oi, eu sou a Ingryd").
const D6 = { assunto: '{nome}, eu cheguei na França sem manual', assunto_alt: 'Eu cheguei na França sem manual', pre: 'Por que eu entendo de burocracia francesa.', itens: [
  { tipo: 'apresentacao', titulo: 'Oi, eu sou a Ingryd', texto: 'Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.' },
  { tipo: 'texto', texto: '{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.', alt: 'Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.' },
  { tipo: 'texto', texto: 'Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.' },
  { tipo: 'texto', texto: 'A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.' },
  { tipo: 'texto', texto: 'O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.' },
  responda('Qual parte te tira o sono?', 'Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.'),
  ASS] };
const D10 = {
  a: { assunto: '{nome}, quando o curso aparece como "Encerrado"', assunto_alt: 'Quando o curso aparece como "Encerrado"', pre: 'Nem sempre é o fim da linha.', itens: [
    { tipo: 'titulo', texto: 'Curso "Encerrado" nem sempre é um não' },
    oi('Na hora de escolher os cursos na plataforma, alguns aparecem como "Encerrado" ou com "Ponto de entrada inativo". A reação natural é riscar o curso da lista.'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'Escreva para a universidade', nota: 'Nesses casos, o guia orienta a falar com a própria universidade (' + GUIA + ', p. 6). Pergunte se a formação vai abrir para candidatura e até quando.' },
    BASTIDOR_GUIA, PERGUNTA_DUVIDA, ASS] },
  b: { assunto: '{nome}, o teste de francês e o prazo do dossiê', assunto_alt: 'O teste de francês e o prazo do dossiê', pre: 'A inscrição pode bastar, se a prova for até fevereiro.', itens: [
    { tipo: 'titulo', texto: 'Você não precisa esperar o resultado do teste' },
    oi('Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'A inscrição vale', nota: 'Se a sua prova for até fevereiro, o comprovante de inscrição entra no lugar do resultado. O resultado precisa chegar ao Campus France até 05/03/2027 (' + GUIA + ', p. 13).' },
    { tipo: 'texto', texto: 'E se a sua formação for em inglês, os documentos podem ser traduzidos para o inglês (' + GUIA + ', p. 6). Confira na página do curso antes de pagar a tradução.' },
    BASTIDOR_GUIA, PERGUNTA_DUVIDA, ASS] },
  c: { assunto: '{nome}, a alternância e a entrevista', assunto_alt: 'A alternância e a entrevista', pre: 'Duas coisas para a fase depois do envio.', itens: [
    { tipo: 'titulo', texto: 'Se você quer alternância, ela precisa estar na carta' },
    oi('Para quem já enviou o dossiê, duas coisas fazem diferença agora.'),
    { tipo: 'destaque', rotulo: 'A astúcia', valor: 'Alternância na carta', nota: 'Se o seu plano é estudar em alternância, isso precisa aparecer na sua carta de motivação (' + GUIA + ', p. 6).' },
    { tipo: 'texto', texto: 'A entrevista é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Separei um roteiro para você treinar: [link do presente CF09]' },
    { tipo: 'texto', estilo: 'discreto', linha: true, texto: 'Um bastidor: eu faço um mestrado em alternância numa Grande École, então sei de perto o quanto a escola e o contrato precisam conversar desde o começo.' },
    PERGUNTA_DUVIDA, ASS] }
};
// D+15, o que as pessoas responderam: o mesmo nas três trilhas. Os trechos entre colchetes só existem depois das respostas.
const D15 = { assunto: '{nome}, o que as pessoas me responderam', assunto_alt: 'O que as pessoas me responderam', pre: 'As dúvidas que mais chegaram, sem nomes.', itens: [
  { tipo: 'titulo', texto: 'O que mais chegou nas respostas' },
  oi('Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.'),
  { tipo: 'texto', texto: '**[a dúvida 1]**\n[o que você respondeu]' },
  { tipo: 'texto', texto: '**[a dúvida 2]**\n[o que você respondeu]' },
  { tipo: 'texto', texto: '**[a dúvida 3]**\n[o que você respondeu]' },
  { tipo: 'texto', estilo: 'discreto', texto: 'Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.' },
  ASS] };

function aquecimento() {
  const r = [];
  Object.keys(TRILHAS).forEach((t, ti) => {
    const passos = [['d3', 'D+3 · astúcia 1', D3[t], 'cf_guia_conversa', 2], ['d6', 'D+6 · sua história', D6, 'aq_' + t + '_d3', 3],
      ['d10', 'D+10 · astúcia 2 e bastidor', D10[t], 'aq_' + t + '_d6', 4], ['d15', 'D+15 · o que responderam', D15, 'aq_' + t + '_d10', 5]];
    passos.forEach(([dk, rotulo, d, depois, dias], pi) => r.push({ chave: 'aq_' + t + '_' + dk, nome: 'Aquecimento · ' + TRILHAS[t] + ' · ' + rotulo,
      obj: 'aquecimento', para: CF, envio: { gatilho: 'email', depois_de: depois, dias, hora: 10 }, ordem: 600 + ti * 10 + pi,
      d: Object.assign({ rodape: RODAPE_CF }, d) }));
  });
  return r;
}

export const NOVOS = [
  { chave: 'hub_estudos_compra', nome: 'Hub de Estudos · compra confirmada', obj: 'compra', para: HUB, ordem: 510,
    envio: { gatilho: 'compra', depois_de: 'hub-de-estudos', dias: 0, hora: 10 },
    d: { assunto: '{nome}, o seu {produto} chegou', assunto_alt: 'O seu {produto} chegou', pre: 'O link para guardar e os seus primeiros passos.',
      rodape: 'comprou o {produto} no Por Dentro', itens: [
        { tipo: 'titulo', texto: '{nome}, a sua compra está confirmada', alt: 'A sua compra está confirmada' },
        { tipo: 'texto', texto: 'O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.' },
        { tipo: 'botao', rotulo: 'Abrir o {produto} no Notion', link: 'link_produto' },
        { tipo: 'destaque', rotulo: 'Seus primeiros passos', valor: '**1.** Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.\n**2.** Cadastre as suas matérias e a grade de horários da semana.\n**3.** Lance o primeiro prazo que você tem e abra a visão Hoje.' },
        DUVIDA, ASS] } },
  { chave: 'hub_estudos_d3', nome: 'Hub de Estudos · primeiros passos (D+3)', obj: 'compra', para: HUB, ordem: 511,
    envio: { gatilho: 'email', depois_de: 'hub_estudos_compra', dias: 3, hora: 10 },
    d: { assunto: '{nome}, como está o seu {produto}?', assunto_alt: 'Como está o seu {produto}?', pre: 'As cinco visões e qual abrir primeiro.',
      rodape: 'comprou o {produto} no Por Dentro', itens: [
        { tipo: 'titulo', texto: 'Uma aba só para saber o que fazer primeiro' },
        oi('Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.'),
        { tipo: 'destaque', rotulo: 'As cinco visões', valor: '**Hoje** · o que vence hoje\n**Em atraso** · o que passou do prazo\n**Deadline próxima** · o que vence nos próximos dias\n**Timeline** · o semestre inteiro numa linha\n**Essa semana** · a sua semana, matéria por matéria', nota: 'Se for abrir uma só, abra a Hoje, todo dia de manhã.' },
        { tipo: 'texto', texto: 'Ainda não duplicou? O link continua aqui:' },
        { tipo: 'botao', rotulo: 'Abrir o {produto} no Notion', link: 'link_produto' },
        responda('O que mais te atrapalha para estudar hoje?', 'Me conte em uma frase. É só responder este e-mail.'), ASS] } },
  { chave: 'hub_estudos_lancamento', nome: 'Lançamento · Hub de Estudos', obj: 'lancamento', para: {}, ordem: 520,
    d: { assunto: '{nome}, a matéria num app, o prazo em outro?', assunto_alt: 'A matéria num app, o prazo em outro?', pre: 'O Hub de Estudos junta tudo no Notion.', itens: [
      { tipo: 'titulo', texto: 'Matérias, cronograma e prazos numa aba só' },
      oi('Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.'),
      { tipo: 'destaque', rotulo: 'O que tem no Hub de Estudos', valor: 'Matérias, cronograma de aulas e a grade de horários da semana\nProjetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana', nota: 'Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular.' },
      { tipo: 'texto', texto: 'Foi pensado para quem faz um master, mas serve para qualquer curso: é só adaptar as matérias. Para conhecer: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos' },
      { tipo: 'texto', estilo: 'discreto', texto: 'Ficou com alguma dúvida antes de comprar? É só responder este e-mail.' }, ASS] } },
  { chave: 'lembrete_prazo_vlsts', nome: 'Lembrete de prazo · VLS-TS', obj: 'lembrete', para: {}, ordem: 530,
    d: { assunto: '{nome}, o seu prazo do VLS-TS está chegando', assunto_alt: 'O seu prazo do VLS-TS está chegando', pre: 'O aviso que você pediu.', itens: [
      oi('Você pediu para eu te avisar do prazo para validar o seu VLS-TS.'),
      { tipo: 'destaque', se: '#prazo_a_vencer', rotulo: 'O seu prazo', valor: '{prazo_limite}', nota: 'Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF.' },
      { tipo: 'destaque', se: '#prazo_vencido', rotulo: 'O seu prazo venceu em', valor: '{prazo_limite}', nota: 'Se você ainda não validou, vale agir logo.' },
      { tipo: 'texto', texto: 'Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida.' },
      { tipo: 'botao', rotulo: 'Escolher um horário', link: 'link_agenda', complemento: '&utm_source=email&utm_campaign=lembrete-prazo' },
      ASS] } }
].concat(aquecimento());

// ---------- 3. Montar e escrever o SQL ----------
const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';

// Igual a paraResumo (crm.js): o "quem recebe" que a tela mostra.
function paraResumo(tipo, p) {
  const r = [];
  if (p.produto) r.push('comprou ' + p.produto_nome);
  if ((p.materiais || []).length) r.push('pegou ' + p.materiais.map((k) => k === 'guia-etudes-en-france-2027' ? 'Guia Campus France' : k).join(' ou '));
  if (tipo === 'novidades') r.push('aceitou novidades');
  return r.length ? r.join(' · ') : 'Todos';
}
// Igual a criarModelo (crm.js): a lista de dados que a tela mostra.
function variaveis(chave, m) {
  return ES.varsDoModelo(chave, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
}
function completo(d) { d = JSON.parse(JSON.stringify(d)); d.v = 1; d.planos = d.planos || {}; return d; }

export function gerar() {
  const out = [];
  out.push(`-- Por Dentro — Estúdio de e-mails: todos os modelos prontos para revisão (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-prontos.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos. Não publica nada, não mexe em nenhuma versão No ar e não liga nenhum Envio:
--   1. Os 8 modelos manuais e o e-mail 1 do guia Campus France (cf_guia_1) ganham uma versão nova em RASCUNHO com o
--      texto de hoje em blocos (com o desenho do Por Dentro). Se o modelo já tem uma versão com esses mesmos blocos
--      (por exemplo, a que o estúdio cria quando você clica em "Editar em versão nova"), nada é criado.
--      O e-mail 2 (cf_guia_conversa) já está No ar em blocos: fica como está.
--   2. Modelos novos, como se criados pelo "+ Modelo novo" (criado_no_estudio = true), cada um com a versão 1 em RASCUNHO
--      e o Envio DESLIGADO (o gatilho, os dias e a hora já vêm preenchidos; você liga depois de publicar):
--        Hub de Estudos · compra confirmada e primeiros passos (D+3)  (tipo compra, sequência depois da compra)
--        Lançamento · Hub de Estudos                                   (novidades, você envia pela ficha)
--        Lembrete de prazo · VLS-TS                                    (serviço, você envia pela ficha)
--        Aquecimento Campus France: 3 trilhas × D+3, D+6, D+10, D+15   (novidades, sequência depois do e-mail 2)
--      Um modelo novo que já existe com a mesma chave não é tocado.
--
-- O que ainda falta antes de publicar (o estúdio não deixa publicar um automático com [trecho entre colchetes]):
--   - aq_c_d10: o [link do presente CF09] (o presente ainda não existe).
--   - aq_a_d15, aq_b_d15, aq_c_d15: as 3 dúvidas que mais chegaram e o que você respondeu.
--   - parouapp continua com o [dica]: é manual, você troca na hora de enviar.
--   - O aquecimento ainda não separa as trilhas pela etapa do guia: não ligue o Envio dele antes desse filtro existir,
--     senão todo mundo que pegou o guia recebe as três trilhas.
--
-- Segurança: só textos e regras dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes
--    where nota like 'modelos prontos ${HOJE}%' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m
--    where m.chave in (${NOVOS.map((n) => "'" + n.chave + "'").join(', ')})
--      and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);
`);

  out.push('-- ---------- 1. Os modelos de antes: uma versão nova em rascunho, com o texto de hoje em blocos ----------');
  DE_ANTES.forEach(([chave, tipo]) => {
    const d = ES.iniciais(chave), mt = ES.montar(d, tipo), t = chave;
    out.push(`insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(chave)}, (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = ${lit(chave)}), 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'modelos prontos ${HOJE}: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = ${lit(chave)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(chave)} and blocos = ${dolar(t + '_b', JSON.stringify(d))}::jsonb);
`);
  });

  out.push('-- ---------- 2. Os modelos novos (Envio desligado) e a versão 1 de cada um, em rascunho ----------');
  NOVOS.forEach((n) => {
    const o = ES.objetivo(n.obj), m = { chave: n.chave, criado_no_estudio: true, tipo: o.tipo, para_quem: n.para };
    const d = completo(n.d), mt = ES.montar(d, o.tipo), t = n.chave, e = n.envio;
    out.push(`insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values (${lit(n.chave)}, ${lit(n.nome)}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  ${lit(e ? 'Sozinho, pela parte Envio (sequência).' : 'Você envia, pela ficha.')}, ${lit(paraResumo(o.tipo, n.para))},
  ${jsonb(variaveis(n.chave, m))}, ${n.ordem}, true, ${lit(o.k)}, ${jsonb(n.para)},
  ${e ? lit(e.gatilho) : 'null'}, ${e ? lit(e.depois_de) : 'null'}, ${e ? e.dias : 'null'}, ${e ? e.hora : 'null'}, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(n.chave)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'modelos prontos ${HOJE}: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = ${lit(n.chave)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(n.chave)});
`);
  });
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-prontos.sql'), gerar());
  console.log('crm-modelos-prontos.sql gerado: ' + DE_ANTES.length + ' modelos de antes, ' + NOVOS.length + ' novos.');
}
