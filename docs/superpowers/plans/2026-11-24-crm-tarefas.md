# CRM: acompanhamento de tarefas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à Ingryd uma tela de tarefas por prazo e por pessoa, as mesmas tarefas na ficha, o estado "aceitou a plataforma" e um feed `.ics` para o Google Calendar, com mudar prazo em 1 clique e marcar como feita.

**Architecture:** A tarefa continua sendo uma linha de `caso_acoes` (`dono='ingryd'`), agora com prazo editável. A lógica de datas e agrupamento vive num módulo puro novo (`admin/crm/tarefas.js`), testável em Node. O feed é uma rota nova do Worker que lê o banco com a chave de serviço e protege a URL por token. A tela e a ficha só desenham o que o módulo devolve.

**Tech Stack:** JS ES modules sem build (`admin/crm/*.js`), Supabase (SQL em `admin/crm/db/`), Cloudflare Worker (`cms-oauth-worker/worker.js`), testes `node` sem dependências no padrão `check()` já usado.

**Spec:** `docs/superpowers/specs/2026-11-24-crm-tarefas-design.md`

## Global Constraints

- Nenhuma chave no navegador; o feed lê o banco só no Worker (`SUPABASE_SERVICE_ROLE_KEY` já existe).
- Nada de caso real, nome ou dado pessoal em testes, docs ou SQL: só pessoas fictícias (`Ana Souza`, `ana@example.com`). O repositório é público.
- SQL novo: RLS e política `eh_admin()` já cobrem `caso_acoes`; não criar tabela nem função `security definer` (a coluna nova fica em `contatos`, já protegida). Rodar primeiro no Supabase de teste; depois `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` do app (os dois vazios = pronto).
- `caso_acoes.prazo` é `date`; "hoje" é sempre calculado em `Europe/Paris`.
- O feed: `GET /api/crm/tarefas.ics?t=<token>`; sem `TAREFAS_ICS_TOKEN` (ou com menos de 32 caracteres) a rota fica fechada (500); token errado = 404; comparação em tempo constante com `exportKeysMatch`; só tarefas `dono='ingryd'` com `estado <> 'concluida'` e `prazo` preenchido; no máximo 500 eventos.
- Evento: dia inteiro, `UID` = `acao-<id>@pordentro`, título `Nome · titulo`, sem outro texto além do link da ficha.
- Interface: 4 estados (carregando, vazio, erro com "tentar de novo"; dado velho não se aplica), legível em 380 px; cor nunca é a única informação.
- Commits `tipo(escopo): descrição`; terminar cada commit com as linhas de atribuição pedidas pela sessão.

## Review Focus

1. Título com vírgula, ponto e vírgula, barra invertida, quebra de linha ou acentos longos: o `.ics` precisa escapar e dobrar linhas (>75 bytes) sem corromper o evento. (Task 3)
2. Prazo de "hoje" quando o relógio de Paris já virou o dia mas o UTC não (e o inverso): a tarefa cai em "Hoje" pelo dia de Paris. (Task 2)
3. Marcar como feita e desfazer: `concluida_em` e `concluida_por` voltam a `null` ao reabrir; a tarefa some do feed ao concluir e volta ao reabrir. (Tasks 3 e 4)
4. Pessoa com conta mas com `situacao_plataforma='ainda_nao'` aparece como "Já aceitou"; pessoa sem conta marcada "fora da plataforma" nunca é chamada de aceitou. (Tasks 1, 2 e 6)
5. Pessoa sem nome, lista vazia, erro do Supabase, token ausente e token errado: texto de reserva "Sem nome", estado vazio, estado de erro, 500 e 404, nunca tela em branco nem feed aberto. (Tasks 3 e 4)

---

### Task 1: Coluna "aceitou a plataforma" e índice das tarefas

