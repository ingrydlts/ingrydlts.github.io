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

## Artigos premium (assinatura ou compra avulsa via Stripe)

Qualquer artigo do blog pode ser marcado como "premium" no `/admin` — o texto que fica no campo
"Corpo do artigo" vira a prévia grátis, e a continuação paga é escrita à parte, em
`seudominio.com/admin/premium/` (login com a mesma conta GitHub do `/admin`). O texto pago **nunca é
salvo no repositório** — fica só numa KV do Cloudflare Worker, e só é entregue a quem prova ter acesso.
Isso é proposital: `content/posts.json` é um arquivo público, então qualquer coisa salva ali (mesmo que
a interface esconda) pode ser lida por qualquer pessoa.

A leitora vê **duas formas de desbloquear** um artigo premium: assinar (acesso a todos os artigos
premium, cobrança recorrente) ou comprar só aquele artigo avulso (pagamento único, acesso permanente
só àquele artigo). As duas usam o mesmo mecanismo por baixo — só muda o Payment Link e o que o token
resultante cobre.

Passo a passo de configuração:

1. **No Stripe**, crie dois produtos e um Payment Link pra cada:
   - Um preço **recorrente** (ex. 4,99€/mês) → Payment Link em **modo assinatura**.
   - Um preço **único** (ex. 10€) → Payment Link em **modo pagamento único** (não assinatura).

   Nas configurações "After payment" **dos dois links**, use a mesma URL de confirmação genérica:
   `https://seudominio.com/artigos/assinatura-confirmada/?session_id={CHECKOUT_SESSION_ID}`. Essa
   página do site troca o `session_id` pelo token de acesso e já redireciona a leitora de volta pro
   artigo certo sozinha — não precisa (e não dá pra) configurar uma URL diferente por artigo, porque
   o mesmo link é reaproveitado pra todos os artigos premium.

   Habilite também o **Customer Portal** (Settings → Billing → Customer portal) — é o link de
   cancelamento self-service que a lei francesa exige pra assinaturas (résiliation en trois clics,
   decreto nº 2023-663).
2. **No Worker** ([`cms-oauth-worker/`](cms-oauth-worker/)), adicione em Settings → Variables and Secrets:
   `STRIPE_SECRET_KEY` (chave secreta do Stripe), `STRIPE_PRICE_ID` (Price ID da assinatura),
   `STRIPE_ARTICLE_PRICE_ID` (Price ID da compra avulsa — os dois evitam liberar acesso pra outro
   produto Stripe que porventura exista na mesma conta) e `ACCESS_TOKEN_SECRET` (uma string aleatória
   qualquer, usada pra assinar os tokens de acesso). Em Settings → Bindings, crie uma KV namespace vazia
   e associe como `PREMIUM_KV`.
3. **No `/admin`**: cole os dois Payment Links e o link do Customer Portal em "Assinatura de artigos
   premium" (`content/premium-config.json`), e ajuste os textos/preços mostrados no bloco de
   pagamento se quiser.
4. Marque o artigo desejado como premium, escreva a prévia grátis normalmente, publique, e depois
   escreva a continuação paga em `/admin/premium/`.

**Limitação atual**: isso só funciona pra artigos que usam o template dinâmico (`/artigos/post/?slug=`) —
os 6 artigos que já têm página própria (`/artigos/post/nome-do-artigo/`, HTML gerado à mão) não ganham
suporte a premium automaticamente. Se quiser tornar um desses premium, é um ajuste manual pontual naquela
página específica.

**Sem webhook do Stripe nesta versão**: o acesso é revalidado só quando alguém paga ou usa "já assino
ou já comprei" — o token de assinatura expira sozinho em 14 dias, forçando revalidação. Isso significa
que, se uma pessoa cancelar a assinatura ou tiver o pagamento recusado, o acesso pode continuar
funcionando por até 14 dias até expirar — uma troca deliberada por simplicidade, mas fica registrado
aqui pra não ser surpresa depois. Já o token de **compra avulsa** não expira de propósito — é um
pagamento único, sem cobrança recorrente pra reconferir, então o acesso àquele artigo é permanente.

