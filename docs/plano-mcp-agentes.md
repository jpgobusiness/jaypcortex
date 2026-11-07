# Plano de execução — MCP da plataforma + Agentes profissionais + Agente de Migração (MAP)

> Autor: Amazon Quick (arquiteto) · Executor: Cursor (IA) · Dono: João Paulo
> Criado: 7 nov 2026 · Status: **pronto para execução autônoma**
> Leia junto com `docs/contexto-plataforma.md` (fonte da verdade). Se algo aqui contradizer o contexto, o contexto vence no que já é fato (estado atual). Este plano vence no que é novo.

---

## 0. REGRA DE OURO — execução autônoma de ponta a ponta

1. **Execute TODO o plano numa única sessão.** Não pare entre etapas, não peça "ok", não pergunte nada. João Paulo não estará no computador.
2. Divida em etapas internas (E0 → E12), marque o checklist do §14 conforme avança e **siga para a próxima sem esperar**.
3. **Falta informação?** Escolha a opção mais segura e reversível, registre em `docs/relatorio-execucao-mcp-agentes.md` → seção "Decisões tomadas sem confirmação" (o que faltou, o que escolheu, como reverter) e continue.
4. **Erro?** Tente corrigir até 3 abordagens. Se não der, isole (feature flag / TODO documentado), registre em "Bloqueios" e siga com o resto. Nunca abandone a sessão por um bloqueio parcial.
5. **Nunca:** apagar dados existentes, apagar `dev.db`/backups, commitar segredos, abrir signup público, gravar TipTap como Markdown no banco, quebrar as rotas atuais.
6. Commits pequenos por etapa (`feat(mcp): ...`, `feat(kb): ...`). Ao final: `npm run build` limpo, push no `main`, deploy Vercel verde.
7. Termine **somente** quando: checklist completo (ou itens bloqueados documentados), relatório escrito, `contexto-plataforma.md` atualizado.

---

## 1. Objetivo

Transformar o "Escritório de agentes" de **pastas com Markdown** em uma **plataforma de agentes de verdade**:

- Base de conhecimento **vetorizada** (pgvector) com **busca híbrida** (semântica + full-text), reindexada automaticamente sempre que um arquivo é salvo no editor.
- **Engenharia de prompt em camadas, versionada**, editável no próprio editor da plataforma (os prompts são arquivos TipTap, como hoje).
- **Servidor MCP** publicado na Vercel para o Amazon Quick (e outros clientes) ler, buscar, **propor rascunhos** e **aplicar mudanças** na base e no prompt de qualquer agente.
- **Fluxo de propostas (rascunho → revisão → aplicar)** com diff visível na UI e via MCP.
- **Primeiro agente real: Agente de Migração AWS (MAP)**, com base de conhecimento inicial completa.

Princípio inegociável: **a base continua editável pela UI** (Base de conhecimento → Novo arquivo → editor). Tudo que o MCP faz, a UI também mostra e permite editar.

---

## 2. Arquitetura alvo (visão)

```
Amazon Quick ──MCP (Streamable HTTP + Bearer)──► Vercel: /api/mcp  (Next.js, mesmo monólito)
                                                    │
UI (editor TipTap) ──► /api/workspaces/files/:id ───┤──► lib/knowledge/* (serviços únicos)
                                                    │        ├─ tiptap → texto plano
                                                    │        ├─ chunking por heading
                                                    │        ├─ embeddings (provider plugável)
                                                    │        └─ prompt composer
                                                    ▼
                                     Supabase Postgres (+ pgvector, FTS pt)
```

- **Zero Edge Function** (mantém a decisão §8 do contexto). MCP e indexação rodam no Next/Vercel.
- **Uma camada de serviço** (`lib/knowledge/`, `lib/agents/`, `lib/proposals/`) usada tanto pelas rotas REST da UI quanto pelas tools MCP. Nada de lógica duplicada.
- MCP **nunca** escreve direto no banco por fora dos serviços.

---

## 3. Banco (Supabase) — migrations novas em `prisma/migrations-postgres/`

Atualizar `prisma/schema.postgres.prisma` (e espelhar no `schema.prisma` SQLite **só** com campos simples, ou marcar como postgres-only — decisão: **postgres-only**; o SQLite é só backup). Vetores via `Unsupported("vector(1536)")` + SQL manual.

### 3.1 Extensões
```sql
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
```

