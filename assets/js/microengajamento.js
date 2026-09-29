// Por Dentro — comportamento dos blocos de microengajamento e das
// ferramentas-assinatura dos artigos (o HTML sai de assets/js/markdown.js).
// Carregado sob demanda por artigos/post/index.html depois que o artigo é
// desenhado: init({ slug, post, posts }).
//
// Dados: tudo vai por window.PDEvents.send("block", slug, { type, ... }) —
// o mesmo canal dos blocos antigos, gravado só depois do consentimento. O
// Worker limita 20 eventos por minuto por pessoa, então aqui só vira evento
// o que é resposta ou decisão (nunca "passou o mouse", "rolou um pouco").
//
// Respostas ficam em ANSWERS (prazo, enquete, seletor, quiz, checklist,
// confianca) e o bloco [[PROXIMO-PASSO]] escolhe a regra que bate com elas.

import { escapeHtml } from "/assets/js/render.js";

const ANSWERS = {};
let SLUG = "artigo";

function send(type, payload) {
  try {
    if (window.PDEvents) window.PDEvents.send("block", SLUG, Object.assign({ type: type }, payload || {}));
  } catch (e) {}
}
function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem("pdmx:" + key) || "null");
    localStorage.setItem("pdmx:" + key, JSON.stringify(val));
  } catch (e) { return null; }
}
function answer(kind, value) {
  ANSWERS[kind] = value;
  document.dispatchEvent(new CustomEvent("pd:mx-answer", { detail: { kind: kind, value: value } }));
}

// ---- datas ------------------------------------------------------------------
function parseOffset(txt) {
  const m = String(txt || "").trim().toLowerCase().match(/^([+-]?\d+)\s*(dia|dias|semana|semanas|m[eê]s|meses|ano|anos)?/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2] || "dias";
  if (/^dia/.test(u)) return { d: n };
  if (/^semana/.test(u)) return { d: n * 7 };
  if (/^m/.test(u)) return { m: n };
  return { m: n * 12 };
}
function addOffset(date, off) {
  const d = new Date(date);
  if (off.m) d.setMonth(d.getMonth() + off.m);
  if (off.d) d.setDate(d.getDate() + off.d);
  return d;
}
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function fmt(d) { return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }); }

// ---- CONFIANÇA (antes + depois automático) ----------------------------------
function initConfianca(el, body) {
  const q = el.dataset.question;
  const after = document.createElement("div");
  after.className = "mx mx-confianca mx-after";
  after.innerHTML = '<span class="mx-lab">Depois de ler</span><h3>' + escapeHtml(q.replace(/^Quão/, "E agora, quão")) + "</h3>" +
    el.querySelector(".mx-scale").outerHTML.replace('data-moment="antes"', 'data-moment="depois"') + '<div class="mx-delta" aria-live="polite"></div>';
  const anchor = body.querySelector(".mx-proximo") || body.querySelector(".rt-feedback") || body.querySelector(".rt-faq");
  if (anchor) anchor.parentNode.insertBefore(after, anchor); else body.appendChild(after);
  [el, after].forEach((box) => box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    const scale = b.parentElement, moment = scale.dataset.moment, v = +b.dataset.v;
    scale.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    send("confidence", { moment: moment, value: v });
    if (moment === "antes") { answer("confianca", v); const n = el.querySelector(".mx-note"); if (n) n.hidden = false; return; }
    const before = ANSWERS.confianca, out = after.querySelector(".mx-delta");
    if (!before) { out.innerHTML = '<p class="mx-note">Obrigada! Responda também o “antes”, lá no começo, pra ver quanto mudou.</p>'; return; }
    const d = v - before;
    out.innerHTML = '<div class="mx-delta-box"><b>' + (d > 0 ? "+" : "") + d + "</b><span>" +
      (d > 0 ? "Você saiu deste artigo mais segura do que entrou." : d === 0 ? "Continua igual. Me conta abaixo o que faltou." : "Ficou mais insegura? Me conta abaixo o que confundiu.") + "</span></div>";
  }));
}

