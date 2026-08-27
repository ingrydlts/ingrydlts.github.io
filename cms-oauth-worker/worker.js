/**
 * Worker único que serve o que o site Por Dentro precisa:
 *
 * 1. Proxy OAuth entre o Decap CMS (/admin) e o GitHub.
 *    Rotas: /auth (inicia o login) e /callback (troca o code pelo token).
 *
 * 2. API de avaliações de produto (estrelas + comentário), com moderação.
 *    Rotas: GET /api/reviews (público, só aprovadas), POST /api/reviews
 *    (público, grava pendente), GET /api/reviews/all e POST /api/reviews/moderate
 *    (protegidas — exigem token de alguém com permissão de escrita no
 *    repositório, o mesmo token que o /auth acima gera).
 *
 * 3. Paywall dos artigos premium — assinatura mensal OU compra avulsa por
 *    artigo, via Stripe. O texto pago nunca é commitado no repo — fica só no
 *    KV, servido apenas pra quem prova ter acesso (assinatura ativa ou compra
 *    daquele artigo específico). Rotas:
 *      GET/POST/DELETE /api/premium/content   — escrita do texto pago (protegidas,
 *                                                usadas pelo painel /admin/premium/)
 *      POST /api/premium/verify-session       — público: troca um Checkout Session
 *                                                do Stripe (assinatura OU compra
 *                                                avulsa, detecta pelo `mode`) por
 *                                                um token de acesso
 *      POST /api/premium/restore              — público: reemite token(s) a partir
 *                                                do e-mail — cobre tanto assinatura
 *                                                ativa quanto artigos comprados
 *                                                avulsos no passado
 *      GET  /api/premium/article              — exige Authorization: Bearer <token>,
 *                                                devolve o texto pago de um slug se
 *                                                o token cobrir esse slug
 *    Dois tipos de token: assinatura (`scope: "all"`, cobre qualquer artigo
 *    premium, expira em ~14 dias — sem webhook, é o que força revalidar) e
 *    compra avulsa (`scope: "article", slug`, cobre só aquele artigo,
 *    permanente — não tem cobrança recorrente pra reconferir).
 *    Os dois links de pagamento do Stripe (assinatura e avulso) devem apontar,
 *    depois do pagamento, pra mesma página de confirmação genérica do site
 *    (`/artigos/assinatura-confirmada/?session_id={CHECKOUT_SESSION_ID}`), que
 *    troca o session_id pelo token e redireciona de volta pro artigo certo
 *    usando o `client_reference_id` — por isso o site sempre anexa
 *    `?client_reference_id=<slug>` nos dois links antes de mandar a leitora
 *    pro Stripe.
 *
 * 4. Eventos de produto (feedback dos artigos, interações do bot, blocos
 *    interativos) — grava num banco D1, não numa KV, porque o painel de
 *    insights (/admin/dashboard/) precisa consultar/agregar essas linhas
 *    depois. Rotas:
 *      POST /api/events           — público, sem autenticação (mesma
 *                                    lógica das avaliações: qualquer
 *                                    visitante pode gerar um evento, com
 *                                    throttle por IP contra flood).
 *                                    event_type é validado contra uma lista
 *                                    fixa (ALLOWED_EVENT_TYPES) — adicione
 *                                    o tipo novo aí antes de usá-lo no site.
 *      GET  /api/insights/summary — protegida (mesmo token de quem tem
 *                                    acesso de escrita no repositório),
 *                                    usada pelo painel /admin/dashboard/.
 *

 * Variáveis de ambiente necessárias (Settings → Variables and Secrets no Worker):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  — do GitHub OAuth App (ver README.md)
 *   RESEND_API_KEY, NOTIFY_EMAIL            — opcionais: avisam por e-mail toda
 *                                              vez que chega avaliação pendente
 *                                              (ver README.md). Sem elas, as
 *                                              avaliações continuam funcionando
 *                                              normalmente, só não avisam.
 *   STRIPE_SECRET_KEY                       — chave secreta do Stripe (sk_...),
 *                                              necessária pro paywall funcionar.
 *   STRIPE_PRICE_ID                         — opcional, mas recomendado: Price ID
 *                                              da assinatura, pra confirmar que a
 *                                              assinatura ativa é a certa (e não
 *                                              algum outro produto Stripe).
 *   STRIPE_ARTICLE_PRICE_ID                 — opcional, mas recomendado: Price ID
 *                                              da compra avulsa por artigo, mesmo
 *                                              motivo do STRIPE_PRICE_ID acima.
 *   ACCESS_TOKEN_SECRET                     — string aleatória qualquer, usada
 *                                              pra assinar os tokens de acesso
 *                                              premium (HMAC). Necessária pro
 *                                              paywall funcionar.
 *   ADMIN_EMAILS                            — opcional: lista de e-mails
 *                                              separados por vírgula que sempre
 *                                              recebem acesso total via
 *                                              /api/premium/restore, sem passar
 *                                              pelo Stripe — útil pra revisar
 *                                              como o conteúdo pago aparece.
 *                                              Trate como senha: não use um
 *                                              e-mail que já é público no site.
 * Bindings de KV necessários (Settings → Bindings):
 *   REVIEWS_KV — namespace vazia, usada pelas avaliações (e também pelo
 *                throttle de /api/events, ver EVENTS_THROTTLE_SECONDS)
 *   PREMIUM_KV — namespace vazia, usada pelo texto pago dos artigos premium
 * Binding de D1 necessário (Settings → Bindings):
 *   EVENTS_DB — banco criado com o schema de schema.sql, usado por
 *               /api/events — ver README.md
 */

