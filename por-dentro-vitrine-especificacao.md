# Por Dentro — Vitrine de Vendas (Mini Marketplace)
### Documento de especificação para construção via Claude Code

> Este documento consolida pesquisa de arquitetura, custos, e obrigações legais francesas para a vitrine de vendas do Por Dentro. Serve como brief para o Claude Code construir o site. Não é aconselhamento jurídico formal — os pontos de "Conformidade Legal" devem ser confirmados com um expert-comptable ou avocat antes do lançamento público.

---

## 1. Objetivo do produto

Uma página única (mini marketplace) que centraliza:
- Venda de produtos digitais próprios (template Excel, futuros templates Notion)
- Links de afiliados (roupas, livros de francês, etc.)
- Eventual manutenção do link do Gumroad existente

**O que a página precisa resolver:** permitir vender sem depender de comissão de plataforma (tipo Gumroad/Hotmart), mantendo apenas a taxa de processamento de pagamento (inevitável em qualquer método).

---

## 2. Stack recomendada

| Camada | Escolha | Justificativa |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla, arquivo único ou poucos arquivos | Sem build step, sem `npm install`, abre e funciona. GitHub Pages serve estático puro — não precisa de framework. |
| Hospedagem | GitHub Pages | Gratuito, já decidido pela usuária. |
| DNS / domínio | Cloudflare | Gratuito, já decidido. Bônus: Cloudflare também serve como CDN/cache na frente do GitHub Pages, e oferece **Cloudflare Web Analytics** — analytics sem cookies, o que evita banner de consentimento de cookies. |
| Pagamento (produtos próprios) | **Stripe Payment Links** | Sem mensalidade. Taxa por transação: **1,5% + 0,25€** para cartões europeus padrão (o que a maioria dos clientes brasileiros na França vai usar), até 3,25% + 0,25€ para cartões internacionais fora da EEE. Sem código de backend necessário — é um link hospedado pelo Stripe. |
| Gumroad | Manter só se quiser simplicidade agora; migrar pro Stripe reduz taxa (Gumroad cobra ~10% + taxa de pagamento, MUITO mais que só Stripe) | Decisão em aberto — ver seção 6. |
| Analytics | Cloudflare Web Analytics (sem cookies) | Evita necessidade de banner RGPD de cookies. |

### Por que não precisa de backend próprio
Como o checkout é feito via **Stripe Payment Links** (o cliente é redirecionado para uma página hospedada pelo próprio Stripe), toda a parte sensível (dados de cartão, conformidade PCI-DSS) fica 100% do lado do Stripe. O site em si é só HTML estático com botões/links — por isso GitHub Pages (que só serve arquivos estáticos) é suficiente.

---

## 3. Conformidade legal (França) — não pular

### 3.1 Links de afiliado — divulgação obrigatória
Pela **Loi n° 2023-451 (Loi Influenceurs)**, toda promoção comercial remunerada (inclusive comissão de afiliado) precisa ser **explicitamente identificada**. Termos aceitos: **"Publicité"** ou **"Collaboration commerciale"**, de forma clara, legível e imediatamente identificável — não pode estar escondida em letra pequena ou só nos Termos de Uso.
→ **Ação:** cada card/link de afiliado na vitrine precisa de um selo visível tipo `🔗 Lien affilié` ou `Publicité` ao lado, não só no rodapé geral do site.

#### 3.1.1 Exigência específica da Amazon Associates (se usar links Amazon)
Além da divulgação geral acima, o programa Amazon Associates **exige uma frase fixa própria**, visível na mesma página do link: *"En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises."* Não é opcional trocar a redação — é a frase que o próprio contrato de adesão da Amazon exige.
**Atenção:** a Amazon **proíbe formalmente** links de afiliado dentro de e-mails, e-books ou PDFs — então não incluir links Amazon dentro dos templates Excel/Notion vendidos, só no site.

