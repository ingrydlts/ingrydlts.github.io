# Microengajamento, ferramenta-assinatura e capas

Referência dos blocos que deixam cada artigo interativo e que viram dado. Vale pro
**Corpo do artigo** (editor visual do /admin) e, nos artigos com página própria, pro
campo **Blocos de microengajamento**.

## A regra de cada artigo

| Peça | Quantos | Bloco |
|---|---|---|
| Capa por palavra-chave | 1 | campos `coverKeyword`, `coverTags`, `coverFormat` |
| Resumo em 20s | 1, logo depois da abertura | `[[RESUMO]]` |
| Termômetro de confiança | 1, logo depois do resumo | `[[CONFIANCA]]` (o "depois" aparece sozinho no fim) |
| **Ferramenta-assinatura** | **1** | `[[PRAZO]]`, `[[QUIZ]]`, `[[SELETOR]]`, `[[LINHA-DO-TEMPO]]` ou `[[ROTEIRO]]` |
| Apoio | até 3 | `[[MITO]]`, `[[POLL]]`, `[[CHECKLIST]]`, `[[STEPS]]`… |
| FAQ | 1 | `[[FAQ]]` |
| Próximo passo → Soluções digitais | 1 | `[[PROXIMO-PASSO]]` |
| Trilha | se o artigo fizer parte de uma | `[[TRILHA]]` |
| Feedback | 1, sempre por último | `[[FEEDBACK]]` |

O quadro de artigos do /admin mostra essa lista em cada artigo, com ✓ e o que falta.

## Capa por palavra-chave

A capa é desenhada pelo site (`assets/js/cover.js`). A cor vem do pilar da categoria:

| Pilar | Cor | Categorias |
|---|---|---|
| Trâmites | verde #577328 | Visto, ANEF, Exame Cívico, Au Pair |
| Vida prática | azul #8AACD2 | Custo de Vida, Moradia |
| Vínculos | bege #DEB975 | Família, Relacionamento |
| Crescimento | esmeralda #063B35 | Francês, Formação, Bolsas de Estudo |
| Leveza | creme #F4E7CE | Viagens |

Categoria nova? Acrescente em `PILLARS` no `cover.js` (sem isso ela cai em Trâmites).

- **Palavra-chave**: 1 termo, até 15 caracteres, o que a pessoa buscaria (VLS-TS, APL, ANEF). Nunca repetir dentro do mesmo pilar.
- **Apoio**: até 3 palavras curtas, em minúsculas (prazo, 3 meses, validação).
- **Formato**: Guia · Passo a passo · Comparativo · Mapa · Roteiro · Checklist · Série · ep. N.

Sem palavra-chave, o site usa a foto do campo "Foto de capa", como antes. A foto continua
sendo a imagem de compartilhamento.

## Os blocos

Colunas separadas por `|`. Cada bloco abre com `[[NOME]]` e fecha com `[[/NOME]]`, cada um na sua linha.

### Ferramentas-assinatura

**`[[PRAZO]]`**: calculadora de prazo com dias restantes e status (tranquila, atenção, urgente, vencido).
```
[[PRAZO]]
Quantos dias você ainda tem pra validar?
Data de entrada na França | 3 meses
[[/PRAZO]]
```
Duração: `90 dias`, `3 meses`, `2 semanas`, `1 ano`.

**`[[QUIZ]]`**: mini-simulado com nota. A certa leva `*`; a explicação vem depois de `||`.
```
[[QUIZ]]
Mini-simulado: você passaria?
Quantas questões tem o exame? | 20 | *40 | 60 || São 40: 28 de conhecimento e 12 situacionais.
[[/QUIZ]]
```

**`[[SELETOR]]`**: "qual é o seu caso?". Cada opção soma ponto pra uma ou mais chaves; ganha a mais escolhida.
```
[[SELETOR]]
Qual ajuda de moradia é a sua?
? Onde você mora? | Aluguel privado > apl | HLM ou foyer > alf | Outro > als
= apl | APL | Pra aluguel em imóvel privado. | Simular na CAF | https://www.caf.fr/…
= alf | ALF | Pra HLM ou foyer. | Simular na CAF | https://www.caf.fr/…
= als | ALS | Pra quem não se encaixa nas outras. | Simular na CAF | https://www.caf.fr/…
[[/SELETOR]]
```
O link do resultado é opcional (sem link, sem botão).

**`[[LINHA-DO-TEMPO]]`**: a leitora escolhe uma data e cada etapa ganha a data dela.
```
[[LINHA-DO-TEMPO]]
Seu calendário de recursos
Data em que você depositou o dossiê
0 | Dossiê depositado
+4 meses | Carta registrada ao Préfet
+6 meses | Prazo de resposta
[[/LINHA-DO-TEMPO]]
```

