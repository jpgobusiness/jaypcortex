# Contexto da plataforma JayP Cortex

> **Fonte da verdade** deste repositório. Cursor, Amazon Quick e qualquer agente leem e atualizam este arquivo.
> Depois de cada melhoria no produto, o **estado atual** precisa refletir o código — mesmo que o usuário não peça.
> Plano (Supabase, auth, edge) fica nas seções de discussão. Quando um item sair do papel, mover para o estado atual.

Última atualização: 7 nov 2026

## Últimas mudanças

- 7 nov 2026 — **Plano aprovado:** MCP na Vercel + base vetorizada (pgvector, busca híbrida) + prompt em camadas versionado + propostas de mudança + Agente de Migração AWS (MAP). Ver `docs/plano-mcp-agentes.md` (Cursor executa de ponta a ponta).
- 6 nov 2026 — Prisma na Vercel usa `sslmode=no-verify` (o `sslmode=require` do pooler quebrava TLS).
- 6 nov 2026 — App Prisma só Postgres no runtime (tipos `prisma-postgres`). Build da Vercel: Node 22.
- 6 nov 2026 — **Gestão de usuários** em `/usuarios`. Cadastro público bloqueado no banco (allowlist).
- 6 nov 2026 — **Corte local:** `DATABASE_PROVIDER=postgres`. `dev.db` fica só como backup.
- 6 nov 2026 — **Etapas 2–6:** dados copiados (sem anexos antigos); bucket; profiles + login + RLS.

---

## 0. Estado atual (fato, não plano)

| Item | Hoje |
|---|---|
| App | Next.js 16 (App Router) + React 19, local e na Vercel |
| Banco | **Postgres no Supabase** (pooler `aws-1-us-west-2`). Backup SQLite: `dev.db` + `backups/dev-2026-11-06.db` (não apagar). |
| Flag | `DATABASE_PROVIDER=postgres`. |
| ORM | Prisma 7 + `pg` Pool. Cliente postgres em `app/generated/prisma-postgres`. TLS do pooler: `sslmode=no-verify`. |
| Auth | **Login fechado** em `/login` (e-mail + senha, cookie httpOnly). Middleware protege páginas e `/api/*`. Logout no menu. |
| Signup | **Bloqueado.** Sem tela de cadastro. Trigger em `auth.users` recusa signup público; admin cria via allowlist. A flag `disable_signup` do painel ainda aparece `false` (a API de Auth não deixa a service role alterar). |
| Admin | `pjoao4446@gmail.com` em `auth.users` + `profiles.role=admin`. Senha **não** está no repo. |
| Supabase | `gzavuqgoxllbgfyyyrjv` (`us-west-2`). `public` com dados copiados (28 tabelas) + `profiles`. `OvertimeAttachment` = 0 linhas. |
| Hospedagem | **Vercel** em https://jaypcortex.vercel.app. GitHub `jpgobusiness/jaypcortex`. Node 22. |
| Edge Functions | Zero |
| Storage | Bucket privado `overtime-attachments` vazio. Anexos **novos** vão para o Storage. |

Conclusão: app no Postgres + login + gestão de usuários, publicado na Vercel.

---

## 1. O que a plataforma faz (módulos)

Tudo é de **um operador** (você). Não há multi-empresa nem “criar conta”.

### Pessoal
- **Controle diário** — hábitos dinâmicos + check por dia
- **Desafio** — hábitos/itens do mês, nota, treino, água, etc.

### Profissional
- **Atividades** — lista, kanban, **fila de execução** (primeira aba), mapa mental
- **Horas extras** — mês, lançamentos, anexos (imagem/PDF no banco)
- **Automações** — contatos (ex. WhatsApp)
- **Configurações** — tipos e status de atividade

### Conhecimento e agentes
- **Espaços de trabalho** — espaços → pastas (1 nível) → arquivos (páginas TipTap)
- **Escritório de agentes** — agentes 3D, cada um com “sala” (um Workspace) e pastas padrão: `Base de conhecimento`, `Templates`, `Entregas`
- **Base de conhecimento do agente** — **não copia** o documento; é um vínculo `AgentKnowledge` → `WorkspaceFile`

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
- Não deixar `/api/*` sem sessão depois do go-live

