# CRM · Taxonomia e filtros dos modelos de e-mail — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada modelo de e-mail do CRM ganha família, página de entrada, etapa e persona; a lista agrupa por isso, ganha filtros e visões, e "Outros" deixa de existir.

**Architecture:** Quatro colunas aditivas em `modelos_email` (SQL idempotente). Um módulo puro e testável sem DOM, `admin/crm/taxonomia.js`, guarda o catálogo, a classificação (do banco ou, sem o SQL, em modo de reserva) e a lógica de agrupar e filtrar. `crm.js` só renderiza.

**Tech Stack:** JavaScript ES modules sem build (estilo `var` e funções, como `estudio.js`), SQL Postgres/Supabase, testes em Node com PGlite.

**Spec:** `docs/superpowers/specs/2026-11-09-crm-taxonomia-modelos-design.md`

## Global Constraints

- Todos os caminhos abaixo são relativos à raiz do repositório website (`/home/user/ingrydlts.github.io`); o painel está em `admin/crm/`. Branch: `claude/wonderful-albattani-v5ql4c`.
- Sem build, sem bundler, sem dependência nova. Nomes de arquivo, função, variável e chave em português; comentários em português.
- SQL só acrescenta (`add column if not exists`, constraints só se não existirem, `update … where … is null`), é idempotente e traz no cabeçalho o "Como desfazer". Sem tabela nova e sem função nova.
- O preenchimento inicial nunca sobrescreve uma coluna já preenchida.
- O Worker (`cms-oauth-worker`) não muda.
- Rodar testes de banco com `cd admin/crm/db/testes && npm install && APP_DB_DIR=/home/user/POR-DENTRO-APP/db npm run <script>`; testes sem banco com `node <arquivo>` nessa mesma pasta.
- Todo commit segue `tipo(escopo): descrição` e termina com as linhas de atribuição pedidas pela sessão.
- Valores fixos: famílias `entrega`, `personalizado`, `aquecimento`, `serie`, `compra`, `acesso`, `reimpacto`, `campanha`; páginas `I01`–`I04`; personas `au_pair`, `pvt`, `estudante`, `conjuge`; `etapa` casa `^[a-z0-9-]{2,40}$` e só existe com `pagina`.

## Review Focus

1. Modelo com chave desconhecida, sem as colunas novas (SQL não rodado): cai em "Sem classificação", nunca em "Outros" e nunca lança erro. (Task 1, Task 2)
2. Filtro de persona com modelos de `persona = null`: eles aparecem em qualquer persona marcada; só somem com "só específicos". (Task 3)
3. Marcou uma etapa, depois desmarcou a página dela: o filtro de etapa que sobrou não pode esconder tudo. (Task 3, Task 6)
4. Modelo excluído (`excluido_em`) não aparece na lista, nas contagens nem nos filtros. (Task 2, Task 3)
5. Etapa no banco que não está no catálogo (ex.: etapa nova no vault, catálogo atrasado): o modelo aparece sob o código da etapa, não some. (Task 2)

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `admin/crm/taxonomia.js` (novo) | Catálogo, `classifica`, `agrupa`, filtros, situação. Sem DOM. |
| `admin/crm/db/crm-taxonomia-modelos.sql` (novo) | Colunas, constraints, preenchimento. |
| `admin/crm/db/testes/crm-taxonomia-ui.test.mjs` (novo) | Testes de `taxonomia.js` e da renderização de `crm.js`. |
| `admin/crm/db/testes/crm-taxonomia-modelos.test.mjs` (novo) | Testes do SQL (PGlite) e de sincronia com o modo de reserva. |
| `admin/crm/db/testes/package.json` | Scripts `test:taxonomia` e `test:taxonomia-ui`. |
| `admin/crm/crm.js` | Troca `CATEGORIAS`/`porCategoria` por `TX.agrupa`; barra de filtros; campos de classificação. |
| `admin/crm/index.html`, `admin/crm/crm.css` | Container `#mod-filtros`, estilos, versão dos scripts. |
| `admin/crm/PLANO.md` | Seção "Taxonomia dos modelos". |

