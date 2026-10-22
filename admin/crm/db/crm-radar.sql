-- Por Dentro — CRM: o Radar (PESTEL por persona → Home de cada pessoa na plataforma)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos, eventos, sinais e eh_admin()) e de
-- crm-fase3-cerebro.sql (usa crm_cerebro_chave_ok()). Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- Para que serve: o PESTEL (político, econômico, social, tecnológico, ambiental, legal) que você mantém no Cérebro é
-- GERAL, por tema, e serve para captar quem ainda não é cliente (posts). Aqui ele vira PARTICULAR: um item do Radar é
-- um fato de um fator, já traduzido para UMA persona (o que mudou, o que isso muda para ela, o que fazer, com fonte e
-- data). Você escolhe a quem mandar — a persona inteira ou pessoas específicas, com uma nota sua — e o item aparece na
-- seção "Radar do seu caso" da Home dela. O mesmo fato, dois usos; o do CRM sai primeiro (ver `avisado_em`).
--
--   radar_itens    um fato por persona e fator (o PESTEL do CRM)
--   radar_envios   o que você mandou para quem: uma linha por pessoa e item, com a nota sua e quando ela viu
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo via RLS (eh_admin()); manda por radar_enviar()
--   pessoa logada  → meu_radar() (só o que mandaram para ela) e marcar_radar_visto()
--   hub (chave)    → radar_importar_cerebro() traz o PESTEL do Cérebro; radar_para_cerebro() devolve o que já foi
--                    avisado aos clientes (a regra "o lead chega primeiro que o post")
--
-- O aviso para a pessoa NÃO é um canal novo: cada envio cria uma linha em `sinais` (o sininho do app e, depois, a
-- notificação no celular leem dali). Tudo que você faz para a pessoa passa pela mesma fila.

create table if not exists public.radar_itens (
  id bigint generated always as identity primary key,
  persona text not null check (persona in ('au_pair_estudante', 'campus_france', 'alternancia_emprego', 'conjuge', 'pvt')),
  fator text not null check (fator in ('politico', 'economico', 'social', 'tecnologico', 'ambiental', 'legal')),
  titulo text not null check (length(titulo) between 1 and 120),
  texto text not null check (length(texto) between 1 and 600),       -- o que mudou (o fato)
  impacto text check (impacto is null or length(impacto) <= 400),    -- o que isso muda para essa persona
  acao text check (acao is null or length(acao) <= 300),             -- o que fazer
  fonte_rotulo text check (fonte_rotulo is null or length(fonte_rotulo) <= 80),
  fonte_url text check (fonte_url is null or (length(fonte_url) <= 500 and fonte_url ~ '^https://')),
  verificado_em date not null default current_date,                  -- quando você conferiu na fonte
  vigente_ate date,                                                  -- null = sem data de validade
  tema text check (tema is null or length(tema) <= 80),              -- o guarda-chuva do Cérebro de onde veio
  origem text not null default 'manual' check (origem in ('manual', 'cerebro')),
  cerebro_ref text check (cerebro_ref is null or length(cerebro_ref) <= 120),
  avisado_em timestamptz,                                            -- 1º envio a um cliente; null = nenhum cliente avisado ainda
  criado_em timestamptz not null default now(),
  arquivado_em timestamptz
);
create index if not exists radar_itens_persona_idx on public.radar_itens (persona, criado_em desc);
-- Reimportar o mesmo tema do Cérebro atualiza o item em vez de duplicar.
create unique index if not exists radar_itens_cerebro_idx on public.radar_itens (cerebro_ref, persona, fator) where cerebro_ref is not null;

create table if not exists public.radar_envios (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.radar_itens(id) on delete cascade,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  nota text check (nota is null or length(nota) <= 300),             -- sua nota para essa pessoa
  enviado_em timestamptz not null default now(),
  visto_em timestamptz,
  unique (item_id, contato_id)
);
create index if not exists radar_envios_contato_idx on public.radar_envios (contato_id, enviado_em desc);

alter table public.radar_itens enable row level security;
alter table public.radar_envios enable row level security;
drop policy if exists "radar_itens: só admin" on public.radar_itens;
create policy "radar_itens: só admin" on public.radar_itens
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "radar_envios: só admin" on public.radar_envios;
create policy "radar_envios: só admin" on public.radar_envios
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.radar_itens, public.radar_envios from anon;

