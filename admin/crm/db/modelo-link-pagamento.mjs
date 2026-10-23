// Gera crm-link-pagamento-email.sql: o modelo "link_pagamento" do Estúdio de e-mails (versão 1, No ar), o e-mail do
// botão "Enviar link de pagamento" da aba Plataforma. Rode: node admin/crm/db/modelo-link-pagamento.mjs
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TIPO = 'servico';   // e-mail transacional: a pessoa pediu o plano na chamada. Sem rodapé de descadastro.

export const BLOCOS = {
  v: 1, planos: {},
  assunto: '{nome}, o seu link de pagamento chegou', assunto_alt: 'O seu link de pagamento chegou',
  pre: 'É só escolher a forma de pagamento e concluir.',
  itens: [
    { tipo: 'texto', texto: 'Oi {nome}! Foi um prazer conversar com você. Aqui está o link para você concluir o pagamento do plano que combinamos.', alt: 'Oi! Foi um prazer conversar com você. Aqui está o link para você concluir o pagamento do plano que combinamos.' },
    { tipo: 'botao', rotulo: 'Concluir o pagamento', link: 'link_pagamento' },
    { tipo: 'texto', estilo: 'discreto', texto: 'O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.' },
    { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' },
    { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";

export function gerar() {
  const mt = ES.montar(BLOCOS, TIPO), t = 'link_pagamento';
  const variaveis = ES.varsDoModelo(t, null).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  return `-- Por Dentro — Estúdio de e-mails: o modelo "link_pagamento" (botão "Enviar link de pagamento", aba Plataforma da ficha)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql (e de crm-onboarding.sql). Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-link-pagamento.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, edite o modelo no
-- Estúdio de e-mails (cria versão nova) ou mude o gerador e gere de novo.
--
-- O modelo entra como se criado pelo "+ Modelo novo" (criado_no_estudio), tipo serviço (transacional: sem rodapé de
-- descadastro, não exige "novidades"), sem Envio automático, e a versão 1 já No ar: o botão da ficha só funciona com ela.
-- Dados do texto: {nome} e {link_pagamento}. O link vem do Worker (links-pagamento.json + e-mail e id da pessoa).
-- Um modelo "link_pagamento" que já existe não é tocado.
--
-- Como desfazer (só se ainda nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'link_pagamento';
--   delete from public.modelos_email where chave = 'link_pagamento' and not exists (select 1 from public.emails_enviados where modelo = 'link_pagamento');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave, para_quem)
values (${lit(t)}, 'Link de pagamento', 'Mandar o link de pagamento do plano combinado na chamada', ${lit(TIPO)},
  'Você envia pelo botão "Enviar link de pagamento", na aba Plataforma da ficha.', 'Todos',
  ${lit(JSON.stringify(variaveis))}::jsonb, 540, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select ${lit(t)}, 1, 'no_ar',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(BLOCOS))}::jsonb,
  'link de pagamento: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = ${lit(t)} and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(t)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-link-pagamento-email.sql'), gerar());
  console.log('crm-link-pagamento-email.sql gerado.');
}
