// Por Dentro — formulários que pedem contato (nome + e-mail) no blog:
//   - "Pergunta pra Ingryd", no fim de todo artigo, logo antes do rodapé
//   - "Me avisa antes do prazo", dentro da calculadora [[PRAZO]]
//
// Os dois mandam pro Worker (POST /api/leads), que grava no banco, coloca o
// contato no Brevo (CRM) e, no caso da pergunta, te avisa por e-mail — ver
// cms-oauth-worker/README.md, seção "Perguntas e lembretes do blog".
//
// Diferente dos eventos (events.js), isto não depende do consentimento de
// cookies: é a pessoa enviando os próprios dados de propósito, com o aviso de
// privacidade ao lado do botão.

import { escapeHtml } from "/assets/js/render.js";

const API_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";

export async function sendLead(data) {
  let res;
  try {
    res = await fetch(API_BASE + "/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (e) {
    throw new Error("Sem conexão agora. Confira a internet e tente de novo.");
  }
  let body = {};
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(body.error || "Não deu pra enviar agora. Tente de novo em instantes.");
  return body;
}

function track(type, slug, payload) {
  try { if (window.PDEvents) window.PDEvents.send("block", slug, Object.assign({ type: type }, payload || {})); } catch (e) {}
}

const PRIVACY = 'Seus dados ficam só com o Por Dentro. <a href="/confidentialite/">Privacidade</a>';

// Seção "Pergunta pra Ingryd", inserida antes do rodapé do site.
export function mountAskForm(opts) {
  opts = opts || {};
  if (document.querySelector(".ask-ingryd")) return document.querySelector(".ask-ingryd");
  const sec = document.createElement("section");
  sec.className = "ask-ingryd";
  sec.id = "pergunta";
  sec.innerHTML =
    '<div class="ask-in">' +
    '<div class="ask-head"><span class="ask-eyebrow">Pergunta pra Ingryd</span>' +
    "<h2>Ficou alguma dúvida? Me pergunta.</h2>" +
    "<p>Eu leio todas e respondo no seu e-mail. As perguntas que mais aparecem viram artigo.</p></div>" +
    '<form class="ask-form" novalidate>' +
    '<div class="ask-row">' +
    '<label><span>Seu nome</span><input name="name" autocomplete="given-name" required maxlength="80"></label>' +
    '<label><span>Seu e-mail</span><input name="email" type="email" autocomplete="email" required maxlength="150"></label>' +
    "</div>" +
    '<label><span>Sua pergunta</span><textarea name="question" rows="4" required maxlength="1500" placeholder="Conte seu caso em poucas linhas"></textarea></label>' +
    '<input name="hp" tabindex="-1" autocomplete="off" aria-hidden="true" class="ask-hp">' +
    '<label class="ask-check"><input type="checkbox" name="newsletter"> Quero receber a newsletter do Por Dentro também</label>' +
    '<div class="ask-actions"><button type="submit" class="btn btn-pill">Enviar pergunta</button><small>' + PRIVACY + "</small></div>" +
    '<p class="ask-msg" role="status" aria-live="polite"></p>' +
    "</form></div>";
  const footer = document.querySelector("footer.site-footer") || document.querySelector("footer");
  if (footer && footer.parentNode) footer.parentNode.insertBefore(sec, footer);
  else document.body.appendChild(sec);

  const form = sec.querySelector("form"), msg = sec.querySelector(".ask-msg"), btn = form.querySelector("button");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const name = String(f.get("name") || "").trim(), email = String(f.get("email") || "").trim(), question = String(f.get("question") || "").trim();
    msg.className = "ask-msg is-err";
    if (!name) { msg.textContent = "Escreva seu nome."; form.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Confira o e-mail: parece que falta alguma parte."; form.email.focus(); return; }
    if (question.length < 8) { msg.textContent = "Escreva sua pergunta (pelo menos uma frase)."; form.question.focus(); return; }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    msg.className = "ask-msg";
    msg.textContent = "";
    try {
      await sendLead({ kind: "pergunta", name, email, question, newsletter: !!f.get("newsletter"), hp: f.get("hp") || "",
        article_slug: opts.slug || null, article_title: opts.title || document.title });
      track("lead_submit", opts.slug, { kind: "pergunta", newsletter: !!f.get("newsletter") });
      form.innerHTML = '<p class="ask-done"><b>Recebi, ' + escapeHtml(name.split(" ")[0]) + "!</b> Vou te responder no " + escapeHtml(email) + ".</p>";
    } catch (err) {
      msg.className = "ask-msg is-err";
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Enviar pergunta";
    }
  });
  return sec;
}

// Formulário curto do lembrete, dentro do resultado da calculadora [[PRAZO]].
export function reminderFormHTML() {
  return (
    '<form class="mx-remind" novalidate><p class="mx-remind-t"><b>Quer que eu te lembre antes do prazo?</b> Mando um e-mail 15 dias antes.</p>' +
    '<div class="mx-remind-row"><input name="name" placeholder="Seu nome" aria-label="Seu nome" autocomplete="given-name" maxlength="80">' +
    '<input name="email" type="email" placeholder="seu@email.com" aria-label="Seu e-mail" autocomplete="email" maxlength="150">' +
    '<input name="hp" tabindex="-1" autocomplete="off" aria-hidden="true" class="ask-hp">' +
    '<button type="submit" class="btn btn-pill">Me avisa</button></div>' +
    '<small class="mx-remind-note">' + PRIVACY + '</small><p class="ask-msg" role="status" aria-live="polite"></p></form>'
  );
}

export function bindReminderForm(form, info) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form), msg = form.querySelector(".ask-msg"), btn = form.querySelector("button");
    const name = String(f.get("name") || "").trim(), email = String(f.get("email") || "").trim();
    msg.className = "ask-msg is-err";
    if (!name) { msg.textContent = "Escreva seu nome."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Confira o e-mail: parece que falta alguma parte."; return; }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    msg.textContent = "";
    try {
      await sendLead({ kind: "lembrete", name, email, deadline: info.deadline, hp: f.get("hp") || "", article_slug: info.slug || null, article_title: info.title || document.title });
      track("lead_submit", info.slug, { kind: "lembrete", days_left: info.daysLeft });
      form.innerHTML = '<p class="ask-done"><b>Combinado!</b> Te aviso no ' + escapeHtml(email) + " antes do prazo.</p>";
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Me avisa";
    }
  });
}
