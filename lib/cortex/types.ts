export const CORTEX_MODES = ["conhecimento", "acao", "misto", "esclarecer"] as const;
export type CortexMode = (typeof CORTEX_MODES)[number];
export type CortexWorkMode = Exclude<CortexMode, "esclarecer">;

export type CortexIntent = {
  key: string;
  mode: CortexWorkMode;
  examples?: string[];
  tools?: string[];
  keywords?: string[];
  destructive?: boolean;
};

export type AgentRouting = {
  domains?: string[];
  intents?: CortexIntent[];
  keywords?: string[];
  knowledge_kinds?: string[];
  allowed_tools?: string[];
  default_mode?: CortexWorkMode;
};

export type RouteAgent = {
  id?: string;
  slug: string;
  name: string;
  role?: string;
  description?: string;
  status?: string;
  isOrchestrator?: boolean;
  routing?: AgentRouting | null;
};

export type RouteCandidate = {
  slug: string;
  name: string;
  score: number;
  intentKey?: string | null;
  mode?: CortexWorkMode;
};

export type RouteResult = {
  agent: { slug: string; name: string } | null;
  intent: CortexIntent | null;
  mode: CortexMode;
  confidence: number;
  reasons: string[];
  candidates: RouteCandidate[];
  normalized: string;
};

export type SuggestedTool = {
  tool: string;
  args: Record<string, unknown>;
  why: string;
  requires_confirmation: boolean;
  candidates?: { id: string; title: string }[];
};

export type BusyBlock = { start: string; end: string; title?: string };

export type CortexContext = {
  routed_to: { slug: string; name: string; reason: string; confidence: number } | null;
  mode: CortexMode;
  intent: { key: string; mode: CortexWorkMode } | null;
  candidates: RouteCandidate[];
  agent_prompt: string;
  knowledge: { title: string; headingPath: string; fileId: string; score: number; content: string }[];
  live_data: unknown;
  suggested_tools: SuggestedTool[];
  instructions_for_client: string;
  missing_scope?: string[];
};