---

### Task 1: Catálogo e classificação (`taxonomia.js`)

**Files:**
- Create: `admin/crm/taxonomia.js`
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (script `"test:taxonomia-ui": "node crm-taxonomia-ui.test.mjs"`)

**Interfaces:**
- Produces (todas `export`):
  - `FAMILIAS: Array<[codigo, rotulo]>` na ordem: entrega "Entrega do material", personalizado "E-mail personalizado da página", aquecimento "Aquecimento", serie "Séries por persona", compra "Teste, oferta e compra", acesso "Acesso e boas-vindas", reimpacto "Reimpacto", campanha "Campanhas".
  - `PAGINAS: Array<{k, nome, rota, etapas: Array<[codigo, rotulo]>}>` com as 4 páginas e as etapas da seção 5 da spec, com os mesmos códigos e rótulos.
  - `PERSONAS: Array<[codigo, rotulo]>`.
  - `classifica(m): {familia, pagina, etapa, persona, origem}` com `origem` `'banco'` (m tem a propriedade `familia`, mesmo `null`) ou `'reserva'` (m não tem a propriedade; usa `reserva(m)`).
  - `temColunas(lista): boolean` (`lista[0]` tem a propriedade `familia`; lista vazia → `true`).
  - `rotuloFamilia(k)`, `rotuloPagina(k)`, `rotuloEtapa(pagina, etapa)`: devolvem o rótulo do catálogo, ou o próprio código se não existir, ou `'Sem classificação'` para `null` em `rotuloFamilia`.
  - `familiaDoObjetivo(k): string|null`: `freebie`→entrega, `boas_vindas`→acesso, `conversa`→entrega, `aquecimento`→aquecimento, `reimpacto`→reimpacto, `convite`→compra, `compra`→compra, `lembrete`→campanha, `lancamento`→campanha, outro→`null`.

- [ ] **Step 1: Write the failing tests** em `crm-taxonomia-ui.test.mjs` (mesmo esqueleto de `crm-proximo-email-ui.test.mjs`: `check(label, cond)`, contadores, `process.exit(failed ? 1 : 0)`), importando `../../taxonomia.js`:
  - `classifica({chave:'x', familia:'acesso', pagina:null, etapa:null, persona:null}).origem === 'banco'` e devolve os valores do banco.
  - Modo de reserva (objeto sem a propriedade `familia`), um `check` por linha da tabela da seção 4 da spec, com chaves reais: `boas_vindas`→acesso; `acesso_confirmado`→acesso; `link_pagamento`→compra; `hub_estudos_compra` e `hub_estudos_d3` (com `tipo:'compra'`)→compra; `naoabriu`, `naoclicou`, `cliquenaoapp`, `parouapp`→reimpacto; `cf_guia_1`, `cf_guia_conversa`→entrega/I03; `aq_a_d3`, `aq_b_d6`, `aq_c_d15`→aquecimento/I03; `guia_alternancia`→entrega/I01; `guia_chamada`, `guia_plataforma`→entrega/I04; `tec_recap_30min`→entrega/I02; `aupair_chegada_1`, `aupair_chegada_2`→entrega, persona `au_pair`, sem página; `hub_estudos_lancamento`, `lembrete_prazo_vlsts`→campanha.
  - Chave desconhecida em modo de reserva → `{familia:null, pagina:null, etapa:null, persona:null}` e não lança.
  - `rotuloEtapa('I02','tec-nao-sei') === 'Não sei o nível'`; `rotuloEtapa('I02','etapa-nova') === 'etapa-nova'`.
  - `familiaDoObjetivo('freebie') === 'entrega'` e `familiaDoObjetivo('zzz') === null`.
  - `temColunas([{chave:'a'}]) === false`; `temColunas([{familia:null}]) === true`.

