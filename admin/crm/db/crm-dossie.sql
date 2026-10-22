-- Por Dentro — CRM: dossiê da pessoa, preenchido por você na ligação
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos, eventos e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- O dossiê é tudo o que a plataforma pergunta à pessoa (onboarding, percurso, perguntas do dashboard e
-- perfil), mais as notas da ligação. Fica na linha da pessoa em `contatos`, então existe ANTES de ela ter
-- conta no app. As chaves usam o mesmo nome que o app usa (ano_au_pair, cfNivel, numero_secu...), para que
-- uma etapa seguinte copie o dossiê para o perfil dela sem tradução.
--
-- Quem lê e escreve o quê:
--   admin (você)   → lê pela RLS de contatos e grava só por crm_salvar_dossie() (valida as chaves)
--   pessoa logada  → nada aqui (a leitura pelo app é uma etapa à parte)
--
-- Campos que moram em colunas de contatos (nome, persona, fase, nivel_estudos, preocupacao) não passam
-- por aqui: o CRM já os atualiza direto.

alter table public.contatos add column if not exists dossie jsonb not null default '{}'::jsonb;
alter table public.contatos add column if not exists dossie_atualizado_em timestamptz;

create or replace function public.crm_salvar_dossie(p_contato uuid, p_dados jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  k text;
  v jsonb;
  -- texto curto (até 300), texto longo (as notas da ligação), data AAAA-MM-DD, sim/não, inteiro
  k_texto text[] := array['telefone', 'cidade', 'maior_preocupacao', 'faixa_idade', 'nivel_frances', 'profissao_regulamentada',
    'numero_secu', 'comprovante_endereco', 'conta_anef', 'ano_au_pair', 'intencao_au_pair', 'trilha_estudo',
    'cfNivel', 'cfEscolaAno', 'cfTeste', 'cfPrazoCursoTem'];
  k_longo text[] := array['ligacao_resumo', 'ligacao_transcricao', 'proximos_passos'];
  k_data text[] := array['data_chegada', 'contrato_fim', 'documento_vencimento', 'data_prova_frances_master', 'cfPrazoCurso', 'ligacao_data'];
  k_bool text[] := array['moradia_resolvida', 'conta_resolvida', 'securite_resolvida', 'tem_certificado_matricula',
    'comprova_recursos', 'tem_sponsor', 'aceita_notificacao_externa'];
  k_int text[] := array['cfEtapa'];
  v_antes timestamptz;
  v_novo jsonb;
  v_n int := 0;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'formato_invalido';
  end if;
  if pg_column_size(p_dados) > 400000 then
    raise exception 'dados_grandes_demais';
  end if;

  for k, v in select * from jsonb_each(p_dados) loop
    v_n := v_n + 1;
    if jsonb_typeof(v) = 'null' then
      continue;   -- null apaga a resposta
    elsif k = any (k_texto) then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 300 then raise exception 'valor_invalido: %', k; end if;
    elsif k = any (k_longo) then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 200000 then raise exception 'valor_invalido: %', k; end if;
    elsif k = any (k_data) then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'valor_invalido: %', k; end if;
    elsif k = any (k_bool) then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'valor_invalido: %', k; end if;
    elsif k = any (k_int) then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d{1,2}$' then raise exception 'valor_invalido: %', k; end if;
    else
      raise exception 'campo_desconhecido: %', k;
    end if;
  end loop;

  select ultimo_evento_em into v_antes from contatos where id = p_contato;
  if not found then
    raise exception 'contato_nao_encontrado';
  end if;

  update contatos
     set dossie = jsonb_strip_nulls(dossie || p_dados), dossie_atualizado_em = now()
   where id = p_contato
  returning dossie into v_novo;

  -- Entra na linha do tempo, mas preencher o dossiê é coisa SUA: não pode zerar o "parada há N dias" dela.
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'dossie_atualizado', jsonb_build_object('campos', v_n));
  update contatos set ultimo_evento_em = v_antes where id = p_contato;

  return v_novo;
end;
$$;
revoke all on function public.crm_salvar_dossie(uuid, jsonb) from public;
revoke all on function public.crm_salvar_dossie(uuid, jsonb) from anon;
grant execute on function public.crm_salvar_dossie(uuid, jsonb) to authenticated;
