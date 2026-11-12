import type { Prisma } from "@/app/generated/prisma-postgres/client";
import { prisma } from "@/lib/prisma";

/** Campos do arquivo usados em listas (sem o conteúdo, que pode ser grande). */
export const fileSummarySelect = {
  id: true,
  workspaceId: true,
  folderId: true,
  title: true,
  excerpt: true,
  order: true,
  kind: true,
  tags: true,
  indexStatus: true,
  indexedAt: true,
  source: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceFileSelect;

const assetSummarySelect = {
  id: true,
  workspaceId: true,
  folderId: true,
  kind: true,
  name: true,
  mimeType: true,
  size: true,
  source: true,
  createdAt: true,
} satisfies Prisma.FolderAssetSelect;

const anexoWhere = { kind: { not: "entrega" } } as const;

/** Espaços com pastas, arquivos e anexos, na ordem do menu. */
export function findWorkspaceTrees(where?: Prisma.WorkspaceWhereInput) {
  return prisma.workspace.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      folders: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
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
          files: {
            select: fileSummarySelect,
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
          assets: {
            where: anexoWhere,
            select: assetSummarySelect,
            orderBy: { createdAt: "desc" },
          },
        },
      },
      files: {
        where: { folderId: null },
        select: fileSummarySelect,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      assets: {
        where: { folderId: null, ...anexoWhere },
        select: assetSummarySelect,
        orderBy: { createdAt: "desc" },
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
