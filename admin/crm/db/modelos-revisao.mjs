// A revisão de texto dos modelos de e-mail do CRM (20/10), aprovada por grupo: os 8 manuais, o Hub de Estudos, o lembrete de
// prazo, o aquecimento (D+3 e D+6) e o e-mail 2 do guia. Gera crm-modelos-revisao.sql (rode: node admin/crm/db/modelos-revisao.mjs).
// O SQL só cria rascunhos: quem testa e publica é você, pelo estúdio.
//
// Cada modelo revisado parte da versão mais nova que estava no banco em 20/10 (BASE) e ganha uma versão nova em rascunho.
// Se você mudou o modelo no estúdio depois disso (a versão mais nova não é mais a BASE), ele é pulado: nada do que você
// escreveu é sobrescrito. O e-mail 1 (cf_guia_1), o D+10 e o D+15 do aquecimento ficam como estão.
// O assunto, a prévia, o texto puro e o HTML de cada versão saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';
import { NOVOS } from './modelos-prontos.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '20/10/2026';
export const NOTA = 'revisão de texto ' + HOJE;
const copia = (o) => JSON.parse(JSON.stringify(o));
const completo = (d) => { d = copia(d); d.v = 1; d.planos = d.planos || {}; return d; };
const oi = (resto) => ({ tipo: 'texto', texto: 'Oi {nome}! ' + resto, alt: 'Oi! ' + resto });
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };

// O e-mail 2 como está No ar (versão 3, o texto que você escreveu no estúdio).
const CONVERSA_V3 = {
  v: 1, planos: {}, assunto: '{nome}, uma pergunta rápida', assunto_alt: 'Uma pergunta rápida', pre: 'Um toque e eu já sei para onde você vai.',
  rodape: 'pediu o checklist Études en France com {email}',
  itens: [
    { tipo: 'apresentacao', titulo: 'Oi, eu sou a Ingryd', texto: 'Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.' },
    { tipo: 'pergunta', texto: '{nome}, para qual cidade você quer ir?', alt: 'Para qual cidade você quer ir?', ajuda: 'Cada cidade aqui na França muda muito o custo de vida e meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências ' },
    { tipo: 'toques', var: 'botoes_cidade' },
    { tipo: 'texto', estilo: 'discreto', texto: 'Se você responde esse email com os nomes das cidades que você tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso. \n\nEu leio cada resposta ;)' },
    ASS]
};

const novo = (chave) => completo(NOVOS.find((n) => n.chave === chave).d);
const tipoNovo = (chave) => ES.objetivo(NOVOS.find((n) => n.chave === chave).obj).tipo;

// [chave, tipo, base (a versão mais nova em 20/10), (base) => blocos revisados]
const R = [];
const manual = (chave, tipo, fn) => R.push([chave, tipo, ES.iniciais(chave), fn]);

// ---------- Grupo 1: os 8 manuais ----------
manual('boas_vindas', 'servico', (d) => Object.assign(d, {
  assunto: '{nome}, o seu link de acesso chegou', assunto_alt: 'O seu link de acesso chegou', pre: 'Sem senha: um clique e você entra.',
  itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Aqui está o link do seu checklist de {persona}, já com os prazos reais.', alt: 'Oi! Aqui está o link do seu checklist, já com os prazos reais.' },
    d.itens[1],
    { tipo: 'texto', texto: 'Não precisa de senha: é um clique e você já entra.' }, ASS] }));
manual('naoabriu', 'servico', (d) => Object.assign(d, {
  assunto: '{nome}, o seu checklist continua aqui', assunto_alt: 'O seu checklist continua aqui', pre: 'Deixei o link de novo, caso o outro tenha se perdido.',
  itens: [
    oi('Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.'),
    d.itens[1],
    { tipo: 'texto', texto: 'Se o e-mail anterior caiu no spam, marque como "não é spam" para não perder os próximos.' }, ASS] }));
manual('naoclicou', 'novidades', (d) => Object.assign(d, {
  assunto: '{nome}, o que tem no seu checklist', assunto_alt: 'O que tem no seu checklist', pre: 'Os passos do seu caso, na ordem, com os prazos.',
  itens: [
    oi('Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.'),
    d.itens[1],
    { tipo: 'texto', texto: 'Qualquer dúvida, é só responder este e-mail.' }, ASS] }));
