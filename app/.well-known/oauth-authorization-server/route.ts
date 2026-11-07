import { MCP_CORS, MCP_ISSUER, mcpPreflight } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = {
    issuer: MCP_ISSUER,
    token_endpoint: `${MCP_ISSUER}/api/mcp/oauth/token`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    response_types_supported: [],
    scopes_supported: ["read", "propose", "write", "admin"],
    service_documentation: `${MCP_ISSUER}/api/mcp`,
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
