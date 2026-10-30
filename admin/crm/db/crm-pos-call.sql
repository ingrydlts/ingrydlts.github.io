-- Por Dentro — CRM: a etapa "Pós-call" (a call fluida vira Dossiê + sinais + fila de curadoria)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-dossie.sql e crm-onboarding.sql (usa contatos, eventos, eh_admin() e crm_salvar_dossie()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum (a única função reescrita é crm_salvar_dossie, que ganha chaves).
--
-- A call sai do roteiro, mas o que sai dela cai sempre nos mesmos baldes (docs/propostas/PERSONALIZACAO-PELO-CRM.md, no app):
--   fatos      → Dossiê (chaves novas: formacao_alvo, grupo_area, area_interesse, ensino_medio_ano, tem_graduacao, frances_gargalo,
--                tem_aula_frances, plano_b)
--   leitura    → `sinais` no Dossiê: lista de chaves do vocabulário fechado `sinais_vocabulario` (o app lê como sinal_<chave>)
--   perguntas e respostas da call, itens candidatos → `curadoria_fila`, com o tema (uma chave do vocabulário, ou 'outro')
--   regra dos 3: tema com 3 pessoas ou mais na fila (crm_curadoria_contagem) está pronto para virar padrão (material, assunto
--                ou notícia do Radar); até lá fica como item com nota, individual.
--
-- A IA (Worker, /api/crm/pos-call/ler) lê a transcrição e só PROPÕE: a proposta fica em `pos_call_propostas` (pendente) e nada
-- vai para a ficha até você aplicar. A transcrição não é guardada aqui; só o resultado da leitura.
--
-- Quem lê e escreve o quê: só admin (RLS e eh_admin()). Pessoa logada e anon não enxergam nenhuma destas tabelas.
--
-- Como desfazer (as chaves novas ficam no jsonb do Dossiê e não atrapalham):
--   drop function if exists public.crm_curadoria_resolver(text, text);
--   drop function if exists public.crm_curadoria_contagem();
--   drop function if exists public.crm_pos_call_descartar(bigint);
--   drop function if exists public.crm_pos_call_aplicar(bigint, jsonb, jsonb);
--   drop table if exists public.curadoria_fila, public.pos_call_propostas, public.sinais_vocabulario;

-- ---------- Vocabulário fechado de sinais ----------
create table if not exists public.sinais_vocabulario (
  chave text primary key check (chave ~ '^[a-z0-9_]{3,40}$'),
  rotulo text not null check (length(rotulo) between 1 and 80),
  descricao text check (descricao is null or length(descricao) <= 300),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.sinais_vocabulario enable row level security;
drop policy if exists "sinais_vocabulario: só admin" on public.sinais_vocabulario;
create policy "sinais_vocabulario: só admin" on public.sinais_vocabulario
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.sinais_vocabulario from anon;

insert into public.sinais_vocabulario (chave, rotulo, descricao) values
  ('sem_graduacao', 'Só o ensino médio', 'Não tem graduação: a entrada é por L1 ou BTS, não por Master.'),
  ('curso_calendario_fixo', 'Curso com calendário fixo', 'Artes e cinema seguem o ciclo de candidatura; administração entra o ano todo.'),
  ('dap_verte', 'Mora na França, vaga em L1 (DAP verte)', 'Já reside na França e quer o 1º ano de licence: a DAP verte, não o Campus France.'),
  ('idade_26_29', 'Entre 26 e 29 anos', 'Não há limite de idade para estudar; muda o contrato na alternância aos 30.'),
  ('medo_irregular', 'Medo de ficar irregular', 'A preocupação é perder o status por erro de prazo ou de documento.'),
  ('quer_plano_b', 'Quer um plano B', 'Pergunta o que fazer se não entrar na universidade.'),
  ('frances_oral_escrita', 'Francês: fala e escrita fracas', 'Compreende, mas trava na fala e na escrita.'),
  ('sem_sponsor_definido', 'Sponsor ainda não definido', 'Não comprova recursos e ainda não falou com um sponsor ou garante.')
on conflict (chave) do nothing;

-- ---------- Dossiê com as chaves novas ----------
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
    'formacao_alvo', 'grupo_area', 'frances_gargalo', 'area_interesse'];
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

-- ---------- Propostas da leitura da call ----------
create table if not exists public.pos_call_propostas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  hash_entrada text not null check (length(hash_entrada) = 64),   -- SHA-256 da transcrição + notas: a mesma entrada não gasta uma nova leitura
  proposta jsonb not null,
  status text not null default 'pendente' check (status in ('pendente', 'aplicada', 'descartada')),
  modelo text,
  custo_usd numeric(10, 4),
  criado_em timestamptz not null default now(),
  decidida_em timestamptz
);
create index if not exists pos_call_propostas_contato_idx on public.pos_call_propostas (contato_id, criado_em desc);
create unique index if not exists pos_call_propostas_pendente_idx on public.pos_call_propostas (contato_id, hash_entrada) where status = 'pendente';
alter table public.pos_call_propostas enable row level security;
drop policy if exists "pos_call_propostas: só admin" on public.pos_call_propostas;
create policy "pos_call_propostas: só admin" on public.pos_call_propostas
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.pos_call_propostas from anon;

