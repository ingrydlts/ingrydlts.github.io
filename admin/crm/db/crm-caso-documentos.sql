-- SELOS DOS DOCUMENTOS E PASSO "CONFERIR DOCUMENTOS": a equipe marca em cada documento o que ele exige (tradução juramentada, apostila de Haia,
-- equivalência do diploma, original), e um passo do checklist pode virar uma lista desses documentos com X/Y.
-- Rode DEPOIS de crm-caso.sql e crm-caso-guias.sql. Pode rodar de novo sem estragar nada.
--   1. documento.dados aceita "selos": lista de até 4 itens de { traducao, haia, equivaler, original }.
--   2. caso_acoes.botao aceita 'conferir_documentos' (com passo_chave "docs:<selo>", ex.: docs:traducao).
-- ATENÇÃO: este arquivo repete o corpo atual de caso_board_chaves_ok (com as chaves de bilan de crm-caso-guias.sql). Se esse corpo mudar
-- num SQL futuro, mude aqui também.

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
                              when 'documento' then array['rotulo', 'direcao', 'selos']
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
                           where jsonb_typeof(e) <> 'string' or (e #>> '{}') <> all (array['traducao', 'haia', 'equivaler', 'original']))));
$$;

alter table public.caso_acoes drop constraint if exists caso_acoes_botao_check;
alter table public.caso_acoes add constraint caso_acoes_botao_check
  check (botao is null or botao in ('gerar_rascunho', 'marcar_marco', 'copiar_mensagem', 'anexar_documento', 'pesquisar', 'confirmar', 'conferir_documentos'));