### 3.2 `WorkspaceFile` — colunas novas
| Coluna | Tipo | Uso |
|---|---|---|
| `kind` | text default `'contexto'` | `contexto \| metodologia \| processo \| passo_a_passo \| template \| referencia \| prompt \| faq \| caso \| outro` |
| `tags` | text[] default `{}` | filtros |
| `searchText` | text default `''` | texto plano extraído do TipTap |
| `contentHash` | text | sha256 do `content`; evita reindexar sem mudança |
| `indexedAt` | timestamptz null | último índice |
| `indexStatus` | text default `'pending'` | `pending \| indexed \| error \| skipped` |
| `updatedBy` | uuid null → profiles | autor da última edição (UI ou MCP) |
| `source` | text default `'ui'` | `ui \| mcp \| seed` |

Índices: GIN em `to_tsvector('portuguese', unaccent(title || ' ' || searchText))` (coluna gerada `searchTsv`), GIN em `tags`, btree em `kind`.

### 3.3 `KnowledgeChunk` (vetores)
| Coluna | Tipo |
|---|---|
| `id` | text cuid |
| `fileId` | → WorkspaceFile (cascade) |
| `chunkIndex` | int |
| `headingPath` | text (ex.: "MAP > Assess > Entregáveis") |
| `content` | text |
| `tokenCount` | int |
| `embedding` | vector(1536) |
| `tsv` | tsvector gerada (portuguese) |
| `createdAt` | timestamptz |

Índices: HNSW `vector_cosine_ops` no `embedding`; GIN no `tsv`; unique (`fileId`,`chunkIndex`).

### 3.4 Agente profissional — colunas novas em `Agent`
| Coluna | Uso |
|---|---|
| `slug` text unique | id estável para MCP (`migracao-aws`) |
| `model` text default `'claude-sonnet'` | modelo preferido (informativo; plugável) |
| `temperature` float default 0.3 | |
| `status` text default `'draft'` | `draft \| active \| archived` |
| `activePromptVersionId` | → AgentPromptVersion |
| `retrievalConfig` jsonb | `{ topK: 8, minScore: 0.25, hybridWeight: 0.6, kinds: [] }` |
| `capabilities` jsonb | lista de skills/ferramentas do agente (texto livre estruturado) |

### 3.5 Engenharia de prompt em camadas
**Decisão:** cada camada é um `WorkspaceFile` com `kind='prompt'` dentro da pasta **`Prompt`** da sala do agente (editável no editor, como você quer). Uma tabela liga a camada ao papel dela:

`AgentPromptLayer`: `id`, `agentId`, `fileId` (→ WorkspaceFile), `layer` (`identidade | missao | regras | metodologia | formato_saida | exemplos | guardrails`), `order`, `enabled`.

`AgentPromptVersion` (snapshot imutável): `id`, `agentId`, `version` int, `composedPrompt` text (texto final), `layersSnapshot` jsonb (fileId, hash, texto de cada camada), `note`, `createdBy`, `source` (`ui|mcp`), `createdAt`. Unique (`agentId`,`version`).

Composer (`lib/agents/prompt-composer.ts`): junta camadas ativas por `order`, com cabeçalhos `## <layer>`, + bloco "Base de conhecimento disponível" (catálogo de títulos/kinds) + `instructions` legado do Agent (se não vazio, vira camada `regras` extra). "Publicar prompt" = cria nova `AgentPromptVersion` e aponta `activePromptVersionId`. Rollback = apontar versão anterior.

### 3.6 Propostas de mudança (rascunho do Quick)
`ChangeProposal`:
| Coluna | Uso |
|---|---|
| `id` | cuid |
| `agentId` | null ok |
| `targetType` | `file \| prompt_layer \| agent_config \| new_file` |
| `targetId` | fileId / layerId / agentId |
| `title`, `rationale` | o que e por quê |
| `baseHash` | hash do conteúdo quando o rascunho foi feito (detecta conflito) |
| `proposedContent` | jsonb TipTap (ou patch de config) |
| `proposedMeta` | jsonb (title, kind, tags, folder) |
| `diffText` | text unificado (texto plano antes × depois) para exibir |
| `status` | `pending \| applied \| rejected \| superseded \| conflict` |
| `createdBy`, `source` (`mcp|ui`), `appliedBy`, `appliedAt`, `createdAt` |

