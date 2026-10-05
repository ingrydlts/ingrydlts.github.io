-- ============================================================================
-- CRM, entrega 3a do Circuito: pergunta única vira caso no cérebro (hub), sem identificação
-- ============================================================================
-- Rodar no SQL Editor do Supabase DEPOIS das fases 1, 1b e 2. Idempotente.
-- Plano: instagram-hub/docs/circuito/ENTREGA-3.md (seções 3, 3.1 e 4).
--
-- O que muda:
--   * perguntas_unicas ganha uso_conteudo (a pessoa aceitou o uso sem identificação, aceite
--     site-v2), codigo_cerebro (código opaco "Q-XXXXXX") e cerebro_estado.
--   * consentimentos aceita a finalidade nova 'uso_conteudo'.
--   * enviar_pergunta_unica passa a ler payload.aceita_uso_conteudo.
--   * cerebro_chaves: chave própria e REVOGÁVEL do hub (só o hash fica no banco).
--   * perguntas_para_cerebro(chave) devolve SÓ: código, texto, artigo, data, persona, caminho.
--     Nunca e-mail, nome nem id. Só pergunta com uso_conteudo = true.
--   * confirmar_pergunta_cerebro(chave, codigo, estado) fecha o ciclo (caso | descartada).
--
-- Chave do hub (a Ingryd cria; nunca colar a chave em chat nem em arquivo do repositório):
--   1. Gerar:    openssl rand -hex 32
--   2. Guardar no Worker do hub como Secret CRM_CEREBRO_CHAVE (a mesma string).
--   3. No SQL Editor, trocando o valor:
--        insert into cerebro_chaves (rotulo, hash)
--        values ('hub', sha256(convert_to('COLE-A-CHAVE-AQUI', 'UTF8')));
--   Revogar (a função para de responder na hora):
--        update cerebro_chaves set revogada_em = now() where rotulo = 'hub' and revogada_em is null;
--   Trocar = revogar a antiga, inserir uma nova e atualizar o Secret.
-- ============================================================================

-- ---------- Consentimento: finalidade nova ----------

alter table consentimentos drop constraint if exists consentimentos_finalidade_check;
alter table consentimentos add constraint consentimentos_finalidade_check
  check (finalidade in ('servico', 'novidades_email', 'uso_conteudo'));

-- ---------- Colunas novas em perguntas_unicas ----------

alter table perguntas_unicas add column if not exists uso_conteudo boolean not null default false;
alter table perguntas_unicas add column if not exists codigo_cerebro text;
alter table perguntas_unicas add column if not exists cerebro_estado text;
alter table perguntas_unicas add column if not exists cerebro_em timestamptz;

alter table perguntas_unicas drop constraint if exists perguntas_cerebro_estado_check;
alter table perguntas_unicas add constraint perguntas_cerebro_estado_check
  check (cerebro_estado is null or cerebro_estado in ('oferecida', 'caso', 'descartada'));
alter table perguntas_unicas drop constraint if exists perguntas_cerebro_codigo_check;
alter table perguntas_unicas add constraint perguntas_cerebro_codigo_check
  check (codigo_cerebro is null or codigo_cerebro ~ '^Q-[0-9A-F]{6}$');
create unique index if not exists perguntas_codigo_cerebro_idx on perguntas_unicas (codigo_cerebro) where codigo_cerebro is not null;

-- ---------- Chave do hub (só o hash) ----------

create table if not exists cerebro_chaves (
  id bigint generated always as identity primary key,
  rotulo text not null,
  hash bytea not null unique,
  criada_em timestamptz not null default now(),
  revogada_em timestamptz
);
alter table cerebro_chaves enable row level security;
drop policy if exists "cerebro_chaves: só admin" on cerebro_chaves;
create policy "cerebro_chaves: só admin" on cerebro_chaves
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on cerebro_chaves from anon;

create or replace function public.crm_cerebro_chave_ok(p_chave text) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select p_chave is not null and length(p_chave) >= 32 and exists (
    select 1 from cerebro_chaves
     where revogada_em is null and hash = sha256(convert_to(p_chave, 'UTF8')));
$$;
revoke all on function public.crm_cerebro_chave_ok(text) from public, anon, authenticated;

-- ---------- Público: pergunta única (agora com o aceite do uso em conteúdo) ----------
-- Igual à da fase 2, mais payload.aceita_uso_conteudo (true) que grava uso_conteudo na pergunta
-- e um registro de consentimento 'uso_conteudo' com a versão e o texto exatos.

