/** Hints MCP (`tools/list` → `annotations`). São dicas, não contrato de segurança. */

export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

const closed = { openWorldHint: false as const };

export function readMeta(title: string) {
  return {
    title,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      ...closed,
    } satisfies ToolAnnotations,
  };
}

export function writeMeta(title: string, opts?: { destructive?: boolean; idempotent?: boolean }) {
  return {
    title,
    annotations: {
      readOnlyHint: false,
      destructiveHint: Boolean(opts?.destructive),
      idempotentHint: Boolean(opts?.idempotent),
      ...closed,
    } satisfies ToolAnnotations,
  };
}

export type ToolServer = {
  registerTool: (
    name: string,
    config: {
      title?: string;
      description: string;
      inputSchema: unknown;
      annotations?: ToolAnnotations;
    },
    handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>
  ) => void;
  registerPrompt?: (
    name: string,
    config: { title?: string; description: string; argsSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ messages: unknown[] }>
  ) => void;
};
