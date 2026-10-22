# Plano para fazer o primeiro onboarding o mais rápido possível

> Escrito em 2026-10-22. Resume as conversas recentes sobre o onboarding e ordena o trabalho por prioridade.
> Detalhe completo da proposta: `admin/crm/ONBOARDING.md` (mesma branch).
> **Estimativas de custo** vêm do gasto real das sessões anteriores dela: pequena ≈ US$ 1–3, média ≈ US$ 3–6, grande ≈ US$ 8–15. Não consigo ver a cota semanal dela; cada etapa abaixo tem um corte para parar onde o orçamento acabar.

---

## 1. Resumo do que foi decidido

**Fluxo.** Chamada de vídeo → documento solto no CRM → ficha com o Dossiê → convite → conta → 30 dias de acesso com cartão guardado → escolha do plano no dia 20–30 → cobrança no dia 30.

**Decisões fechadas**
- Documentos lidos pela IA são **apagados** ao confirmar; fica só o que o Dossiê define. Fala da chamada entra como **texto**.
- E-mails pelo **Estúdio de e-mails**. O caminho de estudo vem do documento da chamada.
- **30 dias de acesso completo com cartão**; depois do dia 30 sem plano o painel **bloqueia** (nada é apagado). Cancelou ou falhou: acesso **até o fim do período pago**.
- **Reembolso:** só ela decide; cancela a assinatura, não a conta.
- **Três níveis × três periodicidades** (semestral = 6× o mensal −5%; anual = 12× −10%). Moeda à escolha (conta Stripe é da França):

| | Mensal (R$ · €) | Semestral | Anual |
|---|---|---|---|
| Básico | 69 · 12 | 393 · 68 | 745 · 129 |
| Intermediário (proposto) | 149 · 26 | 849 · 148 | 1.609 · 280 |
| Completo (proposto) | 299 · 52 | 1.704 · 296 | 3.229 · 561 |

- **Radar** só do Intermediário em diante; **aviso crítico de prazo** vai a todos. Bloqueio feito no banco, não só na tela.
- **Interações com a Ingryd por mês:** Básico 4, Intermediário 8, Completo sem limite razoável. Chat resolve sozinho primeiro (Central de ajuda + IA com fonte).
- **Agenda:** 4 h de 1:1 por semana; onboarding 40 min com prioridade; 1:1 do app 30 min com assunto informado antes.
- **Engajamento:** registrar uso do painel, e-mail semanal de próximo passo, lembretes de prazo, reativação, resumo de valor nos dias 20 e 27, plano para o fim da jornada.

**Ainda aberto**
- Preço do 1:1 extra de 30 min. Referência encontrada numa sessão anterior: uma consulta de **59 € por 1 h**; isso sugere algo perto de **€ 35 por 30 min** (hipótese a confirmar).
- Vagas de fundadora e por quanto tempo a janela fica aberta.
- Confirmar preços do Intermediário e do Completo e os limites de 1:1 e de documentos.

## 2. O que as outras conversas deixaram pendente (e trava o onboarding)

Resumido do estado registrado em cada sessão; confira em cada uma antes de agir.

| Sessão | Pendência | Por que importa aqui |
|---|---|---|
| "Ficha não está aparecendo" | Dossiê commitado nas branches; **falta rodar `admin/crm/db/crm-dossie.sql` no Supabase e mesclar os PRs** (CRM e app) | O Dossiê é onde o onboarding acontece |
| "Plataforma — fase 2: propostas" | **PR #16 (chat flutuante do app) aguardando merge** | Chat do app que os níveis usam |
| "Página inicial com PESTEL" | PR #92 mesclado; **falta rodar `admin/crm/db/crm-radar.sql`** | Radar é diferencial pago |
| "Ambiente de teste para dashboard" | Plano de staging pronto; espera confirmar: app é o `POR-DENTRO-APP`, **3 planos**, e começar pelo passo 1 | Ensaiar o onboarding sem arriscar conta real |
| "Problema a resolver" | **Créditos da API Anthropic zerados** desde 18/10 (Bússola) | A leitura de documentos por IA depende de crédito |
| "Template análise e proposta de marketing" | SQL do Supabase do Painel do Certificado pendente | Fora do caminho do onboarding |

## 3. Plano por prioridade

A ordem segue **o que o primeiro onboarding exige e quando cada coisa vence**. Ponto central: a cobrança só acontece 30 dias depois, então **o que cuida de cobrança e bloqueio não precisa existir no dia 1**, só até o dia ~20.

### Etapa 0. Fazer o primeiro onboarding *sem código novo*  (custo: ~US$ 0 de tokens; é trabalho dela)

Com o que já existe, o primeiro onboarding é possível. A pessoa entra pelo login do app, recebe o código por e-mail e define a senha em `criar-senha`.

