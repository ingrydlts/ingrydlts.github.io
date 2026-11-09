-- Por Dentro — guia "Checklist de chegada da au pair": registra o link público do Notion (08/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de guias-link-privado.sql. Idempotente. Rode primeiro no TESTE, depois na produção.
--
-- O endereço é o do checklist publicado na web no Notion (notion.site). Se um dia trocar, edite o endereço abaixo e rode de novo.
-- O script para com um aviso se o endereço não for um https válido.
--
-- Segurança: só uma linha de configuração (a tabela guias_links é só do admin). Nenhum dado de pessoa.
-- Como desfazer: delete from public.guias_links where slug = 'checklist-chegada-au-pair';

do $$
declare
  v_url text := 'https://topordentroviagens.notion.site/Checklist-de-chegada-da-au-pair-o-que-fazer-e-em-que-ordem-412d602254ce812cb2cbd1f135b623c4';
begin
  if v_url !~ '^https://[^ ]+\.[^ ]+' then
    raise exception 'O endereço do checklist não é um https válido.';
  end if;
  insert into public.guias_links (slug, notion_url, notion_texto)
  values ('checklist-chegada-au-pair', v_url, 'Abrir o checklist no Notion')
  on conflict (slug) do update set notion_url = excluded.notion_url, notion_texto = excluded.notion_texto, atualizado_em = now();
end
$$;
