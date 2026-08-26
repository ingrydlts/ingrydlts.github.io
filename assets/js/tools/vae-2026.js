// Por Dentro — ferramentas embutidas no artigo "vae-franca-2026": checklist de
// elegibilidade, etapas do processo (accordion), simulador de financiamento por
// situação profissional, gráfico de taxa de sucesso e captura de email (Brevo).
//
// Ficam num módulo à parte (em vez de HTML solto no corpo do artigo) porque o corpo
// do artigo é editado como markdown puro pelo /admin — o parser (assets/js/markdown.js)
// escapa qualquer HTML de propósito, pra manter o campo "Corpo do artigo" seguro pra
// edição de texto. Cada marcador "[[VAE-...]]" no corpo vira um <div id="tool-vae-...">
// (ver /artigos/post/index.html) e a função correspondente só monta quando esse mount
// point existe na página.

function ensureCss() {
  if (document.getElementById("vae-tool-css")) return;
  const style = document.createElement("style");
  style.id = "vae-tool-css";
  style.textContent = `
.vae-tool{background:#fff;border:1px solid var(--borda);border-radius:var(--radius-md);box-shadow:var(--shadow-card);padding:22px;margin:28px 0;}
.vae-tool h4{margin:0 0 14px;font-size:16px;}

.vae-checklist{list-style:none;margin:0 0 16px;padding:0;}
.vae-checklist li{background:var(--off-white-soft);border:1px solid var(--borda-suave);border-radius:var(--radius-sm);margin-bottom:8px;}
.vae-checklist label{display:flex;align-items:flex-start;gap:12px;padding:13px 15px;cursor:pointer;font-size:14.5px;line-height:1.4;}
.vae-checklist input[type="checkbox"]{width:19px;height:19px;flex-shrink:0;accent-color:var(--verde-moss);margin-top:1px;cursor:pointer;}
.vae-check-result{border:2px solid var(--borda);border-radius:var(--radius-md);padding:16px 18px;text-align:center;transition:border-color .2s ease, background .2s ease;}
.vae-check-result.is-eligible{border-color:var(--verde-moss);background:#F1F5EC;}
.vae-check-result .count{display:block;font-size:26px;font-weight:700;color:var(--downtown-brown);margin-bottom:4px;}
.vae-check-result p{margin:0;font-size:13.5px;color:var(--grafite);}

.vae-progress-dots{display:flex;gap:6px;margin-bottom:18px;}
.vae-progress-dots span{flex:1;height:5px;border-radius:999px;background:var(--beje-paris);}
.vae-step{background:var(--off-white-soft);border:1px solid var(--borda-suave);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden;}
.vae-step summary{list-style:none;cursor:pointer;padding:14px 15px;display:flex;align-items:center;gap:12px;font-weight:600;color:var(--downtown-brown);font-size:14.5px;}
.vae-step summary::-webkit-details-marker{display:none;}
.vae-step summary .vae-num{width:26px;height:26px;border-radius:50%;background:var(--downtown-brown);color:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;}
.vae-step summary .vae-arrow{margin-left:auto;color:var(--beje-paris-text);font-size:13px;transition:transform .15s ease;}
.vae-step[open] summary .vae-arrow{transform:rotate(90deg);}
.vae-step .vae-step-body{padding:0 15px 15px 53px;font-size:13.5px;color:var(--texto-secundario);line-height:1.6;}
.vae-outcome-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:16px;}
.vae-outcome{background:var(--off-white-soft);border:1px solid var(--borda-suave);border-radius:var(--radius-sm);padding:13px 15px;}
.vae-outcome .vae-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--beje-paris-text);}
.vae-outcome p{font-size:13px;margin:4px 0 0;color:var(--texto-secundario);}
@media (min-width:560px){ .vae-outcome-grid{grid-template-columns:repeat(3,1fr);} }

.vae-sim-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
.vae-sim-tab{flex:1;min-width:110px;background:var(--off-white-soft);border:1px solid var(--borda);border-radius:var(--radius-pill);padding:9px 14px;font-size:13px;font-weight:600;color:var(--downtown-brown);cursor:pointer;text-align:center;font-family:var(--font-body);}
.vae-sim-tab[aria-selected="true"]{background:var(--downtown-brown);color:#fff;border-color:var(--downtown-brown);}
.vae-sim-source{padding:10px 0;border-bottom:1px solid var(--borda-suave);font-size:13.5px;line-height:1.55;}
.vae-sim-source:last-child{border-bottom:none;}
.vae-sim-source strong{display:block;color:var(--downtown-brown);font-size:13.5px;margin-bottom:2px;}

.vae-bar-row{margin-bottom:16px;}
.vae-bar-row:last-child{margin-bottom:0;}
.vae-bar-label{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;margin-bottom:6px;}
.vae-bar-label strong{color:var(--downtown-brown);flex-shrink:0;}
.vae-bar-track{background:var(--borda-suave);border-radius:999px;height:13px;overflow:hidden;}
.vae-bar-fill{background:var(--beje-paris);height:100%;border-radius:999px;}
.vae-bar-fill.is-compare{background:var(--texto-secundario);opacity:.5;}

.vae-newsletter{background:var(--downtown-brown);color:var(--off-white);border-radius:var(--radius-md);padding:26px 22px;text-align:center;}
.vae-newsletter h4{color:var(--off-white);}
.vae-newsletter p{color:#E9DFD4;font-size:14px;margin:0 0 18px;}
.vae-newsletter-form{max-width:420px;margin:0 auto;text-align:left;}
.vae-newsletter-form input[type="email"]{width:100%;padding:13px 15px;border-radius:var(--radius-sm);border:1px solid var(--borda);font-size:15px;font-family:var(--font-body);margin-bottom:12px;box-sizing:border-box;}
.vae-newsletter-note{font-size:12px;color:#CBBBA8;margin-top:12px;margin-bottom:0;}
.vae-newsletter-msg{display:none;font-size:13.5px;border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;text-align:left;}
.vae-newsletter-msg.is-visible{display:block;}
.vae-newsletter-msg.is-success{background:#e7faf0;color:#085229;}
`;
  document.head.appendChild(style);
}

