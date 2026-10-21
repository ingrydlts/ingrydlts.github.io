-- Por Dentro — CRM: filtro por etapa do guia nos modelos novos (destrava o aquecimento)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql e de crm-modelos-prontos.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: uma regra nova no "Para quem" e a regra das trilhas nos 12 e-mails do aquecimento.
--
-- O que muda:
--   1. O "Para quem" dos modelos criados no estúdio ganha a regra etapas: a lista das etapas que a pessoa marcou no guia
--      (contatos.respostas.objetivo: 'cf-nao-comecei', 'cf-escolhendo-curso', 'cf-juntando-documentos', 'cf-dossie-enviado',
--      'cf-entrevista-resposta' no guia Campus France; 'alt-…' no guia alternância 30+). Lista vazia = sem regra.
--      Com a regra, quem não marcou nenhuma etapa não recebe.
--   2. crm_sequencia_pendentes() respeita a regra (o resto da função é igual ao de crm-estudio-emails-3.sql).
--   3. Os 12 rascunhos do aquecimento ganham a regra da trilha, só se ainda não tiverem uma (o que você mudou no estúdio fica):
--        trilha A (aq_a_*): ainda não começou, escolhendo o curso
--        trilha B (aq_b_*): juntando documentos, traduções e o teste
--        trilha C (aq_c_*): já enviou o dossiê, esperando a entrevista ou a resposta
--      Assim cada pessoa recebe só a trilha da etapa que marcou. Nada é publicado nem ligado aqui.
--
-- Segurança: só regras dos modelos. Nenhum dado de pessoa. A lista continua só para a service_role (o Worker).
--
-- Como desfazer (sem a regra em nenhum modelo, a função se comporta como antes; para voltar o texto dela também,
-- rode de novo a parte 4 de crm-estudio-emails-3.sql):
--   update public.modelos_email set para_quem = para_quem - 'etapas' where para_quem ? 'etapas';

-- ---------- 1. Quem recebe agora cada modelo de sequência (com a regra da etapa) ----------
create or replace function public.crm_sequencia_pendentes(p_limite int default 12, p_agora timestamptz default now())
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (
    select me.chave, me.tipo, me.para_quem, me.envio_gatilho, me.envio_depois_de, me.envio_dias, me.envio_hora,
           me.envio_ligado_em, v.versao
      from modelos_email me
      join modelos_email_versoes v on v.chave = me.chave and v.etapa = 'no_ar'
     where me.criado_no_estudio and me.envio_ligado and me.envio_gatilho is not null and me.excluido_em is null
  ),
  base as (
    select m.chave, e.contato_id, min(e.enviado_em) as quando
      from m join emails_enviados e on m.envio_gatilho = 'email' and e.modelo = m.envio_depois_de
     where e.enviado_em is not null and e.status <> 'nao_entregue'
     group by m.chave, e.contato_id
    union all
    select m.chave, ev.contato_id, min(ev.criado_em)
      from m join eventos ev
        on (m.envio_gatilho = 'material' and ev.tipo in ('email_capturado', 'email_recapturado') and ev.dados ->> 'origem' = m.envio_depois_de)
        or (m.envio_gatilho = 'compra' and ev.tipo = 'compra' and ev.dados ->> 'produto' = m.envio_depois_de)
     group by m.chave, ev.contato_id
  ),
  hora as (
    select b.chave, b.contato_id, b.quando,
           ((((b.quando at time zone 'America/Sao_Paulo')::date + m.envio_dias) + make_interval(hours => m.envio_hora))
             at time zone 'America/Sao_Paulo') as h
      from base b join m on m.chave = b.chave
  ),
  devido as (
    select chave, contato_id, case when h < quando then h + interval '1 day' else h end as devido_em from hora
  )
  select c.id, c.email, c.nome, m.chave, m.versao, m.tipo, c.aceita_novidades, d.devido_em,
         jsonb_strip_nulls(jsonb_build_object(
           'persona', c.persona,
           'respostas', jsonb_strip_nulls(jsonb_build_object('cfNivel', c.respostas -> 'cfNivel', 'objetivo', c.respostas -> 'objetivo',
                                                              'cfCidade', c.respostas -> 'cfCidade')),
           'prazo_limite', c.prazo_limite, 'dias_para_prazo', c.dias_para_prazo,
           'produto', m.para_quem ->> 'produto', 'produto_nome', m.para_quem ->> 'produto_nome'))
    from devido d
    join m on m.chave = d.chave
    join crm_contatos c on c.id = d.contato_id
   where d.devido_em <= p_agora
     and d.devido_em > greatest(p_agora - interval '2 days', m.envio_ligado_em)
     -- Consentimento: novidades só para quem aceitou (o mais recente). Serviço e compra são o que ela pediu ou comprou.
     and (m.tipo <> 'novidades' or c.aceita_novidades)
     -- Para quem
     and (cardinality(crm_lista(m.para_quem, 'personas')) = 0
          or c.persona = any (crm_lista(m.para_quem, 'personas')) or c.personas && crm_lista(m.para_quem, 'personas'))
     and (cardinality(crm_lista(m.para_quem, 'materiais')) = 0 or c.origens && crm_lista(m.para_quem, 'materiais'))
     and (coalesce(m.para_quem ->> 'produto', '') = ''
          or exists (select 1 from eventos x where x.contato_id = c.id and x.tipo = 'compra' and x.dados ->> 'produto' = m.para_quem ->> 'produto'))
     and (cardinality(crm_lista(m.para_quem, 'segmentos')) = 0 or c.segmento = any (crm_lista(m.para_quem, 'segmentos')))
     and (cardinality(crm_lista(m.para_quem, 'estagios')) = 0 or c.estagio = any (crm_lista(m.para_quem, 'estagios')))
     -- A etapa que ela marcou no guia (sem etapa marcada, a regra não deixa passar)
     and (cardinality(crm_lista(m.para_quem, 'etapas')) = 0 or (c.respostas ->> 'objetivo') = any (crm_lista(m.para_quem, 'etapas')))
     -- Ainda não recebeu este modelo
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = m.chave)
   order by d.devido_em, c.id
   limit greatest(1, least(coalesce(p_limite, 12), 100));
$$;
revoke all on function public.crm_sequencia_pendentes(int, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pendentes(int, timestamptz) to service_role;

-- ---------- 2. A trilha de cada e-mail do aquecimento ----------
-- Só nos modelos do aquecimento criados no estúdio e que ainda não têm a regra de etapa.
update public.modelos_email me
   set para_quem = me.para_quem || jsonb_build_object('etapas', t.etapas)
  from (values
    ('a', '["cf-nao-comecei", "cf-escolhendo-curso"]'::jsonb),
    ('b', '["cf-juntando-documentos"]'::jsonb),
    ('c', '["cf-dossie-enviado", "cf-entrevista-resposta"]'::jsonb)
  ) as t(trilha, etapas)
 where me.chave in ('aq_' || t.trilha || '_d3', 'aq_' || t.trilha || '_d6', 'aq_' || t.trilha || '_d10', 'aq_' || t.trilha || '_d15')
   and me.criado_no_estudio and me.objetivo_chave = 'aquecimento'
   and not (me.para_quem ? 'etapas');
