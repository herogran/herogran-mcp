// Tela de entrada + consentimento do conector (aberta pelo Claude/ChatGPT na
// hora de conectar). Tudo que vem do cliente OAuth (nome, domínio) é escapado.

// Logo HEROGRAN no padrão do app (src/index.css, .font-logo): Poppins 700, espaçamento 0.05em
const FONTE_LOGO = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap" rel="stylesheet">';

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface DadosTela {
  handle: string;
  clientName: string;
  clientDomain?: string;
  redirectHost: string;
  redirectIsLoopback: boolean;
  slug?: string;
  nickname?: string;
  erro?: string;
}

export function telaConectar(d: DadosTela): string {
  const origem = d.clientDomain
    ? `Publicado por <strong>${esc(d.clientDomain)}</strong>.`
    : 'Este aplicativo se cadastrou sozinho; o nome dele não é verificado.';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Conectar ao HEROGRAN</title>
${FONTE_LOGO}
<style>
  :root { --azul:#162839; --amarelo:#fab700; --cinza:#8a8f98; --borda:#e2e5e9; --erro:#b42318; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 16px;
         background:var(--azul); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--azul); }
  main { width:100%; max-width:420px; background:#fff; padding:32px 28px; }
  h1 { margin:0 0 4px; font-family:'Poppins', sans-serif; font-size:26px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; line-height:1.1; }
  .sub { margin:0 0 24px; color:var(--cinza); font-size:13px; }
  .pedido { border-left:3px solid var(--amarelo); background:#fffbeb; padding:12px 14px; font-size:14px; line-height:1.5; margin-bottom:20px; }
  .pedido small { display:block; color:#5b616b; margin-top:4px; }
  .alerta { background:#fef3f2; color:var(--erro); padding:10px 12px; font-size:13px; margin-bottom:16px; }
  label { display:block; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.15em; color:var(--cinza); margin:14px 0 6px; }
  input { width:100%; height:44px; border:1px solid var(--borda); padding:0 12px; font-size:15px; color:var(--azul); }
  input:focus { outline:none; border-color:var(--azul); }
  ul { margin:18px 0 0; padding-left:18px; font-size:13px; color:#3d4450; line-height:1.6; }
  .botoes { display:flex; gap:10px; margin-top:24px; }
  button { flex:1; height:44px; border:1px solid var(--azul); font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; cursor:pointer; }
  .sim { background:var(--amarelo); border-color:var(--amarelo); color:var(--azul); }
  .nao { background:#fff; color:var(--azul); }
</style>
</head>
<body>
<main>
  <h1>HEROGRAN</h1>
  <p class="sub">Conectar assistente de IA</p>
  <div class="pedido">
    <strong>${esc(d.clientName)}</strong> quer acessar o HEROGRAN em seu nome.
    <small>${origem} O acesso será enviado para <strong>${esc(d.redirectHost)}</strong>.</small>
    ${d.redirectIsLoopback ? '<small><strong>Atenção:</strong> o acesso vai para um aplicativo neste computador. Continue só se você acabou de pedir a conexão nele.</small>' : ''}
  </div>
  ${d.erro ? `<div class="alerta" role="alert">${esc(d.erro)}</div>` : ''}
  <form method="post" autocomplete="on">
    <input type="hidden" name="handle" value="${esc(d.handle)}">
    <input type="hidden" name="clientName" value="${esc(d.clientName)}">
    <input type="hidden" name="clientDomain" value="${esc(d.clientDomain || '')}">
    <input type="hidden" name="redirectHost" value="${esc(d.redirectHost)}">
    <input type="hidden" name="redirectIsLoopback" value="${d.redirectIsLoopback ? '1' : ''}">
    <label for="slug">Identificador da empresa</label>
    <input id="slug" name="slug" placeholder="ex: marmoraria-silva" value="${esc(d.slug || '')}" autocapitalize="none" spellcheck="false">
    <label for="nickname">Usuário</label>
    <input id="nickname" name="nickname" value="${esc(d.nickname || '')}" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="senha">Senha</label>
    <input id="senha" name="senha" type="password" autocomplete="current-password">
    <ul>
      <li>Ver as negociações, orçamentos e projetos da sua marmoraria</li>
      <li>Criar negócios e projetos, se o seu perfil permitir</li>
      <li>Nunca exclui nada, não marca negócio como ganho nem mexe em preços</li>
    </ul>
    <div class="botoes">
      <button class="nao" name="decision" value="deny" formnovalidate>Recusar</button>
      <button class="sim" name="decision" value="approve">Entrar e permitir</button>
    </div>
  </form>
</main>
</body>
</html>`;
}

export function telaErro(mensagem: string, status = 400): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HEROGRAN</title>${FONTE_LOGO}<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#162839;font-family:system-ui,sans-serif}
main{max-width:420px;background:#fff;padding:28px;color:#162839}h1{font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;letter-spacing:.05em;margin:0 0 12px}</style></head>
<body><main><h1>HEROGRAN</h1><p>${esc(mensagem)}</p><p>Volte ao Claude ou ChatGPT e tente conectar de novo.</p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' } });
}
