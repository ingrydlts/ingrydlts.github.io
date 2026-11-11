# CRM · A dor de cada pessoa (design)

Data: 2026-11-11 · Status: aguardando revisão da Ingryd · Parte B de três
(A: matriz da jornada no Estúdio de e-mails · B: este documento · C: editor do e-mail, em
`2026-11-11-crm-editor-email-design.md`).

Protótipo navegável (3 telas): artefato "Editor de e-mail e dor", versão 1.

## 1. Objetivo

A Ingryd vende consultoria e produto resolvendo a **dor** de quem chega pelo funil. Hoje o CRM não sabe qual é a dor de
cada pessoa: ela existe só na cabeça da Ingryd e, em outro formato, no hub privado. O objetivo é que a dor seja um dado
do CRM, **visível sempre que há uma pessoa ou um e-mail na tela**, e que adapte o texto do e-mail.

Sucesso, em frases que dá para conferir:

1. Ao abrir a ficha, a dor principal está no topo, com a fonte (o que a pessoa marcou ou escreveu).
2. Quem ainda não tem dor vê, no mesmo lugar, até 3 sugestões com a evidência, e confirma com 1 clique.
3. Na lista de Contatos dá para filtrar por dor.
4. Cada modelo de e-mail diz qual dor resolve, na lista do Estúdio.
5. O e-mail usa a dor da pessoa (`{dor}`), e sem dor cai numa frase neutra, sem buraco.

## 2. O que existe hoje (lido no código)

- Não há campo de dor no CRM (`admin/crm/crm.js`, `taxonomia.js`, `estudio.js`).
- A **etapa do guia** é gravada em `contatos.respostas.objetivo` (códigos `cf-*`, `alt-*`, `tec-*`, `vls-*`, e `ap-*` no Au pair).
  O catálogo `taxonomia.js` e `ETAPAS_GUIA` (`estudio.js`) conhecem só I01 a I04: **o Au pair (`ap-*`) não está nele**.
- O texto livre vive em `perguntas_unicas.texto` (até 2000 caracteres, só admin) e em `respostas_email`.
- A dor existe no hub privado (`D-<slug>`), outro catálogo. **Este spec não liga os dois.**

## 3. Decisões tomadas com a Ingryd

1. **Quem define a dor:** a Ingryd marca. O CRM sugere por **regra simples**, sem IA e sem enviar texto de ninguém a terceiros.
2. **Dados:** tabelas novas no Supabase, com SQL, RLS e testes de isolamento do projeto.
3. **Escopo de uso nos e-mails:** só os modelos novos (template "Minha história + convite para call") usam `dor`. Os e-mails
   que já existem não mudam.
4. **O catálogo de dores é cadastrado pela Ingryd na tela do CRM.** Nenhum SQL commitado leva os rótulos do hub privado
   (este repositório é público).

## 4. Modelo de dados

Arquivo novo: `admin/crm/db/crm-dor.sql`. Roda depois de `crm-estudio-emails-3.sql`, é idempotente, tem o bloco "como
desfazer" e roda primeiro no Supabase de teste, depois no de produção.

```sql
create table if not exists public.dores (
  codigo         text primary key check (codigo ~ '^[a-z0-9-]{2,40}$'),
  rotulo         text not null check (length(rotulo) between 3 and 120),   -- como a Ingryd chama a dor
  frase          text not null check (length(frase) between 2 and 60),     -- cabe numa frase de e-mail: "o prazo"
  palavras       text[] not null default '{}',                              -- palavras que sugerem a dor no texto livre
  respostas_guia text[] not null default '{}',                              -- códigos de respostas.objetivo que sugerem a dor
  oferta         text,                                                      -- o que resolve: "call", "hub-estudos", vazio = a definir
  ordem          int  not null default 100,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

create table if not exists public.contatos_dor (            -- append-only: a linha mais nova de cada contato é a dor atual
  id           bigint generated always as identity primary key,
  contato_id   uuid not null references public.contatos(id) on delete cascade,
  dor_codigo   text references public.dores(codigo) on delete set null,   -- null = "sem dor por enquanto"
  fonte        text not null check (fonte in ('guia', 'texto', 'guia_texto', 'manual')),
  marcada_em   timestamptz not null default now()
);
create index if not exists contatos_dor_contato_idx on public.contatos_dor (contato_id, marcada_em desc);

alter table public.modelos_email
  add column if not exists dores_codigos text[] not null default '{}',   -- dores que o e-mail atende (do contexto, ver abaixo)
  add column if not exists dores_ajustadas boolean not null default false; -- false = recalcula sozinho; true = a Ingryd mexeu
alter table public.modelos_email
  add column if not exists dores_so_confirmada boolean not null default false; -- filtro opcional: só quem já tem a dor confirmada
```

