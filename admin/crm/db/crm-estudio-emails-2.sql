-- Por Dentro — Estúdio de e-mails, entrega 2: o estúdio de edição com prévia real
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelos-email.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: três colunas novas em modelos_email_versoes e duas variáveis na lista do e-mail 1. Não muda
-- o texto de nenhuma versão: o e-mail 1 e o e-mail 2 continuam saindo iguais até você publicar uma versão nova.
--
-- O que muda:
--   1. modelos_email_versoes.blocos: os blocos que o estúdio edita (texto, botão, destaque, apresentação com foto,
--      pergunta, respostas de um toque, trecho só para uma etapa, assinatura), com o plano B de cada dado e o
--      motivo do rodapé. O estúdio monta o assunto, a prévia, o texto puro e o HTML a partir dos blocos e grava
--      tudo junto: o Worker continua lendo só corpo_texto e corpo_html da versão No ar. As versões de hoje ficam
--      com blocos vazio (texto corrido) e continuam valendo como estão.
--   2. modelos_email_versoes.testado_em e testado_por: quando você mandou o teste para você (rota
--      /api/crm/modelo-teste do Worker). Mudar o texto depois apaga a marca: o estúdio só publica o que foi testado.
--   3. Uma versão que já saiu (No ar ou Arquivada) também não muda de blocos.
--   4. modelo_email_nova_versao() passa a copiar os blocos.
--   5. O e-mail 1 (cf_guia_1) ganha as variáveis {etapa} e {cidade} na lista (o Worker desta entrega já preenche).
--
-- Segurança: igual à entrega 1 (só admin lê e escreve; o Worker lê com a service_role). Nada de dado de pessoa aqui.
--
-- Como desfazer (o e-mail continua saindo com o texto guardado em corpo_texto e corpo_html):
--   alter table public.modelos_email_versoes drop column if exists blocos;
--   alter table public.modelos_email_versoes drop column if exists testado_em;
--   alter table public.modelos_email_versoes drop column if exists testado_por;
--   e rode de novo as partes "Uma versão que já saiu" e "Nova versão" de crm-modelos-email.sql (voltam as funções da entrega 1).
--   As variáveis novas da lista podem ficar: são só a descrição que aparece na tela.

-- ---------- Colunas novas ----------
alter table public.modelos_email_versoes add column if not exists blocos jsonb;
alter table public.modelos_email_versoes add column if not exists testado_em timestamptz;
alter table public.modelos_email_versoes add column if not exists testado_por uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'modelos_email_versoes_blocos_objeto') then
    alter table public.modelos_email_versoes add constraint modelos_email_versoes_blocos_objeto
      check (blocos is null or (jsonb_typeof(blocos) = 'object' and pg_column_size(blocos) <= 200000));
  end if;
end $$;

-- ---------- Uma versão que já saiu não muda (agora também os blocos); texto novo apaga o teste ----------
create or replace function public.modelos_email_versao_trava() returns trigger
language plpgsql set search_path = public as $$
declare mudou_texto boolean;
begin
  mudou_texto := new.assunto is distinct from old.assunto or new.preheader is distinct from old.preheader
    or new.corpo_texto is distinct from old.corpo_texto or new.corpo_html is distinct from old.corpo_html
    or new.blocos is distinct from old.blocos;
  if old.etapa in ('no_ar', 'arquivado') and (mudou_texto
    or new.chave is distinct from old.chave or new.versao is distinct from old.versao) then
    raise exception 'A versão % de % já saiu e fica guardada como está. Crie uma versão nova: select public.modelo_email_nova_versao(''%'');',
      old.versao, old.chave, old.chave;
  end if;
  if new.etapa in ('rascunho', 'revisao') and old.etapa in ('no_ar', 'arquivado') then
    raise exception 'Uma versão que já saiu não volta para rascunho nem revisão. Crie uma versão nova.';
  end if;
  -- O teste vale para o texto testado: mudou o texto, precisa testar de novo antes de publicar.
  if mudou_texto and new.testado_em is not distinct from old.testado_em then
    new.testado_em := null; new.testado_por := null;
  end if;
  return new;
end $$;
drop trigger if exists modelos_email_versao_trava on public.modelos_email_versoes;
create trigger modelos_email_versao_trava before update on public.modelos_email_versoes
  for each row execute function public.modelos_email_versao_trava();

-- ---------- Nova versão: copia também os blocos ----------
create or replace function public.modelo_email_nova_versao(p_chave text) returns int
language plpgsql set search_path = public as $$
declare v int;
begin
  select coalesce(max(versao), 0) + 1 into v from modelos_email_versoes where chave = p_chave;
  insert into modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
  select chave, v, 'rascunho', assunto, preheader, corpo_texto, corpo_html, blocos, 'cópia da versão ' || versao
    from modelos_email_versoes where chave = p_chave
   order by (etapa = 'no_ar') desc, versao desc limit 1;
  if not found then raise exception 'Modelo % não existe (ou não tem versão para copiar).', p_chave; end if;
  return v;
end $$;
revoke all on function public.modelo_email_nova_versao(text) from public, anon;
grant execute on function public.modelo_email_nova_versao(text) to authenticated;

-- ---------- As variáveis novas do e-mail 1 (só a lista que aparece na tela) ----------
update public.modelos_email
   set variaveis = variaveis || '[{"nome":"etapa","o_que_e":"a etapa que ela marcou no guia, por extenso","se_faltar":"o trecho some (ou o plano B do bloco)"}]'::jsonb
 where chave = 'cf_guia_1' and not variaveis @> '[{"nome":"etapa"}]'::jsonb;
update public.modelos_email
   set variaveis = variaveis || '[{"nome":"cidade","o_que_e":"a cidade que ela tocou no e-mail 2","se_faltar":"\"a cidade que você escolher\""}]'::jsonb
 where chave = 'cf_guia_1' and not variaveis @> '[{"nome":"cidade"}]'::jsonb;
