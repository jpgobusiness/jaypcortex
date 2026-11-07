import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";

// Lista as atividades que estão na fila, em ordem de prioridade.
export async function GET() {
  try {
    const items = await prisma.activity.findMany({
      where: { queueOrder: { not: null } },
      orderBy: { queueOrder: "asc" },
      include: {
        type: true,
        opportunity: { select: { id: true, name: true } },
      },
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

// Adiciona atividades à fila (no fim), preservando a ordem recebida.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === "string")
      : [];
    if (ids.length === 0) return badRequest("Nenhuma atividade informada");

    const max = await prisma.activity.aggregate({
      _max: { queueOrder: true },
    });
    let next = (max._max.queueOrder ?? 0) + 1;

    const existing = await prisma.activity.findMany({
      where: { id: { in: ids } },
      select: { id: true, queueOrder: true },
    });

    let added = 0;
    for (const id of ids) {
      const e = existing.find((x) => x.id === id);
      if (e && e.queueOrder == null) {
        await prisma.activity.update({
          where: { id },
          data: { queueOrder: next++ },
        });
        added++;
      }
    }
    return ok({ added });
  } catch (e) {
    return serverError(e);
  }
}

// Reordena a fila inteira conforme a lista de ids.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const orderedIds: string[] = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter((x: unknown) => typeof x === "string")
      : [];
    if (orderedIds.length === 0) return badRequest("Ordem inválida");

    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.activity.update({
        where: { id: orderedIds[i] },
        data: { queueOrder: i + 1 },
      });
    }
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}

// Remove uma atividade da fila (queueOrder = null).
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return badRequest("id é obrigatório");
    await prisma.activity.update({
      where: { id },
      data: { queueOrder: null },
    });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
