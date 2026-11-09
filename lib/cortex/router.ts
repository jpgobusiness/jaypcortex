import { prisma } from "@/lib/prisma";
import { normalize, tokenSet, tokens } from "@/lib/cortex/normalize";
import { asAgentRouting } from "@/lib/cortex/routing-schema";
import type {
  AgentRouting,
  CortexIntent,
  CortexWorkMode,
  RouteAgent,
  RouteCandidate,
  RouteResult,
} from "@/lib/cortex/types";

const STOP = new Set([
  "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as",
  "e", "ou", "pra", "para", "pro", "com", "em", "no", "na", "nos", "nas", "me",
  "minha", "minhas", "meu", "meus", "que", "eu", "voce", "isso", "essa", "esse",
  "como", "qual", "quais", "por", "mais", "menos",
]);

function coverage(requestTokens: Set<string>, terms: string[] | undefined): number {
  if (!terms?.length) return 0;
  let hit = 0;
  for (const term of terms) {
    const parts = tokens(term, 3).filter((t) => !STOP.has(t));
    if (!parts.length) continue;
    if (parts.every((p) => requestTokens.has(p) || [...requestTokens].some((r) => r.includes(p) || p.includes(r)))) {
      hit += 1;
    }
  }
  return hit / terms.length;
}

function phraseScore(requestNorm: string, example: string): number {
  const exampleNorm = normalize(example);
  if (!exampleNorm || !requestNorm) return 0;
  if (requestNorm.includes(exampleNorm) || exampleNorm.includes(requestNorm)) return 1;
  const req = new Set(tokens(requestNorm, 3).filter((t) => !STOP.has(t)));
  const ex = tokens(exampleNorm, 3).filter((t) => !STOP.has(t));
  if (!ex.length || !req.size) return 0;
  const hit = ex.filter((t) => req.has(t) || [...req].some((r) => r.includes(t) || t.includes(r))).length;
  return hit / ex.length;
}

function bestIntent(requestNorm: string, routing: AgentRouting): { intent: CortexIntent | null; score: number } {
  let best: CortexIntent | null = null;
  let score = 0;
  for (const intent of routing.intents ?? []) {
    const exampleBest = Math.max(0, ...(intent.examples ?? []).map((ex) => phraseScore(requestNorm, ex)));
    const kw = coverage(tokenSet(requestNorm, 3), intent.keywords);
    const local = Math.max(exampleBest, kw * 0.7);
    if (local > score) {
      score = local;
      best = intent;
    }
  }
  return { intent: best, score };
}

function isTimeAsk(norm: string) {
  return /(tempo|semana|agenda|atividade|tarefa|prioridade|briefing|hoje|fila|prazo|procrastinacao)/.test(norm);
}

function isMapAsk(norm: string) {
  return /(map|assess|aws|funding|migracao|7r|mobilize|workload)/.test(norm);
}

function isProposalAsk(norm: string) {
  if (/(tarefa|atividade|procrastin)/.test(norm) && !/(oportunidade|transcri|proposal doc)/.test(norm)) {
    return false;
  }
  return /(montar proposta|proposal doc|oportunidade|transcri[cç]ao|\bmpe\b|arquitetura da proposta|escopo da proposta|grava.*se[cç][aã]o)/.test(norm)
    || (/\bproposta\b/.test(norm) && !isMapAsk(norm));
}

function isMethodAsk(norm: string) {
  return /(como funciona|o que e|explica|metodologia|template)/.test(norm);
}

function mentionsOrchestrator(norm: string) {
  return /(cortex|orquestrador|qual agente|quem cuida|mapa do escritorio)/.test(norm);
}

export function scoreAgent(
  requestNorm: string,
  agent: RouteAgent,
  opts?: { ftsScore?: number }
): { score: number; intent: CortexIntent | null; mode: CortexWorkMode; reasons: string[] } {
  const routing = asAgentRouting(agent.routing);
  const reqTokens = tokenSet(requestNorm, 3);
  const { intent, score: intentScore } = bestIntent(requestNorm, routing);
  const kw = coverage(reqTokens, routing.keywords);
  const domains = coverage(reqTokens, routing.domains);
  const fts = Math.max(0, Math.min(1, opts?.ftsScore ?? 0));

  const score = intentScore * 0.62 + kw * 0.2 + domains * 0.1 + fts * 0.08;
  const reasons: string[] = [];
  if (intent && intentScore >= 0.5) reasons.push(`intent:${intent.key} (${intentScore.toFixed(2)})`);
  if (kw > 0) reasons.push(`keywords:${kw.toFixed(2)}`);
  if (domains > 0) reasons.push(`domains:${domains.toFixed(2)}`);
  if (fts > 0) reasons.push(`fts:${fts.toFixed(2)}`);

  const mode: CortexWorkMode = intent?.mode ?? routing.default_mode ?? "conhecimento";
  return { score, intent, mode, reasons };
}

