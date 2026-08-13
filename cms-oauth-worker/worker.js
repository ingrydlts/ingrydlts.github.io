/**
 * Proxy OAuth entre o Decap CMS (/admin) e o GitHub.
 * Duas rotas: /auth (inicia o login) e /callback (troca o code pelo token).
 * Precisa de duas variáveis de ambiente no Worker: GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET
 * (do GitHub OAuth App — ver README.md desta pasta).
 */

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    return new Response('Not found', { status: 404 });
  },
};
