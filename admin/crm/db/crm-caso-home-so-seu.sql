-- Por Dentro — Página inicial: as categorias passam a ser as mesmas seções do Início dela.
-- Antes: checklist (3), espaco (2: prazo/escola), guias (2: bilan/documento/mensagem).
-- Agora: checklist (3 passos, entram no "Agora/Em seguida"), so_seu (3: bilan ou encaminhamento da Ingryd = documento que ela recebe) e guias (2: documento ou mensagem pronta).
-- Rodar DEPOIS de crm-caso-home.sql. PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app).
-- Não redefine meu_caso(): a lista "home" já devolve a categoria como está. Idempotente.
--   * Destaques antigos de "espaco" (prazo e escola) são APAGADOS: prazo e escola saíram da Página inicial. Os itens do board continuam intactos.
--   * Destaques antigos de "guias" que eram bilan viram "so_seu".

alter table public.caso_home drop constraint if exists caso_home_categoria_check;

create or replace function public.caso_home_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_max int := case new.categoria when 'guias' then 2 else 3 end;   -- checklist 3, so_seu 3, guias 2
  v_tipo text;
  v_dono uuid;
  v_dir text;
begin
  if new.categoria not in ('checklist', 'so_seu', 'guias') then
    raise exception 'categoria_invalida';
  end if;
  if (select count(*) from public.caso_home h where h.contato_id = new.contato_id and h.categoria = new.categoria
        and (tg_op = 'INSERT' or h.id <> new.id)) >= v_max then
    raise exception 'home_cheia';
  end if;
  if new.board_id is not null then
    select b.tipo, b.contato_id, b.dados ->> 'direcao' into v_tipo, v_dono, v_dir from public.board_itens b where b.id = new.board_id;
    if v_dono is distinct from new.contato_id
       or (new.categoria = 'so_seu' and not (v_tipo = 'bilan' or (v_tipo = 'documento' and coalesce(v_dir, '') = 'recebe')))
       or (new.categoria = 'guias' and coalesce(v_tipo, '') not in ('documento', 'modelo')) then
      raise exception 'item_invalido';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.caso_home_guarda() from public, anon, authenticated;

delete from public.caso_home where categoria = 'espaco';
-- O que era bilan em "guias" vira "so_seu" (o gatilho acima confere o limite e o tipo).
update public.caso_home h set categoria = 'so_seu'
  from public.board_itens b where h.categoria = 'guias' and b.id = h.board_id and b.tipo = 'bilan';

alter table public.caso_home add constraint caso_home_categoria_check check (categoria in ('checklist', 'so_seu', 'guias'));
