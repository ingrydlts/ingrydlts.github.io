# CRM · Taxonomia e filtros dos modelos de e-mail (parte 1 de 3)

Data: 2026-11-09 · Repositório: website (`admin/crm/`) · Branch: `claude/wonderful-albattani-v5ql4c`

Esta é a parte 1 de uma entrega maior pedida pela Ingryd: "separações e filtros mais inteligentes, seguindo as categorias do Obsidian; ficha com o caminho de e-mails de quem entra num canal; tela de fluxo por tipo de chegada, com edição direta no template, nível Mailchimp". A entrega foi dividida em três partes, na ordem abaixo, cada uma com spec, plano e implementação próprios.

| Parte | O que entrega | Depende de |
|---|---|---|
| **1. Taxonomia e filtros** (esta spec) | Cada modelo de e-mail passa a ter família, página de entrada, etapa e persona. A lista agrupa por isso. Os filtros e as visões usam isso. "Outros" deixa de existir. | nada |
| 2. Ficha da pessoa | Canal de entrada, linha do tempo (enviados, próximo, quando), "Enviar agora", regra de ritmo. | parte 1 |
| 3. Fluxo e editor | Tela de fluxo por página, editor do e-mail por blocos (título, botão, destaque…), esperas editáveis, carga dos e-mails das páginas I01–I04. | partes 1 e 2 |

A maquete clicável que a Ingryd aprovou mostra as três partes (`maquete-crm-fluxos.html`, sessão de 2026-11-09). Nesta spec só vale a aba "1 · Lista e filtros".

## 1. Problema

A tela Modelos de e-mail (`renderLista` em `admin/crm/crm.js`) agrupa por `CATEGORIAS`, regras de regex sobre `chave` (`crm.js` perto da linha 72): Acesso e boas-vindas, Compra e pagamento, Reimpacto, Guias e materiais e **Outros**. Hoje "Outros" guarda 16 de 32 modelos (12 do aquecimento do Campus France, o lançamento do Hub, o lembrete de prazo e outros). Não há filtro nenhum. As categorias não correspondem ao que ela desenhou no Obsidian (`vault/Percursos Por Dentro/11 CRO/12 E-mail por página/`), onde o e-mail é organizado por **página de entrada → etapa → ponto de partida (porta)**.

## 2. Escopo

**Dentro**
- Quatro colunas novas, só de acréscimo, em `modelos_email`, mais o preenchimento dos modelos que já existem.
- Catálogo único de famílias, páginas, etapas e personas (`admin/crm/taxonomia.js`).
- Lista agrupada por página e etapa, e por família quando o modelo não tem página.
- Barra de filtros e visões prontas na tela Modelos de e-mail.
- Campos de classificação na criação de modelo novo e em "Objetivo e envio" do estúdio.
- Modo de reserva quando o SQL ainda não foi rodado.

**Fora (e onde entra)**
- Ficha com caminho, próximo e-mail e quando: parte 2.
- Tela de fluxo, esperas editáveis e editor por blocos: parte 3.
- Carregar no CRM os e-mails das páginas I01–I04 (`emails-por-pagina.json`, 169 combinações, uns 20 modelos com bloco por porta): parte 3. Hoje só existe `tec_recap_30min` da página I02.
- Visão "No ar sem ninguém recebendo" (precisa de contagem em `emails_enviados`): parte 3.
- Mudança no Worker (`cms-oauth-worker`): nenhuma. Ele lê `modelos_email?select=*` e continua funcionando com colunas a mais.
- Imagens nos e-mails: não existem hoje no estúdio. Fica fora até haver pedido.

## 3. Decisões tomadas

1. **Abordagem A:** um modelo por página × etapa; a porta (Au pair, PVT, Brasil, Cônjuge) é bloco condicional dentro do modelo, não modelo separado. (Parte 3 usa isso; a parte 1 só deixa o modelo pronto para receber `pagina` e `etapa`.)
2. **"Tipo de chegada" = página de entrada** (I01–I04), não persona. Persona entra como filtro e como atributo das séries por persona (AP, PV, ES, CJ).
3. **Sem tabela nova e sem função nova.** Só colunas em `modelos_email`, que já tem RLS ligada com política `eh_admin()`. Por isso o sentinela de isolamento (`isolamento.test.mjs`) não muda e `conferir-banco.sql` não ganha item.
4. **Nunca sobrescrever o que ela classificar à mão.** O preenchimento inicial só toca em colunas ainda `null`.

## 4. Modelo de dados

