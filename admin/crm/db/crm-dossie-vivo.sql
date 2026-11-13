-- Por Dentro — CRM: a aba Dossiê se atualiza sozinha quando a pessoa responde (funil ou app)
-- Rode no SQL Editor do Supabase (primeiro no de teste, depois no de produção). Idempotente e só acrescenta.
--
-- A ficha escuta a linha da pessoa em `contatos` (Realtime) para repintar o Dossiê quando `dossie` ou `respostas` mudam.
-- Sem esta publicação a ficha continua funcionando: o Dossiê só se atualiza no próximo evento da ficha (ou ao reabri-la).
-- Não cria tabela nem função; o Realtime respeita a RLS de `contatos` (só o admin lê).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contatos') then
      execute 'alter publication supabase_realtime add table public.contatos';
    end if;
  end if;
end $$;
