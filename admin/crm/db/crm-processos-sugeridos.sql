-- Por Dentro — CRM: processos sugeridos (uma aba nova no checklist, aprovada por você)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase1.sql do app (usa contatos e eh_admin()). Idempotente e só
-- acrescenta: não apaga nem reescreve dado nenhum.
--
-- O caminho:
--   1. O app percebe sinais de que a pessoa pode precisar de um processo que ela ainda não tem (ex.: respondeu que a
--      moradia está resolvida → CAF). Ele grava a SUGESTÃO com os sinais, em palavras (sinalizar_processo). Nada
--      muda para a pessoa.
--   2. A ficha dela no CRM mostra a sugestão e os sinais. Você aprova (com um recado opcional) ou descarta
--      (crm_decidir_processo).
--   3. Aprovada, o assistente da plataforma pergunta a ela no chat se quer abrir o processo (meus_processos).
--   4. Ela aceita ou recusa (responder_processo). Aceito, a aba do processo aparece no checklist no próximo login.
--
-- Estados (status): detectada → aprovada | descartada;  aprovada → aceita | recusada.
--   Enquanto 'detectada', novos sinais atualizam a lista. Descartada ou recusada não volta sozinha (sem insistir);
--   você pode aprovar de novo pelo CRM se a situação mudar.
--
-- Quem lê e escreve o quê:
--   admin (você)   → lê tudo pela RLS (eh_admin()); decide por crm_decidir_processo()
--   pessoa logada  → só pelas funções abaixo, sempre sobre a PRÓPRIA ficha; não lê nem escreve a tabela direto
--   site público   → nada

create table if not exists public.processos_sugeridos (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  processo text not null check (processo ~ '^[a-z_]{2,30}$'),
  -- [{ "codigo": "moradia_resolvida", "texto": "Respondeu que a moradia na França já está resolvida." }, ...]
  sinais jsonb not null default '[]'::jsonb check (jsonb_typeof(sinais) = 'array' and jsonb_array_length(sinais) <= 10),
  status text not null default 'detectada' check (status in ('detectada', 'aprovada', 'descartada', 'aceita', 'recusada')),
  mensagem text check (mensagem is null or length(mensagem) <= 500),   -- o seu recado, mostrado junto da pergunta
  detectada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  decidida_em timestamptz,
  respondida_em timestamptz,
  unique (contato_id, processo)
);
create index if not exists processos_sugeridos_status_idx on public.processos_sugeridos (status, atualizada_em desc);

alter table public.processos_sugeridos enable row level security;
drop policy if exists "processos_sugeridos: só admin" on public.processos_sugeridos;
create policy "processos_sugeridos: só admin" on public.processos_sugeridos
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.processos_sugeridos from anon;

-- ---------- Pessoa logada ----------
-- O app avisa os sinais de um processo. Só cria ou atualiza enquanto a sugestão está 'detectada'; nunca mexe numa
-- que você já decidiu ou que ela já respondeu. Entrada fora do formato é recusada (o texto vai para a sua ficha).
create or replace function public.sinalizar_processo(p_processo text, p_sinais jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_contato uuid;
  v_sinais jsonb;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_processo is null or p_processo !~ '^[a-z_]{2,30}$' then raise exception 'processo_invalido'; end if;
  if p_sinais is null or jsonb_typeof(p_sinais) <> 'array' or jsonb_array_length(p_sinais) = 0
     or jsonb_array_length(p_sinais) > 10 then
    raise exception 'sinais_invalidos';
  end if;
  -- Só codigo e texto, curtos; o resto é descartado.
  select coalesce(jsonb_agg(jsonb_build_object('codigo', left(s ->> 'codigo', 60), 'texto', left(s ->> 'texto', 200))), '[]'::jsonb)
    into v_sinais
    from jsonb_array_elements(p_sinais) s
   where jsonb_typeof(s) = 'object' and coalesce(s ->> 'texto', '') <> '';
  if jsonb_array_length(v_sinais) = 0 then raise exception 'sinais_invalidos'; end if;

  select id into v_contato from contatos where user_id = auth.uid();
  if v_contato is null then return; end if;   -- conta ainda sem ficha: nada a sugerir

  insert into processos_sugeridos (contato_id, processo, sinais)
  values (v_contato, p_processo, v_sinais)
  on conflict (contato_id, processo) do update
     set sinais = excluded.sinais, atualizada_em = now()
   where processos_sugeridos.status = 'detectada' and processos_sugeridos.sinais is distinct from excluded.sinais;
end;
$$;
revoke all on function public.sinalizar_processo(text, jsonb) from public;
revoke all on function public.sinalizar_processo(text, jsonb) from anon;
grant execute on function public.sinalizar_processo(text, jsonb) to authenticated;

-- O que o app precisa saber: os processos que você aprovou (o assistente pergunta) e os que ela aceitou (viram aba).
-- Os sinais não voltam para ela: são a sua leitura do caso.
create or replace function public.meus_processos() returns table (id bigint, processo text, status text, mensagem text)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select p.id, p.processo, p.status, p.mensagem
    from processos_sugeridos p join contatos c on c.id = p.contato_id
   where c.user_id = auth.uid() and p.status in ('aprovada', 'aceita')
   order by p.decidida_em nulls last, p.id;
$$;
revoke all on function public.meus_processos() from public;
revoke all on function public.meus_processos() from anon;
grant execute on function public.meus_processos() to authenticated;

-- Ela responde à pergunta do assistente: 'aceitar' ou 'recusar'. Só vale para a própria sugestão, ainda 'aprovada'.
create or replace function public.responder_processo(p_id bigint, p_resposta text) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_resposta not in ('aceitar', 'recusar') then raise exception 'resposta_invalida'; end if;
  update processos_sugeridos p
     set status = case p_resposta when 'aceitar' then 'aceita' else 'recusada' end, respondida_em = now()
    from contatos c
   where p.id = p_id and c.id = p.contato_id and c.user_id = auth.uid() and p.status = 'aprovada'
  returning p.status into v_status;
  if v_status is null then raise exception 'processo_nao_encontrado'; end if;
  return v_status;
end;
$$;
revoke all on function public.responder_processo(bigint, text) from public;
revoke all on function public.responder_processo(bigint, text) from anon;
grant execute on function public.responder_processo(bigint, text) to authenticated;

-- ---------- Você ----------
-- Aprovar (com recado opcional, até 500 caracteres) ou descartar. Aprovar de novo uma descartada ou recusada volta a
-- perguntar. Não mexe em uma já aceita.
create or replace function public.crm_decidir_processo(p_id bigint, p_decisao text, p_mensagem text default null) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  if p_decisao not in ('aprovar', 'descartar') then raise exception 'decisao_invalida'; end if;
  if p_mensagem is not null and length(p_mensagem) > 500 then raise exception 'mensagem_grande_demais'; end if;
  update processos_sugeridos
     set status = case p_decisao when 'aprovar' then 'aprovada' else 'descartada' end,
         mensagem = case p_decisao when 'aprovar' then nullif(btrim(p_mensagem), '') else mensagem end,
         decidida_em = now(), respondida_em = null
   where id = p_id and status <> 'aceita'
  returning status into v_status;
  if v_status is null then raise exception 'processo_nao_encontrado'; end if;
  return v_status;
end;
$$;
revoke all on function public.crm_decidir_processo(bigint, text, text) from public;
revoke all on function public.crm_decidir_processo(bigint, text, text) from anon;
grant execute on function public.crm_decidir_processo(bigint, text, text) to authenticated;
