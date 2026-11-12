-- Por Dentro — CRM: o caso da pessoa (compreensão da conversa, board dela e notificações do assistente)
-- Rode no SQL Editor do Supabase DEPOIS de crm-fase2.sql, crm-propostas.sql e crm-chat.sql (usa contatos, eventos, sinais,
-- consentimentos, eh_admin() e meu_contato_id()). Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
-- ATENÇÃO: este arquivo redefine crm_evento_recente() (a lista do que é feito por você). Se rodar crm-propostas.sql de novo
-- depois deste, rode este de novo para a lista voltar a incluir os eventos do caso.
--
-- O desenho completo está na proposta "As tabelas do caso". Em uma frase: quatro tabelas, e a pessoa nunca lê nenhuma delas
-- direto; ela lê e escreve só por funções que decidem por meu_contato_id().
--
--   caso_achados   a compreensão: cada fato, dedução ou dúvida tirado da conversa, com origem e certeza. Interna: só admin.
--   caso_acoes     o que fazer (a tabela Pendência × Canal do Notion). As dela, publicadas, viram passos no Checklist.
--   board_itens    o que ela vê: escola, modelo, documento, marco e a cópia do bilan. Só o publicado chega a ela.
--   caso_avisos    as notificações do assistente (perguntas e sugestões), com a data que VOCÊ decide.
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo, via RLS (eh_admin())
--   pessoa logada  → meu_caso(), meus_avisos(), caso_primeiro_acesso(), marcar_aviso_lido(), responder_aviso(),
--                    adiar_aviso(), dispensar_aviso(), salvar_dados_dela(), marcar_acao()
--   rotina diária  → crm_avisos_materializar() (service_role / Database → Cron): acende o sininho (sinais) de quem acabou
--                    de ficar visível. Sem ela o aviso continua visível no app; só o sininho não acende.
--
-- Regras que o banco impõe sozinho (não dependem do painel):
--   · nada é publicado nem agendado sem consentimento "servico" da pessoa (e sem passar pela revisão);
--   · a resposta a uma pergunta só grava em chaves de uma lista fechada de contatos.respostas;
--   · o conteúdo da equipe (board_itens.dados) e o que a pessoa preenche (dados_dela) ficam em colunas separadas,
--     cada uma só com as chaves permitidas para o tipo;
--   · a data de um aviso relativo ("1 dia depois de ela entrar") é calculada no primeiro acesso, às 9h de Europe/Paris
--     [conferir: o fuso deveria vir do perfil de quem mora fora da França].

-- ---------- Validadores (puros, só leem o que recebem) ----------
-- Chaves permitidas em board_itens.dados (equipe) e dados_dela (pessoa), por tipo.
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
                              else array[]::text[] end)
               else
                 (case p_tipo when 'escola' then array['cidade', 'curso', 'link', 'custo_eur', 'meses_sugeridos']
                              when 'modelo' then array['idioma', 'assunto', 'corpo', 'traducao']
                              when 'documento' then array['rotulo', 'direcao']
                              when 'marco' then array['data', 'a_confirmar', 'nota']
                              when 'bilan' then array['secoes']
                              else array[]::text[] end)
          end));
$$;

create or replace function public.caso_opcoes_ok(p_op text[]) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p_op is null or (cardinality(p_op) between 1 and 6
    and not exists (select 1 from unnest(p_op) o where o is null or length(btrim(o)) not between 1 and 40));
$$;

-- Para onde o botão de uma proposta ou oferta leva: listas fechadas.
create or replace function public.caso_destino_ok(p_d jsonb) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p_d is null or (jsonb_typeof(p_d) = 'object'
    and not exists (select 1 from jsonb_object_keys(p_d) k where k <> all (array['tela', 'aba', 'item_id', 'servico']))
    and coalesce(p_d->>'tela', 'inicio') = any (array['inicio', 'checklist', 'espaco', 'guias', 'perfil'])
    and coalesce(p_d->>'servico', 'revisao') = any (array['revisao', 'conversa', 'hub'])
    and (p_d->>'aba' is null or length(p_d->>'aba') <= 20)
    and (p_d->>'item_id' is null or p_d->>'item_id' ~ '^[0-9]{1,18}$'));
