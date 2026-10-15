-- Por Dentro — CRM fase 1a: o e-mail 2 do guia (a conversa) e a página /conversa/
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase0-email-guia.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: não apaga nem altera dado existente.
--
-- O que muda:
--   1. respostas_email ganha a coluna canal: 'email' (padrão, tudo o que já existe), 'toque' (tocou num
--      botão de cidade do e-mail 2) ou 'pagina' (escreveu na caixa de texto da página /conversa/).
--   2. crm_conversa_pendentes(): quem deve receber o e-mail 2 hoje. Recebeu o cf_guia_1 antes de hoje
--      (fuso de Brasília), há no máximo 7 dias, aceita novidades e ainda não tem o cf_guia_conversa.
--      Quem chama é o Worker, uma vez por dia (Cron Trigger), com a service_role. O índice
--      emails_um_por_guia_idx (fase 0) já deixa só um cf_guia_conversa por pessoa.
--   3. crm_conversa_toque() e crm_conversa_texto(): o Worker grava o toque e o texto da página depois de
--      conferir o link assinado. A cidade vai para contatos.respostas.cfCidade (quem toca de novo fica
--      com a última). Toque e texto entram em respostas_email como "nova": aparecem na Caixa de entrada
--      e em "Precisa de você". Um toque repetido atualiza a linha nova que já existe (não duplica).
--   4. Linha do tempo: o evento email_respondido leva o canal (e a cidade, no toque).
--   5. crm_contatos: o motivo do "Precisa de você" diz se foi toque, página ou e-mail. Mesmas colunas.
--
-- Como desfazer:
--   drop function public.crm_conversa_pendentes(int); drop function public.crm_conversa_toque(uuid, text);
--   drop function public.crm_conversa_texto(uuid, text);
--   rodar de novo crm-fase0-email-guia.sql (volta o gatilho do evento e o motivo antigos);
--   alter table public.respostas_email drop column canal;   (só depois do passo acima: apaga o canal de tudo)
--   A cidade fica em contatos.respostas.cfCidade; para tirar: update contatos set respostas = respostas - 'cfCidade';
--   Atenção: com esta migração no ar, se rodar crm-fase0-email-guia.sql de novo, rode esta logo depois.

-- ---------- 1. Canal da resposta ----------
alter table public.respostas_email add column if not exists canal text not null default 'email';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'respostas_email_canal_check') then
    alter table public.respostas_email add constraint respostas_email_canal_check check (canal in ('email', 'toque', 'pagina'));
  end if;
end $$;
create index if not exists respostas_email_toque_idx on public.respostas_email (contato_id, canal, status);

