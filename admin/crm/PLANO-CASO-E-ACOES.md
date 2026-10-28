# CRM: caso de onboarding, ações com botão, recados e pesquisas

> Escrito em 2026-10-28. **Documento para colar em outra sessão.** Está pensado para ser lido sem mais contexto.
> **NADA aqui foi implementado.** Antes de qualquer código ou SQL, a sessão que ler isto deve entregar **um artefato** (protótipo visual navegável, com dados fictícios) para a Ingryd aprovar. Só depois vem a implementação, por fases, uma por vez.
> Cada modificação tem o mesmo formato: **Por quê** (o problema real), **Como** (onde mexer e o que fazer) e **Proposta** (a decisão recomendada e o que está em aberto).

## 0. Contexto mínimo

- **Produto:** Por Dentro, plataforma para brasileiras que vivem na França. Uso individual da Ingryd (única administradora do CRM). Repositórios: **site** (`ingrydlts.github.io`: o CRM em `admin/crm/`, o Worker em `cms-oauth-worker/`) e **app** (`POR-DENTRO-APP`: a área da cliente, `dashboard/`, `content/`, `db/`). O mesmo Supabase atende os dois.
- **Origem:** o primeiro onboarding (uma pessoa que está em PVT e quer virar estudante de francês e depois da faculdade) mostrou o que o CRM ainda não faz. As propostas de base estão no app: `docs/propostas/CASO-DADOS-E-CRM.md`, `docs/propostas/ONBOARDING-BILAN-E-ACOES.md`, `docs/propostas/PERSONA-PVT-ESTUDAR-FLE.md` e o método em `.claude/skills/caso-onboarding/SKILL.md`.
- **O CRM hoje** (conferir no código antes de mexer): tabelas `contatos` (com `dossie` jsonb), `eventos`, `curadoria_fila`, `pos_call_propostas`, `sinais`, `sinais_vocabulario`, `um_a_um`, `propostas`, `chat_mensagens`, `emails_enviados`, `plataforma_cliques`, `assinaturas`, `stripe_eventos`, `lembretes_prazo`, view `crm_contatos` (que decide urgência e "Precisa de você"). Painel em `crm.js` e `crm.css`; modelos de e-mail em `estudio.js`; Worker em `cms-oauth-worker/worker.js` (rotas `/api/crm/*`).

### Regras que valem para tudo (não negociáveis)

1. **Isolamento entre clientes** (`CLAUDE.md` dos dois repositórios): tabela nova com RLS ligada, política pelo dono (`auth.uid()`, `meu_contato_id()`) ou pelo admin (`eh_admin()`), `revoke all ... from anon`. Função `security definer` com `set search_path`, `revoke ... from public` **e** `from anon`. Antes de propor SQL: `db/testes` com o sentinela passando (`APP_DB_DIR=<app>/db npm test`). Tabela ou função nova entra em `db/conferir-banco.sql` do app. SQL roda primeiro no Supabase de teste, depois no de produção; depois `db/auditoria-isolamento.sql` e `db/conferir-banco.sql`, **os dois vazios**.
2. **Nenhuma chave de API no navegador.** A IA roda só no Worker (segredos na Cloudflare).
3. **A IA propõe, a Ingryd aprova.** Datas, prazos, custos e checklist saem das funções do app (`assets/js/prazos.js`, `checklist-engine.js`), não da IA.
4. **Nada sai para uma pessoa sem o "pode enviar" da Ingryd**: e-mail, lembrete, cupom, recado. Pessoa sem conta e sem consentimento não recebe envio automático: o botão vira texto para copiar.
5. **Sem dado de pessoa real no repositório.** O caso mora na ficha dela. No repositório só entram método, regras gerais e exemplos fictícios.
6. **Toda resposta sobre regra de visto cita fonte** com `nivel` (oficial, institucional, privado, fórum) e `conferido_em`. Informação geral, não aconselhamento jurídico.
7. **Mobile em 380 px, quatro estados de tela** (carregando, vazio, erro, dado velho) e **palavra além da cor** em todo estado.

---

## M1. Bilan fiel à conversa (atribuição com evidência)

