import { createMcpHandler } from "mcp-handler";
import { findValidToken } from "@/lib/mcp/tokens";
import { rateLimit } from "@/lib/mcp/rate-limit";
import { registerMcpTools } from "@/lib/mcp/register-tools";
import { MCP_CORS, mcpPreflight, mcpUnauthorized, withMcpCors } from "@/lib/mcp/http";
import { sanitizeMcpHttpResponse } from "@/lib/mcp/quick-compat";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  if (process.env.MCP_ENABLED === "false") {
    return Response.json({ error: "MCP desligado" }, { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return mcpUnauthorized("Informe Authorization: Bearer <token>");
  }
  const row = await findValidToken(token);
  if (!row) {
    return mcpUnauthorized("Token inválido ou revogado");
  }
  if (!rateLimit(row.id)) {
    return new Response(JSON.stringify({ error: "Rate limit (60 req/min)" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...MCP_CORS },
    });
  }

  const mcp = createMcpHandler(
    (server) => {
      registerMcpTools(server as never, {
        tokenId: row.kind === "static" ? row.id : "",
        profileId: row.profileId,
        scopes: row.scopes,
      });
    },
    {
      serverInfo: { name: "jaypcortex", version: "0.1.0" },
    }
  );
  return withMcpCors(await sanitizeMcpHttpResponse(await mcp(req)));
}

export { mcpPreflight as OPTIONS };
export { handle as GET, handle as POST, handle as DELETE };
