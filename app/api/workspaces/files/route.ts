import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { isDocumentKind } from "@/lib/knowledge/kinds";
import { createFileInFolder } from "@/lib/opportunities/service";
import { fileSummarySelect, nextFileOrder } from "@/lib/workspaces-db";
import {
  DEFAULT_FILE_TITLE,
  TITLE_MAX_LENGTH,
  TITLE_TOO_LONG,
} from "@/lib/workspaces";

/** Cria um arquivo vazio no espaço, solto ou dentro de uma pasta. */
export async function POST(req: Request) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
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
    const kind = isDocumentKind(body.kind) ? body.kind : undefined;

    if (folderId && str(body.title) && kind) {
      const saved = await createFileInFolder({
        folder_id: folderId,
        title,
        kind,
        createdBy: profile.id,
        source: "ui",
      });
      const file = await prisma.workspaceFile.findUnique({
        where: { id: saved.file_id ?? "" },
        select: fileSummarySelect,
      });
      if (file) return ok(file, 201);
    }

    const file = await prisma.workspaceFile.create({
      data: {
        workspaceId,
        folderId,
        title,
        ...(kind ? { kind } : {}),
        order: await nextFileOrder(workspaceId, folderId),
        updatedBy: profile.id,
        source: "ui",
      },
      select: fileSummarySelect,
    });
    return ok(file, 201);
  } catch (e) {
    return serverError(e);
  }
}
