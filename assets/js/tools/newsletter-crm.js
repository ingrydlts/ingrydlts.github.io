// Newsletter que grava direto no CRM (Supabase, função capturar_lead), no lugar do formulário
// do Brevo. Hoje tem uma só: a da bolsa Eiffel, no artigo de bolsas, pelo marcador
// [[NEWSLETTER-EIFFEL]]. Pra criar outra, chame montar() com outra configuração.
//
// No CRM a pessoa aparece com:
//   - fonte (origem): o token abaixo, que o /admin/crm mostra como o endereço do artigo
//     (mapa ORIG em admin/crm/crm.js);
//   - argumento: o texto exato que ela aceitou (texto_novidades), na ficha, em Consentimento.
import { supabase } from "/assets/js/supabase-client.js";

const CONSENTIMENTO_VERSAO = "news-v1";
const TEXTO_SERVICO = "Li e aceito a Política de Privacidade.";

const EIFFEL = {
  id: "eiffel",
  // Fonte entrante: /artigos/post/como-conseguir-bolsa-de-estudo/ (o CRM guarda como token).
  origem: "artigo-como-conseguir-bolsa-de-estudo",
  persona: "campus_france",
  titulo: "Novidades da bolsa Eiffel, de perto",
  lead: "A campanha 2027 está acontecendo agora, e cada universidade tem o seu prazo. Deixe o e-mail para receber novidades de perto sobre a bolsa Eiffel: prazos, resultado e o que mudar no edital.",
  // Argumento: é este o texto que fica registrado no CRM como o que a pessoa aceitou.
  argumento: "Quero receber novidades de perto sobre a bolsa Eiffel por e-mail. Cancelo quando quiser.",
  botao: "Quero receber as novidades da Eiffel →",
  ok: "Prontinho! Você vai receber as novidades da bolsa Eiffel por e-mail.",
};

const CSS = `
.nc-box{background:#fff;border:1px solid var(--borda-suave);box-shadow:var(--shadow-card);border-radius:var(--radius-sm);padding:22px;margin:24px 0 28px}
.nc-kicker{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--texto-secundario);margin:0 0 6px}
.nc-box h3{margin:0 0 8px;font-size:20px}
.nc-lead{font-size:15.5px;color:var(--grafite);margin:0 0 14px;line-height:1.5}
.nc-row{display:grid;grid-template-columns:1fr 1.4fr;gap:12px}
.nc-field{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.nc-field label{font-size:13.5px;font-weight:600;color:var(--texto-secundario)}
.nc-field input{font:inherit;font-size:15px;padding:13px 14px;border:1px solid var(--borda-suave);border-radius:var(--radius-sm);background:#fff;width:100%;box-sizing:border-box}
.nc-field input:focus{border-color:var(--verde-moss);outline:none}
.nc-hp{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}
.nc-check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--texto-secundario);margin:4px 0 14px;line-height:1.45}
.nc-check input{margin-top:3px}
.nc-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;font-weight:600;font-size:15.5px;padding:15px 22px;border-radius:var(--radius-sm);border:none;cursor:pointer;background:var(--verde-moss);color:#fff;box-shadow:var(--shadow-card)}
.nc-btn:hover{filter:brightness(1.08)}
.nc-btn[disabled]{opacity:.6;cursor:wait}
.nc-erro{color:#8a1f1f;font-size:14px;margin:0 0 10px;display:none}
.nc-erro.is-visible{display:block}
.nc-nota{font-size:12.5px;margin:10px 0 0;color:var(--texto-secundario)}
.nc-ok{font-size:15.5px;margin:0;color:var(--grafite)}
@media(max-width:560px){.nc-row{grid-template-columns:1fr}.nc-box{padding:18px}}
`;

