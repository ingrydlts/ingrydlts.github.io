# Resposta da aba E-mail no template Por Dentro (design curto)

Aprovado pela Ingryd na conversa de 2026-11-24 ("pode seguir com a entrega 1").

## Intenção
Toda mensagem escrita na aba E-mail da ficha (`POST /api/crm/responder`) sai no visual Por Dentro, com a assinatura
"Ingryd · Por Dentro". Hoje sai como texto simples em Arial (`crmTextToHtml`, worker.js), sem moldura nem assinatura.
É a primeira de três entregas (2: pop-ups dos indicadores + pagamento manual; 3: "Novo orçamento" com PDF).

## Objetivos
- O HTML da resposta usa a moldura dos modelos (`estudio.js` `montar`): fundo `#F4F1EC`, "Por Dentro" no topo, cartão `#FBFAF7`.
- O texto escrito vira o miolo do cartão; embaixo entra a assinatura "Ingryd · Por Dentro" em serifada itálica (a do bloco assinatura dos modelos), sem foto (pedido da Ingryd, 2026-11-24).
- A prévia ("Ver como vai chegar") mostra exatamente o mesmo HTML.
- O `textContent` (versão sem HTML) leva a assinatura em texto.
- O texto gravado em `emails_enviados.corpo` continua sendo só o que ela escreveu (sem moldura).

## Fora do escopo (anti-objetivos)
- Não mexer nos outros usos de `crmTextToHtml` (aviso de chat, convite, fallback de modelo). Só a rota `responder`.
- Sem rodapé de descadastro (é conversa 1:1).
- Sem editor de blocos, sem mudança de banco, sem mudança no fluxo de anexos.

## Abordagem
Uma única opção sensata: o Worker é colado no painel (sem build), então a moldura é uma função nova `crmMoldeResposta(texto)`
em `worker.js`, e uma cópia equivalente `moldeResposta(texto)` em `crm.js` para a prévia (mesmo padrão de duplicação já usado
com `crmPreencher`/`preencher`). Um teste confere que as duas geram o mesmo HTML. Alternativas descartadas: importar módulo
compartilhado (Worker não tem build); buscar a prévia no Worker (prévia deixaria de funcionar sem rede/sem sessão rápida).

## Decisões minhas (a conferir)
- Assinatura sem links extras (site/Instagram) por ora; a Ingryd pode pedir depois.
- Sem foto e sem logo em imagem: só o texto da assinatura.
- Texto escapado e links viram `<a>`, como hoje; quebras de linha viram `<br>`.
