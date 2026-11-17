-- Por Dentro — Curadoria do Checklist: o que a Ingryd esconde, a ordem que ela define e o que ela já conferiu, por pessoa.
-- Rodar PRIMEIRO no Supabase de TESTE, depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e db/conferir-banco.sql (do app).
-- Depende de crm-fase1c-vinculo.sql (meu_contato_id) e de crm-fase2.sql (eh_admin). Idempotente.
--
--   1. checklist_curadoria   uma linha por (pessoa, passo). `step_key` é a chave do passo geral do checklist dela.
--                              oculto        o passo some da lista dela no app (e do "Em seguida"); ela não perde o que já marcou
--                              ordem         0 a 999: os passos com ordem vêm primeiro, nessa ordem; os demais seguem a regra de hoje
--                              conferido_em  "conferi: está correto". É só da equipe: a pessoa nunca recebe este campo.
--                            Só admin lê e escreve a tabela.
--   2. minha_curadoria()     o que o app dela recebe: só oculto e ordem (nunca conferido), só dela, só o que muda alguma coisa.

-- ---------- 1. A tabela ----------
create table if not exists public.checklist_curadoria (
  contato_id uuid not null references public.contatos(id) on delete cascade,
  step_key text not null check (step_key ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  oculto boolean not null default false,
  ordem smallint check (ordem is null or ordem between 0 and 999),
  conferido_em timestamptz,
  conferido_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (contato_id, step_key)
);
alter table public.checklist_curadoria enable row level security;
drop policy if exists "checklist_curadoria: só admin" on public.checklist_curadoria;
create policy "checklist_curadoria: só admin" on public.checklist_curadoria for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.checklist_curadoria from anon;

-- ---------- 2. O que a pessoa recebe ----------
create or replace function public.minha_curadoria() returns jsonb
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('step_key', c.step_key, 'oculto', c.oculto, 'ordem', c.ordem) order by c.ordem nulls last, c.step_key), '[]'::jsonb)
    from public.checklist_curadoria c
   where public.meu_contato_id() is not null and c.contato_id = public.meu_contato_id() and (c.oculto or c.ordem is not null);
$$;
revoke all on function public.minha_curadoria() from public;
revoke all on function public.minha_curadoria() from anon;
grant execute on function public.minha_curadoria() to authenticated;
