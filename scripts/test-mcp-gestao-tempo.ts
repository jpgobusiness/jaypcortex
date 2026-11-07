/**
 * Teste de produção das tools de atividade. Cria [TESTE MCP] ..., conclui, lixeira, purga.
 * Uso: MCP_URL=... MCP_TOKEN=jpc_... npx tsx scripts/test-mcp-gestao-tempo.ts
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
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  const json = JSON.parse(dataLine ? dataLine.slice(6) : text);
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

function parseToolText(result: { content?: { text?: string }[] }) {
  const raw = result.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function main() {
  const { url, token } = loadToken();
  const listed = await call(url, token, "tools/list", {});
  const names: string[] = (listed.tools || []).map((t: { name: string }) => t.name);
  const needed = ["list_activities", "create_activity", "get_daily_briefing", "complete_activity", "delete_activity", "purge_deleted_activities"];
  const missing = needed.filter((n) => !names.includes(n));
  if (missing.length) throw new Error(`Tools faltando: ${missing.join(", ")}`);
  console.log("tools", names.filter((n) => n.includes("activ") || n.includes("brief") || n.includes("plan") || n.includes("queue") || n.includes("undo") || n.includes("remind")).length);

  const briefing = parseToolText(await call(url, token, "tools/call", { name: "get_daily_briefing", arguments: {} }));
  console.log("briefing", briefing.date, briefing.top3?.length ?? 0, briefing.alerts?.length ?? 0);

  const key = `teste-mcp-${Date.now()}`;
  const created = parseToolText(await call(url, token, "tools/call", {
    name: "create_activity",
    arguments: { title: "[TESTE MCP] briefing e lixeira", priority: "low", due: "hoje", client_key: key, source: "mcp" },
  }));
  const id = created.id;
  if (!id) throw new Error(`create falhou: ${JSON.stringify(created)}`);
  console.log("created", id);

  const again = parseToolText(await call(url, token, "tools/call", {
    name: "create_activity",
    arguments: { title: "[TESTE MCP] duplicata", client_key: key },
  }));
  if (again.id !== id && again.idempotent !== true) {
    console.warn("idempotência: resposta inesperada", again);
  }

  await call(url, token, "tools/call", { name: "complete_activity", arguments: { id } });
  const del = parseToolText(await call(url, token, "tools/call", { name: "delete_activity", arguments: { id } }));
  if (!del.error) throw new Error("delete sem confirm deveria falhar");
  await call(url, token, "tools/call", { name: "delete_activity", arguments: { id, confirm: true } });
  const purged = parseToolText(await call(url, token, "tools/call", { name: "purge_deleted_activities", arguments: { ids: [id] } }));
  console.log("purged", purged);
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