export function routeFromAgents(
  request: string,
  agents: RouteAgent[],
  opts?: { agentHint?: string; ftsScores?: Record<string, number> }
): RouteResult {
  const normalized = normalize(request);
  const active = agents.filter((a) => (a.status ?? "active") !== "archived" && a.slug);

  const scored = active
    .filter((agent) => {
      if (!agent.isOrchestrator) return true;
      return mentionsOrchestrator(normalized) || opts?.agentHint === agent.slug;
    })
    .map((agent) => {
      const local = scoreAgent(normalized, agent, {
        ftsScore: opts?.ftsScores?.[agent.slug],
      });
      return { agent, ...local };
    });

  if (isProposalAsk(normalized) && !isMapAsk(normalized)) {
    const propostas = scored.find((s) => s.agent.slug === "propostas");
    if (propostas) {
      propostas.score = Math.max(propostas.score, 0.72);
      propostas.mode = "acao";
      if (!propostas.intent) {
        const routing = asAgentRouting(propostas.agent.routing);
        propostas.intent = routing.intents?.find((item) => item.key === "montar_proposta")
          ?? routing.intents?.[0]
          ?? null;
      }
      propostas.reasons.push("regra:proposta");
    }
  }

  // Tempo + MAP: pergunta de carga/semana cai no Gestor; "como funciona" cai no MAP.
  if (isTimeAsk(normalized) && isMapAsk(normalized)) {
    const tempo = scored.find((s) => s.agent.slug === "gestao-tempo");
    const map = scored.find((s) => s.agent.slug === "migracao-aws");
    if (tempo && map) {
      if (isMethodAsk(normalized)) {
        map.score = Math.max(map.score, tempo.score) + 0.2;
        map.mode = "conhecimento";
        map.reasons.push("regra:map-metodologia");
      } else {
        tempo.score = Math.max(tempo.score, map.score) + 0.2;
        tempo.mode = "misto";
        tempo.reasons.push("regra:tempo+map");
      }
    }
  }

  const hint = opts?.agentHint;
  if (hint) {
    const hinted = scored.find(
      (s) => s.agent.slug === hint || s.agent.name.toLowerCase() === hint.toLowerCase()
    );
    if (hinted) {
      hinted.score += 0.5;
      hinted.reasons.push("agent_hint");
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 3);
  const best = top[0];
  const second = top[1];
  const candidates: RouteCandidate[] = top.map((row) => ({
    slug: row.agent.slug,
    name: row.agent.name,
    score: Number(row.score.toFixed(3)),
    intentKey: row.intent?.key ?? null,
    mode: row.mode,
  }));

  if (!best) {
    return {
      agent: null,
      intent: null,
      mode: "esclarecer",
      confidence: 0,
      reasons: ["nenhum agente ativo"],
      candidates: [],
      normalized,
    };
  }

  const gap = best.score - (second?.score ?? 0);
  let confidence = 0.2 + best.score * 0.5 + Math.min(Math.max(gap, 0), 0.5) * 0.45;
  if (best.score >= 0.5) confidence = Math.max(confidence, 0.56);
  if (hint && best.agent.slug === hint) confidence = Math.max(confidence, 0.6);
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(3))));

  if (confidence < 0.5 || best.score < 0.25) {
    return {
      agent: null,
      intent: null,
      mode: "esclarecer",
      confidence: Number(confidence.toFixed(3)),
      reasons: ["confiança baixa", ...best.reasons],
      candidates,
      normalized,
    };
  }

  return {
    agent: { slug: best.agent.slug, name: best.agent.name },
    intent: best.intent,
    mode: best.mode,
    confidence: Number(confidence.toFixed(3)),
    reasons: best.reasons,
    candidates,
    normalized,
  };
}

export async function loadRouteAgents(): Promise<RouteAgent[]> {
  const rows = await prisma.agent.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      role: true,
      description: true,
      status: true,
      isOrchestrator: true,
      routing: true,
    },
  });
  return rows
    .filter((row) => row.slug)
    .map((row) => ({
      id: row.id,
      slug: row.slug as string,
      name: row.name,
      role: row.role,
      description: row.description,
      status: row.status,
      isOrchestrator: row.isOrchestrator,
      routing: asAgentRouting(row.routing),
    }));
}

export async function route(
  request: string,
  opts?: {
    agentHint?: string;
    agents?: RouteAgent[];
    includeFts?: boolean;
  }
): Promise<RouteResult> {
  const agents = opts?.agents ?? (await loadRouteAgents());
  let ftsScores: Record<string, number> | undefined;
  if (opts?.includeFts !== false) {
    const firstPass = routeFromAgents(request, agents, { agentHint: opts?.agentHint });
    const close = firstPass.candidates.slice(0, 3);
    if (close.length >= 2 && Math.abs((close[0]?.score ?? 0) - (close[1]?.score ?? 0)) < 0.15) {
      try {
        const { searchKnowledge } = await import("@/lib/knowledge/search");
        ftsScores = {};
        for (const c of close) {
          const agent = agents.find((a) => a.slug === c.slug);
          const hits = await searchKnowledge({
            query: request,
            agentId: agent?.id,
            topK: 3,
          });
          ftsScores[c.slug] = hits[0]?.score ?? 0;
        }
      } catch (err) {
        console.error("cortex fts tie-break failed", err);
      }
    }
  }
  return routeFromAgents(request, agents, { agentHint: opts?.agentHint, ftsScores });
}
