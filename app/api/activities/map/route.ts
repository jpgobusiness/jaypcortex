import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";

const activityInclude = {
  type: true,
  opportunity: { select: { id: true, name: true } },
} as const;

export async function GET(req: Request) {
  try {
    const mapId = new URL(req.url).searchParams.get("mapId");
    if (!mapId) return badRequest("mapId é obrigatório");

    const map = await prisma.mindMap.findUnique({ where: { id: mapId } });
    if (!map) return badRequest("Mapa não encontrado");

    const [nodes, shapes, connections] = await Promise.all([
      prisma.activityMapNode.findMany({
        where: { mapId },
        include: { activity: { include: activityInclude } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.mindMapShape.findMany({
        where: { mapId },
        orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
      }),
      prisma.mindMapConnection.findMany({
        where: { mapId },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const edges = connections
      .filter(
        (connection) =>
          connection.fromType === "activity" &&
          connection.toType === "activity"
      )
      .map((connection) => ({
        id: connection.id,
        fromActivityId: connection.fromId,
        toActivityId: connection.toId,
      }));
    return ok({ map, nodes, shapes, connections, edges });
  } catch (e) {
    return serverError(e);
  }
}

/** Coloca uma atividade existente no mapa. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mapId = str(body.mapId);
    const activityId = str(body.activityId);
    if (!mapId || !activityId) return badRequest("mapId e activityId são obrigatórios");

    const [map, activity] = await Promise.all([
      prisma.mindMap.findUnique({ where: { id: mapId } }),
      prisma.activity.findUnique({ where: { id: activityId } }),
    ]);
    if (!map) return badRequest("Mapa não encontrado");
    if (!activity) return badRequest("Atividade não encontrada");

    const x = num(body.x) ?? 80;
    const y = num(body.y) ?? 80;

    const node = await prisma.activityMapNode.upsert({
      where: { mapId_activityId: { mapId, activityId } },
      create: { mapId, activityId, x, y },
      update: { x, y },
      include: { activity: { include: activityInclude } },
    });
    return ok(node, 201);
  } catch (e) {
    return serverError(e);
  }
}
