import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, notFound, str, num } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = str(body.name);
    if (body.color !== undefined) data.color = str(body.color);
    if (body.order !== undefined) data.order = num(body.order) ?? 0;
    if (body.isDone !== undefined) data.isDone = Boolean(body.isDone);
    const status = await prisma.activityStatus.update({ where: { id }, data });
    return ok(status);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const all = await prisma.activityStatus.findMany({
      orderBy: { order: "asc" },
    });
    if (all.length <= 1) {
      return badRequest("É preciso manter ao menos um status.");
    }
    const target = all.find((s) => s.id === id);
    if (!target) return notFound("Status não encontrado");

    // Reatribui as atividades desse status para o primeiro status restante.
    const fallback = all.find((s) => s.id !== id)!;
    await prisma.activity.updateMany({
      where: { status: target.key },
      data: { status: fallback.key },
    });
    await prisma.activityStatus.delete({ where: { id } });
    return ok({ success: true, reassignedTo: fallback.key });
  } catch (e) {
    return serverError(e);
  }
}
