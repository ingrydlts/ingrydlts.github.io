# Panorama vivo: a conversa alimenta a sessão "Panorama dela"

Aprovado pela Ingryd em 2026-11-16 ("constroi a C"). Escolha de privacidade (opção 1): da conversa entram só tema, resumo e o
momento, nunca o que a pessoa disse.

## Intenção
Hoje o Panorama (admin/crm/panorama.js) só lê o que a pessoa faz no app. Ao colar o transcript no Dossiê e rodar a leitura, o Panorama
já deve nascer com as primeiras identificações e depois mudar com o uso do app e com novas conversas. É um retrato de COMO a pessoa
está (angústia, dúvida, urgência, confiança, autonomia), do que ela precisa, de como prefere ser atendida e do que a equipe deve fazer.
É para a Ingryd e a equipe. A pessoa nunca vê.

## Metas
- A leitura que já cria o rascunho da Plataforma devolve também `panorama` (sem chamada extra de IA).
- Cada conversa nova relê as extrações anteriores e devolve um panorama consolidado de todas as conversas.
- Os sinais do app continuam calculados na hora, sem IA, e entram nos mesmos Temas, Impulsos e Palavras.
- Cada sinal diz de onde veio ("conversa 2 · 21:10" ou "app").

## Fora de escopo
Guardar transcript; "Dia 3"; qualquer coisa que a pessoa veja; tabela ou SQL novo (o panorama mora em `montagens.proposta`).

## Abordagem (C, híbrida)
A (só código) deixaria a leitura mecânica; B (IA reescreve e guarda tudo) custa mais e tira a vida do app. C: a IA devolve só o que o
código não sabe calcular (termômetros, hipóteses, maneiras, ações, palavras, temas da conversa); o código mescla com o app.

## Contrato (`panorama`, dentro da proposta; todos os vocabulários são fechados)
- `leitura` (≤240): uma frase do estado da pessoa, em todas as conversas.
- `termometros` (≤5): `chave` em angustia|duvida|urgencia|confianca|autonomia, `nivel` 0 a 4, `porque` (≤160), `momento`.
- `temas` (≤8): `tema` em Escola|Dinheiro|Documentos|Visto|Idioma|Prazos|Moradia|Trabalho|Família|Saúde, `peso` 1 a 3, `nota` (≤120, sem citar), `momento`.
- `palavras` (≤12): `palavra` (≤30, uma palavra), `vezes`.
- `acoes` (≤10): `texto` (≤160), `dono` ela|ingryd, `momento`.
- `maneiras` (≤6): chave de lista fechada (prefere_ligar, prefere_escrever, quer_passo_a_passo, quer_visao_geral, decide_rapido,
  decide_devagar, pesquisa_sozinha, precisa_de_validacao, adia_burocracia, tem_rede_de_apoio), `momento`.
- `hipoteses` (≤5): `texto` (≤200), `evidencia` (≤160), `confirmar` (≤160, o que confirmaria ou derrubaria), `momento`.
Validação como o resto da proposta: chave fora da lista derruba tudo; e-mail, @usuário e telefone derrubados. Sem `panorama` (propostas
antigas) o validador devolve um panorama vazio.

## Painel
Novas gavetas no Panorama: "Como ela está" (termômetros com tendência contra a conversa anterior, mais "uso do app" calculado),
"Maneiras e ações" e "Hipóteses abertas" (confirmar/descartar, guardado no navegador como as sugestões). Leitura rápida, Temas,
Impulsos, Palavras e "O que foi coletado" passam a misturar conversa e app. Sem conta no app, o Panorama já aparece se houver conversa.
Sempre com texto e número, nunca só cor.

## Privacidade
Da conversa, só o que passou pelo validador. A frase "Não coletado" ganha: "da conversa entram só tema, resumo e o momento".
