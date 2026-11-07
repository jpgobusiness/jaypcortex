import { prisma } from "@/lib/prisma";
import { timingSafeEqualHex } from "@/lib/knowledge/hash";
import {
  hashSha256,
  pkceChallengeS256,
  randomAlphanumeric,
  timingSafeEqualStr,
} from "@/lib/mcp/oauth-parse";

export {
  mergeClientCredentials,
  parseBasicAuth,
  parseFormBody,
  parseJsonBody,
  resolveScopes,
  splitScopes,
  normalizeGrantType,
} from "@/lib/mcp/oauth-parse";
export type { TokenRequestBody } from "@/lib/mcp/oauth-parse";

export const OAUTH_ACCESS_TTL_SECONDS = 3600;
export const OAUTH_REFRESH_TTL_SECONDS = 30 * 24 * 3600;
export const OAUTH_CODE_TTL_SECONDS = 600;
export const OAUTH_ACCESS_PREFIX = "jpc_at_";

export function generateClientId(): string {
  return randomAlphanumeric(24);
}

export function generateClientSecret(): string {
  return randomAlphanumeric(40);
}

export function generateAccessToken(): { token: string; tokenHash: string } {
  const token = `${OAUTH_ACCESS_PREFIX}${randomAlphanumeric(40)}`;
  return { token, tokenHash: hashSha256(token) };
}

export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = `jpc_rt_${randomAlphanumeric(48)}`;
  return { token, tokenHash: hashSha256(token) };
}

export function generateAuthorizationCode(): { code: string; codeHash: string } {
  const code = randomAlphanumeric(32);
  return { code, codeHash: hashSha256(code) };
}

export async function findValidOAuthClient(clientId: string, clientSecret?: string | null) {
  const row = await prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  if (!row || row.revokedAt) return null;
  if (row.publicClient) return row;
  if (!clientSecret) return null;
  if (!timingSafeEqualHex(row.clientSecretHash, hashSha256(clientSecret))) return null;
  return row;
}

export async function findOAuthClient(clientId: string) {
  const row = await prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  if (!row || row.revokedAt) return null;
  return row;
}

type IssueOpts = {
  clientId: string;
  scopes: string[];
  profileId?: string | null;
  grantType: string;
  includeRefresh?: boolean;
};

export async function issueTokenResponse(opts: IssueOpts) {
  const access = generateAccessToken();
  const expiresAt = new Date(Date.now() + OAUTH_ACCESS_TTL_SECONDS * 1000);
  await prisma.mcpOAuthAccessToken.deleteMany({
    where: { clientId: opts.clientId, expiresAt: { lt: new Date() } },
  });
  await prisma.mcpOAuthAccessToken.create({
    data: {
      tokenHash: access.tokenHash,
      clientId: opts.clientId,
      scopes: opts.scopes,
      profileId: opts.profileId ?? null,
      grantType: opts.grantType,
      expiresAt,
    },
  });
  const body: Record<string, unknown> = {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: OAUTH_ACCESS_TTL_SECONDS,
    scope: opts.scopes.join(" "),
  };
  if (opts.includeRefresh && opts.profileId) {
    const refresh = generateRefreshToken();
    await prisma.mcpOAuthRefreshToken.create({
      data: {
        tokenHash: refresh.tokenHash,
        clientId: opts.clientId,
        profileId: opts.profileId,
        scopes: opts.scopes,
        expiresAt: new Date(Date.now() + OAUTH_REFRESH_TTL_SECONDS * 1000),
      },
    });
    body.refresh_token = refresh.token;
  }
  return body;
}

export async function issueAccessToken(opts: { clientId: string; scopes: string[] }) {
  return issueTokenResponse({
    clientId: opts.clientId,
    scopes: opts.scopes,
    grantType: "client_credentials",
  });
}

export async function findValidOAuthAccessToken(bearer: string) {
  const tokenHash = hashSha256(bearer);
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

export async function createAuthorizationCode(opts: {
  clientId: string;
  profileId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
}) {
  const generated = generateAuthorizationCode();
  await prisma.mcpOAuthAuthorizationCode.create({
    data: {
      codeHash: generated.codeHash,
      clientId: opts.clientId,
      profileId: opts.profileId,
      redirectUri: opts.redirectUri,
      scopes: opts.scopes,
      codeChallenge: opts.codeChallenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_SECONDS * 1000),
    },
  });
  return generated.code;
}

export async function consumeAuthorizationCode(opts: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  const row = await prisma.mcpOAuthAuthorizationCode.findUnique({
    where: { codeHash: hashSha256(opts.code) },
  });
  if (!row || row.usedAt) return { error: "invalid_grant" as const, description: "Code inválido" };
  if (row.clientId !== opts.clientId) return { error: "invalid_grant" as const, description: "Code de outro cliente" };
  if (row.redirectUri !== opts.redirectUri) {
    return { error: "invalid_grant" as const, description: "redirect_uri não confere" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { error: "invalid_grant" as const, description: "Code expirado" };
  }
  const challenge = pkceChallengeS256(opts.codeVerifier);
  if (!timingSafeEqualStr(challenge, row.codeChallenge)) {
    return { error: "invalid_grant" as const, description: "PKCE inválido" };
  }
  await prisma.mcpOAuthAuthorizationCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return { row };
}

export async function consumeRefreshToken(opts: { refreshToken: string; clientId: string }) {
  const row = await prisma.mcpOAuthRefreshToken.findUnique({
    where: { tokenHash: hashSha256(opts.refreshToken) },
  });
  if (!row || row.revokedAt) return { error: "invalid_grant" as const, description: "Refresh inválido" };
  if (row.clientId !== opts.clientId) return { error: "invalid_grant" as const, description: "Refresh de outro cliente" };
  if (row.expiresAt.getTime() < Date.now()) return { error: "invalid_grant" as const, description: "Refresh expirado" };
  await prisma.mcpOAuthRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return { row };
}

export async function registerOAuthClient(opts: {
  name: string;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
}) {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const row = await prisma.mcpOAuthClient.create({
    data: {
      name: opts.name,
      clientId,
      clientSecretHash: hashSha256(clientSecret),
      scopes: opts.scopes,
      redirectUris: opts.redirectUris,
      publicClient: false,
      grantTypes: opts.grantTypes,
    },
  });
  return { row, clientId, clientSecret };
}
