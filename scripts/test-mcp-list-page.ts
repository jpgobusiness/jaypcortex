/**
 * Confere que list_activities devolve total/truncated e padrão open.
 * Uso: MCP_URL=... MCP_TOKEN=jpc_... npx tsx scripts/test-mcp-list-page.ts
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

async function call(url: string, token: string, name: string, args: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  const json = JSON.parse(line ? line.slice(6) : text);
  if (json.error) throw new Error(`${name}: ${JSON.stringify(json.error)}`);
  const raw = json.result?.content?.[0]?.text || "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

async function main() {
  const { url, token } = loadToken();
  const page = await call(url, token, "list_activities", {});
  if (Array.isArray(page)) throw new Error("list_activities ainda devolve array cru");
  if (typeof page.total !== "number") throw new Error("sem total");
  if (typeof page.truncated !== "boolean") throw new Error("sem truncated");
  const counts = page.counts as { open?: number; done?: number; in_queue?: number } | undefined;
  if (!counts || typeof counts.open !== "number" || typeof counts.done !== "number") {
    throw new Error("sem counts.open/done");
  }
  const activities = (page.activities as { status?: { key?: string } | string }[]) || [];
  const pending = activities.filter((a) => {
    const st = typeof a.status === "object" ? a.status?.key : a.status;
    return st !== "done";
  });
  if (pending.length !== activities.length) {
    throw new Error(`padrão deveria ser só pendentes; veio ${activities.length - pending.length} done`);
  }
  if (counts.open !== page.total && page.status === "open") {
    throw new Error(`total ${page.total} != counts.open ${counts.open}`);
  }
  const all = await call(url, token, "list_activities", { status: "all", limit: 20 });
  if (all.truncated !== true && Number(all.total) > 20) {
    throw new Error("status=all com >20 deveria vir truncated");
  }
  console.log(JSON.stringify({
    default: { total: page.total, returned: page.returned, truncated: page.truncated, counts },
    all: { total: all.total, returned: all.returned, truncated: all.truncated },
  }, null, 2));
  console.log("list page ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
