import { acaoMcp, type Env, type Props } from './base44';
import { gerarPdfOrcamento, brl, type ResultadoPdf } from './pdf';

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
    name: 'gerar_pdf_orcamento',
    title: 'Gerar PDF e valor do orçamento',
    description:
      'Calcula o orçamento da negociação com a tabela da marmoraria, grava o valor na negociação e gera o PDF oficial do HEROGRAN ' +
      '(o mesmo do botão). Devolve o valor total e o link do PDF para baixar. Leva de 15 a 50 segundos. ' +
      'Já roda sozinho depois de adicionar_pecas_orcamento; use para gerar de novo ou para orçamentos montados no sistema.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id da negociação' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { ...criacao, idempotentHint: true, title: 'Gerar PDF e valor do orçamento' },
    acao: 'gerar_pdf',
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
  {
    name: 'listar_materiais',
    title: 'Listar materiais',
    description:
      'Lista os materiais (granitos, mármores, quartzitos...) cadastrados na marmoraria. ' +
      'Use antes de adicionar peças ao orçamento: o material da peça precisa ser um destes nomes, escrito exatamente igual.',
    inputSchema: {
      type: 'object',
      properties: { busca: { type: 'string', description: 'Trecho do nome ou do tipo, opcional (ex.: "branco", "quartzito")' } },
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Listar materiais' },
    acao: 'listar_materiais',
  },
  {
    name: 'listar_acabamentos',
    title: 'Listar acabamentos',
    description:
      'Lista os acabamentos de borda (reto, bisotado, boleado, meia cana, compostos e os personalizados da marmoraria). ' +
      'Use o id em saia.acabamento ou frontao.acabamento ao adicionar peças. O preço vem da tabela da marmoraria.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...leitura, title: 'Listar acabamentos' },
    acao: 'listar_acabamentos',
  },
  {
    name: 'ver_orcamento',
    title: 'Ver orçamento (CAD3D)',
    description: 'Mostra os orçamentos de uma negociação, com os ambientes e as peças já lançadas no projeto 3D (CAD3D).',
    inputSchema: {
      type: 'object',
      properties: { negocio_id: { type: 'string', description: 'Id da negociação' } },
      required: ['negocio_id'],
      additionalProperties: false,
    },
    annotations: { ...leitura, title: 'Ver orçamento (CAD3D)' },
    acao: 'ver_orcamento',
  },
  {
    name: 'adicionar_pecas_orcamento',
    title: 'Adicionar peças ao orçamento (CAD3D)',
    description:
      'Lança peças no orçamento 3D (CAD3D) de uma negociação, no mesmo formato do editor do HEROGRAN. ' +
      'Pergunte SÓ o que faltar, uma coisa de cada vez, seguindo as etapas do CAD3D para o tipo da peça: ' +
      'todos: tipo, medidas (largura e profundidade; no nicho, largura e altura), quantidade e material. ' +
      'Bancada, Cooktop, Ilha, Pia, Lavatório e Tanque: frontão (altura e lados) e saia (montagem 45/topo/engrossado/simples, altura, lados e acabamento da borda); ' +
      'pé (fechado, aberto ou com vira) só se a saia for 45. Pia e Tanque: guarnição. ' +
      'Lavatório: tipo da cuba. Pia e Tanque NÃO têm escolha de cuba (sempre embutida): nunca pergunte cuba para eles. ' +
      'Nicho: profundidade e moldura. Soleira, Peitoril, Filete e Outro: só medidas, quantidade e material. ' +
      'Não pergunte o que o usuário já disse. Se ele não falar o acabamento da borda, use reto sem perguntar. ' +
      'Material: use listar_materiais; se houver mais de um nome parecido (ex.: "Verde Ubatuba" e "Verde Ubatuba 2"), use o nome idêntico ao que o usuário falou, e só pergunte se nenhum for idêntico. ' +
      'Medidas sempre em centímetros: converta se o usuário falar em metros ou milímetros. ' +
      'Antes de gravar, mostre um resumo curto e peça confirmação. ' +
      'Depois de gravar, o HEROGRAN calcula sozinho: a resposta já traz o valor total e o link do PDF oficial. Entregue os dois ao usuário.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'Id da negociação' },
        ambiente: { type: 'string', description: 'Nome do ambiente; se não existir, é criado' },
        orcamento: { type: 'string', description: 'Nome do orçamento, opcional (padrão: o orçamento ativo; um nome novo cria outro orçamento)' },
        pecas: {
          type: 'array',
          minItems: 1,
          maxItems: 30,
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['Pia', 'Lavatório', 'Tanque', 'Nicho', 'Bancada', 'Cooktop', 'Ilha', 'Peitoril', 'Soleira', 'Filete', 'Outro'] },
              nome: { type: 'string', description: 'Opcional; padrão: o tipo' },
              largura_cm: { type: 'number', exclusiveMinimum: 0 },
              profundidade_cm: { type: 'number', exclusiveMinimum: 0, description: 'Profundidade da peça (no nicho: a altura)' },
              quantidade: { type: 'integer', minimum: 1, default: 1 },
              material: { type: 'string', description: 'Nome exato de listar_materiais' },
              frontao: {
                type: 'object',
                properties: {
                  altura_cm: { type: 'number', minimum: 0 },
                  lados: { type: 'array', items: { type: 'string', enum: ['atras', 'esquerda', 'direita'] } },
                  acabamento: { type: 'string', description: 'Id do acabamento (de listar_acabamentos), opcional' },
                },
                additionalProperties: false,
              },
              saia: {
                type: 'object',
                properties: {
                  montagem: {
                    type: 'string',
                    enum: ['45', 'topo', 'engrossado', 'simples'],
                    description: '45 = saia em 45 graus (padrão); topo = saia de topo, sobe acima do tampo; engrossado = peça reta colada embaixo (use guarnicao.largura_cm); simples = tampo cru, sem saia',
                  },
                  altura_cm: { type: 'number', minimum: 0 },
                  lados: { type: 'array', items: { type: 'string', enum: ['frente', 'esquerda', 'direita'] } },
                  acabamento: { type: 'string', description: 'Id do acabamento da borda (de listar_acabamentos), ex.: reto, bisotado, boleado, meia_cana' },
                  transpasse_cm: { type: 'number', minimum: 0, description: 'Só na montagem topo: quanto a saia sobe acima do tampo (padrão 2)' },
                },
                additionalProperties: false,
              },
              guarnicao: {
                type: 'object',
                description: 'Só em Pia e Tanque (ou na saia engrossada)',
                properties: {
                  largura_cm: { type: 'number', minimum: 0 },
                  lados: { type: 'array', items: { type: 'string', enum: ['frente', 'esquerda', 'direita'] } },
                },
                additionalProperties: false,
              },
              cuba: {
                type: 'object',
                description: 'Só no Lavatório (pia e tanque ficam sempre com cuba embutida; não pergunte)',
                properties: {
                  tipo: {
                    type: 'string',
                    enum: ['embitida', 'sobresposta', 'semi-encaixada', 'esculpida-reta', 'esculpida-reta-bandeja', 'esculpida-rampa', 'esculpida-rampa-bandeja'],
                    description: 'embitida = embutida (padrão); esculpida-* só em lavatório',
                  },
                  largura_cm: { type: 'number', minimum: 0 },
                  profundidade_cm: { type: 'number', minimum: 0 },
                },
                additionalProperties: false,
              },
              pe: {
                type: 'object',
                description: 'Pé da bancada. Só em Pia, Tanque, Lavatório, Bancada, Cooktop e Ilha, com saia em 45 graus',
                properties: {
                  tipo: { type: 'string', enum: ['fechado', 'aberto', 'vira'], description: 'fechado, aberto ou vira (pé com vira)' },
                  altura_cm: { type: 'number', minimum: 0, description: 'Altura do pé (padrão 75)' },
                  lados: { type: 'array', minItems: 1, items: { type: 'string', enum: ['esquerda', 'frente', 'direita'] } },
                  vira_cm: { type: 'number', minimum: 0, description: 'Só no pé com vira: tamanho da vira (padrão 5)' },
                  abas: { type: 'boolean', description: 'Pé aberto/vira com abas laterais (padrão sim)' },
                },
                required: ['tipo', 'lados'],
                additionalProperties: false,
              },
              nicho: {
                type: 'object',
                description: 'Só para Nicho',
                properties: { profundidade_cm: { type: 'number', minimum: 0 }, moldura_cm: { type: 'number', minimum: 0 } },
                additionalProperties: false,
              },
            },
            required: ['tipo', 'largura_cm', 'profundidade_cm', 'material'],
            additionalProperties: false,
          },
        },
      },
      required: ['negocio_id', 'ambiente', 'pecas'],
      additionalProperties: false,
    },
    annotations: { ...criacao, title: 'Adicionar peças ao orçamento (CAD3D)' },
    acao: 'adicionar_pecas_orcamento',
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

