# Conectar o Amazon Quick (e o Cursor) no MCP da JayP Cortex

URL de produção: **`https://jaypcortex.vercel.app/api/mcp`**  
Alias (clientes que esperam `/mcp` no fim): `https://jaypcortex.vercel.app/api/mcp/mcp`

Auth: header `Authorization: Bearer <token>`. Sem cookie de login. Sem OAuth (pendência explícita; não bloqueia).

## 1. Gerar o token

Na UI: **Configurações → Tokens MCP** (só admin). Nome, escopos `read` + `propose` + `write`. O valor em claro aparece **uma vez**.

Pelo script (já usado para o token `amazon-quick`):

```bash
npm run mcp:token
```

O valor fica só em `docs/.mcp-token-amazon-quick.local` (gitignored). Não commitar.

Rotacionar: `npx tsx scripts/create-mcp-token.ts --rotate`

## 2. Amazon Quick

Tipo: **MCP**. URL acima. Auth **API key / Bearer**.

Fluxo esperado:

1. `list_agents` → achar `migracao-aws`
2. `search_knowledge` (`query`, `agent=migracao-aws`)
3. `read_document`
4. `propose_document_change` (mostra o diff; não grava ainda)
5. Com confirmação: `apply_proposal`
6. Se for prompt: `publish_prompt`

## 3. Cursor / Claude Desktop (stdio)

```bash
MCP_URL=https://jaypcortex.vercel.app/api/mcp MCP_TOKEN=jpc_... npx tsx scripts/mcp-stdio.ts
```

Ou `npx mcp-remote https://jaypcortex.vercel.app/api/mcp --header "Authorization: Bearer jpc_..."`

Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Apontar para a URL de produção (ou `http://localhost:3000/api/mcp` no `next dev`).

## 4. Escopos

| Escopo | Tools |
|---|---|
| `read` | list/get agents, documents, search, proposals, history |
| `propose` | propose_* |
| `write` | apply/reject, create/update document, publish_prompt, link/unlink, create_agent, reindex |
| `admin` | todos |

Rate limit: 60 req/min por token (memória do processo Vercel).

## 5. O que o MCP **não** faz

- Não grava Markdown no banco (converte para TipTap `type: "doc"`).
- Não abre signup, não apaga `dev.db`, não cria Edge Function.
- Sem `OPENAI_API_KEY`: busca só FTS (`indexStatus=skipped`).
