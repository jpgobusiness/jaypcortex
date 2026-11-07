
- 7 nov 2026 — **Plano aprovado (Etapa 1 do Cortex):** tool MCP `cortex` como porta de entrada (roteamento determinístico + pacote: agente, prompt, conhecimento, dados vivos, tools sugeridas), sem LLM no servidor. Roadmap: Etapa 2 = agente com LLM próprio (1 tarefa); Etapa 3 = Cortex orquestrando vários agentes. Ver `docs/plano-cortex-orquestrador.md`.
- 7 nov 2026 — **Plano aprovado:** atividades completas no MCP (CRUD, iniciar/pausar/concluir, lixeira, fila, prazos, blocos, lembretes, briefing do dia) + agente **Gestão de Tempo** (`gestao-tempo`, nome provisório Cortex Tempo) + preparo para voz via ChatGPT. Ver `docs/plano-agente-gestao-tempo.md`.
- 7 nov 2026 — **Amazon Quick conectado ao MCP** (`https://jaypcortex.vercel.app/api/mcp`) via conector `JayPCortexChat` (OAuth de usuário, authorization code + PKCE; só o João tem acesso). Conector serviço a serviço também existe, mas o Quick não permite usá-lo no Chat/Flows (só automação). Pendência: rotacionar o `client_secret` de serviço exposto em print.

> **Fonte da verdade** deste repositório. Cursor, Amazon Quick e qualquer agente leem e atualizam este arquivo.
> Depois de cada melhoria no produto, o **estado atual** precisa refletir o código — mesmo que o usuário não peça.
> Plano (Supabase, auth, edge) fica nas seções de discussão. Quando um item sair do papel, mover para o estado atual.

Última atualização: 7 nov 2026 (MCP: create_activity schema Quick-safe)

## Últimas mudanças

