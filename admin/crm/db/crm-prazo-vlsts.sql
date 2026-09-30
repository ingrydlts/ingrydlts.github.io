-- Por Dentro — CRM, extensão: data de entrada na França e prazo do VLS-TS
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase1.sql, crm-fase1b-minha-ficha.sql e
-- crm-fase2.sql. Idempotente (pode rodar de novo). Não apaga nem altera dado existente.
--
-- O que muda:
--   1. contatos.data_entrada (date, opcional) — preenchida pela calculadora do guia
--      gratuito do VLS-TS (/guias/vls-ts-validacao-travou/), via capturar_lead.
--   2. capturar_lead aceita payload.data_entrada ('AAAA-MM-DD'), valida (data real, até
--      400 dias pra trás/frente), guarda, e registra o evento 'data_entrada_informada'.
--      Payload sem data continua funcionando exatamente como antes.
--   3. crm_contatos ganha data_entrada, prazo_limite e dias_para_prazo (no FIM da visão)
--      e a urgência/motivo passam a considerar o prazo:
--        alta   vence em até 30 dias, ou venceu há até 90 dias
--        média  vence entre 31 e 60 dias
--      O painel (/admin/crm/) ordena por prazo dentro de cada urgência.
--
-- Como desfazer (se precisar): rode de novo crm-fase1.sql (devolve a função antiga) e o
-- trecho "A visão que o painel lê" de crm-fase2.sql (devolve a visão antiga). A coluna
-- data_entrada pode ficar; não atrapalha.

alter table public.contatos add column if not exists data_entrada date;
create index if not exists contatos_data_entrada_idx on public.contatos (data_entrada) where data_entrada is not null;

