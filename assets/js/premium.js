// Por Dentro — acesso aos artigos premium (assinatura ou compra avulsa via Stripe).
// Guarda uma lista de tokens assinados no localStorage — um pode cobrir todos
// os artigos (assinatura), outros podem cobrir só um artigo específico (compra
// avulsa). O texto pago em si nunca passa por aqui sem o token ser validado
// pelo Worker a cada pedido.

const WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";
const TOKENS_KEY = "pd_premium_tokens";

function base64UrlToJson(str) {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// Só decodifica o payload pra saber o que o token *diz* que cobre — não prova
// nada sozinho, é só pra escolher qual token tentar primeiro. A validação de
// verdade (assinatura HMAC) sempre acontece no Worker.
function decodeTokenPayload(token) {
  if (!token || typeof token !== "string") return null;
  const [payloadB64] = token.split(".");
  if (!payloadB64) return null;
  return base64UrlToJson(payloadB64);
}

function getStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveStoredTokens(list) {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(list));
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem persistir
  }
}

// Acrescenta um ou mais tokens novos à lista guardada, sem duplicar.
export function addTokens(tokenObjs) {
  const incoming = (Array.isArray(tokenObjs) ? tokenObjs : [tokenObjs]).filter((t) => t && t.token);
  if (!incoming.length) return;
  const current = getStoredTokens();
  const known = new Set(current.map((t) => t.token));
  incoming.forEach((t) => {
    if (!known.has(t.token)) {
      current.push({ token: t.token, email: t.email });
      known.add(t.token);
    }
  });
  saveStoredTokens(current);
}

function removeToken(token) {
  saveStoredTokens(getStoredTokens().filter((t) => t.token !== token));
}

export function clearAllTokens() {
  saveStoredTokens([]);
}

// Busca o texto pago de um artigo tentando, entre os tokens guardados, os que
// dizem cobrir esse slug (assinatura ou compra avulsa daquele artigo).
// Retorna { ok: true, body } ou { ok: false, reason: "no-token" | "not-ready" | "error" }.
export async function fetchPremiumBody(slug) {
  const now = Math.floor(Date.now() / 1000);
  const candidates = getStoredTokens().filter((t) => {
    const p = decodeTokenPayload(t.token);
    return p && p.exp && p.exp > now && (p.scope === "all" || (p.scope === "article" && p.slug === slug));
  });
  if (!candidates.length) return { ok: false, reason: "no-token" };

  for (const cand of candidates) {
    let res;
    try {
      res = await fetch(WORKER_BASE + "/api/premium/article?slug=" + encodeURIComponent(slug), {
        headers: { Authorization: "Bearer " + cand.token },
      });
    } catch {
      continue;
    }
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.body) return { ok: true, body: data.body };
      continue;
    }
    if (res.status === 401) {
      removeToken(cand.token);
      continue;
    }
    if (res.status === 404) return { ok: false, reason: "not-ready" };
    // 403 (esse token não cobre este slug, apesar do payload sugerir) — tenta o próximo
  }
  return { ok: false, reason: "no-token" };
}

// Se a URL tiver ?session_id= (retorno do Stripe), troca por um token de acesso
// e limpa o parâmetro da URL. Retorna { token, email, scope, slug?, returnSlug }
// em caso de sucesso, ou null.
export async function verifySessionFromUrl() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return null;

  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);

  try {
    const res = await fetch(WORKER_BASE + "/api/premium/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.token) return null;
    addTokens({ token: data.token, email: data.email });
    return data;
  } catch {
    return null;
  }
}

// Tenta recuperar acesso a partir do e-mail usado no pagamento (assinatura
// ativa e/ou artigos comprados avulsos). Nunca revela se o e-mail existe ou não.
export async function restoreAccess(email) {
  try {
    const res = await fetch(WORKER_BASE + "/api/premium/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error || "Não foi possível confirmar o acesso agora." };
    if (Array.isArray(data.tokens) && data.tokens.length) {
      addTokens(data.tokens.map((t) => ({ token: t.token, email: data.email || email })));
    }
    return { ok: true, found: !!data.found, message: data.message || "" };
  } catch {
    return { ok: false, message: "Não foi possível confirmar o acesso agora. Tente de novo." };
  }
}
