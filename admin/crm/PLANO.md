# CRM Por Dentro — do desenho ao backend

Desenho de referência: artefato **"CRM Por Dentro"** (claude.ai/artifact/64h3tuD8d7AbpaCTAWmRHE).
Backend: o **mesmo Supabase** do app (projeto `hslhpktfgxwfvljvsxkj`). Painel: estático, em `/admin/crm/`, sem build.

## Onde cada tela do desenho pega os dados

| Tela | Fonte | Situação |
|---|---|---|
| Hoje (KPIs, "Precisa de você", 1:1) | view `crm_contatos`, `perguntas_unicas` | pronto |
| Contatos (filtros, visões, CSV) | `crm_contatos`; rótulos de subpersona = `caminhos_opcoes` | pronto |
| Funil (kanban por estágio) | `crm_contatos.estagio` | pronto |
| Página da pessoa (feed, anotações, consentimento, mudar estágio) | `eventos`, `consentimentos`, `contatos.nota` | pronto |
| Marcar 1:1 / Enviar sinal | `um_a_um`, `sinais` (o app lê com `meus_sinais()`) | pronto no painel; **falta o dashboard do app mostrar o sinal** |
| Caixa de entrada (Perguntas únicas + Respostas por e-mail) | `perguntas_unicas`, `respostas_email` (`db/crm-fase0-email-guia.sql`) | perguntas: painel e formulário dos artigos prontos. Respostas por e-mail: chegam por `respostas@imigrantepordentro.com` (Email Routing → Worker `email()`), README do Worker seção 17 |
| Lembretes de prazo (Hoje) | `lembretes_prazo` (`db/crm-fase2c-lembretes.sql`) | pronto: a calculadora `[[PRAZO]]` dos artigos chama `pedir_lembrete_prazo`; o card mostra quem avisar nos próximos 7 dias |
| Reimpactar (segmentos) | coluna `segmento` de `crm_contatos` (regras na view) | pronto (envio via Worker → Brevo; ver README do Worker, seção 16) |
| Modelos de e-mail | `TPLS` em `crm.js` | pronto |
| Aba Conversa da pessoa (fio + contexto + responder) | `respostas_email` (com `canal`), `emails_enviados`, `mensagens` | planejada: fases 3b, 4b-4c e 5 |
| Acesso pago e pausa da conversa | `acessos`, `crm_config` | planejada: fase 5 (manual) e fase 6 (Stripe) |

## Extensão: prazo do VLS-TS (guia gratuito)

`db/crm-prazo-vlsts.sql` (rodar no SQL Editor do Supabase **depois** das fases 1, 1b e 2; idempotente):
`contatos.data_entrada`, `capturar_lead` aceitando `payload.data_entrada`, e `crm_contatos` com
`data_entrada`, `prazo_limite` e `dias_para_prazo`. Urgência **alta** = vence em até 30 dias ou venceu
há até 90; **média** = vence em 31 a 60 dias. O painel ordena por prazo dentro de cada urgência e tem o
filtro "Prazo VLS-TS curto". Modelos de e-mail `guia_chamada` e `guia_plataforma` (só para quem aceitou
novidades; o Worker também confere). Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:prazo`.

## Fase 0 — freebie Campus France (14/10) · concluída

`db/crm-fase0-email-guia.sql` (rodar **depois** de `crm-enriquecimento.sql`; idempotente): o guia
`etudes-en-france-2027-2028` grava o nível (`respostas.cfNivel`), o banco pede o e-mail 1 (`cf_guia_1`) ao Worker
pelo pg_net (desligado até existir o segredo `crm_worker_url` no Vault) e as respostas por e-mail entram em
`respostas_email`, com evento `email_respondido` e motivo "respondeu o seu e-mail" no Hoje. Passo a passo de ligar:
`cms-oauth-worker/README.md`, seção 17. Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase0`
e `node cms-oauth-worker/testes/crm-email.test.mjs`.

