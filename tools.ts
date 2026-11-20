import { acaoMcp, type Env, type Props } from './base44';

// Ferramentas que o Claude/ChatGPT enxergam. Cada uma vira uma ação da função
// mcpHerogran no Base44, que aplica empresa, perfil e permissões.
// V1: consultas + criar negócio + criar/abrir projeto. Nada de excluir,
// marcar ganho/perdido, preço/desconto, usuários ou configurações.

interface Ferramenta {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean | string>;
  acao: string;
}

const data = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const leitura = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const criacao = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export const FERRAMENTAS: Ferramenta[] = [
  {
    name: 'minha_conta',
    title: 'Minha conta HEROGRAN',
    description: 'Mostra quem está conectado: usuário, perfil de acesso, marmoraria e o que esse perfil pode criar.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...leitura, title: 'Minha conta HEROGRAN' },
    acao: 'sessao',
  },
  {
    name: 'resumo_negociacoes',
    title: 'Resumo das negociações',
    description:
      'Conta as negociações da marmoraria: em aberto, ganhas e perdidas, com valor total de cada grupo, taxa de conversão e abertas por etapa do funil. ' +
      'Use para perguntas como "quantas negociações tenho em aberto?" ou "quantas ganhei este mês?". O período filtra pela data de criação da negociação.',
    inputSchema: {
      type: 'object',
      properties: {
        de: { ...data, description: 'Início do período (AAAA-MM-DD), opcional' },
        ate: { ...data, description: 'Fim do período (AAAA-MM-DD), opcional' },
        responsavel: { type: 'string', description: 'Nickname do vendedor responsável, opcional' },
      },
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Resumo das negociações' },
    acao: 'resumo_negociacoes',
  },
  {
    name: 'listar_negociacoes',
    title: 'Listar negociações',
    description:
      'Lista negociações com cliente, valor, etapa, situação (aberto/ganho/perdido) e responsável, das mais novas para as mais antigas. ' +
      'Filtra por situação, texto (título ou cliente), etapa, responsável e período.',
    inputSchema: {
      type: 'object',
      properties: {
        situacao: { type: 'string', enum: ['aberto', 'ganho', 'perdido'] },
        busca: { type: 'string', description: 'Trecho do título ou do nome do cliente' },
        etapa: { type: 'string', description: 'Nome exato da etapa do funil' },
        responsavel: { type: 'string', description: 'Nickname do vendedor' },
        de: { ...data, description: 'Criadas a partir de (AAAA-MM-DD)' },
        ate: { ...data, description: 'Criadas até (AAAA-MM-DD)' },
        limite: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Listar negociações' },
    acao: 'listar_negociacoes',
  },
  {
    name: 'detalhar_negociacao',
    title: 'Detalhar negociação',
    description:
      'Mostra uma negociação completa: contato do cliente, descrição, observações, resumo do orçamento (ambientes e peças), ' +
      'projetos do HEROCAD e da Prancheta ligados a ela, e os links para abrir a negociação, o projeto 3D (CAD3D) e baixar o PDF do orçamento.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id da negociação (vem de listar_negociacoes)' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Detalhar negociação' },
    acao: 'detalhar_negociacao',
  },
  {
    name: 'link_pdf_orcamento',
    title: 'Baixar PDF do orçamento',
    description:
      'Devolve o link da negociação no HEROGRAN, onde fica o botão que gera e baixa o PDF do orçamento. ' +
      'O PDF é gerado no navegador, então entregue o link ao usuário em vez de tentar anexar um arquivo.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id da negociação' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Baixar PDF do orçamento' },
    acao: 'detalhar_negociacao',
  },
  {
    name: 'criar_negocio',
    title: 'Criar negócio',
    description:
      'Cria uma negociação nova na primeira etapa do funil ativo, com o usuário conectado como responsável. ' +
      'Confirme os dados com o usuário antes de criar. Devolve o link da negociação e o link para montar o projeto 3D (CAD3D).',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Ex.: "Cozinha - Ap. 302"' },
        cliente: { type: 'string', description: 'Nome do cliente' },
        telefone: { type: 'string' },
        email: { type: 'string' },
        valor: { type: 'number', description: 'Valor estimado em R$' },
        descricao: { type: 'string', description: 'Material e serviço' },
        categoria: { type: 'string', description: 'Tipo de trabalho' },
        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'] },
        prazo: { ...data, description: 'Data prevista (AAAA-MM-DD)' },
        observacoes: { type: 'string' },
      },
      required: ['titulo', 'cliente'],
      additionalProperties: false,
    },
    annotations: { ...criacao, title: 'Criar negócio' },
    acao: 'criar_negocio',
  },
  {
    name: 'criar_projeto_prancheta',
    title: 'Criar projeto na Prancheta Digital',
    description:
      'Cria um projeto em branco na Prancheta Digital, ligado a uma negociação (opcional), e devolve o link para desenhar. Confirme com o usuário antes.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'Id da negociação, opcional' },
        nome: { type: 'string', description: 'Nome do projeto (padrão: título da negociação)' },
      },
      additionalProperties: false,
    },
    annotations: { ...criacao, title: 'Criar projeto na Prancheta Digital' },
    acao: 'criar_projeto_prancheta',
  },
  {
    name: 'abrir_herocad',
    title: 'Novo desenho no HEROCAD',
    description:
      'Gera o link que abre um desenho novo no HEROCAD já com o nome e a negociação ligados. ' +
      'O projeto é gravado quando o usuário desenha e salva no HEROCAD; nada é criado antes disso.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'Id da negociação' },
        nome: { type: 'string', description: 'Nome do desenho (padrão: título da negociação)' },
      },
      required: ['negocio_id'],
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Novo desenho no HEROCAD' },
    acao: 'link_herocad',
  },
  {
    name: 'abrir_cad3d',
    title: 'Abrir projeto 3D (CAD3D)',
    description: 'Devolve o link que abre o projeto 3D (CAD3D) do orçamento de uma negociação, para criar ou editar as peças.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id da negociação' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Abrir projeto 3D (CAD3D)' },
    acao: 'detalhar_negociacao',
  },
];