- [ ] **Step 2: Run** `cd admin/crm/db/testes && node crm-taxonomia-ui.test.mjs` — Expected: falha (módulo não existe).

- [ ] **Step 3: Implement** `taxonomia.js` com o cabeçalho da seção 5 da spec (de qual arquivo do vault vem cada tabela e a data `2026-11-09` da conferência). `reserva(m)` aplica: tabela por chave exata, depois prefixos (`acesso_`, `link_pagamento`, `cf_guia_`, `aq_`), depois `m.tipo === 'compra'` → compra, senão tudo `null`.

- [ ] **Step 4: Run** o mesmo comando — Expected: `N passaram, 0 falharam`.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/taxonomia.js admin/crm/db/testes/crm-taxonomia-ui.test.mjs admin/crm/db/testes/package.json
git commit -m "feat(crm): catálogo e classificação dos modelos de e-mail (taxonomia.js)"
```

---

### Task 2: Agrupar a lista (`agrupa`)

**Files:**
- Modify: `admin/crm/taxonomia.js`
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`

**Interfaces:**
- Consumes: `classifica`, `FAMILIAS`, `PAGINAS`, `PERSONAS`, `rotulo*` (Task 1).
- Produces: `agrupa(lista: Modelo[]): Array<{id: string, titulo: string, selo: string|null, itens: Modelo[], subgrupos: Array<{id, titulo, itens: Modelo[]}>}>` onde `itens` do grupo é o total de modelos do grupo (soma dos subgrupos).

Regras (spec seção 6): ignora `excluido_em`; grupos por página (`id` = `pagina`, ordem I01–I04) com subgrupos por etapa na ordem do catálogo, depois etapas fora do catálogo (título = código), e por último os sem etapa, cujo subgrupo tem o título da família; depois um grupo por família sem página, na ordem de `FAMILIAS` (a família `serie` tem subgrupos por persona; as demais não têm subgrupos); depois `{id:'sem', titulo:'Sem classificação', selo:'atenção'}` com quem não tem família nem página; grupos vazios não aparecem; ordenação interna por `ordem` e depois `nome`. Modelo com página mas sem família fica sob a página no subgrupo "Sem classificação".

- [ ] **Step 1: Write the failing tests** (cada um um `check`). Definir e exportar no arquivo de teste `fixture32()`, reusada nas Tasks 5 a 7: modelos `{chave, nome, ordem, tipo, excluido_em: null}` em modo de reserva (sem as colunas novas) com as chaves: os 12 `aq_a_d3`…`aq_c_d15`, `cf_guia_1`, `cf_guia_conversa`, `guia_alternancia`, `guia_chamada`, `guia_plataforma`, `tec_recap_30min`, `aupair_chegada_1`, `aupair_chegada_2`, `boas_vindas`, `acesso_confirmado`, `link_pagamento`, `hub_estudos_compra`, `hub_estudos_d3`, `hub_estudos_lancamento`, `lembrete_prazo_vlsts`, `naoabriu`, `naoclicou`, `cliquenaoapp`, `parouapp` (31 conhecidos, `tipo:'compra'` nos de compra) e uma desconhecida `zz1` (total 32). Asserções:
  - Com `fixture32()`, nenhum grupo tem `titulo === 'Outros'`; `zz1` cai em `id:'sem'` e é o único item dele.
  - `aq_*`, `cf_guia_*` aparecem no grupo `id:'I03'`; `guia_alternancia` no `I01`.
  - Modelo com `pagina:'I02', etapa:'tec-nao-sei'` e outro com `etapa:'etapa-nova'`: ambos no grupo `I02`; o subgrupo do primeiro vem antes e o do segundo se chama `etapa-nova`.
  - Modelo com `excluido_em` preenchido não aparece em nenhum grupo.
  - `aupair_chegada_1` (família entrega, persona `au_pair`, sem página) aparece no grupo `entrega`.
  - Lista vazia → `[]`.

- [ ] **Step 2: Run** `node crm-taxonomia-ui.test.mjs` — Expected: falha (`agrupa` não existe).

