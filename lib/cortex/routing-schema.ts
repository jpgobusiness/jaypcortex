import { z } from "zod";
import type { AgentRouting } from "@/lib/cortex/types";

const modeSchema = z.enum(["conhecimento", "acao", "misto"]);

export const agentRoutingSchema = z.object({
  domains: z.array(z.string()).optional(),
  intents: z.array(z.object({
    key: z.string().min(1),
    mode: modeSchema,
    examples: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    destructive: z.boolean().optional(),
  })).optional(),
  keywords: z.array(z.string()).optional(),
  knowledge_kinds: z.array(z.string()).optional(),
  allowed_tools: z.array(z.string()).optional(),
  default_mode: modeSchema.optional(),
});

export function parseAgentRouting(value: unknown): { ok: true; data: AgentRouting } | { ok: false; error: string } {
  const parsed = agentRoutingSchema.safeParse(value ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "routing inválido" };
  }
  return { ok: true, data: parsed.data };
}

export function asAgentRouting(value: unknown): AgentRouting {
  const parsed = parseAgentRouting(value);
  return parsed.ok ? parsed.data : {};
}
