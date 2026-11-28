-- Por Dentro — CRM: o e-mail B0 do modelo grátis (carta de mudança de endereço) sai sozinho
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase0-email-guia.sql, crm-saude-porta-ponto.sql, crm-modelos-email.sql e
-- crm-taxonomia-modelos.sql. Idempotente (pode rodar de novo). Só acrescenta: não apaga nem altera dado existente.
-- NÃO muda a capturar_lead_guia (a página do Manual já a chama): muda só a crm_guia_email_pedir, que ela chama.
--
-- O que muda:
--   1. crm_guia_email_pedir passa a conhecer o guia 'modelo-mudanca-endereco-mesma-cidade' → modelo 'guia_modelo_b0'
--      (o 'etudes-en-france-2027-2028' → 'cf_guia_1' continua igual). Quem chama o Worker é o pg_net, depois do commit,
--      pelos mesmos segredos do Vault do e-mail 1 ('crm_worker_url' e 'crm_hook_secret'). Sem eles, nada sai e o cadastro
--      segue igual. Qualquer erro aqui vira aviso no log: nunca derruba o cadastro.
--   2. Um B0 por pessoa: o índice emails_um_por_guia_b0_idx garante (o Worker reserva a linha antes de enviar).
--   3. Modelo 'guia_modelo_b0' em modelos_email (serviço, automático) e a versão 1 No ar, para o texto aparecer no Estúdio.
--      O texto de reserva também mora no Worker: se a tabela falhar, o e-mail sai igual.
--
-- O B0 é e-mail de SERVIÇO: sai para todo mundo que pediu o modelo (a caixa de serviço é obrigatória na página), sem exigir
-- "novidades" e sem rodapé de descadastro.
--
-- VERSÃO 2 (28/11/2026): o B0 leva a carta PREENCHIDA. Quem manda o e-mail é a página, que envia os campos (endereços, dossiê, data)
-- direto ao Worker (POST /api/guia/carta); o Worker monta, envia e NÃO guarda os campos: o banco só recebe nome, e-mail e
-- consentimento, e o histórico da ficha guarda a mesma carta em branco (___). O gancho do banco (crm_guia_email_pedir) continua
-- chamando o Worker, que responde "adiado" para este guia: nada sai em branco antes da carta preenchida.
-- A versão 1 (carta em branco) fica arquivada; rodar este arquivo de novo não repete a versão 2.
--
-- VERSÃO 3 (28/11/2026): o rodapé ganha o aviso de dados (RGPD): o que não foi gravado, o que fica (nome, e-mail, consentimento),
-- por onde os dados passam (Cloudflare e Brevo), quem é o responsável e como exercer os direitos. O texto repete o que a política
-- de privacidade do site diz; se aquela política mudar, mude este rodapé (nova versão no Estúdio) no mesmo dia.
--
-- Como desfazer:
--   (reponha a crm_guia_email_pedir de crm-fase0-email-guia.sql, seção 2)
--   drop index if exists public.emails_um_por_guia_b0_idx;
--   delete from public.modelos_email_versoes where chave = 'guia_modelo_b0';
--   delete from public.modelos_email where chave = 'guia_modelo_b0' and not exists (select 1 from public.emails_enviados where modelo = 'guia_modelo_b0');

-- ---------- 1. Um B0 por pessoa ----------
create unique index if not exists emails_um_por_guia_b0_idx
  on public.emails_enviados (contato_id) where modelo = 'guia_modelo_b0';

-- ---------- 2. Pedir o e-mail do guia ao Worker (agora com o B0) ----------
create or replace function public.crm_guia_email_pedir(p_contato uuid, p_guia text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo text;
  v_url text;
  v_segredo text;
begin
  begin
    v_modelo := case p_guia
      when 'etudes-en-france-2027-2028' then 'cf_guia_1'
      when 'modelo-mudanca-endereco-mesma-cidade' then 'guia_modelo_b0'
    end;
    if v_modelo is null or p_contato is null then return; end if;
    if exists (select 1 from emails_enviados where contato_id = p_contato and modelo = v_modelo) then return; end if;

    execute $q$
      select max(decrypted_secret) filter (where name = 'crm_worker_url'),
             max(decrypted_secret) filter (where name = 'crm_hook_secret')
        from vault.decrypted_secrets where name in ('crm_worker_url', 'crm_hook_secret')
    $q$ into v_url, v_segredo;
    if coalesce(v_url, '') !~ '^https://' or length(coalesce(v_segredo, '')) < 24 then return; end if;

    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      using rtrim(v_url, '/') || '/api/crm/guia-capturado',
            jsonb_build_object('contato_id', p_contato, 'guia', p_guia),
            jsonb_build_object('Content-Type', 'application/json', 'X-Crm-Hook', v_segredo);
  exception when others then
    raise warning 'crm_guia_email_pedir: %', sqlerrm;
  end;
end;
$$;
revoke all on function public.crm_guia_email_pedir(uuid, text) from public, anon, authenticated;

-- ---------- 3. O modelo no Estúdio ----------
insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, automatico, variaveis, ordem)
values ('guia_modelo_b0', 'Modelo grátis de endereço · B0 (a carta)', 'Entregar o modelo de carta que ela pediu', 'servico',
  'Sozinho, na hora do cadastro no modelo grátis (o banco chama o Worker).', 'Todos que pediram o modelo', true,
  '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"email","o_que_e":"o e-mail dela (rodapé)","se_faltar":"—"}]'::jsonb, 95)
