# CRM "Quem recebe e quando" em cascata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O passo 1 do editor de e-mail começa pela página de inbound e só mostra a persona e as etapas ligadas a ela, em três linhas (Quem, Quando, Hoje).

**Architecture:** Funções puras novas em `editor-quem.js` (testadas em Node) decidem a página atual, as etapas da página e o que zerar ao trocar de página; `taxonomia.js` ganha o vínculo página → material e página → personas; `crm.js` só desenha e liga os eventos. Nenhum campo novo em `para_quem`, nenhum SQL, nenhum Worker.

**Tech Stack:** JS puro em módulos ES (sem build), testes `node` com `check()` no estilo de `db/testes/crm-editor-quem.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-14-crm-quem-cascata-design.md`

## Global Constraints

- Sem dependência nova, sem build, sem framework (site público estático).
- Nenhuma mudança em SQL, em `cms-oauth-worker` nem em `para_quem` além dos campos que já existem (`materiais`, `etapas`, `personas`).
- Texto da tela em português, sem travessão, tom direto ("Quem", "Quando", "Hoje").
- Todo texto vindo de dados passa por `esc()` antes de entrar em HTML.
- Os módulos `taxonomia.js` e `editor-quem.js` continuam puros (sem DOM, sem `import`).
- Caminhos relativos a `admin/crm/`. Testes: `cd admin/crm/db/testes && node crm-editor-quem.test.mjs`.

## Review Focus

- `para_quem.materiais` com dois valores ou token desconhecido: não quebra, mostra o texto antigo e permite escolher página.
- Trocar de página com etapas de outra página marcadas: as etapas e personas antigas somem e a tela diz o que voltou para "qualquer".
- Página sem etapa filtrável (I02, I04): nenhum controle de etapa vazio e clicável, e escolher a página não grava `etapas`.
- Persona não é aplicada sozinha ao escolher a página (senão o Worker corta quem entrou com outra persona).
- Modelo antigo (sem `criado_no_estudio`) continua exatamente como está.

---

### Task 1: Página sabe seu material e suas personas

**Files:**
- Modify: `taxonomia.js:23-58` (`PAGINAS`)
- Test: `db/testes/crm-editor-quem.test.mjs`

**Interfaces:**
- Produces: cada item de `PAGINAS` ganha `material: string` e `personas: string[]`.
  Valores: I01 `'guia-email-alt30'`, `['alternancia_emprego']`; I02 `'guia-tecnologo'`, `[]`; I03 `'guia-etudes-en-france-2027'`,
  `['campus_france']`; I04 `'guia-vls-ts'`, `[]`; I05 `'guia-checklist-chegada-au-pair'`, `['au_pair_estudante']`.

- [ ] **Step 1: Write the failing test** (no fim de `crm-editor-quem.test.mjs`, antes do `if (falhas)`; adicionar `import { PAGINAS } from '../../taxonomia.js';` no topo)

```js
var pg = function (k) { return PAGINAS.filter(function (p) { return p.k === k; })[0]; };
check('I01 liga ao guia alt30 e à persona alternancia_emprego', pg('I01').material === 'guia-email-alt30' && pg('I01').personas.join() === 'alternancia_emprego');
check('I03 liga ao Campus France', pg('I03').material === 'guia-etudes-en-france-2027' && pg('I03').personas.join() === 'campus_france');
check('I05 liga ao au pair', pg('I05').material === 'guia-checklist-chegada-au-pair' && pg('I05').personas.join() === 'au_pair_estudante');
check('I02 e I04 sem persona', pg('I02').personas.length === 0 && pg('I04').personas.length === 0 && pg('I02').material === 'guia-tecnologo' && pg('I04').material === 'guia-vls-ts');
check('todo material é único', new Set(PAGINAS.map(function (p) { return p.material; })).size === PAGINAS.length);
```

