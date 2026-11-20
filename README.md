# HEROGRAN MCP

Conector que deixa o cliente usar o HEROGRAN pelo Claude e pelo ChatGPT.

- **Este Worker** (Cloudflare): tela de login + OAuth + endpoint MCP (`/mcp`).
- **Função `mcpHerogran`** (no app HEROGRAN do Base44): toda a regra de negócio.
  Empresa e perfil vêm do token do HEROGRAN, e as permissões seguem `base44/shared/perfis.ts`.

O login usa o `heroLogin` do próprio app (identificador da empresa + usuário + senha).
O token do HEROGRAN fica cifrado no grant do OAuth e vale 7 dias. Depois disso, o usuário conecta de novo.

## Ferramentas (V1)

| Ferramenta | Faz |
|---|---|
| `minha_conta` | Usuário, perfil, empresa e o que pode criar |
| `resumo_negociacoes` | Em aberto / ganhas / perdidas, valores, conversão e abertas por etapa |
| `listar_negociacoes` | Lista com filtros (situação, busca, etapa, responsável, período) |
| `detalhar_negociacao` | Negociação completa + projetos ligados + links |
| `link_pdf_orcamento` | Link da negociação, onde fica o botão do PDF (gerado no navegador) |
| `criar_negocio` | Cria na 1ª etapa do funil ativo (Administrador e Comercial) |
| `criar_projeto_prancheta` | Projeto em branco na Prancheta Digital (Administrador, Comercial e Produção) |
| `abrir_herocad` | Link de desenho novo no HEROCAD já ligado à negociação |
| `abrir_cad3d` | Link do projeto 3D do orçamento da negociação |

Fora de propósito: excluir, marcar ganho/perdido, preço/desconto, usuários e configurações.

## Publicar (pelo navegador)

1. dash.cloudflare.com → Workers & Pages → Create → Import a repository
2. Repositório `herogran-sistema-para-marmoraria-com-orcamento-3d-e-crm`, branch `herogran-mcp`
3. Comando de deploy: `npx wrangler deploy` → Deploy

O KV (`herogran-mcp-OAUTH_KV`) já existe e está no `wrangler.jsonc`. A URL do Worker é detectada sozinha
(`PUBLIC_URL` só é necessária para forçar um domínio). `APP_URL` é o domínio do app (https://app.herograncrm.com.br):
as funções são chamadas por ele e os links devolvidos apontam pra ele.

## Conectar

- **Claude:** Configurações → Conectores → Adicionar conector personalizado → `https://SEU-WORKER/mcp`
- **ChatGPT:** Conectores/Apps (modo desenvolvedor) → criar → `https://SEU-WORKER/mcp`, autenticação OAuth

## Desenvolvimento

```bash
npx wrangler dev
npm run typecheck
```
