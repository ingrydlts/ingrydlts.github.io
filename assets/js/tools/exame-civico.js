// Por Dentro — cards de venda embutidos no artigo "tudo-sobre-o-exame-civico":
// template gratuito (Notion) e os cards de pré-venda (Completo/Pro) com captura
// de e-mail via Brevo. Mesmo padrão de assets/js/tools/vae-2026.js — fica num
// módulo à parte porque o corpo do artigo é editado como markdown puro pelo
// /admin, e o parser (assets/js/markdown.js) escapa HTML de propósito.
//
// Diferente do vae-2026.js, usa só classes CSS que já existem globalmente
// (rt-product-card, badge, callout, btn, grid — ver assets/css/style.css),
// então não precisa injetar CSS próprio.

const BREVO_FORM_URL =
  "https://87a2c382.sibforms.com/serve/MUIFAIwmiB8s2PzK9IQjWJAyZXYAuhMUVXEZazS6yYhy4FQ8cRUH9kxX_Lj2UOiyJYef5N7gKyAD4ocDbd2E12r4cD3IY2-H9_1nSpvDiuS-YP-M857sotXuAlqwNMjYuaA2KzBi6VyNuuwEZ2JedDRphtp9fadptPU9l3HmNmVgQWZvAhhxdTF_J33ZuTzsXMj0hMg5L_nrNJwjKw==";

function wireReserveButtons(root) {
  root.querySelectorAll(".reserve-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrap = btn.closest("div");
      const input = wrap.querySelector(".reserve-email");
      const email = input ? input.value.trim() : "";
      if (!email || email.indexOf("@") === -1) {
        if (input) { input.style.borderColor = "#b43c3c"; input.focus(); }
        return;
      }
      const originalText = btn.textContent;
      btn.textContent = "Aguarde...";
      btn.disabled = true;
      const body = new URLSearchParams();
      body.append("EMAIL", email);
      body.append("INTERESSE_TEMPLATE", btn.dataset.interesse);
      body.append("email_address_check", "");
      body.append("locale", "pt_BR");
      fetch(BREVO_FORM_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
        .then((res) => {
          if (res.ok) {
            btn.textContent = "✓ Reservado. Cupom a caminho.";
            btn.style.background = "var(--verde-moss)";
            if (input) { input.disabled = true; input.style.opacity = "0.5"; }
          } else {
            throw new Error("Erro no envio");
          }
        })
        .catch(() => {
          btn.textContent = originalText;
          btn.disabled = false;
          if (input) input.style.borderColor = "#b43c3c";
        });
    });
  });
}

export function mountTemplateGratis(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML =
    '<div class="rt-product-card" style="max-width:520px; margin:0 auto;">' +
    '<div class="rt-product-preview"><img src="https://d8j0ntlcm91z4.cloudfront.net/user_3EliA4rWN5dyMbxnDs8XeabydAE/hf_20260608_123534_c470ffd8-a20f-4ee6-a936-dd4de392e7e7.png" alt="Francês Todo Dia — dashboard com gráficos de progresso e calendário" loading="lazy"></div>' +
    '<span class="badge" style="background:var(--placid-blue); color:#fff; margin-bottom:10px;">Grátis · Notion</span>' +
    '<h3 style="margin-bottom:4px;">🗓️ Francês Todo Dia</h3>' +
    '<div class="rt-product-price">€0 <span>/ Grátis — por enquanto</span></div>' +
    '<p class="muted" style="font-size:14px;">Para quem estuda francês no meio da vida — sem tempo a perder e sem saber por onde começar.</p>' +
    '<ul style="font-size:13px; color:var(--grafite); padding-left:0; list-style:none; margin-bottom:18px;">' +
    '<li style="padding:7px 0; border-bottom:1px solid var(--borda-suave);">✓ Registro diário de vocabulário com contexto e revisão integrada</li>' +
    '<li style="padding:7px 0; border-bottom:1px solid var(--borda-suave);">✓ Checklist de temas — inclusive os do exame cívico</li>' +
    '<li style="padding:7px 0; border-bottom:1px solid var(--borda-suave);">✓ Múltiplas bases de dados e visualizações já configuradas</li>' +
    '<li style="padding:7px 0; border-bottom:1px solid var(--borda-suave);">✓ Barra de progresso integrada para não perder o ritmo</li>' +
    '<li style="padding:7px 0;">✓ 100% mobile — estude no celular onde der</li>' +
    "</ul>" +
    '<div class="callout callout-warn" style="margin:0 0 18px;">' +
    '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--beje-paris-text); margin-bottom:4px;">⏳ Tempo limitado</div>' +
    "<strong>Em breve este template vai passar de gratuito para €7.</strong>" +
    "</div>" +
    '<p class="muted" style="font-size:13px;">Sem cadastro, sem lista de espera. Só clicar e duplicar no Notion.</p>' +
    '<a href="https://ingrydigital.gumroad.com/l/jmfbf" target="_blank" rel="noopener" class="btn btn-pill btn-block" style="background:var(--placid-blue);">Baixar grátis agora — antes que mude →</a>' +
    "</div>";
}

