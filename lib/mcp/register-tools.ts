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
import { registerActivityTools } from "@/lib/mcp/register-activity-tools";
import { registerCortexTools } from "@/lib/mcp/register-cortex-tools";
import { registerOpportunityTools } from "@/lib/mcp/register-opportunity-tools";
import { parseEditorDocument } from "@/lib/workspaces";
import { readMeta, writeMeta, type ToolServer } from "@/lib/mcp/annotations";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function assertScope(scopes: string[], needed: McpScope | McpScope[]) {
  if (!hasScope(scopes, needed)) throw new Error("Token sem permissão para esta tool");
}

function wrap(
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>
) {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args);
    } catch (err) {
      console.error("mcp tool failed", err);
      return text({ error: err instanceof Error ? err.message : "Erro interno" });
    }
  };
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") return Number(v);
    if (v instanceof Date) return v.toISOString();
    return v;
  }));
}

export function registerMcpTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const actor = { createdBy: ctx.profileId || null, source: "mcp" as const };
  registerActivityTools(server, ctx);
  registerCortexTools(server, ctx);
  registerOpportunityTools(server, ctx);

  server.registerTool("list_agents", {
    ...readMeta("Listar agentes"),
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
    ...readMeta("Ver agente"),
    description: "Configuração do agente. Não executa nada; para agir use cortex + tools sugeridas.",
    inputSchema: z.object({ agent: z.string() }),
  }, wrap(async ({ agent }) => {
    assertScope(ctx.scopes, "read");
    const id = await resolveAgentId(String(agent));
    if (!id) return text({ error: "Agente não encontrado" });
    const row = await prisma.agent.findUnique({
      where: { id },
      include: {
        promptLayers: { include: { file: { select: { id: true, title: true, kind: true } } }, orderBy: { order: "asc" } },
        knowledge: { include: { file: { select: { id: true, title: true, kind: true, tags: true, indexStatus: true } } } },
      },
    });
    if (!row) return text({ error: "Agente não encontrado" });
    return text(jsonSafe({
      id: row.id,
      name: row.name,
      slug: row.slug,
      role: row.role,
      description: row.description,
      status: row.status,
      model: row.model,
      temperature: row.temperature,
      isOrchestrator: row.isOrchestrator,
      capabilities: row.capabilities,
      retrievalConfig: row.retrievalConfig,
      routing: row.routing,
      activePromptVersionId: row.activePromptVersionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      promptLayers: row.promptLayers,
      knowledge: row.knowledge,
    }));
  }));

  server.registerTool("get_agent_prompt", {
    ...readMeta("Prompt do agente"),
    description: "Prompt composto ativo e rascunho atual das camadas. Não executa o agente; para agir use cortex.",
    inputSchema: z.object({ agent: z.string() }),
  }, wrap(async ({ agent }) => {
    assertScope(ctx.scopes, "read");
    const id = await resolveAgentId(String(agent));
    if (!id) return text({ error: "Agente não encontrado" });
    const draft = await composeAgentPrompt(id);
    const row = await prisma.agent.findUnique({ where: { id }, select: { activePromptVersionId: true } });
    const published = row?.activePromptVersionId
      ? await prisma.agentPromptVersion.findUnique({
          where: { id: row.activePromptVersionId },
          select: { id: true, version: true, composedPrompt: true, note: true, createdAt: true, layersSnapshot: true },
        })
      : null;
    return text(jsonSafe({ draft, published }));
  }));

  server.registerTool("list_workspaces", {
    ...readMeta("Listar espaços"),
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
    ...readMeta("Listar documentos"),
    description: "Lista documentos da base de conhecimento. Só documentos — não contém tarefas. Para tarefas use list_activities ou cortex.",
    inputSchema: z.object({
      workspaceId: z.string().optional(),
      folderId: z.string().optional(),
      agent: z.string().optional(),
      kind: z.string().optional(),
      q: z.string().optional(),
    }),
  }, wrap(async (args) => {
    assertScope(ctx.scopes, "read");
    let agentId: string | null = null;
    if (args.agent) {
      agentId = await resolveAgentId(String(args.agent));
      if (!agentId) return text({ error: "Agente não encontrado" });
    }
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
    return text(jsonSafe(files));
  }));

  server.registerTool("read_document", {
    ...readMeta("Ler documento"),
    description: "Lê um documento da base de conhecimento. Só documentos — não contém tarefas. Para tarefas use list_activities ou cortex.",
    inputSchema: z.object({ file_id: z.string() }),
  }, wrap(async ({ file_id }) => {
    assertScope(ctx.scopes, "read");
    const file = await prisma.workspaceFile.findUnique({ where: { id: String(file_id) } });
    if (!file) return text({ error: "Arquivo não encontrado" });
    let markdown = "";
    try {
      markdown = tiptapToMarkdown(parseEditorDocument(file.content));
    } catch (err) {
      console.error("read_document markdown", file.id, err);
      markdown = "";
    }
    const MAX = 80_000;
    const truncated = markdown.length > MAX;
    return text(jsonSafe({
      id: file.id,
      title: file.title,
      kind: file.kind,
      tags: file.tags,
      hash: file.contentHash,
      updatedAt: file.updatedAt,
      markdown: truncated ? markdown.slice(0, MAX) + "\n\n…[truncado]" : markdown,
      truncated,
    }));
  }));

  server.registerTool("search_knowledge", {
    ...readMeta("Buscar na base"),
    description: "Busca híbrida na base de conhecimento (semântica + FTS). Só documentos — não contém tarefas. Para tarefas use list_activities ou cortex.",
    inputSchema: z.object({
      query: z.string(),
      agent: z.string().optional(),
      kinds: z.array(z.string()).optional(),
      top_k: z.number().optional(),
    }),
  }, wrap(async (args) => {
    assertScope(ctx.scopes, "read");
    let agentId: string | null = null;
    if (args.agent) {
      agentId = await resolveAgentId(String(args.agent));
      if (!agentId) return text({ error: "Agente não encontrado" });
    }
    const hits = await searchKnowledge({
      query: String(args.query),
      agentId,
      kinds: args.kinds as string[] | undefined,
      topK: typeof args.top_k === "number" ? args.top_k : 8,
    });
    return text(hits);
  }));

  server.registerTool("list_proposals", {
    ...readMeta("Listar propostas"),
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
    ...readMeta("Ver proposta"),
    description: "Detalhe de uma proposta com diff",
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
    assertScope(ctx.scopes, "read");
    const row = await prisma.changeProposal.findUnique({ where: { id: String(id) } });
    if (!row) throw new Error("Proposta não encontrada");
    return text(row);
  });

  server.registerTool("get_document_history", {
    ...readMeta("Histórico do documento"),
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
    ...writeMeta("Propor mudança"),
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
    ...writeMeta("Propor documento"),
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
    ...writeMeta("Propor prompt"),
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
    ...writeMeta("Propor config"),
    description: "Rascunho de config do agente (model, temperature, retrieval, capabilities)",
    inputSchema: z.object({
      agent: z.string(),
      rationale: z.string(),
      model: z.string().optional(),
      temperature: z.string().optional(),
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
        temperature: (() => {
          const n = Number(args.temperature);
          return Number.isFinite(n) ? n : undefined;
        })(),
        description: args.description ? String(args.description) : undefined,
      },
      ...actor,
    });
    return text({ id: proposal.id });
  });

  server.registerTool("apply_proposal", {
    ...writeMeta("Aplicar proposta", { idempotent: false }),
    description: "Aplica uma proposta pendente (checa conflito, reindexa, revisão)",
    inputSchema: z.object({ id: z.string(), publish: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const row = await applyProposal({ id: String(args.id), appliedBy: ctx.profileId, publish: args.publish === "true" || args.publish === "1" || args.publish === true });
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "apply_proposal", entity: "ChangeProposal", entityId: row.id });
    return text(row);
  });

  server.registerTool("reject_proposal", {
    ...writeMeta("Rejeitar proposta", { destructive: true, idempotent: true }),
    description: "Rejeita uma proposta pendente",
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
    assertScope(ctx.scopes, "write");
    const row = await rejectProposal(String(id));
    await writeAudit({ actorId: ctx.profileId, actorType: "mcp", tokenId: ctx.tokenId, action: "reject_proposal", entity: "ChangeProposal", entityId: row.id });
    return text(row);
  });

  server.registerTool("publish_prompt", {
    ...writeMeta("Publicar prompt"),
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
    ...writeMeta("Criar documento"),
    description: "Cria arquivo já aplicado (TipTap no banco). Prefira propor quando possível.",
    inputSchema: z.object({
      title: z.string(),
      agent: z.string(),
    }).passthrough(),
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
      content: String(args.markdown ?? ""),
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
    ...writeMeta("Atualizar documento", { idempotent: true }),
    description: "Atualiza arquivo já aplicado",
    inputSchema: z.object({ file_id: z.string(), markdown: z.string(), title: z.string().optional() }).passthrough(),
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
    ...writeMeta("Vincular à base", { idempotent: true }),
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
    ...writeMeta("Desvincular da base", { destructive: true, idempotent: true }),
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
    ...writeMeta("Criar agente"),
    description: "Cria agente + sala + pastas padrão (Prompt, Base, Templates, Entregas)",
    inputSchema: z.object({
      name: z.string(),
      slug: z.string().optional(),
      role: z.string().optional(),
      description: z.string().optional(),
    }).passthrough(),
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
    ...writeMeta("Reindexar documento", { idempotent: true }),
    description: "Reindexa um arquivo (FTS + embeddings se houver chave)",
    inputSchema: z.object({ file_id: z.string() }),
  }, async ({ file_id }) => {
    assertScope(ctx.scopes, "write");
    return text(await indexFile(String(file_id), { force: true }));
  });
}
