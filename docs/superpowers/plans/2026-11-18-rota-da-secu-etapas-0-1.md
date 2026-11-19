# Rota da Sécu, etapas 0 e 1: plano de execução

> **Para quem executa:** REQUIRED SUB-SKILL: superpowers:executing-plans (recomendado: as tarefas 1.1 a 1.4 compartilham `casos.js` e os nomes de variáveis) ou superpowers:subagent-driven-development. Passos com `- [ ]`.
>
> **Status: aguardando aprovação da Ingryd. Nada deste plano foi construído, commitado ou rodado em banco.**

**Objetivo:** abrir o caminho do comentário AMELI até a página interativa Rota da Sécu: bancos prontos (etapa 0) e a primeira entrega no ar em rascunho (etapa 1: página, dois e-mails novos, ManyChat, teste ponta a ponta).

**Arquitetura:** a página é estática em `guias/rota-da-secu/` neste repositório público e chama a função de captura que já existe (`capturar_lead_guia`). O texto dos 20 casos mora em **um** módulo (`casos.js`), lido pela página e pelo gerador dos e-mails, para que página e e-mail digam a mesma coisa. Os e-mails são modelos novos do Estúdio (`saude_rota_1`, `saude_rota_2`), em rascunho e com Envio desligado, montados pelo Worker com variáveis novas.

**Stack:** HTML/CSS/JS estático (ES modules, sem build), testes `node *.test.mjs` (PGlite) em `admin/crm/db/testes` e `cms-oauth-worker/testes`, Playwright (já instalado) para o navegador.

