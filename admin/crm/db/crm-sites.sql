-- Por Dentro — CRM: os Sites úteis (árvore de links persona → etapa → link, que vira o carrossel do dashboard)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql (usa contatos e eh_admin()). Idempotente e só acrescenta:
-- não apaga nem reescreve dado nenhum (rodar de novo não duplica as sementes).
--
-- Para que serve: cada pessoa na plataforma precisa consultar alguns sites oficiais para fazer a sua démarche (ANEF,
-- Campus France, France-Visas...). Quais sites depende de QUEM ela é (persona) e de EM QUE PONTO está (etapa). Aqui você
-- mantém essa árvore: adiciona e exclui links por persona e etapa; o dashboard mostra, em carrossel, os da persona da
-- pessoa que estejam na etapa 'geral' ou na etapa em que ela está.
--
--   persona ─┬─ geral                  (vale para todas da persona)
--            ├─ <etapa>                (ex.: saindo_do_au_pair, candidatura, chegada: o app reconhece a etapa da pessoa)
--            └─ ...
--
-- As etapas válidas por persona vivem no código (admin/crm/crm.js → SITES_ARVORE e assets/js/sites.js do app): a
-- coluna `ramo` só guarda a chave. Uma chave que o app não reconhece é simplesmente ignorada, nunca quebra a tela.
--
-- Quem lê e escreve o quê:
--   admin (você)   → tudo via RLS (eh_admin())
--   pessoa logada  → meus_sites() (só os da persona dela, sem os excluídos)
--
-- "Excluir" no painel é arquivar (arquivado_em): some do app na hora e dá para recuperar pelo SQL se foi sem querer.

create table if not exists public.sites_uteis (
  id bigint generated always as identity primary key,
  persona text not null check (persona in ('au_pair_estudante', 'campus_france', 'alternancia_emprego', 'conjuge', 'pvt')),
  ramo text not null default 'geral' check (ramo ~ '^[a-z0-9_]{1,40}$'),
  titulo text not null check (length(titulo) between 1 and 80),
  descricao text check (descricao is null or length(descricao) <= 200),   -- "para que serve", uma frase
  url text not null check (length(url) <= 500 and url ~ '^https://'),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  arquivado_em timestamptz
);
create index if not exists sites_uteis_persona_idx on public.sites_uteis (persona, ramo, ordem);
-- O mesmo link não entra duas vezes na mesma etapa da mesma persona (as sementes abaixo dependem disto).
create unique index if not exists sites_uteis_unico_idx on public.sites_uteis (persona, ramo, url) where arquivado_em is null;

alter table public.sites_uteis enable row level security;
drop policy if exists "sites_uteis: só admin" on public.sites_uteis;
create policy "sites_uteis: só admin" on public.sites_uteis
  for all using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.sites_uteis from anon;

-- ---------- Pessoa logada: ler ----------
create or replace function public.meus_sites() returns table (
  id bigint, ramo text, titulo text, descricao text, url text, ordem int)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select s.id, s.ramo, s.titulo, s.descricao, s.url, s.ordem
    from sites_uteis s
    join contatos c on c.persona = s.persona
   where c.user_id = auth.uid() and s.arquivado_em is null
   order by s.ordem, s.id
   limit 60;
$$;
revoke all on function public.meus_sites() from public, anon;
grant execute on function public.meus_sites() to authenticated;

