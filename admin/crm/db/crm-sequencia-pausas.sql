-- A PAUSA QUANDO A PESSOA MARCA UM 1:1: os e-mails automáticos (sequências do Estúdio) esperam a sua decisão.
-- Rode no SQL Editor do Supabase, DEPOIS de crm-saude-porta-ponto.sql (a última versão de crm_sequencia_pendentes) e de crm-compras.sql.
-- Idempotente. Rode primeiro no TESTE, depois na produção. Depois: db/auditoria-isolamento.sql e db/conferir-banco.sql (os dois do app, vazios = pronto).
--
--   sequencia_pausas                  uma linha por 1:1 marcado de quem está numa sequência: a pergunta "os e-mails automáticos devem parar?".
--                                     decisao vazia = pergunta aberta (nada automático sai), 'parar' = nada mais sai, 'continuar' = segue.
--   crm_sequencia_pausa_abrir()       só o Worker (service_role), quando o Cal.com cria o 1:1. Só abre se a pessoa está numa sequência
--                                     (recebeu e-mail automático ou comprou nos últimos 60 dias) e ainda não foi parada. Devolve os dados do aviso.
--   crm_sequencia_pausa_decidir()     só o Worker (service_role), pelo link assinado do e-mail. A primeira decisão vale (um segundo clique não troca).
--   crm_sequencia_pausa_decidir_admin()  só a admin logada (a ficha). Pode trocar a decisão (ex.: retomar uma sequência parada).
--   crm_sequencia_pendentes()         igual à de crm-saude-porta-ponto.sql, com UMA regra a mais: não manda nada para quem tem pergunta aberta
--                                     ou decisão "parar". Sem resposta, a janela de 2 dias do motor descarta o e-mail segurado: o padrão é NÃO enviar.
--
-- Segurança: RLS só admin na tabela; nenhuma função executável por anon ou authenticated, exceto a da admin (que confere eh_admin()).
-- Nada de dado de pessoa além do vínculo com a ficha.
--
-- ATENÇÃO: este arquivo guarda a versão atual de crm_sequencia_pendentes. Se rodar de novo crm-saude-porta-ponto.sql (ou um anterior), rode este logo depois.
--
-- Como desfazer: rode de novo o trecho de crm_sequencia_pendentes de crm-saude-porta-ponto.sql e depois:
--   drop function if exists public.crm_sequencia_pausa_decidir_admin(bigint, text);
--   drop function if exists public.crm_sequencia_pausa_decidir(bigint, text);
--   drop function if exists public.crm_sequencia_pausa_abrir(bigint);
--   drop table if exists public.sequencia_pausas;

create table if not exists public.sequencia_pausas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  um_a_um_id bigint not null unique references public.um_a_um(id) on delete cascade,
  criada_em timestamptz not null default now(),
  decisao text check (decisao is null or decisao in ('parar', 'continuar')),
  decidida_em timestamptz
);
create index if not exists sequencia_pausas_contato_idx on public.sequencia_pausas (contato_id);

alter table public.sequencia_pausas enable row level security;
drop policy if exists "sequencia_pausas: só admin" on public.sequencia_pausas;
create policy "sequencia_pausas: só admin" on public.sequencia_pausas for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.sequencia_pausas from anon, authenticated;
grant select on public.sequencia_pausas to authenticated;   -- a RLS deixa só a admin ler; a decisão grava pela função
grant select, insert, update on public.sequencia_pausas to service_role;

-- Abre a pergunta para um 1:1 recém-marcado. Devolve { criada, pausa_id, contato_id, nome, email, quando }.
create or replace function public.crm_sequencia_pausa_abrir(p_um_a_um_id bigint) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_um public.um_a_um;
  v_contato public.contatos;
  v_id bigint;
