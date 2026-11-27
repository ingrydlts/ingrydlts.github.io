// Os 2 e-mails do modelo grátis "mudança de endereço na mesma cidade" (página /manual-destrave-domiciliacao/), em blocos,
// prontos para revisão no Estúdio de e-mails. Gera crm-modelos-manual-domiciliacao.sql (rode: node admin/crm/db/modelo-manual-domiciliacao.mjs).
// O SQL só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '27/11/2026';
export const CHAVE_1 = 'dom_modelo_1';
export const CHAVE_2 = 'dom_modelo_2';
// Origem gravada pelo formulário da página (payload.origem) e usada como gatilho "material".
export const ORIGEM = 'manual-destrave-domiciliacao';
const PAGINA = 'https://imigrantepordentro.com/manual-destrave-domiciliacao/';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };

// A carta sai SEM os dados da pessoa: o formulário da página não guarda endereço nem número de dossiê (só nome, e-mail e consentimento).
// Os campos vêm entre parênteses, nunca entre colchetes (o Worker recusa [colchetes] no envio).
const CARTA = [
  'Objet : Changement d\'adresse au sein de la même commune',
  '',
  'Madame, Monsieur,',
  '',
  'Je vous informe de mon changement d\'adresse au sein de la même commune, à compter du (data da mudança). Mon ancienne adresse était : (endereço antigo). Ma nouvelle adresse est : (endereço novo).',
  '',
  'Mon numéro de dossier auprès de (CAF, CPAM…) est : (número do dossiê).',
  '',
  'Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m\'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.',
  '',
  'Cordialement,',
  '(seu nome)'
].join('\n');

export const D1 = {
  assunto: '{nome}, a carta de mudança de endereço, para copiar',
  assunto_alt: 'A carta de mudança de endereço, para copiar',
  pre: 'O modelo em francês, com os campos para preencher.',
  rodape: 'pediu o modelo de mudança de endereço no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'A carta, pronta para copiar' },
    { tipo: 'texto', texto: 'Oi {nome}! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.',
      alt: 'Oi! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.' },
    { tipo: 'texto', estilo: 'caixa', texto: CARTA },
    { tipo: 'texto', texto: 'Troque o que está entre parênteses pelos seus dados e envie ao órgão. Eu não guardo o seu endereço nem o número do dossiê: o que você digitou no site ficou só na página.' },
    { tipo: 'texto', texto: 'Modelo de exemplo: adapte ao seu caso e confirme na fonte oficial do órgão antes de enviar. Isto não é aconselhamento jurídico.' },
    DUVIDA, ASS
  ]
};

export const D2 = {
  assunto: '{nome}, os outros 7 modelos de carta do Manual',
  assunto_alt: 'Os outros 7 modelos de carta do Manual',
  pre: 'Mudança de cidade, renovação, recusa do CCAS e mais.',
  rodape: 'pediu o modelo de mudança de endereço no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair',
  itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.',
      alt: 'Oi! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.' },
    { tipo: 'destaque', rotulo: 'O que vem no Manual', valor: '8 modelos de carta e e-mail\n3 formulários oficiais a 1 clique\nBase legal e data em cada item',
      nota: 'Pagamento único, atualizações por 1 ano e garantia de 7 dias, por e-mail.' },
    { tipo: 'botao', rotulo: 'Ver o Manual', url: PAGINA + '?utm_source=email&utm_medium=email&utm_campaign=destrave&utm_content=' + CHAVE_2 + '#preco' },
    { tipo: 'texto', texto: 'Não garante que o órgão vai aceitar o seu pedido: quem decide é ele. O Manual organiza o caminho e os textos.' },
    DUVIDA, ASS
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const PARA = { materiais: [ORIGEM] };

function modelo({ chave, nome, objetivo, D, quem, gatilho, depois, dias, hora, minutos, ordem, nota }) {
  const o = ES.objetivo(objetivo), m = { chave, criado_no_estudio: true, tipo: o.tipo, para_quem: PARA };
  const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo);
  const vars = ES.varsDoModelo(chave, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  const t = chave;
  return `insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values (${lit(chave)}, ${lit(nome)}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  'Sozinho, pela parte Envio (sequência).', ${lit(quem)},
  ${jsonb(vars)}, ${ordem}, true, ${lit(o.k)}, ${jsonb(PARA)},
  ${lit(gatilho)}, ${lit(depois)}, ${dias == null ? 'null' : dias}, ${hora == null ? 'null' : hora}, ${minutos == null ? 'null' : minutos}, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(chave)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  ${lit(nota + ' ' + HOJE + ': escrita para revisão')}
where exists (select 1 from public.modelos_email where chave = ${lit(chave)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(chave)});
`;
}

export function gerar() {
  return `-- Por Dentro — Estúdio de e-mails: os 2 e-mails do modelo grátis "mudança de endereço" do Manual Destrave (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-manual-domiciliacao.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO. NENHUMA tabela, função ou política nova:
-- a página chama a capturar_lead_guia de sempre e o gatilho "material" lê o evento email_capturado (origem ${ORIGEM}).
--   Domiciliação · modelo grátis (e-mail 1)   serviço, sai 5 minutos depois do cadastro (origem ${ORIGEM}).
--       Entrega a carta em francês com os campos entre parênteses. Não vende nada (é serviço).
--   Domiciliação · Manual (e-mail 2)          novidades (só quem aceitou), sai 2 dias depois do e-mail 1, às 10h.
--       Apresenta o Manual e leva à página (#preco), com UTM.
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. A página /manual-destrave-domiciliacao/ precisa estar no ar (merge) com o formulário ligado à capturar_lead_guia.
--   2. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23); com cron de hora em hora sai na próxima rodada.
--   3. O Worker publicado precisa aceitar modelos novos do estúdio (crmSequenciasRodada). Nenhuma mudança de código foi feita para este guia.
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa (a carta vai com os campos em branco). Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('${CHAVE_1}', '${CHAVE_2}') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('${CHAVE_1}', '${CHAVE_2}') and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- Confere o pré-requisito antes de criar qualquer coisa.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'modelos_email' and column_name = 'envio_minutos') then
    raise exception 'Falta rodar antes o crm-sequencia-minutos.sql (e, antes dele, o crm-filtro-etapa.sql) neste banco. Depois rode este arquivo de novo.';
  end if;
  if to_regclass('public.modelos_email_versoes') is null then
    raise exception 'Falta rodar antes o crm-estudio-emails-3.sql neste banco. Depois rode este arquivo de novo.';
  end if;
end
$$;

${modelo({ chave: CHAVE_1, nome: 'Domiciliação · modelo grátis (e-mail 1)', objetivo: 'freebie', D: D1, quem: 'pegou o modelo grátis do Manual Destrave', gatilho: 'material', depois: ORIGEM, dias: null, hora: null, minutos: 5, ordem: 570, nota: 'e-mail 1 do modelo grátis da domiciliação' })}
${modelo({ chave: CHAVE_2, nome: 'Domiciliação · Manual (e-mail 2)', objetivo: 'conversa', D: D2, quem: 'pegou o modelo grátis do Manual Destrave e aceitou novidades', gatilho: 'email', depois: CHAVE_1, dias: 2, hora: 10, minutos: null, ordem: 571, nota: 'e-mail 2 do modelo grátis da domiciliação' })}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-manual-domiciliacao.sql'), gerar());
}
