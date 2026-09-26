> **Nota de sincronização (26/09/2026):** este manual descreve a árvore como planejada até 15/09. O código que está de fato no ar (`assistente-de-vistos/index.html`) evoluiu em duas direções depois disso que este documento ainda não reflete:
> 1. **Foi ao ar, mas não está aqui:** a pergunta "qual visto você já tem hoje" (`vistoAtual`), feita só pra quem já está na França — ela é o que hoje decide o caso especial de au pair migrando pra estudante, no lugar do texto da seção 4.1 abaixo. Foi ao ar também uma exclusão: quem já mora na França e quer Visto Estudante com outro visto atual (que não seja au pair) não recebe mais o CTA do Por Dentro.
> 2. **Está aqui, mas não foi ao ar:** a pergunta de "Prontidão" (seção 2) e o desfecho C (seção 4) — a versão em produção hoje não pergunta prontidão e não faz esse split; existe só um desfecho B genérico. Parece ter sido implementada numa sessão local que nunca chegou a ser commitada — a tarefa "Testar a pergunta de prontidão com usuários reais" segue em aberto no Notion.
>
> Antes de usar este manual pra alterar o código, confira `assistente-de-vistos/index.html` direto — ele é a fonte de verdade de comportamento; este documento é a fonte de verdade do *raciocínio*.

# Manual do Quiz de Vistos

*Documento de referência — arquitetura do quiz de triagem para o link na bio. Última atualização: 15 de setembro de 2026 (removido o guia pago avulso; Por Dentro entra como CTA principal dos desfechos B e C — seção 4).*

## 1. Para que serve isso

O bot não é o produto. É a ferramenta de autoridade e triagem que qualifica cada seguidor e o direciona pro lugar certo: conteúdo gratuito (quando a pessoa já sabe o que quer e só precisa de informação), o preview do **Por Dentro** — checklist com prazos e acompanhamento contínuo (quando ela sabe o tipo de visto e quer ajuda estruturada pra não perder prazo) — ou consultoria 1:1 paga (quando ela já tentou e travou, ou está tão perdida que precisa de orientação individual). Não existe mais um guia pago avulso vendido no marketplace — essa etapa foi removida (decisão de 15/09) em favor de direcionar esse mesmo público pro produto principal.

A árvore completa está no diagrama que acompanha este documento. Aqui vai o raciocínio por trás de cada decisão, o catálogo de vistos com as fontes, e os pontos ainda em aberto.

## 2. A árvore, passo a passo

**Gate 0 — Cidadania da UE.** Pergunta feita antes de qualquer outra coisa. Quem já tem passaporte europeu (por ascendência italiana, portuguesa, espanhola etc.) não precisa de visto nenhum — toda a lógica de vistos que vem a seguir é irrelevante pra essa pessoa. Ela pula direto para um conteúdo próprio sobre mercado de trabalho e contratação de alternância sem a camada de imigração.

**Idade — abaixo de 30 ou 30 e mais.** Não bifurca a árvore sozinha, mas filtra o que aparece mais adiante: o Vacances-Travail (PVT) só existe para quem tem entre 18 e 30 anos, e o contrato de apprentissage tradicional francês tem teto de 29 anos (com exceções). O Visto Estudante não tem limite de idade (seção 3), então continua disponível pra qualquer faixa etária no braço Estudar. A idade é registrada e usada como filtro, não como uma pergunta que gera um ramo próprio.

**Já está na França? Sim / Não.** Também não bifurca — ajusta o texto do resultado final entre "aqui está o que fazer para validar o visto que você já tem" e "aqui está o que fazer para pedir esse visto".

**Objetivo — a primeira bifurcação real, com 4 respostas.**
- Estudar
- Trabalhar
- Estar com cônjuge ou filho(a) francês(a) ou da UE (Família)
- Acompanhar alguém que já está na França (relacionamento ainda não oficializado)

O quarto braço não existia na primeira versão da árvore — apareceu depois de ler mensagens reais (seção 5).

**Tipo específico — a segunda bifurcação, dentro de Estudar / Trabalhar / Família.** Cada um mostra de 3 a 5 opções, sempre incluindo "não sei ainda" como saída para quem não faz ideia de qual categoria se aplica a ele. O braço Estudar tem uma exclusão: "Alternância" não aparece mais como botão separado — não é um visto próprio (seção 3), então a informação foi embutida na resposta de Visto Estudante, que é o caminho de fato pra chegar lá. O braço Família tem uma exclusão deliberada (seção 6) e, desde 21/08, uma inclusão: "Cônjuge de cidadão(ã) da UE (não francês)" aparece como opção separada de "Cônjuge de francês(a)", porque são dois regimes jurídicos diferentes com requisitos bem diferentes (seção 3) — juntar os dois embaixo de "cônjuge francês" estaria dando informação errada pra quem casou com, por exemplo, um português ou italiano. O braço Acompanhar alguém não tem sub-lista — vai direto para um conteúdo dedicado, porque não existe um "visto de namorado".

