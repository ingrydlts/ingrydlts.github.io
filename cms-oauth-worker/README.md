# Worker de OAuth do /admin (Decap CMS) + API de avaliações

Um único Worker com duas funções:

1. Proxy OAuth que permite ao painel `/admin` do site logar com uma conta do GitHub e salvar
   alterações como commits — sem isso, o `/admin` carrega mas o botão "Login with GitHub" não funciona.
2. API das avaliações (estrelas + comentário) que aparecem na página de produto — recebe avaliações
   novas como pendentes, e serve a página `/admin/avaliacoes/` pra você aprovar ou rejeitar antes de
   irem ao ar.

O código já está pronto (`worker.js`). Falta publicá-lo na sua conta Cloudflare — isso só pode
ser feito por você, porque exige login na sua conta. Passo a passo pelo painel (sem precisar
instalar nada):

## 1. Publicar o Worker

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**.
2. Dê um nome, ex. `por-dentro-cms-oauth`, e clique em **Deploy** (ele cria com um código padrão de exemplo).
3. Clique em **Edit code**, apague tudo e cole o conteúdo de [`worker.js`](./worker.js) deste projeto.
4. Clique em **Deploy** de novo.
5. Anote a URL que ele te dá, algo como `https://por-dentro-cms-oauth.SEU-SUBDOMINIO.workers.dev`.

## 2. Criar o GitHub OAuth App

