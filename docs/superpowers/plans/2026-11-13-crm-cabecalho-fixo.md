# CRM: fila minimalista e cabeçalho fixo — plano de implementação

> **Para quem executa:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Passos com `- [ ]`.

**Goal:** trocar a Fila de hoje por uma linha de chips e o cabeçalho da pessoa por um cabeçalho fixo com cartões diferentes para lead, assinante e quem está na plataforma sem assinar.

**Architecture:** lógica pura em módulos novos/existentes sem DOM (`ficha-uso.js` novo; `ficha.js` ganha `tipoCabecalho` e `cartoesDe`), HTML puro em `ficha-html.js`, ligação aos dados em `crm.js` (`fxHeaderHtml`, `fxFilaItens`). Nenhum SQL, Worker ou dependência nova.

**Tech Stack:** JS em módulos nativos, CSS vanilla (`crm.css`), testes em Node (`admin/crm/db/testes/*.test.mjs`, padrão `check(label, cond)`).

**Spec:** `docs/superpowers/specs/2026-11-13-crm-cabecalho-fixo-design.md`

## Global Constraints
- Só leitura de tabelas que o admin já lê; nada de tabela, função ou política nova.
- Sem build, sem framework, sem dependência nova. Funções puras fora do DOM.
- Todo texto vindo do banco passa por `h.esc` no HTML.
- Sem dado = "—" mais o motivo; nunca 0 inventado. Duração sempre rotulada "estimada". Uso rotulado "últimos 300 cliques".
- Janela de uso 30 dias; médias só com ≥ 3 sessões; duração só com sessões de ≥ 2 cliques.
- Funciona em 380 px sem rolagem de lado; foco visível; cache-bust `?v=` novo em `crm.js`, `index.html`, `ficha-html.js` (hoje `2026-11-13.5`).
- Sem nota 0–100, sem valor/ticket/LTV/RFM.

## Review Focus
1. Cliques sem `sessao` (nulo ou vazio): contados à parte, não viram uma "sessão gigante" (Task 1).
2. Assinatura `canceled`/`unpaid`/`incomplete` ou `past_due`: não aparece como "Assinatura ativa" (Task 2).
3. Nome ou texto com HTML (`<img onerror>`): sai escapado em fila e cabeçalho (Tasks 3 e 4).
4. Datas de clique inválidas ou no futuro: ignoradas, sem `NaN` na tela (Task 1).
5. Checklist ainda carregando, com erro ou sem conta: cartão mostra "—" e o motivo (Task 2).

---

### Task 1: Cálculo de uso da plataforma

**Files:**
- Create: `admin/crm/ficha-uso.js`
- Test: `admin/crm/db/testes/ficha-uso.test.mjs`

**Interfaces:**
- Produces: `calcularUso(cliques, agora)` com `cliques: { sessao: string|null, criado_em: string }[]`, `agora: number` (ms) → `{ sessoes: number, semSessao: number, cliquesPorSessao: number|null, duracaoSeg: number|null, ultimaEm: string|null, diasDesdeUltima: number|null, suficiente: boolean }`. `suficiente = sessoes >= 3`. Constante exportada `JANELA_DIAS = 30`.

- [ ] **Step 1: Testes (falham)** em `ficha-uso.test.mjs`, mesmo esqueleto de `ficha.test.mjs`. Asserções: (a) lista vazia → `sessoes 0`, médias `null`, `ultimaEm null`; (b) 3 sessões com 4, 6 e 8 cliques → `cliquesPorSessao === 6`, `suficiente`; (c) sessão de 2 cliques com 120 s entre o 1º e o último e outra de 3 cliques com 240 s → `duracaoSeg === 180`; sessão de 1 clique não entra na duração; (d) cliques sem `sessao` (`null` e `''`) somam em `semSessao`, não em `sessoes`; (e) cliques com `criado_em` inválido (`'xx'`) ou depois de `agora` são ignorados sem `NaN`; (f) cliques com mais de 30 dias ficam fora de `sessoes`, mas `ultimaEm` considera o clique mais recente de todos; (g) 2 sessões → `suficiente === false` e `cliquesPorSessao === null`.
- [ ] **Step 2:** `cd admin/crm/db/testes && node ficha-uso.test.mjs` → falha ("calcularUso is not a function" ou import).
- [ ] **Step 3: Implementar `calcularUso` em `ficha-uso.js`.** Agrupa por `sessao` dentro da janela; duração = média de (último − primeiro) só das sessões com ≥ 2 cliques; `diasDesdeUltima = floor((agora − ultima)/864e5)`.
- [ ] **Step 4:** rodar o teste → todos passam.
- [ ] **Step 5: Commit** `feat(crm): cálculo de uso da plataforma (sessões, cliques por sessão, duração estimada)`.

