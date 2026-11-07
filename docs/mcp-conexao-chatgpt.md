# Conectar o ChatGPT (voz) no MCP da JayP Cortex

Caminho recomendado: **ChatGPT → MCP do Cortex direto** (não ChatGPT → Quick → Cortex). O Quick continua em paralelo. Os dois falam com o mesmo banco; `client_key` evita duplicar tarefa ditada.

URL MCP: **`https://jaypcortex.vercel.app/api/mcp`**

## OAuth (mesmo login da plataforma)

O conector do ChatGPT usa authorization code + PKCE. Redirects já na allowlist:

- `https://chatgpt.com/connector_platform_oauth_redirect`
- `https://chat.openai.com/connector_platform_oauth_redirect`

Discovery:

- `https://jaypcortex.vercel.app/.well-known/oauth-authorization-server`
- `https://jaypcortex.vercel.app/.well-known/oauth-protected-resource`
- `https://jaypcortex.vercel.app/.well-known/openid-configuration`

Dynamic Client Registration: `POST /api/mcp/oauth/register` (redirect precisa estar na allowlist, ou admin / `MCP_OAUTH_REGISTRATION_TOKEN`).

Escopos: `read` (briefing, lista) · `write` (criar/iniciar/concluir) · `admin` (purgar lixeira).

## Passo a passo no ChatGPT

1. Apps / conectores MCP → URL `https://jaypcortex.vercel.app/api/mcp`.
2. Autorizar com o login da JayP Cortex (o mesmo `/login`).
3. Vestir o agente: `get_agent_prompt` com slug `gestao-tempo` (Gestor de Atividades) + tools de atividade.
4. No ditado, a tool `create_activity` deve ir com `client_key` estável. Repetir o comando não duplica.

## Prompts MCP úteis

- `briefing_do_dia`
- `capturar_tarefas`

## Pendência

Validar o clique no app ChatGPT com o João na sessão (OAuth + voz). Não bloqueia o restante da plataforma.

## O que a plataforma não lê

Outlook/Graph: o ChatGPT (ou o Quick) lê a agenda e envia `busy_blocks` em `get_daily_briefing` / `plan_day`.