1. Acesse [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. Preencha:
   - **Application name**: `Por Dentro — CMS` (ou o que preferir)
   - **Homepage URL**: a URL do seu site (ex. `https://ingrydlts.github.io` ou seu domínio final)
   - **Authorization callback URL**: a URL do Worker do passo 1 + `/callback`, ex. `https://por-dentro-cms-oauth.SEU-SUBDOMINIO.workers.dev/callback`
3. Clique em **Register application**.
4. Anote o **Client ID** e gere um **Client Secret** (clique em "Generate a new client secret") — o secret só aparece uma vez, copie na hora.

## 3. Configurar as variáveis no Worker

1. Volte no Worker (Cloudflare → Workers & Pages → clique no worker) → **Settings** → **Variables and Secrets**.
2. Adicione duas variáveis do tipo **Secret** (não "texto puro", pra não ficarem visíveis):
   - `GITHUB_CLIENT_ID` = o Client ID do passo 2
   - `GITHUB_CLIENT_SECRET` = o Client Secret do passo 2
3. Salve — não precisa reeditar o código, o Worker já lê essas variáveis (`env.GITHUB_CLIENT_ID` / `env.GITHUB_CLIENT_SECRET`).

## 4. Apontar o /admin pro Worker

Em [`admin/config.yml`](../admin/config.yml), o campo `base_url` precisa da URL do Worker do passo 1
(sem `/callback` no final, só a raiz). Me avise a URL final que eu atualizo o arquivo — ou edite
você mesma a linha `base_url:`.

## 5. Testar o /admin

1. Acesse `seudominio.com/admin` (ou `https://ingrydlts.github.io/admin` enquanto não houver domínio próprio).
2. Clique em **Login with GitHub** — deve abrir um popup, pedir autorização e fechar sozinho.
3. Edite qualquer produto/banner/post e clique em **Publish** — confira que virou um commit novo no
   repositório `ingrydlts/ingrydlts.github.io` no GitHub, e que o site atualizou depois do deploy do GitHub Pages.

## 6. Criar a KV das avaliações

As rotas `/api/reviews/*` guardam os comentários numa **Cloudflare KV** (um banco de chave-valor simples,
incluso no plano gratuito).

1. No painel Cloudflare → **Workers & Pages** → aba **KV** (menu lateral) → **Create a namespace**.
2. Nome sugerido: `por-dentro-reviews`. Criar.
3. Volte no Worker (`por-dentro-cms-oauth`) → **Settings** → **Bindings** → **Add binding** → tipo **KV Namespace**.
4. **Variable name**: `REVIEWS_KV` (tem que ser exatamente esse nome, é o que o `worker.js` espera).
   **KV namespace**: escolha a `por-dentro-reviews` criada no passo 2. Salvar/Deploy.

Sem esse binding, `/api/reviews` responde erro 500 — o resto do site continua funcionando normalmente
(a seção de avaliações da página de produto trata a falha e mostra "ainda sem avaliações").

## 7. Moderar avaliações

Acesse `seudominio.com/admin/avaliacoes/` (mesmo login do passo 5 — qualquer conta GitHub com acesso
de escrita ao repositório pode moderar). Lá aparecem as avaliações pendentes agrupadas por produto,
com botões **Aprovar** e **Rejeitar**. Só avaliações aprovadas aparecem na página pública do produto.

## 8. Receber e-mail quando chegar avaliação pendente (opcional)

Sem configurar isso, tudo continua funcionando normalmente — só não avisa sozinho, e você precisa
checar `/admin/avaliacoes/` de vez em quando pra ver se tem algo novo. Pra receber um e-mail a cada
avaliação nova, usamos o [Resend](https://resend.com) (tem plano gratuito, dá pra mandar pro seu
próprio e-mail sem precisar verificar domínio próprio).

1. Crie uma conta em [resend.com](https://resend.com) (pode ser com o mesmo e-mail que você quer
   receber os avisos, ex. `ingrydigitalmanagement@gmail.com`).
2. No painel do Resend → **API Keys** → **Create API Key** → dê um nome (ex. `por-dentro-reviews`) →
   copie a chave gerada (só aparece uma vez).
3. Volte no Worker (`por-dentro-cms-oauth`) → **Settings** → **Variables and Secrets** → **Add**:
   - `RESEND_API_KEY` (tipo **Secret**) = a chave copiada no passo 2.
   - `NOTIFY_EMAIL` (tipo **Secret** ou **Text**, tanto faz) = o e-mail que deve receber o aviso.
4. Salvar/Deploy.

Enquanto o domínio do Resend não for verificado, os e-mails só chegam na própria conta usada pra
criar a chave (`onboarding@resend.dev` como remetente) — perfeito pra esse caso, já que é você mesma
recebendo. Se um dia quiser mandar de um endereço com o seu domínio (ex. `avisos@seudominio.com`),
aí sim precisa verificar o domínio no Resend.

## 9. Atualizar o Worker (toda vez que o código dele mudar)

O `git push` só sobe o código pro GitHub — ele **não** atualiza sozinho o Worker publicado no
Cloudflare. Toda vez que `worker.js` mudar, repita:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → clique no worker
   `por-dentro-cms-oauth`.
2. **Edit code** → apague tudo → cole o conteúdo atual de [`worker.js`](./worker.js) (pegue direto do
   GitHub, já atualizado) → **Deploy**.

## 10. Paywall dos artigos premium (removido)

A assinatura/compra avulsa de artigos premium foi retirada do site e do Worker. Depois de
atualizar o código (passo 9), dá pra limpar o que sobrou no Cloudflare — nada disso é mais lido:

- **Settings → Variables and Secrets**: apague `STRIPE_PRICE_ID`, `STRIPE_ARTICLE_PRICE_ID`,
  `ACCESS_TOKEN_SECRET` e `ADMIN_EMAILS`, se existirem. **Não apague `STRIPE_SECRET_KEY`** — ela
  continua sendo usada pra confirmar as vendas dos produtos digitais.
- **Settings → Bindings**: apague o binding `PREMIUM_KV`. A KV namespace em si (`por-dentro-premium`)
  guarda o texto pago antigo — só apague em **Workers & Pages → KV** depois de ter copiado o que
  quiser reaproveitar.

## 11. Criar o banco D1 de eventos (feedback, bot, blocos interativos)

Depois de atualizar o código (passo 9), a rota `/api/events` — que registra feedback dos artigos,
interações do assistente de vistos e (depois) dos blocos interativos — precisa de um banco **D1**
(SQL, incluso no plano gratuito). Sem ele, `/api/events` responde erro 500, mas o resto do site
continua funcionando normalmente (o botão de feedback, por exemplo, some silenciosamente).

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → aba **D1** (menu
   lateral) → **Create database**.
2. Nome sugerido: `por-dentro-events`. Criar.
3. Abra o banco recém-criado → aba **Console** → cole o conteúdo de
   [`schema.sql`](./schema.sql) deste projeto → **Execute** (cria a tabela `events`).
4. Volte no Worker (`por-dentro-cms-oauth`) → **Settings** → **Bindings** → **Add binding** → tipo
   **D1 database**.
5. **Variable name**: `EVENTS_DB` (tem que ser exatamente esse nome, é o que o `worker.js` espera).
   **D1 database**: escolha a `por-dentro-events` criada no passo 2. Salvar/Deploy.

**No `/admin`**: acesse a coleção **"Consentimento e cookies"** e confira o texto do banner que vai
aparecer pros visitantes — o interruptor "Ligar/desligar toda a medição de audiência" nesse mesmo
painel desliga tudo de uma vez (banner, eventos, e futuramente GA4/Clarity/anúncios) sem precisar
mexer em código.

## 12. Configurar o questionário de vagas limitadas (`/acesso-vip/`)

Página que só libera um link do Google Drive pras N primeiras respostas de um formulário (padrão:
10), travando sozinha depois disso. Usa o **mesmo banco D1** do passo 11 (`EVENTS_DB`) — se você já
criou esse banco, só falta rodar o `schema.sql` de novo (ele é seguro de repetir: usa
`CREATE TABLE IF NOT EXISTS`, não apaga nem duplica nada) e configurar duas variáveis novas.

1. Se ainda não tiver o banco D1 do passo 11, crie ele primeiro (é o mesmo banco, não precisa de um
   segundo).
2. No banco (`por-dentro-events` ou o nome que você deu) → aba **Console** → cole o conteúdo
   atualizado de [`schema.sql`](./schema.sql) → **Execute**. Isso cria as tabelas `quiz_counters`
   (o contador de vagas) e `quiz_submissions` (cada resposta), sem mexer na tabela `events` já
   existente.
3. No Worker → **Settings** → **Variables and Secrets** → adicione:
   - `QUIZ_DRIVE_LINK` — a URL do Google Drive que vai ser liberada. Fica só aqui, nunca em
     `content/*.json` (esse arquivo é público). Enquanto não preencher, quem for aprovada recebe a confirmação mas vê um aviso no
     lugar do botão, em vez de um link quebrado.
   - `QUIZ_LIMIT` — opcional, número de vagas antes de travar (padrão `10` se não definir).
4. **No `/admin`**: acesse a coleção **"Questionário de vagas limitadas (/acesso-vip/)"** pra editar
   título, subtítulo, as perguntas do formulário, os textos de sucesso/vagas encerradas, o link de
   pagamento da Etapa 2 (5€) e o FAQ — nada disso precisa de código.
5. **Pra ver quem respondeu** (nome, Instagram, e-mail, respostas, se ganhou a vaga) — útil pra
   fazer o contato direto na DM ou reimpactar quem ficou de fora com a oferta paga — chame
   `GET /api/quiz/submissions` no Worker com o mesmo login que você usa no `/admin` (é a rota
   protegida, mesmo esquema das avaliações — ainda não tem uma tela própria no
   `/admin/dashboard/` pra isso, é consultar a rota diretamente por enquanto).
6. **Pra reabrir uma nova rodada de vagas** depois que travar: no Console do D1, rode
   `UPDATE quiz_counters SET liberadas = 0 WHERE id = 'default';` — isso zera o contador sem apagar
   o histórico de quem já respondeu (`quiz_submissions` continua intacto).

---

## 13. Exportar agregados pro instagram-hub (`GET /api/insights/export`)

O instagram-hub (repositório privado) lê as métricas do site por automação (GitHub Actions). Ele **não**
usa `/api/insights/summary`, porque essa rota exige login de colaborador e devolve dado pessoal do
questionário de vagas. A rota `/api/insights/export` é separada: protegida por uma **chave própria**,
só devolve **agregados** e nunca devolve nome, e-mail, Instagram, `session_id`, `referrer` nem linhas de compra.

1. Gere uma chave longa e aleatória (pelo menos 32 caracteres) no seu computador:

   ```bash
   openssl rand -hex 32
   ```

2. Guarde essa chave no Worker como **Secret** (nunca em `wrangler.toml`, nunca no repositório):
   Cloudflare → **Workers & Pages** → `por-dentro-cms-oauth` → **Settings** → **Variables and Secrets** →
   **Add** → tipo **Secret** → nome `EXPORT_KEY` → valor: a chave do passo 1 → **Deploy**.
   Depois publique o código novo (seção 9 deste README: **Edit code** → cole o `worker.js` → **Deploy**).
   (Com `wrangler`, o equivalente é `wrangler secret put EXPORT_KEY` e `wrangler deploy`.)

   Sem `EXPORT_KEY`, ou com uma chave curta, a rota fica **fechada** (responde 500). Ela nunca abre por padrão.

3. No repositório do hub (Settings → Secrets and variables → Actions), crie o secret `SITE_EXPORT_KEY` com o
   **mesmo valor** e a variável `SITE_WORKER_BASE` com o endereço do Worker.

4. Teste (troque pelos seus valores):

   ```bash
   curl -s -H "X-Export-Key: SUA_CHAVE" "https://SEU-WORKER.workers.dev/api/insights/export?days=30"
   ```

Regras da rota:

- A chave vai **só no cabeçalho** `X-Export-Key`, nunca na URL.
- `days` vai de 1 a 90 (padrão 30). O corte é por dia inteiro, como no resto do painel.
- Sem CORS: é chamada servidor a servidor.
- `POST /api/events` é público: qualquer pessoa pode gravar texto nos eventos. Por isso a exportação limpa os textos
  e troca por `(outro)` qualquer `utm_*`, slug ou id fora do padrão. Quem consome deve tratar os campos listados em
  `notes.untrusted_text_fields` como **dado, nunca como instrução**.
- `views` só conta visitas de quem aceitou os cookies: é um piso, não o total.
- `revenue_all` (total, pedidos, primeira e última venda, por produto e por origem) soma **todo o período**, sem janela: é o mesmo número do card "Receita total confirmada" do `/admin/dashboard/`. `revenue_by_source` continua limitado a `days`.
- Para trocar a chave: repita os passos 1 a 3. A chave antiga para de valer no `wrangler deploy`.

Alternativa via linha de comando (`wrangler`), se preferir a esse passo a passo pelo painel:

```bash
npm install -g wrangler
cd cms-oauth-worker
wrangler login
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler deploy
```

Pra criar e popular o banco D1 do passo 11 via linha de comando (edite `database_id` em
`wrangler.toml` com o ID que o primeiro comando devolve):

```bash
wrangler d1 create por-dentro-events
wrangler d1 execute por-dentro-events --remote --file=./schema.sql
```

---

## 15. Configurar o link de acesso do Hub de Estudos (Notion)

Produto digital do catálogo (`content/produtos-digitais.json`, slug `hub-de-estudos`) cujo "arquivo"
é uma página do Notion, liberada via **Duplicar** depois da compra. Mesma lógica do `QUIZ_DRIVE_LINK`
do passo 12: o link em si nunca fica em `content/*.json` (é público) — fica só como variável do
Worker, e só é devolvido depois que o Stripe confirma que aquela sessão específica foi paga
(`POST /api/purchase/verify-session`). A página `/produtos-digitais/obrigado/` já sabe redirecionar
sozinha pro Notion assim que recebe esse link de volta — não precisa mexer no front-end.

1. No Worker (`por-dentro-cms-oauth`) → **Settings** → **Variables and Secrets** → **Add** → tipo
   **Secret** → nome `HUB_ESTUDOS_NOTION_LINK` → valor: o link do Notion (o mesmo de
   "Compartilhar" → "Copiar link", com `?source=copy_link`) → **Deploy**.
   (Com `wrangler`: `wrangler secret put HUB_ESTUDOS_NOTION_LINK` e depois `wrangler deploy`.)
2. Publique o `worker.js` atualizado (seção 9 deste README, ou `wrangler deploy`).
3. Confira que a página do Notion está com **"Permitir duplicar"** ativado (menu **···** da página →
   **Duplicar como modelo** / compartilhamento público com duplicação) — sem isso, quem chegar lá
   consegue ver a página mas não duplicar pra própria conta.

Sem essa variável configurada, a compra continua sendo confirmada e registrada normalmente — só que
a página de confirmação mostra um aviso ("o link ainda está sendo configurado") em vez de redirecionar,
nunca um link quebrado.

## 16. Enviar e-mails do CRM pelo Brevo (`/admin/crm/`)

O painel do CRM manda e-mail (boas-vindas e reimpacto) pelo Worker, que chama o Brevo. Quem pode enviar:
só quem está logada no CRM **e** na tabela `admins` do Supabase (o Worker confere isso a cada envio).

**No Brevo**
1. **Remetente**: menu do perfil → **Senders, Domains & Dedicated IPs** → **Senders** → adicione o e-mail de onde
   os e-mails saem e confirme pelo link que chega. Depois, em **Domains**, autentique o domínio (DKIM/DMARC) —
   sem isso boa parte cai no spam.
2. **Chave**: **SMTP & API** → **API Keys** → **Generate a new API key** (nome: `crm-por-dentro`). Copie: só aparece uma vez.

**No Supabase**
3. **Project Settings → API Keys** → copie a chave **service_role** (secret). Ela só é usada pelo webhook do
   passo 6; nunca vai pro navegador.

**No Worker** (Settings → Variables and Secrets)
4. Adicione:
   - `BREVO_API_KEY` (Secret) = a chave do passo 2
   - `BREVO_SENDER_EMAIL` (Text) = o remetente verificado
   - `BREVO_SENDER_NAME` (Text, opcional) = ex. `Ingryd · Por Dentro`
   - `BREVO_WEBHOOK_SECRET` (Secret) = uma senha longa inventada (24+ caracteres; ex. `openssl rand -hex 24`)
   - `SUPABASE_SERVICE_ROLE_KEY` (Secret) = a chave do passo 3
5. Atualize o código do Worker (seção 9) — as rotas novas são `/api/crm/enviar` e `/api/crm/brevo-webhook`.

**De volta ao Brevo**
6. **Transactional** → **Settings** → **Webhook** → **Add a new webhook**:
   - URL: `https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev/api/crm/brevo-webhook?k=` + o valor de `BREVO_WEBHOOK_SECRET`
   - Eventos: *Delivered, Opened, Clicked, Hard bounce, Blocked, Invalid email, Error, Unsubscribed*.

   Sem o webhook o e-mail sai, mas fica "agendado" pra sempre e os segmentos do Reimpactar não funcionam.

**No painel**
7. Em `admin/crm/crm.js`, preencha `APP_LINK` com o endereço do app. Enquanto estiver vazio, o texto continua com
   `[link do acesso]` e o Worker **recusa** o envio (de propósito).

Regras que o Worker aplica: modelos *abriu, não clicou* e *abriu o app e parou* só saem pra quem aceitou
novidades; e-mails que não são boas-vindas levam um rodapé "responda *sair*" e o cabeçalho `List-Unsubscribe`.
Quem pedir pra sair: registre em Consentimento (o link de descadastro do Brevo faz isso sozinho pelo webhook).
Modelos do guia do VLS-TS (`guia_chamada` e `guia_plataforma`): o primeiro convida pra uma conversa (Cal.com) e
usa o prazo do VLS-TS quando a pessoa informou a data de entrada; o segundo apresenta a plataforma como teste.
Os dois são oferta comercial, então o Worker **só deixa enviar a quem aceitou novidades**. Se você mudar a lista
`CRM_MODELOS` no `worker.js`, lembre de atualizar o Worker publicado (seção 9).

Limite de honestidade: "abriu" no Brevo não é 100% confiável (Apple Mail e outros pré-carregam a imagem), então
use como sinal, não como certeza.

## 17. CRM fase 0: e-mail 1 do guia sozinho e respostas por e-mail no CRM

O que faz: quem se cadastra no guia `/guias/etudes-en-france-2027-2028/` recebe na hora o **e-mail 1**
(`cf_guia_1`: o link do Notion, o prazo do nível, o próximo passo da etapa e uma pergunta). Quem responde a um e-mail
do CRM escreve para `respostas@imigrantepordentro.com`; a resposta entra na **Caixa de entrada** do `/admin/crm/`
e também chega no seu e-mail. Pré-requisito: a seção 16 pronta (Brevo, `SUPABASE_SERVICE_ROLE_KEY`).

Como funciona: a função `capturar_lead_guia` do Supabase chama `POST /api/crm/guia-capturado` pelo **pg_net**,
com um segredo no cabeçalho `X-Crm-Hook`. O Worker confere o segredo, lê a ficha e o link do Notion com a
service_role, reserva a linha em `emails_enviados` (um índice só deixa **um** `cf_guia_1` por pessoa), envia pelo
Brevo e guarda o id da mensagem. A resposta chega pelo **Email Routing** da Cloudflare no handler `email()` do
Worker, que lê só o texto (sem a citação do e-mail original, até 5.000 caracteres), ignora respostas automáticas,
grava em `respostas_email` e **sempre** reencaminha a mensagem original para você.

Faça nesta ordem (o passo 7 é o que liga o envio):

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-enriquecimento.sql` (se ainda não rodou) e depois
`admin/crm/db/crm-fase0-email-guia.sql`. Depois: Database → Extensions → procure **pg_net** → ligue.

**2. Segredo da rota** — no SQL Editor:
```sql
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'crm_hook_secret', 'Segredo da rota /api/crm/guia-capturado');
select decrypted_secret from vault.decrypted_secrets where name = 'crm_hook_secret';
```
Copie o valor que aparece (48 letras e números). Ele ainda **não** liga nada: falta o endereço do Worker (passo 7).

**3. Variáveis do Worker** (Settings → Variables and Secrets):
   - `CRM_HOOK_SECRET` (Secret) = o valor do passo 2
   - `CRM_ENCAMINHAR_PARA` (Text) = o seu e-mail, para onde as respostas são reencaminhadas. Ele precisa estar
     verificado em Email Routing → **Destination addresses** (se outra regra já manda para ele, já está).
   - `CRM_REPLY_TO` (Text) = `respostas@imigrantepordentro.com`. **Só crie depois do passo 5**: enquanto ela não
     existir, o Reply-To continua sendo o remetente (`BREVO_SENDER_EMAIL`), como hoje.

**4. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Rotas novas: `/api/crm/guia-capturado`
e o handler `email()`.

**5. Email Routing** — dash.cloudflare.com → `imigrantepordentro.com` → **Email** → **Email Routing**:
   1. Aba **Routing rules**: anote as regras que já existem e **não mexa nelas**.
   2. **Create address** → Custom address: `respostas` → Action: **Send to a Worker** → Destination:
      `por-dentro-cms-oauth` → Save.
   3. Agora crie a variável `CRM_REPLY_TO` do passo 3.

**6. Teste das respostas** — mande, do seu Gmail, um e-mail para `respostas@imigrantepordentro.com`. Ele deve
aparecer em CRM → Caixa de entrada → **Respostas por e-mail** (como "sem ficha" se o seu e-mail não tiver ficha)
e voltar para a sua caixa, reencaminhado. Se não aparecer: Workers → `por-dentro-cms-oauth` → **Logs**.

**7. Ligar o e-mail 1** (só depois de aprovar o texto final) — no SQL Editor:
```sql
select vault.create_secret('https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev', 'crm_worker_url', 'Worker do CRM (e-mail 1 do guia)');
```
A partir daí, cada cadastro novo no guia manda o e-mail 1. **Para desligar**: Project Settings → Vault → apague
`crm_worker_url` (o cadastro continua funcionando igual).

**8. Teste de ponta a ponta** — cadastre-se no guia com o seu Gmail (aba anônima) → o e-mail 1 chega na caixa
principal (não no spam) → responda → a resposta aparece na Caixa de entrada do CRM e chega reencaminhada no seu e-mail.
Para testar de novo com o mesmo e-mail, apague a linha `cf_guia_1` dela em Table Editor → `emails_enviados`.

Se o e-mail 1 não chegar: Supabase → SQL Editor → `select status_code, content from net._http_response order by created desc limit 5;`
(401 = segredo diferente entre Vault e Worker; 500 = falta variável no Worker) e os **Logs** do Worker.

Regras: `cf_guia_1` é **serviço** (sai para todo mundo que pediu o guia, sem exigir novidades, sem rodapé de
descadastro). O texto mora em `cfGuia1()` no `worker.js`; trocou o texto, atualize o Worker (seção 9).
Se o Brevo recusar o envio, o Worker desfaz a reserva: a pessoa recebe se voltar a se cadastrar.
Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` (sem dependências, sem rede).

