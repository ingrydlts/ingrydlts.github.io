-- CHECKLISTS DOS DOCUMENTOS: o app mostra cada documento no(s) démarche(s) (checklist) onde ele aparece; a equipe liga o documento a eles.
-- Rode DEPOIS de crm-caso.sql, crm-caso-guias.sql e crm-caso-documentos.sql. Pode rodar de novo sem estragar nada.
--   documento.dados aceita "checklists": lista de até 8 chaves de démarche (letras minúsculas, números e _), ex.: ["visa", "visa_estudante"].
--   Lista vazia ou ausente = o documento vale só para o démarche principal da pessoa. Quem já tinha dados continua valendo: só entra uma chave a mais.
-- Muda só o corpo de caso_board_chaves_ok (as tabelas, os grants e as políticas ficam como estão): é a função que as duas conferências
-- da tabela board_itens (dados e dados_dela) já chamam.
-- ATENÇÃO: este arquivo repete o corpo atual de caso_board_chaves_ok (com bilan de crm-caso-guias.sql e selos de crm-caso-documentos.sql).
-- Se esse corpo mudar num SQL futuro, mude aqui também.

create or replace function public.caso_board_chaves_ok(p_tipo text, p_dados jsonb, p_dela boolean) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p_dados is not null and jsonb_typeof(p_dados) = 'object'
     and not exists (
       select 1 from jsonb_object_keys(p_dados) k
        where k <> all (
          case when p_dela then
                 (case p_tipo when 'escola' then array['criterios', 'meses', 'custo_eur']
                              when 'documento' then array['reunido']
                              else array[]::text[] end)
               else
                 (case p_tipo when 'escola' then array['cidade', 'curso', 'link', 'custo_eur', 'meses_sugeridos']
                              when 'modelo' then array['idioma', 'assunto', 'corpo', 'traducao']
                              when 'documento' then array['rotulo', 'direcao', 'selos', 'checklists']
                              when 'marco' then array['data', 'a_confirmar', 'nota']
                              when 'bilan' then array['secoes', 'data', 'palavras']
                              else array[]::text[] end)
          end))
     -- bilan (de crm-caso-guias.sql): a data é um dia e as palavras-chave são poucas e curtas
     and (not (p_dados ? 'data') or p_tipo <> 'bilan' or (jsonb_typeof(p_dados->'data') = 'string' and p_dados->>'data' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
     and (not (p_dados ? 'palavras') or p_tipo <> 'bilan' or (
           jsonb_typeof(p_dados->'palavras') = 'array' and jsonb_array_length(p_dados->'palavras') <= 6
           and not exists (select 1 from jsonb_array_elements(p_dados->'palavras') e
                            where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and 30)))
     -- documento: selos
     and (not (p_dados ? 'selos') or (p_tipo = 'documento' and not p_dela and jsonb_typeof(p_dados->'selos') = 'array'
          and jsonb_array_length(p_dados->'selos') <= 4
          and not exists (select 1 from jsonb_array_elements(p_dados->'selos') e
                           where jsonb_typeof(e) <> 'string' or (e #>> '{}') <> all (array['traducao', 'haia', 'equivaler', 'original']))))
     -- documento: checklists (de crm-caso-checklists.sql): os démarches onde o documento aparece; lista curta de chaves como "visa" ou "visa_estudante"
     and (not (p_dados ? 'checklists') or (p_tipo = 'documento' and not p_dela and jsonb_typeof(p_dados->'checklists') = 'array'
          and jsonb_array_length(p_dados->'checklists') <= 8
          and not exists (select 1 from jsonb_array_elements(p_dados->'checklists') e
                           where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^[a-z0-9_]{1,40}$')));
$$;
