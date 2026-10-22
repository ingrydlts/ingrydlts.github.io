-- Por Dentro — CRM, aba "Plataforma" da ficha: propostas (etapa 2)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos, eventos e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- Uma proposta é um cartão livre: título, texto, um link opcional e um prazo opcional. A pessoa
-- responde dentro do app com um de três botões: Aceitar, Agora não ou Recusar.
--
-- Estados (coluna status): enviada → vista → aceita | recusada.
--   "Agora não" não encerra: a proposta fica 'vista' e some do app por 3 dias (adiada_ate).
--   "Expirou" não é estado gravado: é prazo vencido enquanto ainda enviada/vista (o CRM e o app calculam).
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo via RLS (eh_admin())
--   pessoa logada  → minhas_propostas() (lê só as suas), marcar_proposta_vista(), responder_proposta()
--
-- A linha do tempo da ficha se mantém sozinha: enviar, ver, aceitar, recusar e adiar viram eventos
-- (gatilho abaixo). Enviar a proposta é coisa SUA e não zera o "parada há N dias"; o que a pessoa faz, zera.

create table if not exists public.propostas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 120),
  texto text not null check (length(texto) between 1 and 1000),
  link text check (link is null or (length(link) <= 500 and link ~ '^https://')),
  link_rotulo text check (link_rotulo is null or length(link_rotulo) <= 40),
  prazo timestamptz,                 -- null = sem prazo
  status text not null default 'enviada' check (status in ('enviada', 'vista', 'aceita', 'recusada')),
  adiada_ate timestamptz,            -- "Agora não": o app só volta a mostrar depois disso
  criado_em timestamptz not null default now(),
  visto_em timestamptz,
  respondido_em timestamptz
);
create index if not exists propostas_contato_idx on public.propostas (contato_id, criado_em desc);

alter table public.propostas enable row level security;
drop policy if exists "propostas: só admin" on public.propostas;
create policy "propostas: só admin" on public.propostas
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.propostas from anon;

-- ---------- Pessoa logada ----------
-- As propostas desta pessoa (as 20 mais recentes). 'expirada' já vem calculada.
create or replace function public.minhas_propostas() returns table (
  id bigint, titulo text, texto text, link text, link_rotulo text, prazo timestamptz,
  status text, adiada_ate timestamptz, criado_em timestamptz, expirada boolean)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select p.id, p.titulo, p.texto, p.link, p.link_rotulo, p.prazo, p.status, p.adiada_ate, p.criado_em,
         (p.status in ('enviada', 'vista') and p.prazo is not null and p.prazo <= now()) as expirada
    from propostas p join contatos c on c.id = p.contato_id
   where c.user_id = auth.uid()
   order by p.criado_em desc limit 20;
$$;
revoke all on function public.minhas_propostas() from public;
grant execute on function public.minhas_propostas() to authenticated;

-- A pessoa abriu o cartão: enviada → vista (só avança, nunca volta nem sobrescreve uma resposta).
create or replace function public.marcar_proposta_vista(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update propostas p set status = 'vista', visto_em = now()
    from contatos c
   where p.id = p_id and c.id = p.contato_id and c.user_id = auth.uid() and p.status = 'enviada';
$$;
revoke all on function public.marcar_proposta_vista(bigint) from public;
grant execute on function public.marcar_proposta_vista(bigint) to authenticated;

-- A resposta: 'aceitar' | 'recusar' | 'depois'. Só vale enquanto a proposta está aberta e no prazo.
-- Aceitar e recusar são definitivos (a pessoa não troca de ideia sozinha; você reenvia se quiser).
create or replace function public.responder_proposta(p_id bigint, p_resposta text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v propostas%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if p_resposta is null or p_resposta <> all (array['aceitar', 'recusar', 'depois']) then
    raise exception 'resposta_invalida';
  end if;

  select p.* into v from propostas p join contatos c on c.id = p.contato_id
   where p.id = p_id and c.user_id = auth.uid() for update of p;
  if not found then
    raise exception 'proposta_nao_encontrada';
  end if;
  if v.status not in ('enviada', 'vista') then
    raise exception 'proposta_ja_respondida';
  end if;
  if v.prazo is not null and v.prazo <= now() then
    raise exception 'proposta_expirada';
  end if;

  if p_resposta = 'depois' then
    update propostas set status = 'vista', visto_em = coalesce(visto_em, now()), adiada_ate = now() + interval '3 days' where id = p_id;
  else
    update propostas set status = case p_resposta when 'aceitar' then 'aceita' else 'recusada' end,
                         visto_em = coalesce(visto_em, now()), respondido_em = now(), adiada_ate = null
     where id = p_id;
  end if;
end;
$$;
revoke all on function public.responder_proposta(bigint, text) from public;
grant execute on function public.responder_proposta(bigint, text) to authenticated;

-- ---------- Linha do tempo ----------
-- Mesma regra dos outros gatilhos: nunca derrubam a gravação que os disparou.
create or replace function public.crm_on_proposta() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  begin
    if tg_op = 'INSERT' then
      v_tipo := 'proposta_enviada';
    elsif new.status is distinct from old.status then
      v_tipo := case new.status when 'vista' then 'proposta_vista' when 'aceita' then 'proposta_aceita' when 'recusada' then 'proposta_recusada' end;
    elsif new.adiada_ate is distinct from old.adiada_ate and new.adiada_ate is not null then
      v_tipo := 'proposta_adiada';
    end if;
    -- Adiar uma proposta ainda não vista muda o status (enviada → vista) e o adiamento juntos: vale o adiamento.
    if tg_op = 'UPDATE' and new.status = 'vista' and new.adiada_ate is distinct from old.adiada_ate and new.adiada_ate is not null then
      v_tipo := 'proposta_adiada';
    end if;
    if v_tipo is not null then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, v_tipo, jsonb_build_object('proposta_id', new.id, 'titulo', left(new.titulo, 120)));
    end if;
  exception when others then
    raise warning 'crm_on_proposta: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_propostas_evento on public.propostas;
create trigger crm_propostas_evento after insert or update of status, adiada_ate on public.propostas
  for each row execute function public.crm_on_proposta();

-- Substitui a função da fase 2 só para acrescentar 'proposta_enviada' à lista do que é feito por você.
create or replace function public.crm_evento_recente() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> all (array['estagio_alterado', 'sinal_enviado', 'email_enviado', 'pergunta_respondida', 'um_a_um_agendado', 'proposta_enviada']) then
    update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id;
  end if;
  return new;
end;
$$;
