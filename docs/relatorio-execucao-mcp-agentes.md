# Relatório de execução — MCP + Agentes + MAP

> Início: 7 nov 2026. Fim: 7 nov 2026. Executor: Cursor. Plano: `docs/plano-mcp-agentes.md`.

## Status

Checklist §14 completo (E0–E12). Build limpo. Token `amazon-quick` gerado (não versionado). Agente `migracao-aws` seedado (6 camadas, 17 vínculos, prompt v1). Busca FTS local: query “como maximizar funding do MAP” retornou os docs 5 e 6.

## Decisões tomadas sem confirmação

| O que faltava | Escolha | Como reverter |
|---|---|---|
| `mcp-handler` vs SDK puro no Next 16 | `mcp-handler` 2 + `@modelcontextprotocol/server` v2; URL canônica `/api/mcp` (alias `/api/mcp/mcp`) | Trocar o handler em `app/api/mcp/[transport]/route.ts` |
| Embeddings sem `OPENAI_API_KEY` | FTS only, `indexStatus=skipped`; chunks mesmo assim gravados para FTS | Colar a chave na Vercel/`.env.local` e `npm run kb:reindex` |
| Pasta Prompt em agentes já existentes | Criar se faltar; não apagar pastas atuais | Remover a pasta vazia `Prompt` |
| Largura do painel do agente | Drawer `wide` (~520px) com abas; cartão 3D permanece | Voltar `AgentStudio` para o `KnowledgePanel` antigo |
| Testes | `node --import tsx --test` (sem Vitest) | Trocar o runner depois |
| Markdown → TipTap no servidor | `@tiptap/html/server` + `happy-dom` | — |
| Token bootstrap | `MCP_BOOTSTRAP_TOKEN` opcional; comparação por hash | Não definir a env |
| Escritório cheio no seed | Se `createAgentWithRoom` falhar, cria agente sem mesa | Apagar o agente `migracao-aws` (não apaga o resto do banco) |
| OAuth no Quick | **Feito depois:** `client_credentials` (não authorization_code). Token 3600s, hash no banco. Basic + form + JSON. | Desligar rotas `/api/mcp/oauth` e `/.well-known`; Bearer estático continua |
| Actor das writes OAuth | Profile admin (`ADMIN_EMAIL`); `tokenId` vazio (não FK em `McpToken`) | — |
| Prefixo do access token | `jpc_at_` para distinguir do estático `jpc_` | Trocar gerador |
| Issuer OAuth | `https://jaypcortex.vercel.app` (`MCP_PUBLIC_ORIGIN` opcional) | Env |
| RFC 9728 extra | Também publiquei `/.well-known/oauth-protected-resource` (Quick/MCP clients costumam pedir) | Apagar a rota |
| UI de clientes OAuth | Não nesta rodada; só script `npm run mcp:oauth-client` | Tela depois, espelhando Tokens MCP |
| Secret se o `.local` sumir | Rotaciona o hash e regrava o arquivo (senão o João não conecta) | `--rotate` explícito |

## Bloqueios

Nenhum bloqueio que tenha impedido o resto. Embeddings semânticos ficam off até existir `OPENAI_API_KEY` (FTS cobre a entrega).

## Pendências do João

- Colar `OPENAI_API_KEY` na Vercel se quiser busca vetorial (sem ela, só FTS).
- Colar no Amazon Quick (OAuth serviço a serviço) os três campos de `docs/.mcp-oauth-amazon-quick.local`: `client_id`, `client_secret`, `token_url`. URL MCP = `mcp_url`.
- Site URL do Auth: `https://jaypcortex.vercel.app` (já era).
- Opcional: desligar `disable_signup` no painel Auth (já bloqueado por trigger).

## Como testar

Ver `docs/mcp-conexao-quick.md`.

Local já validado:

- `npm test` — 19 unitários ok (inclui parse OAuth)
- `npx tsx scripts/smoke-search.ts` — hits nos docs 5 e 6 de funding
- `npm run build` — limpo

Produção (`https://jaypcortex.vercel.app`, deploy Ready `jaypcortex-qy5ahcif6`, commit `283a3a9`):

- GET `/.well-known/oauth-authorization-server` → `token_endpoint` + `grant_types_supported: client_credentials`
- POST `/api/mcp` sem token → 401 + `WWW-Authenticate: Bearer`
- POST `/api/mcp/oauth/token` (form, JSON e Basic) → `{ token_type: Bearer, expires_in: 3600, scope: "read propose write" }`, prefixo `jpc_at_`
- Com access token: `initialize` → `jaypcortex`; `tools/list` → 23 tools; `list_agents` → `migracao-aws` active (18 docs, prompt v1)

Smoke anterior (Bearer estático `jpc_…`, deploy `jaypcortex-9nr4lcwkl`) continua válido: initialize, search, propose+apply.

## Log de etapas

- E0 — leitura do contexto, schema, FileEditor, rotas; este arquivo criado.
- E1 — migration `20261107120000_mcp_knowledge` aplicada no Supabase (pgvector, FTS, tabelas, RLS, views, `match_knowledge`).
- E2 — `lib/knowledge/*`, indexação no PATCH do arquivo, `npm run kb:reindex`.
- E3 — `search_knowledge` + `/api/knowledge/search`.
- E4 — camadas, composer, versões, rotas `/api/agents/:id/prompt*`.
- E5 — propostas, diff, revisões, apply/reject.
- E6 — `McpToken`, AuditLog, UI em Configurações.
- E7 — `/api/mcp` Streamable HTTP, tools leitura/proposta/escrita, Bearer, rate limit, `scripts/mcp-stdio.ts`.
- E8 — AgentStudio (abas), FileMetaBar, tokens MCP, base continua “Novo arquivo”.
- E9 — seed `migracao-aws` (fontes do Mac condensadas, origem citada).
- E10 — testes + build limpo.
- E11 — commits, push `main`, token amazon-quick, teste MCP produção.
- E12 — `contexto-plataforma.md`, `mcp-conexao-quick.md`, este relatório.
- OAuth (7 nov 2026, depois do E12) — tabelas `McpOAuthClient`/`McpOAuthAccessToken` (RLS admin), `POST /api/mcp/oauth/token`, `/.well-known/oauth-authorization-server`, MCP aceita `jpc_…` ou `jpc_at_…`, cliente `amazon-quick` em `docs/.mcp-oauth-amazon-quick.local`.
