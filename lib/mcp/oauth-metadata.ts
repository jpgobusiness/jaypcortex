import { MCP_CORS, MCP_ISSUER } from "@/lib/mcp/http";

export function authorizationServerMetadata() {
  return {
    issuer: MCP_ISSUER,
    authorization_endpoint: `${MCP_ISSUER}/api/mcp/oauth/authorize`,
    token_endpoint: `${MCP_ISSUER}/api/mcp/oauth/token`,
    registration_endpoint: `${MCP_ISSUER}/api/mcp/oauth/register`,
    grant_types_supported: ["client_credentials", "authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    scopes_supported: ["read", "propose", "write", "admin"],
    service_documentation: `${MCP_ISSUER}/api/mcp`,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: `${MCP_ISSUER}/api/mcp`,
    authorization_servers: [MCP_ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["read", "propose", "write", "admin"],
  };
}

export function metadataResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      ...MCP_CORS,
    },
  });
}
