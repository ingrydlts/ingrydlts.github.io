-- PAINEL DE MANUTENÇÃO DO CATÁLOGO: por percurso (persona), o que a IA propõe, o que você rejeita ou edita (e por quê) e quanto tempo ela
-- leva para dar o primeiro passo depois de aceitar o convite. Serve para decidir o que mexer no modelo daquele percurso: edição que se
-- repete no mesmo motivo vira UMA mudança no catálogo (content/ do app, blocos.js, perguntas permitidas); exceção de uma pessoa fica só no
-- plano dela. Rode DEPOIS de crm-montagem.sql, crm-montagem-aplicar.sql e crm-entrar.sql. Pode rodar de novo. Só admin.
--   itens_propostos         encaminhamentos, itens de checklist, documentos, perguntas e contatos propostos pela IA (as pendências de
--                           compromisso não entram: são contadas à parte em compromissos_ausentes)
--   itens_rejeitados/editados  decisões suas em crm_montagem_aplicar (eventos montagem_item_rejeitado / montagem_item_editado)
--   compromissos_ausentes   o que foi prometido na chamada e nenhum item cobria (o que a revisão resgatou como pendência)
--   motivos                 contagem por motivo: fato_errado, regra_inadequada, prazo_desatualizado, excecao
--   dias_ate_primeira_acao  média de dias entre aceitar o convite e concluir o primeiro passo (nulo se ninguém chegou lá)
-- Evento sem montagem_id (ou de montagem sem persona) conta na persona da primeira leitura daquela pessoa.

create or replace function public.crm_montagem_metricas() returns table (
  persona text, montagens int, itens_propostos int, itens_rejeitados int, itens_editados int, taxa_rejeicao numeric,
  compromissos_ausentes int, motivos jsonb, dias_ate_primeira_acao numeric)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  return query
  with m as (
    select coalesce(x.persona, 'sem_persona') as persona, x.id, x.contato_id,
           (select count(*) from jsonb_array_elements(coalesce(x.proposta->'encaminhamentos', '[]'::jsonb)))
         + (select count(*) from jsonb_array_elements(coalesce(x.proposta->'checklists', '[]'::jsonb)) c, jsonb_array_elements(coalesce(c->'itens', '[]'::jsonb)))
         + (select count(*) from jsonb_array_elements(coalesce(x.proposta->'documentos', '[]'::jsonb)))
         + (select count(*) from jsonb_array_elements(coalesce(x.proposta->'perguntas_equipe', '[]'::jsonb)))
         + (select count(*) from jsonb_array_elements(coalesce(x.proposta->'blocos', '[]'::jsonb)) b, jsonb_array_elements(coalesce(b->'itens', '[]'::jsonb))) as propostos,
           jsonb_array_length(coalesce(x.proposta->'omissoes', '[]'::jsonb)) as ausentes
      from montagens x
  ),
  primeira as (select distinct on (contato_id) contato_id, persona from m order by contato_id, id),
  ev as (
    select coalesce(mi.persona, p.persona) as persona, e.tipo, e.dados->>'motivo' as motivo
      from eventos e
      left join m mi on mi.id = nullif(e.dados->>'montagem_id', '')::bigint
      left join primeira p on p.contato_id = e.contato_id
     where e.tipo in ('montagem_item_rejeitado', 'montagem_item_editado') and coalesce(mi.persona, p.persona) is not null
  ),
  mot as (select ev.persona, ev.motivo, count(*)::int as n from ev where ev.motivo is not null group by ev.persona, ev.motivo),
  tempo as (
    select p.persona, avg(extract(epoch from (a.depois - a.aceite)) / 86400.0) as dias
      from (select e.contato_id, min(e.criado_em) as aceite,
                   (select min(e2.criado_em) from eventos e2 where e2.contato_id = e.contato_id and e2.tipo in ('caso_acao_concluida', 'checklist_marcado') and e2.criado_em >= min(e.criado_em)) as depois
              from eventos e where e.tipo = 'convite_aceito' group by e.contato_id) a
      join primeira p on p.contato_id = a.contato_id
     where a.depois is not null
     group by p.persona
  )
  select m.persona, count(*)::int, coalesce(sum(m.propostos), 0)::int,
         (select count(*) from ev where ev.persona = m.persona and ev.tipo = 'montagem_item_rejeitado')::int,
         (select count(*) from ev where ev.persona = m.persona and ev.tipo = 'montagem_item_editado')::int,
         round(coalesce((select count(*) from ev where ev.persona = m.persona and ev.tipo = 'montagem_item_rejeitado'), 0)::numeric / nullif(sum(m.propostos), 0), 2),
         coalesce(sum(m.ausentes), 0)::int,
         coalesce((select jsonb_object_agg(mot.motivo, mot.n) from mot where mot.persona = m.persona), '{}'::jsonb),
         (select round(t.dias::numeric, 1) from tempo t where t.persona = m.persona)
    from m group by m.persona order by m.persona;
end;
$$;
revoke all on function public.crm_montagem_metricas() from public;
revoke all on function public.crm_montagem_metricas() from anon;
grant execute on function public.crm_montagem_metricas() to authenticated;
