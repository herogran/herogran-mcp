import { OAuthProvider, AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { heroLogin, expDoToken, ErroHerogran, type Env, type Props } from './base44';
import { handleMcp } from './mcp';
import { telaConectar, telaErro } from './pagina';

// Servidor MCP da HEROGRAN.
//  - /authorize: tela de login (empresa + usuário + senha) e consentimento;
//    o login é o heroLogin do próprio app.
//  - /mcp: o endpoint que o Claude/ChatGPT chamam, com o token do conector.
//  - Descoberta, token, cadastro de cliente (DCR) e revogação: a biblioteca.
// O token HEROGRAN do usuário fica cifrado dentro do grant (props).

const HORA = 60 * 60;
const SCOPES = ['herogran', 'offline_access'];

const mcpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext & { props?: Props }) {
    return handleMcp(request, env, ctx.props as Props);
  },
};

const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/authorize') return autorizar(request, env);
    if (url.pathname === '/') {
      return new Response('Servidor MCP da HEROGRAN. Endereço do conector: ' + url.origin + '/mcp', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return new Response('Não encontrado', { status: 404 });
  },
};

async function autorizar(request: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (request.method === 'GET') {
      const pedido = await oauth.parseAuthRequest(request);
      const det = await oauth.describeConsent(pedido);
      const consent = await oauth.beginConsent(pedido);
      consent.headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(
        telaConectar({
          handle: consent.handle,
          clientName: det.clientName,
          clientDomain: det.clientDomain,
          redirectHost: det.redirectHost,
          redirectIsLoopback: det.redirectIsLoopback,
        }),
        { headers: consent.headers },
      );
    }

    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const form = await request.formData();
    const handle = String(form.get('handle') || '');

    if (form.get('decision') !== 'approve') {
      const negado = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: negado.headers });
    }

    const slug = String(form.get('slug') || '').trim();
    const nickname = String(form.get('nickname') || '').trim();
    const senha = String(form.get('senha') || '');
    const deNovo = (erro: string, status = 200) =>
      new Response(
        telaConectar({
          handle,
          clientName: String(form.get('clientName') || ''),
          clientDomain: String(form.get('clientDomain') || '') || undefined,
          redirectHost: String(form.get('redirectHost') || ''),
          redirectIsLoopback: !!form.get('redirectIsLoopback'),
          slug,
          nickname,
          erro,
        }),
        { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' } },
      );

    if (!slug || !nickname || !senha) return deNovo('Preencha o identificador da empresa, o usuário e a senha.');

    // Login pelo próprio HEROGRAN (bloqueio por senha errada, inadimplência e usuário inativo valem aqui também)
    let login: any;
    try {
      login = await heroLogin(env, slug, nickname, senha);
    } catch (e) {
      if (e instanceof ErroHerogran && e.status < 500) return deNovo(e.message);
      return deNovo('Não foi possível falar com o HEROGRAN agora. Tente de novo em instantes.');
    }

    const props: Props = {
      heroToken: login.token,
      heroExp: expDoToken(login.token),
      userId: String(login.session.userId),
      nickname: String(login.session.nickname),
      empresaId: String(login.session.empresaId),
      empresa: String(login.empresa?.nome || ''),
    };

    const aprovado = await oauth.approveConsent(request, handle);
    const { redirectTo } = await oauth.completeAuthorization({
      request: aprovado.request,
      userId: `${props.empresaId}.${props.userId}`,
      metadata: { empresa: props.empresa, nickname: props.nickname },
      scope: aprovado.request.scope,
      props,
    });
    aprovado.headers.set('Location', redirectTo);
    return new Response(null, { status: 302, headers: aprovado.headers });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError) return telaErro(error.description);
    if (error instanceof CimdFetchError) return telaErro('Não foi possível verificar o aplicativo que pediu a conexão.');
    throw error;
  }
}

// O provider precisa da URL pública (vem do env), então nasce no primeiro request
let provider: OAuthProvider<Env> | null = null;
function getProvider(env: Env, origem: string) {
  if (!provider) {
    // PUBLIC_URL é opcional: sem ela, vale o endereço por onde o Worker foi chamado
    const base = (env.PUBLIC_URL || origem).replace(/\/$/, '');
    provider = new OAuthProvider<Env>({
      apiRoute: '/mcp',
      apiHandler: mcpHandler as any,
      defaultHandler: defaultHandler as any,
      authorizeEndpoint: '/authorize',
      tokenEndpoint: '/oauth/token',
      clientRegistrationEndpoint: '/oauth/register', // DCR: Claude e ChatGPT usam
      clientIdMetadataDocumentEnabled: true, // CIMD: clientes mais novos
      scopesSupported: SCOPES,
      accessTokenTTL: HORA,
      // O token HEROGRAN vale 7 dias; depois disso o usuário entra de novo
      refreshTokenTTL: 7 * 24 * HORA - HORA,
      resourceMetadata: {
        resource: `${base}/mcp`,
        authorization_servers: [base],
        resource_name: 'HEROGRAN',
      } as any,
    });
  }
  return provider;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return getProvider(env, new URL(request.url).origin).fetch(request, env, ctx);
  },
};