// ---- MITO -------------------------------------------------------------------
function initMito(el) {
  let done = 0, right = 0;
  const total = el.querySelectorAll(".mx-myth").length;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-guess]");
    if (!b) return;
    const card = b.closest(".mx-myth"), ok = b.dataset.guess === card.dataset.answer;
    card.classList.add(ok ? "is-right" : "is-wrong");
    card.querySelector(".mx-choices").remove();
    const a = card.querySelector(".mx-answer");
    a.hidden = false;
    a.querySelector("b").textContent = (ok ? "Acertou" : "Quase") + " — é " + card.dataset.answer + ".";
    done++; if (ok) right++;
    send("myth_answer", { id: el.dataset.mxId + "-" + card.dataset.i, correct: ok });
    if (done === total) { const s = el.querySelector(".mx-score"); s.hidden = false; s.textContent = "Você acertou " + right + " de " + total + "."; }
  });
}

// ---- QUIZ -------------------------------------------------------------------
function initQuiz(el) {
  const total = +el.dataset.total || el.querySelectorAll(".mx-q").length;
  let done = 0, right = 0;
  el.addEventListener("click", (e) => {
    const b = e.target.closest(".mx-opts button");
    if (!b) return;
    const q = b.closest(".mx-q");
    if (q.classList.contains("is-done")) return;
    q.classList.add("is-done");
    const ok = !!b.dataset.ok;
    b.classList.add(ok ? "is-right" : "is-wrong");
    q.querySelectorAll("[data-ok]").forEach((x) => x.classList.add("is-right"));
    const ex = q.querySelector(".mx-expl"); if (ex) ex.hidden = false;
    done++; if (ok) right++;
    if (done === total) {
      const pct = Math.round((right / total) * 100);
      const r = el.querySelector(".mx-result");
      r.hidden = false;
      r.innerHTML = "<b>" + right + " de " + total + "</b> · " + (pct >= 80 ? "Você está bem preparada." : pct >= 50 ? "Bom começo — revise os pontos que errou." : "Vale reler o artigo com calma antes de seguir.");
      send("quiz_result", { id: el.dataset.mxId, score: right, total: total });
      answer("quiz", pct);
    }
  });
}

// ---- SELETOR ----------------------------------------------------------------
function initSeletor(el) {
  const qs = Array.from(el.querySelectorAll(".mx-q"));
  let score = {}, step = 0;
  el.addEventListener("click", (e) => {
    if (e.target.closest(".mx-restart")) {
      score = {}; step = 0;
      qs.forEach((q, i) => (q.hidden = i !== 0));
      el.querySelectorAll(".mx-res").forEach((r) => (r.hidden = true));
      e.target.hidden = true;
      return;
    }
    const b = e.target.closest(".mx-opts button");
    if (!b) return;
    (b.dataset.keys || "").split(",").map((k) => k.trim()).filter(Boolean).forEach((k) => (score[k] = (score[k] || 0) + 1));
    qs[step].hidden = true;
    step++;
    if (step < qs.length) { qs[step].hidden = false; return; }
    const results = Array.from(el.querySelectorAll(".mx-res"));
    let best = results[0], bestN = -1;
    results.forEach((r) => { const n = score[r.dataset.key] || 0; if (n > bestN) { best = r; bestN = n; } });
    if (best) { best.hidden = false; send("selector_result", { id: el.dataset.mxId, result: best.dataset.key }); answer("seletor", best.dataset.key); }
    el.querySelector(".mx-restart").hidden = false;
  });
}

// ---- PRAZO ------------------------------------------------------------------
function initPrazo(el) {
  const input = el.querySelector("input[type=date]"), out = el.querySelector(".mx-out");
  const off = parseOffset(el.dataset.duration) || { m: 3 };
  const saved = store("prazo:" + el.dataset.mxId);
  if (saved) input.value = saved;
  function run(log) {
    if (!input.value) { out.innerHTML = ""; return; }
    const start = new Date(input.value + "T00:00:00"), end = addOffset(start, off);
    const total = Math.max(1, Math.round((end - start) / 864e5)), left = Math.round((end - today()) / 864e5);
    let st, cls, msg;
    if (left < 0) { st = "Prazo vencido"; cls = "bad"; msg = "O prazo terminou em <b>" + fmt(end) + "</b>. Não espere mais pra agir."; }
    else if (left <= 15) { st = "Urgente"; cls = "bad"; msg = "Faltam só <b>" + left + " dias</b>. O limite é <b>" + fmt(end) + "</b>."; }
    else if (left <= 45) { st = "Atenção"; cls = "warn"; msg = "Você tem até <b>" + fmt(end) + "</b>. Dá tempo, mas não deixe pra última semana."; }
    else { st = "Tranquila"; cls = "ok"; msg = "Seu prazo vai até <b>" + fmt(end) + "</b>. Use a folga pra organizar tudo com calma."; }
    const pct = Math.max(0, Math.min(100, Math.round((Math.max(left, 0) / total) * 100)));
    out.innerHTML = '<div class="mx-dial mx-' + cls + '" style="--p:' + pct + '"><div><b>' + Math.max(left, 0) + "</b><small>dias restantes</small></div></div>" +
      '<div><span class="mx-status mx-' + cls + '">' + st + "</span><p>" + msg + '</p><p class="mx-note">A data fica salva neste aparelho.</p></div>';
    store("prazo:" + el.dataset.mxId, input.value);
    answer("prazo", left);
    if (log) send("tool_use", { tool: "prazo", id: el.dataset.mxId, days_left: left, status: st.toLowerCase() });
  }
  input.addEventListener("change", () => run(true));
  run(false);
}