create or replace function public.enviar_pergunta_unica(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_texto text;
  v_id uuid;
  v_novo boolean;
  v_origem text;
  v_uso boolean;
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
  v_texto := trim(coalesce(payload->>'texto', ''));
  if length(v_texto) = 0 then raise exception 'pergunta_vazia'; end if;
  if length(v_texto) > 2000 then raise exception 'pergunta_grande_demais'; end if;
  v_origem := crm_token(payload->>'artigo');
  v_uso := coalesce(payload->>'aceita_uso_conteudo', '') = 'true';

  insert into contatos as c (email, nome, origem)
  values (v_email, nullif(left(trim(coalesce(payload->>'nome', '')), 100), ''), coalesce(v_origem, 'artigo'))
  on conflict (email) do update set nome = coalesce(excluded.nome, c.nome)
  returning c.id, (c.xmax = 0) into v_id, v_novo;

  if (select count(*) from perguntas_unicas where contato_id = v_id and status = 'nova') >= 3 then
    raise exception 'muitas_perguntas_abertas';
  end if;

  if not exists (select 1 from consentimentos where contato_id = v_id and finalidade = 'servico') then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'servico', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_servico', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;

  -- Uso da pergunta, sem identificação, para criar conteúdo: um registro por envio aceito.
  if v_uso then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'uso_conteudo', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_servico', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;

  -- Caixinha "quero receber a newsletter": só registra o SIM (deixar desmarcada não retira
  -- um aceite que a pessoa já deu antes).
  if coalesce(payload->>'aceita_novidades', '') = 'true' and coalesce((select cn.aceito from consentimentos cn
       where cn.contato_id = v_id and cn.finalidade = 'novidades_email' order by cn.criado_em desc limit 1), false) = false then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'novidades_email', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_novidades', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;

  if v_novo then
    insert into eventos (contato_id, tipo, dados)
    values (v_id, 'email_capturado', jsonb_build_object('origem', coalesce(v_origem, 'artigo')));
  end if;

  insert into perguntas_unicas (contato_id, texto, origem, uso_conteudo) values (v_id, v_texto, v_origem, v_uso);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enviar_pergunta_unica(jsonb) from public;
grant execute on function public.enviar_pergunta_unica(jsonb) to anon, authenticated;

-- ---------- Hub: ler as perguntas que podem virar caso ----------
-- Candidata: uso_conteudo = true e ainda não virou caso nem foi descartada. Na primeira leitura
-- ganha o código opaco e fica 'oferecida'; se o Worker falhar no meio, a próxima leitura devolve
-- a mesma (com o mesmo código). Devolve no máximo 20 por chamada, as mais antigas primeiro.
-- Nenhuma coluna que identifique a pessoa sai daqui.

create or replace function public.perguntas_para_cerebro(p_chave text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_cod text;
  v_try int;
begin
  if not public.crm_cerebro_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;

  for r in
    select id from perguntas_unicas
     where uso_conteudo and codigo_cerebro is null and cerebro_estado is null
     order by criado_em limit 20
  loop
    v_try := 0;
    loop
      v_try := v_try + 1;
      v_cod := 'Q-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      begin
        update perguntas_unicas
           set codigo_cerebro = v_cod, cerebro_estado = 'oferecida', cerebro_em = now()
         where id = r.id;
        exit;
      exception when unique_violation then
        if v_try >= 5 then raise; end if;
      end;
    end loop;
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', p.codigo_cerebro,
             'texto', p.texto,
             'artigo', p.origem,
             'data', p.criado_em::date,
             'persona', c.persona,
             'caminho', c.caminho) order by p.criado_em)
      from (select * from perguntas_unicas
             where uso_conteudo and cerebro_estado = 'oferecida'
             order by criado_em limit 20) p
      join contatos c on c.id = p.contato_id), '[]'::jsonb);
end;
$$;

revoke all on function public.perguntas_para_cerebro(text) from public;
grant execute on function public.perguntas_para_cerebro(text) to anon, authenticated;

-- ---------- Hub: fechar o ciclo de uma pergunta ----------

create or replace function public.confirmar_pergunta_cerebro(p_chave text, p_codigo text, p_estado text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.crm_cerebro_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;
  if p_estado is null or p_estado not in ('caso', 'descartada') then
    raise exception 'estado_invalido';
  end if;
  update perguntas_unicas set cerebro_estado = p_estado, cerebro_em = now()
   where codigo_cerebro = p_codigo and cerebro_estado = 'oferecida';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n = 1);
end;
$$;

revoke all on function public.confirmar_pergunta_cerebro(text, text, text) from public;
grant execute on function public.confirmar_pergunta_cerebro(text, text, text) to anon, authenticated;