$$;

-- ---------- Tabelas ----------
create table if not exists public.caso_achados (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  chave text check (chave is null or chave ~ '^[a-z0-9_]{1,60}$'),   -- nome estável, para ligar o achado a itens e avisos
  tipo text not null check (tipo in ('fato', 'deducao', 'duvida')),
  texto text not null check (length(texto) between 1 and 400),
  origem text not null default 'conversa' check (origem in ('conversa', 'crm', 'ingryd', 'biblioteca')),
  certeza text not null default 'a_confirmar' check (certeza in ('literal', 'inferido', 'a_confirmar', 'nao_bate')),
  estado text not null default 'conferir' check (estado in ('conferir', 'ok', 'descartado')),
  citacao text check (citacao is null or length(citacao) <= 300),      -- trecho curto de apoio; NUNCA a transcrição
  fonte_rotulo text check (fonte_rotulo is null or length(fonte_rotulo) <= 60),
  fonte_url text check (fonte_url is null or (length(fonte_url) <= 500 and fonte_url ~ '^https://')),
  notion_url text check (notion_url is null or (length(notion_url) <= 500 and notion_url ~ '^https://')),
  conferido_por uuid references auth.users(id) on delete set null,
  conferido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists caso_achados_chave_idx on public.caso_achados (contato_id, chave) where chave is not null;
create index if not exists caso_achados_contato_idx on public.caso_achados (contato_id, tipo, estado);

create table if not exists public.caso_acoes (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  achado_id bigint references public.caso_achados(id) on delete set null,
  n smallint check (n is null or n between 1 and 999),                  -- a numeração da tabela do Notion
  titulo text not null check (length(titulo) between 1 and 160),
  dono text not null check (dono in ('ela', 'ingryd')),
  -- "Fora do CRM" não existe de propósito: o que você decidiu tratar fora do CRM nunca é gravado.
  canal text not null check (canal in ('plataforma', 'email', 'convite', 'instagram', 'so_eu')),
  botao text check (botao is null or botao in ('gerar_rascunho', 'marcar_marco', 'copiar_mensagem', 'anexar_documento', 'pesquisar', 'confirmar')),
  prazo date,
  prazo_a_confirmar boolean not null default false,
  estado text not null default 'aberta' check (estado in ('aberta', 'aguardando_ela', 'concluida')),
  certeza text not null default 'literal' check (certeza in ('literal', 'inferido')),
  passo_chave text check (passo_chave is null or passo_chave ~ '^[a-z0-9_:-]{1,60}$'),   -- o passo que aparece no Checklist dela
  publicada_em timestamptz,
  concluida_em timestamptz,
  concluida_por text check (concluida_por is null or concluida_por in ('ela', 'equipe')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (dono <> 'ela' or canal <> 'plataforma' or passo_chave is not null)
);
create unique index if not exists caso_acoes_n_idx on public.caso_acoes (contato_id, n) where n is not null;
create index if not exists caso_acoes_contato_idx on public.caso_acoes (contato_id, dono, estado);

create table if not exists public.board_itens (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  achado_id bigint references public.caso_achados(id) on delete set null,
  tipo text not null check (tipo in ('escola', 'modelo', 'documento', 'marco', 'bilan')),
  titulo text not null check (length(titulo) between 1 and 120),
  resumo text check (resumo is null or length(resumo) <= 240),
  dados jsonb not null default '{}'::jsonb
    check (public.caso_board_chaves_ok(tipo, dados, false) and octet_length(dados::text) <= 8192),
  dados_dela jsonb not null default '{}'::jsonb
    check (public.caso_board_chaves_ok(tipo, dados_dela, true) and octet_length(dados_dela::text) <= 4096),
  estado text not null default 'proposto' check (estado in ('proposto', 'revisado', 'publicado')),
  ordem smallint,
  -- Enquanto o projeto não usa Storage privado [conferir], o arquivo é um link externo (https). O caminho de Storage
  -- nunca é devolvido à pessoa; ela só sabe se há arquivo.
  link text check (link is null or (length(link) <= 500 and link ~ '^https://')),
  arquivo_caminho text check (arquivo_caminho is null or (length(arquivo_caminho) <= 300 and arquivo_caminho !~ '^[a-z]+://')),
  arquivo_anexado_em timestamptz,
  biblioteca_chave text check (biblioteca_chave is null or biblioteca_chave ~ '^[a-z0-9_./-]{1,100}$'),
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  publicado_por uuid references auth.users(id) on delete set null,
  publicado_em timestamptz,
  versao int not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists board_itens_contato_idx on public.board_itens (contato_id, estado, ordem);

create table if not exists public.caso_avisos (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  achado_id bigint references public.caso_achados(id) on delete set null,
  acao_id bigint references public.caso_acoes(id) on delete set null,
  tipo text not null check (tipo in ('pergunta', 'proposta', 'inteligencia', 'oferta')),
  titulo text not null check (length(titulo) between 1 and 120),
  texto text check (texto is null or length(texto) between 1 and 600),
  resposta_tipo text check (resposta_tipo is null or resposta_tipo in ('data', 'opcoes')),   -- sem texto livre: a resposta é conferível
  opcoes text[] check (public.caso_opcoes_ok(opcoes)),
  -- Onde a resposta vai: lista fechada, em contatos.respostas. Pergunta nova entra por uma mudança pequena e revisada aqui.
  grava_em text check (grava_em is null or grava_em in
    ('respostas.fim_pvt', 'respostas.nivel_frances', 'respostas.escola_prioridade', 'respostas.sponsor')),
  destino jsonb check (public.caso_destino_ok(destino)),
  modo text not null default 'apos_primeiro_acesso' check (modo in ('apos_primeiro_acesso', 'data')),
  dias_apos smallint not null default 1 check (dias_apos between 0 and 60),
  liberar_em timestamptz,                -- vazio até o primeiro acesso, no modo relativo
  expira_em timestamptz,
  adiado_ate timestamptz,                -- "Agora não": volta depois de 3 dias, como as propostas
  estado text not null default 'rascunho'
    check (estado in ('rascunho', 'agendado', 'liberado', 'lido', 'respondido', 'dispensado', 'cancelado')),
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  liberado_em timestamptz,
  lido_em timestamptz,
  respondido_em timestamptz,
  resposta jsonb check (resposta is null or octet_length(resposta::text) <= 400),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (tipo <> 'pergunta' or (resposta_tipo is not null and grava_em is not null)),
  check (tipo = 'pergunta' or (resposta_tipo is null and grava_em is null)),
  check (resposta_tipo is distinct from 'opcoes' or opcoes is not null),
  check (estado = 'rascunho' or modo <> 'data' or liberar_em is not null)
);
create index if not exists caso_avisos_contato_idx on public.caso_avisos (contato_id, estado, liberar_em);

-- ---------- Row Level Security: só admin. A pessoa não tem política nenhuma; ela entra só pelas funções ----------
alter table public.caso_achados enable row level security;
alter table public.caso_acoes enable row level security;
alter table public.board_itens enable row level security;
alter table public.caso_avisos enable row level security;

drop policy if exists "caso_achados: só admin" on public.caso_achados;
create policy "caso_achados: só admin" on public.caso_achados
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "caso_acoes: só admin" on public.caso_acoes;
create policy "caso_acoes: só admin" on public.caso_acoes
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "board_itens: só admin" on public.board_itens;
create policy "board_itens: só admin" on public.board_itens
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "caso_avisos: só admin" on public.caso_avisos;
create policy "caso_avisos: só admin" on public.caso_avisos
  for all using (public.eh_admin()) with check (public.eh_admin());

revoke all on public.caso_achados from anon;
revoke all on public.caso_acoes from anon;
revoke all on public.board_itens from anon;
revoke all on public.caso_avisos from anon;

-- ---------- Ajudantes ----------
-- O consentimento atual é a linha mais recente da finalidade (retirar é uma linha nova com aceito = false).
-- "servico" é a finalidade que cobre usar a plataforma e receber mensagens dela [conferir com o texto do consentimento].
create or replace function public.caso_tem_consentimento(p_contato uuid) returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce((select c.aceito from consentimentos c
                    where c.contato_id = p_contato and c.finalidade = 'servico'
                    order by c.criado_em desc, c.id desc limit 1), false)
$$;
revoke all on function public.caso_tem_consentimento(uuid) from public, anon, authenticated;

-- Um aviso está visível para a pessoa quando foi aprovado, a data chegou, não foi adiado nem venceu.
create or replace function public.caso_aviso_visivel(a public.caso_avisos) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select a.estado in ('agendado', 'liberado', 'lido') and a.liberar_em is not null and a.liberar_em <= now()
     and (a.adiado_ate is null or a.adiado_ate <= now()) and (a.expira_em is null or a.expira_em > now())
$$;
revoke all on function public.caso_aviso_visivel(public.caso_avisos) from public, anon;
grant execute on function public.caso_aviso_visivel(public.caso_avisos) to authenticated;

-- Data de um aviso relativo: o dia do primeiro acesso (no fuso de Paris) + dias, às 9h. Vazio se ela ainda não entrou.
create or replace function public.caso_liberar_relativo(p_contato uuid, p_dias int) returns timestamptz
language sql stable
set search_path = public, pg_temp
as $$
  select case when e.t is null then null
              else (((e.t at time zone 'Europe/Paris')::date + p_dias) + time '09:00') at time zone 'Europe/Paris' end
    from (select min(criado_em) as t from eventos where contato_id = p_contato and tipo = 'caso_primeiro_acesso') e
$$;
revoke all on function public.caso_liberar_relativo(uuid, int) from public, anon, authenticated;

create or replace function public.caso_touch() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------- Guardas (valem para qualquer caminho de escrita, inclusive o servidor) ----------
create or replace function public.caso_board_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
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

create or replace function public.caso_aviso_guarda() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'rascunho' then raise exception 'comece_como_rascunho'; end if;
    return new;
  end if;
  -- Sair de rascunho = aprovar: exige consentimento e fica registrado quem aprovou.
  if old.estado = 'rascunho' and new.estado <> 'rascunho' then
    if not public.caso_tem_consentimento(new.contato_id) then raise exception 'sem_consentimento'; end if;
    new.revisado_em := now();
    new.revisado_por := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.caso_aviso_guarda() from public, anon, authenticated;

-- ---------- Linha do tempo ----------
-- Mesma regra dos outros gatilhos: nunca derrubam a gravação que os disparou.
create or replace function public.crm_on_caso_achado() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.estado is distinct from old.estado then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, 'caso_achado_conferido', jsonb_build_object('achado_id', new.id, 'tipo', new.tipo, 'estado', new.estado));
    end if;
  exception when others then
    raise warning 'crm_on_caso_achado: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.crm_on_caso_achado() from public, anon, authenticated;

create or replace function public.crm_on_caso_acao() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.estado is distinct from old.estado and new.estado = 'concluida' then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, case when new.concluida_por = 'ela' then 'caso_acao_concluida' else 'caso_acao_equipe' end,
              jsonb_build_object('acao_id', new.id, 'titulo', left(new.titulo, 120)));
    end if;
  exception when others then
    raise warning 'crm_on_caso_acao: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.crm_on_caso_acao() from public, anon, authenticated;

create or replace function public.crm_on_board_item() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  begin
    if new.estado is distinct from old.estado then
      if new.estado = 'publicado' then v_tipo := 'caso_item_publicado';
      elsif old.estado = 'publicado' then v_tipo := 'caso_item_retirado'; end if;
    end if;
    if v_tipo is not null then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, v_tipo, jsonb_build_object('item_id', new.id, 'tipo', new.tipo, 'titulo', left(new.titulo, 120)));
    end if;
  exception when others then
    raise warning 'crm_on_board_item: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.crm_on_board_item() from public, anon, authenticated;