- [ ] **Step 3: Implement** `agrupa` em `taxonomia.js` segundo as regras acima.

- [ ] **Step 4: Run** — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/taxonomia.js admin/crm/db/testes/crm-taxonomia-ui.test.mjs
git commit -m "feat(crm): agrupar modelos por página, etapa e família"
```

---

### Task 3: Filtros, situação e visões

**Files:**
- Modify: `admin/crm/taxonomia.js`
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`

**Interfaces:**
- Consumes: `classifica`, `PAGINAS` (Task 1).
- Produces:
  - `filtroVazio(): {q: string, paginas: string[], etapas: string[], familias: string[], personas: string[], soEspecificos: boolean, tipos: string[], situacoes: string[], semClasse: boolean}` (`paginas` aceita o valor `'sem'` = sem página).
  - `situacaoDe(m, versoes: Versao[]): {noAr, rascunho, revisao, envioLigado, envioDesligado, semTeste}` (booleanos; `versoes` são as de `modelos_email_versoes` desse modelo, da mais nova para a mais velha; `semTeste` = a versão mais nova em `rascunho` ou `revisao` tem `testado_em` nulo; `envioDesligado` = tem `envio_gatilho` e `envio_ligado` falso).
  - `aplicaFiltros(lista: Modelo[], f: Filtros, versoesDe: (chave) => Versao[]): Modelo[]`: dentro de cada filtro é "ou", entre filtros é "e"; `q` busca (sem acento, sem diferenciar caixa) em `nome` e `objetivo`; persona marcada mantém `persona === X` **e** `persona == null`, salvo `soEspecificos`; tira `excluido_em`; `semClasse` mantém só quem `classifica` devolve `familia` e `pagina` nulos.
  - `limpaEtapasOrfas(f): Filtros`: remove de `f.etapas` as que não pertencem a nenhuma página marcada (todas, se nenhuma página marcada).
  - `VISOES: Array<{k, nome, filtros: Partial<Filtros>}>`: `rascunhos` "Rascunhos para revisar" (`situacoes: ['rascunho','revisao']`), `teste` "Esperando o meu teste" (`['semTeste']`), `ligado` "Envio ligado" (`['envioLigado']`), `semclasse` "Sem classificação" (`semClasse: true`).

- [ ] **Step 1: Write the failing tests**:
  - Persona `au_pair` marcada: mantém um modelo `persona:'au_pair'` e um `persona:null`, tira um `persona:'pvt'`; com `soEspecificos:true` tira o `null`.
  - Página `I02` marcada + etapa `tec-nao-sei` → só esse modelo; depois `limpaEtapasOrfas({paginas:[], etapas:['tec-nao-sei']}).etapas` é `[]` e, com `paginas:['I02']`, continua `['tec-nao-sei']`.
  - Página `'sem'` mantém só modelos sem página.
  - Filtros de tipos diferentes combinam com "e": `tipos:['novidades']` + `familias:['aquecimento']`.
  - `situacaoDe` para um modelo com versões `[{etapa:'rascunho', testado_em:null},{etapa:'no_ar'}]` → `rascunho:true, noAr:true, semTeste:true`; com `testado_em` preenchido → `semTeste:false`.
  - `q:'trilha b'` acha `aq_b_d3` pelo nome ("Aquecimento · trilha B · dossiê…") e `q:'dossie'` também (sem acento).
  - Excluído nunca passa, mesmo com todos os filtros vazios.
  - Cada visão de `VISOES` aplicada a uma fixture devolve o esperado (um `check` por visão).

- [ ] **Step 2: Run** — Expected: falha.

- [ ] **Step 3: Implement** as funções e `VISOES` em `taxonomia.js`.

