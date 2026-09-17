// Por Dentro — cartões de rolagem vertical (efeito "arrasta como Stories/TikTok")
// pro artigo "au-pair-para-estudante-fle-o-que-muda". Números grandes, pouca
// palavra, um cartão por ideia. Mesmo padrão de módulo sob demanda dos outros
// artigos (ver comentário no topo de vae-2026.js) — o corpo do artigo continua
// markdown puro no /admin, só o marcador "[[AU-PAIR-FLE-SCROLL]]" vira este
// mount point (ver TOOL_TOKENS em /artigos/post/index.html).
//
// O botão "Guardar pra depois", dentro do cartão, é DIFERENTE do ícone
// flutuante de compartilhar que já existe em todo artigo (share-fab, ver
// assets/js/share-button.js) — aqui ele mora dentro do próprio cartão, com
// texto voltado pra "salvar e mandar pra você mesma ou uma amiga". Na prática
// os dois abrem o MESMO popup de compartilhar (WhatsApp/Instagram/e-mail) —
// evita duplicar a lógica de share nativo — via o evento "pd:request-share",
// que share-button.js escuta.

function ensureCss() {
  if (document.getElementById("aupf-tool-css")) return;
  const style = document.createElement("style");
  style.id = "aupf-tool-css";
  style.textContent = `
.aupf-tool{margin:30px 0;}
.aupf-wrap{position:relative;border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-card);height:min(76vh,600px);}
.aupf-track{height:100%;overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;scrollbar-width:none;-ms-overflow-style:none;}
.aupf-track::-webkit-scrollbar{display:none;}
.aupf-slide{height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:52px 30px;box-sizing:border-box;}
.aupf-slide.bg-brown{background:var(--downtown-brown);color:#F4F1EC;}
.aupf-slide.bg-merlot{background:var(--merlot);color:#F4F1EC;}
.aupf-slide.bg-moss{background:var(--verde-moss);color:#F4F1EC;}
.aupf-slide.bg-blue{background:var(--placid-blue);color:var(--grafite);}
.aupf-slide.bg-gold{background:var(--beje-paris);color:var(--grafite);}
.aupf-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:14px;}
.aupf-num{font-family:var(--font-display);font-weight:700;font-size:clamp(42px,13vw,80px);line-height:1;margin:0 0 8px;}
.aupf-title{font-family:var(--font-display);font-weight:700;font-size:clamp(19px,5.4vw,27px);margin:0 0 14px;max-width:22ch;}
.aupf-body{font-size:14.5px;line-height:1.55;max-width:34ch;opacity:.94;}
.aupf-steps-mini{display:flex;flex-direction:column;gap:8px;margin-top:4px;max-width:30ch;}
.aupf-steps-mini span{font-size:13.5px;font-weight:600;background:rgba(255,255,255,.16);border-radius:var(--radius-pill);padding:8px 14px;}
.aupf-dots{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:3;}
.aupf-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.45);border:none;padding:0;cursor:pointer;transition:all .15s ease;}
.aupf-dot.is-active{background:#fff;width:9px;height:9px;}
.aupf-nav{position:absolute;left:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.28);color:#fff;border:none;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;z-index:3;}
.aupf-nav-up{top:12px;}
.aupf-nav-down{bottom:66px;}
.aupf-save{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:8px;background:#F4F1EC;color:var(--downtown-brown);border:none;border-radius:var(--radius-pill);padding:11px 18px;font-family:var(--font-body);font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px -6px rgba(0,0,0,.4);}
.aupf-save:active{transform:translateX(-50%) scale(.97);}
.aupf-hint{text-align:center;font-size:12px;color:var(--texto-secundario);margin:10px 0 0;}
@media (min-width:700px){ .aupf-wrap{height:560px;} }
`;
  document.head.appendChild(style);
}

