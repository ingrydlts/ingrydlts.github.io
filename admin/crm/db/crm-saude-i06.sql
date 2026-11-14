-- Por Dentro — CRM: a página de saúde (I06) no banco: página aceita, porta gravada no cadastro e filtro de porta no envio
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-previsao.sql. Idempotente (pode rodar de novo).
-- Rode primeiro no Supabase de TESTE e só depois no de produção. Depois, nos dois: db/auditoria-isolamento.sql e
-- db/conferir-banco.sql (os dois do repositório do app). Os dois vazios = pronto.
--
-- Por que existe: a página de saúde (4 portas × 5 pontos, 20 personas) entra no CRM como a página I06. O ponto da saúde já
-- chega pelo campo de sempre (contatos.respostas.objetivo, valores sau-nao-cheguei, sau-sem-numero, sau-esperando,
-- sau-sem-vitale, sau-completo). A porta (estudante, trabalho, aupair, outro) é nova e precisa de lugar, de validação e de filtro.
--
-- O que muda:
--   1. modelos_email_pagina_check passa a aceitar I06, além de I01 a I05. Nenhuma linha existente deixa de valer.
--   2. capturar_lead_guia grava contatos.respostas.porta só se o valor for uma das 4 portas (o resto é ignorado e NÃO derruba o
--      cadastro). O resto da função é igual ao de crm-fase0-email-guia.sql. capturar_lead não muda.
--   3. crm_sequencia_candidatos entrega a porta ao Worker (dados.respostas.porta) e respeita a regra "portas" do Para quem:
--      lista vazia = qualquer porta; com regra, quem não marcou porta não recebe (igual às etapas). Como crm_sequencia_pendentes
--      e crm_sequencia_previstos usam o helper, o envio e o Y mudam juntos.
--
-- Segurança: nenhuma tabela nem função nova. capturar_lead_guia continua security definer, com search_path fixo, sem EXECUTE
-- para public e com EXECUTE para anon e authenticated (é a porta do formulário). O helper continua sem EXECUTE para ninguém.
-- Nenhum dado de pessoa aqui.
--
-- Como desfazer (modelos com a regra "portas" param de filtrar por porta quando a função antiga volta; tire a regra antes):
--   update public.modelos_email set para_quem = para_quem - 'portas' where para_quem ? 'portas';
--   update public.modelos_email set pagina = null, etapa = null where pagina = 'I06';
--   alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
--   alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
--     or pagina in ('I01', 'I02', 'I03', 'I04', 'I05'));
--   e rode de novo crm-fase0-email-guia.sql (capturar_lead_guia antiga) e crm-sequencia-previsao.sql (o helper sem a porta).

-- ---------- 1. A página I06 ----------
alter table public.modelos_email drop constraint if exists modelos_email_pagina_check;
alter table public.modelos_email add constraint modelos_email_pagina_check check (pagina is null
  or pagina in ('I01', 'I02', 'I03', 'I04', 'I05', 'I06'));