**Por quê.** Houve um erro real: o resumo atribuiu à Ingryd a sugestão de mandar e-mail quando ela insistiu em ligar por causa do prazo. Um Bilan que erra o que a pessoa disse destrói a confiança nele. Transcrições também não têm rótulo de falante e têm trechos quebrados.

**Como.** Evoluir o pós-call existente (`db/crm-pos-call.sql`, a rota do Worker que organiza a call). Cada afirmação sobre o que alguém disse ou decidiu vira um objeto:

```json
{ "texto": "...", "quem": "ingryd|pessoa|incerto", "momento": "20:05",
  "trecho": "até 15 palavras", "certeza": "literal|inferido|confirmar", "vezes_dito": 3 }
```

- Sem rótulo de falante: `quem = "incerto"`. A IA **nunca adivinha**.
- Duas posições na mesma conversa: mostrar as duas com o momento de cada, e dizer qual foi repetida e qual foi a última.
- **Passada de checagem** (segunda chamada, barata): para cada afirmação, "o trecho sustenta isso?". O que não passa vira `confirmar` e não sai como fato.
- Botão "não foi isso que eu disse" em cada afirmação: grava a correção em `eventos` (tipo `bilan_corrigido`) e entra como exemplo para as próximas execuções.
- Saída validada contra schema. Reaproveitar o `hash_entrada` do pós-call para não gastar chamada à toa.

**Proposta.** Fazer primeiro, antes das ações, porque as ações nascem do Bilan e herdam a origem (`momento`, `trecho`). Em aberto: guardar o trecho literal na ficha (útil, mas é dado da pessoa; truncar a 15 palavras e não gravar a transcrição, como o pós-call já faz).

---

## M2. Ações do caso: a lista "Notificações para mim"

**Por quê.** O onboarding precisa terminar em ações, não em texto. Hoje as pendências ficam no resumo e se perdem.

**Como.** Tabela nova `acoes_caso` (admin only):

```
id, contato_id (cascade), caso_id?, titulo, dono (ingryd|pessoa|escola|consulado),
urgencia (hoje|semana|prazo), prazo_em date, marco_id?, origem jsonb {momento, trecho},
botao (ver M3), estado (aberta|em_andamento|aguardando_ela|concluida|descartada),
bloqueada_por bigint?, fonte_necessaria bool, criada_em, concluida_em
```

- Cartão no topo da ficha, **"Resultado do onboarding"**: resumo do Bilan (4 linhas), contagem de afirmações a confirmar e a lista de ações em três grupos: **Com o prazo de [data]**, **Documentos**, **Para ela**. Cada linha: título, motivo, trecho de origem e botão.
- Ordem: pelo **caminho que decide o prazo**, não pela ordem em que as dúvidas apareceram.
- Evento por mudança de estado (`acao_criada`, `acao_concluida`).

**Proposta.** Cartão fixo enquanto houver ação aberta com prazo. Ação concluída mede o tempo gasto (alimenta o painel de M12).

---

## M3. Catálogo de botões

**Por quê.** A Ingryd quer que cada pendência já traga a próxima ação. Sem catálogo fechado, cada botão vira exceção.

**Como.** Um registro único (`botoes` em JS, espelhado no schema da tabela) com a regra de cada um:

| Botão | Faz | Sai da fila quando |
|---|---|---|
| `gerar_rascunho` | M4 | O recado foi aprovado |
| `anexar_documento` | M7 | O documento está anexado com `conferido_em` |
| `pesquisar` | M6 | A resposta foi aprovada com fonte |
| `confirmar` | Nota para a Ingryd verificar algo da conversa | Ela marca confirmado e informa a fonte |
| `lembrar_ela` | M5/M11: prepara o lembrete | Ela aprova o envio |
| `marcar_marco` | M8 | O marco existe |
| `copiar_mensagem` | Copia o texto para mandar por Instagram ou WhatsApp | Ela marca como enviada |

**Proposta.** Nenhum botão envia sozinho. Em aberto: quais botões ficam no plano premium (decisão de produto da Ingryd).

---

## M4. `gerar_rascunho`: roteiro de ligação

