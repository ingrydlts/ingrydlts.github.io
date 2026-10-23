# Onboarding por chamada: documento → ficha → 30 dias de acesso → plano

> **Pronto em 23/10/2026 (Etapa 1 do `PLANO-PRIMEIRO-ONBOARDING.md`):** menu **Onboarding** (e-mail obrigatório, documentos, anotações da chamada), leitura por IA no Worker (`/api/crm/onboarding/ler`), ficha criada/atualizada pelo e-mail com o Dossiê preenchido (o que a Ingryd digitou prevalece), origem e confiança de cada campo, lista **"falta perguntar"** no topo da ficha, eventos `onboarding_documento_lido` e `link_pagamento_enviado` na linha do tempo, botão **Enviar link de pagamento** na aba Plataforma (`links-pagamento.json`, modelo `link_pagamento` no Estúdio). **Decisão nova:** o arquivo não é guardado (não há bucket nem "Confirmar dados": o Worker lê e descarta), o que simplifica a seção 2. **Ainda não feito:** convite, conta no Supabase Auth, `criar-senha`, webhook do Stripe, controle do dia 30, planos no app (seções 3, 4 e 11 em diante). Como ligar: README do Worker, seção 24.

> Escrito em 2026-10-22, revisado após as respostas dela. **É uma proposta**: nada aqui vira código até virar item no Major Tasks do Notion.
> Verificado no código: `admin/crm/DOSSIE.md`, `db/crm-fase1.sql` e `db/schema.sql` (app), `criar-senha/index.html` (app), `cms-oauth-worker/worker.js`.
> O que não dá para afirmar sem testar aparece como **[conferir]**.

## Decisões já tomadas

| # | Decisão |
|---|---|
| 1 | Documentos **são apagados depois de lidos**. Fica só o que o Dossiê já define como relevante para o acompanhamento. |
| 2 | A fala da chamada entra como **texto** (anotações ou transcrição colada). |
| 3 | E-mails pelo **Estúdio de e-mails**, na voz dela. |
| 4 | O **caminho de estudo** é perguntado na chamada e vem no documento do onboarding. Não há segunda escolha depois. |
| 5 | **Pró-lançamento: 30 dias de acesso completo.** Depois, a pessoa escolhe o plano. |
| 6 | Se a assinatura for cancelada ou falhar, o acesso vale **até o fim do período pago**. |
| 7 | **Três planos:** mensal (sem desconto), semestral (6 × o mensal, **5%** de desconto) e anual (12 × o mensal, **10%** de desconto). |
| 8 | A pessoa **escolhe a moeda (€ ou R$)**. A conta Stripe é da França. |
| 9 | **Cartão obrigatório nos 30 dias.** Depois do dia 30 sem plano escolhido, o painel **bloqueia** (nada é apagado). |
| 10 | **Reembolso:** só ela decide; cancela a assinatura, não a conta (seção 10). |
| 11 | **1:1:** 40 min no onboarding (prioridade na agenda); 30 min dentro do app, com o assunto informado antes (seção 13). |

> **Mudança em relação à versão anterior:** antes o desenho era "pagar primeiro, conta depois". Com os 30 dias de acesso, a conta nasce **no começo do período grátis** e a escolha do plano acontece **no dia 30**. As seções 3 e 4 foram refeitas por isso. A seção 11 traz a proposta de preço.

---

## 0. O fluxo

1. Você faz a chamada e apresenta o valor.
2. No CRM, **solta o documento** (e cola suas anotações). O sistema lê, **cria o contato** e abre a ficha com o Dossiê preenchido.
3. Você revisa a ficha, digita o e-mail e clica **Enviar convite de acesso**.
4. Ela abre o link, aceita os termos e **ganha 30 dias de acesso completo**.
5. A conta é criada com o perfil pronto e ela recebe o e-mail "acesso confirmado" com o link para **criar a senha**.
6. Ela cria a senha e entra no painel com o checklist montado.
7. Perto do dia 30, o painel e o e-mail pedem a **escolha do plano** (seção 11).

Antes de ela aceitar o convite **não existe conta**: só o contato no CRM.

---

## 1. O que já existe e é reaproveitado

| Peça | Onde | Papel |
|---|---|---|
| **Ficha** e **Dossiê** (`contatos.dossie`) | CRM | A página que abre. O `DOSSIE.md` já prevê "copiar o dossiê para o perfil dela": esta é essa etapa. |
| `contatos` + trigger `crm_on_auth_user` | banco | Liga a conta ao contato pelo e-mail; registra `acesso_ativado` e `senha_definida` na linha do tempo. |
| Stripe via REST no Worker (`STRIPE_SECRET_KEY`, `verify-session`, checkout embutido) | Worker | Já conversa com o Stripe. **Ainda não recebe webhook**: precisa ser acrescentado. |
| Tabela `subscriptions` | `db/schema.sql` | Já existe (cliente, assinatura, status, fim do período), mas nada a preenche hoje. |
| `crmRequireAdmin`, service role, Brevo, Estúdio de e-mails | Worker/CRM | Rotas só de admin e envio de e-mail editável. |
| `gerarChecklist`, `prazos.js`, `data-integrity.js` | app | Continuam sendo os únicos que calculam checklist, prazo e incongruência. |

---

## 2. Soltar o documento e abrir a ficha

**Onde:** botão **Novo por documento** na lista de Contatos, e uma área de soltar arquivo dentro de qualquer ficha.

