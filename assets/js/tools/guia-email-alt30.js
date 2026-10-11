// Formulário do guia "e-mail em francês para a escola" (alternância depois dos
// 30) desenhado direto no corpo do artigo, pelo marcador [[GUIA-EMAIL-ALT30]].
// Mesmo payload e mesma chave de localStorage de /guias/email-alternancia-30-mais/:
// quem libera aqui já entra liberada no guia, e vice-versa. O texto do modelo é
// cópia do guia; se mudar lá, mude aqui.
import { supabase } from "/assets/js/supabase-client.js";

const GUIA = "email-alternancia-30-mais";
const GUIA_URL = "/guias/" + GUIA + "/";
const LS_KEY = "pd_guia_" + GUIA;
const CONSENTIMENTO_VERSAO = "guia-v1";
const TEXTO_SERVICO = "Li e aceito a Política de Privacidade.";
const TEXTO_NOVIDADES = "Quero receber e-mails do Por Dentro, inclusive sobre a plataforma para quem mora na França. Cancelo quando quiser.";

const MODELO = `Objet : Candidature en alternance : question sur la limite d'âge

Bonjour,

Je vous contacte car je souhaite candidater à la formation [nom de la formation] en alternance et, malgré la limite d'âge de 29 ans, j'ai [XX] ans. Je précise que la limite d'âge de 29 ans pour le contrat d'apprentissage ne s'applique pas dans les cas listés à l'article L6222-2 du Code du travail. Dans ma situation : [cas 1 : j'ai déjà effectué un contrat d'apprentissage terminé le [date] et cette formation conduit à un diplôme de niveau supérieur / cas 4 : mon projet de création d'entreprise dépend de l'obtention de ce diplôme].

Pourriez-vous me confirmer par écrit ce qui est nécessaire dans ma situation (titre de séjour étudiant) pour signer ce contrat ?

Je suis prêt(e) à [commencer ma recherche d'entreprise dès maintenant / vous présenter une entreprise partenaire]. Merci d'avance pour votre réponse écrite.

Cordialement,
[Prénom Nom]`;

const CSS = `
.ga-gate{background:#fff;border:1px solid var(--borda-suave);box-shadow:var(--shadow-card);border-radius:var(--radius-sm);padding:22px;margin:20px 0 28px}
.ga-lead{font-size:16px;color:var(--grafite);margin:0 0 14px;line-height:1.5}
.ga-row{display:grid;grid-template-columns:1fr 1.4fr;gap:12px}
.ga-field{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.ga-field label{font-size:13.5px;font-weight:600;color:var(--texto-secundario)}
.ga-field input,.ga-field select{font:inherit;font-size:15px;padding:13px 14px;border:1px solid var(--borda-suave);border-radius:var(--radius-sm);background:#fff;width:100%;box-sizing:border-box}
.ga-field input:focus,.ga-field select:focus{border-color:var(--verde-moss);outline:none}
.ga-hp{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}
.ga-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:15.5px;padding:15px 26px;border-radius:var(--radius-sm);border:none;cursor:pointer;background:var(--verde-moss);color:#fff!important;text-decoration:none!important;box-shadow:var(--shadow-card)}
.ga-btn:hover{filter:brightness(1.08)}
.ga-btn[disabled]{opacity:.6;cursor:wait}
.ga-full{width:100%}
.ga-ghost{background:#fff;color:var(--grafite)!important;border:1px solid var(--borda-suave);box-shadow:none}
.ga-trust{list-style:none;padding:0!important;margin:16px 0 0!important;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13.5px;color:var(--texto-secundario)}
.ga-trust li{margin:0!important}
.ga-aviso{font-size:12.5px!important;margin:10px 0 0!important;color:var(--texto-secundario)}
.ga-ok{font-size:15px;margin:0 0 12px}
.ga-modelo{background:var(--off-white-soft);border:1px solid var(--borda-suave);border-radius:var(--radius-sm);padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap;margin:0 0 12px}
.ga-acoes{display:flex;flex-wrap:wrap;gap:10px}
@media(max-width:560px){.ga-row{grid-template-columns:1fr}.ga-gate{padding:18px}}
`;

