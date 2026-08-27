# Guia de Implementação — Por Dentro (site)

Documento-guia da concepção do site, do zero ao ar. Cada fase depende da anterior. Serve pra você acompanhar onde o projeto está e pra orientar qualquer sessão futura do Claude Code — inclusive uma que não tenha visto esta conversa.

**Como ler o status:**
✅ Concluída — já existe e funciona · 🟡 Parcial — existe mas depende de uma ação sua pra funcionar de verdade · 🔲 Pendente — ainda não começou

---

## Visão geral das fases

| # | Fase | O que entrega | Status | Depende de |
|---|---|---|---|---|
| 0 | Fundação | Especificação técnica, legal e de marca | ✅ | — |
| 1 | Design | Mockup de alta fidelidade de todas as telas | ✅ | Fase 0 |
| 2 | Frontend | HTML/CSS/JS real, todas as páginas, responsivo | ✅ | Fase 1 |
| 3 | Conteúdo (dados) | Estrutura `/content/*.json` com dados de exemplo | ✅ | Fase 2 |
| 4 | Domínio e hospedagem | Site publicado, no ar, em domínio próprio | 🔲 | Fase 2 |
| 5 | Pagamento (Stripe) | Compra de verdade, ponta a ponta | 🔲 | Fase 4 |
| 6 | Painel de conteúdo (CMS) | Editar produto/banner/post sem código | ✅ | Fase 4 |
| 7 | Entrega automática | E-mail automático com o arquivo após a compra | 🔲 | Fase 5 |
| 8 | Conteúdo real e jurídico | Fotos, textos finais, dados legais preenchidos | 🔲 | Fase 2 (pode andar em paralelo) |
| 9 | QA final | Checklist completo antes de divulgar | 🔲 | Fases 4–8 |
| 10 | Lançamento | Primeira divulgação pública | 🔲 | Fase 9 |
| 11 | Evolução (pós-lançamento) | Carrinho real, depoimentos, etc. | 🔲 | Fase 10 |

---

## Fase 0 — Fundação ✅

O que já existe, documentado em `por-dentro-vitrine-especificacao.md`:
- Objetivo do produto e mapa do site (seção 1 e 4)
- Stack escolhida: HTML/CSS/JS puro, GitHub Pages, Cloudflare, Stripe Payment Links (seção 2)
- Obrigações legais francesas: divulgação de afiliado, direito de retratação, mentions légales, CGV, confidencialidade (seção 3)
- Identidade visual: paleta, tipografia, regra de 3 cores por peça (seção 5.1)

Nada a fazer aqui — é a base de tudo que vem depois.

---

## Fase 1 — Design (mockup) ✅

- `Por Dentro - Vitrine.dc.html`, no projeto Claude Design, com todas as telas em alta fidelidade (desktop 1440 / mobile 390): Home, 3 categorias, Sobre, UI Kit, Sacola, Checkout, Footer, Blog (índice + artigo), Página de produto.
- Navegação circular vitrine ↔ blog: banner de transição no fim de cada categoria, seção "Últimos guias" na Home, links de volta pra vitrine em cada artigo.
- Pagamento desenhado como redirecionamento pro Stripe (com selo Cartão + Link), não formulário de cartão próprio.

Projeto: `claude.ai/design/p/151a1685-cb0e-44c3-9465-e7649d508386`

---

## Fase 2 — Frontend estático ✅

Todas as páginas existem, são responsivas de verdade (não frames fixos) e já testadas localmente.

### Mapa de páginas