- [ ] **Step 2: Run** `cd admin/crm/db/testes && node crm-editor-quem.test.mjs`. Expected: FALHA nas 5 linhas novas (campos `undefined`).
- [ ] **Step 3: Implement** os dois campos em cada item de `PAGINAS` com os valores acima; atualizar o comentário do topo de `taxonomia.js` dizendo que `material` espelha o token de origem de `ORIG` em `crm.js`.
- [ ] **Step 4: Run** o mesmo comando. Expected: todas `ok`, sem `FALHA`.
- [ ] **Step 5: Commit** `git add admin/crm/taxonomia.js admin/crm/db/testes/crm-editor-quem.test.mjs && git commit -m "feat(crm): página de inbound sabe seu material e suas personas"`

### Task 2: Funções puras da cascata

**Files:**
- Modify: `editor-quem.js` (acrescentar no fim)
- Test: `db/testes/crm-editor-quem.test.mjs`

**Interfaces:**
- Consumes: `PAGINAS` (Task 1) passado como argumento `paginas`; `ES.ETAPAS_FILTRO` passado como `etapasFiltro: Array<[codigo, rotulo]>`.
- Produces (todas exportadas de `editor-quem.js`):
  - `paginaAtual(para: object, paginas: Array): string | null` — `k` da página cujo `material` é o **único** valor de `para.materiais`; senão `null`.
  - `etapasDaPagina(pagina: object | null, etapasFiltro: Array): Array<[string, string]>` — itens de `etapasFiltro` cujo código está em `pagina.etapas` (`[codigo, rotulo]`), na ordem de `pagina.etapas`; `[]` se `pagina` é nula.
  - `aplicarPagina(para: object, k: string | null, paginas: Array): { para: object, limpou: string[] }` — cópia sem mutar. `k` conhecida: `materiais = [material]`; `etapas` e `personas` removidas se tinham valor, e `limpou` recebe `'etapa'` e/ou `'persona'`; se a página já era a atual, devolve a cópia igual e `limpou = []`. `k` nula ou desconhecida: remove `materiais`, `etapas` e `personas` (`limpou` igual). Demais chaves (`estagios`, `segmentos`, `produto`…) intactas; chaves de lista vazia não aparecem.
  - `fraseCascata(m: object, paginas: Array, rot: { material: Function, etapa: Function, persona: Function }): { pagina: string, personas: string | null, etapas: string, novidades: boolean }` — `pagina`: `k · nome` da página atual, ou os materiais soltos juntos por " ou " via `rot.material`, ou `'qualquer página'`; `personas`: `null` se não há página atual ou ela não tem personas, senão as marcadas via `rot.persona` ou `'qualquer persona'`; `etapas`: marcadas via `rot.etapa` ou `'qualquer resposta'`; `novidades`: `m.tipo === 'novidades'`.

- [ ] **Step 1: Write the failing test** (importar também `paginaAtual, etapasDaPagina, aplicarPagina, fraseCascata`; `ETAPAS` abaixo vem de `import { ETAPAS_FILTRO } from '../../estudio.js'` — se esse import não funcionar em Node puro, usar a lista literal `[['alt-pesquisando','Alternância 30+: Pesquisando'],['ap-travado','Au pair: Um passo travado']]` e ledgar a decisão)

