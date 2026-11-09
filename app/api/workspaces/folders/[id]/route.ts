import type { Prisma } from "@/app/generated/prisma-postgres/client";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str, num } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { linkOpportunityFolder } from "@/lib/opportunities/service";
import { NAME_MAX_LENGTH, NAME_TOO_LONG } from "@/lib/workspaces";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Prisma.WorkspaceFolderUpdateInput = {};

    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return badRequest("Nome da pasta é obrigatório");
      if (name.length > NAME_MAX_LENGTH) return badRequest(NAME_TOO_LONG);
      data.name = name;
    }
    if (body.order !== undefined) {
      const order = num(body.order);
      if (order === null) return badRequest("Ordem inválida");
      data.order = Math.trunc(order);
    }

    const exists = await prisma.workspaceFolder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return notFound("Pasta não encontrada");

    if (body.opportunityId !== undefined || body.opportunity_id !== undefined) {
      const linked = await linkOpportunityFolder({
        folder_id: id,
        opportunity_id: str(body.opportunityId) ?? str(body.opportunity_id) ?? "",
        createdBy: profile.id,
        source: "ui",
      });
      if (body.name === undefined && body.order === undefined) return ok(linked);
    }

    const folder = await prisma.workspaceFolder.update({
      where: { id },
      data,
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
            client: true,
            value: true,
            stage: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
    return ok(folder);
  } catch (e) {
    return serverError(e);
  }
}

/** Apaga a pasta e os arquivos dentro dela. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { count } = await prisma.workspaceFolder.deleteMany({ where: { id } });
    if (count === 0) return notFound("Pasta não encontrada");
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
