import { MCP_CORS, MCP_ISSUER, mcpPreflight } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = {
    resource: `${MCP_ISSUER}/api/mcp`,
    authorization_servers: [MCP_ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["read", "propose", "write", "admin"],
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      ...MCP_CORS,
    },
  });
}

export { mcpPreflight as OPTIONS };
