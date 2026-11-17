-- O QUE ELA JÁ PAGOU DE VERDADE: um registro por pagamento confirmado pelo Stripe (valor, serviço, quando).
-- Rode DEPOIS de crm-assinaturas.sql e crm-1a1.sql. Pode rodar de novo sem estragar nada; só acrescenta.
--
--   pagamentos                 uma linha por pagamento. `referencia` é o id do Stripe (sessão ou fatura): o Stripe repete
--                              eventos e a referência única impede contar o mesmo dinheiro duas vezes.
--   crm_pagamento_registrar()  só o Worker (service_role) chama, depois de conferir a assinatura do Stripe.
--
-- Quem alimenta: o webhook do Stripe (cms-oauth-worker). 1:1 pago entra pela sessão de checkout; mensalidade entra pela
-- fatura paga (evento invoice.paid). Teste grátis (fatura de 0) não entra: não foi dinheiro.
-- Quem lê: a admin (a home do CRM soma o revenue e a ficha mostra o acumulado por pessoa). A pessoa não lê a tabela.
-- A admin também pode lançar à mão (política "for all"), por exemplo um Pix: use referencia = 'manual-...' e tipo = 'outro'.
--
-- Como desfazer:
--   drop function if exists public.crm_pagamento_registrar(uuid, text, text, text, integer, text, timestamptz, text, text, text);
--   drop table if exists public.pagamentos;

create table if not exists public.pagamentos (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  referencia text not null unique check (length(referencia) between 1 and 200),
  tipo text not null default 'outro' check (tipo in ('assinatura', '1a1', 'outro')),
  servico text not null check (length(servico) between 1 and 160),
  valor_centavos integer not null check (valor_centavos > 0),
  moeda text not null check (moeda ~ '^[A-Z]{3}$'),
  pago_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create index if not exists pagamentos_contato_idx on public.pagamentos (contato_id, pago_em desc);
create index if not exists pagamentos_pago_em_idx on public.pagamentos (pago_em desc);

alter table public.pagamentos enable row level security;
drop policy if exists "pagamentos: só admin" on public.pagamentos;
create policy "pagamentos: só admin" on public.pagamentos for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.pagamentos from anon;
grant select, insert, update on public.pagamentos to service_role;

-- p_contato: a ficha, quando o Worker já a conhece (1:1). Sem ela (fatura da mensalidade) acha pela assinatura, pelo cliente do
-- Stripe ou, por último, pelo e-mail da fatura. p_servico vazio vira "Assinatura · <plano>" (ou só "Assinatura").
-- Devolve { duplicado, contato_id }.
create or replace function public.crm_pagamento_registrar(
  p_contato uuid, p_referencia text, p_tipo text, p_servico text, p_valor_centavos integer, p_moeda text,
  p_pago_em timestamptz, p_assinatura text default null, p_cliente text default null, p_email text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_contato;
  v_servico text := nullif(btrim(coalesce(p_servico, '')), '');
  v_plano text;
  v_novo bigint;
begin
  if p_referencia is null or length(p_referencia) not between 1 and 200
     or p_tipo is null or p_tipo not in ('assinatura', '1a1', 'outro')
     or p_valor_centavos is null or p_valor_centavos <= 0
     or p_moeda is null or upper(p_moeda) !~ '^[A-Z]{3}$' then
    raise exception 'pagamento_invalido';
  end if;
  if v_id is null and (p_assinatura is not null or p_cliente is not null) then
    select contato_id into v_id from assinaturas
     where (p_assinatura is not null and stripe_subscription_id = p_assinatura)
        or (p_cliente is not null and stripe_customer_id = p_cliente)
     limit 1;
  end if;
  if v_id is null and p_email is not null and btrim(p_email) <> '' then
    select id into v_id from contatos where lower(email) = lower(btrim(p_email)) limit 1;
  end if;
  if v_id is null or not exists (select 1 from contatos where id = v_id) then
    raise exception 'contato_nao_encontrado';
  end if;
  if v_servico is null then
    select plano into v_plano from assinaturas where contato_id = v_id;
    v_servico := 'Assinatura' || case when v_plano is not null and btrim(v_plano) <> '' then ' · ' || v_plano else '' end;
  end if;
  insert into pagamentos (contato_id, referencia, tipo, servico, valor_centavos, moeda, pago_em)
  values (v_id, p_referencia, p_tipo, left(v_servico, 160), p_valor_centavos, upper(p_moeda), coalesce(p_pago_em, now()))
  on conflict (referencia) do nothing
  returning id into v_novo;
  return jsonb_build_object('duplicado', v_novo is null, 'contato_id', v_id);
end;
$$;
revoke all on function public.crm_pagamento_registrar(uuid, text, text, text, integer, text, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_pagamento_registrar(uuid, text, text, text, integer, text, timestamptz, text, text, text) to service_role;
