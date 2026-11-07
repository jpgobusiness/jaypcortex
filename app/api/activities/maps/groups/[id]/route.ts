import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return badRequest("Nome do grupo é obrigatório");
      data.name = name;
    }
    if (body.order !== undefined) {
      const order = num(body.order);
      if (order === null) return badRequest("Ordem inválida");
      data.order = order;
    }

    const group = await prisma.mindMapGroup.update({ where: { id }, data });
    return ok(group);
  } catch (e) {
    return serverError(e);
  }
}

/** Apaga o grupo. Os mapas continuam, fora de qualquer grupo. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.mindMapGroup.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