Aplicar: verifica `baseHash` == hash atual (senão `conflict`), grava pelo serviço normal (que reindexa), cria `FileRevision`, e se for camada de prompt **não publica automático** — gera nova versão só se `publish=true`.

### 3.7 Histórico de arquivos
`FileRevision`: `id`, `fileId`, `content` jsonb, `title`, `hash`, `createdBy`, `source`, `proposalId` null, `createdAt`. Toda gravação (UI ou MCP) cria revisão (dedupe por hash). Permite "restaurar versão".

### 3.8 Tokens MCP e auditoria
`McpToken`: `id`, `name`, `tokenHash` (sha256), `prefix` (8 chars visíveis), `scopes` text[] (`read`, `propose`, `write`, `admin`), `profileId` (dono), `lastUsedAt`, `expiresAt` null, `revokedAt`, `createdAt`. **Token em claro só aparece uma vez** na UI.

`AuditLog`: `id`, `actorId`, `actorType` (`user|mcp`), `tokenId`, `action`, `entity`, `entityId`, `meta` jsonb, `at`. Registrar: tool MCP de escrita, aplicar proposta, publicar prompt, criar/revogar token.

### 3.9 Funções SQL
- `match_knowledge(query_embedding vector, query_text text, agent_id text null, kinds text[] null, match_count int, hybrid_weight float)` → busca **híbrida** (RRF entre cosseno e `ts_rank`), filtrando por arquivos vinculados ao agente (`AgentKnowledge` **ou** arquivos da sala do agente). Retorna fileId, title, headingPath, content, score.
- `security definer` + `search_path` fixo.

### 3.10 RLS
Todas as tabelas novas com a mesma política das atuais (`authenticated` + `is_active_user()`); `McpToken` e `AuditLog`: leitura/escrita só `is_admin()`. Servidor usa service role/Prisma (bypassa) — MCP autentica pelo token **no servidor**.

### 3.11 Views
- `v_knowledge_catalog` (arquivo + espaço + pasta + kind + tags + agentes vinculados + indexStatus).
- `v_agent_overview` (agente + versão ativa do prompt + nº docs + nº chunks + propostas pendentes).

---

## 4. Embeddings e indexação

- **Provider plugável** `lib/knowledge/embeddings.ts`: interface `embed(texts[]) → number[][]`.
- **Padrão:** OpenAI `text-embedding-3-small` (1536 dims) via `OPENAI_API_KEY`.
- **Se a chave não existir:** não travar. `indexStatus='skipped'`, busca cai para **full-text only** (função híbrida aceita embedding nulo). Registrar no relatório: "falta `OPENAI_API_KEY` na Vercel e no `.env.local`".
- Alternativa documentada (não implementar agora): Amazon Bedrock Titan v2 / Supabase gte-small.
- **TipTap → texto:** `lib/knowledge/tiptap-text.ts` percorre o JSON (headings, parágrafos, listas, tabelas, code) preservando hierarquia de headings.
- **Chunking:** por seção de heading; alvo ~700 tokens, overlap ~80; `headingPath` em cada chunk; prefixar o chunk com `Título > headingPath` antes de embedar.
- **Quando indexar:** no `PATCH/POST` do arquivo (síncrono se < 30 chunks; senão marca `pending` e processa em `POST /api/knowledge/reindex` em lote). `contentHash` igual → pula.
- `npm run kb:reindex` (script) para reindexar tudo uma vez.
- Atualizar `excerpt` e `searchText` sempre juntos.

---

## 5. Servidor MCP

### 5.1 Transporte e local
- Rota **`app/api/mcp/[transport]/route.ts`** usando `mcp-handler` (Vercel) + `@modelcontextprotocol/sdk`, **Streamable HTTP** (SSE desligado se não necessário). URL final: `https://jaypcortex.vercel.app/api/mcp/mcp`.
  - Se `mcp-handler` não funcionar com Next 16, implementar com `StreamableHTTPServerTransport` do SDK em modo stateless. Registrar a escolha.
- `maxDuration` adequado (60s) no `vercel.json`/route.
- **Middleware:** liberar `/api/mcp/*` do login por cookie; a rota exige **`Authorization: Bearer <token>`** validado contra `McpToken` (hash). 401 sem token. Rate limit simples em memória por token (60 req/min).
- Também gerar `scripts/mcp-stdio.ts` (proxy stdio → HTTP) para uso local no Cursor/Claude Desktop. Opcional, baixo custo.