Arquivo novo: `admin/crm/db/crm-taxonomia-modelos.sql` (rodar depois de `crm-sequencia-minutos.sql` e `crm-modelo-tecnologo-recap.sql`; idempotente; só acrescenta).

```sql
alter table public.modelos_email add column if not exists familia text;
alter table public.modelos_email add column if not exists pagina  text;
alter table public.modelos_email add column if not exists etapa   text;
alter table public.modelos_email add column if not exists persona text;
```

Constraints (criadas só se não existirem, no mesmo padrão de `crm-estudio-emails-3.sql`):

| Coluna | Valores | Regra |
|---|---|---|
| `familia` | `entrega`, `personalizado`, `aquecimento`, `serie`, `compra`, `acesso`, `reimpacto`, `campanha` | pode ser `null` (modelo ainda sem classificação) |
| `pagina` | `I01`, `I02`, `I03`, `I04` | pode ser `null` |
| `etapa` | texto `^[a-z0-9-]{2,40}$` | só pode ter valor se `pagina` tiver (`check (etapa is null or pagina is not null)`) |
| `persona` | `au_pair`, `pvt`, `estudante`, `conjuge` | `null` = serve a todas |

O gatilho `modelos_email_envio_confere` só olha campos de Envio, de origem e de exclusão; atualizar as colunas novas passa por ele sem erro. Isso será coberto por teste.

### Preenchimento dos modelos existentes

Um bloco `update … where familia is null` com a tabela abaixo (chave exata ou prefixo). Os valores de `pagina`/`etapa` só são atribuídos onde o vault confirma a página.

| Modelo (chave) | familia | pagina | etapa | persona |
|---|---|---|---|---|
| `boas_vindas`, `acesso_*` | acesso | | | |
| `link_pagamento*`, `hub_estudos_compra`, `hub_estudos_d3` (tipo `compra`) | compra | | | |
| `naoabriu`, `naoclicou`, `cliquenaoapp`, `parouapp` | reimpacto | | | |
| `cf_guia_1`, `cf_guia_conversa` | entrega | I03 | | |
| `aq_a_*`, `aq_b_*`, `aq_c_*` (12 modelos) | aquecimento | I03 | | |
| `guia_alternancia` | entrega | I01 | | |
| `guia_chamada`, `guia_plataforma` | entrega | I04 | | |
| `tec_recap_30min` | entrega | I02 | | |
| chegada da au pair (`crm-modelos-chegada-au-pair.sql`) | entrega | | | au_pair |
| `hub_estudos_lancamento`, `lembrete_prazo_vlsts` | campanha | | | |
| qualquer outro que sobrar | fica `null` | | | |

A implementação confere as chaves reais contra `db/modelos-*.mjs` e `crm-modelos-chegada-au-pair.sql` antes de fechar a tabela; chave que não bater fica `null` e aparece em "Sem classificação" (seção 6).

## 5. Catálogo (código)

Arquivo novo `admin/crm/taxonomia.js`, módulo ES no mesmo estilo de `estudio.js`, sem dependência. É a única fonte dos rótulos e da ordem na tela; o banco guarda só os códigos.

```js
export var FAMILIAS = [ /* ordem de exibição e rótulo */ ];
export var PAGINAS  = [ { k:'I01', nome:'Alternância 30+', rota:'/guias/email-alternancia-30-mais/', etapas:[…] }, … ];
export var PERSONAS = [ ['au_pair','Au pair'], ['pvt','PVT'], ['estudante','Estudante'], ['conjuge','Cônjuge'] ];
export function classifica(m) { /* {familia, pagina, etapa, persona} do banco, ou do modo de reserva */ }
export function rotuloPagina(k), rotuloEtapa(pagina, etapa)
```

Páginas e etapas (espelham `emails-por-pagina.json` e `ETAPAS_GUIA` em `estudio.js`):

