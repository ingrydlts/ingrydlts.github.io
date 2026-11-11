# CRM · Editor de e-mail em 3 passos, com edição na prévia (design)

Data: 2026-11-11 · Status: aguardando revisão da Ingryd · Parte C de três
(A: matriz da jornada · B: dor, em `2026-11-11-crm-dor-design.md` · C: este documento).

Protótipo navegável: artefato "Editor de e-mail e dor". **Atenção:** a versão 1 do protótipo editava só pelo lado esquerdo;
este spec substitui isso (decisão da Ingryd em 2026-11-11: edita-se **na prévia**). O protótipo será atualizado para o novo desenho.

## 1. Problema

A tela de edição de um modelo (`admin/crm/crm.js`, `renderEditor`, ~linhas 2486-2700) tem seis seções em sanfona, duas
superfícies para editar a mesma coisa (formulário à esquerda e "clique em qualquer texto" à direita), o assunto repetido
na prévia, código aparente (`{nome}`, `**negrito**`) e cinco controles antes de ver o e-mail. Quem é novo na equipe não
sabe onde mexer.

## 2. Objetivo e sucesso

Uma pessoa que nunca viu o CRM consegue, sem ajuda: abrir um modelo, reescrever um parágrafo, adicionar um botão, escolher
quem recebe, enviar um teste e mandar para revisão. Critérios:

1. **Um só lugar de edição:** o próprio e-mail na tela. Não existe formulário paralelo para o texto.
2. **Reescrever e adicionar blocos direto na prévia**, com mouse, teclado e toque.
3. **Três passos:** Quem recebe e quando · Texto · Conferir e publicar. Quem abre um modelo existente cai em Texto.
4. O passo "Quem recebe" lista as **landing pages de entrada** e as **respostas do formulário** que a pessoa deu antes de receber o freebie.
5. Funciona em 380 px de largura, com teclado e com leitor de tela.

## 3. Decisões tomadas com a Ingryd

- A prévia é a superfície de edição (reescrever e adicionar blocos).
- O passo de destinatário tem as landing pages de entrada e as respostas do formulário.
- A dor (spec B) aparece como um filtro e como etiqueta do modelo.
- Propostas de interface seguem padrão moderno: edição direta, ações no contexto, menu "/" , nada de formulários longos.

## 4. Os três passos

### 4.1 Quem recebe e quando

Monta-se como uma frase com seletores, e o resumo em palavras aparece no topo do passo e na lista de modelos.

**Quem recebe** (tudo é "e" entre grupos e "ou" dentro de um grupo, como `aplicaFiltros` já faz):

1. **Entrou por** (landing pages de entrada): cartões selecionáveis, um por página do catálogo (`PAGINAS` em
   `taxonomia.js`: I01 a I04, mais I05 Au pair, ver o spec B §8). Cada cartão mostra nome, endereço (`rota`) e quantas pessoas
   entraram por ela. Equivale a `para_quem.materiais` (a origem `guia-<slug>` que a página grava no cadastro).
2. **Respondeu no formulário**: para cada página marcada em 1, as **perguntas feitas antes do freebie** e as opções, como
   caixas marcáveis com contagem. Hoje existem estas perguntas, lidas nas páginas (`guias/*/index.html`):
   - I03 Études en France: "Em que etapa da candidatura você está?" (5 opções `cf-*`) e "Para qual nível você vai se
     candidatar?" (`l1`, `arq`, `l2l3`, `lpro`, `master`, `escola`, gravada em `respostas.cfNivel`).
   - I02 Tecnólogo: "Em que etapa você está?" (4 opções `tec-*`).
   - I01 Alternância: etapas `alt-*`. I04 VLS-TS: etapas `vls-*`.
   - I05 Au pair: "O que mais pesa pra você agora?" (`ap-tudo-bem`, `ap-nao-sei-comecar`, `ap-medo-prazo`, `ap-travado`, `ap-pesado`).
   As opções vêm do catálogo, não de código solto. Equivale à regra existente "Etapa do guia" (`respostas.objetivo`, valor igual); a
   pergunta de nível passa a ser uma segunda regra sobre `respostas.cfNivel`.
3. **Aceitou novidades**: automático para o tipo "novidades"; só mostra o aviso.
4. **Avançado** (fechado): persona, produto comprado, segmento, estágio.

**Este e-mail resolve (dor atendida): deduzida, não escolhida.** Decisão da Ingryd em 2026-11-11: mostrar o catálogo inteiro de
dores não escala. A dor do e-mail vem **do contexto dos botões que ela clica** e aparece já preenchida:

- Para cada página marcada em "Entrou por": se há respostas marcadas **da pergunta de etapa** dessa página, valem só as dores
  associadas a elas (`dores.respostas_guia`); se não há, valem as dores prováveis da página (a união das dores associadas a
  qualquer resposta dela). Respostas da pergunta de nível (`nivel-*`) filtram pessoas, mas não indicam dor.
