-- Por Dentro — Estúdio de e-mails, entrega 3: modelo novo pelo objetivo e sequências
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-2.sql (e de crm-emails-formato.sql). Idempotente (pode rodar de novo).
-- Só acrescenta: colunas novas, duas funções, um índice e a visão crm_contatos com as mesmas colunas. Os 10 modelos de
-- hoje não mudam e não podem ganhar "Envio": o e-mail 1 e o e-mail 2 do guia continuam saindo pelo código, como hoje.
--
-- O que muda:
--   1. modelos_email ganha o que o estúdio precisa para criar um modelo novo:
--      criado_no_estudio  true só nos modelos criados pelo botão "Modelo novo" (os 10 de hoje ficam false, para sempre).
--      objetivo_chave     o objetivo do catálogo (freebie, boas_vindas, conversa, aquecimento, reimpacto, convite,
--                         lembrete, lancamento, compra). Ele já deu o tipo, o rodapé e o esqueleto de blocos.
--      para_quem          as regras de quem pode receber: { personas: [], materiais: [], produto, produto_nome,
--                         segmentos: [], estagios: [] }. Lista vazia = sem regra. produto = quem comprou aquele produto.
--      envio_*            a parte Envio: depois de quê (gatilho 'email' = depois de um e-mail; 'material' = depois de pegar
--                         um guia; 'compra' = depois de comprar um produto), quantos dias, em que hora de Brasília, e se
--                         está ligado. Um modelo com Envio sai sozinho (automatico = true); sem Envio, você envia pela ficha.
--   2. emails_enviados.sequencia: true nos e-mails que saíram por uma sequência. Um índice deixa só UM e-mail de cada
--      modelo de sequência por pessoa (duas rodadas juntas não mandam dois).
--   3. crm_registrar_compra(contato, produto): grava o evento 'compra' na linha do tempo (o botão "Registrar compra" da
--      ficha). É o que liga a sequência de compra. Uma compra do mesmo produto não é registrada duas vezes.
--   4. crm_sequencia_pendentes(): quem deve receber agora cada modelo de sequência. Só versão No ar, só Envio ligado,
--      só quem cumpre as regras de "Para quem", e o tipo novidades só para quem aceitou novidades (o consentimento mais
--      recente, conferido a cada rodada). Quem chama é o Worker, uma vez por hora (Cron Trigger "5 * * * *"), com a
--      service_role. Janela de 2 dias: quem passou do horário há mais tempo, ou antes de o Envio ser ligado, não recebe.
--   5. crm_contatos: o reimpacto (email_status, email_enviado_em, segmento) olha só os 8 modelos do link de acesso, como
--      hoje. Sem isto, um e-mail de sequência (ex.: o de compra) contaria como "último e-mail" e mudaria o segmento.
--
-- Segurança: só admin lê e muda os modelos e registra compra (RLS, como nas entregas 1 e 2). crm_sequencia_pendentes só
-- a service_role (o Worker). Nada de dado de pessoa aqui.
--
-- Como desfazer (nesta ordem; os e-mails que já saíram ficam no histórico):
--   1. Apague o Cron Trigger "5 * * * *" do Worker (para as sequências na hora).
--   2. drop function if exists public.crm_sequencia_pendentes(int, timestamptz);
--      drop function if exists public.crm_registrar_compra(uuid, text);
--      drop trigger if exists modelos_email_envio_confere on public.modelos_email;
--      drop function if exists public.modelos_email_envio_confere();
--      drop function if exists public.crm_lista(jsonb, text);
--      drop index if exists public.emails_um_por_sequencia_idx;
--   3. Rode de novo crm-fase1b-resposta.sql (volta a visão de antes).
--   4. Só depois de colar o Worker antigo: alter table public.emails_enviados drop column if exists sequencia;
--      e alter table public.modelos_email drop column if exists criado_no_estudio, drop column if exists objetivo_chave,
--      drop column if exists para_quem, drop column if exists envio_gatilho, drop column if exists envio_depois_de,
--      drop column if exists envio_dias, drop column if exists envio_hora, drop column if exists envio_ligado,
--      drop column if exists envio_ligado_em;   (apaga as regras dos modelos novos; os textos ficam)
--   Atenção: com esta migração no ar, se rodar crm-fase1b-resposta.sql (ou uma fase anterior) de novo, rode esta logo depois.