---

## 3. Tabelas: o que já existe (migrar do Prisma/SQLite)

**Decidido:** nomes 1:1 com o SQLite (tabelas Prisma `"Stage"`, `"Activity"`, …). IDs `text` + cuid. Sem uuid nesta migração.

### Comercial / pipeline
- `stages` — funil
- `commercials` — vendedores
- `opportunities` — negócios
- `quarter_goals` — meta por ano+quarter

### Atividades
- `activity_statuses` — pendente / em andamento / concluída (configurável)
- `activity_types`
- `activities` — inclui `queue_order` (fila)
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
- `workspace_files` — `content` = JSON TipTap (`type: "doc"`), `excerpt` texto curto
- `agents`
- `agent_knowledge` — N:N agente ↔ arquivo

**Não existem hoje (e o Quick precisa saber):**
- tags
- tipo de documento (`contexto`, `passo a passo`, `template`, `processo`, `metodologia`)
- autor do arquivo
- embeddings

---

## 4. Tabelas / colunas novas (proposta, para discutir)

Prioridade: **o mínimo para publicar com login**. O resto é fase 2.

### Fase 1 — publicar
- `profiles` (acima)
- `audit_log` (opcional mas barato): `id`, `actor_id`, `action`, `entity`, `entity_id`, `at` — login, create user, delete file
- `workspace_files.updated_by` uuid? → `profiles.id` (quem editou)

### Fase 2 — conhecimento “de verdade” (Quick / MCP)
- `document_kinds` ou coluna `workspace_files.kind`  
  enum: `contexto | passo_a_passo | template | processo | metodologia | outro`
- `workspace_file_tags` (`file_id`, `tag`) **ou** `tags[]` no arquivo
- `workspace_files.search_text` — texto plano extraído do TipTap (para `ILIKE` / FTS sem embedding)
- Só **depois**, se a busca semântica for necessária:  
  `document_embeddings` (`file_id`, `chunk_index`, `embedding vector`, `chunk_text`) + extensão `pgvector`

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
| `v_knowledge_catalog` | arquivo + espaço + pasta + agentes vinculados + excerpt |
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
`anon` sem grant. Service role (servidor) **bypassa RLS**.

---

## 8. Edge Functions — economizar o limite (100 no free)

### Princípio
O Next.js **já é o monólito de API** (`app/api/**`, ~46 rotas). Subir isso para Vercel (ou similar) **não gasta** cota de Edge Function do Supabase.

**Dia 1: 0 Edge Functions.** Auth + CRUD no Next, apontando Prisma para o Postgres.

### Quando criar (aos poucos)

| # | Nome | Agrupa várias coisas | Quando |
|---|---|---|---|
| 1 | `admin` | criar/desativar usuário, reset de senha (proxy da Auth Admin) | gestão de usuários |
| 2 | `knowledge` | listar / buscar (texto) / ler / escrever documento + anexar a agente | MCP / Quick |
| 3 | `search` | FTS + (futuro) embedding; um único endpoint `q` + `mode` | se a busca ficar pesada |
| 4 | `agents` | orquestrador + chat; um `action` no body | escritório com IA ligada |
| 5 | `jobs` | cron: excerpt, reindex, limpeza | se precisar de background |

Meta: **ficar em 5–8**, não 40. Cada função é um **roteador** (`{ "action": "list_documents", ... }`), não um deploy por verbo.

O que **não** vira Edge Function: CRUD de atividade, desafio, horas extras, kanban — isso fica no Next.

---

## 9. Auth no app Next (além do banco)

**Feito.**

- `/login`: e-mail + senha, sem cadastro
- Cookie httpOnly (Supabase SSR)
- Middleware: tudo exige sessão, exceto `/login`, `/offline`, estáticos, `POST /api/auth/login`
- `/usuarios`: esqueleto, só `admin`
- Logout: botão Sair na sidebar + em `/usuarios`

