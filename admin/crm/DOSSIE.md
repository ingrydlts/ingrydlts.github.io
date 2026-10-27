# Dossiê da pessoa — o que a plataforma pergunta

Vistoria de tudo que o app e o funil perguntam hoje. É a lista que o dossiê do CRM (topo da ficha) reproduz
para você preencher na ligação. Chaves iguais às do app, para a etapa seguinte copiar o dossiê para o perfil dela.

Onde cada resposta mora: **contato** = coluna de `contatos` · **dossiê** = `contatos.dossie` (db/crm-dossie.sql) ·
**funil** = `contatos.respostas` (só leitura, vem do quiz público).

| Bloco | Pergunta (chave) | Onde mora hoje no app | No dossiê |
|---|---|---|---|
| Quem é ela | Nome | profiles.nome | contato |
| | Situação / persona (au pair, Campus France, alternância, cônjuge, PVT) | profiles.persona | contato |
| | Fase (planejando, adaptando, urgente) | funil | contato |
| | Estudos concluídos no Brasil | funil | contato |
| | Preocupação do funil (prazo, começo, sozinha, caro) | funil | contato |
| | Faixa de idade (`faixa_idade`) | perfil_extra | dossiê |
| | Profissão regulamentada | profiles.profissao_regulamentada | dossiê |
| | O que mais preocupa agora (`maior_preocupacao`) | perfil_extra | dossiê |
| Contato | Telefone, aceita lembretes por fora | profiles.telefone, aceita_notificacao_externa | dossiê |
| | Cidade onde mora (`cidade`) | perfil_extra | dossiê |
| Na França | Data de chegada | profiles.data_chegada | dossiê |
| | Moradia, conta bancária, sécu (Ameli) resolvidas | profiles.*_resolvida | dossiê |
| | Comprovante de endereço, número de sécu | perfil_extra | dossiê |
| | Nível de francês | perfil_extra | dossiê |
| | Vencimento do documento | profiles.documento_vencimento | dossiê |
| Au pair → estudante | Ano de au pair, o que pretende, fim do contrato (mês/ano) | profiles.ano_au_pair, intencao_au_pair, contrato_fim | dossiê |
| | Certificado de matrícula, recursos (877,50 €/mês), sponsor | profiles.tem_certificado_matricula, comprova_recursos, tem_sponsor | dossiê |
| | Conta na ANEF | perfil_extra | dossiê |
| | Caminho de estudo (FLE, Licence, Master em alternância, não sabe) | profiles.trilha_estudo | dossiê |
| | Data da prova de francês (só Master em alternância) | profiles.data_prova_frances_master | dossiê |
| Campus France | Nível da candidatura, ano da escola, teste de francês, etapa do guia (1–12) | perfil_extra (cfNivel, cfEscolaAno, cfTeste, cfEtapa) | dossiê |
| | Formação que fecha antes e o prazo dela | perfil_extra (cfPrazoCursoTem, cfPrazoCurso) | dossiê |
| A ligação | Data, resumo, próximos passos, gravação transcrita | não existe no app | dossiê (só CRM) |

Perguntas do funil que ficam só para leitura (já aparecem em "Quem é ela", na aba Ficha): onde está, visto, objetivo,
a árvore do au pair (apAno, apPretende, apDataFinal, apCertificado, apRecursos, apSponsor) e cfNivel, cfTeste, cfCidade.

Sem perguntas próprias hoje: alternância/emprego, cônjuge e PVT. O app só pergunta o que é comum a todas as situações.

Fora do dossiê de propósito: o estado do checklist (cada item marcado) e os documentos do Campus France (`cfDocs`).
Isso é andamento, não resposta, e a pessoa vai marcando no app.

Cada pergunta só aparece quando faz sentido para a situação dela, como no app (ex.: fim do contrato só para quem está
no 2º ano ou vai migrar; ano da escola só para quem escolheu escola).

## Checklist e cliques (db/crm-checklist.sql)

No fim do dossiê aberto: andamento do checklist dela (concluídos, atrasados, próximo prazo, itens por categoria, quantas
vezes ela mexeu em cada item) e a lista de cada clique no checklist (Marcou, Desmarcou, telas, botões). Os itens vêm de
`checklist_items` (você só lê) e os cliques de `plataforma_cliques`, que o app já grava. Resumo no topo: chip "Checklist 1/4".

## Minha iAssistente (db/crm-insights.sql)

Aba Plataforma da ficha: o card que ela vê agora, o que mudou nele (o que entrou e o que saiu, com hora), e as notas
que você escreve para ela. O app manda a lista que mostrou (`registrar_insights`) e busca as suas notas
(`meus_insights_manuais`). Resumo no topo do dossiê: chip "iAssistente 2 notas no ar". A ficha se atualiza sozinha
quando algo dela muda (Realtime; sem ele, consulta a cada 20 s).

## Chat com ela (db/crm-chat.sql)

