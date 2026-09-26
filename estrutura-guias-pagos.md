# Estrutura dos Guias Pagos — por tipo de visto

*Documento de planejamento editorial — o que cada guia pago precisa cobrir, com que profundidade, e quais fontes oficiais mantêm ele atualizado. Serve de referência tanto pra você escrever/revisar quanto pra automação semanal de monitoramento (ver seção final). Preparado em 25/08/2026.*

## 1. Por que este documento existe

O `CONFIG.guiaPago` do [Assistente de Vistos](assistente-de-vistos/index.html) hoje está vazio pros 9 tipos de visto — nenhum guia existe ainda no marketplace. Antes de escrever qualquer um, vale definir **o que cada guia precisa ter** pra justificar ser pago: não é o mesmo texto do resumo grátis do bot esticado, é o "e agora, passo a passo" que alguém paga pra não ter que garimpar em site de prefeitura francesa.

Padrão mínimo pra todo guia, sem exceção:

- **Fonte primária, não blog de terceiro.** Texto legal (CESEDA, decretos, diretivas), site oficial (France-Visas, Service-Public, Campus France, prefeitura) ou, na falta desses, uma fonte especializada citável — nunca um outro criador de conteúdo como fonte final.
- **Data de verificação visível no próprio guia** — não só "criado em", mas "última vez que confirmei que isso ainda é verdade em [data]". Regras de imigração mudam (o próprio Exame Cívico e o valor mínimo pro visto de estudante mudaram em 2026).
- **Ação, não só explicação.** Checklist de documentos, ordem dos passos, valores atualizados, onde exatamente clicar/ir — é isso que separa "guia pago" de "artigo grátis mais longo".
- **Erros comuns e o que fazer se travar** — o gancho de maior intenção de compra (desfecho C do bot) é justamente quem já tentou e não conseguiu. O guia precisa antecipar onde as pessoas travam.

## 2. Ordem de prioridade sugerida

| # | Guia | Por quê nessa posição |
|---|---|---|
| 1 | **Visto Estudante** | Maior volume de busca/demanda, e é o tipo com mais conteúdo já levantado (Campus France, OFII, alternância). Menor esforço pra sair do zero. |
| 2 | **Cônjuge de cidadão(ã) da UE (não francês)** | Nicho pouco coberto por outros criadores (a maioria só fala de "cônjuge de francês"), pesquisa jurídica já feita nesta sessão de brainstorm anterior — é só formatar em guia. Alta diferenciação. |
| 3 | **Vacances-Travail (PVT)** | Urgência real (cota de ~500 vagas/ano, esgota rápido) — quem procura isso decide rápido. Conteúdo-base já existe. |
| 4 | **Cônjuge de francês(a)** | Maior volume dentro do braço Família/VPF (seção 7 do manual do quiz aponta esse braço como pilar estratégico, pouco coberto). |
| 5 | **Pai/mãe de filho(a) francês(a)** | Mesmo pilar Família/VPF, público menor que cônjuge mas ainda pouco atendido por conteúdo existente. |
| 6 | **Assalariado** | Demanda existe, mas **sem fonte específica levantada ainda** — precisa de pesquisa do zero antes de virar guia (ver gaps na seção 3). |
| 7 | **Passeport Talent (pesquisa/doutorado)** | Público de nicho (doutorandos/pesquisadores), mas fiel e mais disposto a pagar por precisão. |
| 8 | **Busca de emprego / negócio** | Também sem fonte específica levantada — precisa pesquisa. Público menor (só quem já tem diploma francês). |
| 9 | **Residência de longa data** | Menor urgência — quem já mora há 5-10 anos na França não tem a mesma pressão de prazo que os outros públicos. |

Isso não é uma ordem rígida — se uma conversa real do Instagram (como as 5 que já mudaram a árvore, seção 5 do manual do quiz) mostrar demanda forte em algum dos últimos, vale pular a fila.

## 3. Ficha de cada guia

Pra cada um: índice sugerido, fontes que a automação semanal (seção 4) vai vigiar, e o que falta pesquisar antes de publicar.

### 1. Visto Estudante (VLS-TS Étudiant)

**Índice sugerido:**
1. Quem precisa desse visto (cursos com mais de 90 dias) vs. quem não precisa
2. Documentos exigidos, na ordem que a Campus France pede
3. Valor mínimo de recursos financeiros — **mudou em agosto/2026** (Décret n° 2026-526: 47% do SMIC bruto, reajuste automático todo ano; antes era fixo em 615€/mês desde 2002) — o guia precisa deixar claro que o valor muda todo ano e como calcular o valor atual
4. Passo a passo da validação no OFII (prazo de 3 meses após a entrada — e o que acontece se perder o prazo)
5. Quanto dá pra trabalhar (60% da carga horária legal) e como isso funciona na prática
6. Caminho pra alternância a partir desse visto (1 ano de formação inicial exigido, exceto mestrado/grande école) — a pergunta mais comum de quem já está estudando
7. Erros comuns que travam a validação (nome divergente do passaporte, categoria de pagamento errada, endereço desatualizado — os mesmos 3 já documentados no artigo sobre a ANEF)
8. O que fazer se o dossiê travar (os 4 níveis de recurso já documentados no artigo "Passo a passo da ANEF")

