-- AS COMPRAS DOS GUIAS DIGITAIS (Manual Destrave da Ameli e, depois, o Guia vivo): uma linha por compra confirmada pelo Stripe.
-- Rode DEPOIS de crm-fase1 (app) e crm-pagamentos.sql. Pode rodar de novo sem estragar nada; só acrescenta.
--
--   compras                  uma linha por compra. `referencia` é o id da sessão do Stripe: o Stripe repete eventos e a
--                            referência única impede registrar (e entregar) a mesma compra duas vezes.
--   crm_compra_registrar()   só o Worker (service_role) chama, depois de conferir a assinatura do Stripe. Acha ou abre a ficha
--                            e grava a compra. Devolve { duplicado, contato_id, nome, ficha_nova, acesso_ate, entregue_em }.
--   crm_compra_entregue()    o Worker marca que o e-mail com o link saiu (uma vez só).
--
-- A FICHA (isolamento entre clientes). O e-mail do pagamento é o que a pessoa digitou no Stripe: não prova que ele é dela.
-- Por isso a compra só se liga a uma ficha que JÁ TEM CONTA assim:
--   1. pela conta: ficha cujo auth.users tem e-mail CONFIRMADO igual ao do pagamento (email_confirmed_at preenchido);
--   2. ficha sem conta (user_id vazio) com o mesmo e-mail: não há conta nenhuma para enganar;
--   3. nenhuma ficha com esse e-mail: abre uma ficha nova (origem 'stripe'), como o 1:1 pago já faz;
--   4. a ficha existe e tem conta, mas o e-mail da conta não é este ou não foi confirmado: NÃO liga. A compra fica com
--      contato_id vazio e o e-mail do pagamento guardado; a admin liga à mão na ficha, se for a mesma pessoa.
-- Nada aqui lê ou devolve a ficha pelo e-mail de um token de login.
--
-- CONSENTIMENTO. O e-mail com o link de acesso é de serviço (finalidade 'servico'), não marketing. Esta função grava só 'servico'
-- (uma linha, origem 'compra'). 'novidades_email' nunca é marcado por aqui: marketing é outra finalidade e outro aceite.
--
-- ACESSO. `acesso_ate` = pagamento + 12 meses (o Manual inclui atualizações por 12 meses). O Worker confere essa data a cada
-- abertura do link.
--
-- Quem lê: a admin. A pessoa não lê a tabela (o link e o e-mail são o recibo dela).
--
-- Como desfazer:
--   drop function if exists public.crm_compra_entregue(text);
--   drop function if exists public.crm_compra_registrar(text, text, text, integer, text, timestamptz, text);
--   drop table if exists public.compras;

create table if not exists public.compras (
  id bigint generated always as identity primary key,
  referencia text not null unique check (length(referencia) between 1 and 200),
  slug text not null,   -- o produto (ex.: manual-destrave-domiciliacao); quais produtos existem quem decide é o Worker (GUIA_PRODUTOS)
  email_pagamento text not null check (email_pagamento = lower(email_pagamento) and length(email_pagamento) between 3 and 254),
  contato_id uuid references public.contatos(id) on delete set null,
  valor_centavos integer not null check (valor_centavos >= 0),   -- o que foi PAGO: 0 com código promocional de 100%
  moeda text not null check (moeda ~ '^[A-Z]{3}$'),
  pago_em timestamptz not null default now(),
  acesso_ate timestamptz not null,
  origem text check (origem is null or length(origem) <= 200),   -- utm_content do link, quando o Stripe devolve
  entregue_em timestamptz,
  criado_em timestamptz not null default now()
);
-- O slug só tem o formato conferido aqui: manual novo = entrada no Worker, sem mexer no banco. Também troca a regra antiga
-- (lista fixa de dois produtos) em quem já rodou a primeira versão deste arquivo.
alter table public.compras drop constraint if exists compras_slug_check;
alter table public.compras add constraint compras_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80);
-- O valor pago pode ser 0 (código promocional de 100%): troca a regra antiga (> 0) em quem já rodou a primeira versão deste arquivo.
alter table public.compras drop constraint if exists compras_valor_centavos_check;
alter table public.compras add constraint compras_valor_centavos_check check (valor_centavos >= 0);
create index if not exists compras_contato_idx on public.compras (contato_id, pago_em desc);
create index if not exists compras_pago_em_idx on public.compras (pago_em desc);

