export async function onRequest(context) {
  const { request, env } = context;
  const client_id = env.GITHUB_CLIENT_ID;

  if (!client_id) {
    return new Response('GITHUB_CLIENT_ID não configurado no Cloudflare Pages.', { status: 500 });
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