-- ---------- 1. Modelos: objetivo, para quem e envio ----------
alter table public.modelos_email add column if not exists criado_no_estudio boolean not null default false;
alter table public.modelos_email add column if not exists objetivo_chave text;
alter table public.modelos_email add column if not exists para_quem jsonb not null default '{}'::jsonb;
alter table public.modelos_email add column if not exists envio_gatilho text;
alter table public.modelos_email add column if not exists envio_depois_de text;
alter table public.modelos_email add column if not exists envio_dias int;
alter table public.modelos_email add column if not exists envio_hora int;
alter table public.modelos_email add column if not exists envio_ligado boolean not null default false;
alter table public.modelos_email add column if not exists envio_ligado_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_objetivo_chave_check') then
    alter table public.modelos_email add constraint modelos_email_objetivo_chave_check check (objetivo_chave is null or objetivo_chave in
      ('freebie', 'boas_vindas', 'conversa', 'aquecimento', 'reimpacto', 'convite', 'lembrete', 'lancamento', 'compra'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_para_quem_check') then
    alter table public.modelos_email add constraint modelos_email_para_quem_check
      check (jsonb_typeof(para_quem) = 'object' and pg_column_size(para_quem) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_envio_check') then
    alter table public.modelos_email add constraint modelos_email_envio_check check (
      (envio_gatilho is null or envio_gatilho in ('email', 'material', 'compra'))
      and (envio_depois_de is null or envio_depois_de ~ '^[a-z0-9][a-z0-9_-]{0,79}$')
      and (envio_dias is null or envio_dias between 0 and 120)
      and (envio_hora is null or envio_hora between 0 and 23)
      and (not envio_ligado or (envio_gatilho is not null and envio_depois_de is not null and envio_dias is not null and envio_hora is not null)));
  end if;
end $$;

-- Uma lista de texto dentro do para_quem (ex.: crm_lista(para_quem, 'personas')). Sem a chave, lista vazia.
create or replace function public.crm_lista(p jsonb, k text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(p -> k) = 'array' then p -> k else '[]'::jsonb end)), '{}'::text[])
$$;

-- As regras do Envio, conferidas no banco (o estúdio confere antes, mas o banco é quem garante):
--   os 10 modelos de hoje não ganham Envio nem regras; quem é criado no estúdio continua sendo;
--   um modelo com Envio sai sozinho; ligar (ou mudar o Envio ligado) anota a hora, e só conta o que vence depois dela.
create or replace function public.modelos_email_envio_confere() returns trigger
language plpgsql set search_path = public as $$
declare mudou boolean;
begin
  if tg_op = 'UPDATE' and new.criado_no_estudio is distinct from old.criado_no_estudio then
    raise exception 'Um modelo não muda de origem (criado no estúdio ou não).';
  end if;
  if not new.criado_no_estudio then
    if new.envio_gatilho is not null or new.envio_ligado or new.para_quem <> '{}'::jsonb or new.objetivo_chave is not null then
      raise exception 'O modelo % é um dos 10 de antes do estúdio: quem recebe e quando continuam no código. Crie um modelo novo para ter Envio.', new.chave;
    end if;
    return new;
  end if;
  new.automatico := new.envio_gatilho is not null;
  if new.envio_gatilho = 'email' and new.envio_depois_de is not null then
    if new.envio_depois_de = new.chave then raise exception 'Um modelo não pode sair depois dele mesmo.'; end if;
    if not exists (select 1 from modelos_email where chave = new.envio_depois_de) then
      raise exception 'O e-mail % não existe.', new.envio_depois_de;
    end if;
  end if;
  if new.envio_gatilho = 'compra' and new.envio_depois_de is not null and new.envio_depois_de is distinct from new.para_quem ->> 'produto' then
    raise exception 'Na sequência de compra, o produto do Envio é o mesmo de "Para quem".';
  end if;
  mudou := tg_op = 'INSERT' or new.envio_ligado is distinct from old.envio_ligado
    or new.envio_gatilho is distinct from old.envio_gatilho or new.envio_depois_de is distinct from old.envio_depois_de
    or new.envio_dias is distinct from old.envio_dias or new.envio_hora is distinct from old.envio_hora
    or new.para_quem is distinct from old.para_quem;
  if not new.envio_ligado then new.envio_ligado_em := null;
  elsif mudou then new.envio_ligado_em := now();
  end if;
  return new;
end $$;
drop trigger if exists modelos_email_envio_confere on public.modelos_email;
create trigger modelos_email_envio_confere before insert or update on public.modelos_email
  for each row execute function public.modelos_email_envio_confere();

-- ---------- 2. Um e-mail de cada sequência por pessoa ----------
alter table public.emails_enviados add column if not exists sequencia boolean not null default false;
create unique index if not exists emails_um_por_sequencia_idx on public.emails_enviados (contato_id, modelo) where sequencia;

-- ---------- 3. Registrar uma compra ----------
-- Roda com a permissão de quem chama: o RLS de eventos ("só admin") vale. A service_role (o Worker) também pode.
create or replace function public.crm_registrar_compra(p_contato uuid, p_produto text) returns jsonb
language plpgsql set search_path = public as $$
declare v_id bigint;
begin
  if p_produto is null or p_produto !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Produto inválido: %', p_produto; end if;
  if not exists (select 1 from contatos where id = p_contato) then raise exception 'Contato não encontrado.'; end if;
  select id into v_id from eventos where contato_id = p_contato and tipo = 'compra' and dados ->> 'produto' = p_produto limit 1;
  if v_id is not null then return jsonb_build_object('ok', true, 'ja', true); end if;
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'compra', jsonb_build_object('produto', p_produto)) returning id into v_id;
  return jsonb_build_object('ok', true, 'evento', v_id);
