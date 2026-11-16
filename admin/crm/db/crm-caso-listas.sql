-- LISTAS (CHECKLISTS) PARTICULARES DO PERCURSO + CAMADA DE CADA ENCAMINHAMENTO.
-- Rode DEPOIS de crm-caso.sql e crm-caso-importar.sql. Pode rodar de novo sem estragar nada. Só acrescenta.
--
-- O problema: o checklist de cada persona vem de modelos em content/ (por PR no app). O CRM só conseguia acrescentar passos soltos.
-- Um checklist que só existe no percurso desta pessoa (ex.: "Dossiê para empresas" de quem está no PVT) não tinha onde morar.
--
--   1. caso_listas        uma lista nomeada por pessoa (chave estável + título), com a mesma regra de revisão/publicação do board.
--                         Só admin lê e escreve a tabela; a pessoa recebe as listas publicadas por meu_caso().
--   2. caso_acoes         ganha lista_chave (a ação pertence a uma lista da MESMA pessoa; apagar a lista solta a ação) e camada:
--                         persona (vale para todo mundo da persona), particular (do percurso desta pessoa) ou entrega_equipe (algo que
--                         a equipe precisa mandar a ela: link, PDF).
--   3. meu_caso()         passa a devolver "listas" (só as publicadas) e "lista_chave" em cada ação. Ação de lista NÃO publicada
--                         não sai (a pessoa nunca vê o que ainda é rascunho). Corpo atual de crm-caso-importar.sql + essas duas peças.
--   4. crm_lista_publicar / crm_lista_retirar   iguais a crm_board_publicar / crm_board_retirar.
-- ATENÇÃO: este arquivo redefine meu_caso(). Se rodar crm-caso.sql ou crm-caso-importar.sql DEPOIS dele, rode este de novo.

-- ---------- 1. A tabela ----------
create table if not exists public.caso_listas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9_]{1,40}$'),
  titulo text not null check (length(btrim(titulo)) between 1 and 80),
  origem text not null default 'particular' check (origem in ('modelo', 'particular')),   -- modelo = veio de um modelo da persona; particular = só desta pessoa
  estado text not null default 'proposto' check (estado in ('proposto', 'revisado', 'publicado')),
  ordem smallint,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  publicado_por uuid references auth.users(id) on delete set null,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (contato_id, chave)
);
create index if not exists caso_listas_contato_idx on public.caso_listas (contato_id, estado, ordem);
alter table public.caso_listas enable row level security;
drop policy if exists "caso_listas: só admin" on public.caso_listas;
create policy "caso_listas: só admin" on public.caso_listas for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.caso_listas from anon;

-- Mesma regra do board: nasce proposta; precisa ser revisada antes de publicar; publicar exige o consentimento "servico".
create or replace function public.caso_lista_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado = 'publicado' then raise exception 'publique_depois_de_criar'; end if;
    return new;
  end if;
  new.atualizado_em := now();
  if new.estado = 'publicado' and old.estado is distinct from 'publicado' then
    if old.estado = 'proposto' then raise exception 'revise_antes_de_publicar'; end if;
    if not public.caso_tem_consentimento(new.contato_id) then raise exception 'sem_consentimento'; end if;
    new.publicado_em := now();
    new.publicado_por := auth.uid();
  elsif new.estado = 'revisado' and old.estado = 'proposto' then
    new.revisado_em := now();
    new.revisado_por := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.caso_lista_guarda() from public, anon, authenticated;
drop trigger if exists caso_listas_guarda on public.caso_listas;
create trigger caso_listas_guarda before insert or update on public.caso_listas for each row execute function public.caso_lista_guarda();

-- ---------- 2. A ação pertence a uma lista e tem uma camada ----------
alter table public.caso_acoes add column if not exists lista_chave text check (lista_chave is null or lista_chave ~ '^[a-z0-9_]{1,40}$');
alter table public.caso_acoes add column if not exists camada text check (camada is null or camada in ('persona', 'particular', 'entrega_equipe'));
-- Démarche (tipo de checklist: banco, caf, visa_estudante…) e subitens (os pontos do passo) de cada ação: o mesmo detalhe do Checklist da persona.
alter table public.caso_acoes add column if not exists demarche text check (demarche is null or demarche ~ '^[a-z0-9_]{1,40}$');
alter table public.caso_acoes add column if not exists subitens jsonb check (subitens is null or (jsonb_typeof(subitens) = 'array' and jsonb_array_length(subitens) <= 6));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'caso_acoes_lista_fk') then
    -- apagar a lista solta a ação (lista_chave vira nulo) sem tocar em contato_id
    alter table public.caso_acoes add constraint caso_acoes_lista_fk foreign key (contato_id, lista_chave)
      references public.caso_listas (contato_id, chave) on delete set null (lista_chave);
  end if;
