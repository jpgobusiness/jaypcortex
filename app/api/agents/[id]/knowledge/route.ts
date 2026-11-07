import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str } from "@/lib/api";
import { KNOWLEDGE_FOLDER } from "@/lib/agents";
import { listKnowledge } from "@/lib/agents-db";
import { nextFileOrder, nextFolderOrder } from "@/lib/workspaces-db";
import { DEFAULT_FILE_TITLE, TITLE_MAX_LENGTH, TITLE_TOO_LONG } from "@/lib/workspaces";

type Ctx = { params: Promise<{ id: string }> };

/** Documentos da base de conhecimento do agente. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const agent = await prisma.agent.findUnique({ where: { id }, select: { id: true } });
    if (!agent) return notFound("Agente não encontrado");
    return ok(await listKnowledge(id));
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Anexa um documento existente ({ fileId }) ou cria um documento novo na
 * pasta "Base de conhecimento" da sala do agente ({ title }) e já anexa.
 * Responde com a base atualizada e o id do arquivo.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { id: true, workspaceId: true },
    });
    if (!agent) return notFound("Agente não encontrado");

    let fileId = str(body?.fileId);

    if (fileId) {
      const file = await prisma.workspaceFile.findUnique({
        where: { id: fileId },
        select: { id: true },
      });
      if (!file) return badRequest("Documento não encontrado");
    } else {
      if (!agent.workspaceId) {
        return badRequest("Este agente não tem sala para guardar o documento");
      }
      const title = str(body?.title) ?? DEFAULT_FILE_TITLE;
      if (title.length > TITLE_MAX_LENGTH) return badRequest(TITLE_TOO_LONG);
      const workspaceId = agent.workspaceId;

      fileId = await prisma.$transaction(async (tx) => {
        let folder = await tx.workspaceFolder.findFirst({
          where: { workspaceId, name: KNOWLEDGE_FOLDER },
          select: { id: true },
        });
        if (!folder) {
          folder = await tx.workspaceFolder.create({
            data: { workspaceId, name: KNOWLEDGE_FOLDER, order: await nextFolderOrder(workspaceId) },
            select: { id: true },
          });
        }
        const file = await tx.workspaceFile.create({
          data: {
            workspaceId,
            folderId: folder.id,
            title,
            order: await nextFileOrder(workspaceId, folder.id),
          },
          select: { id: true },
        });
        return file.id;
      });
    }

    const exists = await prisma.agentKnowledge.findUnique({
      where: { agentId_fileId: { agentId: id, fileId } },
      select: { id: true },
    });
    if (!exists) {
      await prisma.agentKnowledge.create({ data: { agentId: id, fileId } });
    }

    return ok({ fileId, items: await listKnowledge(id) }, 201);
  } catch (e) {
    return serverError(e);
  }
}
