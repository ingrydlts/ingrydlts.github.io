-- Por Dentro — CRM: o registro de cada 1:1 (perguntas do roteiro, o que foi identificado, conclusão e encaminhamento)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql. Pode rodar de novo (idempotente).
-- Rode primeiro no Supabase de TESTE, depois no de produção (docs/AMBIENTES.md do app). Depois de rodar, nos dois: db/auditoria-isolamento.sql
-- e db/conferir-banco.sql do app (os dois vazios = pronto).
--
-- O que muda: a tabela um_a_um ganha UMA coluna, registro (jsonb, pode ficar vazio). Ela guarda, para cada 1:1:
--   { origem: "I05", perguntas: [{k, l}], identificadas: ["cidade", ...], conclusao, encaminhamento, interesse: "sim|talvez|nao",
--     link_enviado: true|false, link_enviado_em, atualizado_em }
-- Nenhuma tabela nova, nenhum dado mexido. A permissão é a de antes: só admin lê e muda (política "um_a_um: só admin"); anon sem acesso.
-- Um limite de tamanho (20 mil bytes) e a exigência de ser um objeto evitam lixo na coluna.
--
-- Sem este arquivo, o bloco "Registro dos 1:1" do Dossiê aparece (com o roteiro de agora) mas não consegue salvar.
--
-- Como desfazer:
--   alter table public.um_a_um drop constraint if exists um_a_um_registro_check;
--   alter table public.um_a_um drop column if exists registro;

alter table public.um_a_um add column if not exists registro jsonb;

alter table public.um_a_um drop constraint if exists um_a_um_registro_check;
alter table public.um_a_um add constraint um_a_um_registro_check
  check (registro is null or (jsonb_typeof(registro) = 'object' and pg_column_size(registro) <= 20000));
