# CRM · "Y envios previstos" e a página de saúde (I06)

Data: 2026-11-14. Continua `2026-11-14-crm-quem-cascata-design.md`. Decidido com a Ingryd na conversa.

## Parte A · Y, envios previstos hoje

A linha "Hoje" mostra os **elegíveis** (conta no navegador, pelas regras) e passa a mostrar também **Y**: quantas pessoas
vão receber este modelo até o fim de hoje (Brasília), segundo o banco.

1. Y é calculado no banco, pela mesma consulta que o Worker usa para enviar. Uma função auxiliar `crm_sequencia_candidatos`
   concentra a consulta; `crm_sequencia_pendentes` (Worker) e `crm_sequencia_previstos` (editor) chamam a mesma. Sem cópia da regra.
2. Y conta quem **já acionou o gatilho** e ainda não recebeu: devido entre agora e 23:59 de hoje, respeitando consentimento,
   "Para quem" e a janela de 2 dias do Worker. Quem ainda não acionou o gatilho não entra.
3. Modelo com o Envio desligado: Y responde "se ligasse agora". A janela começa em agora, porque ligar o Envio recomeça a
   contagem e quem já passou da hora não recebe.
4. Modelo sem Envio automático (manual): sem Y.
5. `crm_sequencia_previstos(p_chave, p_agora)` só funciona para a administradora (`eh_admin()`); `anon` não executa.
6. **Correção junto:** o banco exclui de uma regra de etapa quem não marcou etapa (crm-filtro-etapa.sql). A estimativa no
   navegador contava essas pessoas como elegíveis. Passa a excluí-las, como o banco.

## Parte B · Página de saúde (I06) no CRM

Escopo: o CRM, o banco e o Worker. **Fora:** a página pública com o formulário, o link do Notion do mapa e o texto dos e-mails
(ficam no artefato "Templates de e-mail S2" e na página inbound, que ainda dependem de decisões em aberto).

1. Página nova **I06**, material `guia-saude-1`. As 4 portas (estudante, trabalho, aupair, outro) são o campo opcional
   "persona" da cascata, guardado em `contatos.respostas.porta`. Os 5 pontos são as etapas, no mesmo campo de sempre
   (`respostas.objetivo`): `sau-nao-cheguei`, `sau-sem-numero`, `sau-esperando`, `sau-sem-vitale`, `sau-completo`.
2. `para_quem` ganha a lista `portas`. Vazia = qualquer porta; com regra, quem não marcou porta não passa (igual às etapas).
3. `capturar_lead_guia` grava `respostas.porta` só se o valor está nas 4 portas; valor fora da lista é ignorado e não derruba
   o cadastro. `capturar_lead` não muda (o ponto já entra por `respostas.objetivo`).
4. `crm_sequencia_pendentes` entrega `respostas.porta` ao Worker e respeita `portas`.
5. O Worker passa a oferecer, sempre presentes (vazios para lead antigo): `porta_*` (4), `ponto_*` (5), `secao`,
   `assunto_persona` e `astucia_a0007`, `astucia_a0008`, `astucia_a0009`. Cada astúcia só é verdadeira para a persona dela e
   **antes de 14/02/2027** (data de revisão da aba Jornada); depois disso sai sozinha. Regras e assuntos copiados do artefato.
6. O editor oferece esses dados no catálogo do estúdio (`ES.VARS_NOVOS`, `ES.CAT`).

## Fora do escopo

- Página pública, Notion do mapa, os dois modelos de e-mail em rascunho, assunto do e-mail 2 por porta.
- Pacote de ciclo da Bússola e skill `ciclo-email`.

## Segurança (protocolo de isolamento do site e do app)

Função nova `security definer`: `set search_path`, `revoke … from public` e `from anon`. O helper não tem EXECUTE para ninguém.
Os SQL rodam primeiro no Supabase de TESTE, depois no de produção, e a Ingryd roda `auditoria-isolamento.sql` e
`conferir-banco.sql` nos dois. As funções novas entram na lista de `db/conferir-banco.sql` do app.
