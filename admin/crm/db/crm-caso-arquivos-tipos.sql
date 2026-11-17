-- Por Dentro — Espaço: o bucket `casos-arquivos` passa a aceitar também imagem (PNG, JPG, WebP, GIF) e ZIP.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depende de crm-caso-arquivos.sql (que cria o bucket). Idempotente.
-- Só muda a lista de tipos aceitos: continua privado, 10 MB por arquivo, e as políticas (admin grava; a dona lê só o item publicado) não mudam.
-- Não cria tabela nem função: db/conferir-banco.sql e db/auditoria-isolamento.sql (do app) seguem iguais.

update storage.buckets
   set public = false,
       file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf', 'text/markdown', 'text/plain',
                                  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
                                  'application/zip', 'application/x-zip-compressed']
 where id = 'casos-arquivos';
