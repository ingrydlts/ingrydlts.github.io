// Gera crm-chat-aviso-email.sql: o modelo "chat_aviso" do Estúdio de e-mails (versão 1, No ar). Sai sozinho do Worker
// (POST /api/crm/chat-aviso) toda vez que a Ingryd escreve no chat do app: avisa que há mensagem nova e leva ao app (e-mail e senha).
// Rode: node admin/crm/db/modelo-chat-aviso.mjs   (o texto sai de ES.montar, o mesmo código do estúdio)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TIPO = 'servico';

export const BLOCOS = {
  v: 1, planos: {},
  assunto: 'Nova mensagem da Ingryd pra você', assunto_alt: 'Nova mensagem da Ingryd pra você',
  pre: 'Entre na plataforma para conferir e responder.',
  itens: [
    { tipo: 'texto', texto: 'Olá {nome}, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.', alt: 'Olá, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.' },
    { tipo: 'botao', rotulo: 'Entrar na plataforma', link: 'link_acesso' },
    { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' }
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";

export function gerar() {
  const mt = ES.montar(BLOCOS, TIPO), t = 'chat_aviso';
  const variaveis = ES.varsDoModelo(t, null).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  return `-- Por Dentro — Estúdio de e-mails: o modelo "chat_aviso" (sai sozinho quando a Ingryd escreve no chat do app)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-chat-aviso.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, edite o modelo
-- no Estúdio de e-mails (cria versão nova e publica) ou mude o gerador e gere de novo.
--
-- Modelo criado no estúdio (criado_no_estudio), tipo serviço (transacional: responde a uma conversa dela; sem rodapé de descadastro),
-- versão 1 já No ar: o Worker (POST /api/crm/chat-aviso) lê esta versão a cada mensagem sua. Sem versão No ar, ou se ela der
-- erro, sai o texto de reserva que está no próprio Worker (mesmo assunto e mesmo texto). Dados: {nome}, {email} e {link_acesso}.
-- Não leva o conteúdo da mensagem: ela lê tudo dentro do app. Não aparece em "Escrever e-mail" nem tem Envio por sequência.
--
-- Como desfazer (só se ainda nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'chat_aviso';
--   delete from public.modelos_email where chave = 'chat_aviso' and not exists (select 1 from public.emails_enviados where modelo = 'chat_aviso');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave, para_quem)
values (${lit(t)}, 'Nova mensagem no chat', 'Avisar que a Ingryd escreveu no chat do app e levar a pessoa para entrar (e-mail e senha)', ${lit(TIPO)},
  'Sozinho, a cada mensagem ou proposta que a Ingryd manda pelo chat do app (o Worker manda).', 'Quem recebeu mensagem da Ingryd no chat',
  ${lit(JSON.stringify(variaveis))}::jsonb, 542, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select ${lit(t)}, 1, 'no_ar',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(BLOCOS))}::jsonb,
  'chat_aviso: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = ${lit(t)} and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(t)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-chat-aviso-email.sql'), gerar());
  console.log('crm-chat-aviso-email.sql gerado.');
}
