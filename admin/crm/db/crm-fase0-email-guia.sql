-- Por Dentro — CRM fase 0: o e-mail 1 do guia sai sozinho e as respostas por e-mail entram no CRM
-- Rode no SQL Editor do Supabase, DEPOIS de crm-enriquecimento.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: não apaga nem altera dado existente e NÃO muda a capturar_lead.
--
-- O que muda:
--   1. capturar_lead_guia grava o nível do Campus France (respostas.cfNivel: l1, arq, l2l3, lpro,
--      master, escola). "Ainda não sei" chega vazio e não grava nada.
--   2. capturar_lead_guia pede o e-mail 1 do guia ao Worker (crm_guia_email_pedir). Quem chama o
--      Worker é o pg_net, depois do commit; o Worker confere o segredo, lê a ficha e envia pelo
--      Brevo. Um e-mail por pessoa por guia: o índice emails_um_por_guia_idx garante.
--      DESLIGADO até existirem no Vault os segredos 'crm_worker_url' e 'crm_hook_secret' (passo a
--      passo no README do Worker, seção 17). Sem eles, nada é chamado e o cadastro segue igual.
--      Qualquer erro aqui vira aviso no log: nunca derruba o cadastro.
--   3. Tabela respostas_email: cada resposta que chega em respostas@imigrantepordentro.com (Email
--      Routing → Worker). Só admin lê e muda (RLS); quem grava é o Worker com a service_role.
--      A ligação com a pessoa é feita aqui, num gatilho: pelo e-mail do remetente e, se não houver
--      ficha com ele, pelo e-mail do CRM a que ela respondeu (In-Reply-To = provedor_id).
--      Remetente sem ficha fica com contato_id nulo ("sem ficha" no painel).
--   4. Evento 'email_respondido' na linha do tempo (conta como sinal da pessoa).
--   5. crm_contatos: motivo novo "respondeu o seu e-mail" (aparece em "Precisa de você"), coluna
--      resposta_aberta_id no fim, e o e-mail dos guias (cf_guia_*) não entra no segmento de
--      reimpacto, que fala do link de acesso ao app.
--
-- Pré-requisito do item 2: Database → Extensions → ligar "pg_net" (ou: create extension pg_net;).
--
-- Como desfazer:
--   select vault... (apague os segredos crm_worker_url e crm_hook_secret em Project Settings → Vault)
--   drop trigger crm_respostas_ligar on respostas_email; drop trigger crm_respostas_evento on respostas_email;
--   drop function public.crm_respostas_ligar(); drop function public.crm_on_resposta_email();
--   drop table public.respostas_email; drop function public.crm_guia_email_pedir(uuid, text);
--   drop index emails_um_por_guia_idx;
--   rodar de novo guias-link-privado.sql (capturar_lead_guia antiga) e crm-enriquecimento.sql (a view).

-- ---------- 1. Um e-mail por pessoa por guia ----------
create unique index if not exists emails_um_por_guia_idx
  on public.emails_enviados (contato_id, modelo) where modelo like 'cf\_guia\_%';

-- ---------- 2. Pedir o e-mail do guia ao Worker ----------
-- security definer e sem grant: só a capturar_lead_guia chama. Lê o Vault e o pg_net por SQL
-- dinâmico, para não quebrar onde eles não existem (testes) e ficar desligado sem os segredos.
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
    v_modelo := case p_guia when 'etudes-en-france-2027-2028' then 'cf_guia_1' end;
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

