-- Por Dentro — o e-mail do guia gratuito Painel do Certificado sai sozinho
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase0-email-guia.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: não apaga nem altera dado existente e NÃO muda a capturar_lead nem a capturar_lead_guia
-- (ela já chama crm_guia_email_pedir para qualquer guia).
--
-- O que muda:
--   1. crm_guia_email_pedir passa a pedir também o e-mail do guia 'painel-do-certificado' (modelo cert_guia_1),
--      além do e-mail 1 do Campus France (cf_guia_1), que continua igual.
--   2. Um e-mail por pessoa por guia também para cert_guia_*: índice novo emails_um_por_guia_cert_idx. O índice do
--      Campus France (emails_um_por_guia_idx, só cf_guia_*) não é tocado.
--   DESLIGADO até existirem no Vault os segredos 'crm_worker_url' e 'crm_hook_secret' (README do Worker, seção 17):
--   quem já ligou o e-mail do Campus France já tem os dois, e este e-mail passa a sair assim que o Worker novo estiver no ar.
--   Sem eles, nada é chamado e o cadastro segue igual. Qualquer erro aqui vira aviso no log: nunca derruba o cadastro.
--
-- Antes de ir ao ar: a linha 'painel-do-certificado' precisa existir em guias_links (Table Editor), senão o Worker
-- responde "Guia sem link do Notion" e o e-mail não sai.
--
-- O e-mail do painel fica fora dos reimpactos do CRM (que só olham os 8 modelos do link de acesso) e do e-mail 2 do
-- Campus France (que só vale para quem recebeu o cf_guia_1).
--
-- Como desfazer:
--   drop index emails_um_por_guia_cert_idx;
--   rodar de novo crm-fase0-email-guia.sql (volta a crm_guia_email_pedir só com o Campus France)
--   (para só parar de enviar, sem mexer no banco: Project Settings → Vault → apague crm_worker_url — isso também
--   desliga o e-mail do Campus France.)

-- ---------- 1. Um e-mail por pessoa por guia (cert_guia_*) ----------
create unique index if not exists emails_um_por_guia_cert_idx
  on public.emails_enviados (contato_id, modelo) where modelo like 'cert\_guia\_%';

-- ---------- 2. Pedir o e-mail do guia ao Worker ----------
-- Mesma função da fase 0, com um guia a mais. security definer e sem grant: só a capturar_lead_guia chama.
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
      when 'painel-do-certificado' then 'cert_guia_1'
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
