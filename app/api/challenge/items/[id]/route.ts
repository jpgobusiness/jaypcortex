import { prisma } from "@/lib/prisma";
import { ok, notFound, serverError, str, num } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Atualiza um item do desafio (nome, ícone, ordem, ativo). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = str(body.name);
    if (body.icon !== undefined) data.icon = str(body.icon) ?? "circle";
    if (body.order !== undefined) data.order = num(body.order) ?? 0;
    if (body.active !== undefined) data.active = Boolean(body.active);

    const item = await prisma.challengeItem.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return serverError(e);
  }
}

/** Remove um item do desafio e todos os checks associados (cascade). */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await prisma.challengeItem.findUnique({ where: { id } });
    if (!existing) return notFound("Item não encontrado");

    await prisma.challengeItem.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
