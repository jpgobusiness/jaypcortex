import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, num, str } from "@/lib/api";
import { deleteConnectionsForEndpoint } from "@/lib/mind-map";

type Ctx = { params: Promise<{ activityId: string }> };

function mapIdFrom(req: Request) {
  return new URL(req.url).searchParams.get("mapId");
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { activityId } = await params;
    const mapId = mapIdFrom(req);
    if (!mapId) return badRequest("mapId é obrigatório");

    const body = await req.json();
    const data: { x?: number; y?: number; color?: string | null } = {};

    if (body.x !== undefined || body.y !== undefined) {
      const x = num(body.x);
      const y = num(body.y);
      if (x === null || y === null) return badRequest("x e y são obrigatórios");
      data.x = x;
      data.y = y;
    }

    if (body.color !== undefined) {
      const color = str(body.color);
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        return badRequest("Cor inválida");
      }
      data.color = color;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("Nenhuma alteração informada");
    }

    const node = await prisma.activityMapNode.update({
      where: { mapId_activityId: { mapId, activityId } },
      data,
    });
    return ok(node);
  } catch (e) {
    return serverError(e);
  }
}

/** Tira a atividade deste mapa. A atividade continua existindo. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { activityId } = await params;
    const mapId = mapIdFrom(req);
    if (!mapId) return badRequest("mapId é obrigatório");

    await deleteConnectionsForEndpoint(mapId, "activity", activityId);
    await prisma.activityMapNode.delete({
      where: { mapId_activityId: { mapId, activityId } },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
