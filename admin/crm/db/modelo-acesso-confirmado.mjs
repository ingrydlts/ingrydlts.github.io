// Gera crm-acesso-email.sql: o modelo "acesso_confirmado" do Estúdio de e-mails (versão 1, No ar). Sai sozinho do Worker
// quando o Stripe confirma o pagamento: avisa que a conta existe e traz o link que entra direto no app (lá ela cria a senha).
// Rode: node admin/crm/db/modelo-acesso-confirmado.mjs   (o texto sai de ES.montar, o mesmo código do estúdio)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TIPO = 'servico';

export const BLOCOS = {
  v: 1, planos: {},
  assunto: '{nome}, o seu acesso ao Por Dentro está liberado', assunto_alt: 'O seu acesso ao Por Dentro está liberado',
  pre: 'Entre agora e crie a sua senha.',
  itens: [
    { tipo: 'texto', texto: 'Oi {nome}! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.', alt: 'Oi! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.' },
    { tipo: 'destaque', rotulo: 'Teste grátis até', valor: '{fim_teste}', nota: 'Depois dessa data, a cobrança do plano que você escolheu começa sozinha. Para cancelar antes, é só responder este e-mail.' },
    { tipo: 'botao', rotulo: 'Entrar no Por Dentro', link: 'link_entrada' },
    { tipo: 'texto', estilo: 'discreto', texto: 'O botão entra direto, e em seguida você cria a sua senha. Ele vale uma vez só. Se não abrir, vá em https://plataforma.imigrantepordentro.com/ e entre com este e-mail ({email}): chega um código de acesso.' },
    { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' },
    { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";

export function gerar() {
  const mt = ES.montar(BLOCOS, TIPO), t = 'acesso_confirmado';
  const variaveis = ES.varsDoModelo(t, null).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  return `-- Por Dentro — Estúdio de e-mails: o modelo "acesso_confirmado" (sai sozinho quando o Stripe confirma o pagamento)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql (e de crm-assinaturas.sql). Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-acesso-confirmado.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, edite o modelo
-- no Estúdio de e-mails (cria versão nova e publica) ou mude o gerador e gere de novo.
--
-- Modelo criado no estúdio (criado_no_estudio), tipo serviço (transacional: a pessoa acabou de pagar; sem rodapé de descadastro),
-- versão 1 já No ar: o webhook (Worker, /api/stripe/webhook) lê esta versão a cada pagamento novo. Sem versão No ar o webhook
-- falha com mensagem clara e o Stripe tenta de novo. Dados do texto: {nome}, {email}, {link_entrada} e {fim_teste}.
-- Os links de entrada são de uso único e NÃO ficam guardados no histórico de e-mails.
-- Como o Worker é quem envia, este modelo não aparece em "Escrever e-mail" nem tem Envio por sequência.
--
-- Como desfazer (só se ainda nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'acesso_confirmado';
--   delete from public.modelos_email where chave = 'acesso_confirmado' and not exists (select 1 from public.emails_enviados where modelo = 'acesso_confirmado');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave, para_quem)
values (${lit(t)}, 'Acesso confirmado', 'Avisar que o pagamento foi confirmado e dar o link para entrar e criar a senha', ${lit(TIPO)},
  'Sozinho, quando o Stripe confirma o pagamento (o Worker cria a conta e manda).', 'Quem acabou de pagar',
  ${lit(JSON.stringify(variaveis))}::jsonb, 541, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select ${lit(t)}, 1, 'no_ar',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(BLOCOS))}::jsonb,
  'acesso confirmado: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = ${lit(t)} and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(t)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-acesso-email.sql'), gerar());
  console.log('crm-acesso-email.sql gerado.');
}
