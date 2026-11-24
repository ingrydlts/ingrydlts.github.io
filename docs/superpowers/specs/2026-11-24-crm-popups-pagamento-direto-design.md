# Pop-ups dos indicadores da Hoje e pagamento direto (design curto)

Aprovado pela Ingryd na conversa de 2026-11-24 ("pode seguir com a entrega 2"). Segunda de três entregas.

## Intenção
Cada um dos quatro blocos do topo da Hoje (Novos leads, 1:1 marcados, Pessoas na plataforma, Revenue estimado) abre um pop-up com
quem compõe o número, no mesmo período do seletor. O do revenue mostra valor + serviço de cada pagamento. O que a pessoa paga direto
(orçamento, Pix, transferência), sem Stripe, é registrado à mão e entra no mesmo revenue.

## Decisões
- Sem mudança de banco: a tabela `pagamentos` (db/crm-pagamentos.sql) já aceita lançamento da admin (`referencia = 'manual-<forma>-<id>'`, `tipo = 'outro'`).
  A forma (Pix, Transferência, Dinheiro, PayPal, Outro) vai dentro da referência; origem = "direto" quando começa com `manual-`, "Stripe" quando não, "estimado" para compra/mensalidade sem registro.
- Os blocos continuam `div` (role=button, tabindex=0, Enter/Espaço), tratados pelo ouvinte de clique já existente.
- "Registrar pagamento": no pop-up do revenue (escolhe a pessoa) e no cabeçalho da ficha (pessoa fixa). Campos: pessoa, serviço, valor ("70" ou "1.200,50"), moeda (€ ou R$), data, forma.
- Só pagamento lançado à mão tem "Apagar" (pela referência). O do Stripe e o estimado não se apagam por aqui.
- Total em € continua somando só euro; real aparece à parte, como já era.

## Fora do escopo
- "A receber" (orçamento enviado, ainda não pago): exigiria tabela nova; fica para depois da entrega 3, se ela quiser.
- Nenhuma mudança no Worker.
