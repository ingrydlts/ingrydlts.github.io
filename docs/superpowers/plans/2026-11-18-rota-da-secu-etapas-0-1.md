# Rota da Sécu, etapas 0 e 1 — plano de execução

> **Estado: PROPOSTA, aguardando aprovação da Ingryd.** Nada foi construído, commitado nem rodado. Nenhum SQL foi executado em banco algum e o Envio continua desligado.
>
> **Para quem executa (depois da aprovação):** os passos têm `- [ ]`. Cada tarefa diz arquivos, como testar e o que depende da Ingryd.

**Objetivo:** quem comenta AMELI no Reel 1 recebe a DM do ManyChat com o link de `/guias/rota-da-secu/`; a página abre pelo link oficial (service-public R45084), faz duas perguntas (porta e ponto), mostra o primeiro passo, e depois do cadastro libera o roteiro do caso e manda o mesmo roteiro por e-mail (E-mail 1, em rascunho). Substitui o guia "Mapa da saúde": o Mapa fica de fora.

**Arquitetura (peças desta entrega):**
1. Página estática em `guias/rota-da-secu/` (sem dado pessoal; o site é público). Chama `capturar_lead_guia` com `guia: 'rota-da-secu'`, `origem: 'guia-rota-da-secu'`, `respostas.porta`/`.ponto` e `utm_*`.
2. Banco: só os dois SQLs que já existem (`crm-sequencia-minutos.sql`, `crm-saude-porta-ponto.sql`) mais o novo `crm-modelos-rota-da-secu.sql` (gerado). Nenhuma tabela nem função nova nesta etapa.
3. Estúdio de e-mails: modelos `saude_rota_1` e `saude_rota_2`, versão 1 em rascunho, Envio desligado.
4. **Worker (não estava na lista, mas é necessário; ver R1):** o Worker precisa preencher as variáveis do e-mail da Rota e o link da página.
5. ManyChat: palavra AMELI, DM com link e UTM.

**Stack:** HTML/CSS/JS estático e módulos ES (sem build), testes Node em `admin/crm/db/testes` e `cms-oauth-worker/testes`, Playwright (já instalado) para o navegador.

**Fonte única do texto (decisão de desenho recomendada):** o roteiro dos 20 casos vive em **um** arquivo, `guias/rota-da-secu/casos.js` (módulo ES com `caso(porta, ponto)`, as fontes e as datas). A página e `admin/crm/db/modelo-rota-da-secu.mjs` importam dele. Assim o e-mail e a página não divergem, e um teste compara os dois.

## O que ficou sem leitura (avisar antes de aprovar)
- **O repositório `ingrydlts/instagram-hub` não pôde ser adicionado à sessão** (o `add_repo` foi negado pelo classificador de permissões). Portanto **não li** as skills `inbound-jornada`, `rota-por-persona`, `crm-ficha` nem a atualização de `landing-guia`. O plano se apoia na análise, na proposta aprovada e no código deste repositório. Se as skills trazem uma regra que contradiga algo abaixo, a skill vence; **peço que a Ingryd libere o repositório (ou me diga) para eu conferir as regras antes da construção.**
- A análise (doc) e a proposta (artefato) foram lidas. Da proposta li a página, o CRM e a lógica `caso()`; a tabela dos 20 casos é gerada pelo mesmo script e será conferida na tarefa 1.2.
- `db/auditoria-isolamento.sql`, `db/conferir-banco.sql` e `db/testes` do **app** estão no repositório `por-dentro-app`, que **não está nesta sessão**. Os testes que dependem de `APP_DB_DIR` não rodam aqui até esse repositório ser anexado (ver tarefa 0.3).

---

## Etapa 0 — Destravar

### Tarefa 0.1 — Ordem dos SQLs (quem roda é a Ingryd)

Rode **primeiro no Supabase de TESTE; só depois no de PRODUÇÃO**. Depois de **cada** SQL, em cada banco, a Ingryd confere o que está na coluna "Conferir". Depois do último de cada banco: `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` (do app) no SQL Editor; **os dois têm de voltar vazios**.

