/**
 * 5 chamadas cortex em produção. Não deixa dados de teste.
 * Uso: MCP_URL=... MCP_TOKEN=jpc_... npx tsx scripts/test-mcp-cortex.ts
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
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  const json = JSON.parse(dataLine ? dataLine.slice(6) : text);
  if (json.error) throw new Error(`${name}: ${JSON.stringify(json.error)}`);
  const raw = json.result?.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

async function main() {
  const { url, token } = loadToken();
  const listed = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const listedText = await listed.text();
  const listedLine = listedText.split("\n").find((l) => l.startsWith("data: "));
  const tools = JSON.parse(listedLine ? listedLine.slice(6) : listedText).result?.tools ?? [];
  const names: string[] = tools.map((t: { name: string }) => t.name);
  for (const need of ["cortex", "get_agent_context", "list_agent_tools", "list_activities", "search_knowledge"]) {
    if (!names.includes(need)) throw new Error(`Tool faltando: ${need}`);
  }

  const cases = [
    { request: "lista minhas tarefas de hoje", slug: "gestao-tempo", live: true },
    { request: "o que eu priorizo hoje?", slug: "gestao-tempo", live: true },
    { request: "como funciona o funding do MAP?", slug: "migracao-aws", live: false },
    { request: "como evito procrastinar a proposta?", slug: "gestao-tempo", live: true },
    { request: "me ajuda com aquilo depois", slug: null, live: false },
  ];

  for (const item of cases) {
    const pack = await call(url, token, "cortex", { request: item.request, include_knowledge: true });
    if (pack.error) throw new Error(`cortex falhou (${item.request}): ${pack.error}`);
    const routed = pack.routed_to as { slug?: string } | null;
    const mode = String(pack.mode || "");
    const live = pack.live_data as { activities?: unknown[] } | null;
    const toolsSuggested = pack.suggested_tools as unknown[] | undefined;
    console.log(
      JSON.stringify({
        request: item.request,
        slug: routed?.slug ?? null,
        mode,
        live_n: Array.isArray(live?.activities) ? live.activities.length : live ? "obj" : 0,
        suggested: (toolsSuggested ?? []).map((t) => (t as { tool?: string }).tool),
        log: pack.route_log_id,
      })
    );
    if (item.slug && routed?.slug !== item.slug && mode !== "esclarecer") {
      throw new Error(`esperado ${item.slug}, veio ${routed?.slug} (${item.request})`);
    }
    if (item.live) {
      const n = Array.isArray(live?.activities) ? live.activities.length : 0;
      const briefing = live && typeof live === "object" && "briefing" in live;
      if (n === 0 && !briefing) throw new Error(`live_data vazio para ${item.request}`);
    }
    if (item.slug === "gestao-tempo" && mode !== "esclarecer") {
      const namesSuggested = (toolsSuggested ?? []).map((t) => (t as { tool?: string }).tool);
      if (!namesSuggested.some((n) => n && (n.includes("activit") || n.includes("briefing") || n === "plan_day" || n === "search_knowledge"))) {
        throw new Error(`suggested_tools fracas para ${item.request}: ${namesSuggested}`);
      }
    }
  }
  console.log("cortex produção ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
