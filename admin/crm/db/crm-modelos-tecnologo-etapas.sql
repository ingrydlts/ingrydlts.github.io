-- Por Dentro — Estúdio de e-mails: os e-mails do guia do tecnólogo, um para cada etapa (04/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql e crm-modelo-tecnologo-recap.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-tecnologo.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos, com o Envio DESLIGADO. Não publica nada e não muda nenhuma versão No ar:
--   1. tec_recap_30min: uma versão nova em rascunho, com um parágrafo só para a etapa que a pessoa marcou (4 opções).
--   2. Quatro e-mails de 3 dias depois do recap, um por etapa (novidades: só quem aceitou), cada um com a regra "Etapa do guia":
--        tec_d3_nao_sei  (tec-nao-sei)
--        tec_d3_juntando  (tec-juntando)
--        tec_d3_escrevi  (tec-escrevi)
--        tec_d3_resposta  (tec-resposta)
-- Para ir ao ar: no estúdio, abra cada modelo, confira a prévia, mande o teste, publique e ligue o Envio.
-- Quem não marcou nenhuma etapa não recebe os e-mails de 3 dias (regra do filtro por etapa).
--
-- Segurança: só textos e regras de modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota like 'tecnólogo por etapa 04/11/2026%' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('tec_d3_nao_sei', 'tec_d3_juntando', 'tec_d3_escrevi', 'tec_d3_resposta')
--      and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- ---------- 1. tec_recap_30min: versão nova em rascunho, com o parágrafo da etapa ----------
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_recap_30min', (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = 'tec_recap_30min'), 'rascunho',
  $tec_recap_30min_v2_a${#nome}{nome}, o checklist do tecnólogo de novo, para você guardar{/nome}{^nome}O checklist do tecnólogo de novo, para você guardar{/nome}$tec_recap_30min_v2_a$,
  $tec_recap_30min_v2_p$O link e o modelo de e-mail em francês, para não se perder.$tec_recap_30min_v2_p$,
  $tec_recap_30min_v2_t$O link do checklist, para você guardar

{#nome}Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}

{#etapa_nao_sei}Você marcou que ainda não sabe em que nível entraria. É normal: nem a França tem uma tabela para isso. Comece pelo passo 1 do checklist: juntar histórico, diploma e a carga horária total do curso.

{/etapa_nao_sei}{#etapa_juntando}Você marcou que está juntando histórico, diploma e carga horária. Então vá direto ao passo 2 do checklist: comparar a carga horária do seu curso com a de cada ano da licence.

{/etapa_juntando}{#etapa_escrevi}Você marcou que já escreveu para escolas e está esperando. Enquanto elas respondem, guarde tudo por escrito e releia o passo 4: só pague taxa ou tradução depois de ter resposta.

{/etapa_escrevi}{#etapa_resposta}Você marcou que já tem resposta de uma escola. O que importa agora é comparar com a resposta de outras 2 ou 3 escolas e confirmar por escrito quando o contrato pode ser assinado (passo 5).

{/etapa_resposta}Abrir o checklist e o modelo de e-mail: https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1

Dentro do link
Os 5 passos para descobrir o seu nível
O e-mail em francês para perguntar à escola
O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução.

Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso não é regra: entre em contato com as universidades.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email}.$tec_recap_30min_v2_t$,
  $tec_recap_30min_v2_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O link do checklist, para você guardar</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}</p>
{#etapa_nao_sei}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você marcou que ainda não sabe em que nível entraria. É normal: nem a França tem uma tabela para isso. Comece pelo passo 1 do checklist: juntar histórico, diploma e a carga horária total do curso.</p>
{/etapa_nao_sei}{#etapa_juntando}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você marcou que está juntando histórico, diploma e carga horária. Então vá direto ao passo 2 do checklist: comparar a carga horária do seu curso com a de cada ano da licence.</p>
{/etapa_juntando}{#etapa_escrevi}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você marcou que já escreveu para escolas e está esperando. Enquanto elas respondem, guarde tudo por escrito e releia o passo 4: só pague taxa ou tradução depois de ter resposta.</p>
{/etapa_escrevi}{#etapa_resposta}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Você marcou que já tem resposta de uma escola. O que importa agora é comparar com a resposta de outras 2 ou 3 escolas e confirmar por escrito quando o contrato pode ser assinado (passo 5).</p>
{/etapa_resposta}<p style="margin:0 0 24px;"><a href="https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o checklist e o modelo de e-mail</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Dentro do link</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Os 5 passos para descobrir o seu nível<br>O e-mail em francês para perguntar à escola</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso <b>não é regra</b>: entre em contato com as universidades.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$tec_recap_30min_v2_h$,
  $tec_recap_30min_v2_b${"assunto":"{nome}, o checklist do tecnólogo de novo, para você guardar","assunto_alt":"O checklist do tecnólogo de novo, para você guardar","pre":"O link e o modelo de e-mail em francês, para não se perder.","rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"O link do checklist, para você guardar"},{"tipo":"texto","texto":"Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.","alt":"Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada."},{"tipo":"etapa","se":"#etapa_nao_sei","texto":"Você marcou que ainda não sabe em que nível entraria. É normal: nem a França tem uma tabela para isso. Comece pelo passo 1 do checklist: juntar histórico, diploma e a carga horária total do curso."},{"tipo":"etapa","se":"#etapa_juntando","texto":"Você marcou que está juntando histórico, diploma e carga horária. Então vá direto ao passo 2 do checklist: comparar a carga horária do seu curso com a de cada ano da licence."},{"tipo":"etapa","se":"#etapa_escrevi","texto":"Você marcou que já escreveu para escolas e está esperando. Enquanto elas respondem, guarde tudo por escrito e releia o passo 4: só pague taxa ou tradução depois de ter resposta."},{"tipo":"etapa","se":"#etapa_resposta","texto":"Você marcou que já tem resposta de uma escola. O que importa agora é comparar com a resposta de outras 2 ou 3 escolas e confirmar por escrito quando o contrato pode ser assinado (passo 5)."},{"tipo":"botao","rotulo":"Abrir o checklist e o modelo de e-mail","url":"https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1"},{"tipo":"destaque","rotulo":"Dentro do link","valor":"Os 5 passos para descobrir o seu nível\nO e-mail em francês para perguntar à escola","nota":"O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução."},{"tipo":"texto","texto":"Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso **não é regra**: entre em contato com as universidades."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$tec_recap_30min_v2_b$::jsonb,
  'tecnólogo por etapa 04/11/2026: recap com o parágrafo da etapa'
where exists (select 1 from public.modelos_email where chave = 'tec_recap_30min' and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_recap_30min' and nota like 'tecnólogo por etapa 04/11/2026%');

-- ---------- 2. Um e-mail de 3 dias depois, para cada etapa ----------
insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('tec_d3_nao_sei', 'Tecnólogo · D+3 · ainda não sei o nível', 'Aquecimento: Você já tem esse número.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo · etapa tec-nao-sei · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"etapa_nao_sei","o_que_e":"etapa do guia: ainda não sabe em que nível entraria","se_faltar":"o bloco some"},{"nome":"etapa_juntando","o_que_e":"etapa do guia: está juntando histórico, diploma e carga horária","se_faltar":"o bloco some"},{"nome":"etapa_escrevi","o_que_e":"etapa do guia: já escreveu para escolas e está esperando","se_faltar":"o bloco some"},{"nome":"etapa_resposta","o_que_e":"etapa do guia: já tem resposta de uma escola","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'aquecimento', '{"materiais":["guia-tecnologo"],"etapas":["tec-nao-sei"]}'::jsonb,
  'email', 'tec_recap_30min', 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_d3_nao_sei', 1, 'rascunho',
  $tec_d3_nao_sei_a${#nome}{nome}, o número que a escola vai pedir primeiro{/nome}{^nome}O número que a escola vai pedir primeiro{/nome}$tec_d3_nao_sei_a$,
  $tec_d3_nao_sei_p$Você já tem esse número.$tec_d3_nao_sei_p$,
  $tec_d3_nao_sei_t$O que decide o seu nível começa por um número

{#nome}Oi {nome}! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?{/nome}{^nome}Oi! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?{/nome}

O número que ajuda: Carga horária total do curso
Está no histórico ou no projeto pedagógico. Com ela e a duração (2 ou 3 anos), a escola decide entre L3 e M1.

Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso não é regra: cada escola decide.

E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo Campus France. Por isso a resposta da escola, por escrito, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.

Seu tecnólogo tem 2 ou 3 anos?
Responda só com o número. Eu leio cada resposta e ela me ajuda a escrever os próximos e-mails.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$tec_d3_nao_sei_t$,
  $tec_d3_nao_sei_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que decide o seu nível começa por um número</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?{/nome}{^nome}Oi! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O número que ajuda</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Carga horária total do curso</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Está no histórico ou no projeto pedagógico. Com ela e a duração (2 ou 3 anos), a escola decide entre L3 e M1.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso <b>não é regra</b>: cada escola decide.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo <b>Campus France</b>. Por isso a resposta da escola, <b>por escrito</b>, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Seu tecnólogo tem 2 ou 3 anos?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda só com o número. Eu leio cada resposta e ela me ajuda a escrever os próximos e-mails.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$tec_d3_nao_sei_h$,
  $tec_d3_nao_sei_b${"assunto":"{nome}, o número que a escola vai pedir primeiro","assunto_alt":"O número que a escola vai pedir primeiro","pre":"Você já tem esse número.","itens":[{"tipo":"titulo","texto":"O que decide o seu nível começa por um número"},{"tipo":"texto","texto":"Oi {nome}! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?","alt":"Oi! Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?"},{"tipo":"destaque","rotulo":"O número que ajuda","valor":"Carga horária total do curso","nota":"Está no histórico ou no projeto pedagógico. Com ela e a duração (2 ou 3 anos), a escola decide entre L3 e M1."},{"tipo":"texto","texto":"Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso **não é regra**: cada escola decide."},{"tipo":"texto","texto":"E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo **Campus France**. Por isso a resposta da escola, **por escrito**, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil."},{"tipo":"pergunta","texto":"Seu tecnólogo tem 2 ou 3 anos?","ajuda":"Responda só com o número. Eu leio cada resposta e ela me ajuda a escrever os próximos e-mails."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","v":1,"planos":{}}$tec_d3_nao_sei_b$::jsonb,
  'tecnólogo por etapa 04/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'tec_d3_nao_sei' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_d3_nao_sei');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('tec_d3_juntando', 'Tecnólogo · D+3 · juntando documentos', 'Aquecimento: Uma tabela simples muda a conversa com a escola.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo · etapa tec-juntando · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"etapa_nao_sei","o_que_e":"etapa do guia: ainda não sabe em que nível entraria","se_faltar":"o bloco some"},{"nome":"etapa_juntando","o_que_e":"etapa do guia: está juntando histórico, diploma e carga horária","se_faltar":"o bloco some"},{"nome":"etapa_escrevi","o_que_e":"etapa do guia: já escreveu para escolas e está esperando","se_faltar":"o bloco some"},{"nome":"etapa_resposta","o_que_e":"etapa do guia: já tem resposta de uma escola","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'aquecimento', '{"materiais":["guia-tecnologo"],"etapas":["tec-juntando"]}'::jsonb,
  'email', 'tec_recap_30min', 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_d3_juntando', 1, 'rascunho',
  $tec_d3_juntando_a${#nome}{nome}, a tabela que falta no seu dossiê{/nome}{^nome}A tabela que falta no seu dossiê{/nome}$tec_d3_juntando_a$,
  $tec_d3_juntando_p$Uma tabela simples muda a conversa com a escola.$tec_d3_juntando_p$,
  $tec_d3_juntando_t$Compare por ano, não pelo diploma inteiro

{#nome}Oi {nome}! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.{/nome}{^nome}Oi! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.{/nome}

O passo 2 do checklist: L1, L2 e L3 ao lado dos seus semestres
A IA da sua preferência ajuda a montar a tabela. Mande ela junto com o e-mail para a escola.

Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso não é regra: cada escola decide.

E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo Campus France. Por isso a resposta da escola, por escrito, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.

Qual documento está demorando mais para chegar?
Responda com uma palavra: histórico, diploma, ementas ou tradução.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$tec_d3_juntando_t$,
  $tec_d3_juntando_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Compare por ano, não pelo diploma inteiro</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.{/nome}{^nome}Oi! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O passo 2 do checklist</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">L1, L2 e L3 ao lado dos seus semestres</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">A IA da sua preferência ajuda a montar a tabela. Mande ela junto com o e-mail para a escola.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso <b>não é regra</b>: cada escola decide.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo <b>Campus France</b>. Por isso a resposta da escola, <b>por escrito</b>, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Qual documento está demorando mais para chegar?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Responda com uma palavra: <b>histórico</b>, <b>diploma</b>, <b>ementas</b> ou <b>tradução</b>.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$tec_d3_juntando_h$,
  $tec_d3_juntando_b${"assunto":"{nome}, a tabela que falta no seu dossiê","assunto_alt":"A tabela que falta no seu dossiê","pre":"Uma tabela simples muda a conversa com a escola.","itens":[{"tipo":"titulo","texto":"Compare por ano, não pelo diploma inteiro"},{"tipo":"texto","texto":"Oi {nome}! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.","alt":"Oi! Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence."},{"tipo":"destaque","rotulo":"O passo 2 do checklist","valor":"L1, L2 e L3 ao lado dos seus semestres","nota":"A IA da sua preferência ajuda a montar a tabela. Mande ela junto com o e-mail para a escola."},{"tipo":"texto","texto":"Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso **não é regra**: cada escola decide."},{"tipo":"texto","texto":"E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo **Campus France**. Por isso a resposta da escola, **por escrito**, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil."},{"tipo":"pergunta","texto":"Qual documento está demorando mais para chegar?","ajuda":"Responda com uma palavra: **histórico**, **diploma**, **ementas** ou **tradução**."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","v":1,"planos":{}}$tec_d3_juntando_b$::jsonb,
  'tecnólogo por etapa 04/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'tec_d3_juntando' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_d3_juntando');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('tec_d3_escrevi', 'Tecnólogo · D+3 · já escrevi e espero', 'Aquecimento: O que dá para adiantar sem gastar nada.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo · etapa tec-escrevi · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"etapa_nao_sei","o_que_e":"etapa do guia: ainda não sabe em que nível entraria","se_faltar":"o bloco some"},{"nome":"etapa_juntando","o_que_e":"etapa do guia: está juntando histórico, diploma e carga horária","se_faltar":"o bloco some"},{"nome":"etapa_escrevi","o_que_e":"etapa do guia: já escreveu para escolas e está esperando","se_faltar":"o bloco some"},{"nome":"etapa_resposta","o_que_e":"etapa do guia: já tem resposta de uma escola","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'aquecimento', '{"materiais":["guia-tecnologo"],"etapas":["tec-escrevi"]}'::jsonb,
  'email', 'tec_recap_30min', 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_d3_escrevi', 1, 'rascunho',
  $tec_d3_escrevi_a${#nome}{nome}, enquanto a escola não responde{/nome}{^nome}Enquanto a escola não responde{/nome}$tec_d3_escrevi_a$,
  $tec_d3_escrevi_p$O que dá para adiantar sem gastar nada.$tec_d3_escrevi_p$,
  $tec_d3_escrevi_t$Esperar não precisa ser ficar parada

{#nome}Oi {nome}! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.{/nome}{^nome}Oi! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.{/nome}

Enquanto espera: Escreva para mais 1 ou 2 cursos
Quanto mais respostas por escrito, mais fácil comparar. Taxa e tradução juramentada só depois da resposta.

E já deixe anotado: ser aceita em L3 não quer dizer que dá para assinar contrato de alternância na hora. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master.

E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo Campus France. Por isso a resposta da escola, por escrito, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.

Alguma escola já respondeu?
Me conta o que disseram, sem dados pessoais. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$tec_d3_escrevi_t$,
  $tec_d3_escrevi_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Esperar não precisa ser ficar parada</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.{/nome}{^nome}Oi! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Enquanto espera</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Escreva para mais 1 ou 2 cursos</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Quanto mais respostas por escrito, mais fácil comparar. Taxa e tradução juramentada só depois da resposta.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E já deixe anotado: ser aceita em L3 não quer dizer que dá para assinar contrato de alternância na hora. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo <b>Campus France</b>. Por isso a resposta da escola, <b>por escrito</b>, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Alguma escola já respondeu?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conta o que disseram, sem dados pessoais. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$tec_d3_escrevi_h$,
  $tec_d3_escrevi_b${"assunto":"{nome}, enquanto a escola não responde","assunto_alt":"Enquanto a escola não responde","pre":"O que dá para adiantar sem gastar nada.","itens":[{"tipo":"titulo","texto":"Esperar não precisa ser ficar parada"},{"tipo":"texto","texto":"Oi {nome}! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.","alt":"Oi! Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada."},{"tipo":"destaque","rotulo":"Enquanto espera","valor":"Escreva para mais 1 ou 2 cursos","nota":"Quanto mais respostas por escrito, mais fácil comparar. Taxa e tradução juramentada só depois da resposta."},{"tipo":"texto","texto":"E já deixe anotado: ser aceita em L3 não quer dizer que dá para assinar contrato de alternância na hora. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master."},{"tipo":"texto","texto":"E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo **Campus France**. Por isso a resposta da escola, **por escrito**, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil."},{"tipo":"pergunta","texto":"Alguma escola já respondeu?","ajuda":"Me conta o que disseram, sem dados pessoais. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","v":1,"planos":{}}$tec_d3_escrevi_b$::jsonb,
  'tecnólogo por etapa 04/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'tec_d3_escrevi' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_d3_escrevi');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('tec_d3_resposta', 'Tecnólogo · D+3 · já tenho resposta', 'Aquecimento: Duas coisas antes de decidir ou pagar qualquer taxa.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo · etapa tec-resposta · aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"etapa_nao_sei","o_que_e":"etapa do guia: ainda não sabe em que nível entraria","se_faltar":"o bloco some"},{"nome":"etapa_juntando","o_que_e":"etapa do guia: está juntando histórico, diploma e carga horária","se_faltar":"o bloco some"},{"nome":"etapa_escrevi","o_que_e":"etapa do guia: já escreveu para escolas e está esperando","se_faltar":"o bloco some"},{"nome":"etapa_resposta","o_que_e":"etapa do guia: já tem resposta de uma escola","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'aquecimento', '{"materiais":["guia-tecnologo"],"etapas":["tec-resposta"]}'::jsonb,
  'email', 'tec_recap_30min', 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_d3_resposta', 1, 'rascunho',
  $tec_d3_resposta_a${#nome}{nome}, o que fazer com a resposta da escola{/nome}{^nome}O que fazer com a resposta da escola{/nome}$tec_d3_resposta_a$,
  $tec_d3_resposta_p$Duas coisas antes de decidir ou pagar qualquer taxa.$tec_d3_resposta_p$,
  $tec_d3_resposta_t$A resposta chegou. E agora?

{#nome}Oi {nome}! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.{/nome}{^nome}Oi! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.{/nome}

Antes de pagar a taxa: Resposta por escrito, de 2 ou 3 escolas
Comparar o nível que cada uma aceita evita pagar por um caminho que outra escola faria melhor.

E confirme quando o contrato de alternância pode ser assinado. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master (no apprentissage). Confirme com a escola e a préfecture, por escrito.

E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo Campus France. Por isso a resposta da escola, por escrito, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.

O que a escola respondeu?
Me conta a resposta, sem dados pessoais, e eu te digo o que olharia primeiro. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$tec_d3_resposta_t$,
  $tec_d3_resposta_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">A resposta chegou. E agora?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.{/nome}{^nome}Oi! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Antes de pagar a taxa</div><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">Resposta por escrito, de 2 ou 3 escolas</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Comparar o nível que cada uma aceita evita pagar por um caminho que outra escola faria melhor.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E confirme quando o contrato de alternância pode ser assinado. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master (no apprentissage). Confirme com a escola e a préfecture, por escrito.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo <b>Campus France</b>. Por isso a resposta da escola, <b>por escrito</b>, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O que a escola respondeu?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Me conta a resposta, sem dados pessoais, e eu te digo o que olharia primeiro. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$tec_d3_resposta_h$,
  $tec_d3_resposta_b${"assunto":"{nome}, o que fazer com a resposta da escola","assunto_alt":"O que fazer com a resposta da escola","pre":"Duas coisas antes de decidir ou pagar qualquer taxa.","itens":[{"tipo":"titulo","texto":"A resposta chegou. E agora?"},{"tipo":"texto","texto":"Oi {nome}! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.","alt":"Oi! Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas."},{"tipo":"destaque","rotulo":"Antes de pagar a taxa","valor":"Resposta por escrito, de 2 ou 3 escolas","nota":"Comparar o nível que cada uma aceita evita pagar por um caminho que outra escola faria melhor."},{"tipo":"texto","texto":"E confirme quando o contrato de alternância pode ser assinado. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master (no apprentissage). Confirme com a escola e a préfecture, por escrito."},{"tipo":"texto","texto":"E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo **Campus France**. Por isso a resposta da escola, **por escrito**, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil."},{"tipo":"pergunta","texto":"O que a escola respondeu?","ajuda":"Me conta a resposta, sem dados pessoais, e eu te digo o que olharia primeiro. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","v":1,"planos":{}}$tec_d3_resposta_b$::jsonb,
  'tecnólogo por etapa 04/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'tec_d3_resposta' and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_d3_resposta');
