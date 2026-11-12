-- ESCOLAS QUE A PESSOA ACRESCENTA: ela guarda no Espaço as escolas que achou por conta própria (nome, link e o que já sabe).
-- Rode DEPOIS de crm-caso.sql. Pode rodar de novo sem estragar nada.
--
--   escolas_dela          uma linha por escola. Só admin lê e escreve a tabela (RLS); a pessoa entra só pelas funções abaixo.
--   minhas_escolas()      a pessoa lê as suas.
--   adicionar_escola()    a pessoa acrescenta uma (até 20), com o que já sabe: as perguntas Sim/Não da persona dela. O link, se houver, tem que ser https.
--   marcar_criterio_escola()  ela marca Sim ou Não (ou desmarca) numa pergunta de uma escola sua.
--   remover_escola()      a pessoa remove uma das suas.
-- Você vê as escolas dela na aba Caso da ficha (para o caso de querer transformar uma delas em escola do board dela).

create table if not exists public.escolas_dela (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  link text check (link is null or (length(link) <= 500 and link ~ '^https://')),
  nota text check (nota is null or length(nota) <= 600),
  criterios jsonb not null default '{}'::jsonb check (jsonb_typeof(criterios) = 'object' and octet_length(criterios::text) <= 800),   -- as perguntas Sim/Não da persona dela (chave → "sim" ou "nao")
  criado_em timestamptz not null default now()
);
create index if not exists escolas_dela_contato_idx on public.escolas_dela (contato_id, criado_em);
alter table public.escolas_dela enable row level security;
drop policy if exists "escolas_dela: só admin" on public.escolas_dela;
create policy "escolas_dela: só admin" on public.escolas_dela for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.escolas_dela from anon;

-- Para quem já rodou a versão sem critérios: a coluna entra e a função muda de formato.
alter table public.escolas_dela add column if not exists criterios jsonb not null default '{}'::jsonb;
drop function if exists public.minhas_escolas();
drop function if exists public.adicionar_escola(text, text, text);

create or replace function public.minhas_escolas() returns table (id bigint, nome text, link text, nota text, criterios jsonb, criado_em timestamptz)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select e.id, e.nome, e.link, e.nota, e.criterios, e.criado_em from escolas_dela e
   where e.contato_id = public.meu_contato_id() order by e.criado_em, e.id;
$$;
revoke all on function public.minhas_escolas() from public;
revoke all on function public.minhas_escolas() from anon;
grant execute on function public.minhas_escolas() to authenticated;

create or replace function public.adicionar_escola(p_nome text, p_link text default null, p_nota text default null, p_criterios jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_id bigint;
  v_crit jsonb;
  k text;
  v jsonb;
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
  v_crit := coalesce(p_criterios, '{}'::jsonb);
  if jsonb_typeof(v_crit) <> 'object' then raise exception 'criterios_invalidos'; end if;
  for k, v in select * from jsonb_each(v_crit) loop
    if k !~ '^[a-z][a-z0-9_]{0,23}$' or jsonb_typeof(v) <> 'string' or (v #>> '{}') <> all (array['sim', 'nao']) then raise exception 'criterios_invalidos'; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(v_crit)) > 12 then raise exception 'criterios_invalidos'; end if;
  perform pg_advisory_xact_lock(hashtext('escolas_dela:' || v_c::text));
  if (select count(*) from escolas_dela where contato_id = v_c) >= 20 then
    raise exception 'limite_de_escolas';
  end if;
  insert into escolas_dela (contato_id, nome, link, nota, criterios) values (v_c, v_nome, v_link, v_nota, v_crit) returning id into v_id;
  insert into eventos (contato_id, tipo, dados) values (v_c, 'escola_adicionada', jsonb_build_object('nome', left(v_nome, 80)));
  return v_id;
end;
$$;
revoke all on function public.adicionar_escola(text, text, text, jsonb) from public;
revoke all on function public.adicionar_escola(text, text, text, jsonb) from anon;
grant execute on function public.adicionar_escola(text, text, text, jsonb) to authenticated;

-- Marcar Sim ou Não (ou desmarcar, com nulo) numa pergunta de uma escola que ela mesma acrescentou.
create or replace function public.marcar_criterio_escola(p_id bigint, p_chave text, p_valor text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  v_crit jsonb;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  if p_chave is null or p_chave !~ '^[a-z][a-z0-9_]{0,23}$' or (p_valor is not null and p_valor <> all (array['sim', 'nao'])) then
    raise exception 'valor_invalido';
  end if;
  select criterios into v_crit from escolas_dela where id = p_id and contato_id = v_c for update;
  if not found then
    raise exception 'escola_nao_encontrada';
  end if;
  v_crit := coalesce(v_crit, '{}'::jsonb) - p_chave;
  if p_valor is not null then v_crit := v_crit || jsonb_build_object(p_chave, p_valor); end if;
  if (select count(*) from jsonb_object_keys(v_crit)) > 12 then raise exception 'valor_invalido'; end if;
  update escolas_dela set criterios = v_crit where id = p_id;
end;
$$;
revoke all on function public.marcar_criterio_escola(bigint, text, text) from public;
revoke all on function public.marcar_criterio_escola(bigint, text, text) from anon;
grant execute on function public.marcar_criterio_escola(bigint, text, text) to authenticated;

create or replace function public.remover_escola(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from escolas_dela where id = p_id and contato_id = public.meu_contato_id();
$$;
revoke all on function public.remover_escola(bigint) from public;
revoke all on function public.remover_escola(bigint) from anon;
grant execute on function public.remover_escola(bigint) to authenticated;