```js
var P = PAGINAS, EF = [['alt-pesquisando', 'Alternância 30+: Pesquisando'], ['ap-travado', 'Au pair: Um passo travado']];
check('paginaAtual: um material conhecido', paginaAtual({ materiais: ['guia-email-alt30'] }, P) === 'I01');
check('paginaAtual: dois materiais = nenhuma', paginaAtual({ materiais: ['guia-email-alt30', 'guia-vls-ts'] }, P) === null);
check('paginaAtual: token desconhecido = nenhuma', paginaAtual({ materiais: ['instagram'] }, P) === null);
check('paginaAtual: sem regra = nenhuma', paginaAtual({}, P) === null);
check('etapasDaPagina só as filtráveis', etapasDaPagina(P[0], EF).map(function (e) { return e[0]; }).join() === 'alt-pesquisando');
check('etapasDaPagina I02 vazia', etapasDaPagina(P[1], EF).length === 0 && etapasDaPagina(null, EF).length === 0);
var a = aplicarPagina({ materiais: ['guia-vls-ts'], etapas: ['ap-travado'], personas: ['campus_france'], estagios: ['lead'] }, 'I01', P);
check('aplicarPagina grava material, zera etapa e persona', a.para.materiais.join() === 'guia-email-alt30' && !a.para.etapas && !a.para.personas && a.para.estagios.join() === 'lead' && a.limpou.join() === 'etapa,persona');
var b = aplicarPagina({ materiais: ['guia-email-alt30'], etapas: ['alt-pesquisando'] }, 'I01', P);
check('mesma página: nada é zerado', b.para.etapas.join() === 'alt-pesquisando' && b.limpou.length === 0);
var orig = { materiais: ['guia-vls-ts'], etapas: ['x'] }; aplicarPagina(orig, 'I03', P);
check('não muda o original', orig.materiais.join() === 'guia-vls-ts' && orig.etapas.join() === 'x');
var c = aplicarPagina({ materiais: ['guia-vls-ts'], etapas: ['x'] }, null, P);
check('sem página limpa tudo', !c.para.materiais && !c.para.etapas && c.limpou.join() === 'etapa');
var rot = { material: function (x) { return 'M' + x; }, etapa: String, persona: function (x) { return 'P' + x; } };
var f1 = fraseCascata({ tipo: 'novidades', para_quem: { materiais: ['guia-checklist-chegada-au-pair'] } }, P, rot);
check('frase com página e persona disponível', f1.pagina === 'I05 · Au pair · checklist de chegada' && f1.personas === 'qualquer persona' && f1.etapas === 'qualquer resposta' && f1.novidades === true);
var f2 = fraseCascata({ para_quem: { materiais: ['instagram', 'blog'] } }, P, rot);
check('frase com materiais soltos', f2.pagina === 'Minstagram ou Mblog' && f2.personas === null);
var f3 = fraseCascata({ para_quem: {} }, P, rot);
check('frase vazia', f3.pagina === 'qualquer página' && f3.personas === null);
var f4 = fraseCascata({ para_quem: { materiais: ['guia-etudes-en-france-2027'], personas: ['campus_france'] } }, P, rot);
check('frase com persona marcada', f4.personas === 'Pcampus_france');
check('estimar continua igual com a regra da página', estimar(C, { para_quem: aplicarPagina({}, 'I01', P).para }, org).n === 0);
```

- [ ] **Step 2: Run** `node crm-editor-quem.test.mjs`. Expected: erro de import (funções não exportadas).
- [ ] **Step 3: Implement** as quatro funções em `editor-quem.js`, reaproveitando o helper `lista`. Sem `import`, sem DOM.
- [ ] **Step 4: Run** o mesmo comando. Expected: todas `ok`; os 7 checks antigos continuam `ok`.
- [ ] **Step 5: Commit** `git add admin/crm/editor-quem.js admin/crm/db/testes/crm-editor-quem.test.mjs && git commit -m "feat(crm): funções puras da cascata página → persona → etapa"`

### Task 3: Tela em três linhas com a cascata

**Files:**
- Modify: `crm.js:8` (versão do import de `editor-quem.js`), `crm.js:3452-3478` (`passoQuem`), `crm.js:4760` e `crm.js:4785-4790` (eventos)
- Test: `db/testes/crm-editor-quem.test.mjs` (checagem de fonte) e conferência manual abaixo

**Interfaces:**
- Consumes: `EQ.paginaAtual`, `EQ.etapasDaPagina`, `EQ.aplicarPagina`, `EQ.fraseCascata` (Task 2); `TX.PAGINAS` (Task 1); `ES.ETAPAS_FILTRO`; `salvarModelo(patch, msg)`, `paraResumo`, `esc`, `origLabel`, `PERSONAS` (todos já em `crm.js`).
- Produces: nenhum novo contrato; o evento novo é `change` em `input[data-qpagina]` (radio, valor = `k` da página ou `''` para "qualquer página").

- [ ] **Step 1: Write the failing test** (em `crm-editor-quem.test.mjs`, lendo `crm.js` como texto, para travar a ligação sem precisar de DOM)