create or replace function public.crm_on_caso_aviso() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo text;
begin
  begin
    if new.adiado_ate is distinct from old.adiado_ate and new.adiado_ate is not null then
      v_tipo := 'caso_aviso_adiado';
    elsif new.estado is distinct from old.estado and new.estado in ('agendado', 'liberado', 'lido', 'respondido', 'dispensado') then
      v_tipo := 'caso_aviso_' || new.estado;
    end if;
    if v_tipo is not null then
      insert into eventos (contato_id, tipo, dados)
      values (new.contato_id, v_tipo, jsonb_build_object('aviso_id', new.id, 'tipo', new.tipo, 'titulo', left(new.titulo, 120), 'resposta', new.resposta));
    end if;
  exception when others then
    raise warning 'crm_on_caso_aviso: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.crm_on_caso_aviso() from public, anon, authenticated;

drop trigger if exists caso_achados_touch on public.caso_achados;
create trigger caso_achados_touch before update on public.caso_achados for each row execute function public.caso_touch();
drop trigger if exists caso_acoes_touch on public.caso_acoes;
create trigger caso_acoes_touch before update on public.caso_acoes for each row execute function public.caso_touch();
drop trigger if exists board_itens_touch on public.board_itens;
create trigger board_itens_touch before update on public.board_itens for each row execute function public.caso_touch();
drop trigger if exists caso_avisos_touch on public.caso_avisos;
create trigger caso_avisos_touch before update on public.caso_avisos for each row execute function public.caso_touch();

