import { prisma } from "@/lib/prisma";
import { tiptapToPlainText } from "@/lib/knowledge/tiptap-text";
import { parseEditorDocument } from "@/lib/workspaces";
import { composePromptText } from "@/lib/agents/compose-text";

export { composePromptText };

export async function composeAgentPrompt(agentId: string): Promise<{
  composed: string;
  layers: {
    layer: string;
    fileId: string;
    title: string;
    text: string;
    enabled: boolean;
    order: number;
  }[];
}> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      promptLayers: {
        include: { file: true },
        orderBy: { order: "asc" },
      },
      knowledge: {
        include: { file: { select: { title: true, kind: true } } },
        take: 80,
      },
    },
  });
  if (!agent) throw new Error("Agente não encontrado");

  const layers = agent.promptLayers.map((row) => {
    const doc = parseEditorDocument(row.file.content);
    return {
      layer: row.layer,
      fileId: row.fileId,
      title: row.file.title,
      text: tiptapToPlainText(doc),
      enabled: row.enabled,
      order: row.order,
    };
  });

  return {
    composed: composePromptText(
      layers,
      agent.instructions,
      agent.knowledge.map((k) => ({ kind: k.file.kind, title: k.file.title }))
    ),
    layers,
  };
}

export async function publishPrompt(opts: {
  agentId: string;
  note?: string;
  createdBy?: string | null;
  source?: string;
}) {
  const { composed, layers } = await composeAgentPrompt(opts.agentId);
  const last = await prisma.agentPromptVersion.findFirst({
    where: { agentId: opts.agentId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const created = await prisma.agentPromptVersion.create({
    data: {
      agentId: opts.agentId,
      version,
      composedPrompt: composed,
      layersSnapshot: layers,
      note: opts.note ?? null,
      createdBy: opts.createdBy ?? null,
      source: opts.source ?? "ui",
    },
  });
  await prisma.agent.update({
    where: { id: opts.agentId },
    data: { activePromptVersionId: created.id, status: "active" },
  });
  return created;
}
