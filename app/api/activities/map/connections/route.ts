import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import {
  endpointExists,
  isEndpointType,
  isMindMapSide,
} from "@/lib/mind-map";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mapId = str(body.mapId);
    const fromType = str(body.fromType);
    const fromId = str(body.fromId);
    const fromSide = str(body.fromSide) ?? "right";
    const toType = str(body.toType);
    const toId = str(body.toId);
    const toSide = str(body.toSide) ?? "left";

    if (
      !mapId ||
      !fromId ||
      !toId ||
      !isEndpointType(fromType) ||
      !isEndpointType(toType) ||
      !isMindMapSide(fromSide) ||
      !isMindMapSide(toSide)
    ) {
      return badRequest("Ligação inválida");
    }
    if (fromType === toType && fromId === toId) {
      return badRequest("Um elemento não pode apontar para ele mesmo");
    }

    const [fromExists, toExists] = await Promise.all([
      endpointExists(mapId, fromType, fromId),
      endpointExists(mapId, toType, toId),
    ]);
    if (!fromExists || !toExists) {
      return badRequest("Os dois elementos precisam estar neste mapa");
    }

    const connection = await prisma.mindMapConnection.upsert({
      where: {
        mapId_fromType_fromId_toType_toId: {
          mapId,
          fromType,
          fromId,
          toType,
          toId,
        },
      },
      create: {
        mapId,
        fromType,
        fromId,
        fromSide,
        toType,
        toId,
        toSide,
      },
      update: { fromSide, toSide },
    });
    return ok(connection, 201);
  } catch (e) {
    return serverError(e);
  }
}
