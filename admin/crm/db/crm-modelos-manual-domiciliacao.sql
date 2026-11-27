-- Por Dentro — Estúdio de e-mails: os 2 e-mails do modelo grátis "mudança de endereço" do Manual Destrave (27/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-manual-domiciliacao.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO. NENHUMA tabela, função ou política nova:
-- a página chama a capturar_lead_guia de sempre e o gatilho "material" lê o evento email_capturado (origem manual-destrave-domiciliacao).
--   Domiciliação · modelo grátis (e-mail 1)   serviço, sai 5 minutos depois do cadastro (origem manual-destrave-domiciliacao).
--       Entrega a carta em francês com os campos entre parênteses. Não vende nada (é serviço).
--   Domiciliação · Manual (e-mail 2)          novidades (só quem aceitou), sai 2 dias depois do e-mail 1, às 10h.
--       Apresenta o Manual e leva à página (#preco), com UTM.
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. A página /manual-destrave-domiciliacao/ precisa estar no ar (merge) com o formulário ligado à capturar_lead_guia.
--   2. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23); com cron de hora em hora sai na próxima rodada.
--   3. O Worker publicado precisa aceitar modelos novos do estúdio (crmSequenciasRodada). Nenhuma mudança de código foi feita para este guia.
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa (a carta vai com os campos em branco). Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('dom_modelo_1', 'dom_modelo_2') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('dom_modelo_1', 'dom_modelo_2') and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- Confere o pré-requisito antes de criar qualquer coisa.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'modelos_email' and column_name = 'envio_minutos') then
    raise exception 'Falta rodar antes o crm-sequencia-minutos.sql (e, antes dele, o crm-filtro-etapa.sql) neste banco. Depois rode este arquivo de novo.';
  end if;
  if to_regclass('public.modelos_email_versoes') is null then
    raise exception 'Falta rodar antes o crm-estudio-emails-3.sql neste banco. Depois rode este arquivo de novo.';
  end if;