**`[[ROTEIRO]]`**: lista pra marcar "Quero ir / Já fui", salva no aparelho.
```
[[ROTEIRO]]
Seu roteiro de 24h em Reims
Le Privilè'g | 3 champagnes por 20€ | https://…
[[/ROTEIRO]]
```

Ferramentas próprias que já existem e contam como assinatura: `[[MAPA-FLE]]`,
`[[VAE-SIMULADOR]]`, `[[DIPLOMA-DOSSIE]]`, `[[AU-PAIR-FLE-SCROLL]]`, `[[EXAME-TEMPLATE-GRATIS]]`.

### Microengajamento

**`[[RESUMO]]`**: uma linha por tópico, até 3 ou 4.

**`[[CONFIANCA]]`**: só a pergunta ("Quão segura você está sobre…?"). No fim do artigo a mesma pergunta volta e mostra a diferença.

**`[[MITO]]`**: `afirmação | mito ou verdade | explicação`. A 1ª linha (opcional) é o título.

**`[[PROXIMO-PASSO]]`**: uma regra por linha, de cima pra baixo; a primeira que bater aparece.
```
[[PROXIMO-PASSO]]
se prazo<=45 | Não deixe pra última semana | Texto | Botão | /checklist-preview/
se enquete=Comecei e travou | Destrave a validação | Texto | Botão | /checklist-preview/
padrao | Validou? Organize a vida em euros | Texto | Ver a planilha | /produtos-digitais/produto/?slug=planilha-financeira-super-integrada
[[/PROXIMO-PASSO]]
```
Condições: `prazo<=45`, `prazo<0` (dias restantes do `[[PRAZO]]`) · `enquete=Opção exata` (do `[[POLL]]`)
· `seletor=chave` · `quiz<60` (% de acerto) · `checklist=completo` · `confianca<=2` (resposta do "antes").

**`[[TRILHA]]`**: 1ª linha = nome; depois um slug por linha, na ordem (inclua o do próprio artigo).

### Na página, sem bloco

- **Pergunta pra Ingryd**: formulário com nome, e-mail, pergunta, aceite da Política de Privacidade
  e caixinha de newsletter, no fim de todo artigo, logo antes do rodapé (`assets/js/leads.js`).
  Vai pro CRM (`enviar_pergunta_unica`) e aparece em /admin/crm → **Perguntas únicas**, onde você
  responde.
- **Lembrete de prazo**: dentro do resultado do `[[PRAZO]]`, quando faltam mais de 15 dias, a
  leitora deixa nome e e-mail. Vai pro CRM (`pedir_lembrete_prazo`) e aparece em /admin/crm →
  Hoje → **Lembretes de prazo** na semana em que é hora de avisar (15 dias antes do prazo).

- Barra de progresso de leitura no topo, com eventos em 25/50/75/100%.
- Sumário "Nesta página" marca ✓ nas seções já lidas.
- Selecionar uma frase abre "Grifar / Copiar / Perguntar sobre isso".
- "Essa parte ficou clara?" no fim de cada seção, ligado pelo campo do artigo `sectionReactions`.

## Os dados

Tudo sai por `PDEvents.send("block", slug, { type, … })`, só depois do consentimento de
cookies, e é gravado no D1 pelo Worker (que já aceita, sem mudança). Tipos novos:

`read_progress` · `confidence` · `tool_use` · `quiz_result` · `selector_result` · `myth_answer` ·
`roteiro_mark` · `lead_submit` (sem nome nem e-mail) · `solution_click` · `series_click` · `section_reaction` ·
`highlight` · `highlight_copy` · `tldr_open`

O Worker aceita 20 eventos por minuto por pessoa, por isso só vira evento o que é resposta ou decisão.

Nome, e-mail, pergunta e data do lembrete não passam pelos eventos: vão direto pro CRM no
Supabase (`admin/crm/db/crm-fase2.sql` e `crm-fase2c-lembretes.sql`), com o mesmo aceite e a mesma
versão de texto do funil (`site-v1`).

## Escrever um artigo novo com o robô

Veja `admin/prompts/robo-escritor-de-artigos.md`: é o texto pra colar nas instruções do
robô. Ele devolve um **pacote** que o /admin entende:

1. O robô escreve o pacote (`===ARTIGO POR DENTRO===` … `===FIM===`).
2. No /admin → Blog → **Abrir quadro de artigos** → **🧠 Colar do robô**.
3. Cole o pacote. À direita aparecem a capa e a conferência (palavra repetida, falta de FAQ…).
4. **Criar artigo** → ele entra na coluna **Revisão**, com todos os campos e blocos preenchidos.
5. Ajuste o que quiser no editor visual (blocos arrastáveis), confira a prévia e publique.

As propostas que o robô sugeriu e não entraram ficam em **Notas do robô** (só você vê).
