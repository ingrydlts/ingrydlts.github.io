// O e-mail de recap do Painel do Certificado (30 minutos depois do cadastro), em blocos, pronto para revisão no Estúdio de e-mails.
// Gera crm-modelo-painel-certificado-recap.sql (rode: node admin/crm/db/modelo-painel-certificado-recap.mjs). O SQL só cria o modelo e a versão 1
// em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '03/11/2026';
export const CHAVE = 'painel_recap_30min';
// O link do Notion do painel não está no repositório (vem do banco, por materiais). Enquanto isso o botão leva à página pública.
const PAGINA = 'https://imigrantepordentro.com/produtos-digitais/painel-do-certificado/';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };

export const D = {
  assunto: '{nome}, o Painel do Certificado de novo, para você guardar',
  assunto_alt: 'O Painel do Certificado de novo, para você guardar',
  pre: 'O link do painel e o que pesa no seu certificado.',
  rodape: 'pediu o Painel do Certificado no Por Dentro com {email}',
  itens: [
    {
        "tipo": "titulo",
        "texto": "O link do painel, para você guardar"
    },
    {
        "tipo": "texto",
        "texto": "Oi {nome}! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.",
        "alt": "Oi! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada."
    },
    {
        "tipo": "botao",
        "rotulo": "Abrir o Painel do Certificado",
        "url": PAGINA
    },
    {
        "tipo": "destaque",
        "rotulo": "Dentro do painel",
        "valor": "A prova, a data e a contagem regressiva\nAs habilidades, os materiais e as práticas da semana",
        "nota": "No Notion, clique em Duplicate (duplicar) e abra o certificado de exemplo: cada página dele explica para que serve."
    },
    {
        "tipo": "etapa",
        "se": "#porta_au_pair",
        "rotulo": "Para quem é au pair e já mora na França:",
        "titulo": "Para virar estudante, o francês entra no dossiê.",
        "texto": "Quem pede o changement de statut para estudante costuma precisar comprovar o nível de francês que a matrícula pede. Um curso de francês (FLE) com selo Qualité FLE é o caminho mais aceito pelas préfectures. Confirme com a escola qual certificado ela pede."
    },
    {
        "tipo": "etapa",
        "se": "#porta_pvt",
        "rotulo": "Para quem está na França por PVT:",
        "titulo": "O PVT não renova, então o certificado serve ao próximo passo.",
        "texto": "O PVT dura 12 meses e não renova. O certificado entra no seu plano de saída: para estudar, o visto de estudante é pedido do Brasil, depois da volta. Escolha a prova pelo curso que você quer."
    },
    {
        "tipo": "etapa",
        "se": "#porta_brasil",
        "rotulo": "Para quem está no Brasil:",
        "titulo": "A candidatura pede um teste de francês, e o prazo dele conta.",
        "texto": "No Études en France valem DELF B2, DALF ou TCF com expressão escrita (o 1º ano e Arquitetura têm regras próprias). Só a inscrição também vale, se a prova for até fevereiro e a duplicata do resultado chegar ao Campus France até 5 de março de 2027."
    },
    {
        "tipo": "etapa",
        "se": "#porta_conjuge",
        "rotulo": "Para quem vive na França por casamento ou parceria:",
        "titulo": "Para a carte de résident, o nível de francês e o exame cívico entram juntos.",
        "texto": "Desde 1º de janeiro de 2026, o nível de francês da carte de résident subiu de A2 para B1, e o exame cívico passou a ser obrigatório. Na naturalização, o nível subiu de B1 para B2."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_delf",
        "rotulo": "Para quem está preparando DELF:",
        "titulo": "Cada prova vale 25 pontos, e a aprovação pede 50 de 100 e pelo menos 5 de 25 em cada prova: uma nota abaixo de 5 elimina, mesmo com o total alto.",
        "texto": "O diploma tem validade vitalícia."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_dalf",
        "rotulo": "Para quem está preparando DALF:",
        "titulo": "A aprovação nos dois níveis é 50 de 100.",
        "texto": "No C1 há nota mínima de 5 de 25 em cada prova. No C2, a oral vale 50 pontos e a nota mínima por prova é 10 de 50. O diploma tem validade vitalícia."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_tcf_francais",
        "rotulo": "Para quem está preparando TCF Français:",
        "titulo": "Só acerto conta: erro e questão em branco valem 0, então não deixe nenhuma em branco.",
        "texto": "E o resultado vale 2 anos: marque a prova para que ele ainda esteja válido na data do seu pedido."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_tcf_canada",
        "rotulo": "Para quem está preparando TCF Canada:",
        "titulo": "O TCF Canada serve ao IRCC, e em geral não ao seu pedido na França.",
        "texto": "Antes de pagar, confira qual teste o seu visto ou a sua universidade aceita (TCF Français, DELF ou DALF)."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_exame_civico",
        "rotulo": "Para quem está preparando Exame Cívico francês:",
        "titulo": "A preparação é gratuita, no site de formação cívica do Ministério do Interior.",
        "texto": "Só a inscrição é paga: cada centro fixa o valor e não reembolsa quem falta sem justificativa. A aprovação pede 32 acertos em 40."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_toeic",
        "rotulo": "Para quem está preparando TOEIC:",
        "titulo": "Você recebe uma nota, e quem define o mínimo é a empresa ou o concurso.",
        "texto": "Pergunte o mínimo e se pedem a versão 4 Skills antes de pagar. O resultado vale 2 anos."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_cae",
        "rotulo": "Para quem está preparando CAE:",
        "titulo": "Com 180 ou mais você recebe o certificado de nível C1.",
        "texto": "De 160 a 179, o de nível B2. Se você precisa do C1, o corte de 180 é o que importa. O certificado tem validade vitalícia."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_cpe",
        "rotulo": "Para quem está preparando CPE:",
        "titulo": "Com 200 a 230 você recebe o certificado de nível C2.",
        "texto": "De 180 a 199, o de nível C1. O certificado tem validade vitalícia."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_outro",
        "rotulo": "Para quem está preparando outro certificado:",
        "titulo": "Pergunte à instituição ou à préfecture qual teste ela aceita antes de pagar a inscrição.",
        "texto": "Para formações em inglês, vale o teste oficial aceito pela instituição."
    },
    {
        "tipo": "etapa",
        "se": "#etapa_cert_indeciso",
        "rotulo": "Para quem ainda não sabe qual certificado fazer:",
        "titulo": "O nível de francês exigido depende do pedido: A2 para a primeira carte pluriannuelle, B1 para a carte de résident e B2 para a naturalização, mais o exame cívico desde 1º de janeiro de 2026.",
        "texto": "Para a maioria dos Masters, o B2 é o nível pedido."
    },
    DUVIDA, ASS
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const PARA = { materiais: ['guia-painel-do-certificado'] };

export function gerar() {
  const o = ES.objetivo('freebie'), m = { chave: CHAVE, criado_no_estudio: true, tipo: o.tipo, para_quem: PARA };
  const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo);
  const vars = ES.varsDoModelo(CHAVE, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  const t = CHAVE;
  return `-- Por Dentro — Estúdio de e-mails: recap do Painel do Certificado, 30 minutos depois do cadastro (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-painel-certificado-recap.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Painel do Certificado · recap (30 min)   tipo serviço (é o que ela pediu), sai 30 minutos depois de pegar o guia-painel-do-certificado.
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
values (${lit(CHAVE)}, ${lit('Painel do Certificado · recap (30 min)')}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  'Sozinho, pela parte Envio (sequência).', 'pegou Painel do Certificado',
  ${jsonb(vars)}, 541, true, ${lit(o.k)}, ${jsonb(PARA)},
  'material', 'guia-painel-do-certificado', null, null, 30, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(CHAVE)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'recap do Painel do Certificado ${HOJE}: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = ${lit(CHAVE)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(CHAVE)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelo-painel-certificado-recap.sql'), gerar());
}
