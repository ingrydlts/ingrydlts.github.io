-- ENTRAR: o convite de acesso (link que você manda → ela aceita os termos → vai ao pagamento no Stripe com 7 dias grátis e cartão).
-- Rode DEPOIS de crm-caso.sql, crm-caso-listas.sql, crm-montagem-aplicar.sql e crm-assinaturas.sql. Pode rodar de novo. Só acrescenta.
--
-- O caminho (o Worker faz a parte de fora do banco; o banco só guarda e confere):
--   1. Você clica "Enviar convite de acesso" na ficha. O botão consulta crm_montagem_publicavel(): se não há espaço pronto para ela,
--      avisa em vez de mandar um link para um espaço vazio.
--   2. Ela abre /entrar/, lê os termos e aceita. O Worker chama crm_entrar_consentir(): grava o consentimento "servico" com o texto
--      exato que ela viu e publica o que você LIBEROU na montagem (itens do espaço e listas que vieram dela e estão em 'revisado').
--   3. A página leva ela à escolha do plano (/planos/), que abre o Payment Link do Stripe: o CARTÃO e o TESTE de 7 dias são do Stripe.
--      O webhook existente cria a conta sem senha com o e-mail da ficha, grava a assinatura (trialing) e manda o e-mail com o link
--      para criar a senha. Nada disso mudou.
-- Só o servidor (service_role) executa crm_entrar_consentir. A pessoa nunca escolhe o contato: o Worker acha pelo link assinado.

create or replace function public.crm_entrar_consentir(p_contato uuid, p_versao text, p_texto text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_versao is null or length(p_versao) not between 1 and 40 or p_texto is null or length(p_texto) not between 20 and 2000 then raise exception 'consentimento_invalido'; end if;
  if not exists (select 1 from contatos where id = p_contato) then raise exception 'contato_nao_encontrado'; end if;

  -- Não duplica: só grava se o consentimento mais recente não é este mesmo (mesma versão, aceito).
  if not exists (select 1 from (select versao, aceito from consentimentos where contato_id = p_contato and finalidade = 'servico' order by criado_em desc, id desc limit 1) u
                  where u.versao = p_versao and u.aceito) then
    insert into consentimentos (contato_id, finalidade, aceito, versao, texto, origem) values (p_contato, 'servico', true, p_versao, p_texto, 'entrar');
  end if;

  -- Agora que há consentimento, o que você liberou na montagem chega ao espaço dela.
  -- Só o que veio da montagem: um Bilan ou modelo que você só editou (revisado) não vai sozinho.
  update board_itens set estado = 'publicado' where contato_id = p_contato and estado = 'revisado' and origem_chave ~ '^(doc|bloco):';
  update caso_listas set estado = 'publicado' where contato_id = p_contato and estado = 'revisado' and origem_chave ~ '^lista:';
  insert into eventos (contato_id, tipo, dados) values (p_contato, 'convite_aceito', jsonb_build_object('versao', p_versao));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.crm_entrar_consentir(uuid, text, text) from public;
revoke all on function public.crm_entrar_consentir(uuid, text, text) from anon, authenticated;
grant execute on function public.crm_entrar_consentir(uuid, text, text) to service_role;

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