- Sem página marcada, não há sugestão: aparece "Escolha uma página de entrada e eu sugiro as dores prováveis".
- O resultado aparece como **chips** (dor, quantas pessoas do contexto a têm, de onde veio: "por «resposta»" ou "em N respostas
  da página"), com selo **Automático**. O mesmo contexto é recalculado a cada mudança, com um realce curto nos chips que mudaram
  e um anúncio ("Dores atualizadas: …") para leitor de tela.
- **Ajustar** abre uma lista com as dores sugeridas já marcadas e, recolhido, "Outras dores (N)" com busca. Mexer em qualquer
  chip ou caixa passa o selo para **Ajustado por você** e congela a lista; "Voltar ao automático" desfaz.
- Respostas sem dor associada geram o aviso "A resposta «…» não tem dor associada" com atalho para o catálogo.
- No máximo 5 chips à vista; o resto vira "+ N dores".
- **Filtro opcional**: "Enviar só para quem já tem uma destas dores confirmada" (desligado por padrão). Desligado, a dor só
  etiqueta o e-mail; ligado, também restringe os destinatários à dor confirmada na ficha.

O mesmo princípio vale em qualquer lugar do CRM que peça uma dor (Contatos, ficha, Estúdio): **contexto antes de catálogo**.
Primeiro as dores relevantes ao que está na tela, já marcadas; o resto fica recolhido e com busca.

Um **contador ao vivo** diz "Hoje isto alcança N pessoas", calculado no navegador com as mesmas regras que o banco aplica
(o código de conferência `fora` já existe em `crm.js` perto da linha 2970). O número é uma estimativa; a regra que manda
é a de `crm_sequencia_pendentes`.

**Quando sai:** "Manual, pela ficha" ou "Sozinho" com gatilho (depois do cadastro no guia, depois de outro e-mail, depois de
compra), tempo (minutos, dias e hora de Brasília) e o interruptor Envio. Texto de resumo: "Sai 5 minutos depois do cadastro".

**Quem recebe** e **Quando sai** ficam numa tela curta. O protótipo compara três soluções (A frase clicável, B painel com lista,
C resumo com janela); a escolha da Ingryd define qual vira a tela final. Nas três a tela **não cresce** ao escolher uma
página: as perguntas aparecem em pop-up, painel de altura fixa ou janela, nunca empilhadas.

### 4.2 Texto: a prévia é o editor

O e-mail ocupa a tela como ele chega, e é editável.

- **Reescrever:** clicar num bloco de texto, título ou assinatura edita ali. Texto simples, com negrito (o formato de hoje só tem negrito: `**assim**`) por atalho
  (Ctrl/Cmd+B) e pela barra do bloco. Colar sempre como texto simples.
- **Adicionar:** entre dois blocos, e no fim, aparece um "+" (sempre visível no toque). Abre a paleta de tipos
  (Título, Texto, Botão, Destaque, Pergunta, Assinatura, Foto). Em linha vazia de um bloco de texto, digitar "/" abre o mesmo
  menu com busca ("/bot" filtra "Botão"). Enter no fim de um texto cria um novo bloco de texto logo abaixo.
- **Dados da pessoa:** digitar "@" ou usar "+ Dado da pessoa" na barra insere uma **etiqueta** (nome, persona, dor, etapa),
  nunca `{nome}` visível. Uma etiqueta se apaga com Backspace como uma letra.
- **Barra do bloco** (flutuante sobre o bloco em foco; no celular, fixa na base): tipo (trocar Texto por Título etc.),
  negrito, "+ Dado da pessoa", mover para cima/baixo, duplicar, excluir.
- **Blocos que não são texto corrido** (Botão, Destaque, Pergunta, Foto): clicar abre um **popover** ancorado ao bloco com
  poucos campos (rótulo, link do sistema, estilo). Na tela o bloco continua parecendo o e-mail.
- **Reordenar:** alça de arrastar à esquerda do bloco (ponteiro) e Alt+↑/Alt+↓ (teclado).
- **Assunto e prévia:** ficam no alto, desenhados como uma linha da caixa de entrada, e editam-se ali mesmo. A frase de
  reserva ("se faltar um dado") abre num popover da engrenagem ao lado.
- **Ver como:** seletor "Ver como [pessoa de exemplo ▾]" com um interruptor "Mostrar como chega". Ligado, as etiquetas viram
  os valores dela (destacados) e o e-mail fica somente leitura; desligado, volta a editar. O texto guardado nunca é o resolvido.
  Seletor lista "pessoas de exemplo por dor", com a busca por nome real como opção. Computador/Celular é um ícone discreto.
- **Desfazer/refazer:** Ctrl/Cmd+Z e Shift+Ctrl/Cmd+Z em nível de edição de bloco (pilha em memória por sessão do modelo).
- **Salvamento:** automático, com atraso de 800 ms depois da última tecla, usando o `salvarModelo` atual. Indicador
  "Salvo" / "Salvando…" / "Não salvou, tentar de novo" (estado de erro com botão). Versão em revisão ou no ar fica
  somente leitura, com o aviso e o botão "Criar nova versão".
- **Coluna lateral:** só uma coluna estreita à direita, com as checagens de "Pronto para usar?" em modo resumo e as
  pessoas de exemplo. Nada que edite texto.

### 4.3 Conferir e publicar

Lista "Pronto para usar?" (assunto, prévia, frase de reserva, assinatura, teste enviado), botão "Enviar teste para mim",
"Publicar (No ar)" só liberado com tudo certo, e a lista de Versões com quem mudou e quando.

### Cabeçalho

Caminho (percurso › etapa), nome, **um** selo de estado (Rascunho · versão N, Em revisão, No ar), e uma ação principal que
muda com o estado: "Mandar para revisão" no rascunho, "Publicar" na revisão. "Enviar teste" é a ação secundária.

## 5. Contratos que não mudam

- O formato de blocos guardado em `modelos_email_versoes.blocos` (`itens` com `tipo`, `texto`, `rotulo`, `link`, `se`,
  `estilo`, etc.) e `ES.montar` em `estudio.js` **ficam como estão**: o HTML que sai nos envios não muda.
- Marcações `{nome}`, `{#x}…{/x}`, `{^x}…{/x}` continuam sendo o texto guardado; as etiquetas são só a forma de mostrar.
  Conversão pura nos dois sentidos, com teste.
- Nenhum SQL é necessário para o editor. O único SQL das três partes está no spec B.

## 6. Estrutura de código

`crm.js` já tem ~4100 linhas. O editor novo vai para arquivos próprios (ES modules nativos, sem build):

- `admin/crm/editor-blocos.js`: funções puras e testáveis em Node (texto ⇄ etiquetas, negrito, mover, duplicar,
  filtro do menu "/", desfazer/refazer). Sem DOM.
- `admin/crm/editor-email.js`: monta e liga o DOM (`montaEditor(el, { itens, pessoa, vars, aoMudar })`).
- `crm.js` só chama `montaEditor` no passo Texto e mantém `salvarModelo`, versões, teste e publicação.
- CSS em `crm.css`, com os tokens que já existem. Sem biblioteca nova.

## 7. Estados, acessibilidade e responsividade

- Estados: carregando (esqueleto do e-mail), modelo sem blocos (convite "Começar com um título"), erro de salvar, somente leitura.
- Cada bloco editável é `role="textbox"` `aria-multiline`, com `aria-label` do tipo. O menu "/" e o "@" seguem o padrão listbox
  (`aria-activedescendant`). Barra do bloco acessível por Tab. Esc sai do bloco; o foco volta ao ponto de onde veio.
- Contraste mínimo 4,5:1 nos dois temas. Etiquetas de dados e estados nunca só por cor.
- 380 px: o e-mail ocupa a largura toda; "+" visível; barra do bloco fixa na base; popovers viram folhas na base.
- `prefers-reduced-motion` respeitado.

## 8. Testes

- Unidade (`node --test`): texto ⇄ etiquetas (ida e volta idêntica); texto com `{^x}` e `{#x}` preservado; negrito;
  mover/duplicar/excluir; filtro do menu "/"; desfazer e refazer; colar texto com HTML vira texto simples.
- Navegador (Chromium já instalado no ambiente, Playwright): editar um parágrafo na prévia e conferir o JSON salvo; inserir
  bloco por "+" e por "/"; inserir etiqueta por "@"; mover com Alt+↑; teste a 380 px; modo "Mostrar como chega" não altera o texto guardado.
- Regressão: o HTML montado por `ES.montar` para um modelo conhecido é idêntico antes e depois (teste de snapshot em `estudio`).

## 9. Fora de escopo

Novos tipos de bloco; mudanças no motor de envio ou no Worker; escrita com IA; edição simultânea por mais de uma pessoa;
a matriz da jornada (spec A).

## 10. Riscos

- `contenteditable` tem diferenças entre navegadores: mitigado por limitar o conteúdo a texto simples com etiquetas e por
  testar em Chromium e no Safari do celular antes de publicar.
- Perder texto ao salvar: mitigado por salvamento com estado visível, pilha de desfazer e versões.
- Troca de hábito para quem já usa a tela: o passo Texto abre direto; a tela antiga pode ficar acessível por um interruptor
  "Editor antigo" por uma rodada, e sai depois de a Ingryd aprovar.