- O Worker lê o documento (passaporte, VLS-TS, titre de séjour, contrat d'accueil, certificado de matrícula, carta de aceite) e as suas anotações, e extrai os campos do Dossiê, **inclusive o caminho de estudo**.
- Cria o contato e abre a ficha. Se já existir um lead com aquele e-mail ou nome, **acrescenta à ficha existente**.
- Cada campo mostra **de onde veio** (documento, fala, você digitou) e **quanto a IA confia**. Campo sem fonte fica vazio e entra numa lista **"falta perguntar"**. Tudo editável: a IA sugere, você confirma.
- **E-mail:** documento quase nunca traz. O botão de convite fica desabilitado até você digitar.

### O que acontece com o arquivo (decisão 1)

1. O arquivo sobe para um bucket **privado** só para ser lido.
2. Quando você clica **Confirmar dados**, o arquivo é **apagado**. Ficam só os campos do Dossiê.
3. Rede de segurança: sem confirmação, apaga sozinho em **7 dias** **[ajustável]**.
4. O número do documento só é gravado se o Dossiê pedir. Hoje não pede.

---

## 3. O convite de acesso

Botão **Enviar convite de acesso** na ficha (rota nova do Worker, só admin):

1. Gera um link único e assinado para aquele contato (`/entrar/?t=...`), com validade.
2. Envia o e-mail `convite_acesso` (Estúdio de e-mails). Registra `convite_enviado` na ficha; o botão vira **Reenviar convite**.

**A página `/entrar/`** (só abre com o link assinado):
- Mostra o nome dela e o que ela ganha: **30 dias de acesso completo**, sem escolher plano agora.
- Mostra os termos e a política de privacidade. O aceite grava o **consentimento** com o texto exato que ela viu. Novidades por e-mail continuam opt-in separado.
- Ao confirmar, o Worker cria a conta (seção 4).
- Aqui ela cadastra o **cartão** (decisão 9); não é cobrado agora.

---

## 4. Conta criada → senha → dia 30

Ao confirmar o convite, o Worker:

1. Cria o usuário no Supabase Auth **sem senha**. O trigger existente liga ao contato.
2. Numa transação só (`crm_ativar_conta`): copia o Dossiê para `profiles`, grava `key_dates`, o resumo da chamada na linha do tempo, uma linha em `subscriptions` com status `trialing` e **`fim_teste` = hoje + 30 dias**, e `convite_pendente = true`. Se falhar, o usuário criado é apagado.
3. Envia o e-mail `acesso_confirmado` (Estúdio): confirma que a entrada na plataforma deu certo e traz o **link para criar a senha**.

O cartão é guardado no Stripe na própria página `/entrar/`, **sem cobrar e sem escolher plano** (modo "salvar cartão"). O plano e a moeda são escolhidos depois, até o dia 30, e a assinatura nasce com o primeiro pagamento marcado para o dia 30. Um webhook mantém `subscriptions` em dia (11.4).

### O que o painel faz perto do dia 30

- **Dia 20:** aviso discreto no painel e e-mail "faltam 10 dias, escolha seu plano".
- **Dia 30 sem plano escolhido:** o painel abre numa tela **"Escolha seu plano para continuar"**. Os dados dela ficam guardados, nada é apagado. O painel **fica bloqueado** até ela escolher (decisão 9).
- **Plano escolhido:** `subscriptions` vira `active`.
- **Cancelamento ou falha de pagamento:** o acesso continua **até o fim do período já pago** (decisão 6). O painel mostra "seu acesso vai até dd/mm".

### A senha (e o problema do código atual)

Hoje `criar-senha/index.html` redireciona direto ao dashboard quando `onboarding_concluido` já é `true`. Como o perfil nasce pronto, ela clicaria no e-mail e **entraria sem nunca definir senha**.

**Solução:** com `convite_pendente = true`, `criar-senha` mostra **só os campos de senha** (sem perguntar persona nem refazer o upsert) e, ao salvar, desliga a flag e vai ao dashboard. Sem a flag, tudo segue como hoje.

**Checklist:** o Worker não monta checklist (a regra vive em JS no app). Ele grava `pre_concluidos` (passos que o documento provou). No primeiro acesso o app roda o `gerarChecklist` de sempre e marca esses passos como concluídos.

**[conferir]** validade do link de criação de senha no Supabase. Plano B: botão **Reenviar acesso** na ficha.

---

## 5. O que a IA faz e não faz

| Faz | Não faz |
|---|---|
| Extrai campos objetivos de documento e imagem (nome, datas, validade, tipo de visto, curso, caminho de estudo) | Calcular prazo, checklist ou viabilidade |
| Lê suas anotações e preenche o Dossiê | Inventar: sem fonte, campo vazio |
| Sugere persona e caminho, explicando por quê | Decidir a persona sozinha |
| Marca como já feito o que o documento prova | Marcar feito só porque ela "disse que sim" |
| Escreve um resumo de 3 a 5 linhas da chamada | Guardar a transcrição inteira |
| Aponta incongruência (regra do `data-integrity.js`) | Corrigir sozinha |

Roda **só no Worker** (`ANTHROPIC_API_KEY` como secret do Cloudflare, nunca no navegador). Modelo configurável por variável de ambiente. Resposta em JSON validado, campo a campo `{valor, origem, confianca}`; se não validar, tenta mais uma vez e para. O custo estimado de cada leitura aparece na ficha.

---

## 6. Dados sensíveis (RGPD/LGPD)

- Passaporte e visto são dados pessoais de quem vive na França: o RGPD vale.
- O arquivo existe só entre o envio e o **Confirmar dados**. Nunca em repositório, log ou Brevo.
- O arquivo vai à API de IA para ser lido: isso precisa constar em `/confidentialite/`. **[conferir]** a política de retenção da API antes de ligar.
- `consentimentos.finalidade` hoje aceita só `servico` e `novidades_email`. Acrescentar `documentos` e gravar o texto exibido em `/entrar/`.
- Apagar o contato continua apagando tudo em cascata. **[conferir]** o que precisa ser retido por obrigação fiscal depois de uma cobrança.

---

## 7. O que muda em cada repositório

| Repositório | Mudança |
|---|---|
| **site** (`admin/crm`, `cms-oauth-worker`, páginas `/entrar/` e escolha de plano) | "Novo por documento"; botão de convite; rotas `ler`, `convite`, `escolher-plano` e **webhook do Stripe**; modelos `convite_acesso`, `acesso_confirmado`, `escolha_de_plano`; secrets `ANTHROPIC_API_KEY` e `STRIPE_WEBHOOK_SECRET`; preços criados no Stripe |
| **app** (`db/`, `criar-senha/`, dashboard) | `db/crm-onboarding.sql` (`convite_pendente`, `pre_concluidos`, `fim_teste`, finalidade `documentos`, função `crm_ativar_conta`, bucket); ajuste do `criar-senha`; tela "Escolha seu plano"; aplicar `pre_concluidos` no primeiro acesso; regra de acesso por `subscriptions` |
| **instagram-hub** | Nada |

---

## 8. Entregas, em ordem

| # | Entrega | O que você ganha |
|---|---|---|
| 1 | **Convite → conta → senha → 30 dias**, com Dossiê manual: botão, `/entrar/`, `crm_ativar_conta`, e-mails, ajuste do `criar-senha`, regra de acesso por data | Já dá para ativar quem você atender no lançamento. |
| 2 | **Soltar documento** → cria contato, abre ficha, preenche o Dossiê (o arquivo é descartado logo após a leitura) | Para de digitar o que está no documento. **Feito em 23/10/2026** |
| 3 | **Escolha de plano + Stripe + webhook** (precisa do preço decidido) | A cobrança começa a valer no dia 30 |
| 4 | **Anotações da chamada** + lista "falta perguntar" + resumo na linha do tempo | O roteiro da chamada. **Feito em 23/10/2026** (junto com a 2; o resumo é o `ligacao_resumo` do Dossiê) |
| 5 | Reenviar convite/acesso, custo por leitura, estados de pagamento na ficha | Fechamento |

A entrega 3 vem depois da 1 de propósito: o primeiro grupo de pessoas já usa os 30 dias, e o preço pode ser testado com elas antes de virar código.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Paga e a conta não é criada (se houver cartão) | Webhook idempotente com retentativa do Stripe; botão de reprocessar na ficha |
| Cobrar no dia 30 quem esqueceu que tinha cartão | E-mail no dia 20 e no dia 27 com data e valor; obrigação legal de informar |
| IA lê errado uma data | Origem e confiança por campo; você confirma antes de enviar o convite |
| Documento vazando | Bucket privado, só admin, apagado ao confirmar e em 7 dias no máximo |
| Link de senha expira | Reenviar acesso na ficha |

---

## 10. Reembolso, em palavras simples

Duas perguntas que eu tinha feito de forma confusa:

- **Quem decide?** Proposta: **só você**, caso a caso, por um botão **Reembolsar** na ficha (a cobrança volta pelo Stripe e a ficha registra o motivo).
- **O reembolso cancela a conta inteira ou só a cobrança?** Duas opções. (a) **Só a assinatura**: ela continua com os dados dela, mas o acesso fecha. (b) **Conta inteira**: apaga também o perfil. Recomendo **(a)**, porque (b) é irreversível e ela pode voltar depois.

Nos **30 dias grátis não há nada para reembolsar**. O assunto só existe depois da primeira cobrança.
**[conferir]** com contador/advogado: no direito do consumidor europeu, quem compra serviço digital à distância costuma ter prazo de arrependimento; o texto dos termos precisa dizer como isso se aplica ao seu acesso.

---

## 11. Proposta de preço

> **Honestidade sobre a base.** Não existe nenhuma skill de preço instalada, então fiz a pesquisa na web. O resultado:
> - **Concorrência direta com preço publicado: quase nada.** Assessorias não publicam tabela. Os dois pontos que achei são uma estimativa de **R$ 3 mil a R$ 10 mil** para contratar assessoria de visto ([Euro Dicas](https://www.eurodicas.com.br/assessoria-para-visto-na-franca/)) e uma mentoria à venda por **R$ 2.297** ([Projeto Estudar na França](https://vivereviajar.com/projeto-estudar-na-franca-oferta/)). Nenhuma é um produto de acompanhamento contínuo como o seu.
> - **Benchmarks de assinatura:** vêm de blogs de empresas de software, com definições diferentes. Servem como ordem de grandeza, não como verdade.
> - **Os números de preço abaixo são hipóteses minhas** a testar, não fatos de mercado.

### 11.1 O que a pesquisa diz

| Pergunta | O que as fontes dizem | Peso da evidência |
|---|---|---|
| Anual retém mais que mensal? | Sim. Plano anual perde **cerca de 1/3 a 1/2** dos clientes que o mensal perde ([SubJolt](https://www.subjolt.com/guides/churn-rate-benchmarks/), [Growigami](https://growigami.com/blog/saas-churn-rate-benchmarks)) | Média: blogs de fornecedores, risco de viés (quem escolhe anual já é mais comprometido) |
| Mensal converte mais no topo? | Cerca de **50% mais** conversão inicial para mensal ([Baremetrics](https://baremetrics.com/blog/annual-vs-monthly-pricing-better-retention)) | Média/fraca |
| Desconto do anual | O padrão é **15–20%**, e há quem defenda 15–50% ([Subscription Index](https://www.subscriptionindex.com/guides/annual-vs-monthly-pricing)) | Média |
| Teste grátis com ou sem cartão | Sem cartão: **4–6%** convertem (bom) e 10–15% (ótimo). Com cartão: **25–35%** (bom) e 50–60% (ótimo). Mas exigir cartão reduz o número de cadastros ([ChartMogul](https://chartmogul.com/reports/saas-conversion-report/), [Kirro](https://kirro.io/free-trial-conversion-rate)) | Média: dados de software B2B, não de serviço com chamada |
| Pagamento no Brasil | Cartão é o principal meio de assinatura (65%) e Pix vem em segundo (16%) ([Movimento Econômico](https://movimentoeconomico.com.br/coluna-movimento-economico/2025/04/03/so-275-dos-brasileiros-parcelam-compras-cartao-e-o-meio-preferido/)). **Pix recorrente já existe no Stripe** desde abril/2026 ([Stripe](https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support)); **parcelamento no cartão não apareceu** nas fontes | Boa para Pix; **[conferir]** o parcelamento direto no Stripe |

### 11.2 O que é específico do seu produto

O acesso ao Por Dentro tem um **começo e um fim naturais**: o visto, a matrícula, a chegada. Depois disso a pessoa não precisa mais. Isso muda a conta:

1. **Mensal puro tende a ser cancelado quando a jornada acaba**, e a pessoa só fica enquanto ainda precisa. É receita previsível por poucos meses.
2. **Você sabe quanto tempo a jornada dura** (da candidatura à chegada, cerca de 12 meses). Isso sustenta o pagamento adiantado, mas com o desconto pequeno que você escolheu (5% e 10%) o incentivo para o anual é fraco: espere menos gente nele do que nos benchmarks (15–20%).
3. O comparativo da cliente não é outro app: é uma **assessoria de milhares de reais**. Seu preço pode ser baixo perto dela e ainda assim alto perto de um e-book. O risco é se posicionar no meio vazio.

### 11.3 Os três planos (decisão 7) e a moeda (decisão 8)

Base confirmada: **R$ 69 / € 12 por mês**. O semestral é 6 × o mensal com 5% de desconto; o anual é 12 × o mensal com 10% de desconto.

| Plano | Regra | Em R$ | Em € | Equivale a (por mês) |
|---|---|---|---|---|
| **Mensal** | sem desconto | **R$ 69**/mês | **€ 12**/mês | R$ 69 · € 12 |
| **Semestral** | 6 × mensal − 5% | **R$ 393** de uma vez | **€ 68** de uma vez | R$ 65,50 · € 11,33 |
| **Anual** | 12 × mensal − 10% | **R$ 745** de uma vez | **€ 129** de uma vez | R$ 62,08 · € 10,75 |

Contas: semestral = 6 × 69 = 414 − 5% = 393,30 → **393**; anual = 12 × 69 = 828 − 10% = 745,20 → **745**. Em euro: 6 × 12 = 72 − 5% = 68,40 → **68**; 12 × 12 = 144 − 10% = 129,60 → **129**. Arredondei para baixo; o desconto real fica em 5–6% e 10%.

**Dá para a pessoa escolher a moeda? Sim.** O Stripe permite um mesmo preço em várias moedas, e você fixa o valor de cada uma (não precisa converter pelo câmbio do dia). Detalhes:
- Sua conta é da França, então o dinheiro **chega em euro**. Quem paga em reais gera uma conversão cambial, com uma taxa do Stripe **[conferir o valor]**.
- A moeda vale **por assinatura**. Trocar de € para R$ depois exige uma assinatura nova **[conferir]**.
- Pix recorrente existe no Stripe e contas europeias podem usá-lo ([Stripe](https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support)), mas é para quem está no Brasil. Parcelamento no cartão brasileiro **não apareceu nas fontes: [conferir] antes de prometer**.
- A página de escolha mostra € e R$ lado a lado. Sugestão de padrão: R$ para quem está no Brasil (persona `campus_france`), € para quem já mora na França.

**Por que os três planos funcionam juntos:** o mensal serve de âncora e deixa o semestral e o anual parecerem uma escolha óbvia. O anual cobre os 12 meses da jornada (candidatura até a chegada). Como o desconto é pequeno, o que vai puxar as pessoas para o anual é mais o **1:1 incluído** (seção 13) do que o preço. Mantenha o **anual como destaque** na tela.

**Quanto a pessoa paga no total (valores confirmados):**

| Plano | Em R$ | Em € | Se pagasse mês a mês | Economia |
|---|---|---|---|---|
| Mensal | 69/mês | 12/mês | acumulado em 6 meses: R$ 414 · € 72; em 12 meses: R$ 828 · € 144 | nenhuma |
| Semestral | **R$ 393** | **€ 68** | R$ 414 · € 72 | R$ 21 · € 4 (5,1% · 5,6%) |
| Anual | **R$ 745** | **€ 129** | R$ 828 · € 144 | R$ 83 · € 15 (10,0% · 10,4%) |


### 11.4 Cartão nos 30 dias (decisão 9)

Decidido: **cartão obrigatório**. Os benchmarks de software mostram 25–60% de conversão com cartão contra 4–15% sem ([ChartMogul](https://chartmogul.com/reports/saas-conversion-report/)), e o seu volume é pequeno e qualificado numa chamada, então converter pesa mais que cadastrar.

Como fica no Stripe, para respeitar que **o plano só é escolhido depois**:
1. Em `/entrar/` o cartão é guardado **sem cobrança e sem plano** (modo de salvar cartão). A autenticação do banco (3-D Secure) acontece nessa hora.
2. Até o dia 30 ela escolhe **plano e moeda** no painel (aviso no dia 20 e no dia 27).
3. A assinatura é criada com a **primeira cobrança no dia 30**, usando o cartão guardado.
4. Sem escolha no dia 30: nada é cobrado e o painel bloqueia (decisão 9).

**Por obrigação de transparência**, o e-mail do dia 20 e do dia 27 diz a data, o valor e como cancelar. Isso protege você de contestação de cobrança e é exigência do consumidor. **[conferir]** o texto exato com seu contador/advogado.

### 11.5 Exemplo ilustrativo (as premissas são minhas)

Para cada **100 pessoas que começam o teste**, com 40% no mensal (ficando em média 5 meses), 30% no semestral e 30% no anual (menos gente no anual do que antes, por causa do desconto menor), em R$:

| | Sem cartão (10% pagam) | **Com cartão (30% pagam)** |
|---|---|---|
| Pagantes | 10 | 30 |
| Receita (0,4 × 69 × 5 + 0,3 × 393 + 0,3 × 745, por pagante ≈ R$ 479) | ~R$ 4.800 | **~R$ 14.400** |

Mostra só a ordem de grandeza. Se o cartão afastar muita gente (por exemplo, metade desistir), a vantagem some. **Meça nas primeiras 20 pessoas.**

### 11.6 O que eu faria no lançamento

1. 30 dias de acesso completo, cartão guardado sem cobrar.
2. Três planos com **anual em destaque**, moeda à escolha.
3. **Preço de fundadora** travado para os primeiros N (N limitado pela agenda de 1:1, seção 13).
4. 1:1 nunca ilimitado, conforme a seção 13.
5. Medir nas primeiras 20 pessoas: quantas cadastram cartão, quantas escolhem plano, qual plano e moeda, quantas cancelam no primeiro mês.

---

## 12. Decisões que ainda faltam

1. ~~Preço do mensal~~ **Confirmado:** R$ 69 / € 12.
2. **Preço de fundadora:** quantas vagas e por quanto tempo fica aberta a janela? (Veja o limite da agenda na seção 13.)
3. ~~4 h de 1:1~~ **Confirmado: por semana** (6 vagas de 40 min por semana, cerca de 24 por mês, descontando os 1:1 do app).
4. **Quanto custa um 1:1 extra de 30 min** (para quem passar do que o plano inclui)?

---

## 13. 1:1: agenda, limite e briefing

**O que você definiu:** 4 h de 1:1; cada onboarding dura 40 min e tem prioridade na agenda; 1:1 pedido dentro do app dura 30 min e o assunto precisa vir antes, para a chamada ser só encaminhamentos prontos.

**A conta que importa (depende da sua resposta 3):**

| Se as 4 h são... | Vagas de 40 min | Consequência |
|---|---|---|
| **por mês** | **6** | Só **6 onboardings por mês**, sem nenhum 1:1 do app. Insuficiente para um lançamento. |
| **por semana** | **6 por semana (~24/mês)** | ~24 onboardings por mês se nenhum 1:1 do app existir; com 1:1 do app, menos. |

Isso define o **limite do lançamento**. O CRM deve mostrar **vagas de onboarding restantes na semana** e o botão "Enviar convite" avisa quando a agenda encheu.

**1:1 dentro do app (proposta):**
- A pessoa pede o 1:1 no painel e **precisa informar o assunto** e, se quiser, anexar dúvidas ou links. Sem assunto, não envia.
- Chega ao CRM na tabela de 1:1 que já existe (`um_a_um`), com o assunto no card.
- A IA prepara, **antes da chamada**, um resumo do caso (Dossiê + linha do tempo + o que ela perguntou) e **rascunhos de encaminhamento**. Você ajusta e a chamada de 30 min vira conferência, não descoberta.
- Prioridade na agenda: onboarding primeiro, depois 1:1 do app, por ordem de pedido.

**O que cada plano inclui de 1:1 (proposta a discutir, não decidido):**

| Plano | 1:1 de 30 min incluídos |
|---|---|
| Mensal | 0 (extra pago) |
| Semestral | 1 |
| Anual | 2 |

Isso dá ao anual um benefício além do desconto, **sem prometer tempo ilimitado**. Cada 1:1 incluído é uma hora sua a menos na agenda, então some ao cálculo de vagas.

---

## 14. Os três níveis: Básico, Intermediário e Completo

> Substitui a tabela de 1:1 por plano da seção 13. O que existe hoje no app está marcado como **existe**; o que ainda não foi construído está como **a construir**. Os limites e preços dos níveis acima do Básico são **propostas** a confirmar.

### 14.1 Princípios (por que a divisão é assim)

1. **Nada que evita erro de prazo fica atrás de um nível maior.** Checklist, prazos reais, leitura de viabilidade e avisos de incongruência são do Básico. Perder um prazo de visto é dano real, e vender a proteção contra isso por degrau seria contra o propósito do produto.
2. **O que muda de um nível para o outro é o seu tempo.** Os níveis se separam por acesso a você, que é o único custo que cresce com cada cliente. O software custa quase o mesmo para todos.
3. **A IA reduz o seu tempo por cliente.** Rascunho de resposta, resumo do caso antes do 1:1 e pré-conferência de documento são feitos antes de você olhar, e você só aprova. É o que torna o Intermediário e o Completo viáveis dentro de 4 h por semana.
4. **Nenhum nível promete tempo ilimitado.** Tudo que depende de você tem número.

### 14.2 O quadro dos níveis

| | **Básico** | **Intermediário** | **Completo** |
|---|---|---|---|
| **Mensal (R$ · €)** | 69 · 12 | 149 · 26 | 299 · 52 |
| **Semestral (−5%)** | 393 · 68 | 849 · 148 | 1.704 · 296 |
| **Anual (−10%)** | 745 · 129 | 1.609 · 280 | 3.229 · 561 |
| **Para quem** | Quer se organizar sozinha, com prazos certos | Quer segurança de ter alguém para tirar dúvidas e decidir os pontos críticos | Tem um caso complexo ou pouco tempo e quer acompanhamento de perto |

**Painel (software, igual em todos)**

| Funcionalidade | Situação | Básico | Interm. | Completo |
|---|---|---|---|---|
| Home: retrato do momento, próximo passo, conquistas | existe | ✔ | ✔ | ✔ |
| Checklist da sua persona, em ordem, com prazos reais | existe | ✔ | ✔ | ✔ |
| Leitura de timing e viabilidade (cabe no prazo?) | existe | ✔ | ✔ | ✔ |
| Pop-up de escolha de caminho de estudo | existe | ✔ | ✔ | ✔ |
| Minha IAssistente (notas sobre o seu caso) | existe | ✔ | ✔ | ✔ |
| Perguntas pertinentes e perfil | existe | ✔ | ✔ | ✔ |
| Avisos de dados incongruentes | existe | ✔ | ✔ | ✔ |
| Artigos escolhidos para a sua persona | existe | ✔ | ✔ | ✔ |
| Lembretes de prazo (sininho no painel) | existe | ✔ | ✔ | ✔ |
| Avisos críticos de prazo (uma linha no sininho: "mudou algo que afeta um prazo seu") | a construir | ✔ | ✔ | ✔ |
| Central de ajuda: respostas prontas e IAssistente, antes de escrever à Ingryd | a construir (as dúvidas frequentes já existem, sem tela) | ✔ | ✔ | ✔ |
| "Pergunta da semana": você responde uma dúvida comum para todos | a construir | ✔ | ✔ | ✔ |
| Biblioteca (guia oficial, vídeos, sites oficiais por passo) | a construir | ✔ | ✔ | ✔ |
| Lembretes por e-mail | a construir | ✔ | ✔ | ✔ |

**Acesso a você (o que diferencia os níveis)**

| Funcionalidade | Situação | Básico | Interm. | Completo |
|---|---|---|---|---|
| Chamada de onboarding de 40 min | existe (é o ponto de entrada) | ✔ incluída | ✔ incluída | ✔ incluída |
| 1:1 de 30 min por mês, com assunto informado antes | a construir | 0 | **1** | **2** |
| 1:1 extra avulso | a construir | pago à parte | pago à parte, com desconto | pago à parte, com desconto maior |
| Dúvidas escritas à Ingryd ("Tenho uma dúvida") | chat existe, limites a construir | **4 interações por mês** (contador visível), resposta em até 5 dias úteis | **8 interações por mês**, em até 48 h úteis | **sem limite razoável**, em até 24 h úteis |
| Resumo do caso feito pela IA antes de cada 1:1 | a construir | não | ✔ | ✔ |
| **Radar do seu caso** (o que mudou, o que muda para você, o que fazer, fonte) | existe | **não** (bloqueado, com prévia do título) | ✔ da sua persona | ✔ da sua persona **+ nota pessoal sua + aviso quando muda algo no seu caso** |
| Conferência de documentos (você envia, a IA pré-confere, a Ingryd valida) | a construir | não | não | **até 2 por mês** |
| Acompanhamento proativo: a Ingryd te procura quando um prazo do seu caso se aproxima | a construir | não | não | ✔ |
| Prioridade na agenda | a construir | normal | alta | máxima |
| Lembretes por WhatsApp/SMS | a construir, ainda não existe envio | não | não | ✔ |
| **Teto de vagas ativas** | decisão sua | sem teto | teto | **teto baixo** |

### 14.3 Cabe na agenda? (a conta que decide os tetos)

Base: 4 h por semana ≈ 34 sessões de 30 min por mês.

| Uso do mês | Sessões de 30 min |
|---|---|
| 10 onboardings de 40 min (≈ 1,3 sessão cada) | 13 |
| 10 pessoas no Intermediário × 1 sessão | 10 |
| 5 pessoas no Completo × 2 sessões | 10 |
| **Total** | **33 de 34** |

Fica no limite, e ainda faltam as dúvidas escritas, a conferência de documentos e o acompanhamento proativo, que também gastam tempo (menos, com a IA preparando). Por isso:
- **Completo com teto baixo** (sugestão: 5 pessoas ativas no começo), e a lista de espera vira argumento de venda.
- **Intermediário com teto médio** (sugestão: 15).
- Os tetos sobem quando você tiver dados reais de quanto tempo cada nível consome. **Medir o tempo por cliente nos primeiros dois meses** é parte do lançamento.

### 14.4 Subir e descer de nível

- **Subir:** a qualquer momento, com cobrança proporcional do Stripe. A pessoa passa a ter os benefícios do nível novo na hora.
- **Descer:** vale no fim do período já pago (mesma regra do cancelamento, decisão 6). Sessões de 1:1 incluídas não usadas **não se acumulam** de um mês para o outro.
- **Durante os 30 dias de teste:** acesso a todo o painel, com a chamada de onboarding como único contato humano incluído. Os benefícios de cada nível começam quando o plano é escolhido.

### 14.5 Decisões que preciso de você

1. Os preços de partida do Intermediário (R$ 149 · € 26) e do Completo (R$ 299 · € 52) valem?
2. Limites: dúvidas **4 / 8 / ilimitado razoável** (confirmado); sessões de 1:1 0 / 1 / 2; conferências de documento 0 / 0 / 2 (ainda a confirmar).
3. Quantas vagas ativas por nível no começo (sugestão: Completo 5, Intermediário 15)?
4. Você quer WhatsApp/SMS como diferencial do Completo, ou prefere não prometer isso ainda?
5. Quanto custa o 1:1 extra de 30 min, para quem passar do que o plano inclui?

### 14.6 O Radar sai do Básico: o que isso muda

- O **Radar** (existe, mora na Home) passa a ser do **Intermediário** em diante. No Básico a Home mostra o bloco bloqueado com o **título** do item mais recente (sem o corpo) e "disponível no Intermediário".
- **Não vale esconder só na tela.** A fila do Radar chega pela tabela `sinais`, lida por uma função do banco. O bloqueio tem de estar **nessa função** (conferindo o plano em `subscriptions`); esconder no JavaScript seria decoração, qualquer um abriria o item pelo console. Mesma lógica que o hub usa para segredos.
- **O limite ético do bloqueio.** Se um item do Radar mudar um **prazo ou documento** que a pessoa precisa cumprir, ela não pode descobrir só ao assinar o nível de cima. Por isso o **aviso crítico de prazo** (uma linha, sem a análise) vai a todos os níveis. O que fica no Intermediário é a **análise**: por que mudou, o que significa para o seu caso, o que fazer.

### 14.7 O chat no Básico: reflexão

O chat hoje é uma conversa direta com você, com cartões Sim / Não / Depois e ações rápidas. No Básico há três jeitos de tratá-lo:

| Opção | Efeito | Problema |
|---|---|---|
| **A. Sem chat** | Custo zero de tempo | A plataforma perde o rosto humano, que é o diferencial frente a um app de checklist. A pessoa sente que "comprou um PDF". O Básico vira descartável |
| **B. Chat aberto com limite** | Humano sempre presente | Cada pessoa no Básico vira fila na sua caixa; você vira suporte barato de quem paga menos |
| **C. Chat que resolve sozinho primeiro, e só depois chega a você** (recomendado) | Mantém o rosto e protege o seu tempo | Exige cuidado para a IA não inventar regra de visto |

**Recomendação: C, assim:**
1. O avatar e o chat continuam **para todos**.
2. Quem escreve cai primeiro na **Central de ajuda**: respostas prontas do `duvidas-frequentes.json` (já escritas por você, guardadas e sem tela hoje) e a IAssistente. A resposta sempre mostra a **fonte** e é rotulada como sugestão.
3. Se não resolveu, o botão **"Perguntar à Ingryd"** usa uma das **4 interações do mês** do Básico (8 no Intermediário), com contador visível ("você tem 3 interações este mês"). A resposta chega em até 5 dias úteis, com rascunho feito pela IA que você só ajusta.
4. As **mensagens que você manda para todos** (cartões, avisos) chegam ao Básico normalmente: um para muitos é barato e mantém a presença.
5. A **"Pergunta da semana"**: você responde por escrito, uma vez, a dúvida mais repetida (a tabela `perguntas_unicas` já junta isso), e a resposta aparece para todos os níveis. Transforma o seu tempo em conteúdo que atende todo mundo.

**Regra de segurança da IA no chat.** Só responde a partir de conteúdo seu aprovado (dúvidas frequentes, checklist, datas oficiais). Sem fonte, não responde: encaminha. Visto é decisão com consequência, e resposta inventada custa caro.

### 14.8 Como não perder o engajamento

**O problema de fundo.** O Básico perdeu duas coisas que seguram gente (Radar e acesso humano). O que sobra é o checklist, que é um produto de **uso espaçado**: a pessoa abre, marca e some por semanas. E a jornada **termina** (chegada na França), então parte do cancelamento vai ser natural. A estratégia tem de (1) fazer a pessoa voltar nos momentos certos, (2) mostrar valor antes da cobrança e (3) planejar o fim da jornada.

**Já existe no sistema e dá para reaproveitar:** sequências de e-mail por gatilho (Estúdio, rodam de hora em hora), lembretes de prazo, estágios do funil (`ativado`, `em_uso`, `inativo`), data do último evento, conquistas e "Precisa de você" no Hoje do CRM.

| Fase | Gatilho | Ação | Mede |
|---|---|---|---|
| **Primeiros 7 dias (ativação)** | conta criada | Dia 0: senha e primeiro passo. Dia 1: "3 perguntas para eu conhecer o seu caso". Dia 3: você manda uma mensagem curta e pessoal. Dia 7: "você concluiu X passos" | % que conclui ≥ 3 itens do checklist em 7 dias |
| **Hábito (semanal)** | todo domingo à noite | E-mail "seu próximo passo + prazos dos próximos 14 dias", lido da data de cada item (`checklist_items.due_date`, que já está no banco) | taxa de abertura e de retorno ao painel |
| **Prazos** | prazo em 14, 7 e 2 dias | Lembrete no sininho e por e-mail, sempre com o link direto para o item | % de prazos cumpridos |
| **Marcos** | passo importante concluído | Conquista no painel e e-mail curto de comemoração, com o próximo passo | reativação após o marco |
| **Reativação** | 7, 14 e 30 dias sem abrir | Sequência por tom: lembrete, "mudou algo", e uma pergunta aberta respondida por você | % que volta em 7 dias |
| **Valor antes da cobrança** | dia 20 e dia 27 do teste | Resumo do que ela fez ("12 de 31 passos, 3 prazos marcados") **+** a escolha do plano. Quem usou pouco recebe, em vez disso, um convite para conversar | cadastros de cartão que viram pagamento; pedidos de reembolso |
| **Fim da jornada** | persona chega à fase de chegada | Pergunta "e agora?": pausar (o Stripe tem pausa de cobrança), descer para o Básico, ou indicar uma amiga. O conteúdo da chegada (OFII, Ameli, CAF) já existe e vira o próximo ciclo de uso | cancelamentos com motivo; indicações |
| **Cancelamento** | clique em cancelar | Pergunta o motivo, oferece pausa ou descer de nível. O acesso continua até o fim do período pago (decisão 6) | motivo mais comum |
| **Sinal para você** | pouco uso + prazo crítico próximo | Aparece no "Precisa de você" do CRM: "Maria não abre há 12 dias e o VLS-TS vence em 20" | prazos críticos que você evitou perder |

**Duas ideias que valem destaque**
1. **Chamada de fechamento (dia 25) só para quem tem sinal de risco**, não para todos. Aqui a sua agenda rende mais: o tempo vai para quem está prestes a abandonar com um prazo crítico.
2. **A "vitrine" dos níveis dentro do uso, não no preço.** Quando a pessoa bate numa situação que pede conversa (caminho "Não sei ainda", prazo curto do VLS-TS, dado incongruente), o painel mostra: "Isto pede uma conversa. O Intermediário inclui 1 sessão por mês." Contextual, sem alarmismo. A subida de nível nasce da necessidade real.

**Observação honesta.** O app tem hoje poucos dados de uso: a única medição disponível é o que o CRM registra de eventos. Os gatilhos acima só funcionam se o painel passar a **registrar eventos** (abrir painel, marcar item, ler artigo) em `eventos`. É pré-requisito, e entra na primeira entrega.

### 14.9 Decisões que preciso de você

1. ~~Chat do Básico~~ **Aprovado: opção C** (Central de ajuda + interações por mês: 4 no Básico, 8 no Intermediário).
2. **Radar bloqueado com prévia do título** no Básico, e **aviso crítico de prazo para todos** (seção 14.6): de acordo?
3. **A "Pergunta da semana"** vale o seu tempo (cerca de 30 min por semana)?
4. **Mensagem pessoal no dia 3** para cada novo usuário: viável na sua agenda, ou só para quem tem sinal de risco?
5. **Fim da jornada:** quer pausa de cobrança, descer para o Básico, ou os dois?

### 14.10 Aprovado em 2026-10-22

- Radar fora do Básico; **aviso crítico de prazo para todos**; bloqueio feito na função do banco.
- Chat em três camadas (Central de ajuda → IA com fonte → você). **Interações com a Ingryd por mês: Básico 4, Intermediário 8, Completo sem limite razoável.**
- Estratégia de engajamento da seção 14.8, incluindo o registro de eventos de uso como pré-requisito.
- Pergunta da semana, mensagem pessoal no dia 3 e fim da jornada com pausa/descer de nível: seguem as recomendações.

**O que conta como "interação".** Uma pergunta dela e a sua resposta, com réplicas dentro de 48 h na mesma conversa contando como uma só. O que ela escreve à Central de ajuda (respostas prontas e IAssistente) **não conta**. O contador zera todo mês e não acumula.

**Capacidade (a conferir com dados reais).** Se todos usassem a cota inteira, 30 pessoas no Básico (120 interações) e 15 no Intermediário (120) dariam 240 respostas por mês. Com cerca de 3 minutos cada, já com o rascunho da IA, são ~12 h por mês, **fora** das 4 h semanais de 1:1. Na prática ninguém usa a cota toda, mas o painel do CRM deve mostrar **interações usadas e tempo gasto** desde o primeiro mês, para os números serem ajustados com base em uso real.


---

## 15. Como testar com uma pessoa de ensaio (Etapa 1)

Antes: README do Worker, seção 24 (créditos, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, os dois SQL, `links-pagamento.json`).

1. Use um e-mail seu de ensaio (`seunome+ensaio@gmail.com`) e um documento fictício ou o seu próprio, que você pode apagar depois.
2. CRM → **Onboarding**. Se aparecer o aviso amarelo, falta configurar (ele diz o quê). Digite o e-mail, solte o PDF/JPG/PNG, escreva uma anotação (ex.: "Au pair em Lyon, quer fazer FLE, chegou em setembro") → **Ler e criar pessoa**.
3. A ficha abre sozinha: confira o resumo no topo, as etiquetas "Lido do documento · confiança…" nos campos e a lista **Falta perguntar**. Mude um campo e salve: a etiqueta dele some.
4. Repita com o **mesmo e-mail** e um documento diferente: deve atualizar a mesma ficha (um contato só) e **não** trocar o que você digitou.
5. Aba **Plataforma** → **Enviar link de pagamento** → escolha o plano → o e-mail chega com o link do Stripe já com o seu e-mail preenchido. O botão passa a mostrar "Link enviado em dd/mm" e **Reenviar**. Na linha do tempo (aba Ficha) aparecem os dois eventos.
6. Limpeza: apague a pessoa de ensaio no Supabase (Table Editor → `contatos`); o resto sai em cascata.
