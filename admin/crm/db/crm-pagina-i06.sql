-- Por Dentro — CRM: a página I06 (Saúde · mapa da saúde na França) na classificação dos modelos de e-mail (17/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-pagina-i05.sql e de crm-modelos-mapa-saude.sql. Idempotente (pode rodar de novo).
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Por que existe: modelos_email_pagina_check aceita só I01 a I05. O guia do Mapa da saúde virou a página I06
-- (admin/crm/taxonomia.js). Sem este arquivo, o banco recusa a I06 e os dois e-mails novos não aparecem na linha dela da Jornada.
--
-- O que muda:
--   1. modelos_email_pagina_check passa a aceitar I06, além de I01 a I05. Nenhuma linha existente deixa de valer.
--   2. Os dois e-mails do guia (saude_mapa_1 e saude_mapa_2) vão para a família "Entrega do material" e a página I06,
--      mas só se ainda estiverem vazios: o que ela já classificou à mão não é sobrescrito.
--
-- Segurança: nenhuma tabela nem função nova; as regras de acesso (RLS) de modelos_email não mudam. Nenhum dado de pessoa aqui.
--
-- Como desfazer (só depois de tirar a I06 de quem a usa):
--   update public.modelos_email set pagina = null, etapa = null where pagina = 'I06';
--   alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
--   alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
--     or pagina in ('I01', 'I02', 'I03', 'I04', 'I05'));

alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
  or pagina in ('I01', 'I02', 'I03', 'I04', 'I05', 'I06'));

update public.modelos_email set familia = coalesce(familia, 'entrega'), pagina = 'I06'
  where chave in ('saude_mapa_1', 'saude_mapa_2') and pagina is null;