const REPO_OWNER = 'ingrydlts';
const REPO_NAME = 'ingrydlts.github.io';
const REVIEWS_KEY = 'reviews_db';
const RATING_VALUES = [1, 2, 3, 4, 5];
const PREMIUM_KEY = 'premium_content';
const ALLOWED_EVENT_TYPES = ['feedback', 'bot', 'block'];
// KV exige TTL mínimo de 60s, então o throttle é por janela (contador), não
// por trava única como o das avaliações — eventos são esperados com mais
// frequência (várias respostas do bot numa sessão, por exemplo).
const EVENTS_WINDOW_SECONDS = 60;
const EVENTS_MAX_PER_WINDOW = 20;
const SUBSCRIPTION_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 dias — sem webhook do Stripe, é isso que força revalidar
const ARTICLE_TOKEN_TTL_SECONDS = 20 * 365 * 24 * 60 * 60; // compra avulsa: paga uma vez, acesso permanente na prática
const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'];

function renderCallbackPage(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!DOCTYPE html>
<html><body>
<script>
  (function () {
    function receiveMessage(e) {
      window.opener.postMessage('${message}', e.origin);
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script>
</body></html>`;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function getDB(env) {
  const raw = await env.REVIEWS_KV.get(REVIEWS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveDB(env, db) {
  await env.REVIEWS_KV.put(REVIEWS_KEY, JSON.stringify(db));
}

function summarize(reviews) {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  for (const r of reviews) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    sum += r.rating;
  }
  const count = reviews.length;
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
  };
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Token de acesso premium (HMAC assinado, sem estado no servidor) ----

function bytesToBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hmacKey(env) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.ACCESS_TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function mintAccessToken(payload, ttlSeconds, env) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ ...payload, exp })));
  const key = await hmacKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return payloadB64 + '.' + bytesToBase64Url(new Uint8Array(sig));
}

// Token de assinatura: cobre qualquer artigo premium, expira em ~14 dias
// (sem webhook do Stripe, é a expiração que força revalidar).
function mintSubscriptionToken(email, env) {
  return mintAccessToken({ email, scope: 'all' }, SUBSCRIPTION_TOKEN_TTL_SECONDS, env);
}

// Token de compra avulsa: cobre só um slug específico, "permanente" na prática
// (não tem cobrança recorrente pra reconferir, então não faz sentido expirar cedo).
function mintArticleToken(email, slug, env) {
  return mintAccessToken({ email, scope: 'article', slug }, ARTICLE_TOKEN_TTL_SECONDS, env);
}

// Confere se um token dá acesso a um slug específico.
function tokenCoversSlug(payload, slug) {
  return payload.scope === 'all' || (payload.scope === 'article' && payload.slug === slug);
}

// Retorna o payload (email, scope, slug?, exp) se o token for válido e ainda
// não tiver expirado, senão null.
async function verifyAccessToken(token, env) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  let valid = false;
  try {
    const key = await hmacKey(env);
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(payloadB64)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ---- Stripe (chamadas simples via REST, sem SDK) ----

async function stripeFetch(env, path, query) {
  const url = new URL('https://api.stripe.com/v1' + path);
  if (query) url.search = query;
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Confere se uma subscription bate com o price configurado (se STRIPE_PRICE_ID
// estiver setado) — evita liberar acesso pra assinatura de outro produto Stripe.
function subscriptionMatchesPrice(subscription, env) {
  if (!env.STRIPE_PRICE_ID) return true;
  const priceIds = ((subscription.items && subscription.items.data) || []).map((item) => item.price && item.price.id);
  return priceIds.includes(env.STRIPE_PRICE_ID);
}

// Mesma ideia, mas pra line items de uma Checkout Session em modo pagamento
// único (compra avulsa) — evita liberar acesso pra outro produto Stripe.
function lineItemsMatchPrice(lineItems, env) {
  if (!env.STRIPE_ARTICLE_PRICE_ID) return true;
  const priceIds = ((lineItems && lineItems.data) || []).map((item) => item.price && item.price.id);
  return priceIds.includes(env.STRIPE_ARTICLE_PRICE_ID);
}

async function getPremiumDB(env) {
  const raw = await env.PREMIUM_KV.get(PREMIUM_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function savePremiumDB(env, db) {
  await env.PREMIUM_KV.put(PREMIUM_KEY, JSON.stringify(db));
}

// Avisa por e-mail (via Resend) que chegou avaliação pendente. Silenciosa se
// as variáveis não estiverem configuradas, e nunca deixa uma falha de envio
// impedir a avaliação de ser salva — é só uma notificação, não é crítico.
async function sendModerationEmail(env, review) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) {
    console.log('sendModerationEmail: RESEND_API_KEY ou NOTIFY_EMAIL não configurados — pulando envio.');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Por Dentro <onboarding@resend.dev>',
        to: env.NOTIFY_EMAIL,
        subject: 'Nova avaliação pendente — ' + review.slug,
        html:
          '<p><strong>' + escapeHtml(review.name) + '</strong> deu ' + review.rating + ' estrela(s) em <strong>' + escapeHtml(review.slug) + '</strong>:</p>' +
          '<p>"' + escapeHtml(review.comment) + '"</p>' +
          `<p><a href="https://${REPO_OWNER}.github.io/admin/avaliacoes/">Aprovar ou rejeitar</a></p>`,
      }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      console.error('sendModerationEmail: Resend respondeu ' + res.status + ' — ' + bodyText);
    } else {
      console.log('sendModerationEmail: enviado com sucesso — ' + bodyText);
    }
  } catch (err) {
    // segue o jogo — a avaliação já foi salva, o e-mail é só um aviso a mais
    console.error('sendModerationEmail: falhou — ' + String(err));
  }
}

// Confere se o dono do token tem permissão de escrita no repo — mesmo token
// que o Decap CMS já usa pra publicar. Não precisamos de um sistema de conta
// separado: quem consegue editar o site pelo /admin também pode moderar.
async function requireCollaborator(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const headers = {
    Authorization: `token ${token}`,
    'User-Agent': 'por-dentro-reviews-worker',
    Accept: 'application/vnd.github+json',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user.login) return null;

  const permRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/collaborators/${user.login}/permission`,
    { headers }
  );
  if (!permRes.ok) return null;
  const perm = await permRes.json();
  if (perm.permission === 'admin' || perm.permission === 'write') return user.login;
  return null;
}

// ---- Eventos de produto (feedback, bot, blocos interativos) — D1, público ----

async function handlePostEvent(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const eventType = String(body.event_type || '').trim();
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    return json({ error: 'Tipo de evento inválido.' }, 400);
  }
  const articleSlug = body.article_slug ? String(body.article_slug).trim().slice(0, 150) : null;
  const sessionId = body.session_id ? String(body.session_id).trim().slice(0, 100) : null;
  let payload;
  try {
    payload = JSON.stringify(body.payload == null ? {} : body.payload).slice(0, 2000);
  } catch {
    payload = '{}';
  }

  // throttle por janela — não é pra impedir uso normal (várias respostas do
  // bot, ou duas pessoas na mesma rede), só flood.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const throttleKey = `throttle:events:${ip}`;
  const current = await env.REVIEWS_KV.get(throttleKey);
  const count = current ? parseInt(current, 10) || 0 : 0;
  if (count >= EVENTS_MAX_PER_WINDOW) {
    return json({ error: 'Muitas requisições — tente de novo em instantes.' }, 429);
  }
  await env.REVIEWS_KV.put(throttleKey, String(count + 1), { expirationTtl: EVENTS_WINDOW_SECONDS });

  if (!env.EVENTS_DB) return json({ error: 'Banco de eventos ainda não configurado.' }, 500);

  await env.EVENTS_DB.prepare(
    'INSERT INTO events (id, event_type, article_slug, payload, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), eventType, articleSlug, payload, sessionId, new Date().toISOString())
    .run();

  return json({ ok: true }, 201);
}

// Agrega os eventos gravados acima pro painel /admin/dashboard/ — protegida
// igual à moderação de avaliações (mesmo token de quem tem acesso de
// escrita no repositório). "sessions" conta session_id distintos, não
// linhas — evita inflar o funil se a mesma visitante reabrir o assistente.
async function handleInsightsSummary(request, env) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);
  if (!env.EVENTS_DB) return json({ error: 'Banco de eventos ainda não configurado.' }, 500);

  const [overview, feedback, botFunnel, botOutcomes, checklist, daily] = await Promise.all([
    env.EVENTS_DB.prepare('SELECT COUNT(*) as total, COUNT(DISTINCT session_id) as sessions FROM events').all(),
    env.EVENTS_DB.prepare(
      `SELECT article_slug,
              SUM(CASE WHEN json_extract(payload,'$.vote')='up' THEN 1 ELSE 0 END) as up,
              SUM(CASE WHEN json_extract(payload,'$.vote')='down' THEN 1 ELSE 0 END) as down
       FROM events WHERE event_type='feedback' GROUP BY article_slug`
    ).all(),
    env.EVENTS_DB.prepare(
      `SELECT json_extract(payload,'$.step') as step, COUNT(DISTINCT session_id) as sessions
       FROM events WHERE event_type='bot' GROUP BY step`
    ).all(),
    env.EVENTS_DB.prepare(
      `SELECT json_extract(payload,'$.outcome') as outcome, COUNT(DISTINCT session_id) as sessions
       FROM events WHERE event_type='bot' AND json_extract(payload,'$.step')='result' GROUP BY outcome ORDER BY sessions DESC`
    ).all(),
    env.EVENTS_DB.prepare(
      `SELECT json_extract(payload,'$.id') as checklist_id, COUNT(*) as completions
       FROM events WHERE event_type='block' AND json_extract(payload,'$.type')='checklist_complete' GROUP BY checklist_id ORDER BY completions DESC`
    ).all(),
    env.EVENTS_DB.prepare(
      `SELECT substr(created_at,1,10) as day, COUNT(*) as count FROM events WHERE created_at >= date('now','-30 days') GROUP BY day ORDER BY day`
    ).all()
  ]);

  return json({
    overview: (overview.results && overview.results[0]) || { total: 0, sessions: 0 },
    feedback: feedback.results || [],
    botFunnel: botFunnel.results || [],
    botOutcomes: botOutcomes.results || [],
    checklist: checklist.results || [],
    daily: daily.results || []
  });
}

