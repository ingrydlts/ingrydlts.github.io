-- O PAGAMENTO SABE QUAL 1:1 PAGOU: liga um_a_um_pagamentos a um_a_um.
-- Rode DEPOIS de crm-1a1.sql (e de crm-fase2.sql, que cria um_a_um). Pode rodar de novo sem estragar nada.
--
--   1. um_a_um_pagamentos.um_a_um_id   a conversa que este pagamento pagou (opcional: um pagamento pode chegar antes de existir 1:1 marcado).
--      A chave é COMPOSTA (um_a_um_id, contato_id): o banco recusa ligar o pagamento de uma pessoa ao 1:1 de outra. Se o 1:1 for apagado,
--      o pagamento fica (só perde o vínculo); se o contato for apagado, tudo vai junto, como já era.
--   2. um índice único: uma conversa só tem um pagamento.
--   3. crm_1a1_pago()   passa a ligar o pagamento novo à primeira conversa marcada daquele contato que ainda não foi paga (mesma assinatura,
--      mesmos privilégios: só o Worker chama).
--   4. Os pagamentos que já existem são ligados uma vez, na ordem em que foram feitos, ao 1:1 mais próximo da data do pagamento.
--
-- Não cria tabela nem função nova.

-- ---------- 1. A chave ----------
alter table public.um_a_um drop constraint if exists um_a_um_id_contato_key cascade;   -- cascade: a chave composta de baixo é recriada logo em seguida
alter table public.um_a_um add constraint um_a_um_id_contato_key unique (id, contato_id);
alter table public.um_a_um_pagamentos add column if not exists um_a_um_id bigint;
alter table public.um_a_um_pagamentos drop constraint if exists um_a_um_pagamentos_um_a_um_fk;
alter table public.um_a_um_pagamentos add constraint um_a_um_pagamentos_um_a_um_fk
  foreign key (um_a_um_id, contato_id) references public.um_a_um (id, contato_id) on delete set null (um_a_um_id);

-- ---------- 2. Uma conversa, um pagamento ----------
create unique index if not exists um_a_um_pagamentos_um_a_um_uniq on public.um_a_um_pagamentos (um_a_um_id) where um_a_um_id is not null;

-- ---------- 3. O pagamento novo já nasce ligado ----------
create or replace function public.crm_1a1_pago(p_contato uuid, p_minutos int, p_sessao text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pag um_a_um_pagamentos%rowtype;
  v_aviso bigint;
  v_quando timestamptz;
  v_agendado boolean := false;
  v_um bigint;
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
  -- Qual conversa foi paga: a primeira do contato que ainda não tem pagamento (marcada antes de cancelada ou feita; com data antes de "a combinar").
  -- Sem nenhuma, fica sem vínculo e a Ingryd liga na mão depois.
  select u.id into v_um from um_a_um u
   where u.contato_id = p_contato and u.status = 'agendado'
     and not exists (select 1 from um_a_um_pagamentos g where g.um_a_um_id = u.id)
   order by u.quando nulls last, u.id limit 1;
  insert into um_a_um_pagamentos (contato_id, minutos, sessao, audio_ate, um_a_um_id)
  values (p_contato, p_minutos, p_sessao, now() + interval '30 days', v_um)
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

-- ---------- 4. Os pagamentos de antes ----------
do $$
declare
  g record;
  v_um bigint;
begin
  for g in select id, contato_id, pago_em from public.um_a_um_pagamentos where um_a_um_id is null order by pago_em, id loop
    select u.id into v_um from public.um_a_um u
     where u.contato_id = g.contato_id and u.status <> 'cancelado'
       and not exists (select 1 from public.um_a_um_pagamentos x where x.um_a_um_id = u.id)
     order by abs(extract(epoch from (coalesce(u.quando, u.criado_em) - g.pago_em))), u.id limit 1;
    if v_um is not null then update public.um_a_um_pagamentos set um_a_um_id = v_um where id = g.id; end if;
  end loop;
end $$;
