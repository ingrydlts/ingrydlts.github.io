-- ESCOLAS QUE A PESSOA ACRESCENTA: ela guarda no Espaço as escolas que achou por conta própria (nome, link e o que já sabe).
-- Rode DEPOIS de crm-caso.sql. Pode rodar de novo sem estragar nada.
--
--   escolas_dela          uma linha por escola. Só admin lê e escreve a tabela (RLS); a pessoa entra só pelas funções abaixo.
--   minhas_escolas()      a pessoa lê as suas.
--   adicionar_escola()    a pessoa acrescenta uma (até 20). O link, se houver, tem que ser https.
--   remover_escola()      a pessoa remove uma das suas.
-- Você vê as escolas dela na aba Caso da ficha (para o caso de querer transformar uma delas em escola do board dela).

create table if not exists public.escolas_dela (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  link text check (link is null or (length(link) <= 500 and link ~ '^https://')),
  nota text check (nota is null or length(nota) <= 600),
  criado_em timestamptz not null default now()
);
create index if not exists escolas_dela_contato_idx on public.escolas_dela (contato_id, criado_em);
alter table public.escolas_dela enable row level security;
drop policy if exists "escolas_dela: só admin" on public.escolas_dela;
create policy "escolas_dela: só admin" on public.escolas_dela for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.escolas_dela from anon;

create or replace function public.minhas_escolas() returns table (id bigint, nome text, link text, nota text, criado_em timestamptz)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select e.id, e.nome, e.link, e.nota, e.criado_em from escolas_dela e
   where e.contato_id = public.meu_contato_id() order by e.criado_em, e.id;
$$;
revoke all on function public.minhas_escolas() from public;
revoke all on function public.minhas_escolas() from anon;
grant execute on function public.minhas_escolas() to authenticated;

create or replace function public.adicionar_escola(p_nome text, p_link text default null, p_nota text default null) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_id bigint;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  if length(v_nome) not between 1 and 120 then
    raise exception 'nome_invalido';
  end if;
  if v_link is not null and (length(v_link) > 500 or v_link !~ '^https://') then
    raise exception 'link_invalido';
  end if;
  if v_nota is not null and length(v_nota) > 600 then
    raise exception 'nota_longa';
  end if;
  perform pg_advisory_xact_lock(hashtext('escolas_dela:' || v_c::text));
  if (select count(*) from escolas_dela where contato_id = v_c) >= 20 then
    raise exception 'limite_de_escolas';
  end if;
  insert into escolas_dela (contato_id, nome, link, nota) values (v_c, v_nome, v_link, v_nota) returning id into v_id;
  insert into eventos (contato_id, tipo, dados) values (v_c, 'escola_adicionada', jsonb_build_object('nome', left(v_nome, 80)));
  return v_id;
end;
$$;
revoke all on function public.adicionar_escola(text, text, text) from public;
revoke all on function public.adicionar_escola(text, text, text) from anon;
grant execute on function public.adicionar_escola(text, text, text) to authenticated;

create or replace function public.remover_escola(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from escolas_dela where id = p_id and contato_id = public.meu_contato_id();
$$;
revoke all on function public.remover_escola(bigint) from public;
revoke all on function public.remover_escola(bigint) from anon;
grant execute on function public.remover_escola(bigint) to authenticated;