```js
import { readFileSync } from 'node:fs';
var fonte = readFileSync(new URL('../../crm.js', import.meta.url), 'utf8');
check('passoQuem usa a cascata', /EQ\.fraseCascata\(/.test(fonte) && /EQ\.etapasDaPagina\(/.test(fonte));
check('linhas Quem, Quando e Hoje', /<b>Quem:<\/b>/.test(fonte) && /<b>Quando:<\/b>/.test(fonte) && /<b>Hoje:<\/b>/.test(fonte));
check('troca de página usa aplicarPagina', /data-qpagina/.test(fonte) && /EQ\.aplicarPagina\(/.test(fonte));
check('import de editor-quem com versão nova', !/editor-quem\.js\?v=2026-11-13\.11/.test(fonte));
```

- [ ] **Step 2: Run** `node crm-editor-quem.test.mjs`. Expected: FALHA nas 4 linhas.
- [ ] **Step 3: Implement** em `passoQuem` (só o ramo `novoM`; o ramo de modelo antigo e `avancado` ficam como estão):
  - Três linhas: `<p class="ee-frase"><b>Quem:</b> …</p>`, `<p class="ee-frase"><b>Quando:</b> chip('sai', …)</p>`, e o contador atual com o rótulo `<b>Hoje:</b>` e a palavra "elegíveis" no lugar de "pessoas recebem este e-mail hoje".
  - Chips de Quem: `pag` (texto `fr.pagina`, vazio se "qualquer página"), `persona` só se `fr.personas !== null`, `etapa` só como botão quando `EQ.etapasDaPagina(...)` tem itens ou não há página; se há página e a lista é vazia, `<span class="ee-ch fixo">qualquer resposta</span>` sem botão. "aceitou novidades" continua `ee-ch fixo` só para `m.tipo === 'novidades'`.
  - Popovers: `pag` = lista de radios `data-qpagina` ("Qualquer página" + `TX.PAGINAS`); `persona` = checkboxes `data-pq="personas"` só com as personas da página (rótulo de `PERSONAS`); `etapa` = checkboxes `data-pq="etapas"` só com `EQ.etapasDaPagina(...)` quando há página, ou `ES.ETAPAS_FILTRO` quando não há.
  - Evento `change` de `[data-qpagina]`: `var r = EQ.aplicarPagina(modeloAtual().para_quem || {}, e.target.value || null, TX.PAGINAS)`; `salvarModelo({ para_quem: r.para, quem_recebe: paraResumo({ tipo, para_quem: r.para }) }, 'Para quem salvo' + (r.limpou.length ? ' · ' + r.limpou.join(' e ') + ' voltou para qualquer' : ''))`.
  - Trocar `?v=2026-11-13.11` do import de `editor-quem.js` por `?v=2026-11-14.1`; conferir se `taxonomia.js` é importado com `?v=` e, se for, subir também.
- [ ] **Step 4: Run** `node crm-editor-quem.test.mjs && node --check ../../crm.js`. Expected: todas `ok`, sem saída de erro do `--check`.
- [ ] **Step 5: Verificar no navegador** (se o harness permitir carregar `crm.js` com Supabase simulado, com 380px de largura; senão, ledgar "tela não conferida em navegador" e listar na entrega): abrir um modelo criado no estúdio, passo 1; conferir as três linhas, trocar a página e ver o aviso do que voltou para "qualquer", e I02 sem controle de etapa.
- [ ] **Step 6: Commit** `git add admin/crm/crm.js admin/crm/db/testes/crm-editor-quem.test.mjs && git commit -m "feat(crm): passo Quem recebe e quando em cascata, começando pela página"`

### Task 4: Suíte, registro e entrega

**Files:**
- Modify: `admin/crm/db/testes/package.json` (nada, o script `test:editor-quem` já existe), `docs/superpowers/specs/2026-11-14-crm-quem-cascata-design.md` (só se houver ruling)

- [ ] **Step 1: Run** `cd admin/crm/db/testes && node crm-editor-quem.test.mjs && node crm-taxonomia-modelos.test.mjs && node crm-filtro-etapa.test.mjs && node crm-estudio-blocos.test.mjs`. Expected: sem `FALHA` em nenhum. Os testes que dependem de PGlite/`npm install` e do `APP_DB_DIR` ficam de fora (não tocam o que mudou) e isso vai no relatório.
- [ ] **Step 2: Commit** só se algo mudou no spec; depois `git push -u origin claude/elegant-goodall-36wfof`.
