import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualHex } from "@/lib/knowledge/hash";

export {
  mergeClientCredentials,
  parseBasicAuth,
  parseFormBody,
  parseJsonBody,
  resolveScopes,
  splitScopes,
} from "@/lib/mcp/oauth-parse";
export type { TokenRequestBody } from "@/lib/mcp/oauth-parse";

export const OAUTH_ACCESS_TTL_SECONDS = 3600;
export const OAUTH_ACCESS_PREFIX = "jpc_at_";

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateClientId(): string {
  return `jpc_cid_${randomBytes(16).toString("base64url")}`;
}

export function generateClientSecret(): string {
  return `jpc_cs_${randomBytes(32).toString("base64url")}`;
}

export function generateAccessToken(): { token: string; tokenHash: string } {
  const token = `${OAUTH_ACCESS_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashSecret(token) };
}

export async function findValidOAuthClient(clientId: string, clientSecret: string) {
  const row = await prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  if (!row || row.revokedAt) return null;
  if (!timingSafeEqualHex(row.clientSecretHash, hashSecret(clientSecret))) return null;
  return row;
}

export async function issueAccessToken(opts: { clientId: string; scopes: string[] }) {
  const generated = generateAccessToken();
  const expiresAt = new Date(Date.now() + OAUTH_ACCESS_TTL_SECONDS * 1000);
  await prisma.mcpOAuthAccessToken.deleteMany({
    where: { clientId: opts.clientId, expiresAt: { lt: new Date() } },
  });
  await prisma.mcpOAuthAccessToken.create({
    data: {
      tokenHash: generated.tokenHash,
      clientId: opts.clientId,
      scopes: opts.scopes,
      expiresAt,
    },
  });
  return {
    access_token: generated.token,
    token_type: "Bearer" as const,
    expires_in: OAUTH_ACCESS_TTL_SECONDS,
    scope: opts.scopes.join(" "),
  };
}

export async function findValidOAuthAccessToken(bearer: string) {
  const tokenHash = hashSecret(bearer);
  const row = await prisma.mcpOAuthAccessToken.findUnique({
    where: { tokenHash },
    include: { client: true },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.client.revokedAt) return null;
  if (!timingSafeEqualHex(row.tokenHash, tokenHash)) return null;
  return row;
}
