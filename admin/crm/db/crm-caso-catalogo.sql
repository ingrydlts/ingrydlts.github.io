-- CATÁLOGO COMO DADO: os tipos de bloco do Espaço ("escolas", "empresas", "consulados"…) e os destinos das perguntas da equipe deixam
-- de ser lista fixa no SQL e passam a ser linhas de tabela. Tipo novo = uma linha, não um arquivo SQL novo.
-- Rode DEPOIS de crm-caso.sql, crm-caso-importar.sql, crm-caso-guias.sql, crm-caso-documentos.sql, crm-caso-checklists.sql e
-- crm-caso-criterios.sql. Pode rodar de novo sem estragar nada. Só acrescenta: nenhum dado existente é apagado ou reescrito.
--
-- O que muda:
--   1. bloco_tipos           os tipos de bloco de contatos que a pessoa vê (escola, empresa, consulado, tradutor, seguro, contador). Só admin.
--   2. respostas_permitidas  os únicos lugares onde a resposta a uma pergunta da equipe pode gravar (antes: 4 chaves num CHECK). Só admin.
--   3. board_itens           ganha o tipo 'contato' (um contato a acionar: empresa, consulado…). dados.bloco_tipo tem que estar em bloco_tipos.
--   4. caso_avisos.grava_em  o CHECK de 4 chaves vira: formato seguro (respostas.<chave>) + a chave existe em respostas_permitidas
--                            e o tipo da resposta (data/opcoes) bate. Resposta nova = uma linha em respostas_permitidas.
--   5. caso_board_chaves_ok  VERSÃO CANÔNICA, no lugar das três cópias de crm-caso-guias / -documentos / -checklists (união delas + 'contato').
--                            Quem precisar mudar as chaves do board muda SÓ aqui.
--   6. salvar_dados_dela     passa a aceitar o tipo 'contato' (critérios e status_contato que a pessoa preenche).
-- ATENÇÃO: se rodar crm-caso-guias.sql, -documentos.sql ou -checklists.sql DEPOIS deste, eles voltam a trocar caso_board_chaves_ok
-- pela cópia antiga e o tipo 'contato' deixa de passar. Rode este de novo.

-- ---------- 1 e 2. Tabelas do catálogo (só admin) ----------
create table if not exists public.bloco_tipos (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]{1,29}$'),
  rotulo text not null check (length(btrim(rotulo)) between 1 and 60),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.respostas_permitidas (
  chave text primary key check (chave ~ '^respostas\.[a-z][a-z0-9_]{0,39}$'),
  tipo text not null check (tipo in ('data', 'opcoes')),
  criado_em timestamptz not null default now()
);
alter table public.bloco_tipos enable row level security;
alter table public.respostas_permitidas enable row level security;
drop policy if exists "bloco_tipos: só admin" on public.bloco_tipos;
create policy "bloco_tipos: só admin" on public.bloco_tipos for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "respostas_permitidas: só admin" on public.respostas_permitidas;
create policy "respostas_permitidas: só admin" on public.respostas_permitidas for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.bloco_tipos from anon;
revoke all on public.respostas_permitidas from anon;

insert into public.bloco_tipos (chave, rotulo) values
  ('escola', 'Escolas para você contatar'), ('empresa', 'Empresas para você contatar'), ('consulado', 'Consulados para você contatar'),
  ('tradutor', 'Tradutores para você contatar'), ('seguro', 'Seguros para você contatar'), ('contador', 'Contadores para você contatar')
on conflict (chave) do nothing;
insert into public.respostas_permitidas (chave, tipo) values
  ('respostas.fim_pvt', 'data'), ('respostas.nivel_frances', 'opcoes'), ('respostas.escola_prioridade', 'opcoes'), ('respostas.sponsor', 'opcoes')
on conflict (chave) do nothing;

