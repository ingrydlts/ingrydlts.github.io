-- PROPOSTA DE MONTAGEM DO ESPAÇO: a leitura do transcript do onboarding vira uma proposta (checklists, documentos, perguntas da equipe,
-- blocos de contatos) que fica PENDENTE até a Ingryd revisar. Rode DEPOIS de crm-caso.sql, crm-caso-catalogo.sql e crm-caso-listas.sql.
-- Pode rodar de novo sem estragar nada. Só acrescenta.
--
--   montagens   uma linha por leitura: proposta (jsonb, já validada pelo Worker), hash da entrada (a mesma entrada não gasta uma
--               leitura nova), modelo e custo. A TRANSCRIÇÃO NÃO É GUARDADA, só o resultado. Só admin lê e escreve: a pessoa nunca
--               enxerga uma montagem; ela só vê o que a equipe publicar em board_itens, caso_listas e caso_acoes.
--   versao      1, 2, 3… por pessoa (gatilho), para uma nova leitura ser comparada com o que já foi publicado (crm_montagem_diff).
--   estado      pendente → aprovada_parcial → publicada, ou descartada. O Worker só cria 'pendente'.
-- Quem escreve: o Worker (POST /api/crm/montagem/ler, com o token da própria admin). Quem decide: a Ingryd, na tela.

create table if not exists public.montagens (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  versao int not null check (versao >= 1),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada_parcial', 'publicada', 'descartada')),
  hash_entrada text not null check (hash_entrada ~ '^[0-9a-f]{64}$'),
  persona text check (persona is null or length(persona) <= 40),
  proposta jsonb not null check (jsonb_typeof(proposta) = 'object' and octet_length(proposta::text) <= 65536),
  modelo text check (modelo is null or length(modelo) <= 80),
  custo_usd numeric(10, 4),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (contato_id, versao)
);
-- A mesma entrada só fica pendente uma vez: duas leituras ao mesmo tempo viram uma só (o Worker reaproveita a que entrou primeiro).
create unique index if not exists montagens_pendente_idx on public.montagens (contato_id, hash_entrada) where estado = 'pendente';
create index if not exists montagens_contato_idx on public.montagens (contato_id, versao desc);
alter table public.montagens enable row level security;
drop policy if exists "montagens: só admin" on public.montagens;
create policy "montagens: só admin" on public.montagens for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.montagens from anon;

create or replace function public.montagem_versao() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.versao := coalesce((select max(m.versao) from montagens m where m.contato_id = new.contato_id), 0) + 1;
  else
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;
revoke all on function public.montagem_versao() from public, anon, authenticated;
drop trigger if exists montagens_versao on public.montagens;
create trigger montagens_versao before insert or update on public.montagens for each row execute function public.montagem_versao();

-- Descartar uma proposta (fica o histórico). Só as que ainda não foram publicadas.
create or replace function public.crm_montagem_descartar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update montagens set estado = 'descartada' where id = p_id and estado in ('pendente', 'aprovada_parcial');
  if not found then
    raise exception 'montagem_nao_encontrada';
  end if;
end;
$$;
revoke all on function public.crm_montagem_descartar(bigint) from public;
revoke all on function public.crm_montagem_descartar(bigint) from anon;
grant execute on function public.crm_montagem_descartar(bigint) to authenticated;