function track(t, p) { if (window.PDEvents) window.PDEvents.send(t, null, p || {}); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function formHTML() {
  return `
    <p class="ga-lead">Libere o <strong>modelo de e-mail em francês</strong>, o <strong>checklist de antes de enviar</strong> e a lista das exceções do limite de 29 anos.</p>
    <form novalidate>
      <div class="ga-row">
        <div class="ga-field">
          <label for="ga-nome">Seu nome</label>
          <input id="ga-nome" type="text" autocomplete="given-name" maxlength="100" required>
        </div>
        <div class="ga-field">
          <label for="ga-email">Seu e-mail</label>
          <input id="ga-email" type="email" autocomplete="email" placeholder="seu@email.com" required>
        </div>
      </div>
      <div class="ga-field">
        <label for="ga-etapa">Em que ponto da alternância você está?</label>
        <select id="ga-etapa" required>
          <option value="">Escolha a que mais se parece com você</option>
          <option value="alt-pesquisando">Ainda estou entendendo se posso, com mais de 29 anos</option>
          <option value="alt-escolhendo-escola">Estou escolhendo escola e curso</option>
          <option value="alt-recusa-idade">Já falei com uma escola e ouvi “só até 29”</option>
          <option value="alt-buscando-empresa">Tenho escola, mas ainda preciso achar empresa</option>
          <option value="alt-montando-contrato">Tenho empresa e estou montando o contrato</option>
        </select>
      </div>
      <div class="ga-hp" aria-hidden="true">
        <label for="ga-website">Deixe este campo em branco</label>
        <input type="text" id="ga-website" name="website" tabindex="-1" autocomplete="off">
      </div>
      <label class="gate-checkbox">
        <input type="checkbox" id="ga-servico" required>
        <span>Li e aceito a <a href="/confidentialite/" target="_blank" rel="noopener">Política de Privacidade</a>. *</span>
      </label>
      <label class="gate-checkbox">
        <input type="checkbox" id="ga-novidades">
        <span>${TEXTO_NOVIDADES}</span>
      </label>
      <p class="gate-message" id="ga-erro"></p>
      <button class="ga-btn ga-full" id="ga-btn" type="submit">Liberar o modelo grátis →</button>
    </form>
    <ul class="ga-trust">
      <li>✓ 100% gratuito</li>
      <li>✓ Base legal linkada</li>
      <li>✓ Feito por quem vive isso na França</li>
    </ul>
    <p class="ga-aviso">Conteúdo de orientação, sem caráter de aconselhamento jurídico.</p>`;
}

function liberadoHTML() {
  return `
    <p class="ga-ok"><strong>✓ Modelo liberado.</strong> Troque o que está entre colchetes.</p>
    <div class="ga-modelo" id="ga-modelo"></div>
    <div class="ga-acoes">
      <button class="ga-btn ga-ghost" id="ga-copiar" type="button">Copiar e-mail</button>
      <a class="ga-btn" href="${GUIA_URL}">Checklist e exceções no guia →</a>
    </div>`;
}

export function mount(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  if (!document.getElementById("ga-css")) {
    const st = document.createElement("style");
    st.id = "ga-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const box = document.createElement("section");
  box.className = "ga-gate";
  box.setAttribute("aria-label", "Liberar o modelo de e-mail em francês");
  root.appendChild(box);
  const $ = (id) => box.querySelector("#" + id);

  function liberar() {
    box.innerHTML = liberadoHTML();
    $("ga-modelo").textContent = MODELO;
    $("ga-copiar").addEventListener("click", function () {
      const b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(MODELO) : Promise.reject()).then(() => {
        b.textContent = "Copiado ✓";
        setTimeout(() => { b.textContent = "Copiar e-mail"; }, 2000);
        track("guia_copiar_modelo", { guia: GUIA, onde: "artigo" });
      }).catch(() => {
        const r = document.createRange(); r.selectNodeContents($("ga-modelo"));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        b.textContent = "Selecionado: use Ctrl/Cmd+C";
      });
    });
  }

  if (lsGet(LS_KEY) === "1") { liberar(); return; }

  box.innerHTML = formHTML();
  const shownAt = Date.now();
  const erro = (m) => { const e = $("ga-erro"); e.textContent = m; e.classList.toggle("is-visible", !!m); };

  box.querySelector("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro("");
    const email = $("ga-email").value.trim();
    const nome = $("ga-nome").value.trim();
    const etapa = $("ga-etapa").value;
    if ($("ga-website").value || (Date.now() - shownAt) < 2500) return;
    if (!nome) { erro("Conta seu nome pra eu saber com quem estou falando."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erro("Confere o e-mail e tenta de novo."); return; }
    if (!etapa) { erro("Escolhe em que ponto você está. É isso que me ajuda a te orientar melhor."); return; }
    if (!$("ga-servico").checked) { erro("Preciso que você aceite a Política de Privacidade pra continuar."); return; }
    const btn = $("ga-btn");
    btn.disabled = true; btn.textContent = "Liberando...";
    const params = new URLSearchParams(window.location.search);
    const payload = {
      email,
      nome,
      persona: "alternancia_emprego",
      origem: "guia-email-alt30",
      respostas: { objetivo: etapa },
      aceita_servico: true,
      aceita_novidades: $("ga-novidades").checked,
      consentimento_versao: CONSENTIMENTO_VERSAO,
      texto_servico: TEXTO_SERVICO,
      texto_novidades: TEXTO_NOVIDADES,
    };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => {
      const v = params.get(k); if (v) payload[k] = v.slice(0, 100);
    });
    const igId = params.get("ig"); if (igId) payload.ig = igId.slice(0, 60);
    try {
      const r = await supabase.rpc("capturar_lead", { payload });
      if (r.error) throw r.error;
      lsSet(LS_KEY, "1");
      track("guia_lead_capturado", { guia: GUIA, etapa, onde: "artigo", utm_campaign: params.get("utm_campaign") || null });
      liberar();
    } catch (e) {
      console.error("capturar_lead:", e);
      erro("Não consegui confirmar agora. Confere o e-mail e tenta de novo.");
      btn.disabled = false; btn.textContent = "Liberar o modelo grátis →";
    }
  });
}
