-- APLICAR A PROPOSTA DE MONTAGEM COMO RASCUNHOS, com IDs estáveis (origem_chave) e diff entre versões.
-- Rode DEPOIS de crm-caso.sql, crm-caso-importar.sql, crm-caso-catalogo.sql, crm-caso-listas.sql e crm-montagem.sql.
-- Pode rodar de novo sem estragar nada. Só acrescenta.
--
-- O que muda:
--   1. caso_acoes ganha origem_chave (a chave estável do item que veio da proposta: "enc:ligar_escola") e a_conferir (o item não
--      tem fonte: pode existir como rascunho, mas um gatilho impede de publicá-lo para a pessoa).
--      caso_listas ganha origem_chave.
--   2. crm_montagem_aplicar(contato, montagem, decisoes)  você decide item a item: aprovar | editar | rejeitar (com motivo).
--      Aprovar/editar cria (ou atualiza) um RASCUNHO. Nada é publicado e nada chega à pessoa. O que a equipe já revisou, publicou ou
--      a pessoa já concluiu NUNCA é alterado: vai para "conflitos". Tudo ou nada: um item inválido desfaz a aplicação inteira.
--   3. crm_montagem_diff(contato, montagem)  compara uma proposta com o que já existe: novos, mantidos, conflitos e retirar_sugerido
--      (o que veio de proposta anterior e a nova não traz mais: é só uma sugestão, nada é apagado).
-- Chaves: enc:<chave> (encaminhamento ou pendência de compromisso), lista:<chave>, chk:<lista>:<item>, doc:<chave>, perg:<chave>,
--         bloco:<tipo>:<chave>.
-- Documento: direcao 'equipe_envia' da proposta vira 'recebe' (a equipe manda para ela) e o resto 'reune' (ela reúne), que são os valores que o app e o CRM leem.
-- Motivos de edição ou rejeição (alimentam a manutenção do catálogo): fato_errado, regra_inadequada, prazo_desatualizado, excecao.

alter table public.caso_acoes add column if not exists origem_chave text check (origem_chave is null or origem_chave ~ '^[a-z0-9_:.-]{1,80}$');
alter table public.caso_acoes add column if not exists a_conferir boolean not null default false;
alter table public.caso_listas add column if not exists origem_chave text check (origem_chave is null or origem_chave ~ '^[a-z0-9_:.-]{1,80}$');
create unique index if not exists caso_acoes_origem_idx on public.caso_acoes (contato_id, origem_chave) where origem_chave is not null;
create unique index if not exists caso_listas_origem_idx on public.caso_listas (contato_id, origem_chave) where origem_chave is not null;

-- Item sem fonte não vai para a pessoa.
create or replace function public.caso_acao_conferir_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.publicada_em is not null and new.a_conferir then
    raise exception 'a_conferir';
  end if;
  return new;
end;
$$;
revoke all on function public.caso_acao_conferir_guarda() from public, anon, authenticated;
drop trigger if exists caso_acoes_conferir_guarda on public.caso_acoes;
create trigger caso_acoes_conferir_guarda before insert or update on public.caso_acoes for each row execute function public.caso_acao_conferir_guarda();

-- Os itens de uma proposta, cada um com a sua chave estável. Pura.
create or replace function public.montagem_itens(p jsonb) returns table (k text, kind text, d jsonb, ctx jsonb)
language sql immutable
set search_path = pg_catalog, public
as $$
  select 'enc:' || (e->>'chave'), 'enc', e, '{}'::jsonb from jsonb_array_elements(coalesce(p->'encaminhamentos', '[]'::jsonb)) e
  union all select 'enc:' || (e->>'chave'), 'enc', e, '{}'::jsonb from jsonb_array_elements(coalesce(p->'omissoes', '[]'::jsonb)) e
  union all select 'lista:' || (c->>'chave'), 'lista', c, '{}'::jsonb from jsonb_array_elements(coalesce(p->'checklists', '[]'::jsonb)) c
  union all select 'chk:' || (c->>'chave') || ':' || (i->>'chave'), 'chk', i, jsonb_build_object('lista', c->>'chave', 'origem', c->>'origem')
    from jsonb_array_elements(coalesce(p->'checklists', '[]'::jsonb)) c, jsonb_array_elements(coalesce(c->'itens', '[]'::jsonb)) i
  union all select 'doc:' || (d->>'chave'), 'doc', d, '{}'::jsonb from jsonb_array_elements(coalesce(p->'documentos', '[]'::jsonb)) d
  union all select 'perg:' || (q->>'chave'), 'perg', q, '{}'::jsonb from jsonb_array_elements(coalesce(p->'perguntas_equipe', '[]'::jsonb)) q
  union all select 'bloco:' || (b->>'tipo') || ':' || (i->>'chave'), 'bloco', i, jsonb_build_object('tipo', b->>'tipo')
    from jsonb_array_elements(coalesce(p->'blocos', '[]'::jsonb)) b, jsonb_array_elements(coalesce(b->'itens', '[]'::jsonb)) i
