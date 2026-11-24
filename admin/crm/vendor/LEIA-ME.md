# vendor/

- `jspdf.umd.min.js`: jsPDF 2.5.2 (MIT, licença em `jspdf.LICENSE`), copiado sem alteração de `dist/jspdf.umd.min.js` do pacote npm `jspdf@2.5.2`
  (integridade `sha512-myeX9c+p7znDWPk0eTrujCzNjT+CXdXyk7YmJq5nD5V7uLLKmSXnlQ/Jn/kuo3X09Op70Apm0rQSnFWyGK8uEQ==`).
  Só é carregado quando a Ingryd abre "Novo orçamento" (admin/crm/crm.js, `carregarJsPdf`); gera o PDF do orçamento no navegador.
  Para atualizar: baixe o `.tgz` da versão nova, confira a integridade, troque o arquivo e a linha acima.