| # | Arquivo (em `admin/crm/db/`) | Conferir depois de rodar | Se falhar |
|---|---|---|---|
| 0 | **Pré-requisitos a confirmar** (ver abaixo): `crm-filtro-etapa.sql`, `crm-estudio-emails-3.sql`, `crm-origem-campanha.sql` | `select column_name from information_schema.columns where table_name='modelos_email' and column_name='envio_minutos'` (existe depois do #1); `... table_name='contatos' and column_name='utm_content'` | Rodar o que faltar na ordem do cabeçalho de cada arquivo |
| 1 | `crm-sequencia-minutos.sql` | Coluna `modelos_email.envio_minutos` existe; `crm_sequencia_pendentes` sem EXECUTE para `anon` e `authenticated` | Ele é idempotente: corrigir o pré-requisito que a mensagem apontar e rodar de novo. Se quebrar o Estúdio, usar o "Como desfazer" do cabeçalho |
| 2 | `crm-saude-porta-ponto.sql` | `capturar_lead_guia` ainda `security definer`, `search_path` fixo, EXECUTE só para `anon, authenticated`; teste manual abaixo (0.2) grava `respostas.porta`/`.ponto` | `create or replace` é idempotente. Se der erro de coluna na visão `crm_contatos`, **não** rodar `crm-enriquecimento.sql` sozinho (aviso do `crm-fase0-email-guia.sql`) |
| 3 | `crm-pagina-i06.sql` **só se a Rota usar a página I06** (ver pergunta P3). Hoje o banco só aceita I01 a I05 em `modelos_email.pagina` | Constraint `modelos_email_pagina_check` aceita `I06` | Idempotente; "Como desfazer" no cabeçalho |
| 4 | `crm-modelos-rota-da-secu.sql` (a gerar na tarefa 1.4; **só depois** de 1 a 3 e de eu apresentar o arquivo para revisão) | `select chave, criado_no_estudio, envio_ligado from modelos_email where chave in ('saude_rota_1','saude_rota_2')` → 2 linhas, `envio_ligado = false`; versão 1 em `rascunho` | O próprio arquivo para com mensagem clara se faltar pré-requisito; é idempotente (`on conflict do nothing`). Para desfazer: "Como desfazer" do cabeçalho (só apaga o que está em rascunho) |

**Não rodar:** `crm-modelos-mapa-saude.sql` e `crm-guia-mapa-saude-link.sql` (o Mapa foi substituído).

**O que confirmo que a Ingryd me diga (não consigo ver o banco):** se `crm-sequencia-minutos.sql` já rodou, e em qual dos dois bancos; se `crm-origem-campanha.sql` rodou (é ele que guarda `utm_*`); se o Cron `*/5 * * * *` do Worker já existe (README, seção 23).

- [ ] **Entregável:** tabela acima, impressa em checklist para a Ingryd marcar por banco (teste / produção). Dependência: Ingryd roda e cola o resultado das consultas e das duas auditorias.

### Tarefa 0.2 — Teste manual do SQL 2 (no banco de TESTE, antes de produção)

No SQL Editor do teste, com um e-mail inventado (`teste+rota@exemplo.com`):
```sql
select public.capturar_lead_guia('{"guia":"rota-da-secu","email":"teste+rota@exemplo.com","nome":"Teste","origem":"guia-rota-da-secu","respostas":{"porta":"aupair","ponto":"esperando"},"utm_campaign":"teste","utm_content":"post-1","aceita_servico":true,"consentimento_versao":"t","texto_servico":"t"}'::jsonb);
select respostas, origem, utm_campaign, utm_content from contatos where email='teste+rota@exemplo.com';
select tipo, dados from eventos where contato_id=(select id from contatos where email='teste+rota@exemplo.com');
```
Esperado: `respostas = {"porta":"aupair","ponto":"esperando"}`, `utm_campaign='teste'`, `utm_content='post-1'`, evento `email_capturado` com `origem='guia-rota-da-secu'`. (Se `capturar_lead` exigir mais campos, ajustar o payload de acordo com a mensagem de erro, sem mudar o SQL.) Apagar a ficha de teste no fim.

- [ ] Responde duas das perguntas em aberto: **`utm_*` são guardados?** e **o que acontece sem linha em `guias_links`?** (ver 1.6). Dependência: Ingryd roda e cola o resultado.

### Tarefa 0.3 — Testes locais antes de propor o SQL novo (regra do CLAUDE.md)
- [ ] `cd admin/crm/db/testes && npm i && APP_DB_DIR=<por-dentro-app>/db npm run test:minutos test:conferir` e o sentinela do app (`cd db/testes && npm test` lá).
- **Bloqueio:** o repositório do app não está nesta sessão. Peço à Ingryd que o anexe, ou que rode os dois comandos e cole a saída.

### Tarefa 0.4 — Frase final do Reel (texto a aprovar)
O Reel promete AMELI; a página entrega o link oficial **primeiro**. A frase tem de prometer só isso:

> "Comenta **AMELI** que eu te mando, no direct, a página com o link oficial e o seu passo a passo."

Variante curta: "Comenta AMELI e eu te mando o link oficial e o roteiro do seu caso." Evitar "guia completo", "mapa", "PDF", "de graça" e qualquer prazo ("em 5 minutos"). Evitar prometer o número de sécu ou a carte vitale: a página orienta o pedido, não o resolve.
- [ ] Ingryd escolhe a frase; ela entra também na primeira linha da DM (1.7), para as duas baterem palavra por palavra.

### Tarefa 0.5 — Arquivos do Mapa (decisão da Ingryd, não apago nada)
Arquivos ligados ao Mapa: `admin/crm/db/modelo-mapa-saude.mjs`, `crm-modelos-mapa-saude.sql`, `crm-guia-mapa-saude-link.sql`, `testes/crm-modelos-mapa-saude.test.mjs` (+ script `test:saude`), `cms-oauth-worker/testes/crm-saude-s2.test.mjs`, e referências em `crm.js`, `taxonomia.js` (I06 aponta para `/guias/mapa-saude-franca/`), `estudio.js`, `worker.js` (`SAUDE_*`).
- **Recomendo manter por ora** os que o Worker e os testes ainda usam (`SAUDE_*`, `crmVarsSaude`): a Rota reaproveita `porta_*` e `ponto_*` e esses testes protegem isso. Apagar só `crm-guia-mapa-saude-link.sql` (que não deve ser rodado e tem a URL em branco) e `crm-modelos-mapa-saude.sql` **depois** que a Rota estiver no ar e `modelo-mapa-saude.mjs` deixar de ser molde.
- Se a Ingryd decidir apagar, é um commit separado, depois da etapa 1, **com pedido dela**.

---

## Etapa 1 — Primeira entrega

### Tarefa 1.1 — Conferência dos fatos (antes de escrever qualquer coisa)
A proposta traz afirmações com fonte oficial e data (`FT`: Ameli 19/01/2026, 02/10/2026, 30/09/2026, 14/10/2026, 23/04/2026, 18/09/2026; Urssaf 13/10/2026; service-public 13/05/2026). Pontos sensíveis:
- A análise diz que **C2S, ALD 31 e mutuelle de empresa estão sem fonte oficial**, mas a proposta usa C2S ("0 a 30 € por mês") e "pergunte ao RH sobre a mutuelle". **Há contradição:** ou há fonte (a de 18/09/2026) e ela vai para a lista, ou o trecho sai da primeira entrega.
- O exemplo "consulta de 30 €: 19 € com médecin traitant e 8,40 € sem" tem de bater com a fonte citada.
- "Carte vitale chega em 2 semanas pela conta Ameli / 3 por papel" e "3 meses de residência sem atividade" idem.
- [ ] Criar `guias/rota-da-secu/FONTES.md` (URL, data de acesso, trecho) para cada afirmação, e cada passo de `casos.js` aponta uma chave de fonte. Afirmação sem fonte → vira **pergunta** ou sai. Mostrar `conferido em dd/mm/aaaa` na página.
- Frases em francês: manter o rótulo "revisar antes de ir ao ar" até uma pessoa nativa revisar. **Depende da Ingryd** (revisão nativa).
- Cidadania europeia fora; sem preço; "acompanha, não representa".

### Tarefa 1.2 — `casos.js` (a fonte única)
- **Arquivos:** criar `guias/rota-da-secu/casos.js` (`PORTAS`, `PONTOS`, `FONTES`, `caso(p,q)`, `todos()`), a partir do `caso()` da proposta; `guias/rota-da-secu/FONTES.md`.
- **Teste:** `admin/crm/db/testes/rota-casos.test.mjs` — para as 20 combinações: devolve `primeiro` e ≥1 passo; todo passo tem fonte registrada; nenhum texto contém `—`; nenhuma marca de gênero (a/o) em frases dirigidas à pessoa; chaves de fonte todas existem; texto de preço ausente (`€` só no exemplo conferido do médecin traitant); `[data]`/`[nome]` só em frases em francês.
- [ ] **Depende da Ingryd:** aprovar os 20 textos (tabela "Os 20 casos" do artefato) e o aviso "confirme" nos pontos sem fonte.

### Tarefa 1.3 — A página `guias/rota-da-secu/index.html`
- **Arquivos:** `guias/rota-da-secu/index.html` (+ `casos.js`); seguir `guias/checklist-chegada-au-pair/index.html` para cabeçalho, `style.css`, consentimento, `supabase.rpc('capturar_lead_guia')`, honeypot, tempo mínimo, `track()`. Sem dado pessoal, sem segredo, sem `localStorage` além de um "já liberei" sem e-mail (com try/catch).
- **Conteúdo:** visual da proposta (cartão claro, link oficial R45084 como hiperlink simples primeiro; "Estudante? Seu pedido é em etudiant-etranger.ameli.fr"; 2 perguntas; primeiro passo na tela; cadastro; roteiro liberado; fontes). Rodapé: "Baseado em fontes públicas. Não sou advogada."
- **Payload** (o que a proposta mostra): `guia:'rota-da-secu'`, `origem:'guia-rota-da-secu'`, `nome`, `email`, `aceita_novidades`, `respostas:{porta, ponto}`, `utm_source/medium/campaign/content` e `ig` lidos da URL (copiar o laço do guia do au pair), consentimento com **texto e versão novos** (`rota-1`).
- **Etapa 1 e o botão "Quero acompanhamento":** o pedido de orçamento é etapa 2 (SQL novo). Na etapa 1 o bloco "Prefere ter alguém com você?" **não pode ter formulário que não grava nada.** Ver pergunta P4. Recomendação: texto + "responda o e-mail que enviei" (respostas por e-mail já são gravadas em `respostas_email` e aparecem na ficha).
- **Sitemap/SEO:** ver P6.
- **Teste (1.8).** **Depende da Ingryd:** texto de consentimento, a frase "não peço número de sécu" (volta ou não, risco da análise), P4, P6.

### Tarefa 1.4 — E-mails: `modelo-rota-da-secu.mjs` e `crm-modelos-rota-da-secu.sql`
- **Arquivos:** criar `admin/crm/db/modelo-rota-da-secu.mjs` (molde de mecânica: `modelo-mapa-saude.mjs`; **texto novo**, nunca o do Mapa); gerar `admin/crm/db/crm-modelos-rota-da-secu.sql` com `node admin/crm/db/modelo-rota-da-secu.mjs`; criar `admin/crm/db/testes/crm-modelos-rota-da-secu.test.mjs` (molde: o teste do Mapa) e acrescentar `"test:rota"` ao `package.json` dos testes.
- **Chaves e regras:** `saude_rota_1` (tipo **serviço**; gatilho `material`, depois de `guia-rota-da-secu`, `envio_minutos: 5`; Envio **desligado**; versão 1 em **rascunho**) e `saude_rota_2` (retomada curta; `novidades`; gatilho `email` depois de `saude_rota_1`, 3 dias, 10h; Envio desligado). `para_quem: { materiais: ['guia-rota-da-secu'] }`.
- **E-mail 1:** assunto por pessoa; primeira frase = lembrete do link oficial R45084; primeiro passo + passos do caso (de `casos.js`); botão "Voltar à página"; oferta "Prefere ter alguém com você?" sem preço, dizendo o que ela faz e **não faz**; pergunta por porta, uma linha respondida por e-mail; proteção + assinatura. 4 portas × 5 pontos = 20 combinações.
- **Como o texto por caso entra no Estúdio:** os blocos só condicionam por **uma** variável (`#porta_x` ou `#ponto_y`). Para 20 casos, o Worker passa a gerar 20 sim/não `caso_<porta>_<ponto>` (R1) e cada caso vira um bloco `texto` com `se: '#caso_aupair_esperando'`, gerado de `casos.js`. Alternativa mais simples: **um** bloco `texto` por caso já montado, com o roteiro em lista; confirmar na tarefa o que `ES.montar` aceita em um bloco `texto` (lista com `1.` etc.). Se não aceitar, o gerador emite um bloco por passo.
- **Teste:** `ES.montar` para as 20 personas: assunto não vazio, sem `{variável}` sem preencher, 1ª frase contém `R45084`, só o bloco do caso aparece, `texto` == `casos.js`, sem preço, sem `—`; e o `.sql` gerado é idêntico ao regenerado (`gerar()`); `conferir-banco` do app reprova tabela/função nova (aqui **não há**).
- **Depende da Ingryd:** revisar os dois e-mails no Estúdio (prévia por persona), mandar o teste para o e-mail dela, publicar (No ar) e ligar o Envio **só depois** de 1.9.

### Tarefa 1.5 — Worker e Estúdio: variáveis e link da Rota (R1)
- **Arquivos:** `cms-oauth-worker/worker.js` (perto de `SAUDE_GUIA_DO_MODELO` e `crmVarsSaude`, linhas ~2001–2110): para `saude_rota_1/2`, preencher `link_rota` (URL da página + `utm_source=email&utm_medium=email&utm_campaign=rota-da-secu&utm_content=<chave>`), `assunto_persona` / `assunto_retomada` da Rota e os 20 `caso_*`; **sem** consultar `guias_links` (o Mapa exige o link do Notion e o e-mail falha "sem link" se faltar; a Rota não usa Notion). `admin/crm/estudio.js`: `CAT.link_rota` (`t:'link'`) e `VARS_DE.saude_rota_1/2`; `CAT.caso_*`.
- **Teste:** acrescentar à `cms-oauth-worker/testes/` um teste (molde `crm-saude-s2.test.mjs`): para cada uma das 20 porta/ponto, `crmVarsNovos` devolve exatamente um `caso_*` verdadeiro, o `link_rota` e o assunto; lead sem porta/ponto cai no plano B (assunto fixo com o nome, sem `caso_*`) em vez de falhar.
- **Depende da Ingryd:** **publicar o `worker.js` no Cloudflare** (seção 9 do README, ou `wrangler deploy`) e confirmar o Cron `*/5 * * * *`.

### Tarefa 1.6 — CRM: rótulos e classificação
- **Arquivos:** `admin/crm/crm.js` (mapas `ORIGEM` linha ~27, `ORIGEM_PAGINA` ~1134 e o texto de "origem" ~1377: acrescentar `'guia-rota-da-secu'`; `RESP_LABEL` e `DOS_FUNIL` com "Situação" e "Ponto na Sécu"), `admin/crm/taxonomia.js` (a página I06 hoje é o Mapa: ver P3), `admin/crm/estudio.js`.
- **Teste:** `crm-taxonomia-ui.test.mjs` e `ficha-*.test.mjs` existentes continuam passando; um caso novo para a origem da Rota. Cuidado: `ficha-harness.mjs` remove os `import` do `crm.js` por regex.
- **Sem SQL novo** nesta etapa (o campo "O que ela descreveu" e o pedido de orçamento são da etapa 2).

### Tarefa 1.7 — ManyChat (Ingryd configura; eu entrego o texto)
- **Palavra:** `AMELI` (única, sem acento; cobrir `ameli` e variações de caixa).
- **Link da DM:** `https://imigrantepordentro.com/guias/rota-da-secu/?utm_source=instagram&utm_medium=manychat&utm_campaign=<slug-da-pauta>&utm_content=<ID-do-post>` (o `utm_campaign` e o `utm_content` vêm do Instagram Hub; a página só repassa). `ig=<id do contato ManyChat>` é opcional; **não** usar nome nem e-mail em URL.
- **Mensagem (rascunho):** "Oi! Aqui está a página com o link oficial e o passo a passo do seu caso: [link]. Quando abrir, o primeiro passo já aparece."
- [ ] **Depende da Ingryd:** configurar e **conferir na documentação vigente do ManyChat e da Meta** as regras de resposta automática a comentário e de mensagem (a análise diz que não foram verificadas); testar com uma conta dela comentando em um post de teste.

### Tarefa 1.8 — Teste no navegador (Playwright)
- **Como:** servidor local estático (`python3 -m http.server`), Chromium já instalado; viewports **390×844** e **1280×800**; `deviceScaleFactor: 1`.
- **Roteiro de teste** (`scripts/` ou `admin/crm/db/testes/rota-pagina.test.mjs`): (a) sem rolagem horizontal (`document.scrollingElement.scrollWidth <= innerWidth`) nos dois tamanhos, antes e depois do cadastro; (b) link R45084 é o **primeiro** link da página e abre em nova aba com `rel=noopener`; (c) as 20 combinações mudam o primeiro passo; (d) cadastro com `rpc` **interceptado** (rota do Playwright) confere o payload (`guia`, `origem`, `porta`, `ponto`, `utm_*`, consentimento, sem `persona` indevida); (e) erro de rede mostra a mensagem e reativa o botão; (f) teclado: radios e botões alcançáveis, foco visível; (g) contraste e alvo de toque ≥ 44 px; (h) captura de tela nos dois tamanhos para a Ingryd ver.
- **Atenção (R2):** o `supabase-client.js` do site aponta para **um** projeto (`hslhpktfgxwfvljvsxkj`), hoje sem alternância teste/produção. Por isso o teste automático **intercepta** a chamada, e o teste real (1.9) cai no banco desse projeto.

### Tarefa 1.9 — Teste ponta a ponta com o e-mail dela
Só depois de: SQLs 1–4 no banco certo, Worker publicado, Cron `*/5` ativo, página no ar (**precisa de commit/merge dela**, o Pages publica `main`).
1. Abrir a página com `?utm_campaign=teste-rota&utm_content=teste-1` no celular, escolher uma combinação, cadastrar com o e-mail dela.
2. Conferir na ficha: `respostas.porta/.ponto`, `utm_campaign`, `utm_content`, evento `email_capturado`, origem `guia-rota-da-secu`.
3. No Estúdio, **publicar a versão 1 de `saude_rota_1` (No ar) e ligar o Envio só para esse teste**, com a regra "Para quem" restrita (ou rodar `Rodar sequência` do Worker na hora); aguardar ~5 min; conferir o e-mail (assunto, 1ª frase com R45084, roteiro igual ao da página, botão, pergunta, proteção). **Desligar o Envio de novo** até ela aprovar o texto.
4. Repetir com 2 combinações diferentes (uma por porta "estudante" e "outro").
5. Cadastrar de novo o mesmo e-mail com outra combinação: ver P1.
- [ ] **Depende da Ingryd:** fazer os passos 1 a 3 com a conta dela e aprovar.

---

## Riscos e perguntas em aberto (o que a análise ainda não resolvia)

**R1 — O Worker precisa mudar (não estava no escopo informado).** Hoje o Worker só sabe preencher o e-mail do **Mapa** (`SAUDE_GUIA_DO_MODELO`, link do Notion lido de `guias_links`, `assunto_persona` do Mapa). Para `saude_rota_*`: o botão de link "não sai" se a variável faltar, e o e-mail falha. A tarefa 1.5 resolve. Isso exige **publicar o Worker** (Ingryd) e um teste novo.

**R2 — A página fala com um único Supabase.** Não há como a página gravar "no teste" sem mudar o cliente. Opção: parâmetro `?env=teste` lido só em localhost, ou testar a página apenas com interceptação e fazer o teste real já em produção, com o e-mail dela e o Envio desligado. Pergunta P5.

**R3 — Roteiro e atribuição só valem se `crm-origem-campanha.sql` já rodou.** `crm-prazo-vlsts.sql` redefine `capturar_lead` **sem** `utm_*`; `crm-origem-campanha.sql` vem depois e os guarda (confirmado no código, tarefa 0.2 confirma no banco).

**R4 — Sem linha em `guias_links`.** `capturar_lead_guia` faz `select ... from guias_links where slug = guia` e devolve `notion_url` nulo (o `jsonb_strip_nulls` omite); não dá erro. `crm_guia_email_pedir` só envia para `etudes-en-france-2027-2028`, então não dispara para a Rota (o e-mail 1 sai pelo caminho da **sequência**, não por esse gancho). A página **não pode** exigir `notion_url` na resposta (o guia do au pair exige). O Worker da Rota não lê `guias_links` (1.5). Resumo: o cadastro funciona sem a linha; a tarefa 0.2 e o teste de 1.8 confirmam.

**R5 — Revisão das astúcias e das datas.** O Mapa tinha uma data de vencimento das fontes (14/02/2027) que apaga o bloco sozinho. Para a Rota, propor "conferido em" na página e no e-mail, e uma data de revisão (sugiro **90 dias**, 18/02/2027) para reconferir. Os valores em euros mudam a cada ano.

**R6 — Consentimento.** A página guarda porta, ponto e UTM: o texto do aceite e a versão (`rota-1`) precisam de aprovação dela antes de ir ao ar (LGPD/RGPD).

**Perguntas que precisam de decisão da Ingryd:**
- **P1 — Recadastro com outra combinação.** A regra "ainda não recebeu este modelo" da sequência impede um segundo E-mail 1. A proposta do CRM mostra "E-mail 1 enviado (de novo)". Qual vale? Recomendo: **uma vez por modelo**, a página libera o novo roteiro na tela e o CRM registra a resposta nova no Dossiê, sem novo e-mail (sem mudar SQL).
- **P2 — E-mail 2 sem pedido de orçamento ainda.** Ele não sai se a pessoa já pediu orçamento, mas esse pedido só existe na etapa 2. Recomendo **deixar o E-mail 2 em rascunho com o Envio desligado** até a etapa 2.
- **P3 — Página I06 (Mapa) ou nova I07 para a Rota?** `taxonomia.js` I06 aponta para `/guias/mapa-saude-franca/`. Recomendo **reaproveitar I06 apontando para `/guias/rota-da-secu/`** (o Mapa está substituído) e rodar `crm-pagina-i06.sql` (não estava na lista dela). Se preferir I07, é um SQL a mais.
- **P4 — O que a página oferece no lugar do pedido de acompanhamento na etapa 1?** Recomendo texto + "responda o e-mail" (que o CRM já registra). Alternativa: esconder o bloco até a etapa 2. O botão "Quero acompanhamento" com formulário só entra com o SQL da etapa 2.
- **P5 — Teste real em produção ou em teste?** Ver R2.
- **P6 — A página entra no `sitemap.xml` e no índice `/guias/`?** Hoje o sitemap lista só dois guias. A página é pública; sem `noindex`, o roteiro dos 20 casos fica indexável. Recomendo `noindex` até ela aprovar o conteúdo, e **sem** sitemap.
- **P7 — "Não peço número de sécu"** volta ao formulário? (uma linha; a análise deixa para ela).
- **P8 — SIRET e escopo do acompanhamento** continuam bloqueando só a etapa 2, mas a oferta no E-mail 1 já cita o serviço. Confirmar que **citar o serviço sem preço** antes de ter o SIRET é aceitável.
- **P9 — Revisão nativa do francês:** quem faz e quando (antes de publicar).

## Ordem de execução e portões
1. **Portão A — aprovar este plano** (e responder P1–P9; o mínimo para começar: P3, P4, P6).
2. 0.1 e 0.2 (Ingryd, teste) → 0.3 → 0.4 e 0.5 (decisões).
3. 1.1 → 1.2 → 1.3 e 1.4 e 1.5 (em paralelo; 1.4 e 1.5 dependem de 1.2) → 1.6.
4. **Portão B — Ingryd revisa página e e-mails (prévia por persona, em 390 px e 1280 px) e aprova os 20 textos.**
5. SQLs 3 e 4 no **teste**, depois auditorias; depois no **produção**, depois auditorias.
6. 1.7 e 1.8; **Portão C —** commit/merge dela, publicação do Worker, Cron `*/5`, teste ponta a ponta (1.9).
7. Só então: ligar o Envio do E-mail 1 e gravar o Reel. O E-mail 2 só liga com a etapa 2.

## Restrições que valem para tudo isto
- Sem commit, push ou PR sem pedido dela. Sem SQL rodado por mim. Sem ligar o Envio.
- Site público: fixtures com dado inventado; nada de e-mail, nome ou ID real no repositório.
- Regras de isolamento do `CLAUDE.md`: tabela ou função nova exigiria RLS/`revoke ... from anon`/`anon_pode`/lista do `conferir-banco`; **esta etapa não cria nenhuma**. Nada liga ou devolve ficha pelo e-mail do token.
- Cada afirmação em PT tem fonte oficial e data; francês é apoio e fica marcado "revisar".
