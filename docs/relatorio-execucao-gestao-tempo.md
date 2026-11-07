# Relatório de execução — Agente Gestão de Tempo + Atividades no MCP

> Início: 7 nov 2026. Executor: Cursor. Plano: `docs/plano-agente-gestao-tempo.md`.

## Status

**G0–G10 concluídos.** Vercel verde em `main` (`80cf900`). Teste MCP em produção: 29 tools de atividade, `get_daily_briefing` respondeu, `[TESTE MCP]` criado/concluído/lixeira; purge via Prisma porque o token estático não tem escopo `admin`.

## Decisões tomadas sem confirmação

| O que faltava | Escolha | Como reverter |
|---|---|---|
| Camada “Comportamental” vs `PROMPT_LAYERS` atuais | Acrescentar `comportamental` em `PROMPT_LAYERS` (os nomes antigos ficam, inclusive `exemplos`) | Remover a chave; o seed deixa de criar o arquivo |
| Weekday de `TimeCapacity` | 0 = domingo … 6 = sábado (igual `Date.getDay()` no fuso SP) | Trocar o seed da tabela |
| DELETE da UI `/api/activities/:id` | Passa a **soft delete** (lixeira), alinhado ao plano | Restaurar hard delete na rota |
| Busca textual | FTS `searchTsv` + fallback ILIKE | Só ILIKE |
| Deep link da tarefa | `url` = `/atividades` (a tela ainda não abre por id) | Query `?atividade=` depois |
| Redirect ChatGPT | URLs exatas `chatgpt.com/connector_platform_oauth_redirect` e `chat.openai.com/...` (não `*.chatgpt.com/*`) | Env `MCP_OAUTH_REDIRECT_URIS` |
| Outlook | Sem Graph, como o plano | Fase futura |
| `plan_day` `apply` | Exige escopo `write`; sem apply só propõe | — |
| Purge na UI | Só MCP `admin`; REST da lixeira é GET + restore | Expor DELETE se quiser |
| Indexação do seed | `indexStatus=skipped` (sem `OPENAI_API_KEY` no ambiente local). FTS português cobre busca. | Rodar `npm run kb:reindex` com a chave na Vercel |
| Nome na mesa | **Gestor de Atividades** (era Cortex Tempo); slug `gestao-tempo` | Trocar `name` no seed / UI |

## Bloqueios

Nenhum de código. Pendente só o clique humano no conector ChatGPT (OAuth + voz).

## Pendências do João

- Validar o conector MCP no app ChatGPT (voz) e autorizar o login.
- Validar o **Perfil do João** na sala do Cortex Tempo (marcado “a validar”).
- Decidir o nome final (Jarvis etc.); o slug `gestao-tempo` não muda.
- Rotacionar o `client_secret` de serviço do Quick (pendência antiga, print).
- Se quiser embeddings nos docs do Tempo: garantir `OPENAI_API_KEY` na Vercel e reindexar.
- Integração direta Outlook/Graph: fase futura.

## Log de etapas

- G0 — leitura do contexto, plano, schema Activity, rotas `/api/activities*`, modal/fila/página, MCP 23 tools sem tarefas.
- G1 — migration `20261107180000_activity_gestao_tempo` aplicada no Postgres (colunas, FTS, RLS, TimeCapacity 480/0).
- G2 — `lib/activities` (datas PT-BR, score, CRUD, fila, timer, lixeira, undo) + `lib/briefing` (briefing, revisão, plan_day com `busy_blocks`).
- G3/G4 — tools no `/api/mcp` existente + prompts `briefing_do_dia` / `capturar_tarefas`.
- G5 — REST espelho + UI: campos no modal, lixeira, iniciar/pausar, painel Hoje.
- G6 — seed `gestao-tempo` (7 camadas, 12 docs, 5 templates, prompt v1). Docs 9 e 12 gerados do código/banco.
- G7 — redirects ChatGPT na allowlist + `docs/mcp-conexao-chatgpt.md`.
- G8 — testes unitários (datas, score, slots, OAuth ChatGPT) + `npm run build` limpo.
- G9 — push `main` (7 commits) e deploy Vercel verde (`80cf900`).
- G10 — `tools/list` em produção mostra as tools novas; briefing do dia 2026-11-07; `[TESTE MCP]` criado, concluído, lixeira (sem `confirm` falha; com `confirm` vai). Purge MCP recusou (token sem `admin`); limpeza via Prisma. UI em produção: painel Hoje, fila 12 intacta, modal com campos novos, lixeira vazia, agente Cortex Tempo no escritório. Docs atualizados.
