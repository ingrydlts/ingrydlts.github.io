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
| Perguntas únicas | `perguntas_unicas` | painel e formulário do fim dos artigos (`assets/js/leads.js`) prontos; falta o **envio da resposta por e-mail** (fase 3) |
| Lembretes de prazo (Hoje) | `lembretes_prazo` (`db/crm-fase2c-lembretes.sql`) | pronto: a calculadora `[[PRAZO]]` dos artigos chama `pedir_lembrete_prazo`; o card mostra quem avisar nos próximos 7 dias |
| Reimpactar (segmentos) | coluna `segmento` de `crm_contatos` (regras na view) | pronto (envio via Worker → Brevo; ver README do Worker, seção 16) |
| Modelos de e-mail | `TPLS` em `crm.js` | pronto |

## Extensão: prazo do VLS-TS (guia gratuito)

`db/crm-prazo-vlsts.sql` (rodar no SQL Editor do Supabase **depois** das fases 1, 1b e 2; idempotente):
`contatos.data_entrada`, `capturar_lead` aceitando `payload.data_entrada`, e `crm_contatos` com
`data_entrada`, `prazo_limite` e `dias_para_prazo`. Urgência **alta** = vence em até 30 dias ou venceu
há até 90; **média** = vence em 31 a 60 dias. O painel ordena por prazo dentro de cada urgência e tem o
filtro "Prazo VLS-TS curto". Modelos de e-mail `guia_chamada` e `guia_plataforma` (só para quem aceitou
novidades; o Worker também confere). Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:prazo`.

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
