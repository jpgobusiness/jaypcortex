import { createHash, randomBytes } from "node:crypto";

export type TokenRequestBody = {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
  scope?: string;
  resource?: string;
  audience?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  refresh_token?: string;
  keys: string[];
};

const KNOWN = [
  "grant_type",
  "client_id",
  "client_secret",
  "scope",
  "resource",
  "audience",
  "code",
  "code_verifier",
  "redirect_uri",
  "refresh_token",
] as const;

function str(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value.join(" ");
  return undefined;
}

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
  const keys = [...new Set(params.keys())];
  return {
    grant_type: params.get("grant_type") ?? undefined,
    client_id: params.get("client_id") ?? undefined,
    client_secret: params.get("client_secret") ?? undefined,
    scope: params.get("scope") ?? undefined,
    resource: params.get("resource") ?? undefined,
    audience: params.get("audience") ?? undefined,
    code: params.get("code") ?? undefined,
    code_verifier: params.get("code_verifier") ?? undefined,
    redirect_uri: params.get("redirect_uri") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    keys,
  };
}

export function parseJsonBody(value: unknown): TokenRequestBody {
  if (!value || typeof value !== "object") return { keys: [] };
  const obj = value as Record<string, unknown>;
  return {
    grant_type: str(obj.grant_type),
    client_id: str(obj.client_id),
    client_secret: str(obj.client_secret),
    scope: str(obj.scope),
    resource: str(obj.resource),
    audience: str(obj.audience),
    code: str(obj.code),
    code_verifier: str(obj.code_verifier),
    redirect_uri: str(obj.redirect_uri),
    refresh_token: str(obj.refresh_token),
    keys: Object.keys(obj),
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

/** Interseção com a allowlist; escopos desconhecidos são ignorados (não 400). */
export function resolveScopes(
  requestedRaw: string | undefined,
  allowed: string[]
): { scopes: string[]; dropped: string[] } {
  const requested = splitScopes(requestedRaw);
  if (requested.length === 0) return { scopes: allowed, dropped: [] };
  const dropped = requested.filter((s) => !allowed.includes(s));
  const scopes = requested.filter((s) => allowed.includes(s));
  return { scopes: scopes.length ? scopes : allowed, dropped };
}

export function normalizeGrantType(raw: string | undefined, body: TokenRequestBody): string {
  const g = (raw || "").trim().toLowerCase();
  if (!g) {
    if (body.code) return "authorization_code";
    if (body.refresh_token) return "refresh_token";
    return "client_credentials";
  }
  if (g.includes("client_credentials")) return "client_credentials";
  if (g.includes("authorization_code") || g === "code") return "authorization_code";
  if (g.includes("refresh")) return "refresh_token";
  return g;
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i++) out |= left[i] ^ right[i];
  return out === 0;
}

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomAlphanumeric(length: number): string {
  let out = "";
  while (out.length < length) {
    const b = randomBytes(1)[0];
    if (b >= 248) continue;
    out += ALPHANUM[b % 62];
  }
  return out;
}

export const DEFAULT_REDIRECT_PATTERNS = [
  "https://*.quicksight.aws.amazon.com/*",
  "https://*.quicksight.aws/*",
];

export function redirectPatterns(): string[] {
  const extra = (process.env.MCP_OAUTH_REDIRECT_URIS || "")
    .split(/[, \n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_REDIRECT_PATTERNS, ...extra];
}

export function matchUriPattern(uri: string, pattern: string): boolean {
  if (!pattern.includes("*")) return uri === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(uri);
}

export function isRedirectUriAllowed(
  uri: string,
  clientUris: string[]
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return { ok: false, reason: "redirect_uri inválida" };
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return { ok: false, reason: "redirect_uri precisa ser https" };
  }
  const allowlisted = redirectPatterns().some((p) => matchUriPattern(uri, p));
  const registered = clientUris.includes(uri);
  if (clientUris.length > 0 && !registered) {
    return { ok: false, reason: "redirect_uri não registrada neste cliente" };
  }
  if (!allowlisted && !registered) {
    return { ok: false, reason: "redirect_uri fora da allowlist QuickSight" };
  }
  return { ok: true };
}

export function appendRedirectParams(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

export function hashSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export { KNOWN as OAUTH_KNOWN_PARAMS };