drop trigger if exists board_itens_guarda on public.board_itens;
create trigger board_itens_guarda before insert or update on public.board_itens for each row execute function public.caso_board_guarda();
drop trigger if exists caso_avisos_guarda on public.caso_avisos;
create trigger caso_avisos_guarda before insert or update on public.caso_avisos for each row execute function public.caso_aviso_guarda();

drop trigger if exists crm_caso_achados_evento on public.caso_achados;
create trigger crm_caso_achados_evento after update of estado on public.caso_achados for each row execute function public.crm_on_caso_achado();
drop trigger if exists crm_caso_acoes_evento on public.caso_acoes;
create trigger crm_caso_acoes_evento after update of estado on public.caso_acoes for each row execute function public.crm_on_caso_acao();
drop trigger if exists crm_board_itens_evento on public.board_itens;
create trigger crm_board_itens_evento after update of estado on public.board_itens for each row execute function public.crm_on_board_item();
drop trigger if exists crm_caso_avisos_evento on public.caso_avisos;
create trigger crm_caso_avisos_evento after update of estado, adiado_ate on public.caso_avisos for each row execute function public.crm_on_caso_aviso();

-- Substitui a função de crm-propostas.sql só para acrescentar os eventos do caso que são feitos por você ou pelo sistema.
-- (O que a pessoa faz continua zerando o "parada há N dias".)
create or replace function public.crm_evento_recente() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo <> all (array['estagio_alterado', 'sinal_enviado', 'email_enviado', 'pergunta_respondida', 'um_a_um_agendado', 'proposta_enviada',
                            'caso_achado_conferido', 'caso_acao_equipe', 'caso_item_publicado', 'caso_item_retirado',
                            'caso_aviso_agendado', 'caso_aviso_liberado']) then
    update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id;
  end if;
  return new;
