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
| OAuth no Quick | Não implementar; documentado como pendência | Caminho: `withMcpAuth` / Supabase Auth |

## Bloqueios

Nenhum bloqueio que tenha impedido o resto. Embeddings semânticos ficam off até existir `OPENAI_API_KEY` (FTS cobre a entrega).

## Pendências do João

- Colar `OPENAI_API_KEY` na Vercel se quiser busca vetorial (sem ela, só FTS).
- Copiar o token de `docs/.mcp-token-amazon-quick.local` para o Amazon Quick.
- Site URL do Auth: `https://jaypcortex.vercel.app` (já era).
- Opcional: desligar `disable_signup` no painel Auth (já bloqueado por trigger).

## Como testar

Ver `docs/mcp-conexao-quick.md`.

Local já validado:

- `npm test` — 11 unitários ok
- `npx tsx scripts/smoke-search.ts` — hits nos docs de funding
- `npm run build` — limpo

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
