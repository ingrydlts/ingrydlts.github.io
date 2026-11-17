-- PERSONA DE TESTE para ver a visão de valores do CRM ("Já gastou" na ficha e o Revenue da home).
-- Rode SÓ no Supabase de TESTE, depois de crm-assinaturas.sql e crm-pagamentos.sql. Pode rodar de novo: recomeça a persona do zero.
--
-- Quem ela é: Camila Valores (persona au pair → estudante), já assinante da plataforma, com 3 pagamentos reais registrados:
--   há 12 dias   € 60,00   1:1 de onboarding (avulso, antes de ser membro; 1:1 de 45 min da página de preços)
--   há 10 dias   € 70,00   Plataforma, 1ª mensalidade
--   há  2 dias   € 42,50   Ligação a terceiros (preço de membro: € 50 com 15% de desconto)
--   Total: € 172,50. Na home, "7 dias" soma € 42,50 e "14 dias" soma € 172,50: dá para conferir a troca de período.
--
-- Segurança: o e-mail é de @example.com com "+teste": nenhuma cliente real tem esse endereço, e este arquivo só mexe nele
-- (o delete é por esse e-mail; os pagamentos e a assinatura dela saem junto, por on delete cascade). Não cria conta de login:
-- é só a ficha no CRM. Para apagar a persona: delete from public.contatos where email = 'camila.valores+teste@example.com';

do $$
declare
  v_email constant text := 'camila.valores+teste@example.com';
  v_id uuid;
begin
  if to_regclass('public.pagamentos') is null then
    raise exception 'Falta rodar admin/crm/db/crm-pagamentos.sql neste banco.';
  end if;
  if to_regclass('public.assinaturas') is null then
    raise exception 'Falta rodar admin/crm/db/crm-assinaturas.sql neste banco.';
  end if;

  delete from public.contatos where email = v_email;   -- recomeça do zero (pagamentos e assinatura caem junto)

  insert into public.contatos (email, nome, persona, fase, origem, estagio, criado_em, ultimo_evento_em)
  values (v_email, 'Camila Valores', 'au_pair_estudante', 'adaptando', 'seed_teste', 'em_uso', now() - interval '20 days', now() - interval '1 day')
  returning id into v_id;

  insert into public.assinaturas (contato_id, stripe_customer_id, stripe_subscription_id, status, plano, moeda, periodo_fim, cancela_no_fim, criado_em, atualizado_em)
  values (v_id, 'cus_seed_valores', 'sub_seed_valores', 'active', 'Plataforma Por Dentro', 'EUR', now() + interval '20 days', false, now() - interval '10 days', now());

  insert into public.pagamentos (contato_id, referencia, tipo, servico, valor_centavos, moeda, pago_em) values
    (v_id, 'seed-valores-1a1',      '1a1',        '1:1 de onboarding (45 min)',  6000, 'EUR', now() - interval '12 days'),
    (v_id, 'seed-valores-mensal-1', 'assinatura', 'Plataforma Por Dentro · mensalidade', 7000, 'EUR', now() - interval '10 days'),
    (v_id, 'seed-valores-ligacao',  'outro',      'Ligação a terceiros (membro)', 4250, 'EUR', now() - interval '2 days');
end;
$$;

-- Conferência: deve mostrar 3 linhas e total 17250.
select p.servico, p.valor_centavos, p.moeda, p.pago_em::date as quando
  from public.pagamentos p join public.contatos c on c.id = p.contato_id
 where c.email = 'camila.valores+teste@example.com'
 order by p.pago_em desc;