`dores_codigos` é lista simples (sem chave estrangeira por elemento); o Estúdio ignora códigos que não existem mais em `dores`.
Quando `dores_ajustadas = false`, o editor recalcula a lista a cada mudança de página ou resposta marcada, a partir de
`dores.respostas_guia` (ver o spec do editor, passo "Quem recebe e quando").

Por que uma tabela própria em vez de coluna em `contatos`: a classificação é interna e **não pode chegar à própria pessoa**
(`contatos` tem política do dono); e a visão `crm_contatos` é reescrita por várias migrações, o que torna frágil acrescentar
coluna nela. O histórico sai de graça por ser append-only.

Segurança (regras de isolamento do `CLAUDE.md`):

- `alter table ... enable row level security` nas duas tabelas novas; política `for all using (public.eh_admin()) with check
  (public.eh_admin())`; `revoke all ... from anon` e também de `authenticated`.
- Nenhuma função `security definer` nova. Nada liga ou busca ficha por e-mail.
- Tabelas novas entram em `db/conferir-banco.sql` **do repositório do app**, e o teste do app reprova se não entrarem.
  Ao rodar nos dois bancos, a Ingryd roda `db/auditoria-isolamento.sql` e `db/conferir-banco.sql`; os dois voltam vazios.
- O texto que a pessoa escreveu **não é copiado**: a ficha lê `perguntas_unicas`/`respostas_email` ao vivo.

## 5. A regra de sugestão

Módulo puro, sem DOM: `admin/crm/dor.js` (ES module nativo, sem build). Roda no navegador do CRM, que já carrega os contatos.

```
sugereDor(pessoa, dores) -> [{ codigo, guia: boolean, n: number, trechos: [{ini, fim}] }]   // no máximo 3
  pessoa = { guia: string|null, texto: string }       // guia = respostas.objetivo; texto = textos livres juntados
```

1. **Resposta do guia.** Se `pessoa.guia` está em `respostas_guia` de uma dor ativa, essa dor entra com `guia = true`.
2. **Texto livre.** Compara o texto, sem acento e sem diferença de maiúsculas, com `palavras` de cada dor ativa.
   Palavra de **5 letras ou mais** vale pelo início ("tradu" casa "traduções"); **mais curta**, só inteira
   (assim "conta" não casa "contato"). `n` = quantas palavras diferentes casaram; `trechos` = onde, para destacar.
3. **Ordem:** primeiro as que vêm do guia, depois por `n` decrescente. Máximo 3. Sem resposta e sem texto: lista vazia.
4. **Nunca grava.** Só a Ingryd confirma. Fonte gravada: `guia`, `texto`, `guia_texto` ou `manual`.

O mapa "resposta do guia → dor" é dado (`dores.respostas_guia`), editável na tela do catálogo, não código.

## 6. Interface

Todos os desenhos estão no protótipo; os textos exatos saem dele.

- **Ficha da pessoa:** cartão "Dor principal" no topo. Três estados: *sem dados* (nada a sugerir, escolha manual);
  *sugestões* (cada uma com a evidência: "marcou no guia: …" e "escreveu: … " com as palavras reconhecidas em destaque;
  botões "Confirmar esta dor", "Escolher outra", "Sem dor por enquanto"); *confirmada* (dor, fonte, próximo passo sugerido).
  Abaixo, o que a pessoa escreveu e a resposta marcada no guia.
