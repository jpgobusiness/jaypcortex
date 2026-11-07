# Plano de execução — Agente de Gestão de Tempo + Atividades no MCP

> Autor: Amazon Quick (arquiteto) · Executor: Cursor · Dono: João Paulo
> Criado: 7 nov 2026 · Status: **pronto para execução autônoma**
> Ler junto: `docs/contexto-plataforma.md` (fonte da verdade), `docs/plano-mcp-agentes.md` (padrões já entregues), `docs/mcp-conexao-quick.md`.

---

## 0. REGRA DE OURO — execução autônoma de ponta a ponta

1. Execute **todo** o plano numa única sessão (G0 → G10). Não pare entre etapas, não peça "ok", não pergunte nada. João não estará no computador.
2. Faltou informação → escolha a opção mais segura e reversível, registre em `docs/relatorio-execucao-gestao-tempo.md` ("Decisões tomadas sem confirmação": o que faltou, o que escolheu, como reverter) e siga.
3. Erro → até 3 abordagens; se não resolver, isole (flag/TODO), registre em "Bloqueios" e continue o resto.
4. **Nunca:** apagar dados existentes (atividades, fila, mapas), quebrar as rotas atuais de `/api/activities/*`, `/api/activity-statuses/*`, `/api/activity-types/*`, quebrar a UI de lista/kanban/fila/mapa, commitar segredos, abrir signup, criar Edge Function.
5. Commits pequenos por etapa. No fim: testes, `npm run build` limpo, push `main`, deploy Vercel verde, MCP testado em produção.

---

## 1. Objetivo

1. **Expor toda a gestão de atividades no MCP da plataforma** (o mesmo `/api/mcp`): criar, listar, buscar, editar, iniciar, pausar, concluir, reabrir, apagar (com lixeira), priorizar, mexer na fila, prazos, estimativas, blocos de tempo, lembretes, tipos e status.
2. **Briefing do dia/semana calculado no servidor** (prioridades, atrasadas, vencendo, alertas, carga vs. capacidade), para qualquer cliente MCP responder "qual a prioridade do dia?" de forma consistente.
3. **Criar o agente "Gestão de Tempo"** (nome provisório **Cortex Tempo**, slug `gestao-tempo`; o nome final — ex. Jarvis — o João decide depois) com prompt em camadas e base de conhecimento de especialista.
4. **Preparar o caminho por voz**: o mesmo MCP deve poder ser conectado pelo ChatGPT (app de voz) além do Amazon Quick, com o mesmo OAuth de usuário, sem duplicar tarefas.

Princípio: **a lógica mora em `lib/activities/` (serviço único)**. Rotas REST da UI e tools MCP chamam o mesmo serviço. Nada de regra duplicada.

---

## 2. Quem faz o quê (arquitetura)

```
Voz (ChatGPT app) ─┐
Amazon Quick ──────┼── MCP /api/mcp (OAuth usuário) ──► lib/activities/* ──► Postgres (Supabase)
UI JayP Cortex ────┘        └─ lib/briefing/*  (prioridade do dia, alertas)
                                    ▲
Agenda (Outlook) ── lida pelo cliente (Quick já tem Outlook conectado) e enviada como contexto
```

- **Agenda:** fonte = Outlook do João. Decisão: **a plataforma não integra Outlook nesta rodada.** Quem tem o calendário (Quick/GPT) lê os eventos e passa para as tools (`plan_day` recebe `busy_blocks`). A plataforma guarda só **blocos de tempo planejados** das atividades. Integração direta com Microsoft Graph fica como Fase futura (registrar no relatório).
- **LLM:** continua sem chat no servidor. O cliente "veste" o agente com `get_agent_prompt` + `search_knowledge` + tools de atividade.
- **Fuso:** tudo em `America/Sao_Paulo` na borda (datas "hoje", "amanhã", "sexta"); banco em UTC. Constante `APP_TIMEZONE` (env, default `America/Sao_Paulo`).

---

## 3. Banco — migration nova em `prisma/migrations-postgres/` (postgres-only, aditiva)

