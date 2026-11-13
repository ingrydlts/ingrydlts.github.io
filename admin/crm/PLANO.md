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
| Modelos de e-mail (estúdio: blocos, prévia com uma pessoa, teste, revisão, publicar, versões, Exportar, modelo novo pelo objetivo, sequências) | `modelos_email`, `modelos_email_versoes` (`db/crm-modelos-email.sql` + `db/crm-estudio-emails-2.sql` + `db/crm-estudio-emails-3.sql`; agrupamento por família/página/etapa/persona: `db/crm-taxonomia-modelos.sql` + `taxonomia.js`); blocos e objetivos em `estudio.js`; sem a migração, `TPLS` em `crm.js` | pronto; os 8 manuais abrem com o texto No ar da tabela (`TPLS` é reserva); sequências pelo Cron `5 * * * *` |
| Onboarding (documento → IA → ficha com Dossiê; botão Enviar link de pagamento na aba Plataforma) | Worker `/api/crm/onboarding/ler`, `/api/crm/link-pagamento`; `db/crm-onboarding.sql`, `db/crm-link-pagamento-email.sql`; `planos/planos.json` | pronto no código; falta rodar o SQL, configurar `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, repor créditos e preencher os links (README do Worker, seção 24) |
| Assinaturas e acesso (webhook do Stripe → assinatura na ficha → conta → e-mail de acesso; bloqueio do app por data) | Worker `/api/stripe/webhook`; `db/crm-assinaturas.sql` (`meu_acesso`), `db/crm-acesso-email.sql`; app: `assets/js/acesso.js`, `/plano/` | pronto no código (branch `claude/vigilant-clarke-8lrzo4` nos dois repositórios); falta rodar o SQL, criar o endpoint e o `STRIPE_WEBHOOK_SECRET` e publicar o app (README do Worker, seção 25) |

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

## Estúdio de e-mails 3 — modelo novo pelo objetivo e sequências (19/10)

`db/crm-estudio-emails-3.sql` (rodar **depois** de `crm-estudio-emails-2.sql` e `crm-emails-formato.sql`; idempotente, só acrescenta):
em `modelos_email`, `criado_no_estudio`, `objetivo_chave`, `para_quem` e a parte Envio (`envio_gatilho`, `envio_depois_de`, `envio_dias`,
`envio_hora`, `envio_ligado`, `envio_ligado_em`), com um gatilho que não deixa os 10 de antes ganharem Envio; `emails_enviados.sequencia`
(um e-mail de cada sequência por pessoa); `crm_registrar_compra()` (evento `compra`, botão da ficha); `crm_sequencia_pendentes()` (quem
recebe agora; só service_role) e `crm_contatos` com o reimpacto olhando só os 8 modelos do link de acesso. O catálogo de objetivos e os
esqueletos estão em `estudio.js` (`OBJETIVOS`); os 4 passos, o Envio e o Para quem em `crm.js`. O Worker roda as sequências no Cron
`5 * * * *` (`crmSequenciasRodada`). Passo a passo: `cms-oauth-worker/README.md`, seção 23. Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:estudio3` e `node cms-oauth-worker/testes/crm-email.test.mjs`.
Fica para depois: a compra pelo site entrar sozinha no CRM (hoje: Registrar compra na ficha), o lembrete de prazo sair sozinho na data,
botões de um toque em modelos novos e os números por modelo e versão (entrega 4).

## Textos dos modelos: prontos (19/10) e revisão (20/10)