## 18. CRM fase 1a: e-mail 2 do guia (a conversa) e página `/conversa/`

O que faz: no dia seguinte ao e-mail 1, às **10h de Brasília**, quem pediu o guia Études en France **e aceitou
novidades** recebe o **e-mail 2** (`cf_guia_conversa`): sua foto, a pergunta "para qual cidade você quer ir?" e um
botão por cidade (Paris, Lyon, Toulouse, Montpellier, Bordeaux, Lille, Outra cidade, Ainda não sei). O botão abre
`imigrantepordentro.com/conversa/`, que anota a cidade ("✓ Anotado: Lyon") e deixa a pessoa contar o curso numa
caixa de texto. O toque e o texto entram na **Caixa de entrada** do CRM (aba Respostas, com o canal "tocou no e-mail 2"
ou "escreveu na página da conversa") e em "Precisa de você". A cidade fica em `contatos.respostas.cfCidade` (quem
toca de novo fica com a última). O e-mail 1 passa a ser a versão de 15/10 (sem a apresentação e sem a pergunta, com
a linha "Ficou com dúvida? É só responder este e-mail. Chega direto para mim.").

Como funciona: um **Cron Trigger** chama o handler `scheduled()` do Worker uma vez por dia. Ele pergunta ao banco
quem deve receber (`crm_conversa_pendentes`: e-mail 1 recebido antes de hoje no fuso de Brasília, há no máximo
7 dias, aceita novidades, ainda sem o e-mail 2), reserva a linha em `emails_enviados` (o mesmo índice da fase 0 deixa
só **um** e-mail 2 por pessoa), envia pelo Brevo com rodapé "responda sair" e `List-Unsubscribe`, e guarda o id da
mensagem. Cada botão leva um **link assinado** (HMAC-SHA256 com o segredo `CRM_LINK_SECRET`) que contém só o id da
ficha e a validade (30 dias): nada de e-mail nem nome. A página só grava por **POST** (`/api/conversa/toque` e
`/api/conversa/texto`), então os filtros de segurança que abrem os links sozinhos não registram nada. Link vencido
mostra "Este link venceu" e pede para responder o e-mail.

