-- O FLUXO DOS AVISOS DA IASSISTENTE: uma fila com pausas, que você pode adiantar ou atrasar, e a rotina que entrega.
-- Rode DEPOIS de crm-caso.sql e crm-caso-importar.sql. Pode rodar de novo sem estragar nada.
--
-- A ideia: os avisos de uma pessoa formam uma fila (ordem). Cada um tem uma PAUSA, em dias, depois do aviso anterior.
-- O primeiro conta a pausa a partir do primeiro acesso dela ao app. Ninguém digita data: a data de cada aviso nasce do
-- anterior (dia da data do anterior + pausa, às 9h de Paris). Por isso:
--   • enviar agora a próxima mensagem faz o que vem depois andar para a frente do mesmo tanto (a pausa se mantém);
--   • atrasar (ou adiantar) um aviso muda a pausa dele e tudo o que vem depois acompanha;
--   • uma data fixa (crm_aviso_agendar com p_quando) vira um ponto de ancoragem: ele não se mexe, e o que vem depois conta dele.
--
--   1. caso_avisos ganha ordem e pausa_dias (e preenche os que já existem a partir de dias_apos).
--   2. caso_reencadear(contato) recalcula as datas da fila. É chamada por tudo que muda a fila.
--   3. crm_aviso_agendar passa a encadear (p_dias_apos agora é a PAUSA); crm_aviso_enviar_agora e crm_aviso_deslocar são novos.
--   4. caso_primeiro_acesso passa a encadear; crm_avisos_materializar passa a usar caso_aviso_liberar.
--   5. A entrega horária: pg_cron chama crm_avisos_materializar de hora em hora (se a extensão existir; senão avisa).

-- ---------- 1. Colunas ----------
alter table public.caso_avisos add column if not exists ordem smallint;
alter table public.caso_avisos add column if not exists pausa_dias smallint not null default 1 check (pausa_dias between 0 and 60);

-- Quem já existia: a ordem é a de criação e a pausa é a diferença entre os dias_apos vizinhos (o primeiro conta do primeiro acesso).
-- (Só nas linhas que ainda não têm ordem: rodar de novo não desfaz uma pausa que você mudou.)
update public.caso_avisos a set ordem = x.rn,
       pausa_dias = case when a.modo = 'apos_primeiro_acesso' then greatest(0, least(60, x.p)) else a.pausa_dias end
  from (select id, row_number() over (partition by contato_id order by id) as rn,
               dias_apos - coalesce(lag(dias_apos) over (partition by contato_id order by id), 0) as p
          from public.caso_avisos) x
 where a.id = x.id and a.ordem is null;

-- Aviso novo entra no fim da fila. Se não disseram a pausa, ela sai da diferença para o dias_apos do último.
create or replace function public.caso_aviso_ordem() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ord smallint;
  v_dias smallint;
begin
  select max(ordem), (array_agg(dias_apos order by ordem desc, id desc))[1] into v_ord, v_dias from caso_avisos where contato_id = new.contato_id;
  if new.ordem is null then new.ordem := coalesce(v_ord, 0) + 1; end if;
  if new.modo = 'apos_primeiro_acesso' then
    new.pausa_dias := greatest(0, least(60, new.dias_apos - coalesce(v_dias, 0)));
  end if;
  return new;
end;
$$;
revoke all on function public.caso_aviso_ordem() from public, anon, authenticated;
drop trigger if exists caso_avisos_ordem on public.caso_avisos;
create trigger caso_avisos_ordem before insert on public.caso_avisos for each row execute function public.caso_aviso_ordem();
create index if not exists caso_avisos_fila_idx on public.caso_avisos (contato_id, ordem);

