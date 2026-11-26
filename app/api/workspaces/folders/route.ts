import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { nextFolderOrder } from "@/lib/workspaces-db";
import { NAME_MAX_LENGTH, NAME_TOO_LONG } from "@/lib/workspaces";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const workspaceId = str(body.workspaceId);
    if (!workspaceId) return badRequest("Espaço é obrigatório");
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) return badRequest("Espaço não encontrado");

    const name = str(body.name);
    if (!name) return badRequest("Nome da pasta é obrigatório");
    if (name.length > NAME_MAX_LENGTH) return badRequest(NAME_TOO_LONG);

    const parentFolderId = str(body.parentFolderId);
    if (parentFolderId) {
      const parent = await prisma.workspaceFolder.findUnique({
        where: { id: parentFolderId },
        select: { workspaceId: true },
      });
      if (!parent || parent.workspaceId !== workspaceId) return badRequest("Pasta pai não encontrada neste espaço");
    }

    const folder = await prisma.workspaceFolder.create({
      data: {
        workspaceId,
        parentFolderId: parentFolderId || null,
        name,
        order: await nextFolderOrder(workspaceId, parentFolderId || null),
      },
    });
    return ok({ ...folder, files: [] }, 201);
  } catch (e) {
    return serverError(e);
  }
}