**Prontidão — a pergunta que faltava até a sessão de hoje.** Só é feita para quem escolheu um tipo específico (não para quem escolheu "não sei ainda"): *você está começando a pesquisar, ou já tentou e não está conseguindo?* Isso separa duas dores muito diferentes que a primeira versão da árvore misturava numa só.

**Captura — nome, WhatsApp e @Instagram.** Ponto único de convergência: todo mundo passa por aqui, incluindo quem veio pelos dois desvios (UE e Acompanhar alguém). Acontece depois de a pessoa já ter conversado um pouco (investimento suficiente pra não sentir como barreira) e antes de qualquer resultado ser revelado — a tela funciona como "sua recomendação está pronta, deixe seu contato pra ver o que separei pra você". O contato é o preço de ver a resposta personalizada, não uma etapa de cadastro. Confirmado nos prints da própria página da Letícia Vaz em 21/08: o campo é WhatsApp, não e-mail — faz sentido pro público dela e pro seu, já que é onde a conversa de verdade (e a venda) acontece depois.

**Resultado — 5 desfechos possíveis**, detalhados na seção 4.

## 3. Catálogo de vistos e pré-requisitos

Resumo dos tipos de visto que efetivamente trazem brasileiros pra França, levantado via pesquisa em fontes oficiais e especializadas em agosto de 2026. Use isso como ponto de partida para escrever o texto de cada resultado — vale confirmar valores e prazos direto nas fontes antes de publicar, porque essas regras mudam.

**Visto de Estudante (VLS-TS Étudiant).** Via Campus France, obrigatório para cursos com mais de 90 dias. Permite trabalhar até 60% da carga horária legal. Precisa ser validado pelo OFII em até 3 meses após a chegada. Sem limite de idade.

**Vacances-Travail / PVT (férias-trabalho).** Só entre 18 e 30 anos. Cota de aproximadamente 500 vagas por ano para brasileiros, distribuídas entre os consulados — costuma esgotar rápido, principalmente no segundo semestre. Só pode ser usado uma vez na vida, não é renovável e não se converte em outro tipo de visto. Exige cerca de €2.500 em conta, seguro saúde para os 12 meses, atestado de antecedentes criminais e passaporte com pelo menos 15 meses de validade.

**Alternância (contrato de apprentissage).** Não é um visto próprio — é uma atividade feita tendo um visto de estudante (ou outro título de residência) mais uma Autorização Provisória de Trabalho (APT). Para estrangeiro extra-UE, a regra geral exige ter completado 1 ano de formação inicial na França antes de assinar o contrato, exceto para mestrado ou grande école, que permite começar direto. O contrato de apprentissage em si tem teto tradicional de 29 anos, com exceções (deficiência, criação de empresa, entre outras). Por não ser um visto separado, não aparece mais como botão próprio no quiz (removido em 21/08) — essa explicação está embutida na resposta de Visto Estudante, que é o caminho real pra chegar lá.

**Passeport Talent — pesquisador/doutorado.** Para doutorandos, pesquisadores e professores-pesquisadores. Exige diploma de mestrado e, na maioria dos casos, uma convenção de acolhimento com a instituição. Sem limite de idade encontrado nas fontes consultadas.

**Recherche d'emploi / création d'entreprise.** Para quem já terminou um diploma na França e quer permanecer procurando emprego ou abrindo um negócio. Segmento pouco coberto por criadores de conteúdo, mas relevante para quem já passou pela fase de estudante.

**Salarié (trabalho assalariado).** Para quem já tem contrato de trabalho fechado com empregador francês.

**Vie Privée et Familiale (VPF).** Título de residência por vínculo pessoal, não por estudo ou trabalho. Principais categorias: cônjuge de francês(a) (casamento válido + vida em comum comprovada — aluguel, contas conjuntas; ~350€ de taxas; teste de francês A2 e, desde janeiro de 2026, exame cívico), pai/mãe de filho(a) francês(a) menor (filiação estabelecida + contribuição efetiva ao sustento), vínculo pessoal e familiar por residência de longa data (na prática, entre 5 e 10 anos), e duas categorias de proteção — estrangeiro doente e vítima de violência conjugal — que ficam de fora do quiz (seção 6). Sem limite de idade em nenhuma das categorias.

