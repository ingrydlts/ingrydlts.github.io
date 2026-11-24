// Novo orçamento (aba E-mail da ficha): a conta, o texto do e-mail e o PDF. Lógica pura, sem DOM: o crm.js só desenha a tela.
// O PDF é montado com o jsPDF (vendor/jspdf.umd.min.js, carregado só quando ela abre o orçamento); aqui entra só o construtor, para testar em Node.

// Valor no formato brasileiro: "70", "70,5", "1.200,50", "€ 70". Devolve número > 0 ou null.
export function lerValor(txt) {
  const bruto = String(txt == null ? '' : txt).replace(/[€R$\s]/g, '');
  if (!bruto) return null;
  // "1.200,50" e "1.200" (ponto de milhar) valem 1200,50 e 1200; "70.5" vale 70,5.
  const n = Number(bruto.indexOf(',') >= 0 || /^\d{1,3}(\.\d{3})+$/.test(bruto) ? bruto.replace(/\./g, '').replace(',', '.') : bruto);
  return Number.isFinite(n) && n > 0 && n <= 1000000 ? n : null;
}
export const arred = (n) => Math.round(n * 100) / 100;
export function fmt(valor, moeda) {
  const m = String(moeda || 'EUR').toUpperCase(), n = Number(valor);
  const t = n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  return (m === 'BRL' ? 'R$' : m === 'EUR' ? '€' : m) + ' ' + t;
}

// linhas: [{ servico, preco: '70,50', desc: { ativo: bool, tipo: 'pct' | 'val', valor: '10' } }]
// Devolve { erro } (com a linha, de 1 em diante) ou { linhas: [{ servico, preco, desconto, total, descRotulo }], subtotal, descontos, total, moeda }.
// Desconto só vale onde ela marcou. Em %: de 0 a 100 (exclusive 0). Em valor: maior que 0 e no máximo o preço da linha.
export function calcular(linhas, moeda) {
  const m = String(moeda || 'EUR').toUpperCase() === 'BRL' ? 'BRL' : 'EUR';
  const out = [];
  let i = 0;
  for (const l of linhas || []) {
    i++;
    const servico = String(l.servico || '').replace(/\s+/g, ' ').trim();
    if (!servico && !String(l.preco || '').trim() && !(l.desc && l.desc.ativo)) { i--; continue; }   // linha em branco: ignora
    if (!servico) return { erro: 'Linha ' + i + ': diga qual é o serviço.', linha: i };
    if (servico.length > 160) return { erro: 'Linha ' + i + ': o nome do serviço passou de 160 letras.', linha: i };
    const preco = lerValor(l.preco);
    if (preco == null) return { erro: 'Linha ' + i + ': preço inválido. Exemplo: 70 ou 70,50.', linha: i };
    let desconto = 0, descRotulo = '';
    if (l.desc && l.desc.ativo) {
      const v = lerValor(l.desc.valor);
      if (l.desc.tipo === 'val') {
        if (v == null || v > preco) return { erro: 'Linha ' + i + ': o desconto em valor precisa ser maior que 0 e no máximo o preço.', linha: i };
        desconto = arred(v); descRotulo = fmt(desconto, m);
      } else {
        if (v == null || v > 100) return { erro: 'Linha ' + i + ': o desconto em % precisa estar entre 0 e 100.', linha: i };
        desconto = arred(preco * v / 100); descRotulo = String(v).replace('.', ',') + '%';
      }
    }
    out.push({ servico, preco: arred(preco), desconto, total: arred(preco - desconto), descRotulo });
  }
  if (!out.length) return { erro: 'Adicione pelo menos um serviço com preço.', linha: 0 };
  const subtotal = arred(out.reduce((s, x) => s + x.preco, 0)), descontos = arred(out.reduce((s, x) => s + x.desconto, 0));
  return { linhas: out, subtotal, descontos, total: arred(subtotal - descontos), moeda: m };
}

