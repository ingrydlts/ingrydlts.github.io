-- Por Dentro — Biblioteca de guias gerais: o texto de um passo da démarche que vale para TODAS as pessoas, escrito uma vez e mostrado
-- no quadro do passo no app. Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e
-- db/conferir-banco.sql (do app). Depende de crm-fase2.sql (eh_admin). Idempotente. Não contém dado de pessoa.
--
--   1. guias_gerais          uma linha por passo (`step_key` do template do checklist). Só admin lê e escreve.
--                            estado 'rascunho' (só a equipe vê) ou 'publicado' (o app mostra no lugar do texto do template).
--   2. guias_gerais_publicos()  o que o app recebe: só os publicados, sem autor nem rascunho.

create or replace function public.guia_passos_ok(p jsonb) returns boolean
language sql immutable set search_path = public, pg_temp
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 8
     and not exists (select 1 from jsonb_array_elements(p) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 220);
$$;
create or replace function public.guia_links_ok(p jsonb) returns boolean
language sql immutable set search_path = public, pg_temp
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 6
     and not exists (select 1 from jsonb_array_elements(p) e
       where jsonb_typeof(e) <> 'object' or (e ->> 'url') !~ '^https://[^\s]+$' or length(e ->> 'url') > 500 or length(coalesce(e ->> 'rotulo', '')) > 120);
$$;
revoke all on function public.guia_passos_ok(jsonb) from public;
revoke all on function public.guia_passos_ok(jsonb) from anon;
revoke all on function public.guia_links_ok(jsonb) from public;
revoke all on function public.guia_links_ok(jsonb) from anon;
grant execute on function public.guia_passos_ok(jsonb) to authenticated;
grant execute on function public.guia_links_ok(jsonb) to authenticated;

create table if not exists public.guias_gerais (
  step_key text primary key check (step_key ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  por_que text check (por_que is null or length(por_que) <= 400),
  atencao text check (atencao is null or length(atencao) <= 500),
  passos jsonb not null default '[]'::jsonb check (public.guia_passos_ok(passos)),
  links jsonb not null default '[]'::jsonb check (public.guia_links_ok(links)),
  fonte_url text check (fonte_url is null or (fonte_url ~ '^https?://[^\s]+$' and length(fonte_url) <= 500)),
  estado text not null default 'rascunho' check (estado in ('rascunho', 'publicado')),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
alter table public.guias_gerais enable row level security;
drop policy if exists "guias_gerais: só admin" on public.guias_gerais;
create policy "guias_gerais: só admin" on public.guias_gerais for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.guias_gerais from anon;

create or replace function public.guias_gerais_publicos() returns jsonb
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('step_key', g.step_key, 'por_que', g.por_que, 'atencao', g.atencao, 'passos', g.passos, 'links', g.links) order by g.step_key), '[]'::jsonb)
    from public.guias_gerais g
   where g.estado = 'publicado' and auth.uid() is not null;
$$;
revoke all on function public.guias_gerais_publicos() from public;
revoke all on function public.guias_gerais_publicos() from anon;
grant execute on function public.guias_gerais_publicos() to authenticated;