**Spec:** a proposta aprovada (https://claude.ai/artifact/AbktaJ3XQf1VPt8rZNJGUn, abas "A página", "No CRM", "Os 20 casos") e a análise (https://claude.ai/artifact/99DRzk3Jkru7QLsEXSe3TX); skills `inbound-jornada`, `rota-por-persona`, `crm-ficha`, `landing-guia` na branch `claude/friendly-faraday-uwant7` do `instagram-hub`.

## Restrições globais

- Repositório do site é **público**: sem dado pessoal, sem caso real, sem segredo. Fixtures com gente inventada.
- **Isolamento entre clientes** (CLAUDE.md do site): este plano **não cria tabela nem função**. Se um passo pedir, parar e voltar ao desenho. Os SQLs rodam primeiro no Supabase de **teste**, depois no de **produção**; depois de cada um, nos dois bancos: `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` (do app), **os dois têm de voltar vazios**.
- Quem roda SQL é a Ingryd. Não commitar, não fazer push, não abrir PR, não ligar o Envio sem ela pedir. (Os passos "Commit" abaixo só valem depois do pedido dela.)
- Slug `rota-da-secu`; chaves `saude_rota_1` e `saude_rota_2`; origem `guia-rota-da-secu`. Cidadania europeia fora. Sem preço. Acompanha, não representa. Rodapé: "Baseado em fontes públicas. Não sou advogada."
- E-mails **novos**: nada de `modelo-mapa-saude.mjs` além da mecânica. **Não rodar** `crm-modelos-mapa-saude.sql`, `crm-guia-mapa-saude-link.sql` nem `crm-pagina-i06.sql` (este depende dos modelos do Mapa).
- Texto: PT-BR, primeira pessoa, **sem travessão, sem marca de gênero, sem "sempre"**. Toda afirmação legal tem fonte oficial datada ou vira pergunta/"confirme". Francês é apoio e vai marcado "revisar antes de ir ao ar".
- **Nenhum texto de e-mail pode ter `[trecho entre colchetes]`**: `crmMontarNovo` (cms-oauth-worker/worker.js) recusa o envio. Placeholders viram `(data)`, `(nome)`.
- Link oficial: hiperlink simples, verde-floresta, dentro de uma frase que começa por ele. Botão cheio só para abrir o roteiro. Cores/vidro de `landing-guia` (`#F4F1EC`, `#063B35`, `#577328`).
- Branch de trabalho: `claude/zealous-rubin-o5t1fk` (site e app). Testes de CI rodam **todo** `admin/crm/db/testes/*.test.mjs` e `cms-oauth-worker/testes/*.test.mjs`.

## Revisão (o que o desenho implica e nenhuma tarefa cobre sozinha)

1. **Texto com `[colchetes]`** (a proposta usa `[data]`, `[date]`, `[nom]`): a página aceita, o Worker recusa o e-mail. Esperado: nenhum caso tem colchetes. Teste em 1.1 e 1.3.
2. **Lead sem porta/ponto válidos** (cadastro antigo ou valor fora da lista): `crmVarsSaude` o trata como porta `outro` e ponto vazio, então nenhum dos 20 blocos acende e o e-mail sairia sem roteiro. Esperado: um bloco de reserva (`caso_geral`) com o lembrete, o link da página e a oferta. Teste em 1.4.
3. **Segundo cadastro com respostas diferentes** (decidido em 18/11: o comportamento da proposta, reenviar o e-mail e guardar o histórico, **fica para a etapa 2**). Hoje `crm_sequencia_pendentes` só manda um modelo uma vez por pessoa (`not exists ... emails_enviados`) e `capturar_lead_guia` **sobrescreve** `respostas.porta/ponto`. Na etapa 1 o comportamento é esse, **documentado e testado, sem alterar**: a página mostra o roteiro novo, o e-mail 1 não é reenviado e a resposta antiga se perde. Teste em 1.5.
4. **Quem abre o link do e-mail em outro aparelho** não tem `localStorage` e veria o portão de novo. Esperado: o "Voltar à página" leva porta, ponto e `aberto=1` e abre o roteiro direto (portão suave, o conteúdo já está no script). Teste em 1.2.
5. **Rede ou Supabase fora, `localStorage` bloqueado, duplo clique, honeypot preenchido:** mensagem de erro, botão volta, nada de duplicar cadastro, página funciona sem armazenamento. Teste em 1.2.

---

# ETAPA 0: destravar

### Task 0.1: Roteiro dos SQLs (teste, depois produção) e as auditorias

**Files:**
- Read: `admin/crm/db/crm-sequencia-minutos.sql`, `admin/crm/db/crm-saude-porta-ponto.sql`
- Read: `/POR-DENTRO-APP/db/auditoria-isolamento.sql`, `/POR-DENTRO-APP/db/conferir-banco.sql`
- Test: `admin/crm/db/testes/crm-sequencia-minutos.test.mjs`, `admin/crm/db/testes/crm-modelos-mapa-saude.test.mjs` (este exercita `crm-saude-porta-ponto.sql`; só o trecho dos SQLs, não os modelos do Mapa), sentinela do app

**Interfaces:**
- Produces: um quadro de execução (abaixo) que a Ingryd segue; ao fim, os bancos de teste e produção têm `modelos_email.envio_minutos` e as duas funções com porta/ponto. O S3 (`crm-modelos-rota-da-secu.sql`) é gerado na 1.3 e roda **na etapa 1**, depois de revisado.

Fatos verificados no repositório: `crm-saude-porta-ponto.sql` é a definição **mais recente** de `capturar_lead_guia` e `crm_sequencia_pendentes` (as anteriores estão em `crm-fase0-email-guia.sql` e `crm-sequencia-minutos.sql`), então rodá-lo não desfaz nada mais novo. Os dois SQLs se declaram idempotentes (`create or replace`, `if not exists`) e só mexem em coluna/regra/função, sem tabela nova.

- [ ] **Step 1: Pré-voo do meu lado, antes de entregar à Ingryd.** Rodar `cd admin/crm/db/testes && npm ci && APP_DB_DIR=/home/user/POR-DENTRO-APP/db node crm-sequencia-minutos.test.mjs && APP_DB_DIR=/home/user/POR-DENTRO-APP/db node crm-modelos-mapa-saude.test.mjs` e `cd /home/user/POR-DENTRO-APP/db/testes && npm ci && npm test`. Esperado: tudo verde (sentinela `isolamento.test.mjs` incluso). Vermelho = os SQLs não vão para ela; reportar o que falhou.
- [ ] **Step 2: Entregar o quadro abaixo à Ingryd** (no chat, com os dois arquivos). Ordem: **teste inteiro, depois produção inteira**.

| # | Banco | O que rodar | Conferir logo depois | Se falhar |
|---|---|---|---|---|
| 1 | Teste | `crm-sequencia-minutos.sql` (se a coluna já existir, rodar de novo é seguro; antes dele, o próprio cabeçalho pede `crm-filtro-etapa.sql`) | `select pg_get_constraintdef(oid) from pg_constraint where conname = 'modelos_email_envio_check';` deve conter `envio_minutos` | Erro citando relação/coluna que não existe = falta o pré-requisito do cabeçalho: parar, copiar a mensagem inteira. Não rodar o 2 |
| 2 | Teste | `crm-saude-porta-ponto.sql` | `select pg_get_functiondef('public.capturar_lead_guia(jsonb)'::regprocedure) like '%aupair%';` = `true` e o mesmo para `public.crm_sequencia_pendentes(int, timestamptz)` com `'porta'` | Erro: parar. Reexecutar é seguro. Para desfazer, os cabeçalhos dizem que trecho das versões antigas rodar de novo |
| 3 | Teste | `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` do app | **os dois vazios** | Qualquer linha: **não ir à produção**; mandar as linhas. Nunca afrouxar o sentinela |
| 4 | Teste | (opcional, só no teste) uma chamada de captura com um e-mail de teste e `"respostas":{"porta":"aupair","ponto":"esperando"}`, depois `select respostas from contatos where email = '<o de teste>'` | `respostas` traz `porta` e `ponto` | Vazio = o 2 não valeu: rodar o 2 de novo e olhar a mensagem |
| 5 | Produção | `crm-sequencia-minutos.sql`, `crm-saude-porta-ponto.sql` (mesmas conferências do 1 e do 2; **sem** o passo 4: não criar contato na produção só para testar) | igual | igual |
| 6 | Produção | as duas auditorias | **os dois vazios** | Linha: parar, mandar |

- [ ] **Step 3: Esperar o "rodei e voltou vazio" dela, por banco**, antes da 1.3 (S3). Registrar a data no Notion (Insights), como ela preferir.

**Depende da Ingryd:** rodar, colar o resultado das conferências, dizer quando os dois bancos estão fechados.

### Task 0.2: Frase final do Reel e palavra do comentário

**Files:**
- Modify (no `instagram-hub`, **só depois da escolha dela**): `cerebro-fontes/posts/X-0075.md` (campos `palavra_dm` e `cta`); `X-0075` é o candidato a Reel 1 ("Saúde na França: como funciona o sistema") e hoje diz `palavra_dm: SECU` e promete "o link da página com o formulário do governo, **o mapa da saúde e o checklist de documentos**". Isso contradiz a decisão (palavra AMELI; Mapa e freebie fora). **Confirmar com ela que o Reel 1 é o X-0075.**

**Interfaces:**
- Produces: a frase final aprovada, usada igual no Reel, na legenda e na DM (1.6).

- [ ] **Step 1: Propor duas frases**, as duas prometendo só o que a página entrega (link oficial primeiro; duas perguntas; roteiro do caso depois do e-mail; sem mapa, sem checklist, sem "grátis" que prometa mais):
  - A: "Comenta AMELI que eu te mando por DM a página: ela abre pelo link oficial e monta o roteiro do seu caso em duas perguntas."
  - B: "Comenta AMELI e eu te mando o link oficial e o roteiro passo a passo do seu caso."
- [ ] **Step 2: Conferir cada promessa contra a página pronta (1.2)** numa lista de três itens: o link oficial aparece primeiro? o roteiro do caso abre depois do e-mail? nada prometido que a página não tenha? Reprovar a frase que falhar.
- [ ] **Step 3: Depois da escolha, atualizar `X-0075.md` e rodar o validador do hub** (`node scripts/validar-pacote.mjs` só se houver pacote de captação para o post; senão o validador padrão do `instagram-hub`).

**Depende da Ingryd:** escolher/editar a frase; confirmar qual post é o Reel 1.

### Task 0.3: Destino dos arquivos do Mapa (decisão dela)

**Files (listar, não apagar sem ordem):**
- `admin/crm/db/modelo-mapa-saude.mjs`, `crm-modelos-mapa-saude.sql`, `crm-guia-mapa-saude-link.sql`, `crm-pagina-i06.sql`, `testes/crm-modelos-mapa-saude.test.mjs` (+ script `test:saude` em `testes/package.json`)
- Referências vivas: `cms-oauth-worker/worker.js` (`SAUDE_GUIA_DO_MODELO`, `SAUDE_ASSUNTO`), `cms-oauth-worker/testes/crm-saude-s2.test.mjs` (importa `D1, D2` do Mapa), `admin/crm/estudio.js:91-92`, `admin/crm/taxonomia.js:59,120-121`, `admin/crm/crm.js` (rótulos `guia-mapa-saude-franca`)

- [ ] **Step 1: Entregar a ela as duas opções com o custo de cada.** (a) **Manter por ora, sem rodar**: zero risco, mas o teste do Mapa e o do Worker continuam importando o Mapa e a CI continua dependendo dele. (b) **Apagar**: some o Mapa, mas obriga a mexer em Worker, estúdio, taxonomia e crm.js e a mover `crmVarsSaude`/`porta_*`/`ponto_*` (que a Rota **reaproveita**) para fora do nome "S2 do Mapa". Recomendação: **(a) nesta entrega, (b) em PR próprio depois**, porque o Worker compartilha `crmVarsSaude` e apagar junto com a primeira entrega mistura dois riscos.
- [ ] **Step 2: Registrar a decisão** (frase curta) e, se (b), abrir como tarefa nova com a lista acima.

**Depende da Ingryd:** escolher (a) ou (b).

---

# ETAPA 1: primeira entrega

Ordem de dependência: 1.1 (texto) → 1.2 (página) e 1.3 (e-mails) e 1.4 (Worker) → 1.5 (CRM) → 1.6 (ManyChat) → 1.7 (ponta a ponta). A 1.2 só precisa do `casos.js`; a 1.3 e a 1.4 se testam uma contra a outra.

### Task 1.1: `casos.js`, o texto dos 20 casos, com fonte

**Files:**
- Create: `guias/rota-da-secu/casos.js`
- Test: `admin/crm/db/testes/rota-da-secu-casos.test.mjs`

**Interfaces:**
- Produces (módulo ES, funciona no navegador e no Node, sem dependências):
  - `PORTAS: { id: 'estudante'|'trabalho'|'aupair'|'outro', rot: string, desc: string }[]`
  - `PONTOS: { id: 'nao_cheguei'|'sem_numero'|'esperando'|'sem_vitale'|'completo', rot: string, curto: string }[]`
  - `FONTES: Record<string, { rot: string, data: string, url: string }>`
  - `OFICIAL: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R45084'`
  - `caso(porta: string, ponto: string): { tipo: string, primeiro: string, passos: { t: string, x: string, fr?: string }[], fontes: string[] }` (lança `Error` para valor fora das listas)

- [ ] **Step 1: Passada de fatos primeiro** (regra 4 de `rota-por-persona`, com `.claude/skills/reel/correcoes.md`). Abrir cada página oficial citada em `FONTES` (service-public R45084, ameli estudante estrangeiro, ameli nascido no exterior, Urssaf, Puma, 3646, carte Vitale, médecin traitant/Cerfa 12485, C2S) e conferir **cada número e prazo do texto** da proposta: Cerfa S1106, 3 meses sem atividade, 8 dias da declaração à Urssaf, 2 e 3 semanas da carte vitale, 19 € e 8,40 € em consulta de 30 €, C2S de 0 a 30 €/mês. Registrar a data de conferência em `FONTES[k].data`. O que não tiver página oficial **vira pergunta ("confirme com o 3646")**; as pendências conhecidas (tetos da C2S, ALD 31, mutuelle de empresa, F675, Mon espace santé, médecin traitant online, se NIA/PVT declara médecin traitant, se au pair substitui o S1106) ficam **fora** ou com "confirme". Se a rede da sessão bloquear o site oficial, **parar e pedir à Ingryd** os prints/PDFs; não escrever de memória.
- [ ] **Step 2: Escrever o teste que falha** (`rota-da-secu-casos.test.mjs`), com estas asserções:
  - 4 × 5 combinações, `caso(p,q)` devolve `primeiro` não vazio, `passos.length >= 1`, `fontes.length >= 1`
  - toda chave de `fontes` existe em `FONTES` com `data` no formato `DD/MM/AAAA` e `url` começando por `https://` de host terminado em `.gouv.fr`, `ameli.fr` ou `urssaf.fr`
  - nenhum texto contém `—`, `–`, `[`, `]`, a palavra `sempre`, nem `Estudante(a)`/`(a)` (marca de gênero)
  - `caso('estudante', 'sem_numero').primeiro` menciona `etudiant-etranger.ameli.fr`
  - `caso('x', 'esperando')` lança `Error`
  - `caso(...)` só devolve frase em francês (`fr`) onde o par tem `fr`; todas as frases em francês passam em `typeof === 'string'` (o rótulo "revisar" é da página, não do dado)
- [ ] **Step 3: Rodar e ver falhar** (`node admin/crm/db/testes/rota-da-secu-casos.test.mjs`; esperado: módulo não encontrado).
- [ ] **Step 4: Implementar `casos.js`** partindo da função `caso(p, q)` e das constantes da proposta (`PORTAS`, `PONTOS`, `FT`, `FR_*`, `EC`), já corrigidas no passo 1; trocar `FT` por `FONTES` com `url`; trocar todo `[data]`/`[nom]` por `(data)`/`(nome)`.
- [ ] **Step 5: Rodar o teste e ver passar.**
- [ ] **Step 6: Commit (só se ela pedir):** `feat(guias): casos e fontes da Rota da Sécu`.

**Depende da Ingryd:** prints/PDFs oficiais se a rede bloquear; **revisão do francês por quem fala francês** antes de ir ao ar; ler o `casos.js` final.

### Task 1.2: A página `guias/rota-da-secu/index.html`

**Files:**
- Create: `guias/rota-da-secu/index.html`
- Reference (copiar a casca, não reescrever): `guias/checklist-chegada-au-pair/index.html` (cabeçalho, rodapé, cookies, `supabase`, `track`, `lsSet`, anti-spam)
- Reference visual: o HTML da proposta (`/root/.claude/projects/-home-user/6bcba7b6-cd86-5bd2-b45f-f9146a576cab/tool-results/artifact-4dbc9574-1795029905-1403.html`) para o markup das abas "A página" (celular e computador)

**Interfaces:**
- Consumes: `import { PORTAS, PONTOS, FONTES, OFICIAL, caso } from './casos.js'` (1.1)
- Produces: o `payload` enviado a `capturar_lead_guia` (RPC existente), exatamente:
  `{ guia: 'rota-da-secu', email, nome, origem: 'guia-rota-da-secu', respostas: { porta, ponto }, aceita_servico: true, aceita_novidades: boolean, consentimento_versao, texto_servico, texto_novidades, utm_source?, utm_medium?, utm_campaign?, utm_content?, ig? }`
  (sem `persona`: nenhuma das 5 aceitas pelo CRM descreve "saúde", e valor fora da lista é descartado; ver pergunta 9)
- Produces: parâmetros de URL lidos ao abrir: `utm_*`, `ig`, e (para o "Voltar à página" do e-mail, 1.4) `porta`, `ponto`, `aberto=1`

- [ ] **Step 1: Escrever o roteiro de verificação** (Playwright, script no scratchpad, **não commitado**), cópia adaptada de `/.claude/skills/landing-guia/verificar.cjs` (a original testa pílulas arrastáveis que a Rota não tem). Asserções, em **390 px e em 1280 px**, com `route` simulando `/assets/js/supabase-client.js` e abortando o resto da rede:
  - sem rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`), sem erro de JS
  - **sem JavaScript** o link oficial continua na tela (está no HTML estático, não renderizado por script)
  - link oficial vem **antes** das perguntas e é `<a>` simples; o aviso "Estudante? ... etudiant-etranger.ameli.fr" está junto dele
  - as 20 combinações (loop): escolher porta e ponto mostra o primeiro passo e a fonte, **sem** abrir o roteiro; nenhuma estoura a largura
  - cadastro: nome vazio, e-mail inválido, aceite desmarcado e honeypot preenchido não chamam o RPC; envio válido chama o RPC **uma vez** (duplo clique não duplica) com o `payload` acima, e `utm_*`/`ig` da URL presentes
  - após o cadastro o roteiro abre na página (mesmos passos de `caso(p,q)`), o botão "Copiar frase" copia o francês e o aviso "revisar" aparece
  - RPC com erro: mensagem de erro, botão reabilitado, roteiro **fechado**
  - `localStorage` lançando exceção: a página ainda abre o roteiro em memória
  - abrir `?porta=aupair&ponto=esperando&aberto=1` mostra o roteiro direto, sem portão
  - altura medida do topo ao portão em 390 px: meta de 2,5 a 3 mil px (regra 8 de `inbound-jornada`), registrar o número
- [ ] **Step 2: Rodar e ver falhar** (a página não existe).
- [ ] **Step 3: Implementar a página.** Estrutura da proposta: eyebrow + título; bloco oficial (frase que começa pelo link, `target="_blank" rel="noopener"`); fieldset "1. Qual é a sua situação?" e "2. Em que ponto você está?" (radios em pílula de vidro); bloco "O seu primeiro passo" com fonte; portão (nome, e-mail, aceite, novidades opcional, honeypot e atraso mínimo de 2,5 s como na página do checklist); depois do cadastro, roteiro + bloco de oferta; rodapé "Baseado em fontes públicas. Não sou advogada." Guardar no `localStorage` **só** `{ ok, porta, ponto }` (nunca nome nem e-mail). Chamar `track(...)` como a página do checklist, com `utm_campaign`. **Etapa 1 não tem o formulário de pedido de orçamento** (é a etapa 2): o bloco "Prefere ter alguém com você?" lista as três opções, sem preço, e termina num único botão (ver pergunta 6 para o destino). Sem `persona` no payload.
- [ ] **Step 4: Rodar o roteiro de verificação e ver passar; olhar os PNGs** (390 e 1280, antes e depois do cadastro) e enviá-los à Ingryd com `SendUserFile`.
- [ ] **Step 5: Commit (só se ela pedir):** `feat(guias): página Rota da Sécu`.

**Depende da Ingryd:** aprovar os PNGs; responder as perguntas 4 e 6.

### Task 1.3: Os dois e-mails novos, gerados em rascunho

**Files:**
- Create: `admin/crm/db/modelo-rota-da-secu.mjs`
- Create (gerado, não escrito à mão): `admin/crm/db/crm-modelos-rota-da-secu.sql`
- Test: `admin/crm/db/testes/crm-modelos-rota-da-secu.test.mjs` (molde: `crm-modelos-mapa-saude.test.mjs`, só a mecânica)
- Modify: `admin/crm/db/testes/package.json` (script `"test:rota": "node crm-modelos-rota-da-secu.test.mjs"`)

**Interfaces:**
- Consumes: `caso`, `PORTAS`, `PONTOS`, `OFICIAL` de `guias/rota-da-secu/casos.js` (1.1); `ES.objetivo`, `ES.montar`, `ES.varsDoModelo` de `admin/crm/estudio.js`
- Produces: `export const SLUG = 'rota-da-secu'`, `ORIGEM = 'guia-rota-da-secu'`, `CHAVE_1 = 'saude_rota_1'`, `CHAVE_2 = 'saude_rota_2'`, `D1`, `D2` (blocos do Estúdio), `gerar(): string` (o SQL)
- Produces: **variáveis que o Worker precisa oferecer** (1.4): `caso_<porta>_<ponto>` (20 booleanos), `caso_geral` (boolean), `assunto_rota` (texto), `link_pagina` (link). A condição de bloco do Estúdio é **uma variável só** (`#x` ou `^x`, `estudio.js:261`), por isso um booleano por combinação.

Desenho do **E-mail 1** (tipo `servico`, gatilho `material` = origem, 5 minutos depois do cadastro, como o Mapa; serve a 4 portas × 5 pontos):

| Bloco | Conteúdo | Condição |
|---|---|---|
| Assunto e prévia | `{assunto_rota}` (por porta, 4 variações), `assunto_alt` fixo para quem não tem porta | `{assunto_rota}` |
| Abertura | "Oi, {nome}," e o **lembrete do link oficial primeiro**: "Lembrete: o formulário oficial (Cerfa S1106) e a sua CPAM estão no site do governo: service-public.gouv.fr/particuliers/vosdroits/R45084." | todos |
| Roteiro | `primeiro` e os passos de `caso(p,q)`, um bloco de texto por passo (francês em itálico) | `#caso_<porta>_<ponto>` (20 × ~5 blocos, gerados em laço) |
| Reserva | só o lembrete, o botão e a oferta | `#caso_geral` |
| Botão | "Voltar à página" → `link_pagina` | todos |
| Oferta | "Prefere ter alguém com você?", três acompanhamentos (Ligue sem medo, Escreva sem erro, Resolva de ponta a ponta), **sem preço**, escopo "preparo, entro na chamada, redijo com você e confiro; quem fala e envia é você" | todos |
| Pergunta | uma linha, respondida por e-mail, por porta | `#porta_<x>` |
| Proteção e assinatura | "Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica." / "Ingryd · Por Dentro" | todos |

**E-mail 2: fora desta entrega (decisão dela, 18/11).** O e-mail 1 já oferece o serviço, então o e-mail 2 será repensado depois: engajar pela **dor específica de cada resposta** do questionário (porta e ponto), não repetir a oferta. Nesta entrega `modelo-rota-da-secu.mjs` e o `crm-modelos-rota-da-secu.sql` criam **só o `saude_rota_1`**; `CHAVE_2`, `D2`, o teste do e-mail 2 e a pergunta 5 ficam para quando ela definir o e-mail 2.

- [ ] **Step 1: Escrever `crm-modelos-rota-da-secu.test.mjs`** (PGlite; carregar `schema.sql`, `crm-fase1.sql`, `crm-fase1b-minha-ficha.sql`, `caminhos-opcoes.sql` do app e os SQLs do CRM na ordem do teste do Mapa **+ `crm-saude-porta-ponto.sql`**, depois `gerar()`). Asserções:
  - roda a 1ª e a 2ª vez sem erro e não duplica (`modelos_email_versoes` = 2)
  - dois modelos `saude_rota_1/2`, `criado_no_estudio`, **`envio_ligado = false`**, versão 1 em `rascunho` (nada publicado)
  - e-mail 1: `tipo = 'servico'`, `envio_gatilho = 'material'`, `envio_depois_de = 'guia-rota-da-secu'`, `envio_minutos = 5`; e-mail 2: `envio_depois_de = 'saude_rota_1'`
  - os modelos do Mapa **não** são criados (`select count(*) from modelos_email where chave like 'saude\_mapa%'` = 0)
  - o SQL para com mensagem clara se faltar `envio_minutos` (rodar `gerar()` num banco sem `crm-sequencia-minutos.sql`)
  - só usa variáveis que `ES.varsDoModelo` oferece (depende da 1.4)
  - **nenhum corpo/assunto contém `[...]`, `—`, `sempre`, preço (`€`, `R$`)**, e o lembrete do link oficial é a **primeira** frase depois da saudação
  - cada um dos 20 `caso_<p>_<q>` tem ao menos um bloco e o texto igual ao de `caso(p,q)` (mesma fonte que a página)
  - captura com `respostas.porta/ponto` e `utm_campaign/utm_content` guarda os dois no contato e no evento `email_capturado`; capturar **sem** linha em `guias_links` para o slug `rota-da-secu` **funciona** e devolve a resposta sem `notion_url`
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `modelo-rota-da-secu.mjs`** com a mecânica de `modelo-mapa-saude.mjs` (função `modelo()`, `dolar`, `lit`, `jsonb`, cabeçalho do SQL com pré-requisitos e "Como desfazer") e **texto novo**; `ordem` 562 e 563 (o Mapa usa 560 e 561); **gerar o arquivo** com `node admin/crm/db/modelo-rota-da-secu.mjs`. O cabeçalho do SQL gerado diz: pré-requisitos `crm-sequencia-minutos.sql` e `crm-saude-porta-ponto.sql`; não precisa de `guias_links`; Worker publicado com as variáveis da 1.4; Cron `*/5 * * * *`.
- [ ] **Step 4: Rodar o teste e ver passar** (`APP_DB_DIR=/home/user/POR-DENTRO-APP/db node admin/crm/db/testes/crm-modelos-rota-da-secu.test.mjs`).
- [ ] **Step 5: Isolamento.** O SQL não cria tabela nem função, só linhas em `modelos_email` e `modelos_email_versoes`. Rodar o sentinela do app de novo (`cd /home/user/POR-DENTRO-APP/db/testes && npm test`) e `node admin/crm/db/testes/conferir-banco.test.mjs`. Verde = o arquivo vai para a Ingryd.
- [ ] **Step 6: Commit (só se ela pedir):** `feat(crm): e-mails 1 e 2 da Rota da Sécu em rascunho`.

**Depende da Ingryd:** perguntas 5 e 7; revisar texto no Estúdio; rodar o S3 (teste, depois produção, mesmas conferências da 0.1); **ligar o Envio** só depois do teste da 1.7.

### Task 1.4: Worker e Estúdio oferecem as variáveis da Rota

Hoje o Worker só define `link_checklist` (link do Notion, vindo de `guias_links`) para `saude_mapa_*` (`SAUDE_GUIA_DO_MODELO`, worker.js ~2002). Para `saude_rota_*` **não existe link**, e `crmMontarNovo` **recusa** o envio com "falta o link_...". Sem esta tarefa os e-mails nunca saem (falha segura, mas sem entrega).

**Files:**
- Modify: `cms-oauth-worker/worker.js` (perto de `crmVarsSaude`, ~2015, e de `crmVarsNovos`, ~2036; e o ponto onde `SAUDE_GUIA_DO_MODELO` é usado, ~2102)
- Modify: `admin/crm/estudio.js` (`CAT` ~26, `VARS_DE` ~91, e as amostras da prévia ~395-412)
- Test: `cms-oauth-worker/testes/crm-rota-da-secu.test.mjs` (molde: `crm-saude-s2.test.mjs`)

**Interfaces:**
- Produces em `worker.js`: `function crmVarsRota(resp: { porta?: string, ponto?: string }, chave: string): Record<string, boolean | string>` que devolve `caso_<porta>_<ponto>` (20 booleanos; só um `true`), `caso_geral` (`true` quando porta ou ponto inválidos), `assunto_rota` (string, por porta; `''` se porta inválida) e, para `chave` em `saude_rota_1|2`, `link_pagina` = `https://imigrantepordentro.com/guias/rota-da-secu/?utm_source=email&utm_medium=email&utm_campaign=rota-da-secu&utm_content=<chave>&porta=<porta>&ponto=<ponto>&aberto=1` (porta e ponto só se válidos)
- Consumes: `SAUDE_PORTAS`, `SAUDE_PONTOS` (já existem)
- Produces em `estudio.js`: entradas `CAT.caso_*`, `CAT.caso_geral` (`t: 'sim'`), `CAT.assunto_rota` (`t: 'texto'`), `CAT.link_pagina` (`t: 'link'`, **não** `privado`), e `VARS_DE.saude_rota_1/2 = VARS_NOVOS.concat([...])`

- [ ] **Step 1: Escrever `crm-rota-da-secu.test.mjs`** (mesmo truque do teste do Mapa: ler `worker.js` e exportar as funções num arquivo temporário). Asserções:
  - para cada uma das 20 combinações, exatamente um `caso_<p>_<q>` é `true`; `caso_geral` é `false`
  - porta `xyz`, ponto `''`, `resp` vazio e `resp` ausente: `caso_geral = true`, todos os `caso_*` falsos, e o e-mail 1 montado (`W.crmMontarNovo`) **não lança** e contém o lembrete do link oficial e `link_pagina`
  - e-mail 1 montado para uma combinação tem o texto de `caso(p,q)` e **não** tem texto de outra combinação
  - `link_pagina` traz `porta`, `ponto`, `aberto=1` e `utm_content=saude_rota_1`; com porta inválida, não traz `porta`
  - `saude_mapa_1` continua montando como antes (rodar o teste `crm-saude-s2.test.mjs` junto)
  - o assunto cai em `assunto_alt` quando `assunto_rota` é vazio
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `crmVarsRota`**, chamá-la em `crmVarsNovos` (`...crmVarsRota(resp, p.chave)`; conferir que `p.chave` chega até lá, senão passar a chave como parâmetro novo) e **não** tocar em `crmVarsSaude` nem em `SAUDE_GUIA_DO_MODELO` (a decisão 0.3 é separada). Acrescentar o catálogo em `estudio.js` e uma amostra de `link_pagina` na prévia, para o Estúdio mostrar a prévia por persona.
- [ ] **Step 4: Rodar `crm-rota-da-secu.test.mjs`, `crm-saude-s2.test.mjs` e `crm-modelos-rota-da-secu.test.mjs` (1.3) até passar.** Rodar também o conjunto inteiro (`for t in admin/crm/db/testes/*.test.mjs cms-oauth-worker/testes/*.test.mjs`) como a CI faz.
- [ ] **Step 5: Commit (só se ela pedir):** `feat(worker): variáveis e link da Rota da Sécu`.

**Depende da Ingryd:** publicar o `worker.js` novo no painel do Cloudflare (como foi feito com a rota de exportação) e confirmar que o Cron `*/5 * * * *` existe (`cms-oauth-worker/README.md` seção 23). **Antes disso, o e-mail 1 não sai** (e essa é a proteção).

### Task 1.5: A ficha já mostra a Rota com clareza

**Files:**
- Modify: `admin/crm/crm.js` (`RESP_LABEL` linha 53; rótulos de origem linhas 27 e 1377; `ORIGEM_PAGINA` linha 1134; `DOS_FUNIL` linha 2706)
- Modify: `admin/crm/taxonomia.js` (`saude_rota_1: ['entrega', null, null]`, `saude_rota_2: ['entrega', null, null]`, página **vazia**: a página I07 exigiria SQL novo, ver pergunta 8)
- Test: `admin/crm/db/testes/crm-ficha-ui.test.mjs` (acrescentar casos) e `crm-modelos-rota-da-secu.test.mjs`

**Interfaces:**
- Consumes: respostas `porta` e `ponto` (já gravadas pelo `crm-saude-porta-ponto.sql`)
- Produces: "Quem é ela" mostra "Situação" e "Ponto na Sécu" com os textos de `PORTAS[].desc` e `PONTOS[].rot` em vez da chave crua; origem `guia-rota-da-secu` aparece como "Guia Rota da Sécu"

- [ ] **Step 1: Teste que falha:** uma ficha com `respostas: { porta: 'aupair', ponto: 'esperando' }` e origem `guia-rota-da-secu` renderiza "Situação" com "Vim ou vou como au pair", "Ponto na Sécu" com "Já pedi e estou esperando resposta" e a origem "Guia Rota da Sécu"; ficha com porta inválida não quebra (mostra a chave crua).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** os rótulos (sem importar `casos.js` dentro do `crm.js` se isso complicar o harness de teste do `crm.js`, que remove `import` por regex; nesse caso copiar os rótulos curtos e deixar um teste que garante que as duas listas coincidem).
- [ ] **Step 4: Verificar o que a proposta afirma e o código talvez não faça** (resolve o item 3 da Revisão): com PGlite, capturar a mesma pessoa duas vezes com respostas diferentes e ler `contatos.respostas` e os `eventos`. Anotar no teste: (a) `respostas` guarda só a última; (b) o evento `email_recapturado` guarda ou não as respostas antigas; (c) um e-mail 1 por pessoa. **Decisão dela (18/11):** "reenviar o e-mail a cada cadastro" e "guardar o histórico de respostas" **entram na etapa 2**, junto do SQL do pedido de acompanhamento, e **não** na etapa 1. Aqui o teste só **fixa o comportamento atual** (para a etapa 2 ter o antes e o depois) e a Ingryd é avisada de que, até a etapa 2, a aba "No CRM" da proposta mostra algo que o sistema ainda não faz.
- [ ] **Step 5: Rodar o conjunto de testes.** Commit (só se ela pedir): `feat(crm): rótulos da Rota da Sécu na ficha`.

**Depende da Ingryd:** pergunta 8; ler o resultado do Step 4.

### Task 1.6: ManyChat: palavra e link

**Files:** nenhum no repositório. O trabalho está no painel do ManyChat, que é dela. Entregar um **cartão de configuração** (no chat).

**Interfaces:**
- Consumes: a frase final (0.2), a URL da página (1.2), o `slug` da pauta e o `código do post` (do `instagram-hub`)
- Produces: palavra **AMELI**, texto da DM e link

- [ ] **Step 1: Montar o link da DM** (formato do contrato, `instagram-hub/docs/CONTRATO-DE-DADOS.md` §3 e §8b): `https://imigrantepordentro.com/guias/rota-da-secu/?utm_source=instagram&utm_medium=social&utm_campaign=<slug da pauta>&utm_content=<código do post em minúsculas>`. O `utm_content` pode ser o ID do cérebro em minúsculas (ex.: `x-0075`) ou o código do `/reel/<código>`; com `utm_content` igual ao código, a ligação post↔página é automática e não precisa de entrada em `links-posts.json`. Ler a pauta/slug no `instagram-hub` (`dados/cerebro.json`, `estudio/estado.json`); **se não achar, perguntar**, não inventar.
- [ ] **Step 2: Redigir a DM** (PT-BR, primeira pessoa, sem travessão, o que a página entrega e nada mais), por exemplo: "Oi! Aqui está a página da Rota da Sécu: ela começa pelo link oficial e depois monta o roteiro do seu caso com duas perguntas. [link]". Sem "grátis", sem "mapa", sem "checklist".
- [ ] **Step 3: Cartão para ela:** palavra única `AMELI` (não pode repetir em outro Reel); a resposta pública ao comentário; a DM; o link; **conferir na documentação vigente do ManyChat e da Meta** as regras de resposta automática a comentários e de envio de DM (a análise registra que isso **não foi verificado**; este plano também não afirma nenhuma regra). Testar com a conta dela comentando AMELI num post de teste antes do Reel.
- [ ] **Step 4: Teste do clique:** abrir o link da DM e ver, na ficha de teste da 1.7, `utm_campaign` e `utm_content` no evento `email_capturado`.

**Depende da Ingryd:** configurar e testar no ManyChat; conferir as regras vigentes; dizer se o post de teste pode ser usado.

### Task 1.7: Teste ponta a ponta

**Files:** nenhum arquivo novo. Capturas e relatórios no scratchpad; capturas enviadas a ela.

- [ ] **Step 1: Navegador, simulado** (já coberto em 1.2): 390 px e 1280 px, fluxo completo, sem rolagem horizontal, anexar PNGs (antes e depois do cadastro, celular e computador).
- [ ] **Step 2: Estúdio:** depois do S3 rodado por ela (teste e produção), abrir os dois modelos em rascunho, ver a prévia por persona (4 portas × 5 pontos) e mandar o **teste para o e-mail dela** (função do Estúdio, não registra toque). Conferir: lembrete do link oficial primeiro, roteiro igual ao da página, botão leva à página aberta, sem `[colchetes]`, sem preço.
- [ ] **Step 3: Ao vivo, com o e-mail dela, uma vez** (a página só tem o Supabase de produção, `assets/js/supabase-client.js`): com a página publicada **e ainda não linkada** (nem em `/guias/`, nem no ManyChat, nem no Reel), ela liga o Envio **só do e-mail 1** e se cadastra com o próprio e-mail, escolhendo uma porta e um ponto. Conferir: o e-mail chega em até 5 minutos (Cron `*/5`), a ficha mostra porta e ponto com os rótulos da 1.5, `utm_*` aparecem no evento (abrir a página com `?utm_campaign=teste&utm_content=teste`), o recadastro não duplica nem manda outro e-mail 1, o "Voltar à página" abre o roteiro em outro aparelho. **Depois do teste, ela decide se desliga o Envio até a data do Reel.** Não apagar a ficha de teste dela.
- [ ] **Step 4: Resultado:** relatório curto com o que passou, o que ficou de fora e o que depende dela. Só então o ManyChat (1.6) é ligado ao Reel.

**Depende da Ingryd:** rodar o S3, publicar a página (PR e merge quando ela pedir), publicar o Worker, ligar e desligar o Envio, abrir o e-mail e a ficha.

---

## Riscos e perguntas em aberto (só o que a análise não resolveu)

1. **O Worker é parte da entrega.** Sem `worker.js` novo publicado (1.4) o e-mail 1 não sai. A falha é segura (ele recusa), mas é uma dependência de publicação que a análise não listava.
2. **Reenvio do e-mail 1 e histórico de respostas: decidido, fica na etapa 2** (SQL novo, provável). Na etapa 1 vale o comportamento atual (um e-mail 1 por pessoa; resposta nova só na tela, a antiga se perde), medido pela 1.5. Perguntas para desenhar a etapa 2, **não** para esta: reenviar a **cada** cadastro ou só quando porta/ponto mudam? há limite por dia (para não virar spam)? o histórico vai em tabela nova (exige RLS, `revoke ... from anon` e entrada em `conferir-banco.sql`) ou em campo do evento `email_recapturado`?
3. **Cadastro antigo ou fora da lista** cai no e-mail de reserva (`caso_geral`), não em branco. Confirmar que "só o lembrete, o botão e a oferta" serve.
4. **O link do e-mail carrega porta e ponto e abre o roteiro.** Sem isso, quem abre no celular depois de cadastrar no computador vê o portão de novo. É coerente com "portão suave", mas é uma decisão dela.
5. **E-mail 2:** quando sai (o plano provisório é 3 dias, 10h, como o do Mapa), se vale o tipo `novidades` (só quem aceitou novidades) ou `servico`, e se não sai para quem já pediu acompanhamento (só faz sentido depois da etapa 2).
6. **Fim da página na etapa 1, sem formulário de orçamento.** Opções: (a) lista das três opções e um botão para a agenda (`link_agenda`); (b) só o texto "responda o e-mail 1"; (c) esconder o bloco até a etapa 2. Recomendação: (a). Antes de cobrar, ela precisa do SIRET (já na análise).
7. **E-mail 1 em 5 minutos, como o Mapa**, ou outro prazo.
8. **Classificação dos e-mails na Jornada:** sem página (`pagina` nula), porque uma "I07" exige alterar `modelos_email_pagina_check` (SQL novo, mais um banco duas vezes). Recomendação: deixar nula agora.
9. **Persona do cadastro:** nenhuma das cinco aceitas pelo CRM descreve "saúde"; a página não manda `persona` e a ficha vive de `porta`/`ponto`. A linha "Persona" da proposta é só visual.
10. **A página fica fora de `/guias/` e do sitemap até o Reel**, e talvez com `noindex`, já que chega por DM. Decidir.
11. **Os fatos da 1.1:** o que não conseguir fonte oficial datada sai do roteiro ou vira "confirme". As pendências conhecidas estão listadas na 1.1; o francês precisa de revisão nativa antes de ir ao ar.
12. **Se o Mapa for apagado (0.3-b):** entram no escopo o Worker, o estúdio, a taxonomia, o crm.js e dois testes. Recomendação: PR separado.
