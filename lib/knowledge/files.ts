import { prisma } from "@/lib/prisma";
import { contentHash } from "@/lib/knowledge/hash";
import { indexFile } from "@/lib/knowledge/indexer";
import { isDocumentKind } from "@/lib/knowledge/kinds";
import { markdownToTiptap, sanitizeTiptap, tiptapToMarkdown } from "@/lib/knowledge/markdown";
import { fileSummarySelect, nextFileOrder } from "@/lib/workspaces-db";
import {
  CONTENT_MAX_LENGTH,
  DEFAULT_FILE_TITLE,
  documentExcerpt,
  isEditorDocument,
  parseEditorDocument,
} from "@/lib/workspaces";
import type { EditorDocument } from "@/lib/types";

export { fileSummarySelect };

export const fileMetaSelect = {
  ...fileSummarySelect,
  kind: true,
  tags: true,
  indexStatus: true,
  indexedAt: true,
  source: true,
  contentHash: true,
  updatedBy: true,
} as const;

export async function saveFileRevision(opts: {
  fileId: string;
  title: string;
  content: string;
  createdBy?: string | null;
  source: string;
  proposalId?: string | null;
}) {
  const hash = contentHash(opts.content, opts.title);
  const last = await prisma.fileRevision.findFirst({
    where: { fileId: opts.fileId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  if (last?.hash === hash) return;
  await prisma.fileRevision.create({
    data: {
      fileId: opts.fileId,
      title: opts.title,
      content: opts.content,
      hash,
      createdBy: opts.createdBy ?? null,
      source: opts.source,
      proposalId: opts.proposalId ?? null,
    },
  });
}

export async function upsertFileContent(opts: {
  fileId?: string;
  workspaceId?: string;
  folderId?: string | null;
  title?: string;
  content?: EditorDocument | string;
  kind?: string;
  tags?: string[];
  createdBy?: string | null;
  source?: string;
  proposalId?: string | null;
}) {
  const source = opts.source ?? "ui";
  let doc: EditorDocument;
  if (typeof opts.content === "string") doc = markdownToTiptap(opts.content);
  else if (opts.content) doc = sanitizeTiptap(opts.content);
  else doc = { type: "doc", content: [{ type: "paragraph" }] };

  const serialized = JSON.stringify(doc);
  if (serialized.length > CONTENT_MAX_LENGTH) {
    throw new Error("O arquivo passou do tamanho máximo");
  }
  const title = (opts.title?.trim() || DEFAULT_FILE_TITLE).slice(0, 200);
  const kind = isDocumentKind(opts.kind) ? opts.kind : undefined;
  const tags = opts.tags?.map((t) => t.trim()).filter(Boolean);

  let fileId = opts.fileId;
  if (!fileId) {
    const workspaceId = opts.workspaceId;
    if (!workspaceId) throw new Error("Espaço é obrigatório");
    const folderId = opts.folderId ?? null;
    const created = await prisma.workspaceFile.create({
      data: {
        workspaceId,
        folderId,
        title,
        content: serialized,
        excerpt: documentExcerpt(doc),
        kind: kind ?? "contexto",
        tags: tags ?? [],
        source,
        updatedBy: opts.createdBy ?? null,
        order: await nextFileOrder(workspaceId, folderId),
      },
    });
    fileId = created.id;
  } else {
    await prisma.workspaceFile.update({
      where: { id: fileId },
      data: {
        title,
        content: serialized,
        excerpt: documentExcerpt(doc),
        ...(kind ? { kind } : {}),
        ...(tags ? { tags } : {}),
        source,
        updatedBy: opts.createdBy ?? null,
      },
    });
  }

  await saveFileRevision({
    fileId,
    title,
    content: serialized,
    createdBy: opts.createdBy,
    source,
    proposalId: opts.proposalId,
  });
  const index = await indexFile(fileId);
  const file = await prisma.workspaceFile.findUnique({
    where: { id: fileId },
    select: fileMetaSelect,
  });
  return { file, index, markdown: tiptapToMarkdown(doc), hash: contentHash(serialized, title) };
}

export function fileDoc(content: string): EditorDocument | null {
  const parsed = parseEditorDocument(content);
  return parsed && isEditorDocument(parsed) ? parsed : null;
}
