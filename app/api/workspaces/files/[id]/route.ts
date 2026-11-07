import type { Prisma } from "@/app/generated/prisma-postgres/client";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str, num } from "@/lib/api";
import { fileSummarySelect, nextFileOrder } from "@/lib/workspaces-db";
import {
  CONTENT_MAX_LENGTH,
  DEFAULT_FILE_TITLE,
  TITLE_MAX_LENGTH,
  TITLE_TOO_LONG,
  documentExcerpt,
  isEditorDocument,
  parseEditorDocument,
} from "@/lib/workspaces";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const file = await prisma.workspaceFile.findUnique({ where: { id } });
    if (!file) return notFound("Arquivo não encontrado");

    const { content, ...summary } = file;
    return ok({ ...summary, content: parseEditorDocument(content) });
  } catch (e) {
    return serverError(e);
  }
}

/** Salva título, conteúdo (documento do editor) ou a pasta do arquivo. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();

    const current = await prisma.workspaceFile.findUnique({
      where: { id },
      select: { workspaceId: true, folderId: true },
    });
    if (!current) return notFound("Arquivo não encontrado");

    const data: Prisma.WorkspaceFileUncheckedUpdateInput = {};

    if (body.title !== undefined) {
      const title = str(body.title) ?? DEFAULT_FILE_TITLE;
      if (title.length > TITLE_MAX_LENGTH) return badRequest(TITLE_TOO_LONG);
      data.title = title;
    }

    if (body.content !== undefined) {
      if (!isEditorDocument(body.content)) {
        return badRequest("Conteúdo inválido");
      }
      const serialized = JSON.stringify(body.content);
      if (serialized.length > CONTENT_MAX_LENGTH) {
        return badRequest("O arquivo passou do tamanho máximo");
      }
      data.content = serialized;
      data.excerpt = documentExcerpt(body.content);
    }

    if (body.folderId !== undefined) {
      const folderId = str(body.folderId);
      if (folderId) {
        const folder = await prisma.workspaceFolder.findUnique({
          where: { id: folderId },
          select: { workspaceId: true },
        });
        if (!folder || folder.workspaceId !== current.workspaceId) {
          return badRequest("Pasta não encontrada neste espaço");
        }
      }
      if (folderId !== current.folderId) {
        data.folderId = folderId;
        data.order = await nextFileOrder(current.workspaceId, folderId);
      }
    }

    if (body.order !== undefined) {
      const order = num(body.order);
      if (order === null) return badRequest("Ordem inválida");
      data.order = Math.trunc(order);
    }

    const file = await prisma.workspaceFile.update({
      where: { id },
      data,
      select: fileSummarySelect,
    });
    return ok(file);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { count } = await prisma.workspaceFile.deleteMany({ where: { id } });
    if (count === 0) return notFound("Arquivo não encontrado");
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
