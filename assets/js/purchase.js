// Por Dentro — gate legal (renúncia ao direito de retratação) + redirecionamento
// pro Stripe. Exigência: o botão de pagamento só fica clicável depois que a
// pessoa marca a checkbox manualmente (checkbox pré-marcada não vale).
// Ver seção 3.3 da especificação.

// Anexa ?client_reference_id=<slug> ao link do Stripe — mesma técnica de
// assets/js/premium-gate.js (withReturnSlug), aqui pro checkout de produto
// digital: é assim que POST /api/purchase/verify-session (ver worker.js)
// sabe qual produto foi comprado quando a leitora volta pra
// /produtos-digitais/obrigado/ depois de pagar.
function withProductSlug(paymentLink, slug) {
  if (!paymentLink || !slug) return paymentLink;
  const sep = paymentLink.includes("?") ? "&" : "?";
  return paymentLink + sep + "client_reference_id=" + encodeURIComponent(slug);
}

export function initBuyBox(root, stripeLink, slug) {
  const checkbox = root.querySelector('[data-gate-checkbox]');
  const button = root.querySelector('[data-gate-button]');
  const message = root.querySelector('[data-gate-message]');
  if (!checkbox || !button) return;

  function sync() {
    button.disabled = !checkbox.checked;
  }
  checkbox.addEventListener("change", sync);
  sync();

  button.addEventListener("click", function () {
    if (button.disabled) return;
    if (!stripeLink) {
      if (message) {
        message.textContent =
          "Link de pagamento ainda não configurado — adicione o Stripe Payment Link deste produto no /admin.";
        message.classList.add("is-visible");
      }
      return;
    }
    window.location.href = withProductSlug(stripeLink, slug);
  });
}