function resumoPdf(p: ResultadoPdf) {
  if (!p.ok) return { pdf_gerado: false, motivo: p.erro };
  return {
    pdf_gerado: true,
    valor_total: brl(p.total),
    pdf: p.pdf_url,
    orcamento_no_pdf: p.orcamento_no_pdf,
    valor_do_orcamento_no_pdf: brl(p.total_orcamento_no_pdf),
    ...(p.orcamentos && p.orcamentos.length > 1 ? { orcamentos: p.orcamentos.map((o) => ({ nome: o.nome, valor: brl(o.total) })) } : {}),
  };
}

export async function executarFerramenta(env: Env, props: Props, nome: string, args: Record<string, unknown>) {
  const f = FERRAMENTAS.find((x) => x.name === nome);
  if (!f) throw new Error(`Ferramenta desconhecida: ${nome}`);
  const base = env.APP_URL.replace(/\/$/, '');

  // PDF + valor pelo próprio HEROGRAN (navegador na nuvem)
  if (f.acao === 'gerar_pdf') {
    const id = String(args.id || '');
    const d = linksAbsolutos(await acaoMcp(env, props, 'detalhar_negociacao', { id }), base) as any; // confere empresa e acesso
    const p = await gerarPdfOrcamento(env, props, id);
    return { negociacao: d.titulo, cliente: d.cliente, ...resumoPdf(p), link_negociacao: d.links?.negociacao };
  }

  const r = linksAbsolutos(await acaoMcp(env, props, f.acao, args), base) as any;

  // Tudo automático: depois de lançar as peças, já calcula, grava o valor e gera o PDF
  if (nome === 'adicionar_pecas_orcamento' && r?.success) {
    const p = await gerarPdfOrcamento(env, props, String(args.negocio_id || ''));
    const { aviso, ...resto } = r;
    return { ...resto, ...resumoPdf(p), ...(p.ok ? {} : { aviso }) };
  }

  // Ferramentas que reaproveitam detalhar_negociacao devolvem só o que interessa
  if (nome === 'abrir_cad3d') {
    return { negociacao: r.titulo, cliente: r.cliente, projeto: r.projeto_orcamento, link: r.links?.projeto_cad3d };
  }
  return r;
}
