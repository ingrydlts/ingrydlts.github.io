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
