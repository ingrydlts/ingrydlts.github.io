// Os 4 e-mails de reimpacto reescritos com a base da aula de CRO (Fogg, Cialdini, AIDA), aprovados em 20/10 no artefato
// "Reimpacto Por Dentro". Gera crm-modelos-reimpacto.sql (rode: node admin/crm/db/modelos-reimpacto.mjs). Só cria rascunhos.
//
// Cada um parte da versão da revisão de texto de 20/10 (modelos-revisao.mjs) e só ganha a versão nova se ela ainda for a mais
// nova no banco: o que você mudar no estúdio antes de rodar fica.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVISADOS, sqlVersao } from './modelos-revisao.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '20/10/2026';
export const NOTA = 'reimpacto CRO ' + HOJE;
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const oi = (resto) => ({ tipo: 'texto', texto: 'Oi {nome}! ' + resto, alt: 'Oi! ' + resto });
const com = (d) => Object.assign({ v: 1, planos: {} }, d);

// O que faltou em cada etapa (Fogg): não abriu = o prompt; abriu e não clicou = a motivação;
// clicou e não entrou = a capacidade; entrou e parou = a motivação, no meio do caminho.
const NOVOS = {
  naoabriu: com({
    assunto: '{nome}, o que ninguém me contou quando eu cheguei', assunto_alt: 'O que ninguém me contou quando eu cheguei',
    pre: 'Eu cheguei sem francês e sem informação confiável.',
    itens: [
      oi('Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!'),
      { tipo: 'texto', texto: 'Foi por isso que eu montei esse checklist: para te entregar os passos na ordem, com o prazo real de cada um, num lugar só.' },
      { tipo: 'botao', rotulo: 'Ver o meu checklist', link: 'link_acesso' },
      { tipo: 'texto', estilo: 'discreto', texto: 'Se o e-mail anterior caiu no spam, marque como "não é spam". Assim os próximos chegam.' },
      ASS] }),
  naoclicou: com({
    assunto: '{nome}, por onde começar (sem ler 40 sites)', assunto_alt: 'Por onde começar (sem ler 40 sites)',
    pre: 'Um passo de cada vez, com a fonte de cada um.',
    itens: [
      oi('Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.'),
      { tipo: 'destaque', rotulo: 'O que o checklist faz por você', valor: 'Mostra o próximo passo do seu caso, na ordem, com o prazo real.', nota: 'Você cria a sua conta e, com um clique, já vê.' },
      { tipo: 'texto', texto: 'Cada passo sai de fonte oficial, e eu confiro tudo antes de colocar lá.' },
      { tipo: 'botao', rotulo: 'Ver o meu primeiro passo', link: 'link_acesso' },
      { tipo: 'texto', estilo: 'discreto', texto: 'Qualquer dúvida, é só responder este e-mail.' },
      ASS] }),
  cliquenaoapp: com({
    assunto: '{nome}, o link travou?', assunto_alt: 'O link travou?',
    pre: 'Duas coisas que costumam resolver.',
    itens: [
      oi('Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:'),
      { tipo: 'destaque', rotulo: 'O que costuma resolver', valor: '**1.** Abra o link no navegador do celular, não dentro do app de e-mail ou do Instagram.\n**2.** Use o link deste e-mail, o mais novo.' },
      { tipo: 'botao', rotulo: 'Entrar no meu checklist', link: 'link_acesso' },
      { tipo: 'texto', texto: 'Se ainda travar, responda este e-mail com um print. Eu olho com você.' },
      ASS] }),
  parouapp: com({
    assunto: '{nome}, o passo que trava quase todo mundo', assunto_alt: 'O passo que trava quase todo mundo',
    pre: 'Não é falta de organização. É o sistema.',
    itens: [
      oi('Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.'),
      { tipo: 'texto', texto: 'Eu também travei assim. O que me destravou foi começar pelo que depende dos outros e, enquanto espero, seguir com o resto.' },
      { tipo: 'destaque', rotulo: 'A dica para o seu momento', valor: '[dica]' },
      { tipo: 'texto', se: '#motivo', texto: 'Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.' },
      { tipo: 'pergunta', texto: 'Em qual passo você parou?', ajuda: 'Me conte em uma frase. É só responder este e-mail.' },
      ASS] })
};

export const REIMPACTOS = Object.keys(NOVOS).map((chave) => {
  const r = REVISADOS.find((x) => x.chave === chave);
  return { chave, tipo: r.tipo, base: r.blocos, blocos: NOVOS[chave] };
});

export function gerar() {
  return `-- Por Dentro — Estúdio de e-mails: os 4 reimpactos reescritos com a base da aula de CRO (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-revisao.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-reimpacto.mjs, a partir de estudio.js (ES.montar). Aprovado no artefato "Reimpacto Por Dentro".
--
-- Só cria rascunhos, com a nota "${NOTA}": naoabriu, naoclicou, cliquenaoapp e parouapp. Não publica nada e não mexe
-- em nenhuma versão que já existe. Cada um só ganha a versão nova se a versão mais nova dele ainda for a da revisão de texto
-- de ${HOJE}; se você mudou o modelo no estúdio depois disso, ele é pulado.
-- O parouapp continua com o [dica]: é manual, você troca na hora de enviar.
--
-- Segurança: só textos dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota = '${NOTA}' and etapa in ('rascunho', 'revisao');
` + '\n' + REIMPACTOS.map((r) => sqlVersao(r, NOTA)).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-reimpacto.sql'), gerar());
  console.log('crm-modelos-reimpacto.sql gerado: ' + REIMPACTOS.length + ' reimpactos.');
}
