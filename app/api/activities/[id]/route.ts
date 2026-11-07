import { prisma } from "@/lib/prisma";
import { ok, serverError, str, dt, num } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = str(body.title);
    if (body.typeId !== undefined) data.typeId = str(body.typeId);
    if (body.opportunityId !== undefined)
      data.opportunityId = str(body.opportunityId);
    if (body.priority !== undefined) data.priority = str(body.priority);
    if (body.dueDate !== undefined) data.dueDate = dt(body.dueDate);
    if (body.notes !== undefined) data.notes = str(body.notes);
    if (body.queueOrder !== undefined)
      data.queueOrder = body.queueOrder === null ? null : num(body.queueOrder);
    if (body.status !== undefined) {
      const statusKey = str(body.status) ?? "pending";
      const st = await prisma.activityStatus.findUnique({
        where: { key: statusKey },
      });
      data.status = statusKey;
      const isDone = st?.isDone ?? false;
      data.completedAt = isDone ? new Date() : null;
      // Ao concluir, sai da fila de prioridades automaticamente.
      if (isDone) data.queueOrder = null;
    }

    const activity = await prisma.activity.update({
      where: { id },
      data,
      include: {
        type: true,
        opportunity: { select: { id: true, name: true } },
      },
    });
    return ok(activity);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.activity.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
