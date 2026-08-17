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

## Artigos premium (assinatura via Stripe)

Qualquer artigo do blog pode ser marcado como "premium" no `/admin` — o texto que fica no campo
"Corpo do artigo" vira a prévia grátis, e a continuação paga é escrita à parte, em
`seudominio.com/admin/premium/` (login com a mesma conta GitHub do `/admin`). O texto pago **nunca é
salvo no repositório** — fica só numa KV do Cloudflare Worker, e só é entregue a quem prova ter
assinatura ativa. Isso é proposital: `content/posts.json` é um arquivo público, então qualquer coisa
salva ali (mesmo que a interface esconda) pode ser lida por qualquer pessoa.

Passo a passo de configuração:

1. **No Stripe**: crie um produto com preço recorrente (ex. 4,99€/mês) e um **Payment Link** em modo
   assinatura pra esse preço. Nas configurações "After payment" do Payment Link, use uma URL de
   confirmação customizada apontando de volta pro artigo, incluindo `{CHECKOUT_SESSION_ID}` na query —
   ex. `https://seudominio.com/artigos/post/?slug=nome-do-artigo&session_id={CHECKOUT_SESSION_ID}`.
   Habilite também o **Customer Portal** (Settings → Billing → Customer portal) — é o link de
   cancelamento self-service que a lei francesa exige (résiliation en trois clics, decreto nº 2023-663).
2. **No Worker** ([`cms-oauth-worker/`](cms-oauth-worker/)), adicione em Settings → Variables and Secrets:
   `STRIPE_SECRET_KEY` (chave secreta do Stripe), `STRIPE_PRICE_ID` (o Price ID da assinatura — evita
   liberar acesso pra assinatura de outro produto Stripe) e `ACCESS_TOKEN_SECRET` (uma string aleatória
   qualquer, usada pra assinar os tokens de acesso). Em Settings → Bindings, crie uma KV namespace vazia
   e associe como `PREMIUM_KV`.
3. **No `/admin`**: cole o Payment Link e o link do Customer Portal em "Assinatura de artigos premium"
   (`content/premium-config.json`), e ajuste o texto do bloco de assinatura se quiser.
4. Marque o artigo desejado como premium, escreva a prévia grátis normalmente, publique, e depois
   escreva a continuação paga em `/admin/premium/`.

**Limitação atual**: isso só funciona pra artigos que usam o template dinâmico (`/artigos/post/?slug=`) —
os 6 artigos que já têm página própria (`/artigos/post/nome-do-artigo/`, HTML gerado à mão) não ganham
suporte a premium automaticamente. Se quiser tornar um desses premium, é um ajuste manual pontual naquela
página específica.

**Sem webhook do Stripe nesta versão**: o acesso é revalidado só quando alguém paga ou usa "já é
assinante" — o token de acesso expira sozinho em 14 dias, forçando revalidação. Isso significa que, se
uma pessoa cancelar ou tiver o pagamento recusado, o acesso pode continuar funcionando por até 14 dias
até expirar — uma troca deliberada por simplicidade, mas fica registrado aqui pra não ser surpresa depois.

## Configurar o /admin (Decap CMS)

O `/admin` é um painel visual (Decap CMS) pra editar produtos, banners e posts sem mexer em código, com login via GitHub (proxy OAuth em [`cms-oauth-worker/`](cms-oauth-worker/)) — **já publicado e funcionando** em `ingrydlts.github.io/admin`. Editar um produto/banner/post e clicar em "Publish" cria um commit direto no repositório.

**Tamanho ideal de cada foto** (evita imagem cortada ou esticada — o painel também mostra essa dica no campo, na hora do upload):

| Onde | Campo | Tamanho ideal | Proporção |
|---|---|---|---|
| Produto digital (card + página do produto) | Imagem | 1200×900px | 4:3, horizontal |
| Produto de estudo / compras (card) | Imagem | 1200×900px | 4:3, horizontal |
| Artigo do blog (capa) | Foto de capa | 1600×900px | 16:9, bem panorâmica — aparece cortada de dois jeitos (card e topo do artigo) |
| Home | Foto do hero | 1200×960px | 5:4, horizontal |
| Banners vitrine → blog (3 categorias) | Foto | 1200×675px | 16:9, horizontal |
| Banner lateral do blog | Foto | 1200×900px | 4:3, horizontal |
| Galeria da página de produto (cada foto) | Foto/Vídeo | 1200×1200px | 1:1, quadrada — é o carrossel estilo Amazon, cada slide aparece no mesmo enquadramento |

