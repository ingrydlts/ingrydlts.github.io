# Onboarding por chamada: do vídeo à conta criada

> Escrito em 2026-10-22. **É uma proposta**: nada aqui vira código até virar item no Major Tasks do Notion.
> Verificado no código: `admin/crm/DOSSIE.md`, `db/crm-fase1.sql` (app), `criar-senha/index.html` (app), `cms-oauth-worker/worker.js`.
> O que não dá para afirmar sem testar aparece como **[conferir]**.

---

## 0. Resumo

1. Você faz a chamada de vídeo e pergunta tudo. Durante ou depois, joga no CRM os **documentos, prints e suas anotações** (ou a transcrição).
2. Uma leitura inteligente preenche o **Dossiê** da pessoa e mostra **o que ainda falta perguntar**.
3. Você revisa uma tela só ("o que entendi, de onde veio, quanto confio") e corrige o que quiser.
4. Você digita o e-mail e clica **Criar pessoa e enviar convite**. O sistema cria a conta já com o perfil pronto.
5. Ela recebe o e-mail, **só escolhe a senha** e cai no painel dela, com o checklist montado e os passos que ela já fez marcados como feitos.

Nada é criado sem o seu clique. A IA sugere, você confirma (mesma regra do hub: "sugestão, nunca fato").

---

## 1. O que já existe e esta proposta aproveita

| Peça | Onde | Papel no onboarding |
|---|---|---|
| **Dossiê** (`contatos.dossie`, `crm-dossie.sql`) | topo da ficha no CRM | É a lista de perguntas da chamada. Vira o destino da leitura inteligente. O `DOSSIE.md` já diz: "chaves iguais às do app, para a etapa seguinte copiar o dossiê para o perfil dela". **Esta é essa etapa.** |
| `contatos` + trigger `crm_on_auth_user` | banco | Já liga a conta nova ao contato pelo e-mail e registra `acesso_ativado` e `senha_definida`. Pessoa que já era lead não duplica. |
| `criar-senha/` | app | Já cria perfil e checklist e pede a senha. Precisa de um ajuste (seção 5). |
| `crmRequireAdmin` + `SUPABASE_SERVICE_ROLE_KEY` + Brevo | Worker | Já há rotas `/api/crm/*` que só respondem a admin e já enviam e-mail. As rotas novas entram aqui. |
| Estúdio de e-mails | CRM | O e-mail do convite vira um modelo editável, como os outros. |
| `gerarChecklist`, `prazos.js`, `data-integrity.js` | app | Continuam sendo os únicos que calculam checklist, prazo e incongruência. A IA **lê**, não calcula. |

---

## 2. O fluxo, tela a tela

Entrada: botão **Onboarding** no menu lateral do CRM, e também **Iniciar onboarding** dentro da ficha de qualquer lead (já vem preenchido com o que o funil sabe).

```
┌─ 1. ENTRADA ─────────────┬─ 2. O QUE ENTENDI ─────────────┬─ 3. FALTA PERGUNTAR ──────┐
│ arraste documentos/prints│ Nome ........ Maria S.  [doc]  │ ☐ Número de sécu          │
│ cole transcrição/notas   │ Persona ..... au pair→estud.   │ ☐ Conta na ANEF           │
│ ou digite durante a call │ Chegada ..... 12/09/2025 [doc] │ ☐ Nível de francês        │
│ [ Ler com IA ]           │ Contrato fim  06/2026   [fala] │ ⚠ VLS-TS vence em 41 dias │
│                          │ Sécu ........ ?  (não achei)   │                           │
└──────────────────────────┴────────────────────────────────┴───────────────────────────┘
 E-mail dela: [__________]  ☑ consentimento dado na chamada   [ Criar pessoa e enviar convite ]
```

