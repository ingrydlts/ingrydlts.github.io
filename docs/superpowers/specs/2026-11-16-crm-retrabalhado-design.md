# CRM retrabalhado — desenho

Origem: artefato https://claude.ai/artifact/PnND7aa3LNr4MMsNLqTmEk (versão 1794834812-352b), construído sobre o estado do repositório de 2026-11-15 (`?v=2026-11-15.8`).

## Intenção
Levar para o CRM real (`admin/crm/`) **tudo** o que o artefato desenvolveu, de uma vez, sem deixar nada de fora (decisão da Ingryd, 2026-11-16).

## O que entra (delta do artefato sobre o repositório)
| Área | Arquivos | Conteúdo |
|---|---|---|
| Hoje | `index.html`, `crm.js`, `crm.css` | Seletor de período (7d–6m); KPIs Novos leads, 1:1 marcados, Pessoas na plataforma, Revenue estimado; abas de seções (`hj-abas`: resumo, fila, agenda, msgs, caixa, procs, radar, guias, prazos); "Por onde começar" com filtro de categoria e ordem; calendário de 1:1 por mês; fila "Próximas mensagens da Equipe Por Dentro" em cartão |
| Contatos | `index.html`, `crm.js` | Coluna Potencial (0–100) ordenável |
| Ficha | `ficha.js`, `ficha-html.js`, `crm.js`, `crm.css` | Cabeçalho minimalista por tipo (`cartoesMinimos`: lead, assinante, plataforma); Potencial (`potencial`, `potAcao`); `urgentes`; ações da equipe (`caso_acoes`) como cartões; carrossel "Minhas próximas ações" com Adicionar/Concluídas; fila de hoje em dropdown com ‹ ›; sessões do app (Espaço, Guias, Perfil) e da pessoa (Só eu, O que ela trouxe, Mais detalhes); aviso no alto; caminho de e-mail, troca de e-mails e modelos em pop-up |
| Novo módulo | `panorama.js` | Panorama dela e "O que ela trouxe" (lógica e HTML puros, sem dados pessoais, `n<3` ⇒ "poucos dados") |
| Preços/artigos | `crm.js` | `carregarPrecos`, `carregarArtigos`, `receitaEstimada` (lê `um_a_um_pagamentos`, `assinaturas`, compras) |

## Fora do que entra (é só da prévia)
`mock-supabase.js`, `banco.json`, `posts-previa.json`, `produtos-previa.json`, `planos-previa.json`, e o invólucro HTML que o artefato adiciona a `index.html`. No `crm.js` real o import do cliente continua `/assets/js/supabase-client.js`.

## Restrições
- Sem build, sem dependência nova (stack estática do admin).
- **Sem SQL novo**: `um_a_um_pagamentos` já existe (`db/crm-1a1.sql`; consta no `conferir-banco.sql` do app). Se a execução revelar tabela/coluna nova, para e volta aqui: SQL segue a regra de isolamento (RLS, testes, staging antes de produção).
- Cache: o `?v=` volta em todos os imports e sobe para `2026-11-16.1`.
- Nenhum dado de pessoa real no repositório (site é público): fixtures de teste com nomes inventados.

## Abordagens consideradas
1. **Sobrepor os arquivos do artefato e aplicar uma transformação fixa** (troca do import do Supabase, `?v=`), cobrindo com testes. *Escolhida.* O artefato é cópia do repo + delta, então a sobreposição não perde commits de 15/11 e é auditável por diff.
2. Portar função por função à mão. Descartada: 1.450+ linhas, alto risco de omissão, contra "nada de fora".
3. Em fases. Descartada pela Ingryd.

## Aceite
- `diff` entre o artefato (menos o que é de prévia) e o repositório é só a transformação fixa.
- Todos os testes de `admin/crm/db/testes` que rodam sem banco passam; testes novos (panorama, cartoesMinimos, potencial, urgentes, receita) passam.
- O painel abre no navegador com o mock (fora do repositório), sem erro de console, nas telas Hoje, Contatos, Ficha (3 tipos) e Funil; prints conferidos.

## Deixado ao executor
Nomes dos testes novos; como carregar o mock no navegador para a conferência (fora do repositório).