Pré-requisito: a seção 17 pronta (e-mail 1 no ar).

Faça nesta ordem:

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-fase1a-conversa.sql` (pode rodar de novo sem problema).

**2. Segredo do link** — ainda no SQL Editor, gere um valor:
```sql
select encode(extensions.gen_random_bytes(32), 'hex');
```
Copie as 64 letras e números. Workers → `por-dentro-cms-oauth` → Settings → Variables and Secrets → **Add**:
`CRM_LINK_SECRET` (tipo **Secret**) = esse valor. Não troque depois: trocar invalida os botões dos e-mails já enviados.
(Opcional: `CRM_CONVERSA_LOTE` (Text) = quantos e-mails 2 por dia, padrão 15. No plano gratuito da Cloudflare deixe
15: cada envio usa 3 chamadas e o limite é 50 por execução.)

**3. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). A partir daqui o e-mail 1 já sai na versão
de 15/10. Rotas novas: `/api/conversa/toque`, `/api/conversa/texto`, `/api/crm/conversa-rodar` e o handler `scheduled()`.

**4. Site** — o merge do pull request publica a página `/conversa/` (GitHub Pages) e o CRM com o canal.

**5. Cron Trigger** — Workers → `por-dentro-cms-oauth` → **Settings** → **Trigger Events** (ou "Triggers") →
**Add** → **Cron Triggers** → expressão `0 13 * * *` → Add. A Cloudflare usa o horário UTC: 13h UTC = 10h de Brasília.

**6. Teste de ponta a ponta** (com o seu Gmail, que precisa ter recebido o e-mail 1 e aceitado novidades no guia):
   1. No SQL Editor, finja que o seu e-mail 1 saiu ontem (troque o e-mail):
      ```sql
      update emails_enviados set enviado_em = now() - interval '1 day'
       where modelo = 'cf_guia_1' and contato_id = (select id from contatos where email = 'SEU_EMAIL@gmail.com');
      select * from crm_conversa_pendentes(15);   -- você deve aparecer aqui
      ```
   2. Rode o envio na hora, sem esperar as 10h:
      ```sql
      select net.http_post(
        url := 'https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev/api/crm/conversa-rodar',
        headers := jsonb_build_object('X-Crm-Hook', (select decrypted_secret from vault.decrypted_secrets where name = 'crm_hook_secret')));
      ```
      Depois de alguns segundos: `select status_code, content from net._http_response order by created desc limit 1;`
      → `200` com `{"pendentes":1,"enviados":1,...}`.
   3. O e-mail 2 chega no Gmail → toque em Lyon → a página mostra "✓ Anotado: Lyon" e "Obrigada, {seu nome}!" →
      escreva um curso e envie → no CRM, Caixa de entrada → **Respostas**, aparecem o toque e o texto; a sua ficha
      mostra "Cidade (tocou no e-mail 2): Lyon" e "Tocou no e-mail 2: Lyon" na linha do tempo.
   4. Para testar de novo com o mesmo e-mail, apague a linha `cf_guia_conversa` dela em Table Editor → `emails_enviados`.

Se o e-mail 2 não sair: Workers → `por-dentro-cms-oauth` → **Logs** (procure `crm/conversa`). `{"erro":"config"}` =
falta `CRM_LINK_SECRET` (ou tem menos de 32 caracteres), `SUPABASE_SERVICE_ROLE_KEY` ou o Brevo; `{"erro":"lista"}`
= o SQL do passo 1 não rodou. Se o Brevo recusar, o Worker desfaz a reserva e a pessoa entra de novo no dia seguinte
(enquanto estiver na janela de 7 dias).

**Para desligar o e-mail 2**: apague o Cron Trigger (passo 5). A página e as rotas continuam funcionando para os links
já enviados.

Regras: `cf_guia_conversa` é **novidades** (só para quem aceitou; o banco confere o consentimento mais recente). O texto
mora em `cfGuiaConversa()` e o do e-mail 1 em `cfGuia1()`, no `worker.js`; trocou o texto, atualize o Worker (seção 9).
A lista de cidades está em `CF_CIDADES` (Worker), em `crm_conversa_toque` (SQL) e em `CF_CIDADE` (`admin/crm/crm.js`):
mudou uma, mude as três. Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` e, no banco,
`cd admin/crm/db/testes && APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1a`.

