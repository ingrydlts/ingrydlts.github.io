# Checklist do CRM: curadoria, editor e biblioteca de guias (design aprovado em 17/11/2026)

## Intenção
A Ingryd abre o Checklist de uma pessoa para **limpar, editar, posicionar e validar** os passos dela, e escrever uma vez o texto geral de cada passo de démarche para reaproveitar. Hoje: duas listas com desenhos diferentes, linhas técnicas, nada marca o que é geral e o que é só dela, e o texto geral só existe fixo nos templates do app.

## Fora de escopo / anti-objetivos
- Nada vai para a cliente sem a Ingryd conferir e publicar. A IA só sugere.
- Não copiar páginas inteiras: a IA resume o que está na página, com o link como fonte.
- Não mexer no que o app mostra para outras clientes além do texto geral que a Ingryd publicar.

## Decisões (da Ingryd)
1. **Navegação:** sem dropdowns. As sessões só se alcançam pelas pílulas "Ir para"; cada uma abre a página inteira (feito, commit ce1b2b0).
2. **Checklist reorganizado:** topo com progresso e filtro Todos/Gerais/Só dela; duas listas com o MESMO desenho de linha (⋮⋮ posição, ponto de estado, título, etiquetas Geral/Só dela + démarche, prazo, ✓ conferi, ✎ editar, ✕ esconder); faixa de validação com alertas e atalho para resolver (sem data, repetido entre geral e só dela, sem démarche).
3. **✎ abre o editor:** escolha de escopo (para todas da démarche, guardado na biblioteca / só para a pessoa), "Analisar link", campos (título, por que importa, atenção, passo a passo, links), prévia "Como ela vê", rodapé (conferi, restaurar original, rascunho, publicar).
4. **Biblioteca de guias gerais:** tabela nova no Supabase, escrita pelo CRM, lida pelo app (só o publicado). Aparece em todas as sessões do CRM que mostram o passo.
5. **Analisar link:** qualquer endereço (inclusive `share.google/aimode/...`). Se a página não carregar para o Worker (JavaScript, login), pede o texto colado.
6. **Curadoria é uma sessão própria ("Curadoria", logo depois do Checklist)** e vale no app (opção 1): esconder e ordem chegam à cliente; "conferido" é só da Ingryd. *(Leitura minha de "tudo até aqui aprovado"; a escolha explícita 1/2/3 não foi dada. Confirmar antes do SQL.)*

## Abordagem
Fases independentes, cada uma entregável e testável:
- **F1 (só CRM, sem banco):** Checklist unificado (linha única, etiquetas, filtro, alertas calculados no navegador).
- **F2 (banco + app):** `guias_gerais` (admin escreve; função `guias_gerais_publicos()` para o app) e editor do ✎; app aplica o texto publicado por cima do template.
- **F3 (banco + app):** `checklist_curadoria` (por pessoa e passo: oculto, ordem, conferido_em); app esconde e ordena.
- **F4 (Worker):** `POST /api/crm/guia/analisar` (admin; busca a página com guarda contra endereços internos, limite de tamanho e tempo; a IA devolve JSON validado; links só os que estão na página).
- **F5:** documentos "ela reúne" no Checklist, juntar repetidos, endurecer o robô do Notion/IA.

## Restrições
Isolamento entre clientes (RLS, `revoke ... from anon`, `set search_path`), SQL primeiro no teste e depois na produção, tabela/função nova entra em `db/conferir-banco.sql` do app. Sem chave no navegador. Conteúdo da página lida é dado não confiável (injeção de prompt).

## Deixado para quem constrói
Nomes de colunas, formato exato do JSON da IA, textos de alerta, ícones.


## Curadoria: o que foi construído (17/11/2026)
`db/crm-checklist-curadoria.sql` (tabela `checklist_curadoria`: oculto, ordem, conferido_em; função `minha_curadoria()` só com oculto e ordem), sessão Curadoria no CRM (↑ ↓ e arrastar, ✓ conferi, ✕ esconder, ✎ editar, faixa de validação, escondidos) e `assets/js/curadoria.js` no app (esconde e ordena). Passos só dela usam as ações que já existem (retirar) e a chave `aco:<id>` só para ✓.