end;
$$;

-- ---------- Pessoa logada ----------
-- Tudo o que o Espaço, os Guias e o Checklist dela precisam, de uma vez. Vazio (null) se a conta não está ligada a uma ficha
-- (a ligação só acontece com e-mail confirmado: crm-fase1d). Só o que foi publicado ou liberado sai daqui.
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
               'prazo_a_confirmar', a.prazo_a_confirmar, 'estado', a.estado) order by a.n nulls last, a.id)
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

-- O app chama uma vez por sessão. Marca o primeiro acesso (um evento só) e dá data aos avisos relativos que ainda não têm.
create or replace function public.caso_primeiro_acesso() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  perform pg_advisory_xact_lock(hashtext('caso_primeiro_acesso:' || v_c::text));
  insert into eventos (contato_id, tipo)
  select v_c, 'caso_primeiro_acesso'
   where not exists (select 1 from eventos where contato_id = v_c and tipo = 'caso_primeiro_acesso');
  update caso_avisos a set liberar_em = public.caso_liberar_relativo(a.contato_id, a.dias_apos)
   where a.contato_id = v_c and a.modo = 'apos_primeiro_acesso' and a.liberar_em is null;
end;
$$;
revoke all on function public.caso_primeiro_acesso() from public;
revoke all on function public.caso_primeiro_acesso() from anon;
grant execute on function public.caso_primeiro_acesso() to authenticated;

