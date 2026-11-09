-- Por Dentro — Estúdio de e-mails: os 2 e-mails do guia "Checklist de chegada da au pair" (08/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-chegada-au-pair.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Au pair · checklist de chegada (e-mail 1)   serviço, sai 5 minutos depois de pegar o guia (origem guia-checklist-chegada-au-pair).
--       Entrega o checklist, destaca o único passo com prazo e pergunta qual passo está mais pesado. NÃO fala do app beta.
--   Au pair · checklist beta (e-mail 2)         novidades (só quem aceitou), sai 2 dias depois do e-mail 1, às 10h.
--       Oferece o checklist beta gratuito: criar login e senha na plataforma (botão com link_acesso).
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. O botão "Abrir o checklist" já aponta para o checklist publicado no Notion (notion.site). Confira que a página abre sem login.
--   2. Rode também crm-guia-chegada-au-pair-link.sql: ele registra o mesmo endereço para a página do guia (ela mostra o link depois do cadastro).
--   3. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23); com cron de hora em hora sai na próxima rodada.
--   4. O e-mail 2 usa link_acesso (o app): confira para onde ele abre o cadastro.
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('aupair_chegada_1', 'aupair_chegada_2') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('aupair_chegada_1', 'aupair_chegada_2') and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- Confere o pré-requisito antes de criar qualquer coisa (evita o erro técnico "column envio_minutos does not exist").
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
values ('aupair_chegada_1', 'Au pair · checklist de chegada (e-mail 1)', 'Entrega de freebie: O que ela pediu num guia: o prazo dela e um próximo passo.', 'servico',
  'Sozinho, pela parte Envio (sequência).', 'pegou o checklist de chegada da au pair',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 550, true, 'freebie', '{"materiais":["guia-checklist-chegada-au-pair"]}'::jsonb,
  'material', 'guia-checklist-chegada-au-pair', null, null, 5, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aupair_chegada_1', 1, 'rascunho',
  $aupair_chegada_1_a${#nome}{nome}, seu checklist de chegada de au pair, na ordem{/nome}{^nome}Seu checklist de chegada de au pair, na ordem{/nome}$aupair_chegada_1_a$,
  $aupair_chegada_1_p$Sete passos, um destrava o outro. Comece pelo que tem prazo.$aupair_chegada_1_p$,
  $aupair_chegada_1_t$O seu checklist de chegada, na ordem

{#nome}Oi {nome}! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.{/nome}{^nome}Oi! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.{/nome}

Abrir o checklist: https://topordentroviagens.notion.site/Checklist-de-chegada-da-au-pair-o-que-fazer-e-em-que-ordem-412d602254ce812cb2cbd1f135b623c4

O passo com prazo
Valide o visto online, em até 3 meses da chegada
Fonte: Ministério do Interior (validação do VLS-TS em linha) e France-Visas.

Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família.

Qual passo está mais pesado para você agora?
É só responder este e-mail. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o checklist de chegada da au pair no Por Dentro com {email}.$aupair_chegada_1_t$,
  $aupair_chegada_1_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O seu checklist de chegada, na ordem</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.{/nome}{^nome}Oi! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.{/nome}</p>
<p style="margin:0 0 24px;"><a href="https://topordentroviagens.notion.site/Checklist-de-chegada-da-au-pair-o-que-fazer-e-em-que-ordem-412d602254ce812cb2cbd1f135b623c4" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o checklist</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O passo com prazo</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;">Valide o visto online, em até 3 meses da chegada</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Fonte: Ministério do Interior (validação do VLS-TS em linha) e France-Visas.</div></td></tr></table>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Qual passo está mais pesado para você agora?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o checklist de chegada da au pair no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$aupair_chegada_1_h$,
  $aupair_chegada_1_b${"assunto":"{nome}, seu checklist de chegada de au pair, na ordem","assunto_alt":"Seu checklist de chegada de au pair, na ordem","pre":"Sete passos, um destrava o outro. Comece pelo que tem prazo.","rodape":"pediu o checklist de chegada da au pair no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"O seu checklist de chegada, na ordem"},{"tipo":"texto","texto":"Oi {nome}! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje.","alt":"Oi! Aqui está o checklist de chegada da au pair: sete passos, na ordem em que um destrava o outro. Não precisa fazer tudo hoje."},{"tipo":"botao","rotulo":"Abrir o checklist","url":"https://topordentroviagens.notion.site/Checklist-de-chegada-da-au-pair-o-que-fazer-e-em-que-ordem-412d602254ce812cb2cbd1f135b623c4"},{"tipo":"destaque","rotulo":"O passo com prazo","valor":"Valide o visto online, em até 3 meses da chegada","nota":"Fonte: Ministério do Interior (validação do VLS-TS em linha) e France-Visas."},{"tipo":"texto","texto":"Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família.","alt":"Os outros seis (casa e contrato, conta bancária, número de sécu, professor de francês, saúde complementar e prazos) vão no seu ritmo. Um detalhe que muita gente descobre tarde: no número de sécu, quem começa a demarche é a família."},{"tipo":"pergunta","texto":"Qual passo está mais pesado para você agora?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aupair_chegada_1_b$::jsonb,
  'e-mail 1 do guia de chegada da au pair 08/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aupair_chegada_1' and criado_no_estudio and objetivo_chave = 'freebie')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aupair_chegada_1');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('aupair_chegada_2', 'Au pair · checklist beta (e-mail 2)', 'Conversa: Uma pergunta para ela responder por e-mail.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou o checklist de chegada da au pair e aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"}]'::jsonb, 551, true, 'conversa', '{"materiais":["guia-checklist-chegada-au-pair"]}'::jsonb,
  'email', 'aupair_chegada_1', 2, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'aupair_chegada_2', 1, 'rascunho',
  $aupair_chegada_2_a${#nome}{nome}, um lugar para marcar cada passo do checklist{/nome}{^nome}Um lugar para marcar cada passo do checklist{/nome}$aupair_chegada_2_a$,
  $aupair_chegada_2_p$Meu checklist beta é gratuito: você cria o login e a senha e entra.$aupair_chegada_2_p$,
  $aupair_chegada_2_t$Quer marcar cada passo em um lugar só?

{#nome}Oi {nome}! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.{/nome}{^nome}Oi! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.{/nome}

Criar meu acesso grátis (beta): {link_acesso}

É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro.

Algum passo do checklist ficou confuso?
É só responder este e-mail. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist de chegada da au pair no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$aupair_chegada_2_t$,
  $aupair_chegada_2_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Quer marcar cada passo em um lugar só?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi {nome}! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.{/nome}{^nome}Oi! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.{/nome}</p>
<p style="margin:0 0 24px;"><a href="{link_acesso}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Criar meu acesso grátis (beta)</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro.</p>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Algum passo do checklist ficou confuso?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist de chegada da au pair no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$aupair_chegada_2_h$,
  $aupair_chegada_2_b${"assunto":"{nome}, um lugar para marcar cada passo do checklist","assunto_alt":"Um lugar para marcar cada passo do checklist","pre":"Meu checklist beta é gratuito: você cria o login e a senha e entra.","rodape":"pediu o checklist de chegada da au pair no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"Quer marcar cada passo em um lugar só?"},{"tipo":"texto","texto":"Oi {nome}! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra.","alt":"Oi! Faz alguns dias que você pegou o checklist de chegada. Se você quer ir marcando o que já fez e ver os prazos num lugar só, tenho o meu checklist beta, que é gratuito: você cria o seu login e a sua senha e entra."},{"tipo":"botao","rotulo":"Criar meu acesso grátis (beta)","link":"link_acesso"},{"tipo":"texto","texto":"É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro.","alt":"É uma versão beta: ela ainda está crescendo, e o seu retorno me ajuda a decidir o que entra primeiro."},{"tipo":"pergunta","texto":"Algum passo do checklist ficou confuso?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$aupair_chegada_2_b$::jsonb,
  'e-mail 2 do guia de chegada da au pair 08/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'aupair_chegada_2' and criado_no_estudio and objetivo_chave = 'conversa')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'aupair_chegada_2');
