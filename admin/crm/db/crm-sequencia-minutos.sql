-- Por Dentro — CRM: Envio "N minutos depois" nas sequências do estúdio (o e-mail de recap, 30 min depois do cadastro)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-filtro-etapa.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: uma coluna, uma regra um pouco mais larga e as duas funções de sempre, com a mesma segurança.
-- Nenhum modelo de hoje muda de comportamento: quem não usa "minutos" sai no mesmo dia e hora de antes.
--
-- O que muda:
--   1. modelos_email.envio_minutos (1 a 1440). Com ele preenchido, o modelo sai N minutos depois da data-base de cada pessoa
--      (o cadastro no material, o primeiro envio do e-mail anterior ou a compra), e não em "dia + horário de Brasília".
--      Com ele vazio, tudo funciona como antes (dias + hora).
--   2. A regra modelos_email_envio_check passa a aceitar "Envio ligado" com minutos no lugar de dias + hora.
--   3. modelos_email_envio_confere() trata mudar os minutos como mudar o Envio (recomeça a contagem a partir de agora).
--   4. crm_sequencia_pendentes() entende os minutos. O resto da função é igual ao de crm-filtro-etapa.sql.
--
-- Para a pessoa receber perto dos N minutos, o Worker precisa rodar mais vezes que de hora em hora: ver o Cron Trigger
-- "*/5 * * * *" em cms-oauth-worker/README.md, seção 23. Com "5 * * * *" (de hora em hora) o e-mail sai na próxima rodada.
--
-- Segurança: nenhuma tabela nem função nova. A função crm_sequencia_pendentes continua security definer, com search_path fixo,
-- sem EXECUTE para public, anon e authenticated (só service_role, o Worker). Nenhum dado de pessoa aqui.
--
-- Como desfazer (modelos que usam minutos precisam voltar para dias e hora ANTES, senão a regra antiga os reprova):
--   update public.modelos_email set envio_minutos = null, envio_ligado = false where envio_minutos is not null;
--   e rode de novo crm-estudio-emails-3.sql (regra e gatilho antigos) e depois crm-filtro-etapa.sql (a função antiga).
--   alter table public.modelos_email drop column if exists envio_minutos;

alter table public.modelos_email add column if not exists envio_minutos int;

-- A regra do Envio, agora com os minutos.
alter table public.modelos_email drop constraint if exists modelos_email_envio_check;
alter table public.modelos_email add constraint modelos_email_envio_check check (
  (envio_gatilho is null or envio_gatilho in ('email', 'material', 'compra'))
  and (envio_depois_de is null or envio_depois_de ~ '^[a-z0-9][a-z0-9_-]{0,79}$')
  and (envio_dias is null or envio_dias between 0 and 120)
  and (envio_hora is null or envio_hora between 0 and 23)
  and (envio_minutos is null or envio_minutos between 1 and 1440)
  and (not envio_ligado or (envio_gatilho is not null and envio_depois_de is not null
        and (envio_minutos is not null or (envio_dias is not null and envio_hora is not null)))));

-- O gatilho de sempre (crm-estudio-emails-3.sql), mudando só a lista do "mudou".
create or replace function public.modelos_email_envio_confere() returns trigger
language plpgsql set search_path = public as $$
declare mudou boolean;
begin
  if tg_op = 'UPDATE' and new.criado_no_estudio is distinct from old.criado_no_estudio then
    raise exception 'Um modelo não muda de origem (criado no estúdio ou não).';
  end if;
  if new.excluido_em is not null and new.chave like 'cf\_guia\_%' then
    raise exception 'Os e-mails do guia Campus France saem pelo código: excluir aqui não pararia o envio.';
  end if;
  if new.excluido_em is not null then new.envio_ligado := false; end if;
  if not new.criado_no_estudio then
    if new.envio_gatilho is not null or new.envio_ligado or new.envio_minutos is not null or new.para_quem <> '{}'::jsonb or new.objetivo_chave is not null then
      raise exception 'O modelo % é um dos 10 de antes do estúdio: quem recebe e quando continuam no código. Crie um modelo novo para ter Envio.', new.chave;
    end if;
    return new;
  end if;
  new.automatico := new.envio_gatilho is not null;
  if new.envio_gatilho = 'email' and new.envio_depois_de is not null then
    if new.envio_depois_de = new.chave then raise exception 'Um modelo não pode sair depois dele mesmo.'; end if;
    if not exists (select 1 from modelos_email where chave = new.envio_depois_de) then
      raise exception 'O e-mail % não existe.', new.envio_depois_de;
    end if;
  end if;
  if new.envio_gatilho = 'compra' and new.envio_depois_de is not null and new.envio_depois_de is distinct from new.para_quem ->> 'produto' then
    raise exception 'Na sequência de compra, o produto do Envio é o mesmo de "Para quem".';
  end if;
  mudou := tg_op = 'INSERT' or new.envio_ligado is distinct from old.envio_ligado
    or new.envio_gatilho is distinct from old.envio_gatilho or new.envio_depois_de is distinct from old.envio_depois_de
    or new.envio_dias is distinct from old.envio_dias or new.envio_hora is distinct from old.envio_hora
    or new.envio_minutos is distinct from old.envio_minutos
    or new.para_quem is distinct from old.para_quem;
  if not new.envio_ligado then new.envio_ligado_em := null;
  elsif mudou then new.envio_ligado_em := now();
  end if;
  return new;
end $$;
drop trigger if exists modelos_email_envio_confere on public.modelos_email;
create trigger modelos_email_envio_confere before insert or update on public.modelos_email
  for each row execute function public.modelos_email_envio_confere();

-- Quem recebe agora cada modelo de sequência (a de crm-filtro-etapa.sql + os minutos).
-- Com envio_minutos: devido = data-base + N minutos (sem esperar "dia + horário"). Sem: o dia e a hora de Brasília, como antes.
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
