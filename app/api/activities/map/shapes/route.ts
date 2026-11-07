import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mapId = str(body.mapId);
    const kind = str(body.kind) ?? "rectangle";
    if (!mapId) return badRequest("mapId é obrigatório");

    const map = await prisma.mindMap.findUnique({
      where: { id: mapId },
      select: { id: true },
    });
    if (!map) return badRequest("Mapa não encontrado");

    const max = await prisma.mindMapShape.aggregate({
      where: { mapId },
      _max: { zIndex: true },
    });
    const color = str(body.color) ?? "#dbeafe";
    if (!/^#[0-9a-f]{6}$/i.test(color)) return badRequest("Cor inválida");

    const shape = await prisma.mindMapShape.create({
      data: {
        mapId,
        kind,
        label: str(body.label),
        iconName: str(body.iconName),
        x: num(body.x) ?? 80,
        y: num(body.y) ?? 80,
        width: Math.max(48, num(body.width) ?? 160),
        height: Math.max(48, num(body.height) ?? 90),
        color,
        zIndex: (max._max.zIndex ?? 0) + 1,
      },
    });
    return ok(shape, 201);
  } catch (e) {
    return serverError(e);
  }
}