### 3.1 `Activity` — colunas novas (todas opcionais / com default; nada quebra)
| Coluna | Tipo | Uso |
|---|---|---|
| `description` | text null | detalhe (notes continua existindo) |
| `startedAt` | timestamptz null | quando entrou em andamento |
| `estimatedMinutes` | int null | estimativa |
| `spentMinutes` | int default 0 | acumulado de sessões |
| `scheduledStart` / `scheduledEnd` | timestamptz null | bloco planejado (time blocking) |
| `importance` | int null (1–4) | eixo Eisenhower "importante" |
| `urgency` | int null (1–4) | eixo "urgente" (além do `priority` atual) |
| `energy` | text null | `alta \| media \| baixa` |
| `context` | text null | ex. `@computador`, `@ligacao`, `@rua` |
| `tags` | text[] default `{}` | |
| `area` | text null | `profissional \| pessoal \| comercial \| saude ...` (livre) |
| `waitingOn` | text null | se estiver aguardando alguém |
| `parentId` | text null → Activity | subtarefas (1 nível) |
| `recurrenceRule` | text null | RRULE simples (`FREQ=WEEKLY;BYDAY=MO`) |
| `deletedAt` | timestamptz null | **lixeira (soft delete)** |
| `source` | text default `'ui'` | `ui \| mcp \| voz \| automacao` |
| `externalRef` | text null | id externo (ex. evento do Outlook) |
| `clientKey` | text null unique | **idempotência** (voz repetida não duplica) |
| `createdBy` / `updatedBy` | uuid null → profiles | autoria |

Índices: (`deletedAt`), (`dueDate`), (`scheduledStart`), GIN(`tags`), FTS português em `title + description + notes`.

Todas as listagens atuais passam a filtrar `deletedAt is null` (ajustar `lib/` e rotas existentes **sem mudar o contrato**).

### 3.2 `ActivityStatus` — coluna nova
- `isInProgress` boolean default false. Marcar a linha de chave `in_progress` como true na migration. O serviço usa `isDone`/`isInProgress` (não strings fixas), porque os status são configuráveis.

### 3.3 Tabelas novas
- **`ActivityEvent`** (histórico/auditoria da tarefa): `id`, `activityId`, `type` (`created|updated|status_changed|started|paused|completed|reopened|deleted|restored|queued|unqueued|reordered|rescheduled|reminder_fired`), `before` jsonb, `after` jsonb, `actorId`, `source`, `at`. Toda mudança via serviço grava evento.
- **`ActivitySession`** (cronômetro): `id`, `activityId`, `startedAt`, `endedAt`, `minutes`, `note`. Iniciar abre sessão; pausar/concluir fecha e soma em `spentMinutes`. Só 1 sessão aberta por vez no sistema (iniciar outra pausa a anterior — decisão: foco único).
- **`ActivityReminder`**: `id`, `activityId`, `remindAt`, `channel` (`briefing` por enquanto), `message`, `firedAt`, `dismissedAt`. Lembretes aparecem no briefing quando `remindAt <= agora` e não dispensados.
- **`TimeCapacity`** (opcional, 1 linha por dia da semana): `weekday`, `workMinutes` (default 480 seg–sex, 0 sáb/dom), `focusStart`, `focusEnd`. Usado para carga vs. capacidade.

RLS: mesma política das tabelas de negócio (`authenticated` + `is_active_user()`).

---

## 4. Serviço `lib/activities/` e `lib/briefing/`

- `service.ts`: `list`, `get`, `create`, `update`, `setStatus`, `start`, `pause`, `complete`, `reopen`, `softDelete`, `restore`, `purge` (só admin, só da lixeira), `bulkUpdate`, `queue.add/remove/move/reorder`, `schedule` (bloco), `addReminder`, `subtasks`.
- `dates.ts`: parse de datas em PT-BR na borda ("hoje", "amanhã", "sexta", "dia 15", "próxima semana", ISO) em `APP_TIMEZONE`. Se ambíguo, usar a próxima ocorrência futura e devolver `interpreted_as` na resposta.
- `priority.ts`: **score de prioridade** determinístico e explicável:
  - base pelo `priority` (urgent 40, high 30, normal 15, low 5) + `importance*5` + `urgency*5`
  - prazo: atrasada +30; vence hoje +25; amanhã +15; nesta semana +8
  - na fila: +(10 − posição) mínimo 0
  - em andamento +10; aguardando alguém −15
  - devolver `score` + `reasons[]` (ex. "atrasada 2 dias", "urgente", "#1 da fila")
- `briefing.ts` → `getDailyBriefing(date, busyBlocks?)` retorna:
  - `top3` (maior score, não concluídas), `in_progress`, `overdue`, `due_today`, `due_next_7d`, `no_due_date_high`, `waiting_on`, `reminders_due`
  - `load`: minutos estimados de hoje vs. capacidade (descontando `busy_blocks` da agenda) → `overbooked: true/false`
  - `alerts[]` com `level` (`critico|atencao|info`) e texto: atrasadas, sobrecarga, urgente sem prazo, tarefa em andamento parada > 3 dias, fila com > 7 itens, nenhuma tarefa concluída nos últimos 3 dias, tarefas sem estimativa no top3
  - `suggestions[]` curtas e determinísticas (ex. "reagendar X para amanhã", "quebrar Y em subtarefas")
