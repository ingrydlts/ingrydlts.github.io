-- Por Dentro — CRM: assinaturas (webhook do Stripe) e a regra de acesso do app
-- Rode no SQL Editor do Supabase, DEPOIS de crm-onboarding.sql (usa contatos, eventos e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- O que entra:
--   assinaturas        uma linha por pessoa (contato): o que o Stripe diz da assinatura dela. O Stripe é a fonte da
--                      verdade das datas (fim do teste, fim do período pago): o banco não conta 30 dias por conta própria.
--   stripe_eventos     os ids de eventos do Stripe já processados. O Stripe repete eventos; repetido não faz nada.
--   crm_stripe_aplicar()  só o Worker (service_role) chama, a cada evento do webhook, depois de conferir a assinatura do Stripe.
--   meu_acesso()       o app pergunta se a pessoa logada pode entrar, e até quando (a regra mora aqui, num lugar só).
--
-- Regra de acesso (decisões do ONBOARDING.md): quem tem teste ou assinatura em dia entra; cancelou ou falhou o pagamento:
-- entra até o fim do período já pago; sem assinatura, ou com o período acabado: bloqueado (nada é apagado). Admin (tabela
-- `admins`) sempre entra. O Stripe avisa por webhook com algum atraso, então "em dia" vale 2 dias além da data final.
--
-- Quem lê e escreve o quê:
--   admin (você)   → lê assinaturas pela RLS (aparece na ficha); nunca escreve à mão aqui
--   pessoa logada  → só meu_acesso() (não lê a tabela)
--   Worker         → crm_stripe_aplicar() com a service_role
--
-- Como desfazer (o app sem meu_acesso() trava o dashboard: tire o bloqueio do app antes):
--   drop function if exists public.meu_acesso();
--   drop function if exists public.crm_stripe_aplicar(text, text, uuid, jsonb);
--   drop table if exists public.stripe_eventos;
--   drop table if exists public.assinaturas;

create table if not exists public.assinaturas (
  contato_id uuid primary key references public.contatos(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null check (length(status) between 1 and 40),   -- o do Stripe: trialing, active, past_due, canceled, unpaid, incomplete, paused
  plano text check (plano is null or length(plano) <= 120),
  moeda text check (moeda is null or moeda ~ '^[A-Z]{3}$'),
  teste_fim timestamptz,
  periodo_fim timestamptz,
  cancela_no_fim boolean not null default false,
  stripe_em timestamptz,               -- a hora do evento do Stripe que gravou isto (evento velho não sobrescreve novo)
  acesso_enviado_em timestamptz,       -- quando saiu o e-mail "acesso confirmado"
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists assinaturas_customer_idx on public.assinaturas (stripe_customer_id) where stripe_customer_id is not null;

create table if not exists public.stripe_eventos (
  id text primary key check (length(id) between 5 and 100),
  tipo text not null,
  recebido_em timestamptz not null default now()
);

alter table public.assinaturas enable row level security;
alter table public.stripe_eventos enable row level security;
drop policy if exists "assinaturas: só admin lê" on public.assinaturas;
create policy "assinaturas: só admin lê" on public.assinaturas for select using (public.eh_admin());
revoke all on public.assinaturas, public.stripe_eventos from anon, authenticated;
grant select on public.assinaturas to authenticated;   -- a RLS acima deixa só o admin ver linhas
grant select, insert, update on public.assinaturas, public.stripe_eventos to service_role;

-- p_assinatura: { status, customer, subscription, plano, moeda, teste_fim, periodo_fim, cancela_no_fim, evento_em } (datas em ISO).
-- Devolve { duplicado, contato_id, acesso_enviado_em, status }.
create or replace function public.crm_stripe_aplicar(p_evento text, p_tipo text, p_contato uuid, p_assinatura jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_contato;
  v_antes assinaturas%rowtype;
  v_depois assinaturas%rowtype;
  v_ultimo timestamptz;
  v_em timestamptz;
  v_tipo_evento text;
  v_mudou boolean;
  v_env timestamptz;
  v_st text;
begin  -- quem pode chamar é só a service_role (o grant no fim): é ela que o Worker usa depois de conferir a assinatura do Stripe
  if p_evento is null or length(p_evento) < 5 or p_assinatura is null or jsonb_typeof(p_assinatura) <> 'object' then
    raise exception 'formato_invalido';
  end if;
  if p_tipo not in ('checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed') then
    raise exception 'tipo_nao_tratado';
  end if;

  insert into stripe_eventos (id, tipo) values (p_evento, p_tipo) on conflict (id) do nothing;
  if not found then
    select contato_id, acesso_enviado_em, status into v_id, v_env, v_st
      from assinaturas where stripe_subscription_id = p_assinatura ->> 'subscription' limit 1;
    return jsonb_build_object('duplicado', true, 'contato_id', v_id, 'acesso_enviado_em', v_env, 'status', v_st);
  end if;

  -- Sem o contato, acha pela assinatura ou pelo cliente do Stripe (eventos depois do checkout não trazem o id da ficha).
  if v_id is null then
    select contato_id into v_id from assinaturas
     where (p_assinatura ->> 'subscription' is not null and stripe_subscription_id = p_assinatura ->> 'subscription')
        or (p_assinatura ->> 'customer' is not null and stripe_customer_id = p_assinatura ->> 'customer')
     limit 1;
  end if;
  if v_id is null or not exists (select 1 from contatos where id = v_id) then
    raise exception 'contato_nao_encontrado';
  end if;

  v_em := nullif(p_assinatura ->> 'evento_em', '')::timestamptz;
  select * into v_antes from assinaturas where contato_id = v_id;
  select ultimo_evento_em into v_ultimo from contatos where id = v_id;

  if found and v_antes.stripe_em is not null and v_em is not null and v_em < v_antes.stripe_em then
    -- Evento mais velho que o que já está gravado: o Stripe entrega fora de ordem. Fica como está.
    return jsonb_build_object('duplicado', false, 'antigo', true, 'contato_id', v_id, 'acesso_enviado_em', v_antes.acesso_enviado_em, 'status', v_antes.status);
  end if;

  insert into assinaturas as a (contato_id, stripe_customer_id, stripe_subscription_id, status, plano, moeda, teste_fim, periodo_fim, cancela_no_fim, stripe_em)
  values (v_id, p_assinatura ->> 'customer', p_assinatura ->> 'subscription', coalesce(p_assinatura ->> 'status', 'incomplete'),
    left(p_assinatura ->> 'plano', 120), upper(nullif(p_assinatura ->> 'moeda', '')),
    nullif(p_assinatura ->> 'teste_fim', '')::timestamptz, nullif(p_assinatura ->> 'periodo_fim', '')::timestamptz,
    coalesce((p_assinatura ->> 'cancela_no_fim')::boolean, false), v_em)
  on conflict (contato_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, a.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, a.stripe_subscription_id),
    status = excluded.status,
    plano = coalesce(excluded.plano, a.plano),
    moeda = coalesce(excluded.moeda, a.moeda),
    teste_fim = coalesce(excluded.teste_fim, a.teste_fim),
    periodo_fim = coalesce(excluded.periodo_fim, a.periodo_fim),
    cancela_no_fim = excluded.cancela_no_fim,
    stripe_em = coalesce(excluded.stripe_em, a.stripe_em),
    atualizado_em = now();
  select * into v_depois from assinaturas where contato_id = v_id;

  v_mudou := v_antes.contato_id is null or v_antes.status is distinct from v_depois.status or v_antes.cancela_no_fim is distinct from v_depois.cancela_no_fim;
  v_tipo_evento := case p_tipo
    when 'checkout.session.completed' then 'pagamento_confirmado'
    when 'customer.subscription.deleted' then 'assinatura_cancelada'
    when 'invoice.payment_failed' then 'pagamento_falhou'
    else 'assinatura_atualizada' end;
  if v_mudou or p_tipo <> 'customer.subscription.updated' then
    insert into eventos (contato_id, tipo, dados) values (v_id, v_tipo_evento,
      jsonb_strip_nulls(jsonb_build_object('status', v_depois.status, 'plano', v_depois.plano, 'moeda', v_depois.moeda,
        'teste_fim', v_depois.teste_fim, 'periodo_fim', v_depois.periodo_fim, 'cancela_no_fim', v_depois.cancela_no_fim)));
    update contatos set ultimo_evento_em = v_ultimo where id = v_id;   -- é o Stripe falando, não ela usando o app
  end if;

  return jsonb_build_object('duplicado', false, 'contato_id', v_id, 'acesso_enviado_em', v_depois.acesso_enviado_em, 'status', v_depois.status);
end;
$$;
revoke all on function public.crm_stripe_aplicar(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crm_stripe_aplicar(text, text, uuid, jsonb) to service_role;

-- O Worker marca que o e-mail de acesso saiu (para um reenvio do Stripe não mandar o e-mail de novo).
create or replace function public.crm_stripe_acesso_enviado(p_contato uuid) returns void
language sql security definer
set search_path = public, pg_temp
as $$ update assinaturas set acesso_enviado_em = now() where contato_id = p_contato and acesso_enviado_em is null $$;
revoke all on function public.crm_stripe_acesso_enviado(uuid) from public, anon, authenticated;
grant execute on function public.crm_stripe_acesso_enviado(uuid) to service_role;

-- A pessoa logada pergunta se pode entrar. { acesso, motivo, status, ate }.
-- motivo: admin · teste · ativa · cancelada_ate · pagamento_falhou_ate (acesso = true)
--         sem_sessao · sem_assinatura · teste_encerrado · assinatura_encerrada · pagamento_pendente (acesso = false)
create or replace function public.meu_acesso() returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  a assinaturas%rowtype;
  v_ate timestamptz;
  v_folga constant interval := interval '2 days';
begin
  if auth.uid() is null then
    return jsonb_build_object('acesso', false, 'motivo', 'sem_sessao');
  end if;
  if public.eh_admin() then
    return jsonb_build_object('acesso', true, 'motivo', 'admin');
  end if;
  select s.* into a from assinaturas s join contatos c on c.id = s.contato_id where c.user_id = auth.uid();
  if not found then
    return jsonb_build_object('acesso', false, 'motivo', 'sem_assinatura');
  end if;
  v_ate := greatest(coalesce(a.teste_fim, '-infinity'), coalesce(a.periodo_fim, '-infinity'));
  if a.status = 'trialing' then
    if now() < coalesce(a.teste_fim, a.periodo_fim, '-infinity') + v_folga then
      return jsonb_build_object('acesso', true, 'motivo', 'teste', 'status', a.status, 'ate', coalesce(a.teste_fim, a.periodo_fim));
    end if;
    return jsonb_build_object('acesso', false, 'motivo', 'teste_encerrado', 'status', a.status, 'ate', coalesce(a.teste_fim, a.periodo_fim));
  elsif a.status = 'active' then
    if a.periodo_fim is null or now() < a.periodo_fim + v_folga then
      return jsonb_build_object('acesso', true, 'motivo', case when a.cancela_no_fim then 'cancelada_ate' else 'ativa' end, 'status', a.status, 'ate', a.periodo_fim);
    end if;
    return jsonb_build_object('acesso', false, 'motivo', 'assinatura_encerrada', 'status', a.status, 'ate', a.periodo_fim);
  elsif a.status in ('canceled', 'past_due') then
    -- Cancelou ou o pagamento falhou: o período que ela já pagou vale até o fim (decisão 6), sem folga.
    if a.periodo_fim is not null and now() < a.periodo_fim and a.status = 'canceled' then
      return jsonb_build_object('acesso', true, 'motivo', 'cancelada_ate', 'status', a.status, 'ate', a.periodo_fim);
    elsif a.periodo_fim is not null and now() < a.periodo_fim and a.status = 'past_due' then
      return jsonb_build_object('acesso', true, 'motivo', 'pagamento_falhou_ate', 'status', a.status, 'ate', a.periodo_fim);
    end if;
    return jsonb_build_object('acesso', false, 'motivo', case when a.status = 'canceled' then 'assinatura_encerrada' else 'pagamento_pendente' end, 'status', a.status, 'ate', v_ate);
  end if;
  return jsonb_build_object('acesso', false, 'motivo', 'pagamento_pendente', 'status', a.status);
end;
$$;
revoke all on function public.meu_acesso() from public, anon;
grant execute on function public.meu_acesso() to authenticated;
