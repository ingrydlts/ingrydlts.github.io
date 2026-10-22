# Onboarding por chamada: documento no CRM → ficha → ativar conta

> Escrito em 2026-10-22, revisado no mesmo dia. **É uma proposta**: nada aqui vira código até virar item no Major Tasks do Notion.
> Verificado no código: `admin/crm/DOSSIE.md`, `db/crm-fase1.sql` (app), `criar-senha/index.html` (app), `cms-oauth-worker/worker.js`.
> O que não dá para afirmar sem testar aparece como **[conferir]**.

---

## 0. O fluxo em 4 passos

1. Você faz a chamada e pergunta tudo.
2. No CRM, **solta o documento** (e, se quiser, cola suas anotações) num campo de upload.
3. O sistema lê, **cria a pessoa** e **abre a página dela no CRM** (a ficha) com o Dossiê já preenchido.
4. Você revisa e clica **Enviar e-mail de ativação de conta**. Ela recebe, define a senha e entra no painel com o checklist pronto.

Não existe tela separada de "assistente de onboarding": a ficha que você já usa é o centro. O botão de ativação mora nela.

---

## 1. O que já existe e é reaproveitado

| Peça | Onde | Papel |
|---|---|---|
| **Ficha** da pessoa e **Dossiê** (`contatos.dossie`) | CRM | É a página que abre. O Dossiê é a lista de perguntas da chamada e o `DOSSIE.md` já prevê "copiar o dossiê para o perfil dela". Esta é essa etapa. |
| `contatos` + trigger `crm_on_auth_user` | banco | Liga a conta ao contato pelo e-mail e registra `acesso_ativado` e `senha_definida` na linha do tempo sozinho. |
| `crmRequireAdmin`, service role, Brevo | Worker | Rotas `/api/crm/*` que só respondem a admin e já enviam e-mail. |
| Estúdio de e-mails | CRM | O e-mail de ativação vira um modelo editável. |
| `gerarChecklist`, `prazos.js`, `data-integrity.js` | app | Continuam sendo os únicos que calculam checklist, prazo e incongruência. |

---

## 2. Passo 2 e 3: soltar o documento e abrir a ficha

**Onde:** botão **Novo por documento** no topo da lista de Contatos, e uma área de soltar arquivo dentro de qualquer ficha já existente (para acrescentar mais documentos depois).