async function handleGetReviews(request, env, url) {
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'Faltou o parâmetro "slug".' }, 400);

  const db = await getDB(env);
  const all = db[slug] || [];
  const approved = all
    .filter((r) => r.status === 'approved')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => ({ name: r.name, rating: r.rating, comment: r.comment, createdAt: r.createdAt }));

  return json({ reviews: approved, summary: summarize(approved) });
}

async function handlePostReview(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  // honeypot: campo invisível pra humanos, se veio preenchido é bot —
  // responde sucesso sem gravar nada, pra não ensinar o bot a se adaptar.
  if (body.hp) return json({ ok: true });

  const slug = String(body.slug || '').trim().slice(0, 100);
  const name = String(body.name || '').trim().slice(0, 80);
  const comment = String(body.comment || '').trim().slice(0, 600);
  const rating = Math.round(Number(body.rating));

  if (!slug) return json({ error: 'Produto não identificado.' }, 400);
  if (!name) return json({ error: 'Preencha seu nome.' }, 400);
  if (!comment) return json({ error: 'Escreva um comentário.' }, 400);
  if (!RATING_VALUES.includes(rating)) return json({ error: 'Escolha uma nota de 1 a 5 estrelas.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const throttleKey = `throttle:${ip}`;
  const throttled = await env.REVIEWS_KV.get(throttleKey);
  if (throttled) return json({ error: 'Você já enviou uma avaliação agora há pouco — tente de novo em 1 minuto.' }, 429);
  await env.REVIEWS_KV.put(throttleKey, '1', { expirationTtl: 60 });

  const db = await getDB(env);
  if (!db[slug]) db[slug] = [];
  db[slug].push({
    id: crypto.randomUUID(),
    name,
    rating,
    comment,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
  await saveDB(env, db);

  ctx.waitUntil(sendModerationEmail(env, { slug, name, rating, comment }));

  return json({ ok: true }, 201);
}

// Lista tanto pendentes (pra aprovar/rejeitar) quanto já aprovadas (pra dar
// pra remover uma avaliação publicada por engano ou de teste).
async function handleAllReviews(request, env) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);

  const db = await getDB(env);
  const pending = [];
  const approved = [];
  for (const slug of Object.keys(db)) {
    for (const r of db[slug]) {
      if (r.status === 'pending') pending.push({ ...r, slug });
      if (r.status === 'approved') approved.push({ ...r, slug });
    }
  }
  pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ pending, approved });
}