function track(t, p) { try { if (window.PDEvents) window.PDEvents.send(t, null, p || {}); } catch (e) {} }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function montar(rootId, cfg) {
  const root = document.getElementById(rootId);
  if (!root) return;
  if (!document.getElementById("nc-style")) {
    const st = document.createElement("style");
    st.id = "nc-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const LS_KEY = "pd_news_" + cfg.id;
  const p = "nc-" + cfg.id + "-";
  const box = document.createElement("section");
  box.className = "nc-box";
  box.setAttribute("aria-label", cfg.titulo);
  root.appendChild(box);

  if (lsGet(LS_KEY)) {
    box.innerHTML = '<p class="nc-kicker">Newsletter</p><p class="nc-ok">✓ ' + cfg.ok + "</p>";
    return;
  }

  box.innerHTML = `
    <p class="nc-kicker">Newsletter</p>
    <h3>${cfg.titulo}</h3>
    <p class="nc-lead">${cfg.lead}</p>
    <form novalidate>
      <div class="nc-row">
        <div class="nc-field">
          <label for="${p}nome">Seu nome</label>
          <input id="${p}nome" type="text" autocomplete="given-name" maxlength="100">
        </div>
        <div class="nc-field">
          <label for="${p}email">Seu e-mail</label>
          <input id="${p}email" type="email" autocomplete="email" placeholder="seu@email.com" required>
        </div>
      </div>
      <div class="nc-hp" aria-hidden="true">
        <label for="${p}website">Deixe este campo em branco</label>
        <input type="text" id="${p}website" tabindex="-1" autocomplete="off">
      </div>
      <label class="nc-check">
        <input type="checkbox" id="${p}servico" required>
        <span>Li e aceito a <a href="/confidentialite/" target="_blank" rel="noopener">Política de Privacidade</a>. *</span>
      </label>
      <p class="nc-erro" role="alert"></p>
      <button class="nc-btn" type="submit">${cfg.botao}</button>
      <p class="nc-nota">${cfg.argumento}</p>
    </form>`;

  const $ = (id) => document.getElementById(p + id);
  const erroEl = box.querySelector(".nc-erro");
  const erro = (m) => { erroEl.textContent = m; erroEl.classList.toggle("is-visible", !!m); };
  const shownAt = Date.now();

  box.querySelector("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro("");
    const email = $("email").value.trim();
    const nome = $("nome").value.trim();
    if ($("website").value || (Date.now() - shownAt) < 2500) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erro("Confere o e-mail e tenta de novo."); return; }
    if (!$("servico").checked) { erro("Preciso que você aceite a Política de Privacidade pra continuar."); return; }
    const btn = box.querySelector(".nc-btn");
    const textoBtn = btn.textContent;
    btn.disabled = true; btn.textContent = "Enviando...";
    const params = new URLSearchParams(window.location.search);
    const payload = {
      email,
      nome,
      persona: cfg.persona,
      origem: cfg.origem,
      aceita_servico: true,
      aceita_novidades: true,
      consentimento_versao: CONSENTIMENTO_VERSAO,
      texto_servico: TEXTO_SERVICO,
      texto_novidades: cfg.argumento,
    };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => {
      const v = params.get(k); if (v) payload[k] = v.slice(0, 100);
    });
    const igId = params.get("ig"); if (igId) payload.ig = igId.slice(0, 60);
    try {
      const r = await supabase.rpc("capturar_lead", { payload });
      if (r.error) throw r.error;
      lsSet(LS_KEY, "1");
      track("newsletter_inscricao", { lista: cfg.id, origem: cfg.origem, utm_campaign: params.get("utm_campaign") || null });
      box.innerHTML = '<p class="nc-kicker">Newsletter</p><p class="nc-ok">✓ ' + cfg.ok + "</p>";
    } catch (e) {
      console.error("capturar_lead:", e);
      erro("Não consegui confirmar agora. Confere o e-mail e tenta de novo.");
      btn.disabled = false; btn.textContent = textoBtn;
    }
  });
}

export function mountNewsletterEiffel(rootId) { montar(rootId, EIFFEL); }
