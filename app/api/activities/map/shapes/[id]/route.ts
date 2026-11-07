import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";
import { deleteConnectionsForEndpoint } from "@/lib/mind-map";

type Ctx = { params: Promise<{ id: string }> };

function mapIdFrom(req: Request) {
  return new URL(req.url).searchParams.get("mapId");
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const mapId = mapIdFrom(req);
    if (!mapId) return badRequest("mapId é obrigatório");

    const existing = await prisma.mindMapShape.findFirst({
      where: { id, mapId },
      select: { id: true },
    });
    if (!existing) return badRequest("Forma não encontrada neste mapa");

    const body = await req.json();
    const data: {
      kind?: string;
      label?: string | null;
      iconName?: string | null;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      color?: string;
      zIndex?: number;
    } = {};

    if (body.kind !== undefined) {
      const kind = str(body.kind);
      if (!kind) return badRequest("Tipo de forma inválido");
      data.kind = kind;
    }
    if (body.label !== undefined) data.label = str(body.label);
    if (body.iconName !== undefined) data.iconName = str(body.iconName);
    if (body.x !== undefined) {
      const x = num(body.x);
      if (x === null) return badRequest("Posição X inválida");
      data.x = x;
    }
    if (body.y !== undefined) {
      const y = num(body.y);
      if (y === null) return badRequest("Posição Y inválida");
      data.y = y;
    }
    if (body.width !== undefined) {
      const width = num(body.width);
      if (width === null) return badRequest("Largura inválida");
      data.width = Math.max(48, width);
    }
    if (body.height !== undefined) {
      const height = num(body.height);
      if (height === null) return badRequest("Altura inválida");
      data.height = Math.max(48, height);
    }
    if (body.color !== undefined) {
      const color = str(body.color);
      if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
        return badRequest("Cor inválida");
      }
      data.color = color;
    }
    if (body.zIndex !== undefined) {
      const zIndex = num(body.zIndex);
      if (zIndex === null) return badRequest("Ordem inválida");
      data.zIndex = Math.floor(zIndex);
    }
    if (Object.keys(data).length === 0) {
      return badRequest("Nenhuma alteração informada");
    }

    const shape = await prisma.mindMapShape.update({
      where: { id },
      data,
    });
    return ok(shape);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const mapId = mapIdFrom(req);
    if (!mapId) return badRequest("mapId é obrigatório");

    const existing = await prisma.mindMapShape.findFirst({
      where: { id, mapId },
      select: { id: true },
    });
    if (!existing) return badRequest("Forma não encontrada neste mapa");

    await deleteConnectionsForEndpoint(mapId, "shape", id);
    await prisma.mindMapShape.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
