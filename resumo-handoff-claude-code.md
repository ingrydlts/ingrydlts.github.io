> **Nota (26/09/2026):** documento histórico — primeiro handoff desta conversa, preparado em 25/08/2026. Desde então o projeto evoluiu bastante (ver notas de sincronização no topo de `manual-quiz-vistos.md` e `guia-implementacao-bot.md`). Mantido aqui como registro da origem do projeto, não como estado atual.

# Handoff: Assistente de Vistos (quiz de triagem pro link na bio)

*Resumo desta conversa, pra colar no Claude Code e continuar a implementação. Preparado em 25/08/2026.*

## 1. O que é o projeto

Um quiz de triagem (chat-bubble, self-contained em HTML/CSS/JS puro, sem backend) pra colocar no link da bio do Instagram da Ingryd. Ela responde perguntas sobre vistos pra França pra brasileiros. O quiz qualifica o seguidor e direciona pro lugar certo:

- **Conteúdo gratuito** — quando a pessoa já sabe o que quer e só precisa de direcionamento.
- **Guia pago** — vendido no marketplace dela própria (`https://ingrydlts.github.io/`), não Hotmart nem terceiros.
- **Consultoria 1:1 paga** — quando a pessoa já tentou e travou, ou está muito perdida e precisa de orientação individual.
- **WhatsApp** como canal de contato/captura (não e-mail).

Não existe backend: toda "conversão" acontece via links — `wa.me/...` (WhatsApp) e Cal.com (agendamento), com dados da pessoa pré-preenchidos via query params/notas.

## 2. Os quatro documentos desta conversa

Todos os arquivos abaixo estão anexados a esta mensagem. Os três primeiros também estão publicados como Artifacts no claude.ai (privados, dela) — os links estão em cada seção.

### 2.1 `assistente-vistos.html` — o quiz em si
Artifact: https://claude.ai/code/artifact/ad0ec047-2cbc-4ed3-a342-61d96ba3e2be

HTML/CSS/JS auto-contido, sem dependências externas (exceto fonte do Google Fonts). State machine simples (`getNextStep()`), tema claro/escuro via CSS custom properties.

Estrutura da árvore:
1. **Gate 0** — cidadania da UE? Se sim, pula toda a lógica de visto e vai pro conteúdo de mercado de trabalho.
2. **Idade** (abaixo/acima de 30) — usada como filtro (PVT só até 30), não gera ramo próprio.
3. **Já está na França?** — ajusta o texto do resultado, não bifurca.
4. **Objetivo** (4 opções): Estudar / Trabalhar / Estar com cônjuge ou filho(a) francês(a) ou da UE (Família) / Acompanhar alguém que já está na França.
5. **Tipo específico** dentro de cada objetivo (3 a 5 opções + "não sei ainda"). Notas importantes:
   - "Alternância" **não existe** como botão — não é um visto próprio, foi embutida na explicação de Visto Estudante.
   - Visto Estudante **não tem filtro de idade** (sem limite legal).
   - Família tem 4 tipos: Cônjuge de francês(a) / **Cônjuge de cidadão(ã) da UE não francês** (adicionado nesta sessão — regime jurídico diferente, ver seção 3 do manual) / Pai/mãe de filho(a) francês(a) / Residência de longa data.
6. **Prontidão** (só se escolheu um tipo específico): "começando a pesquisar" vs "já tentei e não consegui" — separa o desfecho B do C.
7. **Captura**: nome, WhatsApp, @Instagram — ponto único de convergência, depois de já ter conversado um pouco e antes de revelar o resultado.
8. **Resultado** — 5 desfechos possíveis (A a E, ver seção 4 do manual). **Todo desfecho, sem exceção, termina nos mesmos dois botões padrão**: "💬 Pergunta única" (abre popup, pessoa descreve a dúvida, manda por WhatsApp, resposta em até 3 dias úteis) e "📅 Quero fazer um 1:1" (abre popup, pessoa escreve o motivo, manda pro Cal.com com isso nas notas do agendamento). O desfecho B soma um terceiro botão, "Quero o guia completo", que aponta pro produto no marketplace.

**Config que precisa ser trocada antes de publicar de verdade** (está tudo no topo do `<script>`, objeto `CONFIG`):
```js
whatsappNumber: '5511999999999', // placeholder — trocar pelo número real
calLink: 'https://cal.com/SEU-USUARIO/consultoria-30min', // placeholder
guiaPago: { /* um link de produto por tipo de visto — só "Visto Estudante" e
              "Cônjuge de cidadão(ã) da UE (não francês)" têm link preenchido
              (apontando pra vitrine geral do marketplace); o resto está vazio
              até ela criar os produtos específicos */ }
```