| Página | Arquivo | Fonte de dados | Depende de |
|---|---|---|---|
| Home | `/index.html` | `content/banners.json` (hero), `content/posts.json` (últimos artigos) | — |
| Produtos digitais | `/produtos-digitais/index.html` | `content/produtos-digitais.json`, `content/banners.json` | — |
| Página de produto | `/produtos-digitais/produto/index.html` (`?slug=`) | `content/produtos-digitais.json` | **Stripe** (Fase 5) pro botão funcionar de verdade |
| Produtos de estudo | `/produtos-de-estudo/index.html` | `content/produtos-estudo.json`, `content/banners.json` | Links de afiliado reais |
| Produtos de compras | `/produtos-de-compras/index.html` | `content/produtos-compras.json`, `content/banners.json` | Links de afiliado reais |
| Sobre | `/sobre/index.html` | Texto fixo no HTML | Texto real da Ingryd |
| Blog — índice | `/artigos/index.html` | `content/posts.json`, `content/banners.json` | — |
| Blog — artigo | `/artigos/post/index.html` (`?slug=`) | `content/posts.json` | — |
| Mentions légales | `/mentions-legales/index.html` | Texto fixo no HTML | Dados legais reais (Fase 8) |
| CGV | `/cgv/index.html` | Texto fixo no HTML | Dados legais reais (Fase 8) |
| Confidentialité | `/confidentialite/index.html` | Texto fixo no HTML | Dados legais reais (Fase 8) |

### Camadas compartilhadas

| Arquivo | Função |
|---|---|
| `assets/css/style.css` | Todo o visual — tokens de marca, layout responsivo, componentes |
| `assets/js/main.js` | Menu mobile, estado ativo da navegação |
| `assets/js/render.js` | Helpers: buscar JSON, montar card de imagem, formatar preço |
| `assets/js/markdown.js` | Converte o corpo dos artigos (markdown) em HTML |
| `assets/js/purchase.js` | Gate legal (checkbox de renúncia) + redirecionamento pro Stripe |

**Nada a fazer aqui** — só evolui se você pedir mudança de página/layout.

---

## Fase 3 — Conteúdo (estrutura de dados) ✅

Os 5 arquivos em `/content/` guardam todo o conteúdo variável do site — é o que separa "código" de "conteúdo", e é o que o painel (Fase 6) vai editar:

- `produtos-digitais.json` — os 3 templates à venda
- `produtos-estudo.json` / `produtos-compras.json` — indicações de afiliado
- `posts.json` — os 6 artigos do blog (com corpo em markdown)
- `banners.json` — foto do hero da Home, banners vitrine→blog, banner lateral do blog

Estão preenchidos com **conteúdo de exemplo** (textos reais da sua pesquisa, mas fotos e alguns dados ainda como placeholder) — ver Fase 8.

**Nada a fazer aqui agora** — só editar valores, o que dá pra fazer direto no arquivo ou, depois da Fase 6, pelo `/admin`.

---

## Fase 4 — Domínio e hospedagem 🔲

O que falta, na ordem:

1. **Criar o repositório no GitHub** e subir esta pasta (`git init`, `git add`, `git commit`, `git push` pra um repo novo).
2. **Ativar GitHub Pages**: Settings → Pages → Deploy from branch → `main` → `/ (root)`.
3. **Comprar/apontar o domínio no Cloudflare**: registro CNAME apontando pro `SEU-USUARIO.github.io`, proxy ativado (nuvem laranja) se quiser CDN/cache do Cloudflare na frente.
4. **Ativar Cloudflare Web Analytics** (sem cookies — é por isso que o site não tem banner de consentimento).
5. Confirmar que o site abre no domínio final e que os links internos (`/produtos-digitais/`, etc.) funcionam — eles assumem que o site está na raiz do domínio, não numa subpasta tipo `usuario.github.io/repo/`.

**Ação necessária seu lado:** ter (ou criar) a conta GitHub e o domínio no Cloudflare. Depois disso, é configuração — posso te guiar passo a passo quando chegar a hora.

---

## Fase 5 — Pagamento (Stripe) 🔲

1. Criar/ativar a conta Stripe.
2. Ativar o **Stripe Link** (checkout expresso) nas configurações de pagamento da conta — é o que faz o selo "link" do site corresponder ao checkout de verdade.
3. Pra cada produto em `produtos-digitais.json`, criar um **Payment Link** no painel do Stripe.
4. Colar a URL do Payment Link no campo `stripeLink` de cada produto — direto no JSON por enquanto (ou pelo `/admin`, depois da Fase 6).
5. Testar uma compra de teste (modo teste do Stripe) ponta a ponta: marcar a checkbox → clicar em pagar → cair na página do Stripe.

