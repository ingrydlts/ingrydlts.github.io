-- Por Dentro — revisão dos passos propostos e edição dos passos do checklist pelo CRM.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app).
-- Depende de crm-caso.sql e crm-montagem-aplicar.sql (caso_acoes) e do checklist-editar.sql do app (titulo_custom, nota_custom). Idempotente.
--
--   1. caso_acoes.estado ganha 'recusada': o passo proposto que você recusou. A linha fica (com a origem_chave), então reler a conversa
--      não traz o passo de volta; ela nunca chega à pessoa (meu_caso só entrega o publicado). Some da fila "Passos propostos".
--   2. crm_checklist_editar(p_user, p_step_key, p_titulo, p_nota): só admin. Muda o texto de UM passo do checklist da pessoa
--      (titulo_custom e nota_custom; o texto original do template não é tocado). Título vazio volta ao original.

-- ---------- 1. 'recusada' ----------
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.caso_acoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%aguardando_ela%' loop
    execute format('alter table public.caso_acoes drop constraint %I', c);
  end loop;
  alter table public.caso_acoes add constraint caso_acoes_estado_check check (estado in ('aberta', 'aguardando_ela', 'concluida', 'recusada'));
end $$;

-- ---------- 2. Editar o texto de um passo do checklist dela ----------
create or replace function public.crm_checklist_editar(p_user uuid, p_step_key text, p_titulo text, p_nota text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_t text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_n text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if v_t is not null and length(v_t) > 120 then raise exception 'titulo_longo'; end if;
  if v_n is not null and length(v_n) > 100 then raise exception 'nota_longa'; end if;
  update public.checklist_items set titulo_custom = v_t, nota_custom = v_n where user_id = p_user and step_key = p_step_key;
  if not found then
    raise exception 'item_nao_encontrado';
  end if;
end;
$$;
revoke all on function public.crm_checklist_editar(uuid, text, text, text) from public;
revoke all on function public.crm_checklist_editar(uuid, text, text, text) from anon;
grant execute on function public.crm_checklist_editar(uuid, text, text, text) to authenticated;