-- ---------- 3. board_itens aceita o tipo 'contato' ----------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.board_itens'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '''escola''' and pg_get_constraintdef(oid) ~ '''bilan'''
  loop
    execute format('alter table public.board_itens drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.board_itens drop constraint if exists board_itens_tipo_check;
alter table public.board_itens add constraint board_itens_tipo_check check (tipo in ('escola', 'modelo', 'documento', 'marco', 'bilan', 'contato'));

-- ---------- 5. Validador canônico das chaves do board ----------
create or replace function public.caso_board_chaves_ok(p_tipo text, p_dados jsonb, p_dela boolean) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p_dados is not null and jsonb_typeof(p_dados) = 'object'
     and not exists (
       select 1 from jsonb_object_keys(p_dados) k
        where k <> all (
          case when p_dela then
                 (case p_tipo when 'escola' then array['criterios', 'meses', 'custo_eur']
                              when 'documento' then array['reunido']
                              when 'contato' then array['criterios', 'status_contato']
                              else array[]::text[] end)
               else
                 (case p_tipo when 'escola' then array['cidade', 'curso', 'link', 'custo_eur', 'meses_sugeridos']
                              when 'modelo' then array['idioma', 'assunto', 'corpo', 'traducao']
                              when 'documento' then array['rotulo', 'direcao', 'selos', 'checklists']
                              when 'marco' then array['data', 'a_confirmar', 'nota']
                              when 'bilan' then array['secoes', 'data', 'palavras']
                              when 'contato' then array['bloco_tipo', 'nome', 'link', 'cidade', 'canal', 'nota']
                              else array[]::text[] end)
          end))
     -- bilan: a data é um dia e as palavras-chave são poucas e curtas
     and (not (p_dados ? 'data') or p_tipo <> 'bilan' or (jsonb_typeof(p_dados->'data') = 'string' and p_dados->>'data' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
     and (not (p_dados ? 'palavras') or p_tipo <> 'bilan' or (
           jsonb_typeof(p_dados->'palavras') = 'array' and jsonb_array_length(p_dados->'palavras') <= 6
           and not exists (select 1 from jsonb_array_elements(p_dados->'palavras') e
                            where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and 30)))
     -- documento: selos e checklists
     and (not (p_dados ? 'selos') or (p_tipo = 'documento' and not p_dela and jsonb_typeof(p_dados->'selos') = 'array'
          and jsonb_array_length(p_dados->'selos') <= 4
          and not exists (select 1 from jsonb_array_elements(p_dados->'selos') e
                           where jsonb_typeof(e) <> 'string' or (e #>> '{}') <> all (array['traducao', 'haia', 'equivaler', 'original']))))
     and (not (p_dados ? 'checklists') or (p_tipo = 'documento' and not p_dela and jsonb_typeof(p_dados->'checklists') = 'array'
          and jsonb_array_length(p_dados->'checklists') <= 8
          and not exists (select 1 from jsonb_array_elements(p_dados->'checklists') e
                           where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^[a-z0-9_]{1,40}$')))
     -- contato (equipe): tipo de bloco com formato seguro (a existência no catálogo é conferida no gatilho), texto curto e link https
     and (not (p_dados ? 'bloco_tipo') or (p_tipo = 'contato' and not p_dela and jsonb_typeof(p_dados->'bloco_tipo') = 'string' and p_dados->>'bloco_tipo' ~ '^[a-z][a-z0-9_]{1,29}$'))
     and (not (p_dados ? 'nome') or (p_tipo = 'contato' and not p_dela and jsonb_typeof(p_dados->'nome') = 'string' and length(btrim(p_dados->>'nome')) between 1 and 120))
     and (not (p_dados ? 'canal') or (p_tipo = 'contato' and not p_dela and jsonb_typeof(p_dados->'canal') = 'string' and length(p_dados->>'canal') <= 40))
     and (not (p_dados ? 'nota') or (p_tipo = 'contato' and not p_dela and jsonb_typeof(p_dados->'nota') = 'string' and length(p_dados->>'nota') <= 240))
     and (not (p_dados ? 'cidade') or p_tipo not in ('contato') or (jsonb_typeof(p_dados->'cidade') = 'string' and length(p_dados->>'cidade') <= 80))
     and (not (p_dados ? 'link') or p_tipo <> 'contato' or (jsonb_typeof(p_dados->'link') = 'string' and p_dados->>'link' ~ '^https://[^[:space:]]+$' and length(p_dados->>'link') <= 500))
     -- contato (pessoa): status do contato numa lista curta
     and (not (p_dados ? 'status_contato') or (p_tipo = 'contato' and p_dela and jsonb_typeof(p_dados->'status_contato') = 'string'
          and (p_dados->>'status_contato') = any (array['nao_contatado', 'contatado', 'respondeu', 'descartado'])));
$$;

-- O tipo de bloco de um item 'contato' tem que existir (e estar ativo) no catálogo. Itens que já existem continuam podendo ser
-- publicados mesmo se o tipo for desativado depois (só itens novos ou com tipo trocado são recusados).
create or replace function public.caso_board_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'contato' and (tg_op = 'INSERT' or old.dados->>'bloco_tipo' is distinct from new.dados->>'bloco_tipo') then
    if not exists (select 1 from bloco_tipos t where t.chave = new.dados->>'bloco_tipo' and t.ativo) then
      raise exception 'bloco_tipo_invalido';
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.estado = 'publicado' then raise exception 'publique_depois_de_criar'; end if;
    return new;
  end if;
  if new.estado = 'publicado' and old.estado is distinct from 'publicado' then
    if old.estado = 'proposto' then raise exception 'revise_antes_de_publicar'; end if;
    if not public.caso_tem_consentimento(new.contato_id) then raise exception 'sem_consentimento'; end if;
    new.publicado_em := now();
    new.publicado_por := auth.uid();
  elsif new.estado = 'revisado' and old.estado = 'proposto' then
    new.revisado_em := now();
    new.revisado_por := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.caso_board_guarda() from public, anon, authenticated;

-- ---------- 4. Destino da resposta vem da tabela ----------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.caso_avisos'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'respostas\.fim_pvt'
  loop
    execute format('alter table public.caso_avisos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.caso_avisos drop constraint if exists caso_avisos_grava_em_formato;
alter table public.caso_avisos add constraint caso_avisos_grava_em_formato check (grava_em is null or grava_em ~ '^respostas\.[a-z][a-z0-9_]{0,39}$');

create or replace function public.caso_aviso_destino() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'pergunta' and new.grava_em is not null
     and (tg_op = 'INSERT' or new.grava_em is distinct from old.grava_em or new.resposta_tipo is distinct from old.resposta_tipo) then
    if not exists (select 1 from respostas_permitidas p where p.chave = new.grava_em and p.tipo = new.resposta_tipo) then
      raise exception 'destino_nao_permitido';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.caso_aviso_destino() from public, anon, authenticated;
drop trigger if exists caso_avisos_destino on public.caso_avisos;
create trigger caso_avisos_destino before insert or update on public.caso_avisos for each row execute function public.caso_aviso_destino();

-- ---------- 6. salvar_dados_dela aceita o tipo 'contato' (corpo de crm-caso-criterios.sql, com 'contato' na lista de tipos editáveis) ----------
create or replace function public.salvar_dados_dela(p_item bigint, p_patch jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  b board_itens%rowtype;
  v_dela jsonb;
  v_crit jsonb;
  k text;
  v jsonb;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  select * into b from board_itens where id = p_item and contato_id = v_c and estado = 'publicado' for update;
  if not found then
    raise exception 'item_nao_encontrado';
  end if;
  if b.tipo not in ('escola', 'documento', 'contato') then
    raise exception 'item_nao_editavel';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or not public.caso_board_chaves_ok(b.tipo, p_patch, true) then
    raise exception 'chave_invalida';
  end if;

  if p_patch ? 'meses' then
    if jsonb_typeof(p_patch->'meses') <> 'number' or (p_patch->>'meses')::numeric <> trunc((p_patch->>'meses')::numeric)
       or (p_patch->>'meses')::numeric not between 1 and 24 then
      raise exception 'valor_invalido';
    end if;
  end if;
  if p_patch ? 'custo_eur' then
    if jsonb_typeof(p_patch->'custo_eur') not in ('number', 'null') then raise exception 'valor_invalido'; end if;
    if jsonb_typeof(p_patch->'custo_eur') = 'number' and (p_patch->>'custo_eur')::numeric not between 0 and 100000 then
      raise exception 'valor_invalido';
    end if;
  end if;
  if p_patch ? 'reunido' and jsonb_typeof(p_patch->'reunido') <> 'boolean' then
    raise exception 'valor_invalido';
  end if;
  if p_patch ? 'criterios' then
    if jsonb_typeof(p_patch->'criterios') <> 'object' then raise exception 'valor_invalido'; end if;
    for k, v in select * from jsonb_each(p_patch->'criterios') loop
      if k !~ '^[a-z][a-z0-9_]{0,23}$' then raise exception 'valor_invalido'; end if;
      if jsonb_typeof(v) not in ('string', 'null') or (jsonb_typeof(v) = 'string' and (v #>> '{}') <> all (array['sim', 'nao'])) then
        raise exception 'valor_invalido';
      end if;
    end loop;
  end if;

  v_dela := coalesce(b.dados_dela, '{}'::jsonb) || (p_patch - 'criterios');
  if p_patch ? 'criterios' then
    v_crit := coalesce(b.dados_dela->'criterios', '{}'::jsonb) || (p_patch->'criterios');
    -- nulo continua guardado como "ainda não sei" (igual ao comportamento anterior)
    if (select count(*) from jsonb_object_keys(v_crit)) > 12 then raise exception 'valor_invalido'; end if;
    v_dela := jsonb_set(v_dela, '{criterios}', v_crit);
  end if;
  update board_itens set dados_dela = v_dela where id = b.id;
end;
$$;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from public;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from anon;
grant execute on function public.salvar_dados_dela(bigint, jsonb) to authenticated;
