# Relatório de execução — Cortex orquestrador (Etapa 1)

> Início e fim: 7 nov 2026. Executor: Cursor. Plano: `docs/plano-cortex-orquestrador.md`.

## Status

C0–C9 concluídos. Build limpo. Migration `20261107200000_cortex_routing` aplicada no Postgres. Seed do Cortex (`slug=cortex`, 4 camadas, 2 docs) e `routing` de `gestao-tempo` / `migracao-aws` gravados.

## Checklist

- [x] C0 · [x] C1 · [x] C2 · [x] C3 · [x] C4 · [x] C5 · [x] C6 · [x] C7 · [x] C8 · [x] C9

## Decisões tomadas sem confirmação

| O que faltava | Escolha | Como reverter |
|---|---|---|
| Logs da Vercel sem CLI autenticado | Reproduzi `get_agent` / `list_documents` / `get_agent_prompt` / `search_knowledge` em **todos** os 9 agentes via MCP de produção. Pelo **slug** não havia 500. A hipótese de 500 no Quick: chamada pelo **nome** (“Gestor de Atividades”) estourava `throw` → JSON-RPC error. | — |
| `get_agent` pelo nome | `resolveAgentId` também casa `name` (insensitive). Erros de leitura voltam `{error}` em vez de HTTP 500. | Remover o match por nome em `lib/knowledge/search.ts` |
| `list_documents` com agente inexistente | Antes listava **todos** os docs; agora devolve `{error: "Agente não encontrado"}`. | Voltar o `if (!agentId)` silencioso |
| Payload grande | `search_knowledge` corta trecho em 2500 chars; `read_document` em 80k com `truncated`. | Subir os limites |
| Camada “Roteamento” | Incluí `roteamento` em `PROMPT_LAYERS` (UI mostra o rótulo). | Tirar da lista; a coluna `layer` continua string livre |
| Onde mostrar o log | “Últimos roteamentos” no painel do Cortex (orquestrador), não em cada mesa | Mover o bloco |
| Agentes sem domínio | `routing` mínimo a partir de `role`/`description`, sem tools de escrita | Editar JSON na aba Roteamento |
| Confiança < 0,5 | Fórmula `0.2 + score*0.5 + gap*0.45`, com piso 0,56 se score ≥ 0,5. Tempo+MAP (carga/semana) força `gestao-tempo` misto. | Ajustar pesos em `lib/cortex/router.ts` |
| FTS como desempate | Só quando o 1º e o 2º estão a menos de 0,15 | Sempre chamar FTS (mais lento) |

## Bloqueios

Nenhum. Sem LLM no servidor. Contratos das tools antigas mantidos (nomes iguais; descrições só esclarecem tarefas ≠ base).

## Pendências do João

1. **Obrigatório para o Quick funcionar:** depois do deploy verde, **atualizar/recriar as tools do conector** no Amazon Quick. Sem isso ele continua com a lista velha (~23 de conhecimento) e ignora `cortex` / `list_activities`. Passo a passo em `docs/mcp-conexao-quick.md`.
2. Rotacionar o `client_secret` de serviço que vazou em print (pendência anterior).
3. Validar o clique no app ChatGPT (OAuth + voz) com o fluxo `cortex_start`.
4. Colocar `OPENAI_API_KEY` na Vercel se quiser embeddings (hoje vários docs ficam `indexStatus=skipped`, busca só FTS).
5. Conferir na UI: Escritório → Cortex → “Últimos roteamentos”; aba Roteamento de cada agente.

## Log de etapas

- C0 — leitura do plano, contexto, MCP, orquestrador `cortex-orchestrator` já existia (sem slug).
- C1 — regressão em 9 agentes (produção, slug) OK; endureci `get_agent`/`list_documents`/`read_document`/`search_knowledge` (nome, wrap, truncar, fallback FTS).
- C2 — `Agent.routing` jsonb + tabela `CortexRouteLog` + RLS. Migration aplicada.
- C3 — `lib/cortex` normalize + router determinístico. 26 frases PT-BR + ambígua + hint (29 testes).
- C4 — context builder + live-data `gestao-tempo` / `migracao-aws`.
- C5 — tools `cortex`, `get_agent_context`, `list_agent_tools`; descrições revisadas; prompt `cortex_start`.
- C6 — seed idempotente: Cortex 4 camadas, 2 docs, routing dos agentes.
- C7 — aba Roteamento (JSON validado) + log no painel do Cortex.
- C8 — `npm test` 68 ok; `npm run build` limpo.
- C9 — docs Quick/ChatGPT/contexto + este relatório.

## Como testar depois do deploy

```bash
npm run test:mcp-knowledge
npm run test:mcp-cortex
```

Cinco pedidos de `cortex` em produção (sem dados `[TESTE CORTEX]` persistentes): lista hoje, priorizo hoje, funding MAP, procrastinar proposta, frase ambígua.
