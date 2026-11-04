# Mapa de e-mails do CRM (2026-11-04)

> Documento de desenho, **não é código**. Mostra como o lead que preenche um guia vira e-mails no CRM hoje, o que deu errado com o guia do tecnólogo e o que muda. Os diagramas são Mermaid (o GitHub desenha). As imagens prontas estão no Notion.

## O problema, em uma frase
Um lead que **acabou de chegar** (ainda não qualificado) recebeu o e-mail de acesso à plataforma, com o "checklist de campus france", porque a ficha não reconhece o guia do tecnólogo e cai nas boas-vindas. A regra de "qual e-mail para qual público" mora em 3 lugares, e dois deles não sabem do guia novo.

## Por que aconteceu (no código)
- `admin/crm/crm.js`, `guiaTpl(origem)`: só conhece `guia-vls-ts` e `guia-email-alt30`. Para `guia-tecnologo` devolve vazio.
- `defaultTpl(c)` então usa `boas_vindas` (o link da plataforma, "{checklist de <persona>}"). `proximoEmail()` mostra "Primeiro contato: pode enviar agora" e o botão envia sem a pessoa ver o que vai.
- O banco só pede o e-mail 1 automático para o guia Campus France (`crm_guia_email_pedir`).
- O guia do tecnólogo grava `persona = campus_france`, e isso faz o texto e o link da plataforma falarem de Campus France.

## 1. Hoje: o que aconteceu
```mermaid
sequenceDiagram
  autonumber
  actor L as Lead
  participant P as Landing do guia
  participant B as Banco capturar_lead_guia
  participant C as Ficha do CRM crm.js
  participant W as Worker e Brevo
  participant A as Plataforma app
  L->>P: nome, e-mail e etapa
  P->>B: origem guia-tecnologo, persona campus_france, etapa tec-*
  B->>B: grava contato e evento email_capturado
  Note over B: e-mail 1 automático só existe para o guia Campus France
  B-->>P: ok
  P-->>L: checklist liberado na página
  C->>C: próximoEmail chama guiaTpl guia-tecnologo
  Note over C: guiaTpl só conhece 2 guias e devolve vazio
  C->>C: cai em boas_vindas, o link da plataforma
  C-->>C: Primeiro contato: pode enviar agora
  C->>W: enviar boas_vindas
  W-->>L: Aqui está o link do seu checklist de campus france
  L->>A: clica
  A-->>L: checklist de Campus France, nada a ver com o tecnólogo
```

## 2. Alvo: do formulário ao e-mail certo
```mermaid
sequenceDiagram
  autonumber
  actor L as Lead
  participant P as Landing
  participant B as Banco
  participant R as Registro de funis
  participant C as CRM ficha e insights
  participant W as Worker e Brevo
  L->>P: nome, e-mail e etapa
  P->>B: capturar_lead_guia, origem guia-tecnologo
  B->>R: qual funil tem esta origem?
  R-->>B: público, etapas tec-* e recap em 30 min
  B->>B: grava contato, evento e etapa
  B-->>P: ok
  P-->>L: checklist liberado
  Note over W: Cron a cada 5 minutos
  W->>B: quem deve receber agora?
  B-->>W: Lead, tec_recap_30min
  W-->>L: Recap com o link do checklist, 30 min depois
  L->>W: abre ou clica
  W->>C: evento de e-mail aberto ou clicado
  C->>C: classifica: novo, em aquecimento ou qualificado
  Note over C: só quem for qualificado recebe convite da plataforma ou 1:1
  W-->>L: e-mails 2 e 3 conforme a etapa tec-*
```

