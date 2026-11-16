# CRM retrabalhado — plano de implementação

> **Executado em 16/11** (branch `claude/affectionate-cori-5udinl`). Desvios: Potencial ligado no `crm.js` (o artefato só trazia o cabeçalho da coluna); testes antigos ajustados ao texto novo; `um_a_um.registro` pendente de SQL. Ver `admin/crm/PLANO.md`.

> **Para quem executa:** REQUIRED SUB-SKILL: superpowers:executing-plans (recomendado aqui: os arquivos se tocam entre si) ou superpowers:subagent-driven-development. Passos com `- [ ]`.

**Objetivo:** levar para `admin/crm/` tudo o que o artefato do CRM retrabalhado desenvolveu, de uma vez.

**Arquitetura:** sobrepor os arquivos do artefato e aplicar uma transformação fixa e repetível (script), cobrindo cada módulo com testes Node antes de aceitar.

**Stack:** JS estático (módulos ES), CSS vanilla, testes `node *.test.mjs` em `admin/crm/db/testes` (sem build).

**Spec:** `docs/superpowers/specs/2026-11-16-crm-retrabalhado-design.md`

## Restrições globais
- `ART=/tmp/claude-0/-home-user/dd5109f3-354d-5450-b0db-e0f9908d91a9/scratchpad/artefato` (cópia local do artefato v1794834812-352b; se sumir, `Artifact read` com `paths` e `out_dir` de novo).
- Não copiar: `mock-supabase.js`, `banco.json`, `*-previa.json`, o invólucro `<!doctype…><body>` e o `</body></html>` extras que o artefato põe em `index.html`.
- `crm.js` real importa `{ supabase } from '/assets/js/supabase-client.js'`.
- `?v=2026-11-16.1` em todo import local e nas tags do `index.html` (o repo estava em `2026-11-15.8`).
- Sem SQL novo; `um_a_um_pagamentos` já existe. Aparecendo tabela/coluna fora do banco atual, parar e voltar ao desenho.
- Fixtures de teste com dados inventados (site público). Comentários e textos em português.

## Revisão (o que o spec implica e nenhuma tarefa cobre sozinha)
- `ficha-harness.mjs` e `crm-funil-ui`/`crm-ficha-ui` removem todo `import` do `crm.js` por regex: o import novo `./panorama.js` precisa ter o `PN` disponível no harness, senão `PN is not defined`.
- `receitaEstimada` com contato sem pagamento, sem assinatura, ou valor ausente: deve dar `€ 0`, nunca `NaN`/`undefined`.
- Período do seletor sem dado anterior completo: delta vira "—" (não inventar).
- `panorama` com 0 sinais e coorte `n<3`: "poucos dados", sem número inventado.
- Texto de pessoa com e-mail/IBAN/número longo: `limpa()` oculta antes de mostrar.

---

### Tarefa 1: Base verde antes de mexer
**Arquivos:** nenhum alterado.
- [ ] Em `admin/crm/db/testes` rodar `node ficha.test.mjs && node ficha-html.test.mjs && node ficha-uso.test.mjs && node funil.test.mjs && node crm-funil-ui.test.mjs && node crm-ficha-ui.test.mjs && node ficha-sync.test.mjs && node crm-editor-blocos.test.mjs && node crm-editor-quem.test.mjs && node crm-jornada.test.mjs`. Esperado: todos terminam sem `FALHOU`. Anotar os que já falham (base).
- [ ] `cd ../.. && git status` limpo (só os dois docs de `docs/superpowers`).

### Tarefa 2: `panorama.js` (módulo novo, TDD)
**Arquivos:** criar `admin/crm/panorama.js` (cópia de `$ART/panorama.js`); criar `admin/crm/db/testes/panorama.test.mjs`; modificar `package.json` (script `test:panorama`).
**Produz:** `panorama(d)`, `sugestoes(a)`, `montaCoorte(linhas, usuarios)`, `logColetado(d)`, `htmlPanorama(a, sugs, ui, h)`, `htmlTrouxe(a, ui, h)`, `limpa`, `privado`, `hostDe`, `rotQ`.
- [ ] Escrever `panorama.test.mjs` primeiro, com dados inventados, e vê-lo falhar (`Cannot find module`): `limpa('a@b.com 12345678901')` devolve `r=true` e `[e-mail]`/`[número]`; `privado('https://drive.google.com/x')` verdadeiro e `privado('https://campusfrance.org')` falso; `panorama({itens:[],escolas:[],coorte:null}).leitura` começa com "Ainda sem sinais"; com coorte `n=2`, `.co` é `null` e `htmlPanorama` contém "Poucos dados para comparar"; com coorte `n=3`, `.co.n===3`; `rotQ('2026-11-20T09:30')==='20/11 às 09:30'`; `montaCoorte` só conta usuários da lista; `logColetado` ordena do mais recente.
- [ ] Copiar o arquivo. Rodar `node panorama.test.mjs`. Esperado: passa.
- [ ] Commit `feat(crm): módulo Panorama dela e O que ela trouxe`.

