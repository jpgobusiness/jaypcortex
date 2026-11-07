import { createMcpHandler } from "mcp-handler";
import { findValidToken } from "@/lib/mcp/tokens";
import { rateLimit } from "@/lib/mcp/rate-limit";
import { registerMcpTools } from "@/lib/mcp/register-tools";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  if (process.env.MCP_ENABLED === "false") {
    return Response.json({ error: "MCP desligado" }, { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return Response.json({ error: "Informe Authorization: Bearer <token>" }, { status: 401 });
  }
  const row = await findValidToken(token);
  if (!row) {
    return Response.json({ error: "Token inválido ou revogado" }, { status: 401 });
  }
  if (!rateLimit(row.id)) {
    return Response.json({ error: "Rate limit (60 req/min)" }, { status: 429 });
  }

  const mcp = createMcpHandler(
    (server) => {
      registerMcpTools(server as never, {
        tokenId: row.id === "bootstrap" ? "" : row.id,
        profileId: row.profileId,
        scopes: row.scopes,
      });
    },
    {
      serverInfo: { name: "jaypcortex", version: "0.1.0" },
    }
  );
  const res = await mcp(req);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, mcp-session-id, mcp-protocol-version");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-session-id, mcp-protocol-version",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    },
  });
}

export { handle as GET, handle as POST, handle as DELETE };
