# Por Dentro — Website

## Isolamento entre clientes (não negociável)

O SQL de `admin/crm/db/` roda no mesmo Supabase do app. A regra completa está na seção "Isolamento entre clientes" do
`CLAUDE.md` do repositório **por-dentro-app**, e vale aqui. O essencial, para quando aquele repositório não estiver aberto:

- Tabela nova: RLS ligada, política pelo dono (`auth.uid()`, `meu_contato_id()`) ou pelo admin (`eh_admin()`),
  `revoke all ... from anon`.
- Função `security definer` nova: `set search_path`, `revoke ... from public` **e** `revoke ... from anon` (o Supabase dá
  EXECUTE direto a `anon`; tirar só de `public` não basta). Se o site público precisar chamá-la sem login, ela entra em
  `anon_pode` de `db/auditoria-isolamento.sql` (no app), com o motivo.
- Nada liga, busca ou devolve uma ficha pelo e-mail do token: só pelo e-mail confirmado de `auth.users`.
- Antes de propor o SQL: rodar os testes de `admin/crm/db/testes` com `APP_DB_DIR` apontando para `db/` do app, e o
  sentinela do app (`cd db/testes && npm test` lá).
- O SQL roda primeiro no Supabase de teste, depois no de produção. Depois de rodar, nos dois: pedir que ela rode
  `db/auditoria-isolamento.sql` e `db/conferir-banco.sql` (os dois do app) no SQL Editor. Os dois vazios = pronto.
  Tabela ou função nova entra na lista de `db/conferir-banco.sql` do app (`conferir-banco.test.mjs` reprova se não).

## Regras de página e de website (não negociável)

- **Nunca rolagem dentro de rolagem.** Nenhum bloco, lista, calendário ou painel usa `overflow-y: auto/scroll` nem `max-height`
  com rolagem dentro de uma página que já rola. Quem rola é a página. Se o conteúdo não cabe, encurta-se o conteúdo (resumo,
  "Ver todos" que leva à tela própria) ou divide-se em abas; não se esconde numa caixa com barra.
- **Página longa vira resumo + abas.** Tela com mais de ~5 blocos empilhados abre num **Resumo** (um cartão curto por seção:
  contagem, o mais urgente em uma linha, um botão de direcionamento) e uma barra de abas, com contagem em cada aba, para ir de
  seção em seção. Cada aba mostra uma seção só, em largura inteira.
- **Atenção primeiro.** Em cada seção, o que pede ação vem antes; a contagem da aba fica em destaque (vermelha) quando há urgência.
- **Verificar no navegador, sem rolagem interna:** ao entregar uma tela, conferir que só a página rola e que o Resumo cabe em
  cerca de uma tela no computador e vira uma coluna de cartões baixos no celular.
