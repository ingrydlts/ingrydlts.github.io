-- Por Dentro — Dossiê: as respostas das páginas de entrada (inbound pages)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-pos-call.sql (que tem a versão anterior desta função). Pode rodar de novo.
-- Rode primeiro no Supabase de TESTE, depois no de produção (docs/AMBIENTES.md do app). Depois de rodar, nos dois: db/auditoria-isolamento.sql
-- e db/conferir-banco.sql do app (os dois vazios = pronto).
--
-- O que muda: crm_salvar_dossie() passa a aceitar cinco chaves novas, uma por página de entrada (I01 a I05). Cada uma guarda a etapa que a
-- pessoa marcou no quiz daquela página (as mesmas chaves do quiz, por exemplo tec-nao-sei). Só isso: nenhuma tabela nova, nenhuma coluna
-- nova, nenhum dado mexido. Permissão igual à de antes (só admin; revoke de public e de anon).
--   etapa_i01  Alternância 30+        (alt-...)
--   etapa_i02  Tecnólogo do Brasil    (tec-...)
--   etapa_i03  Études en France       (cf-...)
--   etapa_i04  VLS-TS travou na ANEF  (vls-...)
--   etapa_i05  Au pair, checklist de chegada (ap-...)
--
-- Sem este arquivo, os campos novos do Dossiê aparecem mas não salvam ("campo_desconhecido").
--
-- Como desfazer: rode de novo o crm-pos-call.sql (ele recria a função sem essas chaves; o que já foi gravado fica no jsonb, só não dá mais para salvar).

create or replace function public.crm_salvar_dossie(p_contato uuid, p_dados jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  k text;
  v jsonb;
  -- texto curto (até 300), texto longo (as notas da ligação), data AAAA-MM-DD, sim/não, inteiro
  k_texto text[] := array['telefone', 'cidade', 'maior_preocupacao', 'faixa_idade', 'nivel_frances', 'profissao_regulamentada',
    'numero_secu', 'comprovante_endereco', 'conta_anef', 'certificado_frances', 'certificado_frances_qual', 'ano_au_pair', 'intencao_au_pair', 'trilha_estudo',
    'cfNivel', 'cfEscolaAno', 'cfTeste', 'cfPrazoCursoTem',
    'formacao_alvo', 'grupo_area', 'frances_gargalo', 'area_interesse',
    'etapa_i01', 'etapa_i02', 'etapa_i03', 'etapa_i04', 'etapa_i05'];   -- a etapa que ela marcou no quiz de cada página de entrada
  k_longo text[] := array['ligacao_resumo', 'ligacao_transcricao', 'proximos_passos'];
  k_data text[] := array['data_chegada', 'contrato_fim', 'documento_vencimento', 'data_prova_frances_master', 'cfPrazoCurso', 'ligacao_data'];
  k_bool text[] := array['moradia_resolvida', 'conta_resolvida', 'securite_resolvida', 'tem_certificado_matricula',
    'comprova_recursos', 'tem_sponsor', 'aceita_notificacao_externa', 'tem_graduacao', 'tem_aula_frances', 'plano_b'];
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
    elsif k = 'formacao_alvo' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') <> all (array['l1_universidade', 'bts', 'escola_arte', 'administracao', 'du', 'nao_sei']) then raise exception 'valor_invalido: %', k; end if;
    elsif k = 'grupo_area' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') <> all (array['artes_audiovisual', 'negocios', 'saude', 'frances_b2', 'outra']) then raise exception 'valor_invalido: %', k; end if;
    elsif k = 'frances_gargalo' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') <> all (array['oral', 'escrita', 'ambos', 'nenhum']) then raise exception 'valor_invalido: %', k; end if;
    elsif k = 'ensino_medio_ano' then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^(19[89]\d|20\d\d)$' then raise exception 'valor_invalido: %', k; end if;
    elsif k = 'sinais' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 20 then raise exception 'valor_invalido: %', k; end if;
      if exists (select 1 from jsonb_array_elements(v) s where jsonb_typeof(s) <> 'string'
                  or not exists (select 1 from public.sinais_vocabulario sv where sv.chave = (s #>> '{}') and sv.ativo)) then
        raise exception 'sinal_desconhecido';
      end if;
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
