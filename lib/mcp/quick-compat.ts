/** Amazon Quick valida inputSchema como JSON Schema Draft 7 e o Action Review quebra com 2020-12 / union / objeto aninhado. */

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

export function toDraft7Schema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(toDraft7Schema);
  const node = { ...(schema as Record<string, unknown>) };
  delete node.$schema;
  delete node.additionalProperties;
  if (Array.isArray(node.type)) {
    const types = node.type.filter((t) => t !== "null");
    node.type = types[0] ?? "string";
  }
  if (node.properties && typeof node.properties === "object") {
    node.properties = Object.fromEntries(
      Object.entries(node.properties as Record<string, unknown>).map(([key, child]) => [key, toDraft7Schema(child)])
    );
  }
  if (node.items) node.items = toDraft7Schema(node.items);
  return node;
}

function sanitizeTool(tool: Record<string, unknown>) {
  const next = { ...tool };
  if (next.inputSchema) next.inputSchema = toDraft7Schema(next.inputSchema);
  const annotations = next.annotations && typeof next.annotations === "object"
    ? { ...(next.annotations as Record<string, unknown>) }
    : null;
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
