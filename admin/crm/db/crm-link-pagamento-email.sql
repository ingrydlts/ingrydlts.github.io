-- Por Dentro — Estúdio de e-mails: o modelo "link_pagamento" (botão "Enviar link de pagamento", aba Plataforma da ficha)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql (e de crm-onboarding.sql). Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-link-pagamento.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, edite o modelo no
-- Estúdio de e-mails (cria versão nova) ou mude o gerador e gere de novo.
--
-- O modelo entra como se criado pelo "+ Modelo novo" (criado_no_estudio), tipo serviço (transacional: sem rodapé de
-- descadastro, não exige "novidades"), sem Envio automático, e a versão 1 já No ar: o botão da ficha só funciona com ela.
-- Dados do texto: {nome} e {link_pagamento}. O link vem do Worker (planos/planos.json + e-mail e id da pessoa).
-- Um modelo "link_pagamento" que já existe não é tocado.
--
-- Como desfazer (só se ainda nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'link_pagamento';
--   delete from public.modelos_email where chave = 'link_pagamento' and not exists (select 1 from public.emails_enviados where modelo = 'link_pagamento');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave, para_quem)
values ('link_pagamento', 'Link de pagamento', 'Mandar o link de pagamento do plano combinado na chamada', 'servico',
  'Você envia pelo botão "Enviar link de pagamento", na aba Plataforma da ficha.', 'Todos',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"link_pagamento","o_que_e":"o link de pagamento do plano (Stripe), com o e-mail dela já preenchido (vem do Worker)","se_faltar":"não sai"}]'::jsonb, 540, true, 'boas_vindas', '{}'::jsonb)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select 'link_pagamento', 1, 'no_ar',
  $link_pagamento_a${#nome}{nome}, o seu link de pagamento chegou{/nome}{^nome}O seu link de pagamento chegou{/nome}$link_pagamento_a$,
  $link_pagamento_p$É só escolher a forma de pagamento e concluir.$link_pagamento_p$,
  $link_pagamento_t${#nome}Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}{^nome}Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}

Escolher o meu plano: {link_pagamento}

O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro$link_pagamento_t$,
  $link_pagamento_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}{^nome}Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_pagamento}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher o meu plano</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$link_pagamento_h$,
  $link_pagamento_b${"v":1,"planos":{},"assunto":"{nome}, o seu link de pagamento chegou","assunto_alt":"O seu link de pagamento chegou","pre":"É só escolher a forma de pagamento e concluir.","itens":[{"tipo":"texto","texto":"Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.","alt":"Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento."},{"tipo":"botao","rotulo":"Escolher o meu plano","link":"link_pagamento"},{"tipo":"texto","estilo":"discreto","texto":"O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$link_pagamento_b$::jsonb,
  'link de pagamento: versão inicial', now()
where exists (select 1 from public.modelos_email where chave = 'link_pagamento' and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = 'link_pagamento');

-- Quem rodou a versão anterior deste arquivo (o texto falava de "o plano que combinamos", para um Payment Link de um plano só) ganha a
-- versão 2, com o texto da página de escolha de planos. Só troca a versão 1 se ela continua do jeito que veio daqui: quem já editou o
-- texto no Estúdio não é tocado. A versão 1 fica arquivada (o histórico de quem recebeu continua mostrando o que saiu).
update public.modelos_email_versoes set etapa = 'arquivado'
 where chave = 'link_pagamento' and versao = 1 and etapa = 'no_ar' and nota = 'link de pagamento: versão inicial'
   and corpo_texto <> $link_pagamento_t2${#nome}Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}{^nome}Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}

Escolher o meu plano: {link_pagamento}

O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro$link_pagamento_t2$;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select 'link_pagamento', 2, 'no_ar',
  $link_pagamento_a2${#nome}{nome}, o seu link de pagamento chegou{/nome}{^nome}O seu link de pagamento chegou{/nome}$link_pagamento_a2$,
  $link_pagamento_p2$É só escolher a forma de pagamento e concluir.$link_pagamento_p2$,
  $link_pagamento_t3${#nome}Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}{^nome}Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}

Escolher o meu plano: {link_pagamento}

O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro$link_pagamento_t3$,
  $link_pagamento_h2$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}{^nome}Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_pagamento}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher o meu plano</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$link_pagamento_h2$,
  $link_pagamento_b2${"v":1,"planos":{},"assunto":"{nome}, o seu link de pagamento chegou","assunto_alt":"O seu link de pagamento chegou","pre":"É só escolher a forma de pagamento e concluir.","itens":[{"tipo":"texto","texto":"Oi {nome}! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento.","alt":"Oi! Foi um prazer conversar com você. Aqui está o seu link para escolher o plano que combina com você e concluir o pagamento."},{"tipo":"botao","rotulo":"Escolher o meu plano","link":"link_pagamento"},{"tipo":"texto","estilo":"discreto","texto":"O pagamento é feito no ambiente seguro do Stripe. O seu e-mail já vem preenchido na página."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$link_pagamento_b2$::jsonb,
  'link de pagamento: texto da página de planos', now()
where exists (select 1 from public.modelos_email_versoes where chave = 'link_pagamento' and versao = 1 and etapa = 'arquivado' and nota = 'link de pagamento: versão inicial')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'link_pagamento' and versao = 2);
