import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualHex } from "@/lib/knowledge/hash";

export const MCP_SCOPES = ["read", "propose", "write", "admin"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

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

export async function findValidToken(bearer: string) {
  const bootstrap = process.env.MCP_BOOTSTRAP_TOKEN?.trim();
  if (bootstrap && timingSafeEqualHex(hashToken(bearer), hashToken(bootstrap))) {
    return {
      id: "bootstrap",
      name: "bootstrap",
      tokenHash: hashToken(bootstrap),
      prefix: bootstrap.slice(0, 8),
      scopes: ["read", "propose", "write", "admin"],
      profileId: process.env.MCP_BOOTSTRAP_PROFILE_ID || "00000000-0000-0000-0000-000000000000",
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
  }
  const tokenHash = hashToken(bearer);
  const exact = await prisma.mcpToken.findUnique({ where: { tokenHash } });
  if (!exact || exact.revokedAt) return null;
  if (exact.expiresAt && exact.expiresAt.getTime() < Date.now()) return null;
  if (!timingSafeEqualHex(exact.tokenHash, tokenHash)) return null;
  await prisma.mcpToken.update({
    where: { id: exact.id },
    data: { lastUsedAt: new Date() },
  });
  return exact;
}

export function hasScope(scopes: string[], needed: McpScope | McpScope[]): boolean {
  const need = Array.isArray(needed) ? needed : [needed];
  if (scopes.includes("admin")) return true;
  return need.every((s) => scopes.includes(s));
}
