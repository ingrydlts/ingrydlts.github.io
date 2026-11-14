# CRM "Y envios previstos" e página de saúde (I06) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A linha "Hoje" do editor mostra quantos envios estão previstos (Y), e a página de saúde (I06, 4 portas × 5 pontos) existe no CRM, no banco e no Worker.

**Architecture:** Uma função SQL auxiliar concentra a consulta de quem recebe cada modelo; o Worker e o editor a usam. A página I06 é dado (`PAGINAS`) mais uma lista `portas` em `para_quem`, um filtro no banco e variáveis novas no Worker. Nada de tabela nova.

**Tech Stack:** SQL (Postgres, testado em PGlite), JS puro em módulos ES, Cloudflare Worker (`cms-oauth-worker/worker.js`), testes `node` com `check()`.

**Spec:** `docs/superpowers/specs/2026-11-14-crm-previstos-e-saude-design.md`

## Global Constraints

- Sem dependência nova, sem build. O banco é compartilhado com o app: protocolo de isolamento (função `security definer` com `set search_path`, `revoke … from public` e `from anon`).
- `crm_sequencia_pendentes` precisa continuar devolvendo exatamente o que devolve hoje; os testes `crm-sequencia-minutos`, `crm-filtro-etapa` e `crm-estudio-emails-3` seguem verdes sem mudar.
- Texto da tela em português, sem travessão. Todo texto de dados passa por `esc()` antes de entrar em HTML.
- `taxonomia.js` e `editor-quem.js` continuam puros (sem DOM, sem `import`).
- Caminhos relativos a `ingrydlts.github.io/` (site) e `POR-DENTRO-APP/` (app). Testes PGlite: `cd admin/crm/db/testes && APP_DB_DIR=/home/user/POR-DENTRO-APP/db node <arquivo>`.
- SQL novo é idempotente, com cabeçalho no estilo dos arquivos vizinhos (o que muda, segurança, como desfazer) e nunca roda no Supabase real daqui.

## Review Focus

- Y de um modelo com Envio desligado não conta quem já passou da hora (ligar recomeça a contagem).
- Y de um modelo manual (sem gatilho), de uma chave que não existe e chamado por quem não é admin: sem número, sem vazar dado.
- `crm_sequencia_pendentes` com a consulta movida para o helper devolve o mesmo que antes, inclusive a janela de 2 dias e o consentimento.
- Cadastro com `porta` inválida (texto livre, vazio, maiúscula) não derruba o cadastro e não grava lixo.
- Lead antigo (sem porta nem ponto): todas as variáveis novas existem e são falsas ou vazias; astúcia some depois de 14/02/2027.

---

### Task 1: A estimativa no navegador exclui quem não marcou etapa

**Files:**
- Modify: `admin/crm/editor-quem.js` (`motivoFora`), `admin/crm/crm.js` (texto do popover de etapa)
- Test: `admin/crm/db/testes/crm-editor-quem.test.mjs`

**Interfaces:**
- Produces: `motivoFora(c, m, origensDe)` devolve `'etapa'` quando `m.para_quem.etapas` tem valor e `c.respostas.objetivo` não está nele **ou** está vazio; `textoPrevistos(y: number | null | undefined): string` (exportada) devolve `''` se `y` não é número, senão `"1 envio previsto hoje"` ou `"<y> envios previstos hoje"`.

- [ ] **Step 1: Write the failing test** (trocar a linha antiga `etapa ap-x: quem não respondeu entra…` e acrescentar)

```js
check('etapa ap-x: quem não marcou etapa fica de fora (como o banco)', estimar(C, { para_quem: { etapas: ['ap-x'] } }, org).n === 1);
check('etapa: motivo para quem não marcou', motivoFora(C[1], { para_quem: { etapas: ['ap-x'] } }, org) === 'etapa');
check('sem regra de etapa, quem não marcou entra', motivoFora(C[1], { para_quem: {} }, org) === null);
check('textoPrevistos', textoPrevistos(7) === '7 envios previstos hoje' && textoPrevistos(1) === '1 envio previsto hoje' && textoPrevistos(0) === '0 envios previstos hoje' && textoPrevistos(null) === '' && textoPrevistos(undefined) === '' && textoPrevistos('x') === '');
```
(importar `textoPrevistos` junto dos outros)