-- ---------- 2. Recalcular a fila ----------
-- O que já saiu (liberado, lido, respondido, dispensado, ou o "Agora não" dela) não muda: só serve de âncora. O que está
-- agendado e ainda não saiu recebe a data nova. Rascunhos e cancelados ficam fora da fila.
create or replace function public.caso_reencadear(p_contato uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_anc timestamptz := null;
  v_novo timestamptz;
  v_primeiro boolean := true;
begin
  for r in
    select id, estado, modo, liberar_em, liberado_em, pausa_dias from caso_avisos
     where contato_id = p_contato and estado not in ('rascunho', 'cancelado')
     order by ordem, id for update
  loop
    if r.estado <> 'agendado' or r.liberado_em is not null then
      v_anc := coalesce(r.liberar_em, r.liberado_em, v_anc);
      v_primeiro := false;
      continue;
    end if;
    if r.modo = 'data' then
      v_novo := r.liberar_em;
    elsif v_primeiro then
      v_novo := public.caso_liberar_relativo(p_contato, r.pausa_dias);    -- vazio até ela entrar no app
    elsif v_anc is null then
      v_novo := null;                                                      -- o anterior ainda não tem data
    else
      v_novo := (((v_anc at time zone 'Europe/Paris')::date + r.pausa_dias) + time '09:00') at time zone 'Europe/Paris';
    end if;
    if v_novo is distinct from r.liberar_em then
      update caso_avisos set liberar_em = v_novo where id = r.id;
    end if;
    v_anc := v_novo;
    v_primeiro := false;
  end loop;
end;
$$;
revoke all on function public.caso_reencadear(uuid) from public, anon, authenticated;

-- ---------- 3. O que você faz ----------
-- Aprovar um aviso. Sem p_quando: entra na fila com a pausa p_dias_apos (a pausa DEPOIS DO AVISO ANTERIOR; no primeiro,
-- depois do primeiro acesso). Com p_quando: data fixa (ponto de ancoragem). Substitui a função de crm-caso.sql.
create or replace function public.crm_aviso_agendar(p_id bigint, p_quando timestamptz default null, p_dias_apos smallint default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a caso_avisos%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select * into a from caso_avisos where id = p_id for update;
  if not found then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.estado in ('respondido', 'dispensado', 'cancelado') then
    raise exception 'aviso_encerrado';
  end if;
  if p_dias_apos is not null and p_dias_apos not between 0 and 60 then
    raise exception 'pausa_invalida';
  end if;
  if p_quando is not null then
    update caso_avisos set modo = 'data', liberar_em = p_quando, estado = 'agendado', adiado_ate = null where id = p_id;
  else
    update caso_avisos set modo = 'apos_primeiro_acesso', pausa_dias = coalesce(p_dias_apos, a.pausa_dias), liberar_em = null,
           estado = 'agendado', adiado_ate = null
     where id = p_id;
  end if;
  perform public.caso_reencadear(a.contato_id);
end;
$$;
revoke all on function public.crm_aviso_agendar(bigint, timestamptz, smallint) from public;
revoke all on function public.crm_aviso_agendar(bigint, timestamptz, smallint) from anon;
grant execute on function public.crm_aviso_agendar(bigint, timestamptz, smallint) to authenticated;

-- Sai um aviso agora: acende o sininho e marca como liberado. Usada pela rotina e pelo "enviar agora".
create or replace function public.caso_aviso_liberar(p_id bigint) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a caso_avisos%rowtype;
begin
  select * into a from caso_avisos where id = p_id and estado = 'agendado' for update skip locked;
  if not found then
    return false;
  end if;
  update caso_avisos set estado = 'liberado', liberado_em = now() where id = a.id;
  insert into sinais (contato_id, mensagem) values (a.contato_id, left('Nova mensagem do assistente: ' || a.titulo, 500));
  return true;
end;
$$;
revoke all on function public.caso_aviso_liberar(bigint) from public, anon, authenticated;

-- Enviar agora a PRÓXIMA mensagem da fila (a primeira que ainda não saiu). O que vem depois anda junto: cada pausa se mantém.
create or replace function public.crm_aviso_enviar_agora(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a caso_avisos%rowtype;
  v_prox bigint;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select * into a from caso_avisos where id = p_id for update;
  if not found then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.estado = 'rascunho' then
    raise exception 'aprove_antes';
  end if;
  if a.estado <> 'agendado' or a.liberado_em is not null then
    raise exception 'aviso_ja_saiu';
  end if;
  if not public.caso_tem_consentimento(a.contato_id) then
    raise exception 'sem_consentimento';
  end if;
  select id into v_prox from caso_avisos
   where contato_id = a.contato_id and estado = 'agendado' and liberado_em is null order by ordem, id limit 1;
  if v_prox is distinct from a.id then
    raise exception 'nao_e_a_proxima';
  end if;
  update caso_avisos set modo = 'data', liberar_em = now() where id = a.id;
  perform public.caso_aviso_liberar(a.id);
  perform public.caso_reencadear(a.contato_id);
end;
$$;
revoke all on function public.crm_aviso_enviar_agora(bigint) from public;
revoke all on function public.crm_aviso_enviar_agora(bigint) from anon;
grant execute on function public.crm_aviso_enviar_agora(bigint) to authenticated;

-- Atrasar (dias positivos) ou adiantar (negativos) um aviso que ainda não saiu: a pausa dele muda e o resto da fila acompanha.
create or replace function public.crm_aviso_deslocar(p_id bigint, p_dias int) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a caso_avisos%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_dias is null or p_dias not between -60 and 60 or p_dias = 0 then
    raise exception 'dias_invalidos';
  end if;
  select * into a from caso_avisos where id = p_id for update;
  if not found then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.estado <> 'agendado' or a.liberado_em is not null then
    raise exception 'aviso_ja_saiu';
  end if;
  update caso_avisos set modo = 'apos_primeiro_acesso', pausa_dias = greatest(0, least(60, a.pausa_dias + p_dias)) where id = a.id;
  perform public.caso_reencadear(a.contato_id);
end;
$$;
revoke all on function public.crm_aviso_deslocar(bigint, int) from public;
revoke all on function public.crm_aviso_deslocar(bigint, int) from anon;
grant execute on function public.crm_aviso_deslocar(bigint, int) to authenticated;

-- ---------- 4. O app e a rotina ----------
-- O primeiro acesso agora recalcula a fila inteira (antes só dava data aos relativos soltos). Substitui a de crm-caso.sql.
create or replace function public.caso_primeiro_acesso() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  perform pg_advisory_xact_lock(hashtext('caso_primeiro_acesso:' || v_c::text));
  insert into eventos (contato_id, tipo)
  select v_c, 'caso_primeiro_acesso'
   where not exists (select 1 from eventos where contato_id = v_c and tipo = 'caso_primeiro_acesso');
  perform public.caso_reencadear(v_c);
end;
$$;
revoke all on function public.caso_primeiro_acesso() from public;
revoke all on function public.caso_primeiro_acesso() from anon;
grant execute on function public.caso_primeiro_acesso() to authenticated;

-- A rotina: entrega o que já chegou na hora. Só o servidor chama (a pg_cron abaixo). Substitui a de crm-caso.sql.
create or replace function public.crm_avisos_materializar() returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    select a.id from caso_avisos a
     where a.estado = 'agendado' and a.liberar_em is not null and a.liberar_em <= now()
       and (a.adiado_ate is null or a.adiado_ate <= now()) and (a.expira_em is null or a.expira_em > now())
     order by a.contato_id, a.ordem, a.id
  loop
    if public.caso_aviso_liberar(r.id) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.crm_avisos_materializar() from public, anon, authenticated;

-- ---------- 5. A entrega de hora em hora ----------
-- Supabase: ligue a extensão pg_cron (Database → Extensions) e rode este arquivo de novo. Sem ela, o arquivo só avisa:
-- sem a rotina, o aviso agendado fica esperando e o sininho não acende (o app ainda mostra o aviso no Espaço quando abrir).
do $cron$
begin
  if to_regnamespace('cron') is null and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'crm-caso-fluxo: não consegui ligar a pg_cron (%).', sqlerrm;
    end;
  end if;
  if to_regnamespace('cron') is null then
    raise notice 'crm-caso-fluxo: a pg_cron não está ligada. Ligue em Database → Extensions e rode este arquivo de novo, ou agende por fora: select public.crm_avisos_materializar();';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'crm-avisos-materializar') then
    perform cron.unschedule('crm-avisos-materializar');
  end if;
  perform cron.schedule('crm-avisos-materializar', '7 * * * *', 'select public.crm_avisos_materializar()');
end
$cron$;
