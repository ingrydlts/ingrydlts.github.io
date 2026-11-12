-- O 1:1 PAGO: o que acontece depois que a pessoa paga a conversa de 20 ou 40 minutos.
-- Rode DEPOIS de crm-caso.sql, crm-caso-importar.sql e crm-caso-fluxo.sql. Pode rodar de novo sem estragar nada.
--
--   1. um_a_um_pagamentos   um registro por pagamento (o id da sessão do Stripe impede contar duas vezes). Guarda até quando o
--                           ÁUDIO está liberado no chat dela (30 dias).
--   2. crm_1a1_pago()       só o Worker (service_role) chama, quando o Stripe avisa do pagamento. Grava o pagamento, libera o áudio e
--                           agenda UM aviso para o dia seguinte, às 9h de Paris: "Antecipe o assunto do seu 1:1".
--   3. meu_1a1()            a pessoa logada pergunta: o áudio está liberado para mim?
--   4. caso_destino_ok()    passa a aceitar { "tela": "chat" } (o botão do aviso abre o chat).
--
-- O áudio em si NUNCA é guardado: o app grava, o Worker transcreve e devolve só o texto; a pessoa confere o texto e envia como
-- uma mensagem normal do chat. Aqui só se guarda quem tem o recurso liberado.

-- ---------- 1. Pagamentos ----------
create table if not exists public.um_a_um_pagamentos (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  minutos smallint not null check (minutos in (20, 40)),
  sessao text not null unique check (length(sessao) between 1 and 200),    -- id da sessão de checkout do Stripe
  pago_em timestamptz not null default now(),
  audio_ate timestamptz not null,
  aviso_id bigint references public.caso_avisos(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists um_a_um_pagamentos_contato_idx on public.um_a_um_pagamentos (contato_id, audio_ate);
alter table public.um_a_um_pagamentos enable row level security;
drop policy if exists "um_a_um_pagamentos: só admin" on public.um_a_um_pagamentos;
create policy "um_a_um_pagamentos: só admin" on public.um_a_um_pagamentos for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.um_a_um_pagamentos from anon;
grant select, insert, update on public.um_a_um_pagamentos to service_role;

-- ---------- 4. O botão do aviso pode abrir o chat ----------
create or replace function public.caso_destino_ok(p_d jsonb) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p_d is null or (jsonb_typeof(p_d) = 'object'
    and not exists (select 1 from jsonb_object_keys(p_d) k where k <> all (array['tela', 'aba', 'item_id', 'servico']))
    and coalesce(p_d->>'tela', 'inicio') = any (array['inicio', 'checklist', 'espaco', 'guias', 'perfil', 'chat'])
    and coalesce(p_d->>'servico', 'revisao') = any (array['revisao', 'conversa', 'hub'])
    and (p_d->>'aba' is null or length(p_d->>'aba') <= 20)
    and (p_d->>'item_id' is null or p_d->>'item_id' ~ '^[0-9]{1,18}$'));
$$;

-- ---------- 2. O pagamento chegou ----------
create or replace function public.crm_1a1_pago(p_contato uuid, p_minutos int, p_sessao text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pag um_a_um_pagamentos%rowtype;
  v_aviso bigint;
  v_quando timestamptz;
  v_agendado boolean := false;
begin
  if p_minutos is null or p_minutos not in (20, 40) or p_sessao is null or length(p_sessao) not between 1 and 200 then
    raise exception 'pagamento_invalido';
  end if;
  if not exists (select 1 from contatos where id = p_contato) then
    raise exception 'contato_nao_encontrado';
  end if;
  -- O Stripe reenvia o mesmo evento: a sessão é única e o segundo aviso volta como duplicado, sem mexer em nada.
  select * into v_pag from um_a_um_pagamentos where sessao = p_sessao;
  if found then
    return jsonb_build_object('duplicado', true, 'audio_ate', v_pag.audio_ate);
  end if;
  insert into um_a_um_pagamentos (contato_id, minutos, sessao, audio_ate)
  values (p_contato, p_minutos, p_sessao, now() + interval '30 days')
  returning * into v_pag;
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'um_a_um_pago', jsonb_build_object('minutos', p_minutos));

  -- O gatilho do dia seguinte: às 9h de Paris, uma proposta que abre o chat. Nasce como rascunho e só vira agendado se houver
  -- consentimento (o guarda do banco decide); sem ele, fica de rascunho para você aprovar na aba Caso.
  v_quando := (((now() at time zone 'Europe/Paris')::date + 1) + time '09:00') at time zone 'Europe/Paris';
  insert into caso_avisos (contato_id, tipo, titulo, texto, destino, modo, estado)
  values (p_contato, 'proposta', 'Antecipe o assunto do seu 1:1',
          'Conte em texto ou em áudio o que você quer tratar. Assim a gente chega na conversa já com o seu caso em mãos.',
          jsonb_build_object('tela', 'chat'), 'data', 'rascunho')
  returning id into v_aviso;
  begin
    update caso_avisos set estado = 'agendado', liberar_em = v_quando where id = v_aviso;
    v_agendado := true;
  exception when others then
    v_agendado := false;      -- sem consentimento: continua rascunho, sem data
  end;
  update um_a_um_pagamentos set aviso_id = v_aviso where id = v_pag.id;
  if v_agendado then perform public.caso_reencadear(p_contato); end if;
  return jsonb_build_object('duplicado', false, 'audio_ate', v_pag.audio_ate, 'aviso_id', v_aviso, 'aviso_agendado', v_agendado, 'avisar_em', case when v_agendado then v_quando end);
end;
$$;
revoke all on function public.crm_1a1_pago(uuid, int, text) from public, anon, authenticated;
grant execute on function public.crm_1a1_pago(uuid, int, text) to service_role;

-- ---------- 3. A pessoa pergunta se o áudio está liberado ----------
create or replace function public.meu_1a1() returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  v_ate timestamptz;
  v_min smallint;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    return jsonb_build_object('audio', false);
  end if;
  select audio_ate, minutos into v_ate, v_min from um_a_um_pagamentos where contato_id = v_c and audio_ate > now() order by audio_ate desc limit 1;
  return jsonb_build_object('audio', v_ate is not null, 'audio_ate', v_ate, 'minutos', v_min);
end;
$$;
revoke all on function public.meu_1a1() from public;
revoke all on function public.meu_1a1() from anon;
grant execute on function public.meu_1a1() to authenticated;