create or replace function public.meus_avisos() returns table (
  id bigint, tipo text, titulo text, texto text, resposta_tipo text, opcoes text[], destino jsonb, estado text, liberar_em timestamptz)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select a.id, a.tipo, a.titulo, a.texto, a.resposta_tipo, a.opcoes, a.destino, a.estado, a.liberar_em
    from caso_avisos a
   where a.contato_id = public.meu_contato_id() and public.caso_aviso_visivel(a)
   order by a.liberar_em, a.id;
$$;
revoke all on function public.meus_avisos() from public;
revoke all on function public.meus_avisos() from anon;
grant execute on function public.meus_avisos() to authenticated;

create or replace function public.marcar_aviso_lido(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update caso_avisos a set estado = 'lido', lido_em = now()
   where a.id = p_id and a.contato_id = public.meu_contato_id() and a.estado in ('agendado', 'liberado') and public.caso_aviso_visivel(a);
$$;
revoke all on function public.marcar_aviso_lido(bigint) from public;
revoke all on function public.marcar_aviso_lido(bigint) from anon;
grant execute on function public.marcar_aviso_lido(bigint) to authenticated;

-- A resposta a uma pergunta: uma data ou uma das opções, nada de texto livre. Grava só na chave permitida de contatos.respostas.
create or replace function public.responder_aviso(p_id bigint, p_valor jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  a caso_avisos%rowtype;
  v_txt text;
  v_dt date;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  select * into a from caso_avisos where id = p_id and contato_id = v_c for update;
  if not found then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.estado = 'respondido' then
    raise exception 'aviso_ja_respondido';
  end if;
  if not public.caso_aviso_visivel(a) then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.tipo <> 'pergunta' then
    raise exception 'aviso_nao_e_pergunta';
  end if;
  if p_valor is null or jsonb_typeof(p_valor) <> 'string' then
    raise exception 'resposta_invalida';
  end if;
  v_txt := p_valor #>> '{}';
  if a.resposta_tipo = 'data' then
    if v_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'resposta_invalida';
    end if;
    begin
      v_dt := v_txt::date;
    exception when others then
      raise exception 'resposta_invalida';
    end;
    if v_dt < current_date - 400 or v_dt > current_date + 800 then
      raise exception 'resposta_invalida';
    end if;
  elsif not (v_txt = any (a.opcoes)) then
    raise exception 'resposta_invalida';
  end if;

  update contatos set respostas = coalesce(respostas, '{}'::jsonb) || jsonb_build_object(split_part(a.grava_em, '.', 2), v_txt)
   where id = v_c;
  update caso_avisos set estado = 'respondido', respondido_em = now(), resposta = p_valor, lido_em = coalesce(lido_em, now())
   where id = a.id;
end;
$$;
revoke all on function public.responder_aviso(bigint, jsonb) from public;
revoke all on function public.responder_aviso(bigint, jsonb) from anon;
grant execute on function public.responder_aviso(bigint, jsonb) to authenticated;

-- "Agora não": some por 3 dias e volta (o sininho acende de novo quando a rotina diária rodar).
create or replace function public.adiar_aviso(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update caso_avisos a set estado = 'agendado', adiado_ate = now() + interval '3 days'
   where a.id = p_id and a.contato_id = public.meu_contato_id() and a.estado in ('agendado', 'liberado', 'lido') and public.caso_aviso_visivel(a);
$$;
revoke all on function public.adiar_aviso(bigint) from public;
revoke all on function public.adiar_aviso(bigint) from anon;
grant execute on function public.adiar_aviso(bigint) to authenticated;

-- "Entendi": só para o que não é pergunta. Pergunta se responde ou se adia.
create or replace function public.dispensar_aviso(p_id bigint) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update caso_avisos a set estado = 'dispensado'
   where a.id = p_id and a.contato_id = public.meu_contato_id() and a.tipo <> 'pergunta'
     and a.estado in ('agendado', 'liberado', 'lido') and public.caso_aviso_visivel(a);
$$;
revoke all on function public.dispensar_aviso(bigint) from public;
revoke all on function public.dispensar_aviso(bigint) from anon;
grant execute on function public.dispensar_aviso(bigint) to authenticated;

-- O que a pessoa preenche num item publicado (critérios de uma escola, meses, valor, documento reunido). Só em dados_dela,
-- só nas chaves do tipo, com valores conferidos. Os critérios se mesclam: mandar um não apaga os outros.
create or replace function public.salvar_dados_dela(p_item bigint, p_patch jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
  b board_itens%rowtype;
  v_dela jsonb;
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
  if b.tipo not in ('escola', 'documento') then
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
      if k <> all (array['carga', 'dur', 'att', 'visto', 'pag', 'prazo', 'nivel']) then raise exception 'valor_invalido'; end if;
      if jsonb_typeof(v) not in ('string', 'null') or (jsonb_typeof(v) = 'string' and (v #>> '{}') <> all (array['sim', 'nao'])) then
        raise exception 'valor_invalido';
      end if;
    end loop;
  end if;

  v_dela := coalesce(b.dados_dela, '{}'::jsonb) || (p_patch - 'criterios');
  if p_patch ? 'criterios' then
    v_dela := jsonb_set(v_dela, '{criterios}', coalesce(b.dados_dela->'criterios', '{}'::jsonb) || (p_patch->'criterios'));
  end if;
  update board_itens set dados_dela = v_dela where id = b.id;
end;
$$;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from public;
revoke all on function public.salvar_dados_dela(bigint, jsonb) from anon;
grant execute on function public.salvar_dados_dela(bigint, jsonb) to authenticated;

-- Um passo dela no Checklist: concluir ou desfazer. Só as ações dela, pela plataforma, já publicadas.
create or replace function public.marcar_acao(p_id bigint, p_concluida boolean) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c uuid;
begin
  v_c := public.meu_contato_id();
  if auth.uid() is null or v_c is null then
    raise exception 'nao_autenticado';
  end if;
  if p_concluida is null then
    raise exception 'valor_invalido';
  end if;
  update caso_acoes a set estado = case when p_concluida then 'concluida' else 'aberta' end,
                          concluida_em = case when p_concluida then now() end,
                          concluida_por = case when p_concluida then 'ela' end
   where a.id = p_id and a.contato_id = v_c and a.dono = 'ela' and a.canal = 'plataforma' and a.publicada_em is not null;
  if not found then
    raise exception 'acao_nao_encontrada';
  end if;
end;
$$;
revoke all on function public.marcar_acao(bigint, boolean) from public;
revoke all on function public.marcar_acao(bigint, boolean) from anon;
grant execute on function public.marcar_acao(bigint, boolean) to authenticated;

-- ---------- Você ----------
-- Publicar e retirar um item do board. Quem impõe a revisão e o consentimento é o gatilho caso_board_guarda.
create or replace function public.crm_board_publicar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update board_itens set estado = 'publicado' where id = p_id;
  if not found then
    raise exception 'item_nao_encontrado';
  end if;
end;
$$;
revoke all on function public.crm_board_publicar(bigint) from public;
revoke all on function public.crm_board_publicar(bigint) from anon;
grant execute on function public.crm_board_publicar(bigint) to authenticated;

create or replace function public.crm_board_retirar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  update board_itens set estado = 'revisado' where id = p_id and estado = 'publicado';
  if not found then
    raise exception 'item_nao_encontrado';
  end if;
end;
$$;
revoke all on function public.crm_board_retirar(bigint) from public;
revoke all on function public.crm_board_retirar(bigint) from anon;
grant execute on function public.crm_board_retirar(bigint) to authenticated;

-- Aprovar um aviso e escolher a data. p_quando = data fixa; sem ela, vale "dias depois do primeiro acesso" (p_dias_apos, ou
-- o que o aviso já tem). Quem impõe o consentimento é o gatilho caso_aviso_guarda.
create or replace function public.crm_aviso_agendar(p_id bigint, p_quando timestamptz default null, p_dias_apos smallint default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a caso_avisos%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  select * into a from caso_avisos where id = p_id for update;
  if not found then
    raise exception 'aviso_nao_encontrado';
  end if;
  if a.estado in ('respondido', 'dispensado', 'cancelado') then
    raise exception 'aviso_encerrado';
  end if;
  if p_quando is not null then
    update caso_avisos set modo = 'data', liberar_em = p_quando, estado = 'agendado', adiado_ate = null where id = p_id;
  else
    update caso_avisos set modo = 'apos_primeiro_acesso', dias_apos = coalesce(p_dias_apos, a.dias_apos),
           liberar_em = public.caso_liberar_relativo(a.contato_id, coalesce(p_dias_apos, a.dias_apos)::int),
           estado = 'agendado', adiado_ate = null
     where id = p_id;
  end if;
end;
$$;
revoke all on function public.crm_aviso_agendar(bigint, timestamptz, smallint) from public;
revoke all on function public.crm_aviso_agendar(bigint, timestamptz, smallint) from anon;
grant execute on function public.crm_aviso_agendar(bigint, timestamptz, smallint) to authenticated;

-- ---------- Rotina diária ----------
-- Acende o sininho (sinais) de quem acabou de ficar visível e marca o aviso como liberado. Só o servidor chama.
-- (Database → Cron, ou pg_cron): select public.crm_avisos_materializar();  ← 1x por dia, logo depois das 9h de Paris.
create or replace function public.crm_avisos_materializar() returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    select a.id, a.contato_id, a.titulo from caso_avisos a
     where a.estado = 'agendado' and a.liberar_em is not null and a.liberar_em <= now()
       and (a.adiado_ate is null or a.adiado_ate <= now()) and (a.expira_em is null or a.expira_em > now())
     order by a.id for update skip locked
  loop
    update caso_avisos set estado = 'liberado', liberado_em = now() where id = r.id;
    insert into sinais (contato_id, mensagem) values (r.contato_id, left('Nova mensagem do assistente: ' || r.titulo, 500));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.crm_avisos_materializar() from public, anon, authenticated;
