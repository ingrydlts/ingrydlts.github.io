-- Por Dentro — Estúdio de e-mails: o modelo "acesso_confirmado" (sai sozinho quando o Stripe confirma o pagamento)
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
values ('acesso_confirmado', 'Acesso confirmado', 'Avisar que o pagamento foi confirmado e dar o link para entrar e criar a senha', 'servico',
  'Sozinho, quando o Stripe confirma o pagamento (o Worker cria a conta e manda).', 'Quem acabou de pagar',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"link_entrada","o_que_e":"o link que entra direto no app, de uso único (vem do Worker, depois do pagamento)","se_faltar":"não sai"},{"nome":"fim_teste","o_que_e":"o dia em que acaba o teste grátis (DD/MM/AAAA), como o Stripe informou","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select 'acesso_confirmado', 1, 'no_ar',
  $acesso_confirmado_a${#nome}{nome}, o seu acesso ao Por Dentro está liberado{/nome}{^nome}O seu acesso ao Por Dentro está liberado{/nome}$acesso_confirmado_a$,
  $acesso_confirmado_p$Entre agora e crie a sua senha.$acesso_confirmado_p$,
  $acesso_confirmado_t${#nome}Oi {nome}! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.{/nome}{^nome}Oi! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.{/nome}

{#fim_teste}Teste grátis até: {fim_teste}
Depois dessa data, a cobrança do plano que você escolheu começa sozinha. Para cancelar antes, é só responder este e-mail.

{/fim_teste}Entrar no Por Dentro: {link_entrada}

O botão entra direto, e em seguida você cria a sua senha. Ele vale uma vez só. Se não abrir, vá em https://plataforma.imigrantepordentro.com/ e entre com este e-mail ({email}): chega um código de acesso.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro$acesso_confirmado_t$,
  $acesso_confirmado_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.{/nome}{^nome}Oi! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.{/nome}</p>
{#fim_teste}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Teste grátis até</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">{fim_teste}</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Depois dessa data, a cobrança do plano que você escolheu começa sozinha. Para cancelar antes, é só responder este e-mail.</div></td></tr></table>
{/fim_teste}<p style="margin:0 0 24px;"><a href="{link_entrada}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Entrar no Por Dentro</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">O botão entra direto, e em seguida você cria a sua senha. Ele vale uma vez só. Se não abrir, vá em <a href="https://plataforma.imigrantepordentro.com/" style="color:#577328;">https://plataforma.imigrantepordentro.com/</a> e entre com este e-mail ({email}): chega um código de acesso.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$acesso_confirmado_h$,
  $acesso_confirmado_b${"v":1,"planos":{},"assunto":"{nome}, o seu acesso ao Por Dentro está liberado","assunto_alt":"O seu acesso ao Por Dentro está liberado","pre":"Entre agora e crie a sua senha.","itens":[{"tipo":"texto","texto":"Oi {nome}! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado.","alt":"Oi! O seu pagamento foi confirmado e o seu acesso ao Por Dentro já está liberado."},{"tipo":"destaque","rotulo":"Teste grátis até","valor":"{fim_teste}","nota":"Depois dessa data, a cobrança do plano que você escolheu começa sozinha. Para cancelar antes, é só responder este e-mail."},{"tipo":"botao","rotulo":"Entrar no Por Dentro","link":"link_entrada"},{"tipo":"texto","estilo":"discreto","texto":"O botão entra direto, e em seguida você cria a sua senha. Ele vale uma vez só. Se não abrir, vá em https://plataforma.imigrantepordentro.com/ e entre com este e-mail ({email}): chega um código de acesso."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$acesso_confirmado_b$::jsonb,
  'acesso confirmado: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = 'acesso_confirmado' and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = 'acesso_confirmado');
