-- Por Dentro — CRM: os insights da "Minha iAssistente" (o card que ela vê no dashboard)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos, eventos e eh_admin()) e de crm-checklist.sql.
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- Os insights automáticos são calculados no navegador dela (assets/js/iassistente.js), a cada vez que o dashboard
-- desenha, a partir do perfil e do checklist. Por isso o app manda para cá, em registrar_insights(), a lista que
-- acabou de mostrar. Quando a lista muda (ela marcou um item, respondeu uma pergunta, você mudou o dossiê), o banco
-- guarda o que entrou e o que saiu e cria um evento na linha do tempo. Assim você vê o que está no ar e o que mudou.
--
-- Você também publica notas suas (insights_manuais). O app as busca por meus_insights_manuais() e as mostra no
-- mesmo carrossel; como o app devolve a lista inteira que mostrou, você vê quando ela passou a vê-las.
--
--   insights_vivos      a lista que ela vê agora (uma linha por pessoa)
--   insights_historico  cada mudança: o que entrou e o que saiu
--   insights_manuais    as notas que você escreve para ela
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo, via RLS (eh_admin())
--   pessoa logada  → registrar_insights() (grava só na ficha dela) e meus_insights_manuais() (lê só as dela)
--
-- Se o Realtime do Supabase estiver ligado, as quatro tabelas do final entram na publicação para o CRM atualizar
-- sozinho. Sem ele, o CRM consulta de tempos em tempos.

create table if not exists public.insights_vivos (
  contato_id uuid primary key references public.contatos(id) on delete cascade,
  notas jsonb not null default '[]'::jsonb,       -- [{id, icone, texto}], na ordem em que ela vê
  assinatura text not null default '',
  atualizado_em timestamptz not null default now()
);

create table if not exists public.insights_historico (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  inicial boolean not null default false,          -- primeira leitura da pessoa, não é uma mudança
  entrou jsonb not null default '[]'::jsonb,       -- [{id, icone, texto}]
  saiu jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists insights_historico_contato_idx on public.insights_historico (contato_id, criado_em desc);

create table if not exists public.insights_manuais (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  icone text not null default '💡' check (length(icone) between 1 and 8),
  texto text not null check (length(texto) between 1 and 800),
  ate timestamptz,                                 -- null = sem fim
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  retirado_em timestamptz
);
create index if not exists insights_manuais_contato_idx on public.insights_manuais (contato_id, criado_em desc);

alter table public.insights_vivos enable row level security;
alter table public.insights_historico enable row level security;
alter table public.insights_manuais enable row level security;
drop policy if exists "insights_vivos: só admin" on public.insights_vivos;
create policy "insights_vivos: só admin" on public.insights_vivos for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "insights_historico: só admin" on public.insights_historico;
create policy "insights_historico: só admin" on public.insights_historico for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "insights_manuais: só admin" on public.insights_manuais;
create policy "insights_manuais: só admin" on public.insights_manuais for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.insights_vivos, public.insights_historico, public.insights_manuais from anon;

-- ---------- Pessoa logada ----------
-- O app manda a lista que acabou de desenhar. Só grava (e só cria evento) quando a lista MUDOU.
create or replace function public.registrar_insights(p_notas jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_novas jsonb;
  v_assin text;
  v_velho public.insights_vivos%rowtype;
  v_entrou jsonb;
  v_saiu jsonb;
  v_antes timestamptz;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if p_notas is null or jsonb_typeof(p_notas) <> 'array' then
    raise exception 'formato_invalido';
  end if;
  if jsonb_array_length(p_notas) > 30 or pg_column_size(p_notas) > 60000 then
    raise exception 'lista_grande_demais';
  end if;

  select id, ultimo_evento_em into v_id, v_antes from public.contatos where user_id = auth.uid();
  if v_id is null then return; end if;

  -- Só id, ícone e texto, aparados: o resto que o app mandar não entra.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', left(coalesce(x->>'id', ''), 80),
           'icone', left(coalesce(x->>'icone', ''), 8),
           'texto', left(coalesce(x->>'texto', ''), 1500)) order by n), '[]'::jsonb)
    into v_novas
    from jsonb_array_elements(p_notas) with ordinality as t(x, n)
   where jsonb_typeof(x) = 'object' and coalesce(x->>'id', '') <> '';
  v_assin := md5(v_novas::text);

  select * into v_velho from public.insights_vivos where contato_id = v_id for update;
  if not found then
    insert into public.insights_vivos (contato_id, notas, assinatura) values (v_id, v_novas, v_assin);
    insert into public.insights_historico (contato_id, inicial, entrou) values (v_id, true, v_novas);
    return;
  end if;
  if v_velho.assinatura = v_assin then return; end if;

  -- Uma nota é a mesma se tem o mesmo id E o mesmo texto: texto mudado conta como saiu + entrou.
  select coalesce(jsonb_agg(n), '[]'::jsonb) into v_entrou
    from jsonb_array_elements(v_novas) n
   where not exists (select 1 from jsonb_array_elements(v_velho.notas) o where o->>'id' = n->>'id' and o->>'texto' = n->>'texto');
  select coalesce(jsonb_agg(o), '[]'::jsonb) into v_saiu
    from jsonb_array_elements(v_velho.notas) o
   where not exists (select 1 from jsonb_array_elements(v_novas) n where o->>'id' = n->>'id' and o->>'texto' = n->>'texto');

  update public.insights_vivos set notas = v_novas, assinatura = v_assin, atualizado_em = now() where contato_id = v_id;
  insert into public.insights_historico (contato_id, entrou, saiu) values (v_id, v_entrou, v_saiu);

  -- Linha do tempo: só os ids (o texto está no histórico). A mudança vem de uma ação dela ou sua, não conta como
  -- atividade nova: o "parada há N dias" fica como estava.
  begin
    insert into public.eventos (contato_id, tipo, dados) values (v_id, 'insights_alterados', jsonb_build_object(
      'entrou', (select coalesce(jsonb_agg(e->>'id'), '[]'::jsonb) from jsonb_array_elements(v_entrou) e),
      'saiu', (select coalesce(jsonb_agg(e->>'id'), '[]'::jsonb) from jsonb_array_elements(v_saiu) e)));
    update public.contatos set ultimo_evento_em = v_antes where id = v_id;
  exception when others then
    raise warning 'registrar_insights: %', sqlerrm;
  end;
end;
$$;
revoke all on function public.registrar_insights(jsonb) from public;
grant execute on function public.registrar_insights(jsonb) to authenticated;

-- As notas que você escreveu para ESTA pessoa e ainda valem.
create or replace function public.meus_insights_manuais() returns table (id bigint, icone text, texto text)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select m.id, m.icone, m.texto
    from public.insights_manuais m join public.contatos c on c.id = m.contato_id
   where c.user_id = auth.uid() and m.ativo and (m.ate is null or m.ate > now())
   order by m.criado_em desc limit 10;
$$;
revoke all on function public.meus_insights_manuais() from public;
grant execute on function public.meus_insights_manuais() to authenticated;

-- ---------- Realtime (opcional) ----------
-- Entram na publicação do Supabase Realtime só se ela existir. Rodar de novo não duplica.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['insights_vivos', 'insights_historico', 'plataforma_cliques', 'checklist_items'] loop
      if to_regclass('public.' || t) is not null and not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
