import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { queueAdd, queueRemove, queueReorder } from "@/lib/activities/service";
import { requestActor } from "@/lib/activities/actor-http";

export async function GET() {
  try {
    const items = await prisma.activity.findMany({
      where: { queueOrder: { not: null }, deletedAt: null },
      orderBy: { queueOrder: "asc" },
      include: { type: true, opportunity: { select: { id: true, name: true } } },
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
    if (ids.length === 0) return badRequest("Nenhuma atividade informada");
    const actor = await requestActor();
    await queueAdd(ids, undefined, actor);
    return ok({ added: ids.length });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const orderedIds: string[] = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter((x: unknown) => typeof x === "string")
      : [];
    if (orderedIds.length === 0) return badRequest("Ordem inválida");
    const actor = await requestActor();
    await queueReorder(orderedIds, actor);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return badRequest("id é obrigatório");
    const actor = await requestActor();
    await queueRemove(id, actor);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
