-- CRM Por Dentro — fase 2c: lembrete de prazo pedido nos artigos.
--
-- A calculadora [[PRAZO]] dos artigos (ex.: VLS-TS, 3 meses) oferece "Me avisa antes do
-- prazo": a pessoa deixa nome e e-mail, e o site chama pedir_lembrete_prazo(). O contato
-- entra (ou é reaproveitado) em `contatos`, o pedido fica em `lembretes_prazo` e o painel
-- /admin/crm mostra em "Hoje" quem precisa ser avisada nos próximos dias.
--
-- Rodar no SQL Editor do Supabase DEPOIS de crm-fase1.sql (repo POR-DENTRO-APP) e de
-- crm-fase2.sql. Idempotente: pode rodar de novo sem estragar nada.
-- Testes: db/testes (mesmo `npm test` da fase 2).

create table if not exists lembretes_prazo (
  id bigint generated always as identity primary key,
  contato_id uuid not null references contatos(id) on delete cascade,
  prazo date not null,                 -- data-limite calculada pela calculadora
  avisar_em date not null,             -- quando avisar (15 dias antes, ou amanhã se já estiver perto)
  artigo text,                          -- slug do artigo de onde veio
  status text not null default 'agendado' check (status in ('agendado', 'avisado', 'cancelado')),
  avisado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (contato_id, prazo)
);
create index if not exists lembretes_avisar_idx on lembretes_prazo (status, avisar_em);

alter table lembretes_prazo enable row level security;
drop policy if exists "lembretes_prazo: só admin" on lembretes_prazo;
create policy "lembretes_prazo: só admin" on lembretes_prazo
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on lembretes_prazo from anon;

-- payload (jsonb):
--   email*, nome, prazo* (AAAA-MM-DD), artigo (slug),
--   aceita_servico* (true), aceita_novidades (true/false),
--   consentimento_versao, texto_servico, texto_novidades
-- Devolve sempre só { ok: true } — nunca diz se o e-mail já existia.
create or replace function public.pedir_lembrete_prazo(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_prazo date;
  v_avisar date;
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
  begin
    v_prazo := (payload->>'prazo')::date;
  exception when others then
    raise exception 'prazo_invalido';
  end;
  if v_prazo is null or v_prazo <= current_date or v_prazo > current_date + 730 then
    raise exception 'prazo_invalido';
  end if;
  v_avisar := greatest(v_prazo - 15, current_date + 1);
  v_origem := crm_token(payload->>'artigo');

  insert into contatos as c (email, nome, origem)
  values (v_email, nullif(left(trim(coalesce(payload->>'nome', '')), 100), ''), coalesce(v_origem, 'artigo'))
  on conflict (email) do update set nome = coalesce(excluded.nome, c.nome)
  returning c.id, (c.xmax = 0) into v_id, v_novo;

  if (select count(*) from lembretes_prazo where contato_id = v_id and status = 'agendado') >= 3 then
    raise exception 'muitos_lembretes';
  end if;

  if not exists (select 1 from consentimentos where contato_id = v_id and finalidade = 'servico') then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'servico', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_servico', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;
  if coalesce(payload->>'aceita_novidades', '') = 'true' and coalesce((select cn.aceito from consentimentos cn
       where cn.contato_id = v_id and cn.finalidade = 'novidades_email' order by cn.criado_em desc limit 1), false) = false then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem)
    values (v_id, 'novidades_email', true,
      nullif(left(coalesce(payload->>'consentimento_versao', ''), 20), ''),
      nullif(left(coalesce(payload->>'texto_novidades', ''), 600), ''),
      coalesce(v_origem, 'artigo'));
  end if;

  if v_novo then
    insert into eventos (contato_id, tipo, dados)
    values (v_id, 'email_capturado', jsonb_build_object('origem', coalesce(v_origem, 'artigo')));
  end if;

  -- mesmo prazo pedido de novo: reativa em vez de duplicar
  insert into lembretes_prazo (contato_id, prazo, avisar_em, artigo)
  values (v_id, v_prazo, v_avisar, v_origem)
  on conflict (contato_id, prazo) do update
    set status = 'agendado', avisar_em = excluded.avisar_em, avisado_em = null,
        artigo = coalesce(excluded.artigo, lembretes_prazo.artigo);

  insert into eventos (contato_id, tipo, dados)
  values (v_id, 'lembrete_pedido', jsonb_build_object('prazo', v_prazo, 'artigo', v_origem));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.pedir_lembrete_prazo(jsonb) from public;
grant execute on function public.pedir_lembrete_prazo(jsonb) to anon, authenticated;