async function handleModerate(request, env) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const { id, slug, action } = body;
  if (!id || !slug || !['approve', 'reject'].includes(action)) {
    return json({ error: 'Parâmetros inválidos.' }, 400);
  }

  const db = await getDB(env);
  const list = db[slug] || [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return json({ error: 'Avaliação não encontrada.' }, 404);

  if (action === 'approve') {
    list[idx].status = 'approved';
  } else {
    list.splice(idx, 1);
  }
  db[slug] = list;
  await saveDB(env, db);

  return json({ ok: true });
}

// ---- Painel /admin/premium/ — escrita do texto pago, protegida igual à moderação ----

async function handleListPremiumContent(request, env) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);

  const db = await getPremiumDB(env);
  return json({ items: db });
}

async function handleSavePremiumContent(request, env) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const slug = String(body.slug || '').trim().slice(0, 100);
  const text = String(body.body || '');
  if (!slug) return json({ error: 'Faltou o slug do artigo.' }, 400);
  if (!text.trim()) return json({ error: 'O conteúdo não pode ficar vazio.' }, 400);

  const db = await getPremiumDB(env);
  db[slug] = text;
  await savePremiumDB(env, db);

  return json({ ok: true });
}

async function handleDeletePremiumContent(request, env, url) {
  const moderator = await requireCollaborator(request, env);
  if (!moderator) return json({ error: 'Sem permissão. Faça login com uma conta que tem acesso ao repositório.' }, 401);

  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'Faltou o parâmetro "slug".' }, 400);

  const db = await getPremiumDB(env);
  delete db[slug];
  await savePremiumDB(env, db);

  return json({ ok: true });
}

