# CRM · "Quem recebe e quando" em cascata a partir da página de inbound

Data: 2026-11-14. Decidido com a Ingryd na conversa; nada de banco nem de Worker muda.

## Problema

No passo 1 do editor de e-mail, as opções de "Etapa do guia" (`ES.ETAPAS_FILTRO`) misturam as etapas de todas as páginas
("Campus France: …", "Au pair: …") e o material (guia) é uma lista solta. Cada página nova piora a lista, e a Ingryd não consegue
montar um ciclo sozinha. A persona (20 combinações porta × ponto da página de saúde) tem o mesmo problema em escala maior.

## Decisão

A **página de inbound** (`PAGINAS` em `taxonomia.js`, I01 a I05) é sempre a primeira escolha. Ela decide o que as próximas
mostram: só as personas e as etapas daquela página. A tela fica em três linhas:

    Quem:   [página] · [persona, se a página tiver] · [etapa] · aceitou novidades
    Quando: [envio]  (o controle de envio que já existe)
    Hoje:   N elegíveis de TOTAL · de fora: … (a conta que já existe)

## Regras

1. Escolher a página grava `para_quem.materiais = [material da página]`. É o campo que o Worker já confere; nenhum campo novo.
2. Escolher a página **zera** `etapas` e `personas` quando tinham valor, e a tela avisa o que voltou para "qualquer".
3. Persona e etapa continuam **filtros opcionais**, com padrão "qualquer". A página não trava a persona sozinha: travar
   cortaria quem entrou pela página com outra persona, e o Worker aplicaria o corte em silêncio.
4. A persona só aparece se a página tem personas ligadas. Ligações (nomes que já existem em `PERSONAS` de `crm.js`):
   I01 → `alternancia_emprego`, I03 → `campus_france`, I05 → `au_pair_estudante`. I02 e I04: nenhuma (sem chip).
5. As etapas da página são as de `PAGINAS[i].etapas` que também existem em `ES.ETAPAS_FILTRO` (é o que o Worker compara com
   `contatos.respostas.objetivo`). I02 e I04 não têm nenhuma, então mostram "qualquer resposta" sem escolha.
6. Modelo que já tem `materiais` fora de uma página (zero, dois ou token desconhecido) continua abrindo e mostra o texto antigo
   no lugar da página; escolher uma página substitui.
7. Modelos antigos (sem `criado_no_estudio`) não mudam: continuam na frase somente leitura.

## Fora do escopo (precisa de SQL e Worker, protocolo de isolamento)

- A página de saúde (porta × ponto, 20 personas): `porta` e `ponto` ainda não existem no banco. Quando existirem, entram como
  `portas` e `etapas` de uma página nova (I06), sem mudar esta tela.
- "Y envios previstos": exige o CRM dizer quem já acionou o gatilho e não recebeu. A linha "Hoje" mostra só os elegíveis.
- Pacote de ciclo da Bússola e skill `ciclo-email`.
