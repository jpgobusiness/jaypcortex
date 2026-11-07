export const MCP_ISSUER = (process.env.MCP_PUBLIC_ORIGIN || "https://jaypcortex.vercel.app").replace(/\/$/, "");

export const MCP_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
};

export function mcpWwwAuthenticate(error?: string, description?: string): string {
  const parts = [`Bearer realm="jaypcortex"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description.replace(/"/g, "'")}"`);
  parts.push(`resource_metadata="${MCP_ISSUER}/.well-known/oauth-protected-resource"`);
  return parts.join(", ");
}

export function mcpUnauthorized(description: string, error = "invalid_token"): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": mcpWwwAuthenticate(error, description),
      ...MCP_CORS,
    },
  });
}

export function withMcpCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(MCP_CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function mcpPreflight(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS });
}
