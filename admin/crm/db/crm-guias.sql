-- GUIAS GRATUITOS DE CADA PESSOA: os que ela pediu aparecem sozinhos na aba Guias do app; os que a Ingryd decide indicar entram quando ela indica.
-- Rode DEPOIS de crm-caso-listas.sql (a ordem entre os dois não importa para quem já rodou: meu_caso() só pergunta pelos guias na hora de abrir).
-- Pode rodar de novo sem estragar nada. Só acrescenta.
--
--   guias_catalogo  os guias de /guias/ (slug, origem do funil, título, resumo, categoria, endereço, tempo de leitura). O CRM sincroniza com
--                   content/guias.json (crm_guias_catalogo_sincronizar); quem sai do JSON fica "despublicado" aqui, sem apagar nada.
--                   A "origem" é a marca que o guia grava no contato quando a pessoa o pede (ex.: guia-vls-ts, em contatos.origens).
--   caso_guias      os guias que a Ingryd indicou para uma pessoa (um por linha). Retirar apaga a linha; o que a pessoa pediu nunca é escondido.
--   meu_caso()      passa a devolver "guias": o que ela pediu (motivo "pediu") + o que foi indicado (motivo "indicado"), sem repetir, só os publicados.
-- Os guias são páginas públicas do site: indicar não depende do consentimento de serviço. Só admin lê e escreve as tabelas; a pessoa só recebe o seu
-- resultado por meu_caso(). A mudança no meu_caso() mora em crm-caso-listas.sql (a versão final), que chama guias_da_pessoa().

create table if not exists public.guias_catalogo (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,80}$'),
  origem text check (origem is null or origem ~ '^[a-z0-9-]{1,60}$'),
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  resumo text check (resumo is null or length(resumo) <= 400),
  categoria text check (categoria is null or length(categoria) <= 60),
  url text not null check (url ~ '^/guias/[a-z0-9-]{1,80}/$'),
  leitura_min smallint check (leitura_min is null or leitura_min between 1 and 120),
  publicado boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.guias_catalogo enable row level security;
drop policy if exists "guias_catalogo: só admin" on public.guias_catalogo;
create policy "guias_catalogo: só admin" on public.guias_catalogo for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.guias_catalogo from anon;

create table if not exists public.caso_guias (
  contato_id uuid not null references public.contatos(id) on delete cascade,
  slug text not null references public.guias_catalogo(slug) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (contato_id, slug)
);
alter table public.caso_guias enable row level security;
drop policy if exists "caso_guias: só admin" on public.caso_guias;
create policy "caso_guias: só admin" on public.caso_guias for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.caso_guias from anon;

-- O CRM manda a lista de content/guias.json (mais a origem de cada guia). Até 40 guias; qualquer item fora do formato derruba tudo.
create or replace function public.crm_guias_catalogo_sincronizar(p_itens jsonb) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  g jsonb; v_slugs text[] := '{}'; v_n int := 0;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 40 then raise exception 'catalogo_invalido'; end if;
  for g in select * from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(g) <> 'object' then raise exception 'catalogo_invalido'; end if;
    insert into guias_catalogo (slug, origem, titulo, resumo, categoria, url, leitura_min, publicado, atualizado_em)
    values (g->>'slug', nullif(g->>'origem', ''), g->>'titulo', nullif(g->>'resumo', ''), nullif(g->>'categoria', ''), g->>'url', (nullif(g->>'leitura_min', ''))::smallint, coalesce((g->>'publicado')::boolean, true), now())
    on conflict (slug) do update set origem = excluded.origem, titulo = excluded.titulo, resumo = excluded.resumo, categoria = excluded.categoria, url = excluded.url,
      leitura_min = excluded.leitura_min, publicado = excluded.publicado, atualizado_em = now();
    v_slugs := v_slugs || (g->>'slug');
    v_n := v_n + 1;
  end loop;
  update guias_catalogo set publicado = false, atualizado_em = now() where publicado and slug <> all (v_slugs);   -- saiu do JSON: despublicado (nada é apagado)
  return v_n;
end;
$$;
revoke all on function public.crm_guias_catalogo_sincronizar(jsonb) from public;
revoke all on function public.crm_guias_catalogo_sincronizar(jsonb) from anon;
grant execute on function public.crm_guias_catalogo_sincronizar(jsonb) to authenticated;

create or replace function public.crm_guia_indicar(p_contato uuid, p_slug text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if not exists (select 1 from guias_catalogo where slug = p_slug and publicado) then raise exception 'guia_nao_encontrado'; end if;
  insert into caso_guias (contato_id, slug) values (p_contato, p_slug) on conflict do nothing;
end;
$$;
revoke all on function public.crm_guia_indicar(uuid, text) from public;
revoke all on function public.crm_guia_indicar(uuid, text) from anon;
grant execute on function public.crm_guia_indicar(uuid, text) to authenticated;

create or replace function public.crm_guia_retirar(p_contato uuid, p_slug text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  delete from caso_guias where contato_id = p_contato and slug = p_slug;
end;
$$;
revoke all on function public.crm_guia_retirar(uuid, text) from public;
revoke all on function public.crm_guia_retirar(uuid, text) from anon;
grant execute on function public.crm_guia_retirar(uuid, text) to authenticated;

-- O que a pessoa recebe: o que ela pediu (a origem do guia está em contatos.origens) e o que foi indicado, só os publicados, sem repetir.
-- Só o meu_caso() chama esta função (security definer): ela recebe um contato qualquer, então ninguém mais pode executá-la.
create or replace function public.guias_da_pessoa(p_contato uuid) returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'titulo', x.titulo, 'resumo', x.resumo, 'categoria', x.categoria, 'url', x.url,
           'leitura_min', x.leitura_min, 'motivo', x.motivo) order by x.ord, x.titulo), '[]'::jsonb)
    from (
      select g.slug, g.titulo, g.resumo, g.categoria, g.url, g.leitura_min, 'pediu' as motivo, 0 as ord
        from guias_catalogo g join contatos c on c.id = p_contato
       where g.publicado and g.origem is not null and g.origem = any (c.origens)
      union all
      select g.slug, g.titulo, g.resumo, g.categoria, g.url, g.leitura_min, 'indicado', 1
        from caso_guias cg join guias_catalogo g on g.slug = cg.slug
       where cg.contato_id = p_contato and g.publicado
         and not exists (select 1 from contatos c where c.id = p_contato and g.origem is not null and g.origem = any (c.origens))
    ) x);
end;
$$;
revoke all on function public.guias_da_pessoa(uuid) from public;
revoke all on function public.guias_da_pessoa(uuid) from anon;
revoke all on function public.guias_da_pessoa(uuid) from authenticated;
