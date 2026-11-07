import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str, num } from "@/lib/api";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_TOO_LONG,
  NAME_MAX_LENGTH,
  NAME_TOO_LONG,
  isHexColor,
} from "@/lib/workspaces";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Prisma.WorkspaceUpdateInput = {};

    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return badRequest("Nome do espaço é obrigatório");
      if (name.length > NAME_MAX_LENGTH) return badRequest(NAME_TOO_LONG);
      data.name = name;
    }
    if (body.description !== undefined) {
      const description = str(body.description);
      if (description && description.length > DESCRIPTION_MAX_LENGTH) {
        return badRequest(DESCRIPTION_TOO_LONG);
      }
      data.description = description;
    }
    if (body.color !== undefined) {
      if (!isHexColor(body.color)) return badRequest("Cor inválida");
      data.color = body.color;
    }
    if (body.order !== undefined) {
      const order = num(body.order);
      if (order === null) return badRequest("Ordem inválida");
      data.order = Math.trunc(order);
    }

    const exists = await prisma.workspace.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return notFound("Espaço não encontrado");

    const workspace = await prisma.workspace.update({ where: { id }, data });
    return ok(workspace);
  } catch (e) {
    return serverError(e);
  }
}

/** Apaga o espaço com todas as pastas e arquivos dele. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { count } = await prisma.workspace.deleteMany({ where: { id } });
    if (count === 0) return notFound("Espaço não encontrado");
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
