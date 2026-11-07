# Relatório de execução — MCP + Agentes + MAP

> Início: 7 nov 2026. Executor: Cursor. Plano: `docs/plano-mcp-agentes.md`.

## Status

Em andamento. Checklist em `docs/plano-mcp-agentes.md` §14.

## Decisões tomadas sem confirmação

| O que faltava | Escolha | Como reverter |
|---|---|---|
| `mcp-handler` vs SDK puro no Next 16 | `mcp-handler` + SDK; se o build falhar, rota stateless com SDK | Trocar o handler em `app/api/mcp/[transport]/route.ts` |
| Embeddings sem `OPENAI_API_KEY` | FTS only, `indexStatus=skipped` | Colar a chave na Vercel e rodar `npm run kb:reindex` |
| Pasta Prompt em agentes já existentes | Criar a pasta se faltar; não apagar pastas atuais | Remover a pasta vazia `Prompt` |
| Largura do painel do agente | Drawer mais largo (~520px) com abas; cartão 3D permanece | Voltar `AgentStudio` para o `KnowledgePanel` antigo |
| Testes | `node --import tsx --test` em `lib/**/*.test.ts` (sem Vitest) | Trocar o runner depois |

## Bloqueios

(nenhum ainda)

## Pendências do João

- Colar `OPENAI_API_KEY` na Vercel se quiser busca semântica (sem ela, só FTS).
- Copiar o token de `docs/.mcp-token-amazon-quick.local` para o Amazon Quick.
- Site URL do Auth: `https://jaypcortex.vercel.app`.

## Como testar

Ver `docs/mcp-conexao-quick.md` (escrito na E12).

## Log de etapas

- E0 — leitura do contexto, schema, FileEditor, rotas de workspaces/agents; este arquivo criado.
