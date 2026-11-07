import { prisma } from "@/lib/prisma";
import { contentHash } from "@/lib/knowledge/hash";
import { chunkDocument } from "@/lib/knowledge/chunking";
import { embeddings, toVectorLiteral } from "@/lib/knowledge/embeddings";
import { tiptapToPlainText } from "@/lib/knowledge/tiptap-text";
import { documentExcerpt, parseEditorDocument } from "@/lib/workspaces";
import { createId } from "@/lib/knowledge/id";

const SYNC_CHUNK_LIMIT = 30;

export type IndexResult = {
  fileId: string;
  status: "indexed" | "skipped" | "pending" | "error";
  chunks: number;
  reused: boolean;
  error?: string;
};

export async function indexFile(fileId: string, opts?: { force?: boolean }): Promise<IndexResult> {
  const file = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
  if (!file) return { fileId, status: "error", chunks: 0, reused: false, error: "Arquivo não encontrado" };

  const doc = parseEditorDocument(file.content);
  const searchText = tiptapToPlainText(doc);
  const excerpt = doc ? documentExcerpt(doc) : "";
  const hash = contentHash(file.content, file.title);

  if (!opts?.force && file.contentHash === hash && file.indexStatus === "indexed") {
    return { fileId, status: "indexed", chunks: 0, reused: true };
  }

  const chunks = chunkDocument(file.title, doc);

  await prisma.workspaceFile.update({
    where: { id: fileId },
    data: { searchText, excerpt, contentHash: hash, indexStatus: "pending" },
  });

  if (chunks.length > SYNC_CHUNK_LIMIT) {
    return { fileId, status: "pending", chunks: chunks.length, reused: false };
  }

  try {
    let vectors: number[][] | null = null;
    try {
      vectors = await embeddings.embed(chunks.map((c) => c.content));
    } catch (err) {
      console.error("embeddings failed", err);
      vectors = null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { fileId } });
      for (const chunk of chunks) {
        const id = createId();
        const embedding = vectors?.[chunk.chunkIndex];
        if (embedding) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "KnowledgeChunk" ("id","fileId","chunkIndex","headingPath","content","tokenCount","embedding")
             VALUES ($1,$2,$3,$4,$5,$6,$7::vector)`,
            id,
            fileId,
            chunk.chunkIndex,
            chunk.headingPath,
            chunk.content,
            chunk.tokenCount,
            toVectorLiteral(embedding)
          );
        } else {
          await tx.knowledgeChunk.create({
            data: {
              id,
              fileId,
              chunkIndex: chunk.chunkIndex,
              headingPath: chunk.headingPath,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
            },
          });
        }
      }
      await tx.workspaceFile.update({
        where: { id: fileId },
        data: {
          indexedAt: new Date(),
          indexStatus: vectors ? "indexed" : "skipped",
        },
      });
    });

    return {
      fileId,
      status: vectors ? "indexed" : "skipped",
      chunks: chunks.length,
      reused: false,
    };
  } catch (err) {
    await prisma.workspaceFile.update({
      where: { id: fileId },
      data: { indexStatus: "error" },
    });
    return {
      fileId,
      status: "error",
      chunks: chunks.length,
      reused: false,
      error: err instanceof Error ? err.message : "index error",
    };
  }
}

export async function reindexPending(limit = 40): Promise<IndexResult[]> {
  const files = await prisma.workspaceFile.findMany({
    where: { indexStatus: { in: ["pending", "error"] } },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  const out: IndexResult[] = [];
  for (const file of files) {
    out.push(await indexFile(file.id, { force: true }));
  }
  return out;
}

export async function reindexAll(limit = 200): Promise<IndexResult[]> {
  const files = await prisma.workspaceFile.findMany({
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  const out: IndexResult[] = [];
  for (const file of files) {
    out.push(await indexFile(file.id, { force: true }));
  }
  return out;
}