manual('cliquenaoapp', 'servico', (d) => Object.assign(d, {
  assunto: '{nome}, o seu link ainda funciona', assunto_alt: 'O seu link ainda funciona', pre: 'O acesso é sem senha: um clique só.',
  itens: [
    oi('Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.'),
    d.itens[1],
    { tipo: 'texto', texto: 'Se travou em alguma coisa, responda este e-mail e me conte. Eu ajudo.' }, ASS] }));
manual('parouapp', 'novidades', (d) => Object.assign(d, {
  assunto: '{nome}, uma dica para o seu momento', assunto_alt: 'Uma dica para o seu momento', pre: 'Uma dica que não estava no seu checklist.',
  itens: [
    oi('Separei uma dica que não estava no seu checklist, para o seu momento: [dica]'),
    { tipo: 'texto', se: '#motivo', texto: 'Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.' }, ASS] }));
manual('guia_chamada', 'novidades', (d) => {
  d.assunto_alt = 'Como está o seu VLS-TS?'; d.pre = 'Se travou em algum passo, eu olho o seu caso.';
  d.itens[0] = oi('Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.');
  d.itens[1].texto = 'Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite}. Então vale agir logo.';
  return d;
});
manual('guia_plataforma', 'novidades', (d) => {
  d.assunto_alt = 'Quer testar a plataforma do Por Dentro?'; d.pre = 'Checklist com prazos reais, em troca do seu feedback.';
  d.itens[0] = oi('Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.');
  d.itens[2].texto = 'É sem senha: um clique e você entra. Em troca, só peço a sua opinião sincera.';
  return d;
});
manual('guia_alternancia', 'novidades', (d) => {
  d.assunto_alt = 'O e-mail para a escola e o próximo passo'; d.pre = 'O próximo passo para a sua etapa.';
  d.itens[0] = oi('Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.');
  d.itens.forEach((b) => { if (b.texto) b.texto = b.texto.replace(/\bpra\b/g, 'para'); });
  return d;
});

// ---------- Grupo 3: Hub de Estudos ----------
R.push(['hub_estudos_compra', tipoNovo('hub_estudos_compra'), novo('hub_estudos_compra'), (d) => {
  const b = d.itens.find((x) => x.tipo === 'destaque');
  b.valor = b.valor.replace('**3.** Lance o primeiro prazo que você tem e abra a visão Hoje.', '**3.** Lance o primeiro prazo que você tem e veja ele aparecer na visão Hoje.');
  return d;
}]);
R.push(['hub_estudos_d3', tipoNovo('hub_estudos_d3'), novo('hub_estudos_d3'), (d) => {
  d.itens[1] = oi('Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.');
  return d;
}]);
R.push(['hub_estudos_lancamento', tipoNovo('hub_estudos_lancamento'), novo('hub_estudos_lancamento'), (d) => {
  d.itens[0].texto = 'Matérias, aulas e prazos numa aba só';
  d.itens[3] = { tipo: 'texto', texto: 'Foi pensado para quem faz um master, mas serve para qualquer curso: é só trocar as matérias.' };
  d.itens.splice(4, 1,
    { tipo: 'texto', texto: 'Para ver tudo o que tem dentro: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos' },
    { tipo: 'texto', estilo: 'discreto', texto: 'Ficou com dúvida antes de comprar? É só responder este e-mail.' });
  return d;
}]);

// ---------- Grupo 4: lembrete de prazo ----------
R.push(['lembrete_prazo_vlsts', tipoNovo('lembrete_prazo_vlsts'), novo('lembrete_prazo_vlsts'), (d) => {
  d.itens.splice(3, 0, { tipo: 'texto', texto: 'Para validar, você entra no site da ANEF com o número do seu visto e paga a taxa online.' });
  return d;
}]);

