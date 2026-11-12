-- GUIAS DA PESSOA: vários bilans (um por conversa), documentos que a equipe manda e mensagens prontas, cada um com o seu "o que é".
-- Rode DEPOIS de crm-caso.sql (e crm-caso-importar.sql). Pode rodar de novo sem estragar nada.
--
-- O que muda: caso_board_chaves_ok() passa a conferir e aceitar mais campos nos itens do board, para o app mostrar cada coisa em seu
-- dropdown, sem poluir a tela:
--   bilan      secoes (o que já existia) + data (dia da conversa, AAAA-MM-DD) + palavras (até 6 palavras-chave para ela se lembrar da conversa)
--   modelo     idioma, assunto, corpo, traducao (o que já existia). "O que é" vai em board_itens.resumo (até 240 letras).
--   documento  rotulo, direcao (o que já existia). "O que é" também em resumo; o arquivo é o link (https).
-- O resto (escola, marco, e o que a pessoa preenche em dados_dela) fica como estava.

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
                              when 'documento' then array['rotulo', 'direcao']
                              when 'marco' then array['data', 'a_confirmar', 'nota']
                              when 'bilan' then array['secoes', 'data', 'palavras']
                              else array[]::text[] end)
          end))
     -- bilan: a data é um dia e as palavras-chave são poucas e curtas
     and (not (p_dados ? 'data') or p_tipo <> 'bilan' or (jsonb_typeof(p_dados->'data') = 'string' and p_dados->>'data' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
     and (not (p_dados ? 'palavras') or p_tipo <> 'bilan' or (
           jsonb_typeof(p_dados->'palavras') = 'array' and jsonb_array_length(p_dados->'palavras') <= 6
           and not exists (select 1 from jsonb_array_elements(p_dados->'palavras') e
                            where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and 30)));
$$;
