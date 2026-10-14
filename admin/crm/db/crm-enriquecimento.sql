-- Por Dentro — CRM: a ficha da pessoa passa a ser ENRIQUECIDA a cada vez que ela deixa o e-mail
-- Rode no SQL Editor do Supabase, DEPOIS de crm-origem-campanha.sql e guias-link-privado.sql.
-- Idempotente (pode rodar de novo). Não apaga nem altera dado existente e NÃO muda a capturar_lead.
--
-- Problema: a primeira origem vence e o resto ficava só na linha do tempo. Quem pegava o guia do
-- VLS-TS e depois o do Campus France aparecia como "VLS-TS" para sempre, e o e-mail sugerido
-- saía errado. Agora a ficha guarda o resumo da jornada:
--   capturas           quantas vezes deixou o e-mail (em qualquer guia ou funil)
--   origens            todas as origens por onde passou, na ordem da 1ª vez (text[])
--   ultima_origem      de onde veio na vez mais recente
--   ultima_captura_em  quando foi a vez mais recente
--   personas           todas as personas que já escolheu, na ordem (a coluna persona segue
--                      sendo a mais recente)
-- Quem mantém isso em dia é um gatilho em `eventos` (capturar_lead já grava email_capturado /
-- email_recapturado / quiz_respondido). Ele nunca derruba a captura: erro vira aviso no log.
-- A view crm_contatos ganha as colunas novas no fim e um motivo novo: "voltou a deixar o
-- e-mail" (2+ capturas, a última nos últimos 7 dias), que faz a pessoa aparecer em
-- "Precisa de você" no Hoje.
--
-- Como desfazer: drop trigger crm_eventos_enriquecer on eventos; drop function public.crm_enriquecer_contato();
-- alter table contatos drop column capturas, drop column origens, drop column ultima_origem,
-- drop column ultima_captura_em, drop column personas; e rodar crm-origem-campanha.sql de novo (a view).

alter table contatos add column if not exists capturas int not null default 0;
alter table contatos add column if not exists origens text[] not null default '{}';
alter table contatos add column if not exists ultima_origem text;
alter table contatos add column if not exists ultima_captura_em timestamptz;
alter table contatos add column if not exists personas text[] not null default '{}';

-- ---------- Preenche o passado a partir da linha do tempo ----------
with caps as (
  select contato_id, nullif(dados->>'origem', '') as origem, criado_em
    from eventos where tipo in ('email_capturado', 'email_recapturado')
), resumo as (
  select contato_id, count(*) as n, max(criado_em) as ultima,
         (array_agg(origem order by criado_em desc) filter (where origem is not null))[1] as ultima_origem
    from caps group by contato_id
), primeira as (
  select contato_id, origem, min(criado_em) as quando from caps where origem is not null group by contato_id, origem
)
update contatos t set
  capturas = r.n,
  ultima_captura_em = r.ultima,
  ultima_origem = r.ultima_origem,
  origens = coalesce((select array_agg(p.origem order by p.quando) from primeira p where p.contato_id = t.id), '{}')
from resumo r
where r.contato_id = t.id and t.capturas = 0;

with pers as (
  select contato_id, nullif(dados->>'persona', '') as persona, min(criado_em) as quando
    from eventos where tipo = 'quiz_respondido' group by contato_id, nullif(dados->>'persona', '')
)
update contatos t set personas = coalesce((select array_agg(p.persona order by p.quando) from pers p
                                             where p.contato_id = t.id and p.persona is not null), '{}')
where t.personas = '{}';

-- contato sem evento de captura (ex.: criado pelo login direto): usa a origem e a persona da ficha
update contatos set origens = array[origem] where origens = '{}' and origem is not null;
update contatos set ultima_origem = origem where ultima_origem is null and origem is not null;
update contatos set personas = array[persona] where personas = '{}' and persona is not null;

-- ---------- O gatilho: cada captura nova atualiza o resumo ----------
create or replace function public.crm_enriquecer_contato() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_o text;
  v_p text;
begin
  begin
    if new.tipo in ('email_capturado', 'email_recapturado') then
      v_o := nullif(new.dados->>'origem', '');
      update contatos set
        capturas = capturas + 1,
        ultima_captura_em = new.criado_em,
        ultima_origem = coalesce(v_o, ultima_origem),
        origens = case when v_o is null or v_o = any (origens) then origens else origens || v_o end
      where id = new.contato_id;
    elsif new.tipo = 'quiz_respondido' then
      v_p := nullif(new.dados->>'persona', '');
      if v_p is not null then
        update contatos set personas = personas || v_p
        where id = new.contato_id and not (v_p = any (personas));
      end if;
    end if;
  exception when others then
    raise warning 'crm_enriquecer_contato: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists crm_eventos_enriquecer on eventos;