// ---- LINHA DO TEMPO ---------------------------------------------------------
function initLinha(el) {
  const input = el.querySelector("input[type=date]");
  const saved = store("linha:" + el.dataset.mxId);
  if (saved) input.value = saved;
  function run(log) {
    const base = input.value ? new Date(input.value + "T00:00:00") : null;
    el.querySelectorAll(".mx-steps li").forEach((li) => {
      const off = parseOffset(li.dataset.offset), when = li.querySelector(".mx-when");
      if (!base || !off) { when.textContent = li.dataset.offset; li.classList.remove("is-past"); return; }
      const d = addOffset(base, off);
      when.textContent = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
      li.classList.toggle("is-past", d < today());
    });
    if (base) { store("linha:" + el.dataset.mxId, input.value); if (log) send("tool_use", { tool: "linha_do_tempo", id: el.dataset.mxId }); }
  }
  input.addEventListener("change", () => run(true));
  run(false);
}

// ---- ROTEIRO ----------------------------------------------------------------
function initRoteiro(el) {
  const key = "roteiro:" + el.dataset.mxId, state = store(key) || {};
  function paint() {
    el.querySelectorAll(".mx-spots li").forEach((li) => {
      li.querySelectorAll("[data-s]").forEach((b) => b.setAttribute("aria-pressed", String(state[li.dataset.i] === b.dataset.s)));
    });
  }
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]");
    if (!b) return;
    const i = b.closest("li").dataset.i;
    state[i] = state[i] === b.dataset.s ? null : b.dataset.s;
    store(key, state); paint();
    if (state[i]) send("roteiro_mark", { id: el.dataset.mxId, item: +i, mark: state[i] });
  });
  paint();
}

// ---- PERGUNTA ---------------------------------------------------------------
function initPergunta(el) {
  const ta = el.querySelector("textarea"), n = el.querySelector(".mx-count");
  ta.addEventListener("input", () => (n.textContent = ta.value.length + "/280"));
  el.querySelector(".mx-send").addEventListener("click", () => {
    const q = ta.value.trim();
    if (q.length < 8) { n.textContent = "Escreve um pouquinho mais pra eu entender"; return; }
    send("question_submit", { text: q.slice(0, 280) });
    el.querySelector(".mx-row").innerHTML = '<p class="mx-note mx-ok">Recebi! Se mais gente perguntar isso, vira artigo.</p>';
    ta.disabled = true;
  });
}