/** Troca caminhos relativos ("/negocio/123") por links completos do app, em qualquer profundidade */
function linksAbsolutos(valor: unknown, base: string, emLink = false): unknown {
  if (typeof valor === 'string') return emLink && valor.startsWith('/') && !valor.startsWith('//') ? base + valor : valor;
  if (Array.isArray(valor)) return valor.map((v) => linksAbsolutos(v, base, emLink));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, linksAbsolutos(v, base, emLink || k.startsWith('link'))]),
    );
  }
  return valor;
}

export async function executarFerramenta(env: Env, props: Props, nome: string, args: Record<string, unknown>) {
  const f = FERRAMENTAS.find((x) => x.name === nome);
  if (!f) throw new Error(`Ferramenta desconhecida: ${nome}`);
  const base = env.APP_URL.replace(/\/$/, '');
  const r = linksAbsolutos(await acaoMcp(env, props, f.acao, args), base) as any;

  // Ferramentas que reaproveitam detalhar_negociacao devolvem só o que interessa
  if (nome === 'link_pdf_orcamento') {
    return {
      negociacao: r.titulo,
      cliente: r.cliente,
      tem_orcamento: r.projeto_orcamento?.tem_projeto ?? false,
      link: r.links?.pdf_orcamento,
      como_baixar: 'Abra o link e use o botão do PDF do orçamento na tela da negociação.',
    };
  }
  if (nome === 'abrir_cad3d') {
    return { negociacao: r.titulo, cliente: r.cliente, projeto: r.projeto_orcamento, link: r.links?.projeto_cad3d };
  }
  return r;
}