-- ---------- 2. O cadastro do guia grava a porta ----------
create or replace function public.capturar_lead_guia(payload jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
  v_link record;
  v_guia text;
  v_id uuid;
  v_cfnivel text;
  v_porta text;
begin
  -- Mesmo cadastro de sempre; se falhar, o erro sobe e nada de link nem de e-mail.
  v_res := public.capturar_lead(payload);
  v_guia := left(coalesce(payload->>'guia', ''), 80);
  select id into v_id from contatos where email = lower(trim(coalesce(payload->>'email', '')));

  -- Nível da candidatura Campus France (só as 6 chaves conhecidas; o resto é ignorado).
  v_cfnivel := crm_token(payload#>>'{respostas,cfNivel}');
  if v_id is not null and v_cfnivel = any (array['l1', 'arq', 'l2l3', 'lpro', 'master', 'escola']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('cfNivel', v_cfnivel)
     where id = v_id;
    -- o quiz_respondido desta mesma chamada passa a mostrar o nível na linha do tempo
    update eventos set dados = dados || jsonb_build_object('cfNivel', v_cfnivel)
     where contato_id = v_id and tipo = 'quiz_respondido' and criado_em = now();
  end if;

  -- Porta da página de saúde (só as 4 conhecidas; o resto é ignorado). O ponto da saúde já entra por respostas.objetivo (sau-…).
  v_porta := crm_token(payload#>>'{respostas,porta}');
  if v_id is not null and v_porta = any (array['estudante', 'trabalho', 'aupair', 'outro']) then
    update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object('porta', v_porta)
     where id = v_id;
    update eventos set dados = dados || jsonb_build_object('porta', v_porta)
     where contato_id = v_id and tipo = 'quiz_respondido' and criado_em = now();
  end if;

  select notion_url, notion_texto into v_link from guias_links where slug = v_guia;

  perform public.crm_guia_email_pedir(v_id, v_guia);

  return v_res || jsonb_strip_nulls(jsonb_build_object(
    'notion_url', v_link.notion_url,
    'notion_texto', v_link.notion_texto));
end;
$$;
revoke all on function public.capturar_lead_guia(jsonb) from public;
grant execute on function public.capturar_lead_guia(jsonb) to anon, authenticated;

-- ---------- 3. A consulta de quem recebe, com a porta ----------
create or replace function public.crm_sequencia_candidatos(p_chave text, p_agora timestamptz, p_ate timestamptz, p_previa boolean)
returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean,
               devido_em timestamptz, dados jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (
    select me.chave, me.tipo, me.para_quem, me.envio_gatilho, me.envio_depois_de, me.envio_dias, me.envio_hora, me.envio_minutos,
           me.envio_ligado_em, v.versao
      from modelos_email me
      left join modelos_email_versoes v on v.chave = me.chave and v.etapa = 'no_ar'
     where me.criado_no_estudio and me.envio_gatilho is not null and me.excluido_em is null
       and (p_previa or me.envio_ligado)
       and (p_chave is null or me.chave = p_chave)
  ),
  base as (
    select m.chave, e.contato_id, min(e.enviado_em) as quando
      from m join emails_enviados e on m.envio_gatilho = 'email' and e.modelo = m.envio_depois_de
     where e.enviado_em is not null and e.status <> 'nao_entregue'
     group by m.chave, e.contato_id
    union all
    select m.chave, ev.contato_id, min(ev.criado_em)
      from m join eventos ev
        on (m.envio_gatilho = 'material' and ev.tipo in ('email_capturado', 'email_recapturado') and ev.dados ->> 'origem' = m.envio_depois_de)
        or (m.envio_gatilho = 'compra' and ev.tipo = 'compra' and ev.dados ->> 'produto' = m.envio_depois_de)
     group by m.chave, ev.contato_id
  ),
  hora as (
    select b.chave, b.contato_id, b.quando, m.envio_minutos,
           ((((b.quando at time zone 'America/Sao_Paulo')::date + m.envio_dias) + make_interval(hours => m.envio_hora))
             at time zone 'America/Sao_Paulo') as h
      from base b join m on m.chave = b.chave
  ),
  devido as (
    select chave, contato_id,
           case when envio_minutos is not null then quando + make_interval(mins => envio_minutos)
                when h < quando then h + interval '1 day'
                else h end as devido_em
      from hora
  )
  select c.id, c.email, c.nome, m.chave, m.versao, m.tipo, c.aceita_novidades, d.devido_em,
         jsonb_strip_nulls(jsonb_build_object(
           'persona', c.persona,
           'respostas', jsonb_strip_nulls(jsonb_build_object('cfNivel', c.respostas -> 'cfNivel', 'objetivo', c.respostas -> 'objetivo',
                                                              'cfCidade', c.respostas -> 'cfCidade',
                                                              'porta', c.respostas -> 'porta')),
           'prazo_limite', c.prazo_limite, 'dias_para_prazo', c.dias_para_prazo,
           'produto', m.para_quem ->> 'produto', 'produto_nome', m.para_quem ->> 'produto_nome'))
    from devido d
    join m on m.chave = d.chave
    join crm_contatos c on c.id = d.contato_id
   where d.devido_em <= p_ate
     and d.devido_em > greatest(p_agora - interval '2 days',
                                case when p_previa then coalesce(m.envio_ligado_em, p_agora) else m.envio_ligado_em end)
     -- Consentimento: novidades só para quem aceitou (o mais recente). Serviço e compra são o que ela pediu ou comprou.
     and (m.tipo <> 'novidades' or c.aceita_novidades)
     -- Para quem
     and (cardinality(crm_lista(m.para_quem, 'personas')) = 0
          or c.persona = any (crm_lista(m.para_quem, 'personas')) or c.personas && crm_lista(m.para_quem, 'personas'))
     and (cardinality(crm_lista(m.para_quem, 'materiais')) = 0 or c.origens && crm_lista(m.para_quem, 'materiais'))
     and (coalesce(m.para_quem ->> 'produto', '') = ''
          or exists (select 1 from eventos x where x.contato_id = c.id and x.tipo = 'compra' and x.dados ->> 'produto' = m.para_quem ->> 'produto'))
     and (cardinality(crm_lista(m.para_quem, 'segmentos')) = 0 or c.segmento = any (crm_lista(m.para_quem, 'segmentos')))
     and (cardinality(crm_lista(m.para_quem, 'estagios')) = 0 or c.estagio = any (crm_lista(m.para_quem, 'estagios')))
     -- A etapa que ela marcou no guia (sem etapa marcada, a regra não deixa passar)
     and (cardinality(crm_lista(m.para_quem, 'etapas')) = 0 or (c.respostas ->> 'objetivo') = any (crm_lista(m.para_quem, 'etapas')))
     -- A porta que ela marcou na página de saúde (sem porta marcada, a regra não deixa passar)
     and (cardinality(crm_lista(m.para_quem, 'portas')) = 0 or (c.respostas ->> 'porta') = any (crm_lista(m.para_quem, 'portas')))
     -- Ainda não recebeu este modelo
     and not exists (select 1 from emails_enviados x where x.contato_id = c.id and x.modelo = m.chave);
$$;
revoke all on function public.crm_sequencia_candidatos(text, timestamptz, timestamptz, boolean) from public, anon, authenticated, service_role;
