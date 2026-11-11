-- Por Dentro — CRM: a página I05 (Au pair · checklist de chegada) na classificação dos modelos de e-mail
-- Rode no SQL Editor do Supabase, DEPOIS de crm-taxonomia-modelos.sql. Idempotente (pode rodar de novo).
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Por que existe: crm-taxonomia-modelos.sql criou a regra "pagina in (I01 a I04)". O guia do Au pair virou a página I05
-- (admin/crm/taxonomia.js e estudio.js). Sem este arquivo, escolher "I05 · Au pair" em "Onde este e-mail mora" é recusado
-- pelo banco. Quem rodar crm-taxonomia-modelos.sql pela primeira vez, na versão nova, já recebe a I05 e não precisa deste.
--
-- O que muda:
--   1. modelos_email_pagina_check passa a aceitar I05, além de I01 a I04. Nenhuma linha existente deixa de valer.
--   2. Os dois e-mails do guia do Au pair (aupair_chegada_1 e aupair_chegada_2) vão para a página I05, mas só se a página
--      deles ainda estiver vazia: o que ela já classificou à mão não é sobrescrito.
--
-- Segurança: nenhuma tabela nem função nova; as regras de acesso (RLS) de modelos_email não mudam. Nenhum dado de pessoa aqui.
--
-- Como desfazer (só depois de tirar a I05 de quem a usa):
--   update public.modelos_email set pagina = null, etapa = null where pagina = 'I05';
--   alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
--   alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
--     or pagina in ('I01', 'I02', 'I03', 'I04'));

alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
  or pagina in ('I01', 'I02', 'I03', 'I04', 'I05'));

update public.modelos_email set pagina = 'I05'
  where chave in ('aupair_chegada_1', 'aupair_chegada_2') and pagina is null;