### 2.2 `quiz-arvore-vistos.html` — diagrama SVG da árvore completa
Artifact: https://claude.ai/code/artifact/581b9545-f7c0-42db-a926-a3f9dc219dd9

Visualização de toda a lógica acima, útil pra revisar a árvore de decisão sem ler código. Deve ficar sempre sincronizado com o quiz — qualquer mudança de lógica no `.html` do quiz precisa ser refletida aqui também.

### 2.3 `manual-quiz-vistos.md` — documento de referência
Artifact: https://claude.ai/code/artifact/8a38a069-02ea-43d8-a0b8-1c23c6277656

O "porquê" por trás de cada decisão: raciocínio da árvore passo a passo, catálogo de vistos com fontes oficiais citadas (Campus France, France-Visas, CESEDA, Diretiva 2004/38/CE etc.), os 5 desfechos e a lógica de monetização, o que 5 mensagens reais do Instagram mudaram na arquitetura, o que ficou de fora de propósito (crise/violência doméstica — fora do funil comercial), riscos e suposições ainda não validadas, próximos passos.

### 2.4 `guia-implementacao-bot.md` — guia de implementação
Artifact: https://claude.ai/code/artifact/bcc954d1-a3f9-4ca4-956b-88132b7a0558

Passo a passo mais operacional/genérico de como colocar isso no ar (hospedagem, link na bio, testes, checklist final) — não entra nos detalhes específicos de cada tipo de visto, então não precisou de atualização quando a árvore mudou.

## 3. Decisões tomadas nesta conversa, em ordem

1. Trocado o checkout do guia pago de Hotmart pra marketplace próprio da Ingryd (`ingrydlts.github.io`).
2. Desenhado o padrão de UX pros desfechos "1:1": campo de descrição da situação + 2 botões de envio (marcar 1:1 / enviar mensagem), com aviso de prazo de resposta.
3. Generalizado esse padrão pra **todo** desfecho, via 2 popups reutilizáveis (`popupPerguntaUnica` / `popup1a1`) — não só nos desfechos de maior intenção.
4. Removida a opção "Alternância" (não é visto próprio) e revisado — e depois revertido — um filtro de idade no Visto Estudante (não existe limite legal, então ele ficou disponível pra qualquer idade).
5. Pesquisado e confirmado que cônjuge de francês(a) e cônjuge de cidadão(ã) da UE não-francês são dois regimes jurídicos diferentes (VPF vs. carte de séjour membre de famille d'un citoyen UE — este último mais barato/rápido, sem teste de francês). Adicionado como opção separada no braço Família, com fontes citadas no manual.
6. Adicionado o botão "Quero o guia completo" também no novo desfecho de cônjuge da UE (estava faltando).

## 4. Estado atual — o que falta

- **Links reais**: `CONFIG.whatsappNumber`, `CONFIG.calLink` e a maior parte de `CONFIG.guiaPago` ainda são placeholders.
- **Produtos específicos no marketplace**: só existe link de produto pra "Visto Estudante"; os outros tipos apontam pra vitrine geral até ela criar os produtos individuais.
- **Conteúdo do desfecho E** (Acompanhar alguém) ainda precisa do alerta específico sobre o mito do turismo prolongado, por escrito, com mais profundidade.
- **Validar demanda paga** no braço Família/VPF antes de investir pesado em produto ali — é a área menos coberta por conteúdo (=oportunidade), mas ainda não confirmada como pagável.
- **Confirmar direto no consulado** o ponto em aberto sobre visto de longa duração obrigatório (ou não) pra cônjuge de cidadão UE — as duas fontes pesquisadas divergem nisso.
- Testar a pergunta de prontidão ("começando" vs. "travado") com usuários reais — é nova nesta sessão.

## 5. Sources

Pesquisa feita durante esta conversa para a seção "Cônjuge de cidadão(ã) da UE":
- [Démarches Étrangers — Conjoint, membre de famille d'un citoyen de l'UE](https://demarchesetrangers.fr/titre-de-sejour/conjoint-membre-famille-citoyen-ue)
- [Info Droits Étrangers — Les ressortissants européens et les membres de leur famille](https://www.info-droits-etrangers.org/sejourner-en-france/les-statuts-particuliers/les-ressortissants-europeens-et-les-membres-de-leur-famille/)

Fontes completas usadas em todo o catálogo de vistos estão listadas na seção "Fontes consultadas" do `manual-quiz-vistos.md`.