- [ ] **Step 4: Run** — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/taxonomia.js admin/crm/db/testes/crm-taxonomia-ui.test.mjs
git commit -m "feat(crm): filtros, situação e visões dos modelos de e-mail"
```

---

### Task 4: SQL das colunas e preenchimento

**Files:**
- Create: `admin/crm/db/crm-taxonomia-modelos.sql`
- Create: `admin/crm/db/testes/crm-taxonomia-modelos.test.mjs`
- Modify: `admin/crm/db/testes/package.json` (`"test:taxonomia": "node crm-taxonomia-modelos.test.mjs"`)

**Interfaces:**
- Consumes: `classifica` (Task 1), para o teste de sincronia.
- Produces: colunas `familia`, `pagina`, `etapa`, `persona` em `public.modelos_email`, com as constraints `modelos_email_familia_check`, `modelos_email_pagina_check`, `modelos_email_persona_check`, `modelos_email_etapa_check` (valores da seção "Global Constraints"; `etapa` exige `pagina`).

- [ ] **Step 1: Write the failing test** no esqueleto de `crm-sequencia-minutos.test.mjs` (setup de PGlite igual; carregar os mesmos arquivos SQL dele, mais, nesta ordem, `crm-sequencia-minutos.sql`, `crm-modelo-tecnologo-recap.sql`, `crm-modelos-chegada-au-pair.sql`, `crm-link-pagamento-email.sql`, `crm-acesso-email.sql`; se algum não carregar isolado, retire-o e diga qual no commit). Asserções:
  - `roda a 1ª vez e a 2ª vez sem erro`.
  - Constraints rejeitam: `familia='x'`, `pagina='I09'`, `persona='x'`, `etapa='tec-nao-sei'` com `pagina` nula; aceitam `pagina='I02', etapa='tec-nao-sei'`.
  - Depois do SQL, `select chave, familia, pagina, persona` bate com a tabela da seção 4 da spec para todas as chaves presentes (mesma lista da Task 1).
  - Não sobrescreve: antes de rodar o SQL pela 2ª vez, `update modelos_email set familia='campanha', pagina='I04' where chave='boas_vindas'`; depois da 2ª rodada, `boas_vindas` continua `campanha`/`I04`.
  - O gatilho não reclama: `update modelos_email set familia='acesso' where chave='boas_vindas'` (modelo de antes do estúdio) não lança erro.
  - Nenhuma outra coluna mudou: comparar `select *` antes e depois, removendo as quatro novas (como o teste do `envio_minutos`).
  - Sincronia com o modo de reserva: para cada linha, `classifica` (importado de `../../taxonomia.js`) chamado com a linha sem as quatro colunas devolve o mesmo `familia`, `pagina`, `persona` que o banco.
  - Leitura do Worker: `select * from modelos_email where chave = 'cf_guia_1'` devolve a linha (equivalente à consulta `?select=*&chave=eq.…`).

- [ ] **Step 2: Run** `APP_DB_DIR=/home/user/POR-DENTRO-APP/db npm run test:taxonomia` — Expected: falha (SQL não existe).

- [ ] **Step 3: Implement** `crm-taxonomia-modelos.sql` no padrão de `crm-sequencia-minutos.sql` (cabeçalho com o que muda, ordem de rodar, "Como desfazer": `alter table public.modelos_email drop column if exists familia, drop column if exists pagina, drop column if exists etapa, drop column if exists persona;`). Constraints dentro de `do $$ … if not exists (select 1 from pg_constraint where conname = …)`. Preenchimento: um `update public.modelos_email m set familia = coalesce(m.familia, x.familia), pagina = coalesce(m.pagina, x.pagina), persona = coalesce(m.persona, x.persona) from (values …) x(chave, familia, pagina, persona) where m.chave = x.chave`, mais um `update` por prefixo para `acesso_%`, `link_pagamento%`, `aq_%` e `cf_guia_%`, e um para `tipo = 'compra'` sem família. Todos só preenchem o que está `null`.

- [ ] **Step 4: Run** o mesmo comando, e também `npm test`, `npm run test:modelos`, `npm run test:estudio3`, `npm run test:conferir` e o sentinela `isolamento.test.mjs` — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/db/crm-taxonomia-modelos.sql admin/crm/db/testes/crm-taxonomia-modelos.test.mjs admin/crm/db/testes/package.json
git commit -m "feat(crm): colunas de classificação dos modelos e preenchimento dos atuais"
```