| Página | Rota | Etapas (código → rótulo) |
|---|---|---|
| I01 · Alternância 30+ | `/guias/email-alternancia-30-mais/` | `alt-pesquisando` Pesquisando · `alt-escolhendo-escola` Escolhendo escola · `alt-recusa-idade` Ouviu "só até 29" · `alt-buscando-empresa` Buscando empresa · `alt-montando-contrato` Montando contrato |
| I02 · Tecnólogo do Brasil | `/guias/tecnologo-nivel-na-franca/` | `tec-nao-sei` Não sei o nível · `tec-juntando` Juntando documentos · `tec-escrevi` Esperando resposta · `tec-resposta` Tenho resposta |
| I03 · Études en France 2027-2028 | `/guias/etudes-en-france-2027-2028/` | `cf-nao-comecei` Ainda não começou · `cf-escolhendo-curso` Escolhendo o curso · `cf-juntando-documentos` Juntando documentos · `cf-dossie-enviado` Dossiê enviado · `cf-entrevista-resposta` Entrevista ou resposta |
| I04 · VLS-TS travou na ANEF | `/guias/vls-ts-validacao-travou/` | `vls-ainda-nao` Ainda não cheguei · `vls-mais-60` Mais de 60 dias · `vls-30-60` De 30 a 60 dias · `vls-menos-30` Menos de 30 dias · `vls-passou` Passaram os 3 meses |

O nível do I03 (`l1`, `l2l3`, `lpro`, `master`, `arq`, `escola`) é variável de bloco dentro do e-mail, não etapa nem filtro.

Famílias, na ordem da lista: Entrega do material · E-mail personalizado da página · Aquecimento · Séries por persona · Teste, oferta e compra · Acesso e boas-vindas · Reimpacto · Campanhas.

**Sincronia com o vault:** o CRM é público e o vault é privado, então o catálogo é copiado, não lido em tempo de execução. O cabeçalho de `taxonomia.js` diz de qual arquivo do vault cada tabela vem e a data da última conferência. Mudou página ou etapa no Obsidian → atualizar `taxonomia.js` no mesmo dia (mesma regra do `SHARED.md`).

## 6. Lista de modelos (barra lateral)

Substitui `CATEGORIAS`, `categoriaDe` e `porCategoria` em `crm.js`.

**Ordem dos grupos**
1. **Páginas de entrada:** um grupo por página (I01, I02, I03, I04). Dentro, um subtítulo por etapa, na ordem do catálogo; modelos da página sem etapa (entrega, aquecimento) ficam sob o subtítulo da família.
2. **Por família**, para quem não tem página: Entrega do material, Séries por persona (subtítulo por persona), Teste/oferta/compra, Acesso e boas-vindas, Reimpacto, Campanhas.
3. **Sem classificação** (só aparece se existir um modelo com `familia` e `pagina` nulos): grupo com selo de atenção. Nunca se chama "Outros".
4. **Excluídos**, no fim, como hoje.

Dentro de cada grupo a ordem é `ordem`, depois `nome`. Cada grupo mostra a contagem (já filtrada) e abre/fecha, como hoje (`CAT_FECHADA`). Cada item mantém o que tem hoje: bolinha de estado, linha de estado e Envio, botão de excluir. O seletor "Escrever e-mail" (`opcoesPorCategoria`) passa a usar os mesmos grupos.

## 7. Filtros e visões

Uma barra acima da lista de modelos (mesma tela, mesmo painel):

| Filtro | Valores | Lógica |
|---|---|---|
| Página | I01–I04, "sem página" | vários marcados = ou |
| Etapa | etapas das páginas marcadas | só aparece com página marcada |
| Família | as 8 | vários = ou |
| Persona | as 4 | mostra `persona = X` **e** `persona = null` (modelos para todas); chip "só específicos" tira os `null` |
| Tipo | `servico`, `novidades`, `compra` | já existe a coluna `tipo` |
| Situação | No ar, Rascunho, Em revisão, Envio ligado, Envio desligado, Sem teste | calculado de `modelos_email_versoes` (`etapa`, `testado_em`) e de `envio_ligado` |

Entre filtros diferentes a lógica é **e**. Busca por texto no nome e no objetivo. Um botão "Limpar filtros" e um contador "N de M modelos".

**Visões prontas** (atalhos que só marcam filtros): Rascunhos para revisar (situação Rascunho ou Em revisão) · Esperando o meu teste (versão em obra sem `testado_em`) · Envio ligado · Sem classificação.

O estado dos filtros vive só na página (como `CAT_FECHADA`); ele não vai para o banco. Visões salvas pela usuária ficam fora desta parte.

## 8. Classificar um modelo

- **Criação ("+ Modelo novo")** e a seção **"Objetivo e envio"** do estúdio ganham os campos Família, Página, Etapa e Persona. O objetivo do catálogo (`OBJETIVOS`, `objetivo_chave`) sugere a família: `freebie` → entrega, `boas_vindas` → acesso, `conversa` → entrega, `aquecimento` → aquecimento, `reimpacto` → reimpacto, `convite` e `compra` → compra, `lembrete` e `lancamento` → campanha. Ela pode trocar.
- O seletor de etapa só mostra as etapas da página escolhida.
- Modelo sem família nem página aparece em "Sem classificação" com a mensagem "escolha onde este e-mail mora", e o estúdio não impede salvar nem publicar.
- Gravação: `supabase.from('modelos_email').update({ familia, pagina, etapa, persona })`, no mesmo caminho do `update(patch)` existente (`crm.js` perto da linha 2756).

