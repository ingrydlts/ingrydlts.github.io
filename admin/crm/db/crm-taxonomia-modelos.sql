-- Por Dentro — CRM: classificação dos modelos de e-mail (família, página, etapa e persona)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql (e de crm-acesso-email.sql, crm-link-pagamento-email.sql
-- e crm-modelos-chegada-au-pair.sql, que criam modelos que este arquivo classifica). Idempotente (pode rodar de novo).
-- Só acrescenta: quatro colunas, as regras delas e o preenchimento dos modelos que já existem. Nada é apagado nem reescrito.
--
-- O que muda:
--   1. modelos_email.familia, .pagina, .etapa e .persona (todas podem ficar vazias).
--        familia: entrega, personalizado, aquecimento, serie, compra, acesso, reimpacto ou campanha
--        pagina:  I01 a I04 (as páginas do site: Alternância 30+, Tecnólogo, Études en France, VLS-TS)
--        etapa:   o código da etapa marcada no guia (ex.: tec-nao-sei); só existe junto de uma página
--        persona: au_pair, pvt, estudante ou conjuge
--   2. Preenchimento: cada modelo de hoje recebe família, página e persona pela mesma tabela que o painel usa quando este SQL
--      ainda não rodou (modo de reserva de admin/crm/taxonomia.js, seção 4 da spec). Só preenche o que está vazio: o que ela
--      já classificou à mão não é sobrescrito, e rodar de novo não muda nada.
--
-- Segurança: nenhuma tabela nem função nova; as regras de acesso (RLS) de modelos_email não mudam. O gatilho
-- modelos_email_envio_confere continua igual: classificar um modelo de antes do estúdio não é "Envio", então não é recusado.
-- Nenhum dado de pessoa aqui.
--
-- Como desfazer:
--   alter table public.modelos_email drop column if exists familia, drop column if exists pagina,
--     drop column if exists etapa, drop column if exists persona;
--   (as regras caem junto com as colunas)

alter table public.modelos_email add column if not exists familia text;
alter table public.modelos_email add column if not exists pagina text;
alter table public.modelos_email add column if not exists etapa text;
alter table public.modelos_email add column if not exists persona text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_familia_check') then
    alter table public.modelos_email add constraint modelos_email_familia_check check (familia is null
      or familia in ('entrega', 'personalizado', 'aquecimento', 'serie', 'compra', 'acesso', 'reimpacto', 'campanha'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_pagina_check') then
    alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
      or pagina in ('I01', 'I02', 'I03', 'I04'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_persona_check') then
    alter table public.modelos_email add constraint modelos_email_persona_check check (persona is null
      or persona in ('au_pair', 'pvt', 'estudante', 'conjuge'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_etapa_check') then
    alter table public.modelos_email add constraint modelos_email_etapa_check check (etapa is null
      or (pagina is not null and etapa ~ '^[a-z0-9-]{2,40}$'));
  end if;
end $$;

-- Preenchimento: chaves exatas (a tabela da seção 4 da spec; o mesmo que RESERVA_CHAVE em taxonomia.js).
update public.modelos_email m set
  familia = coalesce(m.familia, x.familia),
  pagina = coalesce(m.pagina, x.pagina),
  persona = coalesce(m.persona, x.persona)
from (values
  ('boas_vindas', 'acesso', null, null),
  ('hub_estudos_compra', 'compra', null, null),
  ('hub_estudos_d3', 'compra', null, null),
  ('naoabriu', 'reimpacto', null, null),
  ('naoclicou', 'reimpacto', null, null),
  ('cliquenaoapp', 'reimpacto', null, null),
  ('parouapp', 'reimpacto', null, null),
  ('cf_guia_1', 'entrega', 'I03', null),
  ('cf_guia_conversa', 'entrega', 'I03', null),
  ('guia_alternancia', 'entrega', 'I01', null),
  ('guia_chamada', 'entrega', 'I04', null),
  ('guia_plataforma', 'entrega', 'I04', null),
  ('tec_recap_30min', 'entrega', 'I02', null),
  ('aupair_chegada_1', 'entrega', null, 'au_pair'),
  ('aupair_chegada_2', 'entrega', null, 'au_pair'),
  ('hub_estudos_lancamento', 'campanha', null, null),
  ('lembrete_prazo_vlsts', 'campanha', null, null)
) as x(chave, familia, pagina, persona)
where m.chave = x.chave;

-- Preenchimento: por prefixo (RESERVA_PREFIXO em taxonomia.js). Só onde a família ainda está vazia.
update public.modelos_email set familia = 'acesso' where familia is null and chave like 'acesso\_%';
update public.modelos_email set familia = 'compra' where familia is null and chave like 'link\_pagamento%';
update public.modelos_email set familia = 'entrega', pagina = coalesce(pagina, 'I03') where familia is null and chave like 'cf\_guia\_%';
update public.modelos_email set familia = 'aquecimento', pagina = coalesce(pagina, 'I03') where familia is null and chave like 'aq\_%';

-- Preenchimento: o que é do tipo compra e ainda não tem família.
update public.modelos_email set familia = 'compra' where familia is null and tipo = 'compra';
