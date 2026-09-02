# Estratégia de conteúdo e monetização — Por Dentro

Este documento organiza por escrito o plano que você descreveu nos stories de hoje (quarta, home office day): sair da superficialidade do Instagram, usar o site como porta de aprofundamento e, mais pra frente, monetizar por indicação — não por esconder informação. Não é um roteiro técnico (isso é o `GUIA-DE-IMPLEMENTACAO.md`) nem o manual de operar o site (`MANUAL-DE-GERENCIAMENTO.md`). É o "porquê" e o "em que ordem".

---

## 1. O que motivou a virada (contexto dos stories)

- Você vinha postando reel 2x/semana + posts informativos, com boa resposta — mas identificou um teto: Instagram é porta de entrada, não pode ser a informação final. Tem assunto que não cabe (ou ninguém quer abordar de forma estratégica) em 60 segundos de vídeo.
- Toda vez que você direciona pra uma página externa depois de um reel, tem gente pedindo essa página — sinal de demanda real por aprofundamento, não só por mais vídeo.
- Decisão: pausar o ritmo de postagem nas redes por um tempo pra construir o projeto (o site) que resolve isso de vez, em vez de empilhar mais conteúdo raso.
- Princípio que você deixou explícito e que vira critério de produto, não só discurso: **não esconder em palestra/e-book/aula paga informação que já está de graça na internet.** Quem cobra, cobra por profundidade, organização e direcionamento — não por acesso à informação básica.
- Outro ponto levantado nos stories, que já virou gancho de conteúdo próprio: VAE (validação de habilidades adquiridas) não serve pra profissão regulamentada por ordem/conselho (OAB, CRM, CRP e equivalentes na França) — o caminho de validação nesse caso é outro, e você já sinalizou que vai soltar conteúdo específico sobre isso (não hoje).

---

## 2. As duas fases

### Fase 1 — agora: o blog como hub de aprofundamento

Objetivo: todo reel/story vira porta de entrada; toda dúvida que "não cabe" no Instagram vira artigo em `/artigos/`. A pausa nas redes é pra dar tempo de popular esse acervo, não pra sumir.

O que já existe no site pra isso (não precisa construir):
- `/artigos/` com busca e filtro por categoria, `content/posts.json` editável pelo `/admin` sem precisar de git.
- Artigos premium (assinatura ou compra avulsa via Stripe) — pra quando fizer sentido cobrar por aprofundamento *extra*, mantendo a base gratuita. Isso já é coerente com o princípio da seção 1: a prévia grátis nunca desaparece.
- Cross-promoção pronta entre blog e vitrine: `content/banners.json` já linka posts específicos (ex. "Tudo sobre o Exame Cívico", "Como organizar toda sua burocracia") às categorias de produto correspondentes.

O que falta decidir, não construir:
- Ritmo de publicação de artigos durante a pausa das redes (pra não ficar sem novidade nenhuma nos dois canais ao mesmo tempo).
- Lista de "dívidas de conteúdo" — os temas que você prometeu nos stories (VAE para profissões regulamentadas é o primeiro) viram artigos, não só a próxima postagem solta.

### Fase 2 — depois de captar métrica: indicação de ferramentas, produtos e serviços

Objetivo: usar o que os dados mostrarem sobre a audiência (quais artigos convertem, o que ela busca, onde trava) pra decidir *o que* indicar e pra *quem*, em vez de indicar por indicar.

O que já existe no site pra isso (mecanismo pronto, falta só ativar/preencher quando fizer sentido):
- **Métrica já instrumentada**: GA4 (`content/analytics-config.json`) + Microsoft Clarity, com banner de consentimento — dá pra ver o que engaja antes de montar qualquer pitch.
- **Afiliação já prevista em dois canais**: `produtos-de-estudo` e `produtos-de-compras` (indicações afiliadas — livros, papelaria, itens de estilo de vida) e um `gygPartnerId` de GetYourGuide já configurado em analytics — ou seja, o esqueleto de indicação por comissão já existe, só falta popular com o que sua audiência de fato precisa.
- **Produto próprio**: `produtos-digitais/` (templates como a planilha financeira) — o outro braço da monetização, vendido direto via Stripe, sem intermediário.
- **Espaço de patrocínio/anúncio próprio**: `content/ads-config.json` já tem posições reservadas (topo, meio, antes do paywall) pra banner próprio ou rede de anúncio — hoje desligado (`enabled: false`), pronto pra ligar quando fizer sentido.

O que falta decidir, não construir:
- Critério de corte pra "captei métrica suficiente" — sugestão: um número mínimo de artigos publicados com tráfego orgânico estável (não só de story) antes de montar o primeiro pitch de indicação, pra indicar com base em comportamento real e não em achismo.
- Critério de quem entra na lista de indicação: você mesma mencionou nos stories que já tem gente pedindo pra ser indicada — vale meta explícita de "o que essa ferramenta/serviço precisa comprovar" antes de entrar no site, pra manter a mesma barra de confiança que motivou a pausa nas redes.

---

## 3. Princípio de tom que atravessa as duas fases

Você resumiu isso nos stories: a rede que você quer construir (leitoras + pessoas que pedem indicação) **não deveria custar mais do que a imigração já custa**. Isso é um critério prático, não só um valor:
- Informação básica: sempre grátis no blog.
- Cobrança (premium, produto próprio, indicação paga): sempre em cima de profundidade, organização ou economia de tempo/risco — nunca em cima de reter o básico.
- Indicação de terceiro (afiliado/patrocínio): só entra depois que a métrica mostrar que resolve um problema real da audiência, não porque alguém pediu pra ser indicado.

---

## 4. Próximos passos concretos

1. Transformar a lista de "prometi conteúdo sobre X nos stories" em fila de artigos — primeiro item: VAE x profissões regulamentadas (OAB/CRM/CRP e equivalente francês).
2. Definir o ritmo mínimo de publicação em `/artigos/` durante a pausa das redes, pra manter a promessa de "porta de entrada sempre tem pra onde levar".
3. Quando o volume de artigos publicados estiver estável: primeira leitura de GA4/Clarity focada em quais posts geram mais permanência/retorno — isso vira a base do primeiro pitch de indicação (fase 2), não o ponto de partida.
4. Só depois disso, revisitar `produtos-de-estudo.json` / `produtos-de-compras.json` e decidir as primeiras indicações com base no que a métrica mostrou, e responder às pessoas que já pediram pra ser indicadas com esse critério em mãos.