**Cônjuge de cidadão(ã) da UE, não francês (carte de séjour "membre de famille d'un citoyen de l'Union").** Regime diferente da VPF acima, e mais vantajoso — mas só se aplica quando o cônjuge tem cidadania de outro país da UE/EEE (portuguesa, italiana, espanhola etc.), não francesa. Base legal: art. L233-1 do CESEDA, transpondo a Diretiva 2004/38/CE (livre circulação), não o casamento com um francês em si. Diferenças concretas em relação à VPF: emissão gratuita (a VPF custa a partir de ~350€), sem exigência de teste de francês nem de exame cívico, validade inicial de 5 anos. O cônjuge europeu precisa comprovar que exerce o direito de residência na França (trabalho, estudo ou recursos próprios suficientes). Ponto em aberto entre as fontes: uma delas (info-droits-etrangers.org) afirma que, pela Diretiva 2004/38/CE art. 5(2), ainda é exigido um visto de longa duração antes da entrada — mas esse visto também deve ser emitido de graça e em regime acelerado; a outra (demarchesetrangers.fr) sugere que a entrada como turista já basta na prática. Vale confirmar no consulado antes de afirmar isso com confiança total no conteúdo. Sem limite de idade.

### Fontes consultadas

- [Campus France Brasil — Como solicitar seu visto de estudante](https://www.bresil.campusfrance.org/como-solicitar-seu-visto-de-estudante)
- [Campus France Brasil — Quem precisa de visto de estudante](https://www.bresil.campusfrance.org/quem-precisa-visto-estudante)
- [Dicas de Paris — Visto Férias-Trabalho da França: Guia Completo](https://dicaparis.com/dicas/visto-ferias-trabalho-da-franca/)
- [Lexora Europe — Visto "Vacances-Travail" França–Brasil](https://lexoraeurope.com/franca/motivos-pessoais/visto-vacances-travail-franca-brasil)
- [Alternance Professionnelle — L'apprentissage pour les étudiants étrangers](https://www.alternance-professionnelle.fr/apprentissage-etudiants-etrangers/)
- [Campus France — The researcher-talent passport long-stay visa](https://www.campusfrance.org/en/the-researcher-talent-passport-long-stay-visa)
- [France-Visas — Brésil](https://france-visas.gouv.fr/en/bresil)
- [Opco EP — Jusqu'à quel âge peut-on conclure un contrat d'apprentissage?](https://www.opcoep.fr/question-formation/se-former-en-alternance/contrat-d-apprentissage/jusqu-a-quel-age-peut-conclure-un-contrat-d-apprentissage)
- [Démarches Étrangers — Carte séjour Vie Privée et Familiale](https://demarchesetrangers.fr/titre-de-sejour/carte-sejour-vie-privee-familiale)
- [Démarches Étrangers — Conjoint, membre de famille d'un citoyen de l'UE](https://demarchesetrangers.fr/titre-de-sejour/conjoint-membre-famille-citoyen-ue)
- [Info Droits Étrangers — Les ressortissants européens et les membres de leur famille](https://www.info-droits-etrangers.org/sejourner-en-france/les-statuts-particuliers/les-ressortissants-europeens-et-les-membres-de-leur-famille/)

## 4. Os cinco desfechos e a lógica de monetização

| Desfecho | Quem chega ali | O que recebe | Modelo |
|---|---|---|---|
| **D — Cidadão da UE** | Gate 0 = Sim | Conteúdo de mercado de trabalho e alternância sem burocracia de visto, com pergunta única (grátis) ou 1:1 (pago) como saídas | Grátis por padrão — constrói autoridade num público que ela também atende mas que a árvore de vistos ignorava |
| **A — "Não sei ainda"** | Escolheu essa opção em qualquer tipo de visto | Duas saídas com popup: escreve o motivo e manda por pergunta única (grátis) ou marca 1:1 (pago) | Consultoria paga (20€/30min) **ou** pergunta única com resposta em até 3 dias úteis, à escolha da pessoa |
| **B — Sabe o tipo, começando** | Tipo específico + "começando a pesquisar" | Pré-requisitos completos daquele visto + convite pro preview do Por Dentro (checklist com prazos), com pergunta única ou 1:1 como alternativas secundárias | Grátis, com o Por Dentro como CTA principal — quando o tipo de visto tem persona equivalente (seção 4.1) |
| **C — Sabe o tipo, travou** | Tipo específico + "já tentei e não deu certo" | O botão de marcar 1:1 vem em destaque (primeiro); o preview do Por Dentro aparece logo depois; a pergunta única gratuita fica por último, mas não escondida | Pago (1:1) é o CTA principal — é o segmento de maior intenção de compra de toda a árvore |
| **E — Acompanhar alguém** | Objetivo = Acompanhar alguém | Guia dos caminhos reais quando não há vínculo formal ainda, incluindo o alerta sobre o mito do turismo prolongado, com pergunta única ou 1:1 como saídas | Grátis por padrão — autoridade |

Todo desfecho, portanto, termina nos mesmos dois botões — **pergunta única** (abre um popup pra descrever a situação e a dúvida, manda por WhatsApp, resposta em até 3 dias úteis) e **quero fazer um 1:1** (abre um popup pra escrever o motivo, manda pro Cal.com com isso já preenchido nas notas do agendamento) — o que muda de um desfecho pro outro é qual dos dois vem em destaque (a ordem, a cor do botão) e, nos casos de B e C onde existe persona equivalente, um botão a mais pro preview do Por Dentro (seção 4.1).

O ponto central: **"achado" não é uma coisa só.** A primeira versão da árvore tratava "sabe o tipo de visto" como sinal único de estar pronto pra conteúdo gratuito. As mensagens reais (seção 5) mostraram que tem gente que sabe exatamente o que quer e está travada há meses tentando sozinha — essa pessoa já pagaria por ajuda, não precisa de mais um artigo. Por isso a pergunta de prontidão existe: ela separa "sei o que quero e estou pesquisando" (B, o Por Dentro é o CTA principal) de "sei o que quero e não estou conseguindo" (C, o 1:1 é o CTA principal, com o Por Dentro como alternativa forte logo ao lado) — em ambos os casos, os botões padrão continuam disponíveis.

## 4.1 Handoff pro Por Dentro (removido: guia pago avulso)

Decisão de 15/09: não existe mais um guia pago vendido separadamente no marketplace. No lugar dele, os desfechos B e C linkam pro preview de validação do **Por Dentro** — o SaaS de checklist com prazos e 1:1 contínuo, que é o produto de verdade por trás dessa oferta.

**Mapa de tipo de visto → persona do Por Dentro** (`MAP_TIPO_PARA_PERSONA` no código):

| Tipo de visto (Assistente de Vistos) | Persona (Por Dentro) |
|---|---|
| Au-pair | au_pair_estudante — **ver nota de sincronização no topo:** no código em produção isso não é uma linha direta do mapa; é um caso especial via `vistoAtual === 'Au-pair'`, porque o mapa genérico hoje exclui Au-pair de propósito (a Ingryd não atende quem ainda QUER virar au pair) |
| Visto Estudante | campus_france |
| Vacances-Travail (PVT) | pvt |
| Assalariado | alternancia_emprego |
| Busca de emprego / negócio | alternancia_emprego |
| Cônjuge de francês(a) | conjuge |
| Cônjuge de cidadão(ã) da UE (não francês) | conjuge |

**Sem persona equivalente ainda:** Passeport Talent (pesquisa/doutorado), Pai/mãe de filho(a) francês(a), Residência de longa data. Pra esses tipos, o botão do Por Dentro simplesmente não aparece — B e C continuam funcionando normalmente com pergunta única e 1:1. Se esses tipos aparecerem com frequência na planilha de insights, é sinal de próxima persona a construir no Por Dentro.

**Personalização sem perguntar de novo.** O link pro Por Dentro carrega `?persona=X&origem=assistente_vistos` e, quando dá pra inferir com confiança, também `&fase=Y&worry=Z` — sem acrescentar nenhuma pergunta nova ao quiz:

- **fase**: `jaEsta = Não` → planejando · `jaEsta = Sim` + `prontidao = já tentei e não deu certo` → urgente · `jaEsta = Sim` + `prontidao = começando agora` → adaptando
- **worry**: `prontidao = já tentei e não deu certo` → "sozinha" · `prontidao = começando agora` → "não sei por onde começar"

Do lado do Por Dentro, cada parâmetro presente pula a pergunta correspondente — quem vem do bot com persona + fase + worry já resolvidos só precisa digitar o nome pra ver o checklist. Uma pergunta nova entrou *no próprio Por Dentro* (não aqui no bot) pra cobrir o único caso ambíguo que a inferência acima não resolve: quem respondeu "já estou na França, me adaptando" sem vir do bot (ou vindo do bot sem esse dado) recebe uma pergunta direta — "seu prazo atual tá vencendo em breve?" — porque "adaptando" sozinho não diz se a pessoa tem um prazo rodando sem perceber.

## 5. O que as mensagens reais mudaram na árvore

Cinco conversas do Instagram, lidas na sessão de brainstorm, mudaram a arquitetura em pontos concretos:

**Blan3s** — cidadão espanhol morando em Barcelona, pergunta sobre timing de contratação de alternância. Não precisa de visto nenhum. Revelou que a árvore inteira partia de uma premissa que não cobre todo mundo que manda mensagem — daí o Gate 0.

**Lucas** e **Rodrigo** — namorando (não casados, sem PACS) alguém que está ou vai para a França, tentando decidir entre mestrado, trabalho ou até turismo prolongado. Não cabiam em Estudar, Trabalhar nem Família — motivador emocional, caminho prático emprestado dos outros ramos. Deram origem ao objetivo "Acompanhar alguém". Rodrigo especificamente mencionou considerar ir como turista e "organizar o visto depois, já estando lá" — isso quase sempre não funciona (não dá pra regularizar vindo como turista Schengen) e virou um alerta obrigatório no conteúdo desse ramo.

**Arthur** e **Juliana** — os dois sabem exatamente o que querem (alternância) e estão travados: Arthur com um problema de custo (~€8.500/ano pro M2) tentando resolver via alternância; Juliana meses sem ser chamada pra entrevista, desanimada, se perguntando se é a idade (30+), a profissão ou a região. Nenhum dos dois precisa de mais informação genérica sobre "como funciona a alternância" — precisam de ajuda com a própria situação travada. Deram origem à pergunta de prontidão e ao desfecho C.

## 6. O que ficou de fora, de propósito

Duas subcategorias do Vie Privée et Familiale — estrangeiro doente (patologia grave sem tratamento no país de origem) e vítima de violência conjugal — não aparecem como botões no quiz. São situações de crise e proteção jurídica, não personas de produto. Colocar isso ao lado de "cônjuge de francês" misturaria um funil comercial com uma situação que pede encaminhamento a apoio de verdade, não um CTA de consultoria ou uma espera de 3 dias úteis. Decisão tomada e confirmada na sessão de 21/08.

## 7. Por que Família/VPF é o pilar estratégico

Comparado a Estudante e Parcoursup — onde já existe muita gente criando conteúdo — Família/Vida Privada e Familiar tem pouca cobertura. Menos concorrência de conteúdo aqui significa menos concorrência de confiança: quem casou com francês ou teve filho francês não quer um checklist genérico, quer alguém que já viu esse caso de perto, e a barra pra ser essa referência está baixa.

Decisão em aberto: se esse braço vai carregar mais peso de conteúdo (Reels, artigos, produtos) do que os outros três juntos, ou seguir com peso igual por enquanto até validar demanda.

## 8. Riscos e suposições a validar

**Demanda pagável em Família/VPF.** É o campo mais interessante e menos coberto, mas "casei com francês, e agora?" pode ser uma fase mais emocional do que financeira — vale ler os comentários e DMs que já chegam sobre esse tema antes de investir pesado em produto pago ali.

**Volume no braço "Acompanhar alguém".** Só duas mensagens reais (Lucas, Rodrigo) sustentam esse ramo até agora. Vale observar se aparece com frequência nas próximas semanas antes de escrever muito conteúdo específico pra ele.

**Onde exatamente capturar o "achado vs. travado".** A pergunta de prontidão é nova nesta sessão — ainda não foi testada com usuários reais. Vale um teste A/B ou pelo menos observar se as pessoas respondem com sinceridade a "você já tentou e não conseguiu" sem se sentirem constrangidas.

## 9. Próximos passos

1. Detalhar o que exatamente a consultoria de 20€/30min entrega, e acompanhar a taxa de clique no botão do Por Dentro por tipo de visto — é o teste real de qual segmento converte pro checklist pago vs. pro 1:1.
2. Escrever o conteúdo do desfecho E (Acompanhar alguém), priorizando o alerta sobre o mito do turismo.
3. Validar a hipótese de demanda pagável em Família conversando com quem já mandou mensagem sobre isso.
4. Confirmar datas, valores e prazos de cada visto direto nas fontes oficiais antes de publicar qualquer texto — essas regras mudam com frequência.