// ---------- Grupo 5: aquecimento (D+3: a pergunta da trilha; D+6: "desde 2023", como no e-mail 2) ----------
const PERGUNTA_D3 = {
  a: { tipo: 'pergunta', texto: 'Você já anotou o prazo dos seus cursos?', ajuda: 'Responda **sim** ou **ainda não**. Eu leio cada resposta.' },
  b: { tipo: 'pergunta', texto: 'Algum documento seu ainda não existe?', ajuda: 'Me conte qual. É só responder este e-mail.' },
  c: { tipo: 'pergunta', texto: 'Você já declarou o pagamento?', ajuda: 'Responda **sim** ou **ainda não**. Se travou, me conte onde.' }
};
['a', 'b', 'c'].forEach((t) => {
  R.push(['aq_' + t + '_d3', 'novidades', novo('aq_' + t + '_d3'), (d) => {
    d.itens[d.itens.findIndex((x) => x.tipo === 'pergunta')] = PERGUNTA_D3[t];
    return d;
  }]);
  R.push(['aq_' + t + '_d6', 'novidades', novo('aq_' + t + '_d6'), (d) => {
    d.itens[0].texto = 'Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.';
    return d;
  }]);
});

// ---------- Extra: e-mail 2 (só o português; a versão No ar não muda) ----------
R.push(['cf_guia_conversa', 'novidades', CONVERSA_V3, (d) => {
  d.itens[1].ajuda = 'Cada cidade aqui na França muda muito o custo de vida, e o meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências.';
  d.itens[3].texto = 'Se você responder este e-mail com os nomes das cidades que tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso.\n\nEu leio cada resposta ;)';
  return d;
}]);

export const REVISADOS = R.map(([chave, tipo, base, fn]) => ({ chave, tipo, base, blocos: fn(copia(base)) }));

// ---------- Montar e escrever o SQL ----------
const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export function gerar() {
  const out = [];
  out.push(`-- Por Dentro — Estúdio de e-mails: revisão de texto dos modelos (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-prontos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-revisao.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos. Não publica nada, não mexe em nenhuma versão que já existe (nem na No ar) e não liga nenhum Envio.
-- ${REVISADOS.length} modelos ganham uma versão nova em RASCUNHO, com a nota "${NOTA}":
--   os 8 manuais (sem travessão, "para" no lugar de "pra", prévia e assunto sem nome),
--   Hub de Estudos (compra, D+3, lançamento), lembrete de prazo do VLS-TS (como validar na ANEF),
--   aquecimento D+3 (a pergunta de cada trilha) e D+6 ("desde 2023"), e o e-mail 2 do guia (só o português).
-- Ficam como estão: o e-mail 1 (cf_guia_1), o D+10 e o D+15 do aquecimento e o entrega_de_freebie.
--
-- Trava: um modelo só ganha a versão nova se a versão mais nova dele ainda for a que estava no banco em ${HOJE}.
-- Se você mudou o modelo no estúdio depois disso, ele é pulado (o seu texto fica). Também não cria de novo se já
-- existe uma versão com estes blocos ou uma versão com a nota desta revisão.
--
-- O que ainda falta antes de publicar: o [dica] do parouapp (manual: você troca na hora de enviar), o [link do presente CF09]
-- do aq_c_d10 e as 3 dúvidas dos D+15. O aquecimento só liga depois do filtro por etapa do guia.
--
-- Segurança: só textos dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota = '${NOTA}' and etapa in ('rascunho', 'revisao');
`);
  REVISADOS.forEach(({ chave, tipo, base, blocos }) => {
    const mt = ES.montar(blocos, tipo), t = chave, k = lit(chave);
    out.push(`insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${k}, (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = ${k}), 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(blocos))}::jsonb,
  ${lit(NOTA)}
where exists (select 1 from public.modelos_email where chave = ${k} and tipo = ${lit(tipo)})
  and (select blocos from public.modelos_email_versoes where chave = ${k} order by versao desc limit 1) = ${dolar(t + '_base', JSON.stringify(base))}::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = ${k} and nota = ${lit(NOTA)});
`);
  });
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-revisao.sql'), gerar());
  console.log('crm-modelos-revisao.sql gerado: ' + REVISADOS.length + ' modelos revisados.');
}
