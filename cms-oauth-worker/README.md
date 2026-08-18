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
Cloudflare. Toda vez que `worker.js` mudar (como aconteceu pro paywall dos artigos premium), repita:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → clique no worker
   `por-dentro-cms-oauth`.
2. **Edit code** → apague tudo → cole o conteúdo atual de [`worker.js`](./worker.js) (pegue direto do
   GitHub, já atualizado) → **Deploy**.

## 10. Configurar o paywall dos artigos premium (assinatura + compra avulsa)

Depois de atualizar o código (passo 9 acima), faltam três coisas: os dois produtos no Stripe, as
variáveis novas no Worker, e a KV que guarda o texto pago.

**No Stripe** ([dashboard.stripe.com](https://dashboard.stripe.com)):

1. **Products** → **Add product** → crie um com preço **recorrente** (ex. 4,99€/mês). Depois de
   criado, na página do produto → **Create payment link** → modo assinatura (é automático, já que o
   preço é recorrente).
2. Repita pra um segundo produto com preço **único** (ex. 10€) → **Create payment link** → modo
   pagamento único.
3. Em **cada um dos dois Payment Links** → edite → **After payment** → escolha "Redirecionar para uma
   URL personalizada" e cole exatamente:
   `https://SEUDOMINIO/artigos/assinatura-confirmada/?session_id={CHECKOUT_SESSION_ID}`
   (troque `SEUDOMINIO` pelo domínio real, ex. `ingrydlts.github.io` enquanto não houver domínio
   próprio). É a mesma URL nos dois links — o site descobre sozinho qual artigo foi pago.
4. **Settings → Billing → Customer portal** → ative. Copie o link do portal (é fixo, sempre o mesmo).
5. Anote os dois **Payment Links** (URLs que começam com `buy.stripe.com/...`), os dois **Price IDs**
   (em cada produto, ao lado do preço — começam com `price_...`) e a sua **Secret key** (em
   **Developers → API keys** → "Secret key", começa com `sk_live_...` ou `sk_test_...` se estiver
   testando).

**No Worker** (mesma tela do passo 6 acima):

6. **Settings → Variables and Secrets** → adicione, todas como **Secret**:
   - `STRIPE_SECRET_KEY` = a secret key do passo 5.
   - `STRIPE_PRICE_ID` = o Price ID do produto de assinatura.
   - `STRIPE_ARTICLE_PRICE_ID` = o Price ID do produto de compra avulsa.
   - `ACCESS_TOKEN_SECRET` = qualquer string aleatória longa (ex. gerada em
     [1password.com/password-generator](https://1password.com/password-generator) ou similar) — só
     precisa ser difícil de adivinhar, você não vai precisar lembrar dela.
   - `ADMIN_EMAILS` (opcional) = um e-mail seu (ou vários, separados por vírgula) que sempre recebe
     acesso total aos artigos premium pelo formulário "recuperar acesso" do site, sem precisar de
     assinatura real no Stripe — útil pra você mesma revisar como o conteúdo pago fica pra quem paga.
     **Trate esse e-mail como senha**: use um endereço que não apareça em nenhum lugar público do
     site (ex. um alias tipo `seuemail+admin7x9k@gmail.com`, se o seu provedor suportar) — se esse
     e-mail vazar ou for adivinhado, quem descobrir ele destrava todo o conteúdo pago de graça.
7. **Settings → Bindings → Add binding** → tipo **KV Namespace** → crie uma nova (nome sugerido
   `por-dentro-premium`) → **Variable name**: `PREMIUM_KV` (tem que ser exatamente esse nome).

**No `/admin`** (o painel do site):

8. Acesse `seudominio.com/admin` → coleção **"Assinatura de artigos premium"** → cole os dois Payment
   Links do passo 5 (assinatura e compra avulsa) e o link do Customer Portal do passo 4 → Publish.

**Teste**: marque um artigo como "premium" (se ainda não tiver nenhum), publique, e abra a página dele
— os dois botões de pagamento devem aparecer. Um pagamento de teste real com [cartão de teste do
Stripe](https://docs.stripe.com/testing#cards) (`4242 4242 4242 4242`, qualquer data futura e CVC)
confirma o fluxo inteiro, do clique até o artigo desbloqueado.

---

Alternativa via linha de comando (`wrangler`), se preferir a esse passo a passo pelo painel:

```bash
npm install -g wrangler
cd cms-oauth-worker
wrangler login
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler deploy
```
