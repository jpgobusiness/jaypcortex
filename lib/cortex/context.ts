import { composeAgentPrompt } from "@/lib/agents/prompt-composer";
import { prisma } from "@/lib/prisma";
import { searchKnowledge, resolveAgentId } from "@/lib/knowledge/search";
import { asAgentRouting } from "@/lib/cortex/routing-schema";
import { liveDataFor } from "@/lib/cortex/live-data";
import { buildSuggestedTools } from "@/lib/cortex/suggested-tools";
import type { BusyBlock, CortexContext, CortexMode, CortexWorkMode, RouteResult } from "@/lib/cortex/types";

function instructions(opts: {
  agentName: string;
  mode: CortexMode;
}): string {
  return [
    `Responda como ${opts.agentName} seguindo agent_prompt.`,
    "Use live_data como fonte dos dados; knowledge como fonte de método.",
    "Execute suggested_tools nesta ordem.",
    "Não use search_knowledge para buscar tarefas.",
    opts.mode === "esclarecer" ? "O pedido é ambíguo: mostre 2–3 opções de candidates e pergunte qual agente/intent seguir." : "",
  ].filter(Boolean).join(" ");
}

export async function buildAgentContext(opts: {
  slug: string;
  request: string;
  routed?: RouteResult;
  date?: Date;
  busyBlocks?: BusyBlock[];
  includeKnowledge?: boolean;
  scopes: string[];
}): Promise<CortexContext> {
  const agentId = await resolveAgentId(opts.slug);
  const agent = agentId
    ? await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, slug: true, name: true, routing: true, activePromptVersionId: true },
      })
    : null;

  const routing = asAgentRouting(agent?.routing);
  const mode: CortexMode = opts.routed?.mode ?? routing.default_mode ?? "misto";
  const workMode = (mode === "esclarecer" ? routing.default_mode ?? "misto" : mode) as CortexWorkMode;

  let agent_prompt = "";
  if (agent) {
    if (agent.activePromptVersionId) {
      const published = await prisma.agentPromptVersion.findUnique({
        where: { id: agent.activePromptVersionId },
        select: { composedPrompt: true },
      });
      agent_prompt = published?.composedPrompt || "";
    }
    if (!agent_prompt) {
      try {
        agent_prompt = (await composeAgentPrompt(agent.id)).composed;
      } catch (err) {
        console.error("composeAgentPrompt", err);
      }
    }
  }

  let knowledge: CortexContext["knowledge"] = [];
  if (opts.includeKnowledge !== false && agent && (workMode === "conhecimento" || workMode === "misto")) {
    try {
      const hits = await searchKnowledge({
        query: opts.request,
        agentId: agent.id,
        kinds: routing.knowledge_kinds,
        topK: 6,
      });
      knowledge = hits.map((h) => ({
        title: h.title,
        headingPath: h.headingPath,
        fileId: h.fileId,
        score: h.score,
        content: h.content,
      }));
    } catch (err) {
      console.error("cortex knowledge", err);
    }
  }

  let live_data: unknown = null;
  const loader = agent?.slug ? liveDataFor(agent.slug) : null;
  if (loader && (workMode === "acao" || workMode === "misto")) {
    try {
      live_data = await loader(opts.request, { date: opts.date, busyBlocks: opts.busyBlocks });
    } catch (err) {
      console.error("cortex live_data", err);
      live_data = { error: err instanceof Error ? err.message : "falha live_data" };
    }
  }

  const suggested = await buildSuggestedTools({
    intent: opts.routed?.intent ?? null,
    request: opts.request,
    allowedTools: routing.allowed_tools,
    scopes: opts.scopes,
  });

  const name = agent?.name || opts.slug;
  const slug = agent?.slug || opts.slug;

  return {
    routed_to: agent
      ? {
          slug,
          name,
          reason: (opts.routed?.reasons ?? []).join("; ") || `agente ${name}`,
          confidence: opts.routed?.confidence ?? 1,
        }
      : null,
    mode,
    intent: opts.routed?.intent ? { key: opts.routed.intent.key, mode: opts.routed.intent.mode } : null,
    candidates: opts.routed?.candidates ?? [],
    agent_prompt,
    knowledge,
    live_data,
    suggested_tools: suggested.tools,
    instructions_for_client: instructions({ agentName: name, mode }),
    missing_scope: suggested.missing_scope.length ? suggested.missing_scope : undefined,
  };
}