**Por quê.** A pessoa disse que ligaria para a escola no dia seguinte, o prazo era curto e o francês dela é de nível iniciante. Um roteiro pronto reduz o risco de ela travar ao telefone. A Ingryd foi explícita: **sem linguiça robótica**.

**Como.** Nova rota no Worker (ex.: `POST /api/crm/rascunho`, exige o token de admin). Entrada: objetivo, canal (telefone), nível de francês, escola alvo, perguntas em aberto **ordenadas pelo prazo**. A IA só redige; datas e valores vêm das funções do app. Saída validada:

```json
{ "abertura": "...", "perguntas": [ { "ordem": 1, "fr": "...", "pt": "...", "anotar": "...", "decide_prazo": true } ],
  "se_nao_entender": ["Pouvez-vous répéter, s'il vous plaît ?", "Pouvez-vous me l'envoyer par e-mail ?"],
  "fecho": "..." }
```

- **Anti-linguiça (regras do schema e do prompt):** no máximo 8 perguntas; frases de até 12 palavras, nível A2; sem saudação longa; uma lista única de respostas-modelo para a ligação inteira; cada pergunta diz o que anotar; pergunta que não decide nada antes do prazo vai para "se der tempo".
- **O e-mail é só o fecho:** a ligação é o canal principal quando o prazo é curto. O e-mail serve para confirmar por escrito.
- Cache por hash da entrada; registrar modelo e custo.

**Proposta.** O resultado nasce como **rascunho** e abre a edição para a Ingryd. Em aberto: a lista de perguntas padrão por tipo de escola vem do banco de respostas (M6), para o rascunho já nascer com as perguntas recorrentes.

---

## M5. Recado da Ingryd (`recados_ingryd`) e o pop-up no app

**Por quê.** O rascunho só ajuda se chegar à pessoa no momento certo: dentro da tarefa que ela precisa fazer. Mandar anexo solto se perde.

**Como.** Tabela `recados_ingryd` (esboço no app, `docs/propostas/ONBOARDING-BILAN-E-ACOES.md`, seção 4.2): `contato_id`, `acao_id`, `tarefa_ref` (chave do item do checklist), `titulo`, `descricao`, `conteudo jsonb` (o roteiro), `onboarding_em`, `estado` (rascunho|aprovado|visto|usado|arquivado), `aprovado_em`, `visto_em`.

- **RLS:** a pessoa lê só os recados `aprovado`; o admin lê e escreve tudo.
- **Texto padrão da descrição:** *"Oi! Fiz este rascunho para você usar ([situação identificada: o botão que o gerou e a pergunta que ele resolve]). Ele veio do onboarding que fizemos em [data do onboarding]. Aproveite para personalizar ainda mais a seu favor!"*
- **No app** (repositório do app, `dashboard/index.html`): o item do checklist com `tarefa_ref` mostra um indicador "Recado da Ingryd". Ao abrir, **pop-up** com título, descrição e o roteiro. A pessoa edita uma cópia dela; o original da Ingryd não muda. Funções `meus_recados()` e `marcar_recado_visto(id)` (`security definer`, `auth.uid()`).
- O CRM mostra `visto_em` e `usado`. Sem ver em 2 dias, a ação volta à fila da Ingryd.

**Proposta.** Em aberto: se a Ingryd quer ver a versão personalizada da pessoa (recomendo **não**, é privacidade da cliente).

---

## M6. Pesquisas e banco de respostas

**Por quê.** A Ingryd disse "vou pesquisar" sobre perguntas que são recorrentes ("pagar o semestre antes do visto ou só comprovar o dinheiro?"). A resposta tem que ser encontrada **uma vez**, ensinada ao sistema e reaproveitada, sempre com a fonte oficial.

**Como.** Tabelas `pesquisas` (a pergunta aberta) e `respostas_base` (a resposta aprovada):

```
pesquisas: id, contato_id?, pergunta, prioridade 1-3, prazo_em?, recorrente bool,
  estado (aberta|em_pesquisa|fonte_anexada|resposta_em_rascunho|aprovada|publicada),
  fonte_url?, fonte_arquivo?, fonte_nivel (oficial|institucional|privado|forum), conferido_em,
  resposta_rascunho, resposta_aprovada
respostas_base: id, pergunta_canonica, resposta, fonte_url, fonte_nivel, conferido_em,
  validade_dias default 90, persona?, trilha?, origem_pesquisa_id
```

