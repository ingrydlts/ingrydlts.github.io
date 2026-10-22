# Onboarding por chamada: documento → ficha → 30 dias de acesso → plano

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
| 7 | **Três planos:** mensal (sem desconto), semestral (**20%** de desconto) e anual (**30%** de desconto). |
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
| 2 | **Soltar documento** → cria contato, abre ficha, preenche o Dossiê, apaga o arquivo ao confirmar | Para de digitar o que está no documento |
| 3 | **Escolha de plano + Stripe + webhook** (precisa do preço decidido) | A cobrança começa a valer no dia 30 |
| 4 | **Anotações da chamada** + lista "falta perguntar" + resumo na linha do tempo | O roteiro da chamada |
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
2. **Você sabe quanto tempo a jornada dura** (da candidatura à chegada, cerca de 12 meses). Isso justifica um desconto grande no pagamento de uma vez, porque o cliente vai usar o período inteiro de qualquer jeito.
3. O comparativo da cliente não é outro app: é uma **assessoria de milhares de reais**. Seu preço pode ser baixo perto dela e ainda assim alto perto de um e-book. O risco é se posicionar no meio vazio.

### 11.3 Os três planos (decisão 7) e a moeda (decisão 8)

Você definiu a regra de desconto; falta só o **preço do mensal**, que é a base de tudo. Uso **R$ 69 / € 12** como ponto de partida (hipótese minha, não dado de mercado).

| Plano | Regra | Em R$ | Em € | Equivale a (por mês) |
|---|---|---|---|---|
| **Mensal** | sem desconto | **R$ 69**/mês | **€ 12**/mês | R$ 69 · € 12 |
| **Semestral** | 6 meses − 20% | **R$ 329** de uma vez | **€ 57** de uma vez | R$ 55 · € 9,50 |
| **Anual** | 12 meses − 30% | **R$ 579** de uma vez | **€ 99** de uma vez | R$ 48 · € 8,25 |

Contas: semestral = 6 × 69 × 0,8 = 331,20 → 329; anual = 12 × 69 × 0,7 = 579,60 → 579. Em euro: 6 × 12 × 0,8 = 57,60 → 57; 12 × 12 × 0,7 = 100,80 → 99. Arredondei para baixo para o preço terminar bem; o desconto real fica em 20–21% e 30–31%.

**Dá para a pessoa escolher a moeda? Sim.** O Stripe permite um mesmo preço em várias moedas, e você fixa o valor de cada uma (não precisa converter pelo câmbio do dia). Detalhes:
- Sua conta é da França, então o dinheiro **chega em euro**. Quem paga em reais gera uma conversão cambial, com uma taxa do Stripe **[conferir o valor]**.
- A moeda vale **por assinatura**. Trocar de € para R$ depois exige uma assinatura nova **[conferir]**.
- Pix recorrente existe no Stripe e contas europeias podem usá-lo ([Stripe](https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support)), mas é para quem está no Brasil. Parcelamento no cartão brasileiro **não apareceu nas fontes: [conferir] antes de prometer**.
- A página de escolha mostra € e R$ lado a lado. Sugestão de padrão: R$ para quem está no Brasil (persona `campus_france`), € para quem já mora na França.

**Por que os três planos funcionam juntos:** o mensal serve de âncora e deixa o semestral e o anual parecerem uma escolha óbvia. O desconto maior do anual incentiva o compromisso de 12 meses, que é o tempo da jornada (candidatura até a chegada). Mantenha o **anual como destaque** na tela.

**Quanto a pessoa paga no total (valores confirmados):**

| Plano | Em R$ | Em € | Se pagasse mês a mês | Economia |
|---|---|---|---|---|
| Mensal | 69/mês | 12/mês | acumulado em 6 meses: R$ 414 · € 72; em 12 meses: R$ 828 · € 144 | nenhuma |
| Semestral | **R$ 329** | **€ 57** | R$ 414 · € 72 | R$ 85 · € 15 (20,5% · 20,8%) |
| Anual | **R$ 579** | **€ 99** | R$ 828 · € 144 | R$ 249 · € 45 (30,1% · 31,3%) |


### 11.4 Cartão nos 30 dias (decisão 9)

Decidido: **cartão obrigatório**. Os benchmarks de software mostram 25–60% de conversão com cartão contra 4–15% sem ([ChartMogul](https://chartmogul.com/reports/saas-conversion-report/)), e o seu volume é pequeno e qualificado numa chamada, então converter pesa mais que cadastrar.

Como fica no Stripe, para respeitar que **o plano só é escolhido depois**:
1. Em `/entrar/` o cartão é guardado **sem cobrança e sem plano** (modo de salvar cartão). A autenticação do banco (3-D Secure) acontece nessa hora.
2. Até o dia 30 ela escolhe **plano e moeda** no painel (aviso no dia 20 e no dia 27).
3. A assinatura é criada com a **primeira cobrança no dia 30**, usando o cartão guardado.
4. Sem escolha no dia 30: nada é cobrado e o painel bloqueia (decisão 9).

**Por obrigação de transparência**, o e-mail do dia 20 e do dia 27 diz a data, o valor e como cancelar. Isso protege você de contestação de cobrança e é exigência do consumidor. **[conferir]** o texto exato com seu contador/advogado.

### 11.5 Exemplo ilustrativo (as premissas são minhas)

Para cada **100 pessoas que começam o teste**, com 20% no mensal (ficando em média 5 meses), 30% no semestral e 50% no anual, em R$:

| | Sem cartão (10% pagam) | **Com cartão (30% pagam)** |
|---|---|---|
| Pagantes | 10 | 30 |
| Receita (0,2 × 69 × 5 + 0,3 × 329 + 0,5 × 579, por pagante ≈ R$ 457) | ~R$ 4.600 | **~R$ 13.700** |

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