begin
  select * into v_um from public.um_a_um where id = p_um_a_um_id and status = 'agendado';
  if v_um.id is null or v_um.contato_id is null then return jsonb_build_object('criada', false); end if;
  select * into v_contato from public.contatos where id = v_um.contato_id;
  if v_contato.id is null then return jsonb_build_object('criada', false); end if;
  -- já parada antes: não há o que perguntar
  if exists (select 1 from public.sequencia_pausas where contato_id = v_contato.id and decisao = 'parar') then
    return jsonb_build_object('criada', false, 'motivo', 'ja_parada');
  end if;
  -- só pergunta se ela está numa sequência: recebeu e-mail automático ou comprou nos últimos 60 dias
  if not (exists (select 1 from public.emails_enviados e where e.contato_id = v_contato.id and (e.sequencia or e.modelo = 'guia_compra') and e.enviado_em > now() - interval '60 days')
          or exists (select 1 from public.compras c where c.contato_id = v_contato.id and c.pago_em > now() - interval '60 days')) then
    return jsonb_build_object('criada', false, 'motivo', 'fora_de_sequencia');
  end if;
  insert into public.sequencia_pausas (contato_id, um_a_um_id) values (v_contato.id, v_um.id)
  on conflict (um_a_um_id) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('criada', false, 'motivo', 'ja_perguntada'); end if;
  return jsonb_build_object('criada', true, 'pausa_id', v_id, 'contato_id', v_contato.id, 'nome', v_contato.nome, 'email', v_contato.email, 'quando', v_um.quando);
end;
$$;
revoke all on function public.crm_sequencia_pausa_abrir(bigint) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pausa_abrir(bigint) to service_role;

-- A decisão pelo link assinado do e-mail (Worker). A primeira vale. Devolve { ok, decisao, ja_decidida }.
create or replace function public.crm_sequencia_pausa_decidir(p_id bigint, p_decisao text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v public.sequencia_pausas;
begin
  if p_decisao is null or p_decisao not in ('parar', 'continuar') then raise exception 'decisao_invalida'; end if;
  select * into v from public.sequencia_pausas where id = p_id;
  if v.id is null then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if v.decisao is not null then return jsonb_build_object('ok', true, 'decisao', v.decisao, 'ja_decidida', true); end if;
  update public.sequencia_pausas set decisao = p_decisao, decidida_em = now() where id = p_id;
  return jsonb_build_object('ok', true, 'decisao', p_decisao, 'ja_decidida', false);
end;
$$;
revoke all on function public.crm_sequencia_pausa_decidir(bigint, text) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pausa_decidir(bigint, text) to service_role;

-- A decisão pela ficha (admin logada). Pode trocar a decisão, ex.: retomar uma sequência parada.
create or replace function public.crm_sequencia_pausa_decidir_admin(p_id bigint, p_decisao text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_decisao is null or p_decisao not in ('parar', 'continuar') then raise exception 'decisao_invalida'; end if;
  update public.sequencia_pausas set decisao = p_decisao, decidida_em = now() where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  return jsonb_build_object('ok', true, 'decisao', p_decisao);
end;
$$;
revoke all on function public.crm_sequencia_pausa_decidir_admin(bigint, text) from public, anon;
grant execute on function public.crm_sequencia_pausa_decidir_admin(bigint, text) to authenticated;

-- Quem recebe agora cada modelo de sequência: a de crm-saude-porta-ponto.sql + a pausa por 1:1 marcado.
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
     -- Pausa por 1:1 marcado (crm-sequencia-pausas.sql): com a pergunta aberta ou com a decisão "parar", nada automático sai
     and not exists (select 1 from sequencia_pausas p where p.contato_id = c.id and (p.decisao is null or p.decisao = 'parar'))
     -- Ainda não recebeu este modelo
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = m.chave)
   order by d.devido_em, c.id
   limit greatest(1, least(coalesce(p_limite, 12), 100));
$$;
revoke all on function public.crm_sequencia_pendentes(int, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pendentes(int, timestamptz) to service_role;