- **A IA só responde com fonte anexada.** Sem fonte, a pessoa recebe "estamos conferindo" e a pesquisa fica em `em_pesquisa`.
- A IA redige a resposta **citando o trecho** da fonte; a Ingryd revisa e aprova.
- **Ao enviar:** resposta + nome da fonte oficial + o link que a Ingryd inseriu.
- **Recorrente:** a resposta aprovada vira linha de `respostas_base`. Nos próximos onboardings, a pergunta já aparece respondida; resposta com `conferido_em` mais velho que a validade volta como "reconfirmar".
- Prioridade vem do marco: pergunta que decide o prazo é prioridade 1.
- Liga com `curadoria_fila`: o item aprovado também vira candidato a conteúdo do app (por PR em `content/`, nunca automático).

**Proposta.** Deste primeiro caso: "pagar o semestre ou só comprovar" é prioridade 1 e recorrente; "tradução juramentada do histórico e do ensino médio" e "o prazo é 30/11 ou 15/12" entram como **`confirmar`**, com nota para a Ingryd. Em aberto: validade padrão (90 dias é hipótese minha) e quem reconfirma.

---

## M7. Documentos do espaço, em três camadas

**Por quê.** Cada pessoa precisa de documentos diferentes. O guia FLE e a página do visto de estudante são iguais para toda a persona; o documento de matrícula da escola alvo é só dela. Misturar as três atrapalha.

**Como.**
1. **Padrão da persona:** vem do `biblioteca/manifesto.json` do app (campos `personas`, `fases`, `nivel`, `conferido_em`). Quem escolhe a trilha de visto de estudante recebe **automaticamente** o guia FLE, as capturas do France-Visas e a lista de documentos do visto.
2. **Lista do visto de estudante:** vira passos de checklist, cada um com fonte.
3. **Da escola alvo:** `escola_alvo` é dado da pessoa (campo no `dossie`). Espaço para a Ingryd ou a pessoa anexar o documento da escola que diz quais papéis a matrícula pede. O sistema **compara** com a lista do visto e destaca as diferenças.

- Item sem fonte ou sem data fica `a_conferir` e **não aparece para a pessoa**. Os "documentos da matrícula" ficam `a_conferir` até a comparação.
- O download pela pessoa vem depois (Storage privado com `tem_acesso()`/RLS), como já descrito em `biblioteca/README.md`.

**Proposta.** Começar só com o vínculo automático do padrão e o espaço da escola alvo (sem comparação). A comparação automática vem depois, quando houver pelo menos duas escolas.

---

## M8. Marcos com data e folga

**Por quê.** O prazo de inscrição na escola (30/11 ou 15/12) é o que pesa no caso. A fila precisa avisar com antecedência e saber quando o prazo está ambíguo.

**Como.** Tabela `marcos`: `contato_id`, `nome`, `data`, `data_alternativa?`, `certeza` (confirmada|a_confirmar), `fonte`, `acao_que_cumpre`.

- **Data `a_confirmar`:** o sistema avisa pela **mais cedo** e mostra a nota "confirme com a escola".
- **Folga** = dias até o prazo − tempo estimado das ações pendentes (hipóteses: pesquisa 3 dias, tradutora 10, documento da escola 5). Folga curta sobe a urgência.
- Avisos para a Ingryd em **D-14, D-7 e D-3** (hipóteses a calibrar).
- Reaproveitar `lembretes_prazo` e as funções de `prazos.js` do app; não duplicar a conta.

**Proposta.** Em aberto: avisar só pela data mais cedo ou mostrar as duas.

---

## M9. Faixa do caso e aba "Caso" (`casos`, `entregas`, `jornada_estado`)

**Por quê.** A Ingryd quer bater o olho na ficha e saber o que fazer. Hoje o caso, o que foi enviado e o estado da jornada ficam espalhados.

