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
      if (!name) return badRequest("Nome do mapa é obrigatório");
      data.name = name;
    }
    if (body.groupId !== undefined) {
      const groupId = str(body.groupId);
      if (groupId) {
        const group = await prisma.mindMapGroup.findUnique({ where: { id: groupId } });
        if (!group) return badRequest("Grupo não encontrado");
      }
      data.groupId = groupId;
    }
    if (body.order !== undefined) {
      const order = num(body.order);
      if (order === null) return badRequest("Ordem inválida");
      data.order = order;
    }

    const map = await prisma.mindMap.update({ where: { id }, data });
    return ok(map);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.mindMap.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
