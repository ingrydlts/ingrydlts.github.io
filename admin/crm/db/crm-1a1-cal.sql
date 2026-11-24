-- O 1:1 MARCADO NO CAL.COM ENTRA NO CRM: guarda o código da reserva do Cal.com na linha de um_a_um.
-- Rode DEPOIS de crm-fase2.sql (que cria um_a_um). Pode rodar de novo sem estragar nada.
--
--   1. um_a_um.cal_uid   o código (uid) da reserva no Cal.com. Quem grava é o Worker (POST /api/cal/webhook), com a chave de serviço.
--                        Vazio nos 1:1 marcados na mão (botão "Marcar 1:1") ou pagos no Stripe.
--   2. índice único      uma reserva do Cal.com, uma linha: o Cal.com reenviando o mesmo aviso não duplica, e remarcar ou cancelar acha a
--                        linha certa. Linhas sem cal_uid não contam (o Postgres trata cada vazio como diferente).
--   3. limite de tamanho 1 a 100 caracteres.
--
-- Não cria tabela nem função nova. A tabela um_a_um continua com RLS "só admin" e sem acesso para anon; nenhuma política mudou.
-- O gatilho crm_um_a_um_evento (crm-fase2.sql) já cuida do resto no insert: evento "1:1 marcado" na Jornada e estágio 'um_a_um'.

alter table public.um_a_um add column if not exists cal_uid text;
alter table public.um_a_um drop constraint if exists um_a_um_cal_uid_check;
alter table public.um_a_um add constraint um_a_um_cal_uid_check check (cal_uid is null or length(cal_uid) between 1 and 100);
create unique index if not exists um_a_um_cal_uid_uniq on public.um_a_um (cal_uid);