**Ação necessária seu lado:** criar a conta Stripe e os Payment Links (decisão de preço/produto é sua). Eu colo os links nos arquivos assim que você me passar.

**Fora de escopo por enquanto:** carrinho com múltiplos produtos numa cobrança só — isso exige montar a sessão de checkout num backend (ver Fase 11). Hoje, cada produto vende pela própria página.

---

## Fase 6 — Painel de conteúdo / CMS ✅

`/admin` (Decap CMS) funcionando de ponta a ponta:

1. ✅ Worker de OAuth publicado no Cloudflare: `https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev` (código em `cms-oauth-worker/worker.js`).
2. ✅ GitHub OAuth App criado, com `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` salvos como secrets no worker.
3. ✅ `admin/config.yml` aponta pro repositório real (`ingrydlts/ingrydlts.github.io`) e pro worker publicado.
4. ✅ Testado: login em `ingrydlts.github.io/admin` com GitHub, edição publicada gerou commit no repositório.

**Ressalva importante:** dos 9 artigos do blog, 6 (exame cívico, cursos de francês, VLS-TS, ANEF, ajudas de
moradia, bolsa de estudo) têm um campo `url` em `content/posts.json` que os faz renderizar a partir de um
HTML próprio em `artigos/post/<slug>/index.html`, e não do campo `body` do JSON — decisão tomada numa sessão
anterior pra deixar esses 6 fiéis ao HTML original. Nesses 6, editar **título/resumo/imagem** pelo `/admin`
funciona normalmente (aparece no card do blog), mas editar o **corpo do texto** pelo painel não muda nada
no site — pra esses, o corpo se edita direto no arquivo HTML. Os outros 3 artigos (e qualquer um novo
criado só no JSON, sem `url`) são 100% editáveis pelo `/admin`, corpo incluído.

---

## Regra — Interação e instrumentação de audiência em artigos 🟡

**Por quê:** cada artigo do blog é uma chance de aprender algo sobre quem lê — não só publicar texto. Todo
artigo novo (e, com o tempo, os antigos) precisa dar pelo menos um jeito de a leitora **clicar em algo**, e
esse clique precisa **virar dado** em `/admin/dashboard`, não só ficar bonito na tela.

### O mínimo obrigatório em todo artigo novo

1. **`[[FAQ]]`** — sempre em formato dropdown/acordeão (é o padrão de `renderFaq` em `assets/js/markdown.js`,
   não precisa fazer nada além de usar o marcador). 3 a 6 perguntas reais, as que a leitora resolveria
   perguntando no Instagram se pudesse.