### 5.2 Tools (nomes estáveis, descrições em português, schemas zod)
**Leitura (`read`)**
| Tool | Faz |
|---|---|
| `list_agents` | agentes com slug, papel, status, versão do prompt, nº docs |
| `get_agent` | config completa + camadas do prompt + catálogo da base |
| `get_agent_prompt` | prompt composto ativo (e opcionalmente o rascunho atual não publicado) |
| `list_workspaces` / `list_documents` | filtros: workspaceId, folderId, agentId, kind, tags, q |
| `read_document` | título, kind, tags, **texto em Markdown** (conversão só de leitura), hash, updatedAt |
| `search_knowledge` | busca híbrida; params `query`, `agent` (slug/id), `kinds`, `top_k` → trechos com fonte |
| `list_proposals` / `get_proposal` | propostas com diff |
| `get_document_history` | revisões |

**Rascunho (`propose`)** — padrão para o Quick
| Tool | Faz |
|---|---|
| `propose_document_change` | recebe `file_id`, `markdown` novo (ou `operations`: append_section / replace_section por heading), `rationale` → gera TipTap, diff, cria `ChangeProposal` **pending**. Retorna id + diff + link da UI |
| `propose_new_document` | idem para arquivo novo (agente, pasta, kind, tags) |
| `propose_prompt_change` | por camada (`layer`) ou nova camada |
| `propose_agent_config` | model, temperature, retrievalConfig, capabilities, descrição |

**Escrita (`write`)**
| Tool | Faz |
|---|---|
| `apply_proposal` | aplica (checa conflito), reindexa, revisão, audit |
| `reject_proposal` | |
| `publish_prompt` | cria nova `AgentPromptVersion` |
| `create_document` / `update_document` | escrita direta (para quando João pedir "já aplica") — sempre gera revisão |
| `link_knowledge` / `unlink_knowledge` | vínculo agente ↔ arquivo |
| `create_agent` | cria agente + sala + pastas padrão (`Prompt`, `Base de conhecimento`, `Templates`, `Entregas`) + camadas vazias |
| `reindex_document` | |

**Conversão Markdown ↔ TipTap:** `lib/knowledge/markdown.ts` com `@tiptap/html` + `marked` (ou `prosemirror-markdown`) usando **as mesmas extensões do `FileEditor`**. O banco recebe **sempre TipTap válido** (`type: "doc"`). Teste de ida e volta.

### 5.3 Resources e prompts MCP (bônus barato)
- Resource `agent://{slug}/prompt` e `doc://{fileId}`.
- Prompt MCP `editar_base_agente` (guia o cliente: buscar → ler → propor → mostrar diff → aplicar após confirmação).

### 5.4 Fluxo que o Quick vai usar
1. João: "adiciona na base do agente de migração os incentivos do MAP para Windows".
2. Quick: `search_knowledge` → `read_document` → `propose_document_change` → mostra o diff para o João.
3. João: "aplica" → `apply_proposal`. Se for prompt: `publish_prompt`.
4. A UI mostra a proposta/alteração com autor `mcp` e histórico.

### 5.5 Conexão no Amazon Quick (documentar em `docs/mcp-conexao-quick.md`)
- Tipo: MCP, URL `https://jaypcortex.vercel.app/api/mcp/mcp`, auth **Bearer/API key** (header `Authorization`).
- Como gerar o token na UI (§6.3). Testar com `npx @modelcontextprotocol/inspector`.
- Se o Quick exigir OAuth: registrar como pendência e descrever o caminho (OAuth 2.1 com Supabase Auth como IdP / `withMcpAuth` do mcp-handler) — **não bloquear** a entrega por isso.

---

## 6. UI (Next) — mudanças

