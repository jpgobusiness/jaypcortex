import { prisma } from "@/lib/prisma";
import { embeddings, toVectorLiteral } from "@/lib/knowledge/embeddings";

export type KnowledgeHit = {
  fileId: string;
  title: string;
  headingPath: string;
  content: string;
  score: number;
};

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

  return rows.map((row) => ({
    ...row,
    score: Number(row.score),
  }));
}

export async function resolveAgentId(slugOrId: string | null | undefined): Promise<string | null> {
  if (!slugOrId) return null;
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: { id: true },
  });
  return agent?.id ?? null;
}
