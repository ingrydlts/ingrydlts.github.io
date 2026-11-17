-- Por Dentro — guia "Mapa da saúde na França": a porta e o ponto da saúde chegam ao e-mail (17/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (create or replace). Rode primeiro no TESTE, depois na produção.
--
-- O que muda (as duas funções abaixo são cópias das atuais, com um acréscimo cada; sem tabela nova, sem coluna nova):
--   1. capturar_lead_guia grava respostas.porta e respostas.ponto em contatos, mas só se o valor estiver nas listas fixas
--      (porta: estudante, trabalho, aupair, outro · ponto: nao_cheguei, sem_numero, esperando, sem_vitale, completo). Valor fora da lista é ignorado.
--   2. crm_sequencia_pendentes entrega porta e ponto ao Worker (respostas.porta e respostas.ponto), que monta a persona do e-mail.
--
-- Segurança: as permissões não mudam. capturar_lead_guia continua security definer com search_path fixo e liberada ao site público
-- (já está em anon_pode); crm_sequencia_pendentes continua só para o service_role. Nada devolve ficha pelo e-mail do token.
-- Depois de rodar, no teste e na produção: rode db/auditoria-isolamento.sql e db/conferir-banco.sql (os dois do app). Os dois vazios = pronto.
--
-- Como desfazer: rode de novo o trecho de capturar_lead_guia de crm-fase0-email-guia.sql e o de crm_sequencia_pendentes de crm-sequencia-minutos.sql.

create or replace function public.capturar_lead_guia(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
  v_link record;
  v_guia text;
  v_id uuid;
  v_cfnivel text;
  v_porta text;
  v_ponto text;
begin
  -- Mesmo cadastro de sempre; se falhar, o erro sobe e nada de link nem de e-mail.
  v_res := public.capturar_lead(payload);
  v_guia := left(coalesce(payload->>'guia', ''), 80);
  select id into v_id from contatos where email = lower(trim(coalesce(payload->>'email', '')));

  -- Nível da candidatura Campus France (só as 6 chaves conhecidas; o resto é ignorado).
  v_cfnivel := crm_token(payload#>>'{respostas,cfNivel}');
  if v_id is not null and v_cfnivel = any (array['l1', 'arq', 'l2l3', 'lpro', 'master', 'escola']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('cfNivel', v_cfnivel)
     where id = v_id;
    -- o quiz_respondido desta mesma chamada passa a mostrar o nível na linha do tempo
    update eventos set dados = dados || jsonb_build_object('cfNivel', v_cfnivel)
     where contato_id = v_id and tipo = 'quiz_respondido' and criado_em = now();
  end if;

  -- Guia "Mapa da saúde" (S2): a porta e o ponto da saúde viram a persona porta.ponto. Só os valores das listas fixas; o resto é ignorado.
  v_porta := crm_token(payload#>>'{respostas,porta}');
  v_ponto := crm_token(payload#>>'{respostas,ponto}');
  if v_id is not null and v_porta = any (array['estudante', 'trabalho', 'aupair', 'outro']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('porta', v_porta) where id = v_id;
  end if;
  if v_id is not null and v_ponto = any (array['nao_cheguei', 'sem_numero', 'esperando', 'sem_vitale', 'completo']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('ponto', v_ponto) where id = v_id;
  end if;

  select notion_url, notion_texto into v_link from guias_links where slug = v_guia;

  perform public.crm_guia_email_pedir(v_id, v_guia);

  return v_res || jsonb_strip_nulls(jsonb_build_object(
    'notion_url', v_link.notion_url,
    'notion_texto', v_link.notion_texto));
end;
$$;
revoke all on function public.capturar_lead_guia(jsonb) from public;
grant execute on function public.capturar_lead_guia(jsonb) to anon, authenticated;

create or replace function public.crm_sequencia_pendentes(p_limite int default 12, p_agora timestamptz default now())
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (
    select me.chave, me.tipo, me.para_quem, me.envio_gatilho, me.envio_depois_de, me.envio_dias, me.envio_hora, me.envio_minutos,
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
    select b.chave, b.contato_id, b.quando, m.envio_minutos,
           ((((b.quando at time zone 'America/Sao_Paulo')::date + m.envio_dias) + make_interval(hours => m.envio_hora))
             at time zone 'America/Sao_Paulo') as h
      from base b join m on m.chave = b.chave
  ),
  devido as (
    select chave, contato_id,
           case when envio_minutos is not null then quando + make_interval(mins => envio_minutos)
                when h < quando then h + interval '1 day'
                else h end as devido_em
      from hora
  )
  select c.id, c.email, c.nome, m.chave, m.versao, m.tipo, c.aceita_novidades, d.devido_em,
         jsonb_strip_nulls(jsonb_build_object(
           'persona', c.persona,
           'respostas', jsonb_strip_nulls(jsonb_build_object('cfNivel', c.respostas -> 'cfNivel', 'objetivo', c.respostas -> 'objetivo',
                                                              'cfCidade', c.respostas -> 'cfCidade',
                                                              'porta', c.respostas -> 'porta', 'ponto', c.respostas -> 'ponto')),
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
