import {
  consumeAuthorizationCode,
  consumeRefreshToken,
  findValidOAuthClient,
  issueTokenResponse,
  mergeClientCredentials,
  normalizeGrantType,
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

function logToken(body: TokenRequestBody, grant: string, status: number, extra: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      msg: "mcp_oauth_token",
      grant,
      status,
      ua: extra.ua,
      keys: body.keys,
      has_client_id: Boolean(body.client_id),
      has_secret: Boolean(body.client_secret),
      has_code: Boolean(body.code),
      has_verifier: Boolean(body.code_verifier),
      has_refresh: Boolean(body.refresh_token),
      resource: body.resource || undefined,
      audience: body.audience || undefined,
      scope: body.scope || undefined,
      dropped: extra.dropped,
      error: extra.error,
    })
  );
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  const body = mergeClientCredentials(await readBody(req), req.headers.get("authorization"));
  const grant = normalizeGrantType(body.grant_type, body);

  const needClient = async () => {
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
    return client;
  };

  if (grant === "client_credentials") {
    const client = await needClient();
    if (client instanceof Response) {
      logToken(body, grant, 401, { ua, error: "invalid_client" });
      return client;
    }
    if (client.grantTypes.length && !client.grantTypes.includes("client_credentials")) {
      logToken(body, grant, 400, { ua, error: "unauthorized_client" });
      return json(400, { error: "unauthorized_client", error_description: "Este cliente não usa client_credentials" });
    }
    const scoped = resolveScopes(body.scope, client.scopes);
    const issued = await issueTokenResponse({
      clientId: client.clientId,
      scopes: scoped.scopes,
      grantType: "client_credentials",
    });
    logToken(body, grant, 200, { ua, dropped: scoped.dropped });
    return json(200, issued);
  }

  if (grant === "authorization_code") {
    const client = await needClient();
    if (client instanceof Response) {
      logToken(body, grant, 401, { ua, error: "invalid_client" });
      return client;
    }
    if (!body.code || !body.code_verifier || !body.redirect_uri) {
      logToken(body, grant, 400, { ua, error: "invalid_request" });
      return json(400, {
        error: "invalid_request",
        error_description: "Informe code, code_verifier e redirect_uri",
      });
    }
    const consumed = await consumeAuthorizationCode({
      code: body.code,
      clientId: client.clientId,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
    if ("error" in consumed) {
      logToken(body, grant, 400, { ua, error: consumed.error });
      return json(400, { error: consumed.error, error_description: consumed.description });
    }
    const scoped = resolveScopes(consumed.row.scopes.join(" "), client.scopes);
    const issued = await issueTokenResponse({
      clientId: client.clientId,
      scopes: scoped.scopes.length ? scoped.scopes : consumed.row.scopes,
      profileId: consumed.row.profileId,
      grantType: "authorization_code",
      includeRefresh: true,
    });
    logToken(body, grant, 200, { ua });
    return json(200, issued);
  }

  if (grant === "refresh_token") {
    const client = await needClient();
    if (client instanceof Response) {
      logToken(body, grant, 401, { ua, error: "invalid_client" });
      return client;
    }
    if (!body.refresh_token) {
      logToken(body, grant, 400, { ua, error: "invalid_request" });
      return json(400, { error: "invalid_request", error_description: "Informe refresh_token" });
    }
    const consumed = await consumeRefreshToken({
      refreshToken: body.refresh_token,
      clientId: client.clientId,
    });
    if ("error" in consumed) {
      logToken(body, grant, 400, { ua, error: consumed.error });
      return json(400, { error: consumed.error, error_description: consumed.description });
    }
    const issued = await issueTokenResponse({
      clientId: client.clientId,
      scopes: consumed.row.scopes,
      profileId: consumed.row.profileId,
      grantType: "refresh_token",
      includeRefresh: true,
    });
    logToken(body, grant, 200, { ua });
    return json(200, issued);
  }

  logToken(body, grant, 400, { ua, error: "unsupported_grant_type" });
  return json(400, {
    error: "unsupported_grant_type",
    error_description: "Use client_credentials, authorization_code ou refresh_token",
  });
}

export { mcpPreflight as OPTIONS };
