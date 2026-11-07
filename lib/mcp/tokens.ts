import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualHex } from "@/lib/knowledge/hash";
import { findValidOAuthAccessToken } from "@/lib/mcp/oauth";

export const MCP_SCOPES = ["read", "propose", "write", "admin"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export type McpAuth = {
  id: string;
  name: string;
  scopes: string[];
  profileId: string;
  kind: "static" | "oauth" | "bootstrap";
};

let cachedAdminProfileId: string | null | undefined;

async function adminProfileId(): Promise<string> {
  if (cachedAdminProfileId !== undefined) return cachedAdminProfileId ?? "";
  const email = (process.env.ADMIN_EMAIL || "pjoao4446@gmail.com").trim().toLowerCase();
  const profile = await prisma.profile.findFirst({ where: { email }, select: { id: true } });
  cachedAdminProfileId = profile?.id ?? null;
  return cachedAdminProfileId ?? "";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): { token: string; prefix: string; tokenHash: string } {
  const raw = `jpc_${randomBytes(24).toString("base64url")}`;
  return { token: raw, prefix: raw.slice(0, 8), tokenHash: hashToken(raw) };
}

export async function createMcpToken(opts: {
  name: string;
  scopes: string[];
  profileId: string;
  expiresAt?: Date | null;
}) {
  const generated = generateToken();
  const row = await prisma.mcpToken.create({
    data: {
      name: opts.name,
      scopes: opts.scopes,
      profileId: opts.profileId,
      prefix: generated.prefix,
      tokenHash: generated.tokenHash,
      expiresAt: opts.expiresAt ?? null,
    },
  });
  return { ...row, token: generated.token };
}

export async function findValidToken(bearer: string): Promise<McpAuth | null> {
  const bootstrap = process.env.MCP_BOOTSTRAP_TOKEN?.trim();
  if (bootstrap && timingSafeEqualHex(hashToken(bearer), hashToken(bootstrap))) {
    return {
      id: "bootstrap",
      name: "bootstrap",
      scopes: ["read", "propose", "write", "admin"],
      profileId: process.env.MCP_BOOTSTRAP_PROFILE_ID || (await adminProfileId()),
      kind: "bootstrap",
    };
  }
  const tokenHash = hashToken(bearer);
  const exact = await prisma.mcpToken.findUnique({ where: { tokenHash } });
  if (exact && !exact.revokedAt && !(exact.expiresAt && exact.expiresAt.getTime() < Date.now())) {
    if (timingSafeEqualHex(exact.tokenHash, tokenHash)) {
      await prisma.mcpToken.update({
        where: { id: exact.id },
        data: { lastUsedAt: new Date() },
      });
      return {
        id: exact.id,
        name: exact.name,
        scopes: exact.scopes,
        profileId: exact.profileId,
        kind: "static",
      };
    }
  }
  const oauth = await findValidOAuthAccessToken(bearer);
  if (!oauth) return null;
  return {
    id: oauth.id,
    name: oauth.client.name,
    scopes: oauth.scopes.length ? oauth.scopes : oauth.client.scopes,
    profileId: await adminProfileId(),
    kind: "oauth",
  };
}

export function hasScope(scopes: string[], needed: McpScope | McpScope[]): boolean {
  const need = Array.isArray(needed) ? needed : [needed];
  if (scopes.includes("admin")) return true;
  return need.every((s) => scopes.includes(s));
}