on conflict (chave) do nothing;

-- Classificação do Estúdio (família "entrega"), só se o SQL de taxonomia já rodou. Não sobrescreve o que ela já classificou.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'modelos_email' and column_name = 'familia') then
    update public.modelos_email set familia = 'entrega' where chave = 'guia_modelo_b0' and familia is null;
  end if;
end $$;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
select 'guia_modelo_b0', 1, 'no_ar',
  $guia_modelo_b0_a${#nome}{nome}, a sua carta de mudança de endereço{/nome}{^nome}A sua carta de mudança de endereço{/nome}$guia_modelo_b0_a$,
  $guia_modelo_b0_p$O modelo em francês, para adaptar e enviar.$guia_modelo_b0_p$,
  $guia_modelo_b0_t${#nome}Oi {nome}!{/nome}{^nome}Oi!{/nome} Aqui está o modelo de carta que você pediu, para mudança de endereço na mesma cidade. Troque cada ___ pelo seu dado e confirme na fonte oficial antes de enviar.

Seu nome
Endereço novo: ___

Objet : Changement d'adresse au sein de la même commune

Madame, Monsieur,

Je vous informe de mon changement d'adresse au sein de la même commune, à compter du ___ (date). Mon ancienne adresse était : ___. Ma nouvelle adresse est : ___.

Mon numéro de dossier auprès de ___ (CAF, CPAM, etc.) est : ___.

Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.

Cordialement,
Seu nome

Se você já copiou a carta preenchida na página, pode usar aquela: este e-mail é só para você guardar o modelo.

O Manual tem os outros 7 modelos de carta e e-mail, com a base legal de cada item.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o modelo de carta de mudança de endereço no Por Dentro com {email}.$guia_modelo_b0_t$,
  null,
  'B0: versão inicial (texto simples; carta com campos em branco)', now()
where exists (select 1 from public.modelos_email where chave = 'guia_modelo_b0')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0');

-- ---------- 4. Versão 2: a carta preenchida ----------
-- Variáveis novas: nome_completo, org, velho, novo, dossie e data (os campos da carta, vindos do Worker, nunca do banco).
update public.modelos_email set variaveis = '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"nome_completo","o_que_e":"nome como ela digitou na página (assinatura da carta)","se_faltar":"aparece Seu nome"},{"nome":"email","o_que_e":"o e-mail dela (rodapé)","se_faltar":"—"},{"nome":"novo","o_que_e":"endereço novo, como ela digitou (só passa pelo Worker, não é guardado)","se_faltar":"aparece ___"},{"nome":"velho","o_que_e":"endereço antigo (só passa pelo Worker)","se_faltar":"aparece ___"},{"nome":"dossie","o_que_e":"número do dossiê (só passa pelo Worker)","se_faltar":"aparece ___"},{"nome":"data","o_que_e":"data da mudança (só passa pelo Worker)","se_faltar":"aparece ___"},{"nome":"org","o_que_e":"órgão a quem vai a carta (CAF, CPAM...)","se_faltar":"o trecho some"}]'::jsonb
 where chave = 'guia_modelo_b0';

-- A versão 1 só é arquivada se continua como veio daqui: quem já editou o texto no Estúdio não é tocado
-- (a versão 2 então entra como rascunho, para ela decidir).
update public.modelos_email_versoes set etapa = 'arquivado'
 where chave = 'guia_modelo_b0' and versao = 1 and etapa = 'no_ar' and nota = 'B0: versão inicial (texto simples; carta com campos em branco)';

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
select 'guia_modelo_b0', 2,
  case when exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and etapa = 'no_ar') then 'rascunho' else 'no_ar' end,
  $guia_modelo_b0_a2${#nome}{nome}, a sua carta de mudança de endereço{/nome}{^nome}A sua carta de mudança de endereço{/nome}$guia_modelo_b0_a2$,
  $guia_modelo_b0_p2$A carta que você montou, para guardar e enviar.$guia_modelo_b0_p2$,
  $guia_modelo_b0_t2${#nome}Oi {nome}!{/nome}{^nome}Oi!{/nome} Aqui está a carta que você montou, para mudança de endereço na mesma cidade. Confira cada dado, adapte ao seu caso e confirme na fonte oficial antes de enviar.

{nome_completo}
{novo}

Objet : Changement d'adresse au sein de la même commune

Madame, Monsieur,

Je vous informe de mon changement d'adresse au sein de la même commune, à compter du {data}. Mon ancienne adresse était : {velho}. Ma nouvelle adresse est : {novo}.

Mon numéro de dossier{#org} auprès de {org}{/org} est : {dossie}.

Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.

Cordialement,
{nome_completo}

Este e-mail é só para você guardar a carta. Os endereços e o número do dossiê que você digitou não ficam guardados por nós: foram usados só para montar esta mensagem.

O Manual tem os outros 7 modelos de carta e e-mail, com a base legal de cada item.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o modelo de carta de mudança de endereço no Por Dentro com {email}.$guia_modelo_b0_t2$,
  null,
  'B0: versão 2 (a carta preenchida, enviada pelo Worker)',
  case when exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and etapa = 'no_ar') then null else now() end
where exists (select 1 from public.modelos_email where chave = 'guia_modelo_b0')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and versao = 2);

-- ---------- 5. Versão 3: o aviso de dados (RGPD) no rodapé ----------
-- A versão 2 só é arquivada se continua como veio daqui; se foi editada à mão, a 3 entra como rascunho.
update public.modelos_email_versoes set etapa = 'arquivado'
 where chave = 'guia_modelo_b0' and versao = 2 and etapa = 'no_ar' and nota = 'B0: versão 2 (a carta preenchida, enviada pelo Worker)';

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
select 'guia_modelo_b0', 3,
  case when exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and etapa = 'no_ar') then 'rascunho' else 'no_ar' end,
  $guia_modelo_b0_a3${#nome}{nome}, a sua carta de mudança de endereço{/nome}{^nome}A sua carta de mudança de endereço{/nome}$guia_modelo_b0_a3$,
  $guia_modelo_b0_p3$A carta que você montou, para guardar e enviar.$guia_modelo_b0_p3$,
  $guia_modelo_b0_t3${#nome}Oi {nome}!{/nome}{^nome}Oi!{/nome} Aqui está a carta que você montou, para mudança de endereço na mesma cidade. Confira cada dado, adapte ao seu caso e confirme na fonte oficial antes de enviar.

{nome_completo}
{novo}

Objet : Changement d'adresse au sein de la même commune

Madame, Monsieur,

Je vous informe de mon changement d'adresse au sein de la même commune, à compter du {data}. Mon ancienne adresse était : {velho}. Ma nouvelle adresse est : {novo}.

Mon numéro de dossier{#org} auprès de {org}{/org} est : {dossie}.

Je vous remercie de bien vouloir mettre à jour mes coordonnées dans mon dossier et de m'en confirmer la prise en compte par écrit. Je reste à votre disposition pour tout justificatif complémentaire.

Cordialement,
{nome_completo}

Este e-mail é só para você guardar a carta.

O Manual tem os outros 7 modelos de carta e e-mail, com a base legal de cada item.

Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o modelo de carta de mudança de endereço no Por Dentro com {email}.

Seus dados (RGPD): os endereços, o número do dossiê, o órgão e a data que você digitou na página foram usados só para montar este e-mail. Não foram gravados no nosso banco de dados nem no nosso CRM, e o nosso histórico guarda esta carta em branco. Guardamos apenas o seu nome, o seu e-mail e o seu consentimento, para entregar o modelo. Para montar e enviar a mensagem, os dados passam pela nossa infraestrutura (Cloudflare) e pelo Brevo, o nosso prestador de envio de e-mails, que os trata segundo a política dele. A cópia deste e-mail fica na sua caixa de entrada: apague-a quando quiser.
Responsável pelo tratamento: Ingryd Lo Tierzo Silva, entrepreneur individuel, SIRET 108 644 485 00014. Para acessar, corrigir ou apagar os seus dados, ou retirar o seu consentimento, responda este e-mail. Política de privacidade: https://imigrantepordentro.com/confidentialite/$guia_modelo_b0_t3$,
  null,
  'B0: versão 3 (aviso de dados RGPD no rodapé)',
  case when exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and etapa = 'no_ar') then null else now() end
where exists (select 1 from public.modelos_email where chave = 'guia_modelo_b0')
  and not exists (select 1 from public.modelos_email_versoes where chave = 'guia_modelo_b0' and versao = 3);
