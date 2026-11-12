-- Por Dentro — CRM: importar o caso a partir da página do Notion (rascunhos do board, das ações, dos achados e dos avisos)
-- Rode no SQL Editor do Supabase DEPOIS de crm-caso.sql. Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
-- Quem chama é o Worker (POST /api/crm/onboarding/notion/ler), com o token da própria Ingryd; por isso a função confere eh_admin().
--
-- O que muda:
--   1. caso_acoes ganha prazo_texto (o prazo que não é uma data: "dia seguinte à ligação", "(a confirmar)").
--   2. board_itens e caso_avisos ganham origem_chave: a chave estável de quem veio do Notion, para ler a mesma página de novo não
--      duplicar nada. Única por pessoa. O que a equipe cria à mão não tem chave.
--   3. crm_caso_importar(contato, payload): cria ou atualiza os RASCUNHOS do caso. Nada chega à pessoa por aqui:
--        achados  nascem "conferir";  ações nascem sem publicar;  itens do board nascem "proposto";  avisos nascem "rascunho".
--      Reler a página só atualiza o que ainda é rascunho. O que a Ingryd já conferiu, publicou, concluiu ou aprovou NUNCA é
--      mudado: a função só conta como "pulado" quando a página mudou e o CRM ficou como estava.
--   4. meu_caso() passa a devolver prazo_texto e botao (o que o passo pede dela) nas ações dela (substitui a função de crm-caso.sql).
--   5. crm_evento_recente() ganha o evento 'caso_importado' na lista do que é feito por você (não zera o "parada há N dias").
--      ATENÇÃO: se rodar crm-propostas.sql ou crm-caso.sql de novo depois deste, rode este de novo.

alter table public.caso_acoes add column if not exists prazo_texto text check (prazo_texto is null or length(prazo_texto) <= 80);
alter table public.board_itens add column if not exists origem_chave text check (origem_chave is null or origem_chave ~ '^[a-z0-9_:.-]{1,80}$');
alter table public.caso_avisos add column if not exists origem_chave text check (origem_chave is null or origem_chave ~ '^[a-z0-9_:.-]{1,80}$');
create unique index if not exists board_itens_origem_idx on public.board_itens (contato_id, origem_chave) where origem_chave is not null;
create unique index if not exists caso_avisos_origem_idx on public.caso_avisos (contato_id, origem_chave) where origem_chave is not null;

