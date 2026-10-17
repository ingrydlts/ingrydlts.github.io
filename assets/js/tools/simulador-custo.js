// Por Dentro — ferramenta embutida no artigo "quanto-custa-viver-na-franca-2026":
// simulador de custo de vida (5 cidades × 4 tipos de moradia, aluguel ajustável).
//
// Fica num módulo à parte pelo mesmo motivo do mapa-fle.js: o corpo do artigo é markdown
// editado pelo /admin, então o marcador "[[SIMULADOR-CUSTO]]" vira um <div id="tool-simulador-custo">
// (ver /artigos/post/index.html) e este módulo só carrega nos artigos que usam o marcador.
//
// Faixas: colocation/studio/T2 = valor mediano oficial ± 100€ (T2: ± 200€); CROUS = tarifa oficial
// real da chambre ao studio (grades de cada Crous regional, 2025/2026). Transporte = passe mensal
// oficial; alimentação = média INSEE. Atualizado em ago/2026.

const DATA = {
  paris:       { label: "Paris",       fixed: 411.80, colocation: { min: 650, max: 850 }, studio: { min: 625, max: 825 }, t2: { min: 1085, max: 1485 }, crous: { min: 332, max: 541 } },
  nice:        { label: "Nice",        fixed: 340.00, colocation: { min: 461, max: 661 }, studio: { min: 300, max: 500 }, t2: { min: 500,  max: 900 },  crous: { min: 176, max: 423 } },
  lyon:        { label: "Lyon",        fixed: 375.90, colocation: { min: 295, max: 495 }, studio: { min: 225, max: 425 }, t2: { min: 365,  max: 765 },  crous: { min: 230, max: 420 } },
  montpellier: { label: "Montpellier", fixed: 300.00, colocation: { min: 250, max: 450 }, studio: { min: 175, max: 375 }, t2: { min: 275,  max: 675 },  crous: { min: 257, max: 396 } },
  toulouse:    { label: "Toulouse",    fixed: 359.00, colocation: { min: 215, max: 415 }, studio: { min: 150, max: 350 }, t2: { min: 230,  max: 630 },  crous: { min: 196, max: 370 } },
};
const CITY_ORDER = ["paris", "nice", "lyon", "montpellier", "toulouse"];
const TYPES = [
  ["colocation", "Colocation"],
  ["studio", "Studio"],
  ["t2", "T2"],
  ["crous", "Apto estudantil (CROUS)"],
];
const TYPE_LABEL = Object.fromEntries(TYPES);