### Task 2: Tipo do cabeçalho e cartões

**Files:**
- Modify: `admin/crm/ficha.js` (acrescentar exports ao fim)
- Test: `admin/crm/db/testes/ficha.test.mjs` (novo bloco "cabeçalho fixo")

**Interfaces:**
- Consumes: `calcularUso` (resultado já calculado, vem em `d.uso`).
- Produces:
  - `tipoCabecalho(c, assin): 'assinante' | 'plataforma' | 'lead'`. `assinante` se `assin` e `assin.status ∈ {active, trialing}`; `plataforma` se não e `c.user_id`; senão `lead`. (Escolha minha: `past_due`/`canceled`/`unpaid` caem em `plataforma`/`lead`, com a etiqueta de pagamento mostrando o status real em `etiquetaPagamento`.)
  - `etiquetaPagamento(assin): { texto: string, tom: 'ok'|'aviso'|'neutro' }` ("Assinatura ativa", "Em teste", "Pagamento em atraso", "Cancelada", "Não assina").
  - `cartoesDe(tipo, d): { blocos: { titulo: string|null, cartoes: { rotulo: string, valor: string, sub: string, tom?: 'alerta'|'ok' }[] }[], nota: string|null }` com `d = { c, assin, uso, mailsTotal, mailsAbertos, mailsClicados, entradas, diasNaBase, respostas, respostasNovas, proximo: { titulo: string, quando: string }, chk: { feitos, total, vencem3, atrasados } | null, chkMsg: string, agora: number }`.
- Cartões (valores do spec): **lead** = Estágio, Parada há (`c.dias_sem_sinal`; `tom: 'alerta'` a partir de 5 dias), E-mails (`abriu X de Y`), Entradas (`N funis`, `na base há N dias`), Respostas (`respostas`, sub = novas esperando você), Próximo e-mail (`proximo.titulo` curto). **assinante** = bloco "Pagamento" (Plano, Próxima cobrança/fim do teste/acesso até como em `assinaturaHtml`, Assinante desde com `assin.criado_em`) + bloco "Uso da plataforma · últimos 30 dias" (Sessões com `última há N dias`, Cliques por sessão, Duração (estimada), Checklist com prazos) + `nota` "Baseado nos 300 cliques mais recentes. Valor mensal, ticket e LTV ficam para uma segunda etapa." **plataforma** = Estágio, Sessões, Cliques por sessão, Duração (estimada), Checklist, Respostas.

- [ ] **Step 1: Testes (falham).** `tipoCabecalho`: `active` → `assinante`; `trialing` → `assinante`; `canceled` com `user_id` → `plataforma`; `past_due` sem `user_id` → `lead`; sem `assin` e com `user_id` → `plataforma`; sem nada → `lead`. `etiquetaPagamento(null).texto === 'Não assina'`; `past_due` → tom `aviso`. `cartoesDe('lead', …)`: `dias_sem_sinal: 6` → cartão "Parada há" com valor `6 dias` e `tom 'alerta'`; `dias_sem_sinal: 2` → sem tom. `cartoesDe('plataforma', …)` com `uso.suficiente === false` → valor de "Cliques por sessão" é `—` e o sub contém `poucos dados`; com `chk: null` e `chkMsg: 'Ela ainda não entrou no app'` → Checklist `—` e o sub é a mensagem. `cartoesDe('assinante', …)` tem 2 blocos, o primeiro "Pagamento" com 3 cartões, e `nota` não nula.
- [ ] **Step 2:** `node ficha.test.mjs` → falha nos novos testes.
- [ ] **Step 3: Implementar** as três funções em `ficha.js`, seguindo o estilo (funções puras, `const`). Plural correto ("1 dia", "2 dias").
- [ ] **Step 4:** rodar `node ficha.test.mjs` → passa (os antigos continuam passando).
- [ ] **Step 5: Commit** `feat(crm): tipo e cartões do cabeçalho fixo (lead, assinante, plataforma)`.

