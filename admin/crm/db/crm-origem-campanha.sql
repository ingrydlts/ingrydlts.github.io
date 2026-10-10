-- Por Dentro — CRM, extensão: de onde veio cada lead (UTM) e ID do contato na automação
-- Rode no SQL Editor do Supabase, DEPOIS de crm-prazo-vlsts.sql. Idempotente (pode rodar de novo).
-- Não apaga nem altera dado existente: só acrescenta colunas.
--
-- O que muda:
--   1. contatos ganha utm_source, utm_medium, utm_campaign, utm_content, ig_id e instagram (todas
--      opcionais). ig_id é o ID opaco do contato na ferramenta de automação; `instagram` é o @ (sem
--      o arroba), preenchido à mão na ficha do painel ou, se um dia o formulário pedir, pelo cadastro.
--   2. capturar_lead aceita payload.utm_source / utm_medium / utm_campaign / utm_content / ig /
--      instagram. Cada nova entrada só COMPLETA o que está vazio: nunca apaga nem sobrescreve o que
--      já existe (inclusive o que você digitou na ficha). Payload sem isso funciona como antes.
--   3. O evento 'email_capturado' leva utm_source, utm_campaign e utm_content em `dados`.
--   4. crm_contatos expõe as colunas novas (no FIM da visão).
--
-- Como desfazer: rode de novo crm-prazo-vlsts.sql (devolve função e visão antigas). As colunas
-- podem ficar; não atrapalham.

alter table public.contatos
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists ig_id text,
  add column if not exists instagram text;
create index if not exists contatos_utm_campaign_idx on public.contatos (utm_campaign) where utm_campaign is not null;
create index if not exists contatos_ig_id_idx on public.contatos (ig_id) where ig_id is not null;

-- ---------- capturar_lead (mesma da prazo-vlsts + UTM e ig) ----------
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
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_utm_content text;
  v_ig text;
  v_instagram text;
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

  -- De onde veio o clique (UTM do link) e, se a automação mandou, o ID do contato na ferramenta
  -- (campo `ig`; NÃO é o @). Tudo opcional: payload sem isso continua funcionando como antes.
  v_utm_source   := nullif(left(crm_token(payload->>'utm_source'), 60), '');
  v_utm_medium   := nullif(left(crm_token(payload->>'utm_medium'), 60), '');
  v_utm_campaign := nullif(left(crm_token(payload->>'utm_campaign'), 80), '');
  v_utm_content  := nullif(left(crm_token(payload->>'utm_content'), 80), '');
  v_ig           := nullif(left(crm_token(payload->>'ig'), 60), '');
  -- @ do Instagram: tira o arroba e o endereço, minúsculas, só letras/números/ponto/sublinhado (até 30).
  v_instagram    := lower(regexp_replace(trim(coalesce(payload->>'instagram', '')), '^(https?://)?(www\.)?instagram\.com/|^@|/$', '', 'gi'));
  if v_instagram !~ '^[a-z0-9._]{1,30}$' then v_instagram := null; end if;

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
  insert into contatos as c (email, nome, persona, fase, nivel_estudos, preocupacao, origem, respostas, data_entrada,
                             utm_source, utm_medium, utm_campaign, utm_content, ig_id, instagram)
  values (v_email, v_nome, v_persona, v_fase, v_nivel, v_worry, v_origem, v_resp, v_entrada,
          v_utm_source, v_utm_medium, v_utm_campaign, v_utm_content, v_ig, v_instagram)
  on conflict (email) do update set
    nome = coalesce(excluded.nome, c.nome),
    persona = coalesce(excluded.persona, c.persona),
    fase = coalesce(excluded.fase, c.fase),
    nivel_estudos = coalesce(excluded.nivel_estudos, c.nivel_estudos),
    preocupacao = coalesce(excluded.preocupacao, c.preocupacao),
    respostas = c.respostas || excluded.respostas,
    -- a data mais recente informada vence (a pessoa pode ter corrigido); sem data nova, mantém a antiga
    data_entrada = coalesce(excluded.data_entrada, c.data_entrada),
    -- primeira origem vence: quem volta por outro link não apaga de onde veio da 1ª vez
    utm_source = coalesce(c.utm_source, excluded.utm_source),
    utm_medium = coalesce(c.utm_medium, excluded.utm_medium),
    utm_campaign = coalesce(c.utm_campaign, excluded.utm_campaign),
    utm_content = coalesce(c.utm_content, excluded.utm_content),
    ig_id = coalesce(c.ig_id, excluded.ig_id),
    instagram = coalesce(c.instagram, excluded.instagram)
  returning c.id, (c.xmax = 0) into v_id, v_novo;

  insert into eventos (contato_id, tipo, dados) values
    (v_id, case when v_novo then 'email_capturado' else 'email_recapturado' end,
      jsonb_strip_nulls(jsonb_build_object('origem', v_origem, 'utm_source', v_utm_source,
        'utm_campaign', v_utm_campaign, 'utm_content', v_utm_content))),
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

-- ---------- A visão que o painel lê (mesma da prazo-vlsts + colunas de origem) ----------
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
  pz.dias_para_prazo,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.utm_content,
  c.ig_id,
  c.instagram
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
