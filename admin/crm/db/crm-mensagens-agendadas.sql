-- Por Dentro — CRM: mensagens agendadas (você escolhe o dia e a hora em que a pergunta sai do CRM e chega ao chat dela)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-chat.sql (usa contatos, eventos, chat_mensagens e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- Como funciona: no Roteiro de perguntas (ficha → dossiê) você escreve ou ajusta a mensagem e escolhe quando ela sai. A mensagem fica aqui
-- como `pendente`. A cada hora o Worker (Cron "5 * * * *", o mesmo das sequências do estúdio) pega as que já venceram, coloca no chat dela
-- como mensagem sua (chat_mensagens, de = 'ingryd') e manda o e-mail de aviso ("a Ingryd te respondeu no Por Dentro"). Por isso a hora tem
-- precisão de uma hora, não de minutos. Cancelar antes da hora é só um botão.
--
--   mensagens_agendadas   uma linha por mensagem; status: pendente → enviada | cancelada | erro
--
-- Quem lê e escreve o quê:
--   admin (você)  → tudo via RLS (eh_admin()); agenda por crm_agendar_mensagem() e cancela por crm_cancelar_mensagem_agendada()
--   Worker        → chave de serviço (passa por cima da RLS): marca como enviada e cria a mensagem no chat
--   pessoa logada e anon → nada (não enxergam esta tabela; só veem a mensagem depois que ela entra no chat)
--
-- Como desfazer:
--   drop function if exists public.crm_cancelar_mensagem_agendada(bigint);
--   drop function if exists public.crm_agendar_mensagem(uuid, text, timestamptz, text, text);
--   drop table if exists public.mensagens_agendadas;

create table if not exists public.mensagens_agendadas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 1000),             -- o mesmo limite do chat
  enviar_em timestamptz not null,
  origem text not null default 'roteiro' check (origem in ('roteiro', 'manual')),
  campo text check (campo is null or length(campo) <= 60),                  -- a chave do Dossiê que a pergunta busca, quando houver
  status text not null default 'pendente' check (status in ('pendente', 'enviada', 'cancelada', 'erro')),
  tentativas int not null default 0,
  erro text check (erro is null or length(erro) <= 300),
  mensagem_id bigint,                                                        -- a linha criada em chat_mensagens quando enviou
  criado_em timestamptz not null default now(),
  enviada_em timestamptz
);
create index if not exists mensagens_agendadas_fila_idx on public.mensagens_agendadas (status, enviar_em);
create index if not exists mensagens_agendadas_contato_idx on public.mensagens_agendadas (contato_id, enviar_em desc);
alter table public.mensagens_agendadas enable row level security;
drop policy if exists "mensagens_agendadas: só admin" on public.mensagens_agendadas;
create policy "mensagens_agendadas: só admin" on public.mensagens_agendadas
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.mensagens_agendadas from anon;

-- Agenda uma mensagem. Entre 5 minutos e 120 dias no futuro (para "agora", use o chat; para mais longe, agende de novo mais perto da data).
create or replace function public.crm_agendar_mensagem(p_contato uuid, p_texto text, p_enviar_em timestamptz,
                                                       p_origem text default 'roteiro', p_campo text default null) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_txt text := btrim(coalesce(p_texto, ''));
  v_antes timestamptz;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if length(v_txt) not between 1 and 1000 then
    raise exception 'mensagem_invalida';
  end if;
  if p_enviar_em is null or p_enviar_em < now() + interval '5 minutes' or p_enviar_em > now() + interval '120 days' then
    raise exception 'data_invalida';
  end if;
  if p_origem is null or p_origem <> all (array['roteiro', 'manual']) then
    raise exception 'origem_invalida';
  end if;
  select ultimo_evento_em into v_antes from contatos where id = p_contato;
  if not found then
    raise exception 'contato_nao_encontrado';
  end if;
  insert into mensagens_agendadas (contato_id, texto, enviar_em, origem, campo)
  values (p_contato, v_txt, p_enviar_em, p_origem, nullif(btrim(coalesce(p_campo, '')), ''))
  returning id into v_id;
  -- Linha do tempo: coisa SUA, não zera o "parada há N dias" dela.
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'mensagem_agendada',
    jsonb_strip_nulls(jsonb_build_object('para', p_enviar_em, 'campo', nullif(btrim(coalesce(p_campo, '')), ''))));
  update contatos set ultimo_evento_em = v_antes where id = p_contato;
  return v_id;
end;
$$;
revoke all on function public.crm_agendar_mensagem(uuid, text, timestamptz, text, text) from public;
revoke all on function public.crm_agendar_mensagem(uuid, text, timestamptz, text, text) from anon;
grant execute on function public.crm_agendar_mensagem(uuid, text, timestamptz, text, text) to authenticated;

-- Cancela uma mensagem que ainda não saiu. Devolve true se cancelou (false: já saiu, já estava cancelada ou não existe).
create or replace function public.crm_cancelar_mensagem_agendada(p_id bigint) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update mensagens_agendadas set status = 'cancelada' where id = p_id and status = 'pendente';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.crm_cancelar_mensagem_agendada(bigint) from public;
revoke all on function public.crm_cancelar_mensagem_agendada(bigint) from anon;
grant execute on function public.crm_cancelar_mensagem_agendada(bigint) to authenticated;