-- ---------- 2. Quem recebe o e-mail 2 hoje ----------
create or replace function public.crm_conversa_pendentes(p_limite int default 15)
returns table (contato_id uuid, email text, nome text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id, c.email, c.nome
    from contatos c
    join emails_enviados e on e.contato_id = c.id and e.modelo = 'cf_guia_1' and e.status <> 'nao_entregue'
   where e.enviado_em is not null
     and (e.enviado_em at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date
     and e.enviado_em >= now() - interval '7 days'
     and coalesce((select cn.aceito from consentimentos cn where cn.contato_id = c.id and cn.finalidade = 'novidades_email'
                    order by cn.criado_em desc, cn.id desc limit 1), false)
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = 'cf_guia_conversa')
   order by e.enviado_em
   limit greatest(1, least(coalesce(p_limite, 15), 200));
$$;
revoke all on function public.crm_conversa_pendentes(int) from public, anon, authenticated;
grant execute on function public.crm_conversa_pendentes(int) to service_role;

-- ---------- 3. Toque e texto da página /conversa/ ----------
-- O Worker já conferiu o link assinado (contato + validade). Aqui só entram as cidades dos botões.
create or replace function public.crm_conversa_toque(p_contato uuid, p_cidade text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c record;
  v_rotulo text;
  v_email_id bigint;
  v_resp bigint;
begin
  v_rotulo := case p_cidade
    when 'paris' then 'Paris' when 'lyon' then 'Lyon' when 'toulouse' then 'Toulouse'
    when 'montpellier' then 'Montpellier' when 'bordeaux' then 'Bordeaux' when 'lille' then 'Lille'
    when 'outra' then 'Outra cidade' when 'nao-sei' then 'Ainda não sei' end;
  if v_rotulo is null then return jsonb_build_object('erro', 'cidade'); end if;
  select id, email, nome into v_c from contatos where id = p_contato;
  if v_c.id is null then return jsonb_build_object('erro', 'contato'); end if;

  update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('cfCidade', p_cidade)
   where id = p_contato;
  select id into v_email_id from emails_enviados where contato_id = p_contato and modelo = 'cf_guia_conversa'
   order by criado_em desc limit 1;

  -- Tocou de novo antes de você ver: troca a cidade na mesma linha nova (a linha do tempo mostra os dois toques).
  update respostas_email set texto = 'Cidade: ' || v_rotulo, recebido_em = now()
   where id = (select r.id from respostas_email r where r.contato_id = p_contato and r.canal = 'toque' and r.status = 'nova'
                order by r.recebido_em desc limit 1)
  returning id into v_resp;
  if v_resp is null then
    insert into respostas_email (contato_id, email_id, de_email, de_nome, texto, canal)
    values (p_contato, v_email_id, v_c.email, left(v_c.nome, 200), 'Cidade: ' || v_rotulo, 'toque')
    returning id into v_resp;
  else
    begin
      insert into eventos (contato_id, tipo, dados) values (p_contato, 'email_respondido',
        jsonb_strip_nulls(jsonb_build_object('resposta_id', v_resp, 'email_id', v_email_id, 'canal', 'toque', 'cidade', v_rotulo)));
    exception when others then
      raise warning 'crm_conversa_toque: %', sqlerrm;
    end;
  end if;
  return jsonb_build_object('ok', true, 'nome', v_c.nome, 'cidade', v_rotulo);
end;
$$;
revoke all on function public.crm_conversa_toque(uuid, text) from public, anon, authenticated;
grant execute on function public.crm_conversa_toque(uuid, text) to service_role;

create or replace function public.crm_conversa_texto(p_contato uuid, p_texto text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c record;
  v_txt text := btrim(coalesce(p_texto, ''));
begin
  if length(v_txt) < 2 or length(v_txt) > 2000 then return jsonb_build_object('erro', 'texto'); end if;
  select id, email, nome into v_c from contatos where id = p_contato;
  if v_c.id is null then return jsonb_build_object('erro', 'contato'); end if;
  -- Freio contra abuso de um link vazado: 10 textos por pessoa a cada 24h.
  if (select count(*) from respostas_email where contato_id = p_contato and canal = 'pagina'
        and recebido_em > now() - interval '24 hours') >= 10 then
    return jsonb_build_object('erro', 'limite');
  end if;
  insert into respostas_email (contato_id, email_id, de_email, de_nome, texto, canal)
  values (p_contato,
          (select id from emails_enviados where contato_id = p_contato and modelo = 'cf_guia_conversa' order by criado_em desc limit 1),
          v_c.email, left(v_c.nome, 200), v_txt, 'pagina');
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.crm_conversa_texto(uuid, text) from public, anon, authenticated;
grant execute on function public.crm_conversa_texto(uuid, text) to service_role;

-- ---------- 4. Linha do tempo: o evento leva o canal ----------
create or replace function public.crm_on_resposta_email() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.contato_id is not null then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'email_respondido', jsonb_strip_nulls(jsonb_build_object(
        'resposta_id', new.id, 'assunto', left(new.assunto, 120), 'email_id', new.email_id,
        'canal', nullif(new.canal, 'email'),
        'cidade', case when new.canal = 'toque' then nullif(regexp_replace(new.texto, '^Cidade: ', ''), '') end)));
    end if;
  exception when others then
    raise warning 'crm_on_resposta_email: %', sqlerrm;
  end;
  return new;
end;
$$;

-- ---------- 5. A visão que o painel lê (igual à da fase 0; só o motivo da resposta muda) ----------
create or replace view public.crm_contatos with (security_invoker = true) as
select
  c.id, c.email, c.nome, c.persona, c.caminho as subpersona, c.fase, c.nivel_estudos,
  c.preocupacao, c.origem, c.respostas, c.estagio, c.score, c.user_id, c.nota,
  c.criado_em, c.atualizado_em, c.ultimo_evento_em,
  u.urgencia,
  case
    when ra.id is not null and ra.canal = 'toque' then 'respondeu o e-mail 2 com um toque (' || lower(regexp_replace(ra.texto, '^Cidade: ', '')) || ') em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when ra.id is not null and ra.canal = 'pagina' then 'escreveu na página da conversa em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when ra.id is not null then 'respondeu o seu e-mail em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
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
  c.personas,
  ra.id as resposta_aberta_id
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
  -- os e-mails dos guias (cf_guia_*) não são o do link de acesso: ficam fora do reimpacto
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id and e.modelo not like 'cf\_guia\_%' order by e.criado_em desc, e.id desc limit 1
) le on true
left join lateral (
  select r.id, r.recebido_em, r.canal, r.texto from respostas_email r
   where r.contato_id = c.id and r.status = 'nova' order by r.recebido_em limit 1
) ra on true;

revoke all on public.crm_contatos from anon;
