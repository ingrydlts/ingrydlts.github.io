-- Por Dentro — CRM, dossiê da pessoa: o que ela faz no app vira registro permanente na ficha
-- Rode no SQL Editor do Supabase, DEPOIS de crm-plataforma.sql (e de crm-fase2.sql). Idempotente.
--
-- Por quê: a linha do tempo da ficha ("Tudo que ela fez") e o estágio (Lead → Ativado → Em uso) foram
-- desenhados para receber 'app_aberto' e 'checklist_marcado', mas o app nunca os mandava. Aqui o
-- BANCO grava sozinho, por gatilho, no momento em que o dado muda — não depende do navegador, de
-- cache nem de a aba estar aberta. Nada se perde.
--
-- O que entra:
--   1. checklist_items   marcou / desmarcou um item → eventos 'checklist_marcado' / 'checklist_desmarcado'
--   2. profiles          mudou um dado do perfil (data de chegada, vencimento do documento, persona...) → 'perfil_atualizado'
--   3. sinais            ela leu um sinal → 'sinal_lido'
--   4. registrar_cliques abriu o app → 'app_aberto' (no máx. 1 a cada 6 h); botão importante → 'clique_importante'
--   5. plataforma_cliques ganha cid (id do clique gerado no navegador) para o reenvio nunca duplicar
--   6. Retroativo: o que ela já marcou no checklist antes desta migração entra na linha do tempo
--
-- Os gatilhos nunca derrubam a gravação que os disparou (mesma regra das fases anteriores).

-- ---------- 5. Reenvio sem duplicar ----------
alter table public.plataforma_cliques add column if not exists cid text;
create unique index if not exists plataforma_cliques_cid_uq on public.plataforma_cliques (cid) where cid is not null;

-- ---------- 1. Checklist ----------
create or replace function public.crm_on_checklist() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  begin
    select id into v_id from public.contatos where user_id = new.user_id;
    if v_id is not null then
      insert into public.eventos (contato_id, tipo, dados)
      values (v_id,
              case when new.status = 'concluido' then 'checklist_marcado' else 'checklist_desmarcado' end,
              jsonb_strip_nulls(jsonb_build_object('item', left(new.label, 160), 'step_key', new.step_key, 'categoria', new.category)));
    end if;
  exception when others then
    raise warning 'crm_on_checklist: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_checklist_evento on public.checklist_items;
create trigger crm_checklist_evento after update of status on public.checklist_items
  for each row when (old.status is distinct from new.status)
  execute function public.crm_on_checklist();

-- ---------- 2. Perfil ----------
-- Só campos que descrevem a situação dela (datas, persona, marcos). Nome, telefone e avatar ficam de fora.
create or replace function public.crm_on_perfil() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_campo text;
begin
  begin
    select id into v_id from public.contatos where user_id = new.id;
    if v_id is not null then
      foreach v_campo in array array['persona', 'data_chegada', 'documento_vencimento', 'data_prova_frances_master',
                                      'profissao_regulamentada', 'onboarding_concluido', 'moradia_resolvida',
                                      'conta_resolvida', 'securite_resolvida'] loop
        if v_old->v_campo is distinct from v_new->v_campo then
          insert into public.eventos (contato_id, tipo, dados)
          values (v_id, 'perfil_atualizado',
                  jsonb_strip_nulls(jsonb_build_object('campo', v_campo, 'de', v_old->>v_campo, 'para', v_new->>v_campo)));
        end if;
      end loop;
    end if;
  exception when others then
    raise warning 'crm_on_perfil: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_perfil_evento on public.profiles;
create trigger crm_perfil_evento after update on public.profiles
  for each row execute function public.crm_on_perfil();

-- ---------- 3. Sinal lido ----------
create or replace function public.crm_on_sinal_lido() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.eventos (contato_id, tipo, dados)
    values (new.contato_id, 'sinal_lido', jsonb_build_object('mensagem', left(new.mensagem, 200)));
  exception when others then
    raise warning 'crm_on_sinal_lido: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_sinais_lido on public.sinais;
create trigger crm_sinais_lido after update of lido_em on public.sinais
  for each row when (old.lido_em is null and new.lido_em is not null)
  execute function public.crm_on_sinal_lido();

-- ---------- 4. registrar_cliques: agora com cid, app_aberto e botões importantes ----------
-- Troca a versão de crm-plataforma.sql (mesma assinatura). O item do lote pode trazer:
--   cid         id do clique (o reenvio do mesmo lote não duplica)
--   importante  true para os botões que contam para o dossiê (marcar 1:1, trocar caminho, etc.)
create or replace function public.registrar_cliques(p_itens jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'formato_invalido';
  end if;
  if jsonb_array_length(p_itens) > 50 or pg_column_size(p_itens) > 20000 then
    raise exception 'lote_grande_demais';
  end if;

  select id into v_id from public.contatos where user_id = auth.uid();
  if v_id is null then return; end if;

  -- Um clique só entra uma vez (cid); os botões importantes viram evento só quando o clique é novo.
  with novos as (
    insert into public.plataforma_cliques (contato_id, sessao, tela, alvo, rotulo, criado_em, cid)
    select v_id,
           left(x->>'sessao', 40),
           left(coalesce(nullif(x->>'tela', ''), '?'), 120),
           case when x->>'alvo' in ('tela', 'botao', 'link') then x->>'alvo' else 'botao' end,
           left(x->>'rotulo', 120),
           case when (x->>'em') ~ '^\d{4}-\d{2}-\d{2}T' and (x->>'em')::timestamptz between now() - interval '1 day' and now() + interval '5 minutes'
                then (x->>'em')::timestamptz else now() end,
           left(x->>'cid', 40)
      from jsonb_array_elements(p_itens) x
    on conflict (cid) where cid is not null do nothing
    returning cid, rotulo, tela
  )
  insert into public.eventos (contato_id, tipo, dados)
  select v_id, 'clique_importante', jsonb_build_object('rotulo', n.rotulo, 'tela', n.tela)
    from jsonb_array_elements(p_itens) x
    join novos n on n.cid = left(x->>'cid', 40)
   where (x->>'importante') = 'true' and coalesce(n.rotulo, '') <> '';

  -- Abriu o app: 1 registro a cada 6 h (é o que tira a pessoa de "Lead" no funil).
  if not exists (select 1 from public.eventos where contato_id = v_id and tipo = 'app_aberto' and criado_em > now() - interval '6 hours') then
    insert into public.eventos (contato_id, tipo, dados) values (v_id, 'app_aberto', '{}'::jsonb);
  end if;
end;
$$;
revoke all on function public.registrar_cliques(jsonb) from public;
grant execute on function public.registrar_cliques(jsonb) to authenticated;

-- ---------- 6. Retroativo: o que ela já marcou no checklist ----------
insert into public.eventos (contato_id, tipo, dados, criado_em)
select c.id, 'checklist_marcado',
       jsonb_strip_nulls(jsonb_build_object('item', left(i.label, 160), 'step_key', i.step_key, 'categoria', i.category)),
       coalesce(i.updated_at, now())
  from public.checklist_items i
  join public.contatos c on c.user_id = i.user_id
 where i.status = 'concluido'
   and not exists (select 1 from public.eventos e
                    where e.contato_id = c.id and e.tipo = 'checklist_marcado' and e.dados->>'step_key' = i.step_key);
