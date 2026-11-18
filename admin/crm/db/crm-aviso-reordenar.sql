-- Por Dentro — Perguntas da equipe: arrastar para mudar a ordem em que os avisos saem.
-- Rodar DEPOIS de crm-caso-fluxo.sql. PRIMEIRO no Supabase de TESTE, depois no de produção.
-- Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app). Idempotente.
--
--   crm_aviso_reordenar(p_contato, p_ids)   admin: p_ids é a nova ordem dos avisos que AINDA NÃO SAÍRAM (rascunho ou agendado sem liberação).
--     * Os avisos que já saíram (liberado, lido, respondido...) e os cancelados não mudam de lugar.
--     * Os avisos listados trocam de posição só entre as vagas que eles mesmos já ocupavam: a fila do que já saiu fica intacta.
--     * Depois recalcula as datas da fila (caso_reencadear), porque cada pausa conta a partir do aviso anterior.
--     * Erros: sem_permissao, ordem_invalida (repetido, vazio ou de outra pessoa), aviso_ja_saiu (algum já saiu ou foi encerrado).
--     * Não mexe em nenhuma tabela nova: só em caso_avisos.ordem.

create or replace function public.crm_aviso_reordenar(p_contato uuid, p_ids bigint[]) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int := coalesce(array_length(p_ids, 1), 0);
  v_vagas smallint[];
  v_i int;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if v_n = 0 or v_n <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'ordem_invalida';
  end if;
  -- trava e confere: todos são desta pessoa e ainda não saíram
  if (select count(*) from public.caso_avisos where id = any (p_ids) and contato_id = p_contato) <> v_n then
    raise exception 'ordem_invalida';
  end if;
  perform 1 from public.caso_avisos where id = any (p_ids) order by id for update;
  if exists (select 1 from public.caso_avisos where id = any (p_ids) and (liberado_em is not null or estado not in ('rascunho', 'agendado'))) then
    raise exception 'aviso_ja_saiu';
  end if;
  -- as vagas que esses avisos ocupam hoje, na ordem; eles passam a ocupá-las na ordem pedida
  select array_agg(ordem order by ordem, id) into v_vagas from public.caso_avisos where id = any (p_ids);
  for v_i in 1 .. v_n loop
    update public.caso_avisos set ordem = v_vagas[v_i] where id = p_ids[v_i];
  end loop;
  perform public.caso_reencadear(p_contato);
end;
$$;
revoke all on function public.crm_aviso_reordenar(uuid, bigint[]) from public;
revoke all on function public.crm_aviso_reordenar(uuid, bigint[]) from anon;
grant execute on function public.crm_aviso_reordenar(uuid, bigint[]) to authenticated;