`db/crm-modelos-prontos.sql` (gerado por `db/modelos-prontos.mjs`) cria todos os modelos em rascunho. `db/crm-modelos-revisao.sql`
(gerado por `db/modelos-revisao.mjs`; rodar **depois**; idempotente) dá a 19 deles uma versão nova em rascunho com a revisão de
texto aprovada em 20/10, e só se a versão mais nova ainda for a de 20/10 (o que foi mudado no estúdio fica). Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:prontos` e `npm run test:revisao`.
`db/crm-modelos-reimpacto.sql` (gerado por `db/modelos-reimpacto.mjs`; rodar depois da revisão): os 4 reimpactos reescritos com a
base da aula de CRO, em rascunho. Teste: `npm run test:reimpacto`.

## Estúdio: editar no e-mail (21/10)

Sem SQL novo. Na prévia de um rascunho, "Editar no e-mail" mostra o e-mail desenhado com cada texto editável no lugar (assunto,
prévia e blocos, com os {dados} à vista); guarda sozinho no mesmo rascunho e o campo do bloco acompanha. "Ver como chega" mostra
com os dados de uma pessoa. Versão No ar ou arquivada só mostra como chega. Código em `crm.js` (`edNoEmail`) e `crm.css` (`.ed-*`).

## Filtro por etapa do guia (21/10)

`db/crm-filtro-etapa.sql` (rodar **depois** de `crm-estudio-emails-3.sql` e `crm-modelos-prontos.sql`; idempotente, só acrescenta): o "Para
quem" dos modelos criados no estúdio ganha a regra **Etapa do guia** (`para_quem.etapas`, comparada com `contatos.respostas.objetivo`;
quem não marcou etapa não passa) e `crm_sequencia_pendentes()` respeita a regra. Os 12 rascunhos do aquecimento ganham a trilha, se
ainda não tiverem uma: A = não comecei e escolhendo o curso; B = juntando documentos; C = dossiê enviado e entrevista ou resposta.
Nada é publicado nem ligado. Os modelos novos passam a ter os sim/não `etapa_*` (bloco "Só para uma etapa"): `ES.VARS_NOVOS` e
`ES.ETAPAS_GUIA` em `estudio.js`, `crmVarsNovos` no Worker (colar o `worker.js` de novo no painel da Cloudflare). Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:etapa` e `node cms-oauth-worker/testes/crm-email.test.mjs`.

## Ficha: e-mails fidedignos e prévia real (16/10)

Sem SQL novo. `crm.js`: status `agendado` = "Enviado"; painel **E-mails** na ficha (último, próximo sugerido com miniatura,
sequência do guia Campus France e histórico), **Quem é ela** e **De onde veio** no lugar de "O que respondeu no funil"; o pop-up
de e-mail mostra o e-mail como ela vai ver (desenho da versão do estúdio ou o formato simples). Worker: `/api/crm/enviar` aceita
`html`. Passo a passo: `cms-oauth-worker/README.md`, seção 22.

Na mesma data: os 8 manuais saem com o template do Por Dentro (montado dos blocos), "ver o e-mail" abre o template e
`emails_enviados.formato` registra como saiu (`db/crm-emails-formato.sql`). README do Worker, seção 22b.

## Envio em minutos: recap do guia do tecnólogo (03/11)

`db/crm-sequencia-minutos.sql` (rodar **depois** de `crm-filtro-etapa.sql`; idempotente): `modelos_email.envio_minutos` (1 a 1440). Com ele, o
modelo de sequência sai N minutos depois da data-base de cada pessoa, e não em "dia + horário"; sem ele, tudo igual a antes. O primeiro uso é
`db/crm-modelo-tecnologo-recap.sql` (gerado por `db/modelo-tecnologo-recap.mjs`): o e-mail `tec_recap_30min`, tipo serviço, 30 minutos depois de
pegar o guia `guia-tecnologo`, com o link do checklist no Notion; fica em rascunho e com o Envio desligado. O estúdio ganhou o campo "Ou quantos
minutos depois" e o Worker o Cron Trigger `*/5 * * * *`. Passo a passo: `cms-oauth-worker/README.md`, seção 26. Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:minutos`.

## Taxonomia dos modelos (09/11)