## 19. CRM fase 1b: aba Conversa na ficha e responder do CRM

O que faz: a ficha de cada pessoa no `/admin/crm/` ganha as abas **Conversa** e **Ficha** (a ficha de antes, sem mudança).
A Conversa mostra num fio só, em ordem, os e-mails que saíram (os automáticos do guia como "Automático", os seus como
"Você"), o toque no e-mail 2, o que ela escreveu na página `/conversa/` e as respostas por e-mail. Ao lado: o prazo do
nível dela, a etapa, a cidade, de onde veio e se aceitou novidades. Embaixo, a caixa para responder. Na Caixa de entrada,
"Responder pelo e-mail" virou **Abrir conversa** (quem não tem ficha continua com o botão de e-mail).

Como funciona: o painel chama `POST /api/crm/responder` (mesmo login de admin do `/api/crm/enviar`). O Worker pega a
última mensagem da conversa que existe no Gmail dela (a resposta dela por e-mail ou um e-mail nosso), manda com o assunto
`Re: <assunto>`, os cabeçalhos `In-Reply-To` e `References` apontando para ela e o Reply-To `respostas@`. Sem rodapé de
descadastro (é resposta 1:1). Grava em `emails_enviados` com o modelo `resposta` e marca as respostas novas dela como
respondidas. Se ela responder de novo, a resposta volta para a aba pelo caminho da fase 0 (handler `email()`).
Se ainda não houve nenhum e-mail com a pessoa, a caixa pede um assunto.

**Limite a confirmar no teste**: a documentação do Brevo diz que o campo `headers` da API é para cabeçalhos "custom"
e que cabeçalhos padrão não são suportados; `In-Reply-To` e `References` são padrão. Se o Brevo **recusar** o envio por
causa deles, o Worker reenvia sem eles e o painel avisa ("O Brevo não aceitou os cabeçalhos da conversa…"): a resposta
chega como `Re: <assunto>`, mas pode aparecer separada no Gmail dela. Se o Brevo **aceitar e tirar** os cabeçalhos em
silêncio, o painel não tem como saber: por isso o passo 4 abaixo.

Faça nesta ordem:

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-fase1b-resposta.sql` (depois da fase 1a; pode rodar de novo).
Ele só tira as suas respostas do cálculo do Reimpactar.

**2. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Rota nova: `/api/crm/responder`. Nenhuma variável nova.

**3. Site** — o merge do pull request publica o CRM com a aba.

**4. Teste de ponta a ponta** (com o seu Gmail, que já recebeu o e-mail 1 do guia):
   1. Responda o e-mail 1 pelo Gmail. A resposta aparece em CRM → Caixa de entrada → Respostas.
   2. Clique em **Abrir conversa**, escreva uma resposta e envie.
   3. No Gmail: a resposta tem que aparecer **dentro da mesma conversa** do e-mail 1. Para conferir os cabeçalhos:
      abra a mensagem → ⋮ → **Mostrar original** e procure `In-Reply-To:` e `References:`.
   4. Responda essa mensagem pelo Gmail: a resposta volta para a aba Conversa como nova.

Se a resposta do CRM cair numa conversa separada (ou o "Mostrar original" não tiver `In-Reply-To`), o Brevo está tirando
os cabeçalhos. A volta (passo 4.4) continua funcionando, porque ela usa o id da mensagem que o próprio Brevo cria.
Alternativas nesse caso: perguntar ao suporte do Brevo se libera `In-Reply-To`/`References` na API, ou mandar as respostas
1:1 por outro serviço que aceite esses cabeçalhos.

Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` e, no banco,
`cd admin/crm/db/testes && APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1b`.

## 20. Estúdio de e-mails 1: os modelos no Supabase

O que faz: os 10 modelos de e-mail passam a morar no Supabase, numa tabela sua (`modelos_email`), com as versões
guardadas (`modelos_email_versoes`). A tela **Modelos de e-mail** do `/admin/crm/` lista todos, com o objetivo, o tipo
(serviço, novidades, compra), como sai e a etapa (Rascunho, Revisão, No ar, Arquivado), e o botão **Exportar modelos**
baixa todos num arquivo (`.json`, com o texto e o HTML de cada versão).

Os dois e-mails que saem sozinhos (o e-mail 1 e o e-mail 2 do guia Campus France) passam a sair com o texto da versão
**No ar** da tabela: trocar o texto ali muda o e-mail, sem colar o Worker. Se a tabela falhar (fora do ar, sem versão No ar,
ou um texto com variável que não existe), o Worker manda o texto de hoje, que continua no código, e anota nos Logs
(`crm/modelos: …`). Quem recebe e quando continua no código (`CRM_MODELOS_EXIGEM_NOVIDADES` e as conferências de cada rota).
Os 8 modelos do painel ficam guardados na tabela; desde a entrega 2 (seção 21) o painel abre com o texto No ar daqui.

