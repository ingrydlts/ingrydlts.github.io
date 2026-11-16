# CRM · Hoje com Resumo e abas — desenho

## Intenção (o porquê)
A Hoje do CRM virou uma coluna comprida (9 blocos empilhados) com um calendário que rola por dentro da página. A Ingryd abre a
Hoje de manhã e quer, **sem clicar em nada**, um resumo curto de todas as seções, com botões de direcionamento estratégicos
(não necessariamente de ação), e poder ir de seção em seção vendo antes o que pede atenção em cada uma.

## Metas
- Ao abrir, a Hoje mostra um **Resumo** que cabe em ~1 tela no computador.
- Uma barra de **abas** no início, uma por seção, com contagem; bolinha vermelha quando há urgência.
- Cada aba mostra **uma seção em largura inteira**, urgentes primeiro.
- **Nenhuma rolagem interna** em lugar nenhum da Hoje (a regra também entrou no `CLAUDE.md` do site).

## Não-metas
Sem SQL novo nem dado novo. Não mexer nas outras telas (Contatos, Funil, Radar, Caixa, Ficha). Não mudar o que cada bloco faz.

## Anti-metas (seria falha mesmo funcionando)
Qualquer `overflow-y`/`max-height` com rolagem; cartão de resumo com botão que dispara ação irreversível (enviar mensagem etc.);
Resumo que só repete números sem dizer o que fazer.

## Abordagens consideradas
A. Só a grade de resumo (precisaria de painel/janela para calendário, fila, guias, prazos). B. Resumo + abas (escolhida).
C. Faixa de status + dois blocos (perde a visão de todas as seções). Escolhida: **B**, pela Ingryd.

## Desenho
**Barra de abas** (acima do Resumo, abaixo dos indicadores): `Resumo · Precisa de você · Agenda · Mensagens · Caixa · Processos · Radar · Guias · Prazos`.
Processos só aparece se houver o que revisar. Abas quebram em linhas no celular (sem rolagem lateral).

**Resumo** (grade de cartões, `auto-fit`, ~4 por linha no computador, 1 no celular). Cada cartão: título, contagem, **uma** linha
com o item mais urgente, **um botão de direcionamento** (leva a algum lugar; não age):

| Cartão | Linha do mais urgente | Botão |
|---|---|---|
| Precisa de você | o item mais antigo/urgente da fila | Começar pela fila → aba |
| Agenda 1:1 | próximo 1:1 (pessoa, dia, hora) e quantos em 30 dias | Abrir agenda → aba |
| Mensagens da Equipe Por Dentro | a próxima a sair (pessoa · quando) | Revisar fila → aba |
| Caixa de entrada | a pergunta há mais tempo sem resposta | Responder → tela Caixa |
| Processos para revisar | primeiro da lista | Revisar → aba |
| Radar por persona | personas com aviso | Abrir Radar → tela Radar |
| Guias | quantos voltaram a pedir material | Quem voltou → Contatos (visão "voltaram") |
| Prazos | o prazo mais próximo | Ver prazos → aba |

Clicar no título do cartão também abre a aba da seção. Cartão sem pendência fica discreto ("Nada pendente").

**Abas de seção:** recebem os blocos que já existem (lista de atenção, calendário com o filtro de período, fila, caixa, processos,
radar, guias, lembretes), um por vez, em largura inteira. O calendário perde o `max-height` que criei; as listas longas mostram os
urgentes e "Ver todos"/"Ver mais" (a página rola, o bloco não).

**Estado:** aba atual em `state.hojeAba` (padrão `resumo`), lembrada em `localStorage` com `try/catch`. Contagens recalculadas com
os mesmos dados já carregados (nenhuma chamada nova).

## Decidi eu (marcado como minha escolha)
Abre sempre no Resumo; abas quebram de linha no celular; lista de abas e a tabela de cartões acima; vermelho só quando há urgência
real (caixa sem resposta, prazo vencido/≤ 7 dias, problema no app, 1:1 hoje).

## Fica para quem constrói
Onde pôr o markup das abas em `index.html`; como derivar a "linha do mais urgente" de cada cartão a partir das variáveis já em
`crm.js`; testes (os de `crm-fila-hoje-ui` e `crm-caso-ui` precisam continuar passando; somar um teste do Resumo e das contagens).
Verificação final em navegador: só a página rola; Resumo em ~1 tela (1280×800) e em 380 px.