-- ---------- Você: mandar ----------
-- p_contatos nulo = a persona inteira do item (só quem já tem conta e não está inativo); com lista = só essas pessoas
-- (as sem conta ficam de fora: não teriam onde ver). Quem já recebeu o item não recebe de novo. Devolve quantas
-- pessoas receberam agora.
create or replace function public.radar_enviar(p_item bigint, p_contatos uuid[] default null, p_nota text default null) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_persona text;
  v_n int;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select persona into v_persona from radar_itens where id = p_item and arquivado_em is null;
  if v_persona is null then
    raise exception 'item_nao_encontrado';
  end if;
  p_nota := nullif(left(trim(coalesce(p_nota, '')), 300), '');

  with alvo as (
    select c.id from contatos c
     where c.user_id is not null
       and case when p_contatos is null then c.persona = v_persona and c.estagio <> 'inativo' else c.id = any (p_contatos) end
  ), novos as (
    insert into radar_envios (item_id, contato_id, nota)
    select p_item, id, p_nota from alvo
    on conflict (item_id, contato_id) do nothing
    returning 1
  )
  select count(*) into v_n from novos;
  return v_n;
end;
$$;
revoke all on function public.radar_enviar(bigint, uuid[], text) from public, anon;
grant execute on function public.radar_enviar(bigint, uuid[], text) to authenticated;

-- Cada envio avisa a pessoa (sinal = sininho / futura notificação) e marca o item como "cliente já avisado".
-- Nunca derruba o envio.
create or replace function public.crm_on_radar_envio() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_titulo text;
begin
  begin
    select titulo into v_titulo from radar_itens where id = new.item_id;
    insert into sinais (contato_id, mensagem) values (new.contato_id, left('Novo no seu Radar: ' || coalesce(v_titulo, ''), 500));
    update radar_itens set avisado_em = coalesce(avisado_em, now()) where id = new.item_id;
  exception when others then
    raise warning 'crm_on_radar_envio: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists crm_radar_envios_aviso on public.radar_envios;
create trigger crm_radar_envios_aviso after insert on public.radar_envios
  for each row execute function public.crm_on_radar_envio();

-- ---------- Pessoa logada: ler ----------
-- O que mandaram para ESTA pessoa (os 20 mais recentes, sem o que você arquivou). 'vencido' já vem calculado.
create or replace function public.meu_radar() returns table (
  envio_id bigint, item_id bigint, fator text, titulo text, texto text, impacto text, acao text,
  fonte_rotulo text, fonte_url text, verificado_em date, vigente_ate date, vencido boolean,
  nota text, enviado_em timestamptz, visto_em timestamptz)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select e.id, i.id, i.fator, i.titulo, i.texto, i.impacto, i.acao, i.fonte_rotulo, i.fonte_url, i.verificado_em,
         i.vigente_ate, (i.vigente_ate is not null and i.vigente_ate < current_date), e.nota, e.enviado_em, e.visto_em
    from radar_envios e
    join radar_itens i on i.id = e.item_id
    join contatos c on c.id = e.contato_id
   where c.user_id = auth.uid() and i.arquivado_em is null
   order by e.enviado_em desc, e.id desc
   limit 20;
$$;
revoke all on function public.meu_radar() from public, anon;
grant execute on function public.meu_radar() to authenticated;