## 3. Estados do lead e do e-mail (alvo)
```mermaid
stateDiagram-v2
  state "Lead novo, não qualificado" as Novo
  state "Recap do checklist, 30 min" as Recap
  state "Aquecimento pela etapa" as Aq
  state "Lead qualificado" as Q
  state "Convite da plataforma" as Pl
  state "Em uso no app" as Uso
  state "Conversa 1:1" as UmUm
  state "Reimpacto" as Re
  state "Inativo" as In
  [*] --> Novo: preenche o formulário
  Novo --> Recap: 30 min depois
  Recap --> Aq: etapa conhecida
  Aq --> Q: responde, clica 2 vezes ou volta a pedir material
  Q --> Pl: convite do app
  Q --> UmUm: marca a conversa
  Pl --> Uso: abre o app
  Aq --> Re: não abriu há 3 dias
  Re --> Aq: voltou a abrir
  Re --> In: sem sinal
  Uso --> In: parado há 7 dias
  In --> Re: reimpacto manual
```

## 4. Modelo de dados: registro de funis (alvo)
```mermaid
classDiagram
  direction LR
  class Contato {
    email
    nome
    persona
    estagio
    respostas_objetivo
    origens
  }
  class Funil {
    slug
    origem
    público
    recap_minutos
    pagina
  }
  class EtapaDoFunil {
    chave tec-nao-sei
    rotulo
    trilha
  }
  class ModeloEmail {
    chave
    tipo servico_novidades_compra
    para_quem
    envio_gatilho
    envio_minutos_ou_dias
  }
  class VersaoDoModelo {
    etapa rascunho_ou_no_ar
    blocos
  }
  class Evento {
    tipo email_capturado
    origem
  }
  class EmailEnviado {
    modelo
    status
  }
  Funil "1" --> "*" EtapaDoFunil : tem
  Funil "1" --> "*" ModeloEmail : sequência
  ModeloEmail "1" --> "*" VersaoDoModelo
  Contato "1" --> "*" Evento
  Contato "1" --> "*" EmailEnviado
  Evento ..> Funil : a origem identifica
  EtapaDoFunil ..> ModeloEmail : filtro etapas
```

## 5. Onde mora a regra do e-mail
```mermaid
flowchart LR
  subgraph HOJE["Hoje: a regra do e-mail mora em 3 lugares"]
    direction TB
    A1["crm.js guiaTpl: 2 guias fixos no codigo"]
    B1["Worker: e-mails 1 e 2 do Campus France no codigo"]
    C1["Estúdio: modelos com Envio, em dados"]
  end
  subgraph ALVO["Alvo: um registro de funis, lido por todos"]
    direction TB
    R["Registro de funis"]
    R --> A2["Ficha: próximo e-mail certo"]
    R --> B2["Worker: sequências"]
    R --> C2["Motor de insights da ficha"]
  end
  HOJE ==> ALVO
```

## 6. Decisão do próximo e-mail na ficha (alvo)
```mermaid
flowchart TD
  S(["Ficha aberta"]) --> Q1{"Ela respondeu algum e-mail?"}
  Q1 -- sim --> R1["Responder na aba Conversa"]
  Q1 -- nao --> Q2{"A origem tem um funil?"}
  Q2 -- nao --> M4["Boas-vindas só se ela pediu acesso ao app"]
  Q2 -- sim --> Q3{"Já recebeu o recap?"}
  Q3 -- nao --> M1["Recap do funil: sai sozinho em 30 min"]
  Q3 -- sim --> Q4{"Está qualificada?"}
  Q4 -- nao --> M2["Próximo e-mail da trilha pela etapa, sem link de plataforma"]
  Q4 -- sim --> M3["Convite da plataforma ou 1:1"]
  M1 --> V["Antes de enviar: prévia obrigatória"]
  M2 --> V
  M3 --> V
  M4 --> V
```

## 7. Mapa de e-mails por origem

