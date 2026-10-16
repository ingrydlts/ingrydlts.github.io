-- Em que formato cada e-mail saiu: 'html' (o template do Por Dentro) ou 'texto' (formato simples).
-- A ficha usa para mostrar o e-mail do jeito que chegou. Rodar no SQL Editor do Supabase; idempotente, só acrescenta.
-- Como desfazer: alter table public.emails_enviados drop column if exists formato;
alter table public.emails_enviados add column if not exists formato text
  check (formato is null or formato in ('html', 'texto'));
comment on column public.emails_enviados.formato is 'html = saiu com o template; texto = formato simples; vazio = antes de 16/10/2026 (manuais saíram em texto)';
