-- Por Dentro — Página inicial: o item em destaque (o principal, que aparece grande no topo do Início dela).
-- Rodar DEPOIS de crm-caso-home.sql e crm-caso-home-so-seu.sql. PRIMEIRO no Supabase de TESTE, depois no de produção.
-- Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app). Idempotente.
--
--   1. caso_home.destaque     marca UM dos passos do checklist escolhidos para a home como o destaque principal.
--                             Só vale em linha de categoria 'checklist' (check) e é no máximo um por pessoa (índice único parcial).
--                             Tirar o passo da home apaga a linha, e o destaque some junto.
--   2. crm_home_destacar()    admin: marca o passo como destaque (tira o anterior) ou, com null, limpa. 'item_invalido' se o passo não
--                             está na home. É atômica: se falha, o destaque anterior continua.
--   3. meu_caso()             a lista "home" devolve também 'destaque' (true/false). O app lê quando quiser; quem não lê não muda nada.
-- ATENÇÃO: este arquivo redefine meu_caso() (a versão de crm-caso-home.sql, com 'destaque' a mais). Se rodar crm-caso.sql, crm-caso-importar.sql,
-- crm-caso-listas.sql, crm-caso-arquivos.sql ou crm-caso-home.sql DEPOIS dele, rode este de novo.

-- ---------- 1. A coluna ----------
alter table public.caso_home add column if not exists destaque boolean not null default false;
alter table public.caso_home drop constraint if exists caso_home_destaque_check;
alter table public.caso_home add constraint caso_home_destaque_check check (not destaque or categoria = 'checklist');
create unique index if not exists caso_home_destaque_uni on public.caso_home (contato_id) where destaque;

-- ---------- 2. Marcar o destaque ----------
create or replace function public.crm_home_destacar(p_contato uuid, p_step_key text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update public.caso_home set destaque = false where contato_id = p_contato and destaque;
  if p_step_key is null then
    return;
  end if;
  update public.caso_home set destaque = true where contato_id = p_contato and categoria = 'checklist' and step_key = p_step_key;
  if not found then
    raise exception 'item_invalido';
  end if;
end;
$$;
revoke all on function public.crm_home_destacar(uuid, text) from public;
revoke all on function public.crm_home_destacar(uuid, text) from anon;
grant execute on function public.crm_home_destacar(uuid, text) to authenticated;

-- ---------- 3. O que a pessoa recebe: meu_caso() com o destaque na home ----------
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
      select jsonb_agg(jsonb_build_object('categoria', h.categoria, 'step_key', h.step_key, 'board_id', h.board_id, 'ordem', h.ordem, 'destaque', h.destaque) order by h.categoria, h.ordem, h.id)
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
