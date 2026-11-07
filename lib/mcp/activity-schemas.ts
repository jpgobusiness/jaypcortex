import { z } from "zod";

/** String no JSON Schema (Quick Draft 7). Em runtime ainda aceita array via preprocess. */
export const busyBlocksJson = z.preprocess(
  (value) => (Array.isArray(value) ? JSON.stringify(value) : value),
  z.string().optional()
);

/** Campos simples: o Action Review do Amazon Quick não renderiza `type: ["boolean","number"]`. */
export const idOrQueryShape = {
  id: z.string().optional(),
  query: z.string().optional(),
};

/**
 * Schema enxuto e só string — igual create_agent.
 * O Action Review do Quick não desenha o botão se houver number/array/~20 campos.
 * .passthrough() aceita os demais campos em runtime.
 */
export const createActivityShape = z.object({
  title: z.string(),
  priority: z.string().optional(),
  due: z.string().optional(),
  notes: z.string().optional(),
  add_to_queue: z.string().optional(),
  client_key: z.string().optional(),
}).passthrough();

export const createActivitiesBulkShape = z.object({
  items: z.preprocess(
    (value) => (Array.isArray(value) ? JSON.stringify(value) : value),
    z.string()
  ),
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
