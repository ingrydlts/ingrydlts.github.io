-- Por Dentro — CRM: o chat com a pessoa (substitui os sinais)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql e de crm-propostas.sql (usa contatos, eventos, propostas e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum. Os sinais antigos continuam no banco.
--
-- Um chat só entre você e cada pessoa. Tudo passa por ele: o que você escreve, o que ela escreve, e as propostas
-- (o cartão com Sim / Não / Depois, de crm-propostas.sql). Uma proposta é uma mensagem do chat que aponta para a linha
-- de `propostas`; o estado dela (enviada, vista, aceita, recusada) continua lá.
--
--   chat_mensagens   uma linha por mensagem
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo, via RLS (eh_admin()); envia por crm_chat_enviar() (cria a proposta junto, de uma vez)
--   pessoa logada  → lê as suas pela RLS (o Realtime precisa disso) e escreve só por chat_enviar();
--                    meu_chat() devolve a conversa já com os dados de cada proposta; chat_marcar_lidas() marca o que leu
--
-- "acao" é o pedido rápido que a pessoa faz com um botão no app (marcar 1:1 de 20 min, dúvida, ajuda com documento).
-- Se o Realtime do Supabase estiver ligado, o chat e as propostas entram na publicação: as mensagens chegam sem recarregar.

alter table public.propostas add column if not exists acao_sim text check (acao_sim is null or length(acao_sim) <= 500);

create table if not exists public.chat_mensagens (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  de text not null check (de in ('ingryd', 'pessoa')),
  tipo text not null default 'texto' check (tipo in ('texto', 'proposta')),
  texto text not null check (length(texto) between 1 and 1000),   -- na proposta, o título dela
  acao text check (acao is null or acao in ('pedido_1a1', 'duvida', 'documento')),
  proposta_id bigint references public.propostas(id) on delete set null,
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);
create index if not exists chat_mensagens_contato_idx on public.chat_mensagens (contato_id, id desc);

alter table public.chat_mensagens enable row level security;
-- A pessoa não lê `contatos` (RLS só admin), então "qual é a minha ficha" precisa de uma função que enxerga por ela.
create or replace function public.meu_contato_id() returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$ select id from public.contatos where user_id = auth.uid() $$;
revoke all on function public.meu_contato_id() from public;
revoke all on function public.meu_contato_id() from anon;
grant execute on function public.meu_contato_id() to authenticated;

drop policy if exists "chat_mensagens: só admin" on public.chat_mensagens;
create policy "chat_mensagens: só admin" on public.chat_mensagens
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "chat_mensagens: pessoa lê as suas" on public.chat_mensagens;
create policy "chat_mensagens: pessoa lê as suas" on public.chat_mensagens
  for select using (contato_id = public.meu_contato_id());
revoke all on public.chat_mensagens from anon;

-- ---------- Você ----------
-- Texto simples, ou uma proposta (p_proposta: {titulo, texto, acao_sim, prazo, link, link_rotulo}). A proposta e a
-- mensagem nascem juntas: se uma falha, nenhuma fica. Devolve o id da mensagem.
create or replace function public.crm_chat_enviar(p_contato uuid, p_texto text default null, p_proposta jsonb default null) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pid bigint;
  v_id bigint;
  v_titulo text;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if not exists (select 1 from contatos where id = p_contato) then
    raise exception 'contato_nao_encontrado';
  end if;

  if p_proposta is not null then
    if jsonb_typeof(p_proposta) <> 'object' then raise exception 'proposta_invalida'; end if;
    v_titulo := btrim(coalesce(p_proposta->>'titulo', ''));
    if length(v_titulo) not between 1 and 120 then raise exception 'proposta_invalida'; end if;
    insert into propostas (contato_id, titulo, texto, acao_sim, prazo, link, link_rotulo)
    values (p_contato, v_titulo, btrim(coalesce(p_proposta->>'texto', '')), nullif(btrim(coalesce(p_proposta->>'acao_sim', '')), ''),
            nullif(p_proposta->>'prazo', '')::timestamptz, nullif(btrim(coalesce(p_proposta->>'link', '')), ''),
            nullif(btrim(coalesce(p_proposta->>'link_rotulo', '')), ''))
    returning id into v_pid;
    insert into chat_mensagens (contato_id, de, tipo, texto, proposta_id) values (p_contato, 'ingryd', 'proposta', v_titulo, v_pid) returning id into v_id;
  else
    if p_texto is null or length(btrim(p_texto)) not between 1 and 1000 then raise exception 'mensagem_invalida'; end if;
    insert into chat_mensagens (contato_id, de, texto) values (p_contato, 'ingryd', btrim(p_texto)) returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.crm_chat_enviar(uuid, text, jsonb) from public;
revoke all on function public.crm_chat_enviar(uuid, text, jsonb) from anon;
grant execute on function public.crm_chat_enviar(uuid, text, jsonb) to authenticated;

-- ---------- Pessoa logada ----------
-- A conversa dela (as 100 mais recentes), com a proposta de cada cartão já junto.
create or replace function public.meu_chat() returns table (
  id bigint, de text, tipo text, texto text, acao text, criado_em timestamptz, lida_em timestamptz, proposta jsonb)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select m.id, m.de, m.tipo, m.texto, m.acao, m.criado_em, m.lida_em,
         case when p.id is null then null else jsonb_build_object(
           'id', p.id, 'titulo', p.titulo, 'texto', p.texto, 'acao_sim', p.acao_sim, 'link', p.link, 'link_rotulo', p.link_rotulo,
           'prazo', p.prazo, 'status', p.status, 'adiada_ate', p.adiada_ate,
           'expirada', (p.status in ('enviada', 'vista') and p.prazo is not null and p.prazo <= now())) end
    from chat_mensagens m
    join contatos c on c.id = m.contato_id
    left join propostas p on p.id = m.proposta_id
   where c.user_id = auth.uid()
   order by m.id desc limit 100;
$$;
revoke all on function public.meu_chat() from public;
revoke all on function public.meu_chat() from anon;
grant execute on function public.meu_chat() to authenticated;

-- A pessoa escreve (ou usa um botão de pedido rápido). No máximo 20 mensagens a cada 10 minutos.
create or replace function public.chat_enviar(p_texto text, p_acao text default null) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_txt text := btrim(coalesce(p_texto, ''));
  v_msg bigint;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if length(v_txt) not between 1 and 1000 then
    raise exception 'mensagem_invalida';
  end if;
  if p_acao is not null and p_acao <> all (array['pedido_1a1', 'duvida', 'documento']) then
    raise exception 'acao_invalida';
  end if;

  select id into v_id from contatos where user_id = auth.uid();
  if v_id is null then
    raise exception 'sem_ficha';
  end if;
  if (select count(*) from chat_mensagens where contato_id = v_id and de = 'pessoa' and criado_em > now() - interval '10 minutes') >= 20 then
    raise exception 'muitas_mensagens';
  end if;

  insert into chat_mensagens (contato_id, de, texto, acao) values (v_id, 'pessoa', v_txt, p_acao) returning id into v_msg;

  -- Linha do tempo: o que ela escreveu conta como atividade dela.
  begin
    insert into eventos (contato_id, tipo, dados) values (v_id, 'chat_mensagem',
      jsonb_strip_nulls(jsonb_build_object('trecho', left(v_txt, 120), 'acao', p_acao)));
  exception when others then
    raise warning 'chat_enviar: %', sqlerrm;
  end;
  return v_msg;
end;
$$;
revoke all on function public.chat_enviar(text, text) from public;
revoke all on function public.chat_enviar(text, text) from anon;
grant execute on function public.chat_enviar(text, text) to authenticated;

-- Ela abriu o chat: tudo o que você mandou vira lido.
create or replace function public.chat_marcar_lidas() returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update chat_mensagens m set lida_em = now()
    from contatos c
   where c.id = m.contato_id and c.user_id = auth.uid() and m.de = 'ingryd' and m.lida_em is null;
$$;
revoke all on function public.chat_marcar_lidas() from public;
revoke all on function public.chat_marcar_lidas() from anon;
grant execute on function public.chat_marcar_lidas() to authenticated;

-- ---------- Realtime (opcional) ----------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_mensagens', 'propostas'] loop
      if to_regclass('public.' || t) is not null and not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
