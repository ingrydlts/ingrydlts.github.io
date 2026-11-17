-- Por Dentro — Estúdio de e-mails: os 2 e-mails do guia "Mapa da saúde na França" (17/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-mapa-saude.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Saúde · mapa (e-mail 1)      serviço, sai 5 minutos depois de pegar o guia (origem guia-mapa-saude-franca).
--       Um modelo para as 20 personas: seção, astúcia, pergunta e assunto mudam por porta e ponto. NÃO fala do app beta.
--   Saúde · retomada (e-mail 2)  novidades (só quem aceitou), sai 3 dias depois do e-mail 1, às 10h.
--       Duas frases e o botão da conversa. Proposta de prazo: ajuste no estúdio se decidir outro.
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia por persona, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. Publique o mapa no Notion (notion.site) e rode crm-guia-mapa-saude-link.sql com o endereço dele (é o botão "Abrir o mapa").
--   2. O formulário precisa gravar porta e ponto em contatos.respostas (hoje capturar_lead_guia só grava o cfNivel). Sem isso o Worker
--      trata todo lead como "outro" e o assunto cai no plano B. Esse SQL é um passo à parte (testes de isolamento, teste antes de produção).
--   3. O Worker precisa estar publicado com crmVarsSaude (cms-oauth-worker/worker.js).
--   4. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23).
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('saude_mapa_1', 'saude_mapa_2') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('saude_mapa_1', 'saude_mapa_2') and m.criado_no_estudio and not m.envio_ligado
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
values ('saude_mapa_1', 'Saúde · mapa (e-mail 1)', 'Entrega de freebie: O que ela pediu num guia: o prazo dela e um próximo passo.', 'servico',
  'Sozinho, pela parte Envio (sequência).', 'pegou o mapa da saúde na França',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"porta_estudante","o_que_e":"a porta que ela escolheu: Estudante","se_faltar":"o bloco some"},{"nome":"porta_trabalho","o_que_e":"a porta que ela escolheu: Trabalho com contrato","se_faltar":"o bloco some"},{"nome":"porta_aupair","o_que_e":"a porta que ela escolheu: Au pair","se_faltar":"o bloco some"},{"nome":"porta_outro","o_que_e":"a porta que ela escolheu: Outro ou não sei","se_faltar":"o bloco some"},{"nome":"ponto_nao_cheguei","o_que_e":"o ponto da saúde: ainda não chegou","se_faltar":"o bloco some"},{"nome":"ponto_sem_numero","o_que_e":"o ponto da saúde: chegou e está sem número","se_faltar":"o bloco some"},{"nome":"ponto_esperando","o_que_e":"o ponto da saúde: pediu e está esperando","se_faltar":"o bloco some"},{"nome":"ponto_sem_vitale","o_que_e":"o ponto da saúde: tem o número e não a carte vitale","se_faltar":"o bloco some"},{"nome":"ponto_completo","o_que_e":"o ponto da saúde: já tem a carte vitale","se_faltar":"o bloco some"},{"nome":"astucia_a0007","o_que_e":"astúcia A-0007 (inscrição no ameli antes da chegada) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0008","o_que_e":"astúcia A-0008 (Puma e atividade profissional) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0009","o_que_e":"astúcia A-0009 (declaração da família na Urssaf) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"retomada_estudante","o_que_e":"e-mail 2: a porta é Estudante e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_trabalho","o_que_e":"e-mail 2: a porta é Trabalho com contrato e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_aupair","o_que_e":"e-mail 2: a porta é Au pair e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_outro","o_que_e":"e-mail 2: a porta é Outro ou não sei e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"secao","o_que_e":"a seção do mapa da saúde que ela abre primeiro","se_faltar":"tronco do mapa"},{"nome":"assunto_persona","o_que_e":"o assunto do e-mail 1 para a persona dela (porta e ponto)","se_faltar":"fica vazio"},{"nome":"assunto_retomada","o_que_e":"o assunto do e-mail 2 (retomada) para a persona dela","se_faltar":"fica vazio"},{"nome":"link_checklist","o_que_e":"o link privado do guia no Notion (vem do banco, com UTM)","se_faltar":"não sai"}]'::jsonb, 560, true, 'freebie', '{"materiais":["guia-mapa-saude-franca"]}'::jsonb,
  'material', 'guia-mapa-saude-franca', null, null, 5, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'saude_mapa_1', 1, 'rascunho',
  $saude_mapa_1_a${#assunto_persona}{assunto_persona}{/assunto_persona}{^assunto_persona}O seu mapa da saúde na França, na ordem{/assunto_persona}$saude_mapa_1_a$,
  $saude_mapa_1_p$Comece pela seção da sua porta e siga a ordem dos cinco passos.$saude_mapa_1_p$,
  $saude_mapa_1_t$O mapa da saúde está no botão abaixo.

{#nome}Oi, {nome},{/nome}{^nome}Oi,{/nome}

{#porta_estudante}Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉

{/porta_estudante}{#porta_trabalho}Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉

{/porta_trabalho}{#porta_aupair}Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉

{/porta_aupair}{#porta_outro}Comece pelo tronco, com as camadas do sistema e a ordem dos passos.

{/porta_outro}Abrir o mapa: {link_checklist}

{#astucia_a0007}Astúcia da Equipe Por Dentro, pra você:
O ameli indica se inscrever em etudiant-etranger.ameli.fr antes de chegar. A inscrição já gera um número provisório.
Fonte: ameli, estudante estrangeiro (19/01/2026)

{/astucia_a0007}{#astucia_a0008}Astúcia da Equipe Por Dentro, pra você:
Pela Puma, quem exerce atividade profissional é afiliado de imediato. Sem atividade profissional, a espera é de 3 meses.
Fonte: service-public F34308 (13/05/2026)

{/astucia_a0008}{#astucia_a0009}Astúcia da Equipe Por Dentro, pra você:
A família declara a contratação na Urssaf em até 8 dias, e o mesmo formulário pede o número de sécu. É a regra do salarié au pair, distinto do jeune au pair.
Fonte: service-public F473 (06/06/2025)

{/astucia_a0009}{#porta_estudante}Para eu orientar melhor: você já se inscreveu no ameli e quando chega (ou chegou) à França?
É só responder este e-mail. Eu leio cada resposta.

{/porta_estudante}{#porta_trabalho}Para eu orientar melhor: desde quando você tem contrato e quando chegou à França?
É só responder este e-mail. Eu leio cada resposta.

{/porta_trabalho}{#porta_aupair}Para eu orientar melhor: qual é o seu visto, a família já enviou a declaração à Urssaf e quando você chegou?
É só responder este e-mail. Eu leio cada resposta.

{/porta_aupair}{#porta_outro}Para eu orientar melhor: qual é o seu visto hoje, você exerce atividade profissional e quando chegou?
É só responder este e-mail. Eu leio cada resposta.

{/porta_outro}Prefere conversar? Responda este e-mail ou escolha um horário no botão abaixo.

Marcar uma conversa: {link_agenda}

Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o mapa da saúde na França no Por Dentro com {email}.$saude_mapa_1_t$,
  $saude_mapa_1_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">O mapa da saúde está no botão abaixo.</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi, {nome},{/nome}{^nome}Oi,{/nome}</p>
{#porta_estudante}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉</p>
{/porta_estudante}{#porta_trabalho}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉</p>
{/porta_trabalho}{#porta_aupair}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Comece pela seção {#secao}{secao}{/secao}{^secao}tronco do mapa{/secao} 😉</p>
{/porta_aupair}{#porta_outro}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Comece pelo tronco, com as camadas do sistema e a ordem dos passos.</p>
{/porta_outro}<p style="margin:0 0 24px;"><a href="{link_checklist}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o mapa</a></p>
{#astucia_a0007}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="#F4F1EC" style="background:#F4F1EC; border-radius:8px; padding:16px 20px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; font-weight:700; line-height:1.4; color:#577328; margin:0 0 6px;">Astúcia da Equipe Por Dentro, pra você:</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">O ameli indica se inscrever em etudiant-etranger.ameli.fr antes de chegar. A inscrição já gera um número provisório.</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.5; color:#6E6862; margin:8px 0 0;">Fonte: ameli, estudante estrangeiro (19/01/2026)</div></td></tr></table>
{/astucia_a0007}{#astucia_a0008}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="#F4F1EC" style="background:#F4F1EC; border-radius:8px; padding:16px 20px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; font-weight:700; line-height:1.4; color:#577328; margin:0 0 6px;">Astúcia da Equipe Por Dentro, pra você:</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Pela Puma, quem exerce atividade profissional é afiliado de imediato. Sem atividade profissional, a espera é de 3 meses.</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.5; color:#6E6862; margin:8px 0 0;">Fonte: service-public F34308 (13/05/2026)</div></td></tr></table>
{/astucia_a0008}{#astucia_a0009}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td bgcolor="#F4F1EC" style="background:#F4F1EC; border-radius:8px; padding:16px 20px;"><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; font-weight:700; line-height:1.4; color:#577328; margin:0 0 6px;">Astúcia da Equipe Por Dentro, pra você:</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">A família declara a contratação na Urssaf em até 8 dias, e o mesmo formulário pede o número de sécu. É a regra do salarié au pair, distinto do jeune au pair.</div><div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.5; color:#6E6862; margin:8px 0 0;">Fonte: service-public F473 (06/06/2025)</div></td></tr></table>
{/astucia_a0009}{#porta_estudante}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Para eu orientar melhor: você já se inscreveu no ameli e quando chega (ou chegou) à França?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
{/porta_estudante}{#porta_trabalho}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Para eu orientar melhor: desde quando você tem contrato e quando chegou à França?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
{/porta_trabalho}{#porta_aupair}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Para eu orientar melhor: qual é o seu visto, a família já enviou a declaração à Urssaf e quando você chegou?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
{/porta_aupair}{#porta_outro}<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">Para eu orientar melhor: qual é o seu visto hoje, você exerce atividade profissional e quando chegou?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">É só responder este e-mail. Eu leio cada resposta.</p>
{/porta_outro}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Prefere conversar? Responda este e-mail ou escolha um horário no botão abaixo.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Marcar uma conversa</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o mapa da saúde na França no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$saude_mapa_1_h$,
  $saude_mapa_1_b${"assunto":"{assunto_persona}","assunto_alt":"O seu mapa da saúde na França, na ordem","pre":"Comece pela seção da sua porta e siga a ordem dos cinco passos.","rodape":"pediu o mapa da saúde na França no Por Dentro com {email}","itens":[{"tipo":"titulo","texto":"O mapa da saúde está no botão abaixo."},{"tipo":"texto","texto":"Oi, {nome},","alt":"Oi,"},{"tipo":"texto","se":"#porta_estudante","texto":"Comece pela seção {secao} 😉"},{"tipo":"texto","se":"#porta_trabalho","texto":"Comece pela seção {secao} 😉"},{"tipo":"texto","se":"#porta_aupair","texto":"Comece pela seção {secao} 😉"},{"tipo":"texto","se":"#porta_outro","texto":"Comece pelo tronco, com as camadas do sistema e a ordem dos passos."},{"tipo":"botao","rotulo":"Abrir o mapa","link":"link_checklist"},{"tipo":"astucia","se":"#astucia_a0007","codigo":"A-0007","conferida_em":"14/11/2026","texto":"O ameli indica se inscrever em etudiant-etranger.ameli.fr antes de chegar. A inscrição já gera um número provisório.","fonte":"ameli, estudante estrangeiro (19/01/2026)"},{"tipo":"astucia","se":"#astucia_a0008","codigo":"A-0008","conferida_em":"14/11/2026","texto":"Pela Puma, quem exerce atividade profissional é afiliado de imediato. Sem atividade profissional, a espera é de 3 meses.","fonte":"service-public F34308 (13/05/2026)"},{"tipo":"astucia","se":"#astucia_a0009","codigo":"A-0009","conferida_em":"14/11/2026","texto":"A família declara a contratação na Urssaf em até 8 dias, e o mesmo formulário pede o número de sécu. É a regra do salarié au pair, distinto do jeune au pair.","fonte":"service-public F473 (06/06/2025)"},{"tipo":"pergunta","se":"#porta_estudante","texto":"Para eu orientar melhor: você já se inscreveu no ameli e quando chega (ou chegou) à França?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"pergunta","se":"#porta_trabalho","texto":"Para eu orientar melhor: desde quando você tem contrato e quando chegou à França?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"pergunta","se":"#porta_aupair","texto":"Para eu orientar melhor: qual é o seu visto, a família já enviou a declaração à Urssaf e quando você chegou?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"pergunta","se":"#porta_outro","texto":"Para eu orientar melhor: qual é o seu visto hoje, você exerce atividade profissional e quando chegou?","ajuda":"É só responder este e-mail. Eu leio cada resposta."},{"tipo":"texto","texto":"Prefere conversar? Responda este e-mail ou escolha um horário no botão abaixo."},{"tipo":"botao","rotulo":"Marcar uma conversa","link":"link_agenda"},{"tipo":"texto","texto":"Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$saude_mapa_1_b$::jsonb,
  'e-mail 1 do mapa da saúde 17/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'saude_mapa_1' and criado_no_estudio and objetivo_chave = 'freebie')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'saude_mapa_1');

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values ('saude_mapa_2', 'Saúde · retomada (e-mail 2)', 'Conversa: Uma pergunta para ela responder por e-mail.', 'novidades',
  'Sozinho, pela parte Envio (sequência).', 'pegou o mapa da saúde na França e aceitou novidades',
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"fica vazio"},{"nome":"email","o_que_e":"o e-mail dela","se_faltar":"o bloco some"},{"nome":"persona","o_que_e":"o checklist dela, em minúsculas","se_faltar":"checklist"},{"nome":"nivel","o_que_e":"o nível que ela marcou no guia","se_faltar":"o bloco some"},{"nome":"prazo_nivel","o_que_e":"o prazo do nível no calendário","se_faltar":"o bloco some"},{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o bloco some"},{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"a cidade que você escolher"},{"nome":"prazo_limite","o_que_e":"a data do prazo de 3 meses (DD/MM/AAAA)","se_faltar":"o bloco some"},{"nome":"dias_para_prazo","o_que_e":"os dias até o prazo","se_faltar":"o bloco some"},{"nome":"prazo_vencido","o_que_e":"o prazo de 3 meses já venceu","se_faltar":"o bloco some"},{"nome":"prazo_a_vencer","o_que_e":"o prazo de 3 meses ainda vai vencer","se_faltar":"o bloco some"},{"nome":"link_acesso","o_que_e":"o link do app","se_faltar":"não sai"},{"nome":"link_agenda","o_que_e":"o link da agenda (cal.com)","se_faltar":"não sai"},{"nome":"etapa_nao_comecei","o_que_e":"etapa do guia: ainda não começou","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_curso","o_que_e":"etapa do guia: está escolhendo o curso","se_faltar":"o bloco some"},{"nome":"etapa_juntando_documentos","o_que_e":"etapa do guia: está juntando documentos, traduções e o teste","se_faltar":"o bloco some"},{"nome":"etapa_dossie_enviado","o_que_e":"etapa do guia: já enviou o dossiê","se_faltar":"o bloco some"},{"nome":"etapa_entrevista_resposta","o_que_e":"etapa do guia: está esperando a entrevista ou a resposta","se_faltar":"o bloco some"},{"nome":"etapa_pesquisando","o_que_e":"etapa do guia: ainda está pesquisando","se_faltar":"o bloco some"},{"nome":"etapa_escolhendo_escola","o_que_e":"etapa do guia: está escolhendo escola","se_faltar":"o bloco some"},{"nome":"etapa_recusa_idade","o_que_e":"etapa do guia: ouviu \"só até 29\"","se_faltar":"o bloco some"},{"nome":"etapa_buscando_empresa","o_que_e":"etapa do guia: está buscando empresa","se_faltar":"o bloco some"},{"nome":"etapa_montando_contrato","o_que_e":"etapa do guia: está montando o contrato","se_faltar":"o bloco some"},{"nome":"porta_estudante","o_que_e":"a porta que ela escolheu: Estudante","se_faltar":"o bloco some"},{"nome":"porta_trabalho","o_que_e":"a porta que ela escolheu: Trabalho com contrato","se_faltar":"o bloco some"},{"nome":"porta_aupair","o_que_e":"a porta que ela escolheu: Au pair","se_faltar":"o bloco some"},{"nome":"porta_outro","o_que_e":"a porta que ela escolheu: Outro ou não sei","se_faltar":"o bloco some"},{"nome":"ponto_nao_cheguei","o_que_e":"o ponto da saúde: ainda não chegou","se_faltar":"o bloco some"},{"nome":"ponto_sem_numero","o_que_e":"o ponto da saúde: chegou e está sem número","se_faltar":"o bloco some"},{"nome":"ponto_esperando","o_que_e":"o ponto da saúde: pediu e está esperando","se_faltar":"o bloco some"},{"nome":"ponto_sem_vitale","o_que_e":"o ponto da saúde: tem o número e não a carte vitale","se_faltar":"o bloco some"},{"nome":"ponto_completo","o_que_e":"o ponto da saúde: já tem a carte vitale","se_faltar":"o bloco some"},{"nome":"astucia_a0007","o_que_e":"astúcia A-0007 (inscrição no ameli antes da chegada) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0008","o_que_e":"astúcia A-0008 (Puma e atividade profissional) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"astucia_a0009","o_que_e":"astúcia A-0009 (declaração da família na Urssaf) está conferida e em vigor","se_faltar":"o bloco some"},{"nome":"retomada_estudante","o_que_e":"e-mail 2: a porta é Estudante e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_trabalho","o_que_e":"e-mail 2: a porta é Trabalho com contrato e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_aupair","o_que_e":"e-mail 2: a porta é Au pair e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"retomada_outro","o_que_e":"e-mail 2: a porta é Outro ou não sei e ela ainda não tem a carte vitale","se_faltar":"o bloco some"},{"nome":"secao","o_que_e":"a seção do mapa da saúde que ela abre primeiro","se_faltar":"tronco do mapa"},{"nome":"assunto_persona","o_que_e":"o assunto do e-mail 1 para a persona dela (porta e ponto)","se_faltar":"fica vazio"},{"nome":"assunto_retomada","o_que_e":"o assunto do e-mail 2 (retomada) para a persona dela","se_faltar":"fica vazio"},{"nome":"link_checklist","o_que_e":"o link privado do guia no Notion (vem do banco, com UTM)","se_faltar":"não sai"}]'::jsonb, 561, true, 'conversa', '{"materiais":["guia-mapa-saude-franca"]}'::jsonb,
  'email', 'saude_mapa_1', 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select 'saude_mapa_2', 1, 'rascunho',
  $saude_mapa_2_a${#assunto_retomada}{assunto_retomada}{/assunto_retomada}{^assunto_retomada}Uma pergunta sobre o seu mapa da saúde{/assunto_retomada}$saude_mapa_2_a$,
  $saude_mapa_2_p$Se fizer sentido, escolha um horário.$saude_mapa_2_p$,
  $saude_mapa_2_t${#nome}Oi, {nome},{/nome}{^nome}Oi,{/nome}

{#retomada_estudante}Passando para retomar o cadastro de estudante no ameli: a inscrição se faz em previsão da chegada. Posso ajudar a organizar os documentos.

{/retomada_estudante}{#retomada_trabalho}Passando para retomar uma pergunta sobre o seu contrato: desde quando ele vale? A resposta mostra por qual passo o seu caso começa.

{/retomada_trabalho}{#retomada_aupair}Passando para retomar a declaração da família na Urssaf, por onde o número de sécu é pedido. Posso olhar o seu caso.

{/retomada_aupair}{#retomada_outro}Passando para retomar uma pergunta só: qual é o seu visto hoje?

{/retomada_outro}{#ponto_sem_vitale}Passando para retomar o passo da carte vitale. Conto como ele funciona no Reel da semana 3.

{/ponto_sem_vitale}{#ponto_completo}Passando para retomar o que vem depois da carte vitale: médecin traitant e reembolso. Conto cada um no Reel da semana 4.

{/ponto_completo}Se fizer sentido, escolha um horário abaixo.

Marcar uma conversa: {link_agenda}

Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o mapa da saúde na França no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$saude_mapa_2_t$,
  $saude_mapa_2_h$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">{#nome}Oi, {nome},{/nome}{^nome}Oi,{/nome}</p>
{#retomada_estudante}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar o cadastro de estudante no ameli: a inscrição se faz em previsão da chegada. Posso ajudar a organizar os documentos.</p>
{/retomada_estudante}{#retomada_trabalho}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar uma pergunta sobre o seu contrato: desde quando ele vale? A resposta mostra por qual passo o seu caso começa.</p>
{/retomada_trabalho}{#retomada_aupair}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar a declaração da família na Urssaf, por onde o número de sécu é pedido. Posso olhar o seu caso.</p>
{/retomada_aupair}{#retomada_outro}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar uma pergunta só: qual é o seu visto hoje?</p>
{/retomada_outro}{#ponto_sem_vitale}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar o passo da carte vitale. Conto como ele funciona no Reel da semana 3.</p>
{/ponto_sem_vitale}{#ponto_completo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Passando para retomar o que vem depois da carte vitale: médecin traitant e reembolso. Conto cada um no Reel da semana 4.</p>
{/ponto_completo}<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Se fizer sentido, escolha um horário abaixo.</p>
<p style="margin:0 0 24px;"><a href="{link_agenda}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Marcar uma conversa</a></p>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o mapa da saúde na França no Por Dentro com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$saude_mapa_2_h$,
  $saude_mapa_2_b${"assunto":"{assunto_retomada}","assunto_alt":"Uma pergunta sobre o seu mapa da saúde","pre":"Se fizer sentido, escolha um horário.","rodape":"pediu o mapa da saúde na França no Por Dentro com {email}","itens":[{"tipo":"texto","texto":"Oi, {nome},","alt":"Oi,"},{"tipo":"texto","se":"#retomada_estudante","texto":"Passando para retomar o cadastro de estudante no ameli: a inscrição se faz em previsão da chegada. Posso ajudar a organizar os documentos."},{"tipo":"texto","se":"#retomada_trabalho","texto":"Passando para retomar uma pergunta sobre o seu contrato: desde quando ele vale? A resposta mostra por qual passo o seu caso começa."},{"tipo":"texto","se":"#retomada_aupair","texto":"Passando para retomar a declaração da família na Urssaf, por onde o número de sécu é pedido. Posso olhar o seu caso."},{"tipo":"texto","se":"#retomada_outro","texto":"Passando para retomar uma pergunta só: qual é o seu visto hoje?"},{"tipo":"texto","se":"#ponto_sem_vitale","texto":"Passando para retomar o passo da carte vitale. Conto como ele funciona no Reel da semana 3."},{"tipo":"texto","se":"#ponto_completo","texto":"Passando para retomar o que vem depois da carte vitale: médecin traitant e reembolso. Conto cada um no Reel da semana 4."},{"tipo":"texto","texto":"Se fizer sentido, escolha um horário abaixo."},{"tipo":"botao","rotulo":"Marcar uma conversa","link":"link_agenda"},{"tipo":"texto","texto":"Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica."},{"tipo":"assinatura","texto":"Ingryd · Por Dentro"}],"v":1,"planos":{}}$saude_mapa_2_b$::jsonb,
  'e-mail 2 do mapa da saúde 17/11/2026: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = 'saude_mapa_2' and criado_no_estudio and objetivo_chave = 'conversa')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'saude_mapa_2');