### Tarefa 3: `ficha.js` e `ficha-html.js` (lógica e HTML da ficha)
**Arquivos:** modificar `admin/crm/ficha.js`, `admin/crm/ficha-html.js`; testes `ficha.test.mjs`, `ficha-html.test.mjs`.
**Produz:** `cartoesMinimos(tipo, d)`, `potencial(x)`, `urgentes(ctx)`, `SESSOES_PADRAO`, `htmlCarrossel(tarefas, h, i, o)`, reexport `calcularUso` e `funil`.
- [ ] Acrescentar a `ficha.test.mjs` (falhando antes): `urgentes({respostasNovas:2})` → `['2 respostas dela esperando']`; `urgentes({})` → `[]`; `cartoesMinimos('lead', {c:{criado_em:'2026-11-01T10:00:00Z'}, mailsTotal:0})` tem um cartão `E-mail` com valor `—`; `cartoesMinimos('assinante', …)` com `assin.status==='trialing'` rotula "Fim do teste"; lead sem `ultimoAcesso` não mostra cliques/sessões; `potencial` devolve inteiro entre 0 e 100 e pontuação maior para quem respondeu e tem prazo curto do que para lead frio (ler a função copiada para fixar os valores exatos nas asserções).
- [ ] Acrescentar a `ficha-html.test.mjs`: `htmlCarrossel([], h, 0, {nome:'Ana'})` contém "Nenhuma ação pendente" e "+ Adicionar"; com 2 tarefas mostra "1 de 2"; `concluidas:3` mostra "Concluídas (3)".
- [ ] Copiar `$ART/ficha.js` e `$ART/ficha-html.js`, trocando o `?v=` de volta (`./ficha.js?v=2026-11-16.1` em `ficha-html.js`). Rodar as duas suítes e `ficha-sync.test.mjs`, `ficha-uso.test.mjs`. Esperado: passam.
- [ ] Commit `feat(crm): cabeçalho minimalista, potencial, carrossel de ações e urgentes na ficha`.

### Tarefa 4: `index.html` e `crm.css`
**Arquivos:** modificar `admin/crm/index.html`, `admin/crm/crm.css`.
- [ ] Partir de `$ART/index.html`; remover a 1ª linha (`<!doctype…<body>` do invólucro) e as 3 últimas (`</body></html>`); restaurar `crm.css?v=2026-11-16.1` e `crm.js?v=2026-11-16.1`. Conferir `diff` contra o `index.html` anterior: só mudam o Hoje (período, KPIs, abas `hj-abas`, panes) e o `th-pot` de Potencial.
- [ ] Copiar `$ART/crm.css` sem alterações. `node -e` de checagem de chaves balanceadas `{}` no arquivo.
- [ ] Commit `feat(crm): Hoje com abas e período, coluna Potencial, estilos novos`.

### Tarefa 5: `crm.js` e módulos que o importam
**Arquivos:** modificar `admin/crm/crm.js`, `editor-email.js`; criar `admin/crm/db/testes/crm-retrabalho-ui.test.mjs`; ajustar `ficha-harness.mjs`.
**Interfaces:** consome `PN` (Tarefa 2), `FX`/`FH` (Tarefa 3), ids do HTML (Tarefa 4).
- [ ] Gerar `crm.js` por script reproduzível (`/tmp/claude-0/-home-user/dd5109f3-354d-5450-b0db-e0f9908d91a9/scratchpad/transformar.sh`): copia `$ART/crm.js`; troca a linha `import { supabase } from './mock-supabase.js';` por `import { supabase } from '/assets/js/supabase-client.js';`; acrescenta `?v=2026-11-16.1` a cada `import … from './x.js'` (inclui `panorama.js`); `editor-email.js`: `./editor-blocos.js?v=2026-11-16.1`. `diff` do resultado contra `$ART/crm.js` só pode ter essas linhas.
- [ ] Ajustar `ficha-harness.mjs` para que `PN` exista após o strip dos imports (importar `../../panorama.js` e expor como `PN`, como já faz com `FX`/`FH`).
- [ ] Escrever `crm-retrabalho-ui.test.mjs` (falhando antes, usando o harness): `receitaEstimada` com dados vazios → `€ 0` (sem `NaN`); `renderKpis` preenche `k-leads`, `k-um`, `k-plat`, `k-rev`; mudar `k-per` para 30 recalcula; abas de Hoje (`hj-abas`) trocam o `hj-pane` visível; `th-pot` ordena Contatos por Potencial; `fxPanoramaDados` com coorte `<3` mostra "Poucos dados".
- [ ] Rodar toda a lista da Tarefa 1 mais `panorama.test.mjs` e `crm-retrabalho-ui.test.mjs`. Esperado: sem `FALHOU` novo em relação à base.
- [ ] Commit `feat(crm): Hoje, Contatos e Ficha retrabalhados ligados aos dados reais`.

### Tarefa 6: Conferência no navegador (fora do repositório)
**Arquivos:** nenhum no repo; preparar pasta temporária no scratchpad.
- [ ] Montar `scratchpad/previa/` com os arquivos do artefato (inclui mock e `banco.json`), servir com `python3 -m http.server`, abrir com Playwright (Chromium já instalado) e navegar por Hoje (cada aba), Contatos (ordenar Potencial), Ficha de um lead, de uma pessoa na plataforma e de uma assinante (abas E-mail, Plataforma, Ficha, Dossiê; Panorama e "O que ela trouxe"), Funil. Zero erro de console; screenshots a 2× para conferir.
- [ ] Repetir a mesma navegação com os arquivos do **repositório** + o mock no lugar do cliente (só na pasta temporária) e comparar os prints com os do artefato: devem ser iguais.

### Tarefa 7: Documentação e fecho
**Arquivos:** modificar `admin/crm/PLANO.md` (linhas das telas Hoje, Contatos, Ficha), `docs/superpowers` (marcar o plano como executado).
- [ ] Atualizar `PLANO.md` descrevendo o novo Hoje, o Potencial, a ficha minimalista e o Panorama; registrar que não há SQL novo.
- [ ] Conferir que nenhum `mock`/`previa`/`banco.json` entrou: `git status` e `grep -rn "mock-supabase" admin/crm`. Esperado: vazio.
- [ ] Commit `docs(crm): plano atualizado com o CRM retrabalhado`; `git push -u origin claude/affectionate-cori-5udinl`. Sem abrir PR (só se a Ingryd pedir).
