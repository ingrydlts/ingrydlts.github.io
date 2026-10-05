-- ============================================================================
-- CRM, entrega 3c do Circuito: agregados para o cérebro (hub), sem pessoa
-- ============================================================================
-- Rodar no SQL Editor do Supabase DEPOIS de crm-fase3-cerebro.sql (usa a mesma chave
-- revogável, `cerebro_chaves`). Idempotente. Plano: instagram-hub/docs/circuito/ENTREGA-3.md.
--
-- agregados_para_cerebro(chave, dias) devolve SÓ contagens:
--   * por_estagio:           contatos criados na janela, por etapa do funil;
--   * por_origem:            de onde vieram (slug do artigo, ponto fixo...), com a etapa de cada um;
--   * perguntas_por_origem:  perguntas únicas por artigo de origem.
-- Origem com menos de 3 pessoas (e pergunta de origem com menos de 3) vira "(outros)": o hub nunca
-- vê uma linha que aponte para uma ou duas pessoas. Nenhum e-mail, nome, id ou data de pessoa sai daqui.
--
-- A atribuição só existe onde `contatos.origem` guarda o slug do artigo (o formulário da pergunta
-- grava; o funil guarda o `origem` que veio no link). Contato sem origem aparece como "(sem origem)".
-- ============================================================================

create or replace function public.agregados_para_cerebro(p_chave text, p_dias int default 90) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dias int;
  v_ini timestamptz;
  v_total int;
  v_estagios jsonb;
  v_origens jsonb;
  v_perguntas jsonb;
begin
  if not public.crm_cerebro_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;
  v_dias := least(greatest(coalesce(p_dias, 90), 7), 365);
  v_ini := now() - make_interval(days => v_dias);

  select count(*)::int into v_total from contatos where criado_em >= v_ini;
  select coalesce(jsonb_object_agg(estagio, n), '{}'::jsonb) into v_estagios
    from (select estagio, count(*)::int n from contatos where criado_em >= v_ini group by estagio) e;

  with c as (
    select coalesce(nullif(origem, ''), '(sem origem)') as origem, estagio, count(*)::int n
      from contatos where criado_em >= v_ini group by 1, 2),
  t as (select origem, sum(n) total from c group by origem),
  g as (
    select case when t.total >= 3 or t.origem = '(sem origem)' then c.origem else '(outros)' end as origem, c.estagio, sum(c.n)::int n
      from c join t using (origem) group by 1, 2),
  o as (select origem, sum(n)::int total, jsonb_object_agg(estagio, n) por_estagio from g group by origem)
  select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'total', total, 'por_estagio', por_estagio) order by total desc, origem), '[]'::jsonb)
    into v_origens from o;

  with p as (
    select coalesce(nullif(origem, ''), '(sem origem)') as origem, count(*)::int n
      from perguntas_unicas where criado_em >= v_ini group by 1),
  q as (select case when n >= 3 or origem = '(sem origem)' then origem else '(outros)' end as origem, sum(n)::int n from p group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'perguntas', n) order by n desc, origem), '[]'::jsonb)
    into v_perguntas from q;

  return jsonb_build_object('janela_dias', v_dias, 'gerado_em', current_date, 'total_contatos', v_total,
    'por_estagio', v_estagios, 'por_origem', v_origens, 'perguntas_por_origem', v_perguntas);
end;
$$;

revoke all on function public.agregados_para_cerebro(text, int) from public;
grant execute on function public.agregados_para_cerebro(text, int) to anon, authenticated;
