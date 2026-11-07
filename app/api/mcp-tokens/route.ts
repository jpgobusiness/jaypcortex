import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { createMcpToken, MCP_SCOPES } from "@/lib/mcp/tokens";
import { writeAudit } from "@/lib/mcp/audit";

export async function GET() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  try {
    const rows = await prisma.mcpToken.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const { profile, error } = await requireApiAdmin();
  if (error) return error;
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return badRequest("Nome é obrigatório");
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s: unknown) => MCP_SCOPES.includes(s as never))
      : ["read"];
    const created = await createMcpToken({
      name,
      scopes,
      profileId: profile!.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
    await writeAudit({
      actorId: profile?.id,
      actorType: "user",
      action: "create_mcp_token",
      entity: "McpToken",
      entityId: created.id,
    });
    return ok(
      {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        scopes: created.scopes,
        token: created.token,
        createdAt: created.createdAt,
      },
      201
    );
  } catch (e) {
    return serverError(e);
  }
}