Variáveis no texto: `{nome}` troca pelo valor; `{#nivel}…{/nivel}` só aparece se houver nível; `{^nivel}…{/nivel}` só se
não houver. A lista de variáveis de cada modelo aparece na tela (Variáveis).

Faça nesta ordem:

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-modelos-email.sql` (depois da fase 1b; pode rodar de novo
sem desfazer o que você mudou). Antes do Worker novo, nada muda nos envios.

**2. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Nenhuma variável nova: ele lê a tabela com a
`SUPABASE_SERVICE_ROLE_KEY` que já existe.

**3. Site** — o merge do pull request publica a tela nova.

**4. Teste**:
   1. CRM → Modelos de e-mail: aparecem 10 modelos (8 em "Você envia", 2 em "Saem sozinhos"), todos "No ar · v1".
   2. Clique em **Exportar modelos**: baixa `modelos-email-por-dentro-AAAA-MM-DD.json` com os 10.
   3. Trocar um texto (exemplo com o assunto do e-mail 1). No SQL Editor:
      ```sql
      select public.modelo_email_nova_versao('cf_guia_1');   -- cria a versão 2, rascunho, cópia da 1
      update public.modelos_email_versoes set assunto = '{#nome}{nome}, o seu{/nome}{^nome}O seu{/nome} checklist do Études en France chegou'
       where chave = 'cf_guia_1' and versao = 2;
      select public.publicar_modelo_email('cf_guia_1', 2);  -- a 2 vai No ar, a 1 fica guardada como Arquivada
      ```
      Peça o guia (`/guias/etudes-en-france-2027-2028/`) com um e-mail que ainda não pediu (o e-mail 1 sai uma vez só por
      pessoa; no Gmail dá para usar `seunome+teste2@gmail.com`): ele chega com o assunto novo.
      Para voltar: `select public.publicar_modelo_email('cf_guia_1', 1);`
   4. Uma versão que já saiu (No ar ou Arquivada) não muda de texto: o banco recusa e pede uma versão nova. É o que guarda o histórico.

Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` (compara os e-mails montados com o texto da tabela com os de hoje)
e, no banco, `cd admin/crm/db/testes && APP_DB_DIR=<POR DENTRO APP>/db npm run test:modelos`.

## 21. Estúdio de e-mails 2: editar, testar e publicar no CRM

O que faz: a tela **Modelos de e-mail** do `/admin/crm/` vira um estúdio em três colunas, como o de produtos do admin:
à esquerda os modelos, no meio o editor em seções (Objetivo e envio, Para quem, Contexto da pessoa, Texto, Pronto para
usar?, Versões) e à direita a prévia com uma pessoa de verdade do CRM, no computador ou no celular, com avisos (não aceitou
novidades, não pegou o guia, dado faltando e o que aparece no lugar).

O texto é feito de **blocos** (texto, título, botão, destaque, apresentação com foto, pergunta, respostas de um toque, trecho
só para uma etapa, assinatura), sem HTML escrito à mão. O rodapé vem do tipo: novidades leva "responda com a palavra sair";
serviço e compra não. Cada dado da pessoa (`{nome}`, `{nivel}`, `{prazo_nivel}`, `{etapa}`, `{cidade}`…) tem um **plano B**
(o que escrever se faltar, ou "o bloco some"); um bloco pode ter o próprio texto "se faltar um dado". Os links (o do Notion,
o do app, o da agenda) e os botões de cidade nunca são digitados: o botão escolhe o dado e o Worker preenche na hora.
O estúdio monta o assunto, a prévia, o texto puro e o HTML a partir dos blocos e grava tudo na versão
(`modelos_email_versoes`). O Worker continua lendo a versão No ar como na seção 20: nada muda no jeito de enviar.

O caminho de uma mudança: **Editar em versão nova** (cria um rascunho; as versões de hoje viram blocos com o mesmo texto) →
editar (guarda sozinho) → ver a prévia com duas pessoas → **Enviar teste para mim** → **Mandar para revisão** → **Publicar**.
O botão Publicar só acende com o teste enviado depois da última mudança. A versão anterior fica guardada (Arquivada) e o
botão **Voltar para esta** a põe No ar de novo.

- Os 2 automáticos (e-mail 1 e e-mail 2 do guia Campus France): o próximo envio já sai com a versão publicada.
- Os 8 manuais: o "Escrever este e-mail" da ficha passa a abrir com o texto No ar da tabela (você ainda edita antes de
  enviar). Eles continuam saindo em texto simples, como hoje; o texto do `crm.js` fica só de reserva.

**Rota nova:** `POST /api/crm/modelo-teste` (login de admin do CRM, como `/api/crm/enviar`). Recebe `{ chave, versao,
contato_id, vars }`, monta a versão com os dados daquela pessoa e manda **só para o e-mail de quem está logada**, com
`[Teste]` no assunto. Não grava em `emails_enviados` (não conta como envio nem no Reimpactar) e marca a versão como testada.
Nos 2 automáticos os dados vêm do banco, como no envio de verdade (o link privado do Notion sai de `guias_links`); os botões
do e-mail 2 levam um link de teste, que não registra toque na ficha de ninguém. Nos manuais vão os dados que o painel preenche.

Também muda no `/api/crm/enviar`: se o texto já traz o rodapé "responda com a palavra sair" (modelos montados no estúdio),
o Worker não põe outro; e grava `modelo_versao` quando o painel diz de qual versão o texto partiu.

Faça nesta ordem:

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-estudio-emails-2.sql` (depois de `crm-modelos-email.sql`;
pode rodar de novo). Só acrescenta colunas: nada muda nos envios. Se um dia rodar `crm-modelos-email.sql` de novo, rode
este depois (ele refaz a trava e a cópia de versões com os blocos).

**2. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Nenhuma variável nova.

**3. Site** — o merge do pull request publica a tela nova.

**4. Teste** (o critério de aceite):
   1. CRM → Modelos de e-mail → Guia Campus France · e-mail 1 → **Editar em versão nova**: abre a versão 2 (Rascunho), já em blocos.
   2. Texto → bloco Título: troque o texto. A prévia muda na hora e aparece "Guardado".
   3. Troque a pessoa da prévia duas vezes (uma com nível marcado, outra sem) e alterne Computador e Celular.
   4. **Enviar teste para mim**: chega no seu e-mail, com `[Teste]` no assunto e o link do checklist de verdade.
   5. **Mandar para revisão** e depois **Publicar (No ar)**. Em Versões, a 2 fica No ar e a 1 Arquivada.
   6. Peça o guia (`/guias/etudes-en-france-2027-2028/`) com um e-mail que ainda não pediu (no Gmail, `seunome+teste3@gmail.com`):
      o e-mail 1 chega com o título novo. Em `emails_enviados`, a linha dele tem `modelo_versao = 2`.
   7. Para voltar: Versões → v1 → **Voltar para esta**.

Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` (os blocos montam o e-mail 1 e o 2 com o mesmo texto de hoje, a rota
de teste e o rodapé) e, no banco, `cd admin/crm/db/testes && APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio`.