`db/crm-taxonomia-modelos.sql` (rodar **depois** de `crm-sequencia-minutos.sql`, `crm-modelo-tecnologo-recap.sql`, `crm-modelos-chegada-au-pair.sql`,
`crm-link-pagamento-email.sql` e `crm-acesso-email.sql`, que criam modelos que ele classifica; idempotente): quatro colunas novas em `modelos_email`,
todas opcionais: `familia` (entrega, personalizado, aquecimento, serie, compra, acesso, reimpacto ou campanha), `pagina` (I01 a I04, as páginas do
site), `etapa` (o código da etapa marcada no guia, ex. `tec-nao-sei`; só existe junto de uma página) e `persona` (au_pair, pvt, estudante ou
conjuge). O SQL preenche os modelos que já existem pela mesma tabela que o painel usa no modo de reserva, e só o que está vazio. A tela de
modelos agrupa por família/página, ganha a barra de filtros e os campos de classificação no editor. O que não casa com nada cai em "Sem
classificação" (com o selo de atenção), nunca em "Outros".

Ao rodar o SQL de novo: vazio (null) não se distingue de "nunca classificado", então um modelo que ela deixou "sem família" de propósito volta a
receber a família se a chave casar com a tabela de reserva, os prefixos ou o tipo compra. E modelos criados por migrações rodadas depois do
arquivo ficam sem classificação até ele rodar de novo.

Desfazer: `alter table public.modelos_email drop column if exists familia, drop column if exists pagina, drop column if exists etapa,
drop column if exists persona;`. **Cuidado: isso apaga a classificação que ela fez à mão** depois que o SQL rodou.

`admin/crm/taxonomia.js` **espelha o vault** (`emails-por-pagina.json` e `ETAPAS_GUIA` em `estudio.js`): quando o Obsidian mudar uma página, uma
família ou uma etapa, atualize o arquivo **no mesmo dia**, senão a tela agrupa pelo desenho velho. O painel funciona antes e depois do SQL: sem as
colunas ele entra em modo de reserva (agrupa pela tabela do `taxonomia.js`, e os campos de classificação ficam desabilitados com um aviso).

Como rodar: primeiro no Supabase de **teste**, depois no de **produção**. Depois de rodar, nos dois, ela roda no SQL Editor
`db/auditoria-isolamento.sql` e `db/conferir-banco.sql` (os dois do repositório do app); os dois precisam voltar **vazios**. Testes: `db/testes` →
`APP_DB_DIR=<POR DENTRO APP>/db npm run test:taxonomia` (SQL) e `npm run test:taxonomia-ui` (agrupamento, filtros e modo de reserva).

## O caso da pessoa: compreensão, board e notificações do assistente (12/11)

`db/crm-caso.sql` (rodar **depois** de `crm-fase2.sql`, `crm-propostas.sql` e `crm-chat.sql`; idempotente, só acrescenta): quatro tabelas, todas só de
admin pela RLS. A pessoa não tem política nenhuma; ela entra só por funções que decidem por `meu_contato_id()`.

| Tabela | O que guarda |
|---|---|
| `caso_achados` | A compreensão da conversa: fato, dedução ou dúvida, com origem, certeza e estado (conferir, ok, descartado). Interna: ela nunca lê. |
| `caso_acoes` | A tabela Pendência × Canal do Notion. As dela, pela plataforma e publicadas, viram passos no Checklist. "Fora do CRM" não existe aqui. |
| `board_itens` | O que ela vê: escola, modelo, documento, marco e a cópia do bilan. `dados` é da equipe e `dados_dela` é o que ela preenche, cada um só com as chaves do tipo. |
| `caso_avisos` | As notificações do assistente (pergunta, proposta, inteligência, oferta), com a data que você decide: fixa, ou "N dias depois do primeiro acesso" (às 9h de Paris). |

O que o banco impõe sozinho, sem depender do painel: nada é publicado nem agendado sem consentimento `servico` da pessoa e sem passar pela revisão
(proposto → revisado → publicado); a resposta a uma pergunta só grava numa lista fechada de chaves de `contatos.respostas` e só como data ou uma das
opções; a pessoa lê tudo por `meu_caso()` (só o publicado e o liberado) e escreve por `responder_aviso()`, `salvar_dados_dela()`, `marcar_acao()`,
`marcar_aviso_lido()`, `adiar_aviso()` e `dispensar_aviso()`. Você publica e retira com `crm_board_publicar()` e `crm_board_retirar()` e agenda com
`crm_aviso_agendar()`. Tudo o que você faz (conferir, publicar, aprovar) fica na linha do tempo **sem** zerar o "parada há N dias"; o que a pessoa faz zera.

