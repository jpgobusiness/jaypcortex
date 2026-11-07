import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { endpointExists } from "@/lib/mind-map";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mapId = str(body.mapId);
    const fromActivityId = str(body.fromActivityId);
    const toActivityId = str(body.toActivityId);
    if (!mapId || !fromActivityId || !toActivityId) {
      return badRequest("Mapa, origem e destino são obrigatórios");
    }
    if (fromActivityId === toActivityId) {
      return badRequest("Uma atividade não pode apontar para ela mesma");
    }

    const [fromNode, toNode] = await Promise.all([
      endpointExists(mapId, "activity", fromActivityId),
      endpointExists(mapId, "activity", toActivityId),
    ]);
    if (!fromNode || !toNode) {
      return badRequest("As duas atividades precisam estar neste mapa");
    }

    const edge = await prisma.mindMapConnection.upsert({
      where: {
        mapId_fromType_fromId_toType_toId: {
          mapId,
          fromType: "activity",
          fromId: fromActivityId,
          toType: "activity",
          toId: toActivityId,
        },
      },
      create: {
        mapId,
        fromType: "activity",
        fromId: fromActivityId,
        fromSide: "right",
        toType: "activity",
        toId: toActivityId,
        toSide: "left",
      },
      update: {},
    });
    return ok(edge, 201);
  } catch (e) {
    return serverError(e);
  }
}