**Como.** Três tabelas novas, todas admin only (esboços em `docs/propostas/CASO-DADOS-E-CRM.md`, seção 3 do app):
- `casos`: o Bilan versionado (`conteudo jsonb` com as 10 seções, `estado`, `gerado_por`, `hash_entrada`, `custo_usd`).
- `entregas`: o que foi mandado (deck, documento, link, e-mail, cupom) e o status (`enviada|aberta|baixada|resgatada`).
- `jornada_estado`: foto escrita pelo app via `registrar_jornada()` (`security definer`, `auth.uid()`): ato, trilha, tom do timing, último dia de trabalho, próximo marco, pendências, último uso.

- **Faixa no topo da ficha:** ato, timing com palavra, próximo marco, o que espera por quem, sinal de vida, e **uma** ação sugerida com a regra à vista.
- **Aba "Caso"** (ao lado de Conversa, Ficha e Plataforma): resumo, decisões em ordem, entregas, perguntas em aberto por dono, regras usadas com fonte e data.
- Foto do app com mais de 7 dias acende "dado velho".

**Proposta.** Entrar depois de M1 a M8. A faixa com o que **já existe** (checklist, chat, assinatura, e-mails) pode sair antes, sem SQL novo.

---

## M10. Fila "Precisa de você": motivos novos

**Por quê.** Hoje a fila mostra urgência e dias parada. Falta o motivo escrito, que é o que diz o que fazer.

**Como.** Ajustar a view `crm_contatos` (ou uma função auxiliar) com motivos, cada um com a regra à vista:

| Motivo | Regra (hipótese) | Ação |
|---|---|---|
| Timing não cabe | `jornada_estado.timing_tom = nao_cabe/vencido` | Abrir a ficha, propor 1:1 |
| Dúvida sem resposta há 3 dias | `acoes_caso`/pergunta, dono = Ingryd, ≥ 3 dias | Responder |
| Teste termina em 5 dias sem plano | `assinaturas.status = trialing` e fim ≤ 7 dias | Lembrete do plano |
| Cupom enviado, não resgatado em 7 dias | `entregas` cupom sem `resgatado_em` | Lembrar ou deixar |
| Marco em 20 dias e sem uso do app há 10 | `proximo_marco_em` ≤ 20 e `ultimo_uso` ≥ 10 | Perguntar como está |
| Recado não visto em 2 dias | `recados_ingryd.estado = aprovado` e `visto_em` nulo | Lembrar |
| Pagamento falhou | `assinaturas.status = past_due` | Avisar |
| Caso sem revisão | `casos.estado = rascunho` ≥ 2 dias | Revisar |

**Proposta.** Os limiares são hipóteses para calibrar com os primeiros casos. No máximo 7 chips por tela; cada linha mostra nome, ato, motivo, dias e botão.

---

## M11. Dúvidas como gatilho para a pessoa voltar

**Por quê.** A Ingryd quer usar as dúvidas abertas de forma estratégica para trazer a pessoa de volta à plataforma, sem virar spam.

**Como.** Reaproveitar a tabela `sinais` (o app já lê com `meus_sinais()` e marca com `marcar_sinal_lido()`) para o aviso dentro do app, e o estúdio de e-mails para o e-mail. Cada notificação sai do CRM pronta, com a regra que a motivou, e **só envia com o "pode enviar"**.

| # | Gatilho | Mensagem |
|---|---|---|
| 1 | Pesquisa aprovada | "Achei a resposta da sua pergunta. Tem a fonte oficial" |
| 2 | Depois da ligação dela | "Como foi? Conte 3 coisas e seu cronograma se atualiza" |
| 3 | Pergunta em aberto que depende dela | "Falta só isto para destravar o seu prazo" |
| 4 | Contagem do prazo (D-14, D-7) | "Faltam N dias. O próximo passo é este" |
| 5 | Regra do caso mudou (discrepância) | "A regra que usamos no seu caso foi atualizada" |
| 6 | Pergunta de outras pessoas (regra dos 3, ≥ 3) | "Outras pessoas na sua situação perguntaram o mesmo" (agregado, sem identificar) |
| 7 | Marco cumprido | "Você concluiu isto. O próximo passo está liberado" |
| 8 | Dúvida que a plataforma não resolve | "Quer marcar um 1:1?" |

