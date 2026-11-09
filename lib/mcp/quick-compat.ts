/** Amazon Quick valida inputSchema como JSON Schema Draft 7. Action Review trava com 2020-12, union, boolean/number/array. */

export const DRAFT7_SCHEMA = "http://json-schema.org/draft-07/schema#";

export type BusyBlock = { start: string; end: string; title?: string };

export function parseBusyBlocks(value: unknown): BusyBlock[] {
  if (Array.isArray(value)) {
    return value.filter((row) => row && typeof row === "object") as BusyBlock[];
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parseBusyBlocks(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* lista separada por vírgula */
    }
    return value.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function flattenUnion(node: Record<string, unknown>): Record<string, unknown> {
  const alts = (Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : null) as
    | unknown[]
    | null;
  if (!alts?.length) return node;
  const picked =
    alts.find((alt) => alt && typeof alt === "object" && (alt as { type?: unknown }).type !== "null") ?? alts[0];
  const flat = picked && typeof picked === "object" ? { ...node, ...(picked as Record<string, unknown>) } : node;
  delete flat.anyOf;
  delete flat.oneOf;
  delete flat.allOf;
  return flat;
}

function asSingleType(value: unknown): string {
  if (typeof value === "string") return value === "null" ? "string" : value;
  if (Array.isArray(value)) {
    const types = value.filter((item) => item !== "null");
    return typeof types[0] === "string" ? types[0] : "string";
  }
  return "string";
}

/** Draft 7, sem union. Em tools de escrita, cada campo vira string (Quick Action Review). */
export function toDraft7Schema(
  schema: unknown,
  opts: { stringsOnly?: boolean; root?: boolean } = {}
): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map((item) => toDraft7Schema(item, { ...opts, root: false }));
  let node = flattenUnion({ ...(schema as Record<string, unknown>) });
  delete node.additionalProperties;
  delete node.unevaluatedProperties;
  delete node.$defs;
  delete node.allOf;
  if (opts.root !== false) node.$schema = DRAFT7_SCHEMA;
  else delete node.$schema;

  if (Array.isArray(node.type)) node.type = asSingleType(node.type);

  const stringsOnly = Boolean(opts.stringsOnly);
  if (stringsOnly && node.type && node.type !== "object") {
    node.type = "string";
    delete node.items;
    delete node.minimum;
    delete node.maximum;
    delete node.minItems;
    delete node.maxItems;
    delete node.enum;
  }

  if (node.properties && typeof node.properties === "object") {
    node.properties = Object.fromEntries(
      Object.entries(node.properties as Record<string, unknown>).map(([key, child]) => {
        const next = toDraft7Schema(child, { stringsOnly, root: false }) as Record<string, unknown>;
        if (stringsOnly) {
          return [key, { type: "string", ...(typeof next.description === "string" ? { description: next.description } : {}) }];
        }
        return [key, next];
      })
    );
  }
  if (node.items) {
    node.items = stringsOnly
      ? { type: "string" }
      : toDraft7Schema(node.items, { stringsOnly, root: false });
  }
  return node;
}

function sanitizeTool(tool: Record<string, unknown>) {
  const next = { ...tool };
  delete next.execution;
  delete next._meta;
  delete next.outputSchema;
  const annotations = next.annotations && typeof next.annotations === "object"
    ? { ...(next.annotations as Record<string, unknown>) }
    : null;
  const isWrite = annotations != null && annotations.readOnlyHint !== true;
  if (next.inputSchema) next.inputSchema = toDraft7Schema(next.inputSchema, { stringsOnly: isWrite, root: true });
  if (annotations) {
    delete annotations.title;
    if (annotations.readOnlyHint === true && annotations.destructiveHint == null) {
      annotations.destructiveHint = false;
      annotations.idempotentHint = true;
    }
    next.annotations = annotations;
  }
  return next;
}

export function sanitizeMcpPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const body = payload as { result?: { tools?: Record<string, unknown>[] } };
  if (!Array.isArray(body.result?.tools)) return payload;
  return {
    ...body,
    result: {
      ...body.result,
      tools: body.result.tools.map((tool) => sanitizeTool({ ...tool })),
    },
  };
}

export async function sanitizeMcpHttpResponse(res: Response): Promise<Response> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const next = text.replace(/^data: (.+)$/gm, (_all, json: string) => {
      try {
        return `data: ${JSON.stringify(sanitizeMcpPayload(JSON.parse(json)))}`;
      } catch {
        return `data: ${json}`;
      }
    });
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(next, { status: res.status, statusText: res.statusText, headers });
  }
  if (contentType.includes("json")) {
    try {
      const json = sanitizeMcpPayload(await res.json());
      const headers = new Headers(res.headers);
      headers.delete("content-length");
      return new Response(JSON.stringify(json), { status: res.status, statusText: res.statusText, headers });
    } catch {
      return res;
    }
  }
  return res;
}