// ---- PRÓXIMO PASSO ----------------------------------------------------------
function test(cond) {
  const m = String(cond).match(/^(\w+)\s*(<=|>=|=|<|>)\s*(.+)$/);
  if (!m) return false;
  const v = ANSWERS[m[1]];
  if (v === undefined || v === null) return false;
  const want = m[3].trim();
  if (m[2] === "=") return String(v).toLowerCase() === want.toLowerCase();
  const a = Number(v), b = Number(want);
  return m[2] === "<" ? a < b : m[2] === ">" ? a > b : m[2] === "<=" ? a <= b : a >= b;
}
const WHY = {
  prazo: (v) => (v < 0 ? "Porque o seu prazo já venceu." : "Porque o seu prazo vence em " + v + " dias."),
  enquete: (v) => "Porque você respondeu “" + v + "”.",
  seletor: () => "Com base no seu resultado acima.",
  quiz: (v) => "Porque você acertou " + v + "% do teste.",
  checklist: () => "Porque você completou a checklist.",
  confianca: () => "Com base no quanto você se sente segura."
};
function initProximo(el) {
  const rules = Array.from(el.querySelectorAll(".mx-rule"));
  function pick() {
    let chosen = null;
    rules.forEach((r) => { if (!chosen && r.dataset.cond !== "padrao" && test(r.dataset.cond)) chosen = r; });
    const fallback = rules.find((r) => r.dataset.cond === "padrao") || rules[0];
    rules.forEach((r) => (r.hidden = r !== (chosen || fallback)));
    if (chosen) {
      const kind = chosen.dataset.cond.match(/^\w+/)[0], why = chosen.querySelector(".mx-why");
      why.hidden = false;
      why.textContent = WHY[kind] ? WHY[kind](ANSWERS[kind]) : "";
    }
  }
  document.addEventListener("pd:mx-answer", pick);
  pick();
}

// ---- TRILHA -----------------------------------------------------------------
function initTrilha(el, posts) {
  const bySlug = {};
  (posts || []).forEach((p) => (bySlug[p.slug] = p));
  const links = Array.from(el.querySelectorAll(".mx-trail a"));
  const here = links.findIndex((a) => a.dataset.slug === SLUG);
  links.forEach((a, i) => {
    const p = bySlug[a.dataset.slug];
    if (!p) { a.remove(); return; }
    const cover = window.PDCover && window.PDCover.has(p) ? window.PDCover.html(p) : (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : "");
    const tag = i === here ? "Você está aqui" : i < here ? "Passo " + (i + 1) : i === here + 1 ? "Próximo →" : "Passo " + (i + 1);
    a.className = i === here ? "is-here" : "";
    a.innerHTML = '<span class="mx-trail-cv">' + cover + '</span><span class="mx-lab">' + tag + "</span><b>" + escapeHtml(p.title) + "</b>";
    a.addEventListener("click", () => send("series_click", { from: here + 1, to: i + 1, of: links.length }));
  });
  if (here >= 0) {
    const lab = el.querySelector(".mx-lab");
    if (lab) lab.textContent += " · passo " + (here + 1) + " de " + links.length;
  }
}

// ---- respostas dos blocos antigos (enquete e checklist) ---------------------
function watchLegacy(body) {
  body.addEventListener("click", (e) => {
    const opt = e.target.closest(".rt-poll-option");
    if (opt) answer("enquete", opt.dataset.pollOption || opt.textContent.trim());
  });
  body.addEventListener("change", (e) => {
    const box = e.target.closest(".rt-checklist");
    if (!box) return;
    const all = box.querySelectorAll("input[type=checkbox]"), on = box.querySelectorAll("input:checked");
    if (all.length && on.length === all.length) answer("checklist", "completo");
  });
}

// ---- página: progresso de leitura, sumário marcado, grifo, "ficou claro?" --
function initProgress(article) {
  const bar = document.createElement("div");
  bar.className = "mx-progress";
  bar.innerHTML = "<i></i>";
  document.body.appendChild(bar);
  const fill = bar.firstChild, marks = new Set();
  const toc = Array.from(document.querySelectorAll(".article-toc a"));
  const heads = toc.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
  let raf = 0;
  function tick() {
    raf = 0;
    const r = article.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, Math.round(((innerHeight * 0.4 - r.top) / r.height) * 100)));
    fill.style.width = p + "%";
    [25, 50, 75, 100].forEach((m) => { if (p >= m - 1 && !marks.has(m)) { marks.add(m); send("read_progress", { depth: m }); } });
    heads.forEach((hd, i) => {
      const next = heads[i + 1];
      const passed = next ? next.getBoundingClientRect().top < innerHeight * 0.35 : p >= 95;
      if (toc[i]) toc[i].classList.toggle("is-read", passed);
    });
  }
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  tick();
}

