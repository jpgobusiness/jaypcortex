/**
 * Confere tools/list: toda tool tem annotations + title PT-BR.
 * Uso: MCP_URL=... MCP_TOKEN=jpc_... npx tsx scripts/test-mcp-annotations.ts
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

const READ_ONLY = new Set([
  "cortex", "get_agent_context", "list_agent_tools",
  "list_agents", "list_workspaces", "list_documents", "list_proposals",
  "list_activities", "list_activity_statuses", "list_activity_types",
  "get_agent", "get_agent_prompt", "get_proposal", "get_document_history",
  "get_activity", "get_queue", "get_daily_briefing", "get_weekly_review",
  "get_activity_history", "read_document", "search_knowledge", "search_activities",
  "plan_day",
]);

const DESTRUCTIVE = new Set([
  "delete_activity", "purge_deleted_activities", "unlink_knowledge",
  "reject_proposal", "undo_last_action",
]);

async function main() {
  const { url, token } = loadToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/list", params: {} }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  const json = JSON.parse(line ? line.slice(6) : text);
  const tools: {
    name: string;
    title?: string;
    annotations?: {
      title?: string;
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
    };
  }[] = json.result?.tools || [];
  if (!tools.length) throw new Error("tools/list vazio");

  const missing: string[] = [];
  const badRead: string[] = [];
  const badDest: string[] = [];
  for (const tool of tools) {
    const ann = tool.annotations || {};
    const title = tool.title || ann.title;
    if (!title) missing.push(`${tool.name}:sem-title`);
    if (!tool.annotations) missing.push(`${tool.name}:sem-annotations`);
    if (READ_ONLY.has(tool.name) && ann.readOnlyHint !== true) badRead.push(tool.name);
    if (DESTRUCTIVE.has(tool.name) && ann.destructiveHint !== true) badDest.push(tool.name);
    if (DESTRUCTIVE.has(tool.name) && ann.readOnlyHint === true) badDest.push(`${tool.name}:readonly`);
  }

  const names = new Set(tools.map((t) => t.name));
  if (!names.has("apply_day_plan")) missing.push("apply_day_plan ausente");
  if (!names.has("plan_day")) missing.push("plan_day ausente");

  console.log(JSON.stringify({
    n: tools.length,
    sample: tools.filter((t) => ["cortex", "plan_day", "apply_day_plan", "delete_activity", "list_activities"].includes(t.name))
      .map((t) => ({ name: t.name, title: t.title || t.annotations?.title, a: t.annotations })),
  }, null, 2));

  if (missing.length || badRead.length || badDest.length) {
    throw new Error(JSON.stringify({ missing, badRead, badDest }, null, 2));
  }
  console.log("annotations ok", tools.length, "tools");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
