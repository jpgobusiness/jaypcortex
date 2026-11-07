import { z } from "zod";

/** Campos simples: o Action Review do Amazon Quick não renderiza `type: ["boolean","number"]`. */
export const idOrQueryShape = {
  id: z.string().optional(),
  query: z.string().optional(),
};

export const createActivityShape = z.object({
  title: z.string(),
  type: z.string().optional(),
  type_id: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  estimated_minutes: z.number().optional(),
  importance: z.number().optional(),
  urgency: z.number().optional(),
  energy: z.string().optional(),
  context: z.string().optional(),
  tags: z.array(z.string()).optional(),
  area: z.string().optional(),
  waiting_on: z.string().optional(),
  parent_id: z.string().optional(),
  recurrence: z.string().optional(),
  client_key: z.string().optional(),
  add_to_queue: z.number().optional(),
  source: z.string().optional(),
});

export function queuePosition(value: unknown): number | boolean | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (value === true || value === "true") return true;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

export function jsonSchemaTypeIssues(schema: unknown, path = "$"): string[] {
  const issues: string[] = [];
  if (!schema || typeof schema !== "object") return issues;
  const node = schema as Record<string, unknown>;
  if (Array.isArray(node.type)) {
    issues.push(`${path}: type union ${JSON.stringify(node.type)}`);
  }
  if (Array.isArray(node.anyOf) || Array.isArray(node.oneOf) || Array.isArray(node.allOf)) {
    issues.push(`${path}: composite schema (anyOf/oneOf/allOf)`);
  }
  if (node.properties && typeof node.properties === "object") {
    for (const [key, child] of Object.entries(node.properties as Record<string, unknown>)) {
      issues.push(...jsonSchemaTypeIssues(child, `${path}.${key}`));
    }
  }
  if (node.items) issues.push(...jsonSchemaTypeIssues(node.items, `${path}.items`));
  return issues;
}