- `getWeeklyReview(weekStart)`: concluídas, criadas, atrasadas, tempo gasto por área/tipo, taxa de conclusão, itens parados.
- `planDay(date, busyBlocks, strategy)`: propõe blocos de tempo (não grava) encaixando top tarefas nas janelas livres, respeitando `estimatedMinutes` (default 30), energia (alta de manhã) e pausas de 10 min a cada 90. Retorna `plan[]`. Gravar só com `apply=true` (vira `scheduledStart/End` + eventos).

---

## 5. MCP — tools novas (registrar em `lib/mcp/register-tools.ts`, mesmo padrão, zod, descrições em PT)

Respostas sempre com: `id`, `title`, `status` (key + nome), `priority`, `dueDate` (ISO + texto local "sex, 13 nov"), `queuePosition`, `score`, `reasons`, `url` da UI. Listas paginadas (`limit` default 20, máx 100).

**Leitura (`read`)**
| Tool | Faz |
|---|---|
| `list_activities` | filtros: `status` (key ou `open`/`done`/`all`), `priority`, `due` (`overdue|today|tomorrow|this_week|next_7d|no_date`), `type`, `tags`, `area`, `q` (FTS), `in_queue`, `include_deleted`, `sort` (`score|due|created|queue`) |
| `get_activity` | detalhe + subtarefas + histórico (últimos 20 eventos) + sessões + lembretes |
| `search_activities` | busca textual por título/descrição/notas (para "aquela tarefa da Vero") |
| `get_queue` | fila de execução em ordem |
| `list_activity_statuses` / `list_activity_types` | configuráveis |
| `get_daily_briefing` | §4 (aceita `date`, `busy_blocks[]` vindos da agenda) |
| `get_weekly_review` | §4 |
| `plan_day` | proposta de blocos (não grava sem `apply=true`, que exige `write`) |
| `get_activity_history` | eventos de uma tarefa ou do dia |

**Escrita (`write`)**
| Tool | Faz |
|---|---|
| `create_activity` | título obrigatório; demais opcionais; datas em linguagem natural; `client_key` p/ idempotência; `add_to_queue` (posição) |
| `create_activities_bulk` | até 30 de uma vez (despejo por voz) |
| `update_activity` | qualquer campo editável |
| `start_activity` | status → em andamento, `startedAt`, abre sessão (pausa outra aberta) |
| `pause_activity` | fecha sessão, mantém em andamento |
| `complete_activity` | status `isDone`, `completedAt`, fecha sessão, remove da fila, gera próxima ocorrência se recorrente |
| `reopen_activity` | volta para pendente |
| `set_activity_status` | qualquer status por key |
| `delete_activity` | **soft delete** (lixeira), exige `confirm: true`; retorna como desfazer |
| `restore_activity` | tira da lixeira |
| `queue_activity` / `unqueue_activity` / `move_in_queue` / `reorder_queue` | fila |
| `reschedule_activity` | muda prazo e/ou bloco; grava evento `rescheduled` |
| `add_reminder` / `dismiss_reminder` | lembretes |
| `add_subtask` | subtarefa |
| `create_activity_type` | novo tipo |
| `undo_last_action` | desfaz a última escrita do mesmo ator em até 30 min, usando `ActivityEvent.before` |

**Admin (`admin`)**: `purge_deleted_activities` (apagar de vez da lixeira).

Regras:
- Toda escrita grava `ActivityEvent` + `AuditLog` com `source` (`mcp`; se o cliente mandar `source: "voz"`, aceitar `voz`).
- Ator = usuário do OAuth (fluxo de usuário); client_credentials = admin (como hoje).
- Erros em PT, acionáveis ("Não achei tarefa com 'proposta Vero'. Parecidas: …").
- Ferramentas que recebem "qual tarefa" aceitam `id` **ou** `query` (busca fuzzy; se > 1 resultado, retornar candidatos sem executar).

Também: prompt MCP `briefing_do_dia` e `capturar_tarefas` (guias de uso para o cliente).

---

## 6. UI (mínimo, sem quebrar)

