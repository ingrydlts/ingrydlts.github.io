-- Por Dentro — CRM, fase 2: o que o painel (/admin/crm/) precisa pra funcionar de verdade
-- Rode no SQL Editor do Supabase, DEPOIS de db/crm-fase1.sql, crm-fase1b-minha-ficha.sql e
-- caminhos-opcoes.sql (vivem no repositório POR-DENTRO-APP). Idempotente e só acrescenta:
-- não apaga nem reescreve dado nenhum.
--
-- O que entra:
--   perguntas_unicas   caixa de entrada das dúvidas vindas da tela de artigos
--   um_a_um            conversas marcadas
--   sinais             avisos que aparecem dentro do dashboard da pessoa
--   emails_enviados    histórico de e-mails (envio real e status de entrega = fase 3)
--   crm_contatos       a visão que o painel lê: contato + urgência, motivo, dias parado,
--                      subpersona, situação do último e-mail e segmento de reimpacto
--   gatilhos           estágio e linha do tempo se mantêm sozinhos
--
-- Quem lê e escreve o quê (mesma regra da fase 1):
--   site público (anon)  → só chama enviar_pergunta_unica()
--   pessoa logada        → registrar_evento() (lista ampliada), meus_sinais(), marcar_sinal_lido()
--   admin (você)         → lê e escreve tudo via RLS (tabela `admins`)

-- ---------- Colunas novas ----------

alter table contatos add column if not exists nota text;   -- "Suas anotações" da ficha

-- ---------- Tabelas ----------

create table if not exists perguntas_unicas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references contatos(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 2000),
  status text not null default 'nova' check (status in ('nova', 'respondida')),
  resposta text,
  respondida_em timestamptz,
  origem text,                       -- slug do artigo de onde veio, se veio de um
  criado_em timestamptz not null default now(),
  check (status = 'nova' or (resposta is not null and respondida_em is not null))
);
create index if not exists perguntas_status_idx on perguntas_unicas (status, criado_em);
create index if not exists perguntas_contato_idx on perguntas_unicas (contato_id);

create table if not exists um_a_um (
  id bigint generated always as identity primary key,
  contato_id uuid not null references contatos(id) on delete cascade,
  quando timestamptz,                -- null = "a combinar"
  status text not null default 'agendado' check (status in ('agendado', 'feito', 'cancelado')),
  nota text,
  criado_em timestamptz not null default now()
);
create index if not exists um_a_um_contato_idx on um_a_um (contato_id);
create index if not exists um_a_um_status_idx on um_a_um (status, quando);

create table if not exists sinais (
  id bigint generated always as identity primary key,
  contato_id uuid not null references contatos(id) on delete cascade,
  mensagem text not null check (length(mensagem) between 1 and 500),
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);
create index if not exists sinais_contato_idx on sinais (contato_id, criado_em desc);

-- Um e-mail = uma linha; o status só avança (entregue → aberto → clicado). Quem atualiza
-- é o webhook do provedor (fase 3, com service_role no Worker) — nunca o navegador.
create table if not exists emails_enviados (
  id bigint generated always as identity primary key,
  contato_id uuid not null references contatos(id) on delete cascade,
  modelo text not null,              -- chave do modelo (boas_vindas, naoabriu, ...)
  assunto text,
  corpo text,
  status text not null default 'agendado'
    check (status in ('agendado', 'entregue', 'aberto', 'clicado', 'nao_entregue')),
  provedor_id text,                  -- id da mensagem no provedor de e-mail
  enviado_em timestamptz,
  aberto_em timestamptz,
  clicado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists emails_contato_idx on emails_enviados (contato_id, criado_em desc);
create unique index if not exists emails_provedor_idx on emails_enviados (provedor_id) where provedor_id is not null;

-- ---------- Row Level Security ----------

alter table perguntas_unicas enable row level security;
alter table um_a_um enable row level security;
alter table sinais enable row level security;
alter table emails_enviados enable row level security;

drop policy if exists "perguntas_unicas: só admin" on perguntas_unicas;
create policy "perguntas_unicas: só admin" on perguntas_unicas
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "um_a_um: só admin" on um_a_um;
create policy "um_a_um: só admin" on um_a_um
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "sinais: só admin" on sinais;
create policy "sinais: só admin" on sinais
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "emails_enviados: só admin" on emails_enviados;
create policy "emails_enviados: só admin" on emails_enviados
  for all using (public.eh_admin()) with check (public.eh_admin());

revoke all on perguntas_unicas, um_a_um, sinais, emails_enviados from anon;

-- ---------- A visão que o painel lê ----------
-- security_invoker: a visão respeita o RLS de quem consulta — quem não é admin vê 0 linhas.
--
-- Regras (ajuste aqui, o painel só exibe o que vier daqui):
--   urgência alta   fase 'urgente', ou já na França (fase 'adaptando') com preocupação 'prazo'
--   urgência média  já na França (fase 'adaptando')
--   urgência baixa  ainda planejando (ou fase desconhecida)
--   subpersona      = contatos.caminho (a escolha do pop-up da persona)
--   dias            dias desde o último sinal (evento) ou, sem nenhum, desde que virou contato
--   segmento        reimpacto: só olha o último e-mail e quanto tempo passou (ver abaixo)
create or replace view public.crm_contatos with (security_invoker = true) as
select
  c.id, c.email, c.nome, c.persona, c.caminho as subpersona, c.fase, c.nivel_estudos,
  c.preocupacao, c.origem, c.respostas, c.estagio, c.score, c.user_id, c.nota,
  c.criado_em, c.atualizado_em, c.ultimo_evento_em,
  u.urgencia,
  case
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
              order by cn.criado_em desc, cn.id desc limit 1), false) as aceita_novidades
