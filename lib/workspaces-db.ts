import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Campos do arquivo usados em listas (sem o conteúdo, que pode ser grande). */
export const fileSummarySelect = {
  id: true,
  workspaceId: true,
  folderId: true,
  title: true,
  excerpt: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceFileSelect;

/** Espaços com pastas e arquivos, na ordem do menu. */
export function findWorkspaceTrees(where?: Prisma.WorkspaceWhereInput) {
  return prisma.workspace.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      folders: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          files: {
            select: fileSummarySelect,
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
        },
      },
      files: {
        where: { folderId: null },
        select: fileSummarySelect,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      // Preenchido quando o espaço é a sala de um agente do escritório.
      agent: { select: { id: true, name: true, isOrchestrator: true } },
    },
  });
}

export async function nextWorkspaceOrder() {
  const last = await prisma.workspace.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function nextFolderOrder(workspaceId: string) {
  const last = await prisma.workspaceFolder.findFirst({
    where: { workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function nextFileOrder(workspaceId: string, folderId: string | null) {
  const last = await prisma.workspaceFile.findFirst({
    where: { workspaceId, folderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}
