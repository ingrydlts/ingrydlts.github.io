# Manual de Gerenciamento — Por Dentro (dia a dia)

Este documento é pra você usar depois que o site estiver no ar: como adicionar produto, trocar preço, publicar artigo, trocar foto — sem precisar entender de código. Não confundir com o `GUIA-DE-IMPLEMENTACAO.md`, que é o roteiro técnico de construção do site.

---

## Duas formas de editar

**Pelo painel `/admin`** (recomendado, assim que a Fase 6 do guia de implementação estiver pronta) — você preenche formulário, clica em "Publish", e o site atualiza sozinho em cerca de 1 minuto. Não precisa saber o que é GitHub, JSON ou git.

**Direto no arquivo**, hoje, enquanto o `/admin` não está configurado — os arquivos ficam em `content/*.json`. Dá pra editar num editor de texto simples, mas dois cuidados:
- JSON é sensível a vírgula e aspas. Se sobrar ou faltar uma vírgula, o site inteiro daquele arquivo para de carregar.
- Editar o arquivo no seu computador **não coloca a mudança no ar sozinho** — alguém precisa levar esse arquivo até o GitHub (`git add`, `git commit`, `git push`). Se não quiser mexer com isso, é só me mandar o que quer mudar que eu edito e publico.

Este manual assume que, mais cedo ou mais tarde, você vai usar o `/admin`. Onde o processo for diferente hoje (sem `/admin`), eu marco com **⚠️ Hoje sem o painel**.

---

## Onde cada coisa mora

| O que você quer mudar | Arquivo | Seção no `/admin` |
|---|---|---|
| Produtos digitais (templates) | `content/produtos-digitais.json` | "Produtos digitais" |
| Indicações de estudo (afiliado) | `content/produtos-estudo.json` | "Produtos de estudo (afiliados)" |
| Indicações de compras (afiliado) | `content/produtos-compras.json` | "Produtos de compras (afiliados)" |
| Artigos do blog | `content/posts.json` | "Blog — artigos" |
| Foto do hero da Home, banners entre categorias e blog, banner lateral do blog | `content/banners.json` | "Banners e destaques" |
| Texto da página Sobre | `sobre/index.html` | *(fora do `/admin` — ver seção 7)* |
| Mentions légales / CGV / Confidentialité | `mentions-legales/`, `cgv/`, `confidentialite/` | *(fora do `/admin` — ver seção 9)* |

---

## 1. Adicionar um produto digital novo

1. Abra "Produtos digitais" → adicione um novo item na lista.
2. Preencha:
   - **Slug**: identificador só pra URL — minúsculo, sem espaço nem acento, palavras separadas por hífen (ex.: `organizador-de-viagem`). Precisa ser único, diferente de todos os outros produtos.
   - **Título**, **categoria curta** (ex. "Template Notion"), **resumo** (aparece no card da listagem) e **descrição** (aparece na página do produto).
   - **Preço atual**. Se não tiver desconto, deixe "preço antigo" em branco.
   - **O que inclui** (lista de recursos com ✓) e **perguntas frequentes** são opcionais.
   - **Link de pagamento do Stripe**: cole aqui assim que criar o Payment Link (ver Fase 5 do guia de implementação). Enquanto estiver vazio, o botão de compra do produto mostra um aviso em vez de navegar pra um link quebrado — então tudo bem cadastrar o produto antes de ter o link pronto.
3. Publique. O produto aparece automaticamente na grade de `/produtos-digitais/` e ganha uma página própria em `/produtos-digitais/produto/?slug=o-slug-que-você-escolheu`.

---

## 2. Mudar o preço de um produto

