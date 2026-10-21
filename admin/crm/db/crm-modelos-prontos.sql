-- Por Dentro — Estúdio de e-mails: todos os modelos prontos para revisão (19/10/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-prontos.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos. Não publica nada, não mexe em nenhuma versão No ar e não liga nenhum Envio:
--   1. Os 8 modelos manuais e o e-mail 1 do guia Campus France (cf_guia_1) ganham uma versão nova em RASCUNHO com o
--      texto de hoje em blocos (com o desenho do Por Dentro). Se o modelo já tem uma versão com esses mesmos blocos
--      (por exemplo, a que o estúdio cria quando você clica em "Editar em versão nova"), nada é criado.
--      O e-mail 2 (cf_guia_conversa) já está No ar em blocos: fica como está.
--   2. Modelos novos, como se criados pelo "+ Modelo novo" (criado_no_estudio = true), cada um com a versão 1 em RASCUNHO
--      e o Envio DESLIGADO (o gatilho, os dias e a hora já vêm preenchidos; você liga depois de publicar):
--        Hub de Estudos · compra confirmada e primeiros passos (D+3)  (tipo compra, sequência depois da compra)
--        Lançamento · Hub de Estudos                                   (novidades, você envia pela ficha)
--        Lembrete de prazo · VLS-TS                                    (serviço, você envia pela ficha)
--        Aquecimento Campus France: 3 trilhas × D+3, D+6, D+10, D+15   (novidades, sequência depois do e-mail 2)
--      Um modelo novo que já existe com a mesma chave não é tocado.
--
-- O que ainda falta antes de publicar (o estúdio não deixa publicar um automático com [trecho entre colchetes]):
--   - aq_c_d10: o [link do presente CF09] (o presente ainda não existe).
--   - aq_a_d15, aq_b_d15, aq_c_d15: as 3 dúvidas que mais chegaram e o que você respondeu.
--   - parouapp continua com o [dica]: é manual, você troca na hora de enviar.
--   - O aquecimento separa as trilhas pela etapa do guia com crm-filtro-etapa.sql: rode ele antes de ligar o Envio,
--     senão todo mundo que pegou o guia recebe as três trilhas.
--
-- Segurança: só textos e regras dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes
--    where nota like 'modelos prontos 19/10/2026%' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m
--    where m.chave in ('hub_estudos_compra', 'hub_estudos_d3', 'hub_estudos_lancamento', 'lembrete_prazo_vlsts', 'aq_a_d3', 'aq_a_d6', 'aq_a_d10', 'aq_a_d15', 'aq_b_d3', 'aq_b_d6', 'aq_b_d10', 'aq_b_d15', 'aq_c_d3', 'aq_c_d6', 'aq_c_d10', 'aq_c_d15')
--      and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- ---------- 1. Os modelos de antes: uma versão nova em rascunho, com o texto de hoje em blocos ----------
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'boas_vindas', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'boas_vindas'), 'rascunho',
  $boas_vindas_a${nome}, seu link de acesso chegou$boas_vindas_a$,
  null,
  $boas_vindas_t$Oi {nome}! Aqui está o link pra ver o seu checklist de {#persona}{persona}{/persona}{^persona}checklist{/persona}, já com prazos reais.

Abrir o meu checklist: {link_acesso}

É sem senha — um clique e você já entra.

Ingryd · Por Dentro$boas_vindas_t$,
  $boas_vindas_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Aqui está o link pra ver o seu checklist de {#persona}{persona}{/persona}{^persona}checklist{/persona}, já com prazos reais.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">É sem senha — um clique e você já entra.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$boas_vindas_h$,
  $boas_vindas_b${"assunto":"{nome}, seu link de acesso chegou","itens":[{"tipo":"texto","texto":"Oi {nome}! Aqui está o link pra ver o seu checklist de {persona}, já com prazos reais."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha — um clique e você já entra."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$boas_vindas_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'boas_vindas')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'boas_vindas' and blocos = $boas_vindas_b${"assunto":"{nome}, seu link de acesso chegou","itens":[{"tipo":"texto","texto":"Oi {nome}! Aqui está o link pra ver o seu checklist de {persona}, já com prazos reais."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha — um clique e você já entra."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$boas_vindas_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoabriu', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoabriu'), 'rascunho',
  $naoabriu_a${nome}, isso ainda te interessa?$naoabriu_a$,
  null,
  $naoabriu_t$Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui.

Abrir o meu checklist: {link_acesso}

Se caiu no spam, vale marcar como "não é spam" pra não perder os próximos.

Ingryd · Por Dentro$naoabriu_t$,
  $naoabriu_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se caiu no spam, vale marcar como &quot;não é spam&quot; pra não perder os próximos.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$naoabriu_h$,
  $naoabriu_b${"assunto":"{nome}, isso ainda te interessa?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se caiu no spam, vale marcar como \"não é spam\" pra não perder os próximos."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoabriu_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'naoabriu')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoabriu' and blocos = $naoabriu_b${"assunto":"{nome}, isso ainda te interessa?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se caiu no spam, vale marcar como \"não é spam\" pra não perder os próximos."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoabriu_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoclicou', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoclicou'), 'rascunho',
  $naoclicou_a$outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso$naoclicou_a$,
  null,
  $naoclicou_t$Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist.

Ver o meu checklist: {link_acesso}

Qualquer dúvida, é só responder.

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Ver o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Qualquer dúvida, é só responder.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$naoclicou_h$,
  $naoclicou_b${"assunto":"outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso","itens":[{"tipo":"texto","texto":"Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Qualquer dúvida, é só responder."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoclicou_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'naoclicou')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoclicou' and blocos = $naoclicou_b${"assunto":"outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso","itens":[{"tipo":"texto","texto":"Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Qualquer dúvida, é só responder."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$naoclicou_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'cliquenaoapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'cliquenaoapp'), 'rascunho',
  $cliquenaoapp_a$seu link ainda funciona, {nome}$cliquenaoapp_a$,
  null,
  $cliquenaoapp_t$Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só.

Entrar no meu checklist: {link_acesso}

Se travou em algo, me conta que eu ajudo.

Ingryd · Por Dentro$cliquenaoapp_t$,
  $cliquenaoapp_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Entrar no meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se travou em algo, me conta que eu ajudo.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$cliquenaoapp_h$,
  $cliquenaoapp_b${"assunto":"seu link ainda funciona, {nome}","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se travou em algo, me conta que eu ajudo."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$cliquenaoapp_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'cliquenaoapp')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cliquenaoapp' and blocos = $cliquenaoapp_b${"assunto":"seu link ainda funciona, {nome}","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se travou em algo, me conta que eu ajudo."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$cliquenaoapp_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'parouapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'parouapp'), 'rascunho',
  $parouapp_a$uma dica rápida pro seu caso$parouapp_a$,
  null,
  $parouapp_t$Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]

{#motivo}Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa.

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]</p>
{#motivo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa.</p>
{/motivo}<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$parouapp_h$,
  $parouapp_b${"assunto":"uma dica rápida pro seu caso","itens":[{"tipo":"texto","texto":"Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$parouapp_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'parouapp')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'parouapp' and blocos = $parouapp_b${"assunto":"uma dica rápida pro seu caso","itens":[{"tipo":"texto","texto":"Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$parouapp_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_chamada', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_chamada'), 'rascunho',
  $guia_chamada_a${nome}, como está o seu VLS-TS?$guia_chamada_a$,
  null,
  $guia_chamada_t$Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.

{#prazo_vencido}{#prazo_limite}Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo.

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.</p>
{#prazo_vencido}{#prazo_limite}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo.</p>
{/prazo_limite}{/prazo_vencido}{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias).</p>
{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=guia-chamada" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_chamada_h$,
  $guia_chamada_b${"assunto":"{nome}, como está o seu VLS-TS?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF."},{"tipo":"texto","se":"#prazo_vencido","texto":"Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo."},{"tipo":"texto","se":"#prazo_a_vencer","texto":"Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias)."},{"tipo":"texto","texto":"Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-chamada"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_chamada_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'guia_chamada')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_chamada' and blocos = $guia_chamada_b${"assunto":"{nome}, como está o seu VLS-TS?","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF."},{"tipo":"texto","se":"#prazo_vencido","texto":"Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo."},{"tipo":"texto","se":"#prazo_a_vencer","texto":"Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias)."},{"tipo":"texto","texto":"Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-chamada"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_chamada_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_plataforma', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_plataforma'), 'rascunho',
  $guia_plataforma_a${nome}, quer testar a plataforma do Por Dentro?$guia_plataforma_a$,
  null,
  $guia_plataforma_t$Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só.

Quero testar: {link_acesso}

É sem senha, um clique e você entra. Em troca, só peço o seu feedback.

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Quero testar</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">É sem senha, um clique e você entra. Em troca, só peço o seu feedback.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_plataforma_h$,
  $guia_plataforma_b${"assunto":"{nome}, quer testar a plataforma do Por Dentro?","itens":[{"tipo":"texto","texto":"Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só."},{"tipo":"botao","rotulo":"Quero testar","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha, um clique e você entra. Em troca, só peço o seu feedback."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_plataforma_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'guia_plataforma')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_plataforma' and blocos = $guia_plataforma_b${"assunto":"{nome}, quer testar a plataforma do Por Dentro?","itens":[{"tipo":"texto","texto":"Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só."},{"tipo":"botao","rotulo":"Quero testar","link":"link_acesso"},{"tipo":"texto","texto":"É sem senha, um clique e você entra. Em troca, só peço o seu feedback."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_plataforma_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'guia_alternancia', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'guia_alternancia'), 'rascunho',
  $guia_alternancia_a${nome}, o e-mail para a escola e o próximo passo$guia_alternancia_a$,
  null,
  $guia_alternancia_t$Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.

{#etapa_pesquisando}Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico.

{/etapa_pesquisando}{#etapa_escolhendo_escola}Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer "só até 29".

{/etapa_escolhendo_escola}{#etapa_recusa_idade}Você disse que já ouviu "só até 29" de uma escola. Esse "não" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal.

{/etapa_recusa_idade}{#etapa_buscando_empresa}Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão.

{/etapa_buscando_empresa}{#etapa_montando_contrato}Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.

{/etapa_montando_contrato}Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/

E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário.

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.</p>
{#etapa_pesquisando}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico.</p>
{/etapa_pesquisando}{#etapa_escolhendo_escola}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer &quot;só até 29&quot;.</p>
{/etapa_escolhendo_escola}{#etapa_recusa_idade}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já ouviu &quot;só até 29&quot; de uma escola. Esse &quot;não&quot; muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal.</p>
{/etapa_recusa_idade}{#etapa_buscando_empresa}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão.</p>
{/etapa_buscando_empresa}{#etapa_montando_contrato}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.</p>
{/etapa_montando_contrato}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se quiser rever o modelo, ele continua aqui: <a href="https://imigrantepordentro.com/guias/email-alternancia-30-mais/" style="color:#577328;">https://imigrantepordentro.com/guias/email-alternancia-30-mais/</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=guia-alternancia" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$guia_alternancia_h$,
  $guia_alternancia_b${"assunto":"{nome}, o e-mail para a escola e o próximo passo","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30."},{"tipo":"etapa","se":"#etapa_pesquisando","texto":"Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico."},{"tipo":"etapa","se":"#etapa_escolhendo_escola","texto":"Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer \"só até 29\"."},{"tipo":"etapa","se":"#etapa_recusa_idade","texto":"Você disse que já ouviu \"só até 29\" de uma escola. Esse \"não\" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal."},{"tipo":"etapa","se":"#etapa_buscando_empresa","texto":"Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão."},{"tipo":"etapa","se":"#etapa_montando_contrato","texto":"Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar."},{"tipo":"texto","texto":"Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/"},{"tipo":"texto","texto":"E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-alternancia"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_alternancia_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'guia_alternancia')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_alternancia' and blocos = $guia_alternancia_b${"assunto":"{nome}, o e-mail para a escola e o próximo passo","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30."},{"tipo":"etapa","se":"#etapa_pesquisando","texto":"Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico."},{"tipo":"etapa","se":"#etapa_escolhendo_escola","texto":"Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer \"só até 29\"."},{"tipo":"etapa","se":"#etapa_recusa_idade","texto":"Você disse que já ouviu \"só até 29\" de uma escola. Esse \"não\" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal."},{"tipo":"etapa","se":"#etapa_buscando_empresa","texto":"Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão."},{"tipo":"etapa","se":"#etapa_montando_contrato","texto":"Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar."},{"tipo":"texto","texto":"Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/"},{"tipo":"texto","texto":"E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=guia-alternancia"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$guia_alternancia_b$::jsonb);

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'cf_guia_1', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'cf_guia_1'), 'rascunho',
  $cf_guia_1_a${#nome}{nome}, aqui está o seu checklist do Études en France{/nome}{^nome}Aqui está o seu checklist do Études en France{/nome}$cf_guia_1_a$,
  $cf_guia_1_p${#nivel}O link para guardar, o prazo do seu nível e o seu próximo passo.{/nivel}{^nivel}O link para guardar, os prazos e o seu próximo passo.{/nivel}$cf_guia_1_p$,
  $cf_guia_1_t${#nome}{nome}, o seu checklist está aqui{/nome}{^nome}O seu checklist está aqui{/nome}

Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.

Abrir o checklist no Notion: {link_checklist}

{#nivel}{#prazo_nivel}O prazo do seu nível · {nivel}: {prazo_nivel}
Se algum curso que você escolher tiver prazo próprio, vale o menor.

{/prazo_nivel}{/nivel}{^nivel}Prazos para submeter o dossiê · ciclo 2027-2028
14/12/2026 · 1º ano de Licence e Arquitetura
17/01/2027 · 2º e 3º ano de Licence, Licence Pro, Master e escolas
Se algum curso tiver prazo próprio, vale o menor.

{/nivel}{#etapa_nao_comecei}Para quem está na etapa que ainda não começou:
Comece pelo passo 1: o projeto de estudos.
Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista.

{/etapa_nao_comecei}{#etapa_escolhendo_curso}Para quem está na etapa que está escolhendo o curso:
Anote o prazo de cada curso que você escolher.
Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr.

{/etapa_escolhendo_curso}{#etapa_juntando_documentos}Para quem está na etapa que está juntando documentos, traduções e o teste:
Comece pelo que depende de outras pessoas.
Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027.

{/etapa_juntando_documentos}{#etapa_dossie_enviado}Para quem está na etapa que já enviou o dossiê:
Pague a taxa e declare o pagamento.
A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma.

{/etapa_dossie_enviado}{#etapa_entrevista_resposta}Para quem está na etapa que está esperando a entrevista ou a resposta:
Treine a entrevista em voz alta.
Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha.

{/etapa_entrevista_resposta}Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o checklist Études en France no Por Dentro com {email}.$cf_guia_1_t$,
  $cf_guia_1_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">{#nome}{nome}, o seu checklist está aqui{/nome}{^nome}O seu checklist está aqui{/nome}</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.</p>
<p style="margin:0 0 24px;"><a href="{link_checklist}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o checklist no Notion</a></p>
{#nivel}{#prazo_nivel}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O prazo do seu nível · {nivel}</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">{prazo_nivel}</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se algum curso que você escolher tiver prazo próprio, vale o menor.</div></td></tr></table>
{/prazo_nivel}{/nivel}{^nivel}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Prazos para submeter o dossiê · ciclo 2027-2028</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>14/12/2026</b> · 1º ano de Licence e Arquitetura<br><b>17/01/2027</b> · 2º e 3º ano de Licence, Licence Pro, Master e escolas</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se algum curso tiver prazo próprio, vale o menor.</div></td></tr></table>
{/nivel}{#etapa_nao_comecei}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que ainda não começou:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Comece pelo passo 1: o projeto de estudos.</b><br>Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista.</p>
{/etapa_nao_comecei}{#etapa_escolhendo_curso}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está escolhendo o curso:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Anote o prazo de cada curso que você escolher.</b><br>Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr.</p>
{/etapa_escolhendo_curso}{#etapa_juntando_documentos}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está juntando documentos, traduções e o teste:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Comece pelo que depende de outras pessoas.</b><br>Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027.</p>
{/etapa_juntando_documentos}{#etapa_dossie_enviado}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que já enviou o dossiê:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Pague a taxa e declare o pagamento.</b><br>A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma.</p>
{/etapa_dossie_enviado}{#etapa_entrevista_resposta}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está esperando a entrevista ou a resposta:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Treine a entrevista em voz alta.</b><br>Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha.</p>
{/etapa_entrevista_resposta}<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o checklist Études en France no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$cf_guia_1_h$,
  $cf_guia_1_b${"assunto":"{nome}, aqui está o seu checklist do Études en France","assunto_alt":"Aqui está o seu checklist do Études en France","pre":"{#nivel}O link para guardar, o prazo do seu nível e o seu próximo passo.{/nivel}{^nivel}O link para guardar, os prazos e o seu próximo passo.{/nivel}","rodape":"pediu o checklist Études en France no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"{nome}, o seu checklist está aqui","alt":"O seu checklist está aqui"},{"tipo":"texto","texto":"Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular."},{"tipo":"botao","rotulo":"Abrir o checklist no Notion","link":"link_checklist"},{"tipo":"destaque","se":"#nivel","rotulo":"O prazo do seu nível · {nivel}","valor":"{prazo_nivel}","nota":"Se algum curso que você escolher tiver prazo próprio, vale o menor."},{"tipo":"destaque","se":"^nivel","rotulo":"Prazos para submeter o dossiê · ciclo 2027-2028","valor":"**14/12/2026** · 1º ano de Licence e Arquitetura\n**17/01/2027** · 2º e 3º ano de Licence, Licence Pro, Master e escolas","nota":"Se algum curso tiver prazo próprio, vale o menor."},{"tipo":"etapa","se":"#etapa_nao_comecei","rotulo":"Para quem está na etapa que ainda não começou:","titulo":"Comece pelo passo 1: o projeto de estudos.","texto":"Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista."},{"tipo":"etapa","se":"#etapa_escolhendo_curso","rotulo":"Para quem está na etapa que está escolhendo o curso:","titulo":"Anote o prazo de cada curso que você escolher.","texto":"Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr."},{"tipo":"etapa","se":"#etapa_juntando_documentos","rotulo":"Para quem está na etapa que está juntando documentos, traduções e o teste:","titulo":"Comece pelo que depende de outras pessoas.","texto":"Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027."},{"tipo":"etapa","se":"#etapa_dossie_enviado","rotulo":"Para quem está na etapa que já enviou o dossiê:","titulo":"Pague a taxa e declare o pagamento.","texto":"A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma."},{"tipo":"etapa","se":"#etapa_entrevista_resposta","rotulo":"Para quem está na etapa que está esperando a entrevista ou a resposta:","titulo":"Treine a entrevista em voz alta.","texto":"Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$cf_guia_1_b$::jsonb,
  'modelos prontos 19/10/2026: o texto de hoje, em blocos'
where exists (select 1 from public.modelos_email where chave = 'cf_guia_1')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cf_guia_1' and blocos = $cf_guia_1_b${"assunto":"{nome}, aqui está o seu checklist do Études en France","assunto_alt":"Aqui está o seu checklist do Études en France","pre":"{#nivel}O link para guardar, o prazo do seu nível e o seu próximo passo.{/nivel}{^nivel}O link para guardar, os prazos e o seu próximo passo.{/nivel}","rodape":"pediu o checklist Études en France no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"{nome}, o seu checklist está aqui","alt":"O seu checklist está aqui"},{"tipo":"texto","texto":"Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular."},{"tipo":"botao","rotulo":"Abrir o checklist no Notion","link":"link_checklist"},{"tipo":"destaque","se":"#nivel","rotulo":"O prazo do seu nível · {nivel}","valor":"{prazo_nivel}","nota":"Se algum curso que você escolher tiver prazo próprio, vale o menor."},{"tipo":"destaque","se":"^nivel","rotulo":"Prazos para submeter o dossiê · ciclo 2027-2028","valor":"**14/12/2026** · 1º ano de Licence e Arquitetura\n**17/01/2027** · 2º e 3º ano de Licence, Licence Pro, Master e escolas","nota":"Se algum curso tiver prazo próprio, vale o menor."},{"tipo":"etapa","se":"#etapa_nao_comecei","rotulo":"Para quem está na etapa que ainda não começou:","titulo":"Comece pelo passo 1: o projeto de estudos.","texto":"Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista."},{"tipo":"etapa","se":"#etapa_escolhendo_curso","rotulo":"Para quem está na etapa que está escolhendo o curso:","titulo":"Anote o prazo de cada curso que você escolher.","texto":"Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr."},{"tipo":"etapa","se":"#etapa_juntando_documentos","rotulo":"Para quem está na etapa que está juntando documentos, traduções e o teste:","titulo":"Comece pelo que depende de outras pessoas.","texto":"Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027."},{"tipo":"etapa","se":"#etapa_dossie_enviado","rotulo":"Para quem está na etapa que já enviou o dossiê:","titulo":"Pague a taxa e declare o pagamento.","texto":"A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma."},{"tipo":"etapa","se":"#etapa_entrevista_resposta","rotulo":"Para quem está na etapa que está esperando a entrevista ou a resposta:","titulo":"Treine a entrevista em voz alta.","texto":"Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$cf_guia_1_b$::jsonb);

-- ---------- 2. Os modelos novos (Envio desligado) e a versão 1 de cada um, em rascunho ----------
insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('hub_estudos_compra', 'Hub de Estudos · compra confirmada', 'Compra confirmada: Acesso, primeiros passos e onde tirar dúvida.', 'compra',
  'Sozinho, pela parte Envio (sequência).', 'comprou Hub de Estudos',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"produto","o_que_e":"o nome do produto que ela comprou","se_faltar":"o bloco some"},{"nome":"link_produto","o_que_e":"o link de acesso do produto (privado, vem do Worker)","se_faltar":"não sai"}]'::jsonb, 510, true, 'compra', '{"produto":"hub-de-estudos","produto_nome":"Hub de Estudos"}'::jsonb,
  'compra', 'hub-de-estudos', 0, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_compra', 1, 'rascunho',
  $hub_estudos_compra_a${#nome}{#produto}{nome}, o seu {produto} chegou{/produto}{/nome}{^nome}O seu {produto} chegou{/nome}{#nome}{^produto}O seu {produto} chegou{/produto}{/nome}$hub_estudos_compra_a$,
  $hub_estudos_compra_p$O link para guardar e os seus primeiros passos.$hub_estudos_compra_p$,
  $hub_estudos_compra_t${#nome}{nome}, a sua compra está confirmada{/nome}{^nome}A sua compra está confirmada{/nome}

{#produto}O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.

{/produto}{#produto}Abrir o {produto} no Notion: {link_produto}

{/produto}Seus primeiros passos
1. Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.
2. Cadastre as suas matérias e a grade de horários da semana.
3. Lance o primeiro prazo que você tem e abra a visão Hoje.

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
{/produto}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Seus primeiros passos</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>1.</b> Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.<br><b>2.</b> Cadastre as suas matérias e a grade de horários da semana.<br><b>3.</b> Lance o primeiro prazo que você tem e abra a visão Hoje.</div></td></tr></table>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque comprou o {produto} no Por Dentro.</td></tr>
</table></td></tr></table>
</body></html>$hub_estudos_compra_h$,
  $hub_estudos_compra_b${"assunto":"{nome}, o seu {produto} chegou","assunto_alt":"O seu {produto} chegou","pre":"O link para guardar e os seus primeiros passos.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"{nome}, a sua compra está confirmada","alt":"A sua compra está confirmada"},{"tipo":"texto","texto":"O {produto} já é seu. Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular."},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"destaque","rotulo":"Seus primeiros passos","valor":"**1.** Abra o link e toque em Duplicar: a cópia fica na sua conta do Notion, e funciona no plano gratuito.\n**2.** Cadastre as suas matérias e a grade de horários da semana.\n**3.** Lance o primeiro prazo que você tem e abra a visão Hoje."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_compra_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_compra' and criado_no_estudio and objetivo_chave = 'compra')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_compra');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('hub_estudos_d3', 'Hub de Estudos · primeiros passos (D+3)', 'Compra confirmada: Acesso, primeiros passos e onde tirar dúvida.', 'compra',
  'Sozinho, pela parte Envio (sequência).', 'comprou Hub de Estudos',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"produto","o_que_e":"o nome do produto que ela comprou","se_faltar":"o bloco some"},{"nome":"link_produto","o_que_e":"o link de acesso do produto (privado, vem do Worker)","se_faltar":"não sai"}]'::jsonb, 511, true, 'compra', '{"produto":"hub-de-estudos","produto_nome":"Hub de Estudos"}'::jsonb,
  'email', 'hub_estudos_compra', 3, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_d3', 1, 'rascunho',
  $hub_estudos_d3_a${#nome}{#produto}{nome}, como está o seu {produto}?{/produto}{/nome}{^nome}Como está o seu {produto}?{/nome}{#nome}{^produto}Como está o seu {produto}?{/produto}{/nome}$hub_estudos_d3_a$,
  $hub_estudos_d3_p$As cinco visões e qual abrir primeiro.$hub_estudos_d3_p$,
  $hub_estudos_d3_t$Uma aba só para saber o que fazer primeiro

{#nome}{#produto}Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/produto}{/nome}{^nome}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/nome}{#nome}{^produto}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/produto}{/nome}

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}{#produto}Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/produto}{/nome}{^nome}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/nome}{#nome}{^produto}Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.{/produto}{/nome}</p>
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
  $hub_estudos_d3_b${"assunto":"{nome}, como está o seu {produto}?","assunto_alt":"Como está o seu {produto}?","pre":"As cinco visões e qual abrir primeiro.","rodape":"comprou o {produto} no Por Dentro","itens":[{"tipo":"titulo","texto":"Uma aba só para saber o que fazer primeiro"},{"tipo":"texto","texto":"Oi {nome}! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você.","alt":"Oi! Já faz alguns dias que o {produto} é seu. Se você já duplicou e cadastrou as matérias, o próximo passo é deixar ele trabalhar por você."},{"tipo":"destaque","rotulo":"As cinco visões","valor":"**Hoje** · o que vence hoje\n**Em atraso** · o que passou do prazo\n**Deadline próxima** · o que vence nos próximos dias\n**Timeline** · o semestre inteiro numa linha\n**Essa semana** · a sua semana, matéria por matéria","nota":"Se for abrir uma só, abra a Hoje, todo dia de manhã."},{"tipo":"texto","texto":"Ainda não duplicou? O link continua aqui:"},{"tipo":"botao","rotulo":"Abrir o {produto} no Notion","link":"link_produto"},{"tipo":"pergunta","texto":"O que mais te atrapalha para estudar hoje?","ajuda":"Me conte em uma frase. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_d3_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_d3' and criado_no_estudio and objetivo_chave = 'compra')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_d3');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('hub_estudos_lancamento', 'Lançamento · Hub de Estudos', 'Lançamento e oferta: Apresentar um produto pago ou uma vaga de teste.', 'novidades',
  'Você envia, pela ficha.', 'aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 520, true, 'lancamento', '{}'::jsonb,
  null, null, null, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'hub_estudos_lancamento', 1, 'rascunho',
  $hub_estudos_lancamento_a${#nome}{nome}, a matéria num app, o prazo em outro?{/nome}{^nome}A matéria num app, o prazo em outro?{/nome}$hub_estudos_lancamento_a$,
  $hub_estudos_lancamento_p$O Hub de Estudos junta tudo no Notion.$hub_estudos_lancamento_p$,
  $hub_estudos_lancamento_t$Matérias, cronograma e prazos numa aba só

{#nome}Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}{^nome}Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}

O que tem no Hub de Estudos
Matérias, cronograma de aulas e a grade de horários da semana
Projetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana
Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular.

Foi pensado para quem faz um master, mas serve para qualquer curso: é só adaptar as matérias. Para conhecer: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos

Ficou com alguma dúvida antes de comprar? É só responder este e-mail.

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
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Matérias, cronograma e prazos numa aba só</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}{^nome}Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O que tem no Hub de Estudos</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Matérias, cronograma de aulas e a grade de horários da semana<br>Projetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Foi pensado para quem faz um master, mas serve para qualquer curso: é só adaptar as matérias. Para conhecer: <a href="https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos" style="color:#577328;">https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Ficou com alguma dúvida antes de comprar? É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$hub_estudos_lancamento_h$,
  $hub_estudos_lancamento_b${"assunto":"{nome}, a matéria num app, o prazo em outro?","assunto_alt":"A matéria num app, o prazo em outro?","pre":"O Hub de Estudos junta tudo no Notion.","itens":[{"tipo":"titulo","texto":"Matérias, cronograma e prazos numa aba só"},{"tipo":"texto","texto":"Oi {nome}! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo.","alt":"Oi! Quem estuda fora do Brasil costuma viver com a matéria num app, o prazo em outro e o material perdido no chat. Por isso eu montei no Notion um hub que junta tudo."},{"tipo":"destaque","rotulo":"O que tem no Hub de Estudos","valor":"Matérias, cronograma de aulas e a grade de horários da semana\nProjetos e atividades com as visões Hoje, Em atraso, Deadline próxima, Timeline e Essa semana","nota":"Compra única de € 14,90, sem assinatura. Funciona no Notion gratuito, no computador e no celular."},{"tipo":"texto","texto":"Foi pensado para quem faz um master, mas serve para qualquer curso: é só adaptar as matérias. Para conhecer: https://imigrantepordentro.com/produtos-digitais/produto/?slug=hub-de-estudos"},{"tipo":"texto","estilo":"discreto","texto":"Ficou com alguma dúvida antes de comprar? É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$hub_estudos_lancamento_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'hub_estudos_lancamento' and criado_no_estudio and objetivo_chave = 'lancamento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'hub_estudos_lancamento');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('lembrete_prazo_vlsts', 'Lembrete de prazo · VLS-TS', 'Lembrete de prazo: O aviso que ela pediu na calculadora de um artigo.', 'servico',
  'Você envia, pela ficha.', 'Todos',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 530, true, 'lembrete', '{}'::jsonb,
  null, null, null, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'lembrete_prazo_vlsts', 1, 'rascunho',
  $lembrete_prazo_vlsts_a${#nome}{nome}, o seu prazo do VLS-TS está chegando{/nome}{^nome}O seu prazo do VLS-TS está chegando{/nome}$lembrete_prazo_vlsts_a$,
  $lembrete_prazo_vlsts_p$O aviso que você pediu.$lembrete_prazo_vlsts_p$,
  $lembrete_prazo_vlsts_t${#nome}Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}{^nome}Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.{/nome}

{#prazo_a_vencer}{#prazo_limite}{#dias_para_prazo}O seu prazo: {prazo_limite}
Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF.

{/dias_para_prazo}{/prazo_limite}{/prazo_a_vencer}{#prazo_vencido}{#prazo_limite}O seu prazo venceu em: {prazo_limite}
Se você ainda não validou, vale agir logo.

{/prazo_limite}{/prazo_vencido}Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida.

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
{/prazo_limite}{/prazo_vencido}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}&amp;utm_source=email&amp;utm_campaign=lembrete-prazo" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Escolher um horário</a></p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$lembrete_prazo_vlsts_h$,
  $lembrete_prazo_vlsts_b${"assunto":"{nome}, o seu prazo do VLS-TS está chegando","assunto_alt":"O seu prazo do VLS-TS está chegando","pre":"O aviso que você pediu.","itens":[{"tipo":"texto","texto":"Oi {nome}! Você pediu para eu te avisar do prazo para validar o seu VLS-TS.","alt":"Oi! Você pediu para eu te avisar do prazo para validar o seu VLS-TS."},{"tipo":"destaque","se":"#prazo_a_vencer","rotulo":"O seu prazo","valor":"{prazo_limite}","nota":"Faltam {dias_para_prazo} dias. A validação é feita no site da ANEF."},{"tipo":"destaque","se":"#prazo_vencido","rotulo":"O seu prazo venceu em","valor":"{prazo_limite}","nota":"Se você ainda não validou, vale agir logo."},{"tipo":"texto","texto":"Se travou em algum passo, ou se a ANEF não respondeu, posso olhar o seu caso numa conversa rápida."},{"tipo":"botao","rotulo":"Escolher um horário","link":"link_agenda","complemento":"&utm_source=email&utm_campaign=lembrete-prazo"},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$lembrete_prazo_vlsts_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'lembrete_prazo_vlsts' and criado_no_estudio and objetivo_chave = 'lembrete')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'lembrete_prazo_vlsts');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_a_d3', 'Aquecimento · trilha A · começo · D+3 · astúcia 1', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 600, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'cf_guia_conversa', 2, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d3', 1, 'rascunho',
  $aq_a_d3_a${#nome}{nome}, o prazo que não está no calendário{/nome}{^nome}O prazo que não está no calendário{/nome}$aq_a_d3_a$,
  $aq_a_d3_p$Alguns cursos fecham antes da data geral.$aq_a_d3_p$,
  $aq_a_d3_t$O prazo que vale é o menor

{#nome}Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}{^nome}Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.{/nome}

A astúcia: Anote o prazo de cada curso
Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3).

{#prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.{/prazo_nivel}{^prazo_nivel}Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda.{/prazo_nivel}

Isso já tinha passado pela sua cabeça?
É só responder este e-mail. Eu leio cada resposta.

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
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Isso já tinha passado pela sua cabeça?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_a_d3_h$,
  $aq_a_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o prazo que não está no calendário","assunto_alt":"O prazo que não está no calendário","pre":"Alguns cursos fecham antes da data geral.","itens":[{"tipo":"titulo","texto":"O prazo que vale é o menor"},{"tipo":"texto","texto":"Oi {nome}! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela.","alt":"Oi! Uma coisa que pega muita gente no começo: o calendário do Campus France traz a data geral para submeter o dossiê, mas alguns cursos fecham antes dela."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Anote o prazo de cada curso","nota":"Entre o prazo do curso e o do calendário, vale sempre o menor (Guia do Candidato 2027-2028, p. 3)."},{"tipo":"texto","texto":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes de {prazo_nivel}, é ela que manda.","alt":"Na prática: quando escolher um curso, abra a página dele e procure a data limite de candidatura. Se ela vier antes da data geral do seu nível, é ela que manda."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d3_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d3' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d3');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_a_d6', 'Aquecimento · trilha A · começo · D+6 · sua história', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 601, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_a_d3', 3, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d6', 1, 'rascunho',
  $aq_a_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_a_d6_a$,
  $aq_a_d6_p$Por que eu entendo de burocracia francesa.$aq_a_d6_p$,
  $aq_a_d6_t$Oi, eu sou a Ingryd. Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.

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
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
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
  $aq_a_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d6_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d6' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d6');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_a_d10', 'Aquecimento · trilha A · começo · D+10 · astúcia 2 e bastidor', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 602, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_a_d6', 4, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d10', 1, 'rascunho',
  $aq_a_d10_a${#nome}{nome}, quando o curso aparece como "Encerrado"{/nome}{^nome}Quando o curso aparece como "Encerrado"{/nome}$aq_a_d10_a$,
  $aq_a_d10_p$Nem sempre é o fim da linha.$aq_a_d10_p$,
  $aq_a_d10_t$Curso "Encerrado" nem sempre é um não

{#nome}Oi {nome}! Na hora de escolher os cursos na plataforma, alguns aparecem como "Encerrado" ou com "Ponto de entrada inativo". A reação natural é riscar o curso da lista.{/nome}{^nome}Oi! Na hora de escolher os cursos na plataforma, alguns aparecem como "Encerrado" ou com "Ponto de entrada inativo". A reação natural é riscar o curso da lista.{/nome}

A astúcia: Escreva para a universidade
Nesses casos, o guia orienta a falar com a própria universidade (Guia do Candidato 2027-2028, p. 6). Pergunte se a formação vai abrir para candidatura e até quando.

Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide.

Quer que eu responda a sua dúvida?
Me conte em uma frase o que está travando. É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_a_d10_t$,
  $aq_a_d10_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Curso &quot;Encerrado&quot; nem sempre é um não</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Na hora de escolher os cursos na plataforma, alguns aparecem como &quot;Encerrado&quot; ou com &quot;Ponto de entrada inativo&quot;. A reação natural é riscar o curso da lista.{/nome}{^nome}Oi! Na hora de escolher os cursos na plataforma, alguns aparecem como &quot;Encerrado&quot; ou com &quot;Ponto de entrada inativo&quot;. A reação natural é riscar o curso da lista.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Escreva para a universidade</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Nesses casos, o guia orienta a falar com a própria universidade (Guia do Candidato 2027-2028, p. 6). Pergunte se a formação vai abrir para candidatura e até quando.</div></td></tr></table>
<div style="border-top:1px solid #E2DED7; margin:8px 0 16px;"></div>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Quer que eu responda a sua dúvida?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte em uma frase o que está travando. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_a_d10_h$,
  $aq_a_d10_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, quando o curso aparece como \"Encerrado\"","assunto_alt":"Quando o curso aparece como \"Encerrado\"","pre":"Nem sempre é o fim da linha.","itens":[{"tipo":"titulo","texto":"Curso \"Encerrado\" nem sempre é um não"},{"tipo":"texto","texto":"Oi {nome}! Na hora de escolher os cursos na plataforma, alguns aparecem como \"Encerrado\" ou com \"Ponto de entrada inativo\". A reação natural é riscar o curso da lista.","alt":"Oi! Na hora de escolher os cursos na plataforma, alguns aparecem como \"Encerrado\" ou com \"Ponto de entrada inativo\". A reação natural é riscar o curso da lista."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Escreva para a universidade","nota":"Nesses casos, o guia orienta a falar com a própria universidade (Guia do Candidato 2027-2028, p. 6). Pergunte se a formação vai abrir para candidatura e até quando."},{"tipo":"texto","estilo":"discreto","linha":true,"texto":"Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide."},{"tipo":"pergunta","texto":"Quer que eu responda a sua dúvida?","ajuda":"Me conte em uma frase o que está travando. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d10_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d10' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d10');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_a_d15', 'Aquecimento · trilha A · começo · D+15 · o que responderam', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 603, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_a_d10', 5, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_a_d15', 1, 'rascunho',
  $aq_a_d15_a${#nome}{nome}, o que as pessoas me responderam{/nome}{^nome}O que as pessoas me responderam{/nome}$aq_a_d15_a$,
  $aq_a_d15_p$As dúvidas que mais chegaram, sem nomes.$aq_a_d15_p$,
  $aq_a_d15_t$O que mais chegou nas respostas

{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}

[a dúvida 1]
[o que você respondeu]

[a dúvida 2]
[o que você respondeu]

[a dúvida 3]
[o que você respondeu]

Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_a_d15_t$,
  $aq_a_d15_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que mais chegou nas respostas</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 1]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 2]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 3]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_a_d15_h$,
  $aq_a_d15_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o que as pessoas me responderam","assunto_alt":"O que as pessoas me responderam","pre":"As dúvidas que mais chegaram, sem nomes.","itens":[{"tipo":"titulo","texto":"O que mais chegou nas respostas"},{"tipo":"texto","texto":"Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.","alt":"Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi."},{"tipo":"texto","texto":"**[a dúvida 1]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 2]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 3]**\n[o que você respondeu]"},{"tipo":"texto","estilo":"discreto","texto":"Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_a_d15_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_a_d15' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_a_d15');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_b_d3', 'Aquecimento · trilha B · dossiê · D+3 · astúcia 1', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 610, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'cf_guia_conversa', 2, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d3', 1, 'rascunho',
  $aq_b_d3_a${#nome}{nome}, o documento que ainda não existe{/nome}{^nome}O documento que ainda não existe{/nome}$aq_b_d3_a$,
  $aq_b_d3_p$Ele não precisa travar o seu dossiê.$aq_b_d3_p$,
  $aq_b_d3_t$Documento que ainda não existe entra provisório

{#nome}Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}{^nome}Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.{/nome}

A astúcia: Envie o provisório
O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo.

Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo.

Isso já tinha passado pela sua cabeça?
É só responder este e-mail. Eu leio cada resposta.

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
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Isso já tinha passado pela sua cabeça?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_b_d3_h$,
  $aq_b_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o documento que ainda não existe","assunto_alt":"O documento que ainda não existe","pre":"Ele não precisa travar o seu dossiê.","itens":[{"tipo":"titulo","texto":"Documento que ainda não existe entra provisório"},{"tipo":"texto","texto":"Oi {nome}! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou.","alt":"Oi! Se você está juntando documentos agora, é bem provável que algum ainda não exista: o diploma de quem se forma este ano, ou o histórico do semestre que ainda não acabou."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Envie o provisório","nota":"O guia prevê documento provisório para o que ainda não foi emitido (Guia do Candidato 2027-2028, p. 6). Você completa depois, sem perder o prazo."},{"tipo":"texto","texto":"Na prática: peça à sua faculdade uma declaração com o que já existe e siga com o resto do dossiê. Esperar o documento final pode custar o prazo."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d3_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d3' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d3');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_b_d6', 'Aquecimento · trilha B · dossiê · D+6 · sua história', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 611, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_b_d3', 3, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d6', 1, 'rascunho',
  $aq_b_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_b_d6_a$,
  $aq_b_d6_p$Por que eu entendo de burocracia francesa.$aq_b_d6_p$,
  $aq_b_d6_t$Oi, eu sou a Ingryd. Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.

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
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
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
  $aq_b_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d6_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d6' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d6');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_b_d10', 'Aquecimento · trilha B · dossiê · D+10 · astúcia 2 e bastidor', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 612, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_b_d6', 4, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d10', 1, 'rascunho',
  $aq_b_d10_a${#nome}{nome}, o teste de francês e o prazo do dossiê{/nome}{^nome}O teste de francês e o prazo do dossiê{/nome}$aq_b_d10_a$,
  $aq_b_d10_p$A inscrição pode bastar, se a prova for até fevereiro.$aq_b_d10_p$,
  $aq_b_d10_t$Você não precisa esperar o resultado do teste

{#nome}Oi {nome}! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?{/nome}{^nome}Oi! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?{/nome}

A astúcia: A inscrição vale
Se a sua prova for até fevereiro, o comprovante de inscrição entra no lugar do resultado. O resultado precisa chegar ao Campus France até 05/03/2027 (Guia do Candidato 2027-2028, p. 13).

E se a sua formação for em inglês, os documentos podem ser traduzidos para o inglês (Guia do Candidato 2027-2028, p. 6). Confira na página do curso antes de pagar a tradução.

Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide.

Quer que eu responda a sua dúvida?
Me conte em uma frase o que está travando. É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_b_d10_t$,
  $aq_b_d10_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Você não precisa esperar o resultado do teste</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?{/nome}{^nome}Oi! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">A inscrição vale</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se a sua prova for até fevereiro, o comprovante de inscrição entra no lugar do resultado. O resultado precisa chegar ao Campus France até 05/03/2027 (Guia do Candidato 2027-2028, p. 13).</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E se a sua formação for em inglês, os documentos podem ser traduzidos para o inglês (Guia do Candidato 2027-2028, p. 6). Confira na página do curso antes de pagar a tradução.</p>
<div style="border-top:1px solid #E2DED7; margin:8px 0 16px;"></div>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Quer que eu responda a sua dúvida?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte em uma frase o que está travando. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_b_d10_h$,
  $aq_b_d10_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o teste de francês e o prazo do dossiê","assunto_alt":"O teste de francês e o prazo do dossiê","pre":"A inscrição pode bastar, se a prova for até fevereiro.","itens":[{"tipo":"titulo","texto":"Você não precisa esperar o resultado do teste"},{"tipo":"texto","texto":"Oi {nome}! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?","alt":"Oi! Uma dúvida que aparece muito na fase dos documentos: dá para submeter o dossiê sem o resultado do teste de francês?"},{"tipo":"destaque","rotulo":"A astúcia","valor":"A inscrição vale","nota":"Se a sua prova for até fevereiro, o comprovante de inscrição entra no lugar do resultado. O resultado precisa chegar ao Campus France até 05/03/2027 (Guia do Candidato 2027-2028, p. 13)."},{"tipo":"texto","texto":"E se a sua formação for em inglês, os documentos podem ser traduzidos para o inglês (Guia do Candidato 2027-2028, p. 6). Confira na página do curso antes de pagar a tradução."},{"tipo":"texto","estilo":"discreto","linha":true,"texto":"Um bastidor: cada dica destes e-mails sai do Guia do Candidato 2027-2028 do Campus France Brasil, com a página anotada, e eu confiro antes de escrever. Quando o guia não responde, faço o que faço no meu dia a dia na França: pergunto por escrito a quem decide."},{"tipo":"pergunta","texto":"Quer que eu responda a sua dúvida?","ajuda":"Me conte em uma frase o que está travando. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d10_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d10' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d10');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_b_d15', 'Aquecimento · trilha B · dossiê · D+15 · o que responderam', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 613, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_b_d10', 5, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_b_d15', 1, 'rascunho',
  $aq_b_d15_a${#nome}{nome}, o que as pessoas me responderam{/nome}{^nome}O que as pessoas me responderam{/nome}$aq_b_d15_a$,
  $aq_b_d15_p$As dúvidas que mais chegaram, sem nomes.$aq_b_d15_p$,
  $aq_b_d15_t$O que mais chegou nas respostas

{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}

[a dúvida 1]
[o que você respondeu]

[a dúvida 2]
[o que você respondeu]

[a dúvida 3]
[o que você respondeu]

Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_b_d15_t$,
  $aq_b_d15_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que mais chegou nas respostas</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 1]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 2]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 3]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_b_d15_h$,
  $aq_b_d15_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o que as pessoas me responderam","assunto_alt":"O que as pessoas me responderam","pre":"As dúvidas que mais chegaram, sem nomes.","itens":[{"tipo":"titulo","texto":"O que mais chegou nas respostas"},{"tipo":"texto","texto":"Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.","alt":"Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi."},{"tipo":"texto","texto":"**[a dúvida 1]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 2]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 3]**\n[o que você respondeu]"},{"tipo":"texto","estilo":"discreto","texto":"Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_b_d15_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_b_d15' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_b_d15');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_c_d3', 'Aquecimento · trilha C · depois do envio · D+3 · astúcia 1', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 620, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'cf_guia_conversa', 2, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d3', 1, 'rascunho',
  $aq_c_d3_a${#nome}{nome}, o passo que destrava a verificação{/nome}{^nome}O passo que destrava a verificação{/nome}$aq_c_d3_a$,
  $aq_c_d3_p$Sem ele, o seu dossiê fica parado.$aq_c_d3_p$,
  $aq_c_d3_t$A verificação só começa depois do Pix declarado

{#nome}Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}{^nome}Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.{/nome}

A astúcia: Declare o pagamento
A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5).

Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia.

Isso já tinha passado pela sua cabeça?
É só responder este e-mail. Eu leio cada resposta.

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
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Isso já tinha passado pela sua cabeça?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_c_d3_h$,
  $aq_c_d3_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o passo que destrava a verificação","assunto_alt":"O passo que destrava a verificação","pre":"Sem ele, o seu dossiê fica parado.","itens":[{"tipo":"titulo","texto":"A verificação só começa depois do Pix declarado"},{"tipo":"texto","texto":"Oi {nome}! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa.","alt":"Oi! Enviar o dossiê não é o último passo. Muita gente envia, paga e fica esperando, sem saber que ainda falta uma coisa."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Declare o pagamento","nota":"A taxa é de R$ 600, por Pix. A verificação do dossiê só começa depois que você declara o pagamento na plataforma (Guia do Candidato 2027-2028, p. 5)."},{"tipo":"texto","texto":"Se você já pagou, confira na plataforma se a declaração ficou registrada. Se ainda não pagou, faça os dois no mesmo dia."},{"tipo":"pergunta","texto":"Isso já tinha passado pela sua cabeça?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d3_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d3' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d3');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_c_d6', 'Aquecimento · trilha C · depois do envio · D+6 · sua história', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 621, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_c_d3', 3, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d6', 1, 'rascunho',
  $aq_c_d6_a${#nome}{nome}, eu cheguei na França sem manual{/nome}{^nome}Eu cheguei na França sem manual{/nome}$aq_c_d6_a$,
  $aq_c_d6_p$Por que eu entendo de burocracia francesa.$aq_c_d6_p$,
  $aq_c_d6_t$Oi, eu sou a Ingryd. Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.

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
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
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
  $aq_c_d6_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, eu cheguei na França sem manual","assunto_alt":"Eu cheguei na França sem manual","pre":"Por que eu entendo de burocracia francesa.","itens":[{"tipo":"apresentacao","titulo":"Oi, eu sou a Ingryd","texto":"Moro na França há 3 anos e criei o Por Dentro para quem está fazendo esse caminho agora."},{"tipo":"texto","texto":"{nome}, hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails.","alt":"Hoje eu quero te contar de onde vem o que eu escrevo nestes e-mails."},{"tipo":"texto","texto":"Sou administradora pública, formada pela Unicamp. Cheguei em Paris sem falar francês, com muitos sonhos e quase nenhuma informação confiável. Comecei como babá e, ao mesmo tempo, preparava um CAP, um certificado de aptidão profissional."},{"tipo":"texto","texto":"A falta de informação me colocou em situações bem complicadas. O que me ajudou foi ter escolhido um caminho de estudos desde o começo. Hoje faço um mestrado em alternância numa Grande École."},{"tipo":"texto","texto":"O que mudou de verdade foi quando eu parei de só correr atrás do sistema e comecei a estudar como ele funciona. É isso que eu faço no Por Dentro: documento o que aprendi, sem romantizar e sem colocar medo."},{"tipo":"pergunta","texto":"Qual parte te tira o sono?","ajuda":"Responda com uma palavra: **documentos**, **francês**, **curso** ou **dinheiro**. Eu leio cada resposta, e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d6_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d6' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d6');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_c_d10', 'Aquecimento · trilha C · depois do envio · D+10 · astúcia 2 e bastidor', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 622, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_c_d6', 4, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d10', 1, 'rascunho',
  $aq_c_d10_a${#nome}{nome}, a alternância e a entrevista{/nome}{^nome}A alternância e a entrevista{/nome}$aq_c_d10_a$,
  $aq_c_d10_p$Duas coisas para a fase depois do envio.$aq_c_d10_p$,
  $aq_c_d10_t$Se você quer alternância, ela precisa estar na carta

{#nome}Oi {nome}! Para quem já enviou o dossiê, duas coisas fazem diferença agora.{/nome}{^nome}Oi! Para quem já enviou o dossiê, duas coisas fazem diferença agora.{/nome}

A astúcia: Alternância na carta
Se o seu plano é estudar em alternância, isso precisa aparecer na sua carta de motivação (Guia do Candidato 2027-2028, p. 6).

A entrevista é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Separei um roteiro para você treinar: [link do presente CF09]

Um bastidor: eu faço um mestrado em alternância numa Grande École, então sei de perto o quanto a escola e o contrato precisam conversar desde o começo.

Quer que eu responda a sua dúvida?
Me conte em uma frase o que está travando. É só responder este e-mail.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_c_d10_t$,
  $aq_c_d10_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Se você quer alternância, ela precisa estar na carta</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Para quem já enviou o dossiê, duas coisas fazem diferença agora.{/nome}{^nome}Oi! Para quem já enviou o dossiê, duas coisas fazem diferença agora.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A astúcia</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Alternância na carta</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se o seu plano é estudar em alternância, isso precisa aparecer na sua carta de motivação (Guia do Candidato 2027-2028, p. 6).</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">A entrevista é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Separei um roteiro para você treinar: [link do presente CF09]</p>
<div style="border-top:1px solid #E2DED7; margin:8px 0 16px;"></div>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Um bastidor: eu faço um mestrado em alternância numa Grande École, então sei de perto o quanto a escola e o contrato precisam conversar desde o começo.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Quer que eu responda a sua dúvida?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte em uma frase o que está travando. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_c_d10_h$,
  $aq_c_d10_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, a alternância e a entrevista","assunto_alt":"A alternância e a entrevista","pre":"Duas coisas para a fase depois do envio.","itens":[{"tipo":"titulo","texto":"Se você quer alternância, ela precisa estar na carta"},{"tipo":"texto","texto":"Oi {nome}! Para quem já enviou o dossiê, duas coisas fazem diferença agora.","alt":"Oi! Para quem já enviou o dossiê, duas coisas fazem diferença agora."},{"tipo":"destaque","rotulo":"A astúcia","valor":"Alternância na carta","nota":"Se o seu plano é estudar em alternância, isso precisa aparecer na sua carta de motivação (Guia do Candidato 2027-2028, p. 6)."},{"tipo":"texto","texto":"A entrevista é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Separei um roteiro para você treinar: [link do presente CF09]"},{"tipo":"texto","estilo":"discreto","linha":true,"texto":"Um bastidor: eu faço um mestrado em alternância numa Grande École, então sei de perto o quanto a escola e o contrato precisam conversar desde o começo."},{"tipo":"pergunta","texto":"Quer que eu responda a sua dúvida?","ajuda":"Me conte em uma frase o que está travando. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d10_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d10' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d10');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_ligado)
values ('aq_c_d15', 'Aquecimento · trilha C · depois do envio · D+15 · o que responderam', 'Aquecimento: Sequência por trilha: astúcia, sua história, bastidor, o que as pessoas responderam.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia Campus France · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 623, true, 'aquecimento', '{"materiais":["guia-etudes-en-france-2027"]}'::jsonb,
  'email', 'aq_c_d10', 5, 10, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aq_c_d15', 1, 'rascunho',
  $aq_c_d15_a${#nome}{nome}, o que as pessoas me responderam{/nome}{^nome}O que as pessoas me responderam{/nome}$aq_c_d15_a$,
  $aq_c_d15_p$As dúvidas que mais chegaram, sem nomes.$aq_c_d15_p$,
  $aq_c_d15_t$O que mais chegou nas respostas

{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}

[a dúvida 1]
[o que você respondeu]

[a dúvida 2]
[o que você respondeu]

[a dúvida 3]
[o que você respondeu]

Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aq_c_d15_t$,
  $aq_c_d15_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que mais chegou nas respostas</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}{^nome}Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 1]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 2]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>[a dúvida 3]</b><br>[o que você respondeu]</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aq_c_d15_h$,
  $aq_c_d15_b${"rodape":"pediu o checklist Études en France no Por Dentro com {email}","assunto":"{nome}, o que as pessoas me responderam","assunto_alt":"O que as pessoas me responderam","pre":"As dúvidas que mais chegaram, sem nomes.","itens":[{"tipo":"titulo","texto":"O que mais chegou nas respostas"},{"tipo":"texto","texto":"Oi {nome}! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi.","alt":"Oi! Nas últimas semanas, muita gente que pegou o checklist respondeu os meus e-mails. Juntei as dúvidas que mais apareceram, sem nomes, e o que eu respondi."},{"tipo":"texto","texto":"**[a dúvida 1]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 2]**\n[o que você respondeu]"},{"tipo":"texto","texto":"**[a dúvida 3]**\n[o que você respondeu]"},{"tipo":"texto","estilo":"discreto","texto":"Se a sua dúvida não está aqui, responda este e-mail. Eu leio cada uma."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aq_c_d15_b$::jsonb,
  'modelos prontos 19/10/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aq_c_d15' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aq_c_d15');
