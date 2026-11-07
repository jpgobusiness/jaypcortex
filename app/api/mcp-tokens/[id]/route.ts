import { prisma } from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/mcp/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    const existing = await prisma.mcpToken.findUnique({ where: { id } });
    if (!existing) return notFound("Token não encontrado");
    await prisma.mcpToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      actorId: profile?.id,
      actorType: "user",
      action: "revoke_mcp_token",
      entity: "McpToken",
      entityId: id,
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
