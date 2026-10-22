# Onboarding por chamada: documento → ficha → assinatura → conta

> Escrito em 2026-10-22, revisado após as respostas dela. **É uma proposta**: nada aqui vira código até virar item no Major Tasks do Notion.
> Verificado no código: `admin/crm/DOSSIE.md`, `db/crm-fase1.sql` e `db/schema.sql` (app), `criar-senha/index.html` (app), `cms-oauth-worker/worker.js`.
> O que não dá para afirmar sem testar aparece como **[conferir]**.

## Decisões já tomadas

| # | Decisão |
|---|---|
| 1 | Documentos **são apagados depois de lidos**. Fica só o que o Dossiê já define como relevante para o acompanhamento. |
| 2 | A fala da chamada entra como **texto** (anotações ou transcrição colada). |
| 3 | **Pagamento primeiro, conta depois.** O botão da ficha envia o link de assinatura, não de senha. A conta só existe depois de pago. |
| 4 | E-mails pelo **Estúdio de e-mails**, na voz dela. |

---

## 0. O fluxo

1. Você faz a chamada e apresenta o valor do produto.
2. No CRM, **solta o documento** (e cola suas anotações). O sistema lê, **cria o contato** e abre a ficha com o Dossiê preenchido.
3. Você revisa a ficha, digita o e-mail e clica **Enviar link de assinatura**.
4. Ela abre o link, **escolhe o onboarding**, aceita os termos e paga.
5. O pagamento confirmado **cria a conta** dela já com o perfil pronto e dispara o **e-mail de confirmação**: "assinatura confirmada, sua entrada na plataforma deu certo" com o link para criar a senha.
6. Ela define a senha e entra no painel com o checklist montado.

Antes do pagamento **não existe conta nenhuma**: só o contato no CRM. Se ela não pagar, nada ficou pela metade.

---

## 1. O que já existe e é reaproveitado

| Peça | Onde | Papel |
|---|---|---|
| **Ficha** e **Dossiê** (`contatos.dossie`) | CRM | A página que abre. O `DOSSIE.md` já prevê "copiar o dossiê para o perfil dela": esta é essa etapa. O dossiê fica guardado no contato até a conta nascer. |
| `contatos` + trigger `crm_on_auth_user` | banco | Liga a conta ao contato pelo e-mail; registra `acesso_ativado` e `senha_definida` na linha do tempo. |
| Stripe via REST no Worker (`STRIPE_SECRET_KEY`, `verify-session`, checkout embutido) | Worker | Já conversa com o Stripe. **Ainda não recebe webhook**: precisa ser acrescentado. |
| Tabela `subscriptions` | `db/schema.sql` | Já existe (cliente, assinatura, status, fim do período), mas nada a preenche hoje. |
| `crmRequireAdmin`, service role, Brevo, Estúdio de e-mails | Worker/CRM | Rotas só de admin e envio de e-mail editável. |
| `gerarChecklist`, `prazos.js`, `data-integrity.js` | app | Continuam sendo os únicos que calculam checklist, prazo e incongruência. |

---

## 2. Soltar o documento e abrir a ficha

**Onde:** botão **Novo por documento** na lista de Contatos, e uma área de soltar arquivo dentro de qualquer ficha (para acrescentar documentos depois).

