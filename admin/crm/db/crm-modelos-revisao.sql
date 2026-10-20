-- Por Dentro — Estúdio de e-mails: revisão de texto dos modelos (20/10/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-prontos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-revisao.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos. Não publica nada, não mexe em nenhuma versão que já existe (nem na No ar) e não liga nenhum Envio.
-- 19 modelos ganham uma versão nova em RASCUNHO, com a nota "revisão de texto 20/10/2026":
--   os 8 manuais (sem travessão, "para" no lugar de "pra", prévia e assunto sem nome),
--   Hub de Estudos (compra, D+3, lançamento), lembrete de prazo do VLS-TS (como validar na ANEF),
--   aquecimento D+3 (a pergunta de cada trilha) e D+6 ("desde 2023"), e o e-mail 2 do guia (só o português).
-- Ficam como estão: o e-mail 1 (cf_guia_1), o D+10 e o D+15 do aquecimento e o entrega_de_freebie.
--
-- Trava: um modelo só ganha a versão nova se a versão mais nova dele ainda for a que estava no banco em 20/10/2026.
-- Se você mudou o modelo no estúdio depois disso, ele é pulado (o seu texto fica). Também não cria de novo se já
-- existe uma versão com estes blocos ou uma versão com a nota desta revisão.
--
-- O que ainda falta antes de publicar: o [dica] do parouapp (manual: você troca na hora de enviar), o [link do presente CF09]
-- do aq_c_d10 e as 3 dúvidas dos D+15. O aquecimento só liga depois do filtro por etapa do guia.
--
-- Segurança: só textos dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota = 'revisão de texto 20/10/2026' and etapa in ('rascunho', 'revisao');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'boas_vindas', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'boas_vindas'), 'rascunho',
  $boas_vindas_a${#nome}{nome}, o seu link de acesso chegou{/nome}{^nome}O seu link de acesso chegou{/nome}$boas_vindas_a$,
  $boas_vindas_p$Sem senha: um clique e você entra.$boas_vindas_p$,
  $boas_vindas_t${#nome}{#persona}Oi {nome}! Aqui está o link do seu checklist de {persona}, já com os prazos reais.{/persona}{/nome}{^nome}Oi! Aqui está o link do seu checklist, já com os prazos reais.{/nome}{#nome}{^persona}Oi! Aqui está o link do seu checklist, já com os prazos reais.{/persona}{/nome}

Abrir o meu checklist: {link_acesso}

Não precisa de senha: é um clique e você já entra.

Ingryd · Por Dentro$boas_vindas_t$,
  $boas_vindas_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{#persona}Oi {nome}! Aqui está o link do seu checklist de {persona}, já com os prazos reais.{/persona}{/nome}{^nome}Oi! Aqui está o link do seu checklist, já com os prazos reais.{/nome}{#nome}{^persona}Oi! Aqui está o link do seu checklist, já com os prazos reais.{/persona}{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Não precisa de senha: é um clique e você já entra.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$boas_vindas_h$,
  $boas_vindas_b${"assunto":"{nome}, o seu link de acesso chegou","itens":[{"tipo":"texto","texto":"Oi {nome}! Aqui está o link do seu checklist de {persona}, já com os prazos reais.","alt":"Oi! Aqui está o link do seu checklist, já com os prazos reais."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Não precisa de senha: é um clique e você já entra."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O seu link de acesso chegou","pre":"Sem senha: um clique e você entra."}$boas_vindas_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'boas_vindas' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'boas_vindas' order by versao desc limit 1) = $boas_vindas_base${"assunto":"{nome}, seu link de acesso chegou","itens":[{"tipo":"texto","texto":"Oi {nome}! Aqui está o link pra ver o seu checklist de {persona}, já com prazos reais."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha — um clique e você já entra."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$boas_vindas_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'boas_vindas' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoabriu', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoabriu'), 'rascunho',
  $naoabriu_a${#nome}{nome}, o seu checklist continua aqui{/nome}{^nome}O seu checklist continua aqui{/nome}$naoabriu_a$,
  $naoabriu_p$Deixei o link de novo, caso o outro tenha se perdido.$naoabriu_p$,
  $naoabriu_t${#nome}Oi {nome}! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.{/nome}{^nome}Oi! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.{/nome}

Abrir o meu checklist: {link_acesso}

Se o e-mail anterior caiu no spam, marque como "não é spam" para não perder os próximos.

Ingryd · Por Dentro$naoabriu_t$,
  $naoabriu_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.{/nome}{^nome}Oi! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se o e-mail anterior caiu no spam, marque como &quot;não é spam&quot; para não perder os próximos.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$naoabriu_h$,
  $naoabriu_b${"assunto":"{nome}, o seu checklist continua aqui","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.","alt":"Oi! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se o e-mail anterior caiu no spam, marque como \"não é spam\" para não perder os próximos."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O seu checklist continua aqui","pre":"Deixei o link de novo, caso o outro tenha se perdido."}$naoabriu_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'naoabriu' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'naoabriu' order by versao desc limit 1) = $naoabriu_base${"assunto":"{nome}, isso ainda te interessa?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se caiu no spam, vale marcar como \"não é spam\" pra não perder os próximos."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoabriu_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoabriu' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoclicou', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoclicou'), 'rascunho',
  $naoclicou_a${#nome}{nome}, o que tem no seu checklist{/nome}{^nome}O que tem no seu checklist{/nome}$naoclicou_a$,
  $naoclicou_p$Os passos do seu caso, na ordem, com os prazos.$naoclicou_p$,
  $naoclicou_t${#nome}Oi {nome}! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.{/nome}{^nome}Oi! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.{/nome}

Ver o meu checklist: {link_acesso}

Qualquer dúvida, é só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$naoclicou_t$,
  $naoclicou_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.{/nome}{^nome}Oi! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Ver o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Qualquer dúvida, é só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$naoclicou_h$,
  $naoclicou_b${"assunto":"{nome}, o que tem no seu checklist","itens":[{"tipo":"texto","texto":"Oi {nome}! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.","alt":"Oi! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Qualquer dúvida, é só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O que tem no seu checklist","pre":"Os passos do seu caso, na ordem, com os prazos."}$naoclicou_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'naoclicou' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'naoclicou' order by versao desc limit 1) = $naoclicou_base${"assunto":"outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso","itens":[{"tipo":"texto","texto":"Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Qualquer dúvida, é só responder."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoclicou_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoclicou' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'cliquenaoapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'cliquenaoapp'), 'rascunho',
  $cliquenaoapp_a${#nome}{nome}, o seu link ainda funciona{/nome}{^nome}O seu link ainda funciona{/nome}$cliquenaoapp_a$,
  $cliquenaoapp_p$O acesso é sem senha: um clique só.$cliquenaoapp_p$,
  $cliquenaoapp_t${#nome}Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.{/nome}{^nome}Oi! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.{/nome}

Entrar no meu checklist: {link_acesso}

Se travou em alguma coisa, responda este e-mail e me conte. Eu ajudo.

Ingryd · Por Dentro$cliquenaoapp_t$,
  $cliquenaoapp_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.{/nome}{^nome}Oi! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Entrar no meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se travou em alguma coisa, responda este e-mail e me conte. Eu ajudo.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$cliquenaoapp_h$,
  $cliquenaoapp_b${"assunto":"{nome}, o seu link ainda funciona","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.","alt":"Oi! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se travou em alguma coisa, responda este e-mail e me conte. Eu ajudo."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O seu link ainda funciona","pre":"O acesso é sem senha: um clique só."}$cliquenaoapp_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'cliquenaoapp' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'cliquenaoapp' order by versao desc limit 1) = $cliquenaoapp_base${"assunto":"seu link ainda funciona, {nome}","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se travou em algo, me conta que eu ajudo."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$cliquenaoapp_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cliquenaoapp' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'parouapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'parouapp'), 'rascunho',
  $parouapp_a${#nome}{nome}, uma dica para o seu momento{/nome}{^nome}Uma dica para o seu momento{/nome}$parouapp_a$,
  $parouapp_p$Uma dica que não estava no seu checklist.$parouapp_p$,
  $parouapp_t${#nome}Oi {nome}! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]{/nome}{^nome}Oi! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]{/nome}

{#motivo}Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.

{/motivo}Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$parouapp_t$,
  $parouapp_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]{/nome}{^nome}Oi! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]{/nome}</p>
{#motivo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.</p>
{/motivo}<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$parouapp_h$,
  $parouapp_b${"assunto":"{nome}, uma dica para o seu momento","itens":[{"tipo":"texto","texto":"Oi {nome}! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]","alt":"Oi! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"Uma dica para o seu momento","pre":"Uma dica que não estava no seu checklist."}$parouapp_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'parouapp' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'parouapp' order by versao desc limit 1) = $parouapp_base${"assunto":"uma dica rápida pro seu caso","itens":[{"tipo":"texto","texto":"Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$parouapp_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'parouapp' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_chamada', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_chamada'), 'rascunho',
  $guia_chamada_a${#nome}{nome}, como está o seu VLS-TS?{/nome}{^nome}Como está o seu VLS-TS?{/nome}$guia_chamada_a$,
  $guia_chamada_p$Se travou em algum passo, eu olho o seu caso.$guia_chamada_p$,
  $guia_chamada_t${#nome}Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.{/nome}{^nome}Oi! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.{/nome}

{#prazo_vencido}{#prazo_limite}Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite}. Então vale agir logo.

{/prazo_limite}{/prazo_vencido}{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias).

{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida.

Escolher um horário: {link_agenda}&utm_source=email&utm_campaign=guia-chamada

Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$guia_chamada_t$,
  $guia_chamada_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.{/nome}{^nome}Oi! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.{/nome}</p>
{#prazo_vencido}{#prazo_limite}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite}. Então vale agir logo.</p>
{/prazo_limite}{/prazo_vencido}{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias).</p>
{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=guia-chamada" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_chamada_h$,
  $guia_chamada_b${"assunto":"{nome}, como está o seu VLS-TS?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.","alt":"Oi! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF."},{"tipo":"texto","se":"#prazo_vencido","texto":"Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite}. Então vale agir logo."},{"tipo":"texto","se":"#prazo_a_vencer","texto":"Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias)."},{"tipo":"texto","texto":"Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-chamada"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"Como está o seu VLS-TS?","pre":"Se travou em algum passo, eu olho o seu caso."}$guia_chamada_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'guia_chamada' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'guia_chamada' order by versao desc limit 1) = $guia_chamada_base${"assunto":"{nome}, como está o seu VLS-TS?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF."},{"tipo":"texto","se":"#prazo_vencido","texto":"Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo."},{"tipo":"texto","se":"#prazo_a_vencer","texto":"Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias)."},{"tipo":"texto","texto":"Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-chamada"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_chamada_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_chamada' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_plataforma', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_plataforma'), 'rascunho',
  $guia_plataforma_a${#nome}{nome}, quer testar a plataforma do Por Dentro?{/nome}{^nome}Quer testar a plataforma do Por Dentro?{/nome}$guia_plataforma_a$,
  $guia_plataforma_p$Checklist com prazos reais, em troca do seu feedback.$guia_plataforma_p$,
  $guia_plataforma_t${#nome}Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.{/nome}{^nome}Oi! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.{/nome}

Quero testar: {link_acesso}

É sem senha: um clique e você entra. Em troca, só peço a sua opinião sincera.

Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$guia_plataforma_t$,
  $guia_plataforma_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.{/nome}{^nome}Oi! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Quero testar</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">É sem senha: um clique e você entra. Em troca, só peço a sua opinião sincera.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_plataforma_h$,
  $guia_plataforma_b${"assunto":"{nome}, quer testar a plataforma do Por Dentro?","itens":[{"tipo":"texto","texto":"Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só.","alt":"Oi! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, para você acompanhar cada etapa do seu processo na França num lugar só."},{"tipo":"botao","rotulo":"Quero testar","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha: um clique e você entra. Em troca, só peço a sua opinião sincera."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"Quer testar a plataforma do Por Dentro?","pre":"Checklist com prazos reais, em troca do seu feedback."}$guia_plataforma_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'guia_plataforma' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'guia_plataforma' order by versao desc limit 1) = $guia_plataforma_base${"assunto":"{nome}, quer testar a plataforma do Por Dentro?","itens":[{"tipo":"texto","texto":"Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só."},{"tipo":"botao","rotulo":"Quero testar","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha, um clique e você entra. Em troca, só peço o seu feedback."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_plataforma_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_plataforma' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_alternancia', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_alternancia'), 'rascunho',
  $guia_alternancia_a${#nome}{nome}, o e-mail para a escola e o próximo passo{/nome}{^nome}O e-mail para a escola e o próximo passo{/nome}$guia_alternancia_a$,
  $guia_alternancia_p$O próximo passo para a sua etapa.$guia_alternancia_p$,
  $guia_alternancia_t${#nome}Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.{/nome}{^nome}Oi! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.{/nome}

{#etapa_pesquisando}Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá para fazer isso em poucos minutos olhando o seu histórico.

{/etapa_pesquisando}{#etapa_escolhendo_escola}Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, para não perder tempo com quem vai dizer "só até 29".

{/etapa_escolhendo_escola}{#etapa_recusa_idade}Você disse que já ouviu "só até 29" de uma escola. Esse "não" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente para pedir a resposta por escrito, com a base legal.

{/etapa_recusa_idade}{#etapa_buscando_empresa}Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro para empresa. Vale chegar nas conversas já com isso na mão.

{/etapa_buscando_empresa}{#etapa_montando_contrato}Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.

{/etapa_montando_contrato}Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/

E se quiser que eu olhe o seu caso antes de você escrever para escola, é só escolher um horário.

Escolher um horário: {link_agenda}&utm_source=email&utm_campaign=guia-alternancia

Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$guia_alternancia_t$,
  $guia_alternancia_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.{/nome}{^nome}Oi! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.{/nome}</p>
{#etapa_pesquisando}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá para fazer isso em poucos minutos olhando o seu histórico.</p>
{/etapa_pesquisando}{#etapa_escolhendo_escola}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, para não perder tempo com quem vai dizer &quot;só até 29&quot;.</p>
{/etapa_escolhendo_escola}{#etapa_recusa_idade}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já ouviu &quot;só até 29&quot; de uma escola. Esse &quot;não&quot; muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente para pedir a resposta por escrito, com a base legal.</p>
{/etapa_recusa_idade}{#etapa_buscando_empresa}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro para empresa. Vale chegar nas conversas já com isso na mão.</p>
{/etapa_buscando_empresa}{#etapa_montando_contrato}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.</p>
{/etapa_montando_contrato}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se quiser rever o modelo, ele continua aqui: <a href="https://imigrantepordentro.com/guias/email-alternancia-30-mais/" style="color:#577328;">https://imigrantepordentro.com/guias/email-alternancia-30-mais/</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E se quiser que eu olhe o seu caso antes de você escrever para escola, é só escolher um horário.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=guia-alternancia" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_alternancia_h$,
  $guia_alternancia_b${"assunto":"{nome}, o e-mail para a escola e o próximo passo","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.","alt":"Oi! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30."},{"tipo":"etapa","se":"#etapa_pesquisando","texto":"Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá para fazer isso em poucos minutos olhando o seu histórico."},{"tipo":"etapa","se":"#etapa_escolhendo_escola","texto":"Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, para não perder tempo com quem vai dizer \"só até 29\"."},{"tipo":"etapa","se":"#etapa_recusa_idade","texto":"Você disse que já ouviu \"só até 29\" de uma escola. Esse \"não\" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente para pedir a resposta por escrito, com a base legal."},{"tipo":"etapa","se":"#etapa_buscando_empresa","texto":"Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro para empresa. Vale chegar nas conversas já com isso na mão."},{"tipo":"etapa","se":"#etapa_montando_contrato","texto":"Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar."},{"tipo":"texto","texto":"Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/"},{"tipo":"texto","texto":"E se quiser que eu olhe o seu caso antes de você escrever para escola, é só escolher um horário."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-alternancia"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O e-mail para a escola e o próximo passo","pre":"O próximo passo para a sua etapa."}$guia_alternancia_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'guia_alternancia' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'guia_alternancia' order by versao desc limit 1) = $guia_alternancia_base${"assunto":"{nome}, o e-mail para a escola e o próximo passo","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30."},{"tipo":"etapa","se":"#etapa_pesquisando","texto":"Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico."},{"tipo":"etapa","se":"#etapa_escolhendo_escola","texto":"Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer \"só até 29\"."},{"tipo":"etapa","se":"#etapa_recusa_idade","texto":"Você disse que já ouviu \"só até 29\" de uma escola. Esse \"não\" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal."},{"tipo":"etapa","se":"#etapa_buscando_empresa","texto":"Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão."},{"tipo":"etapa","se":"#etapa_montando_contrato","texto":"Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar."},{"tipo":"texto","texto":"Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/"},{"tipo":"texto","texto":"E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-alternancia"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_alternancia_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_alternancia' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_compra', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'hub_estudos_compra'), 'rascunho',
  $hub_estudos_compra_a${#nome}{#produto}{nome}, o seu {produto} chegou{/produto}{/nome}{^nome}O seu {produto} chegou{/nome}{#nome}{^produto}O seu {produto} chegou{/produto}{/nome}$hub_estudos_compra_a$,
  $hub_estudos_compra_p$O link para guardar e os seus primeiros passos.$hub_estudos_compra_p$,
  $hub_estudos_compra_t${#nome}{nome}, a sua compra está confirmada{/nome}{^nome}A sua compra está confirmada{/nome}

{#produto}O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.

{/produto}{#produto}Abrir o {produto} no Notion: {link_produto}

{/produto}Seus primeiros passos
1. Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.
2. Cadastre as suas matérias e a grade de horários da semana.
3. Lance o primeiro prazo que você tem e veja ele aparecer na visão Hoje.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque comprou o {produto} no Por Dentro.$hub_estudos_compra_t$,
  $hub_estudos_compra_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">{#nome}{nome}, a sua compra está confirmada{/nome}{^nome}A sua compra está confirmada{/nome}</h1>
{#produto}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.</p>
{/produto}{#produto}<p style="margin:0 0 24px;"><a href="{link_produto}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o {produto} no Notion</a></p>
{/produto}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Seus primeiros passos</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>1.</b> Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.<br><b>2.</b> Cadastre as suas matérias e a grade de horários da semana.<br><b>3.</b> Lance o primeiro prazo que você tem e veja ele aparecer na visão Hoje.</div></td></tr></table>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque comprou o {produto} no Por Dentro.</td></tr>
</table></td></tr></table>
</body></html>$hub_estudos_compra_h$,
  $hub_estudos_compra_b${"assunto":"{nome}, o seu {produto} chegou","assunto_alt":"O seu {produto} chegou","pre":"O link para guardar e os seus primeiros passos.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"{nome}, a sua compra está confirmada","alt":"A sua compra está confirmada"},{"tipo":"texto","texto":"O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular."},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"destaque","rotulo":"Seus primeiros passos","valor":"**1.** Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.\n**2.** Cadastre as suas matérias e a grade de horários da semana.\n**3.** Lance o primeiro prazo que você tem e veja ele aparecer na visão Hoje."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_compra_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_compra' and tipo = 'compra')
  and (select blocos from public.modelos_email_versoes where chave = 'hub_estudos_compra' order by versao desc limit 1) = $hub_estudos_compra_base${"assunto":"{nome}, o seu {produto} chegou","assunto_alt":"O seu {produto} chegou","pre":"O link para guardar e os seus primeiros passos.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"{nome}, a sua compra está confirmada","alt":"A sua compra está confirmada"},{"tipo":"texto","texto":"O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular."},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"destaque","rotulo":"Seus primeiros passos","valor":"**1.** Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.\n**2.** Cadastre as suas matérias e a grade de horários da semana.\n**3.** Lance o primeiro prazo que você tem e abra a visão Hoje."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_compra_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_compra' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_d3', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'hub_estudos_d3'), 'rascunho',
  $hub_estudos_d3_a${#nome}{#produto}{nome}, como está o seu {produto}?{/produto}{/nome}{^nome}Como está o seu {produto}?{/nome}{#nome}{^produto}Como está o seu {produto}?{/produto}{/nome}$hub_estudos_d3_a$,
  $hub_estudos_d3_p$As cinco visões e qual abrir primeiro.$hub_estudos_d3_p$,
  $hub_estudos_d3_t$Uma aba só para saber o que fazer primeiro

{#nome}{#produto}Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/produto}{/nome}{^nome}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/nome}{#nome}{^produto}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/produto}{/nome}

As cinco visões
Hoje · o que vence hoje
Em atraso · o que passou do prazo
Deadline próxima · o que vence nos próximos dias
Timeline · o semestre inteiro numa linha
Essa semana · a sua semana, matéria por matéria
Se for abrir uma só, abra a Hoje, todo dia de manhã.

Ainda não duplicou? O link continua aqui:

{#produto}Abrir o {produto} no Notion: {link_produto}

{/produto}O que mais te atrapalha para estudar hoje?
Me conte em uma frase. É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque comprou o {produto} no Por Dentro.$hub_estudos_d3_t$,
  $hub_estudos_d3_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Uma aba só para saber o que fazer primeiro</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{#produto}Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/produto}{/nome}{^nome}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/nome}{#nome}{^produto}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.{/produto}{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">As cinco visões</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>Hoje</b> · o que vence hoje<br><b>Em atraso</b> · o que passou do prazo<br><b>Deadline próxima</b> · o que vence nos próximos dias<br><b>Timeline</b> · o semestre inteiro numa linha<br><b>Essa semana</b> · a sua semana, matéria por matéria</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se for abrir uma só, abra a Hoje, todo dia de manhã.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Ainda não duplicou? O link continua aqui:</p>
{#produto}<p style="margin:0 0 24px;"><a href="{link_produto}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o {produto} no Notion</a></p>
{/produto}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que mais te atrapalha para estudar hoje?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte em uma frase. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque comprou o {produto} no Por Dentro.</td></tr>
</table></td></tr></table>
</body></html>$hub_estudos_d3_h$,
  $hub_estudos_d3_b${"assunto":"{nome}, como está o seu {produto}?","assunto_alt":"Como está o seu {produto}?","pre":"As cinco visões e qual abrir primeiro.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"Uma aba só para saber o que fazer primeiro"},{"tipo":"texto","texto":"Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia.","alt":"Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é criar o hábito de abrir uma visão por dia."},{"tipo":"destaque","rotulo":"As cinco visões","valor":"**Hoje** · o que vence hoje\n**Em atraso** · o que passou do prazo\n**Deadline próxima** · o que vence nos próximos dias\n**Timeline** · o semestre inteiro numa linha\n**Essa semana** · a sua semana, matéria por matéria","nota":"Se for abrir uma só, abra a Hoje, todo dia de manhã."},{"tipo":"texto","texto":"Ainda não duplicou? O link continua aqui:"},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"pergunta","texto":"O que mais te atrapalha para estudar hoje?","ajuda":"Me conte em uma frase. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_d3_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_d3' and tipo = 'compra')
  and (select blocos from public.modelos_email_versoes where chave = 'hub_estudos_d3' order by versao desc limit 1) = $hub_estudos_d3_base${"assunto":"{nome}, como está o seu {produto}?","assunto_alt":"Como está o seu {produto}?","pre":"As cinco visões e qual abrir primeiro.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"Uma aba só para saber o que fazer primeiro"},{"tipo":"texto","texto":"Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.","alt":"Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você."},{"tipo":"destaque","rotulo":"As cinco visões","valor":"**Hoje** · o que vence hoje\n**Em atraso** · o que passou do prazo\n**Deadline próxima** · o que vence nos próximos dias\n**Timeline** · o semestre inteiro numa linha\n**Essa semana** · a sua semana, matéria por matéria","nota":"Se for abrir uma só, abra a Hoje, todo dia de manhã."},{"tipo":"texto","texto":"Ainda não duplicou? O link continua aqui:"},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"pergunta","texto":"O que mais te atrapalha para estudar hoje?","ajuda":"Me conte em uma frase. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_d3_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_d3' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_lancamento', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'hub_estudos_lancamento'), 'rascunho',
  $hub_estudos_lancamento_a${#nome}{nome}, a matéria num app, o prazo em outro?{/nome}{^nome}A matéria num app, o prazo em outro?{/nome}$hub_estudos_lancamento_a$,
  $hub_estudos_lancamento_p$O Hub de Estudos junta tudo no Notion.$hub_estudos_lancamento_p$,
  $hub_estudos_lancamento_t$Matérias, aulas e prazos numa aba só

{#nome}Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}{^nome}Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}

O que tem no Hub de Estudos
Matérias, cronograma de aulas e a grade de horários da semana
Projetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana
Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular.

Foi pensado para quem faz um master, mas serve para qualquer curso: é só trocar as matérias.

Para ver tudo o que tem dentro: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos

Ficou com dúvida antes de comprar? É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$hub_estudos_lancamento_t$,
  $hub_estudos_lancamento_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Matérias, aulas e prazos numa aba só</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}{^nome}Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O que tem no Hub de Estudos</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Matérias, cronograma de aulas e a grade de horários da semana<br>Projetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Foi pensado para quem faz um master, mas serve para qualquer curso: é só trocar as matérias.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Para ver tudo o que tem dentro: <a href="https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos" style="color:#577328;">https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Ficou com dúvida antes de comprar? É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$hub_estudos_lancamento_h$,
  $hub_estudos_lancamento_b${"assunto":"{nome}, a matéria num app, o prazo em outro?","assunto_alt":"A matéria num app, o prazo em outro?","pre":"O Hub de Estudos junta tudo no Notion.","itens":[{"tipo":"titulo","texto":"Matérias, aulas e prazos numa aba só"},{"tipo":"texto","texto":"Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.","alt":"Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo."},{"tipo":"destaque","rotulo":"O que tem no Hub de Estudos","valor":"Matérias, cronograma de aulas e a grade de horários da semana\nProjetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana","nota":"Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular."},{"tipo":"texto","texto":"Foi pensado para quem faz um master, mas serve para qualquer curso: é só trocar as matérias."},{"tipo":"texto","texto":"Para ver tudo o que tem dentro: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos"},{"tipo":"texto","estilo":"discreto","texto":"Ficou com dúvida antes de comprar? É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_lancamento_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_lancamento' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'hub_estudos_lancamento' order by versao desc limit 1) = $hub_estudos_lancamento_base${"assunto":"{nome}, a matéria num app, o prazo em outro?","assunto_alt":"A matéria num app, o prazo em outro?","pre":"O Hub de Estudos junta tudo no Notion.","itens":[{"tipo":"titulo","texto":"Matérias, cronograma e prazos numa aba só"},{"tipo":"texto","texto":"Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.","alt":"Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo."},{"tipo":"destaque","rotulo":"O que tem no Hub de Estudos","valor":"Matérias, cronograma de aulas e a grade de horários da semana\nProjetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana","nota":"Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular."},{"tipo":"texto","texto":"Foi pensado para quem faz um master, mas serve para qualquer curso: é só adaptar as matérias. Para conhecer: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos"},{"tipo":"texto","estilo":"discreto","texto":"Ficou com alguma dúvida antes de comprar? É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_lancamento_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_lancamento' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'lembrete_prazo_vlsts', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'lembrete_prazo_vlsts'), 'rascunho',
  $lembrete_prazo_vlsts_a${#nome}{nome}, o seu prazo do VLS-TS está chegando{/nome}{^nome}O seu prazo do VLS-TS está chegando{/nome}$lembrete_prazo_vlsts_a$,
  $lembrete_prazo_vlsts_p$O aviso que você pediu.$lembrete_prazo_vlsts_p$,
  $lembrete_prazo_vlsts_t${#nome}Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}{^nome}Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}

{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}O seu prazo: {prazo_limite}
Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF.

{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}{#prazo_vencido}{#prazo_limite}O seu prazo venceu em: {prazo_limite}
Se você ainda não validou, vale agir logo.

{/prazo_limite}{/prazo_vencido}Para validar, você entra no site da ANEF com o número do seu visto e paga a taxa online.

Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida.

Escolher um horário: {link_agenda}&utm_source=email&utm_campaign=lembrete-prazo

Ingryd · Por Dentro$lembrete_prazo_vlsts_t$,
  $lembrete_prazo_vlsts_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}{^nome}Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}</p>
{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O seu prazo</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">{prazo_limite}</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF.</div></td></tr></table>
{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}{#prazo_vencido}{#prazo_limite}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O seu prazo venceu em</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">{prazo_limite}</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se você ainda não validou, vale agir logo.</div></td></tr></table>
{/prazo_limite}{/prazo_vencido}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Para validar, você entra no site da ANEF com o número do seu visto e paga a taxa online.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=lembrete-prazo" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$lembrete_prazo_vlsts_h$,
  $lembrete_prazo_vlsts_b${"assunto":"{nome}, o seu prazo do VLS-TS está chegando","assunto_alt":"O seu prazo do VLS-TS está chegando","pre":"O aviso que você pediu.","itens":[{"tipo":"texto","texto":"Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.","alt":"Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS."},{"tipo":"destaque","se":"#prazo_a_vencer","rotulo":"O seu prazo","valor":"{prazo_limite}","nota":"Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF."},{"tipo":"destaque","se":"#prazo_vencido","rotulo":"O seu prazo venceu em","valor":"{prazo_limite}","nota":"Se você ainda não validou, vale agir logo."},{"tipo":"texto","texto":"Para validar, você entra no site da ANEF com o número do seu visto e paga a taxa online."},{"tipo":"texto","texto":"Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=lembrete-prazo"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$lembrete_prazo_vlsts_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'lembrete_prazo_vlsts' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'lembrete_prazo_vlsts' order by versao desc limit 1) = $lembrete_prazo_vlsts_base${"assunto":"{nome}, o seu prazo do VLS-TS está chegando","assunto_alt":"O seu prazo do VLS-TS está chegando","pre":"O aviso que você pediu.","itens":[{"tipo":"texto","texto":"Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.","alt":"Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS."},{"tipo":"destaque","se":"#prazo_a_vencer","rotulo":"O seu prazo","valor":"{prazo_limite}","nota":"Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF."},{"tipo":"destaque","se":"#prazo_vencido","rotulo":"O seu prazo venceu em","valor":"{prazo_limite}","nota":"Se você ainda não validou, vale agir logo."},{"tipo":"texto","texto":"Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=lembrete-prazo"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$lembrete_prazo_vlsts_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'lembrete_prazo_vlsts' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d3', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_a_d3'), 'rascunho',
  $aq_a_d3_a${#nome}{nome}, o prazo que não está no calendário{/nome}{^nome}O prazo que não está no calendário{/nome}$aq_a_d3_a$,
  $aq_a_d3_p$Alguns cursos fecham antes da data geral.$aq_a_d3_p$,
  $aq_a_d3_t$O prazo que vale é o menor

{#nome}Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}{^nome}Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}

A astúcia: Anote o prazo de cada curso
Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3).

{#prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.{/prazo_nivel}{^prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda.{/prazo_nivel}

Você já anotou o prazo dos seus cursos?
Responda sim ou ainda não. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_a_d3_t$,
  $aq_a_d3_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O prazo que vale é o menor</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}{^nome}Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Anote o prazo de cada curso</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3).</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.{/prazo_nivel}{^prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda.{/prazo_nivel}</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Você já anotou o prazo dos seus cursos?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda <b>sim</b> ou <b>ainda não</b>. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_a_d3_h$,
  $aq_a_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o prazo que não está no calendário","assunto_alt":"O prazo que não está no calendário","pre":"Alguns cursos fecham antes da data geral.","itens":[{"tipo":"titulo","texto":"O prazo que vale é o menor"},{"tipo":"texto","texto":"Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.","alt":"Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Anote o prazo de cada curso","nota":"Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3)."},{"tipo":"texto","texto":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.","alt":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda."},{"tipo":"pergunta","texto":"Você já anotou o prazo dos seus cursos?","ajuda":"Responda **sim** ou **ainda não**. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d3_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d3' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_a_d3' order by versao desc limit 1) = $aq_a_d3_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o prazo que não está no calendário","assunto_alt":"O prazo que não está no calendário","pre":"Alguns cursos fecham antes da data geral.","itens":[{"tipo":"titulo","texto":"O prazo que vale é o menor"},{"tipo":"texto","texto":"Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.","alt":"Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Anote o prazo de cada curso","nota":"Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3)."},{"tipo":"texto","texto":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.","alt":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d3_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d3' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d6', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_a_d6'), 'rascunho',
  $aq_a_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_a_d6_a$,
  $aq_a_d6_p$Por que eu entendo de burocracia francesa.$aq_a_d6_p$,
  $aq_a_d6_t$Oi, eu sou a Ingryd. Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.

{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}

Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.

A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.

O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.

Qual parte te tira o sono?
Responda com uma palavra: documentos, francês, curso ou dinheiro. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_a_d6_t$,
  $aq_a_d6_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
<td style="width:68px; vertical-align:middle;"><img src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>
<td style="padding-left:14px; vertical-align:middle;"><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">Oi, eu sou a Ingryd</div>
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Qual parte te tira o sono?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda com uma palavra: <b>documentos</b>, <b>francês</b>, <b>curso</b> ou <b>dinheiro</b>. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_a_d6_h$,
  $aq_a_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d6_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d6' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_a_d6' order by versao desc limit 1) = $aq_a_d6_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d6_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d6' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d3', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_b_d3'), 'rascunho',
  $aq_b_d3_a${#nome}{nome}, o documento que ainda não existe{/nome}{^nome}O documento que ainda não existe{/nome}$aq_b_d3_a$,
  $aq_b_d3_p$Ele não precisa travar o seu dossiê.$aq_b_d3_p$,
  $aq_b_d3_t$Documento que ainda não existe entra provisório

{#nome}Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}{^nome}Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}

A astúcia: Envie o provisório
O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo.

Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo.

Algum documento seu ainda não existe?
Me conte qual. É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_b_d3_t$,
  $aq_b_d3_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Documento que ainda não existe entra provisório</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}{^nome}Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Envie o provisório</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Algum documento seu ainda não existe?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte qual. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_b_d3_h$,
  $aq_b_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o documento que ainda não existe","assunto_alt":"O documento que ainda não existe","pre":"Ele não precisa travar o seu dossiê.","itens":[{"tipo":"titulo","texto":"Documento que ainda não existe entra provisório"},{"tipo":"texto","texto":"Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.","alt":"Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Envie o provisório","nota":"O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo."},{"tipo":"texto","texto":"Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo."},{"tipo":"pergunta","texto":"Algum documento seu ainda não existe?","ajuda":"Me conte qual. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d3_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d3' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_b_d3' order by versao desc limit 1) = $aq_b_d3_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o documento que ainda não existe","assunto_alt":"O documento que ainda não existe","pre":"Ele não precisa travar o seu dossiê.","itens":[{"tipo":"titulo","texto":"Documento que ainda não existe entra provisório"},{"tipo":"texto","texto":"Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.","alt":"Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Envie o provisório","nota":"O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo."},{"tipo":"texto","texto":"Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d3_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d3' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d6', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_b_d6'), 'rascunho',
  $aq_b_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_b_d6_a$,
  $aq_b_d6_p$Por que eu entendo de burocracia francesa.$aq_b_d6_p$,
  $aq_b_d6_t$Oi, eu sou a Ingryd. Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.

{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}

Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.

A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.

O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.

Qual parte te tira o sono?
Responda com uma palavra: documentos, francês, curso ou dinheiro. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_b_d6_t$,
  $aq_b_d6_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
<td style="width:68px; vertical-align:middle;"><img src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>
<td style="padding-left:14px; vertical-align:middle;"><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">Oi, eu sou a Ingryd</div>
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Qual parte te tira o sono?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda com uma palavra: <b>documentos</b>, <b>francês</b>, <b>curso</b> ou <b>dinheiro</b>. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_b_d6_h$,
  $aq_b_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d6_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d6' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_b_d6' order by versao desc limit 1) = $aq_b_d6_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d6_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d6' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d3', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_c_d3'), 'rascunho',
  $aq_c_d3_a${#nome}{nome}, o passo que destrava a verificação{/nome}{^nome}O passo que destrava a verificação{/nome}$aq_c_d3_a$,
  $aq_c_d3_p$Sem ele, o seu dossiê fica parado.$aq_c_d3_p$,
  $aq_c_d3_t$A verificação só começa depois do Pix declarado

{#nome}Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}{^nome}Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}

A astúcia: Declare o pagamento
A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5).

Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia.

Você já declarou o pagamento?
Responda sim ou ainda não. Se travou, me conte onde.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_c_d3_t$,
  $aq_c_d3_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">A verificação só começa depois do Pix declarado</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}{^nome}Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Declare o pagamento</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5).</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Você já declarou o pagamento?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda <b>sim</b> ou <b>ainda não</b>. Se travou, me conte onde.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_c_d3_h$,
  $aq_c_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o passo que destrava a verificação","assunto_alt":"O passo que destrava a verificação","pre":"Sem ele, o seu dossiê fica parado.","itens":[{"tipo":"titulo","texto":"A verificação só começa depois do Pix declarado"},{"tipo":"texto","texto":"Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.","alt":"Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Declare o pagamento","nota":"A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5)."},{"tipo":"texto","texto":"Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia."},{"tipo":"pergunta","texto":"Você já declarou o pagamento?","ajuda":"Responda **sim** ou **ainda não**. Se travou, me conte onde."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d3_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d3' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_c_d3' order by versao desc limit 1) = $aq_c_d3_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o passo que destrava a verificação","assunto_alt":"O passo que destrava a verificação","pre":"Sem ele, o seu dossiê fica parado.","itens":[{"tipo":"titulo","texto":"A verificação só começa depois do Pix declarado"},{"tipo":"texto","texto":"Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.","alt":"Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Declare o pagamento","nota":"A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5)."},{"tipo":"texto","texto":"Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d3_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d3' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d6', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'aq_c_d6'), 'rascunho',
  $aq_c_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_c_d6_a$,
  $aq_c_d6_p$Por que eu entendo de burocracia francesa.$aq_c_d6_p$,
  $aq_c_d6_t$Oi, eu sou a Ingryd. Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.

{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}

Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.

A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.

O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.

Qual parte te tira o sono?
Responda com uma palavra: documentos, francês, curso ou dinheiro. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_c_d6_t$,
  $aq_c_d6_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
<td style="width:68px; vertical-align:middle;"><img src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>
<td style="padding-left:14px; vertical-align:middle;"><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">Oi, eu sou a Ingryd</div>
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}{^nome}Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Qual parte te tira o sono?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda com uma palavra: <b>documentos</b>, <b>francês</b>, <b>curso</b> ou <b>dinheiro</b>. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_c_d6_h$,
  $aq_c_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d6_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d6' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'aq_c_d6' order by versao desc limit 1) = $aq_c_d6_base${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d6_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d6' and nota = 'revisão de texto 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'cf_guia_conversa', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'cf_guia_conversa'), 'rascunho',
  $cf_guia_conversa_a${#nome}{nome}, uma pergunta rápida{/nome}{^nome}Uma pergunta rápida{/nome}$cf_guia_conversa_a$,
  $cf_guia_conversa_p$Um toque e eu já sei para onde você vai.$cf_guia_conversa_p$,
  $cf_guia_conversa_t$Oi, eu sou a Ingryd. Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.

{#nome}{nome}, para qual cidade você quer ir?{/nome}{^nome}Para qual cidade você quer ir?{/nome}
Cada cidade aqui na França muda muito o custo de vida, e o meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências.

{botoes_cidade}

Se você responder este e-mail com os nomes das cidades que tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso.

Eu leio cada resposta ;)

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$cf_guia_conversa_t$,
  $cf_guia_conversa_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
<td style="width:68px; vertical-align:middle;"><img src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>
<td style="padding-left:14px; vertical-align:middle;"><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">Oi, eu sou a Ingryd</div>
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">{#nome}{nome}, para qual cidade você quer ir?{/nome}{^nome}Para qual cidade você quer ir?{/nome}</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Cada cidade aqui na França muda muito o custo de vida, e o meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências.</p>
<div style="margin:0 0 12px;">{botoes_cidade}</div>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Se você responder este e-mail com os nomes das cidades que tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso.<br><br>Eu leio cada resposta ;)</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$cf_guia_conversa_h$,
  $cf_guia_conversa_b${"v":1,"planos":{},"assunto":"{nome}, uma pergunta rápida","assunto_alt":"Uma pergunta rápida","pre":"Um toque e eu já sei para onde você vai.","rodape":"pediu o checklist Études en France com {email}","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"pergunta","texto":"{nome}, para qual cidade você quer ir?","alt":"Para qual cidade você quer ir?","ajuda":"Cada cidade aqui na França muda muito o custo de vida, e o meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências."},{"tipo":"toques","var":"botoes_cidade"},{"tipo":"texto","estilo":"discreto","texto":"Se você responder este e-mail com os nomes das cidades que tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso.\n\nEu leio cada resposta ;)"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$cf_guia_conversa_b$::jsonb,
  'revisão de texto 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'cf_guia_conversa' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'cf_guia_conversa' order by versao desc limit 1) = $cf_guia_conversa_base${"v":1,"planos":{},"assunto":"{nome}, uma pergunta rápida","assunto_alt":"Uma pergunta rápida","pre":"Um toque e eu já sei para onde você vai.","rodape":"pediu o checklist Études en France com {email}","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França desde 2023 e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"pergunta","texto":"{nome}, para qual cidade você quer ir?","alt":"Para qual cidade você quer ir?","ajuda":"Cada cidade aqui na França muda muito o custo de vida e meu trabalho aqui é te mostrar as possibilidades de acordo com as suas preferências "},{"tipo":"toques","var":"botoes_cidade"},{"tipo":"texto","estilo":"discreto","texto":"Se você responde esse email com os nomes das cidades que você tem em mente, eu posso te enviar comunicações personalizadas, com informações que importam para o seu caso. \n\nEu leio cada resposta ;)"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$cf_guia_conversa_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cf_guia_conversa' and nota = 'revisão de texto 20/10/2026');