### 3.2 Contrato escrito com marcas (se aplicável)
Desde 1º de janeiro de 2026 (Décret n° 2025-1137), contratos entre influenceur e anunciante acima de **1.000€ HT** de remuneração total exigem **contrato escrito** com cláusulas específicas. Não afeta o site em si, mas é uma regra operacional a manter em mente para parcerias de marca futuras.

### 3.3 Direito de retratação (produtos digitais) — ponto crítico pra sua venda de templates
Por padrão, todo consumidor tem **14 dias** para desistir de uma compra online. Para conteúdo digital baixável (seu Excel, futuros Notion), existe uma **exceção legal**, mas só é válida se, **antes do pagamento**, o comprador:
1. Der consentimento expresso para o download começar imediatamente, **e**
2. Renunciar expressamente ao direito de retratação.

**Uma caixinha pré-marcada NÃO é válida.** Precisa ser uma ação voluntária do comprador.
→ **Ação de arquitetura:** o botão de compra (link do Stripe) só deve ficar clicável/visível **depois** que o usuário marcar manualmente uma checkbox tipo: *"Eu entendo que o acesso ao arquivo é imediato e renuncio ao meu direito de retratação de 14 dias."* Isso é feito com JS simples no lado do cliente (gate visual, sem precisar de backend).

### 3.4 Mentions légales (obrigatório em qualquer site profissional francês)
Precisa de uma página com: seu nome, o fato de ser entrepreneur individuel (SIRET, quando saído), forma de contato, e informação de hospedagem (GitHub Pages/Cloudflare, com endereço do host). Como você optou por não-difusão do endereço pessoal, mantenha essa mesma lógica aqui — não precisa expor endereço físico na página, só um e-mail de contato.

### 3.5 CGV (Conditions Générales de Vente)
Obrigatório para qualquer venda a consumidor. Precisa cobrir: preço, forma de entrega (download imediato), TVA (como auto-entrepreneur abaixo do teto de franchise, a menção correta é *"TVA non applicable, article 293 B du CGI"*), e a cláusula de renúncia ao direito de retratação (ligada à checkbox da seção 3.3).

### 3.6 Política de privacidade
Mesmo mínima — porque o Stripe Checkout coleta e-mail/dados de pagamento do comprador. Uma página curta explicando que o processamento de pagamento é feito pelo Stripe (terceiro) já cobre o básico.

---

## 4. Mapa do site (definido pela usuária)

```
/                         → Hero + apresentação do Por Dentro + acesso às 3 categorias
/produtos-digitais        → Templates próprios (Excel, Notion) para facilitar o dia a dia
                             cada card: preço, botão Stripe Payment Link,
                             checkbox de renúncia ao direito de retratação (seção 3.3)
/produtos-de-estudo       → Livros de francês, papelaria — links afiliados (ex: Amazon)
                             cada link: selo "Publicité"/"Lien affilié" (3.1)
                             + disclosure fixa da Amazon, se aplicável (3.1.1)
/produtos-de-compras      → Roupas, acessórios — links afiliados
                             mesma regra de divulgação da linha acima
/sobre                    → Quem é a Ingryd / Por Dentro
/mentions-legales         → Seção 3.4
/cgv                      → Seção 3.5
/confidentialite          → Seção 3.6
```

**Nota de navegação:** como são 3 categorias de produto bem distintas (digital vs. físico-estudo vs. físico-lifestyle), a home pode funcionar como um "hub" com 3 blocos grandes levando a cada aba — evita misturar tudo numa lista só e deixa claro pro visitante o que é comprável direto no site (produtos digitais) vs. o que é redirecionamento pra outra loja (afiliados de estudo e de compras).

---

## 5. Diretrizes de construção (performance e design)

- **Zero frameworks.** HTML/CSS/JS puro. Nenhum React/Vue/bundle — precisa abrir rápido, sem build.
- **CDNs só se necessário e leves** (ex: ícones), nunca bibliotecas pesadas tipo jQuery/Bootstrap completo.
- **Mobile-first.** Público majoritário vindo do Instagram, via celular.
- **Identidade visual:** usar exclusivamente a paleta e tipografia da seção 5.1 (extraída do Brand Master real). Respeitar a regra de "máximo 3 cores por peça" em toda página/componente novo.
- **Sem cookies de rastreio** (Cloudflare Web Analytics) para não precisar de banner de consentimento.

