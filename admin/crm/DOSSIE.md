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
