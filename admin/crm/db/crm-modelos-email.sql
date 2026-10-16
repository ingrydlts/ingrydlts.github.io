-- Por Dentro — Estúdio de e-mails, entrega 1: todos os modelos num lugar só
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase1b-resposta.sql. Idempotente (pode rodar de novo).
-- Só acrescenta: tabelas novas, uma coluna nova em emails_enviados e os 10 modelos de hoje. Rodar de novo
-- não sobrescreve nada que você tenha mudado (os modelos entram com "on conflict do nothing").
--
-- O que muda:
--   1. modelos_email: um registro por modelo (chave, nome, objetivo, tipo, como sai, quem recebe, variáveis).
--   2. modelos_email_versoes: o texto de cada versão (assunto, prévia, texto puro e HTML) e a etapa dela:
--      rascunho → revisao → no_ar → arquivado. Só uma versão No ar por modelo. Uma versão que já saiu
--      (No ar ou Arquivada) não muda mais de texto: para trocar o texto, crie uma versão nova e publique.
--   3. modelo_email_nova_versao(chave): copia a versão No ar (ou a mais nova) para um rascunho novo.
--      publicar_modelo_email(chave, versao): põe a versão No ar e arquiva a anterior, de uma vez.
--   4. emails_enviados.modelo_versao: qual versão saiu em cada e-mail automático (para os números por versão).
--   5. Os 10 modelos de hoje, como versão 1 No ar: os 8 do painel (crm.js) e os 2 do Worker (cf_guia_1 e
--      cf_guia_conversa), com o texto de hoje. O Worker passa a ler os 2 automáticos daqui; os 8 do painel
--      ficam guardados aqui e continuam saindo do crm.js até a entrega 2 (o editor).
--
-- Formato das variáveis (o Worker preenche na hora de enviar):
--   {nome}             troca pelo valor (no HTML, escapado). Vazio se faltar.
--   {#nivel}…{/nivel}  o trecho só aparece se a variável tiver valor.
--   {^nivel}…{/nivel}  o trecho só aparece se a variável NÃO tiver valor.
--   {assunto} e {pre} (a prévia) também valem no corpo. Uma variável que não existe faz o Worker usar o texto
--   de reserva (o de hoje, no código), em vez de mandar um e-mail quebrado.
--
-- Segurança: só admin (eh_admin()) lê e escreve. O Worker lê com a service_role. Nada de dado de pessoa aqui.
--
-- Como desfazer (o Worker volta sozinho para o texto do código quando não acha a tabela):
--   drop function if exists public.publicar_modelo_email(text, int);
--   drop function if exists public.modelo_email_nova_versao(text);
--   drop table if exists public.modelos_email_versoes;
--   drop table if exists public.modelos_email;
--   alter table public.emails_enviados drop column if exists modelo_versao;   -- só depois de colar o Worker antigo
--   (o Worker desta entrega grava modelo_versao: apagar a coluna com ele no ar faz o e-mail automático falhar.)

-- ---------- Tabelas ----------
create table if not exists public.modelos_email (
  chave        text primary key check (chave ~ '^[a-z0-9_]{2,40}$'),
  nome         text not null check (length(nome) between 1 and 120),
  objetivo     text not null check (length(objetivo) between 1 and 300),
  tipo         text not null check (tipo in ('servico', 'novidades', 'compra')),
  como_sai     text not null check (length(como_sai) between 1 and 300),
  quem_recebe  text,
  automatico   boolean not null default false,   -- sai sozinho (o Worker lê a versão No ar)
  variaveis    jsonb not null default '[]'::jsonb, -- [{ "nome", "o_que_e", "se_faltar" }]
  ordem        int not null default 100,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.modelos_email_versoes (
  id           bigint generated always as identity primary key,
  chave        text not null references public.modelos_email (chave) on update cascade,
  versao       int not null check (versao >= 1),
  etapa        text not null default 'rascunho' check (etapa in ('rascunho', 'revisao', 'no_ar', 'arquivado')),
  assunto      text not null check (length(assunto) between 1 and 400),
  preheader    text check (preheader is null or length(preheader) <= 400),
  corpo_texto  text not null check (length(corpo_texto) between 1 and 30000),
  corpo_html   text check (corpo_html is null or length(corpo_html) <= 100000),
  nota         text,
  criado_por   uuid default auth.uid(),
  criado_em    timestamptz not null default now(),
  publicado_em timestamptz,
  unique (chave, versao)
);
create unique index if not exists modelos_email_um_no_ar_idx on public.modelos_email_versoes (chave) where etapa = 'no_ar';

alter table public.emails_enviados add column if not exists modelo_versao int;

-- ---------- Uma versão que já saiu não muda de texto ----------
create or replace function public.modelos_email_versao_trava() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.etapa in ('no_ar', 'arquivado') and (
       new.assunto is distinct from old.assunto or new.preheader is distinct from old.preheader
    or new.corpo_texto is distinct from old.corpo_texto or new.corpo_html is distinct from old.corpo_html
    or new.chave is distinct from old.chave or new.versao is distinct from old.versao) then
    raise exception 'A versão % de % já saiu e fica guardada como está. Crie uma versão nova: select public.modelo_email_nova_versao(''%'');',
      old.versao, old.chave, old.chave;
  end if;
  if new.etapa in ('rascunho', 'revisao') and old.etapa in ('no_ar', 'arquivado') then
    raise exception 'Uma versão que já saiu não volta para rascunho nem revisão. Crie uma versão nova.';
  end if;
  return new;
end $$;
drop trigger if exists modelos_email_versao_trava on public.modelos_email_versoes;
create trigger modelos_email_versao_trava before update on public.modelos_email_versoes
  for each row execute function public.modelos_email_versao_trava();

-- ---------- Nova versão e publicar ----------
create or replace function public.modelo_email_nova_versao(p_chave text) returns int
language plpgsql set search_path = public as $$
declare v int;
begin
  select coalesce(max(versao), 0) + 1 into v from modelos_email_versoes where chave = p_chave;
  insert into modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota)
  select chave, v, 'rascunho', assunto, preheader, corpo_texto, corpo_html, 'cópia da versão ' || versao
    from modelos_email_versoes where chave = p_chave
   order by (etapa = 'no_ar') desc, versao desc limit 1;
  if not found then raise exception 'Modelo % não existe (ou não tem versão para copiar).', p_chave; end if;
  return v;
end $$;

create or replace function public.publicar_modelo_email(p_chave text, p_versao int) returns void
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from modelos_email_versoes where chave = p_chave and versao = p_versao) then
    raise exception 'Versão % de % não existe.', p_versao, p_chave;
  end if;
  update modelos_email_versoes set etapa = 'arquivado'
   where chave = p_chave and etapa = 'no_ar' and versao <> p_versao;
  update modelos_email_versoes set etapa = 'no_ar', publicado_em = now()
   where chave = p_chave and versao = p_versao and etapa <> 'no_ar';
  update modelos_email set atualizado_em = now() where chave = p_chave;
