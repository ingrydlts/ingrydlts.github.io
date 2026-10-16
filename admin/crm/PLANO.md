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
| Caixa de entrada (Perguntas únicas + Respostas: e-mail, toque no e-mail 2, página /conversa/) → "Abrir conversa" leva à aba Conversa da ficha | `perguntas_unicas`, `respostas_email` (`db/crm-fase0-email-guia.sql`) | perguntas: painel e formulário dos artigos prontos. Respostas por e-mail: chegam por `respostas@imigrantepordentro.com` (Email Routing → Worker `email()`), README do Worker seção 17 |
| Lembretes de prazo (Hoje) | `lembretes_prazo` (`db/crm-fase2c-lembretes.sql`) | pronto: a calculadora `[[PRAZO]]` dos artigos chama `pedir_lembrete_prazo`; o card mostra quem avisar nos próximos 7 dias |
| Reimpactar (segmentos) | coluna `segmento` de `crm_contatos` (regras na view) | pronto (envio via Worker → Brevo; ver README do Worker, seção 16) |
| Modelos de e-mail (estúdio: blocos, prévia com uma pessoa, teste, revisão, publicar, versões, Exportar) | `modelos_email`, `modelos_email_versoes` (`db/crm-modelos-email.sql` + `db/crm-estudio-emails-2.sql`); blocos em `estudio.js`; sem a migração, `TPLS` em `crm.js` | pronto; os 8 manuais abrem com o texto No ar da tabela (`TPLS` é reserva) |

## Extensão: prazo do VLS-TS (guia gratuito)

`db/crm-prazo-vlsts.sql` (rodar no SQL Editor do Supabase **depois** das fases 1, 1b e 2; idempotente):
`contatos.data_entrada`, `capturar_lead` aceitando `payload.data_entrada`, e `crm_contatos` com
`data_entrada`, `prazo_limite` e `dias_para_prazo`. Urgência **alta** = vence em até 30 dias ou venceu
há até 90; **média** = vence em 31 a 60 dias. O painel ordena por prazo dentro de cada urgência e tem o
filtro "Prazo VLS-TS curto". Modelos de e-mail `guia_chamada` e `guia_plataforma` (só para quem aceitou
novidades; o Worker também confere). Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:prazo`.

## Fase 0 — freebie Campus France (14/10)

`db/crm-fase0-email-guia.sql` (rodar **depois** de `crm-enriquecimento.sql`; idempotente): o guia
`etudes-en-france-2027-2028` grava o nível (`respostas.cfNivel`), o banco pede o e-mail 1 (`cf_guia_1`) ao Worker
pelo pg_net (desligado até existir o segredo `crm_worker_url` no Vault) e as respostas por e-mail entram em
`respostas_email`, com evento `email_respondido` e motivo "respondeu o seu e-mail" no Hoje. Passo a passo de ligar:
`cms-oauth-worker/README.md`, seção 17. Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase0`
e `node cms-oauth-worker/testes/crm-email.test.mjs`.

## Fase 1a — e-mail 2 do guia e página /conversa/ (15/10)

`db/crm-fase1a-conversa.sql` (rodar **depois** de `crm-fase0-email-guia.sql`; idempotente): `respostas_email.canal`
(`email`, `toque`, `pagina`), `crm_conversa_pendentes()` (quem recebe o e-mail 2 hoje, só service_role),
`crm_conversa_toque()` e `crm_conversa_texto()` (gravam o que vem da página; a cidade vai para `respostas.cfCidade`),
evento `email_respondido` com o canal e o motivo do "Precisa de você" por canal. O envio diário é o `scheduled()` do
Worker (Cron `0 13 * * *`, 10h de Brasília) e a página é `/conversa/`. Passo a passo: `cms-oauth-worker/README.md`,
seção 18. Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1a` e `node cms-oauth-worker/testes/crm-email.test.mjs`.
Fica para depois: o aquecimento (fase 1c).

## Fase 1b — aba Conversa na ficha e responder do CRM (15/10)

`db/crm-fase1b-resposta.sql` (rodar **depois** de `crm-fase1a-conversa.sql`; idempotente): as respostas que você manda da aba
Conversa ficam em `emails_enviados` com o modelo `resposta` e não contam no Reimpactar. A ficha tem as abas Conversa e Ficha;
a Conversa junta `emails_enviados` e `respostas_email` num fio só e responde por `POST /api/crm/responder` (Worker), com
`In-Reply-To`/`References` para cair na mesma conversa do Gmail. Passo a passo e o limite do Brevo: `cms-oauth-worker/README.md`,
seção 19. Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:fase1b` e `node cms-oauth-worker/testes/crm-email.test.mjs`.

