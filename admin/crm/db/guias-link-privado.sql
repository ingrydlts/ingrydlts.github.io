-- Por Dentro — guias gratuitos: o link do Notion só sai depois do cadastro
-- Rode no SQL Editor do Supabase, DEPOIS de crm-origem-campanha.sql. Idempotente (pode rodar
-- de novo). Não apaga nem altera dado existente e NÃO muda a capturar_lead.
--
-- Por quê: o link do Notion de cada guia ficava em content/guias.json, que é público (qualquer
-- um abria o arquivo e pegava o link sem se cadastrar). Agora ele mora aqui, numa tabela que
-- o navegador não lê, e só volta para quem acabou de enviar o formulário do guia.
--
-- O que muda:
--   1. Tabela guias_links (slug, notion_url, notion_texto). Só admin lê e edita (RLS).
--      Para trocar um link: Supabase → Table Editor → guias_links → editar a linha.
--   2. Função capturar_lead_guia(payload): chama a capturar_lead de sempre (mesmas regras,
--      mesmo registro no CRM) e, se o cadastro passou, devolve o link do guia de
--      payload.guia. Se o cadastro falhar (e-mail inválido, sem consentimento), dá o mesmo
--      erro da capturar_lead e não devolve link nenhum.
--
-- Limite (combinado em 2026-10-12): quem recebe o link ainda pode repassá-lo, porque a
-- página do Notion publicada na web abre para qualquer um que tenha o endereço.
--
-- Como desfazer: drop function public.capturar_lead_guia(jsonb); drop table public.guias_links;
-- e devolver os notionUrl ao content/guias.json.

create table if not exists public.guias_links (
  slug text primary key,
  notion_url text not null check (notion_url ~ '^https://'),
  notion_texto text,
  atualizado_em timestamptz not null default now()
);

alter table public.guias_links enable row level security;
revoke all on public.guias_links from anon;

drop policy if exists "guias_links: só admin" on public.guias_links;
create policy "guias_links: só admin" on public.guias_links
  for all using (public.eh_admin()) with check (public.eh_admin());

-- Links de hoje (só entram se a linha ainda não existir: não sobrescreve o que você editou).
insert into public.guias_links (slug, notion_url, notion_texto) values
  ('vls-ts-validacao-travou', 'https://topordentroviagens.notion.site/Manual-o-que-fazer-quando-a-valida-o-do-VLS-TS-estudante-trava-Fran-a-3ebd602254ce80b6af68cad9f77a0bb5', 'Abrir o guia no Notion'),
  ('email-alternancia-30-mais', 'https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-altern-ncia-depois-dos-30-em-franc-s-3f5d602254ce81b79bf7e4fc87425de8', 'Abrir o modelo no Notion'),
  ('etudes-en-france-2027-2028', 'https://topordentroviagens.notion.site/Checklist-tudes-en-France-2027-2028-3f7d602254ce81008570d29c9410465f', 'Abrir o checklist no Notion')
on conflict (slug) do nothing;

create or replace function public.capturar_lead_guia(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
  v_link record;
begin
  -- Mesmo cadastro de sempre; se falhar, o erro sobe e nada de link.
  v_res := public.capturar_lead(payload);

  select notion_url, notion_texto into v_link
    from guias_links where slug = left(coalesce(payload->>'guia', ''), 80);

  return v_res || jsonb_strip_nulls(jsonb_build_object(
    'notion_url', v_link.notion_url,
    'notion_texto', v_link.notion_texto));
end;
$$;
revoke all on function public.capturar_lead_guia(jsonb) from public;
grant execute on function public.capturar_lead_guia(jsonb) to anon, authenticated;