const CSS = `
.sc-tool{background:#fff;border:1px solid var(--borda);border-radius:var(--radius-md);padding:22px;box-shadow:var(--shadow-card);margin:28px 0;--sc-accent:#5F87AE;}
@media (min-width:640px){ .sc-tool{padding:32px;} }
.sc-label{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--texto-secundario);margin-bottom:10px;}
.sc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;}
.sc-tabs.sc-types{margin-bottom:24px;}
.sc-tabs.sc-types .sc-tab{flex:1;min-width:130px;text-align:center;}
.sc-tab{background:var(--off-white);border:1px solid var(--borda);border-radius:var(--radius-pill);padding:9px 16px;font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--grafite);cursor:pointer;}
.sc-tab[aria-selected="true"]{background:var(--sc-accent);border-color:var(--sc-accent);color:#fff;}
.sc-slider-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-wrap:wrap;gap:6px;}
.sc-slider-head .lbl{font-size:14px;font-weight:600;color:var(--grafite);}
.sc-slider-head .val{font-family:var(--font-display);font-weight:700;font-size:26px;color:var(--sc-accent);}
.sc-slider-head .val small{font-size:13px;font-weight:600;color:var(--texto-secundario);}
.sc-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;background:var(--borda);outline:none;margin:6px 0;cursor:grab;}
.sc-slider:active{cursor:grabbing;}
.sc-slider::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:var(--sc-accent);border:4px solid #fff;box-shadow:0 2px 8px rgba(43,43,43,.35);cursor:grab;}
.sc-slider::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:var(--sc-accent);border:none;box-shadow:0 2px 8px rgba(43,43,43,.35),0 0 0 4px #fff inset;cursor:grab;}
.sc-range{display:flex;justify-content:space-between;font-size:11.5px;color:var(--texto-secundario);margin-bottom:22px;}
.sc-lines{border-top:1px solid var(--borda-suave);margin-top:6px;}
.sc-line{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--borda-suave);font-size:14px;}
.sc-line span:first-child{color:var(--texto-secundario);}
.sc-line span:last-child{font-weight:600;}
.sc-line.total{border-bottom:none;padding-top:16px;}
.sc-line.total span:first-child{font-weight:700;color:var(--grafite);font-size:15px;}
.sc-line.total span:last-child{font-family:var(--font-display);font-weight:700;font-size:24px;color:var(--grafite);}
.sc-hint{font-size:12px;color:var(--texto-secundario);margin-top:4px;}
.sc-compare{margin-top:32px;}
.sc-bar{background:#fff;border:1px solid var(--borda);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:9px;position:relative;overflow:hidden;}
.sc-bar.is-selected{border-color:var(--sc-accent);border-width:2px;padding:11px 15px;}
.sc-bar .bar{position:absolute;left:0;top:0;bottom:0;background:rgba(95,135,174,.10);}
.sc-bar .row{position:relative;display:flex;justify-content:space-between;align-items:center;gap:10px;}
.sc-bar .city{font-weight:600;font-size:14px;}
.sc-bar .range{font-size:12px;color:var(--texto-secundario);}
.sc-bar .max{font-weight:700;font-size:14.5px;color:var(--sc-accent);white-space:nowrap;}
.sc-note{font-size:12px;color:var(--texto-secundario);margin-top:14px;line-height:1.55;}
`;

const fmt = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
const faixa = (cidade, tipo) => {
  const d = DATA[cidade][tipo];
  return { min: d.min, max: d.max, media: Math.round((d.min + d.max) / 2) };
};
const evento = (tipo, id, extra) => {
  if (typeof window.gtag === "function") window.gtag("event", "select_content", Object.assign({ content_type: tipo, item_id: id }, extra || {}));
};