**O que acontece ao soltar:**
- O Worker lê o documento (PDF ou foto: passaporte, VLS-TS, titre de séjour, contrat d'accueil, certificado de matrícula, carta de aceite) e extrai os campos objetivos.
- Se você colou anotações da chamada, lê também e preenche o que veio da sua fala.
- Cria o **contato** (sem conta ainda) e abre a ficha dele.
- Se o documento trouxer um nome que já existe no CRM ou se você informar o e-mail de um lead, **acrescenta à ficha existente** em vez de duplicar.

**Na ficha, cada campo do Dossiê mostra:**
- de onde veio (documento, fala, você digitou) e quanto a IA confia; baixa confiança fica destacada;
- campo que não apareceu em lugar nenhum fica vazio, nunca chutado, e entra numa lista **"falta perguntar"** no topo (útil se você ainda está no vídeo com ela);
- tudo editável. Nada vale até você aceitar: a IA sugere, você confirma.

**O e-mail é obrigatório para ativar.** Documento raramente traz e-mail. A ficha tem o campo **E-mail** em destaque, e o botão de ativação fica desabilitado até ele estar preenchido.

---

## 3. Passo 4: o botão "Enviar e-mail de ativação de conta"

Ao clicar (rota nova do Worker, só admin, a única com a service role):

1. Confere e-mail preenchido e persona definida (sugerida pela IA, você aceita com um clique).
2. Cria o usuário no Supabase Auth **sem senha**. O trigger existente liga ao contato.
3. Numa transação só, grava o perfil dela (`profiles`) a partir do Dossiê revisado, as datas importantes (`key_dates`), o resumo da chamada na linha do tempo e o consentimento. Se algo falhar, o usuário criado é apagado: sem conta pela metade.
4. Envia o e-mail de ativação com o link para **definir a senha**.
5. A ficha muda de estágio e mostra **"Convite enviado em dd/mm"**. Quando ela define a senha, o evento `senha_definida` aparece sozinho na linha do tempo.

O botão vira **Reenviar convite** depois do primeiro envio, e **Atualizar perfil** se a pessoa já tem conta.

**E-mail:** modelo novo `ativacao_conta` no Estúdio de e-mails (texto na sua voz, versão No ar). **[conferir]** quanto tempo o link vale no Supabase; se for curto, o "Reenviar convite" cobre.

---

## 4. Um problema real no código que a proposta resolve

`criar-senha/index.html` redireciona direto para o dashboard quando `onboarding_concluido` já é `true` ("Quem já passou por aqui não volta"). Como o perfil já nasce pronto, ela clicaria no e-mail e **cairia no painel sem nunca definir senha**.

**Solução:** coluna `profiles.convite_pendente`. Com ela ligada, `criar-senha` mostra **só os campos de senha** (sem perguntar persona nem refazer o upsert) e, ao salvar, desliga a flag e vai ao dashboard. Sem a flag, tudo segue como hoje.

**Checklist:** o Worker não monta checklist (a regra vive em JS no app; duplicar seria perder a fonte única). Ele grava o perfil e a lista `pre_concluidos` (passos que o documento provou). No primeiro acesso o app roda o `gerarChecklist` de sempre e marca esses passos como concluídos.

---

## 5. O que a IA faz e não faz

| Faz | Não faz |
|---|---|
| Lê documento e imagem e extrai campos objetivos (nome, datas, validade, tipo de visto, curso, nº do contrato) | Calcular prazo, checklist ou viabilidade |
| Lê suas anotações e preenche o Dossiê | Inventar: sem fonte, campo vazio |
| Sugere persona e caminho de estudo, explicando por quê | Decidir a persona sozinha |
| Marca como já feito o que o documento prova | Marcar feito só porque ela "disse que sim" |
| Escreve um resumo de 3 a 5 linhas da chamada | Guardar a transcrição inteira |
| Aponta incongruência (regra do `data-integrity.js`) | Corrigir sozinha |

Roda **só no Worker** (`ANTHROPIC_API_KEY` como secret do Cloudflare, nunca no navegador). Modelo configurável por variável de ambiente. Resposta em JSON validado contra schema, campo a campo `{valor, origem, confianca}`; se não validar, tenta mais uma vez e para. Custo estimado de cada leitura aparece na ficha.

---

## 6. Dados sensíveis (RGPD/LGPD)

- Passaporte e visto são dados pessoais de quem vive na França: o RGPD vale.
- Arquivos num bucket **privado** do Supabase Storage, acesso só `eh_admin()`. Nunca em repositório, log ou Brevo.
- Retenção: recomendo apagar o arquivo depois que você confirma o Dossiê e guardar só os campos (a menos que você marque "guardar" naquela pessoa).
- O arquivo vai à API de IA para ser lido: isso precisa constar em `/confidentialite/`. **[conferir]** a política de retenção da API antes de ligar.
- Consentimento: hoje `consentimentos.finalidade` aceita só `servico` e `novidades_email`. Acrescentar `documentos`, gravando o texto lido na chamada. Novidades por e-mail continua opt-in separado, nunca marcado por você.
- Apagar o contato continua apagando tudo em cascata.

---

## 7. O que muda em cada repositório

| Repositório | Mudança |
|---|---|
| **site** (`admin/crm`, `cms-oauth-worker`) | Botão "Novo por documento" e área de soltar na ficha; botão de ativação; rotas `ler`, `ativar`; modelo `ativacao_conta`; secret `ANTHROPIC_API_KEY` |
| **app** (`db/`, `criar-senha/`, dashboard) | `db/crm-onboarding.sql` (colunas `convite_pendente` e `pre_concluidos`, finalidade `documentos`, função `crm_ativar_conta`, bucket); ajuste do `criar-senha`; aplicar `pre_concluidos` no primeiro acesso |
| **instagram-hub** | Nada |

---

## 8. Entregas, em ordem

| # | Entrega | O que você ganha |
|---|---|---|
| 1 | **Botão de ativação** na ficha (Dossiê manual) + criar usuário + e-mail + ajuste do `criar-senha` | Já dá para ativar conta de qualquer pessoa da ficha. A parte delicada (conta e senha) fica testada. |
| 2 | **Soltar documento** → cria contato, abre ficha, preenche Dossiê com origem e confiança | Para de digitar o que está no documento |
| 3 | **Anotações da chamada** + lista "falta perguntar" + resumo na linha do tempo | O roteiro da chamada |
| 4 | Reenviar convite, custo por leitura, apagar arquivos após confirmar | Fechamento |

---

## 9. Decisões que preciso de você

1. **Arquivos depois de lidos:** apagar ao confirmar (recomendado), guardar por um prazo, ou guardar sempre?
2. **Anotações da chamada:** você digita/cola texto (a proposta cobre) ou espera áudio? Áudio exigiria um serviço de transcrição à parte, não incluído.
3. **O onboarding é pago?** A conta nasce liberada por você ou deve respeitar a assinatura (Stripe)?
4. **E-mail de ativação:** pelo Estúdio de e-mails (recomendado) ou pelo e-mail padrão do Supabase?
5. **E-mail da pessoa:** você o digita na ficha, certo? (o documento quase nunca traz)