- Modal de atividade: campos novos (estimativa, bloco, importância/urgência, energia, contexto, tags, área, aguardando, subtarefas, lembretes).
- Badge de origem (`voz`, `mcp`) e "histórico" da tarefa.
- **Lixeira** em Atividades (restaurar).
- Botão iniciar/pausar com cronômetro na fila.
- Painel **"Hoje"** no topo de Atividades usando `getDailyBriefing` (top3, alertas, carga). Reaproveitar componentes.
- Rotas REST espelhando o serviço: `/api/activities/briefing`, `/api/activities/:id/start|pause|complete|reopen|restore`, `/api/activities/trash`, `/api/activities/review`.

---

## 7. Agente "Gestão de Tempo" (seed idempotente `scripts/seed-agent-gestao-tempo.ts`)

- Nome provisório **Cortex Tempo** · slug `gestao-tempo` · papel "Coach de Alta Performance e Gestão de Tempo" · status `active` · `capabilities`: lista das tools de atividade + agenda via cliente.
- Sala com pastas `Prompt`, `Base de conhecimento`, `Templates`, `Entregas` (mesmo `create_agent`).

### 7.1 Camadas de prompt (arquivos TipTap `kind=prompt`)
1. **Identidade** — 4 chapéus: especialista em gestão de tempo (agendas e métodos), coach de alta performance (ferramenta + comportamento/mente, procrastinação), consultor de organização pessoal e eficiência (desenha sistemas e processos), personal organizer de rotina digital. Tom: direto, motivador sem ser piegas, PT-BR, frases curtas (serve para **voz**).
2. **Missão** — manter a lista de atividades do João sempre verdadeira, priorizada e executável; proteger tempo de foco; reduzir procrastinação; dizer o que fazer agora.
3. **Regras operacionais** —
   - Sempre consultar `get_daily_briefing` antes de opinar sobre o dia; usar agenda real (eventos) quando o cliente tiver.
   - Capturar rápido: criar a tarefa primeiro, perguntar detalhes depois (no máximo 1 pergunta).
   - Toda tarefa criada deve ter: verbo de ação no título, prazo ou "sem prazo" consciente, prioridade.
   - Usar `client_key` em capturas por voz.
   - Apagar = lixeira, sempre confirmar; informar como desfazer.
   - Nunca mover/concluir em massa sem listar o que vai mudar.
   - Ao final de cada ação, devolver confirmação curta: "Criei 'X' para sex 13/11, prioridade alta, #2 na fila."
4. **Metodologia** — Eisenhower (urgente×importante), Ivy Lee / top 3 do dia, Eat the frog, time blocking, Pomodoro/90 min de foco, GTD (captura → esclarecer → organizar → revisar → executar), regra dos 2 minutos, revisão semanal, Pareto 80/20, Parkinson (prazos curtos), 1-3-5.
5. **Comportamental** — gatilhos de procrastinação (tarefa vaga, grande demais, medo de julgamento, perfeccionismo, baixa energia), intervenções (quebrar em próximo passo físico, 5 minutos, compromisso de horário, remover fricção, recompensa), linguagem sem culpa.
6. **Formato de saída** — Briefing por voz: (1) 1 frase de abertura, (2) top 3, (3) alertas críticos, (4) primeiro passo agora. Máx. ~120 palavras por voz; em texto pode usar tabela.
7. **Guardrails** — não inventar eventos de agenda; não marcar concluída sem pedido explícito; respeitar fim de semana/descanso (sáb/dom capacidade 0, a menos que o João peça); saúde e sono acima de produtividade.

### 7.2 Base de conhecimento inicial (`kind` entre parênteses) — conteúdo condensado, em PT, com fonte geral citada
1. Matriz de Eisenhower aplicada à fila (metodologia)
2. Top 3 do dia / método Ivy Lee (metodologia)
3. Time blocking e proteção de foco (metodologia)
4. Pomodoro, ciclos de 90 min e energia ao longo do dia (metodologia)
5. GTD essencial: captura, esclarecimento, próximos passos (metodologia)
6. Revisão semanal — roteiro (passo_a_passo)
7. Psicologia da procrastinação e intervenções (referencia)
8. Rotina digital: inbox zero, notificações, blocos de comunicação (processo)
9. Como o agente usa a plataforma: mapa de tools, campos, score de prioridade e alertas (processo) — **gerar a partir do código real**
10. Regras de captura por voz (processo): ditado → tarefas, desambiguação de datas, idempotência
11. Perfil do João (contexto): Arquiteto de Soluções na Nuage IT; frentes: pré-venda/assessments MAP, comercial, plataforma JayP Cortex, pessoal (controle diário, desafio, treino). **Marcar "a validar pelo João".**
12. Glossário de status, prioridades e tipos da plataforma (referencia) — gerar do banco.

