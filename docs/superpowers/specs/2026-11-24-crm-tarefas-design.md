# CRM: acompanhamento de tarefas por pessoa e prazo (design)

Data: 2026-11-24 · Repositório: website (`admin/crm/`, `cms-oauth-worker/`) · Tamanho: projeto (SQL + Worker + tela).
Regra de privacidade: este documento não cita nenhum caso real. O repositório do site é público.

## Intenção e porquê
A Ingryd atende pessoas que nem sempre entram na plataforma (ainda não estão prontas, ou o serviço é feito fora dela).
Hoje ela não tem onde registrar "o que eu devo a cada cliente" com prazo, e se perde nas tarefas. Quer ver, de olhos,
o que vence e para quem, no CRM e no Google Calendar da conta de gestão, e mexer nisso rápido (mudar a data em 1 clique,
marcar como feita).

## Objetivos
1. Tarefa própria ("Só eu") com **prazo**, ligada à pessoa, independente de ela ter conta na plataforma.
2. Tela **Tarefas** com duas visões: por prazo (atrasadas / hoje / esta semana / depois) e por pessoa.
3. As mesmas tarefas na **ficha** da pessoa (a aba "Só eu" que já existe, agora com prazo e as mesmas ações rápidas).
4. Ações rápidas em qualquer lista: **mudar o prazo em 1 clique** (hoje, amanhã, +1 semana, escolher data) e **marcar como feita** (e desfazer).
5. Bloco **"Aceitou a plataforma?"** na ficha e filtro na lista: `aceitou` (tem conta, derivado de `user_id`), `ainda_nao` (padrão), `fora_da_plataforma` (atendida só por serviço). Os dois últimos são marcados à mão.
6. **Feed `.ics` assinável** no Google Calendar da ingrydigitalmanagement: cada tarefa aberta com prazo vira um evento de dia inteiro.

## Não objetivos e antiobjetivos
- Não escrever direto na API do Google Calendar (sem OAuth, sem segredo novo do Google).
- O Calendar é só leitura: editar é sempre no CRM. Tarefa feita some do feed.
- A cliente nunca vê tarefas "Só eu" (já é a regra do caso; não afrouxar).
- Não importar automaticamente tarefas das notas de reunião do Notion nesta entrega (fica como entrega futura; hoje se cria à mão).
- Antiobjetivo: um feed que vaze para fora. A URL do feed é segredo; sem token válido a resposta é 404.

## Restrições
- Site estático + Supabase + Worker; nada de chave no navegador.
- SQL novo segue "Isolamento entre clientes" (CLAUDE.md): RLS ligada, política `eh_admin()`, `revoke all ... from anon`, função `security definer` com `set search_path` e `revoke` de `public` e `anon`. Roda primeiro no Supabase de teste. Rodar os testes de `admin/crm/db/testes` e o sentinela do app; depois `auditoria-isolamento.sql` e `conferir-banco.sql`.
- O feed `.ics` é chamado pelo Google sem login, então só o Worker (chave de serviço) lê o banco para montá-lo, validando o token em tempo constante.
- Limitação aceita pela Ingryd: o Google atualiza feeds assinados a cada ~12–24 h; uma tarefa criada hoje pode demorar a aparecer.

## Abordagens consideradas
- **A. Feed `.ics` assinável (escolhida pela Ingryd).** Sem OAuth e sem chave do Google; atraso de atualização do lado do Google.
- B. Escrever na API do Google Calendar a partir do Worker. Imediato, mas OAuth, segredo novo e token que expira a cada 7 dias em modo de teste.
- C. Sincronizar sob demanda por uma sessão com conector. Sem código, mas não automático.

## O que já existe e será reaproveitado
- `caso_acoes` (por `contato_id`), com `dono='ingryd'`, `canal='so_eu'`, `estado`, `prazo` (data), `prazo_texto`, `prazo_a_confirmar`. A tarefa nova é uma linha dessa tabela; não nasce tabela de tarefas.
- `fxAddAcao` (`crm.js`) cria a tarefa "Só eu"; hoje só com título. Passa a aceitar prazo.
- Rota de Worker `/api/crm/*` e o padrão de chave de serviço já usados pelo CRM.

## Decisões de como (minhas, a Ingryd não escolheu)
- Reaproveitar `caso_acoes` em vez de criar tabela: mantém "Só eu", quadro e ficha já funcionando.
- "Aceitou a plataforma": coluna nova em `contatos` (`situacao_plataforma`, texto com check dos 3 valores, padrão `ainda_nao`); `aceitou` na tela é calculado de `user_id` e prevalece sobre o valor gravado.
- Feed: `GET /api/crm/tarefas.ics?t=<token>`; token gerado uma vez, guardado como secret do Worker (`TAREFAS_ICS_TOKEN`); evento `UID` estável por tarefa (`<id>@pordentro`) para o Google atualizar em vez de duplicar; título "Nome · tarefa"; sem corpo com dados sensíveis, só link de volta à ficha.
- Tarefa sem prazo não vai ao feed e aparece num grupo "Sem prazo" na tela.
- Mudar prazo e marcar como feita atualizam `caso_acoes` direto pelo cliente Supabase (RLS de admin), como `fxFeitoAcao` já faz.
- Tela nova "Tarefas" como aba do CRM, com os 4 estados da interface (carregando, vazio, erro, dado velho não se aplica) e boa em 380 px (visão por pessoa vira cartões).

## Deixado para quem constrói
Nomes exatos de funções e CSS, textos dos botões, ordem dentro de cada grupo, formato do seletor de data, e como migrar o filtro "aceitou a plataforma" para a lista existente.

## Critérios de pronto
Criar tarefa com prazo para pessoa sem conta; vê-la na tela Tarefas e na ficha; mudar prazo em 1 clique e marcar feita refletem nas duas; o feed `.ics` abre no Google Calendar e mostra a tarefa; sem token o feed dá 404; testes de isolamento verdes; SQL rodado antes no banco de teste.
