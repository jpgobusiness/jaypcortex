export type TokenRequestBody = {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
  scope?: string;
};

export function parseBasicAuth(header: string | null): { client_id: string; client_secret: string } | null {
  if (!header) return null;
  const match = header.match(/^Basic\s+(\S+)/i);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { client_id: decoded.slice(0, idx), client_secret: decoded.slice(idx + 1) };
}

export function parseFormBody(text: string): TokenRequestBody {
  const params = new URLSearchParams(text);
  return {
    grant_type: params.get("grant_type") ?? undefined,
    client_id: params.get("client_id") ?? undefined,
    client_secret: params.get("client_secret") ?? undefined,
    scope: params.get("scope") ?? undefined,
  };
}

export function parseJsonBody(value: unknown): TokenRequestBody {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const str = (k: string) => (typeof obj[k] === "string" ? obj[k] : undefined);
  return {
    grant_type: str("grant_type"),
    client_id: str("client_id"),
    client_secret: str("client_secret"),
    scope: str("scope"),
  };
}

/** Basic auth vence o corpo (RFC 6749 §2.3.1). */
export function mergeClientCredentials(
  body: TokenRequestBody,
  authorization: string | null
): TokenRequestBody {
  const basic = parseBasicAuth(authorization);
  if (!basic) return body;
  return { ...body, client_id: basic.client_id, client_secret: basic.client_secret };
}

export function splitScopes(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function resolveScopes(
  requestedRaw: string | undefined,
  allowed: string[]
): { scopes: string[] } | { error: string } {
  const requested = splitScopes(requestedRaw);
  if (requested.length === 0) return { scopes: allowed };
  const extra = requested.filter((s) => !allowed.includes(s));
  if (extra.length > 0) return { error: `scope não autorizado: ${extra.join(" ")}` };
  return { scopes: requested };
}