export function mountChecklist(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  const ITEMS = [
    "Assalariado(a) — CDI, CDD ou tempo parcial",
    "Autônomo(a), freelancer ou microempreendedor",
    "Em busca de emprego (atenção ao financiamento — veja a seção de custos)",
    "Fiz trabalho voluntário ou associativo relacionado à área",
    "<em>Aidant familial</em> (cuidador familiar), em certos casos",
    "Funcionário(a) público(a)",
  ];

  root.innerHTML =
    '<div class="vae-tool">' +
    '<h4>Marque o que se aplica a você</h4>' +
    '<ul class="vae-checklist" id="vaeCheckList">' +
    ITEMS.map((t, i) => '<li><label><input type="checkbox" data-vae-check id="vaeCheck' + i + '"> ' + t + "</label></li>").join("") +
    "</ul>" +
    '<div class="vae-check-result" id="vaeCheckResult">' +
    '<span class="count" id="vaeCheckCount">0 de ' + ITEMS.length + "</span>" +
    '<p id="vaeCheckMsg">Marque as situações acima pra ver se você já se encaixa em algum perfil elegível.</p>' +
    "</div></div>";

  const boxes = root.querySelectorAll("[data-vae-check]");
  const countEl = root.querySelector("#vaeCheckCount");
  const msgEl = root.querySelector("#vaeCheckMsg");
  const resultEl = root.querySelector("#vaeCheckResult");

  function update() {
    let checked = 0;
    boxes.forEach((b) => { if (b.checked) checked++; });
    countEl.textContent = checked + " de " + boxes.length;
    if (checked === 0) {
      resultEl.classList.remove("is-eligible");
      msgEl.textContent = "Marque as situações acima pra ver se você já se encaixa em algum perfil elegível.";
    } else {
      resultEl.classList.add("is-eligible");
      msgEl.textContent = "Você provavelmente já se encaixa no perfil de elegibilidade da VAE. O próximo passo é confirmar que sua experiência tem relação direta com a certificação que você quer validar — veja as etapas abaixo.";
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "select_content", { content_type: "checklist_vae", value: checked });
    }
  }
  boxes.forEach((b) => b.addEventListener("change", update));
}