| Origem | Público | E-mails hoje | O que falta |
|---|---|---|---|
| `guia-etudes-en-france-2027` | Campus France, etapas `cf-*` | `cf_guia_1` (na hora, pede o Vault configurado), `cf_guia_conversa` (D+1 10h), `aq_a/b/c` D+3, D+6, D+10, D+15 pela etapa | Aquecimento nasceu em rascunho com o Envio desligado; `aq_c_d10` pede o link do presente CF09 e os D+15 as 3 dúvidas mais comuns |
| `guia-vls-ts` | Já na França, prazo de 3 meses | `guia_chamada`, `guia_plataforma`, `lembrete_prazo_vlsts` (todos manuais) | Sem sequência automática |
| `guia-email-alt30` | Alternância depois dos 29, etapas `alt-*` | `guia_alternancia` (manual, customizado pela etapa) | Sem recap e sem sequência |
| `guia-tecnologo` | Tecnólogo do Brasil, etapas `tec-*` | `tec_recap_30min` (pronto, falta ligar) | A ficha sugere `boas_vindas`; e-mails 2 e 3 por etapa não existem |
| Compra: Hub de Estudos | Comprou o Hub | `hub_estudos_compra`, `hub_estudos_d3`, `hub_estudos_lancamento` (manual) | Depende de registrar a compra na ficha |
| Sem guia (instagram, bot, blog, direto, artigo) | Funil geral ou artigo | `boas_vindas`, `naoabriu`, `naoclicou`, `cliquenaoapp`, `parouapp` (manuais) | Boas-vindas só faz sentido para quem pediu acesso ao app |

## 8. O que muda, em ordem (para aprovar)
1. **Registro de funis** (uma tabela): para cada origem, o público, as etapas, o e-mail de recap e a trilha. A ficha, o Worker e o motor de insights leem dele. É SQL e segue a regra de isolamento (teste do sentinela, staging, produção).
2. **Ficha** (`crm.js`): `guiaTpl` passa a ler do registro; lead de funil nunca recebe `boas_vindas` nem link de plataforma como primeiro contato; **prévia obrigatória** (assunto, corpo e para onde o link vai) antes de qualquer envio.
3. **Qualificação** calculada no banco, usada pelo motor de insights. Proposta de regra: qualificado = respondeu um e-mail, **ou** clicou em 2 ou mais e-mails, **ou** voltou a pedir material, **ou** marcou 1:1. Só qualificado recebe convite da plataforma ou do 1:1.
4. **Persona do lead do tecnólogo**: não gravar `campus_france` no cadastro do guia; a persona entra quando a pessoa pede a plataforma.
5. **E-mails 2 e 3 do tecnólogo** por etapa (`tec-*`), depois do recap.

## Implementado: registro de funis e e-mail por etapa (guia do tecnólogo)

- `admin/crm/funis.js` é o registro: para cada origem de guia (`guia-tecnologo`, `guia-etudes-en-france-2027`, `guia-vls-ts`, `guia-email-alt30`) diz as etapas, o modelo manual e, nos guias automáticos, o e-mail do guia + a trilha por etapa. A ficha (`crm.js`) lê dele: quem chega por um guia automático **nunca** recebe a sugestão de boas-vindas com o link da plataforma; a ficha mostra "o e-mail do guia sai sozinho em 30 min" (ou avisa que o Envio está desligado).
- Tecnólogo: 4 etapas (`tec-nao-sei`, `tec-juntando`, `tec-escrevi`, `tec-resposta`). O 1º e-mail (`tec_recap_30min`, 30 min depois) já fala da etapa marcada; 3 dias depois sai o e-mail só daquela etapa (`tec_d3_*`, só para quem aceitou novidades).
- Ativar, nesta ordem: `crm-sequencia-minutos.sql` → `crm-modelo-tecnologo-recap.sql` → `crm-modelos-tecnologo-etapas.sql` → `crm-modelos-prontos.sql` (catálogo de variáveis) no Supabase de teste e depois no de produção; colar o `worker.js`; cron `*/5 * * * *`; no Estúdio, revisar, publicar e ligar o Envio dos 5 modelos.
- Testes: `npm run test:funis`, `test:tecnologo`, `test:minutos` (em `admin/crm/db/testes`, com `APP_DB_DIR` apontando para `db/` do app).
- Próxima fase: registrar Campus France, alternância 30+ e VLS-TS com recap + trilha por etapa (mesmo desenho), e a regra de qualificação antes de convidar para a plataforma.