## Visão: a conversa com cada pessoa fica no painel dela (aprovada em 15/10)

Referência: artefato **"Jornada do freebie Campus France"** (claude.ai/artifact/RYWeEVQFLPLgGYWrJqbCEy),
seções "Proposta de 15/10" e "Próxima etapa". O que muda no desenho do CRM:

- **Uma conversa por pessoa, dentro da ficha dela.** A página da pessoa ganha a aba **Conversa**: um fio único, em
  ordem, com o que a Ingryd mandou (e-mails automáticos e respostas), o que a pessoa tocou num e-mail, o que
  escreveu na página `/conversa/` ou no app e o que respondeu por e-mail. Ao lado, o contexto para responder sem
  abrir mais nada: prazo do nível, etapa, cidade, de qual post veio, consentimentos, o que já fez, anotações.
- **A Ingryd responde da ficha.** Gratuitas: a resposta sai por e-mail, na mesma conversa do Gmail da pessoa
  (Reply-To `respostas@`, então a resposta dela volta para a ficha). Com acesso pago: a resposta vai para o app.
  A cópia de tudo continua chegando no e-mail da Ingryd.
- **Um e-mail, um objetivo.** O e-mail 1 (`cf_guia_1`) fica só com o checklist e a linha "Ficou com dúvida? É só
  responder". A apresentação e a pergunta viram um e-mail próprio, curto e visual (`cf_guia_conversa`).
- **Entrada única no banco.** Tudo o que a pessoa manda (e-mail, toque, página, app) entra em `respostas_email`
  com a coluna `canal`; tudo o que a Ingryd manda entra em `emails_enviados` (ou `mensagens`, no app). A aba
  Conversa só junta as duas fontes por `contato_id`.

Decisões de 15/10 (salvas no artefato): e-mail 2 só para quem aceitou novidades · sai no dia seguinte às 10h de
Brasília · pergunta a cidade (o curso vem na página) · aquecimento anda um dia (D+3, D+6, D+10, D+15) · painel e
conversa juntos num plano pago só · pagamento único por ciclo de candidatura · liberação manual no começo · aviso
"A Ingryd te respondeu" por e-mail · pausa geral + acesso por pessoa. **Em aberto:** o preço.

## Etapas

1. **Fase 1 — captura** (feita, repo POR-DENTRO-APP): `contatos`, `eventos`, `consentimentos`, `capturar_lead()`, `admins`.
2. **Fase 2 — banco do painel** (`db/crm-fase2.sql`, este repo): tabelas, view, gatilhos, rotina de inativos.
   - Rodar no SQL Editor do Supabase, **depois** dos arquivos da fase 1. Idempotente.
   - Cadastrar você como admin (bloco no fim de `crm-fase1.sql`).
   - Agendar `select public.crm_marcar_inativos();` 1x/dia (Database → Cron).
   - Testes: `db/testes` (PGlite, 64 verificações). `APP_DB_DIR=<POR-DENTRO-APP>/db npm test`.
3. **Fase 2b — painel** (`/admin/crm/`, este repo): já lê e escreve. Falta só rodar a fase 2 e testar com login real.
4. **Fase 2c — ligar as pontas** (fora deste repo):
   - App (`registrar_evento`): chamar `app_aberto`, `checklist_marcado`, `artigo_lido` — é isso que faz o estágio andar sozinho.
   - App: mostrar `meus_sinais()` no dashboard e chamar `marcar_sinal_lido()`.
   - Site: formulário "pergunta única" dos artigos → `supabase.rpc('enviar_pergunta_unica', { payload })` (feito, `assets/js/leads.js`).
   - Site: lembrete de prazo da calculadora → `supabase.rpc('pedir_lembrete_prazo', { payload })` (feito). Rodar `db/crm-fase2c-lembretes.sql` no Supabase **depois** da fase 2.