const dm = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
export function validadeAte(hoje, dias) { const d = new Date(hoje.getTime()); d.setDate(d.getDate() + Math.max(1, Math.min(365, Math.round(Number(dias) || 15)))); return d; }
export function numeroOrcamento(hoje) {
  const p = (n) => String(n).padStart(2, '0');
  return 'ORC-' + hoje.getFullYear() + p(hoje.getMonth() + 1) + p(hoje.getDate()) + '-' + p(hoje.getHours()) + p(hoje.getMinutes());
}
export function nomeArquivo(nome, hoje) {
  const base = String(nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'cliente';
  return 'Orcamento-Por-Dentro-' + base + '-' + hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0') + '.pdf';
}

// O texto do e-mail que acompanha o PDF. Ela ainda edita tudo antes de enviar.
export function textoEmail(primeiroNome, calc, o) {
  const op = o || {}, ate = op.ate ? dm(op.ate) : '';
  const linhas = calc.linhas.map((l) => '• ' + l.servico + ': ' + (l.desconto ? fmt(l.preco, calc.moeda) + ' → ' + fmt(l.total, calc.moeda) + ' (desconto de ' + l.descRotulo + ')' : fmt(l.total, calc.moeda)));
  return ['Oi ' + primeiroNome + ', tudo bem?', '', 'Segue o orçamento dos serviços que conversamos:', '', ...linhas, '', 'Total: ' + fmt(calc.total, calc.moeda), '',
    'O orçamento completo está em anexo (PDF)' + (ate ? ' e vale até ' + ate : '') + '.',
    ...(op.obs ? ['', String(op.obs).trim()] : []), '', 'Qualquer dúvida, me responde por aqui.'].join('\n');
}

// Monta o PDF (A4) no visual Por Dentro. JsPDF = o construtor do jsPDF. dados = { nome, email, calc, numero, hoje, ate, obs }.
export function montarPdf(JsPDF, dados) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true }), W = 210, M = 20, R = W - M, calc = dados.calc;
  const cor = { texto: [43, 43, 43], mudo: [110, 104, 98], verde: [87, 115, 40], terra: [96, 64, 52], ouro: [222, 185, 117], bege: [244, 241, 236], linha: [217, 210, 198] };
  const ink = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const fundo = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const traco = (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w || 0.2); };
  const colServ = M + 2, colValor = 128, colDesc = 152, colTotal = R - 2;   // direita das três últimas colunas
  let y = 22;
  const cabecalho = () => {
    doc.setFont('times', 'bold'); doc.setFontSize(22); ink(cor.texto); doc.text('Por ', M, y);
    const w = doc.getTextWidth('Por '); ink(cor.terra); doc.text('Dentro', M + w, y);
    traco(cor.ouro, 0.8); doc.line(M, y + 4, R, y + 4);
  };
  cabecalho(); y += 16;
  doc.setFont('times', 'bold'); doc.setFontSize(20); ink(cor.texto); doc.text('Orçamento', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); ink(cor.mudo);
  doc.text('Nº ' + dados.numero, R, y - 8, { align: 'right' });
  doc.text('Data: ' + dm(dados.hoje), R, y - 3, { align: 'right' });
  doc.text('Válido até: ' + dm(dados.ate), R, y + 2, { align: 'right' });
  y += 12;
  doc.setFontSize(9); ink(cor.verde); doc.setFont('helvetica', 'bold'); doc.text('PARA', M, y);
  y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); ink(cor.texto); doc.text(String(dados.nome || ''), M, y);
  if (dados.email) { y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(cor.mudo); doc.text(String(dados.email), M, y); }
  y += 12;
  const cabTabela = () => {
    fundo(cor.bege); doc.rect(M, y - 5, R - M, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(cor.verde);
    doc.text('SERVIÇO', colServ, y + 1); doc.text('VALOR', colValor, y + 1, { align: 'right' }); doc.text('DESCONTO', colDesc, y + 1, { align: 'right' }); doc.text('TOTAL', colTotal, y + 1, { align: 'right' });
    y += 9;
  };
  cabTabela();
  for (const l of calc.linhas) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    const partes = doc.splitTextToSize(l.servico, colValor - colServ - 22), alt = Math.max(1, partes.length) * 5 + 4;
    if (y + alt > 265) { doc.addPage(); y = 22; cabTabela(); }
    ink(cor.texto); doc.text(partes, colServ, y);
    doc.text(fmt(l.preco, calc.moeda), colValor, y, { align: 'right' });
    if (l.desconto) { ink(cor.verde); doc.text('- ' + l.descRotulo, colDesc, y, { align: 'right' }); } else { ink(cor.mudo); doc.text('—', colDesc, y, { align: 'right' }); }
    doc.setFont('helvetica', 'bold'); ink(cor.texto); doc.text(fmt(l.total, calc.moeda), colTotal, y, { align: 'right' });
    y += alt - 1; traco(cor.linha, 0.2); doc.line(M, y, R, y); y += 5;
  }
  if (y > 240) { doc.addPage(); y = 22; }
  y += 3; doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(cor.mudo);
  if (calc.descontos > 0) {
    doc.text('Subtotal', colDesc, y, { align: 'right' }); doc.text(fmt(calc.subtotal, calc.moeda), colTotal, y, { align: 'right' }); y += 6;
    ink(cor.verde); doc.text('Descontos', colDesc, y, { align: 'right' }); doc.text('- ' + fmt(calc.descontos, calc.moeda), colTotal, y, { align: 'right' }); y += 8;
  }
  fundo(cor.texto); doc.rect(M + 78, y - 6, R - M - 78, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(222, 185, 117); doc.text('TOTAL', M + 82, y + 1.5);
  doc.setFontSize(14); doc.setTextColor(251, 250, 247); doc.text(fmt(calc.total, calc.moeda), colTotal, y + 2, { align: 'right' });
  y += 18;
  if (String(dados.obs || '').trim()) {
    if (y > 235) { doc.addPage(); y = 22; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(cor.verde); doc.text('OBSERVAÇÕES', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(cor.texto);
    const t = doc.splitTextToSize(String(dados.obs).trim(), R - M); doc.text(t, M, y); y += t.length * 5 + 6;
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); traco(cor.linha, 0.2); doc.line(M, 275, R, 275);
    doc.setFont('times', 'italic'); doc.setFontSize(13); ink(cor.texto); doc.text('Ingryd · Por Dentro', M, 283);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(cor.mudo); doc.text('Válido até ' + dm(dados.ate) + (n > 1 ? ' · página ' + p + ' de ' + n : ''), R, 283, { align: 'right' });
  }
  return doc;
}
