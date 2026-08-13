# Por Dentro — site

Site estático (HTML/CSS/JS puro, sem framework, sem build step) para a vitrine de vendas do Por Dentro. Implementado a partir de `por-dentro-vitrine-especificacao.md` e do mockup `Por Dentro - Vitrine.dc.html`.

## Estrutura

```
/index.html                          Home
/produtos-digitais/                  Grade de templates próprios
/produtos-digitais/produto/          Template genérico de página de produto (?slug=...)
/produtos-de-estudo/                 Indicações afiliadas (livros, papelaria)
/produtos-de-compras/                Indicações afiliadas (roupas, acessórios)
/sobre/                              Página institucional
/artigos/                            Índice do blog (busca + filtro por categoria)
/artigos/post/                       Template genérico de artigo (?slug=...)
/mentions-legales/  /cgv/  /confidentialite/    Páginas legais (rascunho)
/content/*.json                      Todo o conteúdo editável (produtos, posts, banners)
/admin/                              Painel Decap CMS — edita os arquivos acima sem git/código
/assets/css/style.css                Estilos (tokens de marca, mobile-first)
/assets/js/                          render.js, purchase.js, markdown.js, main.js
```

Todo texto/preço/imagem de produto, banner e post vive em `/content/*.json` — é isso que o `/admin` edita. Alterar esses arquivos (à mão ou pelo painel) já atualiza o site, sem tocar em HTML.

## Rodar localmente

Como o site usa `fetch()` para carregar `/content/*.json`, abrir os arquivos direto no navegador (`file://`) não funciona — precisa de um servidor local simples:

```bash
cd "WEBSITE POR DENTRO"
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Publicar (GitHub Pages + Cloudflare)

1. Suba esta pasta como repositório no GitHub.
2. Nas configurações do repositório → **Pages**, escolha "Deploy from branch", branch `main`, pasta `/ (root)`.
3. No Cloudflare, aponte seu domínio (CNAME) para `SEU-USUARIO.github.io`, e ative "Proxy" se quiser o CDN/cache do Cloudflare na frente.
4. Ative o **Cloudflare Web Analytics** (sem cookies — por isso o site não tem banner de consentimento).

O site assume que vai rodar na raiz do domínio (links tipo `/produtos-digitais/`). Se em algum momento ele for publicado em `usuario.github.io/nome-do-repo/` (sem domínio próprio), esses links quebram — nesse caso me avise que ajusto para caminhos relativos.

## Configurar o Stripe (pagamento)

1. Crie uma conta Stripe (ou use a existente) e ative pagamentos.
2. Para cada produto digital, crie um **Payment Link** no painel do Stripe (Products → seu produto → Create payment link). Ative o **Link** (checkout expresso) nas configurações de pagamento da sua conta — isso já faz o selo "link" mostrado no site corresponder ao que o cliente vê de verdade no checkout.
3. Cole a URL do Payment Link no campo `stripeLink` do produto correspondente — pelo `/admin` (mais fácil) ou direto em `content/produtos-digitais.json`.
4. Enquanto o campo estiver vazio, o botão de compra mostra um aviso em vez de navegar pra um link quebrado — não vai vazar um link falso pros seus clientes.

**O que não está implementado:** o carrinho com múltiplos produtos que existia no mockup. Um Payment Link do Stripe é fixo por produto — pra um carrinho de verdade com Stripe (vários itens, uma cobrança só) é preciso montar a sessão de checkout dinamicamente, o que exige um backend leve (o Cloudflare Worker que a especificação já previa pra o webhook de entrega, seção 5.2). Por ora, cada produto tem sua própria página de venda com seu próprio botão — funciona hoje, sem servidor. Se quiser o carrinho funcionando de verdade depois, é a próxima peça a construir.

## Configurar o /admin (Decap CMS)

O `/admin` é um painel visual (Decap CMS) pra editar produtos, banners e posts sem mexer em código — mas como o site não usa Netlify, a autenticação com o GitHub precisa de um pequeno proxy OAuth. O código desse proxy já está pronto em [`cms-oauth-worker/worker.js`](cms-oauth-worker/worker.js), e `admin/config.yml` já aponta pro repositório real (`ingrydlts/ingrydlts.github.io`). Falta publicar o worker — passo a passo completo em [`cms-oauth-worker/README.md`](cms-oauth-worker/README.md):

1. Publicar o Worker no Cloudflare (painel, sem precisar instalar nada).
2. Criar o GitHub OAuth App e apontar o callback pra URL do worker.
3. Colar a URL final do worker no campo `base_url` de `admin/config.yml`.
4. Acessar `seudominio.com/admin`, fazer login com a conta GitHub, e pronto — editar produto/banner/post vira só preencher formulário e clicar em "Publish" (isso cria um commit no repositório automaticamente).

Sem esse passo, o `/admin` carrega mas não consegue salvar — os arquivos `/content/*.json` continuam editáveis manualmente enquanto isso não for configurado.

## Pendências herdadas da especificação

- **Fotos reais**: todo produto/banner/post sem imagem mostra um bloco de placeholder — suba fotos reais pelo `/admin` (ou preencha o campo `image` nos JSON) quando tiver.
- **SIRET, e-mail de contato, domínio**: campos entre `[colchetes]` em `/mentions-legales/`, `/cgv/` e `/confidentialite/` — preencha antes de publicar. Esse texto é rascunho, não é aconselhamento jurídico (confirme com um expert-comptable/avocat).
- **Entrega automática por e-mail**: o fluxo Stripe → Cloudflare Worker → Brevo (seção 5.2 da especificação) ainda não existe — hoje, sem isso configurado, não há entrega automática do arquivo após o pagamento.
- **Fonte Gliker**: pendência de licença já registrada na especificação (seção 5.1) — o site usa Fraunces como já decidido enquanto isso não é resolvido.
- **URLs do blog**: os artigos usam `/artigos/post/?slug=nome-do-artigo` (uma página só, que troca de conteúdo por parâmetro) em vez de uma pasta por artigo — assim, criar um post novo é só adicionar uma entrada em `/content/posts.json` (ou pelo `/admin`), sem precisar de HTML novo. A URL fica menos "bonita" que `/artigos/nome-do-artigo/`; se isso importar pra você, dá pra trocar depois.
- **Conteúdo de exemplo**: os textos de produtos/posts/sobre são conteúdo de partida (baseado no que você já tinha escrito na pesquisa de pricing) — revise antes de publicar, principalmente `/sobre/` que está com placeholders `[a preencher]`.