---

### Task 5: Lista agrupada em `crm.js`

**Files:**
- Modify: `admin/crm/crm.js` (import perto da linha 5; `CATEGORIAS`/`categoriaDe`/`porCategoria` perto das linhas 71–84; `renderLista` perto da 2381; `opcoesPorCategoria` perto da 3039)
- Modify: `admin/crm/crm.css`, `admin/crm/index.html` (versão dos scripts)
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`

**Interfaces:**
- Consumes: `agrupa`, `classifica` (Tasks 1–2), via `import * as TX from './taxonomia.js?v=2026-11-09.1'`.
- Produces: `renderLista(lista)` passa a renderizar `TX.agrupa(lista)`; `CAT_FECHADA` passa a ter como chave o `id` do grupo; `opcoesPorCategoria(chaves, atual)` usa `TX.agrupa` (um `<optgroup>` por grupo, rótulo = `titulo`).

- [ ] **Step 1: Write the failing test**: no `crm-taxonomia-ui.test.mjs`, montar o harness de `crm.js` como em `crm-proximo-email-ui.test.mjs` (remover os `import`, passar `TX` além de `ES` ao `new Function`, devolver `{ setM: function (v) { M = v; }, setMV: function (v) { MV = v; }, renderLista, opcoesPorCategoria }`). Com `M` = 32 modelos de fixture em modo de reserva (sem as colunas novas):
  - o HTML de `#mod-list` não contém `Outros`; contém `Sem classificação` quando há modelo desconhecido;
  - contém `data-cat="I03"` e a contagem `· 14` no título do grupo I03 (12 `aq_*` + `cf_guia_1` + `cf_guia_conversa`);
  - nenhum `<button data-tpl-pick>` de modelo excluído;
  - `opcoesPorCategoria(['cf_guia_1','naoabriu'], 'cf_guia_1')` devolve dois `<optgroup>` e marca `selected` em `cf_guia_1`.

- [ ] **Step 2: Run** `node crm-taxonomia-ui.test.mjs` — Expected: falha.

- [ ] **Step 3: Implement**: apagar `CATEGORIAS`, `categoriaDe` e `porCategoria`; em `renderLista`, trocar `porCategoria(lista).map(grupo)` por `TX.agrupa(lista).map(grupo)`, onde `grupo` usa `g.id`, `g.titulo` e, quando há `g.subgrupos`, um `<div class="st-sub"><div class="tplgrp">título · n</div>cards</div>` por subgrupo; o selo `atenção` vira `<span class="pill">atenção</span>` no título. Estilos novos em `crm.css` junto de `.st-cat` (perto da linha 660): `.st-sub`, e `.st-cat .pill` com cor de aviso (reusar variáveis de cor existentes). Atualizar `?v=` do `crm.js` em `index.html` (linha 220) e criar o `?v=` do `taxonomia.js`.

- [ ] **Step 4: Run** `node crm-taxonomia-ui.test.mjs` e `node crm-proximo-email-ui.test.mjs` — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/crm.js admin/crm/crm.css admin/crm/index.html admin/crm/db/testes/crm-taxonomia-ui.test.mjs
git commit -m "feat(crm): lista de modelos agrupada por página, etapa e família"
```

---

### Task 6: Barra de filtros e visões

**Files:**
- Modify: `admin/crm/index.html` (um `<div class="st-filtros" id="mod-filtros"></div>` antes do `<nav id="mod-list">`, linha ~204)
- Modify: `admin/crm/crm.js`, `admin/crm/crm.css`
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`