---

## 5.1 Identidade visual — extraída do Brand Master real (não inventada)

> ⚠️ Substitui uma versão anterior deste documento que havia inventado uma paleta própria ("carimbo burocrático"). A identidade abaixo vem do arquivo `brand-master-por-dentro.html` já existente da usuária — é a única válida.

**Regra fixa da marca (nunca muda):** máximo 3 cores por peça visual — 2 cores base + 1 cor emocional. Ouro Queimado é cor de raridade: no máximo 1 elemento por peça, nunca decorativo.

**Paleta base (2 cores fixas em todo o site):**
```css
:root {
  --off-white: #F4F1EC;      /* fundo principal */
  --grafite: #2B2B2B;        /* textos, títulos, estrutura */
  --ouro-queimado: #BB9351;  /* raridade — máx. 1 elemento por peça (CTA de destaque, preço) */
}
```

**Cores emocionais disponíveis (escolher 1 por peça/seção, conforme o papel):**
```css
--beje-paris: #DEB975;       /* identidade emocional — Paris real */
--verde-moss: #577328;       /* ancoragem — estabilidade, confiança */
--verde-esmeralda: #063B35;  /* intensidade — introspecção, profundidade */
--placid-blue: #8AACD2;      /* pausa — didático, acessível */
--merlot: #501318;           /* tensão — verdade crua, impacto */
--downtown-brown: #604034;   /* raiz — Brasil, memória, origem */
```

**Mapeamento por categoria do site** (a cor emocional muda por aba, mantendo as 2 cores base fixas):
| Categoria | Cor emocional | Papel |
|---|---|---|
| `/produtos-digitais` | Verde Moss `#577328` | Estabilidade, confiança — combina com organização/produtividade |
| `/produtos-de-estudo` | Placid Blue `#8AACD2` | Didático, acessível — combina literalmente com "estudo" |
| `/produtos-de-compras` | Beje Paris `#DEB975` | Identidade emocional, Paris real — combina com lifestyle |

**Tipografia (regra da marca: máximo 2 fontes por peça):**
- **Gliker** (display/impacto) — ⚠️ ver pendência abaixo
- **Inter Bold** (estrutura: títulos de card, preços, navegação)
- **Inter Regular** (leitura: descrições, corpo de texto)

**Assinatura visual da marca (já definida, aplicar ao site):** *"Textura + luz real + cor sazonal + calma visual"*. Na prática, para a vitrine: fotografia/imagens reais (não ilustração genérica), calma editorial, generoso espaço em branco, cor emocional trocando por categoria.

### ⚠️ Pendência técnica — fonte Gliker
No próprio arquivo do Brand Master, a fonte Gliker aparece com fallback `Georgia, serif` — sinal de que não está carregada via CDN público (provavelmente licenciada, ex: comprada num marketplace de fontes ou incluída num plano do Canva/Adobe Fonts). Antes do Claude Code montar o site:
1. Confirmar se a licença da Gliker permite uso web (self-hosted @font-face) — verificar termos do fornecedor.
2. Se sim: hospedar o arquivo da fonte no próprio repositório (arquivo `.woff2`) e usar `@font-face`.
3. Se não: escolher uma substituta de peso editorial semelhante (ex: Fraunces, usada neste documento como placeholder) e formalizar a troca no Brand Master.

---

## 5.2 Fluxo de entrega automática + e-mail

### E-mail profissional (uso humano — ler/responder mensagens)
`contato@[seudominio]` via **Cloudflare Email Routing + Gmail "Enviar como"** — gratuito, recebe e envia direto do Gmail que já usa, sem caixa nova.

