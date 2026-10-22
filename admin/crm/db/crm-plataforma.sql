-- Por Dentro — CRM, aba "Plataforma" da ficha: o que a pessoa faz dentro do app (etapa 1)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos, sinais e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- O que entra:
--   plataforma_cliques   um clique significativo = uma linha (tela, tipo, rótulo). Separada de
--                        `eventos` de propósito: a linha do tempo da ficha lê só 200 eventos e
--                        não pode ser afogada por cliques.
--   registrar_cliques()  a pessoa logada manda um lote (até 50) pelo app; só grava na ficha dela.
--
-- Quem lê e escreve o quê:
--   pessoa logada  → registrar_cliques() (só insere, nunca lê)
--   admin (você)   → lê tudo via RLS (eh_admin())
--
-- Volume: cliques significativos, não todo clique — algumas dezenas por sessão. Se um dia pesar,
-- apague o antigo: delete from plataforma_cliques where criado_em < now() - interval '180 days';

create table if not exists public.plataforma_cliques (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  sessao text,
  tela text not null,
  alvo text not null,      -- tipo: 'tela' (abriu uma tela), 'botao' ou 'link'
  rotulo text,             -- o que estava escrito/rotulado no elemento
  criado_em timestamptz not null default now()
);
create index if not exists plataforma_cliques_contato_idx on public.plataforma_cliques (contato_id, criado_em desc);

alter table public.plataforma_cliques enable row level security;
drop policy if exists "plataforma_cliques: só admin" on public.plataforma_cliques;
create policy "plataforma_cliques: só admin" on public.plataforma_cliques
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.plataforma_cliques from anon;

create or replace function public.registrar_cliques(p_itens jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'formato_invalido';
  end if;
  if jsonb_array_length(p_itens) > 50 or pg_column_size(p_itens) > 20000 then
    raise exception 'lote_grande_demais';
  end if;

  select id into v_id from public.contatos where user_id = auth.uid();
  if v_id is null then return; end if;

  insert into public.plataforma_cliques (contato_id, sessao, tela, alvo, rotulo, criado_em)
  select v_id,
         left(x->>'sessao', 40),
         left(coalesce(nullif(x->>'tela', ''), '?'), 120),
         case when x->>'alvo' in ('tela', 'botao', 'link') then x->>'alvo' else 'botao' end,
         left(x->>'rotulo', 120),
         -- a hora vem do navegador (o lote sai alguns segundos depois do clique); fora de 1 dia, vale a do servidor
         case when (x->>'em') ~ '^\d{4}-\d{2}-\d{2}T' and (x->>'em')::timestamptz between now() - interval '1 day' and now() + interval '5 minutes'
              then (x->>'em')::timestamptz else now() end
    from jsonb_array_elements(p_itens) x;
end;
$$;
revoke all on function public.registrar_cliques(jsonb) from public;
grant execute on function public.registrar_cliques(jsonb) to authenticated;