**Interfaces:**
- Consumes: `filtroVazio`, `aplicaFiltros`, `limpaEtapasOrfas`, `VISOES`, `situacaoDe` (Task 3); `renderLista` (Task 5).
- Produces: `ST.f` (estado dos filtros, `TX.filtroVazio()`, só em memória); `renderFiltros(): void` desenha `#mod-filtros` (chips com `aria-pressed`, campo de busca, visões, contador `N de M modelos`, botão "Limpar filtros"); `renderModelos` passa a chamar `renderFiltros` e `renderLista(TX.aplicaFiltros(lista, ST.f, versoesDe))`. Atributos de clique: `data-filtro="paginas|etapas|familias|personas|tipos|situacoes"` com `data-valor`, `data-visao="<k>"`, `id="filtro-limpar"`, `id="filtro-q"`, `id="filtro-solo"` (só específicos).

- [ ] **Step 1: Write the failing tests** (harness da Task 5, agora também com `renderFiltros` e um clique simulado nos handlers delegados de `document`):
  - estado inicial: `#mod-conta` / contador diz `32 de 32 modelos`; nenhum chip marcado;
  - marcar página `I03` → contador `14 de 32 modelos` e o filtro de Etapa aparece só então;
  - marcar a etapa, depois desmarcar a página → `ST.f.etapas` fica `[]` (nenhum filtro órfão escondendo a lista);
  - visão `rascunhos` marca `situacoes` `rascunho` e `revisao`; clicar nela de novo desmarca;
  - filtro sem resultado → `#mod-list` mostra `Nenhum modelo com esses filtros` e um botão "Limpar filtros" que volta a `32 de 32`;
  - digitar na busca chama só `renderLista` (o `innerHTML` de `#mod-filtros` não é reescrito, para o campo não perder o foco): contar as escritas em `#mod-filtros.innerHTML`.

- [ ] **Step 2: Run** — Expected: falha.

- [ ] **Step 3: Implement** `renderFiltros` e os handlers delegados (seguir o padrão dos `document.addEventListener('click'/'change'/'input', …)` existentes perto da linha 3859). Chips de etapa vêm das páginas marcadas (`TX.PAGINAS`); persona tem o chip extra "só específicos". Em 380 px os chips quebram em várias linhas (`flex-wrap`), sem rolagem horizontal. O estado não vai ao banco.

