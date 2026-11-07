import { createSupabaseServer } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/mcp/audit";
import { MCP_CORS, MCP_ISSUER, mcpPreflight } from "@/lib/mcp/http";
import { isRedirectUriAllowed, splitScopes } from "@/lib/mcp/oauth-parse";
import { registerOAuthClient } from "@/lib/mcp/oauth";
import { rateLimit } from "@/lib/mcp/rate-limit";
import { findValidToken } from "@/lib/mcp/tokens";

export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...MCP_CORS },
  });
}

async function isProtectedOk(req: Request): Promise<{ ok: boolean; actorId: string | null }> {
  const token = process.env.MCP_OAUTH_REGISTRATION_TOKEN?.trim();
  const header = req.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (token && bearer && bearer === token) return { ok: true, actorId: null };
  if (bearer) {
    const mcp = await findValidToken(bearer);
    if (mcp && (mcp.scopes.includes("admin") || mcp.kind === "bootstrap")) {
      return { ok: true, actorId: mcp.profileId || null };
    }
  }
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { ok: true, actorId: user.id };
  return { ok: false, actorId: null };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`oauth-dcr:${ip}`, 10, 10 * 60_000)) {
    return json(429, { error: "too_many_requests" });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0) {
    return json(400, { error: "invalid_redirect_uri", error_description: "Informe redirect_uris" });
  }
  for (const uri of redirectUris) {
    const allowed = isRedirectUriAllowed(uri, []);
    if (!allowed.ok) {
      await writeAudit({
        actorType: "mcp",
        action: "oauth_dcr_rejected",
        entity: "McpOAuthClient",
        meta: { redirect_uri: uri, reason: allowed.reason },
      });
      return json(400, { error: "invalid_redirect_uri", error_description: `${uri}: ${allowed.reason}` });
    }
  }
  const gate = await isProtectedOk(req);
  if (!gate.ok) {
    const blocked = redirectUris.find((uri) => !isRedirectUriAllowed(uri, []).ok);
    if (blocked) {
      return json(401, { error: "access_denied", error_description: "DCR protegido fora da allowlist QuickSight" });
    }
  }
  const scopes = splitScopes(typeof body.scope === "string" ? body.scope : "read propose write");
  const grantTypes = Array.isArray(body.grant_types)
    ? body.grant_types.filter((g): g is string => typeof g === "string")
    : ["authorization_code", "refresh_token"];
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "dcr-client";
  const created = await registerOAuthClient({
    name,
    redirectUris,
    scopes: scopes.length ? scopes.filter((s) => ["read", "propose", "write", "admin"].includes(s)) : ["read", "propose", "write"],
    grantTypes: grantTypes.length ? grantTypes : ["authorization_code", "refresh_token"],
  });
  await writeAudit({
    actorId: gate.actorId,
    actorType: gate.actorId ? "user" : "mcp",
    action: "oauth_dcr",
    entity: "McpOAuthClient",
    entityId: created.row.id,
    meta: { redirect_uris: redirectUris, client_id: created.clientId, name },
  });
  return json(201, {
    client_id: created.clientId,
    client_secret: created.clientSecret,
    client_id_issued_at: Math.floor(created.row.createdAt.getTime() / 1000),
    client_secret_expires_at: 0,
    redirect_uris: redirectUris,
    grant_types: created.row.grantTypes,
    token_endpoint_auth_method: "client_secret_post",
    client_name: name,
    registration_client_uri: `${MCP_ISSUER}/api/mcp/oauth/register`,
  });
}

export { mcpPreflight as OPTIONS };
