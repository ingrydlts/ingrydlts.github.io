-- Por Dentro — Espaço: arquivo (PDF ou MD) e descrição longa nos documentos que a equipe manda.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app).
-- Depende de crm-caso-listas.sql (meu_caso). Idempotente.
--
--   1. board_itens.descricao   texto longo (até 8000 caracteres): ex.: um modelo de e-mail para copiar.
--   2. Bucket privado `casos-arquivos` (PDF, MD, texto; até 10 MB). O caminho é <contato_id>/<arquivo>.
--   3. Quem lê o arquivo: só a dona do caso e só de item PUBLICADO (função caso_arquivo_dela). A equipe (admin) lê e grava tudo.
--      O Storage não vê board_itens por causa da RLS (só admin), por isso a conferência fica numa função security definer.
--   4. meu_caso() passa a devolver `descricao` e `arquivo` (o caminho, que só serve a quem a política acima libera).
--
-- Link do Notion (público ou privado) continua no campo `link` (https): não precisa de nada novo.

alter table public.board_itens add column if not exists descricao text;
alter table public.board_itens drop constraint if exists board_itens_descricao_tam;
alter table public.board_itens add constraint board_itens_descricao_tam check (descricao is null or length(descricao) <= 8000);

-- ---------- Bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('casos-arquivos', 'casos-arquivos', false, 10485760, array['application/pdf', 'text/markdown', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'text/markdown', 'text/plain'];

-- ---------- A dona do caso pode abrir o arquivo do item publicado ----------
create or replace function public.caso_arquivo_dela(p_nome text) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.board_itens b
     where b.arquivo_caminho = p_nome and b.estado = 'publicado'
       and b.contato_id = public.meu_contato_id() and public.meu_contato_id() is not null
  );
$$;
revoke all on function public.caso_arquivo_dela(text) from public;
revoke all on function public.caso_arquivo_dela(text) from anon;
grant execute on function public.caso_arquivo_dela(text) to authenticated;

drop policy if exists "casos-arquivos: admin" on storage.objects;
create policy "casos-arquivos: admin" on storage.objects for all to authenticated
  using (bucket_id = 'casos-arquivos' and public.eh_admin())
  with check (bucket_id = 'casos-arquivos' and public.eh_admin());

drop policy if exists "casos-arquivos: dona do publicado" on storage.objects;
create policy "casos-arquivos: dona do publicado" on storage.objects for select to authenticated
  using (bucket_id = 'casos-arquivos' and public.caso_arquivo_dela(name));

-- ---------- O que a pessoa recebe: meu_caso() com descricao e arquivo ----------
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