create trigger crm_eventos_enriquecer after insert on eventos
  for each row execute function public.crm_enriquecer_contato();

-- ---------- A visão que o painel lê (mesma da crm-origem-campanha + resumo da jornada) ----------
create or replace view public.crm_contatos with (security_invoker = true) as
select
  c.id, c.email, c.nome, c.persona, c.caminho as subpersona, c.fase, c.nivel_estudos,
  c.preocupacao, c.origem, c.respostas, c.estagio, c.score, c.user_id, c.nota,
  c.criado_em, c.atualizado_em, c.ultimo_evento_em,
  u.urgencia,
  case
    when pz.dias_para_prazo between 1 and 60 then 'prazo do VLS-TS vence em ' || pz.dias_para_prazo || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo = 0 then 'prazo do VLS-TS vence hoje (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo between -90 and -1 then 'prazo do VLS-TS venceu há ' || (-pz.dias_para_prazo) || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when c.capturas >= 2 and c.ultima_captura_em > now() - interval '7 days'
      then 'voltou a deixar o e-mail em ' || to_char(c.ultima_captura_em at time zone 'Europe/Paris', 'DD/MM')
           || coalesce(' (' || c.ultima_origem || ')', '')
    when c.fase = 'urgente' then 'marcou urgência no funil'
    when c.fase = 'adaptando' and c.preocupacao = 'prazo' then 'já está na França e a preocupação é prazo'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parada há ' || d.dias || ' dias'
    when c.caminho = 'indefinido' then 'escolheu "Não sei ainda" no caminho'
  end as motivo,
  d.dias,
  (select p.id from perguntas_unicas p where p.contato_id = c.id and p.status = 'nova'
     order by p.criado_em limit 1) as pergunta_aberta_id,
  (select o.quando from um_a_um o where o.contato_id = c.id and o.status = 'agendado'
     order by o.quando nulls last limit 1) as um_a_um_quando,
  le.status as email_status,
  le.enviado_em as email_enviado_em,
  case
    when le.id is null or c.estagio in ('concluido', 'um_a_um') then null
    when le.status in ('agendado', 'nao_entregue') then null
    when c.estagio = 'lead' and le.status = 'entregue' and now() - le.enviado_em >= interval '3 days' then 'naoabriu'
    when c.estagio = 'lead' and le.status = 'aberto' and now() - le.enviado_em >= interval '3 days' then 'naoclicou'
    when c.estagio = 'lead' and le.status = 'clicado' then 'cliquenaoapp'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parouapp'
  end as segmento,
  coalesce((select cn.aceito from consentimentos cn where cn.contato_id = c.id and cn.finalidade = 'novidades_email'
              order by cn.criado_em desc, cn.id desc limit 1), false) as aceita_novidades,
  -- colunas novas SEMPRE no fim (create or replace view não deixa reordenar as antigas)
  c.data_entrada,
  pz.prazo_limite,
  pz.dias_para_prazo,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.utm_content,
  c.ig_id,
  c.instagram,
  c.capturas,
  c.origens,
  c.ultima_origem,
  c.ultima_captura_em,
  c.personas
from contatos c
cross join lateral (
  select greatest(0, floor(extract(epoch from now() - coalesce(c.ultimo_evento_em, c.criado_em)) / 86400))::int as dias
) d
cross join lateral (
  -- Prazo do VLS-TS: entrada + 3 meses − 1 dia (mesma conta da calculadora do guia).
  -- dias_para_prazo negativo = já venceu.
  select
    case when c.data_entrada is not null then ((c.data_entrada + interval '3 months')::date - 1) end as prazo_limite,
    case when c.data_entrada is not null then (((c.data_entrada + interval '3 months')::date - 1) - current_date) end as dias_para_prazo
) pz
cross join lateral (
  -- Faixas do prazo (ajuste aqui): alta = vence em até 30 dias ou venceu há até 90;
  -- média = vence entre 31 e 60 dias. Passou disso (venceu há 90+ dias) não conta como prazo.
  select case
    when c.fase = 'urgente' or (c.fase = 'adaptando' and c.preocupacao = 'prazo')
      or pz.dias_para_prazo between -90 and 30 then 'alta'
    when c.fase = 'adaptando' or pz.dias_para_prazo between 31 and 60 then 'media'
    else 'baixa'
  end as urgencia
) u
left join lateral (
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id order by e.criado_em desc, e.id desc limit 1
) le on true;

revoke all on public.crm_contatos from anon;