// ---- Checkout e restauração de acesso (público) ----

async function handleVerifySession(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const sessionId = String(body.session_id || '').trim();
  if (!sessionId) return json({ error: 'Faltou o parâmetro "session_id".' }, 400);
  if (!env.STRIPE_SECRET_KEY || !env.ACCESS_TOKEN_SECRET) {
    return json({ error: 'Assinatura ainda não configurada neste site.' }, 500);
  }

  const { ok, data: session } = await stripeFetch(
    env,
    '/checkout/sessions/' + encodeURIComponent(sessionId),
    'expand[]=subscription&expand[]=line_items'
  );
  if (!ok || !session) return json({ error: 'Sessão de pagamento inválida.' }, 400);

  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  if (!email) return json({ error: 'Não foi possível identificar o e-mail do pagamento.' }, 400);

  // client_reference_id carrega o slug do artigo em que a leitora clicou pra
  // pagar — usado aqui pra saber pra onde redirecionar depois da confirmação
  // (e, na compra avulsa, também define QUAL artigo o token cobre).
  const returnSlug = session.client_reference_id || null;

  if (session.mode === 'subscription') {
    const subscription = session.subscription;
    if (!subscription || !ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      return json({ error: 'Assinatura ainda não está ativa.' }, 400);
    }
    if (!subscriptionMatchesPrice(subscription, env)) {
      return json({ error: 'Assinatura não corresponde ao plano esperado.' }, 400);
    }
    const token = await mintSubscriptionToken(email, env);
    return json({ token, email, scope: 'all', returnSlug });
  }

  if (session.mode === 'payment') {
    if (session.payment_status !== 'paid') {
      return json({ error: 'Pagamento ainda não confirmado.' }, 400);
    }
    if (!returnSlug) {
      return json({ error: 'Não foi possível identificar qual artigo foi comprado.' }, 400);
    }
    if (!lineItemsMatchPrice(session.line_items, env)) {
      return json({ error: 'Compra não corresponde ao produto esperado.' }, 400);
    }
    const token = await mintArticleToken(email, returnSlug, env);
    return json({ token, email, scope: 'article', slug: returnSlug, returnSlug });
  }

  return json({ error: 'Modo de pagamento não suportado.' }, 400);
}

