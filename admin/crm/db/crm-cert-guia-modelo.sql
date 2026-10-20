-- Por Dentro — o modelo do e-mail do guia Painel do Certificado (cert_guia_1)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql e de crm-cert-guia-email.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-cert-guia.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, mude lá e gere de novo,
-- ou edite pelo Estúdio de e-mails (versão nova). O Worker também tem o mesmo texto no código (certGuia1), de reserva.
--
-- Só acrescenta: o modelo (tipo serviço, sai sozinho, como o cf_guia_1) e a versão 1 No ar, em blocos. Não mexe em nenhum
-- outro modelo e não manda nada: o e-mail só sai depois que os segredos do Vault existirem (README do Worker, seção 17).
-- Nenhum link nem dado de pessoa aqui: o link do Notion vem de guias_links na hora do envio.
--
-- Como desfazer (só enquanto nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'cert_guia_1';
--   delete from public.modelos_email where chave = 'cert_guia_1';

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, automatico, variaveis, ordem)
values ('cert_guia_1', 'Guia Painel do Certificado · e-mail 1', 'Entregar o painel que ela pediu e dizer por onde começar na prova dela', 'servico',
  'Sozinho, na hora do cadastro no guia (o banco chama o Worker).', 'Todos que pediram o guia', true,
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"link_painel","o_que_e":"o link privado do painel no Notion (vem do banco, com UTM)","se_faltar":"sem link, o e-mail não sai"},{"nome":"prova_delf","o_que_e":"a prova que ela marcou no guia: DELF ou DALF","se_faltar":"não"},{"nome":"prova_tcf","o_que_e":"a prova que ela marcou no guia: TCF","se_faltar":"não"},{"nome":"prova_exame_civico","o_que_e":"a prova que ela marcou no guia: Exame Cívico","se_faltar":"não"},{"nome":"prova_ingles","o_que_e":"a prova que ela marcou no guia: TOEIC, CAE ou CPE","se_faltar":"não"},{"nome":"prova_outro","o_que_e":"a prova que ela marcou no guia: outra prova","se_faltar":"não"},{"nome":"prova_indeciso","o_que_e":"a prova que ela marcou no guia: ainda não sabe qual fazer","se_faltar":"não"}]'::jsonb, 110)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select 'cert_guia_1', 1, 'no_ar',
  $cert_guia_1_a$Seu painel do certificado está aqui$cert_guia_1_a$,
  $cert_guia_1_p$O link para duplicar e por onde começar.$cert_guia_1_p$,
  $cert_guia_1_t${#nome}Olá, {nome}.{/nome}{^nome}Olá.{/nome}

Aqui está o seu painel:

Abrir o painel no Notion: {link_painel}

Abra o link e clique em "Duplicate" (duplicar), no canto superior direito. A cópia vai para o seu Notion e passa a ser sua.

Para começar, abra o certificado "EXEMPLO · DELF B2 até fevereiro". Ele já vem preenchido, e cada página dele explica para que serve. Quando entender, apague os itens com "EXEMPLO" no nome e cadastre a sua prova e a data.

{#prova_delf}Para a sua prova:
Na página "TUDO QUE VOCÊ PRECISA SABER", abra o checklist "DELF / DALF" e a aba "Simulados". Comece pelos sujets oficiais da France Éducation International.

{/prova_delf}{#prova_tcf}Para a sua prova:
Na página "TUDO QUE VOCÊ PRECISA SABER", abra o checklist "TCF (Français & Canada)". Para o TCF Canada, o número do processo do IRCC é pedido na inscrição.

{/prova_tcf}{#prova_exame_civico}Para a sua prova:
Na página "TUDO QUE VOCÊ PRECISA SABER", abra o checklist "Exame Cívico" e as fichas gratuitas de preparação do Ministério do Interior. O exame é obrigatório desde 1º de janeiro de 2026 em três pedidos: carte pluriannuelle, carte de résident e naturalização. Confirme no centro onde vai fazer o valor e a data.

{/prova_exame_civico}{#prova_ingles}Para a sua prova:
Na página "TUDO QUE VOCÊ PRECISA SABER", abra o checklist "TOEIC / CAE / CPE" e a aba "Simulados", que tem amostras oficiais.

{/prova_ingles}{#prova_outro}Para a sua prova:
O painel funciona para qualquer prova: cadastre a sua em CERTIFICADOS e crie as habilidades dela. A biblioteca de links não cobre a sua prova ainda. Responda este e-mail dizendo qual é, para eu saber o que incluir.

{/prova_outro}{#prova_indeciso}Para a sua prova:
Na página "TUDO QUE VOCÊ PRECISA SABER", abra "Saiba antes" e a tabela "Qual certificado escolher para cada situação".

{/prova_indeciso}Depois, escolha um dia fixo da semana para a Revisão Semanal, que leva 10 minutos. É ela que mantém o painel funcionando.

Se travar em alguma parte, responda este e-mail.

Ingryd, do Por Dentro

—
Você recebeu este e-mail porque pediu o Painel do Certificado no Por Dentro com {email}.$cert_guia_1_t$,
  $cert_guia_1_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Olá, {nome}.{/nome}{^nome}Olá.{/nome}</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Aqui está o seu painel:</p>
<p style="margin:0 0 24px;"><a href="{link_painel}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o painel no Notion</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Abra o link e clique em &quot;Duplicate&quot; (duplicar), no canto superior direito. A cópia vai para o seu Notion e passa a ser sua.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Para começar, abra o certificado &quot;EXEMPLO · DELF B2 até fevereiro&quot;. Ele já vem preenchido, e cada página dele explica para que serve. Quando entender, apague os itens com &quot;EXEMPLO&quot; no nome e cadastre a sua prova e a data.</p>
{#prova_delf}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na página &quot;TUDO QUE VOCÊ PRECISA SABER&quot;, abra o checklist &quot;DELF / DALF&quot; e a aba &quot;Simulados&quot;. Comece pelos sujets oficiais da France Éducation International.</p>
{/prova_delf}{#prova_tcf}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na página &quot;TUDO QUE VOCÊ PRECISA SABER&quot;, abra o checklist &quot;TCF (Français &amp; Canada)&quot;. Para o TCF Canada, o número do processo do IRCC é pedido na inscrição.</p>
{/prova_tcf}{#prova_exame_civico}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na página &quot;TUDO QUE VOCÊ PRECISA SABER&quot;, abra o checklist &quot;Exame Cívico&quot; e as fichas gratuitas de preparação do Ministério do Interior. O exame é obrigatório desde 1º de janeiro de 2026 em três pedidos: carte pluriannuelle, carte de résident e naturalização. Confirme no centro onde vai fazer o valor e a data.</p>
{/prova_exame_civico}{#prova_ingles}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na página &quot;TUDO QUE VOCÊ PRECISA SABER&quot;, abra o checklist &quot;TOEIC / CAE / CPE&quot; e a aba &quot;Simulados&quot;, que tem amostras oficiais.</p>
{/prova_ingles}{#prova_outro}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O painel funciona para qualquer prova: cadastre a sua em CERTIFICADOS e crie as habilidades dela. A biblioteca de links não cobre a sua prova ainda. Responda este e-mail dizendo qual é, para eu saber o que incluir.</p>
{/prova_outro}{#prova_indeciso}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para a sua prova:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Na página &quot;TUDO QUE VOCÊ PRECISA SABER&quot;, abra &quot;Saiba antes&quot; e a tabela &quot;Qual certificado escolher para cada situação&quot;.</p>
{/prova_indeciso}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Depois, escolha um dia fixo da semana para a Revisão Semanal, que leva 10 minutos. É ela que mantém o painel funcionando.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se travar em alguma parte, responda este e-mail.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd, do Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o Painel do Certificado no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$cert_guia_1_h$,
  $cert_guia_1_b${"assunto":"Seu painel do certificado está aqui","pre":"O link para duplicar e por onde começar.","rodape":"pediu o Painel do Certificado no Por Dentro com {email}","itens":[{"tipo":"texto","texto":"Olá, {nome}.","alt":"Olá."},{"tipo":"texto","texto":"Aqui está o seu painel:"},{"tipo":"botao","rotulo":"Abrir o painel no Notion","link":"link_painel"},{"tipo":"texto","texto":"Abra o link e clique em \"Duplicate\" (duplicar), no canto superior direito. A cópia vai para o seu Notion e passa a ser sua."},{"tipo":"texto","texto":"Para começar, abra o certificado \"EXEMPLO · DELF B2 até fevereiro\". Ele já vem preenchido, e cada página dele explica para que serve. Quando entender, apague os itens com \"EXEMPLO\" no nome e cadastre a sua prova e a data."},{"tipo":"etapa","se":"#prova_delf","rotulo":"Para a sua prova:","texto":"Na página \"TUDO QUE VOCÊ PRECISA SABER\", abra o checklist \"DELF / DALF\" e a aba \"Simulados\". Comece pelos sujets oficiais da France Éducation International."},{"tipo":"etapa","se":"#prova_tcf","rotulo":"Para a sua prova:","texto":"Na página \"TUDO QUE VOCÊ PRECISA SABER\", abra o checklist \"TCF (Français & Canada)\". Para o TCF Canada, o número do processo do IRCC é pedido na inscrição."},{"tipo":"etapa","se":"#prova_exame_civico","rotulo":"Para a sua prova:","texto":"Na página \"TUDO QUE VOCÊ PRECISA SABER\", abra o checklist \"Exame Cívico\" e as fichas gratuitas de preparação do Ministério do Interior. O exame é obrigatório desde 1º de janeiro de 2026 em três pedidos: carte pluriannuelle, carte de résident e naturalização. Confirme no centro onde vai fazer o valor e a data."},{"tipo":"etapa","se":"#prova_ingles","rotulo":"Para a sua prova:","texto":"Na página \"TUDO QUE VOCÊ PRECISA SABER\", abra o checklist \"TOEIC / CAE / CPE\" e a aba \"Simulados\", que tem amostras oficiais."},{"tipo":"etapa","se":"#prova_outro","rotulo":"Para a sua prova:","texto":"O painel funciona para qualquer prova: cadastre a sua em CERTIFICADOS e crie as habilidades dela. A biblioteca de links não cobre a sua prova ainda. Responda este e-mail dizendo qual é, para eu saber o que incluir."},{"tipo":"etapa","se":"#prova_indeciso","rotulo":"Para a sua prova:","texto":"Na página \"TUDO QUE VOCÊ PRECISA SABER\", abra \"Saiba antes\" e a tabela \"Qual certificado escolher para cada situação\"."},{"tipo":"texto","texto":"Depois, escolha um dia fixo da semana para a Revisão Semanal, que leva 10 minutos. É ela que mantém o painel funcionando."},{"tipo":"texto","texto":"Se travar em alguma parte, responda este e-mail."},{"tipo":"assinatura","texto":"Ingryd, do Por Dentro"}],"v":1,"planos":{}}$cert_guia_1_b$::jsonb,
  'painel do certificado: texto aprovado em rascunho, em blocos', now()
where exists (select 1 from public.modelos_email where chave = 'cert_guia_1')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'cert_guia_1');
