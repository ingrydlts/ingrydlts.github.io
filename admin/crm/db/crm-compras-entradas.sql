-- AS ENTRADAS NO MATERIAL: cada vez que quem comprou um guia digital entra (login com e-mail + chave), uma linha aqui.
-- Rode DEPOIS de crm-compras.sql. Pode rodar de novo sem estragar nada; só acrescenta.
--
--   compras_entradas        uma linha por entrada com sucesso: de qual compra e quando. NADA mais: sem IP, sem chave, sem e-mail,
--                           sem capítulo aberto e sem o que a pessoa digitou na busca.
--   crm_compra_entrada()    só o Worker (service_role) chama, no login do guia. Recebe a referência da compra (o id da sessão do
--                           Stripe). Uma segunda entrada da mesma compra em menos de 1 minuto não conta (duplo clique, recarregar).
--
-- Quem lê: a admin, na sessão "Compras" da ficha (contagem, primeira e última entrada, fluxo). A pessoa não lê a tabela.
-- É dado por pessoa (o "nível B" do registro de métricas): a página de privacidade precisa dizer que contamos quantas vezes ela
-- entrou no material e a data, para ajudar a usar o guia.
--
-- Como desfazer:
--   drop function if exists public.crm_compra_entrada(text);
--   drop table if exists public.compras_entradas;

create table if not exists public.compras_entradas (
  id bigint generated always as identity primary key,
  compra_id bigint not null references public.compras(id) on delete cascade,
  em timestamptz not null default now()
);
create index if not exists compras_entradas_compra_idx on public.compras_entradas (compra_id, em desc);

alter table public.compras_entradas enable row level security;
drop policy if exists "compras_entradas: só admin" on public.compras_entradas;
create policy "compras_entradas: só admin" on public.compras_entradas for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.compras_entradas from anon, authenticated;
grant select on public.compras_entradas to authenticated;   -- a RLS acima deixa só a admin ler
grant select, insert on public.compras_entradas to service_role;

create or replace function public.crm_compra_entrada(p_referencia text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id bigint;
begin
  if p_referencia is null or length(p_referencia) not between 1 and 200 then raise exception 'referencia_invalida'; end if;
  select id into v_id from public.compras where referencia = p_referencia;
  if v_id is null then return; end if;   -- compra que não existe: nada a contar (e nada a revelar)
  if exists (select 1 from public.compras_entradas where compra_id = v_id and em > now() - interval '1 minute') then return; end if;
  insert into public.compras_entradas (compra_id) values (v_id);
end;
$$;
revoke all on function public.crm_compra_entrada(text) from public, anon, authenticated;
grant execute on function public.crm_compra_entrada(text) to service_role;