Abra o produto em "Produtos digitais", troque o campo **Preço atual** (e **Preço antigo**/**selo de lançamento**, se for o caso de mostrar "de X por Y"). Não precisa mexer em mais nada — o preço atualiza em todos os lugares que ele aparece (card, página do produto, botão de pagamento) porque todos leem o mesmo campo.

---

## 3. Conectar o pagamento (Stripe) de um produto

1. No painel do Stripe, crie o Payment Link do produto (ver Fase 5 do guia de implementação).
2. Copie a URL gerada.
3. Cole no campo **Link de pagamento do Stripe** desse produto.

Pronto — o botão "Ir para pagamento seguro" passa a levar direto pra lá assim que a checkbox de renúncia for marcada pelo visitante.

---

## 4. Adicionar ou editar uma indicação de afiliado

Vale tanto pra "Produtos de estudo" quanto "Produtos de compras" — mesma estrutura nas duas seções do `/admin`.

1. Adicione um item: **título**, **descrição curta**, **foto** e **link de afiliado**.
2. Não precisa adicionar o selo "Publicité" manualmente — ele aparece sozinho em todo card dessas duas categorias, porque é exigência legal (Loi Influenceurs) e não pode depender de alguém lembrar de marcar.
3. Se o link for da Amazon, lembre que o texto fixo exigido pelo programa de afiliados ("En tant que Partenaire Amazon...") já está no rodapé da página — não precisa repetir por produto.

---

## 5. Publicar um artigo novo no blog

1. Abra "Blog — artigos" → adicione um item.
2. **Slug**: mesma regra dos produtos (minúsculo, com hífen, único).
3. **Categoria**: qualquer palavra/expressão curta (ex. "Vistos", "Alimentação") — os filtros da página `/artigos/` são gerados automaticamente a partir das categorias que existirem, não precisa configurar em outro lugar.
4. **Data de publicação**: os artigos mais recentes aparecem primeiro, tanto em `/artigos/` quanto na Home.
5. **Corpo do artigo** — aceita uma formatação simples:
   - `## Um subtítulo` vira título de seção
   - `- um item` vira lista
   - `**palavra**` vira **negrito**, `*palavra*` vira *itálico*
   - `[texto do link](https://...)` vira link
   - Parágrafo normal é só digitar o texto, sem símbolo na frente.
6. Publique. O artigo já aparece em `/artigos/` e tem página própria em `/artigos/post/?slug=o-slug-que-você-escolheu`.

**Sobre os banners dentro do artigo:** hoje, todo artigo mostra o mesmo par de banners promovendo a vitrine (um no meio do texto, indicando Produtos de estudo, e um no fim, indicando Produtos digitais) — é um comportamento fixo do site, não algo que se edita por artigo. Se quiser que cada artigo promova um produto diferente conforme o tema, me avise — dá pra construir isso, só não está feito ainda.

---

## 6. Trocar uma foto

Onde a foto aparece depende de qual conteúdo você está editando:
- Foto de um **produto**: campo "Imagem" dentro do próprio produto (seção 1/2/4).
- Foto de um **artigo**: campo "Foto de capa" dentro do próprio artigo (seção 5).
- Foto do **hero da Home** ou dos **banners entre categorias e blog**: seção "Banners e destaques".

Pelo `/admin`, é só clicar no campo de imagem e enviar o arquivo do computador — ele sobe sozinho e fica disponível em `/images/uploads/...`. Formato recomendado: JPG ou WEBP, até ~1500px de largura (arquivo mais leve = site mais rápido).

**⚠️ Hoje sem o painel:** seria preciso colocar o arquivo de imagem dentro da pasta `images/` do projeto e escrever o caminho manualmente no campo `image` do JSON (ex. `"image": "/images/minha-foto.jpg"`) — mais fácil eu fazer isso por você até o `/admin` estar pronto.

Enquanto o campo de imagem estiver vazio, o site mostra um bloco cinza-claro com um texto explicando o que deveria estar ali — isso é proposital, pra nunca quebrar o layout por falta de foto.

---

## 7. Trocar o texto/foto da página Sobre

Esta página não usa os arquivos JSON — o texto vive direto em `sobre/index.html`, porque é conteúdo estrutural (não repete em nenhuma listagem). Pra trocar o texto ou a foto, é mais simples me pedir diretamente ("troca o texto da página Sobre por: ...") do que editar HTML à mão. Se preferir fazer sozinha, procure por `[Texto sobre a Ingryd...]` e `[Segundo parágrafo...]` dentro do arquivo.

---

## 8. Trocar os banners "vitrine → blog" de cada categoria

Seção "Banners e destaques" → "Banners vitrine → blog". Tem um bloco pra cada categoria (Produtos digitais / de estudo / de compras), com:
- **Selo** e **título** (o texto do banner)
- **Foto**
- **Cor**: use a cor emocional daquela categoria (verde para digitais `#577328`, azul para estudo `#8AACD2`, bege para compras `#B8933F`) — é a regra de marca de nunca introduzir uma 4ª cor na tela.
- **Slug do artigo pra onde o botão leva**: precisa ser o slug de um artigo que já existe em "Blog — artigos".

---

## 9. Editar as páginas legais

`Mentions légales`, `CGV` e `Confidentialité` também vivem em HTML puro (não em JSON), porque mudam raramente e têm formatação jurídica específica. Hoje têm campos marcados `[entre colchetes]` — nome completo, SIRET, e-mail de contato, prazo de garantia — que precisam ser preenchidos antes do lançamento (ver Fase 8 do guia de implementação). Pode me pedir pra preencher assim que tiver esses dados, ou editar direto procurando pelos colchetes.

---

## Regras gerais pra não quebrar nada

- **Slugs são pra sempre**: se você já divulgou um link com um slug (de produto ou de artigo) e depois troca o slug, o link antigo para de funcionar. Prefira só trocar título/texto, não o slug, de algo que já foi divulgado.
- **Todo campo obrigatório precisa de valor**: título, slug e preço/link de afiliado são a base mínima — o resto pode ficar em branco que o site lida bem com isso (mostra placeholder ou simplesmente não exibe aquele bloco).
- **Se não tiver certeza, pergunte antes de publicar** — pelo `/admin` dá pra salvar como rascunho sem publicar; editando o arquivo direto, é só não fazer o commit ainda.
- Na dúvida, sempre pode me pedir "adiciona esse produto pra mim" ou "troca esse preço" — eu edito e publico.

---

## Checklist rápido toda vez que você edita algo

1. Preencheu os campos obrigatórios daquele tipo de conteúdo (ver tabela no topo)?
2. Salvou/publicou pelo `/admin` — **ou**, se editou o arquivo direto, pediu pra alguém (eu) subir a mudança pro GitHub?
3. Esperou ~1 minuto (tempo do GitHub Pages republicar) e conferiu no site se ficou como esperado?

Se algo não aparecer como devia, o problema mais comum é uma vírgula ou aspas faltando no JSON — me chame que eu reviso.