- **Contatos e Hoje:** coluna e filtro "Dor".
- **Estúdio de e-mails:** a dor atendida pelo e-mail é **deduzida do contexto** (página de entrada e respostas marcadas) e
  aparece pré-preenchida, com selo "Automático"; a Ingryd só ajusta (spec do editor, passo "Quem recebe e quando"). A lista de
  modelos mostra a dor como etiqueta. A visão por dor da matriz da jornada é decisão do spec A.
- **Princípio "contexto antes de catálogo":** nenhum seletor de dor mostra o catálogo inteiro de saída. Mostra primeiro as dores
  relevantes ao que está na tela, já marcadas, e deixa as demais recolhidas, com busca. Vale para o editor, Contatos, ficha e Estúdio.
- **Catálogo de dores (nova tela no CRM):** tabela editável com rótulo, frase de e-mail, palavras, respostas do guia e
  oferta; campo "Teste a regra" que mostra o resultado ao vivo para um texto colado.
- **Sinal de cor nunca sozinho:** toda etiqueta de dor tem texto. 380 px: cartão em coluna única, botões de largura total.

## 7. Variáveis de e-mail

- `dor` (texto): a `frase` da dor atual. Sem dor, o bloco usa o ramo neutro (`{^dor}`), como as variáveis atuais.
- `dor_<codigo>` (sim/não): para o bloco "Só para quem tem esta dor", no padrão de `etapa_*`.
- O Worker preenche as duas ao montar o envio (`crmVarsNovos`, `cms-oauth-worker/worker.js`), lendo `contatos_dor`.
  Só os modelos criados no Estúdio recebem estas variáveis. `estudio.js` ganha `dor` e `dor_*` no catálogo `CAT`.

## 8. Au pair no catálogo (pré-requisito encontrado na leitura)

Acrescentar a página **I05 · Au pair, checklist de chegada** em `taxonomia.js` e as etapas `ap-tudo-bem`,
`ap-nao-sei-comecar`, `ap-medo-prazo`, `ap-travado`, `ap-pesado` em `ETAPAS_GUIA`, e classificar `aupair_chegada_1/2` na
página I05. Sem isso a regra "respondeu X no formulário" não alcança o Au pair. O `taxonomia.js` é cópia do catálogo do vault:
atualizar o vault no mesmo dia.

## 9. Testes

- Unidade (`node --test`, padrão de `admin/crm/db/testes/`): casos da regra: acento e maiúscula; palavra curta só inteira
  ("contato" não casa "conta"); palavra longa por prefixo; guia sem texto; texto sem guia; os dois (mesma dor, uma entrada
  só); texto vazio; mais de 3 candidatas; dor inativa ignorada. Casos de exemplo já verificados no protótipo: uma pessoa
  com guia de prazo e texto sobre validação e banco sugere "prazo" (guia + texto) e "dinheiro"; uma pessoa sem dados não sugere nada.
- SQL: o sentinela `isolamento.test.mjs` do app continua verde; teste novo `crm-dor.test.mjs` confere RLS ligada, `anon`
  sem acesso e que só o admin lê e escreve.
- Navegador: confirmar uma dor na ficha grava uma linha em `contatos_dor` e a ficha volta a mostrá-la; trocar a dor grava outra
  linha, sem apagar a anterior.

## 10. Fora de escopo

IA para classificar; ligação com o catálogo de dores do hub; classificar em lote as pessoas que já existem; usar `dor` nos
e-mails que já existem; ranking de dores por volume (pode vir depois, a tabela já guarda o que é preciso).

## 11. Riscos

- Palavras-chave ruins geram sugestões ruins: mitigado por nunca gravar sozinho e pelo campo "Teste a regra".
- Catálogo vazio no começo: a ficha mostra o estado "sem dados" e um atalho para cadastrar a primeira dor.
- Texto de pessoas é dado pessoal: fica só no Supabase; nenhuma cópia em log, repositório ou serviço externo.
