// Por Dentro — formulários dos artigos que pedem contato (nome + e-mail):
//   - "Pergunta pra Ingryd", no fim de todo artigo, logo antes do rodapé
//     → supabase.rpc('enviar_pergunta_unica') → /admin/crm, tela "Perguntas únicas"
//   - "Me avisa antes do prazo", dentro da calculadora [[PRAZO]]
//     → supabase.rpc('pedir_lembrete_prazo') → /admin/crm, card "Lembretes de prazo"
//
// Os dois gravam no CRM (Supabase, admin/crm/db/crm-fase2.sql e crm-fase2c-lembretes.sql),
// com o mesmo aceite do funil (checklist-preview): o texto exato e a versão vão junto.
// O cliente do Supabase só é carregado quando a pessoa envia, pra não pesar o artigo.
//
// Diferente dos eventos (events.js), isto não depende do consentimento de cookies: é a
// pessoa enviando os próprios dados de propósito, com o aceite marcado ao lado do botão.

import { escapeHtml } from "/assets/js/render.js";

const CONSENTIMENTO_VERSAO = "site-v1";
const TEXTO_SERVICO = "Li e aceito a Política de Privacidade do Por Dentro.";
const TEXTO_NOVIDADES = "Quero receber novidades e conteúdos do Por Dentro por e-mail.";

// Erros que o banco devolve (raise exception) → texto pra leitora
const ERROS = {
  email_invalido: "Confira o e-mail: parece que falta alguma parte.",
  consentimento_obrigatorio: "Marque o aceite da Política de Privacidade pra enviar.",
  pergunta_vazia: "Escreva sua pergunta (pelo menos uma frase).",
  pergunta_grande_demais: "Sua pergunta ficou longa demais. Resuma em até 2.000 caracteres.",
  muitas_perguntas_abertas: "Você já tem 3 perguntas esperando resposta. Assim que eu responder, pode mandar outra.",
  prazo_invalido: "A data do prazo precisa estar entre amanhã e os próximos 2 anos.",
  muitos_lembretes: "Você já tem 3 lembretes marcados."
};

// O CRM guarda o artigo como "token" de até 40 caracteres (crm_token no banco).
function artigoToken(slug) {
  return String(slug || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || null;
}

async function rpc(fn, payload) {
  let supabase;
  try {
    ({ supabase } = await import("/assets/js/supabase-client.js"));
  } catch (e) {
    throw new Error("Sem conexão agora. Confira a internet e tente de novo.");
  }
  const { error } = await supabase.rpc(fn, { payload });
  if (error) {
    const key = Object.keys(ERROS).find((k) => String(error.message || "").includes(k));
    throw new Error(key ? ERROS[key] : "Não deu pra enviar agora. Tente de novo em instantes.");
  }
}

function consentPayload(newsletter) {
  return {
    aceita_servico: true,
    aceita_novidades: !!newsletter,
    consentimento_versao: CONSENTIMENTO_VERSAO,
    texto_servico: TEXTO_SERVICO,
    texto_novidades: TEXTO_NOVIDADES
  };
}

function track(type, slug, payload) {
  try { if (window.PDEvents) window.PDEvents.send("block", slug, Object.assign({ type: type }, payload || {})); } catch (e) {}
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACEITE = 'Li e aceito a <a href="/confidentialite/">Política de Privacidade</a> do Por Dentro.';
const NEWS = "Quero receber novidades e conteúdos do Por Dentro por e-mail.";

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
    '<label><span>Seu nome</span><input name="name" autocomplete="given-name" required maxlength="100"></label>' +
    '<label><span>Seu e-mail</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>' +
    "</div>" +
    '<label><span>Sua pergunta</span><textarea name="question" rows="4" required maxlength="2000" placeholder="Conte seu caso em poucas linhas"></textarea></label>' +
    '<label class="ask-check"><input type="checkbox" name="aceite" required> <span>' + ACEITE + "</span></label>" +
    '<label class="ask-check"><input type="checkbox" name="newsletter"> <span>' + NEWS + "</span></label>" +
    '<div class="ask-actions"><button type="submit" class="btn btn-pill">Enviar pergunta</button></div>' +
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
    if (!EMAIL_RE.test(email)) { msg.textContent = ERROS.email_invalido; form.email.focus(); return; }
    if (question.length < 8) { msg.textContent = ERROS.pergunta_vazia; form.question.focus(); return; }
    if (!f.get("aceite")) { msg.textContent = ERROS.consentimento_obrigatorio; form.aceite.focus(); return; }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    msg.className = "ask-msg";
    msg.textContent = "";
    try {
      await rpc("enviar_pergunta_unica", Object.assign({ email, nome: name, texto: question, artigo: artigoToken(opts.slug) }, consentPayload(f.get("newsletter"))));
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
    '<form class="mx-remind" novalidate><p class="mx-remind-t"><b>Quer que eu te lembre antes do prazo?</b> Te aviso por e-mail uns 15 dias antes.</p>' +
    '<div class="mx-remind-row"><input name="name" placeholder="Seu nome" aria-label="Seu nome" autocomplete="given-name" maxlength="100">' +
    '<input name="email" type="email" placeholder="seu@email.com" aria-label="Seu e-mail" autocomplete="email" maxlength="254">' +
    '<button type="submit" class="btn btn-pill">Me avisa</button></div>' +
    '<label class="mx-remind-check"><input type="checkbox" name="aceite" required> <span>' + ACEITE + "</span></label>" +
    '<label class="mx-remind-check"><input type="checkbox" name="newsletter"> <span>' + NEWS + "</span></label>" +
    '<p class="ask-msg" role="status" aria-live="polite"></p></form>'
  );
}

export function bindReminderForm(form, info) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form), msg = form.querySelector(".ask-msg"), btn = form.querySelector("button");
    const name = String(f.get("name") || "").trim(), email = String(f.get("email") || "").trim();
    msg.className = "ask-msg is-err";
    if (!name) { msg.textContent = "Escreva seu nome."; return; }
    if (!EMAIL_RE.test(email)) { msg.textContent = ERROS.email_invalido; return; }
    if (!f.get("aceite")) { msg.textContent = ERROS.consentimento_obrigatorio; return; }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    msg.textContent = "";
    try {
      await rpc("pedir_lembrete_prazo", Object.assign({ email, nome: name, prazo: info.deadline, artigo: artigoToken(info.slug) }, consentPayload(f.get("newsletter"))));
      track("lead_submit", info.slug, { kind: "lembrete", days_left: info.daysLeft, newsletter: !!f.get("newsletter") });
      form.innerHTML = '<p class="ask-done"><b>Combinado!</b> Te aviso no ' + escapeHtml(email) + " antes do prazo.</p>";
    } catch (err) {
      msg.className = "ask-msg is-err";
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Me avisa";
    }
  });
}
