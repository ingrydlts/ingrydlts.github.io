-- Por Dentro — CRM: o Y da linha "Hoje" do Estúdio de e-mails (quantos envios estão previstos até o fim de hoje)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- Rode primeiro no Supabase de TESTE e só depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e
-- db/conferir-banco.sql (os dois do repositório do app). Os dois vazios = pronto.
--
-- O que muda:
--   1. crm_sequencia_candidatos(): a consulta de "quem recebe agora cada modelo de sequência" (a de crm-sequencia-minutos.sql)
--      passa a morar num lugar só. Ela não é chamada por ninguém de fora: só pelas duas funções abaixo.
--   2. crm_sequencia_pendentes(): a mesma de antes (mesma assinatura, mesmas colunas, mesmo resultado), agora chamando o helper.
--      É o que o Worker usa para enviar. Continua só para a service_role.
--   3. crm_sequencia_previstos(chave, agora): quantas pessoas vão receber o modelo até 23:59 de hoje (Brasília), pelas mesmas
--      regras do envio: quem já acionou o gatilho, ainda não recebeu, tem consentimento, cumpre o "Para quem" e está na janela
--      de 2 dias. Só a administradora pergunta. Modelo manual (sem Envio), excluído ou de antes do estúdio: sem número (null).
--      Com o Envio desligado, responde "se você ligasse agora": ligar recomeça a contagem, então quem já passou da hora não entra.
--
-- Segurança: funções security definer com search_path fixo. O helper não tem EXECUTE para ninguém (nem service_role): quem o
-- chama é o dono, por dentro das outras duas. crm_sequencia_previstos: sem EXECUTE para public nem anon, e confere eh_admin().
-- Nenhuma tabela nova, nenhum dado de pessoa aqui.
--
-- Como desfazer: rode de novo crm-sequencia-minutos.sql (devolve a crm_sequencia_pendentes antiga) e depois
--   drop function if exists public.crm_sequencia_previstos(text, timestamptz);
--   drop function if exists public.crm_sequencia_candidatos(text, timestamptz, timestamptz, boolean);

-- ---------- 1. A consulta, num lugar só ----------
-- p_chave: um modelo (nulo = todos). p_agora: o "agora". p_ate: o teto do devido_em.
-- p_previa = false: só modelos com o Envio ligado (o que o Worker usa). true: qualquer modelo com gatilho, como se o Envio
-- estivesse ligado desde agora (o piso da janela é p_agora, porque ligar recomeça a contagem).
create or replace function public.crm_sequencia_candidatos(p_chave text, p_agora timestamptz, p_ate timestamptz, p_previa boolean)
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (
    select me.chave, me.tipo, me.para_quem, me.envio_gatilho, me.envio_depois_de, me.envio_dias, me.envio_hora, me.envio_minutos,
           me.envio_ligado_em, v.versao
      from modelos_email me
      left join modelos_email_versoes v on v.chave = me.chave and v.etapa = 'no_ar'
     where me.criado_no_estudio and me.envio_gatilho is not null and me.excluido_em is null
       and (p_previa or me.envio_ligado)
       and (p_chave is null or me.chave = p_chave)
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
                                                              'cfCidade', c.respostas -> 'cfCidade')),
           'prazo_limite', c.prazo_limite, 'dias_para_prazo', c.dias_para_prazo,
           'produto', m.para_quem ->> 'produto', 'produto_nome', m.para_quem ->> 'produto_nome'))
    from devido d
    join m on m.chave = d.chave
    join crm_contatos c on c.id = d.contato_id
   where d.devido_em <= p_ate
     and d.devido_em > greatest(p_agora - interval '2 days',
                                case when p_previa then coalesce(m.envio_ligado_em, p_agora) else m.envio_ligado_em end)
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
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = m.chave);
$$;
revoke all on function public.crm_sequencia_candidatos(text, timestamptz, timestamptz, boolean) from public, anon, authenticated, service_role;

-- ---------- 2. O que o Worker envia agora (a mesma função de antes, sobre o helper) ----------
create or replace function public.crm_sequencia_pendentes(p_limite int default 12, p_agora timestamptz default now())
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select k.contato_id, k.email, k.nome, k.chave, k.versao, k.tipo, k.aceita_novidades, k.devido_em, k.dados
    from public.crm_sequencia_candidatos(null, p_agora, p_agora, false) k
   where k.versao is not null
   order by k.devido_em, k.contato_id
   limit greatest(1, least(coalesce(p_limite, 12), 100));
$$;
revoke all on function public.crm_sequencia_pendentes(int, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pendentes(int, timestamptz) to service_role;

-- ---------- 3. O Y: quantos envios até o fim de hoje (Brasília) ----------
create or replace function public.crm_sequencia_previstos(p_chave text, p_agora timestamptz default now())
returns int
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_fim timestamptz;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if not exists (select 1 from modelos_email me
                  where me.chave = p_chave and me.criado_no_estudio and me.envio_gatilho is not null and me.excluido_em is null) then
    return null;
  end if;
  v_fim := ((date_trunc('day', p_agora at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo')
           - interval '1 microsecond';
  return (select count(*)::int from public.crm_sequencia_candidatos(p_chave, p_agora, v_fim, true));
end;
$$;
revoke all on function public.crm_sequencia_previstos(text, timestamptz) from public, anon;
grant execute on function public.crm_sequencia_previstos(text, timestamptz) to authenticated;