from contatos c
cross join lateral (
  select greatest(0, floor(extract(epoch from now() - coalesce(c.ultimo_evento_em, c.criado_em)) / 86400))::int as dias
) d
cross join lateral (
  select case
    when c.fase = 'urgente' or (c.fase = 'adaptando' and c.preocupacao = 'prazo') then 'alta'
    when c.fase = 'adaptando' then 'media'
    else 'baixa'
  end as urgencia
) u
left join lateral (
  select e.id, e.status, e.enviado_em from emails_enviados e
   where e.contato_id = c.id order by e.criado_em desc, e.id desc limit 1
) le on true;

revoke all on public.crm_contatos from anon;

-- ---------- Público: pergunta única (tela de artigos) ----------
-- Devolve sempre só { ok: true } — nunca diz se o e-mail já era contato. Exige o mesmo
-- aceite do serviço da fase 1. Limite de 3 perguntas abertas por pessoa (anti-abuso).
--
-- payload: email*, nome, texto*, artigo (slug), aceita_servico* (true),
--          consentimento_versao, texto_servico
create or replace function public.enviar_pergunta_unica(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_texto text;
  v_id uuid;
  v_novo boolean;
  v_origem text;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload_invalido';
  end if;
  v_email := lower(trim(coalesce(payload->>'email', '')));
  if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalido';
  end if;
  if coalesce(payload->>'aceita_servico', '') <> 'true' then
    raise exception 'consentimento_obrigatorio';
  end if;
  v_texto := trim(coalesce(payload->>'texto', ''));
  if length(v_texto) = 0 then raise exception 'pergunta_vazia'; end if;
  if length(v_texto) > 2000 then raise exception 'pergunta_grande_demais'; end if;
  v_origem := crm_token(payload->>'artigo');

  insert into contatos as c (email, nome, origem)
  values (v_email, nullif(left(trim(coalesce(payload->>'nome', '')), 100), ''), coalesce(v_origem, 'artigo'))
  on conflict (email) do update set nome = coalesce(excluded.nome, c.nome)
  returning c.id, (c.xmax = 0) into v_id, v_novo;

  if (select count(*) from perguntas_unicas where contato_id = v_id and status = 'nova') >= 3 then
    raise exception 'muitas_perguntas_abertas';
  end if;

  if not exists (select 1 from consentimentos where contato_id = v_id and finalidade = 'servico') then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'servico', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_servico', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;

  if v_novo then
    insert into eventos (contato_id, tipo, dados)
    values (v_id, 'email_capturado', jsonb_build_object('origem', coalesce(v_origem, 'artigo')));
  end if;

  insert into perguntas_unicas (contato_id, texto, origem) values (v_id, v_texto, v_origem);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enviar_pergunta_unica(jsonb) from public;
grant execute on function public.enviar_pergunta_unica(jsonb) to anon, authenticated;

-- ---------- Pessoa logada: mais eventos, sinais ----------
-- Amplia a lista fechada da fase 1 (era só 'senha_adiada'). Cada tipo abaixo é o que o
-- app do checklist precisa anotar pro estágio andar sozinho (ver gatilho mais adiante).
create or replace function public.registrar_evento(p_tipo text, p_dados jsonb default '{}'::jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if p_tipo <> all (array['senha_adiada', 'app_aberto', 'checklist_marcado', 'artigo_lido']) then
    raise exception 'tipo_nao_permitido';
  end if;
  if pg_column_size(coalesce(p_dados, '{}'::jsonb)) > 2000 then
    raise exception 'dados_grandes_demais';
  end if;

  select id into v_id from contatos where user_id = auth.uid();
  if v_id is null then return; end if;

  insert into eventos (contato_id, tipo, dados) values (v_id, p_tipo, coalesce(p_dados, '{}'::jsonb));
end;
$$;

-- Os avisos que o admin mandou pra ESTA pessoa (aparecem no dashboard dela).
create or replace function public.meus_sinais() returns table (id bigint, mensagem text, criado_em timestamptz, lido_em timestamptz)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select s.id, s.mensagem, s.criado_em, s.lido_em
    from sinais s join contatos c on c.id = s.contato_id
   where c.user_id = auth.uid()
   order by s.criado_em desc limit 20;
$$;
revoke all on function public.meus_sinais() from public;
grant execute on function public.meus_sinais() to authenticated;

create or replace function public.marcar_sinal_lido(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update sinais s set lido_em = coalesce(s.lido_em, now())
   from contatos c
   where s.id = p_id and c.id = s.contato_id and c.user_id = auth.uid();
$$;
revoke all on function public.marcar_sinal_lido(bigint) from public;
grant execute on function public.marcar_sinal_lido(bigint) to authenticated;

-- ---------- Gatilhos: a linha do tempo se mantém sozinha ----------
-- Mesma regra da fase 1: nunca derrubam a gravação que os disparou.

create or replace function public.crm_on_pergunta() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'pergunta_unica', jsonb_build_object('pergunta_id', new.id));
    elsif old.status = 'nova' and new.status = 'respondida' then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'pergunta_respondida', jsonb_build_object('pergunta_id', new.id));
    end if;
  exception when others then
    raise warning 'crm_on_pergunta: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_perguntas_evento on perguntas_unicas;
create trigger crm_perguntas_evento after insert or update of status on perguntas_unicas
  for each row execute function public.crm_on_pergunta();

-- 1:1 marcado move o estágio pra 'um_a_um' (nunca desfaz 'concluido').
create or replace function public.crm_on_um_a_um() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.status = 'agendado' then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'um_a_um_agendado', jsonb_build_object('quando', new.quando));
      update contatos set estagio = 'um_a_um' where id = new.contato_id and estagio <> 'concluido';
    end if;
  exception when others then
    raise warning 'crm_on_um_a_um: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_um_a_um_evento on um_a_um;
