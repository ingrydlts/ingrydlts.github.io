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
-- "novidades" e sem rodapé de descadastro. Ele leva só o MODELO da carta, com os campos em branco: endereços e número de
-- dossiê ficam na página (só nome, e-mail e consentimento chegam ao CRM). Para o e-mail trazer a carta preenchida seria
-- preciso a página enviar esses campos ao Worker: decisão da Ingryd, ainda não tomada (ver a aba "Trilha B" do documento).
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
