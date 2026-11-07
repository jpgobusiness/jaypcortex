import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { fileSummarySelect, nextFileOrder } from "@/lib/workspaces-db";
import {
  DEFAULT_FILE_TITLE,
  TITLE_MAX_LENGTH,
  TITLE_TOO_LONG,
} from "@/lib/workspaces";

/** Cria um arquivo vazio no espaço, solto ou dentro de uma pasta. */
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

    const folderId = str(body.folderId);
    if (folderId) {
      const folder = await prisma.workspaceFolder.findUnique({
        where: { id: folderId },
        select: { workspaceId: true },
      });
      if (!folder || folder.workspaceId !== workspaceId) {
        return badRequest("Pasta não encontrada neste espaço");
      }
    }

    const title = str(body.title) ?? DEFAULT_FILE_TITLE;
    if (title.length > TITLE_MAX_LENGTH) return badRequest(TITLE_TOO_LONG);

    const file = await prisma.workspaceFile.create({
      data: {
        workspaceId,
        folderId,
        title,
        order: await nextFileOrder(workspaceId, folderId),
      },
      select: fileSummarySelect,
    });
    return ok(file, 201);
  } catch (e) {
    return serverError(e);
  }
}
