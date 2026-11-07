# Plano de execução — Cortex orquestrador (Etapa 1: roteador + pacote de contexto)

> Autor: Amazon Quick (arquiteto) · Executor: Cursor · Dono: João Paulo
> Criado: 7 nov 2026 · Status: **pronto para execução autônoma**
> Ler junto: `docs/contexto-plataforma.md`, `docs/plano-mcp-agentes.md`, `docs/plano-agente-gestao-tempo.md`, `docs/mcp-conexao-quick.md`.

## 0. Regra de ouro
1. Execute C0 → C9 numa única sessão. Não pare, não peça confirmação, não pergunte. João não estará no computador.
2. Faltou informação → opção mais segura e reversível, registrar em `docs/relatorio-execucao-cortex.md` ("Decisões tomadas sem confirmação") e seguir.
3. Erro → até 3 abordagens; senão isolar, registrar em "Bloqueios" e seguir.
4. Proibido: LLM no servidor nesta etapa, quebrar as tools MCP atuais (mesmos nomes e contratos), apagar dados, gravar direto no banco fora dos serviços, commitar segredos, Edge Function.
5. Commits por etapa, build limpo, push `main`, deploy Vercel verde, teste em produção.

## 1. Problema que estamos resolvendo
- No Quick, pedir "lista minhas atividades" ou "fala pro gestor de atividades listar" caiu na **base de conhecimento** (documentos) em vez das **atividades** (dados vivos). Causas:
  1. O conector do Quick guardou a lista antiga de tools (23, só conhecimento), de antes das tools de atividades.
  2. Não existe tool que faça um agente "agir": o cliente (Quick/GPT) é quem pensa e chama as tools. O agente da plataforma é prompt + base.
  3. Descrições das tools não deixam claro que **atividades ≠ base de conhecimento**.
  4. Erro 500 ao ler dados/documentos do agente `gestao-tempo` (17 docs).
- Objetivo: **uma porta de entrada só** — o cliente sempre chama `cortex` primeiro, recebe o pacote completo (agente certo + roupa + conhecimento + dados vivos + ações sugeridas) e executa.

## 2. Decisões pré-tomadas
| Tema | Decisão |
|---|---|
| LLM no servidor | **Não** nesta etapa. Roteamento determinístico. `ask_cortex` com LLM = fase 2 (só documentar) |
| Orquestrador | Agente `cortex` (nome "Cortex", `isOrchestrator=true`). Se já existir um agente Cortex orquestrador no escritório, **reaproveitar** (não duplicar) e só ajustar slug/prompt |
| Roteamento | intents + palavras-chave + exemplos por agente + FTS da base como desempate. Confiança < 0,5 → `mode: "esclarecer"` com 2–3 opções |
| Modos | `conhecimento` (base/metodologia), `acao` (tools de atividade etc.), `misto` (dados vivos + metodologia) |
| Fuso | `America/Sao_Paulo` |
| Ações destrutivas | Nunca executadas pelo `cortex`; ele só sugere, com `requires_confirmation: true` |

## 3. Banco (migration aditiva, postgres-only)
- `Agent.routing` jsonb default `{}`:
  ```json
  {
    "domains": ["tarefas","agenda","prioridade","procrastinacao","rotina"],
    "intents": [
      {"key":"listar_atividades","mode":"acao","examples":["lista minhas tarefas","o que tenho pra hoje"],"tools":["list_activities","get_daily_briefing"]},
      {"key":"criar_atividade","mode":"acao","examples":["cria uma tarefa","registra que preciso..."],"tools":["create_activity","create_activities_bulk"]}
    ],
    "keywords": ["tarefa","atividade","fila","prazo","agenda","prioridade","concluir","pendente"],
    "knowledge_kinds": ["metodologia","processo","referencia"],
    "allowed_tools": ["list_activities","..."],
    "default_mode": "misto"
  }
  ```
- `CortexRouteLog`: `id`, `request`, `normalized`, `agentSlug`, `mode`, `intentKey`, `confidence`, `reasons` jsonb, `candidates` jsonb, `actorId`, `source`, `latencyMs`, `createdAt`. RLS padrão. Serve para melhorar o roteamento depois.

