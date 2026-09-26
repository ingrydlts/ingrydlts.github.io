> **Nota de sincronização (26/09/2026):** este guia recomenda registrar o funil via `insightsUrl` / Google Apps Script (`insights-apps-script.gs` — arquivo ainda não localizado em nenhum repositório ou sessão). Desde então, o site ganhou um sistema de analytics próprio, `window.PDEvents` (`assets/js/events.js`), que já registra os eventos do bot (`showStep`/`answer`) direto num banco D1 via Worker, **respeitando o consentimento** (`window.PDConsent`) antes de enviar qualquer coisa — o que a rota do Apps Script, do jeito descrito aqui, não faz. Antes de implementar o Apps Script como este guia recomenda, vale decidir com a Ingryd se ele ainda é necessário (ex.: visão rápida em planilha) ou se ficou substituído pelo PDEvents.

# Guia de Implementação do Bot

*Passo a passo pra montar o link na bio com o quiz de triagem por conta própria, sem assinar o LinkCommerce — trocando uma ferramenta única por um punhado de peças gratuitas ou baratas, uma pra cada função que ele faria sozinho. Cada seção abaixo é uma etapa, na ordem em que dá pra executar.*

## Etapa 0 — As peças do quebra-cabeça

O LinkCommerce empacotava seis funções num só produto. Fazendo por conta própria, cada uma vira uma ferramenta separada — a maioria gratuita, ou paga só quando o volume justificar.