O app chama `caso_primeiro_acesso()` uma vez por sessão. Para o sininho acender no dia certo, agende `select public.crm_avisos_materializar();` uma vez por
dia, logo depois das 9h de Paris (Database → Cron). Sem isso o aviso continua visível no app; só o sininho não acende.

**Ainda por decidir** (marcado "conferir" no desenho): o fuso da liberação (hoje fixo em Paris), se o projeto usa Storage privado para os arquivos (hoje
o item tem um link https), qual consentimento libera as mensagens (hoje `servico`) e se o Checklist mistura os passos dela na tela ou grava em
`checklist_items` (a proposta é misturar). A rota do Worker que lê o Notion e grava os achados como rascunho, a aba "Caso" na ficha e a tela Espaço no app
ainda **não** foram escritas.

Como rodar: primeiro no Supabase de **teste**, depois no de **produção**. Depois de rodar, nos dois, ela roda no SQL Editor `db/auditoria-isolamento.sql` e
`db/conferir-banco.sql` (os dois do repositório do app); os dois precisam voltar **vazios**. O `conferir-banco.sql` já lista as tabelas e funções novas.
Testes: `db/testes` → `APP_DB_DIR=<POR DENTRO APP>/db npm run test:caso` (192 verificações) e `npm run test:conferir`.

Desfazer: `drop table if exists public.caso_avisos, public.board_itens, public.caso_acoes, public.caso_achados cascade;` e rodar `crm-propostas.sql` de
novo (devolve a lista de `crm_evento_recente()`). **Cuidado: isso apaga tudo o que foi guardado do caso.**

## Ficha-universo, fase 1 (12/11)

Reorganiza a ficha da pessoa com os dados que o CRM **já lê**: fila de hoje, header com funil de 7 etapas, abas Conversa / Plataforma / Ficha, sessões em pílulas, "Minhas próximas ações" em carrossel com pop-up e Checklist por démarche (só os 4 passos mais urgentes). **Não escreve SQL nem cria tabela. Sem dependência nova, sem build.** Spec e plano: repositório do hub, `docs/superpowers/specs/2026-11-12-ficha-universo-design.md` e `docs/superpowers/plans/2026-11-12-ficha-universo-fase-1.md`.

**Chave de ligação (a ficha antiga segue intacta e é o padrão):** `?ficha=2` na URL, ou `localStorage.setItem('crm_ficha_v2', '1')` no console. Sem a chave nada muda. Ligar por padrão é a Tarefa 15 do plano e só acontece depois da sua aprovação.

**Arquivos novos:** `ficha.js` (lógica pura: urgência, démarches, funil, ações, fila, ordem das sessões), `ficha-html.js` (HTML puro, tudo escapado), `processos.json` (cópia do bloco `processos` de `content/checklist-templates.json` do app; `db/testes/ficha-sync.test.mjs` compara com o app quando `APP_DIR` está definido), e em `db/testes`: `ficha.test.mjs`, `ficha-html.test.mjs`, `ficha-harness.mjs`, `crm-ficha-ui.test.mjs`, `ficha-sync.test.mjs`. `crm.js` só liga os dados e os eventos (`fichaV2Ativa`, `renderFichaV2`, `fichaClick`, `fxLive`); o CSS está na seção `/* Ficha v2 */` de `crm.css`.

