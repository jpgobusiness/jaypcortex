/**
 * Seed idempotente do Agente de Migração AWS (slug migracao-aws).
 * Cria/atualiza sala, pastas, 6 camadas de prompt, ≥12 docs, 5 templates, vínculos e prompt v1.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createAgentWithRoom } from "../lib/agents-db";
import { ROOM_FOLDERS } from "../lib/agents";
import { upsertFileContent } from "../lib/knowledge/files";
import { publishPrompt } from "../lib/agents/prompt-composer";
import { LAYER_LABELS, type PromptLayer } from "../lib/knowledge/kinds";
import { DOCS, LAYERS } from "./data/migracao-aws-content";

const SLUG = "migracao-aws";

async function ensureFolder(workspaceId: string, name: string, order: number) {
  const existing = await prisma.workspaceFolder.findFirst({
    where: { workspaceId, name },
  });
  if (existing) return existing;
  return prisma.workspaceFolder.create({
    data: { workspaceId, name, order },
  });
}

async function upsertNamedFile(opts: {
  workspaceId: string;
  folderId: string;
  title: string;
  kind: string;
  tags: string[];
  markdown: string;
}) {
  const existing = await prisma.workspaceFile.findFirst({
    where: { workspaceId: opts.workspaceId, title: opts.title },
    select: { id: true },
  });
  return upsertFileContent({
    fileId: existing?.id,
    workspaceId: opts.workspaceId,
    folderId: opts.folderId,
    title: opts.title,
    content: opts.markdown,
    kind: opts.kind,
    tags: opts.tags,
    source: "seed",
  });
}

async function main() {
  let agent = await prisma.agent.findFirst({
    where: { slug: SLUG },
    include: { workspace: { include: { folders: true } } },
  });

  if (!agent) {
    const created = await createAgentWithRoom({
      name: "Agente de Migração AWS",
      slug: SLUG,
      role: "Arquiteto de Migração MAP",
      description:
        "Apoia a jornada MAP (Assess → Mobilize → Migrate & Modernize): escopo, propostas, funding, 7R e templates Nuage.",
      status: "active",
      model: "claude-sonnet",
      temperature: 0.3,
      shirtColor: "#e87722",
      capabilities: [
        "escopo-assess",
        "proposta",
        "funding-map",
        "7r",
        "tco",
        "ondas",
      ] as object,
    });
    if ("error" in created) {
      console.warn(created.error, "— criando agente sem mesa");
      const last = await prisma.workspace.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
      const room = await prisma.workspace.create({
        data: {
          name: "Sala · Agente de Migração AWS",
          description: "Sala do agente de migração MAP",
          color: "#e87722",
          order: (last?.order ?? -1) + 1,
        },
      });
      await prisma.workspaceFolder.createMany({
        data: ROOM_FOLDERS.map((name, order) => ({ workspaceId: room.id, name, order })),
      });
      agent = await prisma.agent.create({
        data: {
          name: "Agente de Migração AWS",
          slug: SLUG,
          role: "Arquiteto de Migração MAP",
          description:
            "Apoia a jornada MAP (Assess → Mobilize → Migrate & Modernize): escopo, propostas, funding, 7R e templates Nuage.",
          status: "active",
          shirtColor: "#e87722",
          workspaceId: room.id,
        },
        include: { workspace: { include: { folders: true } } },
      });
    } else {
      agent = await prisma.agent.findUniqueOrThrow({
        where: { id: created.agent.id },
        include: { workspace: { include: { folders: true } } },
      });
    }
  } else {
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        name: "Agente de Migração AWS",
        role: "Arquiteto de Migração MAP",
        status: "active",
        description:
          "Apoia a jornada MAP (Assess → Mobilize → Migrate & Modernize): escopo, propostas, funding, 7R e templates Nuage.",
      },
    });
  }

  if (!agent.workspaceId) throw new Error("Agente sem sala");
  const workspaceId = agent.workspaceId;

  const folders: Record<string, string> = {};
  for (const [order, name] of ROOM_FOLDERS.entries()) {
    const folder = await ensureFolder(workspaceId, name, order);
    folders[name] = folder.id;
  }

  for (const [order, layer] of LAYERS.entries()) {
    const saved = await upsertNamedFile({
      workspaceId,
      folderId: folders.Prompt,
      title: layer.title,
      kind: "prompt",
      tags: ["prompt", layer.layer],
      markdown: layer.markdown,
    });
    const fileId = saved.file?.id;
    if (!fileId) throw new Error(`Falha ao gravar camada ${layer.layer}`);
    await prisma.agentPromptLayer.upsert({
      where: { agentId_layer: { agentId: agent.id, layer: layer.layer } },
      create: {
        agentId: agent.id,
        fileId,
        layer: layer.layer as PromptLayer,
        order,
        enabled: true,
      },
      update: { fileId, order, enabled: true },
    });
    console.log("camada", LAYER_LABELS[layer.layer as PromptLayer] ?? layer.layer);
  }

  for (const doc of DOCS) {
    const saved = await upsertNamedFile({
      workspaceId,
      folderId: folders[doc.folder],
      title: doc.title,
      kind: doc.kind,
      tags: doc.tags,
      markdown: doc.markdown,
    });
    const fileId = saved.file?.id;
    if (!fileId) throw new Error(`Falha ao gravar ${doc.title}`);
    if (doc.folder === "Base de conhecimento" || doc.folder === "Templates") {
      await prisma.agentKnowledge.upsert({
        where: { agentId_fileId: { agentId: agent.id, fileId } },
        create: { agentId: agent.id, fileId },
        update: {},
      });
    }
    console.log(doc.kind, saved.index?.status, doc.title);
  }

  const versions = await prisma.agentPromptVersion.count({ where: { agentId: agent.id } });
  if (versions === 0) {
    const published = await publishPrompt({
      agentId: agent.id,
      note: "v1 seed MAP",
      source: "seed",
    });
    console.log("prompt publicado", published.version, published.id);
  } else {
    console.log(`prompt já tem ${versions} versão(ões); não republica`);
  }

  const counts = {
    layers: await prisma.agentPromptLayer.count({ where: { agentId: agent.id } }),
    knowledge: await prisma.agentKnowledge.count({ where: { agentId: agent.id } }),
    files: await prisma.workspaceFile.count({ where: { workspaceId } }),
  };
  console.log(JSON.stringify({ slug: SLUG, agentId: agent.id, workspaceId, ...counts }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
