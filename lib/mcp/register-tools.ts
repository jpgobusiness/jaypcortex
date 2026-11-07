import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { composeAgentPrompt, publishPrompt } from "@/lib/agents/prompt-composer";
import { createAgentWithRoom } from "@/lib/agents-db";
import { ROOM_FOLDERS } from "@/lib/agents";
import { upsertFileContent } from "@/lib/knowledge/files";
import { indexFile } from "@/lib/knowledge/indexer";
import { resolveAgentId, searchKnowledge } from "@/lib/knowledge/search";
import { tiptapToMarkdown } from "@/lib/knowledge/markdown";
import { applyProposal, createProposal, rejectProposal } from "@/lib/proposals/service";
import { writeAudit } from "@/lib/mcp/audit";
import { hasScope, type McpScope } from "@/lib/mcp/tokens";
import { parseEditorDocument } from "@/lib/workspaces";

type ToolServer = {
  registerTool: (
    name: string,
    config: { title?: string; description: string; inputSchema: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>
  ) => void;
};

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function assertScope(scopes: string[], needed: McpScope | McpScope[]) {
  if (!hasScope(scopes, needed)) throw new Error("Token sem permissão para esta tool");
}

export function registerMcpTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const actor = { createdBy: ctx.profileId || null, source: "mcp" as const };

  server.registerTool("list_agents", {
    description: "Lista agentes com slug, papel, status, versão do prompt e nº de docs",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "read");
    const agents = await prisma.agent.findMany({
      include: { _count: { select: { knowledge: true, proposals: true } } },
      orderBy: [{ isOrchestrator: "desc" }, { name: "asc" }],
    });
    return text(agents.map((a) => ({
      id: a.id, name: a.name, slug: a.slug, role: a.role, status: a.status,
      model: a.model, docs: a._count.knowledge, pendingProposals: a._count.proposals,
      activePromptVersionId: a.activePromptVersionId,
    })));
  });

  server.registerTool("get_agent", {
    description: "Config completa do agente, camadas do prompt e catálogo da base",
    inputSchema: z.object({ agent: z.string() }),
  }, async ({ agent }) => {
    assertScope(ctx.scopes, "read");
    const id = await resolveAgentId(String(agent));
    if (!id) throw new Error("Agente não encontrado");
    const row = await prisma.agent.findUnique({
      where: { id },
      include: {
        promptLayers: { include: { file: { select: { id: true, title: true, kind: true } } }, orderBy: { order: "asc" } },
        knowledge: { include: { file: { select: { id: true, title: true, kind: true, tags: true, indexStatus: true } } } },
      },
    });
    return text(row);
  });

  server.registerTool("get_agent_prompt", {
    description: "Prompt composto ativo e rascunho atual das camadas",
    inputSchema: z.object({ agent: z.string() }),
  }, async ({ agent }) => {
    assertScope(ctx.scopes, "read");
    const id = await resolveAgentId(String(agent));
    if (!id) throw new Error("Agente não encontrado");
    const draft = await composeAgentPrompt(id);
    const row = await prisma.agent.findUnique({ where: { id }, select: { activePromptVersionId: true } });
    const published = row?.activePromptVersionId
      ? await prisma.agentPromptVersion.findUnique({ where: { id: row.activePromptVersionId } })
      : null;
    return text({ draft, published });
  });

  server.registerTool("list_workspaces", {
    description: "Lista espaços de trabalho",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "read");
    const rows = await prisma.workspace.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { files: true } }, agent: { select: { id: true, slug: true } } },
    });
    return text(rows);
  });

  server.registerTool("list_documents", {
    description: "Lista documentos com filtros de espaço, pasta, agente, kind, tags e texto",
    inputSchema: z.object({
      workspaceId: z.string().optional(),
      folderId: z.string().optional(),
      agent: z.string().optional(),
      kind: z.string().optional(),
      q: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    const agentId = args.agent ? await resolveAgentId(String(args.agent)) : null;
    const files = await prisma.workspaceFile.findMany({
      where: {
        ...(args.workspaceId ? { workspaceId: String(args.workspaceId) } : {}),
        ...(args.folderId ? { folderId: String(args.folderId) } : {}),
        ...(args.kind ? { kind: String(args.kind) } : {}),
        ...(args.q ? { OR: [
          { title: { contains: String(args.q), mode: "insensitive" } },
          { searchText: { contains: String(args.q), mode: "insensitive" } },
        ] } : {}),
        ...(agentId ? { knowledge: { some: { agentId } } } : {}),
      },
      select: { id: true, title: true, kind: true, tags: true, indexStatus: true, workspaceId: true, folderId: true, updatedAt: true },
      take: 100,
      orderBy: { updatedAt: "desc" },
    });
    return text(files);
  });

  server.registerTool("read_document", {
    description: "Lê um documento (markdown de leitura, hash, kind, tags)",
    inputSchema: z.object({ file_id: z.string() }),
  }, async ({ file_id }) => {
    assertScope(ctx.scopes, "read");
    const file = await prisma.workspaceFile.findUnique({ where: { id: String(file_id) } });
    if (!file) throw new Error("Arquivo não encontrado");
    return text({
      id: file.id,
      title: file.title,
      kind: file.kind,
      tags: file.tags,
      hash: file.contentHash,
      updatedAt: file.updatedAt,
      markdown: tiptapToMarkdown(parseEditorDocument(file.content)),
    });
  });

  server.registerTool("search_knowledge", {
    description: "Busca híbrida na base (semântica + FTS). Informe agent (slug) para filtrar.",
    inputSchema: z.object({
      query: z.string(),
      agent: z.string().optional(),
      kinds: z.array(z.string()).optional(),
      top_k: z.number().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    const agentId = args.agent ? await resolveAgentId(String(args.agent)) : null;
    const hits = await searchKnowledge({
      query: String(args.query),
      agentId,
      kinds: args.kinds as string[] | undefined,
      topK: typeof args.top_k === "number" ? args.top_k : 8,
    });
    return text(hits);
  });

  server.registerTool("list_proposals", {
    description: "Lista propostas de mudança",
    inputSchema: z.object({ agent: z.string().optional(), status: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    const agentId = args.agent ? await resolveAgentId(String(args.agent)) : null;
    const rows = await prisma.changeProposal.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        ...(args.status ? { status: String(args.status) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return text(rows);
  });

  server.registerTool("get_proposal", {
    description: "Detalhe de uma proposta com diff",
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
    assertScope(ctx.scopes, "read");
    const row = await prisma.changeProposal.findUnique({ where: { id: String(id) } });
    if (!row) throw new Error("Proposta não encontrada");
    return text(row);
  });

  server.registerTool("get_document_history", {
    description: "Revisões de um arquivo",
    inputSchema: z.object({ file_id: z.string() }),
  }, async ({ file_id }) => {
    assertScope(ctx.scopes, "read");
    const rows = await prisma.fileRevision.findMany({
      where: { fileId: String(file_id) },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, hash: true, source: true, createdAt: true, createdBy: true },
    });
    return text(rows);
  });

  server.registerTool("propose_document_change", {
    description: "Cria rascunho de mudança em um arquivo existente (markdown novo)",
    inputSchema: z.object({
      file_id: z.string(),
      markdown: z.string(),
      rationale: z.string(),
      title: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "propose");
    if (String(args.markdown).length > 1_000_000) throw new Error("Markdown > 1 MB");
    const file = await prisma.workspaceFile.findUnique({ where: { id: String(args.file_id) } });
    if (!file) throw new Error("Arquivo não encontrado");
    const link = await prisma.agentKnowledge.findFirst({ where: { fileId: file.id } });
    const proposal = await createProposal({
      agentId: link?.agentId,
      targetType: "file",
      targetId: file.id,
      title: String(args.title || `Atualizar ${file.title}`),
      rationale: String(args.rationale),
      markdown: String(args.markdown),
      proposedMeta: { title: file.title, kind: file.kind, tags: file.tags },
      ...actor,
    });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "propose_document_change", entity: "ChangeProposal", entityId: proposal.id });
    return text({ id: proposal.id, status: proposal.status, diff: proposal.diffText, ui: `/escritorio?proposta=${proposal.id}` });
  });

  server.registerTool("propose_new_document", {
    description: "Rascunho de arquivo novo na sala do agente",
    inputSchema: z.object({
      agent: z.string(),
      title: z.string(),
      markdown: z.string(),
      kind: z.string().optional(),
      rationale: z.string(),
      folder: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "propose");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    const agent = await prisma.agent.findUnique({ where: { id }, include: { workspace: { include: { folders: true } } } });
    if (!agent?.workspaceId) throw new Error("Agente sem sala");
    const folderName = String(args.folder || "Base de conhecimento");
    const folder = agent.workspace?.folders.find((f) => f.name === folderName) ?? agent.workspace?.folders[0];
    const proposal = await createProposal({
      agentId: id,
      targetType: "new_file",
      title: String(args.title),
      rationale: String(args.rationale),
      markdown: String(args.markdown),
      proposedMeta: {
        title: String(args.title),
        kind: String(args.kind ?? "contexto"),
        workspaceId: agent.workspaceId,
        folderId: folder?.id ?? null,
      },
      ...actor,
    });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "propose_new_document", entity: "ChangeProposal", entityId: proposal.id });
    return text({ id: proposal.id, diff: proposal.diffText });
  });

  server.registerTool("propose_prompt_change", {
    description: "Rascunho de mudança em uma camada de prompt",
    inputSchema: z.object({
      agent: z.string(),
      layer: z.string(),
      markdown: z.string(),
      rationale: z.string(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "propose");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    const layer = await prisma.agentPromptLayer.findFirst({ where: { agentId: id, layer: String(args.layer) } });
    if (!layer) throw new Error("Camada não encontrada");
    const proposal = await createProposal({
      agentId: id,
      targetType: "prompt_layer",
      targetId: layer.fileId,
      title: `Prompt · ${args.layer}`,
      rationale: String(args.rationale),
      markdown: String(args.markdown),
      proposedMeta: { layer: String(args.layer) },
      ...actor,
    });
    return text({ id: proposal.id, diff: proposal.diffText });
  });

  server.registerTool("propose_agent_config", {
    description: "Rascunho de config do agente (model, temperature, retrieval, capabilities)",
    inputSchema: z.object({
      agent: z.string(),
      rationale: z.string(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      description: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "propose");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    const proposal = await createProposal({
      agentId: id,
      targetType: "agent_config",
      targetId: id,
      title: "Config do agente",
      rationale: String(args.rationale),
      content: {
        model: args.model ? String(args.model) : undefined,
        temperature: typeof args.temperature === "number" ? args.temperature : undefined,
        description: args.description ? String(args.description) : undefined,
      },
      ...actor,
    });
    return text({ id: proposal.id });
  });

  server.registerTool("apply_proposal", {
    description: "Aplica uma proposta pendente (checa conflito, reindexa, revisão)",
    inputSchema: z.object({ id: z.string(), publish: z.boolean().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const row = await applyProposal({ id: String(args.id), appliedBy: ctx.profileId, publish: Boolean(args.publish) });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "apply_proposal", entity: "ChangeProposal", entityId: row.id });
    return text(row);
  });

  server.registerTool("reject_proposal", {
    description: "Rejeita uma proposta pendente",
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
    assertScope(ctx.scopes, "write");
    const row = await rejectProposal(String(id));
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "reject_proposal", entity: "ChangeProposal", entityId: row.id });
    return text(row);
  });

  server.registerTool("publish_prompt", {
    description: "Publica uma nova versão imutável do prompt composto",
    inputSchema: z.object({ agent: z.string(), note: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    const version = await publishPrompt({ agentId: id, note: args.note ? String(args.note) : undefined, createdBy: ctx.profileId || null, source: "mcp" });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "publish_prompt", entity: "AgentPromptVersion", entityId: version.id });
    return text(version);
  });

  server.registerTool("create_document", {
    description: "Cria arquivo já aplicado (TipTap no banco). Prefira propor quando possível.",
    inputSchema: z.object({
      agent: z.string(),
      title: z.string(),
      markdown: z.string(),
      kind: z.string().optional(),
      folder: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    const agent = await prisma.agent.findUnique({ where: { id }, include: { workspace: { include: { folders: true } } } });
    if (!agent?.workspaceId) throw new Error("Agente sem sala");
    const folderName = String(args.folder || ROOM_FOLDERS[1]);
    const folder = agent.workspace?.folders.find((f) => f.name === folderName);
    const saved = await upsertFileContent({
      workspaceId: agent.workspaceId,
      folderId: folder?.id ?? null,
      title: String(args.title),
      content: String(args.markdown),
      kind: args.kind ? String(args.kind) : "contexto",
      createdBy: ctx.profileId || null,
      source: "mcp",
    });
    if (saved.file) {
      await prisma.agentKnowledge.upsert({
        where: { agentId_fileId: { agentId: id, fileId: saved.file.id } },
        create: { agentId: id, fileId: saved.file.id },
        update: {},
      });
    }
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "create_document", entity: "WorkspaceFile", entityId: saved.file?.id });
    return text(saved.file);
  });

  server.registerTool("update_document", {
    description: "Atualiza arquivo já aplicado",
    inputSchema: z.object({ file_id: z.string(), markdown: z.string(), title: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const saved = await upsertFileContent({
      fileId: String(args.file_id),
      title: args.title ? String(args.title) : undefined,
      content: String(args.markdown),
      createdBy: ctx.profileId || null,
      source: "mcp",
    });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "update_document", entity: "WorkspaceFile", entityId: String(args.file_id) });
    return text(saved.file);
  });

  server.registerTool("link_knowledge", {
    description: "Vincula arquivo à base do agente",
    inputSchema: z.object({ agent: z.string(), file_id: z.string() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    await prisma.agentKnowledge.upsert({
      where: { agentId_fileId: { agentId: id, fileId: String(args.file_id) } },
      create: { agentId: id, fileId: String(args.file_id) },
      update: {},
    });
    return text({ ok: true });
  });

  server.registerTool("unlink_knowledge", {
    description: "Remove vínculo agente ↔ arquivo",
    inputSchema: z.object({ agent: z.string(), file_id: z.string() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const id = await resolveAgentId(String(args.agent));
    if (!id) throw new Error("Agente não encontrado");
    await prisma.agentKnowledge.deleteMany({ where: { agentId: id, fileId: String(args.file_id) } });
    return text({ ok: true });
  });

  server.registerTool("create_agent", {
    description: "Cria agente + sala + pastas padrão (Prompt, Base, Templates, Entregas)",
    inputSchema: z.object({
      name: z.string(),
      slug: z.string().optional(),
      role: z.string().optional(),
      description: z.string().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const result = await createAgentWithRoom({
      name: String(args.name),
      slug: args.slug ? String(args.slug) : undefined,
      role: args.role ? String(args.role) : "",
      description: args.description ? String(args.description) : "",
      status: "draft",
    });
    if ("error" in result) throw new Error(result.error);
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "create_agent", entity: "Agent", entityId: result.agent.id });
    return text(result.agent);
  });

  server.registerTool("reindex_document", {
    description: "Reindexa um arquivo (FTS + embeddings se houver chave)",
    inputSchema: z.object({ file_id: z.string() }),
  }, async ({ file_id }) => {
    assertScope(ctx.scopes, "write");
    return text(await indexFile(String(file_id), { force: true }));
  });
}