-- ---------- capturar_lead (mesma função da fase 1 + data_entrada) ----------
create or replace function public.capturar_lead(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_nome text;
  v_persona text;
  v_fase text;
  v_nivel text;
  v_worry text;
  v_origem text;
  v_resp jsonb;
  v_versao text;
  v_texto_servico text;
  v_texto_novidades text;
  v_aceita_novidades boolean;
  v_id uuid;
  v_novo boolean;
  v_ultimo boolean;
  v_entrada date;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload_invalido';
  end if;

  v_email := lower(trim(coalesce(payload->>'email', '')));
  if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalido';
  end if;
  if coalesce(payload->>'aceita_servico', '') <> 'true' then
    raise exception 'consentimento_obrigatorio';
  end if;

  v_nome := nullif(left(trim(coalesce(payload->>'nome', '')), 100), '');
  v_persona := crm_token(payload->>'persona');
  v_persona := case when v_persona = any (array['au_pair_estudante', 'campus_france', 'alternancia_emprego', 'conjuge', 'pvt']) then v_persona end;
  v_fase := crm_token(payload->>'fase');
  v_fase := case when v_fase = any (array['planejando', 'adaptando', 'urgente']) then v_fase end;
  v_nivel := crm_token(payload->>'nivel_estudos');
  v_nivel := case when v_nivel = any (array['ensino_medio', 'superior_incompleto', 'superior_completo', 'pos_graduacao']) then v_nivel end;
  v_worry := crm_token(payload->>'preocupacao');
  v_worry := case when v_worry = any (array['prazo', 'comeco', 'sozinha', 'caro']) then v_worry end;
  v_origem := crm_token(payload->>'origem');

  -- Data de entrada na França (guia do VLS-TS): só vale AAAA-MM-DD de verdade e dentro de
  -- 400 dias pra trás ou pra frente de hoje. Qualquer outra coisa (data impossível como
  -- 2026-02-31, texto, futuro distante) vira null e NÃO derruba o lead.
  begin
    if coalesce(payload->>'data_entrada', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      v_entrada := (payload->>'data_entrada')::date;
      if v_entrada < current_date - 400 or v_entrada > current_date + 400 then v_entrada := null; end if;
    end if;
  exception when others then
    v_entrada := null;
  end;

  v_resp := jsonb_strip_nulls(jsonb_build_object(
    -- Entrada direta do checklist-preview (sem o bot): onde está, visto e objetivo.
    'naFranca',      crm_token(payload#>>'{respostas,naFranca}'),
    'visto',         crm_token(payload#>>'{respostas,visto}'),
    'objetivo',      crm_token(payload#>>'{respostas,objetivo}'),
    'apAno',        crm_token(payload#>>'{respostas,apAno}'),
    'apPretende',    crm_token(payload#>>'{respostas,apPretende}'),
    'apDataFinal',   crm_token(payload#>>'{respostas,apDataFinal}'),
    'apCertificado', crm_token(payload#>>'{respostas,apCertificado}'),
    'apRecursos',    crm_token(payload#>>'{respostas,apRecursos}'),
    'apSponsor',     crm_token(payload#>>'{respostas,apSponsor}')
  ));

  v_versao := nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), '');
  v_texto_servico := nullif(left(coalesce(payload->>'texto_servico', ''), 600), '');
  v_texto_novidades := nullif(left(coalesce(payload->>'texto_novidades', ''), 600), '');
  v_aceita_novidades := coalesce(payload->>'aceita_novidades', '') = 'true';

  -- Pessoa nova vira linha; pessoa que volta (refez o quiz) só atualiza o que veio.
  -- A origem da primeira vez é preservada, e o estágio nunca retrocede.
  insert into contatos as c (email, nome, persona, fase, nivel_estudos, preocupacao, origem, respostas, data_entrada)
  values (v_email, v_nome, v_persona, v_fase, v_nivel, v_worry, v_origem, v_resp, v_entrada)
  on conflict (email) do update set
    nome = coalesce(excluded.nome, c.nome),
    persona = coalesce(excluded.persona, c.persona),
    fase = coalesce(excluded.fase, c.fase),
    nivel_estudos = coalesce(excluded.nivel_estudos, c.nivel_estudos),
    preocupacao = coalesce(excluded.preocupacao, c.preocupacao),
    respostas = c.respostas || excluded.respostas,
    -- a data mais recente informada vence (a pessoa pode ter corrigido); sem data nova, mantém a antiga
    data_entrada = coalesce(excluded.data_entrada, c.data_entrada)
  returning c.id, (c.xmax = 0) into v_id, v_novo;

  insert into eventos (contato_id, tipo, dados) values
    (v_id, case when v_novo then 'email_capturado' else 'email_recapturado' end,
      jsonb_strip_nulls(jsonb_build_object('origem', v_origem))),
    (v_id, 'quiz_respondido',
      jsonb_strip_nulls(jsonb_build_object('persona', v_persona, 'fase', v_fase,
        'nivel_estudos', v_nivel, 'preocupacao', v_worry)) || v_resp);

  if v_entrada is not null then
    insert into eventos (contato_id, tipo, dados) values
      (v_id, 'data_entrada_informada', jsonb_build_object(
        'data_entrada', v_entrada,
        'prazo_limite', ((v_entrada + interval '3 months')::date - 1),
        'origem', v_origem));
  end if;

  -- Consentimento do serviço: registrado uma vez (o aceite é condição pra chegar aqui).
  if not exists (select 1 from consentimentos where contato_id = v_id and finalidade = 'servico') then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'servico', true, v_versao, v_texto_servico, v_origem);
  end if;

  -- Novidades por e-mail: registra o "sim" ou o "não" da primeira vez. Depois disso, só
  -- um "sim" novo muda o estado — quem já aceitou e volta com a caixa desmarcada (é o
  -- padrão) NÃO perde o aceite por isso. Retirar é pelo link de descadastro.
  select aceito into v_ultimo from consentimentos
   where contato_id = v_id and finalidade = 'novidades_email'
   order by criado_em desc, id desc limit 1;
  if not found or (v_aceita_novidades and not v_ultimo) then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'novidades_email', v_aceita_novidades, v_versao, v_texto_novidades, v_origem);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.capturar_lead(jsonb) from public;
grant execute on function public.capturar_lead(jsonb) to anon, authenticated;

-- ---------- A visão que o painel lê (mesma da fase 2 + prazo do VLS-TS) ----------
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
  pz.dias_para_prazo
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
