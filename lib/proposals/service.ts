import { prisma } from "@/lib/prisma";
import { contentHash } from "@/lib/knowledge/hash";
import { upsertFileContent } from "@/lib/knowledge/files";
import { markdownToTiptap, sanitizeTiptap, tiptapToMarkdown } from "@/lib/knowledge/markdown";
import { unifiedDiff } from "@/lib/proposals/diff";
import { parseEditorDocument } from "@/lib/workspaces";
import { publishPrompt } from "@/lib/agents/prompt-composer";
import type { Prisma } from "@/app/generated/prisma-postgres/client";

export async function createProposal(opts: {
  agentId?: string | null;
  targetType: string;
  targetId?: string | null;
  title: string;
  rationale: string;
  markdown?: string;
  content?: Prisma.InputJsonValue;
  proposedMeta?: Prisma.InputJsonValue;
  createdBy?: string | null;
  source?: string;
}) {
  let currentText = "";
  let baseHash: string | null = null;
  if (opts.targetId && opts.targetType === "file") {
    const file = await prisma.workspaceFile.findUnique({ where: { id: opts.targetId } });
    if (!file) throw new Error("Arquivo não encontrado");
    currentText = tiptapToMarkdown(parseEditorDocument(file.content));
    baseHash = contentHash(file.content, file.title);
  }
  const doc = opts.content
    ? sanitizeTiptap(opts.content)
    : markdownToTiptap(opts.markdown ?? "");
  const nextText = tiptapToMarkdown(doc);
  const proposal = await prisma.changeProposal.create({
    data: {
      agentId: opts.agentId ?? null,
      targetType: opts.targetType,
      targetId: opts.targetId ?? null,
      title: opts.title,
      rationale: opts.rationale,
      baseHash,
      proposedContent: doc as Prisma.InputJsonValue,
      proposedMeta: opts.proposedMeta ?? undefined,
      diffText: unifiedDiff(currentText, nextText, opts.title),
      createdBy: opts.createdBy ?? null,
      source: opts.source ?? "mcp",
    },
  });
  return proposal;
}

export async function applyProposal(opts: {
  id: string;
  appliedBy?: string | null;
  publish?: boolean;
}) {
  const proposal = await prisma.changeProposal.findUnique({ where: { id: opts.id } });
  if (!proposal) throw new Error("Proposta não encontrada");
  if (proposal.status !== "pending") throw new Error(`Proposta ${proposal.status}`);

  const meta = (proposal.proposedMeta ?? {}) as {
    title?: string;
    kind?: string;
    tags?: string[];
    workspaceId?: string;
    folderId?: string | null;
    layer?: string;
  };

  if (proposal.targetType === "file" || proposal.targetType === "prompt_layer") {
    const fileId = proposal.targetId;
    if (!fileId) throw new Error("Proposta sem arquivo");
    const current = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
    if (!current) throw new Error("Arquivo não encontrado");
    const nowHash = contentHash(current.content, current.title);
    if (proposal.baseHash && proposal.baseHash !== nowHash) {
      await prisma.changeProposal.update({
        where: { id: proposal.id },
        data: { status: "conflict" },
      });
      throw new Error("Conflito: o arquivo mudou depois do rascunho");
    }
    await upsertFileContent({
      fileId,
      title: meta.title ?? current.title,
      content: sanitizeTiptap(proposal.proposedContent),
      kind: meta.kind,
      tags: meta.tags,
      createdBy: opts.appliedBy,
      source: "mcp",
      proposalId: proposal.id,
    });
  } else if (proposal.targetType === "new_file") {
    if (!meta.workspaceId) throw new Error("workspaceId ausente");
    const created = await upsertFileContent({
      workspaceId: meta.workspaceId,
      folderId: meta.folderId ?? null,
      title: meta.title,
      content: sanitizeTiptap(proposal.proposedContent),
      kind: meta.kind,
      tags: meta.tags,
      createdBy: opts.appliedBy,
      source: "mcp",
      proposalId: proposal.id,
    });
    if (proposal.agentId && created.file) {
      await prisma.agentKnowledge.upsert({
        where: { agentId_fileId: { agentId: proposal.agentId, fileId: created.file.id } },
        create: { agentId: proposal.agentId, fileId: created.file.id },
        update: {},
      });
    }
  } else if (proposal.targetType === "agent_config" && proposal.agentId) {
    const patch = proposal.proposedContent as {
      model?: string;
      temperature?: number;
      description?: string;
      retrievalConfig?: Prisma.InputJsonValue;
      capabilities?: Prisma.InputJsonValue;
    };
    await prisma.agent.update({
      where: { id: proposal.agentId },
      data: {
        ...(patch.model ? { model: patch.model } : {}),
        ...(typeof patch.temperature === "number" ? { temperature: patch.temperature } : {}),
        ...(patch.description ? { description: patch.description } : {}),
        ...(patch.retrievalConfig ? { retrievalConfig: patch.retrievalConfig } : {}),
        ...(patch.capabilities ? { capabilities: patch.capabilities } : {}),
      },
    });
  }

  const updated = await prisma.changeProposal.update({
    where: { id: proposal.id },
    data: { status: "applied", appliedBy: opts.appliedBy ?? null, appliedAt: new Date() },
  });

  if (opts.publish && proposal.agentId && proposal.targetType === "prompt_layer") {
    await publishPrompt({
      agentId: proposal.agentId,
      createdBy: opts.appliedBy,
      source: "mcp",
      note: `proposta ${proposal.id}`,
    });
  }
  return updated;
}

export async function rejectProposal(id: string) {
  const proposal = await prisma.changeProposal.findUnique({ where: { id } });
  if (!proposal) throw new Error("Proposta não encontrada");
  if (proposal.status !== "pending") throw new Error(`Proposta ${proposal.status}`);
  return prisma.changeProposal.update({
    where: { id },
    data: { status: "rejected" },
  });
}