**Desvios do spec assumidos nesta fase (a Ingryd confirma):**
1. A **prévia do app dela** (spec §5.1) fica para a fase 2 (só faz sentido com o board e o Material da equipe). A aba Plataforma tem as sessões, sem a coluna da prévia.
2. **"Meus passos" como démarche** (spec §5.4): o app de verdade põe o passo criado por ela na démarche onde ela o criou (categoria `meu:<chave>`). O CRM segue o app; o spec §5.4 deve ser corrigido.
3. **Funil clicável** (spec §3.1): na fase 1 a barra é derivada dos dados (só leitura). A mudança manual de etapa continua no seletor de estágio.
4. **Camada "para depois"** da urgência (spec §5.4): o CRM não conhece os guias do app; passos sem data entram juntos, depois dos datados.
5. **Sessões da fase 1:** Conversa com ela, Início (iAssistente), Checklist, Bilan, Dossiê, Histórico. Espaço, Guias, Perfil, Só eu, O que ela trouxe e Panorama chegam nas fases 2 a 5.

**Divergências do plano encontradas no código real (registradas, sem ampliar escopo):**
- Números de linha do plano estavam velhos (`renderPessoa` está perto da linha 2350, não 1978; `index.html` tem o `crm.js` na linha 226, não 221). Trabalhei pelos nomes das funções.
- O `?v=` novo é `2026-11-12.10` (o plano dizia `.1`, mas o atual já era `.9`; `.1` ordena antes e confundiria).
- `fichaFeedHtml` e `fichaMaisHtml` foram **extraídas** da ficha antiga (mesmo HTML, uma fonte só) para a aba Ficha da v2 reaproveitar; os testes antigos seguem verdes.
- Para não perder função que já existia: o **Pagamento** abre a aba Plataforma, os **processos sugeridos** (aprovar/descartar) ficam no topo da sessão Checklist (é para onde "Decidir o processo X" aponta) e o resumo do onboarding fica na aba Ficha.
- Ordem das pílulas de démarche: usa `ordem` do catálogo do app quando existe; chaves fora dela vão depois, em ordem alfabética.
- A fila mostra até 8 pessoas (resposta nova, processo para decidir ou urgência alta, mais a aberta). Só conta respostas por e-mail e processos; as mensagens não lidas do app só entram no carrossel da pessoa aberta (o CRM não carrega o chat de todas).
- O guia "Como ler esta tela" tem os 4 passos Fila, Minhas próximas ações, Abas e Sessões (o spec diz Esquerda/Direita, que dependem da prévia da fase 2).
- Dado velho (>48 h): banner na sessão Checklist, medido pelo último clique dela no checklist. Os outros blocos mostram skeleton, vazio e erro.
- `ficha.js` e `ficha-html.js` guardam o `?v=` do import por conta própria; ao subir a versão, trocar nos três lugares (`index.html`, imports de `crm.js`, import de `ficha-html.js`).

**Ainda fora da ficha v2 (só na antiga, por enquanto):** as sub-abas Caso, Espaço e Guias da Plataforma e o 1:1 pago; os botões "Já fiz", "Adicionar" e "Concluídas" do quadro de ações (precisam de onde gravar: fase 3); "Pedir acesso por e-mail" na pasta do Drive (modelo de mensagem, fase 3).

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

**Aba Caso (12/11):** na ficha, Plataforma → **Caso**. Mostra os achados (conferir, descartar, editar), as ações (publicar para ela as que são dela na plataforma, concluir pela equipe), o board (proposto → revisado → publicado, com link https opcional) e os avisos da IAssistente (aprovar e escolher dias após o primeiro acesso ou uma data fixa, 9h de Paris). Só leem e escrevem as tabelas do caso e chamam `crm_board_publicar`, `crm_board_retirar` e `crm_aviso_agendar`; consentimento e revisão são impostos pelo banco, a tela só mostra o motivo. Teste: `npm run test:caso-ui`. Ainda não há: criar item ou aviso do zero, nem escolas e modelos sugeridos sozinhos.