### 6.1 Escritório → painel do agente (Drawer existente)
Abas: **Visão geral** · **Prompt** · **Base de conhecimento** · **Propostas** · **Histórico** · **Testar**.
- **Prompt:** lista de camadas (arrastar ordem, ligar/desligar, abrir no editor), botão **Publicar nova versão**, lista de versões com rollback e visualização do prompt composto.
- **Base de conhecimento:** o fluxo atual continua (Novo arquivo → editor). Adicionar seletor de `kind`, tags, badge de `indexStatus`, botão reindexar.
- **Propostas:** inbox com contador, diff lado a lado (antes/depois, texto plano), botões Aplicar / Rejeitar, aviso de conflito.
- **Testar:** caixa de pergunta → roda `search_knowledge` e mostra os trechos recuperados + prompt composto (sem chamar LLM; se houver `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, opcional responder). Serve para validar a base.

### 6.2 Editor de arquivo
- Barra de metadados: kind, tags, "editado por (ui/mcp) em …", link "Histórico" (restaurar revisão).
- Banner quando houver proposta pendente para o arquivo.

### 6.3 Configurações → **Integrações / MCP** (só admin)
Criar token (nome, escopos, validade), mostrar uma vez, listar (prefixo, último uso), revogar. Mostrar URL do MCP e instrução de conexão.

### 6.4 Rotas REST novas (para a UI)
`/api/knowledge/search`, `/api/knowledge/reindex`, `/api/agents/:id/prompt` (GET composto, POST publish), `/api/agents/:id/prompt/layers`, `/api/agents/:id/prompt/versions`, `/api/proposals` (+ `/:id/apply`, `/:id/reject`), `/api/workspaces/files/:id/revisions`, `/api/mcp-tokens`.

---

## 7. Agente de Migração AWS (MAP) — primeiro agente

### 7.1 Identidade
- Nome: **Agente de Migração AWS** · slug `migracao-aws` · papel "Arquiteto de Migração MAP" · status `active`.
- Missão: apoiar João Paulo/Nuage IT em toda a jornada MAP (Assess → Mobilize → Migrate & Modernize): escopo, propostas, funding, estimativas, metodologia de execução da Nuage, templates e riscos.
- Criar via serviço `create_agent` (sala + pastas `Prompt`, `Base de conhecimento`, `Templates`, `Entregas`). Script idempotente `scripts/seed-agent-migracao.ts` (busca por slug; atualiza sem duplicar). Pode rodar com Prisma pelos serviços — é seed de dados nossos, não integração externa.

### 7.2 Camadas de prompt (arquivos `kind=prompt` na pasta Prompt)
1. **Identidade** — quem é, tom (português, objetivo, consultivo, técnico), público (arquitetos, comerciais, clientes C-level).
2. **Missão** — o que entrega: escopos de Assess, propostas, SOW, business case/TCO/ROI, plano de ondas, estratégia 7R, plano de funding.
3. **Regras** — sempre citar a fonte da base; números de funding são "referência, validar com o PDM/AWS e o programa vigente"; nunca inventar valores de cliente; marcar premissas; seguir o template de proposta da Nuage.
4. **Metodologia** — Assess em 3 frentes (Cloud/Infra, Aplicações, Dados), checkpoints quinzenais, Migration Evaluator 30 dias, 7R, ondas, sign-off para Mobilize.
5. **Formato de saída** — estruturas padrão: (a) resumo executivo, (b) escopo/entregáveis, (c) premissas e fora de escopo, (d) próximos passos; tabelas quando houver números.
6. **Guardrails** — não prometer funding aprovado; confidencialidade de dados de cliente; diferenciar fato × estimativa.

### 7.3 Base de conhecimento inicial (arquivos TipTap na pasta Base de conhecimento, vinculados via `AgentKnowledge`)
| # | Arquivo | kind | Conteúdo |
|---|---|---|---|
| 1 | MAP — Visão geral do programa | metodologia | o que é o AWS Migration Acceleration Program, 3 fases (Assess, Mobilize, Migrate & Modernize), objetivo de cada uma, papel do parceiro, papel do PDM/AM da AWS |
| 2 | Fase Assess | metodologia | objetivo, ferramentas (Migration Evaluator, AWS Transform assessments, Pricing Calculator, MRA), entregáveis (inventário 100%, 7R, rightsizing, TCO/ROI, business case, arquiteturas), duração típica 4–8 semanas, sign-off |
| 3 | Fase Mobilize | metodologia | landing zone/Control Tower, MRP (Migration Readiness Planning), CCoE, segurança/governança, pilotos, plano de ondas detalhado, capacitação, operating model |
| 4 | Fase Migrate & Modernize | metodologia | execução por ondas, fábrica de migração, MGN/DMS/DataSync/Transform, cutover, hypercare, otimização e modernização (containers, serverless, bancos gerenciados) |
| 5 | Incentivos e funding MAP | referencia | tipos de incentivo (funding de Assess para o parceiro, créditos/cash de Mobilize, créditos de Migrate atrelados a ARR incremental, POC credits, incentivos específicos: Windows/SQL, SAP, mainframe, storage, ISV), regras de elegibilidade, como maximizar (registrar oportunidade no ACE cedo, MAP tagging `map-migrated`, comprovar ARR, combinar programas), armadilhas. **Todos os valores marcados "validar no programa vigente"** |
| 6 | Como maximizar o funding (playbook Nuage) | processo | passo a passo: oportunidade no ACE → aprovação do Assess → isenção ao cliente (ex.: proposta HeroSpark R$ 124.713,55 isentos via MAP Assess) → plano de ARR → tagging → claim → Mobilize/Migrate |
| 7 | Como a Nuage executa o Assess (3 frentes) | processo | baseado em `proposal-assess-3-areas.md`: Cloud/Infra, Aplicações (agentes sobre repositórios), Dados (licenciamento BYOL × LI, modernização heterogênea), premissas, jornada D0→entrega |
| 8 | Caso Vero — Assess OCI/Azure → AWS | caso | baseado no kickoff interno da Vero + transcrições + `cenario-atual-vero.md`: contexto, atuação em 3 etapas da Nuage, orquestração, lições |
| 9 | Caso HeroSpark — Assess Magalu/Azion → AWS | caso | baseado em `referencia-base.md` |
| 10 | Estratégias 7R | referencia | definição, quando usar cada uma, sinais no inventário |
| 11 | Checklist de kickoff de Assess | passo_a_passo | partes, acessos, KPIs, regiões, compliance, NDA, cronograma |
| 12 | Glossário MAP | referencia | ARR, ACE, PDM, MRA, MRP, MGN, DMS, TCO, LZ, CCoE, BYOL, LI |

Templates (pasta **Templates**, `kind=template`): **Proposta Assess 3 frentes** (de `proposal-assess-3-areas.md`), **Proposta Assess só Cloud** (de `referencia-base.md` anonimizado), **E-mail de levantamento de informações**, **Business case/TCO (estrutura)**, **Plano de ondas (estrutura)**.

### 7.4 Fontes no Mac (ler e condensar — não colar dumps gigantes; resumir com fidelidade e citar o arquivo de origem no fim de cada documento)
- `/Users/jpgoncalves/Documents/kick-off-vero/[VERO] KICK OFF INTERNO - 10-07-2026-20261015220242.md` e `kick-off-vero.html` (**principal: atuação em 3 etapas e orquestração**)
- `/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/proposal-assess-3-areas.md` (template oficial)
- `/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/referencia-base.md` (HeroSpark)
- `/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/cenario-atual-vero.md`
- `/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/Vero_ Assessment de migração para AWS - 08-27-2026-*.md`
- `/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/Vero Internet & NUageIT - Migração Oracle para AWS - 08-25-2026-*.md`
- `/Users/jpgoncalves/Documents/vero-map-assess/gerar_planilha_sizing.py` e `gerar_planilha_de_para.py` (descrever como ferramentas internas de sizing/de-para, sem copiar código)
- Conteúdo público do MAP (docs AWS). Se não tiver acesso à web, usar conhecimento geral e marcar "validar".
- **Dados de cliente:** manter só o necessário para o caso; nada de credenciais, IPs ou nomes de pessoas além de papéis.

### 7.5 Pronto quando
- Agente aparece no escritório com sala, 6 camadas, ≥12 docs + 5 templates, todos `indexed` (ou `skipped` sem chave).
- Prompt v1 publicado.
- `search_knowledge("como maximizar funding do MAP", agent="migracao-aws")` retorna trechos dos docs 5/6.

---

## 8. Segurança
- Tokens só com hash; comparação em tempo constante; escopos verificados por tool.
- Service role só no servidor. Nada de chave em `NEXT_PUBLIC_*`.
- Limite de payload MCP (1 MB de markdown por chamada); `content` ≤ 5 MB.
- Toda escrita MCP → `AuditLog`.
- Sanitizar Markdown → TipTap (sem HTML arbitrário/scripts).

## 9. Variáveis de ambiente novas
| Nome | Onde | Obrigatória |
|---|---|---|
| `OPENAI_API_KEY` | server | não (sem ela, só FTS) |
| `EMBEDDINGS_PROVIDER` | server | default `openai` |
| `MCP_ENABLED` | server | default `true` |
| `MCP_BOOTSTRAP_TOKEN` | server, opcional | token inicial se a UI de tokens falhar |

Se a CLI da Vercel estiver logada (`.vercel/project.json` existe), usar `vercel env add`. Senão, listar no relatório o que o João precisa colar.

## 10. Testes mínimos
- Unit: tiptap→texto, markdown↔tiptap ida e volta, chunking, prompt composer, hash/conflito de proposta.
- Integração: criar arquivo → indexa → busca encontra; proposta → apply → revisão + reindex; token inválido → 401.
- `npx @modelcontextprotocol/inspector` contra local e produção: `list_agents`, `search_knowledge`, `propose_document_change`, `apply_proposal`.

## 11. Ordem de execução (etapas internas — NÃO parar entre elas)
- **E0** Ler `contexto-plataforma.md`, schema, `FileEditor`, rotas de workspaces/agents. Criar `docs/relatorio-execucao-mcp-agentes.md`.
- **E1** Migrations: extensões, colunas de WorkspaceFile, KnowledgeChunk, Agent, PromptLayer/Version, ChangeProposal, FileRevision, McpToken, AuditLog, funções, RLS, views. Aplicar no Supabase (`db:migrate:postgres`).
- **E2** `lib/knowledge`: tiptap-text, markdown↔tiptap, chunking, embeddings, indexer; plugar no save atual; script `kb:reindex`.
- **E3** Busca híbrida (`match_knowledge`) + `/api/knowledge/search`.
- **E4** Prompt em camadas: serviço, composer, versões, rotas.
- **E5** Propostas + revisões: serviço, diff, apply/reject, rotas.
- **E6** Tokens MCP + AuditLog + UI em Configurações.
- **E7** Servidor MCP com todas as tools, middleware, rate limit; teste local com inspector.
- **E8** UI: abas do agente (Prompt, Base, Propostas, Histórico, Testar), metadados no editor.
- **E9** Seed do Agente de Migração (camadas, base, templates, vínculos, prompt v1) + reindex.
- **E10** Testes + `npm run build` + lint.
- **E11** Commit/push → deploy Vercel → teste do MCP em produção → criar token "amazon-quick" (escopos read+propose+write). **Não colocar o token em claro em arquivo versionado**; deixar em `docs/.mcp-token-amazon-quick.local` (no `.gitignore`) para o João copiar.
- **E12** Atualizar `contexto-plataforma.md` (§0 estado atual, §3, §4, §8, §10, §13, "Últimas mudanças"), escrever `docs/mcp-conexao-quick.md`, finalizar relatório.

## 12. Decisões pré-tomadas (não perguntar)
| Tema | Decisão |
|---|---|
| Onde roda o MCP | Next na Vercel, rota `/api/mcp`, Streamable HTTP |
| Edge Functions | zero |
| Auth MCP | Bearer token com hash + escopos (OAuth fica para depois) |
| Embeddings | OpenAI text-embedding-3-small 1536; fallback FTS |
| Busca | híbrida RRF (vetor + FTS português) |
| Prompt | camadas = arquivos TipTap `kind=prompt` + versões publicadas |
| Escrita do Quick | padrão propor → aplicar; escrita direta disponível com escopo `write` |
| IDs | cuid em text (mantém §13 do contexto) |
| SQLite | não recebe as tabelas novas (postgres-only) |
| Idioma de conteúdo | português |

## 13. Entregáveis finais
1. Código + migrations no `main`, deploy verde.
2. `docs/relatorio-execucao-mcp-agentes.md`: o que foi feito, decisões sem confirmação, bloqueios, pendências do João (env vars, token, conectar no Quick), como testar.
3. `docs/mcp-conexao-quick.md`.
4. `docs/contexto-plataforma.md` atualizado (sem apagar decisões antigas; marcar substituídas).
5. Agente de Migração ativo com base indexada.

## 14. Checklist (marcar durante a execução)
- [ ] E0 leitura + relatório criado
- [ ] E1 migrations aplicadas
- [ ] E2 indexação
- [ ] E3 busca híbrida
- [ ] E4 prompt em camadas
- [ ] E5 propostas/revisões
- [ ] E6 tokens + audit
- [ ] E7 MCP
- [ ] E8 UI
- [ ] E9 agente de migração
- [ ] E10 testes/build
- [ ] E11 deploy + teste produção + token
- [ ] E12 docs atualizados

## Histórico
- 7 nov 2026 — plano criado pelo Amazon Quick.
