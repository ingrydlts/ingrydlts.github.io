-- Registro dos 1:1 (Dossiê · visão geral): o que ficou combinado em cada 1:1.
-- Guarda, num JSON por 1:1: a página de origem (I01 a I05), o roteiro de perguntas, as identificadas, a conclusão,
-- o encaminhamento, o interesse em converter e se o link do produto foi enviado.
-- Sem tabela nova: só uma coluna em um_a_um, que já tem RLS só para admin (db/crm-fase2.sql). Idempotente.
-- Sem esta coluna, o CRM carrega os 1:1 sem o registro e "Salvar registro" avisa para rodar este arquivo.
alter table public.um_a_um add column if not exists registro jsonb;