- [ ] **Step 2: Run** `node crm-editor-quem.test.mjs`. Expected: FALHA em "quem não marcou etapa fica de fora" e erro de import de `textoPrevistos`.
- [ ] **Step 3: Implement** em `editor-quem.js`: a regra da etapa vira `if (lista(p.etapas).length && !(et && p.etapas.indexOf(et) >= 0)) return 'etapa';` e `textoPrevistos`. Em `crm.js`, o texto do popover de etapa passa a "Nenhuma marcada = qualquer resposta. Com etapa marcada, só recebe quem marcou uma delas no guia." (e o mesmo em `paraQuemHtml`, na dica de "Etapa do guia").
- [ ] **Step 4: Run** `node crm-editor-quem.test.mjs && node funil.test.mjs && node crm-estudio-blocos.test.mjs`. Expected: sem `FALHA`.
- [ ] **Step 5: Commit** `fix(crm): a estimativa exclui quem não marcou etapa, como o banco`

### Task 2: SQL do Y (`crm-sequencia-previsao.sql`) e seu teste

**Files:**
- Create: `admin/crm/db/crm-sequencia-previsao.sql`, `admin/crm/db/testes/crm-sequencia-previsao.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (script `test:previsao`)

**Interfaces:**
- Produces (SQL):
  - `crm_sequencia_candidatos(p_chave text, p_agora timestamptz, p_ate timestamptz, p_previa boolean) returns table (contato_id uuid, email text, nome text, chave text, versao int, tipo text, aceita_novidades boolean, devido_em timestamptz, dados jsonb)` — `security definer`, `set search_path = public, pg_temp`, sem EXECUTE para public, anon, authenticated nem service_role. É o corpo de `crm_sequencia_pendentes` de `crm-sequencia-minutos.sql`, com: modelo sem exigir versão `no_ar` (`left join`); `p_chave` filtra um modelo (nulo = todos); `envio_ligado` só é exigido quando `not p_previa`; teto `devido_em <= p_ate`; piso `greatest(p_agora - interval '2 days', case when p_previa then coalesce(m.envio_ligado_em, p_agora) else m.envio_ligado_em end)`.
  - `crm_sequencia_pendentes(p_limite int default 12, p_agora timestamptz default now())` — mesma assinatura e colunas de hoje; vira `select … from crm_sequencia_candidatos(null, p_agora, p_agora, false) where versao is not null order by devido_em, contato_id limit greatest(1, least(coalesce(p_limite, 12), 100))`. Continua só para `service_role`.
  - `crm_sequencia_previstos(p_chave text, p_agora timestamptz default now()) returns int` — `plpgsql stable security definer`, `set search_path`. Lança `sem_permissao` se `not public.eh_admin()`. Devolve `null` se o modelo não existe, não foi criado no estúdio, está excluído ou não tem `envio_gatilho`. Senão conta `crm_sequencia_candidatos(p_chave, p_agora, <23:59:59.999999 de hoje em America/Sao_Paulo>, true)`. `revoke … from public, anon`; `grant execute … to authenticated`.

- [ ] **Step 1: Write the failing test** `crm-sequencia-previsao.test.mjs`, no molde de `crm-sequencia-minutos.test.mjs` (mesmo setup do PGlite e mesma ordem de arquivos, incluindo `crm-sequencia-minutos.sql`, `crm-modelo-tecnologo-recap.sql` via `gerar()` e depois o arquivo novo). Checks, com pessoas fictícias e `T = Date.now() - 5h`:
  1. Antes de aplicar o SQL novo, guardar `pendentes(min(T, 51))` e `pendentes(min(T, 130))` num cenário com Ana, Bia, Caio, Duda, Eva como no teste de minutos, Envio ligado; depois de aplicar, os dois resultados são **idênticos** (`JSON.stringify` igual).
  2. Roda duas vezes sem erro; funções com `prosecdef`, `search_path` fixo; `anon` e `authenticated` não executam `crm_sequencia_candidatos`; `service_role` também não; `service_role` executa `crm_sequencia_pendentes`; `authenticated` executa `crm_sequencia_previstos` e `anon` não.
  3. Como admin (linha em `admins`, `request.jwt.claim.sub` setado): modelo com Envio ligado, 30 min depois de pegar `guia-tecnologo`, `p_agora = min(T, 31)`: Y = 1 (só a Ana, devida; Bia vence aos 50 min, ainda hoje, então com `p_agora` perto do fim do dia ela entra: usar `p_agora` fixo às 10:00 de Brasília para o cenário de "hoje" e conferir Y = nº de pessoas devidas entre agora e 23:59).
  4. Quem já recebeu o modelo não conta; quem não aceitou novidades não conta em modelo `novidades`; quem pegou outro guia não conta.
  5. Envio **desligado**: Y só conta quem ainda vai ficar devido depois de agora (quem já passou da hora, como o Caio, não conta).
  6. Modelo manual (sem `envio_gatilho`): `null`. Chave inexistente: `null`. Como `authenticated` não admin: erro com `sem_permissao`. Como `anon`: erro de permissão.
  7. Evidência da correção da Task 1: modelo com `para_quem.etapas = ['tec-escrevi']` — contato com `respostas.objetivo = 'tec-escrevi'` entra no Y, contato sem `objetivo` **não** entra.
- [ ] **Step 2: Run** `node crm-sequencia-previsao.test.mjs`. Expected: falha (arquivo SQL não existe / função não existe).
- [ ] **Step 3: Implement** o SQL com cabeçalho no estilo dos vizinhos: o que muda, segurança, como desfazer (`rode de novo crm-sequencia-minutos.sql` devolve a função antiga; `drop function … crm_sequencia_previstos, crm_sequencia_candidatos`). Ordem de execução: depois de `crm-sequencia-minutos.sql`.
- [ ] **Step 4: Run** o novo teste, depois `crm-sequencia-minutos`, `crm-filtro-etapa`, `crm-estudio-emails-3`, `crm-modelos-prontos`. Expected: 0 falhas em todos.
- [ ] **Step 5: Commit** `feat(crm): Y de envios previstos no banco, com a consulta do Worker num helper só`

### Task 3: As funções novas entram na lista do banco (repositório do app)

**Files:**
- Modify: `POR-DENTRO-APP/db/conferir-banco.sql`
- Test: `POR-DENTRO-APP/db/testes/conferir-banco.test.mjs`, `ingrydlts.github.io/admin/crm/db/testes/conferir-banco.test.mjs`

- [ ] **Step 1: Run** `cd admin/crm/db/testes && APP_DB_DIR=/home/user/POR-DENTRO-APP/db node conferir-banco.test.mjs`. Expected: falha dizendo que `crm_sequencia_candidatos` e `crm_sequencia_previstos` não estão na lista (o teste do site lê os SQL do site).
- [ ] **Step 2: Implement** duas linhas em `conferir-banco.sql` do app, depois da de `crm_sequencia_pendentes`: `('função', 'crm_sequencia_candidatos', 'admin/crm/db/ (site) crm-sequencia-previsao.sql')` e `('função', 'crm_sequencia_previstos', 'admin/crm/db/ (site) crm-sequencia-previsao.sql')`.
- [ ] **Step 3: Run** o teste do site e o do app (`cd POR-DENTRO-APP/db/testes && node conferir-banco.test.mjs`) e o sentinela `node isolamento.test.mjs`. Expected: tudo verde (se o teste do site já falhava antes por outro motivo, ledgar).
- [ ] **Step 4: Commit** nos dois repositórios, na branch `claude/elegant-goodall-36wfof`: `chore(db): funções do Y entram na conferência do banco` (app) e incluir o teste no commit do site se mudar.

### Task 4: A linha "Hoje" mostra o Y

**Files:**
- Modify: `admin/crm/crm.js` (`ST`, `passoQuem`, `renderEditor`, `salvarModelo`)
- Test: `admin/crm/db/testes/crm-editor-quem.test.mjs`

**Interfaces:**
- Consumes: `textoPrevistos` (Task 1); RPC `crm_sequencia_previstos` (Task 2).
- Produces: `ST.prev`, objeto `{ [chave]: número | null | false | 'carregando' }` (`undefined` = ainda não pedido, `null` = modelo manual, `false` = erro, que some da tela); `salvarModelo` apaga `ST.prev[chave]` depois de salvar (o próximo `renderEditor` pede de novo).

- [ ] **Step 1: Write the failing test** (fonte + smoke do HTML): `crm.js` contém `crm_sequencia_previstos` e `EQ.textoPrevistos(`; o HTML de `passoQuem` com `ST.prev = { k: 3 }` contém "3 envios previstos hoje"; com `ST.prev = { k: false }` e com `ST.prev = {}` **não** contém "previstos"; o texto "elegíveis de" continua lá nos três casos. O smoke executa `passoQuem` extraída do fonte com stubs, como o `/tmp/smoke.mjs` da entrega anterior, agora dentro do próprio arquivo de teste.
- [ ] **Step 2: Run** `node crm-editor-quem.test.mjs`. Expected: FALHA nos checks novos.
- [ ] **Step 3: Implement**: em `passoQuem` (ramo `novoM`) a linha "Hoje" acrescenta `' · ' + <b>texto</b>` quando `typeof ST.prev[m.chave] === 'number'` e, abaixo, a nota "Y conta quem já acionou o gatilho e ainda não recebeu." Em `renderEditor`, quando o passo é "quem", o modelo é `criado_no_estudio` com `envio_gatilho` e `ST.prev[chave] === undefined`: marcar `'carregando'`, chamar `supabase.rpc('crm_sequencia_previstos', { p_chave: chave })` e, ao voltar, gravar o número (ou `false` se houve erro) e chamar `renderEditor()` se ainda for o mesmo modelo e passo. `salvarModelo` faz `delete ST.prev[m.chave]` antes de re-renderizar. Subir a versão de cache para `2026-11-14.2` em `crm.js`, `editor-email.js`, `ficha.js`, `index.html` (o teste de versão passa a esperar esse valor).
- [ ] **Step 4: Run** a suíte do site (lista da Task 1 + `crm-plataforma-abas-ui`, `crm-proximo-email-ui`) e `node --check crm.js`. Expected: sem `FALHA`.
- [ ] **Step 5: Commit** `feat(crm): Hoje mostra os envios previstos`

### Task 5: A página I06 e as portas no catálogo e na cascata

**Files:**
- Modify: `admin/crm/taxonomia.js` (`PAGINAS`), `admin/crm/estudio.js` (`ETAPAS_FILTRO`), `admin/crm/editor-quem.js`, `admin/crm/crm.js` (ORIG, popover, frase)
- Test: `admin/crm/db/testes/crm-editor-quem.test.mjs`

**Interfaces:**
- Produces: item de `PAGINAS` `{ k: 'I06', nome: 'Saúde 1 · como o sistema funciona', rota: '/guias/saude-1/', material: 'guia-saude-1', personas: [], portas: [['estudante','Estudante'],['trabalho','Trabalho com contrato'],['aupair','Au pair'],['outro','Outro ou não sei']], etapas: [['sau-nao-cheguei','Ainda não cheguei'],['sau-sem-numero','Já cheguei, ainda sem número'],['sau-esperando','Pedi e estou esperando'],['sau-sem-vitale','Tenho o número e não a carte vitale'],['sau-completo','Já tenho a carte vitale']] }`. As outras páginas ganham `portas: []`.
- `ES.ETAPAS_FILTRO` ganha as 5 etapas `sau-*` com rótulo `'Saúde: ' + rótulo`.
- `motivoFora` devolve `'porta'` quando `p.portas` tem valor e `c.respostas.porta` não está nele (ou está vazia). `aplicarPagina` também limpa `portas` (`limpou` ganha `'porta'`, antes de `'persona'`: ordem `etapa, porta, persona`). `fraseCascata` devolve `portas: string | null` (`null` se a página não tem portas; `'qualquer porta'` ou as marcadas por `rot.porta`).

- [ ] **Step 1: Write the failing test**: I06 existe com 4 portas e 5 etapas `sau-*`; todo código de etapa de `PAGINAS` que não é `tec-` nem `vls-` existe em `ETAPAS_FILTRO`; `motivoFora` com porta; `aplicarPagina({ materiais:['guia-saude-1'], portas:['aupair'], etapas:['sau-completo'] }, 'I01', P).limpou` é `['etapa','porta']`; `fraseCascata` de I06 devolve `portas === 'qualquer porta'`; `paginaAtual({ materiais:['guia-saude-1'] }, P) === 'I06'`; token de material único.
- [ ] **Step 2: Run** `node crm-editor-quem.test.mjs`. Expected: FALHA.
- [ ] **Step 3: Implement** os dados e as funções acima. Em `crm.js`: `ORIG['guia-saude-1'] = 'Guia saúde: como o sistema funciona'`; em `passoQuem`, a linha Quem mostra o chip `porta` (popover `data-pq="portas"`) depois da página quando `fr2.portas !== null`; `mudarPara` e o salvamento já tratam listas, só incluir `'portas'` na limpeza de listas vazias; `paraResumo` mostra `porta …`. `paraVazio()` ganha `portas: []`.
- [ ] **Step 4: Run** a suíte do site. Expected: sem `FALHA`.
- [ ] **Step 5: Commit** `feat(crm): página I06 (saúde) e as portas na cascata`

### Task 6: SQL da página de saúde (`crm-saude-i06.sql`) e seu teste

**Files:**
- Create: `admin/crm/db/crm-saude-i06.sql`, `admin/crm/db/testes/crm-saude-i06.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (script `test:saude`)

**Interfaces:**
- Consumes: `crm_sequencia_candidatos` (Task 2).
- Produces (SQL, ordem: depois de `crm-sequencia-previsao.sql`):
  1. `modelos_email_pagina_check` aceita `I06`, além de `I01` a `I05`.
  2. `capturar_lead_guia(payload jsonb) returns jsonb` — a de `guias-link-privado.sql`, e depois de `capturar_lead` passar, se `payload->'respostas'->>'porta'` for um de `estudante`, `trabalho`, `aupair`, `outro` (minúsculo, exato), faz `update contatos set respostas = respostas || jsonb_build_object('porta', <valor>) where email = lower(trim(payload->>'email'))`. Valor fora da lista: ignorado, cadastro segue. Mesmas permissões de hoje (`revoke … from public`, `grant … to anon, authenticated`).
  3. `crm_sequencia_candidatos` entrega `'porta', c.respostas -> 'porta'` dentro de `dados.respostas` e respeita `crm_lista(m.para_quem, 'portas')`: lista vazia passa; com valor, só passa `(c.respostas ->> 'porta') = any(...)`.

- [ ] **Step 1: Write the failing test** no molde da Task 2: aplica o SQL duas vezes sem erro; `modelos_email.pagina = 'I06'` aceito e `'I07'` recusado; `capturar_lead_guia` com `respostas: { porta: 'aupair', objetivo: 'sau-sem-numero' }` grava `porta` e `objetivo` e devolve o link do guia de `payload.guia`; porta `'AuPair'`, `''`, `'x; drop'` e ausente: cadastro ok e `respostas` sem `porta`; cadastro com e-mail inválido continua dando erro; `anon` executa `capturar_lead_guia` e `anon` não executa o helper; modelo com `para_quem = {"materiais":["guia-saude-1"],"portas":["aupair"]}`, Envio ligado: só a pessoa com `porta = aupair` aparece nos candidatos e nos Y; com `portas` e `etapas` juntos, vale a interseção; quem não marcou porta não passa quando há regra de porta; `dados.respostas.porta` chega ao Worker.
- [ ] **Step 2: Run** `node crm-saude-i06.test.mjs`. Expected: falha.
- [ ] **Step 3: Implement** o SQL. A consulta de `crm_sequencia_candidatos` é recriada com as duas mudanças e o resto idêntico à da Task 2; cabeçalho no estilo dos vizinhos; como desfazer: rodar de novo `crm-sequencia-previsao.sql` e `guias-link-privado.sql`.
- [ ] **Step 4: Run** o teste novo e a suíte PGlite (`crm-sequencia-previsao`, `crm-sequencia-minutos`, `crm-filtro-etapa`, `crm-estudio-emails-3`, `crm-fase0-email-guia`, `crm-pagina-i05` se existir teste, `guias-link-privado`). Expected: 0 falhas.
- [ ] **Step 5: Commit** `feat(crm): página I06 (saúde) no banco: porta no cadastro e filtro de porta`

### Task 7: Variáveis da saúde no Worker e no catálogo do estúdio

**Files:**
- Modify: `cms-oauth-worker/worker.js` (`crmVarsNovos` e constantes vizinhas), `admin/crm/estudio.js` (`VARS_NOVOS`, `CAT`)
- Test: `cms-oauth-worker/testes/crm-email.test.mjs`, `admin/crm/db/testes/crm-estudio-blocos.test.mjs`

**Interfaces:**
- Produces: `crmVarsNovos(env, p, agora = new Date())` devolve, além do que já devolve: `porta_estudante`, `porta_trabalho`, `porta_aupair`, `porta_outro` (boolean, `p.dados.respostas.porta === …`); `ponto_nao_cheguei`, `ponto_sem_numero`, `ponto_esperando`, `ponto_sem_vitale`, `ponto_completo` (boolean, `respostas.objetivo === 'sau-' + ponto com hífens`); `secao` (`Estudante`, `Trabalho`, `Au pair`, `o tronco do mapa` para outro; `''` sem porta); `assunto_persona` (tabela porta × ponto copiada do artefato "Templates de e-mail S2", `''` se faltar um dos dois); `astucia_a0007` (porta estudante e ponto nao_cheguei ou sem_numero), `astucia_a0008` (trabalho e os mesmos pontos), `astucia_a0009` (aupair e nao_cheguei, sem_numero ou esperando); cada uma só `true` se `agora < 2027-02-14T00:00:00-03:00`. Todas sempre presentes.
- `ES.VARS_NOVOS` ganha as mesmas chaves; `ES.CAT` ganha uma entrada por chave no formato das vizinhas (`t: 'sim'` para os booleanos, texto para `secao` e `assunto_persona`).

- [ ] **Step 1: Write the failing test** (Worker): as 20 combinações porta × ponto montam o conjunto de variáveis sem erro; `aupair` + `sau-sem-numero` → `porta_aupair`, `ponto_sem_numero`, `astucia_a0009` verdadeiros e os outros falsos, `secao === 'Au pair'`, `assunto_persona === 'Seu número de sécu começa na declaração da família'`; `estudante` + `sau-sem-vitale` → nenhuma astúcia; `outro` → `secao === 'o tronco do mapa'`; com `agora = new Date('2027-02-14T12:00:00-03:00')` nenhuma astúcia; lead antigo (`dados.respostas = {}`) → todos falsos e `''`, sem lançar; toda chave de `ES.VARS_NOVOS` da saúde está em `Object.keys(crmVarsNovos(...))`. (Estúdio): as chaves novas estão em `ES.CAT`, e `etapa_ap_*` continua fora.
- [ ] **Step 2: Run** `cd cms-oauth-worker/testes && node crm-email.test.mjs` e `node ../../admin/crm/db/testes/crm-estudio-blocos.test.mjs`. Expected: FALHA nos checks novos.
- [ ] **Step 3: Implement**: tabelas `CRM_SAUDE_SECAO`, `CRM_SAUDE_ASSUNTO` e `CRM_SAUDE_ASTUCIAS` (`id`, `porta`, `pontos[]`) no `worker.js`, uma função pura `crmVarsSaude(resp, agora)` chamada por `crmVarsNovos`, e as entradas de `VARS_NOVOS`/`CAT` em `estudio.js`. Assuntos e regras de astúcia são os do artefato, sem inventar texto.
- [ ] **Step 4: Run** `crm-email.test.mjs` inteiro e a suíte do site. Expected: sem falha nova (se `crm-email.test.mjs` já falhava antes, ledgar com a base).
- [ ] **Step 5: Commit** `feat(crm): dados da página de saúde no Worker e no catálogo do estúdio`

### Task 8: Suíte completa, versão de cache e entrega

- [ ] **Step 1: Run** todos os testes do site que não precisam de Supabase e a suíte PGlite com `APP_DB_DIR`; comparar com a base (`crm-insights-ui` e `crm-onboarding-ui` já falhavam antes). Expected: nenhuma falha nova.
- [ ] **Step 2: Push** `git push -u origin claude/elegant-goodall-36wfof` no site e no app.