export function mountEtapas(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  const STEPS = [
    { t: "Inscrição e primeiro contato", d: "Criação de conta na plataforma France VAE. Entrevista gratuita com um <em>architecte de parcours</em> — um orientador que ajuda a definir o projeto e escolher a certificação mais adequada ao seu perfil." },
    { t: "Recevabilidade", d: "Envio do dossiê de candidatura pra avaliar se o pedido é <em>recevável</em> (aceito pra seguir adiante). É aqui que sua experiência é confrontada com o referencial da certificação." },
    { t: "Constituição do dossiê (Livret 2)", d: "Com apoio de um organismo acompanhante, você descreve em detalhe suas atividades e competências, relacionando cada uma ao referencial do diploma. É a etapa mais longa — e a que mais se beneficia de acompanhamento profissional." },
    { t: "Banca (<em>jury</em>)", d: "Apresentação oral do dossiê perante uma banca avaliadora, seguida de entrevista." },
    { t: "Resultado", d: "Validação total, parcial, ou não validação (com direito a recurso ou nova tentativa ajustada)." },
  ];
  const OUTCOMES = [
    { l: "Total", d: "Diploma concedido integralmente." },
    { l: "Parcial", d: "Parte validada; o resto se completa depois." },
    { l: "Não validado", d: "Dá pra recorrer ou refazer com ajustes." },
  ];

  root.innerHTML =
    '<div class="vae-tool">' +
    '<h4>5 etapas, entre 8 e 12 meses — média de 10 meses do início ao resultado</h4>' +
    '<div class="vae-progress-dots">' + "<span></span>".repeat(5) + "</div>" +
    STEPS.map(
      (s, i) =>
        '<details class="vae-step"' + (i === 0 ? " open" : "") + ">" +
        '<summary><span class="vae-num">' + (i + 1) + '</span> ' + s.t + ' <span class="vae-arrow">›</span></summary>' +
        '<div class="vae-step-body"><p style="margin:0;">' + s.d + "</p></div>" +
        "</details>"
    ).join("") +
    '<div class="vae-outcome-grid">' +
    OUTCOMES.map((o) => '<div class="vae-outcome"><span class="vae-label">' + o.l + '</span><p>' + o.d + "</p></div>").join("") +
    "</div></div>";
}

const SIM_SOURCES = {
  assalariado: [
    { n: "CPF (Compte Personnel de Formation)", d: "Acompanhamento e/ou processo completo. Teto 2026 de 1.500€ para certificações RS; participação obrigatória de 150€." },
    { n: "OPCO / période de reconversion", d: "Se a VAE fizer parte de um percurso de reconversão profissional. Pode se somar ao CPF." },
    { n: "Empregador", d: "Via plano de desenvolvimento de competências, quando a iniciativa parte da empresa. Sem teto fixo." },
  ],
  autonomo: [
    { n: "CPF (Compte Personnel de Formation)", d: "Mesma lógica de qualquer trabalhador: teto 2026 de 1.500€ para certificações RS, participação de 150€." },
    { n: "Apoio próprio do France VAE", d: "Complementar a outras fontes, teto de referência de cerca de 2.200€ por percurso." },
  ],
  desempregado: [
    { n: "Transitions Pro", d: "Ajuda fixa de até 2.000€, disponível desde 30/07/2026, cobrindo taxas de recevabilidade, acompanhamento e formação complementar (se elegível)." },
    { n: "CPF (se houver saldo)", d: "Ainda pode ser usado, com a mesma participação obrigatória de 150€." },
    { n: "Apoio de um futuro empregador", d: "Se a VAE fizer parte de uma proposta de contratação." },
  ],
};
const SIM_LABELS = { assalariado: "Assalariado(a)", autonomo: "Autônomo(a)", desempregado: "Desempregado(a)" };

