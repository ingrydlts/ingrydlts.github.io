# Por Dentro — site

Site estático (HTML/CSS/JS puro, sem framework, sem build step) para a vitrine de vendas do Por Dentro. Implementado a partir de `por-dentro-vitrine-especificacao.md` e do mockup `Por Dentro - Vitrine.dc.html`.

## Estrutura

```
/index.html                          Home
/produtos-digitais/                  Grade de templates próprios
/produtos-digitais/produto/          Template genérico de página de produto (?slug=...)
/produtos-digitais/obrigado/         Compra confirmada (confere o pagamento e mostra os próximos passos)
/produtos-de-estudo/                 Indicações afiliadas (livros, papelaria)
/produtos-de-compras/                Indicações afiliadas (roupas, acessórios)
/sobre/                              Página institucional
/acesso-vip/                         Questionário de vagas limitadas (libera link do Drive pras 10 primeiras respostas)
/artigos/                            Índice do blog (busca + filtro por categoria)
/artigos/post/                       Template genérico de artigo (?slug=...)
/mentions-legales/  /cgv/  /confidentialite/    Páginas legais (rascunho)
/assistente-de-vistos/               Bot público: quiz que classifica o tipo de visto/persona
/checklist-preview/                  Landing pública pós-bot: perguntas específicas da persona
                                      + preview do checklist — o que não existe ainda vira
                                      e-mail de interesse; au_pair_estudante já entrega no app
                                      de verdade (ver POR DENTRO APP/README.md, "A jornada completa")
/content/*.json                      Todo o conteúdo editável (produtos, posts, banners)
/admin/                              Painel Decap CMS — edita os arquivos acima sem git/código
/assets/css/style.css                Estilos (tokens de marca, mobile-first)
/assets/js/                          render.js, purchase.js, markdown.js, main.js
/assets/css/vitrine.css + /assets/js/vitrine.js
                                      Loja de produtos digitais: grade, página do produto e
                                      compra confirmada (botões com estado, galeria com toque,
                                      barra de compra fixa no celular, avaliações, combo)
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

## Assistente de Parcerias (`/admin/parcerias/`)

Ferramenta privada — não linkada em nenhuma navegação pública — com dois modos, alternados por
uma aba no topo da página:

- **"Recebi uma proposta"**: cruza os dados de uma proposta que chegou com sua bússola de marca
  (pilares editoriais, tom de voz, limites inegociáveis do Por Dentro) e com sua tabela de
  valores, e devolve um veredito (aceitar / negociar / recusar), os motivos, o valor sugerido
  comparado ao ofertado, e um texto pronto pra responder em cada um dos três tons.
- **"Quero puxar uma parceria"**: monta um pitch pra mandar você mesma pra uma marca que queira
  ter perto do Por Dentro — usa a bússola de marca, sua tabela de valores e (se preenchidos)
  seus números de audiência pra gerar o texto, em três variações (já propor valor / propor um
  piloto em permuta / só abrir a conversa).

Tabela de valores, seus números de audiência, e os históricos de propostas avaliadas e de
pitches enviados são compartilhados entre os dois modos e ficam salvos uma vez só.

Roda 100% no navegador — sem backend, sem IA, sem envio de dados a servidor nenhum. Tudo fica em
`localStorage`, só nesse aparelho; trocar de navegador ou limpar dados do site apaga o que foi salvo.

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

### Estúdios (telas com arrastar e soltar e prévia real)

O `/admin` está sendo atualizado coleção por coleção com **estúdios**: telas que abrem por cima do
formulário do Decap, editam os **mesmos campos** do mesmo arquivo de `content/`, e mostram ao lado a
página real do site já com as mudanças (celular, tablet ou computador) — antes de publicar. Nada muda
no site nem no formato dos arquivos; o "Publicar" continua sendo o do Decap.

- **Início / "Hoje"** (`admin/home.js`): a tela de entrada do painel, no lugar da lista de coleções
  do Decap. Tem um menu agrupado (Conteúdo, Vitrine, Site, Acompanhar) e, em "Hoje", o que pede atenção:
  avaliações esperando, banner apontando pra artigo que não está no ar, anúncio de rede sem código,
  produto no ar sem pagamento, artigos em revisão, próximos passos da compra em branco… Mostra também o
  próximo artigo agendado, as etapas dos artigos, as últimas mudanças (histórico do GitHub de
  `content/`) e atalhos. "Ir para…" (⌘K / Ctrl+K) acha telas e artigos. Cada item abre a coleção de
  sempre e já abre o estúdio dela; a seta "←" do Decap volta pro início. Só lê — não grava nada. "Lista
  clássica do Decap", no pé do menu, mostra a tela antiga até fechar a aba.
- **Produtos digitais** (`admin/widgets/product-studio.js`): lista na ordem da vitrine (bolinha verde =
  no ar e completo, laranja = no ar mas falta algo, cinza = escondido), um medidor de "página pronta"
  com atalhos pro que falta, e seções que seguem a página de cima pra baixo — card da vitrine, topo,
  preço e selo, galeria, FAQ, combo, depois da compra e pagamento/endereço. Abrir uma seção leva a
  prévia até aquela parte (vitrine, página do produto ou compra confirmada). Tem "Desfazer" e avisos
  na hora (preço antigo menor que o atual, link do Stripe estranho, endereço repetido…). Abre pelo
  botão "Abrir estúdio de produtos" em `/admin` → Produtos digitais.
- **Link na bio** (`admin/widgets/links-studio.js`): topo (foto, bio, redes), card do assistente e
  seções — arraste a seção pela alça do título e os links entre as seções, liga/desliga cada link.
- **Menu do site** (`admin/widgets/menu-studio.js`, coleção "Cabeçalho do site"): arraste pra mudar a
  ordem dos links (vale pro topo, celular e rodapé), texto, endereço e liga/desliga.
- **Cabeçalho e rodapé** (mesmo arquivo, coleção "Cabeçalho e rodapé (menu do site)"): tabela com as
  categorias e as páginas; toque numa página pra ver a prévia dela.
- **Artigos** (`admin/widgets/posts-board.js`, botão "Abrir quadro de artigos"): quadro com as
  etapas do campo `status` — Ideia, Escrevendo, Revisão, Agendado e No ar. Arraste o cartão entre as
  colunas (ou toque nele e escolha a etapa); ir pro ar sem data usa a de hoje, e Agendado pede a data.
  O cartão abre título, resumo, categoria, capa, datas e endereço, e avisa o que falta (capa, FAQ,
  Feedback…). A prévia mostra o blog ou o artigo — inclusive rascunho, com uma faixa "ainda não está
  no ar" que só aparece na prévia. "Editar o texto" abre o editor visual daquele artigo. A lista de
  sempre continua embaixo do botão, com todos os campos.
- **Corpo do artigo** (`admin/widgets/article-composer.js`): o editor em blocos, agora com
  "Prévia no site" — a página real do artigo com o texto de agora, no celular, tablet ou computador.
- **Banners dentro do artigo** (`admin/widgets/article-ads-studio.js`, em "Anúncios nos artigos" e em
  "Vitrine dentro dos artigos"): um mapa do artigo (topo, blocos, meio automático, fim). Arraste o
  banner próprio, o anúncio de rede, o banner com foto ou a faixa de fechamento pro lugar em que
  aparecem em todos os artigos; a prévia é um artigo de verdade. Cada coleção grava o seu arquivo —
  as peças da outra aparecem com cadeado, só pra você ver o artigo inteiro.
- **Banners e destaques** (`admin/widgets/banners-studio.js`): foto do topo da home (celular e
  computador), o banner "vitrine → blog" de cada página de produtos (com a lista de artigos pra
  escolher e aviso quando o artigo não existe ou não está no ar) e o banner lateral do blog.

Como funciona por baixo (pra criar o próximo estúdio): `admin/widgets/studio-kit.js` tem a lista
arrastável (SortableJS, em `admin/vendor/`), a prévia e o acesso à biblioteca de imagens. A prévia
abre a página do site num `<iframe name="pd-preview">`; `fetchJSON` em `assets/js/render.js` lê os
dados em edição de `window.parent.PDPreview` em vez do arquivo publicado, e `assets/js/consent.js`
não mostra banner nem mede nada ali dentro. `render.js` também ouve o pedido `pd-focus` do painel
(rola a prévia até a parte que você está editando) e exporta `IN_PREVIEW`, usado pra mostrar artigo
em rascunho só dentro da prévia. Um estúdio novo é um widget do Decap registrado com
`CMS.registerWidget`, carregado em `admin/index.html` depois do kit, e ligado ao campo em
`admin/config.yml` (`widget: nome-do-estudio`). Quando o arquivo tem mais de um campo no topo (ex.
`links.json`: hero, bot, sections), o estúdio fica num campo e os outros usam `widget: studio-part`,
pra que um estúdio só edite todos (`PDStudio.part("hero")` no kit).

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
— no estúdio de produtos do `/admin`, é só arrastar os outros produtos pra caixa "No combo"). Quando há pelo menos 2 produtos no combo, a página calcula o desconto sozinha — **10%
com 2 produtos, 15% com 3, 20% com 4 ou mais**, nunca passando de 50% de desconto sobre a soma dos
preços (piso de margem). Sem produtos vinculados, a seção mostra um aviso reservando o espaço em vez
de ficar em branco.

**O preço de combo mostrado hoje é só referência** — cada produto ainda tem seu próprio Payment Link
do Stripe, não existe checkout único pra cobrar o combo de uma vez (isso é o carrinho com múltiplos
produtos já listado na Fase 11 do `GUIA-DE-IMPLEMENTACAO.md`). Enquanto isso não existir, quem quiser
o combo compra os produtos separadamente pelos links individuais.

## Questionário de vagas limitadas (`/acesso-vip/`)

Página isolada (sem menu, pensada pra tráfego de link direto — ex. um botão numa automação do
ManyChat) que só libera um link do Google Drive pras **N primeiras respostas** de um formulário
(padrão: 10), travando sozinha depois disso. A trava é decidida pelo Worker num contador do banco D1
(mesma lógica de segurança do `/api/events` — dados sensíveis não ficam em `content/*.json`, que é
público), não por automação de e-mail: um envio de e-mail não
consegue impedir, de forma confiável, que a 11ª pessoa também receba o link se duas respostas
chegarem quase ao mesmo tempo.

- **Conteúdo** (título, perguntas, textos de sucesso/vagas encerradas, oferta paga da "Etapa 2",
  FAQ) é 100% editável em `/admin` → "Questionário de vagas limitadas" — `content/quiz-config.json`.
- **Rastreio**: se o link trouxer `?ref=<algo>` na URL (ex. um identificador do ManyChat), a página
  guarda isso junto com a resposta — além do @ do Instagram, sempre pedido no formulário, pra você
  conseguir entrar em contato direto na DM com quem ganhou a vaga (ou reimpactar quem não ganhou).
- **Configuração** (variável do link do Drive, tabela no banco D1, como reabrir uma nova rodada de
  vagas): [`cms-oauth-worker/README.md`, seção 12](cms-oauth-worker/README.md#12-configurar-o-questionário-de-vagas-limitadas-acesso-vip).
- **Pendências**: a integração de pagamento da "Etapa 2" (5€) usa o campo `link` de
  `content/quiz-config.json` → `locked.etapa2` — cole ali o Payment Link do Stripe quando criar o
  produto; enquanto estiver vazio, o botão mostra um aviso em vez de um link quebrado (mesmo padrão
  dos produtos digitais).

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
