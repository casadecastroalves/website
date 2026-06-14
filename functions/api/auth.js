function configErrorHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Login do painel — configurar OAuth</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    code { background: #f4f4f4; padding: 0.1rem 0.35rem; }
    .box { background: #fff8e6; border-left: 3px solid #d4af37; padding: 1rem; margin: 1rem 0; }
    a { color: #876700; }
  </style>
</head>
<body>
  <h1>Login ainda não activo</h1>
  <p>As variáveis <code>GITHUB_CLIENT_ID</code> e <code>GITHUB_CLIENT_SECRET</code> ainda não chegaram às funções do site.</p>
  <div class="box">
    <p><strong>Se já guardou as variáveis no Cloudflare:</strong></p>
    <ol>
      <li>Cloudflare → <strong>Deployments</strong> (separador em cima)</li>
      <li>No deploy da branch <strong>main</strong> → <strong>⋯</strong> → <strong>Retry deployment</strong></li>
      <li>Aguardar estado <strong>Success</strong> (~2 min)</li>
      <li>Fechar esta janela e tentar login outra vez</li>
    </ol>
    <p>Confirme em Settings → Variables que <code>GITHUB_CLIENT_ID</code> e <code>GITHUB_CLIENT_SECRET</code> existem para <strong>Production</strong>.</p>
  </div>
  <p>Guia completo: <a href="/admin/ajuda.html">/admin/ajuda.html</a></p>
  <p><a href="/admin/">← Voltar ao painel</a></p>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const client_id = env.GITHUB_CLIENT_ID;

  if (!client_id) {
    return new Response(configErrorHtml(), {
      status: 503,
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  }

  try {
    const url = new URL(request.url);
    const redirectUrl = new URL('https://github.com/login/oauth/authorize');
    redirectUrl.searchParams.set('client_id', client_id);
    redirectUrl.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
    redirectUrl.searchParams.set('scope', 'repo user');
    redirectUrl.searchParams.set('state', crypto.randomUUID());
    return Response.redirect(redirectUrl.href, 302);
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