export function mountFinanciamento(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  root.innerHTML =
    '<div class="vae-tool">' +
    '<h4>Simule as fontes de financiamento pra você</h4>' +
    '<div class="vae-sim-tabs" id="vaeSimTabs" role="tablist">' +
    Object.keys(SIM_LABELS).map((k, i) => '<button type="button" class="vae-sim-tab" role="tab" aria-selected="' + (i === 0 ? "true" : "false") + '" data-sit="' + k + '">' + SIM_LABELS[k] + "</button>").join("") +
    "</div>" +
    '<div id="vaeSimTitle" style="font-weight:600;color:var(--downtown-brown);font-size:14.5px;margin-bottom:10px;">Fontes prováveis — Assalariado(a)</div>' +
    '<div id="vaeSimSources"></div>' +
    "</div>";

  const tabs = root.querySelectorAll(".vae-sim-tab");
  const titleEl = root.querySelector("#vaeSimTitle");
  const sourcesEl = root.querySelector("#vaeSimSources");

  function render(sit) {
    titleEl.textContent = "Fontes prováveis — " + SIM_LABELS[sit];
    sourcesEl.innerHTML = SIM_SOURCES[sit]
      .map((s) => '<div class="vae-sim-source"><strong>' + s.n + "</strong>" + s.d + "</div>")
      .join("");
    if (sit === "desempregado") {
      sourcesEl.innerHTML +=
        '<div class="callout callout-warn" style="margin:14px 0 0;"><strong>Atenção:</strong> desde maio de 2026, o France Travail deixou de financiar diretamente pedidos de VAE de quem está em busca de emprego. O direito à VAE continua — só muda a estratégia de financiamento.</div>';
    }
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      const sit = btn.getAttribute("data-sit");
      render(sit);
      if (typeof window.gtag === "function") {
        window.gtag("event", "select_content", { content_type: "sim_financiamento_vae", item_id: sit });
      }
    });
  });

  render("assalariado");
}

export function mountTaxaSucesso(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  const ROWS = [
    { label: "Chegam até o fim e validam (total ou parcial)", value: 90 },
    { label: "Chegam à banca e validam de primeira (total)", value: 60 },
    { label: "Validação total com acompanhamento profissional", value: 75 },
    { label: "Validação total como candidato(a) livre", value: 45, compare: true },
  ];

  root.innerHTML =
    '<div class="vae-tool">' +
    '<h4>Taxa de sucesso</h4>' +
    ROWS.map(
      (r) =>
        '<div class="vae-bar-row"><div class="vae-bar-label"><span>' + r.label + "</span><strong>" + r.value + '%</strong></div>' +
        '<div class="vae-bar-track"><div class="vae-bar-fill' + (r.compare ? " is-compare" : "") + '" style="width:' + r.value + '%"></div></div></div>'
    ).join("") +
    "</div>";
}

export function mountNewsletter(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  // ATENÇÃO Ingryd: crie o formulário de inscrição na lista "VAE" no Brevo
  // (mesmo padrão dos outros formulários) e substitua a action abaixo
  // (#BREVO-FORM-ACTION-VAE-AQUI) pela URL real gerada pelo Brevo. Até lá,
  // o fallback local mostra a confirmação sem tentar enviar pra lugar nenhum.
  const FORM_ACTION = "#BREVO-FORM-ACTION-VAE-AQUI";

  root.innerHTML =
    '<div class="vae-newsletter">' +
    "<h4>Quer o guia completo com organismos Qualiopi?</h4>" +
    "<p>Deixa seu email que eu te mando a lista de organismos com selo Qualiopi pra VAE e o passo a passo de como usar o CPF — sem enrolação.</p>" +
    '<form class="vae-newsletter-form" id="vaeNewsletterForm" method="POST" action="' + FORM_ACTION + '">' +
    '<div class="vae-newsletter-msg is-success" id="vaeNewsletterSuccess">Inscrição confirmada! O guia chega no seu email.</div>' +
    '<input type="email" name="EMAIL" required placeholder="seu@email.com" aria-label="Seu melhor email">' +
    '<button type="submit" class="btn btn-block" style="background:var(--beje-paris); color:#3A2A17;">QUERO O GUIA VAE</button>' +
    "</form>" +
    '<p class="vae-newsletter-note">Sem spam. Cancele quando quiser.</p>' +
    "</div>";

  const form = root.querySelector("#vaeNewsletterForm");
  if (form.getAttribute("action") === "#BREVO-FORM-ACTION-VAE-AQUI") {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      root.querySelector("#vaeNewsletterSuccess").classList.add("is-visible");
      if (typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", { content_type: "brevo_vae_local_fallback" });
      }
      form.reset();
    });
  }
}
