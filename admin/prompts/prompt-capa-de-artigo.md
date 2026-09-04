# Prompt — Capa de artigo (canvas de design)

Cole isso numa conversa com o Claude (com acesso ao Higgsfield e à skill de design) toda vez que quiser gerar a capa de um artigo novo. Troque os campos entre `[colchetes]`.

---

Quero a capa do artigo **"[TÍTULO DO ARTIGO]"** (categoria: [CATEGORIA], ex.: Custo de Vida / Vistos / Trabalho / Estudos), no estilo editorial de capa de revista — foto de fundo + uma palavra-chave gigante.

**Palavra-chave grande:** [UMA PALAVRA QUE RESUME O ARTIGO, ex.: Custo / Prazo / Moradia]

**Foto de fundo (gerar no Higgsfield, modelo soul_2):**
- Documental e realista, **nunca romantizada** — meus artigos falam sobre a realidade de viver na França, não sobre um cartão-postal turístico
- Elenco diverso (não usar sempre pessoas brancas/loiras como padrão)
- Luz neutra de dia (evitar golden hour genérico e brilho "publicitário")
- Cena coerente com o tema do artigo (ex.: alguém olhando papelada/celular numa varanda comum, numa fila de repartição, numa sala de aula — não uma pose de postal)
- Deixar espaço negativo (céu/parede lisa) no canto superior esquerdo pra caber o texto
- Pedir explicitamente: "no text, no logos, no watermark, no UI overlays" — o modelo às vezes gera texto/interface embaralhada sozinho; se aparecer, avisa que precisa remover antes de eu aprovar
- Proporção 16:9

**Tipografia e marca (Por Dentro):**
- Fonte de destaque: Fraunces (peso 600, bem grande, ~180–240px)
- Fonte de apoio: Inter
- Cores: grafite #2B2B2B, off-white #F4F1EC, dourado #BB9351/#DEB975 (usar o dourado como **1 único acento**, nunca mais que isso na tela)
- Logo em `images/logo-por-dentro.png`, sempre no canto superior direito, discreto (~56–64px de largura)

**Layout (formato que já validamos):**
- Selo pequeno no canto superior esquerdo: linha dourada + "Por Dentro · [Categoria]" em caixa alta
- Palavra-chave gigante + subtítulo de 1 linha explicando o artigo
- Rodapé com duas informações: "Categoria" e "Leitura · X min"
- Scrim (gradiente escuro) atrás do texto pra garantir legibilidade sobre a foto

**Entrega:** monta como canvas de design (artboards lado a lado) com **2 direções diferentes** de composição pra eu escolher e editar à mão — não preciso decidir a estética antes, quero ver opções.

---

Dicas rápidas:
- Se já tiver batido o limite diário de gerações do Higgsfield, ele avisa — aí dá pra usar imagens já geradas de outros testes como base.
- Pra trocar só o texto/cor de uma capa já existente, não precisa colar o prompt inteiro de novo — só descreve o ajuste.