## 4. Serviço `lib/cortex/`
- `normalize.ts`: minúsculas, sem acento, sinônimos PT (tarefa=atividade=pendência=to-do; agenda=calendário; MAP=migração=assessment).
- `router.ts` → `route(request)`: pontua cada agente ativo com `routing` (match de intent por exemplos/keywords, peso de domínio, FTS na base do agente como desempate). Retorna `agent`, `intent`, `mode`, `confidence`, `reasons[]`, `candidates[]` (top 3). Determinístico e testável.
- `context.ts` → `buildAgentContext(slug, request, opts)`:
  - `agent_prompt`: prompt composto ativo (versão publicada).
  - `knowledge`: até 6 trechos de `search_knowledge` restritos ao agente (só se `mode` ∈ conhecimento/misto), com título, headingPath, fileId e score.
  - `live_data` (por agente, via registry plugável):
    - `gestao-tempo`: `get_daily_briefing(date, busy_blocks)` resumido + `list_activities` filtrado pelo pedido (se o pedido citar "hoje/atrasadas/semana/fila/nome da tarefa", aplicar filtro; senão abertas por score, limit 15).
    - `migracao-aws`: atividades abertas ligadas ao tema (FTS no título com "MAP/assess/migração/cliente citado"), limit 10.
    - agentes sem registry: `null`.
  - `suggested_tools`: lista ordenada `{ tool, args, why, requires_confirmation }` derivada do intent (ex.: "conclui a proposta Vero" → `complete_activity { query:"proposta Vero" }`, `requires_confirmation: false` se 1 candidato; se a busca achar >1, incluir `candidates` e `requires_confirmation: true`). Ações destrutivas (`delete_activity`, purge, conclusão em massa) sempre `requires_confirmation: true`.
  - `instructions_for_client`: texto curto: "Responda como <agente> seguindo agent_prompt. Use live_data como fonte dos dados; knowledge como fonte de método. Execute suggested_tools nesta ordem. Não use search_knowledge para buscar tarefas."
- Registry `lib/cortex/live-data/*.ts` (um arquivo por agente) para novos agentes plugarem.

## 5. MCP — tools novas (mesmo `/api/mcp`, escopo `read`)
| Tool | Entrada | Saída |
|---|---|---|
| `cortex` | `request` (obrigatório), `date?`, `busy_blocks?` (da agenda do cliente), `agent_hint?` (slug), `include_knowledge?` (default true) | `{ routed_to: {slug,name,reason,confidence}, mode, intent, candidates, agent_prompt, knowledge[], live_data, suggested_tools[], instructions_for_client, route_log_id }` |
| `get_agent_context` | `agent` (slug), `request`, `date?`, `busy_blocks?` | mesmo pacote sem roteamento |
| `list_agent_tools` | `agent` | tools permitidas + quando usar cada uma |

- Descrição da `cortex` (literal, curta e forte): **"PORTA DE ENTRADA. Chame SEMPRE primeiro para qualquer pedido sobre a plataforma JayP Cortex (tarefas, agenda, prioridades, metodologia, agentes, MAP). Retorna qual agente atende, o prompt dele, conhecimento relevante, dados vivos e as tools a executar em seguida."**
- Revisar descrições existentes:
  - `search_knowledge` / `read_document` / `list_documents`: acrescentar "Só documentos da base de conhecimento. **Não contém tarefas** — para tarefas use list_activities ou cortex."
  - `list_activities`, `get_daily_briefing` etc.: acrescentar "Dados vivos de tarefas (seção Atividades)."
  - `get_agent`: "Configuração do agente. Não executa nada; para agir use cortex + tools sugeridas."
- Prompt MCP `cortex_start`: "1) chame `cortex` com o pedido (e busy_blocks se tiver agenda); 2) responda vestindo `agent_prompt`; 3) execute `suggested_tools` em ordem; 4) confirme com o usuário as que tiverem `requires_confirmation`; 5) resposta curta, pronta para voz."
- `cortex` respeita escopos: só sugere tools que o token tem; avisa se faltar escopo.