## 9. Estados de UI e modo de reserva

- **Carregando / vazio / erro:** reaproveitam o que a tela já faz. Filtro sem resultado mostra "Nenhum modelo com esses filtros" e o botão Limpar filtros.
- **SQL ainda não rodado** (colunas ausentes em `M[0]`): a lista usa `classifica` em modo de reserva, que aplica a tabela da seção 4 em memória (por chave e prefixo), sem gravar. Os campos da seção 8 ficam desabilitados com o aviso "rode `db/crm-taxonomia-modelos.sql`". É o mesmo padrão de `renderModelos` quando falta `crm-estudio-emails-2.sql`.
- **Acessibilidade e 380 px:** grupos são `<details>` como hoje; filtros são botões com `aria-pressed`; a barra de filtros quebra em linhas e a lista continua usável em 380 px.

## 10. Testes e verificação

- `db/testes/crm-taxonomia-modelos.test.mjs` (PGlite, mesmo padrão dos outros), com script `test:taxonomia` em `db/testes/package.json`:
  - o SQL roda duas vezes sem erro;
  - as constraints rejeitam `familia`, `pagina` e `persona` fora da lista e `etapa` sem `pagina`;
  - o preenchimento classifica as chaves da seção 4 e **não** altera um modelo já classificado à mão;
  - atualizar as colunas novas não dispara o erro do gatilho `modelos_email_envio_confere`;
  - o Worker (`select=*`) continua lendo o modelo (verificação com a consulta que ele faz).
- `db/testes/crm-taxonomia-ui.test.mjs`: testes de `taxonomia.js` (`classifica` em modo banco e em modo de reserva, ordem de grupos, lógica de filtros, regra de persona com `null`).
- Testes existentes que não podem quebrar: `npm test`, `test:modelos`, `test:estudio`, `test:estudio3`, `test:prontos`, `test:etapa`, `test:minutos`, `test:conferir`, o sentinela `isolamento.test.mjs` e `test:proximo-email-ui`.
- Verificação no navegador antes de entregar: tela Modelos de e-mail com dados reais do Supabase de teste, 32 modelos, nenhum em "Outros"; filtros combinados; modo de reserva (sem rodar o SQL); largura de 380 px.

## 11. Entrega e riscos

- **Ordem:** SQL primeiro no Supabase de **teste**, depois no de produção (`docs/AMBIENTES.md` do app). Depois de rodar nos dois, a Ingryd roda `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` do app. Os dois devem voltar vazios. O painel funciona antes e depois do SQL (modo de reserva).
- **Documentação:** nova seção em `admin/crm/PLANO.md` ("Taxonomia dos modelos") com o nome do SQL, como rodar e como desfazer (`alter table … drop column if exists familia, … pagina, … etapa, … persona`).
- **PR:** base `main` do website; o painel não tem staging próprio, então o teste é o Supabase de teste.
- **Risco: o catálogo andar sozinho do vault.** Mitigação: cabeçalho de `taxonomia.js` com origem e data, e a regra de atualizar no mesmo dia.
- **Risco: chave de modelo que o preenchimento não conhece.** Mitigação: vai para "Sem classificação" com aviso, sem esconder.
- **Risco: tamanho de `crm.js`** (já passa de 4 mil linhas). Mitigação: lógica nova de classificação e filtros vai para `taxonomia.js`, que é testável sem DOM; `crm.js` só renderiza.

## 12. Critério de pronto

- Nenhum dos 32 modelos atuais aparece em "Outros"; os que o vault não confirma aparecem em "Sem classificação" com aviso.
- Os 12 modelos de aquecimento e os guias do Campus France aparecem sob a página I03.
- Filtros por página, etapa, família, persona, tipo e situação funcionam combinados, e as 4 visões prontas marcam os filtros certos.
- Criar um modelo novo permite escolher família, página, etapa e persona, e isso fica gravado.
- Todos os testes da seção 10 passam; sentinela de isolamento verde.
- Funciona com e sem o SQL rodado, e em 380 px.
- `PLANO.md` atualizado.
