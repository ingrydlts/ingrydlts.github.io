# Novo orçamento com PDF (design curto)

Aprovado pela Ingryd na conversa de 2026-11-24 ("pode seguir com a entrega 3, usa o jsPDF"). Terceira de três entregas.

## Intenção
O botão "Modelo de orçamento" da aba E-mail da ficha vira **"Novo orçamento"**: ela adiciona serviços e preços, marca desconto só nas
linhas que quiser (em % ou em valor), e o documento do orçamento sai completo em PDF, já anexado ao e-mail, com o texto do e-mail preenchido.

## Decisões
- **jsPDF 2.5.2** (MIT), escolhido por ela. Fica no repositório (`admin/crm/vendor/jspdf.umd.min.js`, integridade conferida no `vendor/LEIA-ME.md`), sem CDN e sem build,
  e só é carregado quando ela abre o orçamento (peso fora do orçamento de performance do CRM).
- A lógica (conta, texto do e-mail, nome do arquivo, PDF) está em `admin/crm/orcamento.js`, pura e testável em Node; a tela está no `crm.js`.
- Desconto por linha: % (maior que 0 e até 100) ou valor (maior que 0 e até o preço da linha). Desmarcou, o valor digitado é ignorado.
- Moeda: euro ou real, uma por orçamento. Validade em dias (padrão 15). Observações livres (ex.: forma de pagamento).
- O PDF é A4, visual Por Dentro (nome em serifada, fio dourado, tabela Serviço / Valor / Desconto / Total, total em faixa escura, assinatura "Ingryd · Por Dentro" em itálico).
  Usa as fontes padrão do PDF (sem fonte embutida): o sinal de menos é "-" porque o "−" não existe nelas.
- "Anexar ao e-mail" troca o orçamento anterior já anexado, preenche o texto (pergunta antes de trocar um texto já escrito) e o assunto (se vazio). "Baixar PDF" só baixa.
- Nada é salvo no banco: o orçamento vive no PDF e no e-mail enviado.

## Fora do escopo
- "A receber" (orçamento enviado e ainda não pago): exigiria tabela nova. Continua em aberto, a decidir por ela.
- Quantidade por linha, desconto no total, impostos, número sequencial (o número do PDF é ORC-AAAAMMDD-HHMM).