## 6. Agente Cortex (seed idempotente `scripts/seed-agent-cortex.ts`)
- Nome **Cortex**, slug `cortex`, papel "Orquestrador do escritório", `isOrchestrator=true`, sala de vidro (manter a regra atual de mesa do orquestrador).
- Camadas de prompt (TipTap `kind=prompt`):
  1. **Identidade** — chefe do escritório, conhece todos os agentes, fala curto e direto (voz).
  2. **Roteamento** — tabela agente → domínios → exemplos (gerada do `routing` real).
  3. **Regras** — sempre um agente responsável; dados vivos > base; nunca inventar tarefa/evento; confirmar destrutivo; se ambíguo, perguntar com 2–3 opções.
  4. **Formato** — 1 linha de quem atendeu (opcional), resposta, próximo passo.
- Base: doc "Mapa do escritório" (agentes, slugs, domínios, tools por agente) **gerado do banco**; doc "Como usar o Cortex" (fluxo do `cortex_start`).
- Preencher `routing` de `gestao-tempo` (todas as intents de atividade: listar, buscar, criar, criar em lote, editar, iniciar, pausar, concluir, reabrir, apagar, restaurar, fila, reagendar, lembrete, subtarefa, briefing, plano do dia, revisão semanal, procrastinação/método) e de `migracao-aws` (MAP, fases, funding, assess, proposta, templates, casos). Agentes antigos do escritório sem domínio: `routing` mínimo pelo `role`/`description`, sem tools de escrita.

## 7. Bug do erro 500
- Reproduzir `get_agent` e `list_documents` para `gestao-tempo` (e todos os agentes) em produção; ler logs da Vercel; corrigir (suspeitas: documento com `content` inválido, campo nulo novo, payload grande demais → paginar/truncar). Criar teste de regressão que chama essas tools para **todos** os agentes.

## 8. Testes
- Roteamento com ≥ 25 frases reais PT-BR (esperado slug/mode/intent), incluindo: "lista minhas tarefas de hoje", "o que eu priorizo hoje?", "cria tarefa enviar proposta Vero sexta", "conclui a tarefa do kickoff", "apaga a tarefa X", "como evito procrastinar a proposta?" (misto), "como funciona o funding do MAP?" (conhecimento, migracao-aws), "quanto tempo um assess toma da minha semana?" (misto, gestao-tempo com hint de MAP), frases ambíguas → esclarecer.
- `cortex` em produção: 5 pedidos, conferindo `routed_to`, `live_data` não vazio para tarefas e `suggested_tools` corretos. Não criar dados de teste persistentes (se criar, prefixo `[TESTE CORTEX]` e purgar via serviço com ator admin).
- Regressão: todas as tools antigas continuam com o mesmo contrato.

## 9. Ordem (não parar)
- **C0** ler docs, `lib/mcp/register-tools.ts`, `register-activity-tools.ts`, serviços; criar relatório.
- **C1** investigar e corrigir erro 500 (§7).
- **C2** migration (§3).
- **C3** `lib/cortex` normalize + router + testes de roteamento.
- **C4** context builder + live-data registry.
- **C5** tools MCP + descrições revisadas + prompt `cortex_start`.
- **C6** seed agente Cortex + routing dos agentes + docs gerados.
- **C7** UI mínima: na aba do agente, seção "Roteamento" (ver/editar `routing` como JSON validado) e no escritório um log "últimos roteamentos" do Cortex.
- **C8** testes, build, deploy, testes em produção.
- **C9** docs: `mcp-conexao-quick.md` (seção **"Após deploy com tools novas: atualizar/recriar as tools do conector no Quick"** + fluxo cortex), `mcp-conexao-chatgpt.md` (mesmo fluxo), `contexto-plataforma.md` (estado atual, §10 MCP, últimas mudanças, roadmap: Etapa 2 = agente com LLM próprio executando 1 tarefa (briefing automático do Tempo); Etapa 3 = Cortex orquestrando vários agentes com debate controlado, limites de passos/custo, propostas para ações críticas e registro de execuções), relatório final com pendências do João.

## 10. Checklist
- [x] C0 · [x] C1 · [x] C2 · [x] C3 · [x] C4 · [x] C5 · [x] C6 · [x] C7 · [x] C8 · [x] C9

## Histórico
- 7 nov 2026 — plano criado pelo Amazon Quick.
- 7 nov 2026 — C0–C9 executados. Relatório: `docs/relatorio-execucao-cortex.md`.
