// Chamadas às funções do app HEROGRAN no Base44.
// O Worker não guarda regra de negócio: quem decide empresa, perfil e
// permissão é sempre o backend do app (heroLogin e mcpHerogran).

export interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: import('@cloudflare/workers-oauth-provider').OAuthHelpers;
  /** URL pública deste Worker (opcional; sem ela usa o endereço do próprio request) */
  PUBLIC_URL?: string;
  /** Domínio do app HEROGRAN (onde as funções rodam e para onde os links apontam) */
  APP_URL: string;
  BASE44_APP_ID: string;
}

/** O que fica guardado (cifrado) no token do conector */
export interface Props {
  heroToken: string;
  heroExp: number; // segundos (exp do token HEROGRAN)
  userId: string;
  nickname: string;
  empresaId: string;
  empresa: string;
  [key: string]: unknown;
}

export class ErroHerogran extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function chamarFuncao(env: Env, nome: string, corpo: Record<string, unknown>) {
  const url = `${env.APP_URL.replace(/\/$/, '')}/api/apps/${env.BASE44_APP_ID}/functions/${nome}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Id': env.BASE44_APP_ID },
    body: JSON.stringify(corpo),
  });
  let dados: any = null;
  try { dados = await res.json(); } catch { /* resposta sem JSON */ }
  if (!res.ok || dados?.error) {
    throw new ErroHerogran(dados?.error || `O HEROGRAN respondeu ${res.status}.`, res.status);
  }
  return dados;
}

export async function heroLogin(env: Env, slug: string, nickname: string, password: string) {
  return chamarFuncao(env, 'heroLogin', { slug: slug.trim().toLowerCase(), nickname, password });
}

export async function acaoMcp(env: Env, props: Props, action: string, args: Record<string, unknown> = {}) {
  return chamarFuncao(env, 'mcpHerogran', { ...args, action, token: props.heroToken });
}

/** Lê o exp do JWT do HEROGRAN (só leitura; quem valida a assinatura é o app) */
export function expDoToken(token: string): number {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return Number(JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))).exp) || 0;
  } catch {
    return 0;
  }
}