alter table public.compras enable row level security;
drop policy if exists "compras: só admin" on public.compras;
create policy "compras: só admin" on public.compras for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.compras from anon, authenticated;
grant select, insert, update on public.compras to authenticated;   -- a RLS acima deixa só a admin ver e mexer
grant select, insert, update on public.compras to service_role;

create or replace function public.crm_compra_registrar(
  p_referencia text, p_slug text, p_email text, p_valor_centavos integer, p_moeda text,
  p_pago_em timestamptz default null, p_origem text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_contato uuid;
  v_nome text;
  v_nova boolean := false;
  v_pago timestamptz := coalesce(p_pago_em, now());
  v_compra public.compras;
  v_duplicado boolean := false;
begin
  if p_referencia is null or length(p_referencia) not between 1 and 200
     or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 80
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254
     or p_valor_centavos is null or p_valor_centavos < 0
     or p_moeda is null or upper(p_moeda) !~ '^[A-Z]{3}$' then
    raise exception 'compra_invalida';
  end if;

  -- 1. ficha de quem tem conta com este e-mail CONFIRMADO
  select c.id into v_contato
    from public.contatos c join auth.users u on u.id = c.user_id
   where u.email_confirmed_at is not null and lower(u.email) = v_email
   limit 1;
  -- 2. ficha sem conta com o mesmo e-mail
  if v_contato is null then
    select id into v_contato from public.contatos where email = v_email and user_id is null;
  end if;
  -- 3. ninguém com este e-mail: ficha nova (se existir ficha com conta, é o caso 4: fica sem ligar)
  if v_contato is null and not exists (select 1 from public.contatos where email = v_email) then
    insert into public.contatos (email, origem) values (v_email, 'stripe')
    on conflict (email) do nothing
    returning id into v_contato;
    v_nova := v_contato is not null;
  end if;

  insert into public.compras (referencia, slug, email_pagamento, contato_id, valor_centavos, moeda, pago_em, acesso_ate, origem)
  values (p_referencia, p_slug, v_email, v_contato, p_valor_centavos, upper(p_moeda), v_pago, v_pago + interval '12 months', left(p_origem, 200))
  on conflict (referencia) do nothing
  returning * into v_compra;

  if v_compra.id is null then
    v_duplicado := true;
    select * into v_compra from public.compras where referencia = p_referencia;
    -- o reenvio acha a ficha que faltava (ex.: a pessoa criou a conta depois), nunca troca uma já ligada
    if v_compra.contato_id is null and v_contato is not null then
      update public.compras set contato_id = v_contato where id = v_compra.id;
      v_compra.contato_id := v_contato;
    end if;
  end if;

  if v_compra.contato_id is not null then
    select nome into v_nome from public.contatos where id = v_compra.contato_id;
    -- consentimento de SERVIÇO (e-mail da compra), uma vez. Marketing ('novidades_email') não é tocado.
    if not v_duplicado and not exists (
      select 1 from public.consentimentos
       where contato_id = v_compra.contato_id and finalidade = 'servico' and aceito = true) then
      insert into public.consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
      values (v_compra.contato_id, 'servico', true, 'compra-1',
        'Compra de produto digital pelo Stripe: o e-mail com o link de acesso, os cupons e os avisos de atualização do conteúdo comprado são enviados por serviço, não por marketing.',
        'compra');
    end if;
  end if;

  return jsonb_build_object('duplicado', v_duplicado, 'contato_id', v_compra.contato_id, 'nome', v_nome,
    'ficha_nova', v_nova, 'acesso_ate', v_compra.acesso_ate, 'entregue_em', v_compra.entregue_em);
end;
$$;
revoke all on function public.crm_compra_registrar(text, text, text, integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.crm_compra_registrar(text, text, text, integer, text, timestamptz, text) to service_role;

-- O e-mail saiu: marca uma vez (a data da primeira entrega não muda). Não devolve nada.
create or replace function public.crm_compra_entregue(p_referencia text) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update public.compras set entregue_em = coalesce(entregue_em, now()) where referencia = p_referencia;
$$;
revoke all on function public.crm_compra_entregue(text) from public, anon, authenticated;
grant execute on function public.crm_compra_entregue(text) to service_role;
