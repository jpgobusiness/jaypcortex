import { prisma } from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/api";
import { listKnowledge } from "@/lib/agents-db";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Tira o documento da base do agente. O documento continua no espaço dele. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, fileId } = await params;
    const { count } = await prisma.agentKnowledge.deleteMany({
      where: { agentId: id, fileId },
    });
    if (count === 0) return notFound("Documento não está na base deste agente");
    return ok({ items: await listKnowledge(id) });
  } catch (e) {
    return serverError(e);
  }
}