### E-mail transacional (entrega automática do produto após compra)
```
Cliente paga (Stripe Payment Link)
        ↓ webhook "checkout.session.completed"
Cloudflare Worker (gratuito, 100k req/dia)
        ↓ chama API
Brevo (gratuito, 300 e-mails/dia, API transacional + webhooks sem validade)
        ↓
E-mail automático saindo de contato@[seudominio] com link de download
```

**Configuração necessária:** registros DKIM da Brevo adicionados ao DNS do Cloudflare (senão o e-mail sai como `@brevosend.com`, não com o domínio próprio). Passo técnico simples, mas não pular — afeta a credibilidade do e-mail transacional.

**Atenção:** o link de download enviado por e-mail deve ter alguma forma de expiração ou não-listagem pública (ex: hospedado num bucket privado / URL não indexada), já que um link direto simples pode ser compartilhado indefinidamente após a primeira compra.

---

## 6. Decisões em aberto (resolver antes de começar a construir)

1. **Gumroad:** manter o link atual como está, ou migrar o produto pro Stripe Payment Link pra reduzir taxa? (Gumroad cobre hospedagem + entrega de arquivo automaticamente; Stripe Payment Link puro não entrega arquivo — precisa de uma solução de entrega, ex: link de download que expira, ou serviço tipo Stripe + e-mail automático via Zapier/Make.)
2. **Entrega do arquivo pós-compra:** Stripe Payment Link redireciona pra uma página de sucesso — essa página pode conter o link de download direto (simples, mas o link pode ser compartilhado depois da compra) ou algo mais robusto (e-mail automático com link único). Para o volume inicial, a opção simples é suficiente.
3. ~~Identidade visual~~ — **resolvido:** ver seção 5.1, extraída do Brand Master real. Pendência restante: licença web da fonte Gliker.
4. **Idioma do site:** só em português (BR), só em francês, ou os dois? Isso afeta se as mentions légales/CGV precisam estar em francês (obrigatório se o público-alvo majoritário for residente na França) mesmo que o conteúdo editorial seja em português.

---

## Apêndice A — Prompt para o Claude Design

Prompt pronto para colar no Claude Design, gerar mockups de alta fidelidade das telas do site antes da construção via Claude Code. Já inclui a identidade real (seção 5.1), o sitemap (seção 4) e os requisitos legais visuais (checkbox de renúncia, etiquetas de divulgação).

