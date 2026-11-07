import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api";
import { parseAgentInput, roomName } from "@/lib/agents";
import { getAgent } from "@/lib/agents-db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null) return badRequest("Dados inválidos");

    const current = await prisma.agent.findUnique({
      where: { id },
      select: {
        name: true,
        shirtColor: true,
        isOrchestrator: true,
        workspace: { select: { id: true, name: true, color: true } },
      },
    });
    if (!current) return notFound("Agente não encontrado");

    const parsed = parseAgentInput(body as Record<string, unknown>, { partial: true });
    if ("error" in parsed) return badRequest(parsed.error);
    const data = { ...parsed.data };
    if (current.isOrchestrator) {
      // O orquestrador é o robô: a aparência não muda.
      delete data.skinTone;
      delete data.hairStyle;
      delete data.hairColor;
      delete data.shirtColor;
      delete data.accessory;
    }

    // A sala acompanha o nome e a cor, se o usuário ainda não mudou a sala.
    const room = current.workspace;
    const roomUpdate: { name?: string; color?: string } = {};
    if (room && data.name && data.name !== current.name && room.name === roomName(current.name)) {
      roomUpdate.name = roomName(data.name);
    }
    if (room && data.shirtColor && room.color === current.shirtColor) {
      roomUpdate.color = data.shirtColor;
    }

    await prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id }, data });
      if (room && Object.keys(roomUpdate).length > 0) {
        await tx.workspace.update({ where: { id: room.id }, data: roomUpdate });
      }
    });

    return ok(await getAgent(id));
  } catch (e) {
    return serverError(e);
  }
}

/** Exclui o agente. A sala dele continua em Espaços de Trabalho. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { isOrchestrator: true },
    });
    if (!agent) return notFound("Agente não encontrado");
    if (agent.isOrchestrator) return badRequest("O orquestrador não pode ser excluído");

    await prisma.agent.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
