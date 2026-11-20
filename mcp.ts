import { ErroHerogran, type Env, type Props } from './base44';
import { FERRAMENTAS, executarFerramenta } from './tools';

// Servidor MCP "stateless" sobre Streamable HTTP: cada POST traz uma mensagem
// JSON-RPC e recebe a resposta em JSON. Sem sessão, sem SSE (nenhuma
// ferramenta precisa de streaming), o que deixa o Worker simples e barato.

const VERSOES = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVIDOR = { name: 'herogran', title: 'HEROGRAN', version: '1.0.0' };
const INSTRUCOES =
  'Conector do HEROGRAN, sistema de orçamento 3D e CRM para marmorarias. ' +
  'Os dados são só da marmoraria do usuário conectado e seguem o perfil de acesso dele. ' +
  'Valores em R$. Antes de criar um negócio ou projeto, confirme os dados com o usuário. ' +
  'Sempre entregue os links devolvidos para o usuário abrir no HEROGRAN. ' +
  'Para montar orçamento no CAD3D, pergunte as peças uma a uma (como o formulário do sistema) e use adicionar_pecas_orcamento.';

type Mensagem = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: any };

const ok = (id: Mensagem['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const erro = (id: Mensagem['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function resultadoTexto(dados: unknown, isError = false) {
  const texto = typeof dados === 'string' ? dados : JSON.stringify(dados, null, 2);
  return {
    content: [{ type: 'text', text: texto }],
    ...(!isError && dados && typeof dados === 'object' && !Array.isArray(dados) ? { structuredContent: dados } : {}),
    isError,
  };
}

async function tratar(msg: Mensagem, env: Env, props: Props, origem: string) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize': {
      const pedida = params?.protocolVersion;
      return ok(id, {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVIDOR,
        instructions: INSTRUCOES,
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, {
        tools: FERRAMENTAS.map(({ acao, ...f }) => f),
      });
    case 'tools/call': {
      const nome = String(params?.name || '');
      if (!FERRAMENTAS.some((f) => f.name === nome)) return erro(id, -32602, `Ferramenta desconhecida: ${nome}`);
      if (props.heroExp && props.heroExp * 1000 < Date.now()) {
        return ok(id, resultadoTexto('Sua sessão do HEROGRAN expirou. Desconecte e conecte de novo o conector HEROGRAN para entrar outra vez.', true));
      }
      try {
        const dados = await executarFerramenta(env, props, nome, params?.arguments || {}, origem);
        return ok(id, resultadoTexto(dados));
      } catch (e) {
        const msgErro = e instanceof ErroHerogran && e.status === 401
          ? `${e.message} Se continuar, desconecte e conecte de novo o conector HEROGRAN.`
          : (e as Error).message || 'Erro ao falar com o HEROGRAN.';
        return ok(id, resultadoTexto(msgErro, true));
      }
    }
    default:
      return erro(id, -32601, `Método não suportado: ${method}`);
  }
}

export async function handleMcp(request: Request, env: Env, props: Props): Promise<Response> {
  if (request.method === 'GET') {
    // Sem stream de notificações do servidor
    return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } });
  }
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json(erro(null, -32700, 'JSON inválido.'), { status: 400 });
  }

  const lista = Array.isArray(corpo) ? corpo : [corpo];
  const respostas: unknown[] = [];
  for (const m of lista as Mensagem[]) {
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
      if (m && m.id !== undefined) respostas.push(erro(m.id, -32600, 'Requisição inválida.'));
      continue;
    }
    if (m.id === undefined || m.id === null) continue; // notificação (ex.: notifications/initialized)
    respostas.push(await tratar(m, env, props, new URL(request.url).origin));
  }

  if (!respostas.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(corpo) ? respostas : respostas[0], {
    headers: { 'Cache-Control': 'no-store' },
  });
}