## 22. Ficha: e-mails fidedignos e o pop-up mostra o e-mail de verdade

O que muda no painel (`/admin/crm/`, sem passo seu):

- O status `agendado` passa a aparecer como **Enviado**: a linha só existe depois que o Brevo aceitou o envio. Entrega,
  abertura e clique só aparecem quando o webhook do Brevo (seção 16) avisar.
- Na aba **Ficha**, o primeiro painel da direita é **E-mails**: o último que saiu (data e hora), o **próximo sugerido** com a
  miniatura do e-mail como ela vai ver, a sequência automática do guia Campus France (e-mail 1 e e-mail 2: saiu, ou por que
  não saiu) e a lista de tudo que já saiu pelo CRM. Se nada saiu, diz isso; e-mails mandados direto do Gmail não entram.
- "O que respondeu no funil" virou **Quem é ela** (só o que importa e tem valor, com nome legível: a etapa do guia
  `cf-nao-comecei` aparece como "Etapa no Campus France: Ainda não começou") e **De onde veio** (origens e UTM).
- O pop-up **Escrever e-mail** abre na aba **Como ela vai ver**: De, Para, Assunto e o corpo do jeito que chega. Se o modelo
  tem desenho (versão feita no estúdio, seção 21), mostra o desenho com os dados dela; se não tem, mostra o formato simples
  em que o Worker manda hoje. Na aba **Editar texto** você muda o texto; aí o e-mail sai no formato simples e a prévia mostra isso.

**Muda no Worker (`/api/crm/enviar`):** aceita `html` (o desenho já preenchido pelo painel) junto com `modelo_versao`. Só
usa se for um documento HTML e não tiver `[colchetes]`; senão sai em texto simples, como antes. A resposta diz
`formato: 'html' | 'texto'`. Sem o Worker novo, o painel avisa "saiu em texto simples" em vez de deixar a prévia mentir.

Faça: **Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Nenhuma variável nova. Teste:
`node cms-oauth-worker/testes/crm-email.test.mjs`.

### 22b. O template do Por Dentro nos e-mails manuais e no "ver o e-mail" (16/10)

- Os 8 modelos manuais saem com o **template do Por Dentro** (logo, papel claro, botão verde), igual aos e-mails do guia.
  Enquanto a versão No ar não tiver HTML guardado, o painel monta o template a partir dos blocos dela ou, na versão 1,
  dos blocos de partida do estúdio (o mesmo texto da versão 1) e manda junto com o texto puro.
- **Ver o e-mail** (aba Conversa e lista da ficha) abre o e-mail como chegou: os automáticos e os manuais gravados com
  `formato = 'html'` aparecem no template, refeitos com a versão e os dados dela; os que saíram em texto simples aparecem assim.
- O Worker grava `emails_enviados.formato` (`html` ou `texto`). Se a coluna ainda não existir, grava sem ela.

Faça, nesta ordem: **1.** Supabase → SQL Editor, rode `admin/crm/db/crm-emails-formato.sql`. **2.** Cole o `worker.js` novo (seção 9).
Sem o passo 2 os e-mails continuam saindo em texto simples (o painel avisa a cada envio).

## 23. Estúdio de e-mails 3: modelo novo pelo objetivo e sequências

O que faz: em CRM → Modelos de e-mail, o botão **+ Modelo novo** abre os 4 passos da proposta: **Objetivo** (o catálogo: entrega
de freebie, boas-vindas e acesso, conversa, aquecimento, reimpacto, convite para conversa, lembrete de prazo, lançamento e oferta,
compra confirmada), **Para quem** (persona, material de origem, produto, estágio, segmento), **Contexto da pessoa** (os dados que o
e-mail pode usar) e **Esqueleto** (os blocos sugeridos). O objetivo decide o tipo (serviço, novidades ou compra), e com ele quem pode
receber e o rodapé. Criar grava o modelo e a versão 1 em rascunho; daí em diante é o caminho da seção 21 (editar, teste para você,
revisão, publicar). Os `[trechos entre colchetes]` do esqueleto são para você escrever: um modelo que sai sozinho não publica com eles.

**A parte Envio** (em "Objetivo e envio" do modelo novo): *Como sai* = você envia pela ficha, ou sai sozinho (sequência). Na sequência:
depois de quê (um e-mail, pegar um material ou a compra do produto), quantos dias e em que hora de Brasília. **Ligar o envio** só acende
com uma versão No ar. Quem já tinha passado do horário antes de ligar não recebe (não sai um e-mail velho para a base toda). Cada modelo
de sequência sai uma vez só por pessoa. Mudar o Envio ou o Para quem com ele ligado recomeça a contagem a partir daquele momento.

**Registrar compra** (ficha → Ficha → painel E-mails): grava o evento "compra" daquele produto. É o que liga as sequências de compra
(ex.: Hub de Estudos). Por enquanto a compra pelo site não chega sozinha ao CRM: você registra aqui.

Quem recebe, conferido a cada envio: só modelos criados no estúdio, versão No ar, Envio ligado, as regras de Para quem e, no tipo
novidades, só quem aceitou novidades (o aceite mais recente: quem pediu para sair para na rodada seguinte). O banco
(`crm_sequencia_pendentes`) filtra e o Worker confere o aceite de novo. Compra e serviço não pedem novidades e não levam "responda sair".
Os 10 modelos de antes (os 8 manuais e os e-mails 1 e 2 do guia) não ganham Envio: continuam saindo como hoje. Os e-mails de sequência
não contam no Reimpactar.

**O X de cada modelo** (canto superior direito do card): exclui o modelo. Ele sai da lista e do "Escrever e-mail" e a sequência dele
para; as versões ficam guardadas em **Excluídos**, no fim da lista, com o botão **Restaurar** (volta com o Envio desligado). Os e-mails 1
e 2 do guia Campus France não têm o X: saem pelo código, e excluir aqui não pararia o envio.

Os modelos novos sem Envio aparecem no "Escrever e-mail" da ficha depois de publicados (o Worker aceita, com o consentimento e o
rodapé do tipo). Os de sequência não saem pela ficha.

Faça nesta ordem:

**1. Banco** — Supabase → SQL Editor, rode `admin/crm/db/crm-estudio-emails-3.sql` (depois de `crm-estudio-emails-2.sql` e de
`crm-emails-formato.sql`; pode rodar de novo). Antes do Worker novo, nada sai sozinho.

**2. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Rota nova: `/api/crm/sequencia-rodar` (teste). Para o e-mail de
compra do Hub de Estudos, confira que a variável `HUB_ESTUDOS_NOTION_LINK` existe (é a mesma da página de obrigado da compra): sem
ela, o e-mail de compra não sai (o Worker recusa e anota nos Logs). Opcional: `CRM_SEQUENCIA_LOTE` (Text), quantos e-mails por hora,
padrão 12 (no plano gratuito deixe 12: cada execução tem 50 chamadas).

**3. Site** — o merge do pull request publica a tela nova.