Checklist:
1. Rodar `crm-dossie.sql` e `crm-radar.sql` no Supabase e mesclar os PRs pendentes (Dossiê, chat PR #16).
2. Aplicar os dois e-mails de login no Supabase e testar (`POR-DENTRO-APP/db/emails/README.md`), e configurar SMTP próprio.
3. Criar no Stripe **um Payment Link por plano** (começar só pelo **Básico**), com teste grátis de 30 dias e cartão obrigatório **[conferir no Stripe se o Payment Link aceita teste grátis]**.
4. Ensaiar tudo com uma conta de teste dela mesma (aproveitar o plano de staging da sessão "Ambiente de teste").
5. Rodar o **primeiro onboarding de verdade:** chamada → preencher o Dossiê no CRM à mão → mandar o Payment Link do plano escolhido → pessoa entra pelo login do app e define a senha.
6. Anotar na ficha a **data do fim do teste** e criar lembrete no calendário para o **dia 20**. Anotar quanto tempo cada etapa levou.

**Corte:** se o orçamento só der para isso, você já fez o primeiro onboarding. O que falta é automação.

### Etapa 1. Dossiê vira perfil + convite pelo CRM  (média, ~US$ 3–6)

O que economiza mais tempo por pessoa depois do primeiro:
- botão **Enviar convite de acesso** na ficha (rota do Worker, só admin), que cria o usuário e **copia o Dossiê para o perfil**;
- ajuste do `criar-senha` com `convite_pendente` (senão a pessoa entra no painel sem definir senha);
- e-mails `convite_acesso` e `acesso_confirmado` no Estúdio.

### Etapa 2. Controle do dia 30 e registro de uso  (média, ~US$ 3–6)

Precisa existir **até o dia ~20** do primeiro grupo:
- `fim_teste` na assinatura e tela **"Escolha seu plano"** com bloqueio depois do dia 30;
- eventos de uso do painel (abrir, marcar item, ler artigo), pré-requisito de todo o engajamento;
- e-mails dos dias 20 e 27.

### Etapa 3. Escolha de plano, Stripe e webhook  (grande, ~US$ 8–15)

Precisa existir **antes do dia 30**: assinatura de verdade, moeda à escolha, três níveis, webhook com assinatura conferida e idempotente, `subscriptions` em dia, pausa de cobrança. Até lá, a cobrança do primeiro grupo pode ser feita pelo **Payment Link da etapa 0**.

### Etapa 4. Leitura de documentos por IA  (grande, ~US$ 8–15, e exige crédito de API)

Soltar o documento → ficha preenchida → apagar o arquivo. Vale quando houver volume. Para os primeiros onboardings, digitar o Dossiê é mais barato. **Antes de começar:** repor os créditos da API (sessão "Problema a resolver") e atualizar `/confidentialite/`.

### Etapa 5. Níveis e chat  (média cada, ~US$ 3–6)

Central de ajuda e limite de interações (4 / 8 / sem limite), Radar bloqueado no banco, 1:1 com assunto obrigatório e resumo da IA antes da chamada, e-mail semanal e reativação.

### Etapa 6 (futuro). Recrutar ajudantes para tratar os casos

Hoje o CRM tem **um único perfil de admin com acesso a tudo** (`admins` e `eh_admin()`). Para ter ajudantes é preciso desenhar antes de abrir acesso:
- **Papéis:** admin (você) e analista, que vê só os casos atribuídos a ele.
- **Atribuição de caso** na ficha (campo de responsável) e fila por pessoa.
- **Limites do que o analista vê:** sem cobrança, sem Radar editável, sem exportação em massa.
- **Registro de quem fez o quê** (auditoria na linha do tempo).
- **Privacidade:** dado pessoal e de visto exige contrato e acordo de confidencialidade com cada ajudante, e acesso que se revoga na hora.
- **Treinamento e padrão de resposta:** os modelos do Estúdio e as dúvidas frequentes viram a base.
Deixar para depois da etapa 3. Hoje a tabela `admins` e as regras de segurança assumem uma pessoa só.

## 4. Orçamento resumido

| Caminho | Etapas | Custo estimado de tokens |
|---|---|---|
| **Primeiro onboarding o mais rápido possível** | 0 | ~US$ 0 |
| + automação do dia a dia | 0 + 1 | ~US$ 3–6 |
| + segurar o dia 30 | 0 + 1 + 2 | ~US$ 6–12 |
| + cobrança automática e níveis | 0 a 3 | ~US$ 14–27 |
| + IA lendo documentos | 0 a 4 | ~US$ 22–42 |

Valores a partir das sessões anteriores dela; uma etapa pode custar mais se aparecer imprevisto. Confira a cota da semana em Configurações → Uso antes de escolher até onde ir.
