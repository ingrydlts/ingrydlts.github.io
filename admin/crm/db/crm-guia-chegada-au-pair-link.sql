-- Por Dentro — guia "Checklist de chegada da au pair": registra o link público do Notion (08/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de guias-link-privado.sql. Idempotente. Rode primeiro no TESTE, depois na produção.
--
-- Antes de rodar: no Notion, abra o checklist, Share > Publish to web, copie o endereço (notion.site) e cole abaixo no lugar de
-- COLE-AQUI. Sem isso o script para com um aviso e não grava nada: a página do guia só mostra o link depois do cadastro, e um link
-- privado do Notion (app.notion.com) não abre para quem não é do seu workspace.
--
-- Segurança: só uma linha de configuração (a tabela guias_links é só do admin). Nenhum dado de pessoa.
-- Como desfazer: delete from public.guias_links where slug = 'checklist-chegada-au-pair';

do $$
declare
  v_url text := 'https://COLE-AQUI';
begin
  if v_url !~ '^https://[^ ]+\.[^ ]+' or v_url like '%COLE-AQUI%' then
    raise exception 'Troque COLE-AQUI pelo endereço público do Notion (Share > Publish to web) e rode de novo.';
  end if;
  insert into public.guias_links (slug, notion_url, notion_texto)
  values ('checklist-chegada-au-pair', v_url, 'Abrir o checklist no Notion')
  on conflict (slug) do update set notion_url = excluded.notion_url, notion_texto = excluded.notion_texto, atualizado_em = now();
end
$$;