-- ---------- Fila de curadoria ----------
create table if not exists public.curadoria_fila (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  proposta_id bigint references public.pos_call_propostas(id) on delete set null,
  tipo text not null check (tipo in ('pergunta', 'resposta', 'item')),   -- o que ela perguntou · o que você explicou · notícia candidata
  texto text not null check (length(texto) between 1 and 600),
  tema text not null default 'outro' check (tema = 'outro' or tema ~ '^[a-z0-9_]{3,40}$'),
  camada text check (camada is null or camada in ('padrao', 'individual')),
  payload jsonb,                                                          -- o item candidato inteiro (fator, título, texto, fonte a conferir...)
  status text not null default 'aberta' check (status in ('aberta', 'virou_conteudo', 'descartada')),
  criado_em timestamptz not null default now()
);
create index if not exists curadoria_fila_tema_idx on public.curadoria_fila (tema, status);
alter table public.curadoria_fila enable row level security;
drop policy if exists "curadoria_fila: só admin" on public.curadoria_fila;
create policy "curadoria_fila: só admin" on public.curadoria_fila
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.curadoria_fila from anon;

-- Quantas pessoas diferentes trouxeram cada tema (perguntas e respostas abertas). 3 ou mais = pronto para virar padrão.
-- security invoker: quem não é admin não enxerga linha nenhuma (RLS).
create or replace function public.crm_curadoria_contagem() returns table (tema text, n_pessoas bigint, n_itens bigint, pronto boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select f.tema, count(distinct f.contato_id), count(*), count(distinct f.contato_id) >= 3
    from public.curadoria_fila f
   where f.status = 'aberta' and f.tipo in ('pergunta', 'resposta')
   group by f.tema
   order by count(distinct f.contato_id) desc, f.tema;
$$;
revoke all on function public.crm_curadoria_contagem() from public;
revoke all on function public.crm_curadoria_contagem() from anon;
grant execute on function public.crm_curadoria_contagem() to authenticated;

-- ---------- Aplicar / descartar ----------
-- p_campos: o que vai para o Dossiê (inclui `sinais`, a lista final); só as chaves de crm_salvar_dossie.
-- p_fila: [{tipo, texto, tema, camada?, payload?}] o que você marcou para a curadoria.
create or replace function public.crm_pos_call_aplicar(p_proposta bigint, p_campos jsonb, p_fila jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_contato uuid;
  v_antes timestamptz;
  v_dossie jsonb := null;
  v_n int := 0;
  x jsonb;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select contato_id into v_contato from pos_call_propostas where id = p_proposta and status = 'pendente' for update;
  if v_contato is null then
    raise exception 'proposta_nao_encontrada';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then raise exception 'formato_invalido'; end if;
  if p_fila is null or jsonb_typeof(p_fila) <> 'array' or jsonb_array_length(p_fila) > 40 then raise exception 'formato_invalido'; end if;

  select ultimo_evento_em into v_antes from contatos where id = v_contato;

  if p_campos <> '{}'::jsonb then
    v_dossie := public.crm_salvar_dossie(v_contato, p_campos);   -- valida cada chave e cada sinal
  end if;

  for x in select * from jsonb_array_elements(p_fila) loop
    if jsonb_typeof(x) <> 'object' then raise exception 'formato_invalido'; end if;
    insert into curadoria_fila (contato_id, proposta_id, tipo, texto, tema, camada, payload)
    values (v_contato, p_proposta, x->>'tipo', btrim(coalesce(x->>'texto', '')), coalesce(nullif(btrim(x->>'tema'), ''), 'outro'),
            nullif(x->>'camada', ''), case when jsonb_typeof(x->'payload') = 'object' then x->'payload' end);
    v_n := v_n + 1;
  end loop;

  update pos_call_propostas set status = 'aplicada', decidida_em = now() where id = p_proposta;

  -- Linha do tempo: coisa SUA, não zera o "parada há N dias" dela.
  insert into eventos (contato_id, tipo, dados) values (v_contato, 'pos_call_aplicada',
    jsonb_build_object('campos', (select count(*) from jsonb_object_keys(p_campos)), 'fila', v_n));
  update contatos set ultimo_evento_em = v_antes where id = v_contato;

  return jsonb_build_object('dossie', v_dossie, 'fila', v_n);
end;
$$;
revoke all on function public.crm_pos_call_aplicar(bigint, jsonb, jsonb) from public;
revoke all on function public.crm_pos_call_aplicar(bigint, jsonb, jsonb) from anon;
grant execute on function public.crm_pos_call_aplicar(bigint, jsonb, jsonb) to authenticated;

create or replace function public.crm_pos_call_descartar(p_proposta bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update pos_call_propostas set status = 'descartada', decidida_em = now() where id = p_proposta and status = 'pendente';
end;
$$;
revoke all on function public.crm_pos_call_descartar(bigint) from public;
revoke all on function public.crm_pos_call_descartar(bigint) from anon;
grant execute on function public.crm_pos_call_descartar(bigint) to authenticated;

-- Um tema virou conteúdo (ou foi descartado): fecha as linhas abertas dele, para a contagem recomeçar do zero.
create or replace function public.crm_curadoria_resolver(p_tema text, p_status text) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_status is null or p_status <> all (array['virou_conteudo', 'descartada']) then
    raise exception 'status_invalido';
  end if;
  update curadoria_fila set status = p_status where tema = p_tema and status = 'aberta';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.crm_curadoria_resolver(text, text) from public;
revoke all on function public.crm_curadoria_resolver(text, text) from anon;
grant execute on function public.crm_curadoria_resolver(text, text) to authenticated;
