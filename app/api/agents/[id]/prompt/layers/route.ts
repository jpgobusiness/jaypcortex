import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { isPromptLayer } from "@/lib/knowledge/kinds";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const layers = await prisma.agentPromptLayer.findMany({
      where: { agentId: id },
      include: { file: { select: { id: true, title: true, indexStatus: true, updatedAt: true, workspaceId: true } } },
      orderBy: { order: "asc" },
    });
    return ok(layers);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    if (!Array.isArray(body.layers)) return badRequest("layers[]");
    for (const item of body.layers) {
      if (!item?.id) continue;
      await prisma.agentPromptLayer.update({
        where: { id: String(item.id) },
        data: {
          ...(typeof item.order === "number" ? { order: item.order } : {}),
          ...(typeof item.enabled === "boolean" ? { enabled: item.enabled } : {}),
          ...(isPromptLayer(item.layer) ? { layer: item.layer } : {}),
        },
      });
    }
    const layers = await prisma.agentPromptLayer.findMany({
      where: { agentId: id },
      orderBy: { order: "asc" },
    });
    return ok(layers);
  } catch (e) {
    return serverError(e);
  }
}