Templates (`kind=template`): **Briefing diário (voz)**, **Briefing diário (texto)**, **Revisão semanal**, **Plano do dia em blocos**, **Desbloqueio de tarefa procrastinada**.

Vincular tudo via `AgentKnowledge`, indexar, publicar prompt v1.

---

## 8. Conexão por voz (ChatGPT) — preparar, não bloquear

- O MCP já tem OAuth authorization code + PKCE. Garantir compatibilidade com o conector de MCP do ChatGPT:
  - **Dynamic Client Registration** (`/api/mcp/oauth/register`) ligado e protegido (allowlist de redirect).
  - Incluir redirect `https://chatgpt.com/connector_platform_oauth_redirect` (e variações `chat.openai.com`) em `MCP_OAUTH_REDIRECT_URIS`; registrar no AuditLog qualquer redirect recusado para ajuste.
  - `/.well-known/oauth-protected-resource` apontando o authorization server.
- Escrever `docs/mcp-conexao-chatgpt.md` (passo a passo de criar o conector no ChatGPT, URL, escopos).
- Se não der para validar sem o João, deixar documentado como pendência — **não bloquear**.
- Observação de arquitetura: o caminho recomendado é **ChatGPT → MCP do Cortex direto** (não ChatGPT → Quick → Cortex). O Quick continua conectado em paralelo. Os dois falam com o mesmo banco; a idempotência (`client_key`) evita duplicação.

---

## 9. Testes mínimos
- Unit: parse de datas PT-BR (hoje/amanhã/sexta/dia 15/próxima semana, fuso SP), score de prioridade, briefing (atrasadas, sobrecarga), planDay sem sobreposição com busy_blocks, soft delete/restore, undo, idempotência por `client_key`, recorrência.
- Integração: create → start → pause → complete via MCP; delete sem `confirm` falha; listagens atuais ignoram lixeira; UI atual (lista/kanban/fila) continua funcionando.
- Produção: `tools/list` mostra as novas tools; `get_daily_briefing` responde; criar tarefa de teste `[TESTE MCP] ...`, concluir, apagar e **purgar** no fim (não deixar lixo).

## 10. Ordem de execução (não parar entre etapas)
- **G0** Ler contexto, schema, rotas e componentes de atividades, `lib/mcp/register-tools.ts`. Criar relatório.
- **G1** Migration (§3) + ajustes de filtro `deletedAt` nas rotas atuais.
- **G2** `lib/activities/` (service, dates, priority) + eventos + sessões + lembretes + recorrência.
- **G3** `lib/briefing/` (daily, weekly, planDay).
- **G4** Tools MCP (§5) + prompts MCP.
- **G5** Rotas REST + UI mínima (§6).
- **G6** Seed do agente `gestao-tempo` (§7) + reindex + prompt v1.
- **G7** Compatibilidade ChatGPT (§8) + doc.
- **G8** Testes + build.
- **G9** Deploy + testes em produção + limpeza dos dados de teste.
- **G10** Atualizar `contexto-plataforma.md` (estado atual, §1 módulos, §3 tabelas, §10 MCP, últimas mudanças), `mcp-conexao-quick.md` (tools novas), relatório final com pendências do João.

## 11. Decisões pré-tomadas (não perguntar)
| Tema | Decisão |
|---|---|
| Agenda | Outlook lido pelo cliente (Quick/GPT); plataforma guarda só blocos planejados. Graph direto = futuro |
| Apagar | Soft delete + lixeira + `confirm:true`; purge só admin |
| Foco | 1 sessão ativa por vez |
| Fuso | `America/Sao_Paulo` |
| Prioridade | score determinístico com `reasons` (não LLM) |
| Status | usar `isDone`/`isInProgress`, nunca string fixa |
| Nome do agente | provisório "Cortex Tempo" (`gestao-tempo`); renomear depois sem trocar slug |
| Voz | ChatGPT → MCP direto, OAuth de usuário, `client_key` |
| Capacidade | seg–sex 480 min, sáb/dom 0 |

## 12. Checklist
- [x] G0 · [x] G1 · [x] G2 · [x] G3 · [x] G4 · [x] G5 · [x] G6 · [x] G7 · [x] G8 · [ ] G9 · [ ] G10

## Histórico
- 7 nov 2026 — plano criado pelo Amazon Quick.