## Assistente de Parcerias (`/admin/parcerias/`)

Ferramenta privada — não linkada em nenhuma navegação pública, feita pra você mesma usar ao
receber uma proposta de parceria/publi. Cruza os dados da proposta com sua bússola de marca
(pilares editoriais, tom de voz, limites inegociáveis do Por Dentro) e com uma tabela de valores
que você preenche uma vez, e devolve: um veredito (aceitar / negociar / recusar), os motivos,
o valor sugerido comparado ao ofertado, e um texto pronto pra responder em cada um dos três tons.

Roda 100% no navegador — sem backend, sem IA, sem envio de dados a servidor nenhum. Tabela de
valores e histórico de propostas avaliadas ficam salvos só em `localStorage`, só nesse aparelho;
trocar de navegador ou limpar dados do site apaga o que foi salvo.

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

## Regra de todo artigo: interação + dado de audiência

Todo artigo do blog precisa dar pra leitora pelo menos um jeito de clicar em algo — e esse clique precisa
virar dado, não só ficar bonito. O mínimo obrigatório, em qualquer artigo novo:

- **`[[FAQ]]`** no fim — sempre em dropdown (acordeão), nunca perguntas soltas no meio do texto.
- **`[[FEEDBACK]]`** no fim — o "esse artigo te ajudou? 👍/👎".

Use também `[[CHECKLIST]]` quando o tema tiver um critério de elegibilidade ou passo a passo verificável, e
`[[RESOURCES]]` pra toda fonte oficial citada (cada link já sai rastreado, abrindo em nova aba). Todo clique
nesses blocos vira 1 evento no bot (`window.PDEvents`) e aparece agregado em `/admin/dashboard` — perguntas
mais abertas no FAQ, fontes mais clicadas, checklists completadas, feedback por artigo. O campo "Corpo do
artigo" no `/admin` já mostra essa lista de blocos no hint, com FAQ e Feedback marcados como obrigatórios.

Detalhe técnico completo (como cada bloco vira evento, e o que ainda falta nos artigos com HTML próprio) em
[`GUIA-DE-IMPLEMENTACAO.md`](GUIA-DE-IMPLEMENTACAO.md#regra--interação-e-instrumentação-de-audiência-em-artigos-).

## Pendências herdadas da especificação

- **Fotos reais**: todo produto/banner/post sem imagem mostra um bloco de placeholder — suba fotos reais pelo `/admin` (ou preencha o campo `image` nos JSON) quando tiver.
- **SIRET, e-mail de contato, domínio**: campos entre `[colchetes]` em `/mentions-legales/`, `/cgv/` e `/confidentialite/` — preencha antes de publicar. Esse texto é rascunho, não é aconselhamento jurídico (confirme com um expert-comptable/avocat).
- **Entrega automática por e-mail**: o fluxo Stripe → Cloudflare Worker → Brevo (seção 5.2 da especificação) ainda não existe — hoje, sem isso configurado, não há entrega automática do arquivo após o pagamento.
- **Fonte Gliker**: pendência de licença já registrada na especificação (seção 5.1) — o site usa Fraunces como já decidido enquanto isso não é resolvido.
- **URLs do blog**: os artigos usam `/artigos/post/?slug=nome-do-artigo` (uma página só, que troca de conteúdo por parâmetro) em vez de uma pasta por artigo — assim, criar um post novo é só adicionar uma entrada em `/content/posts.json` (ou pelo `/admin`), sem precisar de HTML novo. A URL fica menos "bonita" que `/artigos/nome-do-artigo/`; se isso importar pra você, dá pra trocar depois.
- **Conteúdo de exemplo**: os textos de produtos/posts/sobre são conteúdo de partida (baseado no que você já tinha escrito na pesquisa de pricing) — revise antes de publicar, principalmente `/sobre/` que está com placeholders `[a preencher]`.
