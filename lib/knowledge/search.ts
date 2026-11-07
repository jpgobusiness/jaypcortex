import { prisma } from "@/lib/prisma";
import { embeddings, toVectorLiteral } from "@/lib/knowledge/embeddings";

export type KnowledgeHit = {
  fileId: string;
  title: string;
  headingPath: string;
  content: string;
  score: number;
};

const HIT_CONTENT_MAX = 2500;

function clipHit(row: KnowledgeHit): KnowledgeHit {
  const content = row.content ?? "";
  return {
    fileId: row.fileId,
    title: row.title,
    headingPath: row.headingPath ?? "",
    content: content.length > HIT_CONTENT_MAX ? content.slice(0, HIT_CONTENT_MAX) + "…" : content,
    score: Number(row.score) || 0,
  };
}

async function searchKnowledgeFallback(opts: {
  query: string;
  agentId?: string | null;
  kinds?: string[];
  topK: number;
}): Promise<KnowledgeHit[]> {
  const files = await prisma.workspaceFile.findMany({
    where: {
      ...(opts.agentId
        ? {
            OR: [
              { knowledge: { some: { agentId: opts.agentId } } },
              { workspace: { agent: { id: opts.agentId } } },
            ],
          }
        : {}),
      ...(opts.kinds?.length ? { kind: { in: opts.kinds } } : {}),
      OR: [
        { title: { contains: opts.query, mode: "insensitive" } },
        { searchText: { contains: opts.query, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, searchText: true },
    take: opts.topK,
  });
  return files.map((file) =>
    clipHit({
      fileId: file.id,
      title: file.title,
      headingPath: "",
      content: file.searchText || "",
      score: 0.2,
    })
  );
}

export async function searchKnowledge(opts: {
  query: string;
  agentId?: string | null;
  kinds?: string[];
  topK?: number;
  hybridWeight?: number;
}): Promise<KnowledgeHit[]> {
  const query = opts.query.trim();
  if (!query) return [];
  const topK = Math.min(Math.max(opts.topK ?? 8, 1), 40);
  const hybridWeight = opts.hybridWeight ?? 0.6;
  const kinds = opts.kinds?.length ? opts.kinds : null;

  let vectorSql: string | null = null;
  try {
    const vectors = await embeddings.embed([query]);
    if (vectors?.[0]) vectorSql = toVectorLiteral(vectors[0]);
  } catch (err) {
    console.error("search embed failed", err);
  }

  try {
    const rows = vectorSql
      ? await prisma.$queryRawUnsafe<KnowledgeHit[]>(
          `SELECT "fileId", title, "headingPath", content, score
           FROM public.match_knowledge($1::vector, $2, $3, $4::text[], $5, $6)`,
          vectorSql,
          query,
          opts.agentId ?? null,
          kinds,
          topK,
          hybridWeight
        )
      : await prisma.$queryRawUnsafe<KnowledgeHit[]>(
          `SELECT "fileId", title, "headingPath", content, score
           FROM public.match_knowledge(NULL::vector, $1, $2, $3::text[], $4, $5)`,
          query,
          opts.agentId ?? null,
          kinds,
          topK,
          hybridWeight
        );
    return rows.map(clipHit);
  } catch (err) {
    console.error("match_knowledge failed, using fallback", err);
    return searchKnowledgeFallback({
      query,
      agentId: opts.agentId,
      kinds: opts.kinds,
      topK,
    });
  }
}

export async function resolveAgentId(slugOrId: string | null | undefined): Promise<string | null> {
  if (!slugOrId) return null;
  const key = slugOrId.trim();
  if (!key) return null;
  const exact = await prisma.agent.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true },
  });
  if (exact) return exact.id;
  const named = await prisma.agent.findMany({
    where: { name: { equals: key, mode: "insensitive" } },
    select: { id: true },
    take: 2,
  });
  if (named.length === 1) return named[0].id;
  return null;
}
