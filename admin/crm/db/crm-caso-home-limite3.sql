-- Por Dentro — Página inicial: Espaço e Guias passam a aceitar até 3 itens cada (antes 2), como o Em seguida (checklist), que já aceitava 3.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depende de crm-caso-home.sql. Idempotente.
-- Só troca o limite dentro do gatilho caso_home_guarda: a tabela, as políticas e o que a pessoa recebe (meu_caso) não mudam.
-- Não cria tabela nem função nova: db/conferir-banco.sql e db/auditoria-isolamento.sql (do app) seguem iguais.

create or replace function public.caso_home_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_max int := 3;   -- checklist, espaco e guias: 3 cada
  v_tipo text;
  v_dono uuid;
begin
  if (select count(*) from public.caso_home h where h.contato_id = new.contato_id and h.categoria = new.categoria
        and (tg_op = 'INSERT' or h.id <> new.id)) >= v_max then
    raise exception 'home_cheia';
  end if;
  if new.board_id is not null then
    select b.tipo, b.contato_id into v_tipo, v_dono from public.board_itens b where b.id = new.board_id;
    if v_dono is distinct from new.contato_id
       or (new.categoria = 'espaco' and v_tipo not in ('marco', 'escola'))
       or (new.categoria = 'guias' and v_tipo not in ('bilan', 'documento', 'modelo')) then
      raise exception 'item_invalido';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.caso_home_guarda() from public, anon, authenticated;
