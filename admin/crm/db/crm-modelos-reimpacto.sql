-- Por Dentro — Estúdio de e-mails: os 4 reimpactos reescritos com a base da aula de CRO (20/10/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-revisao.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-reimpacto.mjs, a partir de estudio.js (ES.montar). Aprovado no artefato "Reimpacto Por Dentro".
--
-- Só cria rascunhos, com a nota "reimpacto CRO 20/10/2026": naoabriu, naoclicou, cliquenaoapp e parouapp. Não publica nada e não mexe
-- em nenhuma versão que já existe. Cada um só ganha a versão nova se a versão mais nova dele ainda for a da revisão de texto
-- de 20/10/2026; se você mudou o modelo no estúdio depois disso, ele é pulado.
-- O parouapp continua com o [dica]: é manual, você troca na hora de enviar.
--
-- Segurança: só textos dos modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota = 'reimpacto CRO 20/10/2026' and etapa in ('rascunho', 'revisao');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoabriu', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoabriu'), 'rascunho',
  $naoabriu_a${#nome}{nome}, o que ninguém me contou quando eu cheguei{/nome}{^nome}O que ninguém me contou quando eu cheguei{/nome}$naoabriu_a$,
  $naoabriu_p$Eu cheguei sem francês e sem informação confiável.$naoabriu_p$,
  $naoabriu_t${#nome}Oi {nome}! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!{/nome}{^nome}Oi! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!{/nome}

Foi por isso que eu montei esse checklist: para te entregar os passos na ordem, com o prazo real de cada um, num lugar só.

Ver o meu checklist: {link_acesso}

Se o e-mail anterior caiu no spam, marque como "não é spam". Assim os próximos chegam.

Ingryd · Por Dentro$naoabriu_t$,
  $naoabriu_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!{/nome}{^nome}Oi! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Foi por isso que eu montei esse checklist: para te entregar os passos na ordem, com o prazo real de cada um, num lugar só.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Ver o meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Se o e-mail anterior caiu no spam, marque como &quot;não é spam&quot;. Assim os próximos chegam.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$naoabriu_h$,
  $naoabriu_b${"v":1,"planos":{},"assunto":"{nome}, o que ninguém me contou quando eu cheguei","assunto_alt":"O que ninguém me contou quando eu cheguei","pre":"Eu cheguei sem francês e sem informação confiável.","itens":[{"tipo":"texto","texto":"Oi {nome}! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!","alt":"Oi! Quando eu cheguei em Paris, o mais difícil não foi a língua. Foi descobrir em quem confiar: cada site dizia uma coisa, e eu só percebia o erro quando já era tarde demais. Eu só consegui pegar o jeito depois que conheci uma grande amiga, que já estava vacinada contra o sistema francês e começou a me dar dicas que eu nunca tinha ouvido antes!"},{"tipo":"texto","texto":"Foi por isso que eu montei esse checklist: para te entregar os passos na ordem, com o prazo real de cada um, num lugar só."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","estilo":"discreto","texto":"Se o e-mail anterior caiu no spam, marque como \"não é spam\". Assim os próximos chegam."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$naoabriu_b$::jsonb,
  'reimpacto CRO 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'naoabriu' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'naoabriu' order by versao desc limit 1) = $naoabriu_base${"assunto":"{nome}, o seu checklist continua aqui","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo.","alt":"Oi! Vi que o link do seu checklist ainda não foi aberto, então deixo ele aqui de novo."},{"tipo":"botao","rotulo":"Abrir o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se o e-mail anterior caiu no spam, marque como \"não é spam\" para não perder os próximos."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O seu checklist continua aqui","pre":"Deixei o link de novo, caso o outro tenha se perdido."}$naoabriu_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoabriu' and nota = 'reimpacto CRO 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'naoclicou', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'naoclicou'), 'rascunho',
  $naoclicou_a${#nome}{nome}, por onde começar (sem ler 40 sites){/nome}{^nome}Por onde começar (sem ler 40 sites){/nome}$naoclicou_a$,
  $naoclicou_p$Um passo de cada vez, com a fonte de cada um.$naoclicou_p$,
  $naoclicou_t${#nome}Oi {nome}! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.{/nome}{^nome}Oi! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.{/nome}

O que o checklist faz por você
Mostra o próximo passo do seu caso, na ordem, com o prazo real.
Você cria a sua conta e, com um clique, já vê.

Cada passo sai de fonte oficial, e eu confiro tudo antes de colocar lá.

Ver o meu primeiro passo: {link_acesso}

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.{/nome}{^nome}Oi! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O que o checklist faz por você</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Mostra o próximo passo do seu caso, na ordem, com o prazo real.</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Você cria a sua conta e, com um clique, já vê.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Cada passo sai de fonte oficial, e eu confiro tudo antes de colocar lá.</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Ver o meu primeiro passo</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Qualquer dúvida, é só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$naoclicou_h$,
  $naoclicou_b${"v":1,"planos":{},"assunto":"{nome}, por onde começar (sem ler 40 sites)","assunto_alt":"Por onde começar (sem ler 40 sites)","pre":"Um passo de cada vez, com a fonte de cada um.","itens":[{"tipo":"texto","texto":"Oi {nome}! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro.","alt":"Oi! Quem chega na França costuma travar no mesmo ponto: são tantas etapas que fica difícil saber qual vem primeiro."},{"tipo":"destaque","rotulo":"O que o checklist faz por você","valor":"Mostra o próximo passo do seu caso, na ordem, com o prazo real.","nota":"Você cria a sua conta e, com um clique, já vê."},{"tipo":"texto","texto":"Cada passo sai de fonte oficial, e eu confiro tudo antes de colocar lá."},{"tipo":"botao","rotulo":"Ver o meu primeiro passo","link":"link_acesso"},{"tipo":"texto","estilo":"discreto","texto":"Qualquer dúvida, é só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$naoclicou_b$::jsonb,
  'reimpacto CRO 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'naoclicou' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'naoclicou' order by versao desc limit 1) = $naoclicou_base${"assunto":"{nome}, o que tem no seu checklist","itens":[{"tipo":"texto","texto":"Oi {nome}! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um.","alt":"Oi! Talvez o e-mail anterior não tenha mostrado o que você encontra lá: os passos do seu caso{#au_pair}, de au pair a estudante{/au_pair}, na ordem, com o prazo real de cada um."},{"tipo":"botao","rotulo":"Ver o meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Qualquer dúvida, é só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O que tem no seu checklist","pre":"Os passos do seu caso, na ordem, com os prazos."}$naoclicou_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'naoclicou' and nota = 'reimpacto CRO 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'cliquenaoapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'cliquenaoapp'), 'rascunho',
  $cliquenaoapp_a${#nome}{nome}, o link travou?{/nome}{^nome}O link travou?{/nome}$cliquenaoapp_a$,
  $cliquenaoapp_p$Duas coisas que costumam resolver.$cliquenaoapp_p$,
  $cliquenaoapp_t${#nome}Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:{/nome}{^nome}Oi! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:{/nome}

O que costuma resolver
1. Abra o link no navegador do celular, não dentro do app de e-mail ou do Instagram.
2. Use o link deste e-mail, o mais novo.

Entrar no meu checklist: {link_acesso}

Se ainda travar, responda este e-mail com um print. Eu olho com você.

Ingryd · Por Dentro$cliquenaoapp_t$,
  $cliquenaoapp_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:{/nome}{^nome}Oi! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O que costuma resolver</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>1.</b> Abra o link no navegador do celular, não dentro do app de e-mail ou do Instagram.<br><b>2.</b> Use o link deste e-mail, o mais novo.</div></td></tr></table>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Entrar no meu checklist</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se ainda travar, responda este e-mail com um print. Eu olho com você.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
</table></td></tr></table>
</body></html>$cliquenaoapp_h$,
  $cliquenaoapp_b${"v":1,"planos":{},"assunto":"{nome}, o link travou?","assunto_alt":"O link travou?","pre":"Duas coisas que costumam resolver.","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:","alt":"Oi! Vi que você clicou no link, mas não chegou a entrar. Quase sempre é uma destas duas coisas:"},{"tipo":"destaque","rotulo":"O que costuma resolver","valor":"**1.** Abra o link no navegador do celular, não dentro do app de e-mail ou do Instagram.\n**2.** Use o link deste e-mail, o mais novo."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se ainda travar, responda este e-mail com um print. Eu olho com você."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$cliquenaoapp_b$::jsonb,
  'reimpacto CRO 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'cliquenaoapp' and tipo = 'servico')
  and (select blocos from public.modelos_email_versoes where chave = 'cliquenaoapp' order by versao desc limit 1) = $cliquenaoapp_base${"assunto":"{nome}, o seu link ainda funciona","itens":[{"tipo":"texto","texto":"Oi {nome}! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só.","alt":"Oi! Vi que você clicou no link, mas não chegou a entrar. O acesso é sem senha: um clique só."},{"tipo":"botao","rotulo":"Entrar no meu checklist","link":"link_acesso"},{"tipo":"texto","texto":"Se travou em alguma coisa, responda este e-mail e me conte. Eu ajudo."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"O seu link ainda funciona","pre":"O acesso é sem senha: um clique só."}$cliquenaoapp_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cliquenaoapp' and nota = 'reimpacto CRO 20/10/2026');

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'parouapp', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'parouapp'), 'rascunho',
  $parouapp_a${#nome}{nome}, o passo que trava quase todo mundo{/nome}{^nome}O passo que trava quase todo mundo{/nome}$parouapp_a$,
  $parouapp_p$Não é falta de organização. É o sistema.$parouapp_p$,
  $parouapp_t${#nome}Oi {nome}! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.{/nome}{^nome}Oi! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.{/nome}

Eu também travei assim. O que me destravou foi começar pelo que depende dos outros e, enquanto espero, seguir com o resto.

A dica para o seu momento: [dica]

{#motivo}Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.

{/motivo}Em qual passo você parou?
Me conte em uma frase. É só responder este e-mail.

Ingryd · Por Dentro

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
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.{/nome}{^nome}Oi! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Eu também travei assim. O que me destravou foi começar pelo que depende dos outros e, enquanto espero, seguir com o resto.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">A dica para o seu momento</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">[dica]</div></td></tr></table>
{#motivo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa.</p>
{/motivo}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Em qual passo você parou?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conte em uma frase. É só responder este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$parouapp_h$,
  $parouapp_b${"v":1,"planos":{},"assunto":"{nome}, o passo que trava quase todo mundo","assunto_alt":"O passo que trava quase todo mundo","pre":"Não é falta de organização. É o sistema.","itens":[{"tipo":"texto","texto":"Oi {nome}! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre.","alt":"Oi! Se você parou no meio, não é falta de organização. Na França, muitos passos dependem de outra pessoa: um documento da faculdade, uma resposta da prefeitura, um horário que não abre."},{"tipo":"texto","texto":"Eu também travei assim. O que me destravou foi começar pelo que depende dos outros e, enquanto espero, seguir com o resto."},{"tipo":"destaque","rotulo":"A dica para o seu momento","valor":"[dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa."},{"tipo":"pergunta","texto":"Em qual passo você parou?","ajuda":"Me conte em uma frase. É só responder este e-mail."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}]}$parouapp_b$::jsonb,
  'reimpacto CRO 20/10/2026'
where exists (select 1 from public.modelos_email where chave = 'parouapp' and tipo = 'novidades')
  and (select blocos from public.modelos_email_versoes where chave = 'parouapp' order by versao desc limit 1) = $parouapp_base${"assunto":"{nome}, uma dica para o seu momento","itens":[{"tipo":"texto","texto":"Oi {nome}! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]","alt":"Oi! Separei uma dica que não estava no seu checklist, para o seu momento: [dica]"},{"tipo":"texto","se":"#motivo","texto":"Também vi que {motivo}. Vale resolver isso antes de qualquer outra coisa."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{},"assunto_alt":"Uma dica para o seu momento","pre":"Uma dica que não estava no seu checklist."}$parouapp_base$::jsonb
  and not exists (select 1 from public.modelos_email_versoes where chave = 'parouapp' and nota = 'reimpacto CRO 20/10/2026');
