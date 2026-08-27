// Por Dentro — bloco de assinatura/compra avulsa + resolução do slot premium,
// compartilhado entre o template dinâmico de artigo e páginas de artigo
// com estrutura própria (como a da ANEF) que precisam da mesma trava.

import { escapeHtml, fetchJSON } from "/assets/js/render.js";
import { markdownToBlocks } from "/assets/js/markdown.js";
import { initBuyBox } from "/assets/js/purchase.js";
import { fetchPremiumBody, verifySessionFromUrl, restoreAccess } from "/assets/js/premium.js";

// O texto pago normalmente é markdown simples (o padrão, escrito no textarea
// do /admin/premium/). Mas se a autora escrever HTML puro à mão — pra manter
// estrutura rica: callouts, modelos com botão de copiar, timeline etc., como
// nas páginas herdadas de antes do paywall — isso precisa chegar intacto,
// sem passar pelo parser de markdown (que escapa `<` e `>`). A regra é
// simples e previsível: se o texto começa com `<`, é tratado como HTML puro.
function renderPremiumBody(raw, slug) {
  const trimmed = (raw || "").trim();
  if (trimmed.startsWith("<")) return trimmed;
  return markdownToBlocks(raw, { slug }).join("");
}

// Anexa ?client_reference_id=<slug> ao link do Stripe — é assim que a sessão
// de checkout guarda de qual artigo veio, tanto pra saber pra onde
// redirecionar depois quanto (na compra avulsa) pra saber o que liberar.
function withReturnSlug(paymentLink, slug) {
  if (!paymentLink) return "";
  const sep = paymentLink.includes("?") ? "&" : "?";
  return paymentLink + sep + "client_reference_id=" + encodeURIComponent(slug);
}

function premiumGateHTML(cfg) {
  return (
    '<div class="buy-box" style="max-width:520px; margin:32px auto 0;">' +
    '<span class="eyebrow" style="color:#604034;">' + escapeHtml(cfg.paywallTitle || "Continue lendo com a assinatura") + "</span>" +
    '<p class="muted" style="margin:6px 0 16px;">' + escapeHtml(cfg.paywallBody || "") + "</p>" +

    '<div id="premium-buybox-sub" style="margin-bottom:22px; padding-bottom:22px; border-bottom:1px solid var(--borda);">' +
    '<label class="gate-checkbox"><input type="checkbox" data-gate-checkbox><span>Entendo que o acesso ao conteúdo é imediato e renuncio ao meu direito de retratação de 14 dias.</span></label>' +
    '<button class="btn btn-block" data-gate-button disabled style="background:#604034;">Assinar — ' + escapeHtml(cfg.priceLabel || "") + "</button>" +
    '<p class="gate-message" data-gate-message></p>' +
    "</div>" +

    '<div id="premium-buybox-article" style="margin-bottom:8px;">' +
    '<p style="font-size:13px; font-weight:600; margin:0 0 8px;">Ou compre só este artigo</p>' +
    '<label class="gate-checkbox"><input type="checkbox" data-gate-checkbox><span>Entendo que o acesso ao conteúdo é imediato e renuncio ao meu direito de retratação de 14 dias.</span></label>' +
    '<button class="btn btn-block" data-gate-button disabled style="background:#8AACD2;">Comprar este artigo — ' + escapeHtml(cfg.articlePriceLabel || "") + "</button>" +
    '<p class="gate-message" data-gate-message></p>' +
    "</div>" +

    '<div style="margin-top:18px; padding-top:18px; border-top:1px solid var(--borda);">' +
    '<p style="font-size:13px; font-weight:600; margin:0 0 8px;">Já assina ou já comprou este artigo?</p>' +
    '<form id="premium-restore-form" style="display:flex; gap:8px; flex-wrap:wrap;">' +
    '<input type="email" required placeholder="seu@email.com" id="premium-restore-email" style="flex:1; min-width:180px; padding:9px 12px; border:1px solid var(--borda); border-radius:4px; font-family:var(--font-body); font-size:13px;">' +
    '<button type="submit" class="btn" style="padding:9px 16px; font-size:13px;">Recuperar acesso</button>' +
    "</form>" +
    '<p id="premium-restore-msg" style="font-size:12px; margin-top:8px;"></p>' +
    "</div>" +
    (cfg.customerPortalUrl
      ? '<p style="font-size:12px; margin-top:14px;"><a href="' + escapeHtml(cfg.customerPortalUrl) + '" target="_blank" rel="noopener">Gerenciar ou cancelar assinatura</a></p>'
      : "") +
    "</div>"
  );
}

function wirePremiumGate(cfg, slug, onUnlocked) {
  const subBox = document.getElementById("premium-buybox-sub");
  const articleBox = document.getElementById("premium-buybox-article");
  if (!subBox || !articleBox) return;
  initBuyBox(subBox, withReturnSlug(cfg.stripePaymentLink, slug));
  initBuyBox(articleBox, withReturnSlug(cfg.articlePaymentLink, slug));

  const form = document.getElementById("premium-restore-form");
  const emailInput = document.getElementById("premium-restore-email");
  const msg = document.getElementById("premium-restore-msg");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    msg.style.color = "var(--texto-secundario)";
    msg.textContent = "Verificando…";
    restoreAccess(emailInput.value.trim()).then(function (res) {
      submitBtn.disabled = false;
      if (res.ok && res.found) {
        msg.style.color = "var(--verde-moss)";
        msg.textContent = "Acesso liberado! Carregando o artigo completo…";
        onUnlocked();
      } else if (res.ok) {
        msg.style.color = "var(--texto-secundario)";
        msg.textContent = res.message || "Se este e-mail tiver assinatura ativa, o acesso é liberado.";
      } else {
        msg.style.color = "var(--merlot)";
        msg.textContent = res.message || "Não foi possível confirmar agora. Tente de novo.";
      }
    });
  });
}

// Resolve o conteúdo de um <div id="{slotId}"> — troca por texto pago se já
// houver acesso, ou mostra o bloco de assinatura/compra avulsa caso contrário.
// Chamar de novo (ela mesma se rechama após "recuperar acesso" funcionar).
export async function resolvePremiumSlot(slotId, slug) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  // Se a pessoa acabou de voltar do Stripe, troca o session_id por um token.
  await verifySessionFromUrl();

  const result = await fetchPremiumBody(slug);
  if (result.ok) {
    slot.outerHTML = renderPremiumBody(result.body, slug);
    document.dispatchEvent(new CustomEvent("pd:blocks-rendered"));
    return;
  }

  let cfg = {};
  try {
    cfg = await fetchJSON("/content/premium-config.json");
  } catch {
    // sem config ainda — mostra o bloco mesmo assim, só sem link de pagamento
  }
  slot.innerHTML =
    premiumGateHTML(cfg) +
    (result.reason === "not-ready"
      ? '<p class="muted" style="margin-top:10px;">Esse artigo ainda está sendo preparado — volte em breve.</p>'
      : "");
  wirePremiumGate(cfg, slug, function () {
    resolvePremiumSlot(slotId, slug);
  });
}
