import { prisma } from "@/lib/prisma";

export type MindMapEndpointType = "activity" | "shape";
export type MindMapSide = "left" | "right" | "top" | "bottom";

export function isEndpointType(value: unknown): value is MindMapEndpointType {
  return value === "activity" || value === "shape";
}

export function isMindMapSide(value: unknown): value is MindMapSide {
  return (
    value === "left" ||
    value === "right" ||
    value === "top" ||
    value === "bottom"
  );
}

export async function endpointExists(
  mapId: string,
  type: MindMapEndpointType,
  id: string
) {
  if (type === "activity") {
    return Boolean(
      await prisma.activityMapNode.findUnique({
        where: { mapId_activityId: { mapId, activityId: id } },
        select: { id: true },
      })
    );
  }
  return Boolean(
    await prisma.mindMapShape.findFirst({
      where: { id, mapId },
      select: { id: true },
    })
  );
}

export async function deleteConnectionsForEndpoint(
  mapId: string,
  type: MindMapEndpointType,
  id: string
) {
  await prisma.mindMapConnection.deleteMany({
    where: {
      mapId,
      OR: [
        { fromType: type, fromId: id },
        { toType: type, toId: id },
      ],
    },
  });
}