- **Coluna 1, entrada.** Aceita PDF, foto e print (passaporte, VLS-TS, titre de séjour, contrat d'accueil, certificado de matrícula, carta de aceite) e texto (suas anotações ou a transcrição colada). Pode ler várias vezes: cada leitura **soma** ao que já está, não apaga.
- **Coluna 2, o que entendi.** Cada campo mostra **de onde veio** (documento, fala, inferido) e **quanto a IA confia**. Baixa confiança fica destacada. Tudo editável. Campo que não apareceu em lugar nenhum fica vazio, nunca chutado.
- **Coluna 3, falta perguntar.** É o roteiro vivo da chamada: as perguntas do Dossiê para a persona dela que ainda estão sem resposta, mais os avisos de incongruência (usa a mesma regra do `data-integrity.js`). Se você ainda está no vídeo com ela, é a lista do que perguntar antes de desligar.
- **Rascunho salvo.** Pode fechar a aba no meio e voltar. Fica em "Onboardings em andamento".

---

## 3. A parte inteligente (e os limites dela)

| Faz | Não faz |
|---|---|
| Lê documento e imagem e extrai campos objetivos (nome, datas, validade, tipo de visto, curso, número do contrato) | Calcular prazo, checklist ou viabilidade. Isso é do app (`prazos.js`, `checklist-engine.js`), uma fonte só |
| Lê suas anotações/transcrição e preenche os campos do Dossiê | Inventar. Sem fonte, o campo fica vazio e entra em "falta perguntar" |
| Sugere a **persona** e o **caminho de estudo** e explica por quê | Decidir a persona por você: é sugestão com um clique para aceitar |
| Marca como **já feito** os passos que o documento prova (ex.: tem certificado de matrícula → o item correspondente já nasce concluído) | Marcar passo como feito só porque ela "disse que sim" sem você confirmar |
| Escreve um **resumo da chamada** (3 a 5 linhas) que vai para a linha do tempo da ficha | Guardar a transcrição inteira no banco |
| Aponta incongruência (ex.: data de chegada fora da duração máxima da persona) | Corrigir sozinha |

**Saída estruturada.** A IA responde JSON validado contra um schema com as mesmas chaves do `DOSSIE.md`; se não validar, tenta mais uma vez e para (regra da camada de IA do hub). Cada campo vem como `{valor, origem, confianca}`.

**Onde roda.** Só no Worker (`ANTHROPIC_API_KEY` como secret do Cloudflare, nunca no navegador nem no repositório). O modelo fica numa variável de ambiente, para trocar sem mexer em código. Rota nova: `POST /api/crm/onboarding/ler`, só admin, na mesma trilha de `crmRequireAdmin`.

**Custo.** Uma leitura por pessoa, com poucos documentos: ordem de centavos de dólar. O CRM mostra o custo estimado de cada leitura.

---

## 4. Criar a pessoa (o botão)

`POST /api/crm/onboarding/criar`, só admin, no Worker (é o único com a service role):

1. Recebe o dossiê **já revisado por você** + o e-mail.
2. Cria o usuário no Supabase Auth (API de admin) **sem senha**.
3. O trigger `crm_on_auth_user` liga ao `contatos` existente (ou cria o contato com origem `onboarding_chamada`).
4. Uma função SQL `crm_onboarding_criar(...)`, numa transação só, grava: `profiles` (com `onboarding_concluido = true`, os campos do dossiê, `perfil_extra`), `key_dates`, evento `onboarding_chamada` com o resumo, e o consentimento.
5. Se o passo 4 falhar, o Worker **apaga o usuário criado no passo 2**. Sem conta pela metade.
6. Envia o convite (seção 5).

Se o e-mail já tem conta, o botão vira **Atualizar perfil** e não cria nada novo.

---

## 5. O convite e a senha (o ponto que quebraria se ninguém avisasse)

**Problema real, verificado.** `criar-senha/index.html` faz isto logo ao abrir: se `onboarding_concluido` já é `true`, **redireciona para o dashboard e nunca mostra a tela de senha** ("Quem já passou por aqui não volta"). Se o onboarding por chamada gravar o perfil pronto, a pessoa clica no convite e cai no painel **sem ter definido senha**.

**Solução.** Coluna nova `profiles.convite_pendente boolean`.
- O Worker grava `convite_pendente = true`.
- `criar-senha` passa a checar: se `convite_pendente`, mostra **só os campos de senha** (sem pergunta de persona, sem refazer upsert) e, ao salvar a senha, zera a flag e vai para o dashboard.
- Sem a flag, tudo continua exatamente como hoje.

**E-mail.** Modelo novo `convite_conta` no Estúdio de e-mails (editável, com versão No ar), enviado pelo Brevo do Worker, com o link de convite gerado pelo Supabase. Alternativa mais simples: usar o convite do próprio Supabase e só ajustar o template. Recomendo o Estúdio, pelo remetente e pelo texto na sua voz.
**[conferir]** quanto tempo o link do convite vale no Supabase. Se for curto, o plano B já está no desenho: botão **Reenviar convite** na ficha, que gera um link novo.

**Checklist.** O Worker **não** monta checklist (a regra está em JS no app, e duplicar já foi dor no projeto). Ele grava o perfil e a lista `pre_concluidos` (passos que o documento provou). No primeiro acesso, o app roda o `gerarChecklist` de sempre e marca esses passos como concluídos. Uma fonte de regra só.

---

## 6. Dados sensíveis (RGPD/LGPD)

Passaporte, VLS-TS e titre de séjour são dados pessoais de pessoas que vivem na França, então o RGPD vale.

- **Armazenamento.** Bucket privado do Supabase Storage, acesso só `eh_admin()`. Os arquivos **não** vão para repositório, log ou Brevo.
- **Retenção (decisão sua, seção 8).** Recomendo: depois que você confirma, os arquivos são apagados e fica só o que foi extraído, a menos que você marque "guardar" naquela pessoa.
- **O arquivo vai à API de IA para ser lido.** Isso precisa constar na página de confidencialidade (`/confidentialite/`). **[conferir]** a política de retenção da API antes de ligar.
- **Consentimento.** Hoje `consentimentos.finalidade` só aceita `servico` e `novidades_email`. Acrescentar `documentos` e gravar o texto exato lido na chamada. Para o e-mail de novidades, **nunca marcar por ela**: continua opt-in separado.
- **Direito ao apagamento.** Já resolvido pelo desenho atual (apagar o contato leva eventos e consentimentos em cascata). A tabela `onboardings` entra na mesma cascata.
- **Trechos de fala** de terceiros não vão crus para o banco: só o resumo e os campos.

---

## 7. O que muda em cada repositório

| Repositório | Mudança |
|---|---|
| **site** (`admin/crm`, `cms-oauth-worker`) | Tela Onboarding no CRM; rotas `ler`, `criar`, `reenviar-convite` no Worker; modelo `convite_conta`; secret `ANTHROPIC_API_KEY` |
| **app** (`db/`, `criar-senha/`, dashboard) | `db/crm-onboarding.sql` (tabela `onboardings`, colunas `convite_pendente` e `pre_concluidos`, finalidade `documentos`, função `crm_onboarding_criar`, bucket); ajuste do `criar-senha`; aplicar `pre_concluidos` no primeiro acesso |
| **instagram-hub** | Nada |

Tabela `onboardings` (rascunho recuperável): `contato_id`, `status` (`rascunho` → `revisado` → `criado` → `convite_enviado` → `senha_definida`), `extracao` (jsonb com valor/origem/confiança), `anotacoes`, `custo_estimado_usd`, datas.

---

## 8. Entregas, em ordem

| # | Entrega | O que você ganha já |
|---|---|---|
| 1 | **Criar por formulário**: tela Onboarding sem IA (dossiê manual) + `criar` + convite + ajuste do `criar-senha` | Já dá para fazer o onboarding de ponta a ponta. A IA depois só acelera. |
| 2 | **Leitura de documentos e imagens** → preenche o dossiê com origem e confiança | Para de digitar o que está no documento |
| 3 | **Leitura das anotações/transcrição** + coluna "falta perguntar" | O roteiro vivo da chamada |
| 4 | **Resumo na linha do tempo**, reenviar convite, onboardings em andamento, custo por leitura | Fechamento do ciclo |

Começar pela 1 é de propósito: ela entrega o fluxo completo e a parte delicada (conta, senha, convite) fica testada antes de a IA entrar.

---

## 9. Decisões que preciso de você

1. **Arquivos depois de lidos:** apagar tudo ao confirmar (recomendado), guardar por X dias, ou guardar sempre?
2. **Como você captura a fala da chamada?** Anotações suas, transcrição do Meet/Zoom colada, ou outra coisa? A proposta cobre texto. Áudio bruto exigiria um serviço de transcrição à parte, que não incluí.
3. **O onboarding é um serviço pago?** Se sim, preciso saber se o convite deve respeitar a tabela `subscriptions` (Stripe) ou se a conta nasce liberada por você.
4. **Convite pelo Estúdio de e-mails (recomendado) ou pelo e-mail padrão do Supabase?**
5. **Quem pode usar:** só você (hoje há 1 admin), correto?

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| IA lê errado um número de documento | Origem e confiança por campo; datas e números de documento sempre exibidos para conferir lado a lado |
| Conta criada pela metade | Transação no banco + rollback do usuário no Worker |
| Convite expira antes de ela abrir | Reenviar convite na ficha |
| Documento sensível vazando | Bucket privado, acesso admin, apagar após uso, nunca em log |
| Duas fontes de regra de checklist | O Worker não monta checklist; o app continua único |