end $$;

-- ---------- Quem pode o quê ----------
alter table public.modelos_email enable row level security;
alter table public.modelos_email_versoes enable row level security;
drop policy if exists "modelos_email: só admin" on public.modelos_email;
create policy "modelos_email: só admin" on public.modelos_email
  for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "modelos_email_versoes: só admin" on public.modelos_email_versoes;
create policy "modelos_email_versoes: só admin" on public.modelos_email_versoes
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.modelos_email, public.modelos_email_versoes from anon;
grant select on public.modelos_email, public.modelos_email_versoes to service_role;
-- As duas funções rodam com a permissão de quem chama (RLS vale): fora do SQL Editor, só admin consegue.
revoke all on function public.modelo_email_nova_versao(text), public.publicar_modelo_email(text, int) from public, anon;
grant execute on function public.modelo_email_nova_versao(text), public.publicar_modelo_email(text, int) to authenticated;

-- ---------- Os 10 modelos de hoje (versão 1, No ar) ----------
-- Gerado a partir de crm.js (TPLS) e worker.js (cfGuia1, cfGuiaConversa) em 16/10/2026. O teste
-- cms-oauth-worker/testes/crm-email.test.mjs confere que o texto daqui monta os mesmos e-mails de hoje.
insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, automatico, variaveis, ordem) values
  ('boas_vindas', 'Boas-vindas + link de acesso', 'Dar o link de acesso ao checklist', 'servico', 'Você envia, pela ficha. Sugerido assim que a pessoa deixa o e-mail no funil.', 'Todos', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"persona","o_que_e":"persona do checklist, em minúsculas","se_faltar":"—"},{"nome":"link_acesso","o_que_e":"link do app","se_faltar":"fica [link do acesso] e o envio é recusado"}]'::jsonb, 10),
  ('naoabriu', 'Reimpacto · não abriu o e-mail', 'Reenviar o link a quem não abriu o e-mail', 'servico', 'Você envia. O segmento sugere: entregue e não aberto há 3 dias ou mais.', 'Todos', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"link_acesso","o_que_e":"link do app","se_faltar":"o envio é recusado"}]'::jsonb, 20),
  ('naoclicou', 'Reimpacto · abriu e não clicou', 'Mostrar o que ela ganha, com prova social', 'novidades', 'Você envia. O segmento sugere: aberto e não clicado há 3 dias ou mais.', 'Só quem aceitou novidades', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"au_pair","o_que_e":"sim se a persona é au pair → estudante","se_faltar":"fala \"pessoas\""},{"nome":"link_acesso","o_que_e":"link do app","se_faltar":"o envio é recusado"}]'::jsonb, 30),
  ('cliquenaoapp', 'Reimpacto · clicou e não abriu o app', 'Lembrar que o acesso é sem senha', 'servico', 'Você envia. O segmento sugere: clicou no link e nunca entrou no app.', 'Todos', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"link_acesso","o_que_e":"link do app","se_faltar":"o envio é recusado"}]'::jsonb, 40),
  ('parouapp', 'Reimpacto · abriu o app e parou', 'Uma dica extra e o prazo real dela', 'novidades', 'Você envia. O segmento sugere: no app, sem sinal há 7 dias ou mais.', 'Só quem aceitou novidades', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"motivo","o_que_e":"o motivo do \"Precisa de você\"","se_faltar":"o trecho do motivo some"}]'::jsonb, 50),
  ('guia_chamada', 'Guia VLS-TS · convite para conversa', 'Oferecer uma conversa rápida sobre o caso', 'novidades', 'Você envia: o 1º e-mail de quem baixou o guia do VLS-TS.', 'Só quem aceitou novidades', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"prazo_vencido","o_que_e":"sim se o prazo de 3 meses já venceu","se_faltar":"—"},{"nome":"prazo_a_vencer","o_que_e":"sim se o prazo ainda vai vencer","se_faltar":"—"},{"nome":"prazo_limite","o_que_e":"data do prazo (DD/MM/AAAA)","se_faltar":"sem data, os dois trechos do prazo somem"},{"nome":"dias_para_prazo","o_que_e":"dias até o prazo","se_faltar":"—"},{"nome":"link_agenda","o_que_e":"link do cal.com","se_faltar":"—"}]'::jsonb, 60),
  ('guia_plataforma', 'Guia VLS-TS · teste da plataforma', 'Convidar para testar a plataforma', 'novidades', 'Você envia, depois do convite para conversa.', 'Só quem aceitou novidades', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"link_acesso","o_que_e":"link do app","se_faltar":"o envio é recusado"}]'::jsonb, 70),
  ('guia_alternancia', 'Guia alternância 30+ · convite para conversa', 'Oferecer uma conversa antes de ela escrever para a escola', 'novidades', 'Você envia: o 1º e-mail de quem pegou o e-mail em francês para a escola.', 'Só quem aceitou novidades', false, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"etapa_pesquisando · etapa_escolhendo_escola · etapa_recusa_idade · etapa_buscando_empresa · etapa_montando_contrato","o_que_e":"sim na etapa que ela escolheu no guia","se_faltar":"sem etapa, nenhum trecho de etapa"},{"nome":"link_agenda","o_que_e":"link do cal.com","se_faltar":"—"}]'::jsonb, 80),
  ('cf_guia_1', 'Guia Campus France · e-mail 1', 'Entregar o checklist que ela pediu', 'servico', 'Sozinho, na hora do cadastro no guia (o banco chama o Worker).', 'Todos que pediram o guia', true, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"email","o_que_e":"o e-mail dela (rodapé)","se_faltar":"—"},{"nome":"link_checklist","o_que_e":"link privado do Notion (guias_links) com UTM","se_faltar":"sem link, o e-mail não sai"},{"nome":"nivel","o_que_e":"nível que ela marcou no guia","se_faltar":"aparecem os dois prazos"},{"nome":"prazo_nivel","o_que_e":"prazo do nível no calendário","se_faltar":"—"},{"nome":"etapa_nao_comecei · etapa_escolhendo_curso · etapa_juntando_documentos · etapa_dossie_enviado · etapa_entrevista_resposta","o_que_e":"sim na etapa que ela marcou no guia","se_faltar":"sem etapa, nenhum trecho de etapa"}]'::jsonb, 90),
  ('cf_guia_conversa', 'Guia Campus France · e-mail 2 (a conversa)', 'Começar a conversa com um toque', 'novidades', 'Sozinho, um dia depois do e-mail 1, às 10h de Brasília.', 'Só quem aceitou novidades', true, '[{"nome":"nome","o_que_e":"primeiro nome","se_faltar":"o trecho com o nome some"},{"nome":"email","o_que_e":"o e-mail dela (rodapé)","se_faltar":"—"},{"nome":"botoes_cidade","o_que_e":"os 8 botões de cidade, com o link assinado dela (vêm prontos do Worker)","se_faltar":"—"}]'::jsonb, 100)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('boas_vindas', 1, 'no_ar',
  $boas_vindas_assunto${nome}, seu link de acesso chegou$boas_vindas_assunto$,
  null,
  $boas_vindas_texto$Oi {nome}! Aqui está o link pra ver o seu checklist de {persona}, já com prazos reais: {link_acesso}

É sem senha — um clique e você já entra.

Ingryd · Por Dentro$boas_vindas_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('naoabriu', 1, 'no_ar',
  $naoabriu_assunto${nome}, isso ainda te interessa?$naoabriu_assunto$,
  null,
  $naoabriu_texto$Oi {nome}! Vi que o link do seu checklist ainda não foi aberto — deixo de novo aqui: {link_acesso}

Se caiu no spam, vale marcar como "não é spam" pra não perder os próximos.

Ingryd · Por Dentro$naoabriu_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('naoclicou', 1, 'no_ar',
  $naoclicou_assunto$outras {#au_pair}au pairs{/au_pair}{^au_pair}pessoas{/au_pair} que já passaram por isso$naoclicou_assunto$,
  null,
  $naoclicou_texto$Oi {nome}! Talvez o e-mail anterior não tenha deixado claro o que você ganha — várias pessoas no seu mesmo caminho já organizaram o dossiê usando o checklist: {link_acesso}

Qualquer dúvida, é só responder.
Ingryd · Por Dentro$naoclicou_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('cliquenaoapp', 1, 'no_ar',
  $cliquenaoapp_assunto$seu link ainda funciona, {nome}$cliquenaoapp_assunto$,
  null,
  $cliquenaoapp_texto$Oi {nome}! Vi que você chegou a clicar mas não chegou a entrar — o acesso é sem senha, um clique só: {link_acesso}

Se travou em algo, me conta que eu ajudo.
Ingryd · Por Dentro$cliquenaoapp_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('parouapp', 1, 'no_ar',
  $parouapp_assunto$uma dica rápida pro seu caso$parouapp_assunto$,
  null,
  $parouapp_texto$Oi {nome}! Separei uma dica que não estava no seu checklist, específica pro seu momento: [dica]

{#motivo}Também vi que {motivo} — vale resolver isso antes de qualquer outra coisa.

{/motivo}Ingryd · Por Dentro$parouapp_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('guia_chamada', 1, 'no_ar',
  $guia_chamada_assunto${nome}, como está o seu VLS-TS?$guia_chamada_assunto$,
  null,
  $guia_chamada_texto$Oi {nome}! Vi que você pegou o guia sobre o VLS-TS que travou na ANEF.

{#prazo_vencido}Pelas suas contas, o prazo de 3 meses venceu em {prazo_limite} — então vale agir logo.

{/prazo_vencido}{#prazo_a_vencer}Pelas suas contas, o prazo de 3 meses vence em {prazo_limite} ({dias_para_prazo} dias).

{/prazo_a_vencer}Se ninguém te respondeu ainda ou você ficou em dúvida em algum passo, posso olhar o seu caso numa conversa rápida. É só escolher um horário: {link_agenda}&utm_source=email&utm_campaign=guia-chamada

Ingryd · Por Dentro$guia_chamada_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('guia_plataforma', 1, 'no_ar',
  $guia_plataforma_assunto${nome}, quer testar a plataforma do Por Dentro?$guia_plataforma_assunto$,
  null,
  $guia_plataforma_texto$Oi {nome}! Estou abrindo algumas vagas de teste da plataforma do Por Dentro: checklist com prazos reais, pra você acompanhar cada etapa do seu processo na França num lugar só.

Se quiser testar, o acesso é por aqui: {link_acesso}

É sem senha, um clique e você entra. Em troca, só peço o seu feedback.

Ingryd · Por Dentro$guia_plataforma_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('guia_alternancia', 1, 'no_ar',
  $guia_alternancia_assunto${nome}, o e-mail para a escola e o próximo passo$guia_alternancia_assunto$,
  null,
  $guia_alternancia_texto$Oi {nome}! Vi que você pegou o modelo de e-mail em francês para pedir alternância depois dos 30.

{#etapa_pesquisando}Você disse que ainda está entendendo se pode fazer alternância passando dos 29. O primeiro passo é descobrir qual das exceções do limite de idade (ou qual contrato) é a sua. Dá pra fazer isso em poucos minutos olhando o seu histórico.

{/etapa_pesquisando}{#etapa_escolhendo_escola}Você disse que está escolhendo escola e curso. Antes de se candidatar, vale saber qual contrato a escola consegue montar com o seu histórico, pra não perder tempo com quem vai dizer "só até 29".

{/etapa_escolhendo_escola}{#etapa_recusa_idade}Você disse que já ouviu "só até 29" de uma escola. Esse "não" muitas vezes é medo de ficar com a vaga e sem empresa, não é a lei. O e-mail do guia serve justamente pra pedir a resposta por escrito, com a base legal.

{/etapa_recusa_idade}{#etapa_buscando_empresa}Você disse que já tem escola e falta a empresa. Aí o que pesa é o contrato e o incentivo financeiro pra empresa. Vale chegar nas conversas já com isso na mão.

{/etapa_buscando_empresa}{#etapa_montando_contrato}Você disse que já tem empresa e está montando o contrato. Nessa fase o que costuma travar é a autorização de trabalho e o prazo de 1 ano na França para alguns casos. Vale conferir antes de assinar.

{/etapa_montando_contrato}Se quiser rever o modelo, ele continua aqui: https://imigrantepordentro.com/guias/email-alternancia-30-mais/

E se quiser que eu olhe o seu caso antes de você escrever pra escola, é só escolher um horário: {link_agenda}&utm_source=email&utm_campaign=guia-alternancia

Ingryd · Por Dentro$guia_alternancia_texto$,
  null,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('cf_guia_1', 1, 'no_ar',
  $cf_guia_1_assunto${#nome}{nome}, aqui{/nome}{^nome}Aqui{/nome} está o seu checklist do Études en France$cf_guia_1_assunto$,
  $cf_guia_1_pre${#nivel}O link para guardar, o prazo do seu nível e o seu próximo passo.{/nivel}{^nivel}O link para guardar, os prazos e o seu próximo passo.{/nivel}$cf_guia_1_pre$,
  $cf_guia_1_texto${#nome}{nome}, o seu checklist está aqui{/nome}{^nome}O seu checklist está aqui{/nome}

Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.

Abrir o checklist no Notion: {link_checklist}

{#nivel}O prazo do seu nível · {nivel}: {prazo_nivel}
Se algum curso que você escolher tiver prazo próprio, vale o menor.

{/nivel}{^nivel}Prazos para submeter o dossiê · ciclo 2027-2028
14/12/2026 · 1º ano de Licence e Arquitetura
17/01/2027 · 2º e 3º ano de Licence, Licence Pro, Master e escolas
Se algum curso tiver prazo próprio, vale o menor.

{/nivel}{#etapa_nao_comecei}Para quem está na etapa que ainda não começou:
Comece pelo passo 1: o projeto de estudos.
Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista.

{/etapa_nao_comecei}{#etapa_escolhendo_curso}Para quem está na etapa que está escolhendo o curso:
Anote o prazo de cada curso que você escolher.
Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr.

{/etapa_escolhendo_curso}{#etapa_juntando_documentos}Para quem está na etapa que está juntando documentos, traduções e o teste:
Comece pelo que depende de outras pessoas.
Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027.

{/etapa_juntando_documentos}{#etapa_dossie_enviado}Para quem está na etapa que já enviou o dossiê:
Pague a taxa e declare o pagamento.
A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma.

{/etapa_dossie_enviado}{#etapa_entrevista_resposta}Para quem está na etapa que está esperando a entrevista ou a resposta:
Treine a entrevista em voz alta.
Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha.

{/etapa_entrevista_resposta}Ficou com dúvida? É só responder este e-mail. Chega direto para mim.

Ingryd · Por Dentro

—
Você recebeu este e-mail porque pediu o checklist Études en France no Por Dentro com {email}.$cf_guia_1_texto$,
  $cf_guia_1_html$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<h1 style="margin:0 0 14px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">{#nome}{nome}, o seu checklist está aqui{/nome}{^nome}O seu checklist está aqui{/nome}</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;">Para você não perder o link, ele fica guardado neste e-mail. Abra quando quiser, no computador ou no celular.</p>
<p style="margin:0 0 24px;"><a href="{link_checklist}" style="display:inline-block; background:#577328; color:#FBFAF7; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:4px;">Abrir o checklist no Notion</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:#F4F1EC; border:1px solid #DEB975; border-radius:8px; padding:16px 18px;">{#nivel}<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">O prazo do seu nível · {nivel}</div>
       <div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#577328; line-height:1.3; margin:4px 0;">{prazo_nivel}</div>
       <div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se algum curso que você escolher tiver prazo próprio, vale o menor.</div>{/nivel}{^nivel}<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6E6862;">Prazos para submeter o dossiê · ciclo 2027-2028</div>
       <div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#2B2B2B; margin:6px 0;"><b>14/12/2026</b> · 1º ano de Licence e Arquitetura<br><b>17/01/2027</b> · 2º e 3º ano de Licence, Licence Pro, Master e escolas</div>
       <div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6E6862;">Se algum curso tiver prazo próprio, vale o menor.</div>{/nivel}</td></tr></table>
{#etapa_nao_comecei}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que ainda não começou:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Comece pelo passo 1: o projeto de estudos.</b><br>Escreva em 3 ou 4 linhas o que você estudou até aqui e o que quer estudar na França. Os outros onze passos se apoiam nele, inclusive as motivações e a entrevista.</p>{/etapa_nao_comecei}{#etapa_escolhendo_curso}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está escolhendo o curso:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Anote o prazo de cada curso que você escolher.</b><br>Alguns cursos fecham antes do calendário geral, e vale sempre o menor prazo. Para procurar: o catálogo de formações do site do Campus France Brasil, onisep.fr e letudiant.fr.</p>{/etapa_escolhendo_curso}{#etapa_juntando_documentos}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está juntando documentos, traduções e o teste:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Comece pelo que depende de outras pessoas.</b><br>Peça os históricos e faça a apostila antes da tradução juramentada. E garanta a inscrição no teste de francês: o resultado precisa chegar ao Campus France até 05/03/2027.</p>{/etapa_juntando_documentos}{#etapa_dossie_enviado}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que já enviou o dossiê:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Pague a taxa e declare o pagamento.</b><br>A taxa é de R$ 600, por Pix. A verificação do seu dossiê só começa depois que você declara o pagamento na plataforma.</p>{/etapa_dossie_enviado}{#etapa_entrevista_resposta}<p style="margin:0 0 4px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; color:#6E6862;">Para quem está na etapa que está esperando a entrevista ou a resposta:</p>
       <p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2B2B2B;"><b>Treine a entrevista em voz alta.</b><br>Ela é marcada em até duas semanas depois da validação e acontece prioritariamente em francês. Treine em voz alta, em francês, como você explica o seu projeto de estudos e cada escolha.</p>{/etapa_entrevista_resposta}
<p style="margin:8px 0 20px; background:#F4F1EC; border-radius:8px; padding:12px 14px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;"><b style="color:#2B2B2B;">Ficou com dúvida?</b> É só responder este e-mail. Chega direto para mim.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebeu este e-mail porque pediu o checklist Études en France no Por Dentro com {email}.</td></tr>
</table></td></tr></table>
</body></html>$cf_guia_1_html$,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, nota, publicado_em)
values ('cf_guia_conversa', 1, 'no_ar',
  $cf_guia_conversa_assunto${#nome}{nome}, uma pergunta rápida{/nome}{^nome}Uma pergunta rápida{/nome}$cf_guia_conversa_assunto$,
  $cf_guia_conversa_pre$Um toque e eu já sei para onde você vai.$cf_guia_conversa_pre$,
  $cf_guia_conversa_texto$Oi, eu sou a Ingryd. Moro na França e criei o Por Dentro para quem está fazendo esse caminho agora.

{#nome}{nome}, para{/nome}{^nome}Para{/nome} qual cidade você quer ir?
Toque numa opção. Leva dois segundos e me ajuda a te mandar o que importa para o seu caso.

{botoes_cidade}

Prefere escrever? Responda este e-mail. Eu leio cada resposta.

Ingryd · Por Dentro

—
Você recebe este e-mail porque pediu o checklist Études en France com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.$cf_guia_conversa_texto$,
  $cf_guia_conversa_html$<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{assunto}</title></head>
<body style="margin:0; padding:0; background:#F4F1EC;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{pre}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EC;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#2B2B2B;">Por <span style="color:#604034;">Dentro</span></td></tr>
<tr><td style="background:#FBFAF7; border:1px solid #E2DED7; border-radius:8px; padding:32px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
<td style="width:68px; vertical-align:middle;"><img src="https://imigrantepordentro.com/images/uploads/foto-de-perfil.jpg" width="68" height="68" alt="Foto da Ingryd" style="display:block; width:68px; height:68px; border-radius:50%; border:2px solid #DEB975; object-fit:cover;"></td>
<td style="padding-left:14px; vertical-align:middle;"><div style="font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; line-height:1.2; color:#2B2B2B;">Oi, eu sou a Ingryd</div>
<div style="font-family:'Inter', Arial, Helvetica, sans-serif; font-size:13px; line-height:1.45; color:#6E6862; margin-top:2px;">Moro na França e criei o Por Dentro para quem está fazendo esse caminho agora.</div></td></tr></table>
<h1 style="margin:0 0 10px; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:24px; line-height:1.25; font-weight:700; color:#2B2B2B;">{#nome}{nome}, para{/nome}{^nome}Para{/nome} qual cidade você quer ir?</h1>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Toque numa opção. Leva dois segundos e me ajuda a te mandar o que importa para o seu caso.</p>
<div style="margin:0 0 12px;">{botoes_cidade}</div>
<div style="border-top:1px solid #E2DED7; margin:8px 0 16px;"></div>
<p style="margin:0 0 16px; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#6E6862;">Prefere escrever? Responda este e-mail. Eu leio cada resposta.</p>
<p style="margin:0; font-family:'Fraunces', Georgia, 'Times New Roman', serif; font-size:16px; font-style:italic; color:#2B2B2B;">Ingryd · Por Dentro</p>
</td></tr>
<tr><td style="padding:20px 4px 0; font-family:'Inter', Arial, Helvetica, sans-serif; font-size:12px; line-height:1.55; color:#6E6862;">Você recebe este e-mail porque pediu o checklist Études en France com {email} e aceitou receber novidades do Por Dentro. Para não receber mais, responda com a palavra sair.</td></tr>
</table></td></tr></table>
</body></html>$cf_guia_conversa_html$,
  'texto de 16/10/2026, migrado do código', now())
on conflict (chave, versao) do nothing;