**Fontes a monitorar:**
- [Campus France Brasil — visto de estudante](https://www.bresil.campusfrance.org/como-solicitar-seu-visto-de-estudante)
- [Campus France Brasil — quem precisa de visto](https://www.bresil.campusfrance.org/quem-precisa-visto-estudante)
- [France-Visas — Brésil](https://france-visas.gouv.fr/en/bresil)
- Légifrance — Décret n° 2026-526 (valor mínimo de recursos, reajustado anualmente)
- [Alternance Professionnelle — apprentissage pra estrangeiros](https://www.alternance-professionnelle.fr/apprentissage-etudiants-etrangers/)

**Pendente antes de publicar:** confirmar o valor de recursos financeiros vigente na data de publicação (a fórmula é nova, vale calcular o número exato em vez de só citar o percentual).

---

### 2. Cônjuge de cidadão(ã) da UE (não francês)

**Índice sugerido:**
1. Por que esse caminho é diferente do "cônjuge de francês" (base legal: art. L233-1 CESEDA / Diretiva 2004/38/CE, não o casamento em si)
2. Requisito central: o cônjuge europeu precisa comprovar exercício do direito de residência (trabalho, estudo ou recursos próprios)
3. Comparação lado a lado com a VPF tradicional: custo (grátis vs. ~350€), teste de francês (não exige vs. exige A2), exame cívico (não exige vs. exige), validade inicial (5 anos vs. variável)
4. O ponto em aberto sobre visto de longa duração antes da entrada — as duas fontes pesquisadas divergem; o guia precisa apresentar os dois cenários e recomendar confirmar no consulado específico
5. Documentos pra comprovar o vínculo e o exercício do direito de residência do cônjuge
6. Passo a passo do pedido da carte de séjour "membre de famille d'un citoyen de l'Union"

**Fontes a monitorar:**
- [Démarches Étrangers — Conjoint, membre de famille d'un citoyen de l'UE](https://demarchesetrangers.fr/titre-de-sejour/conjoint-membre-famille-citoyen-ue)
- [Info Droits Étrangers — ressortissants européens e membros de família](https://www.info-droits-etrangers.org/sejourner-en-france/les-statuts-particuliers/les-ressortissants-europeens-et-les-membres-de-leur-famille/)
- Légifrance — art. L233-1 CESEDA e Diretiva 2004/38/CE

**Pendente antes de publicar:** resolver (ou documentar como zona cinzenta oficial) a divergência sobre visto de longa duração obrigatório antes da entrada — idealmente confirmando direto com um consulado.

---

### 3. Vacances-Travail (PVT)

**Índice sugerido:**
1. Quem pode (18-30 anos, uma vez na vida, não renovável, não converte em outro visto)
2. Cota anual (~500 vagas) e calendário — quando historicamente abre e quando esgota
3. Documentos: ~€2.500 em conta, seguro saúde 12 meses, antecedentes criminais, passaporte com 15+ meses de validade
4. Estratégia de timing: como aumentar a chance de conseguir vaga antes de esgotar
5. O que fazer com o visto na prática — não é só "trabalhar", como estruturar os 12 meses (short-term jobs, estudo informal, viagem)
6. O que acontece ao final do ano — para onde ir depois (conecta com Assalariado, Alternância ou volta ao Brasil)

**Fontes a monitorar:**
- [France-Visas — Brésil](https://france-visas.gouv.fr/en/bresil)
- [Dicas de Paris — Visto Férias-Trabalho](https://dicaparis.com/dicas/visto-ferias-trabalho-da-franca/)
- [Lexora Europe — Vacances-Travail França-Brasil](https://lexoraeurope.com/franca/motivos-pessoais/visto-vacances-travail-franca-brasil)
- Consulado da França no Brasil (calendário oficial de abertura da cota)

**Pendente antes de publicar:** confirmar a data de abertura da cota do ano vigente — isso muda ano a ano e é a informação mais "quente" do guia.

---

### 4. Cônjuge de francês(a)

**Índice sugerido:**
1. Requisitos: casamento válido + provas reais de vida em comum (aluguel, contas conjuntas)
2. Taxas (~350€) e onde pagar
3. Teste de francês A2 — como funciona, onde fazer, validade do certificado
4. Exame cívico — obrigatório desde janeiro/2026 (conecta direto com o artigo já publicado sobre o tema)
5. Passo a passo do dossiê na ANEF
6. Diferença prática pra quem já está na França vs. quem está pedindo do Brasil

**Fontes a monitorar:**
- [Démarches Étrangers — Carte séjour Vie Privée et Familiale](https://demarchesetrangers.fr/titre-de-sejour/carte-sejour-vie-privee-familiale)
- formation-civique.interieur.gouv.fr (exame cívico)
- Légifrance — Arrêté de 10 de outubro de 2025 (exame cívico)

**Pendente antes de publicar:** nada crítico identificado — é o tipo com base de pesquisa mais sólida depois do Visto Estudante.

---

### 5. Pai/mãe de filho(a) francês(a)

**Índice sugerido:**
1. Requisito de filiação legalmente estabelecida
2. Comprovação de contribuição efetiva ao sustento e educação da criança — o ponto mais delicado de provar, merece seção própria com exemplos de documentos aceitos
3. Diferença de quem já mora com o filho vs. quem não mora
4. Passo a passo do dossiê

**Fontes a monitorar:**
- [Démarches Étrangers — Carte séjour Vie Privée et Familiale](https://demarchesetrangers.fr/titre-de-sejour/carte-sejour-vie-privee-familiale)
- Service-Public.fr (seção de filiação e sustento de filho francês)

**Pendente antes de publicar:** pesquisa específica sobre o que conta como "prova de contribuição efetiva" — hoje o catálogo do manual do quiz só menciona o requisito em uma linha, precisa aprofundar.

---

### 6. Assalariado

**Índice sugerido (a validar depois da pesquisa):**
1. Diferença entre visto de trabalho iniciado pelo empregador vs. mudança de status já estando na França
2. Documentos que o empregador precisa fornecer (autorização de trabalho, contrato)
3. Profissões em lista de tensão (se existir facilitação por área)
4. Prazo típico do processo

**Fontes a monitorar:** nenhuma levantada ainda — **precisa de pesquisa do zero** antes de estruturar o guia. Ponto de partida: France-Travail, Service-Public.fr (seção autorização de trabalho pra estrangeiro) e o site do Ministério do Trabalho francês.

**Pendente antes de publicar:** todo o levantamento de fontes.

---

### 7. Passeport Talent (pesquisa/doutorado)

**Índice sugerido:**
1. Quem se qualifica (doutorandos, pesquisadores, professores-pesquisadores)
2. Convenção de acolhimento — o que é, quem assina, como conseguir
3. Documentos e processo
4. Vantagens em relação ao visto de estudante comum (se houver — a validar)

**Fontes a monitorar:**
- [Campus France — Researcher-Talent Passport](https://www.campusfrance.org/en/the-researcher-talent-passport-long-stay-visa)

**Pendente antes de publicar:** aprofundar processo prático (o catálogo atual é só requisitos gerais, falta o "como fazer" passo a passo).

---

### 8. Busca de emprego / negócio

**Índice sugerido (a validar depois da pesquisa):**
1. Quem pode pedir (terminou diploma na França)
2. Duração do título e o que fazer dentro desse prazo
3. Diferença entre buscar emprego e abrir negócio nessa categoria
4. Transição pra outro tipo de visto ao conseguir emprego/abrir empresa

**Fontes a monitorar:** nenhuma levantada ainda — **precisa de pesquisa do zero**. Ponto de partida: Service-Public.fr (carte de séjour "recherche d'emploi ou création d'entreprise").

**Pendente antes de publicar:** todo o levantamento de fontes.

---

### 9. Residência de longa data

**Índice sugerido:**
1. O que conta como "vínculo pessoal consolidado" na prática (5-10 anos é faixa observada, não regra fixa — vale precisar)
2. Documentos que provam o vínculo ao longo do tempo
3. Diferença desse caminho pra uma naturalização

**Fontes a monitorar:**
- [Démarches Étrangers — Carte séjour Vie Privée et Familiale](https://demarchesetrangers.fr/titre-de-sejour/carte-sejour-vie-privee-familiale)

**Pendente antes de publicar:** a faixa de "5 a 10 anos" citada no manual do quiz é observação prática, não critério legal fechado — precisa confirmar o critério oficial exato antes de publicar como guia pago.

## 4. Conexão com a automação semanal

Esse documento é a lista de fontes que a automação de monitoramento (configurada separadamente) vai vigiar toda semana. Quando uma fonte muda — novo decreto, valor reajustado, requisito adicional — a automação relata aqui o que mudou e em qual guia isso teria impacto, pra você decidir se atualiza o guia publicado. Guias sem fonte listada (Assalariado, Busca de emprego/negócio) não entram no monitoramento até a pesquisa inicial ser feita — não dá pra vigiar uma fonte que ainda não existe.