-- ---------- Sementes: sites oficiais (só a página inicial de cada um) ----------
-- Confira cada link antes de divulgar e mude pelo painel (Sites úteis). Só entram domínios oficiais do governo francês.
insert into public.sites_uteis (persona, ramo, titulo, descricao, url, ordem) values
  ('au_pair_estudante', 'geral', 'ANEF', 'Onde se pede a mudança de statut (au pair → estudante) e a renovação do titre de séjour.', 'https://administration-etrangers-en-france.interieur.gouv.fr', 10),
  ('au_pair_estudante', 'geral', 'Campus France', 'Candidatura e orientação para estudar na França.', 'https://www.campusfrance.org', 20),
  ('au_pair_estudante', 'geral', 'France-Visas', 'Pedido de visto, incluindo o de estudante, e informações oficiais.', 'https://france-visas.gouv.fr', 30),
  ('au_pair_estudante', 'geral', 'Service-Public', 'Fichas oficiais sobre titre de séjour, prazos e documentos.', 'https://www.service-public.fr', 40),
  ('au_pair_estudante', 'geral', 'Mes services Étudiant', 'Bolsas, moradia e a garantia Visale para estudantes.', 'https://www.messervices.etudiant.gouv.fr', 50),
  ('campus_france', 'geral', 'Service-Public', 'Fichas oficiais sobre visto, titre de séjour e prazos.', 'https://www.service-public.fr', 10),
  ('campus_france', 'candidatura', 'Campus France', 'A candidatura, o calendário e o acompanhamento do dossiê.', 'https://www.campusfrance.org', 10),
  ('campus_france', 'chegada', 'France-Visas', 'Visto de estudante e informações oficiais antes de viajar.', 'https://france-visas.gouv.fr', 10),
  ('campus_france', 'chegada', 'ANEF', 'Validação do visto e renovação do titre de séjour.', 'https://administration-etrangers-en-france.interieur.gouv.fr', 20),
  ('campus_france', 'chegada', 'Mes services Étudiant', 'Moradia, bolsas e a garantia Visale.', 'https://www.messervices.etudiant.gouv.fr', 30),
  ('campus_france', 'chegada', 'Ameli', 'Sécurité sociale: inscrição e cartão Vitale.', 'https://www.ameli.fr', 40),
  ('alternancia_emprego', 'geral', 'France Travail', 'Vagas, inscrição e acompanhamento de quem busca emprego.', 'https://www.francetravail.fr', 10),
  ('alternancia_emprego', 'geral', '1jeune1solution', 'Portal do governo com vagas e ajudas para jovens, inclusive em alternância.', 'https://www.1jeune1solution.gouv.fr', 20),
  ('alternancia_emprego', 'geral', 'ANEF', 'Mudança de statut e renovação do titre de séjour.', 'https://administration-etrangers-en-france.interieur.gouv.fr', 30),
  ('alternancia_emprego', 'geral', 'Service-Public', 'Fichas oficiais sobre trabalho, contrato e titre de séjour.', 'https://www.service-public.fr', 40),
  ('conjuge', 'geral', 'ANEF', 'Pedido e renovação do titre de séjour de cônjuge.', 'https://administration-etrangers-en-france.interieur.gouv.fr', 10),
  ('conjuge', 'geral', 'Service-Public', 'Fichas oficiais sobre titre de séjour por vida familiar.', 'https://www.service-public.fr', 20),
  ('conjuge', 'geral', 'OFII', 'Acolhida e contrato de integração (CIR) de quem chega para morar.', 'https://www.ofii.fr', 30),
  ('conjuge', 'geral', 'Ameli', 'Sécurité sociale: inscrição e cartão Vitale.', 'https://www.ameli.fr', 40),
  ('conjuge', 'geral', 'CAF', 'Ajudas de moradia e familiares, quando a pessoa tem direito.', 'https://www.caf.fr', 50),
  ('pvt', 'geral', 'France-Visas', 'Visto Vacances-Travail e informações oficiais.', 'https://france-visas.gouv.fr', 10),
  ('pvt', 'geral', 'Service-Public', 'Fichas oficiais sobre trabalho e estadia na França.', 'https://www.service-public.fr', 20),
  ('pvt', 'geral', 'Ameli', 'Sécurité sociale: saúde durante a estadia.', 'https://www.ameli.fr', 30),
  ('pvt', 'geral', 'Impots.gouv', 'Declaração e imposto de quem trabalha na França.', 'https://www.impots.gouv.fr', 40),
  ('pvt', 'geral', 'France Travail', 'Vagas e apoio na busca de emprego.', 'https://www.francetravail.fr', 50)
on conflict do nothing;