- [ ] **Step 4: Run** `node crm-taxonomia-ui.test.mjs` — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/index.html admin/crm/crm.js admin/crm/crm.css admin/crm/db/testes/crm-taxonomia-ui.test.mjs
git commit -m "feat(crm): filtros e visões na tela de modelos de e-mail"
```

---

### Task 7: Classificar um modelo (criação e edição)

**Files:**
- Modify: `admin/crm/crm.js` (`renderCriar` passo 2 perto da linha 2672, `criarModelo` perto da 2706, seção "Objetivo e envio" `s1` perto da 2531, handler `change` perto da 3859)
- Test: `admin/crm/db/testes/crm-taxonomia-ui.test.mjs`

**Interfaces:**
- Consumes: `FAMILIAS`, `PAGINAS`, `PERSONAS`, `familiaDoObjetivo`, `temColunas`, `classifica` (Task 1); `salvarModelo(patch, msg)` já existente em `crm.js`.
- Produces: `classeHtml(m): string` (quatro `<select class="st-in" data-classe="familia|pagina|etapa|persona">`; o de etapa só lista as etapas da página escolhida e fica desabilitado sem página; todos desabilitados, com o aviso "rode db/crm-taxonomia-modelos.sql", quando `!TX.temColunas(M)`); `mudarClasse(campo, valor): Promise` (trocar `pagina` zera `etapa`; grava `{familia, pagina, etapa, persona}` com `salvarModelo(patch, 'Classificação salva')`); em `ST.criar`, o campo `classe: {familia, pagina, etapa, persona}` (pré-preenchido com `TX.familiaDoObjetivo(o.k)`), editado por `data-novoclasse`, e `criarModelo` inclui as quatro colunas em `linha` só quando `TX.temColunas(M)`.

- [ ] **Step 1: Write the failing tests** (harness da Task 5):
  - `classeHtml` de um modelo com `pagina:'I02'` lista as 4 etapas de I02 e nenhuma de I01; sem página, o select de etapa vem `disabled`;
  - com `M` sem as colunas novas, todos os selects vêm `disabled` e o aviso aparece;
  - `mudarClasse('pagina','I04')` num modelo com `etapa:'tec-nao-sei'` chama o `update` do Supabase de mentira com `etapa: null` e `pagina: 'I04'`;
  - `ST.criar` com objetivo `freebie` começa com `classe.familia === 'entrega'`; `criarModelo` insere `familia:'entrega'` na `linha` quando `M` tem as colunas e **não** inclui a chave `familia` quando não tem.

- [ ] **Step 2: Run** — Expected: falha.

- [ ] **Step 3: Implement** `classeHtml`, `mudarClasse`, os campos no passo 2 da criação e a chamada de `classeHtml(m)` dentro de `s1` (para todos os modelos, não só os criados no estúdio). Modelo sem família e sem página mostra, no topo da seção, "Escolha onde este e-mail mora"; salvar e publicar não são bloqueados.

- [ ] **Step 4: Run** `node crm-taxonomia-ui.test.mjs` e `node crm-proximo-email-ui.test.mjs` — Expected: todos passam.

- [ ] **Step 5: Commit**
```bash
git add admin/crm/crm.js admin/crm/db/testes/crm-taxonomia-ui.test.mjs
git commit -m "feat(crm): escolher família, página, etapa e persona do modelo"
```

---

### Task 8: Documentação e verificação final

**Files:**
- Modify: `admin/crm/PLANO.md` (nova seção "Taxonomia dos modelos" antes de "## Etapas": nome do SQL, como rodar depois de `crm-sequencia-minutos.sql`, como desfazer, testes `test:taxonomia` e `test:taxonomia-ui`, aviso de que `taxonomia.js` espelha o vault e deve ser atualizado no mesmo dia)

- [ ] **Step 1:** Escrever a seção em `PLANO.md` no formato das vizinhas (ex.: "Envio em minutos: recap do guia do tecnólogo (03/11)").

- [ ] **Step 2: Rodar tudo** em `admin/crm/db/testes` — `APP_DB_DIR=/home/user/POR-DENTRO-APP/db npm test` e os scripts `test:taxonomia`, `test:taxonomia-ui`, `test:modelos`, `test:estudio`, `test:estudio3`, `test:prontos`, `test:etapa`, `test:minutos`, `test:conferir`, `test:proximo-email-ui`, mais `node isolamento.test.mjs` se ele existir ao lado — Expected: todos `0 falharam`.

- [ ] **Step 3: Verificar no navegador** (Playwright já instalado): servir a raiz com `python3 -m http.server 8000`, abrir `/admin/crm/` interceptando `/assets/js/supabase-client.js` com um módulo de mentira que exporta `supabase` com sessão de admin e 32 modelos de fixture (sem as colunas novas, depois com elas). Conferir em 1280 px e em 380 px: nenhum grupo "Outros"; grupo I03 com 14; filtros combinados; modo de reserva com os selects desabilitados; sem rolagem horizontal em 380 px. Guardar os prints no scratchpad e mostrá-los à Ingryd. Se a página não abrir por causa da trava de login, dizer isso e mostrar o que foi coberto pelos testes de Node.

- [ ] **Step 4: Commit e push**
```bash
git add admin/crm/PLANO.md
git commit -m "docs(crm): seção Taxonomia dos modelos no PLANO"
git push -u origin claude/wonderful-albattani-v5ql4c
```

- [ ] **Step 5:** Entregar à Ingryd o passo a passo para rodar `db/crm-taxonomia-modelos.sql` primeiro no Supabase de teste e depois no de produção, e pedir que rode `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` do app em cada um (os dois devem voltar vazios). Não abrir PR sem pedido.
