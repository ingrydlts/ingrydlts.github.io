-- Por Dentro — Estúdio de e-mails: recap do guia do tecnólogo, 30 minutos depois do cadastro (03/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-tecnologo-recap.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Tecnólogo · recap do checklist (30 min)   tipo serviço (é o que ela pediu), sai 30 minutos depois de pegar o guia-tecnologo.
-- Para ir ao ar: no Estúdio de e-mails, abra o modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
-- Quem se cadastrar antes de o Envio ser ligado não recebe (só vale quem passar do horário depois de ligar).
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave = 'tec_recap_30min' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave = 'tec_recap_30min' and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('tec_recap_30min', 'Tecnólogo · recap do checklist (30 min)', 'Entrega de freebie: O que ela pediu num guia: o prazo dela e um próximo passo.', 'servico',
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 540, true, 'freebie', '{"materiais":["guia-tecnologo"]}'::jsonb,
  'material', 'guia-tecnologo', null, null, 30, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'tec_recap_30min', 1, 'rascunho',
  $tec_recap_30min_a${#nome}{nome}, o checklist do tecnólogo de novo, para você guardar{/nome}{^nome}O checklist do tecnólogo de novo, para você guardar{/nome}$tec_recap_30min_a$,
  $tec_recap_30min_p$O link e o modelo de e-mail em francês, para não se perder.$tec_recap_30min_p$,
  $tec_recap_30min_t$O link do checklist, para você guardar

{#nome}Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}

Abrir o checklist e o modelo de e-mail: https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1

Dentro do link
Os 5 passos para descobrir o seu nível
O e-mail em francês para perguntar à escola
O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução.

Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso não é regra: entre em contato com as universidades.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email}.$tec_recap_30min_t$,
  $tec_recap_30min_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O link do checklist, para você guardar</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}</p>
<p style="margin:0 0 24px;"><a href="https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o checklist e o modelo de e-mail</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Dentro do link</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Os 5 passos para descobrir o seu nível<br>O e-mail em francês para perguntar à escola</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso <b>não é regra</b>: entre em contato com as universidades.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o guia do tecnólogo no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$tec_recap_30min_h$,
  $tec_recap_30min_b${"assunto":"{nome}, o checklist do tecnólogo de novo, para você guardar","assunto_alt":"O checklist do tecnólogo de novo, para você guardar","pre":"O link e o modelo de e-mail em francês, para não se perder.","rodape":"pediu o guia do tecnólogo no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"O link do checklist, para você guardar"},{"tipo":"texto","texto":"Oi {nome}! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.","alt":"Oi! Há pouco você pediu o guia do tecnólogo. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada."},{"tipo":"botao","rotulo":"Abrir o checklist e o modelo de e-mail","url":"https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1"},{"tipo":"destaque","rotulo":"Dentro do link","valor":"Os 5 passos para descobrir o seu nível\nO e-mail em francês para perguntar à escola","nota":"O primeiro passo é escrever a 3 ou 4 cursos e guardar a resposta por escrito. Só depois pague taxa ou tradução."},{"tipo":"texto","texto":"Um lembrete importante: não existe tabela oficial de equivalência, e quem decide o seu nível é a escola. Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1, mas isso **não é regra**: entre em contato com as universidades."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$tec_recap_30min_b$::jsonb,
  'recap do guia do tecnólogo 03/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'tec_recap_30min' and criado_no_estudio and objetivo_chave = 'freebie')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'tec_recap_30min');