- O Worker lê o documento (PDF ou foto: passaporte, VLS-TS, titre de séjour, contrat d'accueil, certificado de matrícula, carta de aceite) e as suas anotações, e extrai os campos do Dossiê.
- Cria o contato e abre a ficha. Se já existir um lead com aquele e-mail ou nome, **acrescenta à ficha existente** em vez de duplicar.
- Cada campo mostra **de onde veio** (documento, fala, você digitou) e **quanto a IA confia**. Baixa confiança fica destacada. Campo sem fonte fica vazio, nunca chutado, e entra numa lista **"falta perguntar"** no topo. Tudo editável: a IA sugere, você confirma.
- **E-mail:** documento quase nunca traz. O botão de assinatura fica desabilitado até você digitar.

### O que acontece com o arquivo (decisão 1)

1. O arquivo sobe para um bucket **privado** só para ser lido.
2. Assim que a leitura termina e você clica **Confirmar dados**, o arquivo é **apagado**. Ficam só os campos do Dossiê.
3. Rede de segurança: se você não confirmar, o arquivo é apagado sozinho em **7 dias** **[ajustável]**.
4. O número do documento (passaporte, titre) só é gravado se o Dossiê pedir. Hoje o Dossiê **não** tem esse campo, então ele não é guardado.

---

## 3. O link de assinatura (substitui o "e-mail de ativação")

Botão **Enviar link de assinatura** na ficha. Rota nova do Worker, só admin:

1. Gera um link único e assinado para aquele contato (`/assinar/?t=...`), com validade.
2. Envia o e-mail `convite_assinatura` (Estúdio de e-mails) com esse link.
3. Registra o evento `link_assinatura_enviado` na ficha. O botão vira **Reenviar link**.

**A página `/assinar/` (pública, mas só abre com o link assinado):**
- Mostra o nome dela e os **onboardings disponíveis**, com preço. Ela escolhe um.
- Mostra os termos e a política de privacidade. O aceite grava o **consentimento** com o texto exato que ela viu (substitui o "consentimento verbal" da proposta anterior; mais forte, porque fica registrado por ela).
- Leva ao **Stripe Checkout em modo assinatura**. A sessão carrega o id do contato (`client_reference_id`) e o plano escolhido.
- Nada de e-mail de novidades marcado por você: continua opt-in separado.

---

## 4. Pagamento confirmado → conta criada

O Stripe chama o Worker (webhook `checkout.session.completed`). O Worker:

1. **Confere a assinatura do webhook** (`STRIPE_WEBHOOK_SECRET`). Sem isso, qualquer um poderia "pagar".
2. É **idempotente**: o Stripe reenvia eventos; a mesma sessão paga nunca cria duas contas.
3. Cria o usuário no Supabase Auth **sem senha**. O trigger existente liga ao contato.
4. Numa transação só (`crm_ativar_conta`): copia o Dossiê para `profiles`, grava `key_dates`, `subscriptions` (plano, status, fim do período), o resumo da chamada na linha do tempo e `convite_pendente = true`. Se falhar, o usuário criado é apagado, e o Worker responde erro para o Stripe **tentar de novo**.
5. Envia o e-mail `assinatura_confirmada` (Estúdio): confirma a assinatura, diz que a entrada na plataforma foi bem-sucedida e traz o **link para criar a senha**.

Outros eventos do Stripe mantêm `subscriptions` em dia: renovação, falha de pagamento (`past_due`) e cancelamento.

### A senha (e o problema do código atual)

Hoje `criar-senha/index.html` redireciona direto ao dashboard quando `onboarding_concluido` já é `true`. Como o perfil já nasce pronto, ela clicaria no e-mail e **entraria sem nunca definir senha**.

**Solução:** com `convite_pendente = true`, `criar-senha` mostra **só os campos de senha** (sem perguntar persona nem refazer o upsert) e, ao salvar, desliga a flag e vai ao dashboard. Sem a flag, tudo segue como hoje.

**Checklist:** o Worker não monta checklist (a regra vive em JS no app; duplicar perderia a fonte única). Ele grava `pre_concluidos` (passos que o documento provou). No primeiro acesso o app roda o `gerarChecklist` de sempre e marca esses passos como concluídos.

**[conferir]** validade do link de criação de senha no Supabase. Se for curta, o plano B é um botão **Reenviar acesso** na ficha, que gera um link novo.

---

## 5. O que a IA faz e não faz

| Faz | Não faz |
|---|---|
| Extrai campos objetivos de documento e imagem (nome, datas, validade, tipo de visto, curso) | Calcular prazo, checklist ou viabilidade |
| Lê suas anotações e preenche o Dossiê | Inventar: sem fonte, campo vazio |
| Sugere persona e caminho de estudo, explicando por quê | Decidir a persona sozinha |
| Marca como já feito o que o documento prova | Marcar feito só porque ela "disse que sim" |
| Escreve um resumo de 3 a 5 linhas da chamada | Guardar a transcrição inteira |
| Aponta incongruência (regra do `data-integrity.js`) | Corrigir sozinha |

Roda **só no Worker** (`ANTHROPIC_API_KEY` como secret do Cloudflare, nunca no navegador). Modelo configurável por variável de ambiente. Resposta em JSON validado contra schema, campo a campo `{valor, origem, confianca}`; se não validar, tenta mais uma vez e para. O custo estimado de cada leitura aparece na ficha.

---

## 6. Dados sensíveis (RGPD/LGPD)

- Passaporte e visto são dados pessoais de quem vive na França: o RGPD vale.
- O arquivo existe só entre o envio e o **Confirmar dados** (decisão 1). Nunca em repositório, log ou Brevo.
- O arquivo vai à API de IA para ser lido: isso precisa constar em `/confidentialite/`. **[conferir]** a política de retenção da API antes de ligar.
- Consentimento: `consentimentos.finalidade` hoje aceita só `servico` e `novidades_email`. Acrescentar `documentos` (para a leitura do arquivo) e gravar o texto exibido na página `/assinar/`.
- Apagar o contato continua apagando tudo em cascata. **[conferir]** com o contador/Stripe o que precisa ser retido por obrigação fiscal depois de um pedido de apagamento.

---

## 7. O que muda em cada repositório

| Repositório | Mudança |
|---|---|
| **site** (`admin/crm`, `cms-oauth-worker`, nova página `/assinar/`) | "Novo por documento" e área de soltar na ficha; botão "Enviar link de assinatura"; rotas `ler`, `link-assinatura` e **webhook do Stripe**; modelos `convite_assinatura` e `assinatura_confirmada`; secrets `ANTHROPIC_API_KEY` e `STRIPE_WEBHOOK_SECRET`; preços dos planos no Stripe |
| **app** (`db/`, `criar-senha/`, dashboard) | `db/crm-onboarding.sql` (`convite_pendente`, `pre_concluidos`, finalidade `documentos`, função `crm_ativar_conta`, bucket); ajuste do `criar-senha`; aplicar `pre_concluidos` no primeiro acesso |
| **instagram-hub** | Nada |

---

## 8. Entregas, em ordem

| # | Entrega | O que você ganha |
|---|---|---|
| 1 | **Assinatura → conta → senha**, com Dossiê manual: botão, `/assinar/`, Stripe em modo assinatura, webhook, `crm_ativar_conta`, e-mails, ajuste do `criar-senha` | Já dá para vender e ativar qualquer pessoa. É a parte com dinheiro e conta: precisa nascer testada. |
| 2 | **Soltar documento** → cria contato, abre ficha, preenche o Dossiê com origem e confiança, apaga o arquivo ao confirmar | Para de digitar o que está no documento |
| 3 | **Anotações da chamada** + lista "falta perguntar" + resumo na linha do tempo | O roteiro da chamada |
| 4 | Reenviar link/acesso, custo por leitura, estados de pagamento na ficha (`past_due`, cancelada) | Fechamento |

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Pessoa paga e a conta não é criada | Webhook idempotente com retentativa do Stripe; a ficha mostra "pago, conta pendente" e há botão de reprocessar |
| Pessoa paga duas vezes | Link de assinatura de uso único por contato; assinatura ativa bloqueia novo checkout |
| IA lê errado uma data | Origem e confiança por campo; datas sempre exibidas para conferir antes de enviar o link |
| Documento vazando | Bucket privado, só admin, apagado ao confirmar e em 7 dias no máximo |
| Link de senha expira | Reenviar acesso na ficha |

---

## 10. Perguntas abertas

1. **A escolha do onboarding acontece antes do pagamento, na página do link** (é o que está desenhado, porque o preço depende do plano). Você falou em escolher "ao definir a senha": era isso mesmo, ou existe uma segunda escolha depois (por exemplo, o caminho de estudo)?
2. **Quais são os onboardings e os preços**, e cada um é mensal, anual ou pagamento único? "Assinatura" no Stripe é recorrente; pagamento único é outro modo.
3. **Se a assinatura for cancelada ou falhar, o que acontece com o acesso ao painel?** Bloqueia na hora, no fim do período pago, ou nunca bloqueia?
4. **Reembolso:** quem decide, e ele cancela a conta ou só a assinatura?
