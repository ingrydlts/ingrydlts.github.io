// Apps Script do funil de insights do Assistente de Vistos.
//
// Como instalar:
// 1. Crie uma Google Sheet nova. Na primeira aba, renomeie para "Respostas" e
//    cole na linha 1, exatamente nesta ordem, os cabeçalhos:
//    sessionId | created_at | updated_at | nome | instagram | ue | idade | jaEsta |
//    objetivo | tipo | vpfPais | prontidao | resultado | ultima_etapa | cta_clicado | origem
//
// Se a planilha já existe (com as colunas antigas, sem "origem"): só adicione
// "origem" numa nova coluna no FINAL da linha 1 — não precisa mexer nas colunas
// existentes nem nos dados já registrados.
// 2. Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo inteiro.
// 3. Implantar > Nova implantação > tipo "App da Web".
//    - Executar como: Eu (seu usuário)
//    - Quem pode acessar: Qualquer pessoa
// 4. Autorize as permissões pedidas (é a sua própria planilha).
// 5. Copie a URL do App da Web (termina em /exec) e cole em CONFIG.insightsUrl,
//    no <script> do assistente-vistos.html.
//
// Cada requisição do quiz manda o estado inteiro da sessão; esta função localiza
// a linha pelo sessionId e sobrescreve só os campos recebidos, senão cria a linha.

var SHEET_NAME = 'Respostas';
var HEADERS = ['sessionId', 'created_at', 'updated_at', 'nome', 'instagram', 'ue', 'idade',
  'jaEsta', 'objetivo', 'tipo', 'vpfPais', 'prontidao', 'resultado', 'ultima_etapa', 'cta_clicado', 'origem'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data.sessionId) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'missing sessionId' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
    }

    var values = sheet.getDataRange().getValues();
    var idCol = HEADERS.indexOf('sessionId');
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (values[i][idCol] === data.sessionId) { rowIndex = i + 1; break; }
    }

    var now = new Date();
    var row = {};
    if (rowIndex > -1) {
      HEADERS.forEach(function (h, idx) { row[h] = values[rowIndex - 1][idx]; });
    } else {
      row.sessionId = data.sessionId;
      row.created_at = now;
    }
    row.updated_at = now;
    HEADERS.forEach(function (h) {
      if (h !== 'sessionId' && h !== 'created_at' && data[h] !== undefined) row[h] = data[h];
    });

    var newRow = HEADERS.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
