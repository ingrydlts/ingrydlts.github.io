-- ENTRAR: o convite de acesso (link que você manda → ela aceita os termos → conta sem senha → teste de 7 dias).
-- Rode DEPOIS de crm-caso.sql, crm-caso-listas.sql, crm-montagem-aplicar.sql e crm-assinaturas.sql. Pode rodar de novo. Só acrescenta.
--
-- O caminho (o Worker faz a parte de fora do banco; o banco só guarda e confere):
--   1. Você clica "Enviar convite de acesso" na ficha. O botão consulta crm_montagem_publicavel(): se não há espaço pronto para ela,
--      avisa em vez de mandar um link para um espaço vazio.
--   2. Ela abre /entrar/, lê os termos e aceita. O Worker cria o usuário SEM senha com o e-mail que já está na ficha e chama
--      crm_entrar_registrar(): grava o consentimento "servico" com o texto exato que ela viu, abre o teste de N dias
--      (assinaturas.status = 'trialing', teste_fim = hoje + N; o app já bloqueia por data em meu_acesso()) e publica o que você já
--      REVISOU (itens do espaço e listas em 'revisado'). O que ainda é proposta fica como está.
--   3. O Worker manda o e-mail com o link para criar a senha. Quem já pagou ou já teve assinatura NÃO tem o teste renovado nem rebaixado.
-- Só o servidor (service_role) executa crm_entrar_registrar. A pessoa nunca escolhe o contato: o Worker acha pelo link assinado.

create or replace function public.crm_entrar_registrar(p_contato uuid, p_dias int, p_versao text, p_texto text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a assinaturas%rowtype;
  v_fim timestamptz;
begin
  if p_dias is null or p_dias not between 1 and 30 then raise exception 'dias_invalidos'; end if;
  if p_versao is null or length(p_versao) not between 1 and 40 or p_texto is null or length(p_texto) not between 20 and 2000 then raise exception 'consentimento_invalido'; end if;
  if not exists (select 1 from contatos where id = p_contato) then raise exception 'contato_nao_encontrado'; end if;

  insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem) values (p_contato, 'servico', true, p_versao, p_texto, 'entrar');

  -- Agora que há consentimento, o que a equipe já revisou chega ao espaço dela (o gatilho confere o consentimento de novo).
  -- Só o que veio da montagem e você liberou: um Bilan ou modelo que você só editou (revisado) não vai sozinho.
  update board_itens set estado = 'publicado' where contato_id = p_contato and estado = 'revisado' and origem_chave ~ '^(doc|bloco):';
  update caso_listas set estado = 'publicado' where contato_id = p_contato and estado = 'revisado' and origem_chave ~ '^lista:';

  select * into a from assinaturas where contato_id = p_contato;
  if found then
    insert into eventos (contato_id, tipo, dados) values (p_contato, 'convite_aceito', jsonb_build_object('teste_novo', false, 'status', a.status));
    return jsonb_build_object('ja_tinha_assinatura', true, 'status', a.status, 'fim_teste', coalesce(a.teste_fim, a.periodo_fim));
  end if;
  v_fim := now() + make_interval(days => p_dias);
  insert into assinaturas (contato_id, status, plano, teste_fim) values (p_contato, 'trialing', 'Teste do 1:1', v_fim);
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'convite_aceito', jsonb_build_object('teste_novo', true, 'dias', p_dias));
  return jsonb_build_object('ja_tinha_assinatura', false, 'status', 'trialing', 'fim_teste', v_fim);
end;
$$;
revoke all on function public.crm_entrar_registrar(uuid, int, text, text) from public;
revoke all on function public.crm_entrar_registrar(uuid, int, text, text) from anon, authenticated;
grant execute on function public.crm_entrar_registrar(uuid, int, text, text) to service_role;

-- O que o botão "Enviar convite de acesso" precisa saber antes de mandar o link.
--   itens_prontos       o que ela veria: itens do espaço e listas revisados ou publicados + passos já publicados (sem a marca "a conferir")
--   itens_proposta      o que ainda é só proposta (não conta como pronto)
--   itens_a_conferir    passos sem fonte (nunca vão para ela até você conferir)
--   conta_ja_existe     já há conta com e-mail confirmado ligada a esta ficha: nesse caso o caminho é o aviso de espaço atualizado
create or replace function public.crm_montagem_publicavel(p_contato uuid) returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_prontos int; v_proposta int; v_conf int; v_conta boolean; v_ass boolean; v_itens jsonb;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  select (select count(*) from board_itens where contato_id = p_contato and estado in ('revisado', 'publicado'))
       + (select count(*) from caso_listas where contato_id = p_contato and estado in ('revisado', 'publicado'))
       + (select count(*) from caso_acoes where contato_id = p_contato and publicada_em is not null and not a_conferir and dono = 'ela' and canal = 'plataforma')
    into v_prontos;
  select (select count(*) from board_itens where contato_id = p_contato and estado = 'proposto')
       + (select count(*) from caso_listas where contato_id = p_contato and estado = 'proposto')
    into v_proposta;
  select count(*) into v_conf from caso_acoes where contato_id = p_contato and a_conferir;
  select exists (select 1 from contatos c join auth.users u on u.id = c.user_id where c.id = p_contato and u.email_confirmed_at is not null) into v_conta;
  select exists (select 1 from assinaturas where contato_id = p_contato) into v_ass;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo) order by t.id), '[]'::jsonb) into v_itens
    from (select id, titulo from caso_acoes where contato_id = p_contato and a_conferir order by id limit 20) t;
  return jsonb_build_object('ha_rascunho_aprovado', v_prontos > 0, 'itens_prontos', v_prontos, 'itens_proposta', v_proposta, 'itens_a_conferir', v_conf, 'conta_ja_existe', v_conta, 'tem_assinatura', v_ass, 'a_conferir_itens', v_itens);
end;
$$;
revoke all on function public.crm_montagem_publicavel(uuid) from public;
revoke all on function public.crm_montagem_publicavel(uuid) from anon;
grant execute on function public.crm_montagem_publicavel(uuid) to authenticated;

-- Linha do tempo: o Worker registra o envio do convite e do aviso de espaço atualizado (com o token do admin). Só estes tipos.
create or replace function public.crm_evento_admin(p_contato uuid, p_tipo text, p_dados jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_tipo is null or p_tipo <> all (array['convite_enviado', 'espaco_atualizado_aviso']) then raise exception 'evento_nao_permitido'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or octet_length(p_dados::text) > 1000 then raise exception 'dados_invalidos'; end if;
  insert into eventos (contato_id, tipo, dados) values (p_contato, p_tipo, p_dados);
end;
$$;
revoke all on function public.crm_evento_admin(uuid, text, jsonb) from public;
revoke all on function public.crm_evento_admin(uuid, text, jsonb) from anon;
grant execute on function public.crm_evento_admin(uuid, text, jsonb) to authenticated;