```
PROMPT PARA CLAUDE DESIGN — Vitrine "Por Dentro"

Contexto do projeto:
Site institucional/vitrine de vendas para o "Por Dentro", projeto de conteúdo de uma
criadora brasileira vivendo na França, voltado a brasileiros na França. O site tem 3
categorias de produto + páginas legais. Quero mockups de alta fidelidade das
telas principais, prontos para servir de referência visual para desenvolvimento
(o código será feito depois via Claude Code, HTML leve, sem framework).

IDENTIDADE DE MARCA (usar exatamente estes valores — já são a marca real, não inventar):

Paleta base (fixa em todo o site):
- Off-White #F4F1EC — fundo principal
- Grafite Profundo #2B2B2B — textos, títulos, estrutura
- Ouro Queimado #BB9351 — cor de raridade: usar em NO MÁXIMO 1 elemento por tela
  (ex: um CTA de destaque ou o preço), nunca decorativo, nunca repetido várias vezes

Regra fixa de cor (não pode ser quebrada): máximo 3 cores por peça visual —
as 2 cores base acima + 1 cor emocional abaixo, escolhida por categoria:
- Produtos digitais → Verde Moss #577328 (estabilidade, confiança)
- Produtos de estudo → Placid Blue #8AACD2 (didático, acessível)
- Produtos de compras → Beje Paris #DEB975 (identidade emocional, Paris real)
(Outras cores emocionais existentes na marca, usar só se fizer sentido pontual:
Verde Esmeralda #063B35, Merlot #501318, Downtown Brown #604034)

Tipografia (máximo 2 fontes por peça):
- Display/impacto: Gliker (se não disponível no Claude Design, usar Fraunces como
  substituta temporária de peso editorial semelhante)
- Estrutura (títulos de card, preços, navegação): Inter Bold
- Leitura (descrições, corpo de texto): Inter Regular

Assinatura visual da marca: "Textura + luz real + cor sazonal + calma visual".
Priorizar fotografia real (não ilustração genérica/3D), calma editorial, espaço
em branco generoso, tom caloroso mas sóbrio — nada de clickbait visual.

SITEMAP — telas a desenhar:
1. Home — hub com 3 blocos grandes levando às 3 categorias abaixo
2. /produtos-digitais — grade de cards de templates (Excel/Notion), cor emocional
   Verde Moss, cada card com preço e botão de compra
3. /produtos-de-estudo — grade de cards de indicação (livros de francês, papelaria),
   cor emocional Placid Blue, CADA card precisa de uma etiqueta visível "Publicité"
   (fundo Merlot #501318, texto branco) — é exigência legal francesa, não pode
   estar escondida ou só no rodapé
4. /produtos-de-compras — mesma lógica da tela 3, cor emocional Beje Paris, mesma
   etiqueta "Publicité" obrigatória em cada card
5. /sobre — página simples sobre a criadora do Por Dentro

ELEMENTOS QUE PRECISAM APARECER NOS MOCKUPS DAS TELAS DE PRODUTO DIGITAL:
- Antes do botão de compra, uma checkbox (desmarcada por padrão) com o texto:
  "Entendo que o acesso ao arquivo é imediato e renuncio ao meu direito de
  retratação de 14 dias." — o botão de compra deve parecer desabilitado/esmaecido
  até essa checkbox ser marcada (é exigência legal, mostrar esse estado nos 2 mockups:
  checkbox desmarcada com botão esmaecido, e checkbox marcada com botão ativo)

UI-KIT a incluir num quadro de componentes:
- Botão primário (cor emocional da categoria), botão secundário (contorno,
  Downtown Brown #604034)
- Etiqueta "Publicité" (fundo Merlot, texto branco)
- Etiqueta "Lien affilié" (contorno Placid Blue)
- Card de produto digital (preço em Ouro Queimado) e card de afiliado (com etiqueta)

FORMATO DE ENTREGA:
Mockups de alta fidelidade, desktop e mobile, das 5 telas do sitemap + 1 quadro de
UI-kit isolado. Fiel à paleta e regra de 3 cores em cada tela — nunca mais de 3
cores por peça, e Ouro Queimado aparecendo no máximo 1 vez por tela.
```

---

## 7. Checklist de handoff pro Claude Code

- [ ] Confirmar decisões da seção 6
- [ ] Criar conta Stripe e gerar os Payment Links dos produtos
- [ ] Rodar o prompt do Apêndice A no Claude Design para gerar os mockups antes de codar
- [ ] Construir estrutura de arquivos estáticos (HTML/CSS/JS), seguindo a paleta e regra de cores da seção 5.1
- [ ] Implementar gate de renúncia ao direito de retratação (JS client-side)
- [ ] Escrever mentions légales, CGV, e política de privacidade (com base nas seções 3.4–3.6)
- [ ] Adicionar selos de divulgação em todos os links de afiliado
- [ ] Configurar domínio no Cloudflare apontando pro GitHub Pages
- [ ] Configurar Cloudflare Email Routing + Gmail "Enviar como" para contato@[domínio]
- [ ] Criar conta Brevo, configurar DKIM no DNS do Cloudflare
- [ ] Criar Cloudflare Worker que recebe webhook do Stripe e chama a API da Brevo
- [ ] Decidir onde hospedar os arquivos de download de forma segura (não indexável publicamente)
- [ ] Resolver a pendência da fonte Gliker (licença web ou substituta oficial) antes de codar
- [ ] Aplicar paleta real (seção 5.1) com a cor emocional correta por categoria
- [ ] Testar em mobile antes de divulgar