**Files:**
- Create: `admin/crm/db/crm-tarefas.sql`
- Create: `admin/crm/db/testes/crm-tarefas.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (script `test:tarefas`)

**Interfaces:**
- Produces: coluna `contatos.situacao_plataforma text not null default 'ainda_nao'` com check em `('ainda_nao','fora_da_plataforma','aceitou')`; `crm_contatos` a expõe no FIM da visão; índice `caso_acoes_ingryd_prazo_idx on caso_acoes (dono, estado, prazo)`.

- [ ] **Step 1: Write the failing test** em `crm-tarefas.test.mjs`, no padrão de `crm-1a1-cal.test.mjs` (ler esse arquivo e copiar o jeito de carregar o SQL): `situacao_plataforma tem padrão 'ainda_nao'`; `valor fora da lista é rejeitado`; `crm_contatos expõe situacao_plataforma no fim da visão`; `o SQL pode rodar duas vezes`; `não cria tabela nem função security definer`.
- [ ] **Step 2: Run** `cd admin/crm/db/testes && node crm-tarefas.test.mjs`. Expected: FAIL (arquivo SQL não existe).
- [ ] **Step 3: Write `crm-tarefas.sql`** idempotente (`add column if not exists`, `drop constraint if exists`, `create index if not exists`). Para a visão: achar o arquivo que define a versão mais nova de `crm_contatos` (`grep -l "create or replace view public.crm_contatos" db/*.sql`, o último a mexer na visão), copiar a definição inteira e acrescentar a coluna no FIM, mantendo `with (security_invoker = true)` e o `revoke all ... from anon`. Cabeçalho de comentário no estilo dos outros arquivos.
- [ ] **Step 4: Run** o teste de novo e `node crm-fase2.test.mjs`. Expected: PASS, sem regressão.
- [ ] **Step 5: Commit** `feat(crm): coluna situacao_plataforma e índice das tarefas`.

### Task 2: Módulo puro de tarefas

**Files:**
- Create: `admin/crm/tarefas.js`
- Test: `admin/crm/db/testes/crm-tarefas-logica.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (script `test:tarefas-logica`)

**Interfaces:**
- Produces (todas exportadas, puras, sem DOM):
  - `type Tarefa = { id: number, contato_id: string, titulo: string, prazo: string | null, estado: 'aberta'|'aguardando_ela'|'concluida', nome?: string }`
  - `hojeEmParis(agora?: Date): string` → `'YYYY-MM-DD'` em Europe/Paris (via `Intl.DateTimeFormat`, sem lib).
  - `atalhosDePrazo(hoje: string): { chave: 'hoje'|'amanha'|'semana', rotulo: string, data: string }[]` (`semana` = hoje + 7 dias, sempre contado a partir de hoje, nunca do prazo antigo).
  - `agruparPorPrazo(tarefas: Tarefa[], hoje: string): { chave: 'atrasadas'|'hoje'|'semana'|'depois'|'sem_prazo', titulo: string, itens: Tarefa[] }[]` (só grupos com itens; abertas apenas; "semana" = amanhã até hoje+7; dentro do grupo, por prazo e depois por id).
  - `agruparPorPessoa(tarefas: Tarefa[]): { contato_id: string, nome: string, itens: Tarefa[] }[]` (nome vazio vira `'Sem nome'`; pessoas por prazo mais próximo; sem prazo por último).
  - `situacaoPlataforma(c: { user_id?: string|null, situacao_plataforma?: string|null }): { chave: 'aceitou'|'ainda_nao'|'fora_da_plataforma', rotulo: 'Já aceitou'|'Ainda não'|'Atendida fora da plataforma' }` (`user_id` presente vence o valor gravado).

- [ ] **Step 1: Write the failing tests** com `check()`: `hojeEmParis vira o dia antes do UTC` (`2026-11-24T23:30:00Z` → `'2026-11-25'`) e `depois do UTC` (`2026-06-24T22:30:00Z` → `'2026-06-25'`); `atalhosDePrazo('2026-11-24')` → `2026-11-24`, `2026-11-25`, `2026-12-01`; `agruparPorPrazo` põe `2026-11-23` em atrasadas, `2026-11-24` em hoje, `2026-11-30` em semana, `2026-12-15` em depois, `null` em sem_prazo, e ignora `concluida`; `agruparPorPessoa` usa `'Sem nome'` e ordena por prazo; `situacaoPlataforma({user_id:'u1', situacao_plataforma:'ainda_nao'}).chave === 'aceitou'`; `{situacao_plataforma:'fora_da_plataforma'}` → `fora_da_plataforma`; `{}` → `ainda_nao`.
- [ ] **Step 2: Run** `node crm-tarefas-logica.test.mjs`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** as funções acima em `tarefas.js` (ES module, `export function`, mesmo estilo de `ficha.js`).
- [ ] **Step 4: Run** o teste. Expected: PASS.
- [ ] **Step 5: Commit** `feat(crm): módulo de tarefas (prazos, grupos, situação da plataforma)`.

### Task 3: Rota do feed `.ics` no Worker

**Files:**
- Modify: `cms-oauth-worker/worker.js` (rota perto de `/api/crm/*` ~linha 5774; função `handleCrmTarefasIcs(request, env)`; helper `crmIcsTexto(s: string): string` e `crmIcsDobrar(linha: string): string`)
- Test: `cms-oauth-worker/testes/crm-tarefas-ics.test.mjs`
- Modify: `cms-oauth-worker/README.md` (nova seção: secret `TAREFAS_ICS_TOKEN`, como gerar, como assinar no Google Calendar)

**Interfaces:**
- Consumes: `exportKeysMatch(provided, expected)`, `CRM_SUPABASE_URL`, `env.SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `GET /api/crm/tarefas.ics?t=<token>` → `200 text/calendar; charset=utf-8` com `VCALENDAR` (`X-WR-CALNAME:Por Dentro · Tarefas`), um `VEVENT` por tarefa: `UID:acao-<id>@pordentro`, `DTSTAMP` de `atualizado_em`, `DTSTART;VALUE=DATE:AAAAMMDD`, `DTEND;VALUE=DATE:` (dia seguinte), `SUMMARY:<Nome · titulo>`, `URL:` da ficha; linhas com CRLF e dobradas em 75 bytes.

- [ ] **Step 1: Write the failing tests** no molde de `crm-cal-webhook.test.mjs` (importar `worker.js`, `fetch` falso com "banco" em memória, pessoas fictícias): `sem TAREFAS_ICS_TOKEN responde 500`; `token curto demais responde 500`; `token errado responde 404`; `sem t responde 404`; `POST responde 405`; `lista só dono ingryd, aberta e com prazo` (uma concluída, uma sem prazo e uma de `dono='ela'` ficam de fora); `a consulta ao banco leva a chave de serviço e limit=500`; `UID estável: duas chamadas dão o mesmo UID`; `DTEND é o dia seguinte e vira o mês (2026-11-30 → 20261201)`; `título com vírgula; ponto e vírgula; barra e quebra de linha sai escapado (\, \; \\ \n)`; `linha com mais de 75 bytes é dobrada com CRLF + espaço e nenhuma linha passa de 75 bytes`; `contato sem nome sai como "Sem nome · titulo"`; `erro do Supabase responde 502 sem expor detalhe`.
- [ ] **Step 2: Run** `node cms-oauth-worker/testes/crm-tarefas-ics.test.mjs`. Expected: FAIL (404 em tudo).
- [ ] **Step 3: Implement** `handleCrmTarefasIcs`: validar método e token primeiro; buscar `caso_acoes?select=id,titulo,prazo,atualizado_em,contato_id&dono=eq.ingryd&estado=neq.concluida&prazo=not.is.null&order=prazo.asc&limit=500` e os nomes dos contatos em `contatos?select=id,nome&id=in.(...)` (duas chamadas, sem join); montar o texto com `crmIcsTexto`/`crmIcsDobrar`; `Cache-Control: private, max-age=300`. O endereço da ficha vem de uma constante `CRM_URL` (achar o domínio do CRM já usado no Worker com `grep -n "admin/crm" worker.js`; se não houver, definir a constante no topo da seção). Comentário de cabeçalho da seção explicando que o token vai na URL porque o Google Calendar não envia cabeçalhos, e por isso o feed é segredo e só mostra títulos.
- [ ] **Step 4: Run** o teste e os demais testes do Worker (`for f in cms-oauth-worker/testes/*.test.mjs; do node $f; done`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(worker): feed .ics das tarefas do CRM`.

### Task 4: Tela "Tarefas" com mudar prazo e feita

**Files:**
- Modify: `admin/crm/index.html` (botão `data-view="tarefas"` na `nav`, após "Funil"; `<section data-panel="tarefas" hidden>` com cabeçalho, alternador "Por prazo | Por pessoa", filtro de situação da plataforma e contêiner `id="tarefas-lista"`)
- Modify: `admin/crm/crm.js` (`show()` ~6419 chama `renderTarefas()`; novas `carregaTarefas()`, `renderTarefas()`, `tarefaAcao(acao, id, extra)`)
- Modify: `admin/crm/crm.css` (grupos, linha de tarefa, atalhos; sem depender só de cor; 380 px)
- Modify: `admin/crm/ficha-html.js` (`htmlTarefaLinha(t, hoje, h)`, `htmlTarefasGrupos(grupos, hoje, h)`, `htmlTarefasPessoas(pessoas, hoje, h)`, devolvem string HTML com `h.esc`)
- Test: `admin/crm/db/testes/crm-tarefas-ui.test.mjs` (molde de `crm-caso-ui.test.mjs`: roda `crm.js` real em Node com Supabase falso)

**Interfaces:**
- Consumes: `agruparPorPrazo`, `agruparPorPessoa`, `atalhosDePrazo`, `hojeEmParis`, `situacaoPlataforma` (Task 2).
- Produces: `tarefaAcao('prazo', id, 'YYYY-MM-DD')` → `update caso_acoes set prazo`; `tarefaAcao('feita', id)` → `estado:'concluida'`, `concluida_em`, `concluida_por:'equipe'`; `tarefaAcao('reabrir', id)` → `estado:'aberta'`, `concluida_em:null`, `concluida_por:null`. Cada ação recarrega a lista e mostra `toast`; "feita" mostra um toast com botão "Desfazer" que dispara `reabrir`.

- [ ] **Step 1: Write the failing tests** (`check()`): `carregando mostra esqueleto antes dos dados`; `vazio mostra "Nenhuma tarefa aberta" e a dica de Adicionar`; `erro mostra mensagem e botão "Tentar de novo"`; `a consulta pede dono=ingryd, estado<>concluida` ; `por prazo desenha Atrasadas, Hoje, Esta semana, Depois, Sem prazo só quando há itens`; `por pessoa agrupa pelo nome`; `clicar em Amanhã grava prazo = hoje+1 (não prazo antigo+1)`; `escolher data grava a data digitada`; `Feita grava estado concluida com concluida_por equipe`; `Desfazer grava estado aberta com concluida_em null e concluida_por null`; `filtro "Atendida fora da plataforma" esconde quem tem user_id`; `atrasadas levam o texto "atrasada" além da cor`.
- [ ] **Step 2: Run** `node crm-tarefas-ui.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** a tela. Consulta única: `caso_acoes` (`dono=ingryd`, `estado<>concluida`, ordenada por prazo, limite 1000) mais nomes e `user_id`/`situacao_plataforma` vindos do `C` já carregado em memória (não buscar de novo). Cada linha: título, nome da pessoa (link para a ficha), prazo, atalhos `Hoje` `Amanhã` `+1 semana` `Escolher data` (`<input type="date">`) e botão `Feita`. O erro do banco passa por `casoFalha`. Mensagem "Falta rodar db/crm-tarefas.sql" quando o erro citar a coluna nova.
- [ ] **Step 4: Run** o teste da tela e `node crm-caso-ui.test.mjs` (regressão). Expected: PASS.
- [ ] **Step 5: Commit** `feat(crm): tela Tarefas por prazo e por pessoa`.

### Task 5: Tarefas com prazo na ficha

**Files:**
- Modify: `admin/crm/crm.js` (`fxAddAcao` ~3792 aceita prazo; `fxEuCorpo` ~4362 e `casoAcoesHtml` ~2146 mostram os mesmos atalhos para `dono='ingryd'`)
- Modify: `admin/crm/ficha-html.js` (`htmlPopupAdd` ~139 ganha `<input type="date" id="fx-add-prazo">`, opcional)
- Modify: `admin/crm/ficha.js` (`tarefasDe` ~133: `prazoTxt` vem do prazo da tarefa)
- Test: `admin/crm/db/testes/crm-tarefas-ficha.test.mjs`

**Interfaces:**
- Consumes: `tarefaAcao` (Task 4), `atalhosDePrazo`, `hojeEmParis`.
- Produces: `fxAddAcao` grava `prazo` (ou `null`); a aba "Só eu" e o carrossel de "Minhas próximas ações" usam os mesmos botões de prazo e `Feita` da tela.

- [ ] **Step 1: Write the failing tests**: `Adicionar com data grava prazo`; `Adicionar sem data grava prazo null`; `a aba Só eu mostra os atalhos de prazo para tarefa ingryd`; `tarefa de dono ela não mostra atalhos de prazo`; `trocar o prazo na ficha atualiza a tela Tarefas (mesmo state)`; `o cartão do carrossel mostra "Prazo: ..." quando há prazo`.
- [ ] **Step 2: Run** `node crm-tarefas-ficha.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** reaproveitando `tarefaAcao` e as funções de HTML da Task 4, sem duplicar a lógica de datas; depois da ação, chamar `casoRecarrega()` e `renderTarefas()` se a tela estiver aberta.
- [ ] **Step 4: Run** os testes da ficha, `crm-caso-ui.test.mjs` e `crm-tarefas-ui.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(crm): prazo e ações rápidas nas tarefas da ficha`.

### Task 6: "Aceitou a plataforma" na ficha e na lista

**Files:**
- Modify: `admin/crm/crm.js` (cabeçalho da ficha ~3812 ganha o bloco; `renderContacts` ganha filtro; gravação em `contatos.situacao_plataforma`)
- Modify: `admin/crm/index.html` (filtro na seção Contatos)
- Modify: `admin/crm/ficha-html.js` (`htmlSituacaoPlataforma(c, h)`)
- Test: `admin/crm/db/testes/crm-tarefas-situacao.test.mjs`

**Interfaces:**
- Consumes: `situacaoPlataforma` (Task 2); coluna da Task 1 (já presente em `crm_contatos`, lida pelo `select('*')` existente).
- Produces: bloco "Aceitou a plataforma?" com o rótulo atual e, só quando a pessoa não tem conta, dois botões ("Ainda não", "Atendida fora da plataforma") que gravam `contatos.situacao_plataforma`; filtro na lista com as três opções mais "Todas".

- [ ] **Step 1: Write the failing tests**: `pessoa com conta mostra "Já aceitou" e sem botões`; `pessoa com conta e valor gravado ainda_nao mostra "Já aceitou"`; `pessoa sem conta mostra os dois botões`; `clicar em "Atendida fora da plataforma" faz update em contatos com esse valor`; `o filtro "Atendida fora da plataforma" lista só essas pessoas`; `erro de gravação mostra o motivo e não troca o rótulo`; `antes de rodar o SQL (coluna ausente) o bloco mostra "Ainda não" sem quebrar a ficha`.
- [ ] **Step 2: Run** `node crm-tarefas-situacao.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** o bloco, o filtro e a gravação (atualizar `C` em memória depois do update, como o resto de `crm.js` faz após `contatos.update`).
- [ ] **Step 4: Run** todos os testes novos, `node crm-caso-ui.test.mjs` e `node crm-fase2.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(crm): bloco e filtro "aceitou a plataforma"`.

### Task 7: Documentação e roteiro de entrada em produção

**Files:**
- Modify: `docs/DECISOES.md` se existir no website, senão `admin/crm/PLANO.md` (decisão: tarefas em `caso_acoes`, feed `.ics` em vez de API do Google, token na URL e por quê, escopo `dono='ingryd'` de qualquer canal)
- Modify: `admin/crm/db/testes/package.json` (agregar os scripts novos ao `test` principal se houver um agregador)

- [ ] **Step 1:** Rodar todos os testes novos e os do Worker; Expected: tudo PASS.
- [ ] **Step 2:** Escrever a decisão (contexto, decisão, alternativas descartadas B e C, consequência: feed atualiza a cada 12 a 24 h).
- [ ] **Step 3:** Escrever na descrição do PR a ordem de entrada, para a Ingryd executar: (1) rodar `crm-tarefas.sql` no Supabase de teste e conferir `auditoria-isolamento.sql` e `conferir-banco.sql` vazios; (2) mesmo no de produção; (3) criar o secret `TAREFAS_ICS_TOKEN` (32+ caracteres aleatórios) no Cloudflare; (4) publicar; (5) no Google Calendar da ingrydigitalmanagement, "Outras agendas → Por URL" com `https://<domínio do Worker>/api/crm/tarefas.ics?t=<token>`.
- [ ] **Step 4: Commit** `docs(crm): decisão e roteiro das tarefas`.

---

## Self-review

- **Spec:** objetivos 1 e 4 → Tasks 4 e 5; 2 → Task 4; 3 → Task 5; 5 → Tasks 1, 2 e 6; 6 → Task 3; restrições de isolamento e rollout → Tasks 1 e 7.
- **Chamada minha, para a Ingryd conferir:** tela e feed incluem toda tarefa `dono='ingryd'` aberta, de qualquer canal (as de "Reunião" também), não só as "Só eu".
- **Tipos:** `Tarefa`, `tarefaAcao`, `situacaoPlataforma`, `atalhosDePrazo` e `hojeEmParis` têm a mesma assinatura em todas as tasks que os usam.