5. **Fase 3 — e-mail** (código pronto; falta configurar o Brevo — `cms-oauth-worker/README.md`, seção 16) (Cloudflare Worker em `cms-oauth-worker/` + provedor Resend/Brevo):
   - `POST /api/crm/enviar` (exige o token de admin): manda o e-mail e grava em `emails_enviados`.
   - Webhook do provedor → atualiza `status` (`entregue → aberto → clicado`) com service_role, só no Worker.
   - Só enviar novidades/reimpacto a quem tem `aceita_novidades = true`; link de descadastro grava `consentimentos` com `aceito = false`.
   - Ligar as telas Reimpactar e Modelos (o texto dos modelos está no artefato).
   - **3b — Conversa na ficha** (visão de 15/10; este repo):
     - Banco: `respostas_email.canal` (`email` | `toque` | `pagina` | `app`, padrão `email`) e
       `respostas_email.valor` (a opção tocada, ex. `lyon`). `emails_enviados.modelo = 'resposta'` para texto livre,
       com `em_resposta_a` (Message-ID da mensagem dela) para manter o fio.
     - Worker: `POST /api/crm/responder` (token de admin, como `/api/crm/enviar`): texto livre, sem exigir
       novidades (é resposta a algo que a pessoa escreveu; recusa se ela nunca escreveu), cabeçalhos
       `In-Reply-To`/`References` no Brevo e Reply-To `respostas@`. Guardar o Message-ID que o Brevo devolve.
     - Painel: aba Conversa na página da pessoa (fio + contexto + caixa de resposta com atalhos "link do
       checklist", "prazo dela", "agendar conversa"). Na Caixa de entrada, "Responder pelo e-mail" vira "Abrir
       conversa". Os painéis soltos "Respostas por e-mail" e "E-mails enviados" da ficha passam para dentro da aba.
     - Testes: `crm-email.test.mjs` cobre os cabeçalhos do fio; PGlite cobre `canal` e o evento `email_respondido`.
6. **Fase 4 — score e automações**: preencher `contatos.score`; jornada por persona (conteúdo vem do Miro).
   - **4a — Agendamento diário no Worker** (decisão 1 de 14/10): handler `scheduled()` + `crons` no
     `wrangler.toml`, 1x por hora; envia o que venceu, um por pessoa e modelo (mesmo índice
     `emails_um_por_guia_idx`), confere `aceita_novidades` e para quando a pessoa cria o painel ou pede "sair".
   - **4b — E-mail 2 · a conversa** (`cf_guia_conversa`): D+1 às 10h de Brasília, só com novidades. Foto da Ingryd
     (`/images/uploads/foto-de-perfil.jpg`, URL absoluta), "para qual cidade você quer ir?" e botões (Paris, Lyon,
     Toulouse, Montpellier, Bordeaux, Lille, Outra cidade, Ainda não sei). Cada botão leva a
     `/conversa/?r=<cidade>&t=<token>`; o token é HMAC do `contato_id` + validade (segredo `CRM_LINK_SECRET` no
     Worker), sem login.
   - **4c — Página `/conversa/`** (site): ao abrir no navegador (não no GET, por causa dos provedores que abrem
     links para checar segurança), chama `POST /api/crm/conversa` com o token, que grava o toque
     (`canal='toque'`; tocar de novo troca a resposta). Caixa "quer me contar o curso?" grava `canal='pagina'`.
     Estados: carregando, ok, link vencido, erro. Link para o checklist no fim.
   - **4d — Aquecimento** (`cf_aq_*`, textos da fase 1 da jornada): D+3, D+6, D+10, D+15, só com novidades.
7. **Fase 5 — Conversa no app** (visão de 15/10; banco e painel aqui, tela no repo POR-DENTRO-APP). Item pago,
   liberado à mão pela Ingryd enquanto a fase 6 não existe. Esforço estimado: 3 a 4 dias.
   - Banco: `mensagens` (`id`, `contato_id`, `autor` `pessoa`|`ingryd`, `texto`, `criado_em`, `lida_em`) com RLS:
     a pessoa lê e escreve só as dela (via `auth.uid()` → `contatos`), admin lê tudo. RPC `enviar_mensagem` checa
     acesso ativo e pausa geral, e limita a 20 mensagens por dia por pessoa. Gatilho cria `respostas_email` com
     `canal='app'` (entra na aba Conversa e no "Precisa de você" sem código novo no painel).
   - Acesso: tabela `acessos` (`contato_id`, `produto` `plano_ciclo`, `ciclo` ex. `2027-2028`, `inicio`,
     `valido_ate`, `origem` `manual`|`stripe`, `stripe_ref`, `criado_por`). A fase 5 só lê e a Ingryd preenche
     na ficha ("Liberar plano"); a fase 6 preenche pelo Stripe. A mesma tabela serve para os dois.
   - Pausa geral: linha em `crm_config` (`conversa_pausada`, `volta_em`). Pausada, o app mostra "conversa pausada,
     volto dia X" e o RPC recusa envio.
   - App (`dashboard/`): caixa "Conversa com a Ingryd" com histórico, campo de escrever, aviso fixo "As respostas
     não são imediatas. A Ingryd responde em até 48h." e os 4 estados (carregando, vazio, erro, pausada). Carrega
     ao abrir o painel; sem tempo real.
   - Responder: `/api/crm/responder` ganha `destino: 'app'`, grava em `mensagens` e manda o e-mail curto "A Ingryd
     te respondeu" com o link (sem o texto da resposta).
   - Quem não tem acesso continua conversando por e-mail (fase 3b).
8. **Fase 6 — Pagamento** (planejada; **não desenvolver agora**). Esforço estimado: 2 a 3 dias + revisão das CGV.
   - Produto: **um plano só, painel + conversa** (decisão 8), **pagamento único por ciclo de candidatura**
     (decisão 9), válido até o fim do ciclo (`acessos.valido_ate`). Preço: **a decidir**.
   - Consequência da decisão 8: o painel deixa de ser porta de entrada gratuita. As pontes `cf_guia_2a/2b/3`
     ("Montar meu painel") e a decisão 1 (pagamento) da proposta `CAMPUS-FRANCE-2027-JORNADA.md` do app precisam
     ser revistas antes de sair; o freebie e os e-mails gratuitos continuam como estão.
   - Enquanto isso (fase 5): link de pagamento do Stripe criado à mão; a Ingryd confere o pagamento e libera na ficha.
   - Automático: Stripe Checkout com `client_reference_id = contato_id` (o Worker já tem `stripeFetch` e o fluxo de
     `/api/purchase/*`) → webhook `checkout.session.completed` no Worker (assinatura do Stripe conferida,
     `STRIPE_WEBHOOK_SECRET`) → grava `acessos` com `origem='stripe'` com service_role. Reembolso
     (`charge.refunded`) encerra o acesso. Página de compra no app mostra o que inclui e o aviso de 48h.
   - Antes de ligar: CGV (`/cgv/`) e política de privacidade com o plano, o direito de retratação (14 dias, e o
     que vale se a pessoa já começou a usar a conversa nesse prazo) e o que acontece no fim do ciclo. Revisão da Ingryd.

## Decisões que assumi (ajuste na view `crm_contatos` se discordar)

- **Urgência**: alta = `fase='urgente'` ou (`adaptando` + preocupação `prazo`); média = `adaptando`; baixa = o resto. O desenho fala em "prazo em menos de 60 dias", mas o funil guarda a data final do contrato só como token — sem data real não dá pra calcular.
- **Subpersona** = `contatos.caminho` (a escolha do pop-up de cada persona).
- **"Parada há N dias"** conta só o que a *pessoa* faz; e-mail, sinal ou mudança de estágio seus não zeram o contador.
- Visão "Au pair sem certificado" usa `apCertificado = 'nao'` (o desenho dizia "sem matrícula", campo que o funil não coleta).
