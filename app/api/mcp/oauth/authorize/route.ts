import { createSupabaseServer } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/mcp/audit";
import { consentHtml, oauthErrorHtml } from "@/lib/mcp/oauth-consent";
import {
  appendRedirectParams,
  isRedirectUriAllowed,
  resolveScopes,
  safeNextPath,
} from "@/lib/mcp/oauth-parse";
import { createAuthorizationCode, findOAuthClient } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

function html(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function loginRedirect(req: Request): Response {
  const url = new URL(req.url);
  const next = `${url.pathname}${url.search}`;
  const dest = new URL("/login", url.origin);
  dest.searchParams.set("next", safeNextPath(next) || url.pathname);
  return Response.redirect(dest, 302);
}

async function currentUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function readParams(src: URLSearchParams) {
  return {
    response_type: src.get("response_type") || "",
    client_id: src.get("client_id") || "",
    redirect_uri: src.get("redirect_uri") || "",
    scope: src.get("scope") || "",
    state: src.get("state") || "",
    code_challenge: src.get("code_challenge") || "",
    code_challenge_method: (src.get("code_challenge_method") || "S256").toUpperCase(),
    resource: src.get("resource") || "",
    audience: src.get("audience") || "",
  };
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return loginRedirect(req);
  const params = readParams(new URL(req.url).searchParams);
  return renderConsent(user.id, params);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return loginRedirect(req);
  const form = await req.formData();
  const fromForm = {
    response_type: String(form.get("response_type") || ""),
    client_id: String(form.get("client_id") || ""),
    redirect_uri: String(form.get("redirect_uri") || ""),
    scope: String(form.get("scope") || ""),
    state: String(form.get("state") || ""),
    code_challenge: String(form.get("code_challenge") || ""),
    code_challenge_method: String(form.get("code_challenge_method") || "S256").toUpperCase(),
    resource: String(form.get("resource") || ""),
    audience: String(form.get("audience") || ""),
  };
  const decision = String(form.get("decision") || "");
  return settleConsent(user.id, fromForm, decision);
}

async function renderConsent(profileId: string, params: ReturnType<typeof readParams>) {
  const checked = await validateAuthorize(profileId, params);
  if (checked instanceof Response) return checked;
  return html(
    200,
    consentHtml({
      clientName: checked.client.name,
      scopes: checked.scopes,
      fields: {
        response_type: params.response_type,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        scope: params.scope,
        state: params.state,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method,
        resource: params.resource,
        audience: params.audience,
      },
    })
  );
}

async function settleConsent(
  profileId: string,
  params: ReturnType<typeof readParams>,
  decision: string
) {
  const checked = await validateAuthorize(profileId, params);
  if (checked instanceof Response) return checked;
  if (decision !== "authorize") {
    return Response.redirect(
      appendRedirectParams(params.redirect_uri, {
        error: "access_denied",
        ...(params.state ? { state: params.state } : {}),
      }),
      302
    );
  }
  const code = await createAuthorizationCode({
    clientId: checked.client.clientId,
    profileId,
    redirectUri: params.redirect_uri,
    scopes: checked.scopes,
    codeChallenge: params.code_challenge,
  });
  await writeAudit({
    actorId: profileId,
    actorType: "user",
    action: "oauth_authorize",
    entity: "McpOAuthClient",
    entityId: checked.client.id,
    meta: { redirect_uri: params.redirect_uri, client_id: params.client_id, scopes: checked.scopes },
  });
  return Response.redirect(
    appendRedirectParams(params.redirect_uri, {
      code,
      ...(params.state ? { state: params.state } : {}),
    }),
    302
  );
}

async function validateAuthorize(profileId: string, params: ReturnType<typeof readParams>) {
  await writeAudit({
    actorId: profileId,
    actorType: "user",
    action: "oauth_redirect_uri_seen",
    entity: "McpOAuthClient",
    entityId: params.client_id || null,
    meta: {
      redirect_uri: params.redirect_uri,
      client_id: params.client_id,
      response_type: params.response_type,
      resource: params.resource || undefined,
    },
  });

  if (params.response_type !== "code") {
    return html(400, oauthErrorHtml("Pedido inválido", "response_type precisa ser code."));
  }
  const client = await findOAuthClient(params.client_id);
  if (!client) return html(400, oauthErrorHtml("Cliente inválido", "client_id desconhecido ou revogado."));
  if (client.grantTypes.length && !client.grantTypes.includes("authorization_code")) {
    return html(400, oauthErrorHtml("Cliente inválido", "Este cliente não usa authorization_code."));
  }
  if (!params.redirect_uri) {
    return html(400, oauthErrorHtml("Pedido inválido", "Faltou redirect_uri."));
  }
  const allowed = isRedirectUriAllowed(params.redirect_uri, client.redirectUris);
  if (!allowed.ok) {
    return html(400, oauthErrorHtml("redirect_uri recusada", allowed.reason));
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    if (params.redirect_uri) {
      return Response.redirect(
        appendRedirectParams(params.redirect_uri, {
          error: "invalid_request",
          error_description: "PKCE S256 obrigatório",
          ...(params.state ? { state: params.state } : {}),
        }),
        302
      );
    }
    return html(400, oauthErrorHtml("Pedido inválido", "PKCE S256 obrigatório."));
  }
  const scoped = resolveScopes(params.scope, client.scopes);
  return { client, scopes: scoped.scopes };
}
