-- Por Dentro — Estúdio de e-mails: limpar os modelos antigos para redesenhar do zero (14/11/2026)
-- Rode no SQL Editor do Supabase (primeiro o de teste, depois o de produção). Idempotente (pode rodar de novo).
--
-- O que faz: EXCLUI (no estúdio, o "X": modelos_email.excluido_em) todo modelo de e-mail que nunca foi enviado a ninguém.
-- Excluir esconde o modelo e desliga o Envio; as versões e o texto ficam guardados, dá para restaurar (veja "Como desfazer").
--
-- Fica de fora, de propósito:
--   1. Todo modelo que já tem pelo menos um envio em emails_enviados. Assim o histórico (quem recebeu, abriu, clicou) continua
--      ligado ao modelo e nada é reenviado.
--   2. cf_guia_%: os e-mails do guia Campus France saem pelo código do Worker; o banco recusa excluí-los.
--   3. link_pagamento e acesso_confirmado: o Worker recusa enviar um modelo excluído, e esses dois são o link de pagamento do
--      1:1 e o aviso de acesso. Excluir quebraria o envio deles. Se quiser redesenhá-los, faça no estúdio.
--
-- Segurança: só mexe em modelos_email (texto de modelo). Nenhum dado de pessoa, nenhuma tabela ou função nova.
--
-- Como desfazer (restaura exatamente o que este arquivo excluiu; o Envio não volta ligado, você liga de novo no estúdio):
--   update public.modelos_email set excluido_em = null where excluido_em = timestamptz '2026-11-14 12:00:00+00';

-- 1) Confira antes: o que vai ser excluído (nunca enviado) e o que fica (já enviado ou protegido).
select m.chave, m.nome,
       case when m.excluido_em is not null then 'já excluído'
            when exists (select 1 from public.emails_enviados e where e.modelo = m.chave) then 'FICA: já foi enviado'
            when m.chave like 'cf\_guia\_%' or m.chave in ('link_pagamento', 'acesso_confirmado') then 'FICA: protegido'
            else 'SERÁ EXCLUÍDO' end as destino,
       (select count(*) from public.emails_enviados e where e.modelo = m.chave) as enviados
  from public.modelos_email m
 order by destino, m.chave;

-- 2) Exclui.
update public.modelos_email m
   set excluido_em = timestamptz '2026-11-14 12:00:00+00'
 where m.excluido_em is null
   and m.chave not like 'cf\_guia\_%'
   and m.chave not in ('link_pagamento', 'acesso_confirmado')
   and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);