- 7 nov 2026 — `create_activity.add_to_queue` passou a ser só `number` (posição na fila). Union boolean|number gerava JSON Schema `type: ["boolean","number"]` e o Action Review do Quick travava sem botão.
- 7 nov 2026 — `list_activities` padrão = pendentes (`status=open`) e devolve `{ activities, total, truncated, counts, note }`. Evita o cliente tratar a página (limit 20) como o universo. `search_activities` e `get_queue` também trazem total.
- 7 nov 2026 — Tools MCP com `title` PT-BR e annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`). `plan_day` só lê; `apply_day_plan` grava. Após deploy: Customize → Connectors → JayPCortexChat → permissões. Ver `docs/mcp-conexao-quick.md`.
- 7 nov 2026 — **Cortex Etapa 1:** tool MCP `cortex` (porta de entrada), roteamento determinístico (`lib/cortex`), `Agent.routing` + `CortexRouteLog`, agente Cortex (`slug cortex`, `isOrchestrator`). Sem LLM no servidor. Ver `docs/plano-cortex-orquestrador.md` e `docs/relatorio-execucao-cortex.md`.
- 7 nov 2026 — Agente `gestao-tempo` renomeado para **Gestor de Atividades** (slug inalterado).

---

## 0. Estado atual (fato, não plano)

| Item | Hoje |
|---|---|
| App | Next.js 16 (App Router) + React 19, local e na Vercel |
| Banco | **Postgres no Supabase** (pooler `aws-1-us-west-2`). Backup SQLite: `dev.db` + `backups/dev-2026-11-06.db` (não apagar). |
| Flag | `DATABASE_PROVIDER=postgres`. |
| ORM | Prisma 7 + `pg` Pool. Cliente postgres em `app/generated/prisma-postgres`. TLS do pooler: `sslmode=no-verify`. |
| Auth | **Login fechado** em `/login` (e-mail + senha, cookie httpOnly). Middleware protege páginas e `/api/*`, **exceto** `/api/mcp*`, `/api/mcp/oauth/*` e `/.well-known/*` (sem cookie). Logout no menu. |
| Signup | **Bloqueado.** Sem tela de cadastro. Trigger em `auth.users` recusa signup público; admin cria via allowlist. A flag `disable_signup` do painel ainda aparece `false` (a API de Auth não deixa a service role alterar). |
| Admin | `pjoao4446@gmail.com` em `auth.users` + `profiles.role=admin`. Senha **não** está no repo. |
| Supabase | `gzavuqgoxllbgfyyyrjv` (`us-west-2`). `public` com dados copiados (28 tabelas) + `profiles`. `OvertimeAttachment` = 0 linhas. |
| Hospedagem | **Vercel** em https://jaypcortex.vercel.app. GitHub `jpgobusiness/jaypcortex`. Node 22. |
| Edge Functions | Zero (MCP e indexação no Next/Vercel) |
| Storage | Bucket privado `overtime-attachments` vazio. Anexos **novos** vão para o Storage. |
| MCP | **Um servidor para o escritório inteiro** (não um por agente). URL `https://jaypcortex.vercel.app/api/mcp`. Auth: Bearer estático **ou** OAuth `client_credentials` **ou** OAuth `authorization_code`+PKCE (access 1h, refresh 30d). Escopos `read` / `propose` / `write` / `admin`. Porta de entrada: tool **`cortex`**. Tools com `title` PT-BR + annotations. `plan_day` lê; `apply_day_plan` grava. `list_activities` padrão pendentes + `total`/`truncated`/`counts`. |
| Cortex | slug `cortex`, `isOrchestrator=true`, id `cortex-orchestrator`. Roteador determinístico (sem LLM). 4 camadas de prompt, docs “Mapa do escritório” e “Como usar o Cortex”. |
| Agente de atividades | slug `gestao-tempo`, nome **Gestor de Atividades**. 7 camadas de prompt (inclui Comportamental), 12 docs + 5 templates, prompt publicado. `routing` preenchido. |
| Busca | Híbrida RRF (`match_knowledge`): FTS português + pgvector 1536. Sem `OPENAI_API_KEY` → `indexStatus=skipped`, só FTS. |
| Chat do agente | **Não existe** tool/rota que chame LLM. O cliente chama `cortex` e veste `agent_prompt`. Aba Testar só devolve trechos. |
| Agente MAP | slug `migracao-aws`, 6 camadas de prompt, 12 docs + 5 templates, prompt v1 publicado. `routing` preenchido. |
| Páginas | `/login`, `/atividades`, `/controle-diario`, `/desafio`, `/horas-extras`, `/automacoes`, `/configuracoes`, `/usuarios`, `/escritorio`, `/espacos`, `/espacos/[id]`, `/espacos/[id]/arquivos/[id]`. |

Conclusão: app no Postgres + login + **um MCP da plataforma** (porta `cortex` + conhecimento + atividades) + Cortex orquestrador + Agente MAP + Gestor de Atividades, publicado na Vercel.

---

## 1. O que a plataforma faz (módulos)

Tudo é de **um operador** (você). Não há multi-empresa nem “criar conta”.

### Pessoal
- **Controle diário** — hábitos dinâmicos + check por dia
- **Desafio** — hábitos/itens do mês, nota, treino, água, etc.

### Profissional
- **Atividades** — lista, kanban, **fila de execução** (primeira aba), mapa mental, painel **Hoje**, lixeira, iniciar/pausar com cronômetro
- **Horas extras** — mês, lançamentos, anexos (imagem/PDF no Storage para os novos)
- **Automações** — contatos (ex. WhatsApp)
- **Configurações** — tipos e status de atividade + **Tokens MCP** (admin: criar/listar/revogar)

### Conhecimento e agentes
- **Espaços de trabalho** — espaços → pastas (1 nível) → arquivos (páginas TipTap). Editor com barra de `kind`, tags, índice e histórico de revisões.
- **Escritório de agentes** — agentes 3D, cada um com “sala” (um Workspace) e pastas padrão: `Prompt`, `Base de conhecimento`, `Templates`, `Entregas`. Painel com abas: Visão, Prompt, Base, Propostas, Histórico, Testar.
- **Base de conhecimento do agente** — **não copia** o documento; é um vínculo `AgentKnowledge` → `WorkspaceFile`. Continua editável por **Base de conhecimento → Novo arquivo** (editor TipTap).
- **MCP (plataforma)** — um endpoint para todos os agentes. Leitura, propostas e escrita via tools; Markdown só na borda MCP; banco permanece TipTap JSON. Não é chat.

### Comercial (no banco, UI pode estar menos visível no menu atual)
- Funil: `Stage`, `Opportunity`, `Commercial`
- Metas: `QuarterGoal`
- Atividade pode ligar em oportunidade

---

## 2. Login e usuários (decisão pedida)

### Regras que você definiu
- Precisa de login para segurança
- **Sem opção de criar conta** na tela
- Usuários (admin e, depois, outros) **criados por nós**, senha **salva no banco**
- Autenticação de usuários
- Gestão de usuários (depois do admin único)

### Recomendação (discutir)

**Usar Supabase Auth (`auth.users`) com signup DESLIGADO**, e uma tabela nossa `profiles`.

Por quê não guardar senha em texto (nem hash caseiro) numa tabela `users` nossa:
- GoTrue já faz hash (bcrypt), reset, sessão, cookies/JWT
- A secret key do Supabase não vai para o browser
- RLS no Postgres usa `auth.uid()` de graça

Como criar gente sem “criar conta” na UI:
1. Dashboard do Supabase **ou**
2. Tela **Gestão de usuários** só para `role = admin`, que chama a **Admin API** (service role) no **servidor Next** — nunca numa Edge Function pública sem auth
3. Signup público: **off** no painel Auth (`enable_signup = false`)

Fluxo de login na app:
- Tela `/login`: e-mail + senha → `signInWithPassword`
- Sem link “cadastre-se”
- Sem OAuth no dia 1 (pode entrar depois, ainda sem signup aberto)

### Tabelas novas de identidade

#### `public.profiles`
Quem é a pessoa **dentro do produto**. 1:1 com `auth.users`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | **igual** a `auth.users.id` |
| `email` | text unique | denormalizado para listar sem ir no Auth |
| `display_name` | text | |
| `role` | text | `admin` \| `member` (só admin gerencia usuários) |
| `active` | boolean | desligar acesso sem apagar |
| `created_at` / `updated_at` | timestamptz | |
| `created_by` | uuid? | quem criou (admin) |

Trigger `on auth.users insert` → cria `profiles` (assim o seed do admin não esquece a linha).

**Primeiro usuário:** inserido por nós (SQL + Auth Admin), `role = admin`, senha forte. Não existe self-service.

### O que não fazer
- Não ligar “Email signup” no Auth
- Não usar a publishable key para criar usuário no client
- Não colocar senha em `profiles.password`
- Não deixar `/api/*` sem sessão depois do go-live — **exceção feita 7 nov 2026:** `/api/mcp*` (Bearer estático ou OAuth) e `/.well-known/*`. O resto das APIs continua exigindo sessão.

---

## 3. Tabelas: o que já existe (migrar do Prisma/SQLite)

**Decidido:** nomes 1:1 com o SQLite (tabelas Prisma `"Stage"`, `"Activity"`, …). IDs `text` + cuid. Sem uuid nesta migração.

### Comercial / pipeline
- `stages` — funil
- `commercials` — vendedores
- `opportunities` — negócios
- `quarter_goals` — meta por ano+quarter

### Atividades
- `activity_statuses` — pendente / em andamento / concluída (configurável); agora também `isInProgress`
- `activity_types`
- `activities` — inclui `queue_order` (fila) **e** estimativa, bloco, Eisenhower, energia, contexto, tags, área, aguardando, subtarefa, recorrência, lixeira (`deletedAt`), origem, `clientKey`, autoria
- `ActivityEvent`, `ActivitySession`, `ActivityReminder`, `TimeCapacity` (8h seg–sex, 0 sáb/dom, fuso America/Sao_Paulo)
- `mind_map_groups`, `mind_maps`
- `activity_map_nodes`, `mind_map_shapes`, `mind_map_connections`

### Pessoal
- `challenge_items`, `challenge_days`, `challenge_day_checks`, `challenge_months`
- `daily_habits`, `daily_days`, `daily_habit_checks`

### Horas extras
- `overtime_months`, `overtime_entries`
- `OvertimeAttachment` — SQLite: `data Bytes`. Postgres (migration gerada): `path` + `name` + `mimeType` + `size`, sem BYTEA. Ver §6 Storage.

### Automações
- `automation_contacts`

### Conhecimento
- `workspaces`
- `workspace_folders` (um nível; sem pasta-dentro-de-pasta)
- `workspace_files` — `content` = JSON TipTap (`type: "doc"`), `excerpt` texto curto. **Agora também:** `kind`, `tags[]`, `searchText`, `contentHash`, `indexedAt`, `indexStatus`, `updatedBy`, `source`
- `agents` — **agora também:** `slug`, `model`, `temperature`, `status`, `activePromptVersionId`, `retrievalConfig`, `capabilities`
- `agent_knowledge` — N:N agente ↔ arquivo
- `KnowledgeChunk` — chunks + `embedding vector(1536)` + FTS `tsv`
- `AgentPromptLayer` / `AgentPromptVersion`
- `ChangeProposal` / `FileRevision`
- `McpToken` / `AuditLog`
- `McpOAuthClient` / `McpOAuthAccessToken` / `McpOAuthAuthorizationCode` / `McpOAuthRefreshToken` — OAuth (hash; RLS só admin)

**Antes (substituído em 7 nov 2026):** “não existem tags, kind, autor, embeddings”. Passaram a existir na migration `20261107120000_mcp_knowledge`.

Nomes no Postgres são os do Prisma (`"WorkspaceFile"`, `"McpToken"`, …), não snake_case.

### Rotas REST novas (UI + serviços; além do MCP)

- `/api/mcp` e `/api/mcp/[transport]` — Streamable HTTP; Bearer estático `jpc_…` **ou** access token OAuth
- `GET/POST /api/mcp/oauth/authorize` — consentimento (login + PKCE S256)
- `POST /api/mcp/oauth/token` — `client_credentials`, `authorization_code`, `refresh_token`
- `POST /api/mcp/oauth/register` — DCR RFC 7591 (allowlist QuickSight)
- `GET /.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openid-configuration`
- `/api/mcp-tokens` (GET/POST, admin) e `/api/mcp-tokens/[id]` (DELETE/revogar)
- `/api/knowledge/search`, `/api/knowledge/reindex`
- `/api/agents/[id]/prompt` (GET composto, POST publicar), `/prompt/layers`, `/prompt/versions`
- `/api/proposals`, `/api/proposals/[id]/apply`, `/api/proposals/[id]/reject`
- `/api/workspaces/files/[id]/revisions` (GET histórico, POST restaurar)
- `/api/activities/briefing`, `/review`, `/trash`
- `/api/activities/:id/start|pause|complete|reopen|restore|history`

Rotas de espaços/agentes/arquivos atuais **não foram quebradas**. PATCH do arquivo indexa e grava revisão. Listagens de atividade ignoram lixeira (`deletedAt`). DELETE de atividade é **soft delete**.

---

## 4. Tabelas / colunas novas (proposta, para discutir)

> **7 nov 2026 — Fase 2 feita.** O texto abaixo era a proposta; o que entrou no banco está no §3. Não apagar: serve de histórico.

Prioridade original: **o mínimo para publicar com login**. O resto era fase 2.

### Fase 1 — publicar
- `profiles` (acima) — **feito**
- `audit_log` (opcional mas barato): `id`, `actor_id`, `action`, `entity`, `entity_id`, `at` — **feito** como `AuditLog` (MCP + publish prompt + tokens)
- `workspace_files.updated_by` uuid? → `profiles.id` (quem editou) — **feito** (`updatedBy`)

### Fase 2 — conhecimento “de verdade” (Quick / MCP) — **feito 7 nov 2026**
- coluna `WorkspaceFile.kind` (não tabela `document_kinds`)
- `tags text[]` no arquivo (não tabela N:N)
- `searchText` + coluna gerada FTS `searchTsv`
- `KnowledgeChunk` + pgvector 1536 + busca híbrida `match_knowledge`

### Fase 3 — multi-usuário de verdade
Hoje o banco é **global** (um cérebro só). Se entrar `member`:
- ou **tudo compartilhado** (os dois veem a mesma fila, os mesmos espaços) — mais simples, combina com “plataforma pessoal/profissional de um time minúsculo”
- ou `owner_id` / `workspace.visibility` — bem mais trabalho

**Recomendação de discussão:** Fase 1 = um admin, dados globais como hoje. Gestão de usuários cria `member` que **enxerga o mesmo mundo**, só não gerencia usuários nem configurações críticas.

---

## 5. Views (só se ajudar; não inventar dezenas)

Views são baratas (não contam como Edge Function). Úteis:

| View | Para quê |
|---|---|
| `v_pipeline` | oportunidade + estágio + comercial |
| `v_activity_board` | atividade + tipo + status + oportunidade |
| `v_knowledge_catalog` | **existe** (migration MCP): arquivo + espaço + pasta + kind + tags + agentes + indexStatus |
| `v_agent_overview` | **existe:** agente + prompt ativo + nº docs/chunks + propostas pendentes |
| `v_overtime_month_totals` | soma de horas / valor por mês |
| `v_profiles_safe` | profiles sem nada sensível, para o client |

FTS: `to_tsvector` em `search_text` quando a coluna existir. Não precisa de view para isso.

---

## 6. Storage (não é tabela, mas é obrigatório pensar)

`OvertimeAttachment.data` no SQLite é blob. **Não migra.** Os anexos antigos ficam só no `dev.db` / backup.

No Supabase, só o que vier **daqui pra frente**:

- Bucket privado `overtime-attachments` **criado, vazio**
- Tabela `OvertimeAttachment` com `path`, `name`, `mimeType`, `size` — sem BYTEA
- Na cópia de dados, pular a tabela de anexos (manter `OvertimeMonth` / `OvertimeEntry`)

Documentos TipTap **continuam no Postgres** (`content` texto JSON). Não são arquivos no Storage.

---

## 7. RLS (Row Level Security)

**Feito.** Tabelas de negócio: `authenticated` + `is_active_user()` (SECURITY DEFINER, para não recursar).  
`profiles`: o próprio lê a si; admin lê/altera os outros via `is_admin()`.  
`McpToken`, `AuditLog` e tabelas `McpOAuth*`: leitura/escrita só `is_admin()`. MCP autentica o token **no servidor** (Prisma/service role bypassa RLS).  
`anon` sem grant. Service role (servidor) **bypassa RLS**.

---

## 8. Edge Functions — economizar o limite (100 no free)

### Princípio
O Next.js **já é o monólito de API** (`app/api/**`, ~63 rotas). Subir isso para Vercel (ou similar) **não gasta** cota de Edge Function do Supabase.

**Dia 1: 0 Edge Functions.** Auth + CRUD no Next, apontando Prisma para o Postgres.

### Quando criar (aos poucos)

| # | Nome | Agrupa várias coisas | Quando |
|---|---|---|---|
| 1 | `admin` | criar/desativar usuário, reset de senha (proxy da Auth Admin) | gestão de usuários |
| 2 | `knowledge` | **Não criar.** MCP e busca rodam no Next (`/api/mcp`, `/api/knowledge/search`). | — |
| 3 | `search` | **Não criar.** Função SQL `match_knowledge` no Postgres. | — |
| 4 | `agents` | orquestrador + chat; um `action` no body | escritório com IA ligada |
| 5 | `jobs` | cron: excerpt, reindex, limpeza | se precisar de background |

Meta: **ficar em 5–8**, não 40. Cada função é um **roteador** (`{ "action": "list_documents", ... }`), não um deploy por verbo.

O que **não** vira Edge Function: CRUD de atividade, desafio, horas extras, kanban — isso fica no Next.

---

## 9. Auth no app Next (além do banco)

**Feito.**

- `/login`: e-mail + senha, sem cadastro
- Cookie httpOnly (Supabase SSR)
- Middleware: tudo exige sessão, exceto `/login`, `/offline`, estáticos, `POST /api/auth/login`, **`/api/mcp*`** (Bearer/OAuth), **`/.well-known/*`**
- `/usuarios`: gestão, só `admin`
- `/configuracoes`: tipos/status + Tokens MCP (admin)
- Logout: botão Sair na sidebar + em `/usuarios`

Painel Auth (`disable_signup`) ainda pode aparecer ligado: a service role **não consegue** mudar essa flag. O trigger + a ausência de tela de cadastro bloqueiam o signup mesmo assim. Desligar no painel é opcional, redundante.

---

## 10. Base de conhecimento + Quick / MCP

**Feito (7 nov 2026).** Texto antigo (“sem tag, sem kind, sem vetor, sem auth, SQLite”) está **substituído**.

Arquitetura: **um MCP = o escritório Nuage/JayP Cortex**. Amazon Quick conecta uma vez e opera **qualquer** agente (Cortex, Ana, MAP, novos). Não há MCP por agente.

- Fonte da verdade: `WorkspaceFile.content` (JSON TipTap). Markdown só na borda MCP / leitura.
- Base do agente = `AgentKnowledge` (vínculo, não cópia). UI: Base → Novo arquivo → editor.
- `kind` + `tags[]` + FTS + pgvector; indexação no `PATCH` do arquivo.
- MCP Streamable HTTP: `https://jaypcortex.vercel.app/api/mcp` (também `/api/mcp/mcp`). Header `Authorization: Bearer <token>` — estático `jpc_…` **ou** access token OAuth. Escopos `read` / `propose` / `write` / `admin`.
- **Porta de entrada:** `cortex` (pedido → agente + prompt + conhecimento + dados vivos + `suggested_tools`). Também `get_agent_context` e `list_agent_tools`. Prompt MCP `cortex_start`.
- `search_knowledge` / `read_document` / `list_documents` = **só base de conhecimento, não contém tarefas**. Tarefas = `list_activities` / `cortex`.
- Tools de leitura: `list_agents`, `get_agent`, `get_agent_prompt`, `list_workspaces`, `list_documents`, `read_document`, `search_knowledge`, `list_proposals`, `get_proposal`, `get_document_history`.
- Tools de rascunho: `propose_document_change`, `propose_new_document`, `propose_prompt_change`, `propose_agent_config`.
- Tools de escrita: `apply_proposal`, `reject_proposal`, `publish_prompt`, `create_document`, `update_document`, `link_knowledge`, `unlink_knowledge`, `create_agent`, `reindex_document`.
- Tools de **atividades** (mesmo `/api/mcp`): `list_activities` (padrão `status=open`; resposta `{ activities, total, truncated, counts, note }`), `get_activity`, `search_activities`, `get_queue` (`queue` + `total`), `list_activity_statuses`, `list_activity_types`, `get_daily_briefing`, `get_weekly_review`, `plan_day` (leitura), `apply_day_plan` (escrita), `get_activity_history`, `create_activity`, `create_activities_bulk`, `update_activity`, `start_activity`, `pause_activity`, `complete_activity`, `reopen_activity`, `set_activity_status`, `delete_activity`, `restore_activity`, `queue_activity`, `unqueue_activity`, `move_in_queue`, `reorder_queue`, `reschedule_activity`, `add_reminder`, `dismiss_reminder`, `add_subtask`, `create_activity_type`, `undo_last_action`, `purge_deleted_activities` (admin).
- Toda tool MCP declara `title` em PT-BR e `annotations` (hints: `readOnlyHint`, `destructiveHint`, `idempotentHint`).
- Prompts MCP: `cortex_start`, `briefing_do_dia`, `capturar_tarefas`.
- Agenda Outlook: **não** integrada nesta rodada. O cliente envia `busy_blocks`. Graph direto = futuro.
- Voz: caminho recomendado **ChatGPT → MCP direto** (não GPT → Quick → Cortex). `client_key` evita duplicar ditado. Doc: `docs/mcp-conexao-chatgpt.md`.
- Prompt em camadas (`kind=prompt` na pasta Prompt) + `AgentPromptVersion` imutável.
- Propostas: rascunho → aplicar/rejeitar, com diff e `FileRevision`.
- Agente `migracao-aws` ativo com base MAP.
- OAuth MCP: **feito** — `client_credentials` (serviço a serviço) e `authorization_code` + PKCE S256 + refresh (autenticação do usuário, tela de consentimento). Discovery RFC 8414 + `openid-configuration`. Clientes no script `npm run mcp:oauth-client`.
- **Não feito (Etapa 2):** agente com LLM próprio executando 1 tarefa (ex.: briefing automático do Tempo).
- **Não feito (Etapa 3):** Cortex orquestrando vários agentes com debate controlado, limites de passos/custo, propostas para ações críticas e registro de execuções.
- **Não feito:** `ask_agent` / chat que chama LLM no servidor. Quick/GPT usam `cortex` + prompt + tools e respondem eles mesmos.

Conexão: `docs/mcp-conexao-quick.md`. Segredo/token em claro nunca no git.

---

## 11. Migração SQLite → Postgres (ordem segura)

1. ~~Prisma + migration no `public`~~ **feito**
2. ~~Dump SQLite → Postgres (cuid iguais), sem `OvertimeAttachment`~~ **feito**
3. ~~Bucket Storage vazio~~ **feito**
4. ~~`profiles` + trigger + seed admin~~ **feito**
5. ~~RLS (com funções SECURITY DEFINER)~~ **feito**
6. ~~Login no Next~~ **feito**
7. ~~Corte local `DATABASE_PROVIDER=postgres`~~ **feito** (reiniciar o `next dev` se ainda estiver no processo antigo)
8. ~~Publicar na Vercel~~ **feito** — https://jaypcortex.vercel.app

Não desligar o `dev.db` no primeiro dia. É o backup de verdade.

---

## 12. O que mais vamos precisar (além de tabela)

- **HTTPS + domínio** (Vercel / similar)
- **Env de produção** (URL, anon/publishable, service role só no server)
- **Backup** (Supabase faz PITR no plano pago; no free, dump periódico)
- **Rate limit** no login (Auth já ajuda contra brute force)
- **Observabilidade** mínima (log de 401 / 500)
- **PWA / offline** (`/offline` já existe): com auth, cache de documento precisa de cuidado
- **Limites de `content`**: 5 MB de JSON por arquivo; não mandar isso para Edge se puder evitar
- **Chave publishable vs anon:** a `sb_publishable_…` atual autentica no Auth. REST com essa chave + RLS: autenticado lê (ex. 121 activities); anon não lê.

### Checklist Vercel (Etapa 6)

Variáveis (sem valores aqui):

| Nome | Onde |
|---|---|
| `DATABASE_PROVIDER` | `postgres` |
| `POSTGRES_POOLER_URL` | Transaction pooler `:6543` |
| `POSTGRES_DATABASE_URL` | Session pooler `:5432` (migrate) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave pública (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | **só servidor** |
| `ADMIN_EMAIL` | e-mail do admin |
| `OPENAI_API_KEY` | opcional; sem ela a busca é só FTS |
| `MCP_ENABLED` | default `true` |
| `MCP_BOOTSTRAP_TOKEN` | opcional, só se a UI de tokens falhar |
| `MCP_PUBLIC_ORIGIN` | opcional; issuer OAuth (default `https://jaypcortex.vercel.app`) |
| `MCP_OAUTH_REDIRECT_URIS` | opcional; padrões extra de redirect (além de QuickSight e ChatGPT) |
| `APP_TIMEZONE` | default `America/Sao_Paulo` |
| `MCP_OAUTH_REGISTRATION_TOKEN` | opcional; Bearer para DCR fora da allowlist |

Não colocar senha. `DATABASE_URL` na Vercel pode ser a mesma do pooler se o Prisma usar `POSTGRES_POOLER_URL`.

Build faz `DATABASE_PROVIDER=postgres prisma generate && next build`. Root Directory = repo. Node 22. Depois do primeiro deploy: `npm run db:migrate:postgres` não precisa se o schema já está no ar; só se houver migration nova.

No painel Auth do Supabase, Site URL / Redirect URLs devem incluir `https://jaypcortex.vercel.app`.

---

## 13. Decisões abertas (para discutir antes de criar tabela)

1. ~~**IDs:** cuid ou uuid?~~ **Decidido: cuid em `text`**, cópia 1:1.
2. **Members:** veem o mesmo mundo que o admin, ou cada um tem espaços próprios?
3. ~~**`kind` + tags**~~ **Decidido 7 nov 2026:** coluna `kind` + `tags[]` no arquivo, para MCP/busca.
4. ~~**Anexos de hora extra:**~~ **Decidido: Storage para os novos.** Anexos antigos do SQLite **não sobem**.
5. ~~**Edge Functions no dia 1:**~~ **Decidido: zero.** Auth e CRUD no Next.
6. ~~**Onde roda o Next:**~~ **Decidido: Vercel.** Prisma usa o pooler do Supabase.
7. ~~**Admin:**~~ **Decidido:** e-mail `pjoao4446@gmail.com` (`ADMIN_EMAIL`). Senha só no painel Auth / cofre — nunca em código, seed, commit ou log. Signup público off.
8. ~~**MCP por agente vs plataforma:**~~ **Decidido 7 nov 2026:** um MCP do escritório; `agent` é parâmetro. Chat/LLM no servidor fica para depois.

---

## 14. Recorte que eu (Cursor) faria no primeiro ciclo, se fecharmos as decisões

Fase 1 em execução, por etapas (parar e esperar “ok” entre elas):

1. ~~Prisma Postgres~~ **feito**
2. ~~Cópia de dados (sem anexos) + bucket~~ **feito**
3. ~~profiles + admin~~ **feito** (desligar signup no painel ainda é manual)
4. ~~Login + middleware~~ **feito**
5. ~~RLS~~ **feito**
6. ~~Checklist Vercel~~ **feito** — projeto `jaypcortex` no ar, env coladas (sem senha de usuário)

Edge Functions: zero. `kind`/tags, MCP, busca e embeddings: **feitos** (FTS sempre; vetor se houver `OPENAI_API_KEY`).

Depois (ainda não): Etapa 2 = LLM no agente (1 tarefa); Etapa 3 = Cortex orquestrando vários agentes. Edge Functions-roteador só se precisar (hoje o Next cobre). OAuth MCP **feito**.

---

## 15. Como o Amazon Quick deve usar este arquivo

> **7 nov 2026 — instruções abaixo substituem** “SQLite / profiles a construir / sem pgvector”.

- Banco **já é Postgres** no Supabase. SQLite (`dev.db`) é só backup — não escrever nele.
- Auth **já existe** (login fechado). Signup público **não**.
- MCP **já existe** na Vercel: um endpoint, todos os agentes. URL, OAuth (`client_id` / secret / token URL) e Bearer em `docs/mcp-conexao-quick.md`. Não inventar MCP por agente nem Edge Function por CRUD.
- Não gravar TipTap como Markdown no banco. Markdown só na borda MCP.
- pgvector + FTS **já existem**. Sem `OPENAI_API_KEY` a busca é só FTS.
- Preferir as tools MCP (propor → aplicar) a escrever no Postgres direto.
- Não assumir que o MCP chama o LLM do agente. Para qualquer pedido, chame **`cortex` primeiro**. `search_knowledge` não lista tarefas.

Se Quick e Cursor divergirem: **este markdown vence** até a gente editar a §13.