end
$$;

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('dom_modelo_1', 'Domiciliação · modelo grátis (e-mail 1)', 'Entrega de freebie: O que ela pediu num guia: o prazo dela e um próximo passo.', 'servico',
  'Sozinho, pela parte Envio (sequência).', 'pegou o modelo grátis do Manual Destrave',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"porta_estudante","o_que_e":"a porta que ela escolheu: Estudante","se_faltar":"o bloco some"},{"nome":"porta_trabalho","o_que_e":"a porta que ela escolheu: Trabalho com contrato","se_faltar":"o bloco some"},{"nome":"porta_aupair","o_que_e":"a porta que ela escolheu: Au pair","se_faltar":"o bloco some"},{"nome":"porta_outro","o_que_e":"a porta que ela escolheu: Outro ou não sei","se_faltar":"o bloco some"},{"nome":"ponto_nao_cheguei","o_que_e":"o ponto da saúde: ainda não chegou","se_faltar":"o bloco some"},{"nome":"ponto_sem_numero","o_que_e":"o ponto da saúde: chegou e está sem número","se_faltar":"o bloco some"},{"nome":"ponto_esperando","o_que_e":"o ponto da saúde: pediu e está esperando","se_faltar":"o bloco some"},{"nome":"ponto_sem_vitale","o_que_e":"o ponto da saúde: tem o número e não a carte vitale","se_faltar":"o bloco some"},{"nome":"ponto_completo","o_que_e":"o ponto da saúde: já tem a carte vitale","se_faltar":"o bloco some"},{"nome":"astucia_a0007","o_que_e":"astúcia A-0007 (inscrição no ameli antes da chegada) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0008","o_que_e":"astúcia A-0008 (Puma e atividade profissional) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0009","o_que_e":"astúcia A-0009 (declaração da família na Urssaf) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"retomada_estudante","o_que_e":"e-mail 2: a porta é Estudante e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_trabalho","o_que_e":"e-mail 2: a porta é Trabalho com contrato e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_aupair","o_que_e":"e-mail 2: a porta é Au pair e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_outro","o_que_e":"e-mail 2: a porta é Outro ou não sei e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"secao","o_que_e":"a seção do mapa da saúde que ela abre primeiro","se_faltar":"tronco do mapa"},{"nome":"assunto_persona","o_que_e":"o assunto do e-mail 1 para a persona dela (porta e ponto)","se_faltar":"fica vazio"},{"nome":"assunto_retomada","o_que_e":"o assunto do e-mail 2 (retomada) para a persona dela","se_faltar":"fica vazio"}]'::jsonb, 570, true, 'freebie', '{"materiais":["manual-destrave-domiciliacao"]}'::jsonb,
  'material', 'manual-destrave-domiciliacao', null, null, 5, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'dom_modelo_1', 1, 'rascunho',
  $dom_modelo_1_a${#nome}{nome}, a carta de mudança de endereço, para copiar{/nome}{^nome}A carta de mudança de endereço, para copiar{/nome}$dom_modelo_1_a$,
  $dom_modelo_1_p$O modelo em francês, com os campos para preencher.$dom_modelo_1_p$,
  $dom_modelo_1_t$A carta, pronta para copiar

{#nome}Oi {nome}! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.{/nome}{^nome}Oi! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.{/nome}

Objet : Changement d'adresse au sein de la même commune

Madame, Monsieur,

Je vous informe de mon changement d'adresse au sein de la même commune, à compter du (data da mudança). Mon ancienne adresse était : (endereço antigo). Ma nouvelle adresse est : (endereço novo).

Mon numéro de dossier auprès de (CAF, CPAM…) est : (número do dossiê).

Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.

Cordialement,
(seu nome)

Troque o que está entre parênteses pelos seus dados e envie ao órgão. Eu não guardo o seu endereço nem o número do dossiê: o que você digitou no site ficou só na página.

Modelo de exemplo: adapte ao seu caso e confirme na fonte oficial do órgão antes de enviar. Isto não é aconselhamento jurídico.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o modelo de mudança de endereço no Por Dentro com {email}.$dom_modelo_1_t$,
  $dom_modelo_1_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">A carta, pronta para copiar</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.{/nome}{^nome}Oi! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.{/nome}</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Objet : Changement d&#39;adresse au sein de la même commune<br><br>Madame, Monsieur,<br><br>Je vous informe de mon changement d&#39;adresse au sein de la même commune, à compter du (data da mudança). Mon ancienne adresse était : (endereço antigo). Ma nouvelle adresse est : (endereço novo).<br><br>Mon numéro de dossier auprès de (CAF, CPAM…) est : (número do dossiê).<br><br>Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m&#39;en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.<br><br>Cordialement,<br>(seu nome)</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Troque o que está entre parênteses pelos seus dados e envie ao órgão. Eu não guardo o seu endereço nem o número do dossiê: o que você digitou no site ficou só na página.</p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Modelo de exemplo: adapte ao seu caso e confirme na fonte oficial do órgão antes de enviar. Isto não é aconselhamento jurídico.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o modelo de mudança de endereço no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$dom_modelo_1_h$,
  $dom_modelo_1_b${"assunto":"{nome}, a carta de mudança de endereço, para copiar","assunto_alt":"A carta de mudança de endereço, para copiar","pre":"O modelo em francês, com os campos para preencher.","rodape":"pediu o modelo de mudança de endereço no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"A carta, pronta para copiar"},{"tipo":"texto","texto":"Oi {nome}! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade.","alt":"Oi! Aqui está o modelo de carta para avisar a mudança de endereço dentro da mesma cidade."},{"tipo":"texto","estilo":"caixa","texto":"Objet : Changement d'adresse au sein de la même commune\n\nMadame, Monsieur,\n\nJe vous informe de mon changement d'adresse au sein de la même commune, à compter du (data da mudança). Mon ancienne adresse était : (endereço antigo). Ma nouvelle adresse est : (endereço novo).\n\nMon numéro de dossier auprès de (CAF, CPAM…) est : (número do dossiê).\n\nJe vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.\n\nCordialement,\n(seu nome)"},{"tipo":"texto","texto":"Troque o que está entre parênteses pelos seus dados e envie ao órgão. Eu não guardo o seu endereço nem o número do dossiê: o que você digitou no site ficou só na página."},{"tipo":"texto","texto":"Modelo de exemplo: adapte ao seu caso e confirme na fonte oficial do órgão antes de enviar. Isto não é aconselhamento jurídico."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$dom_modelo_1_b$::jsonb,
  'e-mail 1 do modelo grátis da domiciliação 27/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'dom_modelo_1' and criado_no_estudio and objetivo_chave = 'freebie')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'dom_modelo_1');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('dom_modelo_2', 'Domiciliação · Manual (e-mail 2)', 'Conversa: Uma pergunta para ela responder por e-mail.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou o modelo grátis do Manual Destrave e aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"porta_estudante","o_que_e":"a porta que ela escolheu: Estudante","se_faltar":"o bloco some"},{"nome":"porta_trabalho","o_que_e":"a porta que ela escolheu: Trabalho com contrato","se_faltar":"o bloco some"},{"nome":"porta_aupair","o_que_e":"a porta que ela escolheu: Au pair","se_faltar":"o bloco some"},{"nome":"porta_outro","o_que_e":"a porta que ela escolheu: Outro ou não sei","se_faltar":"o bloco some"},{"nome":"ponto_nao_cheguei","o_que_e":"o ponto da saúde: ainda não chegou","se_faltar":"o bloco some"},{"nome":"ponto_sem_numero","o_que_e":"o ponto da saúde: chegou e está sem número","se_faltar":"o bloco some"},{"nome":"ponto_esperando","o_que_e":"o ponto da saúde: pediu e está esperando","se_faltar":"o bloco some"},{"nome":"ponto_sem_vitale","o_que_e":"o ponto da saúde: tem o número e não a carte vitale","se_faltar":"o bloco some"},{"nome":"ponto_completo","o_que_e":"o ponto da saúde: já tem a carte vitale","se_faltar":"o bloco some"},{"nome":"astucia_a0007","o_que_e":"astúcia A-0007 (inscrição no ameli antes da chegada) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0008","o_que_e":"astúcia A-0008 (Puma e atividade profissional) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0009","o_que_e":"astúcia A-0009 (declaração da família na Urssaf) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"retomada_estudante","o_que_e":"e-mail 2: a porta é Estudante e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_trabalho","o_que_e":"e-mail 2: a porta é Trabalho com contrato e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_aupair","o_que_e":"e-mail 2: a porta é Au pair e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_outro","o_que_e":"e-mail 2: a porta é Outro ou não sei e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"secao","o_que_e":"a seção do mapa da saúde que ela abre primeiro","se_faltar":"tronco do mapa"},{"nome":"assunto_persona","o_que_e":"o assunto do e-mail 1 para a persona dela (porta e ponto)","se_faltar":"fica vazio"},{"nome":"assunto_retomada","o_que_e":"o assunto do e-mail 2 (retomada) para a persona dela","se_faltar":"fica vazio"}]'::jsonb, 571, true, 'conversa', '{"materiais":["manual-destrave-domiciliacao"]}'::jsonb,
  'email', 'dom_modelo_1', 2, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'dom_modelo_2', 1, 'rascunho',
  $dom_modelo_2_a${#nome}{nome}, os outros 7 modelos de carta do Manual{/nome}{^nome}Os outros 7 modelos de carta do Manual{/nome}$dom_modelo_2_a$,
  $dom_modelo_2_p$Mudança de cidade, renovação, recusa do CCAS e mais.$dom_modelo_2_p$,
  $dom_modelo_2_t${#nome}Oi {nome}! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.{/nome}{^nome}Oi! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.{/nome}

O que vem no Manual
8 modelos de carta e e-mail
3 formulários oficiais a 1 clique
Base legal e data em cada item
Pagamento único, atualizações por 1 ano e garantia de 7 dias, por e-mail.

Ver o Manual: https://imigrantepordentro.com/manual-destrave-domiciliacao/?utm_source=email&utm_medium=email&utm_campaign=destrave&utm_content=dom_modelo_2#preco

Não garante que o órgão vai aceitar o seu pedido: quem decide é ele. O Manual organiza o caminho e os textos.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o modelo de mudança de endereço no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$dom_modelo_2_t$,
  $dom_modelo_2_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.{/nome}{^nome}Oi! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.{/nome}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="#2B2B2B" style="background:#2B2B2B; border-radius:2px; padding:18px 22px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#DEB975;">O que vem no Manual</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:18px; font-weight:800; line-height:1.4; color:#FBFAF7; margin:8px 0 0;">8 modelos de carta e e-mail<br>3 formulários oficiais a 1 clique<br>Base legal e data em cada item</div><div style="border-top:1px solid #4A4743; margin-top:12px; padding-top:10px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#D9D2C6;">Pagamento único, atualizações por 1 ano e garantia de 7 dias, por e-mail.</div></td></tr></table>
<p style="margin:0 0 24px;"><a href="https://imigrantepordentro.com/manual-destrave-domiciliacao/?utm_source=email&amp;utm_medium=email&amp;utm_campaign=destrave&amp;utm_content=dom_modelo_2#preco" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Ver o Manual</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Não garante que o órgão vai aceitar o seu pedido: quem decide é ele. O Manual organiza o caminho e os textos.</p>
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o modelo de mudança de endereço no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$dom_modelo_2_h$,
  $dom_modelo_2_b${"assunto":"{nome}, os outros 7 modelos de carta do Manual","assunto_alt":"Os outros 7 modelos de carta do Manual","pre":"Mudança de cidade, renovação, recusa do CCAS e mais.","rodape":"pediu o modelo de mudança de endereço no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair","itens":[{"tipo":"texto","texto":"Oi {nome}! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu.","alt":"Oi! Passando para contar o que mais há no Manual Destrave: Endereço e Domiciliação, o manual de onde saiu a carta que você pediu."},{"tipo":"destaque","rotulo":"O que vem no Manual","valor":"8 modelos de carta e e-mail\n3 formulários oficiais a 1 clique\nBase legal e data em cada item","nota":"Pagamento único, atualizações por 1 ano e garantia de 7 dias, por e-mail."},{"tipo":"botao","rotulo":"Ver o Manual","url":"https://imigrantepordentro.com/manual-destrave-domiciliacao/?utm_source=email&utm_medium=email&utm_campaign=destrave&utm_content=dom_modelo_2#preco"},{"tipo":"texto","texto":"Não garante que o órgão vai aceitar o seu pedido: quem decide é ele. O Manual organiza o caminho e os textos."},{"tipo":"texto","estilo":"caixa","texto":"**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$dom_modelo_2_b$::jsonb,
  'e-mail 2 do modelo grátis da domiciliação 27/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'dom_modelo_2' and criado_no_estudio and objetivo_chave = 'conversa')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'dom_modelo_2');