const SLIDES = [
  {
    bg: "bg-brown",
    eyebrow: "Au pair → Étudiant",
    num: "Dá pra migrar.",
    body: "Só que o timing decide tudo. O que a França exige de verdade — e pra onde isso leva depois do FLE."
  },
  {
    bg: "bg-merlot",
    eyebrow: "Pré-requisito nº1",
    num: "FLE",
    title: "Inscrição confirmada",
    body: "Precisa ser numa escola com o label qualité français langue étrangère — reconhecido pelos ministérios da Educação e Relações Exteriores."
  },
  {
    bg: "bg-gold",
    eyebrow: "Recurso mínimo exigido",
    num: "€7.380",
    title: "por ano",
    body: "Referência usada nos dossiês de status FLE, junto com seguro saúde e comprovante de moradia."
  },
  {
    bg: "bg-brown",
    eyebrow: "Regra de ouro",
    num: "ANTES",
    title: "do vencimento",
    body: "Peça a mudança de status meses antes do título de au pair expirar — nunca espere vencer pra agir."
  },
  {
    bg: "bg-merlot",
    eyebrow: "Se você deixar vencer",
    num: "3 anos",
    title: "de risco de OQTF",
    body: "Desde a Lei nº 2024-42, deixar o título expirar sem pedir a mudança pode gerar ordem de expulsão do território."
  },
  {
    bg: "bg-blue",
    eyebrow: "Moradia",
    num: "CROUS",
    title: "aluguel já é barato",
    body: "É subsidiado por natureza — com ou sem ajuda de moradia (APL), o valor já sai bem abaixo do mercado."
  },
  {
    bg: "bg-moss",
    eyebrow: "Mudou em",
    num: "01/07/26",
    title: "regra nova da APL",
    body: "Extracomunitário só recebe ajuda de moradia com bolsa CROUS por critério social — ou se estiver trabalhando."
  },
  {
    bg: "bg-merlot",
    eyebrow: "Mito da bolsa",
    num: "97–98%",
    title: "não são bolsistas",
    body: "Quase nenhum estudante extracomunitário se qualifica — a bolsa CROUS exige 2 anos de imposto de renda dos pais na França."
  },
  {
    bg: "bg-gold",
    eyebrow: "Então o caminho real",
    num: "60%",
    title: "de trabalho permitido",
    body: "Trabalhar dentro desse limite, como estudante, garante direito à APL e experiência francesa em paralelo ao curso."
  },
  {
    bg: "bg-brown",
    eyebrow: "Depois do FLE",
    title: "O caminho de carreira",
    steps: ["FLE", "Diploma (Licence/Master)", "APS · 12 meses", "Título salarié"]
  },
  {
    bg: "bg-moss",
    eyebrow: "Pra virar salarié",
    num: "€2.800",
    title: "salário mínimo bruto/mês",
    body: "É o piso pra transformar a APS pós-diploma em título de trabalho estável, na área da sua formação."
  },
  {
    bg: "bg-brown",
    eyebrow: "Guarda isso",
    title: "Não precisa decorar agora",
    body: "Toca no botão abaixo pra guardar esse resumo e mandar pra você mesma — ou pra uma amiga que tá vivendo isso agora."
  }
];

function getArticleSlug() {
  try {
    return new URLSearchParams(window.location.search).get("slug");
  } catch (e) {
    return null;
  }
}

function slideHTML(slide) {
  const inner = slide.steps
    ? '<div class="aupf-steps-mini">' + slide.steps.map((s) => "<span>" + s + "</span>").join("") + "</div>"
    : '<div class="aupf-num">' + (slide.num || "") + "</div>" +
      (slide.title ? '<div class="aupf-title">' + slide.title + "</div>" : "") +
      (slide.body ? '<div class="aupf-body">' + slide.body + "</div>" : "");
  return (
    '<section class="aupf-slide ' + slide.bg + '">' +
    '<div class="aupf-eyebrow">' + slide.eyebrow + "</div>" +
    inner +
    "</section>"
  );
}

export function mount(mountId) {
  const root = document.getElementById(mountId);
  if (!root) return;
  ensureCss();

  root.innerHTML =
    '<div class="aupf-tool">' +
    '<div class="aupf-wrap">' +
    '<div class="aupf-track" id="aupfTrack" tabindex="0">' +
    SLIDES.map(slideHTML).join("") +
    "</div>" +
    '<div class="aupf-dots" id="aupfDots">' +
    SLIDES.map((_, i) => '<button type="button" class="aupf-dot" data-i="' + i + '" aria-label="Cartão ' + (i + 1) + '"></button>').join("") +
    "</div>" +
    '<button type="button" class="aupf-nav aupf-nav-up" aria-label="Cartão anterior">▲</button>' +
    '<button type="button" class="aupf-nav aupf-nav-down" aria-label="Próximo cartão">▼</button>' +
    '<button type="button" class="aupf-save" id="aupfSave">🔖 Guardar pra depois</button>' +
    "</div>" +
    '<p class="aupf-hint">Arraste pra cima/baixo ou toque nos pontinhos →</p>' +
    "</div>";

  const track = root.querySelector("#aupfTrack");
  const dots = Array.from(root.querySelectorAll(".aupf-dot"));
  const slideEls = Array.from(root.querySelectorAll(".aupf-slide"));

  function goTo(i) {
    const clamped = Math.max(0, Math.min(slideEls.length - 1, i));
    slideEls[clamped].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function currentIndex() {
    const top = track.scrollTop;
    let closest = 0;
    let min = Infinity;
    slideEls.forEach((el, i) => {
      const d = Math.abs(el.offsetTop - top);
      if (d < min) { min = d; closest = i; }
    });
    return closest;
  }

  function updateDots() {
    const i = currentIndex();
    dots.forEach((d, di) => d.classList.toggle("is-active", di === i));
  }

  track.addEventListener("scroll", () => {
    window.requestAnimationFrame(updateDots);
  });
  updateDots();

  dots.forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.i))));
  root.querySelector(".aupf-nav-up").addEventListener("click", () => goTo(currentIndex() - 1));
  root.querySelector(".aupf-nav-down").addEventListener("click", () => goTo(currentIndex() + 1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goTo(currentIndex() + 1); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); goTo(currentIndex() - 1); }
  });

  root.querySelector("#aupfSave").addEventListener("click", () => {
    if (window.PDEvents) {
      window.PDEvents.send("block", getArticleSlug(), { type: "save_click", source: "aupf_scroll" });
    }
    document.dispatchEvent(new CustomEvent("pd:request-share"));
  });
}