-- ---------- capturar_lead_guia: + nível do Campus France + pedido do e-mail 1 ----------
create or replace function public.capturar_lead_guia(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
  v_link record;
  v_guia text;
  v_id uuid;
  v_cfnivel text;
begin
  -- Mesmo cadastro de sempre; se falhar, o erro sobe e nada de link nem de e-mail.
  v_res := public.capturar_lead(payload);
  v_guia := left(coalesce(payload->>'guia', ''), 80);
  select id into v_id from contatos where email = lower(trim(coalesce(payload->>'email', '')));

  -- Nível da candidatura Campus France (só as 6 chaves conhecidas; o resto é ignorado).
  v_cfnivel := crm_token(payload#>>'{respostas,cfNivel}');
  if v_id is not null and v_cfnivel = any (array['l1', 'arq', 'l2l3', 'lpro', 'master', 'escola']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('cfNivel', v_cfnivel)
     where id = v_id;
    -- o quiz_respondido desta mesma chamada passa a mostrar o nível na linha do tempo
    update eventos set dados = dados || jsonb_build_object('cfNivel', v_cfnivel)
     where contato_id = v_id and tipo = 'quiz_respondido' and criado_em = now();
  end if;

  select notion_url, notion_texto into v_link from guias_links where slug = v_guia;

  perform public.crm_guia_email_pedir(v_id, v_guia);

  return v_res || jsonb_strip_nulls(jsonb_build_object(
    'notion_url', v_link.notion_url,
    'notion_texto', v_link.notion_texto));
end;
$$;
revoke all on function public.capturar_lead_guia(jsonb) from public;
grant execute on function public.capturar_lead_guia(jsonb) to anon, authenticated;

-- ---------- 3. Respostas por e-mail ----------
create table if not exists public.respostas_email (
  id bigint generated always as identity primary key,
  contato_id uuid references contatos(id) on delete cascade,      -- nulo = remetente sem ficha
  email_id bigint references emails_enviados(id) on delete set null, -- o e-mail do CRM a que respondeu
  de_email text not null check (length(de_email) between 3 and 254),
  de_nome text check (length(de_nome) <= 200),
  assunto text check (length(assunto) <= 300),
  texto text not null check (length(texto) <= 6000),
  message_id text check (length(message_id) <= 300),
  em_resposta_a text check (length(em_resposta_a) <= 300),
  status text not null default 'nova' check (status in ('nova', 'respondida', 'arquivada')),
  recebido_em timestamptz not null default now(),
  respondida_em timestamptz
);
create index if not exists respostas_email_status_idx on public.respostas_email (status, recebido_em);
create index if not exists respostas_email_contato_idx on public.respostas_email (contato_id);
-- O Email Routing pode entregar a mesma mensagem duas vezes: o Message-ID não repete.
create unique index if not exists respostas_email_msgid_idx on public.respostas_email (message_id) where message_id is not null;

alter table public.respostas_email enable row level security;
revoke all on public.respostas_email from anon;
drop policy if exists "respostas_email: só admin" on public.respostas_email;
create policy "respostas_email: só admin" on public.respostas_email
  for all using (public.eh_admin()) with check (public.eh_admin());

-- Liga a resposta à pessoa e ao e-mail do CRM. Nunca derruba a gravação.
create or replace function public.crm_respostas_ligar() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text;
  v_mail_contato uuid;
begin
  new.de_email := lower(trim(new.de_email));
  begin
    v_ref := nullif(trim(coalesce(new.em_resposta_a, '')), '');
    if v_ref is not null and new.email_id is null then
      select e.id, e.contato_id into new.email_id, v_mail_contato from emails_enviados e
       where e.provedor_id in (v_ref, '<' || btrim(v_ref, '<>') || '>', btrim(v_ref, '<>'))
       limit 1;
    end if;
    if new.contato_id is null then
      new.contato_id := coalesce((select id from contatos where email = new.de_email), v_mail_contato);
    end if;
  exception when others then
    raise warning 'crm_respostas_ligar: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_respostas_ligar on public.respostas_email;
create trigger crm_respostas_ligar before insert on public.respostas_email
  for each row execute function public.crm_respostas_ligar();

-- ---------- 4. Linha do tempo ----------
create or replace function public.crm_on_resposta_email() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.contato_id is not null then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'email_respondido', jsonb_strip_nulls(jsonb_build_object(
        'resposta_id', new.id, 'assunto', left(new.assunto, 120), 'email_id', new.email_id)));
    end if;
  exception when others then
    raise warning 'crm_on_resposta_email: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_respostas_evento on public.respostas_email;
create trigger crm_respostas_evento after insert on public.respostas_email
  for each row execute function public.crm_on_resposta_email();

-- ---------- 5. A visão que o painel lê (crm-enriquecimento + resposta por e-mail) ----------
create or replace view public.crm_contatos with (security_invoker = true) as
select
  c.id, c.email, c.nome, c.persona, c.caminho as subpersona, c.fase, c.nivel_estudos,
  c.preocupacao, c.origem, c.respostas, c.estagio, c.score, c.user_id, c.nota,
  c.criado_em, c.atualizado_em, c.ultimo_evento_em,
  u.urgencia,
  case
    when ra.id is not null then 'respondeu o seu e-mail em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when pz.dias_para_prazo between 1 and 60 then 'prazo do VLS-TS vence em ' || pz.dias_para_prazo || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo = 0 then 'prazo do VLS-TS vence hoje (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo between -90 and -1 then 'prazo do VLS-TS venceu há ' || (-pz.dias_para_prazo) || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when c.capturas >= 2 and c.ultima_captura_em > now() - interval '7 days'
      then 'voltou a deixar o e-mail em ' || to_char(c.ultima_captura_em at time zone 'Europe/Paris', 'DD/MM')
           || coalesce(' (' || c.ultima_origem || ')', '')
    when c.fase = 'urgente' then 'marcou urgência no funil'
    when c.fase = 'adaptando' and c.preocupacao = 'prazo' then 'já está na França e a preocupação é prazo'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parada há ' || d.dias || ' dias'
    when c.caminho = 'indefinido' then 'escolheu "Não sei ainda" no caminho'
  end as motivo,
  d.dias,
  (select p.id from perguntas_unicas p where p.contato_id = c.id and p.status = 'nova'
     order by p.criado_em limit 1) as pergunta_aberta_id,
  (select o.quando from um_a_um o where o.contato_id = c.id and o.status = 'agendado'
     order by o.quando nulls last limit 1) as um_a_um_quando,
  le.status as email_status,
  le.enviado_em as email_enviado_em,
  case
    when le.id is null or c.estagio in ('concluido', 'um_a_um') then null
    when le.status in ('agendado', 'nao_entregue') then null
    when c.estagio = 'lead' and le.status = 'entregue' and now() - le.enviado_em >= interval '3 days' then 'naoabriu'
    when c.estagio = 'lead' and le.status = 'aberto' and now() - le.enviado_em >= interval '3 days' then 'naoclicou'
    when c.estagio = 'lead' and le.status = 'clicado' then 'cliquenaoapp'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parouapp'
  end as segmento,
  coalesce((select cn.aceito from consentimentos cn where cn.contato_id = c.id and cn.finalidade = 'novidades_email'
              order by cn.criado_em desc, cn.id desc limit 1), false) as aceita_novidades,
  -- colunas novas SEMPRE no fim (create or replace view não deixa reordenar as antigas)
  c.data_entrada,
  pz.prazo_limite,
  pz.dias_para_prazo,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.utm_content,
  c.ig_id,
  c.instagram,
  c.capturas,
  c.origens,
  c.ultima_origem,
  c.ultima_captura_em,
  c.personas,
  ra.id as resposta_aberta_id
from contatos c
cross join lateral (
  select greatest(0, floor(extract(epoch from now() - coalesce(c.ultimo_evento_em, c.criado_em)) / 86400))::int as dias
) d
cross join lateral (
  -- Prazo do VLS-TS: entrada + 3 meses − 1 dia (mesma conta da calculadora do guia).
  -- dias_para_prazo negativo = já venceu.
  select
    case when c.data_entrada is not null then ((c.data_entrada + interval '3 months')::date - 1) end as prazo_limite,
    case when c.data_entrada is not null then (((c.data_entrada + interval '3 months')::date - 1) - current_date) end as dias_para_prazo
) pz
cross join lateral (
  -- Faixas do prazo (ajuste aqui): alta = vence em até 30 dias ou venceu há até 90;
  -- média = vence entre 31 e 60 dias. Passou disso (venceu há 90+ dias) não conta como prazo.
  select case
    when c.fase = 'urgente' or (c.fase = 'adaptando' and c.preocupacao = 'prazo')
      or pz.dias_para_prazo between -90 and 30 then 'alta'
    when c.fase = 'adaptando' or pz.dias_para_prazo between 31 and 60 then 'media'
    else 'baixa'
  end as urgencia
) u
left join lateral (
  -- o e-mail dos guias (cf_guia_*) não é o do link de acesso: fica fora do reimpacto
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id and e.modelo not like 'cf\_guia\_%' order by e.criado_em desc, e.id desc limit 1
) le on true
left join lateral (
  select r.id, r.recebido_em from respostas_email r
   where r.contato_id = c.id and r.status = 'nova' order by r.recebido_em limit 1
) ra on true;

revoke all on public.crm_contatos from anon;
