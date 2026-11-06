-- ============================================================================
-- Percursos: tabela de REFERÊNCIA (conhecimento, sem dado de cliente), publicada pelo hub
-- ============================================================================
-- Rodar no SQL Editor do Supabase DEPOIS de crm-fase3-cerebro.sql (usa a tabela `cerebro_chaves`).
-- Primeiro no banco de TESTE, depois no de produção. Idempotente.
-- Contrato: instagram-hub/docs/CONTRATO-PERCURSOS.md (decisão #101). O conteúdo (vault/Percursos Por Dentro/percursos.json)
-- é privado: este arquivo só cria a ESTRUTURA. Nenhum percurso entra por aqui.
--
-- O que cria:
--   * percurso_versoes: uma linha por versão publicada (o arquivo inteiro em `conteudo`), com no máximo UMA ativa.
--     Só o admin lê. Ninguém escreve direto: só pelas duas funções abaixo.
--   * publicar_percurso(chave, conteudo): chamada pela Action do hub com a chave pública do site + uma chave PRÓPRIA
--     (rótulo 'percurso'). Valida o formato, recusa e-mail no texto, é idempotente (mesmo hash = não faz nada) e
--     ativa a versão nova numa transação só.
--   * percurso_ativar(versao): só admin logada. Troca a versão ativa (voltar atrás é ativar uma antiga).
--   * crm_percurso_chave_ok(chave): confere a chave do rótulo 'percurso'. Não é chamável por ninguém de fora.
--
-- O `hash` que o hub manda é um IDENTIFICADOR da versão (calculado em Python, scripts/lib/percursos.py). O banco não o
-- recalcula: quem garante a autenticidade é a chave. Se a chave vazar, revogue (abaixo) e crie outra.
--
-- Chave do hub para publicar (a Ingryd cria; nunca colar a chave em chat nem em arquivo do repositório):
--   1. Gerar:    openssl rand -hex 32
--   2. Guardar no GitHub do hub como Secret PERCURSO_CHAVE (a mesma string).
--   3. No SQL Editor, trocando o valor:
--        insert into cerebro_chaves (rotulo, hash)
--        values ('percurso', sha256(convert_to('COLE-A-CHAVE-AQUI', 'UTF8')));
--   Revogar (a publicação para de responder na hora):
--        update cerebro_chaves set revogada_em = now() where rotulo = 'percurso' and revogada_em is null;
--
-- Quem LÊ o conteúdo hoje: só o admin (CRM). Como a plataforma lê é decisão em aberto (contrato §7): não abrir leitura
-- para a cliente logada sem decidir, porque uma política de leitura entregaria o arquivo inteiro (1025 combinações).
-- ============================================================================

-- ---------- Tabela ----------

create table if not exists percurso_versoes (
  id bigint generated always as identity primary key,
  versao text not null unique check (versao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$'),
  schema_version int not null check (schema_version >= 1),
  hash text not null unique check (hash ~ '^[0-9a-f]{64}$'),
  conteudo jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  ativa boolean not null default false,
  publicado_em timestamptz not null default now()
);
comment on table percurso_versoes is 'Percursos Por Dentro: uma linha por versão publicada pelo hub (conhecimento, sem dado de cliente).';

-- No máximo uma versão ativa.
create unique index if not exists percurso_versoes_uma_ativa on percurso_versoes ((true)) where ativa;

alter table percurso_versoes enable row level security;
drop policy if exists "percurso_versoes: só admin lê" on percurso_versoes;
create policy "percurso_versoes: só admin lê" on percurso_versoes
  for select using (public.eh_admin());
revoke all on percurso_versoes from anon;
revoke insert, update, delete on percurso_versoes from authenticated;

-- ---------- Chave própria da publicação ----------

create or replace function public.crm_percurso_chave_ok(p_chave text) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select p_chave is not null and length(p_chave) >= 32 and exists (
    select 1 from cerebro_chaves
     where revogada_em is null and rotulo = 'percurso' and hash = sha256(convert_to(p_chave, 'UTF8')));
$$;
revoke all on function public.crm_percurso_chave_ok(text) from public, anon, authenticated;

-- ---------- Hub: publicar uma versão ----------

create or replace function public.publicar_percurso(p_chave text, p_conteudo jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_versao text;
  v_schema int;
  v_hash text;
  v_existente percurso_versoes%rowtype;
  v_id bigint;
begin
  if not public.crm_percurso_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' then
    raise exception 'conteudo_invalido';
  end if;
  if octet_length(p_conteudo::text) > 2000000 then
    raise exception 'conteudo_grande_demais';
  end if;

  v_versao := p_conteudo->>'versao';
  v_hash := p_conteudo->>'hash';
  begin
    v_schema := (p_conteudo->>'schema_version')::int;
  exception when others then
    raise exception 'schema_invalido';
  end;
  if v_schema is distinct from 1 then raise exception 'schema_nao_suportado'; end if;
  if v_versao is null or v_versao !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$' then raise exception 'versao_invalida'; end if;
  if v_hash is null or v_hash !~ '^[0-9a-f]{64}$' then raise exception 'hash_invalido'; end if;

  if jsonb_typeof(p_conteudo->'camadas') is distinct from 'array'
     or jsonb_typeof(p_conteudo->'nos') is distinct from 'object'
     or jsonb_typeof(p_conteudo->'percursos') is distinct from 'array'
     or jsonb_typeof(p_conteudo->'faixas') is distinct from 'array' then
    raise exception 'estrutura_invalida';
  end if;
  if jsonb_array_length(p_conteudo->'percursos') = 0 or not exists (select 1 from jsonb_object_keys(p_conteudo->'nos')) then
    raise exception 'conteudo_vazio';
  end if;
  -- Defesa em profundidade: o hub já recusa, mas o banco também (nenhum e-mail dentro do conhecimento).
  if p_conteudo::text ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}' then
    raise exception 'dado_pessoal';
  end if;

  perform pg_advisory_xact_lock(hashtext('publicar_percurso'));

  -- Idempotente: o mesmo conteúdo (mesmo hash) não muda nada, nem reativa uma versão antiga.
  select * into v_existente from percurso_versoes where hash = v_hash;
  if found then
    return jsonb_build_object('status', 'igual', 'versao', v_existente.versao, 'ativa', v_existente.ativa);
  end if;
  if exists (select 1 from percurso_versoes where versao = v_versao) then
    raise exception 'versao_ja_existe_com_outro_conteudo';
  end if;

  update percurso_versoes set ativa = false where ativa;
  insert into percurso_versoes (versao, schema_version, hash, conteudo, ativa)
  values (v_versao, v_schema, v_hash, p_conteudo, true)
  returning id into v_id;

  return jsonb_build_object('status', 'publicada', 'versao', v_versao, 'ativa', true);
end;
$$;
revoke all on function public.publicar_percurso(text, jsonb) from public;
grant execute on function public.publicar_percurso(text, jsonb) to anon, authenticated;

-- ---------- Admin: trocar a versão ativa (voltar atrás) ----------

create or replace function public.percurso_ativar(p_versao text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select id into v_id from percurso_versoes where versao = p_versao;
  if v_id is null then
    raise exception 'versao_inexistente';
  end if;
  perform pg_advisory_xact_lock(hashtext('publicar_percurso'));
  update percurso_versoes set ativa = false where ativa and id <> v_id;
  update percurso_versoes set ativa = true where id = v_id;
  return jsonb_build_object('status', 'ativada', 'versao', p_versao);
end;
$$;
revoke all on function public.percurso_ativar(text) from public, anon;
grant execute on function public.percurso_ativar(text) to authenticated;
