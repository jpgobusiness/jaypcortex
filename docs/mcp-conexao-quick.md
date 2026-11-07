# Conectar o Amazon Quick (e o Cursor) no MCP da JayP Cortex

URL de produção: **`https://jaypcortex.vercel.app/api/mcp`**  
Alias: `https://jaypcortex.vercel.app/api/mcp/mcp`

Credenciais em claro: **`docs/.mcp-oauth-amazon-quick.local`** (gitignored). Não commitar.

O MCP aceita Bearer estático `jpc_…`, access token OAuth de **serviço a serviço**, ou access token OAuth de **usuário** (authorization code + PKCE). Sem token: **401** com `WWW-Authenticate`.

Discovery:

- `https://jaypcortex.vercel.app/.well-known/oauth-authorization-server`
- `https://jaypcortex.vercel.app/.well-known/oauth-protected-resource`
- `https://jaypcortex.vercel.app/.well-known/openid-configuration` (mesmo metadata; o Quick Java pede este)

---

## Opção A — Autenticação do serviço (OAuth serviço a serviço)

No Quick: **Autenticação do serviço → OAuth de serviço a serviço**.

| Campo no Quick | Valor no arquivo `.local` |
|---|---|
| URL MCP | `mcp_url` → `https://jaypcortex.vercel.app/api/mcp` |
| ID do cliente | `client_id` (24 chars, só A–Z a–z 0–9) |
| Segredo do cliente | `client_secret` (40 chars, só A–Z a–z 0–9) |
| URL do token | `token_url` → `https://jaypcortex.vercel.app/api/mcp/oauth/token` |

O token endpoint aceita `grant_type=client_credentials` (se omitir, assume este). Credenciais em **HTTP Basic** ou no corpo (form **ou** JSON). Params `resource`, `audience` e outros desconhecidos são ignorados. `scope` é opcional.

Resposta: `{ access_token, token_type: "Bearer", expires_in: 3600, scope }`.

---

## Opção B — Autenticação do usuário (OAuth authorization code + PKCE)

No Quick: **Autenticação do usuário**. Use o cliente `amazon-quick-user` (`user_client_id` / `user_client_secret` no `.local`). `public client = false`.

| Campo no Quick | Valor |
|---|---|
| URL MCP | `mcp_url` |
| ID do cliente | `user_client_id` |
| Segredo do cliente | `user_client_secret` |
| URL de autorização | `authorization_url` → `https://jaypcortex.vercel.app/api/mcp/oauth/authorize` |
| URL do token | `token_url` |
| Escopos | `read propose write` |

Fluxo: Quick abre a URL de autorização → se não estiver logado, `/login?next=…` → tela **Autorizar Amazon Quick a acessar a JayP Cortex** → Autorizar gera `code` (10 min, hash no banco, PKCE S256) → token (access 1 h + refresh 30 dias). Writes MCP usam o **profile do usuário** que autorizou.

Redirect URIs aceitas por padrão: `https://*.quicksight.aws.amazon.com/*`, `https://*.quicksight.aws/*`, `https://chatgpt.com/connector_platform_oauth_redirect`, `https://chat.openai.com/connector_platform_oauth_redirect`. Extra via env `MCP_OAUTH_REDIRECT_URIS`. Toda `redirect_uri` recebida vai para o `AuditLog`.

Dynamic Client Registration (RFC 7591): `POST /api/mcp/oauth/register` — só com `redirect_uris` na allowlist (QuickSight/ChatGPT) ou admin logado / `MCP_OAUTH_REGISTRATION_TOKEN`.

ChatGPT (voz) → MCP direto: `docs/mcp-conexao-chatgpt.md`.

---

## Gerar / rotacionar clientes

```bash
npm run mcp:oauth-client
```

Isso **revoga** os clientes anteriores e grava ID/secret novos (alfanuméricos) no `.local`.

---

## Token estático (Cursor / scripts)

Na UI: **Configurações → Tokens MCP**. Ou `npm run mcp:token` → `docs/.mcp-token-amazon-quick.local`.

```bash
MCP_URL=https://jaypcortex.vercel.app/api/mcp MCP_TOKEN=jpc_... npx tsx scripts/mcp-stdio.ts
```

---

## Porta de entrada: `cortex`

