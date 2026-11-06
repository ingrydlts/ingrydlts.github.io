// O e-mail de recap do guia do tecnólogo (30 minutos depois do cadastro), em blocos, pronto para revisão no Estúdio de e-mails.
// Gera crm-modelo-tecnologo-recap.sql (rode: node admin/crm/db/modelo-tecnologo-recap.mjs). O SQL só cria o modelo e a versão 1
// em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '03/11/2026';
export const CHAVE = 'tec_recap_30min';
export const NOTION = 'https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };

export const D = {
  assunto: '{nome}, o checklist do tecnólogo de novo, para você guardar',
  assunto_alt: 'O checklist do tecnólogo de novo, para você guardar',
  pre: 'O link e o modelo de e-mail em francês, para não se perder.',
  rodape: 'pediu o guia do tecnólogo no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'O link do checklist, para você guardar' },
    { tipo: 'texto', texto: 'Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.',
      alt: 'Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.' },
    { tipo: 'botao', rotulo: 'Abrir o checklist e o modelo de e-mail', url: NOTION },
    { tipo: 'destaque', rotulo: 'Dentro do link', valor: 'Os 5 passos para descobrir o seu nível\nO e-mail em francês para perguntar à escola',
      nota: 'O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução.' },
    { tipo: 'etapa', se: '#destino_fr', rotulo: 'Para quem vai fazer o processo da França:', titulo: 'Você já tem certificado de francês? Como está preparando?',
      texto: 'Quem faz o processo daqui costuma esbarrar primeiro no francês: o nível que a escola pede entra no seu pedido. Se você ainda está preparando o DELF, o DALF ou o TCF, eu tenho um painel gratuito, em Notion, com o prazo, os materiais e as revisões da prova num lugar só: https://imigrantepordentro.com/produtos-digitais/painel-do-certificado/' },
    { tipo: 'etapa', se: '#destino_br', rotulo: 'Para quem vai fazer o processo do Brasil:', titulo: 'No L3, a alternância não vale para quem chega agora. O trabalho de estudante, sim.',
      texto: 'Pela ficha F2713 do Service-Public, para assinar contrato de apprentissage ou de professionnalisation é preciso estar há mais de 1 ano na França; a exceção, no apprentissage, é a inscrição direta em Master ou em diploma da lista das grandes écoles. Já as 964 horas de trabalho por ano de quem tem título de estudante você usa desde o começo (confirme no seu título e na préfecture). Uma pergunta para eu te orientar melhor: você vai se candidatar neste ciclo (prazo de 17 de janeiro de 2027 no Études en France) ou no do ano que vem? É só responder este e-mail.' },
    { tipo: 'etapa', se: '#destino_nao_sei', rotulo: 'Para quem ainda não sabe onde vai fazer o processo:', titulo: 'São duas rotas, e a diferença está no contrato de alternância.',
      texto: 'Pelo Brasil, a candidatura é no Études en France e o contrato de alternância só vem depois de 1 ano na França. Daqui, o caminho é pelo seu status atual, e o francês pesa mais. Responda este e-mail com a sua situação que eu te digo qual rota combina com ela.' },
    { tipo: 'etapa', se: '#porta_au_pair', rotulo: 'Para quem é au pair e já mora na França:', titulo: 'Pergunte o nível às escolas já, de onde você está.', texto: 'O pedido para virar estudante (changement de statut) vem depois, com a matrícula em mãos e antes de o seu título de au pair vencer.' },
    { tipo: 'etapa', se: '#porta_pvt', rotulo: 'Para quem está na França por PVT:', titulo: 'O caminho previsto é pelo Brasil.', texto: 'Candidatura no Études en France e visto de estudante pedido depois da volta. Vale começar a perguntar às escolas já.' },
    { tipo: 'etapa', se: '#porta_brasil', rotulo: 'Para quem está no Brasil:', titulo: 'O seu prazo é 17 de janeiro de 2027.', texto: 'Para L3, Licence pro e Master, o prazo do ciclo 2027-2028 no Études en France é o mesmo: 17/01/2027.' },
    { tipo: 'etapa', se: '#porta_conjuge', rotulo: 'Para quem vive na França por casamento ou parceria:', titulo: 'Você não precisa de visto de estudante para estudar.', texto: 'A candidatura segue pelos portais do curso ou direto com a escola. O modelo de e-mail do guia serve do mesmo jeito.' },
    { tipo: 'etapa', se: '#etapa_tec_nao_sei', rotulo: 'Para quem ainda não sabe em que nível entraria:', titulo: 'Pergunte por escrito, com o histórico em anexo.', texto: 'Peça a resposta por escrito: é ela que vale. E antes de gastar com qualquer coisa, o Campus France Brasil oferece uma sessão de orientação online sobre o nível. O modelo do guia pergunta o nível, não pede o nível: quem decide é a escola.' },
    { tipo: 'etapa', se: '#etapa_tec_juntando', rotulo: 'Para quem está juntando histórico, diploma e carga horária:', titulo: 'Traduza só depois que os cursos disserem o nível.', texto: 'A lista de documentos muda entre L3 e Master. O histórico precisa ser recente, com assinatura e carimbo ou autenticação eletrônica. Junte o diploma, o histórico, o programa das disciplinas e, se o histórico não indicar, o atestado da instituição com o total de horas.' },
    { tipo: 'etapa', se: '#etapa_tec_escrevi', rotulo: 'Para quem já escreveu para escolas e está esperando:', titulo: 'Peça sempre a resposta por escrito.', texto: 'Enquanto espera, adiante os documentos que não dependem das escolas. Se a resposta demorar, repita no lembrete a frase do modelo: "Pourriez-vous me répondre par écrit, afin que je puisse conserver votre réponse pour mes démarches ?"' },
    { tipo: 'etapa', se: '#etapa_tec_resposta', rotulo: 'Para quem já tem resposta de uma escola:', titulo: 'Um mesmo dossiê pode ter formações de níveis diferentes.', texto: 'Vale o menor prazo, e L2, L3, Licence Pro e Master fecham no mesmo dia (17/01/2027), então o seu prazo já é certo mesmo antes de todos os cursos responderem. Confira na resposta: o nível aceito e os critérios, se precisa do atestado ENIC-NARIC, se as traduções juramentadas são exigidas já no dossiê, e se há alternância e quando um contrato pode ser assinado.' },
    { tipo: 'texto', texto: 'Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso **não é regra**: entre em contato com as universidades.' },
    { tipo: 'pergunta', texto: 'Em que nível você quer entrar?', ajuda: 'Toque numa opção. Leva dois segundos e muda o que eu te mando a seguir.' },
    { tipo: 'toques', var: 'botoes_nivel_tec' },
    { tipo: 'texto', texto: 'O passo a passo do seu caso também fica no app, com o checklist do seu perfil:' },
    { tipo: 'botao', rotulo: 'Abrir o app', link: 'link_acesso' },
    DUVIDA, ASS
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const PARA = { materiais: ['guia-tecnologo'] };

export function gerar() {
  const o = ES.objetivo('freebie'), m = { chave: CHAVE, criado_no_estudio: true, tipo: o.tipo, para_quem: PARA };
  const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo);
  const vars = ES.varsDoModelo(CHAVE, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  const t = CHAVE;
  return `-- Por Dentro — Estúdio de e-mails: recap do guia do tecnólogo, 30 minutos depois do cadastro (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-tecnologo-recap.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Tecnólogo · recap do checklist (30 min)   tipo serviço (é o que ela pediu), sai 30 minutos depois de pegar o guia-tecnologo.
-- Para ir ao ar: no Estúdio de e-mails, abra o modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
-- Quem se cadastrar antes de o Envio ser ligado não recebe (só vale quem passar do horário depois de ligar).
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave = '${CHAVE}' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave = '${CHAVE}' and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values (${lit(CHAVE)}, ${lit('Tecnólogo · recap do checklist (30 min)')}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo',
  ${jsonb(vars)}, 540, true, ${lit(o.k)}, ${jsonb(PARA)},
  'material', 'guia-tecnologo', null, null, 30, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(CHAVE)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'recap do guia do tecnólogo ${HOJE}: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = ${lit(CHAVE)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(CHAVE)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelo-tecnologo-recap.sql'), gerar());
}