end $$;

create or replace function public.caso_acao_lista_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.lista_chave is not null and (tg_op = 'INSERT' or new.lista_chave is distinct from old.lista_chave) then
    if not exists (select 1 from caso_listas l where l.contato_id = new.contato_id and l.chave = new.lista_chave) then
      raise exception 'lista_invalida';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.caso_acao_lista_guarda() from public, anon, authenticated;
drop trigger if exists caso_acoes_lista_guarda on public.caso_acoes;
create trigger caso_acoes_lista_guarda before insert or update on public.caso_acoes for each row execute function public.caso_acao_lista_guarda();

-- ---------- 3. O que a pessoa recebe ----------
create or replace function public.meu_caso() returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    return null;
  end if;
  return jsonb_build_object(
    'board', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'tipo', b.tipo, 'titulo', b.titulo, 'resumo', b.resumo, 'dados', b.dados,
               'dados_dela', b.dados_dela, 'ordem', b.ordem, 'link', b.link, 'tem_arquivo', (b.arquivo_caminho is not null or b.link is not null),
               'publicado_em', b.publicado_em) order by b.ordem nulls last, b.id)
        from board_itens b where b.contato_id = v_c and b.estado = 'publicado'), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object('chave', l.chave, 'titulo', l.titulo, 'ordem', l.ordem) order by l.ordem nulls last, l.id)
        from caso_listas l where l.contato_id = v_c and l.estado = 'publicado'), '[]'::jsonb),
    'acoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'n', a.n, 'titulo', a.titulo, 'passo_chave', a.passo_chave, 'prazo', a.prazo,
               'prazo_texto', a.prazo_texto, 'prazo_a_confirmar', a.prazo_a_confirmar, 'estado', a.estado, 'botao', a.botao,
               'lista_chave', a.lista_chave, 'demarche', a.demarche, 'subitens', a.subitens, 'camada', a.camada) order by a.n nulls last, a.id)
        from caso_acoes a where a.contato_id = v_c and a.dono = 'ela' and a.canal = 'plataforma' and a.publicada_em is not null
         and (a.lista_chave is null or exists (select 1 from caso_listas l where l.contato_id = a.contato_id and l.chave = a.lista_chave and l.estado = 'publicado'))), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'resposta_tipo', a.resposta_tipo,
               'opcoes', to_jsonb(a.opcoes), 'destino', a.destino, 'liberar_em', a.liberar_em, 'lido', a.estado = 'lido') order by a.liberar_em, a.id)
        from caso_avisos a where a.contato_id = v_c and public.caso_aviso_visivel(a)), '[]'::jsonb),
    'respondidas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'resposta', r.resposta, 'respondido_em', r.respondido_em) order by r.respondido_em desc)
        from (select * from caso_avisos where contato_id = v_c and estado = 'respondido' order by respondido_em desc limit 10) r), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.meu_caso() from public;
revoke all on function public.meu_caso() from anon;
grant execute on function public.meu_caso() to authenticated;

-- ---------- 4. Você ----------
create or replace function public.crm_lista_publicar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update caso_listas set estado = 'publicado' where id = p_id;
  if not found then
    raise exception 'lista_nao_encontrada';
  end if;
end;
$$;
revoke all on function public.crm_lista_publicar(bigint) from public;
revoke all on function public.crm_lista_publicar(bigint) from anon;
grant execute on function public.crm_lista_publicar(bigint) to authenticated;

create or replace function public.crm_lista_retirar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update caso_listas set estado = 'revisado' where id = p_id and estado = 'publicado';
  if not found then
    raise exception 'lista_nao_encontrada';
  end if;
end;
$$;
revoke all on function public.crm_lista_retirar(bigint) from public;
revoke all on function public.crm_lista_retirar(bigint) from anon;
grant execute on function public.crm_lista_retirar(bigint) to authenticated;
