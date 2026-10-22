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