end $$;
revoke all on function public.crm_registrar_compra(uuid, text) from public, anon;
grant execute on function public.crm_registrar_compra(uuid, text) to authenticated, service_role;

-- ---------- 4. Quem recebe agora cada modelo de sequência ----------
-- Para cada modelo com Envio ligado e versão No ar: a data-base de cada pessoa (o 1º envio do e-mail anterior, a 1ª vez
-- que pegou o material ou a compra do produto) + N dias, na hora H de Brasília (nunca antes da data-base). Vence quando
-- essa hora chegou, há no máximo 2 dias e depois de o Envio ser ligado. p_agora existe para os testes.
create or replace function public.crm_sequencia_pendentes(p_limite int default 12, p_agora timestamptz default now())
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (
    select me.chave, me.tipo, me.para_quem, me.envio_gatilho, me.envio_depois_de, me.envio_dias, me.envio_hora,
           me.envio_ligado_em, v.versao
      from modelos_email me
      join modelos_email_versoes v on v.chave = me.chave and v.etapa = 'no_ar'
     where me.criado_no_estudio and me.envio_ligado and me.envio_gatilho is not null
  ),
  base as (
    select m.chave, e.contato_id, min(e.enviado_em) as quando
      from m join emails_enviados e on m.envio_gatilho = 'email' and e.modelo = m.envio_depois_de
     where e.enviado_em is not null and e.status <> 'nao_entregue'
     group by m.chave, e.contato_id
    union all
    select m.chave, ev.contato_id, min(ev.criado_em)
      from m join eventos ev
        on (m.envio_gatilho = 'material' and ev.tipo in ('email_capturado', 'email_recapturado') and ev.dados ->> 'origem' = m.envio_depois_de)
        or (m.envio_gatilho = 'compra' and ev.tipo = 'compra' and ev.dados ->> 'produto' = m.envio_depois_de)
     group by m.chave, ev.contato_id
  ),
  hora as (
    select b.chave, b.contato_id, b.quando,
           ((((b.quando at time zone 'America/Sao_Paulo')::date + m.envio_dias) + make_interval(hours => m.envio_hora))
             at time zone 'America/Sao_Paulo') as h
      from base b join m on m.chave = b.chave
  ),
  devido as (
    select chave, contato_id, case when h < quando then h + interval '1 day' else h end as devido_em from hora
  )
  select c.id, c.email, c.nome, m.chave, m.versao, m.tipo, c.aceita_novidades, d.devido_em,
         jsonb_strip_nulls(jsonb_build_object(
           'persona', c.persona,
           'respostas', jsonb_strip_nulls(jsonb_build_object('cfNivel', c.respostas -> 'cfNivel', 'objetivo', c.respostas -> 'objetivo',
                                                              'cfCidade', c.respostas -> 'cfCidade')),
           'prazo_limite', c.prazo_limite, 'dias_para_prazo', c.dias_para_prazo,
           'produto', m.para_quem ->> 'produto', 'produto_nome', m.para_quem ->> 'produto_nome'))
    from devido d
    join m on m.chave = d.chave
    join crm_contatos c on c.id = d.contato_id
   where d.devido_em <= p_agora
     and d.devido_em > greatest(p_agora - interval '2 days', m.envio_ligado_em)
     -- Consentimento: novidades só para quem aceitou (o mais recente). Serviço e compra são o que ela pediu ou comprou.
     and (m.tipo <> 'novidades' or c.aceita_novidades)
     -- Para quem
     and (cardinality(crm_lista(m.para_quem, 'personas')) = 0
          or c.persona = any (crm_lista(m.para_quem, 'personas')) or c.personas && crm_lista(m.para_quem, 'personas'))
     and (cardinality(crm_lista(m.para_quem, 'materiais')) = 0 or c.origens && crm_lista(m.para_quem, 'materiais'))
     and (coalesce(m.para_quem ->> 'produto', '') = ''
          or exists (select 1 from eventos x where x.contato_id = c.id and x.tipo = 'compra' and x.dados ->> 'produto' = m.para_quem ->> 'produto'))
     and (cardinality(crm_lista(m.para_quem, 'segmentos')) = 0 or c.segmento = any (crm_lista(m.para_quem, 'segmentos')))
     and (cardinality(crm_lista(m.para_quem, 'estagios')) = 0 or c.estagio = any (crm_lista(m.para_quem, 'estagios')))
     -- Ainda não recebeu este modelo
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = m.chave)
   order by d.devido_em, c.id
   limit greatest(1, least(coalesce(p_limite, 12), 100));
$$;
revoke all on function public.crm_sequencia_pendentes(int, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_sequencia_pendentes(int, timestamptz) to service_role;

-- ---------- 5. A visão que o painel lê (igual à da fase 1b; o reimpacto olha só os 8 modelos do link de acesso) ----------
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
  -- só os 8 modelos do link de acesso contam no reimpacto (como até a fase 1b): os e-mails dos guias (cf_guia_*),
  -- as suas respostas (resposta) e os modelos criados no estúdio (sequências e manuais novos) ficam fora
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id and e.modelo in ('boas_vindas', 'naoabriu', 'naoclicou', 'cliquenaoapp', 'parouapp',
                                               'guia_chamada', 'guia_plataforma', 'guia_alternancia')
   order by e.criado_em desc, e.id desc limit 1
) le on true
left join lateral (
  select r.id, r.recebido_em, r.canal, r.texto from respostas_email r
   where r.contato_id = c.id and r.status = 'nova' order by r.recebido_em limit 1
) ra on true;

revoke all on public.crm_contatos from anon;
