import { prisma } from "@/lib/prisma";
import { ok, serverError, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = str(body.name);
    if (body.color !== undefined) data.color = str(body.color);
    const type = await prisma.activityType.update({ where: { id }, data });
    return ok(type);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    // Desvincula as atividades desse tipo antes de excluir.
    await prisma.activity.updateMany({
      where: { typeId: id },
      data: { typeId: null },
    });
    await prisma.activityType.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
