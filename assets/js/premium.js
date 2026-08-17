// Por Dentro — acesso aos artigos premium (assinatura via Stripe).
// Guarda um token assinado no localStorage; o texto pago em si nunca passa
// por aqui sem esse token ser validado pelo Worker a cada pedido.

const WORKER_BASE = "https://por-dentro-cms-oauth.ingrydigitalmanagement.workers.dev";
const TOKEN_KEY = "pd_premium_token";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuth(token, email) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, email }));
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem persistir
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Busca o texto pago de um artigo usando o token guardado.
// Retorna { ok: true, body } ou { ok: false, reason: "no-token" | "expired" | "not-ready" | "error" }.
export async function fetchPremiumBody(slug) {
  const auth = getStoredAuth();
  if (!auth) return { ok: false, reason: "no-token" };

  let res;
  try {
    res = await fetch(WORKER_BASE + "/api/premium/article?slug=" + encodeURIComponent(slug), {
      headers: { Authorization: "Bearer " + auth.token },
    });
  } catch {
    return { ok: false, reason: "error" };
  }

  if (res.status === 401) {
    clearAuth();
    return { ok: false, reason: "expired" };
  }
  if (res.status === 404) return { ok: false, reason: "not-ready" };
  if (!res.ok) return { ok: false, reason: "error" };

  const data = await res.json().catch(() => null);
  if (!data || !data.body) return { ok: false, reason: "error" };
  return { ok: true, body: data.body };
}

// Se a URL tiver ?session_id= (retorno do Stripe), troca por um token de acesso
// e limpa o parâmetro da URL. Retorna { token, email } em caso de sucesso, ou null.
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
    saveAuth(data.token, data.email);
    return data;
  } catch {
    return null;
  }
}

// Tenta recuperar acesso a partir do e-mail usado no pagamento.
// Retorna { ok, found, message } — nunca revela se o e-mail existe ou não.
export async function restoreAccess(email) {
  try {
    const res = await fetch(WORKER_BASE + "/api/premium/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error || "Não foi possível confirmar o acesso agora." };
    if (data.token) saveAuth(data.token, data.email || email);
    return { ok: true, found: !!data.found, message: data.message || "" };
  } catch {
    return { ok: false, message: "Não foi possível confirmar o acesso agora. Tente de novo." };
  }
}