**Limites:** toda mensagem traz informação nova (nunca "você abriu o app?"); no máximo 1 a cada 3 dias por pessoa; depois de 2 mensagens sem abrir, a ação vai para a fila da Ingryd e a plataforma para de insistir.

**Proposta.** Em aberto: o limite de 1 a cada 3 dias vale quando o prazo é curto?

---

## M12. Aprendizado, funil por ato e painel

**Por quê.** Cada caso deve melhorar o próximo. Hoje não há onde registrar uma regra nova ou uma discrepância de fonte, e o funil não mostra em que parte da jornada as pessoas ficam paradas.

**Como.**
- Estender o `check` de `curadoria_fila.tipo` (hoje `pergunta`, `resposta`, `item`) com **`regra`** e **`discrepancia`**, com `payload` (fonte, nível, data). Discrepância de fonte **não espera** a regra dos 3.
- **Funil por ato** (1 fim do PVT, 2 estudante, 3 licence, "perdeu o ritmo") ao lado dos estágios atuais.
- **Painel de aprendizado** em Insights: discrepâncias abertas e há quantos dias, temas que se repetem, caminhos e desfechos, minutos da Ingryd por caso e por ato.
- O que vira conteúdo entra por **PR em `content/`** do app, com teste. O CRM nunca muda o app sozinho.

**Proposta.** Por último. Depende de haver casos suficientes para o painel dizer algo.

---

## M13. Privacidade (RGPD e LGPD)

**Por quê.** O caso é uma análise sobre a pessoa; precisa de finalidade e prazo de guarda.

**Como.**
- Nova finalidade de consentimento `acompanhamento_do_caso` (hoje `consentimentos.finalidade` aceita `servico` e `novidades_email`), com o texto exibido; **a Ingryd redige e quem cuida do jurídico revisa** antes de ir para `/entrar/`.
- Não guardar a transcrição; no Bilan, conclusões e trechos curtos.
- Retenção: decidir por quantos meses o caso fica depois de `concluido` ou `inativo`, e o que se anonimiza. Apagar o contato apaga `casos`, `entregas`, `jornada_estado`, `acoes_caso`, `recados_ingryd` em cascata.
- Documentos sensíveis (passaporte, diploma, extratos) por link, nunca no corpo do CRM.

**Proposta.** Em aberto: prazo de retenção e texto do consentimento.

---

## Ordem de entrega recomendada

| Fase | Entra | SQL novo |
|---|---|---|
| **0** | **Artefato de aprovação** (protótipo visual, dados fictícios) | Nenhum |
| **1** | M1 (Bilan fiel) e M2/M3 só com botões que preparam texto (`copiar_mensagem`, `confirmar`) | `acoes_caso` |
| **2** | M4 e M5: rascunho do roteiro, `recados_ingryd` e o pop-up no app | `recados_ingryd` |
| **3** | M6: pesquisas e banco de respostas | `pesquisas`, `respostas_base` |
| **4** | M7 e M8: documentos em camadas, marcos e folga | `marcos` |
| **5** | M9 e M10: faixa do caso, aba Caso e a fila com motivos | `casos`, `entregas`, `jornada_estado` |
| **6** | M11 e M12: gatilhos de retorno, aprendizado, funil por ato | altera `curadoria_fila` |

Cada fase termina com: SQL no banco de teste, sentinela e auditorias vazias, teste no navegador em 380 px, e o registro em `docs/DECISOES.md` (app) ou neste `PLANO.md`. Só depois produção.

## Decisões que são da Ingryd

1. Data ambígua de prazo: avisar só pela mais cedo, ou mostrar as duas?
2. Validade das respostas da base (hipótese: 90 dias) e quem reconfirma.
3. Quais ações a pessoa vê como suas (as de dono = ela) e quais ficam só no CRM.
4. Ver ou não a versão personalizada do recado (recomendo não ver).
5. Limite de uma mensagem a cada 3 dias vale com prazo curto?
6. Quais botões são premium.
7. Retenção do caso e texto do consentimento `acompanhamento_do_caso`.
8. Onde roda o "montar o caso" e o custo aceitável por leitura (Worker, com cache por hash).

Informação geral, não aconselhamento jurídico.