async function handleRestoreAccess(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!email || !email.includes('@')) return json({ error: 'Digite um e-mail válido.' }, 400);
  if (!env.ACCESS_TOKEN_SECRET) {
    return json({ error: 'Assinatura ainda não configurada neste site.' }, 500);
  }

  // Acesso de administradora: e-mails em ADMIN_EMAILS pulam a checagem do
  // Stripe e sempre recebem um token de acesso total — pra revisar como o
  // conteúdo pago aparece pra quem paga, sem precisar de uma assinatura real.
  // Trate esse e-mail como uma senha: quem descobrir ele destrava tudo de
  // graça, então não use um endereço que já apareça em algum lugar público
  // do site.
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes(email)) {
    const token = await mintSubscriptionToken(email, env);
    return json({ ok: true, found: true, email, tokens: [{ token, scope: 'all' }] });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Assinatura ainda não configurada neste site.' }, 500);
  }

  // Throttle por IP e por e-mail — o segundo evita que alguém teste um e-mail
  // específico repetidas vezes de IPs diferentes pra tentar adivinhar assinantes.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = `throttle:restore:ip:${ip}`;
  const emailKey = `throttle:restore:email:${email}`;
  const [ipThrottled, emailThrottled] = await Promise.all([
    env.PREMIUM_KV.get(ipKey),
    env.PREMIUM_KV.get(emailKey),
  ]);
  if (ipThrottled || emailThrottled) return json({ error: 'Aguarde um minuto antes de tentar de novo.' }, 429);
  await Promise.all([
    env.PREMIUM_KV.put(ipKey, '1', { expirationTtl: 60 }),
    env.PREMIUM_KV.put(emailKey, '1', { expirationTtl: 60 }),
  ]);

  // Resposta genérica em qualquer caminho onde não achamos nada — não dá pra
  // usar esse endpoint pra descobrir se um e-mail tem acesso ou não.
  const genericResponse = () =>
    json({
      ok: true,
      found: false,
      message: 'Se este e-mail tiver assinatura ativa ou algum artigo comprado, o acesso é liberado automaticamente. Caso contrário, nada acontece.',
    });

  const { ok, data: customerList } = await stripeFetch(env, '/customers', 'email=' + encodeURIComponent(email) + '&limit=20');
  if (!ok || !customerList || !Array.isArray(customerList.data)) return genericResponse();

  const tokens = [];

  for (const customer of customerList.data) {
    // Assinatura ativa cobre qualquer artigo — basta achar uma.
    let hasSubscription = false;
    for (const status of ACTIVE_SUBSCRIPTION_STATUSES) {
      if (hasSubscription) break;
      const { ok: subOk, data: subList } = await stripeFetch(
        env,
        '/subscriptions',
        `customer=${encodeURIComponent(customer.id)}&status=${status}&limit=20`
      );
      if (!subOk || !subList || !Array.isArray(subList.data)) continue;
      if (subList.data.some((sub) => subscriptionMatchesPrice(sub, env))) hasSubscription = true;
    }
    if (hasSubscription) {
      tokens.push({ token: await mintSubscriptionToken(email, env), scope: 'all' });
    }

    // Compras avulsas: sessões de checkout em modo pagamento, pagas, com
    // client_reference_id (o slug do artigo comprado).
    const { ok: sessOk, data: sessList } = await stripeFetch(
      env,
      '/checkout/sessions',
      `customer=${encodeURIComponent(customer.id)}&limit=100&expand[]=data.line_items`
    );
    if (sessOk && sessList && Array.isArray(sessList.data)) {
      const seenSlugs = new Set();
      for (const session of sessList.data) {
        if (session.mode !== 'payment' || session.payment_status !== 'paid') continue;
        const slug = session.client_reference_id;
        if (!slug || seenSlugs.has(slug)) continue;
        if (!lineItemsMatchPrice(session.line_items, env)) continue;
        seenSlugs.add(slug);
        tokens.push({ token: await mintArticleToken(email, slug, env), scope: 'article', slug });
      }
    }
  }

  if (!tokens.length) return genericResponse();
  return json({ ok: true, found: true, email, tokens });
}