**4. Cron Trigger** — Workers → `por-dentro-cms-oauth` → Settings → Trigger Events → **Add** → Cron Triggers → `5 * * * *` → Add.
**Não apague** o `0 13 * * *` (é o e-mail 2). Com os dois, o e-mail 2 continua às 10h e as sequências rodam cinco minutos depois de
cada hora (uma sequência marcada para 10h sai por volta das 10h05 de Brasília).

**5. Teste** (o critério de aceite, com o seu Gmail ou um `seunome+teste@gmail.com` que tenha ficha no CRM):
   1. Modelos de e-mail → **+ Modelo novo** → Compra confirmada → nome "Hub de Estudos · compra" → produto Hub de Estudos →
      Continuar até **Criar o modelo**. Escreva os primeiros passos no bloco Destaque, **Enviar teste para mim** (chega com o link do Hub),
      **Mandar para revisão** e **Publicar**. Em Objetivo e envio: depois da compra, 0 dias, a hora seguinte à de agora → **Ligar o envio**.
   2. **+ Modelo novo** → Compra confirmada → "Hub de Estudos · D+3" → mesmo produto → criar, escrever, testar, publicar. Em Objetivo e
      envio: Depois de um e-mail → "Hub de Estudos · compra", 3 dias, 10h → **Ligar o envio**.
   3. Na ficha da pessoa de teste: Ficha → E-mails → Registrar compra → Hub de Estudos. Na prévia do modelo, ela aparece como "Pronto";
      outra pessoa sem a compra aparece com o aviso "não sai para essa pessoa".
   4. Para não esperar a hora: no SQL Editor,
      ```sql
      select * from crm_sequencia_pendentes(12);   -- a pessoa de teste aparece aqui depois da hora marcada
      select net.http_post(
        url := 'https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev/api/crm/sequencia-rodar',
        headers := jsonb_build_object('X-Crm-Hook', (select decrypted_secret from vault.decrypted_secrets where name = 'crm_hook_secret')));
      ```
      Depois de alguns segundos: `select status_code, content from net._http_response order by created desc limit 1;` → `200` com
      `{"enviados":1,...}`. O e-mail chega; na ficha, aparece em "Já enviados". Rodar de novo não manda outro.
   5. O D+3 sai três dias depois do primeiro, às 10h05. Para testar antes, troque a data do primeiro (troque o e-mail):
      `update emails_enviados set enviado_em = now() - interval '3 days' where modelo = '<chave do 1º>' and contato_id = (select id from contatos where email = 'SEU_EMAIL');`
      e rode o passo 4 de novo. Quem não tem a compra registrada não recebe nenhum dos dois.

**Para parar uma sequência**: no modelo, **Desligar**. Para parar todas: apague o Cron Trigger `5 * * * *` (o e-mail 2 continua).
Se um e-mail não sair: Workers → Logs, procure `crm/sequencias` (`{"erro":"lista"}` = o SQL do passo 1 não rodou; "falta o link_produto"
= falta `HUB_ESTUDOS_NOTION_LINK`; "não está No ar" = publique a versão).

Testes: `node cms-oauth-worker/testes/crm-email.test.mjs` e, no banco,
`cd admin/crm/db/testes && APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio3`.

## 24. Guia Painel do Certificado: o e-mail do painel sai sozinho

O que faz: quem se cadastra em `/guias/painel-do-certificado/` recebe na hora o e-mail **cert_guia_1** ("Seu painel do
certificado está aqui"): o link do Notion (para duplicar), por onde começar e um trecho **"Para a sua prova"** que muda
conforme o certificado marcado no formulário (DELF/DALF, TCF, Exame Cívico, TOEIC/CAE/CPE, outro ou "ainda não sei").
Funciona igual ao e-mail 1 do Campus France (seção 17): o banco chama `POST /api/crm/guia-capturado` pelo pg_net e o Worker
envia pelo Brevo. É **serviço**: sai para todo mundo que pediu o painel, sem exigir novidades e sem rodapé de descadastro.
O link do Notion nunca fica no código nem no GitHub: o Worker lê de `guias_links` na hora do envio.

Pré-requisito: a seção 17 pronta (pg_net ligado, `crm_hook_secret` e `crm_worker_url` no Vault, `CRM_HOOK_SECRET` no Worker).
Se o e-mail do Campus France já sai, os segredos já existem e não precisa criar nada de novo.

Faça nesta ordem:

**1. Link do painel** — Supabase → Table Editor → `guias_links` → Insert row: `slug` = `painel-do-certificado`,
`notion_url` = o link público do painel no Notion, `notion_texto` = `Abrir o painel no Notion`. Sem essa linha o cadastro
funciona, mas nenhum link aparece e o e-mail não sai.

**2. Banco** — SQL Editor, rode **nesta ordem** (cada um pode ser rodado de novo sem estragar nada):
   1. `admin/crm/db/crm-cert-guia-email.sql` (passa a pedir o e-mail do painel e garante um por pessoa)
   2. `admin/crm/db/crm-cert-guia-modelo.sql` (cria o modelo no Estúdio de e-mails, versão 1 No ar)

**3. Código do Worker** — seção 9 (colar o `worker.js` novo e Deploy). Nada de variável nova.

**4. Teste com o seu e-mail** (aba anônima, com o seu Gmail; para variar a prova, repita com `seunome+delf@gmail.com`,
`seunome+civico@gmail.com` etc., que o Gmail entrega na mesma caixa):
   1. Abra `imigrantepordentro.com/guias/painel-do-certificado/`, escolha uma prova e se cadastre.
   2. Em até 1 minuto chega "Seu painel do certificado está aqui", com o trecho "Para a sua prova" da prova escolhida.
   3. Clique em "Abrir o painel no Notion": o painel abre e o botão "Duplicate" aparece no canto superior direito.
   4. Responda o e-mail: a resposta aparece em CRM → Caixa de entrada.
   5. Para testar de novo com o mesmo e-mail, apague a linha `cert_guia_1` dele em Table Editor → `emails_enviados`.
   Também dá para ver o e-mail sem se cadastrar: CRM → Estúdio de e-mails → Guia Painel do Certificado · e-mail 1 →
   escolha uma pessoa na prévia → "Enviar teste para mim".

Se não chegar: SQL Editor → `select status_code, content from net._http_response order by created desc limit 5;`
(401 = segredo diferente entre Vault e Worker; 500 = falta a linha em `guias_links` ou variável no Worker; 400 = o Worker
antigo ainda está no ar: faça o passo 3) e os **Logs** do Worker.

**Para desligar só este e-mail**: Table Editor → `guias_links` → apague a linha `painel-do-certificado` (o Worker passa
a recusar e o cadastro continua funcionando; o link some da página também). Para desligar todos os e-mails de guia:
Vault → apague `crm_worker_url`.

Texto: mora em `certGuia1()` no `worker.js` (reserva) e na versão No ar de `cert_guia_1` no Estúdio de e-mails, que tem
prioridade; o teste confere que os dois saem iguais. Trocou o texto pelo Estúdio, vale no próximo envio. O e-mail do
painel não entra nos reimpactos do CRM nem no e-mail 2 do Campus France.
Testes: `node cms-oauth-worker/testes/cert-guia-email.test.mjs` (sem dependências, sem rede) e
`cd admin/crm/db/testes && npm install && npm run test:cert` (banco de teste PGlite, não precisa do banco do app).