### Task 3: HTML da fila minimalista

**Files:**
- Modify: `admin/crm/ficha-html.js` (`htmlFila`), `admin/crm/crm.css`
- Test: `admin/crm/db/testes/ficha-html.test.mjs`

**Interfaces:**
- Produces: `htmlFila(itens, selId, h)` mantém a assinatura atual (`itens: { c, novas, proxima?, sub? }[]`) e o `data-fx="pessoa" data-id`, `aria-pressed`; agora renderiza uma linha: rótulo "Fila de hoje" + um `<button class="mf-i">` por pessoa com `<span class="mf-d {alta|media|baixa}">`, o nome e `N nova(s)`. `proxima` e `sub` deixam de aparecer. Fila vazia: texto curto "Ninguém na fila hoje." na mesma linha.

- [ ] **Step 1: Atualizar os testes de fila** (os de "Task 8" em `ficha-html.test.mjs`): mantém aria-pressed (1 true, 1 false), `2 novas`/`1 nova`, `data-fx="pessoa"`, HTML do nome escapado, fila vazia com "Ninguém"; troca a asserção de `Responder Ana` por `!f.includes('Responder Ana')` (o texto da próxima ação não aparece mais) e acrescenta que a bolinha leva a classe da urgência (`mf-d alta`).
- [ ] **Step 2:** `node ficha-html.test.mjs` → falha.
- [ ] **Step 3: Reescrever `htmlFila`** e acrescentar em `crm.css` as classes `.mf`, `.mf-t`, `.mf-i`, `.mf-i.atual`, `.mf-d(.alta/.media)`, `.mf-n` (valores do desenho: altura 30 px, `overflow-x:auto`, sem quebra de linha) e remover as regras `.fx-fcard*` que ficarem sem uso.
- [ ] **Step 4:** rodar → passa.
- [ ] **Step 5: Commit** `feat(crm): fila de hoje em uma linha de chips`.

### Task 4: HTML do cabeçalho fixo

**Files:**
- Modify: `admin/crm/ficha-html.js` (nova `htmlCabecalho`; `htmlHeader` removida ao fim da Task 5), `admin/crm/crm.css`
- Test: `admin/crm/db/testes/ficha-html.test.mjs`

**Interfaces:**
- Consumes: `cartoesDe` / `etiquetaPagamento` (Task 2) já aplicadas pelo `crm.js`.
- Produces: `htmlCabecalho(d, h)`, `d = { c, estagioLabel, personaLabel, etiqueta: { texto, tom }, blocos, nota }` → `<header class="hd">` com iniciais, nome, persona, estágio, etiqueta de pagamento, botões `data-emailfor`, `data-open1a1` e o `<select id="stage-pick">` (estágio) como no `htmlHeader` atual, seguidos dos blocos de cartões (`.hd-k` > `.k`), blocos com `titulo` ganham `<span class="tag">`, e `nota` em `<p class="est">`.

- [ ] **Step 1: Testes (falham):** nome com `<img src=x onerror=alert(1)>` sai escapado e não há `<img` no HTML; iniciais corretas ("Ana Souza" → `AS`; nome vazio usa a 1ª letra do e-mail; nada lança); mantém `data-emailfor="c1"`, `data-open1a1="c1"`, `id="stage-pick"`; cartão com `tom: 'alerta'` leva a classe `alerta`; bloco com título mostra o título; `nota` aparece só quando existe; rótulo e valor de cada cartão escapados.
- [ ] **Step 2:** `node ficha-html.test.mjs` → falha.
- [ ] **Step 3: Implementar `htmlCabecalho`** e o CSS (`.hd` com `position: sticky; top: 8px`, sombra leve; `.hd-k` grade `repeat(auto-fit, minmax(150px, 1fr))`; `.k`, `.k.alerta`, `.k.ok`, `.tag`, `.est`); em < 760 px, 2 colunas e `.tag`/`.est` menores.
- [ ] **Step 4:** rodar → passa.
- [ ] **Step 5: Commit** `feat(crm): cabeçalho fixo com cartões por tipo de pessoa`.