Aba Plataforma, coluna da direita, no lugar dos Sinais (que deixam de existir: o botão "Enviar sinal" saiu da ficha).
Um chat só: o que você escreve, o que ela escreve e as propostas (cartão com Sim / Não / Depois, com "o que acontece no
sim"). Botões rápidos: Propor 1:1 de 20 min (abre a proposta pronta), Perguntar como está, Pedir documentos e Lembrar do
prazo (preenchem a caixa, você revisa antes de enviar) e Nova proposta. No app dela, o seu avatar flutua e abre o mesmo
chat; ela pode escrever ou tocar em "Quero um 1:1 de 20 min", "Tenho uma dúvida" ou "Ajuda com um documento", e isso
chega aqui como etiqueta. Mensagens dela sem ler aparecem no título do chat e como chip no topo do dossiê.

## Pós-call: a call fluida vira Dossiê, sinais e fila de curadoria (db/crm-pos-call.sql)

A call sai do roteiro; o que sai dela cai sempre nos mesmos quatro baldes. No Dossiê aberto, o painel **Pós-call** (acima do
checklist) trabalha em cima da **Gravação transcrita** do bloco "A ligação":

| Balde | O que é | Onde mora |
|---|---|---|
| Fatos | "ela tem, ela é, ela quer" | chaves do Dossiê (as novas estão no bloco **Sinais da call**, que não entra na barra de progresso) |
| Leitura | a sua interpretação da situação | `sinais` no Dossiê: chaves do vocabulário fechado `sinais_vocabulario` (o app lê como `sinal_<chave>`) |
| Perguntas e respostas | o que ela quis saber e o que você explicou | `curadoria_fila`, por tema (uma chave do vocabulário, ou `outro`) |
| Itens candidatos (até 3) | notícias que a call sugere para o Radar | `curadoria_fila` (tipo `item`), sempre **a conferir**, com a camada que VOCÊ escolhe |

Chaves novas: `formacao_alvo`, `grupo_area`, `area_interesse`, `ensino_medio_ano`, `tem_graduacao`, `frances_gargalo`,
`tem_aula_frances`, `plano_b`.

**Ler a call com IA** (Worker, `POST /api/crm/pos-call/ler`) só propõe. Você marca o que vale e aplica; nada entra na ficha
antes. Fato novo de confiança baixa vem desmarcado, e o que você já digitou só muda se você marcar. A mesma transcrição
não gasta uma leitura nova (hash). A transcrição não é guardada: só a proposta (com trechos de até 160 letras como prova).

**Padrão ou individual?** Padrão = você diria o mesmo a qualquer pessoa na mesma situação (notícia do Radar, material ou
assunto, com `mostrarSe` nos sinais). Individual = depende de um dado só dela (item do Radar com uma nota sua).

**Regra dos 3**: um tema com 3 pessoas diferentes na fila (perguntas e respostas abertas) fica "pronto para virar padrão".
Ao criar o conteúdo, clique em **Virou conteúdo** no tema: as linhas fecham e a contagem recomeça. Até lá, o assunto fica
como item com nota.

**Organizar a call**: a transcrição vem de reconhecimento de voz, sem saber quem fala e com palavras trocadas. A leitura (1) descobre
quem fala pelo conteúdo e só aceita como fato da pessoa o que ELA disse (regras ditas por você vão para "o que você explicou" e
para "a conferir"), (2) corrige os erros de voz mais comuns (viste = visa, alper = au pair, Udapver = DAP verte...) e (3) devolve
**O que rolou na call**: a conversa em até 8 blocos por assunto, para você se localizar rápido.

**Perguntas para confirmar com ela**: tudo o que ficou incerto ou faltou (fato de confiança baixa ou média, dado que a call não
fechou) vira uma pergunta curta, na sua voz. Marque as que quer e clique em **Levar para o chat**: elas viram o rascunho da aba
Plataforma → Chat, numeradas; você revisa e envia (ela recebe o e-mail de aviso, como em toda mensagem sua). Regra, prazo e
valor a conferir em fonte oficial **não** viram pergunta para ela: ficam em "A conferir na fonte, com você".

Os sinais também se marcam à mão, sem IA, na caixa de seleção do painel. Novo sinal = uma linha em `sinais_vocabulario`
(revisão semanal; só entra se já houver, ou puder haver, conteúdo para ele).

## Chat inteligente: uma sugestão, uma mensagem pronta, um controle

Tudo acontece na aba **Plataforma → Chat** da pessoa. Você não procura pergunta, não leva rascunho de um painel para outro: ao abrir o chat, o CRM
já decidiu o próximo passo e deixou a **mensagem escrita** na caixa. Em cima da caixa, uma linha explica o porquê (💡). Embaixo, **um seletor de quando**
e **um botão**.

| O CRM vê | Sugere | Mensagem pronta |
|---|---|---|
| Ela respondeu a última pergunta | **Agradecer** | Agradecimento + o que mudou no app (gancho/recompensa) + a próxima pergunta, tudo numa só mensagem |
| Sua última mensagem é recente (< 3 dias) e sem resposta | **Esperar** | A próxima pergunta, com o envio já marcado para depois do prazo (e depois das que já estão agendadas) |
| 3 mensagens suas seguidas sem resposta | **Parar** | Nada para enviar: aviso ⚠ e botão **Propor 1:1** (o chat só existe dentro do app) |
| Há pergunta na fila e nada pendente | **Perguntar** | A pergunta de maior impacto, com o gancho do que ela destrava no app |
| Ela não tem conta no app | **Sem conta** | Aviso: a mensagem vai por e-mail |

A fila vem das perguntas do **Pós-call** (`perguntas_para_ela`, primeiro) e depois do catálogo `PERGUNTAS` em `crm.js` (prioridade `p`, pergunta `q`, gancho `g`),
sem repetir o que já está no histórico do chat nem o que já está agendado. Telefone, aceite de lembretes e as colunas do funil não entram. Um **processo sugerido**
pelo assistente (ex.: CAF) aparece no cartão próprio, com o recado já preenchido (editável, opcional).

**O seletor de quando** (padrão: o que o CRM sugeriu): *Enviar agora*, *Amanhã 10h*, *Em 3 dias úteis*, *As próximas 3 (3 em 3 dias úteis, 10h)* e *Escolher dia e hora*.
O botão muda conforme a escolha (Enviar / Agendar). Dá para editar o texto antes; **Outra pergunta** troca a sugestão sem sair da tela.
Agendar vale de 10 minutos a 119 dias à frente. As mensagens agendadas aparecem em "Agendadas para ela" (com **Cancelar**); o restante (respostas rápidas, e-mail) fica em *Mais opções*.

### Cada resposta vira dado

Quando ela responde a uma pergunta do roteiro, o CRM **lê a resposta** (leitor fechado, sem IA: sim/não, opções, número de idade, datas, mês e ano, cidade) e a leva ao Dossiê. O Dossiê já alimenta o app
(perfil, `mostrarSe`/`ocultarSe`, Checklist, materiais e Radar) e as perguntas condicionais do próprio Dossiê, então a resposta preenche regras e predefinições sem passo manual.

| Leitura | O que o CRM faz |
|---|---|
| **Confiança alta** (resposta curta e inequívoca: "Ainda não tenho!", "Segundo ano", "Tenho 27") | Grava na hora no Dossiê e marca a origem **"Resposta dela no chat"** (`contatos.dossie_origem`, com a mensagem). Aparece a faixa ✓ *Anotei no Dossiê: … → …* com **Desfazer**. |
| **Confiança média** (data sem ano, resposta longa) | Mostra *"Entendi como X em Y. Registrar?"* com **Registrar** / **Ignorar**. Nada é gravado antes do clique. |
| **Não entendida** ("depois te falo", duas opções juntas) | Não grava; avisa que não consegui ler e a pergunta continua na fila. |

Regras: só preenche campo **vazio** (nunca sobrescreve o que você digitou); cada resposta é tratada **uma vez** (o marcador `msg` evita regravar mesmo que você apague o valor; **Desfazer** e **Ignorar** também ficam lembrados);
a resposta vale só para a **última** pergunta da mensagem. O agradecimento sugerido passa a dizer o que foi anotado ("Anotei no seu perfil: tem certificado de francês: ainda não"), que é a recompensa visível.
Roda quando você abre a ficha e enquanto ela está aberta (ao vivo); respostas que chegam com a ficha fechada são lidas na próxima vez que você abrir.
Nenhum SQL novo: usa `crm_salvar_dossie` e a coluna `dossie_origem`, que já existem. Testes: `npm run test:resposta-dado` (em `admin/crm/db/testes`).

### Reimpacto: fazer a pessoa sempre voltar

O ciclo é **pergunta → resposta → recompensa visível no app → próxima pergunta**. Sem a recompensa, a pessoa responde uma vez e some. O chat inteligente aplica sozinho:

- **Uma por vez**: nunca pergunta nova por cima de outra sem resposta; dia útil, 10h (pula fim de semana).
- **Ela respondeu**: a sugestão vira *agradecer + mostrar o que mudou + próxima pergunta* numa mensagem só.
- **3 sem resposta**: para e propõe uma conversa humana.
- **Radar com novidade para ela** (item com nota) avisa no sininho e por e-mail, fora do chat.

Limites conhecidos: a sequência não cancela sozinha as mensagens agendadas quando ela responde (cancele em "Agendadas para ela"); a hora tem precisão de uma hora.

### Agendar (db/crm-mensagens-agendadas.sql)

A mensagem agendada fica como `pendente` e sai sozinha: o Worker roda de hora em hora (às :05) e, na rodada seguinte à hora escolhida, cria a mensagem no chat como sua e
manda o e-mail de aviso (como em toda mensagem sua).