// ---- Leitura do artigo premium (exige token válido) ----

async function handleGetPremiumArticle(request, env, url) {
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'Faltou o parâmetro "slug".' }, 400);

  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const payload = await verifyAccessToken(token, env);
  if (!payload) return json({ error: 'Acesso expirado ou inválido.' }, 401);
  if (!tokenCoversSlug(payload, slug)) return json({ error: 'Este acesso não cobre este artigo.' }, 403);

  const db = await getPremiumDB(env);
  const articleBody = db[slug];
  if (!articleBody) return json({ error: 'Conteúdo ainda não disponível.' }, 404);

  return json({ body: articleBody });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/auth') {
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set('scope', 'repo,user');
      authUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
      return Response.redirect(authUrl.toString(), 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Faltou o parâmetro "code" no callback do GitHub.', { status: 400 });
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return new Response(
          renderCallbackPage('error', { message: tokenData.error_description || 'Falha ao obter o token do GitHub.' }),
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      return new Response(
        renderCallbackPage('success', { token: tokenData.access_token, provider: 'github' }),
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    try {
      if (url.pathname === '/api/events' && request.method === 'POST') {
        return await handlePostEvent(request, env, ctx);
      }
      if (url.pathname === '/api/insights/summary' && request.method === 'GET') {
        return await handleInsightsSummary(request, env);
      }
      if (url.pathname === '/api/reviews' && request.method === 'GET') {
        return await handleGetReviews(request, env, url);
      }
      if (url.pathname === '/api/reviews' && request.method === 'POST') {
        return await handlePostReview(request, env, ctx);
      }
      if (url.pathname === '/api/reviews/all' && request.method === 'GET') {
        return await handleAllReviews(request, env);
      }
      if (url.pathname === '/api/reviews/moderate' && request.method === 'POST') {
        return await handleModerate(request, env);
      }
      if (url.pathname === '/api/premium/content' && request.method === 'GET') {
        return await handleListPremiumContent(request, env);
      }
      if (url.pathname === '/api/premium/content' && request.method === 'POST') {
        return await handleSavePremiumContent(request, env);
      }
      if (url.pathname === '/api/premium/content' && request.method === 'DELETE') {
        return await handleDeletePremiumContent(request, env, url);
      }
      if (url.pathname === '/api/premium/verify-session' && request.method === 'POST') {
        return await handleVerifySession(request, env);
      }
      if (url.pathname === '/api/premium/restore' && request.method === 'POST') {
        return await handleRestoreAccess(request, env);
      }
      if (url.pathname === '/api/premium/article' && request.method === 'GET') {
        return await handleGetPremiumArticle(request, env, url);
      }
    } catch (err) {
      return json({ error: 'Erro interno.', detail: String(err) }, 500);
    }

    return new Response('Not found', { status: 404 });
  },
};