## Estúdio de e-mails 1 — todos os modelos num lugar só (16/10)

`db/crm-modelos-email.sql` (rodar **depois** de `crm-fase1b-resposta.sql`; idempotente, não sobrescreve o que você mudou):
`modelos_email` (um por modelo: objetivo, tipo, como sai, quem recebe, variáveis), `modelos_email_versoes` (texto, prévia
e HTML de cada versão; etapa rascunho → revisao → no_ar → arquivado; uma No ar por modelo; versão que já saiu não muda
de texto), `modelo_email_nova_versao()`, `publicar_modelo_email()` e `emails_enviados.modelo_versao`. Os 10 modelos de
hoje entram como versão 1 No ar. O Worker lê a versão No ar de `cf_guia_1` e `cf_guia_conversa` e usa o texto do código
como reserva. Passo a passo: `cms-oauth-worker/README.md`, seção 20. Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:modelos` e `node cms-oauth-worker/testes/crm-email.test.mjs`.
Fica para as próximas entregas: o editor (2), criar modelo e sequências (3), números por modelo e versão (4).

## Estúdio de e-mails 2 — editar, testar e publicar (16/10)

`db/crm-estudio-emails-2.sql` (rodar **depois** de `crm-modelos-email.sql`; idempotente, só acrescenta): `blocos`, `testado_em` e
`testado_por` em `modelos_email_versoes`; a trava passa a valer também para os blocos e mudar o texto apaga o teste;
`modelo_email_nova_versao()` copia os blocos; o e-mail 1 ganha `{etapa}` e `{cidade}` na lista. A tela Modelos de e-mail vira o
estúdio (três colunas); `estudio.js` monta assunto, texto puro e HTML a partir dos blocos. "Enviar teste para mim" é
`POST /api/crm/modelo-teste` (Worker). Passo a passo: `cms-oauth-worker/README.md`, seção 21. Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio` e `node cms-oauth-worker/testes/crm-email.test.mjs`.
Fica para as próximas entregas: criar modelo novo a partir do objetivo e sequências (3), números por modelo e versão (4).

## Ficha: e-mails fidedignos e prévia real (16/10)

Sem SQL novo. `crm.js`: status `agendado` = "Enviado"; painel **E-mails** na ficha (último, próximo sugerido com miniatura,
sequência do guia Campus France e histórico), **Quem é ela** e **De onde veio** no lugar de "O que respondeu no funil"; o pop-up
de e-mail mostra o e-mail como ela vai ver (desenho da versão do estúdio ou o formato simples). Worker: `/api/crm/enviar` aceita
`html`. Passo a passo: `cms-oauth-worker/README.md`, seção 22.

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
6. **Fase 4 — score e automações**: preencher `contatos.score`; jornada por persona (conteúdo vem do Miro).

## Decisões que assumi (ajuste na view `crm_contatos` se discordar)

- **Urgência**: alta = `fase='urgente'` ou (`adaptando` + preocupação `prazo`); média = `adaptando`; baixa = o resto. O desenho fala em "prazo em menos de 60 dias", mas o funil guarda a data final do contrato só como token — sem data real não dá pra calcular.
- **Subpersona** = `contatos.caminho` (a escolha do pop-up de cada persona).
- **"Parada há N dias"** conta só o que a *pessoa* faz; e-mail, sinal ou mudança de estágio seus não zeram o contador.
- Visão "Au pair sem certificado" usa `apCertificado = 'nao'` (o desenho dizia "sem matrícula", campo que o funil não coleta).
