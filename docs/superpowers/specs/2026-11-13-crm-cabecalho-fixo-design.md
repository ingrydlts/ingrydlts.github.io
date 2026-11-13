# CRM: fila minimalista e cabeçalho fixo com sinais por tipo de pessoa

Data: 2026-11-13. Escopo: `admin/crm` (ficha v2). Sem SQL novo, sem mudança no Worker.

## Intenção e por quê
A Ingryd precisa, sempre à vista, de: quem ela é, em que ponto está e se a ação de e-mail faz sentido. Hoje a **Fila de hoje** e o cabeçalho
da pessoa ocupam a parte de cima da tela e empurram tudo para baixo. Ela quer a fila minimalista (para a página subir) e um cabeçalho fixo
cujos indicadores mudam conforme a pessoa:
- **Assinante:** pagamento; e, se já usa a plataforma, uso (sessões, cliques por sessão, duração), que no futuro serve de argumento com parceiros.
- **Lead:** sinais de interação e engajamento.
- **Na plataforma, sem assinar:** sinais de lead + uso.
Desenho aprovado por ela em 2026-11-13 (mock 1180 px e 380 px, 4 estados).

## Metas / não-metas / anti-metas
- Meta: a página sobe; o cabeçalho fica fixo; cada tipo de pessoa mostra só o que importa.
- Não-meta nesta etapa: valor mensal, ticket médio, LTV, RFM, plano sugerido, "resposta do plano", "dúvidas do mês" (exigem gravar valores do Stripe no
  Worker/banco, ou dependem de regras de plano ainda em proposta no `ONBOARDING.md`). Relatório por turma para parceiros (etapa futura).
- Anti-meta: nota 0–100 de engajamento. Consulta a especialistas (SuperMe, 2026-11-13) recomendou sinais com contagem, não índice, com poucos clientes.
  Métricas de uso (sessões, tempo, cliques) são diagnóstico interno, não relatório de parceiro. Parceiro só receberia totais por turma, com o número
  de pessoas, nunca dado individual.

## Restrições
- Só leitura de tabelas que o admin já lê por RLS. Nenhuma tabela, função ou política nova (regra de isolamento entre clientes não é tocada).
- Sem dependência nova, sem build; JS em módulos nativos, funções puras separadas do DOM (como `ficha.js`/`ficha-html.js`).
- Cache-bust `?v=` atualizado; acessível por teclado; funciona em 380 px; sem rolagem de lado.
- Cliques: a ficha carrega só os 300 mais recentes (`plataforma_cliques`). O uso é calculado sobre eles e **rotulado assim** na tela.
- Duração é estimada (1º ao último clique de cada `sessao`): sempre rotulada "estimada".

## Abordagens consideradas
- **A. Uso calculado no navegador, só com o que a ficha já carrega.** Rápido, sem SQL; errado para quem tem mais de 300 cliques; não serve a parceiros.
- **B. Função no banco que calcula por pessoa e por conjunto.** Certo para parceiros; exige SQL rodado em teste e produção e os testes de isolamento (não rodam na sessão de nuvem).
- **C. Duas etapas (escolhida pela Ingryd):** agora, A com rótulo honesto; depois, trocar por B e acrescentar totais por turma.

## Design (o que foi decidido)
**Fila de hoje minimalista:** uma linha: rótulo "Fila de hoje" + chips com bolinha de urgência, nome curto e "N nova(s)"; a pessoa aberta destacada;
rola de lado se houver muita gente. Sem a segunda e terceira linhas de texto dos cartões atuais. Mesma lógica de quem entra e da ordem
(`fxFilaItens`/`FX.ordenarFila`).

**Cabeçalho fixo (sticky):** linha 1: avatar com iniciais, nome, persona, estágio, etiqueta "Assinatura ativa" ou "Não assina"; à direita
"Escrever mensagem" e "Marcar 1:1" (saem do cabeçalho antigo). Linha 2: cartões, conforme o tipo (decidido por `state.assin` e `user_id`):
1. **Lead (sem conta):** Estágio; Parada há (`dias_sem_sinal`; vermelho quando alto); E-mails (abriu X de Y, clicou); Entradas (nº de funis, dias na base);
   Respostas (nº e se pediu conversa); Próximo e-mail (resumo de `proximoEmail`).
2. **Assinante:** bloco Pagamento: Plano; Próxima cobrança (ou fim do teste/acesso, como em `assinaturaHtml`); Assinante desde (`assinaturas.criado_em`,
   a ser acrescentado ao `select`). Bloco Uso, 30 dias: Sessões (e última há N dias); Cliques por sessão; Duração (estimada); Checklist (feitos de total,
   prazos próximos/atrasados, de `chkCalc`). Nota pequena sobre os 300 cliques e sobre valor/LTV ficarem para depois.
3. **Com conta, sem assinar:** Estágio; Sessões; Cliques por sessão; Duração (estimada); Checklist; Respostas.
Cartões vazios por falta de dado mostram "—" e a razão ("ainda não entrou no app"), nunca 0 inventado.

**Cálculo do uso (função pura, testável):** agrupa os cliques por `sessao` (ignora cliques sem sessão, contados à parte); sessões = grupos
nos últimos 30 dias; cliques por sessão = média; duração = média de (último − primeiro) por sessão, só sessões com ≥ 2 cliques; "última há N dias" =
clique mais recente. Menos de 3 sessões: mostra o número, sem média ("poucos dados").

**Layout:** mesma grade de cartões do desenho; celular em 2 colunas. A ficha (3 colunas) começa logo abaixo do cabeçalho. O carrossel
"Minhas próximas ações" e as abas seguem como estão, abaixo.

## Escolhas minhas (a confirmar na leitura)
- Cabeçalho sticky com `top: 8px` e sombra leve; recolhe os blocos de Pagamento/Uso em uma linha só em telas < 760 px.
- Janela de "últimos 30 dias" para sessões; mínimo de 3 sessões para exibir médias; mínimo de 2 cliques por sessão para a duração.
- "Respostas" = respostas por e-mail e mensagens dela já carregadas (`R`), sem nova consulta.

## O que fica para quem constrói
Nomes de funções e arquivos novos (sugestão: `ficha-uso.js` puro para o cálculo; HTML do cabeçalho em `ficha-html.js`); CSS exato; testes
(unidade do cálculo, HTML do cabeçalho por tipo, fila), seguindo o padrão dos testes em `admin/crm/db/testes`; atualizar `PLANO.md` com a mudança.
Primeiro código: o cálculo de uso; depois a fila; depois o cabeçalho; por último o ajuste de página.

## Pendências fora desta entrega
Identificador de origem do freebie 2 do au pair (`ORIGEM_PAGINA`); valor/ticket/LTV; função no banco para uso e totais por turma;
confirmação de conclusão de prazo pela própria pessoa (para a métrica de parceiros).
