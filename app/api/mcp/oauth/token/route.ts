import {
  findValidOAuthClient,
  issueAccessToken,
  mergeClientCredentials,
  parseFormBody,
  parseJsonBody,
  resolveScopes,
  type TokenRequestBody,
} from "@/lib/mcp/oauth";
import { MCP_CORS, mcpPreflight } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Cache-Control": "no-store",
      ...MCP_CORS,
      ...extra,
    },
  });
}

async function readBody(req: Request): Promise<TokenRequestBody> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return parseJsonBody(await req.json().catch(() => ({})));
  }
  return parseFormBody(await req.text().catch(() => ""));
}

export async function POST(req: Request) {
  const body = mergeClientCredentials(await readBody(req), req.headers.get("authorization"));
  if (body.grant_type !== "client_credentials") {
    return json(400, {
      error: "unsupported_grant_type",
      error_description: "Apenas grant_type=client_credentials",
    });
  }
  if (!body.client_id || !body.client_secret) {
    return json(
      401,
      { error: "invalid_client", error_description: "Informe client_id e client_secret" },
      { "WWW-Authenticate": 'Basic realm="jaypcortex"' }
    );
  }
  const client = await findValidOAuthClient(body.client_id, body.client_secret);
  if (!client) {
    return json(
      401,
      { error: "invalid_client", error_description: "Cliente inválido ou revogado" },
      { "WWW-Authenticate": 'Basic realm="jaypcortex"' }
    );
  }
  const scoped = resolveScopes(body.scope, client.scopes);
  if ("error" in scoped) {
    return json(400, { error: "invalid_scope", error_description: scoped.error });
  }
  const issued = await issueAccessToken({ clientId: client.clientId, scopes: scoped.scopes });
  return json(200, issued);
}

export { mcpPreflight as OPTIONS };