**Depois de publicar, a mudança pode demorar até uns minutos pra aparecer no site** — o GitHub Pages usa um CDN (Fastly) que guarda o conteúdo em cache por até 10 minutos. Se editar e não ver a mudança na hora, não é erro: espera um pouco e dá um refresh forçado (Cmd+Shift+R) antes de desconfiar que algo quebrou.

**Cuidado ao editar listas** (produtos, artigos, itens de afiliado): o painel edita a lista inteira de uma vez — é fácil apagar um item sem querer ao invés de só editar o que você queria. Depois de publicar, vale conferir se os outros itens da lista continuam lá.

## Avaliações de produto (estrelas + comentário)

Cada página de produto digital mostra nota média, distribuição por estrela e um formulário pra
qualquer visitante escrever uma avaliação. As avaliações **não aparecem sozinhas** — toda avaliação
nova entra como pendente e só fica pública depois que você aprovar em `seudominio.com/admin/avaliacoes/`
(login com a mesma conta GitHub do `/admin`).

Isso depende do Worker em [`cms-oauth-worker/`](cms-oauth-worker/) ter uma **KV namespace** configurada
— sem isso as rotas `/api/reviews/*` não funcionam, mas o resto do site continua normal (a seção mostra
"ainda sem avaliações" em vez de quebrar). Passo a passo de configuração no
[`README.md` do worker](cms-oauth-worker/README.md#6-criar-a-kv-das-avaliações) — inclusive de como
receber um **e-mail automático** (via Resend) toda vez que chegar avaliação nova pra aprovar
([passo 8](cms-oauth-worker/README.md#8-receber-e-mail-quando-chegar-avaliação-pendente-opcional)).

## Combo entre produtos digitais (cross-sell)

Cada produto pode listar os slugs de outros produtos com quem forma um "combo" (campo `bundleWith`
no `/admin`). Quando há pelo menos 2 produtos no combo, a página calcula o desconto sozinha — **10%
com 2 produtos, 15% com 3, 20% com 4 ou mais**, nunca passando de 50% de desconto sobre a soma dos
preços (piso de margem). Sem produtos vinculados, a seção mostra um aviso reservando o espaço em vez
de ficar em branco.

**O preço de combo mostrado hoje é só referência** — cada produto ainda tem seu próprio Payment Link
do Stripe, não existe checkout único pra cobrar o combo de uma vez (isso é o carrinho com múltiplos
produtos já listado na Fase 11 do `GUIA-DE-IMPLEMENTACAO.md`). Enquanto isso não existir, quem quiser
o combo compra os produtos separadamente pelos links individuais.

## Pendências herdadas da especificação

- **Fotos reais**: todo produto/banner/post sem imagem mostra um bloco de placeholder — suba fotos reais pelo `/admin` (ou preencha o campo `image` nos JSON) quando tiver.
- **SIRET, e-mail de contato, domínio**: campos entre `[colchetes]` em `/mentions-legales/`, `/cgv/` e `/confidentialite/` — preencha antes de publicar. Esse texto é rascunho, não é aconselhamento jurídico (confirme com um expert-comptable/avocat).
- **Entrega automática por e-mail**: o fluxo Stripe → Cloudflare Worker → Brevo (seção 5.2 da especificação) ainda não existe — hoje, sem isso configurado, não há entrega automática do arquivo após o pagamento.
- **Fonte Gliker**: pendência de licença já registrada na especificação (seção 5.1) — o site usa Fraunces como já decidido enquanto isso não é resolvido.
- **URLs do blog**: os artigos usam `/artigos/post/?slug=nome-do-artigo` (uma página só, que troca de conteúdo por parâmetro) em vez de uma pasta por artigo — assim, criar um post novo é só adicionar uma entrada em `/content/posts.json` (ou pelo `/admin`), sem precisar de HTML novo. A URL fica menos "bonita" que `/artigos/nome-do-artigo/`; se isso importar pra você, dá pra trocar depois.
- **Conteúdo de exemplo**: os textos de produtos/posts/sobre são conteúdo de partida (baseado no que você já tinha escrito na pesquisa de pricing) — revise antes de publicar, principalmente `/sobre/` que está com placeholders `[a preencher]`.