**O fluxo dos avisos e a entrega (12/11, `db/crm-caso-fluxo.sql`, rode depois de crm-caso.sql e crm-caso-importar.sql):** os avisos de cada pessoa formam uma **fila** com uma **pausa** em dias depois do aviso anterior (o primeiro conta do primeiro acesso dela). Ninguém digita data: ela nasce do anterior, às 9h de Paris. **Enviar agora** a próxima mensagem faz o resto da fila andar o mesmo tanto, e **atrasar/adiantar** um aviso muda a pausa dele e tudo depois acompanha, sempre mantendo as pausas combinadas. Data fixa vira âncora. A próxima mensagem de cada pessoa aparece na **Hoje** (bloco "Próximas mensagens da IAssistente") e no topo da aba **Caso**, com os botões. A entrega é a `crm_avisos_materializar()` chamada de hora em hora pela **pg_cron** (ligue em Database → Extensions e rode o arquivo de novo; sem ela o arquivo só avisa, e o aviso continua aparecendo no Espaço quando ela abrir o app, mas o sininho não acende sozinho). Teste: `npm run test:caso-fluxo`.

**O 1:1 pago (12/11, `db/crm-1a1.sql`, rode depois de crm-caso-fluxo.sql):** a pessoa escolhe 20 ou 40 min no chat e vai ao checkout (Payment Link do Stripe, com o metadado `por_dentro` = `1a1_20` ou `1a1_40`). Quando o Stripe avisa do pagamento, o Worker chama `crm_1a1_pago`: libera o áudio no chat por 30 dias e agenda o aviso "Antecipe o assunto do seu 1:1" para o dia seguinte, 9h de Paris. O áudio é transcrito no Worker (Workers AI, README do Worker, seção 32), nunca guardado, e a pessoa confere o texto antes de enviar. Teste: `npm run test:1a1`.

**Guias dela (12/11, `db/crm-caso-guias.sql`, rode depois de crm-caso-importar.sql):** a aba Guias do app tem três grupos que abrem e fecham: **Bilans das nossas conversas** (um por conversa, com a data e até 6 palavras-chave no resumo, para ela se lembrar do assunto antes de abrir), **Documentos que a equipe te manda** (cada um com o "o que é" e o botão Abrir, ou "chega em breve") e **Mensagens prontas** (cada uma com o nome e o "o que é"). Na aba Caso do CRM, **+ Documento**, **+ Mensagem pronta** e **+ Bilan** criam o item (entra como "proposto": você revisa e publica); Editar ajusta nome, "o que é", link, data e palavras; Remover (em dois toques) apaga o que ainda não foi publicado. A leitura do Notion cria um bilan por conversa (a chave leva o começo do id da página), com a data da ligação e as dores como palavras-chave. Teste: `npm run test:caso-guias`.

**Escolas que a pessoa acrescenta (12/11, `db/crm-escolas-dela.sql`, rode depois de crm-caso.sql):** no Espaço, o bloco "Escolas para você contatar" abre e fecha e tem um **+** sempre à vista: ela informa o nome, o link (https) e o que já sabe da escola (até 20 escolas). Entram em `escolas_dela` (só admin lê a tabela; a pessoa usa `minhas_escolas`, `adicionar_escola` e `remover_escola`). Você vê na aba Caso, em "Escolas que ela acrescentou" (só leitura). Teste: `npm run test:escolas-dela`.

**Fila minimalista e cabeçalho fixo (13/11, `docs/superpowers/specs/2026-11-13-crm-cabecalho-fixo-design.md`):** a Fila de hoje virou uma linha de chips (nome, urgência, "N nova(s)"). O cabeçalho da pessoa é fixo no topo e mostra cartões conforme o tipo: **lead** (estágio, parada há, e-mails, entradas, respostas, próximo e-mail), **assinante** (plano, próxima cobrança, assinante desde + uso da plataforma e checklist) e **na plataforma sem assinar** (sinais de lead + uso). O uso (`ficha-uso.js`) vem dos 300 cliques mais recentes: sessões nos últimos 30 dias, cliques por sessão e duração **estimada** (do 1º ao último clique); médias só com 3+ sessões. Sem SQL e sem mudança no Worker. **Ficou para depois:** valor mensal, ticket e LTV (exigem gravar valores do Stripe), nota 0–100 de engajamento (especialistas recomendaram sinais com contagem), função no banco para uso e totais por turma de parceiros.