O cliente (Quick) é quem pensa. **Chame `cortex` primeiro** em qualquer pedido (tarefas, agenda, MAP, metodologia, agentes). A tool devolve o agente, o prompt, trechos da base, dados vivos e `suggested_tools` para executar em seguida.

`search_knowledge` / `read_document` / `list_documents` são **só a base de conhecimento**. Não contêm tarefas. Tarefas = `list_activities` / `search_activities` / `get_daily_briefing` (ou o que `cortex` sugerir).

Prompt MCP: `cortex_start`.

Fluxo:

1. `cortex` com o pedido (e `busy_blocks` se houver agenda).
2. Responder vestindo `agent_prompt`.
3. Executar `suggested_tools` em ordem.
4. Confirmar com o usuário as que tiverem `requires_confirmation`.
5. Resposta curta, pronta para voz.

## Após deploy com tools novas: habilitar as tools no conector do Quick

O conector do Quick **guarda a lista de tools no momento em que foi criado**. Deploy na Vercel **não** atualiza nem habilita tools novas sozinho.

Depois de um deploy que adiciona tools (`cortex`, `apply_day_plan`, atividades, etc.):

1. **Customize → Connectors → JayPCortexChat → permissões.** Habilite as tools novas (e as que o Quick tenha desligado).
2. Se a lista estiver velha (~23 de conhecimento, sem `cortex` / `list_activities`): atualize/recarregue as tools ou recrie o conector com a mesma URL `https://jaypcortex.vercel.app/api/mcp` e o mesmo OAuth.
3. Confira `cortex`, `list_activities`, `get_daily_briefing`, `apply_day_plan`.
4. Teste: “lista minhas atividades” deve chamar `cortex` (ou `list_activities`), **nunca** `search_knowledge`.

Sem este passo, o Quick continua caindo na base de conhecimento e ignorando as tools novas.

Toda tool do MCP declara `title` em PT-BR e `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`). `plan_day` é só leitura; para gravar o plano use `apply_day_plan` (`plan_day` com `apply=true` ainda funciona por compatibilidade).

O Quick pede **Action Review** em escritas. Leitura (`readOnlyHint` + `destructiveHint: false`) não deve pedir review. Se aparecer “Requesting Action Review” **sem botão** (mesmo em “lista” / “exemplos”), o schema que o conector cacheou é incompatível com o formulário Java: `$schema` 2020-12, `type: ["boolean","number"]`, ou objeto aninhado (`busy_blocks`). O MCP agora devolve Draft 7 (sem `$schema`), `busy_blocks` como string JSON, e `add_to_queue` como número. **Depois deste deploy: Sync de novo** em Customize → Connectors → JayPCortexChat. Sem o Sync, o Quick continua com o schema velho e trava.

`list_activities` **não devolve um array cru**. Padrão = pendentes (`status=open`). A resposta tem `activities`, `total`, `truncated`, `counts` (`open` / `done` / `in_queue`) e `note`. O cliente **não** deve tratar `activities.length` como o universo — se `truncated=true`, há mais. Para concluídas: `status=done`. Para tudo: `status=all`. `get_queue` devolve a fila completa (`queue` + `total`); fila ≠ total de pendentes.

## Escopos

| Escopo | Tools |
|---|---|
| `read` | `cortex`, `get_agent_context`, `list_agent_tools`; list/get agents, documents, search, proposals, history; **atividades** (list/get/search/queue/statuses/types); `get_daily_briefing`, `get_weekly_review`, `plan_day`, `get_activity_history` |
| `propose` | propose_* |
| `write` | apply/reject, create/update document, publish_prompt, link/unlink, create_agent, reindex; **atividades** (criar/editar/iniciar/pausar/concluir/fila/lembretes/undo); `apply_day_plan` (e `plan_day` com `apply=true`, compat) |
| `admin` | todos, inclusive `purge_deleted_activities` |

Rate limit: 60 req/min por token.

## O que o MCP **não** faz

- Não grava Markdown no banco (converte para TipTap `type: "doc"`).
- Não abre signup, não apaga `dev.db`, não cria Edge Function.
- Sem `OPENAI_API_KEY`: busca só FTS.
- Sem `ask_agent` / chat com LLM no servidor. Roteamento Cortex é determinístico.
