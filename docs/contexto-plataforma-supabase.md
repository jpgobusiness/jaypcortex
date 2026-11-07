# Contexto da plataforma JayP Cortex → Supabase (discussão)

> **Fonte da verdade do estado atual:** [`docs/contexto-plataforma.md`](./contexto-plataforma.md).
> Este arquivo é o plano de discussão (auth, tabelas, edge). Se os dois divergirem, vale o arquivo principal.

Última leitura do código: 6 nov 2026.

---

## 0. Estado atual (fato, não plano)

| Item | Hoje |
|---|---|
| App | Next.js 16 (App Router) + React 19, `npm run dev` na máquina |
| Banco | **SQLite** em `…/nuage-controle-da-estrutura/dev.db` (~233 MB) |
| ORM | Prisma 7 + adapter `better-sqlite3` |
| Auth | **Nenhuma.** Qualquer um que acesse `localhost:3000` lê e grava via `/api/*` |
| Signup | Não existe (e não deve existir na versão publicada) |
| Supabase | Projeto `gzavuqgoxllbgfyyyrjv` no ar; schema `public` **vazio** |
| Chaves no `.env` | URL, publishable key, secret key, senha do Postgres |
| Cliente Supabase no código | Pacotes instalados, **zero import** no app |
| Embeddings / pgvector | Não existem |
| MCP | Não existe |
| Edge Functions | Zero |
| Storage de arquivos | Anexos de hora extra estão **dentro do SQLite** (`BYTEA` / `Bytes`) |

Conclusão: o produto é um **monólito Next + SQLite local**. Publicar = Postgres + login fechado + RLS. Edge Function não é pré-requisito para o dia 1.

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

Nomes em **snake_case** no Postgres (Prisma pode mapear). IDs hoje são `cuid` string; no Supabase o padrão é `uuid`. **Decisão:** manter `text` + cuid na migração (menos risco) **ou** gerar uuid novos e quebrar FKs. Recomendação para o primeiro corte: **manter `text` (cuid)** como no SQLite, para o dump copiar 1:1.

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
- `overtime_attachments` — **hoje `data Bytes` no SQLite**. No Postgres isso explode. Ver §6 Storage.

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

`overtime_attachments.data` no SQLite é blob. No Supabase:

- Bucket `overtime-attachments` (privado)
- Tabela só com `path`, `name`, `mime_type`, `size`
- RLS: autenticado lê/escreve

Documentos TipTap **continuam no Postgres** (`content text/jsonb`). Não são arquivos no Storage.

---

## 7. RLS (Row Level Security)

Sem RLS, a publishable key (quando funcionar) lê o banco. Com signup off + só admin, política inicial pode ser **dura e simples**:

```
authenticated AND exists (
  select 1 from profiles p
  where p.id = auth.uid() and p.active = true
)
```

Em **todas** as tabelas de negócio.  
`profiles`: o próprio usuário lê a si; **só admin** faz insert/update de outros.

Service role (servidor Next / Admin API) **bypassa RLS** — por isso nunca vai para o browser.

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

- Middleware: rotas `/api/*` e páginas (exceto `/login`) exigem sessão
- Cookie httpOnly da sessão Supabase
- Página `/usuarios` só `admin`
- Logout limpa sessão

Isso é o que torna a plataforma **publicável**. Migrar tabela sem isso = SQLite na nuvem, ainda aberto.

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

1. Ligar Prisma a um `DATABASE_URL` **de staging** (connection string do Supabase, schema ainda vazio)
2. `prisma migrate` no Postgres (tipos: Boolean, Float, DateTime; `Bytes` dos anexos **não** copiar de cara)
3. Script de dump SQLite → Postgres (cuid iguais)
4. Anexos: script para Storage
5. Seed do **admin** no Auth + `profiles`
6. App local ainda no SQLite até o corte; feature flag `DATABASE_PROVIDER`
7. Ligar RLS **depois** dos dados (senão o seed quebra)
8. Só então Auth no Next

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
- **Chave publishable vs anon:** a `sb_publishable_…` atual toma 401 no REST; no go-live validar a chave **anon** clássica `eyJ...` do painel, ou usar só o servidor com secret

---

## 13. Decisões abertas (para discutir antes de criar tabela)

1. **IDs:** manter cuid (`text`) ou passar tudo para `uuid`?
2. **Members:** veem o mesmo mundo que o admin, ou cada um tem espaços próprios?
3. **`kind` + tags** no arquivo já na Fase 1, ou só quando o Quick/MCP precisar?
4. **Anexos de hora extra:** Storage já na primeira migração (recomendado) ou BYTEA no Postgres (não recomendado)?
5. **Edge Functions no dia 1:** zero (recomendado) ou já criar `admin` + `knowledge`?
6. **Onde roda o Next:** Vercel, Fly, VPS? (define cookie, env, e se o Prisma no server é viável — é)
7. **Um admin só no começo:** e-mail/senha definitivos — quem guarda o cofre da senha?

---

## 14. Recorte que eu (Cursor) faria no primeiro ciclo, se fecharmos as decisões

Não fazer “tudo”. Fazer:

1. `profiles` + Auth signup off + um admin
2. Login no Next, APIs atrás de sessão
3. Prisma → Postgres (tabelas atuais 1:1)
4. Storage para anexos
5. RLS “qualquer `authenticated` ativo lê/escreve o mundo único”
6. Zero Edge Function
7. Documento `kind`/tags **só** se o Quick precisar já na conexão

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