create trigger crm_um_a_um_evento after insert on um_a_um
  for each row execute function public.crm_on_um_a_um();

create or replace function public.crm_on_sinal() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into eventos (contato_id, tipo, dados)
    values (new.contato_id, 'sinal_enviado', jsonb_build_object('mensagem', left(new.mensagem, 200)));
  exception when others then
    raise warning 'crm_on_sinal: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_sinais_evento on sinais;
create trigger crm_sinais_evento after insert on sinais
  for each row execute function public.crm_on_sinal();

-- Cada e-mail enviado vira evento (a linha do tempo mostra "E-mail enviado: ...").
create or replace function public.crm_on_email() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'email_enviado', jsonb_build_object('modelo', new.modelo, 'assunto', new.assunto));
    end if;
  exception when others then
    raise warning 'crm_on_email: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_emails_evento on emails_enviados;
create trigger crm_emails_evento after insert on emails_enviados
  for each row execute function public.crm_on_email();

-- O estágio só AVANÇA sozinho por sinal do app; recuar/pular é decisão sua no painel.
--   app_aberto         lead → ativado
--   checklist_marcado  lead/ativado → em_uso     (e reativa quem estava 'inativo')
--   qualquer evento do app tira 'inativo'
create or replace function public.crm_evento_estagio() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.tipo = 'app_aberto' then
      update contatos set estagio = 'ativado' where id = new.contato_id and estagio in ('lead', 'inativo');
    elsif new.tipo = 'checklist_marcado' then
      update contatos set estagio = 'em_uso' where id = new.contato_id and estagio in ('lead', 'ativado', 'inativo');
    elsif new.tipo = 'artigo_lido' then
      update contatos set estagio = 'ativado' where id = new.contato_id and estagio = 'inativo';
    end if;
  exception when others then
    raise warning 'crm_evento_estagio: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_eventos_estagio on eventos;
create trigger crm_eventos_estagio after insert on eventos
  for each row execute function public.crm_evento_estagio();

-- "Último sinal" é o que a PESSOA fez. Coisas que você faz por ela (mandar e-mail, sinal,
-- mudar estágio, responder pergunta, marcar 1:1) entram na linha do tempo, mas não podem
-- zerar o "parada há N dias" — senão mandar um reimpacto esconderia quem continua parada,
-- e a rotina de inativos nunca pegaria ninguém. Substitui a função da fase 1.
create or replace function public.crm_evento_recente() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> all (array['estagio_alterado', 'sinal_enviado', 'email_enviado', 'pergunta_respondida', 'um_a_um_agendado']) then
    update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id;
  end if;
  return new;
end;
$$;

-- Mudança de estágio (qualquer origem) fica registrada: o "de" e o "para".
create or replace function public.crm_on_estagio() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into eventos (contato_id, tipo, dados)
    values (new.id, 'estagio_alterado', jsonb_build_object('de', old.estagio, 'para', new.estagio));
  exception when others then
    raise warning 'crm_on_estagio: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_contatos_estagio on contatos;
create trigger crm_contatos_estagio after update of estagio on contatos
  for each row when (old.estagio is distinct from new.estagio)
  execute function public.crm_on_estagio();

-- ---------- Rotina: marcar inativos ----------
-- Quem está 'ativado' ou 'em_uso' e some há 30+ dias vira 'inativo'. Agende no Supabase
-- (Database → Cron, ou pg_cron): select public.crm_marcar_inativos();  ← 1x por dia.
-- Não é chamável pelo navegador.
create or replace function public.crm_marcar_inativos() returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  with x as (
    update contatos set estagio = 'inativo'
     where estagio in ('ativado', 'em_uso')
       and coalesce(ultimo_evento_em, criado_em) < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_n from x;
  return v_n;
end;
$$;
revoke all on function public.crm_marcar_inativos() from public, anon, authenticated;