export function mountPricing(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML =
    '<div class="grid grid-2">' +
    '<div class="rt-product-card">' +
    '<span class="badge" style="background:var(--beje-paris); color:#2B2B2B; margin-bottom:10px;">+ Mais Completo</span>' +
    "<h3>📦 Completo</h3>" +
    '<div class="rt-product-price">€19 <span>/ R$99</span></div>' +
    '<p class="muted" style="font-size:13.5px;">Para quem tem prazo e precisa de um sistema real de preparação.</p>' +
    '<ul style="font-size:13px; color:var(--grafite); padding-left:18px; margin-bottom:18px;">' +
    "<li>Database de Objetivos + Timeline de Marcos</li><li>Database de Prática por habilidade</li><li>Dashboard de progresso (Listening, Reading, Writing, Speaking)</li><li>Template de Revisão Semanal</li><li>Conquistas + Guia de Ativação 5 passos</li>" +
    "</ul>" +
    '<div class="callout callout-warn" style="margin:0;">' +
    '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--beje-paris-text); margin-bottom:6px;">Pré-venda · Em breve</div>' +
    "<strong>🔔 Reserve seu lugar com desconto</strong>" +
    '<p style="margin:6px 0 10px; font-weight:700;">60% OFF na pré-venda — €19 → €7,60</p>' +
    '<p style="font-size:12.5px; margin-bottom:12px;">Deixe seu e-mail agora. Assim que o Completo abrir, você recebe o link com preço de pré-venda.</p>' +
    '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
    '<input type="email" class="reserve-email" placeholder="seu@email.com" style="flex:1; min-width:160px; padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--borda); font-family:var(--font-body); font-size:13px;">' +
    '<button type="button" class="btn reserve-btn" data-interesse="Completo" style="background:var(--grafite); font-size:12.5px;">Quero os 60% de desconto</button>' +
    "</div></div></div>" +
    '<div class="rt-product-card">' +
    "<h3>💎 Pro</h3>" +
    '<div class="rt-product-price">€37 <span>/ R$197</span></div>' +
    '<p class="muted" style="font-size:13.5px;">Para quem está com a data marcada e quer tudo configurado desde o início.</p>' +
    '<ul style="font-size:13px; color:var(--grafite); padding-left:18px; margin-bottom:18px;">' +
    "<li>Tudo do Completo</li><li>Vista Mobile — Estudo Rápido no metrô</li><li>Tutorial Loom ~15min (ativação guiada)</li><li>Guia por Habilidade (o que priorizar por nível)</li><li>Atualizações por 12 meses</li>" +
    "</ul>" +
    '<div class="callout callout-warn" style="margin:0;">' +
    '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--beje-paris-text); margin-bottom:6px;">Pré-venda · Em breve</div>' +
    "<strong>🔔 Reserve seu lugar com desconto</strong>" +
    '<p style="margin:6px 0 10px; font-weight:700;">60% OFF na pré-venda — €37 → €14,80</p>' +
    '<p style="font-size:12.5px; margin-bottom:12px;">Deixa seu e-mail. Quando o Pro abrir, você recebe antes de todo mundo.</p>' +
    '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
    '<input type="email" class="reserve-email" placeholder="seu@email.com" style="flex:1; min-width:160px; padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--borda); font-family:var(--font-body); font-size:13px;">' +
    '<button type="button" class="btn reserve-btn" data-interesse="Pro" style="background:var(--grafite); font-size:12.5px;">Quero os 60% de desconto</button>' +
    "</div></div></div>" +
    "</div>" +
    '<p class="muted text-center" style="font-size:12px; margin-top:16px;">A taxa de inscrição vai de €95 a €250. Reprovar e refazer o exame custa mais que o template.</p>';
  wireReserveButtons(root);
}