| Função | O que o LinkCommerce fazia sozinho | Ferramenta recomendada | Custo |
|---|---|---|---|
| Hub / link na bio | Vitrine + perfil | [Carrd](https://carrd.co) (mais controle visual) ou Linktree (mais simples) | Grátis a ~US$19/ano |
| Quiz com lógica condicional | "IA concierge" conversando | [Typebot](https://typebot.io) | Grátis até 200 conversas/mês |
| Armazenamento com tags de segmento | CRM + webhook (só no plano Pro) | Google Sheets, conectado ao Typebot | Grátis |
| Calendário + pagamento pra reservar horário | Agenda + sincronização (só no plano Elite) | [Cal.com](https://cal.com) | Grátis, Stripe/PayPal nativos |
| Aviso de lead novo / resposta em 3 dias | "Aviso no seu WhatsApp" automático | Checagem manual da planilha, ou Make/Zapier se o volume crescer | Grátis a baixo custo |

*Não existe mais "checkout do guia pago" nesta lista — decisão de 15/09 foi não vender um guia avulso. Os desfechos B e C do quiz redirecionam pro preview do [Por Dentro](https://ingrydlts.github.io/checklist-preview/) (o produto de verdade, hospedado no próprio site) em vez disso — ver seção "Novidade" abaixo.*

Os detalhes de cada uma estão nas etapas abaixo, na ordem em que faz sentido configurar.

## Novidade — o quiz já está pronto, sem precisar do Typebot

Você perguntou se dava pra construir o quiz diretamente, em vez de montar no Typebot. Deu: o **[Assistente de Vistos](https://claude.ai/code/artifact/ad0ec047-2cbc-4ed3-a342-61d96ba3e2be)** é um arquivo único (HTML/CSS/JS, sem dependências externas) que já implementa a árvore inteira — Cidadania UE → Idade → Já está na França → Objetivo → Tipo de visto → Prontidão → os 5 desfechos (D/A/B/C/E) — com a mesma interface de bolhas de chat dos prints da Letícia Vaz.

Duas diferenças importantes em relação ao caminho Typebot descrito nas Etapas 2 a 5:

- **Captura de contato sem banco de dados.** Em vez de gravar numa planilha (Etapa 5), o botão final monta um link `wa.me` com o nome, o Instagram e todas as respostas da pessoa já escritos na mensagem — ela clica, o WhatsApp dela abre com tudo pronto, e envia direto pro seu número. Você recebe o lead e o contato de WhatsApp real na mesma mensagem, sem precisar configurar integração nenhuma.
- **Zero mensalidade e zero teto de 200 conversas/mês** — é uma página estática, funciona pra qualquer volume.

Antes de publicar, abra o arquivo e edite o objeto `CONFIG` no topo do código com o que é seu: o número de WhatsApp (formato internacional, sem símbolos), o link do seu Cal.com (Etapa 6 ainda vale pra criar esse link) e `porDentroUrl`, o link do preview de validação do Por Dentro — um link só, sem precisar organizar um por tipo de visto como seria com um guia pago. O resto do fluxo já está pronto, incluindo o mapa de qual tipo de visto libera o botão do Por Dentro (`MAP_TIPO_PARA_PERSONA`, direto no código).

**Funil completo pra entender a audiência.** Além do lead ir pro WhatsApp, o quiz agora também registra cada resposta (inclusive de quem abandona no meio) numa Google Sheet — é o que substitui a Etapa 5 abaixo. Cada sessão gera uma linha própria, que vai sendo atualizada resposta a resposta (idade, objetivo, tipo de visto, se chegou ou não num resultado, qual CTA final clicou), via um Google Apps Script gratuito (`insights-apps-script.gs`, na raiz do projeto). Instale-o seguindo os passos no topo do próprio arquivo e cole a URL do App da Web em `CONFIG.insightsUrl`. Enquanto esse campo ficar vazio, o quiz funciona normalmente e simplesmente não loga nada.

Isso substitui as Etapas 2, 3, 4 e 5 abaixo. Elas continuam aqui como referência — a lógica que elas descrevem é exatamente a lógica que já está implementada no Assistente de Vistos — e valem a pena ler se um dia você quiser reconstruir o quiz numa ferramenta visual (por exemplo, se quiser editar o texto das perguntas sem mexer em código, ou delegar isso pra alguém que não programa). Se seu plano é usar o Assistente de Vistos como está, pode pular direto pra Etapa 6.

## Etapa 1 — Preparar o conteúdo antes de abrir qualquer ferramenta

Antes de mexer em configuração, ter isso pronto (mesmo em rascunho) evita retrabalho:

- Texto de pré-requisitos de cada tipo de visto (o catálogo está no [Manual do Quiz de Vistos](https://claude.ai/code/artifact/8a38a069-02ea-43d8-a0b8-1c23c6277656) — dá pra copiar e adaptar o tom)
- O conteúdo do desfecho "Acompanhar alguém", incluindo o alerta sobre o mito do turismo prolongado
- O conteúdo do desfecho "Cidadão da UE" (mercado de trabalho e alternância sem burocracia de visto)
- A política da consultoria: o que está incluso nos 20€/30min, e como funciona a resposta gratuita em até 3 dias úteis

## Etapa 2 — Montar o quiz no Typebot (alternativa ao Assistente de Vistos pronto)

*Pule esta etapa se for usar o [Assistente de Vistos](https://claude.ai/code/artifact/ad0ec047-2cbc-4ed3-a342-61d96ba3e2be) da seção acima — a lógica abaixo já está implementada nele.*

O Typebot é a peça que substitui a "IA concierge" — ele monta a mesma experiência de bate-papo em bolhas que você viu nos prints da Letícia Vaz, com lógica condicional de verdade (é o motivo de existir da ferramenta, diferente do Tally ou Google Forms, que fazem lógica mas com cara de formulário). No editor visual, cada pergunta é um bloco, e cada resposta pode levar a um bloco diferente — é literalmente a árvore do [diagrama](https://claude.ai/code/artifact/581b9545-f7c0-42db-a926-a3f9dc219dd9) desenhada em blocos, na mesma ordem: cidadania → idade + já está na França → objetivo → tipo → prontidão (só pra quem escolheu um tipo específico).

Ponto de atenção real: o plano grátis tem teto de 200 conversas por mês. Se o quiz decolar, ou você paga (a partir de US$39/mês) ou migra a lógica pro Tally, que não tem teto mas perde o visual de chat. Vale começar no grátis e só decidir isso quando o volume pedir.

## Etapa 3 — Configurar as 5 respostas finais dentro do Typebot (alternativa)

*Também já resolvido no Assistente de Vistos — pule se for usar ele.*

Cada um dos 5 desfechos da árvore vira um bloco final diferente, com o texto e o botão certos:

| Desfecho | O que aparece no final da conversa |
|---|---|
| D — Cidadão da UE | Conteúdo/link de mercado de trabalho, sem botão de compra |
| A — Não sei ainda | Texto reconhecendo a situação + botão pro Cal.com (consultoria 20€) + opção de resposta em 3 dias úteis |
| B — Sabe o tipo, começando | Pré-requisitos daquele visto (texto direto no bloco) + botão pro preview do Por Dentro (checklist com prazos) |
| C — Sabe o tipo, travou | Botão pro Cal.com em destaque + botão pro preview do Por Dentro como alternativa |
| E — Acompanhar alguém | Conteúdo dedicado com o alerta do mito do turismo |

O Typebot permite blocos condicionais por combinação de respostas (não só a última pergunta) — isso resolve a maior incerteza que tinha ficado em aberto com o LinkCommerce, porque aqui você monta a lógica você mesma e vê exatamente o que está configurando.

## Etapa 4 — Configurar a captura de contato dentro da conversa (alternativa)

*No Assistente de Vistos isso já acontece via link do WhatsApp (ver seção "Novidade" acima) — pule se for usar ele.*

Reproduza a fórmula que já validamos nos prints: um bloco de texto tipo *"sua recomendação está pronta — deixe seu contato pra eu te mostrar o que separei"*, seguido de campos de nome, WhatsApp e @Instagram. Isso acontece depois da última pergunta de segmentação e antes do bloco de resultado (Etapa 3) — o contato é o preço de ver a resposta, não um cadastro solto.

## Etapa 5 — Conectar o Typebot a uma planilha do Google Sheets (alternativa)

*No Assistente de Vistos, o lead chega direto no seu WhatsApp e o histórico completo (inclusive de quem abandona no meio) já vai pra Google Sheet via `insights-apps-script.gs`, descrito na seção "Novidade" acima — pule esta etapa se for usar ele.*

Esse é o substituto do CRM + webhook que só existia no plano Pro do LinkCommerce. O Typebot tem integração nativa com Google Sheets: cada resposta do quiz — nome, WhatsApp, Instagram, e todas as respostas de segmentação (cidadania, idade, já está na França, objetivo, tipo, prontidão) — vira uma linha na planilha, uma coluna por pergunta. Essa planilha é a sua tag de segmento; é o que separa esse quiz de um formulário genérico.

## Etapa 6 — Montar a agenda paga no Cal.com

Cria uma conta grátis no Cal.com, conecta o Stripe (ou PayPal) e configura um tipo de evento de 30 minutos com preço de 20€. O Cal.com cobra na hora do agendamento — a pessoa escolhe o horário, paga, e só recebe a confirmação se o pagamento passar, exatamente como você queria com "página de pagamento pra reservar horário diretamente". É essa a peça que substitui a "agenda + sincronização de calendário" que só vinha no plano Elite (R$197/mês) do LinkCommerce, e sai de graça.

Copie o link desse evento pros botões dos desfechos A e C dentro do Typebot (Etapa 3).

## Etapa 7 — Montar o hub no Carrd (ou Linktree)

Essa é a peça que substitui a vitrine pronta do LinkCommerce. Uma página simples com: foto, bio, CTA de abertura pro quiz ("Responda 5 perguntas e descubra o caminho certo pra você ir pra França" — o mesmo formato que funcionou pra Letícia Vaz, adaptado), o link do quiz (o link do [Assistente de Vistos](https://claude.ai/code/artifact/ad0ec047-2cbc-4ed3-a342-61d96ba3e2be) publicado, ou do Typebot se optar pela alternativa), os ícones de redes sociais, e os 2-3 botões de WhatsApp segmentados da Etapa 8. O Carrd dá mais controle visual por um valor simbólico anual; o Linktree resolve mais rápido se a prioridade agora é velocidade.

## Etapa 8 — Configurar os botões de WhatsApp segmentados

Inspirado no exemplo da Letícia Vaz (ela separa "publicidade e palestras" de "suporte de curso"): monte 2-3 botões de WhatsApp fora do fluxo do quiz, pra quem quer falar direto sem passar pelas perguntas — por exemplo, "tenho uma dúvida rápida" e "já sou aluna/cliente". Isso evita que quem já te conhece tenha que reiniciar a triagem toda vez. Ficam no hub do Carrd/Linktree, ao lado do link do quiz.

## Etapa 9 — Testar a árvore inteira, ponta a ponta

Percorra cada um dos 5 caminhos principais (Estudar, Trabalhar, Família, Acompanhar alguém, Cidadão UE) como se fosse a seguidora, incluindo a variação "não sei ainda" dentro de Estudar/Trabalhar/Família. Confirme que cada combinação termina no desfecho certo, com o texto certo e os botões certos (1:1, pergunta única e, nos tipos com persona equivalente, o botão do Por Dentro), que o link do Cal.com realmente pede pagamento antes de confirmar o horário, que o botão do Por Dentro abre o preview já com o perfil certo pré-selecionado (confira também a fase e a preocupação, quando a inferência conseguir preenchê-las), e que o botão final do WhatsApp abre com a mensagem pré-preenchida corretamente, incluindo quando o campo Instagram é deixado em branco. Vale usar a [Árvore do Quiz de Vistos](https://claude.ai/code/artifact/581b9545-f7c0-42db-a926-a3f9dc219dd9) como checklist visual durante esse teste.

## Etapa 10 — Publicar e avisar a audiência

Coloque o link do Carrd/Linktree no lugar do link na bio atual, e anuncie nos Stories/Reels — o gancho mais natural é literalmente o comentário da lucianna.soares que começou essa conversa: alguém pedindo orientação de um jeito que hoje não tem resposta estruturada. Um Reels mostrando "eu criei uma ferramenta pra responder isso" tende a converter bem justamente porque nasce de uma dor real e recente.

## O que ainda vale confirmar na prática

- Se optar pelo Assistente de Vistos: editar o `CONFIG` no topo do código com número de WhatsApp, link do Cal.com, `porDentroUrl` e a URL do Apps Script (`insightsUrl`) antes de publicar — sem os dois primeiros os botões finais não funcionam; sem os dois últimos, só não aparece o botão do Por Dentro / só não registra o funil, respectivamente
- Se 200 conversas/mês no Typebot grátis aguenta o volume real (só relevante se usar o Typebot em vez do Assistente de Vistos) — só dá pra saber depois de publicar
- Se o Cal.com no plano grátis cobre o volume de agendamentos sem fricção, ou se compensa migrar pro plano pago mais cedo
- Se o processo manual de checar a planilha do Google Sheets pra responder o desfecho A dentro de 3 dias úteis é sustentável, ou se vale automatizar com Make/Zapier assim que o volume crescer
- Qual taxa de clique o botão do Por Dentro recebe nos desfechos B e C, comparado ao 1:1 — é o dado que confirma (ou não) que o bot funciona como funil de captura pro produto principal