-- A pessoa abriu o item (só avança, nunca volta). Vira evento na ficha: é coisa DELA, então zera o "parada há N dias".
create or replace function public.marcar_radar_visto(p_envio bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_contato uuid;
  v_titulo text;
begin
  update radar_envios e set visto_em = now()
    from contatos c
   where e.id = p_envio and c.id = e.contato_id and c.user_id = auth.uid() and e.visto_em is null
  returning e.contato_id into v_contato;
  if v_contato is null then return; end if;
  begin
    select i.titulo into v_titulo from radar_envios e join radar_itens i on i.id = e.item_id where e.id = p_envio;
    insert into eventos (contato_id, tipo, dados)
    values (v_contato, 'radar_visto', jsonb_build_object('envio_id', p_envio, 'titulo', left(coalesce(v_titulo, ''), 120)));
  exception when others then
    raise warning 'marcar_radar_visto: %', sqlerrm;
  end;
end;
$$;
revoke all on function public.marcar_radar_visto(bigint) from public, anon;
grant execute on function public.marcar_radar_visto(bigint) to authenticated;

-- ---------- Hub (chave revogável): a ponte com o Cérebro ----------
-- O Cérebro entrega o PESTEL por tema; quem decide a quais personas ele serve é o hub, que manda um item por persona.
-- p_itens: [{persona, fator, titulo, texto, impacto?, acao?, fonte_rotulo?, fonte_url?, verificado_em?, vigente_ate?,
--            tema, cerebro_ref}]. Reenviar atualiza o item (mesma cerebro_ref + persona + fator); o que já foi enviado a
-- clientes continua enviado. Item inválido é pulado e contado, sem derrubar o lote.
create or replace function public.radar_importar_cerebro(p_chave text, p_itens jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  x jsonb;
  v_novos int := 0;
  v_atualizados int := 0;
  v_pulados int := 0;
  v_ref text;
  v_antes boolean;
begin
  if not public.crm_cerebro_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 100 then
    raise exception 'formato_invalido';
  end if;

  for x in select * from jsonb_array_elements(p_itens) loop
    begin
      v_ref := nullif(left(trim(coalesce(x->>'cerebro_ref', '')), 120), '');
      if v_ref is null then raise exception 'sem_cerebro_ref'; end if;
      select exists (select 1 from radar_itens where cerebro_ref = v_ref and persona = x->>'persona' and fator = x->>'fator') into v_antes;
      insert into radar_itens (persona, fator, titulo, texto, impacto, acao, fonte_rotulo, fonte_url, verificado_em, vigente_ate, tema, origem, cerebro_ref)
      values (x->>'persona', x->>'fator', x->>'titulo', x->>'texto', nullif(x->>'impacto', ''), nullif(x->>'acao', ''),
              nullif(x->>'fonte_rotulo', ''), nullif(x->>'fonte_url', ''),
              coalesce(nullif(x->>'verificado_em', '')::date, current_date), nullif(x->>'vigente_ate', '')::date,
              nullif(left(x->>'tema', 80), ''), 'cerebro', v_ref)
      on conflict (cerebro_ref, persona, fator) where cerebro_ref is not null
      do update set titulo = excluded.titulo, texto = excluded.texto, impacto = excluded.impacto, acao = excluded.acao,
                    fonte_rotulo = excluded.fonte_rotulo, fonte_url = excluded.fonte_url,
                    verificado_em = excluded.verificado_em, vigente_ate = excluded.vigente_ate, tema = excluded.tema,
                    arquivado_em = null;
      if v_antes then v_atualizados := v_atualizados + 1; else v_novos := v_novos + 1; end if;
    exception when others then
      v_pulados := v_pulados + 1;
    end;
  end loop;
  return jsonb_build_object('novos', v_novos, 'atualizados', v_atualizados, 'pulados', v_pulados);
end;
$$;
revoke all on function public.radar_importar_cerebro(text, jsonb) from public;
grant execute on function public.radar_importar_cerebro(text, jsonb) to anon, authenticated;

-- O que o hub precisa para respeitar "o cliente recebe antes do post": por tema, quantos itens já foram avisados a
-- clientes e quantos ainda não. Só contagens, sem pessoa.
create or replace function public.radar_para_cerebro(p_chave text) returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.crm_cerebro_chave_ok(p_chave) then
    raise exception 'chave_invalida';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'cerebro_ref', t.cerebro_ref, 'tema', t.tema, 'itens', t.itens, 'avisados', t.avisados) order by t.cerebro_ref)
      from (
        select i.cerebro_ref, max(i.tema) as tema, count(*)::int as itens, count(i.avisado_em)::int as avisados
          from radar_itens i
         where i.cerebro_ref is not null and i.arquivado_em is null
         group by i.cerebro_ref
      ) t), '[]'::jsonb);
end;
$$;
revoke all on function public.radar_para_cerebro(text) from public;
grant execute on function public.radar_para_cerebro(text) to anon, authenticated;