2. **`[[FEEDBACK]]`** — sempre no fim do artigo. Pode usar a pergunta padrão ("Esse artigo foi útil pra
   você?") ou uma pergunta customizada, mas o bloco tem que existir.

### Use quando fizer sentido pro tema (não é todo artigo que precisa)

- **`[[CHECKLIST]]`** — quando o artigo tiver um critério de elegibilidade ("você pode pedir X se...") ou um
  passo a passo que vale a leitora ir marcando.
- **`[[RESOURCES]]`** — toda vez que citar uma fonte oficial (France-Visas, Légifrance, site de um órgão).
  Cada link já sai com `target="_blank"` e rastreio de clique — não precisa fazer nada além de preencher a
  URL.

O widget "Corpo do artigo" no `/admin` já mostra essa regra no hint do campo, com o `[[FAQ]]`/`[[FEEDBACK]]`
marcados como obrigatórios — ver `admin/config.yml`.

### Como cada clique vira dado

Todo bloco interativo manda 1 evento pro Worker (`window.PDEvents.send(...)`, código em
`assets/js/events.js` → `POST /api/events` → D1) **só depois que a leitora aceita o banner de cookies**
(`window.PDConsent`). `/admin/dashboard` lê esses eventos agregados via `GET /api/insights/summary`
(`handleInsightsSummary` em `cms-oauth-worker/worker.js`).

| Interação | Dispara em | `event_type` | `payload.type` | Aparece em `/admin/dashboard` como |
|---|---|---|---|---|
| Abrir uma pergunta do FAQ | `initFaqAccordion`, `assets/js/main.js` | `block` | `faq_open` | "Perguntas do FAQ mais abertas" |
| Trocar de aba (`.rt-tab-btn`) | `initTabSwitcher`, `assets/js/main.js` | `block` | `tab_click` | (agregação ainda não tem seção própria — dá pra somar direto no D1 se precisar) |
| Clicar num link de `[[RESOURCES]]` | `initResourceTracking`, `assets/js/main.js` | `block` | `resource_click` | "Fontes mais clicadas" |
| Completar uma `[[CHECKLIST]]` até 100% | `initChecklist`, `assets/js/main.js` | `block` | `checklist_complete` | "Checklists completadas" |
| Votar 👍/👎 no `[[FEEDBACK]]` | `initFeedbackButtons`, `assets/js/main.js` | `feedback` | — (usa `payload.vote`) | "Feedback dos artigos" |

Pra criar um novo tipo de interação clicável no futuro, o padrão é sempre o mesmo: escolher um `payload.type`
novo, mandar via `window.PDEvents.send("block", slug, { type: "...", id: "..." })`, e (se quiser ver agregado
no painel) somar uma query em `handleInsightsSummary` + uma tabela em `admin/dashboard/index.html`. Não
precisa mexer no schema do D1 nem no `ALLOWED_EVENT_TYPES` do Worker — `payload` é JSON livre.

### Artigos com HTML próprio (os que têm campo `url` em `content/posts.json`)

Esses não passam pelo `body` em markdown, então os marcadores `[[...]]` não funcionam neles direto. O
Feedback já foi resolvido de um jeito genérico: `assets/js/article-extras.js` (`mountArticleExtras`) agora
aceita um `feedbackMountId` e monta um `[[FEEDBACK]]` padrão sozinho — todos os artigos com HTML próprio já
têm `<div id="article-feedback-mount"></div>` + a chamada atualizada. Um artigo novo desse tipo só precisa
repetir o mesmo padrão (mount point + `feedbackMountId` na chamada).

O FAQ desses artigos **não tem um equivalente automático** — precisa copiar a estrutura HTML de
`renderFaq` (ver `assets/js/markdown.js`) direto no arquivo, com `data-article-slug` no wrapper. Ainda
pendente nos artigos com HTML próprio (14) e no `selo-qualite-fle-mapa-cursos-de-frances` (não tem FAQ
ainda, embora já use o corpo em markdown).

### Status desta regra (2026-08-27)

- ✅ Instrumentação de clique (FAQ, abas, recursos) implementada em `assets/js/main.js` + agregação no
  Worker/painel.
- ✅ `[[FEEDBACK]]` presente em `tudo-sobre-o-exame-civico`, `vae-franca-2026`,
  `selo-qualite-fle-mapa-cursos-de-frances`, e montado automaticamente nos 14 artigos com HTML próprio.
- 🟡 `[[FAQ]]` ainda falta em `selo-qualite-fle-mapa-cursos-de-frances` e nos 14 artigos com HTML próprio —
  fica pendente de conteúdo real (perguntas de verdade por artigo), não é mudança mecânica.

---

## Fase 7 — Entrega automática por e-mail (backend) 🔲

Fluxo já desenhado na especificação (seção 5.2), ainda não construído:

```
Cliente paga (Stripe) → webhook checkout.session.completed
        → Cloudflare Worker
        → API da Brevo
        → e-mail automático com link de download, saindo de contato@seudominio
```

Passos:
1. Criar conta Brevo (grátis até 300 e-mails/dia).
2. Configurar DKIM da Brevo no DNS do Cloudflare (senão o e-mail sai como `@brevosend.com`).
3. Escrever e publicar o Cloudflare Worker que recebe o webhook do Stripe e chama a Brevo.
4. Decidir onde hospedar os arquivos de download de forma seguraa (não indexável publicamente / link com expiração).
5. Configurar `contato@seudominio` via Cloudflare Email Routing + "Enviar como" do Gmail, pro lado humano (ler/responder).

**Sem isso, hoje:** depois do pagamento, o Stripe redireciona pra uma página de sucesso simples — sem entrega automática do arquivo. Pra volume baixo inicial, dá pra entregar manualmente por e-mail enquanto este fluxo não existe; combinamos isso quando chegar a hora.

---

## Fase 8 — Conteúdo real e jurídico 🔲

Pode andar em paralelo com as fases 4–7, não bloqueia nada técnico:

- [ ] Fotos reais (hero da Home, produtos, categorias, artigos, foto da Ingryd em `/sobre/`) — sobem em `content/*.json`, campo `image`.
- [ ] Texto de `/sobre/index.html` — hoje tem `[a preencher]`.
- [ ] `[Nome completo]`, `[SIRET]`, `[e-mail de contato]` em `/mentions-legales/`, `/cgv/`, `/confidentialite/`.
- [ ] Prazo real de garantia (7 ou 14 dias) e número/prazo real da leva de lançamento (€27→€39) — hoje no texto do produto.
- [ ] Confirmar com expert-comptable/avocat os textos legais antes de publicar (o disclaimer já está nos próprios arquivos).
- [ ] Links de afiliado reais em `produtos-estudo.json` / `produtos-compras.json` (hoje vazios).
- [ ] Pendência da fonte Gliker (seção 5.1 da especificação) — hoje o site usa Fraunces como substituta.

---

## Fase 9 — QA final 🔲

Checklist antes de divulgar:
- [ ] Testar uma compra real (ou em modo teste do Stripe) do início ao fim.
- [ ] Testar em celular de verdade, não só no navegador redimensionado.
- [ ] Conferir todos os links do menu e do rodapé em todas as páginas.
- [ ] Conferir que os 3 produtos, os posts do blog e os banners aparecem certos depois de qualquer edição feita pelo `/admin`.
- [ ] Revisar os textos legais com o profissional consultado na Fase 8.
- [ ] Rodar um leitor de tela ou o Lighthouse do Chrome pra acessibilidade básica.

---

## Fase 10 — Lançamento 🔲

- [ ] Confirmar DNS propagado e HTTPS ativo no domínio final.
- [ ] Primeiro post/divulgação linkando pro site.
- [ ] Guardar um "número/prazo real de vagas" antes de anunciar o preço de lançamento (pra não ser urgência falsa, como a própria especificação já alerta).

---

## Fase 11 — Evolução (pós-lançamento) 🔲

Não bloqueia o lançamento — são melhorias pra depois:
- Carrinho com múltiplos produtos numa cobrança só (Stripe Checkout Session dinâmica via Cloudflare Worker) — é o que falta pra cobrar o preço de combo calculado na seção de cross-sell da página de produto de uma vez só, hoje cada produto do combo ainda paga separado.
- ✅ Feito: página de produto redesenhada estilo "Sales Convert" — carrossel de fotos/vídeo, benefícios em ícone, selos de confiança, FAQ em acordeão, barra fixa de compra no mobile.
- ✅ Feito: avaliações com estrelas e comentário, com moderação em `/admin/avaliacoes/` antes de publicar (worker + KV em `cms-oauth-worker/`).
- ✅ Feito: combo entre produtos digitais com desconto automático por quantidade — falta o carrinho acima pra virar checkout único.
- URLs "bonitas" por artigo (`/artigos/nome-do-artigo/`) em vez de `?slug=`, se isso importar pra SEO.
- Novos produtos digitais (Notion, etc.) — só adicionar no `produtos-digitais.json` via `/admin`.

---

## Onde estamos agora

Fases **0, 1, 2, 3 e 6 concluídas** — o site está publicado no GitHub Pages (`ingrydlts.github.io`), com conteúdo de exemplo, e o painel `/admin` já edita e publica de verdade. Faltam a Fase 4 (domínio próprio — hoje usa o domínio padrão do GitHub Pages), a Fase 5 (Stripe) e a Fase 7 (entrega automática por e-mail), que dependem de **contas e decisões suas** — me chame quando tiver isso à mão e eu sigo a implementação técnica de cada uma.
