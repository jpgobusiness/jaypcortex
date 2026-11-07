import { ok, badRequest, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { resolveAgentId, searchKnowledge } from "@/lib/knowledge/search";

export async function GET(req: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";
    if (!query.trim()) return badRequest("q é obrigatório");
    const agent = url.searchParams.get("agent");
    const kinds = url.searchParams.getAll("kind");
    const topK = Number(url.searchParams.get("topK") ?? 8);
    const agentId = agent ? await resolveAgentId(agent) : null;
    const hits = await searchKnowledge({ query, agentId, kinds, topK });
    return ok(hits);
  } catch (e) {
    return serverError(e);
  }
}
