// Os 2 e-mails do guia "Checklist de chegada da au pair" (post X-0101), em blocos, prontos para revisão no Estúdio de e-mails.
// Gera crm-modelos-chegada-au-pair.sql (rode: node admin/crm/db/modelo-chegada-au-pair.mjs). O SQL só cria os modelos e a versão 1
// em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '08/11/2026';
export const SLUG = 'checklist-chegada-au-pair';
export const ORIGEM = 'guia-' + SLUG; // a origem que a página grava no cadastro (identificacaoCrm do Estúdio)
export const CHAVE_1 = 'aupair_chegada_1';
export const CHAVE_2 = 'aupair_chegada_2';
// O checklist publicado na web (Notion). Registre o mesmo endereço em guias_links (crm-guia-chegada-au-pair-link.sql).
export const NOTION = 'https://topordentroviagens.notion.site/Checklist-de-chegada-da-au-pair-o-que-fazer-e-em-que-ordem-412d602254ce812cb2cbd1f135b623c4';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const FONTE = 'Fonte: Ministério do Interior (validação do VLS-TS em linha) e France-Visas.';

// E-mail 1: a entrega do checklist. Não fala do app beta (pedido dela, 2026-11-08).
export const D1 = {
  assunto: '{nome}, seu checklist de chegada de au pair, na ordem',
  assunto_alt: 'Seu checklist de chegada de au pair, na ordem',
  pre: 'Sete passos, um destrava o outro. Comece pelo que tem prazo.',
  rodape: 'pediu o checklist de chegada da au pair no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'O seu checklist de chegada, na ordem' },
    { tipo: 'texto', texto: 'Oi {nome}! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.',
      alt: 'Oi! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.' },
    { tipo: 'botao', rotulo: 'Abrir o checklist', url: NOTION },
    { tipo: 'destaque', rotulo: 'O passo com prazo', valor: 'Valide o visto online, em até 3 meses da chegada', nota: FONTE },
    { tipo: 'texto', texto: 'Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família.',
      alt: 'Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família.' },
    { tipo: 'pergunta', texto: 'Qual passo está mais pesado para você agora?', ajuda: 'É só responder este e-mail. Eu leio cada resposta.' },
    ASS
  ]
};

// E-mail 2: dois dias depois, a oferta do checklist beta gratuito (criar login e senha).
export const D2 = {
  assunto: '{nome}, um lugar para marcar cada passo do checklist',
  assunto_alt: 'Um lugar para marcar cada passo do checklist',
  pre: 'Meu checklist beta é gratuito: você cria o login e a senha e entra.',
  rodape: 'pediu o checklist de chegada da au pair no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'Quer marcar cada passo em um lugar só?' },
    { tipo: 'texto', texto: 'Oi {nome}! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.',
      alt: 'Oi! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.' },
    { tipo: 'botao', rotulo: 'Criar meu acesso grátis (beta)', link: 'link_acesso' },
    { tipo: 'texto', texto: 'É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro.',
      alt: 'É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro.' },
    { tipo: 'pergunta', texto: 'Algum passo do checklist ficou confuso?', ajuda: 'É só responder este e-mail. Eu leio cada resposta.' },
    ASS
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
  return `-- Por Dentro — Estúdio de e-mails: os 2 e-mails do guia "Checklist de chegada da au pair" (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-chegada-au-pair.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Au pair · checklist de chegada (e-mail 1)   serviço, sai 5 minutos depois de pegar o guia (origem ${ORIGEM}).
--       Entrega o checklist, destaca o único passo com prazo e pergunta qual passo está mais pesado. NÃO fala do app beta.
--   Au pair · checklist beta (e-mail 2)         novidades (só quem aceitou), sai 2 dias depois do e-mail 1, às 10h.
--       Oferece o checklist beta gratuito: criar login e senha na plataforma (botão com link_acesso).
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. O botão "Abrir o checklist" já aponta para o checklist publicado no Notion (notion.site). Confira que a página abre sem login.
--   2. Rode também crm-guia-chegada-au-pair-link.sql: ele registra o mesmo endereço para a página do guia (ela mostra o link depois do cadastro).
--   3. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23); com cron de hora em hora sai na próxima rodada.
--   4. O e-mail 2 usa link_acesso (o app): confira para onde ele abre o cadastro.
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('${CHAVE_1}', '${CHAVE_2}') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('${CHAVE_1}', '${CHAVE_2}') and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

${modelo({ chave: CHAVE_1, nome: 'Au pair · checklist de chegada (e-mail 1)', objetivo: 'freebie', D: D1, quem: 'pegou o checklist de chegada da au pair', gatilho: 'material', depois: ORIGEM, dias: null, hora: null, minutos: 5, ordem: 550, nota: 'e-mail 1 do guia de chegada da au pair' })}
${modelo({ chave: CHAVE_2, nome: 'Au pair · checklist beta (e-mail 2)', objetivo: 'conversa', D: D2, quem: 'pegou o checklist de chegada da au pair e aceitou novidades', gatilho: 'email', depois: CHAVE_1, dias: 2, hora: 10, minutos: null, ordem: 551, nota: 'e-mail 2 do guia de chegada da au pair' })}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-chegada-au-pair.sql'), gerar());
}
