# Conectar o Amazon Quick (e o Cursor) no MCP da JayP Cortex

URL de produção: **`https://jaypcortex.vercel.app/api/mcp`**  
Alias (clientes que esperam `/mcp` no fim): `https://jaypcortex.vercel.app/api/mcp/mcp`

O MCP aceita **dois** modos de Bearer:

1. **OAuth 2.0 client_credentials** (o que o Amazon Quick pede: ID do cliente, segredo, URL do token)
2. Token estático `jpc_…` (`McpToken`) — Cursor, scripts, fallback

Sem token: **401** com `WWW-Authenticate: Bearer`. Sem cookie de login.

## 1. Amazon Quick (OAuth serviço a serviço)

Campos do conector MCP no Quick:

| Campo | Valor |
|---|---|
| URL MCP | `https://jaypcortex.vercel.app/api/mcp` |
| ID do cliente | `client_id` em `docs/.mcp-oauth-amazon-quick.local` |
| Segredo do cliente | `client_secret` no mesmo arquivo |
| URL do token | `https://jaypcortex.vercel.app/api/mcp/oauth/token` |

Discovery: `https://jaypcortex.vercel.app/.well-known/oauth-authorization-server`  
(`grant_types_supported`: `client_credentials`; `token_endpoint` aponta para a URL acima.)

O arquivo local (gitignored) é gerado com:

```bash
npm run mcp:oauth-client
```

Rotacionar o secret (invalida access tokens antigos; o `client_id` permanece):

```bash
npx tsx scripts/create-mcp-oauth-client.ts --rotate
```

Não commitar o `.local`. O banco guarda só hash do secret e do access token.

O token endpoint aceita `grant_type=client_credentials` com credenciais em **HTTP Basic** ou no corpo (`application/x-www-form-urlencoded` **ou** JSON). Resposta:

```json
{
  "access_token": "jpc_at_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read propose write"
}
```

O Quick usa esse `access_token` em `Authorization: Bearer` nas chamadas MCP. Expira em 1 hora; o Quick pede outro sozinho.

Fluxo esperado depois de conectar:

1. `list_agents` → achar `migracao-aws`
2. `search_knowledge` (`query`, `agent=migracao-aws`)
3. `read_document`
4. `propose_document_change` (mostra o diff; não grava ainda)
5. Com confirmação: `apply_proposal`
6. Se for prompt: `publish_prompt`

## 2. Token estático (Cursor / scripts)

Na UI: **Configurações → Tokens MCP** (só admin). Nome, escopos `read` + `propose` + `write`. O valor em claro aparece **uma vez**.

Pelo script (token `amazon-quick`):

```bash
npm run mcp:token
```

O valor fica só em `docs/.mcp-token-amazon-quick.local` (gitignored).

Rotacionar: `npx tsx scripts/create-mcp-token.ts --rotate`

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
- Sem `ask_agent` / chat com LLM no servidor — o Quick veste o agente com `get_agent_prompt` + `search_knowledge`.
