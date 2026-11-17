-- Por Dentro — Estúdio de e-mails: o modelo "chat_aviso" (sai sozinho quando a Ingryd escreve no chat do app)
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
values ('chat_aviso', 'Nova mensagem no chat', 'Avisar que a Ingryd escreveu no chat do app e levar a pessoa para entrar (e-mail e senha)', 'servico',
  'Sozinho, a cada mensagem ou proposta que a Ingryd manda pelo chat do app (o Worker manda).', 'Quem recebeu mensagem da Ingryd no chat',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"}]'::jsonb, 542, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select 'chat_aviso', 1, 'no_ar',
  $chat_aviso_a$Nova mensagem da Ingryd pra você$chat_aviso_a$,
  $chat_aviso_p$Entre na plataforma para conferir e responder.$chat_aviso_p$,
  $chat_aviso_t${#nome}Olá {nome}, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.{/nome}{^nome}Olá, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.{/nome}

Entrar na plataforma: {link_acesso}

Ingryd · Por Dentro$chat_aviso_t$,
  $chat_aviso_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Olá {nome}, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.{/nome}{^nome}Olá, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Entrar na plataforma</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$chat_aviso_h$,
  $chat_aviso_b${"v":1,"planos":{},"assunto":"Nova mensagem da Ingryd pra você","assunto_alt":"Nova mensagem da Ingryd pra você","pre":"Entre na plataforma para conferir e responder.","itens":[{"tipo":"texto","texto":"Olá {nome}, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma.","alt":"Olá, você recebeu uma nova mensagem da Ingryd. Para conferir e responder, clique no botão abaixo para entrar na plataforma."},{"tipo":"botao","rotulo":"Entrar na plataforma","link":"link_acesso"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$chat_aviso_b$::jsonb,
  'chat_aviso: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = 'chat_aviso' and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = 'chat_aviso');
