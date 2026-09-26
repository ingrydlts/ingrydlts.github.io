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
