-- CRITÉRIOS POR PERSONA: as perguntas "Sim ou Não" de uma escola mudam de uma persona para outra (quem está no PVT e quer voltar com um DU
-- pergunta outras coisas do que quem sai do au pair ou quem se candidata pelo Campus France). A lista de perguntas de cada persona mora no
-- app (assets/js/caso.js, CRITERIOS_POR_PERSONA); o banco só confere que a chave é de um formato seguro, para a lista poder mudar sem SQL novo.
-- Rode DEPOIS de crm-caso.sql. Pode rodar de novo sem estragar nada. Substitui salvar_dados_dela() de crm-caso.sql.
--
-- Chave de critério: minúsculas, números e "_", começando por letra, até 24 caracteres. Valor: "sim", "nao" ou nulo (desmarcar). No máximo 12 critérios por escola.

create or replace function public.salvar_dados_dela(p_item bigint, p_patch jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  b board_itens%rowtype;
  v_dela jsonb;
  v_crit jsonb;
  k text;
  v jsonb;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  select * into b from board_itens where id = p_item and contato_id = v_c and estado = 'publicado' for update;
  if not found then
    raise exception 'item_nao_encontrado';
  end if;
  if b.tipo not in ('escola', 'documento') then
    raise exception 'item_nao_editavel';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or not public.caso_board_chaves_ok(b.tipo, p_patch, true) then
    raise exception 'chave_invalida';
  end if;

  if p_patch ? 'meses' then
    if jsonb_typeof(p_patch->'meses') <> 'number' or (p_patch->>'meses')::numeric <> trunc((p_patch->>'meses')::numeric)
       or (p_patch->>'meses')::numeric not between 1 and 24 then
      raise exception 'valor_invalido';
    end if;
  end if;
  if p_patch ? 'custo_eur' then
    if jsonb_typeof(p_patch->'custo_eur') not in ('number', 'null') then raise exception 'valor_invalido'; end if;
    if jsonb_typeof(p_patch->'custo_eur') = 'number' and (p_patch->>'custo_eur')::numeric not between 0 and 100000 then
      raise exception 'valor_invalido';
    end if;
  end if;
  if p_patch ? 'reunido' and jsonb_typeof(p_patch->'reunido') <> 'boolean' then
    raise exception 'valor_invalido';
  end if;
  if p_patch ? 'criterios' then
    if jsonb_typeof(p_patch->'criterios') <> 'object' then raise exception 'valor_invalido'; end if;
    for k, v in select * from jsonb_each(p_patch->'criterios') loop
      if k !~ '^[a-z][a-z0-9_]{0,23}$' then raise exception 'valor_invalido'; end if;
      if jsonb_typeof(v) not in ('string', 'null') or (jsonb_typeof(v) = 'string' and (v #>> '{}') <> all (array['sim', 'nao'])) then
        raise exception 'valor_invalido';
      end if;
    end loop;
  end if;

  v_dela := coalesce(b.dados_dela, '{}'::jsonb) || (p_patch - 'criterios');
  if p_patch ? 'criterios' then
    v_crit := coalesce(b.dados_dela->'criterios', '{}'::jsonb) || (p_patch->'criterios');
    -- nulo continua guardado como "ainda não sei" (igual ao comportamento anterior)
    if (select count(*) from jsonb_object_keys(v_crit)) > 12 then raise exception 'valor_invalido'; end if;
    v_dela := jsonb_set(v_dela, '{criterios}', v_crit);
  end if;
  update board_itens set dados_dela = v_dela where id = b.id;
end;
$$;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from public;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from anon;
grant execute on function public.salvar_dados_dela(bigint, jsonb) to authenticated;