function initReactions(body) {
  const heads = Array.from(body.querySelectorAll(":scope > h2"));
  if (heads.length < 2) return;
  const spots = heads.slice(1).map((h, i) => ({ before: h, section: heads[i].id || "secao-" + i }));
  const lastEnd = body.querySelector(":scope > .rt-faq, :scope > .mx-proximo, :scope > .rt-feedback");
  if (lastEnd) spots.push({ before: lastEnd, section: heads[heads.length - 1].id || "fim" });
  spots.forEach((s) => {
    const el = document.createElement("div");
    el.className = "mx-react";
    el.innerHTML = "<span>Essa parte ficou clara?</span>" +
      '<button type="button" data-r="clara">Sim</button><button type="button" data-r="mais_ou_menos">Mais ou menos</button><button type="button" data-r="confusa">Não</button>';
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]");
      if (!b || el.classList.contains("is-done")) return;
      el.classList.add("is-done");
      b.setAttribute("aria-pressed", "true");
      send("section_reaction", { section: s.section, value: b.dataset.r });
      const t = document.createElement("span");
      t.className = "mx-note";
      t.textContent = b.dataset.r === "clara" ? "Valeu!" : "Anotado — vou reforçar essa parte.";
      el.appendChild(t);
    });
    s.before.parentNode.insertBefore(el, s.before);
  });
}

function initHighlight(body) {
  let pop = null;
  const close = () => { if (pop) pop.remove(); pop = null; };
  body.addEventListener("mouseup", () => setTimeout(() => {
    close();
    const sel = getSelection(), txt = sel.toString().trim();
    if (txt.length < 12 || txt.length > 400 || !sel.rangeCount) return;
    const rg = sel.getRangeAt(0), node = rg.commonAncestorContainer;
    const host = node.nodeType === 1 ? node : node.parentElement;
    if (!host || host.closest(".mx, .rt-faq, .rt-poll, .rt-checklist, button, a")) return;
    const rc = rg.getBoundingClientRect();
    pop = document.createElement("div");
    pop.className = "mx-hlpop";
    pop.style.left = Math.max(8, Math.min(innerWidth - 260, rc.left + rc.width / 2 - 120 + scrollX)) + "px";
    pop.style.top = rc.top + scrollY - 46 + "px";
    const ask = body.querySelector(".mx-pergunta textarea");
    pop.innerHTML = '<button type="button" data-a="hl">Grifar</button><button type="button" data-a="cp">Copiar</button>' + (ask ? '<button type="button" data-a="ask">Perguntar sobre isso</button>' : "");
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    pop.addEventListener("click", async (e) => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === "hl") { try { const m = document.createElement("mark"); m.className = "mx-mark"; rg.surroundContents(m); } catch (err) {} send("highlight", { text: txt.slice(0, 160) }); }
      if (a === "cp") { try { await navigator.clipboard.writeText(txt); } catch (err) {} send("highlight_copy", { len: txt.length }); }
      if (a === "ask" && ask) { ask.value = "Sobre “" + txt.slice(0, 120) + "”: "; ask.dispatchEvent(new Event("input")); ask.scrollIntoView({ behavior: "smooth", block: "center" }); ask.focus(); }
      getSelection().removeAllRanges();
      close();
    });
    document.body.appendChild(pop);
  }, 10));
  document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target)) close(); });
}

// ---- entrada ----------------------------------------------------------------
export function init(opts) {
  opts = opts || {};
  SLUG = opts.slug || "artigo";
  const body = opts.root || document.querySelector(".article-body");
  if (!body) return;
  const article = body.closest("article") || body;
  const INIT = { confianca: (el) => initConfianca(el, body), mito: initMito, quiz: initQuiz, seletor: initSeletor, prazo: initPrazo, linha: initLinha, roteiro: initRoteiro, pergunta: initPergunta, trilha: (el) => initTrilha(el, opts.posts) };
  body.querySelectorAll("[data-mx]").forEach((el) => {
    const fn = INIT[el.dataset.mx];
    if (fn) { try { fn(el); } catch (e) { console.error("[microengajamento]", el.dataset.mx, e); } }
  });
  body.querySelectorAll(".mx-resumo").forEach((d) => d.addEventListener("toggle", () => { if (d.open) send("tldr_open"); }, { once: true }));
  body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-mx-link]");
    if (a) send("solution_click", { source: a.dataset.mxLink, href: a.getAttribute("href") });
  });
  watchLegacy(body);
  body.querySelectorAll(".mx-proximo").forEach(initProximo);
  const post = opts.post || {};
  if (post.sectionReactions) initReactions(body);
  if (post.highlight !== false) initHighlight(body);
  initProgress(article);
}
