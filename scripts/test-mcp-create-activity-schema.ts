/**
 * Confere o schema Quick-safe e cria/apaga uma tarefa de teste.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadToken(): { url: string; token: string } {
  const url = process.env.MCP_URL || "https://jaypcortex.vercel.app/api/mcp";
  if (process.env.MCP_TOKEN) return { url, token: process.env.MCP_TOKEN };
  const local = resolve("docs/.mcp-token-amazon-quick.local");
  if (!existsSync(local)) throw new Error("Informe MCP_TOKEN");
  const raw = readFileSync(local, "utf8");
  const token = /token["']?\s*[:=]\s*["']?(jpc_[A-Za-z0-9_-]+)/.exec(raw)?.[1];
  if (!token) throw new Error("token ausente");
  return { url, token };
}

async function rpc(url: string, token: string, method: string, params: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text);
}

async function main() {
  const { url, token } = loadToken();
  const listed = await rpc(url, token, "tools/list", {});
  const tool = (listed.result?.tools || []).find((t: { name: string }) => t.name === "create_activity");
  if (!tool) throw new Error("create_activity ausente");
  const add = tool.inputSchema?.properties?.add_to_queue;
  if (Array.isArray(add?.type) || add?.type !== "number") {
    throw new Error(`schema velho: ${JSON.stringify(add)}`);
  }
  const created = await rpc(url, token, "tools/call", {
    name: "create_activity",
    arguments: {
      title: "[TESTE MCP] Action Review schema",
      priority: "urgent",
      add_to_queue: 1,
      client_key: "teste-mcp-action-review-schema",
    },
  });
  const body = JSON.parse(created.result?.content?.[0]?.text || "{}");
  if (body.error) throw new Error(`create falhou: ${JSON.stringify(body)}`);
  const id = body.id;
  if (!id) throw new Error(`create sem id: ${JSON.stringify(body)}`);
  const deleted = await rpc(url, token, "tools/call", {
    name: "delete_activity",
    arguments: { id, confirm: true },
  });
  const delBody = JSON.parse(deleted.result?.content?.[0]?.text || "{}");
  if (delBody.error) throw new Error(`delete falhou: ${JSON.stringify(delBody)}`);
  console.log(JSON.stringify({
    add_to_queue: add,
    created: { id, title: body.title, queuePosition: body.queuePosition },
    deleted: true,
  }, null, 2));
  console.log("create_activity schema ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
