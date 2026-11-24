-- A RESERVA DO CAL.COM ENTRA NA AGENDA: cria, remarca e cancela a conversa em um_a_um sem digitar nada.
--
--   1. um_a_um.cal_uid        o id da reserva no Cal.com (único): reenviar o mesmo aviso não duplica a conversa.
--   2. crm_cal_reserva()      só o Worker (service_role) chama, quando o Cal.com avisa (POST /api/cal/webhook). Faz uma de três coisas:
--        criada     abre a conversa (agendado, com data e hora). Se a pessoa já tinha uma conversa "a combinar" sem reserva, adota ela.
--        remarcada  o Cal.com cria uma reserva nova e manda o id da antiga: a mesma conversa muda de data e de id.
--        cancelada  a conversa passa a cancelado (uma conversa já feita não volta atrás).
--      Depois de criar, liga o pagamento mais antigo da pessoa que ainda não paga nenhuma conversa (o pagamento do Cal.com chega
--      antes da reserva, no mesmo instante: ver crmStripeCal no Worker).
--
-- Depende de: crm-fase2.sql (um_a_um) e crm-1a1.sql + crm-1a1-vinculo.sql (um_a_um_pagamentos.um_a_um_id).
-- Como desfazer: drop function public.crm_cal_reserva(uuid, text, text, timestamptz, text);
--                drop index if exists public.um_a_um_cal_uid_uniq; alter table public.um_a_um drop column if exists cal_uid;

alter table public.um_a_um add column if not exists cal_uid text;
alter table public.um_a_um drop constraint if exists um_a_um_cal_uid_len;
alter table public.um_a_um add constraint um_a_um_cal_uid_len check (cal_uid is null or length(cal_uid) between 1 and 200);
create unique index if not exists um_a_um_cal_uid_uniq on public.um_a_um (cal_uid) where cal_uid is not null;

create or replace function public.crm_cal_reserva(
  p_contato uuid, p_uid text, p_evento text, p_quando timestamptz, p_uid_anterior text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_um bigint;
  v_status text;
  v_pag bigint;
begin
  if p_uid is null or length(p_uid) not between 1 and 200 or p_evento not in ('criada', 'remarcada', 'cancelada') then
    raise exception 'reserva_invalida';
  end if;
  if p_uid_anterior is not null and length(p_uid_anterior) not between 1 and 200 then
    raise exception 'reserva_invalida';
  end if;
  if p_evento <> 'cancelada' and p_quando is null then
    raise exception 'reserva_invalida';
  end if;
  if not exists (select 1 from contatos where id = p_contato) then
    raise exception 'contato_nao_encontrado';
  end if;

  if p_evento = 'cancelada' then
    update um_a_um set status = 'cancelado'
     where cal_uid = p_uid and contato_id = p_contato and status = 'agendado'
     returning id into v_um;
    return jsonb_build_object('ok', true, 'acao', case when v_um is null then 'nada' else 'cancelada' end, 'um_a_um_id', v_um);
  end if;

  -- A mesma reserva de novo (reenvio do Cal.com): atualiza a data e pronto.
  select id, status into v_um, v_status from um_a_um where cal_uid = p_uid and contato_id = p_contato;
  if found then
    if v_status = 'cancelado' then
      update um_a_um set status = 'agendado', quando = p_quando where id = v_um;
    elsif v_status = 'agendado' then
      update um_a_um set quando = p_quando where id = v_um;
    end if;
    return jsonb_build_object('ok', true, 'acao', 'atualizada', 'um_a_um_id', v_um);
  end if;

  -- Remarcação: a conversa da reserva antiga é a mesma, com data e id novos.
  if p_uid_anterior is not null then
    update um_a_um set cal_uid = p_uid, quando = p_quando, status = 'agendado'
     where cal_uid = p_uid_anterior and contato_id = p_contato and status in ('agendado', 'cancelado')
     returning id into v_um;
    if v_um is not null then
      return jsonb_build_object('ok', true, 'acao', 'remarcada', 'um_a_um_id', v_um);
    end if;
  end if;

  -- Conversa "a combinar" que a Ingryd criou à mão para esta pessoa: a reserva dá data a ela, em vez de abrir uma segunda.
  select id into v_um from um_a_um
   where contato_id = p_contato and status = 'agendado' and cal_uid is null and quando is null
   order by id limit 1;
  if v_um is not null then
    update um_a_um set cal_uid = p_uid, quando = p_quando where id = v_um;
  else
    insert into um_a_um (contato_id, quando, status, cal_uid, nota)
    values (p_contato, p_quando, 'agendado', p_uid, 'Reserva do Cal.com')
    returning id into v_um;
  end if;

  -- O pagamento que chegou antes da reserva: liga ao primeiro pagamento da pessoa que ainda não paga nenhuma conversa.
  if not exists (select 1 from um_a_um_pagamentos where um_a_um_id = v_um) then
    select id into v_pag from um_a_um_pagamentos
     where contato_id = p_contato and um_a_um_id is null
     order by pago_em, id limit 1;
    if v_pag is not null then update um_a_um_pagamentos set um_a_um_id = v_um where id = v_pag; end if;
  end if;
  return jsonb_build_object('ok', true, 'acao', 'criada', 'um_a_um_id', v_um);
end;
$$;
revoke all on function public.crm_cal_reserva(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.crm_cal_reserva(uuid, text, text, timestamptz, text) to service_role;
