-- Por Dentro — Estúdio de e-mails: recap do Painel do Certificado, 30 minutos depois do cadastro (03/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-painel-certificado-recap.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Painel do Certificado · recap (30 min)   tipo serviço (é o que ela pediu), sai 30 minutos depois de pegar o guia-painel-do-certificado.
-- Para ir ao ar: no Estúdio de e-mails, abra o modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
-- Quem se cadastrar antes de o Envio ser ligado não recebe (só vale quem passar do horário depois de ligar).
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave = 'painel_recap_30min' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave = 'painel_recap_30min' and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('painel_recap_30min', 'Painel do Certificado · recap (30 min)', 'Entrega de freebie: O que ela pediu num guia: o prazo dela e um próximo passo.', 'servico',
  'Sozinho, pela parte Envio (sequência).', 'pegou Painel do Certificado',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"etapa_tec_nao_sei","o_que_e":"etapa do guia: ainda não sabe em que nível entraria","se_faltar":"o bloco some"},{"nome":"etapa_tec_juntando","o_que_e":"etapa do guia: está juntando histórico, diploma e carga horária","se_faltar":"o bloco some"},{"nome":"etapa_tec_escrevi","o_que_e":"etapa do guia: já escreveu para escolas e está esperando","se_faltar":"o bloco some"},{"nome":"etapa_tec_resposta","o_que_e":"etapa do guia: já tem resposta de uma escola","se_faltar":"o bloco some"},{"nome":"etapa_cert_delf","o_que_e":"certificado do painel: prepara o DELF","se_faltar":"o bloco some"},{"nome":"etapa_cert_dalf","o_que_e":"certificado do painel: prepara o DALF","se_faltar":"o bloco some"},{"nome":"etapa_cert_tcf_francais","o_que_e":"certificado do painel: prepara o TCF Français","se_faltar":"o bloco some"},{"nome":"etapa_cert_tcf_canada","o_que_e":"certificado do painel: prepara o TCF Canada","se_faltar":"o bloco some"},{"nome":"etapa_cert_exame_civico","o_que_e":"certificado do painel: prepara o Exame Cívico francês","se_faltar":"o bloco some"},{"nome":"etapa_cert_toeic","o_que_e":"certificado do painel: prepara o TOEIC","se_faltar":"o bloco some"},{"nome":"etapa_cert_cae","o_que_e":"certificado do painel: prepara o CAE","se_faltar":"o bloco some"},{"nome":"etapa_cert_cpe","o_que_e":"certificado do painel: prepara o CPE","se_faltar":"o bloco some"},{"nome":"etapa_cert_outro","o_que_e":"certificado do painel: prepara outro certificado","se_faltar":"o bloco some"},{"nome":"etapa_cert_indeciso","o_que_e":"certificado do painel: ainda não sabe qual certificado fazer","se_faltar":"o bloco some"},{"nome":"porta_au_pair","o_que_e":"ela é au pair e já mora na França","se_faltar":"o bloco some"},{"nome":"porta_pvt","o_que_e":"ela está na França por PVT","se_faltar":"o bloco some"},{"nome":"porta_brasil","o_que_e":"ela está no Brasil e quer ir para a França","se_faltar":"o bloco some"},{"nome":"porta_conjuge","o_que_e":"ela vive na França por casamento ou parceria","se_faltar":"o bloco some"}]'::jsonb, 541, true, 'freebie', '{"materiais":["guia-painel-do-certificado"]}'::jsonb,
  'material', 'guia-painel-do-certificado', null, null, 30, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'painel_recap_30min', 1, 'rascunho',
  $painel_recap_30min_a${#nome}{nome}, o Painel do Certificado de novo, para você guardar{/nome}{^nome}O Painel do Certificado de novo, para você guardar{/nome}$painel_recap_30min_a$,
  $painel_recap_30min_p$O link do painel e o que pesa no seu certificado.$painel_recap_30min_p$,
  $painel_recap_30min_t$O link do painel, para você guardar

{#nome}Oi {nome}! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}

Abrir o Painel do Certificado: https://imigrantepordentro.com/produtos-digitais/painel-do-certificado/

Dentro do painel
A prova, a data e a contagem regressiva
As habilidades, os materiais e as práticas da semana
No Notion, clique em Duplicate (duplicar) e abra o certificado de exemplo: cada página dele explica para que serve.

{#porta_au_pair}Para quem é au pair e já mora na França:
Para virar estudante, o francês entra no dossiê.
Quem pede o changement de statut para estudante costuma precisar comprovar o nível de francês que a matrícula pede. Um curso de francês (FLE) com selo Qualité FLE é o caminho mais aceito pelas préfectures. Confirme com a escola qual certificado ela pede.

{/porta_au_pair}{#porta_pvt}Para quem está na França por PVT:
O PVT não renova, então o certificado serve ao próximo passo.
O PVT dura 12 meses e não renova. O certificado entra no seu plano de saída: para estudar, o visto de estudante é pedido do Brasil, depois da volta. Escolha a prova pelo curso que você quer.

{/porta_pvt}{#porta_brasil}Para quem está no Brasil:
A candidatura pede um teste de francês, e o prazo dele conta.
No Études en France valem DELF B2, DALF ou TCF com expressão escrita (o 1º ano e Arquitetura têm regras próprias). Só a inscrição também vale, se a prova for até fevereiro e a duplicata do resultado chegar ao Campus France até 5 de março de 2027.

{/porta_brasil}{#porta_conjuge}Para quem vive na França por casamento ou parceria:
Para a carte de résident, o nível de francês e o exame cívico entram juntos.
Desde 1º de janeiro de 2026, o nível de francês da carte de résident subiu de A2 para B1, e o exame cívico passou a ser obrigatório. Na naturalização, o nível subiu de B1 para B2.

{/porta_conjuge}{#etapa_cert_delf}Para quem está preparando DELF:
Cada prova vale 25 pontos, e a aprovação pede 50 de 100 e pelo menos 5 de 25 em cada prova: uma nota abaixo de 5 elimina, mesmo com o total alto.
O diploma tem validade vitalícia.

{/etapa_cert_delf}{#etapa_cert_dalf}Para quem está preparando DALF:
A aprovação nos dois níveis é 50 de 100.
No C1 há nota mínima de 5 de 25 em cada prova. No C2, a oral vale 50 pontos e a nota mínima por prova é 10 de 50. O diploma tem validade vitalícia.

{/etapa_cert_dalf}{#etapa_cert_tcf_francais}Para quem está preparando TCF Français:
Só acerto conta: erro e questão em branco valem 0, então não deixe nenhuma em branco.
E o resultado vale 2 anos: marque a prova para que ele ainda esteja válido na data do seu pedido.

{/etapa_cert_tcf_francais}{#etapa_cert_tcf_canada}Para quem está preparando TCF Canada:
O TCF Canada serve ao IRCC, e em geral não ao seu pedido na França.
Antes de pagar, confira qual teste o seu visto ou a sua universidade aceita (TCF Français, DELF ou DALF).

{/etapa_cert_tcf_canada}{#etapa_cert_exame_civico}Para quem está preparando Exame Cívico francês:
A preparação é gratuita, no site de formação cívica do Ministério do Interior.
Só a inscrição é paga: cada centro fixa o valor e não reembolsa quem falta sem justificativa. A aprovação pede 32 acertos em 40.

{/etapa_cert_exame_civico}{#etapa_cert_toeic}Para quem está preparando TOEIC:
Você recebe uma nota, e quem define o mínimo é a empresa ou o concurso.
Pergunte o mínimo e se pedem a versão 4 Skills antes de pagar. O resultado vale 2 anos.

{/etapa_cert_toeic}{#etapa_cert_cae}Para quem está preparando CAE:
Com 180 ou mais você recebe o certificado de nível C1.
De 160 a 179, o de nível B2. Se você precisa do C1, o corte de 180 é o que importa. O certificado tem validade vitalícia.

{/etapa_cert_cae}{#etapa_cert_cpe}Para quem está preparando CPE:
Com 200 a 230 você recebe o certificado de nível C2.
De 180 a 199, o de nível C1. O certificado tem validade vitalícia.

{/etapa_cert_cpe}{#etapa_cert_outro}Para quem está preparando outro certificado:
Pergunte à instituição ou à préfecture qual teste ela aceita antes de pagar a inscrição.
Para formações em inglês, vale o teste oficial aceito pela instituição.

{/etapa_cert_outro}{#etapa_cert_indeciso}Para quem ainda não sabe qual certificado fazer:
O nível de francês exigido depende do pedido: A2 para a primeira carte pluriannuelle, B1 para a carte de résident e B2 para a naturalização, mais o exame cívico desde 1º de janeiro de 2026.
Para a maioria dos Masters, o B2 é o nível pedido.

{/etapa_cert_indeciso}Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o Painel do Certificado no Por Dentro com {email}.$painel_recap_30min_t$,
  $painel_recap_30min_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O link do painel, para você guardar</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}{^nome}Oi! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.{/nome}</p>
<p style="margin:0 0 24px;"><a href="https://imigrantepordentro.com/produtos-digitais/painel-do-certificado/" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o Painel do Certificado</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Dentro do painel</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">A prova, a data e a contagem regressiva<br>As habilidades, os materiais e as práticas da semana</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">No Notion, clique em Duplicate (duplicar) e abra o certificado de exemplo: cada página dele explica para que serve.</div></td></tr></table>
{#porta_au_pair}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem é au pair e já mora na França:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Para virar estudante, o francês entra no dossiê.</b><br>Quem pede o changement de statut para estudante costuma precisar comprovar o nível de francês que a matrícula pede. Um curso de francês (FLE) com selo Qualité FLE é o caminho mais aceito pelas préfectures. Confirme com a escola qual certificado ela pede.</p>
{/porta_au_pair}{#porta_pvt}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na França por PVT:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>O PVT não renova, então o certificado serve ao próximo passo.</b><br>O PVT dura 12 meses e não renova. O certificado entra no seu plano de saída: para estudar, o visto de estudante é pedido do Brasil, depois da volta. Escolha a prova pelo curso que você quer.</p>
{/porta_pvt}{#porta_brasil}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está no Brasil:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>A candidatura pede um teste de francês, e o prazo dele conta.</b><br>No Études en France valem DELF B2, DALF ou TCF com expressão escrita (o 1º ano e Arquitetura têm regras próprias). Só a inscrição também vale, se a prova for até fevereiro e a duplicata do resultado chegar ao Campus France até 5 de março de 2027.</p>
{/porta_brasil}{#porta_conjuge}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem vive na França por casamento ou parceria:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Para a carte de résident, o nível de francês e o exame cívico entram juntos.</b><br>Desde 1º de janeiro de 2026, o nível de francês da carte de résident subiu de A2 para B1, e o exame cívico passou a ser obrigatório. Na naturalização, o nível subiu de B1 para B2.</p>
{/porta_conjuge}{#etapa_cert_delf}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando DELF:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Cada prova vale 25 pontos, e a aprovação pede 50 de 100 e pelo menos 5 de 25 em cada prova: uma nota abaixo de 5 elimina, mesmo com o total alto.</b><br>O diploma tem validade vitalícia.</p>
{/etapa_cert_delf}{#etapa_cert_dalf}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando DALF:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>A aprovação nos dois níveis é 50 de 100.</b><br>No C1 há nota mínima de 5 de 25 em cada prova. No C2, a oral vale 50 pontos e a nota mínima por prova é 10 de 50. O diploma tem validade vitalícia.</p>
{/etapa_cert_dalf}{#etapa_cert_tcf_francais}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando TCF Français:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Só acerto conta: erro e questão em branco valem 0, então não deixe nenhuma em branco.</b><br>E o resultado vale 2 anos: marque a prova para que ele ainda esteja válido na data do seu pedido.</p>
{/etapa_cert_tcf_francais}{#etapa_cert_tcf_canada}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando TCF Canada:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>O TCF Canada serve ao IRCC, e em geral não ao seu pedido na França.</b><br>Antes de pagar, confira qual teste o seu visto ou a sua universidade aceita (TCF Français, DELF ou DALF).</p>
{/etapa_cert_tcf_canada}{#etapa_cert_exame_civico}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando Exame Cívico francês:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>A preparação é gratuita, no site de formação cívica do Ministério do Interior.</b><br>Só a inscrição é paga: cada centro fixa o valor e não reembolsa quem falta sem justificativa. A aprovação pede 32 acertos em 40.</p>
{/etapa_cert_exame_civico}{#etapa_cert_toeic}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando TOEIC:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Você recebe uma nota, e quem define o mínimo é a empresa ou o concurso.</b><br>Pergunte o mínimo e se pedem a versão 4 Skills antes de pagar. O resultado vale 2 anos.</p>
{/etapa_cert_toeic}{#etapa_cert_cae}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando CAE:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Com 180 ou mais você recebe o certificado de nível C1.</b><br>De 160 a 179, o de nível B2. Se você precisa do C1, o corte de 180 é o que importa. O certificado tem validade vitalícia.</p>
{/etapa_cert_cae}{#etapa_cert_cpe}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando CPE:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Com 200 a 230 você recebe o certificado de nível C2.</b><br>De 180 a 199, o de nível C1. O certificado tem validade vitalícia.</p>
{/etapa_cert_cpe}{#etapa_cert_outro}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está preparando outro certificado:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Pergunte à instituição ou à préfecture qual teste ela aceita antes de pagar a inscrição.</b><br>Para formações em inglês, vale o teste oficial aceito pela instituição.</p>
{/etapa_cert_outro}{#etapa_cert_indeciso}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem ainda não sabe qual certificado fazer:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>O nível de francês exigido depende do pedido: A2 para a primeira carte pluriannuelle, B1 para a carte de résident e B2 para a naturalização, mais o exame cívico desde 1º de janeiro de 2026.</b><br>Para a maioria dos Masters, o B2 é o nível pedido.</p>
{/etapa_cert_indeciso}<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o Painel do Certificado no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$painel_recap_30min_h$,
  $painel_recap_30min_b${"assunto":"{nome}, o Painel do Certificado de novo, para você guardar","assunto_alt":"O Painel do Certificado de novo, para você guardar","pre":"O link do painel e o que pesa no seu certificado.","rodape":"pediu o Painel do Certificado no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"O link do painel, para você guardar"},{"tipo":"texto","texto":"Oi {nome}! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada.","alt":"Oi! Há pouco você pediu o Painel do Certificado. Deixo o link aqui de novo, para ele ficar guardado na sua caixa de entrada."},{"tipo":"botao","rotulo":"Abrir o Painel do Certificado","url":"https://imigrantepordentro.com/produtos-digitais/painel-do-certificado/"},{"tipo":"destaque","rotulo":"Dentro do painel","valor":"A prova, a data e a contagem regressiva\nAs habilidades, os materiais e as práticas da semana","nota":"No Notion, clique em Duplicate (duplicar) e abra o certificado de exemplo: cada página dele explica para que serve."},{"tipo":"etapa","se":"#porta_au_pair","rotulo":"Para quem é au pair e já mora na França:","titulo":"Para virar estudante, o francês entra no dossiê.","texto":"Quem pede o changement de statut para estudante costuma precisar comprovar o nível de francês que a matrícula pede. Um curso de francês (FLE) com selo Qualité FLE é o caminho mais aceito pelas préfectures. Confirme com a escola qual certificado ela pede."},{"tipo":"etapa","se":"#porta_pvt","rotulo":"Para quem está na França por PVT:","titulo":"O PVT não renova, então o certificado serve ao próximo passo.","texto":"O PVT dura 12 meses e não renova. O certificado entra no seu plano de saída: para estudar, o visto de estudante é pedido do Brasil, depois da volta. Escolha a prova pelo curso que você quer."},{"tipo":"etapa","se":"#porta_brasil","rotulo":"Para quem está no Brasil:","titulo":"A candidatura pede um teste de francês, e o prazo dele conta.","texto":"No Études en France valem DELF B2, DALF ou TCF com expressão escrita (o 1º ano e Arquitetura têm regras próprias). Só a inscrição também vale, se a prova for até fevereiro e a duplicata do resultado chegar ao Campus France até 5 de março de 2027."},{"tipo":"etapa","se":"#porta_conjuge","rotulo":"Para quem vive na França por casamento ou parceria:","titulo":"Para a carte de résident, o nível de francês e o exame cívico entram juntos.","texto":"Desde 1º de janeiro de 2026, o nível de francês da carte de résident subiu de A2 para B1, e o exame cívico passou a ser obrigatório. Na naturalização, o nível subiu de B1 para B2."},{"tipo":"etapa","se":"#etapa_cert_delf","rotulo":"Para quem está preparando DELF:","titulo":"Cada prova vale 25 pontos, e a aprovação pede 50 de 100 e pelo menos 5 de 25 em cada prova: uma nota abaixo de 5 elimina, mesmo com o total alto.","texto":"O diploma tem validade vitalícia."},{"tipo":"etapa","se":"#etapa_cert_dalf","rotulo":"Para quem está preparando DALF:","titulo":"A aprovação nos dois níveis é 50 de 100.","texto":"No C1 há nota mínima de 5 de 25 em cada prova. No C2, a oral vale 50 pontos e a nota mínima por prova é 10 de 50. O diploma tem validade vitalícia."},{"tipo":"etapa","se":"#etapa_cert_tcf_francais","rotulo":"Para quem está preparando TCF Français:","titulo":"Só acerto conta: erro e questão em branco valem 0, então não deixe nenhuma em branco.","texto":"E o resultado vale 2 anos: marque a prova para que ele ainda esteja válido na data do seu pedido."},{"tipo":"etapa","se":"#etapa_cert_tcf_canada","rotulo":"Para quem está preparando TCF Canada:","titulo":"O TCF Canada serve ao IRCC, e em geral não ao seu pedido na França.","texto":"Antes de pagar, confira qual teste o seu visto ou a sua universidade aceita (TCF Français, DELF ou DALF)."},{"tipo":"etapa","se":"#etapa_cert_exame_civico","rotulo":"Para quem está preparando Exame Cívico francês:","titulo":"A preparação é gratuita, no site de formação cívica do Ministério do Interior.","texto":"Só a inscrição é paga: cada centro fixa o valor e não reembolsa quem falta sem justificativa. A aprovação pede 32 acertos em 40."},{"tipo":"etapa","se":"#etapa_cert_toeic","rotulo":"Para quem está preparando TOEIC:","titulo":"Você recebe uma nota, e quem define o mínimo é a empresa ou o concurso.","texto":"Pergunte o mínimo e se pedem a versão 4 Skills antes de pagar. O resultado vale 2 anos."},{"tipo":"etapa","se":"#etapa_cert_cae","rotulo":"Para quem está preparando CAE:","titulo":"Com 180 ou mais você recebe o certificado de nível C1.","texto":"De 160 a 179, o de nível B2. Se você precisa do C1, o corte de 180 é o que importa. O certificado tem validade vitalícia."},{"tipo":"etapa","se":"#etapa_cert_cpe","rotulo":"Para quem está preparando CPE:","titulo":"Com 200 a 230 você recebe o certificado de nível C2.","texto":"De 180 a 199, o de nível C1. O certificado tem validade vitalícia."},{"tipo":"etapa","se":"#etapa_cert_outro","rotulo":"Para quem está preparando outro certificado:","titulo":"Pergunte à instituição ou à préfecture qual teste ela aceita antes de pagar a inscrição.","texto":"Para formações em inglês, vale o teste oficial aceito pela instituição."},{"tipo":"etapa","se":"#etapa_cert_indeciso","rotulo":"Para quem ainda não sabe qual certificado fazer:","titulo":"O nível de francês exigido depende do pedido: A2 para a primeira carte pluriannuelle, B1 para a carte de résident e B2 para a naturalização, mais o exame cívico desde 1º de janeiro de 2026.","texto":"Para a maioria dos Masters, o B2 é o nível pedido."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$painel_recap_30min_b$::jsonb,
  'recap do Painel do Certificado 03/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'painel_recap_30min' and criado_no_estudio and objetivo_chave = 'freebie')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'painel_recap_30min');