-- ---------- Você (via Worker) ----------
-- payload: { achados: [{chave, tipo, texto, origem, certeza, citacao}], acoes: [{n, titulo, dono, canal, botao, prazo, prazo_texto,
--            prazo_a_confirmar, estado, certeza, passo_chave}], itens: [{origem_chave, tipo, titulo, resumo, dados, ordem}],
--            avisos: [{origem_chave, tipo, titulo, texto, resposta_tipo, opcoes, grava_em, destino, dias_apos}], fonte: {pagina, editada_em} }
-- Devolve as contagens por grupo: novos, atualizados, mantidos (a página não mudou) e pulados (a página mudou, mas o CRM já tem decisão sua).
-- Tudo ou nada: um valor fora das regras das tabelas desfaz a importação inteira (as tabelas têm as mesmas travas de sempre).
create or replace function public.crm_caso_importar(p_contato uuid, p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  x jsonb;
  v_ach jsonb; v_aco jsonb; v_itn jsonb; v_avs jsonb;
  a_n int := 0; a_a int := 0; a_m int := 0; a_p int := 0;   -- achados
  c_n int := 0; c_a int := 0; c_m int := 0; c_p int := 0;   -- ações
  i_n int := 0; i_a int := 0; i_m int := 0; i_p int := 0;   -- itens
  v_n int := 0; v_a int := 0; v_m int := 0; v_p int := 0;   -- avisos
  ach caso_achados%rowtype;
  aco caso_acoes%rowtype;
  itn board_itens%rowtype;
  avs caso_avisos%rowtype;
  v_opcoes text[];
  v_prazo date;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if not exists (select 1 from contatos where id = p_contato) then
    raise exception 'contato_nao_encontrado';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_invalido';
  end if;
  v_ach := coalesce(p_payload->'achados', '[]'::jsonb);
  v_aco := coalesce(p_payload->'acoes', '[]'::jsonb);
  v_itn := coalesce(p_payload->'itens', '[]'::jsonb);
  v_avs := coalesce(p_payload->'avisos', '[]'::jsonb);
  if jsonb_typeof(v_ach) <> 'array' or jsonb_typeof(v_aco) <> 'array' or jsonb_typeof(v_itn) <> 'array' or jsonb_typeof(v_avs) <> 'array'
     or jsonb_array_length(v_ach) > 60 or jsonb_array_length(v_aco) > 120 or jsonb_array_length(v_itn) > 60 or jsonb_array_length(v_avs) > 10 then
    raise exception 'payload_invalido';
  end if;
  -- Duas leituras ao mesmo tempo da mesma pessoa esperam uma pela outra (e nunca duplicam).
  perform pg_advisory_xact_lock(hashtext('caso_importar:' || p_contato::text));

  -- ---- achados: o que o CRM entendeu. Só se atualiza o que ainda está em conferência.
  for x in select * from jsonb_array_elements(v_ach) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'chave', '') = '' then raise exception 'payload_invalido'; end if;
    select * into ach from caso_achados where contato_id = p_contato and chave = x->>'chave';
    if not found then
      insert into caso_achados (contato_id, chave, tipo, texto, origem, certeza, citacao)
      values (p_contato, x->>'chave', x->>'tipo', x->>'texto', coalesce(x->>'origem', 'conversa'), coalesce(x->>'certeza', 'a_confirmar'), nullif(x->>'citacao', ''));
      a_n := a_n + 1;
    elsif (ach.tipo, ach.texto, ach.certeza) is not distinct from (x->>'tipo', x->>'texto', coalesce(x->>'certeza', 'a_confirmar')) then
      a_m := a_m + 1;
    elsif ach.estado <> 'conferir' then
      a_p := a_p + 1;
    else
      update caso_achados set tipo = x->>'tipo', texto = x->>'texto', certeza = coalesce(x->>'certeza', 'a_confirmar') where id = ach.id;
      a_a := a_a + 1;
    end if;
  end loop;

  -- ---- ações: a tabela Pendência × Canal. Só se atualiza o que ainda não foi publicado nem concluído por ela.
  for x in select * from jsonb_array_elements(v_aco) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'n', '') !~ '^[0-9]{1,3}$' then raise exception 'payload_invalido'; end if;
    v_prazo := nullif(x->>'prazo', '')::date;
    select * into aco from caso_acoes where contato_id = p_contato and n = (x->>'n')::smallint;
    if not found then
      insert into caso_acoes (contato_id, n, titulo, dono, canal, botao, prazo, prazo_texto, prazo_a_confirmar, estado, certeza, passo_chave)
      values (p_contato, (x->>'n')::smallint, x->>'titulo', x->>'dono', x->>'canal', nullif(x->>'botao', ''), v_prazo, nullif(x->>'prazo_texto', ''),
              coalesce((x->>'prazo_a_confirmar')::boolean, false), coalesce(x->>'estado', 'aberta'), coalesce(x->>'certeza', 'literal'), nullif(x->>'passo_chave', ''));
      c_n := c_n + 1;
    elsif (aco.titulo, aco.dono, aco.canal, aco.botao, aco.prazo, aco.prazo_texto, aco.prazo_a_confirmar, aco.estado, aco.certeza, aco.passo_chave)
          is not distinct from (x->>'titulo', x->>'dono', x->>'canal', nullif(x->>'botao', ''), v_prazo, nullif(x->>'prazo_texto', ''),
                                coalesce((x->>'prazo_a_confirmar')::boolean, false), coalesce(x->>'estado', 'aberta'), coalesce(x->>'certeza', 'literal'), nullif(x->>'passo_chave', '')) then
      c_m := c_m + 1;
    elsif aco.publicada_em is not null or aco.concluida_por is not null then
      c_p := c_p + 1;
    else
      update caso_acoes set titulo = x->>'titulo', dono = x->>'dono', canal = x->>'canal', botao = nullif(x->>'botao', ''), prazo = v_prazo,
             prazo_texto = nullif(x->>'prazo_texto', ''), prazo_a_confirmar = coalesce((x->>'prazo_a_confirmar')::boolean, false),
             estado = coalesce(x->>'estado', 'aberta'), certeza = coalesce(x->>'certeza', 'literal'), passo_chave = nullif(x->>'passo_chave', '')
       where id = aco.id;
      c_a := c_a + 1;
    end if;
  end loop;

  -- ---- itens do board: sempre "proposto". Só se atualiza o que ainda é proposto (revisado ou publicado já é decisão sua).
  for x in select * from jsonb_array_elements(v_itn) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'origem_chave', '') = '' then raise exception 'payload_invalido'; end if;
    select * into itn from board_itens where contato_id = p_contato and origem_chave = x->>'origem_chave';
    if not found then
      insert into board_itens (contato_id, origem_chave, tipo, titulo, resumo, dados, ordem)
      values (p_contato, x->>'origem_chave', x->>'tipo', x->>'titulo', nullif(x->>'resumo', ''), coalesce(x->'dados', '{}'::jsonb), nullif(x->>'ordem', '')::smallint);
      i_n := i_n + 1;
    elsif (itn.titulo, itn.resumo, itn.dados, itn.ordem) is not distinct from (x->>'titulo', nullif(x->>'resumo', ''), coalesce(x->'dados', '{}'::jsonb), nullif(x->>'ordem', '')::smallint) then
      i_m := i_m + 1;
    elsif itn.estado <> 'proposto' then
      i_p := i_p + 1;
    else
      update board_itens set titulo = x->>'titulo', resumo = nullif(x->>'resumo', ''), dados = coalesce(x->'dados', '{}'::jsonb),
             ordem = nullif(x->>'ordem', '')::smallint, versao = versao + 1
       where id = itn.id;
      i_a := i_a + 1;
    end if;
  end loop;

  -- ---- avisos: sempre "rascunho" (quem aprova e escolhe a data é você). Só se atualiza o que ainda é rascunho.
  for x in select * from jsonb_array_elements(v_avs) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'origem_chave', '') = '' then raise exception 'payload_invalido'; end if;
    v_opcoes := case when jsonb_typeof(x->'opcoes') = 'array' then array(select jsonb_array_elements_text(x->'opcoes')) end;
    select * into avs from caso_avisos where contato_id = p_contato and origem_chave = x->>'origem_chave';
    if not found then
      insert into caso_avisos (contato_id, origem_chave, tipo, titulo, texto, resposta_tipo, opcoes, grava_em, destino, dias_apos)
      values (p_contato, x->>'origem_chave', x->>'tipo', x->>'titulo', nullif(x->>'texto', ''), nullif(x->>'resposta_tipo', ''), v_opcoes,
              nullif(x->>'grava_em', ''), case when jsonb_typeof(x->'destino') = 'object' then x->'destino' end, coalesce((x->>'dias_apos')::smallint, 1));
      v_n := v_n + 1;
    elsif (avs.tipo, avs.titulo, avs.texto, avs.resposta_tipo, avs.opcoes, avs.grava_em, avs.destino, avs.dias_apos)
          is not distinct from (x->>'tipo', x->>'titulo', nullif(x->>'texto', ''), nullif(x->>'resposta_tipo', ''), v_opcoes, nullif(x->>'grava_em', ''),
                                case when jsonb_typeof(x->'destino') = 'object' then x->'destino' end, coalesce((x->>'dias_apos')::smallint, 1)) then
      v_m := v_m + 1;
    elsif avs.estado <> 'rascunho' then
      v_p := v_p + 1;
    else
      update caso_avisos set tipo = x->>'tipo', titulo = x->>'titulo', texto = nullif(x->>'texto', ''), resposta_tipo = nullif(x->>'resposta_tipo', ''),
             opcoes = v_opcoes, grava_em = nullif(x->>'grava_em', ''), destino = case when jsonb_typeof(x->'destino') = 'object' then x->'destino' end,
             dias_apos = coalesce((x->>'dias_apos')::smallint, 1)
       where id = avs.id;
      v_a := v_a + 1;
    end if;
  end loop;

  -- Linha do tempo (nunca derruba a importação).
  begin
    insert into eventos (contato_id, tipo, dados)
    values (p_contato, 'caso_importado', jsonb_build_object('pagina', left(coalesce(p_payload#>>'{fonte,pagina}', ''), 40),
            'novos', a_n + c_n + i_n + v_n, 'atualizados', a_a + c_a + i_a + v_a));
  exception when others then
    raise warning 'crm_caso_importar: %', sqlerrm;
  end;

  return jsonb_build_object(
    'achados', jsonb_build_object('novos', a_n, 'atualizados', a_a, 'mantidos', a_m, 'pulados', a_p),
    'acoes',   jsonb_build_object('novos', c_n, 'atualizados', c_a, 'mantidos', c_m, 'pulados', c_p),
    'itens',   jsonb_build_object('novos', i_n, 'atualizados', i_a, 'mantidos', i_m, 'pulados', i_p),
    'avisos',  jsonb_build_object('novos', v_n, 'atualizados', v_a, 'mantidos', v_m, 'pulados', v_p));
end;
$$;
revoke all on function public.crm_caso_importar(uuid, jsonb) from public;
revoke all on function public.crm_caso_importar(uuid, jsonb) from anon;
grant execute on function public.crm_caso_importar(uuid, jsonb) to authenticated;

-- ---------- Pessoa logada ----------
-- Substitui meu_caso() de crm-caso.sql só para as ações dela levarem também o prazo em texto.
create or replace function public.meu_caso() returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    return null;
  end if;
  return jsonb_build_object(
    'board', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'tipo', b.tipo, 'titulo', b.titulo, 'resumo', b.resumo, 'dados', b.dados,
               'dados_dela', b.dados_dela, 'ordem', b.ordem, 'link', b.link, 'tem_arquivo', (b.arquivo_caminho is not null or b.link is not null),
               'publicado_em', b.publicado_em) order by b.ordem nulls last, b.id)
        from board_itens b where b.contato_id = v_c and b.estado = 'publicado'), '[]'::jsonb),
    'acoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'n', a.n, 'titulo', a.titulo, 'passo_chave', a.passo_chave, 'prazo', a.prazo,
               'prazo_texto', a.prazo_texto, 'prazo_a_confirmar', a.prazo_a_confirmar, 'estado', a.estado, 'botao', a.botao) order by a.n nulls last, a.id)
        from caso_acoes a where a.contato_id = v_c and a.dono = 'ela' and a.canal = 'plataforma' and a.publicada_em is not null), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'resposta_tipo', a.resposta_tipo,
               'opcoes', to_jsonb(a.opcoes), 'destino', a.destino, 'liberar_em', a.liberar_em, 'lido', a.estado = 'lido') order by a.liberar_em, a.id)
        from caso_avisos a where a.contato_id = v_c and public.caso_aviso_visivel(a)), '[]'::jsonb),
    'respondidas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'resposta', r.resposta, 'respondido_em', r.respondido_em) order by r.respondido_em desc)
        from (select * from caso_avisos where contato_id = v_c and estado = 'respondido' order by respondido_em desc limit 10) r), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.meu_caso() from public;
revoke all on function public.meu_caso() from anon;
grant execute on function public.meu_caso() to authenticated;

-- Substitui a função de crm-caso.sql só para acrescentar 'caso_importado' à lista do que é feito por você.
create or replace function public.crm_evento_recente() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> all (array['estagio_alterado', 'sinal_enviado', 'email_enviado', 'pergunta_respondida', 'um_a_um_agendado', 'proposta_enviada',
                            'caso_achado_conferido', 'caso_acao_equipe', 'caso_item_publicado', 'caso_item_retirado',
                            'caso_aviso_agendado', 'caso_aviso_liberado', 'caso_importado']) then
    update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id;
  end if;
  return new;
end;
$$;