### Task 5: Ligar aos dados no crm.js e subir a página

**Files:**
- Modify: `admin/crm/crm.js` (`fxHeaderHtml`, `fxFilaItens` sem `proxima`/`sub` desnecessários, `select` de `assinaturas` ganha `criado_em`, import de `ficha-uso.js`, `renderFichaV2` sem o bloco antigo do cabeçalho se necessário), `admin/crm/ficha-html.js` (remover `htmlHeader`), `admin/crm/index.html`, `admin/crm/PLANO.md`
- Test: `admin/crm/db/testes/crm-ficha-ui.test.mjs`

**Interfaces:**
- Consumes: `calcularUso`, `tipoCabecalho`, `etiquetaPagamento`, `cartoesDe`, `FH.htmlCabecalho`, `FH.htmlFila`.
- Produces: `fxHeaderHtml(c, d)` monta `d` do `cartoesDe` com: `uso = calcularUso(state.int.cliques || [], Date.now())`; `mailsTotal/mailsAbertos/mailsClicados` de `d.mails` (aberto = `aberto_em` ou status `aberto`/`clicado`); `entradas`/`diasNaBase` de `d.jor` e `c.criado_em`; `respostas`/`respostasNovas` de `d.resps`; `proximo` de `proximoEmail(...)`; `chk` de `chkCalc` (feitos, total sem arquivados, `vencem3`, `atrasados`), ou `null` com `chkMsg` como hoje.

- [ ] **Step 1: Atualizar/estender `crm-ficha-ui.test.mjs`** com 3 pessoas do harness (`pessoa()` de `ficha-harness.mjs`): lead sem conta → o HTML tem "Parada há" e não tem "Cliques por sessão"; com `user_id` e `respostas.assinaturas: { data: { status: 'active', plano: 'Intermediário', criado_em: <iso> } }` → tem "Pagamento", "Sessões" e "Assinatura ativa"; com `user_id` sem assinatura → "Não assina" e "Sessões". Fila: a página tem `class="mf-i` e não tem `fx-fcard`. O teste "Ficha: painéis existentes" continua passando.
- [ ] **Step 2:** `node crm-ficha-ui.test.mjs` → falha.
- [ ] **Step 3: Implementar a ligação** descrita acima; remover `htmlHeader` e as regras `.fx-head`, `.fx-h-*` sem uso; garantir que "Avanço do projeto dela" (barra) continue em algum lugar (cartão Checklist com sub `N% feito`).
- [ ] **Step 4:** rodar `crm-ficha-ui`, `ficha-html`, `ficha`, `ficha-uso`, `crm-proximo-email-ui`, `crm-taxonomia-ui`, `crm-plataforma-abas-ui`, `crm-chat-ui` → todos passam.
- [ ] **Step 5: Conferir no navegador (Playwright + harness, como nas rodadas anteriores):** gerar as 3 fichas e tirar imagens em 1440, 1000 e 380 px; verificar sem rolagem de lado, cabeçalho fixo ao rolar, ordem das colunas. Anexar as imagens na resposta à Ingryd.
- [ ] **Step 6:** subir `?v=` para `2026-11-13.6` nos três arquivos, acrescentar um parágrafo em `PLANO.md` (o que mudou, o que ficou para depois), commit `feat(crm): fila minimalista e cabeçalho fixo na ficha` e `git push`.

## Auto-revisão
- Cobertura do spec: fila (T3), cabeçalho por tipo (T2/T4/T5), cálculo de uso (T1), rótulos honestos e "—" (T2), não-metas respeitadas (nenhuma tarefa toca Worker/SQL), teste visual (T5).
- Consistência: `calcularUso` → `d.uso` → `cartoesDe` → `htmlCabecalho`; nomes iguais em todas as tarefas.
- Fora desta entrega: freebie 2, valor/LTV, função no banco, relatório por turma.
