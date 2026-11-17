-- Por Dentro — Página inicial: os destaques que a Ingryd escolhe para o Início da pessoa.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app).
-- Depende de crm-caso-arquivos.sql (meu_caso com descricao e arquivo). Idempotente.
--
--   1. caso_home   um destaque por linha, em três categorias com limite fixo:
--                    checklist  até 3 passos do checklist dela (guarda o step_key)
--                    espaco     até 2 itens do Espaço (board_itens do tipo marco ou escola)
--                    guias      até 2 itens do Material da equipe (board_itens do tipo bilan, documento ou modelo)
--                  Só admin lê e escreve a tabela. O limite e a categoria certa são conferidos pelo gatilho caso_home_guarda
--                  (não só pela tela do CRM). Apagar o item do board apaga o destaque (on delete cascade).
--   2. caso_home_guarda   o gatilho: home_cheia, item_invalido.
--   3. meu_caso()   passa a devolver "home": só os destaques de item PUBLICADO (os do checklist sempre) e só os dela.
-- ATENÇÃO: este arquivo redefine meu_caso(). Se rodar crm-caso.sql, crm-caso-importar.sql, crm-caso-listas.sql ou crm-caso-arquivos.sql DEPOIS dele, rode este de novo.

-- ---------- 1. A tabela ----------
create table if not exists public.caso_home (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  categoria text not null check (categoria in ('checklist', 'espaco', 'guias')),
  step_key text check (step_key is null or step_key ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  board_id bigint references public.board_itens(id) on delete cascade,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  check ((categoria = 'checklist' and step_key is not null and board_id is null) or (categoria <> 'checklist' and board_id is not null and step_key is null))
);
create unique index if not exists caso_home_checklist_uni on public.caso_home (contato_id, step_key) where step_key is not null;
create unique index if not exists caso_home_board_uni on public.caso_home (contato_id, board_id) where board_id is not null;
create index if not exists caso_home_contato_idx on public.caso_home (contato_id, categoria, ordem);
alter table public.caso_home enable row level security;
drop policy if exists "caso_home: só admin" on public.caso_home;
create policy "caso_home: só admin" on public.caso_home for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.caso_home from anon;

-- ---------- 2. O gatilho: limite por categoria e item da categoria certa, da mesma pessoa ----------
create or replace function public.caso_home_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_max int := case new.categoria when 'checklist' then 3 else 2 end;
  v_tipo text;
  v_dono uuid;
begin
  if (select count(*) from public.caso_home h where h.contato_id = new.contato_id and h.categoria = new.categoria
        and (tg_op = 'INSERT' or h.id <> new.id)) >= v_max then
    raise exception 'home_cheia';
  end if;
  if new.board_id is not null then
    select b.tipo, b.contato_id into v_tipo, v_dono from public.board_itens b where b.id = new.board_id;
    if v_dono is distinct from new.contato_id
       or (new.categoria = 'espaco' and v_tipo not in ('marco', 'escola'))
       or (new.categoria = 'guias' and v_tipo not in ('bilan', 'documento', 'modelo')) then
      raise exception 'item_invalido';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.caso_home_guarda() from public, anon, authenticated;
drop trigger if exists caso_home_guarda on public.caso_home;
create trigger caso_home_guarda before insert or update on public.caso_home for each row execute function public.caso_home_guarda();

-- ---------- 3. O que a pessoa recebe: meu_caso() com os destaques da home ----------
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
               'descricao', b.descricao, 'arquivo', b.arquivo_caminho,
               'publicado_em', b.publicado_em) order by b.ordem nulls last, b.id)
        from board_itens b where b.contato_id = v_c and b.estado = 'publicado'), '[]'::jsonb),
    'home', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', h.categoria, 'step_key', h.step_key, 'board_id', h.board_id, 'ordem', h.ordem) order by h.categoria, h.ordem, h.id)
        from caso_home h left join board_itens b on b.id = h.board_id
       where h.contato_id = v_c and (h.categoria = 'checklist' or b.estado = 'publicado')), '[]'::jsonb),
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