Painel Auth (`disable_signup`) ainda pode aparecer ligado: a service role **não consegue** mudar essa flag. O trigger + a ausência de tela de cadastro bloqueiam o signup mesmo assim. Desligar no painel é opcional, redundante.

---

## 10. Base de conhecimento + Quick / MCP

Lembrete para o Quick:

- Fonte da verdade: `workspace_files.content` (JSON TipTap)
- “Base do agente” = `agent_knowledge`
- Sem tag, sem kind, sem vetor
- API HTTP local hoje: `GET/POST /api/workspaces`, `GET/PATCH /api/workspaces/files/:id`, `GET/POST /api/agents/:id/knowledge`
- Sem auth hoje → **depois** o MCP precisa de um token de serviço ou da sessão do admin

Plano MCP (não implementar neste documento): stdio TypeScript → HTTP da plataforma (não `INSERT` no SQLite). Busca semântica, se existir, nasce no Postgres (`pgvector`) ou no MCP, **não** como 20 Edge Functions.

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

Não colocar senha. `DATABASE_URL` na Vercel pode ser a mesma do pooler se o Prisma usar `POSTGRES_POOLER_URL`.

Build faz `DATABASE_PROVIDER=postgres prisma generate && next build`. Root Directory = repo. Node 22. Depois do primeiro deploy: `npm run db:migrate:postgres` não precisa se o schema já está no ar; só se houver migration nova.

No painel Auth do Supabase, Site URL / Redirect URLs devem incluir `https://jaypcortex.vercel.app`.

---

## 13. Decisões abertas (para discutir antes de criar tabela)

1. ~~**IDs:** cuid ou uuid?~~ **Decidido: cuid em `text`**, cópia 1:1.
2. **Members:** veem o mesmo mundo que o admin, ou cada um tem espaços próprios?
3. **`kind` + tags** no arquivo já na Fase 1, ou só quando o Quick/MCP precisar?
4. ~~**Anexos de hora extra:**~~ **Decidido: Storage para os novos.** Anexos antigos do SQLite **não sobem**.
5. ~~**Edge Functions no dia 1:**~~ **Decidido: zero.** Auth e CRUD no Next.
6. ~~**Onde roda o Next:**~~ **Decidido: Vercel.** Prisma usa o pooler do Supabase.
7. ~~**Admin:**~~ **Decidido:** e-mail `pjoao4446@gmail.com` (`ADMIN_EMAIL`). Senha só no painel Auth / cofre — nunca em código, seed, commit ou log. Signup público off.

---

## 14. Recorte que eu (Cursor) faria no primeiro ciclo, se fecharmos as decisões

Fase 1 em execução, por etapas (parar e esperar “ok” entre elas):

1. ~~Prisma Postgres~~ **feito**
2. ~~Cópia de dados (sem anexos) + bucket~~ **feito**
3. ~~profiles + admin~~ **feito** (desligar signup no painel ainda é manual)
4. ~~Login + middleware~~ **feito**
5. ~~RLS~~ **feito**
6. ~~Checklist Vercel~~ **feito** — projeto `jaypcortex` no ar, env coladas (sem senha de usuário)

Edge Functions: zero. `kind`/tags: só se o Quick precisar.

Depois: gestão de usuários, MCP, busca, embeddings, 3–5 Edge Functions-roteador.

---

## 15. Como o Amazon Quick deve usar este arquivo

- Tratar as tabelas da §3 como **já existentes no produto** (ainda no SQLite)
- Tratar `profiles` / Auth como **a construir**
- Não sugerir signup público
- Não sugerir uma Edge Function por CRUD
- Não gravar TipTap como Markdown no banco
- Não assumir pgvector até a Fase 2
- Preferir a API Next autenticada a escrever no Postgres direto

Se Quick e Cursor divergirem: **este markdown vence** até a gente editar a §13.
