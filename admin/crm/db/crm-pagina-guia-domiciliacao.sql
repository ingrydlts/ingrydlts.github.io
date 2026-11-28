-- Por Dentro — CRM: as páginas I07, I08 e I09 (Guia Domiciliação) na classificação dos modelos de e-mail (28/11/2026)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-rota-da-secu.sql (que alarga a regra até I06) e de crm-guia-modelo-b0.sql.
-- Idempotente (pode rodar de novo). Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Por que existe: a landing "Guia Domiciliação" (/manual-destrave-domiciliacao/) tem três públicos com caminhos diferentes, e cada um
-- é uma linha da Jornada (admin/crm/taxonomia.js):
--   I07  modelo grátis (pediu a carta de mudança de endereço)    B0, B1, B2, B3
--   I08  lista de pré-venda do Manual 2                          C0, C1
--   I09  compradores do Manual                                   A0 a A5
-- modelos_email_pagina_check aceita só I01 a I06. Sem este arquivo o banco recusa as novas linhas.
--
-- O que muda:
--   1. modelos_email_pagina_check passa a aceitar I07, I08 e I09, além de I01 a I06. Nenhuma linha existente deixa de valer.
--   2. O e-mail B0 (guia_modelo_b0) vai para a página I07, só se ainda estiver sem página: o que ela já classificou à mão não é sobrescrito.
--
-- Segurança: nenhuma tabela nem função nova; as regras de acesso (RLS) de modelos_email não mudam. Nenhum dado de pessoa aqui.
--
-- Como desfazer (só depois de tirar I07 a I09 de quem as usa):
--   update public.modelos_email set pagina = null, etapa = null where pagina in ('I07', 'I08', 'I09');
--   alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
--   alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
--     or pagina in ('I01', 'I02', 'I03', 'I04', 'I05', 'I06'));

alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
  or pagina in ('I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'I09'));

update public.modelos_email set familia = coalesce(familia, 'entrega'), pagina = 'I07'
  where chave = 'guia_modelo_b0' and pagina is null;
