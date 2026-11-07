/**
 * Regressão: get_agent, list_documents, get_agent_prompt, search_knowledge
 * para TODOS os agentes. Não grava dados.
 *
 * Uso: MCP_URL=... MCP_TOKEN=jpc_... npx tsx scripts/test-mcp-knowledge-regression.ts
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadToken(): { url: string; token: string } {
  const url = process.env.MCP_URL || "https://jaypcortex.vercel.app/api/mcp";
  if (process.env.MCP_TOKEN) return { url, token: process.env.MCP_TOKEN };
  const local = resolve("docs/.mcp-token-amazon-quick.local");
  if (existsSync(local)) {
    const raw = readFileSync(local, "utf8");
    const token = /token["']?\s*[:=]\s*["']?(jpc_[A-Za-z0-9_-]+)/.exec(raw)?.[1]
      || /jpc_[A-Za-z0-9_-]+/.exec(raw)?.[0];
    if (token) return { url, token };
  }
  throw new Error("Informe MCP_TOKEN ou docs/.mcp-token-amazon-quick.local");
}

async function call(url: string, token: string, method: string, params: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const status = res.status;
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  let json: { error?: unknown; result?: unknown } = {};
  try {
    json = JSON.parse(dataLine ? dataLine.slice(6) : text);
  } catch {
    return { status, httpError: text.slice(0, 400) };
  }
  return { status, ...json };
}

function parseTool(result: unknown) {
  const r = result as { content?: { text?: string }[]; isError?: boolean } | undefined;
  const raw = r?.content?.[0]?.text || "";
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  return { isError: Boolean(r?.isError), rawLen: raw.length, parsed, rawHead: raw.slice(0, 180) };
}

async function main() {
  const { url, token } = loadToken();
  const listed = await call(url, token, "tools/list", {});
  if (listed.error || listed.httpError) {
    console.error("tools/list falhou", listed);
    process.exit(1);
  }
  const agentsRes = await call(url, token, "tools/call", { name: "list_agents", arguments: {} });
  const agentsParsed = parseTool(agentsRes.result);
  const agents = Array.isArray(agentsParsed.parsed)
    ? agentsParsed.parsed
    : Array.isArray((agentsParsed.parsed as { length?: unknown } | null))
      ? (agentsParsed.parsed as unknown as Record<string, unknown>[])
      : [];
  if (!Array.isArray(agentsParsed.parsed)) {
    console.error("list_agents inesperado", agentsRes.status, agentsParsed.rawHead);
    process.exit(1);
  }
  const rows = agentsParsed.parsed as { slug?: string; name?: string; id?: string }[];
  console.log("agentes", rows.map((a) => a.slug || a.id).join(", "));

  const tools = ["get_agent", "list_documents", "get_agent_prompt", "search_knowledge"] as const;
  let failed = 0;
  for (const agent of rows) {
    const key = agent.slug || agent.id || agent.name || "";
    for (const tool of tools) {
      const args =
        tool === "search_knowledge"
          ? { query: "metodologia", agent: key, top_k: 3 }
          : tool === "list_documents"
            ? { agent: key }
            : { agent: key };
      const res = await call(url, token, "tools/call", { name: tool, arguments: args });
      const parsed = parseTool(res.result);
      const err =
        res.status >= 500
        || Boolean(res.httpError)
        || Boolean(res.error)
        || parsed.isError
        || Boolean(parsed.parsed?.error);
      if (err) {
        failed += 1;
        console.error("FAIL", tool, key, res.status, res.error || res.httpError || parsed.parsed?.error || parsed.rawHead);
      } else {
        const extra =
          tool === "list_documents" && Array.isArray(parsed.parsed)
            ? `n=${parsed.parsed.length}`
            : `bytes=${parsed.rawLen}`;
        console.log("ok", tool, key, extra);
      }
    }
  }
  if (failed) {
    console.error(`falhas=${failed}`);
    process.exit(1);
  }
  console.log("regressão conhecimento ok", rows.length, "agentes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
