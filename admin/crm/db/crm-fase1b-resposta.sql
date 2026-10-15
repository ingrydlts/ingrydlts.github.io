-- Por Dentro — CRM fase 1b: aba Conversa na ficha e responder do CRM na mesma conversa do Gmail
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase1a-conversa.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: não apaga nem altera dado existente. Mesmas colunas na visão.
--
-- O que muda:
--   1. As respostas que você manda da aba Conversa ficam em emails_enviados com o modelo 'resposta'
--      (quem grava é o Worker, rota /api/crm/responder, com o seu token de admin). Não precisa de
--      coluna nova: o provedor_id é o Message-ID do Brevo, e o gatilho crm_respostas_ligar (fase 0)
--      já liga a próxima resposta dela a este envio pelo In-Reply-To.
--   2. crm_contatos: o e-mail 'resposta' não conta como "último e-mail" do reimpacto (email_status,
--      email_enviado_em e segmento falam do link de acesso ao app). Sem isto, responder alguém do CRM
--      a colocaria em "Não abriu o e-mail" três dias depois. O resto da visão é igual ao da fase 1a.
--
-- Como desfazer: rodar de novo crm-fase1a-conversa.sql (volta a visão da fase 1a; os e-mails 'resposta'
--   continuam no histórico). Atenção: se rodar crm-fase0 ou crm-fase1a de novo, rode esta logo depois.

-- ---------- A visão que o painel lê (igual à da fase 1a; só o reimpacto ignora as respostas) ----------
create or replace view public.crm_contatos with (security_invoker = true) as
select
  c.id, c.email, c.nome, c.persona, c.caminho as subpersona, c.fase, c.nivel_estudos,
  c.preocupacao, c.origem, c.respostas, c.estagio, c.score, c.user_id, c.nota,
  c.criado_em, c.atualizado_em, c.ultimo_evento_em,
  u.urgencia,
  case
    when ra.id is not null and ra.canal = 'toque' then 'respondeu o e-mail 2 com um toque (' || lower(regexp_replace(ra.texto, '^Cidade: ', '')) || ') em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when ra.id is not null and ra.canal = 'pagina' then 'escreveu na página da conversa em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when ra.id is not null then 'respondeu o seu e-mail em ' || to_char(ra.recebido_em at time zone 'Europe/Paris', 'DD/MM')
    when pz.dias_para_prazo between 1 and 60 then 'prazo do VLS-TS vence em ' || pz.dias_para_prazo || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo = 0 then 'prazo do VLS-TS vence hoje (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when pz.dias_para_prazo between -90 and -1 then 'prazo do VLS-TS venceu há ' || (-pz.dias_para_prazo) || ' dias (' || to_char(pz.prazo_limite, 'DD/MM/YYYY') || ')'
    when c.capturas >= 2 and c.ultima_captura_em > now() - interval '7 days'
      then 'voltou a deixar o e-mail em ' || to_char(c.ultima_captura_em at time zone 'Europe/Paris', 'DD/MM')
           || coalesce(' (' || c.ultima_origem || ')', '')
    when c.fase = 'urgente' then 'marcou urgência no funil'
    when c.fase = 'adaptando' and c.preocupacao = 'prazo' then 'já está na França e a preocupação é prazo'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parada há ' || d.dias || ' dias'
    when c.caminho = 'indefinido' then 'escolheu "Não sei ainda" no caminho'
  end as motivo,
  d.dias,
  (select p.id from perguntas_unicas p where p.contato_id = c.id and p.status = 'nova'
     order by p.criado_em limit 1) as pergunta_aberta_id,
  (select o.quando from um_a_um o where o.contato_id = c.id and o.status = 'agendado'
     order by o.quando nulls last limit 1) as um_a_um_quando,
  le.status as email_status,
  le.enviado_em as email_enviado_em,
  case
    when le.id is null or c.estagio in ('concluido', 'um_a_um') then null
    when le.status in ('agendado', 'nao_entregue') then null
    when c.estagio = 'lead' and le.status = 'entregue' and now() - le.enviado_em >= interval '3 days' then 'naoabriu'
    when c.estagio = 'lead' and le.status = 'aberto' and now() - le.enviado_em >= interval '3 days' then 'naoclicou'
    when c.estagio = 'lead' and le.status = 'clicado' then 'cliquenaoapp'
    when c.estagio in ('ativado', 'em_uso') and d.dias >= 7 then 'parouapp'
  end as segmento,
  coalesce((select cn.aceito from consentimentos cn where cn.contato_id = c.id and cn.finalidade = 'novidades_email'
              order by cn.criado_em desc, cn.id desc limit 1), false) as aceita_novidades,
  -- colunas novas SEMPRE no fim (create or replace view não deixa reordenar as antigas)
  c.data_entrada,
  pz.prazo_limite,
  pz.dias_para_prazo,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.utm_content,
  c.ig_id,
  c.instagram,
  c.capturas,
  c.origens,
  c.ultima_origem,
  c.ultima_captura_em,
  c.personas,
  ra.id as resposta_aberta_id
from contatos c
cross join lateral (
  select greatest(0, floor(extract(epoch from now() - coalesce(c.ultimo_evento_em, c.criado_em)) / 86400))::int as dias
) d
cross join lateral (
  -- Prazo do VLS-TS: entrada + 3 meses − 1 dia (mesma conta da calculadora do guia).
  -- dias_para_prazo negativo = já venceu.
  select
    case when c.data_entrada is not null then ((c.data_entrada + interval '3 months')::date - 1) end as prazo_limite,
    case when c.data_entrada is not null then (((c.data_entrada + interval '3 months')::date - 1) - current_date) end as dias_para_prazo
) pz
cross join lateral (
  -- Faixas do prazo (ajuste aqui): alta = vence em até 30 dias ou venceu há até 90;
  -- média = vence entre 31 e 60 dias. Passou disso (venceu há 90+ dias) não conta como prazo.
  select case
    when c.fase = 'urgente' or (c.fase = 'adaptando' and c.preocupacao = 'prazo')
      or pz.dias_para_prazo between -90 and 30 then 'alta'
    when c.fase = 'adaptando' or pz.dias_para_prazo between 31 and 60 then 'media'
    else 'baixa'
  end as urgencia
) u
left join lateral (
  -- os e-mails dos guias (cf_guia_*) e as suas respostas da aba Conversa (resposta) não são o do
  -- link de acesso: ficam fora do reimpacto
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id and e.modelo not like 'cf\_guia\_%' and e.modelo <> 'resposta'
   order by e.criado_em desc, e.id desc limit 1
) le on true
left join lateral (
  select r.id, r.recebido_em, r.canal, r.texto from respostas_email r
   where r.contato_id = c.id and r.status = 'nova' order by r.recebido_em limit 1
) ra on true;

revoke all on public.crm_contatos from anon;
