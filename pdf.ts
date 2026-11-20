import puppeteer from '@cloudflare/puppeteer';
import type { Env, Props } from './base44';

// Gera o orçamento usando o próprio HEROGRAN: um navegador na nuvem (Browser Run)
// abre a página /imprimir/orcamento/:id já logado como o usuário. A página calcula
// com a tabela da empresa, grava o valor na negociação, gera o PDF com o mesmo
// componente do botão e devolve o link em window.__herogranPdf.

export interface ResultadoPdf {
  ok: boolean;
  erro?: string;
  pdf_url?: string;
  total?: number;
  orcamento_no_pdf?: string;
  total_orcamento_no_pdf?: number;
  orcamentos?: Array<{ id: unknown; nome: string; total: number }>;
}

// cálculo + fotos 3D que faltarem (até 25 s) + PDF
const TEMPO_MAX_MS = 85_000;

export async function gerarPdfOrcamento(env: Env, props: Props, negocioId: string): Promise<ResultadoPdf> {
  if (!env.BROWSER) return { ok: false, erro: 'Navegador na nuvem não configurado no servidor.' };
  const base = env.APP_URL.replace(/\/$/, '');
  const host = new URL(base).hostname;
  // Mesma sessão que o login do HEROGRAN grava no navegador (HeroLoginGate)
  const sessao = JSON.stringify({
    nickname: props.nickname,
    role: props.role || 'user',
    userId: props.userId,
    full_name: props.fullName || props.nickname,
    empresaId: props.empresaId,
    token: props.heroToken,
  });

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(env.BROWSER, { keep_alive: 120_000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluateOnNewDocument(
      (h: string, s: string) => {
        const g = globalThis as any; // roda dentro do navegador
        if (g.location.hostname === h) g.localStorage.setItem('herogran_session', s);
      },
      host,
      sessao,
    );
    await page.goto(`${base}/imprimir/orcamento/${encodeURIComponent(negocioId)}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(() => (globalThis as any).__herogranPdf, { timeout: TEMPO_MAX_MS });
    const r = (await page.evaluate(() => (globalThis as any).__herogranPdf)) as ResultadoPdf;
    return r && typeof r === 'object' ? r : { ok: false, erro: 'A página de impressão não respondeu.' };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    if (/429|time limit/i.test(msg)) return { ok: false, erro: 'Limite diário do navegador na nuvem atingido. Gere o PDF pelo botão da negociação.' };
    if (/timeout|Waiting failed/i.test(msg)) return { ok: false, erro: 'O orçamento demorou demais para gerar. Gere o PDF pelo botão da negociação.' };
    return { ok: false, erro: `Não foi possível gerar o PDF agora (${msg}).` };
  } finally {
    try { await browser?.close(); } catch { /* segue */ }
  }
}

export const brl = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined;

// ── PDF no domínio próprio ───────────────────────────────────────
// O arquivo fica no armazenamento do app (Base44); o Worker entrega pelo endereço dele,
// assim o cliente não vê "base44" no link. Só serve PDFs públicos deste app.
const NOME_ARQUIVO = /^[A-Za-z0-9_.-]+\.pdf$/;

export function linkPdfProprio(url: string | undefined, env: Env, origem: string) {
  if (!url) return url;
  const nome = url.split('/').pop() || '';
  if (!NOME_ARQUIVO.test(nome)) return url;
  const base = (env.ARQUIVOS_URL || origem || '').replace(/\/$/, '');
  return base ? `${base}/orcamento/${nome}` : url;
}

export async function entregarPdf(url: URL, env: Env): Promise<Response> {
  const nome = decodeURIComponent(url.pathname.slice('/orcamento/'.length));
  if (!NOME_ARQUIVO.test(nome)) return new Response('Arquivo não encontrado', { status: 404 });
  const origem = await fetch(`https://media.base44.com/files/public/${env.BASE44_APP_ID}/${nome}`, { cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
  if (!origem.ok || !origem.body) return new Response('Arquivo não encontrado', { status: 404 });
  const amigavel = nome.replace(/^[a-z0-9]+_/, ''); // tira o prefixo aleatório do armazenamento
  return new Response(origem.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${amigavel}"`,
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
