-- Por Dentro — CRM: Onboarding (documento lido pela IA → ficha com o Dossiê preenchido) e link de pagamento
-- Rode no SQL Editor do Supabase, DEPOIS de crm-dossie.sql (usa crm_salvar_dossie(), contatos, eventos e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum. O e-mail do link de pagamento é outro arquivo
-- (crm-link-pagamento-email.sql, rode depois deste).
--
-- O que entra:
--   contatos.dossie_origem   de onde veio cada campo que a IA preencheu: { campo: { valor, origem, confianca } }.
--                            origem = 'documento' | 'anotacao'; confianca = 'alta' | 'media' | 'baixa'. A ficha só mostra a
--                            etiqueta enquanto o valor do campo ainda é o que a IA escreveu (se você mexer, a etiqueta some).
--   contatos.onboarding_em   quando a ficha passou pelo Onboarding (liga o aviso "falta perguntar" no topo da ficha).
--   crm_onboarding_aplicar() cria a pessoa (ou acha a que já tem aquele e-mail) e preenche o que está vazio.
--   crm_registrar_link_pagamento()  grava na linha do tempo que o link foi enviado.
--
-- Regras:
--   * Nunca duplica: o e-mail é a chave. Se a pessoa já existe, a ficha dela é atualizada.
--   * O que você já digitou prevalece: só entra campo que está vazio. Campo que a IA leu e já tinha valor fica de fora
--     (a resposta diz quais).
--   * Só chaves do Dossiê (crm_salvar_dossie confere o formato de cada uma) e as 5 colunas de contatos (nome, persona, fase,
--     nivel_estudos, preocupacao). Número de passaporte, de documento e foto não têm onde morar aqui.
--   * O arquivo nunca chega ao banco: o Worker lê e descarta. Esta função só recebe os campos já lidos.
--   * Linha do tempo: 'onboarding_documento_lido' guarda só os nomes dos campos preenchidos e o custo estimado da leitura
--     (nada do conteúdo do documento). 'link_pagamento_enviado' guarda o plano e a moeda. Os dois são coisa SUA: não zeram
--     o "parada há N dias" dela (mesmo cuidado de crm_salvar_dossie).
--
-- Quem chama: o Worker (/api/crm/onboarding/ler e /api/crm/link-pagamento), com o token da admin. As funções conferem
-- eh_admin() sozinhas: quem não é admin recebe 'sem_permissao', mesmo chamando direto.
--
-- Como desfazer:
--   drop function if exists public.crm_registrar_link_pagamento(uuid, text, text, text);
--   drop function if exists public.crm_onboarding_aplicar(text, jsonb, numeric);
--   alter table public.contatos drop column if exists dossie_origem, drop column if exists onboarding_em;

alter table public.contatos add column if not exists dossie_origem jsonb not null default '{}'::jsonb;
alter table public.contatos add column if not exists onboarding_em timestamptz;

create or replace function public.crm_onboarding_aplicar(p_email text, p_campos jsonb, p_custo numeric default null) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_id uuid;
  v_criado boolean := false;
  v_antes timestamptz;
  v_c contatos%rowtype;
  v_cols text[] := array['nome', 'persona', 'fase', 'nivel_estudos', 'preocupacao'];
  v_k text;
  v_val jsonb;
  v_txt text;
  v_dos jsonb := '{}'::jsonb;
  v_ok text[] := '{}';       -- campos que entraram
  v_ja text[] := '{}';       -- campos que a IA leu mas já tinham valor (o que está na ficha prevalece)
  v_origem jsonb := '{}'::jsonb;
  v_origem_k text;
  v_conf text;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalido';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
    raise exception 'formato_invalido';
  end if;
  if pg_column_size(p_campos) > 100000 then
    raise exception 'dados_grandes_demais';
  end if;
  if p_custo is not null and (p_custo < 0 or p_custo > 1000) then
    raise exception 'custo_invalido';
  end if;

  -- A pessoa: a que já tem esse e-mail ou uma nova. Nunca duplica (contatos.email é único).
  select * into v_c from contatos where lower(email) = v_email;
  if not found then
    insert into contatos (email, origem) values (v_email, 'onboarding')
    on conflict (email) do nothing;
    select * into v_c from contatos where lower(email) = v_email;
    v_criado := true;
  end if;
  v_id := v_c.id;
  v_antes := v_c.ultimo_evento_em;

  -- Campo por campo: valor nulo = a IA não achou fonte, fica vazio.
  for v_k, v_val in select * from jsonb_each(p_campos) loop
    if jsonb_typeof(v_val) <> 'object' or jsonb_typeof(v_val -> 'valor') = 'null' or not (v_val ? 'valor') then
      continue;
    end if;
    v_origem_k := case when v_val ->> 'origem' = 'anotacao' then 'anotacao' else 'documento' end;
    v_conf := case when v_val ->> 'confianca' in ('alta', 'media', 'baixa') then v_val ->> 'confianca' else 'baixa' end;

    if v_k = any (v_cols) then
      -- Colunas de contatos: só preenche se estiver vazia (persona 'sem' = ainda sem situação), e só com valor que o CRM conhece.
      if jsonb_typeof(v_val -> 'valor') <> 'string' then continue; end if;
      v_txt := trim(v_val ->> 'valor');
      if v_txt = '' then continue; end if;
      if (v_k = 'persona' and v_txt <> all (array['au_pair_estudante', 'campus_france', 'alternancia_emprego', 'conjuge', 'pvt']))
         or (v_k = 'fase' and v_txt <> all (array['planejando', 'adaptando', 'urgente']))
         or (v_k = 'nivel_estudos' and v_txt <> all (array['ensino_medio', 'superior_incompleto', 'superior_completo', 'superior_tecnologo', 'pos_graduacao']))
         or (v_k = 'preocupacao' and v_txt <> all (array['prazo', 'comeco', 'sozinha', 'caro'])) then
        continue;
      end if;
      v_txt := left(v_txt, 100);
      if (to_jsonb(v_c) ->> v_k) is null or trim(to_jsonb(v_c) ->> v_k) = '' or (v_k = 'persona' and (to_jsonb(v_c) ->> v_k) = 'sem') then
        execute format('update contatos set %I = $1 where id = $2', v_k) using v_txt, v_id;
        v_ok := v_ok || v_k;
        v_origem := v_origem || jsonb_build_object(v_k, jsonb_build_object('valor', to_jsonb(v_txt), 'origem', v_origem_k, 'confianca', v_conf));
      else
        v_ja := v_ja || v_k;
      end if;
    else
      -- Chaves do Dossiê: só entra se ainda não tem resposta (o que você digitou fica).
      if coalesce(v_c.dossie ->> v_k, '') = '' then
        v_dos := v_dos || jsonb_build_object(v_k, v_val -> 'valor');
        v_ok := v_ok || v_k;
        v_origem := v_origem || jsonb_build_object(v_k, jsonb_build_object('valor', v_val -> 'valor', 'origem', v_origem_k, 'confianca', v_conf));
      else
        v_ja := v_ja || v_k;
      end if;
    end if;
  end loop;

  -- crm_salvar_dossie confere o formato de cada chave (e recusa chave desconhecida). Se recusar, nada do Onboarding fica pela metade.
  if v_dos <> '{}'::jsonb then
    perform public.crm_salvar_dossie(v_id, v_dos);
  end if;

  update contatos
     set dossie_origem = dossie_origem || v_origem, onboarding_em = now()
   where id = v_id;

  insert into eventos (contato_id, tipo, dados)
  values (v_id, 'onboarding_documento_lido', jsonb_build_object('campos', to_jsonb(v_ok), 'custo_estimado_usd', p_custo));
  update contatos set ultimo_evento_em = v_antes where id = v_id;

  return jsonb_build_object('contato_id', v_id, 'criado', v_criado, 'preenchidos', to_jsonb(v_ok), 'ja_preenchidos', to_jsonb(v_ja));
end;
$$;
revoke all on function public.crm_onboarding_aplicar(text, jsonb, numeric) from public;
revoke all on function public.crm_onboarding_aplicar(text, jsonb, numeric) from anon;
grant execute on function public.crm_onboarding_aplicar(text, jsonb, numeric) to authenticated;

create or replace function public.crm_registrar_link_pagamento(p_contato uuid, p_plano text, p_moeda text, p_rotulo text default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_antes timestamptz;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_plano is null or p_plano !~ '^[a-z0-9_-]{1,40}$' then raise exception 'plano_invalido'; end if;
  if p_moeda is null or p_moeda !~ '^[A-Z]{3}$' then raise exception 'moeda_invalida'; end if;
  select ultimo_evento_em into v_antes from contatos where id = p_contato;
  if not found then
    raise exception 'contato_nao_encontrado';
  end if;
  insert into eventos (contato_id, tipo, dados)
  values (p_contato, 'link_pagamento_enviado',
    jsonb_build_object('plano', p_plano, 'moeda', p_moeda, 'rotulo', nullif(left(coalesce(p_rotulo, ''), 80), '')));
  update contatos set ultimo_evento_em = v_antes where id = p_contato;
end;
$$;
revoke all on function public.crm_registrar_link_pagamento(uuid, text, text, text) from public;
revoke all on function public.crm_registrar_link_pagamento(uuid, text, text, text) from anon;
grant execute on function public.crm_registrar_link_pagamento(uuid, text, text, text) to authenticated;
