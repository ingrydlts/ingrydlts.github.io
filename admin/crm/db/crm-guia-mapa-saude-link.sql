-- Por Dentro — guia "Mapa da saúde na França": registra o link público do Notion (17/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de guias-link-privado.sql. Idempotente. Rode primeiro no TESTE, depois na produção.
--
-- ANTES de rodar: publique o mapa na web no Notion ("Publicar" > "Compartilhar na web") e cole o endereço notion.site abaixo.
-- O script para com um aviso enquanto o endereço for o de exemplo ou não for um https válido.
--
-- Segurança: só uma linha de configuração (a tabela guias_links é só do admin). Nenhum dado de pessoa.
-- Como desfazer: delete from public.guias_links where slug = 'mapa-saude-franca';

do $$
declare
  v_url text := 'COLE-AQUI-O-ENDERECO-NOTION-SITE';
begin
  if v_url !~ '^https://[^ ]+\.[^ ]+' then
    raise exception 'Cole antes o endereço público (https) do mapa no Notion, na linha v_url deste arquivo.';
  end if;
  insert into public.guias_links (slug, notion_url, notion_texto)
  values ('mapa-saude-franca', v_url, 'Abrir o mapa no Notion')
  on conflict (slug) do update set notion_url = excluded.notion_url, notion_texto = excluded.notion_texto, atualizado_em = now();
end
$$;