export function mount(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;

  if (!document.getElementById("sc-tool-css")) {
    const style = document.createElement("style");
    style.id = "sc-tool-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const estado = { cidade: "paris", tipo: "colocation" };

  root.innerHTML =
    '<div class="sc-tool">' +
      '<div class="sc-label">1. Cidade</div>' +
      '<div class="sc-tabs" role="tablist" data-sc="cidades">' +
        CITY_ORDER.map((c, i) => '<button type="button" class="sc-tab" role="tab" aria-selected="' + (i === 0) + '" data-cidade="' + c + '">' + DATA[c].label + "</button>").join("") +
      "</div>" +
      '<div class="sc-label">2. Tipo de moradia</div>' +
      '<div class="sc-tabs sc-types" role="tablist" data-sc="tipos">' +
        TYPES.map(([k, l], i) => '<button type="button" class="sc-tab" role="tab" aria-selected="' + (i === 0) + '" data-tipo="' + k + '">' + l + "</button>").join("") +
      "</div>" +
      '<div class="sc-label">3. Seu aluguel estimado</div>' +
      '<div class="sc-slider-head"><span class="lbl" data-sc="rotulo"></span><span class="val"><span data-sc="valor"></span>€<small>/mês</small></span></div>' +
      '<input type="range" class="sc-slider" data-sc="slider" step="5" aria-label="Aluguel mensal estimado">' +
      '<div class="sc-range"><span data-sc="min"></span><span data-sc="max"></span></div>' +
      '<div class="sc-lines">' +
        '<div class="sc-line"><span>Aluguel (seu ajuste)</span><span data-sc="l-aluguel"></span></div>' +
        '<div class="sc-line"><span>Transporte + alimentação (fixo da cidade)</span><span data-sc="l-fixo"></span></div>' +
        '<div class="sc-line total"><span>Total estimado / mês</span><span data-sc="l-total"></span></div>' +
      "</div>" +
      '<p class="sc-hint">Transporte: passe mensal oficial de cada operadora. Alimentação: média INSEE. Esses dois não mudam com o controle — só o aluguel é ajustável.</p>' +
      '<div class="sc-compare"><div class="sc-label" data-sc="comp-rotulo"></div><div data-sc="comp-lista"></div>' +
      '<p class="sc-note">Quarto em colocation: OLAP (Paris) e LocService/portais de colocation (demais cidades). Studio e T2: €/m² médio do SeLoger (studio ~25 m², T2 ~45 m²). Faixa do controle: ± 100 € (colocation/studio) e ± 200 € (T2) em torno da média de mercado. <strong>CROUS:</strong> tarifa oficial de cada Crous regional, da chambre simples ao studio (2025/2026); a vaga é dada por critério social, e a demanda é maior que a oferta. Valores medianos, ago/2026.</p></div>' +
    "</div>";

  const q = (k) => root.querySelector('[data-sc="' + k + '"]');
  const slider = q("slider");

  function desenharComparativo() {
    q("comp-rotulo").textContent = "Comparativo — " + TYPE_LABEL[estado.tipo] + " em todas as cidades";
    const maiorTeto = Math.max.apply(null, CITY_ORDER.map((c) => DATA[c][estado.tipo].max));
    q("comp-lista").innerHTML = CITY_ORDER.map((c) => {
      const r = faixa(c, estado.tipo);
      const pct = Math.round((r.max / maiorTeto) * 100);
      return '<div class="sc-bar' + (c === estado.cidade ? " is-selected" : "") + '"><span class="bar" style="width:' + pct + '%"></span>' +
        '<span class="row"><span class="city">' + DATA[c].label + '</span><span class="range">' + fmt(r.min) + "€ – " + fmt(r.max) + '€</span><span class="max">até ' + fmt(r.max) + "€</span></span></div>";
    }).join("");
  }

  function atualizarTotais() {
    const aluguel = parseFloat(slider.value);
    const fixo = DATA[estado.cidade].fixed;
    q("valor").textContent = fmt(aluguel);
    q("l-aluguel").textContent = fmt(aluguel) + "€";
    q("l-fixo").textContent = fmt(fixo) + "€";
    q("l-total").textContent = fmt(aluguel + fixo) + "€";
  }

  function desenharSlider() {
    const r = faixa(estado.cidade, estado.tipo);
    slider.min = r.min;
    slider.max = r.max;
    slider.value = r.media;
    q("min").textContent = fmt(r.min) + "€ (mais em conta)";
    q("max").textContent = fmt(r.max) + "€ (topo de mercado)";
    q("rotulo").textContent = DATA[estado.cidade].label + " · " + TYPE_LABEL[estado.tipo];
    atualizarTotais();
  }

  function ligarAbas(seletor, chave, atributo) {
    const botoes = root.querySelectorAll(seletor + " .sc-tab");
    botoes.forEach((btn) => {
      btn.addEventListener("click", () => {
        estado[chave] = btn.getAttribute(atributo);
        botoes.forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
        desenharSlider();
        desenharComparativo();
        evento("calc_" + chave, estado[chave]);
      });
    });
  }
  ligarAbas('[data-sc="cidades"]', "cidade", "data-cidade");
  ligarAbas('[data-sc="tipos"]', "tipo", "data-tipo");

  slider.addEventListener("input", atualizarTotais);
  slider.addEventListener("change", () => evento("calc_rent_drag", estado.cidade + "_" + estado.tipo, { value: slider.value }));

  desenharSlider();
  desenharComparativo();
}