$$;
revoke all on function public.montagem_itens(jsonb) from public, anon, authenticated;

-- ---------- Aplicar ----------
create or replace function public.crm_montagem_aplicar(p_contato uuid, p_montagem bigint, p_decisoes jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  m montagens%rowtype;
  dec jsonb; it record;
  v_motivos text[] := array['fato_errado', 'regra_inadequada', 'prazo_desatualizado', 'excecao'];
  v_criados int := 0; v_atualizados int := 0; v_mantidos int := 0; v_rejeitados int := 0;
  v_conf text[] := '{}';
  ac caso_acoes%rowtype; li caso_listas%rowtype; bi board_itens%rowtype; av caso_avisos%rowtype;
  v_dados jsonb; v_titulo text; v_ctx jsonb; v_chave text;
  v_dono text; v_prazo date; v_pt text; v_cert text; v_conferir boolean; v_passo text; v_camada text; v_lista text;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_decisoes is null or jsonb_typeof(p_decisoes) <> 'array' then raise exception 'decisoes_invalidas'; end if;
  select * into m from montagens where id = p_montagem and contato_id = p_contato for update;
  if not found then raise exception 'montagem_nao_encontrada'; end if;

  -- Valida tudo antes de escrever qualquer coisa (e a ordem: lista, encaminhamento, item de lista, documento, bloco, pergunta).
  for dec in select * from jsonb_array_elements(p_decisoes) loop
    if dec->>'decisao' is null or dec->>'decisao' <> all (array['aprovar', 'editar', 'rejeitar']) then raise exception 'decisao_invalida'; end if;
    if dec->>'motivo' is not null and dec->>'motivo' <> all (v_motivos) then raise exception 'motivo_invalido'; end if;
    if not exists (select 1 from montagem_itens(m.proposta) x where x.k = dec->>'origem_chave') then raise exception 'item_desconhecido'; end if;
  end loop;

  for it in
    select d.value as dec, x.k, x.kind, x.d, x.ctx
      from jsonb_array_elements(p_decisoes) d(value) join montagem_itens(m.proposta) x on x.k = d.value->>'origem_chave'
     order by case x.kind when 'lista' then 1 when 'enc' then 2 when 'chk' then 3 when 'doc' then 4 when 'bloco' then 5 else 6 end, x.k
  loop
    if it.dec->>'decisao' = 'rejeitar' then
      insert into eventos (contato_id, tipo, dados) values (p_contato, 'montagem_item_rejeitado',
        jsonb_build_object('montagem_id', m.id, 'origem_chave', it.k, 'motivo', it.dec->>'motivo'));
      v_rejeitados := v_rejeitados + 1;
      continue;
    end if;
    if it.dec->>'decisao' = 'editar' then
      insert into eventos (contato_id, tipo, dados) values (p_contato, 'montagem_item_editado',
        jsonb_build_object('montagem_id', m.id, 'origem_chave', it.k, 'motivo', it.dec->>'motivo'));
    end if;

    if it.kind = 'lista' then
      select * into li from caso_listas where contato_id = p_contato and chave = it.d->>'chave';
      if not found then
        insert into caso_listas (contato_id, chave, titulo, origem, origem_chave) values (p_contato, it.d->>'chave', left(it.d->>'titulo', 80), it.d->>'origem', it.k);
        v_criados := v_criados + 1;
      elsif li.estado <> 'proposto' then v_conf := v_conf || it.k;
      elsif li.titulo is distinct from left(it.d->>'titulo', 80) or li.origem is distinct from it.d->>'origem' then
        update caso_listas set titulo = left(it.d->>'titulo', 80), origem = it.d->>'origem' where id = li.id; v_atualizados := v_atualizados + 1;
      else v_mantidos := v_mantidos + 1; end if;

    elsif it.kind in ('enc', 'chk') then
      if it.kind = 'enc' then
        v_titulo := left(it.d->>'texto', 160); v_dono := it.d->>'dono'; v_camada := it.d->>'camada'; v_lista := null;
        v_prazo := nullif(it.d->>'prazo', '')::date; v_pt := nullif(it.d->>'prazo_texto', '');
        v_cert := case when it.d->>'certeza' = 'literal' then 'literal' else 'inferido' end;
        v_conferir := (it.d->>'certeza') = 'confirmar';
        v_passo := case when v_dono = 'ela' then 'mont_' || left(it.d->>'chave', 50) end;
      else
        v_lista := it.ctx->>'lista';
        if not exists (select 1 from caso_listas l where l.contato_id = p_contato and l.chave = v_lista) then raise exception 'lista_nao_aprovada'; end if;
        v_titulo := left(it.d->>'titulo', 160); v_dono := 'ela'; v_camada := case when it.ctx->>'origem' = 'modelo' then 'persona' else 'particular' end;
        v_prazo := nullif(it.d->>'prazo', '')::date; v_pt := null; v_cert := 'inferido';
        v_conferir := coalesce((it.d->>'a_conferir')::boolean, true);
        v_passo := left('mont_' || v_lista || '_' || (it.d->>'chave'), 60);
      end if;
      select * into ac from caso_acoes where contato_id = p_contato and origem_chave = it.k;
      if not found then
        insert into caso_acoes (contato_id, origem_chave, titulo, dono, canal, passo_chave, prazo, prazo_texto, prazo_a_confirmar, certeza, camada, lista_chave, a_conferir)
        values (p_contato, it.k, v_titulo, v_dono, case when v_dono = 'ela' then 'plataforma' else 'so_eu' end, v_passo, v_prazo, v_pt, (v_pt is not null and v_prazo is null), v_cert, v_camada, v_lista, v_conferir);
        v_criados := v_criados + 1;
      elsif ac.estado <> 'aberta' or ac.publicada_em is not null or ac.concluida_em is not null then v_conf := v_conf || it.k;
      elsif (ac.titulo, ac.dono, ac.prazo, ac.prazo_texto, ac.certeza, ac.camada, ac.lista_chave, ac.a_conferir)
            is distinct from (v_titulo, v_dono, v_prazo, v_pt, v_cert, v_camada, v_lista, v_conferir) then
        update caso_acoes set titulo = v_titulo, dono = v_dono, canal = case when v_dono = 'ela' then 'plataforma' else 'so_eu' end, passo_chave = v_passo, prazo = v_prazo, prazo_texto = v_pt,
               prazo_a_confirmar = (v_pt is not null and v_prazo is null), certeza = v_cert, camada = v_camada, lista_chave = v_lista, a_conferir = v_conferir where id = ac.id;
        v_atualizados := v_atualizados + 1;
      else v_mantidos := v_mantidos + 1; end if;

    elsif it.kind in ('doc', 'bloco') then
      if it.kind = 'doc' then
        v_titulo := left(it.d->>'rotulo', 120);
        v_dados := jsonb_build_object('rotulo', left(it.d->>'rotulo', 120), 'direcao', case when it.d->>'direcao' = 'equipe_envia' then 'recebe' else 'reune' end, 'selos', coalesce(it.d->'selos', '[]'::jsonb), 'checklists', coalesce(it.d->'checklists', '[]'::jsonb));
      else
        v_titulo := left(it.d->>'nome', 120);
        v_dados := jsonb_strip_nulls(jsonb_build_object('bloco_tipo', it.ctx->>'tipo', 'nome', it.d->>'nome', 'link', nullif(it.d->>'link', ''), 'canal', nullif(it.d->>'canal', ''), 'nota', nullif(it.d->>'nota', '')));
      end if;
      select * into bi from board_itens where contato_id = p_contato and origem_chave = it.k;
      if not found then
        insert into board_itens (contato_id, origem_chave, tipo, titulo, dados) values (p_contato, it.k, case when it.kind = 'doc' then 'documento' else 'contato' end, v_titulo, v_dados);
        v_criados := v_criados + 1;
      elsif bi.estado <> 'proposto' then v_conf := v_conf || it.k;
      elsif (bi.titulo, bi.dados) is distinct from (v_titulo, v_dados) then
        update board_itens set titulo = v_titulo, dados = v_dados where id = bi.id; v_atualizados := v_atualizados + 1;
      else v_mantidos := v_mantidos + 1; end if;

    elsif it.kind = 'perg' then
      v_titulo := left(it.d->>'texto', 120);
      select * into av from caso_avisos where contato_id = p_contato and origem_chave = it.k;
      if not found then
        insert into caso_avisos (contato_id, origem_chave, tipo, titulo, resposta_tipo, opcoes, grava_em)
        values (p_contato, it.k, 'pergunta', v_titulo, it.d->>'resposta_tipo', case when it.d ? 'opcoes' then array(select jsonb_array_elements_text(it.d->'opcoes')) end, it.d->>'grava_em');
        v_criados := v_criados + 1;
      elsif av.estado <> 'rascunho' then v_conf := v_conf || it.k;
      elsif (av.titulo, av.resposta_tipo, av.opcoes, av.grava_em) is distinct from (v_titulo, it.d->>'resposta_tipo', case when it.d ? 'opcoes' then array(select jsonb_array_elements_text(it.d->'opcoes')) end, it.d->>'grava_em') then
        update caso_avisos set titulo = v_titulo, resposta_tipo = it.d->>'resposta_tipo', opcoes = case when it.d ? 'opcoes' then array(select jsonb_array_elements_text(it.d->'opcoes')) end, grava_em = it.d->>'grava_em' where id = av.id;
        v_atualizados := v_atualizados + 1;
      else v_mantidos := v_mantidos + 1; end if;
    end if;
  end loop;

  if jsonb_array_length(p_decisoes) > 0 then
    update montagens set estado = 'aprovada_parcial' where id = m.id and estado = 'pendente';
    insert into eventos (contato_id, tipo, dados) values (p_contato, 'montagem_aplicada',
      jsonb_build_object('montagem_id', m.id, 'versao', m.versao, 'criados', v_criados, 'atualizados', v_atualizados, 'mantidos', v_mantidos, 'conflitos', cardinality(v_conf), 'rejeitados', v_rejeitados));
  end if;
  return jsonb_build_object('criados', v_criados, 'atualizados', v_atualizados, 'mantidos', v_mantidos, 'rejeitados', v_rejeitados, 'conflitos', to_jsonb(v_conf));
end;
$$;
revoke all on function public.crm_montagem_aplicar(uuid, bigint, jsonb) from public;
revoke all on function public.crm_montagem_aplicar(uuid, bigint, jsonb) from anon;
grant execute on function public.crm_montagem_aplicar(uuid, bigint, jsonb) to authenticated;

-- ---------- Diff ----------
create or replace function public.crm_montagem_diff(p_contato uuid, p_montagem bigint) returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  m montagens%rowtype;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  select * into m from montagens where id = p_montagem and contato_id = p_contato;
  if not found then raise exception 'montagem_nao_encontrada'; end if;
  return (
    with prop as (select x.k from montagem_itens(m.proposta) x),
    ex as (
      select origem_chave as k, (estado <> 'aberta' or publicada_em is not null or concluida_em is not null) as tocado from caso_acoes where contato_id = p_contato and origem_chave ~ '^(enc|chk):'
      union all select origem_chave, estado <> 'proposto' from board_itens where contato_id = p_contato and origem_chave ~ '^(doc|bloco):'
      union all select origem_chave, estado <> 'rascunho' from caso_avisos where contato_id = p_contato and origem_chave ~ '^perg:'
      union all select origem_chave, estado <> 'proposto' from caso_listas where contato_id = p_contato and origem_chave ~ '^lista:'
    )
    select jsonb_build_object(
      'novos', coalesce((select jsonb_agg(p.k order by p.k) from prop p where not exists (select 1 from ex where ex.k = p.k)), '[]'::jsonb),
      'mantidos', coalesce((select jsonb_agg(p.k order by p.k) from prop p where exists (select 1 from ex where ex.k = p.k and not ex.tocado)), '[]'::jsonb),
      'conflitos', coalesce((select jsonb_agg(p.k order by p.k) from prop p where exists (select 1 from ex where ex.k = p.k and ex.tocado)), '[]'::jsonb),
      'retirar_sugerido', coalesce((select jsonb_agg(ex.k order by ex.k) from ex where not exists (select 1 from prop p where p.k = ex.k)), '[]'::jsonb))
  );
end;
$$;
revoke all on function public.crm_montagem_diff(uuid, bigint) from public;
revoke all on function public.crm_montagem_diff(uuid, bigint) from anon;
grant execute on function public.crm_montagem_diff(uuid, bigint) to authenticated;
